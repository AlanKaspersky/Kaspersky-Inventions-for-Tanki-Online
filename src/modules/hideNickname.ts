import { state } from '../core/state';
import { utils } from '../core/utils';

export const hideNickname = (() => {
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
})();