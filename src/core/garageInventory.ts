import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface GarageInventoryHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
}
export interface GarageInventoryPatchPlan extends PreparedPatchPlan {
    format: 'ki-garage-inventory-ast-v1';
    status: GarageInventoryHookStatus;
    schema: InventorySchema;
    schemaToken: string;
}
export type InventorySchema = Record<string, string>;
const SCHEMA_TOKEN = '/*ki-inventory-schema:v1*/null';
const MARKER = '/*ki-garage-inventory-ast:v1:';
const unavailable = (issue: string): GarageInventoryHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

export async function selectGarageInventoryPlan(code: string, plans: readonly GarageInventoryPatchPlan[]): Promise<GarageInventoryPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-garage-inventory-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-garage-inventory-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        if (plan.schemaToken !== SCHEMA_TOKEN) continue;
        const schema: InventorySchema = {};
        let valid = true;
        for (const key of Object.keys(plan.schema)) {
            const value = adapted.roles.get(key);
            if (!value || !/^[$A-Z_a-z][$\w]*$/.test(value)) { valid = false; break; }
            schema[key] = value;
        }
        if (!valid || !['id', 'name', 'owned', 'visible', 'secret', 'valuesMethod', 'iteratorMethod', 'hasNextMethod', 'nextMethod'].every(key => schema[key])) continue;
        if (adapted.edits.reduce((count, edit) => count + edit.text.split(SCHEMA_TOKEN).length - 1, 0) !== 1) continue;
        const status: GarageInventoryHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits.map(edit => ({ ...edit, text: edit.text.replace(SCHEMA_TOKEN, JSON.stringify(schema)) }));
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', schema, status, edits };
    } catch { }
    return undefined;
}

export function patchGarageInventoryDiagnostics(code: string, report?: (status: GarageInventoryHookStatus) => void, plan?: GarageInventoryPatchPlan): string {
    const done = (result: string, status: GarageInventoryHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('garage-inventory-mapping-unavailable'));
    if (plan.format !== 'ki-garage-inventory-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('garage-inventory-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}

export function installGarageInventoryDiagnostics(target: Window): void {
    let inventory: unknown = null;
    let schema: InventorySchema = {};
    const bridge = target as Window & {
        __kaspGarageInventoryCapture?: (value: typeof inventory, fields: InventorySchema) => void;
        __kaspGarageInventoryDebug?: () => object;
    };
    const call = (object: unknown, name: string): unknown => {
        if (!object || typeof object !== 'object' || !name) throw new Error('Native inventory collection is unavailable.');
        const method = (object as Record<string, unknown>)[name];
        if (typeof method !== 'function') throw new Error('Native inventory collection method is unavailable: ' + name);
        return method.call(object);
    };
    bridge.__kaspGarageInventoryCapture = (value, fields) => { inventory = value; schema = fields; };
    bridge.__kaspGarageInventoryDebug = () => {
        if (!inventory) return { captured: false, reason: 'Native garage inventory has not been captured.' };
        const items: Record<string, unknown>[] = [];
        try {
            const rendered = new Set(Array.from(target.document.querySelectorAll('[garage_item_id]'))
                .map(element => element.getAttribute('garage_item_id')));
            const iterator = call(call(inventory, schema.valuesMethod), schema.iteratorMethod);
            while (call(iterator, schema.hasNextMethod)) {
                if (items.length >= 20000) throw new Error('Inventory exceeds diagnostic limit.');
                const source = call(iterator, schema.nextMethod) as Record<string, unknown>;
                const row: Record<string, unknown> = {};
                for (const label of ['id', 'name', 'category', 'viewCategory', 'description', 'owned', 'buyable', 'visible', 'secret']) {
                    const value = source[schema[label]];
                    row[label] = value == null ? null : typeof value === 'object' ? String(value) : value;
                }
                const preview = source[schema.preview] as Record<string, unknown> | null;
                const getter = preview?.[schema.imageMethod];
                row.preview = typeof getter === 'function' ? getter.call(preview) : null;
                row.renderedInDOM = rendered.has(String(row.id));
                items.push(row);
            }
            return { captured: true, total: items.length,
                hidden: items.filter(item => item.visible === false).length,
                secret: items.filter(item => item.secret === true).length,
                unowned: items.filter(item => item.owned === false).length,
                note: 'renderedInDOM describes mounted cards only; scrolling and category selection can change it.', items };
        } catch (error) {
            return { captured: true, error: String(error), partial: true, items };
        }
    };
}
