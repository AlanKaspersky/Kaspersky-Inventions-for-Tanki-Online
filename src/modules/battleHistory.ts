import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('battleHistory');
import { gameDOM } from '../core/gameDOM';
import { utils } from '../core/utils';
import { state } from '../core/state';
import { getVerifiedAccount } from '../core/accountIdentity';
import { renderHistoryTemplate } from '../core/historyMarkup';
import { getHistoryDictionary } from './battleHistory/localization';
import { createHistoryViews } from './battleHistory/views';
import { createHistoryActions } from './battleHistory/actions';
import { createHistoryNavigation } from './battleHistory/navigation';
import { createResultCapture } from './battleHistory/capture';
import type { HistoryAccount } from './battleHistory/types';
import { historyContext } from './battleHistory/context';

export const battleHistory = lifecycle.initialize(() => {
    let initialized = false;
    let currentUserId: string | null = null;
    let currentNickname = 'Unknown';
    let historyPagePromise: Promise<void> | null = null;
    const updateIdentity = (): boolean => {
        const identity = getVerifiedAccount();
        const userId = identity?.userId || null;
        if (userId !== currentUserId) {
            const overlay = document.querySelector<HTMLElement>('.custom-history-overlay');
            if (overlay) { navigation.release(overlay); overlay.remove(); }
            views.reset();
            historyPagePromise = null;
            currentUserId = userId;
        }
        currentNickname = identity?.nickname || 'Unknown';
        return userId !== null;
    };
    const account: HistoryAccount = {
        getUserId: () => getVerifiedAccount()?.userId === currentUserId ? currentUserId : null,
        getNickname: () => currentNickname,
        updateIdentity,
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

        const userId = account.getUserId();
        const lang = state.lang;
        const dict = getHistoryDictionary(lang);

        const templateUrl = chrome.runtime.getURL('templates/battle-history-overlay.html');
        const response = await fetch(templateUrl);
        if (!response.ok) {
            throw new Error(`Failed to load history template: ${response.status}`);
        }
        const template = await response.text();
        if (lifecycle.disabled || historyContext.invalidated || userId !== account.getUserId() || document.querySelector('.custom-history-overlay')) return;
        const replacements: Record<string, string> = {
            title: String(dict.title ?? ''),
            clear: String(dict.clear ?? ''),
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
        document.getElementById('bh-export-btn')?.addEventListener('click', actions.exportHistoryData);
        document.getElementById('bh-import-btn')?.addEventListener('click', actions.importHistoryData);
    };

    const ensureHistoryPage = (): Promise<void> => {
        if (historyContext.invalidated) return Promise.resolve();
        updateIdentity();
        if (document.querySelector('.custom-history-overlay')) return Promise.resolve();
        if (!historyPagePromise) {
            const pending = createHistoryPage()
                .catch(error => {
                    if (!historyContext.handle(error, state.lang)) console.error('[BattleHistory] Failed to create history page:', error);
                })
                .finally(() => {
                    if (historyPagePromise === pending) historyPagePromise = null;
                });
            historyPagePromise = pending;
        }
        return historyPagePromise;
    };

    lifecycle.onCleanup(() => { historyContext.invalidated=true;results.reset();views.reset();const overlay=document.querySelector<HTMLElement>('.custom-history-overlay');if(overlay){navigation.release(overlay);overlay.remove();}document.querySelector('.custom-history-button')?.remove(); });

    return () => {
        if (historyContext.invalidated) return;
        if (!utils.getSetting('k_history', false)) return;
        updateIdentity();
        const inResults = document.querySelector(gameDOM.results.status);
        if (document.querySelector(gameDOM.results.selfRow) && inResults) {
            void results.capture().catch(error => lifecycle.fail(error));
        } else if (!inResults) {
            results.reset();
        }
        if (!inResults && ['battle', 'loading', 'garage'].includes(state.currentScreen)) return;
        if (!initialized) {
            initialized = true;
            navigation.bindShortcuts();
            lifecycle.timeout(updateIdentity, 5000);
        }
        navigation.injectFooterButton();
        void ensureHistoryPage();

    };
}, () => {});
