import { readBonusPosition } from './bonusPickup';
import type { BonusPosition } from './bonusPickup';
import { featureScope } from './featureRuntime';
import { postPageMessage } from './pageMessages';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export const OVERDRIVE_DIRECTION_MESSAGE = 'kasp:overdrive-direction';
export interface OverdrivePose { position: BonusPosition; yaw: number; }
export interface DirectionHookStatus { ready: boolean; hooked: boolean; strategy: 'ast-plan' | 'ast-template'; issues: string[]; }
export interface DirectionPatchPlan extends PreparedPatchPlan { format: 'ki-overdrive-direction-v1'; status: DirectionHookStatus; }
const MARKER = '/*ki-overdrive-direction:v1:';

export function overdriveBearing(target: BonusPosition, pose: OverdrivePose): number | null {
    const dx = target.x - pose.position.x, dy = target.y - pose.position.y;
    if (![dx, dy, pose.yaw].every(Number.isFinite) || Math.hypot(dx, dy) < 100) return null;
    const right = dx * Math.cos(pose.yaw) + dy * Math.sin(pose.yaw);
    const forward = -dx * Math.sin(pose.yaw) + dy * Math.cos(pose.yaw);
    return Math.atan2(right, forward) * 180 / Math.PI;
}
export function continuousBearing(previous: number | null, next: number): number {
    return previous === null ? next : previous + ((next - previous + 540) % 360 + 360) % 360 - 180;
}

export async function selectDirectionPlan(source: string, plans: readonly DirectionPatchPlan[]): Promise<DirectionPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.status.ready && plan.sourceLength === source.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(source), exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch {}
    for (const plan of [...plans].reverse()) {
        if (!plan.status.ready || plan.format !== 'ki-overdrive-direction-v1') continue;
        try {
            const adapted = resolveTemplateEdits(source, plan);
            if (!adapted) continue;
            const status: DirectionHookStatus = { ...plan.status, strategy: 'ast-template' };
            return { ...plan, status, sha256: '', sourceLength: source.length, edits: [
                { start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' },
                ...adapted.edits,
            ] };
        } catch {}
    }
    return undefined;
}
export function directionPlanValid(source: string, plan: DirectionPatchPlan): boolean {
    return plan.format === 'ki-overdrive-direction-v1' && plan.status.ready && validatePatchEdits(source, plan);
}

export function installOverdriveDirection(page: Window) {
    const scope = featureScope('overdriveDirection');
    let enabled = false, nextAt = 0, valid = false, samples = 0;
    let mapping: DirectionHookStatus | null = null;
    const clear = () => {
        if (valid) postPageMessage(page, { type: OVERDRIVE_DIRECTION_MESSAGE, pose: null, at: Date.now() });
        valid = false;
    };
    const sync = () => {
        try { enabled = localStorage.getItem('k_overdrive_timer') === 'true'; } catch { enabled = false; }
        if (!enabled) clear();
    };
    const bridge = {
        wanted() {
            if (!enabled || scope.disabled || document.visibilityState === 'hidden') return false;
            const now = performance.now();
            if (now < nextAt) return false;
            nextAt = now + 80;
            return true;
        },
        capture(position: unknown, rotation: unknown) {
            if (!enabled || scope.disabled) { clear(); return; }
            scope.run(() => {
                const point = readBonusPosition(position), angles = readBonusPosition(rotation);
                if (!point || !angles || [point.x, point.y, point.z].some(value => Math.abs(value) > 1e8)
                    || Math.abs(angles.z) > 1e6) { clear(); return; }
                const pose = { position: point, yaw: angles.z };
                postPageMessage(page, { type: OVERDRIVE_DIRECTION_MESSAGE, pose, at: Date.now() });
                valid = true; samples++;
            });
        },
    };
    page.__kaspOverdriveDirection = bridge;
    page.__kaspOverdriveDirectionDebug = { status: () => ({ enabled, valid, samples, mapping, runtime: scope.status() }) };
    scope.listen(page, 'kasp:settings-changed', sync);
    scope.listen(page, 'storage', sync);
    scope.interval(sync, 1000);
    scope.onCleanup(clear);
    sync();
    return { reportHook(status: DirectionHookStatus) { mapping = { ...status, issues: [...status.issues] }; } };
}
