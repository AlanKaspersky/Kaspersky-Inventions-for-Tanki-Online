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

        modules.changeCounter.onTick();
        modules.overdriveTimer.sync();

        modules.welcomeModal();
        modules.hideNickname();
        modules.hideCurrency();
        modules.weaponAugmentTracker();
        modules.customGarageSkins();

        try {
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
        }
        catch (e) {
            console.error("[Kaspersky's Inventions] Ошибка в модуле:", e);
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
        const thead = document.querySelector('.BattleKillBoardComponentStyle-tableContainer table > thead');
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

        // The battle canvas can remain mounted behind the final results overlay.
        if (document.querySelector(gameDOM.results.status)) {
            newScreen = 'match_results';
        }
        else if (document.querySelector('.ApplicationLoaderComponentStyle-container')) {
            newScreen = 'loading';
        }
        // The client retains the battle canvas while the garage is open over it.
        else if (document.querySelector(gameDOM.screens.garage)) {
            newScreen = 'garage';
        }
        else if (document.querySelector(gameDOM.screens.battleHud)) {
            newScreen = 'battle';
        }
        else if (document.querySelector('.MainScreenComponentStyle-blockMainMenu')) {
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

        const isFriendsMenuOpen = !!document.querySelector('.FriendListComponentStyle-containerFriends, .InvitationWindowsComponentStyle-centerBlock');
        const friendsChanged = isFriendsMenuOpen !== state.friendsMenuOpen;
        state.friendsMenuOpen = isFriendsMenuOpen;

        const isSettingsOpen = !!document.querySelector('.SettingsComponentStyle-blockContentOptions');
        if (isSettingsOpen !== state.settingsOpen) {
            state.settingsOpen = isSettingsOpen;
            if (isSettingsOpen) {
                coreSettings.inject();
            }
            else {
                coreSettings.onClose();
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
        // Capture also needs to see results disappear, including a direct next-battle transition.
        modules.battleHistory();
        if (state.currentScreen === 'match_results' || state.currentScreen === 'lobby') {
            syncKillBoardDoubleHeader();
        }
    };

    const masterObserver = new MutationObserver(() => {
        if (document.querySelector('.BattleTabStatisticComponentStyle-container')) {
            modules.changeCounter.sync();
            modules.zeroResists.sync();
            modules.equipmentTracker.sync();
        }
        if (document.querySelector('.GarageCommonStyle-positionContent, .ContainerInfoComponentStyle-lootBoxContainer')) {
            modules.augmentSpecs();
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
            coreSettings.inject();
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
