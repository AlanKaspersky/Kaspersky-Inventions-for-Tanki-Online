# Kaspersky's Inventions - Technical Documentation

## Complete Implementation Reference

**Extension version:** 2.8.1 (`manifest.json`)

**Documentation updated:** October 5, 2026

**Interface languages:** English and Russian

**Runtime:** Chromium Manifest V3, TypeScript sources bundled as JavaScript IIFEs

This document describes the implementation currently present in the repository: execution order, module responsibilities, function contracts, state transitions, storage, rendering, and failure handling. It complements [README.md](README.md), which covers installation and user-facing operation. Names in backticks refer to actual files, symbols, selectors, events, or storage keys.

The source implementation is authoritative. `dist/` contains generated browser entry points and can differ from an unbuilt source checkout. Timings below describe scheduling choices in the code, not guaranteed execution times or server response times.

## Table of Contents

1. [Repository and Execution Model](#repository-and-execution-model)
2. [Startup and Update Scheduling](#startup-and-update-scheduling)
3. [Game Bundle Injector](#game-bundle-injector)
4. [Shared Core Services](#shared-core-services)
5. [Settings Integration](#settings-integration)
6. [Feature Module Reference](#feature-module-reference)
   - [Enhanced Play](#enhanced-play)
   - [Augment Specifications](#augment-specifications)
   - [Paint Search](#paint-search)
   - [Friend Categories](#friend-categories)
   - [Trophy Favorites](#trophy-favorites)
   - [Auto Upgrade](#auto-upgrade)
   - [Nickname and XP Privacy](#nickname-and-xp-privacy)
   - [Currency Privacy](#currency-privacy)
   - [Garage Skins](#garage-skins)
   - [Weapon Reload Indicator](#weapon-reload-indicator)
   - [Equipment Change Indicators](#equipment-change-indicators)
   - [Resistance Presentation](#resistance-presentation)
   - [Garage Button Presentation](#garage-button-presentation)
   - [Self Equipment Tracking](#self-equipment-tracking)
   - [Version Welcome Window](#version-welcome-window)
7. [Battle History Implementation](#battle-history-implementation)
   - [Facade and Account Context](#facade-and-account-context)
   - [Record Types](#record-types)
   - [Database Repository](#database-repository)
   - [Result Capture](#result-capture)
   - [Import Validation](#import-validation)
   - [Safe Markup and Presentation](#safe-markup-and-presentation)
   - [Views and Pagination](#views-and-pagination)
   - [Navigation and Native Window Integration](#navigation-and-native-window-integration)
   - [Management Actions](#management-actions)
   - [History Localization](#history-localization)
8. [Templates, Styles, and Assets](#templates-styles-and-assets)
9. [Reference Database Contracts](#reference-database-contracts)
10. [Persistent State and Ownership](#persistent-state-and-ownership)
11. [Events and Inter-module Dependencies](#events-and-inter-module-dependencies)
12. [Lifecycle, Concurrency, and Failure Boundaries](#lifecycle-concurrency-and-failure-boundaries)
13. [Build and Packaging Implementation](#build-and-packaging-implementation)
14. [Regression Test Reference](#regression-test-reference)
15. [Maintenance Scenarios](#maintenance-scenarios)
16. [Implementation Limits and Project Terms](#implementation-limits-and-project-terms)

## Repository and Execution Model

### Source Layout

| Location | Responsibility |
| --- | --- |
| `src/kasp_main.ts` | Main content-script initialization |
| `src/kasp_injector.ts` | Page-world game script interception and instrumentation |
| `src/boot.ts` | Shared observation, screen detection, and module scheduling |
| `src/core/` | State, settings, identity, resource loading, shared dialogs, markup, and Electron adaptation |
| `src/core/gameDOM.ts` | Central native-game selectors, class names, IDs, and class fragments used by feature modules |
| `src/modules/index.ts` | Imports and exposes the feature-module registry |
| `src/modules/*.ts` | Feature entry points and private module state |
| `src/modules/battleHistory/` | History repository, capture, validation, presentation, views, navigation, actions, types, and dictionaries |
| `src/types/window.d.ts` | Type declarations for the injector hooks and optional battle metadata |
| `templates/` | Packaged HTML skeletons |
| `styles/` | Static CSS loaded through the manifest and stylesheet imports |
| `database/` | Packaged reference snapshots |
| `assets/` | Extension-owned images, masks, and icons |
| `_locales/` | Browser-extension description translations |
| `tools/` | Release packager and regression tests |
| `dist/` | Generated bundles consumed by the browser |
| `release/` | Generated versioned distribution folders and ZIP archives |

Most modules are immediately invoked closures. Importing such a file creates private state once per content-script execution and returns a callable update function or a small API object. Calling the exported function repeatedly does not recreate the closure.

Import-time activity is significant: reference loading, message listeners, and some storage reads can occur before `startBoot()` starts observing the page. A feature's disabled setting is therefore not equivalent to removing its file from the bundle or eliminating every import-time side effect.

### Browser Worlds

The manifest loads the injector in `MAIN` world at `document_start`. Its hooks are available to the transformed game bundle in the page's JavaScript environment.

The main bundle uses the browser's default isolated content-script world and also runs at document start. Both worlds interact with the page DOM, but their JavaScript globals are separate. `window.postMessage` carries recognized data from page instrumentation to content-script listeners.

Content-script match patterns target Tanki Online pages. The injector also lists the apex-domain pattern explicitly. The main script and web-accessible resources use the wildcard subdomain pattern. The main entry point additionally checks `window === window.top` before starting its runtime.

No background service worker, options-page controller, cloud synchronization service, or `chrome.storage` persistence layer is declared in the current implementation. The manifest exposes packaged assets, HTML templates, and JSON databases to matching pages.

### Native Game DOM Registry

Feature modules import `gameDOM` from `src/core/gameDOM.ts`. The registry groups native bindings by account, screen, dialog, navigation, garage, augment, skin, paint, friend, play, trophy, statistics, and result responsibilities.

Selector entries retain their complete context and fallback order. `classes` contains names for class checks and native button construction; `ids` contains result-row identifiers; `fragments` contains partial class-name matches. A class name is not interchangeable with a selector containing a leading dot.

For example:

```ts
import { gameDOM } from '../core/gameDOM';

const dialog = document.querySelector(gameDOM.dialogs.container);
const selfRow = document.getElementById(gameDOM.ids.selfRow);
```

This registry applies to native bindings in feature modules. Extension-owned classes, template IDs, stylesheets, and generated CSS strings retain their existing definitions. Boot and other core services also retain their own bindings. A future native change affecting CSS or a core service must therefore be reviewed there separately.

The registry is a synchronous, side-effect-free TypeScript constant. It does not load configuration over the network, add an observer, delay startup, or change screen recognition and event handling. Bundling includes it through normal static imports.

When updating a binding, preserve spelling/casing, parent context, exact versus partial matching, and selector-list order. Do not broaden a purchase-confirmation or self-player selector merely to make a missing match succeed.

### Function Contract Conventions

An update function usually reads the current DOM, checks its setting or screen, and adds or adjusts supported UI. It does not receive an immutable game-state object from a central store. Screen detection, label parsing, artwork matching, and native CSS classes act as the integration boundary.

The module registry is a dispatch table, not a plugin loader. All listed modules are statically imported. Settings determine whether selected feature bodies proceed; automatic modules have no individual settings switches.

## Startup and Update Scheduling

Sources: [main entry point](src/kasp_main.ts), [boot scheduler](src/boot.ts), [shared state](src/core/state.ts), and [module registry](src/modules/index.ts).

### Main Entry Sequence

For the top-level window, `kasp_main.ts` performs the following sequence:

1. Calls `setupElectronZKey()` to install the optional mouse-navigation adapter.
2. Resolves `assets/background.png` through `chrome.runtime.getURL()` and sets the root `--kasp-loader-bg` property.
3. Resolves the initial language through `utils.getLang()`.
4. Calls `setupNicknamePrivacy()` synchronously, allowing supported privacy CSS to be active before ordinary feature updates.
5. Calls `startBoot()`.

This ordering matters for privacy: masking does not wait for the 150 ms heavy-update path. Module imports can already have initialized their own closures or started resource requests before this entry-point body runs.

### Shared State

| Field | Initial value | Meaning |
| --- | --- | --- |
| `state.lang` | `EN` | Current supported interface language |
| `state.currentScreen` | `loading` | Last recognized screen classification |
| `state.settingsOpen` | `false` | Presence of the native settings options block |
| `state.friendsMenuOpen` | `false` | Presence of friends or invitation UI |

State is a mutable shared object. It is not persisted and does not notify subscribers automatically; consumers read it during scheduled work.

### Boot Installation

The nested `boot()` function observes `document.documentElement` for `childList` changes throughout its subtree. If the root is unavailable, startup waits for `DOMContentLoaded`.

Boot also installs:

- A 250 ms interval invoking `customGarageSkins()`.
- An observer for the root `lang` attribute.
- Language rechecks on `DOMContentLoaded`, after 500 ms, and after 2,000 ms when no initial HTML language is present.
- A `storage` listener for the game's `language_store_key`.

There is no universal shutdown controller for these page-lifetime observers and intervals. A page reload creates a new runtime.

### Screen Detection Priority

`performMasterCheck()` checks these DOM markers in order:

| Priority | Marker | Assigned screen |
| --- | --- | --- |
| 1 | `.ApplicationLoaderComponentStyle-container` | `loading` |
| 2 | `.BattleHudComponentStyle-container` | `battle` |
| 3 | Garage position/item or loot-box container | `garage` |
| 4 | `.MainScreenComponentStyle-blockMainMenu` | `lobby` |
| 5 | `.BattleResultHeaderComponentStyle-resultText` | `match_results` |

When no marker matches, the previous screen remains selected. The order resolves overlapping DOM during transitions; it does not attempt to classify every possible game page.

Friends/invitations and settings are detected separately. Settings opening calls `coreSettings.inject()`; detected closing calls `coreSettings.onClose()`.

On a transition to loading or battle, the scheduler hides the augment tooltip and history overlay, closes the quick-upgrade setup dialog through its exposed close method, and closes or removes the clear-history confirmation. This transition handling is separate from history's own native-page cleanup.

### Dispatch Paths

| Path | Calls |
| --- | --- |
| Every heavy pass | `changeCounter.onTick`, welcome, nickname privacy, currency privacy, reload tracker, garage skins |
| Heavy pass in lobby/loading | Enhanced Play |
| Heavy pass while friends/invitations are open | Friend categories |
| Heavy pass in lobby/garage/results | Trophy favorites |
| Heavy pass in garage | Auto Upgrade, augment specifications, paint search |
| Every master check in garage | Garage button presentation |
| Every master check in lobby/results | Battle History and kill-board header synchronization |
| Mutation callback with native battle statistics present | Change indicators, resistance presentation, equipment tracking |
| Mutation callback with supported garage/loot-box markers | Augment specifications and Auto Upgrade |

These paths can call the same module more than once around a single UI transition. Feature code must consequently tolerate repeated calls.

`syncKillBoardDoubleHeader()` clones the existing table header when there is exactly one header row and adds `kasp-cloned-header`. It does not keep adding rows after the second header exists.

### Coalescing and Throttling

The master observer schedules at most one pending animation-frame master check through `isMasterUpdateScheduled`. Battle-statistics and garage callbacks listed above can execute directly before that frame.

`scheduleHeavyModules()` compares `performance.now()` against `lastFullRefresh`. If at least 150 ms have elapsed, it runs immediately; otherwise it schedules the remaining delay once. Screen or friends-menu changes reset the throttle state and run a heavy pass immediately.

The throttle flag is not a cancellation token for an already queued timeout. Clearing `refreshScheduled` does not call `clearTimeout` on the pending callback; additional work can still occur after a transition. This is another reason updates should be repeat-safe.

### Language Refresh

`applyLanguageChange()` resolves a new language and updates `state.lang` only when it differs. It resets heavy-refresh state and removes the custom settings tab, content, and reload tooltip before reinjecting settings if that window is open.

Other modules generally read `state.lang` when generating or updating their UI. Existing labels do not all have a dedicated language-change subscription, so not every visible component necessarily changes in the same frame.

### Error Boundary

The heavy pass has a `try/catch` around its conditional Play/Friends/Trophies/Garage group. The automatic calls made before that block are outside it. Furthermore, the scheduler does not await async modules, so a synchronous catch is not a universal handler for rejected promises. Individual async resource and history functions provide their own handling where implemented.

## Game Bundle Injector

Source: [src/kasp_injector.ts](src/kasp_injector.ts).

The injector is an independent IIFE. It creates two page-world hooks and then observes added script elements for a URL containing `/static/js/main.`.

### User Action Hook

`window.__kaspSendAction(className, obj)` builds an array beginning with the supplied class name. Its nested `safeWalk()` inspects enumerable object properties to a maximum depth of two, tracks visited objects to avoid cycles, and tolerates failures in property enumeration or getters.

String and number values are converted to trimmed strings. Values are included only when their length is at least two and less than thirty characters. The resulting array is sent as:

```ts
{ type: 'kasp:useraction', detail: ['TankUserActionLog', /* observed values */] }
```

This is a bounded heuristic extraction from a game object, not a typed server action schema. Consumers must interpret the resulting values.

### Battle Statistics Hook

`window.__kaspBattleStats(obj)` inspects top-level string properties. It recognizes an exact mode code or a known trailing mode suffix from `DM`, `TDM`, `CTF`, `CP`, `SGE`, `RGB`, `JGR`, `TJR`, `ASL`, and `AR`.

PRO detection searches for separated `PRO` or `ПРО` text. If no PRO indication is recognized, kind defaults to `MM`. The hook posts `kasp:battle-mode` when a mode is found and always posts `kasp:battle-kind` for a recognized object-processing pass.

The current Change Counter listener copies battle kind into its content-script world. There is no corresponding `kasp:battle-mode` consumer in the current TypeScript sources; capture parses mode from the result header instead.

### Interception and Transformation

1. `bundleIntercepted` prevents processing multiple matching scripts, including scripts in the same mutation batch.
2. A fresh fallback script receives every original attribute, plus the original `async` property and nonce.
3. The observed element is assigned a blocked type and removed; the injector observer disconnects.
4. The original URL is fetched. Non-success HTTP status throws before reading its body.
5. Regular expressions locate recognizable `TankUserActionLog` and `BattleStatistics` constructor patterns and append calls to the corresponding hooks.
6. An inline script receives the original type and nonce and the transformed text, then is appended to the head or root.

Pattern misses leave the respective instrumentation absent; they do not by themselves throw. The regular expressions depend on the game bundle's current generated structure.

### Recovery and Limits

Fetch rejection, HTTP failure, body-reading failure, or synchronous transformation/insertion failure enters the catch handler. It logs the original error and appends the saved native script once. An error event on that fallback script and synchronous insertion failures are logged separately.

Fallback loading does not reinstall interception or guarantee instrumentation. A successfully appended inline script can still encounter a later runtime error or policy restriction that is outside the promise chain's synchronous catch. Mutation timing also remains a browser integration constraint; the injector is not a general script execution supervisor.

## Shared Core Services

### Settings Cache

Source: [src/core/settings.ts](src/core/settings.ts).

`SETTINGS_KEYS` defines eight known keys. At import time, each is read with default `false` and cached in `settingsCache`.

| Function | Contract |
| --- | --- |
| `readSetting(id, def)` | Return `def` for an absent key; otherwise return whether its stored text is exactly `true`. |
| `getSettingRaw(id, def)` | Return a cached value when available; otherwise read, parse, and cache it. |
| `setSettingRaw(id, value)` | Write `true`/`false` to local storage and update the same-world cache. |
| `invalidateSetting(id?)` | Remove one cache entry or clear the entire map. |

The storage listener invalidates only recognized, non-null keys. A `storage` event whose key is `null`, such as a storage-wide clear, does not invalidate all entries through this listener. Same-document changes should use the provided setter; direct writes do not automatically update its cached value.

The settings helpers do not generally catch storage-access errors. Language resolution and several record/cache modules have their own catches, but these do not make all storage access failure-safe.

### Utility Functions

Source: [src/core/utils.ts](src/core/utils.ts).

`utils.getLang()` resolves RU/EN in this order: a recognized prefix in `language_store_key`, a matching HTML language attribute, `ru.` in the hostname, then EN. Only the local-storage lookup is enclosed in its small catch.

`utils.getSetting` and `utils.setSetting` expose the raw cache helpers. `utils.injectStyle(css, id)` avoids adding a second element with the same ID, sets CSS through `textContent`, and appends to the head immediately or after `DOMContentLoaded`. It does not replace an existing style element's contents.

### Shared Reference Loader

Source: [src/core/dataLoader.ts](src/core/dataLoader.ts).

An import-time `readyPromise` concurrently fetches paints, augments, maps, and skins from packaged URLs. Every response is checked before parsing. The loader resolves augment `$shared` references against `_shared` and creates lowercase Russian/English lookup maps for map entries.

`state.ready` becomes true only after the complete sequence succeeds. Errors are recorded in private `state.error` and logged. The catch consumes the rejection, so awaiting `readyPromise` is not equivalent to asserting success: callers should check `isReady()` or the relevant lookup result.

| Method | Result |
| --- | --- |
| `isReady()` | Whether the whole shared load completed successfully |
| `getPaint(url)` | Paint entry by exact artwork URL, or `undefined` |
| `getDevice(url)` | Resolved augment entry by exact artwork URL, or `undefined` |
| `hasDevice(url)` | Presence in the resolved augment dictionary |
| `translateMap(rawName, targetLang)` | Localized name, retaining the original when unmatched |
| `getMapInfo(rawName)` | Matched RU/EN map entry, or `null` |
| `getSkinsData()` | Parsed skins data, if available |

The shared loader does not automatically retry a failed full load. Individual feature modules also load skins and trophies independently; they do not all share this promise or readiness boundary.

### Account Identity

Source: [src/core/accountIdentity.ts](src/core/accountIdentity.ts).

`parseAccountIdentity(text)` trims the display name, extracts an initial bracketed clan tag, removes that prefix from the nickname, and returns `{ nickname, clanTag, displayName }`. Empty nickname text returns `null`.

`getAccountIdentity()` checks the native header first, then client information parameters matching `UID:`, then the current player's result-row name. It reads current original text each time rather than keeping a global account cache.

Identity is deliberately separate from presentation. The nickname privacy feature retains the underlying text, so history ownership, friend storage, and self-row detection do not receive the localized masking label.

### Shared Modal Controller

Source: [src/core/modal.ts](src/core/modal.ts), template: [templates/modal.html](templates/modal.html).

`createKaspModal({ id, title, closeLabel })` is asynchronous and returns a `KaspModal` object or `null` when that ID is already present or pending. `pendingModalIds` closes the race between simultaneous calls before a template has loaded.

The controller checks the HTTP response, requires a root element and all dialog/title/close/body/action markers, assigns a unique title ID for `aria-labelledby`, and inserts the overlay into the body. Title and close-label values use text/attribute assignment rather than HTML interpolation.

Returned members expose the overlay, dialog, body, action container, close button, `close()`, and `onClose(listener)`. Callers add their own content and confirmation actions.

The controller supports Escape, Z outside input/textarea/select controls, the mouse back button, the close button, and clicking the backdrop. Mouse forward events are blocked without closing. Remaining back/forward mouse-up, click, and auxiliary-click events are suppressed for 700 ms after the mouse action.

`close()` is idempotent. It removes global listeners immediately, changes the opening/closing classes, invokes close subscribers, and removes the overlay on the dialog's animation end or after a 260 ms fallback. Closing twice does not rerun subscriber actions.

Pending IDs are released in `finally`, including template failure. Resource errors are propagated to the caller. The controller supplies ARIA dialog semantics but does not implement a complete focus-trapping or focus-restoration system.

### Electron Mouse Adapter

Source: [src/core/electron.ts](src/core/electron.ts).

`setupElectronZKey()` detects `Electron` in the user agent or an available `window.process.type`. It installs capture-phase mouse listeners only in that context.

Mouse button 3 generates synthetic Z keydown and keyup events unless focus is in an editable control. Buttons 3 and 4 have their default browser behavior suppressed on supported mouse phases. The adapter simulates input; it does not directly operate a native Electron navigation API.

### Window Declarations

[src/types/window.d.ts](src/types/window.d.ts) declares `__kaspSendAction`, `__kaspBattleStats`, and optional `__kaspCurrentMode`, `__kaspBattleKind`, and `__kaspInjectorVersion`. A declaration is a type contract, not a runtime assignment. Not every declared optional global is populated by the current implementation.

## Settings Integration

Source: [src/core/coreSettings.ts](src/core/coreSettings.ts).

`coreSettings.inject()` requires the native options block and its menu. An existing `kaspersky-tab` prevents duplicate injection. The function creates a reload tooltip, the KASPERSKY tab, and localized rows for eight switches.

| Key | Feature | Default |
| --- | --- | --- |
| `k_ext_btn` | Enhanced Play | `false` |
| `k_augments` | Augment specifications | `false` |
| `k_auto_upgrade` | Quick upgrades | `false` |
| `k_friends` | Friend categories | `false` |
| `k_paints` | Paint search | `false` |
| `k_hideCurrency` | Currency masking | `false` |
| `k_hideNicknameXP` | Nickname/XP masking | `false` |
| `k_history` | Battle History | `false` |
| `k_overdrive_timer` | Overdrive box timer | `false` |

Injection records the current values in `initialSettingsState`. Clicking an accepted label or switch changes its active class, persists the value, and computes `needsReload` by comparing all final values against that snapshot. Reverting all changes cancels the reload requirement.

Nickname privacy receives an immediate special action: enabling calls `setupNicknamePrivacy()` and disabling removes the root privacy class. The observer can remain installed but its callback exits when the setting is disabled.

Selecting KASPERSKY hides the native content and slider highlight; selecting another eligible native tab restores the native content and hides the extension panel. Tooltip mouse movement positions the reload message near the cursor.

`coreSettings.onClose()` hides the tooltip and calls `window.location.reload()` when `needsReload` is true. The code does not implement a per-module teardown/reconfiguration transaction in place; the reload is the shared application mechanism.

## Feature Module Reference

The following sections describe each exported feature and its private helpers. Battle History has its own expanded reference because it contains multiple cooperating controllers.

### Enhanced Play

Source: [src/modules/customPlayButton.ts](src/modules/customPlayButton.ts).

**Activation:** `k_ext_btn`; normally dispatched in lobby/loading. The feature keeps the native Play entry point and adds a custom presentation plus direct mode controls.

#### Selection Scenario

`startAutoQueue(modeData)` checks that matchmaking is not already active, saves the target, changes `autoQueueState` to 1, adds `kasp-autoqueue-active` to the body, and activates native Play.

The 50 ms processing loop runs `processAutoQueue()` while a selection is active:

| State | Action | Next state |
| --- | --- | --- |
| `0` | No automated selection | Remain idle |
| `1`, direct target | Find and click the target native card | `0` on success |
| `1`, standard mode | Find and click the native Modes card | `2` on success |
| `2` | Find and click the requested standard-mode card | `0` on success |

Quick Battle, PRO, and festive mode are direct targets. TDM, CP, CTF, SGE, JGR, RGB, and ASL go through Modes. A 1,500 ms fail-safe resets selection and removes the body class if the flow takes too long. This clears the automation state; it does not cancel a server-side search already started by the game.

#### Function Reference

| Function | Responsibility |
| --- | --- |
| `isSearching()` | Detect the native disabled Play state. |
| `simulateClick(el)` | Invoke `.click()`, then dispatch bubbling mousedown and mouseup. |
| `matchText(text, names)` | Match a trimmed label against case-insensitive RU/EN alternatives. |
| `clickSpecificCard(names)` | Search supported native cards and click the first matching heading. |
| `processAutoQueue()` | Advance the selection state machine. |
| `startAutoQueue(modeData)` | Start selection and install its fail-safe. |
| `handleModeHotkey(event)` | Route digits/numpad 1–7, Space, and left/right Shift to targets. |
| `syncButtonStates(force)` | Apply lock, dimming, pointer state, and current labels. |
| `createQuickButtons(playButton)` | Create the two wide and seven standard controls. |
| `applyStyles(playButton)` | Adjust the lobby layout and replace native Play presentation. |

Hotkeys reject repeated events, Ctrl/Alt/Meta combinations, editable focus, unsupported screen state, disabled settings, active search/selection, and recognized native dialogs.

The main artwork is sliced from `assets/playButton.png` using shared dimensions and offsets. Native children are hidden by the injected `kasp-playbtn-styles`; `data-overridden` and `buttonsCreated` distinguish treated elements and avoid duplicate wrappers. A newly created native Play button resets the wrapper creation state.

`syncButtonStates()` skips work when searching state is unchanged unless forced. Language text is updated within that synchronization path, so changing language alone is not a universal immediate refresh of all existing button labels.

### Augment Specifications

Source: [src/modules/augmentSpecs.ts](src/modules/augmentSpecs.ts).

**Activation:** `k_augments`; supported garage and loot-box contexts. The feature combines reference descriptions with numeric adjustments to visible equipment parameters.

#### Description Controls

`injectButtons()` creates a single `kasp-specs-tooltip` and scans skin-cell images and eligible reward-card backgrounds. `applyButtonToCard()` removes a control when the represented artwork changes and adds a control only when `DataLoader.hasDevice(url)` succeeds.

Hover builds advantages/disadvantages through `renderList()`, including optional nested `subItems`. `updateTooltipPos()` offsets the tooltip from the cursor and flips placement near viewport edges. Clicking its control prevents selection of the underlying card.

Descriptions are bundled reference text rendered as markup. They are not imported history records and do not pass through `escapeHistoryHtml`; reference-data authors must preserve the expected trusted-content boundary.

#### Numerical Adjustment

`updateLiveStats()` reads the current device icon and resolves its `modifiers`. It scans parameter-name spans outside generated replacements and matches exact normalized RU/EN labels from `STAT_DICT`.

The original value is the span immediately after the name container. Parsing removes whitespace and replaces a decimal comma with a period. Standard adjustment is `original × multiplier`; `WEIGHT` with a modifier at least 10 treats that modifier as an absolute value. Results are rounded to two decimals when necessary and formatted with spaced thousands.

Color classification is rule-based: larger multipliers normally indicate a buff, lower reload multipliers indicate a buff, and weight has an additional comparison rule. This classification describes the current presentation logic, not a general assessment of every game mechanic.

`liveStats` maps original nodes to a replacement wrapper, its inner value span, and the original inline display. Original nodes are retained, hidden, and followed by a generated `custom-live-stat` node.

On subsequent updates, class, text, style, visibility, and placement are changed only when necessary. Calculations always read the retained native value. This prevents compounded multipliers and allows observer feedback to settle.

When an original node is no longer active, its replacement is removed, `hidden-by-script` is cleared, its original display is restored, and its map entry is deleted. Invalid numbers or missing modifiers consequently remove stale augmentation during an active update pass.

#### Scheduling and Closure

`scheduleUpdate()` coalesces work into one animation frame, rechecks the setting/context, then runs description and statistic updates. Initialization installs Escape/Z and mouse-back tooltip hiding. Screen changes or a recognized loader also hide the tooltip.

Turning the setting off makes update functions return; it is not a dedicated immediate restoration pass for all existing nodes. The normal settings-close reload establishes the disabled state.

### Paint Search

Source: [src/modules/customPaints.ts](src/modules/customPaints.ts).

**Activation:** `k_paints` in the garage.

`addSearchInput()` requires the paint caption and category parent, marks the native item container `kasp-paints-container`, and appends a single search wrapper with a localized placeholder and input listener.

`normalizeText()` lowercases text and normalizes Russian `ё` to `е`. `applySearch()` waits for the complete shared DataLoader readiness state, splits the trimmed query on whitespace, and compares every query word against combined Russian and English names.

An empty query restores item display. For non-empty queries, a recognized image URL is looked up in `paints.json`; unknown entries do not match. Elements missing an image or source are skipped rather than universally hidden. Each direct collection column is hidden when it has no visible items.

Repeated garage calls reapply an existing non-empty query to newly rendered content. Filtering only changes visibility of loaded cards; it does not alter inventory or request additional paints.

### Friend Categories

Source: [src/modules/customFriends.ts](src/modules/customFriends.ts).

**Activation:** `k_friends`, with friends/invitation UI present and outside battle.

The category sidebar offers All, Online, Offline, Clan, Purple, Yellow, and Red. `filtersConfig` supplies icon URLs and category identifiers.

| Helper | Responsibility |
| --- | --- |
| `getCurrentNickname()` | Read the shared account identity, falling back to `Unknown`. |
| `getCustomCategories()` | Parse the current nickname's category dictionary, falling back to `{}` on JSON errors. |
| `setCustomCategory(friend, color)` | Toggle a category assignment and reapply active sidebar filters; refuse writes for `Unknown`. |
| `getMyClanTag()` | Read the current account's clan prefix. |
| `updateCardBadge(el, isFriendsList)` | Apply the custom color, or clan-blue fallback, to a supported card. |
| `applyFilter(scrollBlock, type)` | Classify native cards and change visibility. |
| `injectCategoriesMenu(menu)` | Add three color controls to a supported player context menu. |
| `setupSidebar(scrollBlock)` | Wrap a friends list or insert a sidebar beside invitations. |

Friend-list online/offline state uses native classes. Invitation state uses recognized text; clan membership uses the current clan tag's presence in card text. A custom color takes precedence over the clan badge.

Assignments use `tankiCustomCategories_<nickname>` and are not synchronized with the native friends service. Toggling the same color removes the mapping. Switching or renaming accounts changes the storage key without migrating earlier assignments.

Dataset flags prevent duplicate sidebars and context-menu augmentation. The context menu is repositioned if its new controls extend below the viewport. These flags also mean an incompletely recognized marked menu is not continually rebuilt by every update.

The module refreshes badges on repeated calls. Filtering is explicitly applied on sidebar clicks and category changes; it does not maintain an independent server-side list subscription.

### Trophy Favorites

Source: [src/modules/customTrophies.ts](src/modules/customTrophies.ts).

**Activation:** Automatic in lobby, garage, and result-screen processing.

`loadTrophyDictionary()` fetches `database/trophies.json`, checks HTTP status, and stores the dictionary. First module initialization awaits this load. The public update function does not automatically restart initialization after a failed first attempt.

`getFavs()` parses and caches the origin-wide favorites array. `saveFavs()` updates both memory and local storage. There is no storage-event invalidation for this private cache.

`parseItem(rawText)` searches dictionary keys as substrings and returns the recognized equipment ID, localized name, and type. `toggleFavorite()` removes an existing item or adds it when fewer than two items of that type are selected. Supported types are turret and hull.

`processGarageMissions()` recognizes eligible cards, parses `current/max` progress, applies grid/list classes, adds favorite stars, and marks unavailable additional selections when limits are reached. Missing/invalid targets can use the implementation's 5,000,000 fallback.

`processBattleResults()` parses visible quest progress text and refreshes a favorite's stored current/maximum values when the current value changes. Progress comes from the observed game interface.

`extractIcon()` uses a reward background or the score icon fallback. `formatNumber()` inserts spaces. `createPanel()` sorts turrets before hulls and renders a percentage clamped to 0–100. `updateInterface()` adds the lobby panel beside the battle-pass block when favorites exist, removes it when that anchor disappears, and processes garage cards.

The panel is created when absent; an existing panel is not universally rebuilt after every progress or favorite change. Favorite-card click listeners also capture values at creation time. Treat the panel as observed/cached presentation, rather than a continuous authoritative progress feed.

### Auto Upgrade

Source: [src/modules/autoUpgrade.ts](src/modules/autoUpgrade.ts).

**Activation:** `k_auto_upgrade` in the garage. This feature initiates actual native upgrade actions after its own confirmation.

#### Recognition Functions

| Function | Recognition or action |
| --- | --- |
| `pressEnter()` | Dispatch a bubbling Enter keydown to initiate a native action. |
| `isDialogOpen()` | Detect the native dialog container. |
| `isRubyButton()` | Inspect Ruby/Russian ruby heading text, button text, and ruby images. |
| `hasNormalButton()` | Find the supported confirmation selector and reject it if Ruby recognition succeeds. |
| `clickConfirmButton()` | Click that selector when still present and report whether it was found. |
| `clickCancel()` | Find an exact Cancel label or the native fallback key button. |
| `isCompleted()` | Detect recognized COMPLETED/ЗАВЕРШЕНО controls. |
| `isUnavailableButton()` | Detect recognized unavailable action text. |
| `isMaxLevel()` | Detect established/max controls and supported MK/level/name markers. |
| `shouldShowQuickButtons()` | Require enabled setting, eligible non-max/non-completed item, Enter hotkey, and a recognized non-ruby price icon. |

`isUnavailableButton()` exists as a helper, but the current step loop uses `shouldShowQuickButtons()` for its unavailable/retry path. The confirmation selector retains the game's `getRubyButton` class even for a recognized normal confirmation; classification depends on the additional checks.

#### Setup Dialog

`createButtons()` adds X5, X10, X15, and MAX actions. MAX supplies `Infinity` as the requested count. `performAction(count)` refuses a concurrent sequence or ineligible starting state and calls `showConfirmDialog()`.

The setup uses the shared modal, localized text nodes, and Buy/Cancel actions. Buy or Enter closes the setup and starts the sequence once. Its key handlers prevent Enter from leaking into the underlying native game action, and retain a short keyup suppression period after closing.

#### Step State Machine

After confirmation, the closure sets `isRunning`, `upgradeQueue`, and `upgraded`, then schedules its nested `doStep()`:

1. Stop and clean the timer if the sequence is no longer running.
2. If waiting for a confirmed native dialog to close, poll while it remains open; no new action is issued.
3. Stop at recognized MAX, or completed state without an open dialog.
4. If eligible controls are absent and there is no dialog, retry up to 80 times at 100 ms intervals.
5. Reset the unavailable counter after passing that path and stop when the requested confirmation count is reached.
6. With an open Ruby dialog, attempt cancellation and stop.
7. With an open recognized normal dialog, click its confirmation; on success increment `upgraded`, enter the waiting-for-close state, and schedule another step.
8. With an unknown dialog, stop without clicking, sending Enter, canceling it, or increasing the count.
9. Without a dialog, issue Enter and schedule another check after 30 ms.

`finish()` clears running/queue/retry state and the timeout. A confirmation that disappears before `clickConfirmButton()` stops the sequence. The count tracks confirmations issued, not server-verified completed purchases.

#### Navigation and Button Lifecycle

Initialization installs capture listeners for garage item/category/back clicks. Supported navigation clears running state and its timer, resets the item signature, removes quick buttons, and schedules button recreation.

`lastItemSignature` follows the selected item name or action container. `isCategorySwitch` and its timeouts distinguish category transitions from item selection. Escape/Z and side-button handlers update category/signature state; they do not themselves implement a universal emergency stop of a running sequence.

Repeated updates remove/recreate controls when signatures or eligibility change. A recognized loading screen closes the setup modal. Recognition is heuristic and depends on native labels, classes, and currency artwork.

### Nickname and XP Privacy

Sources: [src/modules/hideNickname.ts](src/modules/hideNickname.ts), [styles/hideNickname.css](styles/hideNickname.css).

**Activation:** `k_hideNicknameXP`, including synchronous startup setup.

`setupNicknamePrivacy()` exits if disabled, applies `hideNickname()` immediately, and installs one private observer. It observes subtree children, character data, and class/ID attributes. Re-enabling uses the existing observer.

`hideNickname()` ensures `html.kasp-hide-nickname`, sets `--kasp-hidden-label` to the appropriate quoted CSS string, and annotates supported nodes. `setTooltip()` writes only when metadata differs.

Header nickname and XP receive original-text tooltips. Client parameters matching `UID:` receive `data-kasp-private-uid`; other parameters receive `data-kasp-public-parameter` and have stale UID metadata removed. Native statistics spans matching the actual self nickname receive `data-kasp-private-nickname`; stale self markings are removed.

CSS makes original text transparent, disables selection/transitions, and paints a pseudo-element label. Known header, selected self-row, result self-row, history current-player, and linking-target selectors can mask without waiting for an observer annotation. The first client parameter is provisionally masked until identified as public, allowing an immediately inserted UID-first block to remain covered.

The source text and children remain intact. UID presentation retains the `UID:` prefix; TYPE, VER, UPD, and SRV remain public once classified. Tooltip metadata intentionally reveals original values on hover.

The observer avoids watching its own metadata attributes, and comparison guards reduce repeated mutations. Disabling removes the root class through Core Settings; observers remain page-lifetime but callbacks exit while disabled. New unrecognized selectors are outside current coverage.

### Currency Privacy

Source: [src/modules/hideCurrency.ts](src/modules/hideCurrency.ts).

**Activation:** `k_hideCurrency`, outside the recognized battle screen.

`getHiddenText()` selects Hidden/Скрыто. `processSpan()` recognizes text containing digits, saves it in `data-original-value`, replaces the span's displayed text, assigns an original-value tooltip to the supported parent, and adds `currency-masked`.

Already masked spans are not overwritten again; missing parent tooltips can be restored from the saved value. Selectors cover `.ksc-22`, `.ksc-24`, native coin blocks, and header icon spans.

The first eligible call starts a 500 ms interval as well as performing immediate processing. The interval skips battle but does not recheck `k_hideCurrency`; disabling therefore relies on the normal reload to terminate the old timer. There is no general immediate restoration function for the replaced numeric text.

Currency masking differs from nickname masking: it modifies selected text nodes and is not designed as a before-paint CSS-only identity-preserving mechanism.

### Garage Skins

Source: [src/modules/customGarageSkins.ts](src/modules/customGarageSkins.ts).

**Activation:** Automatic, using direct garage DOM recognition and the additional 250 ms interval.

#### Database and Saved State

`loadSkinsData()` independently fetches `database/skins.json` at import time and caches its promise. It fills `NAME_TRANSLATE` and `PREFILLED_DEFAULTS`, logging success or failure. A failed promise is not automatically discarded for retry.

`safeParseJSON()` returns parsed data or `null`. `getSavedSkins()` reads equipment-to-artwork overrides. `getDefaultImages()` merges bundled stock artwork with stored string or array entries, supporting earlier storage shapes and deduplicating URLs.

#### Observation and Learning

| Function | Responsibility |
| --- | --- |
| `readSkinCards(row)` | Read card titles, standard-skin markers, and equipped markers. |
| `readSelectedTitle(menu, row, titles)` | Find a leaf title outside the card row matching a known card. |
| `readPreviewArt(menu, row)` | Extract a WebP background URL outside the card row. |
| `readSkinsScreen(names)` | Return `absent` or a structured ready state with equipment, equipped card, selected title, and artwork. |
| `decideLearnAction(state, stockUrl)` | Produce `none`, `set`, or `clear` with a reason/source. |
| `learnFromSkinsScreen(state, defaults)` | Stabilize a candidate across two matching observations before changing saved data. |
| `writeSavedSkins(saved)` | Persist overrides and warn on write failure. |

A nonstandard skin is learned only when the selected title matches the equipped title. Previewing another skin does not replace the saved equipped artwork. Standard equipment produces a clear action.

Readable artwork must match the module's narrow HTTPS Tanki-subdomain WebP pattern. If equipped artwork cannot be read, a known stock URL can be stored as the fallback. Equality with that stock fallback is used by `hasUnknownSkin()` to identify an unknown skin.

`pendingLearn` tracks an action key and repeated-observation count. A `none` action clears it. Two matching observations are required; these may come from multiple update paths and do not guarantee a fixed wall-clock waiting period.

#### CSS Replacement and Labels

`tick()` requires ready databases and a supported garage screen. It reads/learns the skin state, gathers original item image URLs, updates unknown labels, persists newly seen base images, and calls `updateGlobalCSS()`.

`updateGlobalCSS()` builds selectors for known original `src` values on garage images and mounted previews. It writes `content: url(...)`, object fitting, and pointer presentation into `kasp-skins-global-css` only when the generated text changes. Native `src` attributes remain available for recognition.

`toggleUnknownLabel()` adds/removes the English `unknown skin` label. `markMountedUnknownSkins()` resolves mounted previews against known base URLs. `describeSkinsScreen`, `logSkinsScreen`, `noteLearn`, and `describeLearnAction` provide change-sensitive diagnostics using the `[KI-test][garage-skins]` prefix.

This is a garage-artwork replacement mechanism. It does not provide an arbitrary skin selector, unlock ownership, or modify the 3D battle tank. Unlike history URLs, previously stored skin/base-image maps are not passed through the shared history sanitizer during every CSS generation.

### Weapon Reload Indicator

Source: [src/modules/weaponAugmentTracker.ts](src/modules/weaponAugmentTracker.ts).

**Activation:** Automatic. Garage observations configure a pointer-lock input-driven estimate.

The recognized turret-name list contains 17 names, but `RELOAD_BASE_STEPS` supplies MK1–MK7 step arrays only for Shaft and Scorpion. Three exact augment image URLs apply multipliers of 1.15, 1.70, and 1.15. One exact augment URL disables the timer.

`trackGarage()` requires a recognized turret and equipped/unequip label. It reads the augment icon, parses `mk<number>-<step>`, treats MAX as MK7-20, and otherwise defaults to MK7 step zero. The step is capped at the last array entry. Base time multiplied by the matched augment factor is rounded to two decimal places.

An equipment signature prevents redundant saves. The persisted object contains turret, augment, MK, step, reload time, and timestamp. Import-time cache restoration restores a numeric reload duration; it does not restore every other private variable such as `currentTurret`.

Initialization starts a permanent animation-frame `renderLoop()` and installs pointer/keyboard listeners. Primary non-touch pointer input and non-repeated Space begin timing only under pointer lock. Release starts a reload estimate if one is available and none is already active. Holds longer than 200 ms are accepted only when the current turret is Shaft.

`createBar()` creates the fixed overlay lazily. `renderLoop()` displays progress as elapsed time divided by duration and hides it at completion, without pointer lock, or when there is no duration. It schedules the next frame even when hidden.

The model measures input timing, not confirmed projectile firing, reload telemetry, or server state. Cache-only startup, changed equipment, unsupported tables, and missed releases can affect accuracy.

### Overdrive Box Timer

Sources: [src/modules/overdriveTimer.ts](src/modules/overdriveTimer.ts), [src/core/bonusPickup.ts](src/core/bonusPickup.ts), and [styles/overdriveTimer.css](styles/overdriveTimer.css).

The module is registered as `modules.overdriveTimer`. Boot calls `setup()` once and `sync()` during normal heavy passes. A 250 ms interval maintains the display even when the battle DOM is otherwise idle. The setting `k_overdrive_timer` defaults to `false` and uses the existing settings panel, boolean cache, and settings-close reload workflow.

#### Pickup Bridge and Bundle Transformation

The MAIN-world injector installs `window.__kaspBonusRegister` and `window.__kaspBonusPickup` before processing the game bundle. `patchBonusPickups()` recognizes the game's `"bonus pickup"` path and wraps the bonus expression with the pickup callback. The callback returns the identical input object, preserving the original game arguments. A second insertion registers bonus data in a constructor associated with `onBonusCollision`. Unrecognized patterns remain unchanged.

`createBonusPickupBridge()` resolves model identifiers from bounded game-object traversal (up to three levels, twenty fields per level, and eight root fields). A visited set prevents cycles, and inaccessible properties are ignored. Two-number game identifier objects are converted through their string representation. Registration associates sound IDs with box model IDs only while that association remains unambiguous. The observed sound `118254` is shared by multiple bonus types; registering different models for one sound permanently marks that sound association ambiguous for the page session.

The call insertion uses `__kaspBonusPrepare(resource, soundField)`. It evaluates the original sound property once and returns the unchanged argument. Model traversal excludes that property to avoid evaluating its getter again. The resolved resource model is placed on a short-lived stack keyed by the actual sound argument. The method observer consumes the matching stack entry in `__kaspBonusContext(sound, position)`, normalizes the second argument with `readBonusPosition()`, and emits the paired model and coordinates. Nested calls sharing one sound use separate stack entries; unused entries are removed at the next microtask to prevent aborted calls from contaminating later events. An unpaired context does not emit a guessed model.

`readBonusPosition()` recognizes finite numeric `x/y/z` or the observed game vector fields `f20_1/g20_1/h20_1`. The MAIN-world injector posts `{ type: 'kasp:bonus-pickup', detail: { model, position } }` through `window.postMessage`. A missing or invalid position becomes `null`. The legacy `__kaspBonusPickup()` helper remains available, but normal patched calls use the paired argument path.

`OVERDRIVE_BOX_MODEL` identifies overdrive model `1647333199409`. Model `1647333199408` is a speed boost and does not start an overdrive countdown. The model identifier and bundle signatures depend on the game implementation. They should be checked after game updates; failure to match leaves the module waiting for a recognized pickup. No server respawn timestamp is read.

#### Optional Instance Diagnostics

`window.__kaspBonusDebug` exposes `enable(value = true)`, `clear()`, and `export()`. Enabling persists the `kasp_bonus_debug` boolean in page local storage; reload before joining a battle to capture its initial registrations. Disabling stops collection and snapshot traversal. Records are kept in memory, capped at 200, and exported as JSON; page reload clears the journal. Clear does not disable collection. The debug switch is separate from the timer's display setting.

The `hooks` record reports whether the pickup call and argument observer were inserted, and how many registration insertions matched. A saved hook status is also recorded when debugging is enabled after bundle processing. The registration insertion now forwards the candidate instance ID and the next three constructor arguments alongside the bonus model data. A `register` record contains resolved model/sound IDs, an instance ID snapshot, and a position only when all three coordinate arguments are finite numbers. The exact meaning of those constructor arguments requires verification against a real battle journal.

`pickup-model` records capture the resource model prepared for the timer message. The pickup method invokes `__kaspBonusContext(first, second)` after its caller has evaluated the arguments; `pickup-context` records contain the paired model, a `paired` flag, normalized position, and bounded snapshots of both arguments. Original call arguments are not evaluated twice and are not changed. A registration alone does not assign a pickup to a spawn location. Invalid registration coordinates are additionally recorded as bounded `coordinateArguments` snapshots for investigation.

`snapshotBonusArgument()` limits depth to three levels, twelve fields per object, and an object traversal budget of 120. It detects cycles, summarizes long IDs, truncates strings, and isolates inaccessible properties. Console output contains JSON snapshots rather than live resource objects. Exceptions in diagnostic output or the inserted context observer cannot interrupt original pickup playback. Collect appearances and pickups at both locations, then use `copy(window.__kaspBonusDebug.export())` in the game page console to export data for comparison. Location assignment currently uses the paired pickup vector, not the registration instance ID.

#### Countdown State and Battle Lifecycle

`createOverdriveCountdown(now, boxModel)` owns a nullable deadline for one model, defaulting to the overdrive model. A matching `pickup(model)` sets it to `now() + OVERDRIVE_COOLDOWN_MS`, where the interval is exactly 85,000 ms. Other models leave it unchanged. `remaining()` returns `null` before a pickup, then the nonnegative ceiling of the deadline difference in seconds. Delayed browser ticks therefore do not accumulate drift. `reset()` clears the deadline. At zero the module waits for a subsequent pickup instead of automatically starting another cycle.

`createOverdriveLocations(now)` owns two independent countdown entries and two initially null positions. The first valid pickup position is assigned to the first entry. Subsequent positions are compared by three-dimensional Euclidean distance with existing anchors; the nearest anchor within `OVERDRIVE_POINT_RADIUS` (250 game-world units) is reused. Otherwise the remaining empty entry becomes the second point. Anchors are learned per battle and never hardcoded from a map or diagnostic dump. A third distant point is ignored. With no position available, the primary timer can act as a fallback while fewer than two positions are known; once both are known, unlocated events cannot safely choose a timer and are ignored. Reset clears deadlines and anchors.

The message listener requires `event.source === window`, the expected message type, a string model identifier, an enabled setting, and a mounted battle canvas. It processes pickups reported by the client regardless of the collecting player. This page-to-extension bridge is observational and is not an authenticated source of server state.

`syncBattle()` tracks the canvas element through `gameDOM.screens.battleCanvas`. Removing or replacing that element outside an in-battle section clears the countdown. While the native tank preview has `TankPreviewComponentStyle-visible` or a visible `.-container` section is open, countdowns and learned positions are preserved even if the canvas is temporarily unmounted. A resumed section can remount a new canvas without resetting deadlines; up to one second is allowed for the return transition. Native lobby and result screens end the battle session. A mounted result screen suppresses the panel and clears the deadline. The existing `kasp:battle:id` event also resets it when delivered. Entering a battle does not start a speculative initial timer. State is kept in memory and does not survive a page reload.

#### Presentation

`render()` creates `#kasp-overdrive-timer` only during a battle with the setting enabled. It displays only numeric `minutes:seconds`, using `0:00` before the first pickup and after completion. The background is yellow during the normal countdown, reddish during the final ten seconds, and green at zero; the text remains dark in every state, with a 0.2-second background-color transition. Text and title updates are conditional to avoid repeatedly waking the master DOM observer. Disabled or non-battle states remove the panel. The stylesheet uses `top: 1em`, `left: 60%`, medium-weight game fonts, and dimensions in `em`, with pointer events disabled, so it does not intercept battle controls.

The displayed deadline estimates a box's next appearance from a pickup; it does not confirm that a box is currently on the map. There is no manual restart key, sound alert, paid-access gate, or persistent deadline.

`renderTimer()` uses the `.kasp-overdrive-timer` styling. The primary panel is always shown during an enabled battle at `left: 60%`. `#kasp-overdrive-timer-secondary` appears at `left: 38%` after the second learned point is picked up, then remains visible until battle reset or disabling the feature. Both panels use `z-index: 1` and represent the same overdrive model at different positions; speed boosts remain excluded. Both panels retain their left anchors. Completion keeps `0:00` and changes only the background to green. An observer watches section insertion/removal and class, style, or hidden attribute changes: a visible native preview or `.-container` hides both panels without clearing deadlines, and returning to battle restores their current values. Container visibility is checked through layout rectangles and computed display, visibility, and opacity. Selectors are defined in `gameDOM.screens.tankPreview`, `gameDOM.screens.visibleTankPreview`, and `gameDOM.common.container`. The proximity tolerance is heuristic and requires verification on real maps, especially when spawn points are close together or pickup vectors vary significantly.

### Equipment Change Indicators

Source: [src/modules/changeCounter.ts](src/modules/changeCounter.ts).

**Activation:** Automatic, with listeners installed when the module is imported.

The private `playerChanges` map restores `kasp_player_changes_cache` from session storage when readable. `saveCache()` serializes the map; `clearCache()` clears both forms.

A `kasp:useraction` message must contain an array beginning with `TankUserActionLog` and including `CHANGE_EQUIPMENT`. Nickname selection excludes known tokens, values beginning with `-`, and values without Latin letters or the expected length. The first remaining candidate is counted.

A separate message listener uppercases `kasp:battle-kind` into `window.__kaspBattleKind`. The listeners inspect message contents but do not authenticate an origin/source or a server signature.

`sync()` adds one `kasp-change-th` header and `kasp-change-td` cell per supported row, parses the original nickname, and toggles `kasp-changed` according to whether its observed count is nonzero. `update()` delegates to `sync()`; the interface is an indicator rather than a universal numeric count display.

`onTick()` calls `checkBattleCanvas()`. Transitioning out of `.BattleComponentStyle-canvasContainer` clears the cache. A `kasp:battle:id` document event also clears it; the current TypeScript code contains this listener but no in-repository producer of that event.

### Resistance Presentation

Source: [src/modules/zeroResists.ts](src/modules/zeroResists.ts).

**Activation:** Automatic when team/result statistics containers exist.

`sync()` invokes four operations in order: header shield, compact resistance cells, zero summary, and expansion toggle. `update()` is an alias for this synchronization.

| Function | Responsibility |
| --- | --- |
| `getIconStyle(icon)` | Cache mask/background style in a `WeakMap`. |
| `getCssUrl(el)` | Read supported mask/background CSS properties. |
| `getIconUrl(label)` | Extract a mask URL or image URL. |
| `injectHeaderShield()` | Insert the shield heading after the GS header when absent. |
| `injectCompactCells()` | Clone recognized protection and critical-resistance labels into two compact slots. |
| `injectZeroSummary()` | Add `×0` entries for configured types missing from the native summary. |
| `injectToggleButton()` | Add the expansion control and restore/persist its state. |

Compact protection prefers an all-resistance/Spectrum icon, otherwise a heuristic red-colored label. A remaining critical-resistance label becomes the second slot. A state key based on recognized values avoids rebuilding unchanged compact content; absent entries use dashes.

The zero-summary pass reads resistance icon filename patterns from native entries, skips generated zero entries, removes zeros when their native type appears, and adds missing configured types. This represents absence from the observed summary, not independently measured zero protection for every player.

`kasp_tab_expanded` controls the body class and active toggle. Cached computed styles are tied to element identity and are not invalidated by every possible style change on the same native node.

### Garage Button Presentation

Source: [src/modules/garageButtons.ts](src/modules/garageButtons.ts).

**Activation:** Automatic in the garage.

`getActiveTabCategory()` recognizes supplies, paints, grenades, or default from the active menu label. `computeButtonSig()` combines truncated text, category, child count, native icon presence, and extension active/disabled classes.

The exported update compares signatures in `processedSigs`, a `WeakMap`. When any button differs, `applyButtonFixes()` processes the current controls and saves their final signatures after its own class changes.

Action classification considers hotkeys/prices, equip/unequip text, completed text, supplies context, and sibling button count. Paint/equip actions use mount presentation; supplies/single-action purchasing can use buy presentation; other upgrade contexts use upgrade presentation.

`applyMask()` replaces a native icon's background image with standard/WebKit mask properties and explicit color, sizing, position, repeat, and opacity. CSS classes control active/disabled and directional hover presentation. The feature does not replace the native purchase/equip event handlers.

### Self Equipment Tracking

Source: [src/modules/equipmentTracker.ts](src/modules/equipmentTracker.ts).

**Activation:** Automatic when the master observer sees native battle statistics.

`findSelfRow()` prefers `#selfUserBg`, then the selected native row, then a nickname match against the shared account identity. `iconsOf()` returns the equipment block's children. `urlFrom()` tries background-image, mask-image, a descendant image, and the element's own image source.

`sync()` reads turret/augment from the device cell and hull/augment from the defence cell. If neither turret nor hull is readable, it returns. Otherwise, an icon signature prevents repeated storage writes and the object is stored with `savedAt` in `kasp_my_equipment`.

`get()` parses the current cached object and returns `null` on read/parse failure. `clear()` removes it and resets the signature. The scheduler does not automatically invoke `clear()` for every battle or account change.

Battle History copies this cache during capture. There is no account partition, expiration check, or proof that the latest cache belongs to the exact result being saved. A failed save after the signature is updated can also require changed observations or runtime restart before another identical save attempt.

### Version Welcome Window

Source: [src/modules/welcomeModal.ts](src/modules/welcomeModal.ts).

**Activation:** Automatic once per page session, outside loading.

`CURRENT_VERSION` comes from `chrome.runtime.getManifest()`. If `kasp_last_version` already matches, the update marks `hasChecked` and exits. Otherwise, the first eligible call sets `hasChecked` and invokes `showWelcomeModal()`.

The function fetches and checks `welcome-modal.html`, replaces known localization placeholders, creates a dedicated full-screen overlay/dialog, and binds the close button. Closing removes the overlay and stores the acknowledged version.

This window does not use the shared modal controller, so it does not inherit all shared backdrop/key/cleanup behavior. Template failure is logged, and the session guard prevents an automatic retry during the same page execution. Version acknowledgement is origin-wide.

## Battle History Implementation

Sources: [facade](src/modules/battleHistory.ts) and [implementation directory](src/modules/battleHistory/).

### Responsibility Map

| File | Responsibility |
| --- | --- |
| `battleHistory.ts` | Feature gating, account context, controller composition, overlay creation, and update-loop integration |
| `types.ts` | Battle/player records and controller contracts |
| `repository.ts` | IndexedDB schema and transactional reads/writes |
| `capture.ts` | Native result parsing and capture guard |
| `validation.ts` | Import shape/type validation and normalization |
| `presentation.ts` | Card/detail markup generation and formatting |
| `views.ts` | Template caching, list/detail rendering, revisions, pagination, and animation state |
| `navigation.ts` | Footer entry, native settings integration, loader, geometry, shortcuts, and cleanup |
| `actions.ts` | Clear, link, export, import, and their dialogs |
| `localization.ts` | History, management-dialog, and status-message dictionaries |

The dependency direction is deliberate: storage does not manipulate UI; capture builds a record before saving; presentation does not query IndexedDB; views combine data and templates; navigation manages the surrounding native page. The facade connects them through narrow callbacks and a `HistoryAccount` object.

### Facade and Account Context

The private nickname initializes from `kasp_last_nickname`, falling back to `Unknown`. This history-specific fallback differs from `getAccountIdentity()`, which has no account cache.

| Function/object | Behavior |
| --- | --- |
| `setNickname(nickname)` | On a change, release/remove the old overlay, reset views, clear the overlay promise, update the current nickname, and attempt persistence. |
| `updateNickname()` | Read current shared identity and accept a non-Unknown nickname. |
| `account` | Expose `getNickname`, `updateNickname`, and `setNickname` to controllers. |
| `createHistoryPage()` | Fetch/localize the overlay skeleton, check the account snapshot, insert it hidden, and bind management/close actions. |
| `ensureHistoryPage()` | Update identity and share a single pending creation promise; release that promise after completion/failure. |
| Exported `battleHistory()` | Gate by `k_history`, initialize shortcuts, inject entry controls, prepare the overlay, and dispatch/reset capture. |

First activation binds history shortcuts once and schedules an additional identity refresh after five seconds. Page preparation can start before the user clicks the footer entry.

`createHistoryPage()` snapshots nickname and language before awaiting its template. It rejects non-success responses and refuses insertion if ownership changed or another overlay appeared. Its replacements go through `renderHistoryTemplate()`.

On each eligible update, capture runs only when both the self row and result text are present. Once result text disappears, the result guard resets. A missing live identity does not always erase the cached history nickname; record capture has an additional self-row fallback.

### Record Types

Source: [types.ts](src/modules/battleHistory/types.ts).

#### BattleData

| Field | Meaning |
| --- | --- |
| `id?` | IndexedDB-generated record identity |
| `nickname` | Logical record owner |
| `date` | Local capture timestamp in milliseconds |
| `status` | Observed result text or capture fallback |
| `map` | Map text after recognized trailing-mode extraction |
| `mode` | Recognized mode suffix, or fallback |
| `kind?` | `MM` or `PRO` metadata |
| `top` | Placement text within the observed team/row group |
| `reputation` | Current player's observed score |
| `kills`, `deaths`, `kd` | Current player's combat statistics |
| `crystals`, `stars` | Observed rewards |
| `turretIcon`, `turretAugmentIcon`, `hullIcon`, `hullAugmentIcon` | Equipment artwork copied from the latest cache |
| `teamScoreMy?`, `teamScoreEnemy?` | Team scores when both are readable |
| `players?` | Captured player rows |

#### PlayerData

Each player has `name`, rank-image URL `rank`, gear score `gs`, `score`, `kills`, `deaths`, `kd`, `crystals`, `stars`, and boolean `isEnemy`/`isMe` flags.

`HistoryAccount` supplies account access without importing the facade's private variables. `RenderBattleList` accepts an optional page and new-match animation flag and returns `Promise<void>`.

TypeScript record declarations describe runtime expectations; they do not validate existing IndexedDB contents automatically. Import normalization supplies missing optional artwork/player values before storage.

### Database Repository

Source: [repository.ts](src/modules/battleHistory/repository.ts).

`openDatabase()` opens `TankiBattlesDB` at version 4. During upgrade it reuses or creates `battles` with `keyPath: 'id'` and `autoIncrement: true`, then ensures non-unique `date`, `map`, `mode`, `top`, and `nickname` indexes.

The upgrade adds missing structure without explicitly clearing records. Successful connections close themselves on `versionchange`. Open failures reject; there is no dedicated user-facing blocked-upgrade handler in this helper.

#### Transaction Wrapper

`transaction<T>(mode, enqueue)` opens a connection and synchronously enqueues requests inside the transaction. A callback updates the eventual result; successful request execution alone does not resolve the outer promise.

`oncomplete` resolves after commit. Transaction errors record failure, abort rejects, and synchronous enqueue errors attempt to abort. A `finally` closes the connection regardless of outcome.

This separation matters for UI correctness: import/link/clear completion must mean committed writes, rather than the first request reporting success. Keeping request creation synchronous also avoids allowing the transaction to become inactive during arbitrary awaited work.

#### Repository API

| Function | Operation |
| --- | --- |
| `addBattle(battle)` | Add one record and return its generated key after commit. |
| `addBattles(battles)` | Add a non-empty batch in one read/write transaction. |
| `getAllBattles(nickname)` | Read through the nickname index when a non-empty nickname and index are available; otherwise read the whole store. |
| `getNicknameHistory()` | Count non-empty owners across the store and sort names using `localeCompare`. |
| `mergeNicknameHistory(source, target)` | Cursor-update source records' owner to target, preserving IDs, and return the moved count. |
| `clearNicknameHistory(nickname)` | Obtain only that owner's keys and delete them in one transaction. |

These helpers do not sort battles by date, deduplicate imports, authenticate ownership, or validate each record's content. Controllers and views supply the intended scope and presentation order.

### Result Capture

Source: [capture.ts](src/modules/battleHistory/capture.ts).

#### Parsing Helpers

`parseMapAndMode(rawText)` trims text and checks its final word against known mode codes. A matched suffix is removed from the map text. Missing text uses `Unknown Map` and `MM`; an unrecognized suffix retains the map text and uses `MM` as mode.

`readInteger(row, column)` reads a numbered native kill-board column, removes whitespace, parses an integer, and falls back to zero.

`readPlayers(tbody)` iterates native rows, skips `rowSpace`, and uses `teamRowSpace` as the point after which `isEnemy` becomes true. It records original nickname text, rank image, GS, numbered statistics, and `isMe` from the self-row ID.

For ordinary team results, this flag initially represents position relative to the native divider; it is not recalculated from a separate authenticated team identity. DM capture replaces the flags with `isEnemy = !isMe`.

`readPlacement(selfRow)` determines which side of the divider contains the self row and computes its one-based position within that group, excluding spacer rows. Rows without IDs are excluded from its counted player set.

#### Building a Battle Record

`readBattleResult(selfRow, nickname)` has no database write or capture-state mutation. It requires score/kills/deaths cells with non-empty text before producing a record.

It reads players, map/mode, and native result text. DM is recognized by mode or empty result text; missing non-DM result text can use the `Victory` fallback. Team scores are included only when both parse successfully and are oriented using the self row's divider side.

Current-player K/D is recalculated as `kills / deaths` rounded to two decimals when deaths are positive, otherwise as kills. Other player K/D values come from their displayed column. `date` uses `Date.now()` at observation, and kind uses `window.__kaspBattleKind` with `MM` fallback.

Equipment is copied from `equipmentTracker.get()` or represented by empty strings. The record therefore combines live result-screen data with the latest auxiliary equipment cache.

#### Capture Guard and Generation

`createResultCapture(account)` owns `battleProcessed` and `resultGeneration`. Its `capture()` updates identity, requires a self row, and exits if the current observed result is already processed.

If ownership remains `Unknown`, it attempts to derive a clean nickname from the self result row. It waits if ownership or required statistics are still unavailable.

After building a record, it marks the result processed **before** awaiting `addBattle()`, preventing concurrent observer calls from queuing the same result repeatedly. A failed write unlocks retry only when its saved generation still matches the current generation.

`reset()` advances the generation and clears the guard. An old asynchronous failure therefore cannot unlock a newer result that has already been processed. This is an in-memory lifecycle guard; reloading or reimporting is not protected by persistent uniqueness rules.

### Import Validation

Source: [validation.ts](src/modules/battleHistory/validation.ts).

`parseHistoryImport(text)` parses JSON, requires a non-empty array, and applies `validateImportedBattle()` to every element before returning the normalized batch. A single invalid record throws before `addBattles()` starts.

| Value | Validation |
| --- | --- |
| Record | Non-null object, not an array |
| `nickname`, `status`, `map`, `mode`, `top` | Required strings |
| `date` | Required finite number greater than zero |
| `reputation`, `kills`, `deaths`, `kd`, `crystals`, `stars` | Required finite numbers |
| `kind` | Absent or exactly `MM`/`PRO` |
| Four equipment icon fields | Absent or strings; sanitized afterward |
| Two team score fields | Absent or finite numbers |
| `players` | Absent or an array of valid player objects |

Player validation requires string name/rank, finite numbers for all seven statistics, and boolean enemy/self flags. Rank and equipment URLs are sanitized. Missing players normalize to `[]`; missing or unsafe equipment images normalize to empty strings.

Only explicitly reconstructed fields are returned. Imported primary keys and unrelated extra fields disappear. A repeated import receives new database IDs and creates duplicates.

Validation accepts arbitrary string content, including literal HTML-like names, because rendering escapes that text. It does not require every string to be non-empty, every number to be non-negative, timestamps to fit a particular calendar range, or statistics to satisfy game-specific consistency rules.

### Safe Markup and Presentation

Sources: [historyMarkup.ts](src/core/historyMarkup.ts), [presentation.ts](src/modules/battleHistory/presentation.ts).

#### Markup Boundary

`escapeHistoryHtml(value)` converts nullish values to an empty string and escapes ampersand, angle brackets, double quote, and apostrophe. Both imported and previously stored text pass through this boundary when used as history markup.

`getHistoryImageUrl(value)` requires a non-empty string without whitespace, quotes, angle brackets, or backslashes. URL parsing then requires HTTPS, no credentials, no non-default port, a hostname equal to `tankionline.com` or ending in `.tankionline.com`, and a supported pathname extension: SVG, WebP, PNG, JPG/JPEG, GIF, AVIF, or ICO. Invalid values return `''`.

`renderHistoryTemplate(template, values, markupKeys)` performs one placeholder-replacement pass. Ordinary values are escaped. Only explicitly named markup keys bypass escaping, and missing values retain their placeholders.

Because replacement is single-pass, a stored value such as `{{map}}` remains literal text rather than being interpreted as a later replacement token. Trusted fragments must escape their own dynamic data before being allowlisted.

#### Presentation Helpers

| Helper | Responsibility |
| --- | --- |
| `translateMapName()` | Resolve localized reference name, retaining unmatched text. |
| `getGsClass()` | Assign gear-score presentation bands, including the 9,999 top band. |
| `playersWord()` | Select English singular/plural or Russian numeral forms. |
| `classifyResult()` | Recognize victory/draw/DM from status and mode; other results render as defeat. |
| `formatNumber()` | Insert non-breaking thousand separators. |
| `formatBattleDate()` | Format browser-local date and hour/minute time. |
| `buildCardMarkup()` | Build a list card from a record and template. |
| `buildDetailedMarkup()` | Build team tables and the detailed result view. |

Cards use localized maps, sanitized map backgrounds, result classes, score/combat data, optional team score, placement, equipment icons/placeholders, MM/PRO label, rewards, and date/time. Missing augment images add `bh-card--no-aug`.

Details generate escaped player rows, sanitized rank images, GS classes, team counts, and result presentation. When both team scores are available outside DM, the hero uses team totals; otherwise it shows the player's score and K/D. Empty team groups are hidden.

For DM, `buildDetailedMarkup()` places every player in the first table regardless of the stored `isEnemy` flag. The `solo-mode dm-mode` layout centers this table and hides the empty opponent panel. Other players receive `enemy-player` classes with red backgrounds; the current player retains the blue `current-player` highlight. Saved row order is preserved, and rendering does not rewrite stored player flags. Other modes retain their existing team grouping.

The `current-player` class links presentation to nickname privacy. `backLabel` contains an actual `\u00A0` character in the dictionary; it is not an HTML entity string that would render as literal `&nbsp;` after escaping.

Mode icons are implementation-owned constants. The AR icon currently uses a Tanki Wiki URL; these static constants are distinct from imported image fields validated by the Tanki-host sanitizer.

### Views and Pagination

Source: [views.ts](src/modules/battleHistory/views.ts).

#### Template Loading

`loadTemplate('card' | 'detail')` caches promises by template name, shares concurrent requests, checks HTTP status, and deletes the cached entry on failure so a later call can retry.

`animateHistoryTransition(element, className, duration)` restarts a CSS animation, listens only for the element's own animation end, and resolves through an idempotent finish function. A timeout at `duration + 50` ms guarantees completion if the expected event never arrives.

#### List Rendering

`renderBattleList(page = 1, animateNewMatches = false)` updates account identity, captures the current list element and nickname, and increments `listRevision`. An `isCurrent()` guard checks revision, account, and element identity after asynchronous steps.

The view loads that account's records, sorts descending by date, calculates a minimum of one page, clamps the requested page, and selects 15 records. Card construction runs concurrently through `Promise.all`; templates remain shared.

Only a still-current result replaces the list. Empty history displays the localized empty state. The total count and pagination are updated after successful rendering.

`buildPageNumbers()` shows all pages for totals up to seven. Longer histories keep first/last pages, nearby pages, and conditional ellipses. `renderPagination()` creates previous/next controls with appropriate disabled states and page-click callbacks.

`getBattleKey()` prefers an ID and otherwise combines date/map/mode for animation comparison. It is an animation identity helper, not a database deduplication key.

#### Detail Rendering

`buildBattleCard()` creates an article, fills the card template, and attaches a detail callback carrying that record, dictionary, and language.

`renderDetailedMatch()` increments `detailRevision`, checks the content element, waits for its template, animates the list out, removes an older detail, and appends the selected detail. Latest selection wins when detail requests race.

The explicit **All battles** button animates details away and shows the retained list. It does not requery the database or rebuild pagination on every return. A local returning flag prevents duplicate back transitions.

Global history Escape/Z/mouse-back handlers close the history overlay; they do not invoke this local detail-to-list callback. Shared confirmation dialogs intercept their own back keys.

#### Animation State

First-page rendering with animation enabled distinguishes first presentation from a changed newest battle. Initial cards receive staggered rise classes at 60 ms intervals; a newly added first card uses a separate new-match animation and moves older cards according to its measured height plus gap.

`playPendingBattleListAnimation()` activates initial animations after the overlay is shown and removes temporary classes/styles through timers. `clearBattleListAnimations()` removes generated animation state during transitions.

`reset()` increments both revisions and clears initial/newest/pending state. It invalidates pending rendering without aborting its already running fetch/database request.

### Navigation and Native Window Integration

Source: [navigation.ts](src/modules/battleHistory/navigation.ts).

#### Footer Opening Scenario

`injectFooterButton()` adds one history entry to the native footer. A private `opening` guard ignores concurrent activation.

The click path shows a synthetic loader, temporarily hides eligible game UI, ensures the overlay, and renders page one. It then waits a deliberately random 500–3,000 ms transition period and checks that the same overlay still exists.

`openAsNativePage()` attempts native integration. If unavailable, the history's own header is restored and the overlay uses the full viewport. Pending card animations start after opening. Original visibility is restored, a short three-frame presentation wait completes, and `finally` clears the opening guard and loader even on failure.

The randomized loader is presentation logic. It does not represent a server download or the exact duration of IndexedDB access.

#### Native Settings Reuse

`openAsNativePage()` reuses a breadcrumb header or clicks a recognized Settings trigger and waits up to 3,000 ms for the header. `waitForSelector()` combines an immediate check, temporary observer, timeout, and cleanup.

The function replaces the visible title with the history title, saves/hides native settings content, hides history's own header, positions its overlay below the native header, applies the history background, and observes navigation.

`bindOverlayToHeader()` reads the header rectangle and updates top/height on opening and window resize. It does not independently track every possible header geometry change through a ResizeObserver.

`applyHistoryBackground()` stores the original inline background and its priority. `restoreContainerBackground()` restores that property or removes it when originally absent.

#### Release and Return Watching

`watchNativePage()` releases the view if the header disappears. A changed title or recognized shop/invitation/progress page closes history automatically and arms the return watcher.

`releasePage()` closes link/clear dialogs through their shared close method, hides history, restores background and saved native-content display, disconnects the page observer, and removes the resize handler.

`closeHistoryOverlay()` performs release, optionally arms return handling, and invokes native back when the title still identifies history. `flashHideSettings()` briefly covers the transition, with observer-driven and 2,000 ms fallback removal.

`armExitAfterReturn()` watches for the native Settings title for up to 20 seconds. On recognition, it installs a short loader and clicks native back after 150 ms. Loader observation/fallback avoids retaining that transition indefinitely. `disarmReturnWatcher()` clears its timers and observers.

The exported `release()` combines page release and return-watcher disarming. Account changes use it without deliberately navigating native back.

#### Shortcut Rules

`bindShortcuts()` installs listeners once. While history is open, Space and digits/numpad 1–7 are blocked outside input/textarea focus to prevent Enhanced Play interference.

Escape/Z close visible history unless a clear/link modal exists or input/textarea focus excludes handling. A mouse-button-3 listener also closes visible history. These feature-specific guards are not identical to the broader editable-control checks in Enhanced Play or the shared modal controller.

### Management Actions

Source: [actions.ts](src/modules/battleHistory/actions.ts).

`createActionButton()` uses text nodes and optional secondary styling. `createHistoryActions(account, renderBattleList)` returns four action callbacks.

#### Clear

`clearHistoryDb()` opens `showClearConfirmModal()`. Cancel only closes; one guarded confirmation closes the modal and calls the supplied async deletion action.

Deletion uses `account.getNickname()` at confirmation time, awaits `clearNicknameHistory()`, and then refreshes page one. Other accounts' records are retained. The modal's wording refers to all match history, but repository scope is the selected nickname's history.

Clear is not globally identical to link's account-snapshot handling: the deletion callback reads the account when confirmed rather than binding a nickname before modal creation. Navigation/account release closes existing management modals where its cleanup runs.

#### Link

`openLinkHistoryDialog()` updates identity and rejects `Unknown`. It reads nickname counts, excludes current/Unknown owners, and rechecks the account after asynchronous list/modal creation.

The dialog presents a target nickname and a source select. Empty source lists hide confirmation; an actual selection enables it. Confirm locks repeated activation and disables action controls while `mergeNicknameHistory()` runs.

Success closes the dialog, refreshes page one, and shows a delayed moved-count message. Failure restores actionable controls and shows a localized failure message.

Linking updates ownership in place. IDs and battle contents remain; source records are not copied. No separate undo record or friend/settings migration is created. An account check before confirmation prevents starting a transfer to a stale target, but an already started database transaction is not canceled by a later account switch.

#### Export

`exportHistoryData()` updates identity, snapshots the nickname, and reads its records. Empty results return without a file. Otherwise, it creates a readable JSON array in an `application/json` Blob, clicks a download link, and revokes the object URL in `finally`.

The filename is `Tanki_BattleHistory_<nickname>_<UTC-date>.json`. Exported records can include generated IDs, but import reconstructs them without those IDs. Export covers one nickname and does not include extension settings or all database owners.

#### Import

`importHistoryData()` creates a `.json` file picker and reads its first selected file with `FileReader`. The file extension filter is a picker hint; actual acceptance is determined by parsing and validation.

After `parseHistoryImport()` validates the entire array, `addBattles()` writes it atomically. The list then refreshes and a count message is shown. Reader, JSON, validation, or transaction errors go through `showImportError()` and a localized alert.

Ownership is preserved, so a valid foreign-nickname file can import successfully without appearing in the current list. Import does not invoke linking or deduplication automatically. The complete file is read into memory; no streaming import, size cap, or chunked validation is implemented.

### History Localization

Source: [localization.ts](src/modules/battleHistory/localization.ts).

`historyTranslations` defines RU/EN view labels and result wording. `getHistoryDictionary()` chooses RU only for exact `RU`, otherwise EN. Separate getters expose clear-dialog text, link-dialog text, and import/link status messages.

The dictionary includes functional values, not only headings: real non-breaking spaces for the back label, player/team labels, empty-state text, and functions producing count-bearing messages. Update both languages when adding a UI action or changing its meaning.

## Templates, Styles, and Assets

### Template Contracts

| Template | Consumer and structural contract |
| --- | --- |
| `templates/modal.html` | Shared modal controller; requires dialog, title, close, body, and action `data-kasp-modal-*` markers. |
| `templates/battle-history-overlay.html` | History facade; supplies standalone header, management action IDs, list, pagination, total count, and content host. |
| `templates/battle-history-card.html` | History views/presentation; supplies the map, result, combat, placement, loadout, mode, rewards, and date regions. |
| `templates/battle-history-detail.html` | History detail renderer; supplies the back button, result hero, and team tables. |
| `templates/welcome-modal.html` | Welcome controller; supplies release/credit placeholders, external project links, and `kasp-welcome-close`. |

Template markers and IDs are integration contracts. Renaming a class in HTML can break a query, privacy selector, animation, or event binding even when the markup still looks valid.

History template replacement has an explicit escaped-value/trusted-fragment boundary. Shared modal content primarily uses DOM construction. Welcome replaces controlled localization strings directly into its packaged template. These three paths have different trust and lifecycle rules.

### Stylesheet Responsibilities

The manifest declares 18 stylesheets at document start. `mainUI.css` also imports seven component styles already listed by the manifest; the current loading configuration therefore references those resources through both mechanisms.

| Stylesheet | Implementation role |
| --- | --- |
| `styles/mainUI.css` | Imports animations, shared presentation, garage buttons, navigation, header, battle statistics, and kill-board CSS. |
| `styles/shared.css` | Root color variables, loader background, shared game backgrounds, collection surfaces, and general UI treatment. |
| `styles/animations.css` | Button effects, metal shine, shared modal entrance/exit, and history card/list/detail transitions. |
| `styles/modal.css` | Shared modal overlay, dialog, body, actions, buttons, and opening/closing states. |
| `styles/battleHistory.css` | History layout, cards, detail tables, controls, pagination, equipment placeholders, and status presentation. |
| `styles/garageButtons.css` | Active/disabled button classes, mask presentation, and directional hover effects. |
| `styles/navigation.css` | Native navigation item geometry, hover, shine, and related visual rules. |
| `styles/header.css` | Header currencies, icon arrangement, and header presentation. |
| `styles/battleStats.css` | Native battle-statistics layout plus related equipment/resistance/skin presentation. |
| `styles/killBoard.css` | Result-table geometry, columns, headers, and kill-board layout. |
| `styles/augmentSpecs.css` | Specification controls, tooltip columns, and adjusted-value presentation. |
| `styles/customFriends.css` | Sidebars, category controls, rarity badges, and list arrangement. |
| `styles/customPaints.css` | Paint search input and collection layout. |
| `styles/customTrophies.css` | Favorite stars, limits, lobby trophy panel, and progress bars. |
| `styles/hideCurrency.css` | Masked currency/tooltip presentation. |
| `styles/hideNickname.css` | Immediate visual privacy, UID/self selectors, pseudo-labels, and hover reveal. |
| `styles/settings.css` | KASPERSKY tab, switch rows, highlight, and reload tooltip. |
| `styles/welcomeModal.css` | Welcome/project-link buttons and their interaction styling. |

Not every filename limits its rules to one feature; native selector styles can cross module boundaries. Many rules use `!important`, generated game class names, CSS masks, pseudo-elements, and modern selectors. Disabling a feature does not unload the manifest's global style resources.

### Dynamic Styles

Three notable dynamic presentation paths coexist with the static files:

- Enhanced Play installs one `kasp-playbtn-styles` element through `utils.injectStyle()`.
- Garage skins regenerate `kasp-skins-global-css` when the saved/base image mapping changes.
- Feature controllers assign inline positioning, visibility, mask, color, and sizing properties to observed or generated elements.

When debugging a visual conflict, inspect all applicable stylesheet, dynamic-style, and inline rules. An apparently unrelated shared or native selector can override a module-local declaration.

### Asset Inventory

| Asset | Use |
| --- | --- |
| `assets/background.png` | Custom game-loading background through the root CSS property |
| `assets/playButton.png` | Enhanced Play artwork and sliced button backgrounds |
| `assets/map-icon.png` | History map icon |
| `assets/modulesTAB.svg` | Resistance heading and expansion-control shield |
| `assets/icons/icon16.png` | Manifest icon, 16 px |
| `assets/icons/icon32.png` | Manifest icon, 32 px |
| `assets/icons/icon48.png` | Manifest icon, 48 px |
| `assets/icons/icon128.png` | Manifest icon, 128 px |

Other feature imagery often uses fixed game-hosted URLs or URLs stored in reference JSON. These are not all copied into `assets/`. Font families reference game-provided BaseFont/FallbackFont variants rather than bundled extension font files.

### Locale Resources

`_locales/en/messages.json` and `_locales/ru/messages.json` supply `extensionDescription` for the manifest. `default_locale` is `en`.

The in-game module labels live mainly in TypeScript dictionaries and are selected by `utils.getLang()`. Browser locale-message resolution and in-game language selection are separate mechanisms; updating one does not automatically update the other.

## Reference Database Contracts

### Paints

`database/paints.json` is an object keyed by exact image URL. Values provide lowercase-field `ru` and `en` display names. Search combines these names after normalization. Changing a game's image URL requires updating its lookup key even when its displayed name stays the same.

### Augments

`database/augments.json` provides `_shared` entries and a `devices` map keyed by exact artwork URL. Entries can refer to a shared description through `$shared`; DataLoader resolves it to the shared entry when found.

Descriptions contain RU/EN names, advantages/disadvantages, and optional nested `subItems`. Numeric `modifiers` use `STAT_DICT` identifiers. A narrative conditional effect is not automatically converted into a numeric modifier.

Stat recognition and modifiers must agree: adding a modifier under an unknown tag does not make the UI parser recognize it. Augment Specifications and Weapon Reload Indicator have separate calculation data; updating one does not update the other automatically.

### Maps

`database/maps.json` is an array of entries with `ru`, `en`, and image URL. DataLoader indexes both names case-insensitively after loading. Lookup trims incoming names; unrecognized names remain visible as original text.

Map artwork passes through the history image sanitizer before becoming a card background. A dictionary match can therefore provide a translated name while still falling back visually if its URL is unsupported.

### Skins

`database/skins.json` contains `names` and `defaults`. `names` maps localized equipment words to canonical identifiers; `defaults` maps those identifiers to stock artwork URLs.

Garage Skins uses its independently loaded copy for observation, fallback, and original-image matching. These are reference URLs, not a catalog of every owned or purchasable skin.

### Trophies

`database/trophies.json` maps searchable equipment words to entries with `id`, `ru`, `en`, and `type`. The same equipment can have multiple search aliases with the same canonical ID.

Trophy parsing scans for substring matches, and favorite limits use type values. Alias order and ambiguous names can matter because the first recognized match is used.

### Data Maintenance

Reference JSON is packaged verbatim. The build does not validate every database against a dedicated JSON schema or confirm live game URLs. Review syntax, field casing, identifier alignment, and lookup behavior when changing it.

Missing data can affect more than its immediate feature: the shared loader's all-or-nothing ready flag can keep paint search waiting when a different shared database fails. Independent skins/trophy loaders have separate failures and readiness states.

## Persistent State and Ownership

### Storage Inventory

All entries below belong to the game origin in the current browser/profile. No automatic cross-origin, cross-profile, or cloud migration is supplied.

| Key/store | Format | Owner and lifecycle |
| --- | --- | --- |
| Eight `k_*` feature keys | `true`/`false` strings | Origin-wide settings; cached by Core Settings services |
| `language_store_key` | Game-owned language text | Read for language selection; not an extension setting |
| `tankiCustomCategories_<nickname>` | JSON object: friend name to color | Per recognized account nickname |
| `kasp_trophies_favorites` | JSON array of ID/type/icon/current/max entries | Origin-wide favorites with private memory cache |
| `kasp_equipped_skins` | JSON object: canonical equipment to artwork URL | Origin-wide learned skin overrides |
| `kasp_base_images` | JSON object: equipment to original URL arrays; older strings supported | Origin-wide skin matching cache |
| `kasp_weapon_augment_tracker` | JSON configuration object | Origin-wide latest observed weapon/reload model |
| `kasp_my_equipment` | JSON object: turret/augments/hull plus `savedAt` | Origin-wide latest observed self icons |
| `kasp_tab_expanded` | Boolean string | Origin-wide resistance display preference |
| `kasp_last_version` | Manifest-version string | Origin-wide welcome acknowledgement |
| `kasp_last_nickname` | Nickname string | History's last recognized identity fallback |
| `kasp_player_changes_cache` | Session-storage JSON object: nickname to count | Session/battle observations |
| `TankiBattlesDB` / `battles` | IndexedDB records | Shared database, logical ownership through `nickname` |

### Ownership Consequences

Account-specific history and friend categories coexist with origin-wide presentation caches. Logging into another account does not automatically clear all those caches. Original identity reading and visual privacy must remain separate from storage ownership.

A nickname change does not rewrite historical owners or rename friend-category keys. History linking supplies only the battle-record transfer operation.

Origin changes include scheme, host, and port differences. A browser profile or embedded client can also provide its own storage context. Export/import moves history records; it is not a complete settings migration tool.

### Persistence and Reset

Page and extension reloads normally retain local storage and IndexedDB. Session storage follows the browsing session and has explicit battle-related cache clearing. Clearing game site data can remove history, settings, and unrelated native data together.

There is no all-state export, encryption layer, centralized cache reset, or universal cross-tab invalidation. When diagnosing a cache, identify its writer, reader, memory cache, and reset mechanism before assuming a direct storage edit will refresh an open UI.

## Events and Inter-module Dependencies

### Event Inventory

| Event | Producer | Consumer/effect |
| --- | --- | --- |
| DOM `childList` mutations | Native UI and extension DOM changes | Boot scheduling; targeted garage/statistics updates; feature navigation observers |
| Root `lang` change | Native page | Boot language refresh |
| `storage` for recognized setting key | Other same-origin contexts | Settings-cache invalidation |
| `storage` for `language_store_key` | Other same-origin contexts | Language/master-check scheduling |
| `message`, `kasp:useraction` | Injector action hook | Change Counter nickname/count extraction |
| `message`, `kasp:battle-kind` | Injector statistics hook | Content-script `__kaspBattleKind` |
| `message`, `kasp:battle-mode` | Injector statistics hook | No current source listener |
| Document `kasp:battle:id` | Not produced by current source files | Change Counter reset listener |
| Pointer/Space press/release | User input | Reload-indicator timing under pointer lock |
| Keyboard/mouse back controls | User input or Electron adapter | Feature-specific tooltip/modal/history/navigation handling |
| `resize` | Browser window | History overlay/header geometry refresh |
| `animationend` | CSS animations | Modal removal and history transitions |

Injector messages use `postMessage(..., '*')`. Current consumers classify payload content; they are not authenticated observations suitable as proof of server-side action.

### Principal Dependencies

| Dependency | Consequence |
| --- | --- |
| Account Identity → Friends/History/Equipment/Privacy | Original nickname text must remain readable. |
| DataLoader → Paint Search/Augment Specs/History Presentation | Reference readiness or matching controls the available output. |
| Injector → Change Counter/Battle Kind | Native fallback can load the game with incomplete tracking. |
| Equipment Tracker → History Capture | Recorded loadout quality depends on prior observation. |
| Shared Modal → Auto Upgrade/Clear/Link | Common back-input and closing behavior applies to these dialogs. |
| History Views → Navigation | Initial list animations wait until opening presentation is ready. |
| Native settings → Core Settings/History Navigation | Both features depend on native settings structure and closure transitions. |
| Boot → Automatic modules | A repeated-call, mutation-driven environment requires stable DOM writes. |

No module owns authoritative server state. The architecture combines local observations, packaged reference data, cached information, and native UI actions.

## Lifecycle, Concurrency, and Failure Boundaries

### Repeated Updates

Feature code uses several different repeat-control strategies:

- IDs/dataset markers prevent duplicate settings, controls, wrappers, and overlays.
- Signatures avoid repeated equipment, weapon, and garage-button work.
- Augment replacements preserve node identity and compare values before writing.
- Privacy metadata compares current attributes and watches a restricted attribute set.
- Resistance compact cells compare a derived state key.
- Settings and favorite data have private memory caches.

These are local mechanisms, not a universal virtual-DOM reconciliation system. Introducing unconditional node replacement or text assignment into an observed subtree can reintroduce feedback loops.

### Asynchronous Guards

| Mechanism | Protected operation | What it does not do |
| --- | --- | --- |
| `pendingModalIds` | Concurrent modal creation | Cancel an arbitrary in-flight resource request |
| `historyPagePromise` plus account snapshot | Duplicate/stale overlay creation | Validate every later native navigation event |
| `listRevision` plus owner/element checks | Stale history list completion | Abort IndexedDB reads |
| `detailRevision` plus content checks | Competing detail selections | Requery retained list on back |
| `resultGeneration` | Late capture failure affecting a new result | Persist uniqueness across reloads |
| Link dialog owner snapshots and action lock | Stale/repeated transfer initiation | Roll back a committed transfer after account switching |
| Injector `bundleIntercepted` | Duplicate bundle interception | Verify successful hook execution |
| Upgrade `isRunning` and waiting-for-close | Concurrent sequences and repeated confirmation | Confirm server-side purchase completion |

Do not describe a guard as cancellation when it only ignores stale completion. Existing requests can continue and database transactions can still commit.

### Timer Reference

| Timing | Purpose |
| --- | --- |
| 150 ms | Shared heavy-module throttle |
| 250 ms | Additional garage skin observation |
| 50 ms | Enhanced Play selection polling |
| 1,500 ms | Enhanced Play fail-safe |
| 30 ms | Upgrade action/dialog polling |
| 100 ms × up to 80 retries | Upgrade unavailable-control handling |
| 500 ms | Currency update loop |
| Two matching observations | Skin-learning stabilization; not a fixed time delay |
| 200 ms input hold threshold | Reload-indicator long-hold handling |
| 260 ms | Shared modal removal fallback |
| 700 ms | Temporary trailing back-input suppression in applicable dialogs |
| 500–3,000 ms | Deliberate history opening transition |
| 3,000 ms | Native history-header discovery timeout |
| 20,000 ms | History return-to-settings watcher limit |
| 5,000 ms | Additional first-activation history nickname refresh |

Animation durations and smaller UI-transition delays exist alongside these values. Timers can fire later under browser throttling, frame scheduling, or workload.

### Resource-Failure Differences

| Component | Current behavior on failure |
| --- | --- |
| Game bundle injector | Log and attempt one native script fallback. |
| Shared DataLoader | Log/store error; readiness remains false; no full-load retry loop. |
| Garage skin database | Log; retain the cached loading promise. |
| Trophy dictionary | Log and use an empty dictionary; ordinary initialization does not restart loading. |
| Shared modal | Release pending ID and propagate failure to its caller. |
| History overlay | Log; release creation promise so later preparation can retry. |
| History card/detail template | Drop failed cached promise and permit another request. |
| Welcome template | Log; page-session guard remains checked. |
| History transaction | Reject/abort as appropriate and close connection. |
| History capture write | Log and reopen capture only for the matching result generation. |

Many DOM misses are ordinary early returns, not exceptions. Missing anchors, unreadable artwork, or unsupported labels can yield incomplete UI without a single global failure message.

### Cleanup Ownership

Shared modals and history native-page controllers explicitly remove temporary listeners, observers, timers, and presentation changes. View transitions also remove animation listeners and have timeouts.

Boot, Enhanced Play polling, currency polling, reload animation/input listeners, and privacy observation primarily live for the page execution. There is no single disposal registry covering them all. Feature disable/reload and view close are different operations with different cleanup scope.

## Build and Packaging Implementation

Sources: [package.json](package.json), [tsconfig.json](tsconfig.json), [manifest.json](manifest.json), and [tools/build-release.js](tools/build-release.js).

### Type Checking and Bundling

TypeScript targets ES2020, uses ESNext modules and Bundler resolution, includes browser-extension types, sets `noEmit`, and currently has `strict: false` and `skipLibCheck: true`. Type checking is therefore a useful check, not a guarantee of exhaustive runtime validation.

esbuild consumes `src/kasp_main.ts` and `src/kasp_injector.ts`, bundles imports, outputs IIFEs to `dist/`, and targets `chrome100`. No source maps or declarations are produced through the current configured workflow.

| npm command | Implementation |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `build:js` | esbuild both entry points with bundle/IIFE/Chrome target flags |
| `build:zip` | Execute the Node release script |
| `build` | Type check → bundle → package |
| `release` | Invoke `build` |
| `watch` | Watch/rebundle both entries; no separate typecheck/package step |

For a source change, the ordinary verification/build sequence is:

```powershell
npm run typecheck
node --test tools/augment-specs.test.cjs tools/battle-history.test.cjs tools/battle-history-lifecycle.test.cjs tools/nickname-privacy.test.cjs tools/injector-auto-upgrade.test.cjs
npm run build
```

The build does not invoke regression tests automatically. Reload the extension and game page after regenerating bundles to execute them.

### Dependency Metadata

The current manifest, package, and lockfile package versions are 2.8.1. Dependency ranges still differ between the package manifest and lockfile root: `@types/chrome` `^0.0.260` versus `^0.3.0`, esbuild `^0.21.0` versus `^0.28.2`, and TypeScript `^5.4.0` versus `^7.0.2`.

`npm ci` can reject an inconsistent lockfile, and `npm install` can rewrite it. Review/reconcile dependency declarations when establishing a reproducible installation. The project does not declare a Node `engines` field; tooling requires APIs such as `fs.cpSync` and the built-in Node test runner.

### Release Script Functions

| Function | Responsibility |
| --- | --- |
| `log(msg)` | Write packaging progress with the `[build]` prefix. |
| `readVersion()` | Require `manifest.json` and its version field. |
| `sanitize(name)` | Replace Windows-invalid/control filename characters. |
| `rmIfExists(target)` | Recursively remove an existing generated target. |
| `copyDir(src, dest)` | Copy an available resource directory and report success; log/skip a missing one. |
| `copyFile(src, dest)` | Copy an available file and report success; log/skip a missing one. |
| `zipFolder(source, zip)` | Invoke Windows `tar -a` or non-Windows `zip -r`. |
| `main()` | Determine version, replace generated targets, copy configured inputs, check broad counts, archive, and log size. |

Configured directories are `dist`, `styles`, `assets`, `database`, `_locales`, and `templates`. Configured root files are `manifest.json` and `LICENSE.txt`.

For 2.8.1, the folder and archive names are `release/Kaspersky's Inventions 2.8.1/` and `release/Kaspersky's Inventions 2.8.1.zip`. The ZIP contains that outer versioned folder.

The script removes the existing same-version output before recreating it. It throws if no directory or no root file was copied, but does not require every configured input to exist. `build:zip` can package stale bundles or partial resources if invoked without appropriate preparation.

`README.md`, `DOCUMENTATION.md`, `src/`, regression tests, and dependencies are not included by the current packaging lists. `.gitignore` excludes `node_modules/`, `release/`, and ZIP files.

### Source and Generated Files

Implementation changes belong in `src/`; stylesheet/template/data changes belong in their resource directories. Do not repair an implementation only inside `dist/kasp_main.js` or the injector bundle. A later build would overwrite that repair and leave the source incorrect.

Documentation changes alone do not require bundling or packaging. Their checks concern source accuracy, paths, navigation, examples, and formatting.

## Regression Test Reference

### Harness

The five `.test.cjs` files use Node's built-in test/assert APIs, esbuild TypeScript transformation, and VM contexts. Fixtures supply targeted DOM/browser/storage/database behavior rather than running the live game.

This approach can verify deterministic state transitions and race handling without needing a real purchase or network-loaded game. It cannot prove every current native selector, stylesheet, browser policy, or server behavior matches the fixtures.

### Coverage by File

| Test file | Important scenarios |
| --- | --- |
| `tools/augment-specs.test.cjs` | Observer feedback settles; unchanged values reuse nodes; updated native values/devices do not compound multipliers; original display is restored; replaced/invalid/translated rows are handled. |
| `tools/battle-history.test.cjs` | Single-pass escaping; literal placeholder-like names; safe/spoofed image hosts; imported URL sanitization; stored card/detail markup; localized valid records; invalid shapes. |
| `tools/battle-history-lifecycle.test.cjs` | Account-scoped reads/clear/link; ID preservation; commit timing and rollback; capture completeness/retry/generation; sorting/pagination; stale accounts/views; back labels; animations; native and standalone opening; visibility/cleanup/return handling; dialogs; import/export; overlay retry/account switch. |
| `tools/nickname-privacy.test.cjs` | Original text/children/clan/XP remain; startup masking is synchronous; UID coverage preserves public parameters; account/language changes; identity fallbacks; friend/history ownership; disable/re-enable behavior. |
| `tools/injector-auto-upgrade.test.cjs` | HTTP/network/body failure fallback; original attributes; both hook patterns; same-batch interception guard; unknown-dialog stop; Ruby cancellation; normal count; disappearing confirmation. |

There is no `npm test` command. The explicit `node --test` invocation above runs the current files together. Tests target source code, so a passing source test does not demonstrate that a stale installed `dist/` has been rebuilt.

### Manual Verification Boundaries

Verify live browser changes against the affected screen and transitions: settings opening/closing, privacy insertion before display, garage item changes, cards/tooltips, native dialogs, result capture, history pagination, detail return, account switching, and native window closure.

Check a release's extracted contents as well as successful command output. Packaging success and typecheck success do not substitute for native-UI verification. When testing Auto Upgrade, account for the fact that recognized confirmation initiates actual spending.

## Maintenance Scenarios

### Adding a Configurable Feature

1. Add its exact key/default to the settings service and Core Settings definitions.
2. Implement its update function and private state under `src/modules/`.
3. Register it in `modules/index.ts` and choose the appropriate boot dispatch path.
4. Define repeat-update behavior and cleanup/reload semantics before adding observers or timers.
5. Update both language variants, relevant styles/resources, focused checks, and documentation.

A setting that only guards the entry function may leave import-time work or already-installed callbacks active. Decide those semantics explicitly.

### Extending Nickname Privacy

Use original identity text and CSS presentation rather than replacing names with Hidden. Add a startup-capable selector when the native structure provides a reliable self/UID marker. Use metadata for cases that require runtime classification, and compare before writing attributes.

Check that other players and public client parameters remain correctly classified, that native child nodes survive, and that history/friend ownership continues to use the real account.

### Updating Game Selectors

Update the corresponding feature-module binding in `src/core/gameDOM.ts`, then trace the affected element through core-service queries, CSS rules, templates, reference URL matching, and tests. A replacement native class can affect capture, presentation, and privacy simultaneously. The module registry does not rewrite CSS or core-service selectors automatically.

Preserve early-return behavior for absent UI. Do not assume the last recognized `state.currentScreen` proves every screen element is still attached during transitions.

### Changing History Records

Update `BattleData`/`PlayerData`, capture, validation, presentation, and templates together. Define behavior for older stored records and omitted optional import fields.

Only a schema/index change requires an IndexedDB version change; an added optional record field does not inherently require rebuilding the store. Preserve existing records during upgrades and await transaction completion before reporting success.

If an operation becomes asynchronous, snapshot the intended account/view and define whether it should ignore stale completion or cancel work. Do not implicitly reassign imported ownership or reuse external IDs.

### Adding Trusted Markup

Keep ordinary data in escaped placeholders or text nodes. Allowlist only fragments generated by controlled implementation code, with dynamic values already escaped and URLs sanitized.

Apply the same rendering boundary to old database records as to new imports. Import validation alone cannot protect records written before a fix or edited through other same-origin code.

### Updating Purchase Automation

Keep starting confirmation distinct from native confirmation recognition. Require a recognized native action, count only successful confirmation dispatch, wait for dialog closure, and stop on unknown state.

Adding labels or selectors requires checking Ruby recognition, eligible start controls, navigation interruption, and disappearing nodes. A visual dialog redesign does not automatically change or validate its purchase state machine.

### Preparing a Release

Align manifest/package/lockfile version metadata, reconcile dependency declarations when needed, run the relevant checks, regenerate bundles, and inspect the extracted archive. Retain earlier artifacts before replacing same-version output.

Update technical documentation when dispatch conditions, storage keys, schemas, function contracts, or lifecycle guarantees change. Update README and release notes for user-visible behavior.

## Implementation Limits and Project Terms

The implementation depends on observed native DOM, generated bundle patterns, known labels, exact artwork identifiers, and packaged reference snapshots. It cannot reconstruct unobserved events or guarantee compatibility with future game changes.

History stores local observations rather than server-certified records. Equipment and trophy data can be cached; reload estimates are input-based. Privacy masks presentation while original account information remains available to the page and local exports.

Origin storage is accessible to appropriately situated same-origin code and is not an encrypted account vault. Injector message payloads are client-side signals, not authenticated audit events. Safe history rendering is a targeted boundary and should not be interpreted as a universal sanitizer for every module's storage or markup.

The Chrome build target does not certify every Chromium/Electron version, and the Electron adapter is not a native installation system. Shared CSS and third-party UI modifications can interact through overlapping selectors and event handlers.

Project use and distribution are governed by [LICENSE.txt](LICENSE.txt), which contains proprietary terms and express Tanki Tweaks integration rights. The package's `ISC` metadata differs from that file and should not be interpreted here as granting additional rights.

---

Technical documentation aligned with the source implementation and manifest version **2.8.1**, updated **October 5, 2026**.
