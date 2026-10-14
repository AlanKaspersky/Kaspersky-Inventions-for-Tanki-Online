import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface BattleStatisticsHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
    constructorHooks?: number;
}
export interface BattleStatisticsPatchPlan extends PreparedPatchPlan {
    format: 'ki-battle-statistics-ast-v1';
    status: BattleStatisticsHookStatus;
    schema: BattleStatisticsSchema;
    schemaToken: string;
}
export type BattleStatisticsSchema = Record<string, string>;
const SCHEMA_TOKEN = '/*ki-battle-statistics-schema:v1*/null';
const MARKER = '/*ki-battle-statistics-ast:v1:';
const unavailable = (issue: string): BattleStatisticsHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

export async function selectBattleStatisticsPlan(code: string, plans: readonly BattleStatisticsPatchPlan[]): Promise<BattleStatisticsPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-battle-statistics-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-battle-statistics-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        if (plan.schemaToken !== SCHEMA_TOKEN) continue;
        const schema: BattleStatisticsSchema = {};
        let valid = true;
        for (const key of Object.keys(plan.schema)) {
            const value = adapted.roles.get(key);
            if (!value || !/^[$A-Z_a-z][$\w]*$/.test(value)) { valid = false; break; }
            schema[key] = value;
        }
        if (!valid || !['battleId', 'mapName', 'mode', 'isMMBattle', 'battleLoaded'].every(key => schema[key])) continue;
        if (adapted.edits.reduce((count, edit) => count + edit.text.split(SCHEMA_TOKEN).length - 1, 0) !== 1) continue;
        const status: BattleStatisticsHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits.map(edit => ({ ...edit, text: edit.text.replace(SCHEMA_TOKEN, JSON.stringify(schema)) }));
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', schema, status, edits };
    } catch { }
    return undefined;
}

export function patchBattleStatistics(code: string, report?: (status: BattleStatisticsHookStatus) => void, plan?: BattleStatisticsPatchPlan): string {
    const done = (result: string, status: BattleStatisticsHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('battle-statistics-mapping-unavailable'));
    if (plan.format !== 'ki-battle-statistics-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('battle-statistics-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}

export interface BattleStatisticsDetail {
    mode?: string;
    kind?: 'MM' | 'PRO';
}
const KNOWN_MODES = new Set(['DM', 'TDM', 'CTF', 'CP', 'SGE', 'RGB', 'JGR', 'TJR', 'ASL', 'AR']);

export function readBattleStatistics(value: unknown, schema: BattleStatisticsSchema): BattleStatisticsDetail | null {
    if (!value || typeof value !== 'object' || !schema || typeof schema !== 'object') return null;
    const field = (label: string): unknown => typeof schema[label] === 'string' ? Object.getOwnPropertyDescriptor(value, schema[label])?.value : undefined;
    if (field('battleLoaded') !== true) return null;
    const result: BattleStatisticsDetail = {};
    const matchmaking = field('isMMBattle');
    if (typeof matchmaking === 'boolean') result.kind = matchmaking ? 'MM' : 'PRO';
    const nativeMode = field('mode');
    let mode = '';
    try { if (nativeMode != null) mode = String(nativeMode).trim().toUpperCase(); } catch { }
    if (KNOWN_MODES.has(mode)) result.mode = mode;
    else {
        const map = field('mapName');
        const suffix = typeof map === 'string' ? /\s+([A-Z]{2,3})$/.exec(map.trim().toUpperCase())?.[1] : undefined;
        if (suffix && KNOWN_MODES.has(suffix)) result.mode = suffix;
    }
    return result.mode || result.kind ? result : null;
}

export function installBattleStatistics(target: Window): void {
    const bridge = target as Window & { __kaspBattleStats?: (value: unknown, schema: BattleStatisticsSchema) => void };
    bridge.__kaspBattleStats = (value, schema) => {
        try {
            const detail = readBattleStatistics(value, schema);
            if (detail?.mode) target.postMessage({ type: 'kasp:battle-mode', detail: detail.mode }, '*');
            if (detail?.kind) target.postMessage({ type: 'kasp:battle-kind', detail: detail.kind }, '*');
        } catch { }
    };
}

