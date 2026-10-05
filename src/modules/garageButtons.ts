import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';

export const garageButtons = (() => {
    const ICONS = {
        UPGRADE: "https://s.eu.tankionline.com/static/images/max_level.e31e0825.svg",
        MOUNT: "https://s.eu.tankionline.com/static/images/ic_mount.4175dc0c.svg",
        BUY: "https://s.eu.tankionline.com/static/images/buyButtonIcon.ca48e861.svg"
    };

    const processedSigs = new WeakMap();

    function getActiveTabCategory() {
        const activeMenu = document.querySelector(gameDOM.navigation.activeGarageCategory);
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
        const hasIcon = btn.querySelector(gameDOM.common.icon) ? 1 : 0;
        const hasKaspActive = btn.classList.contains('kasp-active-btn') ? 1 : 0;
        const hasKaspDisabled = btn.classList.contains('kasp-disabled-btn') ? 1 : 0;
        return `${text}|${category}|${kidCount}|${hasIcon}|${hasKaspActive}|${hasKaspDisabled}`;
    }

    function applyButtonFixes() {
        const buttons = document.querySelectorAll(gameDOM.garage.styledActions);
        if (!buttons.length)
            return;
        const currentCategory = getActiveTabCategory();
        buttons.forEach((btn) => {
            const textHTML = btn.innerHTML.toLowerCase();
            const textContent = btn.textContent?.toLowerCase() || '';
            const hasHotKey = btn.querySelector(gameDOM.common.hotkeyFragment);
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
            const isSuppliesContainer = btn.closest(gameDOM.garage.suppliesActions) !== null;

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
                const parent = btn.closest(gameDOM.garage.actionContainer);
                const siblingsCount = parent ? parent.querySelectorAll(gameDOM.garage.actionButton).length : 1;
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

            const iconDiv = btn.querySelector(gameDOM.common.icon);
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

        const buttons = document.querySelectorAll(gameDOM.garage.styledActions);
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
})();