import { state } from './state';
import { utils } from './utils';
import { setupNicknamePrivacy } from '../modules/hideNickname';

export const coreSettings = (() => {
    let needsReload = false;
        let initialSettingsState: Record<string, boolean> = {};
        let stylesInjected = false;

        const t: any = {
            RU: {
                title: 'НАСТРОЙКИ KASPERSKY\'S INVENTIONS', tooltip: 'ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА'
            },
            EN: {
                title: 'KASPERSKY\'S INVENTIONS SETTINGS', tooltip: 'REQUIRES RELOAD'
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

        return {
            inject: () => {
                if (!stylesInjected) {
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
                                utils.setSetting(id, false);
                            } else {
                                rowEl.classList.add('kasp-active');
                                utils.setSetting(id, true);
                            }
                            needsReload = MY_SETTINGS.some(s => {
                                const currentVal = utils.getSetting(s.id, s.default);
                                return currentVal !== initialSettingsState[s.id];
                            });
                        };

                        performToggle();
                        if (id === 'k_hideNicknameXP') {
                            if (!isCurrentlyChecked) setupNicknamePrivacy();
                            else document.documentElement.classList.remove('kasp-hide-nickname');
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

                if (needsReload) window.location.reload();
            }
        };
    })();;
