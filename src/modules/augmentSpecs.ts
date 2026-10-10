import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { DataLoader } from '../core/dataLoader';
import { AUGMENTS_UPDATED } from '../core/augmentCatalog';
import { activeGarageCardSection, isAugmentPreviewUrl } from '../core/gameAugments';

export const augmentSpecs = (() => {
    let initialized = false;
    let updateQueued = false;
    const previewImages = new Map<HTMLImageElement, { original: string; replacement: string; id: string; section: string | null }>();
    const failedPreviews = new Set<string>();
    const emptyCards = new Map<HTMLImageElement, { card: HTMLElement; nodes: HTMLElement[]; title: HTMLElement; badge?: HTMLElement; cosmetic: boolean }>();
    const restoreEmptyCard = (image: HTMLImageElement) => {
        const entry = emptyCards.get(image);
        if (!entry) return;
        entry.nodes.forEach(node => node.remove());
        entry.card.classList.remove('kasp-unavailable-device-card');
        entry.card.classList.remove('kasp-unavailable-cosmetic-card');
        emptyCards.delete(image);
    };
    const decorateEmptyCard = (image: HTMLImageElement, data: { name?: string }, cosmetic = false) => {
        const card = image.parentElement;
        if (!card || !data.name) { restoreEmptyCard(image); return; }
        let entry = emptyCards.get(image);
        if (entry && (entry.card !== card || entry.cosmetic !== cosmetic || entry.nodes.some(node => node.parentElement !== card))) {
            restoreEmptyCard(image); entry = undefined;
        }
        if (!entry) {
            const nodes = (cosmetic ? ['name'] : ['gradient', 'rarity', 'name']).map(part => {
                const node = document.createElement(part === 'name' ? 'p' : 'div');
                node.className = `kasp-unavailable-${cosmetic ? 'cosmetic' : 'device'}-${part}`;
                card.appendChild(node);
                return node;
            });
            entry = { card, nodes, badge: cosmetic ? undefined : nodes[1], title: nodes[nodes.length - 1], cosmetic };
            emptyCards.set(image, entry);
        }
        // React can replace the card's className when selection changes.
        const cardClass = `kasp-unavailable-${cosmetic ? 'cosmetic' : 'device'}-card`;
        if (!card.classList.contains(cardClass)) card.classList.add(cardClass);
        if (entry.title.textContent !== data.name) entry.title.textContent = data.name;
        const background = 'url("https://s.eu.tankionline.com/static/images/legendary_icon.4e33cd2f.svg")';
        if (entry.badge && entry.badge.style.backgroundImage !== background) entry.badge.style.backgroundImage = background;
    };
    const restorePreview = (image: HTMLImageElement) => {
        const entry = previewImages.get(image);
        if (entry && image.src === entry.replacement) image.src = entry.original;
        image.classList.remove('kasp-unavailable-device-preview');
        previewImages.delete(image);
    };
    const t = {
        RU: { specsTitle: 'Характеристики', adv: 'Преимущества', disadv: 'Недостатки', empty: 'Нет подтверждённых изменений',
            neutral: 'Другие параметры',
            locale: 'Перезагрузите игру, чтобы обновить язык описания.' },
        EN: { specsTitle: 'Specs', adv: 'Advantages', disadv: 'Disadvantages', empty: 'No confirmed changes',
            neutral: 'Other parameters',
            locale: 'Reload the game to update the description language.' }
    };

    const STAT_DICT = {
        DAMAGE: { RU: "Урон", EN: "Damage" },
        DPS: { RU: "Урон в секунду", EN: "Damage per second" },
        CHARGE_RATE: { RU: "Зарядка", EN: "Charge rate" },
        RELOAD: { RU: ["Перезарядка", "Зарядка"], EN: ["Reload", "Cooldown time"] },
        TURNING_SPEED: { RU: "Скорость поворота", EN: "Turning speed" },
        RANGE: { RU: "Дальность", EN: "Shot range" },
        CRIT_DAMAGE: { RU: "Критический урон", EN: "Critical hit damage" },
        HEALING: { RU: "Лечение в секунду", EN: "Healing per second" },
        IMPACT_FORCE: { RU: "Сила удара", EN: "Impact force" },
        SNIPING_DAMAGE: { RU: "Урон прицельный", EN: ["Aiming mode damage", "Damage in sniping mode"] },
        ARCADE_DAMAGE: { RU: "Урон навскидку", EN: "Normal shot damage" },
        ARMOR: { RU: "Броня", EN: "Armor" },
        TURN_SPEED: { RU: "Скорость поворота", EN: "Turn speed" },
        WEIGHT: { RU: "Масса", EN: "Mass" },
        TOP_SPEED: { RU: "Максимальная скорость", EN: "Max speed" },
        POWER: { RU: "Мощность", EN: "Power" }
    };

    const escapeText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

    const renderList = (items, lang) => {
        if (!items || items.length === 0) return `<li>${t[lang].empty}</li>`;
        return items.map(item => {
            let html = `<li>${escapeText(item[lang] || item['EN'])}`;
            if (item.subItems && item.subItems.length > 0) {
                html += `<ul>${item.subItems.map(sub => `<li>${escapeText(sub[lang] || sub['EN'])}</li>`).join('')}</ul>`;
            }
            html += `</li>`;
            return html;
        }).join('');
    };

    const injectButtons = () => {
        if (!utils.getSetting('k_augments', false)) return;

        let hoverTooltip = document.getElementById('kasp-specs-tooltip');
        if (!hoverTooltip) {
            hoverTooltip = document.createElement('div');
            hoverTooltip.id = 'kasp-specs-tooltip';
            document.body.appendChild(hoverTooltip);
        }

        const updateTooltipPos = (e) => {
            if (!hoverTooltip) return;
            const offset = 15;
            const margin = 10;
            let x = e.clientX + offset;
            let y = e.clientY + offset;

            const rect = hoverTooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth - margin) {
                x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight - margin) {
                const above = e.clientY - rect.height - offset;
                if (above >= margin) y = above;
            }

            hoverTooltip.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))}px`;
            hoverTooltip.style.top = `${y}px`;
        };

        const applyButtonToCard = (card, url) => {
            if (!card) return;
            const existingBtn = card.querySelector('.custom-card-specs-btn');
            const device = DataLoader.getDevice(url, card);

            if (!device) {
                if (!existingBtn) return;
                existingBtn.remove();
                hoverTooltip.style.display = 'none';
                return;
            }

            // React and the preview replacement can change src without changing the device.
            // Keep the button and its listeners, rebinding lookup data in place.
            if (existingBtn) {
                if (existingBtn.dataset.url !== url || existingBtn.dataset.deviceId !== device.id) {
                    existingBtn.dataset.url = url;
                    existingBtn.dataset.deviceId = device.id;
                    hoverTooltip.style.display = 'none';
                }
                return;
            }

            if (!existingBtn) {
                if (window.getComputedStyle(card).position === 'static') {
                    card.style.position = 'relative';
                }
                const btn = document.createElement('div');
                btn.className = 'custom-card-specs-btn';
                btn.dataset.url = url;
                btn.dataset.deviceId = device.id;
                btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });

                btn.addEventListener('mouseenter', (e) => {
                    const deviceData = DataLoader.getDevice(btn.dataset.url, card);
                    if (!deviceData) { hoverTooltip.style.display = 'none'; return; }

                    const lang = state.lang;
                    const advList = renderList(deviceData.advantages, lang);
                    const disadvList = renderList(deviceData.disadvantages, lang);
                    const description = deviceData.locale === lang
                        ? deviceData.description?.split('\n\n')[0] || '' : t[lang].locale;
                    const neutral = deviceData.neutral.length ? `<div class="device-stats neutral"><div class="heading">${t[lang].neutral}</div><ul>${renderList(deviceData.neutral, lang)}</ul></div>` : '';

                    hoverTooltip.innerHTML = `
                                <div style="padding: 0 1.5rem 1rem;">${escapeText(description)}</div>
                                <div class="device-stats-wrapper">
                                    <div class="device-stats">
                                        <div class="heading">${t[lang].adv}</div>
                                        <ul>${advList}</ul>
                                    </div>
                                    <div class="device-stats negative">
                                        <div class="heading">${t[lang].disadv}</div>
                                        <ul>${disadvList}</ul>
                                    </div>
                                </div>
                                ${neutral}
                            `;

                    hoverTooltip.style.display = 'block';
                    updateTooltipPos(e);
                });

                btn.addEventListener('mousemove', updateTooltipPos);

                btn.addEventListener('mouseleave', () => {
                    hoverTooltip.style.display = 'none';
                });

                card.appendChild(btn);
            }
        };

        const cardsImgs = document.querySelectorAll<HTMLImageElement>(gameDOM.augments.cardImage);
        const section = activeGarageCardSection(document);
        cardsImgs.forEach(img => {
            let preview = previewImages.get(img);
            const cosmeticSection = section === 'skins' || section === 'shot-color';
            const augmentId = cosmeticSection ? null : img.getAttribute('data-kasp-augment-id');
            const cosmeticId = cosmeticSection && img.getAttribute('data-kasp-cosmetic-section') === section
                ? img.getAttribute('data-kasp-cosmetic-id') : null;
            const id = augmentId || cosmeticId;
            if (preview && (img.src !== preview.replacement || preview.id !== id || preview.section !== section)) {
                restorePreview(img); preview = undefined;
            }
            const original = preview?.original || img.src;
            const cosmeticPreview = cosmeticId ? img.getAttribute('data-kasp-cosmetic-preview') : null;
            const data = cosmeticId && /^\d{1,20}$/.test(cosmeticId) && isAugmentPreviewUrl(cosmeticPreview)
                ? { name: img.getAttribute('data-kasp-cosmetic-name')?.slice(0, 500), previewIcon: cosmeticPreview }
                : cosmeticSection ? undefined : DataLoader.getDevice(original, img);
            const unavailable = id && /\/unavailable\.[^/]+\.svg(?:[?#].*)?$/.test(original);
            if (unavailable && data) decorateEmptyCard(img, data, section === 'skins');
            else restoreEmptyCard(img);
            if (unavailable && data?.previewIcon && !failedPreviews.has(data.previewIcon)) {
                if (preview?.replacement !== data.previewIcon) {
                    const replacement = data.previewIcon;
                    previewImages.set(img, { original, replacement, id, section });
                    img.addEventListener('error', () => {
                        if (previewImages.get(img)?.replacement !== replacement || img.src !== replacement) return;
                        failedPreviews.add(replacement); restorePreview(img);
                        img.setAttribute('data-kasp-preview-failed', '');
                    }, { once: true });
                    img.classList.add('kasp-unavailable-device-preview');
                    img.removeAttribute('data-kasp-preview-failed');
                    img.src = replacement;
                }
            } else if (preview) restorePreview(img);
            if (cosmeticSection) img.parentElement?.querySelector('.custom-card-specs-btn')?.remove();
            else applyButtonToCard(img.parentElement, original);
        });
        for (const img of previewImages.keys()) if (!img.isConnected) previewImages.delete(img);
        for (const img of emptyCards.keys()) if (!img.isConnected) restoreEmptyCard(img);

        const containerImageBlocks = document.querySelectorAll(gameDOM.augments.rewardImageBlock);
        containerImageBlocks.forEach(block => {
            if (block.closest(gameDOM.augments.possibleRewards)) return;

            const card = block.parentElement;
            const imageDiv = block.querySelector(gameDOM.common.backgroundDiv);
            if (!imageDiv || !card) return;

            const bgImage = window.getComputedStyle(imageDiv).backgroundImage;
            const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
                applyButtonToCard(card, match[1]);
            }
        });
    };

    const liveStats = new Map<HTMLElement, {
        replacement: HTMLSpanElement;
        value: HTMLSpanElement;
        originalDisplay: string;
    }>();

    function updateLiveStats() {
        if (!utils.getSetting('k_augments', false)) return;
        const activeValues = new Set<HTMLElement>();
        const deviceImg = document.querySelector<HTMLImageElement>(gameDOM.garage.deviceIcon);
        const deviceData = deviceImg ? DataLoader.getDevice(deviceImg.src, deviceImg) : undefined;

        const allSpans = deviceData?.modifiers
            ? Array.from(document.querySelectorAll('span')).filter(s => !s.closest('.custom-live-stat'))
            : [];
        allSpans.forEach(nameSpan => {
            const text = nameSpan.textContent?.trim().toLowerCase() || '';
            let matchedTag = null;
            for (const [tag, translations] of Object.entries(STAT_DICT)) {
                const allVariants = [].concat(translations.RU, translations.EN).filter(Boolean).map(s => s.toLowerCase());
                if (tag in deviceData.modifiers && allVariants.includes(text)) { matchedTag = tag; break; }
            }
            if (matchedTag && deviceData.modifiers && (matchedTag in deviceData.modifiers)) {
                const multiplier = deviceData.modifiers[matchedTag];
                const valueSpan = nameSpan.parentElement?.nextElementSibling;
                if (valueSpan && valueSpan.tagName === 'SPAN' && !valueSpan.classList.contains('custom-live-stat')) {
                    const original = valueSpan as HTMLElement;
                    const cleanStr = (original.textContent || '').replace(/\s/g, '').replace(',', '.');
                    const origNumber = parseFloat(cleanStr);
                    if (!isNaN(origNumber)) {
                        const newVal = origNumber * multiplier;
                        const numberValue = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                        const formattedVal = numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                        let isBuff = multiplier > 1;
                        if (['RELOAD'].includes(matchedTag)) isBuff = multiplier < 1;
                        const color = matchedTag === 'WEIGHT' || multiplier === 1 ? '#ffffff' : isBuff ? '#00ff38' : '#fe6666';
                        activeValues.add(original);
                        let entry = liveStats.get(original);
                        if (!entry) {
                            const replacement = document.createElement('span');
                            const value = document.createElement('span');
                            replacement.appendChild(value);
                            entry = { replacement, value, originalDisplay: original.style.display };
                            liveStats.set(original, entry);
                        }
                        const className = original.className.split(/\s+/)
                            .filter(name => name && name !== 'hidden-by-script').concat('custom-live-stat').join(' ');
                        if (entry.replacement.className !== className) entry.replacement.className = className;
                        const textValue = String(formattedVal);
                        if (entry.value.textContent !== textValue) entry.value.textContent = textValue;
                        const valueStyle = `color: ${color}; text-shadow: 0 0 5px ${color}40;`;
                        if (entry.value.getAttribute('style') !== valueStyle) entry.value.setAttribute('style', valueStyle);
                        if (!original.classList.contains('hidden-by-script')) original.classList.add('hidden-by-script');
                        if (original.style.display !== 'none') original.style.display = 'none';
                        if (original.nextSibling !== entry.replacement) {
                            original.parentNode?.insertBefore(entry.replacement, original.nextSibling);
                        }
                    }
                }
            }
        });

        for (const [original, entry] of liveStats) {
            if (activeValues.has(original)) continue;
            entry.replacement.remove();
            original.classList.remove('hidden-by-script');
            original.style.display = entry.originalDisplay;
            liveStats.delete(original);
        }
    }

    const scheduleUpdate = () => {
        if (updateQueued) return;
        updateQueued = true;
        // DOM observers and catalog messages can finish decoration before the next paint.
        queueMicrotask(() => {
            updateQueued = false;
            if (!utils.getSetting('k_augments', false)) return;

            const isGarage = state.currentScreen === 'garage';
            const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
            if (!isGarage && !isContainers) return;

            injectButtons();
            updateLiveStats();
        });
    };

    return function sync() {
        if (!utils.getSetting('k_augments', false)) {
            for (const img of previewImages.keys()) restorePreview(img);
            for (const img of emptyCards.keys()) restoreEmptyCard(img);
            for (const [original, entry] of liveStats) {
                entry.replacement.remove();
                original.classList.remove('hidden-by-script');
                original.style.display = entry.originalDisplay;
            }
            liveStats.clear();
            document.querySelectorAll('.custom-card-specs-btn').forEach(button => button.remove());
            const tooltip = document.getElementById('kasp-specs-tooltip');
            if (tooltip) tooltip.style.display = 'none';
            return;
        }

        if (!initialized) {
            initialized = true;
            window.addEventListener('kasp:settings-changed', sync);
            window.addEventListener('storage', sync);
            window.addEventListener(AUGMENTS_UPDATED, scheduleUpdate);

            const forceHideTooltip = () => {
                const hoverTooltip = document.getElementById('kasp-specs-tooltip');
                if (hoverTooltip) hoverTooltip.style.display = 'none';
            };

            window.addEventListener('keydown', (e) => {
                if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                    forceHideTooltip();
                }
            }, true);

            window.addEventListener('mousedown', (e) => {
                if (e.button === 3) {
                    forceHideTooltip();
                }
            }, true);
        }

        const isGarage = state.currentScreen === 'garage';
        const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
        const loadingScreen = document.querySelector(gameDOM.screens.loadingBackground);

        if (loadingScreen || (!isGarage && !isContainers)) {
            const hoverTooltip = document.getElementById('kasp-specs-tooltip');
            if (hoverTooltip) hoverTooltip.style.display = 'none';
        }

        if (isGarage || isContainers) {
            scheduleUpdate();
        }
    };
})();
