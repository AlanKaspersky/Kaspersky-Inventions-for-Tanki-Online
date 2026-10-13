import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface ArcadeReloadHookStatus {
    hooked: boolean;
    issues: string[];
    panel?: 'local-hud';
    ready?: boolean;
    strategy?: 'ast-plan' | 'ast-template';
}
export interface ArcadeReloadSample {
    weapon: 'Shaft' | 'Scorpio' | null;
    progress: number | null;
    barCreated: boolean;
    visible: boolean;
}
export interface ArcadeReloadPatchPlan extends PreparedPatchPlan {
    format: 'ki-arcade-ast-v1';
    status: ArcadeReloadHookStatus;
}
const MARKER = '/*ki-arcade-ast:v1:';
const unavailable = (issue: string): ArcadeReloadHookStatus => ({ hooked: false, ready: false, issues: [issue], strategy: 'ast-plan' });

/** Only prepared data is shipped. Unknown builds are tried against AST-generated templates. */
export async function selectArcadeReloadPlan(code: string, plans: readonly ArcadeReloadPatchPlan[]): Promise<ArcadeReloadPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-arcade-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-arcade-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        const status: ArcadeReloadHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', status, edits };
    } catch { }
    return undefined;
}

/** All guards are checked before modifying the native game; failures skip only the added HUD row. */
export function patchArcadeReload(code: string, report?: (status: ArcadeReloadHookStatus) => void, plan?: ArcadeReloadPatchPlan): string {
    const done = (result: string, status: ArcadeReloadHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, panel: 'local-hud', issues: [] });
    if (!plan) return done(code, unavailable('arcade-mapping-unavailable'));
    if (plan.format !== 'ki-arcade-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('arcade-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}
