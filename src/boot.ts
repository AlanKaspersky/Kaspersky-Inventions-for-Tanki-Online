import { featureScope } from './core/featureRuntime';
import { state } from './core/state';
import { gameDOM } from './core/gameDOM';
import { utils } from './core/utils';
import { coreSettings } from './core/coreSettings';
import { modules } from './modules';

export function startBoot() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'language_store_key') {
            state.lang = utils.getLang();
            if (!isMasterUpdateScheduled) {
                isMasterUpdateScheduled = true;
                requestAnimationFrame(performMasterCheck);
            }
        }
    });

    let isMasterUpdateScheduled = false;

    let lastFullRefresh = 0;
    let refreshScheduled = false;
    const REFRESH_INTERVAL_MS = 150;

    const runHeavyModules = () => {
        lastFullRefresh = performance.now();
        refreshScheduled = false;

        if (document.querySelector(gameDOM.screens.garageOrLootBox)) {
            modules.augmentSpecs();
        }

        modules.changeCounter.onTick();
        modules.overdriveTimer.sync();

        modules.welcomeModal();
        modules.hideNickname();
        modules.tankoinBalance();
        modules.hideCurrency();
        modules.lobbyPasses();
        modules.customGarageSkins();

        modules.cybersport();
        if (state.currentScreen === 'lobby' || state.currentScreen === 'loading') {
            modules.customPlayButton();
        }
        if (state.friendsMenuOpen) {
            modules.customFriends();
        }
        if (state.currentScreen === 'lobby' || state.currentScreen === 'garage' || state.currentScreen === 'match_results') {
            modules.customTrophies();
        }
        if (state.currentScreen === 'garage') {
            modules.autoUpgrade();
            modules.augmentSpecs();
            modules.customPaints();
        }
    };

    const scheduleHeavyModules = () => {
        const now = performance.now();
        const elapsed = now - lastFullRefresh;

        if (elapsed >= REFRESH_INTERVAL_MS) {
            runHeavyModules();
            return;
        }
        if (refreshScheduled) return;

        refreshScheduled = true;
        const wait = REFRESH_INTERVAL_MS - elapsed;
        window.setTimeout(() => {
            refreshScheduled = false;
            runHeavyModules();
        }, wait);
    };

    function syncKillBoardDoubleHeader() {
        const thead = document.querySelector(gameDOM.statistics.killBoardHead);
        if (!thead) return;

        if (thead.children.length === 1) {
            const headRow = thead.children[0];
            const clone = headRow.cloneNode(true) as Element;
            clone.classList.add('kasp-cloned-header');
            thead.appendChild(clone);
        }
    }

    const performMasterCheck = () => {
        isMasterUpdateScheduled = false;
        const currentLang = utils.getLang();
        if (currentLang !== state.lang)
            applyLanguageChange();
        let newScreen = state.currentScreen;

        if (document.querySelector(gameDOM.results.status)) {
            newScreen = 'match_results';
        }
        else if (document.querySelector(gameDOM.screens.loader)) {
            newScreen = 'loading';
        }
        else if (document.querySelector(gameDOM.screens.garage)) {
            newScreen = 'garage';
        }
        else if (document.querySelector(gameDOM.screens.battleHud)) {
            newScreen = 'battle';
        }
        else if (document.querySelector(gameDOM.play.mainMenu)) {
            newScreen = 'lobby';
        }

        const screenChanged = newScreen !== state.currentScreen;
        state.currentScreen = newScreen;

        if (screenChanged) {
            if (newScreen === 'loading' || newScreen === 'battle') {
                const specsTooltip = document.getElementById('kasp-specs-tooltip');
                if (specsTooltip) specsTooltip.style.display = 'none';

                const quickUpgradeOverlay = document.getElementById('quick-upgrade-overlay') as (HTMLElement & {
                    closeDialogMethod?: () => void;
                }) | null;
                if (quickUpgradeOverlay && quickUpgradeOverlay.closeDialogMethod) {
                    quickUpgradeOverlay.closeDialogMethod();
                }
                const historyOverlay = document.querySelector('.custom-history-overlay') as HTMLElement | null;
                if (historyOverlay) historyOverlay.style.display = 'none';
                const clearConfirmOverlay = document.getElementById('clear-confirm-overlay') as (HTMLElement & {
                    closeDialogMethod?: () => void;
                }) | null;
                if (clearConfirmOverlay && clearConfirmOverlay.closeDialogMethod) {
                    clearConfirmOverlay.closeDialogMethod();
                }
                else if (clearConfirmOverlay) {
                    clearConfirmOverlay.remove();
                }
            }
        }

        const isFriendsMenuOpen = !!document.querySelector(gameDOM.screens.friends);
        const friendsChanged = isFriendsMenuOpen !== state.friendsMenuOpen;
        state.friendsMenuOpen = isFriendsMenuOpen;

        const isSettingsOpen = !!document.querySelector(gameDOM.settings.root);
        if (isSettingsOpen !== state.settingsOpen) {
            state.settingsOpen = isSettingsOpen;
            if (isSettingsOpen) {
                featureScope('settings').run(coreSettings.inject);
            }
            else {
                featureScope('settings').run(coreSettings.onClose);
            }
        }

        if (screenChanged || friendsChanged) {
            lastFullRefresh = 0;
            if (refreshScheduled)
                refreshScheduled = false;
            runHeavyModules();
        }
        else {
            scheduleHeavyModules();
        }

        if (state.currentScreen === 'garage') {
            modules.garageButtons();
        }
        modules.battleHistory();
        if (state.currentScreen === 'match_results' || state.currentScreen === 'lobby') {
            syncKillBoardDoubleHeader();
        }
    };

    const statisticsPresentation = '.kasp-change-th, .kasp-change-td, .kasp-defence-th, .kasp-compact-cell, .kasp-zero-summary, #kasp-tab-toggle-btn, #kasp-enemy-weapons-btn';
    const isOwnStatisticsMutation = (record: MutationRecord): boolean => {
        if (record.type !== 'childList') return false;
        const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        if (target?.closest('#kasp-enemy-weapons-tooltip')) return true;
        if (!target?.closest(gameDOM.statistics.container)) return false;
        if (target.closest(statisticsPresentation)) return true;
        if (record.removedNodes.length) return false;
        return record.addedNodes.length > 0 && Array.from(record.addedNodes).every(node =>
            node.nodeType === 1 && (node as Element).matches(statisticsPresentation));
    };

    const masterObserver = new MutationObserver((records = []) => {
        if (records.length && records.every(isOwnStatisticsMutation)) return;
        if (document.querySelector(gameDOM.statistics.container)) {
            modules.changeCounter.sync();
            modules.zeroResists.sync();
            modules.enemyWeapons.sync();
            modules.equipmentTracker.sync();
        }
        if (document.querySelector(gameDOM.garage.actionContainer)) {
            modules.autoUpgrade();
        }

        if (!isMasterUpdateScheduled) {
            isMasterUpdateScheduled = true;
            requestAnimationFrame(performMasterCheck);
        }
    });

    const applyLanguageChange = () => {
        const newLang = utils.getLang();
        if (newLang === state.lang)
            return;
        state.lang = newLang;
        lastFullRefresh = 0;
        if (refreshScheduled)
            refreshScheduled = false;
        if (state.settingsOpen) {
            const oldTab = document.getElementById('kaspersky-tab');
            if (oldTab)
                oldTab.remove();
            const oldContent = document.getElementById('kaspersky-settings-content');
            if (oldContent)
                oldContent.remove();
            const oldTooltip = document.getElementById('kaspersky-reload-tooltip');
            if (oldTooltip)
                oldTooltip.remove();
            featureScope('settings').run(coreSettings.inject);
        }
        if (!isMasterUpdateScheduled) {
            isMasterUpdateScheduled = true;
            requestAnimationFrame(performMasterCheck);
        }
    };

    const boot = () => {
        state.lang = utils.getLang();
        modules.overdriveTimer.setup();
        masterObserver.observe(document.documentElement, { childList: true, subtree: true });
        window.setInterval(() => modules.customGarageSkins(), 250);

        const langObserver = new MutationObserver(() => {
            applyLanguageChange();
        });
        langObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['lang']
        });

        if (!document.documentElement.lang) {
            document.addEventListener('DOMContentLoaded', () => {
                applyLanguageChange();
            }, { once: true });
            window.setTimeout(() => {
                applyLanguageChange();
            }, 500);
            window.setTimeout(() => {
                applyLanguageChange();
            }, 2000);
        }
    };

    if (document.documentElement) {
        boot();
    }
    else {
        document.addEventListener('DOMContentLoaded', boot);
    }
}
