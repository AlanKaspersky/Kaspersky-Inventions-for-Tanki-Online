import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customTrophies');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { getVerifiedAccount } from '../core/accountIdentity';
import { getTankiImageUrl } from '../core/imageUrl';
import { ACCOUNT_IDENTITY_MESSAGE } from '../core/accountId';
import { readPageMessage } from '../core/pageMessages';

export const customTrophies = lifecycle.initialize(() => {
    let initialization: Promise<void> | null = null;
    const STORAGE_PREFIX = 'kasp_trophies_favorites_uid_';
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
    let favoritesOwner: string | null = null;
    const presentedOwners = new Set<string>();

    function syncOwner(): string | null {
        const userId = getVerifiedAccount()?.userId || null;
        if (favoritesOwner !== userId) {
            cachedFavs = null;
            favoritesOwner = userId;
            document.getElementById('custom-trophy-panel')?.remove();
            document.querySelectorAll(gameDOM.trophies.favorite).forEach(star => star.remove());
        }
        return userId;
    }

    function getFavs(): Trophy[] {
        const userId = syncOwner();
        if (!userId) return [];
        if (cachedFavs) return cachedFavs;
        try {
            const value: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + userId) || '[]');
            cachedFavs = Array.isArray(value) ? value.filter((item): item is Trophy => item && typeof item === 'object'
                && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
                && ['turret', 'hull'].includes(item.type) && typeof item.icon === 'string'
                && Number.isFinite(item.current) && item.current >= 0 && Number.isFinite(item.max) && item.max > 0)
                .slice(0, 4).map(item => ({ ...item, icon: getTankiImageUrl(item.icon) })) : [];
        } catch {
            cachedFavs = [];
        }
        return cachedFavs || [];
    }

    function saveFavs(favs: Trophy[]) {
        const owner = favoritesOwner;
        if (!owner || syncOwner() !== owner) return;
        cachedFavs = favs;
        localStorage.setItem(STORAGE_PREFIX + owner, JSON.stringify(favs));
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
        const rewardDiv = card.querySelector(gameDOM.trophies.rewardImage);
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
        const cards = document.querySelectorAll(gameDOM.trophies.cards);
        if (cards.length > 0) processGarageMissions(Array.from(cards) as HTMLElement[]);
    }

    function processGarageMissions(garageCards: HTMLElement[]) {
        const owner = syncOwner();
        if (!owner) return;
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

            const isGrid = card.classList.contains(gameDOM.classes.gridTrophy);
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
            let starContainer = card.querySelector(gameDOM.trophies.favorite);

            if (!starContainer) {
                starContainer = document.createElement('div');
                starContainer.className = gameDOM.classes.favorite;
                starContainer.setAttribute('data-kasp-trophy-star', '');
                starContainer.innerHTML = `<img src="${favItem ? ICON_FAV : ICON_UNFAV}">`;
                card.appendChild(starContainer);
            } else {
                const img = starContainer.querySelector('img');
                const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
                if (img && img.src !== expectedIcon) img.src = expectedIcon;
            }
            (starContainer as HTMLElement).onclick = lifecycle.guard((e: MouseEvent) => {
                e.stopPropagation();
                if (syncOwner() !== owner || parseItem(card.textContent || '')?.id !== itemInfo.id) return;
                toggleFavorite(itemInfo.id, type, extractIcon(card), currentPoints, maxPoints);
            });

            if (limitReached) starContainer.classList.add('star-limit-reached');
            else starContainer.classList.remove('star-limit-reached');
        });
        if (favsUpdated) saveFavs(favs);
    }

    function processBattleResults(battleCards: HTMLElement[]) {
        let favs = getFavs();
        let favsUpdated = false;
        battleCards.forEach(card => {
            const textElements = card.querySelectorAll(gameDOM.trophies.resultText);
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
        const trophies = [...getFavs()];

        trophies.sort((a, b) => {
            if (a.type === 'turret' && b.type === 'hull') return -1;
            if (a.type === 'hull' && b.type === 'turret') return 1;
            return 0;
        });

        trophies.forEach(trophy => {
            const percent = Math.min(100, Math.max(0, (trophy.current / trophy.max) * 100));
            const match = Object.values(trophyDictionary).find(d => d.id === trophy.id);
            const displayName = match ? (state.lang === 'RU' ? match.ru : match.en) : trophy.id;
            const item = document.createElement('div');
            item.className = 'custom-trophy-item';
            const info = document.createElement('div');
            info.className = 'custom-trophy-info';
            const title = document.createElement('div');
            title.className = 'custom-trophy-title';
            title.textContent = displayName;
            const percentage = document.createElement('div');
            percentage.className = 'custom-trophy-percent';
            percentage.textContent = `${Math.floor(percent)}%`;
            const bar = document.createElement('div');
            bar.className = 'custom-trophy-bar-bg';
            const fill = document.createElement('div');
            fill.className = 'custom-trophy-bar-fill';
            fill.style.width = `${percent}%`;
            bar.appendChild(fill);
            const progress = document.createElement('div');
            progress.className = 'custom-trophy-text';
            const current = document.createElement('span');
            current.textContent = formatNumber(trophy.current);
            const target = document.createElement('span');
            target.textContent = `/ ${formatNumber(trophy.max)}`;
            progress.append(current, target);
            info.append(title, percentage, bar, progress);
            item.appendChild(info);
            panel.appendChild(item);
        });
        return panel;
    }

    function updateInterface() {
        const challengesBlock = document.querySelector(gameDOM.trophies.lobbyAnchor);
        const panel = document.getElementById('custom-trophy-panel');

        if (challengesBlock) {
            const key = JSON.stringify([favoritesOwner, state.lang, getFavs()]);
            if (getFavs().length === 0) panel?.remove();
            else if (challengesBlock.parentElement && (!panel || panel.dataset.trophiesKey !== key)) {
                const replacement = createPanel();
                if (!panel && state.currentScreen === 'lobby' && favoritesOwner && !presentedOwners.has(favoritesOwner))
                    replacement.className += ' kasp-lobby-reveal';
                if (favoritesOwner) presentedOwners.add(favoritesOwner);
                replacement.dataset.trophiesKey = key;
                if (panel) panel.replaceWith(replacement);
                else challengesBlock.parentElement.appendChild(replacement);
            }
        } else {
            if (panel) panel.remove();
        }

        const cards = document.querySelectorAll(gameDOM.trophies.cards);
        if (cards.length > 0) processGarageMissions(Array.from(cards) as HTMLElement[]);
    }

    lifecycle.onCleanup(() => { cachedFavs=null;favoritesOwner=null;document.querySelectorAll('.custom-trophy-panel, [data-kasp-trophy-star]').forEach(node=>node.remove()); });

    const update = async () => {
        const owner = syncOwner();
        if (!initialization) initialization = loadTrophyDictionary();
        await initialization;
        if(lifecycle.disabled) return;
        if (!trophyDictionaryLoaded || !owner || syncOwner() !== owner) return;

        if (state.currentScreen === 'lobby' || state.currentScreen === 'garage') {
            updateInterface();
        } else if (state.currentScreen === 'match_results') {
            const battleCards = document.querySelectorAll(gameDOM.trophies.resultCards);
            if (battleCards.length > 0) processBattleResults(Array.from(battleCards) as HTMLElement[]);
        }
    };

    // Warm the packaged dictionary while the game establishes native ownership.
    initialization = loadTrophyDictionary();
    let identityUpdate: number | null = null;
    lifecycle.listen(window, 'message', event => {
        if (!readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE) || identityUpdate !== null) return;
        // Run after all identity listeners, regardless of module import order.
        identityUpdate = lifecycle.timeout(() => {
            identityUpdate = null;
            if ((getVerifiedAccount()?.userId || null) !== favoritesOwner) return update();
        }, 0);
    });
    return update;
}, () => {});
