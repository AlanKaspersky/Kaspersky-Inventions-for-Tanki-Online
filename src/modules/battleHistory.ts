import { gameDOM } from '../core/gameDOM';
import { utils } from '../core/utils';
import { state } from '../core/state';
import { getAccountIdentity } from '../core/accountIdentity';
import { renderHistoryTemplate } from '../core/historyMarkup';
import { getHistoryDictionary } from './battleHistory/localization';
import { createHistoryViews } from './battleHistory/views';
import { createHistoryActions } from './battleHistory/actions';
import { createHistoryNavigation } from './battleHistory/navigation';
import { createResultCapture } from './battleHistory/capture';
import type { HistoryAccount } from './battleHistory/types';

/** Called by the extension's update loop; component state stays private to this module. */
export const battleHistory = (() => {
    const NICK_KEY = 'kasp_last_nickname';
    let initialized = false;
    let currentNickname = (() => {
        try {
            return localStorage.getItem(NICK_KEY) || 'Unknown';
        }
        catch {
            return 'Unknown';
        }
    })();

    let historyPagePromise: Promise<void> | null = null;
    const setNickname = (nickname: string): void => {
        if (nickname === currentNickname) return;
        const overlay = document.querySelector<HTMLElement>('.custom-history-overlay');
        if (overlay) {
            navigation.release(overlay);
            overlay.remove();
        }
        views.reset();
        historyPagePromise = null;
        currentNickname = nickname;
        try { localStorage.setItem(NICK_KEY, nickname); } catch { }
    };

    const updateNickname = (): boolean => {
        const nickname = getAccountIdentity()?.nickname;
        if (!nickname || nickname === 'Unknown') return false;
        setNickname(nickname);
        return true;
    };

    const account: HistoryAccount = {
        getNickname: () => currentNickname,
        updateNickname,
        setNickname,
    };
    const views = createHistoryViews(account);
    const actions = createHistoryActions(account, views.renderBattleList);
    const navigation = createHistoryNavigation({
        ensureHistoryPage: () => ensureHistoryPage(),
        renderBattleList: views.renderBattleList,
        playPendingBattleListAnimation: views.playPendingBattleListAnimation,
    });
    const results = createResultCapture(account);

    const createHistoryPage = async () => {
        if (document.querySelector('.custom-history-overlay')) return;

        const nickname = currentNickname;
        const lang = state.lang;
        const dict = getHistoryDictionary(lang);

        const templateUrl = chrome.runtime.getURL('templates/battle-history-overlay.html');
        const response = await fetch(templateUrl);
        if (!response.ok) {
            throw new Error(`Failed to load history template: ${response.status}`);
        }
        const template = await response.text();
        if (nickname !== currentNickname || document.querySelector('.custom-history-overlay')) return;
        const replacements: Record<string, string> = {
            title: String(dict.title ?? ''),
            clear: String(dict.clear ?? ''),
            link: String(dict.link ?? ''),
            export: String(dict.export ?? ''),
            import: String(dict.import ?? ''),
            battles: String(dict.battles ?? 'Боёв')
        };

        const html = renderHistoryTemplate(template, replacements);

        const overlay = document.createElement('div');
        overlay.className = 'custom-history-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        overlay.querySelector('.custom-history-close')?.addEventListener('click', () => {
            navigation.closeHistoryOverlay(overlay);
        });

        document.getElementById('bh-clear-btn')?.addEventListener('click', actions.clearHistoryDb);
        document.getElementById('bh-link-btn')?.addEventListener('click', actions.openLinkHistoryDialog);
        document.getElementById('bh-export-btn')?.addEventListener('click', actions.exportHistoryData);
        document.getElementById('bh-import-btn')?.addEventListener('click', actions.importHistoryData);
    };

    const ensureHistoryPage = (): Promise<void> => {
        updateNickname();
        if (document.querySelector('.custom-history-overlay')) return Promise.resolve();
        if (!historyPagePromise) {
            const pending = createHistoryPage()
                .catch(error => console.error('[BattleHistory] Failed to create history page:', error))
                .finally(() => {
                    if (historyPagePromise === pending) historyPagePromise = null;
                });
            historyPagePromise = pending;
        }
        return historyPagePromise;
    };

    return () => {
        if (!utils.getSetting('k_history', false)) return;
        const inResults = document.querySelector(gameDOM.results.status);
        if (document.querySelector(gameDOM.results.selfRow) && inResults) {
            void results.capture();
        } else if (!inResults) {
            results.reset();
        }
        // Keep capture/reset independent of UI preloading and navigation.
        if (!inResults && ['battle', 'loading', 'garage'].includes(state.currentScreen)) return;
        if (!initialized) {
            initialized = true;
            navigation.bindShortcuts();
            setTimeout(updateNickname, 5000);
        }
        navigation.injectFooterButton();
        void ensureHistoryPage();

    };
})();
