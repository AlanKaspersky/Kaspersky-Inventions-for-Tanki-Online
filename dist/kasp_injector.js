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
  function snapshotBonusArgument(value) {
    const visited = /* @__PURE__ */ new Set();
    let budget = 120;
    function walk(current, depth) {
      if (typeof current === "string") return current.slice(0, 160);
      if (current === null || typeof current === "number" || typeof current === "boolean") return current;
      if (typeof current !== "object") return `[${typeof current}]`;
      if (visited.has(current)) return "[cycle]";
      visited.add(current);
      const id = modelId(current);
      if (id) return { longId: id };
      if (depth >= 3 || budget-- <= 0) return "[depth/budget limit]";
      const result = {};
      try {
        const keys = Object.keys(current);
        for (const key of keys.slice(0, 12)) {
          try {
            result[key] = walk(current[key], depth + 1);
          } catch {
            result[key] = "[inaccessible]";
          }
        }
        if (keys.length > 12) result.__omittedFields = keys.length - 12;
      } catch {
        return "[inaccessible]";
      }
      return result;
    }
    return walk(value, 0);
  }
  function createBonusDiagnostics(output, initiallyEnabled = false, now = Date.now) {
    let enabled = initiallyEnabled;
    const records = [];
    return {
      record(record) {
        if (!enabled) return;
        try {
          const snapshot = { at: now(), ...record };
          records.push(snapshot);
          if (records.length > 200) records.shift();
          output(snapshot);
        } catch {
        }
      },
      enable(value = true) {
        enabled = value;
      },
      clear() {
        records.length = 0;
      },
      export() {
        return JSON.stringify(records, null, 2);
      }
    };
  }
  function modelId(value) {
    if (!value || typeof value !== "object") return null;
    try {
      const keys = Object.keys(value);
      if (keys.length !== 2) return null;
      const fields = keys.map((key) => value[key]);
      if (!fields.every((field2) => typeof field2 === "number")) return null;
      const id = String(value);
      return /^-?\d{4,20}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }
  function findModel(value, depth = 0, visited = /* @__PURE__ */ new Set()) {
    if (!value || typeof value !== "object" || depth > 3 || visited.has(value)) return null;
    visited.add(value);
    const direct = modelId(value);
    if (direct) return direct;
    try {
      for (const key of Object.keys(value).slice(0, 20)) {
        let child;
        try {
          child = value[key];
        } catch {
          continue;
        }
        const found = findModel(child, depth + 1, visited);
        if (found) return found;
      }
    } catch {
    }
    return null;
  }
  function bonusModels(value, excludedField) {
    if (!value || typeof value !== "object") return [];
    const models = [];
    try {
      for (const key of Object.keys(value).slice(0, 8)) {
        if (key === excludedField) continue;
        let child;
        try {
          child = value[key];
        } catch {
          continue;
        }
        if (child && typeof child === "object") models.push(findModel(child));
      }
    } catch {
    }
    return models;
  }
  function createBonusPickupBridge(emit, diagnose, diagnosticEnabled = () => !!diagnose) {
    const soundModels = /* @__PURE__ */ new Map();
    const pending = /* @__PURE__ */ new Map();
    function log(record) {
      try {
        diagnose?.(record);
      } catch {
      }
    }
    function resolve(data, excludedField) {
      const candidate = bonusModels(data, excludedField)[0] || (excludedField ? null : findModel(data));
      return candidate && (soundModels.has(candidate) ? soundModels.get(candidate) || null : candidate);
    }
    return {
      register(data, instanceId, x, y, z) {
        const [box, sound] = bonusModels(data);
        if (box && sound) {
          if (!soundModels.has(sound)) soundModels.set(sound, box);
          else if (soundModels.get(sound) !== box) soundModels.set(sound, null);
        }
        if (diagnosticEnabled()) {
          const position = [x, y, z].every((value) => typeof value === "number" && Number.isFinite(value)) ? { x, y, z } : null;
          log({
            kind: "register",
            model: box,
            sound,
            instanceId: snapshotBonusArgument(instanceId),
            position,
            coordinateArguments: position ? void 0 : [x, y, z].map(snapshotBonusArgument)
          });
        }
      },
      pickup(data) {
        try {
          const box = resolve(data);
          log({ kind: "pickup-model", model: box });
          if (box) emit(box);
        } catch {
        }
        return data;
      },
      prepare(data, field2) {
        const sound = data[field2];
        try {
          const entry = { model: resolve(data, field2) };
          const entries = pending.get(sound) || [];
          entries.push(entry);
          pending.set(sound, entries);
          log({ kind: "pickup-model", model: entry.model });
          Promise.resolve().then(() => {
            const stack = pending.get(sound);
            if (!stack) return;
            const index = stack.indexOf(entry);
            if (index >= 0) stack.splice(index, 1);
            if (!stack.length) pending.delete(sound);
          });
        } catch {
        }
        return sound;
      },
      context(first, second) {
        try {
          const entries = pending.get(first);
          const entry = entries?.pop();
          if (entries && !entries.length) pending.delete(first);
          const model = entry?.model || null;
          const position = readBonusPosition(second);
          if (diagnosticEnabled()) log({
            kind: "pickup-context",
            model,
            position,
            paired: !!entry,
            argument1: snapshotBonusArgument(first),
            argument2: snapshotBonusArgument(second)
          });
          if (model) emit(model, position);
        } catch {
        }
      }
    };
  }
  function patchBonusPickups(code, report) {
    let pickupHook = false;
    let contextHook = false;
    let registrationHooks = 0;
    const pickup = /[\w$]+\([\w$]+\)\.(\w+)=function\((\w+),(\w+)\)\{\w+\(this,this\.\w+,\2,\3,"bonus pickup"\)\}/.exec(code);
    if (pickup) {
      const original = pickup[0];
      const openingEnd = original.indexOf("{") + 1;
      const observed = original.slice(0, openingEnd) + "try{window.__kaspBonusContext&&window.__kaspBonusContext(" + pickup[2] + "," + pickup[3] + ")}catch(_kaspBonusError){};" + original.slice(openingEnd);
      code = code.replace(original, () => observed);
      contextHook = true;
      const call = new RegExp("\\." + pickup[1] + "\\(([\\w$]+\\([\\w$]+\\))\\.([\\w$]+),");
      pickupHook = call.test(code);
      code = code.replace(call, "." + pickup[1] + '(window.__kaspBonusPrepare($1,"$2"),');
    }
    const registration = /([\w$]+\([\w$]+\)\.\w+=function\(([\w$]+),([\w$]+),([\w$]+),([\w$]+),([\w$]+),[\w$]+\)\{)(var \w+,\w+,\w+=this\.\w+\.\w+\(\);)/g;
    code = code.replace(registration, (match, opening, id, data, x, y, z, locals, offset) => {
      if (!code.slice(offset, offset + 900).includes("onBonusCollision")) return match;
      registrationHooks++;
      return opening + "window.__kaspBonusRegister(" + [data, id, x, y, z].join(",") + ");" + locals;
    });
    try {
      report?.({ kind: "hooks", pickupHook, contextHook, registrationHooks });
    } catch {
    }
    return code;
  }
  var BONUS_PICKUP_MESSAGE;
  var init_bonusPickup = __esm({
    "src/core/bonusPickup.ts"() {
      BONUS_PICKUP_MESSAGE = "kasp:bonus-pickup";
    }
  });

  // src/core/gameDOM.ts
  var gameDOM;
  var init_gameDOM = __esm({
    "src/core/gameDOM.ts"() {
      gameDOM = {
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
          privateHeaderFields: ".UserInfoContainerStyle-userNameRank, .UserInfoContainerStyle-progressValue",
          clientParameter: ".ClientInfoComponentStyle-parameterText",
          currencyIcon: ".HeaderCommonStyle-icons",
          currencyValues: ".UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span"
        },
        screens: {
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

  // src/core/augmentLabels.ts
  function augmentPropertyLabel(property, language) {
    if (language === "RU" && russian[property]) return russian[property];
    const text = property.replace(/^ISIS_/, "ISIDA_").replace(/^MACHINE_GUN_/, "VULCAN_").replace(/^SHOTGUN_/, "HAMMER_").replace(/^ROCKET_LAUNCHER_/, "STRIKER_").replace(/^SCORPIO_/, "SCORPION_").toLowerCase().replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  var russian, higherBetter, lowerBetter;
  var init_augmentLabels = __esm({
    "src/core/augmentLabels.ts"() {
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
    const tabs = Array.from(root.querySelectorAll(".MenuComponentStyle-blockButtonsQECommunity .MenuComponentStyle-mainMenuItem"));
    if (tabs.length < 2 || tabs.length > 3) return null;
    const active = tabs.findIndex((tab) => tab.classList.contains("-activeMenu"));
    return ["augments", "skins", "shot-color"][active] || null;
  }
  function discoverModelCache(code) {
    const writer = /([\w$]+)\(([\w$]+)\)\.([\w$]+)\s*=\s*function\s*\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)\s*\{\s*this\.([\w$]+)\.([\w$]+)\.set\(\s*\4\s*,\s*\5\s*\)\s*;?\s*\}/g;
    const candidates = [...code.matchAll(writer)];
    const semantic = candidates.flatMap((match) => {
      const before = code.slice(Math.max(0, match.index - 1e3), match.index);
      if (!before.includes('"No objects in stack"')) return [];
      const getter = /([\w$]+)\(([\w$]+)\)\.([\w$]+)\s*=\s*function\s*\(\s*\)\s*\{\s*return\s+this\.[\w$]+\s*;?\s*\}\s*[,;]?\s*$/.exec(before);
      if (!getter || getter[1] !== match[1] || getter[2] !== match[2]) return [];
      return [{ match, objectIdMethod: getter[3] }];
    });
    if (semantic.length) return semantic.length === 1 ? semantic[0] : null;
    const legacy = candidates.filter((match) => match[3] === "r7i");
    return legacy.length === 1 ? { match: legacy[0], objectIdMethod: "p57" } : null;
  }
  function discoverAugmentSchema(code) {
    function field2(type2, label) {
      const marker = code.indexOf(`"${type2}`);
      if (marker < 0) return void 0;
      const before = code.slice(Math.max(0, marker - 500), marker);
      const headers = [...before.matchAll(/([\w$]+)\(([\w$]+)\)\.toString\s*=\s*function\s*\([^)]*\)\s*\{/g)];
      const header = headers[headers.length - 1];
      if (!header) return void 0;
      const body = code.slice(marker, code.indexOf("}", marker));
      const match = new RegExp(`"[^"\\r\\n]*\\b${label}\\s*=\\s*"\\s*\\+\\s*(?:[\\w$]+\\()?this\\.([\\w$]+)(\\(\\))?`).exec(body);
      if (!match) return void 0;
      if (!match[2]) return match[1];
      const area = code.slice(Math.max(0, marker - 2e4), marker + 1e3);
      const getter = new RegExp(`${header[1]}\\(${header[2]}\\)\\.${match[1]}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{\\s*(?:var\\s+[\\w$]+\\s*=\\s*|return\\s+)this\\.([\\w$]+)`).exec(area);
      return getter?.[1];
    }
    const schema = {
      objectIdMethod: discoverModelCache(code)?.objectIdMethod,
      viewDeviceId: field2("GarageDevice(id=", "id"),
      viewPreview: field2("GarageDevice(id=", "previewImage"),
      viewRarity: field2("GarageDevice(id=", "rarity"),
      imageUrlMethod: /props\.icon\s*;[^{}]{0,120}?\b[\w$]+\.([\w$]+)\(\)/.exec(code)?.[1],
      properties: field2("DevicePropertiesCC [", "properties"),
      operation: field2("DevicePropertyEntity [", "operation"),
      property: field2("DevicePropertyEntity [", "property"),
      value: field2("DevicePropertyEntity [", "value"),
      name: field2("DescriptionModelCC [", "name"),
      description: field2("DescriptionModelCC [", "description"),
      deviceId: field2("GarageDeviceObject(id=", "id"),
      baseItemId: field2("GarageDeviceObject(id=", "baseItemId"),
      upgradeLevel: field2("UpgradeParamsCC [", "currentLevel"),
      upgradeData: field2("UpgradeParamsCC [", "itemData"),
      upgradeGroups: field2("UpgradeParamsData [", "properties"),
      upgradeLevels: field2("UpgradeParamsData [", "upgradeLevelsCount"),
      groupProperties: field2("GaragePropertyParams [", "properties"),
      baseProperty: field2("PropertyData [", "property"),
      baseInitial: field2("PropertyData [", "initialValue"),
      baseFinal: field2("PropertyData [", "finalValue")
    };
    return ["properties", "operation", "property", "value", "name", "description"].every((key) => !!schema[key]) ? schema : null;
  }
  function patchGameAugments(code) {
    const schema = discoverAugmentSchema(code);
    if (!schema) return code;
    const cache = discoverModelCache(code);
    if (!cache) return code;
    const { match } = cache;
    const replacement = match[0].replace(/\s*\}$/, `;try{window.__kaspAugmentData(${match[4]},${match[5]})}catch(__kaspIgnored){} }`);
    let patched = code.slice(0, match.index) + replacement + code.slice(match.index + match[0].length);
    if (schema.deviceId && schema.baseItemId) {
      const constructor = new RegExp(`function\\s+[\\w$]+\\([^)]{1,400}\\)\\s*\\{\\s*this\\.${schema.deviceId}\\s*=\\s*[\\w$]+\\s*[,;]\\s*this\\.${schema.baseItemId}\\s*=\\s*[\\w$]+[^{}]*\\}`, "g");
      patched = patched.replace(constructor, (whole) => whole.replace(/\s*\}$/, `;try{window.__kaspAugmentLink(this.${schema.deviceId},this.${schema.baseItemId})}catch(__kaspIgnored){} }`));
    }
    const directive = /^\s*(["'])use strict\1\s*;/.exec(patched)?.[0] || "";
    return `${directive}
try{window.__kaspAugmentConfigure(${JSON.stringify(schema)})}catch(__kaspIgnored){}
${patched.slice(directive.length)}`;
  }
  function longId(value) {
    if (typeof value === "string") return /^\d{1,20}$/.test(value) ? value : null;
    if (!value || typeof value !== "object") return null;
    try {
      const fields = Object.values(Object.getOwnPropertyDescriptors(value));
      if (fields.length !== 2 || !fields.every((field2) => "value" in field2 && typeof field2.value === "number" && Number.isFinite(field2.value))) return null;
      const id = String(value);
      return /^\d{1,20}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }
  function readGameProperties(value, schema) {
    try {
      const iterator = value.t();
      const properties = [];
      while (iterator.u()) {
        if (properties.length >= 512) return null;
        const item = iterator.v();
        const operation = String(item[schema.operation]);
        const property = String(item[schema.property]);
        const number = item[schema.value];
        if (!["DELTA_PERCENT", "OVERRIDE_VALUE"].includes(operation) || !/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof number !== "number" || !Number.isFinite(number)) return null;
        properties.push({ operation, property, value: number });
      }
      return properties;
    } catch {
      return null;
    }
  }
  function readEquipmentProperties(raw, schema) {
    if (!["upgradeLevel", "upgradeData", "upgradeGroups", "upgradeLevels", "groupProperties", "baseProperty", "baseInitial", "baseFinal"].every((key) => !!schema[key])) return null;
    try {
      const source = raw;
      const currentLevel = source[schema.upgradeLevel];
      const data = source[schema.upgradeData];
      const levels = data?.[schema.upgradeLevels];
      if (typeof currentLevel !== "number" || typeof levels !== "number" || !Number.isSafeInteger(currentLevel) || !Number.isSafeInteger(levels) || currentLevel < 0 || levels < 0 || currentLevel > levels) return null;
      const properties = {};
      const ambiguous = /* @__PURE__ */ new Set();
      const groups = data[schema.upgradeGroups].t();
      let budget = 1024;
      while (groups.u()) {
        if (--budget < 0) return null;
        const items = groups.v()[schema.groupProperties].t();
        while (items.u()) {
          if (--budget < 0) return null;
          const item = items.v();
          const property = String(item[schema.baseProperty]);
          const initial = item[schema.baseInitial], final = item[schema.baseFinal];
          if (!/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof initial !== "number" || typeof final !== "number" || !Number.isFinite(initial) || !Number.isFinite(final)) return null;
          const value = levels === 0 ? initial : initial + (final - initial) / levels * currentLevel;
          if (!Number.isFinite(value)) return null;
          if (Object.prototype.hasOwnProperty.call(properties, property) && properties[property] !== value) ambiguous.add(property);
          properties[property] = value;
        }
      }
      ambiguous.forEach((property) => delete properties[property]);
      return { currentLevel, properties };
    } catch {
      return null;
    }
  }
  function closestReactProps(node) {
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
    let fiber = key ? node[key] : void 0;
    if (!fiber) return [];
    let root = fiber;
    for (let depth = 0; root.return && depth < 100; depth++) root = root.return;
    const current = root.stateNode?.current;
    let parents;
    if (current) {
      let tree = committedTrees.get(root.stateNode);
      if (!tree || tree.root !== current) {
        parents = /* @__PURE__ */ new Map();
        const pending = [[current, null]];
        while (pending.length && parents.size < 2e4) {
          const [item, parent] = pending.pop();
          if (parents.has(item)) continue;
          parents.set(item, parent);
          if (item.sibling) pending.push([item.sibling, parent]);
          if (item.child) pending.push([item.child, item]);
        }
        tree = { root: current, parents };
        committedTrees.set(root.stateNode, tree);
      }
      parents = tree.parents;
      if (!parents.has(fiber)) fiber = fiber.alternate;
      if (!fiber || !parents.has(fiber)) return [];
    }
    const props = [];
    for (let ancestor = 0; fiber && ancestor < 4; ancestor++) {
      props.push(fiber.memoizedProps);
      fiber = parents ? parents.get(fiber) || void 0 : fiber.return;
    }
    return props;
  }
  function findAugmentIdentity(element, knownIds, schema) {
    for (let node = element, level = 0; node && level < 6; node = node.parentElement, level++) {
      for (const props of closestReactProps(node)) {
        let visit = function(value, depth) {
          if (!value || typeof value !== "object" || seen.has(value) || depth > 4 || budget-- <= 0) return;
          seen.add(value);
          const fields = Object.getOwnPropertyDescriptors(value);
          for (const [name, descriptor] of Object.entries(fields).slice(0, 40)) {
            if (!("value" in descriptor) || ["children", "return", "_owner", "ref"].includes(name)) continue;
            const child = descriptor.value;
            const id = longId(child);
            if (id && knownIds.has(id)) {
              const base = schema.baseItemId ? longId(fields[schema.baseItemId]?.value) : null;
              found.set(id, base || void 0);
            } else visit(child, depth + 1);
          }
        };
        const found = /* @__PURE__ */ new Map();
        const seen = /* @__PURE__ */ new Set();
        let budget = 150;
        try {
          visit(props, 0);
        } catch {
          continue;
        }
        if (found.size === 1) {
          const [id, baseItemId] = [...found][0];
          return { id, baseItemId };
        }
        if (found.size > 1) break;
      }
    }
    return null;
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
  function findAugmentPreview(element, id, schema) {
    return findAugmentCardAppearance(element, id, schema).previewIcon;
  }
  function findUnavailableCosmetic(element, schema) {
    const candidates = /* @__PURE__ */ new Map();
    for (let node = element, level = 0; node && level < 3; node = node.parentElement, level++) {
      for (const props of closestReactProps(node)) {
        if (!props || typeof props !== "object") continue;
        const fields = Object.getOwnPropertyDescriptors(props);
        if (fields.isUnknown?.value !== true || fields.typeStandardDevice?.value === true) continue;
        const id = longId(fields.id?.value), name = fields.name?.value;
        if (!id || typeof name !== "string" || !name.trim() || name.length > 500) continue;
        const previewIcon = findAugmentPreview(element, id, schema);
        if (previewIcon) candidates.set(id, { id, name, previewIcon });
      }
      if (candidates.size) break;
    }
    return candidates.size === 1 ? [...candidates.values()][0] : void 0;
  }
  function findAugmentCardAppearance(element, id, schema) {
    const urls = /* @__PURE__ */ new Set();
    const rarities = /* @__PURE__ */ new Set();
    const seen = /* @__PURE__ */ new Set();
    let budget = 150;
    function resource(value) {
      try {
        if (isAugmentPreviewUrl(value)) {
          urls.add(value);
          return;
        }
        if (!value || typeof value !== "object" || !schema.imageUrlMethod) return;
        let owner = value, method;
        for (let depth = 0; owner && depth < 6; depth++, owner = Object.getPrototypeOf(owner)) {
          const descriptor = Object.getOwnPropertyDescriptor(owner, schema.imageUrlMethod);
          if (descriptor) {
            method = descriptor.value;
            break;
          }
        }
        if (typeof method === "function") {
          const url = method.call(value);
          if (isAugmentPreviewUrl(url)) urls.add(url);
        }
      } catch {
      }
    }
    function visit(value, depth) {
      if (!value || typeof value !== "object" || seen.has(value) || depth > 4 || --budget < 0) return;
      seen.add(value);
      const fields = Object.getOwnPropertyDescriptors(value);
      const directId = longId(fields.id?.value);
      const viewId = schema.viewDeviceId ? longId(fields[schema.viewDeviceId]?.value) : null;
      if (directId === id || viewId === id) {
        const rarity = directId === id ? fields.currentRarity?.value : schema.viewRarity ? fields[schema.viewRarity]?.value : void 0;
        try {
          const name = rarity == null ? "" : String(rarity);
          if (/^(COMMON|RARE|EPIC|LEGENDARY)$/.test(name)) rarities.add(name);
        } catch {
        }
      }
      if (directId === id) {
        resource(fields.icon?.value);
        resource(fields.iconUrl?.value);
      }
      if (viewId === id && schema.viewPreview) {
        const preview = fields[schema.viewPreview]?.value;
        if (Array.isArray(preview)) resource(preview[0]);
        else if (preview && typeof preview.t === "function") {
          const iterator = preview.t();
          if (iterator.u()) resource(iterator.v());
        }
      }
      for (const [name, descriptor] of Object.entries(fields).slice(0, 40)) {
        if ("value" in descriptor && !["children", "return", "_owner", "ref"].includes(name)) visit(descriptor.value, depth + 1);
      }
    }
    for (let node = element, level = 0; node && level < 6; node = node.parentElement, level++) {
      for (const props of closestReactProps(node)) {
        try {
          visit(props, 0);
        } catch {
        }
      }
      if (urls.size) break;
    }
    return {
      previewIcon: urls.size === 1 ? [...urls][0] : void 0,
      rarity: rarities.size === 1 ? [...rarities][0] : void 0
    };
  }
  function installGameAugments(page) {
    let enabled = false;
    let schema = null;
    let revision = 0;
    let queued = false;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entries = /* @__PURE__ */ new Map();
    const equipment = /* @__PURE__ */ new Map();
    function locale() {
      try {
        const language = localStorage.getItem("language_store_key") || document.documentElement.lang;
        return language ? language.toLowerCase().startsWith("ru") ? "RU" : "EN" : page.location?.hostname.includes("ru.") ? "RU" : "EN";
      } catch {
        return "EN";
      }
    }
    function snapshot() {
      return {
        format: "kasp-augments-v1",
        session,
        revision,
        updatedAt: Date.now(),
        hooked: !!schema,
        devices: [...entries.values()].filter((entry) => entry.properties !== void 0),
        equipment: [...equipment.values()]
      };
    }
    function publish() {
      page.postMessage({ type: AUGMENTS_MESSAGE, detail: snapshot() }, "*");
    }
    function schedule() {
      if (queued) return;
      queued = true;
      page.setTimeout(() => {
        queued = false;
        publish();
      }, 100);
    }
    page.__kaspAugmentConfigure = (value) => {
      schema = value;
      revision++;
      schedule();
    };
    page.__kaspAugmentLink = (rawId, rawBase) => {
      const id = longId(rawId);
      const baseItemId = longId(rawBase);
      const entry = id ? entries.get(id) : null;
      if (entry && baseItemId && entry.baseItemId !== baseItemId) {
        entry.baseItemId = baseItemId;
        revision++;
        schedule();
      }
    };
    page.__kaspAugmentData = (object, raw) => {
      if (!schema || !raw || typeof raw !== "object") return;
      try {
        const data = raw;
        const isProperties = Object.prototype.hasOwnProperty.call(data, schema.properties);
        const isDescription = Object.prototype.hasOwnProperty.call(data, schema.name) && Object.prototype.hasOwnProperty.call(data, schema.description);
        const isEquipment = schema.upgradeData && Object.prototype.hasOwnProperty.call(data, schema.upgradeData);
        if (!isProperties && !isDescription && !isEquipment) return;
        const method = object[schema.objectIdMethod || "p57"];
        if (typeof method !== "function") return;
        const id = String(method.call(object));
        if (!/^\d{1,20}$/.test(id) || entries.size >= 2e4 && !entries.has(id)) return;
        if (isEquipment) {
          const baseline = readEquipmentProperties(data, schema);
          if (baseline && (equipment.size < 2e4 || equipment.has(id))) {
            const next = { id, ...baseline };
            if (JSON.stringify(equipment.get(id)) !== JSON.stringify(next)) {
              equipment.set(id, next);
              revision++;
              schedule();
            }
          } else if (!baseline && equipment.delete(id)) {
            revision++;
            schedule();
          }
          if (!isProperties && !isDescription) return;
        }
        const entry = entries.get(id) || { id, locale: locale(), icons: [] };
        const before = JSON.stringify(entry);
        if (isProperties) {
          const properties = readGameProperties(data[schema.properties], schema);
          if (properties) entry.properties = properties;
        }
        if (isDescription) {
          if (typeof data[schema.name] === "string") entry.name = data[schema.name].slice(0, 500);
          if (typeof data[schema.description] === "string") entry.description = data[schema.description].slice(0, 16e3);
          entry.locale = locale();
        }
        entries.set(id, entry);
        if (before !== JSON.stringify(entry)) {
          revision++;
          schedule();
        }
      } catch {
      }
    };
    function bindCards(force = false) {
      if (!enabled && !force || !schema || !document.body) return;
      const section = activeGarageCardSection(document);
      const ids = new Set([...entries.values()].filter((entry) => entry.properties !== void 0).map((entry) => entry.id));
      const elements = document.querySelectorAll(`${gameDOM.augments.cardImage}, ${gameDOM.garage.deviceIcon}, ${gameDOM.augments.rewardImageBlock} ${gameDOM.common.backgroundDiv}`);
      for (const element of Array.from(elements)) {
        const cosmetic = (section === "skins" || section === "shot-color") && element.closest?.(".SkinsAndAlterationsStyle-SkinsVerticalComponent") ? findUnavailableCosmetic(element, schema) : void 0;
        for (const [attribute, value] of [
          ["data-kasp-cosmetic-id", cosmetic?.id],
          ["data-kasp-cosmetic-name", cosmetic?.name],
          ["data-kasp-cosmetic-preview", cosmetic?.previewIcon],
          ["data-kasp-cosmetic-section", cosmetic ? section : void 0]
        ]) {
          if (value && element.getAttribute(attribute) !== value) {
            element.setAttribute(attribute, value);
            revision++;
            schedule();
          } else if (!value && element.hasAttribute(attribute)) {
            element.removeAttribute(attribute);
            revision++;
            schedule();
          }
        }
        const identity = section === "skins" || section === "shot-color" ? null : findAugmentIdentity(element, ids, schema);
        if (!identity) {
          if (element.hasAttribute("data-kasp-augment-id")) {
            element.removeAttribute("data-kasp-augment-id");
            revision++;
            schedule();
          }
          continue;
        }
        let changed = element.getAttribute("data-kasp-augment-id") !== identity.id;
        if (changed) element.setAttribute("data-kasp-augment-id", identity.id);
        const entry = entries.get(identity.id);
        const appearance = findAugmentCardAppearance(element, identity.id, schema);
        const preview = appearance.previewIcon;
        if (preview && entry.previewIcon !== preview) {
          entry.previewIcon = preview;
          changed = true;
        }
        if (appearance.rarity && entry.rarity !== appearance.rarity) {
          entry.rarity = appearance.rarity;
          changed = true;
        }
        const url = element instanceof HTMLImageElement ? element.src : /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(element).backgroundImage)?.[1];
        if (identity.baseItemId && entry.baseItemId !== identity.baseItemId) {
          entry.baseItemId = identity.baseItemId;
          changed = true;
        }
        if (url && /^https?:\/\//.test(url) && !entry.icons.includes(url) && entry.icons.length < 16) {
          entry.icons.push(url);
          changed = true;
        }
        if (changed) {
          revision++;
          schedule();
        }
      }
    }
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
      if (!enabled) return;
      const relevant = records.some((record) => record.type === "attributes" ? record.target.matches(`${gameDOM.augments.cardImage}, .MenuComponentStyle-mainMenuItem`) : Array.from(record.addedNodes).some((node) => node.nodeType === 1 && (node.matches(gameDOM.augments.cardImage) || node.querySelector(gameDOM.augments.cardImage))));
      if (!relevant) return;
      const previous = revision;
      bindCards();
      if (revision !== previous) publish();
    });
    let scanTimer;
    function syncEnabled() {
      let next = false;
      try {
        next = localStorage.getItem("k_augments") === "true";
      } catch {
      }
      document.documentElement.toggleAttribute?.("data-kasp-augments-enabled", next);
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "class"] });
        scanTimer = page.setInterval(bindCards, 1e3);
        bindCards();
        publish();
      } else {
        observer?.disconnect();
        if (scanTimer !== void 0) page.clearInterval(scanTimer);
        scanTimer = void 0;
      }
    }
    page.addEventListener("kasp:settings-changed", syncEnabled);
    page.addEventListener("storage", syncEnabled);
    syncEnabled();
    page.addEventListener("message", (event) => {
      if (event.source === page && event.data?.type === AUGMENTS_REQUEST) publish();
    });
    function pageData() {
      bindCards(true);
      const devices = /* @__PURE__ */ new Map();
      const unmatchedCards = [];
      const elements = document.querySelectorAll(gameDOM.augments.cardImage);
      for (const element of Array.from(elements)) {
        if (!element.getClientRects().length) continue;
        const id = element.getAttribute("data-kasp-augment-id");
        const device = id ? entries.get(id) : void 0;
        if (!device || device.properties === void 0) {
          unmatchedCards.push({ icon: element.getAttribute("src"), reason: "Device identity or captured properties are unavailable." });
          continue;
        }
        const baseline = device.baseItemId ? equipment.get(device.baseItemId) : void 0;
        devices.set(device.id, {
          objectId: device.id,
          baseItemId: device.baseItemId,
          name: device.name,
          description: device.description,
          locale: device.locale,
          currentLevel: baseline?.currentLevel,
          properties: device.properties.map((property) => ({
            property: property.property,
            name: { RU: augmentPropertyLabel(property.property, "RU"), EN: augmentPropertyLabel(property.property, "EN") },
            operation: property.operation,
            value: property.value,
            baseValue: baseline?.properties[property.property]
          }))
        });
      }
      return {
        format: "kasp-augment-page-v1",
        capturedAt: Date.now(),
        devices: [...devices.values()],
        unmatchedCards,
        note: "Only currently rendered visible device cards are included. Scroll virtualized lists and export again to inspect more cards."
      };
    }
    page.__kaspAugmentsDebug = {
      export: () => JSON.stringify(snapshot(), null, 2),
      page: () => JSON.parse(JSON.stringify(pageData())),
      exportPage: () => JSON.stringify(pageData(), null, 2),
      status: () => ({ hooked: !!schema, devices: snapshot().devices.length, equipment: equipment.size, revision })
    };
  }
  var AUGMENTS_MESSAGE, AUGMENTS_REQUEST, committedTrees;
  var init_gameAugments = __esm({
    "src/core/gameAugments.ts"() {
      init_gameDOM();
      init_augmentLabels();
      AUGMENTS_MESSAGE = "kasp:game-augments";
      AUGMENTS_REQUEST = "kasp:game-augments-request";
      committedTrees = /* @__PURE__ */ new WeakMap();
    }
  });

  // src/core/garageDetails.ts
  function patchUnavailableGarageDetails(code) {
    const selected = (label) => {
      const fields = [...code.matchAll(new RegExp(`", ${label}="\\s*\\+\\s*this\\.([\\w$]+)`, "g"))].map((match) => match[1]);
      const unique = [...new Set(fields)];
      return unique;
    };
    const devices = selected("selectedDevice"), skins = selected("selectedSkin");
    if (!devices.length || skins.length !== 1) return code;
    const skin = skins[0];
    const enabled = "__kaspShowUnavailableDetails()";
    let patched = code;
    let changed = false;
    let unknownMethod, filter;
    for (const field2 of [...devices, skin]) {
      const start = new RegExp(`var ([\\w$]+)=this\\.[\\w$]+\\.${field2},`).exec(patched);
      if (!start) continue;
      const end = patched.indexOf(",function(t,n){", start.index);
      if (end < 0 || end - start.index > 2500) continue;
      const block = patched.slice(start.index, end);
      const item = start[1];
      const unknown = new RegExp(`\\b${item}\\.([\\w$]+)\\(\\)`).exec(block)?.[1];
      if (!unknown) continue;
      let replacement = block;
      if (devices.includes(field2)) {
        const invert = /([\w$]+)\(([\w$]+),"invert\(0\.25\)"\)/.exec(block);
        if (!invert || !block.includes(`!${item}.${unknown}()`)) continue;
        filter = invert[1];
        unknownMethod = unknown;
        replacement = replacement.replace(invert[0], `${filter}(${invert[2]},${enabled}?"grayscale(1)":"invert(0.25)")`).replace(`!${item}.${unknown}()`, `(!${item}.${unknown}()||${enabled})`);
        replacement = replacement.replace(new RegExp(`(\\.${field2}\\.${unknown}\\(\\))\\?`), `$1&&!${enabled}?`);
      } else {
        replacement = replacement.replace(new RegExp(`(${item}\\.${unknown}\\(\\))\\)\\{`), `$1&&!${enabled}){`);
      }
      if (replacement !== block) {
        patched = patched.slice(0, start.index) + replacement + patched.slice(end);
        changed = true;
      }
    }
    if (unknownMethod && filter) {
      const preview = new RegExp(`function ([\\w$]+)\\((t),(n)\\)\\{var ([\\w$]+)=[\\w$]+,([\\w$]+)=[\\w$]+\\.xut\\(\\4\\);[^{}]{0,200}function\\(t\\)\\{var n;if\\(t\\.[\\w$]+\\.${skin}\\.${unknownMethod}\\(\\)`, "g");
      const match = preview.exec(patched);
      if (match) {
        const tail = `n.cap(${match[5]}.c9l())}`;
        const end = patched.indexOf(tail, match.index);
        if (end >= 0 && end - match.index < 1500) {
          const block = patched.slice(match.index, end + tail.length);
          const unknown = new RegExp(`t\\.([\\w$]+)\\.${skin}\\.${unknownMethod}\\(\\)`);
          const state = unknown.exec(block)?.[1];
          if (state) {
            const replacement = block.replace(unknown, `$&&&!${enabled}`).replace(tail, `t.${state}.${skin}.${unknownMethod}()&&${enabled}&&${filter}(${match[5]}.tuv(),"grayscale(1)"),${tail}`);
            patched = patched.slice(0, match.index) + replacement + patched.slice(end + tail.length);
          }
        }
      }
    }
    if (!changed) return code;
    return `function __kaspShowUnavailableDetails(){try{return localStorage.getItem('k_augments')==='true'}catch(e){return false}}
${patched}`;
  }
  var init_garageDetails = __esm({
    "src/core/garageDetails.ts"() {
    }
  });

  // src/core/battlePresence.ts
  function parseBattleClock(text) {
    const match = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(text);
    if (!match || Number(match[3]) > 59 || match[1] && Number(match[2]) > 59) return void 0;
    return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  function field(object, label) {
    const method = object.toString;
    if (typeof method !== "function") return void 0;
    let schema = schemas.get(method);
    if (!schema) {
      schema = /* @__PURE__ */ new Map();
      const code = Function.prototype.toString.call(method);
      for (const match of code.matchAll(/\b([A-Za-z]+)=.{0,35}?this\.([\w$]+)/g)) schema.set(match[1], match[2]);
      schemas.set(method, schema);
    }
    const key = schema.get(label);
    return key ? Object.getOwnPropertyDescriptor(object, key)?.value : void 0;
  }
  function type(object, name) {
    return typeof object.toString === "function" && Function.prototype.toString.call(object.toString).includes(`"${name}(`);
  }
  function children(object) {
    return Object.values(Object.getOwnPropertyDescriptors(object)).slice(0, 100).filter((descriptor) => "value" in descriptor && descriptor.value && typeof descriptor.value === "object").map((descriptor) => descriptor.value);
  }
  function readBattlePresence(store, capacities) {
    const seen = /* @__PURE__ */ new Set(), objects = [];
    const pending = [[store, 0]];
    let stats, users;
    while (pending.length && seen.size < 1e3) {
      const [object, depth] = pending.shift();
      if (seen.has(object)) continue;
      seen.add(object);
      objects.push(object);
      if (type(object, "BattleStatistics")) stats = object;
      if (type(object, "BattleUsers")) users = object;
      if (depth < 5 && !Array.isArray(object) && typeof object.z2 !== "function") {
        children(object).forEach((child) => pending.push([child, depth + 1]));
      }
    }
    if (!stats || field(stats, "battleLoaded") !== true) return null;
    const map = field(stats, "mapNameWithoutMode") || field(stats, "mapName");
    if (typeof map !== "string" || !map.trim()) return null;
    const result = { map: map.trim() };
    const mode = String(field(stats, "mode") || "").toUpperCase();
    const modes = /^(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/;
    const suffix = /\s+(TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i.exec(String(field(stats, "mapName") || ""))?.[1];
    if (modes.test(mode)) result.mode = mode;
    else if (suffix) result.mode = suffix.toUpperCase();
    const remaining = field(stats, "remainingTimeInSec");
    if (typeof remaining === "number" && Number.isFinite(remaining) && remaining >= 0) result.remaining = remaining;
    const battleId = field(stats, "battleId");
    const capacity = battleId == null ? void 0 : capacities?.get(String(battleId));
    if (capacity !== void 0) result.maxPlayers = capacity;
    for (const object of objects) {
      if (result.maxPlayers !== void 0) break;
      const lookup = object.z2;
      if (typeof lookup !== "function" || !battleId) continue;
      try {
        const params = lookup.call(object, battleId);
        if (!params || typeof params !== "object" || !type(params, "BattleParams")) continue;
        const limit = field(params, "maxPeopleCount");
        const mode2 = field(params, "battleMode");
        if (typeof limit === "number" && Number.isInteger(limit) && limit > 0 && typeof mode2?.k3_1 === "number") {
          result.maxPlayers = limit * (mode2.k3_1 <= 1 ? 1 : 2);
        }
        break;
      } catch {
      }
    }
    if (users) {
      const online = field(users, "onlineUsers");
      const teams = field(users, "teams");
      if (typeof online?.t === "function" && typeof teams?.z2 === "function") {
        let count = 0, budget = 1e3;
        const iterator = online.t();
        while (iterator.u() && budget-- > 0) {
          const team = teams.z2(iterator.v());
          if (team != null && !/SPECTATOR/i.test(String(team))) count++;
        }
        if (budget > 0 && (result.maxPlayers === void 0 || count <= result.maxPlayers)) result.players = count;
      }
    }
    return result;
  }
  function patchBattleCapacity(code) {
    const capacity = /this\.([\w$]+)=new [\w$]+\(["']maxPeople["']\)/.exec(code)?.[1];
    const id = /this\.([\w$]+)=new [\w$]+\(["']battleId["']\)/.exec(code)?.[1];
    if (!capacity || !id) return code;
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const assignments = new RegExp(`([\\w$]+\\([\\w$]+\\))\\.${escape(id)}\\.[\\w$]+\\(([\\w$]+\\(\\)\\.[\\w$]+\\(\\)\\.[\\w$]+\\(\\))\\),\\1\\.${escape(capacity)}\\.[\\w$]+\\(([\\w$]+\\.[\\w$]+)\\)`, "g");
    return code.replace(assignments, (whole, _settings, battleId, limit) => `${whole},(function(){try{window.__kaspPresenceCapacity(${battleId},${limit})}catch(__kaspIgnored){}})()`);
  }
  function patchBattlePresence(code, report) {
    let matches = 0;
    const getter = /function\(\)\{var ([\w$]+)=([\w$]+);return (this\.[\w$]+\.[\w$]+\(this,[\w$]+\(["']store["'],1,\1,function\(([\w$]+)\)\{return \4\.[\w$]+\(\)\},null\)\))\}/g;
    const patched = code.replace(getter, (_whole, variable, scope, expression) => {
      matches++;
      return `function(){var ${variable}=${scope};var __kaspStore=${expression};try{window.__kaspPresenceStore(__kaspStore)}catch(__kaspIgnored){}return __kaspStore}`;
    });
    report?.(matches);
    return patched;
  }
  function installBattlePresence(page) {
    if (!navigator.userAgent.includes("Electron")) return;
    let store = null;
    const capacities = /* @__PURE__ */ new Map();
    const bridge = page;
    bridge.__kaspPresenceStore = (value) => {
      if (value && typeof value === "object") store = value;
      return value;
    };
    bridge.__kaspPresenceCapacity = (id, limit) => {
      if (id == null || typeof limit !== "number" || !Number.isInteger(limit) || limit <= 0 || limit > 1e3) return;
      capacities.set(String(id), limit);
      if (capacities.size > 32) capacities.delete(capacities.keys().next().value);
    };
    let error = null;
    let latest = null;
    let lastMap, lastRemaining, deadline;
    const poll = () => {
      try {
        latest = store ? readBattlePresence(store, capacities) : null;
        error = null;
      } catch (cause) {
        latest = null;
        error = String(cause);
      }
      if (latest) {
        const timer = document.querySelector(gameDOM.presence.timer);
        if (timer) latest.remaining = parseBattleClock(timer.textContent || "");
        else {
          if (latest.map !== lastMap || latest.remaining !== lastRemaining) {
            deadline = latest.remaining === void 0 ? void 0 : Date.now() + latest.remaining * 1e3;
          }
          lastRemaining = latest.remaining;
          latest.remaining = deadline === void 0 ? void 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1e3));
        }
        lastMap = latest.map;
      } else {
        lastMap = void 0;
        lastRemaining = void 0;
        deadline = void 0;
      }
      page.postMessage({ type: BATTLE_PRESENCE_MESSAGE, battle: latest, at: Date.now() }, page.location.origin);
    };
    bridge.__kaspPresenceBattleDebug = () => latest;
    bridge.__kaspPresenceStoreDebug = () => ({ captured: store !== null, error });
    page.setInterval(poll, 1e3);
  }
  var BATTLE_PRESENCE_MESSAGE, schemas;
  var init_battlePresence = __esm({
    "src/core/battlePresence.ts"() {
      init_gameDOM();
      BATTLE_PRESENCE_MESSAGE = "kasp:battle-presence";
      schemas = /* @__PURE__ */ new WeakMap();
    }
  });

  // src/kasp_injector.ts
  var require_kasp_injector = __commonJS({
    "src/kasp_injector.ts"() {
      init_bonusPickup();
      init_gameAugments();
      init_garageDetails();
      init_battlePresence();
      (function() {
        "use strict";
        installGameAugments(window);
        installBattlePresence(window);
        const debugKey = "kasp_bonus_debug";
        let debugEnabled = false;
        try {
          debugEnabled = localStorage.getItem(debugKey) === "true";
        } catch {
        }
        const diagnostics = createBonusDiagnostics((record) => console.log("[KASP Bonus]", JSON.stringify(record)), debugEnabled);
        let hookStatus = null;
        window.__kaspBonusDebug = {
          enable(value = true) {
            debugEnabled = value;
            diagnostics.enable(value);
            try {
              localStorage.setItem(debugKey, String(value));
            } catch {
            }
            if (value && hookStatus) diagnostics.record(hookStatus);
          },
          clear: diagnostics.clear,
          export: diagnostics.export
        };
        const bonusBridge = createBonusPickupBridge((model, position) => {
          window.postMessage({ type: BONUS_PICKUP_MESSAGE, detail: { model, position: position || null } }, "*");
        }, diagnostics.record, () => debugEnabled);
        window.__kaspBonusPickup = bonusBridge.pickup;
        window.__kaspBonusPrepare = bonusBridge.prepare;
        window.__kaspBonusRegister = bonusBridge.register;
        window.__kaspBonusContext = bonusBridge.context;
        const KNOWN_MODES = /* @__PURE__ */ new Set([
          "DM",
          "TDM",
          "CTF",
          "CP",
          "SGE",
          "RGB",
          "JGR",
          "TJR",
          "ASL",
          "AR"
        ]);
        window.__kaspSendAction = function(className, obj) {
          try {
            let safeWalk = function(o, depth) {
              if (depth > 2 || !o || typeof o !== "object" || seen.has(o)) return;
              seen.add(o);
              let keys = [];
              try {
                keys = Object.keys(o);
              } catch (e) {
                return;
              }
              for (let i = 0; i < keys.length; i++) {
                let k = keys[i];
                let v;
                try {
                  v = o[k];
                } catch (e) {
                  continue;
                }
                if (v != null) {
                  if (typeof v === "string" || typeof v === "number") {
                    let strVal = String(v).trim();
                    if (strVal && strVal.length >= 2 && strVal.length < 30) {
                      res.push(strVal);
                    }
                  } else if (typeof v === "object" && depth < 2) {
                    safeWalk(v, depth + 1);
                  }
                }
              }
            };
            let res = [className];
            let seen = /* @__PURE__ */ new Set();
            safeWalk(obj, 0);
            window.postMessage({ type: "kasp:useraction", detail: res }, "*");
          } catch (e) {
          }
        };
        window.__kaspBattleStats = function(obj) {
          try {
            if (!obj || typeof obj !== "object") return;
            let keys;
            try {
              keys = Object.keys(obj);
            } catch (e) {
              return;
            }
            let mode = null;
            let isPro = null;
            for (let i = 0; i < keys.length; i++) {
              let v;
              try {
                v = obj[keys[i]];
              } catch (e) {
                continue;
              }
              if (typeof v !== "string") continue;
              const trimmed = v.trim();
              if (!trimmed) continue;
              const upper = trimmed.toUpperCase();
              if (!mode) {
                if (KNOWN_MODES.has(upper)) {
                  mode = upper;
                } else {
                  const m = /\s+([A-Z]{2,3})$/.exec(upper);
                  if (m && KNOWN_MODES.has(m[1])) mode = m[1];
                }
              }
              if (isPro === null) {
                if (/(^|[\s\-])PRO([\s\-]|$)/.test(trimmed) || /(^|[\s\-])ПРО([\s\-]|$)/.test(trimmed)) {
                  isPro = true;
                }
              }
            }
            if (isPro === null) isPro = false;
            if (mode) {
              window.postMessage(
                { type: "kasp:battle-mode", detail: mode },
                "*"
              );
            }
            window.postMessage(
              { type: "kasp:battle-kind", detail: isPro ? "PRO" : "MM" },
              "*"
            );
          } catch (e) {
          }
        };
        let bundleIntercepted = false;
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
              if (!bundleIntercepted && node instanceof HTMLScriptElement && node.src.includes("/static/js/main.")) {
                bundleIntercepted = true;
                const originalScript = document.createElement("script");
                for (const attribute of Array.from(node.attributes)) {
                  originalScript.setAttribute(attribute.name, attribute.value);
                }
                originalScript.async = node.async;
                originalScript.nonce = node.nonce;
                node.type = "javascript/blocked";
                node.remove();
                observer.disconnect();
                fetch(node.src).then((res) => {
                  if (!res.ok) throw new Error(`Game bundle request failed: HTTP ${res.status}`);
                  return res.text();
                }).then((code) => {
                  if (navigator.userAgent.includes("Electron")) {
                    code = patchBattleCapacity(code);
                    code = patchBattlePresence(code, (matches) => {
                      if (!matches) console.warn("[KI Presence] No game store getters found");
                    });
                  }
                  code = patchGameAugments(code);
                  code = patchUnavailableGarageDetails(code);
                  code = patchBonusPickups(code, (status) => {
                    hookStatus = status;
                    diagnostics.record(status);
                  });
                  const match = /return"TankUserActionLog\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                  if (match) {
                    const propName = match[1];
                    const p = new RegExp(`(function [\\w$]+\\([^)]{1,150}\\)\\{[^{}]{0,800}?this\\.${propName}=[\\w$]+(?:,this\\.[\\w$]+=[\\w$]+){0,30})\\}`);
                    if (p.test(code)) {
                      code = code.replace(p, `$1, window.__kaspSendAction("TankUserActionLog", this)}`);
                    }
                  }
                  const bsMatch = /return"BattleStatistics\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                  if (bsMatch) {
                    const firstField = bsMatch[1];
                    const ctor = new RegExp(
                      "(function [\\w$]+\\([^)]{5,400}\\)\\{[^{}]{0,1200}?this\\." + firstField + "=[\\w$]+(?:,this\\.[\\w$]+=[\\w$]+){10,60})\\}"
                    );
                    if (ctor.test(code)) {
                      code = code.replace(ctor, "$1, window.__kaspBattleStats(this)}");
                    }
                  }
                  const script = document.createElement("script");
                  script.type = originalScript.type;
                  script.nonce = originalScript.nonce;
                  script.textContent = code;
                  (document.head || document.documentElement).appendChild(script);
                }).catch((error) => {
                  console.error("[Kaspersky Inventions] Bundle injection failed; loading the original game script:", error);
                  originalScript.addEventListener("error", () => {
                    console.error("[Kaspersky Inventions] The original game script also failed to load:", originalScript.src);
                  }, { once: true });
                  try {
                    (document.head || document.documentElement).appendChild(originalScript);
                  } catch (restoreError) {
                    console.error("[Kaspersky Inventions] Could not restore the original game script:", restoreError);
                  }
                });
              }
            }
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      })();
    }
  });
  require_kasp_injector();
})();
