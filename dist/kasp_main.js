"use strict";
(function () {
    'use strict';
    if (window !== window.top)
        return;
    const loaderBg = chrome.runtime.getURL("assets/background.png");
    document.documentElement.style.setProperty('--kasp-loader-bg', `url("${loaderBg}")`);
    const DataLoader = (() => {
        const state = {
            paints: null,
            augments: null,
            shared: null,
            ready: false,
            error: null,
        };
        const readyPromise = (async () => {
            try {
                const [paintsRes, augmentsRes] = await Promise.all([
                    fetch(chrome.runtime.getURL('database/paints.json')),
                    fetch(chrome.runtime.getURL('database/augments.json')),
                ]);
                if (!paintsRes.ok)
                    throw new Error('paints.json: HTTP ' + paintsRes.status);
                if (!augmentsRes.ok)
                    throw new Error('augments.json: HTTP ' + augmentsRes.status);
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
                state.ready = true;
                console.log(`[KI] DB loaded: paints=${Object.keys(state.paints).length}, augments=${Object.keys(state.augments).length}`);
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
        'k_hideNicknameXP'
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
    });
    const utils = {
        getLang: () => {
            const htmlLang = document.documentElement.lang || '';
            if (htmlLang.toLowerCase().includes('ru'))
                return 'RU';
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
            { id: 'k_auto_upgrade', label: { RU: 'Быстрое улучшение вооружения [Нестабильно]', EN: 'Quick weapon upgrades [Unstable]' }, default: false },
            { id: 'k_friends', label: { RU: 'Метки и категории друзей', EN: 'Friend tags & categories' }, default: false },
            { id: 'k_paints', label: { RU: 'Умный поиск красок', EN: 'Smart paint search' }, default: false },
            { id: 'k_hideCurrency', label: { RU: 'Скрыть валюту', EN: 'Hide currency' }, default: false },
            { id: 'k_hideNicknameXP', label: { RU: 'Скрыть никнейм и опыт', EN: 'Hide nickname and score' }, default: false }
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
                    utils.injectStyle(`
                        .SettingsComponentStyle-blockContentOptions > ul { position: relative !important; overflow-y: auto !important; scrollbar-width: none !important; }
                        .SettingsComponentStyle-blockContentOptions > ul::-webkit-scrollbar { display: none !important; }
                        #kaspersky-tab { position: relative !important; width: 100% !important; height: 5em !important; z-index: 5; display: flex; align-items: center; justify-content: flex-start; cursor: pointer; margin-top: 21em; }
                        #kaspersky-tab span { font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1.125em; text-transform: uppercase; margin-left: 1.875em; margin-top: 0.1em; color: rgba(255, 255, 255, 0.6); position: relative; z-index: 5; transition: 0.5s; }
                        #kaspersky-tab span:hover, #kaspersky-tab.SettingsMenuComponentStyle-activeItemOptions span { color: white; }
                        .kasp-hide-native-slider .SettingsMenuComponentStyle-slideMenuOptions { opacity: 0 !important; }
                        .kasp-fake-highlight { display: none; flex-direction: column; justify-content: center; background: linear-gradient(to right, rgb(46, 50, 53), rgba(46, 50, 53, 0)); width: 18em; height: 2.5em; position: absolute; left: 0; top: 1.25em; z-index: 1; pointer-events: none; }
                        .kasp-fake-line { background-color: rgb(255, 188, 9); box-shadow: rgb(255, 188, 9) 0px 0px 0.676em 0px; width: 0.313em; height: 2.5em; position: absolute; left: 0; top: 0; z-index: 3; }
                        #kaspersky-tab.SettingsMenuComponentStyle-activeItemOptions .kasp-fake-highlight { display: flex; }
                        .kasp-hidden { display: none !important; }
                        #kaspersky-settings-content { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; width: 46.875em; height: 100%; margin-left: 2.625em; margin-top: 0px; padding: 1.875em 1.875em 0px; position: relative; background-color: rgba(255, 255, 255, 0.1); overflow-x: hidden; overflow-y: auto; scrollbar-color: rgb(188, 188, 188) rgba(255, 255, 255, 0.2); scrollbar-width: thin; }
                        .kasp-toggle-row { display: flex; align-items: center; justify-content: flex-start; width: 100%; height: 2.25em; margin-bottom: 1.25em; }
                        .kasp-toggle-switch { width: 2.75em; height: 1.5em; border: 0.063em solid rgba(255, 255, 255, 0.2); border-radius: 6.25rem; background-color: rgba(191, 213, 255, 0.25); display: flex; align-items: center; position: relative; transition: background-color 0.2s; flex-shrink: 0; cursor: pointer; }
                        .kasp-toggle-row.kasp-active .kasp-toggle-switch { background-color: rgba(118, 255, 51, 0.25); }
                        .kasp-toggle-switch::before { content: ""; position: absolute; width: 1em; height: 1em; left: 0.25em; background: url(https://s.eu.tankionline.com/static/images/incorrectCheck.1918884a.svg) 50% 50% / 100% 100% no-repeat; transition: left 0.2s ease, background 0.2s ease; }
                        .kasp-toggle-row.kasp-active .kasp-toggle-switch::before { background: url(https://s.eu.tankionline.com/static/images/correct.afad1b22.svg) 50% 50% / 100% 100% no-repeat; left: 1.5em; }
                        .kasp-toggle-label { color: rgba(255, 255, 255, 0.5); font-family: BaseFontRegular, FallbackFontRegular, sans-serif; font-size: 1em; margin-left: 1em; margin-right: 1em; z-index: 2; user-select: none; cursor: pointer; }
                        .kasp-toggle-row.kasp-active .kasp-toggle-label { color: rgb(255, 255, 255); }
                        .kasp-tooltip { position: fixed !important; background-color: #032930 !important; border-radius: .4em !important; box-shadow: 0 0 .2em rgba(0, 0, 0, .5) !important; color: #fff !important; padding: .3em .7em !important; text-transform: uppercase !important; transform: translate(-50%, -3.3em) !important; z-index: 99999 !important; pointer-events: none !important; font-family: BaseFontMedium, FallbackFontMedium, sans-serif !important; white-space: nowrap !important; font-size: 1.3vh !important; }
                        .kasp-tooltip::before { border: .6em solid transparent !important; border-top-color: #032930 !important; content: "" !important; height: 0 !important; left: 50% !important; position: absolute !important; top: calc(100% - 1px) !important; transform: translateX(-50%) !important; width: 0 !important; }
                    `, 'kasp-settings-styles');
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
                    utils.injectStyle(`
                        .PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory { position: relative !important; }
                        .kasp-search-wrapper { position: absolute; left: 0em; top: 50%; transform: translateY(-50%); z-index: 10; }
                        .kasp-SearchInputComponentStyle-search { margin: 0; width: 18em; }
                        .kasp-SearchInputComponentStyle-searchInput { height: 3.125em; background-color: transparent; border-radius: 0.5rem; box-sizing: border-box; display: flex; align-items: center; position: relative; width: 100%; }
                        .kasp-SearchInputComponentStyle-searchInput input { width: 100%; height: 100%; margin: 0; padding-left: 1.063em; padding-right: 3.375em; border: 0 transparent; outline: none; box-sizing: border-box; border-radius: 0.5rem; font-size: 1em; color: rgb(255, 255, 255); background: initial; box-shadow: rgb(255, 255, 255) 0 0 0 1px; transition: box-shadow 0.2s; }
                        .kasp-SearchInputComponentStyle-searchInput input:hover, .kasp-SearchInputComponentStyle-searchInput input:focus { box-shadow: rgb(255, 255, 255) 0 0 0 2px !important; }
                        .kasp-SearchInputComponentStyle-searchInput input::placeholder { color: rgba(255, 255, 255, 0.5); }
                        .kasp-search-icon { position: absolute; right: 0.875em; width: 1.5em; height: 1.5em; background-image: url(https://s.eu.tankionline.com/static/images/search.8c2b7c7b.svg); background-size: contain; background-repeat: no-repeat; background-position: center center; pointer-events: none; }
                        .kasp-paints-container { display: flex !important; flex-direction: column !important; flex-wrap: wrap !important; height: 11.875em !important; max-height: 11.875em !important; overflow-x: auto !important; overflow-y: hidden !important; gap: 0.625em !important; }
                        .kasp-paints-container > div { display: contents !important; }
                        .kasp-paints-container .garage-item { flex: 0 0 auto; }
                        .kasp-paints-container .garage-item[style*="display: none"] { display: none !important; }
                    `, 'kasp-paints-styles');
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
                        html += `<ul>${item.subItems.map((sub) => `<li>${sub[lang] || sub['EN']}</li>`).join('')}</ul>`;
                    }
                    html += `</li>`;
                    return html;
                }).join('');
            };
            const closeSpecsModal = () => {
                const overlay = document.querySelector('.custom-specs-modal-wrapper');
                if (overlay)
                    overlay.remove();
                document.querySelectorAll('.custom-card-specs-btn.active').forEach(btn => btn.classList.remove('active'));
            };
            const openSpecsModal = (deviceData, deviceUrl) => {
                if (!deviceData)
                    return;
                closeSpecsModal();
                const lang = state.lang;
                const wrapper = document.createElement('div');
                wrapper.className = 'custom-specs-modal-wrapper';
                const localizedName = deviceData.name[lang] || deviceData.name['EN'] || "Unknown Device";
                const advList = renderList(deviceData.advantages, lang);
                const disadvList = renderList(deviceData.disadvantages, lang);
                wrapper.innerHTML = `
                    <div class="custom-specs-modal-content">
                        <div class="custom-specs-close-btn"></div>
                        <h1 style="font-family: BaseFontBold; text-transform: uppercase; font-size: 3em; margin-bottom: 0;">${localizedName}</h1>
                        <span style="color: rgb(191, 213, 255); font-size: 1.2em; text-transform: uppercase;">${t[lang].specsTitle}</span>
                        <div class="device-container">
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
                        </div>
                    </div>
                `;
                wrapper.addEventListener('click', (e) => {
                    if (e.target === wrapper || e.target.classList.contains('custom-specs-close-btn')) {
                        closeSpecsModal();
                    }
                });
                document.body.appendChild(wrapper);
                if (deviceUrl) {
                    const activeCardBtn = document.querySelector(`.custom-card-specs-btn[data-url="${deviceUrl}"]`);
                    if (activeCardBtn)
                        activeCardBtn.classList.add('active');
                }
            };
            const injectButtons = () => {
                if (!utils.getSetting('k_augments', false))
                    return;
                const cardsImgs = document.querySelectorAll('img.SkinCellStyle-iconCell');
                cardsImgs.forEach(node => {
                    const img = node;
                    const card = img.parentElement;
                    if (!card)
                        return;
                    const url = img.src;
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
                        btn.title = "Specs";
                        btn.dataset.url = url;
                        btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openSpecsModal(DataLoader.getDevice(url), url);
                        });
                        card.appendChild(btn);
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
                    if (state.currentScreen !== 'garage')
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
                    utils.injectStyle(`
                        .custom-card-specs-btn { position: absolute; bottom: 0.5em; left: 0.5em; width: 2.5em; height: 2.5em; border-radius: 30%; background-color: rgba(0, 25, 38, 0.7); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; border: 0.063em solid rgba(191, 213, 255, 0.5); transition: all 0.4s ease; }
                        .custom-card-specs-btn:hover, .custom-card-specs-btn.active { background-color: rgb(119, 254, 51); border-color: transparent; box-shadow: 0 0 10px rgba(119, 254, 51, 0.4); }
                        .custom-card-specs-icon { width: 1.3em; height: 1.3em; display: block; background-color: rgb(191, 213, 255); -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg); mask-image: url(https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg); -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; transition: background-color 0.4s ease; }
                        .custom-card-specs-btn:hover .custom-card-specs-icon, .custom-card-specs-btn.active .custom-card-specs-icon { background-color: rgb(7, 26, 40); }
                        .custom-specs-modal-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); z-index: 99999; display: flex; justify-content: flex-end; }
                        .custom-specs-modal-content { user-select: none; font-size: max(min(1.48148vh, 1vw), 3px); font-family: BaseFontRegular, FallbackFontRegular; pointer-events: auto; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; background: radial-gradient(192.86% 100% at 0% 100%, rgba(191, 213, 255, 0.25) 0%, rgba(191, 213, 255, 0) 100%), rgb(0, 25, 38); height: 100%; max-width: 57em; position: absolute; right: 0px; width: 57em; padding: 2em; box-sizing: border-box; color: white; }
                        .custom-specs-close-btn { position: absolute; top: 2em; right: 2em; width: 1.5em; height: 1.5em; cursor: pointer; background-image: url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg); background-repeat: no-repeat; background-size: contain; background-position: center center; z-index: 10; }
                        .custom-specs-close-btn:hover { background-image: url(https://s.eu.tankionline.com/static/images/deleteHoverModal.3aceb055.svg); }
                        .device-container { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; border: .063rem solid rgba(125, 157, 186, .4); background: #1a324466; border-radius: .375rem; position: relative; overflow: hidden; margin-top: 3em; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; }
                        .device-stats-wrapper { display: flex; width: 100%; box-sizing: border-box; }
                        .device-stats { padding: 1.125rem 1.25rem; flex: 1; }
                        .device-stats:first-child { border-right: .063rem solid rgba(125, 157, 186, .4); }
                        .device-stats .heading { font-weight: 600; font-family: BaseFontBold, FallbackFontBold, sans-serif; text-transform: uppercase; color: #46df11; display: flex; align-items: center; margin-bottom: .625rem; font-size: 1.1em; }
                        .device-stats.negative .heading { color: #f33; }
                        .device-stats .heading::before { content: ""; min-width: 1.2rem; min-height: 1.2rem; width: 1.2rem; height: 1.2rem; margin-right: .625rem; background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="%2346df11"/><path d="M12 7V17M7 12H17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'); background-size: contain; background-position: center; background-repeat: no-repeat; }
                        .device-stats.negative .heading::before { background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="%23f33"/><path d="M7 12H17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'); }
                        .device-stats ul { list-style: none; padding: 0; margin: 0; }
                        .device-stats ul li { position: relative; padding-left: 1.2rem; margin-bottom: 0.4rem; font-size: 1.05em; line-height: 1.4; color: white; }
                        .device-stats ul li::before { content: "\\25b8"; color: #46df11; position: absolute; left: 0; top: 0; font-size: 1.2em; line-height: 1.1; }
                        .device-stats.negative ul li::before { color: #f33; }
                        .device-stats ul ul { margin-top: 0.4rem; margin-bottom: 0.2rem; margin-left: 0.5rem; }
                        .text-pink { color: #ff33cc; } .text-green { color: #df9e11; } .text-yellow { color: #ffcc00; } .text-purple { color: #cc66ff; } .text-blue { color: #0095ff; } .text-red { color: #e00b0b; }
                    `, 'kasp-augment-specs-styles');
                    window.addEventListener('keydown', (e) => {
                        const overlay = document.querySelector('.custom-specs-modal-wrapper');
                        if (overlay) {
                            if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                                if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                                    return;
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                closeSpecsModal();
                            }
                        }
                    }, true);
                    window.addEventListener('mousedown', (e) => {
                        const overlay = document.querySelector('.custom-specs-modal-wrapper');
                        if (overlay && (e.button === 3 || e.button === 4)) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                    }, true);
                    window.addEventListener('mouseup', (e) => {
                        const overlay = document.querySelector('.custom-specs-modal-wrapper');
                        if (overlay && (e.button === 3 || e.button === 4)) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            closeSpecsModal();
                        }
                    }, true);
                }
                const loadingScreen = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
                if (loadingScreen)
                    closeSpecsModal();
                if (state.currentScreen === 'garage')
                    scheduleUpdate();
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
                        .ClientInfoComponentStyle-container { display: none !important; }
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
                    utils.injectStyle(`
                        .custom-friends-sidebar { position: absolute; display: flex; flex-direction: column; align-items: center; z-index: 10; }
                        .custom-friends-sidebar.sidebar-friends { top: 1.7em !important; left: -3.5em !important; gap: 0.25em; }
                        .custom-friends-sidebar.sidebar-invites { top: 8.5em !important; left: -3.5em !important; gap: 0.25em; }
                        .custom-filter-btn { display: flex; justify-content: center; align-items: center; width: 2.5em; height: 2.5em; cursor: pointer; border-radius: 6.25em; background-color: transparent; }
                        .custom-filter-btn:hover { box-shadow: rgb(191, 213, 255) 0em 0em 0em 0.125em; }
                        .custom-filter-btn:active, .custom-filter-btn.active { background-color: rgba(255, 255, 255, 0.15); }
                        .custom-filter-btn img { width: 2.5em; height: 2.5em; pointer-events: none; }
                        .custom-filter-btn:first-child img { width: 1.5em; height: 1.5em; }
                        .custom-friends-sidebar.sidebar-invites .custom-filter-btn:nth-child(2),
                        .custom-friends-sidebar.sidebar-invites .custom-filter-btn:nth-child(3) { display: none !important; }
                        .FriendListComponentStyle-scrollCommunity { display: grid !important; grid-template-columns: repeat(2, 35em) !important; justify-content: space-between !important; row-gap: 0.5em !important; min-height: 50em !important; align-content: start !important; width: 72.375em !important; height: calc(100% - 661em) !important; }
                        .FriendListComponentStyle-blockList { width: 35em !important; box-sizing: border-box; margin: 0 !important; position: relative !important; }
                        .FriendListComponentStyle-stringCommunity { display: contents !important; }
                        .InvitationWindowsComponentStyle-usersScroll { width: 100% !important; display: grid !important; grid-template-columns: repeat(2, 1fr) !important; column-gap: 0em !important; row-gap: 0.5em !important; align-content: start !important; box-sizing: border-box !important; }
                        .InvitationWindowsComponentStyle-usersScroll > div { display: contents !important; }
                        .InvitationWindowsComponentStyle-usersScroll > div > div { width: 35em !important; box-sizing: border-box; margin: 0 !important; position: relative !important; }
                        .custom-rarity-badge { width: 0.75em !important; height: 0.75em !important; margin-left: 0px !important; position: absolute !important; top: 0px !important; left: 0px !important; z-index: 5; pointer-events: none; }
                        .rarity-blue { filter: invert(34%) sepia(76%) saturate(2266%) hue-rotate(149deg) brightness(104%) contrast(103%); }
                        .rarity-purple { filter: invert(34%) sepia(59%) saturate(1928%) hue-rotate(223deg) brightness(105%) contrast(102%); }
                        .rarity-yellow { filter: invert(34%) sepia(48%) saturate(2983%) hue-rotate(359deg) brightness(104%) contrast(104%); }
                        .rarity-red { filter: invert(71%) sepia(61%) saturate(2771%) hue-rotate(337deg) brightness(96%) contrast(111%); }
                        .custom-category-row { display: flex; justify-content: center; align-items: center; gap: 0.75em; padding: 0.5em 0.5em; margin-top: 0.1em; }
                        .custom-category-menu-btn { width: 2.5em; height: 2.5em; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background-color, transform, box-shadow; }
                        .custom-category-menu-btn:hover { box-shadow: rgb(191, 213, 255) 0em 0em 0em 0.125em; }
                        .custom-category-menu-btn.active { background-color: rgba(255, 255, 255, 0.15); }
                        .custom-category-menu-btn img { width: 2.5em; height: 2.5em; pointer-events: none; }
                    `, 'kasp-friends-styles');
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
            const CURRENT_VERSION = '2.4';
            const STORAGE_KEY = 'kasp_last_version';
            let hasChecked = false;
            const t = {
                RU: {
                    version: `ВЕРСИЯ ${CURRENT_VERSION}`,
                    intro: `Огромное спасибо, что пользуетесь Kaspersky's Inventions! Мы ценим ваше внимание к проекту и с каждым обновлением будем радовать вас новыми функциями.`,
                    role1: `Идею создал`,
                    role2: `В создании участвовали`,
                    role3: `Качество оценивали`,
                    outro: `Проект выражает им огромную благодарность!`,
                    close: `ЗАКРЫТЬ`
                },
                EN: {
                    version: `VERSION ${CURRENT_VERSION}`,
                    intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
                    role1: `Idea Created By`,
                    role2: `Co-created By`,
                    role3: `Quality Assessed By`,
                    outro: `The project expresses huge gratitude to them!`,
                    close: `CLOSE`
                }
            };
            function showWelcomeModal() {
                const lang = state.lang;
                const dict = t[lang] || t['EN'];
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
                dialog.innerHTML = `
                    <div style="text-align: center; margin-bottom: 1.5em;">
                        <h1 style="font-family: BaseFontBold, FallbackFontBold, sans-serif; font-size: 2.2em; color: rgb(211 211 211); margin: 0 0 0.2em 0; text-transform: uppercase; letter-spacing: 0.5px;">Kaspersky's Inventions</h1>
                        <h2 style="font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 1.1em; color: rgba(255, 255, 255, 0.6); margin: 0; text-transform: uppercase; letter-spacing: 1px;">${dict.version}</h2>
                    </div>
                    
                    <div style="font-size: 1.05em; line-height: 1.4; color: rgb(220, 220, 220); margin-bottom: 2em; text-align: center;">
                        <p style="margin-bottom: 1.5em;">${dict.intro}</p>
                        
                        <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role1}</p>
                        <p style="margin: 0.2em 0 1em 0; font-family: BaseFontBold, FallbackFontBold, sans-serif; color: white; font-size: 1.2em;">Kaspersky</p>
                        
                        <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role2}</p>
                        <p style="margin: 0.2em 0 1em 0; color: white; line-height: 1.3;">
                            ChatGPT<br>
                            DeepSeek<br>
                            Claude Sonnet 5<br>
                            Claude Haiku 4.5<br>
                            Gemini 3.5 Flash-Lite<br>
                            Gemini 3.8 Flash<br>
                            Gemini 3.1 Pro<br>
                            Grok 4.6
                        </p>
                        
                        <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role3}</p>
                        <p style="margin: 0.2em 0 1.5em 0; color: white; line-height: 1.3;">
                            Claude Fable 5.1<br>
                            Claude Opus 5
                        </p>
                        
                        <p style="margin: 0; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; color: rgb(211 211 211); font-size: 1.1em; text-transform: uppercase;">${dict.outro}</p>
                    </div>
                    
                    <div style="display: flex; justify-content: center; gap: 1em; flex-wrap: wrap;">
                        <a href="https://discord.gg/yNeB7Ah752" target="_blank" style="text-decoration: none;">
                            <div style="height: 3em; border-radius: 0.75em; background-color: #5865F2; display: flex; align-items: center; justify-content: center; color: white; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                                DISCORD
                            </div>
                        </a>
                        <a href="https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online.git" target="_blank" style="text-decoration: none;">
                            <div style="height: 3em; border-radius: 0.75em; background-color: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; color: white; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                                GITHUB
                            </div>
                        </a>
                        <div id="kasp-welcome-close" style="height: 3em; border-radius: 0.75em; background-color: rgb(213 213 213); display: flex; align-items: center; justify-content: center; color: rgb(0, 25, 38); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                            ${dict.close}
                        </div>
                    </div>
                `;
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
                    utils.injectStyle(`
                        .hidden-text, .hidden-text-ru, .hidden-xp, .hidden-xp-ru { position: relative; cursor: pointer; font-weight: 500; text-shadow: rgba(0, 0, 0, 0.5) 0em 0em 0.25em; user-select: none; display: inline-block; }
                        .hidden-text, .hidden-text-ru { color: #ffffff !important; }
                        .hidden-text:hover, .hidden-text-ru:hover { color: rgb(255, 188, 9) !important; }
                        .hidden-xp, .hidden-xp-ru { color: rgb(118, 255, 51) !important; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-style: normal; text-transform: uppercase; font-size: 1em; }
                        .hidden-text::after, .hidden-text-ru::after, .hidden-xp::after, .hidden-xp-ru::after { content: attr(data-tooltip); position: absolute; background: rgba(0, 0, 0, 0.9); padding: 5px 12px; border-radius: 4px; font-size: 13px; white-space: nowrap; pointer-events: none; opacity: 0; z-index: 99999; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 8px; border: 1px solid rgba(255,255,255,0.1); font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; text-transform: uppercase; transition: opacity 0.15s ease; }
                        .hidden-text::after, .hidden-text-ru::after { color: #ffffff; }
                        .hidden-xp::after, .hidden-xp-ru::after { color: rgb(118, 255, 51); }
                        .hidden-text::before, .hidden-text-ru::before, .hidden-xp::before, .hidden-xp-ru::before { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-bottom-color: rgba(0, 0, 0, 0.9); opacity: 0; pointer-events: none; z-index: 99999; margin-top: -4px; transition: opacity 0.15s ease; }
                        .hidden-text:hover::after, .hidden-text:hover::before, .hidden-text-ru:hover::after, .hidden-text-ru:hover::before, .hidden-xp:hover::after, .hidden-xp:hover::before, .hidden-xp-ru:hover::after, .hidden-xp-ru:hover::before { opacity: 1; }
                    `, 'kasp-hidenickname-styles');
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
                    utils.injectStyle(`
                        .currency-masked { 
                            position: relative; 
                            cursor: pointer !important; 
                        }
                        
                        .currency-masked::after {
                            content: attr(data-tooltip);
                            position: absolute;
                            background: rgba(15, 17, 21, 0.95);
                            border: 0.08em solid rgba(255, 255, 255, 0.15);
                            padding: 0.6em 1em;
                            border-radius: 0.5em;
                            font-family: BaseFontMedium, FallbackFontMedium, sans-serif;
                            font-size: 1rem;
                            pointer-events: none;
                            white-space: nowrap;
                            box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.6);
                            opacity: 0;
                            z-index: 99999;
                            top: 100%;
                            left: 50%;
                            transform: translateX(-50%);
                            margin-top: 8px;
                            transition: opacity 0.15s ease;
                            text-transform: uppercase;
                        }

                        .currency-masked::before {
                            content: '';
                            position: absolute;
                            top: 100%;
                            left: 50%;
                            transform: translateX(-50%);
                            border: 6px solid transparent;
                            border-bottom-color: rgba(15, 17, 21, 0.95);
                            opacity: 0;
                            pointer-events: none;
                            z-index: 99999;
                            margin-top: -4px;
                            transition: opacity 0.15s ease;
                        }

                        .currency-masked:hover::after,
                        .currency-masked:hover::before {
                            opacity: 1;
                        }

                        .HeaderCommonStyle-icons:has(img[src*="ruby"]).currency-masked::after,
                        .ksc-22.currency-masked::after, 
                        .ksc-62.currency-masked::after { color: rgb(255, 102, 102); }
                        
                        .HeaderCommonStyle-icons:has(img[src*="crystal"]).currency-masked::after,
                        .ksc-24.currency-masked::after { color: rgb(0, 215, 255); }
                        
                        .UserScoreComponentStyle-coinBlock.currency-masked::after,
                        .HeaderCommonStyle-icons:has(img[src*="coin"]).currency-masked::after { color: rgb(255, 188, 9); }
                    `, 'kasp-currency-tooltip-styles');
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
            const DICTIONARY = {
                'огнемёт': { id: 'firebird', ru: 'Огнемёт', en: 'Firebird', type: 'turret' }, 'firebird': { id: 'firebird', ru: 'Огнемёт', en: 'Firebird', type: 'turret' },
                'фриз': { id: 'freeze', ru: 'Фриз', en: 'Freeze', type: 'turret' }, 'freeze': { id: 'freeze', ru: 'Фриз', en: 'Freeze', type: 'turret' },
                'изида': { id: 'isida', ru: 'Изида', en: 'Isida', type: 'turret' }, 'isida': { id: 'isida', ru: 'Изида', en: 'Isida', type: 'turret' },
                'тесла': { id: 'tesla', ru: 'Тесла', en: 'Tesla', type: 'turret' }, 'tesla': { id: 'tesla', ru: 'Тесла', en: 'Tesla', type: 'turret' },
                'молот': { id: 'hammer', ru: 'Молот', en: 'Hammer', type: 'turret' }, 'hammer': { id: 'hammer', ru: 'Молот', en: 'Hammer', type: 'turret' },
                'твинс': { id: 'twins', ru: 'Твинс', en: 'Twins', type: 'turret' }, 'twins': { id: 'twins', ru: 'Твинс', en: 'Twins', type: 'turret' },
                'рикошет': { id: 'ricochet', ru: 'Рикошет', en: 'Ricochet', type: 'turret' }, 'ricochet': { id: 'ricochet', ru: 'Рикошет', en: 'Ricochet', type: 'turret' },
                'смоки': { id: 'smoky', ru: 'Смоки', en: 'Smoky', type: 'turret' }, 'smoky': { id: 'smoky', ru: 'Смоки', en: 'Smoky', type: 'turret' },
                'вулкан': { id: 'vulcan', ru: 'Вулкан', en: 'Vulcan', type: 'turret' }, 'vulcan': { id: 'vulcan', ru: 'Вулкан', en: 'Vulcan', type: 'turret' },
                'страйкер': { id: 'striker', ru: 'Страйкер', en: 'Striker', type: 'turret' }, 'striker': { id: 'striker', ru: 'Страйкер', en: 'Striker', type: 'turret' },
                'гром': { id: 'thunder', ru: 'Гром', en: 'Thunder', type: 'turret' }, 'thunder': { id: 'thunder', ru: 'Гром', en: 'Thunder', type: 'turret' },
                'цунами': { id: 'tsunami', ru: 'Цунами', en: 'Tsunami', type: 'turret' }, 'tsunami': { id: 'tsunami', ru: 'Цунами', en: 'Tsunami', type: 'turret' },
                'скорпион': { id: 'scorpion', ru: 'Скорпион', en: 'Scorpion', type: 'turret' }, 'scorpion': { id: 'scorpion', ru: 'Скорпион', en: 'Scorpion', type: 'turret' },
                'магнум': { id: 'magnum', ru: 'Магнум', en: 'Magnum', type: 'turret' }, 'magnum': { id: 'magnum', ru: 'Магнум', en: 'Magnum', type: 'turret' },
                'рельса': { id: 'railgun', ru: 'Рельса', en: 'Railgun', type: 'turret' }, 'railgun': { id: 'railgun', ru: 'Рельса', en: 'Railgun', type: 'turret' },
                'гаусс': { id: 'gauss', ru: 'Гаусс', en: 'Gauss', type: 'turret' }, 'gauss': { id: 'gauss', ru: 'Гаусс', en: 'Gauss', type: 'turret' },
                'шафт': { id: 'shaft', ru: 'Шафт', en: 'Shaft', type: 'turret' }, 'shaft': { id: 'shaft', ru: 'Шафт', en: 'Shaft', type: 'turret' },
                'васп': { id: 'wasp', ru: 'Васп', en: 'Wasp', type: 'hull' }, 'wasp': { id: 'wasp', ru: 'Васп', en: 'Wasp', type: 'hull' },
                'хоппер': { id: 'hopper', ru: 'Хоппер', en: 'Hopper', type: 'hull' }, 'hopper': { id: 'hopper', ru: 'Хоппер', en: 'Hopper', type: 'hull' },
                'хорнет': { id: 'hornet', ru: 'Хорнет', en: 'Hornet', type: 'hull' }, 'hornet': { id: 'hornet', ru: 'Хорнет', en: 'Hornet', type: 'hull' },
                'викинг': { id: 'viking', ru: 'Викинг', en: 'Viking', type: 'hull' }, 'viking': { id: 'viking', ru: 'Викинг', en: 'Viking', type: 'hull' },
                'крусейдер': { id: 'crusader', ru: 'Крусейдер', en: 'Crusader', type: 'hull' }, 'crusader': { id: 'crusader', ru: 'Крусейдер', en: 'Crusader', type: 'hull' },
                'хантер': { id: 'hunter', ru: 'Хантер', en: 'Hunter', type: 'hull' }, 'hunter': { id: 'hunter', ru: 'Хантер', en: 'Hunter', type: 'hull' },
                'паладин': { id: 'paladin', ru: 'Паладин', en: 'Paladin', type: 'hull' }, 'paladin': { id: 'paladin', ru: 'Паладин', en: 'Paladin', type: 'hull' },
                'диктатор': { id: 'dictator', ru: 'Диктатор', en: 'Dictator', type: 'hull' }, 'dictator': { id: 'dictator', ru: 'Диктатор', en: 'Dictator', type: 'hull' },
                'титан': { id: 'titan', ru: 'Титан', en: 'Titan', type: 'hull' }, 'titan': { id: 'titan', ru: 'Титан', en: 'Titan', type: 'hull' },
                'арес': { id: 'ares', ru: 'Арес', en: 'Ares', type: 'hull' }, 'ares': { id: 'ares', ru: 'Арес', en: 'Ares', type: 'hull' },
                'мамонт': { id: 'mammoth', ru: 'Мамонт', en: 'Mammoth', type: 'hull' }, 'mammoth': { id: 'mammoth', ru: 'Мамонт', en: 'Mammoth', type: 'hull' }
            };
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
                for (const key in DICTIONARY) {
                    if (lower.includes(key)) {
                        const item = DICTIONARY[key];
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
                    const match = Object.values(DICTIONARY).find(d => d.id === trophy.id);
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
            return () => {
                if (!initialized) {
                    initialized = true;
                    utils.injectStyle(`
                        .custom-trophy-panel { position: absolute; top: 19em; right: 3em; display: flex; flex-direction: column; gap: 1.5em; font-family: BaseFontRegular, FallbackFontRegular, sans-serif; z-index: 1; pointer-events: none; width: 17em; opacity: 1 !important; transform: none !important; }
                        .custom-trophy-item { display: flex; align-items: center; gap: 1em; justify-content: flex-start; }
                        .custom-trophy-icon { width: 3.5em; height: 3.5em; object-fit: contain; filter: drop-shadow(rgba(0, 0, 0, 0.5) 0em 0em 0.25em); }
                        .custom-trophy-info { display: flex; flex-direction: column; align-items: flex-start; width: 100%; }
                        .custom-trophy-title { color: rgb(255, 255, 255); font-weight: 500; font-size: 1em; text-shadow: rgba(0, 0, 0, 0.5) 0em 0em 0.25em; white-space: nowrap; }
                        .custom-trophy-bar-bg { background-color: rgba(118, 255, 51, 0.5); border-radius: 0.375em; position: relative; min-width: 12.5em; width: 100%; height: 0.25em; margin-top: 0.375em; }
                        .custom-trophy-bar-fill { background-color: rgb(118, 255, 51); border-radius: 6.25em; height: 100%; transition: width 0.5s ease-out; box-shadow: 0 0 0.2em rgba(118, 255, 51, 0.8); }
                        .custom-trophy-text { color: rgb(118, 255, 51); font-weight: 500; font-size: 0.9em; text-shadow: rgba(0, 0, 0, 0.5) 0em 0em 0.25em; margin-top: 0.3em; }
                        .PaintsCollectionComponentStyle-favoriteIconContainer { position: absolute; width: 2.2em; height: 2.2em; z-index: 10; cursor: pointer; }
                        .PaintsCollectionComponentStyle-favoriteIconContainer img { width: 100%; height: 100%; pointer-events: none; transition: filter 0.2s; }
                        .card-type-list .PaintsCollectionComponentStyle-favoriteIconContainer { right: 1em; top: 50%; transform: translateY(-50%); }
                        .card-type-grid .PaintsCollectionComponentStyle-favoriteIconContainer { right: 0.8em; top: 0.8em; }
                        .star-limit-reached img { filter: brightness(0.7) sepia(1) hue-rotate(310deg) saturate(5); }
                    `, 'kasp-trophies-styles');
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
                    return true;
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
                    function doStep() {
                        if (!isRunning) {
                            finish();
                            return;
                        }
                        if (isMaxLevel()) {
                            finish();
                            return;
                        }
                        if (isCompleted() && !isDialogOpen()) {
                            timer = window.setTimeout(doStep, DELAY);
                            return;
                        }
                        if (!shouldShowQuickButtons() && !isDialogOpen()) {
                            finish();
                            return;
                        }
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
                                timer = window.setTimeout(doStep, DELAY);
                                return;
                            }
                            pressEnter();
                            upgraded++;
                            timer = window.setTimeout(doStep, DELAY);
                            return;
                        }
                        pressEnter();
                        upgraded++;
                        timer = window.setTimeout(doStep, DELAY);
                    }
                    function finish() {
                        isRunning = false;
                        upgradeQueue = 0;
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
                        if (!target)
                            return;
                        if (target.closest('#quick-upgrade-overlay'))
                            return;
                        const menuCategory = target.closest('.MenuComponentStyle-mainMenuItem');
                        const mainGarageBlock = target.closest('[class*="MountedItemsStyle-commonBlock"], .tt-garage-paints-button');
                        const itemElement = target.closest('[class*="Item"], [class*="card"], [class*="Garage"]');
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
                    if (!row.querySelector('.kasp-change-td')) {
                        const td = document.createElement('td');
                        td.className = 'kasp-change-td';
                        row.appendChild(td);
                    }
                }
            }
            function update() {
                if (isUpdating)
                    return;
                isUpdating = true;
                try {
                    const container = document.querySelector('.BattleTabStatisticComponentStyle-container');
                    if (!container)
                        return;
                    sync();
                    const cells = container.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell');
                    if (!cells.length)
                        return;
                    cells.forEach(cell => {
                        const rawText = cell.textContent || '';
                        const nickname = rawText.replace(/^\[.*?\]\s*/, '').trim();
                        const row = cell.closest('tr');
                        if (!row || !nickname)
                            return;
                        let changeTd = row.querySelector('.kasp-change-td');
                        if (!changeTd)
                            return;
                        const count = playerChanges.get(nickname) ?? 0;
                        const hasClass = changeTd.classList.contains('kasp-changed');
                        if (count > 0 && !hasClass) {
                            changeTd.classList.add('kasp-changed');
                        }
                        else if (count === 0 && hasClass) {
                            changeTd.classList.remove('kasp-changed');
                        }
                    });
                }
                finally {
                    isUpdating = false;
                }
            }
            return {
                onTick: () => { checkBattleCanvas(); },
                sync,
                update,
            };
        })(),
        customGarageSkins: (() => {
            const STORAGE_KEY = 'kasp_equipped_skins';
            const BASE_IMG_KEY = 'kasp_base_images';
            const SKIN_BRANDS_MAP = {
                'https://s.eu.tankionline.com/614/34717/306/41/30607167046040/image.svg': 'default',
                'https://s.eu.tankionline.com/605/161575/257/125/30275543521753/image.svg': 'xt',
                'https://s.eu.tankionline.com/604/26114/260/116/30205423172265/image.svg': 'xtHD',
                'https://s.eu.tankionline.com/604/26114/260/112/30205423211144/image.svg': 'prime',
                'https://s.eu.tankionline.com/604/26114/260/103/30205423172266/image.svg': 'gt',
                'https://s.eu.tankionline.com/604/26114/260/114/30205423171703/image.svg': 'sp',
                'https://s.eu.tankionline.com/604/26114/260/115/30205423171700/image.svg': 'legacy',
                'https://s.eu.tankionline.com/604/26114/260/111/30205423171761/image.svg': 'rt',
                'https://s.eu.tankionline.com/604/26114/260/120/30205423171677/image.svg': 'ultra',
                'https://s.eu.tankionline.com/623/157032/211/246/31173606567127/image.svg': 'dk',
                'https://s.eu.tankionline.com/605/166565/337/2/30275535357510/image.svg': 'ic',
                'https://s.eu.tankionline.com/604/26114/260/117/30271053650212/image.svg': 'demonic',
                'none': 'demoncOLD',
                'none1': 'vt',
                'none2': 'se'
            };
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
                "шафт": "shaft", "shaft": "shaft",
                "васп": "wasp", "wasp": "wasp",
                "хоппер": "hopper", "hopper": "hopper",
                "хорнет": "hornet", "hornet": "hornet",
                "викинг": "viking", "viking": "viking",
                "крусейдер": "crusader", "crusader": "crusader",
                "хантер": "hunter", "hunter": "hunter",
                "паладин": "paladin", "paladin": "paladin",
                "диктатор": "dictator", "dictator": "dictator",
                "титан": "titan", "titan": "titan",
                "арес": "ares", "ares": "ares",
                "мамонт": "mammoth", "mammoth": "mammoth"
            };
            const PREFILLED_DEFAULTS = {
                "firebird": "https://s.eu.tankionline.com/0/114/134/163/27571212744112/image.webp",
                "freeze": "https://s.eu.tankionline.com/575/156205/46/235/27673441764603/image.webp",
                "isida": "https://s.eu.tankionline.com/605/12650/335/51/30242554322574/image.webp",
                "tesla": "https://s.eu.tankionline.com/571/164753/344/273/31254566614710/image.webp",
                "hammer": "https://s.eu.tankionline.com/611/147301/37/346/30471660553063/image.webp",
                "twins": "https://s.eu.tankionline.com/575/72153/171/306/27656433310704/image.webp",
                "ricochet": "https://s.eu.tankionline.com/603/146215/116/130/30171443247472/image.webp",
                "vulcan": "https://s.eu.tankionline.com/622/115017/367/224/31123203774154/image.webp",
                "smoky": "https://s.eu.tankionline.com/566/114246/64/16/27323052543056/image.webp",
                "striker": "https://s.eu.tankionline.com/626/176502/177/71/31337521147306/image.webp",
                "thunder": "https://s.eu.tankionline.com/601/112676/250/233/30062557707304/image.webp",
                "tsunami": "https://s.eu.tankionline.com/633/142777/142/76/31570600103535/image.webp",
                "scorpion": "https://s.eu.tankionline.com/601/17263/233/51/30043654742567/image.webp",
                "magnum": "https://s.eu.tankionline.com/632/23036/322/273/31504607631061/image.webp",
                "railgun": "https://s.eu.tankionline.com/567/105205/202/144/27361241363510/image.webp",
                "gauss": "https://s.eu.tankionline.com/611/61722/256/267/30454367266373/image.webp",
                "shaft": "https://s.eu.tankionline.com/622/43505/151/101/31110721265007/image.webp",
                "wasp": "https://s.eu.tankionline.com/576/154321/271/157/27733064335367/image.webp",
                "hopper": "https://s.eu.tankionline.com/576/154317/260/212/27733063731464/image.webp",
                "hornet": "https://s.eu.tankionline.com/566/70102/323/356/27316026113551/image.webp",
                "viking": "https://s.eu.tankionline.com/576/154321/207/23/27733064304256/image.webp",
                "crusader": "https://s.eu.tankionline.com/566/43504/240/13/27310721146137/image.webp",
                "hunter": "https://s.eu.tankionline.com/567/167060/364/46/27375614356144/image.webp",
                "paladin": "https://s.eu.tankionline.com/573/71447/126/57/27602130021260/image.webp",
                "dictator": "https://s.eu.tankionline.com/602/61754/171/44/30114373231460/image.webp",
                "titan": "https://s.eu.tankionline.com/606/26070/125/222/30305416231374/image.webp",
                "ares": "https://s.eu.tankionline.com/576/154316/224/223/27733063513342/image.webp",
                "mammoth": "https://s.eu.tankionline.com/576/154320/262/304/30015725757347/image.webp"
            };
            const SKINS_DATABASE = {
                "firebird": { "demonicOLD": "https://s.eu.tankionline.com/554/36647/151/167/27006222101177/image.webp", "xt": "https://s.eu.tankionline.com/544/55322/150/54/27006221137650/image.webp", "legacy": "https://s.eu.tankionline.com/606/154713/267/332/30333162755774/image.webp", "demonic": "https://s.eu.tankionline.com/574/111735/366/251/27623012454350/image.webp", "gt": "https://s.eu.tankionline.com/620/113220/245/225/31022644221725/image.webp" },
                "freeze": { "dk": "https://s.eu.tankionline.com/626/144354/353/307/31331073273517/image.webp", "xtHD": "https://s.eu.tankionline.com/607/136170/201/132/30367436101741/image.webp", "xt": "https://s.eu.tankionline.com/545/127240/164/131/27006221125546/image.webp", "legacy": "https://s.eu.tankionline.com/605/14617/124/244/30243144544374/image.webp", "gt": "https://s.eu.tankionline.com/613/151460/263/146/30572314246641/image.webp" },
                "isida": { "gt": "https://s.eu.tankionline.com/605/12655/270/305/30242555267625/image.webp", "xt": "https://s.eu.tankionline.com/547/121300/6/347/27006221135010/image.webp", "legacy": "https://s.eu.tankionline.com/606/155040/264/51/30333211016074/image.webp" },
                "tesla": { "dk": "https://s.eu.tankionline.com/626/144357/43/323/31331073650002/image.webp", "xtHD": "https://s.eu.tankionline.com/571/164753/344/275/27475173126262/image.webp", "legacy": "https://s.eu.tankionline.com/604/60403/370/223/30214100775564/image.webp", "gt": "https://s.eu.tankionline.com/625/62773/333/270/31254577056311/image.webp", "rt": "https://s.eu.tankionline.com/616/165265/171/30/30735255276301/image.webp" },
                "hammer": { "xt": "https://s.eu.tankionline.com/550/160444/177/127/27006221137644/image.webp", "legacy": "https://s.eu.tankionline.com/601/170515/147/375/30076123457044/image.webp", "gt": "https://s.eu.tankionline.com/623/151752/54/57/31172372477451/image.webp", "ic": "https://s.eu.tankionline.com/623/44445/126/376/31151111305122/image.webp", "sp": "https://s.eu.tankionline.com/627/73466/221/246/31356720510241/image.webp" },
                "twins": { "xt": "https://s.eu.tankionline.com/547/35522/366/217/27006221446573/image.webp", "gt": "https://s.eu.tankionline.com/617/166341/206/340/30775470305001/image.webp", "legacy": "https://s.eu.tankionline.com/577/157474/222/174/27773717305444/image.webp" },
                "ricochet": { "xt": "https://s.eu.tankionline.com/546/5476/203/247/27006221247376/image.webp", "legacy": "https://s.eu.tankionline.com/556/131237/223/64/27006221307447/image.webp", "gt": "https://s.eu.tankionline.com/623/45325/56/35/31151265266217/image.webp", "rt": "https://s.eu.tankionline.com/577/177107/117/226/27777622231563/image.webp" },
                "vulcan": { "xt": "https://s.eu.tankionline.com/544/131127/26/163/27006222634650/image.webp", "prime": "https://s.eu.tankionline.com/556/15757/64/213/27006222451123/image.webp", "legacy": "https://s.eu.tankionline.com/624/106557/304/114/31221533775405/image.webp", "demonic": "https://s.eu.tankionline.com/613/14030/7/251/30543006303434/image.webp", "ultra": "https://s.eu.tankionline.com/560/31363/210/360/27006276703643/image.webp", "gt": "https://s.eu.tankionline.com/634/157107/355/324/31633622047562/image.webp" },
                "smoky": { "xt": "https://s.eu.tankionline.com/545/14700/243/147/27006221742756/image.webp", "legacy": "https://s.eu.tankionline.com/577/174061/352/42/27777017045677/image.webp", "gt": "https://s.eu.tankionline.com/607/136171/102/2/30367436242300/image.webp" },
                "striker": { "xtHD": "https://s.eu.tankionline.com/626/144362/322/210/31331074604612/image.webp", "ultra": "https://s.eu.tankionline.com/570/167463/110/26/31357732440710/image.webp", "xt": "https://s.eu.tankionline.com/551/73161/220/371/27006221457234/image.webp", "dk": "https://s.eu.tankionline.com/632/133612/321/202/31526742641351/image.webp", "gt": "https://s.eu.tankionline.com/632/57062/203/123/31634075062157/image.webp" },
                "thunder": { "vt": "https://s.eu.tankionline.com/640/34054/106/324/32007013066364/image.webp", "dk": "https://s.eu.tankionline.com/624/130241/231/170/31247407370544/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/230/164/27006222346434/image.webp", "legacy": "https://s.eu.tankionline.com/545/14701/163/26/27006222440647/image.webp", "gt": "https://s.eu.tankionline.com/603/104200/223/77/30161040124106/image.webp", "ultra": "https://s.eu.tankionline.com/556/23371/256/376/27006222447074/image.webp", "prime": "https://s.eu.tankionline.com/557/14337/235/24/27006221273433/image.webp", "xtHD": "https://s.eu.tankionline.com/617/134472/113/230/30767117003724/image.webp" },
                "tsunami": { "dk": "https://s.eu.tankionline.com/636/15624/303/133/31704534736504/image.webp" },
                "scorpion": { "rt": "https://s.eu.tankionline.com/627/130243/173/41/31366050734726/image.webp", "dk": "https://s.eu.tankionline.com/626/144356/211/215/31331073550674/image.webp", "xtHD": "https://s.eu.tankionline.com/602/142236/225/135/30131263063453/image.webp", "gt": "https://s.eu.tankionline.com/634/160574/373/213/31634137213712/image.webp" },
                "magnum": { "sp": "https://s.eu.tankionline.com/612/43174/244/260/30510637124120/image.webp", "xt": "https://s.eu.tankionline.com/550/75116/121/115/27006222156612/image.webp" },
                "railgun": { "gt": "https://s.eu.tankionline.com/606/155010/246/46/30333202253104/image.webp", "legacy": "https://s.eu.tankionline.com/550/121477/171/157/27006221327105/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/101/240/27006222467365/image.webp", "ultra": "https://s.eu.tankionline.com/557/14216/302/47/27006222235365/image.webp", "prime": "https://s.eu.tankionline.com/554/45667/335/160/27006221506161/image.webp" },
                "gauss": { "rt": "https://s.eu.tankionline.com/635/24770/75/171/31645176163053/image.webp", "xt": "https://s.eu.tankionline.com/560/166470/223/123/27035516206046/image.webp", "prime": "https://s.eu.tankionline.com/554/43164/134/365/27006222545045/image.webp", "gt": "https://s.eu.tankionline.com/613/151460/263/2/30572765264737/image.webp", "ultra": "https://s.eu.tankionline.com/563/60021/200/371/27154004322450/image.webp", "ic": "https://s.eu.tankionline.com/614/101074/51/272/30620217025776/image.webp" },
                "shaft": { "legacy": "https://s.eu.tankionline.com/600/172117/242/22/30036424407361/image.webp", "xt": "https://s.eu.tankionline.com/546/76262/360/74/27006221440464/image.webp", "gt": "https://s.eu.tankionline.com/623/152641/25/44/31172550417505/image.webp" },
                "wasp": { "legacy": "https://s.eu.tankionline.com/577/174061/352/34/27777016754412/image.webp", "xt": "https://s.eu.tankionline.com/544/55321/27/365/27006221715450/image.webp", "gt": "https://s.eu.tankionline.com/620/113057/312/163/31022614272635/image.webp" },
                "hopper": { "dk": "https://s.eu.tankionline.com/634/21124/213/143/31604256121143/image.webp", "xtHD": "https://s.eu.tankionline.com/564/44403/372/46/27221401755636/image.webp", "rt": "https://s.eu.tankionline.com/616/165266/42/215/30735255423342/image.webp" },
                "hornet": { "xtHD": "https://s.eu.tankionline.com/623/132270/76/254/31166456253644/image.webp", "xt": "https://s.eu.tankionline.com/544/23373/367/174/27006221615421/image.webp", "ultra": "https://s.eu.tankionline.com/562/167731/132/2/27135766300240/image.webp", "gt": "https://s.eu.tankionline.com/605/27506/77/266/30245722451746/image.webp", "legacy": "https://s.eu.tankionline.com/554/36653/207/221/27006221767456/image.webp", "sp": "https://s.eu.tankionline.com/636/174463/275/327/31737115153727/image.webp", "dk": "https://s.eu.tankionline.com/626/144360/341/233/31331074463357/image.webp", "prime": "https://s.eu.tankionline.com/553/11125/61/23/27006221422730/image.webp" },
                "viking": { "vt": "https://s.eu.tankionline.com/640/34117/212/274/32007023724174/image.webp", "xtHD": "https://s.eu.tankionline.com/606/162165/343/3/30334435362646/image.webp", "ultra": "https://s.eu.tankionline.com/552/63515/71/331/27006222526007/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/341/44/27006221645475/image.webp", "legacy": "https://s.eu.tankionline.com/545/14701/310/206/27006221256304/image.webp", "gt": "https://s.eu.tankionline.com/603/101654/323/65/30160353152727/image.webp", "dk": "https://s.eu.tankionline.com/624/130241/112/33/31243624274176/image.webp", "prime": "https://s.eu.tankionline.com/557/14335/173/371/27006222537526/image.webp" },
                "crusader": { "xtHD": "https://s.eu.tankionline.com/566/40735/240/67/27310167345113/image.webp", "rt": "https://s.eu.tankionline.com/607/24073/366/376/30345016775402/image.webp" },
                "hunter": { "xt": "https://s.eu.tankionline.com/547/121275/335/127/27006222147461/image.webp", "legacy": "https://s.eu.tankionline.com/577/157474/222/171/27773717262060/image.webp", "sp": "https://s.eu.tankionline.com/632/72364/102/227/31516475423716/image.webp", "gt": "https://s.eu.tankionline.com/607/136171/1/41/30367436201726/image.webp", "prime": "https://s.eu.tankionline.com/554/155740/111/54/27006222537520/image.webp", "ultra": "https://s.eu.tankionline.com/561/116016/365/77/27063403712301/image.webp" },
                "paladin": { "dk": "https://s.eu.tankionline.com/636/15627/202/330/31703345754725/image.webp", "xtHD": "https://s.eu.tankionline.com/573/71447/126/37/31645107310146/image.webp", "rt": "https://s.eu.tankionline.com/577/177107/117/225/27777622013534/image.webp" },
                "dictator": { "xt": "https://s.eu.tankionline.com/553/20722/371/101/27006221171476/image.webp", "sp": "https://s.eu.tankionline.com/621/140410/154/251/31070103077064/image.webp", "legacy": "https://s.eu.tankionline.com/600/172117/242/15/31364321620222/image.webp", "gt": "https://s.eu.tankionline.com/606/154745/266/2/30333172146453/image.webp" },
                "titan": { "xt": "https://s.eu.tankionline.com/545/43351/66/26/27006222061714/image.webp", "prime": "https://s.eu.tankionline.com/555/103066/317/332/27006222042503/image.webp", "gt": "https://s.eu.tankionline.com/623/45322/65/215/31151265113717/image.webp", "sp": "https://s.eu.tankionline.com/612/43367/221/355/30510675712024/image.webp", "legacy": "https://s.eu.tankionline.com/601/170515/147/372/30076123372407/image.webp" },
                "ares": { "dk": "https://s.eu.tankionline.com/626/144353/222/354/31331072771326/image.webp", "xtHD": "https://s.eu.tankionline.com/562/161156/242/234/31331074061754/image.webp", "rt": "https://s.eu.tankionline.com/626/36656/275/136/31307553605617/image.webp" },
                "mammoth": { "xt": "https://s.eu.tankionline.com/544/131126/51/354/27006221626237/image.webp", "sp": "https://s.eu.tankionline.com/573/113617/26/345/27562743700674/image.webp", "gt": "https://s.eu.tankionline.com/617/166341/256/13/30775470330175/image.webp", "legacy": "https://s.eu.tankionline.com/557/31406/53/112/27006222625462/image.webp", "ultra": "https://s.eu.tankionline.com/571/77135/256/372/27457627403320/image.webp" }
            };
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
                        const selectors = finalUrls.map(url => `img[src="${url}"]`).join(',\n');
                        css += `${selectors} {\n    content: url("${targetUrl}") !important;\n    object-fit: contain !important;\n}\n\n`;
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
                const nameEl = document.querySelector('.ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span');
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
            const SHIELD_ICON_URL = chrome.runtime.getURL("assets/54bb1e72f5a61a0a5d6b.svg");
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
                    const cs = window.getComputedStyle(iconDiv);
                    const candidates = [
                        cs.getPropertyValue('-webkit-mask-image'),
                        cs.getPropertyValue('mask-image'),
                        cs.getPropertyValue('background-image'),
                        cs.webkitMaskImage,
                        cs.maskImage,
                        cs.backgroundImage,
                    ];
                    for (const raw of candidates) {
                        if (!raw || raw === 'none')
                            continue;
                        const m = raw.match(/url\(["']?([^"')]+)["']?\)/);
                        if (m && m[1])
                            return m[1].toLowerCase();
                    }
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
                            const cs = window.getComputedStyle(iconDiv);
                            const bg = cs.backgroundColor;
                            const isRed = bg.includes('254') || bg.includes('255, 80') ||
                                bg.includes('255, 102') || bg.includes('254, 102');
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
                        textSpan.style.cssText = 'font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important; line-height: 1 !important;';
                        zeroLabel.appendChild(iconDiv);
                        zeroLabel.appendChild(textSpan);
                        summaryRow.appendChild(zeroLabel);
                    }
                });
            }
            function sync() {
                const theadRows = document.querySelectorAll(':is(.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults) table thead tr');
                theadRows.forEach(row => {
                    if (row.querySelector('.kasp-defence-th'))
                        return;
                    const gsHeader = row.children[1];
                    if (!gsHeader)
                        return;
                    const th = document.createElement('th');
                    th.className = 'kasp-defence-th';
                    th.innerHTML = `<img src="${SHIELD_ICON_URL}" alt="" class="kasp-shield-img">`;
                    gsHeader.after(th);
                });
                const cells = document.querySelectorAll('.BattleTabStatisticComponentStyle-resistanceModuleCell');
                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    if (cell.querySelector('.kasp-compact-cell'))
                        continue;
                    const compact = document.createElement('div');
                    compact.className = 'kasp-compact-cell';
                    compact.innerHTML =
                        '<div class="kasp-slot"><span class="kasp-dash">—</span></div>' +
                            '<div class="kasp-slot"><span class="kasp-dash">—</span></div>';
                    cell.prepend(compact);
                }
            }
            function update() {
                if (!document.querySelector(TAB_SELECTOR))
                    return;
                injectHeaderShield();
                injectCompactCells();
                injectZeroSummary();
            }
            return {
                sync,
                update,
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
        modules.changeCounter.update();
        modules.zeroResists.update();
        modules.welcomeModal();
        modules.hideNickname();
        modules.hideCurrency();
        modules.weaponAugmentTracker();
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
                modules.customGarageSkins();
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
    const performMasterCheck = () => {
        isMasterUpdateScheduled = false;
        let newScreen = state.currentScreen;
        if (document.querySelector('.ApplicationLoaderComponentStyle-container.-background')) {
            newScreen = 'loading';
        }
        else if (document.querySelector('.BattleHudComponentStyle-container')) {
            newScreen = 'battle';
        }
        else if (document.querySelector('.GarageCommonStyle-positionContent, .GarageItemComponent-container')) {
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
    };
    const masterObserver = new MutationObserver(() => {
        if (document.querySelector('.BattleTabStatisticComponentStyle-container')) {
            modules.changeCounter.sync();
            modules.zeroResists.sync();
        }
        if (!isMasterUpdateScheduled) {
            isMasterUpdateScheduled = true;
            requestAnimationFrame(performMasterCheck);
        }
    });
    const boot = () => {
        state.lang = utils.getLang();
        masterObserver.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) {
        boot();
    }
    else {
        document.addEventListener('DOMContentLoaded', boot);
    }
})();
