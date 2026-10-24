import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customTrophies');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { getVerifiedAccount } from '../core/accountIdentity';
import { chooseTrophyProgress, matchTrophy, mergeTrophyProgress, normalizeTrophyFavorites, Trophy, TrophyDictionaryEntry } from '../core/trophyData';
import { ACCOUNT_IDENTITY_MESSAGE } from '../core/accountId';
import { readPageMessage } from '../core/pageMessages';

export const customTrophies = lifecycle.initialize(() => {
    let initialization: Promise<void> | null = null;
    const STORAGE_PREFIX = 'kasp_trophies_favorites_uid_';
    const ICON_UNFAV = chrome.runtime.getURL('assets/trophy-unfavorite.svg');
    const ICON_FAV = chrome.runtime.getURL('assets/trophy-favorite.svg');
    let trophyDictionary: Record<string, TrophyDictionaryEntry> = {};
    let trophyDictionaryLoaded = false;
    let dictionaryRetryAt = 0;

    async function loadTrophyDictionary(): Promise<void> {
        if (trophyDictionaryLoaded) return;
        try {
            const response = await fetch(chrome.runtime.getURL('database/trophies.json'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const value: unknown = await response.json();
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid trophy dictionary');
            const valid: Record<string, TrophyDictionaryEntry> = {};
            for (const [alias, entry] of Object.entries(value)) {
                if (alias.trim() && entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id
                    && typeof entry.ru === 'string' && typeof entry.en === 'string' && ['turret', 'hull'].includes(entry.type))
                    valid[alias] = entry;
            }
            if (!Object.keys(valid).length) throw new Error('Empty trophy dictionary');
            trophyDictionary = valid;
            trophyDictionaryLoaded = true;
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load trophy dictionary:', error);
            trophyDictionary = {};
            dictionaryRetryAt = Date.now() + 10000;
            lifecycle.timeout(() => { initialization = null; void update(); }, 10000);
        }
    }

    let cachedFavs: Trophy[] | null = null;
    let favoritesOwner: string | null = null;
    const presentedOwners = new Set<string>();
    const decoratedCards = new Set<HTMLElement>();
    let progressObserver: MutationObserver | null = null, observedCards: HTMLElement[] = [];
    let progressUpdate: number | null = null;

    function observeCards(cards: HTMLElement[]) {
        if (cards.length === observedCards.length && cards.every((card, index) => card === observedCards[index])) return;
        progressObserver?.disconnect();
        observedCards = cards;
        if (!cards.length) return;
        progressObserver ??= lifecycle.observer(records => {
            if (progressUpdate !== null || records.every(record => {
                const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
                return target?.closest('[data-kasp-trophy-star]') || record.type === 'childList'
                    && [...record.addedNodes, ...record.removedNodes].every(node => node.nodeType === 1
                        && (node as Element).matches('[data-kasp-trophy-star]'));
            })) return;
            progressUpdate = lifecycle.timeout(() => { progressUpdate = null; return update(); }, 50);
        });
        cards.forEach(card => progressObserver?.observe(card, { childList: true, characterData: true, subtree: true,
            attributes: true, attributeFilter: ['title'] }));
    }

    function releaseCard(card: HTMLElement) {
        card.querySelector('[data-kasp-trophy-star]')?.remove();
        card.querySelectorAll('[data-kasp-trophy-rewards]').forEach(node => node.removeAttribute('data-kasp-trophy-rewards'));
        card.classList.remove('card-type-grid', 'card-type-list');
        decoratedCards.delete(card);
    }

    function attribute(element: HTMLElement, name: string, value: string) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }

    function syncOwner(): string | null {
        const userId = getVerifiedAccount()?.userId || null;
        if (favoritesOwner !== userId) {
            cachedFavs = null;
            favoritesOwner = userId;
            document.getElementById('custom-trophy-panel')?.remove();
            decoratedCards.forEach(releaseCard);
        }
        return userId;
    }

    function getFavs(): Trophy[] {
        const userId = syncOwner();
        if (!userId) return [];
        if (cachedFavs) return cachedFavs;
        try {
            const value: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + userId) || '[]');
            cachedFavs = normalizeTrophyFavorites(value);
        } catch {
            cachedFavs = [];
        }
        return cachedFavs || [];
    }

    function saveFavs(favs: Trophy[]) {
        const owner = favoritesOwner;
        if (!owner || syncOwner() !== owner) return;
        cachedFavs = favs;
        try { localStorage.setItem(STORAGE_PREFIX + owner, JSON.stringify(favs)); }
        catch (error) { console.warn('[Kaspersky Inventions] Cannot save favorite trophies:', error); }
    }

    function parseItem(card: HTMLElement) {
        // React's adjacent blocks have no separators in textContent. Preserve
        // word boundaries without innerText's synchronous layout calculation.
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        const parts: string[] = [];
        while (walker.nextNode()) parts.push(walker.currentNode.textContent || '');
        return matchTrophy(parts.join(' '), trophyDictionary);
    }

    function formatNumber(num: number) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    function readCardProgress(card: HTMLElement, results = false) {
        const elements = card.querySelectorAll<HTMLElement>(results ? gameDOM.trophies.resultText : gameDOM.trophies.progressText);
        const values: string[] = [];
        elements.forEach(element => {
            // Read both native animation totals, including opacity:0 final totals.
            values.push(element.textContent || '');
            const title = element.getAttribute('title');
            if (title) values.push(title);
        });
        return chooseTrophyProgress(values);
    }

    function toggleFavorite(item: TrophyDictionaryEntry, card: HTMLElement) {
        const favs = [...getFavs()];
        const { id: itemId, type } = item;
        const idx = favs.findIndex(f => f.id === itemId);
        if (idx > -1) {
            favs.splice(idx, 1);
        } else {
            const count = favs.filter(f => f.type === type).length;
            if (count >= 2) return;
            favs.push({ id: itemId, type, ...(readCardProgress(card) ?? { current: null, max: null, percent: null }) });
        }
        saveFavs(favs);
        updateInterface();
    }

    function processGarageMissions(garageCards: HTMLElement[]) {
        const owner = syncOwner();
        if (!owner) return;
        let favs = getFavs();
        let favsUpdated = false;
        const favTurrets = favs.filter(f => f.type === 'turret').length;
        const favHulls = favs.filter(f => f.type === 'hull').length;

        garageCards.forEach(card => {
            const itemInfo = parseItem(card);
            if (!itemInfo) { if (decoratedCards.has(card)) releaseCard(card); return; }

            const isGrid = card.classList.contains(gameDOM.classes.gridTrophy);
            const layout = isGrid ? 'card-type-grid' : 'card-type-list';
            const oldLayout = isGrid ? 'card-type-list' : 'card-type-grid';
            if (!card.classList.contains(layout)) card.classList.add(layout);
            if (card.classList.contains(oldLayout)) card.classList.remove(oldLayout);
            decoratedCards.add(card);

            const type = itemInfo.type;
            const favItem = favs.find(f => f.id === itemInfo.id);
            const progress = readCardProgress(card);
            if (favItem && progress) {
                const next = mergeTrophyProgress(favItem, progress);
                if (favItem.current !== next.current || favItem.max !== next.max || favItem.percent !== next.percent) {
                    Object.assign(favItem, next); favsUpdated = true;
                }
            }

            const limitReached = !favItem && ((type === 'turret' && favTurrets >= 2) || (type === 'hull' && favHulls >= 2));
            let starContainer = card.querySelector<HTMLElement>('[data-kasp-trophy-star]');

            if (!starContainer) {
                starContainer = document.createElement('div');
                starContainer.className = gameDOM.classes.favorite;
                starContainer.setAttribute('data-kasp-trophy-star', '');
                const img = document.createElement('img');
                img.src = favItem ? ICON_FAV : ICON_UNFAV;
                img.alt = '';
                starContainer.appendChild(img);
                card.appendChild(starContainer);
            } else {
                const img = starContainer.querySelector('img');
                const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
                if (img && img.src !== expectedIcon) img.src = expectedIcon;
            }
            const rewards = isGrid ? card.querySelector<HTMLElement>(gameDOM.trophies.rewards) : null;
            card.querySelectorAll('[data-kasp-trophy-rewards]').forEach(node => {
                if (node !== rewards) node.removeAttribute('data-kasp-trophy-rewards');
            });
            if (rewards && !rewards.hasAttribute('data-kasp-trophy-rewards'))
                attribute(rewards, 'data-kasp-trophy-rewards', getComputedStyle(rewards).position === 'static' ? 'relative' : '');
            const starParent = rewards ?? card;
            if (starContainer.parentElement !== starParent) starParent.appendChild(starContainer);
            (starContainer as HTMLElement).onclick = lifecycle.guard((e: MouseEvent) => {
                e.stopPropagation();
                if (!card.isConnected || syncOwner() !== owner || parseItem(card)?.id !== itemInfo.id) return;
                toggleFavorite(itemInfo, card);
            });
            const label = state.lang === 'RU' ? (favItem ? 'Убрать из избранного' : 'В избранное')
                : (favItem ? 'Remove favorite' : 'Add favorite');
            attribute(starContainer, 'title', label);
            attribute(starContainer, 'role', 'button');
            attribute(starContainer, 'aria-pressed', String(Boolean(favItem)));
            attribute(starContainer, 'aria-label', label);
            attribute(starContainer, 'aria-disabled', String(limitReached));
            attribute(starContainer, 'tabindex', limitReached ? '-1' : '0');
            starContainer.onkeydown = lifecycle.guard((e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); starContainer?.click(); }
            });

            if (limitReached !== starContainer.classList.contains('star-limit-reached'))
                starContainer.classList.toggle('star-limit-reached', limitReached);
        });
        if (favsUpdated) saveFavs(favs);
    }

    function processBattleResults(battleCards: HTMLElement[]) {
        let favs = getFavs();
        let favsUpdated = false;
        battleCards.forEach(card => {
            const itemInfo = parseItem(card);
            if (!itemInfo) return;
            const progress = readCardProgress(card, true);
            const favItem = favs.find(f => f.id === itemInfo.id);
            if (favItem && progress) {
                const next = mergeTrophyProgress(favItem, progress);
                if (favItem.current !== next.current || favItem.max !== next.max || favItem.percent !== next.percent) {
                    Object.assign(favItem, next); favsUpdated = true;
                }
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
            const percent = trophy.percent;
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
            percentage.textContent = percent === null ? '—' : `${Math.floor(percent)}%`;
            const bar = document.createElement('div');
            bar.className = 'custom-trophy-bar-bg';
            const fill = document.createElement('div');
            fill.className = 'custom-trophy-bar-fill';
            fill.style.width = `${percent ?? 0}%`;
            bar.appendChild(fill);
            const progress = document.createElement('div');
            progress.className = 'custom-trophy-text';
            const current = document.createElement('span');
            current.textContent = trophy.current === null ? '—' : formatNumber(trophy.current);
            const target = document.createElement('span');
            target.textContent = trophy.max === null ? '' : `/ ${formatNumber(trophy.max)}`;
            if (trophy.current === null) item.title = state.lang === 'RU'
                ? 'Откройте раздел трофеев, чтобы обновить очки репутации'
                : 'Open trophies to update reputation points';
            progress.append(current, target);
            info.append(title, percentage, bar, progress);
            item.appendChild(info);
            panel.appendChild(item);
        });
        return panel;
    }

    function updateInterface() {
        for (const card of decoratedCards) if (!card.isConnected) releaseCard(card);
        const cards = document.querySelectorAll(gameDOM.trophies.cards);
        if (cards.length > 0) processGarageMissions(Array.from(cards) as HTMLElement[]);
        const challengesBlock = document.querySelector(gameDOM.trophies.lobbyAnchor);
        const panel = document.getElementById('custom-trophy-panel');

        if (challengesBlock) {
            const key = JSON.stringify([favoritesOwner, state.lang, getFavs()]);
            if (getFavs().length === 0) panel?.remove();
            else if (challengesBlock.parentElement && (!panel || panel.parentElement !== challengesBlock.parentElement || panel.dataset.trophiesKey !== key)) {
                const replacement = createPanel();
                if (!panel && state.currentScreen === 'lobby' && favoritesOwner && !presentedOwners.has(favoritesOwner))
                    replacement.className += ' kasp-lobby-reveal';
                if (favoritesOwner) presentedOwners.add(favoritesOwner);
                replacement.dataset.trophiesKey = key;
                if (panel?.parentElement === challengesBlock.parentElement) panel.replaceWith(replacement);
                else { panel?.remove(); challengesBlock.parentElement.appendChild(replacement); }
            }
        } else {
            if (panel) panel.remove();
        }

    }

    lifecycle.onCleanup(() => {
        cachedFavs = null; favoritesOwner = null;
        decoratedCards.forEach(releaseCard);
        document.getElementById('custom-trophy-panel')?.remove();
    });

    const update = async () => {
        const owner = syncOwner();
        if (!initialization && Date.now() >= dictionaryRetryAt) initialization = loadTrophyDictionary();
        if (!initialization) return;
        await initialization;
        if(lifecycle.disabled) return;
        if (!trophyDictionaryLoaded || !owner || syncOwner() !== owner) return;

        const battleCards = Array.from(document.querySelectorAll<HTMLElement>(gameDOM.trophies.resultCards));
        observeCards([...document.querySelectorAll<HTMLElement>(gameDOM.trophies.cards), ...battleCards]);
        updateInterface();
        if (battleCards.length > 0) processBattleResults(battleCards);
    };

    // Warm the packaged dictionary while the game establishes native ownership.
    initialization = loadTrophyDictionary();
    lifecycle.listen(window, 'storage', event => {
        if (event.key === null || event.key === STORAGE_PREFIX + favoritesOwner) {
            cachedFavs = null; void update();
        }
    });
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
