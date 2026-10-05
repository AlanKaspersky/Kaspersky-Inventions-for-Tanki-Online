import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { createKaspModal } from '../core/modal';

export const autoUpgrade = (() => {
    let initialized = false;
    let isRunning = false;
    let upgradeQueue = 0;
    let unavailableRetries = 0;
    const MAX_UNAVAILABLE_RETRIES = 80;
    const RETRY_DELAY = 100;
    let upgraded = 0;
    let timer: number | null = null;
    let lastItemSignature = '';
    let isCategorySwitch = true;
    let categorySwitchTimeout: number | null = null;
    const DELAY = 30;

    function pressEnter() {
        const event = new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
        });
        document.dispatchEvent(event);
        return true;
    }

    function isDialogOpen() {
        return !!document.querySelector(gameDOM.dialogs.container);
    }

    function isRubyButton() {
        const dialog = document.querySelector(gameDOM.dialogs.container);
        if (dialog) {
            const headerText = dialog.querySelector('h1')?.textContent?.toLowerCase() || '';
            if (headerText.includes('рубин') || headerText.includes('ruby')) return true;
        }
        const btn = document.querySelector(gameDOM.dialogs.confirmation);
        if (!btn) return false;
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('за ') || text.includes('for ') || text.includes('рубин') || text.includes('ruby') || text.includes('получить') || text.includes('get')) return true;
        const rubyImg = btn.querySelector(gameDOM.dialogs.rubyImage);
        if (rubyImg) return true;
        return false;
    }

    function hasNormalButton() {
        const btn = document.querySelector(gameDOM.dialogs.confirmation);
        if (!btn) return false;
        return !isRubyButton();
    }

    function clickConfirmButton() {
        const btn = document.querySelector(gameDOM.dialogs.confirmation) as HTMLElement;
        if (btn) { btn.click(); return true; }
        return false;
    }

    function clickCancel() {
        const buttons = document.querySelectorAll(gameDOM.dialogs.contents);
        for (let i = 0; i < buttons.length; i++) {
            const el = buttons[i] as HTMLElement;
            const text = el.textContent?.trim().toLowerCase() || '';
            if (text === 'отмена' || text === 'cancel') { el.click(); return true; }
        }
        const btn = document.querySelector(gameDOM.dialogs.cancelKey) as HTMLElement;
        if (btn) { btn.click(); return true; }
        return false;
    }

    function isCompleted() {
        const btns = document.querySelectorAll(gameDOM.garage.priceButton);
        for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            const span = btn.querySelector(gameDOM.common.boldSpan);
            if (span) {
                const text = span.textContent?.trim().toUpperCase() || '';
                if (text === 'ЗАВЕРШЕНО' || text === 'COMPLETED') return true;
            }
        }
        return false;
    }

    function isUnavailableButton() {
        const btns = document.querySelectorAll(gameDOM.garage.priceButton);
        for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            if (btn.closest(gameDOM.garage.mountContainer))
                continue;
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('недоступно') || text.includes('unavailable'))
                return true;
        }
        return false;
    }

    function isMaxLevel() {
        if (document.querySelector(gameDOM.garage.established)) return true;

        const titleNodes = document.querySelectorAll(gameDOM.garage.upgradeTitles);
        for (let i = 0; i < titleNodes.length; i++) {
            const text = titleNodes[i].textContent?.trim().toUpperCase() || '';
            if (/(MK|МК)7[- ]?20/.test(text)) return true;
            if (/(УР|LVL)[- ]?(20|45)/.test(text)) return true;
            if (text.includes('MAX')) return true;
        }

        const maxBtn = document.querySelector(gameDOM.garage.maxPriceTitle);
        if (maxBtn && maxBtn.textContent?.trim().toUpperCase() === 'MAX') return true;

        return false;
    }

    function shouldShowQuickButtons() {
        if (!utils.getSetting('k_auto_upgrade', false)) return false;

        if (isMaxLevel()) return false;

        if (isCompleted()) return false;

        const buttonsContainer = document.querySelector(gameDOM.garage.actionContainer);
        if (!buttonsContainer) return false;
        const btns = buttonsContainer.querySelectorAll(gameDOM.garage.priceButton);
        for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            if (btn.closest(gameDOM.garage.mountContainer)) continue;
            const hotkey = btn.querySelector(gameDOM.common.hotkey);
            if (hotkey && hotkey.textContent?.trim() === 'Enter') {
                if (btn.classList.contains(gameDOM.classes.wideGarageButton)) {
                    const coinIcon = btn.querySelector(gameDOM.garage.coinIcon);
                    if (coinIcon) {
                        const bgImage = window.getComputedStyle(coinIcon).backgroundImage;
                        if (!bgImage.includes('ruby')) return true;
                    }
                }
            }
        }
        return false;
    }

    async function showConfirmDialog(count: number, callback: () => void) {
        const lang = state.lang;
        const t: any = {
            RU: { title: 'БЫСТРАЯ ПРОКАЧКА', textPre: 'Вы собираетесь купить улучшение на\u00A0', steps: ' шагов', maxSteps: 'максимум шагов', cancel: 'Отмена', buy: 'КУПИТЬ' },
            EN: { title: 'FAST UPGRADE', textPre: 'You are about to buy an upgrade for\u00A0', steps: ' steps', maxSteps: 'max steps', cancel: 'Cancel', buy: 'BUY' }
        };
        const dict = t[lang] || t['EN'];
        const label = count === Infinity ? dict.maxSteps : `${count}${dict.steps}`;
        const modal = await createKaspModal({ id: 'quick-upgrade-overlay', title: dict.title, closeLabel: dict.cancel });
        if (!modal) return;
        modal.dialog.id = 'quick-upgrade-dialog';
        modal.body.classList.add('kasp-modal-body--center');
        modal.actions.classList.add('kasp-modal-actions--center');

        const textLine = document.createElement('p');
        textLine.className = 'kasp-modal-copy kasp-modal-copy--center';
        const textSpan = document.createElement('span');
        textSpan.textContent = dict.textPre;
        const countSpan = document.createElement('strong');
        countSpan.className = 'kasp-modal-emphasis';
        countSpan.textContent = label;
        textLine.append(textSpan, countSpan);
        modal.body.appendChild(textLine);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'kasp-modal-button kasp-modal-button--secondary';
        const cancelLabel = document.createElement('span');
        cancelLabel.textContent = dict.cancel;
        cancelBtn.appendChild(cancelLabel);
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'kasp-modal-button';
        const confirmLabel = document.createElement('span');
        confirmLabel.textContent = dict.buy;
        confirmBtn.appendChild(confirmLabel);
        modal.actions.append(cancelBtn, confirmBtn);

        let isClosing = false;
        const closeDialog = () => {
            if (isClosing) return;
            isClosing = true;
            modal.close();
        };
        modal.onClose(() => {
            isClosing = true;
            document.removeEventListener('keydown', onKeyDown, true);
            window.setTimeout(() => document.removeEventListener('keyup', onKeyUp, true), 700);
        });

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' || isClosing) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeDialog();
            callback();
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === 'Escape' || event.code === 'KeyZ' || event.key?.toLowerCase() === 'z') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        };

        confirmBtn.addEventListener('click', () => {
            if (isClosing) return;
            closeDialog();
            callback();
        });
        cancelBtn.addEventListener('click', closeDialog);
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keyup', onKeyUp, true);
    }

    function performAction(count) {
        if (isRunning) return;
        if (!shouldShowQuickButtons()) return;

        showConfirmDialog(count, () => {
            isRunning = true;
            upgradeQueue = count;
            upgraded = 0;
            let isWaitingForDialogClose = false;

            function doStep() {
                if (!isRunning) { finish(); return; }

                if (isWaitingForDialogClose) {
                    if (isDialogOpen()) {
                        timer = window.setTimeout(doStep, DELAY);
                        return;
                    }
                    isWaitingForDialogClose = false;
                }

                if (isMaxLevel()) { finish(); return; }
                if (isCompleted() && !isDialogOpen()) { finish(); return; }

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
                        if (!clickConfirmButton()) { finish(); return; }
                        upgraded++;
                        isWaitingForDialogClose = true;
                        timer = window.setTimeout(doStep, DELAY);
                        return;
                    }
                    // An unknown dialog must remain under the user's control.
                    finish();
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
        const containerNode = document.querySelector(gameDOM.garage.actionContainer);
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
            quickButtonsWrapper.className = gameDOM.classes.upgradeTransition;
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

            el.className = gameDOM.classes.upgradeButton;

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

            document.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof Element))
                    return;
                if (target.closest('#quick-upgrade-overlay'))
                    return;

                let menuCategory = target.closest(gameDOM.navigation.garageCategory);

                if (menuCategory && menuCategory.classList.contains(gameDOM.classes.activeMenu)) {
                    menuCategory = null;
                }

                const mainGarageBlock = target.closest(gameDOM.navigation.mountedBlock);
                const itemElement = target.closest(gameDOM.navigation.equipmentItem);
                const backButton = target.closest(gameDOM.navigation.backControls);

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

        const loader = document.querySelector(gameDOM.screens.loadingBackground);
        if (loader) {
            const overlay = document.getElementById('quick-upgrade-overlay') as any;
            if (overlay && overlay.closeDialogMethod) overlay.closeDialogMethod();
        }

        if (document.getElementById('quick-upgrade-overlay')) return;

        const container = document.querySelector(gameDOM.garage.actionContainer);
        const nameElement = document.querySelector(gameDOM.garage.itemName) || container;

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
})();
