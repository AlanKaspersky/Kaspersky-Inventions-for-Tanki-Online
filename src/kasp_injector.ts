import { BONUS_PICKUP_MESSAGE, createBonusDiagnostics, createBonusPickupBridge, patchBonusPickups, registerBonusType, selectBonusPatchPlan } from './core/bonusPickup';
import type { BonusPatchPlan } from './core/bonusPickup';
import overdrivePlans from './generated/overdrive.json';
import { ArcadeReloadHookStatus, patchArcadeReload, selectArcadeReloadPlan } from './core/arcadeReload';
import type { ArcadeReloadPatchPlan } from './core/arcadeReload';
import { mergeClientPatchPlans, releaseClientPatchContext } from './core/clientPatches';
import type { PreparedPatchPlan } from './core/clientPatches';
import arcadePlans from './generated/arcade.json';
import { installGameAugments, installGarageSkinCardsBridge, patchGameAugments, selectGameAugmentsPlan } from './core/gameAugments';
import type { AugmentPatchPlan, AugmentHookStatus } from './core/gameAugments';
import augmentPlans from './generated/augments.json';
import { patchUnavailableGarageDetails, selectGarageDetailsPlan } from './core/garageDetails';
import type { GarageDetailsPatchPlan, GarageDetailsHookStatus } from './core/garageDetails';
import garageDetailsPlans from './generated/garage-details.json';
import { patchUnavailableGarageItems, selectGarageItemsPlan } from './core/garageItems';
import type { GarageItemsPatchPlan, GarageItemsHookStatus } from './core/garageItems';
import garageItemsPlans from './generated/garage-items.json';
import { installGarageInventoryDiagnostics, patchGarageInventoryDiagnostics, selectGarageInventoryPlan } from './core/garageInventory';
import type { GarageInventoryPatchPlan, GarageInventoryHookStatus } from './core/garageInventory';
import garageInventoryPlans from './generated/garage-inventory.json';
import { installBattlePresence, patchBattlePresence, selectBattlePresencePlan } from './core/battlePresence';
import type { BattlePresencePatchPlan, BattlePresenceHookStatus } from './core/battlePresence';
import battlePresencePlans from './generated/battle-presence.json';
import { installBattleStatistics, patchBattleStatistics, selectBattleStatisticsPlan } from './core/battleStatistics';
import type { BattleStatisticsPatchPlan, BattleStatisticsHookStatus } from './core/battleStatistics';
import battleStatisticsPlans from './generated/battle-statistics.json';
import { installUserActions, patchUserActions, selectUserActionPlan } from './core/userActions';
import type { UserActionPatchPlan, UserActionHookStatus } from './core/userActions';
import userActionPlans from './generated/user-action.json';
import { installCriticalIndicator, patchCriticalIndicator, selectCriticalPlan } from './core/criticalIndicator';
import type { CriticalPatchPlan, CriticalHookStatus } from './core/criticalIndicator';
import criticalPlans from './generated/critical.json';
import { installCybersportNative } from './core/cybersportNative';
import { installAccountIdentityNative } from './core/accountIdentityNative';
import { featureScope, installFeatureDiagnostics } from './core/featureRuntime';
import { createNativeFeature } from './core/nativeFeature';
import { postPageMessage } from './core/pageMessages';

