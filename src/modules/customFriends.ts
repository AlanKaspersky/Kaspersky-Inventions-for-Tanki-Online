import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customFriends');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { getAccountIdentity, getVerifiedAccount, getPlayerUserId, getAccountIdentityRevision, parseAccountIdentity } from '../core/accountIdentity';
import { ACCOUNT_IDENTITY_MESSAGE, ACCOUNT_IDENTITY_REQUEST } from '../core/accountId';
import { postPageMessage, readPageMessage } from '../core/pageMessages';

let refreshMenus = () => {};
export const friendContextMenu = lifecycle.guard(() => refreshMenus());

export const customFriends = lifecycle.initialize(() => {
    const originalDisplays = new Map<HTMLElement, { before: string; after: string }>();
    const activeFilters = new WeakMap<HTMLElement, string>();
    const restoreDisplay = (element: HTMLElement) => {
        const value = originalDisplays.get(element);
        originalDisplays.delete(element);
        if (value && element.style.display === value.after) element.style.display = value.before;
    };
    const display = (element: HTMLElement, value: string) => {
        const previous = originalDisplays.get(element);
        const before = previous && element.style.display === previous.after ? previous.before : element.style.display || '';
        originalDisplays.set(element, { before, after: value }); element.style.display = value;
        lifecycle.ownDOM(element, restoreDisplay);
    };
    let filterAccount: string | null = null;
    let filterRevision = -1;
    let menuEventsReady = false;
    const menuRequests = new WeakMap<HTMLElement, { nickname: string; owner: string | null; at: number; count: number }>();

    const filtersConfig = [
        { url: "https://s.eu.tankionline.com/static/images/allPaints.741c65e1.svg", type: "all" },
        { url: "https://s.eu.tankionline.com/static/images/uncommon.ca77d7da.svg", type: "online" },
        { url: "https://s.eu.tankionline.com/static/images/iconCasualGray.3eea12e7.svg", type: "offline" },
        { url: "https://s.eu.tankionline.com/static/images/iconRareBlue.4e3c7303.svg", type: "clan" },
        { url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg", type: "purple" },
        { url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg", type: "yellow" },
        { url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg", type: "red" },
    ];

    const getCurrentUserId = () => getVerifiedAccount()?.userId || null;

    const getCustomCategories = () => {
        const userId = getCurrentUserId();
        if (!userId) return {};
        try {
            const value: unknown = JSON.parse(localStorage.getItem(`tankiCustomCategories_uid_${userId}`) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {};
        } catch (e) {
            return {};
        }
    };

    const setCustomCategory = (ownerId: string, friendId: string, colorType: string) => {
        if (ownerId !== getCurrentUserId()) return;
        const cats = getCustomCategories();
        if (cats[friendId] === colorType) {
            delete cats[friendId];
        } else {
            cats[friendId] = colorType;
        }
        localStorage.setItem(`tankiCustomCategories_uid_${ownerId}`, JSON.stringify(cats));
        document.querySelectorAll('.custom-friends-sidebar').forEach(node => {
            const sidebar = node as HTMLElement;
            const activeBtn = sidebar.querySelector('.custom-filter-btn.active') as HTMLElement;
            if (activeBtn) activeBtn.click();
        });
    };

    const getMyClanTag = () => {
        return getAccountIdentity()?.clanTag || '';
    };

    const getFriendNickname = (element: HTMLElement | null): string => {
        if (!element) return '';
        const label = Array.from(element.querySelectorAll('span'))
            .find(span => span.className.includes(gameDOM.fragments.nicknameText));
        const text = label?.textContent ?? (element.innerText || '').split('\n')[0];
        return parseAccountIdentity(text)?.nickname || '';
    };

    const updateCardBadge = (el: HTMLElement, isFriendsList: boolean) => {
        const cardText = el.innerText || "";
        const nickText = getFriendNickname(el);
        const clanTag = getMyClanTag();
        const isClan = Boolean(clanTag && cardText.includes(clanTag));
        const cats = getCustomCategories();
        const friendId = getPlayerUserId(nickText);
        const customColor = friendId ? cats[friendId] : undefined;

        let rarityType = null;
        if (customColor) {
            rarityType = customColor;
        } else if (isClan) {
            rarityType = 'blue';
        }

        let badge = el.querySelector('.custom-rarity-badge') as HTMLImageElement;
        if (rarityType) {
            if (!badge) {
                badge = document.createElement('img');
                badge.src = 'https://s.eu.tankionline.com/static/images/categoryRarities.04cb4010.svg';
                badge.className = 'custom-rarity-badge';
                el.appendChild(badge);
            }
            badge.className = `custom-rarity-badge rarity-${rarityType}`;
            badge.style.display = '';
        } else {
            if (badge) {
                badge.style.display = 'none';
            }
        }
    };

    const applyFilter = (scrollBlock: HTMLElement, filterType: string) => {
        const clanTag = getMyClanTag();
        const cats = getCustomCategories();
        const isFriendsList = scrollBlock.classList.contains(gameDOM.classes.friendList);
        const itemSelector = isFriendsList ? gameDOM.friends.card : gameDOM.friends.invitationCard;
        const items = scrollBlock.querySelectorAll(itemSelector);

        items.forEach(node => {
            const el = node as HTMLElement;
            updateCardBadge(el, isFriendsList);
            if (filterType === 'all') {
                restoreDisplay(el);
                return;
            }
            const cardText = el.innerText || "";
            const textLower = cardText.toLowerCase();
            const isOnline = isFriendsList ? !!el.querySelector(gameDOM.friends.online) : (textLower.includes("в сети") || textLower.includes("online"));
            const isOffline = isFriendsList ? !!el.querySelector(gameDOM.friends.offline) : !isOnline;
            const nickText = getFriendNickname(el);

            let match = true;
            if (filterType === 'online') match = isOnline;
            else if (filterType === 'offline') match = isOffline;
            else if (filterType === 'clan') match = Boolean(clanTag && cardText.includes(clanTag));
            else if (['purple', 'yellow', 'red'].includes(filterType)) {
                const friendId = getPlayerUserId(nickText);
                match = !!friendId && cats[friendId] === filterType;
            }
            display(el, match ? '' : 'none');
        });
    };

    const injectCategoriesMenu = (menu: HTMLElement) => {
        const rankItem = menu.querySelector(gameDOM.friends.contextPlayer) as HTMLElement;
        if (!rankItem) return;
        const nickname = getFriendNickname(rankItem);
        const ownerId = getCurrentUserId(), friendId = getPlayerUserId(nickname);
        if (!nickname) return;
        const pending = !ownerId || !friendId;
        if (pending) {
            let request = menuRequests.get(menu);
            if (!request || request.nickname !== nickname || request.owner !== ownerId) {
                request = { nickname, owner: ownerId, at: -Infinity, count: 0 }; menuRequests.set(menu, request);
            }
            if (request.count < 6 && Date.now() - request.at >= 1000) {
                request.at = Date.now(); request.count++;
                postPageMessage(window, { type: ACCOUNT_IDENTITY_REQUEST, refreshPlayers: true });
            }
        }
        const binding = pending ? `pending:${ownerId || ''}:${nickname}` : `${ownerId}:${friendId}`;
        const existingRow = menu.querySelector<HTMLElement>('.custom-category-row');
        if (menu.dataset.customCategoriesInjected === binding && existingRow) return;
        if (existingRow) { lifecycle.releaseDOM(existingRow); existingRow.remove(); }
        delete menu.dataset.customCategoriesInjected;
        menu.dataset.customCategoriesInjected = binding;
        const row = document.createElement('div');
        row.className = `custom-category-row${pending ? ' custom-category-pending' : ''}`;
        const cats = getCustomCategories();
        const currentColor = friendId ? cats[friendId] : undefined;

        const customButtons = [
            { type: 'purple', color: '#b278ff' },
            { type: 'yellow', color: '#ffd600' },
            { type: 'red', color: '#ff4444' }
        ];

        customButtons.forEach(c => {
            const btn = document.createElement('div');
            btn.className = `custom-category-menu-btn ${currentColor === c.type ? 'active' : ''}`;
            btn.style.setProperty('--kasp-category-color', c.color);
            btn.setAttribute('aria-disabled', String(pending));
            if (pending) btn.title = state.lang === 'RU' ? 'Определяем ID игрока…' : 'Resolving player ID…';
            btn.onclick = lifecycle.guard((e: MouseEvent) => {
                e.stopPropagation();
                if (!ownerId || !friendId) return;
                const currentRank = menu.querySelector<HTMLElement>(gameDOM.friends.contextPlayer);
                if (ownerId !== getCurrentUserId() || getPlayerUserId(getFriendNickname(currentRank)) !== friendId) return;
                setCustomCategory(ownerId, friendId, c.type);
                row.querySelectorAll('.custom-category-menu-btn').forEach(b => b.classList.remove('active'));
                const newCats = getCustomCategories();
                if (newCats[friendId] === c.type) {
                    btn.classList.add('active');
                }
            });
            row.appendChild(btn);
        });

        menu.appendChild(row);
        lifecycle.ownDOM(row, element => {
            if (menu.querySelector('.custom-category-row') === element) delete menu.dataset.customCategoriesInjected;
            element.remove();
        });
        lifecycle.frame(() => {
            const rect = menu.getBoundingClientRect();
            const overflow = rect.bottom - window.innerHeight;
            if (overflow > 0) {
                const currentTop = parseFloat(menu.style.top) || rect.top;
                menu.style.top = `${currentTop - overflow - 8}px`;
            }
        });
    };

    refreshMenus = () => {
        if (!utils.getSetting('k_friends', false)) return;
        if (!menuEventsReady) {
            menuEventsReady = true;
            lifecycle.listen(window, 'message', event => {
                if (!readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE)) return;
                // Identity's listener may run later in the same message dispatch.
                lifecycle.microtask(friendContextMenu);
            });
        }
        if (!document.querySelector(gameDOM.friends.lists)) return;
        document.querySelectorAll<HTMLElement>(gameDOM.friends.contextMenu).forEach(injectCategoriesMenu);
    };

    const setupSidebar = (scrollBlock: HTMLElement) => {
        if (scrollBlock.dataset.sidebarInjected === 'true') return;
        scrollBlock.dataset.sidebarInjected = 'true';
        const isFriends = scrollBlock.classList.contains(gameDOM.classes.friendList);

        if (isFriends) {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-friends-wrapper';
            wrapper.style.cssText = 'position: relative; width: 72.375em; margin: 0 auto; box-sizing: border-box;';
            if (scrollBlock.parentNode) {
                scrollBlock.parentNode.insertBefore(wrapper, scrollBlock);
            }
            wrapper.appendChild(scrollBlock);

            const sidebar = document.createElement('div');
            sidebar.className = 'custom-friends-sidebar sidebar-friends';
            filtersConfig.forEach(config => {
                const btn = document.createElement('div');
                btn.className = 'custom-filter-btn';
                if (config.type === (activeFilters.get(scrollBlock) || 'all')) btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                lifecycle.listen(btn, 'click', () => {
                    sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilters.set(scrollBlock, config.type);
                    applyFilter(scrollBlock, config.type);
                });
                btn.appendChild(img);
                sidebar.appendChild(btn);
            });
            wrapper.appendChild(sidebar);
            lifecycle.ownDOM(sidebar, element => {
                element.remove();
                delete scrollBlock.dataset.sidebarInjected;
                wrapper.replaceWith(...Array.from(wrapper.childNodes));
            });
        } else {
            const parent = scrollBlock.parentNode as HTMLElement;
            if (!parent) return;
            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            const sidebar = document.createElement('div');
            sidebar.className = 'custom-friends-sidebar sidebar-invites';
            filtersConfig.forEach(config => {
                const btn = document.createElement('div');
                btn.className = 'custom-filter-btn';
                if (config.type === (activeFilters.get(scrollBlock) || 'all')) btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                lifecycle.listen(btn, 'click', () => {
                    sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilters.set(scrollBlock, config.type);
                    applyFilter(scrollBlock, config.type);
                });
                btn.appendChild(img);
                sidebar.appendChild(btn);
            });
            parent.insertBefore(sidebar, scrollBlock);
            lifecycle.ownDOM(sidebar, element => {
                element.remove();
                delete scrollBlock.dataset.sidebarInjected;
            });
        }
    };

    lifecycle.onCleanup(() => {
        refreshMenus = () => {};
        document.querySelectorAll('.custom-friends-sidebar, .custom-rarity-badge, .custom-category-row').forEach(node => node.remove());
        for (const row of originalDisplays.keys()) restoreDisplay(row);
        document.querySelectorAll('[data-sidebar-injected]').forEach(node => node.removeAttribute('data-sidebar-injected'));
        document.querySelectorAll('.custom-friends-wrapper').forEach(wrapper => wrapper.replaceWith(...Array.from(wrapper.childNodes)));
    });

    return () => {
        if (!utils.getSetting('k_friends', false)) return;

        if (state.currentScreen === 'battle') return;
        const userId = getCurrentUserId();
        const revision = getAccountIdentityRevision();
        if (filterAccount !== userId || filterRevision !== revision) {
            filterAccount = userId;
            filterRevision = revision;
            document.querySelectorAll<HTMLElement>('.custom-friends-sidebar .custom-filter-btn.active').forEach(button => button.click());
        }

        const scrollBlocks = document.querySelectorAll(gameDOM.friends.lists);
        scrollBlocks.forEach(node => {
            const scrollBlock = node as HTMLElement;
            if (scrollBlock.dataset.sidebarInjected !== 'true') setupSidebar(scrollBlock);

            const filter = activeFilters.get(scrollBlock);
            if (filter && filter !== 'all') { applyFilter(scrollBlock, filter); return; }

            const isFriendsList = scrollBlock.classList.contains(gameDOM.classes.friendList);
            const itemSelector = isFriendsList ? gameDOM.friends.card : gameDOM.friends.invitationCard;

            scrollBlock.querySelectorAll(itemSelector).forEach(el => {
                updateCardBadge(el as HTMLElement, isFriendsList);
            });
        });

        friendContextMenu();
    };
}, () => {});
