import { state } from '../core/state';
import { utils } from '../core/utils';
import { getAccountIdentity, parseAccountIdentity } from '../core/accountIdentity';

let privacyObserver: MutationObserver | null = null;

function setTooltip(element: Element, text: string) {
    if (element.getAttribute('data-kasp-private-tooltip') !== text) {
        element.setAttribute('data-kasp-private-tooltip', text);
    }
}

export function hideNickname() {
    if (!utils.getSetting('k_hideNicknameXP', false)) return;
    const root = document.documentElement;
    if (!root) return;
    if (!root.classList.contains('kasp-hide-nickname')) root.classList.add('kasp-hide-nickname');
    const label = state.lang === 'RU' ? '"Скрыто"' : '"Hidden"';
    if (root.style.getPropertyValue('--kasp-hidden-label') !== label) {
        root.style.setProperty('--kasp-hidden-label', label);
    }

    // CSS masks known locations before painting. Preserve the game's text and
    // children so identity, history and friend categories remain accurate.
    document.querySelectorAll('.UserInfoContainerStyle-userNameRank, .UserInfoContainerStyle-progressValue').forEach(element => {
        setTooltip(element, element.textContent?.trim() || '');
    });

    document.querySelectorAll('.ClientInfoComponentStyle-parameterText').forEach(element => {
        const uid = /^UID:\s*(.*)$/i.exec(element.textContent?.trim() || '');
        if (uid) {
            if (element.hasAttribute('data-kasp-public-parameter')) element.removeAttribute('data-kasp-public-parameter');
            if (!element.hasAttribute('data-kasp-private-uid')) element.setAttribute('data-kasp-private-uid', '');
            setTooltip(element, uid[1]);
        } else {
            if (!element.hasAttribute('data-kasp-public-parameter')) element.setAttribute('data-kasp-public-parameter', '');
            if (element.hasAttribute('data-kasp-private-uid')) {
                element.removeAttribute('data-kasp-private-uid');
                element.removeAttribute('data-kasp-private-tooltip');
            }
        }
    });

    const own = getAccountIdentity()?.nickname;
    document.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell span').forEach(element => {
        const isSelf = !!own && parseAccountIdentity(element.textContent || '')?.nickname === own;
        if (isSelf && !element.hasAttribute('data-kasp-private-nickname')) {
            element.setAttribute('data-kasp-private-nickname', '');
        } else if (!isSelf && element.hasAttribute('data-kasp-private-nickname')) {
            element.removeAttribute('data-kasp-private-nickname');
        }
    });
}

export function setupNicknamePrivacy() {
    if (!utils.getSetting('k_hideNicknameXP', false)) return;
    hideNickname();
    if (privacyObserver) return;
    privacyObserver = new MutationObserver(hideNickname);
    privacyObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'id'],
    });
}
