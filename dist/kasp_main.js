"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/core/electron.ts
  function isElectronClient() {
    try {
      return navigator.userAgent.includes("Electron") || !!window.process?.type;
    } catch {
      return false;
    }
  }
  function setupElectronZKey() {
    if (!isElectronClient()) return;
    const dispatchZKey = (type) => {
      const event = new KeyboardEvent(type, {
        key: "z",
        code: "KeyZ",
        keyCode: 90,
        which: 90,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      document.dispatchEvent(event);
    };
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 3 && e.button !== 4)
        return;
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable))
        return;
      e.preventDefault();
      if (e.button === 3) {
        dispatchZKey("keydown");
        dispatchZKey("keyup");
      }
    }, true);
    document.addEventListener("mouseup", (e) => {
      if (e.button === 3 || e.button === 4)
        e.preventDefault();
    }, true);
    document.addEventListener("click", (e) => {
      if (e.button === 3 || e.button === 4)
        e.preventDefault();
    }, true);
  }
  var init_electron = __esm({
    "src/core/electron.ts"() {
      "use strict";
    }
  });

  // src/core/state.ts
  var state;
  var init_state = __esm({
    "src/core/state.ts"() {
      "use strict";
      state = {
        lang: "EN",
        currentScreen: "loading",
        settingsOpen: false,
        friendsMenuOpen: false
      };
    }
  });

  // src/core/settings.ts
  function readSetting(id, def) {
    const val = localStorage.getItem(id);
    return val === null ? def : val === "true";
  }
  function invalidateSetting(id) {
    if (id) settingsCache.delete(id);
    else settingsCache.clear();
  }
  function getSettingRaw(id, def) {
    if (settingsCache.has(id)) {
      const cached = settingsCache.get(id);
      if (cached !== void 0) return cached;
    }
    const parsed = readSetting(id, def);
    settingsCache.set(id, parsed);
    return parsed;
  }
  function setSettingRaw(id, value) {
    localStorage.setItem(id, value ? "true" : "false");
    settingsCache.set(id, value);
    window.dispatchEvent(new Event("kasp:settings-changed"));
  }
  var SETTINGS_KEYS, settingsCache;
  var init_settings = __esm({
    "src/core/settings.ts"() {
      "use strict";
      SETTINGS_KEYS = [
        "k_ext_btn",
        "k_augments",
        "k_auto_upgrade",
        "k_friends",
        "k_paints",
        "k_hideCurrency",
        "k_hideNicknameXP",
        "k_hideSupplies",
        "k_history",
        "k_overdrive_timer",
        "k_arcade_reload",
        "k_critical_indicator"
      ];
      settingsCache = /* @__PURE__ */ new Map();
      for (const key of SETTINGS_KEYS) {
        settingsCache.set(key, readSetting(key, key === "k_arcade_reload" || key === "k_critical_indicator"));
      }
      window.addEventListener("storage", (e) => {
        if (e.key && SETTINGS_KEYS.includes(e.key))
          invalidateSetting(e.key);
      });
    }
  });

  // src/core/utils.ts
  var utils;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      "use strict";
      init_settings();
      utils = {
        getLang: () => {
          try {
            const stored = (localStorage.getItem("language_store_key") || "").toLowerCase();
            if (stored.startsWith("ru")) return "RU";
            if (stored.startsWith("en")) return "EN";
          } catch {
          }
          const htmlLang = (document.documentElement.lang || "").toLowerCase();
          if (htmlLang.includes("ru")) return "RU";
          if (htmlLang.includes("en")) return "EN";
          if (window.location.hostname.includes("ru.")) return "RU";
          return "EN";
        },
        getSetting: getSettingRaw,
        setSetting: setSettingRaw,
        injectStyle: (css, id) => {
          if (document.getElementById(id)) return;
          const style = document.createElement("style");
          style.id = id;
          style.textContent = css;
          if (document.head) document.head.appendChild(style);
          else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
        }
      };
    }
  });

  // src/core/featureRuntime.ts
  function createFeatureScope(id, options = {}) {
    const now = options.now || (() => performance.now());
    const budget = options.budgetMs ?? 16;
    const status = {
      id,
      disabled: false,
      reason: null,
      error: null,
      calls: 0,
      failures: 0,
      slowCalls: 0,
      lastMs: 0,
      maxMs: 0,
      cleanupErrors: 0,
      resources: 0
    };
    const cleanups = /* @__PURE__ */ new Set();
    const failuresAt = [];
    const dispose = (reason = "manual") => {
      if (status.disabled) return;
      status.disabled = true;
      status.reason = reason;
      for (const cleanup of [...cleanups].reverse()) {
        try {
          cleanup();
        } catch {
          status.cleanupErrors++;
        }
      }
      cleanups.clear();
      status.resources = 0;
    };
    const onCleanup = (cleanup) => {
      if (status.disabled) {
        try {
          cleanup();
        } catch {
          status.cleanupErrors++;
        }
        return () => {
        };
      }
      cleanups.add(cleanup);
      status.resources = cleanups.size;
      return () => {
        cleanups.delete(cleanup);
        status.resources = cleanups.size;
      };
    };
    const fail = (error) => {
      status.failures++;
      const time = now();
      while (failuresAt.length && time - failuresAt[0] > 1e4) failuresAt.shift();
      failuresAt.push(time);
      status.error = error instanceof Error ? error.message : String(error);
      if (failuresAt.length >= (options.failureLimit ?? 3)) dispose("repeated-error");
    };
    const run = (callback) => {
      if (status.disabled) return;
      const start = now();
      status.calls++;
      try {
        const value = callback();
        if (value && typeof value.then === "function") {
          return Promise.resolve(value).then((result) => {
            return status.disabled ? void 0 : result;
          }, (error) => {
            fail(error);
            return void 0;
          });
        }
        return value;
      } catch (error) {
        fail(error);
        return void 0;
      } finally {
        status.lastMs = Math.max(0, now() - start);
        status.maxMs = Math.max(status.maxMs, status.lastMs);
        if (status.lastMs > budget) status.slowCalls++;
      }
    };
    const guard = (callback) => (...args) => run(() => callback(...args));
    const initialize = (callback, fallback) => {
      try {
        return callback();
      } catch (error) {
        fail(error);
        dispose("initialization-error");
        return fallback;
      }
    };
    const listeners = /* @__PURE__ */ new Set();
    let lastPrune = 0;
    const unlisten = (target, type, listener, options2) => {
      if (!target) return;
      const capture = typeof options2 === "boolean" ? options2 : !!options2?.capture;
      for (const entry of listeners) if (entry.target === target && entry.type === type && entry.original === listener && (typeof entry.options === "boolean" ? entry.options : !!entry.options?.capture) === capture) {
        target.removeEventListener?.(type, entry.wrapped, entry.options);
        entry.release();
        listeners.delete(entry);
      }
    };
    const listen = (target, type, listener, options2) => {
      if (!target || status.disabled) return;
      const time = now();
      if (time - lastPrune > 1e3) {
        lastPrune = time;
        for (const entry2 of listeners) if (time - entry2.since > 1e3 && "isConnected" in entry2.target && entry2.target.isConnected === false) {
          entry2.target.removeEventListener(entry2.type, entry2.wrapped, entry2.options);
          entry2.release();
          listeners.delete(entry2);
        }
      }
      if (listeners.size >= 4096) {
        dispose("listener-limit");
        return;
      }
      const wrapped = (event) => {
        if (typeof options2 === "object" && options2.once) unlisten(target, type, listener, options2);
        return run(() => listener.call(target, event));
      };
      target.addEventListener(type, wrapped, options2);
      const entry = { target, type, original: listener, wrapped, options: options2, since: time, release: () => {
      } };
      entry.release = onCleanup(() => {
        target.removeEventListener(type, wrapped, options2);
        listeners.delete(entry);
      });
      listeners.add(entry);
    };
    const timeouts = /* @__PURE__ */ new Map(), intervals = /* @__PURE__ */ new Map(), frames = /* @__PURE__ */ new Map();
    const cancelTimeout = (handle) => {
      window.clearTimeout(handle);
      timeouts.get(handle)?.();
      timeouts.delete(handle);
    };
    const cancelInterval = (handle) => {
      if (handle === void 0) return;
      window.clearInterval(handle);
      intervals.get(handle)?.();
      intervals.delete(handle);
    };
    const cancelFrame = (handle) => {
      window.cancelAnimationFrame(handle);
      frames.get(handle)?.();
      frames.delete(handle);
    };
    const timeout = (callback, delay = 0) => {
      if (status.disabled) return 0;
      let release = () => {
      };
      let handle = 0, fired = false;
      handle = window.setTimeout(() => {
        fired = true;
        release();
        timeouts.delete(handle);
        run(callback);
      }, delay);
      if (!fired) {
        release = onCleanup(() => {
          window.clearTimeout(handle);
          timeouts.delete(handle);
        });
        timeouts.set(handle, release);
      }
      return handle;
    };
    const interval = (callback, delay) => {
      if (status.disabled) return 0;
      const handle = window.setInterval(() => run(callback), delay);
      const release = onCleanup(() => {
        window.clearInterval(handle);
        intervals.delete(handle);
      });
      intervals.set(handle, release);
      return handle;
    };
    const frame = (callback) => {
      if (status.disabled) return 0;
      let release = () => {
      };
      const handle = window.requestAnimationFrame((time) => {
        release();
        frames.delete(handle);
        run(() => callback(time));
      });
      release = onCleanup(() => {
        window.cancelAnimationFrame(handle);
        frames.delete(handle);
      });
      frames.set(handle, release);
      return handle;
    };
    const microtask = (callback) => {
      if (!status.disabled) queueMicrotask(() => run(callback));
    };
    const observer = (callback) => {
      const instance = new MutationObserver((records, observer2) => {
        run(() => callback(records, observer2));
      });
      onCleanup(() => instance.disconnect());
      return instance;
    };
    const presentations = /* @__PURE__ */ new WeakMap();
    const preserve = (element, styles = [], classes = []) => {
      let saved = presentations.get(element);
      if (!saved) {
        saved = { styles: /* @__PURE__ */ new Map(), classes: /* @__PURE__ */ new Map() };
        presentations.set(element, saved);
        const entry = saved;
        onCleanup(() => {
          for (const [key, value] of entry.styles) if (element.style.getPropertyValue(key) === value.after && element.style.getPropertyPriority(key) === value.afterPriority) {
            if (value.before) element.style.setProperty(key, value.before, value.priority);
            else element.style.removeProperty(key);
          }
          for (const [key, value] of entry.classes) if (element.classList.contains(key) === value.after) element.classList.toggle(key, value.before);
        });
      }
      for (const key of styles) if (!saved.styles.has(key)) saved.styles.set(key, {
        before: element.style.getPropertyValue(key),
        priority: element.style.getPropertyPriority(key),
        after: element.style.getPropertyValue(key),
        afterPriority: element.style.getPropertyPriority(key)
      });
      for (const key of classes) if (!saved.classes.has(key)) saved.classes.set(key, { before: element.classList.contains(key), after: element.classList.contains(key) });
      return () => {
        for (const key of styles) {
          const value = saved.styles.get(key);
          value.after = element.style.getPropertyValue(key);
          value.afterPriority = element.style.getPropertyPriority(key);
        }
        for (const key of classes) saved.classes.get(key).after = element.classList.contains(key);
      };
    };
    return {
      run,
      guard,
      initialize,
      fail,
      dispose,
      onCleanup,
      listen,
      unlisten,
      timeout,
      interval,
      frame,
      microtask,
      observer,
      cancelTimeout,
      cancelInterval,
      cancelFrame,
      preserve,
      get disabled() {
        return status.disabled;
      },
      status: () => ({ ...status })
    };
  }
  function featureScope(id, options) {
    let scope = scopes.get(id);
    if (!scope) {
      scope = createFeatureScope(id, options);
      scopes.set(id, scope);
    }
    return scope;
  }
  function installFeatureDiagnostics(page, world) {
    const target = page;
    const debug = {
      status: () => [...scopes.values()].map((scope) => scope.status()),
      disable(id) {
        scopes.get(id)?.dispose("manual");
      }
    };
    if (world === "page") target.__kaspPageModulesDebug = debug;
    else target.__kaspModulesDebug = debug;
  }
  var scopes;
  var init_featureRuntime = __esm({
    "src/core/featureRuntime.ts"() {
      "use strict";
      scopes = /* @__PURE__ */ new Map();
    }
  });

  // src/core/gameDOM.ts
  var gameDOM;
  var init_gameDOM = __esm({
    "src/core/gameDOM.ts"() {
      "use strict";
      gameDOM = {
        supplyPrivacy: {
          counts: '.SuppliesComponentStyle-containersBlocks .SuppliesComponentStyle-cellAdd > span, .GarageCommonStyle-garageContainer:has([class*="GarageSupplies"]) .GarageItemComponentStyle-amountItemsScroll'
        },
        battleCreate: {
          joinButton: ".JoinToBattleComponentStyle-buttonJoin",
          root: ".BattleCreateComponentStyle-mainContainer",
          formats: ".BattleCreateComponentStyle-scrollBattlePick",
          formatCard: ".FormatsSectionComponentStyle-card",
          formatName: ".FormatsSectionComponentStyle-modeName h2",
          formatDescription: ".FormatsSectionComponentStyle-modeDescription p",
          formatCount: ".FormatsSectionComponentStyle-numberBattles p",
          formatImage: '[class*="backgroundImageCover"]',
          modeCard: ".blockCard",
          mapName: ".MapCardComponentStyle-message",
          selectedMap: ".MapCardComponentStyle-selectedPanel",
          options: ".BattleOptionsComponentStyle-rightBlock",
          parameterInputs: ".BattleOptionsComponentStyle-parameters .BattleCreateInputStyle-settings input",
          optionRows: ".BattleOptionsSectionComponentStyle-checkBoxSettingsCreateBattle",
          rankDropdowns: ".RankRangeSelectorStyle-rankRangeSelectorLabel .DropDownStyle-dropdownRoot",
          dropdownControl: ".DropDownStyle-dropdownControl",
          dropdownPlaceholder: ".DropDownStyle-dropdownPlaceholder",
          dropdownMenu: ".DropDownStyle-dropdownMenu",
          dropdownItems: ".DropDownStyle-innerContainerStyle",
          advancedClose: ".-alignSelfFlexEnd"
        },
        presence: {
          battleRoot: ".BattleHudComponentStyle-hudContainer, .BattleHudComponentStyle-container, .BattleComponentStyle-canvasContainer, .BattleTabStatisticComponentStyle-container",
          timer: '[class*="BattleTimerComponentStyle-battleTimer"]'
        },
        common: {
          appContainer: "#app-root > .-container",
          container: ".-container",
          backgroundDiv: 'div[class*="-backgroundImageContain"]',
          background: '[class*="backgroundImageContain"]',
          icon: '[class*="-backgroundImage"]',
          hotkey: ".-commonBlockForHotKey",
          hotkeyFragment: '[class*="-commonBlockForHotKey"]',
          flexDiv: 'div[class*="-displayFlex"]',
          boldSpan: "span.-bold"
        },
        account: {
          headerName: ".UserInfoContainerStyle-userNameRank",
          resultName: '#selfUserBg [class*="BattleKillBoardComponentStyle-col1"] span.-whiteSpaceNoWrap',
          privateHeaderFields: ".UserInfoContainerStyle-userNameRank, .UserInfoContainerStyle-progressValue",
          clientParameter: ".ClientInfoComponentStyle-parameterText",
          currencyIcon: ".HeaderCommonStyle-icons",
          currencyValues: ".UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span",
          currencyHeader: ".BreadcrumbsComponentStyle-rightButtonsContainer",
          currencyGroup: "div:has(> .HeaderCommonStyle-icons + .HeaderCommonStyle-icons)",
          tankoinContainer: ".UserScoreComponentStyle-coinsContainer",
          tankoinBalance: ".UserScoreComponentStyle-coinBlock span",
          tankoinIcon: ".UserScoreComponentStyle-coinIcon",
          exchangeBalance: ".ConverterDialogComponentStyle-modal .ConverterDialogComponentStyle-coinBalanceText",
          exchangeIcon: ".ConverterDialogComponentStyle-modal .ConverterDialogComponentStyle-coinBalanceIcon"
        },
        screens: {
          loader: ".ApplicationLoaderComponentStyle-container",
          garageOrLootBox: ".GarageCommonStyle-positionContent, .ContainerInfoComponentStyle-lootBoxContainer",
          friends: ".FriendListComponentStyle-containerFriends, .InvitationWindowsComponentStyle-centerBlock",
          battleHud: ".BattleHudComponentStyle-hudContainer, .BattleHudComponentStyle-container, .BattleComponentStyle-canvasContainer",
          loadingBackground: ".ApplicationLoaderComponentStyle-container.-background",
          battleCanvas: ".BattleComponentStyle-canvasContainer",
          tankPreview: ".GarageComponentStyle-tankPreview",
          visibleTankPreview: ".GarageComponentStyle-tankPreview.TankPreviewComponentStyle-visible",
          garage: ".GarageCommonStyle-positionContent, .GarageItemComponent-container, .ContainerInfoComponentStyle-lootBoxContainer, .GarageMainScreenStyle-blockParameters, .SkinsAndAlterationsStyle-SkinsVerticalComponent",
          lootBox: ".ContainerInfoComponentStyle-lootBoxContainer",
          shop: ".NewShopCommonComponentStyle-commonContainer",
          invitations: ".InvitationWindowsComponentStyle-centerBlock",
          progress: ".UserProgressComponentStyle-progressContainer"
        },
        dialogs: {
          container: ".DialogContainerComponentStyle-container",
          confirmation: ".DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton",
          contents: ".DialogContainerComponentStyle-container div",
          cancelKey: ".DialogContainerComponentStyle-keyButton",
          rubyImage: 'img[src*="rubyBlack"], img[src*="ruby"]'
        },
        navigation: {
          garageTabs: ".MenuComponentStyle-blockButtonsQECommunity .MenuComponentStyle-mainMenuItem",
          garageCategory: ".MenuComponentStyle-mainMenuItem",
          activeGarageCategory: ".MenuComponentStyle-mainMenuItem.-activeMenu",
          mountedBlock: '[class*="MountedItemsStyle-commonBlock"]',
          equipmentItem: '[class*="Item"], [class*="item"], [class*="Equipment"], [class*="equipment"]',
          backControls: '.BreadcrumbsComponentStyle-backButton, .IconStyle-iconBackArrow, [class*="backButton" i]',
          header: ".BreadcrumbsComponentStyle-headerContainer",
          title: ".BreadcrumbsComponentStyle-rootTitle > span",
          back: ".BreadcrumbsComponentStyle-backButton",
          primaryItem: ".PrimaryMenuItemComponentStyle-itemCommonLi.PrimaryMenuItemComponentStyle-menuItemContainer",
          settingsIcon: ".PrimaryMenuItemComponentStyle-itemLiOption",
          primaryItemName: ".PrimaryMenuItemComponentStyle-itemName",
          settingsContent: ".SettingsComponentStyle-container",
          footerList: ".FooterComponentStyle-footer ul"
        },
        garage: {
          skinArt: [".GarageItemComponentStyle-mainImg", ".garage-item img", ".MountedItemsStyle-itemPreview"],
          item: ".garage-item",
          itemImage: ".GarageItemComponentStyle-mainImg",
          itemName: ".ItemDescriptionComponentStyle-nameItem",
          itemDescription: ".GarageItemComponentStyle-descriptionDevice span",
          weaponName: ".ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span",
          upgradeTitles: ".ItemDescriptionComponentStyle-nameItem span, .GarageItemComponentStyle-descriptionDevice span, .MountedItemsStyle-tankPartNameContainer h1",
          deviceIcon: ".DeviceButtonComponentStyle-deviceIcon",
          priceButton: ".SquarePriceButtonComponentStyle-commonBlockButton",
          maxPriceTitle: ".SquarePriceButtonComponentStyle-commonBlockButton h2",
          actionContainer: ".TanksPartBaseComponentStyle-buttonsContainer",
          mountContainer: ".TanksPartBaseComponentStyle-marginTop",
          established: ".TanksPartBaseComponentStyle-marginTop .-buttonEstablished",
          coinIcon: ".GarageCommonStyle-iconCoinSmall",
          actionButton: ".GarageCommonStyle-bigActionButton",
          styledActions: ".GarageCommonStyle-bigActionButton, .AlterationButtonStyle-commonButton",
          weaponActions: ".GarageCommonStyle-bigActionButton, .SquarePriceButtonComponentStyle-commonBlockButton",
          suppliesActions: ".GarageSuppliesComponentStyle-containerButtons",
          mountedEquipment: ".MountedItemsStyle-commonBlockForTurretsHulls",
          mountedPreview: ".MountedItemsStyle-itemPreview",
          submenu: ".GarageCommonStyle-subMenu"
        },
        augments: {
          cardImage: "img.SkinCellStyle-iconCell"
        },
        skins: {
          cards: ".SkinsAndAlterationsStyle-SkinsVerticalComponent",
          cardTitle: ".SkinCellStyle-nameDevices",
          cardIcon: ".SkinCellStyle-iconCell",
          equippedIcon: ".SkinCellStyle-mountIcon"
        },
        paints: {
          caption: ".PaintsCollectionComponentStyle-captionPaint",
          categoryInfo: ".PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory",
          items: ".ListItemsComponentStyle-itemsContainer"
        },
        friends: {
          lists: ".FriendListComponentStyle-scrollCommunity, .InvitationWindowsComponentStyle-usersScroll",
          card: ".FriendListComponentStyle-blockList",
          invitationCard: ".InvitationWindowsComponentStyle-usersScroll > div > div",
          online: ".FriendListComponentStyle-greenTextOnline",
          offline: ".FriendListComponentStyle-offline",
          contextMenu: ".ContextMenuStyle-menu",
          contextPlayer: ".ContextMenuStyle-menuItemRank"
        },
        play: {
          hiddenNativeDecorations: '.MainScreenComponentStyle-playButtonContainer div[class*="ksc-"], .MainScreenComponentStyle-playButtonContainer [class*="lock"]:not(.main-lock-icon), .MainScreenComponentStyle-playButtonContainer img[src*="lock"]',
          autoQueueCards: '[class*="BattlePickComponentStyle"], [class*="blockCard"], [class*="commonStyleBlock"]',
          disabled: ".MainScreenComponentStyle-disabledButtonPlay",
          cards: '.BattlePickComponentStyle-commonStyleBlock, .blockCard, [class*="commonStyleBlock"]',
          container: ".MainScreenComponentStyle-playButtonContainer",
          untreatedContainer: '.MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"])',
          button: ".MainScreenComponentStyle-buttonPlay",
          mainMenu: ".MainScreenComponentStyle-blockMainMenu"
        },
        lobbyNavigation: {
          root: ".MainScreenComponentStyle-containerForMenuGradient",
          cards: ".MainScreenComponentStyle-playButtonContainer, #quick-play-wrapper .custom-mode-button, .PrimaryMenuItemComponentStyle-menuItemContainer, .FooterComponentStyle-containerMenu"
        },
        lobbyPasses: {
          announcement: ".AnnouncementHomeScreenComponentStyle-mainContainer",
          announcementBody: ".AnnouncementHomeScreenComponentStyle-mainBackGroundContainer",
          announcementCaption: ".AnnouncementHomeScreenComponentStyle-announceContainer",
          announcementTimer: ".AnnouncementHomeScreenComponentStyle-headerTimer",
          challenge: ".BattlePassLobbyComponentStyle-menuBattlePass",
          heading: ".BattlePassLobbyComponentStyle-descriptionMenuPass span",
          stars: ".BattlePassLobbyComponentStyle-numberStar span",
          time: ".BattlePassLobbyComponentStyle-timers",
          tracks: ".BattlePassLobbyComponentStyle-blockBattlePass",
          trackName: ".BattlePassLobbyComponentStyle-commonDescription > span",
          trackStatus: ".BattlePassLobbyComponentStyle-commonDescription > p",
          locked: ".BattlePassLobbyComponentStyle-lockedBlock, .BattlePassLobbyComponentStyle-iconLocked, .BattlePassLobbyComponentStyle-imageClosed",
          elite: ".EventBattlePassLobbyComponentStyle-buttonEventBattlePass",
          eliteLevel: ".EventBattlePassLobbyComponentStyle-commonBlockProgressBar > h2",
          eliteTime: ".ChallengeTimerComponentStyle-textTime",
          eliteCircle: ".EventBattlePassLobbyComponentStyle-progressBar"
        },
        trophies: {
          rewardImage: '[class*="rewardsContainer"] [class*="-backgroundImageContain"]',
          cards: ".MainQuestComponentStyle-cardPlayCommon, .TableMainQuestComponentStyle-commonTableMainQuest, .MainQuestComponentStyle-cardPlay",
          favorite: ".PaintsCollectionComponentStyle-favoriteIconContainer",
          resultText: ".BattleResultQuestProgressComponentStyle-text",
          resultCards: ".BattleResultQuestProgressComponentStyle-container",
          lobbyAnchor: ".BattlePassLobbyComponentStyle-menuBattlePass"
        },
        statistics: {
          killBoardHead: ".BattleKillBoardComponentStyle-tableContainer table > thead",
          container: ".BattleTabStatisticComponentStyle-container",
          nickname: ".BattleTabStatisticComponentStyle-nicknameCell",
          nicknameText: ".BattleTabStatisticComponentStyle-nicknameCell span",
          equipment: ".BattleTabStatisticComponentStyle-commonBlock",
          selectedRow: ".BattleTabStatisticComponentStyle-selectedRowBackGround",
          blueTeam: ".BattleTabStatisticComponentStyle-blueTeamTableContainer",
          redTeam: ".BattleTabStatisticComponentStyle-redTeamTableContainer",
          dmTeam: ".BattleTabStatisticComponentStyle-dmTableContainer",
          deviceCell: ".BattleTabStatisticComponentStyle-deviceCell",
          hullCell: ".BattleTabStatisticComponentStyle-defenceCell",
          teams: ".BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults",
          headerRows: ":is(.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults) table thead tr",
          resistanceCell: ".BattleTabStatisticComponentStyle-resistanceModuleCell",
          options: ".BattleTabStatisticComponentStyle-commonContainerIconOptions"
        },
        results: {
          selfRow: "#selfUserBg",
          columnPrefix: ".BattleKillBoardComponentStyle-col",
          playerName: '[class*="BattleKillBoardComponentStyle-col1"] span.-whiteSpaceNoWrap',
          nicknameCell: '.BattleKillBoardComponentStyle-col1, [class*="BattleKillBoardComponentStyle-col1"]',
          rankIcon: ".BattleKillBoardComponentStyle-rankIcon",
          gearScore: ".BattleKillBoardComponentStyle-col2 span",
          score: ".BattleKillBoardComponentStyle-col3",
          kills: ".BattleKillBoardComponentStyle-col4",
          deaths: ".BattleKillBoardComponentStyle-col5",
          kd: ".BattleKillBoardComponentStyle-col6",
          stars: ".BattleKillBoardComponentStyle-col8",
          body: ".TableComponentStyle-tBody",
          mapName: ".BattleResultHeaderComponentStyle-mapName",
          status: ".BattleResultHeaderComponentStyle-resultText",
          statusFallback: '[class*="descriptionVictory"], [class*="descriptionDefeat"], [class*="descriptionDraw"]',
          firstTeamScore: ".BattleResultHeaderComponentStyle-firstTeamAccount .BattleResultHeaderComponentStyle-teamAccount",
          secondTeamScore: ".BattleResultHeaderComponentStyle-twoTeamAccount .BattleResultHeaderComponentStyle-teamAccount"
        },
        classes: {
          tankoinContainer: "UserScoreComponentStyle-coinsContainer",
          currencyIcon: "HeaderCommonStyle-icons",
          tankoinBlock: "UserScoreComponentStyle-coinBlock",
          tankoinIcon: "UserScoreComponentStyle-coinIcon",
          formatSelected: "FormatsSectionComponentStyle-selectedCard",
          formatUnselected: "FormatsSectionComponentStyle-unSelectedCard",
          settingsTab: "SettingsMenuComponentStyle-menuItemOptions",
          settingsActive: "SettingsMenuComponentStyle-activeItemOptions",
          settingsSlider: "SettingsMenuComponentStyle-slideMenuOptions",
          wideGarageButton: "-widthHeightButtonGarage",
          activeMenu: "-activeMenu",
          upgradeTransition: "GarageCommonStyle-animatedBlurredRightBlock",
          upgradeButton: "SquarePriceButtonComponentStyle-commonBlockButton -commonButtonUpdate -flexCenterAlignCenter -displayFlex -alignCenter",
          footerEntry: "FooterComponentStyle-containerMenu",
          friendList: "FriendListComponentStyle-scrollCommunity",
          disabledPlay: "MainScreenComponentStyle-disabledButtonPlay",
          gridTrophy: "MainQuestComponentStyle-cardPlay",
          favorite: "PaintsCollectionComponentStyle-favoriteIconContainer",
          defenceLabel: "BattleTabStatisticComponentStyle-defenceLabel",
          flexCenter: "-flexCenterAlignCenter",
          mask: "-maskImageContain -maskImage",
          regular: "-regular",
          normal: "-normal",
          flexStart: "-flexStart"
        },
        ids: {
          selfRow: "selfUserBg",
          spacer: "rowSpace",
          teamDivider: "teamRowSpace"
        },
        fragments: {
          nicknameText: "whiteSpaceNoWrap",
          header: "header"
        },
        settings: {
          root: ".SettingsComponentStyle-blockContentOptions",
          nativeTabs: ".SettingsMenuComponentStyle-menuItemOptions:not(#kaspersky-tab)",
          tab: ".SettingsMenuComponentStyle-menuItemOptions",
          content: ".SettingsComponentStyle-containerBlock"
        }
      };
    }
  });

  // src/core/accountId.ts
  function normalizeAccountId(value) {
    try {
      if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
      if (!["string", "number", "bigint", "object"].includes(typeof value) || value === null) return null;
      const text2 = String(value);
      if (!/^-?[1-9]\d{0,19}$/.test(text2)) return null;
      const id = BigInt(text2);
      return id >= -(1n << 63n) && id < 1n << 64n ? text2 : null;
    } catch {
      return null;
    }
  }
  var ACCOUNT_IDENTITY_MESSAGE, ACCOUNT_IDENTITY_REQUEST;
  var init_accountId = __esm({
    "src/core/accountId.ts"() {
      "use strict";
      ACCOUNT_IDENTITY_MESSAGE = "kasp:account-identity";
      ACCOUNT_IDENTITY_REQUEST = "kasp:account-identity:request";
    }
  });

  // src/core/pageMessages.ts
  function identity(value) {
    if (!object(value) || !text(value.userId, 21) || !/^-?[1-9]\d{0,19}$/.test(value.userId) || !text(value.nickname, 128)) return false;
    const id = BigInt(value.userId);
    return id >= -(1n << 63n) && id < 1n << 64n;
  }
  function valid(message) {
    const detail = message.detail;
    switch (message.type) {
      case "kasp:account-identity:request":
      case "kasp:game-augments-request":
        return true;
      case "kasp:account-identity": {
        const snapshot = message.snapshot;
        return object(snapshot) && (snapshot.account === null || identity(snapshot.account) && object(snapshot.account) && typeof snapshot.account.clanTag === "string" && snapshot.account.clanTag.length <= 128) && Array.isArray(snapshot.players) && snapshot.players.length <= 6e3 && snapshot.players.every(identity);
      }
      case "kasp:game-augments":
        return object(detail) && detail.format === "kasp-augments-v1" && Array.isArray(detail.devices) && detail.devices.length <= 2e4;
      case "kasp:battle-kind":
        return detail === "MM" || detail === "PRO";
      case "kasp:battle-mode":
        return typeof detail === "string" && modes.test(detail);
      case "kasp:useraction":
        return Array.isArray(detail) && detail.length >= 3 && detail.length <= 4 && detail[0] === "TankUserActionLog" && text(detail[1], 29) && detail[1].trim().length >= 2 && typeof detail[2] === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(detail[2]) && (detail.length === 3 || typeof detail[3] === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(detail[3]));
      case "kasp:bonus-pickup": {
        if (typeof detail === "string") return /^\d{1,20}$/.test(detail);
        if (!object(detail) || typeof detail.model !== "string" || !/^\d{1,20}$/.test(detail.model)) return false;
        const position = detail.position;
        return position === null || object(position) && ["x", "y", "z"].every((axis) => finite(position[axis], -1e8, 1e8));
      }
      case "kasp:battle-presence": {
        const battle = message.battle;
        return finite(message.at, 0, Number.MAX_SAFE_INTEGER) && (battle === null || object(battle) && typeof battle.map === "string" && battle.map.length <= 128 && (battle.mode === void 0 || typeof battle.mode === "string" && modes.test(battle.mode)) && (battle.remaining === void 0 || finite(battle.remaining, 0, 86400)) && (battle.players === void 0 || Number.isInteger(battle.players) && finite(battle.players, 0, 1e3)) && (battle.maxPlayers === void 0 || Number.isInteger(battle.maxPlayers) && finite(battle.maxPlayers, 1, 1e3)));
      }
      case "kasp:overdrive-direction": {
        const pose = message.pose;
        const position = object(pose) ? pose.position : null;
        return finite(message.at, 0, Number.MAX_SAFE_INTEGER) && (pose === null || object(pose) && object(position) && ["x", "y", "z"].every((axis) => finite(position[axis], -1e8, 1e8)) && finite(pose.yaw, -1e6, 1e6));
      }
      case "kasp:discord-presence": {
        const presence = message.presence;
        if (message.version !== 1) return false;
        return presence === null || object(presence) && text(presence.details, 128) && text(presence.state, 128) && (presence.timestamps === void 0 || object(presence.timestamps) && finite(presence.timestamps.end, 0, Number.MAX_SAFE_INTEGER)) && (presence.party === void 0 || object(presence.party) && Array.isArray(presence.party.size) && presence.party.size.length === 2 && presence.party.size.every((n) => Number.isInteger(n) && finite(n, 0, 1e3)) && presence.party.size[1] > 0 && presence.party.size[0] <= presence.party.size[1]);
      }
      default:
        return false;
    }
  }
  function readPageMessage(event, page, type) {
    if (event.source !== page || event.origin !== page.location.origin || !object(event.data) || event.data.type !== type) return null;
    return valid(event.data) ? event.data : null;
  }
  function postPageMessage(page, message) {
    if (valid(message)) page.postMessage(message, page.location.origin);
  }
  var object, text, finite, modes;
  var init_pageMessages = __esm({
    "src/core/pageMessages.ts"() {
      "use strict";
      object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
      text = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max;
      finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
      modes = /^(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/;
    }
  });

  // src/core/accountIdentity.ts
  function parseAccountIdentity(text2) {
    const displayName = text2.trim();
    const clanTag = /^\[.*?\]/.exec(displayName)?.[0] || "";
    const nickname = displayName.replace(/^\[.*?\]\s*/, "").trim();
    return nickname ? { nickname, clanTag, displayName } : null;
  }
  function getAccountIdentity() {
    const header = document.querySelector(gameDOM.account.headerName);
    const identity2 = parseAccountIdentity(header?.textContent || "");
    if (identity2) return identity2;
    for (const parameter of document.querySelectorAll(gameDOM.account.clientParameter)) {
      const uid = /^UID:\s*(.+)$/i.exec(parameter.textContent?.trim() || "");
      if (uid) return parseAccountIdentity(uid[1]);
    }
    const selfName = document.querySelector(gameDOM.account.resultName);
    return parseAccountIdentity(selfName?.textContent || "");
  }
  function setupAccountIdentity() {
    if (initialized) return;
    initialized = true;
    const lifecycle29 = featureScope("accountIdentity");
    lifecycle29.onCleanup(() => {
      nativeAccount = null;
      players.clear();
      receivedAt = 0;
    });
    lifecycle29.listen(window, "message", (event) => {
      const message = readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE);
      if (!message) return;
      const snapshot = message.snapshot;
      nativeAccount = null;
      players = /* @__PURE__ */ new Map();
      receivedAt = Date.now();
      const account = snapshot?.account;
      const userId = typeof account?.userId === "string" ? normalizeAccountId(account.userId) : null;
      if (!account || !userId || typeof account.nickname !== "string" || !account.nickname.trim() || typeof account.clanTag !== "string") return;
      nativeAccount = { userId, nickname: account.nickname, clanTag: account.clanTag };
      if (!Array.isArray(snapshot.players) || snapshot.players.length > 6e3) return;
      for (const player of snapshot.players) {
        const id = typeof player?.userId === "string" ? normalizeAccountId(player.userId) : null;
        if (!id || typeof player.nickname !== "string" || !player.nickname.trim()) continue;
        const previous = players.get(player.nickname);
        players.set(player.nickname, previous === void 0 || previous === id ? id : null);
      }
      const key = JSON.stringify([nativeAccount, [...players]]);
      if (key !== identityKey) {
        identityKey = key;
        identityRevision++;
      }
    });
    postPageMessage(window, { type: ACCOUNT_IDENTITY_REQUEST });
  }
  function getVerifiedAccount() {
    if (!nativeAccount) return null;
    const visible = getAccountIdentity();
    if (visible && visible.nickname !== nativeAccount.nickname) return null;
    return { ...nativeAccount };
  }
  function getPlayerUserId(nickname) {
    return getVerifiedAccount() && Date.now() - receivedAt <= 5e3 ? players.get(nickname) || null : null;
  }
  function getAccountIdentityRevision() {
    return identityRevision;
  }
  var nativeAccount, receivedAt, players, initialized, identityRevision, identityKey;
  var init_accountIdentity = __esm({
    "src/core/accountIdentity.ts"() {
      "use strict";
      init_accountId();
      init_featureRuntime();
      init_gameDOM();
      init_pageMessages();
      nativeAccount = null;
      receivedAt = 0;
      players = /* @__PURE__ */ new Map();
      initialized = false;
      identityRevision = 0;
      identityKey = "";
    }
  });

  // src/modules/hideNickname.ts
  function setTooltip(element, text2) {
    if (element.getAttribute("data-kasp-private-tooltip") !== text2) {
      element.setAttribute("data-kasp-private-tooltip", text2);
    }
  }
  function hideNickname() {
    if (!utils.getSetting("k_hideNicknameXP", false)) return;
    const root = document.documentElement;
    if (!root) return;
    if (!root.classList.contains("kasp-hide-nickname")) root.classList.add("kasp-hide-nickname");
    const label = state.lang === "RU" ? '"\u0421\u043A\u0440\u044B\u0442\u043E"' : '"Hidden"';
    if (root.style.getPropertyValue("--kasp-hidden-label") !== label) {
      root.style.setProperty("--kasp-hidden-label", label);
    }
    document.querySelectorAll(gameDOM.account.privateHeaderFields).forEach((element) => {
      setTooltip(element, element.textContent?.trim() || "");
    });
    document.querySelectorAll(gameDOM.account.clientParameter).forEach((element) => {
      const uid = /^UID:\s*(.*)$/i.exec(element.textContent?.trim() || "");
      if (uid) {
        if (element.hasAttribute("data-kasp-public-parameter")) element.removeAttribute("data-kasp-public-parameter");
        if (!element.hasAttribute("data-kasp-private-uid")) element.setAttribute("data-kasp-private-uid", "");
        setTooltip(element, uid[1]);
      } else {
        if (!element.hasAttribute("data-kasp-public-parameter")) element.setAttribute("data-kasp-public-parameter", "");
        if (element.hasAttribute("data-kasp-private-uid")) {
          element.removeAttribute("data-kasp-private-uid");
          element.removeAttribute("data-kasp-private-tooltip");
        }
      }
    });
    const own = getAccountIdentity()?.nickname;
    document.querySelectorAll(gameDOM.statistics.nicknameText).forEach((element) => {
      const isSelf = !!own && parseAccountIdentity(element.textContent || "")?.nickname === own;
      if (isSelf && !element.hasAttribute("data-kasp-private-nickname")) {
        element.setAttribute("data-kasp-private-nickname", "");
      } else if (!isSelf && element.hasAttribute("data-kasp-private-nickname")) {
        element.removeAttribute("data-kasp-private-nickname");
      }
    });
  }
  function setupNicknamePrivacy() {
    if (lifecycle.disabled) return;
    if (!utils.getSetting("k_hideNicknameXP", false)) return;
    hideNickname();
    if (privacyObserver) return;
    privacyObserver = lifecycle.observer(hideNickname);
    privacyObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "id"]
    });
  }
  var lifecycle, privacyObserver;
  var init_hideNickname = __esm({
    "src/modules/hideNickname.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      init_accountIdentity();
      lifecycle = featureScope("hideNickname");
      privacyObserver = null;
      lifecycle.onCleanup(() => {
        privacyObserver?.disconnect();
        document.documentElement.classList.remove("kasp-hide-nickname");
      });
    }
  });

  // src/core/coreSettings.ts
  var coreSettings;
  var init_coreSettings = __esm({
    "src/core/coreSettings.ts"() {
      "use strict";
      init_state();
      init_gameDOM();
      init_utils();
      init_hideNickname();
      init_accountIdentity();
      coreSettings = /* @__PURE__ */ (() => {
        let needsReload = false;
        const liveSettings = /* @__PURE__ */ new Set(["k_arcade_reload", "k_critical_indicator", "k_hideSupplies"]);
        let initialSettingsState = {};
        let stylesInjected = false;
        const t = {
          RU: {
            title: "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418 KASPERSKY'S INVENTIONS",
            tooltip: "\u0422\u0420\u0415\u0411\u0423\u0415\u0422\u0421\u042F \u041F\u0415\u0420\u0415\u0417\u0410\u0413\u0420\u0423\u0417\u041A\u0410"
          },
          EN: {
            title: "KASPERSKY'S INVENTIONS SETTINGS",
            tooltip: "REQUIRES RELOAD"
          }
        };
        const MY_SETTINGS = [
          { id: "k_ext_btn", label: { RU: "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u043D\u0430\u044F \u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0418\u0433\u0440\u0430\u0442\u044C\xBB", EN: "Enhanced \xABPlay\xBB button" }, default: false },
          { id: "k_augments", label: { RU: "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432", EN: "Augment specifications" }, default: false },
          { id: "k_auto_upgrade", label: { RU: "\u0411\u044B\u0441\u0442\u0440\u043E\u0435 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435 \u0432\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u044F", EN: "Quick weapon upgrades" }, default: false },
          { id: "k_friends", label: { RU: "\u041C\u0435\u0442\u043A\u0438 \u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0434\u0440\u0443\u0437\u0435\u0439", EN: "Friend tags & categories" }, default: false },
          { id: "k_paints", label: { RU: "\u0423\u043C\u043D\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u043A\u0440\u0430\u0441\u043E\u043A", EN: "Smart paint search" }, default: false },
          { id: "k_hideCurrency", label: { RU: "\u0421\u043A\u0440\u044B\u0442\u044C \u0432\u0430\u043B\u044E\u0442\u0443", EN: "Hide currency" }, default: false },
          { id: "k_hideNicknameXP", label: { RU: "\u0421\u043A\u0440\u044B\u0442\u044C \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0438 \u043E\u043F\u044B\u0442", EN: "Hide nickname and score" }, default: false },
          { id: "k_hideSupplies", label: { RU: "\u0421\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0438\u043F\u0430\u0441\u044B", EN: "Hide supplies" }, default: false },
          { id: "k_history", label: { RU: "\u0412\u0435\u0441\u0442\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0431\u0438\u0442\u0432", EN: "Keep a history of battles" }, default: false },
          { id: "k_overdrive_timer", label: { RU: "\u0422\u0430\u0439\u043C\u0435\u0440 \u043A\u043E\u0440\u043E\u0431\u043A\u0438 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430", EN: "Overdrive box timer" }, default: false },
          { id: "k_arcade_reload", label: { RU: "\u041F\u043E\u043B\u043E\u0441\u0430 \u0430\u0440\u043A\u0430\u0434\u043D\u043E\u0439 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438", EN: "Arcade reload indicator" }, default: true },
          { id: "k_critical_indicator", label: { RU: "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430", EN: "Critical shot indicator" }, default: true }
        ];
        return {
          inject: () => {
            if (!stylesInjected) {
              stylesInjected = true;
            }
            const mainBlock = document.querySelector(gameDOM.settings.root);
            if (!mainBlock) return;
            const ulMenu = mainBlock.querySelector("ul");
            if (!ulMenu || document.getElementById("kaspersky-tab")) return;
            const lang = state.lang;
            const dict = t[lang] || t["EN"];
            let tooltip = document.getElementById("kaspersky-reload-tooltip");
            if (!tooltip) {
              tooltip = document.createElement("div");
              tooltip.id = "kaspersky-reload-tooltip";
              tooltip.className = "kasp-tooltip kasp-hidden";
              tooltip.textContent = dict.tooltip;
              document.body.appendChild(tooltip);
            }
            const kTab = document.createElement("li");
            kTab.id = "kaspersky-tab";
            kTab.className = gameDOM.classes.settingsTab;
            kTab.innerHTML = `<div class="kasp-fake-highlight"><div class="kasp-fake-line"></div></div><span>KASPERSKY</span>`;
            ulMenu.appendChild(kTab);
            const kContent = document.createElement("div");
            kContent.id = "kaspersky-settings-content";
            kContent.className = "kasp-hidden";
            let togglesHTML = `
                    <div style="font-family: BaseFontBold, FallbackFontBold; font-size: 1.2em; color: rgb(118, 255, 51); margin-bottom: 1.5em; text-transform: uppercase;">
                        ${dict.title}
                    </div>
                    <div style="width: 100%; height: 1px; background-color: rgba(255, 255, 255, 0.15); margin-bottom: 1.5em;"></div>
                `;
            MY_SETTINGS.forEach((setting) => {
              const isChecked = utils.getSetting(setting.id, setting.default);
              initialSettingsState[setting.id] = isChecked;
              const localizedLabel = setting.label[lang] || setting.label["EN"];
              togglesHTML += `
                        <div class="kasp-toggle-row ${isChecked ? "kasp-active" : ""}" data-id="${setting.id}">
                            <div class="kasp-toggle-switch"></div>
                            <div class="kasp-toggle-label">${localizedLabel}</div>
                        </div>
                    `;
            });
            kContent.innerHTML = togglesHTML;
            if (!getVerifiedAccount()) {
              const notice = document.createElement("p");
              notice.textContent = lang === "RU" ? "ID \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0438 \u043B\u0438\u0447\u043D\u043E\u0435 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B; \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435." : "Account ID is unavailable. History and personal favorites are temporarily unavailable; saved data is preserved.";
              kContent.appendChild(notice);
            }
            mainBlock.appendChild(kContent);
            kContent.querySelectorAll(".kasp-toggle-row").forEach((node) => {
              const row = node;
              const label = row.querySelector(".kasp-toggle-label");
              const switchBtn = row.querySelector(".kasp-toggle-switch");
              label.addEventListener("mousemove", (e) => {
                if (liveSettings.has(row.getAttribute("data-id") || "")) {
                  tooltip?.classList.add("kasp-hidden");
                  return;
                }
                if (tooltip) {
                  tooltip.style.left = e.clientX + "px";
                  tooltip.style.top = e.clientY + "px";
                  tooltip.classList.remove("kasp-hidden");
                }
              });
              label.addEventListener("mouseleave", () => {
                if (tooltip) tooltip.classList.add("kasp-hidden");
              });
              row.addEventListener("click", function(e) {
                const target = e.target;
                if (target !== label && target !== switchBtn && !switchBtn.contains(target)) return;
                const rowEl = this;
                const id = rowEl.getAttribute("data-id");
                if (!id) return;
                const isCurrentlyChecked = rowEl.classList.contains("kasp-active");
                const performToggle = () => {
                  if (isCurrentlyChecked) {
                    rowEl.classList.remove("kasp-active");
                    utils.setSetting(id, false);
                  } else {
                    rowEl.classList.add("kasp-active");
                    utils.setSetting(id, true);
                  }
                  needsReload = MY_SETTINGS.some((s) => {
                    if (liveSettings.has(s.id)) return false;
                    const currentVal = utils.getSetting(s.id, s.default);
                    return currentVal !== initialSettingsState[s.id];
                  });
                };
                performToggle();
                if (id === "k_hideNicknameXP") {
                  if (!isCurrentlyChecked) setupNicknamePrivacy();
                  else document.documentElement.classList.remove("kasp-hide-nickname");
                }
              });
            });
            kTab.addEventListener("click", (e) => {
              e.stopPropagation();
              const allTabs = ulMenu.querySelectorAll(gameDOM.settings.nativeTabs);
              allTabs.forEach((t2) => t2.classList.remove(gameDOM.classes.settingsActive));
              kTab.classList.add(gameDOM.classes.settingsActive);
              ulMenu.classList.add("kasp-hide-native-slider");
              const nativeContent = mainBlock.querySelector(gameDOM.settings.content);
              if (nativeContent) nativeContent.style.display = "none";
              kContent.classList.remove("kasp-hidden");
            });
            ulMenu.addEventListener("click", (e) => {
              const target = e.target;
              const clickedTab = target.closest(gameDOM.settings.tab);
              if (clickedTab && clickedTab.id !== "kaspersky-tab" && !clickedTab.classList.contains(gameDOM.classes.settingsSlider)) {
                kTab.classList.remove(gameDOM.classes.settingsActive);
                ulMenu.classList.remove("kasp-hide-native-slider");
                kContent.classList.add("kasp-hidden");
                const nativeContent = mainBlock.querySelector(gameDOM.settings.content);
                if (nativeContent) nativeContent.style.display = "";
              }
            });
          },
          onClose: () => {
            const tooltip = document.getElementById("kaspersky-reload-tooltip");
            if (tooltip) tooltip.classList.add("kasp-hidden");
            if (needsReload) window.location.reload();
          }
        };
      })();
    }
  });

  // src/core/clientLexical.ts
  var init_clientLexical = __esm({
    "src/core/clientLexical.ts"() {
      "use strict";
    }
  });

  // src/core/clientPatches.ts
  var init_clientPatches = __esm({
    "src/core/clientPatches.ts"() {
      "use strict";
      init_clientLexical();
    }
  });

  // src/core/augmentLabels.ts
  function augmentPropertyLabel(property, language) {
    if (language === "RU" && russian[property]) return russian[property];
    const text2 = property.replace(/^ISIS_/, "ISIDA_").replace(/^MACHINE_GUN_/, "VULCAN_").replace(/^SHOTGUN_/, "HAMMER_").replace(/^ROCKET_LAUNCHER_/, "STRIKER_").replace(/^SCORPIO_/, "SCORPION_").toLowerCase().replace(/_/g, " ");
    return text2.charAt(0).toUpperCase() + text2.slice(1);
  }
  function resolveAugmentProperty(input) {
    const text2 = input.trim();
    if (/^[A-Z][A-Z0-9_]{0,100}$/.test(text2)) return text2;
    const normalized = text2.toLowerCase().replace(/\s+/g, " ");
    const matches = Object.keys(russian).filter((property) => ["RU", "EN"].some((language) => augmentPropertyLabel(property, language).toLowerCase().replace(/\s+/g, " ") === normalized));
    return matches.length === 1 ? matches[0] : null;
  }
  function augmentPropertyBenefit(property, delta) {
    if (!delta || !higherBetter.has(property) && !lowerBetter.has(property)) return "neutral";
    return (higherBetter.has(property) ? delta > 0 : delta < 0) ? "advantage" : "disadvantage";
  }
  var russian, higherBetter, lowerBetter;
  var init_augmentLabels = __esm({
    "src/core/augmentLabels.ts"() {
      "use strict";
      russian = {
        HULL_ARMOR: "\u0411\u0440\u043E\u043D\u044F",
        HULL_SPEED: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_MASS: "\u041C\u0430\u0441\u0441\u0430 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_TURN_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_TURN_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        TURRET_TURN_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u0431\u0430\u0448\u043D\u0438",
        TURRET_ROTATION_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u0431\u0430\u0448\u043D\u0438",
        INITIAL_TURRET_ANGLE: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0433\u043E\u043B \u0441\u0442\u0432\u043E\u043B\u0430",
        DAMAGE_FIXED: "\u0423\u0440\u043E\u043D",
        DAMAGE_FROM: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D",
        DAMAGE_TO: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D",
        DAMAGE_PER_HIT: "\u0423\u0440\u043E\u043D \u0437\u0430 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0435",
        DAMAGE_PER_PERIOD: "\u0423\u0440\u043E\u043D \u0437\u0430 \u0442\u0438\u043A",
        DAMAGE_PER_SECOND: "\u0423\u0440\u043E\u043D \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443",
        CRITICAL_HIT_DAMAGE: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0440\u043E\u043D",
        MAX_CRITICAL_HIT_CHANCE: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0448\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        START_CRITICAL_HIT_CHANCE: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0448\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        CRITICAL_CHANCE_DELTA: "\u041F\u0440\u0438\u0440\u043E\u0441\u0442 \u0448\u0430\u043D\u0441\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AFTER_CRIT_CRITICAL_HIT_CHANCE: "\u0428\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430 \u043F\u043E\u0441\u043B\u0435 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u044F",
        CRITICAL_HIT_CHANCE: "\u0428\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        WEAPON_RELOAD_TIME: "\u0412\u0440\u0435\u043C\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438",
        WEAPON_CHARGING_TIME: "\u0420\u0430\u0437\u043E\u0433\u0440\u0435\u0432 \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u043E\u043C",
        WEAPON_CHARGE_RATE: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u044D\u043D\u0435\u0440\u0433\u0438\u0438",
        WEAPON_DISCHARGE_RATE: "\u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043D\u0435\u0440\u0433\u0438\u0438",
        DISCHARGE_SPEED: "\u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u0430\u0442\u0430\u043A\u0438",
        ENERGY_PER_SHOT: "\u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u043D\u0430 \u0432\u044B\u0441\u0442\u0440\u0435\u043B",
        CONE_ANGLE: "\u0423\u0433\u043E\u043B \u043A\u043E\u043D\u0443\u0441\u0430",
        SHOT_RANGE: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
        HIGHLIGHTING_DISTANCE: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0434\u0441\u0432\u0435\u0442\u043A\u0438 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430",
        WEAPON_MAX_DAMAGE_RADIUS: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
        WEAPON_MIN_DAMAGE_RADIUS: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
        WEAPON_MIN_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
        WEAPON_WEAKENING_COEFF: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u043E\u0441\u043B\u0430\u0431\u043B\u0435\u043D\u0438\u044F \u0443\u0440\u043E\u043D\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0441\u0442\u0440\u0435\u043B\u0435",
        WEAPON_ANGLE_UP: "\u0423\u0433\u043E\u043B \u0430\u0432\u0442\u043E\u043F\u0440\u0438\u0446\u0435\u043B\u0430 \u0432\u0432\u0435\u0440\u0445",
        WEAPON_ANGLE_DOWN: "\u0423\u0433\u043E\u043B \u0430\u0432\u0442\u043E\u043F\u0440\u0438\u0446\u0435\u043B\u0430 \u0432\u043D\u0438\u0437",
        HEAT_PER_PERIOD: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043D\u0430\u0433\u0440\u0435\u0432\u0430",
        FREEZE_PER_TICK: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0437\u0430\u043C\u043E\u0440\u043E\u0437\u043A\u0438",
        FLAME_TEMPERATURE_LIMIT: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
        IMPACT_FORCE: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430",
        WEAPON_KICKBACK: "\u041E\u0442\u0434\u0430\u0447\u0430 \u043F\u0443\u0448\u043A\u0438",
        GRENADE_DAMAGE: "\u0423\u0440\u043E\u043D \u0433\u0440\u0430\u043D\u0430\u0442\u044B",
        ISIS_HEALING_PER_PERIOD: "\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u0437\u0430 \u0442\u0438\u043A",
        ISIS_DISCHARGE_SPEED_HEALING: "\u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        ISIS_DISCHARGE_SPEED_IDLE: "\u0420\u0430\u0441\u0445\u043E\u0434 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0432 \u0445\u043E\u043B\u043E\u0441\u0442\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435",
        ISIS_VAMPIRING_PERCENT: "\u0414\u043E\u043B\u044F \u043D\u0430\u043D\u043E\u0441\u0438\u043C\u043E\u0433\u043E \u0443\u0440\u043E\u043D\u0430, \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0449\u0430\u044F \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435",
        CRITICAL_HEALING_HITS: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043B\u0435\u0447\u0435\u043D\u0438\u0435",
        MAX_CRITICAL_HEALING_CHANCE: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0448\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        START_CRITICAL_HEALING_CHANCE: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0448\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        CRITICAL_HEALING_CHANCE_DELTA: "\u041F\u0440\u0438\u0440\u043E\u0441\u0442 \u0448\u0430\u043D\u0441\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        TESLA_GLOBE_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        TESLA_GLOBE_DISTANCE: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u0451\u0442\u0430 \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        TESLA_GLOBE_DAMAGE: "\u0423\u0440\u043E\u043D \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        TESLA_GLOBE_CHARGE_MS: "\u0412\u0440\u0435\u043C\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        TESLA_GLOBE_PREPARE_MS: "\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0437\u043E\u0433\u0440\u0435\u0432\u0430 \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        TESLA_EACH_TARGET_DAMAGE: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u0437\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u0446\u0435\u043B\u044C \u0432 \u0446\u0435\u043F\u043E\u0447\u043A\u0435",
        TESLA_CASCADE_GLOBE_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438 \u0432 \u0446\u0435\u043F\u043E\u0447\u043A\u0443",
        TESLA_CASCADE_ALLY_TANK_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u0430 \u0432 \u0446\u0435\u043F\u043E\u0447\u043A\u0443",
        TESLA_CASCADE_ENEMY_TANK_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430 \u0432 \u0446\u0435\u043F\u043E\u0447\u043A\u0443",
        MAX_RICOCHET_COUNT: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0440\u0438\u043A\u043E\u0448\u0435\u0442\u043E\u0432",
        SHELL_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        MIN_SHELL_SPEED: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        MAX_SHELL_SPEED: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SHELL_SPEED_AFTER_RICOCHET: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0434\u0430 \u043F\u043E\u0441\u043B\u0435 \u0440\u0438\u043A\u043E\u0448\u0435\u0442\u0430",
        SHELL_BOOST_PHASE_DURATION: "\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0437\u0433\u043E\u043D\u0430 \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SHELL_MAX_RICOCHET_ANGLE: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0443\u0433\u043E\u043B \u0440\u0438\u043A\u043E\u0448\u0435\u0442\u0430",
        SHELL_GRAVITY_COEF: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u0433\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u0438 \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SHELL_SPEEDS_COUNT: "\u0427\u0438\u0441\u043B\u043E \u0448\u0430\u0433\u043E\u0432 \u043D\u0430\u0431\u043E\u0440\u0430 \u0437\u0430\u0440\u044F\u0434\u0430",
        SHELL_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SPLASH_DAMAGE_RADIUS: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        CRITICAL_SPLASH_DAMAGE_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        RADIUS_OF_MAX_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        MIN_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C",
        SPLASH_DAMAGE_IMPACT: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430 \u0432\u0437\u0440\u044B\u0432\u0430",
        ELLIPTIC_CONE_HORIZONTAL_ANGLE: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0433\u043E\u043B \u0440\u0430\u0437\u0431\u0440\u043E\u0441\u0430",
        ELLIPTIC_CONE_VERTICAL_ANGLE: "\u0412\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0433\u043E\u043B \u0440\u0430\u0437\u0431\u0440\u043E\u0441\u0430",
        SHOTGUN_MAGAZINE_SIZE: "\u0417\u0430\u0440\u044F\u0434\u043E\u0432 \u0432 \u043E\u0431\u043E\u0439\u043C\u0435",
        SHOTGUN_PELLET_COUNT: "\u0427\u0438\u0441\u043B\u043E \u0434\u0440\u043E\u0431\u0438\u043D\u043E\u043A \u043D\u0430 \u0432\u044B\u0441\u0442\u0440\u0435\u043B",
        MAGAZINE_RELOAD_TIME: "\u0412\u0440\u0435\u043C\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043E\u0431\u043E\u0439\u043C\u044B",
        SALVO_SIZE: "\u0420\u0430\u043A\u0435\u0442 \u0432 \u0437\u0430\u043B\u043F\u0435",
        SALVO_AIMING_TIME: "\u0412\u0440\u0435\u043C\u044F \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F",
        SALVO_AIMING_GRACE_PERIOD: "\u0412\u0440\u0435\u043C\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F",
        TIME_BETWEEN_SHOTS_OF_SALVO: "\u041F\u0430\u0443\u0437\u0430 \u043C\u0435\u0436\u0434\u0443 \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430\u043C\u0438 \u0432 \u0437\u0430\u043B\u043F\u0435",
        SALVO_RELOAD_TIME: "\u0412\u0440\u0435\u043C\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u043B\u043F\u0430",
        ROCKET_MIN_ANGULAR_SPEED: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0433\u043B\u043E\u0432\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0440\u0430\u043A\u0435\u0442\u044B",
        ROCKET_MAX_ANGULAR_SPEED: "\u041A\u043E\u043D\u0435\u0447\u043D\u0430\u044F \u0443\u0433\u043B\u043E\u0432\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0440\u0430\u043A\u0435\u0442\u044B",
        MACHINE_GUN_WEAPON_TURN_DECELERATION_COEFF: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u0437\u0430\u043C\u0435\u0434\u043B\u0435\u043D\u0438\u044F \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u043F\u0443\u043B\u0435\u043C\u0451\u0442\u0430",
        MACHINE_GUN_SPIN_DOWN_TIME_SECOND: "\u0412\u0440\u0435\u043C\u044F \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0441\u0442\u0432\u043E\u043B\u043E\u0432",
        MACHINE_GUN_SPIN_UP_TIME_SECOND: "\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0441\u043A\u0440\u0443\u0442\u043A\u0438 \u0441\u0442\u0432\u043E\u043B\u043E\u0432",
        MACHINE_GUN_TEMPERATURE_HITTING_TIME_SECOND: "\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u043F\u0435\u0440\u0435\u0433\u0440\u0435\u0432\u0430",
        DEVICE_TARGET_HEAT_DELTA_ON_SELF_OVERHEAT: "\u041D\u0430\u0433\u0440\u0435\u0432 \u0446\u0435\u043B\u0438 \u043F\u0440\u0438 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0435\u0432\u0435",
        DEVICE_BONUS_ENERGY_ON_KILL: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u043F\u0440\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u0438 \u0446\u0435\u043B\u0438",
        DEVICE_BONUS_ENERGY_ON_DAMAGE: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u043F\u0440\u0438 \u043D\u0430\u043D\u0435\u0441\u0435\u043D\u0438\u0438 \u0443\u0440\u043E\u043D\u0430",
        ALLY_HEALING_MODE: "\u0420\u0435\u0436\u0438\u043C \u043B\u0435\u0447\u0435\u043D\u0438\u044F \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432",
        CASSETTE_COMBO_ADDITIONAL_DAMAGE: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u043A\u043E\u043C\u0431\u043E",
        CASSETTE_HOLD: "\u0423\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u043A\u0430\u0441\u0441\u0435\u0442\u044B",
        AIMED_RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AIMED_SPLASH_DAMAGE_RADIUS: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AIMED_RADIUS_OF_MAX_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AIMED_SHOT_IMPACT: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AIMED_SPLASH_DAMAGE_IMPACT: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430 \u0432\u0437\u0440\u044B\u0432\u0430 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SECONDARY_MAX_SHELL_SPEED: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SECONDARY_MIN_SHELL_SPEED: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SECONDARY_SHELL_BOOST_PHASE_DURATION: "\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0437\u0433\u043E\u043D\u0430 \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0434\u0430",
        SECONDARY_DAMAGE_FIXED: "\u0423\u0440\u043E\u043D \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SECONDARY_WEAPON_KICKBACK: "\u041E\u0442\u0434\u0430\u0447\u0430 \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SHAFT_AIMING_MODE_MAX_DAMAGE: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SHAFT_AIMING_MODE_MIN_DAMAGE: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SHAFT_MIN_AIMED_SHOT_ENERGY: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u044D\u043D\u0435\u0440\u0433\u0438\u044F \u043D\u0430 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u044B\u0439 \u0432\u044B\u0441\u0442\u0440\u0435\u043B",
        SHAFT_FAST_SHOT_ENERGY: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u043D\u0430 \u0432\u044B\u0441\u0442\u0440\u0435\u043B \u043D\u0430\u0432\u0441\u043A\u0438\u0434\u043A\u0443",
        SHAFT_HORIZONTAL_TARGETING_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u0440\u0438\u0446\u0435\u043B\u0438\u0432\u0430\u043D\u0438\u044F \u043F\u043E \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u0438",
        SHAFT_AIMED_SHOT_IMPACT: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430 \u0428\u0430\u0444\u0442\u0430",
        ULTIMATE_CHARGE_PER_SEC: "\u0417\u0430\u0440\u044F\u0434 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430 \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438",
        ULTIMATE_CHARGE_PER_SCORE_POINT: "\u0417\u0430\u0440\u044F\u0434 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430 \u043E\u0442 \u043E\u0447\u043A\u043E\u0432",
        HULL_SIDE_ACCELERATION: "\u0411\u043E\u043A\u043E\u0432\u043E\u0435 \u0443\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_REVERSE_TURN_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043E\u0431\u0440\u0430\u0442\u043D\u043E\u0433\u043E \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        HULL_TURN_STABILIZATION_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u0441\u0442\u0430\u0431\u0438\u043B\u0438\u0437\u0430\u0446\u0438\u0438 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430",
        HULL_REVERSE_ACCELERATION: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u0437\u0430\u0434\u043D\u0435\u0433\u043E \u0445\u043E\u0434\u0430",
        HULL_DECELERATION: "\u0417\u0430\u043C\u0435\u0434\u043B\u0435\u043D\u0438\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
        FIREBIRD_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u041E\u0433\u043D\u0435\u043C\u0451\u0442\u0430",
        FIREBIRD_OVERHEAT_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0440\u0435\u043D\u0438\u044F",
        SMOKY_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0421\u043C\u043E\u043A\u0438",
        TSUNAMI_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0426\u0443\u043D\u0430\u043C\u0438",
        SCORPIO_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0421\u043A\u043E\u0440\u043F\u0438\u043E\u043D\u0430",
        TWINS_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0422\u0432\u0438\u043D\u0441\u0430",
        RAILGUN_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0420\u0435\u043B\u044C\u0441\u044B",
        ISIS_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0418\u0437\u0438\u0434\u044B",
        MINE_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u043C\u0438\u043D",
        THUNDER_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0413\u0440\u043E\u043C\u0430",
        FREEZE_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0424\u0440\u0438\u0437\u0430",
        RICOCHET_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0420\u0438\u043A\u043E\u0448\u0435\u0442\u0430",
        SHAFT_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0428\u0430\u0444\u0442\u0430",
        MACHINE_GUN_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0412\u0443\u043B\u043A\u0430\u043D\u0430",
        SHOTGUN_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u041C\u043E\u043B\u043E\u0442\u0430",
        ROCKET_LAUNCHER_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0421\u0442\u0440\u0430\u0439\u043A\u0435\u0440\u0430",
        ARTILLERY_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u041C\u0430\u0433\u043D\u0443\u043C\u0430",
        TERMINATOR_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0422\u0435\u0440\u043C\u0438\u043D\u0430\u0442\u043E\u0440\u0430",
        GAUSS_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0413\u0430\u0443\u0441\u0441\u0430",
        TESLA_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0422\u0435\u0441\u043B\u044B",
        CRITICAL_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0443\u0440\u043E\u043D\u0430",
        ALL_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0432\u0441\u0435\u0445 \u0432\u0438\u0434\u043E\u0432 \u0443\u0440\u043E\u043D\u0430",
        CHAOS_RESISTANCE: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0425\u0430\u043E\u0441\u0430",
        SHAFT_VERTICAL_TARGETING_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u0440\u0438\u0446\u0435\u043B\u0438\u0432\u0430\u043D\u0438\u044F \u043F\u043E \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0438",
        SHAFT_AIMING_MODE_CHARGE_RATE: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SHAFT_ROTATION_DECELERATION_COEFF: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u0437\u0430\u043C\u0435\u0434\u043B\u0435\u043D\u0438\u044F \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u0431\u0430\u0448\u043D\u0438 \u0432 \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435",
        EFFECT_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u044D\u0444\u0444\u0435\u043A\u0442\u0430",
        EFFECT_TIME_MS: "\u0412\u0440\u0435\u043C\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u0430",
        AFTER_CRIT_CRITICAL_HEALING_CHANCE: "\u0428\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u0441\u043B\u0435 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        CRITICAL_HEALING_CHANCE: "\u0428\u0430\u043D\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u044F",
        DETONATE_CRITICAL_SPLASH_DAMAGE_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u0437\u0440\u044B\u0432\u0430 \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_SPLASH_DAMAGE_RADIUS: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_RADIUS_OF_MAX_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_MIN_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        DETONATE_SPLASH_DAMAGE_IMPACT: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430 \u0432\u0437\u0440\u044B\u0432\u0430 \u043F\u0440\u0438 \u0434\u0435\u0442\u043E\u043D\u0430\u0446\u0438\u0438",
        ISIS_INCREASE_TARGET_TEMPERATURE_PER_TICK: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043D\u0430\u0433\u0440\u0435\u0432\u0430 \u0446\u0435\u043B\u0438 \u0418\u0437\u0438\u0434\u043E\u0439",
        ISIS_DECREASE_TARGET_TEMPERATURE_PER_TICK: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u044F \u0446\u0435\u043B\u0438 \u0418\u0437\u0438\u0434\u043E\u0439",
        MACHINE_GUN_SELF_TEMPERATURE_INCREASE_PER_SECOND: "\u0421\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0433\u0440\u0435\u0432 \u0412\u0443\u043B\u043A\u0430\u043D\u0430 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443",
        MACHINE_GUN_OVERHEAT_DAMAGE_COEFF: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u0443\u0440\u043E\u043D\u0430 \u043F\u0440\u0438 \u043F\u0435\u0440\u0435\u0433\u0440\u0435\u0432\u0435 \u0412\u0443\u043B\u043A\u0430\u043D\u0430",
        MACHINE_GUN_POWER_WHEN_TANK_TEMPERATURE_START_INCREASE: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u0412\u0443\u043B\u043A\u0430\u043D\u0430 \u043F\u0440\u0438 \u043D\u0430\u0447\u0430\u043B\u0435 \u043D\u0430\u0433\u0440\u0435\u0432\u0430",
        SHOTGUN_MAX_DAMAGING_PELLET_COUNT: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0434\u0440\u043E\u0431\u0438\u043D, \u043D\u0430\u043D\u043E\u0441\u044F\u0449\u0438\u0445 \u0443\u0440\u043E\u043D",
        DURATION_IN_TICKS: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u0442\u0430\u043A\u0442\u0430\u0445",
        MOVEMENT_SPEED_SCALE: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F",
        RICOCHET_SPEED_SCALE_MIN: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u043F\u043E\u0441\u043B\u0435 \u0440\u0438\u043A\u043E\u0448\u0435\u0442\u0430",
        RICOCHET_SPEED_SCALE_MAX: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u043F\u043E\u0441\u043B\u0435 \u0440\u0438\u043A\u043E\u0448\u0435\u0442\u0430",
        STOP_SPEED: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",
        MAX_TIME_MS: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F",
        SECONDARY_DAMAGE_FROM: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        SECONDARY_DAMAGE_TO: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0443\u0440\u043E\u043D \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        DRONE_RELOAD: "\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u0434\u0440\u043E\u043D\u0430",
        DRONE_REPAIR_HEALTH: "\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u0434\u0440\u043E\u043D\u0430",
        DRONE_REPAIR_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043B\u0435\u0447\u0435\u043D\u0438\u044F \u0434\u0440\u043E\u043D\u0430",
        DRONE_INVENTORY: "\u0417\u0430\u043F\u0430\u0441 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432 \u0434\u0440\u043E\u043D\u0430",
        DRONE_INVENTORY_ADD: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0438\u043F\u0430\u0441\u044B \u0434\u0440\u043E\u043D\u0430",
        DRONE_BONUS_ADD: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0431\u043E\u043D\u0443\u0441\u044B \u0434\u0440\u043E\u043D\u0430",
        DRONE_FIRST_AID_BONUS_ADD: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0430\u043F\u0442\u0435\u0447\u043A\u0438 \u0434\u0440\u043E\u043D\u0430",
        DRONE_OVERDRIVE_BOOST: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_INVENTORY_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432 \u0434\u0440\u043E\u043D\u0430",
        DRONE_COOLDOWN_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0443\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432",
        DRONE_DEFEND: "\u0417\u0430\u0449\u0438\u0442\u0430 \u0434\u0440\u043E\u043D\u0430",
        DRONE_ARMOR_BOOST: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0431\u0440\u043E\u043D\u0438 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_MINE: "\u041C\u0438\u043D\u044B \u0434\u0440\u043E\u043D\u0430",
        DRONE_ADDITIONAL_MINES: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043C\u0438\u043D\u044B \u0434\u0440\u043E\u043D\u0430",
        DRONE_MINES_ACTIVATION_DELAY: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u043C\u0438\u043D \u0434\u0440\u043E\u043D\u0430",
        DRONE_INVENTORY_COOLDOWN_BOOST: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_INVENTORY_COOLDOWN_SUBTRACTION_ON_KILL: "\u0421\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432 \u0437\u0430 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u0435",
        DRONE_INVENTORY_COOLDOWN_SUBTRACTION: "\u0421\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432",
        DRONE_MINES_PLACEMENT_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043C\u0438\u043D \u0434\u0440\u043E\u043D\u0430",
        DRONE_POWER_BOOST: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0443\u0440\u043E\u043D\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_POWER_DURATION: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F \u0443\u0440\u043E\u043D\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_CRITICAL_HEALTH: "\u041F\u043E\u0440\u043E\u0433 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F \u0434\u0440\u043E\u043D\u0430",
        DRONE_CONSTANT_ARMOR_PERCENT: "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0431\u0440\u043E\u043D\u0438 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_CONSTANT_POWER_PERCENT: "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0443\u0440\u043E\u043D\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_SUPPORT_SCORE_FACTOR: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043E\u0447\u043A\u043E\u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438 \u0434\u0440\u043E\u043D\u0430",
        DRONE_ARMOR_PERCENT: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0431\u0440\u043E\u043D\u0438 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_DAMAGE_PERCENT: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0443\u0440\u043E\u043D\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_HULL_SPEED_PERCENT: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_HULL_ACCELERATION_PERCENT: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0443\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u044F \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_TURRET_ROTATION_SPEED_PERCENT: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 \u0431\u0430\u0448\u043D\u0438 \u0434\u0440\u043E\u043D\u043E\u043C",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN: "\u0421\u0432\u044F\u0437\u0430\u043D\u043D\u0430\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432",
        DRONE_DOUBLE_DAMAGE_COOLDOWN_BOOST_PERCENT: "\u0423\u0441\u043A\u043E\u0440\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0434\u0432\u043E\u0439\u043D\u043E\u0433\u043E \u0443\u0440\u043E\u043D\u0430",
        ULTIMATE_HEAL_HP: "\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u043E\u043C",
        DEVICE_TEMPERATURE_NORMALIZATION: "\u041D\u043E\u0440\u043C\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E\u043C",
        DEVICE_HEAT_PER_PELLET: "\u041D\u0430\u0433\u0440\u0435\u0432 \u0437\u0430 \u0434\u0440\u043E\u0431\u0438\u043D\u0443",
        DEVICE_SMOKY_TEMPERATURE_DELTA_ON_CRITICAL: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043E\u0442 \u043A\u0440\u0438\u0442\u0430 \u0421\u043C\u043E\u043A\u0438",
        ULTIMATE_SCORE_COOLDOWN_SEC: "\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430 \u0437\u0430 \u043E\u0447\u043A\u0438",
        ULTIMATE_ACTIVATION_DISCHARGE_PER_SEC: "\u0420\u0430\u0441\u0445\u043E\u0434 \u0437\u0430\u0440\u044F\u0434\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443",
        ULTIMATE_SPLASH_DAMAGE: "\u0412\u0437\u0440\u044B\u0432\u043D\u043E\u0439 \u0443\u0440\u043E\u043D \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430",
        AIMED_MIN_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0441\u043B\u0430\u0431\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        AIMED_FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432\u0437\u0440\u044B\u0432\u043E\u043C \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u0430",
        TESLA_GLOBE_VERTICAL_AIMING_DISTANCE: "\u0412\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0448\u0430\u0440\u043E\u0432\u043E\u0439 \u043C\u043E\u043B\u043D\u0438\u0438",
        AURA_ALLY_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0430\u0443\u0440\u044B \u0434\u043B\u044F \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432",
        AURA_ENEMY_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0430\u0443\u0440\u044B \u0434\u043B\u044F \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u043E\u0432",
        PALADIN_HEALING_PER_PERIOD: "\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u041F\u0430\u043B\u0430\u0434\u0438\u043D\u0430 \u0437\u0430 \u0442\u0438\u043A",
        MAX_ROCKET_RISING_AFTER_DESCENT: "\u041F\u0440\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u043E\u0434\u044A\u0451\u043C \u0440\u0430\u043A\u0435\u0442\u044B \u043F\u043E\u0441\u043B\u0435 \u0441\u043D\u0438\u0436\u0435\u043D\u0438\u044F",
        EMP_ENABLED: "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043C\u0430\u0433\u043D\u0438\u0442\u043D\u044B\u0439 \u0438\u043C\u043F\u0443\u043B\u044C\u0441",
        MINE_DISPEL_RADIUS: "\u0420\u0430\u0434\u0438\u0443\u0441 \u043E\u0431\u0435\u0437\u0432\u0440\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u044F \u043C\u0438\u043D",
        AUTOFIRE_RECHARGE_INTERVAL_MS: "\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0433\u043D\u044F",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_DAMAGE_TO_ARMOR: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0443\u0440\u043E\u043D\u0430 \u0441 \u0431\u0440\u043E\u043D\u0451\u0439",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_DAMAGE_TO_SPEED: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0443\u0440\u043E\u043D\u0430 \u0441\u043E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C\u044E",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_ARMOR_TO_DAMAGE: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0431\u0440\u043E\u043D\u0438 \u0441 \u0443\u0440\u043E\u043D\u043E\u043C",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_ARMOR_TO_SPEED: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0431\u0440\u043E\u043D\u0438 \u0441\u043E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C\u044E",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_SPEED_TO_ARMOR: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0441 \u0431\u0440\u043E\u043D\u0451\u0439",
        DRONE_DEPENDENT_INVENTORY_COOLDOWN_SPEED_TO_DAMAGE: "\u0421\u0432\u044F\u0437\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0441 \u0443\u0440\u043E\u043D\u043E\u043C"
      };
      higherBetter = /* @__PURE__ */ new Set([
        "HULL_ARMOR",
        "HULL_SPEED",
        "HULL_ACCELERATION",
        "HULL_TURN_SPEED",
        "TURRET_TURN_SPEED",
        "TURRET_ROTATION_ACCELERATION",
        "DAMAGE_FIXED",
        "DAMAGE_FROM",
        "DAMAGE_TO",
        "DAMAGE_PER_HIT",
        "DAMAGE_PER_PERIOD",
        "DAMAGE_PER_SECOND",
        "CRITICAL_HIT_DAMAGE",
        "SHOT_RANGE",
        "WEAPON_MAX_DAMAGE_RADIUS",
        "WEAPON_MIN_DAMAGE_RADIUS",
        "ISIS_HEALING_PER_PERIOD",
        "IMPACT_FORCE",
        "WEAPON_ANGLE_UP",
        "WEAPON_ANGLE_DOWN"
      ]);
      lowerBetter = /* @__PURE__ */ new Set([
        "WEAPON_RELOAD_TIME",
        "WEAPON_CHARGING_TIME",
        "MAGAZINE_RELOAD_TIME",
        "SALVO_RELOAD_TIME",
        "ENERGY_PER_SHOT",
        "DISCHARGE_SPEED",
        "ISIS_DISCHARGE_SPEED_HEALING"
      ]);
      [
        "HULL_SIDE_ACCELERATION",
        "HULL_TURN_ACCELERATION",
        "HULL_REVERSE_TURN_ACCELERATION",
        "HULL_REVERSE_ACCELERATION",
        "MAX_CRITICAL_HIT_CHANCE",
        "START_CRITICAL_HIT_CHANCE",
        "AFTER_CRIT_CRITICAL_HIT_CHANCE",
        "CRITICAL_CHANCE_DELTA",
        "CRITICAL_HIT_CHANCE",
        "CRITICAL_HEALING_HITS",
        "MAX_CRITICAL_HEALING_CHANCE",
        "START_CRITICAL_HEALING_CHANCE",
        "AFTER_CRIT_CRITICAL_HEALING_CHANCE",
        "CRITICAL_HEALING_CHANCE_DELTA",
        "CRITICAL_HEALING_CHANCE",
        "HEAT_PER_PERIOD",
        "FREEZE_PER_TICK",
        "FLAME_TEMPERATURE_LIMIT",
        "WEAPON_CHARGE_RATE",
        "GRENADE_DAMAGE",
        "WEAPON_MIN_DAMAGE_PERCENT",
        "ISIS_VAMPIRING_PERCENT",
        "TESLA_GLOBE_DAMAGE",
        "TESLA_GLOBE_SPEED",
        "TESLA_GLOBE_DISTANCE",
        "TESLA_EACH_TARGET_DAMAGE",
        "TESLA_CASCADE_ENEMY_TANK_RADIUS",
        "TESLA_CASCADE_ALLY_TANK_RADIUS",
        "TESLA_CASCADE_GLOBE_RADIUS",
        "TESLA_GLOBE_VERTICAL_AIMING_DISTANCE",
        "SHAFT_AIMING_MODE_MIN_DAMAGE",
        "SHAFT_AIMING_MODE_MAX_DAMAGE",
        "SHAFT_AIMING_MODE_CHARGE_RATE",
        "SHAFT_VERTICAL_TARGETING_SPEED",
        "SHAFT_HORIZONTAL_TARGETING_SPEED",
        "SHAFT_AIMED_SHOT_IMPACT",
        "SHELL_SPEED",
        "MIN_SHELL_SPEED",
        "MAX_SHELL_SPEED",
        "SHELL_SPEED_AFTER_RICOCHET",
        "MAX_RICOCHET_COUNT",
        "SECONDARY_MIN_SHELL_SPEED",
        "SECONDARY_MAX_SHELL_SPEED",
        "SECONDARY_DAMAGE_FROM",
        "SECONDARY_DAMAGE_TO",
        "SECONDARY_DAMAGE_FIXED",
        "SHOTGUN_MAGAZINE_SIZE",
        "SHOTGUN_PELLET_COUNT",
        "SHOTGUN_MAX_DAMAGING_PELLET_COUNT",
        "SALVO_SIZE",
        "ROCKET_MIN_ANGULAR_SPEED",
        "ROCKET_MAX_ANGULAR_SPEED",
        "SALVO_AIMING_GRACE_PERIOD",
        "HIGHLIGHTING_DISTANCE",
        "ULTIMATE_CHARGE_PER_SEC",
        "ULTIMATE_CHARGE_PER_SCORE_POINT",
        "ULTIMATE_HEAL_HP",
        "ULTIMATE_SPLASH_DAMAGE",
        "PALADIN_HEALING_PER_PERIOD",
        "DEVICE_BONUS_ENERGY_ON_KILL",
        "DEVICE_BONUS_ENERGY_ON_DAMAGE",
        "CASSETTE_COMBO_ADDITIONAL_DAMAGE",
        "MINE_DISPEL_RADIUS",
        "DRONE_REPAIR_HEALTH",
        "DRONE_REPAIR_RADIUS"
      ].forEach((property) => higherBetter.add(property));
      Object.keys(russian).filter((property) => property.endsWith("_RESISTANCE")).forEach((property) => higherBetter.add(property));
      [
        "TIME_BETWEEN_SHOTS_OF_SALVO",
        "SALVO_AIMING_TIME",
        "TESLA_GLOBE_CHARGE_MS",
        "TESLA_GLOBE_PREPARE_MS",
        "ISIS_DISCHARGE_SPEED_IDLE",
        "MACHINE_GUN_SPIN_UP_TIME_SECOND",
        "MACHINE_GUN_SELF_TEMPERATURE_INCREASE_PER_SECOND",
        "SHAFT_FAST_SHOT_ENERGY",
        "SHAFT_MIN_AIMED_SHOT_ENERGY",
        "SHAFT_ROTATION_DECELERATION_COEFF",
        "MACHINE_GUN_WEAPON_TURN_DECELERATION_COEFF",
        "DRONE_RELOAD",
        "ULTIMATE_SCORE_COOLDOWN_SEC",
        "ULTIMATE_ACTIVATION_DISCHARGE_PER_SEC",
        "AUTOFIRE_RECHARGE_INTERVAL_MS"
      ].forEach((property) => lowerBetter.add(property));
      Object.keys(russian).filter((property) => /SPLASH_DAMAGE_RADIUS|RADIUS_OF_MAX_SPLASH_DAMAGE|MIN_SPLASH_DAMAGE_PERCENT|SPLASH_DAMAGE_IMPACT/.test(property)).forEach((property) => higherBetter.add(property));
    }
  });

  // src/core/gameAugments.ts
  function activeGarageCardSection(root) {
    const tabs = Array.from(root.querySelectorAll(gameDOM.navigation.garageTabs));
    if (tabs.length < 2 || tabs.length > 3) return null;
    const active = tabs.findIndex((tab) => tab.classList.contains(gameDOM.classes.activeMenu));
    return ["augments", "skins", "shot-color"][active] || null;
  }
  function isAugmentPreviewUrl(value) {
    if (typeof value !== "string" || value.length > 2e3) return false;
    try {
      const url = new URL(value.startsWith("blob:") ? value.slice(5) : value);
      return url.protocol === "https:" && /(^|\.)tankionline\.com$/.test(url.hostname) && !/\/unavailable\.[^/]+\.svg$/.test(url.pathname);
    } catch {
      return false;
    }
  }
  var AUGMENTS_MESSAGE, AUGMENTS_REQUEST, AUGMENT_CARDS_UPDATED, GARAGE_SKIN_CARDS_REQUEST;
  var init_gameAugments = __esm({
    "src/core/gameAugments.ts"() {
      "use strict";
      init_featureRuntime();
      init_pageMessages();
      init_clientPatches();
      init_gameDOM();
      init_augmentLabels();
      AUGMENTS_MESSAGE = "kasp:game-augments";
      AUGMENTS_REQUEST = "kasp:game-augments-request";
      AUGMENT_CARDS_UPDATED = "kasp:augment-cards-updated";
      GARAGE_SKIN_CARDS_REQUEST = "kasp:garage-skin-cards-request";
    }
  });

  // src/core/augmentRules.ts
  function parseAugmentRules(value) {
    const source = value;
    if (!source || !Array.isArray(source.rules) || source.rules.length > 1e4) return { rules: [], errors: ["Expected a rules array with at most 10000 entries."] };
    const rules = /* @__PURE__ */ new Map();
    const errors = [];
    for (const [index, entry] of source.rules.entries()) {
      const raw = entry;
      const name = raw?.property ?? raw?.properity;
      const property = typeof name === "string" ? resolveAugmentProperty(name) : null;
      if (!raw || typeof raw.objectId !== "string" || !/^\d{1,20}$/.test(raw.objectId) || !property || raw.status !== "better" && raw.status !== "lower") {
        errors.push(`Rule ${index + 1}: invalid objectId, property, or status.`);
        continue;
      }
      const key = `${raw.objectId}:${property}`;
      if (rules.has(key)) errors.push(`Rule ${index + 1}: duplicate ${key}; the last entry wins.`);
      rules.set(key, { objectId: raw.objectId, property, status: raw.status });
    }
    return { rules: [...rules.values()], errors };
  }
  var init_augmentRules = __esm({
    "src/core/augmentRules.ts"() {
      "use strict";
      init_augmentLabels();
    }
  });

  // src/core/augmentCatalog.ts
  function validateAugmentSnapshot(value) {
    if (!value || typeof value !== "object") return null;
    const source = value;
    if (source.format !== "kasp-augments-v1" || typeof source.session !== "string" || source.session.length > 100 || !Number.isSafeInteger(source.revision) || source.revision < 0 || typeof source.hooked !== "boolean" || !Number.isFinite(source.updatedAt) || !Array.isArray(source.devices) || source.devices.length > 2e4) return null;
    const ids = /* @__PURE__ */ new Set();
    for (const entry of source.devices) {
      if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !/^\d{1,20}$/.test(entry.id) || ids.has(entry.id) || !["RU", "EN"].includes(entry.locale) || !Array.isArray(entry.icons) || entry.icons.length > 16 || entry.icons.some((url) => typeof url !== "string" || url.length > 2e3 || !/^https?:\/\//.test(url)) || entry.baseItemId !== void 0 && (typeof entry.baseItemId !== "string" || !/^\d{1,20}$/.test(entry.baseItemId)) || entry.name !== void 0 && (typeof entry.name !== "string" || entry.name.length > 500) || entry.description !== void 0 && (typeof entry.description !== "string" || entry.description.length > 16e3) || entry.previewIcon !== void 0 && !isAugmentPreviewUrl(entry.previewIcon) || entry.rarity !== void 0 && !["COMMON", "RARE", "EPIC", "LEGENDARY"].includes(entry.rarity) || !Array.isArray(entry.properties) || entry.properties.length > 512) return null;
      ids.add(entry.id);
      for (const property of entry.properties) {
        if (!property || !["DELTA_PERCENT", "OVERRIDE_VALUE"].includes(property.operation) || typeof property.property !== "string" || !/^[A-Z][A-Z0-9_]{0,100}$/.test(property.property) || typeof property.value !== "number" || !Number.isFinite(property.value)) return null;
      }
    }
    if (source.equipment !== void 0) {
      if (!Array.isArray(source.equipment) || source.equipment.length > 2e4) return null;
      const equipmentIds = /* @__PURE__ */ new Set();
      for (const item of source.equipment) {
        if (!item || typeof item.id !== "string" || !/^\d{1,20}$/.test(item.id) || equipmentIds.has(item.id) || !Number.isSafeInteger(item.currentLevel) || item.currentLevel < 0 || !item.properties || typeof item.properties !== "object" || Array.isArray(item.properties)) return null;
        const values = Object.entries(item.properties);
        if (values.length > 512 || values.some(([property, value2]) => !/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof value2 !== "number" || !Number.isFinite(value2))) return null;
        equipmentIds.add(item.id);
      }
    }
    return source;
  }
  function normalizeAugmentIcon(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname;
    } catch {
      return url;
    }
  }
  function liveAugmentModifiers(device) {
    const result = {};
    for (const [tag, names] of Object.entries(liveTags)) {
      const properties = device.properties.filter((property) => names.includes(property.property));
      if (!properties.length || properties.some((property) => property.operation !== "DELTA_PERCENT") || new Set(properties.map((property) => property.property)).size !== properties.length) continue;
      if (tag === "DAMAGE" && properties.some((property) => ["DAMAGE_FROM", "DAMAGE_TO"].includes(property.property)) && !["DAMAGE_FROM", "DAMAGE_TO"].every((name) => properties.some((property) => property.property === name))) continue;
      if (tag === "SNIPING_DAMAGE" && properties.length !== 2) continue;
      const delta = properties[0].value;
      if (properties.every((property) => property.value === delta) && delta >= -100) result[tag] = 1 + delta / 100;
    }
    return result;
  }
  function presentGameAugment(device, baseline, rules) {
    const advantages = [];
    const disadvantages = [];
    const neutral = [];
    for (const property of device.properties) {
      const initial = baseline?.[property.property];
      const comparable = typeof initial === "number" && (!/CRITICAL.*CHANCE|CRITICAL_CHANCE_DELTA/.test(property.property) || initial >= 0 && property.value >= 0);
      const delta = property.operation === "DELTA_PERCENT" ? property.value : comparable ? property.value - initial : 0;
      const unchanged = property.operation === "OVERRIDE_VALUE" && comparable && Math.abs(delta) <= 1e-6 * Math.max(1, Math.abs(initial), Math.abs(property.value));
      const manual = rules?.get(`${device.id}:${property.property}`);
      if (!manual && (unchanged || property.operation === "DELTA_PERCENT" && property.value === 0)) continue;
      const benefit = manual ? manual === "better" ? "advantage" : "disadvantage" : augmentPropertyBenefit(property.property, unchanged ? 0 : delta);
      const value = Number(property.value.toPrecision(7));
      const probability = /CRITICAL.*CHANCE|CRITICAL_CHANCE_DELTA/.test(property.property) && comparable && initial <= 1 && property.value <= 1;
      const absolute = (number) => `${Number((probability ? number * 100 : number).toPrecision(7))}${probability ? "%" : ""}`;
      const suffix = property.operation === "DELTA_PERCENT" ? `${value > 0 ? "+" : ""}${value}%` : comparable ? `${absolute(initial)} \u2192 ${absolute(property.value)}` : `= ${value}`;
      const item = {
        RU: `${augmentPropertyLabel(property.property, "RU")}: ${suffix}`,
        EN: `${augmentPropertyLabel(property.property, "EN")}: ${suffix}`
      };
      (benefit === "advantage" ? advantages : benefit === "disadvantage" ? disadvantages : neutral).push(item);
    }
    return { ...device, advantages, disadvantages, neutral, modifiers: liveAugmentModifiers(device) };
  }
  function createAugmentCatalog() {
    let current = null;
    const byId = /* @__PURE__ */ new Map();
    const byIcon = /* @__PURE__ */ new Map();
    const equipment = /* @__PURE__ */ new Map();
    const rules = /* @__PURE__ */ new Map();
    const present = (device) => presentGameAugment(device, device.baseItemId ? equipment.get(device.baseItemId) : void 0, rules);
    return {
      setRules(value) {
        const parsed = parseAugmentRules(value);
        rules.clear();
        parsed.rules.forEach((rule) => rules.set(`${rule.objectId}:${rule.property}`, rule.status));
        return parsed.errors;
      },
      accept(value) {
        const snapshot = validateAugmentSnapshot(value);
        if (!snapshot || current && (snapshot.session !== current.session || snapshot.revision <= current.revision)) return false;
        current = snapshot;
        byId.clear();
        byIcon.clear();
        equipment.clear();
        for (const item of snapshot.equipment || []) equipment.set(item.id, item.properties);
        for (const device of snapshot.devices) {
          byId.set(device.id, device);
          for (const url of device.icons) {
            const key = normalizeAugmentIcon(url);
            const entries = byIcon.get(key) || [];
            if (!entries.some((entry) => entry.id === device.id)) entries.push(device);
            byIcon.set(key, entries);
          }
        }
        return true;
      },
      get(url, id) {
        if (id) {
          const device = byId.get(id);
          if (!device || device.icons.length && !device.icons.some((icon) => normalizeAugmentIcon(icon) === normalizeAugmentIcon(url))) return void 0;
          return present(device);
        }
        const candidates = byIcon.get(normalizeAugmentIcon(url)) || [];
        if (!candidates.length) return void 0;
        const fingerprint = (device) => JSON.stringify([
          device.properties,
          device.name,
          device.description,
          device.locale,
          device.baseItemId ? equipment.get(device.baseItemId) : void 0,
          device.properties.map((property) => rules.get(`${device.id}:${property.property}`))
        ]);
        if (candidates.some((device) => fingerprint(device) !== fingerprint(candidates[0]))) return void 0;
        return present(candidates[0]);
      },
      export: () => JSON.stringify(current || { format: "kasp-augments-v1", devices: [] }, null, 2)
    };
  }
  async function persist(json) {
    try {
      sessionStorage.setItem(AUGMENTS_JSON_KEY, json);
    } catch {
    }
    pendingJson = json;
    if (writing) return;
    writing = true;
    try {
      while (pendingJson !== null) {
        const content = pendingJson;
        pendingJson = null;
        try {
          const root = await navigator.storage.getDirectory();
          const handle = await root.getFileHandle(AUGMENTS_JSON_FILE, { create: true });
          const writer = await handle.createWritable();
          try {
            await writer.write(content);
            await writer.close();
          } catch (error) {
            await writer.abort().catch(() => {
            });
            throw error;
          }
          fileError = null;
        } catch (error) {
          fileError = error instanceof Error ? error.message : String(error);
        }
      }
    } finally {
      writing = false;
    }
  }
  var AUGMENTS_JSON_FILE, AUGMENTS_JSON_KEY, AUGMENTS_UPDATED, liveTags, catalog, pendingJson, writing, fileError, AugmentCatalog;
  var init_augmentCatalog = __esm({
    "src/core/augmentCatalog.ts"() {
      "use strict";
      init_gameAugments();
      init_augmentLabels();
      init_augmentRules();
      init_pageMessages();
      AUGMENTS_JSON_FILE = "kasp-augments.json";
      AUGMENTS_JSON_KEY = "kasp_augments_session_json";
      AUGMENTS_UPDATED = "kasp:augments-updated";
      liveTags = {
        DAMAGE: ["DAMAGE_FIXED", "DAMAGE_FROM", "DAMAGE_TO", "DAMAGE_PER_HIT"],
        DPS: ["DAMAGE_PER_SECOND"],
        RELOAD: ["WEAPON_RELOAD_TIME"],
        CHARGE_RATE: ["WEAPON_CHARGE_RATE"],
        TURNING_SPEED: ["TURRET_TURN_SPEED"],
        RANGE: ["SHOT_RANGE"],
        CRIT_DAMAGE: ["CRITICAL_HIT_DAMAGE"],
        HEALING: ["ISIS_HEALING_PER_PERIOD"],
        IMPACT_FORCE: ["IMPACT_FORCE"],
        SNIPING_DAMAGE: ["SHAFT_AIMING_MODE_MIN_DAMAGE", "SHAFT_AIMING_MODE_MAX_DAMAGE"],
        ARCADE_DAMAGE: ["DAMAGE_FIXED"],
        ARMOR: ["HULL_ARMOR"],
        TURN_SPEED: ["HULL_TURN_SPEED"],
        WEIGHT: ["HULL_MASS"],
        TOP_SPEED: ["HULL_SPEED"]
      };
      catalog = createAugmentCatalog();
      pendingJson = null;
      writing = false;
      fileError = null;
      if (typeof window !== "undefined" && window === window.top) {
        if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
          void (async () => {
            try {
              const response = await fetch(chrome.runtime.getURL("database/augment-rules.json"));
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const errors = catalog.setRules(await response.json());
              if (errors.length) console.warn("[KI] Augment rules:", errors);
              window.dispatchEvent(new CustomEvent(AUGMENTS_UPDATED));
            } catch (error) {
              console.warn("[KI] Augment rules unavailable; automatic classification remains active:", error);
            }
          })();
        }
        void persist(catalog.export());
        window.addEventListener("message", (event) => {
          const message = readPageMessage(event, window, AUGMENTS_MESSAGE);
          if (!message || !catalog.accept(message.detail)) return;
          void persist(catalog.export());
          window.dispatchEvent(new CustomEvent(AUGMENTS_UPDATED));
        });
        postPageMessage(window, { type: AUGMENTS_REQUEST });
      }
      AugmentCatalog = {
        getDevice(url, element) {
          const id = element?.getAttribute("data-kasp-augment-id") || element?.querySelector("[data-kasp-augment-id]")?.getAttribute("data-kasp-augment-id");
          return catalog.get(url, id || void 0);
        },
        export: catalog.export,
        storageStatus: () => ({ file: AUGMENTS_JSON_FILE, fileError })
      };
    }
  });

  // src/core/dataLoader.ts
  var DataLoader;
  var init_dataLoader = __esm({
    "src/core/dataLoader.ts"() {
      "use strict";
      init_augmentCatalog();
      DataLoader = (() => {
        const state2 = {
          paints: null,
          maps: null,
          skins: null,
          ready: false,
          error: null
        };
        const readyPromise = (async () => {
          try {
            const [paintsRes, mapsRes, skinsRes] = await Promise.all([
              fetch(chrome.runtime.getURL("database/paints.json")),
              fetch(chrome.runtime.getURL("database/maps.json")),
              fetch(chrome.runtime.getURL("database/skins.json"))
            ]);
            if (!paintsRes.ok)
              throw new Error("paints.json: HTTP " + paintsRes.status);
            if (!mapsRes.ok)
              throw new Error("maps.json: HTTP " + mapsRes.status);
            if (!skinsRes.ok)
              throw new Error("skins.json: HTTP " + skinsRes.status);
            state2.paints = await paintsRes.json();
            const mapsRaw = await mapsRes.json();
            const byRu = /* @__PURE__ */ new Map();
            const byEn = /* @__PURE__ */ new Map();
            for (const entry of mapsRaw) {
              if (entry.ru) byRu.set(entry.ru.toLowerCase(), entry);
              if (entry.en) byEn.set(entry.en.toLowerCase(), entry);
            }
            state2.maps = { list: mapsRaw, byRu, byEn };
            state2.skins = await skinsRes.json();
            state2.ready = true;
            console.log(
              `[KI] DB loaded: paints=${Object.keys(state2.paints).length}, maps=${mapsRaw.length}, skins=${Object.keys(state2.skins?.names ?? {}).length}`
            );
          } catch (e) {
            state2.error = e;
            console.error("[KI] DB load failed:", e);
          }
        })();
        return {
          readyPromise,
          isReady: () => state2.ready,
          getPaint: (url) => state2.paints ? state2.paints[url] : void 0,
          getDevice: (url, element) => AugmentCatalog.getDevice(url, element),
          hasDevice: (url, element) => !!AugmentCatalog.getDevice(url, element),
          translateMap: (rawName, targetLang) => {
            if (!state2.maps || !rawName) return rawName;
            const key = String(rawName).trim().toLowerCase();
            const entry = state2.maps.byRu.get(key) || state2.maps.byEn.get(key);
            if (!entry) return rawName;
            return targetLang === "RU" ? entry.ru : entry.en;
          },
          getMapInfo: (rawName) => {
            if (!state2.maps || !rawName) return null;
            const key = String(rawName).trim().toLowerCase();
            return state2.maps.byRu.get(key) || state2.maps.byEn.get(key) || null;
          },
          getSkinsData: () => state2.skins
        };
      })();
    }
  });

  // src/modules/customPaints.ts
  var lifecycle2, customPaints;
  var init_customPaints = __esm({
    "src/modules/customPaints.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      init_dataLoader();
      lifecycle2 = featureScope("customPaints");
      customPaints = lifecycle2.initialize(() => {
        const displays = /* @__PURE__ */ new Map();
        const display = (element, value) => {
          const previous = displays.get(element);
          const before = previous && element.style.display === previous.after ? previous.before : element.style.display;
          displays.set(element, { before, after: value });
          element.style.display = value;
        };
        function normalizeText(text2) {
          if (!text2) return "";
          return text2.toLowerCase().replace(/ё/g, "\u0435");
        }
        function applySearch() {
          if (!DataLoader.isReady()) return;
          const input = document.querySelector(".kasp-search-wrapper input");
          if (!input) return;
          const rawQuery = input.value.trim();
          const queryWords = normalizeText(rawQuery).split(/\s+/).filter((word) => word.length > 0);
          const items = document.querySelectorAll(`.kasp-paints-container ${gameDOM.garage.item}`);
          items.forEach((itemEl) => {
            const item = itemEl;
            if (queryWords.length === 0) {
              display(item, "");
              return;
            }
            const imgElement = item.querySelector(gameDOM.garage.itemImage);
            if (!imgElement) return;
            const src = imgElement.getAttribute("src");
            if (!src) return;
            const paintInfo = DataLoader.getPaint(src);
            let isMatch = false;
            if (paintInfo) {
              const combinedNames = normalizeText(paintInfo.ru + " " + paintInfo.en);
              isMatch = queryWords.every((word) => combinedNames.includes(word));
            }
            display(item, isMatch ? "" : "none");
          });
          const columns = document.querySelectorAll(".kasp-paints-container > div");
          columns.forEach((colEl) => {
            const col = colEl;
            const visibleItems = Array.from(col.querySelectorAll(gameDOM.garage.item)).filter((i) => i.style.display !== "none");
            display(col, visibleItems.length === 0 ? "none" : "");
          });
        }
        function addSearchInput() {
          const captionContainer = document.querySelector(gameDOM.paints.caption);
          if (!captionContainer) return;
          const parentBlock = captionContainer.closest(gameDOM.paints.categoryInfo);
          if (!parentBlock || parentBlock.querySelector(".kasp-search-wrapper")) return;
          const itemsContainer = document.querySelector(gameDOM.paints.items);
          if (itemsContainer) {
            itemsContainer.classList.add("kasp-paints-container");
          }
          const searchWrapper = document.createElement("div");
          searchWrapper.className = "kasp-search-wrapper";
          const searchContainer = document.createElement("div");
          searchContainer.className = "kasp-SearchInputComponentStyle-search";
          const searchInputDiv = document.createElement("div");
          searchInputDiv.className = "kasp-SearchInputComponentStyle-searchInput";
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = state.lang === "RU" ? "\u041D\u0430\u0439\u0442\u0438" : "Search";
          input.className = gameDOM.classes.normal;
          lifecycle2.listen(input, "input", applySearch);
          const searchIcon = document.createElement("div");
          searchIcon.className = "kasp-search-icon";
          searchInputDiv.appendChild(input);
          searchInputDiv.appendChild(searchIcon);
          searchContainer.appendChild(searchInputDiv);
          searchWrapper.appendChild(searchContainer);
          parentBlock.appendChild(searchWrapper);
        }
        lifecycle2.onCleanup(() => {
          document.querySelectorAll(".kasp-search-wrapper").forEach((node) => node.remove());
          for (const [element, value] of displays) if (element.style.display === value.after) element.style.display = value.before;
          displays.clear();
          document.querySelectorAll(".kasp-paints-container").forEach((node) => node.classList.remove("kasp-paints-container"));
        });
        return () => {
          if (!utils.getSetting("k_paints", false)) return;
          if (state.currentScreen !== "garage") return;
          addSearchInput();
          const input = document.querySelector(".kasp-search-wrapper input");
          if (input && input.value.trim() !== "") {
            applySearch();
          }
        };
      }, () => {
      });
    }
  });

  // src/modules/augmentSpecs.ts
  var lifecycle3, augmentSpecs;
  var init_augmentSpecs = __esm({
    "src/modules/augmentSpecs.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      init_dataLoader();
      init_augmentCatalog();
      init_gameAugments();
      lifecycle3 = featureScope("augmentSpecs");
      augmentSpecs = lifecycle3.initialize(() => {
        let initialized2 = false;
        let updateQueued = false;
        const previewImages = /* @__PURE__ */ new Map();
        const failedPreviews = /* @__PURE__ */ new Set();
        const emptyCards = /* @__PURE__ */ new Map();
        const restoreEmptyCard = (image) => {
          const entry = emptyCards.get(image);
          if (!entry) return;
          entry.nodes.forEach((node) => node.remove());
          entry.card.classList.remove("kasp-unavailable-device-card");
          entry.card.classList.remove("kasp-unavailable-cosmetic-card");
          emptyCards.delete(image);
        };
        const decorateEmptyCard = (image, data, cosmetic = false) => {
          const card = image.parentElement;
          if (!card || !data.name) {
            restoreEmptyCard(image);
            return;
          }
          let entry = emptyCards.get(image);
          if (entry && (entry.card !== card || entry.cosmetic !== cosmetic || entry.nodes.some((node) => node.parentElement !== card))) {
            restoreEmptyCard(image);
            entry = void 0;
          }
          if (!entry) {
            const nodes = (cosmetic ? ["name"] : ["gradient", "rarity", "name"]).map((part) => {
              const node = document.createElement(part === "name" ? "p" : "div");
              node.className = `kasp-unavailable-${cosmetic ? "cosmetic" : "device"}-${part}`;
              card.appendChild(node);
              return node;
            });
            entry = { card, nodes, badge: cosmetic ? void 0 : nodes[1], title: nodes[nodes.length - 1], cosmetic };
            emptyCards.set(image, entry);
          }
          const cardClass = `kasp-unavailable-${cosmetic ? "cosmetic" : "device"}-card`;
          if (!card.classList.contains(cardClass)) card.classList.add(cardClass);
          if (entry.title.textContent !== data.name) entry.title.textContent = data.name;
          const background = 'url("https://s.eu.tankionline.com/static/images/legendary_icon.4e33cd2f.svg")';
          if (entry.badge && entry.badge.style.backgroundImage !== background) entry.badge.style.backgroundImage = background;
        };
        const restorePreview = (image) => {
          const entry = previewImages.get(image);
          if (entry && image.src === entry.replacement) image.src = entry.original;
          image.classList.remove("kasp-unavailable-device-preview");
          previewImages.delete(image);
        };
        const t = {
          RU: {
            specsTitle: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438",
            adv: "\u041F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0430",
            disadv: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043A\u0438",
            empty: "\u041D\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439",
            neutral: "\u0414\u0440\u0443\u0433\u0438\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B",
            locale: "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0438\u0433\u0440\u0443, \u0447\u0442\u043E\u0431\u044B \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u044F\u0437\u044B\u043A \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F."
          },
          EN: {
            specsTitle: "Specs",
            adv: "Advantages",
            disadv: "Disadvantages",
            empty: "No confirmed changes",
            neutral: "Other parameters",
            locale: "Reload the game to update the description language."
          }
        };
        const STAT_DICT = {
          DAMAGE: { RU: "\u0423\u0440\u043E\u043D", EN: "Damage" },
          DPS: { RU: "\u0423\u0440\u043E\u043D \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443", EN: "Damage per second" },
          CHARGE_RATE: { RU: "\u0417\u0430\u0440\u044F\u0434\u043A\u0430", EN: "Charge rate" },
          RELOAD: { RU: ["\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430", "\u0417\u0430\u0440\u044F\u0434\u043A\u0430"], EN: ["Reload", "Cooldown time"] },
          TURNING_SPEED: { RU: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430", EN: "Turning speed" },
          RANGE: { RU: "\u0414\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C", EN: "Shot range" },
          CRIT_DAMAGE: { RU: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0440\u043E\u043D", EN: "Critical hit damage" },
          HEALING: { RU: "\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443", EN: "Healing per second" },
          IMPACT_FORCE: { RU: "\u0421\u0438\u043B\u0430 \u0443\u0434\u0430\u0440\u0430", EN: "Impact force" },
          SNIPING_DAMAGE: { RU: "\u0423\u0440\u043E\u043D \u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u044B\u0439", EN: ["Aiming mode damage", "Damage in sniping mode"] },
          ARCADE_DAMAGE: { RU: "\u0423\u0440\u043E\u043D \u043D\u0430\u0432\u0441\u043A\u0438\u0434\u043A\u0443", EN: "Normal shot damage" },
          ARMOR: { RU: "\u0411\u0440\u043E\u043D\u044F", EN: "Armor" },
          TURN_SPEED: { RU: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430", EN: "Turn speed" },
          WEIGHT: { RU: "\u041C\u0430\u0441\u0441\u0430", EN: "Mass" },
          TOP_SPEED: { RU: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C", EN: "Max speed" },
          POWER: { RU: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C", EN: "Power" }
        };
        const textEscapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => textEscapes[character]);
        const renderList = (items, lang) => {
          if (!items || items.length === 0) return `<li>${t[lang].empty}</li>`;
          return items.map((item) => {
            let html = `<li>${escapeText(item[lang] || item["EN"])}`;
            if (item.subItems && item.subItems.length > 0) {
              html += `<ul>${item.subItems.map((sub) => `<li>${escapeText(sub[lang] || sub["EN"])}</li>`).join("")}</ul>`;
            }
            html += `</li>`;
            return html;
          }).join("");
        };
        const injectButtons = () => {
          if (!utils.getSetting("k_augments", false)) return;
          let hoverTooltip = document.getElementById("kasp-specs-tooltip");
          if (!hoverTooltip) {
            hoverTooltip = document.createElement("div");
            hoverTooltip.id = "kasp-specs-tooltip";
            document.body.appendChild(hoverTooltip);
          }
          const updateTooltipPos = (e) => {
            if (!hoverTooltip) return;
            const offset = 15;
            const margin = 10;
            let x = e.clientX + offset;
            let y = e.clientY + offset;
            const rect = hoverTooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth - margin) {
              x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight - margin) {
              const above = e.clientY - rect.height - offset;
              if (above >= margin) y = above;
            }
            hoverTooltip.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))}px`;
            hoverTooltip.style.top = `${y}px`;
          };
          const applyButtonToCard = (card, url) => {
            if (!card) return;
            const existingBtn = card.querySelector(".custom-card-specs-btn");
            const device = DataLoader.getDevice(url, card);
            if (!device) {
              if (!existingBtn) return;
              existingBtn.remove();
              hoverTooltip.style.display = "none";
              return;
            }
            if (existingBtn) {
              if (existingBtn.dataset.url !== url || existingBtn.dataset.deviceId !== device.id) {
                existingBtn.dataset.url = url;
                existingBtn.dataset.deviceId = device.id;
                hoverTooltip.style.display = "none";
              }
              return;
            }
            if (!existingBtn) {
              if (window.getComputedStyle(card).position === "static") {
                card.style.position = "relative";
              }
              const btn = document.createElement("div");
              btn.className = "custom-card-specs-btn";
              btn.dataset.url = url;
              btn.dataset.deviceId = device.id;
              btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;
              lifecycle3.listen(btn, "click", (e) => {
                e.stopPropagation();
                e.preventDefault();
              });
              lifecycle3.listen(btn, "mouseenter", (e) => {
                const deviceUrl = btn.dataset.url;
                const deviceData = deviceUrl ? DataLoader.getDevice(deviceUrl, card) : void 0;
                if (!deviceData) {
                  hoverTooltip.style.display = "none";
                  return;
                }
                const lang = state.lang;
                const advList = renderList(deviceData.advantages, lang);
                const disadvList = renderList(deviceData.disadvantages, lang);
                const description = deviceData.locale === lang ? deviceData.description?.split("\n\n")[0] || "" : t[lang].locale;
                const neutral = deviceData.neutral.length ? `<div class="device-stats neutral"><div class="heading">${t[lang].neutral}</div><ul>${renderList(deviceData.neutral, lang)}</ul></div>` : "";
                hoverTooltip.innerHTML = `
                                <div style="padding: 0 1.5rem 1rem;">${escapeText(description)}</div>
                                <div class="device-stats-wrapper">
                                    <div class="device-stats">
                                        <div class="heading">${t[lang].adv}</div>
                                        <ul>${advList}</ul>
                                    </div>
                                    <div class="device-stats negative">
                                        <div class="heading">${t[lang].disadv}</div>
                                        <ul>${disadvList}</ul>
                                    </div>
                                </div>
                                ${neutral}
                            `;
                hoverTooltip.style.display = "block";
                updateTooltipPos(e);
              });
              lifecycle3.listen(btn, "mousemove", updateTooltipPos);
              lifecycle3.listen(btn, "mouseleave", () => {
                hoverTooltip.style.display = "none";
              });
              card.appendChild(btn);
            }
          };
          const cardsImgs = document.querySelectorAll(gameDOM.augments.cardImage);
          const section = activeGarageCardSection(document);
          cardsImgs.forEach((img) => {
            let preview = previewImages.get(img);
            const cosmeticSection = section === "skins" || section === "shot-color";
            const augmentId = cosmeticSection ? null : img.getAttribute("data-kasp-augment-id");
            const cosmeticId = cosmeticSection && img.getAttribute("data-kasp-cosmetic-section") === section ? img.getAttribute("data-kasp-cosmetic-id") : null;
            const id = augmentId || cosmeticId;
            if (preview && (img.src !== preview.replacement || preview.id !== id || preview.section !== section)) {
              restorePreview(img);
              preview = void 0;
            }
            const original = preview?.original || img.src;
            const cosmeticPreview = cosmeticId ? img.getAttribute("data-kasp-cosmetic-preview") : null;
            const data = cosmeticId && /^\d{1,20}$/.test(cosmeticId) && isAugmentPreviewUrl(cosmeticPreview) ? { name: img.getAttribute("data-kasp-cosmetic-name")?.slice(0, 500), previewIcon: cosmeticPreview } : cosmeticSection ? void 0 : DataLoader.getDevice(original, img);
            const unavailable = id && /\/unavailable\.[^/]+\.svg(?:[?#].*)?$/.test(original);
            if (unavailable && data) decorateEmptyCard(img, data, section === "skins");
            else restoreEmptyCard(img);
            if (unavailable && data?.previewIcon && !failedPreviews.has(data.previewIcon)) {
              if (preview?.replacement !== data.previewIcon) {
                const replacement = data.previewIcon;
                previewImages.set(img, { original, replacement, id, section });
                lifecycle3.listen(img, "error", () => {
                  if (previewImages.get(img)?.replacement !== replacement || img.src !== replacement) return;
                  failedPreviews.add(replacement);
                  restorePreview(img);
                  img.setAttribute("data-kasp-preview-failed", "");
                }, { once: true });
                img.classList.add("kasp-unavailable-device-preview");
                img.removeAttribute("data-kasp-preview-failed");
                img.src = replacement;
              }
            } else if (preview) restorePreview(img);
            if (cosmeticSection) img.parentElement?.querySelector(".custom-card-specs-btn")?.remove();
            else applyButtonToCard(img.parentElement, original);
          });
          for (const img of previewImages.keys()) if (!img.isConnected) previewImages.delete(img);
          for (const img of emptyCards.keys()) if (!img.isConnected) restoreEmptyCard(img);
        };
        const liveStats = /* @__PURE__ */ new Map();
        function updateLiveStats() {
          if (!utils.getSetting("k_augments", false)) return;
          const activeValues = /* @__PURE__ */ new Set();
          const deviceImg = document.querySelector(gameDOM.garage.deviceIcon);
          const deviceData = deviceImg ? DataLoader.getDevice(deviceImg.src, deviceImg) : void 0;
          const modifiers = deviceData?.modifiers;
          const allSpans = modifiers ? Array.from(document.querySelectorAll("span")).filter((s) => !s.closest(".custom-live-stat")) : [];
          allSpans.forEach((nameSpan) => {
            if (!modifiers) return;
            const text2 = nameSpan.textContent?.trim().toLowerCase() || "";
            let matchedTag = null;
            for (const [tag, translations] of Object.entries(STAT_DICT)) {
              const allVariants = [translations.RU, translations.EN].flat().filter(Boolean).map((s) => s.toLowerCase());
              if (tag in modifiers && allVariants.includes(text2)) {
                matchedTag = tag;
                break;
              }
            }
            if (matchedTag && matchedTag in modifiers) {
              const multiplier = modifiers[matchedTag];
              const valueSpan = nameSpan.parentElement?.nextElementSibling;
              if (valueSpan && valueSpan.tagName === "SPAN" && !valueSpan.classList.contains("custom-live-stat")) {
                const original = valueSpan;
                const cleanStr = (original.textContent || "").replace(/\s/g, "").replace(",", ".");
                const origNumber = parseFloat(cleanStr);
                if (!isNaN(origNumber)) {
                  const newVal = origNumber * multiplier;
                  const numberValue = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                  const formattedVal = numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                  let isBuff = multiplier > 1;
                  if (["RELOAD"].includes(matchedTag)) isBuff = multiplier < 1;
                  const color = matchedTag === "WEIGHT" || multiplier === 1 ? "#ffffff" : isBuff ? "#00ff38" : "#fe6666";
                  activeValues.add(original);
                  let entry = liveStats.get(original);
                  if (!entry) {
                    const replacement = document.createElement("span");
                    const value = document.createElement("span");
                    replacement.appendChild(value);
                    entry = { replacement, value, originalDisplay: original.style.display };
                    liveStats.set(original, entry);
                  }
                  const className = original.className.split(/\s+/).filter((name) => name && name !== "hidden-by-script").concat("custom-live-stat").join(" ");
                  if (entry.replacement.className !== className) entry.replacement.className = className;
                  const textValue = String(formattedVal);
                  if (entry.value.textContent !== textValue) entry.value.textContent = textValue;
                  const valueStyle = `color: ${color}; text-shadow: 0 0 5px ${color}40;`;
                  if (entry.value.getAttribute("style") !== valueStyle) entry.value.setAttribute("style", valueStyle);
                  if (!original.classList.contains("hidden-by-script")) original.classList.add("hidden-by-script");
                  if (original.style.display !== "none") original.style.display = "none";
                  if (original.nextSibling !== entry.replacement) {
                    original.parentNode?.insertBefore(entry.replacement, original.nextSibling);
                  }
                }
              }
            }
          });
          for (const [original, entry] of liveStats) {
            if (activeValues.has(original)) continue;
            entry.replacement.remove();
            original.classList.remove("hidden-by-script");
            original.style.display = entry.originalDisplay;
            liveStats.delete(original);
          }
        }
        const scheduleUpdate = () => {
          if (updateQueued) return;
          updateQueued = true;
          lifecycle3.microtask(() => {
            updateQueued = false;
            if (!utils.getSetting("k_augments", false)) return;
            const isGarage = state.currentScreen === "garage";
            const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
            if (!isGarage || isContainers) return;
            injectButtons();
            updateLiveStats();
          });
        };
        lifecycle3.onCleanup(() => {
          for (const img of previewImages.keys()) restorePreview(img);
          for (const img of emptyCards.keys()) restoreEmptyCard(img);
          for (const [original, entry] of liveStats) {
            entry.replacement.remove();
            original.classList.remove("hidden-by-script");
            original.style.display = entry.originalDisplay;
          }
          liveStats.clear();
          document.querySelectorAll(".custom-card-specs-btn").forEach((node) => node.remove());
          document.getElementById("kasp-specs-tooltip")?.remove();
        });
        return function sync() {
          if (!utils.getSetting("k_augments", false)) {
            for (const img of previewImages.keys()) restorePreview(img);
            for (const img of emptyCards.keys()) restoreEmptyCard(img);
            for (const [original, entry] of liveStats) {
              entry.replacement.remove();
              original.classList.remove("hidden-by-script");
              original.style.display = entry.originalDisplay;
            }
            liveStats.clear();
            document.querySelectorAll(".custom-card-specs-btn").forEach((button) => button.remove());
            const tooltip = document.getElementById("kasp-specs-tooltip");
            if (tooltip) tooltip.style.display = "none";
            return;
          }
          if (!initialized2) {
            initialized2 = true;
            lifecycle3.listen(window, "kasp:settings-changed", sync);
            lifecycle3.listen(window, "storage", sync);
            lifecycle3.listen(window, AUGMENTS_UPDATED, scheduleUpdate);
            lifecycle3.listen(window, AUGMENT_CARDS_UPDATED, scheduleUpdate);
            const forceHideTooltip = () => {
              const hoverTooltip = document.getElementById("kasp-specs-tooltip");
              if (hoverTooltip) hoverTooltip.style.display = "none";
            };
            lifecycle3.listen(window, "keydown", (e) => {
              if (e.code === "Escape" || e.key === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
                forceHideTooltip();
              }
            }, true);
            lifecycle3.listen(window, "mousedown", (e) => {
              if (e.button === 3) {
                forceHideTooltip();
              }
            }, true);
          }
          const isGarage = state.currentScreen === "garage";
          const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
          const loadingScreen = document.querySelector(gameDOM.screens.loadingBackground);
          if (loadingScreen || !isGarage || isContainers) {
            const hoverTooltip = document.getElementById("kasp-specs-tooltip");
            if (hoverTooltip) hoverTooltip.style.display = "none";
          }
          if (isGarage && !isContainers) {
            scheduleUpdate();
          }
        };
      }, () => {
      });
    }
  });

  // src/modules/customPlayButton.ts
  var lifecycle4, customPlayButton;
  var init_customPlayButton = __esm({
    "src/modules/customPlayButton.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      lifecycle4 = featureScope("customPlayButton");
      customPlayButton = lifecycle4.initialize(() => {
        let initialized2 = false;
        let buttonsCreated = false;
        let autoQueueState = 0;
        let targetMode = null;
        let lastSearchingState = null;
        let failSafeTimer = null;
        const BUTTON_WIDTH = 3.5;
        const ROW_GAP = 0.5;
        const BUTTONS_COUNT = 7;
        const MAIN_WIDTH = BUTTON_WIDTH * BUTTONS_COUNT + ROW_GAP * (BUTTONS_COUNT - 1);
        const WIDE_BUTTON_WIDTH = (MAIN_WIDTH - ROW_GAP) / 2;
        const MAIN_HEIGHT = 8.5;
        const BUTTON_HEIGHT = 3;
        const TOTAL_BG_HEIGHT = MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP + BUTTON_HEIGHT;
        const BG_URL = chrome.runtime.getURL("assets/playButton.png");
        const LOCK_ICON_URL = "https://s.eu.tankionline.com/static/images/lockButtonPlay.4bb62c08.svg";
        const quickBattleMode = { names: ["\u0411\u042B\u0421\u0422\u0420\u042B\u0419 \u0411\u041E\u0419", "QUICK BATTLE", "\u0418\u0413\u0420\u0410\u0422\u042C", "PLAY"], isDirect: true };
        const wideModes = [
          { labels: { RU: "PRO-\u0411\u0418\u0422\u0412\u042B", EN: "PRO BATTLES" }, names: ["PRO-\u0411\u0418\u0422\u0412\u042B", "PRO BATTLES"], icon: "https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg", isDirect: true },
          { labels: { RU: "\u0421\u041F\u0415\u0426\u0420\u0415\u0416\u0418\u041C", EN: "FESTIVE MODE" }, names: ["\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", "Festive mode"], icon: "https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg", isDirect: true }
        ];
        const modes2 = [
          { icon: "https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg", labels: { RU: "\u041A\u041E\u041C\u0410\u041D\u0414\u041D\u042B\u0419 \u0411\u041E\u0419", EN: "TEAM DEATHMATCH" }, names: ["\u041A\u041E\u041C\u0410\u041D\u0414\u041D\u042B\u0419 \u0411\u041E\u0419", "TEAM DEATHMATCH"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg", labels: { RU: "\u041A\u041E\u041D\u0422\u0420\u041E\u041B\u042C \u0422\u041E\u0427\u0415\u041A", EN: "CONTROL POINTS" }, names: ["\u041A\u041E\u041D\u0422\u0420\u041E\u041B\u042C \u0422\u041E\u0427\u0415\u041A", "CONTROL POINTS"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg", labels: { RU: "\u0417\u0410\u0425\u0412\u0410\u0422 \u0424\u041B\u0410\u0413\u0410", EN: "CAPTURE THE FLAG" }, names: ["\u0417\u0410\u0425\u0412\u0410\u0422 \u0424\u041B\u0410\u0413\u0410", "CAPTURE THE FLAG"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg", labels: { RU: "\u041E\u0421\u0410\u0414\u0410", EN: "SIEGE" }, names: ["\u041E\u0441\u0430\u0434\u0430", "SIEGE"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg", labels: { RU: "\u0414\u0416\u0410\u0413\u0413\u0415\u0420\u041D\u0410\u0423\u0422", EN: "JUGGERNAUT" }, names: ["\u0414\u0416\u0410\u0413\u0413\u0415\u0420\u041D\u0410\u0423\u0422", "JUGGERNAUT"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg", labels: { RU: "\u0420\u0415\u0413\u0411\u0418", EN: "RUGBY" }, names: ["\u0420\u0415\u0413\u0411\u0418", "RUGBY"], isDirect: false },
          { icon: "https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg", labels: { RU: "\u0428\u0422\u0423\u0420\u041C", EN: "ASSAULT" }, names: ["\u0428\u0422\u0423\u0420\u041C", "ASSAULT"], isDirect: false }
        ];
        const modesButtonNames = ["\u0420\u0415\u0416\u0418\u041C\u042B", "MODES"];
        function isSearching() {
          return !!document.querySelector(gameDOM.play.disabled);
        }
        function simulateClick(el) {
          if (!el) return false;
          el.click();
          el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          return true;
        }
        function matchText(text2, names) {
          const upper = text2.trim().toUpperCase();
          return names.some((n) => upper === n.toUpperCase());
        }
        function clickSpecificCard(modeNames) {
          const allCards = document.querySelectorAll(gameDOM.play.cards);
          for (const card of Array.from(allCards)) {
            const h2 = card.querySelector("h2");
            if (h2 && matchText(h2.textContent || "", modeNames)) return simulateClick(card);
          }
          return false;
        }
        function processAutoQueue() {
          if (autoQueueState === 0 || !targetMode) return;
          if (autoQueueState === 1) {
            if (targetMode.isDirect) {
              if (clickSpecificCard(targetMode.names)) {
                autoQueueState = 0;
                targetMode = null;
                document.body.classList.remove("kasp-autoqueue-active");
              }
            } else {
              if (clickSpecificCard(modesButtonNames)) autoQueueState = 2;
            }
          } else if (autoQueueState === 2) {
            if (clickSpecificCard(targetMode.names)) {
              autoQueueState = 0;
              targetMode = null;
              document.body.classList.remove("kasp-autoqueue-active");
            }
          }
        }
        function startAutoQueue(modeData) {
          if (isSearching()) return;
          targetMode = modeData;
          const playButton = document.querySelector(gameDOM.play.container);
          if (playButton && !playButton.classList.contains(gameDOM.classes.disabledPlay)) {
            autoQueueState = 1;
            document.body.classList.add("kasp-autoqueue-active");
            if (failSafeTimer) lifecycle4.cancelTimeout(failSafeTimer);
            failSafeTimer = lifecycle4.timeout(() => {
              autoQueueState = 0;
              document.body.classList.remove("kasp-autoqueue-active");
            }, 1500);
            simulateClick(playButton);
          }
        }
        function handleModeHotkey(e) {
          if (e.repeat) return;
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          const ae = document.activeElement;
          if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable)) return;
          if (state.currentScreen !== "lobby" && state.currentScreen !== "loading") return;
          if (!utils.getSetting("k_ext_btn", false)) return;
          if (isSearching()) return;
          if (autoQueueState !== 0) return;
          if (document.querySelector(gameDOM.dialogs.container)) return;
          let handled = false;
          if (e.code === "Space") {
            startAutoQueue(quickBattleMode);
            handled = true;
          } else if (e.code === "ShiftLeft") {
            startAutoQueue(wideModes[1]);
            handled = true;
          } else if (e.code === "ShiftRight") {
            startAutoQueue(wideModes[0]);
            handled = true;
          } else {
            const m = e.code.match(/^Digit([1-7])$/) || e.code.match(/^Numpad([1-7])$/);
            if (m) {
              const idx = parseInt(m[1], 10) - 1;
              const mode = modes2[idx];
              if (mode) {
                startAutoQueue(mode);
                handled = true;
              }
            }
          }
          if (handled) {
            e.preventDefault();
          }
        }
        function syncButtonStates(force = false) {
          const searching = isSearching();
          if (!force && searching === lastSearchingState) return;
          lastSearchingState = searching;
          const currentLang = state.lang;
          const playButton = document.querySelector(gameDOM.play.container);
          if (playButton) {
            const bgLayer = playButton.querySelector(".custom-main-bg-layer");
            const innerBtn = playButton.querySelector(gameDOM.play.button) || playButton;
            let customText = innerBtn.querySelector(".custom-main-text");
            let lockDiv = innerBtn.querySelector(".main-lock-icon");
            if (searching) {
              playButton.style.boxShadow = "rgba(255, 255, 255, 0.25) 0em 0em 0em 1px";
              playButton.style.cursor = "default";
              if (bgLayer) bgLayer.style.filter = "brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)";
              if (customText) customText.style.display = "none";
              if (!lockDiv) {
                lockDiv = document.createElement("div");
                lockDiv.className = "main-lock-icon";
                lockDiv.style.cssText = `width: 2.625em; height: 2.8125em; background-color: #a7a7a7; -webkit-mask-image: url(${LOCK_ICON_URL}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${LOCK_ICON_URL}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; z-index: 2; position: relative;`;
                innerBtn.appendChild(lockDiv);
              } else {
                lockDiv.style.display = "block";
                lockDiv.style.backgroundColor = "#868686";
              }
            } else {
              playButton.style.boxShadow = "rgba(254, 255, 254, 0.25) 0 0 0 0.0625em";
              playButton.style.cursor = "pointer";
              if (bgLayer) bgLayer.style.filter = "none";
              if (lockDiv) lockDiv.style.display = "none";
              if (customText) {
                customText.style.display = "flex";
                const targetText = currentLang === "RU" ? "\u0411\u042B\u0421\u0422\u0420\u042B\u0419 \u0411\u041E\u0419" : "QUICK BATTLE";
                if (customText.textContent !== targetText) customText.textContent = targetText;
              }
            }
          }
          document.querySelectorAll(".wide-mode-btn-text").forEach((spanEl) => {
            const span = spanEl;
            const modeIndex = parseInt(span.dataset.index || "0", 10);
            if (wideModes[modeIndex]) span.textContent = wideModes[modeIndex].labels[currentLang];
          });
          const quickWrapper = document.getElementById("quick-play-wrapper");
          if (quickWrapper) {
            quickWrapper.querySelectorAll(".custom-mode-button").forEach((btnEl) => {
              const btn = btnEl;
              const bgLayer = btn.querySelector(".custom-btn-bg-layer");
              const iconDiv = btn.querySelector(".mode-icon-el");
              const textSpan = btn.querySelector(".wide-mode-btn-text");
              if (searching) {
                btn.style.pointerEvents = "none";
                btn.style.cursor = "default";
                btn.style.boxShadow = "rgba(255, 255, 255, 0.25) 0em 0em 0em 1px";
                if (bgLayer) bgLayer.style.filter = "brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)";
                if (iconDiv) iconDiv.style.backgroundColor = "#a7a7a7";
                if (textSpan) textSpan.style.color = "#a7a7a7";
              } else {
                btn.style.pointerEvents = "auto";
                btn.style.cursor = "pointer";
                btn.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
                if (bgLayer) bgLayer.style.filter = "none";
                if (iconDiv) iconDiv.style.backgroundColor = "#ffffff";
                if (textSpan) textSpan.style.color = "#ffffff";
              }
            });
          }
        }
        function createQuickButtons(playButton) {
          if (!playButton || buttonsCreated) return;
          buttonsCreated = true;
          const currentLang = state.lang;
          const quickWrapper = document.createElement("div");
          quickWrapper.id = "quick-play-wrapper";
          quickWrapper.style.cssText = `width: ${MAIN_WIDTH}em; display: flex; flex-direction: column; gap: ${ROW_GAP}em; margin-top: ${ROW_GAP}em; position: relative; z-index: 10; box-sizing: border-box; flex-shrink: 0;`;
          const row2 = document.createElement("div");
          row2.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
          const yOffsetRow2 = -(MAIN_HEIGHT + ROW_GAP);
          wideModes.forEach((mode, index) => {
            const el = document.createElement("div");
            el.className = "custom-mode-button";
            const xOffset = -index * (WIDE_BUTTON_WIDTH + ROW_GAP);
            el.style.cssText = `width: ${WIDE_BUTTON_WIDTH}em; height: 100%; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
            const bgLayer = document.createElement("div");
            bgLayer.className = "custom-btn-bg-layer";
            bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow2}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
            el.appendChild(bgLayer);
            const contentWrapper = document.createElement("div");
            contentWrapper.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 0.6em; pointer-events: none; position: relative; z-index: 2;";
            const img = document.createElement("div");
            img.className = "mode-icon-el";
            img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
            const text2 = document.createElement("span");
            text2.className = "wide-mode-btn-text";
            text2.dataset.index = index.toString();
            text2.textContent = mode.labels[currentLang];
            text2.style.cssText = "font-size: 1.2em; font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium; transition: color 0.2s ease-in-out;";
            contentWrapper.appendChild(img);
            contentWrapper.appendChild(text2);
            el.appendChild(contentWrapper);
            lifecycle4.listen(el, "mouseenter", () => {
              if (!isSearching()) el.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
            });
            lifecycle4.listen(el, "mouseleave", () => {
              if (!isSearching()) el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
            });
            lifecycle4.listen(el, "click", (e) => {
              e.stopPropagation();
              startAutoQueue(mode);
            });
            row2.appendChild(el);
          });
          const row3 = document.createElement("div");
          row3.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
          const yOffsetRow3 = -(MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP);
          modes2.forEach((mode, index) => {
            const el = document.createElement("div");
            el.className = "custom-mode-button";
            const xOffset = -index * (BUTTON_WIDTH + ROW_GAP);
            el.style.cssText = `width: ${BUTTON_WIDTH}em; height: 100%; flex-shrink: 0; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
            const bgLayer = document.createElement("div");
            bgLayer.className = "custom-btn-bg-layer";
            bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow3}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
            el.appendChild(bgLayer);
            const img = document.createElement("div");
            img.className = "mode-icon-el";
            img.title = mode.labels[currentLang];
            img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; position: relative; z-index: 2; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
            el.appendChild(img);
            lifecycle4.listen(el, "mouseenter", () => {
              if (!isSearching()) el.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
            });
            lifecycle4.listen(el, "mouseleave", () => {
              if (!isSearching()) el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
            });
            lifecycle4.listen(el, "click", (e) => {
              e.stopPropagation();
              startAutoQueue(mode);
            });
            row3.appendChild(el);
          });
          quickWrapper.appendChild(row2);
          quickWrapper.appendChild(row3);
          if (playButton.parentElement) playButton.parentElement.appendChild(quickWrapper);
        }
        function applyStyles(playButton) {
          const container = playButton.closest(gameDOM.common.flexDiv) || playButton.parentElement?.parentElement;
          const mainMenu = document.querySelector(gameDOM.play.mainMenu);
          if (container) {
            const commit = lifecycle4.preserve(container, ["margin-left", "height", "margin-top", "width", "flex-direction", "align-items", "overflow", "z-index", "position"]);
            container.style.marginLeft = "5em";
            container.style.height = "auto";
            container.style.marginTop = "10em";
            container.style.width = "31.25em";
            container.style.flexDirection = "column";
            container.style.alignItems = "flex-start";
            container.style.overflow = "visible";
            container.style.zIndex = "5";
            container.style.position = "relative";
            commit();
          }
          if (playButton) {
            const commit = lifecycle4.preserve(playButton, ["width", "height", "position", "overflow", "border-radius", "transition", "box-shadow"]);
            playButton.style.width = `${MAIN_WIDTH}em`;
            playButton.style.height = `${MAIN_HEIGHT}em`;
            playButton.style.position = "relative";
            playButton.style.overflow = "hidden";
            playButton.style.borderRadius = "0.5rem";
            playButton.style.transition = "box-shadow 0.2s ease-in-out, opacity 0.2s ease-in";
            lifecycle4.listen(playButton, "mouseenter", () => {
              if (!isSearching()) {
                playButton.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
                commit();
              }
            });
            lifecycle4.listen(playButton, "mouseleave", () => {
              if (!isSearching()) {
                playButton.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
                commit();
              }
            });
            const innerBtn = playButton.querySelector(gameDOM.play.button) || playButton;
            const commitInner = lifecycle4.preserve(innerBtn, ["background-image"], ["custom-inner-btn"]);
            innerBtn.style.backgroundImage = "none";
            innerBtn.classList.add("custom-inner-btn");
            commitInner();
            let bgLayer = innerBtn.querySelector(".custom-main-bg-layer");
            if (!bgLayer) {
              bgLayer = document.createElement("div");
              bgLayer.className = "custom-main-bg-layer";
              bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: 0em 0em; background-repeat: no-repeat; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
              innerBtn.insertBefore(bgLayer, innerBtn.firstChild);
            }
            let customText = innerBtn.querySelector(".custom-main-text");
            if (!customText) {
              customText = document.createElement("div");
              customText.className = "custom-main-text";
              customText.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 2.75em; font-weight: 500; color: #ffffff; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-transform: uppercase; transition: color 0.2s ease-in-out; pointer-events: none;`;
              innerBtn.appendChild(customText);
            }
            if (!playButton.dataset.overridden) {
              lifecycle4.listen(playButton, "click", (e) => {
                if (e.isTrusted && !isSearching()) {
                  targetMode = quickBattleMode;
                  autoQueueState = 1;
                }
              });
            }
            commit();
          }
          if (mainMenu) {
            const commit = lifecycle4.preserve(mainMenu, ["margin-top"]);
            mainMenu.style.marginTop = "1em";
            commit();
          }
          createQuickButtons(playButton);
          playButton.dataset.overridden = "true";
          syncButtonStates(true);
        }
        lifecycle4.onCleanup(() => {
          autoQueueState = 0;
          targetMode = null;
          document.body.classList.remove("kasp-autoqueue-active");
          document.getElementById("kasp-playbtn-styles")?.remove();
          document.getElementById("quick-play-wrapper")?.remove();
          document.querySelectorAll('[data-overridden="true"]').forEach((node) => {
            node.querySelectorAll(".custom-main-bg-layer, .custom-main-text, .main-lock-icon").forEach((child) => child.remove());
            node.removeAttribute("data-overridden");
          });
        });
        return () => {
          if (!utils.getSetting("k_ext_btn", false)) return;
          if (state.currentScreen === "battle") return;
          if (!initialized2) {
            initialized2 = true;
            utils.injectStyle(`
                        ${gameDOM.play.hiddenNativeDecorations} { display: none !important; }
                        .custom-inner-btn > *:not(.custom-main-bg-layer):not(.main-lock-icon):not(.custom-main-text):not(.kasp-left-art-slice) { display: none !important; }
                        ${gameDOM.play.untreatedContainer} { opacity: 0 !important; pointer-events: none !important; }
                        
                        ${gameDOM.play.autoQueueCards.split(", ").map((selector) => `body.kasp-autoqueue-active ${selector}`).join(", ")} {
                            opacity: 0 !important; visibility: hidden !important; transition: none !important; animation: none !important;
                        }
                    `, "kasp-playbtn-styles");
            lifecycle4.listen(document, "keydown", handleModeHotkey);
            lifecycle4.interval(() => {
              if (autoQueueState !== 0) processAutoQueue();
            }, 50);
          }
          const playButton = document.querySelector(gameDOM.play.untreatedContainer);
          if (playButton) {
            buttonsCreated = false;
            applyStyles(playButton);
          }
          if (buttonsCreated) {
            syncButtonStates();
          }
        };
      }, () => {
      });
    }
  });

  // src/modules/customFriends.ts
  var lifecycle5, customFriends;
  var init_customFriends = __esm({
    "src/modules/customFriends.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      init_accountIdentity();
      lifecycle5 = featureScope("customFriends");
      customFriends = lifecycle5.initialize(() => {
        const originalDisplays = /* @__PURE__ */ new Map();
        let filterAccount = null;
        let filterRevision = -1;
        const filtersConfig = [
          { url: "https://s.eu.tankionline.com/static/images/allPaints.741c65e1.svg", type: "all" },
          { url: "https://s.eu.tankionline.com/static/images/uncommon.ca77d7da.svg", type: "online" },
          { url: "https://s.eu.tankionline.com/static/images/iconCasualGray.3eea12e7.svg", type: "offline" },
          { url: "https://s.eu.tankionline.com/static/images/iconRareBlue.4e3c7303.svg", type: "clan" },
          { url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg", type: "purple" },
          { url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg", type: "yellow" },
          { url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg", type: "red" }
        ];
        const getCurrentUserId = () => getVerifiedAccount()?.userId || null;
        const getCustomCategories = () => {
          const userId = getCurrentUserId();
          if (!userId) return {};
          try {
            const value = JSON.parse(localStorage.getItem(`tankiCustomCategories_uid_${userId}`) || "{}");
            return value && typeof value === "object" && !Array.isArray(value) ? value : {};
          } catch (e) {
            return {};
          }
        };
        const setCustomCategory = (ownerId, friendId, colorType) => {
          if (ownerId !== getCurrentUserId()) return;
          const cats = getCustomCategories();
          if (cats[friendId] === colorType) {
            delete cats[friendId];
          } else {
            cats[friendId] = colorType;
          }
          localStorage.setItem(`tankiCustomCategories_uid_${ownerId}`, JSON.stringify(cats));
          document.querySelectorAll(".custom-friends-sidebar").forEach((node) => {
            const sidebar = node;
            const activeBtn = sidebar.querySelector(".custom-filter-btn.active");
            if (activeBtn) activeBtn.click();
          });
        };
        const getMyClanTag = () => {
          return getAccountIdentity()?.clanTag || "";
        };
        const getFriendNickname = (element) => {
          if (!element) return "";
          const label = Array.from(element.querySelectorAll("span")).find((span) => span.className.includes(gameDOM.fragments.nicknameText));
          const text2 = label?.textContent ?? (element.innerText || "").split("\n")[0];
          return parseAccountIdentity(text2)?.nickname || "";
        };
        const updateCardBadge = (el, isFriendsList) => {
          const cardText = el.innerText || "";
          const nickText = getFriendNickname(el);
          const clanTag = getMyClanTag();
          const isClan = Boolean(clanTag && cardText.includes(clanTag));
          const cats = getCustomCategories();
          const friendId = getPlayerUserId(nickText);
          const customColor = friendId ? cats[friendId] : void 0;
          let rarityType = null;
          if (customColor) {
            rarityType = customColor;
          } else if (isClan) {
            rarityType = "blue";
          }
          let badge = el.querySelector(".custom-rarity-badge");
          if (rarityType) {
            if (!badge) {
              badge = document.createElement("img");
              badge.src = "https://s.eu.tankionline.com/static/images/categoryRarities.04cb4010.svg";
              badge.className = "custom-rarity-badge";
              el.appendChild(badge);
            }
            badge.className = `custom-rarity-badge rarity-${rarityType}`;
            badge.style.display = "";
          } else {
            if (badge) {
              badge.style.display = "none";
            }
          }
        };
        const applyFilter = (scrollBlock, filterType) => {
          const clanTag = getMyClanTag();
          const cats = getCustomCategories();
          const isFriendsList = scrollBlock.classList.contains(gameDOM.classes.friendList);
          const itemSelector = isFriendsList ? gameDOM.friends.card : gameDOM.friends.invitationCard;
          const items = scrollBlock.querySelectorAll(itemSelector);
          items.forEach((node) => {
            const el = node;
            updateCardBadge(el, isFriendsList);
            if (filterType === "all") {
              el.style.display = "";
              return;
            }
            const cardText = el.innerText || "";
            const textLower = cardText.toLowerCase();
            const isOnline = isFriendsList ? !!el.querySelector(gameDOM.friends.online) : textLower.includes("\u0432 \u0441\u0435\u0442\u0438") || textLower.includes("online");
            const isOffline = isFriendsList ? !!el.querySelector(gameDOM.friends.offline) : !isOnline;
            const nickText = getFriendNickname(el);
            let match = true;
            if (filterType === "online") match = isOnline;
            else if (filterType === "offline") match = isOffline;
            else if (filterType === "clan") match = Boolean(clanTag && cardText.includes(clanTag));
            else if (["purple", "yellow", "red"].includes(filterType)) {
              const friendId = getPlayerUserId(nickText);
              match = !!friendId && cats[friendId] === filterType;
            }
            if (!originalDisplays.has(el)) originalDisplays.set(el, el.style.display);
            el.style.display = match ? "" : "none";
          });
        };
        const injectCategoriesMenu = (menu) => {
          const rankItem = menu.querySelector(gameDOM.friends.contextPlayer);
          if (!rankItem) return;
          const nickname = getFriendNickname(rankItem);
          const ownerId = getCurrentUserId(), friendId = getPlayerUserId(nickname);
          const binding = ownerId && friendId ? `${ownerId}:${friendId}` : "";
          if (binding && menu.dataset.customCategoriesInjected === binding) return;
          menu.querySelector(".custom-category-row")?.remove();
          delete menu.dataset.customCategoriesInjected;
          if (!ownerId || !friendId) return;
          menu.dataset.customCategoriesInjected = binding;
          const row = document.createElement("div");
          row.className = "custom-category-row";
          const cats = getCustomCategories();
          const currentColor = cats[friendId];
          const customButtons = [
            { type: "purple", url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg" },
            { type: "yellow", url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg" },
            { type: "red", url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg" }
          ];
          customButtons.forEach((c) => {
            const btn = document.createElement("div");
            btn.className = `custom-category-menu-btn ${currentColor === c.type ? "active" : ""}`;
            btn.innerHTML = `<img src="${c.url}">`;
            btn.onclick = lifecycle5.guard((e) => {
              e.stopPropagation();
              const currentRank = menu.querySelector(gameDOM.friends.contextPlayer);
              if (ownerId !== getCurrentUserId() || getPlayerUserId(getFriendNickname(currentRank)) !== friendId) return;
              setCustomCategory(ownerId, friendId, c.type);
              row.querySelectorAll(".custom-category-menu-btn").forEach((b) => b.classList.remove("active"));
              const newCats = getCustomCategories();
              if (newCats[friendId] === c.type) {
                btn.classList.add("active");
              }
            });
            row.appendChild(btn);
          });
          menu.appendChild(row);
          lifecycle5.frame(() => {
            const rect = menu.getBoundingClientRect();
            const overflow = rect.bottom - window.innerHeight;
            if (overflow > 0) {
              const currentTop = parseFloat(menu.style.top) || rect.top;
              menu.style.top = `${currentTop - overflow - 8}px`;
            }
          });
        };
        const setupSidebar = (scrollBlock) => {
          if (scrollBlock.dataset.sidebarInjected === "true") return;
          scrollBlock.dataset.sidebarInjected = "true";
          const isFriends = scrollBlock.classList.contains(gameDOM.classes.friendList);
          if (isFriends) {
            const wrapper = document.createElement("div");
            wrapper.className = "custom-friends-wrapper";
            wrapper.style.cssText = "position: relative; width: 72.375em; margin: 0 auto; box-sizing: border-box;";
            if (scrollBlock.parentNode) {
              scrollBlock.parentNode.insertBefore(wrapper, scrollBlock);
            }
            wrapper.appendChild(scrollBlock);
            const sidebar = document.createElement("div");
            sidebar.className = "custom-friends-sidebar sidebar-friends";
            filtersConfig.forEach((config, index) => {
              const btn = document.createElement("div");
              btn.className = "custom-filter-btn";
              if (index === 0) btn.classList.add("active");
              const img = document.createElement("img");
              img.src = config.url;
              lifecycle5.listen(btn, "click", () => {
                sidebar.querySelectorAll(".custom-filter-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                applyFilter(scrollBlock, config.type);
              });
              btn.appendChild(img);
              sidebar.appendChild(btn);
            });
            wrapper.appendChild(sidebar);
          } else {
            const parent = scrollBlock.parentNode;
            if (!parent) return;
            if (window.getComputedStyle(parent).position === "static") {
              parent.style.position = "relative";
            }
            const sidebar = document.createElement("div");
            sidebar.className = "custom-friends-sidebar sidebar-invites";
            filtersConfig.forEach((config, index) => {
              const btn = document.createElement("div");
              btn.className = "custom-filter-btn";
              if (index === 0) btn.classList.add("active");
              const img = document.createElement("img");
              img.src = config.url;
              lifecycle5.listen(btn, "click", () => {
                sidebar.querySelectorAll(".custom-filter-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                applyFilter(scrollBlock, config.type);
              });
              btn.appendChild(img);
              sidebar.appendChild(btn);
            });
            parent.insertBefore(sidebar, scrollBlock);
          }
        };
        lifecycle5.onCleanup(() => {
          document.querySelectorAll(".custom-friends-sidebar, .custom-rarity-badge, .custom-category-row").forEach((node) => node.remove());
          for (const [row, display] of originalDisplays) row.style.display = display;
          originalDisplays.clear();
          document.querySelectorAll("[data-sidebar-injected]").forEach((node) => node.removeAttribute("data-sidebar-injected"));
          document.querySelectorAll(".custom-friends-wrapper").forEach((wrapper) => wrapper.replaceWith(...Array.from(wrapper.childNodes)));
        });
        return () => {
          if (!utils.getSetting("k_friends", false)) return;
          if (state.currentScreen === "battle") return;
          const userId = getCurrentUserId();
          const revision = getAccountIdentityRevision();
          if (filterAccount !== userId || filterRevision !== revision) {
            filterAccount = userId;
            filterRevision = revision;
            document.querySelectorAll(".custom-friends-sidebar .custom-filter-btn.active").forEach((button) => button.click());
          }
          const scrollBlocks = document.querySelectorAll(gameDOM.friends.lists);
          scrollBlocks.forEach((node) => {
            const scrollBlock = node;
            if (scrollBlock.dataset.sidebarInjected !== "true") setupSidebar(scrollBlock);
            const isFriendsList = scrollBlock.classList.contains(gameDOM.classes.friendList);
            const itemSelector = isFriendsList ? gameDOM.friends.card : gameDOM.friends.invitationCard;
            scrollBlock.querySelectorAll(itemSelector).forEach((el) => {
              updateCardBadge(el, isFriendsList);
            });
          });
          const contextMenus = document.querySelectorAll(gameDOM.friends.contextMenu);
          contextMenus.forEach((node) => {
            const menu = node;
            injectCategoriesMenu(menu);
          });
        };
      }, () => {
      });
    }
  });

  // src/modules/garageButtons.ts
  var lifecycle6, garageButtons;
  var init_garageButtons = __esm({
    "src/modules/garageButtons.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      lifecycle6 = featureScope("garageButtons");
      garageButtons = lifecycle6.initialize(() => {
        const ICONS = {
          UPGRADE: "https://s.eu.tankionline.com/static/images/max_level.e31e0825.svg",
          MOUNT: "https://s.eu.tankionline.com/static/images/ic_mount.4175dc0c.svg",
          BUY: "https://s.eu.tankionline.com/static/images/buyButtonIcon.ca48e861.svg"
        };
        const processedSigs = /* @__PURE__ */ new WeakMap();
        function getActiveTabCategory() {
          const activeMenu = document.querySelector(gameDOM.navigation.activeGarageCategory);
          if (!activeMenu)
            return "default";
          const txt = activeMenu.textContent?.toLowerCase() || "";
          if (txt.includes("\u043F\u0440\u0438\u043F\u0430\u0441") || txt.includes("supplies"))
            return "supplies";
          if (txt.includes("\u043A\u0440\u0430\u0441\u043A") || txt.includes("paint"))
            return "paints";
          if (txt.includes("\u0433\u0440\u0430\u043D\u0430\u0442") || txt.includes("grenade"))
            return "grenades";
          return "default";
        }
        function computeButtonSig(btn, category) {
          const text2 = (btn.textContent || "").trim().slice(0, 80);
          const kidCount = btn.children.length;
          const hasIcon = btn.querySelector(gameDOM.common.icon) ? 1 : 0;
          const hasKaspActive = btn.classList.contains("kasp-active-btn") ? 1 : 0;
          const hasKaspDisabled = btn.classList.contains("kasp-disabled-btn") ? 1 : 0;
          return `${text2}|${category}|${kidCount}|${hasIcon}|${hasKaspActive}|${hasKaspDisabled}`;
        }
        function applyButtonFixes() {
          const buttons = document.querySelectorAll(gameDOM.garage.styledActions);
          if (!buttons.length)
            return;
          const currentCategory = getActiveTabCategory();
          buttons.forEach((btn) => {
            const commit = lifecycle6.preserve(btn, [], ["kasp-active-btn", "kasp-disabled-btn", "kasp-hover-up", "kasp-hover-down", "kasp-btn-white", "kasp-btn-gray"]);
            const textHTML = btn.innerHTML.toLowerCase();
            const textContent = btn.textContent?.toLowerCase() || "";
            const hasHotKey = btn.querySelector(gameDOM.common.hotkeyFragment);
            const hasPrice = textHTML.includes("price") || textHTML.includes("\u043A\u0440\u0438\u0441\u0442\u0430\u043B") || textHTML.includes("ruby") || textHTML.includes("discount") || textHTML.includes("tankoin");
            const isActive = hasHotKey || hasPrice;
            btn.classList.remove("kasp-hover-up", "kasp-hover-down", "kasp-btn-white", "kasp-btn-gray");
            let targetIcon = ICONS.UPGRADE;
            let iconColor = isActive ? "#000000" : "rgb(229, 229, 229)";
            let hoverClass = "kasp-hover-up";
            let btnColorClass = "kasp-btn-white";
            const isEquipText = textContent.includes("space") || textContent.includes("\u0443\u0441\u0442\u0430\u043D\u043E\u0432") || textContent.includes("equip") || textContent.includes("mount") || textContent.includes("\u0441\u043D\u044F\u0442\u044C") || textContent.includes("unequip");
            const isMaxedText = textContent.includes("\u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E") || textContent.includes("maxed") || textContent.includes("upgraded") || textContent.includes("completed");
            const isSuppliesContainer = btn.closest(gameDOM.garage.suppliesActions) !== null;
            if (currentCategory === "paints") {
              targetIcon = ICONS.MOUNT;
              hoverClass = "kasp-hover-down";
              btnColorClass = "kasp-btn-gray";
            } else if (isEquipText) {
              targetIcon = ICONS.MOUNT;
              hoverClass = "kasp-hover-down";
              btnColorClass = "kasp-btn-gray";
            } else if (isMaxedText) {
              targetIcon = ICONS.UPGRADE;
              hoverClass = "kasp-hover-up";
            } else if (currentCategory === "supplies" || isSuppliesContainer) {
              targetIcon = ICONS.BUY;
              hoverClass = "kasp-hover-up";
            } else {
              const parent = btn.closest(gameDOM.garage.actionContainer);
              const siblingsCount = parent ? parent.querySelectorAll(gameDOM.garage.actionButton).length : 1;
              if (siblingsCount === 1) {
                targetIcon = ICONS.BUY;
                hoverClass = "kasp-hover-up";
              } else {
                targetIcon = ICONS.UPGRADE;
                hoverClass = "kasp-hover-up";
              }
            }
            if (isActive) {
              btn.classList.add("kasp-active-btn", btnColorClass, hoverClass);
              btn.classList.remove("kasp-disabled-btn");
            } else {
              btn.classList.add("kasp-disabled-btn");
              btn.classList.remove("kasp-active-btn");
            }
            const iconDiv = btn.querySelector(gameDOM.common.icon);
            if (iconDiv) {
              const commitIcon = lifecycle6.preserve(iconDiv, ["background-image", "background-color", "-webkit-mask-image", "mask-image", "-webkit-mask-size", "mask-size", "-webkit-mask-repeat", "mask-repeat", "-webkit-mask-position", "mask-position", "opacity"]);
              applyMask(iconDiv, targetIcon, iconColor);
              commitIcon();
            }
            commit();
          });
        }
        function applyMask(element, url, color) {
          element.style.setProperty("background-image", "none", "important");
          element.style.setProperty("background-color", color, "important");
          element.style.setProperty("-webkit-mask-image", `url("${url}")`, "important");
          element.style.setProperty("mask-image", `url("${url}")`, "important");
          element.style.setProperty("-webkit-mask-size", "contain", "important");
          element.style.setProperty("mask-size", "contain", "important");
          element.style.setProperty("-webkit-mask-repeat", "no-repeat", "important");
          element.style.setProperty("mask-repeat", "no-repeat", "important");
          element.style.setProperty("-webkit-mask-position", "center", "important");
          element.style.setProperty("mask-position", "center", "important");
          element.style.setProperty("opacity", "1", "important");
        }
        return () => {
          if (state.currentScreen !== "garage")
            return;
          const buttons = document.querySelectorAll(gameDOM.garage.styledActions);
          if (!buttons.length)
            return;
          const category = getActiveTabCategory();
          let needsWork = false;
          const currentSigs = [];
          for (let i = 0; i < buttons.length; i++) {
            const sig = computeButtonSig(buttons[i], category);
            currentSigs.push(sig);
            if (processedSigs.get(buttons[i]) !== sig) {
              needsWork = true;
              break;
            }
          }
          if (!needsWork)
            return;
          applyButtonFixes();
          for (let i = 0; i < buttons.length; i++) {
            processedSigs.set(buttons[i], computeButtonSig(buttons[i], category));
          }
        };
      }, () => {
      });
    }
  });

  // src/modules/welcomeModal.ts
  var lifecycle7, welcomeModal;
  var init_welcomeModal = __esm({
    "src/modules/welcomeModal.ts"() {
      "use strict";
      init_featureRuntime();
      init_state();
      lifecycle7 = featureScope("welcomeModal");
      welcomeModal = lifecycle7.initialize(() => {
        const CURRENT_VERSION = chrome.runtime.getManifest().version;
        const STORAGE_KEY = "kasp_last_version";
        let hasChecked = false;
        const t = {
          RU: {
            version: `\u0412\u0415\u0420\u0421\u0418\u042F ${CURRENT_VERSION}`,
            intro: `\u041E\u0433\u0440\u043E\u043C\u043D\u043E\u0435 \u0441\u043F\u0430\u0441\u0438\u0431\u043E, \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0435\u0441\u044C Kaspersky's Inventions! \u041C\u044B \u0446\u0435\u043D\u0438\u043C \u0432\u0430\u0448\u0435 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u0435 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438 \u0441 \u043A\u0430\u0436\u0434\u044B\u043C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0431\u0443\u0434\u0435\u043C \u0440\u0430\u0434\u043E\u0432\u0430\u0442\u044C \u0432\u0430\u0441 \u043D\u043E\u0432\u044B\u043C\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u044F\u043C\u0438.`,
            role1: `\u0418\u0434\u0435\u044E \u0441\u043E\u0437\u0434\u0430\u043B`,
            role2: `\u0412 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u0443\u0447\u0430\u0441\u0442\u0432\u043E\u0432\u0430\u043B\u0438`,
            role3: `\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0446\u0435\u043D\u0438\u0432\u0430\u043B\u0438`,
            role4: `\u0414\u0438\u0437\u0430\u0439\u043D\u0435\u0440\u044B`,
            role5: `\u0422\u0435\u0441\u0442\u0435\u0440\u044B`,
            role6: `\u041A\u043E\u0434\u0435\u0440\u044B`,
            role7: "\u0410\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u044B",
            outro: `\u041F\u0440\u043E\u0435\u043A\u0442 \u0432\u044B\u0440\u0430\u0436\u0430\u0435\u0442 \u0438\u043C \u043E\u0433\u0440\u043E\u043C\u043D\u0443\u044E \u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u043D\u043E\u0441\u0442\u044C!`,
            close: `\u0417\u0410\u041A\u0420\u042B\u0422\u042C`
          },
          EN: {
            version: `VERSION ${CURRENT_VERSION}`,
            intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
            role1: `Idea Created By`,
            role2: `Co-created By`,
            role3: `Quality Assessed By`,
            role4: `Designers By`,
            role5: `Testers By`,
            role6: `Coders By`,
            role7: "Assistants By",
            outro: `The project expresses huge gratitude to them!`,
            close: `CLOSE`
          }
        };
        async function showWelcomeModal() {
          const lang = state.lang;
          const dict = t[lang] || t["EN"];
          const templateUrl = chrome.runtime.getURL("templates/welcome-modal.html");
          try {
            const response = await fetch(templateUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let html = await response.text();
            if (lifecycle7.disabled) return;
            html = html.replace(/{{version}}/g, dict.version).replace(/{{intro}}/g, dict.intro).replace(/{{role1}}/g, dict.role1).replace(/{{role2}}/g, dict.role2).replace(/{{role3}}/g, dict.role3).replace(/{{role4}}/g, dict.role4).replace(/{{role5}}/g, dict.role5).replace(/{{role6}}/g, dict.role6).replace(/{{role7}}/g, dict.role7).replace(/{{outro}}/g, dict.outro).replace(/{{close}}/g, dict.close);
            const overlay = document.createElement("div");
            overlay.id = "kasp-welcome-overlay";
            overlay.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0, 0, 0, 0.7); z-index: 99999;
                        display: flex; align-items: center; justify-content: center;
                        backdrop-filter: blur(3px);
                    `;
            const dialog = document.createElement("div");
            dialog.style.cssText = `
                        display: flex; flex-direction: column; align-items: stretch;
                        width: 45em; max-width: 90vw;
                        z-index: 60; box-shadow: rgba(0, 0, 0, 0.5) 0px 0.5em 2em 0px;
                        outline: rgba(255, 255, 255, 0.25) solid 0.063em;
                        padding: 2.5em; border-radius: 0.75em;
                        background: radial-gradient(100% 100% at 0% 0%, rgb(255 255 255 / 15%) 0%, rgb(0 0 0 / 95%) 100%), rgb(56 56 56);
                        font-family: BaseFont, FallbackFont, sans-serif; color: white;
                    `;
            dialog.innerHTML = html;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const closeBtn = document.getElementById("kasp-welcome-close");
            if (closeBtn) {
              lifecycle7.listen(closeBtn, "click", () => {
                overlay.remove();
                localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
              });
            }
          } catch (error) {
            console.error("[Kaspersky Inventions] Failed to load welcome modal template:", error);
          }
        }
        lifecycle7.onCleanup(() => {
          document.getElementById("kasp-welcome-overlay")?.remove();
        });
        return () => {
          if (hasChecked) return;
          const savedVersion = localStorage.getItem(STORAGE_KEY);
          if (savedVersion === CURRENT_VERSION) {
            hasChecked = true;
            return;
          }
          if (state.currentScreen === "loading") return;
          hasChecked = true;
          showWelcomeModal();
        };
      }, () => {
      });
    }
  });

  // src/modules/hideCurrency.ts
  var lifecycle8, hideCurrency;
  var init_hideCurrency = __esm({
    "src/modules/hideCurrency.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      lifecycle8 = featureScope("hideCurrency");
      hideCurrency = lifecycle8.initialize(() => {
        let initialized2 = false;
        let interval;
        const masked = /* @__PURE__ */ new Map();
        function getHiddenText() {
          return state.lang === "RU" ? "\u0421\u043A\u0440\u044B\u0442\u043E" : "Hidden";
        }
        function processSpan(span) {
          if (span.closest("#kasp-tankoin-balance")) return;
          const text2 = span.textContent?.trim() || "";
          const targetText = getHiddenText();
          const parent = span.closest(gameDOM.account.currencyIcon) || span.parentElement;
          if (!parent) return;
          let record = masked.get(span);
          if (record && record.parent !== parent) {
            restore(span);
            record = void 0;
          }
          if (/\d/.test(text2)) {
            if (record) record.value = text2;
            else {
              record = {
                value: text2,
                parent,
                tooltip: parent.getAttribute("data-tooltip"),
                hadClass: parent.classList.contains("currency-masked")
              };
              masked.set(span, record);
            }
          }
          if (!record) return;
          if (span.dataset.originalValue !== record.value) span.dataset.originalValue = record.value;
          if (span.textContent !== targetText) span.textContent = targetText;
          if (parent.getAttribute("data-tooltip") !== record.value) parent.setAttribute("data-tooltip", record.value);
          if (!parent.classList.contains("currency-masked")) parent.classList.add("currency-masked");
        }
        function restore(span) {
          const record = masked.get(span);
          if (!record) return;
          if (["Hidden", "\u0421\u043A\u0440\u044B\u0442\u043E"].includes(span.textContent?.trim() || "")) span.textContent = record.value;
          delete span.dataset.originalValue;
          if (!record.hadClass) record.parent.classList.remove("currency-masked");
          if (record.parent.getAttribute("data-tooltip") === record.value) {
            if (record.tooltip === null) record.parent.removeAttribute("data-tooltip");
            else record.parent.setAttribute("data-tooltip", record.tooltip);
          }
          masked.delete(span);
        }
        function restoreAll() {
          for (const span of masked.keys()) restore(span);
        }
        function sync() {
          if (!utils.getSetting("k_hideCurrency", false) || state.currentScreen === "battle") {
            lifecycle8.cancelInterval(interval);
            interval = void 0;
            restoreAll();
            return;
          }
          interval ??= lifecycle8.interval(sync, 500);
          for (const span of masked.keys()) if (!span.isConnected) restore(span);
          document.querySelectorAll(gameDOM.account.currencyValues).forEach(processSpan);
        }
        lifecycle8.onCleanup(() => {
          interval = void 0;
          restoreAll();
        });
        return () => {
          if (!initialized2) {
            initialized2 = true;
            lifecycle8.listen(window, "kasp:settings-changed", sync);
            lifecycle8.listen(window, "storage", sync);
          }
          sync();
        };
      }, () => {
      });
    }
  });

  // src/modules/hideSupplies.ts
  var lifecycle9, hideSupplies;
  var init_hideSupplies = __esm({
    "src/modules/hideSupplies.ts"() {
      "use strict";
      init_featureRuntime();
      init_utils();
      init_gameDOM();
      lifecycle9 = featureScope("hideSupplies");
      hideSupplies = lifecycle9.initialize(() => {
        let initialized2 = false;
        let observer = null;
        const marked = /* @__PURE__ */ new Set();
        function restore() {
          for (const element of marked) element.classList.remove("kasp-private-supply-value", "kasp-private-supply-static");
          marked.clear();
        }
        const sync = () => {
          const enabled = utils.getSetting("k_hideSupplies", false);
          document.documentElement.classList.toggle("kasp-hide-supplies", enabled);
          if (!enabled) {
            observer?.disconnect();
            restore();
            return;
          }
          observer ??= lifecycle9.observer((changes) => {
            if (changes.some((change) => change.type !== "attributes" || marked.has(change.target))) sync();
          });
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
          for (const element of marked) if (!element.isConnected || !element.matches(gameDOM.supplyPrivacy.counts)) {
            element.classList.remove("kasp-private-supply-value", "kasp-private-supply-static");
            marked.delete(element);
          }
          document.querySelectorAll(gameDOM.supplyPrivacy.counts).forEach((element) => {
            if (marked.has(element) && element.classList.contains("kasp-private-supply-value")) return;
            if (getComputedStyle(element).position === "static") element.classList.add("kasp-private-supply-static");
            element.classList.add("kasp-private-supply-value");
            marked.add(element);
          });
        };
        lifecycle9.onCleanup(() => {
          observer?.disconnect();
          restore();
          document.documentElement.classList.remove("kasp-hide-supplies");
        });
        return () => {
          if (!initialized2) {
            initialized2 = true;
            lifecycle9.listen(window, "kasp:settings-changed", sync);
            lifecycle9.listen(window, "storage", sync);
          }
          sync();
        };
      }, () => {
      });
    }
  });

  // src/modules/tankoinBalance.ts
  function parseBalance(value) {
    const text2 = value?.trim() || "";
    return text2.length <= 64 && /^\d[\d\s]*$/.test(text2) ? text2 : null;
  }
  function readBalance(element) {
    return parseBalance(element?.textContent) ?? parseBalance(element?.dataset.originalValue);
  }
  var lifecycle10, PANEL_ID, COIN_ICON, STORAGE_PREFIX, tankoinBalance;
  var init_tankoinBalance = __esm({
    "src/modules/tankoinBalance.ts"() {
      "use strict";
      init_featureRuntime();
      init_accountIdentity();
      init_accountId();
      init_pageMessages();
      init_gameDOM();
      init_state();
      init_utils();
      lifecycle10 = featureScope("tankoinBalance");
      PANEL_ID = "kasp-tankoin-balance";
      COIN_ICON = "https://s.eu.tankionline.com/static/images/coin.3a16e831.svg";
      STORAGE_PREFIX = "kasp_tankoin_balance_uid_";
      tankoinBalance = lifecycle10.initialize(() => {
        let owner = null;
        let ownerId = null;
        let balance = null;
        let lastSaveAttempt = null;
        let iconUrl2 = COIN_ICON;
        let panel = null;
        let iconContainer = null;
        let image = null;
        let value = null;
        let observer = null;
        let sources = [];
        let initialized2 = false;
        const presentedOwners = /* @__PURE__ */ new Set();
        function removePanel() {
          panel?.remove();
          panel = iconContainer = image = value = null;
        }
        function sync() {
          if (!initialized2) {
            initialized2 = true;
            lifecycle10.listen(window, "kasp:settings-changed", sync);
            lifecycle10.listen(window, "storage", sync);
            lifecycle10.listen(window, "message", (event) => {
              if (readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE)) sync();
            });
          }
          const account = getVerifiedAccount();
          const nickname = getAccountIdentity()?.nickname || account?.nickname || null;
          if (nickname !== owner && (!account || account.userId !== ownerId)) {
            ownerId = null;
            balance = null;
            lastSaveAttempt = null;
            iconUrl2 = COIN_ICON;
            removePanel();
          }
          owner = nickname;
          if (account && account.userId !== ownerId) {
            if (ownerId !== null) balance = null;
            ownerId = account.userId;
            let cached = null;
            try {
              cached = parseBalance(localStorage.getItem(STORAGE_PREFIX + ownerId));
            } catch {
            }
            balance ??= cached;
            lastSaveAttempt = cached;
          }
          const breadcrumbs = document.querySelector(gameDOM.account.currencyHeader);
          const currencies = (breadcrumbs || document).querySelector(gameDOM.account.currencyGroup);
          const header = breadcrumbs || currencies?.parentElement || null;
          const native = header?.querySelector(`${gameDOM.account.tankoinContainer}:not(#${PANEL_ID})`) || null;
          const exchange = document.querySelector(gameDOM.account.exchangeBalance);
          const nextSources = [native, exchange].filter((element) => !!element);
          if (sources.length !== nextSources.length || sources.some((element, index) => element !== nextSources[index])) {
            observer ??= lifecycle10.observer(sync);
            observer.disconnect();
            sources = nextSources;
            for (const source of sources) observer.observe(source, { childList: true, subtree: true, characterData: true });
          }
          const observed = readBalance(exchange) ?? readBalance(native?.querySelector(gameDOM.account.tankoinBalance) || null);
          if (observed !== null) balance = observed;
          if (account && account.userId === ownerId && balance !== null && balance !== lastSaveAttempt) {
            lastSaveAttempt = balance;
            try {
              localStorage.setItem(STORAGE_PREFIX + ownerId, balance);
            } catch {
            }
          }
          const sourceIcon = (exchange ? document.querySelector(gameDOM.account.exchangeIcon) : null) || native?.querySelector(gameDOM.account.tankoinIcon);
          if (sourceIcon?.src) iconUrl2 = sourceIcon.src;
          if (!header || native || state.currentScreen === "lobby" && !account) {
            if (header && native && account) presentedOwners.add(account.userId);
            removePanel();
            return;
          }
          if (!panel?.isConnected || panel.parentElement !== header) {
            removePanel();
            panel = document.createElement("div");
            panel.id = PANEL_ID;
            panel.className = gameDOM.classes.tankoinContainer + (state.currentScreen === "lobby" && account && !presentedOwners.has(account.userId) ? " kasp-lobby-reveal" : "");
            iconContainer = document.createElement("div");
            iconContainer.className = gameDOM.classes.currencyIcon;
            const block = document.createElement("div");
            block.className = gameDOM.classes.tankoinBlock;
            image = document.createElement("img");
            image.className = gameDOM.classes.tankoinIcon;
            image.alt = "";
            value = document.createElement("span");
            block.append(image, value);
            iconContainer.appendChild(block);
            panel.appendChild(iconContainer);
            header.insertBefore(panel, currencies?.parentElement === header ? currencies : header.firstChild);
          }
          if (account) presentedOwners.add(account.userId);
          if (image.getAttribute("src") !== iconUrl2) image.src = iconUrl2;
          const hidden = utils.getSetting("k_hideCurrency", false) && balance !== null;
          const text2 = hidden ? state.lang === "RU" ? "\u0421\u043A\u0440\u044B\u0442\u043E" : "Hidden" : balance ?? "\u2014";
          if (value.textContent !== text2) value.textContent = text2;
          if (hidden) {
            value.dataset.originalValue = balance;
            if (iconContainer.getAttribute("data-tooltip") !== balance) iconContainer.setAttribute("data-tooltip", balance);
          } else {
            delete value.dataset.originalValue;
            iconContainer.removeAttribute("data-tooltip");
          }
          iconContainer.classList.toggle("currency-masked", hidden);
          const hint = balance === null ? state.lang === "RU" ? "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u043B\u0438 \u043E\u0431\u043C\u0435\u043D \u0440\u0443\u0431\u0438\u043D\u043E\u0432, \u0447\u0442\u043E\u0431\u044B \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 \u0442\u0430\u043D\u043A\u043E\u0438\u043D\u043E\u0432." : "Open the shop or Ruby exchange to refresh the Tankoin balance." : state.lang === "RU" ? "\u0422\u0430\u043D\u043A\u043E\u0438\u043D\u044B" : "Tankoins";
          if (panel.title !== hint) panel.title = hint;
        }
        lifecycle10.onCleanup(() => {
          observer?.disconnect();
          sources = [];
          balance = owner = ownerId = lastSaveAttempt = null;
          removePanel();
        });
        return sync;
      }, () => {
      });
    }
  });

  // src/modules/accountSearchNotice.ts
  var lifecycle11, accountSearchNotice;
  var init_accountSearchNotice = __esm({
    "src/modules/accountSearchNotice.ts"() {
      "use strict";
      init_featureRuntime();
      init_accountIdentity();
      init_accountId();
      init_pageMessages();
      init_gameDOM();
      init_state();
      lifecycle11 = featureScope("accountSearchNotice");
      accountSearchNotice = lifecycle11.initialize(() => {
        let notice = null, label = null;
        let showTimer = null, removeTimer = null, identityTimer = null;
        let initialized2 = false;
        const searching = () => state.currentScreen === "lobby" && !!document.querySelector(gameDOM.play.mainMenu) && !getVerifiedAccount();
        function remove() {
          notice?.remove();
          notice = label = null;
          if (removeTimer !== null) lifecycle11.cancelTimeout(removeTimer);
          removeTimer = null;
        }
        function hide() {
          if (showTimer !== null) lifecycle11.cancelTimeout(showTimer);
          showTimer = null;
          if (!notice || removeTimer !== null) return;
          if (notice.dataset.visible !== "true") {
            remove();
            return;
          }
          notice.dataset.visible = "false";
          removeTimer = lifecycle11.timeout(remove, 200);
        }
        function caption() {
          const text2 = state.lang === "RU" ? "\u041F\u043E\u0438\u0441\u043A ID \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430" : "Searching for account ID";
          if (label && label.textContent !== text2) label.textContent = text2;
        }
        function show() {
          showTimer = null;
          if (!searching()) return;
          const root = document.querySelector(gameDOM.common.appContainer) || document.body;
          if (!root) return;
          notice = document.createElement("div");
          notice.id = "kasp-account-search-notice";
          notice.className = "kasp-lobby-has-art";
          notice.setAttribute("role", "status");
          notice.setAttribute("aria-live", "polite");
          notice.setAttribute("aria-atomic", "true");
          const art = document.createElement("span");
          art.className = "kasp-lobby-art-slice";
          art.setAttribute("aria-hidden", "true");
          art.style.setProperty("--kasp-art-image", `url(${JSON.stringify(chrome.runtime.getURL("assets/art1.png"))})`);
          label = document.createElement("span");
          label.className = "kasp-account-search-label";
          notice.append(art, label);
          caption();
          root.appendChild(notice);
          const target = notice;
          lifecycle11.frame(() => lifecycle11.frame(() => {
            if (notice === target && searching()) target.dataset.visible = "true";
          }));
        }
        function sync() {
          if (!initialized2) {
            initialized2 = true;
            lifecycle11.listen(window, "message", (event) => {
              if (!readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE) || identityTimer !== null) return;
              identityTimer = lifecycle11.timeout(() => {
                identityTimer = null;
                sync();
              }, 0);
            });
          }
          if (!searching()) {
            hide();
            return;
          }
          if (notice && !notice.isConnected) remove();
          if (notice) {
            if (removeTimer !== null) {
              lifecycle11.cancelTimeout(removeTimer);
              removeTimer = null;
              notice.dataset.visible = "true";
            }
            caption();
            return;
          }
          if (showTimer === null) showTimer = lifecycle11.timeout(show, 600);
        }
        lifecycle11.onCleanup(remove);
        return sync;
      }, () => {
      });
    }
  });

  // src/modules/lobbyPasses.ts
  function readStarProgress(value) {
    const match = /^(\d+)\/(\d+)$/.exec(value.replace(/\s/g, ""));
    if (!match || +match[2] <= 0) return null;
    const percent = +match[1] / +match[2] * 100;
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null;
  }
  function readCircleProgress(circle) {
    const halves = circle?.children?.[1]?.children;
    if (!halves || halves.length < 1 || halves.length > 2) return null;
    function angle(element) {
      const value = element.style.transform || getComputedStyle(element).transform;
      const direct = /^rotate(?:Z)?\(\s*([-+\d.e]+)(deg|rad|turn)\s*\)$/i.exec(value);
      let degrees2;
      if (direct) degrees2 = +direct[1] * (direct[2] === "rad" ? 180 / Math.PI : direct[2] === "turn" ? 360 : 1);
      else {
        if (!value || value === "none") return null;
        try {
          const matrix = new DOMMatrixReadOnly(value);
          degrees2 = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        } catch {
          return null;
        }
      }
      return Number.isFinite(degrees2) ? (degrees2 % 360 + 360) % 360 : null;
    }
    const first = angle(halves[0]);
    if (first === null || first > 180.01) return null;
    let degrees = first;
    if (halves.length === 2) {
      const second = angle(halves[1]);
      if (first < 179.99 || second === null || second > 0.01 && second < 180) return null;
      degrees = second < 0.01 ? 360 : second;
    }
    return Math.round(degrees / 3.6 * 100) / 100;
  }
  var lifecycle12, selectors, lobbyPasses;
  var init_lobbyPasses = __esm({
    "src/modules/lobbyPasses.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      lifecycle12 = featureScope("lobbyPasses");
      selectors = gameDOM.lobbyPasses;
      lobbyPasses = lifecycle12.initialize(() => {
        const records = /* @__PURE__ */ new Map();
        let sources = [], observer = null;
        let resize = null, initialized2 = false, queued = false;
        let trophiesParent = null;
        const TROPHY_TOP = "--kasp-lobby-trophies-top";
        const TROPHY_LEFT = "--kasp-lobby-trophies-left", TROPHY_WIDTH = "--kasp-lobby-trophies-width";
        const previousTrophyStyles = /* @__PURE__ */ new Map();
        const artLayers = /* @__PURE__ */ new Map();
        let announcementBody = null;
        const ANNOUNCEMENT_HEIGHT = "--kasp-announcement-height";
        const artImage = `url(${JSON.stringify(chrome.runtime.getURL("assets/art1.png"))})`;
        const properties = [
          "--kasp-pass-left",
          "--kasp-pass-top",
          "--kasp-pass-width",
          "--kasp-star-progress",
          "--kasp-star-meter-display",
          "--kasp-elite-progress",
          "--kasp-elite-meter-opacity"
        ];
        function restoreTrophies() {
          if (!trophiesParent) return;
          for (const [key, previous] of previousTrophyStyles) {
            if (previous.value) trophiesParent.style.setProperty(key, previous.value, previous.priority);
            else trophiesParent.style.removeProperty(key);
          }
          previousTrophyStyles.clear();
          trophiesParent = null;
        }
        function release(root) {
          root.classList.remove("kasp-lobby-pass-card", `kasp-pass-${records.get(root)}`);
          root.removeAttribute("data-kasp-pass-lang");
          for (const key of properties) root.style.removeProperty(key);
          records.delete(root);
        }
        function decorate(root, kind) {
          if (records.has(root) && records.get(root) !== kind) release(root);
          records.set(root, kind);
          if (!root.classList.contains("kasp-lobby-pass-card") || !root.classList.contains(`kasp-pass-${kind}`))
            root.classList.add("kasp-lobby-pass-card", `kasp-pass-${kind}`);
          if (root.getAttribute("data-kasp-pass-lang") !== state.lang) root.setAttribute("data-kasp-pass-lang", state.lang);
        }
        function setStyle(element, key, value) {
          if (element.style.getPropertyValue(key) !== value) element.style.setProperty(key, value);
        }
        function fontSize(element) {
          return parseFloat(getComputedStyle(element).fontSize) || 16;
        }
        function em(value, font) {
          return `${value / font}em`;
        }
        function sizeAnnouncement(root) {
          const body = root?.querySelector(selectors.announcementBody) ?? null;
          if (announcementBody !== body) {
            announcementBody?.style.removeProperty(ANNOUNCEMENT_HEIGHT);
            announcementBody = body;
          }
          const caption = body?.querySelector(selectors.announcementCaption);
          if (!body || !caption || !body.offsetWidth) return;
          const timer = body.querySelector(selectors.announcementTimer);
          const css = getComputedStyle(body);
          const px = (value) => parseFloat(value) || 0;
          const content = Math.max(caption.scrollHeight, timer?.scrollHeight ?? 0);
          const height = Math.max(px(css.minHeight), content + px(css.paddingTop) + px(css.paddingBottom) + px(css.borderTopWidth) + px(css.borderBottomWidth));
          setStyle(body, ANNOUNCEMENT_HEIGHT, em(Math.ceil(height), parseFloat(css.fontSize) || 16));
        }
        function clearPanorama() {
          for (const [card, layer] of artLayers) {
            layer.remove();
            card.classList.remove("kasp-lobby-has-art");
          }
          artLayers.clear();
        }
        function paintPanorama(challenge, elite, trophies, announcement) {
          const cards = [
            challenge,
            ...elite ? [elite] : [],
            ...announcement ? [announcement] : [],
            ...Array.from(trophies?.querySelectorAll(".custom-trophy-item") || [])
          ];
          const measured = cards.map((card) => ({ card, rect: card.getBoundingClientRect() })).filter((item) => item.rect.width > 0 && item.rect.height > 0);
          if (!measured.length) {
            clearPanorama();
            return;
          }
          const current = new Set(measured.map((item) => item.card));
          for (const [card, layer] of artLayers) if (!current.has(card)) {
            layer.remove();
            card.classList.remove("kasp-lobby-has-art");
            artLayers.delete(card);
          }
          const left = Math.min(...measured.map((item) => item.rect.left));
          const top = Math.min(...measured.map((item) => item.rect.top));
          const right = Math.max(...measured.map((item) => item.rect.right));
          const bottom = Math.max(...measured.map((item) => item.rect.bottom));
          for (const { card, rect } of measured) {
            let layer = artLayers.get(card);
            if (layer?.parentElement !== card) {
              layer?.remove();
              layer = document.createElement("span");
              layer.className = "kasp-lobby-art-slice";
              layer.setAttribute("aria-hidden", "true");
              card.appendChild(layer);
              artLayers.set(card, layer);
            }
            setStyle(layer, "--kasp-art-image", artImage);
            const scaleX = card.offsetWidth ? rect.width / card.offsetWidth || 1 : 1;
            const scaleY = card.offsetHeight ? rect.height / card.offsetHeight || 1 : 1;
            const font = fontSize(layer);
            setStyle(layer, "--kasp-art-width", em((right - left) / scaleX, font));
            setStyle(layer, "--kasp-art-height", em((bottom - top) / scaleY, font));
            setStyle(layer, "--kasp-art-x", em(-(rect.left - left) / scaleX - card.clientLeft, font));
            setStyle(layer, "--kasp-art-y", em(-(rect.top - top) / scaleY - card.clientTop, font));
            if (!card.classList.contains("kasp-lobby-has-art")) card.classList.add("kasp-lobby-has-art");
          }
        }
        function progress(root, kind, value) {
          if (kind === "elite") setStyle(root, "--kasp-elite-meter-opacity", value === null ? "0" : "1");
          else setStyle(root, "--kasp-star-meter-display", value === null ? "none" : "block");
          if (value !== null) setStyle(root, `--kasp-${kind}-progress`, `${value}%`);
          else root.style.removeProperty(`--kasp-${kind}-progress`);
        }
        function coordinates(root, x, y) {
          const parent = root.offsetParent;
          if (!parent) return { x, y, scaleX: 1 };
          const rect = parent.getBoundingClientRect();
          const scaleX = parent.offsetWidth ? rect.width / parent.offsetWidth || 1 : 1;
          const scaleY = parent.offsetHeight ? rect.height / parent.offsetHeight || 1 : 1;
          return {
            x: (x - rect.left) / scaleX + parent.scrollLeft - parent.clientLeft,
            y: (y - rect.top) / scaleY + parent.scrollTop - parent.clientTop,
            scaleX
          };
        }
        function position(challenge, elite, trophies) {
          const rect = challenge.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const font = fontSize(challenge);
          const scaleY = challenge.offsetHeight ? rect.height / challenge.offsetHeight || 1 : 1;
          const gap = font * scaleY;
          let bottom = rect.bottom;
          if (elite) {
            const point = coordinates(elite, rect.left, rect.bottom + gap * 0.5), eliteFont = fontSize(elite);
            setStyle(elite, "--kasp-pass-left", em(point.x, eliteFont));
            setStyle(elite, "--kasp-pass-top", em(point.y, eliteFont));
            setStyle(elite, "--kasp-pass-width", em(rect.width / point.scaleX, eliteFont));
            bottom = elite.getBoundingClientRect().bottom;
          }
          if (trophiesParent !== challenge.parentElement) {
            restoreTrophies();
            trophiesParent = challenge.parentElement;
            for (const key of [TROPHY_TOP, TROPHY_LEFT, TROPHY_WIDTH]) previousTrophyStyles.set(key, {
              value: trophiesParent?.style.getPropertyValue(key) || "",
              priority: trophiesParent?.style.getPropertyPriority(key) || ""
            });
          }
          if (trophiesParent) {
            const point = coordinates(trophies || challenge, rect.left, bottom + gap);
            const trophiesFont = fontSize(trophies || trophiesParent);
            setStyle(trophiesParent, TROPHY_TOP, em(point.y, trophiesFont));
            setStyle(trophiesParent, TROPHY_LEFT, em(point.x, trophiesFont));
            setStyle(trophiesParent, TROPHY_WIDTH, em(rect.width / point.scaleX, trophiesFont));
          }
        }
        function schedule() {
          if (queued) return;
          queued = true;
          lifecycle12.microtask(() => {
            queued = false;
            sync();
          });
        }
        function sync() {
          if (!initialized2) {
            initialized2 = true;
            lifecycle12.listen(window, "resize", schedule);
            observer = lifecycle12.observer((changes) => {
              if (changes.some((change) => !(change.type === "attributes" && change.attributeName === "style" && sources.includes(change.target)))) schedule();
            });
            if (typeof ResizeObserver !== "undefined") resize = new ResizeObserver(lifecycle12.guard(schedule));
          }
          const challenge = document.querySelector(selectors.challenge), elite = document.querySelector(selectors.elite);
          const trophies = document.getElementById("custom-trophy-panel");
          const announcement = document.querySelector(selectors.announcement);
          sizeAnnouncement(announcement);
          const next = [challenge, elite, trophies, announcement].filter((root) => !!root);
          if (sources.length !== next.length || sources.some((root, index) => root !== next[index])) {
            observer?.disconnect();
            resize?.disconnect();
            sources = next;
            for (const root of sources) {
              observer?.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
              resize?.observe(root);
            }
          }
          for (const root of records.keys()) if (!next.includes(root)) release(root);
          const stars = challenge?.querySelector(selectors.stars)?.textContent?.trim();
          if (!challenge || !stars || !challenge.querySelector(selectors.tracks)) {
            for (const root of records.keys()) release(root);
            restoreTrophies();
            clearPanorama();
            return;
          }
          decorate(challenge, "challenge");
          progress(challenge, "star", readStarProgress(stars));
          let decoratedElite = null;
          if (elite && elite.querySelector(selectors.eliteLevel)) {
            decorate(elite, "elite");
            progress(elite, "elite", readCircleProgress(elite.querySelector(selectors.eliteCircle)));
            decoratedElite = elite;
          } else if (elite && records.has(elite)) release(elite);
          position(challenge, decoratedElite, trophies);
          paintPanorama(challenge, decoratedElite, trophies, announcement);
        }
        lifecycle12.onCleanup(() => {
          observer?.disconnect();
          resize?.disconnect();
          sources = [];
          announcementBody?.style.removeProperty(ANNOUNCEMENT_HEIGHT);
          announcementBody = null;
          for (const root of records.keys()) release(root);
          restoreTrophies();
          clearPanorama();
        });
        return sync;
      }, () => {
      });
    }
  });

  // src/modules/lobbyNavigation.ts
  var lifecycle13, lobbyNavigation;
  var init_lobbyNavigation = __esm({
    "src/modules/lobbyNavigation.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      lifecycle13 = featureScope("lobbyNavigation");
      lobbyNavigation = lifecycle13.initialize(() => {
        const cards = /* @__PURE__ */ new Map();
        let root = null, group = null;
        let hadRootClass = false, hadGroupClass = false;
        let initialized2 = false, queued = false;
        let observer = null, resize = null;
        let observed = [];
        const art = `url(${JSON.stringify(chrome.runtime.getURL("assets/art3.jpg"))})`;
        function releaseCard(card) {
          const record = cards.get(card);
          if (!record) return;
          record.layer.remove();
          if (!record.hadClass) card.classList.remove("kasp-left-card");
          cards.delete(card);
        }
        function release() {
          observer?.disconnect();
          resize?.disconnect();
          observed = [];
          for (const card of cards.keys()) releaseCard(card);
          if (!hadRootClass) root?.classList.remove("kasp-lobby-left");
          if (!hadGroupClass) group?.classList.remove("kasp-left-play-group");
          root = group = null;
        }
        function schedule() {
          if (queued) return;
          queued = true;
          lifecycle13.microtask(() => {
            queued = false;
            sync();
          });
        }
        function ownMutation(change) {
          if (change.target instanceof Element && change.target.classList.contains("kasp-left-art-slice")) return true;
          if (change.type !== "childList") return false;
          const nodes = [...Array.from(change.addedNodes), ...Array.from(change.removedNodes)];
          return nodes.length > 0 && nodes.every((node) => node instanceof Element && node.classList.contains("kasp-left-art-slice"));
        }
        function setStyle(element, name, value) {
          if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
        }
        function sync() {
          if (!initialized2) {
            initialized2 = true;
            lifecycle13.listen(window, "resize", schedule);
            observer = lifecycle13.observer((changes) => {
              if (changes.some((change) => !ownMutation(change))) schedule();
            });
            if (typeof ResizeObserver !== "undefined") resize = new ResizeObserver(lifecycle13.guard(schedule));
          }
          const nextRoot = document.querySelector(gameDOM.lobbyNavigation.root);
          const play = nextRoot?.querySelector(gameDOM.play.container);
          const nextGroup = play?.closest(gameDOM.common.flexDiv) ?? play?.parentElement ?? null;
          if (nextRoot !== root || nextGroup !== group) {
            release();
            root = nextRoot;
            group = nextGroup;
            hadRootClass = !!root?.classList.contains("kasp-lobby-left");
            hadGroupClass = !!group?.classList.contains("kasp-left-play-group");
          }
          if (!root) return;
          if (!root.classList.contains("kasp-lobby-left")) root.classList.add("kasp-lobby-left");
          if (group && !group.classList.contains("kasp-left-play-group")) group.classList.add("kasp-left-play-group");
          const current = Array.from(root.querySelectorAll(gameDOM.lobbyNavigation.cards));
          for (const card of cards.keys()) if (!current.includes(card)) releaseCard(card);
          for (const card of current) {
            const existing = cards.get(card);
            if (!existing) {
              const layer = document.createElement("span");
              layer.className = "kasp-left-art-slice";
              layer.setAttribute("aria-hidden", "true");
              cards.set(card, { layer, hadClass: card.classList.contains("kasp-left-card") });
              card.appendChild(layer);
            } else if (existing.layer.parentElement !== card) card.appendChild(existing.layer);
            if (!card.classList.contains("kasp-left-card")) card.classList.add("kasp-left-card");
          }
          const next = [root, ...group ? [group] : [], ...current];
          if (observed.length !== next.length || observed.some((node, i) => node !== next[i])) {
            observer?.disconnect();
            resize?.disconnect();
            observed = next;
            observer?.observe(root, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
              attributeFilter: ["class", "style"]
            });
            for (const node of next) resize?.observe(node);
          }
          const measured = current.map((card) => ({ card, rect: card.getBoundingClientRect() })).filter(({ rect }) => rect.width > 0 && rect.height > 0);
          if (!measured.length) return;
          const left = Math.min(...measured.map(({ rect }) => rect.left));
          const top = Math.min(...measured.map(({ rect }) => rect.top));
          const right = Math.max(...measured.map(({ rect }) => rect.right));
          const bottom = Math.max(...measured.map(({ rect }) => rect.bottom));
          for (const { card, rect } of measured) {
            const layer = cards.get(card).layer;
            const scaleX = card.offsetWidth ? rect.width / card.offsetWidth || 1 : 1;
            const scaleY = card.offsetHeight ? rect.height / card.offsetHeight || 1 : 1;
            setStyle(layer, "--kasp-left-art", art);
            setStyle(layer, "--kasp-left-art-width", `${(right - left) / scaleX}px`);
            setStyle(layer, "--kasp-left-art-height", `${(bottom - top) / scaleY}px`);
            setStyle(layer, "--kasp-left-art-x", `${-(rect.left - left) / scaleX - card.clientLeft}px`);
            setStyle(layer, "--kasp-left-art-y", `${-(rect.top - top) / scaleY - card.clientTop}px`);
          }
        }
        lifecycle13.onCleanup(release);
        return sync;
      }, () => {
      });
    }
  });

  // src/core/imageUrl.ts
  function getTankiImageUrl(value) {
    if (typeof value !== "string" || !value || value.length > 2048 || /[\s"'<>\\]/.test(value)) return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
      if (url.hostname !== "tankionline.com" && !url.hostname.endsWith(".tankionline.com")) return "";
      if (!/\.(svg|webp|png|jpe?g|gif|avif|ico)$/i.test(url.pathname)) return "";
      return url.href;
    } catch {
      return "";
    }
  }
  var init_imageUrl = __esm({
    "src/core/imageUrl.ts"() {
      "use strict";
    }
  });

  // src/modules/customTrophies.ts
  var lifecycle14, customTrophies;
  var init_customTrophies = __esm({
    "src/modules/customTrophies.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_accountIdentity();
      init_imageUrl();
      init_accountId();
      init_pageMessages();
      lifecycle14 = featureScope("customTrophies");
      customTrophies = lifecycle14.initialize(() => {
        let initialization = null;
        const STORAGE_PREFIX2 = "kasp_trophies_favorites_uid_";
        const ICON_UNFAV = "https://s.eu.tankionline.com/static/images/unfavoriteStar.0e39d67a.svg";
        const ICON_FAV = "https://s.eu.tankionline.com/static/images/favoriteStar.1ce58570.svg";
        let trophyDictionary = {};
        let trophyDictionaryLoaded = false;
        async function loadTrophyDictionary() {
          if (trophyDictionaryLoaded) return;
          try {
            const response = await fetch(chrome.runtime.getURL("database/trophies.json"));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            trophyDictionary = await response.json();
            trophyDictionaryLoaded = true;
          } catch (error) {
            console.error("[Kaspersky Inventions] Failed to load trophy dictionary:", error);
            trophyDictionary = {};
          }
        }
        let cachedFavs = null;
        let favoritesOwner = null;
        const presentedOwners = /* @__PURE__ */ new Set();
        function syncOwner() {
          const userId = getVerifiedAccount()?.userId || null;
          if (favoritesOwner !== userId) {
            cachedFavs = null;
            favoritesOwner = userId;
            document.getElementById("custom-trophy-panel")?.remove();
            document.querySelectorAll(gameDOM.trophies.favorite).forEach((star) => star.remove());
          }
          return userId;
        }
        function getFavs() {
          const userId = syncOwner();
          if (!userId) return [];
          if (cachedFavs) return cachedFavs;
          try {
            const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX2 + userId) || "[]");
            cachedFavs = Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 128 && ["turret", "hull"].includes(item.type) && typeof item.icon === "string" && Number.isFinite(item.current) && item.current >= 0 && Number.isFinite(item.max) && item.max > 0).slice(0, 4).map((item) => ({ ...item, icon: getTankiImageUrl(item.icon) })) : [];
          } catch {
            cachedFavs = [];
          }
          return cachedFavs || [];
        }
        function saveFavs(favs) {
          const owner = favoritesOwner;
          if (!owner || syncOwner() !== owner) return;
          cachedFavs = favs;
          localStorage.setItem(STORAGE_PREFIX2 + owner, JSON.stringify(favs));
        }
        function parseItem(rawText) {
          const lower = rawText.toLowerCase();
          for (const key in trophyDictionary) {
            if (lower.includes(key)) {
              const item = trophyDictionary[key];
              return {
                id: item.id,
                name: state.lang === "RU" ? item.ru : item.en,
                type: item.type
              };
            }
          }
          return null;
        }
        function formatNumber2(num) {
          return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        }
        function extractIcon(card) {
          const rewardDiv = card.querySelector(gameDOM.trophies.rewardImage);
          if (rewardDiv) {
            const bg = window.getComputedStyle(rewardDiv).backgroundImage;
            const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) return match[1];
          }
          return "https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg";
        }
        function toggleFavorite(itemId, type, iconUrl2, current, max) {
          let favs = getFavs();
          const idx = favs.findIndex((f) => f.id === itemId);
          if (idx > -1) {
            favs.splice(idx, 1);
          } else {
            const count = favs.filter((f) => f.type === type).length;
            if (count >= 2) return;
            favs.push({ id: itemId, type, icon: iconUrl2, current, max });
          }
          saveFavs(favs);
          const cards = document.querySelectorAll(gameDOM.trophies.cards);
          if (cards.length > 0) processGarageMissions(Array.from(cards));
        }
        function processGarageMissions(garageCards) {
          const owner = syncOwner();
          if (!owner) return;
          let favs = getFavs();
          let favsUpdated = false;
          const favTurrets = favs.filter((f) => f.type === "turret").length;
          const favHulls = favs.filter((f) => f.type === "hull").length;
          garageCards.forEach((card) => {
            const progressEl = card.querySelector("h4");
            if (!progressEl) return;
            const rawText = card.textContent || "";
            const itemInfo = parseItem(rawText);
            if (!itemInfo) return;
            const isGrid = card.classList.contains(gameDOM.classes.gridTrophy);
            card.style.position = "relative";
            if (isGrid) {
              card.classList.add("card-type-grid");
              card.classList.remove("card-type-list");
            } else {
              card.classList.add("card-type-list");
              card.classList.remove("card-type-grid");
            }
            const type = itemInfo.type;
            const cleanProgress = progressEl.textContent?.replace(/\s|\u00A0/g, "") || "";
            const parts = cleanProgress.split("/");
            const currentPoints = parseInt(parts[0], 10) || 0;
            const maxPoints = parseInt(parts[1], 10) || 5e6;
            const favItem = favs.find((f) => f.id === itemInfo.id);
            if (favItem && favItem.current !== currentPoints) {
              favItem.current = currentPoints;
              favItem.max = maxPoints;
              favsUpdated = true;
            }
            const limitReached = !favItem && (type === "turret" && favTurrets >= 2 || type === "hull" && favHulls >= 2);
            let starContainer = card.querySelector(gameDOM.trophies.favorite);
            if (!starContainer) {
              starContainer = document.createElement("div");
              starContainer.className = gameDOM.classes.favorite;
              starContainer.setAttribute("data-kasp-trophy-star", "");
              starContainer.innerHTML = `<img src="${favItem ? ICON_FAV : ICON_UNFAV}">`;
              card.appendChild(starContainer);
            } else {
              const img = starContainer.querySelector("img");
              const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
              if (img && img.src !== expectedIcon) img.src = expectedIcon;
            }
            starContainer.onclick = lifecycle14.guard((e) => {
              e.stopPropagation();
              if (syncOwner() !== owner || parseItem(card.textContent || "")?.id !== itemInfo.id) return;
              toggleFavorite(itemInfo.id, type, extractIcon(card), currentPoints, maxPoints);
            });
            if (limitReached) starContainer.classList.add("star-limit-reached");
            else starContainer.classList.remove("star-limit-reached");
          });
          if (favsUpdated) saveFavs(favs);
        }
        function processBattleResults(battleCards) {
          let favs = getFavs();
          let favsUpdated = false;
          battleCards.forEach((card) => {
            const textElements = card.querySelectorAll(gameDOM.trophies.resultText);
            if (textElements.length < 2) return;
            let rawText = "";
            let rawProgress = "";
            textElements.forEach((el) => {
              const text2 = el.textContent || "";
              const style = el.getAttribute("style") || "";
              if (text2.includes(" / ")) {
                if (!style.includes("opacity: 0")) rawProgress = text2;
              } else if (text2.length > 15 && !text2.includes("\u0412\u042B\u041F\u041E\u041B\u041D\u0415\u041D\u041E") && !text2.includes("COMPLETED")) {
                rawText = text2;
              }
            });
            if (!rawText || !rawProgress) return;
            const itemInfo = parseItem(rawText);
            if (!itemInfo) return;
            const cleanProgress = rawProgress.replace(/\s|\u00A0/g, "");
            const parts = cleanProgress.split("/");
            const currentPoints = parseInt(parts[0], 10) || 0;
            const maxPoints = parseInt(parts[1], 10) || 5e6;
            const favItem = favs.find((f) => f.id === itemInfo.id);
            if (favItem && favItem.current !== currentPoints) {
              favItem.current = currentPoints;
              favItem.max = maxPoints;
              favsUpdated = true;
            }
          });
          if (favsUpdated) saveFavs(favs);
        }
        function createPanel() {
          const panel = document.createElement("div");
          panel.id = "custom-trophy-panel";
          panel.className = "custom-trophy-panel";
          const trophies = [...getFavs()];
          trophies.sort((a, b) => {
            if (a.type === "turret" && b.type === "hull") return -1;
            if (a.type === "hull" && b.type === "turret") return 1;
            return 0;
          });
          trophies.forEach((trophy) => {
            const percent = Math.min(100, Math.max(0, trophy.current / trophy.max * 100));
            const match = Object.values(trophyDictionary).find((d) => d.id === trophy.id);
            const displayName = match ? state.lang === "RU" ? match.ru : match.en : trophy.id;
            const item = document.createElement("div");
            item.className = "custom-trophy-item";
            const info = document.createElement("div");
            info.className = "custom-trophy-info";
            const title = document.createElement("div");
            title.className = "custom-trophy-title";
            title.textContent = displayName;
            const percentage = document.createElement("div");
            percentage.className = "custom-trophy-percent";
            percentage.textContent = `${Math.floor(percent)}%`;
            const bar = document.createElement("div");
            bar.className = "custom-trophy-bar-bg";
            const fill = document.createElement("div");
            fill.className = "custom-trophy-bar-fill";
            fill.style.width = `${percent}%`;
            bar.appendChild(fill);
            const progress = document.createElement("div");
            progress.className = "custom-trophy-text";
            const current = document.createElement("span");
            current.textContent = formatNumber2(trophy.current);
            const target = document.createElement("span");
            target.textContent = `/ ${formatNumber2(trophy.max)}`;
            progress.append(current, target);
            info.append(title, percentage, bar, progress);
            item.appendChild(info);
            panel.appendChild(item);
          });
          return panel;
        }
        function updateInterface() {
          const challengesBlock = document.querySelector(gameDOM.trophies.lobbyAnchor);
          const panel = document.getElementById("custom-trophy-panel");
          if (challengesBlock) {
            const key = JSON.stringify([favoritesOwner, state.lang, getFavs()]);
            if (getFavs().length === 0) panel?.remove();
            else if (challengesBlock.parentElement && (!panel || panel.dataset.trophiesKey !== key)) {
              const replacement = createPanel();
              if (!panel && state.currentScreen === "lobby" && favoritesOwner && !presentedOwners.has(favoritesOwner))
                replacement.className += " kasp-lobby-reveal";
              if (favoritesOwner) presentedOwners.add(favoritesOwner);
              replacement.dataset.trophiesKey = key;
              if (panel) panel.replaceWith(replacement);
              else challengesBlock.parentElement.appendChild(replacement);
            }
          } else {
            if (panel) panel.remove();
          }
          const cards = document.querySelectorAll(gameDOM.trophies.cards);
          if (cards.length > 0) processGarageMissions(Array.from(cards));
        }
        lifecycle14.onCleanup(() => {
          cachedFavs = null;
          favoritesOwner = null;
          document.querySelectorAll(".custom-trophy-panel, [data-kasp-trophy-star]").forEach((node) => node.remove());
        });
        const update = async () => {
          const owner = syncOwner();
          if (!initialization) initialization = loadTrophyDictionary();
          await initialization;
          if (lifecycle14.disabled) return;
          if (!trophyDictionaryLoaded || !owner || syncOwner() !== owner) return;
          if (state.currentScreen === "lobby" || state.currentScreen === "garage") {
            updateInterface();
          } else if (state.currentScreen === "match_results") {
            const battleCards = document.querySelectorAll(gameDOM.trophies.resultCards);
            if (battleCards.length > 0) processBattleResults(Array.from(battleCards));
          }
        };
        initialization = loadTrophyDictionary();
        let identityUpdate = null;
        lifecycle14.listen(window, "message", (event) => {
          if (!readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE) || identityUpdate !== null) return;
          identityUpdate = lifecycle14.timeout(() => {
            identityUpdate = null;
            if ((getVerifiedAccount()?.userId || null) !== favoritesOwner) return update();
          }, 0);
        });
        return update;
      }, () => {
      });
    }
  });

  // src/core/modal.ts
  var pendingModalIds, createKaspModal;
  var init_modal = __esm({
    "src/core/modal.ts"() {
      "use strict";
      pendingModalIds = /* @__PURE__ */ new Set();
      createKaspModal = async (options) => {
        if (document.getElementById(options.id) || pendingModalIds.has(options.id)) return null;
        pendingModalIds.add(options.id);
        try {
          const response = await fetch(chrome.runtime.getURL("templates/modal.html"));
          if (!response.ok) throw new Error(`Modal template request failed: ${response.status}`);
          const template = document.createElement("template");
          template.innerHTML = await response.text();
          const overlay = template.content.firstElementChild;
          if (!overlay) throw new Error("Modal template is empty");
          overlay.id = options.id;
          const dialog = overlay.querySelector("[data-kasp-modal-dialog]");
          const title = overlay.querySelector("[data-kasp-modal-title]");
          const closeButton = overlay.querySelector("[data-kasp-modal-close]");
          const body = overlay.querySelector("[data-kasp-modal-body]");
          const actions = overlay.querySelector("[data-kasp-modal-actions]");
          if (!dialog || !title || !closeButton || !body || !actions) {
            throw new Error("Modal template is missing required elements");
          }
          title.id = `${options.id}-title`;
          dialog.setAttribute("aria-labelledby", title.id);
          title.textContent = options.title;
          closeButton.setAttribute("aria-label", options.closeLabel);
          let isClosing = false;
          let isRemoved = false;
          let removeTimer = 0;
          const closeListeners = /* @__PURE__ */ new Set();
          const cleanup = () => {
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("mousedown", onMouseDown, true);
          };
          const removeOverlay = () => {
            if (isRemoved) return;
            isRemoved = true;
            window.clearTimeout(removeTimer);
            dialog.removeEventListener("animationend", onDialogAnimationEnd);
            overlay.remove();
          };
          const onDialogAnimationEnd = (event) => {
            if (event.target === dialog) removeOverlay();
          };
          const close = () => {
            if (isClosing) return;
            isClosing = true;
            cleanup();
            overlay.classList.remove("kasp-modal-opening");
            overlay.classList.add("kasp-modal-closing");
            for (const listener of closeListeners) listener();
            closeListeners.clear();
            dialog.addEventListener("animationend", onDialogAnimationEnd);
            removeTimer = window.setTimeout(removeOverlay, 260);
          };
          const onKeyDown = (event) => {
            const isEscape = event.key === "Escape" || event.key === "Esc";
            const isZ = event.code === "KeyZ" || event.key?.toLowerCase() === "z";
            const activeTag = document.activeElement?.tagName;
            if (isZ && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag || "")) return;
            const isBackKey = isEscape || isZ;
            if (!isBackKey) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            close();
          };
          const blockRemainingBackEvents = () => {
            const block = (event) => {
              if (event.button !== 3 && event.button !== 4) return;
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
            };
            window.addEventListener("mouseup", block, true);
            window.addEventListener("click", block, true);
            window.addEventListener("auxclick", block, true);
            window.setTimeout(() => {
              window.removeEventListener("mouseup", block, true);
              window.removeEventListener("click", block, true);
              window.removeEventListener("auxclick", block, true);
            }, 700);
          };
          const onMouseDown = (event) => {
            if (event.button !== 3 && event.button !== 4) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (event.button === 3) close();
            blockRemainingBackEvents();
          };
          closeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            close();
          });
          dialog.addEventListener("mousedown", (event) => event.stopPropagation());
          dialog.addEventListener("click", (event) => event.stopPropagation());
          overlay.addEventListener("mousedown", (event) => {
            if (event.target !== overlay) return;
            event.preventDefault();
            event.stopPropagation();
            close();
          });
          document.addEventListener("keydown", onKeyDown, true);
          window.addEventListener("mousedown", onMouseDown, true);
          overlay.closeDialogMethod = close;
          document.body.appendChild(overlay);
          return {
            overlay,
            dialog,
            body,
            actions,
            closeButton,
            close,
            onClose: (listener) => {
              if (isClosing) listener();
              else closeListeners.add(listener);
            }
          };
        } finally {
          pendingModalIds.delete(options.id);
        }
      };
    }
  });

  // src/modules/autoUpgrade.ts
  var lifecycle15, autoUpgrade;
  var init_autoUpgrade = __esm({
    "src/modules/autoUpgrade.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_utils();
      init_modal();
      lifecycle15 = featureScope("autoUpgrade");
      autoUpgrade = lifecycle15.initialize(() => {
        let initialized2 = false;
        let isRunning = false;
        let upgradeQueue = 0;
        let unavailableRetries = 0;
        const MAX_UNAVAILABLE_RETRIES = 80;
        const RETRY_DELAY = 100;
        let upgraded = 0;
        let timer = null;
        let inputFrame = null;
        let pressedGamepadButtons = /* @__PURE__ */ new Set();
        let activationEvent;
        let lastItemSignature = "";
        let isCategorySwitch = true;
        let categorySwitchTimeout = null;
        const DELAY = 30;
        function stopOnInput(event) {
          if (isRunning && event.isTrusted && event !== activationEvent) finish();
        }
        function gamepadButtons() {
          const pressed = /* @__PURE__ */ new Set();
          try {
            for (const pad of navigator.getGamepads()) {
              if (!pad || !pad.connected) continue;
              pad.buttons.forEach((button, index) => {
                if (button.pressed) pressed.add(`${pad.index}:${index}`);
              });
            }
          } catch {
          }
          return pressed;
        }
        function checkGamepadInput() {
          const current = gamepadButtons();
          const newlyPressed = [...current].some((button) => !pressedGamepadButtons.has(button));
          pressedGamepadButtons = current;
          if (isRunning && newlyPressed) finish();
        }
        function watchInput(event) {
          activationEvent = event;
          pressedGamepadButtons = gamepadButtons();
          for (const type of ["keydown", "pointerdown", "mousedown", "click"]) {
            lifecycle15.listen(document, type, stopOnInput, true);
          }
          const poll = () => {
            inputFrame = null;
            if (!isRunning) return;
            checkGamepadInput();
            if (isRunning) inputFrame = lifecycle15.frame(poll);
          };
          inputFrame = lifecycle15.frame(poll);
        }
        function finish() {
          isRunning = false;
          upgradeQueue = 0;
          unavailableRetries = 0;
          if (timer !== null) {
            lifecycle15.cancelTimeout(timer);
            timer = null;
          }
          if (inputFrame !== null) {
            lifecycle15.cancelFrame(inputFrame);
            inputFrame = null;
          }
          for (const type of ["keydown", "pointerdown", "mousedown", "click"]) {
            lifecycle15.unlisten(document, type, stopOnInput, true);
          }
          activationEvent = void 0;
          pressedGamepadButtons.clear();
        }
        function pressEnter() {
          const event = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(event);
          return true;
        }
        function isDialogOpen() {
          return !!document.querySelector(gameDOM.dialogs.container);
        }
        function isRubyButton() {
          const dialog = document.querySelector(gameDOM.dialogs.container);
          if (dialog) {
            const headerText = dialog.querySelector("h1")?.textContent?.toLowerCase() || "";
            if (headerText.includes("\u0440\u0443\u0431\u0438\u043D") || headerText.includes("ruby")) return true;
          }
          const btn = document.querySelector(gameDOM.dialogs.confirmation);
          if (!btn) return false;
          const text2 = btn.textContent?.toLowerCase() || "";
          if (text2.includes("\u0437\u0430 ") || text2.includes("for ") || text2.includes("\u0440\u0443\u0431\u0438\u043D") || text2.includes("ruby") || text2.includes("\u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C") || text2.includes("get")) return true;
          const rubyImg = btn.querySelector(gameDOM.dialogs.rubyImage);
          if (rubyImg) return true;
          return false;
        }
        function hasNormalButton() {
          const btn = document.querySelector(gameDOM.dialogs.confirmation);
          if (!btn) return false;
          return !isRubyButton();
        }
        function clickConfirmButton() {
          const btn = document.querySelector(gameDOM.dialogs.confirmation);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        function clickCancel() {
          const buttons = document.querySelectorAll(gameDOM.dialogs.contents);
          for (let i = 0; i < buttons.length; i++) {
            const el = buttons[i];
            const text2 = el.textContent?.trim().toLowerCase() || "";
            if (text2 === "\u043E\u0442\u043C\u0435\u043D\u0430" || text2 === "cancel") {
              el.click();
              return true;
            }
          }
          const btn = document.querySelector(gameDOM.dialogs.cancelKey);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        function isCompleted() {
          const btns = document.querySelectorAll(gameDOM.garage.priceButton);
          for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            const span = btn.querySelector(gameDOM.common.boldSpan);
            if (span) {
              const text2 = span.textContent?.trim().toUpperCase() || "";
              if (text2 === "\u0417\u0410\u0412\u0415\u0420\u0428\u0415\u041D\u041E" || text2 === "COMPLETED") return true;
            }
          }
          return false;
        }
        function isUnavailableButton() {
          const btns = document.querySelectorAll(gameDOM.garage.priceButton);
          for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            if (btn.closest(gameDOM.garage.mountContainer))
              continue;
            const text2 = (btn.textContent || "").toLowerCase();
            if (text2.includes("\u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E") || text2.includes("unavailable"))
              return true;
          }
          return false;
        }
        function isMaxLevel() {
          if (document.querySelector(gameDOM.garage.established)) return true;
          const titleNodes = document.querySelectorAll(gameDOM.garage.upgradeTitles);
          for (let i = 0; i < titleNodes.length; i++) {
            const text2 = titleNodes[i].textContent?.trim().toUpperCase() || "";
            if (/(MK|МК)7[- ]?20/.test(text2)) return true;
            if (/(УР|LVL)[- ]?(20|45)/.test(text2)) return true;
            if (text2.includes("MAX")) return true;
          }
          const maxBtn = document.querySelector(gameDOM.garage.maxPriceTitle);
          if (maxBtn && maxBtn.textContent?.trim().toUpperCase() === "MAX") return true;
          return false;
        }
        function shouldShowQuickButtons() {
          if (!utils.getSetting("k_auto_upgrade", false)) return false;
          if (isMaxLevel()) return false;
          if (isCompleted()) return false;
          const buttonsContainer = document.querySelector(gameDOM.garage.actionContainer);
          if (!buttonsContainer) return false;
          const btns = buttonsContainer.querySelectorAll(gameDOM.garage.priceButton);
          for (let i = 0; i < btns.length; i++) {
            const btn = btns[i];
            if (btn.closest(gameDOM.garage.mountContainer)) continue;
            const hotkey = btn.querySelector(gameDOM.common.hotkey);
            if (hotkey && hotkey.textContent?.trim() === "Enter") {
              if (btn.classList.contains(gameDOM.classes.wideGarageButton)) {
                const coinIcon = btn.querySelector(gameDOM.garage.coinIcon);
                if (coinIcon) {
                  const bgImage = window.getComputedStyle(coinIcon).backgroundImage;
                  if (!bgImage.includes("ruby")) return true;
                }
              }
            }
          }
          return false;
        }
        async function showConfirmDialog(count, callback) {
          const lang = state.lang;
          const t = {
            RU: { title: "\u0411\u042B\u0421\u0422\u0420\u0410\u042F \u041F\u0420\u041E\u041A\u0410\u0427\u041A\u0410", textPre: "\u0412\u044B \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442\u0435\u0441\u044C \u043A\u0443\u043F\u0438\u0442\u044C \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435 \u043D\u0430\xA0", steps: " \u0448\u0430\u0433\u043E\u0432", maxSteps: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0448\u0430\u0433\u043E\u0432", cancel: "\u041E\u0442\u043C\u0435\u043D\u0430", buy: "\u041A\u0423\u041F\u0418\u0422\u042C" },
            EN: { title: "FAST UPGRADE", textPre: "You are about to buy an upgrade for\xA0", steps: " steps", maxSteps: "max steps", cancel: "Cancel", buy: "BUY" }
          };
          const dict = t[lang] || t["EN"];
          const label = count === Infinity ? dict.maxSteps : `${count}${dict.steps}`;
          const modal = await createKaspModal({ id: "quick-upgrade-overlay", title: dict.title, closeLabel: dict.cancel });
          if (!modal) return;
          modal.dialog.id = "quick-upgrade-dialog";
          modal.body.classList.add("kasp-modal-body--center");
          modal.actions.classList.add("kasp-modal-actions--center");
          const textLine = document.createElement("p");
          textLine.className = "kasp-modal-copy kasp-modal-copy--center";
          const textSpan = document.createElement("span");
          textSpan.textContent = dict.textPre;
          const countSpan = document.createElement("strong");
          countSpan.className = "kasp-modal-emphasis";
          countSpan.textContent = label;
          textLine.append(textSpan, countSpan);
          modal.body.appendChild(textLine);
          const cancelBtn = document.createElement("button");
          cancelBtn.type = "button";
          cancelBtn.className = "kasp-modal-button kasp-modal-button--secondary";
          const cancelLabel = document.createElement("span");
          cancelLabel.textContent = dict.cancel;
          cancelBtn.appendChild(cancelLabel);
          const confirmBtn = document.createElement("button");
          confirmBtn.type = "button";
          confirmBtn.className = "kasp-modal-button";
          const confirmLabel = document.createElement("span");
          confirmLabel.textContent = dict.buy;
          confirmBtn.appendChild(confirmLabel);
          modal.actions.append(cancelBtn, confirmBtn);
          let isClosing = false;
          const closeDialog = () => {
            if (isClosing) return;
            isClosing = true;
            modal.close();
          };
          modal.onClose(() => {
            isClosing = true;
            lifecycle15.unlisten(document, "keydown", onKeyDown, true);
            lifecycle15.timeout(() => lifecycle15.unlisten(document, "keyup", onKeyUp, true), 700);
          });
          const onKeyDown = (event) => {
            if (event.key !== "Enter" || isClosing) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeDialog();
            callback(event);
          };
          const onKeyUp = (event) => {
            if (event.key === "Enter" || event.key === "Escape" || event.code === "KeyZ" || event.key?.toLowerCase() === "z") {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
            }
          };
          lifecycle15.listen(confirmBtn, "click", (event) => {
            if (isClosing) return;
            closeDialog();
            callback(event);
          });
          lifecycle15.listen(cancelBtn, "click", closeDialog);
          lifecycle15.listen(document, "keydown", onKeyDown, true);
          lifecycle15.listen(document, "keyup", onKeyUp, true);
        }
        function performAction(count) {
          if (isRunning) return;
          if (!shouldShowQuickButtons()) return;
          showConfirmDialog(count, (event) => {
            isRunning = true;
            upgradeQueue = count;
            upgraded = 0;
            watchInput(event);
            let isWaitingForDialogClose = false;
            function doStep() {
              if (isRunning) checkGamepadInput();
              if (!isRunning) {
                finish();
                return;
              }
              if (isWaitingForDialogClose) {
                if (isDialogOpen()) {
                  timer = lifecycle15.timeout(doStep, DELAY);
                  return;
                }
                isWaitingForDialogClose = false;
              }
              if (isMaxLevel()) {
                finish();
                return;
              }
              if (isCompleted() && !isDialogOpen()) {
                finish();
                return;
              }
              if (!shouldShowQuickButtons() && !isDialogOpen()) {
                if (unavailableRetries < MAX_UNAVAILABLE_RETRIES) {
                  unavailableRetries++;
                  timer = lifecycle15.timeout(doStep, RETRY_DELAY);
                  return;
                }
                finish();
                return;
              }
              unavailableRetries = 0;
              if (upgraded >= upgradeQueue) {
                finish();
                return;
              }
              if (isDialogOpen()) {
                if (isRubyButton()) {
                  clickCancel();
                  finish();
                  return;
                }
                if (hasNormalButton()) {
                  if (!clickConfirmButton()) {
                    finish();
                    return;
                  }
                  upgraded++;
                  isWaitingForDialogClose = true;
                  timer = lifecycle15.timeout(doStep, DELAY);
                  return;
                }
                finish();
                return;
              }
              pressEnter();
              timer = lifecycle15.timeout(doStep, DELAY);
            }
            timer = lifecycle15.timeout(doStep, DELAY);
          });
        }
        function createButtons() {
          const containerNode = document.querySelector(gameDOM.garage.actionContainer);
          const panel = containerNode?.parentNode;
          if (!panel) return;
          if (!shouldShowQuickButtons()) {
            const existing = document.getElementById("quick-buttons");
            if (existing) existing.remove();
            return;
          }
          if (document.getElementById("quick-buttons")) return;
          const quickButtonsWrapper = document.createElement("div");
          quickButtonsWrapper.id = "quick-buttons";
          if (typeof isCategorySwitch !== "undefined" && isCategorySwitch) {
            quickButtonsWrapper.className = gameDOM.classes.upgradeTransition;
          }
          quickButtonsWrapper.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3em; margin-top: 0.28em; width: 100%; margin-left: 0.12em; box-sizing: border-box;`;
          const buttons = [
            { label: "X5", value: 5 },
            { label: "X10", value: 10 },
            { label: "X15", value: 15 },
            { label: "MAX", value: Infinity }
          ];
          const tooltipMax = state.lang === "RU" ? "\u041F\u0440\u043E\u043A\u0430\u0447\u0430\u0442\u044C \u0434\u043E \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C\u0430" : "Upgrade to max";
          const tooltipSteps = state.lang === "RU" ? "\u041F\u0440\u043E\u043A\u0430\u0447\u0430\u0442\u044C {n} \u0440\u0430\u0437" : "Upgrade {n} times";
          buttons.forEach((btn) => {
            const el = document.createElement("div");
            el.className = gameDOM.classes.upgradeButton;
            el.style.cssText = `cursor: pointer; background-color: rgb(218, 218, 218) !important; transition: background-color 0.2s, box-shadow 0.2s; box-shadow: rgba(255, 255, 255, 0.25) 0em 0em 0em 0.063em; border-radius: 0.75em; display: flex; min-width: 0; align-items: center; justify-content: center; height: 3em; box-sizing: border-box;`;
            lifecycle15.listen(el, "mouseenter", () => {
              el.style.backgroundColor = "rgb(197, 197, 197)";
              el.style.boxShadow = "rgb(255, 255, 255) 0em 0em 0em 1.4px";
            });
            lifecycle15.listen(el, "mouseleave", () => {
              el.style.backgroundColor = "rgb(218, 218, 218)";
              el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0em 0em 0em 0.063em";
            });
            const span = document.createElement("span");
            span.style.cssText = `color: rgb(0, 0, 0) !important; font-size: 1.3em; font-family: BaseFontBold, FallbackFontBold; font-weight: bold; white-space: nowrap;`;
            span.textContent = btn.label;
            el.appendChild(span);
            el.title = btn.value === Infinity ? tooltipMax : tooltipSteps.replace("{n}", btn.value.toString());
            lifecycle15.listen(el, "click", (e) => {
              e.stopPropagation();
              if (typeof isRunning !== "undefined" && !isRunning) performAction(btn.value);
            });
            quickButtonsWrapper.appendChild(el);
          });
          panel.appendChild(quickButtonsWrapper);
        }
        lifecycle15.onCleanup(() => {
          finish();
          if (categorySwitchTimeout !== null) lifecycle15.cancelTimeout(categorySwitchTimeout);
          const overlay = document.getElementById("quick-upgrade-overlay");
          overlay?.closeDialogMethod?.();
          document.getElementById("quick-buttons")?.remove();
        });
        return () => {
          if (!utils.getSetting("k_auto_upgrade", false)) return;
          if (state.currentScreen !== "garage") return;
          if (!initialized2) {
            initialized2 = true;
            categorySwitchTimeout = lifecycle15.timeout(() => {
              isCategorySwitch = false;
            }, 2e3);
            lifecycle15.listen(document, "click", (e) => {
              const target = e.target;
              if (!(target instanceof Element))
                return;
              if (target.closest("#quick-upgrade-overlay"))
                return;
              let menuCategory = target.closest(gameDOM.navigation.garageCategory);
              if (menuCategory && menuCategory.classList.contains(gameDOM.classes.activeMenu)) {
                menuCategory = null;
              }
              const mainGarageBlock = target.closest(gameDOM.navigation.mountedBlock);
              const itemElement = target.closest(gameDOM.navigation.equipmentItem);
              const backButton = target.closest(gameDOM.navigation.backControls);
              if (menuCategory || mainGarageBlock || backButton) {
                isCategorySwitch = true;
                if (categorySwitchTimeout) lifecycle15.cancelTimeout(categorySwitchTimeout);
                categorySwitchTimeout = lifecycle15.timeout(() => {
                  isCategorySwitch = false;
                }, 1e3);
              } else if (itemElement) {
                isCategorySwitch = false;
                if (categorySwitchTimeout) lifecycle15.cancelTimeout(categorySwitchTimeout);
              }
              if (menuCategory || mainGarageBlock || itemElement || backButton) {
                if (isRunning) finish();
                lastItemSignature = "";
                const existing = document.getElementById("quick-buttons");
                if (existing) existing.remove();
                lifecycle15.timeout(createButtons, 10);
              }
            }, true);
            lifecycle15.listen(document, "keydown", (e) => {
              if (document.getElementById("quick-upgrade-overlay")) return;
              if (e.key === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
                isCategorySwitch = true;
                if (categorySwitchTimeout) lifecycle15.cancelTimeout(categorySwitchTimeout);
                categorySwitchTimeout = lifecycle15.timeout(() => {
                  isCategorySwitch = false;
                }, 1e3);
                lastItemSignature = "";
              }
            }, true);
            lifecycle15.listen(document, "mousedown", (e) => {
              if (document.getElementById("quick-upgrade-overlay")) return;
              if (e.button === 3 || e.button === 4) {
                isCategorySwitch = true;
                if (categorySwitchTimeout) lifecycle15.cancelTimeout(categorySwitchTimeout);
                categorySwitchTimeout = lifecycle15.timeout(() => {
                  isCategorySwitch = false;
                }, 1e3);
                lastItemSignature = "";
              }
            }, true);
          }
          const loader = document.querySelector(gameDOM.screens.loadingBackground);
          if (loader) {
            const overlay = document.getElementById("quick-upgrade-overlay");
            if (overlay && overlay.closeDialogMethod) overlay.closeDialogMethod();
          }
          if (document.getElementById("quick-upgrade-overlay")) return;
          const container = document.querySelector(gameDOM.garage.actionContainer);
          const nameElement = document.querySelector(gameDOM.garage.itemName) || container;
          if (container) {
            const currentSignature = nameElement ? nameElement.textContent?.trim() || "" : "";
            if (currentSignature !== lastItemSignature) {
              lastItemSignature = currentSignature;
              const existing = document.getElementById("quick-buttons");
              if (existing) existing.remove();
            }
            if (shouldShowQuickButtons()) {
              if (!document.getElementById("quick-buttons")) createButtons();
            } else {
              const existing = document.getElementById("quick-buttons");
              if (existing) existing.remove();
            }
          } else {
            const existing = document.getElementById("quick-buttons");
            if (existing) existing.remove();
          }
        };
      }, () => {
      });
    }
  });

  // src/modules/changeCounter.ts
  var lifecycle16, changeCounter;
  var init_changeCounter = __esm({
    "src/modules/changeCounter.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_pageMessages();
      lifecycle16 = featureScope("changeCounter");
      changeCounter = lifecycle16.initialize(() => {
        const CACHE_KEY = "kasp_player_changes_cache";
        const playerChanges = /* @__PURE__ */ new Map();
        let isUpdating = false;
        let isInBattle = false;
        try {
          const cached = sessionStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            for (const [nick, count] of Object.entries(parsed)) {
              playerChanges.set(nick, count);
            }
          }
        } catch (e) {
        }
        const saveCache = () => {
          const obj = {};
          playerChanges.forEach((count, nick) => {
            obj[nick] = count;
          });
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
        };
        const clearCache = () => {
          playerChanges.clear();
          sessionStorage.removeItem(CACHE_KEY);
        };
        lifecycle16.listen(window, "message", (e) => {
          const message = readPageMessage(e, window, "kasp:battle-kind");
          if (message) window.__kaspBattleKind = message.detail;
        });
        lifecycle16.listen(window, "message", (e) => {
          const message = readPageMessage(e, window, "kasp:useraction");
          if (!message || message.detail[2] !== "CHANGE_EQUIPMENT") return;
          const detail = message.detail;
          const nickname = detail[1];
          if (!nickname) return;
          playerChanges.set(nickname, (playerChanges.get(nickname) ?? 0) + 1);
          saveCache();
          if (document.querySelector(gameDOM.statistics.container)) {
            update();
          }
        });
        lifecycle16.listen(document, "kasp:battle:id", () => {
          clearCache();
          update();
        });
        function checkBattleCanvas() {
          const currentInBattle = !!document.querySelector(gameDOM.screens.battleCanvas);
          if (currentInBattle !== isInBattle) {
            isInBattle = currentInBattle;
            if (!isInBattle) {
              clearCache();
              update();
            }
          }
        }
        function sync() {
          const container = document.querySelector(gameDOM.statistics.container);
          if (!container) return;
          const headerRows = container.querySelectorAll("table > thead > tr");
          for (let i = 0; i < headerRows.length; i++) {
            const row = headerRows[i];
            if (!row.querySelector(".kasp-change-th")) {
              const th = document.createElement("th");
              th.className = "kasp-change-th";
              th.innerHTML = "<div></div>";
              row.appendChild(th);
            }
          }
          const bodyRows = container.querySelectorAll("table > tbody > tr");
          for (let i = 0; i < bodyRows.length; i++) {
            const row = bodyRows[i];
            let td = row.querySelector(".kasp-change-td");
            if (!td) {
              td = document.createElement("td");
              td.className = "kasp-change-td";
              row.appendChild(td);
            }
            const cell = row.querySelector(gameDOM.statistics.nickname);
            if (!cell) continue;
            const nickname = (cell.textContent || "").replace(/^\[.*?\]\s*/, "").trim();
            if (!nickname) continue;
            const count = playerChanges.get(nickname) ?? 0;
            const hasClass = td.classList.contains("kasp-changed");
            if (count > 0 && !hasClass) td.classList.add("kasp-changed");
            else if (count === 0 && hasClass) td.classList.remove("kasp-changed");
          }
        }
        function update() {
          sync();
        }
        lifecycle16.onCleanup(() => {
          document.querySelectorAll(".kasp-change-th, .kasp-change-td").forEach((node) => node.remove());
        });
        return {
          onTick: () => {
            checkBattleCanvas();
          },
          sync,
          update
        };
      }, { onTick() {
      }, sync() {
      }, update() {
      } });
    }
  });

  // src/modules/customGarageSkins.ts
  var lifecycle17, customGarageSkins;
  var init_customGarageSkins = __esm({
    "src/modules/customGarageSkins.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_accountIdentity();
      init_gameAugments();
      init_imageUrl();
      lifecycle17 = featureScope("customGarageSkins");
      customGarageSkins = lifecycle17.initialize(() => {
        const STORAGE_PREFIX2 = "kasp_equipped_skins_uid_";
        const BASE_IMG_KEY = "kasp_base_images";
        let ownerId = null;
        let NAME_TRANSLATE = null;
        let PREFILLED_DEFAULTS = null;
        let dataReadyPromise = null;
        const parsedStorage = /* @__PURE__ */ new Map();
        let cssInputs = null;
        function loadSkinsData() {
          if (dataReadyPromise) return dataReadyPromise;
          dataReadyPromise = fetch(chrome.runtime.getURL("database/skins.json")).then((res) => {
            if (!res.ok) throw new Error("skins.json: HTTP " + res.status);
            return res.json();
          }).then((data) => {
            NAME_TRANSLATE = data.names;
            PREFILLED_DEFAULTS = data.defaults;
            console.log("[KI-test][garage-skins] database loaded");
          }).catch((e) => console.error("[KI-test][garage-skins] failed to load database/skins.json:", e));
          return dataReadyPromise;
        }
        loadSkinsData();
        function safeParseJSON(raw) {
          if (!raw) return null;
          if (parsedStorage.has(raw)) return parsedStorage.get(raw);
          try {
            const value = JSON.parse(raw);
            if (parsedStorage.size >= 3) parsedStorage.clear();
            parsedStorage.set(raw, value);
            return value;
          } catch (e) {
            return null;
          }
        }
        function getSavedSkins() {
          if (!ownerId) return {};
          const stored = safeParseJSON(localStorage.getItem(STORAGE_PREFIX2 + ownerId));
          if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
          return Object.fromEntries(Object.entries(stored).filter((entry) => typeof entry[1] === "string" && SAFE_ART_URL.test(entry[1])));
        }
        function getDefaultImages() {
          try {
            const stored = safeParseJSON(localStorage.getItem(BASE_IMG_KEY)) || {};
            const merged = {};
            for (const key in PREFILLED_DEFAULTS) {
              merged[key] = [PREFILLED_DEFAULTS[key]];
            }
            for (const key in stored) {
              if (!merged[key]) merged[key] = [];
              const val = stored[key];
              if (Array.isArray(val)) {
                val.forEach((v) => {
                  const url = getTankiImageUrl(v);
                  if (url && !merged[key].includes(url)) merged[key].push(url);
                });
              } else if (val) {
                const url = getTankiImageUrl(val);
                if (url && !merged[key].includes(url)) merged[key].push(url);
              }
            }
            return merged;
          } catch (e) {
            const fallback = {};
            for (const key in PREFILLED_DEFAULTS) fallback[key] = [PREFILLED_DEFAULTS[key]];
            return fallback;
          }
        }
        function updateGlobalCSS() {
          const inputs = {
            owner: ownerId,
            skins: ownerId ? localStorage.getItem(STORAGE_PREFIX2 + ownerId) : null,
            bases: localStorage.getItem(BASE_IMG_KEY)
          };
          if (cssInputs && cssInputs.owner === inputs.owner && cssInputs.skins === inputs.skins && cssInputs.bases === inputs.bases && document.getElementById("kasp-skins-global-css")) return;
          const savedSkins = getSavedSkins();
          const defaultImages = getDefaultImages();
          let css = "";
          for (const item of Object.keys(defaultImages)) {
            const targetUrl = savedSkins[item];
            if (!targetUrl) continue;
            const finalUrls = defaultImages[item].filter((url) => url !== targetUrl);
            if (finalUrls.length > 0) {
              const selectors2 = finalUrls.map(
                (url) => gameDOM.garage.skinArt.map((selector) => `${selector}[src="${url}"]`).join(", ")
              ).join(",\n");
              css += `${selectors2} {
    content: url("${targetUrl}") !important;
    object-fit: contain !important;
    pointer-events: none !important;
}

`;
            }
          }
          let styleEl = document.getElementById("kasp-skins-global-css");
          if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "kasp-skins-global-css";
            document.head.appendChild(styleEl);
          }
          if (styleEl.textContent !== css) {
            styleEl.textContent = css;
          }
          cssInputs = inputs;
        }
        function hasUnknownSkin(itemNameEN, savedSkins, prefilledDefaults) {
          const saved = savedSkins[itemNameEN];
          return !!saved && saved === prefilledDefaults[itemNameEN];
        }
        function toggleUnknownLabel(host, show) {
          const existing = host.querySelector(".kasp-unknown-skin");
          if (!show) {
            if (existing) existing.remove();
            return;
          }
          if (!existing) {
            const label = document.createElement("span");
            label.className = "kasp-unknown-skin";
            label.textContent = "unknown skin";
            host.appendChild(label);
          }
        }
        function markMountedUnknownSkins(savedSkins, defaultImages, prefilledDefaults) {
          const blocks = document.querySelectorAll(gameDOM.garage.mountedEquipment);
          blocks.forEach((block) => {
            const src = block.querySelector(gameDOM.garage.mountedPreview)?.getAttribute("src") || "";
            const owner = Object.keys(savedSkins).find((item) => defaultImages[item]?.includes(src));
            toggleUnknownLabel(block, !!owner && hasUnknownSkin(owner, savedSkins, prefilledDefaults));
          });
        }
        function readSkinCards(row) {
          const cards = [];
          if (window.dispatchEvent(new Event(GARAGE_SKIN_CARDS_REQUEST, { cancelable: true }))) return cards;
          row.querySelectorAll(gameDOM.skins.cardIcon).forEach((icon) => {
            const native = safeParseJSON(icon.getAttribute("data-kasp-skin-card"));
            if (!native || typeof native.id !== "string" || !/^\d{1,20}$/.test(native.id) || typeof native.name !== "string" || typeof native.isMounted !== "boolean" || typeof native.isSelected !== "boolean" || typeof native.isOwned !== "boolean" || typeof native.isUnknown !== "boolean" || typeof native.isStandard !== "boolean") return;
            cards.push({
              id: native.id,
              title: native.name.trim(),
              isStandard: native.isStandard || (icon.getAttribute("src") ?? "").includes("ic_standard"),
              isEquipped: native.isMounted,
              isSelected: native.isSelected,
              isOwned: native.isOwned,
              isUnknown: native.isUnknown
            });
          });
          return cards;
        }
        function readPreviewArt(menu, row) {
          for (const el of menu.querySelectorAll(gameDOM.common.background)) {
            if (row.contains(el)) continue;
            const match = /url\("?([^")]+\.webp)"?\)/.exec(getComputedStyle(el).backgroundImage);
            if (match) return match[1];
          }
          return null;
        }
        function readSkinsScreen(nameTranslate) {
          const row = document.querySelector(gameDOM.skins.cards);
          const menu = document.querySelector(gameDOM.garage.submenu);
          if (!row || !menu) return { kind: "absent" };
          const cards = readSkinCards(row);
          const mounted = cards.filter((card) => card.isEquipped);
          const selected = cards.filter((card) => card.isSelected);
          const equippedCard = mounted.length === 1 ? mounted[0] : void 0;
          const selectedCard = selected.length === 1 ? selected[0] : void 0;
          const namedCard = equippedCard && !equippedCard.isStandard ? equippedCard : cards.find((card) => !card.isStandard);
          if (!equippedCard || !namedCard) return { kind: "absent" };
          const words = namedCard.title.toLowerCase().split(/\s+/);
          const matchedWord = words.find((w) => nameTranslate[w]);
          if (!matchedWord) return { kind: "absent" };
          return {
            kind: "ready",
            item: nameTranslate[matchedWord],
            equipped: equippedCard.isStandard ? { kind: "standard" } : { kind: "skin", title: equippedCard.title },
            selectedTitle: selectedCard?.title ?? null,
            selectionIsEquipped: !!selectedCard && selectedCard.id === equippedCard.id && !selectedCard.isUnknown && (selectedCard.isOwned || selectedCard.isStandard),
            artUrl: readPreviewArt(menu, row)
          };
        }
        function describeSkinsScreen(state2) {
          if (state2.kind === "absent") return "absent";
          const equipped = state2.equipped.kind === "standard" ? "standard" : `skin "${state2.equipped.title}"`;
          const art = state2.artUrl?.split("/").slice(-2).join("/") ?? "none";
          return `item=${state2.item} equipped=${equipped} selected=${JSON.stringify(state2.selectedTitle)} art=${art}`;
        }
        let lastSkinsSummary = null;
        function logSkinsScreen(state2) {
          const summary = describeSkinsScreen(state2);
          if (summary === lastSkinsSummary) return;
          const isFirstRead = lastSkinsSummary === null;
          lastSkinsSummary = summary;
          if (state2.kind === "absent" && isFirstRead) return;
          console.log(`[KI-test][garage-skins] skins tab: ${summary}`);
        }
        const SAFE_ART_URL = /^https:\/\/[a-z0-9.-]+\.tankionline\.com\/[A-Za-z0-9/_.-]+\.webp$/;
        function decideLearnAction(state2, stockUrl) {
          if (state2.kind === "absent") return { kind: "none", reason: null };
          if (state2.equipped.kind === "standard") return { kind: "clear", item: state2.item };
          const selectedIsEquipped = state2.selectionIsEquipped;
          if (!selectedIsEquipped) {
            return {
              kind: "none",
              reason: `waiting, selected ${JSON.stringify(state2.selectedTitle)} is not the equipped ${JSON.stringify(state2.equipped.title)}`
            };
          }
          if (state2.artUrl && SAFE_ART_URL.test(state2.artUrl)) {
            return { kind: "set", item: state2.item, url: state2.artUrl, source: "art" };
          }
          return stockUrl ? { kind: "set", item: state2.item, url: stockUrl, source: "stock" } : { kind: "none", reason: `art of ${JSON.stringify(state2.equipped.title)} is unreadable and no stock image is known` };
        }
        let lastLearnNote = null;
        function noteLearn(note) {
          if (note === lastLearnNote) return;
          lastLearnNote = note;
          if (note) console.log(`[KI-test][garage-skins] learn: ${note}`);
        }
        function describeLearnAction(action) {
          if (action.kind === "clear") return `standard equipped, clearing ${action.item}`;
          const art = action.url.split("/").slice(-2).join("/");
          return action.source === "art" ? `equipped skin art ${art} for ${action.item}` : `equipped skin art is unreadable, storing stock ${art} for ${action.item}`;
        }
        function writeSavedSkins(savedSkins) {
          if (!ownerId || getVerifiedAccount()?.userId !== ownerId) return;
          try {
            localStorage.setItem(STORAGE_PREFIX2 + ownerId, JSON.stringify(savedSkins));
          } catch (e) {
            console.warn("[KI-test][garage-skins] could not save skins:", e instanceof Error ? e.message : e);
          }
        }
        let pendingLearn = null;
        function learnFromSkinsScreen(state2, prefilledDefaults) {
          const stockUrl = state2.kind === "ready" ? prefilledDefaults[state2.item] : void 0;
          const action = decideLearnAction(state2, stockUrl);
          if (action.kind === "none") {
            pendingLearn = null;
            noteLearn(action.reason);
            return;
          }
          noteLearn(describeLearnAction(action));
          const key = action.kind === "set" ? `set|${action.item}|${action.url}` : `clear|${action.item}`;
          pendingLearn = { key, ticks: pendingLearn?.key === key ? pendingLearn.ticks + 1 : 1 };
          if (pendingLearn.ticks < 2) return;
          const savedSkins = getSavedSkins();
          if (action.kind === "set") {
            if (savedSkins[action.item] === action.url) return;
            savedSkins[action.item] = action.url;
            console.log(`[KI-test][garage-skins] saved ${action.item}: ${action.url.split("/").slice(-2).join("/")}`);
          } else {
            if (savedSkins[action.item] === void 0) return;
            delete savedSkins[action.item];
            console.log(`[KI-test][garage-skins] cleared ${action.item}`);
          }
          writeSavedSkins(savedSkins);
        }
        function isGarageScreen() {
          return !!document.querySelector(
            gameDOM.screens.garage
          );
        }
        function tick() {
          const nextOwnerId = getVerifiedAccount()?.userId ?? null;
          if (nextOwnerId !== ownerId) {
            ownerId = nextOwnerId;
            cssInputs = null;
            parsedStorage.clear();
            pendingLearn = null;
            lastSkinsSummary = null;
            lastLearnNote = null;
            const style = document.getElementById("kasp-skins-global-css");
            if (style) style.textContent = "";
            document.querySelectorAll(".kasp-unknown-skin").forEach((label) => label.remove());
            if (NAME_TRANSLATE && PREFILLED_DEFAULTS) updateGlobalCSS();
          }
          if (!ownerId) return;
          if (!NAME_TRANSLATE || !PREFILLED_DEFAULTS) return;
          if (!isGarageScreen()) return;
          const nameTranslate = NAME_TRANSLATE;
          const prefilledDefaults = PREFILLED_DEFAULTS;
          const skinsScreen = readSkinsScreen(nameTranslate);
          logSkinsScreen(skinsScreen);
          learnFromSkinsScreen(skinsScreen, prefilledDefaults);
          const defaultImages = getDefaultImages();
          let defaultsUpdated = false;
          const savedSkinsForList = getSavedSkins();
          const garageItems = document.querySelectorAll(gameDOM.garage.item);
          garageItems.forEach((item) => {
            const titleSpan = item.querySelector(gameDOM.garage.itemDescription);
            const imgMain = item.querySelector(gameDOM.garage.itemImage);
            if (titleSpan && imgMain) {
              const rawTitle = (titleSpan.textContent ?? "").trim().toLowerCase();
              const itemNameEN = nameTranslate[rawTitle.split(/\s+/)[0]] || rawTitle.split(/\s+/)[0];
              const originalSrc = imgMain.getAttribute("src") || "";
              if (getTankiImageUrl(originalSrc) && originalSrc !== savedSkinsForList[itemNameEN]) {
                if (!defaultImages[itemNameEN]) defaultImages[itemNameEN] = [];
                if (!defaultImages[itemNameEN].includes(originalSrc)) {
                  defaultImages[itemNameEN].push(originalSrc);
                  defaultsUpdated = true;
                }
              }
              toggleUnknownLabel(item, hasUnknownSkin(itemNameEN, savedSkinsForList, prefilledDefaults));
            }
          });
          markMountedUnknownSkins(savedSkinsForList, defaultImages, prefilledDefaults);
          if (defaultsUpdated) {
            localStorage.setItem(BASE_IMG_KEY, JSON.stringify(defaultImages));
          }
          updateGlobalCSS();
        }
        lifecycle17.onCleanup(() => {
          pendingLearn = null;
          ownerId = null;
          parsedStorage.clear();
          cssInputs = null;
          document.getElementById("kasp-skins-global-css")?.remove();
          document.querySelectorAll(".kasp-unknown-skin").forEach((node) => node.remove());
        });
        return tick;
      }, () => {
      });
    }
  });

  // src/core/turretIcons.ts
  var RESISTANCE_ICONS;
  var init_turretIcons = __esm({
    "src/core/turretIcons.ts"() {
      "use strict";
      RESISTANCE_ICONS = {
        "mine": "https://s.eu.tankionline.com/static/images/mine_resistance.dd581c90.svg",
        "crit": "https://s.eu.tankionline.com/static/images/crit_resistance.94e32312.svg",
        "firebird": "https://s.eu.tankionline.com/static/images/firebird_resistance.785a9d6b.svg",
        "freeze": "https://s.eu.tankionline.com/static/images/freeze_resistance.33bdf642.svg",
        "isis": "https://s.eu.tankionline.com/static/images/isis_resistance.30a69ffc.svg",
        "tesla": "https://s.eu.tankionline.com/static/images/tesla_resistance.3e686c8e.svg",
        "hammer": "https://s.eu.tankionline.com/static/images/hammer_resistance.6c549d29.svg",
        "twins": "https://s.eu.tankionline.com/static/images/twins_resistance.ad189f61.svg",
        "ricochet": "https://s.eu.tankionline.com/static/images/ricochet_resistance.8247beaa.svg",
        "vulcan": "https://s.eu.tankionline.com/static/images/vulcan_resistance.824f6f0e.svg",
        "smoky": "https://s.eu.tankionline.com/static/images/smoky_resistance.845afc14.svg",
        "rocket_launcher": "https://s.eu.tankionline.com/static/images/rocket_launcher_resistance.b7dfd64f.svg",
        "thunder": "https://s.eu.tankionline.com/static/images/thunder_resistance.6d7f4531.svg",
        "tsunami": "https://s.eu.tankionline.com/static/images/tsunami_resistance.6200aad9.svg",
        "scorpio": "https://s.eu.tankionline.com/static/images/scorpio_resistance.e8f1787f.svg",
        "artillery": "https://s.eu.tankionline.com/static/images/artillery_resistance.9b4cbc34.svg",
        "railgun": "https://s.eu.tankionline.com/static/images/railgun_resistance.636a554f.svg",
        "gauss": "https://s.eu.tankionline.com/static/images/gauss_resistance.bb8f409c.svg",
        "shaft": "https://s.eu.tankionline.com/static/images/shaft_resistance.0778fd3e.svg"
      };
    }
  });

  // src/modules/tabExpansion.ts
  function createTabExpansion(scope) {
    const panes = /* @__PURE__ */ new Set();
    let timer = 0;
    const clear = () => {
      scope.cancelTimeout(timer);
      timer = 0;
      for (const pane of panes) {
        pane.removeAttribute("data-kasp-tab-animating");
        pane.removeAttribute("data-kasp-tab-measuring");
        for (const key of Array.from(pane.style)) if (key.startsWith("--kasp-tab-")) pane.style.removeProperty(key);
      }
      panes.clear();
    };
    const snapshot = (pane) => {
      const row = (selector) => {
        const native = Array.from(pane.querySelectorAll(selector)).find((row2) => row2.children.length >= 7);
        return {
          width: native?.getBoundingClientRect().width ?? 0,
          cells: Array.from(native?.children ?? []).slice(0, 8).map((cell) => cell.getBoundingClientRect().width)
        };
      };
      return {
        width: parseFloat(window.getComputedStyle(pane).width),
        header: row("table > thead > tr"),
        body: row("table > tbody > tr")
      };
    };
    const setExpanded = (expanded) => {
      const body = document.body;
      const previous = body.classList.contains("kasp-tab-expanded");
      if (previous === expanded) return;
      const roots = Array.from(document.querySelectorAll(gameDOM.statistics.teams));
      if (!roots.length) {
        body.classList.toggle("kasp-tab-expanded", expanded);
        return;
      }
      if (!roots.every((root) => panes.has(root))) {
        clear();
        try {
          roots.forEach((root) => {
            panes.add(root);
            root.setAttribute("data-kasp-tab-measuring", "");
          });
          body.classList.remove("kasp-tab-expanded");
          const collapsed = roots.map(snapshot);
          body.classList.add("kasp-tab-expanded");
          const opened = roots.map(snapshot);
          body.classList.toggle("kasp-tab-expanded", previous);
          roots.forEach((root, index) => {
            const from = collapsed[index], to = opened[index];
            if (!Number.isFinite(from.width) || !Number.isFinite(to.width) || from.width <= 0 || to.width <= 0) return;
            if (from.header.cells.length < 7 || from.body.cells.length < 7 || from.header.cells.length !== to.header.cells.length || from.body.cells.length !== to.body.cells.length) return;
            root.style.setProperty("--kasp-tab-from", `${from.width}px`);
            root.style.setProperty("--kasp-tab-to", `${to.width}px`);
            for (const group of ["header", "body"]) {
              root.style.setProperty(`--kasp-tab-${group}-row-from`, `${from[group].width}px`);
              root.style.setProperty(`--kasp-tab-${group}-row-to`, `${to[group].width}px`);
              from[group].cells.forEach((width, column) => {
                root.style.setProperty(`--kasp-tab-${group}-${column}-from`, `${width}px`);
                root.style.setProperty(`--kasp-tab-${group}-${column}-to`, `${to[group].cells[column] ?? width}px`);
              });
            }
            root.style.setProperty("--kasp-tab-progress", previous ? "1" : "0");
            root.setAttribute("data-kasp-tab-animating", "");
          });
          roots.forEach((root) => {
            void window.getComputedStyle(root).width;
          });
        } catch (error) {
          clear();
          throw error;
        } finally {
          body.classList.toggle("kasp-tab-expanded", previous);
          roots.forEach((root) => root.removeAttribute("data-kasp-tab-measuring"));
        }
      }
      body.classList.toggle("kasp-tab-expanded", expanded);
      roots.forEach((root) => root.style.removeProperty("--kasp-tab-progress"));
      scope.cancelTimeout(timer);
      timer = scope.timeout(clear, 240);
    };
    scope.listen(window, "resize", clear);
    scope.onCleanup(clear);
    return { setExpanded };
  }
  var init_tabExpansion = __esm({
    "src/modules/tabExpansion.ts"() {
      "use strict";
      init_gameDOM();
    }
  });

  // src/modules/zeroResists.ts
  var lifecycle18, zeroResists;
  var init_zeroResists = __esm({
    "src/modules/zeroResists.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_turretIcons();
      init_tabExpansion();
      lifecycle18 = featureScope("zeroResists");
      zeroResists = lifecycle18.initialize(() => {
        const SHIELD_ICON_URL = chrome.runtime.getURL("assets/modulesTAB.svg");
        const TAB_SELECTOR = gameDOM.statistics.teams;
        let isTabExpanded = localStorage.getItem("kasp_tab_expanded") === "true";
        let initialExpandedSet = false;
        const expansion = createTabExpansion(lifecycle18);
        function getCssUrl(el, readStyle) {
          if (!el) return null;
          const cs = readStyle(el);
          for (const prop of ["maskImage", "webkitMaskImage", "backgroundImage"]) {
            const val = cs[prop];
            if (val && val !== "none" && val !== "initial" && val !== "") return val;
          }
          return null;
        }
        function injectHeaderShield() {
          const theadRows = document.querySelectorAll(gameDOM.statistics.headerRows);
          theadRows.forEach((row) => {
            if (row.querySelector(".kasp-defence-th")) return;
            const gsHeader = row.children[1];
            if (gsHeader) {
              const th = document.createElement("th");
              th.className = "kasp-defence-th";
              th.innerHTML = `<img src="${SHIELD_ICON_URL}" alt="" class="kasp-shield-img">`;
              gsHeader.after(th);
            }
          });
        }
        function getIconUrl(lbl, iconDiv, readStyle) {
          if (iconDiv) {
            const style = readStyle(iconDiv);
            const mask = style.getPropertyValue("-webkit-mask-image") || style.getPropertyValue("mask-image");
            const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1].toLowerCase();
          }
          const img = lbl.querySelector("img");
          if (img) return (img.src || "").toLowerCase();
          return "";
        }
        function injectCompactCells(readStyle) {
          const cells = document.querySelectorAll(gameDOM.statistics.resistanceCell);
          const updates = Array.from(cells, (cell) => {
            const htmlCell = cell;
            const labels = Array.from(htmlCell.children).filter(
              (el) => el.classList.contains(gameDOM.classes.defenceLabel) && !el.closest(".kasp-compact-cell")
            );
            let redLabel = null;
            let spectrumLabel = null;
            const criticalLabels = [];
            for (const lbl of labels) {
              const iconDiv = lbl.querySelector("div");
              const url = getIconUrl(lbl, iconDiv, readStyle);
              if (!spectrumLabel && url.includes("all_resistance")) spectrumLabel = lbl;
              if (url.includes("crit_resistance")) criticalLabels.push(lbl);
              if (!redLabel && iconDiv) {
                const bg = readStyle(iconDiv).backgroundColor;
                const isRed = bg.includes("254") || bg.includes("255, 80") || bg.includes("255, 102") || bg.includes("254, 102");
                if (isRed) redLabel = lbl;
              }
            }
            const protectLabel = spectrumLabel || redLabel;
            const protectIsSpectrum = spectrumLabel !== null;
            const armadilloLabel = criticalLabels.find((lbl) => lbl !== protectLabel) ?? null;
            const stateKey = JSON.stringify([protectIsSpectrum, protectLabel?.outerHTML ?? null, armadilloLabel?.outerHTML ?? null]);
            const compact = htmlCell.querySelector(".kasp-compact-cell");
            return { htmlCell, compact, protectLabel, protectIsSpectrum, armadilloLabel, stateKey };
          });
          for (const update2 of updates) {
            const { htmlCell, protectLabel, protectIsSpectrum, armadilloLabel, stateKey } = update2;
            let { compact } = update2;
            if (compact && compact.dataset.kaspState === stateKey) continue;
            if (!compact) {
              compact = document.createElement("div");
              compact.className = "kasp-compact-cell";
            }
            const slot1 = document.createElement("div");
            slot1.className = "kasp-slot";
            if (protectLabel) {
              const clone = protectLabel.cloneNode(true);
              clone.classList.add("kasp-cloned-resist", "kasp-protecting");
              if (protectIsSpectrum) clone.classList.add("kasp-spectrum");
              slot1.appendChild(clone);
            } else {
              slot1.innerHTML = '<span class="kasp-dash">\u2014</span>';
            }
            const slot2 = document.createElement("div");
            slot2.className = "kasp-slot";
            if (armadilloLabel) {
              const clone = armadilloLabel.cloneNode(true);
              clone.classList.add("kasp-cloned-resist", "kasp-armadillo");
              slot2.appendChild(clone);
            } else {
              slot2.innerHTML = '<span class="kasp-dash">\u2014</span>';
            }
            compact.replaceChildren(slot1, slot2);
            compact.dataset.kaspState = stateKey;
            if (!compact.parentElement) htmlCell.prepend(compact);
          }
        }
        function injectZeroSummary(readStyle) {
          const tabContainer = document.querySelector(TAB_SELECTOR);
          if (!tabContainer) return;
          let summaryRow = Array.from(tabContainer.children).find(
            (el) => el.className.includes(gameDOM.classes.flexCenter) && !el.className.toLowerCase().includes(gameDOM.fragments.header)
          );
          if (!summaryRow) {
            summaryRow = document.createElement("div");
            summaryRow.className = gameDOM.classes.flexCenter + " kasp-custom-summary-row";
            const optionsContainer = tabContainer.querySelector(gameDOM.statistics.options);
            if (optionsContainer) optionsContainer.before(summaryRow);
            else tabContainer.appendChild(summaryRow);
          }
          const presentResistances = /* @__PURE__ */ new Set();
          const children = Array.from(summaryRow.children);
          children.forEach((child) => {
            if (child.classList.contains("kasp-zero-summary")) return;
            const icon = child.querySelector("div") || child;
            const maskImg = getCssUrl(icon, readStyle);
            if (!maskImg) return;
            const match = maskImg.match(/\/([a-zA-Z_]+)_resistance(?:\.[0-9a-f]+)?\.(?:svg|webp|png)/);
            if (match && match[1]) presentResistances.add(match[1]);
          });
          const zeroBlocks = summaryRow.querySelectorAll(".kasp-zero-summary");
          const existingZeros = /* @__PURE__ */ new Set();
          zeroBlocks.forEach((block) => {
            const turret = block.getAttribute("data-turret");
            if (turret && presentResistances.has(turret)) block.remove();
            else if (turret) existingZeros.add(turret);
          });
          const fragment = document.createDocumentFragment();
          Object.keys(RESISTANCE_ICONS).forEach((turret) => {
            if (!presentResistances.has(turret) && !existingZeros.has(turret)) {
              const zeroLabel = document.createElement("div");
              zeroLabel.className = `kasp-zero-summary ${gameDOM.classes.flexStart}`;
              zeroLabel.setAttribute("data-turret", turret);
              zeroLabel.style.cssText = "display: flex !important; align-items: center !important; justify-content: flex-start !important; margin-right: 0.75em !important; cursor: default !important; opacity: 1 !important; pointer-events: none !important;";
              const iconDiv = document.createElement("div");
              iconDiv.className = gameDOM.classes.mask;
              iconDiv.style.cssText = `background-color: #5cfc47 !important; height: 1em !important; width: 1em !important; margin-right: 0.1875em !important; -webkit-mask-image: url('${RESISTANCE_ICONS[turret]}') !important; mask-image: url('${RESISTANCE_ICONS[turret]}') !important; -webkit-mask-size: contain !important; mask-size: contain !important; -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important; -webkit-mask-position: center center !important; mask-position: center center !important;`;
              const textSpan = document.createElement("span");
              textSpan.className = gameDOM.classes.regular;
              textSpan.innerHTML = "&#215;0";
              textSpan.style.cssText = "font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important;";
              zeroLabel.appendChild(iconDiv);
              zeroLabel.appendChild(textSpan);
              fragment.appendChild(zeroLabel);
            }
          });
          if (fragment.childNodes.length) summaryRow.appendChild(fragment);
        }
        function injectToggleButton() {
          if (isTabExpanded && !initialExpandedSet && document.body) {
            document.body.classList.add("kasp-tab-expanded");
            initialExpandedSet = true;
          }
          const tabContainer = document.querySelector(TAB_SELECTOR);
          if (!tabContainer) return;
          const summaryRow = Array.from(tabContainer.children).find((el) => el.className.includes(gameDOM.classes.flexCenter) && !el.className.toLowerCase().includes(gameDOM.fragments.header));
          if (!summaryRow || document.getElementById("kasp-tab-toggle-btn")) return;
          if (window.getComputedStyle(summaryRow).position === "static") {
            summaryRow.style.position = "relative";
          }
          const btn = document.createElement("div");
          btn.id = "kasp-tab-toggle-btn";
          btn.className = isTabExpanded ? "kasp-active-toggle" : "";
          btn.title = state.lang === "RU" ? "\u0412\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432\u0441\u0435 \u043C\u043E\u0434\u0443\u043B\u0438" : "Always show all modules";
          btn.innerHTML = `<div class="kasp-toggle-icon" style="-webkit-mask-image: url('${SHIELD_ICON_URL}'); mask-image: url('${SHIELD_ICON_URL}');"></div>`;
          lifecycle18.listen(btn, "click", (e) => {
            e.stopPropagation();
            const nextExpanded = !isTabExpanded;
            expansion.setExpanded(nextExpanded);
            isTabExpanded = nextExpanded;
            localStorage.setItem("kasp_tab_expanded", String(isTabExpanded));
            if (isTabExpanded) {
              document.body.classList.add("kasp-tab-expanded");
              btn.classList.add("kasp-active-toggle");
            } else {
              document.body.classList.remove("kasp-tab-expanded");
              btn.classList.remove("kasp-active-toggle");
            }
          });
          summaryRow.appendChild(btn);
        }
        function sync() {
          if (!document.querySelector(TAB_SELECTOR)) return;
          const styles = /* @__PURE__ */ new WeakMap();
          const readStyle = (element) => {
            let style = styles.get(element);
            if (!style) {
              style = window.getComputedStyle(element);
              styles.set(element, style);
            }
            return style;
          };
          injectHeaderShield();
          injectCompactCells(readStyle);
          injectZeroSummary(readStyle);
          injectToggleButton();
        }
        function update() {
          sync();
        }
        lifecycle18.onCleanup(() => {
          document.body.classList.remove("kasp-tab-expanded");
          document.querySelectorAll(".kasp-defence-th, .kasp-compact-cell, .kasp-zero-summary, #kasp-tab-toggle-btn, .kasp-custom-summary-row").forEach((node) => node.remove());
        });
        return { sync, update };
      }, { sync() {
      }, update() {
      } });
    }
  });

  // src/modules/enemyWeapons.ts
  function weaponKey(url) {
    const file = url.split("/").pop()?.split(".")[0].toLowerCase().replace(/_resistance$/, "") || "";
    const key = ALIASES[file] || file;
    return Object.prototype.hasOwnProperty.call(WEAPONS, key) ? key : null;
  }
  function iconUrl(element) {
    if (!element) return "";
    const image = element.tagName.toLowerCase() === "img" ? element : element.querySelector("img");
    const src = getTankiImageUrl(image?.getAttribute("src"));
    if (src) return src;
    const inline = element.style;
    const read = (style) => {
      for (const value of [style.maskImage, style.webkitMaskImage, style.backgroundImage]) {
        const url = getTankiImageUrl(/url\(["']?([^"')]+)["']?\)/.exec(value || "")?.[1]);
        if (url) return url;
      }
      return "";
    };
    return read(inline) || read(getComputedStyle(element));
  }
  function readEnemyWeapons(tab) {
    const self = tab.querySelector(gameDOM.statistics.selectedRow);
    const blue = tab.querySelector(gameDOM.statistics.blueTeam), red = tab.querySelector(gameDOM.statistics.redTeam);
    const dm = tab.querySelector(gameDOM.statistics.dmTeam);
    const enemy = self && blue?.contains(self) ? red : self && red?.contains(self) ? blue : null;
    const group = enemy || (!blue && !red && self && dm?.contains(self) ? dm : null);
    if (!group) return null;
    const counts = /* @__PURE__ */ new Map();
    for (const row of group.querySelectorAll("tbody tr")) {
      if (row === self || !row.querySelector(gameDOM.statistics.nickname)) continue;
      const cell = row.querySelector(gameDOM.statistics.deviceCell);
      const icon = cell?.querySelector(gameDOM.statistics.equipment)?.firstElementChild || null;
      const source = iconUrl(icon), key = weaponKey(source) || "unknown";
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { key, count: 1, icon: RESISTANCE_ICONS[key] || (key === "terminator" ? source : "") || TURRETS_ICON });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
  var lifecycle19, BUTTON, TOOLTIP, TURRETS_ICON, WEAPONS, ALIASES, enemyWeapons;
  var init_enemyWeapons = __esm({
    "src/modules/enemyWeapons.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_turretIcons();
      init_imageUrl();
      lifecycle19 = featureScope("enemyWeapons");
      BUTTON = "kasp-enemy-weapons-btn";
      TOOLTIP = "kasp-enemy-weapons-tooltip";
      TURRETS_ICON = "https://s.eu.tankionline.com/static/images/turrets.20be27f5.svg";
      WEAPONS = {
        firebird: ["\u041E\u0433\u043D\u0435\u043C\u0451\u0442", "Firebird"],
        freeze: ["\u0424\u0440\u0438\u0437", "Freeze"],
        isis: ["\u0418\u0437\u0438\u0434\u0430", "Isida"],
        tesla: ["\u0422\u0435\u0441\u043B\u0430", "Tesla"],
        hammer: ["\u041C\u043E\u043B\u043E\u0442", "Hammer"],
        twins: ["\u0422\u0432\u0438\u043D\u0441", "Twins"],
        ricochet: ["\u0420\u0438\u043A\u043E\u0448\u0435\u0442", "Ricochet"],
        vulcan: ["\u0412\u0443\u043B\u043A\u0430\u043D", "Vulcan"],
        smoky: ["\u0421\u043C\u043E\u043A\u0438", "Smoky"],
        rocket_launcher: ["\u0421\u0442\u0440\u0430\u0439\u043A\u0435\u0440", "Striker"],
        thunder: ["\u0413\u0440\u043E\u043C", "Thunder"],
        tsunami: ["\u0426\u0443\u043D\u0430\u043C\u0438", "Tsunami"],
        scorpio: ["\u0421\u043A\u043E\u0440\u043F\u0438\u043E\u043D", "Scorpion"],
        artillery: ["\u041C\u0430\u0433\u043D\u0443\u043C", "Magnum"],
        railgun: ["\u0420\u0435\u043B\u044C\u0441\u0430", "Railgun"],
        gauss: ["\u0413\u0430\u0443\u0441\u0441", "Gauss"],
        shaft: ["\u0428\u0430\u0444\u0442", "Shaft"],
        terminator: ["\u0422\u0435\u0440\u043C\u0438\u043D\u0430\u0442\u043E\u0440", "Terminator"]
      };
      ALIASES = { isida: "isis", striker: "rocket_launcher", magnum: "artillery", scorpion: "scorpio", jugger: "terminator" };
      enemyWeapons = lifecycle19.initialize(() => {
        let button = null, tooltip = null;
        let initialized2 = false, open = false, focused = false, interval;
        let size = { width: 0, height: 0 }, signature = "";
        function hide() {
          open = focused = false;
          lifecycle19.cancelInterval(interval);
          interval = void 0;
          tooltip?.remove();
          tooltip = null;
          signature = "";
          button?.setAttribute("aria-expanded", "false");
        }
        function position() {
          if (!tooltip || !button) return;
          const rect = button.getBoundingClientRect();
          const x = Math.max(8, Math.min(rect.left + rect.width / 2 - size.width / 2, window.innerWidth - size.width - 8));
          const y = Math.max(8, rect.top - size.height - 10);
          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
        }
        function refresh() {
          if (!open) return;
          const tab = document.querySelector(gameDOM.statistics.teams);
          if (!tab || !button?.isConnected || !button.getClientRects().length || !document.body) {
            hide();
            return;
          }
          const data = readEnemyWeapons(tab), ru = state.lang === "RU";
          const next = JSON.stringify([state.lang, data]);
          if (next === signature && tooltip?.isConnected) {
            position();
            return;
          }
          signature = next;
          if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = TOOLTIP;
            tooltip.setAttribute("role", "tooltip");
            document.body.appendChild(tooltip);
          }
          const contents = [];
          if (!data || !data.length) {
            const message = document.createElement("span");
            message.textContent = !data ? ru ? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0432\u0430\u0448\u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u0443" : "Your team could not be identified" : ru ? "\u041D\u0435\u0442 \u0438\u0433\u0440\u043E\u043A\u043E\u0432 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430" : "No enemy players";
            contents.push(message);
          } else {
            const list = document.createElement("div");
            list.className = "kasp-enemy-weapons-list";
            if (data.length > 9) {
              list.className += " kasp-enemy-weapons-two-columns";
              list.style.gridTemplateRows = `repeat(${Math.ceil(data.length / 2)}, auto)`;
            }
            for (const entry of data) {
              const row = document.createElement("div");
              row.className = "kasp-enemy-weapon";
              const icon = document.createElement("i");
              icon.style.maskImage = icon.style.webkitMaskImage = `url("${entry.icon}")`;
              const label = document.createElement("span");
              label.textContent = WEAPONS[entry.key]?.[ru ? 0 : 1] || (ru ? "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043F\u0443\u0448\u043A\u0430" : "Unknown weapon");
              const count = document.createElement("b");
              count.textContent = `\xD7${entry.count}`;
              row.append(icon, label, count);
              list.appendChild(row);
            }
            contents.push(list);
          }
          tooltip.replaceChildren(...contents);
          size = { width: tooltip.offsetWidth, height: tooltip.offsetHeight };
          position();
        }
        function show() {
          open = true;
          button?.setAttribute("aria-expanded", "true");
          refresh();
          if (open) interval ??= lifecycle19.interval(refresh, 250);
        }
        function setup() {
          if (initialized2) return;
          initialized2 = true;
          lifecycle19.listen(document, "mouseover", (event) => {
            if (!(event.target instanceof Element) || !button?.contains(event.target)) return;
            if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
            show();
          });
          lifecycle19.listen(document, "mouseout", (event) => {
            if (focused || !(event.target instanceof Node) || !button?.contains(event.target)) return;
            if (!(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget)) hide();
          });
          lifecycle19.listen(document, "focusin", (event) => {
            if (!button || event.target !== button) return;
            focused = true;
            show();
          });
          for (const type of ["mousedown", "click"]) lifecycle19.listen(document, type, (event) => {
            if (!(event.target instanceof Node) || !button?.contains(event.target)) return;
            event.preventDefault();
            event.stopPropagation();
          }, true);
          lifecycle19.listen(document, "focusout", (event) => {
            if (event.target === button) hide();
          });
          lifecycle19.listen(document, "keydown", (event) => {
            if (event.key === "Escape") hide();
          });
          lifecycle19.listen(window, "blur", hide);
          lifecycle19.listen(window, "resize", () => {
            if (tooltip) {
              size = { width: tooltip.offsetWidth, height: tooltip.offsetHeight };
              position();
            }
          });
          lifecycle19.listen(document, "visibilitychange", () => {
            if (document.hidden) hide();
          });
        }
        function sync() {
          setup();
          const tab = document.querySelector(gameDOM.statistics.teams);
          const toggle = tab?.querySelector("#kasp-tab-toggle-btn");
          if (!toggle?.parentElement) {
            hide();
            button?.remove();
            button = null;
            return;
          }
          if (!button?.isConnected || button.parentElement !== toggle.parentElement) {
            hide();
            button?.remove();
            button = document.createElement("div");
            button.id = BUTTON;
            button.setAttribute("role", "button");
            button.tabIndex = 0;
            button.setAttribute("aria-describedby", TOOLTIP);
            button.setAttribute("aria-expanded", "false");
            const icon = document.createElement("div");
            icon.className = "kasp-toggle-icon";
            icon.style.maskImage = icon.style.webkitMaskImage = `url("${TURRETS_ICON}")`;
            button.appendChild(icon);
            toggle.parentElement.appendChild(button);
          }
          button.setAttribute("aria-label", state.lang === "RU" ? "\u041F\u0443\u0448\u043A\u0438 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430" : "Enemy weapons");
          refresh();
        }
        lifecycle19.onCleanup(() => {
          hide();
          button?.remove();
          button = null;
        });
        return { sync };
      }, { sync() {
      } });
    }
  });

  // src/modules/equipmentTracker.ts
  var lifecycle20, equipmentTracker;
  var init_equipmentTracker = __esm({
    "src/modules/equipmentTracker.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_accountIdentity();
      lifecycle20 = featureScope("equipmentTracker");
      equipmentTracker = lifecycle20.initialize(() => {
        const STORAGE_KEY = "kasp_my_equipment";
        let lastSignature = "";
        const urlFrom = (el) => {
          if (!el) return "";
          const cs = getComputedStyle(el);
          const bg = cs.getPropertyValue("background-image");
          if (bg && bg !== "none") {
            const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1];
          }
          const mask = cs.getPropertyValue("-webkit-mask-image") || cs.getPropertyValue("mask-image");
          if (mask && mask !== "none") {
            const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1];
          }
          const img = el.querySelector("img");
          if (img && img.src) return img.src;
          if (el instanceof HTMLImageElement && el.src) return el.src;
          return "";
        };
        const iconsOf = (cell) => {
          if (!cell) return [];
          const block = cell.querySelector(gameDOM.statistics.equipment);
          if (!block) return [];
          return Array.from(block.children);
        };
        const getOwnNickname = () => {
          return getAccountIdentity()?.nickname || "";
        };
        const findSelfRow = () => {
          const byId = document.getElementById(gameDOM.ids.selfRow);
          if (byId) return byId;
          const selected = document.querySelector(gameDOM.statistics.selectedRow);
          if (selected) return selected;
          const own = getOwnNickname();
          if (!own) return null;
          const cells = document.querySelectorAll(gameDOM.statistics.nickname);
          for (let i = 0; i < cells.length; i++) {
            const nick = (cells[i].textContent || "").trim().replace(/^\[.*?\]\s*/, "").trim();
            if (nick === own) return cells[i].closest("tr");
          }
          return null;
        };
        const sync = () => {
          const selfRow = findSelfRow();
          if (!selfRow) return;
          const device = selfRow.querySelector(gameDOM.statistics.deviceCell);
          const defence = selfRow.querySelector(gameDOM.statistics.hullCell);
          if (!device && !defence) return;
          const dIcons = iconsOf(device);
          const hIcons = iconsOf(defence);
          const entry = {
            turret: urlFrom(dIcons[0] ?? null),
            turretAugment: urlFrom(dIcons[1] ?? null),
            hull: urlFrom(hIcons[0] ?? null),
            hullAugment: urlFrom(hIcons[1] ?? null),
            savedAt: Date.now()
          };
          if (!entry.turret && !entry.hull) return;
          const sig = `${entry.turret}|${entry.turretAugment}|${entry.hull}|${entry.hullAugment}`;
          if (sig === lastSignature) return;
          lastSignature = sig;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
          } catch (e) {
            console.error("[KI:equipment] save failed", e);
          }
        };
        const get = () => {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        };
        const clear = () => {
          localStorage.removeItem(STORAGE_KEY);
          lastSignature = "";
        };
        lifecycle20.onCleanup(() => {
          clear();
        });
        return { sync: lifecycle20.guard(sync), get: lifecycle20.guard(get), clear };
      }, { sync() {
      }, get() {
        return null;
      }, clear() {
      } });
    }
  });

  // src/core/historyMarkup.ts
  function escapeHistoryHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }
  function renderHistoryTemplate(template, values, markupKeys = []) {
    const markup = new Set(markupKeys);
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) return placeholder;
      return markup.has(key) ? String(values[key] ?? "") : escapeHistoryHtml(values[key]);
    });
  }
  var init_historyMarkup = __esm({
    "src/core/historyMarkup.ts"() {
      "use strict";
      init_imageUrl();
    }
  });

  // src/modules/battleHistory/localization.ts
  function getHistoryDictionary(language) {
    return language === "RU" ? historyTranslations.RU : historyTranslations.EN;
  }
  function getClearHistoryDictionary(language) {
    return language === "RU" ? clearHistoryTranslations.RU : clearHistoryTranslations.EN;
  }
  function getHistoryMessages(language) {
    return language === "RU" ? historyMessages.RU : historyMessages.EN;
  }
  var historyTranslations, clearHistoryTranslations, historyMessages;
  var init_localization = __esm({
    "src/modules/battleHistory/localization.ts"() {
      "use strict";
      historyTranslations = {
        RU: {
          title: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0411\u0438\u0442\u0432",
          loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430",
          date: "\u0414\u0430\u0442\u0430",
          map: "\u041A\u0430\u0440\u0442\u0430",
          status: "\u0421\u0442\u0430\u0442\u0443\u0441",
          top: "\u041C\u0435\u0441\u0442\u043E",
          mode: "\u0420\u0435\u0436\u0438\u043C",
          score: "\u041E\u0447\u043A\u0438",
          kills: "\u041A",
          deaths: "\u0414",
          kd: "\u0423/\u0421",
          turret: "\u041F\u0443\u0448\u043A\u0430",
          hull: "\u041A\u043E\u0440\u043F\u0443\u0441",
          augment: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",
          crystals: "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u044B",
          stars: "\u0417\u0432\u0451\u0437\u0434\u044B",
          win: "\u041F\u043E\u0431\u0435\u0434\u0430",
          lose: "\u041F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435",
          draw: "\u041D\u0438\u0447\u044C\u044F",
          dm: "\u041A\u0430\u0436\u0434\u044B\u0439 \u0441\u0430\u043C \u0437\u0430 \u0441\u0435\u0431\u044F",
          teamScore: "\u0421\u0447\u0451\u0442",
          clear: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C",
          export: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442",
          import: "\u0418\u043C\u043F\u043E\u0440\u0442",
          battles: "\u0411\u043E\u0451\u0432",
          noBattles: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0431\u043E\u0451\u0432",
          accountUnavailable: "ID \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u0430. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0438\u0433\u0440\u0443.",
          contextExpired: "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0438\u043B\u0438 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438\u0433\u0440\u044B, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E.",
          player: "\u0418\u0433\u0440\u043E\u043A",
          gs: "GS",
          diamond: "DIAMOND",
          myTeam: "\u041C\u043E\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430",
          enemyTeam: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430",
          playersCount: "\u0438\u0433\u0440\u043E\u043A\u043E\u0432",
          allBattles: "\u2039 \xA0 \u0412\u0441\u0435 \u0431\u0438\u0442\u0432\u044B",
          yourScore: "\u0412\u0430\u0448 \u0441\u0447\u0451\u0442",
          yourKd: "\u0412\u0430\u0448 \u041A/\u0414"
        },
        EN: {
          title: "Battle History",
          loading: "Loading",
          date: "Date",
          map: "Map",
          status: "Status",
          top: "Top",
          mode: "Mode",
          score: "Score",
          kills: "Kills",
          deaths: "Deaths",
          kd: "K/D",
          turret: "Turret",
          hull: "Hull",
          augment: "Augment",
          crystals: "Crystals",
          stars: "Stars",
          win: "Victory",
          lose: "Defeat",
          draw: "Draw",
          dm: "Deathmatch",
          teamScore: "Score",
          clear: "Clear",
          export: "Export",
          import: "Import",
          battles: "Battles",
          noBattles: "No saved battles yet",
          accountUnavailable: "Account ID is unavailable. Saved history has not been deleted. Wait for account data or reload the game.",
          contextExpired: "The extension was updated or disabled. Reload the game page to open battle history.",
          player: "Player",
          gs: "GS",
          diamond: "DIAMOND",
          myTeam: "My Team",
          enemyTeam: "Enemy Team",
          playersCount: "players",
          allBattles: "\u2039 \xA0 All battles",
          yourScore: "Your Score",
          yourKd: "Your K/D"
        }
      };
      clearHistoryTranslations = {
        RU: { title: "\u041E\u0427\u0418\u0421\u0422\u041A\u0410 \u0418\u0421\u0422\u041E\u0420\u0418\u0418", text: "\u0412\u044B \u0443\u0432\u0435\u0440\u0435\u043D\u044B, \u0447\u0442\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043C\u0430\u0442\u0447\u0435\u0439?", cancel: "\u041E\u0442\u043C\u0435\u043D\u0430", confirm: "\u0423\u0414\u0410\u041B\u0418\u0422\u042C" },
        EN: { title: "CLEAR HISTORY", text: "Are you sure you want to delete all match history?", cancel: "Cancel", confirm: "DELETE" }
      };
      historyMessages = {
        RU: {
          imported: (count) => `\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0431\u043E\u0451\u0432: ${count}.`,
          importFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0444\u0430\u0439\u043B. \u041D\u0443\u0436\u0435\u043D JSON-\u0444\u0430\u0439\u043B \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0441 user ID \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430. \u0421\u0442\u0430\u0440\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0431\u0435\u0437 ID \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E."
        },
        EN: {
          imported: (count) => `Imported battles: ${count}.`,
          importFailed: "Could not import this file. Use a battle history JSON file with the current account user ID. Legacy records without an ID remain separate."
        }
      };
    }
  });

  // src/modules/battleHistory/presentation.ts
  function playersWord(n, lang) {
    if (lang === "RU") {
      const mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return "\u0438\u0433\u0440\u043E\u043A";
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "\u0438\u0433\u0440\u043E\u043A\u0430";
      return "\u0438\u0433\u0440\u043E\u043A\u043E\u0432";
    }
    return n === 1 ? "player" : "players";
  }
  function classifyResult(battle) {
    const status = (battle.status || "").toLowerCase();
    return {
      isWin: status.includes("victory") || status.includes("\u043F\u043E\u0431\u0435\u0434\u0430"),
      isDraw: status.includes("draw") || status.includes("\u043D\u0438\u0447\u044C\u044F"),
      isDM: status === "dm" || status.includes("\u043A\u0430\u0436\u0434\u044B\u0439 \u0441\u0430\u043C \u0437\u0430 \u0441\u0435\u0431\u044F") || String(battle.mode).toUpperCase() === "DM"
    };
  }
  function formatNumber(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\xA0");
  }
  function formatBattleDate(timestamp) {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
  }
  function buildDetailedMarkup(b, dict, lang, template) {
    const { isWin, isDraw, isDM } = classifyResult(b);
    let myTeamHtml = "";
    let enemyTeamHtml = "";
    let myTeamCount = 0;
    let enemyTeamCount = 0;
    (b.players || []).forEach((p) => {
      const isMeClass = p.isMe ? "current-player" : isDM ? "enemy-player" : "";
      const gsClass = getGsClass(p.gs);
      const gsFormatted = formatNumber(p.gs);
      const scoreFormatted = formatNumber(p.score);
      const crystalsFormatted = formatNumber(p.crystals);
      const rankUrl = getTankiImageUrl(p.rank);
      const rowHtml = `
                    <tr class="${isMeClass}">
                        <td class="player-cell">
                            <div class="player-icons">
                                ${rankUrl ? `<img class="player-icon" src="${escapeHistoryHtml(rankUrl)}" style="width: 24px; height: 24px; border: none; background: transparent; padding: 0;">` : ""}
                            </div>
                            <span class="player-name">${escapeHistoryHtml(p.name)}</span>
                        </td>
                        <td class="gs ${gsClass}">${escapeHistoryHtml(gsFormatted)}</td>
                        <td>${escapeHistoryHtml(scoreFormatted)}</td>
                        <td>${escapeHistoryHtml(p.kills)}</td>
                        <td>${escapeHistoryHtml(p.deaths)}</td>
                        <td>${escapeHistoryHtml(p.kd.toFixed(2))}</td>
                        <td class="reward">${escapeHistoryHtml(crystalsFormatted)}</td>
                        <td class="stars">${escapeHistoryHtml(p.stars)}</td>
                    </tr>
                `;
      if (!isDM && p.isEnemy) {
        enemyTeamHtml += rowHtml;
        enemyTeamCount++;
      } else {
        myTeamHtml += rowHtml;
        myTeamCount++;
      }
    });
    let resultClass = isWin ? "victory" : isDraw ? "draw" : "defeat";
    let resultText = isWin ? dict.win : isDraw ? dict.draw : dict.lose;
    if (isDM) {
      resultClass = "draw";
      const place = b.top && b.top !== "-" ? b.top : null;
      resultText = place ? lang === "RU" ? `#${place} \u041C\u0415\u0421\u0422\u041E` : `#${place} PLACE` : dict.dm;
    }
    const hasTeamScores = !isDM && typeof b.teamScoreMy === "number" && typeof b.teamScoreEnemy === "number";
    const leftLabel = hasTeamScores ? dict.myTeam : dict.yourScore;
    const leftValue = hasTeamScores ? formatNumber(b.teamScoreMy) : formatNumber(b.reputation || 0);
    const rightLabel = hasTeamScores ? dict.enemyTeam : dict.yourKd;
    const rightValue = hasTeamScores ? formatNumber(b.teamScoreEnemy) : (b.kd || 0).toFixed(2);
    const modeUpperKey = String(b.mode || "MM").toUpperCase();
    const teamIcon = hasTeamScores ? MODE_ICONS[modeUpperKey] || MODE_ICONS.TDM : null;
    const leftIconUrl = teamIcon || DM_SCORE_ICON;
    const rightIconUrl = teamIcon || DM_KD_ICON;
    const mapInfo = DataLoader.getMapInfo(b.map);
    const localizedMap = (mapInfo ? lang === "RU" ? mapInfo.ru : mapInfo.en : translateMapName(b.map, lang)) || "Unknown";
    const { date: dateStr, time: timeStr } = formatBattleDate(b.date);
    const replacements = {
      backLabel: dict.allBattles,
      leftScoreClass: isDM ? "dm" : "",
      leftIconUrl,
      leftLabel,
      leftValue,
      mode: b.mode || "MM",
      date: dateStr,
      time: timeStr,
      playerCount: String((b.players || []).length),
      playersLabel: dict.playersCount,
      map: localizedMap,
      resultClass,
      resultText,
      rightScoreClass: isDM ? "dm" : "",
      rightIconUrl,
      rightLabel,
      rightValue,
      statsClass: isDM ? "solo-mode dm-mode" : enemyTeamCount === 0 ? "solo-mode" : "",
      playerLabel: dict.player,
      gsLabel: dict.gs,
      scoreLabel: dict.score,
      myTeamClass: myTeamCount > 0 ? "" : "bh-hidden",
      myTeamTitle: isDM ? dict.dm : dict.myTeam,
      myTeamCount: `${myTeamCount}\xA0${playersWord(myTeamCount, lang)}`,
      myTeamRows: myTeamHtml,
      enemyTeamClass: enemyTeamCount > 0 ? "" : "bh-hidden",
      enemyTeamTitle: dict.enemyTeam,
      enemyTeamCount: `${enemyTeamCount}\xA0${playersWord(enemyTeamCount, lang)}`,
      enemyTeamRows: enemyTeamHtml
    };
    return renderHistoryTemplate(template, replacements, ["myTeamRows", "enemyTeamRows"]);
  }
  function buildCardMarkup(b, dict, lang, template) {
    const { date: dateStr, time: timeStr } = formatBattleDate(b.date);
    const { isWin, isDraw, isDM } = classifyResult(b);
    let statusClass = "bh-card-result--loss";
    let statusLocalized = dict.lose;
    if (isDM) {
      statusClass = "bh-card-result--dm";
      statusLocalized = dict.dm;
    } else if (isWin) {
      statusClass = "bh-card-result--win";
      statusLocalized = dict.win;
    } else if (isDraw) {
      statusClass = "bh-card-result--draw";
      statusLocalized = dict.draw;
    }
    const mapInfo = DataLoader.getMapInfo(b.map);
    const localizedMap = (mapInfo ? lang === "RU" ? mapInfo.ru : mapInfo.en : translateMapName(b.map, lang)) || "Unknown";
    const mapUpper = String(localizedMap).toUpperCase();
    const mapImage = getTankiImageUrl(mapInfo?.image);
    const modeUpper = String(b.mode || "MM").toUpperCase();
    const topDisplay = b.top && b.top !== "-" ? `#${b.top}` : "\u2014";
    const hasTeamScore = !isDM && typeof b.teamScoreMy === "number" && typeof b.teamScoreEnemy === "number";
    const teamScoreStat = hasTeamScore ? `<div class="bh-stat"><span class="bh-stat-value">${escapeHistoryHtml(b.teamScoreMy)}<span class="bh-stat-sep">/</span>${escapeHistoryHtml(b.teamScoreEnemy)}</span><span class="bh-stat-label bh-stat-label--team-score">${escapeHistoryHtml(dict.teamScore)}</span></div>` : "";
    const turretUrl = getTankiImageUrl(b.turretIcon);
    const turretAugUrl = getTankiImageUrl(b.turretAugmentIcon);
    const hullUrl = getTankiImageUrl(b.hullIcon);
    const hullAugUrl = getTankiImageUrl(b.hullAugmentIcon);
    const turretIcon = turretUrl ? `<img class="bh-equip-img" src="${escapeHistoryHtml(turretUrl)}" alt="">` : `<div class="bh-equip-placeholder">\u25B0</div>`;
    const turretAugIcon = turretAugUrl ? `<img class="bh-equip-img" src="${escapeHistoryHtml(turretAugUrl)}" alt="">` : `<div class="bh-equip-placeholder">\u25C7</div>`;
    const hullIcon = hullUrl ? `<img class="bh-equip-img" src="${escapeHistoryHtml(hullUrl)}" alt="">` : `<div class="bh-equip-placeholder">\u25B1</div>`;
    const hullAugIcon = hullAugUrl ? `<img class="bh-equip-img" src="${escapeHistoryHtml(hullAugUrl)}" alt="">` : `<div class="bh-equip-placeholder">\u25C7</div>`;
    const replacements = {
      cardClass: `${statusClass} ${turretAugUrl || hullAugUrl ? "" : "bh-card--no-aug"}`,
      combatStatsClass: hasTeamScore ? "bh-combat-stats--with-team-score" : "",
      mapStyle: mapImage ? `style="background-image: linear-gradient(90deg, rgba(10,10,10,0.15), rgba(10,10,10,0.75)), url('${escapeHistoryHtml(mapImage)}'); background-size: cover; background-position: center;"` : "",
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
      modeIcon: b.kind === "PRO" ? "PRO" : "MM",
      modeIconClass: b.kind === "PRO" ? "bh-mode-icon--pro" : "bh-mode-icon--mm",
      modeUpper,
      crystalsValue: (b.crystals ?? 0).toLocaleString(),
      starsValue: String(b.stars ?? 0),
      dateTime: `${dateStr} \xB7 ${timeStr}`
    };
    return renderHistoryTemplate(
      template,
      replacements,
      ["mapStyle", "teamScoreStat", "turretIcon", "turretAugIcon", "hullIcon", "hullAugIcon"]
    );
  }
  var MODE_ICONS, DM_SCORE_ICON, DM_KD_ICON, MAP_ICON_URL, translateMapName, getGsClass;
  var init_presentation = __esm({
    "src/modules/battleHistory/presentation.ts"() {
      "use strict";
      init_dataLoader();
      init_historyMarkup();
      MODE_ICONS = {
        TDM: "https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg",
        CP: "https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg",
        CTF: "https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg",
        SGE: "https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg",
        JGR: "https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg",
        TJR: "https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg",
        RGB: "https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg",
        ASL: "https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg",
        AR: "https://ru.tankiwiki.com/images/ru/thumb/6/6c/AR_Icon.png/25px-AR_Icon.png"
      };
      DM_SCORE_ICON = "https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg";
      DM_KD_ICON = "https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg";
      MAP_ICON_URL = chrome.runtime.getURL("assets/map-icon.png");
      translateMapName = (rawMapWithMode, targetLang) => {
        const cleanText = (rawMapWithMode || "").trim();
        if (!cleanText) return "Unknown";
        const translated = DataLoader.translateMap(cleanText, targetLang);
        return translated || cleanText;
      };
      getGsClass = (gs) => {
        if (gs >= 9999) return "gs-best";
        if (gs >= 9001) return "gs-9000";
        if (gs >= 8001) return "gs-8000";
        if (gs >= 7001) return "gs-7000";
        if (gs >= 6001) return "gs-6000";
        if (gs >= 5001) return "gs-5000";
        if (gs >= 4001) return "gs-4000";
        if (gs >= 3001) return "gs-3000";
        if (gs >= 2001) return "gs-2000";
        if (gs >= 1001) return "gs-1000";
        return "gs-0";
      };
    }
  });

  // src/modules/battleHistory/battleIdentity.ts
  function getBattleIdentity(battle) {
    if (battle.battleId !== void 0) {
      return typeof battle.battleId === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(battle.battleId) ? battle.battleId : null;
    }
    return typeof battle.id === "number" && Number.isSafeInteger(battle.id) && battle.id > 0 ? `legacy:${battle.id}` : null;
  }
  var init_battleIdentity = __esm({
    "src/modules/battleHistory/battleIdentity.ts"() {
      "use strict";
    }
  });

  // src/modules/battleHistory/repository.ts
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME) ? request.transaction.objectStore(STORE_NAME) : db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        for (const index of INDEXES) {
          if (!store.indexNames.contains(index)) store.createIndex(index, index, { unique: false });
        }
        if (store.indexNames.contains("nickname")) store.deleteIndex("nickname");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async function transaction(mode, enqueue) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        let result;
        let failure;
        tx.oncomplete = () => failure ? reject(failure) : resolve(result);
        tx.onerror = () => {
          failure = tx.error || new Error("Battle history transaction failed");
        };
        tx.onabort = () => reject(failure || tx.error || new Error("Battle history transaction aborted"));
        try {
          enqueue(tx.objectStore(STORE_NAME), (value) => {
            result = value;
          });
        } catch (error) {
          failure = error;
          try {
            tx.abort();
          } catch {
            reject(error);
          }
        }
      });
    } finally {
      db.close();
    }
  }
  function addBattle(battle) {
    if (typeof battle.userId !== "string" || normalizeAccountId(battle.userId) !== battle.userId) return Promise.reject(new Error("account-id-required"));
    return transaction("readwrite", (store, setResult) => {
      const request = store.add({ ...battle, battleId: battle.battleId || crypto.randomUUID() });
      request.onsuccess = () => setResult(request.result);
    });
  }
  async function addBattles(battles, userId) {
    if (!battles.length) return 0;
    if (normalizeAccountId(userId) !== userId || battles.some((battle) => battle.userId !== userId)) throw new Error("history-owner-mismatch");
    if (battles.some((battle) => !getBattleIdentity(battle))) throw new Error("battle-id-required");
    return transaction("readwrite", (store, setResult) => {
      const existing = store.index("userId").getAll(userId);
      existing.onsuccess = () => {
        const known = new Set(existing.result.map(getBattleIdentity));
        let added = 0;
        for (const battle of battles) {
          const battleId = getBattleIdentity(battle);
          if (known.has(battleId)) continue;
          known.add(battleId);
          const { id: _sourceKey, ...record } = battle;
          store.add({ ...record, battleId });
          added++;
        }
        setResult(added);
      };
    });
  }
  function getAllBattles(userId) {
    if (!userId || normalizeAccountId(userId) !== userId) return Promise.resolve([]);
    return transaction("readonly", (store, setResult) => {
      const request = store.index("userId").getAll(userId);
      request.onsuccess = () => setResult((request.result || []).map((battle) => ({
        ...battle,
        battleId: getBattleIdentity(battle) || void 0
      })));
    });
  }
  function clearAccountHistory(userId) {
    if (normalizeAccountId(userId) !== userId) return Promise.reject(new Error("account-id-required"));
    return transaction("readwrite", (store) => {
      const request = store.index("userId").getAllKeys(userId);
      request.onsuccess = () => {
        for (const key of request.result) store.delete(key);
      };
    });
  }
  var DATABASE_NAME, DATABASE_VERSION, STORE_NAME, INDEXES;
  var init_repository = __esm({
    "src/modules/battleHistory/repository.ts"() {
      "use strict";
      init_accountId();
      init_battleIdentity();
      DATABASE_NAME = "TankiBattlesDB";
      DATABASE_VERSION = 5;
      STORE_NAME = "battles";
      INDEXES = ["date", "map", "mode", "top", "userId"];
    }
  });

  // src/modules/battleHistory/context.ts
  var historyContext;
  var init_context = __esm({
    "src/modules/battleHistory/context.ts"() {
      "use strict";
      init_localization();
      historyContext = {
        invalidated: false,
        handle(error, language) {
          const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
          if (!/extension context invalidated/i.test(message)) return false;
          if (!this.invalidated) {
            this.invalidated = true;
            const message2 = getHistoryDictionary(language).contextExpired;
            document.querySelector(".bh-detailed-view")?.remove();
            const panel = document.querySelector(".bh-left-panel");
            if (panel) panel.style.display = "flex";
            const list = document.querySelector(".bh-list");
            if (list) {
              const notice = document.createElement("div");
              notice.className = "bh-empty";
              notice.textContent = message2;
              list.innerHTML = "";
              list.appendChild(notice);
            }
            document.querySelectorAll(".bh-control-btn").forEach((button) => {
              button.disabled = true;
            });
            const entry = document.querySelector(".custom-history-button");
            if (entry) entry.title = message2;
          }
          return true;
        }
      };
    }
  });

  // src/modules/battleHistory/views.ts
  function createHistoryViews(account) {
    const ROWS_PER_PAGE = 15;
    let hasRenderedBattleList = false;
    let lastRenderedNewestBattleKey = null;
    let pendingBattleListAnimation = false;
    let listRevision = 0;
    let detailRevision = 0;
    const templates = /* @__PURE__ */ new Map();
    const loadTemplate = (name) => {
      let pending = templates.get(name);
      if (!pending) {
        pending = fetch(chrome.runtime.getURL("templates/battle-history-" + name + ".html")).then((response) => {
          if (!response.ok) throw new Error("Failed to load history template: " + response.status);
          return response.text();
        }).catch((error) => {
          templates.delete(name);
          throw error;
        });
        templates.set(name, pending);
      }
      return pending;
    };
    const animateHistoryTransition = (element, className, duration) => new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        lifecycle21.cancelTimeout(timer);
        lifecycle21.unlisten(element, "animationend", onAnimationEnd);
        element.classList.remove(className);
        resolve();
      };
      const onAnimationEnd = (event) => {
        if (event.target === element) finish();
      };
      element.classList.remove(className);
      void element.offsetWidth;
      lifecycle21.listen(element, "animationend", onAnimationEnd);
      element.classList.add(className);
      timer = lifecycle21.timeout(finish, duration + 50);
    });
    const renderDetailedMatch = async (b, dict, lang) => {
      if (historyContext.invalidated) return;
      const contentBlock = document.querySelector(".custom-history-content");
      if (!contentBlock) return;
      const revision = ++detailRevision;
      const isCurrent = () => !historyContext.invalidated && revision === detailRevision && document.querySelector(".custom-history-content") === contentBlock;
      let template;
      try {
        template = await loadTemplate("detail");
      } catch (error) {
        if (!historyContext.handle(error, lang)) console.error("[Tanki Battle History] Failed to load detail template:", error);
        return;
      }
      if (!isCurrent()) return;
      const listPanel = contentBlock.querySelector(".bh-left-panel");
      if (listPanel) {
        await animateHistoryTransition(listPanel, "bh-panel-leave", 200);
        if (!isCurrent()) return;
        clearBattleListAnimations(listPanel);
        listPanel.style.display = "none";
      }
      const oldView = contentBlock.querySelector(".bh-detailed-view");
      if (oldView) oldView.remove();
      const detailedView = document.createElement("div");
      detailedView.className = "bh-detailed-view page";
      detailedView.style.cssText = "flex-grow: 1; overflow-y: auto; padding-right: 1em; width: 100%; box-sizing: border-box;";
      detailedView.innerHTML = buildDetailedMarkup(b, dict, lang, template);
      contentBlock.appendChild(detailedView);
      void animateHistoryTransition(detailedView, "bh-detail-enter", 240);
      let isReturningToList = false;
      const returnToList = async () => {
        if (isReturningToList) return;
        isReturningToList = true;
        await animateHistoryTransition(detailedView, "bh-detail-leave", 200);
        detailedView.remove();
        if (listPanel && isCurrent()) {
          listPanel.style.display = "flex";
          void animateHistoryTransition(listPanel, "bh-panel-enter", 240);
        }
      };
      detailedView.querySelector("#bh-detailed-back")?.addEventListener("click", () => {
        void returnToList();
      });
    };
    const buildBattleCard = async (b, dict, lang) => {
      const card = document.createElement("article");
      card.innerHTML = buildCardMarkup(b, dict, lang, await loadTemplate("card"));
      card.style.cursor = "pointer";
      lifecycle21.listen(card, "click", () => renderDetailedMatch(b, dict, lang));
      return card;
    };
    const buildPageNumbers = (current, total) => {
      if (total <= 7) {
        const arr = [];
        for (let i = 1; i <= total; i++) arr.push(i);
        return arr;
      }
      const result = [];
      result.push(1);
      if (current > 4) result.push("\u2026");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) result.push(i);
      if (current < total - 3) result.push("\u2026");
      result.push(total);
      return result;
    };
    const renderPagination = (current, total) => {
      const list = document.getElementById("bh-page-list");
      if (!list) return;
      list.textContent = "";
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "bh-page bh-page-arrow";
      prev.textContent = "\u2039";
      prev.disabled = current <= 1;
      lifecycle21.listen(prev, "click", () => renderBattleList(current - 1));
      list.appendChild(prev);
      const pages = buildPageNumbers(current, total);
      for (const p of pages) {
        if (p === "\u2026") {
          const dots = document.createElement("span");
          dots.className = "bh-page bh-page-dots";
          dots.textContent = "\u2026";
          list.appendChild(dots);
          continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bh-page" + (p === current ? " bh-page-active" : "");
        btn.textContent = String(p);
        lifecycle21.listen(btn, "click", () => renderBattleList(p));
        list.appendChild(btn);
      }
      const next = document.createElement("button");
      next.type = "button";
      next.className = "bh-page bh-page-arrow";
      next.textContent = "\u203A";
      next.disabled = current >= total;
      lifecycle21.listen(next, "click", () => renderBattleList(current + 1));
      list.appendChild(next);
    };
    const getBattleKey = (battle) => battle.id !== void 0 ? `id:${battle.id}` : `date:${battle.date}|${battle.map}|${battle.mode}`;
    const playPendingBattleListAnimation = () => {
      if (!pendingBattleListAnimation) return;
      const listEl = document.querySelector(".bh-list");
      if (listEl) {
        listEl.classList.add("bh-list--animations-ready");
        listEl.querySelectorAll(".bh-card--rise-in").forEach((card) => {
          const delay = parseFloat(card.style.animationDelay) || 0;
          lifecycle21.timeout(() => {
            card.classList.remove("bh-card--rise-in");
            card.style.removeProperty("animation-delay");
            card.style.removeProperty("z-index");
            if (!listEl.querySelector(".bh-card--rise-in")) {
              listEl.classList.remove("bh-list--animations-ready");
            }
          }, delay + 400);
        });
      }
      pendingBattleListAnimation = false;
    };
    const clearBattleListAnimations = (panel) => {
      panel.querySelectorAll(".bh-card--rise-in, .bh-card--new-in, .bh-card--push-down").forEach((card) => {
        card.classList.remove("bh-card--rise-in", "bh-card--new-in", "bh-card--push-down");
        card.style.removeProperty("animation-delay");
        card.style.removeProperty("z-index");
        card.style.removeProperty("--bh-push-distance");
      });
      panel.querySelector(".bh-list")?.classList.remove("bh-list--animations-ready");
      pendingBattleListAnimation = false;
    };
    const renderBattleList = async (page = 1, animateNewMatches = false) => {
      if (historyContext.invalidated) return;
      account.updateIdentity();
      const listEl = document.querySelector(".bh-list");
      if (!listEl) return;
      const revision = ++listRevision;
      const userId = account.getUserId();
      const isCurrent = () => !historyContext.invalidated && revision === listRevision && userId === account.getUserId() && document.querySelector(".bh-list") === listEl;
      const lang = state.lang;
      const dict = getHistoryDictionary(lang);
      let battles;
      if (!userId) {
        listEl.textContent = dict.accountUnavailable;
        return;
      }
      try {
        battles = await getAllBattles(userId);
      } catch (error) {
        if (!historyContext.handle(error, lang)) console.error("[BattleHistory] Failed to load battles:", error);
        return;
      }
      if (!isCurrent()) return;
      battles.sort((a, b) => b.date - a.date);
      const newestBattleKey = battles.length > 0 ? getBattleKey(battles[0]) : null;
      let animationMode = null;
      if (animateNewMatches && page === 1) {
        if (!hasRenderedBattleList && battles.length > 0) {
          animationMode = "initial";
        } else if (newestBattleKey && newestBattleKey !== lastRenderedNewestBattleKey) {
          animationMode = "new-match";
        }
      }
      const totalPages = Math.max(1, Math.ceil(battles.length / ROWS_PER_PAGE));
      if (page > totalPages) page = totalPages;
      if (page < 1) page = 1;
      const startIndex = (page - 1) * ROWS_PER_PAGE;
      const pageBattles = battles.slice(startIndex, startIndex + ROWS_PER_PAGE);
      let cards;
      try {
        cards = await Promise.all(pageBattles.map((b) => buildBattleCard(b, dict, lang)));
      } catch (error) {
        if (!historyContext.handle(error, lang)) console.error("[BattleHistory] Failed to render battles:", error);
        return;
      }
      if (!isCurrent()) return;
      if (page === 1) {
        hasRenderedBattleList = true;
        lastRenderedNewestBattleKey = newestBattleKey;
      }
      listEl.classList.remove("bh-list--animations-ready");
      pendingBattleListAnimation = false;
      listEl.innerHTML = "";
      if (pageBattles.length === 0) {
        listEl.innerHTML = `<div class="bh-empty">${dict.noBattles}</div>`;
      } else {
        cards.forEach((card, index) => {
          const visualCard = card.querySelector(".bh-card");
          if (visualCard && animationMode === "initial") {
            visualCard.classList.add("bh-card--rise-in");
            const delay = index * 60;
            visualCard.style.animationDelay = `${delay}ms`;
            visualCard.style.zIndex = String(cards.length - index);
          } else if (visualCard && animationMode === "new-match") {
            if (index === 0) {
              visualCard.classList.add("bh-card--new-in");
            } else {
              visualCard.classList.add("bh-card--push-down");
            }
          }
          listEl.appendChild(card);
        });
        if (animationMode === "new-match" && cards.length > 1) {
          const newCard = cards[0].querySelector(".bh-card");
          const gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
          const pushDistance = (newCard?.getBoundingClientRect().height || 0) + gap;
          cards.slice(1).forEach((card) => {
            card.querySelector(".bh-card")?.style.setProperty("--bh-push-distance", `-${pushDistance}px`);
          });
        }
        pendingBattleListAnimation = animationMode !== null;
      }
      renderPagination(page, totalPages);
      const totalEl = document.getElementById("bh-total-battles");
      if (totalEl) totalEl.textContent = String(battles.length);
    };
    return {
      renderBattleList,
      buildBattleCard,
      renderDetailedMatch,
      playPendingBattleListAnimation,
      reset() {
        listRevision++;
        detailRevision++;
        hasRenderedBattleList = false;
        lastRenderedNewestBattleKey = null;
        pendingBattleListAnimation = false;
      }
    };
  }
  var lifecycle21;
  var init_views = __esm({
    "src/modules/battleHistory/views.ts"() {
      "use strict";
      init_featureRuntime();
      init_state();
      init_presentation();
      init_repository();
      init_localization();
      init_context();
      lifecycle21 = featureScope("battleHistory");
    }
  });

  // src/modules/battleHistory/validation.ts
  function parseHistoryImport(text2, userId) {
    if (normalizeAccountId(userId) !== userId) throw new Error("account-id-required");
    const data = JSON.parse(text2);
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty-or-invalid-list");
    return data.map((value) => {
      const battle = validateImportedBattle(value);
      if (!battle || battle.userId !== userId) throw new Error("invalid-battle-record-or-owner");
      return battle;
    });
  }
  var validateImportedBattle;
  var init_validation = __esm({
    "src/modules/battleHistory/validation.ts"() {
      "use strict";
      init_historyMarkup();
      init_accountId();
      init_battleIdentity();
      validateImportedBattle = (value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const battle = value;
        const battleId = getBattleIdentity(battle);
        if (!battleId) return null;
        if (typeof battle.userId !== "string" || normalizeAccountId(battle.userId) !== battle.userId) return null;
        const requiredStrings = ["nickname", "status", "map", "mode", "top"];
        const requiredNumbers = ["date", "reputation", "kills", "deaths", "kd", "crystals", "stars"];
        if (requiredStrings.some((key) => typeof battle[key] !== "string")) return null;
        if (requiredNumbers.some((key) => typeof battle[key] !== "number" || !Number.isFinite(battle[key]))) return null;
        if (typeof battle.date !== "number" || battle.date <= 0) return null;
        if (battle.kind !== void 0 && battle.kind !== "MM" && battle.kind !== "PRO") return null;
        const iconFields = ["turretIcon", "turretAugmentIcon", "hullIcon", "hullAugmentIcon"];
        if (iconFields.some((key) => battle[key] !== void 0 && typeof battle[key] !== "string")) return null;
        const teamFields = ["teamScoreMy", "teamScoreEnemy"];
        if (teamFields.some((key) => battle[key] !== void 0 && (typeof battle[key] !== "number" || !Number.isFinite(battle[key])))) return null;
        let players2 = [];
        if (battle.players !== void 0) {
          if (!Array.isArray(battle.players)) return null;
          for (const value2 of battle.players) {
            if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return null;
            const player = value2;
            if (typeof player.name !== "string" || typeof player.rank !== "string") return null;
            const numericFields = ["gs", "score", "kills", "deaths", "kd", "crystals", "stars"];
            if (numericFields.some((key) => typeof player[key] !== "number" || !Number.isFinite(player[key]))) return null;
            if (typeof player.isEnemy !== "boolean" || typeof player.isMe !== "boolean") return null;
            players2.push({
              name: player.name,
              rank: getTankiImageUrl(player.rank),
              gs: player.gs,
              score: player.score,
              kills: player.kills,
              deaths: player.deaths,
              kd: player.kd,
              crystals: player.crystals,
              stars: player.stars,
              isEnemy: player.isEnemy,
              isMe: player.isMe
            });
          }
        }
        return {
          battleId,
          userId: battle.userId,
          nickname: battle.nickname,
          date: battle.date,
          status: battle.status,
          map: battle.map,
          mode: battle.mode,
          kind: battle.kind,
          top: battle.top,
          reputation: battle.reputation,
          kills: battle.kills,
          deaths: battle.deaths,
          kd: battle.kd,
          crystals: battle.crystals,
          stars: battle.stars,
          turretIcon: getTankiImageUrl(battle.turretIcon),
          turretAugmentIcon: getTankiImageUrl(battle.turretAugmentIcon),
          hullIcon: getTankiImageUrl(battle.hullIcon),
          hullAugmentIcon: getTankiImageUrl(battle.hullAugmentIcon),
          teamScoreMy: battle.teamScoreMy,
          teamScoreEnemy: battle.teamScoreEnemy,
          players: players2
        };
      };
    }
  });

  // src/modules/battleHistory/actions.ts
  function createActionButton(label, secondary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kasp-modal-button" + (secondary ? " kasp-modal-button--secondary" : "");
    const text2 = document.createElement("span");
    text2.textContent = label;
    button.appendChild(text2);
    return button;
  }
  function createHistoryActions(account, renderBattleList) {
    async function showClearConfirmModal(onConfirm) {
      if (document.getElementById("clear-confirm-overlay")) return;
      const dict = getClearHistoryDictionary(state.lang);
      try {
        const modal = await createKaspModal({ id: "clear-confirm-overlay", title: dict.title, closeLabel: dict.cancel });
        if (!modal) return;
        modal.actions.classList.add("kasp-modal-actions--center");
        const message = document.createElement("p");
        message.className = "kasp-modal-copy kasp-modal-copy--center";
        message.textContent = dict.text;
        modal.body.appendChild(message);
        const cancelButton = createActionButton(dict.cancel, true);
        const confirmButton = createActionButton(dict.confirm);
        modal.actions.append(cancelButton, confirmButton);
        let confirmed = false;
        lifecycle22.listen(cancelButton, "click", modal.close);
        lifecycle22.listen(confirmButton, "click", () => {
          if (confirmed) return;
          confirmed = true;
          modal.close();
          onConfirm();
        });
      } catch (error) {
        console.error("[Kaspersky Inventions] Failed to load clear history modal template:", error);
      }
    }
    const clearHistoryDb = () => {
      account.updateIdentity();
      const userId = account.getUserId();
      if (!userId) return;
      void showClearConfirmModal(async () => {
        try {
          account.updateIdentity();
          if (lifecycle22.disabled || userId !== account.getUserId()) return;
          await clearAccountHistory(userId);
          await renderBattleList(1);
        } catch (error) {
          console.error("[Tanki Battle History] Error clearing DB:", error);
        }
      });
    };
    const exportHistoryData = async () => {
      account.updateIdentity();
      const userId = account.getUserId();
      if (!userId) return;
      try {
        const battles = await getAllBattles(userId);
        account.updateIdentity();
        if (lifecycle22.disabled || userId !== account.getUserId() || battles.length === 0) return;
        const blob = new Blob([JSON.stringify(battles, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = `Tanki_BattleHistory_${userId}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
          link.click();
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("[Tanki Battle History] Export error:", error);
      }
    };
    const showImportError = (error) => {
      console.error("[Tanki Battle History] Import error:", error);
      window.alert(getHistoryMessages(state.lang).importFailed);
    };
    const importHistoryData = () => {
      account.updateIdentity();
      const userId = account.getUserId();
      if (!userId) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = lifecycle22.guard((e) => {
        const target = e.target;
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = lifecycle22.guard(async (ev) => {
          try {
            account.updateIdentity();
            if (lifecycle22.disabled || userId !== account.getUserId()) return;
            const battles = parseHistoryImport(String(ev.target?.result ?? ""), userId);
            const added = await addBattles(battles, userId);
            if (lifecycle22.disabled) return;
            await renderBattleList(1);
            if (lifecycle22.disabled) return;
            window.alert(getHistoryMessages(state.lang).imported(added));
          } catch (err) {
            showImportError(err);
          }
        });
        reader.onerror = lifecycle22.guard(() => showImportError(reader.error));
        reader.readAsText(file);
      });
      input.click();
    };
    return { clearHistoryDb, exportHistoryData, importHistoryData };
  }
  var lifecycle22;
  var init_actions = __esm({
    "src/modules/battleHistory/actions.ts"() {
      "use strict";
      init_featureRuntime();
      init_state();
      init_modal();
      init_repository();
      init_validation();
      init_localization();
      lifecycle22 = featureScope("battleHistory");
    }
  });

  // src/modules/battleHistory/navigation.ts
  function createHistoryNavigation(options) {
    const { ensureHistoryPage, renderBattleList, playPendingBattleListAnimation } = options;
    let shortcutsBound = false;
    let opening = false;
    const HISTORY_BG = "radial-gradient(rgb(15, 17, 22) 0%, rgb(3, 5, 8) 100%)";
    let backgroundContainer = null;
    let previousBackground = null;
    let previousBackgroundPriority = "";
    const applyHistoryBackground = () => {
      backgroundContainer = document.querySelector(gameDOM.common.appContainer) ?? document.querySelector(gameDOM.common.container);
      if (!backgroundContainer) return;
      previousBackground = backgroundContainer.style.background || null;
      previousBackgroundPriority = backgroundContainer.style.getPropertyPriority("background");
      backgroundContainer.style.setProperty("background", HISTORY_BG, "important");
    };
    const restoreContainerBackground = () => {
      if (!backgroundContainer) return;
      if (previousBackground) {
        backgroundContainer.style.setProperty("background", previousBackground, previousBackgroundPriority);
      } else {
        backgroundContainer.style.removeProperty("background");
      }
      backgroundContainer = null;
      previousBackground = null;
    };
    let exitAfterReturn = false;
    let returnObserver = null;
    let returnTimer = 0;
    let returnBackTimer = 0;
    let returnLoaderTimer = 0;
    let returnLoaderObserver = null;
    const showFakeLoader = () => {
      document.querySelector(".kasp-loader-overlay")?.remove();
      const host = document.querySelector(gameDOM.common.appContainer) ?? document.querySelector(gameDOM.common.container) ?? document.body;
      const baseFont = getComputedStyle(host).fontSize;
      const overlay = document.createElement("div");
      overlay.className = "kasp-loader-overlay";
      overlay.innerHTML = `
        <div class="kasp-loader-logo"></div>
        <div class="kasp-loader-bar">
            <span class="kasp-loader-text">${getHistoryDictionary(state.lang).loading}</span>
            <div class="kasp-loader-progress"></div>
        </div>
    `;
      overlay.style.setProperty("font-size", baseFont, "important");
      document.body.appendChild(overlay);
    };
    const hideFakeLoader = () => {
      const overlay = document.querySelector(".kasp-loader-overlay");
      if (!overlay) return;
      overlay.style.setProperty("transition", "opacity 0.1s ease", "important");
      void overlay.offsetHeight;
      overlay.style.setProperty("opacity", "0", "important");
      lifecycle23.timeout(() => overlay.remove(), 120);
    };
    const flashHideSettings = () => {
      if (document.getElementById("bh-flash-cover")) return;
      const cover = document.createElement("div");
      cover.id = "bh-flash-cover";
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
      const watch = lifecycle23.observer(() => {
        if (!document.querySelector(gameDOM.navigation.header)) {
          cover.style.opacity = "0";
          lifecycle23.timeout(() => {
            watch.disconnect();
            cover.remove();
          }, 200);
        }
      });
      watch.observe(document.body, { childList: true, subtree: true });
      lifecycle23.timeout(() => {
        watch.disconnect();
        cover.remove();
      }, 2e3);
    };
    const disarmReturnWatcher = () => {
      exitAfterReturn = false;
      lifecycle23.cancelTimeout(returnTimer);
      lifecycle23.cancelTimeout(returnBackTimer);
      lifecycle23.cancelTimeout(returnLoaderTimer);
      returnLoaderObserver?.disconnect();
      returnLoaderObserver = null;
      returnObserver?.disconnect();
      returnObserver = null;
    };
    const armExitAfterReturn = () => {
      disarmReturnWatcher();
      exitAfterReturn = true;
      returnObserver = lifecycle23.observer(() => {
        if (!exitAfterReturn) return;
        if (!document.querySelector(gameDOM.navigation.header)) {
          disarmReturnWatcher();
          return;
        }
        const titleEl = document.querySelector(
          gameDOM.navigation.title
        );
        const text2 = (titleEl?.textContent?.trim() ?? "").toUpperCase();
        if (text2 === "SETTINGS" || text2 === "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418") {
          disarmReturnWatcher();
          showFakeLoader();
          const finishLoading = () => {
            returnLoaderObserver?.disconnect();
            returnLoaderObserver = null;
            lifecycle23.cancelTimeout(returnLoaderTimer);
            hideFakeLoader();
          };
          returnLoaderObserver = lifecycle23.observer(() => {
            if (!document.querySelector(gameDOM.navigation.header)) {
              finishLoading();
            }
          });
          returnLoaderObserver.observe(document.body, { childList: true, subtree: true });
          returnLoaderTimer = lifecycle23.timeout(finishLoading, 2e3);
          returnBackTimer = lifecycle23.timeout(() => {
            const backBtn = document.querySelector(
              gameDOM.navigation.back
            );
            if (backBtn) backBtn.click();
          }, 150);
        }
      });
      returnObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      returnTimer = lifecycle23.timeout(() => {
        if (exitAfterReturn) {
          disarmReturnWatcher();
        }
      }, 2e4);
    };
    let pageObserver = null;
    let resizeHandler = null;
    let nativeContent = null;
    let previousNativeDisplay = "";
    const releasePage = (overlay) => {
      const modal = document.getElementById("clear-confirm-overlay");
      modal?.closeDialogMethod?.();
      overlay.style.display = "none";
      restoreContainerBackground();
      if (nativeContent) nativeContent.style.display = previousNativeDisplay;
      nativeContent = null;
      pageObserver?.disconnect();
      pageObserver = null;
      if (resizeHandler) lifecycle23.unlisten(window, "resize", resizeHandler);
      resizeHandler = null;
    };
    const closeHistoryOverlay = (overlay, auto = false) => {
      releasePage(overlay);
      if (auto) armExitAfterReturn();
      const title = document.querySelector(gameDOM.navigation.title);
      if (title?.textContent?.trim() === getHistoryDictionary(state.lang).title.toUpperCase()) {
        flashHideSettings();
        document.querySelector(gameDOM.navigation.back)?.click();
      }
    };
    const watchNativePage = (overlay, ourTitle) => {
      pageObserver?.disconnect();
      pageObserver = lifecycle23.observer(() => {
        if (!document.querySelector(gameDOM.navigation.header)) {
          releasePage(overlay);
          return;
        }
        const title = document.querySelector(gameDOM.navigation.title);
        const anotherPage = document.querySelector([
          gameDOM.screens.shop,
          gameDOM.screens.invitations,
          gameDOM.screens.progress
        ].join(", "));
        if (anotherPage || title && title.textContent?.trim() !== ourTitle) {
          closeHistoryOverlay(overlay, true);
        }
      });
      pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    const waitForSelector = (selector, timeoutMs = 3e3) => {
      const existing = document.querySelector(selector);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        let timer = 0;
        const finish = (element) => {
          obs.disconnect();
          lifecycle23.cancelTimeout(timer);
          resolve(element);
        };
        const obs = lifecycle23.observer(() => {
          const el = document.querySelector(selector);
          if (el) finish(el);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        timer = lifecycle23.timeout(() => finish(null), timeoutMs);
      });
    };
    const bindOverlayToHeader = (overlay, header) => {
      const update = () => {
        const r = header.getBoundingClientRect();
        overlay.style.top = `${r.bottom}px`;
        overlay.style.height = `calc(100vh - ${r.bottom}px)`;
      };
      update();
      if (resizeHandler) lifecycle23.unlisten(window, "resize", resizeHandler);
      resizeHandler = update;
      lifecycle23.listen(window, "resize", update);
    };
    const openAsNativePage = async (overlay) => {
      const dict = getHistoryDictionary(state.lang);
      disarmReturnWatcher();
      if (pageObserver) releasePage(overlay);
      let header = document.querySelector(gameDOM.navigation.header);
      if (!header) {
        const settingsBtn = [...document.querySelectorAll(
          gameDOM.navigation.primaryItem
        )].find((el) => {
          if (el.querySelector(gameDOM.navigation.settingsIcon)) return true;
          const name = (el.querySelector(gameDOM.navigation.primaryItemName)?.textContent?.trim() ?? "").toUpperCase();
          return name === "SETTINGS" || name === "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418";
        });
        if (!settingsBtn) {
          console.warn("[BattleHistory] settings trigger not found");
          return false;
        }
        settingsBtn.click();
        header = await waitForSelector(
          gameDOM.navigation.header,
          3e3
        );
      }
      if (!header) return false;
      const title = header.querySelector(gameDOM.navigation.title);
      if (title) title.textContent = dict.title.toUpperCase();
      nativeContent = document.querySelector(gameDOM.navigation.settingsContent);
      if (nativeContent) {
        previousNativeDisplay = nativeContent.style.display;
        nativeContent.style.display = "none";
      }
      const ownHeader = overlay.querySelector(".custom-history-header");
      if (ownHeader) ownHeader.style.display = "none";
      overlay.style.position = "fixed";
      overlay.style.left = "0";
      overlay.style.right = "0";
      overlay.style.bottom = "0";
      overlay.style.zIndex = "50";
      bindOverlayToHeader(overlay, header);
      applyHistoryBackground();
      watchNativePage(overlay, dict.title.toUpperCase());
      overlay.style.display = "flex";
      return true;
    };
    const injectFooterButton = () => {
      const footerList = document.querySelector(gameDOM.navigation.footerList);
      if (!footerList || footerList.querySelector(".custom-history-button")) return;
      const lang = state.lang;
      const dict = getHistoryDictionary(lang);
      const btn = document.createElement("li");
      btn.className = gameDOM.classes.footerEntry + " custom-history-button";
      btn.innerHTML = "<div></div>";
      btn.title = dict.title;
      lifecycle23.listen(btn, "click", async () => {
        if (opening) return;
        opening = true;
        const hidden = [];
        const rootVisibility = document.documentElement.style.visibility;
        const bodyVisibility = document.body.style.visibility;
        const hideGameUI = () => {
          const children = Array.from(document.body.children);
          for (const el of children) {
            if (el.classList.contains("kasp-loader-overlay")) continue;
            if (el.classList.contains("custom-history-overlay")) continue;
            if (el.id === "quick-upgrade-overlay") continue;
            if (el.id === "kasp-welcome-overlay") continue;
            if (el.id === "kasp-specs-tooltip") continue;
            hidden.push({ el, prev: el.style.visibility });
            el.style.visibility = "hidden";
          }
          document.documentElement.style.visibility = "hidden";
          document.body.style.visibility = "visible";
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
          const overlay = document.querySelector(".custom-history-overlay");
          if (!overlay) return;
          await renderBattleList(1, true);
          const duration = 500 + Math.random() * 2500;
          await new Promise((r) => lifecycle23.timeout(r, duration));
          if (document.querySelector(".custom-history-overlay") !== overlay) return;
          const ok = await openAsNativePage(overlay);
          if (document.querySelector(".custom-history-overlay") !== overlay) return;
          if (!ok) {
            const ownHeader = overlay.querySelector(".custom-history-header");
            if (ownHeader) ownHeader.style.display = "";
            overlay.style.top = "0";
            overlay.style.height = "100vh";
            overlay.style.display = "flex";
          }
          playPendingBattleListAnimation();
          showGameUI();
          await new Promise((resolve) => {
            let frames = 0;
            const tick = () => {
              frames++;
              if (frames >= 3) resolve();
              else lifecycle23.frame(tick);
            };
            lifecycle23.frame(tick);
          });
        } catch (error) {
          console.error("[BattleHistory] Failed to open history:", error);
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
      lifecycle23.listen(document, "keydown", (e) => {
        const overlay = document.querySelector(".custom-history-overlay");
        const isHistoryOpen = overlay && window.getComputedStyle(overlay).display !== "none";
        if (!isHistoryOpen) return;
        if (e.code === "Space" || /^(Digit|Numpad)[1-7]$/.test(e.code)) {
          if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }, true);
      lifecycle23.listen(window, "keydown", (e) => {
        if (document.getElementById("clear-confirm-overlay")) return;
        const overlay = document.querySelector(".custom-history-overlay");
        if (overlay && overlay.style.display === "flex") {
          if (e.code === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
            if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
            closeHistoryOverlay(overlay);
            e.preventDefault();
          }
        }
      });
      lifecycle23.listen(document, "mousedown", (e) => {
        const overlay = document.querySelector(".custom-history-overlay");
        if (overlay && overlay.style.display === "flex" && e.button === 3) {
          closeHistoryOverlay(overlay);
          e.preventDefault();
        }
      }, true);
    };
    return {
      injectFooterButton,
      bindShortcuts,
      closeHistoryOverlay,
      release(overlay) {
        releasePage(overlay);
        disarmReturnWatcher();
      }
    };
  }
  var lifecycle23;
  var init_navigation = __esm({
    "src/modules/battleHistory/navigation.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_localization();
      lifecycle23 = featureScope("battleHistory");
    }
  });

  // src/modules/battleHistory/unassigned.ts
  function readUnassignedResults() {
    try {
      const raw = sessionStorage.getItem(UNASSIGNED_HISTORY_KEY);
      if (!raw || raw.length > 2e6) return [];
      const entries = JSON.parse(raw);
      return Array.isArray(entries) ? entries.filter((entry) => !!entry && entry.owner === null && typeof entry.id === "string" && typeof entry.savedAt === "number" && Date.now() - entry.savedAt < 864e5 && !!entry.result && typeof entry.result === "object").slice(-20) : [];
    } catch {
      return [];
    }
  }
  function stashUnassignedResult(battle) {
    try {
      const { userId: _owner, id: _localKey, ...result } = battle;
      const id = crypto.randomUUID();
      const entries = [...readUnassignedResults(), { id, owner: null, savedAt: Date.now(), result }].slice(-20);
      const raw = JSON.stringify(entries);
      if (raw.length > 2e6) return null;
      sessionStorage.setItem(UNASSIGNED_HISTORY_KEY, raw);
      return id;
    } catch {
      return null;
    }
  }
  function removeUnassignedResult(id) {
    try {
      sessionStorage.setItem(UNASSIGNED_HISTORY_KEY, JSON.stringify(readUnassignedResults().filter((entry) => entry.id !== id)));
    } catch {
    }
  }
  var UNASSIGNED_HISTORY_KEY;
  var init_unassigned = __esm({
    "src/modules/battleHistory/unassigned.ts"() {
      "use strict";
      UNASSIGNED_HISTORY_KEY = "kasp_history_unassigned_v1";
    }
  });

  // src/modules/battleHistory/capture.ts
  function readInteger(row, column) {
    return parseInt((row.querySelector(gameDOM.results.columnPrefix + column)?.textContent || "0").replace(/\s/g, "")) || 0;
  }
  function readPlayers(tbody) {
    const players2 = [];
    if (tbody) {
      const allRows = Array.from(tbody.children);
      let isEnemyTeam = false;
      for (const row of allRows) {
        if (row.id === gameDOM.ids.spacer) continue;
        if (row.id === gameDOM.ids.teamDivider) {
          isEnemyTeam = true;
          continue;
        }
        const nickEl = row.querySelector(gameDOM.results.playerName);
        if (!nickEl) continue;
        const rawNick = nickEl.textContent || "";
        const rankImg = row.querySelector(gameDOM.results.rankIcon);
        const rankSrc = rankImg ? rankImg.src : "";
        const gsEl = row.querySelector(gameDOM.results.gearScore);
        const gs = gsEl ? gsEl.textContent?.trim().replace(/\s/g, "") : "0";
        const pScore = readInteger(row, 3);
        const pKills = readInteger(row, 4);
        const pDeaths = readInteger(row, 5);
        const pKd = parseFloat(row.querySelector(gameDOM.results.kd)?.textContent || "0") || 0;
        const pCrystals = readInteger(row, 7);
        const pStars = readInteger(row, 8);
        const isMe = row.id === gameDOM.ids.selfRow;
        players2.push({
          name: rawNick,
          rank: rankSrc,
          gs: parseInt(gs || "0") || 0,
          score: pScore,
          kills: pKills,
          deaths: pDeaths,
          kd: pKd,
          crystals: pCrystals,
          stars: pStars,
          isEnemy: isEnemyTeam,
          isMe
        });
      }
    }
    return players2;
  }
  function readPlacement(selfRow) {
    let firstTeam = true;
    let topVal = "-";
    if (selfRow.parentElement) {
      const allRows = Array.from(selfRow.parentElement.children);
      const selfIndex = allRows.indexOf(selfRow);
      const teamDividerIndex = allRows.findIndex((r) => r.id === gameDOM.ids.teamDivider);
      firstTeam = teamDividerIndex === -1 || selfIndex <= teamDividerIndex;
      let teamRows = [];
      if (teamDividerIndex === -1) teamRows = allRows;
      else if (selfIndex < teamDividerIndex) teamRows = allRows.slice(0, teamDividerIndex);
      else teamRows = allRows.slice(teamDividerIndex + 1);
      const actualPlayers = teamRows.filter((r) => r.id && r.id !== gameDOM.ids.spacer && r.id !== gameDOM.ids.teamDivider);
      const rank = actualPlayers.indexOf(selfRow) + 1;
      if (rank > 0) topVal = rank.toString();
    }
    return { top: topVal, firstTeam };
  }
  function readBattleResult(selfRow, nickname, userId) {
    const scoreEl = selfRow.querySelector(gameDOM.results.score);
    const killsEl = selfRow.querySelector(gameDOM.results.kills);
    const deathsEl = selfRow.querySelector(gameDOM.results.deaths);
    if (!scoreEl || !killsEl || !deathsEl) return null;
    const scoreText = (scoreEl.textContent || "").trim();
    const killsText = (killsEl.textContent || "").trim();
    const deathsText = (deathsEl.textContent || "").trim();
    if (!scoreText || !killsText || !deathsText) return null;
    const players2 = readPlayers(document.querySelector(gameDOM.results.body));
    const mapEl = document.querySelector(gameDOM.results.mapName);
    const rawMapText = mapEl ? mapEl.textContent?.trim() || "" : "Unknown Map";
    const parsedMapData = parseMapAndMode(rawMapText);
    const statusEl = document.querySelector(gameDOM.results.status) || document.querySelector(gameDOM.results.statusFallback);
    const isDM = parsedMapData.mode.toUpperCase() === "DM" || statusEl && statusEl.textContent?.trim() === "";
    if (isDM) {
      for (const p of players2) {
        p.isEnemy = !p.isMe;
      }
    }
    const statusText = isDM ? "DM" : statusEl ? statusEl.textContent?.trim() || "Victory" : "Victory";
    const { top: topVal, firstTeam } = readPlacement(selfRow);
    let teamScoreMy;
    let teamScoreEnemy;
    if (!isDM) {
      const firstScoreEl = document.querySelector(
        gameDOM.results.firstTeamScore
      );
      const secondScoreEl = document.querySelector(
        gameDOM.results.secondTeamScore
      );
      const firstScore = firstScoreEl ? parseInt((firstScoreEl.textContent || "").replace(/\s/g, ""), 10) : NaN;
      const secondScore = secondScoreEl ? parseInt((secondScoreEl.textContent || "").replace(/\s/g, ""), 10) : NaN;
      if (!isNaN(firstScore) && !isNaN(secondScore)) {
        teamScoreMy = firstTeam ? firstScore : secondScore;
        teamScoreEnemy = firstTeam ? secondScore : firstScore;
      }
    }
    const score = parseInt(scoreText.replace(/\s/g, "")) || 0;
    const kills = parseInt(killsText.replace(/\s/g, "")) || 0;
    const deaths = parseInt(deathsText.replace(/\s/g, "")) || 0;
    const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
    const crystals = readInteger(selfRow, 7);
    const stars = parseInt(selfRow.querySelector(gameDOM.results.stars)?.textContent || "0") || 0;
    const eq = equipmentTracker.get();
    return {
      userId,
      nickname,
      date: Date.now(),
      status: statusText,
      map: parsedMapData.map,
      mode: parsedMapData.mode,
      kind: window.__kaspBattleKind ?? "MM",
      top: topVal,
      reputation: score,
      kills,
      deaths,
      kd,
      crystals,
      stars,
      turretIcon: eq?.turret ?? "",
      turretAugmentIcon: eq?.turretAugment ?? "",
      hullIcon: eq?.hull ?? "",
      hullAugmentIcon: eq?.hullAugment ?? "",
      teamScoreMy,
      teamScoreEnemy,
      players: players2
    };
  }
  function createResultCapture(account) {
    let processedFor = null;
    let resultGeneration = 0;
    let saveAttempt = 0;
    let unassignedId = null;
    const capture = async () => {
      account.updateIdentity();
      const userId = account.getUserId();
      const selfRow = document.querySelector(gameDOM.results.selfRow);
      if (!selfRow || userId !== null && processedFor === userId) return;
      const resultNickname = selfRow.querySelector(gameDOM.results.nicknameCell)?.textContent?.trim().replace(/^\[.*?\]\s*/, "").trim();
      if (!userId) {
        if (processedFor !== null) return;
        if (!unassignedId) {
          const battle = readBattleResult(selfRow, resultNickname || "Unknown", "");
          if (battle) unassignedId = stashUnassignedResult(battle);
        }
        return;
      }
      if (resultNickname && resultNickname !== account.getNickname()) return;
      const generation = resultGeneration;
      const attempt = ++saveAttempt;
      try {
        const battle = readBattleResult(selfRow, account.getNickname(), userId);
        if (!battle) return;
        processedFor = userId;
        await addBattle(battle);
        if (generation === resultGeneration && unassignedId) {
          removeUnassignedResult(unassignedId);
          unassignedId = null;
        }
      } catch (error) {
        console.error("[Tanki Battle History] Error saving battle result:", error);
        if (generation === resultGeneration && attempt === saveAttempt) processedFor = null;
      }
    };
    return {
      capture,
      reset() {
        resultGeneration++;
        processedFor = null;
        unassignedId = null;
      }
    };
  }
  var parseMapAndMode;
  var init_capture = __esm({
    "src/modules/battleHistory/capture.ts"() {
      "use strict";
      init_gameDOM();
      init_equipmentTracker();
      init_repository();
      init_unassigned();
      parseMapAndMode = (rawMapText) => {
        if (!rawMapText) return { map: "Unknown Map", mode: "MM" };
        let text2 = rawMapText.trim();
        const modesList = ["CTF", "TDM", "DM", "CP", "SGE", "RGB", "JGR", "TJR", "ASL", "AR"];
        let foundMode = "MM";
        const parts = text2.split(/\s+/);
        if (parts.length > 0) {
          const lastWord = parts[parts.length - 1].toUpperCase();
          if (modesList.includes(lastWord)) {
            foundMode = parts.pop() || "MM";
            text2 = parts.join(" ");
          }
        }
        const cleanMapName = text2.replace(/\s+/g, " ").trim();
        return { map: cleanMapName || "Unknown", mode: foundMode };
      };
    }
  });

  // src/modules/battleHistory.ts
  var lifecycle24, battleHistory;
  var init_battleHistory = __esm({
    "src/modules/battleHistory.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_utils();
      init_state();
      init_accountIdentity();
      init_historyMarkup();
      init_localization();
      init_views();
      init_actions();
      init_navigation();
      init_capture();
      init_context();
      lifecycle24 = featureScope("battleHistory");
      battleHistory = lifecycle24.initialize(() => {
        let initialized2 = false;
        let currentUserId = null;
        let currentNickname = "Unknown";
        let historyPagePromise = null;
        const updateIdentity = () => {
          const identity2 = getVerifiedAccount();
          const userId = identity2?.userId || null;
          if (userId !== currentUserId) {
            const overlay = document.querySelector(".custom-history-overlay");
            if (overlay) {
              navigation.release(overlay);
              overlay.remove();
            }
            views.reset();
            historyPagePromise = null;
            currentUserId = userId;
          }
          currentNickname = identity2?.nickname || "Unknown";
          return userId !== null;
        };
        const account = {
          getUserId: () => getVerifiedAccount()?.userId === currentUserId ? currentUserId : null,
          getNickname: () => currentNickname,
          updateIdentity
        };
        const views = createHistoryViews(account);
        const actions = createHistoryActions(account, views.renderBattleList);
        const navigation = createHistoryNavigation({
          ensureHistoryPage: () => ensureHistoryPage(),
          renderBattleList: views.renderBattleList,
          playPendingBattleListAnimation: views.playPendingBattleListAnimation
        });
        const results = createResultCapture(account);
        const createHistoryPage = async () => {
          if (document.querySelector(".custom-history-overlay")) return;
          const userId = account.getUserId();
          const lang = state.lang;
          const dict = getHistoryDictionary(lang);
          const templateUrl = chrome.runtime.getURL("templates/battle-history-overlay.html");
          const response = await fetch(templateUrl);
          if (!response.ok) {
            throw new Error(`Failed to load history template: ${response.status}`);
          }
          const template = await response.text();
          if (lifecycle24.disabled || historyContext.invalidated || userId !== account.getUserId() || document.querySelector(".custom-history-overlay")) return;
          const replacements = {
            title: String(dict.title ?? ""),
            clear: String(dict.clear ?? ""),
            export: String(dict.export ?? ""),
            import: String(dict.import ?? ""),
            battles: String(dict.battles ?? "\u0411\u043E\u0451\u0432")
          };
          const html = renderHistoryTemplate(template, replacements);
          const overlay = document.createElement("div");
          overlay.className = "custom-history-overlay";
          overlay.style.display = "none";
          overlay.innerHTML = html;
          document.body.appendChild(overlay);
          overlay.querySelector(".custom-history-close")?.addEventListener("click", () => {
            navigation.closeHistoryOverlay(overlay);
          });
          document.getElementById("bh-clear-btn")?.addEventListener("click", actions.clearHistoryDb);
          document.getElementById("bh-export-btn")?.addEventListener("click", actions.exportHistoryData);
          document.getElementById("bh-import-btn")?.addEventListener("click", actions.importHistoryData);
        };
        const ensureHistoryPage = () => {
          if (historyContext.invalidated) return Promise.resolve();
          updateIdentity();
          if (document.querySelector(".custom-history-overlay")) return Promise.resolve();
          if (!historyPagePromise) {
            const pending = createHistoryPage().catch((error) => {
              if (!historyContext.handle(error, state.lang)) console.error("[BattleHistory] Failed to create history page:", error);
            }).finally(() => {
              if (historyPagePromise === pending) historyPagePromise = null;
            });
            historyPagePromise = pending;
          }
          return historyPagePromise;
        };
        lifecycle24.onCleanup(() => {
          historyContext.invalidated = true;
          results.reset();
          views.reset();
          const overlay = document.querySelector(".custom-history-overlay");
          if (overlay) {
            navigation.release(overlay);
            overlay.remove();
          }
          document.querySelector(".custom-history-button")?.remove();
        });
        return () => {
          if (historyContext.invalidated) return;
          if (!utils.getSetting("k_history", false)) return;
          updateIdentity();
          const inResults = document.querySelector(gameDOM.results.status);
          if (document.querySelector(gameDOM.results.selfRow) && inResults) {
            void results.capture().catch((error) => lifecycle24.fail(error));
          } else if (!inResults) {
            results.reset();
          }
          if (!inResults && ["battle", "loading", "garage"].includes(state.currentScreen)) return;
          if (!initialized2) {
            initialized2 = true;
            navigation.bindShortcuts();
            lifecycle24.timeout(updateIdentity, 5e3);
          }
          navigation.injectFooterButton();
          void ensureHistoryPage();
        };
      }, () => {
      });
    }
  });

  // src/core/bonusPickup.ts
  function ownValue(value, field) {
    if (!value || typeof value !== "object") return void 0;
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && "value" in descriptor ? descriptor.value : void 0;
  }
  function schemaFor(value, registry) {
    for (let prototype = Object.getPrototypeOf(value), depth = 0; prototype && depth < 8; prototype = Object.getPrototypeOf(prototype), depth++) {
      const schema = registry.get(prototype);
      if (schema) return schema;
    }
    return void 0;
  }
  function readBonusPosition(value) {
    if (!value || typeof value !== "object") return null;
    try {
      const schema = schemaFor(value, vectorTypes);
      const coordinates = schema ? [schema.x, schema.y, schema.z].map((field) => ownValue(value, field)) : ["x", "y", "z"].map((field) => ownValue(value, field));
      if (!coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) return null;
      const [x, y, z] = coordinates;
      return { x, y, z };
    } catch {
      return null;
    }
  }
  var OVERDRIVE_BOX_MODEL, BONUS_PICKUP_MESSAGE, vectorTypes;
  var init_bonusPickup = __esm({
    "src/core/bonusPickup.ts"() {
      "use strict";
      init_clientPatches();
      OVERDRIVE_BOX_MODEL = "1647333199409";
      BONUS_PICKUP_MESSAGE = "kasp:bonus-pickup";
      vectorTypes = /* @__PURE__ */ new WeakMap();
    }
  });

  // src/core/overdriveDirection.ts
  function overdriveBearing(target, pose) {
    const dx = target.x - pose.position.x, dy = target.y - pose.position.y;
    if (![dx, dy, pose.yaw].every(Number.isFinite) || Math.hypot(dx, dy) < 100) return null;
    const right = dx * Math.cos(pose.yaw) + dy * Math.sin(pose.yaw);
    const forward = -dx * Math.sin(pose.yaw) + dy * Math.cos(pose.yaw);
    return Math.atan2(right, forward) * 180 / Math.PI;
  }
  function continuousBearing(previous, next) {
    return previous === null ? next : previous + ((next - previous + 540) % 360 + 360) % 360 - 180;
  }
  var OVERDRIVE_DIRECTION_MESSAGE;
  var init_overdriveDirection = __esm({
    "src/core/overdriveDirection.ts"() {
      "use strict";
      init_bonusPickup();
      init_featureRuntime();
      init_pageMessages();
      init_clientPatches();
      OVERDRIVE_DIRECTION_MESSAGE = "kasp:overdrive-direction";
    }
  });

  // src/modules/overdriveTimer.ts
  function createOverdriveCountdown(now = Date.now, boxModel = OVERDRIVE_BOX_MODEL) {
    let readyAt = null;
    return {
      pickup(model) {
        if (model !== boxModel) return false;
        readyAt = now() + OVERDRIVE_COOLDOWN_MS;
        return true;
      },
      reset() {
        readyAt = null;
      },
      remaining() {
        return readyAt === null ? null : Math.max(0, Math.ceil((readyAt - now()) / 1e3));
      }
    };
  }
  function createOverdriveLocations(now = Date.now) {
    const timers = [0, 1].map((index) => ({
      id: index === 0 ? "kasp-overdrive-timer" : "kasp-overdrive-timer-secondary",
      position: null,
      countdown: createOverdriveCountdown(now)
    }));
    return {
      timers,
      pickup(model, rawPosition) {
        if (model !== OVERDRIVE_BOX_MODEL) return false;
        const position = readBonusPosition(rawPosition);
        if (!position) {
          if (timers.every((timer) => timer.position)) return false;
          return timers[0].countdown.pickup(model);
        }
        const nearest = timers.filter((timer) => timer.position).map((timer) => ({
          timer,
          distance: Math.hypot(position.x - timer.position.x, position.y - timer.position.y)
        })).sort((a, b) => a.distance - b.distance)[0];
        const selected = nearest && nearest.distance <= OVERDRIVE_POINT_RADIUS ? nearest.timer : timers.find((timer) => !timer.position);
        if (!selected) return false;
        if (!selected.position) selected.position = position;
        return selected.countdown.pickup(model);
      },
      reset() {
        for (const timer of timers) {
          timer.position = null;
          timer.countdown.reset();
        }
      }
    };
  }
  var lifecycle25, OVERDRIVE_COOLDOWN_MS, OVERDRIVE_POINT_RADIUS, overdriveTimer;
  var init_overdriveTimer = __esm({
    "src/modules/overdriveTimer.ts"() {
      "use strict";
      init_featureRuntime();
      init_pageMessages();
      init_bonusPickup();
      init_gameDOM();
      init_state();
      init_utils();
      init_overdriveDirection();
      lifecycle25 = featureScope("overdriveTimer");
      OVERDRIVE_COOLDOWN_MS = 85e3;
      OVERDRIVE_POINT_RADIUS = 1e3;
      overdriveTimer = lifecycle25.initialize(() => {
        const locations = createOverdriveLocations();
        const timers = locations.timers.map((location2) => ({
          location: location2,
          panel: null,
          time: null,
          bearing: null
        }));
        let pose = null;
        let poseAt = 0;
        let overlay = null;
        let initialized2 = false;
        let battleCanvas = null;
        let sectionOpen = false;
        let resumeUntil = 0;
        let renderInterval;
        let previewObserver;
        function reset() {
          locations.reset();
          pose = null;
          poseAt = 0;
        }
        function removeOverlay() {
          overlay?.remove();
          overlay = null;
          for (const timer of timers) {
            timer.panel = timer.time = null;
            timer.bearing = null;
          }
        }
        function renderDirection(timer) {
          if (!timer.panel) return;
          const bearing = pose && Date.now() - poseAt <= 750 && timer.location.position ? overdriveBearing(timer.location.position, pose) : null;
          timer.panel.classList.toggle("kasp-overdrive-direction", bearing !== null);
          if (bearing === null) {
            timer.bearing = null;
            return;
          }
          const next = continuousBearing(timer.bearing, bearing);
          if (next !== timer.bearing) timer.panel.style.setProperty("--kasp-overdrive-bearing", `${next}deg`);
          timer.bearing = next;
        }
        function isSectionVisible() {
          if (document.querySelector(gameDOM.screens.visibleTankPreview)) return true;
          return Array.from(document.querySelectorAll(gameDOM.common.container)).some((container) => {
            if (!container.getClientRects().length) return false;
            const style = getComputedStyle(container);
            return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" && style.opacity !== "0";
          });
        }
        function syncBattle() {
          const current = document.querySelector(gameDOM.screens.battleCanvas);
          if (document.querySelector(gameDOM.results.status) || document.querySelector(gameDOM.play.mainMenu)) {
            battleCanvas = null;
            sectionOpen = false;
            return false;
          }
          if (battleCanvas && isSectionVisible()) {
            sectionOpen = true;
            resumeUntil = Date.now() + 1e3;
            return true;
          }
          if (sectionOpen && !current && Date.now() < resumeUntil) return true;
          if (current !== battleCanvas) {
            battleCanvas = current;
            if (!sectionOpen || !current) reset();
          }
          sectionOpen = false;
          return !!current;
        }
        function render() {
          const enabled = utils.getSetting("k_overdrive_timer", false);
          if (!enabled) {
            if (renderInterval !== void 0) lifecycle25.cancelInterval(renderInterval);
            renderInterval = void 0;
            previewObserver?.disconnect();
            battleCanvas = null;
            sectionOpen = false;
            resumeUntil = 0;
            reset();
            removeOverlay();
            return;
          }
          if (initialized2 && renderInterval === void 0) {
            previewObserver?.observe(document.documentElement, {
              childList: true,
              attributes: true,
              attributeFilter: ["class", "style", "hidden"],
              subtree: true
            });
            renderInterval = lifecycle25.interval(render, 250);
          }
          const inBattle = syncBattle();
          if (!inBattle) reset();
          const sectionVisible = isSectionVisible();
          for (const timer of timers) renderTimer(timer, inBattle && enabled && !sectionVisible);
          if (overlay && !overlay.children.length) removeOverlay();
        }
        function renderTimer(timer, visible) {
          const seconds = timer.location.countdown.remaining();
          if (!visible || seconds === null) {
            timer.panel?.remove();
            timer.panel = timer.time = null;
            timer.bearing = null;
            return;
          }
          if (!document.body) return;
          if (!overlay?.isConnected) {
            overlay = document.createElement("div");
            overlay.id = "kasp-overdrive-timers";
            overlay.className = "kasp-overdrive-timers";
            document.body.appendChild(overlay);
          }
          if (!timer.panel?.isConnected) {
            timer.panel = document.createElement("div");
            timer.panel.id = timer.location.id;
            timer.panel.className = "kasp-overdrive-timer";
            timer.time = document.createElement("strong");
            timer.panel.append(timer.time);
            overlay.appendChild(timer.panel);
          }
          const { panel, time } = timer;
          const ru = state.lang === "RU";
          const value = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
          if (time.textContent !== value) time.textContent = value;
          panel.classList.toggle("kasp-overdrive-soon", seconds > 0 && seconds <= 10);
          panel.classList.toggle("kasp-overdrive-ready", seconds === 0);
          renderDirection(timer);
          const hint = ru ? "85 \u0441\u0435\u043A\u0443\u043D\u0434 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0431\u043E\u0440\u0430 \u043A\u043E\u0440\u043E\u0431\u043A\u0438. \u0412\u0440\u0435\u043C\u044F \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435." : "85 seconds after a box pickup. Respawn time is an estimate.";
          if (panel.title !== hint) panel.title = hint;
        }
        function setup() {
          if (initialized2) return;
          initialized2 = true;
          lifecycle25.listen(window, "message", (event) => {
            if (!utils.getSetting("k_overdrive_timer", false)) return;
            const direction = readPageMessage(event, window, OVERDRIVE_DIRECTION_MESSAGE);
            if (direction) {
              if (direction.at > Date.now() + 1e3 || direction.at < poseAt || Date.now() - direction.at > 750) return;
              pose = direction.pose;
              poseAt = direction.at;
              for (const timer of timers) renderDirection(timer);
              return;
            }
            const message = readPageMessage(event, window, BONUS_PICKUP_MESSAGE);
            if (!message || !syncBattle()) return;
            const pickup = typeof message.detail === "string" ? { model: message.detail, position: null } : message.detail;
            if (locations.pickup(pickup.model, pickup.position)) render();
          });
          lifecycle25.listen(document, "kasp:battle:id", () => {
            reset();
            render();
          });
          lifecycle25.listen(window, "kasp:settings-changed", render);
          lifecycle25.listen(window, "storage", render);
          previewObserver = lifecycle25.observer((records) => {
            if (!utils.getSetting("k_overdrive_timer", false)) return;
            const selector = `${gameDOM.screens.tankPreview}, ${gameDOM.common.container}`;
            if (records.some((record) => record.type === "childList" ? [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => node.matches?.(selector) || node.querySelector?.(selector)) : record.target.matches(selector))) render();
          });
          render();
        }
        lifecycle25.onCleanup(() => {
          previewObserver?.disconnect();
          renderInterval = void 0;
          reset();
          removeOverlay();
        });
        return { setup, sync: render };
      }, { setup() {
      }, sync() {
      } });
    }
  });

  // src/core/cybersportNative.ts
  var CYBERSPORT_ACTIVE, CYBERSPORT_SYNC;
  var init_cybersportNative = __esm({
    "src/core/cybersportNative.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      CYBERSPORT_ACTIVE = "data-kasp-esports-active";
      CYBERSPORT_SYNC = "kasp:cybersport:sync";
    }
  });

  // src/modules/cybersportSettings.ts
  function createCybersportSettings(schedule) {
    let root = null;
    let observer = null;
    let writing2 = false;
    let closingButton = null;
    let creationRoot = null;
    const locks = /* @__PURE__ */ new Map();
    let rankIcon = null;
    let lastRankAttempt = null;
    let rankJob = null;
    let rankTimer = null;
    const dom = gameDOM.battleCreate;
    const imageKey = (element) => {
      const image = element?.querySelector("img");
      if (!image?.src) return null;
      try {
        return new URL(image.src, location.href).pathname;
      } catch {
        return null;
      }
    };
    const lock = (input, checkbox = false) => {
      if (!locks.has(input)) locks.set(input, { readOnly: input.readOnly, disabled: input.disabled });
      if (checkbox) input.disabled = true;
      else input.readOnly = true;
    };
    const releaseLocks = () => {
      for (const [input, previous] of locks) {
        input.readOnly = previous.readOnly;
        input.disabled = previous.disabled;
      }
      locks.clear();
    };
    const toggleDropdown = (dropdown) => {
      const control = dropdown.querySelector(dom.dropdownControl);
      control?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    };
    const finishRank = (close = false) => {
      if (rankTimer !== null) lifecycle26.cancelTimeout(rankTimer);
      rankTimer = null;
      if (close && rankJob?.opened && rankJob.dropdown.isConnected && rankJob.dropdown.querySelector(dom.dropdownMenu)) {
        const previousWriting = writing2;
        writing2 = true;
        try {
          toggleDropdown(rankJob.dropdown);
        } finally {
          writing2 = previousWriting;
        }
      }
      rankJob = null;
    };
    const onInteraction = (event) => {
      if (writing2) return;
      const target = event.target;
      const minimum = root?.querySelector(dom.rankDropdowns);
      const placeholder = minimum?.querySelector(dom.dropdownPlaceholder);
      const fixedRank = /^(?:первый сержант|first sergeant)$/i.test(placeholder?.textContent?.trim() || "") || rankIcon !== null && imageKey(placeholder || null) === rankIcon;
      const editsRank = event.type === "mousedown" || event.type === "keydown" && ["Enter", " ", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key);
      if (editsRank && fixedRank && target instanceof Node && minimum?.contains(target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      schedule();
    };
    const events = ["input", "change", "click", "mousedown", "keydown"];
    const clear = () => {
      finishRank(true);
      observer?.disconnect();
      observer = null;
      events.forEach((type) => lifecycle26.unlisten(root, type, onInteraction, true));
      releaseLocks();
      creationRoot?.removeAttribute(CYBERSPORT_ACTIVE);
      creationRoot = null;
      document.dispatchEvent(new Event(CYBERSPORT_SYNC));
      root = null;
      closingButton = null;
      rankIcon = lastRankAttempt = null;
    };
    const setNumber = (index, value) => {
      const input = root?.querySelectorAll(dom.parameterInputs)[index];
      if (!input?.isConnected || input.type !== "text") return;
      if (input.value !== value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (!setter || input.disabled) return;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      lock(input);
    };
    const setPrivate = () => {
      const rows = root?.querySelectorAll(dom.optionRows);
      const privateRow = Array.from(rows || []).find((element) => /^(?:закрытая\s+битва|(?:private|closed)(?:\s+battle)?)$/i.test(
        element.querySelector("label[for]")?.textContent?.trim() || ""
      ));
      const input = privateRow?.querySelector('input[type="checkbox"]');
      if (!input?.isConnected) return;
      if (!input.checked) {
        const previous = locks.get(input);
        if (previous) input.disabled = previous.disabled;
        if (input.disabled) return;
        input.click();
      }
      if (input.checked) lock(input, true);
    };
    const closeAdvanced = () => {
      const button = Array.from(root?.querySelectorAll(dom.advancedClose) || []).find((element) => /^(?:закрыть|close)$/i.test(element.textContent?.trim() || ""));
      if (!button) {
        closingButton = null;
        return false;
      }
      if (closingButton !== button) {
        closingButton = button;
        button.click();
        schedule();
      }
      return true;
    };
    const setRank = () => {
      const dropdown = root?.querySelector(dom.rankDropdowns);
      const placeholder = dropdown?.querySelector(dom.dropdownPlaceholder);
      if (!dropdown || !placeholder) {
        finishRank(true);
        return;
      }
      const currentIcon = imageKey(placeholder);
      const name = placeholder.textContent?.replace(/\s+/g, " ").trim() || "";
      if (/^(?:первый сержант|first sergeant)$/i.test(name) || rankIcon && currentIcon === rankIcon) {
        finishRank(true);
        lastRankAttempt = null;
        return;
      }
      const key = `${currentIcon}|${name}`;
      if (rankJob && (rankJob.dropdown !== dropdown || rankJob.key !== key)) finishRank(true);
      if (!rankJob) {
        if (lastRankAttempt === key) return;
        lastRankAttempt = key;
        rankJob = { dropdown, key, until: Date.now() + 2e3, opened: false, clicked: false };
        if (!dropdown.querySelector(dom.dropdownMenu)) {
          rankJob.opened = true;
          toggleDropdown(dropdown);
        }
      }
      if (Date.now() >= rankJob.until) {
        finishRank(true);
        return;
      }
      const menu = dropdown.querySelector(dom.dropdownMenu);
      const firstImage = menu?.querySelector(`${dom.dropdownItems} img`);
      const firstOption = firstImage?.parentElement;
      if (firstOption && !rankJob.clicked) {
        rankIcon = imageKey(firstOption);
        rankJob.clicked = true;
        firstOption.click();
      }
      if (rankTimer === null) rankTimer = lifecycle26.timeout(() => {
        rankTimer = null;
        schedule();
      }, 100);
    };
    const sync = (nextRoot) => {
      if (!nextRoot?.isConnected) {
        clear();
        return;
      }
      const panel = nextRoot.querySelector(dom.options);
      if (!panel) {
        clear();
        return;
      }
      if (root !== panel) {
        clear();
        root = panel;
        events.forEach((type) => lifecycle26.listen(panel, type, onInteraction, true));
        observer = lifecycle26.observer(schedule);
        observer.observe(panel, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["class", "src", "value", "checked"]
        });
      }
      creationRoot = nextRoot;
      if (!nextRoot.hasAttribute(CYBERSPORT_ACTIVE)) nextRoot.setAttribute(CYBERSPORT_ACTIVE, "");
      document.dispatchEvent(new Event(CYBERSPORT_SYNC));
      for (const [input, previous] of locks) if (!panel.contains(input)) {
        input.readOnly = previous.readOnly;
        input.disabled = previous.disabled;
        locks.delete(input);
      }
      if (writing2) return;
      writing2 = true;
      try {
        setNumber(0, "6");
        setNumber(1, "12");
        setPrivate();
        if (closeAdvanced()) return;
        setRank();
      } finally {
        writing2 = false;
      }
    };
    lifecycle26.onCleanup(clear);
    return { sync: lifecycle26.guard(sync), clear };
  }
  var lifecycle26;
  var init_cybersportSettings = __esm({
    "src/modules/cybersportSettings.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_cybersportNative();
      lifecycle26 = featureScope("cybersportSettings");
    }
  });

  // src/modules/cybersport.ts
  var lifecycle27, cybersport;
  var init_cybersport = __esm({
    "src/modules/cybersport.ts"() {
      "use strict";
      init_featureRuntime();
      init_gameDOM();
      init_state();
      init_cybersportSettings();
      lifecycle27 = featureScope("cybersport");
      cybersport = lifecycle27.initialize(() => {
        let row = null;
        let sport = null;
        let card = null;
        let observer = null;
        let chosen = false;
        let selectionUntil = 0;
        let forwarding = false;
        let scheduled = false;
        let modeUntil = 0;
        let modeTimer = null;
        let esportsRoot = null;
        let mapRow = null;
        let mapObserver = null;
        let rejectedSelection = null;
        const mapCards = /* @__PURE__ */ new Set();
        const mapColumns = /* @__PURE__ */ new Set();
        const allowedMaps = /* @__PURE__ */ new Set([
          "/601/107774/12/176/30061777033536/image.webp",
          "/601/107774/12/213/30061777063716/image.webp",
          "/601/107774/12/330/30061777035270/image.webp",
          "/601/107774/12/277/31343433343114/image.webp",
          "/601/107774/13/14/30061777055502/image.webp",
          "/634/136431/332/233/31627506673770/image.webp",
          "/601/107774/13/55/30061777053474/image.webp"
        ]);
        const labels = {
          RU: { name: "\u041A\u0438\u0431\u0435\u0440\u0441\u043F\u043E\u0440\u0442", select: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C", selected: "\u0412\u044B\u0431\u0440\u0430\u043D\u043E" },
          EN: { name: "Esports", select: "Choose", selected: "Chosen" }
        };
        const text2 = (element, value) => {
          if (element && element.textContent !== value) element.textContent = value;
        };
        const findSport = (container) => {
          const nativeCards = Array.from(container.children).filter((element) => element instanceof HTMLElement && element.matches(gameDOM.battleCreate.formatCard) && !element.classList.contains("kasp-cybersport-card"));
          return nativeCards.find((element) => /^(?:спорт|sport)$/i.test(
            element.querySelector(gameDOM.battleCreate.formatName)?.textContent?.trim() || ""
          )) || nativeCards.find((element) => {
            const image = element.querySelector(gameDOM.battleCreate.formatImage);
            return image && getComputedStyle(image).backgroundImage.includes("battle_pick_sport_mode");
          }) || null;
        };
        const schedule = () => {
          if (scheduled) return;
          scheduled = true;
          lifecycle27.frame(() => {
            scheduled = false;
            sync();
          });
        };
        const settings = createCybersportSettings(schedule);
        const cancelModeSelection = () => {
          modeUntil = 0;
          if (modeTimer !== null) lifecycle27.cancelTimeout(modeTimer);
          modeTimer = null;
        };
        const selectMode = (container) => {
          if (!modeUntil) return;
          if (Date.now() >= modeUntil) {
            cancelModeSelection();
            return;
          }
          const ctf = Array.from(container?.querySelectorAll(gameDOM.battleCreate.modeCard) || []).find((element) => Array.from(element.querySelectorAll("h2")).some((label) => label.textContent?.trim() === "CTF"));
          if (ctf) {
            cancelModeSelection();
            ctf.click();
          } else if (modeTimer === null) {
            modeTimer = lifecycle27.timeout(() => {
              modeTimer = null;
              sync();
            }, 100);
          }
        };
        const clearMaps = () => {
          mapObserver?.disconnect();
          mapObserver = null;
          mapRow?.removeAttribute("data-kasp-esports-maps");
          mapCards.forEach((element) => element.removeAttribute("data-kasp-esports-map"));
          mapColumns.forEach((element) => element.removeAttribute("data-kasp-esports-column"));
          mapCards.clear();
          mapColumns.clear();
          mapRow = rejectedSelection = null;
        };
        const allowsMap = (element) => {
          const background = getComputedStyle(element).backgroundImage;
          for (const match of background.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
            try {
              const path = new URL(match[1].trim(), location.href).pathname;
              if (!allowedMaps.has(path)) continue;
              if (path === "/601/107774/12/330/30061777035270/image.webp") {
                const name = element.querySelector(gameDOM.battleCreate.mapName)?.textContent?.replace(/\s+/g, " ").trim() || "";
                return /^(?:red alert|ред алерт) (?:mm|мм)$/i.test(name);
              }
              return true;
            } catch {
            }
          }
          return false;
        };
        const syncMaps = (container) => {
          if (!esportsRoot || container?.closest(gameDOM.battleCreate.root) !== esportsRoot) {
            clearMaps();
            return;
          }
          const cards = Array.from(container.querySelectorAll(gameDOM.battleCreate.mapName)).map((label) => label.parentElement).filter((element) => element instanceof HTMLElement && element.matches(gameDOM.battleCreate.formatImage) && element.parentElement?.parentElement === container);
          if (!cards.length) {
            clearMaps();
            return;
          }
          if (mapRow !== container) {
            clearMaps();
            mapRow = container;
            mapObserver = lifecycle27.observer(schedule);
            mapObserver.observe(container, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
              attributeFilter: ["class", "style"]
            });
          }
          if (!container.hasAttribute("data-kasp-esports-maps")) container.setAttribute("data-kasp-esports-maps", "");
          const allowed = [];
          let excludedSelected = null;
          const currentCards = new Set(cards);
          const currentColumns = new Set(cards.map((element) => element.parentElement));
          for (const element of mapCards) if (!currentCards.has(element)) {
            element.removeAttribute("data-kasp-esports-map");
            mapCards.delete(element);
          }
          for (const element of mapColumns) if (!currentColumns.has(element)) {
            element.removeAttribute("data-kasp-esports-column");
            mapColumns.delete(element);
          }
          for (const element of cards) {
            const show = allowsMap(element);
            const value = show ? "allowed" : "excluded";
            if (element.getAttribute("data-kasp-esports-map") !== value) {
              element.setAttribute("data-kasp-esports-map", value);
            }
            mapCards.add(element);
            const column = element.parentElement;
            if (!column.hasAttribute("data-kasp-esports-column")) column.setAttribute("data-kasp-esports-column", "");
            mapColumns.add(column);
            if (show) allowed.push(element);
            else if (element.querySelector(gameDOM.battleCreate.selectedMap)) excludedSelected = element;
          }
          if (!excludedSelected) rejectedSelection = null;
          else if (allowed.length && excludedSelected !== rejectedSelection) {
            rejectedSelection = excludedSelected;
            allowed[0].click();
            if (mapRow?.isConnected) mapRow.scrollLeft = 0;
          }
        };
        const cancelEsports = () => {
          settings.clear();
          esportsRoot = null;
          chosen = false;
          selectionUntil = 0;
          cancelModeSelection();
          clearMaps();
        };
        const onNativeClick = (event) => {
          if (forwarding || !(event.target instanceof Element)) return;
          const selected = event.target.closest(gameDOM.battleCreate.formatCard);
          if (selected && selected !== card && selected.parentElement === row) {
            cancelEsports();
            schedule();
          }
        };
        const cleanup = () => {
          observer?.disconnect();
          observer = null;
          lifecycle27.unlisten(row, "click", onNativeClick, true);
          sport?.removeAttribute("data-kasp-cybersport-source-active");
          sport?.lastElementChild?.querySelector("h2")?.removeAttribute("data-kasp-select-label");
          card?.remove();
          row = sport = card = null;
          chosen = false;
          selectionUntil = 0;
        };
        const select = () => {
          if (!sport?.isConnected || !row?.contains(sport)) return;
          esportsRoot = sport.closest(gameDOM.battleCreate.root);
          chosen = true;
          selectionUntil = Date.now() + 1e3;
          cancelModeSelection();
          modeUntil = Date.now() + 5e3;
          forwarding = true;
          try {
            sport.click();
          } catch (error) {
            cancelEsports();
            throw error;
          } finally {
            forwarding = false;
            schedule();
          }
        };
        function sync() {
          if (esportsRoot && !esportsRoot.isConnected) cancelEsports();
          let container = document.querySelector(gameDOM.battleCreate.formats);
          if (esportsRoot && container && container.closest(gameDOM.battleCreate.root) !== esportsRoot) cancelEsports();
          selectMode(container);
          container = document.querySelector(gameDOM.battleCreate.formats);
          syncMaps(container);
          settings.sync(esportsRoot);
          const nativeSport = container && findSport(container);
          if (!container || !nativeSport) {
            cleanup();
            return;
          }
          if (row !== container || sport !== nativeSport || !card?.isConnected) {
            cleanup();
            row = container;
            sport = nativeSport;
            chosen = esportsRoot !== null;
            card = nativeSport.cloneNode(true);
            card.classList.add("kasp-cybersport-card");
            card.removeAttribute("id");
            card.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
            card.setAttribute("role", "button");
            card.tabIndex = 0;
            card.style.setProperty("--kasp-cybersport-image", `url("${chrome.runtime.getURL("assets/cybersport.png")}")`);
            lifecycle27.listen(card, "click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              select();
            });
            lifecycle27.listen(card, "keydown", (event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              if (!event.repeat) select();
            });
            row.insertBefore(card, nativeSport.nextSibling);
            lifecycle27.listen(row, "click", onNativeClick, true);
            observer = lifecycle27.observer(schedule);
            observer.observe(row, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
              attributeFilter: ["class"]
            });
          }
          const nativeSelected = sport.classList.contains(gameDOM.classes.formatSelected);
          if (nativeSelected) selectionUntil = 0;
          else if (Date.now() >= selectionUntil) cancelEsports();
          const active = chosen && nativeSelected;
          const label = labels[state.lang];
          text2(card.querySelector(gameDOM.battleCreate.formatName), label.name);
          text2(
            card.querySelector(gameDOM.battleCreate.formatDescription),
            sport.querySelector(gameDOM.battleCreate.formatDescription)?.textContent || ""
          );
          text2(
            card.querySelector(gameDOM.battleCreate.formatCount),
            sport.querySelector(gameDOM.battleCreate.formatCount)?.textContent || ""
          );
          text2(card.lastElementChild?.querySelector("h2") || null, active ? label.selected : label.select);
          card.classList.toggle(gameDOM.classes.formatSelected, active);
          card.classList.toggle(gameDOM.classes.formatUnselected, !active);
          const pressed = String(active);
          if (card.getAttribute("aria-pressed") !== pressed) card.setAttribute("aria-pressed", pressed);
          sport.toggleAttribute("data-kasp-cybersport-source-active", active);
          const nativeAction = sport.lastElementChild?.querySelector("h2");
          if (active && nativeAction?.getAttribute("data-kasp-select-label") !== label.select) {
            nativeAction?.setAttribute("data-kasp-select-label", label.select);
          } else if (!active) nativeAction?.removeAttribute("data-kasp-select-label");
          if (sport.nextSibling !== card) row.insertBefore(card, sport.nextSibling);
          if (chosen && !nativeSelected && Date.now() < selectionUntil) schedule();
        }
        lifecycle27.onCleanup(() => {
          cancelEsports();
          cleanup();
        });
        return sync;
      }, () => {
      });
    }
  });

  // src/modules/index.ts
  function protect(id, value) {
    const scope = featureScope(id);
    if (typeof value === "function") return scope.guard(value);
    return Object.fromEntries(Object.entries(value).map(([key, method]) => [
      key,
      typeof method === "function" ? scope.guard(method.bind(value)) : method
    ]));
  }
  var implementations, modules;
  var init_modules = __esm({
    "src/modules/index.ts"() {
      "use strict";
      init_featureRuntime();
      init_customPaints();
      init_augmentSpecs();
      init_customPlayButton();
      init_customFriends();
      init_garageButtons();
      init_welcomeModal();
      init_hideNickname();
      init_hideCurrency();
      init_hideSupplies();
      init_tankoinBalance();
      init_accountSearchNotice();
      init_lobbyPasses();
      init_lobbyNavigation();
      init_customTrophies();
      init_autoUpgrade();
      init_changeCounter();
      init_customGarageSkins();
      init_zeroResists();
      init_enemyWeapons();
      init_equipmentTracker();
      init_battleHistory();
      init_overdriveTimer();
      init_cybersport();
      implementations = {
        customPaints,
        augmentSpecs,
        customPlayButton,
        customFriends,
        garageButtons,
        welcomeModal,
        hideNickname,
        hideCurrency,
        hideSupplies,
        tankoinBalance,
        accountSearchNotice,
        lobbyPasses,
        lobbyNavigation,
        customTrophies,
        autoUpgrade,
        changeCounter,
        customGarageSkins,
        zeroResists,
        enemyWeapons,
        equipmentTracker,
        battleHistory,
        overdriveTimer,
        cybersport
      };
      modules = Object.fromEntries(Object.entries(implementations).map(([id, value]) => [id, protect(id, value)]));
    }
  });

  // src/boot.ts
  function startBoot() {
    window.addEventListener("storage", (e) => {
      if (e.key === "language_store_key") {
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
      modules.accountSearchNotice();
      modules.hideCurrency();
      modules.lobbyPasses();
      modules.customGarageSkins();
      modules.cybersport();
      if (state.currentScreen === "lobby" || state.currentScreen === "loading") {
        modules.customPlayButton();
      }
      modules.lobbyNavigation();
      if (state.friendsMenuOpen) {
        modules.customFriends();
      }
      if (state.currentScreen === "lobby" || state.currentScreen === "garage" || state.currentScreen === "match_results") {
        modules.customTrophies();
      }
      if (state.currentScreen === "garage") {
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
        const clone = headRow.cloneNode(true);
        clone.classList.add("kasp-cloned-header");
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
        newScreen = "match_results";
      } else if (document.querySelector(gameDOM.screens.loader)) {
        newScreen = "loading";
      } else if (document.querySelector(gameDOM.screens.garage)) {
        newScreen = "garage";
      } else if (document.querySelector(gameDOM.screens.battleHud)) {
        newScreen = "battle";
      } else if (document.querySelector(gameDOM.play.mainMenu)) {
        newScreen = "lobby";
      }
      const screenChanged = newScreen !== state.currentScreen;
      state.currentScreen = newScreen;
      if (screenChanged) {
        if (newScreen === "loading" || newScreen === "battle") {
          const specsTooltip = document.getElementById("kasp-specs-tooltip");
          if (specsTooltip) specsTooltip.style.display = "none";
          const quickUpgradeOverlay = document.getElementById("quick-upgrade-overlay");
          if (quickUpgradeOverlay && quickUpgradeOverlay.closeDialogMethod) {
            quickUpgradeOverlay.closeDialogMethod();
          }
          const historyOverlay = document.querySelector(".custom-history-overlay");
          if (historyOverlay) historyOverlay.style.display = "none";
          const clearConfirmOverlay = document.getElementById("clear-confirm-overlay");
          if (clearConfirmOverlay && clearConfirmOverlay.closeDialogMethod) {
            clearConfirmOverlay.closeDialogMethod();
          } else if (clearConfirmOverlay) {
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
          featureScope("settings").run(coreSettings.inject);
        } else {
          featureScope("settings").run(coreSettings.onClose);
        }
      }
      if (screenChanged || friendsChanged) {
        lastFullRefresh = 0;
        if (refreshScheduled)
          refreshScheduled = false;
        runHeavyModules();
      } else {
        scheduleHeavyModules();
      }
      if (state.currentScreen === "garage") {
        modules.garageButtons();
      }
      modules.battleHistory();
      if (state.currentScreen === "match_results" || state.currentScreen === "lobby") {
        syncKillBoardDoubleHeader();
      }
    };
    const statisticsPresentation = ".kasp-change-th, .kasp-change-td, .kasp-defence-th, .kasp-compact-cell, .kasp-zero-summary, #kasp-tab-toggle-btn, #kasp-enemy-weapons-btn";
    const isOwnStatisticsMutation = (record) => {
      if (record.type !== "childList") return false;
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target?.closest("#kasp-enemy-weapons-tooltip")) return true;
      if (!target?.closest(gameDOM.statistics.container)) return false;
      if (target.closest(statisticsPresentation)) return true;
      if (record.removedNodes.length) return false;
      return record.addedNodes.length > 0 && Array.from(record.addedNodes).every((node) => node.nodeType === 1 && node.matches(statisticsPresentation));
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
        const oldTab = document.getElementById("kaspersky-tab");
        if (oldTab)
          oldTab.remove();
        const oldContent = document.getElementById("kaspersky-settings-content");
        if (oldContent)
          oldContent.remove();
        const oldTooltip = document.getElementById("kaspersky-reload-tooltip");
        if (oldTooltip)
          oldTooltip.remove();
        featureScope("settings").run(coreSettings.inject);
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
        attributeFilter: ["lang"]
      });
      if (!document.documentElement.lang) {
        document.addEventListener("DOMContentLoaded", () => {
          applyLanguageChange();
        }, { once: true });
        window.setTimeout(() => {
          applyLanguageChange();
        }, 500);
        window.setTimeout(() => {
          applyLanguageChange();
        }, 2e3);
      }
    };
    if (document.documentElement) {
      boot();
    } else {
      document.addEventListener("DOMContentLoaded", boot);
    }
  }
  var init_boot = __esm({
    "src/boot.ts"() {
      "use strict";
      init_featureRuntime();
      init_state();
      init_gameDOM();
      init_utils();
      init_coreSettings();
      init_modules();
    }
  });

  // src/core/battlePresence.ts
  var BATTLE_PRESENCE_MESSAGE;
  var init_battlePresence = __esm({
    "src/core/battlePresence.ts"() {
      "use strict";
      init_featureRuntime();
      init_pageMessages();
      init_gameDOM();
      init_clientPatches();
      BATTLE_PRESENCE_MESSAGE = "kasp:battle-presence";
    }
  });

  // src/modules/discordPresence.ts
  function setupDiscordPresence() {
    if (!isElectronClient()) return;
    const labels = {
      loading: "Loading the game",
      lobby: "In the lobby",
      garage: "In the garage",
      battle: "In a battle",
      match_results: "Battle results"
    };
    const screenLabels = new Map(Object.entries(labels));
    let battle = null, receivedAt2 = 0, end;
    lifecycle28.listen(window, "message", (event) => {
      const message = readPageMessage(event, window, BATTLE_PRESENCE_MESSAGE);
      if (!message) return;
      const next = message.battle;
      const now = Date.now();
      const candidate = next?.remaining === void 0 ? void 0 : Math.floor(now / 1e3) + Math.ceil(next.remaining);
      if (next?.map !== battle?.map || candidate === void 0 || end === void 0 || Math.abs(candidate - end) > 3) end = candidate;
      battle = next;
      receivedAt2 = now;
    });
    const send = () => {
      const hidden = utils.getSetting("k_hideNicknameXP", false);
      const account = hidden ? null : getAccountIdentity();
      const active = state.currentScreen === "battle" && battle && Date.now() - receivedAt2 < 5e3 ? battle : null;
      const rawMap = active?.map.replace(/\s+(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i, "").trim();
      const translated = rawMap ? DataLoader.translateMap(rawMap, "EN") : null;
      const mode = active?.mode || /\s+(TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i.exec(active?.map || "")?.[1]?.toUpperCase();
      const details = translated && !/[\u0400-\u04ff]/.test(translated) ? `${translated}${mode ? ` ${mode}` : ""}` : screenLabels.get(state.currentScreen) || labels.lobby;
      postPageMessage(window, {
        type: "kasp:discord-presence",
        version: 1,
        presence: {
          details,
          state: hidden ? "Hidden" : account?.nickname || "Signing in",
          ...active && end !== void 0 ? { timestamps: { end } } : {},
          ...active && active.players !== void 0 && active.maxPlayers !== void 0 && active.players <= active.maxPlayers ? { party: { size: [active.players, active.maxPlayers] } } : {}
        }
      });
    };
    let timer;
    const start = () => {
      if (timer !== void 0) return;
      send();
      timer = lifecycle28.interval(send, 3e3);
    };
    lifecycle28.onCleanup(() => {
      postPageMessage(window, { type: "kasp:discord-presence", version: 1, presence: null });
    });
    start();
    const refreshPrivacy = () => {
      if (timer !== void 0) send();
    };
    lifecycle28.listen(window, "kasp:settings-changed", refreshPrivacy);
    lifecycle28.listen(window, "storage", (event) => {
      if (event.key === "k_hideNicknameXP") refreshPrivacy();
    });
    lifecycle28.listen(window, "pageshow", start);
    lifecycle28.listen(window, "pagehide", () => {
      lifecycle28.cancelInterval(timer);
      timer = void 0;
      postPageMessage(window, { type: "kasp:discord-presence", version: 1, presence: null });
    });
  }
  var lifecycle28;
  var init_discordPresence = __esm({
    "src/modules/discordPresence.ts"() {
      "use strict";
      init_featureRuntime();
      init_electron();
      init_accountIdentity();
      init_state();
      init_utils();
      init_dataLoader();
      init_battlePresence();
      init_pageMessages();
      lifecycle28 = featureScope("discordPresence");
    }
  });

  // src/kasp_main.ts
  var require_kasp_main = __commonJS({
    "src/kasp_main.ts"() {
      init_electron();
      init_state();
      init_utils();
      init_boot();
      init_hideNickname();
      init_hideSupplies();
      init_discordPresence();
      init_accountIdentity();
      init_featureRuntime();
      if (window === window.top) {
        installFeatureDiagnostics(window, "content");
        featureScope("accountIdentity").run(setupAccountIdentity);
        featureScope("electronNavigation").run(setupElectronZKey);
        const loaderBg = chrome.runtime.getURL("assets/background.png");
        document.documentElement.style.setProperty("--kasp-loader-bg", `url("${loaderBg}")`);
        state.lang = utils.getLang();
        featureScope("hideNickname").run(setupNicknamePrivacy);
        featureScope("hideSupplies").run(hideSupplies);
        startBoot();
        featureScope("discordPresence").run(setupDiscordPresence);
      }
    }
  });
  require_kasp_main();
})();
