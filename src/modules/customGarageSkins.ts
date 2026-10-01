interface SkinsDatabase {
    names: Record<string, string>;
    defaults: Record<string, string>;
}
// Isolated-world content script. Ported from modules.customGarageSkins in
// src/kasp_main.ts:2954-3168, but the equipped skin is no longer detected from previews and
// looked up in a database: its art URL is learned from the game's own Skins tab.
export const customGarageSkins = (() => {
    type SavedSkins = Record<string, string>;
    type DefaultImagesMap = Record<string, string[]>;

    const STORAGE_KEY = 'kasp_equipped_skins';
    const BASE_IMG_KEY = 'kasp_base_images';
    let NAME_TRANSLATE: SkinsDatabase['names'] | null = null;
    let PREFILLED_DEFAULTS: SkinsDatabase['defaults'] | null = null;
    let dataReadyPromise: Promise<void> | null = null;

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
        try {
            return JSON.parse(raw) as T;
        } catch (e) {
            return null;
        }
    }

    function getSavedSkins(): SavedSkins {
        return safeParseJSON<SavedSkins>(localStorage.getItem(STORAGE_KEY)) || {};
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
                    val.forEach(v => { if (v && !merged[key].includes(v)) merged[key].push(v); });
                } else if (val) {
                    if (!merged[key].includes(val)) merged[key].push(val);
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
        const savedSkins = getSavedSkins();
        const defaultImages = getDefaultImages();
        let css = '';

        for (const item of Object.keys(defaultImages)) {
            const targetUrl = savedSkins[item];
            if (!targetUrl) continue;

            const finalUrls = defaultImages[item].filter(url => url !== targetUrl);

            if (finalUrls.length > 0) {
                const selectors = finalUrls.map(url =>
                    `.GarageItemComponentStyle-mainImg[src="${url}"], .garage-item img[src="${url}"], .MountedItemsStyle-itemPreview[src="${url}"]`
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
    }

    // Neither garage screen renders the equipped skin itself: the tiles and the
    // mounted previews both carry the item's stock art and the skin is painted
    // over it by CSS. So an element cannot tell on its own that an unknown skin
    // is on. What it can read is what learning stored: the stock URL is stored only
    // when the equipped skin's art could not be read, a learned skin stores its own
    // art URL, and Standard stores nothing at all.
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

    // The main screen's blocks only show the category ("Turrets"), never the item
    // name, so the item is found by matching the preview's stock image instead.
    function markMountedUnknownSkins(
        savedSkins: SavedSkins,
        defaultImages: DefaultImagesMap,
        prefilledDefaults: SkinsDatabase['defaults']
    ): void {
        const blocks = document.querySelectorAll('.MountedItemsStyle-commonBlockForTurretsHulls');
        blocks.forEach((block) => {
            const src = block.querySelector('.MountedItemsStyle-itemPreview')?.getAttribute('src') || '';
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
            readonly artUrl: string | null;
        };

    interface SkinCard {
        readonly title: string;
        readonly isStandard: boolean;
        readonly isEquipped: boolean;
    }

    function readSkinCards(row: Element): SkinCard[] {
        const cards: SkinCard[] = [];
        row.querySelectorAll('.SkinCellStyle-nameDevices').forEach((titleEl) => {
            const card = titleEl.parentElement;
            if (!card) return;
            const icon = card.querySelector('.SkinCellStyle-iconCell');
            cards.push({
                title: (titleEl.textContent ?? '').trim(),
                isStandard: (icon?.getAttribute('src') ?? '').includes('ic_standard'),
                isEquipped: !!card.querySelector('.SkinCellStyle-mountIcon'),
            });
        });
        return cards;
    }

    // The panel prints the selected skin's title, but the same text also sits in
    // the cards row, so that row is skipped or the first card would always win.
    function readSelectedTitle(menu: Element, row: Element, cardTitles: ReadonlySet<string>): string | null {
        for (const el of menu.querySelectorAll('*')) {
            if (el.children.length > 0 || row.contains(el)) continue;
            const text = (el.textContent ?? '').trim();
            if (cardTitles.has(text.toLowerCase())) return text;
        }
        return null;
    }

    // The art is a CSS background on a div, not an img, so it only shows in computed style.
    function readPreviewArt(menu: Element, row: Element): string | null {
        for (const el of menu.querySelectorAll('[class*="backgroundImageContain"]')) {
            if (row.contains(el)) continue;
            const match = /url\("?([^")]+\.webp)"?\)/.exec(getComputedStyle(el).backgroundImage);
            if (match) return match[1];
        }
        return null;
    }

    function readSkinsScreen(nameTranslate: SkinsDatabase['names']): SkinsScreenState {
        const row = document.querySelector('.SkinsAndAlterationsStyle-SkinsVerticalComponent');
        const menu = document.querySelector('.GarageCommonStyle-subMenu');
        if (!row || !menu) return { kind: 'absent' };

        const cards = readSkinCards(row);
        const equippedCard = cards.find(card => card.isEquipped);
        // Standard's title carries no item name, so any other card supplies it.
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
            selectedTitle: readSelectedTitle(menu, row, new Set(cards.map(card => card.title.toLowerCase()))),
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

    // Learned URLs end up inside a CSS url("..."), so anything but a plain game image URL is refused.
    const SAFE_ART_URL = /^https:\/\/[a-z0-9.-]+\.tankionline\.com\/[A-Za-z0-9/_.-]+\.webp$/;

    function decideLearnAction(state: SkinsScreenState, stockUrl: string | undefined): LearnAction {
        if (state.kind === 'absent') return { kind: 'none', reason: null };
        if (state.equipped.kind === 'standard') return { kind: 'clear', item: state.item };

        const selectedIsEquipped = state.selectedTitle !== null
            && state.selectedTitle.toLowerCase() === state.equipped.title.toLowerCase();
        if (!selectedIsEquipped) {
            return {
                kind: 'none',
                reason: `waiting, selected ${JSON.stringify(state.selectedTitle)} is not the equipped ${JSON.stringify(state.equipped.title)}`,
            };
        }

        if (state.artUrl && SAFE_ART_URL.test(state.artUrl)) {
            return { kind: 'set', item: state.item, url: state.artUrl, source: 'art' };
        }
        // Art that cannot be read stores the stock image, which is what raises the "unknown skin" label.
        return stockUrl
            ? { kind: 'set', item: state.item, url: stockUrl, source: 'stock' }
            : { kind: 'none', reason: `art of ${JSON.stringify(state.equipped.title)} is unreadable and no stock image is known` };
    }

    let lastLearnNote: string | null = null;

    // A run that saves nothing has to say why, since the storage value alone cannot tell the causes apart.
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
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
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

        // One tick can catch the marker and the preview out of step mid-render, so a change must hold for two.
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
            '.GarageCommonStyle-positionContent, .GarageItemComponent-container, .ContainerInfoComponentStyle-lootBoxContainer, .GarageMainScreenStyle-blockParameters, .SkinsAndAlterationsStyle-SkinsVerticalComponent'
        );
    }

    function tick(): void {
        if (!NAME_TRANSLATE || !PREFILLED_DEFAULTS) return; // data still loading
        if (!isGarageScreen()) return;

        const nameTranslate = NAME_TRANSLATE;
        const prefilledDefaults = PREFILLED_DEFAULTS;

        const skinsScreen = readSkinsScreen(nameTranslate);
        logSkinsScreen(skinsScreen);
        learnFromSkinsScreen(skinsScreen, prefilledDefaults);

        const defaultImages = getDefaultImages();
        let defaultsUpdated = false;
        const savedSkinsForList = getSavedSkins();

        const garageItems = document.querySelectorAll('.garage-item');
        garageItems.forEach((item) => {
            const titleSpan = item.querySelector('.GarageItemComponentStyle-descriptionDevice span');
            const imgMain = item.querySelector('.GarageItemComponentStyle-mainImg');

            if (titleSpan && imgMain) {
                const rawTitle = (titleSpan.textContent ?? '').trim().toLowerCase();
                const itemNameEN = nameTranslate[rawTitle.split(/\s+/)[0]] || rawTitle.split(/\s+/)[0];
                const originalSrc = imgMain.getAttribute('src') || '';

                // A tile already showing the saved skin's URL is not stock art, so it must not be learned as stock.
                if (originalSrc && originalSrc.includes('tankionline.com') && originalSrc !== savedSkinsForList[itemNameEN]) {
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

    return tick;
})();