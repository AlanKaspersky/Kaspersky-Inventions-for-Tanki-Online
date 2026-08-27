"use strict";
(function () {
    'use strict';
    if (localStorage.getItem('k_augments') === 'false')
        return;
    let isRunning = false;
    let upgradeQueue = 0;
    let upgraded = 0;
    let timer = null;
    let lastItemSignature = '';
    let isCategorySwitch = true;
    let categorySwitchTimeout = setTimeout(() => { isCategorySwitch = false; }, 2000);
    const DELAY = 30;
    function getLang() {
        return document.documentElement.lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    function pressEnter() {
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
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
            if (headerText.includes('рубин') || headerText.includes('ruby')) {
                return true;
            }
        }
        const btn = document.querySelector('.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton');
        if (!btn)
            return false;
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('за ') ||
            text.includes('for ') ||
            text.includes('рубин') ||
            text.includes('ruby') ||
            text.includes('получить') ||
            text.includes('get')) {
            return true;
        }
        const rubyImg = btn.querySelector('img[src*="rubyBlack"], img[src*="ruby"]');
        if (rubyImg) {
            return true;
        }
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
                if (text === 'ЗАВЕРШЕНО' || text === 'COMPLETED') {
                    return true;
                }
            }
        }
        return false;
    }
    function isMaxLevel() {
        return !!document.querySelector('.TanksPartBaseComponentStyle-marginTop .-buttonEstablished');
    }
    function shouldShowQuickButtons() {
        if (localStorage.getItem('k_auto_upgrade') === 'false')
            return false;
        if (isCompleted() || isMaxLevel())
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
                        if (!bgImage.includes('ruby')) {
                            return true;
                        }
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
        const lang = getLang();
        const t = {
            ru: {
                title: 'БЫСТРАЯ ПРОКАЧКА',
                textPre: 'Вы собираетесь купить улучшение на\u00A0',
                steps: ' шагов',
                maxSteps: 'максимум шагов',
                cancel: 'Отмена',
                buy: 'КУПИТЬ'
            },
            en: {
                title: 'FAST UPGRADE',
                textPre: 'You are about to buy an upgrade for\u00A0',
                steps: ' steps',
                maxSteps: 'max steps',
                cancel: 'Cancel',
                buy: 'BUY'
            }
        };
        const label = count === Infinity ? t[lang].maxSteps : `${count}${t[lang].steps}`;
        const overlay = document.createElement('div');
        overlay.id = 'quick-upgrade-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        const dialog = document.createElement('div');
        dialog.id = 'quick-upgrade-dialog';
        dialog.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: space-between;
            pointer-events: auto;
            min-width: 31.625em;
            max-width: 31.625em;
            width: auto;
            min-height: 14.125em;
            z-index: 60;
            box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px;
            outline: rgba(255, 255, 255, 0.25) solid 0.063em;
            padding: 2em;
            background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75);
        `;
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: transparent;
            width: 100%;
            position: relative;
            margin-bottom: 1.5em;
        `;
        const title = document.createElement('h1');
        title.textContent = t[lang].title;
        title.style.cssText = `
            font-size: 1.5em;
            color: rgb(255, 255, 255);
            font-family: BaseFontBold, FallbackFontBold, sans-serif;
            font-weight: 500;
            margin: 0;
            padding: 0;
            line-height: 1.2;
            flex: 1;
        `;
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            width: 1.5em;
            height: 1.5em;
            cursor: pointer;
            background-image: url(/browser-public/static/images/iconDelete.b879b0ab.svg);
            background-repeat: no-repeat;
            background-size: contain;
            background-position: center center;
            flex-shrink: 0;
            margin-left: 0.5em;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundImage = 'url(/browser-public/static/images/deleteHoverModal.3aceb055.svg)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundImage = 'url(/browser-public/static/images/iconDelete.b879b0ab.svg)';
        });
        header.appendChild(title);
        header.appendChild(closeBtn);
        const content = document.createElement('div');
        content.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            flex: 1;
            margin-bottom: 1.5em;
        `;
        const textLine = document.createElement('div');
        textLine.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
        `;
        const textSpan = document.createElement('span');
        textSpan.textContent = t[lang].textPre;
        textSpan.style.cssText = `
            font-size: 1em;
            color: rgb(255, 255, 255);
            font-family: BaseFont, FallbackFont, sans-serif;
            line-height: 1.4;
        `;
        const countSpan = document.createElement('span');
        countSpan.textContent = label;
        countSpan.style.cssText = `
            font-size: 1em;
            color: rgb(255, 255, 0);
            font-family: BaseFontBold, FallbackFontBold, sans-serif;
            font-weight: 500;
            line-height: 1.4;
        `;
        textLine.appendChild(textSpan);
        textLine.appendChild(countSpan);
        content.appendChild(textLine);
        const footer = document.createElement('div');
        footer.style.cssText = `
            background-color: transparent;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1.25em;
        `;
        const cancelBtn = document.createElement('div');
        cancelBtn.textContent = t[lang].cancel;
        cancelBtn.style.cssText = `
            width: 12.375em;
            height: 3em;
            text-align: center;
            border-radius: 0.75em;
            cursor: pointer;
            background-color: rgba(255, 255, 255, 0.15);
            border: 0.063em solid transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgb(255, 255, 255);
            font-family: BaseFontBold, FallbackFontBold, sans-serif;
            font-style: normal;
            font-weight: 500;
            font-size: 1em;
            line-height: 1.2;
            text-transform: uppercase;
            white-space: nowrap;
            padding: 0.2em 1.8em;
            box-sizing: border-box;
            flex-shrink: 0;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.borderColor = 'rgb(255, 255, 255)';
            cancelBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.borderColor = 'transparent';
            cancelBtn.style.boxShadow = 'none';
        });
        const confirmBtn = document.createElement('div');
        confirmBtn.textContent = t[lang].buy;
        confirmBtn.style.cssText = `
            width: 12.375em;
            height: 3em;
            text-align: center;
            border-radius: 0.75em;
            cursor: pointer;
            background-color: rgb(118, 255, 51);
            border: 0.063em solid transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgb(0, 25, 38);
            font-family: BaseFontBold, FallbackFontBold, sans-serif;
            font-style: normal;
            font-weight: 500;
            font-size: 1em;
            line-height: 1.2;
            text-transform: uppercase;
            white-space: nowrap;
            padding: 0.2em 1.8em;
            box-sizing: border-box;
            flex-shrink: 0;
        `;
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.borderColor = 'rgb(255, 255, 255)';
            confirmBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.borderColor = 'transparent';
            confirmBtn.style.boxShadow = 'none';
        });
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        overlay.closeDialogMethod = closeDialog;
        document.body.appendChild(overlay);
        function closeDialog() {
            if (!overlay.parentNode)
                return;
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        }
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
            if (callback)
                callback();
        });
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });
        function onKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
                if (callback)
                    callback();
                return;
            }
        }
        document.addEventListener('keydown', onKeyDown, true);
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
                if (!shouldShowQuickButtons()) {
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
                        timer = setTimeout(doStep, DELAY);
                        return;
                    }
                    pressEnter();
                    upgraded++;
                    timer = setTimeout(doStep, DELAY);
                    return;
                }
                pressEnter();
                timer = setTimeout(doStep, DELAY);
            }
            function finish() {
                isRunning = false;
                upgradeQueue = 0;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            }
            timer = setTimeout(doStep, DELAY);
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
        if (isCategorySwitch) {
            quickButtonsWrapper.className = 'GarageCommonStyle-animatedBlurredRightBlock';
        }
        quickButtonsWrapper.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.3em;
            margin-top: 0.28em;
            width: 100%;
            margin-left: 0.12em;
            box-sizing: border-box;
        `;
        const buttons = [
            { label: 'X5', value: 5 },
            { label: 'X10', value: 10 },
            { label: 'X15', value: 15 },
            { label: 'MAX', value: Infinity }
        ];
        const lang = getLang();
        const tooltipMax = lang === 'ru' ? 'Прокачать до максимума' : 'Upgrade to max';
        const tooltipSteps = lang === 'ru' ? 'Прокачать {n} раз' : 'Upgrade {n} times';
        buttons.forEach(btn => {
            const el = document.createElement('div');
            el.className = 'SquarePriceButtonComponentStyle-commonBlockButton -commonButtonUpdate -flexCenterAlignCenter -displayFlex -alignCenter GarageCommonStyle-bigActionButton';
            el.style.cssText = `
                cursor: pointer;
                background: transparent;
                border: 0.063em solid rgba(255, 255, 255, 0.25);
                border-radius: 0.75em;
                display: flex;
                min-width: 0;
                align-items: center;
                justify-content: center;
                height: 3em;
                box-sizing: border-box;
            `;
            el.addEventListener('mouseenter', () => {
                el.style.borderColor = 'rgb(255, 255, 255)';
                el.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                el.style.boxShadow = 'none';
            });
            const span = document.createElement('span');
            span.style.cssText = `
                color: #bfd5ff;
                font-size: 1.4em;
                font-weight: 700;
                font-family: Arial, sans-serif;
                letter-spacing: 0.3px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                white-space: nowrap;
            `;
            span.textContent = btn.label;
            el.appendChild(span);
            el.title = btn.value === Infinity ? tooltipMax : tooltipSteps.replace('{n}', btn.value.toString());
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isRunning) {
                    performAction(btn.value);
                }
            });
            quickButtonsWrapper.appendChild(el);
        });
        panel.appendChild(quickButtonsWrapper);
    }
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
                clearTimeout(categorySwitchTimeout);
            categorySwitchTimeout = setTimeout(() => { isCategorySwitch = false; }, 1000);
        }
        else if (itemElement) {
            isCategorySwitch = false;
            if (categorySwitchTimeout)
                clearTimeout(categorySwitchTimeout);
        }
        if (menuCategory || mainGarageBlock || itemElement || backButton) {
            if (isRunning) {
                isRunning = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            }
            lastItemSignature = '';
            const existing = document.getElementById('quick-buttons');
            if (existing)
                existing.remove();
            setTimeout(createButtons, 10);
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                return;
            isCategorySwitch = true;
            if (categorySwitchTimeout)
                clearTimeout(categorySwitchTimeout);
            categorySwitchTimeout = setTimeout(() => { isCategorySwitch = false; }, 1000);
            lastItemSignature = '';
        }
    }, true);
    document.addEventListener('mousedown', (e) => {
        if (e.button === 3 || e.button === 4) {
            isCategorySwitch = true;
            if (categorySwitchTimeout)
                clearTimeout(categorySwitchTimeout);
            categorySwitchTimeout = setTimeout(() => { isCategorySwitch = false; }, 1000);
            lastItemSignature = '';
        }
    }, true);
    function isBattleActive() {
        return !!document.querySelector('[class*="BattleHud"], [class*="BattleScreen"]');
    }
    const observer = new MutationObserver(() => {
        if (isBattleActive())
            return;
        if (localStorage.getItem('k_auto_upgrade') === 'false')
            return;
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
    });
    const observerConfig = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] };
    const attachObserver = () => {
        const rootContainer = document.getElementById('app-root') || document.body;
        if (rootContainer)
            observer.observe(rootContainer, observerConfig);
    };
    if (document.body || document.getElementById('app-root'))
        attachObserver();
    else
        document.addEventListener('DOMContentLoaded', attachObserver);
})();