(function (): void {
    'use strict';
    installFeatureDiagnostics(window, 'page');

    featureScope('augments').run(() => installGameAugments(window));
    featureScope('garageSkinCards').run(() => installGarageSkinCardsBridge(window));
    featureScope('criticalIndicator', { budgetMs: 4 }).run(() => installCriticalIndicator(window));
    const accountIdentity = featureScope('accountIdentity').run(() => installAccountIdentityNative(window));
    featureScope('battlePresence').run(() => installBattlePresence(window, value => accountIdentity?.capture(value)));
    featureScope('battleStatistics').run(() => installBattleStatistics(window));
    featureScope('userActions').run(() => installUserActions(window));
    featureScope('garageInventory').run(() => installGarageInventoryDiagnostics(window));
    featureScope('cybersportNative').run(() => installCybersportNative(window));

    let arcadeHookStatus: ArcadeReloadHookStatus = { hooked: false, issues: ['pending'] };
    let arcadeError: string | null = null;
    let arcadeSample: import('./core/arcadeReload').ArcadeReloadSample | null = null;
    let arcadeUpdates = 0;
    window.__kaspArcadeControl = createNativeFeature(window, 'arcadeReload', 'k_arcade_reload');
    window.__kaspArcadeReloadDebug = {
        setEnabled(value): void {
            try { localStorage.setItem('kasp_arcade_reload_enabled', String(value)); } catch { }
        },
        status: () => ({ ...arcadeHookStatus, issues: [...arcadeHookStatus.issues], error: arcadeError,
            updates: arcadeUpdates, sample: arcadeSample && { ...arcadeSample }, runtime: window.__kaspArcadeControl?.status() }),
        observe(sample): void {
            arcadeSample = sample;
            arcadeUpdates++;
        },
        reportError(message): void {
            window.__kaspArcadeControl?.fail(message);
            arcadeError = message;
            console.warn('[KI Arcade reload] Native bar update failed:', message);
        },
    };

    const debugKey = 'kasp_bonus_debug';
    let debugEnabled = false;
    try { debugEnabled = localStorage.getItem(debugKey) === 'true'; } catch { }
    const diagnostics = createBonusDiagnostics(record => console.log('[KASP Bonus]', JSON.stringify(record)), debugEnabled);
    let hookStatus: Parameters<typeof diagnostics.record>[0] | null = null;
    window.__kaspBonusDebug = {
        enable(value = true): void {
            debugEnabled = value;
            diagnostics.enable(value);
            try { localStorage.setItem(debugKey, String(value)); } catch { }
            if (value && hookStatus) diagnostics.record(hookStatus);
        },
        clear: diagnostics.clear,
        export: diagnostics.export,
        status: () => hookStatus ? { ...hookStatus } : { kind: 'hooks', pending: true },
    };
    const bonusBridge = createBonusPickupBridge((model, position) => {
        postPageMessage(window, { type: BONUS_PICKUP_MESSAGE, detail: { model, position: position || null } });
    }, diagnostics.record, () => debugEnabled, callback => featureScope('overdriveHooks').run(callback));
    window.__kaspBonusPickup = bonusBridge.pickup;
    window.__kaspBonusPrepare = bonusBridge.prepare;
    window.__kaspBonusRegister = bonusBridge.register;
    window.__kaspBonusContext = bonusBridge.context;
    window.__kaspBonusType = registerBonusType;

    for (const [id, names] of Object.entries({
        augments: ['__kaspAugmentConfigure', '__kaspAugmentData', '__kaspAugmentLink'],
        overdriveHooks: ['__kaspBonusPickup', '__kaspBonusRegister', '__kaspBonusContext', '__kaspBonusType'],
        battleStatistics: ['__kaspBattleStats'], userActions: ['__kaspSendAction'],
    })) {
        const scope = featureScope(id);
        const page = window as unknown as Record<string, unknown>;
        for (const name of names) {
            const original = page[name];
            if (typeof original !== 'function') continue;
            page[name] = (...args: unknown[]) => {
                const result = scope.run(() => original.apply(window, args));
                return name === '__kaspBonusPickup' && result === undefined ? args[0] : result;
            };
        }
    }

    let bundleIntercepted = false;
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
        for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
                if (!bundleIntercepted && node instanceof HTMLScriptElement && node.src.includes('/static/js/main.')) {
                    bundleIntercepted = true;
                    const originalScript = document.createElement('script');
                    for (const attribute of Array.from(node.attributes)) {
                        originalScript.setAttribute(attribute.name, attribute.value);
                    }
                    originalScript.async = node.async;
                    originalScript.nonce = node.nonce;
                    node.type = 'javascript/blocked';
                    node.remove();
                    observer.disconnect();

                    let sourceForPatches: string | undefined;
                    fetch(node.src)
                        .then(res => {
                            if (!res.ok) throw new Error(`Game bundle request failed: HTTP ${res.status}`);
                            return res.text();
                        })
                        .then(async code => {
                            const originalCode = code;
                            sourceForPatches = originalCode;
                            const prepared: PreparedPatchPlan[] = [];
                            let bonusPlan: BonusPatchPlan | undefined;
                            let arcadePlan: ArcadeReloadPatchPlan | undefined;
                            let augmentPlan: AugmentPatchPlan | undefined;
                            let garageDetailsPlan: GarageDetailsPatchPlan | undefined;
                            let garageItemsPlan: GarageItemsPatchPlan | undefined;
                            let garageInventoryPlan: GarageInventoryPatchPlan | undefined;
                            let battlePresencePlan: BattlePresencePatchPlan | undefined;
                            let battleStatisticsPlan: BattleStatisticsPatchPlan | undefined;
                            let userActionPlan: UserActionPatchPlan | undefined;
                            let criticalPlan: CriticalPatchPlan | undefined;
                            const reportBonus = (status: Parameters<typeof diagnostics.record>[0]) => {
                                hookStatus = status;
                                diagnostics.record(status);
                                if (!status.ready) console.warn('[KI Overdrive] AST mapping unavailable or incomplete:', status);
                            };
                            try {
                                bonusPlan = await selectBonusPatchPlan(originalCode, overdrivePlans.plans as BonusPatchPlan[]);
                                if (patchBonusPickups(originalCode, reportBonus, bonusPlan) !== originalCode && bonusPlan) prepared.push(bonusPlan);
                            } catch (error) {
                                reportBonus({ kind: 'hooks', ready: false, issues: ['overdrive-patch-error'], error: String(error) });
                            }
                            const reportArcade = (status: ArcadeReloadHookStatus) => {
                                arcadeHookStatus = status;
                                if (!status.hooked) console.warn('[KI Arcade reload] Native bar hook unavailable:', status);
                            };
                            try {
                                let enabled = true;
                                try { enabled = localStorage.getItem('kasp_arcade_reload_enabled') !== 'false'; } catch { }
                                if (enabled) {
                                    arcadePlan = await selectArcadeReloadPlan(originalCode, arcadePlans.plans as ArcadeReloadPatchPlan[]);
                                    if (patchArcadeReload(originalCode, reportArcade, arcadePlan) !== originalCode && arcadePlan) prepared.push(arcadePlan);
                                } else reportArcade({ hooked: false, ready: false, issues: ['disabled-for-diagnosis'] });
                            } catch (error) {
                                reportArcade({ hooked: false, ready: false, issues: ['arcade-patch-error'] });
                                arcadeError = String(error);
                            }
                            const reportAugments = (status: AugmentHookStatus) => {
                                window.__kaspAugmentsDebug?.reportHook(status);
                                if (!status.ready) console.warn('[KI Augments] AST mapping unavailable:', status);
                            };
                            try {
                                augmentPlan = await selectGameAugmentsPlan(originalCode, augmentPlans.plans as AugmentPatchPlan[]);
                                if (patchGameAugments(originalCode, reportAugments, augmentPlan) !== originalCode && augmentPlan) prepared.push(augmentPlan);
                            } catch {
                                reportAugments({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['augments-patch-error'] });
                            }
                            const reportGarageDetails = (status: GarageDetailsHookStatus) => {
                                if (!status.ready) console.warn('[KI Garage details] AST mapping unavailable:', status);
                            };
                            try {
                                garageDetailsPlan = await selectGarageDetailsPlan(originalCode, garageDetailsPlans.plans as GarageDetailsPatchPlan[]);
                                if (patchUnavailableGarageDetails(originalCode, reportGarageDetails, garageDetailsPlan) !== originalCode && garageDetailsPlan) prepared.push(garageDetailsPlan);
                            } catch {
                                reportGarageDetails({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-details-patch-error'] });
                            }
                            const reportGarageItems = (status: GarageItemsHookStatus) => {
                                if (!status.ready) console.warn('[KI Garage items] AST mapping unavailable:', status);
                            };
                            try {
                                garageItemsPlan = await selectGarageItemsPlan(originalCode, garageItemsPlans.plans as GarageItemsPatchPlan[]);
                                if (patchUnavailableGarageItems(originalCode, reportGarageItems, garageItemsPlan) !== originalCode && garageItemsPlan) prepared.push(garageItemsPlan);
                            } catch {
                                reportGarageItems({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-items-patch-error'] });
                            }
                            const reportGarageInventory = (status: GarageInventoryHookStatus) => {
                                if (!status.ready) console.warn('[KI Garage inventory] AST mapping unavailable:', status);
                            };
                            try {
                                garageInventoryPlan = await selectGarageInventoryPlan(originalCode, garageInventoryPlans.plans as GarageInventoryPatchPlan[]);
                                if (patchGarageInventoryDiagnostics(originalCode, reportGarageInventory, garageInventoryPlan) !== originalCode && garageInventoryPlan) prepared.push(garageInventoryPlan);
                            } catch {
                                reportGarageInventory({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-inventory-patch-error'] });
                            }
                            const reportBattlePresence = (status: BattlePresenceHookStatus) => {
                                accountIdentity?.reportMapping(status);
                                if (!status.ready) console.warn('[KI Presence] AST mapping unavailable:', status);
                            };
                            try {
                                battlePresencePlan = await selectBattlePresencePlan(originalCode, battlePresencePlans.plans as BattlePresencePatchPlan[],
                                    navigator.userAgent.includes('Electron') ? 'complete' : 'store');
                                if (!battlePresencePlan && navigator.userAgent.includes('Electron')) {
                                    battlePresencePlan = await selectBattlePresencePlan(originalCode, battlePresencePlans.plans as BattlePresencePatchPlan[], 'store');
                                }
                                if (patchBattlePresence(originalCode, reportBattlePresence, battlePresencePlan) !== originalCode && battlePresencePlan) prepared.push(battlePresencePlan);
                            } catch {
                                reportBattlePresence({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['battle-presence-patch-error'] });
                            }
                            const reportBattleStatistics = (status: BattleStatisticsHookStatus) => {
                                if (!status.ready) console.warn('[KI Battle statistics] AST mapping unavailable:', status);
                            };
                            try {
                                battleStatisticsPlan = await selectBattleStatisticsPlan(originalCode, battleStatisticsPlans.plans as BattleStatisticsPatchPlan[]);
                                if (patchBattleStatistics(originalCode, reportBattleStatistics, battleStatisticsPlan) !== originalCode && battleStatisticsPlan) prepared.push(battleStatisticsPlan);
                            } catch {
                                reportBattleStatistics({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['battle-statistics-patch-error'] });
                            }
                            const reportUserActions = (status: UserActionHookStatus) => {
                                if (!status.ready) console.warn('[KI User actions] AST mapping unavailable:', status);
                            };
                            try {
                                userActionPlan = await selectUserActionPlan(originalCode, userActionPlans.plans as UserActionPatchPlan[]);
                                if (patchUserActions(originalCode, reportUserActions, userActionPlan) !== originalCode && userActionPlan) prepared.push(userActionPlan);
                            } catch {
                                reportUserActions({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['user-action-patch-error'] });
                            }
                            const reportCritical = (status: CriticalHookStatus) => {
                                window.__kaspCriticalDebug?.reportHook(status);
                                if (!status.ready) console.warn('[KI Critical indicator] AST mapping unavailable:', status);
                            };
                            try {
                                criticalPlan = await selectCriticalPlan(originalCode, criticalPlans.plans as CriticalPatchPlan[]);
                                if (patchCriticalIndicator(originalCode, reportCritical, criticalPlan) !== originalCode && criticalPlan) prepared.push(criticalPlan);
                            } catch {
                                reportCritical({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['critical-patch-error'] });
                            }
                            const merged = mergeClientPatchPlans(originalCode, prepared);
                            code = merged.code;
                            if (bonusPlan && merged.rejected.includes(bonusPlan)) reportBonus({ kind: 'hooks', ready: false, issues: ['overdrive-edit-conflict'] });
                            if (arcadePlan && merged.rejected.includes(arcadePlan)) reportArcade({ hooked: false, ready: false, issues: ['arcade-edit-conflict'] });
                            if (augmentPlan && merged.rejected.includes(augmentPlan)) reportAugments({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['augments-edit-conflict'] });
                            if (garageDetailsPlan && merged.rejected.includes(garageDetailsPlan)) reportGarageDetails({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-details-edit-conflict'] });
                            if (garageItemsPlan && merged.rejected.includes(garageItemsPlan)) reportGarageItems({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-items-edit-conflict'] });
                            if (garageInventoryPlan && merged.rejected.includes(garageInventoryPlan)) reportGarageInventory({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['garage-inventory-edit-conflict'] });
                            if (battlePresencePlan && merged.rejected.includes(battlePresencePlan)) reportBattlePresence({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['battle-presence-edit-conflict'] });
                            if (battleStatisticsPlan && merged.rejected.includes(battleStatisticsPlan)) reportBattleStatistics({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['battle-statistics-edit-conflict'] });
                            if (userActionPlan && merged.rejected.includes(userActionPlan)) reportUserActions({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['user-action-edit-conflict'] });

                            if (criticalPlan && merged.rejected.includes(criticalPlan)) reportCritical({ hooked: false, ready: false, strategy: 'ast-plan', issues: ['critical-edit-conflict'] });
                            const script = document.createElement('script');
                            script.type = originalScript.type;
                            script.nonce = originalScript.nonce;
                            script.textContent = code;
                            (document.head || document.documentElement).appendChild(script);
                        })
                        .catch(error => {
                            console.error('[Kaspersky Inventions] Bundle injection failed; loading the original game script:', error);
                            originalScript.addEventListener('error', () => {
                                console.error('[Kaspersky Inventions] The original game script also failed to load:', originalScript.src);
                            }, { once: true });
                            try {
                                (document.head || document.documentElement).appendChild(originalScript);
                            } catch (restoreError) {
                                console.error('[Kaspersky Inventions] Could not restore the original game script:', restoreError);
                            }
                        })
                        .finally(() => {
                            if (sourceForPatches !== undefined) releaseClientPatchContext(sourceForPatches);
                        });
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
