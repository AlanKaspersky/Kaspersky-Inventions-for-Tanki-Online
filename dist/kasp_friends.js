"use strict";
(function () {
    'use strict';
    if (localStorage.getItem('k_augments') !== 'true')
        return;
    const filtersConfig = [
        { url: "https://s.eu.tankionline.com/static/images/allPaints.741c65e1.svg", type: "all" },
        { url: "https://s.eu.tankionline.com/static/images/uncommon.ca77d7da.svg", type: "online" },
        { url: "https://s.eu.tankionline.com/static/images/iconCasualGray.3eea12e7.svg", type: "offline" },
        { url: "https://s.eu.tankionline.com/static/images/iconRareBlue.4e3c7303.svg", type: "clan" },
        { url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg", type: "purple" },
        { url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg", type: "yellow" },
        { url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg", type: "red" },
    ];
    const getCurrentNickname = () => {
        const userEl = document.querySelector('.UserInfoContainerStyle-userNameRank');
        if (!userEl)
            return "Unknown";
        const text = userEl.innerText.trim();
        const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
        return cleanName || "Unknown";
    };
    const getCustomCategories = () => {
        const myNick = getCurrentNickname();
        try {
            return JSON.parse(localStorage.getItem(`tankiCustomCategories_${myNick}`) || '{}');
        }
        catch (e) {
            return {};
        }
    };
    const setCustomCategory = (friendNickname, colorType) => {
        const myNick = getCurrentNickname();
        if (myNick === "Unknown")
            return;
        const cats = getCustomCategories();
        if (cats[friendNickname] === colorType) {
            delete cats[friendNickname];
        }
        else {
            cats[friendNickname] = colorType;
        }
        localStorage.setItem(`tankiCustomCategories_${myNick}`, JSON.stringify(cats));
        document.querySelectorAll('.custom-friends-sidebar').forEach(node => {
            const sidebar = node;
            const activeBtn = sidebar.querySelector('.custom-filter-btn.active');
            if (activeBtn)
                activeBtn.click();
        });
    };
    const getMyClanTag = () => {
        const userEl = (document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration') || document.querySelector('.UserInfoContainerStyle-userNameRank'));
        if (!userEl)
            return "";
        const text = userEl.innerText.trim();
        const match = text.match(/\[(.*?)\]/);
        return match ? match[0] : "";
    };
    const addCustomStyles = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            .custom-friends-sidebar {
                position: absolute;
                display: flex;
                flex-direction: column;
                align-items: center;
                z-index: 10;
            }

            .custom-friends-sidebar.sidebar-friends {
                top: 1.7em !important;
                left: -3.5em !important;
                gap: 0.25em;
            }
            .custom-friends-sidebar.sidebar-invites {
                top: 8.5em !important;
                left: -3.5em !important;
                gap: 0.25em;
            }

            .custom-filter-btn {
                display: flex; justify-content: center; align-items: center;
                width: 2.5em; height: 2.5em; cursor: pointer; border-radius: 6.25em; background-color: transparent;
            }

            .custom-filter-btn:hover { box-shadow: rgb(191, 213, 255) 0em 0em 0em 0.125em; }
            .custom-filter-btn:active, .custom-filter-btn.active { background-color: rgba(255, 255, 255, 0.15); }
            .custom-filter-btn img { width: 2.5em; height: 2.5em; pointer-events: none; }
            .custom-filter-btn:first-child img { width: 1.5em; height: 1.5em; }

            .custom-friends-sidebar.sidebar-invites .custom-filter-btn:nth-child(2),
            .custom-friends-sidebar.sidebar-invites .custom-filter-btn:nth-child(3) { display: none !important; }

            .FriendListComponentStyle-scrollCommunity {
                display: grid !important;
                grid-template-columns: repeat(2, 35em) !important;
                justify-content: space-between !important;
                row-gap: 0.5em !important;
                min-height: 50em !important;
                align-content: start !important;
                width: 72.375em !important;
                height: calc(100% - 661em) !important;
            }

            .FriendListComponentStyle-blockList {
                width: 35em !important;
                box-sizing: border-box;
                margin: 0 !important;
                position: relative !important;
            }

            .FriendListComponentStyle-stringCommunity { display: contents !important; }

            .InvitationWindowsComponentStyle-usersScroll {
                width: 100% !important;
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                column-gap: 0em !important;
                row-gap: 0.5em !important;
                align-content: start !important;
                box-sizing: border-box !important;
            }

            .InvitationWindowsComponentStyle-usersScroll > div {
                display: contents !important;
            }

            .InvitationWindowsComponentStyle-usersScroll > div > div {
                width: 35em !important;
                box-sizing: border-box;
                margin: 0 !important;
                position: relative !important;
            }

            .custom-rarity-badge {
                width: 0.75em !important;
                height: 0.75em !important;
                margin-left: 0px !important;
                position: absolute !important;
                top: 0px !important;
                left: 0px !important;
                z-index: 5;
                pointer-events: none;
            }

            .rarity-blue {
                filter: invert(34%) sepia(76%) saturate(2266%) hue-rotate(149deg) brightness(104%) contrast(103%);
            }

            .rarity-purple {
                filter: invert(34%) sepia(59%) saturate(1928%) hue-rotate(223deg) brightness(105%) contrast(102%);
            }

            .rarity-yellow {
                filter: invert(34%) sepia(48%) saturate(2983%) hue-rotate(359deg) brightness(104%) contrast(104%);
            }

            .rarity-red {
                filter: invert(71%) sepia(61%) saturate(2771%) hue-rotate(337deg) brightness(96%) contrast(111%);
            }

            .custom-category-row {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 0.75em;
                padding: 0.5em 0.5em;
                margin-top: 0.1em;
            }
            .custom-category-menu-btn {
                width: 2.5em;
                height: 2.5em;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: background-color, transform, box-shadow;
            }

            .custom-category-menu-btn:hover {
                box-shadow: rgb(191, 213, 255)  0em 0em 0em 0.125em;
            }

            .custom-category-menu-btn.active {
                background-color: rgba(255, 255, 255, 0.15);
            }
            .custom-category-menu-btn img {
                width: 2.5em;
                height: 2.5em;
                pointer-events: none;
            }
        `;
        if (document.head) {
            document.head.appendChild(style);
        }
        else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
    };
    const updateCardBadge = (el, isFriendsList) => {
        const cardText = el.innerText || "";
        const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
        const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
        const clanTag = getMyClanTag();
        const isClan = Boolean(clanTag && cardText.includes(clanTag));
        const cats = getCustomCategories();
        const customColor = cats[nickText];
        let rarityType = null;
        if (customColor) {
            rarityType = customColor;
        }
        else if (isClan) {
            rarityType = 'blue';
        }
        let badge = el.querySelector('.custom-rarity-badge');
        if (rarityType) {
            if (!badge) {
                badge = document.createElement('img');
                badge.src = 'https://s.eu.tankionline.com/static/images/categoryRarities.04cb4010.svg';
                badge.className = 'custom-rarity-badge';
                el.appendChild(badge);
            }
            badge.className = `custom-rarity-badge rarity-${rarityType}`;
            badge.style.display = '';
        }
        else {
            if (badge) {
                badge.style.display = 'none';
            }
        }
    };
    const applyFilter = (scrollBlock, filterType) => {
        const clanTag = getMyClanTag();
        const cats = getCustomCategories();
        const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
        const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
        const items = scrollBlock.querySelectorAll(itemSelector);
        items.forEach(node => {
            const el = node;
            updateCardBadge(el, isFriendsList);
            if (filterType === 'all') {
                el.style.display = '';
                return;
            }
            const cardText = el.innerText || "";
            const textLower = cardText.toLowerCase();
            const isOnline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-greenTextOnline') : (textLower.includes("в сети") || textLower.includes("online"));
            const isOffline = isFriendsList ? !!el.querySelector('.FriendListComponentStyle-offline') : !isOnline;
            const span = Array.from(el.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
            const nickText = span ? span.innerText.trim() : cardText.split('\n')[0].trim();
            let match = true;
            if (filterType === 'online')
                match = isOnline;
            else if (filterType === 'offline')
                match = isOffline;
            else if (filterType === 'clan')
                match = Boolean(clanTag && cardText.includes(clanTag));
            else if (['purple', 'yellow', 'red'].includes(filterType)) {
                match = (cats[nickText] === filterType);
            }
            el.style.display = match ? '' : 'none';
        });
    };
    const injectCategoriesMenu = (menu) => {
        if (menu.dataset.customCategoriesInjected === 'true')
            return;
        menu.dataset.customCategoriesInjected = 'true';
        const rankItem = menu.querySelector('.ContextMenuStyle-menuItemRank');
        if (!rankItem)
            return;
        const span = Array.from(rankItem.querySelectorAll('span')).find(s => s.className.includes('whiteSpaceNoWrap'));
        if (!span)
            return;
        const nickname = span.innerText.trim();
        const row = document.createElement('div');
        row.className = 'custom-category-row';
        const cats = getCustomCategories();
        const currentColor = cats[nickname];
        const customButtons = [
            { type: 'purple', url: 'https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg' },
            { type: 'yellow', url: 'https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg' },
            { type: 'red', url: 'https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg' }
        ];
        customButtons.forEach(c => {
            const btn = document.createElement('div');
            btn.className = `custom-category-menu-btn ${currentColor === c.type ? 'active' : ''}`;
            btn.innerHTML = `<img src="${c.url}">`;
            btn.onclick = (e) => {
                e.stopPropagation();
                setCustomCategory(nickname, c.type);
                row.querySelectorAll('.custom-category-menu-btn').forEach(b => b.classList.remove('active'));
                const newCats = getCustomCategories();
                if (newCats[nickname] === c.type) {
                    btn.classList.add('active');
                }
            };
            row.appendChild(btn);
        });
        menu.appendChild(row);
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            const overflow = rect.bottom - window.innerHeight;
            if (overflow > 0) {
                const currentTop = parseFloat(menu.style.top) || rect.top;
                menu.style.top = `${currentTop - overflow - 8}px`;
            }
        });
    };
    const setupSidebar = (scrollBlock) => {
        if (scrollBlock.dataset.sidebarInjected === 'true')
            return;
        scrollBlock.dataset.sidebarInjected = 'true';
        const isFriends = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
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
                if (index === 0)
                    btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                btn.addEventListener('click', () => {
                    sidebar.querySelectorAll('.custom-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    applyFilter(scrollBlock, config.type);
                });
                btn.appendChild(img);
                sidebar.appendChild(btn);
            });
            wrapper.appendChild(sidebar);
        }
        else {
            const parent = scrollBlock.parentNode;
            if (!parent)
                return;
            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            const sidebar = document.createElement('div');
            sidebar.className = 'custom-friends-sidebar sidebar-invites';
            filtersConfig.forEach((config, index) => {
                const btn = document.createElement('div');
                btn.className = 'custom-filter-btn';
                if (index === 0)
                    btn.classList.add('active');
                const img = document.createElement('img');
                img.src = config.url;
                btn.addEventListener('click', () => {
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
    function isBattleActive() {
        return !!document.querySelector('[class*="BattleHud"], [class*="BattleScreen"]');
    }
    const initObserver = () => {
        const observerConfig = { childList: true, subtree: true };
        const observer = new MutationObserver(() => {
            if (isBattleActive())
                return;
            if (localStorage.getItem('k_friends') !== 'true')
                return;
            observer.disconnect();
            const scrollBlocks = document.querySelectorAll('.FriendListComponentStyle-scrollCommunity, .InvitationWindowsComponentStyle-usersScroll');
            scrollBlocks.forEach(node => {
                const scrollBlock = node;
                if (scrollBlock.dataset.sidebarInjected !== 'true')
                    setupSidebar(scrollBlock);
                const isFriendsList = scrollBlock.classList.contains('FriendListComponentStyle-scrollCommunity');
                const itemSelector = isFriendsList ? '.FriendListComponentStyle-blockList' : '.InvitationWindowsComponentStyle-usersScroll > div > div';
                scrollBlock.querySelectorAll(itemSelector).forEach(el => {
                    updateCardBadge(el, isFriendsList);
                });
            });
            const contextMenus = document.querySelectorAll('.ContextMenuStyle-menu');
            contextMenus.forEach(node => {
                const menu = node;
                if (menu.dataset.customCategoriesInjected !== 'true')
                    injectCategoriesMenu(menu);
            });
            if (document.body)
                observer.observe(document.body, observerConfig);
        });
        const attachObserver = () => {
            if (document.body)
                observer.observe(document.body, observerConfig);
        };
        if (document.body)
            attachObserver();
        else
            document.addEventListener('DOMContentLoaded', attachObserver);
    };
    addCustomStyles();
    initObserver();
})();
