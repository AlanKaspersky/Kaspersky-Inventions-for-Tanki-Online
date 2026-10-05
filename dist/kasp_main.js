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
  function setupElectronZKey() {
    const isElectronClient = (() => {
      try {
        if (navigator.userAgent && navigator.userAgent.indexOf("Electron") !== -1) return true;
        if (window.process?.type) return true;
      } catch {
      }
      return false;
    })();
    ;
    if (!isElectronClient) return;
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
    }
  });

  // src/core/state.ts
  var state;
  var init_state = __esm({
    "src/core/state.ts"() {
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
  }
  var SETTINGS_KEYS, settingsCache;
  var init_settings = __esm({
    "src/core/settings.ts"() {
      SETTINGS_KEYS = [
        "k_ext_btn",
        "k_augments",
        "k_auto_upgrade",
        "k_friends",
        "k_paints",
        "k_hideCurrency",
        "k_hideNicknameXP",
        "k_history",
        "k_overdrive_timer"
      ];
      settingsCache = /* @__PURE__ */ new Map();
      for (const key of SETTINGS_KEYS) {
        settingsCache.set(key, readSetting(key, false));
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

  // src/core/gameDOM.ts
  var gameDOM;
  var init_gameDOM = __esm({
    "src/core/gameDOM.ts"() {
      gameDOM = {
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
          privateHeaderFields: ".UserInfoContainerStyle-userNameRank, .UserInfoContainerStyle-progressValue",
          clientParameter: ".ClientInfoComponentStyle-parameterText",
          currencyIcon: ".HeaderCommonStyle-icons",
          currencyValues: ".UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span"
        },
        screens: {
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
          cardImage: "img.SkinCellStyle-iconCell",
          rewardImageBlock: ".RewardCardComponentStyle-imageBlock",
          possibleRewards: ".ContainersComponentStyle-possibleRewardsBlock"
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
          disabled: ".MainScreenComponentStyle-disabledButtonPlay",
          cards: '.BattlePickComponentStyle-commonStyleBlock, .blockCard, [class*="commonStyleBlock"]',
          container: ".MainScreenComponentStyle-playButtonContainer",
          untreatedContainer: '.MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"])',
          button: ".MainScreenComponentStyle-buttonPlay",
          mainMenu: ".MainScreenComponentStyle-blockMainMenu"
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
          container: ".BattleTabStatisticComponentStyle-container",
          nickname: ".BattleTabStatisticComponentStyle-nicknameCell",
          nicknameText: ".BattleTabStatisticComponentStyle-nicknameCell span",
          equipment: ".BattleTabStatisticComponentStyle-commonBlock",
          selectedRow: ".BattleTabStatisticComponentStyle-selectedRowBackGround",
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
        }
      };
    }
  });

  // src/core/accountIdentity.ts
  function parseAccountIdentity(text) {
    const displayName = text.trim();
    const clanTag = /^\[.*?\]/.exec(displayName)?.[0] || "";
    const nickname = displayName.replace(/^\[.*?\]\s*/, "").trim();
    return nickname ? { nickname, clanTag, displayName } : null;
  }
  function getAccountIdentity() {
    const header = document.querySelector(".UserInfoContainerStyle-userNameRank");
    const identity = parseAccountIdentity(header?.textContent || "");
    if (identity) return identity;
    for (const parameter of document.querySelectorAll(".ClientInfoComponentStyle-parameterText")) {
      const uid = /^UID:\s*(.+)$/i.exec(parameter.textContent?.trim() || "");
      if (uid) return parseAccountIdentity(uid[1]);
    }
    const selfName = document.querySelector('#selfUserBg [class*="BattleKillBoardComponentStyle-col1"] span.-whiteSpaceNoWrap');
    return parseAccountIdentity(selfName?.textContent || "");
  }
  var init_accountIdentity = __esm({
    "src/core/accountIdentity.ts"() {
    }
  });

  // src/modules/hideNickname.ts
  function setTooltip(element, text) {
    if (element.getAttribute("data-kasp-private-tooltip") !== text) {
      element.setAttribute("data-kasp-private-tooltip", text);
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
    if (!utils.getSetting("k_hideNicknameXP", false)) return;
    hideNickname();
    if (privacyObserver) return;
    privacyObserver = new MutationObserver(hideNickname);
    privacyObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "id"]
    });
  }
  var privacyObserver;
  var init_hideNickname = __esm({
    "src/modules/hideNickname.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      init_accountIdentity();
      privacyObserver = null;
    }
  });

  // src/core/coreSettings.ts
  var coreSettings;
  var init_coreSettings = __esm({
    "src/core/coreSettings.ts"() {
      init_state();
      init_utils();
      init_hideNickname();
      coreSettings = /* @__PURE__ */ (() => {
        let needsReload = false;
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
          { id: "k_augments", label: { RU: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432", EN: "Augment specifications" }, default: false },
          { id: "k_auto_upgrade", label: { RU: "\u0411\u044B\u0441\u0442\u0440\u043E\u0435 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435 \u0432\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u044F", EN: "Quick weapon upgrades" }, default: false },
          { id: "k_friends", label: { RU: "\u041C\u0435\u0442\u043A\u0438 \u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0434\u0440\u0443\u0437\u0435\u0439", EN: "Friend tags & categories" }, default: false },
          { id: "k_paints", label: { RU: "\u0423\u043C\u043D\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u043A\u0440\u0430\u0441\u043E\u043A", EN: "Smart paint search" }, default: false },
          { id: "k_hideCurrency", label: { RU: "\u0421\u043A\u0440\u044B\u0442\u044C \u0432\u0430\u043B\u044E\u0442\u0443", EN: "Hide currency" }, default: false },
          { id: "k_hideNicknameXP", label: { RU: "\u0421\u043A\u0440\u044B\u0442\u044C \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0438 \u043E\u043F\u044B\u0442", EN: "Hide nickname and score" }, default: false },
          { id: "k_history", label: { RU: "\u0412\u0435\u0441\u0442\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0431\u0438\u0442\u0432", EN: "Keep a history of battles" }, default: false },
          { id: "k_overdrive_timer", label: { RU: "\u0422\u0430\u0439\u043C\u0435\u0440 \u043A\u043E\u0440\u043E\u0431\u043A\u0438 \u043E\u0432\u0435\u0440\u0434\u0440\u0430\u0439\u0432\u0430", EN: "Overdrive box timer" }, default: false }
        ];
        return {
          inject: () => {
            if (!stylesInjected) {
              stylesInjected = true;
            }
            const mainBlock = document.querySelector(".SettingsComponentStyle-blockContentOptions");
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
            kTab.className = "SettingsMenuComponentStyle-menuItemOptions";
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
            mainBlock.appendChild(kContent);
            kContent.querySelectorAll(".kasp-toggle-row").forEach((node) => {
              const row = node;
              const label = row.querySelector(".kasp-toggle-label");
              const switchBtn = row.querySelector(".kasp-toggle-switch");
              label.addEventListener("mousemove", (e) => {
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
              const allTabs = ulMenu.querySelectorAll(".SettingsMenuComponentStyle-menuItemOptions:not(#kaspersky-tab)");
              allTabs.forEach((t2) => t2.classList.remove("SettingsMenuComponentStyle-activeItemOptions"));
              kTab.classList.add("SettingsMenuComponentStyle-activeItemOptions");
              ulMenu.classList.add("kasp-hide-native-slider");
              const nativeContent = mainBlock.querySelector(".SettingsComponentStyle-containerBlock");
              if (nativeContent) nativeContent.style.display = "none";
              kContent.classList.remove("kasp-hidden");
            });
            ulMenu.addEventListener("click", (e) => {
              const target = e.target;
              const clickedTab = target.closest(".SettingsMenuComponentStyle-menuItemOptions");
              if (clickedTab && clickedTab.id !== "kaspersky-tab" && !clickedTab.classList.contains("SettingsMenuComponentStyle-slideMenuOptions")) {
                kTab.classList.remove("SettingsMenuComponentStyle-activeItemOptions");
                ulMenu.classList.remove("kasp-hide-native-slider");
                kContent.classList.add("kasp-hidden");
                const nativeContent = mainBlock.querySelector(".SettingsComponentStyle-containerBlock");
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

  // src/core/dataLoader.ts
  var DataLoader;
  var init_dataLoader = __esm({
    "src/core/dataLoader.ts"() {
      DataLoader = (() => {
        const state2 = {
          paints: null,
          augments: null,
          maps: null,
          skins: null,
          shared: null,
          ready: false,
          error: null
        };
        const readyPromise = (async () => {
          try {
            const [paintsRes, augmentsRes, mapsRes, skinsRes] = await Promise.all([
              fetch(chrome.runtime.getURL("database/paints.json")),
              fetch(chrome.runtime.getURL("database/augments.json")),
              fetch(chrome.runtime.getURL("database/maps.json")),
              fetch(chrome.runtime.getURL("database/skins.json"))
            ]);
            if (!paintsRes.ok)
              throw new Error("paints.json: HTTP " + paintsRes.status);
            if (!augmentsRes.ok)
              throw new Error("augments.json: HTTP " + augmentsRes.status);
            if (!mapsRes.ok)
              throw new Error("maps.json: HTTP " + mapsRes.status);
            if (!skinsRes.ok)
              throw new Error("skins.json: HTTP " + skinsRes.status);
            state2.paints = await paintsRes.json();
            const augRaw = await augmentsRes.json();
            state2.shared = augRaw._shared || {};
            const devices = augRaw.devices || {};
            for (const url in devices) {
              const entry = devices[url];
              if (entry && typeof entry === "object" && entry.$shared) {
                devices[url] = state2.shared[entry.$shared] || entry;
              }
            }
            state2.augments = devices;
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
              `[KI] DB loaded: paints=${Object.keys(state2.paints).length}, augments=${Object.keys(state2.augments).length}, maps=${mapsRaw.length}, skins=${Object.keys(state2.skins?.names ?? {}).length}`
            );
          } catch (e) {
            state2.error = e;
            console.error("[KI] DB load failed:", e);
          }
        })();
        ;
        return {
          readyPromise,
          isReady: () => state2.ready,
          getPaint: (url) => state2.paints ? state2.paints[url] : void 0,
          getDevice: (url) => state2.augments ? state2.augments[url] : void 0,
          hasDevice: (url) => !!state2.augments && url in state2.augments,
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
  var customPaints;
  var init_customPaints = __esm({
    "src/modules/customPaints.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      init_dataLoader();
      customPaints = /* @__PURE__ */ (() => {
        let initialized = false;
        function normalizeText(text) {
          if (!text) return "";
          return text.toLowerCase().replace(/ё/g, "\u0435");
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
              item.style.display = "";
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
            item.style.display = isMatch ? "" : "none";
          });
          const columns = document.querySelectorAll(".kasp-paints-container > div");
          columns.forEach((colEl) => {
            const col = colEl;
            const visibleItems = Array.from(col.querySelectorAll(gameDOM.garage.item)).filter((i) => i.style.display !== "none");
            col.style.display = visibleItems.length === 0 ? "none" : "";
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
          input.addEventListener("input", applySearch);
          const searchIcon = document.createElement("div");
          searchIcon.className = "kasp-search-icon";
          searchInputDiv.appendChild(input);
          searchInputDiv.appendChild(searchIcon);
          searchContainer.appendChild(searchInputDiv);
          searchWrapper.appendChild(searchContainer);
          parentBlock.appendChild(searchWrapper);
        }
        return () => {
          if (!utils.getSetting("k_paints", false)) return;
          if (state.currentScreen !== "garage") return;
          if (!initialized) {
            initialized = true;
          }
          addSearchInput();
          const input = document.querySelector(".kasp-search-wrapper input");
          if (input && input.value.trim() !== "") {
            applySearch();
          }
        };
      })();
    }
  });

  // src/modules/augmentSpecs.ts
  var augmentSpecs;
  var init_augmentSpecs = __esm({
    "src/modules/augmentSpecs.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      init_dataLoader();
      augmentSpecs = /* @__PURE__ */ (() => {
        let initialized = false;
        let updateQueued = false;
        const t = {
          RU: { specsTitle: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438", adv: "\u041F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0430", disadv: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043A\u0438", empty: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445" },
          EN: { specsTitle: "Specs", adv: "Advantages", disadv: "Disadvantages", empty: "No data" }
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
        const renderList = (items, lang) => {
          if (!items || items.length === 0) return `<li>${t[lang].empty}</li>`;
          return items.map((item) => {
            let html = `<li>${item[lang] || item["EN"]}`;
            if (item.subItems && item.subItems.length > 0) {
              html += `<ul>${item.subItems.map((sub) => `<li>${sub[lang] || sub["EN"]}</li>`).join("")}</ul>`;
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
            let x = e.clientX + offset;
            let y = e.clientY + offset;
            const rect = hoverTooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) {
              x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight) {
              y = e.clientY - rect.height - offset;
            }
            hoverTooltip.style.left = `${x}px`;
            hoverTooltip.style.top = `${y}px`;
          };
          const applyButtonToCard = (card, url) => {
            if (!card) return;
            let existingBtn = card.querySelector(".custom-card-specs-btn");
            if (existingBtn && existingBtn.dataset.url !== url) {
              existingBtn.remove();
              existingBtn = null;
            }
            if (!existingBtn && DataLoader.hasDevice(url)) {
              if (window.getComputedStyle(card).position === "static") {
                card.style.position = "relative";
              }
              const btn = document.createElement("div");
              btn.className = "custom-card-specs-btn";
              btn.dataset.url = url;
              btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
              });
              btn.addEventListener("mouseenter", (e) => {
                const deviceData = DataLoader.getDevice(url);
                if (!deviceData) return;
                const lang = state.lang;
                const advList = renderList(deviceData.advantages, lang);
                const disadvList = renderList(deviceData.disadvantages, lang);
                hoverTooltip.innerHTML = `
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
                            `;
                hoverTooltip.style.display = "block";
                updateTooltipPos(e);
              });
              btn.addEventListener("mousemove", updateTooltipPos);
              btn.addEventListener("mouseleave", () => {
                hoverTooltip.style.display = "none";
              });
              card.appendChild(btn);
            }
          };
          const cardsImgs = document.querySelectorAll(gameDOM.augments.cardImage);
          cardsImgs.forEach((img) => {
            applyButtonToCard(img.parentElement, img.src);
          });
          const containerImageBlocks = document.querySelectorAll(gameDOM.augments.rewardImageBlock);
          containerImageBlocks.forEach((block) => {
            if (block.closest(gameDOM.augments.possibleRewards)) return;
            const card = block.parentElement;
            const imageDiv = block.querySelector(gameDOM.common.backgroundDiv);
            if (!imageDiv || !card) return;
            const bgImage = window.getComputedStyle(imageDiv).backgroundImage;
            const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
              applyButtonToCard(card, match[1]);
            }
          });
        };
        const liveStats = /* @__PURE__ */ new Map();
        function updateLiveStats() {
          if (!utils.getSetting("k_augments", false)) return;
          const activeValues = /* @__PURE__ */ new Set();
          const deviceImg = document.querySelector(gameDOM.garage.deviceIcon);
          const deviceData = deviceImg ? DataLoader.getDevice(deviceImg.src) : void 0;
          const allSpans = deviceData?.modifiers ? Array.from(document.querySelectorAll("span")).filter((s) => !s.closest(".custom-live-stat")) : [];
          allSpans.forEach((nameSpan) => {
            const text = nameSpan.textContent?.trim().toLowerCase() || "";
            let matchedTag = null;
            for (const [tag, translations] of Object.entries(STAT_DICT)) {
              const allVariants = [].concat(translations.RU, translations.EN).filter(Boolean).map((s) => s.toLowerCase());
              if (allVariants.includes(text)) {
                matchedTag = tag;
                break;
              }
            }
            if (matchedTag && deviceData.modifiers && matchedTag in deviceData.modifiers) {
              const multiplier = deviceData.modifiers[matchedTag];
              const valueSpan = nameSpan.parentElement?.nextElementSibling;
              if (valueSpan && valueSpan.tagName === "SPAN" && !valueSpan.classList.contains("custom-live-stat")) {
                const original = valueSpan;
                const cleanStr = (original.textContent || "").replace(/\s/g, "").replace(",", ".");
                const origNumber = parseFloat(cleanStr);
                if (!isNaN(origNumber)) {
                  let newVal = matchedTag === "WEIGHT" && multiplier >= 10 ? multiplier : origNumber * multiplier;
                  let formattedVal = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                  formattedVal = formattedVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                  let isBuff = multiplier > 1;
                  if (["RELOAD"].includes(matchedTag)) isBuff = multiplier < 1;
                  if (matchedTag === "WEIGHT" && multiplier < origNumber) isBuff = false;
                  const color = isBuff ? "#00ff38" : "#fe6666";
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
          requestAnimationFrame(() => {
            updateQueued = false;
            if (!utils.getSetting("k_augments", false)) return;
            const isGarage = state.currentScreen === "garage";
            const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
            if (!isGarage && !isContainers) return;
            injectButtons();
            updateLiveStats();
          });
        };
        return () => {
          if (!utils.getSetting("k_augments", false)) return;
          if (!initialized) {
            initialized = true;
            const forceHideTooltip = () => {
              const hoverTooltip = document.getElementById("kasp-specs-tooltip");
              if (hoverTooltip) hoverTooltip.style.display = "none";
            };
            window.addEventListener("keydown", (e) => {
              if (e.code === "Escape" || e.key === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
                forceHideTooltip();
              }
            }, true);
            window.addEventListener("mousedown", (e) => {
              if (e.button === 3) {
                forceHideTooltip();
              }
            }, true);
          }
          const isGarage = state.currentScreen === "garage";
          const isContainers = !!document.querySelector(gameDOM.screens.lootBox);
          const loadingScreen = document.querySelector(gameDOM.screens.loadingBackground);
          if (loadingScreen || !isGarage && !isContainers) {
            const hoverTooltip = document.getElementById("kasp-specs-tooltip");
            if (hoverTooltip) hoverTooltip.style.display = "none";
          }
          if (isGarage || isContainers) {
            scheduleUpdate();
          }
        };
      })();
    }
  });

  // src/modules/customPlayButton.ts
  var customPlayButton;
  var init_customPlayButton = __esm({
    "src/modules/customPlayButton.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      customPlayButton = (() => {
        let initialized = false;
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
        const modes = [
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
        function matchText(text, names) {
          const upper = text.trim().toUpperCase();
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
            if (failSafeTimer) window.clearTimeout(failSafeTimer);
            failSafeTimer = window.setTimeout(() => {
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
              const mode = modes[idx];
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
            const text = document.createElement("span");
            text.className = "wide-mode-btn-text";
            text.dataset.index = index.toString();
            text.textContent = mode.labels[currentLang];
            text.style.cssText = "font-size: 1.2em; font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium; transition: color 0.2s ease-in-out;";
            contentWrapper.appendChild(img);
            contentWrapper.appendChild(text);
            el.appendChild(contentWrapper);
            el.addEventListener("mouseenter", () => {
              if (!isSearching()) el.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
            });
            el.addEventListener("mouseleave", () => {
              if (!isSearching()) el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
            });
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              startAutoQueue(mode);
            });
            row2.appendChild(el);
          });
          const row3 = document.createElement("div");
          row3.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
          const yOffsetRow3 = -(MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP);
          modes.forEach((mode, index) => {
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
            el.addEventListener("mouseenter", () => {
              if (!isSearching()) el.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
            });
            el.addEventListener("mouseleave", () => {
              if (!isSearching()) el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
            });
            el.addEventListener("click", (e) => {
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
            container.style.marginLeft = "5em";
            container.style.height = "auto";
            container.style.marginTop = "10em";
            container.style.width = "31.25em";
            container.style.flexDirection = "column";
            container.style.alignItems = "flex-start";
            container.style.overflow = "visible";
            container.style.zIndex = "5";
            container.style.position = "relative";
          }
          if (playButton) {
            playButton.style.width = `${MAIN_WIDTH}em`;
            playButton.style.height = `${MAIN_HEIGHT}em`;
            playButton.style.position = "relative";
            playButton.style.overflow = "hidden";
            playButton.style.borderRadius = "0.5rem";
            playButton.style.transition = "box-shadow 0.2s ease-in-out, opacity 0.2s ease-in";
            playButton.addEventListener("mouseenter", () => {
              if (!isSearching()) playButton.style.boxShadow = "rgb(255, 255, 255) 0 0 0 0.2em";
            });
            playButton.addEventListener("mouseleave", () => {
              if (!isSearching()) playButton.style.boxShadow = "rgba(255, 255, 255, 0.25) 0 0 0 0.0625em";
            });
            const innerBtn = playButton.querySelector(gameDOM.play.button) || playButton;
            innerBtn.style.backgroundImage = "none";
            innerBtn.classList.add("custom-inner-btn");
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
              playButton.addEventListener("click", (e) => {
                if (e.isTrusted && !isSearching()) {
                  targetMode = quickBattleMode;
                  autoQueueState = 1;
                }
              });
            }
          }
          if (mainMenu) mainMenu.style.marginTop = "1em";
          createQuickButtons(playButton);
          playButton.dataset.overridden = "true";
          syncButtonStates(true);
        }
        return () => {
          if (!utils.getSetting("k_ext_btn", false)) return;
          if (state.currentScreen === "battle") return;
          if (!initialized) {
            initialized = true;
            utils.injectStyle(`
                        .MainScreenComponentStyle-playButtonContainer div[class*="ksc-"],
                        .MainScreenComponentStyle-playButtonContainer [class*="lock"]:not(.main-lock-icon),
                        .MainScreenComponentStyle-playButtonContainer img[src*="lock"] { display: none !important; }
                        .custom-inner-btn > *:not(.custom-main-bg-layer):not(.main-lock-icon):not(.custom-main-text) { display: none !important; }
                        .MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"]) { opacity: 0 !important; pointer-events: none !important; }
                        
                        body.kasp-autoqueue-active [class*="BattlePickComponentStyle"],
                        body.kasp-autoqueue-active [class*="blockCard"],
                        body.kasp-autoqueue-active [class*="commonStyleBlock"] { 
                            opacity: 0 !important; visibility: hidden !important; transition: none !important; animation: none !important;
                        }
                    `, "kasp-playbtn-styles");
            document.addEventListener("keydown", handleModeHotkey);
            window.setInterval(() => {
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
      })();
    }
  });

  // src/modules/customFriends.ts
  var customFriends;
  var init_customFriends = __esm({
    "src/modules/customFriends.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      init_accountIdentity();
      customFriends = /* @__PURE__ */ (() => {
        let initialized = false;
        const filtersConfig = [
          { url: "https://s.eu.tankionline.com/static/images/allPaints.741c65e1.svg", type: "all" },
          { url: "https://s.eu.tankionline.com/static/images/uncommon.ca77d7da.svg", type: "online" },
          { url: "https://s.eu.tankionline.com/static/images/iconCasualGray.3eea12e7.svg", type: "offline" },
          { url: "https://s.eu.tankionline.com/static/images/iconRareBlue.4e3c7303.svg", type: "clan" },
          { url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg", type: "purple" },
          { url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg", type: "yellow" },
          { url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg", type: "red" }
        ];
        const getCurrentNickname = () => {
          return getAccountIdentity()?.nickname || "Unknown";
        };
        const getCustomCategories = () => {
          const myNick = getCurrentNickname();
          try {
            return JSON.parse(localStorage.getItem(`tankiCustomCategories_${myNick}`) || "{}");
          } catch (e) {
            return {};
          }
        };
        const setCustomCategory = (friendNickname, colorType) => {
          const myNick = getCurrentNickname();
          if (myNick === "Unknown") return;
          const cats = getCustomCategories();
          if (cats[friendNickname] === colorType) {
            delete cats[friendNickname];
          } else {
            cats[friendNickname] = colorType;
          }
          localStorage.setItem(`tankiCustomCategories_${myNick}`, JSON.stringify(cats));
          document.querySelectorAll(".custom-friends-sidebar").forEach((node) => {
            const sidebar = node;
            const activeBtn = sidebar.querySelector(".custom-filter-btn.active");
            if (activeBtn) activeBtn.click();
          });
        };
        const getMyClanTag = () => {
          return getAccountIdentity()?.clanTag || "";
        };
        const updateCardBadge = (el, isFriendsList) => {
          const cardText = el.innerText || "";
          const span = Array.from(el.querySelectorAll("span")).find((s) => s.className.includes(gameDOM.fragments.nicknameText));
          const nickText = span ? span.innerText.trim() : cardText.split("\n")[0].trim();
          const clanTag = getMyClanTag();
          const isClan = Boolean(clanTag && cardText.includes(clanTag));
          const cats = getCustomCategories();
          const customColor = cats[nickText];
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
            const span = Array.from(el.querySelectorAll("span")).find((s) => s.className.includes(gameDOM.fragments.nicknameText));
            const nickText = span ? span.innerText.trim() : cardText.split("\n")[0].trim();
            let match = true;
            if (filterType === "online") match = isOnline;
            else if (filterType === "offline") match = isOffline;
            else if (filterType === "clan") match = Boolean(clanTag && cardText.includes(clanTag));
            else if (["purple", "yellow", "red"].includes(filterType)) {
              match = cats[nickText] === filterType;
            }
            el.style.display = match ? "" : "none";
          });
        };
        const injectCategoriesMenu = (menu) => {
          if (menu.dataset.customCategoriesInjected === "true") return;
          menu.dataset.customCategoriesInjected = "true";
          const rankItem = menu.querySelector(gameDOM.friends.contextPlayer);
          if (!rankItem) return;
          const span = Array.from(rankItem.querySelectorAll("span")).find((s) => s.className.includes(gameDOM.fragments.nicknameText));
          if (!span) return;
          const nickname = span.innerText.trim();
          const row = document.createElement("div");
          row.className = "custom-category-row";
          const cats = getCustomCategories();
          const currentColor = cats[nickname];
          const customButtons = [
            { type: "purple", url: "https://s.eu.tankionline.com/static/images/iconEpicFiolet.d91b1151.svg" },
            { type: "yellow", url: "https://s.eu.tankionline.com/static/images/iconLegendaryGold.7c76cb29.svg" },
            { type: "red", url: "https://s.eu.tankionline.com/static/images/iconCustomiseRed.2b5c8828.svg" }
          ];
          customButtons.forEach((c) => {
            const btn = document.createElement("div");
            btn.className = `custom-category-menu-btn ${currentColor === c.type ? "active" : ""}`;
            btn.innerHTML = `<img src="${c.url}">`;
            btn.onclick = (e) => {
              e.stopPropagation();
              setCustomCategory(nickname, c.type);
              row.querySelectorAll(".custom-category-menu-btn").forEach((b) => b.classList.remove("active"));
              const newCats = getCustomCategories();
              if (newCats[nickname] === c.type) {
                btn.classList.add("active");
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
              btn.addEventListener("click", () => {
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
              btn.addEventListener("click", () => {
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
        return () => {
          if (!utils.getSetting("k_friends", false)) return;
          if (state.currentScreen === "battle") return;
          if (!initialized) {
            initialized = true;
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
            if (menu.dataset.customCategoriesInjected !== "true") injectCategoriesMenu(menu);
          });
        };
      })();
    }
  });

  // src/modules/garageButtons.ts
  var garageButtons;
  var init_garageButtons = __esm({
    "src/modules/garageButtons.ts"() {
      init_gameDOM();
      init_state();
      garageButtons = /* @__PURE__ */ (() => {
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
          const text = (btn.textContent || "").trim().slice(0, 80);
          const kidCount = btn.children.length;
          const hasIcon = btn.querySelector(gameDOM.common.icon) ? 1 : 0;
          const hasKaspActive = btn.classList.contains("kasp-active-btn") ? 1 : 0;
          const hasKaspDisabled = btn.classList.contains("kasp-disabled-btn") ? 1 : 0;
          return `${text}|${category}|${kidCount}|${hasIcon}|${hasKaspActive}|${hasKaspDisabled}`;
        }
        function applyButtonFixes() {
          const buttons = document.querySelectorAll(gameDOM.garage.styledActions);
          if (!buttons.length)
            return;
          const currentCategory = getActiveTabCategory();
          buttons.forEach((btn) => {
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
              applyMask(iconDiv, targetIcon, iconColor);
            }
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
      })();
    }
  });

  // src/modules/welcomeModal.ts
  var welcomeModal;
  var init_welcomeModal = __esm({
    "src/modules/welcomeModal.ts"() {
      init_state();
      welcomeModal = (() => {
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
            role4: `\u041F\u043E\u043C\u043E\u0433\u0430\u043B\u0438`,
            outro: `\u041F\u0440\u043E\u0435\u043A\u0442 \u0432\u044B\u0440\u0430\u0436\u0430\u0435\u0442 \u0438\u043C \u043E\u0433\u0440\u043E\u043C\u043D\u0443\u044E \u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u043D\u043E\u0441\u0442\u044C!`,
            close: `\u0417\u0410\u041A\u0420\u042B\u0422\u042C`
          },
          EN: {
            version: `VERSION ${CURRENT_VERSION}`,
            intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
            role1: `Idea Created By`,
            role2: `Co-created By`,
            role3: `Quality Assessed By`,
            role4: `Helped`,
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
            html = html.replace(/{{version}}/g, dict.version).replace(/{{intro}}/g, dict.intro).replace(/{{role1}}/g, dict.role1).replace(/{{role2}}/g, dict.role2).replace(/{{role3}}/g, dict.role3).replace(/{{role4}}/g, dict.role4).replace(/{{outro}}/g, dict.outro).replace(/{{close}}/g, dict.close);
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
              closeBtn.addEventListener("click", () => {
                overlay.remove();
                localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
              });
            }
          } catch (error) {
            console.error("[Kaspersky Inventions] Failed to load welcome modal template:", error);
          }
        }
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
      })();
    }
  });

  // src/modules/hideCurrency.ts
  var hideCurrency;
  var init_hideCurrency = __esm({
    "src/modules/hideCurrency.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      hideCurrency = /* @__PURE__ */ (() => {
        let initialized = false;
        function getHiddenText() {
          return state.lang === "RU" ? "\u0421\u043A\u0440\u044B\u0442\u043E" : "Hidden";
        }
        function processSpan(span) {
          const text = span.textContent?.trim() || "";
          const targetText = getHiddenText();
          const parentElement = span.closest(gameDOM.account.currencyIcon) || span.parentElement;
          if (text && text !== targetText && text !== "\u0421\u043A\u0440\u044B\u0442\u043E" && text !== "Hidden" && /\d/.test(text)) {
            span.dataset.originalValue = text;
            span.textContent = targetText;
            if (parentElement) {
              parentElement.setAttribute("data-tooltip", text);
            }
          } else if (span.dataset.originalValue && parentElement && !parentElement.hasAttribute("data-tooltip")) {
            parentElement.setAttribute("data-tooltip", span.dataset.originalValue);
          }
          if (parentElement && !parentElement.classList.contains("currency-masked")) {
            parentElement.classList.add("currency-masked");
          }
        }
        return () => {
          if (!utils.getSetting("k_hideCurrency", false)) return;
          if (state.currentScreen === "battle") return;
          if (!initialized) {
            initialized = true;
            window.setInterval(() => {
              if (state.currentScreen === "battle") return;
              const spans2 = document.querySelectorAll(gameDOM.account.currencyValues);
              spans2.forEach((node) => processSpan(node));
            }, 500);
          }
          const spans = document.querySelectorAll(gameDOM.account.currencyValues);
          spans.forEach((node) => processSpan(node));
        };
      })();
    }
  });

  // src/modules/customTrophies.ts
  var customTrophies;
  var init_customTrophies = __esm({
    "src/modules/customTrophies.ts"() {
      init_gameDOM();
      init_state();
      customTrophies = /* @__PURE__ */ (() => {
        let initialized = false;
        const STORAGE_KEY = "kasp_trophies_favorites";
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
        function getFavs() {
          if (cachedFavs) return cachedFavs;
          try {
            cachedFavs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          } catch {
            cachedFavs = [];
          }
          return cachedFavs || [];
        }
        function saveFavs(favs) {
          cachedFavs = favs;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
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
        function toggleFavorite(itemId, type, iconUrl, current, max) {
          let favs = getFavs();
          const idx = favs.findIndex((f) => f.id === itemId);
          if (idx > -1) {
            favs.splice(idx, 1);
          } else {
            const count = favs.filter((f) => f.type === type).length;
            if (count >= 2) return;
            favs.push({ id: itemId, type, icon: iconUrl, current, max });
          }
          saveFavs(favs);
          const cards = document.querySelectorAll(gameDOM.trophies.cards);
          if (cards.length > 0) processGarageMissions(Array.from(cards));
        }
        function processGarageMissions(garageCards) {
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
              starContainer.innerHTML = `<img src="${favItem ? ICON_FAV : ICON_UNFAV}">`;
              starContainer.addEventListener("click", (e) => {
                e.stopPropagation();
                const iconUrl = extractIcon(card);
                toggleFavorite(itemInfo.id, type, iconUrl, currentPoints, maxPoints);
              });
              card.appendChild(starContainer);
            } else {
              const img = starContainer.querySelector("img");
              const expectedIcon = favItem ? ICON_FAV : ICON_UNFAV;
              if (img && img.src !== expectedIcon) img.src = expectedIcon;
            }
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
              const text = el.textContent || "";
              const style = el.getAttribute("style") || "";
              if (text.includes(" / ")) {
                if (!style.includes("opacity: 0")) rawProgress = text;
              } else if (text.length > 15 && !text.includes("\u0412\u042B\u041F\u041E\u041B\u041D\u0415\u041D\u041E") && !text.includes("COMPLETED")) {
                rawText = text;
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
          const trophies = getFavs();
          trophies.sort((a, b) => {
            if (a.type === "turret" && b.type === "hull") return -1;
            if (a.type === "hull" && b.type === "turret") return 1;
            return 0;
          });
          trophies.forEach((trophy) => {
            const percent = Math.min(100, Math.max(0, trophy.current / trophy.max * 100));
            const match = Object.values(trophyDictionary).find((d) => d.id === trophy.id);
            const displayName = match ? state.lang === "RU" ? match.ru : match.en : trophy.id;
            const itemHTML = `
                        <div class="custom-trophy-item">
                            <img class="custom-trophy-icon" src="${trophy.icon}" alt="${displayName}">
                            <div class="custom-trophy-info">
                                <div class="custom-trophy-title">${displayName}</div>
                                <div class="custom-trophy-bar-bg">
                                    <div class="custom-trophy-bar-fill" style="width: ${percent}%;"></div>
                                </div>
                                <div class="custom-trophy-text">${formatNumber2(trophy.current)} / ${formatNumber2(trophy.max)}</div>
                            </div>
                        </div>
                    `;
            panel.insertAdjacentHTML("beforeend", itemHTML);
          });
          return panel;
        }
        function updateInterface() {
          const challengesBlock = document.querySelector(gameDOM.trophies.lobbyAnchor);
          const panel = document.getElementById("custom-trophy-panel");
          if (challengesBlock) {
            if (!panel && getFavs().length > 0 && challengesBlock.parentElement) {
              challengesBlock.parentElement.appendChild(createPanel());
            }
          } else {
            if (panel) panel.remove();
          }
          const cards = document.querySelectorAll(gameDOM.trophies.cards);
          if (cards.length > 0) processGarageMissions(Array.from(cards));
        }
        return async () => {
          if (!initialized) {
            initialized = true;
            await loadTrophyDictionary();
          }
          if (state.currentScreen === "lobby" || state.currentScreen === "garage") {
            updateInterface();
          } else if (state.currentScreen === "match_results") {
            const battleCards = document.querySelectorAll(gameDOM.trophies.resultCards);
            if (battleCards.length > 0) processBattleResults(Array.from(battleCards));
          }
        };
      })();
    }
  });

  // src/core/modal.ts
  var pendingModalIds, createKaspModal;
  var init_modal = __esm({
    "src/core/modal.ts"() {
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
  var autoUpgrade;
  var init_autoUpgrade = __esm({
    "src/modules/autoUpgrade.ts"() {
      init_gameDOM();
      init_state();
      init_utils();
      init_modal();
      autoUpgrade = /* @__PURE__ */ (() => {
        let initialized = false;
        let isRunning = false;
        let upgradeQueue = 0;
        let unavailableRetries = 0;
        const MAX_UNAVAILABLE_RETRIES = 80;
        const RETRY_DELAY = 100;
        let upgraded = 0;
        let timer = null;
        let lastItemSignature = "";
        let isCategorySwitch = true;
        let categorySwitchTimeout = null;
        const DELAY = 30;
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
          const text = btn.textContent?.toLowerCase() || "";
          if (text.includes("\u0437\u0430 ") || text.includes("for ") || text.includes("\u0440\u0443\u0431\u0438\u043D") || text.includes("ruby") || text.includes("\u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C") || text.includes("get")) return true;
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
            const text = el.textContent?.trim().toLowerCase() || "";
            if (text === "\u043E\u0442\u043C\u0435\u043D\u0430" || text === "cancel") {
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
              const text = span.textContent?.trim().toUpperCase() || "";
              if (text === "\u0417\u0410\u0412\u0415\u0420\u0428\u0415\u041D\u041E" || text === "COMPLETED") return true;
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
            const text = (btn.textContent || "").toLowerCase();
            if (text.includes("\u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E") || text.includes("unavailable"))
              return true;
          }
          return false;
        }
        function isMaxLevel() {
          if (document.querySelector(gameDOM.garage.established)) return true;
          const titleNodes = document.querySelectorAll(gameDOM.garage.upgradeTitles);
          for (let i = 0; i < titleNodes.length; i++) {
            const text = titleNodes[i].textContent?.trim().toUpperCase() || "";
            if (/(MK|МК)7[- ]?20/.test(text)) return true;
            if (/(УР|LVL)[- ]?(20|45)/.test(text)) return true;
            if (text.includes("MAX")) return true;
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
            document.removeEventListener("keydown", onKeyDown, true);
            window.setTimeout(() => document.removeEventListener("keyup", onKeyUp, true), 700);
          });
          const onKeyDown = (event) => {
            if (event.key !== "Enter" || isClosing) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeDialog();
            callback();
          };
          const onKeyUp = (event) => {
            if (event.key === "Enter" || event.key === "Escape" || event.code === "KeyZ" || event.key?.toLowerCase() === "z") {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
            }
          };
          confirmBtn.addEventListener("click", () => {
            if (isClosing) return;
            closeDialog();
            callback();
          });
          cancelBtn.addEventListener("click", closeDialog);
          document.addEventListener("keydown", onKeyDown, true);
          document.addEventListener("keyup", onKeyUp, true);
        }
        function performAction(count) {
          if (isRunning) return;
          if (!shouldShowQuickButtons()) return;
          showConfirmDialog(count, () => {
            isRunning = true;
            upgradeQueue = count;
            upgraded = 0;
            let isWaitingForDialogClose = false;
            function doStep() {
              if (!isRunning) {
                finish();
                return;
              }
              if (isWaitingForDialogClose) {
                if (isDialogOpen()) {
                  timer = window.setTimeout(doStep, DELAY);
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
                  timer = window.setTimeout(doStep, RETRY_DELAY);
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
                  timer = window.setTimeout(doStep, DELAY);
                  return;
                }
                finish();
                return;
              }
              pressEnter();
              timer = window.setTimeout(doStep, DELAY);
            }
            function finish() {
              isRunning = false;
              upgradeQueue = 0;
              unavailableRetries = 0;
              if (timer) {
                window.clearTimeout(timer);
                timer = null;
              }
            }
            timer = window.setTimeout(doStep, DELAY);
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
            el.addEventListener("mouseenter", () => {
              el.style.backgroundColor = "rgb(197, 197, 197)";
              el.style.boxShadow = "rgb(255, 255, 255) 0em 0em 0em 1.4px";
            });
            el.addEventListener("mouseleave", () => {
              el.style.backgroundColor = "rgb(218, 218, 218)";
              el.style.boxShadow = "rgba(255, 255, 255, 0.25) 0em 0em 0em 0.063em";
            });
            const span = document.createElement("span");
            span.style.cssText = `color: rgb(0, 0, 0) !important; font-size: 1.3em; font-family: BaseFontBold, FallbackFontBold; font-weight: bold; white-space: nowrap;`;
            span.textContent = btn.label;
            el.appendChild(span);
            el.title = btn.value === Infinity ? tooltipMax : tooltipSteps.replace("{n}", btn.value.toString());
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              if (typeof isRunning !== "undefined" && !isRunning) performAction(btn.value);
            });
            quickButtonsWrapper.appendChild(el);
          });
          panel.appendChild(quickButtonsWrapper);
        }
        return () => {
          if (!utils.getSetting("k_auto_upgrade", false)) return;
          if (state.currentScreen !== "garage") return;
          if (!initialized) {
            initialized = true;
            categorySwitchTimeout = window.setTimeout(() => {
              isCategorySwitch = false;
            }, 2e3);
            document.addEventListener("click", (e) => {
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
                if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                categorySwitchTimeout = window.setTimeout(() => {
                  isCategorySwitch = false;
                }, 1e3);
              } else if (itemElement) {
                isCategorySwitch = false;
                if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
              }
              if (menuCategory || mainGarageBlock || itemElement || backButton) {
                if (isRunning) {
                  isRunning = false;
                  if (timer) {
                    window.clearTimeout(timer);
                    timer = null;
                  }
                }
                lastItemSignature = "";
                const existing = document.getElementById("quick-buttons");
                if (existing) existing.remove();
                window.setTimeout(createButtons, 10);
              }
            }, true);
            document.addEventListener("keydown", (e) => {
              if (document.getElementById("quick-upgrade-overlay")) return;
              if (e.key === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
                isCategorySwitch = true;
                if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                categorySwitchTimeout = window.setTimeout(() => {
                  isCategorySwitch = false;
                }, 1e3);
                lastItemSignature = "";
              }
            }, true);
            document.addEventListener("mousedown", (e) => {
              if (document.getElementById("quick-upgrade-overlay")) return;
              if (e.button === 3 || e.button === 4) {
                isCategorySwitch = true;
                if (categorySwitchTimeout) window.clearTimeout(categorySwitchTimeout);
                categorySwitchTimeout = window.setTimeout(() => {
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
      })();
    }
  });

  // src/modules/changeCounter.ts
  var changeCounter;
  var init_changeCounter = __esm({
    "src/modules/changeCounter.ts"() {
      init_gameDOM();
      changeCounter = (() => {
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
        window.addEventListener("message", (e) => {
          const data = e.data;
          if (!data || data.type !== "kasp:battle-kind") return;
          window.__kaspBattleKind = String(data.detail || "").toUpperCase();
        });
        window.addEventListener("message", (e) => {
          const data = e.data;
          if (!data || data.type !== "kasp:useraction") return;
          const detail = data.detail;
          if (!Array.isArray(detail)) return;
          if (detail[0] !== "TankUserActionLog" || !detail.includes("CHANGE_EQUIPMENT")) return;
          const nickname = detail.find(
            (item) => typeof item === "string" && item !== "TankUserActionLog" && item !== "CHANGE_EQUIPMENT" && item !== "ALLY" && item !== "ENEMIES" && !item.startsWith("-") && /[a-zA-Z]/.test(item) && item.length >= 2 && item.length < 30
          );
          if (!nickname) return;
          playerChanges.set(nickname, (playerChanges.get(nickname) ?? 0) + 1);
          saveCache();
          if (document.querySelector(gameDOM.statistics.container)) {
            update();
          }
        });
        document.addEventListener("kasp:battle:id", () => {
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
        return {
          onTick: () => {
            checkBattleCanvas();
          },
          sync,
          update
        };
      })();
    }
  });

  // src/modules/customGarageSkins.ts
  var customGarageSkins;
  var init_customGarageSkins = __esm({
    "src/modules/customGarageSkins.ts"() {
      init_gameDOM();
      customGarageSkins = (() => {
        const STORAGE_KEY = "kasp_equipped_skins";
        const BASE_IMG_KEY = "kasp_base_images";
        let NAME_TRANSLATE = null;
        let PREFILLED_DEFAULTS = null;
        let dataReadyPromise = null;
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
          try {
            return JSON.parse(raw);
          } catch (e) {
            return null;
          }
        }
        function getSavedSkins() {
          return safeParseJSON(localStorage.getItem(STORAGE_KEY)) || {};
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
                  if (v && !merged[key].includes(v)) merged[key].push(v);
                });
              } else if (val) {
                if (!merged[key].includes(val)) merged[key].push(val);
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
          const savedSkins = getSavedSkins();
          const defaultImages = getDefaultImages();
          let css = "";
          for (const item of Object.keys(defaultImages)) {
            const targetUrl = savedSkins[item];
            if (!targetUrl) continue;
            const finalUrls = defaultImages[item].filter((url) => url !== targetUrl);
            if (finalUrls.length > 0) {
              const selectors = finalUrls.map(
                (url) => `.GarageItemComponentStyle-mainImg[src="${url}"], .garage-item img[src="${url}"], .MountedItemsStyle-itemPreview[src="${url}"]`
              ).join(",\n");
              css += `${selectors} {
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
          row.querySelectorAll(gameDOM.skins.cardTitle).forEach((titleEl) => {
            const card = titleEl.parentElement;
            if (!card) return;
            const icon = card.querySelector(gameDOM.skins.cardIcon);
            cards.push({
              title: (titleEl.textContent ?? "").trim(),
              isStandard: (icon?.getAttribute("src") ?? "").includes("ic_standard"),
              isEquipped: !!card.querySelector(gameDOM.skins.equippedIcon)
            });
          });
          return cards;
        }
        function readSelectedTitle(menu, row, cardTitles) {
          for (const el of menu.querySelectorAll("*")) {
            if (el.children.length > 0 || row.contains(el)) continue;
            const text = (el.textContent ?? "").trim();
            if (cardTitles.has(text.toLowerCase())) return text;
          }
          return null;
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
          const equippedCard = cards.find((card) => card.isEquipped);
          const namedCard = equippedCard && !equippedCard.isStandard ? equippedCard : cards.find((card) => !card.isStandard);
          if (!equippedCard || !namedCard) return { kind: "absent" };
          const words = namedCard.title.toLowerCase().split(/\s+/);
          const matchedWord = words.find((w) => nameTranslate[w]);
          if (!matchedWord) return { kind: "absent" };
          return {
            kind: "ready",
            item: nameTranslate[matchedWord],
            equipped: equippedCard.isStandard ? { kind: "standard" } : { kind: "skin", title: equippedCard.title },
            selectedTitle: readSelectedTitle(menu, row, new Set(cards.map((card) => card.title.toLowerCase()))),
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
          const selectedIsEquipped = state2.selectedTitle !== null && state2.selectedTitle.toLowerCase() === state2.equipped.title.toLowerCase();
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
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSkins));
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
              if (originalSrc && originalSrc.includes("tankionline.com") && originalSrc !== savedSkinsForList[itemNameEN]) {
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
        return tick;
      })();
    }
  });

  // src/modules/weaponAugmentTracker.ts
  var weaponAugmentTracker;
  var init_weaponAugmentTracker = __esm({
    "src/modules/weaponAugmentTracker.ts"() {
      init_gameDOM();
      init_state();
      weaponAugmentTracker = (() => {
        const STORAGE_KEY = "kasp_weapon_augment_tracker";
        let lastSignature = "";
        let currentReloadTime = 0;
        let barContainer = null;
        let barFill = null;
        let currentTurret = "";
        let isPressed = false;
        let pressTime = 0;
        let reloadStart = 0;
        let initialized = false;
        const TURRETS = [
          "firebird",
          "freeze",
          "isida",
          "tesla",
          "hammer",
          "twins",
          "ricochet",
          "vulcan",
          "smoky",
          "striker",
          "thunder",
          "tsunami",
          "scorpion",
          "magnum",
          "railgun",
          "gauss",
          "shaft"
        ];
        const NAME_TRANSLATE = {
          "\u043E\u0433\u043D\u0435\u043C\u0451\u0442": "firebird",
          "firebird": "firebird",
          "\u0444\u0440\u0438\u0437": "freeze",
          "freeze": "freeze",
          "\u0438\u0437\u0438\u0434\u0430": "isida",
          "isida": "isida",
          "\u0442\u0435\u0441\u043B\u0430": "tesla",
          "tesla": "tesla",
          "\u043C\u043E\u043B\u043E\u0442": "hammer",
          "hammer": "hammer",
          "\u0442\u0432\u0438\u043D\u0441": "twins",
          "twins": "twins",
          "\u0440\u0438\u043A\u043E\u0448\u0435\u0442": "ricochet",
          "ricochet": "ricochet",
          "\u0432\u0443\u043B\u043A\u0430\u043D": "vulcan",
          "vulcan": "vulcan",
          "\u0441\u043C\u043E\u043A\u0438": "smoky",
          "smoky": "smoky",
          "\u0441\u0442\u0440\u0430\u0439\u043A\u0435\u0440": "striker",
          "striker": "striker",
          "\u0433\u0440\u043E\u043C": "thunder",
          "thunder": "thunder",
          "\u0446\u0443\u043D\u0430\u043C\u0438": "tsunami",
          "tsunami": "tsunami",
          "\u0441\u043A\u043E\u0440\u043F\u0438\u043E\u043D": "scorpion",
          "scorpion": "scorpion",
          "\u043C\u0430\u0433\u043D\u0443\u043C": "magnum",
          "magnum": "magnum",
          "\u0440\u0435\u043B\u044C\u0441\u0430": "railgun",
          "railgun": "railgun",
          "\u0433\u0430\u0443\u0441\u0441": "gauss",
          "gauss": "gauss",
          "\u0448\u0430\u0444\u0442": "shaft",
          "shaft": "shaft"
        };
        const RELOAD_BASE_STEPS = {
          "shaft": {
            1: [2.7, 2.62, 2.54, 2.46],
            2: [2.45, 2.43, 2.42, 2.4, 2.39, 2.37],
            3: [2.36, 2.34, 2.33, 2.32, 2.3, 2.29, 2.28, 2.26, 2.25],
            4: [2.24, 2.22, 2.21, 2.2, 2.18, 2.17, 2.15, 2.14, 2.13, 2.11, 2.1],
            5: [2.09, 2.09, 2.08, 2.07, 2.06, 2.06, 2.05, 2.04, 2.03, 2.03, 2.02, 2.01],
            6: [2, 2, 1.99, 1.98, 1.98, 1.97, 1.96, 1.95, 1.95, 1.94, 1.93, 1.93, 1.92],
            7: [1.91, 1.91, 1.9, 1.9, 1.89, 1.89, 1.88, 1.87, 1.87, 1.86, 1.86, 1.85, 1.85, 1.84, 1.83, 1.83, 1.82, 1.82, 1.81, 1.81, 1.8]
          },
          "scorpion": {
            1: [4.05, 3.93, 3.81, 3.69],
            2: [3.67, 3.64, 3.62, 3.6, 3.57, 3.55],
            3: [3.54, 3.52, 3.51, 3.49, 3.48, 3.46, 3.45, 3.43, 3.42],
            4: [3.41, 3.39, 3.38, 3.37, 3.36, 3.34, 3.33, 3.32, 3.31, 3.29, 3.28],
            5: [3.27, 3.25, 3.24, 3.22, 3.21, 3.2, 3.18, 3.17, 3.15, 3.14, 3.12, 3.11],
            6: [3.09, 3.07, 3.06, 3.04, 3.02, 3, 2.99, 2.97, 2.95, 2.93, 2.92, 2.9, 2.88],
            7: [2.87, 2.86, 2.85, 2.85, 2.84, 2.83, 2.82, 2.81, 2.8, 2.79, 2.79, 2.78, 2.77, 2.76, 2.75, 2.74, 2.73, 2.73, 2.72, 2.71, 2.7]
          }
        };
        const AUGMENT_MODIFIERS = {
          "https://s.eu.tankionline.com/605/115405/45/51/31770737552234/image.svg": 1.15,
          "https://s.eu.tankionline.com/623/154745/143/361/31770737674426/image.svg": 1.7,
          "https://s.eu.tankionline.com/605/137574/124/170/31770737107437/image.svg": 1.15
        };
        const DISABLE_TIMER_AUGMENTS = [
          "https://s.eu.tankionline.com/605/115405/51/352/31770737750144/image.svg"
        ];
        try {
          const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (data && typeof data.reloadTime === "number") {
            currentReloadTime = data.reloadTime;
          }
        } catch (e) {
        }
        function createBar() {
          if (document.getElementById("kasp-reload-bar-container")) return;
          barContainer = document.createElement("div");
          barContainer.id = "kasp-reload-bar-container";
          barContainer.style.cssText = `
                    position: fixed;
                    bottom: 20%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 20em;
                    height: 0.35em;
                    background: rgb(0, 0, 0);
                    box-shadow: 0 0 0 0.2em rgb(0, 0, 0);
                    border-radius: 0.25em;
                    z-index: 9999;
                    pointer-events: none;
                    display: none;
                    overflow: hidden;
                `;
          barFill = document.createElement("div");
          barFill.id = "kasp-reload-bar-fill";
          barFill.style.cssText = `
                    width: 0%;
                    height: 100%;
                    border-radius: 0.25em;
                    background-color: #FFFF00;
                    box-shadow: 0 0 0.25em rgb(29, 29, 29);
                `;
          barContainer.appendChild(barFill);
          document.body.appendChild(barContainer);
        }
        function renderLoop() {
          requestAnimationFrame(renderLoop);
          if (!currentReloadTime || !document.pointerLockElement) {
            if (barContainer && barContainer.style.display !== "none") {
              barContainer.style.display = "none";
            }
            return;
          }
          const now = Date.now();
          const elapsed = now - reloadStart;
          const durationMs = currentReloadTime * 1e3;
          if (elapsed < durationMs && reloadStart > 0) {
            if (!barContainer) createBar();
            if (barContainer.style.display !== "block") barContainer.style.display = "block";
            const progress = Math.min(1, elapsed / durationMs);
            barFill.style.width = (progress * 100).toFixed(1) + "%";
          } else {
            if (barContainer && barContainer.style.display !== "none") {
              barContainer.style.display = "none";
            }
          }
        }
        function trackGarage() {
          if (state.currentScreen !== "garage") return;
          const nameEl = document.querySelector(gameDOM.garage.weaponName);
          if (!nameEl) return;
          const rawName = nameEl.textContent.trim().toLowerCase();
          const firstWord = rawName.split(/\s+/)[0];
          const itemNameEN = NAME_TRANSLATE[firstWord] || firstWord;
          if (!TURRETS.includes(itemNameEN)) return;
          const buttons = document.querySelectorAll(gameDOM.garage.weaponActions);
          let isEquipped = false;
          buttons.forEach((btn) => {
            const text = btn.textContent?.toLowerCase() || "";
            if (text.includes("equipped") || text.includes("\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E") || text.includes("\u0441\u043D\u044F\u0442\u044C") || text.includes("unequip")) {
              isEquipped = true;
            }
          });
          if (!isEquipped) return;
          const deviceIconEl = document.querySelector(gameDOM.garage.deviceIcon);
          let augmentSrc = "default";
          if (deviceIconEl) augmentSrc = deviceIconEl.getAttribute("src") || "default";
          let mkLevel = 7;
          let mkStep = 0;
          if (rawName.includes("max")) {
            mkLevel = 7;
            mkStep = 20;
          } else {
            const mkMatch = rawName.match(/mk\s*(\d+)(?:-(\d+))?/i);
            if (mkMatch) {
              mkLevel = parseInt(mkMatch[1]) || 7;
              mkStep = mkMatch[2] ? parseInt(mkMatch[2]) : 0;
            }
          }
          const currentSignature = `${itemNameEN}_mk${mkLevel}-${mkStep}_${augmentSrc}`;
          if (currentSignature === lastSignature) return;
          let reloadTime = null;
          if (DISABLE_TIMER_AUGMENTS.includes(augmentSrc)) {
            reloadTime = 0;
          } else if (RELOAD_BASE_STEPS[itemNameEN] && RELOAD_BASE_STEPS[itemNameEN][mkLevel]) {
            const stepsArray = RELOAD_BASE_STEPS[itemNameEN][mkLevel];
            const safeStep = Math.min(mkStep, stepsArray.length - 1);
            const baseTime = stepsArray[safeStep];
            const modifier = AUGMENT_MODIFIERS[augmentSrc] || 1;
            reloadTime = Math.round(baseTime * modifier * 100) / 100;
          }
          currentReloadTime = reloadTime;
          currentTurret = itemNameEN;
          const dataToSave = {
            turret: itemNameEN,
            augment: augmentSrc,
            mk: mkLevel,
            step: mkStep,
            reloadTime,
            timestamp: Date.now()
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
          lastSignature = currentSignature;
        }
        return () => {
          if (!initialized) {
            initialized = true;
            requestAnimationFrame(renderLoop);
            const onPointerDown = (e) => {
              if (e.type === "pointerdown" && (e.button !== 0 || e.pointerType === "touch")) return;
              if (e.type === "keydown" && (e.code !== "Space" || e.repeat)) return;
              if (!document.pointerLockElement) return;
              isPressed = true;
              pressTime = Date.now();
            };
            const onPointerUp = (e) => {
              if (e.type === "pointerup" && e.button !== 0) return;
              if (e.type === "keyup" && e.code !== "Space") return;
              if (!isPressed) return;
              isPressed = false;
              if (!document.pointerLockElement) return;
              if (!currentReloadTime) return;
              const holdTime = Date.now() - pressTime;
              if (holdTime > 200) {
                if (currentTurret !== "shaft") return;
              }
              const durationMs = currentReloadTime * 1e3;
              if (reloadStart && Date.now() - reloadStart < durationMs) return;
              reloadStart = Date.now();
            };
            document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
            document.addEventListener("keydown", onPointerDown, { capture: true, passive: true });
            document.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
            document.addEventListener("keyup", onPointerUp, { capture: true, passive: true });
          }
          if (state.currentScreen === "garage") {
            trackGarage();
          }
        };
      })();
    }
  });

  // src/modules/zeroResists.ts
  var zeroResists;
  var init_zeroResists = __esm({
    "src/modules/zeroResists.ts"() {
      init_gameDOM();
      init_state();
      zeroResists = (() => {
        const SHIELD_ICON_URL = chrome.runtime.getURL("assets/modulesTAB.svg");
        const RESISTANCE_MAP = {
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
        const TAB_SELECTOR = gameDOM.statistics.teams;
        const iconStyleCache = /* @__PURE__ */ new WeakMap();
        let isTabExpanded = localStorage.getItem("kasp_tab_expanded") === "true";
        let initialExpandedSet = false;
        function getIconStyle(iconDiv) {
          const cached = iconStyleCache.get(iconDiv);
          if (cached !== void 0) return cached;
          const cs = window.getComputedStyle(iconDiv);
          const result = {
            mask: (cs.getPropertyValue("-webkit-mask-image") || cs.getPropertyValue("mask-image") || "").toLowerCase(),
            bg: cs.backgroundColor || ""
          };
          iconStyleCache.set(iconDiv, result);
          return result;
        }
        function getCssUrl(el) {
          if (!el) return null;
          const cs = window.getComputedStyle(el);
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
        function getIconUrl(lbl) {
          const iconDiv = lbl.querySelector("div");
          if (iconDiv) {
            const style = getIconStyle(iconDiv);
            const m = style.mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1].toLowerCase();
          }
          const img = lbl.querySelector("img");
          if (img) return (img.src || "").toLowerCase();
          return "";
        }
        function injectCompactCells() {
          const cells = document.querySelectorAll(gameDOM.statistics.resistanceCell);
          cells.forEach((cell) => {
            const htmlCell = cell;
            const labels = Array.from(htmlCell.children).filter(
              (el) => el.classList.contains(gameDOM.classes.defenceLabel) && !el.closest(".kasp-compact-cell")
            );
            let protectLabel = null;
            let protectIsSpectrum = false;
            let armadilloLabel = null;
            for (const lbl of labels) {
              const url = getIconUrl(lbl);
              if (url.includes("all_resistance")) {
                protectLabel = lbl;
                protectIsSpectrum = true;
                break;
              }
            }
            if (!protectIsSpectrum) {
              for (const lbl of labels) {
                const iconDiv = lbl.querySelector("div");
                if (!iconDiv) continue;
                const style = getIconStyle(iconDiv);
                const isRed = style.bg.includes("254") || style.bg.includes("255, 80") || style.bg.includes("255, 102") || style.bg.includes("254, 102");
                if (isRed) {
                  protectLabel = lbl;
                  break;
                }
              }
            }
            for (const lbl of labels) {
              if (lbl === protectLabel) continue;
              const url = getIconUrl(lbl);
              if (url.includes("crit_resistance")) {
                armadilloLabel = lbl;
                break;
              }
            }
            const protectVal = protectLabel ? protectLabel.querySelector("h3")?.textContent || "on" : "none";
            const armadilloVal = armadilloLabel ? armadilloLabel.querySelector("h3")?.textContent || "on" : "none";
            const stateKey = `${protectIsSpectrum ? "spec" : protectVal}_${armadilloVal}`;
            let compact = htmlCell.querySelector(".kasp-compact-cell");
            if (compact && compact.dataset.kaspState === stateKey) return;
            if (!compact) {
              compact = document.createElement("div");
              compact.className = "kasp-compact-cell";
              htmlCell.prepend(compact);
            }
            compact.dataset.kaspState = stateKey;
            compact.innerHTML = "";
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
            compact.appendChild(slot1);
            const slot2 = document.createElement("div");
            slot2.className = "kasp-slot";
            if (armadilloLabel) {
              const clone = armadilloLabel.cloneNode(true);
              clone.classList.add("kasp-cloned-resist", "kasp-armadillo");
              slot2.appendChild(clone);
            } else {
              slot2.innerHTML = '<span class="kasp-dash">\u2014</span>';
            }
            compact.appendChild(slot2);
          });
        }
        function injectZeroSummary() {
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
            const maskImg = getCssUrl(icon);
            if (!maskImg) return;
            const match = maskImg.match(/\/([a-zA-Z_]+)_resistance(?:\.[0-9a-f]+)?\.(?:svg|webp|png)/);
            if (match && match[1]) presentResistances.add(match[1]);
          });
          const zeroBlocks = summaryRow.querySelectorAll(".kasp-zero-summary");
          zeroBlocks.forEach((block) => {
            const turret = block.getAttribute("data-turret");
            if (turret && presentResistances.has(turret)) block.remove();
          });
          Object.keys(RESISTANCE_MAP).forEach((turret) => {
            if (!presentResistances.has(turret) && !summaryRow.querySelector(`.kasp-zero-summary[data-turret="${turret}"]`)) {
              const zeroLabel = document.createElement("div");
              zeroLabel.className = `kasp-zero-summary ${gameDOM.classes.flexStart}`;
              zeroLabel.setAttribute("data-turret", turret);
              zeroLabel.style.cssText = "display: flex !important; align-items: center !important; justify-content: flex-start !important; margin-right: 0.75em !important; cursor: default !important; opacity: 1 !important; pointer-events: none !important;";
              const iconDiv = document.createElement("div");
              iconDiv.className = gameDOM.classes.mask;
              iconDiv.style.cssText = `background-color: #5cfc47 !important; height: 1em !important; width: 1em !important; margin-right: 0.1875em !important; -webkit-mask-image: url('${RESISTANCE_MAP[turret]}') !important; mask-image: url('${RESISTANCE_MAP[turret]}') !important; -webkit-mask-size: contain !important; mask-size: contain !important; -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important; -webkit-mask-position: center center !important; mask-position: center center !important;`;
              const textSpan = document.createElement("span");
              textSpan.className = gameDOM.classes.regular;
              textSpan.innerHTML = "&#215;0";
              textSpan.style.cssText = "font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important;";
              zeroLabel.appendChild(iconDiv);
              zeroLabel.appendChild(textSpan);
              summaryRow.appendChild(zeroLabel);
            }
          });
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
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            isTabExpanded = !isTabExpanded;
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
          injectHeaderShield();
          injectCompactCells();
          injectZeroSummary();
          injectToggleButton();
        }
        function update() {
          sync();
        }
        return { sync, update };
      })();
    }
  });

  // src/modules/equipmentTracker.ts
  var equipmentTracker;
  var init_equipmentTracker = __esm({
    "src/modules/equipmentTracker.ts"() {
      init_gameDOM();
      init_accountIdentity();
      equipmentTracker = /* @__PURE__ */ (() => {
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
        return { sync, get, clear };
      })();
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
  function getHistoryImageUrl(value) {
    if (typeof value !== "string" || !value || /[\s"'<>\\]/.test(value)) return "";
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
  function renderHistoryTemplate(template, values, markupKeys = []) {
    const markup = new Set(markupKeys);
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) return placeholder;
      return markup.has(key) ? String(values[key] ?? "") : escapeHistoryHtml(values[key]);
    });
  }
  var init_historyMarkup = __esm({
    "src/core/historyMarkup.ts"() {
    }
  });

  // src/modules/battleHistory/localization.ts
  function getHistoryDictionary(language) {
    return language === "RU" ? historyTranslations.RU : historyTranslations.EN;
  }
  function getClearHistoryDictionary(language) {
    return language === "RU" ? clearHistoryTranslations.RU : clearHistoryTranslations.EN;
  }
  function getLinkHistoryDictionary(language) {
    return language === "RU" ? linkHistoryTranslations.RU : linkHistoryTranslations.EN;
  }
  function getHistoryMessages(language) {
    return language === "RU" ? historyMessages.RU : historyMessages.EN;
  }
  var historyTranslations, clearHistoryTranslations, linkHistoryTranslations, historyMessages;
  var init_localization = __esm({
    "src/modules/battleHistory/localization.ts"() {
      historyTranslations = {
        RU: {
          title: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0411\u0438\u0442\u0432",
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
          link: "\u0421\u0432\u044F\u0437\u0430\u0442\u044C",
          export: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442",
          import: "\u0418\u043C\u043F\u043E\u0440\u0442",
          battles: "\u0411\u043E\u0451\u0432",
          noBattles: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0431\u043E\u0451\u0432",
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
          link: "Link",
          export: "Export",
          import: "Import",
          battles: "Battles",
          noBattles: "No saved battles yet",
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
      linkHistoryTranslations = {
        RU: {
          title: "\u0421\u0412\u042F\u0417\u0410\u0422\u042C \u0418\u0421\u0422\u041E\u0420\u0418\u0418",
          description: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0438\u043A, \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0438\u0441\u0442\u043E\u0440\u0438\u0438.",
          target: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F:",
          select: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0434\u043B\u044F \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F",
          placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0438\u043A\u043D\u0435\u0439\u043C",
          empty: "\u0414\u0440\u0443\u0433\u0438\u0445 \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u043E\u0432 \u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u043C\u0438 \u0431\u043E\u044F\u043C\u0438 \u043D\u0435\u0442.",
          cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
          confirm: "\u0421\u0432\u044F\u0437\u0430\u0442\u044C",
          success: (count) => `\u0418\u0441\u0442\u043E\u0440\u0438\u0438 \u0441\u0432\u044F\u0437\u0430\u043D\u044B. \u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0431\u043E\u0451\u0432: ${count}.`,
          failed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0432\u044F\u0437\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u0438."
        },
        EN: {
          title: "LINK HISTORIES",
          description: "Choose the nickname whose history should be added to the current history.",
          target: "Current history:",
          select: "History to add",
          placeholder: "Select a nickname",
          empty: "No other nicknames have saved battles.",
          cancel: "Cancel",
          confirm: "Link",
          success: (count) => `Histories linked. Battles added: ${count}.`,
          failed: "Could not link the histories."
        }
      };
      historyMessages = {
        RU: {
          unknownNickname: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043D\u0438\u043A.",
          listFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u0441\u0442\u043E\u0440\u0438\u0439.",
          imported: (count) => `\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0431\u043E\u0451\u0432: ${count}.`,
          importFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0444\u0430\u0439\u043B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E \u044D\u0442\u043E JSON-\u0444\u0430\u0439\u043B \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0431\u0438\u0442\u0432."
        },
        EN: {
          unknownNickname: "Could not detect the current nickname.",
          listFailed: "Could not load the history list.",
          imported: (count) => `Imported battles: ${count}.`,
          importFailed: "Could not import this file. Check that it is a valid battle history JSON file."
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
    let myTeamHtml = "";
    let enemyTeamHtml = "";
    let myTeamCount = 0;
    let enemyTeamCount = 0;
    (b.players || []).forEach((p) => {
      const isMeClass = p.isMe ? "current-player" : "";
      const gsClass = getGsClass(p.gs);
      const gsFormatted = formatNumber(p.gs);
      const scoreFormatted = formatNumber(p.score);
      const crystalsFormatted = formatNumber(p.crystals);
      const rankUrl = getHistoryImageUrl(p.rank);
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
      if (p.isEnemy) {
        enemyTeamHtml += rowHtml;
        enemyTeamCount++;
      } else {
        myTeamHtml += rowHtml;
        myTeamCount++;
      }
    });
    const { isWin, isDraw, isDM } = classifyResult(b);
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
      statsClass: enemyTeamCount === 0 ? "solo-mode" : "",
      playerLabel: dict.player,
      gsLabel: dict.gs,
      scoreLabel: dict.score,
      myTeamClass: myTeamCount > 0 ? "" : "bh-hidden",
      myTeamTitle: isDM ? dict.player : dict.myTeam,
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
    const mapImage = getHistoryImageUrl(mapInfo?.image);
    const modeUpper = String(b.mode || "MM").toUpperCase();
    const topDisplay = b.top && b.top !== "-" ? `#${b.top}` : "\u2014";
    const hasTeamScore = !isDM && typeof b.teamScoreMy === "number" && typeof b.teamScoreEnemy === "number";
    const teamScoreStat = hasTeamScore ? `<div class="bh-stat"><span class="bh-stat-value">${escapeHistoryHtml(b.teamScoreMy)}<span class="bh-stat-sep">/</span>${escapeHistoryHtml(b.teamScoreEnemy)}</span><span class="bh-stat-label bh-stat-label--team-score">${escapeHistoryHtml(dict.teamScore)}</span></div>` : "";
    const turretUrl = getHistoryImageUrl(b.turretIcon);
    const turretAugUrl = getHistoryImageUrl(b.turretAugmentIcon);
    const hullUrl = getHistoryImageUrl(b.hullIcon);
    const hullAugUrl = getHistoryImageUrl(b.hullAugmentIcon);
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
    return transaction("readwrite", (store, setResult) => {
      const request = store.add(battle);
      request.onsuccess = () => setResult(request.result);
    });
  }
  async function addBattles(battles) {
    if (!battles.length) return;
    await transaction("readwrite", (store) => {
      for (const battle of battles) store.add(battle);
    });
  }
  function getAllBattles(nickname) {
    return transaction("readonly", (store, setResult) => {
      const request = nickname && store.indexNames.contains("nickname") ? store.index("nickname").getAll(nickname) : store.getAll();
      request.onsuccess = () => setResult(request.result || []);
    });
  }
  function getNicknameHistory() {
    return transaction("readonly", (store, setResult) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const counts = /* @__PURE__ */ new Map();
        for (const battle of request.result) {
          if (battle.nickname) counts.set(battle.nickname, (counts.get(battle.nickname) || 0) + 1);
        }
        setResult(Array.from(counts, ([nickname, count]) => ({ nickname, count })).sort((a, b) => a.nickname.localeCompare(b.nickname)));
      };
    });
  }
  function mergeNicknameHistory(source, target) {
    return transaction("readwrite", (store, setResult) => {
      let count = 0;
      setResult(count);
      const request = store.index("nickname").openCursor(IDBKeyRange.only(source));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const battle = cursor.value;
        battle.nickname = target;
        cursor.update(battle);
        setResult(++count);
        cursor.continue();
      };
    });
  }
  function clearNicknameHistory(nickname) {
    return transaction("readwrite", (store) => {
      const request = store.index("nickname").getAllKeys(nickname);
      request.onsuccess = () => {
        for (const key of request.result) store.delete(key);
      };
    });
  }
  var DATABASE_NAME, DATABASE_VERSION, STORE_NAME, INDEXES;
  var init_repository = __esm({
    "src/modules/battleHistory/repository.ts"() {
      DATABASE_NAME = "TankiBattlesDB";
      DATABASE_VERSION = 4;
      STORE_NAME = "battles";
      INDEXES = ["date", "map", "mode", "top", "nickname"];
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
        window.clearTimeout(timer);
        element.removeEventListener("animationend", onAnimationEnd);
        element.classList.remove(className);
        resolve();
      };
      const onAnimationEnd = (event) => {
        if (event.target === element) finish();
      };
      element.classList.remove(className);
      void element.offsetWidth;
      element.addEventListener("animationend", onAnimationEnd);
      element.classList.add(className);
      timer = window.setTimeout(finish, duration + 50);
    });
    const renderDetailedMatch = async (b, dict, lang) => {
      const contentBlock = document.querySelector(".custom-history-content");
      if (!contentBlock) return;
      const revision = ++detailRevision;
      const isCurrent = () => revision === detailRevision && document.querySelector(".custom-history-content") === contentBlock;
      let template;
      try {
        template = await loadTemplate("detail");
      } catch (error) {
        console.error("[Tanki Battle History] Failed to load detail template:", error);
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
      card.addEventListener("click", () => renderDetailedMatch(b, dict, lang));
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
      prev.addEventListener("click", () => renderBattleList(current - 1));
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
        btn.addEventListener("click", () => renderBattleList(p));
        list.appendChild(btn);
      }
      const next = document.createElement("button");
      next.type = "button";
      next.className = "bh-page bh-page-arrow";
      next.textContent = "\u203A";
      next.disabled = current >= total;
      next.addEventListener("click", () => renderBattleList(current + 1));
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
          window.setTimeout(() => {
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
      account.updateNickname();
      const listEl = document.querySelector(".bh-list");
      if (!listEl) return;
      const revision = ++listRevision;
      const nickname = account.getNickname();
      const isCurrent = () => revision === listRevision && nickname === account.getNickname() && document.querySelector(".bh-list") === listEl;
      const lang = state.lang;
      const dict = getHistoryDictionary(lang);
      let battles;
      try {
        battles = await getAllBattles(nickname);
      } catch (error) {
        console.error("[BattleHistory] Failed to load battles:", error);
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
        console.error("[BattleHistory] Failed to render battles:", error);
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
  var init_views = __esm({
    "src/modules/battleHistory/views.ts"() {
      init_state();
      init_presentation();
      init_repository();
      init_localization();
    }
  });

  // src/modules/battleHistory/validation.ts
  function parseHistoryImport(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty-or-invalid-list");
    return data.map((value) => {
      const battle = validateImportedBattle(value);
      if (!battle) throw new Error("invalid-battle-record");
      return battle;
    });
  }
  var validateImportedBattle;
  var init_validation = __esm({
    "src/modules/battleHistory/validation.ts"() {
      init_historyMarkup();
      validateImportedBattle = (value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const battle = value;
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
        let players = [];
        if (battle.players !== void 0) {
          if (!Array.isArray(battle.players)) return null;
          for (const value2 of battle.players) {
            if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return null;
            const player = value2;
            if (typeof player.name !== "string" || typeof player.rank !== "string") return null;
            const numericFields = ["gs", "score", "kills", "deaths", "kd", "crystals", "stars"];
            if (numericFields.some((key) => typeof player[key] !== "number" || !Number.isFinite(player[key]))) return null;
            if (typeof player.isEnemy !== "boolean" || typeof player.isMe !== "boolean") return null;
            players.push({
              name: player.name,
              rank: getHistoryImageUrl(player.rank),
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
          turretIcon: getHistoryImageUrl(battle.turretIcon),
          turretAugmentIcon: getHistoryImageUrl(battle.turretAugmentIcon),
          hullIcon: getHistoryImageUrl(battle.hullIcon),
          hullAugmentIcon: getHistoryImageUrl(battle.hullAugmentIcon),
          teamScoreMy: battle.teamScoreMy,
          teamScoreEnemy: battle.teamScoreEnemy,
          players
        };
      };
    }
  });

  // src/modules/battleHistory/actions.ts
  function createActionButton(label, secondary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kasp-modal-button" + (secondary ? " kasp-modal-button--secondary" : "");
    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);
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
        cancelButton.addEventListener("click", modal.close);
        confirmButton.addEventListener("click", () => {
          if (confirmed) return;
          confirmed = true;
          modal.close();
          onConfirm();
        });
      } catch (error) {
        console.error("[Kaspersky Inventions] Failed to load clear history modal template:", error);
      }
    }
    const openLinkHistoryDialog = async () => {
      account.updateNickname();
      const nickname = account.getNickname();
      if (nickname === "Unknown") {
        window.alert(getHistoryMessages(state.lang).unknownNickname);
        return;
      }
      const existing = document.getElementById("link-history-overlay");
      if (existing) return;
      try {
        const dict = getLinkHistoryDictionary(state.lang);
        const nicknames = (await getNicknameHistory()).filter((item) => item.nickname !== nickname && item.nickname !== "Unknown");
        if (nickname !== account.getNickname()) return;
        const modal = await createKaspModal({ id: "link-history-overlay", title: dict.title, closeLabel: dict.cancel });
        if (!modal) return;
        if (nickname !== account.getNickname()) {
          modal.close();
          return;
        }
        const { body, actions, close } = modal;
        const description = document.createElement("p");
        description.className = "kasp-modal-copy";
        description.textContent = dict.description;
        const target = document.createElement("p");
        target.className = "kasp-modal-copy";
        const targetLabel = document.createElement("span");
        targetLabel.textContent = `${dict.target} `;
        const targetNickname = document.createElement("strong");
        targetNickname.className = "bh-link-target";
        targetNickname.textContent = nickname;
        target.append(targetLabel, targetNickname);
        const selectLabel = document.createElement("label");
        selectLabel.className = "bh-link-select-label";
        const selectLabelText = document.createElement("span");
        selectLabelText.textContent = dict.select;
        const select = document.createElement("select");
        select.className = "bh-link-select";
        select.setAttribute("aria-label", dict.select);
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = dict.placeholder;
        select.appendChild(placeholder);
        for (const item of nicknames) {
          const option = document.createElement("option");
          option.value = item.nickname;
          option.textContent = `${item.nickname} (${item.count})`;
          select.appendChild(option);
        }
        selectLabel.append(selectLabelText, select);
        const empty = document.createElement("p");
        empty.className = "bh-link-empty";
        empty.textContent = dict.empty;
        empty.hidden = nicknames.length > 0;
        selectLabel.hidden = nicknames.length === 0;
        const cancelButton = createActionButton(dict.cancel, true);
        const confirmButton = createActionButton(dict.confirm);
        confirmButton.disabled = true;
        confirmButton.hidden = nicknames.length === 0;
        actions.append(cancelButton, confirmButton);
        body.append(description, target, selectLabel, empty);
        let isLinking = false;
        cancelButton.addEventListener("click", close);
        select.addEventListener("change", () => {
          confirmButton.disabled = select.value === "";
        });
        confirmButton.addEventListener("click", async () => {
          const sourceNickname = select.value;
          if (!sourceNickname || isLinking || nickname !== account.getNickname()) return;
          isLinking = true;
          confirmButton.disabled = true;
          cancelButton.disabled = true;
          try {
            const moved = await mergeNicknameHistory(sourceNickname, nickname);
            close();
            await renderBattleList(1);
            window.setTimeout(() => window.alert(dict.success(moved)), 220);
          } catch (error) {
            console.error("[Tanki Battle History] Error linking histories:", error);
            isLinking = false;
            confirmButton.disabled = false;
            cancelButton.disabled = false;
            window.alert(dict.failed);
          }
        });
        modal.closeButton.focus();
      } catch (error) {
        console.error("[Tanki Battle History] Failed to open link history dialog:", error);
        window.alert(getHistoryMessages(state.lang).listFailed);
      }
    };
    const clearHistoryDb = () => {
      void showClearConfirmModal(async () => {
        try {
          await clearNicknameHistory(account.getNickname());
          await renderBattleList(1);
        } catch (error) {
          console.error("[Tanki Battle History] Error clearing DB:", error);
        }
      });
    };
    const exportHistoryData = async () => {
      account.updateNickname();
      const nickname = account.getNickname();
      try {
        const battles = await getAllBattles(nickname);
        if (battles.length === 0) return;
        const blob = new Blob([JSON.stringify(battles, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = `Tanki_BattleHistory_${nickname}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
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
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const target = e.target;
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const battles = parseHistoryImport(String(ev.target?.result ?? ""));
            await addBattles(battles);
            await renderBattleList(1);
            window.alert(getHistoryMessages(state.lang).imported(battles.length));
          } catch (err) {
            showImportError(err);
          }
        };
        reader.onerror = () => showImportError(reader.error);
        reader.readAsText(file);
      };
      input.click();
    };
    return { clearHistoryDb, openLinkHistoryDialog, exportHistoryData, importHistoryData };
  }
  var init_actions = __esm({
    "src/modules/battleHistory/actions.ts"() {
      init_state();
      init_modal();
      init_repository();
      init_validation();
      init_localization();
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
            <span class="kasp-loader-text">Loading</span>
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
      window.setTimeout(() => overlay.remove(), 120);
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
      const watch = new MutationObserver(() => {
        if (!document.querySelector(gameDOM.navigation.header)) {
          cover.style.opacity = "0";
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
      }, 2e3);
    };
    const disarmReturnWatcher = () => {
      exitAfterReturn = false;
      window.clearTimeout(returnTimer);
      window.clearTimeout(returnBackTimer);
      window.clearTimeout(returnLoaderTimer);
      returnLoaderObserver?.disconnect();
      returnLoaderObserver = null;
      returnObserver?.disconnect();
      returnObserver = null;
    };
    const armExitAfterReturn = () => {
      disarmReturnWatcher();
      exitAfterReturn = true;
      returnObserver = new MutationObserver(() => {
        if (!exitAfterReturn) return;
        if (!document.querySelector(gameDOM.navigation.header)) {
          disarmReturnWatcher();
          return;
        }
        const titleEl = document.querySelector(
          gameDOM.navigation.title
        );
        const text = (titleEl?.textContent?.trim() ?? "").toUpperCase();
        if (text === "SETTINGS" || text === "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418") {
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
          returnLoaderTimer = window.setTimeout(finishLoading, 2e3);
          returnBackTimer = window.setTimeout(() => {
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
      returnTimer = window.setTimeout(() => {
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
      for (const id of ["link-history-overlay", "clear-confirm-overlay"]) {
        const modal = document.getElementById(id);
        modal?.closeDialogMethod?.();
      }
      overlay.style.display = "none";
      restoreContainerBackground();
      if (nativeContent) nativeContent.style.display = previousNativeDisplay;
      nativeContent = null;
      pageObserver?.disconnect();
      pageObserver = null;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
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
      pageObserver = new MutationObserver(() => {
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
          window.clearTimeout(timer);
          resolve(element);
        };
        const obs = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) finish(el);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        timer = window.setTimeout(() => finish(null), timeoutMs);
      });
    };
    const bindOverlayToHeader = (overlay, header) => {
      const update = () => {
        const r = header.getBoundingClientRect();
        overlay.style.top = `${r.bottom}px`;
        overlay.style.height = `calc(100vh - ${r.bottom}px)`;
      };
      update();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      resizeHandler = update;
      window.addEventListener("resize", update);
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
      btn.addEventListener("click", async () => {
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
          await new Promise((r) => window.setTimeout(r, duration));
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
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
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
      document.addEventListener("keydown", (e) => {
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
      window.addEventListener("keydown", (e) => {
        if (document.getElementById("clear-confirm-overlay") || document.getElementById("link-history-overlay")) return;
        const overlay = document.querySelector(".custom-history-overlay");
        if (overlay && overlay.style.display === "flex") {
          if (e.code === "Escape" || e.code === "KeyZ" || e.key.toLowerCase() === "z") {
            if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
            closeHistoryOverlay(overlay);
            e.preventDefault();
          }
        }
      });
      document.addEventListener("mousedown", (e) => {
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
  var init_navigation = __esm({
    "src/modules/battleHistory/navigation.ts"() {
      init_gameDOM();
      init_state();
      init_localization();
    }
  });

  // src/modules/battleHistory/capture.ts
  function readInteger(row, column) {
    return parseInt((row.querySelector(gameDOM.results.columnPrefix + column)?.textContent || "0").replace(/\s/g, "")) || 0;
  }
  function readPlayers(tbody) {
    const players = [];
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
        players.push({
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
    return players;
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
  function readBattleResult(selfRow, nickname) {
    const scoreEl = selfRow.querySelector(gameDOM.results.score);
    const killsEl = selfRow.querySelector(gameDOM.results.kills);
    const deathsEl = selfRow.querySelector(gameDOM.results.deaths);
    if (!scoreEl || !killsEl || !deathsEl) return null;
    const scoreText = (scoreEl.textContent || "").trim();
    const killsText = (killsEl.textContent || "").trim();
    const deathsText = (deathsEl.textContent || "").trim();
    if (!scoreText || !killsText || !deathsText) return null;
    const players = readPlayers(document.querySelector(gameDOM.results.body));
    const mapEl = document.querySelector(gameDOM.results.mapName);
    const rawMapText = mapEl ? mapEl.textContent?.trim() || "" : "Unknown Map";
    const parsedMapData = parseMapAndMode(rawMapText);
    const statusEl = document.querySelector(gameDOM.results.status) || document.querySelector(gameDOM.results.statusFallback);
    const isDM = parsedMapData.mode.toUpperCase() === "DM" || statusEl && statusEl.textContent?.trim() === "";
    if (isDM) {
      for (const p of players) {
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
      players
    };
  }
  function createResultCapture(account) {
    let battleProcessed = false;
    let resultGeneration = 0;
    const capture = async () => {
      account.updateNickname();
      const selfRow = document.querySelector(gameDOM.results.selfRow);
      if (!selfRow || battleProcessed) return;
      if (account.getNickname() === "Unknown") {
        const nickCell = selfRow.querySelector(gameDOM.results.nicknameCell);
        if (nickCell) {
          const raw = (nickCell.textContent || "").trim();
          const clean = raw.replace(/^\[.*?\]\s*/, "").trim();
          if (clean && clean !== "Unknown") {
            account.setNickname(clean);
          }
        }
      }
      if (account.getNickname() === "Unknown") return;
      const generation = resultGeneration;
      try {
        const battle = readBattleResult(selfRow, account.getNickname());
        if (!battle) return;
        battleProcessed = true;
        await addBattle(battle);
      } catch (error) {
        console.error("[Tanki Battle History] Error saving battle result:", error);
        if (generation === resultGeneration) battleProcessed = false;
      }
    };
    return {
      capture,
      reset() {
        resultGeneration++;
        battleProcessed = false;
      }
    };
  }
  var parseMapAndMode;
  var init_capture = __esm({
    "src/modules/battleHistory/capture.ts"() {
      init_gameDOM();
      init_equipmentTracker();
      init_repository();
      parseMapAndMode = (rawMapText) => {
        if (!rawMapText) return { map: "Unknown Map", mode: "MM" };
        let text = rawMapText.trim();
        const modesList = ["CTF", "TDM", "DM", "CP", "SGE", "RGB", "JGR", "TJR", "ASL", "AR"];
        let foundMode = "MM";
        const parts = text.split(/\s+/);
        if (parts.length > 0) {
          const lastWord = parts[parts.length - 1].toUpperCase();
          if (modesList.includes(lastWord)) {
            foundMode = parts.pop() || "MM";
            text = parts.join(" ");
          }
        }
        const cleanMapName = text.replace(/\s+/g, " ").trim();
        return { map: cleanMapName || "Unknown", mode: foundMode };
      };
    }
  });

  // src/modules/battleHistory.ts
  var battleHistory;
  var init_battleHistory = __esm({
    "src/modules/battleHistory.ts"() {
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
      battleHistory = (() => {
        const NICK_KEY = "kasp_last_nickname";
        let initialized = false;
        let currentNickname = (() => {
          try {
            return localStorage.getItem(NICK_KEY) || "Unknown";
          } catch {
            return "Unknown";
          }
        })();
        let historyPagePromise = null;
        const setNickname = (nickname) => {
          if (nickname === currentNickname) return;
          const overlay = document.querySelector(".custom-history-overlay");
          if (overlay) {
            navigation.release(overlay);
            overlay.remove();
          }
          views.reset();
          historyPagePromise = null;
          currentNickname = nickname;
          try {
            localStorage.setItem(NICK_KEY, nickname);
          } catch {
          }
        };
        const updateNickname = () => {
          const nickname = getAccountIdentity()?.nickname;
          if (!nickname || nickname === "Unknown") return false;
          setNickname(nickname);
          return true;
        };
        const account = {
          getNickname: () => currentNickname,
          updateNickname,
          setNickname
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
          const nickname = currentNickname;
          const lang = state.lang;
          const dict = getHistoryDictionary(lang);
          const templateUrl = chrome.runtime.getURL("templates/battle-history-overlay.html");
          const response = await fetch(templateUrl);
          if (!response.ok) {
            throw new Error(`Failed to load history template: ${response.status}`);
          }
          const template = await response.text();
          if (nickname !== currentNickname || document.querySelector(".custom-history-overlay")) return;
          const replacements = {
            title: String(dict.title ?? ""),
            clear: String(dict.clear ?? ""),
            link: String(dict.link ?? ""),
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
          document.getElementById("bh-link-btn")?.addEventListener("click", actions.openLinkHistoryDialog);
          document.getElementById("bh-export-btn")?.addEventListener("click", actions.exportHistoryData);
          document.getElementById("bh-import-btn")?.addEventListener("click", actions.importHistoryData);
        };
        const ensureHistoryPage = () => {
          updateNickname();
          if (document.querySelector(".custom-history-overlay")) return Promise.resolve();
          if (!historyPagePromise) {
            const pending = createHistoryPage().catch((error) => console.error("[BattleHistory] Failed to create history page:", error)).finally(() => {
              if (historyPagePromise === pending) historyPagePromise = null;
            });
            historyPagePromise = pending;
          }
          return historyPagePromise;
        };
        return () => {
          if (!utils.getSetting("k_history", false)) return;
          if (!initialized) {
            initialized = true;
            navigation.bindShortcuts();
            setTimeout(updateNickname, 5e3);
          }
          navigation.injectFooterButton();
          void ensureHistoryPage();
          const inResults = document.querySelector(gameDOM.results.status);
          if (document.querySelector(gameDOM.results.selfRow) && inResults) {
            void results.capture();
          } else if (!inResults) {
            results.reset();
          }
        };
      })();
    }
  });

  // src/core/bonusPickup.ts
  function readBonusPosition(value) {
    if (!value || typeof value !== "object") return null;
    try {
      const point = value;
      const coordinates = "x" in point ? [point.x, point.y, point.z] : [point.f20_1, point.g20_1, point.h20_1];
      if (!coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) return null;
      const [x, y, z] = coordinates;
      return { x, y, z };
    } catch {
      return null;
    }
  }
  var OVERDRIVE_BOX_MODEL, BONUS_PICKUP_MESSAGE;
  var init_bonusPickup = __esm({
    "src/core/bonusPickup.ts"() {
      OVERDRIVE_BOX_MODEL = "1647333199409";
      BONUS_PICKUP_MESSAGE = "kasp:bonus-pickup";
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
      alwaysVisible: index === 0,
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
          distance: Math.hypot(
            position.x - timer.position.x,
            position.y - timer.position.y,
            position.z - timer.position.z
          )
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
  var OVERDRIVE_COOLDOWN_MS, OVERDRIVE_POINT_RADIUS, overdriveTimer;
  var init_overdriveTimer = __esm({
    "src/modules/overdriveTimer.ts"() {
      init_bonusPickup();
      init_gameDOM();
      init_state();
      init_utils();
      OVERDRIVE_COOLDOWN_MS = 85e3;
      OVERDRIVE_POINT_RADIUS = 250;
      overdriveTimer = (() => {
        const locations = createOverdriveLocations();
        const timers = locations.timers.map((location) => ({
          location,
          panel: null,
          time: null
        }));
        let initialized = false;
        let battleCanvas = null;
        let sectionOpen = false;
        let resumeUntil = 0;
        function reset() {
          locations.reset();
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
          const inBattle = syncBattle();
          if (!inBattle) reset();
          const enabled = utils.getSetting("k_overdrive_timer", false);
          const sectionVisible = isSectionVisible();
          for (const timer of timers) renderTimer(timer, inBattle && enabled && !sectionVisible);
        }
        function renderTimer(timer, visible) {
          const seconds = timer.location.countdown.remaining();
          if (!visible || !timer.location.alwaysVisible && seconds === null) {
            timer.panel?.remove();
            timer.panel = timer.time = null;
            return;
          }
          if (!document.body) return;
          if (!timer.panel?.isConnected) {
            timer.panel = document.createElement("div");
            timer.panel.id = timer.location.id;
            timer.panel.className = "kasp-overdrive-timer";
            timer.time = document.createElement("strong");
            timer.panel.append(timer.time);
            document.body.appendChild(timer.panel);
          }
          const { panel, time } = timer;
          const ru = state.lang === "RU";
          const value = seconds === null ? "0:00" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
          if (time.textContent !== value) time.textContent = value;
          panel.classList.toggle("kasp-overdrive-soon", seconds !== null && seconds > 0 && seconds <= 10);
          panel.classList.toggle("kasp-overdrive-ready", seconds === 0);
          const hint = ru ? "85 \u0441\u0435\u043A\u0443\u043D\u0434 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0431\u043E\u0440\u0430 \u043A\u043E\u0440\u043E\u0431\u043A\u0438. \u0412\u0440\u0435\u043C\u044F \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435." : "85 seconds after a box pickup. Respawn time is an estimate.";
          if (panel.title !== hint) panel.title = hint;
        }
        function setup() {
          if (initialized) return;
          initialized = true;
          window.addEventListener("message", (event) => {
            if (event.source !== window || !utils.getSetting("k_overdrive_timer", false)) return;
            const message = event.data;
            if (!message || typeof message !== "object") return;
            const { type, detail } = message;
            if (type !== BONUS_PICKUP_MESSAGE || !syncBattle()) return;
            const pickup = typeof detail === "string" ? { model: detail, position: null } : detail && typeof detail === "object" ? detail : null;
            if (!pickup || typeof pickup.model !== "string") return;
            if (locations.pickup(pickup.model, pickup.position)) render();
          });
          document.addEventListener("kasp:battle:id", () => {
            reset();
            render();
          });
          const previewObserver = new MutationObserver((records) => {
            const selector = `${gameDOM.screens.tankPreview}, ${gameDOM.common.container}`;
            if (records.some((record) => record.type === "childList" ? [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => node.matches?.(selector) || node.querySelector?.(selector)) : record.target.matches(selector))) render();
          });
          previewObserver.observe(document.documentElement, {
            childList: true,
            attributes: true,
            attributeFilter: ["class", "style", "hidden"],
            subtree: true
          });
          window.setInterval(render, 250);
          render();
        }
        return { setup, sync: render };
      })();
    }
  });

  // src/modules/index.ts
  var modules;
  var init_modules = __esm({
    "src/modules/index.ts"() {
      init_customPaints();
      init_augmentSpecs();
      init_customPlayButton();
      init_customFriends();
      init_garageButtons();
      init_welcomeModal();
      init_hideNickname();
      init_hideCurrency();
      init_customTrophies();
      init_autoUpgrade();
      init_changeCounter();
      init_customGarageSkins();
      init_weaponAugmentTracker();
      init_zeroResists();
      init_equipmentTracker();
      init_battleHistory();
      init_overdriveTimer();
      modules = {
        customPaints,
        augmentSpecs,
        customPlayButton,
        customFriends,
        garageButtons,
        welcomeModal,
        hideNickname,
        hideCurrency,
        customTrophies,
        autoUpgrade,
        changeCounter,
        customGarageSkins,
        weaponAugmentTracker,
        zeroResists,
        equipmentTracker,
        battleHistory,
        overdriveTimer
      };
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
      modules.changeCounter.onTick();
      modules.overdriveTimer.sync();
      modules.welcomeModal();
      modules.hideNickname();
      modules.hideCurrency();
      modules.weaponAugmentTracker();
      modules.customGarageSkins();
      try {
        if (state.currentScreen === "lobby" || state.currentScreen === "loading") {
          modules.customPlayButton();
        }
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
      } catch (e) {
        console.error("[Kaspersky's Inventions] \u041E\u0448\u0438\u0431\u043A\u0430 \u0432 \u043C\u043E\u0434\u0443\u043B\u0435:", e);
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
      const thead = document.querySelector(".BattleKillBoardComponentStyle-tableContainer table > thead");
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
      if (document.querySelector(".ApplicationLoaderComponentStyle-container")) {
        newScreen = "loading";
      } else if (document.querySelector(".BattleHudComponentStyle-container")) {
        newScreen = "battle";
      } else if (document.querySelector(".GarageCommonStyle-positionContent, .GarageItemComponent-container, .ContainerInfoComponentStyle-lootBoxContainer")) {
        newScreen = "garage";
      } else if (document.querySelector(".MainScreenComponentStyle-blockMainMenu")) {
        newScreen = "lobby";
      } else if (document.querySelector(".BattleResultHeaderComponentStyle-resultText")) {
        newScreen = "match_results";
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
      const isFriendsMenuOpen = !!document.querySelector(".FriendListComponentStyle-containerFriends, .InvitationWindowsComponentStyle-centerBlock");
      const friendsChanged = isFriendsMenuOpen !== state.friendsMenuOpen;
      state.friendsMenuOpen = isFriendsMenuOpen;
      const isSettingsOpen = !!document.querySelector(".SettingsComponentStyle-blockContentOptions");
      if (isSettingsOpen !== state.settingsOpen) {
        state.settingsOpen = isSettingsOpen;
        if (isSettingsOpen) {
          coreSettings.inject();
        } else {
          coreSettings.onClose();
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
      if (state.currentScreen === "match_results" || state.currentScreen === "lobby") {
        modules.battleHistory();
        syncKillBoardDoubleHeader();
      }
    };
    const masterObserver = new MutationObserver(() => {
      if (document.querySelector(".BattleTabStatisticComponentStyle-container")) {
        modules.changeCounter.sync();
        modules.zeroResists.sync();
        modules.equipmentTracker.sync();
      }
      if (document.querySelector(".GarageCommonStyle-positionContent, .ContainerInfoComponentStyle-lootBoxContainer")) {
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
        const oldTab = document.getElementById("kaspersky-tab");
        if (oldTab)
          oldTab.remove();
        const oldContent = document.getElementById("kaspersky-settings-content");
        if (oldContent)
          oldContent.remove();
        const oldTooltip = document.getElementById("kaspersky-reload-tooltip");
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
      init_state();
      init_utils();
      init_coreSettings();
      init_modules();
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
      if (window === window.top) {
        setupElectronZKey();
        const loaderBg = chrome.runtime.getURL("assets/background.png");
        document.documentElement.style.setProperty("--kasp-loader-bg", `url("${loaderBg}")`);
        state.lang = utils.getLang();
        setupNicknamePrivacy();
        startBoot();
      }
    }
  });
  require_kasp_main();
})();
