import { gameDOM } from '../../core/gameDOM';
import { state } from '../../core/state';
import { getHistoryDictionary } from './localization';
import type { RenderBattleList } from './types';

interface NavigationOptions {
    ensureHistoryPage(): Promise<void>;
    renderBattleList: RenderBattleList;
    playPendingBattleListAnimation(): void;
}

export function createHistoryNavigation(options: NavigationOptions) {
    const { ensureHistoryPage, renderBattleList, playPendingBattleListAnimation } = options;
    let shortcutsBound = false;
    let opening = false;

    const HISTORY_BG = 'radial-gradient(rgb(15, 17, 22) 0%, rgb(3, 5, 8) 100%)';

    let backgroundContainer: HTMLElement | null = null;
    let previousBackground: string | null = null;
    let previousBackgroundPriority = '';

    const applyHistoryBackground = (): void => {
        backgroundContainer =
            document.querySelector<HTMLElement>(gameDOM.common.appContainer) ??
            document.querySelector<HTMLElement>(gameDOM.common.container);
        if (!backgroundContainer) return;

        previousBackground = backgroundContainer.style.background || null;
        previousBackgroundPriority = backgroundContainer.style.getPropertyPriority('background');

        backgroundContainer.style.setProperty('background', HISTORY_BG, 'important');
    };

    const restoreContainerBackground = (): void => {
        if (!backgroundContainer) return;
        if (previousBackground) {
            backgroundContainer.style.setProperty('background', previousBackground, previousBackgroundPriority);
        } else {
            backgroundContainer.style.removeProperty('background');
        }
        backgroundContainer = null;
        previousBackground = null;
    };

    let exitAfterReturn = false;
    let returnObserver: MutationObserver | null = null;
    let returnTimer = 0;
    let returnBackTimer = 0;
    let returnLoaderTimer = 0;
    let returnLoaderObserver: MutationObserver | null = null;

    const showFakeLoader = (): void => {
        document.querySelector('.kasp-loader-overlay')?.remove();

        const host =
            document.querySelector<HTMLElement>(gameDOM.common.appContainer) ??
            document.querySelector<HTMLElement>(gameDOM.common.container) ??
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
            if (!document.querySelector(gameDOM.navigation.header)) {
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
        exitAfterReturn = false;
        window.clearTimeout(returnTimer);
        window.clearTimeout(returnBackTimer);
        window.clearTimeout(returnLoaderTimer);
        returnLoaderObserver?.disconnect();
        returnLoaderObserver = null;
        returnObserver?.disconnect();
        returnObserver = null;
    };

    const armExitAfterReturn = (): void => {
        disarmReturnWatcher();
        exitAfterReturn = true;

        returnObserver = new MutationObserver(() => {
            if (!exitAfterReturn) return;

            if (!document.querySelector(gameDOM.navigation.header)) {
                disarmReturnWatcher();
                return;
            }

            const titleEl = document.querySelector<HTMLSpanElement>(
                gameDOM.navigation.title
            );

            const text = (titleEl?.textContent?.trim() ?? '').toUpperCase();
            if (text === 'SETTINGS' || text === 'НАСТРОЙКИ') {
                disarmReturnWatcher();

                showFakeLoader();

                const finishLoading = () => {
                    returnLoaderObserver?.disconnect();
                    returnLoaderObserver = null;
                    window.clearTimeout(returnLoaderTimer);
                    hideFakeLoader();
                };
                returnLoaderObserver = new MutationObserver(() => {
                    if (!document.querySelector(gameDOM.navigation.header)) {
                        finishLoading();
                    }
                });
                returnLoaderObserver.observe(document.body, { childList: true, subtree: true });
                returnLoaderTimer = window.setTimeout(finishLoading, 2000);

                returnBackTimer = window.setTimeout(() => {
                    const backBtn = document.querySelector<HTMLElement>(
                        gameDOM.navigation.back
                    );
                    if (backBtn) backBtn.click();
                }, 150);
            }
        });

        returnObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        returnTimer = window.setTimeout(() => {
            if (exitAfterReturn) {
                disarmReturnWatcher();
            }
        }, 20000);
    };

    let pageObserver: MutationObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let nativeContent: HTMLElement | null = null;
    let previousNativeDisplay = '';

    const releasePage = (overlay: HTMLElement): void => {
        for (const id of ['link-history-overlay', 'clear-confirm-overlay']) {
            const modal = document.getElementById(id) as (HTMLElement & { closeDialogMethod?: () => void }) | null;
            modal?.closeDialogMethod?.();
        }
        overlay.style.display = 'none';
        restoreContainerBackground();
        if (nativeContent) nativeContent.style.display = previousNativeDisplay;
        nativeContent = null;
        pageObserver?.disconnect();
        pageObserver = null;
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    };

    const closeHistoryOverlay = (overlay: HTMLElement, auto = false): void => {
        releasePage(overlay);
        if (auto) armExitAfterReturn();
        const title = document.querySelector(gameDOM.navigation.title);
        if (title?.textContent?.trim() === getHistoryDictionary(state.lang).title.toUpperCase()) {
            flashHideSettings();
            document.querySelector<HTMLElement>(gameDOM.navigation.back)?.click();
        }
    };

    const watchNativePage = (overlay: HTMLElement, ourTitle: string): void => {
        pageObserver?.disconnect();
        pageObserver = new MutationObserver(() => {
            if (!document.querySelector(gameDOM.navigation.header)) {
                releasePage(overlay);
                return;
            }
            const title = document.querySelector(gameDOM.navigation.title);
            const anotherPage = document.querySelector([
                gameDOM.screens.shop,
                gameDOM.screens.invitations,
                gameDOM.screens.progress,
            ].join(', '));
            if (anotherPage || (title && title.textContent?.trim() !== ourTitle)) {
                closeHistoryOverlay(overlay, true);
            }
        });
        pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    const waitForSelector = <T extends Element = Element>(
        selector: string,
        timeoutMs = 3000
    ): Promise<T | null> => {
        const existing = document.querySelector<T>(selector);
        if (existing) return Promise.resolve(existing);

        return new Promise<T | null>((resolve) => {
            let timer = 0;
            const finish = (element: T | null) => {
                obs.disconnect();
                window.clearTimeout(timer);
                resolve(element);
            };
            const obs = new MutationObserver(() => {
                const el = document.querySelector<T>(selector);
                if (el) finish(el);
            });
            obs.observe(document.body, { childList: true, subtree: true });
            timer = window.setTimeout(() => finish(null), timeoutMs);
        });
    };

    const bindOverlayToHeader = (overlay: HTMLElement, header: HTMLElement): void => {
        const update = () => {
            const r = header.getBoundingClientRect();
            overlay.style.top = `${r.bottom}px`;
            overlay.style.height = `calc(100vh - ${r.bottom}px)`;
        };
        update();
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        resizeHandler = update;
        window.addEventListener('resize', update);
    };

    const openAsNativePage = async (overlay: HTMLElement): Promise<boolean> => {
        const dict = getHistoryDictionary(state.lang);
        disarmReturnWatcher();
        if (pageObserver) releasePage(overlay);

        let header = document.querySelector<HTMLElement>(gameDOM.navigation.header);

        if (!header) {
            const settingsBtn = [...document.querySelectorAll<HTMLElement>(
                gameDOM.navigation.primaryItem
            )].find(el => {
                if (el.querySelector(gameDOM.navigation.settingsIcon)) return true;
                const name = (el.querySelector(gameDOM.navigation.primaryItemName)
                    ?.textContent?.trim() ?? '').toUpperCase();
                return name === 'SETTINGS' || name === 'НАСТРОЙКИ';
            });

            if (!settingsBtn) {
                console.warn('[BattleHistory] settings trigger not found');
                return false;
            }

            settingsBtn.click();
            header = await waitForSelector<HTMLElement>(
                gameDOM.navigation.header,
                3000
            );
        }
        if (!header) return false;

        const title = header.querySelector<HTMLSpanElement>(gameDOM.navigation.title);
        if (title) title.textContent = dict.title.toUpperCase();

        nativeContent = document.querySelector<HTMLElement>(gameDOM.navigation.settingsContent);
        if (nativeContent) {
            previousNativeDisplay = nativeContent.style.display;
            nativeContent.style.display = 'none';
        }

        const ownHeader = overlay.querySelector<HTMLElement>('.custom-history-header');
        if (ownHeader) ownHeader.style.display = 'none';

        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '50';

        bindOverlayToHeader(overlay, header);
        applyHistoryBackground();
        watchNativePage(overlay, dict.title.toUpperCase());

        overlay.style.display = 'flex';
        return true;
    };

    const injectFooterButton = () => {
        const footerList = document.querySelector(gameDOM.navigation.footerList);
        if (!footerList || footerList.querySelector('.custom-history-button')) return;

        const lang = state.lang;
        const dict = getHistoryDictionary(lang);
        const btn = document.createElement('li');
        btn.className = gameDOM.classes.footerEntry + ' custom-history-button';
        btn.innerHTML = '<div></div>';
        btn.title = dict.title;

        btn.addEventListener('click', async () => {
            if (opening) return;
            opening = true;
            const hidden: Array<{ el: HTMLElement; prev: string }> = [];
            const rootVisibility = document.documentElement.style.visibility;
            const bodyVisibility = document.body.style.visibility;

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
                document.documentElement.style.visibility = rootVisibility;
                document.body.style.visibility = bodyVisibility;
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
                if (document.querySelector('.custom-history-overlay') !== overlay) return;

                const ok = await openAsNativePage(overlay);
                if (document.querySelector('.custom-history-overlay') !== overlay) return;
                if (!ok) {
                    const ownHeader = overlay.querySelector<HTMLElement>('.custom-history-header');
                    if (ownHeader) ownHeader.style.display = '';
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
            } catch (error) {
                console.error('[BattleHistory] Failed to open history:', error);
            } finally {
                opening = false;
                showGameUI();
                hideFakeLoader();
            }
        });
        footerList.appendChild(btn);
    };

    const bindShortcuts = () => {
        if (shortcutsBound) return;
        shortcutsBound = true;
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
            if (document.getElementById('clear-confirm-overlay') || document.getElementById('link-history-overlay')) return;
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
            const overlay = document.querySelector('.custom-history-overlay') as HTMLElement | null;
            if (overlay && overlay.style.display === 'flex' && e.button === 3) {
                closeHistoryOverlay(overlay);
                e.preventDefault();
            }
        }, true);

    };

    return {
        injectFooterButton, bindShortcuts, closeHistoryOverlay,
        release(overlay: HTMLElement) {
            releasePage(overlay);
            disarmReturnWatcher();
        },
    };
}
