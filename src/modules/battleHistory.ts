import { state } from '../core/state';
import { utils } from '../core/utils';
import { DataLoader } from '../core/dataLoader';
import { equipmentTracker } from './equipmentTracker';

export const battleHistory = (() => {
    interface PlayerData {
        name: string;
        rank: string;
        gs: number;
        score: number;
        kills: number;
        deaths: number;
        kd: number;
        crystals: number;
        stars: number;
        isEnemy: boolean;
        isMe: boolean;
    }

    interface BattleData {
        id?: number;
        nickname: string;
        date: number;
        status: string;
        map: string;
        mode: string;
        kind?: 'MM' | 'PRO';
        top: string;
        reputation: number;
        kills: number;
        deaths: number;
        kd: number;
        crystals: number;
        stars: number;
        turretIcon: string;
        turretAugmentIcon: string;
        hullIcon: string;
        hullAugmentIcon: string;
        teamScoreMy?: number;
        teamScoreEnemy?: number;
        players?: PlayerData[];
    }

    let initialized = false;
    let battleProcessed = false;
    let historyBackSuppressedUntil = 0;
    let hasRenderedBattleList = false;
    let lastRenderedNewestBattleKey: string | null = null;
    let pendingBattleListAnimation = false;
    const NICK_KEY = 'kasp_last_nickname';
    let currentPage = 1;
    const ROWS_PER_PAGE = 15;

    const HISTORY_BG = 'radial-gradient(rgb(15, 17, 22) 0%, rgb(3, 5, 8) 100%)';

    let bhContainerEl: HTMLElement | null = null;
    let bhPreviousInlineBg: string | null = null;

    const applyHistoryBackground = (): void => {
        bhContainerEl =
            document.querySelector<HTMLElement>('#app-root > .-container') ??
            document.querySelector<HTMLElement>('.-container');
        if (!bhContainerEl) return;

        bhPreviousInlineBg = bhContainerEl.style.background || null;

        bhContainerEl.style.setProperty('background', HISTORY_BG, 'important');
    };

    const restoreContainerBackground = (): void => {
        if (!bhContainerEl) return;
        if (bhPreviousInlineBg) {
            bhContainerEl.style.background = bhPreviousInlineBg;
        } else {
            bhContainerEl.style.removeProperty('background');
        }
        bhContainerEl = null;
        bhPreviousInlineBg = null;
    };

    let bhExitAfterReturn = false;
    let bhReturnObserver: MutationObserver | null = null;

    const showFakeLoader = (): void => {
        document.querySelector('.kasp-loader-overlay')?.remove();

        const host =
            document.querySelector<HTMLElement>('#app-root > .-container') ??
            document.querySelector<HTMLElement>('.-container') ??
            document.body;
        const baseFont = getComputedStyle(host).fontSize;

        const overlay = document.createElement('div');
        overlay.className = 'kasp-loader-overlay';
        overlay.innerHTML = `
        <div class="kasp-loader-logo"></div>
        <div class="kasp-loader-bar">
            <span class="kasp-loader-text">Loading</span>
            <div class="kasp-loader-progress"></div>
        </div>
    `;
        overlay.style.setProperty('font-size', baseFont, 'important');

        document.body.appendChild(overlay);
    };

    const hideFakeLoader = (): void => {
        const overlay = document.querySelector<HTMLElement>('.kasp-loader-overlay');
        if (!overlay) return;

        overlay.style.setProperty('transition', 'opacity 0.1s ease', 'important');
        void overlay.offsetHeight;
        overlay.style.setProperty('opacity', '0', 'important');
        window.setTimeout(() => overlay.remove(), 120);
    };

    const flashHideSettings = (): void => {
        if (document.getElementById('bh-flash-cover')) return;

        const cover = document.createElement('div');
        cover.id = 'bh-flash-cover';
        cover.style.cssText = `
            position: fixed;
            inset: 0;
            background: radial-gradient(rgb(15, 17, 22) 0%, rgb(3, 5, 8) 100%);
            z-index: 99999;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.15s ease;
        `;
        document.body.appendChild(cover);

        const watch = new MutationObserver(() => {
            if (!document.querySelector('.BreadcrumbsComponentStyle-headerContainer')) {
                cover.style.opacity = '0';
                window.setTimeout(() => {
                    watch.disconnect();
                    cover.remove();
                }, 200);
            }
        });
        watch.observe(document.body, { childList: true, subtree: true });

        window.setTimeout(() => {
            watch.disconnect();
            cover.remove();
        }, 2000);
    };

    const disarmReturnWatcher = (): void => {
        bhExitAfterReturn = false;
        bhReturnObserver?.disconnect();
        bhReturnObserver = null;
    };

    const armExitAfterReturn = (): void => {
        bhExitAfterReturn = true;

        bhReturnObserver?.disconnect();
        bhReturnObserver = new MutationObserver(() => {
            if (!bhExitAfterReturn) return;

            if (!document.querySelector('.BreadcrumbsComponentStyle-headerContainer')) {
                bhExitAfterReturn = false;
                bhReturnObserver?.disconnect();
                bhReturnObserver = null;
                return;
            }

            const titleEl = document.querySelector<HTMLSpanElement>(
                '.BreadcrumbsComponentStyle-rootTitle > span'
            );

            const text = (titleEl?.textContent?.trim() ?? '').toUpperCase();
            if (text === 'SETTINGS' || text === 'НАСТРОЙКИ') {
                bhExitAfterReturn = false;
                bhReturnObserver?.disconnect();
                bhReturnObserver = null;

                showFakeLoader();

                const watch = new MutationObserver(() => {
                    if (!document.querySelector('.BreadcrumbsComponentStyle-headerContainer')) {
                        watch.disconnect();
                        hideFakeLoader();
                    }
                });
                watch.observe(document.body, { childList: true, subtree: true });

                window.setTimeout(() => {
                    watch.disconnect();
                    hideFakeLoader();
                }, 2000);

                setTimeout(() => {
                    const backBtn = document.querySelector<HTMLElement>(
                        '.BreadcrumbsComponentStyle-backButton'
                    );
                    if (backBtn) backBtn.click();
                }, 150);
            }
        });

        bhReturnObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        window.setTimeout(() => {
            if (bhExitAfterReturn) {
                disarmReturnWatcher();
            }
        }, 20000);
    };

    let bhTitleObserver: MutationObserver | null = null;

    const watchTitleChange = (overlay: HTMLElement, ourTitle: string): void => {
        bhTitleObserver?.disconnect();

        bhTitleObserver = new MutationObserver(() => {
            if (!document.querySelector('.BreadcrumbsComponentStyle-headerContainer')) return;

            const titleEl = document.querySelector<HTMLSpanElement>(
                '.BreadcrumbsComponentStyle-rootTitle > span'
            );
            if (!titleEl) return;

            if (titleEl.textContent?.trim() !== ourTitle) {
                closeHistoryOverlay(overlay, true);
            }
        });

        bhTitleObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    };

    let bhAutoCloseObserver: MutationObserver | null = null;

    const closeHistoryOverlay = (overlay: HTMLElement, auto = false): void => {
        overlay.style.display = 'none';
        restoreContainerBackground();

        const nativeContent = document.querySelector<HTMLElement>('.SettingsComponentStyle-container');
        if (nativeContent) nativeContent.style.display = '';

        bhAutoCloseObserver?.disconnect(); bhAutoCloseObserver = null;
        bhTitleObserver?.disconnect(); bhTitleObserver = null;
        bhHeaderObserver?.disconnect(); bhHeaderObserver = null;

        if (bhResizeHandler) {
            window.removeEventListener('resize', bhResizeHandler);
            bhResizeHandler = null;
        }

        const titleEl = document.querySelector<HTMLSpanElement>(
            '.BreadcrumbsComponentStyle-rootTitle > span'
        );
        const ourTitle = (t[state.lang] || t['EN']).title.toUpperCase();

        if (titleEl?.textContent?.trim() === ourTitle) {
            flashHideSettings();
            const backBtn = document.querySelector<HTMLElement>(
                '.BreadcrumbsComponentStyle-backButton'
            );
            if (backBtn) backBtn.click();
        } else if (auto) {
            armExitAfterReturn();
        }
    };

    const watchForAutoClose = (overlay: HTMLElement): void => {
        bhAutoCloseObserver?.disconnect();
        bhAutoCloseObserver = new MutationObserver(() => {
            const shop = document.querySelector('.NewShopCommonComponentStyle-commonContainer');
            const invites = document.querySelector('.InvitationWindowsComponentStyle-centerBlock');
            const progress = document.querySelector('.UserProgressComponentStyle-progressContainer');
            if (shop || invites || progress) {
                armExitAfterReturn();
                closeHistoryOverlay(overlay, true);
            }
        });
        bhAutoCloseObserver.observe(document.body, { childList: true, subtree: true });
    };

    let currentNickname = (() => {
        try {
            return localStorage.getItem(NICK_KEY) || 'Unknown';
        }
        catch {
            return 'Unknown';
        }
    })();;

    let historyPagePromise: Promise<void> | null = null;
    const updateNickname = (): boolean => {
        const nameEl = document.querySelector('.UserInfoContainerStyle-userNameRank.UserInfoContainerStyle-textDecoration, .UserInfoContainerStyle-userNameRank');
        if (!nameEl) return false;
        const text = nameEl.textContent?.trim() || '';
        const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
        if (!cleanName || cleanName === 'Unknown') return false;

        if (cleanName !== currentNickname) {
            const overlay = document.querySelector('.custom-history-overlay');
            if (overlay) overlay.remove();
            historyPagePromise = null;
            currentNickname = cleanName;
            try {
                localStorage.setItem(NICK_KEY, cleanName);
            } catch { }
        }
        return true;
    };

    const openDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TankiBattlesDB', 4);
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                let store: IDBObjectStore;
                if (!db.objectStoreNames.contains('battles')) {
                    store = db.createObjectStore('battles', { keyPath: 'id', autoIncrement: true });
                } else {
                    store = (event.target as IDBOpenDBRequest).transaction!.objectStore('battles');
                }
                if (!store.indexNames.contains('date')) store.createIndex('date', 'date', { unique: false });
                if (!store.indexNames.contains('map')) store.createIndex('map', 'map', { unique: false });
                if (!store.indexNames.contains('mode')) store.createIndex('mode', 'mode', { unique: false });
                if (!store.indexNames.contains('top')) store.createIndex('top', 'top', { unique: false });
                if (!store.indexNames.contains('nickname')) store.createIndex('nickname', 'nickname', { unique: false });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    const addBattle = async (battleData: BattleData): Promise<any> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('battles', 'readwrite');
            const store = transaction.objectStore('battles');
            const request = store.add(battleData);
            let id: IDBValidKey;
            request.onsuccess = () => { id = request.result; };
            transaction.oncomplete = () => { db.close(); resolve(id); };
            transaction.onerror = () => { db.close(); reject(transaction.error || request.error); };
            transaction.onabort = () => { db.close(); reject(transaction.error || request.error || new Error('Battle save was aborted')); };
        });
    };

    const addBattles = async (battles: BattleData[]): Promise<void> => {
        if (battles.length === 0) return;
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('battles', 'readwrite');
            const store = transaction.objectStore('battles');
            for (const battle of battles) store.add(battle);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Battle import failed'));
            transaction.onabort = () => reject(transaction.error || new Error('Battle import was aborted'));
        }).finally(() => db.close());
    };

    const getAllBattles = async (nickname: string): Promise<BattleData[]> => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('battles', 'readonly');
                const store = transaction.objectStore('battles');
                let request: IDBRequest;
                if (nickname && store.indexNames.contains('nickname')) {
                    request = store.index('nickname').getAll(nickname);
                } else {
                    request = store.getAll();
                }
                request.onsuccess = (e) => resolve((e.target as IDBRequest).result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('[Tanki Battle History] Error reading DB:', e);
            return [];
        }
    };

    const translateMapName = (rawMapWithMode: string, targetLang: string): string => {
        const cleanText = (rawMapWithMode || '').trim();
        if (!cleanText) return 'Unknown';
        const translated = DataLoader.translateMap(cleanText, targetLang);
        return translated || cleanText;
    };

    async function showClearConfirmModal(onConfirm: () => void) {
        const existing = document.getElementById('clear-confirm-overlay');
        if (existing) existing.remove();

        const lang = state.lang as 'RU' | 'EN';
        const translations: Record<'RU' | 'EN', any> = {
            RU: { title: 'ОЧИСТКА ИСТОРИИ', text: 'Вы уверены, что хотите удалить всю историю матчей?', cancel: 'Отмена', confirm: 'УДАЛИТЬ' },
            EN: { title: 'CLEAR HISTORY', text: 'Are you sure you want to delete all match history?', cancel: 'Cancel', confirm: 'DELETE' }
        };
        const dict = translations[lang] || translations['EN'];

        try {
            const response = await fetch(chrome.runtime.getURL('templates/clear-history-modal.html'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let html = await response.text();
            html = html
                .replace(/{{title}}/g, dict.title)
                .replace(/{{text}}/g, dict.text)
                .replace(/{{cancel}}/g, dict.cancel)
                .replace(/{{confirm}}/g, dict.confirm);

            const overlay = document.createElement('div');
            overlay.id = 'clear-confirm-overlay';
            overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;

            const dialog = document.createElement('div');
            dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75);`;
            dialog.innerHTML = html;
            overlay.appendChild(dialog);

            let isClosing = false;
            let onKeyHandler: ((e: KeyboardEvent) => void) | null = null;
            let onMouseHandler: ((e: MouseEvent) => void) | null = null;

            const cleanup = () => {
                if (onKeyHandler) {
                    document.removeEventListener('keydown', onKeyHandler, true);
                    onKeyHandler = null;
                }
                if (onMouseHandler) {
                    window.removeEventListener('mousedown', onMouseHandler, true);
                    onMouseHandler = null;
                }
            };

            function closeDialog() {
                if (!overlay.parentNode) return;
                cleanup();
                overlay.remove();
            }
            (overlay as any).closeDialogMethod = closeDialog;
            document.body.appendChild(overlay);

            onKeyHandler = (e: KeyboardEvent) => {
                if (isClosing) return;
                const isEsc = e.key === 'Escape' || e.key === 'Esc';
                const isZ = e.code === 'KeyZ' || (e.key && e.key.toLowerCase() === 'z');
                if (!isEsc && !isZ) return;
                isClosing = true;
                historyBackSuppressedUntil = Date.now() + 500;
                if (isZ) blockRemainingBackEvents();
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
            };
            document.addEventListener('keydown', onKeyHandler, true);

            const blockRemainingBackEvents = () => {
                const block = (e: MouseEvent) => {
                    if (e.button !== 3 && e.button !== 4) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                };
                window.addEventListener('mouseup', block, true);
                window.addEventListener('click', block, true);
                window.addEventListener('auxclick', block, true);
                window.setTimeout(() => {
                    window.removeEventListener('mouseup', block, true);
                    window.removeEventListener('click', block, true);
                    window.removeEventListener('auxclick', block, true);
                }, 700);
            };

            onMouseHandler = (e: MouseEvent) => {
                if (isClosing) return;
                if (e.button !== 3) return;
                isClosing = true;
                historyBackSuppressedUntil = Date.now() + 500;
                blockRemainingBackEvents();
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
            };
            window.addEventListener('mousedown', onMouseHandler, true);

            dialog.querySelector('#clear-dlg-confirm')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isClosing) {
                    isClosing = true;
                    closeDialog();
                    onConfirm();
                }
            });
            dialog.querySelector('#clear-dlg-cancel')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isClosing) {
                    isClosing = true;
                    closeDialog();
                }
            });
            dialog.querySelector('#clear-dlg-close')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isClosing) {
                    isClosing = true;
                    closeDialog();
                }
            });
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load clear history modal template:', error);
        }
    }

    const t: Record<string, any> = {
        RU: { title: 'История Битв', date: 'Дата', map: 'Карта', status: 'Статус', top: 'Место', mode: 'Режим', score: 'Очки', kills: 'К', deaths: 'Д', kd: 'У/С', turret: 'Пушка', hull: 'Корпус', augment: 'Устройство', crystals: 'Кристаллы', stars: 'Звёзды', win: 'Победа', lose: 'Поражение', draw: 'Ничья', dm: 'Каждый сам за себя', teamScore: 'Счёт', clear: 'Очистить', export: 'Экспорт', import: 'Импорт', battles: 'Боёв', noBattles: 'Пока нет сохранённых боёв', player: 'Игрок', gs: 'GS', diamond: 'DIAMOND', myTeam: 'Моя команда', enemyTeam: 'Команда противника', playersCount: 'игроков', allBattles: '‹ &nbsp; Все битвы', deleteBtn: 'Удалить', yourScore: 'Ваш счёт', yourKd: 'Ваш К/Д' },
        EN: { title: 'Battle History', date: 'Date', map: 'Map', status: 'Status', top: 'Top', mode: 'Mode', score: 'Score', kills: 'Kills', deaths: 'Deaths', kd: 'K/D', turret: 'Turret', hull: 'Hull', augment: 'Augment', crystals: 'Crystals', stars: 'Stars', win: 'Victory', lose: 'Defeat', draw: 'Draw', dm: 'Deathmatch', teamScore: 'Score', clear: 'Clear', export: 'Export', import: 'Import', battles: 'Battles', noBattles: 'No saved battles yet', player: 'Player', gs: 'GS', diamond: 'DIAMOND', myTeam: 'My Team', enemyTeam: 'Enemy Team', playersCount: 'players', allBattles: '‹ &nbsp; All battles', deleteBtn: 'Delete', yourScore: 'Your Score', yourKd: 'Your K/D' }
    };

    const waitForSelector = <T extends Element = Element>(
        selector: string,
        timeoutMs = 3000
    ): Promise<T | null> => {
        const existing = document.querySelector<T>(selector);
        if (existing) return Promise.resolve(existing);

        return new Promise<T | null>((resolve) => {
            const obs = new MutationObserver(() => {
                const el = document.querySelector<T>(selector);
                if (el) { obs.disconnect(); resolve(el); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            window.setTimeout(() => { obs.disconnect(); resolve(null); }, timeoutMs);
        });
    };

    let bhHeaderObserver: MutationObserver | null = null;
    let bhResizeHandler: (() => void) | null = null;

    const bindOverlayToHeader = (overlay: HTMLElement, header: HTMLElement): void => {
        const update = () => {
            const r = header.getBoundingClientRect();
            overlay.style.top = `${r.bottom}px`;
            overlay.style.height = `calc(100vh - ${r.bottom}px)`;
        };
        update();
        if (bhResizeHandler) window.removeEventListener('resize', bhResizeHandler);
        bhResizeHandler = update;
        window.addEventListener('resize', update);
    };

    const watchHeaderGone = (overlay: HTMLElement): void => {
        bhHeaderObserver?.disconnect();
        bhHeaderObserver = new MutationObserver(() => {
            if (!document.querySelector('.BreadcrumbsComponentStyle-headerContainer')) {
                overlay.style.display = 'none';
                restoreContainerBackground();
                bhHeaderObserver?.disconnect();
                bhHeaderObserver = null;
                if (bhResizeHandler) {
                    window.removeEventListener('resize', bhResizeHandler);
                    bhResizeHandler = null;
                }
            }
        });
        bhHeaderObserver.observe(document.body, { childList: true, subtree: true });
    };

    const openAsNativePage = async (overlay: HTMLElement): Promise<boolean> => {
        const dict = t[state.lang] || t['EN'];
        disarmReturnWatcher();

        let header = document.querySelector<HTMLElement>('.BreadcrumbsComponentStyle-headerContainer');

        if (!header) {
            const settingsBtn = [...document.querySelectorAll<HTMLElement>(
                '.PrimaryMenuItemComponentStyle-itemCommonLi.PrimaryMenuItemComponentStyle-menuItemContainer'
            )].find(el => {
                if (el.querySelector('.PrimaryMenuItemComponentStyle-itemLiOption')) return true;
                const name = (el.querySelector('.PrimaryMenuItemComponentStyle-itemName')
                    ?.textContent?.trim() ?? '').toUpperCase();
                return name === 'SETTINGS' || name === 'НАСТРОЙКИ';
            });

            if (!settingsBtn) {
                console.warn('[BattleHistory] settings trigger not found');
                return false;
            }

            settingsBtn.click();
            header = await waitForSelector<HTMLElement>(
                '.BreadcrumbsComponentStyle-headerContainer',
                3000
            );
        }
        if (!header) return false;

        const title = header.querySelector<HTMLSpanElement>('.BreadcrumbsComponentStyle-rootTitle > span');
        if (title) title.textContent = dict.title.toUpperCase();

        const nativeContent = document.querySelector<HTMLElement>('.SettingsComponentStyle-container');
        if (nativeContent) nativeContent.style.display = 'none';

        const ownHeader = overlay.querySelector<HTMLElement>('.custom-history-header');
        if (ownHeader) ownHeader.style.display = 'none';

        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '50';

        bindOverlayToHeader(overlay, header);
        watchHeaderGone(overlay);
        applyHistoryBackground();
        watchForAutoClose(overlay);
        watchTitleChange(overlay, dict.title.toUpperCase());

        overlay.style.display = 'flex';
        return true;
    };

    const parseMapAndMode = (rawMapText: string) => {
        if (!rawMapText) return { map: 'Unknown Map', mode: 'MM' };
        let text = rawMapText.trim();
        const modesList = ['CTF', 'TDM', 'DM', 'CP', 'SGE', 'RGB', 'JGR', 'TJR', 'ASL', 'AR'];
        let foundMode = 'MM';
        const parts = text.split(/\s+/);
        if (parts.length > 0) {
            const lastWord = parts[parts.length - 1].toUpperCase();
            if (modesList.includes(lastWord)) {
                foundMode = parts.pop() || 'MM';
                text = parts.join(' ');
            }
        }
        const cleanMapName = text.replace(/\s+/g, ' ').trim();
        return { map: cleanMapName || 'Unknown', mode: foundMode };
    };

    const MODE_ICONS: Record<string, string> = {
        TDM: 'https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg',
        CP: 'https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg',
        CTF: 'https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg',
        SGE: 'https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg',
        JGR: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg',
        TJR: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg',
        RGB: 'https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg',
        ASL: 'https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg',
        AR: 'https://ru.tankiwiki.com/images/ru/thumb/6/6c/AR_Icon.png/25px-AR_Icon.png',
    };

    const DM_SCORE_ICON = 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg';
    const DM_KD_ICON = 'https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg';

    const MAP_ICON_URL = chrome.runtime.getURL('assets/map-icon.png');
    let battleCardTemplatePromise: Promise<string> | null = null;

    const loadBattleCardTemplate = (): Promise<string> => {
        if (!battleCardTemplatePromise) {
            battleCardTemplatePromise = fetch(chrome.runtime.getURL('templates/battle-history-card.html'))
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load battle card template: ${response.status}`);
                    return response.text();
                });
        }
        return battleCardTemplatePromise;
    };

    let detailedViewTemplatePromise: Promise<string> | null = null;
    const loadDetailedViewTemplate = (): Promise<string> => {
        if (!detailedViewTemplatePromise) {
            detailedViewTemplatePromise = fetch(chrome.runtime.getURL('templates/battle-history-detail.html'))
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load battle detail template: ${response.status}`);
                    return response.text();
                });
        }
        return detailedViewTemplatePromise;
    };

    const animateHistoryTransition = (element: HTMLElement, className: string, duration: number): Promise<void> =>
        new Promise(resolve => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                element.removeEventListener('animationend', onAnimationEnd);
                element.classList.remove(className);
                resolve();
            };
            const onAnimationEnd = (event: AnimationEvent) => {
                if (event.target === element) finish();
            };

            element.classList.remove(className);
            void element.offsetWidth;
            element.addEventListener('animationend', onAnimationEnd);
            element.classList.add(className);
            window.setTimeout(finish, duration + 50);
        });

    const renderDetailedMatch = async (b: BattleData, dict: any, lang: string) => {
        const contentBlock = document.querySelector('.custom-history-content');
        if (!contentBlock) return;

        let template: string;
        try {
            template = await loadDetailedViewTemplate();
        } catch (error) {
            console.error('[Tanki Battle History] Failed to load detail template:', error);
            return;
        }

        const listPanel = contentBlock.querySelector('.bh-left-panel') as HTMLElement | null;
        if (listPanel) {
            await animateHistoryTransition(listPanel, 'bh-panel-leave', 200);
            clearBattleListAnimations(listPanel);
            listPanel.style.display = 'none';
        }

        const oldView = contentBlock.querySelector('.bh-detailed-view');
        if (oldView) oldView.remove();

        const detailedView = document.createElement('div');
        detailedView.className = 'bh-detailed-view page';
        detailedView.style.cssText = 'flex-grow: 1; overflow-y: auto; padding-right: 1em; width: 100%; box-sizing: border-box;';

        let myTeamHtml = '';
        let enemyTeamHtml = '';
        let myTeamCount = 0;
        let enemyTeamCount = 0;

        const getGsClass = (gs: number): string => {
            if (gs >= 9999) return 'gs-best';
            if (gs >= 9001) return 'gs-9000';
            if (gs >= 8001) return 'gs-8000';
            if (gs >= 7001) return 'gs-7000';
            if (gs >= 6001) return 'gs-6000';
            if (gs >= 5001) return 'gs-5000';
            if (gs >= 4001) return 'gs-4000';
            if (gs >= 3001) return 'gs-3000';
            if (gs >= 2001) return 'gs-2000';
            if (gs >= 1001) return 'gs-1000';
            return 'gs-0';
        };

        (b.players || []).forEach(p => {
            const isMeClass = p.isMe ? 'current-player' : '';
            const gsClass = getGsClass(p.gs);

            const gsFormatted = p.gs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
            const scoreFormatted = p.score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
            const crystalsFormatted = p.crystals.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

            const rowHtml = `
                        <tr class="${isMeClass}">
                            <td class="player-cell">
                                <div class="player-icons">
                                    <img class="player-icon" src="${p.rank}" style="width: 24px; height: 24px; border: none; background: transparent; padding: 0;">
                                </div>
                                <span class="player-name">${p.name}</span>
                            </td>
                            <td class="gs ${gsClass}">${gsFormatted}</td>
                            <td>${scoreFormatted}</td>
                            <td>${p.kills}</td>
                            <td>${p.deaths}</td>
                            <td>${p.kd.toFixed(2)}</td>
                            <td class="reward">${crystalsFormatted}</td>
                            <td class="stars">${p.stars}</td>
                        </tr>
                    `;
            if (p.isEnemy) {
                enemyTeamHtml += rowHtml;
                enemyTeamCount++;
            } else {
                myTeamHtml += rowHtml;
                myTeamCount++;
            }
        });

        const statusLower = (b.status || '').toLowerCase();
        const isWin = statusLower.includes('victory') || statusLower.includes('победа');
        const isDraw = statusLower.includes('draw') || statusLower.includes('ничья');
        const isDM = statusLower === 'dm' || statusLower.includes('каждый сам за себя') || String(b.mode).toUpperCase() === 'DM';

        let resultClass = isWin ? 'victory' : (isDraw ? 'draw' : 'defeat');
        let resultText = isWin ? dict.win : (isDraw ? dict.draw : dict.lose);

        if (isDM) {
            resultClass = 'draw';
            const place = b.top && b.top !== '-' ? b.top : null;
            resultText = place
                ? (lang === 'RU' ? `#${place} МЕСТО` : `#${place} PLACE`)
                : dict.dm;
        }

        const hasTeamScores =
            !isDM
            && typeof b.teamScoreMy === 'number'
            && typeof b.teamScoreEnemy === 'number';

        const leftLabel = hasTeamScores ? dict.myTeam : dict.yourScore;
        const leftValue = hasTeamScores
            ? (b.teamScoreMy as number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")
            : (b.reputation || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

        const rightLabel = hasTeamScores ? dict.enemyTeam : dict.yourKd;
        const rightValue = hasTeamScores
            ? (b.teamScoreEnemy as number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")
            : (b.kd || 0).toFixed(2);

        const modeUpperKey = String(b.mode || 'MM').toUpperCase();

        let leftIconUrl: string;
        let rightIconUrl: string;

        if (isDM) {
            leftIconUrl = DM_SCORE_ICON;
            rightIconUrl = DM_KD_ICON;
        } else if (hasTeamScores) {
            const teamIcon = MODE_ICONS[modeUpperKey] || MODE_ICONS['TDM'];
            leftIconUrl = teamIcon;
            rightIconUrl = teamIcon;
        } else {
            leftIconUrl = DM_SCORE_ICON;
            rightIconUrl = DM_KD_ICON;
        }

        const mapInfo = DataLoader.getMapInfo(b.map);
        const localizedMap = (mapInfo ? (lang === 'RU' ? mapInfo.ru : mapInfo.en) : translateMapName(b.map, lang)) || 'Unknown';

        const dateObj = new Date(b.date);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        function playersWord(n, lang) {
            if (lang === 'RU') {
                const mod10 = n % 10, mod100 = n % 100;
                if (mod10 === 1 && mod100 !== 11) return 'игрок';
                if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'игрока';
                return 'игроков';
            }
            return n === 1 ? 'player' : 'players';
        }

        const replacements: Record<string, string> = {
            backLabel: dict.allBattles,
            deleteLabel: dict.deleteBtn,
            leftScoreClass: isDM ? 'dm' : '',
            leftIconUrl,
            leftLabel,
            leftValue,
            mode: b.mode || 'MM',
            date: dateStr,
            time: timeStr,
            playerCount: String((b.players || []).length),
            playersLabel: dict.playersCount,
            map: localizedMap,
            resultClass,
            resultText,
            rightScoreClass: isDM ? 'dm' : '',
            rightIconUrl,
            rightLabel,
            rightValue,
            statsClass: enemyTeamCount === 0 ? 'solo-mode' : '',
            playerLabel: dict.player,
            gsLabel: dict.gs,
            scoreLabel: dict.score,
            myTeamClass: myTeamCount > 0 ? '' : 'bh-hidden',
            myTeamTitle: isDM ? dict.player : dict.myTeam,
            myTeamCount: `${myTeamCount}&nbsp;${playersWord(myTeamCount, lang)}`,
            myTeamRows: myTeamHtml,
            enemyTeamClass: enemyTeamCount > 0 ? '' : 'bh-hidden',
            enemyTeamTitle: dict.enemyTeam,
            enemyTeamCount: `${enemyTeamCount}&nbsp;${playersWord(enemyTeamCount, lang)}`,
            enemyTeamRows: enemyTeamHtml,
        };
        let html = template;
        for (const [key, value] of Object.entries(replacements)) {
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value);
        }
        detailedView.innerHTML = html;

        contentBlock.appendChild(detailedView);
        void animateHistoryTransition(detailedView, 'bh-detail-enter', 240);

        let isReturningToList = false;
        const returnToList = async () => {
            if (isReturningToList) return;
            isReturningToList = true;
            await animateHistoryTransition(detailedView, 'bh-detail-leave', 200);
            detailedView.remove();
            if (listPanel) {
                listPanel.style.display = 'flex';
                void animateHistoryTransition(listPanel, 'bh-panel-enter', 240);
            }
        };

        detailedView.querySelector('#bh-detailed-back')?.addEventListener('click', () => {
            void returnToList();
        });

        detailedView.querySelector('#bh-detailed-delete')?.addEventListener('click', async () => {
            try {
                const db = await openDB();
                const transaction = db.transaction('battles', 'readwrite');
                const store = transaction.objectStore('battles');
                if (b.id !== undefined) {
                    store.delete(b.id);
                }
                await returnToList();
                renderBattleList(currentPage);
            } catch (e) {
                console.error('[Tanki Battle History] Error deleting battle:', e);
            }
        });
    };

    const buildBattleCard = async (b: BattleData, dict: any, lang: string): Promise<HTMLElement> => {
        const dateObj = new Date(b.date);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusLower = (b.status || '').toLowerCase();
        const isWin = statusLower.includes('victory') || statusLower.includes('победа');
        const isDraw = statusLower.includes('draw') || statusLower.includes('ничья');
        const isDM = statusLower === 'dm' || statusLower.includes('каждый сам за себя') || String(b.mode).toUpperCase() === 'DM';
        let statusClass = 'bh-card-result--loss';
        let statusLocalized = dict.lose;
        if (isDM) {
            statusClass = 'bh-card-result--dm';
            statusLocalized = dict.dm;
        }
        else if (isWin) {
            statusClass = 'bh-card-result--win';
            statusLocalized = dict.win;
        }
        else if (isDraw) {
            statusClass = 'bh-card-result--draw';
            statusLocalized = dict.draw;
        }
        const mapInfo = DataLoader.getMapInfo(b.map);
        const localizedMap = (mapInfo
            ? (lang === 'RU' ? mapInfo.ru : mapInfo.en)
            : translateMapName(b.map, lang)) || 'Unknown';
        const mapUpper = String(localizedMap).toUpperCase();
        const mapImage = mapInfo && mapInfo.image ? mapInfo.image : '';
        const modeUpper = String(b.mode || 'MM').toUpperCase();
        const topDisplay = b.top && b.top !== '-' ? `#${b.top}` : '—';
        const hasTeamScore = !isDM && typeof b.teamScoreMy === 'number' && typeof b.teamScoreEnemy === 'number';
        const teamScoreStat = hasTeamScore
            ? `<div class="bh-stat"><span class="bh-stat-value">${b.teamScoreMy}<span class="bh-stat-sep">/</span>${b.teamScoreEnemy}</span><span class="bh-stat-label bh-stat-label--team-score">${dict.teamScore}</span></div>`
            : '';

        const turretIcon = b.turretIcon
            ? `<img class="bh-equip-img" src="${b.turretIcon}" alt="">`
            : `<div class="bh-equip-placeholder">▰</div>`;
        const turretAugIcon = b.turretAugmentIcon
            ? `<img class="bh-equip-img" src="${b.turretAugmentIcon}" alt="">`
            : `<div class="bh-equip-placeholder">◇</div>`;
        const hullIcon = b.hullIcon
            ? `<img class="bh-equip-img" src="${b.hullIcon}" alt="">`
            : `<div class="bh-equip-placeholder">▱</div>`;
        const hullAugIcon = b.hullAugmentIcon
            ? `<img class="bh-equip-img" src="${b.hullAugmentIcon}" alt="">`
            : `<div class="bh-equip-placeholder">◇</div>`;

        const replacements: Record<string, string> = {
            cardClass: `${statusClass} ${b.turretAugmentIcon || b.hullAugmentIcon ? '' : 'bh-card--no-aug'}`,
            combatStatsClass: hasTeamScore ? 'bh-combat-stats--with-team-score' : '',
            mapStyle: mapImage ? `style="background-image: linear-gradient(90deg, rgba(10,10,10,0.15), rgba(10,10,10,0.75)), url('${mapImage}'); background-size: cover; background-position: center;"` : '',
            mapIconUrl: MAP_ICON_URL,
            mapUpper,
            mapLabel: dict.map,
            statusLocalized,
            scoreValue: String(b.reputation ?? 0),
            scoreLabel: dict.score,
            killsValue: String(b.kills ?? 0),
            deathsValue: String(b.deaths ?? 0),
            killsLabel: dict.kills,
            deathsLabel: dict.deaths,
            teamScoreStat,
            topDisplay,
            topLabel: dict.top,
            turretIcon,
            turretLabel: dict.turret,
            turretAugIcon,
            augmentLabel: dict.augment,
            hullIcon,
            hullLabel: dict.hull,
            hullAugIcon,
            modeIcon: b.kind === 'PRO' ? 'PRO' : 'MM',
            modeIconClass: b.kind === 'PRO' ? 'bh-mode-icon--pro' : 'bh-mode-icon--mm',
            modeUpper,
            crystalsValue: (b.crystals ?? 0).toLocaleString(),
            starsValue: String(b.stars ?? 0),
            dateTime: `${dateStr} · ${timeStr}`
        };

        let html = await loadBattleCardTemplate();
        for (const [key, value] of Object.entries(replacements)) {
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        const card = document.createElement('article');
        card.innerHTML = html;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => renderDetailedMatch(b, dict, lang));
        return card;
    };

    const buildPageNumbers = (current: number, total: number): (number | string)[] => {
        if (total <= 7) {
            const arr: number[] = [];
            for (let i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        const result: (number | string)[] = [];
        result.push(1);
        if (current > 4) result.push('…');
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) result.push(i);
        if (current < total - 3) result.push('…');
        result.push(total);
        return result;
    };

    const renderPagination = (current: number, total: number) => {
        const list = document.getElementById('bh-page-list');
        if (!list) return;
        list.textContent = '';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'bh-page bh-page-arrow';
        prev.textContent = '‹';
        prev.disabled = current <= 1;
        prev.addEventListener('click', () => renderBattleList(current - 1));
        list.appendChild(prev);

        const pages = buildPageNumbers(current, total);
        for (const p of pages) {
            if (p === '…') {
                const dots = document.createElement('span');
                dots.className = 'bh-page bh-page-dots';
                dots.textContent = '…';
                list.appendChild(dots);
                continue;
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bh-page' + (p === current ? ' bh-page-active' : '');
            btn.textContent = String(p);
            btn.addEventListener('click', () => renderBattleList(p as number));
            list.appendChild(btn);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'bh-page bh-page-arrow';
        next.textContent = '›';
        next.disabled = current >= total;
        next.addEventListener('click', () => renderBattleList(current + 1));
        list.appendChild(next);
    };

    const getBattleKey = (battle: BattleData): string =>
        battle.id !== undefined ? `id:${battle.id}` : `date:${battle.date}|${battle.map}|${battle.mode}`;

    const playPendingBattleListAnimation = () => {
        if (!pendingBattleListAnimation) return;
        const listEl = document.querySelector<HTMLElement>('.bh-list');
        if (listEl) {
            listEl.classList.add('bh-list--animations-ready');
            listEl.querySelectorAll<HTMLElement>('.bh-card--rise-in').forEach(card => {
                const delay = parseFloat(card.style.animationDelay) || 0;
                window.setTimeout(() => {
                    card.classList.remove('bh-card--rise-in');
                    card.style.removeProperty('animation-delay');
                    card.style.removeProperty('z-index');
                    if (!listEl.querySelector('.bh-card--rise-in')) {
                        listEl.classList.remove('bh-list--animations-ready');
                    }
                }, delay + 400);
            });
        }
        pendingBattleListAnimation = false;
    };

    const clearBattleListAnimations = (panel: HTMLElement) => {
        panel.querySelectorAll<HTMLElement>('.bh-card--rise-in, .bh-card--new-in, .bh-card--push-down').forEach(card => {
            card.classList.remove('bh-card--rise-in', 'bh-card--new-in', 'bh-card--push-down');
            card.style.removeProperty('animation-delay');
            card.style.removeProperty('z-index');
            card.style.removeProperty('--bh-push-distance');
        });
        panel.querySelector('.bh-list')?.classList.remove('bh-list--animations-ready');
        pendingBattleListAnimation = false;
    };

    const renderBattleList = async (page = 1, animateNewMatches = false) => {
        updateNickname();
        const listEl = document.querySelector('.bh-list');
        if (!listEl) return;

        const lang = state.lang;
        const dict = t[lang] || t['EN'];
        const battles = await getAllBattles(currentNickname);

        battles.sort((a, b) => b.date - a.date);
        const newestBattleKey = battles.length > 0 ? getBattleKey(battles[0]) : null;
        let animationMode: 'initial' | 'new-match' | null = null;
        if (animateNewMatches && page === 1) {
            if (!hasRenderedBattleList && battles.length > 0) {
                animationMode = 'initial';
            } else if (newestBattleKey && newestBattleKey !== lastRenderedNewestBattleKey) {
                animationMode = 'new-match';
            }
        }
        if (page === 1) {
            hasRenderedBattleList = true;
            lastRenderedNewestBattleKey = newestBattleKey;
        }

        listEl.classList.remove('bh-list--animations-ready');
        pendingBattleListAnimation = false;
        const totalPages = Math.max(1, Math.ceil(battles.length / ROWS_PER_PAGE));
        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;
        currentPage = page;

        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const pageBattles = battles.slice(startIndex, startIndex + ROWS_PER_PAGE);

        listEl.innerHTML = '';
        if (pageBattles.length === 0) {
            listEl.innerHTML = `<div class="bh-empty">${dict.noBattles}</div>`;
        } else {
            const cards = await Promise.all(pageBattles.map(b => buildBattleCard(b, dict, lang)));
            cards.forEach((card, index) => {
                const visualCard = card.querySelector<HTMLElement>('.bh-card');
                if (visualCard && animationMode === 'initial') {
                    visualCard.classList.add('bh-card--rise-in');
                    const delay = index * 60;
                    visualCard.style.animationDelay = `${delay}ms`;
                    visualCard.style.zIndex = String(cards.length - index);
                } else if (visualCard && animationMode === 'new-match') {
                    if (index === 0) {
                        visualCard.classList.add('bh-card--new-in');
                    } else {
                        visualCard.classList.add('bh-card--push-down');
                    }
                }
                listEl.appendChild(card);
            });

            if (animationMode === 'new-match' && cards.length > 1) {
                const newCard = cards[0].querySelector<HTMLElement>('.bh-card');
                const gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
                const pushDistance = (newCard?.getBoundingClientRect().height || 0) + gap;
                cards.slice(1).forEach(card => {
                    card.querySelector<HTMLElement>('.bh-card')?.style.setProperty('--bh-push-distance', `-${pushDistance}px`);
                });
            }

            pendingBattleListAnimation = animationMode !== null;
        }

        renderPagination(currentPage, totalPages);
        const totalEl = document.getElementById('bh-total-battles');
        if (totalEl) totalEl.textContent = String(battles.length);
    };

    const clearHistoryDb = () => {
        showClearConfirmModal(async () => {
            try {
                const db = await openDB();
                const transaction = db.transaction('battles', 'readwrite');
                const store = transaction.objectStore('battles');
                const request = store.index('nickname').getAllKeys(currentNickname);
                request.onsuccess = () => {
                    request.result.forEach((key) => store.delete(key));
                    renderBattleList(1);
                };
            } catch (e) {
                console.error('[Tanki Battle History] Error clearing DB:', e);
            }
        });
    };

    const exportHistoryData = async () => {
        const battles = await getAllBattles(currentNickname);
        if (battles.length === 0) return;
        const blob = new Blob([JSON.stringify(battles, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tanki_BattleHistory_${currentNickname}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const validateImportedBattle = (value: unknown): BattleData | null => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const battle = value as Record<string, unknown>;
        const requiredStrings = ['nickname', 'status', 'map', 'mode', 'top'];
        const requiredNumbers = ['date', 'reputation', 'kills', 'deaths', 'kd', 'crystals', 'stars'];

        if (requiredStrings.some(key => typeof battle[key] !== 'string')) return null;
        if (requiredNumbers.some(key => typeof battle[key] !== 'number' || !Number.isFinite(battle[key] as number))) return null;
        if (typeof battle.date !== 'number' || (battle.date as number) <= 0) return null;
        if (battle.kind !== undefined && battle.kind !== 'MM' && battle.kind !== 'PRO') return null;

        const iconFields = ['turretIcon', 'turretAugmentIcon', 'hullIcon', 'hullAugmentIcon'];
        if (iconFields.some(key => battle[key] !== undefined && typeof battle[key] !== 'string')) return null;
        const teamFields = ['teamScoreMy', 'teamScoreEnemy'];
        if (teamFields.some(key => battle[key] !== undefined && (typeof battle[key] !== 'number' || !Number.isFinite(battle[key] as number)))) return null;

        let players: PlayerData[] = [];
        if (battle.players !== undefined) {
            if (!Array.isArray(battle.players)) return null;
            for (const value of battle.players) {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
                const player = value as Record<string, unknown>;
                if (typeof player.name !== 'string' || typeof player.rank !== 'string') return null;
                const numericFields = ['gs', 'score', 'kills', 'deaths', 'kd', 'crystals', 'stars'];
                if (numericFields.some(key => typeof player[key] !== 'number' || !Number.isFinite(player[key] as number))) return null;
                if (typeof player.isEnemy !== 'boolean' || typeof player.isMe !== 'boolean') return null;
                players.push({
                    name: player.name,
                    rank: player.rank,
                    gs: player.gs as number,
                    score: player.score as number,
                    kills: player.kills as number,
                    deaths: player.deaths as number,
                    kd: player.kd as number,
                    crystals: player.crystals as number,
                    stars: player.stars as number,
                    isEnemy: player.isEnemy,
                    isMe: player.isMe,
                });
            }
        }

        return {
            nickname: battle.nickname as string,
            date: battle.date as number,
            status: battle.status as string,
            map: battle.map as string,
            mode: battle.mode as string,
            kind: battle.kind as 'MM' | 'PRO' | undefined,
            top: battle.top as string,
            reputation: battle.reputation as number,
            kills: battle.kills as number,
            deaths: battle.deaths as number,
            kd: battle.kd as number,
            crystals: battle.crystals as number,
            stars: battle.stars as number,
            turretIcon: (battle.turretIcon as string) || '',
            turretAugmentIcon: (battle.turretAugmentIcon as string) || '',
            hullIcon: (battle.hullIcon as string) || '',
            hullAugmentIcon: (battle.hullAugmentIcon as string) || '',
            teamScoreMy: battle.teamScoreMy as number | undefined,
            teamScoreEnemy: battle.teamScoreEnemy as number | undefined,
            players,
        };
    };

    const importHistoryData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    const data: unknown = JSON.parse(String(ev.target?.result ?? ''));
                    if (!Array.isArray(data) || data.length === 0) throw new Error('empty-or-invalid-list');
                    const battles = data.map(validateImportedBattle);
                    if (battles.some(battle => battle === null)) throw new Error('invalid-battle-record');
                    await addBattles(battles as BattleData[]);
                    await renderBattleList(1);
                    window.alert(state.lang === 'RU'
                        ? `Импортировано боёв: ${battles.length}.`
                        : `Imported battles: ${battles.length}.`);
                } catch (err) {
                    console.error('[Tanki Battle History] Import error:', err);
                    window.alert(state.lang === 'RU'
                        ? 'Не удалось импортировать файл. Проверьте, что это JSON-файл истории битв.'
                        : 'Could not import this file. Check that it is a valid battle history JSON file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const createHistoryPage = async () => {
        if (document.querySelector('.custom-history-overlay')) return;

        updateNickname();
        const lang = state.lang;
        const dict = t[lang] || t['EN'];

        try {
            const templateUrl = chrome.runtime.getURL('templates/battle-history-overlay.html');
            const response = await fetch(templateUrl);
            if (!response.ok) {
                throw new Error(`Failed to load history template: ${response.status}`);
            }
            const template = await response.text();
            const replacements: Record<string, string> = {
                title: String(dict.title ?? ''),
                clear: String(dict.clear ?? ''),
                export: String(dict.export ?? ''),
                import: String(dict.import ?? ''),
                battles: String(dict.battles ?? 'Боёв')
            };

            let html = template;
            for (const [key, value] of Object.entries(replacements)) {
                html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }

            const overlay = document.createElement('div');
            overlay.className = 'custom-history-overlay';
            overlay.style.display = 'none';
            overlay.innerHTML = html;
            document.body.appendChild(overlay);
            overlay.querySelector('.custom-history-close')?.addEventListener('click', () => {
                closeHistoryOverlay(overlay);
            });

            document.getElementById('bh-clear-btn')?.addEventListener('click', clearHistoryDb);
            document.getElementById('bh-export-btn')?.addEventListener('click', exportHistoryData);
            document.getElementById('bh-import-btn')?.addEventListener('click', importHistoryData);
        } catch (error) {
            console.error('[Tanki Battle History] Error loading overlay template:', error);
        }
    };

    const ensureHistoryPage = () => {
        if (!historyPagePromise) {
            historyPagePromise = createHistoryPage();
        }
        return historyPagePromise;
    };

    const injectFooterButton = () => {
        const footerList = document.querySelector('.FooterComponentStyle-footer ul');
        if (!footerList || footerList.querySelector('.custom-history-button')) return;

        const lang = state.lang;
        const dict = t[lang] || t['EN'];
        const btn = document.createElement('li');
        btn.className = 'FooterComponentStyle-containerMenu custom-history-button';
        btn.innerHTML = '<div></div>';
        btn.title = dict.title;

        btn.addEventListener('click', async () => {
            const hidden: Array<{ el: HTMLElement; prev: string }> = [];

            const hideGameUI = () => {
                const children = Array.from(document.body.children) as HTMLElement[];
                for (const el of children) {
                    if (el.classList.contains('kasp-loader-overlay')) continue;
                    if (el.classList.contains('custom-history-overlay')) continue;
                    if (el.id === 'quick-upgrade-overlay') continue;
                    if (el.id === 'kasp-welcome-overlay') continue;
                    if (el.id === 'kasp-specs-tooltip') continue;
                    hidden.push({ el, prev: el.style.visibility });
                    el.style.visibility = 'hidden';
                }
                document.documentElement.style.visibility = 'hidden';
                document.body.style.visibility = 'visible';
            };

            const showGameUI = () => {
                for (const { el, prev } of hidden) {
                    el.style.visibility = prev;
                }
                hidden.length = 0;
                document.documentElement.style.visibility = '';
            };

            try {
                showFakeLoader();
                hideGameUI();

                await ensureHistoryPage();
                const overlay = document.querySelector<HTMLElement>('.custom-history-overlay');
                if (!overlay) return;
                await renderBattleList(1, true);

                const duration = 500 + Math.random() * 2500;
                await new Promise<void>((r) => window.setTimeout(r, duration));

                const ok = await openAsNativePage(overlay);
                if (!ok) {
                    overlay.style.top = '0';
                    overlay.style.height = '100vh';
                    overlay.style.display = 'flex';
                }
                playPendingBattleListAnimation();

                showGameUI();

                await new Promise<void>((resolve) => {
                    let frames = 0;
                    const tick = () => {
                        frames++;
                        if (frames >= 3) resolve();
                        else requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                });
            } finally {
                showGameUI();
                hideFakeLoader();
            }
        });
        footerList.appendChild(btn);
    };

    const extractAndSaveBattleResult = async () => {
        updateNickname();
        const selfRow = document.querySelector('#selfUserBg');
        if (!selfRow || battleProcessed) return;

        if (currentNickname === 'Unknown') {
            const nickCell = selfRow.querySelector('.BattleKillBoardComponentStyle-col1, [class*="BattleKillBoardComponentStyle-col1"]');
            if (nickCell) {
                const raw = (nickCell.textContent || '').trim();
                const clean = raw.replace(/^\[.*?\]\s*/, '').trim();
                if (clean && clean !== 'Unknown') {
                    currentNickname = clean;
                    try {
                        localStorage.setItem(NICK_KEY, clean);
                    } catch { }
                }
            }
        }
        if (currentNickname === 'Unknown') return;

        try {
            const scoreEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col3');
            const killsEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col4');
            const deathsEl = selfRow.querySelector('.BattleKillBoardComponentStyle-col5');
            if (!scoreEl || !killsEl || !deathsEl) return;

            const scoreText = (scoreEl.textContent || '').trim();
            const killsText = (killsEl.textContent || '').trim();
            const deathsText = (deathsEl.textContent || '').trim();
            if (!scoreText || !killsText || !deathsText) return;

            battleProcessed = true;
            let players: PlayerData[] = [];
            const tbody = document.querySelector('.TableComponentStyle-tBody');

            if (tbody) {
                const allRows = Array.from(tbody.children);
                let isEnemyTeam = false;
                for (const row of allRows) {
                    if (row.id === 'rowSpace') continue;
                    if (row.id === 'teamRowSpace') {
                        isEnemyTeam = true;
                        continue;
                    }

                    const nickEl = row.querySelector('[class*="BattleKillBoardComponentStyle-col1"] span.-whiteSpaceNoWrap');
                    if (!nickEl) continue;
                    const rawNick = nickEl.textContent || '';
                    const rankImg = row.querySelector('.BattleKillBoardComponentStyle-rankIcon') as HTMLImageElement | null;
                    const rankSrc = rankImg ? rankImg.src : '';
                    const gsEl = row.querySelector('.BattleKillBoardComponentStyle-col2 span');
                    const gs = gsEl ? gsEl.textContent?.trim().replace(/\s/g, '') : '0';

                    const pScore = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col3')?.textContent || '0').replace(/\s/g, '')) || 0;
                    const pKills = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col4')?.textContent || '0').replace(/\s/g, '')) || 0;
                    const pDeaths = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col5')?.textContent || '0').replace(/\s/g, '')) || 0;
                    const pKd = parseFloat(row.querySelector('.BattleKillBoardComponentStyle-col6')?.textContent || '0') || 0;
                    const pCrystals = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col7')?.textContent || '0').replace(/\s/g, '')) || 0;
                    const pStars = parseInt((row.querySelector('.BattleKillBoardComponentStyle-col8')?.textContent || '0').replace(/\s/g, '')) || 0;

                    const isMe = row.id === 'selfUserBg';

                    players.push({
                        name: rawNick,
                        rank: rankSrc,
                        gs: parseInt(gs || '0') || 0,
                        score: pScore, kills: pKills, deaths: pDeaths, kd: pKd, crystals: pCrystals, stars: pStars,
                        isEnemy: isEnemyTeam,
                        isMe: isMe
                    });
                }
            }

            const mapEl = document.querySelector('.BattleResultHeaderComponentStyle-mapName');
            const rawMapText = mapEl ? mapEl.textContent?.trim() || '' : 'Unknown Map';
            const parsedMapData = parseMapAndMode(rawMapText);
            const statusEl = document.querySelector('.BattleResultHeaderComponentStyle-resultText') ||
                document.querySelector('[class*="descriptionVictory"], [class*="descriptionDefeat"], [class*="descriptionDraw"]');
            const isDM = parsedMapData.mode.toUpperCase() === 'DM' || (statusEl && statusEl.textContent?.trim() === '');
            if (isDM) {
                for (const p of players) {
                    p.isEnemy = !p.isMe;
                }
            }
            const statusText = isDM ? 'DM' : (statusEl ? statusEl.textContent?.trim() || 'Victory' : 'Victory');

            let topVal = '-';
            if (selfRow.parentElement) {
                const allRows = Array.from(selfRow.parentElement.children);
                const selfIndex = allRows.indexOf(selfRow);
                const teamDividerIndex = allRows.findIndex((r) => r.id === 'teamRowSpace');
                let teamRows = [];
                if (teamDividerIndex === -1) teamRows = allRows;
                else if (selfIndex < teamDividerIndex) teamRows = allRows.slice(0, teamDividerIndex);
                else teamRows = allRows.slice(teamDividerIndex + 1);

                const actualPlayers = teamRows.filter((r) => r.id && r.id !== 'rowSpace' && r.id !== 'teamRowSpace');
                const rank = actualPlayers.indexOf(selfRow) + 1;
                if (rank > 0) topVal = rank.toString();
            }

            let teamScoreMy: number | undefined;
            let teamScoreEnemy: number | undefined;
            if (!isDM) {
                const firstScoreEl = document.querySelector<HTMLElement>(
                    '.BattleResultHeaderComponentStyle-firstTeamAccount .BattleResultHeaderComponentStyle-teamAccount'
                );
                const secondScoreEl = document.querySelector<HTMLElement>(
                    '.BattleResultHeaderComponentStyle-twoTeamAccount .BattleResultHeaderComponentStyle-teamAccount'
                );
                const firstScore = firstScoreEl
                    ? parseInt((firstScoreEl.textContent || '').replace(/\s/g, ''), 10)
                    : NaN;
                const secondScore = secondScoreEl
                    ? parseInt((secondScoreEl.textContent || '').replace(/\s/g, ''), 10)
                    : NaN;

                let amIFirstTeam = true;
                if (selfRow.parentElement) {
                    const allRows = Array.from(selfRow.parentElement.children);
                    const selfIndex = allRows.indexOf(selfRow);
                    const teamDividerIndex = allRows.findIndex((r) => r.id === 'teamRowSpace');
                    if (teamDividerIndex !== -1 && selfIndex > teamDividerIndex) {
                        amIFirstTeam = false;
                    }
                }

                if (!isNaN(firstScore) && !isNaN(secondScore)) {
                    teamScoreMy = amIFirstTeam ? firstScore : secondScore;
                    teamScoreEnemy = amIFirstTeam ? secondScore : firstScore;
                }
            }

            const score = parseInt(scoreText.replace(/\s/g, '')) || 0;
            const kills = parseInt(killsText.replace(/\s/g, '')) || 0;
            const deaths = parseInt(deathsText.replace(/\s/g, '')) || 0;
            const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
            const crystals = parseInt((selfRow.querySelector('.BattleKillBoardComponentStyle-col7')?.textContent || '0').replace(/\s/g, '')) || 0;
            const stars = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col8')?.textContent || '0') || 0;
            const eq = equipmentTracker.get();

            if (currentNickname === 'Unknown') return;

            const battleData: BattleData = {
                nickname: currentNickname,
                date: Date.now(),
                status: statusText,
                map: parsedMapData.map,
                mode: parsedMapData.mode,
                kind: (window.__kaspBattleKind as 'MM' | 'PRO') ?? 'MM',
                top: topVal,
                reputation: score,
                kills,
                deaths,
                kd,
                crystals,
                stars,
                turretIcon: eq?.turret ?? '',
                turretAugmentIcon: eq?.turretAugment ?? '',
                hullIcon: eq?.hull ?? '',
                hullAugmentIcon: eq?.hullAugment ?? '',
                teamScoreMy,
                teamScoreEnemy,
                players: players
            };
            await addBattle(battleData);
        } catch (err) {
            console.error('[Tanki Battle History] Error saving battle result:', err);
            battleProcessed = false;
        }
    };

    return () => {
        if (!utils.getSetting('k_history', false)) return;
        if (!initialized) {
            initialized = true;
            document.addEventListener('keydown', (e) => {
                const overlay = document.querySelector('.custom-history-overlay');

                const isHistoryOpen = overlay && window.getComputedStyle(overlay).display !== 'none';
                if (!isHistoryOpen) return;
                if (e.code === 'Space' || /^(Digit|Numpad)[1-7]$/.test(e.code)) {
                    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);
            window.addEventListener('keydown', (e) => {
                if (Date.now() < historyBackSuppressedUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (document.getElementById('clear-confirm-overlay')) return;
                const overlay = document.querySelector('.custom-history-overlay') as HTMLElement | null;
                if (overlay && overlay.style.display === 'flex') {
                    if (e.code === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                        closeHistoryOverlay(overlay);
                        e.preventDefault();
                    }
                }
            });
            document.addEventListener('mousedown', (e) => {
                if (Date.now() < historyBackSuppressedUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                const overlay = document.querySelector('.custom-history-overlay') as HTMLElement | null;
                if (overlay && overlay.style.display === 'flex' && e.button === 3) {
                    closeHistoryOverlay(overlay);
                    e.preventDefault();
                }
            }, true);

            setTimeout(() => updateNickname(), 5000);
        }

        injectFooterButton();
        void ensureHistoryPage();

        const selfRow = document.querySelector('#selfUserBg');
        const inResults = document.querySelector('.BattleResultHeaderComponentStyle-resultText');
        if (selfRow && inResults) {
            extractAndSaveBattleResult();
        } else if (!inResults) {
            battleProcessed = false;
        }
    };
})();
