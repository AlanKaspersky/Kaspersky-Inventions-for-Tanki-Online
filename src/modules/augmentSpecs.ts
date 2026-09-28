import { state } from '../core/state';
import { utils } from '../core/utils';
import { DataLoader } from '../core/dataLoader';

export const augmentSpecs = (() => {
    let initialized = false;
    let updateQueued = false;
    const t = {
        RU: { specsTitle: 'Характеристики', adv: 'Преимущества', disadv: 'Недостатки', empty: 'Нет данных' },
        EN: { specsTitle: 'Specs', adv: 'Advantages', disadv: 'Disadvantages', empty: 'No data' }
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

    const renderList = (items, lang) => {
        if (!items || items.length === 0) return `<li>${t[lang].empty}</li>`;
        return items.map(item => {
            let html = `<li>${item[lang] || item['EN']}`;
            if (item.subItems && item.subItems.length > 0) {
                html += `<ul>${item.subItems.map(sub => `<li>${sub[lang] || sub['EN']}</li>`).join('')}</ul>`;
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
            let x = e.clientX + offset;
            let y = e.clientY + offset;

            const rect = hoverTooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) {
                x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight) {
                y = e.clientY - rect.height - offset;
            }

            hoverTooltip.style.left = `${x}px`;
            hoverTooltip.style.top = `${y}px`;
        };

        const applyButtonToCard = (card, url) => {
            if (!card) return;
            let existingBtn = card.querySelector('.custom-card-specs-btn');

            if (existingBtn && existingBtn.dataset.url !== url) {
                existingBtn.remove();
                existingBtn = null;
            }

            if (!existingBtn && DataLoader.hasDevice(url)) {
                if (window.getComputedStyle(card).position === 'static') {
                    card.style.position = 'relative';
                }
                const btn = document.createElement('div');
                btn.className = 'custom-card-specs-btn';
                btn.dataset.url = url;
                btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });

                btn.addEventListener('mouseenter', (e) => {
                    const deviceData = DataLoader.getDevice(url);
                    if (!deviceData) return;

                    const lang = state.lang;
                    const advList = renderList(deviceData.advantages, lang);
                    const disadvList = renderList(deviceData.disadvantages, lang);

                    hoverTooltip.innerHTML = `
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

        const cardsImgs = document.querySelectorAll<HTMLImageElement>('img.SkinCellStyle-iconCell');
        cardsImgs.forEach(img => {
            applyButtonToCard(img.parentElement, img.src);
        });

        const containerImageBlocks = document.querySelectorAll('.RewardCardComponentStyle-imageBlock');
        containerImageBlocks.forEach(block => {
            if (block.closest('.ContainersComponentStyle-possibleRewardsBlock')) return;

            const card = block.parentElement;
            const imageDiv = block.querySelector('div[class*="-backgroundImageContain"]');
            if (!imageDiv || !card) return;

            const bgImage = window.getComputedStyle(imageDiv).backgroundImage;
            const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
                applyButtonToCard(card, match[1]);
            }
        });
    };

    function updateLiveStats() {
        if (!utils.getSetting('k_augments', false)) return;
        document.querySelectorAll('.custom-live-stat').forEach(el => el.remove());
        document.querySelectorAll('.hidden-by-script').forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.classList.remove('hidden-by-script');
            htmlEl.style.display = '';
        });

        const deviceImg = document.querySelector<HTMLImageElement>('.DeviceButtonComponentStyle-deviceIcon');
        if (!deviceImg) return;
        const deviceData = DataLoader.getDevice(deviceImg.src);
        if (!deviceData || !deviceData.modifiers) return;

        const allSpans = Array.from(document.querySelectorAll('span')).filter(s => !s.classList.contains('custom-live-stat'));
        allSpans.forEach(nameSpan => {
            const text = nameSpan.textContent?.trim().toLowerCase() || '';
            let matchedTag = null;
            for (const [tag, translations] of Object.entries(STAT_DICT)) {
                const allVariants = [].concat(translations.RU, translations.EN).filter(Boolean).map(s => s.toLowerCase());
                if (allVariants.includes(text)) { matchedTag = tag; break; }
            }
            if (matchedTag && deviceData.modifiers && (matchedTag in deviceData.modifiers)) {
                const multiplier = deviceData.modifiers[matchedTag];
                const valueSpan = nameSpan.parentElement?.nextElementSibling;
                if (valueSpan && valueSpan.tagName === 'SPAN' && !valueSpan.classList.contains('hidden-by-script')) {
                    const cleanStr = (valueSpan as HTMLElement).innerText.replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
                    const origNumber = parseFloat(cleanStr);
                    if (!isNaN(origNumber)) {
                        let newVal = (matchedTag === 'WEIGHT' && multiplier >= 10) ? multiplier : origNumber * multiplier;
                        let formattedVal = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                        formattedVal = formattedVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                        let isBuff = multiplier > 1;
                        if (['RELOAD'].includes(matchedTag)) isBuff = multiplier < 1;
                        if (matchedTag === 'WEIGHT' && multiplier < origNumber) isBuff = false;

                        const color = isBuff ? '#00ff38' : '#fe6666';
                        valueSpan.classList.add('hidden-by-script');
                        (valueSpan as HTMLElement).style.display = 'none';
                        const customSpan = document.createElement('span');
                        customSpan.className = valueSpan.className + ' custom-live-stat';
                        customSpan.innerHTML = `<span style="color: ${color}; text-shadow: 0 0 5px ${color}40;">${formattedVal}</span>`;
                        valueSpan.parentNode?.insertBefore(customSpan, valueSpan.nextSibling);
                    }
                }
            }
        });
    }

    const scheduleUpdate = () => {
        if (updateQueued) return;
        updateQueued = true;
        requestAnimationFrame(() => {
            updateQueued = false;
            if (!utils.getSetting('k_augments', false)) return;

            const isGarage = state.currentScreen === 'garage';
            const isContainers = !!document.querySelector('.ContainerInfoComponentStyle-lootBoxContainer');
            if (!isGarage && !isContainers) return;

            injectButtons();
            updateLiveStats();
        });
    };

    return () => {
        if (!utils.getSetting('k_augments', false)) return;

        if (!initialized) {
            initialized = true;

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
        const isContainers = !!document.querySelector('.ContainerInfoComponentStyle-lootBoxContainer');
        const loadingScreen = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');

        if (loadingScreen || (!isGarage && !isContainers)) {
            const hoverTooltip = document.getElementById('kasp-specs-tooltip');
            if (hoverTooltip) hoverTooltip.style.display = 'none';
        }

        if (isGarage || isContainers) {
            scheduleUpdate();
        }
    };
})();