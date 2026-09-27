import { state } from '../core/state';

export const customTrophies = (() => {
    let initialized = false;
    const STORAGE_KEY = 'kasp_trophies_favorites';
    const ICON_UNFAV = 'https://s.eu.tankionline.com/static/images/unfavoriteStar.0e39d67a.svg';
    const ICON_FAV = 'https://s.eu.tankionline.com/static/images/favoriteStar.1ce58570.svg';

    type Trophy = { id: string; type: string; icon: string; current: number; max: number };

    type TrophyDictionaryEntry = { id: string; ru: string; en: string; type: string };
    let trophyDictionary: Record<string, TrophyDictionaryEntry> = {};
    let trophyDictionaryLoaded = false;

    async function loadTrophyDictionary(): Promise<void> {
        if (trophyDictionaryLoaded) return;
        try {
            const response = await fetch(chrome.runtime.getURL('database/trophies.json'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            trophyDictionary = await response.json();
            trophyDictionaryLoaded = true;
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load trophy dictionary:', error);
            trophyDictionary = {};
        }
    }

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
        for (const key in trophyDictionary) {
            if (lower.includes(key)) {
                const item = trophyDictionary[key];
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
            const match = Object.values(trophyDictionary).find(d => d.id === trophy.id);
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

    return async () => {
        if (!initialized) {
            initialized = true;
            await loadTrophyDictionary();
        }

        if (state.currentScreen === 'lobby' || state.currentScreen === 'garage') {
            updateInterface();
        } else if (state.currentScreen === 'match_results') {
            const battleCards = document.querySelectorAll('.BattleResultQuestProgressComponentStyle-container');
            if (battleCards.length > 0) processBattleResults(Array.from(battleCards) as HTMLElement[]);
        }
    };
})();