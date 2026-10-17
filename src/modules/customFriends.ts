import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customFriends');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { getAccountIdentity, getVerifiedAccount, getPlayerUserId, getAccountIdentityRevision } from '../core/accountIdentity';

export const customFriends = lifecycle.initialize(() => {
    const originalDisplays = new Map<HTMLElement, string>();
    let filterAccount: string | null = null;
    let filterRevision = -1;

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

    const updateCardBadge = (el: HTMLElement, isFriendsList: boolean) => {
        const cardText = el.innerText || "";
        const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes(gameDOM.fragments.nicknameText)) as HTMLElement;
        const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
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
                el.style.display = '';
                return;
            }
            const cardText = el.innerText || "";
            const textLower = cardText.toLowerCase();
            const isOnline = isFriendsList ? !!el.querySelector(gameDOM.friends.online) : (textLower.includes("в сети") || textLower.includes("online"));
            const isOffline = isFriendsList ? !!el.querySelector(gameDOM.friends.offline) : !isOnline;
            const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes(gameDOM.fragments.nicknameText)) as HTMLElement;
            const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();

            let match = true;
            if (filterType === 'online') match = isOnline;
            else if (filterType === 'offline') match = isOffline;
            else if (filterType === 'clan') match = Boolean(clanTag && cardText.includes(clanTag));
            else if (['purple', 'yellow', 'red'].includes(filterType)) {
                const friendId = getPlayerUserId(nickText);
                match = !!friendId && cats[friendId] === filterType;
            }
            if (!originalDisplays.has(el)) originalDisplays.set(el, el.style.display);
            el.style.display = match ? '' : 'none';
        });
    };

    const injectCategoriesMenu = (menu: HTMLElement) => {
        const rankItem = menu.querySelector(gameDOM.friends.contextPlayer) as HTMLElement;
        if (!rankItem) return;
        const span = Array.from(rankItem.querySelectorAll('span')).find(s => s.className.includes(gameDOM.fragments.nicknameText)) as HTMLElement;
        if (!span) return;

        const nickname = span.innerText.trim();
        const ownerId = getCurrentUserId(), friendId = getPlayerUserId(nickname);
        const binding = ownerId && friendId ? `${ownerId}:${friendId}` : '';
        if (binding && menu.dataset.customCategoriesInjected === binding) return;
        menu.querySelector('.custom-category-row')?.remove();
        delete menu.dataset.customCategoriesInjected;
        if (!ownerId || !friendId) return;
        menu.dataset.customCategoriesInjected = binding;
        const row = document.createElement('div');
        row.className = 'custom-category-row';
        const cats = getCustomCategories();
        const currentColor = cats[friendId];

        const customButtons = [
            { type: 'purple', url: 'https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg' },
            { type: 'yellow', url: 'https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg' },
            { type: 'red', url: 'https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg' }
        ];

        customButtons.forEach(c => {
            const btn = document.createElement('div');
            btn.className = `custom-category-menu-btn ${currentColor === c.type ? 'active' : ''}`;
            btn.innerHTML = `<img src="${c.url}">`;
            btn.onclick = lifecycle.guard((e: MouseEvent) => {
                e.stopPropagation();
                if (ownerId !== getCurrentUserId() || getPlayerUserId(span.innerText.trim()) !== friendId) return;
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
        lifecycle.frame(() => {
            const rect = menu.getBoundingClientRect();
            const overflow = rect.bottom - window.innerHeight;
            if (overflow > 0) {
                const currentTop = parseFloat(menu.style.top) || rect.top;
                menu.style.top = `${currentTop - overflow - 8}px`;
            }
        });
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
            filtersConfig.forEach((config, index) => {
                const btn = document.createElement('div');
                btn.className = 'custom-filter-btn';
                if (index === 0) btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                lifecycle.listen(btn, 'click', () => {
                    sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    applyFilter(scrollBlock, config.type);
                });
                btn.appendChild(img);
                sidebar.appendChild(btn);
            });
            wrapper.appendChild(sidebar);
        } else {
            const parent = scrollBlock.parentNode as HTMLElement;
            if (!parent) return;
            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            const sidebar = document.createElement('div');
            sidebar.className = 'custom-friends-sidebar sidebar-invites';
            filtersConfig.forEach((config, index) => {
                const btn = document.createElement('div');
                btn.className = 'custom-filter-btn';
                if (index === 0) btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                lifecycle.listen(btn, 'click', () => {
                    sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    applyFilter(scrollBlock, config.type);
                });
                btn.appendChild(img);
                sidebar.appendChild(btn);
            });
            parent.insertBefore(sidebar, scrollBlock);
        }
    };

    lifecycle.onCleanup(() => {
        document.querySelectorAll('.custom-friends-sidebar, .custom-rarity-badge, .custom-category-row').forEach(node => node.remove());
        for (const [row, display] of originalDisplays) row.style.display = display;
        originalDisplays.clear();
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

            const isFriendsList = scrollBlock.classList.contains(gameDOM.classes.friendList);
            const itemSelector = isFriendsList ? gameDOM.friends.card : gameDOM.friends.invitationCard;

            scrollBlock.querySelectorAll(itemSelector).forEach(el => {
                updateCardBadge(el as HTMLElement, isFriendsList);
            });
        });

        const contextMenus = document.querySelectorAll(gameDOM.friends.contextMenu);
        contextMenus.forEach(node => {
            const menu = node as HTMLElement;
            injectCategoriesMenu(menu);
        });
    };
}, () => {});
