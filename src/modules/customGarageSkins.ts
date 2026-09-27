import { state } from '../core/state';
import { DataLoader } from '../core/dataLoader';

export const customGarageSkins = (() => {
    const STORAGE_KEY = 'kasp_equipped_skins';
    const BASE_IMG_KEY = 'kasp_base_images';
    let SKIN_BRANDS_MAP = null;
    let NAME_TRANSLATE = null;
    let PREFILLED_DEFAULTS = null;
    let SKINS_DATABASE = null;

    function getSavedSkins() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function getDefaultImages() {
        try {
            const stored = JSON.parse(localStorage.getItem(BASE_IMG_KEY)) || {};
            const merged = {};

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
            const fallback = {};
            for (const key in PREFILLED_DEFAULTS) fallback[key] = [PREFILLED_DEFAULTS[key]];
            return fallback;
        }
    }

    function updateGlobalCSS() {
        const savedSkins = getSavedSkins();
        const defaultImages = getDefaultImages();
        let css = '';

        const allItems = new Set([...Object.keys(defaultImages), ...Object.keys(SKINS_DATABASE)]);

        for (const item of allItems) {
            const targetUrl = savedSkins[item];
            if (!targetUrl) continue;

            const urlsToOverride = [];
            if (defaultImages[item]) {
                urlsToOverride.push(...defaultImages[item]);
            }

            if (SKINS_DATABASE[item]) {
                for (const skinUrl of Object.values(SKINS_DATABASE[item])) {
                    if (skinUrl) urlsToOverride.push(skinUrl);
                }
            }

            const finalUrls = urlsToOverride.filter(url => url !== targetUrl);

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

    let lastItemName = "";
    let readAllowedTime = 0;

    return () => {
        if (state.currentScreen !== 'garage') return;

        if (!SKIN_BRANDS_MAP) {
            const data = DataLoader.getSkinsData();
            if (!data)
                return;
            SKIN_BRANDS_MAP = data.brands;
            NAME_TRANSLATE = data.names;
            PREFILLED_DEFAULTS = data.defaults;
            SKINS_DATABASE = data.database;
        }

        const defaultImages = getDefaultImages();
        let defaultsUpdated = false;

        const garageItems = document.querySelectorAll('.garage-item');
        garageItems.forEach((item) => {
            const titleSpan = item.querySelector('.GarageItemComponentStyle-descriptionDevice span');
            const imgMain = item.querySelector('.GarageItemComponentStyle-mainImg');

            if (titleSpan && imgMain) {
                const rawTitle = titleSpan.textContent.trim().toLowerCase();
                const itemNameEN = NAME_TRANSLATE[rawTitle.split(/\s+/)[0]] || rawTitle.split(/\s+/)[0];
                const originalSrc = imgMain.getAttribute('src') || '';

                if (originalSrc && originalSrc.includes('tankionline.com')) {
                    let isCustomSkin = false;
                    if (SKINS_DATABASE[itemNameEN]) {
                        isCustomSkin = Object.values(SKINS_DATABASE[itemNameEN]).includes(originalSrc);
                    }

                    if (!isCustomSkin) {
                        if (!defaultImages[itemNameEN]) defaultImages[itemNameEN] = [];
                        if (!defaultImages[itemNameEN].includes(originalSrc)) {
                            defaultImages[itemNameEN].push(originalSrc);
                            defaultsUpdated = true;
                        }
                    }
                }
            }
        });

        if (defaultsUpdated) {
            localStorage.setItem(BASE_IMG_KEY, JSON.stringify(defaultImages));
        }

        const nameEl = document.querySelector('.ItemDescriptionComponentStyle-nameItem span')
            || document.querySelector('.garage-item.-active .GarageItemComponentStyle-descriptionDevice span');

        if (nameEl) {
            const rawName = nameEl.textContent.trim().toLowerCase();
            const firstWord = rawName.split(/\s+/)[0];
            const itemNameEN = NAME_TRANSLATE[firstWord] || firstWord;

            if (itemNameEN !== lastItemName) {
                lastItemName = itemNameEN;
                readAllowedTime = Date.now() + 400;
            }

            if (Date.now() >= readAllowedTime) {
                const skinImgs = document.querySelectorAll('.SkinsIconComponentStyle-cellSkins img');
                let foundBrand = null;

                for (const skinImg of skinImgs) {
                    const src = skinImg.getAttribute('src') || '';
                    if (SKIN_BRANDS_MAP[src]) {
                        foundBrand = SKIN_BRANDS_MAP[src];
                        break;
                    } else if (src.includes('ic_standard') || src.includes('standard')) {
                        foundBrand = 'default';
                        break;
                    }
                }

                if (!foundBrand) {
                    const previewImg = document.querySelector('.MountedItemsStyle-itemPreview, .ItemDescriptionComponentStyle-previewImg img');
                    if (previewImg) {
                        const currentSrc = previewImg.getAttribute('src') || '';
                        if (SKINS_DATABASE[itemNameEN]) {
                            for (const [brand, url] of Object.entries(SKINS_DATABASE[itemNameEN])) {
                                if (url === currentSrc) {
                                    foundBrand = brand;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (foundBrand) {
                    const savedSkins = getSavedSkins();
                    let skinsUpdated = false;

                    if (foundBrand === 'default') {
                        if (savedSkins[itemNameEN]) {
                            delete savedSkins[itemNameEN];
                            skinsUpdated = true;
                        }
                    } else if (SKINS_DATABASE[itemNameEN] && SKINS_DATABASE[itemNameEN][foundBrand]) {
                        const targetUrl = SKINS_DATABASE[itemNameEN][foundBrand];
                        if (savedSkins[itemNameEN] !== targetUrl) {
                            savedSkins[itemNameEN] = targetUrl;
                            skinsUpdated = true;
                        }
                    }

                    if (skinsUpdated) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
                    }
                } else if (skinImgs.length > 0) {
                    const savedSkins = getSavedSkins();
                    const fallbackUrl = PREFILLED_DEFAULTS[itemNameEN];
                    if (fallbackUrl && savedSkins[itemNameEN] !== fallbackUrl) {
                        savedSkins[itemNameEN] = fallbackUrl;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
                    }
                }
            }
        }

        updateGlobalCSS();
    };
})();