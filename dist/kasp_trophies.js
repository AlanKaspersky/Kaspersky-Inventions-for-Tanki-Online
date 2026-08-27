"use strict";
(function () {
    'use strict';
    const STORAGE_KEY = 'kasp_trophies_favorites';
    const ICON_UNFAV = 'https://s.eu.tankionline.com/static/images/unfavoriteStar.0e39d67a.svg';
    const ICON_FAV = 'https://s.eu.tankionline.com/static/images/favoriteStar.1ce58570.svg';
    const CSS = `
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
    `;
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
        return cachedFavs;
    }
    function saveFavs(favs) {
        cachedFavs = favs;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    }
    function getLang() {
        return document.documentElement.lang.toLowerCase().startsWith('ru') ? 'RU' : 'EN';
    }
    function parseItem(rawText) {
        const lower = rawText.toLowerCase();
        for (const key in DICTIONARY) {
            if (lower.includes(key)) {
                const item = DICTIONARY[key];
                return {
                    id: item.id,
                    name: getLang() === 'RU' ? item.ru : item.en,
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
                    if (!style.includes('opacity: 0')) {
                        rawProgress = text;
                    }
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
            const displayName = match ? (getLang() === 'RU' ? match.ru : match.en) : trophy.id;
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
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    if (document.head)
        document.head.appendChild(styleEl);
    else
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(styleEl));
    function updateInterface() {
        const challengesBlock = document.getElementsByClassName('BattlePassLobbyComponentStyle-menuBattlePass')[0];
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
    function isBattleActive() {
        return !!document.querySelector('[class*="BattleHud"], [class*="BattleScreen"]');
    }
    const observer = new MutationObserver(() => {
        if (isBattleActive())
            return;
        updateInterface();
        const inResults = document.querySelector('.BattleResultHeaderComponentStyle-resultText');
        if (inResults) {
            const battleCards = document.getElementsByClassName('BattleResultQuestProgressComponentStyle-container');
            if (battleCards.length > 0)
                processBattleResults(Array.from(battleCards));
        }
    });
    const initObserver = () => {
        const rootContainer = document.getElementById('app-root') || document.body || document.documentElement;
        if (rootContainer)
            observer.observe(rootContainer, { childList: true, subtree: true });
        updateInterface();
    };
    if (document.body || document.getElementById('app-root'))
        initObserver();
    else
        document.addEventListener('DOMContentLoaded', initObserver);
})();
