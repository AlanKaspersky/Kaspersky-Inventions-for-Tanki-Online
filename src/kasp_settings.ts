(function () {
    'use strict';

    let needsReload = false;
    let settingsWereOpen = false;

    let initialSettingsState: Record<string, boolean> = {};

    function getLang(): string {
        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().includes('ru')) return 'RU';
        if (window.location.hostname.includes('ru.')) return 'RU';
        return 'EN';
    }

    const t: any = {
        RU: { title: 'НАСТРОЙКИ KASPERSKY\'S INVENTIONS', tooltip: 'ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА' },
        EN: { title: 'KASPERSKY\'S INVENTIONS SETTINGS', tooltip: 'REQUIRES RELOAD' }
    };

    const MY_SETTINGS = [
        { id: 'k_ext_btn', label: { RU: 'Расширенная кнопка «Играть»', EN: 'Enhanced «Play» button' }, default: false },
        { id: 'k_history', label: { RU: 'История боёв', EN: 'Battle history' }, default: false },
        { id: 'k_augments', label: { RU: 'Характеристики устройств', EN: 'Augment specifications' }, default: false },
        { id: 'k_auto_upgrade', label: { RU: 'Быстрое улучшение вооружения', EN: 'Quick weapon upgrades' }, default: false },
        { id: 'k_friends', label: { RU: 'Метки и категории друзей', EN: 'Friend tags & categories' }, default: false },
        { id: 'k_paints', label: { RU: 'Умный поиск красок', EN: 'Smart paint search' }, default: false },
        { id: 'k_hideCurrency', label: { RU: 'Скрыть валюту', EN: 'Hide currency' }, default: false },
        { id: 'k_hideNicknameXP', label: { RU: 'Скрыть никнейм и опыт', EN: 'Hide nickname and score' }, default: false }
    ];

    function getSetting(id: string, def: boolean): boolean {
        const val = localStorage.getItem(id);
        return val !== null ? val === 'true' : def;
    }

    const CSS = `
        @keyframes catchSettings { from { outline-color: transparent; } to { outline-color: transparent; } }
        .SettingsComponentStyle-blockContentOptions { animation: catchSettings 0.001s; }
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
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    if (document.head) document.head.appendChild(styleEl);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(styleEl));

    function showWarningDialog(callback: () => void) {
        const existing = document.getElementById('kasp-warning-overlay');
        if (existing) existing.remove();

        const lang = getLang();
        const tWarn: any = {
            RU: { title: 'ПРЕДУПРЕЖДЕНИЕ', text: 'Включение этой функции сломает Историю битв и раздел Кланы в друзьях, а также возможны просадки ФПС. Вы уверены, что хотите продолжить?', cancel: 'ОТМЕНА', confirm: 'ВКЛЮЧИТЬ' },
            EN: { title: 'WARNING', text: 'Enabling this feature will break Battle History and the Clans section in Friends, and may also result in FPS drops. Are you sure you want to continue?', cancel: 'CANCEL', confirm: 'ENABLE' }
        };

        const overlay = document.createElement('div');
        overlay.id = 'kasp-warning-overlay';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 99999; display: flex; align-items: center; justify-content: center;`;

        const dialog = document.createElement('div');
        dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75)`;

        const header = document.createElement('div');
        header.style.cssText = `display: flex; align-items: center; justify-content: space-between; background-color: transparent; width: 100%; position: relative; margin-bottom: 1.5em;`;

        const title = document.createElement('h1');
        title.textContent = tWarn[lang].title;
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
        textSpan.textContent = tWarn[lang].text;
        textSpan.style.cssText = `font-size: 1em; color: rgb(255, 255, 255); font-family: BaseFont, FallbackFont, sans-serif; line-height: 1.4;`;

        content.appendChild(textSpan);

        const footer = document.createElement('div');
        footer.style.cssText = `background-color: transparent; width: 100%; display: flex; align-items: center; justify-content: center; gap: 1.25em;`;

        const cancelBtn = document.createElement('div');
        cancelBtn.textContent = tWarn[lang].cancel;
        cancelBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgba(255, 255, 255, 0.15); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.borderColor = 'rgb(255, 255, 255)'; cancelBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.borderColor = 'transparent'; cancelBtn.style.boxShadow = 'none'; });

        const confirmBtn = document.createElement('div');
        confirmBtn.textContent = tWarn[lang].confirm;
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
            if (document.querySelector('.ApplicationLoaderComponentStyle-container.-background')) {
                closeDialog();
            }
        });
        loaderObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

        function closeDialog() {
            if (!overlay.parentNode) return;
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('mousedown', onMouseDown, true);
            loaderObserver.disconnect();
        }

        confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); if (callback) callback(); });
        cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDialog(); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                closeDialog();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                closeDialog();
                if (callback) callback();
                return;
            }
        }

        function onMouseDown(e: MouseEvent) {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                closeDialog();
            }
        }

        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('mousedown', onMouseDown, true);
    }

    function injectSettingsTab() {
        const mainBlock = document.querySelector('.SettingsComponentStyle-blockContentOptions');
        if (!mainBlock) return;

        const ulMenu = mainBlock.querySelector('ul');
        if (!ulMenu || document.getElementById('kaspersky-tab')) return;

        const lang = getLang();
        const dict = t[lang];

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
            const isChecked = getSetting(setting.id, setting.default);
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

        kContent.querySelectorAll('.kasp-toggle-row').forEach(row => {
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
                    needsReload = MY_SETTINGS.some(s => {
                        const currentVal = getSetting(s.id, s.default);
                        return currentVal !== initialSettingsState[s.id];
                    });
                };

                if (id === 'k_hideNicknameXP' && !isCurrentlyChecked) {
                    showWarningDialog(() => {
                        performToggle();
                    });
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
    }

    function checkSettingsState() {
        const mainBlock = document.querySelector('.SettingsComponentStyle-blockContentOptions');
        if (!mainBlock) {
            if (settingsWereOpen) {
                settingsWereOpen = false;
                const tooltip = document.getElementById('kaspersky-reload-tooltip');
                if (tooltip) tooltip.classList.add('kasp-hidden');
                if (needsReload) window.location.reload();
            }
        } else {
            if (!document.getElementById('kaspersky-tab')) {
                settingsWereOpen = true;
                injectSettingsTab();
            }
        }
    }

    document.addEventListener('animationstart', (e) => {
        if (e.animationName === 'catchSettings') {
            settingsWereOpen = true;
            injectSettingsTab();
        }
    });

    setInterval(checkSettingsState, 100);
})();