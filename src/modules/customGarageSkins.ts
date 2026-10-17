import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customGarageSkins');
import { gameDOM } from '../core/gameDOM';
import { getVerifiedAccount } from '../core/accountIdentity';
import { GARAGE_SKIN_CARDS_REQUEST } from '../core/gameAugments';
import { getTankiImageUrl } from '../core/imageUrl';
interface SkinsDatabase {
    names: Record<string, string>;
    defaults: Record<string, string>;
}

export const customGarageSkins = lifecycle.initialize(() => {
    type SavedSkins = Record<string, string>;
    type DefaultImagesMap = Record<string, string[]>;

    const STORAGE_PREFIX = 'kasp_equipped_skins_uid_';
    const BASE_IMG_KEY = 'kasp_base_images';
    let ownerId: string | null = null;
    let NAME_TRANSLATE: SkinsDatabase['names'] | null = null;
    let PREFILLED_DEFAULTS: SkinsDatabase['defaults'] | null = null;
    let dataReadyPromise: Promise<void> | null = null;
    const parsedStorage = new Map<string, unknown>();
    let cssInputs: { owner: string | null; skins: string | null; bases: string | null } | null = null;

    function loadSkinsData(): Promise<void> {
        if (dataReadyPromise) return dataReadyPromise;
        dataReadyPromise = fetch(chrome.runtime.getURL('database/skins.json'))
            .then(res => {
                if (!res.ok) throw new Error('skins.json: HTTP ' + res.status);
                return res.json();
            })
            .then((data: SkinsDatabase) => {
                NAME_TRANSLATE = data.names;
                PREFILLED_DEFAULTS = data.defaults;
                console.log('[KI-test][garage-skins] database loaded');
            })
            .catch(e => console.error('[KI-test][garage-skins] failed to load database/skins.json:', e));
        return dataReadyPromise;
    }
    loadSkinsData();

    function safeParseJSON<T>(raw: string | null): T | null {
        if (!raw) return null;
        if (parsedStorage.has(raw)) return parsedStorage.get(raw) as T;
        try {
            const value: unknown = JSON.parse(raw);
            if (parsedStorage.size >= 3) parsedStorage.clear();
            parsedStorage.set(raw, value);
            return value as T;
        } catch (e) {
            return null;
        }
    }

    function getSavedSkins(): SavedSkins {
        if (!ownerId) return {};
        const stored = safeParseJSON<unknown>(localStorage.getItem(STORAGE_PREFIX + ownerId));
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
        return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] =>
            typeof entry[1] === 'string' && SAFE_ART_URL.test(entry[1])));
    }

    function getDefaultImages(): DefaultImagesMap {
        try {
            const stored = safeParseJSON<Record<string, string | string[]>>(localStorage.getItem(BASE_IMG_KEY)) || {};
            const merged: DefaultImagesMap = {};

            for (const key in PREFILLED_DEFAULTS) {
                merged[key] = [PREFILLED_DEFAULTS[key]];
            }

            for (const key in stored) {
                if (!merged[key]) merged[key] = [];
                const val = stored[key];
                if (Array.isArray(val)) {
                    val.forEach(v => { const url = getTankiImageUrl(v); if (url && !merged[key].includes(url)) merged[key].push(url); });
                } else if (val) {
                    const url = getTankiImageUrl(val);
                    if (url && !merged[key].includes(url)) merged[key].push(url);
                }
            }
            return merged;
        } catch (e) {
            const fallback: DefaultImagesMap = {};
            for (const key in PREFILLED_DEFAULTS) fallback[key] = [PREFILLED_DEFAULTS[key]];
            return fallback;
        }
    }

    function updateGlobalCSS(): void {
        const inputs = { owner: ownerId, skins: ownerId ? localStorage.getItem(STORAGE_PREFIX + ownerId) : null,
            bases: localStorage.getItem(BASE_IMG_KEY) };
        if (cssInputs && cssInputs.owner === inputs.owner && cssInputs.skins === inputs.skins && cssInputs.bases === inputs.bases
            && document.getElementById('kasp-skins-global-css')) return;
        const savedSkins = getSavedSkins();
        const defaultImages = getDefaultImages();
        let css = '';

        for (const item of Object.keys(defaultImages)) {
            const targetUrl = savedSkins[item];
            if (!targetUrl) continue;

            const finalUrls = defaultImages[item].filter(url => url !== targetUrl);

            if (finalUrls.length > 0) {
                const selectors = finalUrls.map(url =>
                    gameDOM.garage.skinArt.map(selector => `${selector}[src="${url}"]`).join(', ')
                ).join(',\n');
                css += `${selectors} {\n    content: url("${targetUrl}") !important;\n    object-fit: contain !important;\n    pointer-events: none !important;\n}\n\n`;
            }
        }

        let styleEl = document.getElementById('kasp-skins-global-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'kasp-skins-global-css';
            document.head.appendChild(styleEl);
        }
        if (styleEl.textContent !== css) {
            styleEl.textContent = css;
        }
        cssInputs = inputs;
    }

    function hasUnknownSkin(
        itemNameEN: string,
        savedSkins: SavedSkins,
        prefilledDefaults: SkinsDatabase['defaults']
    ): boolean {
        const saved = savedSkins[itemNameEN];
        return !!saved && saved === prefilledDefaults[itemNameEN];
    }

    function toggleUnknownLabel(host: Element, show: boolean): void {
        const existing = host.querySelector('.kasp-unknown-skin');

        if (!show) {
            if (existing) existing.remove();
            return;
        }

        if (!existing) {
            const label = document.createElement('span');
            label.className = 'kasp-unknown-skin';
            label.textContent = 'unknown skin';
            host.appendChild(label);
        }
    }

    function markMountedUnknownSkins(
        savedSkins: SavedSkins,
        defaultImages: DefaultImagesMap,
        prefilledDefaults: SkinsDatabase['defaults']
    ): void {
        const blocks = document.querySelectorAll(gameDOM.garage.mountedEquipment);
        blocks.forEach((block) => {
            const src = block.querySelector(gameDOM.garage.mountedPreview)?.getAttribute('src') || '';
            const owner = Object.keys(savedSkins).find(item => defaultImages[item]?.includes(src));
            toggleUnknownLabel(block, !!owner && hasUnknownSkin(owner, savedSkins, prefilledDefaults));
        });
    }

    type EquippedCard =
        | { readonly kind: 'standard' }
        | { readonly kind: 'skin'; readonly title: string };

    type SkinsScreenState =
        | { readonly kind: 'absent' }
        | {
            readonly kind: 'ready';
            readonly item: string;
            readonly equipped: EquippedCard;
            readonly selectedTitle: string | null;
            readonly selectionIsEquipped: boolean;
            readonly artUrl: string | null;
        };

    interface SkinCard {
        readonly id: string;
        readonly title: string;
        readonly isStandard: boolean;
        readonly isEquipped: boolean;
        readonly isSelected: boolean;
        readonly isOwned: boolean;
        readonly isUnknown: boolean;
    }

    function readSkinCards(row: Element): SkinCard[] {
        const cards: SkinCard[] = [];
        if (window.dispatchEvent(new Event(GARAGE_SKIN_CARDS_REQUEST, { cancelable: true }))) return cards;
        row.querySelectorAll(gameDOM.skins.cardIcon).forEach((icon) => {
            const native = safeParseJSON<ReturnType<typeof import('../core/gameAugments').readGarageCosmeticCard>>(icon.getAttribute('data-kasp-skin-card'));
            if (!native || typeof native.id !== 'string' || !/^\d{1,20}$/.test(native.id)
                || typeof native.name !== 'string' || typeof native.isMounted !== 'boolean'
                || typeof native.isSelected !== 'boolean' || typeof native.isOwned !== 'boolean'
                || typeof native.isUnknown !== 'boolean' || typeof native.isStandard !== 'boolean') return;
            cards.push({
                id: native.id,
                title: native.name.trim(),
                isStandard: native.isStandard || (icon.getAttribute('src') ?? '').includes('ic_standard'),
                isEquipped: native.isMounted,
                isSelected: native.isSelected,
                isOwned: native.isOwned,
                isUnknown: native.isUnknown,
            });
        });
        return cards;
    }

    function readPreviewArt(menu: Element, row: Element): string | null {
        for (const el of menu.querySelectorAll(gameDOM.common.background)) {
            if (row.contains(el)) continue;
            const match = /url\("?([^")]+\.webp)"?\)/.exec(getComputedStyle(el).backgroundImage);
            if (match) return match[1];
        }
        return null;
    }

    function readSkinsScreen(nameTranslate: SkinsDatabase['names']): SkinsScreenState {
        const row = document.querySelector(gameDOM.skins.cards);
        const menu = document.querySelector(gameDOM.garage.submenu);
        if (!row || !menu) return { kind: 'absent' };

        const cards = readSkinCards(row);
        const mounted = cards.filter(card => card.isEquipped);
        const selected = cards.filter(card => card.isSelected);
        const equippedCard = mounted.length === 1 ? mounted[0] : undefined;
        const selectedCard = selected.length === 1 ? selected[0] : undefined;
        const namedCard = equippedCard && !equippedCard.isStandard
            ? equippedCard
            : cards.find(card => !card.isStandard);
        if (!equippedCard || !namedCard) return { kind: 'absent' };

        const words = namedCard.title.toLowerCase().split(/\s+/);
        const matchedWord = words.find(w => nameTranslate[w]);
        if (!matchedWord) return { kind: 'absent' };

        return {
            kind: 'ready',
            item: nameTranslate[matchedWord],
            equipped: equippedCard.isStandard
                ? { kind: 'standard' }
                : { kind: 'skin', title: equippedCard.title },
            selectedTitle: selectedCard?.title ?? null,
            selectionIsEquipped: !!selectedCard && selectedCard.id === equippedCard.id
                && !selectedCard.isUnknown && (selectedCard.isOwned || selectedCard.isStandard),
            artUrl: readPreviewArt(menu, row),
        };
    }

    function describeSkinsScreen(state: SkinsScreenState): string {
        if (state.kind === 'absent') return 'absent';
        const equipped = state.equipped.kind === 'standard' ? 'standard' : `skin "${state.equipped.title}"`;
        const art = state.artUrl?.split('/').slice(-2).join('/') ?? 'none';
        return `item=${state.item} equipped=${equipped} selected=${JSON.stringify(state.selectedTitle)} art=${art}`;
    }

    let lastSkinsSummary: string | null = null;

    function logSkinsScreen(state: SkinsScreenState): void {
        const summary = describeSkinsScreen(state);
        if (summary === lastSkinsSummary) return;
        const isFirstRead = lastSkinsSummary === null;
        lastSkinsSummary = summary;
        if (state.kind === 'absent' && isFirstRead) return;
        console.log(`[KI-test][garage-skins] skins tab: ${summary}`);
    }

    type LearnAction =
        | { readonly kind: 'none'; readonly reason: string | null }
        | { readonly kind: 'set'; readonly item: string; readonly url: string; readonly source: 'art' | 'stock' }
        | { readonly kind: 'clear'; readonly item: string };

    const SAFE_ART_URL = /^https:\/\/[a-z0-9.-]+\.tankionline\.com\/[A-Za-z0-9/_.-]+\.webp$/;

    function decideLearnAction(state: SkinsScreenState, stockUrl: string | undefined): LearnAction {
        if (state.kind === 'absent') return { kind: 'none', reason: null };
        if (state.equipped.kind === 'standard') return { kind: 'clear', item: state.item };

        const selectedIsEquipped = state.selectionIsEquipped;
        if (!selectedIsEquipped) {
            return {
                kind: 'none',
                reason: `waiting, selected ${JSON.stringify(state.selectedTitle)} is not the equipped ${JSON.stringify(state.equipped.title)}`,
            };
        }

        if (state.artUrl && SAFE_ART_URL.test(state.artUrl)) {
            return { kind: 'set', item: state.item, url: state.artUrl, source: 'art' };
        }
        return stockUrl
            ? { kind: 'set', item: state.item, url: stockUrl, source: 'stock' }
            : { kind: 'none', reason: `art of ${JSON.stringify(state.equipped.title)} is unreadable and no stock image is known` };
    }

    let lastLearnNote: string | null = null;

    function noteLearn(note: string | null): void {
        if (note === lastLearnNote) return;
        lastLearnNote = note;
        if (note) console.log(`[KI-test][garage-skins] learn: ${note}`);
    }

    function describeLearnAction(action: Exclude<LearnAction, { kind: 'none' }>): string {
        if (action.kind === 'clear') return `standard equipped, clearing ${action.item}`;
        const art = action.url.split('/').slice(-2).join('/');
        return action.source === 'art'
            ? `equipped skin art ${art} for ${action.item}`
            : `equipped skin art is unreadable, storing stock ${art} for ${action.item}`;
    }

    function writeSavedSkins(savedSkins: SavedSkins): void {
        if (!ownerId || getVerifiedAccount()?.userId !== ownerId) return;
        try {
            localStorage.setItem(STORAGE_PREFIX + ownerId, JSON.stringify(savedSkins));
        } catch (e: unknown) {
            console.warn('[KI-test][garage-skins] could not save skins:', e instanceof Error ? e.message : e);
        }
    }

    let pendingLearn: { readonly key: string; readonly ticks: number } | null = null;

    function learnFromSkinsScreen(state: SkinsScreenState, prefilledDefaults: SkinsDatabase['defaults']): void {
        const stockUrl = state.kind === 'ready' ? prefilledDefaults[state.item] : undefined;
        const action = decideLearnAction(state, stockUrl);
        if (action.kind === 'none') {
            pendingLearn = null;
            noteLearn(action.reason);
            return;
        }
        noteLearn(describeLearnAction(action));

        const key = action.kind === 'set' ? `set|${action.item}|${action.url}` : `clear|${action.item}`;
        pendingLearn = { key, ticks: pendingLearn?.key === key ? pendingLearn.ticks + 1 : 1 };
        if (pendingLearn.ticks < 2) return;

        const savedSkins = getSavedSkins();
        if (action.kind === 'set') {
            if (savedSkins[action.item] === action.url) return;
            savedSkins[action.item] = action.url;
            console.log(`[KI-test][garage-skins] saved ${action.item}: ${action.url.split('/').slice(-2).join('/')}`);
        } else {
            if (savedSkins[action.item] === undefined) return;
            delete savedSkins[action.item];
            console.log(`[KI-test][garage-skins] cleared ${action.item}`);
        }
        writeSavedSkins(savedSkins);
    }

    function isGarageScreen(): boolean {
        return !!document.querySelector(
            gameDOM.screens.garage
        );
    }

    function tick(): void {
        const nextOwnerId = getVerifiedAccount()?.userId ?? null;
        if (nextOwnerId !== ownerId) {
            ownerId = nextOwnerId;
            cssInputs = null;
            parsedStorage.clear();
            pendingLearn = null;
            lastSkinsSummary = null;
            lastLearnNote = null;
            const style = document.getElementById('kasp-skins-global-css');
            if (style) style.textContent = '';
            document.querySelectorAll('.kasp-unknown-skin').forEach(label => label.remove());
            if (NAME_TRANSLATE && PREFILLED_DEFAULTS) updateGlobalCSS();
        }
        if (!ownerId) return;
        if (!NAME_TRANSLATE || !PREFILLED_DEFAULTS) return;
        if (!isGarageScreen()) return;

        const nameTranslate = NAME_TRANSLATE;
        const prefilledDefaults = PREFILLED_DEFAULTS;

        const skinsScreen = readSkinsScreen(nameTranslate);
        logSkinsScreen(skinsScreen);
        learnFromSkinsScreen(skinsScreen, prefilledDefaults);

        const defaultImages = getDefaultImages();
        let defaultsUpdated = false;
        const savedSkinsForList = getSavedSkins();

        const garageItems = document.querySelectorAll(gameDOM.garage.item);
        garageItems.forEach((item) => {
            const titleSpan = item.querySelector(gameDOM.garage.itemDescription);
            const imgMain = item.querySelector(gameDOM.garage.itemImage);

            if (titleSpan && imgMain) {
                const rawTitle = (titleSpan.textContent ?? '').trim().toLowerCase();
                const itemNameEN = nameTranslate[rawTitle.split(/\s+/)[0]] || rawTitle.split(/\s+/)[0];
                const originalSrc = imgMain.getAttribute('src') || '';

                if (getTankiImageUrl(originalSrc) && originalSrc !== savedSkinsForList[itemNameEN]) {
                    if (!defaultImages[itemNameEN]) defaultImages[itemNameEN] = [];
                    if (!defaultImages[itemNameEN].includes(originalSrc)) {
                        defaultImages[itemNameEN].push(originalSrc);
                        defaultsUpdated = true;
                    }
                }

                toggleUnknownLabel(item, hasUnknownSkin(itemNameEN, savedSkinsForList, prefilledDefaults));
            }
        });

        markMountedUnknownSkins(savedSkinsForList, defaultImages, prefilledDefaults);

        if (defaultsUpdated) {
            localStorage.setItem(BASE_IMG_KEY, JSON.stringify(defaultImages));
        }

        updateGlobalCSS();
    }

    lifecycle.onCleanup(() => { pendingLearn = null; ownerId = null; parsedStorage.clear(); cssInputs = null; document.getElementById('kasp-skins-global-css')?.remove(); document.querySelectorAll('.kasp-unknown-skin').forEach(node => node.remove()); });

    return tick;
}, () => {});
