/// <reference lib="es2021.weakref" />
import { featureScope } from './featureRuntime';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';
import { ACCOUNT_IDENTITY_MESSAGE } from './accountId';
import { readPageMessage } from './pageMessages';
import { getAccountIdentity, parseAccountIdentity } from './accountIdentity';

function hiddenLabel(): string {
    let language = '';
    try { language = (localStorage.getItem('language_store_key') || '').toLowerCase(); } catch { }
    if (language.startsWith('ru')) return 'Скрыто';
    if (language.startsWith('en')) return 'Hidden';
    const html = (document.documentElement.lang || '').toLowerCase();
    if (html.includes('ru')) return 'Скрыто';
    if (html.includes('en')) return 'Hidden';
    return window.location.hostname.includes('ru.') ? 'Скрыто' : 'Hidden';
}

export interface KillFeedPrivacyPlan extends PreparedPatchPlan {
    format: 'ki-kill-feed-privacy-v1'; status: { ready: boolean; issues: string[] };
}
export async function selectKillFeedPrivacyPlan(code: string, plans: readonly KillFeedPrivacyPlan[]): Promise<KillFeedPrivacyPlan | undefined> {
    const supported = plans.filter(plan => plan.format === 'ki-kill-feed-privacy-v1' && plan.status.ready);
    if (supported.some(plan => plan.sourceLength === code.length)) {
        const hash = await clientSourceHash(code);
        const exact = supported.find(plan => plan.sha256 === hash && plan.sourceLength === code.length);
        if (exact && validatePatchEdits(code, exact)) return exact;
    }
    for (const plan of [...supported].reverse()) {
        const adapted = resolveTemplateEdits(code, plan);
        if (adapted) return { ...plan, sourceLength: code.length, edits: adapted.edits };
    }
}
export const killFeedPrivacyPlanValid = (code: string, plan: KillFeedPrivacyPlan) =>
    plan.format === 'ki-kill-feed-privacy-v1' && plan.status.ready && validatePatchEdits(code, plan);

/** Masks only the local nickname at the action log's text measurement and glyph inputs. */
export function installKillFeedPrivacy(page: Window) {
    const scope = featureScope('killFeedPrivacy');
    type Renderer = Record<string, unknown>;
    const renderers = new Set<{ ref: WeakRef<Renderer>; dirty: string }>();
    let versions = new WeakMap<Renderer, number>();
    let enabled = false, own: string | null = null, nativeOwn: string | null = null, label = 'Hidden', revision = 0;
    const refreshAll = () => {
        for (const record of renderers) {
            const renderer = record.ref.deref();
            if (!renderer) { renderers.delete(record); continue; }
            renderer[record.dirty] = true;
        }
    };
    const sync = () => {
        let nextEnabled = false;
        try { nextEnabled = localStorage.getItem('k_hideNicknameXP') === 'true'; } catch { }
        const nextOwn = getAccountIdentity()?.nickname || nativeOwn;
        const nextLabel = hiddenLabel();
        if (enabled === nextEnabled && own === nextOwn && label === nextLabel) return;
        enabled = nextEnabled; own = nextOwn; label = nextLabel; revision++; refreshAll();
    };
    scope.listen(page, 'kasp:settings-changed', sync);
    scope.listen(page, 'storage', sync);
    scope.listen(page, 'message', event => {
        const message = readPageMessage(event, page, ACCOUNT_IDENTITY_MESSAGE);
        if (!message) return;
        nativeOwn = message.snapshot.account?.nickname || null; sync();
    });
    // The settings UI runs in an isolated world; its custom events can be invisible here.
    scope.interval(sync, 250);
    scope.onCleanup(() => {
        enabled = false; own = nativeOwn = null; revision++; refreshAll(); renderers.clear(); versions = new WeakMap();
    });
    sync();
    const bridge = {
        text<T>(value: T, glyphs?: Record<number, unknown>): T | string {
            if (!enabled || scope.disabled || !own || typeof value !== 'string') return value;
            if (parseAccountIdentity(value)?.nickname !== own) return value;
            // The HUD bitmap font can lack Cyrillic even when the game language is Russian.
            // Width measurement and geometry must receive the same supported replacement.
            const supported = (text: string) => {
                if (!glyphs) return false;
                for (let i = 0; i < text.length; i++) {
                    if (glyphs[text.charCodeAt(i)] == null) return false;
                }
                return true;
            };
            if (supported(label)) return label;
            if (label !== 'Hidden' && supported('Hidden')) return 'Hidden';
            // Keep the identity private if this font supports neither label. Rank/event icons remain.
            return '';
        },
        refresh(renderer: Renderer, dirty: string) {
            if (scope.disabled || versions.get(renderer) === revision) return;
            scope.run(() => {
                if (!versions.has(renderer)) {
                    for (const record of renderers) if (!record.ref.deref()) renderers.delete(record);
                    if (renderers.size >= 32) { scope.dispose('renderer-limit'); return; }
                    renderers.add({ ref: new WeakRef(renderer), dirty });
                }
                versions.set(renderer, revision); renderer[dirty] = true;
            });
        },
        status: () => ({ enabled, revision, renderers: renderers.size, runtime: scope.status() })
    };
    page.__kaspKillFeedPrivacy = bridge;
    return bridge;
}
