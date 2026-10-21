/// <reference lib="es2021.weakref" />
import { featureScope } from './featureRuntime';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

export interface SupplyPrivacyPlan extends PreparedPatchPlan {
    format: 'ki-supply-privacy-v1';
    status: { ready: boolean; issues: string[]; renderers: number };
}

export async function selectSupplyPrivacyPlan(code: string, plans: readonly SupplyPrivacyPlan[]): Promise<SupplyPrivacyPlan | undefined> {
    const candidates = plans.filter(plan => plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    }
    for (const plan of [...plans].reverse()) {
        if (plan.format !== 'ki-supply-privacy-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (adapted) return { ...plan, sourceLength: code.length, edits: adapted.edits };
    }
    return undefined;
}

export const supplyPrivacyPlanValid = (code: string, plan: SupplyPrivacyPlan): boolean =>
    plan.format === 'ki-supply-privacy-v1' && plan.status.ready && validatePatchEdits(code, plan);

/** Only owns text labels. Stock, availability and activation remain native. */
export function installSupplyPrivacy(page: Window) {
    const scope = featureScope('supplyPrivacy');
    type Label = Record<string, unknown>;
    const labels = new Set<{ label: WeakRef<Label>; method: string; text: string }>();
    let byLabel = new WeakMap<Label, { label: WeakRef<Label>; method: string; text: string }>();
    let enabled = false;
    const write = (label: Label, method: string, text: string) => {
        const setter = label[method];
        if (typeof setter === 'function') setter.call(label, text);
    };
    const refresh = () => {
        for (const record of labels) {
            const label = record.label.deref();
            if (!label) { labels.delete(record); continue; }
            try { write(label, record.method, enabled ? '0' : record.text); }
            catch (error) { labels.delete(record); byLabel.delete(label); scope.fail(error); }
        }
    };
    const sync = () => {
        let next = false;
        try { next = localStorage.getItem('k_hideSupplies') === 'true'; } catch { }
        if (next === enabled) return;
        enabled = next; refresh();
    };
    scope.listen(page, 'kasp:settings-changed', sync);
    scope.listen(page, 'storage', sync);
    // Content-script events do not propagate consistently into the page world.
    scope.interval(sync, 250);
    scope.onCleanup(() => { enabled = false; refresh(); labels.clear(); byLabel = new WeakMap(); });
    sync();
    const bridge = {
        text(label: Label, method: string, text: string): string {
            return scope.run(() => {
                let record = byLabel.get(label);
                if (!record) {
                    for (const item of labels) if (!item.label.deref()) labels.delete(item);
                    if (labels.size >= 128) { scope.dispose('label-limit'); return text; }
                    record = { label: new WeakRef(label), method, text };
                    labels.add(record); byLabel.set(label, record);
                } else { record.text = text; record.method = method; }
                return enabled ? '0' : text;
            }) ?? text;
        },
    };
    page.__kaspSupplyPrivacy = bridge;
    return bridge;
}
