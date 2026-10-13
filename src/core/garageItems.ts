import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface GarageItemsHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
    imagePanels?: number;
    labelPanels?: number;
}
export interface GarageItemsPatchPlan extends PreparedPatchPlan {
    format: 'ki-garage-items-ast-v1';
    status: GarageItemsHookStatus;
}
const MARKER = '/*ki-garage-items-ast:v1:';
const unavailable = (issue: string): GarageItemsHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

/** Native panels are discovered offline. Compatible unknown builds use prepared templates. */
export async function selectGarageItemsPlan(code: string, plans: readonly GarageItemsPatchPlan[]): Promise<GarageItemsPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-garage-items-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-garage-items-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        const status: GarageItemsHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', status, edits };
    } catch { }
    return undefined;
}

/** Validate the complete native contract before modifying any image or label branch. */
export function patchUnavailableGarageItems(code: string, report?: (status: GarageItemsHookStatus) => void, plan?: GarageItemsPatchPlan): string {
    const done = (result: string, status: GarageItemsHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('garage-items-mapping-unavailable'));
    if (plan.format !== 'ki-garage-items-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('garage-items-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}
