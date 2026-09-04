(function () {
    'use strict';

    if (window !== window.top) return;

    const state = {
        lang: 'EN',
        currentScreen: 'loading',
        settingsOpen: false,
        friendsMenuOpen: false
    };

    const utils = {
        getLang: (): string => { 
            const htmlLang = document.documentElement.lang || '';
            if (htmlLang.toLowerCase().includes('ru')) return 'RU';
            if (window.location.hostname.includes('ru.')) return 'RU';
            return 'EN';
        },

        getSetting: (id: string, def: boolean): boolean => { 
            const val = localStorage.getItem(id);
            if (val === null) return def;
            return val === 'true';
        },

        injectStyle: (css: string, id: string) => { 
            if (document.getElementById(id)) return;
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            if (document.head) document.head.appendChild(style);
            else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
        }
    };

    const coreSettings = (() => {
        let needsReload = false;
        let initialSettingsState: Record<string, boolean> = {};
        let stylesInjected = false;

        const t: any = {
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
            { id: 'k_hideNicknameXP', label: { RU: 'Скрыть никнейм и опыт', EN: 'Hide nickname and score' }, default: false }
        ];

        function showWarningDialog(callback: () => void) {
            const existing = document.getElementById('kasp-warning-overlay');
            if (existing) existing.remove();
            
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
            header.appendChild(title); header.appendChild(closeBtn);
            
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
            
            footer.appendChild(cancelBtn); footer.appendChild(confirmBtn);
            dialog.appendChild(header); dialog.appendChild(content); dialog.appendChild(footer);
            overlay.appendChild(dialog); document.body.appendChild(overlay);

            const loaderObserver = new MutationObserver(() => {
                if (document.querySelector('.ApplicationLoaderComponentStyle-container.-background')) closeDialog();
            });
            loaderObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

            let dialogClosed = false;

            function handleMouse(e: MouseEvent) {
                if (e.button === 3 || e.button === 4) {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    if (e.type === 'mousedown' && !dialogClosed) {
                        dialogClosed = true; closeDialog();
                    }
                }
            }

            function closeDialog() {
                if (!overlay.parentNode) return;
                overlay.remove();
                document.removeEventListener('keydown', onKeyDown, true);
                loaderObserver.disconnect();
                setTimeout(() => {
                    document.removeEventListener('mousedown', handleMouse, true);
                    document.removeEventListener('mouseup', handleMouse, true);
                    document.removeEventListener('click', handleMouse, true);
                }, 300);
            }

            confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); if (callback) callback(); });
            cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
            closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

            function onKeyDown(e: KeyboardEvent) {
                if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    closeDialog();
                    if (e.key === 'Enter' && callback) callback();
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
                if (!mainBlock) return;

                const ulMenu = mainBlock.querySelector('ul');
                if (!ulMenu || document.getElementById('kaspersky-tab')) return;

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
                    const localizedLabel = (setting.label as any)[lang] || setting.label['EN'];
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
                    const row = node as HTMLElement;
                    const label = row.querySelector('.kasp-toggle-label') as HTMLElement;
                    const switchBtn = row.querySelector('.kasp-toggle-switch') as HTMLElement;

                    label.addEventListener('mousemove', (e: MouseEvent) => {
                        if (tooltip) {
                            tooltip.style.left = e.clientX + 'px';
                            tooltip.style.top = e.clientY + 'px';
                            tooltip.classList.remove('kasp-hidden');
                        }
                    });

                    label.addEventListener('mouseleave', () => {
                        if (tooltip) tooltip.classList.add('kasp-hidden');
                    });

                    row.addEventListener('click', function (e) {
                        const target = e.target as HTMLElement;
                        if (target !== label && target !== switchBtn && !switchBtn.contains(target)) return;

                        const rowEl = this as HTMLElement;
                        const id = rowEl.getAttribute('data-id');
                        if (!id) return;

                        const isCurrentlyChecked = rowEl.classList.contains('kasp-active');

                        const performToggle = () => {
                            if (isCurrentlyChecked) {
                                rowEl.classList.remove('kasp-active');
                                localStorage.setItem(id, 'false');
                            } else {
                                rowEl.classList.add('kasp-active');
                                localStorage.setItem(id, 'true');
                            }
                            // Проверяем, изменились ли настройки по сравнению со стартом меню
                            needsReload = MY_SETTINGS.some(s => {
                                const currentVal = utils.getSetting(s.id, s.default);
                                return currentVal !== initialSettingsState[s.id];
                            });
                        };

                        if (id === 'k_hideNicknameXP' && !isCurrentlyChecked) {
                            showWarningDialog(performToggle);
                        } else {
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
                    const nativeContent = mainBlock.querySelector('.SettingsComponentStyle-containerBlock') as HTMLElement;
                    if (nativeContent) nativeContent.style.display = 'none';
                    kContent.classList.remove('kasp-hidden');
                });

                ulMenu.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    const clickedTab = target.closest('.SettingsMenuComponentStyle-menuItemOptions');
                    if (clickedTab && clickedTab.id !== 'kaspersky-tab' && !clickedTab.classList.contains('SettingsMenuComponentStyle-slideMenuOptions')) {
                        kTab.classList.remove('SettingsMenuComponentStyle-activeItemOptions');
                        ulMenu.classList.remove('kasp-hide-native-slider');
                        kContent.classList.add('kasp-hidden');
                        const nativeContent = mainBlock.querySelector('.SettingsComponentStyle-containerBlock') as HTMLElement;
                        if (nativeContent) nativeContent.style.display = '';
                    }
                });
            },

            onClose: () => {
                const tooltip = document.getElementById('kaspersky-reload-tooltip');
                if (tooltip) tooltip.classList.add('kasp-hidden');
                
                // Если хоть один ползунок изменился, перезагружаем страницу!
                if (needsReload) window.location.reload();
            }
        };
    })();

    const modules = {
        customPaints: (() => {
            let initialized = false;

            const paintsData = {
                "https://s.eu.tankionline.com/610/51502/256/167/30665401302161/image.webp": { ru: "Яблоко", en: "Apple" },
                "https://s.eu.tankionline.com/0/0/345/373/30665401773004/image.webp": { ru: "Чёрный", en: "Black" },
                "https://s.eu.tankionline.com/610/51504/135/233/30665401712275/image.webp": { ru: "Синева", en: "Blueness" },
                "https://s.eu.tankionline.com/610/51505/266/323/30665402212314/image.webp": { ru: "Коралловый", en: "Coral" },
                "https://s.eu.tankionline.com/610/51507/21/304/30665402346630/image.webp": { ru: "Золотой", en: "Gold" },
                "https://s.eu.tankionline.com/0/0/346/26/30665402464532/image.webp": { ru: "Бордовый", en: "Maroon" },
                "https://s.eu.tankionline.com/615/77267/340/1/30665402622031/image.webp": { ru: "Горчичный", en: "Mustard" },
                "https://s.eu.tankionline.com/610/51507/323/254/30665402716674/image.webp": { ru: "Красный", en: "Red" },
                "https://s.eu.tankionline.com/0/0/346/31/30665403002077/image.webp": { ru: "Белый", en: "White" },
                "https://s.eu.tankionline.com/610/51503/307/55/30665401622061/image.webp": { ru: "Морской", en: "Aquamarine" },
                "https://s.eu.tankionline.com/610/51505/36/167/30665402033526/image.webp": { ru: "Синий", en: "Blue" },
                "https://s.eu.tankionline.com/615/77267/164/54/30665402113242/image.webp": { ru: "Штиль", en: "Calm" },
                "https://s.eu.tankionline.com/610/51506/121/154/30665402257565/image.webp": { ru: "Фуксия", en: "Fuchsia" },
                "https://s.eu.tankionline.com/0/0/346/7/30665402406616/image.webp": { ru: "Зелёный", en: "Green" },
                "https://s.eu.tankionline.com/0/0/346/23/30665402552347/image.webp": { ru: "Металлик", en: "Metallic" },
                "https://s.eu.tankionline.com/610/51507/143/230/30665402661542/image.webp": { ru: "Оранжевый", en: "Orange" },
                "https://s.eu.tankionline.com/610/51510/143/147/30665402752466/image.webp": { ru: "Индиго", en: "Violet" },
                "https://s.eu.tankionline.com/610/51510/306/262/30665403031674/image.webp": { ru: "Жёлтый", en: "Yellow" },
                "https://s.eu.tankionline.com/0/114/122/53/27006222460710/image.webp": { ru: "Болотный", en: "Swamp" },
                "https://s.eu.tankionline.com/0/16722/56/160/27006222456766/image.webp": { ru: "Вихрь", en: "Vortex" },
                "https://s.eu.tankionline.com/0/16722/56/147/27006222107011/image.webp": { ru: "Вишня", en: "Cherry" },
                "https://s.eu.tankionline.com/0/114/143/73/27006221272003/image.webp": { ru: "Буря", en: "Storm" },
                "https://s.eu.tankionline.com/0/114/144/10/27006222040251/image.webp": { ru: "Кедр", en: "Cedar" },
                "https://s.eu.tankionline.com/0/16722/363/263/27006221311216/image.webp": { ru: "Конфетти", en: "Confetti" },
                "https://s.eu.tankionline.com/0/114/144/5/27006222511333/image.webp": { ru: "Тина", en: "Clay" },
                "https://s.eu.tankionline.com/0/114/143/71/27006221600016/image.webp": { ru: "Ржавчина", en: "Corrosion" },
                "https://s.eu.tankionline.com/0/114/114/116/27006221345363/image.webp": { ru: "Пустыня", en: "Desert" },
                "https://s.eu.tankionline.com/0/114/122/54/27006222004654/image.webp": { ru: "Грязь", en: "Dirty" },
                "https://s.eu.tankionline.com/0/114/122/35/27006221774672/image.webp": { ru: "Диджитал", en: "Digital" },
                "https://s.eu.tankionline.com/0/0/346/1/27006222172671/image.webp": { ru: "Флора", en: "Flora" },
                "https://s.eu.tankionline.com/0/0/346/4/27006221360532/image.webp": { ru: "Лесник", en: "Forester" },
                "https://s.eu.tankionline.com/0/16723/6/10/27006221675320/image.webp": { ru: "Луга", en: "Grasslands" },
                "https://s.eu.tankionline.com/0/16722/56/150/27006221160055/image.webp": { ru: "Излом", en: "Fracture" },
                "https://s.eu.tankionline.com/0/16722/56/152/27006221620055/image.webp": { ru: "Партизан", en: "Guerrilla" },
                "https://s.eu.tankionline.com/0/114/164/72/27006221465341/image.webp": { ru: "Нефрит", en: "Jade" },
                "https://s.eu.tankionline.com/0/16722/35/13/27006222126710/image.webp": { ru: "Магма", en: "Magma" },
                "https://s.eu.tankionline.com/0/114/143/70/27006221307720/image.webp": { ru: "Глина", en: "Loam" },
                "https://s.eu.tankionline.com/0/114/114/117/27006222147205/image.webp": { ru: "Морпех", en: "Marine" },
                "https://s.eu.tankionline.com/0/16722/35/14/27006221161746/image.webp": { ru: "Марс", en: "Mars" },
                "https://s.eu.tankionline.com/0/114/164/73/27006221641671/image.webp": { ru: "Хвоя", en: "Needle" },
                "https://s.eu.tankionline.com/0/16722/363/270/27006221367462/image.webp": { ru: "Мох", en: "Moss" },
                "https://s.eu.tankionline.com/0/114/164/74/27006221724642/image.webp": { ru: "Пикассо", en: "Picasso" },
                "https://s.eu.tankionline.com/0/16722/35/16/27006222463703/image.webp": { ru: "Пиксель", en: "Pixel" },
                "https://s.eu.tankionline.com/0/16723/6/7/27006222201062/image.webp": { ru: "Кирпич", en: "Red Urban" },
                "https://s.eu.tankionline.com/0/114/144/4/27006222571116/image.webp": { ru: "Продиджи", en: "Prodigi" },
                "https://s.eu.tankionline.com/0/114/144/6/27006222130055/image.webp": { ru: "Скала", en: "Rock" },
                "https://s.eu.tankionline.com/0/114/143/67/27006221553372/image.webp": { ru: "Шелест", en: "Rustle" },
                "https://s.eu.tankionline.com/0/114/114/120/27006221763556/image.webp": { ru: "Саванна", en: "Savanna" },
                "https://s.eu.tankionline.com/0/114/144/7/27006221241430/image.webp": { ru: "Песчаник", en: "Sandstone" },
                "https://s.eu.tankionline.com/0/114/144/23/27006222217203/image.webp": { ru: "Тайга", en: "Taiga" },
                "https://s.eu.tankionline.com/0/114/143/23/27006222577770/image.webp": { ru: "Прибой", en: "Swash" },
                "https://s.eu.tankionline.com/0/114/122/77/27006221506670/image.webp": { ru: "Тундра", en: "Tundra" },
                "https://s.eu.tankionline.com/0/114/114/121/27006222300055/image.webp": { ru: "Урбан", en: "Urban" },
                "https://s.eu.tankionline.com/0/114/122/100/27006222106152/image.webp": { ru: "Метель", en: "Winter" },
                "https://s.eu.tankionline.com/0/16722/56/145/27006221320031/image.webp": { ru: "Африка", en: "Africa" },
                "https://s.eu.tankionline.com/0/114/122/76/27006221421046/image.webp": { ru: "Чужой", en: "Alien" },
                "https://s.eu.tankionline.com/0/16722/56/146/27006221660131/image.webp": { ru: "Кузнец", en: "Blacksmith" },
                "https://s.eu.tankionline.com/0/16722/35/11/27006222260322/image.webp": { ru: "Атом", en: "Atom" },
                "https://s.eu.tankionline.com/0/114/122/33/27006222457574/image.webp": { ru: "Карбон", en: "Carbon" },
                "https://s.eu.tankionline.com/0/16722/35/12/27006221454065/image.webp": { ru: "Кольчуга", en: "Chainmail" },
                "https://s.eu.tankionline.com/0/114/121/374/27006222410011/image.webp": { ru: "Дракон", en: "Dragon" },
                "https://s.eu.tankionline.com/0/16722/363/264/27006221275703/image.webp": { ru: "Диско", en: "Disco" },
                "https://s.eu.tankionline.com/0/114/122/10/27006222065210/image.webp": { ru: "Электра", en: "Electra" },
                "https://s.eu.tankionline.com/0/114/156/132/27006221700047/image.webp": { ru: "Изумруд", en: "Emerald" },
                "https://s.eu.tankionline.com/0/16722/56/151/27006222315470/image.webp": { ru: "Граффити", en: "Graffiti" },
                "https://s.eu.tankionline.com/0/16722/356/145/27006222441570/image.webp": { ru: "Первая любовь", en: "First Love" },
                "https://s.eu.tankionline.com/0/16722/363/262/27006222163347/image.webp": { ru: "Арлекин", en: "Harlequin" },
                "https://s.eu.tankionline.com/0/16722/56/153/27006221251741/image.webp": { ru: "Улей", en: "Hive" },
                "https://s.eu.tankionline.com/0/16722/62/44/27006221522631/image.webp": { ru: "С любовью", en: "In Love" },
                "https://s.eu.tankionline.com/0/114/143/72/27006221077354/image.webp": { ru: "Хохлома", en: "Hohloma" },
                "https://s.eu.tankionline.com/0/114/156/133/27006221515471/image.webp": { ru: "Инферно", en: "Inferno" },
                "https://s.eu.tankionline.com/0/16722/56/154/27006221775651/image.webp": { ru: "Захватчик", en: "Invader" },
                "https://s.eu.tankionline.com/0/114/121/373/27006222104133/image.webp": { ru: "Ягуар", en: "Jaguar" },
                "https://s.eu.tankionline.com/0/114/165/2/27006222043031/image.webp": { ru: "Ирбис", en: "Irbis" },
                "https://s.eu.tankionline.com/0/16722/363/265/27006222076140/image.webp": { ru: "Джинс", en: "Jeans" },
                "https://s.eu.tankionline.com/0/16722/363/266/27006221340470/image.webp": { ru: "Калейдоскоп", en: "Kaleidoscope" },
                "https://s.eu.tankionline.com/0/114/164/364/27006222435677/image.webp": { ru: "Свинец", en: "Lead" },
                "https://s.eu.tankionline.com/0/0/346/15/27006222002672/image.webp": { ru: "Лава", en: "Lava" },
                "https://s.eu.tankionline.com/0/16722/56/155/27006222406427/image.webp": { ru: "Дровосек", en: "Lumberjack" },
                "https://s.eu.tankionline.com/0/114/143/136/27006222514445/image.webp": { ru: "Мэри", en: "Mary" },
                "https://s.eu.tankionline.com/0/16722/356/142/27006221104503/image.webp": { ru: "Ночь", en: "Night" },
                "https://s.eu.tankionline.com/0/16722/35/15/27006222415677/image.webp": { ru: "Нано", en: "Nano" },
                "https://s.eu.tankionline.com/0/16722/356/143/27006221171207/image.webp": { ru: "Пиксельное сердце", en: "Pixel Heart" },
                "https://s.eu.tankionline.com/0/114/143/151/27006222417371/image.webp": { ru: "Питон", en: "Python" },
                "https://s.eu.tankionline.com/0/16722/56/156/27006221113616/image.webp": { ru: "Носорог", en: "Rhino" },
                "https://s.eu.tankionline.com/0/16722/57/136/27006221370133/image.webp": { ru: "Енот", en: "Raccoon" },
                "https://s.eu.tankionline.com/0/114/122/12/27006222631654/image.webp": { ru: "Роджер", en: "Roger" },
                "https://s.eu.tankionline.com/0/114/122/37/27006221321716/image.webp": { ru: "Сафари", en: "Safari" },
                "https://s.eu.tankionline.com/0/16722/56/157/27006221534130/image.webp": { ru: "Сакура", en: "Sakura" },
                "https://s.eu.tankionline.com/0/16722/363/271/27006221167111/image.webp": { ru: "Сахара", en: "Sahara" },
                "https://s.eu.tankionline.com/0/16722/356/144/27006221434314/image.webp": { ru: "Нежные цветы", en: "Soft Flowers" },
                "https://s.eu.tankionline.com/0/16722/356/147/27006221530264/image.webp": { ru: "Космос", en: "Space" },
                "https://s.eu.tankionline.com/0/16722/356/146/27006221314372/image.webp": { ru: "Свитер", en: "Sweater" },
                "https://s.eu.tankionline.com/0/114/143/22/27006222107667/image.webp": { ru: "Искра", en: "Spark" },
                "https://s.eu.tankionline.com/0/16722/35/17/27006221567326/image.webp": { ru: "Тигр", en: "Tiger" },
                "https://s.eu.tankionline.com/0/114/156/131/27006222562045/image.webp": { ru: "Зевс", en: "Zeus" },
                "https://s.eu.tankionline.com/561/25253/244/147/27045325460615/image.webp": { ru: "450 нанометров", en: "450 Nanometers" },
                "https://s.eu.tankionline.com/543/66600/306/44/27006221215024/image.webp": { ru: "Абстрактные линии", en: "Abstract lines" },
                "https://s.eu.tankionline.com/560/100572/177/232/27020213532655/image.webp": { ru: "Кольчуга Чужого", en: "Alien Chainmail" },
                "https://s.eu.tankionline.com/556/15763/63/224/27006222246213/image.webp": { ru: "Адам и Ева", en: "Adam and Eve" },
                "https://s.eu.tankionline.com/557/33756/273/64/27006221337475/image.webp": { ru: "Лакомства", en: "All the Goodies" },
                "https://s.eu.tankionline.com/0/16723/61/231/27006221374725/image.webp": { ru: "All you need is...", en: "All you need is..." },
                "https://s.eu.tankionline.com/551/134547/244/265/27006221220621/image.webp": { ru: "Древний дракон", en: "Ancient dragon" },
                "https://s.eu.tankionline.com/0/16723/6/4/27006221105565/image.webp": { ru: "Янтарь", en: "Amber" },
                "https://s.eu.tankionline.com/554/155641/323/232/27006221714250/image.webp": { ru: "Ролл", en: "And Roll" },
                "https://s.eu.tankionline.com/0/16722/363/261/27006221206475/image.webp": { ru: "Арахнид", en: "Arachnid" },
                "https://s.eu.tankionline.com/566/65737/174/260/27300443007050/image.webp": { ru: "Авангард", en: "Avant-garde" },
                "https://s.eu.tankionline.com/572/34560/260/240/27507134130621/image.webp": { ru: "Зона 52", en: "Area 52" },
                "https://s.eu.tankionline.com/541/26511/305/161/27006222405127/image.webp": { ru: "Лазурь", en: "Azure" },
                "https://s.eu.tankionline.com/562/104265/346/221/27121060073320/image.webp": { ru: "Барбекю", en: "BBQ" },
                "https://s.eu.tankionline.com/561/25253/244/152/27045325474033/image.webp": { ru: "Бабушкин диван", en: "Babushka's Sofa" },
                "https://s.eu.tankionline.com/560/100572/177/216/27020213562773/image.webp": { ru: "Бабушкино одеяло", en: "Babushka's Quilt" },
                "https://s.eu.tankionline.com/0/16723/135/43/27006221404600/image.webp": { ru: "Барбершоп", en: "Barber Shop" },
                "https://s.eu.tankionline.com/565/67401/230/250/27255700314460/image.webp": { ru: "Сигнальная лента", en: "Barricade tape" },
                "https://s.eu.tankionline.com/557/33760/20/363/27006221271365/image.webp": { ru: "Праздничные шарики", en: "Baubles Galore" },
                "https://s.eu.tankionline.com/562/45076/20/327/27111224665461/image.webp": { ru: "Морской бой", en: "Battleship" },
                "https://s.eu.tankionline.com/572/34561/142/36/27507134261373/image.webp": { ru: "Пляж", en: "Beach" },
                "https://s.eu.tankionline.com/0/16723/150/167/27006221656231/image.webp": { ru: "Орнитолог", en: "Birdwatcher" },
                "https://s.eu.tankionline.com/550/121244/103/315/27006221072331/image.webp": { ru: "Синий мармелад", en: "Blue marmalade" },
                "https://s.eu.tankionline.com/575/112017/254/57/27662403726310/image.webp": { ru: "Плед", en: "Blanket" },
                "https://s.eu.tankionline.com/554/41031/240/350/27006222114747/image.webp": { ru: "Голубая планета", en: "Blue planet" },
                "https://s.eu.tankionline.com/543/66601/376/323/27006221623352/image.webp": { ru: "Синий квадрат", en: "Blue square" },
                "https://s.eu.tankionline.com/561/61476/276/67/27054317755011/image.webp": { ru: "Греча", en: "Buckwheat" },
                "https://s.eu.tankionline.com/543/174435/215/332/27006222551734/image.webp": { ru: "Бриз", en: "Breeze" },
                "https://s.eu.tankionline.com/562/104266/247/135/27121057777722/image.webp": { ru: "Торт", en: "Cake" },
                "https://s.eu.tankionline.com/552/51373/273/336/27006222533350/image.webp": { ru: "Кэп", en: "Cap" },
                "https://s.eu.tankionline.com/0/16723/227/135/27006222314020/image.webp": { ru: "Остынь, приятель!", en: "Chill bro!" },
                "https://s.eu.tankionline.com/553/114363/13/372/27006221577644/image.webp": { ru: "Угольный", en: "Charred" },
                "https://s.eu.tankionline.com/575/112017/107/100/27662403644070/image.webp": { ru: "Сочельник", en: "Christmas Eve" },
                "https://s.eu.tankionline.com/543/66607/105/12/27006221477510/image.webp": { ru: "Сгущёнка", en: "Condensed milk" },
                "https://s.eu.tankionline.com/552/51375/14/113/27006221716651/image.webp": { ru: "Крушитель", en: "Crusher" },
                "https://s.eu.tankionline.com/561/142547/136/61/27070551514071/image.webp": { ru: "Креативный инженер", en: "Creative Engineer" },
                "https://s.eu.tankionline.com/562/44013/24/270/27111020506553/image.webp": { ru: "Дартс", en: "Darts" },
                "https://s.eu.tankionline.com/557/163200/333/73/27006222051501/image.webp": { ru: "Тёмно-синий пиксель", en: "Deep blue pixel" },
                "https://s.eu.tankionline.com/0/16722/374/164/27006221345672/image.webp": { ru: "Домино", en: "Domino" },
                "https://s.eu.tankionline.com/561/142545/333/15/27070551403070/image.webp": { ru: "Дизайнерская фантазия", en: "Designer Vibe" },
                "https://s.eu.tankionline.com/0/16723/6/6/27006222505673/image.webp": { ru: "Засуха", en: "Drought" },
                "https://s.eu.tankionline.com/543/66601/113/114/27006221672121/image.webp": { ru: "E236", en: "E236" },
                "https://s.eu.tankionline.com/567/130016/167/105/27366564516722/image.webp": { ru: "Пасха", en: "Easter" },
                "https://s.eu.tankionline.com/564/23017/366/262/27205227064243/image.webp": { ru: "Зоркий глаз", en: "Eagle eye" },
                "https://s.eu.tankionline.com/563/112371/226/202/27162476315066/image.webp": { ru: "Экозащита", en: "Ecofriendly" },
                "https://s.eu.tankionline.com/0/16722/232/2/27042003462661/image.webp": { ru: "Вечность", en: "Eternity" },
                "https://s.eu.tankionline.com/574/31046/56/214/27606211427470/image.webp": { ru: "Листопад", en: "Falling leaves" },
                "https://s.eu.tankionline.com/543/66602/165/224/27006222065140/image.webp": { ru: "Перья", en: "Feathers" },
                "https://s.eu.tankionline.com/0/16722/356/150/27006221203600/image.webp": { ru: "Иней", en: "Frost" },
                "https://s.eu.tankionline.com/543/66603/325/14/27006221425330/image.webp": { ru: "Огненный дракон", en: "Fire dragon" },
                "https://s.eu.tankionline.com/0/16723/104/51/27006221117405/image.webp": { ru: "Аппарат Гагарина", en: "Gagarin's Mount" },
                "https://s.eu.tankionline.com/566/115236/353/122/27322340117345/image.webp": { ru: "Геймпад", en: "Gamepad" },
                "https://s.eu.tankionline.com/561/25253/244/145/27045325501417/image.webp": { ru: "Синяя геометрия", en: "Gemetric Blue" },
                "https://s.eu.tankionline.com/563/112373/23/51/27162476612071/image.webp": { ru: "Геймер", en: "Gamer" },
                "https://s.eu.tankionline.com/553/3675/64/266/27006221716164/image.webp": { ru: "Подарочная упаковка", en: "Gift wrap" },
                "https://s.eu.tankionline.com/0/16723/135/40/27006222224152/image.webp": { ru: "Глитч", en: "Glitch" },
                "https://s.eu.tankionline.com/0/16722/356/151/27006222445101/image.webp": { ru: "Золотая звезда", en: "Golden Star" },
                "https://s.eu.tankionline.com/562/170135/37/100/27136027217677/image.webp": { ru: "Золотоискатель", en: "Gold digger" },
                "https://s.eu.tankionline.com/556/15765/70/16/27006221456716/image.webp": { ru: "Гриль", en: "Griller" },
                "https://s.eu.tankionline.com/541/26511/305/115/27006222173243/image.webp": { ru: "Гуччифляж", en: "Gucciflage" },
                "https://s.eu.tankionline.com/541/26511/305/125/27006221134323/image.webp": { ru: "Глюк", en: "Hallucination" },
                "https://s.eu.tankionline.com/0/16723/5/157/27006222263177/image.webp": { ru: "Хэллоуин", en: "Halloween" },
                "https://s.eu.tankionline.com/541/26511/305/123/27006221265532/image.webp": { ru: "Гиперкуб", en: "Hypercube" },
                "https://s.eu.tankionline.com/553/114364/152/155/27006222417236/image.webp": { ru: "Нефритовые весы", en: "Jade Scales" },
                "https://s.eu.tankionline.com/541/26511/305/137/27006222257104/image.webp": { ru: "Кунгурская пещера", en: "Kungur Ice Cave" },
                "https://s.eu.tankionline.com/554/155643/245/5/27006222241376/image.webp": { ru: "Спасатель", en: "Lifesaver" },
                "https://s.eu.tankionline.com/0/16722/356/162/27006222160273/image.webp": { ru: "Лайм", en: "Lime" },
                "https://s.eu.tankionline.com/0/16723/72/6/27006221753263/image.webp": { ru: "Лепестки сирени", en: "Lilac petals" },
                "https://s.eu.tankionline.com/0/16723/72/4/27006222627444/image.webp": { ru: "Взрыв лайма", en: "Lime burst" },
                "https://s.eu.tankionline.com/0/16722/363/267/27006222350323/image.webp": { ru: "Жидкий металл", en: "Liquid Metal" },
                "https://s.eu.tankionline.com/541/26511/305/145/27006222042110/image.webp": { ru: "Лоллипоп", en: "Lollipop" },
                "https://s.eu.tankionline.com/574/31047/144/204/27606211662506/image.webp": { ru: "Сруб", en: "Log cabin" },
                "https://s.eu.tankionline.com/541/26511/305/157/27006221203125/image.webp": { ru: "Лотос", en: "Lotus" },
                "https://s.eu.tankionline.com/0/16723/135/46/27006221154032/image.webp": { ru: "Лунный грунт", en: "Lunar Soil" },
                "https://s.eu.tankionline.com/543/66606/66/123/27006221146244/image.webp": { ru: "Мегаполис", en: "Megapolis" },
                "https://s.eu.tankionline.com/573/100606/271/263/27560141535043/image.webp": { ru: "Маскарад", en: "Masquerade" },
                "https://s.eu.tankionline.com/556/15765/240/206/27006221060421/image.webp": { ru: "Кирпичная кладка", en: "Miniature Masonry" },
                "https://s.eu.tankionline.com/0/16723/6/5/27006222204460/image.webp": { ru: "Мята", en: "Mint" },
                "https://s.eu.tankionline.com/541/26511/305/163/27006221250163/image.webp": { ru: "Моне", en: "Monet" },
                "https://s.eu.tankionline.com/575/46552/273/254/27652031776223/image.webp": { ru: "Мятный леденец", en: "Mint Candy" },
                "https://s.eu.tankionline.com/0/16717/262/247/27006221231453/image.webp": { ru: "Луноход", en: "Moonwalker" },
                "https://s.eu.tankionline.com/566/65742/2/271/27300443154776/image.webp": { ru: "Нейронная сеть", en: "Neural network" },
                "https://s.eu.tankionline.com/0/16722/356/163/27006222161460/image.webp": { ru: "Нейрон", en: "Neuron" },
                "https://s.eu.tankionline.com/540/66631/104/104/27006222041041/image.webp": { ru: "Новогодний подарок", en: "New Year Gift" },
                "https://s.eu.tankionline.com/571/125007/215/5/27465467435004/image.webp": { ru: "Оазис", en: "Oasis" },
                "https://s.eu.tankionline.com/562/45076/20/332/27111226640020/image.webp": { ru: "Ядерное солнце", en: "Nuclear sun" },
                "https://s.eu.tankionline.com/552/51372/12/247/27006221525437/image.webp": { ru: "Обсидиан", en: "Obsidian" },
                "https://s.eu.tankionline.com/557/163176/52/75/27006221304332/image.webp": { ru: "Океания", en: "Oceania" },
                "https://s.eu.tankionline.com/562/44013/24/264/27111020177566/image.webp": { ru: "Наступление", en: "Offensive" },
                "https://s.eu.tankionline.com/562/170140/73/302/27136033510003/image.webp": { ru: "Внедорожник", en: "Off-road vehicle" },
                "https://s.eu.tankionline.com/557/163200/33/215/27006221705441/image.webp": { ru: "Оранжевый ёж", en: "Orange urchin" },
                "https://s.eu.tankionline.com/571/125005/261/51/27465467536207/image.webp": { ru: "POP IT", en: "POP IT" },
                "https://s.eu.tankionline.com/541/26511/305/155/27006221321222/image.webp": { ru: "Пейсли пламя", en: "Paisley Flame" },
                "https://s.eu.tankionline.com/557/33757/250/160/27006222523131/image.webp": { ru: "Новогодний носок", en: "Packed Stocking" },
                "https://s.eu.tankionline.com/541/26511/305/153/27006221473252/image.webp": { ru: "Пейсли лёд", en: "Paisley Ice" },
                "https://s.eu.tankionline.com/0/16723/135/47/27006221120010/image.webp": { ru: "Пижама", en: "Pajamas" },
                "https://s.eu.tankionline.com/541/26511/305/117/27006221263322/image.webp": { ru: "Пики", en: "Peaks" },
                "https://s.eu.tankionline.com/571/14353/301/314/27443072741162/image.webp": { ru: "Мир, труд, май!", en: "Peace, Work, May!" },
                "https://s.eu.tankionline.com/541/26511/305/151/27006222400241/image.webp": { ru: "Фантом", en: "Phantom" },
                "https://s.eu.tankionline.com/555/102602/164/217/27006221471504/image.webp": { ru: "Розовый слон", en: "Pink Elephant" },
                "https://s.eu.tankionline.com/541/26511/305/121/27006222043465/image.webp": { ru: "Поп-арт", en: "Pop Art" },
                "https://s.eu.tankionline.com/541/26511/305/143/27006221477713/image.webp": { ru: "Пластилин", en: "Play-Doh" },
                "https://s.eu.tankionline.com/541/26511/305/141/27006222421437/image.webp": { ru: "Гончар", en: "Potter" },
                "https://s.eu.tankionline.com/560/100572/177/222/27020213605214/image.webp": { ru: "Драгоценные камни", en: "Precious Studs" },
                "https://s.eu.tankionline.com/541/26511/305/127/27006222271152/image.webp": { ru: "Пульсар", en: "Pulsar" },
                "https://s.eu.tankionline.com/0/16722/221/70/27006222522100/image.webp": { ru: "Премиум краска", en: "Premium paint" },
                "https://s.eu.tankionline.com/567/37634/262/342/27347747132106/image.webp": { ru: "Вопрос", en: "Question" },
                "https://s.eu.tankionline.com/573/100613/307/367/27560142744157/image.webp": { ru: "Красная метка", en: "Red Marks" },
                "https://s.eu.tankionline.com/550/121243/76/201/27006221446651/image.webp": { ru: "Красный мармелад", en: "Red marmalade" },
                "https://s.eu.tankionline.com/0/16722/316/154/27006221217543/image.webp": { ru: "Красный костюм", en: "Red Suit" },
                "https://s.eu.tankionline.com/554/41253/265/310/27006222340462/image.webp": { ru: "Красная планета", en: "Red planet" },
                "https://s.eu.tankionline.com/0/16723/150/165/27006222255511/image.webp": { ru: "Ретина", en: "Retina" },
                "https://s.eu.tankionline.com/541/26511/305/147/27006221262557/image.webp": { ru: "Рябь", en: "Ripple" },
                "https://s.eu.tankionline.com/572/166517/256/34/27535523727317/image.webp": { ru: "Ретровейв", en: "Retrowave" },
                "https://s.eu.tankionline.com/0/16723/135/41/27006222352311/image.webp": { ru: "Коррозия", en: "Rust" },
                "https://s.eu.tankionline.com/0/16723/135/42/27006222376003/image.webp": { ru: "Скандинавия", en: "Scandinavia" },
                "https://s.eu.tankionline.com/555/102601/7/347/27006222561064/image.webp": { ru: "Ночь страха", en: "Scarier Things" },
                "https://s.eu.tankionline.com/0/16723/247/230/27006221277407/image.webp": { ru: "Тайна пришельцев", en: "Secret of the aliens" },
                "https://s.eu.tankionline.com/575/46555/242/41/27652032037172/image.webp": { ru: "Прицел", en: "Sight" },
                "https://s.eu.tankionline.com/561/25253/244/142/27045325521455/image.webp": { ru: "Порезанный", en: "Shredded" },
                "https://s.eu.tankionline.com/541/26511/305/133/27006221345511/image.webp": { ru: "Силикат", en: "Sillicate" },
                "https://s.eu.tankionline.com/550/121245/75/174/27006221622300/image.webp": { ru: "Сингапур", en: "Singapore" },
                "https://s.eu.tankionline.com/0/16723/44/256/27006222314544/image.webp": { ru: "Вьюга", en: "Snowflake" },
                "https://s.eu.tankionline.com/570/61722/240/131/27414734736616/image.webp": { ru: "Скоморох", en: "Skomorokh" },
                "https://s.eu.tankionline.com/562/104265/346/200/27121057602676/image.webp": { ru: "Шипучка", en: "Soda" },
                "https://s.eu.tankionline.com/564/23012/11/216/27204602406375/image.webp": { ru: "Радиолокатор", en: "Sonar" },
                "https://s.eu.tankionline.com/561/142545/333/17/27070551440731/image.webp": { ru: "Мерцание звёзд", en: "Speeding Star" },
                "https://s.eu.tankionline.com/0/16723/23/222/27006222117163/image.webp": { ru: "Блёстки", en: "Spangles" },
                "https://s.eu.tankionline.com/567/130011/174/233/27366564524713/image.webp": { ru: "Весенний букет", en: "Spring bouquet" },
                "https://s.eu.tankionline.com/555/102576/311/233/27006222566342/image.webp": { ru: "Кальмар", en: "Squid Fingers" },
                "https://s.eu.tankionline.com/543/66610/35/62/27006222635760/image.webp": { ru: "Витраж", en: "Stained glass" },
                "https://s.eu.tankionline.com/560/100572/177/224/27020213621647/image.webp": { ru: "Звёзды и пламя", en: "Stars and Flames" },
                "https://s.eu.tankionline.com/0/16723/66/103/27006222461555/image.webp": { ru: "Стальное микроволокно", en: "Steel micro-fibers" },
                "https://s.eu.tankionline.com/0/16723/135/50/27006221702565/image.webp": { ru: "Стейк", en: "Steak" },
                "https://s.eu.tankionline.com/0/16723/135/45/27006221633410/image.webp": { ru: "Клубника", en: "Strawberry" },
                "https://s.eu.tankionline.com/561/142545/333/12/27070551362051/image.webp": { ru: "Стильный танкист", en: "Stylish Tanker" },
                "https://s.eu.tankionline.com/0/16723/66/105/27006221764352/image.webp": { ru: "Вечерний закат", en: "Sunset camouflage" },
                "https://s.eu.tankionline.com/541/26511/305/131/27006222254007/image.webp": { ru: "Судоку", en: "Sudoku" },
                "https://s.eu.tankionline.com/552/51375/362/10/27006222560630/image.webp": { ru: "Тарантул", en: "Tarantula" },
                "https://s.eu.tankionline.com/564/155026/311/101/27233535242303/image.webp": { ru: "Мишень", en: "Target" },
                "https://s.eu.tankionline.com/543/66604/144/13/27006221233210/image.webp": { ru: "Шаровая молния", en: "Thunderball" },
                "https://s.eu.tankionline.com/564/155045/271/143/27233535362310/image.webp": { ru: "Тетрис", en: "Tetris" },
                "https://s.eu.tankionline.com/550/121245/254/153/27006222105355/image.webp": { ru: "Лесной призрак", en: "Timber camo" },
                "https://s.eu.tankionline.com/0/16723/230/43/27006221302543/image.webp": { ru: "Тропическая листва", en: "Tropical Foliage" },
                "https://s.eu.tankionline.com/570/61721/34/177/27414735126051/image.webp": { ru: "НЛО", en: "UFO" },
                "https://s.eu.tankionline.com/565/67400/141/60/27255700060667/image.webp": { ru: "Тропики", en: "Tropics" },
                "https://s.eu.tankionline.com/0/16723/135/44/27006222032035/image.webp": { ru: "Ванадий", en: "Vanadium" },
                "https://s.eu.tankionline.com/561/61551/166/310/27054332366147/image.webp": { ru: "Вирус", en: "Virus" },
                "https://s.eu.tankionline.com/566/115233/43/210/27322340127723/image.webp": { ru: "Извержение вулкана", en: "Volcanic eruption" },
                "https://s.eu.tankionline.com/567/37631/141/325/27347746261730/image.webp": { ru: "Вектор", en: "Vector" },
                "https://s.eu.tankionline.com/0/16722/374/165/27006221666021/image.webp": { ru: "Акварель", en: "Watercolor" },
                "https://s.eu.tankionline.com/571/14366/257/41/27443075527660/image.webp": { ru: "Аллея звёзд", en: "Walk of Fame" },
                "https://s.eu.tankionline.com/553/114361/160/155/27006221205313/image.webp": { ru: "Арбуз", en: "Watermelon" },
                "https://s.eu.tankionline.com/554/41254/55/332/27006221646531/image.webp": { ru: "Белая планета", en: "White planet" },
                "https://s.eu.tankionline.com/572/166517/256/41/27536075120607/image.webp": { ru: "Дикий стиль", en: "Wildstyle" },
                "https://s.eu.tankionline.com/0/16723/247/226/27006222260110/image.webp": { ru: "Дикие джунгли", en: "Wild Jungle" },
                "https://s.eu.tankionline.com/553/3675/302/156/27006221267177/image.webp": { ru: "Чудо-рыба", en: "Wonder fish" },
                "https://s.eu.tankionline.com/554/155644/166/32/27006222147416/image.webp": { ru: "Чудо-птица", en: "Wonderbird" },
                "https://s.eu.tankionline.com/0/16723/5/161/27006222345270/image.webp": { ru: "Зомби", en: "Zombie" },
                "https://s.eu.tankionline.com/541/26511/305/135/27006221144374/image.webp": { ru: "Зигзаг", en: "Zigzag" },
                "https://s.eu.tankionline.com/574/6253/73/215/27602113553573/image.webp": { ru: "Поражающий фактор", en: "Adversity" },
                "https://s.eu.tankionline.com/553/114545/63/226/27006222635041/image.webp": { ru: "Туманность", en: "Alien Nebula" },
                "https://s.eu.tankionline.com/553/116607/12/216/27006221064073/image.webp": { ru: "Кожа инопланетянина", en: "Alien Skin" },
                "https://s.eu.tankionline.com/553/114521/266/63/27006222543366/image.webp": { ru: "Регенерация", en: "Alien Regeneration" },
                "https://s.eu.tankionline.com/552/5401/214/71/27006222503213/image.webp": { ru: "Похищение", en: "Alien abduction" },
                "https://s.eu.tankionline.com/565/67354/367/276/27255673174053/image.webp": { ru: "Сплав", en: "Alloy" },
                "https://s.eu.tankionline.com/557/163337/116/377/27006221612615/image.webp": { ru: "Атмосферные явления", en: "Atmospheric Conditions" },
                "https://s.eu.tankionline.com/546/137356/105/55/27006221600612/image.webp": { ru: "Колючая проволока", en: "Barbed wire" },
                "https://s.eu.tankionline.com/541/107167/201/42/27006221053354/image.webp": { ru: "Биение сердец", en: "Beating Hearts" },
                "https://s.eu.tankionline.com/546/137356/56/326/27006221364671/image.webp": { ru: "Банни", en: "Bunny" },
                "https://s.eu.tankionline.com/564/23562/50/216/27204734424620/image.webp": { ru: "Сирень", en: "Blue lilac" },
                "https://s.eu.tankionline.com/565/67316/325/375/27255663553153/image.webp": { ru: "Вспышка", en: "Burst of Light" },
                "https://s.eu.tankionline.com/554/41031/237/135/27006221073201/image.webp": { ru: "Арестован", en: "Busted" },
                "https://s.eu.tankionline.com/562/44013/24/262/27111011363601/image.webp": { ru: "Карбоновые звёзды", en: "Carbon stars" },
                "https://s.eu.tankionline.com/564/23137/2/12/27204627601405/image.webp": { ru: "Костёр", en: "Campfire" },
                "https://s.eu.tankionline.com/573/10240/175/26/27542050076643/image.webp": { ru: "Кинескоп", en: "Cathode Ray Tube" },
                "https://s.eu.tankionline.com/561/25253/244/135/27045316146637/image.webp": { ru: "Химическая реакция", en: "Chemical Reaction" },
                "https://s.eu.tankionline.com/557/163277/204/145/27006221444234/image.webp": { ru: "Космический взрыв", en: "Cosmic Blast" },
                "https://s.eu.tankionline.com/562/45076/20/306/27111221217077/image.webp": { ru: "Созвездие", en: "Constellation" },
                "https://s.eu.tankionline.com/565/67335/20/34/27255667210211/image.webp": { ru: "Фигурные ножницы", en: "Craft Scissors" },
                "https://s.eu.tankionline.com/561/25253/244/140/27045320163626/image.webp": { ru: "Киберниндзя", en: "Cyber Shuriken" },
                "https://s.eu.tankionline.com/551/134441/174/100/27006221263651/image.webp": { ru: "Бриллиант", en: "Diamond" },
                "https://s.eu.tankionline.com/555/125200/112/312/27006221636176/image.webp": { ru: "Киборг", en: "Cyborg" },
                "https://s.eu.tankionline.com/557/163253/364/266/27006221266743/image.webp": { ru: "Кибернетическое сияние", en: "Digital Borealis" },
                "https://s.eu.tankionline.com/574/6303/366/322/27602117044003/image.webp": { ru: "Привод", en: "Drive" },
                "https://s.eu.tankionline.com/554/156326/105/27/27006222422773/image.webp": { ru: "Электроовцы", en: "Electric Sheep" },
                "https://s.eu.tankionline.com/571/77337/260/262/27457667731175/image.webp": { ru: "Утки", en: "Ducks" },
                "https://s.eu.tankionline.com/545/126733/241/226/27006221063660/image.webp": { ru: "Электроулей", en: "Electrohive" },
                "https://s.eu.tankionline.com/543/66605/321/302/27006221122065/image.webp": { ru: "Извержение", en: "Eruption" },
                "https://s.eu.tankionline.com/562/167467/303/360/27135715742134/image.webp": { ru: "Вентилятор", en: "Fan" },
                "https://s.eu.tankionline.com/545/40720/116/153/27006221147267/image.webp": { ru: "Осенняя листва", en: "Fall leaves" },
                "https://s.eu.tankionline.com/551/134442/20/142/27006222105616/image.webp": { ru: "Крайний Север", en: "Far North" },
                "https://s.eu.tankionline.com/572/14616/220/173/27503143510501/image.webp": { ru: "Антистресс", en: "Fidget toy" },
                "https://s.eu.tankionline.com/550/156234/237/345/27006221375217/image.webp": { ru: "Первый поцелуй", en: "First kiss" },
                "https://s.eu.tankionline.com/551/27317/14/120/27006221162655/image.webp": { ru: "Огненный голем", en: "Fire golem" },
                "https://s.eu.tankionline.com/0/16723/161/100/27006222633303/image.webp": { ru: "Флоу", en: "Flow" },
                "https://s.eu.tankionline.com/560/100572/177/142/27020205723767/image.webp": { ru: "Металлический дождь", en: "Flowing Metal" },
                "https://s.eu.tankionline.com/552/54561/235/227/27006222573543/image.webp": { ru: "Галактический взрыв", en: "Galaxian Explosion" },
                "https://s.eu.tankionline.com/570/61726/363/237/27414731172757/image.webp": { ru: "Маховик", en: "Flywheel" },
                "https://s.eu.tankionline.com/542/132027/0/273/27006222067226/image.webp": { ru: "Галактика", en: "Galaxy" },
                "https://s.eu.tankionline.com/541/175531/252/111/27006221151645/image.webp": { ru: "Джинга", en: "Ginga" },
                "https://s.eu.tankionline.com/552/64054/13/237/27006221703215/image.webp": { ru: "Золотой механизм", en: "Golden Gears" },
                "https://s.eu.tankionline.com/562/167562/332/122/27135734555253/image.webp": { ru: "Золотой сплав", en: "Gold alloy" },
                "https://s.eu.tankionline.com/561/25253/244/123/27045322021177/image.webp": { ru: "Ядовитое море", en: "Green Quads" },
                "https://s.eu.tankionline.com/573/10253/221/41/27542052710643/image.webp": { ru: "Зелёный циркон", en: "Green Zircon" },
                "https://s.eu.tankionline.com/561/142545/333/4/27070543637031/image.webp": { ru: "Палач", en: "Head Ripper" },
                "https://s.eu.tankionline.com/560/100572/177/211/27020207566142/image.webp": { ru: "Неоновая молния", en: "Groovy Neon" },
                "https://s.eu.tankionline.com/540/66764/173/103/27006221166103/image.webp": { ru: "Гирлянда", en: "Holiday lights" },
                "https://s.eu.tankionline.com/551/27324/215/231/27006221422007/image.webp": { ru: "Холо", en: "Holo" },
                "https://s.eu.tankionline.com/570/61724/113/126/27414734473666/image.webp": { ru: "Чип", en: "Integrated circuit" },
                "https://s.eu.tankionline.com/551/5072/7/20/27006222160574/image.webp": { ru: "Честь", en: "Honor" },
                "https://s.eu.tankionline.com/556/131050/2/17/27006222041207/image.webp": { ru: "Весёлое время", en: "Jolly Season" },
                "https://s.eu.tankionline.com/555/102557/217/260/27006221663214/image.webp": { ru: "Фарш", en: "Kapuljat" },
                "https://s.eu.tankionline.com/545/11634/266/74/27006221352635/image.webp": { ru: "Светодиоды", en: "LEDs" },
                "https://s.eu.tankionline.com/547/116334/23/330/27006222557743/image.webp": { ru: "Лава-лампа", en: "Lava Lamp" },
                "https://s.eu.tankionline.com/556/15666/277/75/27006221152035/image.webp": { ru: "Магические круги", en: "Magic Circles" },
                "https://s.eu.tankionline.com/556/15653/72/150/27006221261625/image.webp": { ru: "Живая броня", en: "Living Armor" },
                "https://s.eu.tankionline.com/545/11637/17/302/27006221255520/image.webp": { ru: "Звездопад", en: "Meteor shower" },
                "https://s.eu.tankionline.com/551/134443/11/33/27006221573765/image.webp": { ru: "Микробиология", en: "Microbiology" },
                "https://s.eu.tankionline.com/545/40721/204/340/27006222237552/image.webp": { ru: "Фудзияма", en: "Mount Fuji" },
                "https://s.eu.tankionline.com/554/41014/330/72/27006221346332/image.webp": { ru: "Монохром", en: "Monochrome" },
                "https://s.eu.tankionline.com/561/25253/244/133/27045325441716/image.webp": { ru: "Нанолаборатория", en: "NanoHUD" },
                "https://s.eu.tankionline.com/555/102567/300/350/27006222207616/image.webp": { ru: "Неоновая геометрия", en: "Neon Geometry" },
                "https://s.eu.tankionline.com/554/175557/212/17/27006221622445/image.webp": { ru: "Ночной город", en: "Night City" },
                "https://s.eu.tankionline.com/572/100163/46/345/27520034623546/image.webp": { ru: "Никель", en: "Nickel" },
                "https://s.eu.tankionline.com/550/121250/255/352/27006222365131/image.webp": { ru: "Северное сияние", en: "Northern Lights" },
                "https://s.eu.tankionline.com/564/23104/51/321/27204621025403/image.webp": { ru: "Печатная плата", en: "PCB" },
                "https://s.eu.tankionline.com/561/142545/333/0/27070542052722/image.webp": { ru: "Пиксельная плазма", en: "Pixel Plasma" },
                "https://s.eu.tankionline.com/543/137742/302/13/27006221451300/image.webp": { ru: "Пастила", en: "Pastila" },
                "https://s.eu.tankionline.com/541/134056/335/343/27006222515054/image.webp": { ru: "Продиджи 2.0", en: "Prodigy 2.0" },
                "https://s.eu.tankionline.com/556/42751/263/315/27006222270665/image.webp": { ru: "Квантовый камуфляж", en: "Quantum Camo" },
                "https://s.eu.tankionline.com/576/110301/22/145/27722060211602/image.webp": { ru: "Красный дым", en: "Red smoke" },
                "https://s.eu.tankionline.com/554/67736/267/363/27006222626613/image.webp": { ru: "Радар", en: "Radar" },
                "https://s.eu.tankionline.com/555/102571/41/46/27006221160241/image.webp": { ru: "Весёлые семидесятые", en: "Seventies Fun" },
                "https://s.eu.tankionline.com/543/66606/257/72/27006221135122/image.webp": { ru: "Амурский тигр", en: "Siberian tiger" },
                "https://s.eu.tankionline.com/556/15710/153/1/27006222055570/image.webp": { ru: "Душа", en: "Souls" },
                "https://s.eu.tankionline.com/547/116415/163/70/27006222526160/image.webp": { ru: "Серебряные кирпичи", en: "Silver Bricks" },
                "https://s.eu.tankionline.com/561/142545/333/6/27070545722177/image.webp": { ru: "Поглощение", en: "Spreading Fast" },
                "https://s.eu.tankionline.com/551/24635/26/42/27006221136712/image.webp": { ru: "Весна", en: "Spring" },
                "https://s.eu.tankionline.com/546/34534/61/72/27006221606474/image.webp": { ru: "Симбиот", en: "Symbiote" },
                "https://s.eu.tankionline.com/564/23530/353/164/27204726166310/image.webp": { ru: "Сёрфинг", en: "Surf" },
                "https://s.eu.tankionline.com/540/66633/55/221/27006222576001/image.webp": { ru: "Синестезия", en: "Synesthesia" },
                "https://s.eu.tankionline.com/545/126733/27/326/27006222233466/image.webp": { ru: "Синти-поп", en: "Synth-pop" },
                "https://s.eu.tankionline.com/547/146221/51/60/27006221444421/image.webp": { ru: "Прикосновение холода", en: "Touch of chill" },
                "https://s.eu.tankionline.com/547/116166/351/53/27006221657440/image.webp": { ru: "Тессеракт", en: "Tessaract Camo" },
                "https://s.eu.tankionline.com/556/131022/31/265/27006221105147/image.webp": { ru: "В ловушке", en: "Trapped Inside" },
                "https://s.eu.tankionline.com/556/131072/132/233/27006222453416/image.webp": { ru: "Под ёлкой", en: "Under the Tree" },
                "https://s.eu.tankionline.com/543/174437/247/40/27006221244761/image.webp": { ru: "Доблесть", en: "Valour" },
                "https://s.eu.tankionline.com/541/30734/372/213/27006221242753/image.webp": { ru: "Вертиго", en: "Vertigo" },
                "https://s.eu.tankionline.com/551/132461/354/137/27006221251124/image.webp": { ru: "lol", en: "lol" },
                "https://s.eu.tankionline.com/544/55151/301/253/27006221753027/image.webp": { ru: "Анютины глазки", en: "Beholder" },
                "https://s.eu.tankionline.com/552/54546/72/26/27006222303074/image.webp": { ru: "Жвачка", en: "Bubble gum" },
                "https://s.eu.tankionline.com/572/34572/161/327/27507136471206/image.webp": { ru: "Чёрное море", en: "Black Sea" },
                "https://s.eu.tankionline.com/555/175756/337/316/27006222621337/image.webp": { ru: "Тыквы", en: "Cucurbita Pepo" },
                "https://s.eu.tankionline.com/550/121247/107/213/27006221631475/image.webp": { ru: "Киберпанк", en: "Cyberpunk" },
                "https://s.eu.tankionline.com/561/142545/333/10/27070547604376/image.webp": { ru: "Землянин", en: "Earthling" },
                "https://s.eu.tankionline.com/550/121247/327/43/27006221125222/image.webp": { ru: "Диско 2.0", en: "Disco 2.0" },
                "https://s.eu.tankionline.com/574/50101/372/330/27612512065507/image.webp": { ru: "Глазунья", en: "Fried egg" },
                "https://s.eu.tankionline.com/557/33663/377/245/27006221660512/image.webp": { ru: "Холодный покров", en: "Frigid Coat" },
                "https://s.eu.tankionline.com/545/11636/174/162/27006222412272/image.webp": { ru: "Шестерёнки", en: "Gears" },
                "https://s.eu.tankionline.com/557/163350/114/62/27006221671646/image.webp": { ru: "Странное лекарство", en: "Funky medicine" },
                "https://s.eu.tankionline.com/555/102563/132/116/27006221451423/image.webp": { ru: "Красная палитра", en: "Glam Croc" },
                "https://s.eu.tankionline.com/572/77671/70/327/27517756234532/image.webp": { ru: "Свечение", en: "Glow" },
                "https://s.eu.tankionline.com/557/33643/117/215/27006222232451/image.webp": { ru: "Ледяной вихрь", en: "Ice Flurry" },
                "https://s.eu.tankionline.com/560/100572/177/206/27020211502220/image.webp": { ru: "Стальное сердце", en: "Heart of Steel" },
                "https://s.eu.tankionline.com/565/67302/67/275/27255660434051/image.webp": { ru: "Иероглифы", en: "Katakana" },
                "https://s.eu.tankionline.com/551/27326/221/341/27006221265166/image.webp": { ru: "Лиана", en: "Liana" },
                "https://s.eu.tankionline.com/562/167535/267/252/27135727334011/image.webp": { ru: "Светомузыка", en: "Light organ" },
                "https://s.eu.tankionline.com/547/116435/370/371/27006222240217/image.webp": { ru: "Гроза", en: "Lightning storm" },
                "https://s.eu.tankionline.com/543/421/60/312/27006222146637/image.webp": { ru: "Магнолия", en: "Magnolia" },
                "https://s.eu.tankionline.com/560/100572/177/214/27020213473672/image.webp": { ru: "Розовый камуфляж", en: "Loving Camo" },
                "https://s.eu.tankionline.com/541/30734/302/362/27006221540354/image.webp": { ru: "Матрица", en: "Matrix" },
                "https://s.eu.tankionline.com/541/30734/350/113/27006222204042/image.webp": { ru: "Мозаика", en: "Mosaic" },
                "https://s.eu.tankionline.com/0/16723/270/215/27006221715734/image.webp": { ru: "Кошмар", en: "Nightmare" },
                "https://s.eu.tankionline.com/554/156327/273/12/27006221406451/image.webp": { ru: "Нанокостюм", en: "Nanosuit Armor" },
                "https://s.eu.tankionline.com/554/156330/206/342/27006222023224/image.webp": { ru: "Без фонарей", en: "Not a lantern" },
                "https://s.eu.tankionline.com/545/11635/326/23/27006221116243/image.webp": { ru: "Радиоактивное желе", en: "Radioactive jelly" },
                "https://s.eu.tankionline.com/543/66607/263/64/27006222205740/image.webp": { ru: "Секретный соус", en: "Secret sauce" },
                "https://s.eu.tankionline.com/546/5266/115/372/27006222046566/image.webp": { ru: "Руны", en: "Runes" },
                "https://s.eu.tankionline.com/555/102566/10/263/27006222330022/image.webp": { ru: "Дымовая завеса", en: "Smoke Screen" },
                "https://s.eu.tankionline.com/557/16767/303/253/27006221503663/image.webp": { ru: "Искры", en: "Sparks" },
                "https://s.eu.tankionline.com/545/11560/327/27/27006222202266/image.webp": { ru: "Спиннер", en: "Spinner" },
                "https://s.eu.tankionline.com/537/161126/341/105/27006222025770/image.webp": { ru: "Спектр", en: "Spectrum" },
                "https://s.eu.tankionline.com/556/15723/374/66/27006222550606/image.webp": { ru: "Танкоиновый танк", en: "Tankoin Tank" },
                "https://s.eu.tankionline.com/562/167566/77/60/27135735437610/image.webp": { ru: "Тектонические плиты", en: "Tectonic plates" },
                "https://s.eu.tankionline.com/546/73403/142/220/27006221330173/image.webp": { ru: "Крестики-нолики", en: "Tic-tac-toe" },
                "https://s.eu.tankionline.com/545/11640/53/20/27006221673161/image.webp": { ru: "Щупальца", en: "Tentacles" },
                "https://s.eu.tankionline.com/553/1364/357/16/27006222521372/image.webp": { ru: "Визуальный разрушитель", en: "Visual Disruptor" },
                "https://s.eu.tankionline.com/553/1432/203/174/27006221621075/image.webp": { ru: "Чёрный X", en: "X Noir" },
                "https://s.eu.tankionline.com/626/34322/273/374/31307064536373/image.webp": { ru: "Андромеда", en: "Andromeda" },
                "https://s.eu.tankionline.com/636/64631/20/144/31715146210615/image.webp": { ru: "Чемпион 1", en: "Champion 1" },
                "https://s.eu.tankionline.com/636/64632/40/322/31715146420717/image.webp": { ru: "Чемпион 3", en: "Champion 3" },
                "https://s.eu.tankionline.com/636/64631/271/177/31715146335213/image.webp": { ru: "Чемпион 2", en: "Champion 2" },
                "https://s.eu.tankionline.com/636/64632/204/306/31715146502712/image.webp": { ru: "Чемпион 4", en: "Champion 4" },
                "https://s.eu.tankionline.com/636/64632/341/332/31715146561331/image.webp": { ru: "Чемпион 5", en: "Champion 5" },
                "https://s.eu.tankionline.com/636/113241/254/242/31722650360504/image.webp": { ru: "Чемпион 7", en: "Champion 7" },
                "https://s.eu.tankionline.com/636/64633/124/217/31715146652620/image.webp": { ru: "Чемпион 6", en: "Champion 6" },
                "https://s.eu.tankionline.com/636/64634/266/61/31715147133461/image.webp": { ru: "Чемпион 8", en: "Champion 8" },
                "https://s.eu.tankionline.com/636/20255/22/326/31704053211730/image.webp": { ru: "Бронеблоки", en: "Generic regular paint" },
                "https://s.eu.tankionline.com/616/164773/336/3/30735176757304/image.webp": { ru: "Блеск", en: "Gloss" },
                "https://s.eu.tankionline.com/606/52062/370/75/30312414574376/image.webp": { ru: "Hazels Panzerwerke", en: "Hazel’s Panzerwerke" },
                "https://s.eu.tankionline.com/606/52063/234/116/30312414716416/image.webp": { ru: "Houston Tankin", en: "Houston Tankin" },
                "https://s.eu.tankionline.com/606/52064/104/300/30312415042577/image.webp": { ru: "Llama Tankini", en: "Llama Tankini" },
                "https://s.eu.tankionline.com/635/105542/313/241/31661330546314/image.webp": { ru: "Пространство-время", en: "Space-time" },
                "https://s.eu.tankionline.com/606/52065/331/327/30312415355227/image.webp": { ru: "Tank-Noir", en: "Tank-Noir" },
                "https://s.eu.tankionline.com/606/52064/342/262/30312415161557/image.webp": { ru: "Tanki’s Sun", en: "Tanki’s Sun" },
                "https://s.eu.tankionline.com/565/174716/301/174/27277163541001/image.webp": { ru: "Шоппер", en: "Tote bag" },
                "https://s.eu.tankionline.com/606/52065/140/22/30312415260320/image.webp": { ru: "Tankitty", en: "Tankitty" },
                "https://s.eu.tankionline.com/554/41027/222/240/27006222005546/image.webp": { ru: "Барсук", en: "Badger-badger" },
                "https://s.eu.tankionline.com/552/130105/276/1/27006221126362/image.webp": { ru: "Доспехи Танкоса", en: "Thankos' Armor" },
                "https://s.eu.tankionline.com/571/146107/120/162/27471421650333/image.webp": { ru: "Banguins", en: "Banguins" },
                "https://s.eu.tankionline.com/557/33435/327/166/27042003502540/image.webp": { ru: "Eternity", en: "Eternity" },
                "https://s.eu.tankionline.com/566/16501/275/45/27303520336671/image.webp": { ru: "Flash", en: "Flash" },
                "https://s.eu.tankionline.com/544/1406/301/57/27006221566433/image.webp": { ru: "Prestigio", en: "Prestigio" },
                "https://s.eu.tankionline.com/573/113624/260/274/27562745130504/image.webp": { ru: "Бронзовые доспехи", en: "Bronze armor" },
                "https://s.eu.tankionline.com/607/11377/340/76/30342277760400/image.webp": { ru: "Галактикус", en: "Galacticus" },
                "https://s.eu.tankionline.com/543/420/22/72/27006221577426/image.webp": { ru: "Герой Canyon", en: "Canyon Hero" },
                "https://s.eu.tankionline.com/606/142716/313/333/30330563546232/image.webp": { ru: "Зелёная дружина", en: "Green retinue" },
                "https://s.eu.tankionline.com/557/165265/117/326/27006222021647/image.webp": { ru: "Инь & Янь", en: "Yin & Yang" },
                "https://s.eu.tankionline.com/0/16723/267/303/27006221335606/image.webp": { ru: "Команда ВК", en: "Team VK" },
                "https://s.eu.tankionline.com/606/142720/365/252/30330564173147/image.webp": { ru: "Лепреконовое братство", en: "Leprechaun brotherhood" },
                "https://s.eu.tankionline.com/637/14513/322/52/31743122751445/image.webp": { ru: "Офис", en: "Office" },
                "https://s.eu.tankionline.com/606/142721/275/246/30330564337144/image.webp": { ru: "Отряд трилистника", en: "Shamrock squad" },
                "https://s.eu.tankionline.com/560/117420/343/260/27023704322263/image.webp": { ru: "Пермская езда", en: "City Dweller" },
                "https://s.eu.tankionline.com/554/41031/237/374/27006221661631/image.webp": { ru: "Разрушитель 2.0", en: "Demolisher 2.0" },
                "https://s.eu.tankionline.com/554/41031/240/177/27006221444112/image.webp": { ru: "Разрушитель", en: "Demolisher" },
                "https://s.eu.tankionline.com/577/175111/75/52/27777616243732/image.webp": { ru: "Сингулярность", en: "Singularity" },
                "https://s.eu.tankionline.com/574/114530/336/250/27624215522147/image.webp": { ru: "Сладкая гадость", en: "Sweet trick" },
                "https://s.eu.tankionline.com/554/156200/50/25/27006221151413/image.webp": { ru: "Танки 1.0", en: "Tanks 1.0" },
                "https://s.eu.tankionline.com/554/156201/236/305/27006221071275/image.webp": { ru: "Танки 2.0", en: "Tanks 2.0" },
                "https://s.eu.tankionline.com/0/16717/162/311/27006221312413/image.webp": { ru: "Трейсер", en: "Traceur" },
                "https://s.eu.tankionline.com/604/55511/67/367/30213322234265/image.webp": { ru: "Diamonds", en: "Diamonds" },
                "https://s.eu.tankionline.com/604/55511/301/54/30213322340751/image.webp": { ru: "Guardians Advanced", en: "Guardians Advanced" },
                "https://s.eu.tankionline.com/617/161572/12/27/30774336405330/image.webp": { ru: "KAN", en: "KAN" },
                "https://s.eu.tankionline.com/626/174416/341/37/31337103561042/image.webp": { ru: "Lovesick ", en: "Lovesick " },
                "https://s.eu.tankionline.com/617/161576/310/47/30774337544347/image.webp": { ru: "Lovesick", en: "Lovesick" },
                "https://s.eu.tankionline.com/626/174416/104/362/31337103442766/image.webp": { ru: "Memento mei", en: "Memento mei" },
                "https://s.eu.tankionline.com/626/174414/133/334/31337103056335/image.webp": { ru: "Pepega", en: "Pepega" },
                "https://s.eu.tankionline.com/617/161575/153/113/30774337266012/image.webp": { ru: "Pepega", en: "Pepega" },
                "https://s.eu.tankionline.com/604/55500/13/301/30213320006200/image.webp": { ru: "Pepega", en: "Pepega" },
                "https://s.eu.tankionline.com/617/161573/125/340/30774336653240/image.webp": { ru: "Punishment", en: "Punishment" },
                "https://s.eu.tankionline.com/617/161574/357/332/30774337170236/image.webp": { ru: "Red Notice", en: "Red Notice" },
                "https://s.eu.tankionline.com/604/55507/215/25/30213321706723/image.webp": { ru: "Red Notice", en: "Red Notice" },
                "https://s.eu.tankionline.com/604/55475/145/334/30213317263232/image.webp": { ru: "Retired Bots", en: "Retired Bots" },
                "https://s.eu.tankionline.com/626/174420/12/136/31337104005537/image.webp": { ru: "Sennaar", en: "Sennaar" },
                "https://s.eu.tankionline.com/626/174417/172/341/31337103675744/image.webp": { ru: "Spirit", en: "Spirit" },
                "https://s.eu.tankionline.com/604/55510/201/235/30213322101132/image.webp": { ru: "Team Pointers", en: "Team Pointers" },
                "https://s.eu.tankionline.com/613/145034/52/121/30571207025423/image.webp": { ru: "TeamP", en: "TeamP" },
                "https://s.eu.tankionline.com/617/161573/352/210/30774336765507/image.webp": { ru: "Top25OrNothing", en: "Top25OrNothing" },
                "https://s.eu.tankionline.com/604/55506/341/364/30213321561263/image.webp": { ru: "Toxic", en: "Toxic" },
                "https://s.eu.tankionline.com/626/174413/166/206/31337102673611/image.webp": { ru: "Troublemakers", en: "Troublemakers" },
                "https://s.eu.tankionline.com/613/145035/166/312/30571207273614/image.webp": { ru: "Undervalued", en: "Undervalued" },
                "https://s.eu.tankionline.com/626/174415/37/54/31337103220054/image.webp": { ru: "Vega", en: "Vega" },
                "https://s.eu.tankionline.com/604/116750/270/106/30223572134410/image.webp": { ru: "Зомби", en: "Zombies" },
                "https://s.eu.tankionline.com/604/116747/312/7/30223571745335/image.webp": { ru: "Иммуны", en: "Immunes" }
            };

            function normalizeText(text: string) {
                if (!text) return "";
                return text.toLowerCase().replace(/ё/g, 'е');
            }

            function applySearch() {
                const input = document.querySelector('.kasp-search-wrapper input') as HTMLInputElement;
                if (!input) return;
                const rawQuery = input.value.trim();
                const queryWords = normalizeText(rawQuery).split(/\s+/).filter(word => word.length > 0);
                const items = document.querySelectorAll('.kasp-paints-container .garage-item');
                
                items.forEach(itemEl => {
                    const item = itemEl as HTMLElement;
                    if (queryWords.length === 0) {
                        item.style.display = '';
                        return;
                    }
                    const imgElement = item.querySelector('.GarageItemComponentStyle-mainImg');
                    if (!imgElement) return;
                    const src = imgElement.getAttribute('src');
                    if (!src) return;
                    const paintInfo = paintsData[src];
                    let isMatch = false;
                    if (paintInfo) {
                        const combinedNames = normalizeText(paintInfo.ru + " " + paintInfo.en);
                        isMatch = queryWords.every(word => combinedNames.includes(word));
                    }
                    item.style.display = isMatch ? '' : 'none';
                });

                const columns = document.querySelectorAll('.kasp-paints-container > div');
                columns.forEach(colEl => {
                    const col = colEl as HTMLElement;
                    const visibleItems = Array.from(col.querySelectorAll('.garage-item')).filter(i => (i as HTMLElement).style.display !== 'none');
                    col.style.display = visibleItems.length === 0 ? 'none' : '';
                });
            }

            function addSearchInput() {
                const captionContainer = document.querySelector('.PaintsCollectionComponentStyle-captionPaint');
                if (!captionContainer) return;
                const parentBlock = captionContainer.closest('.PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory');
                if (!parentBlock || parentBlock.querySelector('.kasp-search-wrapper')) return;

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
                if (!utils.getSetting('k_paints', false)) return;
                if (state.currentScreen !== 'garage') return;

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
                const input = document.querySelector('.kasp-search-wrapper input') as HTMLInputElement;
                if (input && input.value.trim() !== '') {
                    applySearch();
                }
            };
        })(),

        augmentSpecs: (() => {
            let initialized = false;
            let updateQueued = false;
            const t: Record<string, Record<string, string>> = {
                RU: { specsTitle: 'Характеристики', adv: 'Преимущества', disadv: 'Недостатки', empty: 'Нет данных' },
                EN: { specsTitle: 'Specs', adv: 'Advantages', disadv: 'Disadvantages', empty: 'No data' }
            };

            const STAT_DICT: Record<string, { RU: string | string[]; EN: string | string[] }> = {
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

            const sharedHullSpecs: Record<string, any> = {
                heatResistance: {
                    name: { RU: "Защита от поджога", EN: "Heat Resistance" },
                    advantages: [
                        { RU: "Урон получаемый от горения: -50%", EN: "Damage taken from Burning: -50%" },
                        { RU: "Скорость нагрева: -50%", EN: "Heating rate: -50%" }
                    ],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                coldResistance: {
                    name: { RU: "Защита от заморозки", EN: "Cold Resistance" },
                    advantages: [
                        { RU: "Замедление от заморозки: -50%", EN: "Slowdown from Freezing: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -50%" }
                    ],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                lightweight: {
                    name: { RU: "Облегчение конструкции", EN: "Lightweight Construction" },
                    advantages: [{ RU: "Ускорение: +15%", EN: "Acceleration: +15%" }],
                    disadvantages: [{ RU: "Масса: -30%", EN: "Weight: -30%" }],
                    modifiers: { TOP_SPEED: 1.15, WEIGHT: 0.7 }
                },
                heavyweight: {
                    name: { RU: "Утяжеление конструкции", EN: "Heavyweight Construction" },
                    advantages: [{ RU: "Масса: +30%", EN: "Weight: +30%" }],
                    disadvantages: [{ RU: "Ускорение: -15%", EN: "Acceleration: -15%" }],
                    modifiers: { WEIGHT: 1.3, TOP_SPEED: 0.85 }
                },
                engineer: {
                    name: { RU: "Инженер", EN: "Engineer" },
                    advantages: [{ RU: "Подбор любой коробки добавляет 1 000 HP", EN: "Picking up a supply box adds 1000 HP" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                heatImmunity: {
                    name: { RU: "Иммунитет от поджога", EN: "Heat Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-red'>Горение</span>", EN: "Provides complete immunity from Burning." }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                coldImmunity: {
                    name: { RU: "Иммунитет от заморозки", EN: "Cold Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Provides complete immunity from Freezing." }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                empImmunity: {
                    name: { RU: "Иммунитет от ЭМИ", EN: "EMP Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-green'>Электромагнитный импульс</span>", EN: "Provides complete immunity from Electromagnetic Pulse" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                stunImmunity: {
                    name: { RU: "Иммунитет от оглушения", EN: "Stun Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-yellow'>Оглушение</span>", EN: "Provides complete immunity from Stun" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                apImmunity: {
                    name: { RU: "Иммунитет от пробития", EN: "AP Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-purple'>Пробитие</span>", EN: "Provides complete immunity from Armor-Piercing" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                jammerImmunity: {
                    name: { RU: "Иммунитет от подавления", EN: "Jammer Immunity" },
                    advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-pink'>Подавление</span>", EN: "Provides complete immunity from Jammer" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                driver: {
                    name: { RU: "Драйвер", EN: "Driver" },
                    advantages: [
                        {
                            RU: "Ускоряет заряд овердрайва в бою:",
                            EN: "Speed of overdrive reload:",
                            subItems: [
                                { RU: "Заряд овердрайва от времени: +100%", EN: "Speed of overdrive reload (time): +100%" },
                                { RU: "Заряд овердрайва от очков: +50%", EN: "Speed of overdrive reload (score): +50%" }
                            ]
                        }
                    ],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                blaster: {
                    name: { RU: "Подрывник", EN: "Blaster" },
                    advantages: [
                        {
                            RU: "Хаос-урон при уничтожении танка:",
                            EN: "Chaos damage on death:",
                            subItems: [
                                { RU: "Лёгкие корпуса: 750–1500 hp", EN: "Light hulls: 750–1500 hp" },
                                { RU: "Средние корпуса: 1125–2250 hp", EN: "Medium hulls: 1125–2250 hp" },
                                { RU: "Тяжёлые корпуса: 1500–3000 hp", EN: "Heavy hulls: 1500–3000 hp" },
                                { RU: "Радиус полного поражения взрывом: 3 м", EN: "Radius of full damage: 3 m" },
                                { RU: "Радиус промежуточного поражения взрывом: 4 м", EN: "Radius of intermediate damage: 4 m" },
                                { RU: "Радиус минимального поражения взрывом: 15 м", EN: "Radius of minimum damage: 15 m" }
                            ]
                        }
                    ],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                lifeguard: {
                    name: { RU: "Спасатель", EN: "Lifeguard" },
                    advantages: [{ RU: "Предотвращает уничтожение и моментально восстанавливает 500 hp один раз за респаун", EN: "Prevents death once per respawn and recovers 500 HP" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                miner: {
                    name: { RU: "Минёр", EN: "Miner" },
                    advantages: [{ RU: "После уничтожения танка сохраняет 70% установленных мин", EN: "70% of mines survive after death" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                grenadier: {
                    name: { RU: "Гренадёр", EN: "Grenadier" },
                    advantages: [{ RU: "Перезарядка гранат больше не требует респауна танка", EN: "Grenade reload persists without respawning" }],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
                },
                excelsior: {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Броня: +25%", EN: "Health: +25%" },
                        { RU: "Максимальная скорость: +10%", EN: "Top speed: +10%" },
                        { RU: "Мощность: +15%", EN: "Power: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [{ RU: "Отсутствуют", EN: "None" }],
                    modifiers: { ARMOR: 1.25, TOP_SPEED: 1.10, POWER: 1.15, TURN_SPEED: 1.15 }
                },
                extremeLightweight: {
                    name: { RU: "Экстремальное облегчение", EN: "Extreme Lightweight Construction" },
                    advantages: [{ RU: "Масса: 1000 кг (идеально для паркура)", EN: "Weight: 1000 kg, ideal for parkour" }],
                    disadvantages: [{ RU: "Слабый в обычных боях", EN: "Weak in regular battles" }],
                    modifiers: { WEIGHT: 1000 }
                },
                phoenix: {
                    name: { RU: "Феникс", EN: "Phoenix" },
                    advantages: [
                        { RU: "Скорость нагрева: -50%", EN: "Heating speed: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freeze speed: -50%" },
                        { RU: "Иммунитет от подавления, ЭМИ, оглушения и пробития", EN: "Immunity from jammer, emp, stun, ap" }
                    ],
                    disadvantages: [{ RU: "Овердрайв не заряжается со временем", EN: "Overdrive does not charge passively" }]
                }
            };

            const deviceSpecsDB: Record<string, any> = {
                "https://s.eu.tankionline.com/605/115404/204/34/31771401546541/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect" }
                    ],
                    modifiers: { DPS: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/35/123/31770675422274/image.svg": {
                    name: { RU: "Насос повышенного давления", EN: "High-pressure pump" },
                    advantages: [
                        { RU: "Дальность слабого поражения: +50%", EN: "Range +50%" },
                        { RU: "Дальность среднего поражения: +25%", EN: "Range (of minimum damage): +50%" },
                        { RU: "Дальность полного поражения: +50%", EN: "Range of maximum damage: +50%" },
                        { RU: "Дальность подсветки противника: +20%", EN: "Target illumination range: +20%" }
                    ],
                    disadvantages: [
                        { RU: "Угол конуса: –75%", EN: "Cone angle: -75%" }
                    ],
                    modifiers: { RANGE: 1.50 }
                },
                "https://s.eu.tankionline.com/605/137574/33/65/31770675342601/image.svg": {
                    name: { RU: "Компактные баллоны", EN: "Compact fuel tanks" },
                    advantages: [
                        { RU: "Скорость нагрева: +100%", EN: "Heating rate: +1.00 / tick" },
                        { RU: "Максимальная температура: +100%", EN: "Upper temperature limit: +1.00" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +100%", EN: "Reload: +100%" },
                        { RU: "Расход энергии: +50%", EN: "Energy consumption: +50%" }
                    ],
                    modifiers: { CHARGE_RATE: 2, RELOAD: 2 }
                },
                "https://s.eu.tankionline.com/605/115404/207/251/31770675520406/image.svg": {
                    name: { RU: "Зажигательная смесь", EN: "Incendiary mix" },
                    advantages: [
                        { RU: "Урон: +20%", EN: "Damage: +20%" },
                        { RU: "Критический урон: +20%", EN: "Critical damage: +20%" }
                    ],
                    disadvantages: [
                        { RU: "Эффект поджигания: отключён", EN: "Afterburn effect removed" }
                    ],
                    modifiers: { DAMAGE: 1.2, CRIT_DAMAGE: 1.2 }
                },
                "https://s.eu.tankionline.com/605/115404/212/6/31770675602705/image.svg": {
                    name: { RU: "Магнитная смесь", EN: "Magnetic Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 sec" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/213/45/31770676007062/image.svg": {
                    name: { RU: "Парализующая смесь", EN: "Paralyzing mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                            subItems: [
                                { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/214/131/31770675743176/image.svg": {
                    name: { RU: "Токсичная смесь", EN: "Toxic Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-purple'>Armor-Piercing</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/210/316/31770675661143/image.svg": {
                    name: { RU: "Подавляющая смесь", EN: "Jamming Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -24%", EN: "Critical chance: -25%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153142/22/275/31770676354421/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect" }
                    ],
                    modifiers: { DPS: 1.9 }
                },
                "https://s.eu.tankionline.com/605/161407/341/230/31770676077403/image.svg": {
                    name: { RU: "Критическая смесь", EN: "Critical Mix" },
                    advantages: [
                        { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                        { RU: "Шанс критического урона: +320%", EN: "Max. critical hit chance: +400%" },
                        { RU: "Начальный шанс критического урона: +400%", EN: "Starting critical hit chance: +400%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.5 }
                },
                "https://s.eu.tankionline.com/626/14777/75/17/31303177701337/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/215/175/31771402004720/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/40/217/31770700057303/image.svg": {
                    name: { RU: "Насос повышенного давления", EN: "High-pressure pump" },
                    advantages: [
                        { RU: "Дальность слабого поражения: +50%", EN: "Range (of minimum damage): +50%" },
                        { RU: "Дальность среднего поражения: +25%", EN: "Mid-range target distance: +25%" },
                        { RU: "Дальность полного поражения: +50%", EN: "Range of maximum damage: +50%" },
                        { RU: "Дальность подсветки противника: +20%", EN: "Target illumination range: +20%" }
                    ],
                    disadvantages: [
                        { RU: "Угол конуса: –75%", EN: "Cone angle: -75%" }
                    ],
                    modifiers: { RANGE: 1.5 }
                },
                "https://s.eu.tankionline.com/605/137574/37/51/31770677767625/image.svg": {
                    name: { RU: "Коррозионная смесь", EN: "Corrosive mix" },
                    advantages: [
                        { RU: "Урон в секунду: +10%", EN: "Damage: +10%" },
                        { RU: "Критический урон: +10%", EN: "Critical damage: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Эффект заморозки: отключён", EN: "Freezing effect removed" }
                    ],
                    modifiers: { DPS: 1.1, DAMAGE: 1.1, CRIT_DAMAGE: 1.1 }
                },
                "https://s.eu.tankionline.com/605/115404/223/146/31770700200611/image.svg": {
                    name: { RU: "Шоковая заморозка", EN: "Shock freeze" },
                    advantages: [
                        { RU: "Скорость заморозки: +100%", EN: "Freezing rate: -1.00 / tick" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -10%", EN: "Damage: -10%" },
                        { RU: "Критический урон: отсутствует", EN: "Critical hits removed" }
                    ],
                    modifiers: { DPS: 0.9, DAMAGE: 0.9, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/605/115404/217/336/31770700456151/image.svg": {
                    name: { RU: "Магнитная смесь", EN: "Magnetic Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/224/216/31770700717251/image.svg": {
                    name: { RU: "Парализующая смесь", EN: "Paralyzing Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                            subItems: [
                                { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/222/102/31770700637565/image.svg": {
                    name: { RU: "Токсичная смесь", EN: "Toxic Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/225/307/31770700565213/image.svg": {
                    name: { RU: "Подавляющая смесь", EN: "Jamming Mix" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/623/22505/354/320/31770700776133/image.svg": {
                    name: { RU: "Критическая смесь", EN: "Critical Mix" },
                    advantages: [
                        { RU: "Шанс критического урона: +424%", EN: "Critical hit chance: +500%" }
                    ],
                    disadvantages: [
                        { RU: "Скорость заморозки: -50%", EN: "Freeze per tick: -50%" }
                    ]
                },
                "https://s.eu.tankionline.com/624/172214/74/266/31770701132467/image.svg": {
                    name: { RU: "Стабилизированная смесь", EN: "Stable Mix" },
                    advantages: [
                        { RU: "Дальность слабого поражения: +50%", EN: "Low damage range: +50%" },
                        { RU: "Дальность полного поражения: +100%", EN: "Full damage range: +100%" },
                        { RU: "Расход энергии: -50%", EN: "Energy consumption: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +50%", EN: "Reload time: +50%" },
                        { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -50%" }
                    ],
                    modifiers: { RANGE: 2.0, RELOAD: 1.5 }
                },
                "https://s.eu.tankionline.com/625/153142/104/314/31770701605344/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/606/113532/200/147/31770701061113/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -29%", EN: "Critical chance: -30%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/626/14777/310/231/31303200003222/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/314/361/31771402217212/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/47/123/31770712527531/image.svg": {
                    name: { RU: "Широкополосные излучатели", EN: "Broadband radiators" },
                    advantages: [
                        { RU: "Угол конуса: +125%", EN: "Cone angle: +125%" }
                    ],
                    disadvantages: [
                        { RU: "Дальность поражения: -30%", EN: "Range: -30%" }
                    ],
                    modifiers: { RANGE: 0.7 }
                },
                "https://s.eu.tankionline.com/605/137574/50/260/31770713363621/image.svg": {
                    name: { RU: "Наноботы поддержки", EN: "Support nanobots" },
                    advantages: [
                        { RU: "Расход энергии в режиме лечения: -50%", EN: "Energy consumption when healing: -50%" },
                        { RU: "Максимальный шанс критического лечения: +100%", EN: "Maximum critical healing chance: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Урон в секунду: -50%", EN: "Regular damage: -50%" }
                    ],
                    modifiers: { DPS: 0.5, DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/317/105/31770712656611/image.svg": {
                    name: { RU: "Реактор наномассы", EN: "Nanomass reactor" },
                    advantages: [
                        { RU: "Восстановление энергии при уничтожении цели: +50%", EN: "Energy recovery on target destruction: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/611/125417/135/371/31770713630221/image.svg": {
                    name: { RU: "Намагничивающие наноботы", EN: "Magnetic Nanobots" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-green'>Electromagnetic Pulse</span> effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/613/123104/313/102/31770714144741/image.svg": {
                    name: { RU: "Оглушающие наноботы", EN: "Stunning Nanobots" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-yellow'>Stun</span> effect",
                            subItems: [
                                { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/614/1145/57/337/31770714065263/image.svg": {
                    name: { RU: "Токсичные наноботы", EN: "Toxic Nanobots" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-purple'>Armor-Piercing</span> effect",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/607/7000/376/240/31770713750042/image.svg": {
                    name: { RU: "Подавляющие наноботы", EN: "Jamming Nanobots" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/321/240/31770714464257/image.svg": {
                    name: { RU: "Вампирские наноботы", EN: "Vampire Nanobots" },
                    advantages: [
                        { RU: "35% наносимого урона добавляется к здоровью", EN: "Recovers HP at a rate of 35% of your base damage per tick while attacking" },
                        { RU: "Перезарядка: -15%", EN: "Energy reload time: -15%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон и лечение: отсутствуют", EN: "Critical hits removed (damage and healing)" },
                        { RU: "Лечение: 1 hp/тик", EN: "Healing rate: -99%" },
                        { RU: "Расход энергии в холостом режиме: +200%", EN: "Energy consumption when idle: +200%" },
                        { RU: "Расход энергии в режиме атаки: +300%", EN: "Energy consumption when attacking: +300%" }
                    ],
                    modifiers: { RELOAD: 0.85, CHARGE_RATE: 0.85, CRIT_DAMAGE: 0, HEALING: 0.01 }
                },
                "https://s.eu.tankionline.com/617/5400/231/261/31770714420753/image.svg": {
                    name: { RU: "Устойчивые наноботы", EN: "Sustainable Nanobots" },
                    advantages: [
                        { RU: "Дальность: +60%", EN: "Range: +60%" },
                        { RU: "Дальность подсветки противника: +50%", EN: "Enemy highlight range: +50%" },
                        { RU: "Расход энергии в режиме лечения: -60%", EN: "Energy consumption when healing: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Угол конуса: -50%", EN: "Cone angle: -60%" },
                        { RU: "Расход энергии в холостом режиме: +100%", EN: "Energy consumption when idle: +100%" },
                        { RU: "Расход энергии в режиме атаки: +100%", EN: "Energy consumption when attacking: +100%" }
                    ],
                    modifiers: { RANGE: 1.6 }
                },
                "https://s.eu.tankionline.com/623/61301/132/106/31770714343142/image.svg": {
                    name: { RU: "Инъекция ударных нанороботов", EN: "Shock Nanobot Injection" },
                    advantages: [
                        { RU: "Лечение накладывает на союзника эффект <span class='text-yellow'>Дополнительного урона</span>", EN: "Increases an ally's damage while healing: +25%" },
                        { RU: "Расход энергии в режиме лечения: -90%", EN: "Energy consumption during healing: -90%" }
                    ],
                    disadvantages: [
                        { RU: "Лечение за тик (hp): -75%", EN: "Normal healing rate: -75%" },
                        { RU: "Критическое лечение (hp): -95%", EN: "Critical healing: -95%" }
                    ],
                    modifiers: { HEALING: 0.25 }
                },
                "https://s.eu.tankionline.com/625/153142/305/125/31770714533144/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "URL_ПУЛЬСАР3": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -29%", EN: "Critical chance: -30%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/626/15001/352/355/31303200421671/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Лечение за тик (hp): +30%", EN: "Healing per tick: +30%" },
                        { RU: "Скорость поворота башни: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота башни: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, HEALING: 1.3, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/105/22/31771402721234/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/142/156/31770747140675/image.svg": {
                    name: { RU: "Минус-поле", EN: "Minus-field" },
                    advantages: [
                        {
                            RU: "Шар рикошетит от стен",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Отсутствует самоурон, если количество рикошетов меньше 10", EN: "An accidental shot towards a wall will no longer deal damage to your tank" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/605/137574/131/63/31770747023171/image.svg": {
                    name: { RU: "Ускоряющий протокол", EN: "Acceleration Protocol" },
                    advantages: [
                        { RU: "Скорость шара: +100%", EN: "Lightning ball speed: +100%" },
                        { RU: "Дальность полёта шара: +100%", EN: "Lightning ball range: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/605/137574/133/315/31770747073110/image.svg": {
                    name: { RU: "Замедляющий протокол", EN: "Dilatory Protocol" },
                    advantages: [
                        { RU: "Скорость шара: 1 м/с", EN: "Lightning ball speed: 1 m/s" }
                    ],
                    disadvantages: [
                        { RU: "Дальность полёта шара: 30 м", EN: "Lightning ball range: -50%" },
                        { RU: "Время перезарядки шаровой молнии: +50%", EN: "Lightning ball reload: +50%" }
                    ]
                },
                "https://s.eu.tankionline.com/605/137574/137/302/31770747222720/image.svg": {
                    name: { RU: "Экзотермическая молния", EN: "Exothermic Lightning" },
                    advantages: [
                        {
                            RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critical hits (+0.40) and ball lightning (+1.00) raise the temperature of enemies and apply the <span class='text-red'>Burning</span> status effect",
                            subItems: [
                                { RU: "Время действия (критический урон): 4 сек", EN: "Duration (critical hit): 4 sec" },
                                { RU: "Время действия (шаровая молния): 10 сек", EN: "Duration (ball lightning): 10 sec" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/136/147/31770747367407/image.svg": {
                    name: { RU: "Эндотермическая молния", EN: "Endothermic Lightning" },
                    advantages: [
                        {
                            RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critical hits and ball lightning lower the temperature (-1.00) and apply the <span class='text-blue'>Freezing</span> status effect",
                            subItems: [
                                { RU: "Время действия (критический урон): 10 сек", EN: "Duration (critical hit): 10 sec" },
                                { RU: "Время действия (шаровая молния): 10 сек", EN: "Duration (ball lightning): 10 sec" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/147/16/31770747303355/image.svg": {
                    name: { RU: "Сверхпроводящий разряд", EN: "Superconducting Discharge" },
                    advantages: [
                        {
                            RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critical hits and ball lightning apply the <span class='text-green'>Electromagnetic Pulse</span> status effect on the enemy",
                            subItems: [
                                { RU: "Время действия (критический урон): 2 сек", EN: "Duration (critical hit): 2 sec" },
                                { RU: "Время действия (шаровая молния): 3 сек", EN: "Duration (ball lightning): 3 sec" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/145/271/31770747575375/image.svg": {
                    name: { RU: "Шоковая молния", EN: "Shocking Lightning" },
                    advantages: [
                        {
                            RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical hits and ball lightning apply the <span class='text-yellow'>Stun</span> status effect on the enemy",
                            subItems: [
                                { RU: "Время действия (критический урон): 1 сек", EN: "Duration (critical hit): 1 sec" },
                                { RU: "Время действия (шаровая молния): 1,5 сек", EN: "Duration (ball lightning): 1.5 sec" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/132/177/31770747524141/image.svg": {
                    name: { RU: "Бронебойный разряд", EN: "Armor-piercing Discharge" },
                    advantages: [
                        {
                            RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critical hits and ball lightning apply the <span class='text-purple'>Armor-Piercing</span> status effect on the enemy",
                            subItems: [
                                { RU: "Время действия (критический урон): 5 сек", EN: "Duration (critical hit): 5 sec" },
                                { RU: "Время действия (шаровая молния): 9 сек", EN: "Duration (ball lightning): 9 sec" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/141/22/31770747462404/image.svg": {
                    name: { RU: "Подавляющий разряд", EN: "Jamming Discharge" },
                    advantages: [
                        {
                            RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк при полноценном контакте",
                            EN: "Hitting an enemy with either chain or ball lightning applies the <span class='text-pink'>Jammer</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        },
                        {
                            RU: "Шаровая молния рикошетит от препятствий",
                            EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                            subItems: [
                                { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Меньшая вероятность нанести сплеш-урон", EN: "Ball lightning does not burst until the 11th impact and so is less likely to cause splash damage" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/144/142/31770750004402/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -27%", EN: "Critical chance: -30%" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Range from one chain lightning to the next ball lightning: 1 m" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153144/76/330/31770750125020/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/137574/135/23/31770747650670/image.svg": {
                    name: { RU: "Электропушка", EN: "Electroturret" },
                    advantages: [
                        { RU: "Скорость шара: 75 м/с", EN: "Lightning ball speed: 75 m/s" },
                        { RU: "Урон шаровой молнии: +25%", EN: "Lightning ball damage: +25%" },
                        { RU: "Перезарядка шаровой молнии: -33%", EN: "Lightning ball reload: -33%" },
                        { RU: "Дальность полёта шара: 1000 метров", EN: "Lightning ball range: 1000 m" }
                    ],
                    disadvantages: [
                        { RU: "Время разогрева шара: +200%", EN: "Lightning ball warmup time: +200%" }
                    ]
                },
                "https://s.eu.tankionline.com/625/104563/334/216/31770750045516/image.svg": {
                    name: { RU: "Шоковая терапия", EN: "Shock therapy" },
                    advantages: [
                        { RU: "Перезарядка цепной молнии: -75%", EN: "Time between two shots: -75%" },
                        { RU: "Урон шаровой молнии: +100%", EN: "Tesla ball lightning damage: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Урон цепной молнии: -30%", EN: "Regular damage: -30%" },
                        { RU: "Критический урон: -22,5%", EN: "Critical damage: -22.5%" },
                        { RU: "Дальность цепной молнии: 10 м", EN: "Shot range: -60%" },
                        { RU: "Дальность подсветки противника: 18 м", EN: "Highlighting distance: -50%" },
                        { RU: "Радиус добавления танка в цепочку: 1 м", EN: "Radius of adding a tank to the chain (m): 1 m" },
                        { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Radius of adding ball lightning to the chain (m): 1 m" }
                    ],
                    modifiers: { RELOAD: 0.25, DPS: 0.7, DAMAGE: 0.7, CRIT_DAMAGE: 0.775, RANGE: 0.4 }
                },
                "https://s.eu.tankionline.com/634/160343/200/134/31770747740717/image.svg": {
                    name: { RU: "Повышенное напряжение", EN: "Increased Voltage" },
                    advantages: [
                        { RU: "Доп. урон за каждую цель: +100%", EN: "Additional damage: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Урон цепной молнии: 0", EN: "Standard damage: -100%" },
                        { RU: "Урон шаровой молнии: -22,5%", EN: "Lightning ball damage: -22.5%" }
                    ],
                    modifiers: { DPS: 0, DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/626/15006/236/134/31303201552544/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон цепной молнии: +25%", EN: "Damage (Chain Lightning): +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/233/226/31771402141070/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/44/105/31770707575060/image.svg": {
                    name: { RU: "Слаггер", EN: "Slugger" },
                    advantages: [
                        { RU: "Минимальная дальность поражения: +50%", EN: "Range of minimum damage: +50%" },
                        { RU: "Предельная дальность поражения: +50%", EN: "Range of maximum damage: +50%" },
                        { RU: "Вертикальный угол разброса: -50%", EN: "Highlighting range: +25%" },
                        { RU: "Горизонтальный угол разброса: -75%", EN: "Vertical scatter angle: -50%" },
                        { RU: "Горизонтальный угол разброса: -75%", EN: "Horizontal scatter angle: -75%" }
                    ],
                    disadvantages: [
                        { RU: "Сила удара: -50%", EN: "Impact force: -50%" }
                    ],
                    modifiers: { RANGE: 1.5, IMPACT_FORCE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/137574/42/305/31770707465744/image.svg": {
                    name: { RU: "Обойма увеличенной ёмкости", EN: "High-capacity ammo clip" },
                    advantages: [
                        { RU: "Зарядов в обойме: 5", EN: "Shots per clip: 5" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки обоймы: +20%", EN: "Clip reload: +20%" }
                    ],
                    modifiers: { RELOAD: 1.2 }
                },
                "https://s.eu.tankionline.com/605/115404/300/13/31770707347404/image.svg": {
                    name: { RU: "Дуплет", EN: "Duplet" },
                    advantages: [
                        { RU: "Время перезарядки между выстрелами: -80%", EN: "Shot reload: -80%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядов в обойме: 2", EN: "Shots per clip: 2" },
                        { RU: "Время перезарядки обоймы: +25%", EN: "Clip reload: +25%" },
                        { RU: "Сила удара одной дробины: -50%", EN: "Impact force: -50%" }
                    ],
                    modifiers: { RELOAD: 1.25, IMPACT_FORCE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/237/42/31770707717716/image.svg": {
                    name: { RU: "Дыхание дракона", EN: "Dragon's Breath" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critically hitting an enemy raises their temperature by +0.4 and applies the <span class='text-red'>Burning</span> status effect.",
                            subItems: [
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/247/161/31770710451552/image.svg": {
                    name: { RU: "Дыхание Виверны", EN: "Wyvern's Breath" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critically hitting an enemy lowers their temperature by -1.00 and applies the <span class='text-blue'>Freezing</span> status effect.",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/242/247/31770710364730/image.svg": {
                    name: { RU: "Магнитная картечь", EN: "Magnetic Pellets" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them.",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/246/64/31770710722173/image.svg": {
                    name: { RU: "Парализующая картечь", EN: "Stunning Pellets" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеские танки",
                            EN: "Critically hitting an enemy will apply the <span class='text-yellow'>Stun</span> status effect to them.",
                            subItems: [
                                { RU: "Время действия: 0,8 сек", EN: "Duration: 0.8 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/234/317/31770710626307/image.svg": {
                    name: { RU: "Бронебойный выстрел", EN: "Armor-Piercing Shot" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them.",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/241/156/31770710533541/image.svg": {
                    name: { RU: "Подавляющий выстрел", EN: "Jamming Shot" },
                    advantages: [
                        {
                            RU: "Попадание каждым патроном в обойме накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them.",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР4": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,8 сек", EN: "<span class='text-yellow'>Stun</span>: 0.8 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 3 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 3 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -10%", EN: "Critical chance: -12%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153142/223/336/31770712366117/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115404/232/163/31770711027560/image.svg": {
                    name: { RU: "Адаптивная перезарядка", EN: "Adaptive reload" },
                    advantages: [
                        { RU: "Уничтожение противника перезаряжает обойму", EN: "Destroying an enemy reloads the clip" },
                        { RU: "Время перезарядки между выстрелами: -20%", EN: "Reload time between shots: -20%" },
                        { RU: "Зарядов в обойме: 4", EN: "Shots per clip: 4" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки обоймы: +20%", EN: "Clip reload time: +20%" }
                    ],
                    modifiers: { RELOAD: 1.2 }
                },
                "https://s.eu.tankionline.com/605/115404/235/362/31770711205363/image.svg": {
                    name: { RU: "Бландербас", EN: "Blunderbuss" },
                    advantages: [
                        { RU: "Урон: +80%", EN: "Damage: +80%" },
                        { RU: "Критический урон: +40%", EN: "Critical damage: +40%" },
                        { RU: "Шанс критического урона: 50%", EN: "Critical chance: 50%" },
                        { RU: "Число дробинок на выстрел: +200%", EN: "Pellets per shot: +100% (40)" },
                        { RU: "Время перезарядки обоймы: -20%", EN: "Clip reload time: -20%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядов в обойме: 1", EN: "Shots per clip: 1" },
                        { RU: "Горизонтальный угол разброса: +100%", EN: "Horizontal Angle of Scatter: +200%" }
                    ],
                    modifiers: { DPS: 1.8, DAMAGE: 1.8, CRIT_DAMAGE: 1.4, RELOAD: 0.8 }
                },
                "https://s.eu.tankionline.com/606/55122/350/216/31770711074200/image.svg": {
                    name: { RU: "Штурмовая кассета", EN: "Assault Magazine" },
                    advantages: [
                        { RU: "Время перезарядки между выстрелами: -75%", EN: "Shot reload: -75%" },
                        { RU: "Время перезарядки обоймы: -25%", EN: "Clip reload: -25%" },
                        { RU: "Отдача: -80%", EN: "Recoil: -80%" }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -46%", EN: "Critical chance: -50%" },
                        { RU: "Сила удара: -80%", EN: "Impact force: -80%" },
                        { RU: "Число дробинок на выстрел: 10", EN: "Pellets per shot = 10" }
                    ],
                    modifiers: { RELOAD: 0.75, IMPACT_FORCE: 0.2 }
                },
                "https://s.eu.tankionline.com/606/55122/166/133/31770711757720/image.svg": {
                    name: { RU: "Крупнокалиберная картечь", EN: "Large Caliber Pellets" },
                    advantages: [
                        { RU: "Урон: +70%", EN: "Damage: +70%" },
                        { RU: "Критический урон: +20%", EN: "Critical damage: +20%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки между выстрелами: +80%", EN: "Shot reload: +80%" },
                        { RU: "Время перезарядки обоймы: +50%", EN: "Clip reload: +50%" }
                    ],
                    modifiers: { DPS: 1.7, DAMAGE: 1.7, CRIT_DAMAGE: 1.2, RELOAD: 1.5 }
                },
                "https://s.eu.tankionline.com/611/150032/152/234/31770711564644/image.svg": {
                    name: { RU: "Тяжёлый Слаггер", EN: "Heavy Slugger" },
                    advantages: [
                        { RU: "Предельная дальность поражения: +100%", EN: "Range of maximum damage: +100%" },
                        { RU: "Дальность полного поражения: +100%", EN: "Range of minimum damage: +100%" },
                        { RU: "Дальность подсветки противника: +100%", EN: "Highlighting range: +100%" },
                        { RU: "Горизонтальный угол разброса: -75%", EN: "Horizontal scatter angle: -75%" },
                        { RU: "Вертикальный угол разброса: -50%", EN: "Vertical scatter angle: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Сила удара: -50%", EN: "Impact force: -50%" },
                        { RU: "Скорость поворота: -35%", EN: "Turret rotation speed: -35%" },
                        { RU: "Ускорение поворота: -35%", EN: "Turret rotary acceleration: -35%" }
                    ],
                    modifiers: { RANGE: 2.0, IMPACT_FORCE: 0.5, TURNING_SPEED: 0.65 }
                },
                "https://s.eu.tankionline.com/613/12172/37/254/31770711673252/image.svg": {
                    name: { RU: "Охотничий дуплет", EN: "Hunter Duplet" },
                    advantages: [
                        { RU: "Горизонтальный угол разброса: -50%", EN: "Horizontal scatter angle: -50%" },
                        { RU: "Время перезарядки между выстрелами: -80%", EN: "Time between the two shots: -80%" },
                        { RU: "Предельная дальность поражения: +100%", EN: "Range of maximum damage: +100%" },
                        { RU: "Дистанция отображения метки прицела: +100%", EN: "Highlighting range: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядов в обойме: 2", EN: "Shots per clip: 2" },
                        { RU: "Время перезарядки обоймы: +15%", EN: "Clip reload: +15%" },
                        { RU: "Сила удара: -50%", EN: "Impact force: -50%" }
                    ],
                    modifiers: { RANGE: 2.0, RELOAD: 1.15, IMPACT_FORCE: 0.5 }
                },
                "https://s.eu.tankionline.com/622/112605/232/247/31770712275125/image.svg": {
                    name: { RU: "Револьвер", EN: "Revolver" },
                    advantages: [
                        { RU: "Зарядов в обойме: 6", EN: "Shots per clip: 6" },
                        { RU: "Каждый третий выстрел имеет критический урон", EN: "Every third shot deals critical damage." },
                        { RU: "Время перезарядки между выстрелами: -5%", EN: "Shot reload: -5%" },
                        { RU: "Максимальный шанс критического выстрела: +100%", EN: "Max critical chance: +100% (RU only)" },
                        { RU: "Прирост шанса критического выстрела: +100%", EN: "Crit chance increase: +100% (RU only)" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки обоймы: +25%", EN: "Clip reload: +25%" },
                        { RU: "Начальный шанс критического выстрела: -100%", EN: "Initial critical chance: -100% (RU only)" },
                        { RU: "Минимальный шанс критического выстрела: -100%", EN: "Min critical chance: -100% (RU only)" }
                    ],
                    modifiers: { RELOAD: 1.25 }
                },
                "https://s.eu.tankionline.com/627/6071/254/247/31770711354417/image.svg": {
                    name: { RU: "Боксёр", EN: "Boxer" },
                    advantages: [
                        { RU: "Время перезарядки обоймы: -56%", EN: "Clip reload: -56%" },
                        { RU: "Сила удара: +40%", EN: "Impact Force: +40%" },
                        { RU: "Число дробинок на выстрел: +50%", EN: "Pellets per shot: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядов в обойме: 1", EN: "Shots per clip: 1" },
                        { RU: "Отдача: +10%", EN: "Recoil +10%" }
                    ],
                    modifiers: { RELOAD: 0.44, IMPACT_FORCE: 1.4 }
                },
                "https://s.eu.tankionline.com/635/105570/100/322/31770712106110/image.svg": {
                    name: { RU: "Игломёт", EN: "Needle Gun" },
                    advantages: [
                        { RU: "Зарядов в обойме: 12", EN: "Magazine size = 12" },
                        { RU: "Перезарядка между выстрелами: -75%", EN: "Time between two shots: -75%" },
                        { RU: "Дальность слабого/предельного/полного поражения: +300%", EN: "Range / Damage degression: +300%" },
                        { RU: "Дальность подсветки противника: +300%", EN: "Enemy highlight range: +300%" },
                        { RU: "Вертикальный и горизонтальный угол разброса: 0°", EN: "Vertical/Horizontal scattering angle: 0°" },
                        { RU: "Отдача: -90%", EN: "No advantage for Recoil in EN" }
                    ],
                    disadvantages: [
                        { RU: "Отдача не указана в минусах", EN: "Recoil -90%" },
                        { RU: "Критический урон: -50%", EN: "Critical damage -50%" },
                        { RU: "Число дробинок: 5", EN: "Pellets per shot = 5" },
                        { RU: "Перезарядка обоймы: +200%", EN: "Reload time +200%" },
                        { RU: "Сила удара: -90%", EN: "Impact force -90%" }
                    ],
                    modifiers: { RANGE: 4.0, CRIT_DAMAGE: 0.5, RELOAD: 3.0, IMPACT_FORCE: 0.1 }
                },
                "https://s.eu.tankionline.com/626/15001/146/305/31303200330516/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/160/220/31771403155551/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/161/215/31770765303354/image.svg": {
                    name: { RU: "Стабилизированная плазма", EN: "Stabilized plasma" },
                    advantages: [
                        { RU: "Сила удара: +20%", EN: "Impact force: +20%" },
                        { RU: "Самоурон: отсутствует", EN: "Self-damage removed" },
                        { RU: "Начальная скорость снаряда: +20%", EN: "Initial projectile speed: +20% (RU only)" }
                    ],
                    disadvantages: [
                        { RU: "Сплеш-урон: отсутствует", EN: "Splash damage removed" }
                    ],
                    modifiers: { IMPACT_FORCE: 1.2 }
                },
                "https://s.eu.tankionline.com/605/137574/160/13/31770764774116/image.svg": {
                    name: { RU: "Ускорители плазмы", EN: "Plasma accelerators" },
                    advantages: [
                        { RU: "Начальная скорость снаряда: +100%", EN: "Initial projectile speed: +100%" },
                        { RU: "Дальность среднего поражения: +50%", EN: "Range of minimum damage: +50%" },
                        { RU: "Дальность полного поражения: +50%", EN: "Range: +50%" },
                        { RU: "Дальность подсветки противника: +50%", EN: "Highlighting distance: +50%" },
                        { RU: "Разгон снарядов увеличен", EN: "Projectile acceleration: +20%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки: +20%", EN: "Reload: +20%" }
                    ],
                    modifiers: { RANGE: 1.5, RELOAD: 1.2 }
                },
                "https://s.eu.tankionline.com/605/115405/162/364/31770764517664/image.svg": {
                    name: { RU: "Тяжёлый плазмомёт", EN: "Heavy Plasmagun" },
                    advantages: [
                        { RU: "Урон: +35%", EN: "Regular damage: +35%" },
                        { RU: "Критический урон: +35%", EN: "Critical damage: +35%" }
                    ],
                    disadvantages: [
                        { RU: "Дальность слабого поражения: -45%", EN: "Range: -45%" },
                        { RU: "Дальность среднего поражения: -45%", EN: "Range of minimum damage: -45%" },
                        { RU: "Дальность подсветки противника: -45%", EN: "Highlighting distance: -45%" },
                        { RU: "Начальная скорость снаряда: -50%", EN: "Initial projectile speed: -50%" }
                    ],
                    modifiers: { DPS: 1.35, DAMAGE: 1.35, CRIT_DAMAGE: 1.35, RANGE: 0.55 }
                },
                "https://s.eu.tankionline.com/605/115405/173/35/31770766062223/image.svg": {
                    name: { RU: "Испепелятор", EN: "Vaporizer" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critical hits increase the target's temperature by +0.4 and ignite the target",
                            subItems: [
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/161/300/31770767066504/image.svg": {
                    name: { RU: "Криотрон", EN: "Cryotron" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critical hits decrease the target's temperature by -1.0 and freeze the target",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/164/34/31770766236506/image.svg": {
                    name: { RU: "Магнетрон", EN: "Magnetron" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critical hits activate the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/575/72435/73/200/31770767460751/image.svg": {
                    name: { RU: "Тектоническая плазма", EN: "Tectonic Plasma" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                            subItems: [
                                { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/167/254/31770767211562/image.svg": {
                    name: { RU: "Плазменный инжектор", EN: "Plasma Injector" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy applies the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/166/171/31770767144522/image.svg": {
                    name: { RU: "Плазменный дизруптор", EN: "Plasma Disruptor" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР5": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 1 sec (EN) / 3 sec (RU)" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -24%", EN: "Critical chance: -25%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153144/214/177/31770771217767/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/170/320/31770770413006/image.svg": {
                    name: { RU: "Турбоускорители плазмы", EN: "Plasma Turbo Accelerators" },
                    advantages: [
                        { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                        { RU: "Время перезарядки: -50%", EN: "Reload: -50%" },
                        { RU: "Сила отдачи: -80%", EN: "Recoil: -80%" },
                        { RU: "Начальная скорость снаряда: +125%", EN: "Initial projectile speed: +125%" },
                        { RU: "Дальность слабого поражения: +100%", EN: "Range (of minimum damage): +100%" },
                        { RU: "Дальность среднего поражения: +100%", EN: "Range of average damage: +100% (RU only)" },
                        { RU: "Дальность подсветки противника: +100%", EN: "Highlighting distance: +100% (RU only)" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -60%", EN: "Regular damage: -60%" },
                        { RU: "Сила удара: -70%", EN: "Impact force: -70%" }
                    ],
                    modifiers: { DPS: 0.4, DAMAGE: 0.4, CRIT_DAMAGE: 1.25, RELOAD: 0.5, RANGE: 2.0, IMPACT_FORCE: 0.3 }
                },
                "https://s.eu.tankionline.com/616/75433/17/170/31770770726027/image.svg": {
                    name: { RU: "Плазмотрон", EN: "Plasmatron" },
                    advantages: [
                        { RU: "Стандартный урон: +250%", EN: "Standard damage: +250%" },
                        { RU: "Начальная скорость снаряда: +50%", EN: "Initial projectile speed: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки: +300%", EN: "Recharge time: +300%" }
                    ],
                    modifiers: { DPS: 3.5, DAMAGE: 3.5, RELOAD: 4.0 }
                },
                "https://s.eu.tankionline.com/546/137515/247/264/31770770773144/image.svg": {
                    name: { RU: "Буря", EN: "Tempest" },
                    advantages: [
                        { RU: "Урон: +35%", EN: "Normal damage: +35%" },
                        { RU: "Критический урон: +125%", EN: "Critical damage: +125%" },
                        { RU: "Шанс критического урона: +91%", EN: "Chance of critical damage: +100%" },
                        { RU: "Сила удара снаряда: +100%", EN: "Impact force: +100%" },
                        { RU: "Конечная скорость снаряда: +1200%", EN: "Target speed: +1200%" }
                    ],
                    disadvantages: [
                        { RU: "Начальная скорость снаряда: -95%", EN: "Initial projectile speed: -95%" },
                        { RU: "Время разгона снаряда: +25%", EN: "Projectile acceleration time: +25%" }
                    ],
                    modifiers: { DPS: 1.35, DAMAGE: 1.35, CRIT_DAMAGE: 2.25, IMPACT_FORCE: 2.0 }
                },
                "https://s.eu.tankionline.com/626/15007/216/65/31303201745262/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/3/3/31771402401736/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/60/51/31770731767017/image.svg": {
                    name: { RU: "Дестабилизированная плазма", EN: "Destabilized plasma" },
                    advantages: [
                        {
                            RU: "Добавлен сплеш-урон",
                            EN: "Splash damage added:",
                            subItems: [
                                { RU: "Радиус полного поражения взрыва: 1 м", EN: "Maximum splash damage radius: 1 m" },
                                { RU: "Радиус среднего поражения взрыва: 7 м", EN: "Average splash damage radius: 2 m (RU: 7 m)" },
                                { RU: "Радиус слабого поражения взрыва: 2 м", EN: "Minimum and critical splash damage radius: 7 m (RU: 2 m)" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" },
                        { RU: "Добавлен самоурон на близком расстоянии", EN: "Self-damage possible at close range" }
                    ]
                },
                "https://s.eu.tankionline.com/605/137574/61/262/31770731621706/image.svg": {
                    name: { RU: "Стабилизация минус-поля", EN: "Minus-field stabilization" },
                    advantages: [
                        { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +100%" },
                        { RU: "Дальность слабого и среднего поражения: +50%", EN: "Range / Range of minimum damage: +50%" },
                        { RU: "Дальность подсветки противника: +50%", EN: "Highlighting distance: +50% (RU only)" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки: +10%", EN: "Shot reload: +10%" }
                    ],
                    modifiers: { RANGE: 1.5, RELOAD: 1.1 }
                },
                "https://s.eu.tankionline.com/605/115405/14/146/31770731702645/image.svg": {
                    name: { RU: "Плазма-факел", EN: "Plasma-torch" },
                    advantages: [
                        { RU: "Время перезарядки: -50%", EN: "Shot reload: -50%" },
                        { RU: "Расход энергии на выстрел: -30%", EN: "Energy consumed per shot: -30%" },
                        { RU: "Отдача: -50%", EN: "Recoil: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Урон и критический урон: -25%", EN: "Regular and critical damage: -25%" },
                        { RU: "Дальность поражения и подсветки: -35%", EN: "Range: -35%" },
                        { RU: "Сила удара снаряда: -50%", EN: "Projectile impact force: -50%" },
                        { RU: "Начальная и конечная скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                        { RU: "Скорость снаряда после рикошета: -50%", EN: "Projectile speed after ricochet: -50%" },
                        { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" }
                    ],
                    modifiers: { RELOAD: 0.5, DPS: 0.75, DAMAGE: 0.75, CRIT_DAMAGE: 0.75, RANGE: 0.65, IMPACT_FORCE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/16/316/31770732051322/image.svg": {
                    name: { RU: "Испепеляющее поле", EN: "Sizzling Field" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Hitting an enemy with a critical shot raises their temperature by +0.5 and applies the <span class='text-red'>Burning</span> effect.",
                            subItems: [
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/5/131/31770732175146/image.svg": {
                    name: { RU: "Криополе", EN: "Cryo field" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Hitting an enemy with a critical shot lowers their temperature by -1 and freezes the target.",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/12/25/31770732120152/image.svg": {
                    name: { RU: "Магнетрон", EN: "Magnetron" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Hitting an enemy with a critical shot will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect.",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/21/37/31770732403450/image.svg": {
                    name: { RU: "Тектоническое поле", EN: "Tectonic field" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Hitting an enemy with a critical shot will apply the <span class='text-yellow'>Stun</span> status effect.",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/17/370/31770732340245/image.svg": {
                    name: { RU: "Сверхумное минус-поле", EN: "Super-smart Minus-Field" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Hitting an enemy with a critical shot may apply the <span class='text-purple'>Armor-Piercing</span> status effect.",
                            subItems: [
                                { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/10/340/31770732255760/image.svg": {
                    name: { RU: "Подавляющее поле", EN: "Jamming field" },
                    advantages: [
                        {
                            RU: "Каждое попадание снарядом накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them.",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР6": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание снарядом накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 3 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 3 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 1 сек", EN: "<span class='text-pink'>Jammer</span>: 1 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -39%", EN: "Critical chance: -40%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153143/105/74/31770733223722/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/4/66/31770732500552/image.svg": {
                    name: { RU: "Берсерк", EN: "Berserk" },
                    advantages: [
                        { RU: "Уничтожение противника восполняет 100% баллона", EN: "Destroying an enemy refills the energy tank immediately" },
                        { RU: "Перезарядка: -30%", EN: "Shot reload: -30%" },
                        { RU: "Скорость заряда баллона: +7%", EN: "Charge rate: +7%" }
                    ],
                    disadvantages: [
                        { RU: "Ускоренный расход энергии", EN: "Runs out of energy faster" }
                    ],
                    modifiers: { RELOAD: 0.7 }
                },
                "https://s.eu.tankionline.com/605/115405/7/261/31770732743374/image.svg": {
                    name: { RU: "Гелиос", EN: "Helios" },
                    advantages: [
                        { RU: "Перезарядка: -80%", EN: "Shot reload: -80%" },
                        { RU: "Расход энергии на выстрел: -15%", EN: "Energy consumed per shot: -15%" },
                        { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +50%" },
                        { RU: "Дальность слабого, среднего поражения и подсветки: +100%", EN: "Range of minimum damage: +100%" },
                        { RU: "Отдача: -80%", EN: "Recoil: -80%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядка баллона: -32%", EN: "Energy recovery rate: -32%" },
                        { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" },
                        { RU: "Сила удара: -80%", EN: "Impact force: -80%" }
                    ],
                    modifiers: { RELOAD: 0.2, RANGE: 2.0, IMPACT_FORCE: 0.2 }
                },
                "https://s.eu.tankionline.com/623/53773/111/315/31770733074352/image.svg": {
                    name: { RU: "Плазменный резонатор", EN: "Plasma Resonator" },
                    advantages: [
                        { RU: "Процент слабого поражения: 300%", EN: "Damage percentage at the range of min. damage: 300%" },
                        { RU: "Дальность полного поражения: 10 м", EN: "Range of max. damage: 10 meters" },
                        { RU: "Дальность слабого поражения: 80 м", EN: "Range of min. damage: 80 meters" }
                    ],
                    disadvantages: [
                        { RU: "Стандартный урон: -30%", EN: "Damage: -30%" },
                        { RU: "Критический урон: отсутствует", EN: "Critical hits removed" }
                    ],
                    modifiers: { DPS: 0.7, DAMAGE: 0.7, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/631/160736/322/206/31770732611417/image.svg": {
                    name: { RU: "Боксёр", EN: "BOXER" },
                    advantages: [
                        { RU: "Шанс критического урона: +23%", EN: "Critical chance: +23%" },
                        { RU: "Перезарядка: -25%", EN: "Reload time: -25%" },
                        { RU: "Зарядка баллона: 3000 усл. ед/с", EN: "Energy reload speed accelerated" },
                        { RU: "Конечная скорость снаряда: 120 м/с", EN: "Final projectile speed: 120 m/s" },
                        { RU: "Сила удара: +120%", EN: "Impact force: +120%" }
                    ],
                    disadvantages: [
                        { RU: "Начальная скорость снаряда: 30 м/с", EN: "Initial projectile speed = 30 m/s" },
                        { RU: "Время ускорения снаряда: 1,5 сек", EN: "Projectile acceleration time = 1.5 s" },
                        { RU: "Запаса энергии хватит только на один выстрел", EN: "One shot at a time" }
                    ],
                    modifiers: { RELOAD: 0.75, IMPACT_FORCE: 2.2 }
                },
                "https://s.eu.tankionline.com/626/15003/334/245/31303201007577/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/207/363/31771403230017/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/164/322/31770773077325/image.svg": {
                    name: { RU: "Регулятор скорости стрельбы", EN: "Shooting Speed Regulator" },
                    advantages: [
                        { RU: "Урон: +50%", EN: "Regular damage: +50%" },
                        { RU: "Шанс критического урона: +49%", EN: "Critical chance: +50%" },
                        { RU: "Время раскрутки стволов: -50%", EN: "Barrel startup time: -50%" },
                        { RU: "Время остановки стволов: -50%", EN: "Barrel slowdown time: -50%" },
                        { RU: "Время до перегрева: +50%", EN: "Time to overheating: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +50%", EN: "Bullet reload: +50%" }
                    ],
                    modifiers: { DPS: 1.5, DAMAGE: 1.5, RELOAD: 1.5 }
                },
                "https://s.eu.tankionline.com/605/137574/163/164/31770773003115/image.svg": {
                    name: { RU: "Усиленные приводы наводки", EN: "Reinforced aiming transmission" },
                    advantages: [
                        { RU: "Скорость поворота: +50%", EN: "Turret rotation speed: +50%" },
                        { RU: "Ускорение поворота: +50%", EN: "Turret rotary acceleration: +50%" },
                        { RU: "Коэффициент скорости поворота башни при стрельбе: +50%", EN: "Coefficient of turret rotation slowdown while shooting: -50% (optimized)" }
                    ],
                    disadvantages: [
                        { RU: "Автоприцел угол вверх: -80%", EN: "Upward auto-aim: -80%" }
                    ],
                    modifiers: { TURNING_SPEED: 1.5 }
                },
                "https://s.eu.tankionline.com/605/115405/212/113/31771403422474/image.svg": {
                    name: { RU: "Зажигательная лента", EN: "Incendiary band" },
                    advantages: [
                        {
                            RU: "Попадание при перегреве накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Each bullet that hits an enemy while your own tank is under the <span class='text-red'>Burning</span> status effect increases their temperature",
                            subItems: [
                                { RU: "Прирост температуры за попадание: +0.07", EN: "Temperature increase per hit: +0.07" },
                                { RU: "Время действия: 0,7 сек", EN: "Duration: 0.7 sec" }
                            ]
                        },
                        { RU: "Время до перегрева: -75%", EN: "Time to overheat: -75%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                        { RU: "Ограничение на температуру: 1", EN: "Temperature limit: 1" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/617/163556/127/124/31770773202461/image.svg": {
                    name: { RU: "Замораживающая лента", EN: "Freezing Band" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critical damage imposes <span class='text-blue'>Freezing</span> status effect on an enemy tank",
                            subItems: [
                                { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/615/75332/4/347/31770773144012/image.svg": {
                    name: { RU: "Магнитная лента", EN: "Magnetic Band" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/616/75405/214/251/31770773747123/image.svg": {
                    name: { RU: "Оглушающая лента", EN: "Stunning Band" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical damage imposes Status Effect <span class='text-yellow'>Stun</span> on an enemy tank",
                            subItems: [
                                { RU: "Время действия: 0,4 сек", EN: "Critical stun: 0.4 sec" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/613/12170/376/100/31770773661430/image.svg": {
                    name: { RU: "Бронебойная лента", EN: "Armor-Piercing Band" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-purple'>Armor-Piercing</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/606/55123/317/310/31770773424402/image.svg": {
                    name: { RU: "Подавляющая лента", EN: "Jamming Band" },
                    advantages: [
                        {
                            RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting the enemy activates the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР7": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -40%", EN: "Critical chance: -40%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153144/264/41/31770774323205/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/214/246/31770774222751/image.svg": {
                    name: { RU: "Прорезиненные снаряды", EN: "Rubberized Rounds" },
                    advantages: [
                        { RU: "Максимальное число рикошетов: +4 (всего 5)", EN: "Maximum number of projectile bounces: 5" },
                        { RU: "Минимальный угол рикошета: 1°", EN: "Minimum ricochet angle: 1°" },
                        { RU: "Критический урон: +50%", EN: "Critical damage: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.5 }
                },
                "https://s.eu.tankionline.com/613/61333/55/135/31770774265545/image.svg": {
                    name: { RU: "Шреддер", EN: "Shredder" },
                    advantages: [
                        { RU: "Урон: +13%", EN: "Damage: +13%" },
                        { RU: "Перезарядка: -35%", EN: "Reload: -35%" },
                        { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +50%" },
                        { RU: "Дальность полного и слабого поражения: +50%", EN: "Min. and max. damage range: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Время раскрутки стволов: +900%", EN: "Barrel startup time: +900%" },
                        { RU: "Время остановки стволов: +50%", EN: "Barrel slowdown time: +50%" },
                        { RU: "Башня не может вращаться во время стрельбы", EN: "Turret slowdown when firing = 100%" }
                    ],
                    modifiers: { DPS: 1.13, DAMAGE: 1.13, RELOAD: 0.65, RANGE: 1.5 }
                },
                "https://s.eu.tankionline.com/613/62100/344/43/31770774063200/image.svg": {
                    name: { RU: "Разрывная лента", EN: "Explosive Band" },
                    advantages: [
                        { RU: "Урон: +10%", EN: "Damage: +10%" },
                        { RU: "Максимальный угол рикошета: 45°", EN: "Minimum ricochet angle: 45°" },
                        {
                            RU: "Добавлен сплеш-урон:",
                            EN: "Splash damage added:",
                            subItems: [
                                { RU: "Радиус максимального сплеш-урона (2м): 100%", EN: "Damage at 2m: 100%" },
                                { RU: "Радиус промежуточного поражения (4м): 50%", EN: "Damage at 4m: 50%" },
                                { RU: "Радиус минимального поражения (6м): 50%", EN: "Damage at 6m (outer radius): 50%" },
                                { RU: "Критический урон на 4м: 100%", EN: "Critical damage at 4m: 100%" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.1, DAMAGE: 1.1 }
                },
                "https://s.eu.tankionline.com/620/116140/342/103/31770774122744/image.svg": {
                    name: { RU: "Крупный калибр", EN: "Large Caliber" },
                    advantages: [
                        { RU: "Урон: +140%", EN: "Damage: +140%" },
                        { RU: "Время раскрутки и остановки стволов: -20%", EN: "Barrel startup/slowdown time: -20%" },
                        { RU: "Сила удара: +300%", EN: "Impact force: +300%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +100%", EN: "Reload: +100%" },
                        { RU: "Отдача: +100%", EN: "Recoil: +100%" },
                        { RU: "Скорость поворота: -50%", EN: "Rotation speed: -50%" },
                        { RU: "Ускорение поворота: -50%", EN: "Rotation acceleration: -50%" }
                    ],
                    modifiers: { DPS: 2.4, DAMAGE: 2.4, IMPACT_FORCE: 4.0, RELOAD: 2.0, TURNING_SPEED: 0.5 }
                },
                "https://s.eu.tankionline.com/626/15010/4/6/31303202037143/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +30%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DPS: 1.3, DAMAGE: 1.3, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/54/102/31771402570343/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/125/317/31770741145711/image.svg": {
                    name: { RU: "Штурмовые снаряды", EN: "Assault rounds" },
                    advantages: [
                        { RU: "Сила удара: +35%", EN: "Impact force: +35%" },
                        { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Initial and final projectile speed: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: отсутствует", EN: "Critical hits disabled" }
                    ],
                    modifiers: { IMPACT_FORCE: 1.35, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/605/137574/127/144/31770741213466/image.svg": {
                    name: { RU: "Система высокоточного прицеливания", EN: "High-precision aiming system" },
                    advantages: [
                        { RU: "Урон: +27%", EN: "Regular damage: +27%" },
                        { RU: "Критический урон: +29%", EN: "Critical damage: +29%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки: +64%", EN: "Reload time: +64%" },
                        { RU: "Начальная и конечная скорость снаряда: -30%", EN: "Projectile speed: -30%" }
                    ],
                    modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.64 }
                },
                "https://s.eu.tankionline.com/605/115405/72/161/31770741274422/image.svg": {
                    name: { RU: "Суперкумулятивные снаряды", EN: "Supercumulative rounds" },
                    advantages: [
                        { RU: "Критический урон: +35%", EN: "Critical damage: +35%" }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -57%", EN: "Critical chance step: -60%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.35 }
                },
                "https://s.eu.tankionline.com/605/115405/63/66/31770741343376/image.svg": {
                    name: { RU: "Зажигательные снаряды", EN: "Incendiary rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critical hits raise the target's temperature by +0.40 and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/57/305/31770741454377/image.svg": {
                    name: { RU: "Криоснаряды", EN: "Cryo rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critical hits lower the target's temperature by -1.00 and apply <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/60/355/31770741407663/image.svg": {
                    name: { RU: "EMP-снаряды", EN: "EMP Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/64/140/31770741670645/image.svg": {
                    name: { RU: "Парализующие снаряды", EN: "Paralyzing Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/65/227/31770741615650/image.svg": {
                    name: { RU: "Бронебойные снаряды", EN: "Armor-Piercing Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115537/140/243/31770741550412/image.svg": {
                    name: { RU: "Подавляющие снаряды", EN: "Jamming Rounds" },
                    advantages: [
                        {
                            RU: "Каждое попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР8": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 2 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 2 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 2 сек", EN: "<span class='text-pink'>Jammer</span>: 2 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -42%", EN: "Critical chance: -45%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153143/312/335/31770742374535/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/56/233/31770741742137/image.svg": {
                    name: { RU: "Автопушка", EN: "Autocannon" },
                    advantages: [
                        { RU: "Время перезарядки: -55%", EN: "Reload: -55%" },
                        { RU: "Отдача: -25%", EN: "Recoil: -25%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -35%", EN: "Regular damage: -35%" },
                        { RU: "Сила удара: -66%", EN: "Impact force: -66%" },
                        { RU: "Автоприцел угол по горизонтали: ±0,6°", EN: "Horizontal auto-aim angle: ±0.6°" }
                    ],
                    modifiers: { RELOAD: 0.45, DAMAGE: 0.65, IMPACT_FORCE: 0.34 }
                },
                "https://s.eu.tankionline.com/605/115405/67/356/31770742204030/image.svg": {
                    name: { RU: "Прорезиненные снаряды", EN: "Rubberized Rounds" },
                    advantages: [
                        { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                        { RU: "Максимальное число рикошетов: 3", EN: "Maximum number of projectile bounces: 3" },
                        { RU: "Минимальный угол рикошета: 5°", EN: "Minimum ricochet angle: 5°" },
                        { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial/Final projectile speed: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.5 }
                },
                "https://s.eu.tankionline.com/605/115405/62/23/31770742023352/image.svg": {
                    name: { RU: "Разрывные снаряды", EN: "Explosive Rounds" },
                    advantages: [
                        { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                        {
                            RU: "Добавлен сплеш-урон:",
                            EN: "Splash damage added:",
                            subItems: [
                                { RU: "Радиус максимального поражения: 3 м (100%)", EN: "Damage at 3m: 100%" },
                                { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Damage at 6m: 50%" },
                                { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Damage at 9m (outer radius): 50%" },
                                { RU: "Радиус взрыва критического урона: 3 м", EN: "Critical damage explosion radius: 3 m" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Добавлен самоурон на близком расстоянии", EN: "Self damage at close range" },
                        { RU: "Рикошет снарядов отключён", EN: "Rounds do not ricochet" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115405/71/50/31770742270265/image.svg": {
                    name: { RU: "Упорядоченная боеукладка", EN: "Sorted Ammunition" },
                    advantages: [
                        { RU: "Каждое четвёртое попадание гарантированно критическое", EN: "Every fourth hit is guaranteed to be a critical" },
                        { RU: "Первый выстрел после спавна будет критическим", EN: "The first shot after spawning will be a critical" },
                        { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" }
                    ],
                    disadvantages: [
                        { RU: "Стартовый шанс критического выстрела: -200%", EN: "Initial critical chance penalty (RU specific)" }
                    ],
                    modifiers: { RELOAD: 0.9 }
                },
                "https://s.eu.tankionline.com/617/163647/140/233/31770742075111/image.svg": {
                    name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed Rounds" },
                    advantages: [
                        { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial/Final projectile speed: +100%" },
                        { RU: "Процент слабого поражения в конце дегрессии: 300%", EN: "Damage percentage at the end of the degression: 300%" },
                        { RU: "Дальность подсветки противника: +100%", EN: "Range of enemy highlighting +100%" }
                    ],
                    disadvantages: [
                        { RU: "Нормальный урон: -50%", EN: "Normal damage: -50%" },
                        { RU: "Критический урон: отсутствует", EN: "Critical hits disabled" },
                        { RU: "Автоприцел угол по горизонтали: ±0,4°", EN: "Horizontal auto-aim angle: ±0.4°" }
                    ],
                    modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/626/15005/127/361/31303201332146/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/73/237/31771402636052/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115405/100/152/31770745176156/image.svg": {
                    name: { RU: "Дистанционный подрыв ракет", EN: "Remote rocket explosives" },
                    advantages: [
                        { RU: "Бесконтактный дистанционный подрыв (двойное нажатие)", EN: "Rockets will explode upon double-pressing fire button" },
                        { RU: "Мин. скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" }
                    ],
                    disadvantages: [
                        { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" },
                        { RU: "Возможность самоурона при неосторожности", EN: "Possibility of self-damage if not careful" },
                        { RU: "Угол автоприцела по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/77/36/31770743054711/image.svg": {
                    name: { RU: "Пусковая установка «Охотник»", EN: "Missile launcher «Hunter»" },
                    advantages: [
                        { RU: "Время наведения: -75%", EN: "Aiming time: -75%" },
                        { RU: "Время перезарядки после залпа: -40%", EN: "Salvo reload time: -40%" }
                    ],
                    disadvantages: [
                        { RU: "Ракет в залпе: 1", EN: "Rockets per salvo: 1" },
                        { RU: "Время удержания наведения: -30%", EN: "Aiming recovery time: -30%" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/75/361/31770742767604/image.svg": {
                    name: { RU: "Пусковая установка «Циклон»", EN: "Missile launcher «Cyclone»" },
                    advantages: [
                        { RU: "Ракет в залпе: 8", EN: "Rockets per salvo: 8" },
                        { RU: "Пауза между ракетами в залпе: -40% (0,15 с)", EN: "Pause between salvo's rockets: -40%" },
                        { RU: "Время удержания цели в наведении: +50%", EN: "Aiming recovery time: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Время наведения: +20%", EN: "Aiming time: +20%" }
                    ]
                },
                "https://s.eu.tankionline.com/612/150610/365/312/31770745325311/image.svg": {
                    name: { RU: "Поджигающие боеголовки", EN: "Incendiary Missiles" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critical hits raise the temperature of all damaged enemy tanks and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Прирост температуры: +0.4", EN: "Temperature increase: +0.4" },
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/620/156734/156/340/31770745442552/image.svg": {
                    name: { RU: "Крио боеголовки", EN: "Cryo Missiles" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critical hits lower the temperature of all damaged enemy tanks and apply <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Снижение температуры: 1", EN: "Temperature reduction: 1" },
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/612/127056/213/323/31770745375216/image.svg": {
                    name: { RU: "Магнитные боеголовки", EN: "Magnetic Missiles" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/101/222/31770745654021/image.svg": {
                    name: { RU: "Обездвиживающие боеголовки", EN: "Stunning Missiles" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-yellow'>Stun</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/74/316/31770745577212/image.svg": {
                    name: { RU: "Бронебойная боеголовка", EN: "Armor-Piercing Missiles" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                            subItems: [
                                { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/622/20176/45/174/31770745506225/image.svg": {
                    name: { RU: "Подавляющие боеголовки", EN: "Jamming Missiles" },
                    advantages: [
                        {
                            RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Critically hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them",
                            subItems: [
                                { RU: "Время действия (обычный урон): 2 сек", EN: "Duration (normal): 2 sec (EN: 5 sec)" },
                                { RU: "Время действия (критический урон): 5 сек", EN: "Duration (critical): 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/147224/331/326/31770746373364/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 3 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 3 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 9 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" },
                                { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                        { RU: "Шанс критического урона: -8%", EN: "Critical chance: -9%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153144/23/215/31770746676445/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/102/310/31770746521303/image.svg": {
                    name: { RU: "Пусковая установка «Уран»", EN: "Missile launcher «Uranium»" },
                    advantages: [
                        { RU: "Урон: +125%", EN: "Damage: +125%" },
                        { RU: "Критический урон: +160%", EN: "Critical damage: +160%" },
                        { RU: "Время наведения: -30%", EN: "Aiming time: -30%" },
                        { RU: "Макс. скорость ракеты: 350 м/с", EN: "Maximum projectile speed: 350 m/s" },
                        { RU: "Радиус взрыва ракеты: +50%", EN: "Minimum splash damage radius: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Время ускорения снаряда: +700%", EN: "Projectile acceleration time: +700%" },
                        { RU: "Пауза между ракетами в залпе: +400%", EN: "Pause between salvo's rockets: +400%" },
                        { RU: "Время перезарядки: +12%", EN: "Single-shot reload time: +12%" }
                    ],
                    modifiers: { DAMAGE: 2.25, CRIT_DAMAGE: 2.6, RELOAD: 1.12 }
                },
                "https://s.eu.tankionline.com/605/147222/345/214/31770746451665/image.svg": {
                    name: { RU: "Пусковая установка «Тандем»", EN: "Missile launcher «Tandem»" },
                    advantages: [
                        { RU: "Шанс критического урона: +20%", EN: "Critical hit chance: +25%" },
                        { RU: "Перезарядка ракет: -12%", EN: "Reload time: -12%" },
                        { RU: "Пауза между ракетами в залпе: -100%", EN: "Pause between salvo's rockets: -100%" },
                        { RU: "Наведение: -75%", EN: "Aiming time: -75%" },
                        { RU: "Угловая скорость ракеты: +25%", EN: "Rocket angular velocity: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Ракет в залпе: 2", EN: "Rockets per salvo: 2" },
                        { RU: "Перезарядка после залпа: +35%", EN: "Recharge time after salvo: +35%" }
                    ],
                    modifiers: { RELOAD: 0.88 }
                },
                "https://s.eu.tankionline.com/610/176122/121/70/31770746104146/image.svg": {
                    name: { RU: "Пусковая установка «Гидра»", EN: "Missile launcher «Hydra»" },
                    advantages: [
                        { RU: "Ракет в залпе: 20", EN: "Rockets per salvo = 20" },
                        { RU: "Сила удара: +50%", EN: "Impact force increased" },
                        { RU: "Наведение: -50%", EN: "Aiming time: -50%" },
                        { RU: "Перезарядка: -40%", EN: "Single-shot reload time: -40%" },
                        { RU: "Пауза между ракетами в залпе: -20%", EN: "Pause between salvo's rockets: -20%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -40%", EN: "Normal and critical damage: -40%" },
                        { RU: "Критический урон: -50%", EN: "Critical damage decrease" },
                        { RU: "Перезарядка после залпа: +80%", EN: "Recharge time after salvo: +80%" },
                        { RU: "Угловая скорость ракеты: 3°/сек", EN: "Rockets angular velocity = 3°/sec" }
                    ],
                    modifiers: { DAMAGE: 0.6, CRIT_DAMAGE: 0.5, RELOAD: 0.4, IMPACT_FORCE: 1.5 }
                },
                "https://s.eu.tankionline.com/612/127056/353/361/31770746031351/image.svg": {
                    name: { RU: "Пусковая установка «Фауст»", EN: "Missile launcher «Faust»" },
                    advantages: [
                        { RU: "Перезарядка: -50%", EN: "Reload time: -50%" },
                        { RU: "Наведение: -50%", EN: "Aiming time: -50%" },
                        { RU: "Пауза между ракетами в залпе: -50%", EN: "Pause between salvo's rockets: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Дальность: 40 м", EN: "Range = 40m" },
                        { RU: "Перезарядка после залпа: +100%", EN: "Reload after salvo: +100%" }
                    ],
                    modifiers: { RELOAD: 0.5 }
                },
                "https://s.eu.tankionline.com/614/76403/251/210/31770746577776/image.svg": {
                    name: { RU: "Вакуумные боеголовки", EN: "Vacuum Missiles" },
                    advantages: [
                        { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                        { RU: "Бесконтактный дистанционный подрыв", EN: "Rockets will explode upon double-pressing fire button" },
                        { RU: "Мин. скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" },
                        {
                            RU: "Параметры сплеш-урона:",
                            EN: "Average and minimal splash damage:",
                            subItems: [
                                { RU: "Радиус промежуточного поражения: 5 м", EN: "Average splash damage" },
                                { RU: "Предельный радиус поражения: 8 м", EN: "Minimal splash damage" },
                                { RU: "Процент промежуточного/слабого поражения: ~230-235%", EN: "Percentage: 235%" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Урон: -30%", EN: "Damage: -30%" },
                        { RU: "Перезарядка: +6%", EN: "Pause between salvo rockets: +6%" },
                        { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" }
                    ],
                    modifiers: { DAMAGE: 0.7, CRIT_DAMAGE: 1.25, RELOAD: 1.06 }
                },
                "https://s.eu.tankionline.com/615/6647/254/11/31770746305363/image.svg": {
                    name: { RU: "Пусковая установка «Метеор»", EN: "Missile Launcher «Meteor»" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Сила удара: +50%", EN: "Impact force: +50%" },
                        { RU: "Мин. скорость ракеты: 90 м/с", EN: "Minimum rocket speed = 90 m/s" },
                        { RU: "Макс. скорость ракеты: 350 м/с", EN: "Maximum speed" },
                        { RU: "Пауза между ракетами в залпе: 0,05 сек", EN: "Pause between rockets in salvo = 50 ms" }
                    ],
                    disadvantages: [
                        {
                            RU: "Радиусы взрыва (сплеш сильно уменьшен): 1,5 м",
                            EN: "Splash radius = 1m",
                            subItems: [
                                { RU: "Радиус полного/промежуточного/предельного/критического поражения: 1,5 м", EN: "All radius values: 1.5m" }
                            ]
                        }
                    ],
                    modifiers: { DAMAGE: 1.25, IMPACT_FORCE: 1.5 }
                },
                "https://s.eu.tankionline.com/626/66003/354/107/31770746163342/image.svg": {
                    name: { RU: "Пусковая установка «Кастет»", EN: "Missile Launcher «Brass Knuckles»" },
                    advantages: [
                        { RU: "Бесконтактный дистанционный подрыв", EN: "Rockets will explode upon double-pressing fire button" },
                        { RU: "Перезарядка ракет: -12%", EN: "Reload time: -12%" },
                        { RU: "Наведение: -62%", EN: "Aiming time: -62%" },
                        { RU: "Пауза между ракетами в залпе: -20%", EN: "Pause between salvo's rockets: -20%" },
                        { RU: "Начальная скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" },
                        { RU: "Максимальный шанс крит. урона: 100%", EN: "Maximum chance of critical hit = 100%" }
                    ],
                    disadvantages: [
                        { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" },
                        { RU: "Перезарядка после залпа: +111%", EN: "Reload time after salvo: +111%" }
                    ],
                    modifiers: { RELOAD: 0.88 }
                },
                "https://s.eu.tankionline.com/626/15006/46/161/31303201457152/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/123/31/31771402775040/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/151/362/31770750272437/image.svg": {
                    name: { RU: "Автомат заряжания малого калибра", EN: "Small caliber charging machine" },
                    advantages: [
                        { RU: "Время перезарядки: -20%", EN: "Reload time: -20%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -30%", EN: "Regular damage: -30%" }
                    ],
                    modifiers: { RELOAD: 0.8, DAMAGE: 0.7 }
                },
                "https://s.eu.tankionline.com/605/137574/150/212/31770750223672/image.svg": {
                    name: { RU: "Подкалиберные снаряды", EN: "Subcaliber rounds" },
                    advantages: [
                        { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" },
                        { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Projectile speed: +100%" },
                        { RU: "Сила удара: +25%", EN: "Impact force: +25%" },
                        { RU: "Скорость стрельбы: +100%", EN: "Firing speed: +100%" },
                        { RU: "Самоурон отсутствует", EN: "Self damage removed" }
                    ],
                    disadvantages: [
                        { RU: "Сплеш-урон отсутствует", EN: "Splash damage removed" }
                    ],
                    modifiers: { RELOAD: 0.9, IMPACT_FORCE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115405/141/126/31770750343375/image.svg": {
                    name: { RU: "Снаряды «Кувалда»", EN: "«Sledgehammer» rounds" },
                    advantages: [
                        { RU: "Урон: +35%", EN: "Regular damage: +35%" }
                    ],
                    disadvantages: [
                        { RU: "Дальность слабого поражения: -60%", EN: "Range of minimum damage: -60%" },
                        { RU: "Дальность полного поражения: -60%", EN: "Range of maximum damage: -60%" },
                        { RU: "Скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                        { RU: "Критический урон отключен", EN: "Critical hits disabled" },
                        { RU: "Начальная скорость: -50", EN: "Launch speed -50" }
                    ],
                    modifiers: { DAMAGE: 1.35, RANGE: 0.4, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/605/115405/144/333/31770750567612/image.svg": {
                    name: { RU: "Снаряды «Виверна»", EN: "«Wyvern» shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на все цели в радиусе 12 метров",
                            EN: "Critical hits lower the temperature of all enemy tanks in a 12 meter radius and apply <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Снижение температуры: -1.00", EN: "Temperature reduction: -1.00" },
                                { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/140/45/31770750417461/image.svg": {
                    name: { RU: "Снаряды «Саламандра»", EN: "«Salamander» shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на все цели в радиусе 12 метров",
                            EN: "Critical hits raise the temperature of all enemy tanks in a 12 meter radius and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Прирост температуры: +0.40", EN: "Temperature increase: +0.40" },
                                { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/132/42/31770750500676/image.svg": {
                    name: { RU: "Снаряды «Магнето»", EN: "«Magneto» shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на все цели в радиусе 12 метров",
                            EN: "Critical hits apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to all enemies in a 12 meter radius",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" },
                                { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/135/271/31770750754561/image.svg": {
                    name: { RU: "Снаряды «Миротворец»", EN: "«Peacekeeper» shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на все цели в радиусе 12 метров",
                            EN: "Critical hits apply the <span class='text-yellow'>Stun</span> status effect to all enemies in a 12 meter radius",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" },
                                { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/126/246/31770750676002/image.svg": {
                    name: { RU: "Снаряды «Коррозия»", EN: "«Corrosion» shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на все цели в радиусе 12 метров",
                            EN: "Critical hits apply the <span class='text-purple'>Armor-Piercing</span> status effect to all enemies in a 12 meter radius",
                            subItems: [
                                { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" },
                                { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/134/201/31770750633625/image.svg": {
                    name: { RU: "Снаряды «Шум»", EN: "«Noise» shells" },
                    advantages: [
                        {
                            RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на цель и все цели в радиусе 12 метров",
                            EN: "Hitting an enemy tank applies the <span class='text-pink'>Jammer</span> status effect to them and all enemies in a 12 meter radius",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/142/164/31770751432372/image.svg": {
                    name: { RU: "Строгая погрузка боеприпасов", EN: "Strict Ammunition Load" },
                    advantages: [
                        { RU: "Каждое третье попадание гарантированно критическое", EN: "Every third hit is guaranteed to be a critical" },
                        { RU: "Первый выстрел после спавна будет критическим", EN: "The first shot after spawning will be a critical" },
                        { RU: "Время перезарядки: -20%", EN: "Reload time: -20%" },
                        { RU: "Критический урон: +25%", EN: "Critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { RELOAD: 0.8, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115405/127/312/31770751230522/image.svg": {
                    name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed shells" },
                    advantages: [
                        { RU: "Начальная скорость запуска: +100%", EN: "Launch speed +100%" },
                        { RU: "Скорость цели: +100%", EN: "Target velocity +100%" },
                        { RU: "Процент дегрессии урона в конце: 300%", EN: "Damage percentage at the end of the degression = 300%" },
                        { RU: "Дальность подсветки противника: +100%", EN: "Range of enemy highlighting +100%" }
                    ],
                    disadvantages: [
                        { RU: "Нормальный урон: -50%", EN: "Regular damage: -50%" },
                        { RU: "Критический урон отключен", EN: "Critical hits removed" },
                        { RU: "Автоприцел угол по горизонтали: ±0.2°", EN: "Horizontal auto-aim angle: ±0.2°" }
                    ],
                    modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/605/115405/143/251/31770751505446/image.svg": {
                    name: { RU: "Вакуумный снаряд", EN: "Vacuum shells" },
                    advantages: [
                        { RU: "Радиус сплеш-урона: 12 м", EN: "Splash damage radius: 12 m" },
                        { RU: "Радиус среднего сплеш-урона: 9 м", EN: "Radius of average splash damage: 9 m" },
                        { RU: "Средний и минимальный сплеш-урон: 250%", EN: "Average and minimal splash damage: 250%" },
                        { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -15%", EN: "Damage: -15%" }
                    ],
                    modifiers: { DAMAGE: 0.85 }
                },
                "https://s.eu.tankionline.com/605/115405/121/362/31770751023605/image.svg": {
                    name: { RU: "Адаптивная перезарядка", EN: "Adaptive reload" },
                    advantages: [
                        { RU: "Сокращение перезарядки при нанесении урона врагу: 33%", EN: "Reload reduction per enemy damaged: 33%" }
                    ],
                    disadvantages: [
                        { RU: "Базовое время перезарядки: +15%", EN: "Base reload time: +15%" },
                        { RU: "Радиус сплеш-урона: -25%", EN: "Splash damage radius: -25%" }
                    ],
                    modifiers: { RELOAD: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/133/111/31770751305066/image.svg": {
                    name: { RU: "Снаряды «Нанотек»", EN: "«Nanotech» shells" },
                    advantages: [
                        { RU: "Стрельба по союзникам лечит их на количество урона по небронированной цели", EN: "Shooting a teammate heals them the same amount it would damage an unarmored enemy" },
                        { RU: "Лечение приносит очки репутации и опыта (от 1 до 20)", EN: "Healing gives reputation and experience points" },
                        { RU: "Лечение не зависит от дальности", EN: "Healing is not affected by range" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -20%", EN: "Damage: -20%" },
                        { RU: "Сила удара отключена", EN: "Impact force disabled" },
                        { RU: "Критический урон отключен", EN: "Critical hits removed" },
                        { RU: "Сплеш-урон не лечит союзников", EN: "Splash damage does not heal allied tanks" },
                        { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
                    ],
                    modifiers: { DAMAGE: 0.8, IMPACT_FORCE: 0, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/605/115405/124/105/31770751064115/image.svg": {
                    name: { RU: "Снаряды «Наковальня»", EN: "«Anvil» shells" },
                    advantages: [
                        { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" },
                        { RU: "Урон: +35%", EN: "Regular damage: +35%" },
                        { RU: "Критический урон: +30%", EN: "Critical damage: +30%" },
                        { RU: "Радиус критического сплеша: 12 м", EN: "Critical splash radius: 12m" }
                    ],
                    disadvantages: [
                        { RU: "Максимальная дальность поражения: -50%", EN: "Range of maximum damage: -50%" },
                        { RU: "Минимальная дальность поражения: -25%", EN: "Range of minimum damage: -25%" }
                    ],
                    modifiers: { RELOAD: 0.9, DAMAGE: 1.35, CRIT_DAMAGE: 1.3, RANGE: 0.5 }
                },
                "https://s.eu.tankionline.com/623/154746/364/11/31770751146513/image.svg": {
                    name: { RU: "Болтер", EN: "Bolter" },
                    advantages: [
                        { RU: "Максимальная скорость снаряда: 700 м/с", EN: "Max shell speed: 700 m/s" },
                        { RU: "Длительность фазы ускорения: 2.5 с", EN: "Shell acceleration phase duration: 2.5s" },
                        { RU: "Время перезарядки: -45%", EN: "Reload time: -45%" },
                        { RU: "Сила удара: +25%", EN: "Impact force: +25%" },
                        { RU: "Сила удара сплеша: +25%", EN: "Splash damage impact force: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Минимальная скорость снаряда: 10 м/с", EN: "Min shell speed: 10 m/s" },
                        { RU: "Сила отдачи: +15%", EN: "Recoil force: +15%" }
                    ],
                    modifiers: { RELOAD: 0.55, IMPACT_FORCE: 1.25 }
                },
                "https://s.eu.tankionline.com/634/24211/5/226/31770751547170/image.svg": {
                    name: { RU: "Ямато", EN: "Yamato" },
                    advantages: [
                        { RU: "Урон: +60%", EN: "Damage: +60%" },
                        { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                        { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial and final projectile speed: +100%" },
                        { RU: "Минимальный радиус сплеша: +50%", EN: "Minimum splash damage radius: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +80%", EN: "Reload: +80%" },
                        { RU: "Скорость поворота: -25%", EN: "Rotation speed: -25%" },
                        { RU: "Ускорение поворота: -25%", EN: "Rotation acceleration: -25%" }
                    ],
                    modifiers: { DAMAGE: 1.6, CRIT_DAMAGE: 1.5, RELOAD: 1.8, TURNING_SPEED: 0.75 }
                },
                "https://s.eu.tankionline.com/605/115405/136/373/31770751355652/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс крита: -12%", EN: "Critical chance: -12%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153144/145/41/31770751703724/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/626/15007/17/150/31303201645022/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/634/112236/325/324/31771403052177/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/634/112242/333/350/31770755431040/image.svg": {
                    name: { RU: "Ручной режим стрельбы", EN: "Manual Firing Mode" },
                    advantages: [
                        { RU: "Время перезарядки: -25%", EN: "Reload time -25%" }
                    ],
                    disadvantages: [
                        { RU: "Число зарядов: 1", EN: "Magazine size = 1" },
                        { RU: "Доп. урон: отсутствует", EN: "Additional combo damage: 0" }
                    ],
                    modifiers: { RELOAD: 0.75 }
                },
                "https://s.eu.tankionline.com/634/112242/54/34/31770755346510/image.svg": {
                    name: { RU: "Разрывные снаряды", EN: "Explosive Shells" },
                    advantages: [
                        {
                            RU: "Добавлен сплеш-урон:",
                            EN: "Explosive Shells standard shots can deal damage to multiple targets:",
                            subItems: [
                                { RU: "Радиус полного поражения: 3 м (100%)", EN: "Radius of maximum area damage = 3 m" },
                                { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Radius of the average area of damage = 6 m" },
                                { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Radius of minimum area damage = 9 m" },
                                { RU: "Радиус критического сплеша: 3 м", EN: "Radius of critical area damage = 3 m" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Рикошет снарядов отключён", EN: "Projectiles can no longer ricochet" },
                        { RU: "Добавлен самоурон на близком расстоянии", EN: "The blast radius damage can cause self-damage" }
                    ]
                },
                "https://s.eu.tankionline.com/634/112244/77/41/31770755531642/image.svg": {
                    name: { RU: "Снаряды с вольфрамовым сердечником", EN: "Tungsten Shells" },
                    advantages: [
                        { RU: "Максимальное число рикошетов: 2", EN: "Maximum number of ricochets = 2" },
                        { RU: "Минимальный угол рикошета: 5°", EN: "Min ricochet angle: 5°" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/634/112242/156/41/31770755601436/image.svg": {
                    name: { RU: "Снаряды «Жара»", EN: "\"Heat\" Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critically hit enemies are heated up by +0.4 and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Прирост температуры: +0.4", EN: "Temperature increase: +0.4" },
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112242/222/234/31770756111100/image.svg": {
                    name: { RU: "Снаряды «Крио»", EN: "\"Cryo\" Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Critically hit enemies are frozen by -1.0 and apply <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Снижение температуры: -1.0", EN: "Temperature reduction: -1.0" },
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112243/103/56/31770756613244/image.svg": {
                    name: { RU: "Снаряды «Сверло»", EN: "\"Drill\" Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                            EN: "For critically hit enemies, the <span class='text-purple'>Armor-Piercing</span> status effect is activated",
                            subItems: [
                                { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112243/341/120/31770756707226/image.svg": {
                    name: { RU: "Снаряды «Шок»", EN: "\"Shock\" Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                            EN: "When enemies are hit critically, the <span class='text-yellow'>Stun</span> status effect is activated",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical Hit Chance +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112241/213/12/31770755656427/image.svg": {
                    name: { RU: "Снаряды «Молния»", EN: "\"Lightning\" Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                            EN: "When enemies are hit critically, the <span class='text-green'>EMP</span> status effect is activated",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical Hit Chance +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112244/3/272/31770756343255/image.svg": {
                    name: { RU: "Снаряды «Шум»", EN: "\"Noise\" Shells" },
                    advantages: [
                        {
                            RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Applies the <span class='text-pink'>Jammer</span> status effect to hit enemies",
                            subItems: [
                                { RU: "Время действия: 4,5 сек", EN: "Duration: 4.5 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/634/112243/205/350/31770762402270/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 4,5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -27%", EN: "Critical chance: -8%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/634/112237/40/362/31770757017104/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/634/112241/153/137/31770761101650/image.svg": {
                    name: { RU: "Режим стрельбы «Дуплет»", EN: "Duplet" },
                    advantages: [
                        { RU: "Время между двумя выстрелами: -92%", EN: "Time between two shots: -92%" },
                        { RU: "Отдача: -50%", EN: "Recoil: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Доп. урон: 0", EN: "Additional combo damage: 0" },
                        { RU: "Перезарядка: +15%", EN: "Reload time: +15%" },
                        { RU: "Сила удара снаряда: -25%", EN: "Impact force: -25%" }
                    ],
                    modifiers: { RELOAD: 1.15, IMPACT_FORCE: 0.75 }
                },
                "https://s.eu.tankionline.com/634/112243/16/24/31770761737654/image.svg": {
                    name: { RU: "Мегацунами", EN: "Megatsunami" },
                    advantages: [
                        { RU: "Урон: +100%", EN: "Damage +100%" },
                        { RU: "Доп. урон: +100%", EN: "Additional combo damage = +100%" },
                        { RU: "Критический урон: +25%", EN: "Critical damage +25%" },
                        {
                            RU: "Параметры сплеш-урона:",
                            EN: "Area damage parameters:",
                            subItems: [
                                { RU: "Радиус полного поражения: 3 м", EN: "Radius of max. area damage = 3 m" },
                                { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Radius of the avg. area of damage = 6 m" },
                                { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Radius of min. area damage = 9 m" },
                                { RU: "Радиус критического сплеша: 3 м", EN: "Radius of critical area damage = 3 m" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +50%", EN: "Reload time +50%" },
                        { RU: "Время между двумя выстрелами: +50%", EN: "Time between two shots +50%" },
                        { RU: "Рикошет снарядов отключён", EN: "Shots do not ricochet." },
                        { RU: "Добавлен самоурон от сплеша", EN: "Area damage can cause self-damage" }
                    ],
                    modifiers: { DAMAGE: 2.0, CRIT_DAMAGE: 1.25, RELOAD: 1.5 }
                },
                "URL_РЕЖИМ_ТРИПЛЕТ": {
                    name: { RU: "Режим стрельбы «Триплет»", EN: "Triplet Firing Mode" },
                    advantages: [
                        { RU: "Число зарядов в магазине: 3", EN: "Magazine size: 3" },
                        { RU: "Время между двумя выстрелами: -60%", EN: "Time between two shots: -60%" },
                        { RU: "Отдача: -25%", EN: "Recoil: -25%" }
                    ],
                    disadvantages: [
                        { RU: "Доп. урон: 0", EN: "Additional combo damage: 0" },
                        { RU: "Перезарядка: +25%", EN: "Reload time: +25%" }
                    ],
                    modifiers: { RELOAD: 1.25 }
                },
                "https://s.eu.tankionline.com/634/112241/340/366/31622455332636/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Дополнительный урон: +30%", EN: "Additional combo damage increase" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/22/130/31771402454100/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115405/27/5/31770734615030/image.svg": {
                    name: { RU: "Разрывные снаряды", EN: "Explosive Shells" },
                    advantages: [
                        {
                            RU: "Добавлен сплеш-урон:",
                            EN: "Splash damage is added:",
                            subItems: [
                                { RU: "Минимальный радиус сплеша в аркадном режиме: 10 м", EN: "Arcade minimum splash damage radius: 10 m" },
                                { RU: "Средний радиус сплеша в аркадном режиме: 2 м", EN: "Arcade average splash damage radius: 2 m" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                        { RU: "Рикошет снарядов отключён", EN: "Ricochet effect disabled" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/30/57/31770734702442/image.svg": {
                    name: { RU: "Разрывные боеголовки", EN: "Explosive warheads" },
                    advantages: [
                        {
                            RU: "Увеличен радиус взрыва ракет:",
                            EN: "Explosion radius significantly increases:",
                            subItems: [
                                { RU: "Минимальный радиус сплеша ракет: 10 м", EN: "Rocket minimum splash damage radius: 10 m" },
                                { RU: "Средний радиус сплеша ракет: 3 м", EN: "Rocket average splash damage radius: 3 m" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/37/105/31770734762213/image.svg": {
                    name: { RU: "Пусковая установка «Стая»", EN: "Missile launcher «Wolfpack»" },
                    advantages: [
                        { RU: "Максимальная скорость ракет: 50 м/с", EN: "Maximum rocket speed: = 50 m/s" },
                        { RU: "Минимальная скорость ракеты: 20 м/с", EN: "Minimum rocket speed = 20 m/s" }
                    ],
                    disadvantages: [
                        { RU: "Пауза между ракетами в залпе: +20%", EN: "Pause between salvo's rockets: +20%" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/24/252/31770735224121/image.svg": {
                    name: { RU: "Замораживающие снаряды", EN: "Cryo Shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-blue'>Заморозка</span>",
                            EN: "Critical hits and rocket hits in a 5 meter splash radius lower the temperature and apply <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" },
                                { RU: "Радиус сплеша крит. урона: 5 м", EN: "Splash radius: 5 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/31/122/31770735046605/image.svg": {
                    name: { RU: "Поджигающие снаряды", EN: "Incendiary shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-red'>Горение</span>",
                            EN: "Critical hits and rocket hits in a 5 meter splash radius raise the temperature and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Длительность (залп): 9 тиков", EN: "Salvo: 9 ticks of burn" },
                                { RU: "Длительность (аркада / ракета): 5 тиков", EN: "Arcade / single rocket: 5 ticks" },
                                { RU: "Радиус сплеша: 5 м", EN: "Splash radius: 5 m" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/25/341/31770735113661/image.svg": {
                    name: { RU: "EMP-снаряды", EN: "EMP shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                            EN: "Critical hits and rocket hits apply <span class='text-green'>Electromagnetic Pulse</span>",
                            subItems: [
                                { RU: "Время действия (критический урон): 2 сек", EN: "Critical hits: 2 seconds" },
                                { RU: "Время действия (ракеты): 1 сек", EN: "Rocket hits (5m radius): 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/41/227/31770735453757/image.svg": {
                    name: { RU: "Стан-снаряды", EN: "Stun shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                            EN: "Critical hits and rocket hits apply <span class='text-yellow'>Stun</span>",
                            subItems: [
                                { RU: "Время действия (критический урон): 1,5 сек", EN: "Critical hits: 1.5 seconds" },
                                { RU: "Время действия (ракеты): 0,4 сек", EN: "Rocket hits (5m radius): 0.4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/23/205/31770735364602/image.svg": {
                    name: { RU: "Бронебойные снаряды", EN: "Armor-piercing shells" },
                    advantages: [
                        {
                            RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                            EN: "Critical hits and rocket hits apply <span class='text-purple'>Armor-Piercing</span>",
                            subItems: [
                                { RU: "Время действия (критический урон): 10 сек", EN: "Critical hits: 10 seconds" },
                                { RU: "Время действия (ракеты): 1 сек", EN: "Rocket hits: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/32/201/31770735321653/image.svg": {
                    name: { RU: "Подавляющие снаряды", EN: "Jamming Shells" },
                    advantages: [
                        {
                            RU: "Попадания накладывают статус-эффект <span class='text-pink'>Подавление</span>",
                            EN: "Normal/critical and rocket hits apply <span class='text-pink'>Jammer</span>",
                            subItems: [
                                { RU: "Время действия (обычный/критический урон): 5 сек", EN: "Normal and critical hits: 5 seconds" },
                                { RU: "Время действия (ракеты, радиус 5 м): 1 сек", EN: "Rocket hits in a 5 meter radius: 1 second" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР9": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 10 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153143/163/245/31770736115621/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/36/26/31770735645262/image.svg": {
                    name: { RU: "Пусковая установка «Торнадо»", EN: "Missile launcher «Tornado»" },
                    advantages: [
                        { RU: "Ракет в залпе: 20", EN: "Rockets in salvo: +10" },
                        { RU: "Перезарядка залпа: -12%", EN: "Salvo reload time: -12%" },
                        { RU: "Пауза между ракетами в залпе: -30%", EN: "Pause between salvo's rockets: -30%" },
                        { RU: "Начальная скорость ракеты: 70 м/с", EN: "Initial rocket speed = 70 m/s" },
                        { RU: "Время восстановления наведения: +30%", EN: "Aiming recovery time: +30%" },
                        { RU: "Радиус сплеша ракет (промежуточный/предельный): 5 м / 10 м", EN: "Rocket min/avg splash radius: 10m / 5m" },
                        { RU: "Конечная угловая скорость ракеты: 17 °/с", EN: "Final rocket angular speed = 17 °/s" }
                    ],
                    disadvantages: [
                        { RU: "Время наведения: +50%", EN: "Aiming time: +50%" },
                        { RU: "Начальная угловая скорость ракеты: 80 °/с", EN: "Initial rocket angular speed = 80 °/s" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/34/350/31770735575570/image.svg": {
                    name: { RU: "Пусковая установка «Рой»", EN: "Missile launcher «Swarm»" },
                    advantages: [
                        { RU: "Ракет в залпе: 20", EN: "Rockets per salvo: +10" },
                        { RU: "Время наведения: -50%", EN: "Aiming time: -50%" },
                        { RU: "Перезарядка залпа: -50%", EN: "Salvo reload time: -50%" },
                        { RU: "Пауза между ракетами в залпе: -30%", EN: "Pause between salvo's rockets: -30%" },
                        { RU: "Максимальная угловая скорость ракеты: +400%", EN: "Final rocket angular speed: +400%" }
                    ],
                    disadvantages: [
                        { RU: "Максимальная скорость ракеты: -20%", EN: "Final rocket speed: -20%" },
                        { RU: "Начальная угловая скорость ракеты: -10%", EN: "Initial rocket angular speed: -10%" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/42/324/31770736001344/image.svg": {
                    name: { RU: "Урановые снаряды", EN: "Uranium Shells" },
                    advantages: [
                        { RU: "Максимальное число рикошетов: 3", EN: "Max ricochet count: 3" },
                        { RU: "Минимальный угол рикошета: 5°", EN: "Shell minimum ricochet angle: 5°" },
                        { RU: "Радиус полного поражения: 12 м", EN: "Minimum area damage radius in normal mode = 12 meters" },
                        { RU: "Радиус среднего поражения: 2 м", EN: "Radius of mean area damage in normal mode = 2 meters" },
                        { RU: "Максимальный шанс крита: 100%", EN: "Maximum Critical Damage Chance = 100%" },
                        { RU: "Начальный шанс крита: 100%", EN: "Initial Critical Damage Chance = 100%" },
                        { RU: "Прирост шанса крита: +100%", EN: "Critical Damage Chance Increase: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Стартовый шанс критического урона: -100%", EN: "Minimum Critical Damage Chance: -100%" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115405/33/271/31770735527104/image.svg": {
                    name: { RU: "Пусковая установка «Копьё»", EN: "Missile launcher «Spear»" },
                    advantages: [
                        { RU: "Перезарядка залпа: -20%", EN: "Salvo reload time: -20%" },
                        { RU: "Время наведения: -50%", EN: "Aiming time: -50%" },
                        { RU: "Минимальная скорость ракеты: 45 м/с", EN: "Initial rocket speed: 45 m/s" },
                        { RU: "Максимальная скорость ракеты: 30 м/с", EN: "Maximum rocket speed: 30 m/s" },
                        { RU: "Конечная угловая скорость ракеты: 120 °/с", EN: "Initial rocket max. angular velocity: 120 °/s" },
                        { RU: "Длительность фазы ускорения ракеты: -50%", EN: "Rocket acceleration phase duration: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Ракет в залпе: 6", EN: "Rockets in salvo: -4" },
                        { RU: "Пауза между ракетами в залпе: +30%", EN: "Pause between salvo's rockets: +30%" },
                        { RU: "Время ускорения ракеты: -50%", EN: "Projectile acceleration time: -50%" },
                        { RU: "Начальная угловая скорость ракеты: 30 °/с", EN: "Initial rocket min. angular velocity: 30 °/s" }
                    ]
                },
                "https://s.eu.tankionline.com/634/63466/6/312/31770736053513/image.svg": {
                    name: { RU: "Вакуумный снаряд", EN: "Vacuum shell" },
                    advantages: [
                        { RU: "Радиус сплеш-урона: 12 м", EN: "Splash damage radius: 12 meters" },
                        { RU: "Средний радиус сплеш-урона: 9 м", EN: "Average Splash damage radius: 9 meters" },
                        { RU: "Средний и минимальный сплеш-урон: 250%", EN: "Average and minimum splash damage: 250%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -15%", EN: "Damage: -15%" }
                    ],
                    modifiers: { DAMAGE: 0.85 }
                },
                "https://s.eu.tankionline.com/626/15004/132/112/31303201111474/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Скорость ускорения поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/322/317/31771402271740/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/115404/332/363/31770724151741/image.svg": {
                    name: { RU: "Усиленный лафет", EN: "Reinforced gun carriage" },
                    advantages: [
                        { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                        { RU: "Гравитация для снаряда: -50%", EN: "Elevation mechanism adjustment" }
                    ],
                    disadvantages: [
                        { RU: "Горизонтальный поворот башни только поворотом корпуса", EN: "Horizontal rotation only by turning the hull" }
                    ]
                },
                "https://s.eu.tankionline.com/605/115404/325/44/31770723761303/image.svg": {
                    name: { RU: "Автоматизированный механизм загрузки пороха", EN: "Automated gunpowder loading mechanism" },
                    advantages: [
                        { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                        { RU: "Время усиления: -15%", EN: "Amplification time: -15%" }
                    ],
                    disadvantages: [
                        { RU: "Сложнее избежать перелёта или недолёта снаряда", EN: "Harder to avoid overshooting or undershooting" }
                    ]
                },
                "https://s.eu.tankionline.com/546/137515/231/276/31770724065077/image.svg": {
                    name: { RU: "Гарпун", EN: "Harpoon" },
                    advantages: [
                        { RU: "Фиксированный угол ствола: 1°", EN: "Turret elevation: 1º" },
                        { RU: "Гравитация для снаряда: 1", EN: "Projectile gravitation: 1" },
                        { RU: "Время усиления: -70%", EN: "Amplification time: -70%" },
                        { RU: "Число шагов набора заряда: 10", EN: "Number of steps when charging = 10" },
                        { RU: "Мин. и макс. скорость снаряда: +100% / +50%", EN: "Minimum/Maximum projectile speed increase" },
                        { RU: "Сила удара снаряда и взрыва: +50%", EN: "Impact force: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки: +10%", EN: "Reload time: +10%" },
                        { RU: "Критический урон наносится только при прямом попадании", EN: "Critical damage applies only on direct hits" },
                        { RU: "Радиус сплеша и крит. урона: -60%", EN: "Splash and critical damage radiuses: -60%" },
                        { RU: "Отдача: +50%", EN: "Recoil increase" }
                    ],
                    modifiers: { RELOAD: 1.1 }
                },
                "https://s.eu.tankionline.com/605/115404/330/255/31770724262074/image.svg": {
                    name: { RU: "Поджигающий сердечник", EN: "Incendiary core" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеские танки в радиусе 10 метров",
                            EN: "Critical hits (10m radius from explosion) raise the temperature of all damaged enemy tanks and apply <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" },
                                { RU: "Прирост температуры: +1", EN: "Temperature increase: +1" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/326/126/31770724441303/image.svg": {
                    name: { RU: "Криоснаряды", EN: "Freezing Core" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеские танки в радиусе 10 метров",
                            EN: "Critical hits apply the <span class='text-blue'>Freezing</span> status effect to all enemies within a 10 meter radius",
                            subItems: [
                                { RU: "Время действия: 8-10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/611/44450/377/277/31770724362673/image.svg": {
                    name: { RU: "Магнитный сердечник", EN: "Magnetic core" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеские танки в радиусе 10 метров",
                            EN: "Critical hits (10m radius from explosion) apply the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/616/4250/5/63/31770724665043/image.svg": {
                    name: { RU: "Оглушающий сердечник", EN: "Stunning Core" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеские танки в радиусе 10 метров",
                            EN: "Critical hits (10m radius from explosion) apply the <span class='text-yellow'>Stun</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/324/1/31770724616150/image.svg": {
                    name: { RU: "Бронебойный сердечник", EN: "Armor-Piercing Core" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеские танки в радиусе 10 метров",
                            EN: "On a critical hit, applies the <span class='text-purple'>Armor-Piercing</span> status effect",
                            subItems: [
                                { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/613/123105/147/37/31770724520004/image.svg": {
                    name: { RU: "Подавляющий сердечник", EN: "Jamming Core" },
                    advantages: [
                        {
                            RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеские танки в радиусе 10 метров",
                            EN: "Applies the <span class='text-pink'>Jammer</span> status effect to all enemies within a 10 meter radius",
                            subItems: [
                                { RU: "Время действия (обычный выстрел): 6 сек", EN: "Normal hit duration: 6 seconds" },
                                { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit duration: 10 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР10": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 12 сек", EN: "<span class='text-pink'>Jammer</span>: 12 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 3 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 3 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 9 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153142/357/251/31770725375555/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115404/331/327/31770725211757/image.svg": {
                    name: { RU: "Миномёт", EN: "Mortar" },
                    advantages: [
                        { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                        { RU: "Установка мин в точке промаха (время жизни 120 сек)", EN: "Lay mines when a tank is not hit (mine lifetime 120 seconds)" }
                    ],
                    disadvantages: [
                        { RU: "Радиус критического урона: -50%", EN: "Critical splash damage radius: -50%" }
                    ]
                },
                "https://s.eu.tankionline.com/612/41746/164/263/31770725324705/image.svg": {
                    name: { RU: "Вакуумный сердечник", EN: "Vacuum core" },
                    advantages: [
                        { RU: "Радиус среднего сплеша: 15 м", EN: "Radius of average splash damage: 15 m" },
                        { RU: "Средний сплеш-урон: 250%", EN: "Average splash damage: 250%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -45%", EN: "Damage: -45%" }
                    ],
                    modifiers: { DAMAGE: 0.55 }
                },
                "https://s.eu.tankionline.com/621/133301/74/107/31770724767107/image.svg": {
                    name: { RU: "Бомбарда", EN: "Bombard" },
                    advantages: [
                        { RU: "Перезарядка: -45%", EN: "Reload time: -45%" },
                        { RU: "Время усиления: -50%", EN: "Time to maximum charge level: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Минимальный и начальный угол ствола: 45°", EN: "Minimum angle of elevation: 45°" },
                        { RU: "Мин. и макс. скорость снаряда: -40%", EN: "Max/Min projectile speed: -40%" },
                        { RU: "Гравитация для снаряда: +50%", EN: "Projectile gravity: +50%" }
                    ],
                    modifiers: { RELOAD: 0.55 }
                },
                "https://s.eu.tankionline.com/622/165764/376/133/31770725136276/image.svg": {
                    name: { RU: "Разрушитель", EN: "Destroyer" },
                    advantages: [
                        { RU: "Угол ствола фиксированный: 6°", EN: "Initial Turret Angle: 6" },
                        { RU: "Урон: +120%", EN: "Damage: +120%" },
                        { RU: "Критический урон: +150%", EN: "Critical Hit Damage: +150%" },
                        { RU: "Сила удара снаряда и взрыва: +33%", EN: "Impact Force / Splash Damage Impact: +33%" },
                        { RU: "Время усиления: -70%", EN: "Weapon Charging Time: -70%" },
                        { RU: "Гравитация для снаряда: -50%", EN: "Shell Gravity Coefficient: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Скорость и ускорение поворота башни: -50%", EN: "Turret Rotation Speed/Acceleration: -50%" },
                        { RU: "Мин. и макс. скорость снаряда: -30% / -50%", EN: "Minimum/Maximum Shell Speed reduction" },
                        { RU: "Перезарядка: +90%", EN: "Weapon Reload Time: +90%" },
                        { RU: "Отдача: +33%", EN: "Recoil force: +33%" },
                        { RU: "Радиус сплеша: -55%", EN: "Splash Damage Radius: -55%" }
                    ],
                    modifiers: { DAMAGE: 2.2, CRIT_DAMAGE: 2.5, RELOAD: 1.9, TURNING_SPEED: 0.5 }
                },
                "https://s.eu.tankionline.com/633/20351/64/220/31770725101242/image.svg": {
                    name: { RU: "Карронада", EN: "Carronade" },
                    advantages: [
                        { RU: "Перезарядка: -60%", EN: "Reload time: -60%" },
                        { RU: "Время усиления: -60%", EN: "Time to maximum charge level: -60%" },
                        { RU: "Отдача: -30%", EN: "Recoil: -30%" },
                        { RU: "Скорость и ускорение поворота башни: +33%", EN: "Rotation speed/acceleration: +33%" },
                        { RU: "Минимальная скорость снаряда: +50%", EN: "Minimum projectile speed: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -35%", EN: "Damage: -35%" },
                        { RU: "Максимальная скорость снаряда: -9% (100 м/с)", EN: "Maximum projectile speed: -9%" }
                    ],
                    modifiers: { RELOAD: 0.4, DAMAGE: 0.65, TURNING_SPEED: 1.33 }
                },
                "https://s.eu.tankionline.com/626/15002/341/363/31303200612111/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/363/257/31771402336676/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/56/244/31770727266522/image.svg": {
                    name: { RU: "Стабилизация снаряда", EN: "Round stabilization" },
                    advantages: [
                        { RU: "Процент урона после прострела: 100%", EN: "Penetration: 100%" },
                        { RU: "Урон от расстояния не снижается", EN: "Damage is not distance-dependent" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -5%", EN: "Regular damage: -5%" },
                        { RU: "Критический урон: -24%", EN: "Critical damage: -24%" }
                    ],
                    modifiers: { DAMAGE: 0.95, CRIT_DAMAGE: 0.76 }
                },
                "https://s.eu.tankionline.com/605/137574/53/256/31770727132303/image.svg": {
                    name: { RU: "Усиленные приводы наводки", EN: "Reinforced aiming transmission" },
                    advantages: [
                        { RU: "Скорость поворота башни: +50%", EN: "Turret rotation speed: +50%" },
                        { RU: "Ускорение поворота башни: +50%", EN: "Turret rotatory acceleration: +50%" },
                        { RU: "Автоприцел угол вверх и вниз: +50%", EN: "Vertical auto-aim: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { TURNING_SPEED: 1.5 }
                },
                "https://s.eu.tankionline.com/605/115404/377/146/31770727203236/image.svg": {
                    name: { RU: "Электромагнитный ускоритель «Скаут»", EN: "Electromagnetic accelerator «Scout»" },
                    advantages: [
                        { RU: "Перезарядка: -15%", EN: "Reload time: -15%" },
                        { RU: "Разогрев выстрела: -15%", EN: "Shot warmup time: -15%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -15%", EN: "Regular damage: -15%" },
                        { RU: "Критический урон: -15%", EN: "Critical damage: -15%" }
                    ],
                    modifiers: { RELOAD: 0.85, DAMAGE: 0.85, CRIT_DAMAGE: 0.85 }
                },
                "https://s.eu.tankionline.com/605/115404/364/322/31770727472472/image.svg": {
                    name: { RU: "Криоснаряды", EN: "Cryo Rounds" },
                    advantages: [
                        {
                            RU: "Попадание обычным и критическим выстрелом накладывает статус-эффект <span class='text-blue'>Заморозка</span>",
                            EN: "Hitting an enemy lowers their temperature and applies <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Время действия (обычный выстрел): 4 сек", EN: "Normal hit: -0.40 temperature" },
                                { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit: -1.00 temperature" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/373/360/31770727352052/image.svg": {
                    name: { RU: "Поджигающие снаряды", EN: "Incendiary Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critically hitting an enemy raises temperature by +0.40 and applies <span class='text-red'>Burning</span> (max 2 tanks)",
                            subItems: [
                                { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/367/60/31770727420710/image.svg": {
                    name: { RU: "ЭМИ-снаряды", EN: "EMP Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                            EN: "Critically hitting an enemy applies the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/1/317/31770727676401/image.svg": {
                    name: { RU: "Оглушающие снаряды", EN: "Stun Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span>",
                            EN: "Critically hitting an enemy applies the <span class='text-yellow'>Stun</span> status effect",
                            subItems: [
                                { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/375/32/31770727623103/image.svg": {
                    name: { RU: "Суперпробивающие снаряды", EN: "Super Armor-Piercing Rounds" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> (работает при простреле нескольких целей)",
                            EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to all pierced targets",
                            subItems: [
                                { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115537/27/314/31770727553130/image.svg": {
                    name: { RU: "Подавляющие снаряды", EN: "Jamming Shells" },
                    advantages: [
                        {
                            RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span>",
                            EN: "Hitting an enemy applies the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР11": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153143/35/151/31770730545515/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/137574/55/32/31770730155004/image.svg": {
                    name: { RU: "Крупнокалиберные снаряды", EN: "Large caliber rounds" },
                    advantages: [
                        { RU: "Урон: +50%", EN: "Regular damage: +50%" },
                        { RU: "Критический урон: +20%", EN: "Critical damage: +20%" },
                        { RU: "Шанс критического урона: +37%", EN: "Critical Hit Chance: +50% (RU: +37%)" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +16%", EN: "Reload time: +16%" },
                        { RU: "Разогрев выстрела: +15%", EN: "Shot warmup time: +15%" }
                    ],
                    modifiers: { DAMAGE: 1.5, CRIT_DAMAGE: 1.2, RELOAD: 1.16 }
                },
                "https://s.eu.tankionline.com/605/115404/376/102/31770730423373/image.svg": {
                    name: { RU: "Дестабилизация снаряда", EN: "Round destabilization" },
                    advantages: [
                        { RU: "Критический урон: +20%", EN: "Critical damage: +20%" },
                        { RU: "Шанс критического урона: 50%", EN: "Fixed critical chance: 50%" },
                        { RU: "Сила удара: +60%", EN: "Impact force: +60%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -25%", EN: "Regular damage: -25%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 1.2, IMPACT_FORCE: 1.6, DAMAGE: 0.75 }
                },
                "https://s.eu.tankionline.com/605/115404/366/0/31770727757202/image.svg": {
                    name: { RU: "Компульсатор «Вестник смерти»", EN: "«Death Herald» compulsator" },
                    advantages: [
                        { RU: "Уничтожение противника мгновенно перезаряжает пушку", EN: "Destroying an enemy fully reloads the turret" },
                        { RU: "Перезарядка: -40%", EN: "Reload time: -40%" },
                        { RU: "Разогрев выстрела: -25%", EN: "Shot warmup time: -25%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { RELOAD: 0.6 }
                },
                "https://s.eu.tankionline.com/605/115404/372/302/31770730224632/image.svg": {
                    name: { RU: "Гиперпространственные снаряды", EN: "Hyperspace rounds" },
                    advantages: [
                        { RU: "Процент урона после прострела: +200%", EN: "Penetration: +200%" },
                        { RU: "Разогрев выстрела: -25%", EN: "Shot warmup time: -25%" }
                    ],
                    disadvantages: [
                        { RU: "Сила удара: -100%", EN: "Impact force removed" },
                        { RU: "Критический урон отключен", EN: "Critical hits disabled" }
                    ],
                    modifiers: { IMPACT_FORCE: 0, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/606/25171/245/307/31770730303124/image.svg": {
                    name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed shells" },
                    advantages: [
                        { RU: "Процент слабого поражения: 300%", EN: "Weak damage: 300%" },
                        { RU: "Дальность слабого поражения: -60%", EN: "Range of minimum damage: -60%" },
                        { RU: "Дальность полного поражения: -70%", EN: "Range of maximum damage: -70%" },
                        { RU: "Дальность подсветки противника: +100%", EN: "Highlighting range: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Урон: -50%", EN: "Regular damage: -50%" }
                    ],
                    modifiers: { DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/614/1144/200/261/31770730464352/image.svg": {
                    name: { RU: "Снаряды «Дробовик»", EN: "«Shotgun» rounds" },
                    advantages: [
                        { RU: "Урон: +50%", EN: "Normal damage: +50%" },
                        { RU: "Перезарядка: -10%", EN: "Reload time: -10%" }
                    ],
                    disadvantages: [
                        { RU: "Дальность полного поражения: -80%", EN: "Range of maximum damage: -80%" },
                        { RU: "Дальность слабого поражения: -50%", EN: "Range of minimum damage: -50%" },
                        { RU: "Процент слабого поражения: 25%", EN: "Weak damage = 25%" }
                    ],
                    modifiers: { DAMAGE: 1.5, RELOAD: 0.9 }
                },
                "https://s.eu.tankionline.com/627/142531/56/121/31770730077111/image.svg": {
                    name: { RU: "Снаряды «Экскалибур»", EN: "Excalibur rounds" },
                    advantages: [
                        { RU: "Критический урон: +129.9%", EN: "Critical damage: +129.9%" },
                        { RU: "Максимальный шанс критического выстрела: 99%", EN: "Maximum chance of critical damage: 99%" },
                        { RU: "Прирост шанса критического выстрела: +45%", EN: "Increased chance of critical damage: +45%" },
                        { RU: "Минимальный шанс критического выстрела: 5%", EN: "Minimum chance of critical damage: 5%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка: +17%", EN: "Reload time: +17%" },
                        { RU: "Разогрев выстрела: +25%", EN: "Shot warmup time: +25%" },
                        { RU: "Начальный шанс критического выстрела: 5%", EN: "Initial chance of critical damage: 5%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 2.3, RELOAD: 1.17 }
                },
                "https://s.eu.tankionline.com/633/10556/24/206/31770730034472/image.svg": {
                    name: { RU: "Детонатор", EN: "Detonator" },
                    advantages: [
                        { RU: "Урон комбинированного выстрела (по гранате): +100%", EN: "Damage (Combo Shot with grenade): +100%" },
                        { RU: "Разогрев перед выстрелом: 0,5 сек", EN: "Shot warmup time: 0.5s" },
                        { RU: "Радиус макс. и сред. сплеша гранаты: +100%", EN: "Max/Avg area damage radius of the grenade: +100%" },
                        { RU: "Радиус мин. сплеша гранаты: +30%", EN: "Min. area damage radius of the grenade: +30%" },
                        { RU: "Ускорение поворота башни: +100%", EN: "Rotational acceleration: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Требуется попадание по собственной гранате", EN: "Requires hitting own grenade" }
                    ]
                },
                "https://s.eu.tankionline.com/626/15003/117/47/31303200712152/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон: +25%", EN: "Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115404/226/374/31771402064201/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/611/67026/233/112/31770705760344/image.svg": {
                    name: { RU: "Улучшенное горизонтальное сопровождение", EN: "Faster Horizontal Tracking" },
                    advantages: [
                        { RU: "Скорость и ускорение поворота башни: +100%", EN: "Turret rotation speed and acceleration: +100%" },
                        { RU: "Автоприцел угол вверх и вниз: +50%", EN: "Vertical auto-aim: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { TURNING_SPEED: 2.0 }
                },
                "https://s.eu.tankionline.com/611/67027/21/56/31770706032426/image.svg": {
                    name: { RU: "Взломанный процессор наведения", EN: "Hacked Aiming Processor" },
                    advantages: [
                        { RU: "Время восстановления наведения: 10 сек", EN: "Aiming recovery time: +400%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ]
                },
                "https://s.eu.tankionline.com/611/67030/36/256/31770706161602/image.svg": {
                    name: { RU: "Крупный калибр", EN: "Large Caliber" },
                    advantages: [
                        { RU: "Урон стандартного выстрела: +27%", EN: "Arcade normal damage: +27%" },
                        { RU: "Критический урон: +29%", EN: "Critical damage: +29%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка стандартного выстрела: +54%", EN: "Arcade reload time: +54%" }
                    ],
                    modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.54 }
                },
                "https://s.eu.tankionline.com/611/66627/105/110/31770706237122/image.svg": {
                    name: { RU: "Поджигающий залп", EN: "Incendiary Salvo" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Sniping/critically hitting an enemy raises temperature by +0.40 and applies <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Время действия (критический урон): 4 сек", EN: "Critical hit duration: 4 sec" },
                                { RU: "Время действия (прицельный выстрел): 4 сек", EN: "Sniping shot duration: 4 sec" },
                                { RU: "Радиус эффекта прицельного залпа: 15 м", EN: "Area radius (15 meters)" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/611/66630/64/264/31770706363322/image.svg": {
                    name: { RU: "Криозалп", EN: "Freezing Salvo" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Sniping/critically hitting lowers temperature by -1.0 and applies <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit duration: 10 sec" },
                                { RU: "Время действия (прицельный выстрел): 10 сек", EN: "Sniping shot duration: 10 sec" },
                                { RU: "Радиус эффекта прицельного залпа: 15 м", EN: "Area radius (15 meters)" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/231/123/31770706313356/image.svg": {
                    name: { RU: "Электромагнитный залп", EN: "Electromagnetic salvo" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                            EN: "Sniping/critically hitting applies the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                            subItems: [
                                { RU: "Время действия (критический урон): 2 сек", EN: "Critical hit duration: 2 sec" },
                                { RU: "Время действия (прицельный выстрел): 3 сек", EN: "Sniping shot duration: 3 sec" },
                                { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/607/131160/264/374/31770706563445/image.svg": {
                    name: { RU: "Оглушающий залп", EN: "Stunning Salvo" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                            EN: "Sniping/critically hitting applies the <span class='text-yellow'>Stun</span> status effect",
                            subItems: [
                                { RU: "Время действия (критический урон): 1 сек", EN: "Critical hit duration: 1 sec" },
                                { RU: "Время действия (прицельный выстрел): 1,5 сек", EN: "Sniping shot duration: 1.5 sec" },
                                { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115404/230/55/31770706521011/image.svg": {
                    name: { RU: "Бронебойный залп", EN: "Armor-Piercing Salvo" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                            EN: "Sniping/critically hitting applies the <span class='text-purple'>Armor-Piercing</span> status effect",
                            subItems: [
                                { RU: "Время действия (критический урон): 5 сек", EN: "Critical hit duration: 5 sec" },
                                { RU: "Время действия (прицельный выстрел): 9 сек", EN: "Sniping shot duration: 9 sec" },
                                { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/611/67027/312/216/31770706445402/image.svg": {
                    name: { RU: "Подавляющий залп", EN: "Jamming Salvo" },
                    advantages: [
                        {
                            RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span>",
                            EN: "Any hit applies the <span class='text-pink'>Jammer</span> status effect",
                            subItems: [
                                { RU: "Время действия (обычный урон): 3 сек", EN: "Normal hit: 3 sec" },
                                { RU: "Время действия (критический урон): 9 сек", EN: "Critical hit: 9 sec" },
                                { RU: "Время действия (прицельный выстрел): 12 сек", EN: "Sniping shot: 12 sec" },
                                { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/606/113532/321/357/31771404320730/image.svg": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -11%", EN: "Critical chance: -12%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153142/155/344/31770706700310/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/606/113476/60/105/31771404470272/image.svg": {
                    name: { RU: "Суперсоленоиды", EN: "Super Solenoids" },
                    advantages: [
                        { RU: "Урон прицельного выстрела: +50%", EN: "Salvo damage: +50%" },
                        { RU: "Перезарядка прицельного выстрела: -36%", EN: "Salvo reload: -36%" }
                    ],
                    disadvantages: [
                        { RU: "Радиус сплеш-урона (макс/сред/мин): -90%", EN: "Splash damage radius (max/avg/min): -90%" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 1.5 }
                },
                "https://s.eu.tankionline.com/611/67027/162/134/31771404150746/image.svg": {
                    name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed Shells" },
                    advantages: [
                        { RU: "Скорость снаряда: +100%", EN: "Projectile speed: +100%" },
                        { RU: "Процент слабого поражения: 300%", EN: "Weak damage percentage = 300%" },
                        { RU: "Дальность полного/слабого поражения: -50% / -25%", EN: "Range of max/min damage reduction" }
                    ],
                    disadvantages: [
                        { RU: "Урон стандартного выстрела: -50%", EN: "Normal damage: -50%" },
                        { RU: "Критический урон отключен", EN: "Critical hit removed" },
                        { RU: "Автоприцел угол по горизонтали: ±0,2°", EN: "Horizontal auto-aim angle: ±0.2°" }
                    ],
                    modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
                },
                "https://s.eu.tankionline.com/611/67030/210/164/31771404376342/image.svg": {
                    name: { RU: "Охлаждение соленоидов", EN: "Solenoid Cooling" },
                    advantages: [
                        { RU: "Перезарядка прицельного выстрела: -50%", EN: "Salvo reload: -50%" },
                        { RU: "Наведение: -50%", EN: "Aiming time: -50%" }
                    ],
                    disadvantages: [
                        { RU: "Урон прицельного выстрела: -20%", EN: "Salvo damage: -20%" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 0.8 }
                },
                "https://s.eu.tankionline.com/623/44244/2/213/31771404241071/image.svg": {
                    name: { RU: "Немезида", EN: "Nemesis" },
                    advantages: [
                        { RU: "Урон прицельного выстрела: +140%", EN: "Salvo damage: +140%" },
                        { RU: "Время восстановления наведения: 10 сек", EN: "Aiming recovery time: +400%" },
                        { RU: "Перезарядка прицельного выстрела: -70%", EN: "Salvo reload: -70%" }
                    ],
                    disadvantages: [
                        { RU: "Время наведения: +120%", EN: "Aiming time: +120%" },
                        { RU: "Отдача прицельного выстрела: +150%", EN: "Recoil: +150%" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 2.4 }
                },
                "https://s.eu.tankionline.com/632/120275/211/15/31771404077132/image.svg": {
                    name: { RU: "Боксёр", EN: "Boxer" },
                    advantages: [
                        { RU: "Урон стандартного выстрела: +27%", EN: "Arcade Shot damage: +27%" },
                        { RU: "Критический урон: +29%", EN: "Arcade Critical Shot damage: +29%" },
                        { RU: "Перезарядка прицельного выстрела: -30%", EN: "Salvo reload: -30%" },
                        { RU: "Наведение: -10%", EN: "Aiming time: -10%" },
                        { RU: "Сила удара прицельного выстрела: +200%", EN: "Salvo impact force: +200%" },
                        { RU: "Сила удара: +50%", EN: "Arcade impact force: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Перезарядка стандартного выстрела: +15%", EN: "Reload time in Arcade mode: +15%" }
                    ],
                    modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.15, IMPACT_FORCE: 1.5 }
                },
                "https://s.eu.tankionline.com/626/15000/104/132/31303200102114/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон стандартного выстрела: +25%", EN: "Arcade Shot Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/605/115405/43/367/31771402525043/image.svg": {
                    name: { RU: "Адреналин", EN: "Adrenaline" },
                    advantages: [
                        { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
                },
                "https://s.eu.tankionline.com/605/137574/124/170/31770737107437/image.svg": {
                    name: { RU: "Короткополосный эмиттер", EN: "Short-band emitter" },
                    advantages: [
                        { RU: "Урон навскидку: +30%", EN: "Arcade damage: +30%" },
                        { RU: "Урон критического выстрела навскидку: +29%", EN: "Arcade critical damage: +29%" },
                        { RU: "Минимальный прицельный урон: +30%", EN: "Minimum sniping damage: +30%" }
                    ],
                    disadvantages: [
                        { RU: "Время перезарядки между выстрелами навскидку: +15%", EN: "Arcade reload: +15%" }
                    ],
                    modifiers: { ARCADE_DAMAGE: 1.3, CRIT_DAMAGE: 1.29 }
                },
                "https://s.eu.tankionline.com/605/137574/122/354/31770736731242/image.svg": {
                    name: { RU: "Тяжёлые конденсаторы", EN: "Heavy capacitors" },
                    advantages: [
                        { RU: "Максимальный прицельный урон: +25%", EN: "Maximum sniping damage: +25%" }
                    ],
                    disadvantages: [
                        { RU: "Скорость заряда в прицельном режиме: -25%", EN: "Charge rate in aiming mode: -25%" },
                        { RU: "Энергия на прицельный выстрел: +100%", EN: "Energy consumed by sniping shot: +100%" },
                        { RU: "Скорость восстановления после прицельного выстрела: -20%", EN: "Recharge rate after sniping shot: -20%" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 1.25, CHARGE_RATE: 0.8 }
                },
                "https://s.eu.tankionline.com/605/115405/47/222/31770737017704/image.svg": {
                    name: { RU: "Лёгкие конденсаторы", EN: "Light capacitors" },
                    advantages: [
                        { RU: "Скорость заряда в прицельном режиме: +50%", EN: "Charge rate in aiming mode: +50%" },
                        { RU: "Скорость восстановления после прицельного выстрела: +20%", EN: "Recharge rate after sniping shot: +20%" },
                        { RU: "Энергия на прицельный выстрел: -50%", EN: "Energy consumed by sniping shot: -50%" },
                        { RU: "Скорость прицеливания по горизонтали: +100%", EN: "Horizontal aiming speed: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Максимальный прицельный урон: -25%", EN: "Maximum sniping damage: -25%" }
                    ],
                    modifiers: { CHARGE_RATE: 1.2, SNIPING_DAMAGE: 0.75 }
                },
                "https://s.eu.tankionline.com/607/65044/323/337/31770737157450/image.svg": {
                    name: { RU: "Поджигающая фокусировка", EN: "Incendiary Sight" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                            EN: "Critically hitting or sniping an enemy raises their temperature by +0.4 and applies <span class='text-red'>Burning</span>",
                            subItems: [
                                { RU: "Время действия (прицельный / крит): 5 сек", EN: "Duration: up to 5 sec" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/621/45765/150/23/31770737303451/image.svg": {
                    name: { RU: "Замораживающая фокусировка", EN: "Freezing Sight" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                            EN: "Sniping or hitting an enemy with a critical arcade shot applies <span class='text-blue'>Freezing</span>",
                            subItems: [
                                { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/620/44540/243/134/31770737240573/image.svg": {
                    name: { RU: "Электризующая фокусировка", EN: "Electrifying Sight" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                            EN: "Sniping or hitting an enemy with a critical arcade shot applies <span class='text-green'>Electromagnetic Pulse</span>",
                            subItems: [
                                { RU: "Время действия (прицельный): 3 сек", EN: "Sniping duration: 3 seconds" },
                                { RU: "Время действия (критический): 2 сек", EN: "Critical hit duration: 2 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/612/5273/330/266/31770737463446/image.svg": {
                    name: { RU: "Оглушающая фокусировка", EN: "Stunning Sight" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                            EN: "Sniping or hitting an enemy with a critical arcade shot applies the <span class='text-yellow'>Stun</span> effect",
                            subItems: [
                                { RU: "Время действия (прицельный): 1,5 сек", EN: "Sniping duration: 1.5 seconds" },
                                { RU: "Время действия (критический): 1 сек", EN: "Critical hit duration: 1 second" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/605/115405/50/303/31770737420124/image.svg": {
                    name: { RU: "Бронебойная фокусировка", EN: "Armor-Piercing Sight" },
                    advantages: [
                        {
                            RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                            EN: "Sniping or hitting with critical arcade shots applies the <span class='text-purple'>Armor-Piercing</span> effect",
                            subItems: [
                                { RU: "Время действия (прицельный): 9 сек", EN: "Sniping duration: 9 seconds" },
                                { RU: "Время действия (критический): 5 сек", EN: "Critical hit duration: 5 seconds" }
                            ]
                        },
                        { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "https://s.eu.tankionline.com/617/163550/12/157/31770737356413/image.svg": {
                    name: { RU: "Подавляющая фокусировка", EN: "Jamming Sight" },
                    advantages: [
                        {
                            RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                            EN: "Applies the <span class='text-pink'>Jammer</span> status effect to the target",
                            subItems: [
                                { RU: "Время действия (обычный выстрел): 3 сек", EN: "Arcade hit duration: 3 seconds" },
                                { RU: "Время действия (критический урон): 9 сек", EN: "Critical hit duration: 9 seconds" },
                                { RU: "Время действия (прицельный выстрел): 12 сек", EN: "Sniping hit duration: 12 seconds" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.5 }
                },
                "URL_ПУЛЬСАР12": {
                    name: { RU: "Пульсар", EN: "Pulsar" },
                    advantages: [
                        {
                            RU: "Критическое попадание накладывает статус-эффекты:",
                            EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                            subItems: [
                                { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                                { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                                { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                                { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                            ]
                        }
                    ],
                    disadvantages: [
                        { RU: "Шанс критического урона: -11%", EN: "Critical chance: -12%" },
                        { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
                    ],
                    modifiers: { CRIT_DAMAGE: 0.1 }
                },
                "https://s.eu.tankionline.com/625/153143/235/270/31770740077771/image.svg": {
                    name: { RU: "Кемпер", EN: "Camper" },
                    advantages: [
                        { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
                    ],
                    disadvantages: [
                        { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                        { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
                    ],
                    modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
                },
                "https://s.eu.tankionline.com/605/115405/51/352/31770737750144/image.svg": {
                    name: { RU: "Режим серийного огня", EN: "Rapid-fire mode" },
                    advantages: [
                        { RU: "Перезарядка между выстрелами навскидку: -83%", EN: "Arcade shot reload: -83%" },
                        { RU: "Скорость восстановления энергии: +100%", EN: "Energy recovery rate: +100%" }
                    ],
                    disadvantages: [
                        { RU: "Урон прицельный макс: -40%", EN: "Maximum sniping damage: -40%" },
                        { RU: "Энергия на выстрел навскидку: 369 ед.", EN: "Energy consumed per arcade shot: 369" },
                        { RU: "Энергия на прицельный выстрел: 1000 ед.", EN: "Energy consumed per sniping shot: 1000" }
                    ],
                    modifiers: { CHARGE_RATE: 2, SNIPING_DAMAGE: 0.6 }
                },
                "https://s.eu.tankionline.com/605/115405/45/51/31770737552234/image.svg": {
                    name: { RU: "Восстанавливающие излучатели", EN: "Healing Emitters" },
                    advantages: [
                        { RU: "Выстрелы по союзникам лечат их на количество наносимого урона", EN: "Shooting a teammate heals them the same amount it would damage" },
                        { RU: "Лечение приносит очки репутации и опыта (от 1 до 20)", EN: "Healing gives reputation and experience points" },
                        { RU: "Отдача отсутствует", EN: "No recoil" }
                    ],
                    disadvantages: [
                        { RU: "Урон навскидку и прицельный: -15%", EN: "Arcade/Max sniping damage: -15%" },
                        { RU: "Критический урон отключён", EN: "Critical damage removed" },
                        { RU: "Сила удара отсутствует", EN: "No impact force" },
                        { RU: "Перезарядка навскидку: +15%", EN: "Arcade shot reload: +15%" },
                        { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 0.85, ARCADE_DAMAGE: 0.85, CRIT_DAMAGE: 0, IMPACT_FORCE: 0 }
                },
                "https://s.eu.tankionline.com/623/154745/143/361/31770737674426/image.svg": {
                    name: { RU: "Квазар", EN: "Quasar" },
                    advantages: [
                        { RU: "Урон навскидку: +60%", EN: "Arcade damage: +60%" },
                        { RU: "Критический урон навскидку: +55%", EN: "Arcade critical damage: +55%" },
                        { RU: "Прицельный урон (мин/макс): +60% / +51.5%", EN: "Min/Max sniping damage increase: +60% / +51.5%" },
                        { RU: "Расход энергии: +50%", EN: "Energy consumption: +50%" }
                    ],
                    disadvantages: [
                        { RU: "Зарядка прицельного выстрела: -33.3%", EN: "Sniping shot reload time: +33.3%" },
                        { RU: "Перезарядка навскидку: +70%", EN: "Arcade shot reload time: +70%" },
                        { RU: "Ускорение поворота башни: -25%", EN: "Turret rotation speed: -25%" }
                    ],
                    modifiers: { ARCADE_DAMAGE: 1.6, SNIPING_DAMAGE: 1.515, CRIT_DAMAGE: 1.55, CHARGE_RATE: 0.667 }
                },
                "https://s.eu.tankionline.com/627/115736/0/267/31770740020031/image.svg": {
                    name: { RU: "Стелларатор", EN: "Stellarator" },
                    advantages: [
                        { RU: "Минимальный прицельный урон: +300%", EN: "Initial sniping damage: +300%" },
                        { RU: "Скорость потребления энергии: 200 ед/с", EN: "Energy consumed = 200 units/sec" }
                    ],
                    disadvantages: [
                        { RU: "Максимальный прицельный урон: -15%", EN: "Final sniping damage: -15%" },
                        { RU: "Энергия на прицельный выстрел: +60%", EN: "Energy consumed per sniping shot: +60%" }
                    ],
                    modifiers: { SNIPING_DAMAGE: 0.85 }
                },
                "https://s.eu.tankionline.com/626/15004/330/76/31303201216215/image.svg": {
                    name: { RU: "Эксельсиор", EN: "Excelsior" },
                    advantages: [
                        { RU: "Урон стандартного выстрела: +25%", EN: "Arcade Shot Damage: +25%" },
                        { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                        { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
                    ],
                    disadvantages: [
                        { RU: "Отсутствуют", EN: "None" }
                    ],
                    modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
                },
                "https://s.eu.tankionline.com/615/13537/46/256/31766327050313/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/355/111/31766330501540/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/353/345/31766330711714/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/605/115405/222/233/31766327747313/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115405/217/1/31766330026650/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115405/221/162/31766330117470/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115405/230/162/31766330336234/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115405/215/334/31766330253155/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115405/226/26/31766330200477/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/352/170/31766327467052/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115405/223/302/31766327322346/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115405/220/55/31766327402020/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115405/227/110/31766327560021/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115405/224/357/31766327640451/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13535/121/235/31766275260712/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/346/113/31766277306520/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/330/66/31766304664657/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/267/303/31766307451743/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/364/144/31766313030407/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/373/202/31766320252533/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52627/1/55/31766252272742/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/335/352/31766275130427/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/344/341/31766277604702/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/314/224/31766270066136/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/342/12/31766274536373/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/351/13/31766277235607/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/333/7/31766304524016/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/367/101/31766312632013/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/376/110/31766320151337/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/304/160/31766326437213/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/360/43/31766330424075/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52627/3/366/31766252206443/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/313/26/31766271431403/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/340/224/31766275016373/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/625/153441/322/26/31766330554432/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153434/211/174/31766305002430/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153432/123/23/31766271350475/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153435/56/204/31766307562214/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153432/353/164/31766274735212/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153437/257/205/31766320353033/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153431/244/273/31766252074314/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/625/153436/225/317/31766313134356/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/607/52626/331/234/31766305066210/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/322/171/31766315520416/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/374/331/31766320473457/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/300/70/31766326656325/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/607/52626/356/271/31766330630270/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/625/153433/270/213/31766277441416/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/607/52626/347/254/31766277517450/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/605/115404/255/112/31766276374365/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/251/274/31766276515545/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/254/37/31766276640751/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/263/32/31766277136143/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/250/232/31766277026137/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/260/303/31766276737213/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/343/154/31766276045327/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/256/156/31766275630266/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/252/351/31766275733170/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/261/363/31766276145114/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/257/232/31766276250353/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13535/232/61/31766301413021/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/326/312/31766305153550/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/626/14763/222/273/31303174776207/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/605/115404/271/2/31766303351066/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/265/163/31766303441366/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/267/326/31773311346741/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/276/325/31766304070150/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/264/114/31766303750551/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/274/173/31766303633046/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/325/132/31766302722064/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/272/45/31766301572647/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/266/244/31766302600226/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/275/253/31766303116267/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/273/122/31766303241735/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13536/347/303/31766324070273/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/276/325/31766326520415/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/625/153440/130/316/31766326600612/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/607/52626/275/155/31766326743766/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/626/14775/270/340/31303177425217/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14776/162/300/31303177563156/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14763/0/105/31303174636476/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14773/203/76/31303176751641/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14774/252/246/31303177163004/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14760/353/56/31303174244125/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14775/64/127/31303177275076/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14757/7/353/31303173653776/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/626/14774/57/121/31303177061063/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/605/115405/200/351/31766325745206/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115405/175/147/31766326031401/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115405/177/303/31766326123603/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115405/206/277/31766326341374/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115405/174/105/31766326262726/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115405/204/144/31766326203045/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/273/364/31766324601137/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115405/202/17/31766324321024/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115405/176/222/31766324435437/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115405/205/223/31766324676724/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115405/203/72/31766325625702/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13534/331/62/31766252731606/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/311/141/31766270415747/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52626/307/301/31766271515232/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/626/14757/372/20/31303174034500/image.svg": sharedHullSpecs.excelsior,
                "https://s.eu.tankionline.com/605/115404/161/51/31766263640146/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/155/230/31766263745525/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/157/376/31766264071161/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/167/3/31766267711246/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/154/161/31766267516227/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/164/240/31766264244210/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/306/22/31766263372714/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/162/117/31766263137210/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/156/315/31766263225534/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/165/323/31766263461506/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/163/173/31766263543757/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13535/337/124/31766305716424/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/266/125/31766307751231/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/272/222/31766307360573/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/607/52626/271/51/31766307657046/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/605/115404/305/361/31766306540617/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/302/147/31766306640200/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/304/306/31766306745453/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/313/302/31766307262732/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/301/77/31766307137537/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/311/152/31766307040730/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/264/207/31766306176176/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/307/27/31766306011421/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/303/226/31771405137507/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/312/223/31766306314401/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/310/101/31766306402030/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13536/157/317/31766313525335/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/321/33/31766315260326/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/625/153437/45/146/31766315415525/image.svg": sharedHullSpecs.grenadier,
                "https://s.eu.tankionline.com/607/52626/317/260/31766315601553/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/323/353/31766315166437/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/605/115404/354/246/31766314347600/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/351/35/31766314504401/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/353/176/31766314601235/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/362/172/31766315072610/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/347/366/31766314771264/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/360/42/31766314674575/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/316/33/31766313775764/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/355/316/31766313624736/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/352/112/31766313716404/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/361/120/31766314064546/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/356/372/31766314203753/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13535/31/115/31766272136011/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/337/100/31766274645601/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/605/115404/175/3/31766273756434/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/171/147/31766274052527/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/173/326/31766274162553/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/202/353/31766274425040/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/170/74/31766274330006/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/200/211/31766274243725/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/334/161/31766272563444/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/176/56/31766272242251/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/172/240/31766272474513/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/201/275/31766272651655/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/177/134/31766272740347/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13536/263/135/31766315774712/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/372/40/31766320560110/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/605/115405/152/265/31766317240576/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115405/147/52/31766317346645/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115405/151/210/31766317475152/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/144203/5/124/31766320065417/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115405/146/1/31766317734316/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115405/156/63/31766317647646/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/370/255/31766316413112/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115405/153/333/31766316247101/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115405/150/131/31766316333200/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115405/157/142/31766316506302/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115405/155/6/31766316571614/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13534/124/206/31766252442620/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52627/2/224/31766251765336/image.svg": sharedHullSpecs.driver,
                "https://s.eu.tankionline.com/607/52627/5/137/31766251677753/image.svg": sharedHullSpecs.blaster,
                "https://s.eu.tankionline.com/605/115404/145/136/31766250710525/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/141/307/31766251112607/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/144/63/31766251170516/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/153/100/31766251601424/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/132/344/31766251505217/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/150/335/31766251265704/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/377/265/31766247400410/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/146/210/31766250614230/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/142/374/31766247316713/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/152/21/31766247562001/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/147/265/31766247656275/image.svg": sharedHullSpecs.heavyweight,
                "https://s.eu.tankionline.com/615/13536/66/55/31766310170275/image.svg": sharedHullSpecs.extremeLightweight,
                "https://s.eu.tankionline.com/607/52626/362/366/31766313401007/image.svg": sharedHullSpecs.lifeguard,
                "https://s.eu.tankionline.com/607/52626/365/305/31766313242776/image.svg": sharedHullSpecs.miner,
                "https://s.eu.tankionline.com/605/115404/340/343/31766311235243/image.svg": sharedHullSpecs.heatImmunity,
                "https://s.eu.tankionline.com/605/115404/335/127/31766311455615/image.svg": sharedHullSpecs.coldImmunity,
                "https://s.eu.tankionline.com/605/115404/337/266/31766311541406/image.svg": sharedHullSpecs.empImmunity,
                "https://s.eu.tankionline.com/605/115404/346/302/31766312431275/image.svg": sharedHullSpecs.stunImmunity,
                "https://s.eu.tankionline.com/605/115404/334/54/31766312222752/image.svg": sharedHullSpecs.apImmunity,
                "https://s.eu.tankionline.com/605/115404/344/142/31766311632562/image.svg": sharedHullSpecs.jammerImmunity,
                "https://s.eu.tankionline.com/607/52626/361/203/31766310663474/image.svg": sharedHullSpecs.engineer,
                "https://s.eu.tankionline.com/605/115404/342/11/31766310302045/image.svg": sharedHullSpecs.heatResistance,
                "https://s.eu.tankionline.com/605/115404/336/205/31766310504724/image.svg": sharedHullSpecs.coldResistance,
                "https://s.eu.tankionline.com/605/115404/345/225/31766311004730/image.svg": sharedHullSpecs.lightweight,
                "https://s.eu.tankionline.com/605/115404/343/73/31766311076052/image.svg": sharedHullSpecs.heavyweight
            };

            const renderList = (items: any[], lang: string) => {
                if (!items || items.length === 0) return `<li>${t[lang].empty}</li>`;
                return items.map(item => {
                    let html = `<li>${item[lang] || item['EN']}`;
                    if (item.subItems && item.subItems.length > 0) {
                        html += `<ul>${item.subItems.map((sub: any) => `<li>${sub[lang] || sub['EN']}</li>`).join('')}</ul>`;
                    }
                    html += `</li>`;
                    return html;
                }).join('');
            };

            const closeSpecsModal = () => {
                const overlay = document.querySelector('.custom-specs-modal-wrapper');
                if (overlay) overlay.remove();
                document.querySelectorAll('.custom-card-specs-btn.active').forEach(btn => btn.classList.remove('active'));
            };

            const openSpecsModal = (deviceData: any, deviceUrl: string) => {
                if (!deviceData) return;
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
                    if (e.target === wrapper || (e.target as HTMLElement).classList.contains('custom-specs-close-btn')) {
                        closeSpecsModal();
                    }
                });
                document.body.appendChild(wrapper);
                if (deviceUrl) {
                    const activeCardBtn = document.querySelector(`.custom-card-specs-btn[data-url="${deviceUrl}"]`);
                    if (activeCardBtn) activeCardBtn.classList.add('active');
                }
            };

            const injectButtons = () => {
                if (!utils.getSetting('k_augments', false)) return;
                const cardsImgs = document.querySelectorAll('img.SkinCellStyle-iconCell');
                cardsImgs.forEach(node => {
                    const img = node as HTMLImageElement;
                    const card = img.parentElement as HTMLElement;
                    if (!card) return;
                    const url = img.src;
                    let existingBtn = card.querySelector('.custom-card-specs-btn') as HTMLElement;
                    if (existingBtn && existingBtn.dataset.url !== url) {
                        existingBtn.remove();
                        existingBtn = null;
                    }
                    if (!existingBtn && deviceSpecsDB[url]) {
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
                            openSpecsModal(deviceSpecsDB[url], url);
                        });
                        card.appendChild(btn);
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
                
                const deviceImg = document.querySelector('.DeviceButtonComponentStyle-deviceIcon') as HTMLImageElement;
                if (!deviceImg) return;
                const deviceData = deviceSpecsDB[deviceImg.src];
                if (!deviceData || !deviceData.modifiers) return;

                const allSpans = Array.from(document.querySelectorAll('span')).filter(s => !s.classList.contains('custom-live-stat'));
                allSpans.forEach(nameSpan => {
                    const text = nameSpan.textContent?.trim().toLowerCase() || '';
                    let matchedTag = null;
                    for (const [tag, translations] of Object.entries(STAT_DICT)) {
                        const allVariants = ([] as string[]).concat(translations.RU, translations.EN).filter(Boolean).map(s => s.toLowerCase());
                        if (allVariants.includes(text)) { matchedTag = tag; break; }
                    }
                    if (matchedTag && deviceData.modifiers && (matchedTag in deviceData.modifiers)) {
                        const multiplier = deviceData.modifiers[matchedTag];
                        const valueSpan = nameSpan.parentElement?.nextElementSibling as HTMLElement;
                        if (valueSpan && valueSpan.tagName === 'SPAN' && !valueSpan.classList.contains('hidden-by-script')) {
                            const cleanStr = valueSpan.innerText.replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
                            const origNumber = parseFloat(cleanStr);
                            if (!isNaN(origNumber)) {
                                let newVal = (matchedTag === 'WEIGHT' && multiplier >= 10) ? multiplier : origNumber * multiplier;
                                let formattedVal: any = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                                formattedVal = formattedVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                                let isBuff = multiplier > 1;
                                if (['RELOAD'].includes(matchedTag)) isBuff = multiplier < 1;
                                if (matchedTag === 'WEIGHT' && multiplier < origNumber) isBuff = false;
                                
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
                if (updateQueued) return;
                updateQueued = true;
                requestAnimationFrame(() => {
                    updateQueued = false;
                    if (!utils.getSetting('k_augments', false)) return;
                    if (state.currentScreen !== 'garage') return;
                    injectButtons();
                    updateLiveStats();
                });
            };

            return () => {
                if (!utils.getSetting('k_augments', false)) return;

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
                                if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                                closeSpecsModal();
                            }
                        }
                    }, true);

                    window.addEventListener('mousedown', (e) => {
                        const overlay = document.querySelector('.custom-specs-modal-wrapper');
                        if (overlay && (e.button === 3 || e.button === 4)) {
                            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                        }
                    }, true);

                    window.addEventListener('mouseup', (e) => {
                        const overlay = document.querySelector('.custom-specs-modal-wrapper');
                        if (overlay && (e.button === 3 || e.button === 4)) {
                            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                            closeSpecsModal();
                        }
                    }, true);
                }

                const loadingScreen = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
                if (loadingScreen) closeSpecsModal();

                if (state.currentScreen === 'garage') scheduleUpdate();
            };
        })(),

        customPlayButton: (() => {
            let initialized = false;
            let buttonsCreated = false;
            let autoQueueState = 0;
            let targetMode: any = null;
            let lastSearchingState: boolean | null = null;
            let failSafeTimer: number | null = null;

            const BUTTON_WIDTH = 3.5;
            const ROW_GAP = 0.5;
            const BUTTONS_COUNT = 7;
            const MAIN_WIDTH = (BUTTON_WIDTH * BUTTONS_COUNT) + (ROW_GAP * (BUTTONS_COUNT - 1));
            const WIDE_BUTTON_WIDTH = (MAIN_WIDTH - ROW_GAP) / 2;
            const MAIN_HEIGHT = 8.5;
            const BUTTON_HEIGHT = 3;
            const TOTAL_BG_HEIGHT = MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP + BUTTON_HEIGHT;
            const BG_URL = 'https://s.eu.tankionline.com/static/images/videoplay.79570900.gif';
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

            function simulateClick(el: HTMLElement) {
                if (!el) return false;
                el.click();
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                return true;
            }

            function matchText(text: string, names: string[]) {
                const upper = text.trim().toUpperCase();
                return names.some(n => upper === n.toUpperCase());
            }

            function clickSpecificCard(modeNames: string[]) {
                const allCards = document.querySelectorAll('.BattlePickComponentStyle-commonStyleBlock, .blockCard, [class*="commonStyleBlock"]');
                for (const card of Array.from(allCards)) {
                    const h2 = card.querySelector('h2');
                    if (h2 && matchText(h2.textContent || '', modeNames)) return simulateClick(card as HTMLElement);
                }
                return false;
            }

            function processAutoQueue() {
                if (autoQueueState === 0 || !targetMode) return;
                if (autoQueueState === 1) {
                    if (targetMode.isDirect) {
                        if (clickSpecificCard(targetMode.names)) {
                            autoQueueState = 0; targetMode = null; document.body.classList.remove('kasp-autoqueue-active');
                        }
                    } else {
                        if (clickSpecificCard(modesButtonNames)) autoQueueState = 2;
                    }
                } else if (autoQueueState === 2) {
                    if (clickSpecificCard(targetMode.names)) {
                        autoQueueState = 0; targetMode = null; document.body.classList.remove('kasp-autoqueue-active');
                    }
                }
            }

            function startAutoQueue(modeData: any) {
                if (isSearching()) return;
                targetMode = modeData;
                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer') as HTMLElement;
                if (playButton && !playButton.classList.contains('MainScreenComponentStyle-disabledButtonPlay')) {
                    autoQueueState = 1;
                    document.body.classList.add('kasp-autoqueue-active');
                    if (failSafeTimer) window.clearTimeout(failSafeTimer);
                    failSafeTimer = window.setTimeout(() => {
                        autoQueueState = 0;
                        document.body.classList.remove('kasp-autoqueue-active');
                    }, 1500);
                    simulateClick(playButton);
                }
            }

            function syncButtonStates(force = false) {
                const searching = isSearching();
                if (!force && searching === lastSearchingState) return;
                lastSearchingState = searching;
                const currentLang = state.lang;

                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer') as HTMLElement;
                if (playButton) {
                    const bgLayer = playButton.querySelector('.custom-main-bg-layer') as HTMLElement;
                    const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton) as HTMLElement;
                    let customText = innerBtn.querySelector('.custom-main-text') as HTMLElement;
                    let lockDiv = innerBtn.querySelector('.main-lock-icon') as HTMLElement;
                    
                    if (searching) {
                        playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                        playButton.style.cursor = 'default';
                        if (bgLayer) bgLayer.style.filter = 'brightness(0.35) sepia(1) hue-rotate(160deg) saturate(3)';
                        if (customText) customText.style.display = 'none';
                        if (!lockDiv) {
                            lockDiv = document.createElement('div');
                            lockDiv.className = 'main-lock-icon';
                            lockDiv.style.cssText = `width: 2.625em; height: 2.8125em; background-color: #bed4ff; -webkit-mask-image: url(${LOCK_ICON_URL}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${LOCK_ICON_URL}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; z-index: 2; position: relative;`;
                            innerBtn.appendChild(lockDiv);
                        } else {
                            lockDiv.style.display = 'block';
                            lockDiv.style.backgroundColor = '#bed4ff';
                        }
                    } else {
                        playButton.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em';
                        playButton.style.cursor = 'pointer';
                        if (bgLayer) bgLayer.style.filter = 'none';
                        if (lockDiv) lockDiv.style.display = 'none';
                        if (customText) {
                            customText.style.display = 'flex';
                            const targetText = currentLang === 'RU' ? 'БЫСТРЫЙ БОЙ' : 'QUICK BATTLE';
                            if (customText.textContent !== targetText) customText.textContent = targetText;
                        }
                    }
                }

                document.querySelectorAll('.wide-mode-btn-text').forEach(spanEl => {
                    const span = spanEl as HTMLElement;
                    const modeIndex = parseInt(span.dataset.index || '0', 10);
                    if (wideModes[modeIndex]) span.textContent = (wideModes[modeIndex].labels as any)[currentLang];
                });

                const quickWrapper = document.getElementById('quick-play-wrapper');
                if (quickWrapper) {
                    quickWrapper.querySelectorAll('.custom-mode-button').forEach(btnEl => {
                        const btn = btnEl as HTMLElement;
                        const bgLayer = btn.querySelector('.custom-btn-bg-layer') as HTMLElement;
                        const iconDiv = btn.querySelector('.mode-icon-el') as HTMLElement;
                        const textSpan = btn.querySelector('.wide-mode-btn-text') as HTMLElement;
                        if (searching) {
                            btn.style.pointerEvents = 'none'; btn.style.cursor = 'default';
                            btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                            if (bgLayer) bgLayer.style.filter = 'brightness(0.35) sepia(1) hue-rotate(160deg) saturate(3)';
                            if (iconDiv) iconDiv.style.backgroundColor = '#bed4ff';
                            if (textSpan) textSpan.style.color = '#bed4ff';
                        } else {
                            btn.style.pointerEvents = 'auto'; btn.style.cursor = 'pointer';
                            btn.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em';
                            if (bgLayer) bgLayer.style.filter = 'none';
                            if (iconDiv) iconDiv.style.backgroundColor = '#76ff33';
                            if (textSpan) textSpan.style.color = '#76ff33';
                        }
                    });
                }
            }

            function createQuickButtons(playButton: HTMLElement) {
                if (!playButton || buttonsCreated) return;
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
                    text.textContent = (mode.labels as any)[currentLang];
                    text.style.cssText = 'font-size: 1.2em; font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium; transition: color 0.2s ease-in-out;';
                    contentWrapper.appendChild(img); contentWrapper.appendChild(text); el.appendChild(contentWrapper);
                    el.addEventListener('mouseenter', () => { if (!isSearching()) el.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em'; });
                    el.addEventListener('mouseleave', () => { if (!isSearching()) el.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em'; });
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
                    img.title = (mode.labels as any)[currentLang];
                    img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; position: relative; z-index: 2; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
                    el.appendChild(img);
                    el.addEventListener('mouseenter', () => { if (!isSearching()) el.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em'; });
                    el.addEventListener('mouseleave', () => { if (!isSearching()) el.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em'; });
                    el.addEventListener('click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
                    row3.appendChild(el);
                });

                quickWrapper.appendChild(row2); quickWrapper.appendChild(row3);
                if (playButton.parentElement) playButton.parentElement.appendChild(quickWrapper);
            }

            function applyStyles(playButton: HTMLElement) {
                const container = (playButton.closest('div[class*="-displayFlex"]') || playButton.parentElement?.parentElement) as HTMLElement;
                const mainMenu = document.querySelector('.MainScreenComponentStyle-blockMainMenu') as HTMLElement;
                if (container) {
                    container.style.marginLeft = '5em'; container.style.height = 'auto';
                    container.style.marginTop = '10em'; container.style.width = '31.25em';
                    container.style.flexDirection = 'column'; container.style.alignItems = 'flex-start';
                    container.style.overflow = 'visible'; container.style.zIndex = '5';
                    container.style.position = 'relative';
                }
                if (playButton) {
                    playButton.style.width = `${MAIN_WIDTH}em`; playButton.style.height = `${MAIN_HEIGHT}em`;
                    playButton.style.position = 'relative'; playButton.style.overflow = 'hidden';
                    playButton.style.borderRadius = '0.5rem'; playButton.style.transition = 'box-shadow 0.2s ease-in-out, opacity 0.2s ease-in';
                    playButton.addEventListener('mouseenter', () => { if (!isSearching()) playButton.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em'; });
                    playButton.addEventListener('mouseleave', () => { if (!isSearching()) playButton.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em'; });
                    const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton) as HTMLElement;
                    innerBtn.style.backgroundImage = 'none'; innerBtn.classList.add('custom-inner-btn');
                    let bgLayer = innerBtn.querySelector('.custom-main-bg-layer') as HTMLElement;
                    if (!bgLayer) {
                        bgLayer = document.createElement('div'); bgLayer.className = 'custom-main-bg-layer';
                        bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: 0em 0em; background-repeat: no-repeat; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                        innerBtn.insertBefore(bgLayer, innerBtn.firstChild);
                    }
                    let customText = innerBtn.querySelector('.custom-main-text') as HTMLElement;
                    if (!customText) {
                        customText = document.createElement('div'); customText.className = 'custom-main-text';
                        customText.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 2.75em; font-weight: 500; color: #76ff33; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-transform: uppercase; transition: color 0.2s ease-in-out; pointer-events: none;`;
                        innerBtn.appendChild(customText);
                    }
                    if (!playButton.dataset.overridden) {
                        playButton.addEventListener('click', (e) => {
                            if (e.isTrusted && !isSearching()) { targetMode = quickBattleMode; autoQueueState = 1; }
                        });
                    }
                }
                if (mainMenu) mainMenu.style.marginTop = '1em';
                createQuickButtons(playButton);
                playButton.dataset.overridden = 'true';
                syncButtonStates(true);
            }

            return () => {
                if (!utils.getSetting('k_ext_btn', false)) return;
                
                if (state.currentScreen === 'battle') return;

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

                    window.setInterval(() => {
                        if (autoQueueState !== 0) processAutoQueue();
                    }, 50);
                }

                const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"])') as HTMLElement;
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
                const userEl = document.querySelector('.UserInfoContainerStyle-userNameRank') as HTMLElement;
                if (!userEl) return "Unknown";
                const text = userEl.innerText.trim();
                const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
                return cleanName || "Unknown";
            };

            const getCustomCategories = () => {
                const myNick = getCurrentNickname();
                try {
                    return JSON.parse(localStorage.getItem(`tankiCustomCategories_${myNick}`) || '{}');
                } catch (e) {
                    return {};
                }
            };

            const setCustomCategory = (friendNickname: string, colorType: string) => {
                const myNick = getCurrentNickname();
                if (myNick === "Unknown") return;
                const cats = getCustomCategories();
                if (cats[friendNickname] === colorType) {
                    delete cats[friendNickname];
                } else {
                    cats[friendNickname] = colorType;
                }
                localStorage.setItem(`tankiCustomCategories_${myNick}`, JSON.stringify(cats));
                document.querySelectorAll('.custom-friends-sidebar').forEach(node => {
                    const sidebar = node as HTMLElement;
                    const activeBtn = sidebar.querySelector('.custom-filter-btn.active') as HTMLElement;
                    if (activeBtn) activeBtn.click();
                });
            };

            const getMyClanTag = () => {
                const userEl = (document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') || document.querySelector('.UserInfoContainerStyle-userNameRank')) as HTMLElement;
                if (!userEl) return "";
                const text = userEl.innerText.trim();
                const match = text.match(/\[(.*?)\]/);
                return match ? match[0] : "";
            };

            const updateCardBadge = (el: HTMLElement, isFriendsList: boolean) => {
                const cardText = el.innerText || "";
                const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap')) as HTMLElement;
                const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
                const clanTag = getMyClanTag();
                const isClan = Boolean(clanTag && cardText.includes(clanTag));
                const cats = getCustomCategories();
                const customColor = cats[nickText];
                
                let rarityType = null;
                if (customColor) {
                    rarityType = customColor;
                } else if (isClan) {
                    rarityType = 'blue';
                }
                
                let badge = el.querySelector('.custom-rarity-badge') as HTMLImageElement;
                if (rarityType) {
                    if (!badge) {
                        badge = document.createElement('img');
                        badge.src = 'https://s.eu.tankionline.com/static/images/categoryRarities.04cb4010.svg';
                        badge.className = 'custom-rarity-badge';
                        el.appendChild(badge);
                    }
                    badge.className = `custom-rarity-badge rarity-${rarityType}`;
                    badge.style.display = '';
                } else {
                    if (badge) {
                        badge.style.display = 'none';
                    }
                }
            };

            const applyFilter = (scrollBlock: HTMLElement, filterType: string) => {
                const clanTag = getMyClanTag();
                const cats = getCustomCategories();
                const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
                const items = scrollBlock.querySelectorAll(itemSelector);
                
                items.forEach(node => {
                    const el = node as HTMLElement;
                    updateCardBadge(el, isFriendsList);
                    if (filterType === 'all') {
                        el.style.display = '';
                        return;
                    }
                    const cardText = el.innerText || "";
                    const textLower = cardText.toLowerCase();
                    const isOnline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-greenTextOnline') : (textLower.includes("в сети") || textLower.includes("online"));
                    const isOffline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-offline') : !isOnline;
                    const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap')) as HTMLElement;
                    const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
                    
                    let match = true;
                    if (filterType === 'online') match = isOnline;
                    else if (filterType === 'offline') match = isOffline;
                    else if (filterType === 'clan') match = Boolean(clanTag && cardText.includes(clanTag));
                    else if (['purple', 'yellow', 'red'].includes(filterType)) {
                        match = (cats[nickText] === filterType);
                    }
                    el.style.display = match ? '' : 'none';
                });
            };

            const injectCategoriesMenu = (menu: HTMLElement) => {
                if (menu.dataset.customCategoriesInjected === 'true') return;
                menu.dataset.customCategoriesInjected = 'true';
                const rankItem = menu.querySelector('.ContextMenuStyle-menuItemRank') as HTMLElement;
                if (!rankItem) return;
                const span = Array.from(rankItem.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap')) as HTMLElement;
                if (!span) return;
                
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

            const setupSidebar = (scrollBlock: HTMLElement) => {
                if (scrollBlock.dataset.sidebarInjected === 'true') return;
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
                        if (index === 0) btn.classList.add('active');
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
                } else {
                    const parent = scrollBlock.parentNode as HTMLElement;
                    if (!parent) return;
                    if (window.getComputedStyle(parent).position === 'static') {
                        parent.style.position = 'relative';
                    }
                    const sidebar = document.createElement('div');
                    sidebar.className = 'custom-friends-sidebar sidebar-invites';
                    filtersConfig.forEach((config, index) => {
                        const btn = document.createElement('div');
                        btn.className = 'custom-filter-btn';
                        if (index === 0) btn.classList.add('active');
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
                if (!utils.getSetting('k_friends', false)) return;
                
                if (state.currentScreen === 'battle') return;

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
                    const scrollBlock = node as HTMLElement;
                    if (scrollBlock.dataset.sidebarInjected !== 'true') setupSidebar(scrollBlock);
                    
                    const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                    const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
                    
                    scrollBlock.querySelectorAll(itemSelector).forEach(el => {
                        updateCardBadge(el as HTMLElement, isFriendsList);
                    });
                });

                const contextMenus = document.querySelectorAll('.ContextMenuStyle-menu');
                contextMenus.forEach(node => {
                    const menu = node as HTMLElement;
                    if (menu.dataset.customCategoriesInjected !== 'true') injectCategoriesMenu(menu);
                });
            };
        })(),
        
        customCurrencyUI: (() => {
            let initialized = false;
            
            return () => {
                if (initialized) return;
                initialized = true;

                utils.injectStyle(`
                    .UserScoreComponentStyle-coinsContainer {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: flex-end !important;
                        margin-right: 1.2em !important;
                        margin-left: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        background: transparent !important;
                        min-width: 0 !important;
                        width: auto !important;
                    }

                    div:has(> .HeaderCommonStyle-icons + .HeaderCommonStyle-icons) {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: flex-end !important;
                        margin-right: 4em !important;
                        margin-left: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        background: transparent !important;
                        min-width: 0 !important;
                        width: auto !important;
                    }

                    div:has(> .HeaderCommonStyle-icons + .HeaderCommonStyle-icons) + div {
                        margin-left: -2em !important;
                    }

                    .HeaderCommonStyle-icons,
                    .UserScoreComponentStyle-coinBlock {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: flex-end !important;
                        min-width: 0 !important;
                        width: auto !important;
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .UserScoreComponentStyle-addRubyCrystal,
                    .UserScoreComponentStyle-addCoins {
                        display: none !important;
                    }

                    .HeaderCommonStyle-icons img[src*="ruby"],
                    .HeaderCommonStyle-icons img[src*="crystal"],
                    .UserScoreComponentStyle-coinIcon {
                        width: 1em !important;
                        height: 1em !important;
                        margin: 0 !important;
                        transition: transform 0.2s ease !important;
                        display: block !important;
                    }

                    .HeaderCommonStyle-icons:hover img[src*="ruby"],
                    .HeaderCommonStyle-icons:hover img[src*="crystal"],
                    .HeaderCommonStyle-icons:hover .UserScoreComponentStyle-coinIcon {
                        transform: translateY(-4px) !important;
                    }

                    .HeaderCommonStyle-icons span,
                    .UserScoreComponentStyle-coinsContainer span,
                    .UserScoreComponentStyle-coinBlock span {
                        font-family: BaseFontMedium, FallbackFontMedium !important;
                        font-weight: 500 !important;
                        font-size: 1.125em !important;
                        line-height: 1.313em !important;
                        text-transform: uppercase !important;
                        white-space: nowrap !important;
                        margin-left: 0.6em !important;
                    }

                    .HeaderCommonStyle-icons:has(img[src*="ruby"]) span {
                        color: rgb(255, 102, 102) !important;
                        margin-top: 0.1em !important;
                    }

                    .HeaderCommonStyle-icons:has(img[src*="crystal"]) span {
                        color: rgb(0, 215, 255) !important;
                    }

                    .UserScoreComponentStyle-coinBlock span {
                        color: rgb(255, 212, 42) !important;
                    }
                `, 'kasp-currency-styles');
            };
        })(),

        garageButtons: (() => {
            const ICONS = {
                UPGRADE: "https://s.eu.tankionline.com/static/images/max_level.e31e0825.svg",
                MOUNT: "https://s.eu.tankionline.com/static/images/ic_mount.4175dc0c.svg",
                BUY: "https://s.eu.tankionline.com/static/images/buyButtonIcon.ca48e861.svg"
            };

            function getActiveTabCategory() {
                const activeMenu = document.querySelector('.MenuComponentStyle-mainMenuItem.-activeMenu');
                if (!activeMenu) return 'default';
                
                const txt = activeMenu.textContent.toLowerCase();
                if (txt.includes('припас') || txt.includes('supplies')) return 'supplies';
                if (txt.includes('краск') || txt.includes('paint')) return 'paints';
                if (txt.includes('гранат') || txt.includes('grenade')) return 'grenades';
                return 'default';
            }

            function applyButtonFixes() {
                const buttons = document.querySelectorAll('.GarageCommonStyle-bigActionButton');
                if (!buttons.length) return;

                const currentCategory = getActiveTabCategory();
                
                buttons.forEach((btn) => {
                    const textHTML = btn.innerHTML.toLowerCase();
                    const textContent = btn.textContent.toLowerCase();
                    
                    const hasHotKey = btn.querySelector('[class*="-commonBlockForHotKey"]');
                    const hasPrice = textHTML.includes('price') || 
                                     textHTML.includes('кристал') || 
                                     textHTML.includes('ruby') || 
                                     textHTML.includes('discount') ||
                                     textHTML.includes('tankoin');

                    const isActive = hasHotKey || hasPrice;

                    btn.classList.remove('kasp-hover-up', 'kasp-hover-down', 'kasp-btn-white', 'kasp-btn-gray');

                    const iconDiv = btn.querySelector('[class*="-backgroundImage"]');
                    if (iconDiv) {
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
                        } else if (isEquipText) {
                            targetIcon = ICONS.MOUNT;
                            hoverClass = 'kasp-hover-down';
                            btnColorClass = 'kasp-btn-gray';
                        } else if (isMaxedText) {
                            targetIcon = ICONS.UPGRADE;
                            hoverClass = 'kasp-hover-up';
                        } else if (currentCategory === 'supplies' || isSuppliesContainer) {
                            targetIcon = ICONS.BUY;
                            hoverClass = 'kasp-hover-up';
                        } else {
                            const parent = btn.closest('.TanksPartBaseComponentStyle-buttonsContainer');
                            const siblingsCount = parent ? parent.querySelectorAll('.GarageCommonStyle-bigActionButton').length : 1;
                            
                            if (siblingsCount === 1) {
                                targetIcon = ICONS.BUY;
                                hoverClass = 'kasp-hover-up';
                            } else {
                                targetIcon = ICONS.UPGRADE;
                                hoverClass = 'kasp-hover-up';
                            }
                        }

                        if (isActive) {
                            btn.classList.add('kasp-active-btn', btnColorClass, hoverClass);
                            btn.classList.remove('kasp-disabled-btn');
                        } else {
                            btn.classList.add('kasp-disabled-btn');
                            btn.classList.remove('kasp-active-btn');
                        }

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
                if (state.currentScreen === 'garage') {
                    applyButtonFixes();
                }
            };
        })(),

        welcomeModal: (() => {
            const CURRENT_VERSION = '1.9';
            const STORAGE_KEY = 'kasp_last_version';
            let hasChecked = false;

            const t: Record<string, Record<string, string>> = {
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
                            Gemini 3.5 Flash-Lite<br>
                            Gemini 3.8 Flash<br>
                            Gemini 3.1 Pro
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

                const closeBtn = document.getElementById('kasp-welcome-close') as HTMLElement | null;
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        overlay.remove();
                        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
                    });
                }
            }

            return () => {
                if (hasChecked) return;

                const savedVersion = localStorage.getItem(STORAGE_KEY);
                if (savedVersion === CURRENT_VERSION) {
                    hasChecked = true;
                    return;
                }

                if (state.currentScreen === 'loading') return;

                hasChecked = true;
                showWelcomeModal();
            };
        })(),
        
        hideNickname: (() => {
            let initialized = false;
            let cachedOriginalNick: string | null = null;

            function getHiddenText() {
                return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
            }

            function processNickElement(userNameElement: HTMLElement) {
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
                } else {
                    if (hiddenSpan.className !== expectedClass) hiddenSpan.className = expectedClass;
                    if (hiddenSpan.textContent !== hiddenText) hiddenSpan.textContent = hiddenText;
                    if (cachedOriginalNick && hiddenSpan.getAttribute('data-tooltip') !== cachedOriginalNick) {
                        hiddenSpan.setAttribute('data-tooltip', cachedOriginalNick);
                    }
                }
            }

            function processXpElement(xpContainer: HTMLElement) {
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
                } else {
                    if (hiddenXpSpan.className !== expectedClass) hiddenXpSpan.className = expectedClass;
                    const currentXpText = xpContainer.textContent?.trim() || '';
                    if (currentXpText && currentXpText !== hiddenText && currentXpText !== 'Скрыто' && currentXpText !== 'Hidden') {
                        hiddenXpSpan.setAttribute('data-tooltip', currentXpText);
                    }
                    if (hiddenXpSpan.textContent !== hiddenText) hiddenXpSpan.textContent = hiddenText;
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
                if (!cachedOriginalNick) return;
                
                const hiddenText = getHiddenText();
                
                const tabContainer = document.querySelector('.BattleTabStatisticComponentStyle-containerInsideTeams');
                if (tabContainer) {
                    const tabSpans = tabContainer.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell span');
                    for (let i = 0; i < tabSpans.length; i++) {
                        const span = tabSpans[i] as HTMLElement;
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
                        const span = resultSpans[i] as HTMLElement;
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
                if (!utils.getSetting('k_hideNicknameXP', false)) return;

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

                const userName = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') as HTMLElement;
                if (userName) processNickElement(userName);
                
                const xp = document.querySelector('.UserInfoContainerStyle-progressValue') as HTMLElement;
                if (xp) processXpElement(xp);

                hideNicknameInTables();
            };
        })(),
        
        hideCurrency: (() => {
            let initialized = false;

            function getHiddenText() {
                return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
            }

            function processSpan(span: HTMLElement) {
                const text = span.textContent?.trim() || '';
                const targetText = getHiddenText();
                
                const parentElement = (span.closest('.HeaderCommonStyle-icons') || span.parentElement) as HTMLElement;
                
                if (text && text !== targetText && text !== 'Скрыто' && text !== 'Hidden' && /\d/.test(text)) {
                    span.dataset.originalValue = text;
                    span.textContent = targetText;
                    if (parentElement) {
                        parentElement.setAttribute('data-tooltip', text);
                    }
                } else if (span.dataset.originalValue && parentElement && !parentElement.hasAttribute('data-tooltip')) {
                    parentElement.setAttribute('data-tooltip', span.dataset.originalValue);
                }
                
                if (parentElement && !parentElement.classList.contains('currency-masked')) {
                    parentElement.classList.add('currency-masked');
                }
            }

            return () => {
                if (!utils.getSetting('k_hideCurrency', false)) return;
                if (state.currentScreen === 'battle') return;

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
                        if (state.currentScreen === 'battle') return;
                        const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
                        spans.forEach(node => processSpan(node as HTMLElement));
                    }, 500);
                }

                const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
                spans.forEach(node => processSpan(node as HTMLElement));
            };
        })(),

        customTrophies: (() => {
            let initialized = false;
            const STORAGE_KEY = 'kasp_trophies_favorites';
            const ICON_UNFAV = 'https://s.eu.tankionline.com/static/images/unfavoriteStar.0e39d67a.svg';
            const ICON_FAV = 'https://s.eu.tankionline.com/static/images/favoriteStar.1ce58570.svg';

            type Trophy = { id: string; type: string; icon: string; current: number; max: number };

            const DICTIONARY: Record<string, { id: string; ru: string; en: string; type: string }> = {
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

            let cachedFavs: Trophy[] | null = null;

            function getFavs(): Trophy[] {
                if (cachedFavs) return cachedFavs;
                try {
                    cachedFavs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                } catch {
                    cachedFavs = [];
                }
                return cachedFavs || [];
            }

            function saveFavs(favs: Trophy[]) {
                cachedFavs = favs;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
            }

            function parseItem(rawText: string) {
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

            function formatNumber(num: number) {
                return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            }

            function extractIcon(card: HTMLElement) {
                const rewardDiv = card.querySelector('[class*="rewardsContainer"] [class*="-backgroundImageContain"]');
                if (rewardDiv) {
                    const bg = window.getComputedStyle(rewardDiv).backgroundImage;
                    const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
                    if (match) return match[1];
                }
                return 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg';
            }

            function toggleFavorite(itemId: string, type: string, iconUrl: string, current: number, max: number) {
                let favs = getFavs();
                const idx = favs.findIndex(f => f.id === itemId);
                if (idx > -1) {
                    favs.splice(idx, 1);
                } else {
                    const count = favs.filter(f => f.type === type).length;
                    if (count >= 2) return;
                    favs.push({ id: itemId, type, icon: iconUrl, current, max });
                }
                saveFavs(favs);
                const cards = document.querySelectorAll('.MainQuestComponentStyle-cardPlayCommon, .TableMainQuestComponentStyle-commonTableMainQuest, .MainQuestComponentStyle-cardPlay');
                if (cards.length > 0) processGarageMissions(Array.from(cards) as HTMLElement[]);
            }

            function processGarageMissions(garageCards: HTMLElement[]) {
                let favs = getFavs();
                let favsUpdated = false;
                const favTurrets = favs.filter(f => f.type === 'turret').length;
                const favHulls = favs.filter(f => f.type === 'hull').length;
                
                garageCards.forEach(card => {
                    const progressEl = card.querySelector('h4');
                    if (!progressEl) return;
                    const rawText = card.textContent || '';
                    const itemInfo = parseItem(rawText);
                    if (!itemInfo) return;
                    
                    const isGrid = card.classList.contains('MainQuestComponentStyle-cardPlay');
                    card.style.position = 'relative';
                    if (isGrid) {
                        card.classList.add('card-type-grid'); card.classList.remove('card-type-list');
                    } else {
                        card.classList.add('card-type-list'); card.classList.remove('card-type-grid');
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
                    } else {
                        const img = starContainer.querySelector('img');
                        const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
                        if (img && img.src !== expectedIcon) img.src = expectedIcon;
                    }
                    
                    if (limitReached) starContainer.classList.add('star-limit-reached');
                    else starContainer.classList.remove('star-limit-reached');
                });
                if (favsUpdated) saveFavs(favs);
            }

            function processBattleResults(battleCards: HTMLElement[]) {
                let favs = getFavs();
                let favsUpdated = false;
                battleCards.forEach(card => {
                    const textElements = card.querySelectorAll('.BattleResultQuestProgressComponentStyle-text');
                    if (textElements.length < 2) return;
                    let rawText = '';
                    let rawProgress = '';
                    textElements.forEach(el => {
                        const text = el.textContent || '';
                        const style = el.getAttribute('style') || '';
                        if (text.includes(' / ')) {
                            if (!style.includes('opacity: 0')) rawProgress = text;
                        } else if (text.length > 15 && !text.includes('ВЫПОЛНЕНО') && !text.includes('COMPLETED')) {
                            rawText = text;
                        }
                    });
                    if (!rawText || !rawProgress) return;
                    const itemInfo = parseItem(rawText);
                    if (!itemInfo) return;
                    
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
                if (favsUpdated) saveFavs(favs);
            }

            function createPanel() {
                const panel = document.createElement('div');
                panel.id = 'custom-trophy-panel';
                panel.className = 'custom-trophy-panel';
                const trophies = getFavs();
                
                trophies.sort((a, b) => {
                    if (a.type === 'turret' && b.type === 'hull') return -1;
                    if (a.type === 'hull' && b.type === 'turret') return 1;
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
                } else {
                    if (panel) panel.remove();
                }
                
                const cards = document.querySelectorAll('.MainQuestComponentStyle-cardPlayCommon, .TableMainQuestComponentStyle-commonTableMainQuest, .MainQuestComponentStyle-cardPlay');
                if (cards.length > 0) processGarageMissions(Array.from(cards) as HTMLElement[]);
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
                } else if (state.currentScreen === 'match_results') {
                    const battleCards = document.querySelectorAll('.BattleResultQuestProgressComponentStyle-container');
                    if (battleCards.length > 0) processBattleResults(Array.from(battleCards) as HTMLElement[]);
                }
            };
        })(),

        autoUpgrade: (() => {
            let initialized = false;
            let isRunning = false;
            let upgradeQueue = 0;
            let upgraded = 0;
            let timer: number | null = null;
            let lastItemSignature = '';
            let isCategorySwitch = true;
            let categorySwitchTimeout: number | null = null;
            const DELAY = 200;

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
                    if (headerText.includes('рубин') || headerText.includes('ruby')) return true;
                }
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
                if (!btn) return false;
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('за ') || text.includes('for ') || text.includes('рубин') || text.includes('ruby') || text.includes('получить') || text.includes('get')) return true;
                const rubyImg = btn.querySelector('img[src*="rubyBlack"], img[src*="ruby"]');
                if (rubyImg) return true;
                return false;
            }

            function hasNormalButton() {
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
                if (!btn) return false;
                return !isRubyButton();
            }

            function clickConfirmButton() {
                const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton') as HTMLElement;
                if (btn) { btn.click(); return true; }
                return false;
            }

            function clickCancel() {
                const buttons = document.querySelectorAll('.DialogContainerComponentStyle-container div');
                for (let i = 0; i < buttons.length; i++) {
                    const el = buttons[i] as HTMLElement;
                    const text = el.textContent?.trim().toLowerCase() || '';
                    if (text === 'отмена' || text === 'cancel') { el.click(); return true; }
                }
                const btn = document.querySelector('.DialogContainerComponentStyle-keyButton') as HTMLElement;
                if (btn) { btn.click(); return true; }
                return false;
            }

            function isCompleted() {
                const btns = document.querySelectorAll('.SquarePriceButtonComponentStyle-commonBlockButton');
                for (let i = 0; i < btns.length; i++) {
                    const btn = btns[i];
                    const span = btn.querySelector('span.-bold');
                    if (span) {
                        const text = span.textContent?.trim().toUpperCase() || '';
                        if (text === 'ЗАВЕРШЕНО' || text === 'COMPLETED') return true;
                    }
                }
                return false;
            }

            function isMaxLevel() {
                return !!document.querySelector('.TanksPartBaseComponentStyle-marginTop .-buttonEstablished');
            }

            function shouldShowQuickButtons() {
                if (!utils.getSetting('k_auto_upgrade', false)) return false;
                if (isCompleted() || isMaxLevel()) return false;
                const buttonsContainer = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                if (!buttonsContainer) return false;
                const btns = buttonsContainer.querySelectorAll('.SquarePriceButtonComponentStyle-commonBlockButton');
                for (let i = 0; i < btns.length; i++) {
                    const btn = btns[i];
                    if (btn.closest('.TanksPartBaseComponentStyle-marginTop')) continue;
                    const hotkey = btn.querySelector('.-commonBlockForHotKey');
                    if (hotkey && hotkey.textContent?.trim() === 'Enter') {
                        if (btn.classList.contains('-widthHeightButtonGarage')) {
                            const coinIcon = btn.querySelector('.GarageCommonStyle-iconCoinSmall');
                            if (coinIcon) {
                                const bgImage = window.getComputedStyle(coinIcon).backgroundImage;
                                if (!bgImage.includes('ruby')) return true;
                            }
                        }
                    }
                }
                return false;
            }

            function showConfirmDialog(count: number, callback: () => void) {
                const existing = document.getElementById('quick-upgrade-overlay');
                if (existing) existing.remove();

                const lang = state.lang;
                const t: any = {
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
                header.appendChild(title); header.appendChild(closeBtn);

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
                textLine.appendChild(textSpan); textLine.appendChild(countSpan); content.appendChild(textLine);

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
                footer.appendChild(cancelBtn); footer.appendChild(confirmBtn);

                dialog.appendChild(header); dialog.appendChild(content); dialog.appendChild(footer);
                overlay.appendChild(dialog);
                
                let isClosing = false;

                function closeDialog() {
                    if (!overlay.parentNode) return;
                    overlay.remove();
                    window.setTimeout(() => {
                        document.removeEventListener('keydown', onKeyDown, true);
                        document.removeEventListener('keyup', onKeyUp, true);
                        document.removeEventListener('mousedown', onMouseDown, true);
                        document.removeEventListener('mouseup', onMouseUp, true);
                    }, 1000);
                }
                
                (overlay as any).closeDialogMethod = closeDialog;
                document.body.appendChild(overlay);

                confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); if (callback) callback(); });
                cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
                closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
                overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

                function onKeyDown(e: KeyboardEvent) {
                    if (!document.getElementById('quick-upgrade-overlay')) {
                        document.removeEventListener('keydown', onKeyDown, true);
                        return;
                    }
                    if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') { 
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); 
                        if (!isClosing) { isClosing = true; closeDialog(); }
                    } else if (e.key === 'Enter') { 
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); 
                        if (!isClosing) { isClosing = true; closeDialog(); if (callback) callback(); }
                    }
                }

                function onKeyUp(e: KeyboardEvent) {
                    if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'Enter') {
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    }
                }

                function onMouseDown(e: MouseEvent) {
                    if (!document.getElementById('quick-upgrade-overlay')) {
                        document.removeEventListener('mousedown', onMouseDown, true);
                        return;
                    }
                    if (e.button === 3 || e.button === 4) { 
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); 
                        if (!isClosing) { isClosing = true; closeDialog(); }
                    }
                }

                function onMouseUp(e: MouseEvent) {
                    if (e.button === 3 || e.button === 4) {
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    }
                }

                document.addEventListener('keydown', onKeyDown, true);
                document.addEventListener('keyup', onKeyUp, true);
                document.addEventListener('mousedown', onMouseDown, true);
                document.addEventListener('mouseup', onMouseUp, true);
            }

            function performAction(count: number) {
                if (isRunning) return;
                if (!shouldShowQuickButtons()) return;
                showConfirmDialog(count, () => {
                    isRunning = true;
                    upgradeQueue = count;
                    upgraded = 0;
                    function doStep() {
                        if (!isRunning) { finish(); return; }
                        if (!shouldShowQuickButtons()) { finish(); return; }
                        if (upgraded >= upgradeQueue) { finish(); return; }
                        if (isDialogOpen()) {
                            if (isRubyButton()) { clickCancel(); finish(); return; }
                            if (hasNormalButton()) { clickConfirmButton(); upgraded++; timer = window.setTimeout(doStep, DELAY); return; }
                            pressEnter(); upgraded++; timer = window.setTimeout(doStep, DELAY); return;
                        }
                        pressEnter();
                        timer = window.setTimeout(doStep, DELAY);
                    }
                    function finish() {
                        isRunning = false;
                        upgradeQueue = 0;
                        if (timer) { window.clearTimeout(timer); timer = null; }
                    }
                    timer = window.setTimeout(doStep, DELAY);
                });
            }

            function createButtons() {
                const containerNode = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                const panel = containerNode?.parentNode;
                if (!panel) return;
                
                if (!shouldShowQuickButtons()) {
                    const existing = document.getElementById('quick-buttons');
                    if (existing) existing.remove();
                    return;
                }
                if (document.getElementById('quick-buttons')) return;

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
                        if (typeof isRunning !== 'undefined' && !isRunning) performAction(btn.value); 
                    });
                    
                    quickButtonsWrapper.appendChild(el);
                });
                
                panel.appendChild(quickButtonsWrapper);
            }

            return () => {
                if (!utils.getSetting('k_auto_upgrade', false)) return;
                
                if (state.currentScreen !== 'garage') return;

                if (!initialized) {
                    initialized = true;

                    categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 2000);

                    document.addEventListener('click', (e: MouseEvent) => {
                        const target = e.target as HTMLElement;
                        if (!target) return;
                        if (target.closest('#quick-upgrade-overlay')) return;
                        
                        const menuCategory = target.closest('.MenuComponentStyle-mainMenuItem');
                        const mainGarageBlock = target.closest('[class*="MountedItemsStyle-commonBlock"], .tt-garage-paints-button');
                        const itemElement = target.closest('[class*="Item"], [class*="card"], [class*="Garage"]');
                        const backButton = target.closest('.BreadcrumbsComponentStyle-backButton, .IconStyle-iconBackArrow, [class*="backButton" i]');
                        
                        if (menuCategory || mainGarageBlock || backButton) {
                            isCategorySwitch = true;
                            if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                        } else if (itemElement) {
                            isCategorySwitch = false;
                            if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                        }
                        
                        if (menuCategory || mainGarageBlock || itemElement || backButton) {
                            if (isRunning) {
                                isRunning = false;
                                if (timer) { window.clearTimeout(timer); timer = null; }
                            }
                            lastItemSignature = '';
                            const existing = document.getElementById('quick-buttons');
                            if (existing) existing.remove();
                            window.setTimeout(createButtons, 10);
                        }
                    }, true);

                    document.addEventListener('keydown', (e: KeyboardEvent) => {
                        if (document.getElementById('quick-upgrade-overlay')) return; 
                        if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                            isCategorySwitch = true;
                            if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                            lastItemSignature = '';
                        }
                    }, true);

                    document.addEventListener('mousedown', (e: MouseEvent) => {
                        if (document.getElementById('quick-upgrade-overlay')) return; 
                        if (e.button === 3 || e.button === 4) {
                            isCategorySwitch = true;
                            if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                            categorySwitchTimeout = window.setTimeout(() => { isCategorySwitch = false; }, 1000);
                            lastItemSignature = '';
                        }
                    }, true);
                }

                const loader = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
                if (loader) {
                    const overlay = document.getElementById('quick-upgrade-overlay') as any;
                    if (overlay && overlay.closeDialogMethod) overlay.closeDialogMethod();
                }

                if (document.getElementById('quick-upgrade-overlay')) return;

                const container = document.querySelector('.TanksPartBaseComponentStyle-buttonsContainer');
                const nameElement = document.querySelector('.ItemDescriptionComponentStyle-nameItem') || container;
                
                if (container) {
                    const currentSignature = nameElement ? (nameElement.textContent?.trim() || '') : '';
                    if (currentSignature !== lastItemSignature) {
                        lastItemSignature = currentSignature;
                        const existing = document.getElementById('quick-buttons');
                        if (existing) existing.remove();
                    }
                    if (shouldShowQuickButtons()) {
                        if (!document.getElementById('quick-buttons')) createButtons();
                    } else {
                        const existing = document.getElementById('quick-buttons');
                        if (existing) existing.remove();
                    }
                } else {
                    const existing = document.getElementById('quick-buttons');
                    if (existing) existing.remove();
                }
            };
        })(),

        changeCounter: (() => {
            const playerChanges = new Map<string, number>();
            let isUpdating = false;

            const injectStyles = () => {
                const styleId = 'kasp-changed-row-style';
                if (document.getElementById(styleId)) return;
                
                const target = document.head || document.documentElement;
                if (!target) return;

                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    tr.kasp-yellow-row {
                        background-color: rgb(255 238 0 / 25%) !important;
                    }
                `;
                target.appendChild(style);
            };

            if (document.head || document.documentElement) {
                injectStyles();
            } else {
                document.addEventListener('DOMContentLoaded', injectStyles);
            }

            window.addEventListener('message', (e: MessageEvent) => {
                if (e.data && e.data.type === 'kasp:useraction') {
                    const detail = e.data.detail;
                    if (!Array.isArray(detail)) return;

                    if (detail[0] === 'TankUserActionLog' && detail.includes('CHANGE_EQUIPMENT')) {
                        const nickname = detail.find(item => 
                            typeof item === 'string' && 
                            item !== 'TankUserActionLog' && 
                            item !== 'CHANGE_EQUIPMENT' && 
                            item !== 'ALLY' && 
                            item !== 'ENEMIES' &&
                            !item.startsWith('-') &&
                            /[a-zA-Z]/.test(item) &&
                            item.length >= 2 && item.length < 30
                        );

                        if (nickname) {
                            const currentCount = playerChanges.get(nickname) || 0;
                            playerChanges.set(nickname, currentCount + 1);

                            if (document.querySelector('.BattleTabStatisticComponentStyle-container')) {
                                requestAnimationFrame(updateTabUI);
                            }
                        }
                    }
                }
            });

            document.addEventListener('kasp:battle:id', () => {
                playerChanges.clear();
            });

            function updateTabUI() {
                if (isUpdating) return;
                isUpdating = true;

                try {
                    const container = document.querySelector('.BattleTabStatisticComponentStyle-container');
                    if (!container) return;

                    const cells = container.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell');
                    if (!cells.length) return;

                    cells.forEach(cell => {
                        const rawText = cell.textContent || '';
                        const nickname = rawText.replace(/^\[.*?\]\s*/, '').trim();
                        if (!nickname) return;

                        const count = playerChanges.get(nickname) || 0;
                        const row = cell.closest('tr') as HTMLElement;
                        if (!row) return;

                        if (count > 0) {
                            if (!row.classList.contains('kasp-yellow-row')) {
                                row.classList.add('kasp-yellow-row');
                            }
                        } else {
                            if (row.classList.contains('kasp-yellow-row')) {
                                row.classList.remove('kasp-yellow-row');
                            }
                        }
                    });
                } finally {
                    setTimeout(() => { isUpdating = false; }, 30);
                }
            }

            const initObserver = () => {
                if (!document.documentElement) return;
                
                const observer = new MutationObserver(() => {
                    if (isUpdating) return;
                    const container = document.querySelector('.BattleTabStatisticComponentStyle-container');
                    if (container) {
                        requestAnimationFrame(updateTabUI);
                    }
                });

                observer.observe(document.documentElement, { childList: true, subtree: true });
            };

            if (document.documentElement) {
                initObserver();
            } else {
                document.addEventListener('DOMContentLoaded', initObserver);
            }

            return () => {};
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
                'none2': 'sp'
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
                "thunder": { "dk": "https://s.eu.tankionline.com/624/130241/231/170/31247407370544/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/230/164/27006222346434/image.webp", "legacy": "https://s.eu.tankionline.com/545/14701/163/26/27006222440647/image.webp", "gt": "https://s.eu.tankionline.com/603/104200/223/77/30161040124106/image.webp", "ultra": "https://s.eu.tankionline.com/556/23371/256/376/27006222447074/image.webp", "prime": "https://s.eu.tankionline.com/557/14337/235/24/27006221273433/image.webp", "xtHD": "https://s.eu.tankionline.com/617/134472/113/230/30767117003724/image.webp" },
                "tsunami": { "dk": "https://s.eu.tankionline.com/636/15624/303/133/31704534736504/image.webp" },
                "scorpion": { "dk": "https://s.eu.tankionline.com/626/144356/211/215/31331073550674/image.webp", "xtHD": "https://s.eu.tankionline.com/602/142236/225/135/30131263063453/image.webp", "gt": "https://s.eu.tankionline.com/634/160574/373/213/31634137213712/image.webp" },
                "magnum": { "sp": "https://s.eu.tankionline.com/612/43174/244/260/30510637124120/image.webp", "xt": "https://s.eu.tankionline.com/550/75116/121/115/27006222156612/image.webp" },
                "railgun": { "gt": "https://s.eu.tankionline.com/606/155010/246/46/30333202253104/image.webp", "legacy": "https://s.eu.tankionline.com/550/121477/171/157/27006221327105/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/101/240/27006222467365/image.webp", "ultra": "https://s.eu.tankionline.com/557/14216/302/47/27006222235365/image.webp", "prime": "https://s.eu.tankionline.com/554/45667/335/160/27006221506161/image.webp" },
                "gauss": { "xt": "https://s.eu.tankionline.com/560/166470/223/123/27035516206046/image.webp", "prime": "https://s.eu.tankionline.com/554/43164/134/365/27006222545045/image.webp", "gt": "https://s.eu.tankionline.com/613/151460/263/2/30572765264737/image.webp", "ultra": "https://s.eu.tankionline.com/563/60021/200/371/27154004322450/image.webp", "ic": "https://s.eu.tankionline.com/614/101074/51/272/30620217025776/image.webp" },
                "shaft": { "legacy": "https://s.eu.tankionline.com/600/172117/242/22/30036424407361/image.webp", "xt": "https://s.eu.tankionline.com/546/76262/360/74/27006221440464/image.webp", "gt": "https://s.eu.tankionline.com/623/152641/25/44/31172550417505/image.webp" },
                "wasp": { "legacy": "https://s.eu.tankionline.com/577/174061/352/34/27777016754412/image.webp", "xt": "https://s.eu.tankionline.com/544/55321/27/365/27006221715450/image.webp", "gt": "https://s.eu.tankionline.com/620/113057/312/163/31022614272635/image.webp" },
                "hopper": { "dk": "https://s.eu.tankionline.com/634/21124/213/143/31604256121143/image.webp", "xtHD": "https://s.eu.tankionline.com/564/44403/372/46/27221401755636/image.webp", "rt": "https://s.eu.tankionline.com/616/165266/42/215/30735255423342/image.webp" },
                "hornet": { "xtHD": "https://s.eu.tankionline.com/623/132270/76/254/31166456253644/image.webp", "xt": "https://s.eu.tankionline.com/544/23373/367/174/27006221615421/image.webp", "ultra": "https://s.eu.tankionline.com/562/167731/132/2/27135766300240/image.webp", "gt": "https://s.eu.tankionline.com/605/27506/77/266/30245722451746/image.webp", "legacy": "https://s.eu.tankionline.com/554/36653/207/221/27006221767456/image.webp", "sp": "https://s.eu.tankionline.com/636/174463/275/327/31737115153727/image.webp", "dk": "https://s.eu.tankionline.com/626/144360/341/233/31331074463357/image.webp", "prime": "https://s.eu.tankionline.com/553/11125/61/23/27006221422730/image.webp" },
                "viking": { "xtHD": "https://s.eu.tankionline.com/606/162165/343/3/30334435362646/image.webp", "ultra": "https://s.eu.tankionline.com/552/63515/71/331/27006222526007/image.webp", "xt": "https://s.eu.tankionline.com/544/23374/341/44/27006221645475/image.webp", "legacy": "https://s.eu.tankionline.com/545/14701/310/206/27006221256304/image.webp", "gt": "https://s.eu.tankionline.com/603/101654/323/65/30160353152727/image.webp", "dk": "https://s.eu.tankionline.com/624/130241/112/33/31243624274176/image.webp", "prime": "https://s.eu.tankionline.com/557/14335/173/371/27006222537526/image.webp" },
                "crusader": { "xtHD": "https://s.eu.tankionline.com/566/40735/240/67/27310167345113/image.webp", "rt": "https://s.eu.tankionline.com/607/24073/366/376/30345016775402/image.webp" },
                "hunter": { "xt": "https://s.eu.tankionline.com/547/121275/335/127/27006222147461/image.webp", "legacy": "https://s.eu.tankionline.com/577/157474/222/171/27773717262060/image.webp", "sp": "https://s.eu.tankionline.com/632/72364/102/227/31516475423716/image.webp", "gt": "https://s.eu.tankionline.com/607/136171/1/41/30367436201726/image.webp", "prime": "https://s.eu.tankionline.com/554/155740/111/54/27006222537520/image.webp", "ultra": "https://s.eu.tankionline.com/561/116016/365/77/27063403712301/image.webp" },
                "paladin": { "dk": "https://s.eu.tankionline.com/636/15627/202/330/31703345754725/image.webp", "xtHD": "https://s.eu.tankionline.com/573/71447/126/37/31645107310146/image.webp", "rt": "https://s.eu.tankionline.com/577/177107/117/225/27777622013534/image.webp" },
                "dictator": { "xt": "https://s.eu.tankionline.com/553/20722/371/101/27006221171476/image.webp", "sp": "https://s.eu.tankionline.com/621/140410/154/251/31070103077064/image.webp", "legacy": "https://s.eu.tankionline.com/600/172117/242/15/31364321620222/image.webp", "gt": "https://s.eu.tankionline.com/606/154745/266/2/30333172146453/image.webp" },
                "titan": { "xt": "https://s.eu.tankionline.com/545/43351/66/26/27006222061714/image.webp", "prime": "https://s.eu.tankionline.com/555/103066/317/332/27006222042503/image.webp", "gt": "https://s.eu.tankionline.com/623/45322/65/215/31151265113717/image.webp", "sp": "https://s.eu.tankionline.com/612/43367/221/355/30510675712024/image.webp", "legacy": "https://s.eu.tankionline.com/601/170515/147/372/30076123372407/image.webp" },
                "ares": { "dk": "https://s.eu.tankionline.com/626/144353/222/354/31331072771326/image.webp", "xtHD": "https://s.eu.tankionline.com/562/161156/242/234/31331074061754/image.webp", "rt": "https://s.eu.tankionline.com/626/36656/275/136/31307553605617/image.webp" },
                "mammoth": { "xt": "https://s.eu.tankionline.com/544/131126/51/354/27006221626237/image.webp", "sp": "https://s.eu.tankionline.com/573/113617/26/345/27562743700674/image.webp", "gt": "https://s.eu.tankionline.com/617/166341/256/13/30775470330175/image.webp", "legacy": "https://s.eu.tankionline.com/557/31406/53/112/27006222625462/image.webp", "ultra": "https://s.eu.tankionline.com/571/77135/256/372/27457627403320/image.webp" }
            };

            function getSavedSkins() {
                try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } 
                catch (e) { return {}; }
            }

            function getDefaultImages() {
                try { return Object.assign({}, PREFILLED_DEFAULTS, JSON.parse(localStorage.getItem(BASE_IMG_KEY)) || {}); } 
                catch (e) { return PREFILLED_DEFAULTS; }
            }

            function getItemNameByUrl(url, defaultsMap) {
                for (const [name, defUrl] of Object.entries(defaultsMap)) {
                    if (defUrl === url) return name;
                }
                for (const [name, brands] of Object.entries(SKINS_DATABASE)) {
                    for (const brandUrl of Object.values(brands)) {
                        if (brandUrl === url) return name;
                    }
                }
                return null;
            }

            return () => {
                if (state.currentScreen !== 'garage') return;

                const savedSkins = getSavedSkins();
                const defaultImages = getDefaultImages();
                let defaultsUpdated = false;
                let skinsUpdated = false;

                // 1. СОХРАНЕНИЕ СКИНА (Больше никаких задержек и ложных срабатываний)
                const nameEl = document.querySelector('.ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span');
                
                if (nameEl) {
                    const rawName = nameEl.textContent.trim().toLowerCase();
                    const firstWord = rawName.split(/\s+/)[0];
                    const itemNameEN = NAME_TRANSLATE[firstWord] || firstWord;

                    // КЛЮЧЕВОЙ МОМЕНТ: Ищем СТРОГО в ячейке скина, полностью игнорируя иконки устройств!
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

                    if (foundBrand) {
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
                    }
                }

                if (skinsUpdated) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
                }

                // 2. ОБРАБОТКА НИЖНЕЙ КАРУСЕЛИ И САМООБУЧЕНИЕ БАЗЫ
                const garageItems = document.querySelectorAll('.garage-item');
                garageItems.forEach((item) => {
                    const titleSpan = item.querySelector('.GarageItemComponentStyle-descriptionDevice span');
                    const imgMain = item.querySelector<HTMLImageElement>('.GarageItemComponentStyle-mainImg');

                    if (titleSpan && imgMain) {
                        const rawTitle = titleSpan.textContent.trim().toLowerCase();
                        const itemNameRU = rawTitle.split(/\s+/)[0];
                        const itemNameEN = NAME_TRANSLATE[itemNameRU] || itemNameRU;

                        const currentSrc = imgMain.getAttribute('src') || '';
                        const customSkinsArray = Object.values(SKINS_DATABASE[itemNameEN] || {});
                        
                        if (currentSrc && !customSkinsArray.includes(currentSrc)) {
                            if (defaultImages[itemNameEN] !== currentSrc) {
                                defaultImages[itemNameEN] = currentSrc;
                                defaultsUpdated = true;
                            }
                        }

                        const targetSkinSrc = savedSkins[itemNameEN];
                        if (targetSkinSrc) {
                            if (currentSrc !== targetSkinSrc) {
                                imgMain.setAttribute('src', targetSkinSrc);
                                imgMain.style.objectFit = 'contain';
                            }
                        } else {
                            const defSrc = defaultImages[itemNameEN];
                            if (defSrc && currentSrc !== defSrc) {
                                imgMain.setAttribute('src', defSrc);
                            }
                            imgMain.style.objectFit = '';
                        }
                    }
                });

                if (defaultsUpdated) {
                    localStorage.setItem(BASE_IMG_KEY, JSON.stringify(defaultImages));
                }

                // 3. ОБРАБОТКА ОБЗОРНОГО ЭКРАНА И ПРАВОЙ ПАНЕЛИ
                const equippedBlocks = document.querySelectorAll('.MountedItemsStyle-commonBlockForTurretsHulls, .MountedItemsStyle-commonBlockForTurretsWeapon');
                
                equippedBlocks.forEach(block => {
                    const previewImg = block.querySelector('.MountedItemsStyle-itemPreview');
                    if (!previewImg) return;

                    const currentSrc = previewImg.getAttribute('src') || '';
                    const itemNameEN = getItemNameByUrl(currentSrc, defaultImages);
                    
                    if (itemNameEN) {
                        let brandKey = 'default';
                        
                        // Ищем иконку СТРОГО в специальной ячейке скинов (игнорируем MountedItemsStyle-deviceIcon)
                        const skinIcons = block.querySelectorAll('.SkinsIconComponentStyle-cellSkins img');
                        for (const img of skinIcons) {
                            const svgSrc = img.getAttribute('src') || '';
                            if (SKIN_BRANDS_MAP[svgSrc]) {
                                brandKey = SKIN_BRANDS_MAP[svgSrc];
                                break;
                            } else if (svgSrc.includes('ic_standard') || svgSrc.includes('standard')) {
                                brandKey = 'default';
                                break;
                            }
                        }

                        if (brandKey !== 'default' && SKINS_DATABASE[itemNameEN] && SKINS_DATABASE[itemNameEN][brandKey]) {
                            const targetSkinUrl = SKINS_DATABASE[itemNameEN][brandKey];
                            if (currentSrc !== targetSkinUrl) {
                                previewImg.setAttribute('src', targetSkinUrl);
                                (previewImg as HTMLImageElement).style.objectFit = 'contain';
                            }
                        } else {
                            const defSrc = defaultImages[itemNameEN];
                            if (defSrc && currentSrc !== defSrc) {
                                previewImg.setAttribute('src', defSrc);
                                (previewImg as HTMLImageElement).style.objectFit = '';
                            }
                        }
                    }
                });
            };
        })(),
    };

    const masterObserver = new MutationObserver(() => {
        state.lang = utils.getLang();
        
        if (document.querySelector('.ApplicationLoaderComponentStyle-container.-background')) {
            state.currentScreen = 'loading';
        } else if (document.querySelector('.BattleHudComponentStyle-container')) {
            state.currentScreen = 'battle';
        } else if (document.querySelector('.GarageCommonStyle-positionContent, .GarageItemComponent-container')) {
            state.currentScreen = 'garage';
        } else if (document.querySelector('.MainScreenComponentStyle-blockMainMenu')) {
            state.currentScreen = 'lobby';
        } else if (document.querySelector('.BattleResultHeaderComponentStyle-resultText')) {
            state.currentScreen = 'match_results';
        }

        state.friendsMenuOpen = !!document.querySelector('.FriendListComponentStyle-containerFriends, .InvitationWindowsComponentStyle-centerBlock');

        const settingsBlock = document.querySelector('.SettingsComponentStyle-blockContentOptions');
        if (settingsBlock) {
            if (!state.settingsOpen) {
                state.settingsOpen = true;
                coreSettings.inject();
            }
        } else {
            if (state.settingsOpen) {
                state.settingsOpen = false;
                coreSettings.onClose();
            }
        }

        modules.welcomeModal();
        modules.customCurrencyUI();
        modules.hideNickname();
        modules.hideCurrency();
        modules.changeCounter();

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
                modules.garageButtons();
                modules.customGarageSkins();

            }
        } catch (e) {
            console.error("[Kaspersky's Inventions] Ошибка в модуле:", e);
        }
    });

    const boot = () => {
        state.lang = utils.getLang();
        masterObserver.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.documentElement) {
        boot();
    } else {
        document.addEventListener('DOMContentLoaded', boot);
    }

})();