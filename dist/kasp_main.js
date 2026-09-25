"use strict";
(function () {
    'use strict';
    if (window !== window.top)
        return;
    const isElectronClient = (() => {
        try {
            if (navigator.userAgent && navigator.userAgent.indexOf('Electron') !== -1)
                return true;
            if (window.process && typeof window.process === 'object' && window.process.type)
                return true;
        }
        catch (_) { }
        return false;
    })();
    if (isElectronClient) {
        const dispatchZKey = (type) => {
            const event = new KeyboardEvent(type, {
                key: 'z',
                code: 'KeyZ',
                keyCode: 90,
                which: 90,
                bubbles: true,
                cancelable: true,
                composed: true
            });
            document.dispatchEvent(event);
        };
        document.addEventListener('mousedown', (e) => {
            if (e.button !== 3 && e.button !== 4)
                return;
            const ae = document.activeElement;
            if (ae instanceof HTMLElement &&
                (ae.tagName === 'INPUT' ||
                    ae.tagName === 'TEXTAREA' ||
                    ae.tagName === 'SELECT' ||
                    ae.isContentEditable))
                return;
            e.preventDefault();
            dispatchZKey('keydown');
            dispatchZKey('keyup');
        }, true);
        document.addEventListener('mouseup', (e) => {
            if (e.button === 3 || e.button === 4)
                e.preventDefault();
        }, true);
        document.addEventListener('click', (e) => {
            if (e.button === 3 || e.button === 4)
                e.preventDefault();
        }, true);
    }
    const loaderBg = chrome.runtime.getURL("assets/background.png");
    document.documentElement.style.setProperty('--kasp-loader-bg', `url("${loaderBg}")`);
    const DataLoader = (() => {
        const state = {
            paints: null,
            augments: null,
            maps: null,
            skins: null,
            shared: null,
            ready: false,
            error: null,
        };
        const readyPromise = (async () => {
            try {
                const [paintsRes, augmentsRes, mapsRes, skinsRes] = await Promise.all([
                    fetch(chrome.runtime.getURL('database/paints.json')),
                    fetch(chrome.runtime.getURL('database/augments.json')),
                    fetch(chrome.runtime.getURL('database/maps.json')),
                    fetch(chrome.runtime.getURL('database/skins.json')),
                ]);
                if (!paintsRes.ok)
                    throw new Error('paints.json: HTTP ' + paintsRes.status);
                if (!augmentsRes.ok)
                    throw new Error('augments.json: HTTP ' + augmentsRes.status);
                if (!mapsRes.ok)
                    throw new Error('maps.json: HTTP ' + mapsRes.status);
                if (!skinsRes.ok)
                    throw new Error('skins.json: HTTP ' + skinsRes.status);
                state.paints = await paintsRes.json();
                const augRaw = await augmentsRes.json();
                state.shared = augRaw._shared || {};
                const devices = augRaw.devices || {};
                for (const url in devices) {
                    const entry = devices[url];
                    if (entry && typeof entry === 'object' && entry.$shared) {
                        devices[url] = state.shared[entry.$shared] || entry;
                    }
                }
                state.augments = devices;
                const mapsRaw = await mapsRes.json();
                const byRu = new Map();
                const byEn = new Map();
                for (const entry of mapsRaw) {
                    if (entry.ru)
                        byRu.set(entry.ru.toLowerCase(), entry);
                    if (entry.en)
                        byEn.set(entry.en.toLowerCase(), entry);
                }
                state.maps = { list: mapsRaw, byRu, byEn };
                state.skins = await skinsRes.json();
                state.ready = true;
                console.log(`[KI] DB loaded: paints=${Object.keys(state.paints).length}, ` +
                    `augments=${Object.keys(state.augments).length}, ` +
                    `maps=${mapsRaw.length}`, `skins=${Object.keys(state.skins.database).length}`);
            }
            catch (e) {
                state.error = e;
                console.error('[KI] DB load failed:', e);
            }
        })();
        return {
            readyPromise,
            isReady: () => state.ready,
            getPaint: (url) => state.paints ? state.paints[url] : undefined,
            getDevice: (url) => state.augments ? state.augments[url] : undefined,
            hasDevice: (url) => !!state.augments && url in state.augments,
            translateMap: (rawName, targetLang) => {
                if (!state.maps || !rawName)
                    return rawName;
                const key = String(rawName).trim().toLowerCase();
                const entry = state.maps.byRu.get(key) || state.maps.byEn.get(key);
                if (!entry)
                    return rawName;
                return targetLang === 'RU' ? entry.ru : entry.en;
            },
            getMapInfo: (rawName) => {
                if (!state.maps || !rawName)
                    return null;
                const key = String(rawName).trim().toLowerCase();
                return state.maps.byRu.get(key) || state.maps.byEn.get(key) || null;
            },
            getSkinsData: () => state.skins,
        };
    })();
    const state = {
        lang: 'EN',
        currentScreen: 'loading',
        settingsOpen: false,
        friendsMenuOpen: false
    };
    const SETTINGS_KEYS = [
        'k_ext_btn',
        'k_augments',
        'k_auto_upgrade',
        'k_friends',
        'k_paints',
        'k_hideCurrency',
        'k_hideNicknameXP',
        'k_history'
    ];
    const settingsCache = new Map();
    function readSetting(id, def) {
        const val = localStorage.getItem(id);
        return val === null ? def : val === 'true';
    }
    function invalidateSetting(id) {
        if (id)
            settingsCache.delete(id);
        else
            settingsCache.clear();
    }
    for (const key of SETTINGS_KEYS) {
        settingsCache.set(key, readSetting(key, false));
    }
    window.addEventListener('storage', (e) => {
        if (e.key && SETTINGS_KEYS.includes(e.key))
            invalidateSetting(e.key);
        if (e.key === 'language_store_key') {
            state.lang = utils.getLang();
            if (!isMasterUpdateScheduled) {
                isMasterUpdateScheduled = true;
                requestAnimationFrame(performMasterCheck);
            }
        }
    });
    const utils = {
        getLang: () => {
            try {
                const stored = (localStorage.getItem('language_store_key') || '').toLowerCase();
                if (stored.startsWith('ru'))
                    return 'RU';
                if (stored.startsWith('en'))
                    return 'EN';
            }
            catch (e) { }
            const htmlLang = (document.documentElement.lang || '').toLowerCase();
            if (htmlLang.includes('ru'))
                return 'RU';
            if (htmlLang.includes('en'))
                return 'EN';
            if (window.location.hostname.includes('ru.'))
                return 'RU';
            return 'EN';
        },
        getSetting: (id, def) => {
            if (settingsCache.has(id)) {
                const cached = settingsCache.get(id);
                if (cached !== undefined)
                    return cached;
            }
            const parsed = readSetting(id, def);
            settingsCache.set(id, parsed);
            return parsed;
        },
        setSetting: (id, value) => {
            const normalized = value ? 'true' : 'false';
            localStorage.setItem(id, normalized);
            settingsCache.set(id, value === true || value === 'true');
        },
        injectStyle: (css, id) => {
            if (document.getElementById(id))
                return;
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            if (document.head)
                document.head.appendChild(style);
            else
                document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
        }
    };
    const coreSettings = (() => {
        let needsReload = false;
        let initialSettingsState = {};
        let stylesInjected = false;
        const t = {
            RU: {
                title: 'НАСТРОЙКИ KASPERSKY\'S INVENTIONS', tooltip: 'ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА',
                warnTitle: 'ПРЕДУПРЕЖДЕНИЕ', warnText: 'Включение этой функции сломает Историю битв и раздел Кланы в друзьях, а также возможны просадки ФПС. Вы уверены, что хотите продолжить?', warnCancel: 'ОТМЕНА', warnConfirm: 'ВКЛЮЧИТЬ'
            },
            EN: {
                title: 'KASPERSKY\'S INVENTIONS SETTINGS', tooltip: 'REQUIRES RELOAD',
                warnTitle: 'WARNING', warnText: 'Enabling this feature will break Battle History and the Clans section in Friends, and may also result in FPS drops. Are you sure you want to continue?', warnCancel: 'CANCEL', warnConfirm: 'ENABLE'
            }
        };
        const MY_SETTINGS = [
            { id: 'k_ext_btn', label: { RU: 'Расширенная кнопка «Играть»', EN: 'Enhanced «Play» button' }, default: false },
            { id: 'k_augments', label: { RU: 'Характеристики устройств', EN: 'Augment specifications' }, default: false },
            { id: 'k_auto_upgrade', label: { RU: 'Быстрое улучшение вооружения', EN: 'Quick weapon upgrades' }, default: false },
            { id: 'k_friends', label: { RU: 'Метки и категории друзей', EN: 'Friend tags & categories' }, default: false },
            { id: 'k_paints', label: { RU: 'Умный поиск красок', EN: 'Smart paint search' }, default: false },
            { id: 'k_hideCurrency', label: { RU: 'Скрыть валюту', EN: 'Hide currency' }, default: false },
            { id: 'k_hideNicknameXP', label: { RU: 'Скрыть никнейм и опыт', EN: 'Hide nickname and score' }, default: false },
            { id: 'k_history', label: { RU: 'Вести историю битв', EN: 'Keep a history of battles' }, default: false }
        ];
        function showWarningDialog(callback) {
            const existing = document.getElementById('kasp-warning-overlay');
            if (existing)
                existing.remove();
            const lang = state.lang;
            const dict = t[lang] || t['EN'];
            const overlay = document.createElement('div');
            overlay.id = 'kasp-warning-overlay';
            overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 99999; display: flex; align-items: center; justify-content: center;`;
            const dialog = document.createElement('div');
            dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75)`;
            const header = document.createElement('div');
            header.style.cssText = `display: flex; align-items: center; justify-content: space-between; background-color: transparent; width: 100%; position: relative; margin-bottom: 1.5em;`;
            const title = document.createElement('h1');
            title.textContent = dict.warnTitle;
            title.style.cssText = `font-size: 1.5em; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; margin: 0; padding: 0; line-height: 1.2; flex: 1;`;
            const closeBtn = document.createElement('div');
            closeBtn.style.cssText = `width: 1.5em; height: 1.5em; cursor: pointer; background-image: url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg); background-repeat: no-repeat; background-size: contain; background-position: center center; flex-shrink: 0; margin-left: 0.5em;`;
            closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundImage = 'url(https://s.eu.tankionline.com/static/images/deleteHoverModal.3aceb055.svg)'; });
            closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundImage = 'url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg)'; });
            header.appendChild(title);
            header.appendChild(closeBtn);
            const content = document.createElement('div');
            content.style.cssText = `display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; flex: 1; margin-bottom: 1.5em; text-align: center;`;
            const textSpan = document.createElement('span');
            textSpan.textContent = dict.warnText;
            textSpan.style.cssText = `font-size: 1em; color: rgb(255, 255, 255); font-family: BaseFont, FallbackFont, sans-serif; line-height: 1.4;`;
            content.appendChild(textSpan);
            const footer = document.createElement('div');
            footer.style.cssText = `background-color: transparent; width: 100%; display: flex; align-items: center; justify-content: center; gap: 1.25em;`;
            const cancelBtn = document.createElement('div');
            cancelBtn.textContent = dict.warnCancel;
            cancelBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgba(255, 255, 255, 0.15); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
            cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.borderColor = 'rgb(255, 255, 255)'; cancelBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
            cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.borderColor = 'transparent'; cancelBtn.style.boxShadow = 'none'; });
            const confirmBtn = document.createElement('div');
            confirmBtn.textContent = dict.warnConfirm;
            confirmBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgb(118, 255, 51); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(0, 25, 38); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
            confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.borderColor = 'rgb(255, 255, 255)'; confirmBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
            confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.borderColor = 'transparent'; confirmBtn.style.boxShadow = 'none'; });
            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            dialog.appendChild(header);
            dialog.appendChild(content);
            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const loaderObserver = new MutationObserver(() => {
                if (document.querySelector('.ApplicationLoaderComponentStyle-container.-background'))
                    closeDialog();
            });
            loaderObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            let dialogClosed = false;
            function handleMouse(e) {
                if (e.button === 3 || e.button === 4) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (e.type === 'mousedown' && !dialogClosed) {
                        dialogClosed = true;
                        closeDialog();
                    }
                }
            }
            function closeDialog() {
                if (!overlay.parentNode)
                    return;
                overlay.remove();
                document.removeEventListener('keydown', onKeyDown, true);
                loaderObserver.disconnect();
                setTimeout(() => {
                    document.removeEventListener('mousedown', handleMouse, true);
                    document.removeEventListener('mouseup', handleMouse, true);
                    document.removeEventListener('click', handleMouse, true);
                }, 300);
            }
            confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); if (callback)
                callback(); });
            cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
            closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay)
                closeDialog(); });
            function onKeyDown(e) {
                if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeDialog();
                    if (e.key === 'Enter' && callback)
                        callback();
                }
            }
            document.addEventListener('keydown', onKeyDown, true);
            document.addEventListener('mousedown', handleMouse, true);
            document.addEventListener('mouseup', handleMouse, true);
            document.addEventListener('click', handleMouse, true);
        }
        return {
            inject: () => {
                if (!stylesInjected) {
                    stylesInjected = true;
                }
                const mainBlock = document.querySelector('.SettingsComponentStyle-blockContentOptions');
                if (!mainBlock)
                    return;
                const ulMenu = mainBlock.querySelector('ul');
                if (!ulMenu || document.getElementById('kaspersky-tab'))
                    return;
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
                let tooltip = document.getElementById('kaspersky-reload-tooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'kaspersky-reload-tooltip';
                    tooltip.className = 'kasp-tooltip kasp-hidden';
                    tooltip.textContent = dict.tooltip;
                    document.body.appendChild(tooltip);
                }
                const kTab = document.createElement('li');
                kTab.id = 'kaspersky-tab';
                kTab.className = 'SettingsMenuComponentStyle-menuItemOptions';
                kTab.innerHTML = `<div class="kasp-fake-highlight"><div class="kasp-fake-line"></div></div><span>KASPERSKY</span>`;
                ulMenu.appendChild(kTab);
                const kContent = document.createElement('div');
                kContent.id = 'kaspersky-settings-content';
                kContent.className = 'kasp-hidden';
                let togglesHTML = `
                    <div style="font-family: BaseFontBold, FallbackFontBold; font-size: 1.2em; color: rgb(118, 255, 51); margin-bottom: 1.5em; text-transform: uppercase;">
                        ${dict.title}
                    </div>
                    <div style="width: 100%; height: 1px; background-color: rgba(255, 255, 255, 0.15); margin-bottom: 1.5em;"></div>
                `;
                MY_SETTINGS.forEach(setting => {
                    const isChecked = utils.getSetting(setting.id, setting.default);
                    initialSettingsState[setting.id] = isChecked;
                    const localizedLabel = setting.label[lang] || setting.label['EN'];
                    togglesHTML += `
                        <div class="kasp-toggle-row ${isChecked ? 'kasp-active' : ''}" data-id="${setting.id}">
                            <div class="kasp-toggle-switch"></div>
                            <div class="kasp-toggle-label">${localizedLabel}</div>
                        </div>
                    `;
                });
                kContent.innerHTML = togglesHTML;
                mainBlock.appendChild(kContent);
                kContent.querySelectorAll('.kasp-toggle-row').forEach(node => {
                    const row = node;
                    const label = row.querySelector('.kasp-toggle-label');
                    const switchBtn = row.querySelector('.kasp-toggle-switch');
                    label.addEventListener('mousemove', (e) => {
                        if (tooltip) {
                            tooltip.style.left = e.clientX + 'px';
                            tooltip.style.top = e.clientY + 'px';
                            tooltip.classList.remove('kasp-hidden');
                        }
                    });
                    label.addEventListener('mouseleave', () => {
                        if (tooltip)
                            tooltip.classList.add('kasp-hidden');
                    });
                    row.addEventListener('click', function (e) {
                        const target = e.target;
                        if (target !== label && target !== switchBtn && !switchBtn.contains(target))
                            return;
                        const rowEl = this;
                        const id = rowEl.getAttribute('data-id');
                        if (!id)
                            return;
                        const isCurrentlyChecked = rowEl.classList.contains('kasp-active');
                        const performToggle = () => {
                            if (isCurrentlyChecked) {
                                rowEl.classList.remove('kasp-active');
                                utils.setSetting(id, false);
                            }
                            else {
                                rowEl.classList.add('kasp-active');
                                utils.setSetting(id, true);
                            }
                            needsReload = MY_SETTINGS.some(s => {
                                const currentVal = utils.getSetting(s.id, s.default);
                                return currentVal !== initialSettingsState[s.id];
                            });
                        };
                        if (id === 'k_hideNicknameXP' && !isCurrentlyChecked) {
                            showWarningDialog(performToggle);
                        }
                        else {
                            performToggle();
                        }
                    });
                });
                kTab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const allTabs = ulMenu.querySelectorAll('.SettingsMenuComponentStyle-menuItemOptions:not(#kaspersky-tab)');
                    allTabs.forEach(t => t.classList.remove('SettingsMenuComponentStyle-activeItemOptions'));
                    kTab.classList.add('SettingsMenuComponentStyle-activeItemOptions');
                    ulMenu.classList.add('kasp-hide-native-slider');
                    const nativeContent = mainBlock.querySelector('.SettingsComponentStyle-containerBlock');
                    if (nativeContent)
                        nativeContent.style.display = 'none';
                    kContent.classList.remove('kasp-hidden');
                });
                ulMenu.addEventListener('click', (e) => {
                    const target = e.target;
                    const clickedTab = target.closest('.SettingsMenuComponentStyle-menuItemOptions');
                    if (clickedTab && clickedTab.id !== 'kaspersky-tab' && !clickedTab.classList.contains('SettingsMenuComponentStyle-slideMenuOptions')) {
                        kTab.classList.remove('SettingsMenuComponentStyle-activeItemOptions');
                        ulMenu.classList.remove('kasp-hide-native-slider');
                        kContent.classList.add('kasp-hidden');
                        const nativeContent = mainBlock.querySelector('.SettingsComponentStyle-containerBlock');
                        if (nativeContent)
                            nativeContent.style.display = '';
                    }
                });
            },
            onClose: () => {
                const tooltip = document.getElementById('kaspersky-reload-tooltip');
                if (tooltip)
                    tooltip.classList.add('kasp-hidden');
                if (needsReload)
                    window.location.reload();
            }
        };
    })();
    const modules = {
        customPaints: (() => {
            let initialized = false;
            function normalizeText(text) {
                if (!text)
                    return "";
                return text.toLowerCase().replace(/ё/g, 'е');
            }
            function applySearch() {
                if (!DataLoader.isReady())
                    return;
                const input = document.querySelector('.kasp-search-wrapper input');
                if (!input)
                    return;
                const rawQuery = input.value.trim();
                const queryWords = normalizeText(rawQuery).split(/\s+/).filter(word => word.length > 0);
                const items = document.querySelectorAll('.kasp-paints-container .garage-item');
                items.forEach(itemEl => {
                    const item = itemEl;
                    if (queryWords.length === 0) {
                        item.style.display = '';
                        return;
                    }
                    const imgElement = item.querySelector('.GarageItemComponentStyle-mainImg');
                    if (!imgElement)
                        return;
                    const src = imgElement.getAttribute('src');
                    if (!src)
                        return;
                    const paintInfo = DataLoader.getPaint(src);
                    let isMatch = false;
                    if (paintInfo) {
                        const combinedNames = normalizeText(paintInfo.ru + " " + paintInfo.en);
                        isMatch = queryWords.every(word => combinedNames.includes(word));
                    }
                    item.style.display = isMatch ? '' : 'none';
                });
                const columns = document.querySelectorAll('.kasp-paints-container > div');
                columns.forEach(colEl => {
                    const col = colEl;
                    const visibleItems = Array.from(col.querySelectorAll('.garage-item')).filter(i => i.style.display !== 'none');
                    col.style.display = visibleItems.length === 0 ? 'none' : '';
                });
            }
            function addSearchInput() {
                const captionContainer = document.querySelector('.PaintsCollectionComponentStyle-captionPaint');
                if (!captionContainer)
                    return;
                const parentBlock = captionContainer.closest('.PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory');
                if (!parentBlock || parentBlock.querySelector('.kasp-search-wrapper'))
                    return;
                const itemsContainer = document.querySelector('.ListItemsComponentStyle-itemsContainer');
                if (itemsContainer) {
                    itemsContainer.classList.add('kasp-paints-container');
                }
                const searchWrapper = document.createElement('div');
                searchWrapper.className = 'kasp-search-wrapper';
                const searchContainer = document.createElement('div');
                searchContainer.className = 'kasp-SearchInputComponentStyle-search';
                const searchInputDiv = document.createElement('div');
                searchInputDiv.className = 'kasp-SearchInputComponentStyle-searchInput';
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = state.lang === 'RU' ? 'Найти' : 'Search';
                input.className = '-normal';
                input.addEventListener('input', applySearch);
                const searchIcon = document.createElement('div');
                searchIcon.className = 'kasp-search-icon';
                searchInputDiv.appendChild(input);
                searchInputDiv.appendChild(searchIcon);
                searchContainer.appendChild(searchInputDiv);
                searchWrapper.appendChild(searchContainer);
                parentBlock.appendChild(searchWrapper);
            }
            return () => {
                if (!utils.getSetting('k_paints', false))
                    return;
                if (state.currentScreen !== 'garage')
                    return;
                if (!initialized) {
                    initialized = true;
                }
                addSearchInput();
                const input = document.querySelector('.kasp-search-wrapper input');
                if (input && input.value.trim() !== '') {
                    applySearch();
                }
            };
        })(),
        augmentSpecs: (() => {
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
                if (!items || items.length === 0)
                    return `<li>${t[lang].empty}</li>`;
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
                if (!utils.getSetting('k_augments', false))
                    return;
                let hoverTooltip = document.getElementById('kasp-specs-tooltip');
                if (!hoverTooltip) {
                    hoverTooltip = document.createElement('div');
                    hoverTooltip.id = 'kasp-specs-tooltip';
                    document.body.appendChild(hoverTooltip);
                }
                const updateTooltipPos = (e) => {
                    if (!hoverTooltip)
                        return;
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
                    if (!card)
                        return;
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
                            if (!deviceData)
                                return;
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
                const cardsImgs = document.querySelectorAll('img.SkinCellStyle-iconCell');
                cardsImgs.forEach(img => {
                    applyButtonToCard(img.parentElement, img.src);
                });
                const containerImageBlocks = document.querySelectorAll('.RewardCardComponentStyle-imageBlock');
                containerImageBlocks.forEach(block => {
                    if (block.closest('.ContainersComponentStyle-possibleRewardsBlock'))
                        return;
                    const card = block.parentElement;
                    const imageDiv = block.querySelector('div[class*="-backgroundImageContain"]');
                    if (!imageDiv || !card)
                        return;
                    const bgImage = window.getComputedStyle(imageDiv).backgroundImage;
                    const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                    if (match && match[1]) {
                        applyButtonToCard(card, match[1]);
                    }
                });
            };
            function updateLiveStats() {
                if (!utils.getSetting('k_augments', false))
                    return;
                document.querySelectorAll('.custom-live-stat').forEach(el => el.remove());
                document.querySelectorAll('.hidden-by-script').forEach(el => {
                    const htmlEl = el;
                    htmlEl.classList.remove('hidden-by-script');
                    htmlEl.style.display = '';
                });
                const deviceImg = document.querySelector('.DeviceButtonComponentStyle-deviceIcon');
                if (!deviceImg)
                    return;
                const deviceData = DataLoader.getDevice(deviceImg.src);
                if (!deviceData || !deviceData.modifiers)
                    return;
                const allSpans = Array.from(document.querySelectorAll('span')).filter(s => !s.classList.contains('custom-live-stat'));
                allSpans.forEach(nameSpan => {
                    const text = nameSpan.textContent?.trim().toLowerCase() || '';
                    let matchedTag = null;
                    for (const [tag, translations] of Object.entries(STAT_DICT)) {
                        const allVariants = [].concat(translations.RU, translations.EN).filter(Boolean).map(s => s.toLowerCase());
                        if (allVariants.includes(text)) {
                            matchedTag = tag;
                            break;
                        }
                    }
                    if (matchedTag && deviceData.modifiers && (matchedTag in deviceData.modifiers)) {
                        const multiplier = deviceData.modifiers[matchedTag];
                        const valueSpan = nameSpan.parentElement?.nextElementSibling;
                        if (valueSpan && valueSpan.tagName === 'SPAN' && !valueSpan.classList.contains('hidden-by-script')) {
                            const cleanStr = valueSpan.innerText.replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
                            const origNumber = parseFloat(cleanStr);
                            if (!isNaN(origNumber)) {
                                let newVal = (matchedTag === 'WEIGHT' && multiplier >= 10) ? multiplier : origNumber * multiplier;
                                let formattedVal = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                                formattedVal = formattedVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                                let isBuff = multiplier > 1;
                                if (['RELOAD'].includes(matchedTag))
                                    isBuff = multiplier < 1;
                                if (matchedTag === 'WEIGHT' && multiplier < origNumber)
                                    isBuff = false;
                                const color = isBuff ? '#00ff38' : '#fe6666';
                                valueSpan.classList.add('hidden-by-script');
                                valueSpan.style.display = 'none';
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
                if (updateQueued)
                    return;
                updateQueued = true;
                requestAnimationFrame(() => {
                    updateQueued = false;
                    if (!utils.getSetting('k_augments', false))
                        return;
                    const isGarage = state.currentScreen === 'garage';
                    const isContainers = !!document.querySelector('.ContainerInfoComponentStyle-lootBoxContainer');
                    if (!isGarage && !isContainers)
                        return;
                    injectButtons();
                    updateLiveStats();
                });
            };
            return () => {
                if (!utils.getSetting('k_augments', false))
                    return;
                if (!initialized) {
                    initialized = true;
                    const forceHideTooltip = () => {
                        const hoverTooltip = document.getElementById('kasp-specs-tooltip');
                        if (hoverTooltip)
                            hoverTooltip.style.display = 'none';
                    };
                    window.addEventListener('keydown', (e) => {
                        if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                                return;
                            forceHideTooltip();
                        }
                    }, true);
                    window.addEventListener('mousedown', (e) => {
                        if (e.button === 3 || e.button === 4) {
                            forceHideTooltip();
                        }
                    }, true);
                }
                const isGarage = state.currentScreen === 'garage';
                const isContainers = !!document.querySelector('.ContainerInfoComponentStyle-lootBoxContainer');
                const loadingScreen = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
                if (loadingScreen || (!isGarage && !isContainers)) {
                    const hoverTooltip = document.getElementById('kasp-specs-tooltip');
                    if (hoverTooltip)
                        hoverTooltip.style.display = 'none';
                }
                if (isGarage || isContainers) {
                    scheduleUpdate();
                }
            };
        })(),
        customPlayButton: (() => {
            let initialized = false;
            let buttonsCreated = false;
            let autoQueueState = 0;
            let targetMode = null;
            let lastSearchingState = null;
            let failSafeTimer = null;
            const BUTTON_WIDTH = 3.5;
            const ROW_GAP = 0.5;
            const BUTTONS_COUNT = 7;
            const MAIN_WIDTH = (BUTTON_WIDTH * BUTTONS_COUNT) + (ROW_GAP * (BUTTONS_COUNT - 1));
            const WIDE_BUTTON_WIDTH = (MAIN_WIDTH - ROW_GAP) / 2;
            const MAIN_HEIGHT = 8.5;
            const BUTTON_HEIGHT = 3;
            const TOTAL_BG_HEIGHT = MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP + BUTTON_HEIGHT;
            const BG_URL = chrome.runtime.getURL("assets/playButton.png");
            const LOCK_ICON_URL = 'https://s.eu.tankionline.com/static/images/lockButtonPlay.4bb62c08.svg';
            const quickBattleMode = { names: ['БЫСТРЫЙ БОЙ', 'QUICK BATTLE', 'ИГРАТЬ', 'PLAY'], isDirect: true };
            const wideModes = [
                { labels: { RU: 'PRO-БИТВЫ', EN: 'PRO BATTLES' }, names: ['PRO-БИТВЫ', 'PRO BATTLES'], icon: 'https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg', isDirect: true },
                { labels: { RU: 'СПЕЦРЕЖИМ', EN: 'FESTIVE MODE' }, names: ['Специальный режим', 'Festive mode'], icon: 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg', isDirect: true }
            ];
            const modes = [
                { icon: 'https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg', labels: { RU: 'КОМАНДНЫЙ БОЙ', EN: 'TEAM DEATHMATCH' }, names: ['КОМАНДНЫЙ БОЙ', 'TEAM DEATHMATCH'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg', labels: { RU: 'КОНТРОЛЬ ТОЧЕК', EN: 'CONTROL POINTS' }, names: ['КОНТРОЛЬ ТОЧЕК', 'CONTROL POINTS'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg', labels: { RU: 'ЗАХВАТ ФЛАГА', EN: 'CAPTURE THE FLAG' }, names: ['ЗАХВАТ ФЛАГА', 'CAPTURE THE FLAG'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg', labels: { RU: 'ОСАДА', EN: 'SIEGE' }, names: ['Осада', 'SIEGE'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg', labels: { RU: 'ДЖАГГЕРНАУТ', EN: 'JUGGERNAUT' }, names: ['ДЖАГГЕРНАУТ', 'JUGGERNAUT'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg', labels: { RU: 'РЕГБИ', EN: 'RUGBY' }, names: ['РЕГБИ', 'RUGBY'], isDirect: false },
                { icon: 'https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg', labels: { RU: 'ШТУРМ', EN: 'ASSAULT' }, names: ['ШТУРМ', 'ASSAULT'], isDirect: false }
            ];
            const modesButtonNames = ['РЕЖИМЫ', 'MODES'];
            function isSearching() {
                return !!document.querySelector('.MainScreenComponentStyle-disabledButtonPlay');
            }
            function simulateClick(el) {
                if (!el)
                    return false;
                el.click();
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                return true;
            }
            function matchText(text, names) {
                const upper = text.trim().toUpperCase();
                return names.some(n => upper === n.toUpperCase());
            }
            function clickSpecificCard(modeNames) {
                const allCards = document.querySelectorAll('.BattlePickComponentStyle-commonStyleBlock, .blockCard, [class*="commonStyleBlock"]');
                for (const card of Array.from(allCards)) {
                    const h2 = card.querySelector('h2');
                    if (h2 && matchText(h2.textContent || '', modeNames))
                        return simulateClick(card);
                }
                return false;
            }
            function processAutoQueue() {
                if (autoQueueState === 0 || !targetMode)
                    return;
                if (autoQueueState === 1) {
                    if (targetMode.isDirect) {
                        if (clickSpecificCard(targetMode.names)) {
                            autoQueueState = 0;
                            targetMode = null;
                            document.body.classList.remove('kasp-autoqueue-active');
                        }
                    }
                    else {
                        if (clickSpecificCard(modesButtonNames))
                            autoQueueState = 2;
                    }
                }
                else if (autoQueueState === 2) {
                    if (clickSpecificCard(targetMode.names)) {
                        autoQueueState = 0;
                        targetMode = null;
                        document.body.classList.remove('kasp-autoqueue-active');
                    }
                }
            }
            function startAutoQueue(modeData) {
                if (isSearching())
                    return;
                targetMode = modeData;
                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer');
                if (playButton && !playButton.classList.contains('MainScreenComponentStyle-disabledButtonPlay')) {
                    autoQueueState = 1;
                    document.body.classList.add('kasp-autoqueue-active');
                    if (failSafeTimer)
                        window.clearTimeout(failSafeTimer);
                    failSafeTimer = window.setTimeout(() => {
                        autoQueueState = 0;
                        document.body.classList.remove('kasp-autoqueue-active');
                    }, 1500);
                    simulateClick(playButton);
                }
            }
            function handleModeHotkey(e) {
                if (e.repeat)
                    return;
                if (e.ctrlKey || e.altKey || e.metaKey)
                    return;
                const ae = document.activeElement;
                if (ae && (ae.tagName === 'INPUT' ||
                    ae.tagName === 'TEXTAREA' ||
                    ae.tagName === 'SELECT' ||
                    ae.isContentEditable))
                    return;
                if (state.currentScreen !== 'lobby' && state.currentScreen !== 'loading')
                    return;
                if (!utils.getSetting('k_ext_btn', false))
                    return;
                if (isSearching())
                    return;
                if (autoQueueState !== 0)
                    return;
                if (document.querySelector('.DialogContainerComponentStyle-container'))
                    return;
                let handled = false;
                if (e.code === 'Space') {
                    startAutoQueue(quickBattleMode);
                    handled = true;
                }
                else if (e.code === 'ShiftLeft') {
                    startAutoQueue(wideModes[1]);
                    handled = true;
                }
                else if (e.code === 'ShiftRight') {
                    startAutoQueue(wideModes[0]);
                    handled = true;
                }
                else {
                    const m = e.code.match(/^Digit([1-7])$/) || e.code.match(/^Numpad([1-7])$/);
                    if (m) {
                        const idx = parseInt(m[1], 10) - 1;
                        const mode = modes[idx];
                        if (mode) {
                            startAutoQueue(mode);
                            handled = true;
                        }
                    }
                }
                if (handled) {
                    e.preventDefault();
                }
            }
            function syncButtonStates(force = false) {
                const searching = isSearching();
                if (!force && searching === lastSearchingState)
                    return;
                lastSearchingState = searching;
                const currentLang = state.lang;
                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer');
                if (playButton) {
                    const bgLayer = playButton.querySelector('.custom-main-bg-layer');
                    const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton);
                    let customText = innerBtn.querySelector('.custom-main-text');
                    let lockDiv = innerBtn.querySelector('.main-lock-icon');
                    if (searching) {
                        playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                        playButton.style.cursor = 'default';
                        if (bgLayer)
                            bgLayer.style.filter = 'brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)';
                        if (customText)
                            customText.style.display = 'none';
                        if (!lockDiv) {
                            lockDiv = document.createElement('div');
                            lockDiv.className = 'main-lock-icon';
                            lockDiv.style.cssText = `width: 2.625em; height: 2.8125em; background-color: #a7a7a7; -webkit-mask-image: url(${LOCK_ICON_URL}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${LOCK_ICON_URL}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; z-index: 2; position: relative;`;
                            innerBtn.appendChild(lockDiv);
                        }
                        else {
                            lockDiv.style.display = 'block';
                            lockDiv.style.backgroundColor = '#868686';
                        }
                    }
                    else {
                        playButton.style.boxShadow = 'rgba(254, 255, 254, 0.25) 0 0 0 0.0625em';
                        playButton.style.cursor = 'pointer';
                        if (bgLayer)
                            bgLayer.style.filter = 'none';
                        if (lockDiv)
                            lockDiv.style.display = 'none';
                        if (customText) {
                            customText.style.display = 'flex';
                            const targetText = currentLang === 'RU' ? 'БЫСТРЫЙ БОЙ' : 'QUICK BATTLE';
                            if (customText.textContent !== targetText)
                                customText.textContent = targetText;
                        }
                    }
                }
                document.querySelectorAll('.wide-mode-btn-text').forEach(spanEl => {
                    const span = spanEl;
                    const modeIndex = parseInt(span.dataset.index || '0', 10);
                    if (wideModes[modeIndex])
                        span.textContent = wideModes[modeIndex].labels[currentLang];
                });
                const quickWrapper = document.getElementById('quick-play-wrapper');
                if (quickWrapper) {
                    quickWrapper.querySelectorAll('.custom-mode-button').forEach(btnEl => {
                        const btn = btnEl;
                        const bgLayer = btn.querySelector('.custom-btn-bg-layer');
                        const iconDiv = btn.querySelector('.mode-icon-el');
                        const textSpan = btn.querySelector('.wide-mode-btn-text');
                        if (searching) {
                            btn.style.pointerEvents = 'none';
                            btn.style.cursor = 'default';
                            btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                            if (bgLayer)
                                bgLayer.style.filter = 'brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)';
                            if (iconDiv)
                                iconDiv.style.backgroundColor = '#a7a7a7';
                            if (textSpan)
                                textSpan.style.color = '#a7a7a7';
                        }
                        else {
                            btn.style.pointerEvents = 'auto';
                            btn.style.cursor = 'pointer';
                            btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em';
                            if (bgLayer)
                                bgLayer.style.filter = 'none';
                            if (iconDiv)
                                iconDiv.style.backgroundColor = '#ffffff';
                            if (textSpan)
                                textSpan.style.color = '#ffffff';
                        }
                    });
                }
            }
            function createQuickButtons(playButton) {
                if (!playButton || buttonsCreated)
                    return;
                buttonsCreated = true;
                const currentLang = state.lang;
                const quickWrapper = document.createElement('div');
                quickWrapper.id = 'quick-play-wrapper';
                quickWrapper.style.cssText = `width: ${MAIN_WIDTH}em; display: flex; flex-direction: column; gap: ${ROW_GAP}em; margin-top: ${ROW_GAP}em; position: relative; z-index: 10; box-sizing: border-box; flex-shrink: 0;`;
                const row2 = document.createElement('div');
                row2.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
                const yOffsetRow2 = -(MAIN_HEIGHT + ROW_GAP);
                wideModes.forEach((mode, index) => {
                    const el = document.createElement('div');
                    el.className = 'custom-mode-button';
                    const xOffset = -index * (WIDE_BUTTON_WIDTH + ROW_GAP);
                    el.style.cssText = `width: ${WIDE_BUTTON_WIDTH}em; height: 100%; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
                    const bgLayer = document.createElement('div');
                    bgLayer.className = 'custom-btn-bg-layer';
                    bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow2}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                    el.appendChild(bgLayer);
                    const contentWrapper = document.createElement('div');
                    contentWrapper.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.6em; pointer-events: none; position: relative; z-index: 2;';
                    const img = document.createElement('div');
                    img.className = 'mode-icon-el';
                    img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
                    const text = document.createElement('span');
                    text.className = 'wide-mode-btn-text';
                    text.dataset.index = index.toString();
                    text.textContent = mode.labels[currentLang];
                    text.style.cssText = 'font-size: 1.2em; font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium; transition: color 0.2s ease-in-out;';
                    contentWrapper.appendChild(img);
                    contentWrapper.appendChild(text);
                    el.appendChild(contentWrapper);
                    el.addEventListener('mouseenter', () => { if (!isSearching())
                        el.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; });
                    el.addEventListener('mouseleave', () => { if (!isSearching())
                        el.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; });
                    el.addEventListener('click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
                    row2.appendChild(el);
                });
                const row3 = document.createElement('div');
                row3.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
                const yOffsetRow3 = -(MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP);
                modes.forEach((mode, index) => {
                    const el = document.createElement('div');
                    el.className = 'custom-mode-button';
                    const xOffset = -index * (BUTTON_WIDTH + ROW_GAP);
                    el.style.cssText = `width: ${BUTTON_WIDTH}em; height: 100%; flex-shrink: 0; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
                    const bgLayer = document.createElement('div');
                    bgLayer.className = 'custom-btn-bg-layer';
                    bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow3}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                    el.appendChild(bgLayer);
                    const img = document.createElement('div');
                    img.className = 'mode-icon-el';
                    img.title = mode.labels[currentLang];
                    img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; position: relative; z-index: 2; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
                    el.appendChild(img);
                    el.addEventListener('mouseenter', () => { if (!isSearching())
                        el.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; });
                    el.addEventListener('mouseleave', () => { if (!isSearching())
                        el.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; });
                    el.addEventListener('click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
                    row3.appendChild(el);
                });
                quickWrapper.appendChild(row2);
                quickWrapper.appendChild(row3);
                if (playButton.parentElement)
                    playButton.parentElement.appendChild(quickWrapper);
            }
            function applyStyles(playButton) {
                const container = (playButton.closest('div[class*="-displayFlex"]') || playButton.parentElement?.parentElement);
                const mainMenu = document.querySelector('.MainScreenComponentStyle-blockMainMenu');
                if (container) {
                    container.style.marginLeft = '5em';
                    container.style.height = 'auto';
                    container.style.marginTop = '10em';
                    container.style.width = '31.25em';
                    container.style.flexDirection = 'column';
                    container.style.alignItems = 'flex-start';
                    container.style.overflow = 'visible';
                    container.style.zIndex = '5';
                    container.style.position = 'relative';
                }
                if (playButton) {
                    playButton.style.width = `${MAIN_WIDTH}em`;
                    playButton.style.height = `${MAIN_HEIGHT}em`;
                    playButton.style.position = 'relative';
                    playButton.style.overflow = 'hidden';
                    playButton.style.borderRadius = '0.5rem';
                    playButton.style.transition = 'box-shadow 0.2s ease-in-out, opacity 0.2s ease-in';
                    playButton.addEventListener('mouseenter', () => { if (!isSearching())
                        playButton.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; });
                    playButton.addEventListener('mouseleave', () => { if (!isSearching())
                        playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; });
                    const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton);
                    innerBtn.style.backgroundImage = 'none';
                    innerBtn.classList.add('custom-inner-btn');
                    let bgLayer = innerBtn.querySelector('.custom-main-bg-layer');
                    if (!bgLayer) {
                        bgLayer = document.createElement('div');
                        bgLayer.className = 'custom-main-bg-layer';
                        bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: 0em 0em; background-repeat: no-repeat; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                        innerBtn.insertBefore(bgLayer, innerBtn.firstChild);
                    }
                    let customText = innerBtn.querySelector('.custom-main-text');
                    if (!customText) {
                        customText = document.createElement('div');
                        customText.className = 'custom-main-text';
                        customText.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 2.75em; font-weight: 500; color: #ffffff; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-transform: uppercase; transition: color 0.2s ease-in-out; pointer-events: none;`;
                        innerBtn.appendChild(customText);
                    }
                    if (!playButton.dataset.overridden) {
                        playButton.addEventListener('click', (e) => {
                            if (e.isTrusted && !isSearching()) {
                                targetMode = quickBattleMode;
                                autoQueueState = 1;
                            }
                        });
                    }
                }
                if (mainMenu)
                    mainMenu.style.marginTop = '1em';
                createQuickButtons(playButton);
                playButton.dataset.overridden = 'true';
                syncButtonStates(true);
            }
            return () => {
                if (!utils.getSetting('k_ext_btn', false))
                    return;
                if (state.currentScreen === 'battle')
                    return;
                if (!initialized) {
                    initialized = true;
                    utils.injectStyle(`
                        .MainScreenComponentStyle-playButtonContainer div[class*="ksc-"],
                        .MainScreenComponentStyle-playButtonContainer [class*="lock"]:not(.main-lock-icon),
                        .MainScreenComponentStyle-playButtonContainer img[src*="lock"] { display: none !important; }
                        .custom-inner-btn > *:not(.custom-main-bg-layer):not(.main-lock-icon):not(.custom-main-text) { display: none !important; }
                        .MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"]) { opacity: 0 !important; pointer-events: none !important; }
                        
                        body.kasp-autoqueue-active [class*="BattlePickComponentStyle"],
                        body.kasp-autoqueue-active [class*="blockCard"],
                        body.kasp-autoqueue-active [class*="commonStyleBlock"] { 
                            opacity: 0 !important; visibility: hidden !important; transition: none !important; animation: none !important;
                        }
                    `, 'kasp-playbtn-styles');
                    document.addEventListener('keydown', handleModeHotkey);
                    window.setInterval(() => {
                        if (autoQueueState !== 0)
                            processAutoQueue();
                    }, 50);
                }
                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"])');
                if (playButton) {
                    buttonsCreated = false;
                    applyStyles(playButton);
                }
                if (buttonsCreated) {
                    syncButtonStates();
                }
            };
        })(),
        customFriends: (() => {
            let initialized = false;
            const filtersConfig = [
                { url: "https://s.eu.tankionline.com/static/images/allPaints.741c65e1.svg", type: "all" },
                { url: "https://s.eu.tankionline.com/static/images/uncommon.ca77d7da.svg", type: "online" },
                { url: "https://s.eu.tankionline.com/static/images/iconCasualGray.3eea12e7.svg", type: "offline" },
                { url: "https://s.eu.tankionline.com/static/images/iconRareBlue.4e3c7303.svg", type: "clan" },
                { url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg", type: "purple" },
                { url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg", type: "yellow" },
                { url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg", type: "red" },
            ];
            const getCurrentNickname = () => {
                const userEl = document.querySelector('.UserInfoContainerStyle-userNameRank');
                if (!userEl)
                    return "Unknown";
                const text = userEl.innerText.trim();
                const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
                return cleanName || "Unknown";
            };
            const getCustomCategories = () => {
                const myNick = getCurrentNickname();
                try {
                    return JSON.parse(localStorage.getItem(`tankiCustomCategories_${myNick}`) || '{}');
                }
                catch (e) {
                    return {};
                }
            };
            const setCustomCategory = (friendNickname, colorType) => {
                const myNick = getCurrentNickname();
                if (myNick === "Unknown")
                    return;
                const cats = getCustomCategories();
                if (cats[friendNickname] === colorType) {
                    delete cats[friendNickname];
                }
                else {
                    cats[friendNickname] = colorType;
                }
                localStorage.setItem(`tankiCustomCategories_${myNick}`, JSON.stringify(cats));
                document.querySelectorAll('.custom-friends-sidebar').forEach(node => {
                    const sidebar = node;
                    const activeBtn = sidebar.querySelector('.custom-filter-btn.active');
                    if (activeBtn)
                        activeBtn.click();
                });
            };
            const getMyClanTag = () => {
                const userEl = (document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') || document.querySelector('.UserInfoContainerStyle-userNameRank'));
                if (!userEl)
                    return "";
                const text = userEl.innerText.trim();
                const match = text.match(/\[(.*?)\]/);
                return match ? match[0] : "";
            };
            const updateCardBadge = (el, isFriendsList) => {
                const cardText = el.innerText || "";
                const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
                const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
                const clanTag = getMyClanTag();
                const isClan = Boolean(clanTag && cardText.includes(clanTag));
                const cats = getCustomCategories();
                const customColor = cats[nickText];
                let rarityType = null;
                if (customColor) {
                    rarityType = customColor;
                }
                else if (isClan) {
                    rarityType = 'blue';
                }
                let badge = el.querySelector('.custom-rarity-badge');
                if (rarityType) {
                    if (!badge) {
                        badge = document.createElement('img');
                        badge.src = 'https://s.eu.tankionline.com/static/images/categoryRarities.04cb4010.svg';
                        badge.className = 'custom-rarity-badge';
                        el.appendChild(badge);
                    }
                    badge.className = `custom-rarity-badge rarity-${rarityType}`;
                    badge.style.display = '';
                }
                else {
                    if (badge) {
                        badge.style.display = 'none';
                    }
                }
            };
            const applyFilter = (scrollBlock, filterType) => {
                const clanTag = getMyClanTag();
                const cats = getCustomCategories();
                const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
                const items = scrollBlock.querySelectorAll(itemSelector);
                items.forEach(node => {
                    const el = node;
                    updateCardBadge(el, isFriendsList);
                    if (filterType === 'all') {
                        el.style.display = '';
                        return;
                    }
                    const cardText = el.innerText || "";
                    const textLower = cardText.toLowerCase();
                    const isOnline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-greenTextOnline') : (textLower.includes("в сети") || textLower.includes("online"));
                    const isOffline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-offline') : !isOnline;
                    const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
                    const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
                    let match = true;
                    if (filterType === 'online')
                        match = isOnline;
                    else if (filterType === 'offline')
                        match = isOffline;
                    else if (filterType === 'clan')
                        match = Boolean(clanTag && cardText.includes(clanTag));
                    else if (['purple', 'yellow', 'red'].includes(filterType)) {
                        match = (cats[nickText] === filterType);
                    }
                    el.style.display = match ? '' : 'none';
                });
            };
            const injectCategoriesMenu = (menu) => {
                if (menu.dataset.customCategoriesInjected === 'true')
                    return;
                menu.dataset.customCategoriesInjected = 'true';
                const rankItem = menu.querySelector('.ContextMenuStyle-menuItemRank');
                if (!rankItem)
                    return;
                const span = Array.from(rankItem.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
                if (!span)
                    return;
                const nickname = span.innerText.trim();
                const row = document.createElement('div');
                row.className = 'custom-category-row';
                const cats = getCustomCategories();
                const currentColor = cats[nickname];
                const customButtons = [
                    { type: 'purple', url: 'https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg' },
                    { type: 'yellow', url: 'https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg' },
                    { type: 'red', url: 'https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg' }
                ];
                customButtons.forEach(c => {
                    const btn = document.createElement('div');
                    btn.className = `custom-category-menu-btn ${currentColor === c.type ? 'active' : ''}`;
                    btn.innerHTML = `<img src="${c.url}">`;
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        setCustomCategory(nickname, c.type);
                        row.querySelectorAll('.custom-category-menu-btn').forEach(b => b.classList.remove('active'));
                        const newCats = getCustomCategories();
                        if (newCats[nickname] === c.type) {
                            btn.classList.add('active');
                        }
                    };
                    row.appendChild(btn);
                });
                menu.appendChild(row);
                requestAnimationFrame(() => {
                    const rect = menu.getBoundingClientRect();
                    const overflow = rect.bottom - window.innerHeight;
                    if (overflow > 0) {
                        const currentTop = parseFloat(menu.style.top) || rect.top;
                        menu.style.top = `${currentTop - overflow - 8}px`;
                    }
                });
            };
            const setupSidebar = (scrollBlock) => {
                if (scrollBlock.dataset.sidebarInjected === 'true')
                    return;
                scrollBlock.dataset.sidebarInjected = 'true';
                const isFriends = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                if (isFriends) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'custom-friends-wrapper';
                    wrapper.style.cssText = 'position: relative; width: 72.375em; margin: 0 auto; box-sizing: border-box;';
                    if (scrollBlock.parentNode) {
                        scrollBlock.parentNode.insertBefore(wrapper, scrollBlock);
                    }
                    wrapper.appendChild(scrollBlock);
                    const sidebar = document.createElement('div');
                    sidebar.className = 'custom-friends-sidebar sidebar-friends';
                    filtersConfig.forEach((config, index) => {
                        const btn = document.createElement('div');
                        btn.className = 'custom-filter-btn';
                        if (index === 0)
                            btn.classList.add('active');
                        const img = document.createElement('img');
                        img.src = config.url;
                        btn.addEventListener('click', () => {
                            sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            applyFilter(scrollBlock, config.type);
                        });
                        btn.appendChild(img);
                        sidebar.appendChild(btn);
                    });
                    wrapper.appendChild(sidebar);
                }
                else {
                    const parent = scrollBlock.parentNode;
                    if (!parent)
                        return;
                    if (window.getComputedStyle(parent).position === 'static') {
                        parent.style.position = 'relative';
                    }
                    const sidebar = document.createElement('div');
                    sidebar.className = 'custom-friends-sidebar sidebar-invites';
                    filtersConfig.forEach((config, index) => {
                        const btn = document.createElement('div');
                        btn.className = 'custom-filter-btn';
                        if (index === 0)
                            btn.classList.add('active');
                        const img = document.createElement('img');
                        img.src = config.url;
                        btn.addEventListener('click', () => {
                            sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            applyFilter(scrollBlock, config.type);
                        });
                        btn.appendChild(img);
                        sidebar.appendChild(btn);
                    });
                    parent.insertBefore(sidebar, scrollBlock);
                }
            };
            return () => {
                if (!utils.getSetting('k_friends', false))
                    return;
                if (state.currentScreen === 'battle')
                    return;
                if (!initialized) {
                    initialized = true;
                }
                const scrollBlocks = document.querySelectorAll('.FriendListComponentStyle-scrollCommunity, .InvitationWindowsComponentStyle-usersScroll');
                scrollBlocks.forEach(node => {
                    const scrollBlock = node;
                    if (scrollBlock.dataset.sidebarInjected !== 'true')
                        setupSidebar(scrollBlock);
                    const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                    const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
                    scrollBlock.querySelectorAll(itemSelector).forEach(el => {
                        updateCardBadge(el, isFriendsList);
                    });
                });
                const contextMenus = document.querySelectorAll('.ContextMenuStyle-menu');
                contextMenus.forEach(node => {
                    const menu = node;
                    if (menu.dataset.customCategoriesInjected !== 'true')
                        injectCategoriesMenu(menu);
                });
            };
        })(),
        garageButtons: (() => {
            const ICONS = {
                UPGRADE: "https://s.eu.tankionline.com/static/images/max_level.e31e0825.svg",
                MOUNT: "https://s.eu.tankionline.com/static/images/ic_mount.4175dc0c.svg",
                BUY: "https://s.eu.tankionline.com/static/images/buyButtonIcon.ca48e861.svg"
            };
            const processedSigs = new WeakMap();
            function getActiveTabCategory() {
                const activeMenu = document.querySelector('.MenuComponentStyle-mainMenuItem.-activeMenu');
                if (!activeMenu)
                    return 'default';
                const txt = activeMenu.textContent?.toLowerCase() || '';
                if (txt.includes('припас') || txt.includes('supplies'))
                    return 'supplies';
                if (txt.includes('краск') || txt.includes('paint'))
                    return 'paints';
                if (txt.includes('гранат') || txt.includes('grenade'))
                    return 'grenades';
                return 'default';
            }
            function computeButtonSig(btn, category) {
                const text = (btn.textContent || '').trim().slice(0, 80);
                const kidCount = btn.children.length;
                const hasIcon = btn.querySelector('[class*="-backgroundImage"]') ? 1 : 0;
                const hasKaspActive = btn.classList.contains('kasp-active-btn') ? 1 : 0;
                const hasKaspDisabled = btn.classList.contains('kasp-disabled-btn') ? 1 : 0;
                return `${text}|${category}|${kidCount}|${hasIcon}|${hasKaspActive}|${hasKaspDisabled}`;
            }
            function applyButtonFixes() {
                const buttons = document.querySelectorAll('.GarageCommonStyle-bigActionButton, .AlterationButtonStyle-commonButton');
                if (!buttons.length)
                    return;
                const currentCategory = getActiveTabCategory();
                buttons.forEach((btn) => {
                    const textHTML = btn.innerHTML.toLowerCase();
                    const textContent = btn.textContent?.toLowerCase() || '';
                    const hasHotKey = btn.querySelector('[class*="-commonBlockForHotKey"]');
                    const hasPrice = textHTML.includes('price') ||
                        textHTML.includes('кристал') ||
                        textHTML.includes('ruby') ||
                        textHTML.includes('discount') ||
                        textHTML.includes('tankoin');
                    const isActive = hasHotKey || hasPrice;
                    btn.classList.remove('kasp-hover-up', 'kasp-hover-down', 'kasp-btn-white', 'kasp-btn-gray');
                    let targetIcon = ICONS.UPGRADE;
                    let iconColor = isActive ? '#000000' : 'rgb(229, 229, 229)';
                    let hoverClass = 'kasp-hover-up';
                    let btnColorClass = 'kasp-btn-white';
                    const isEquipText = textContent.includes('space') || textContent.includes('установ') || textContent.includes('equip') || textContent.includes('mount') || textContent.includes('снять') || textContent.includes('unequip');
                    const isMaxedText = textContent.includes('завершено') || textContent.includes('maxed') || textContent.includes('upgraded') || textContent.includes('completed');
                    const isSuppliesContainer = btn.closest('.GarageSuppliesComponentStyle-containerButtons') !== null;
                    if (currentCategory === 'paints') {
                        targetIcon = ICONS.MOUNT;
                        hoverClass = 'kasp-hover-down';
                        btnColorClass = 'kasp-btn-gray';
                    }
                    else if (isEquipText) {
                        targetIcon = ICONS.MOUNT;
                        hoverClass = 'kasp-hover-down';
                        btnColorClass = 'kasp-btn-gray';
                    }
                    else if (isMaxedText) {
                        targetIcon = ICONS.UPGRADE;
                        hoverClass = 'kasp-hover-up';
                    }
                    else if (currentCategory === 'supplies' || isSuppliesContainer) {
                        targetIcon = ICONS.BUY;
                        hoverClass = 'kasp-hover-up';
                    }
                    else {
                        const parent = btn.closest('.TanksPartBaseComponentStyle-buttonsContainer');
                        const siblingsCount = parent ? parent.querySelectorAll('.GarageCommonStyle-bigActionButton').length : 1;
                        if (siblingsCount === 1) {
                            targetIcon = ICONS.BUY;
                            hoverClass = 'kasp-hover-up';
                        }
                        else {
                            targetIcon = ICONS.UPGRADE;
                            hoverClass = 'kasp-hover-up';
                        }
                    }
                    if (isActive) {
                        btn.classList.add('kasp-active-btn', btnColorClass, hoverClass);
                        btn.classList.remove('kasp-disabled-btn');
                    }
                    else {
                        btn.classList.add('kasp-disabled-btn');
                        btn.classList.remove('kasp-active-btn');
                    }
                    const iconDiv = btn.querySelector('[class*="-backgroundImage"]');
                    if (iconDiv) {
                        applyMask(iconDiv, targetIcon, iconColor);
                    }
                });
            }
            function applyMask(element, url, color) {
                element.style.setProperty('background-image', 'none', 'important');
                element.style.setProperty('background-color', color, 'important');
                element.style.setProperty('-webkit-mask-image', `url("${url}")`, 'important');
                element.style.setProperty('mask-image', `url("${url}")`, 'important');
                element.style.setProperty('-webkit-mask-size', 'contain', 'important');
                element.style.setProperty('mask-size', 'contain', 'important');
                element.style.setProperty('-webkit-mask-repeat', 'no-repeat', 'important');
                element.style.setProperty('mask-repeat', 'no-repeat', 'important');
                element.style.setProperty('-webkit-mask-position', 'center', 'important');
                element.style.setProperty('mask-position', 'center', 'important');
                element.style.setProperty('opacity', '1', 'important');
            }
            return () => {
                if (state.currentScreen !== 'garage')
                    return;
                const buttons = document.querySelectorAll('.GarageCommonStyle-bigActionButton, .AlterationButtonStyle-commonButton');
                if (!buttons.length)
                    return;
                const category = getActiveTabCategory();
                let needsWork = false;
                const currentSigs = [];
                for (let i = 0; i < buttons.length; i++) {
                    const sig = computeButtonSig(buttons[i], category);
                    currentSigs.push(sig);
                    if (processedSigs.get(buttons[i]) !== sig) {
                        needsWork = true;
                        break;
                    }
                }
                if (!needsWork)
                    return;
                applyButtonFixes();
                for (let i = 0; i < buttons.length; i++) {
                    processedSigs.set(buttons[i], computeButtonSig(buttons[i], category));
                }
            };
        })(),
        welcomeModal: (() => {
            const CURRENT_VERSION = chrome.runtime.getManifest().version;
            const STORAGE_KEY = 'kasp_last_version';
            let hasChecked = false;
            const t = {
                RU: {
                    version: `ВЕРСИЯ ${CURRENT_VERSION}`,
                    intro: `Огромное спасибо, что пользуетесь Kaspersky's Inventions! Мы ценим ваше внимание к проекту и с каждым обновлением будем радовать вас новыми функциями.`,
                    role1: `Идею создал`,
                    role2: `В создании участвовали`,
                    role3: `Качество оценивали`,
                    role4: `Помогали`,
                    outro: `Проект выражает им огромную благодарность!`,
                    close: `ЗАКРЫТЬ`
                },
                EN: {
                    version: `VERSION ${CURRENT_VERSION}`,
                    intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
                    role1: `Idea Created By`,
                    role2: `Co-created By`,
                    role3: `Quality Assessed By`,
                    role4: `Helped`,
                    outro: `The project expresses huge gratitude to them!`,
                    close: `CLOSE`
                }
            };
            async function showWelcomeModal() {
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
                const templateUrl = chrome.runtime.getURL('templates/welcome-modal.html');
                try {
                    const response = await fetch(templateUrl);
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    let html = await response.text();
                    html = html
                        .replace(/{{version}}/g, dict.version)
                        .replace(/{{intro}}/g, dict.intro)
                        .replace(/{{role1}}/g, dict.role1)
                        .replace(/{{role2}}/g, dict.role2)
                        .replace(/{{role3}}/g, dict.role3)
                        .replace(/{{role4}}/g, dict.role4)
                        .replace(/{{outro}}/g, dict.outro)
                        .replace(/{{close}}/g, dict.close);
                    const overlay = document.createElement('div');
                    overlay.id = 'kasp-welcome-overlay';
                    overlay.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0, 0, 0, 0.7); z-index: 99999;
                        display: flex; align-items: center; justify-content: center;
                        backdrop-filter: blur(3px);
                    `;
                    const dialog = document.createElement('div');
                    dialog.style.cssText = `
                        display: flex; flex-direction: column; align-items: stretch;
                        width: 45em; max-width: 90vw;
                        z-index: 60; box-shadow: rgba(0, 0, 0, 0.5) 0px 0.5em 2em 0px;
                        outline: rgba(255, 255, 255, 0.25) solid 0.063em;
                        padding: 2.5em; border-radius: 0.75em;
                        background: radial-gradient(100% 100% at 0% 0%, rgb(255 255 255 / 15%) 0%, rgb(0 0 0 / 95%) 100%), rgb(56 56 56);
                        font-family: BaseFont, FallbackFont, sans-serif; color: white;
                    `;
                    dialog.innerHTML = html;
                    overlay.appendChild(dialog);
                    document.body.appendChild(overlay);
                    const closeBtn = document.getElementById('kasp-welcome-close');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => {
                            overlay.remove();
                            localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
                        });
                    }
                }
                catch (error) {
                    console.error('[Kaspersky Inventions] Failed to load welcome modal template:', error);
                }
            }
            return () => {
                if (hasChecked)
                    return;
                const savedVersion = localStorage.getItem(STORAGE_KEY);
                if (savedVersion === CURRENT_VERSION) {
                    hasChecked = true;
                    return;
                }
                if (state.currentScreen === 'loading')
                    return;
                hasChecked = true;
                showWelcomeModal();
            };
        })(),
        hideNickname: (() => {
            let initialized = false;
            let cachedOriginalNick = null;
            function getHiddenText() {
                return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
            }
            function processNickElement(userNameElement) {
                const hiddenText = getHiddenText();
                const expectedClass = state.lang === 'RU' ? 'hidden-text-ru' : 'hidden-text';
                const hiddenSpan = userNameElement.querySelector('.hidden-text, .hidden-text-ru');
                if (!hiddenSpan) {
                    const originalName = cachedOriginalNick || userNameElement.textContent?.trim() || '';
                    if (originalName && originalName !== 'Скрыто' && originalName !== 'Hidden') {
                        cachedOriginalNick = originalName;
                    }
                    userNameElement.innerHTML = '';
                    const newSpan = document.createElement('span');
                    newSpan.className = expectedClass;
                    newSpan.textContent = hiddenText;
                    newSpan.setAttribute('data-tooltip', cachedOriginalNick || 'Player');
                    userNameElement.appendChild(newSpan);
                }
                else {
                    if (hiddenSpan.className !== expectedClass)
                        hiddenSpan.className = expectedClass;
                    if (hiddenSpan.textContent !== hiddenText)
                        hiddenSpan.textContent = hiddenText;
                    if (cachedOriginalNick && hiddenSpan.getAttribute('data-tooltip') !== cachedOriginalNick) {
                        hiddenSpan.setAttribute('data-tooltip', cachedOriginalNick);
                    }
                }
            }
            function processXpElement(xpContainer) {
                const hiddenText = getHiddenText();
                const expectedClass = state.lang === 'RU' ? 'hidden-xp-ru' : 'hidden-xp';
                const hiddenXpSpan = xpContainer.querySelector('.hidden-xp, .hidden-xp-ru');
                if (!hiddenXpSpan) {
                    const originalXp = xpContainer.textContent?.trim() || '';
                    xpContainer.innerHTML = '';
                    const newXpSpan = document.createElement('span');
                    newXpSpan.className = expectedClass;
                    newXpSpan.textContent = hiddenText;
                    newXpSpan.setAttribute('data-tooltip', originalXp || '0');
                    xpContainer.appendChild(newXpSpan);
                }
                else {
                    if (hiddenXpSpan.className !== expectedClass)
                        hiddenXpSpan.className = expectedClass;
                    const currentXpText = xpContainer.textContent?.trim() || '';
                    if (currentXpText && currentXpText !== hiddenText && currentXpText !== 'Скрыто' && currentXpText !== 'Hidden') {
                        hiddenXpSpan.setAttribute('data-tooltip', currentXpText);
                    }
                    if (hiddenXpSpan.textContent !== hiddenText)
                        hiddenXpSpan.textContent = hiddenText;
                }
            }
            function hideNicknameInTables() {
                if (!cachedOriginalNick) {
                    const userNameElement = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration');
                    if (userNameElement) {
                        const hiddenSpan = userNameElement.querySelector('.hidden-text, .hidden-text-ru');
                        cachedOriginalNick = hiddenSpan ? hiddenSpan.getAttribute('data-tooltip') : userNameElement.textContent?.trim() || null;
                    }
                }
                if (!cachedOriginalNick)
                    return;
                const hiddenText = getHiddenText();
                const tabContainer = document.querySelector('.BattleTabStatisticComponentStyle-containerInsideTeams');
                if (tabContainer) {
                    const tabSpans = tabContainer.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell span');
                    for (let i = 0; i < tabSpans.length; i++) {
                        const span = tabSpans[i];
                        if (span.textContent?.trim() === cachedOriginalNick && !span.hasAttribute('data-hidden-applied')) {
                            span.setAttribute('data-hidden-applied', 'true');
                            span.textContent = hiddenText;
                            span.style.color = '#ffffff';
                            span.style.fontWeight = '500';
                        }
                    }
                }
                const selfRow = document.getElementById('selfUserBg');
                if (selfRow) {
                    const resultSpans = selfRow.querySelectorAll('td[class*="col1"] span');
                    for (let i = 0; i < resultSpans.length; i++) {
                        const span = resultSpans[i];
                        const text = span.textContent?.trim() || '';
                        if (!span.hasAttribute('data-hidden-applied') && text !== '') {
                            if (text !== hiddenText && text !== 'Hidden' && text !== 'Скрыто') {
                                cachedOriginalNick = text;
                            }
                            span.setAttribute('data-hidden-applied', 'true');
                            span.textContent = hiddenText;
                            span.style.color = '#ffffff';
                            span.style.fontWeight = '500';
                        }
                    }
                }
            }
            return () => {
                if (!utils.getSetting('k_hideNicknameXP', false))
                    return;
                if (!initialized) {
                    initialized = true;
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Tab') {
                            setTimeout(hideNicknameInTables, 40);
                        }
                    });
                }
                const userName = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration');
                if (userName)
                    processNickElement(userName);
                const xp = document.querySelector('.UserInfoContainerStyle-progressValue');
                if (xp)
                    processXpElement(xp);
                hideNicknameInTables();
            };
        })(),
        hideCurrency: (() => {
            let initialized = false;
            function getHiddenText() {
                return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
            }
            function processSpan(span) {
                const text = span.textContent?.trim() || '';
                const targetText = getHiddenText();
                const parentElement = (span.closest('.HeaderCommonStyle-icons') || span.parentElement);
                if (text && text !== targetText && text !== 'Скрыто' && text !== 'Hidden' && /\d/.test(text)) {
                    span.dataset.originalValue = text;
                    span.textContent = targetText;
                    if (parentElement) {
                        parentElement.setAttribute('data-tooltip', text);
                    }
                }
                else if (span.dataset.originalValue && parentElement && !parentElement.hasAttribute('data-tooltip')) {
                    parentElement.setAttribute('data-tooltip', span.dataset.originalValue);
                }
                if (parentElement && !parentElement.classList.contains('currency-masked')) {
                    parentElement.classList.add('currency-masked');
                }
            }
            return () => {
                if (!utils.getSetting('k_hideCurrency', false))
                    return;
                if (state.currentScreen === 'battle')
                    return;
                if (!initialized) {
                    initialized = true;
                    window.setInterval(() => {
                        if (state.currentScreen === 'battle')
                            return;
                        const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
                        spans.forEach(node => processSpan(node));
                    }, 500);
                }
                const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
                spans.forEach(node => processSpan(node));
            };
        })(),
        customTrophies: (() => {
            let initialized = false;
            const STORAGE_KEY = 'kasp_trophies_favorites';
            const ICON_UNFAV = 'https://s.eu.tankionline.com/static/images/unfavoriteStar.0e39d67a.svg';
            const ICON_FAV = 'https://s.eu.tankionline.com/static/images/favoriteStar.1ce58570.svg';
            let trophyDictionary = {};
            let trophyDictionaryLoaded = false;
            async function loadTrophyDictionary() {
                if (trophyDictionaryLoaded)
                    return;
                try {
                    const response = await fetch(chrome.runtime.getURL('database/trophies.json'));
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    trophyDictionary = await response.json();
                    trophyDictionaryLoaded = true;
                }
                catch (error) {
                    console.error('[Kaspersky Inventions] Failed to load trophy dictionary:', error);
                    trophyDictionary = {};
                }
            }
            let cachedFavs = null;
            function getFavs() {
                if (cachedFavs)
                    return cachedFavs;
                try {
                    cachedFavs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                }
                catch {
                    cachedFavs = [];
                }
                return cachedFavs || [];
            }
            function saveFavs(favs) {
                cachedFavs = favs;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
            }
            function parseItem(rawText) {
                const lower = rawText.toLowerCase();
                for (const key in trophyDictionary) {
                    if (lower.includes(key)) {
                        const item = trophyDictionary[key];
                        return {
                            id: item.id,
                            name: state.lang === 'RU' ? item.ru : item.en,
                            type: item.type
                        };
                    }
                }
                return null;
            }
            function formatNumber(num) {
                return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            }
            function extractIcon(card) {
                const rewardDiv = card.querySelector('[class*="rewardsContainer"] [class*="-backgroundImageContain"]');
                if (rewardDiv) {
                    const bg = window.getComputedStyle(rewardDiv).backgroundImage;
                    const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
                    if (match)
                        return match[1];
                }
                return 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg';
            }
            function toggleFavorite(itemId, type, iconUrl, current, max) {
                let favs = getFavs();
                const idx = favs.findIndex(f => f.id === itemId);
                if (idx > -1) {
                    favs.splice(idx, 1);
                }
                else {
                    const count = favs.filter(f => f.type === type).length;
                    if (count >= 2)
                        return;
                    favs.push({ id: itemId, type, icon: iconUrl, current, max });
                }
                saveFavs(favs);
                const cards = document.querySelectorAll('.MainQuestComponentStyle-cardPlayCommon, .TableMainQuestComponentStyle-commonTableMainQuest, .MainQuestComponentStyle-cardPlay');
                if (cards.length > 0)
                    processGarageMissions(Array.from(cards));
            }
            function processGarageMissions(garageCards) {
                let favs = getFavs();
                let favsUpdated = false;
                const favTurrets = favs.filter(f => f.type === 'turret').length;
                const favHulls = favs.filter(f => f.type === 'hull').length;
                garageCards.forEach(card => {
                    const progressEl = card.querySelector('h4');
                    if (!progressEl)
                        return;
                    const rawText = card.textContent || '';
                    const itemInfo = parseItem(rawText);
                    if (!itemInfo)
                        return;
                    const isGrid = card.classList.contains('MainQuestComponentStyle-cardPlay');
                    card.style.position = 'relative';
                    if (isGrid) {
                        card.classList.add('card-type-grid');
                        card.classList.remove('card-type-list');
                    }
                    else {
                        card.classList.add('card-type-list');
                        card.classList.remove('card-type-grid');
                    }
                    const type = itemInfo.type;
                    const cleanProgress = progressEl.textContent?.replace(/\s|\u00A0/g, '') || '';
                    const parts = cleanProgress.split('/');
                    const currentPoints = parseInt(parts[0], 10) || 0;
                    const maxPoints = parseInt(parts[1], 10) || 5000000;
                    const favItem = favs.find(f => f.id === itemInfo.id);
                    if (favItem && favItem.current !== currentPoints) {
                        favItem.current = currentPoints;
                        favItem.max = maxPoints;
                        favsUpdated = true;
                    }
                    const limitReached = !favItem && ((type === 'turret' && favTurrets >= 2) || (type === 'hull' && favHulls >= 2));
                    let starContainer = card.querySelector('.PaintsCollectionComponentStyle-favoriteIconContainer');
                    if (!starContainer) {
                        starContainer = document.createElement('div');
                        starContainer.className = 'PaintsCollectionComponentStyle-favoriteIconContainer';
                        starContainer.innerHTML = `<img src="${favItem ? ICON_FAV : ICON_UNFAV}">`;
                        starContainer.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const iconUrl = extractIcon(card);
                            toggleFavorite(itemInfo.id, type, iconUrl, currentPoints, maxPoints);
                        });
                        card.appendChild(starContainer);
                    }
                    else {
                        const img = starContainer.querySelector('img');
                        const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
                        if (img && img.src !== expectedIcon)
                            img.src = expectedIcon;
                    }
                    if (limitReached)
                        starContainer.classList.add('star-limit-reached');
                    else
                        starContainer.classList.remove('star-limit-reached');
                });
                if (favsUpdated)
                    saveFavs(favs);
            }
            function processBattleResults(battleCards) {
                let favs = getFavs();
                let favsUpdated = false;
                battleCards.forEach(card => {
                    const textElements = card.querySelectorAll('.BattleResultQuestProgressComponentStyle-text');
                    if (textElements.length < 2)
                        return;
                    let rawText = '';
                    let rawProgress = '';
                    textElements.forEach(el => {
                        const text = el.textContent || '';
                        const style = el.getAttribute('style') || '';
                        if (text.includes(' / ')) {
                            if (!style.includes('opacity: 0'))
                                rawProgress = text;
                        }
                        else if (text.length > 15 && !text.includes('ВЫПОЛНЕНО') && !text.includes('COMPLETED')) {
                            rawText = text;
                        }
                    });
                    if (!rawText || !rawProgress)
                        return;
                    const itemInfo = parseItem(rawText);
                    if (!itemInfo)
                        return;
                    const cleanProgress = rawProgress.replace(/\s|\u00A0/g, '');
                    const parts = cleanProgress.split('/');
                    const currentPoints = parseInt(parts[0], 10) || 0;
                    const maxPoints = parseInt(parts[1], 10) || 5000000;
                    const favItem = favs.find(f => f.id === itemInfo.id);
                    if (favItem && favItem.current !== currentPoints) {
                        favItem.current = currentPoints;
                        favItem.max = maxPoints;
                        favsUpdated = true;
                    }
                });
                if (favsUpdated)
                    saveFavs(favs);
            }
            function createPanel() {
                const panel = document.createElement('div');
                panel.id = 'custom-trophy-panel';
                panel.className = 'custom-trophy-panel';
                const trophies = getFavs();
                trophies.sort((a, b) => {
                    if (a.type === 'turret' && b.type === 'hull')
                        return -1;
                    if (a.type === 'hull' && b.type === 'turret')
                        return 1;
                    return 0;
                });
                trophies.forEach(trophy => {
                    const percent = Math.min(100, Math.max(0, (trophy.current / trophy.max) * 100));
                    const match = Object.values(trophyDictionary).find(d => d.id === trophy.id);
                    const displayName = match ? (state.lang === 'RU' ? match.ru : match.en) : trophy.id;
                    const itemHTML = `
                        <div class="custom-trophy-item">
                            <img class="custom-trophy-icon" src="${trophy.icon}" alt="${displayName}">
                            <div class="custom-trophy-info">
                                <div class="custom-trophy-title">${displayName}</div>
                                <div class="custom-trophy-bar-bg">
                                    <div class="custom-trophy-bar-fill" style="width: ${percent}%;"></div>
                                </div>
                                <div class="custom-trophy-text">${formatNumber(trophy.current)} / ${formatNumber(trophy.max)}</div>
                            </div>
                        </div>
                    `;
                    panel.insertAdjacentHTML('beforeend', itemHTML);
                });
                return panel;
            }
            function updateInterface() {
                const challengesBlock = document.querySelector('.BattlePassLobbyComponentStyle-menuBattlePass');
                const panel = document.getElementById('custom-trophy-panel');
                if (challengesBlock) {
                    if (!panel && getFavs().length > 0 && challengesBlock.parentElement) {
                        challengesBlock.parentElement.appendChild(createPanel());
                    }
                }
                else {
                    if (panel)
                        panel.remove();
                }
                const cards = document.querySelectorAll('.MainQuestComponentStyle-cardPlayCommon, .TableMainQuestComponentStyle-commonTableMainQuest, .MainQuestComponentStyle-cardPlay');
                if (cards.length > 0)
                    processGarageMissions(Array.from(cards));
            }
            return async () => {
                if (!initialized) {
                    initialized = true;
                    await loadTrophyDictionary();
                }
                if (state.currentScreen === 'lobby' || state.currentScreen === 'garage') {
                    updateInterface();
                }
                else if (state.currentScreen === 'match_results') {
                    const battleCards = document.querySelectorAll('.BattleResultQuestProgressComponentStyle-container');
                    if (battleCards.length > 0)
                        processBattleResults(Array.from(battleCards));
                }
            };
        })(),
        autoUpgrade: (() => {
            let initialized = false;
            let isRunning = false;
            let upgradeQueue = 0;
            let unavailableRetries = 0;
            const MAX_UNAVAILABLE_RETRIES = 80;
            const RETRY_DELAY = 100;
            let upgraded = 0;
            let timer = null;
            let lastItemSignature = '';
            let isCategorySwitch = true;
            let categorySwitchTimeout = null;
            const DELAY = 30;
            function pressEnter() {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                });
                document.dispatchEvent(event);
                return true;
            }
            function isDialogOpen() {
                return !!document.querySelector('.DialogContainerComponentStyle-container');
            }
            function isRubyButton() {
                const dialog = document.querySelector('.DialogContainerComponentStyle-container');
                if (dialog) {
                    const headerText = dialog.querySelector('h1')?.textContent?.toLowerCase() || '';
                    if (headerText.includes('рубин') || headerText.includes('ruby'))
                        return true;
                }
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
                if (!btn)
                    return false;
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('за ') || text.includes('for ') || text.includes('рубин') || text.includes('ruby') || text.includes('получить') || text.includes('get'))
                    return true;
                const rubyImg = btn.querySelector('img[src*="rubyBlack"], img[src*="ruby"]');
                if (rubyImg)
                    return true;
                return false;
            }
            function hasNormalButton() {
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
                if (!btn)
                    return false;
                return !isRubyButton();
            }
            function clickConfirmButton() {
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }
            function clickCancel() {
                const buttons = document.querySelectorAll('.DialogContainerComponentStyle-container div');
                for (let i = 0; i < buttons.length; i++) {
                    const el = buttons[i];
                    const text = el.textContent?.trim().toLowerCase() || '';
                    if (text === 'отмена' || text === 'cancel') {
                        el.click();
                        return true;
                    }
                }
                const btn = document.querySelector('.DialogContainerComponentStyle-keyButton');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }
            function isCompleted() {
                const btns = document.querySelectorAll('.SquarePriceButtonComponentStyle-commonBlockButton');
                for (let i = 0; i < btns.length; i++) {
                    const btn = btns[i];
                    const span = btn.querySelector('span.-bold');
                    if (span) {
                        const text = span.textContent?.trim().toUpperCase() || '';
                        if (text === 'ЗАВЕРШЕНО' || text === 'COMPLETED')
                            return true;
                    }
                }
                return false;
            }
            function isUnavailableButton() {
                const btns = document.querySelectorAll('.SquarePriceButtonComponentStyle-commonBlockButton');
                for (let i = 0; i < btns.length; i++) {
                    const btn = btns[i];
                    if (btn.closest('.TanksPartBaseComponentStyle-marginTop'))
                        continue;
                    const text = (btn.textContent || '').toLowerCase();
                    if (text.includes('недоступно') || text.includes('unavailable'))
                        return true;
                }
                return false;
            }
            function isMaxLevel() {
                if (document.querySelector('.TanksPartBaseComponentStyle-marginTop .-buttonEstablished'))
                    return true;
                const titleNodes = document.querySelectorAll('.ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span, .MountedItemsStyle-tankPartNameContainer h1');
                for (let i = 0; i < titleNodes.length; i++) {
                    const text = titleNodes[i].textContent?.trim().toUpperCase() || '';
                    if (/(MK|МК)7[- ]?20/.test(text))
                        return true;
                    if (/(УР|LVL)[- ]?(20|45)/.test(text))
                        return true;
                    if (text.includes('MAX'))
                        return true;
                }
                const maxBtn = document.querySelector('.SquarePriceButtonComponentStyle-commonBlockButton h2');
                if (maxBtn && maxBtn.textContent?.trim().toUpperCase() === 'MAX')
                    return true;
                return false;
            }
            function shouldShowQuickButtons() {
                if (!utils.getSetting('k_auto_upgrade', false))
                    return false;
                if (isMaxLevel())
                    return false;
                if (isCompleted())
                    return false;
                const buttonsContainer = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                if (!buttonsContainer)
                    return false;
                const btns = buttonsContainer.querySelectorAll('.SquarePriceButtonComponentStyle-commonBlockButton');
                for (let i = 0; i < btns.length; i++) {
                    const btn = btns[i];
                    if (btn.closest('.TanksPartBaseComponentStyle-marginTop'))
                        continue;
                    const hotkey = btn.querySelector('.-commonBlockForHotKey');
                    if (hotkey && hotkey.textContent?.trim() === 'Enter') {
                        if (btn.classList.contains('-widthHeightButtonGarage')) {
                            const coinIcon = btn.querySelector('.GarageCommonStyle-iconCoinSmall');
                            if (coinIcon) {
                                const bgImage = window.getComputedStyle(coinIcon).backgroundImage;
                                if (!bgImage.includes('ruby'))
                                    return true;
                            }
                        }
                    }
                }
                return false;
            }
            function showConfirmDialog(count, callback) {
                const existing = document.getElementById('quick-upgrade-overlay');
                if (existing)
                    existing.remove();
                const lang = state.lang;
                const t = {
                    RU: { title: 'БЫСТРАЯ ПРОКАЧКА', textPre: 'Вы собираетесь купить улучшение на\u00A0', steps: ' шагов', maxSteps: 'максимум шагов', cancel: 'Отмена', buy: 'КУПИТЬ' },
                    EN: { title: 'FAST UPGRADE', textPre: 'You are about to buy an upgrade for\u00A0', steps: ' steps', maxSteps: 'max steps', cancel: 'Cancel', buy: 'BUY' }
                };
                const dict = t[lang] || t['EN'];
                const label = count === Infinity ? dict.maxSteps : `${count}${dict.steps}`;
                const overlay = document.createElement('div');
                overlay.id = 'quick-upgrade-overlay';
                overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;
                const dialog = document.createElement('div');
                dialog.id = 'quick-upgrade-dialog';
                dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75);`;
                const header = document.createElement('div');
                header.style.cssText = `display: flex; align-items: center; justify-content: space-between; background-color: transparent; width: 100%; position: relative; margin-bottom: 1.5em;`;
                const title = document.createElement('h1');
                title.textContent = dict.title;
                title.style.cssText = `font-size: 1.5em; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; margin: 0; padding: 0; line-height: 1.2; flex: 1;`;
                const closeBtn = document.createElement('div');
                closeBtn.style.cssText = `width: 1.5em; height: 1.5em; cursor: pointer; background-image: url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg); background-repeat: no-repeat; background-size: contain; background-position: center center; flex-shrink: 0; margin-left: 0.5em;`;
                closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundImage = 'url(https://s.eu.tankionline.com/static/images/deleteHoverModal.3aceb055.svg)'; });
                closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundImage = 'url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg)'; });
                header.appendChild(title);
                header.appendChild(closeBtn);
                const content = document.createElement('div');
                content.style.cssText = `display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; flex: 1; margin-bottom: 1.5em;`;
                const textLine = document.createElement('div');
                textLine.style.cssText = `display: flex; flex-direction: row; align-items: center; justify-content: center; flex-wrap: wrap;`;
                const textSpan = document.createElement('span');
                textSpan.textContent = dict.textPre;
                textSpan.style.cssText = `font-size: 1em; color: rgb(255, 255, 255); font-family: BaseFont, FallbackFont, sans-serif; line-height: 1.4;`;
                const countSpan = document.createElement('span');
                countSpan.textContent = label;
                countSpan.style.cssText = `font-size: 1em; color: rgb(255, 255, 0); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; line-height: 1.4;`;
                textLine.appendChild(textSpan);
                textLine.appendChild(countSpan);
                content.appendChild(textLine);
                const footer = document.createElement('div');
                footer.style.cssText = `background-color: transparent; width: 100%; display: flex; align-items: center; justify-content: center; gap: 1.25em;`;
                const cancelBtn = document.createElement('div');
                cancelBtn.textContent = dict.cancel;
                cancelBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgba(255, 255, 255, 0.15); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
                cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.borderColor = 'rgb(255, 255, 255)'; cancelBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
                cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.borderColor = 'transparent'; cancelBtn.style.boxShadow = 'none'; });
                const confirmBtn = document.createElement('div');
                confirmBtn.textContent = dict.buy;
                confirmBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgb(118, 255, 51); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(0, 25, 38); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
                confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.borderColor = 'rgb(255, 255, 255)'; confirmBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
                confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.borderColor = 'transparent'; confirmBtn.style.boxShadow = 'none'; });
                footer.appendChild(cancelBtn);
                footer.appendChild(confirmBtn);
                dialog.appendChild(header);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                overlay.appendChild(dialog);
                let isClosing = false;
                function closeDialog() {
                    if (!overlay.parentNode)
                        return;
                    overlay.remove();
                    window.setTimeout(() => {
                        document.removeEventListener('keydown', onKeyDown, true);
                        document.removeEventListener('keyup', onKeyUp, true);
                        document.removeEventListener('mousedown', onMouseDown, true);
                        document.removeEventListener('mouseup', onMouseUp, true);
                    }, 1000);
                }
                overlay.closeDialogMethod = closeDialog;
                document.body.appendChild(overlay);
                confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); if (callback)
                    callback(); });
                cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
                closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
                overlay.addEventListener('click', (e) => { if (e.target === overlay)
                    closeDialog(); });
                function onKeyDown(e) {
                    if (!document.getElementById('quick-upgrade-overlay')) {
                        document.removeEventListener('keydown', onKeyDown, true);
                        return;
                    }
                    if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                        }
                    }
                    else if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                            if (callback)
                                callback();
                        }
                    }
                }
                function onKeyUp(e) {
                    if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
                function onMouseDown(e) {
                    if (!document.getElementById('quick-upgrade-overlay')) {
                        document.removeEventListener('mousedown', onMouseDown, true);
                        return;
                    }
                    if (e.button === 3 || e.button === 4) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                        }
                    }
                }
                function onMouseUp(e) {
                    if (e.button === 3 || e.button === 4) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
                document.addEventListener('keydown', onKeyDown, true);
                document.addEventListener('keyup', onKeyUp, true);
                document.addEventListener('mousedown', onMouseDown, true);
                document.addEventListener('mouseup', onMouseUp, true);
            }
            function performAction(count) {
                if (isRunning)
                    return;
                if (!shouldShowQuickButtons())
                    return;
                showConfirmDialog(count, () => {
                    isRunning = true;
                    upgradeQueue = count;
                    upgraded = 0;
                    let isWaitingForDialogClose = false;
                    function doStep() {
                        if (!isRunning) {
                            finish();
                            return;
                        }
                        if (isWaitingForDialogClose) {
                            if (isDialogOpen()) {
                                timer = window.setTimeout(doStep, DELAY);
                                return;
                            }
                            isWaitingForDialogClose = false;
                        }
                        if (isMaxLevel()) {
                            finish();
                            return;
                        }
                        if (isCompleted() && !isDialogOpen()) {
                            finish();
                            return;
                        }
                        if (!shouldShowQuickButtons() && !isDialogOpen()) {
                            if (unavailableRetries < MAX_UNAVAILABLE_RETRIES) {
                                unavailableRetries++;
                                timer = window.setTimeout(doStep, RETRY_DELAY);
                                return;
                            }
                            finish();
                            return;
                        }
                        unavailableRetries = 0;
                        if (upgraded >= upgradeQueue) {
                            finish();
                            return;
                        }
                        if (isDialogOpen()) {
                            if (isRubyButton()) {
                                clickCancel();
                                finish();
                                return;
                            }
                            if (hasNormalButton()) {
                                clickConfirmButton();
                                upgraded++;
                                isWaitingForDialogClose = true;
                                timer = window.setTimeout(doStep, DELAY);
                                return;
                            }
                            pressEnter();
                            upgraded++;
                            isWaitingForDialogClose = true;
                            timer = window.setTimeout(doStep, DELAY);
                            return;
                        }
                        pressEnter();
                        timer = window.setTimeout(doStep, DELAY);
                    }
                    function finish() {
                        isRunning = false;
                        upgradeQueue = 0;
                        unavailableRetries = 0;
                        if (timer) {
                            window.clearTimeout(timer);
                            timer = null;
                        }
                    }
                    timer = window.setTimeout(doStep, DELAY);
                });
            }
            function createButtons() {
                const containerNode = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                const panel = containerNode?.parentNode;
                if (!panel)
                    return;
                if (!shouldShowQuickButtons()) {
                    const existing = document.getElementById('quick-buttons');
                    if (existing)
                        existing.remove();
                    return;
                }
                if (document.getElementById('quick-buttons'))
                    return;
                const quickButtonsWrapper = document.createElement('div');
                quickButtonsWrapper.id = 'quick-buttons';
                if (typeof isCategorySwitch !== 'undefined' && isCategorySwitch) {
                    quickButtonsWrapper.className = 'GarageCommonStyle-animatedBlurredRightBlock';
                }
                quickButtonsWrapper.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3em; margin-top: 0.28em; width: 100%; margin-left: 0.12em; box-sizing: border-box;`;
                const buttons = [
                    { label: 'X5', value: 5 },
                    { label: 'X10', value: 10 },
                    { label: 'X15', value: 15 },
                    { label: 'MAX', value: Infinity }
                ];
                const tooltipMax = state.lang === 'RU' ? 'Прокачать до максимума' : 'Upgrade to max';
                const tooltipSteps = state.lang === 'RU' ? 'Прокачать {n} раз' : 'Upgrade {n} times';
                buttons.forEach(btn => {
                    const el = document.createElement('div');
                    el.className = 'SquarePriceButtonComponentStyle-commonBlockButton -commonButtonUpdate -flexCenterAlignCenter -displayFlex -alignCenter';
                    el.style.cssText = `cursor: pointer; background-color: rgb(218, 218, 218) !important; transition: background-color 0.2s, box-shadow 0.2s; box-shadow: rgba(255, 255, 255, 0.25) 0em 0em 0em 0.063em; border-radius: 0.75em; display: flex; min-width: 0; align-items: center; justify-content: center; height: 3em; box-sizing: border-box;`;
                    el.addEventListener('mouseenter', () => {
                        el.style.backgroundColor = 'rgb(197, 197, 197)';
                        el.style.boxShadow = 'rgb(255, 255, 255) 0em 0em 0em 1.4px';
                    });
                    el.addEventListener('mouseleave', () => {
                        el.style.backgroundColor = 'rgb(218, 218, 218)';
                        el.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 0.063em';
                    });
                    const span = document.createElement('span');
                    span.style.cssText = `color: rgb(0, 0, 0) !important; font-size: 1.3em; font-family: BaseFontBold, FallbackFontBold; font-weight: bold; white-space: nowrap;`;
                    span.textContent = btn.label;
                    el.appendChild(span);
                    el.title = btn.value === Infinity ? tooltipMax : tooltipSteps.replace('{n}', btn.value.toString());
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (typeof isRunning !== 'undefined' && !isRunning)
                            performAction(btn.value);
                    });
                    quickButtonsWrapper.appendChild(el);
                });
                panel.appendChild(quickButtonsWrapper);
            }
            return () => {
                if (!utils.getSetting('k_auto_upgrade', false))
                    return;
                if (state.currentScreen !== 'garage')
                    return;
                if (!initialized) {
                    initialized = true;
                    categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 2000);
                    document.addEventListener('click', (e) => {
                        const target = e.target;
                        if (!(target instanceof Element))
                            return;
                        if (target.closest('#quick-upgrade-overlay'))
                            return;
                        let menuCategory = target.closest('.MenuComponentStyle-mainMenuItem');
                        if (menuCategory && menuCategory.classList.contains('-activeMenu')) {
                            menuCategory = null;
                        }
                        const mainGarageBlock = target.closest('[class*="MountedItemsStyle-commonBlock"]');
                        const itemElement = target.closest('[class*="Item"], [class*="item"], [class*="Equipment"], [class*="equipment"]');
                        const backButton = target.closest('.BreadcrumbsComponentStyle-backButton, .IconStyle-iconBackArrow, [class*="backButton" i]');
                        if (menuCategory || mainGarageBlock || backButton) {
                            isCategorySwitch = true;
                            if (categorySwitchTimeout)
                                window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                        }
                        else if (itemElement) {
                            isCategorySwitch = false;
                            if (categorySwitchTimeout)
                                window.clearTimeout(categorySwitchTimeout);
                        }
                        if (menuCategory || mainGarageBlock || itemElement || backButton) {
                            if (isRunning) {
                                isRunning = false;
                                if (timer) {
                                    window.clearTimeout(timer);
                                    timer = null;
                                }
                            }
                            lastItemSignature = '';
                            const existing = document.getElementById('quick-buttons');
                            if (existing)
                                existing.remove();
                            window.setTimeout(createButtons, 10);
                        }
                    }, true);
                    document.addEventListener('keydown', (e) => {
                        if (document.getElementById('quick-upgrade-overlay'))
                            return;
                        if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                                return;
                            isCategorySwitch = true;
                            if (categorySwitchTimeout)
                                window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                            lastItemSignature = '';
                        }
                    }, true);
                    document.addEventListener('mousedown', (e) => {
                        if (document.getElementById('quick-upgrade-overlay'))
                            return;
                        if (e.button === 3 || e.button === 4) {
                            isCategorySwitch = true;
                            if (categorySwitchTimeout)
                                window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                            lastItemSignature = '';
                        }
                    }, true);
                }
                const loader = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
                if (loader) {
                    const overlay = document.getElementById('quick-upgrade-overlay');
                    if (overlay && overlay.closeDialogMethod)
                        overlay.closeDialogMethod();
                }
                if (document.getElementById('quick-upgrade-overlay'))
                    return;
                const container = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                const nameElement = document.querySelector('.ItemDescriptionComponentStyle-nameItem') || container;
                if (container) {
                    const currentSignature = nameElement ? (nameElement.textContent?.trim() || '') : '';
                    if (currentSignature !== lastItemSignature) {
                        lastItemSignature = currentSignature;
                        const existing = document.getElementById('quick-buttons');
                        if (existing)
                            existing.remove();
                    }
                    if (shouldShowQuickButtons()) {
                        if (!document.getElementById('quick-buttons'))
                            createButtons();
                    }
                    else {
                        const existing = document.getElementById('quick-buttons');
                        if (existing)
                            existing.remove();
                    }
                }
                else {
                    const existing = document.getElementById('quick-buttons');
                    if (existing)
                        existing.remove();
                }
            };
        })(),
        changeCounter: (() => {
            const CACHE_KEY = 'kasp_player_changes_cache';
            const playerChanges = new Map();
            let isUpdating = false;
            let isInBattle = false;
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    for (const [nick, count] of Object.entries(parsed)) {
                        playerChanges.set(nick, count);
                    }
                }
            }
            catch (e) { }
            const saveCache = () => {
                const obj = {};
                playerChanges.forEach((count, nick) => { obj[nick] = count; });
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
            };
            const clearCache = () => {
                playerChanges.clear();
                sessionStorage.removeItem(CACHE_KEY);
            };
            window.addEventListener('message', (e) => {
                const data = e.data;
                if (!data || data.type !== 'kasp:useraction')
                    return;
                const detail = data.detail;
                if (!Array.isArray(detail))
                    return;
                if (detail[0] !== 'TankUserActionLog' || !detail.includes('CHANGE_EQUIPMENT'))
                    return;
                const nickname = detail.find((item) => typeof item === 'string' &&
                    item !== 'TankUserActionLog' &&
                    item !== 'CHANGE_EQUIPMENT' &&
                    item !== 'ALLY' &&
                    item !== 'ENEMIES' &&
                    !item.startsWith('-') &&
                    /[a-zA-Z]/.test(item) &&
                    item.length >= 2 && item.length < 30);
                if (!nickname)
                    return;
                playerChanges.set(nickname, (playerChanges.get(nickname) ?? 0) + 1);
                saveCache();
                if (document.querySelector('.BattleTabStatisticComponentStyle-container')) {
                    update();
                }
            });
            document.addEventListener('kasp:battle:id', () => {
                clearCache();
                update();
            });
            function checkBattleCanvas() {
                const currentInBattle = !!document.querySelector('.BattleComponentStyle-canvasContainer');
                if (currentInBattle !== isInBattle) {
                    isInBattle = currentInBattle;
                    if (!isInBattle) {
                        clearCache();
                        update();
                    }
                }
            }
            function sync() {
                const container = document.querySelector('.BattleTabStatisticComponentStyle-container');
                if (!container)
                    return;
                const headerRows = container.querySelectorAll('table > thead > tr');
                for (let i = 0; i < headerRows.length; i++) {
                    const row = headerRows[i];
                    if (!row.querySelector('.kasp-change-th')) {
                        const th = document.createElement('th');
                        th.className = 'kasp-change-th';
                        th.innerHTML = '<div></div>';
                        row.appendChild(th);
                    }
                }
                const bodyRows = container.querySelectorAll('table > tbody > tr');
                for (let i = 0; i < bodyRows.length; i++) {
                    const row = bodyRows[i];
                    let td = row.querySelector('.kasp-change-td');
                    if (!td) {
                        td = document.createElement('td');
                        td.className = 'kasp-change-td';
                        row.appendChild(td);
                    }
                    const cell = row.querySelector('.BattleTabStatisticComponentStyle-nicknameCell');
                    if (!cell)
                        continue;
                    const nickname = (cell.textContent || '').replace(/^\[.*?\]\s*/, '').trim();
                    if (!nickname)
                        continue;
                    const count = playerChanges.get(nickname) ?? 0;
                    const hasClass = td.classList.contains('kasp-changed');
                    if (count > 0 && !hasClass)
                        td.classList.add('kasp-changed');
                    else if (count === 0 && hasClass)
                        td.classList.remove('kasp-changed');
                }
            }
            function update() { sync(); }
            return {
                onTick: () => { checkBattleCanvas(); },
                sync,
                update,
            };
        })(),
        customGarageSkins: (() => {
            const STORAGE_KEY = 'kasp_equipped_skins';
            const BASE_IMG_KEY = 'kasp_base_images';
            let SKIN_BRANDS_MAP = null;
            let NAME_TRANSLATE = null;
            let PREFILLED_DEFAULTS = null;
            let SKINS_DATABASE = null;
            function getSavedSkins() {
                try {
                    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
                }
                catch (e) {
                    return {};
                }
            }
            function getDefaultImages() {
                try {
                    const stored = JSON.parse(localStorage.getItem(BASE_IMG_KEY)) || {};
                    const merged = {};
                    for (const key in PREFILLED_DEFAULTS) {
                        merged[key] = [PREFILLED_DEFAULTS[key]];
                    }
                    for (const key in stored) {
                        if (!merged[key])
                            merged[key] = [];
                        const val = stored[key];
                        if (Array.isArray(val)) {
                            val.forEach(v => { if (v && !merged[key].includes(v))
                                merged[key].push(v); });
                        }
                        else if (val) {
                            if (!merged[key].includes(val))
                                merged[key].push(val);
                        }
                    }
                    return merged;
                }
                catch (e) {
                    const fallback = {};
                    for (const key in PREFILLED_DEFAULTS)
                        fallback[key] = [PREFILLED_DEFAULTS[key]];
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
                    if (!targetUrl)
                        continue;
                    const urlsToOverride = [];
                    if (defaultImages[item]) {
                        urlsToOverride.push(...defaultImages[item]);
                    }
                    if (SKINS_DATABASE[item]) {
                        for (const skinUrl of Object.values(SKINS_DATABASE[item])) {
                            if (skinUrl)
                                urlsToOverride.push(skinUrl);
                        }
                    }
                    const finalUrls = urlsToOverride.filter(url => url !== targetUrl);
                    if (finalUrls.length > 0) {
                        const selectors = finalUrls.map(url => `.GarageItemComponentStyle-mainImg[src="${url}"], .garage-item img[src="${url}"], .MountedItemsStyle-itemPreview[src="${url}"]`).join(',\n');
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
                if (state.currentScreen !== 'garage')
                    return;
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
                                if (!defaultImages[itemNameEN])
                                    defaultImages[itemNameEN] = [];
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
                            }
                            else if (src.includes('ic_standard') || src.includes('standard')) {
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
                            }
                            else if (SKINS_DATABASE[itemNameEN] && SKINS_DATABASE[itemNameEN][foundBrand]) {
                                const targetUrl = SKINS_DATABASE[itemNameEN][foundBrand];
                                if (savedSkins[itemNameEN] !== targetUrl) {
                                    savedSkins[itemNameEN] = targetUrl;
                                    skinsUpdated = true;
                                }
                            }
                            if (skinsUpdated) {
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
                            }
                        }
                        else if (skinImgs.length > 0) {
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
        })(),
        weaponAugmentTracker: (() => {
            const STORAGE_KEY = 'kasp_weapon_augment_tracker';
            let lastSignature = '';
            let currentReloadTime = 0;
            let barContainer = null;
            let barFill = null;
            let currentTurret = '';
            let isPressed = false;
            let pressTime = 0;
            let reloadStart = 0;
            let initialized = false;
            const TURRETS = [
                'firebird', 'freeze', 'isida', 'tesla', 'hammer', 'twins', 'ricochet', 'vulcan',
                'smoky', 'striker', 'thunder', 'tsunami', 'scorpion', 'magnum', 'railgun', 'gauss', 'shaft'
            ];
            const NAME_TRANSLATE = {
                "огнемёт": "firebird", "firebird": "firebird",
                "фриз": "freeze", "freeze": "freeze",
                "изида": "isida", "isida": "isida",
                "тесла": "tesla", "tesla": "tesla",
                "молот": "hammer", "hammer": "hammer",
                "твинс": "twins", "twins": "twins",
                "рикошет": "ricochet", "ricochet": "ricochet",
                "вулкан": "vulcan", "vulcan": "vulcan",
                "смоки": "smoky", "smoky": "smoky",
                "страйкер": "striker", "striker": "striker",
                "гром": "thunder", "thunder": "thunder",
                "цунами": "tsunami", "tsunami": "tsunami",
                "скорпион": "scorpion", "scorpion": "scorpion",
                "магнум": "magnum", "magnum": "magnum",
                "рельса": "railgun", "railgun": "railgun",
                "гаусс": "gauss", "gauss": "gauss",
                "шафт": "shaft", "shaft": "shaft"
            };
            const RELOAD_BASE_STEPS = {
                'shaft': {
                    1: [2.70, 2.62, 2.54, 2.46],
                    2: [2.45, 2.43, 2.42, 2.40, 2.39, 2.37],
                    3: [2.36, 2.34, 2.33, 2.32, 2.30, 2.29, 2.28, 2.26, 2.25],
                    4: [2.24, 2.22, 2.21, 2.20, 2.18, 2.17, 2.15, 2.14, 2.13, 2.11, 2.10],
                    5: [2.09, 2.09, 2.08, 2.07, 2.06, 2.06, 2.05, 2.04, 2.03, 2.03, 2.02, 2.01],
                    6: [2.00, 2.00, 1.99, 1.98, 1.98, 1.97, 1.96, 1.95, 1.95, 1.94, 1.93, 1.93, 1.92],
                    7: [1.91, 1.91, 1.90, 1.90, 1.89, 1.89, 1.88, 1.87, 1.87, 1.86, 1.86, 1.85, 1.85, 1.84, 1.83, 1.83, 1.82, 1.82, 1.81, 1.81, 1.80]
                },
                'scorpion': {
                    1: [4.05, 3.93, 3.81, 3.69],
                    2: [3.67, 3.64, 3.62, 3.60, 3.57, 3.55],
                    3: [3.54, 3.52, 3.51, 3.49, 3.48, 3.46, 3.45, 3.43, 3.42],
                    4: [3.41, 3.39, 3.38, 3.37, 3.36, 3.34, 3.33, 3.32, 3.31, 3.29, 3.28],
                    5: [3.27, 3.25, 3.24, 3.22, 3.21, 3.20, 3.18, 3.17, 3.15, 3.14, 3.12, 3.11],
                    6: [3.09, 3.07, 3.06, 3.04, 3.02, 3.00, 2.99, 2.97, 2.95, 2.93, 2.92, 2.90, 2.88],
                    7: [2.87, 2.86, 2.85, 2.85, 2.84, 2.83, 2.82, 2.81, 2.80, 2.79, 2.79, 2.78, 2.77, 2.76, 2.75, 2.74, 2.73, 2.73, 2.72, 2.71, 2.70]
                }
            };
            const AUGMENT_MODIFIERS = {
                'https://s.eu.tankionline.com/605/115405/45/51/31770737552234/image.svg': 1.15,
                'https://s.eu.tankionline.com/623/154745/143/361/31770737674426/image.svg': 1.70,
                'https://s.eu.tankionline.com/605/137574/124/170/31770737107437/image.svg': 1.15
            };
            const DISABLE_TIMER_AUGMENTS = [
                'https://s.eu.tankionline.com/605/115405/51/352/31770737750144/image.svg'
            ];
            try {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (data && typeof data.reloadTime === 'number') {
                    currentReloadTime = data.reloadTime;
                }
            }
            catch (e) { }
            function createBar() {
                if (document.getElementById('kasp-reload-bar-container'))
                    return;
                barContainer = document.createElement('div');
                barContainer.id = 'kasp-reload-bar-container';
                barContainer.style.cssText = `
                    position: fixed;
                    bottom: 20%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 20em;
                    height: 0.35em;
                    background: rgb(0, 0, 0);
                    box-shadow: 0 0 0 0.2em rgb(0, 0, 0);
                    border-radius: 0.25em;
                    z-index: 9999;
                    pointer-events: none;
                    display: none;
                    overflow: hidden;
                `;
                barFill = document.createElement('div');
                barFill.id = 'kasp-reload-bar-fill';
                barFill.style.cssText = `
                    width: 0%;
                    height: 100%;
                    border-radius: 0.25em;
                    background-color: #FFFF00;
                    box-shadow: 0 0 0.25em rgb(29, 29, 29);
                `;
                barContainer.appendChild(barFill);
                document.body.appendChild(barContainer);
            }
            function renderLoop() {
                requestAnimationFrame(renderLoop);
                if (!currentReloadTime || !document.pointerLockElement) {
                    if (barContainer && barContainer.style.display !== 'none') {
                        barContainer.style.display = 'none';
                    }
                    return;
                }
                const now = Date.now();
                const elapsed = now - reloadStart;
                const durationMs = currentReloadTime * 1000;
                if (elapsed < durationMs && reloadStart > 0) {
                    if (!barContainer)
                        createBar();
                    if (barContainer.style.display !== 'block')
                        barContainer.style.display = 'block';
                    const progress = Math.min(1, elapsed / durationMs);
                    barFill.style.width = (progress * 100).toFixed(1) + '%';
                }
                else {
                    if (barContainer && barContainer.style.display !== 'none') {
                        barContainer.style.display = 'none';
                    }
                }
            }
            function trackGarage() {
                if (state.currentScreen !== 'garage')
                    return;
                const nameEl = document.querySelector('.ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span');
                if (!nameEl)
                    return;
                const rawName = nameEl.textContent.trim().toLowerCase();
                const firstWord = rawName.split(/\s+/)[0];
                const itemNameEN = NAME_TRANSLATE[firstWord] || firstWord;
                if (!TURRETS.includes(itemNameEN))
                    return;
                const buttons = document.querySelectorAll('.GarageCommonStyle-bigActionButton, .SquarePriceButtonComponentStyle-commonBlockButton');
                let isEquipped = false;
                buttons.forEach(btn => {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('equipped') || text.includes('установлено') || text.includes('снять') || text.includes('unequip')) {
                        isEquipped = true;
                    }
                });
                if (!isEquipped)
                    return;
                const deviceIconEl = document.querySelector('.DeviceButtonComponentStyle-deviceIcon');
                let augmentSrc = 'default';
                if (deviceIconEl)
                    augmentSrc = deviceIconEl.getAttribute('src') || 'default';
                let mkLevel = 7;
                let mkStep = 0;
                if (rawName.includes('max')) {
                    mkLevel = 7;
                    mkStep = 20;
                }
                else {
                    const mkMatch = rawName.match(/mk\s*(\d+)(?:-(\d+))?/i);
                    if (mkMatch) {
                        mkLevel = parseInt(mkMatch[1]) || 7;
                        mkStep = mkMatch[2] ? parseInt(mkMatch[2]) : 0;
                    }
                }
                const currentSignature = `${itemNameEN}_mk${mkLevel}-${mkStep}_${augmentSrc}`;
                if (currentSignature === lastSignature)
                    return;
                let reloadTime = null;
                if (DISABLE_TIMER_AUGMENTS.includes(augmentSrc)) {
                    reloadTime = 0;
                }
                else if (RELOAD_BASE_STEPS[itemNameEN] && RELOAD_BASE_STEPS[itemNameEN][mkLevel]) {
                    const stepsArray = RELOAD_BASE_STEPS[itemNameEN][mkLevel];
                    const safeStep = Math.min(mkStep, stepsArray.length - 1);
                    const baseTime = stepsArray[safeStep];
                    const modifier = AUGMENT_MODIFIERS[augmentSrc] || 1.0;
                    reloadTime = Math.round(baseTime * modifier * 100) / 100;
                }
                currentReloadTime = reloadTime;
                currentTurret = itemNameEN;
                const dataToSave = {
                    turret: itemNameEN,
                    augment: augmentSrc,
                    mk: mkLevel,
                    step: mkStep,
                    reloadTime: reloadTime,
                    timestamp: Date.now()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                lastSignature = currentSignature;
            }
            return () => {
                if (!initialized) {
                    initialized = true;
                    requestAnimationFrame(renderLoop);
                    const onPointerDown = (e) => {
                        if (e.type === 'pointerdown' && (e.button !== 0 || e.pointerType === 'touch'))
                            return;
                        if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat))
                            return;
                        if (!document.pointerLockElement)
                            return;
                        isPressed = true;
                        pressTime = Date.now();
                    };
                    const onPointerUp = (e) => {
                        if (e.type === 'pointerup' && e.button !== 0)
                            return;
                        if (e.type === 'keyup' && e.code !== 'Space')
                            return;
                        if (!isPressed)
                            return;
                        isPressed = false;
                        if (!document.pointerLockElement)
                            return;
                        if (!currentReloadTime)
                            return;
                        const holdTime = Date.now() - pressTime;
                        if (holdTime > 200) {
                            if (currentTurret !== 'shaft')
                                return;
                        }
                        const durationMs = currentReloadTime * 1000;
                        if (reloadStart && (Date.now() - reloadStart) < durationMs)
                            return;
                        reloadStart = Date.now();
                    };
                    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
                    document.addEventListener('keydown', onPointerDown, { capture: true, passive: true });
                    document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
                    document.addEventListener('keyup', onPointerUp, { capture: true, passive: true });
                }
                if (state.currentScreen === 'garage') {
                    trackGarage();
                }
            };
        })(),
        zeroResists: (() => {
            const SHIELD_ICON_URL = chrome.runtime.getURL("assets/modulesTAB.svg");
            const RESISTANCE_MAP = {
                'mine': 'https://s.eu.tankionline.com/static/images/mine_resistance.dd581c90.svg',
                'crit': 'https://s.eu.tankionline.com/static/images/crit_resistance.94e32312.svg',
                'firebird': 'https://s.eu.tankionline.com/static/images/firebird_resistance.785a9d6b.svg',
                'freeze': 'https://s.eu.tankionline.com/static/images/freeze_resistance.33bdf642.svg',
                'isis': 'https://s.eu.tankionline.com/static/images/isis_resistance.30a69ffc.svg',
                'tesla': 'https://s.eu.tankionline.com/static/images/tesla_resistance.3e686c8e.svg',
                'hammer': 'https://s.eu.tankionline.com/static/images/hammer_resistance.6c549d29.svg',
                'twins': 'https://s.eu.tankionline.com/static/images/twins_resistance.ad189f61.svg',
                'ricochet': 'https://s.eu.tankionline.com/static/images/ricochet_resistance.8247beaa.svg',
                'vulcan': 'https://s.eu.tankionline.com/static/images/vulcan_resistance.824f6f0e.svg',
                'smoky': 'https://s.eu.tankionline.com/static/images/smoky_resistance.845afc14.svg',
                'rocket_launcher': 'https://s.eu.tankionline.com/static/images/rocket_launcher_resistance.b7dfd64f.svg',
                'thunder': 'https://s.eu.tankionline.com/static/images/thunder_resistance.6d7f4531.svg',
                'tsunami': 'https://s.eu.tankionline.com/static/images/tsunami_resistance.6200aad9.svg',
                'scorpio': 'https://s.eu.tankionline.com/static/images/scorpio_resistance.e8f1787f.svg',
                'artillery': 'https://s.eu.tankionline.com/static/images/artillery_resistance.9b4cbc34.svg',
                'railgun': 'https://s.eu.tankionline.com/static/images/railgun_resistance.636a554f.svg',
                'gauss': 'https://s.eu.tankionline.com/static/images/gauss_resistance.bb8f409c.svg',
                'shaft': 'https://s.eu.tankionline.com/static/images/shaft_resistance.0778fd3e.svg'
            };
            const TAB_SELECTOR = '.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults';
            const iconStyleCache = new WeakMap();
            let isTabExpanded = localStorage.getItem('kasp_tab_expanded') === 'true';
            let initialExpandedSet = false;
            function getIconStyle(iconDiv) {
                const cached = iconStyleCache.get(iconDiv);
                if (cached !== undefined)
                    return cached;
                const cs = window.getComputedStyle(iconDiv);
                const result = {
                    mask: (cs.getPropertyValue('-webkit-mask-image') ||
                        cs.getPropertyValue('mask-image') ||
                        '').toLowerCase(),
                    bg: cs.backgroundColor || '',
                };
                iconStyleCache.set(iconDiv, result);
                return result;
            }
            function getCssUrl(el) {
                if (!el)
                    return null;
                const cs = window.getComputedStyle(el);
                for (const prop of ['maskImage', 'webkitMaskImage', 'backgroundImage']) {
                    const val = cs[prop];
                    if (val && val !== 'none' && val !== 'initial' && val !== '')
                        return val;
                }
                return null;
            }
            function injectHeaderShield() {
                const theadRows = document.querySelectorAll(':is(.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults) table thead tr');
                theadRows.forEach(row => {
                    if (row.querySelector('.kasp-defence-th'))
                        return;
                    const gsHeader = row.children[1];
                    if (gsHeader) {
                        const th = document.createElement('th');
                        th.className = 'kasp-defence-th';
                        th.innerHTML = `<img src="${SHIELD_ICON_URL}" alt="" class="kasp-shield-img">`;
                        gsHeader.after(th);
                    }
                });
            }
            function getIconUrl(lbl) {
                const iconDiv = lbl.querySelector('div');
                if (iconDiv) {
                    const style = getIconStyle(iconDiv);
                    const m = style.mask.match(/url\(["']?([^"')]+)["']?\)/);
                    if (m && m[1])
                        return m[1].toLowerCase();
                }
                const img = lbl.querySelector('img');
                if (img)
                    return (img.src || '').toLowerCase();
                return '';
            }
            function injectCompactCells() {
                const cells = document.querySelectorAll('.BattleTabStatisticComponentStyle-resistanceModuleCell');
                cells.forEach(cell => {
                    const htmlCell = cell;
                    const labels = Array.from(htmlCell.children).filter(el => el.classList.contains('BattleTabStatisticComponentStyle-defenceLabel') &&
                        !el.closest('.kasp-compact-cell'));
                    let protectLabel = null;
                    let protectIsSpectrum = false;
                    let armadilloLabel = null;
                    for (const lbl of labels) {
                        const url = getIconUrl(lbl);
                        if (url.includes('all_resistance')) {
                            protectLabel = lbl;
                            protectIsSpectrum = true;
                            break;
                        }
                    }
                    if (!protectIsSpectrum) {
                        for (const lbl of labels) {
                            const iconDiv = lbl.querySelector('div');
                            if (!iconDiv)
                                continue;
                            const style = getIconStyle(iconDiv);
                            const isRed = style.bg.includes('254') || style.bg.includes('255, 80') ||
                                style.bg.includes('255, 102') || style.bg.includes('254, 102');
                            if (isRed) {
                                protectLabel = lbl;
                                break;
                            }
                        }
                    }
                    for (const lbl of labels) {
                        if (lbl === protectLabel)
                            continue;
                        const url = getIconUrl(lbl);
                        if (url.includes('crit_resistance')) {
                            armadilloLabel = lbl;
                            break;
                        }
                    }
                    const protectVal = protectLabel ? (protectLabel.querySelector('h3')?.textContent || 'on') : 'none';
                    const armadilloVal = armadilloLabel ? (armadilloLabel.querySelector('h3')?.textContent || 'on') : 'none';
                    const stateKey = `${protectIsSpectrum ? 'spec' : protectVal}_${armadilloVal}`;
                    let compact = htmlCell.querySelector('.kasp-compact-cell');
                    if (compact && compact.dataset.kaspState === stateKey)
                        return;
                    if (!compact) {
                        compact = document.createElement('div');
                        compact.className = 'kasp-compact-cell';
                        htmlCell.prepend(compact);
                    }
                    compact.dataset.kaspState = stateKey;
                    compact.innerHTML = '';
                    const slot1 = document.createElement('div');
                    slot1.className = 'kasp-slot';
                    if (protectLabel) {
                        const clone = protectLabel.cloneNode(true);
                        clone.classList.add('kasp-cloned-resist', 'kasp-protecting');
                        if (protectIsSpectrum)
                            clone.classList.add('kasp-spectrum');
                        slot1.appendChild(clone);
                    }
                    else {
                        slot1.innerHTML = '<span class="kasp-dash">—</span>';
                    }
                    compact.appendChild(slot1);
                    const slot2 = document.createElement('div');
                    slot2.className = 'kasp-slot';
                    if (armadilloLabel) {
                        const clone = armadilloLabel.cloneNode(true);
                        clone.classList.add('kasp-cloned-resist', 'kasp-armadillo');
                        slot2.appendChild(clone);
                    }
                    else {
                        slot2.innerHTML = '<span class="kasp-dash">—</span>';
                    }
                    compact.appendChild(slot2);
                });
            }
            function injectZeroSummary() {
                const tabContainer = document.querySelector(TAB_SELECTOR);
                if (!tabContainer)
                    return;
                let summaryRow = Array.from(tabContainer.children).find(el => el.className.includes('-flexCenterAlignCenter') && !el.className.toLowerCase().includes('header'));
                if (!summaryRow) {
                    summaryRow = document.createElement('div');
                    summaryRow.className = '-flexCenterAlignCenter kasp-custom-summary-row';
                    const optionsContainer = tabContainer.querySelector('.BattleTabStatisticComponentStyle-commonContainerIconOptions');
                    if (optionsContainer)
                        optionsContainer.before(summaryRow);
                    else
                        tabContainer.appendChild(summaryRow);
                }
                const presentResistances = new Set();
                const children = Array.from(summaryRow.children);
                children.forEach(child => {
                    if (child.classList.contains('kasp-zero-summary'))
                        return;
                    const icon = child.querySelector('div') || child;
                    const maskImg = getCssUrl(icon);
                    if (!maskImg)
                        return;
                    const match = maskImg.match(/\/([a-zA-Z_]+)_resistance(?:\.[0-9a-f]+)?\.(?:svg|webp|png)/);
                    if (match && match[1])
                        presentResistances.add(match[1]);
                });
                const zeroBlocks = summaryRow.querySelectorAll('.kasp-zero-summary');
                zeroBlocks.forEach(block => {
                    const turret = block.getAttribute('data-turret');
                    if (turret && presentResistances.has(turret))
                        block.remove();
                });
                Object.keys(RESISTANCE_MAP).forEach((turret) => {
                    if (!presentResistances.has(turret) && !summaryRow.querySelector(`.kasp-zero-summary[data-turret="${turret}"]`)) {
                        const zeroLabel = document.createElement('div');
                        zeroLabel.className = 'kasp-zero-summary -flexStart';
                        zeroLabel.setAttribute('data-turret', turret);
                        zeroLabel.style.cssText = 'display: flex !important; align-items: center !important; justify-content: flex-start !important; margin-right: 0.75em !important; cursor: default !important; opacity: 1 !important; pointer-events: none !important;';
                        const iconDiv = document.createElement('div');
                        iconDiv.className = '-maskImageContain -maskImage';
                        iconDiv.style.cssText = `background-color: #5cfc47 !important; height: 1em !important; width: 1em !important; margin-right: 0.1875em !important; -webkit-mask-image: url('${RESISTANCE_MAP[turret]}') !important; mask-image: url('${RESISTANCE_MAP[turret]}') !important; -webkit-mask-size: contain !important; mask-size: contain !important; -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important; -webkit-mask-position: center center !important; mask-position: center center !important;`;
                        const textSpan = document.createElement('span');
                        textSpan.className = '-regular';
                        textSpan.innerHTML = '&#215;0';
                        textSpan.style.cssText = 'font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important;';
                        zeroLabel.appendChild(iconDiv);
                        zeroLabel.appendChild(textSpan);
                        summaryRow.appendChild(zeroLabel);
                    }
                });
            }
            function injectToggleButton() {
                if (isTabExpanded && !initialExpandedSet && document.body) {
                    document.body.classList.add('kasp-tab-expanded');
                    initialExpandedSet = true;
                }
                const tabContainer = document.querySelector(TAB_SELECTOR);
                if (!tabContainer)
                    return;
                const summaryRow = Array.from(tabContainer.children).find(el => el.className.includes('-flexCenterAlignCenter') && !el.className.toLowerCase().includes('header'));
                if (!summaryRow || document.getElementById('kasp-tab-toggle-btn'))
                    return;
                if (window.getComputedStyle(summaryRow).position === 'static') {
                    summaryRow.style.position = 'relative';
                }
                const btn = document.createElement('div');
                btn.id = 'kasp-tab-toggle-btn';
                btn.className = isTabExpanded ? 'kasp-active-toggle' : '';
                btn.title = state.lang === 'RU' ? 'Всегда показывать все модули' : 'Always show all modules';
                btn.innerHTML = `<div class="kasp-toggle-icon" style="-webkit-mask-image: url('${SHIELD_ICON_URL}'); mask-image: url('${SHIELD_ICON_URL}');"></div>`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    isTabExpanded = !isTabExpanded;
                    localStorage.setItem('kasp_tab_expanded', String(isTabExpanded));
                    if (isTabExpanded) {
                        document.body.classList.add('kasp-tab-expanded');
                        btn.classList.add('kasp-active-toggle');
                    }
                    else {
                        document.body.classList.remove('kasp-tab-expanded');
                        btn.classList.remove('kasp-active-toggle');
                    }
                });
                summaryRow.appendChild(btn);
            }
            function sync() {
                if (!document.querySelector(TAB_SELECTOR))
                    return;
                injectHeaderShield();
                injectCompactCells();
                injectZeroSummary();
                injectToggleButton();
            }
            function update() { sync(); }
            return { sync, update };
        })(),
        equipmentTracker: (() => {
            const STORAGE_KEY = 'kasp_my_equipment';
            let lastSignature = '';
            const urlFrom = (el) => {
                if (!el)
                    return '';
                const cs = getComputedStyle(el);
                const bg = cs.getPropertyValue('background-image');
                if (bg && bg !== 'none') {
                    const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
                    if (m && m[1])
                        return m[1];
                }
                const mask = cs.getPropertyValue('-webkit-mask-image') ||
                    cs.getPropertyValue('mask-image');
                if (mask && mask !== 'none') {
                    const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
                    if (m && m[1])
                        return m[1];
                }
                const img = el.querySelector('img');
                if (img && img.src)
                    return img.src;
                if (el instanceof HTMLImageElement && el.src)
                    return el.src;
                return '';
            };
            const iconsOf = (cell) => {
                if (!cell)
                    return [];
                const block = cell.querySelector('.BattleTabStatisticComponentStyle-commonBlock');
                if (!block)
                    return [];
                return Array.from(block.children);
            };
            const getOwnNickname = () => {
                const el = document.querySelector('.UserInfoContainerStyle-userNameRank');
                if (!el)
                    return '';
                return (el.textContent || '').trim().replace(/^\[.*?\]\s*/, '').trim();
            };
            const findSelfRow = () => {
                const byId = document.getElementById('selfUserBg');
                if (byId)
                    return byId;
                const selected = document.querySelector('.BattleTabStatisticComponentStyle-selectedRowBackGround');
                if (selected)
                    return selected;
                const own = getOwnNickname();
                if (!own)
                    return null;
                const cells = document.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell');
                for (let i = 0; i < cells.length; i++) {
                    const nick = (cells[i].textContent || '')
                        .trim().replace(/^\[.*?\]\s*/, '').trim();
                    if (nick === own)
                        return cells[i].closest('tr');
                }
                return null;
            };
            const sync = () => {
                const selfRow = findSelfRow();
                if (!selfRow)
                    return;
                const device = selfRow.querySelector('.BattleTabStatisticComponentStyle-deviceCell');
                const defence = selfRow.querySelector('.BattleTabStatisticComponentStyle-defenceCell');
                if (!device && !defence)
                    return;
                const dIcons = iconsOf(device);
                const hIcons = iconsOf(defence);
                const entry = {
                    turret: urlFrom(dIcons[0] ?? null),
                    turretAugment: urlFrom(dIcons[1] ?? null),
                    hull: urlFrom(hIcons[0] ?? null),
                    hullAugment: urlFrom(hIcons[1] ?? null),
                    savedAt: Date.now(),
                };
                if (!entry.turret && !entry.hull)
                    return;
                const sig = `${entry.turret}|${entry.turretAugment}|${entry.hull}|${entry.hullAugment}`;
                if (sig === lastSignature)
                    return;
                lastSignature = sig;
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
                }
                catch (e) {
                    console.error('[KI:equipment] save failed', e);
                }
            };
            const get = () => {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    return raw ? JSON.parse(raw) : null;
                }
                catch {
                    return null;
                }
            };
            const clear = () => {
                localStorage.removeItem(STORAGE_KEY);
                lastSignature = '';
            };
            return { sync, get, clear };
        })(),
        battleHistory: (() => {
            let initialized = false;
            let battleProcessed = false;
            const NICK_KEY = 'kasp_last_nickname';
            let currentPage = 1;
            const ROWS_PER_PAGE = 15;
            let currentNickname = (() => {
                try {
                    return localStorage.getItem(NICK_KEY) || 'Unknown';
                }
                catch {
                    return 'Unknown';
                }
            })();
            const updateNickname = () => {
                const nameEl = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration, .UserInfoContainerStyle-userNameRank');
                if (!nameEl)
                    return false;
                const text = nameEl.textContent?.trim() || '';
                const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
                if (!cleanName || cleanName === 'Unknown')
                    return false;
                if (cleanName !== currentNickname) {
                    const overlay = document.querySelector('.custom-history-overlay');
                    if (overlay)
                        overlay.remove();
                    currentNickname = cleanName;
                    try {
                        localStorage.setItem(NICK_KEY, cleanName);
                    }
                    catch { }
                }
                return true;
            };
            const openDB = () => {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('TankiBattlesDB', 4);
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        let store;
                        if (!db.objectStoreNames.contains('battles')) {
                            store = db.createObjectStore('battles', { keyPath: 'id', autoIncrement: true });
                        }
                        else {
                            store = event.target.transaction.objectStore('battles');
                        }
                        if (!store.indexNames.contains('date'))
                            store.createIndex('date', 'date', { unique: false });
                        if (!store.indexNames.contains('map'))
                            store.createIndex('map', 'map', { unique: false });
                        if (!store.indexNames.contains('mode'))
                            store.createIndex('mode', 'mode', { unique: false });
                        if (!store.indexNames.contains('top'))
                            store.createIndex('top', 'top', { unique: false });
                        if (!store.indexNames.contains('nickname'))
                            store.createIndex('nickname', 'nickname', { unique: false });
                    };
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            };
            const addBattle = async (battleData) => {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction('battles', 'readwrite');
                    const store = transaction.objectStore('battles');
                    const request = store.add(battleData);
                    request.onsuccess = (e) => resolve(e.target.result);
                    request.onerror = () => reject(request.error);
                });
            };
            const getAllBattles = async (nickname) => {
                try {
                    const db = await openDB();
                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction('battles', 'readonly');
                        const store = transaction.objectStore('battles');
                        let request;
                        if (nickname && store.indexNames.contains('nickname')) {
                            request = store.index('nickname').getAll(nickname);
                        }
                        else {
                            request = store.getAll();
                        }
                        request.onsuccess = (e) => resolve(e.target.result || []);
                        request.onerror = () => reject(request.error);
                    });
                }
                catch (e) {
                    console.error('[Tanki Battle History] Error reading DB:', e);
                    return [];
                }
            };
            const removeDuplicateBattles = async (nickname) => {
                try {
                    const battles = await getAllBattles(nickname);
                    if (battles.length === 0)
                        return;
                    const uniqueMap = new Map();
                    const idsToDelete = [];
                    battles.forEach(b => {
                        const signature = `${Math.floor(b.date / 60000)}_${b.map}_${b.kills}_${b.deaths}_${b.crystals}`;
                        if (uniqueMap.has(signature))
                            idsToDelete.push(b.id);
                        else
                            uniqueMap.set(signature, b.id);
                    });
                    if (idsToDelete.length > 0) {
                        const db = await openDB();
                        const transaction = db.transaction('battles', 'readwrite');
                        const store = transaction.objectStore('battles');
                        idsToDelete.forEach(id => store.delete(id));
                    }
                }
                catch (e) {
                    console.error('[Tanki Battle History] Error cleaning duplicates:', e);
                }
            };
            const translateMapName = (rawMapWithMode, targetLang) => {
                const cleanText = (rawMapWithMode || '').trim();
                if (!cleanText)
                    return 'Unknown';
                const translated = DataLoader.translateMap(cleanText, targetLang);
                return translated || cleanText;
            };
            async function showClearConfirmModal(onConfirm) {
                const existing = document.getElementById('clear-confirm-overlay');
                if (existing)
                    existing.remove();
                const lang = state.lang;
                const translations = {
                    RU: { title: 'ОЧИСТКА ИСТОРИИ', text: 'Вы уверены, что хотите удалить всю историю матчей?', cancel: 'Отмена', confirm: 'УДАЛИТЬ' },
                    EN: { title: 'CLEAR HISTORY', text: 'Are you sure you want to delete all match history?', cancel: 'Cancel', confirm: 'DELETE' }
                };
                const dict = translations[lang] || translations['EN'];
                try {
                    const response = await fetch(chrome.runtime.getURL('templates/clear-history-modal.html'));
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    let html = await response.text();
                    html = html
                        .replace(/{{title}}/g, dict.title)
                        .replace(/{{text}}/g, dict.text)
                        .replace(/{{cancel}}/g, dict.cancel)
                        .replace(/{{confirm}}/g, dict.confirm);
                    const overlay = document.createElement('div');
                    overlay.id = 'clear-confirm-overlay';
                    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;
                    const dialog = document.createElement('div');
                    dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75);`;
                    dialog.innerHTML = html;
                    overlay.appendChild(dialog);
                    let isClosing = false;
                    function closeDialog() {
                        if (!overlay.parentNode)
                            return;
                        overlay.remove();
                    }
                    overlay.closeDialogMethod = closeDialog;
                    document.body.appendChild(overlay);
                    dialog.querySelector('#clear-dlg-confirm')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                            onConfirm();
                        }
                    });
                    dialog.querySelector('#clear-dlg-cancel')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                        }
                    });
                    dialog.querySelector('#clear-dlg-close')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!isClosing) {
                            isClosing = true;
                            closeDialog();
                        }
                    });
                }
                catch (error) {
                    console.error('[Kaspersky Inventions] Failed to load clear history modal template:', error);
                }
            }
            const t = {
                RU: { title: 'История Битв', date: 'Дата', map: 'Карта', status: 'Статус', top: 'Место', mode: 'Режим', score: 'Очки', kills: 'Убийства', deaths: 'Смерти', kd: 'У/С', turret: 'Пушка', hull: 'Корпус', augment: 'Устройство', crystals: 'Кристаллы', stars: 'Звёзды', win: 'Победа', lose: 'Поражение', draw: 'Ничья', dm: 'DM', clear: 'Очистить', export: 'Экспорт', import: 'Импорт', last20: 'Статистика 20 битв', battles: 'Боёв', noBattles: 'Пока нет сохранённых боёв', player: 'Игрок', gs: 'GS', diamond: 'DIAMOND', myTeam: 'Моя команда', enemyTeam: 'Команда противника', playersCount: 'игроков', allBattles: '‹ &nbsp; Все битвы', deleteBtn: 'Удалить', yourScore: 'Ваш счёт', yourKd: 'Ваш K/D' },
                EN: { title: 'Battle History', date: 'Date', map: 'Map', status: 'Status', top: 'Top', mode: 'Mode', score: 'Score', kills: 'Kills', deaths: 'Deaths', kd: 'K/D', turret: 'Turret', hull: 'Hull', augment: 'Augment', crystals: 'Crystals', stars: 'Stars', win: 'Victory', lose: 'Defeat', draw: 'Draw', dm: 'DM', clear: 'Clear', export: 'Export', import: 'Import', last20: 'Last 20 Match Stats', battles: 'Battles', noBattles: 'No saved battles yet', player: 'Player', gs: 'GS', diamond: 'DIAMOND', myTeam: 'My Team', enemyTeam: 'Enemy Team', playersCount: 'players', allBattles: '‹ &nbsp; All battles', deleteBtn: 'Delete', yourScore: 'Your Score', yourKd: 'Your K/D' }
            };
            const parseMapAndMode = (rawMapText) => {
                if (!rawMapText)
                    return { map: 'Unknown Map', mode: 'MM' };
                let text = rawMapText.trim();
                const modesList = ['CTF', 'TDM', 'DM', 'CP', 'SGE', 'RGB', 'JGR', 'TJR', 'ASL', 'AR'];
                let foundMode = 'MM';
                const parts = text.split(/\s+/);
                if (parts.length > 0) {
                    const lastWord = parts[parts.length - 1].toUpperCase();
                    if (modesList.includes(lastWord)) {
                        foundMode = parts.pop() || 'MM';
                        text = parts.join(' ');
                    }
                }
                const cleanMapName = text.replace(/\s+/g, ' ').trim();
                return { map: cleanMapName || 'Unknown', mode: foundMode };
            };
            const MAP_ICON_URL = chrome.runtime.getURL('assets/map-icon.png');
            let battleCardTemplatePromise = null;
            const loadBattleCardTemplate = () => {
                if (!battleCardTemplatePromise) {
                    battleCardTemplatePromise = fetch(chrome.runtime.getURL('templates/battle-history-card.html'))
                        .then(response => {
                        if (!response.ok)
                            throw new Error(`Failed to load battle card template: ${response.status}`);
                        return response.text();
                    });
                }
                return battleCardTemplatePromise;
            };
            const renderDetailedMatch = (b, dict, lang) => {
                const contentBlock = document.querySelector('.custom-history-content');
                if (!contentBlock)
                    return;
                const leftPanel = contentBlock.querySelector('.bh-left-panel');
                const rightPanel = contentBlock.querySelector('.bh-right-panel');
                if (leftPanel)
                    leftPanel.style.display = 'none';
                if (rightPanel)
                    rightPanel.style.display = 'none';
                const oldView = contentBlock.querySelector('.bh-detailed-view');
                if (oldView)
                    oldView.remove();
                const detailedView = document.createElement('div');
                detailedView.className = 'bh-detailed-view page';
                detailedView.style.cssText = 'flex-grow: 1; overflow-y: auto; padding-right: 1em; width: 100%; box-sizing: border-box;';
                let myTeamHtml = '';
                let enemyTeamHtml = '';
                let myTeamCount = 0;
                let enemyTeamCount = 0;
                const getGsClass = (gs) => {
                    if (gs >= 9999)
                        return 'gs-best';
                    if (gs >= 9001)
                        return 'gs-9000';
                    if (gs >= 8001)
                        return 'gs-8000';
                    if (gs >= 7001)
                        return 'gs-7000';
                    if (gs >= 6001)
                        return 'gs-6000';
                    if (gs >= 5001)
                        return 'gs-5000';
                    if (gs >= 4001)
                        return 'gs-4000';
                    if (gs >= 3001)
                        return 'gs-3000';
                    if (gs >= 2001)
                        return 'gs-2000';
                    if (gs >= 1001)
                        return 'gs-1000';
                    return 'gs-0';
                };
                (b.players || []).forEach(p => {
                    const isMeClass = p.isMe ? 'current-player' : '';
                    const gsClass = getGsClass(p.gs);
                    const gsFormatted = p.gs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
                    const scoreFormatted = p.score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
                    const crystalsFormatted = p.crystals.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
                    const rowHtml = `
                        <tr class="${isMeClass}">
                            <td class="player-cell">
                                <div class="player-icons">
                                    <img class="player-icon" src="${p.rank}" style="width: 24px; height: 24px; border: none; background: transparent; padding: 0;">
                                </div>
                                <span class="player-name">${p.name}</span>
                            </td>
                            <td class="gs ${gsClass}">${gsFormatted}</td>
                            <td>${scoreFormatted}</td>
                            <td>${p.kills}</td>
                            <td>${p.deaths}</td>
                            <td>${p.kd.toFixed(2)}</td>
                            <td class="reward">${crystalsFormatted}</td>
                            <td class="stars">${p.stars}</td>
                        </tr>
                    `;
                    if (p.isEnemy) {
                        enemyTeamHtml += rowHtml;
                        enemyTeamCount++;
                    }
                    else {
                        myTeamHtml += rowHtml;
                        myTeamCount++;
                    }
                });
                const statusLower = (b.status || '').toLowerCase();
                const isWin = statusLower.includes('victory') || statusLower.includes('победа');
                const isDraw = statusLower.includes('draw') || statusLower.includes('ничья');
                const isDM = statusLower === 'dm' || statusLower.includes('каждый сам за себя');
                let resultClass = isWin ? 'victory' : (isDraw ? 'draw' : 'defeat');
                let resultText = isWin ? dict.win : (isDraw ? dict.draw : dict.lose);
                if (isDM) {
                    resultClass = 'draw';
                    resultText = dict.dm;
                }
                const mapInfo = DataLoader.getMapInfo(b.map);
                const localizedMap = (mapInfo ? (lang === 'RU' ? mapInfo.ru : mapInfo.en) : translateMapName(b.map, lang)) || 'Unknown';
                const dateObj = new Date(b.date);
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                detailedView.innerHTML = `
                    <div class="toolbar">
                        <button class="button button-back" id="bh-detailed-back">${dict.allBattles}</button>
                        <div class="toolbar-right">
                            <button class="button button-delete" id="bh-detailed-delete">${dict.deleteBtn}</button>
                        </div>
                    </div>

                    <section class="result-hero">
                        <div class="hero-score">
                            <div class="hero-label">${dict.yourScore}</div>
                            <div class="hero-value">${(b.reputation || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")}</div>
                        </div>
                        <div class="hero-center">
                            <div class="hero-meta">${b.mode || 'MM'} · ${dateStr} · ${timeStr} · ${(b.players || []).length} ${dict.playersCount}</div>
                            <div class="hero-map">${localizedMap}</div>
                            <div class="hero-result ${resultClass}">${resultText}</div>
                        </div>
                        <div class="hero-score right">
                            <div class="hero-label">${dict.yourKd}</div>
                            <div class="hero-value">${(b.kd || 0).toFixed(2)}</div>
                        </div>
                    </section>

                    <section class="stats-wrapper">
                        ${myTeamCount > 0 ? `
                        <article class="team-panel my-team">
                            <header class="team-header">
                                <div class="team-title">${isDM ? dict.player : dict.myTeam}</div>
                                <div class="team-count">${myTeamCount}${dict.playersCount}</div>
                            </header>
                            <table class="players-table">
                                <thead>
                                    <tr>
                                        <th>${dict.player}</th><th>${dict.gs}</th><th>${dict.score}</th><th>K</th><th>D</th><th>K/D</th>
                                        <th class="bh-th-icon"><div class="bh-icon-crystal"></div></th>
                                        <th class="bh-th-icon"><div class="bh-icon-star"></div></th>
                                    </tr>
                                </thead>
                                <tbody>${myTeamHtml}</tbody>
                            </table>
                        </article>
                        ` : ''}

                        ${enemyTeamCount > 0 ? `
                        <article class="team-panel enemy-team">
                            <header class="team-header">
                                <div class="team-title">${dict.enemyTeam}</div>
                                <div class="team-count">${enemyTeamCount}${dict.playersCount}</div>
                            </header>
                            <table class="players-table">
                                <thead>
                                    <tr>
                                        <th>${dict.player}</th><th>${dict.gs}</th><th>${dict.score}</th><th>K</th><th>D</th><th>K/D</th>
                                        <th class="bh-th-icon"><div class="bh-icon-crystal"></div></th>
                                        <th class="bh-th-icon"><div class="bh-icon-star"></div></th>
                                    </tr>
                                </thead>
                                <tbody>${enemyTeamHtml}</tbody>
                            </table>
                        </article>
                        ` : ''}
                    </section>
                `;
                contentBlock.appendChild(detailedView);
                detailedView.querySelector('#bh-detailed-back')?.addEventListener('click', () => {
                    detailedView.remove();
                    if (leftPanel)
                        leftPanel.style.display = 'flex';
                    if (rightPanel)
                        rightPanel.style.display = 'flex';
                });
                detailedView.querySelector('#bh-detailed-delete')?.addEventListener('click', async () => {
                    try {
                        const db = await openDB();
                        const transaction = db.transaction('battles', 'readwrite');
                        const store = transaction.objectStore('battles');
                        if (b.id !== undefined) {
                            store.delete(b.id);
                        }
                        detailedView.remove();
                        if (leftPanel)
                            leftPanel.style.display = 'flex';
                        if (rightPanel)
                            rightPanel.style.display = 'flex';
                        renderBattleList(currentPage);
                    }
                    catch (e) {
                        console.error('[Tanki Battle History] Error deleting battle:', e);
                    }
                });
            };
            const buildBattleCard = async (b, dict, lang) => {
                const dateObj = new Date(b.date);
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const statusLower = (b.status || '').toLowerCase();
                const isWin = statusLower.includes('victory') || statusLower.includes('победа');
                const isDraw = statusLower.includes('draw') || statusLower.includes('ничья');
                const isDM = statusLower === 'dm' || statusLower.includes('каждый сам за себя');
                let statusClass = 'bh-card-result--loss';
                let statusLocalized = dict.lose;
                if (isDM) {
                    statusClass = 'bh-card-result--dm';
                    statusLocalized = dict.dm;
                }
                else if (isWin) {
                    statusClass = 'bh-card-result--win';
                    statusLocalized = dict.win;
                }
                else if (isDraw) {
                    statusClass = 'bh-card-result--draw';
                    statusLocalized = dict.draw;
                }
                const mapInfo = DataLoader.getMapInfo(b.map);
                const localizedMap = (mapInfo
                    ? (lang === 'RU' ? mapInfo.ru : mapInfo.en)
                    : translateMapName(b.map, lang)) || 'Unknown';
                const mapUpper = String(localizedMap).toUpperCase();
                const mapImage = mapInfo && mapInfo.image ? mapInfo.image : '';
                const modeUpper = String(b.mode || 'MM').toUpperCase();
                const topDisplay = b.top && b.top !== '-' ? `#${b.top}` : '—';
                const turretIcon = b.turretIcon
                    ? `<img class="bh-equip-img" src="${b.turretIcon}" alt="">`
                    : `<div class="bh-equip-placeholder">▰</div>`;
                const turretAugIcon = b.turretAugmentIcon
                    ? `<img class="bh-equip-img" src="${b.turretAugmentIcon}" alt="">`
                    : `<div class="bh-equip-placeholder">◇</div>`;
                const hullIcon = b.hullIcon
                    ? `<img class="bh-equip-img" src="${b.hullIcon}" alt="">`
                    : `<div class="bh-equip-placeholder">▱</div>`;
                const hullAugIcon = b.hullAugmentIcon
                    ? `<img class="bh-equip-img" src="${b.hullAugmentIcon}" alt="">`
                    : `<div class="bh-equip-placeholder">◇</div>`;
                const replacements = {
                    cardClass: `${statusClass} ${b.turretAugmentIcon || b.hullAugmentIcon ? '' : 'bh-card--no-aug'}`,
                    mapStyle: mapImage ? `style="background-image: linear-gradient(90deg, rgba(10,10,10,0.15), rgba(10,10,10,0.75)), url('${mapImage}'); background-size: cover; background-position: center;"` : '',
                    mapIconUrl: MAP_ICON_URL,
                    mapUpper,
                    mapLabel: dict.map,
                    statusLocalized,
                    scoreValue: String(b.reputation ?? 0),
                    scoreLabel: dict.score,
                    killsValue: String(b.kills ?? 0),
                    deathsValue: String(b.deaths ?? 0),
                    killsLabel: dict.kills,
                    deathsLabel: dict.deaths,
                    topDisplay,
                    topLabel: dict.top,
                    turretIcon,
                    turretLabel: dict.turret,
                    turretAugIcon,
                    augmentLabel: dict.augment,
                    hullIcon,
                    hullLabel: dict.hull,
                    hullAugIcon,
                    modeIcon: isDM ? '☠' : isWin ? '★' : '♟',
                    modeUpper,
                    crystalsValue: (b.crystals ?? 0).toLocaleString(),
                    starsValue: String(b.stars ?? 0),
                    dateTime: `${dateStr} · ${timeStr}`
                };
                let html = await loadBattleCardTemplate();
                for (const [key, value] of Object.entries(replacements)) {
                    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }
                const card = document.createElement('article');
                card.innerHTML = html;
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => renderDetailedMatch(b, dict, lang));
                return card;
            };
            const buildPageNumbers = (current, total) => {
                if (total <= 7) {
                    const arr = [];
                    for (let i = 1; i <= total; i++)
                        arr.push(i);
                    return arr;
                }
                const result = [];
                result.push(1);
                if (current > 4)
                    result.push('…');
                const start = Math.max(2, current - 1);
                const end = Math.min(total - 1, current + 1);
                for (let i = start; i <= end; i++)
                    result.push(i);
                if (current < total - 3)
                    result.push('…');
                result.push(total);
                return result;
            };
            const renderPagination = (current, total) => {
                const list = document.getElementById('bh-page-list');
                if (!list)
                    return;
                list.textContent = '';
                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'bh-page bh-page-arrow';
                prev.textContent = '‹';
                prev.disabled = current <= 1;
                prev.addEventListener('click', () => renderBattleList(current - 1));
                list.appendChild(prev);
                const pages = buildPageNumbers(current, total);
                for (const p of pages) {
                    if (p === '…') {
                        const dots = document.createElement('span');
                        dots.className = 'bh-page bh-page-dots';
                        dots.textContent = '…';
                        list.appendChild(dots);
                        continue;
                    }
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'bh-page' + (p === current ? ' bh-page-active' : '');
                    btn.textContent = String(p);
                    btn.addEventListener('click', () => renderBattleList(p));
                    list.appendChild(btn);
                }
                const next = document.createElement('button');
                next.type = 'button';
                next.className = 'bh-page bh-page-arrow';
                next.textContent = '›';
                next.disabled = current >= total;
                next.addEventListener('click', () => renderBattleList(current + 1));
                list.appendChild(next);
            };
            const renderBattleList = async (page = 1) => {
                updateNickname();
                const listEl = document.querySelector('.bh-list');
                if (!listEl)
                    return;
                await removeDuplicateBattles(currentNickname);
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
                const battles = await getAllBattles(currentNickname);
                battles.sort((a, b) => b.date - a.date);
                const recent20 = battles.slice(0, 20);
                let validTops = 0, sumTop = 0, totalKills = 0, totalDeaths = 0, totalScore = 0;
                recent20.forEach(b => {
                    const topNum = parseInt(b.top);
                    if (!isNaN(topNum)) {
                        sumTop += topNum;
                        validTops++;
                    }
                    totalKills += (b.kills || 0);
                    totalDeaths += (b.deaths || 0);
                    totalScore += (b.reputation || 0);
                });
                const avgTop = validTops > 0 ? Math.round(sumTop / validTops) : '-';
                const avgKd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : (totalKills > 0 ? totalKills.toFixed(2) : '0.00');
                const avgScore = recent20.length > 0 ? Math.round(totalScore / recent20.length) : '-';
                const topEl = document.getElementById('bh-stat-top');
                const kdEl = document.getElementById('bh-stat-kd');
                const scoreEl = document.getElementById('bh-stat-score');
                if (topEl)
                    topEl.textContent = avgTop !== '-' ? `#${avgTop}` : '-';
                if (kdEl)
                    kdEl.textContent = avgKd.toString();
                if (scoreEl)
                    scoreEl.textContent = avgScore !== '-' ? avgScore.toLocaleString() : '-';
                const totalPages = Math.max(1, Math.ceil(battles.length / ROWS_PER_PAGE));
                if (page > totalPages)
                    page = totalPages;
                if (page < 1)
                    page = 1;
                currentPage = page;
                const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
                const pageBattles = battles.slice(startIndex, startIndex + ROWS_PER_PAGE);
                listEl.innerHTML = '';
                if (pageBattles.length === 0) {
                    listEl.innerHTML = `<div class="bh-empty">${dict.noBattles}</div>`;
                }
                else {
                    const cards = await Promise.all(pageBattles.map(b => buildBattleCard(b, dict, lang)));
                    cards.forEach(card => listEl.appendChild(card));
                }
                renderPagination(currentPage, totalPages);
                const totalEl = document.getElementById('bh-total-battles');
                if (totalEl)
                    totalEl.textContent = String(battles.length);
            };
            const clearHistoryDb = () => {
                showClearConfirmModal(async () => {
                    try {
                        const db = await openDB();
                        const transaction = db.transaction('battles', 'readwrite');
                        const store = transaction.objectStore('battles');
                        const request = store.index('nickname').getAllKeys(currentNickname);
                        request.onsuccess = () => {
                            request.result.forEach((key) => store.delete(key));
                            renderBattleList(1);
                        };
                    }
                    catch (e) {
                        console.error('[Tanki Battle History] Error clearing DB:', e);
                    }
                });
            };
            const exportHistoryData = async () => {
                const battles = await getAllBattles(currentNickname);
                if (battles.length === 0)
                    return;
                const blob = new Blob([JSON.stringify(battles, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Tanki_BattleHistory_${currentNickname}_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            };
            const importHistoryData = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const target = e.target;
                    const file = target.files?.[0];
                    if (!file)
                        return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try {
                            const data = JSON.parse(ev.target.result);
                            if (Array.isArray(data)) {
                                for (const battle of data) {
                                    delete battle.id;
                                    await addBattle(battle);
                                }
                                await removeDuplicateBattles(currentNickname);
                                renderBattleList(1);
                            }
                        }
                        catch (err) {
                            console.error('[Tanki Battle History] Import error:', err);
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            };
            let historyPagePromise = null;
            const createHistoryPage = async () => {
                if (document.querySelector('.custom-history-overlay'))
                    return;
                updateNickname();
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
                try {
                    const templateUrl = chrome.runtime.getURL('templates/battle-history-overlay.html');
                    const response = await fetch(templateUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to load history template: ${response.status}`);
                    }
                    const template = await response.text();
                    const replacements = {
                        title: String(dict.title ?? ''),
                        clear: String(dict.clear ?? ''),
                        export: String(dict.export ?? ''),
                        import: String(dict.import ?? ''),
                        battles: String(dict.battles ?? 'Боёв'),
                        last20: String(dict.last20 ?? ''),
                        top: String(dict.top ?? ''),
                        kd: String(dict.kd ?? ''),
                        score: String(dict.score ?? '')
                    };
                    let html = template;
                    for (const [key, value] of Object.entries(replacements)) {
                        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                    }
                    const overlay = document.createElement('div');
                    overlay.className = 'custom-history-overlay';
                    overlay.style.display = 'none';
                    overlay.innerHTML = html;
                    document.body.appendChild(overlay);
                    overlay.querySelector('.custom-history-close')?.addEventListener('click', () => { overlay.style.display = 'none'; });
                    document.getElementById('bh-clear-btn')?.addEventListener('click', clearHistoryDb);
                    document.getElementById('bh-export-btn')?.addEventListener('click', exportHistoryData);
                    document.getElementById('bh-import-btn')?.addEventListener('click', importHistoryData);
                }
                catch (error) {
                    console.error('[Tanki Battle History] Error loading overlay template:', error);
                }
            };
            const ensureHistoryPage = () => {
                if (!historyPagePromise) {
                    historyPagePromise = createHistoryPage();
                }
                return historyPagePromise;
            };
            const injectFooterButton = () => {
                const footerList = document.querySelector('.FooterComponentStyle-footer ul');
                if (!footerList || footerList.querySelector('.custom-history-button'))
                    return;
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
                const btn = document.createElement('li');
                btn.className = 'FooterComponentStyle-containerMenu custom-history-button';
                btn.innerHTML = '<div></div>';
                btn.title = dict.title;
                btn.addEventListener('click', async () => {
                    await ensureHistoryPage();
                    const overlay = document.querySelector('.custom-history-overlay');
                    if (!overlay)
                        return;
                    await renderBattleList(1);
                    overlay.style.display = 'flex';
                });
                footerList.appendChild(btn);
            };
            const extractAndSaveBattleResult = async () => {
                updateNickname();
                const selfRow = document.querySelector('#selfUserBg');
                if (!selfRow || battleProcessed)
                    return;
                if (currentNickname === 'Unknown') {
                    const nickCell = selfRow.querySelector('.BattleKillBoardComponentStyle-col1, [class*="BattleKillBoardComponentStyle-col1"]');
                    if (nickCell) {
                        const raw = (nickCell.textContent || '').trim();
                        const clean = raw.replace(/^\[.*?\]\s*/, '').trim();
                        if (clean && clean !== 'Unknown') {
                            currentNickname = clean;
                            try {
                                localStorage.setItem(NICK_KEY, clean);
                            }
                            catch { }
                        }
                    }
                }
                if (currentNickname === 'Unknown')
                    return;
                try {
                    const scoreEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col3');
                    const killsEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col4');
                    const deathsEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col5');
                    if (!scoreEl || !killsEl || !deathsEl)
                        return;
                    const scoreText = (scoreEl.textContent || '').trim();
                    const killsText = (killsEl.textContent || '').trim();
                    const deathsText = (deathsEl.textContent || '').trim();
                    if (!scoreText || !killsText || !deathsText)
                        return;
                    battleProcessed = true;
                    let players = [];
                    const tbody = document.querySelector('.TableComponentStyle-tBody');
                    if (tbody) {
                        const allRows = Array.from(tbody.children);
                        let isEnemyTeam = false;
                        for (const row of allRows) {
                            if (row.id === 'rowSpace')
                                continue;
                            if (row.id === 'teamRowSpace') {
                                isEnemyTeam = true;
                                continue;
                            }
                            const nickEl = row.querySelector('.BattleKillBoardComponentStyle-col1 span.-whiteSpaceNoWrap');
                            if (!nickEl)
                                continue;
                            const rawNick = nickEl.textContent || '';
                            const rankImg = row.querySelector('.BattleKillBoardComponentStyle-rankIcon');
                            const rankSrc = rankImg ? rankImg.src : '';
                            const gsEl = row.querySelector('.BattleKillBoardComponentStyle-col2 span');
                            const gs = gsEl ? gsEl.textContent?.trim().replace(/\s/g, '') : '0';
                            const pScore = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col3')?.textContent || '0').replace(/\s/g, '')) || 0;
                            const pKills = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col4')?.textContent || '0').replace(/\s/g, '')) || 0;
                            const pDeaths = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col5')?.textContent || '0').replace(/\s/g, '')) || 0;
                            const pKd = parseFloat(row.querySelector('.BattleKillBoardComponentStyle-col6')?.textContent || '0') || 0;
                            const pCrystals = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col7')?.textContent || '0').replace(/\s/g, '')) || 0;
                            const pStars = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col8')?.textContent || '0').replace(/\s/g, '')) || 0;
                            const isMe = row.id === 'selfUserBg';
                            players.push({
                                name: rawNick,
                                rank: rankSrc,
                                gs: parseInt(gs || '0') || 0,
                                score: pScore, kills: pKills, deaths: pDeaths, kd: pKd, crystals: pCrystals, stars: pStars,
                                isEnemy: isEnemyTeam,
                                isMe: isMe
                            });
                        }
                    }
                    const mapEl = document.querySelector('.BattleResultHeaderComponentStyle-mapName');
                    const rawMapText = mapEl ? mapEl.textContent?.trim() || '' : 'Unknown Map';
                    const parsedMapData = parseMapAndMode(rawMapText);
                    const statusEl = document.querySelector('.BattleResultHeaderComponentStyle-resultText') ||
                        document.querySelector('[class*="descriptionVictory"], [class*="descriptionDefeat"], [class*="descriptionDraw"]');
                    const isDM = parsedMapData.mode.toUpperCase() === 'DM' || (statusEl && statusEl.textContent?.trim() === '');
                    const statusText = isDM ? 'DM' : (statusEl ? statusEl.textContent?.trim() || 'Victory' : 'Victory');
                    let topVal = '-';
                    if (selfRow.parentElement) {
                        const allRows = Array.from(selfRow.parentElement.children);
                        const selfIndex = allRows.indexOf(selfRow);
                        const teamDividerIndex = allRows.findIndex((r) => r.id === 'teamRowSpace');
                        let teamRows = [];
                        if (teamDividerIndex === -1)
                            teamRows = allRows;
                        else if (selfIndex < teamDividerIndex)
                            teamRows = allRows.slice(0, teamDividerIndex);
                        else
                            teamRows = allRows.slice(teamDividerIndex + 1);
                        const actualPlayers = teamRows.filter((r) => r.id && r.id !== 'rowSpace' && r.id !== 'teamRowSpace');
                        const rank = actualPlayers.indexOf(selfRow) + 1;
                        if (rank > 0)
                            topVal = rank.toString();
                    }
                    const score = parseInt(scoreText.replace(/\s/g, '')) || 0;
                    const kills = parseInt(killsText.replace(/\s/g, '')) || 0;
                    const deaths = parseInt(deathsText.replace(/\s/g, '')) || 0;
                    const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
                    const crystals = parseInt((selfRow.querySelector('.BattleKillBoardComponentStyle-col7')?.textContent || '0').replace(/\s/g, '')) || 0;
                    const stars = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col8')?.textContent || '0') || 0;
                    const eq = modules.equipmentTracker.get();
                    if (currentNickname === 'Unknown')
                        return;
                    const battleData = {
                        nickname: currentNickname, date: Date.now(), status: statusText, map: parsedMapData.map,
                        mode: parsedMapData.mode, top: topVal, reputation: score, kills, deaths,
                        kd, crystals, stars,
                        turretIcon: eq?.turret ?? '',
                        turretAugmentIcon: eq?.turretAugment ?? '',
                        hullIcon: eq?.hull ?? '',
                        hullAugmentIcon: eq?.hullAugment ?? '',
                        players: players
                    };
                    await addBattle(battleData);
                }
                catch (err) {
                    console.error('[Tanki Battle History] Error saving battle result:', err);
                    battleProcessed = false;
                }
            };
            return () => {
                if (!utils.getSetting('k_history', false))
                    return;
                if (!initialized) {
                    initialized = true;
                    document.addEventListener('keydown', (e) => {
                        const overlay = document.querySelector('.custom-history-overlay');
                        const isHistoryOpen = overlay && window.getComputedStyle(overlay).display !== 'none';
                        if (!isHistoryOpen)
                            return;
                        if (e.code === 'Space' || /^(Digit|Numpad)[1-7]$/.test(e.code)) {
                            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                                return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                    }, true);
                    window.addEventListener('keydown', (e) => {
                        const overlay = document.querySelector('.custom-history-overlay');
                        if (overlay && overlay.style.display === 'flex') {
                            if (e.code === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                                if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                                    return;
                                overlay.style.display = 'none';
                                e.preventDefault();
                            }
                        }
                    });
                    window.addEventListener('mousedown', (e) => {
                        const overlay = document.querySelector('.custom-history-overlay');
                        if (overlay && overlay.style.display === 'flex' && (e.button === 3 || e.button === 4)) {
                            overlay.style.display = 'none';
                            e.preventDefault();
                        }
                    });
                    setTimeout(() => {
                        updateNickname();
                        if (currentNickname !== 'Unknown')
                            removeDuplicateBattles(currentNickname);
                    }, 5000);
                }
                injectFooterButton();
                void ensureHistoryPage();
                const selfRow = document.querySelector('#selfUserBg');
                const inResults = document.querySelector('.BattleResultHeaderComponentStyle-resultText');
                if (selfRow && inResults) {
                    extractAndSaveBattleResult();
                }
                else if (!inResults) {
                    battleProcessed = false;
                }
            };
        })(),
    };
    state.lang = utils.getLang();
    let isMasterUpdateScheduled = false;
    let lastFullRefresh = 0;
    let refreshScheduled = false;
    const REFRESH_INTERVAL_MS = 150;
    const runHeavyModules = () => {
        lastFullRefresh = performance.now();
        refreshScheduled = false;
        modules.changeCounter.onTick();
        modules.welcomeModal();
        modules.hideNickname();
        modules.hideCurrency();
        modules.weaponAugmentTracker();
        modules.customGarageSkins();
        try {
            if (state.currentScreen === 'lobby' || state.currentScreen === 'loading') {
                modules.customPlayButton();
            }
            if (state.friendsMenuOpen) {
                modules.customFriends();
            }
            if (state.currentScreen === 'lobby' || state.currentScreen === 'garage' || state.currentScreen === 'match_results') {
                modules.customTrophies();
            }
            if (state.currentScreen === 'garage') {
                modules.autoUpgrade();
                modules.augmentSpecs();
                modules.customPaints();
            }
        }
        catch (e) {
            console.error("[Kaspersky's Inventions] Ошибка в модуле:", e);
        }
    };
    const scheduleHeavyModules = () => {
        const now = performance.now();
        const elapsed = now - lastFullRefresh;
        if (elapsed >= REFRESH_INTERVAL_MS) {
            runHeavyModules();
            return;
        }
        if (refreshScheduled)
            return;
        refreshScheduled = true;
        const wait = REFRESH_INTERVAL_MS - elapsed;
        window.setTimeout(() => {
            refreshScheduled = false;
            runHeavyModules();
        }, wait);
    };
    function syncKillBoardDoubleHeader() {
        const thead = document.querySelector('.BattleKillBoardComponentStyle-tableContainer table > thead');
        if (!thead)
            return;
        if (thead.children.length === 1) {
            const headRow = thead.children[0];
            const clone = headRow.cloneNode(true);
            clone.classList.add('kasp-cloned-header');
            thead.appendChild(clone);
        }
    }
    const performMasterCheck = () => {
        isMasterUpdateScheduled = false;
        const currentLang = utils.getLang();
        if (currentLang !== state.lang)
            applyLanguageChange();
        let newScreen = state.currentScreen;
        if (document.querySelector('.ApplicationLoaderComponentStyle-container')) {
            newScreen = 'loading';
        }
        else if (document.querySelector('.BattleHudComponentStyle-container')) {
            newScreen = 'battle';
        }
        else if (document.querySelector('.GarageCommonStyle-positionContent, .GarageItemComponent-container, .ContainerInfoComponentStyle-lootBoxContainer')) {
            newScreen = 'garage';
        }
        else if (document.querySelector('.MainScreenComponentStyle-blockMainMenu')) {
            newScreen = 'lobby';
        }
        else if (document.querySelector('.BattleResultHeaderComponentStyle-resultText')) {
            newScreen = 'match_results';
        }
        const screenChanged = newScreen !== state.currentScreen;
        state.currentScreen = newScreen;
        if (screenChanged) {
            if (newScreen === 'loading' || newScreen === 'battle') {
                const specsTooltip = document.getElementById('kasp-specs-tooltip');
                if (specsTooltip)
                    specsTooltip.style.display = 'none';
                const quickUpgradeOverlay = document.getElementById('quick-upgrade-overlay');
                if (quickUpgradeOverlay && quickUpgradeOverlay.closeDialogMethod) {
                    quickUpgradeOverlay.closeDialogMethod();
                }
                const historyOverlay = document.querySelector('.custom-history-overlay');
                if (historyOverlay)
                    historyOverlay.style.display = 'none';
                const clearConfirmOverlay = document.getElementById('clear-confirm-overlay');
                if (clearConfirmOverlay && clearConfirmOverlay.closeDialogMethod) {
                    clearConfirmOverlay.closeDialogMethod();
                }
                else if (clearConfirmOverlay) {
                    clearConfirmOverlay.remove();
                }
            }
        }
        const isFriendsMenuOpen = !!document.querySelector('.FriendListComponentStyle-containerFriends, .InvitationWindowsComponentStyle-centerBlock');
        const friendsChanged = isFriendsMenuOpen !== state.friendsMenuOpen;
        state.friendsMenuOpen = isFriendsMenuOpen;
        const isSettingsOpen = !!document.querySelector('.SettingsComponentStyle-blockContentOptions');
        if (isSettingsOpen !== state.settingsOpen) {
            state.settingsOpen = isSettingsOpen;
            if (isSettingsOpen) {
                coreSettings.inject();
            }
            else {
                coreSettings.onClose();
            }
        }
        if (screenChanged || friendsChanged) {
            lastFullRefresh = 0;
            if (refreshScheduled)
                refreshScheduled = false;
            runHeavyModules();
        }
        else {
            scheduleHeavyModules();
        }
        if (state.currentScreen === 'garage') {
            modules.garageButtons();
        }
        if (state.currentScreen === 'match_results' || state.currentScreen === 'lobby') {
            modules.battleHistory();
            syncKillBoardDoubleHeader();
        }
    };
    const masterObserver = new MutationObserver(() => {
        if (document.querySelector('.BattleTabStatisticComponentStyle-container')) {
            modules.changeCounter.sync();
            modules.zeroResists.sync();
            modules.equipmentTracker.sync();
        }
        if (document.querySelector('.GarageCommonStyle-positionContent, .ContainerInfoComponentStyle-lootBoxContainer')) {
            modules.augmentSpecs();
            modules.autoUpgrade();
        }
        if (!isMasterUpdateScheduled) {
            isMasterUpdateScheduled = true;
            requestAnimationFrame(performMasterCheck);
        }
    });
    const applyLanguageChange = () => {
        const newLang = utils.getLang();
        if (newLang === state.lang)
            return;
        state.lang = newLang;
        lastFullRefresh = 0;
        if (refreshScheduled)
            refreshScheduled = false;
        if (state.settingsOpen) {
            const oldTab = document.getElementById('kaspersky-tab');
            if (oldTab)
                oldTab.remove();
            const oldContent = document.getElementById('kaspersky-settings-content');
            if (oldContent)
                oldContent.remove();
            const oldTooltip = document.getElementById('kaspersky-reload-tooltip');
            if (oldTooltip)
                oldTooltip.remove();
            coreSettings.inject();
        }
        if (!isMasterUpdateScheduled) {
            isMasterUpdateScheduled = true;
            requestAnimationFrame(performMasterCheck);
        }
    };
    const boot = () => {
        state.lang = utils.getLang();
        masterObserver.observe(document.documentElement, { childList: true, subtree: true });
        window.setInterval(() => modules.customGarageSkins(), 250);
        const langObserver = new MutationObserver(() => {
            applyLanguageChange();
        });
        langObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['lang']
        });
        if (!document.documentElement.lang) {
            document.addEventListener('DOMContentLoaded', () => {
                applyLanguageChange();
            }, { once: true });
            window.setTimeout(() => {
                applyLanguageChange();
            }, 500);
            window.setTimeout(() => {
                applyLanguageChange();
            }, 2000);
        }
    };
    if (document.documentElement) {
        boot();
    }
    else {
        document.addEventListener('DOMContentLoaded', boot);
    }
})();
