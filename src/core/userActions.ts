import { featureScope } from './featureRuntime';
import { postPageMessage } from './pageMessages';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface UserActionHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
    constructorHooks?: number;
}
export interface UserActionPatchPlan extends PreparedPatchPlan {
    format: 'ki-user-action-ast-v1';
    status: UserActionHookStatus;
    schema: UserActionSchema;
    schemaToken: string;
}
export type UserActionSchema = Record<string, string>;
const SCHEMA_TOKEN = '/*ki-user-action-schema:v1*/null';
const MARKER = '/*ki-user-action-ast:v1:';
const unavailable = (issue: string): UserActionHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

export async function selectUserActionPlan(code: string, plans: readonly UserActionPatchPlan[]): Promise<UserActionPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-user-action-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-user-action-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        if (plan.schemaToken !== SCHEMA_TOKEN) continue;
        const schema: UserActionSchema = {};
        let valid = true;
        for (const key of Object.keys(plan.schema)) {
            const value = adapted.roles.get(key);
            if (!value || !/^[$A-Z_a-z][$\w]*$/.test(value)) { valid = false; break; }
            schema[key] = value;
        }
        if (!valid || !['userLabelData', 'type', 'uid'].every(key => schema[key])) continue;
        if (adapted.edits.reduce((count, edit) => count + edit.text.split(SCHEMA_TOKEN).length - 1, 0) !== 1) continue;
        const status: UserActionHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits.map(edit => ({ ...edit, text: edit.text.replace(SCHEMA_TOKEN, JSON.stringify(schema)) }));
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', schema, status, edits };
    } catch { }
    return undefined;
}

export function patchUserActions(code: string, report?: (status: UserActionHookStatus) => void, plan?: UserActionPatchPlan): string {
    const done = (result: string, status: UserActionHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('user-action-mapping-unavailable'));
    if (plan.format !== 'ki-user-action-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('user-action-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}

export function readUserAction(value: unknown, schema: UserActionSchema): string[] | null {
    if (!value || typeof value !== 'object' || !schema || typeof schema !== 'object') return null;
    const field = (object: object, label: string): unknown => typeof schema[label] === 'string' ? Object.getOwnPropertyDescriptor(object, schema[label])?.value : undefined;
    const player = field(value, 'userLabelData');
    if (!player || typeof player !== 'object') return null;
    const uid = field(player, 'uid');
    if (typeof uid !== 'string' || uid.trim().length < 2 || uid.trim().length >= 30) return null;
    let type = '';
    try { type = String(field(value, 'type') ?? '').trim(); } catch { }
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(type)) return null;
    const detail = ['TankUserActionLog', uid.trim(), type];
    try {
        const relation = field(player, 'teamRelation');
        if (relation != null) {
            const text = String(relation).trim();
            if (/^[A-Z][A-Z0-9_]{1,63}$/.test(text)) detail.push(text);
        }
    } catch { }
    return detail;
}

export function installUserActions(target: Window): void {
    target.__kaspSendAction = (className, value, schema) => {
        if (className !== 'TankUserActionLog') return;
        try {
            const detail = readUserAction(value, schema);
            if (detail) postPageMessage(target, { type: 'kasp:useraction', detail });
        } catch (error) { featureScope('userActions').fail(error); }
    };
}

