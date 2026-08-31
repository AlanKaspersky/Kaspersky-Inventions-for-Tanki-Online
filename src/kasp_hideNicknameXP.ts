(function() {
    if (window !== window.top) {
        return;
    }
    'use strict';

    if (localStorage.getItem('k_hideNicknameXP') !== 'true') return;

    let cachedOriginalNick: string | null = null;
    let currentLanguage = 'EN';

    function getLang(): string {
        return document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('ru') ? 'RU' : 'EN';
    }

    function getHiddenText(): string {
        return getLang() === 'RU' ? 'Скрыто' : 'Hidden';
    }

    function addStyles() {
        if (document.getElementById('hide-nickname-styles')) return;

        const style = document.createElement('style');
        style.id = 'hide-nickname-styles';
        style.textContent = `
            .hidden-text, .hidden-text-ru, .hidden-xp, .hidden-xp-ru {
                position: relative;
                cursor: pointer;
                font-weight: 500;
                text-shadow: rgba(0, 0, 0, 0.5) 0em 0em 0.25em;
                user-select: none;
                display: inline-block;
            }
            .hidden-text, .hidden-text-ru {
                color: #ffffff !important;
            }
            .hidden-text:hover, .hidden-text-ru:hover {
                color: rgb(255, 188, 9) !important;
            }
            .hidden-xp, .hidden-xp-ru {
                color: rgb(118, 255, 51) !important;
                font-family: BaseFontMedium, FallbackFontMedium, sans-serif;
                font-style: normal;
                text-transform: uppercase;
                font-size: 1em;
            }

            .hidden-text::after, .hidden-text-ru::after,
            .hidden-xp::after, .hidden-xp-ru::after {
                content: attr(data-tooltip);
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                padding: 5px 12px;
                border-radius: 4px;
                font-size: 13px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                z-index: 99999;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                margin-top: 8px;
                border: 1px solid rgba(255,255,255,0.1);
                font-weight: 500;
                font-family: BaseFontMedium, FallbackFontMedium, sans-serif;
                text-transform: uppercase;
                transition: opacity 0.15s ease;
            }
            .hidden-text::after, .hidden-text-ru::after { color: #ffffff; }
            .hidden-xp::after, .hidden-xp-ru::after { color: rgb(118, 255, 51); }

            .hidden-text::before, .hidden-text-ru::before,
            .hidden-xp::before, .hidden-xp-ru::before {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 6px solid transparent;
                border-bottom-color: rgba(0, 0, 0, 0.9);
                opacity: 0;
                pointer-events: none;
                z-index: 99999;
                margin-top: -4px;
                transition: opacity 0.15s ease;
            }
            .hidden-text:hover::after, .hidden-text:hover::before,
            .hidden-text-ru:hover::after, .hidden-text-ru:hover::before,
            .hidden-xp:hover::after, .hidden-xp:hover::before,
            .hidden-xp-ru:hover::after, .hidden-xp-ru:hover::before {
                opacity: 1;
            }
        `;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
        }
    }

    function processNickElement(userNameElement: HTMLElement) {
        currentLanguage = getLang();
        const hiddenText = getHiddenText();
        const expectedClass = currentLanguage === 'RU' ? 'hidden-text-ru' : 'hidden-text';

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
            if (hiddenSpan.className !== expectedClass) {
                hiddenSpan.className = expectedClass;
            }
            if (hiddenSpan.textContent !== hiddenText) {
                hiddenSpan.textContent = hiddenText;
            }
            if (cachedOriginalNick && hiddenSpan.getAttribute('data-tooltip') !== cachedOriginalNick) {
                hiddenSpan.setAttribute('data-tooltip', cachedOriginalNick);
            }
        }
    }

    function processXpElement(xpContainer: HTMLElement) {
        currentLanguage = getLang();
        const hiddenText = getHiddenText();
        const expectedClass = currentLanguage === 'RU' ? 'hidden-xp-ru' : 'hidden-xp';

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
            if (hiddenXpSpan.className !== expectedClass) {
                hiddenXpSpan.className = expectedClass;
            }
            const currentXpText = xpContainer.textContent?.trim() || '';
            if (currentXpText && currentXpText !== hiddenText && currentXpText !== 'Скрыто' && currentXpText !== 'Hidden') {
                hiddenXpSpan.setAttribute('data-tooltip', currentXpText);
            }
            if (hiddenXpSpan.textContent !== hiddenText) {
                hiddenXpSpan.textContent = hiddenText;
            }
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

    addStyles();

    let rootContainer: HTMLElement | null = null;
    const observerConfig = { childList: true, subtree: true, characterData: true };

    const observer = new MutationObserver(() => {
        observer.disconnect();

        const userName = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') as HTMLElement | null;
        if (userName) processNickElement(userName);

        const xp = document.querySelector('.UserInfoContainerStyle-progressValue') as HTMLElement | null;
        if (xp) processXpElement(xp);

        if (rootContainer) observer.observe(rootContainer, observerConfig);
    });

    function startObserver() {
        rootContainer = document.getElementById('app-root') || document.body;
        if (rootContainer) {
            observer.observe(rootContainer, observerConfig);
            
            const userName = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') as HTMLElement | null;
            if (userName) processNickElement(userName);
            const xp = document.querySelector('.UserInfoContainerStyle-progressValue') as HTMLElement | null;
            if (xp) processXpElement(xp);
        } else {
            setTimeout(startObserver, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            setTimeout(hideNicknameInTables, 40);
        }
    });

    const tabOpenObserver = new MutationObserver(() => {
        const tabTable = document.querySelector('.BattleTabStatisticComponentStyle-containerInsideTeams');
        if (tabTable) {
            hideNicknameInTables();
        }
    });

    if (document.body) {
        tabOpenObserver.observe(document.body, { childList: true, subtree: true });
    }

})();