# Kaspersky's Inventions - Technical Documentation  

## Complete Implementation Reference

**Extension version:** 3.0.5 (`manifest.json`)

**Documentation updated:** October 24, 2026

**Interface languages:** English and Russian

**Runtime:** Manifest V3 for Chromium and Firefox; TypeScript sources bundled as JavaScript IIFEs

**Project terms:** Proprietary; `package.json` and the lockfile root declare `UNLICENSED`. See [LICENSE.txt](LICENSE.txt).

This document describes the implementation currently present in the repository: execution order, module responsibilities, function contracts, state transitions, storage, rendering, and failure handling. It complements [README.md](README.md), which covers installation and user-facing operation. Names in backticks refer to actual files, symbols, selectors, events, or storage keys.

The source implementation is authoritative. `dist/` contains generated browser entry points and can differ from an unbuilt source checkout. Timings below describe scheduling choices in the code, not guaranteed execution times or server response times.

## Table of Contents

1. [Repository and Execution Model](#repository-and-execution-model)
2. [Startup and Update Scheduling](#startup-and-update-scheduling)
3. [Game Bundle Injector](#game-bundle-injector)
   - [Prepared Plans and Runtime Matching](#prepared-plans-and-runtime-matching)
4. [Shared Core Services](#shared-core-services)
5. [Settings Integration](#settings-integration)
6. [Feature Module Reference](#feature-module-reference)
   - [Lobby Navigation Tiles](#lobby-navigation-tiles)
   - [Account Search Notice](#account-search-notice)
   - [Lobby Pass Cards](#lobby-pass-cards)
   - [Enhanced Play](#enhanced-play)
   - [Cybersport Format Prototype](#cybersport-format-prototype)
   - [Augment Specifications](#augment-specifications)
   - [Paint Search](#paint-search)
   - [Friend Categories](#friend-categories)
   - [Trophy Favorites](#trophy-favorites)
   - [Auto Upgrade](#auto-upgrade)
   - [Nickname and XP Privacy](#nickname-and-xp-privacy)
   - [Currency Privacy](#currency-privacy)
   - [Garage Skins](#garage-skins)
   - [Weapon Reload Indicator](#weapon-reload-indicator)
   - [Critical Shot Indicator](#critical-shot-indicator)
   - [Overdrive Box Timer](#overdrive-box-timer)
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
16. [Additional Native Presentation Contracts](#additional-native-presentation-contracts)
    - [Supply Privacy](#supply-privacy-dom-and-webgl)
    - [Kill-Feed Privacy and Font Safety](#kill-feed-privacy-and-font-safety)
17. [Weather Rendering and Audio Reference](#weather-reference)
18. [Киллфид: исследование рендера](#kill-feed-rendering-investigation)
19. [Discord Companion Client Integration](#electron-client-integration)
    - [Box Pickup Visuals](#box-pickup-visuals)
    - [Supported Features versus Diagnostics](#supported-features-versus-diagnostics)
17. [Implementation Limits and Project Terms](#implementation-limits-and-project-terms)

## Repository and Execution Model

### Browser Manifest and Installation

The shared Manifest V3 declares both Chromium and Firefox support. `browser_specific_settings.gecko` contains add-on ID `kaspersky-inventions@tankionline.local`, `strict_min_version: "128.0"`, and `data_collection_permissions.required: ["none"]`. The latter declares no extension data collection; it does not disable local records, game traffic, or the optional Electron Discord bridge.

Both browsers consume `dist/kasp_injector.js` at document start in the `MAIN` world and `dist/kasp_main.js` as a separate content script. Existing `chrome.runtime` calls use the browser's extension API compatibility surface; there is no separate Firefox entry point or build command. The esbuild `chrome100` target remains a JavaScript syntax target, rather than the declared Firefox minimum or proof of full browser testing.

Chromium uses unpacked loading. Firefox local development uses **Load Temporary Add-on** and the inner `manifest.json` in `about:debugging#/runtime/this-firefox`; the temporary installation ends on browser restart. Persistent installation in standard Firefox requires a signed add-on. See the [installation workflows](README.md#installation), Mozilla's [temporary installation guide](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), and [signed distribution guide](https://extensionworkshop.com/documentation/publish/install-self-distributed/).

The release script creates an ordinary ZIP with a versioned outer folder and a second `-firefox.zip` with `manifest.json` at its root. Neither archive is a Mozilla signature; adding Gecko metadata or changing archive layout does not sign an XPI. Live verification should cover injection, packaged resource loading, settings, storage, navigation, and native battle HUD behavior in each supported browser.

### Source Layout

| Location | Responsibility |
| --- | --- |
| `src/kasp_main.ts` | Main content-script initialization |
| `src/kasp_injector.ts` | Page-world game script interception and instrumentation |
| `src/boot.ts` | Shared observation, screen detection, and module scheduling |
| `src/core/` | State, settings, identity, resource loading, shared dialogs, markup, and Electron adaptation |
| `src/core/gameDOM.ts` | Central native-game selectors, class names, IDs, and class fragments used by feature modules |
| `src/core/clientPatches.ts`, `clientLexical.ts` | Runtime plan validation, merging, hashing, shared searches, and lexical filtering |
| `src/generated/` | Fifteen prepared JSON plan sets embedded into the injector build |
| `src/modules/index.ts` | Imports and exposes the feature-module registry |
| `src/modules/*.ts` | Feature entry points and private module state |
| `src/modules/battleHistory/` | History repository, capture, validation, presentation, views, navigation, actions, types, and dictionaries |
| `src/types/window.d.ts` | Type declarations for the injector hooks and optional battle metadata |
| `templates/` | Packaged HTML skeletons |
| `styles/` | Static CSS loaded through the manifest and stylesheet imports |
| `database/` | Packaged reference snapshots |
| `assets/` | Extension-owned images, masks, and icons |
| `_locales/` | Browser-extension description translations |
| `tools/` | Offline AST analysis/preparation, release packaging, tests, and Electron bridge templates |
| Root `main.js`, optional `archived/` | Local analysis input and backups; neither is loaded or packaged |
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
6. Calls `setupDiscordPresence()` to send the nickname and screen to a compatible Electron preload bridge.

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

Boot orchestration remains page-wide. Feature-owned callbacks have separate failure scopes; see [failure isolation](#feature-failure-isolation). A page reload creates a new runtime.

### Screen Detection Priority

`performMasterCheck()` checks these DOM markers in order:

| Priority | Marker | Assigned screen |
| --- | --- | --- |
| 1 | `gameDOM.results.status` | `match_results` |
| 2 | `.ApplicationLoaderComponentStyle-container` | `loading` |
| 3 | `gameDOM.screens.garage` | `garage` |
| 4 | `gameDOM.screens.battleHud` | `battle` |
| 5 | `.MainScreenComponentStyle-blockMainMenu` | `lobby` |

When no marker matches, the previous screen remains selected. The order resolves overlapping DOM during transitions; it does not attempt to classify every possible game page.

Friends/invitations and settings are detected separately. Settings opening calls `coreSettings.inject()`; detected closing calls `coreSettings.onClose()`.

On a transition to loading or battle, the scheduler hides the augment tooltip and history overlay, closes the quick-upgrade setup dialog through its exposed close method, and closes or removes the clear-history confirmation. This transition handling is separate from history's own native-page cleanup.

### Dispatch Paths

| Path | Calls |
| --- | --- |
| Every heavy pass | `changeCounter.onTick`, `overdriveTimer.sync`, welcome, nickname privacy, Tankoin balance, account-search notice, currency privacy, garage skins and cybersport |
| Startup and mutation callback with lobby roots present; also language/screen transitions | Enhanced Play, then lobby navigation artwork/layout and lobby pass layout |
| Heavy pass while friends/invitations are open | Friend categories |
| Heavy pass in lobby/garage/results | Trophy favorites |
| Heavy pass in garage | Auto Upgrade, augment specifications, paint search |
| Every master check in garage | Garage button presentation |
| Every master check | Battle History |
| Every master check in lobby/results | Kill-board header synchronization |
| Mutation callback with native battle statistics present | Change indicators, resistance presentation, enemy-weapons popup synchronization and equipment tracking |
| Heavy pass with supported garage/loot-box markers | Augment specifications |
| Mutation callback with native garage action controls present | Auto Upgrade button presentation |

These paths can call the same module more than once around a single UI transition. Feature code must consequently tolerate repeated calls.

Lobby presentation does not wait for an animation frame or the 150 ms heavy pass. The mutation callback decorates newly mounted native roots/cards before paint, including staged mounts and returning from sections without a screen-classification change. When lobby roots disappear, navigation/pass adapters run once to release their previous sources; unrelated mutations outside the lobby do not run these adapters. Screen transitions retry presentation with the fresh state so Enhanced Play can resume after leaving battle.

`syncKillBoardDoubleHeader()` clones the existing table header when there is exactly one header row and adds `kasp-cloned-header`. It does not keep adding rows after the second header exists.

### Coalescing and Throttling

The master observer schedules at most one pending animation-frame master check through `isMasterUpdateScheduled`. Battle-statistics callbacks and Auto Upgrade presentation execute directly before that frame when their native controls exist. TAB and quick-upgrade buttons do not wait for the heavy-pass throttle. Batches containing only known extension statistics insertions or edits inside generated statistics content are ignored. The observer stays connected; native changes, mixed batches, summary-wrapper edits, and removals of generated cells from native parents still trigger normal processing. Other garage work uses the heavy pass; Auto Upgrade also retains its ordinary garage heavy pass for screen/language transitions.

`scheduleHeavyModules()` compares `performance.now()` against `lastFullRefresh`. If at least 150 ms have elapsed, it runs immediately; otherwise it schedules the remaining delay once. Screen or friends-menu changes reset the throttle state and run a heavy pass immediately.

The throttle flag is not a cancellation token for an already queued timeout. Clearing `refreshScheduled` does not call `clearTimeout` on the pending callback; additional work can still occur after a transition. This is another reason updates should be repeat-safe.

### Language Refresh

`applyLanguageChange()` resolves a new language and updates `state.lang` only when it differs. It resets heavy-refresh state and removes the custom settings tab, content, and reload tooltip before reinjecting settings if that window is open.

Other modules generally read `state.lang` when generating or updating their UI. Existing labels do not all have a dedicated language-change subscription, so not every visible component necessarily changes in the same frame.

### Error Boundary

Feature calls are independently guarded by `featureScope` through the module registry; the heavy pass no longer relies on one broad catch for a whole group. A synchronous failure in one entry does not skip later module calls. Scope-owned listeners, timers, frames, microtasks and observers use the same boundary. Returned promises register rejection handling; synchronous duration metrics do not measure the time spent awaiting a promise.

Three failures within ten seconds quarantine a scope for the current page and run its registered cleanups in reverse order. Slow calls only increase diagnostics. The default diagnostic threshold is 16ms; selected native animation/indicator scopes use 4ms. A callback that never returns cannot be preempted by this mechanism. Native errors outside guarded extension code remain native errors, and an accepted game action or committed transaction is not rolled back by cleanup.

Scopes expose separate diagnostics in MAIN and isolated worlds. Use the failure-isolation section and `MAINTENANCE.md` to distinguish setting-off, unavailable mapping, uninitialized state and repeated-error quarantine.

## Game Bundle Injector

Source: [src/kasp_injector.ts](src/kasp_injector.ts).

The MAIN-world injector installs augment, critical, presence, statistics, action, inventory, arcade-diagnostic, and bonus bridges, then registers the controlled loader in `src/core/gameLoader.ts`. A static network rule replaces the main-bundle response with the packaged `dist/kasp_game_gate.js` before the original code can run. There is no script-removal MutationObserver. Full Discord battle-presence instrumentation is selected for an Electron user agent. Account store capture also has a store-only profile for ordinary browsers; identity is not Electron-only. Supply privacy, box pickup visuals, kill-feed privacy and overdrive direction have independent prepared plans. Runtime behavior depends on the installed `dist/` build, not unbuilt source files.

### User Action Hook

`installUserActions()` supplies `window.__kaspSendAction(className, value, schema)`. Offline analysis maps `TankUserActionLog` and its player label fields. `readUserAction()` reads mapped own data descriptors without traversing unrelated graphs or invoking getters. It requires the expected class name, a trimmed nickname of 2–29 characters, and an uppercase action identifier. Valid optional team relation is included. The existing message contract is retained:

```ts
{ type: 'kasp:useraction', detail: ['TankUserActionLog', nickname, action, /* optional relation */] }
```

Native initialization is retained and observer failures are guarded. This is a client observation, not an authenticated server action log. Change Counter applies its own nickname filter and counts only observed `CHANGE_EQUIPMENT` messages.

### Battle Statistics Hook

`installBattleStatistics()` supplies `window.__kaspBattleStats(value, schema)`. AST analysis maps semantic `BattleStatistics` fields. `readBattleStatistics()` requires `battleLoaded === true` and reads own descriptors. Boolean `isMMBattle` determines `MM`/`PRO`; missing PRO text is not evidence of matchmaking. Known modes are `DM`, `TDM`, `CTF`, `CP`, `SGE`, `RGB`, `JGR`, `TJR`, `ASL`, and `AR`, with a mapped map-name suffix as fallback.

Only confirmed fields produce `kasp:battle-mode` and/or `kasp:battle-kind`. Unloaded defaults or unrelated strings do not overwrite the current kind. Battle History capture separately still defaults to `MM` when no `__kaspBattleKind` exists; existing records are not retroactively corrected.

The current Change Counter listener copies battle kind into its content-script world. There is no corresponding `kasp:battle-mode` consumer in the current TypeScript sources; capture parses mode from the result header instead.

### Interception and Transformation

1. `rules/game-bundle.json` redirects script and fetch/XHR requests only for query-free `main.<hash>.js` under `/static/js/` or `/browser-public/static/js/`, from Tanki initiators to EU/RU game CDNs and EU/RU test domains. Fetch/XHR is required because the game's NetworkFirst service worker fetches the script internally using that network resource type. Other URLs and query-bearing main requests are excluded. The manifest declares `declarativeNetRequestWithHostAccess`, Tanki host access, and the gate as a web-accessible resource; no extension background worker is needed.
2. The small gate calls `window.__kaspGameLoader.load(originalElement)`. The original game response has not executed. Duplicate gate calls are ignored by the per-document state machine; the injector is idempotent too.
3. Modules, integrity-bearing scripts and unsupported script types use an original external script with a `ki_native=1` query bypass. Recovery copies native attributes, `async`, nonce and type. If the injector never initialized, the gate itself requests that native bypass once.
4. For supported classic scripts the source is fetched as text through the `ki_native=1` query bypass, preventing the rule from redirecting the loader's own fetch. The reported source remains the original URL. Non-success HTTP status throws before reading its body; empty text is rejected.
5. Select each available prepared plan against the original source: source length/SHA-256 for known builds, AST-derived compatibility templates otherwise.
6. Report and isolate preparation failures; validate and merge accepted plans against original offsets. Reject stale or conflicting plans individually.
7. Append a classic inline script carrying the original type/nonce and merged text. A strict-mode-preserving entry marker and completion marker distinguish a policy/parse rejection from a partially executed game. The source is not wrapped in a new function or block. Real game load/error completion is forwarded to the original element; the gate's early load event is suppressed.
8. Release the one-source analysis context in preparation's `finally`, including late cancellation. Preparation checks its abort signal after asynchronous plan selection. Query-bearing main scripts and requests that bypass network rules execute natively and are never copied after a DOM observation.

Template misses leave the affected instrumentation absent. Required roles and expected match counts must resolve before a feature is installed. This is preflight compatibility checking, not a full runtime AST parse or proof of later native execution.

### Prepared Plans and Runtime Matching

Sources: [clientPatches.ts](src/core/clientPatches.ts), [clientLexical.ts](src/core/clientLexical.ts), and [src/generated/](src/generated).

| Plan set | Runtime selector | Native contract |
| --- | --- | --- |
| `overdrive.json` | `selectBonusPatchPlan` | Pickup method/calls, pooled registration, bonus/vector prototypes |
| `arcade.json` | `selectArcadeReloadPlan` | Local weapon HUD, bar/material/layout, Shaft/Scorpio telemetry |
| `augments.json` | `selectGameAugmentsPlan` | Model cache writer, device/property/description/upgrade data, image resources |
| `garage-details.json` | `selectGarageDetailsPlan` | Native unavailable augment/skin/shot-effect selection and descriptions |
| `garage-items.json` | `selectGarageItemsPlan` | Existing unavailable item images, grayscale treatment, native selection |
| `garage-inventory.json` | `selectGarageInventoryPlan` | Read-only inventory diagnostics; no hidden-item insertion |
| `battle-presence.json` | `selectBattlePresencePlan` | Native DI store getters for account identity in all clients; complete store/capacity profile for Electron presence, with a store-only fallback |
| `battle-statistics.json` | `selectBattleStatisticsPlan` | Statistics constructor and loaded battle metadata |
| `user-action.json` | `selectUserActionPlan` | Action constructor and mapped player/action fields |
| `critical.json` | `selectCriticalPlan` | Critical readiness, shots, lifecycle, damage, Supercharge, equipment, local HUD |
| `overdrive-direction.json` | `selectDirectionPlan` | Independent local tank position/camera bearing and lifecycle |
| `supply-privacy.json` | `selectSupplyPrivacyPlan` | Four native supply-count text renderers |
| `box-pickup.json` | `selectBoxPickupPlan` | Native pickup animation, pooled box rendering and completion |
| `kill-feed-privacy.json` | `selectKillFeedPrivacyPlan` | Action-log text measurement, glyph atlas, geometry input and dirty refresh |

Plans store `format`, `sha256`, `sourceLength`, `status`, guarded `edits`, and `templates`, plus feature schemas/profiles. Each edit uses original offsets, `expected` text, and up to 24 characters of context on each side. Templates store patterns, shared-role captures, counts, bounded search anchors, and generated insertion parts. Captured identifiers and role agreement are validated; quoted data uses JSON serialization. Temporary identifier collisions are avoided.

`clientSourceHash()` caches one digest promise per current source. `codeOffsets()` and `resolveTemplateEdits()` share a lazy lexical filter and anchor cache. One source is retained, anchor entries are bounded, and the injector releases the context after preparation. This cache is transient and unrelated to persistent garage items.

`createCodeOffsetGuard()` excludes comments, strings, regex literals, and template raw text while retaining substitutions as code. It tracks control parentheses, expression/block endings, labels/case heads, and line terminators to distinguish regex from division. It is a lexical filter, not a complete ECMAScript parser; new syntax remains a maintenance boundary.

`mergeClientPatchPlans()` validates complete plans and isolates conflicts. Multiple zero-length insertions at one offset are allowed because independent headers and HUD observers share legitimate locations. `clientPatchHeader()` preserves native top-level strictness before configuration statements; adaptive augment and critical headers use it.

Hash mismatch triggers template matching rather than immediate disablement. Compatible changes can relocate hooks without new mappings. Missing or ambiguous contracts skip the affected interception. Runtime errors after insertion are outside this preflight guarantee.

### Recovery and Limits

`readGameBundle()` gives combined fetch/body reading a 15-second deadline, aborts on expiry and settles even if fetch ignores abort. Preparation has a separate 15-second deadline and cancellation signal. All settled phases release their timers. Before the execution marker has run, HTTP/body/preparation/insertion failures and blocked or unparseable patched scripts request one native bypass. Late responses/preparation completions cannot launch a patched copy after recovery. The native resource's own failure is terminal; it is not retried in a loop.

Once the entry marker has run, an exception records a terminal failure without replaying native code: earlier side effects cannot be rolled back. Later asynchronous/render errors likewise do not trigger a second startup. Native fallback retains the game without guaranteeing instrumentation. The state snapshot is `window.__kaspGameLoader.status()` (`phase`, `source`, `reason`, `entered`, `completed`, `nativeFallback`). In native mode, `completed` reflects a load event, not server connectivity. Content-Security-Policy and integrity remain enforced. The game's NetworkFirst worker is covered without unregistering it or deleting its caches. Platforms without the network-rule API, cache-only service-worker responses that never fetch, query-bearing bundles and unsupported contracts may run without AST instrumentation. Live Firefox/Electron compatibility and actual game connectivity require separate checks; Edge fixture tests are not a live-account verification.

## Shared Core Services

### Settings Cache

Source: [src/core/settings.ts](src/core/settings.ts).

`SETTINGS_KEYS` defines fifteen boolean keys. At import time, thirteen are read with default `false`; `k_arcade_reload` and `k_critical_indicator` default to `true`. Values are cached in `settingsCache`.

| Function | Contract |
| --- | --- |
| `readSetting(id, def)` | Return `def` for an absent key; otherwise return whether its stored text is exactly `true`. |
| `getSettingRaw(id, def)` | Return a cached value when available; otherwise read, parse, and cache it. |
| `setSettingRaw(id, value)` | Write `true`/`false`, update the same-world cache, and dispatch `kasp:settings-changed`. |
| `invalidateSetting(id?)` | Remove one cache entry or clear the entire map. |

The storage listener invalidates only recognized, non-null keys. A `storage` event whose key is `null`, such as a storage-wide clear, does not invalidate all entries through this listener. Same-document changes should use the provided setter; direct writes do not automatically update its cached value.

The settings helpers do not generally catch storage-access errors. Language resolution and several record/cache modules have their own catches, but these do not make all storage access failure-safe.

### Utility Functions

Source: [src/core/utils.ts](src/core/utils.ts).

`utils.getLang()` resolves RU/EN in this order: a recognized prefix in `language_store_key`, a matching HTML language attribute, `ru.` in the hostname, then EN. Only the local-storage lookup is enclosed in its small catch.

`utils.getSetting` and `utils.setSetting` expose the raw cache helpers. `utils.injectStyle(css, id)` avoids adding a second element with the same ID, sets CSS through `textContent`, and appends to the head immediately or after `DOMContentLoaded`. It does not replace an existing style element's contents.

### Shared Reference Loader

Source: [src/core/dataLoader.ts](src/core/dataLoader.ts).

An import-time `readyPromise` concurrently fetches paints, maps, and skins from packaged URLs. Every response is checked before parsing. The loader creates lowercase Russian/English lookup maps for map entries. Augment lookups delegate to the independent current-session catalog; `database/augments.json` is not fetched or resolved.

`state.ready` becomes true only after the complete sequence succeeds. Errors are recorded in private `state.error` and logged. The catch consumes the rejection, so awaiting `readyPromise` is not equivalent to asserting success: callers should check `isReady()` or the relevant lookup result.

| Method | Result |
| --- | --- |
| `isReady()` | Whether the whole shared load completed successfully |
| `getPaint(url)` | Paint entry by exact artwork URL, or `undefined` |
| `getDevice(url, element?)` | Current-session augment presentation by bound object ID, or unambiguous artwork fallback |
| `hasDevice(url, element?)` | Whether that runtime lookup succeeds |
| `translateMap(rawName, targetLang)` | Localized name, retaining the original when unmatched |
| `getMapInfo(rawName)` | Matched RU/EN map entry, or `null` |
| `getSkinsData()` | Parsed skins data, if available |

The shared loader does not automatically retry a failed full load. Individual feature modules also load skins and trophies independently; they do not all share this promise or readiness boundary.

### Game Augment Catalog

Sources: [src/core/gameAugments.ts](src/core/gameAugments.ts), [src/core/augmentCatalog.ts](src/core/augmentCatalog.ts), and [src/core/augmentLabels.ts](src/core/augmentLabels.ts).

#### Decoded Model Observation

`installGameAugments(window)` runs in MAIN world before the game starts. Offline [tools/ast/augments-ast.cjs](tools/ast/augments-ast.cjs) maps fields from `DevicePropertiesCC`, `DevicePropertyEntity`, `DescriptionModelCC`, `GarageDeviceObject`, and upgrade diagnostics. It uses AST scope rather than an obfuscated constructor name alone. `selectGameAugmentsPlan()` selects an exact or compatible plan; `patchGameAugments(code, report, plan)` validates and applies it without rediscovering the full schema at runtime.

The offline analyzer requires a unique native model-cache writer associated with its context reader and object-ID getter. Unrelated map writers and shadowed lexical classes are excluded. The generated wrapper executes the original cache write once, preserves its result, and calls the guarded data observer afterwards. A matching device DTO constructor gets a separate device/base-item association callback. Unsupported or ambiguous contracts produce no partial plan. Fixed legacy method names are not a fallback.

The collector calls the mapped object-ID method. IDs are decimal strings preserving 64-bit identity. Description and property models may arrive in either order and are joined by ID. Kotlin collections still use the native `t()`, `u()`, and `v()` interface to create detached records of `operation`, `property`, and finite `value`; changes to that interface require maintenance. Empty lists are valid. Description-only entries remain private until properties arrive.

This observes the game's normal model initialization rather than decoding WebSocket bytes independently. The `devicesLoaded` list is not assumed to contain the actual property values. No additional server requests or periodic downloads are made by this feature.

The same cache observer captures `UpgradeParamsCC` independently of device entries. Optional discovered fields identify its current level and item data, `UpgradeParamsData` groups and level count, `GaragePropertyParams` nested raw properties, and `PropertyData` initial/final values. `readEquipmentProperties()` applies the inspected game's raw calculator: `initial + (final - initial) / upgradeLevelsCount × currentLevel`; a zero level count retains the initial value. This calculation precedes GUI aggregation, unit multipliers, and rounding. Invalid levels or non-finite values reject the base; conflicting duplicate raw properties are excluded. An invalid replacement clears a previously captured base rather than reusing stale values.

#### Identity and Presentation

The binder scans native skin-cell images and the selected-device icon. When `k_augments` is enabled, relevant DOM insertions and `src`/`class` changes trigger binding and a one-second scan catches delayed React changes. Disabling disconnects that observer and clears the scan interval; model callbacks still retain one-time game data. Debug page export can explicitly force a scan while disabled.

`closestReactProps()` selects the committed React tree through its root's `current` pointer and uses the alternate fiber when needed. Traversal is bounded; getters and ambiguous IDs are rejected. `findAugmentIdentity()` binds only a known device with captured properties. Seen artwork/base IDs, exact preview resources, and rarity are added to its entry. On skins/shot-color tabs, localized unknown-card props provide separate `data-kasp-cosmetic-*` attributes; standard/owned cards are excluded. Section identity follows the active tab rather than translated text. Possible Rewards receives no module controls or decorations.

The isolated-world catalog indexes exact device/equipment IDs and normalized artwork paths. EU/RU asset host changes can share a path. When a bound ID exists, a known artwork mismatch is rejected to avoid displaying old values on a recycled card. URL-only lookup succeeds only when all candidates have identical modifiers, metadata, and equipment baselines; equal empty numeric lists do not justify merging different conditional effects. Names are never used as unique keys.

`presentGameAugment()` derives RU/EN labels, advantages, disadvantages, internally unclassified parameters, and supported live multipliers. The dictionary covers the 227 protocol enum entries in the inspected game bundle. Separate higher-is-better and lower-is-better rules classify critical chances, heat/freeze strength, reloads, salvo intervals, Tesla and Shaft mechanics, projectile speeds, resistances, and other recognized properties. Tactical or unknown directions are not inferred solely from their sign.

`DELTA_PERCENT` remains a signed percentage and converts to `1 + delta / 100` only for recognized numerical rows. Conflicting composite values, incomplete damage ranges, duplicate parameter entries, and absolute overrides do not produce a live multiplier. An `OVERRIDE_VALUE` can be classified only when `baseItemId` resolves to that equipment's raw baseline for the same property. Its comparison is displayed as `base → replacement`, using percentage notation for ordinary critical probabilities. Negative probability sentinels are excluded from arithmetic classification, and a small relative tolerance prevents Float32 noise from creating false changes.

Server descriptions and names remain in captured metadata for inspection and collision checks. The description's first paragraph is rendered above the comparison columns when its locale matches the UI; a mismatch shows a localized reload prompt. It remains available even when the device has no numeric modifiers. RU/EN parameter labels switch locally. Unknown directions, unavailable baselines, and special sentinels enter the internal `neutral` array and appear under “Other parameters” only when that array is nonempty. Zero percentage deltas and confirmed unchanged replacements are excluded from presentation, including the neutral section. All raw properties remain in the JSON.

#### Bridge and Session JSON

Updates are coalesced over 100 ms. Before publishing, the collector binds currently mounted cards so late properties/metadata can populate an open section without a new DOM insertion. A `finally` resets the queue flag and publishes even if binding fails. Relevant DOM changes publish a changed catalog immediately; if metadata is unchanged they dispatch `kasp:augment-cards-updated`, refreshing display without persisting another identical full snapshot.

`kasp:game-augments-request` obtains the current snapshot for a late listener. `validateAugmentSnapshot()` checks format, revision, IDs, locale, properties, finite values, artwork, rarity, equipment baselines, and limits. The isolated catalog accepts increasing revisions from its first accepted session and emits `kasp:augments-updated`.

`AugmentSnapshot` uses this contract:

```ts
{
    format: 'kasp-augments-v1';
    session: string;
    revision: number;
    updatedAt: number;
    hooked: boolean;
    devices: Array<{
        id: string;
        baseItemId?: string;
        name?: string;
        description?: string;
        locale: 'RU' | 'EN';
        icons: string[];
        previewIcon?: string;
        rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
        properties: Array<{
            operation: 'DELTA_PERCENT' | 'OVERRIDE_VALUE';
            property: string;
            value: number;
        }>;
    }>;
    equipment?: Array<{
        id: string;
        currentLevel: number;
        properties: Record<string, number>;
    }>;
}
```

On each page load, the isolated catalog starts empty and writes an empty reset JSON without loading any earlier file. Accepted snapshots replace `kasp-augments.json` through OPFS and are also serialized under `kasp_augments_session_json` in `sessionStorage`. The write loop orders writes and coalesces pending updates to the latest content. An unavailable file API, denied storage, or failed write does not prevent the in-memory catalog from working; session storage is independently attempted. The OPFS file belongs to the game origin, not the extension's installation directory. Across multiple tabs, the origin-wide file contains the last successful writer's snapshot while each tab maintains its own catalog.

`window.__kaspAugmentsDebug.status()` reports hook recognition, device count, equipment-baseline count, and revision. `export()` returns the current MAIN-world snapshot as formatted JSON for inspection or `copy(...)`. The source-side isolated catalog also exposes `AugmentCatalog.storageStatus()` with the latest file error. A recognized hook and populated cache do not prove that all card structures resolve correctly in the live game. Older snapshots without `equipment` remain structurally readable but cannot classify absolute replacements.

#### Manual Classification Rules

For unavailable cards, `findAugmentPreview()` resolves the exact device's React `icon`/`iconUrl` or `GarageDevice.previewImage` resource. The URL method and generated DTO fields are discovered from the bundle. Only HTTPS game-host URLs and corresponding blob URLs are accepted, and conflicting candidates are rejected. The collector publishes an optional `previewIcon`; Augment Specifications replaces only native `unavailable` images with a grayscale preview. Original URLs are retained for catalog lookups and restoration. Image errors restore the question mark and suppress repeated retries of that URL for the module lifetime. Native card changes remove the grayscale class, and disabling the module restores its replacements.

Source: [src/core/augmentRules.ts](src/core/augmentRules.ts). Configuration: [database/augment-rules.json](database/augment-rules.json).

The isolated catalog fetches this packaged JSON once per page, checks the HTTP response, and parses its `rules` array independently of session observations. `parseAugmentRules()` accepts up to 10,000 entries. A rule requires a decimal device `objectId` string of 1–20 digits, a `property`, and a `status` equal to `better` or `lower`. `properity` is accepted as an alias when `property` is absent. Protocol identifiers are preferred; `resolveAugmentProperty()` also resolves an exact, case-insensitive, whitespace-normalized RU/EN label only when it identifies one property. Ambiguous labels and invalid entries produce warnings and are skipped. Duplicate device/property keys use the last valid entry. The separate `example` object is never applied.

```json
{
  "rules": [
    { "objectId": "123", "property": "HULL_MASS", "status": "better" },
    { "objectId": "123", "property": "SHOT_RANGE", "status": "lower" }
  ]
}
```

Rules are indexed by device ID and protocol property. `better` forces Advantages and `lower` forces Disadvantages, regardless of the numeric sign or availability of a baseline. An explicitly assigned zero delta or unchanged absolute value is retained in the chosen column. Raw session JSON, description text, and live numeric multipliers are unchanged. Rules cannot create a property missing from the captured device. Shared-artwork fallback also compares manual statuses, preventing a rule for one device from being applied to another candidate. Rule loading emits the existing `kasp:augments-updated` event so a tooltip can refresh even when no new game snapshot arrives. A failed fetch or invalid JSON leaves automatic classification available; an empty rules array uses automatic classification throughout.

Changes to this file require reloading the installed extension and game page. JSON-only edits do not require a JavaScript rebuild. The file is separate from the automatically replaced OPFS session snapshot and is never overwritten by the collector.

#### Current Device Page Export

```js
copy(window.__kaspAugmentsDebug.exportPage())
```

`page()` returns a detached object; `exportPage()` returns its formatted JSON. Before exporting, the MAIN-world collector refreshes exact React card associations and scans the current augment card images. Cards without layout are excluded, repeated device IDs are deduplicated, and unconfirmed cards are listed under `unmatchedCards` rather than guessed from artwork. Every exported device includes its `objectId`, available `baseItemId`, captured metadata, and properties with canonical IDs, RU/EN labels, operations, raw values, and available base values/current equipment level. The format is `kasp-augment-page-v1` with a capture timestamp.

The export covers rendered cards on the currently open page. Virtualized cards absent from the DOM require scrolling and another export. It does not request additional server data. Use device `objectId` plus property identifier when preparing a manual rule; `baseItemId` identifies equipment and is not the rule's device key. `export()` remains the separate whole-session diagnostic export.

### Native Garage Details, Items, and Inventory Diagnostics

Sources: [garageDetails.ts](src/core/garageDetails.ts), [garageItems.ts](src/core/garageItems.ts), [garageInventory.ts](src/core/garageInventory.ts), and their `tools/ast/*-ast.cjs` analyzers.

The description plan adjusts native unknown-item gates only while `k_augments` is true, allowing the game's original selected-device/skin/shot-effect description prefix to execute. It substitutes actual native previews and grayscale treatment for unavailable items. Purchase/mounting closures remain outside that templated prefix; showing information does not grant ownership or equip permission.

The item plan affects already existing garage cards: it permits their native preview and selection for supported unavailable non-paint items while enabled, then applies grayscale to unavailable artwork. It does not enumerate hidden/secret inventory into the UI. Paint special cases and disabled-setting behavior retain their native guards.

`installGarageInventoryDiagnostics()` captures an inventory reference/schema through a guarded hook. Calling `window.__kaspGarageInventoryDebug()` reads it on demand, returning counts and detached item rows including ID, name, categories, description, owned/buyable/visible/secret flags, preview and `renderedInDOM`. Reading is capped at 20,000 entries, invokes mapped collection/resource methods, and reports partial results on error. Unlike descriptor-only readers, this diagnostic can execute native getters/methods. Virtualization means `renderedInDOM` is not ownership or whole-page availability. There is no periodic inventory scan, hidden-item display switch, or purchase/ownership change.

### Account Identity

Source: [src/core/accountIdentity.ts](src/core/accountIdentity.ts).

`parseAccountIdentity(text)` trims the display name, extracts an initial bracketed clan tag, removes that prefix from the nickname, and returns `{ nickname, clanTag, displayName }`. Empty nickname text returns `null`.

`getAccountIdentity()` checks the native header first, then client information parameters matching `UID:`, then the current player's result-row name. It reads current original text each time rather than keeping a global account cache.

Identity is separate from presentation. `getAccountIdentity()` reads display text and never supplies storage ownership. `setupAccountIdentity()` starts at document start and receives same-window/same-origin snapshots. `getVerifiedAccount()` returns the verified native account cached for the current page, consistent with any visible account name. Delayed or throttled heartbeats do not expire this ID. An explicit empty native snapshot, a new account or cleanup clears/replaces it; logout reloads the page, and a new page must establish native ownership again. `getPlayerUserId(nickname)` still requires a snapshot within five seconds to resolve the currently displayed friend from native remote-user data; ambiguous names return null. Nickname hiding preserves the original text.

Sources: [accountId.ts](src/core/accountId.ts), [accountIdentityNative.ts](src/core/accountIdentityNative.ts). The MAIN-world identity module is installed before the battle-presence/store-capture consumer. Independent supply/box scopes are initialized earlier, but local account discovery has priority over remote-player discovery once the store is captured. The bridge captures the native DI store through the existing prepared store-getter hooks. Capture schedules discovery in the next task with a zero-delay timer, without traversing the graph inside the game hook or waiting for the one-second heartbeat. Discovery yields between models and properties, with at most 64 generator steps and a soft 2 ms budget per slice, separated by 8 ms timers. Individual reflection operations cannot be preempted. The local search stops at identity models, examines up to 4,000 objects at depth 4, and caches paths, model references and semantic field keys. Loaded local `User.id`, `uid`, and `clanTag` establish ownership; remote data and matching nicknames cannot. Once found, the account is read directly without another graph/prototype scan. This cache lives only in the current page; nothing restores ownership from a stored nickname or an old persisted ID. Missing models retry after one second, unloaded properties are polled directly, and replaced paths or stores invalidate the old owner. Login without a page reload is supported.

Before the general search, an incremental fast path checks the store itself or its direct slots (up to 32) for one native `TOState`. Its semantic `user` field must point to a `User`; the path and schema are cached, and the loaded account publishes before the remaining graph is walked. Aliases of the same state are deduplicated; distinct states fall back to the general search. No generated property name is hardcoded. If the cached User becomes loaded between heartbeats, the next capture of the same store publishes it immediately without another search. An absent or changed native layout uses the bounded general search above.

The account publishes before secondary friend discovery. `RemoteUserData` IDs are gathered separately in bounded slices (depth 5, up to 6,000 objects); ordinary scans wait five seconds after completion. A same-page `kasp:account-identity:request` with boolean `refreshPlayers: true` can bypass that interval when a friend menu needs an ID, limited to once per second per reader. It reuses the same bounded incremental scan and does not interrupt one already running. A missing remote storage is rediscovered at five-second intervals without blocking the account. Unreadable native objects are skipped and recorded in diagnostics rather than repeatedly disabling the feature. Exact decimal strings preserve 64-bit IDs. No network request or root client-file read is involved. Snapshots publish once a second, on requests, when the fast path establishes the owner, and on discovery completion; Discord activity remains Electron-only. `window.__kaspAccountDebug.status()` exposes the cached account, discovery progress (including `direct`) and runtime status without a deep scan. Explicit `window.__kaspAccountDebug.inspect()` retains the bounded synchronous model diagnostics without passwords/tokens. Cleanup cancels discovery timers, the heartbeat and the request listener, and publishes an empty identity.

### Shared Modal Controller

Source: [src/core/modal.ts](src/core/modal.ts), template: [templates/modal.html](templates/modal.html).

`createKaspModal({ id, title, closeLabel })` is asynchronous and returns a `KaspModal` object or `null` when that ID is already present or pending. `pendingModalIds` closes the race between simultaneous calls before a template has loaded.

The controller checks the HTTP response, requires a root element and all dialog/title/close/body/action markers, assigns a unique title ID for `aria-labelledby`, and inserts the overlay into the body. Title and close-label values use text/attribute assignment rather than HTML interpolation.

Returned members expose the overlay, dialog, body, action container, close button, `close()`, and `onClose(listener)`. Callers add their own content and confirmation actions.

The controller supports Escape, Z outside input/textarea/select controls, the mouse back button, the close button, and clicking the backdrop. Mouse forward events are blocked without closing. Remaining back/forward mouse-up, click, and auxiliary-click events are suppressed for 700 ms after the mouse action.

`close()` is idempotent. It removes global listeners immediately, changes the opening/closing classes, invokes close subscribers, and removes the overlay on the dialog's animation end or after a 260 ms fallback. Closing twice does not rerun subscriber actions.

Pending IDs are released in `finally`, including template failure. Resource errors are propagated to the caller. The controller supplies ARIA dialog semantics but does not implement a complete focus-trapping or focus-restoration system.

### Discord Rich Presence

`src/modules/discordPresence.ts` uses the shared Electron detector and sends versioned `kasp:discord-presence` messages every three seconds. It stays inactive in ordinary browsers. `pagehide` clears activity; `pageshow` resumes the heartbeat. Labels are English; a recognized battle uses translated map plus mode. `state` is the account nickname, `Hidden` while nickname privacy is enabled, or `Signing in` without identity. Settings/storage changes refresh privacy immediately at the extension layer; client RPC coalescing still applies.

The MAIN reader in `battlePresence.ts` activates only for an Electron user agent. Prepared hooks capture a native DI store getter and capacity writes without changing their return values. Store reading still inspects semantic `toString` source and native collection/map interfaces: bounded traversal finds `BattleStatistics`, `BattleUsers`, and matching `BattleParams`. Spectators are excluded; capacity fallback accounts for team limits. AST migration does not replace every runtime field/collection assumption.

The reader polls once per second, preferring the native HUD clock and otherwise counting down from the latest native duration. The content listener validates map/mode/time/counts, ignores snapshots at least five seconds old, and applies only while `state.currentScreen === 'battle'`. Available `timestamps.end` and `party.size` are omitted outside that state or if invalid. Deadline changes within three seconds are suppressed to reduce jitter. Cyrillic names without an English translation fall back to an English screen label. `__kaspPresenceStoreDebug()` reports capture/error; `__kaspPresenceBattleDebug()` returns the last snapshot.

The companion preload/main-process integration accepts messages from the main HTTPS Tanki Online game page, validates sender/frame and payload, copies allowed fields, and uses native Discord IPC. Changed activities are coalesced over up to fifteen seconds; explicit clears are immediate and reconnect is automatic. Navigation, renderer failure, and closure clear activity. The supplied main patch clears a missing heartbeat after thirty seconds while visible; minimized/hidden windows retain the last activity, and restore/show grants a fresh grace period. Without an end timestamp, `DiscordPresence` reuses its fixed session start across lobby returns/reconnects. The public Application ID is client configuration; no account token is used. See [integration guide](#electron-client-integration).

### Electron Mouse Adapter

Source: [src/core/electron.ts](src/core/electron.ts).

`setupElectronZKey()` detects `Electron` in the user agent or an available `window.process.type`. It installs capture-phase mouse listeners only in that context.

Mouse button 3 generates synthetic Z keydown and keyup events unless focus is in an editable control. Buttons 3 and 4 have their default browser behavior suppressed on supported mouse phases. The adapter simulates input; it does not directly operate a native Electron navigation API.

### Window Declarations

[src/types/window.d.ts](src/types/window.d.ts) declares action/statistics callbacks, augment bridges/debug, critical bridge/debug, arcade debug, bonus callbacks/debug, and optional battle metadata. Presence and inventory bridges have additional local Window intersection types in their core modules. Declarations are type contracts, not runtime assignments; not every optional metadata global is populated.

## Settings Integration

Source: [coreSettings.ts](src/core/coreSettings.ts), [settings.ts](src/core/settings.ts), [settings.css](styles/settings.css).

`coreSettings.inject()` requires the native settings block and menu, and exits if its tab already exists. It appends KASPERSKY, a custom content host and a reload tooltip. The native settings components retain their event handlers and content. There are **14 localized checkbox switches** in four categories, followed by Information links.

| Category | Key | Default | Apply behavior |
| --- | --- | --- | --- |
| Standard | `k_friends` | false | Settings-close reload |
| Standard | `k_augments` | false | Settings-close reload |
| Standard | `k_auto_upgrade` | false | Settings-close reload |
| Standard | `k_ext_btn` | false | Settings-close reload |
| Standard | `k_paints` | false | Settings-close reload |
| Standard | `k_history` | false | Settings-close reload |
| Streamer | `k_hideNicknameXP` | false | DOM masking updates immediately; settings-close reload remains required |
| Streamer | `k_hideCurrency` | false | Module listeners can restore/update live; settings-close reload remains required |
| Streamer | `k_hideSupplies` | false | Live |
| Advanced | `k_overdrive_timer` | false | Settings-close reload |
| Advanced | `k_arcade_reload` | true | Live |
| Advanced | `k_critical_indicator` | true | Live |
| Visual changes | `k_box_pickup` | false | Live |
| Visual changes | `k_rain_weather` | false | Live; expanding full-width rain/thunder volume controls |
| Visual changes | `k_rain_puddles` | false | Live; experimental reflections during rain; requires weather |

The `liveSettings` set contains supply privacy, box pickup, random weather, arcade reload and critical indication. Numeric rain/thunder volume controls also apply live, independently of the boolean reload baseline. On switch change, the native input's checked state drives the active class and saved setting. `needsReload` compares every non-live option with `initialSettingsState`; reverting changes cancels the reload. Baselines survive a language rebuild while settings remain open. Normal close clears them and reloads only if required.

The Standard card spans the two upper rows of the left column; Streamer and Advanced occupy the right. Visual changes and Information span both columns. A content container query collapses the layout to one column. The custom host scrolls with scrollbar chrome hidden. Selecting a native tab restores native content and hides the custom host; it does not replace native settings bodies with extension controls.

Both the five content cards and the nine left navigation buttons use shared artwork slices within their respective groups. Menu offsets span the first through last button, so each button displays a different image region. `ResizeObserver` watches the menu and buttons even on native sections; on custom-tab opening it also observes the grid and panels. Coordinates and size variables are written in em and compared before mutation. Panel slice calculations remove entrance translation using `DOMMatrixReadOnly`. Existing image blur is 2px, with thin fixed pixel borders; text is outside the blurred layers. `stopArt` disconnects the observer on close/reinjection.

Information contains the store, extension repository, companion-client repository, current License/Terms and FAQ links. Google Drive links are external documents, not a remotely executable configuration or runtime data dependency. Their publication state is independent of the bundled local guides. The custom top title was removed; category headings supply the visible structure.

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

Enhanced Play retains its original artwork fallback from `assets/playButton.png`; the scoped lobby-navigation presentation described below hides those old layers and supplies its own panorama. Native children are hidden by the injected `kasp-playbtn-styles`, which allows the lobby art layer; `data-overridden` and `buttonsCreated` distinguish treated elements and avoid duplicate wrappers. A newly created native Play button resets the wrapper creation state.

`syncButtonStates()` skips work when searching state is unchanged unless forced. Language text is updated within that synchronization path, so changing language alone is not a universal immediate refresh of all existing button labels.

### Lobby Navigation Tiles

Sources: [lobbyNavigation.ts](src/modules/lobbyNavigation.ts), [lobbyNavigation.css](styles/lobbyNavigation.css), and `gameDOM.lobbyNavigation`.

Boot synchronizes the presentation after Enhanced Play. The existing left-menu entries use a two-column tile grid with their original localized labels; Settings spans the last row. The two direct-mode buttons, seven standard-mode buttons and compact footer controls retain their existing handlers and native icon masks. A separate panorama from `assets/art3.jpg` uses a 72% light overlay, 2px grayscale image blur matching the pass cards, and white .063em outlines. Pointer-transparent card-local layers share one image origin, including scaled ancestors. Hover darkens the background; notification indicators remain visible as black dots. The custom Play label uses border-box sizing so its padding stays inside the full-button overlay and does not offset the text from the center.

The adapter adds scoped classes and decorative spans without replacing or moving native entries, changing menu text, or altering queue selection/hotkeys. Mutation and resize observers refresh card geometry after language changes, delayed footer insertion and native root replacement. Owned-layer mutations are ignored, and unchanged classes/styles are not rewritten. Removed cards/roots and feature cleanup release all owned layers/classes. Search locks and disabled-mode pointer states remain controlled by Enhanced Play; reduced-motion preferences disable the added hover transitions.

Section icon boxes are 2.3em, the last Settings icon is 1.85em, and the last caption uses `text-transform: uppercase`; native localized text itself is retained.

The native Play span stays hidden while the custom label exists, including when React resets the button classes. Main/menu/mode labels use larger game fonts. Mode controls share the metal-shine hover effect; matchmaking dims the main artwork to 42% brightness with a light lock symbol. Footer controls are 3.9em squares with 1.85em icons and return to the bottom of the native full-height lobby column, with a 1em bottom inset.

### Cybersport Format Prototype

Source: [cybersport.ts](src/modules/cybersport.ts), [cybersport.css](styles/cybersport.css), and `gameDOM.battleCreate`.

Boot calls `cybersport()` in its heavy-pass conditional error boundary, independently of screen classification and settings. It recognizes the Format row and direct native Sport card using its RU/EN heading or semantic background resource. One deep DOM clone is inserted immediately after Sport. Copied IDs are removed; custom heading, `assets/cybersport.png`, button role, focusability, and Enter/click handlers are applied. The source description/count stay synchronized; no React fiber or event handler is copied.

Activation calls the original connected Sport element's `click()` once. A forwarding flag prevents the row capture listener from treating that forwarded click as native deselection. Custom selected presentation is enabled only when native Sport confirms its selected class; a bounded one-second animation-frame retry allows asynchronous native updates. Other native clicks or selection away from Sport clear the alias. The source card receives temporary scoped attributes/pseudo-label styling, not replacement text or native class changes.

A row-scoped observer watches child/class/text changes and coalesces through one animation frame. Conditional writes allow feedback to settle. Row/source/clone replacement rebuilds one entry; leaving the row disconnects its observer/listener, removes its clone, and clears source attributes. An Esports activation separately retains a pending CTF action across that transition: it searches native `.blockCard` elements in the creation row for an exact `CTF` heading and calls the matching card's `click()` once. Boot updates and a temporary 100 ms retry handle delayed mounting, bounded to five seconds. A native format click cancels the pending action; ordinary formats never start it. The action is consumed before clicking to avoid duplicate navigation. No permanent interval, AST patch, synthetic Start action, new server format, or automatic battle creation is added. Q/E/gamepad native format traversal still belongs to the game's original cards.

Esports selection is retained across Format/Mode/Map transitions against the connected `BattleCreateComponentStyle-mainContainer`; removing/replacing that root or choosing an ordinary native format clears it. Map cards are identified by their native `MapCardComponentStyle-message` child inside a background-image element, within the row's native columns. Computed background URL pathnames are compared with seven explicit artwork paths in `cybersport.ts`, independently of CDN host and URL query. The shared Red Alert artwork additionally requires the exact ordinary Red Alert MM name in RU/EN, after whitespace normalization, to exclude Red Alert MM Esports. Other paths do not depend on localized names. A separate map-row observer handles child/text and class/style updates, including search/theme results and delayed artwork/labels. Removed/recycled elements have their module attributes cleared or recomputed.

Scoped CSS hides excluded cards and uses a three-row grid with 25em columns. Native column wrappers use `display: contents`; cards remain in their React-owned DOM positions with native click handlers. When a native selected-panel marker appears on an excluded card, the first currently available allowed card is clicked once for that rejected selection and horizontal scrolling is reset. No card is manufactured if the game's search/theme result contains no allowed variant. Leaving the map row removes filtering attributes and disconnects its observer, while returning to Map within the same Esports creation session reapplies the filter. No map list or selection is persisted to disk.

[cybersportSettings.ts](src/modules/cybersportSettings.ts) owns the scoped native settings controller. In an active Esports creation root, it observes the native right panel and coalesces updates through the module's animation-frame scheduler. The first two parameter inputs are the native per-team player limit and minutes; the HTMLInputElement prototype value setter plus bubbling input/change events apply 6 and 12 through React's ordinary change handlers. The score input is excluded. The native RU private-battle label or EN PRIVATE (also PRIVATE BATTLE/CLOSED BATTLE) identifies its checkbox; native click enables it. Original readOnly/disabled flags are retained and released when controls are replaced or Esports ends. Numeric inputs are read-only and the enabled private checkbox is disabled against edits while the preset is active. If the additional-options view expands, a panel-scoped `-alignSelfFlexEnd` button with exact RU/EN Close text is clicked once per mounted element. The remaining preset is completed on the restored compact view; no DOM preview clone or generated `ksc-*` selector is used for closing.

The first rank dropdown is the minimum rank. An existing First Sergeant RU/EN placeholder is accepted; otherwise the native mousedown handler opens that dropdown and the first item in its inner list is clicked. Its rank-image pathname is retained in memory to recognize the selected minimum independently of localized text. Delayed menu mounting receives a bounded two-second retry; a failed unchanged selection is not retried indefinitely and remains available for manual correction. Once fixed, mouse and editing-key interactions with that minimum control are prevented; Tab/Escape and the maximum-rank control remain available. Only menus opened by the controller are closed during cleanup. A panel observer covers class/src/value/checked attributes, child replacement, and preview text; captured input/change/click events cover user actions and reset controls. The game's map/default resets are corrected through native handlers, rather than changing only the preview. The native Start action and network submission remain owned by the game; no server endpoint or request patch is introduced.

[cybersportNative.ts](src/core/cybersportNative.ts) is installed by the injector in MAIN, where the game's React instances are accessible. The isolated settings controller marks only its creation root with `data-kasp-esports-active` and sends a payload-free DOM sync event. Bounded fiber-parent traversal reads live component instance props, excluding host nodes and stale memoizedProps. Semantic form callbacks apply numeric player/time values; the minimum-rank widget supplies its numeric `minRank` and native change callback. The authoritative options set is checked for the untranslated enum name Private. No constructor/minified field name, module ID, AST parser, or additional game-bundle edit is introduced.

The native creation component's `launchFun` callback is guarded while Esports is active. Its inspected seven-argument signature is checked; submission preserves name, score, maximum rank and native callback receiver, replaces team capacity/time/minimum rank with 6/12/the verified rank, and uses the current native options set. Missing privacy/rank or incompatible signatures postpone creation and reset the native creationStarted flag for a manual retry. Capture checks cover mouse Start and Space; the callback guard also covers direct gamepad/native activation once installed. A changed map invalidates the rank cache until its widget supplies a new value. Replaced launch callbacks are guarded again; deactivation restores the original callback without overwriting a newer native replacement. `__kaspCybersportDebug.status()` reports active/guarded/ready state, authoritative values, errors and lastSubmission numeric arguments. lastSubmission confirms arguments handed to the native callback, not server acceptance. The bridge has no periodic poll; existing form updates and a coalesced animation frame after a postponed Start drive synchronization.

### Augment Specifications

The `k_augments` setting is labeled **«Отображение недоступных предметов и характеристики устройств»** in Russian and **Augment specifications** in English. It combines unavailable-item presentation with device specifications; Possible Rewards remains excluded. Diagnostics confirmed that the rewards window's `DescriptionRewards` model contains category, count, description, name, preview, probability, and reward type, with no device ID or structured modifier list. Those descriptions alone are not numerical garage specifications.

Source: [src/modules/augmentSpecs.ts](src/modules/augmentSpecs.ts).

**Activation:** `k_augments` in the garage, excluding Possible Rewards/loot-box contents. The feature combines current-session properties/baselines with supported visible numeric adjustments. Model collection initializes independently; its DOM binding observer and interval run only while enabled.

#### Specification Controls

`injectButtons()` creates one `kasp-specs-tooltip` and scans native skin-cell images. `applyButtonToCard()` requires a valid `DataLoader.getDevice(url, card)` lookup. A matching button is reused: its URL/device ID are updated without replacing listeners. Missing data removes a stale button. Cosmetic tabs remove device-specification buttons.

Bound unavailable items receive names and grayscale previews from exact native data. Device/shot-effect presentation includes the existing decoration treatment; skins use their simpler name presentation. Unknown placeholders are not globally hidden. `previewImages` retains original URLs and checks ID, tab, and actual `src` before reusing a replacement. Error listeners restore the native placeholder and suppress a failed URL for this module lifetime. `emptyCards` recreates only detached/removed decorations, and disconnected entries are cleaned up.

Hover builds advantages/disadvantages through `renderList()` and adds “Other parameters” below the columns only when unresolved parameters exist. `updateTooltipPos()` offsets the tooltip from the cursor and flips placement near viewport edges. Clicking its control prevents selection of the underlying card.

Parameter-list text and the first paragraph of the server description are escaped before entering tooltip markup. A description-language mismatch displays a localized reload instruction. Empty comparison columns use “No confirmed changes,” which does not assert that no conditional or unclassified effects exist. Unchanged values cannot create an empty or misleading “Other parameters” section.

#### Numerical Adjustment

`updateLiveStats()` reads the current device icon and resolves its `modifiers`. It scans parameter-name spans outside generated replacements and matches exact normalized RU/EN labels from `STAT_DICT`.

The original value is the span immediately after the name container. Parsing removes whitespace and replaces a decimal comma with a period. Adjustment is `original × multiplier`, including percentage changes to mass. Absolute overrides do not enter this multiplier path. Results are rounded to two decimals when necessary and formatted with spaced thousands. A shared translated label is matched against tags available in the current device's modifiers.

Color classification is rule-based: larger multipliers normally indicate a buff and lower reload multipliers indicate a buff. Mass and unchanged values use a neutral color. This classification describes the current presentation logic, not a general assessment of every game mechanic.

`liveStats` maps original nodes to a replacement wrapper, its inner value span, and the original inline display. Original nodes are retained, hidden, and followed by a generated `custom-live-stat` node.

On subsequent updates, class, text, style, visibility, and placement are changed only when necessary. Calculations always read the retained native value. This prevents compounded multipliers and allows observer feedback to settle.

When an original node is no longer active, its replacement is removed, `hidden-by-script` is cleared, its original display is restored, and its map entry is deleted. Invalid numbers or missing modifiers consequently remove stale augmentation during an active update pass.

#### Scheduling and Closure

`scheduleUpdate()` coalesces through `queueMicrotask`, then rechecks the enabled setting, garage classification, and absence of a loot-box screen. Both `kasp:augments-updated` and `kasp:augment-cards-updated` trigger it. Settings/storage listeners resynchronize; Escape/Z and mouse-back handlers hide the tooltip. Screen changes or a loader also hide it.

Disabled synchronization explicitly restores replaced images, removes decorations/specification controls, restores original stat nodes and inline display, clears live-stat maps, and hides the tooltip. The settings-close reload remains the common configuration workflow. Tooltips remain mouse-hover-only; native side descriptions are a separate game interaction path.

### Paint Search

Source: [src/modules/customPaints.ts](src/modules/customPaints.ts).

**Activation:** `k_paints` in the garage.

`addSearchInput()` requires the paint caption and category parent, marks the native item container `kasp-paints-container`, and appends a single search wrapper with a localized placeholder and input listener.

`normalizeText()` lowercases text and normalizes Russian `ё` to `е`. `applySearch()` waits for the complete shared DataLoader readiness state, splits the trimmed query on whitespace, and compares every query word against combined Russian and English names.

An empty query restores item display. For non-empty queries, a recognized image URL is looked up in `paints.json`; unknown entries do not match. Elements missing an image or source are skipped rather than universally hidden. Each direct collection column is hidden when it has no visible items.

Repeated garage calls reapply an existing non-empty query to newly rendered content. Filtering only changes visibility of loaded cards; it does not alter inventory or request additional paints.

### Friend Categories

Source: [src/modules/customFriends.ts](src/modules/customFriends.ts).

**Activation:** `k_friends`, with friends/invitation UI present. The ordinary list/sidebar pass remains outside battle; the context-menu path checks actual native friend-list nodes even if screen classification is stale.

The category sidebar offers All, Online, Offline, Clan, Purple, Yellow, and Red. `filtersConfig` supplies icon URLs and category identifiers.

| Helper | Responsibility |
| --- | --- |
| `getCurrentUserId()` | Read the verified native account ID; unresolved identity returns null. |
| `getCustomCategories()` | Parse the current user ID's category dictionary, falling back to `{}` on JSON errors. |
| `setCustomCategory(ownerId, friendId, color)` | Toggle a category assignment and reapply active sidebar filters; refuse writes when the captured owner is no longer current. |
| `getMyClanTag()` | Read the current account's clan prefix. |
| `updateCardBadge(el, isFriendsList)` | Apply the custom color, or clan-blue fallback, to a supported card. |
| `applyFilter(scrollBlock, type)` | Classify native cards and change visibility. |
| `injectCategoriesMenu(menu)` | Add three color controls to a supported player context menu. |
| `setupSidebar(scrollBlock)` | Wrap a friends list or insert a sidebar beside invitations. |

Friend-list online/offline state uses native classes. Invitation state uses recognized text; clan membership uses the current clan tag's presence in card text. A custom color takes precedence over the clan badge.

Assignments use `tankiCustomCategories_uid_<userId>` and map friend IDs to colors. Native remote data resolves the displayed friend; missing or ambiguous IDs leave the three controls visible but disabled, with a localized pending tooltip. No nickname-based fallback authorizes a write. Toggling the same color removes the mapping. Owner and friend renames retain labels; switching owner changes the namespace. Legacy nickname keys remain untouched.

Dataset flags prevent duplicate sidebars and context-menu augmentation. The context menu is repositioned if its new controls extend below the viewport. Boot calls `friendContextMenu()` in the mutation microtask before its animation-frame/heavy-module pass, so opening/hydrating the native menu does not wait for the 150 ms throttle. Valid account-identity messages schedule a microtask refresh after identity listeners, reading the verified cache rather than trusting payload data. An unresolved menu requests fresh native player data at most once per second, with six attempts per menu/owner/nickname binding. A successful reply enables the current row without another native DOM mutation. Color diamonds are CSS pseudo-elements and need no CDN image requests. Unchanged replies retain the existing row; owner/target changes rebind it, and detached rows release their markers and DOM ownership.

The module refreshes badges on repeated calls. Filtering is explicitly applied on sidebar clicks and category changes; it does not maintain an independent server-side list subscription.

### Account Search Notice

Sources: [accountSearchNotice.ts](src/modules/accountSearchNotice.ts) and [accountSearchNotice.css](styles/accountSearchNotice.css). The automatic module runs with the heavy lobby pass and receives validated account-identity messages. It reads the verified content-world cache after message listeners finish; a message payload alone does not establish ownership. When the native main menu is present and the verified ID remains unavailable for 600ms, a non-interactive status card appears at the bottom center. Its localized RU/EN caption uses the same art1 image, monochrome overlay, 2px image blur and white outline as the right lobby panels. Position, padding and text scale in em.

The card fades/slides in over 200ms and fades/slides out when the ID arrives or the lobby closes; removal waits for the exit transition. A fast lookup cancels the pending card, and an interrupted exit reverses on the same element. Screen changes and cleanup release pending timers, frames and presentation. Reduced-motion preferences disable transitions. No additional account search or polling is introduced.

### Lobby Pass Cards

Sources: [lobbyPasses.ts](src/modules/lobbyPasses.ts), [lobbyPasses.css](styles/lobbyPasses.css), and `gameDOM.lobbyPasses`.

Lobby announcements use [lobbyAnnouncements.css](styles/lobbyAnnouncements.css) and the same 26em light card surface, white outline, panorama and hover treatment as the passes. Native promotional imagery is hidden; the original heading, live timer, Q/E controls and carousel indicators remain. Long titles wrap beside the timer. The native click targets and carousel handlers are retained, with no copied titles, added requests for announcement data, or replacement timers. The panorama adapter also observes announcement replacement/resize and removes its decorative layer during cleanup.

Indicator colors transition over 200ms. The adapter measures the natural caption/timer height and supplies a pixel endpoint for a 200ms body-height transition, allowing both growth and shrinkage without attempting to interpolate `height: auto`. Replaced bodies and feature cleanup release the height variable; reduced-motion preferences disable both transitions.

CSS restyles the native challenge and Elite Pass roots. It changes grid layout, hides reward artwork/redundant descriptions and decorative pass icons, and turns progress into straight gradients. Challenge purchase state remains native and the original status text is never replaced. Root click handlers and all original child nodes remain intact. No copied React tree, proxy button, or native bundle patch is installed.

The adapter adds scoped classes, CSS custom properties, and an absolutely positioned decorative span inside each card. These isolated background layers use assets/art1.png with a light overlay and 2px image-only blur. Assets resolve through chrome.runtime.getURL. Their shared image dimensions and origin preserve a continuous panorama across card gaps, including scaled ancestors, without changing content geometry. Native sibling stacking cannot cover the card-local layers, and the original white backgrounds remain as a fallback. Resize/replacement refreshes their coordinates; cleanup removes the layers and owned classes. `readStarProgress()` reads the native current/required counter. `readCircleProgress()` reads one or two native half-ring rotations, using inline transforms or computed DOM matrices: the first half covers 0–180 degrees, and the second covers 180–360. A second identity matrix represents 100%, while a lone identity matrix represents 0%. Missing/incompatible geometry produces no percentage. Original half-rings are made invisible with `visibility: hidden`, keeping transforms computable; `display: none` would erase their computed angles in Chromium. The displayed bar is transparent when the percentage is unavailable, while the native level/timer remain visible.

Elite card position/width follow the challenge's actual bounds in its offset-parent coordinate space, including parent scaling. Parent custom properties align trophy favorites with the challenge's left edge and width, below the last card. Typography, progress-bar sizes and calculated geometry use `em`; measured coordinates, announcement height and panorama offsets are converted using the font size of the element consuming each value. Spacing accounts for parent transforms. Pixel minimums no longer clamp text when the game font or browser zoom changes. Existing 1px borders, 2px hover outline and 2px artwork blur remain unchanged. A scoped mutation observer follows native text/class/child changes; it ignores the adapter's own root style changes. A ResizeObserver and window resize listener maintain alignment, and the immediate boot mutation path covers source replacement/navigation. Updates retain the native DOM and skip unchanged properties. Cleanup removes owned classes/variables and restores the previous trophy-position/width variables. The CSS-only pseudo-title and level prefix follow `data-kasp-pass-lang` for RU/EN. There is no independent countdown, persistent pass cache, additional request, or account-ownership inference.

### Trophy Favorites

Source: [src/modules/customTrophies.ts](src/modules/customTrophies.ts).

**Activation:** Automatic in lobby, garage, and result-screen processing.

`loadTrophyDictionary()` fetches `database/trophies.json`, validates its entries, and stores the dictionary. Initialization preloads it while native account discovery runs; updates await one shared promise. A failed load retries after 10 seconds through a lifecycle-owned timer, without requiring a game reload.

`getFavs()` parses and caches the current account list under `kasp_trophies_favorites_uid_<userId>`. `src/core/trophyData.ts` validates integer progress, removes duplicates, enforces two favorites per equipment type, and migrates legacy `n/100` records into percentage-only data with unknown exact points. Obsolete reward-icon metadata is ignored. `syncOwner()` clears owned panels/stars/cache when the ID changes or becomes unavailable; native paint favorites remain untouched. `saveFavs()` verifies the owner and tolerates storage failures while retaining the live selection in memory. Storage events invalidate the cache for changes in another tab. The old shared list is preserved separately.

`parseItem(rawText)` uses equipment word boundaries and normalizes Russian ё/е; ambiguous cards naming different equipment are skipped. Adjacent native name/number blocks can be recognized without a separating space. `toggleFavorite()` removes an existing item or adds it when fewer than two items of that type are selected. Clicks re-read current progress and reject detached/recycled cards or changed owners. Stars use packaged `assets/trophy-favorite.svg` and `assets/trophy-unfavorite.svg`, with localized accessible labels and keyboard controls; no hashed external star URL is required.

`processGarageMissions()` scans all supported progress headings and their titles, rather than treating the first heading as reputation. Parsing supports localized thousands separators and requires complete, safe integer fractions. `n/100` and percentages are never stored as reputation counts; exact candidates take precedence. Malformed, conflicting or partly hydrated values do not overwrite the last reliable score. Missing targets are not replaced with a fabricated 5,000,000. Target-only changes are saved too.

`processBattleResults()` considers both native pre-animation and final totals, including the temporarily transparent final total, and selects the highest total with a consistent target. Exact values survive percentage-only placeholders. An explicit localized completion label can complete a previously known target; rounded 100% alone cannot invent exact points. Progress still comes from the observed game interface, not a server subscription.

`createPanel()` sorts turrets before hulls and renders a two-column grid with localized equipment names, percentages, progress bars and observed current/target reputation. Unknown exact points display an em dash and a localized hint to open trophies. They are never estimated from rounded percentages. Reward artwork is not rendered; the common lobby artwork uses packaged `assets/art1.png` through `lobbyPasses`. The panel follows a replacement native parent, and unchanged updates do not rebuild it. The first lobby presentation for a verified owner fades in over 250ms; page-local `presentedOwners` prevents replay after section navigation, language, progress or favorite changes. Reduced-motion preferences disable the fade.

Boot calls the adapter independently of `state.currentScreen`: quest pages in Electron can retain a stale `loading` or `battle` classification. Actual native cards/anchors determine work. A scoped observer watches card child/text/title hydration and coalesces updates over 50ms, ignoring owned stars. Unchanged passes produce no DOM mutations. A validated identity message schedules a coalesced zero-delay refresh after identity listeners; message payloads alone never establish ownership. Cleanup removes owned stars/layout classes, panels, observers, timers and listeners. Tests cover progress corruption, animation totals, legacy storage, account isolation, packaged images, stale screen classification and delayed hydration; `node tools/browser/custom-trophies-browser.cjs` runs isolated real-DOM/image QA.

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

`finish()` clears running/queue/retry state, the step timeout, input listeners, and the gamepad animation frame. While a sequence runs, any trusted keydown, pointerdown, mousedown, or click stops it without blocking the original user action. Synthetic Enter and confirmation clicks from the module are ignored. Connected gamepads are polled on animation frames and immediately before each step; a newly pressed button stops the sequence before another upgrade confirmation. Buttons already held when the setup is confirmed are treated as the initial state, so confirming does not immediately cancel the run. No gamepad polling remains after completion or cancellation. A confirmation that disappears before `clickConfirmButton()` stops the sequence. The count tracks confirmations issued, not server-verified completed purchases.

#### Navigation and Button Lifecycle

Initialization installs capture listeners for garage item/category/back clicks. Supported navigation clears running state and its timer, resets the item signature, removes quick buttons, and schedules button recreation.

`lastItemSignature` follows the selected item name or action container. `isCategorySwitch` and its timeouts distinguish category transitions from item selection. Escape/Z and side-button handlers update category/signature state. During a running sequence, the temporary input listeners also cancel upgrading on these inputs.

Repeated updates remove/recreate controls when signatures or eligibility change. A recognized loading screen closes the setup modal. Recognition is heuristic and depends on native labels, classes, and currency artwork.

### Nickname and XP Privacy

Sources: [src/modules/hideNickname.ts](src/modules/hideNickname.ts), [styles/hideNickname.css](styles/hideNickname.css).

**Activation:** `k_hideNicknameXP`, including synchronous startup setup.

`setupNicknamePrivacy()` exits if disabled, applies `hideNickname()` immediately, and installs one private observer. It observes subtree children, character data, and class/ID attributes. Re-enabling uses the existing observer.

`hideNickname()` ensures `html.kasp-hide-nickname`, sets `--kasp-hidden-label` to the appropriate quoted CSS string, and annotates supported nodes. `setTooltip()` writes only when metadata differs.

Header nickname and XP receive original-text tooltips. Client parameters matching `UID:` receive `data-kasp-private-uid`; other parameters receive `data-kasp-public-parameter` and have stale UID metadata removed. Native statistics spans matching the actual self nickname receive `data-kasp-private-nickname`; stale self markings are removed.

CSS makes original text transparent, disables selection/transitions, and paints a pseudo-element label. Known header, selected self-row, result self-row, history current-player, selectors can mask without waiting for an observer annotation. The first client parameter is provisionally hidden until identified as public, covering the normal UID-first startup layout.

The source text and children remain intact. The UID element and its following delimiter use `display: none` while privacy is enabled; no `UID: Hidden` placeholder occupies space. TYPE, VER, UPD and SRV remain public once classified. Removing the root class restores the native UID and delimiter. Other supported nickname/XP fields retain their masking and hover-reveal behavior; the hidden UID cannot be hovered. Native nodes are not removed, preserving React ownership and the shared identity reader.

The observer avoids watching its own metadata attributes, and comparison guards reduce repeated mutations. Disabling removes the root class through Core Settings; observers remain page-lifetime but callbacks exit while disabled. New unrecognized selectors are outside current coverage.

### Currency Privacy

Source: [src/modules/hideCurrency.ts](src/modules/hideCurrency.ts).

**Activation:** `k_hideCurrency`, outside the recognized battle screen.

`getHiddenText()` selects Hidden/Скрыто. `processSpan()` recognizes text containing digits, saves it in `data-original-value`, replaces the span's displayed text, assigns an original-value tooltip to the supported parent, and adds `currency-masked`.

Unchanged masked spans are not rewritten. Native balance updates replace the saved amount, and language changes update the hidden label. Selectors cover native coin blocks and header icon spans. The custom Tankoin counter handles its own privacy and is excluded to avoid competing text writers.

The first call installs settings and storage listeners. While masking is enabled outside battle, a single 500 ms interval rechecks the setting and processes balances. Disabling restores tracked numeric text immediately and cancels the interval, including when toggled on and off without leaving settings. A newer native numeric value is preserved during restoration. Detached spans are restored and released; battle entry and feature cleanup also restore tracked spans. Only owned masking metadata is removed, and previous parent tooltips are restored.

Currency masking differs from nickname masking: it modifies selected text nodes and is not designed as a before-paint CSS-only identity-preserving mechanism.

The automatic [Tankoin balance module](src/modules/tankoinBalance.ts) keeps a counter in both the main-menu and breadcrumb headers outside the shop. When there is no breadcrumb header, it locates the shared ruby/crystal group and inserts the counter immediately before that group. The native shop counter takes precedence; otherwise the extension displays the most recently observed shop or Ruby exchange balance. A scoped observer follows native balance text updates, including exchange purchases. The initial value is `—` until a balance is observed. The last known amount is stored as validated numeric text in `kasp_tankoin_balance_uid_<userId>` and restored after reload when the verified account ID arrives. In the lobby, the custom counter waits for a verified ID before mounting, then can fade in once per owner/page session over 250ms, without replaying on section re-entry or balance/privacy changes; reduced-motion preferences disable the fade. Account changes select a separate cache, including different IDs with the same nickname; renaming the same ID retains its balance. An unavailable ID does not block live DOM observations but never permits persistent reads or writes. Storage failures keep the live counter working, and unchanged renders do not repeat writes. The custom counter follows `k_hideCurrency` and does not submit purchases or open the exchange automatically.

### Garage Skins

Source: [src/modules/customGarageSkins.ts](src/modules/customGarageSkins.ts).

**Activation:** Automatic, using direct garage DOM recognition and the additional 250 ms interval.

#### Database and Saved State

`loadSkinsData()` independently fetches `database/skins.json` at import time and caches its promise. It fills `NAME_TRANSLATE` and `PREFILLED_DEFAULTS`, logging success or failure. A failed promise is not automatically discarded for retry.

`safeParseJSON()` returns parsed data or `null` and keeps a bounded cache of three parsed storage strings. Every periodic pass still observes mounted/selected skin state; the 250 ms observation is preserved. `getSavedSkins()` reads validated equipment-to-artwork overrides from `kasp_equipped_skins_uid_<userId>` for the verified account. Legacy `kasp_equipped_skins` is preserved but never read or migrated. `getDefaultImages()` merges bundled stock artwork with shared stored string or array entries, supporting earlier storage shapes and deduplicating validated HTTPS Tanki artwork URLs. The original-image cache contains no selected-skin ownership. Unchanged owner/storage inputs reuse generated CSS; changing either storage map, switching accounts, or removing the style causes it to be generated again.

#### Observation and Learning

| Function | Responsibility |
| --- | --- |
| `readSkinCards(row)` | Enumerate icon cards and resolve exact IDs, names, mounted/selected/owned/unknown flags, and standard-skin markers from committed native React props through `readGarageCosmeticCard()`. |
| `readPreviewArt(menu, row)` | Extract a WebP background URL outside the card row. |
| `readSkinsScreen(names)` | Return `absent` or a structured ready state with equipment, equipped card, selected title, and artwork. |
| `decideLearnAction(state, stockUrl)` | Produce `none`, `set`, or `clear` with a reason/source. |
| `learnFromSkinsScreen(state, defaults)` | Stabilize a candidate across two matching observations before changing saved data. |
| `writeSavedSkins(saved)` | Persist overrides and warn on write failure. |

A nonstandard skin is learned only when one selected card and one mounted card resolve to the same exact skin ID, with native ownership confirmed and the unknown flag unset. Titles are diagnostic text rather than identity: two equally named XT variants cannot substitute for each other. The shared committed-tree reader avoids stale React alternates. Missing or ambiguous native card state suppresses learning. Standard equipped equipment produces a clear action.

React expandos are read only in the injector's MAIN execution world. `installGarageSkinCardsBridge()` handles the synchronous cancelable `kasp:garage-skin-cards-request` DOM event and refreshes each icon's `data-kasp-skin-card` JSON attribute. The isolated content script validates and reads those attributes only when the event is acknowledged through cancellation. Missing acknowledgment suppresses learning rather than reusing stale attributes. The bridge works independently of the augment setting and catalog; unchanged values produce no attribute writes. The cosmetic reader allows up to sixteen ancestor levels to pass native presentation wrappers.

Every tick resolves `getVerifiedAccount()` before garage detection. An owner change clears CSS overrides, unknown labels, pending learning and diagnostics, then refreshes CSS from the new owner's data even outside the garage. Missing identity applies no account overrides and writes nothing. Writes recheck the current native account ID. Pending two-observation learning cannot carry across an owner change or logout; a nickname change with the same ID retains the same storage scope.

Readable artwork must match the module's narrow HTTPS Tanki-subdomain WebP pattern. If equipped artwork cannot be read, a known stock URL can be stored as the fallback. Equality with that stock fallback is used by `hasUnknownSkin()` to identify an unknown skin.

`pendingLearn` tracks an action key and repeated-observation count. A `none` action clears it. Two matching observations are required; these may come from multiple update paths and do not guarantee a fixed wall-clock waiting period.

#### CSS Replacement and Labels

`tick()` requires ready databases and a supported garage screen. It reads/learns the skin state, gathers original item image URLs, updates unknown labels, persists newly seen base images, and calls `updateGlobalCSS()`.

`updateGlobalCSS()` builds selectors for known original `src` values on garage images and mounted previews. It writes `content: url(...)`, object fitting, and pointer presentation into `kasp-skins-global-css` only when the generated text changes. Native `src` attributes remain available for recognition.

`toggleUnknownLabel()` adds/removes the English `unknown skin` label. `markMountedUnknownSkins()` resolves mounted previews against known base URLs. `describeSkinsScreen`, `logSkinsScreen`, `noteLearn`, and `describeLearnAction` provide change-sensitive diagnostics using the `[KI-test][garage-skins]` prefix.

This is a garage-artwork replacement mechanism. It does not provide an arbitrary skin selector, unlock ownership, or modify the 3D battle tank. Stored base-art URLs are validated with the shared `src/core/imageUrl.ts` helper before entering CSS selectors; selected skin overrides retain their existing strict artwork validation.

### Weapon Reload Indicator

Source: [src/core/arcadeReload.ts](src/core/arcadeReload.ts), invoked by [src/kasp_injector.ts](src/kasp_injector.ts).

**Activation:** Automatic, for the local tank with Shaft or Scorpion. No garage configuration is needed; the live Arcade reload indicator setting controls presentation.

Offline [arcade-ast.cjs](tools/ast/arcade-ast.cjs) discovers the local HUD through `progressBarMaterial`, `LocalTank`, and `shaftWeapon`/`scorpioWeapon` semantics. [arcade-render.cjs](tools/ast/arcade-render.cjs) generates guarded edits. Runtime `selectArcadeReloadPlan()` and `patchArcadeReload(code, report, plan)` select/validate an exact or adapted plan, without a full AST parser. The native bar/material constructors and scene layer create one extra `__kaspArcadeReloadBar`. Its instance projection delegates to the base mesh's final screen rectangle, then adds one row height. Native progress/resize/visibility/disposal control it. Remote tank title code is not modified. These are WebGL meshes, not DOM/SVG indicator elements.

The extra row has a fixed zero gap and an independent material whose current foreground is `#FFBB1C` (`0xffbb1c` in the offline generator). Native background/border parameters are preserved; this arcade feature does not recolor the base material. Centered HUD lower supply/effect icons shift by the added row height only while a supported local bar is visible. Upper icons and other weapons keep native positions.

Scorpion's arcade progress is the primary recharge field identified by its native shot-readiness calculation, rather than its secondary missile-charge field used by the original weapon bar. Shaft uses the current state object when it is an instance of the dedicated cooldown class discovered in the native state-machine registration. The registration result is an integer state ID, not the cooldown object. Its current state, cooldown deadline, duration, clock and arithmetic helpers are discovered from native functions. Completion outside that cooldown state shows a full bar. During native stun/pause flags, the last observed progress for the same weapon instance is retained until the native state and deadline resume. Missing or nonfinite telemetry hides the extra row. Original health and weapon progress updates remain intact.

No independent reload timer, firing-input listener, timing table, or augment-artwork multiplier is used. Native removal also removes the extra row. A separate diagnostic local-storage flag, `kasp_arcade_reload_enabled`, controls whether the injector installs the hook on the next page load; absent means enabled. `__kaspArcadeReloadDebug.setEnabled(false/true)` persists it but does not hot-remove existing meshes. No gap setter exists. The `k_arcade_reload` settings switch takes effect without reloading.


All necessary signatures must match uniquely before modification. Identifier renaming, dollar signs, whitespace, quote styles and tested minification variants are supported. Unsupported structures leave this feature's source unchanged and produce a diagnostic. This is an adapter to the current game structure, not a guarantee against arbitrary engine rewrites. Runtime errors hide the extra row, disable further attempts for that native HUD component and preserve the original panel update. `window.__kaspArcadeReloadDebug.status()` reports `hooked`, `panel`, `issues`, update count, the latest weapon/progress/mesh sample and `error`.

### Critical Shot Indicator

Sources: [criticalIndicator.ts](src/core/criticalIndicator.ts), [criticalDevices.ts](src/core/criticalDevices.ts), [critical-ast.cjs](tools/ast/critical-ast.cjs), [critical-events-ast.cjs](tools/ast/critical-events-ast.cjs), [critical-supercharge.cjs](tools/ast/critical-supercharge.cjs), and [critical-vehicle.cjs](tools/ast/critical-vehicle.cjs).

**Activation:** Automatic native local-HUD observation, with a live `k_critical_indicator` settings switch. Ordinary device cycles support Thunder/Strict Ammunition Load, Smoky/Sorted Ammunition, and Hammer/Revolver. Supercharge can show forced critical readiness even without a supported ordinary device cycle.

The prepared contract covers server readiness/reset callbacks, `TankInfoCC` equipment fields, native shot/lifecycle event prototypes, entity event dispatch, shooter damage metadata/collections, `TankSuperchargeCC` and its activation paths, local bar material attachment/frame/disposal. The offline vehicle analyzer resolves the `terminatorWeapon` semantic getter, component class, token factory, and optional entity lookup. Each HUD frame checks the actual local tank for this component before updating the indicator; it never infers transformation from the map mode or garage IDs. `juggernautHook` is required in prepared plans, preventing an old plan from bypassing this guard. Vehicle transitions discard ordinary readiness/cycle/recovery state while retaining native lifecycle state and the independently observed Supercharge effect. A failed lookup restores native color without interrupting rendering. No native tank or remote nameplate visibility field is written. Mappings must be complete before installation.

`createCriticalIndicator(resolveDevice)` uses WeakMaps for actor readiness, equipment, event prototypes, ordinary cycles and post-effect state; WeakSets track charge/recovery. A Map owns currently attached HUD materials and is cleared through detach/configure. Debug counters count observed native events, including remote events; HUD output resolves the local entity.

| Bridge callback | Behavior |
| --- | --- |
| `configure(schema)` | Validate required fields, restore old material colors, clear attached bars, install schema. |
| `ready(actor, entity, boolean)` | Store native readiness and clear pending post-effect recovery. |
| `reset(actor, entity)` | Clear readiness, cycle, charge, and recovery state on kill. |
| `equipment(entity, info)` | Read mapped equipment IDs; changed IDs invalidate previous actor/cycle recovery. |
| `attach(owner, bar, red)` | Retain the native material and original foreground alongside a native red color. |
| `frame(owner, entity)` | Resolve metadata/state/readiness, color the local bar, and record a detached sample. |
| `detach(owner)` | Restore native color and release the attached material. |
| `eventType(prototype, kind, field)` | Register native shot/lifecycle event contracts. |
| `event(entity, value)` | Reset phase on detected respawn/death, suppress inactive states, and count native shots including misses. |
| `damage(entity, collection, kind)` | Inspect bounded native damage packets for calibration and post-effect synchronization. |
| `supercharge(entity, active)` | Track forced critical state and initialize recovery when the effect ends. |
| `juggernaut(entity, active)` | Track the actual Terminator component; discard ordinary readiness/cycle/recovery state on vehicle transitions, preserving lifecycle and Supercharge. |

While the local tank uses **Terminator**, ordinary Thunder/Strict Ammunition Load, Smoky/Sorted Ammunition, and Hammer/Revolver counters do not apply, even if those items remain in the equipped garage metadata. Outside Supercharge the bar retains its native color, with diagnostic reason `juggernaut-weapon`. Supercharge has priority and can still mark forced critical readiness; its expiration does not restart the ordinary augment counter on Terminator. Returning to the ordinary tank uses its own lifecycle or confirmed critical state. The diagnostic sample exposes `juggernaut` separately from `supercharge`.

Live metadata from `__kaspAugmentsDebug.device(id)` takes priority. `knownCriticalDevice()` supplies detached fallback profiles for three exact server IDs so direct battle entry need not visit the garage:

| Weapon | Base item ID | Device ID | Start / after-crit chance | Regular cycle |
| --- | --- | --- | --- | --- |
| Thunder | `920009631123` | `1931009774129` | `1` / `-1` | Third shot |
| Smoky | `920009630969` | `921009712832` | `1` / `-2` | Fourth shot |
| Hammer | `920009631046` | `1931009803197` | `-1` / `-1` | Third shot |

`cycleProfile()` requires a unique finite override for each of `START_CRITICAL_HIT_CHANCE`, `AFTER_CRIT_CRITICAL_HIT_CHANCE`, `MAX_CRITICAL_HIT_CHANCE`, and `CRITICAL_CHANCE_DELTA`, with supported bounds, maximum `1`, and positive delta up to `1`. Device names identify the supported family and a supplied base ID must match equipped weapon ID. The fallback is a catalog snapshot, not a guarantee that server properties never change.

A new `SEMI_ACTIVE` phase clears old state and seeds the next active cycle from the start property. `ACTIVE` permits indication; inactive lifecycle states suppress it. Thunder/Smoky start ready, Hammer reaches its first critical on shot three. Each observed shot consumes ready state or increments chance, regardless of whether damage is reported. Native readiness overrides the inferred cycle. Joining an ongoing life without a known phase waits for readiness/critical calibration. Confirmed damage does not rewind an already tracked ordinary phase.

Supercharge forces red while active and suppresses ordinary-phase calibration from forced damage. Ending it seeds `after - delta`; observed first critical recovery is shot four for Thunder/Hammer and shot five for Smoky. These offsets reflect player observations; the server's transition formula is not exposed in this bundle. Recovery tracks shots, ordinary acknowledgements, and expected first critical. Late forced packets cannot synchronize immediately; accepted critical damage restores the regular phase and retains later shots fired while the acknowledgement was in flight.

Only the local bar's mapped foreground is written. `paint()` requires a writable own data descriptor, remembers a replacement native color, and restores it when no longer ready. Native errors are recorded with a normal-color restoration attempt; generated callbacks are guarded. Red is `#FF0000`. There is no additional mesh, keyboard/mouse listener, timer, or persistent shot-count cache.

`__kaspCriticalDebug.status()` exposes mapping, attachment, weapon/device IDs/name, readiness/source, frame/readiness/shot/hit/life counters, current reason/error, Supercharge and post-effect shot/calibration state. A ready plan proves contract matching, not live spawn/render/network success.

### Overdrive Box Timer

Sources: [src/modules/overdriveTimer.ts](src/modules/overdriveTimer.ts), [src/core/bonusPickup.ts](src/core/bonusPickup.ts), [src/core/overdriveDirection.ts](src/core/overdriveDirection.ts), and [styles/overdriveTimer.css](styles/overdriveTimer.css).

The module is registered as `modules.overdriveTimer`. Boot calls `setup()` once and `sync()` during normal heavy passes. A 250 ms interval maintains the display even when the battle DOM is otherwise idle. The setting `k_overdrive_timer` defaults to `false` and uses the existing settings panel, boolean cache, and settings-close reload workflow.

#### Pickup Bridge and Bundle Transformation

The MAIN-world injector installs the bonus bridge before processing the bundle. Offline [overdrive-ast.cjs](tools/ast/overdrive-ast.cjs) uses `bonus pickup`, `onBonusCollision`, resource fields, and native pool structure to generate a complete plan and templates. `selectBonusPatchPlan()` selects exact/adaptive data and `patchBonusPickups(code, report, plan)` validates edits. Missing or ambiguous contracts skip this interception without replacing its original operations. The runtime does not rediscover diagnostic schemas by parsing the entire bundle.

Generated constructor hooks register mapped native `Vector3` and `BattleBonusData` prototypes through `__kaspBonusType` / `registerBonusType()`. The runtime registry uses WeakMaps, reads own field descriptors, and permits a bounded prototype-chain lookup. `createBonusPickupBridge()` uses those supplied box/pickup-sound fields and bounded model traversal rather than scanning diagnostic method source. Two-number game IDs retain their decimal representation. Ambiguous sound-to-model associations are rejected; the shared sound `118254` cannot independently identify an overdrive box.

The call insertion uses `__kaspBonusPrepare(resource, soundField, instance)`. It evaluates the original sound property once and returns the unchanged argument. Model traversal excludes that property to avoid evaluating its getter again. Registration stores a detached copy of the spawn position in a WeakMap keyed by the native bonus instance, replacing or clearing it whenever the pool object is reused. The resolved resource model and matching registered origin are placed on a short-lived stack keyed by the actual sound argument. The method observer consumes the matching stack entry in `__kaspBonusContext(sound, position)`, normalizes the second argument with `readBonusPosition()`, and emits the paired model and coordinates. A matching registered origin takes precedence over the landing position from the pickup argument. Nested calls sharing one sound use separate stack entries; unused entries are removed at the next microtask to prevent aborted calls from contaminating later events. An unpaired context does not emit a guessed model.

`readBonusPosition()` uses registered coordinate names, falling back only to literal own `x/y/z`, and requires finite numbers. Arbitrary three-number objects are not vectors. Offline analysis handles native coordinate field order and quoted/computed access; no diagnostic method is executed to discover fields at runtime. MAIN world posts `{ type: 'kasp:bonus-pickup', detail: { model, position } }`; invalid/missing position is `null`. The legacy `__kaspBonusPickup()` helper remains, while normal patches use paired arguments.

`OVERDRIVE_BOX_MODEL` identifies overdrive model `1647333199409`. Model `1647333199408` is a speed boost and does not start an overdrive countdown. The model identifier and bundle signatures depend on the game implementation. They should be checked after game updates; failure to match leaves the module waiting for a recognized pickup. No server respawn timestamp is read.

#### Optional Instance Diagnostics

`window.__kaspBonusDebug` exposes `status()`, `enable(value = true)`, `clear()`, and `export()`. `status()` works without enabling the journal and reports hook availability, matched pickup calls, registration hooks, and missing or ambiguous patterns. Incomplete hooks produce a console warning during bundle processing. Enabling persists the `kasp_bonus_debug` boolean in page local storage; reload before joining a battle to capture its initial registrations. Disabling stops collection and snapshot traversal. Records are kept in memory, capped at 200, and exported as JSON; page reload clears the journal. Clear does not disable collection. The debug switch is separate from the timer's display setting.

The `hooks` record reports whether the pickup call and argument observer were inserted, how many pickup calls and registration insertions matched, and any detection issues. A saved hook status is also recorded when debugging is enabled after bundle processing. The pooled registration insertion forwards bonus data, ID, position vector, and the native bonus instance after its initialization. Legacy scalar registration forwards three coordinate arguments. A `register` record contains resolved model/sound IDs, an instance ID snapshot, and a normalized spawn position.

`pickup-model` records capture the resource model prepared for the timer message. The pickup method invokes `__kaspBonusContext(first, second)` after its caller has evaluated the arguments; `pickup-context` records contain the paired model, a `paired` flag, normalized position, and bounded snapshots of both arguments. Original call arguments are not evaluated twice and are not changed. A registration alone does not start a countdown. Invalid registration coordinates are additionally recorded as bounded `coordinateArguments` snapshots for investigation.

`snapshotBonusArgument()` limits depth to three levels, twelve fields per object, and an object traversal budget of 120. It detects cycles, summarizes long IDs, truncates strings, and isolates inaccessible properties. Console output contains JSON snapshots rather than live resource objects. Exceptions in diagnostic output or the inserted context observer cannot interrupt original pickup playback. Collect appearances and pickups at both locations, then use `copy(window.__kaspBonusDebug.export())` in the game page console to export data for comparison. Location assignment prefers the registered spawn origin of the paired bonus instance, falling back to the pickup vector when no valid registration is available. `pickup-context` records include `pickupPosition` and `positionSource` so this choice can be inspected.

#### Countdown State and Battle Lifecycle

`createOverdriveCountdown(now, boxModel)` owns a nullable deadline for one model, defaulting to the overdrive model. A matching `pickup(model)` sets it to `now() + OVERDRIVE_COOLDOWN_MS`, where the interval is exactly 85,000 ms. Other models leave it unchanged. `remaining()` returns `null` before a pickup, then the nonnegative ceiling of the deadline difference in seconds. Delayed browser ticks therefore do not accumulate drift. `reset()` clears the deadline. At zero the module waits for a subsequent pickup instead of automatically starting another cycle.

`createOverdriveLocations(now)` owns two independent countdown entries and two initially null positions. The first valid pickup position is assigned to the first entry. Subsequent positions are compared by horizontal Euclidean distance with existing anchors; the nearest anchor within `OVERDRIVE_POINT_RADIUS` (1,000 game-world units) is reused. Otherwise the remaining empty entry becomes the second point. Anchors are learned per battle and never hardcoded from a map or diagnostic dump. A third distant point is ignored. With no position available, the primary timer can act as a fallback while fewer than two positions are known; once both are known, unlocated events cannot safely choose a timer and are ignored. Reset clears deadlines and anchors.

The message listener requires `event.source === window`, the expected message type, a string model identifier, an enabled setting, and a mounted battle canvas. It processes pickups reported by the client regardless of the collecting player. This page-to-extension bridge is observational and is not an authenticated source of server state.

`syncBattle()` tracks the canvas element through `gameDOM.screens.battleCanvas`. Removing or replacing that element outside an in-battle section clears the countdown. While the native tank preview has `TankPreviewComponentStyle-visible` or a visible `.-container` section is open, countdowns and learned positions are preserved even if the canvas is temporarily unmounted. A resumed section can remount a new canvas without resetting deadlines; up to one second is allowed for the return transition. Native lobby and result screens end the battle session. A mounted result screen suppresses the panel and clears the deadline. The existing `kasp:battle:id` event also resets it when delivered. Entering a battle does not start a speculative initial timer. State is kept in memory and does not survive a page reload.

#### Presentation

`render()` creates `#kasp-overdrive-timer` only during an enabled battle after an observed pickup starts its countdown. It displays numeric `minutes:seconds`, keeping `0:00` after completion. The background is yellow during the normal countdown, reddish during the final ten seconds, and green at zero; the text remains dark in every state, with a 0.2-second background-color transition. Text and title updates are conditional to avoid repeatedly waking the master DOM observer. Disabled or non-battle states remove the panel. The stylesheet places a centered grid wrapper at `top: 2.5em; left: 50%` with `translateX(-50%)` and columns `3.5em 10em 3.5em`. Medium-weight game fonts and dimensions in `em` follow the HUD scale. Pointer events are disabled, so it does not intercept battle controls.

The displayed deadline estimates a box's next appearance from a pickup; it does not confirm that a box is currently on the map. There is no manual restart key, sound alert, paid-access gate, or persistent deadline.

`renderTimer()` uses the `.kasp-overdrive-timer` styling. The primary panel occupies the right grid column; `#kasp-overdrive-timer-secondary` occupies the left column after a pickup at the second learned point. Neither is displayed before its first pickup. Both represent the same overdrive model at different positions; speed boosts remain excluded. Completion keeps `0:00` and changes only the background to green. An observer watches section insertion/removal and class, style, or hidden attribute changes: a visible native preview or `.-container` hides both panels without clearing deadlines, and returning to battle restores their current values. Container visibility is checked through layout rectangles and computed display, visibility, and opacity. Selectors are defined in `gameDOM.screens.tankPreview`, `gameDOM.screens.visibleTankPreview`, and `gameDOM.common.container`. The proximity tolerance is heuristic and requires verification on real maps, especially when spawn points are close together or pickup vectors vary significantly.

#### Direction Segment

An independent `overdriveDirection` feature scope observes the local tank body's position and the rendered camera's Euler Z rotation. [overdrive-direction-ast.cjs](tools/ast/overdrive-direction-ast.cjs) identifies the physics component, canonical vector fields, camera controller, local HUD frame, and cleanup using native semantic evidence. Run `node tools/prepare/prepare-overdrive-direction.cjs <client.js>` to prepare [overdrive-direction.json](src/generated/overdrive-direction.json). Exact plans and compatibility templates use the shared validated edit merger; ambiguous mappings are skipped. The frame callback is guarded and does not replace native results. Direction does not depend on enabling the critical indicator or arcade reload bar.

`__kaspOverdriveDirection.wanted()` gates sampling to once per 80 ms while the timer setting is enabled and the document is visible. The handler reads mapped fields directly without a graph traversal, posts a validated `kasp:overdrive-direction` pose message, and clears the pose on cleanup or invalid data. The timer rejects stale, out-of-order, or excessively future-dated messages; samples older than 750 ms hide the segment while the countdown continues. Bearing uses horizontal position differences and camera yaw, with zero degrees pointing ahead and positive angles clockwise. Each timer uses its own learned point. Within 100 horizontal world units of a point, its segment is suppressed to avoid unstable direction at zero distance.

The black masked conic gradient occupies only the timer's outer edge. The registered `--kasp-overdrive-bearing` angle interpolates over 100 ms; angle unwrapping prevents a full-circle detour when crossing ±180 degrees. Reduced-motion preferences disable bearing interpolation. Background countdown colors remain independent. This indicates a direct bearing, not an unobstructed path. `window.__kaspOverdriveDirectionDebug.status()` reports mapping, enabled/valid state, sample count, and feature runtime status.

### Equipment Change Indicators

Source: [src/modules/changeCounter.ts](src/modules/changeCounter.ts).

**Activation:** Automatic, with listeners installed when the module is imported.

The private `playerChanges` map restores `kasp_player_changes_cache` from session storage when readable. `saveCache()` serializes the map; `clearCache()` clears both forms.

A `kasp:useraction` message must contain an array beginning with `TankUserActionLog` and including `CHANGE_EQUIPMENT`. Nickname selection excludes known tokens, values beginning with `-`, and values without Latin letters or the expected length. The first remaining candidate is counted.

A separate battle-kind listener requires `event.source === window` and accepts only exact `MM` or `PRO` values for `window.__kaspBattleKind`. The user-action listener validates its message contents but has no equivalent source check. Neither message is authenticated server evidence.

`sync()` adds one `kasp-change-th` header and `kasp-change-td` cell per supported row, parses the original nickname, and toggles `kasp-changed` according to whether its observed count is nonzero. `update()` delegates to `sync()`; the interface is an indicator rather than a universal numeric count display.

`onTick()` calls `checkBattleCanvas()`. Transitioning out of `.BattleComponentStyle-canvasContainer` clears the cache. A `kasp:battle:id` document event also clears it; the current TypeScript code contains this listener but no in-repository producer of that event.

### Resistance Presentation

Source: [src/modules/zeroResists.ts](src/modules/zeroResists.ts).

**Activation:** Automatic when team/result statistics containers exist.

`sync()` invokes four operations in order: header shield, compact resistance cells, zero summary, and expansion toggle. `update()` is an alias for this synchronization.

| Function | Responsibility |
| --- | --- |
| `readStyle(element)` (local to each `sync()`) | Share one computed-style read per element within a synchronization pass. |
| `getCssUrl(el)` | Read supported mask/background CSS properties. |
| `getIconUrl(label)` | Extract a mask URL or image URL. |
| `injectHeaderShield()` | Insert the shield heading after the GS header when absent. |
| `injectCompactCells()` | Clone recognized protection and critical-resistance labels into two compact slots. |
| `injectZeroSummary()` | Add `×0` entries for configured types missing from the native summary. |
| `injectToggleButton()` | Add the expansion control and restore/persist its state. |

Compact protection prefers an all-resistance/Spectrum icon, otherwise a heuristic red-colored label. A remaining critical-resistance label becomes the second slot. Labels are classified in one traversal, and native cells are read before compact presentation writes begin. A state key includes the selected native labels' markup and Spectrum classification, so values and icons can change even when row/cell counts remain unchanged. Unchanged compact content is retained; changed slots are built off-DOM and replaced together, and absent entries use dashes.

The zero-summary pass reads resistance icon filename patterns from native entries, skips generated zero entries, removes zeros when their native type appears, and adds missing configured types. Existing zero types are indexed in a set, and missing entries are inserted together through a document fragment. This represents absence from the observed summary, not independently measured zero protection for every player.

`kasp_tab_expanded` controls the body class and active toggle. Computed styles are cached only within the current synchronization pass; the next pass rereads reused native nodes, including changes supplied through CSS. The master observer remains connected and synchronization is not skipped based on row/cell counts. The redundant backdrop blur behind the opaque TAB background is removed.

Hovering a resistance cell retains the original inline reveal: that player's module cell widens and the two neighboring combat-statistic cells temporarily hide. There is no floating panel. Button-controlled expansion of the entire TAB uses `src/modules/tabExpansion.ts`: it snapshots collapsed/expanded pane and column widths on a representative populated header/body row, then drives both the frame and all columns through the same registered CSS progress property for 200 ms. This avoids separately interpolating percentages while the containing pane is itself growing. Rapid reversals reuse the current progress. Temporary pixel geometry is removed after the transition, on resize, or on feature cleanup, returning control to the native responsive CSS. Measurement errors restore the prior state; incomplete layouts skip the animation. No per-player animation-frame loop is installed. Reduced-motion preferences disable the shared transition; browsers without registered-property interpolation still switch to the correct final layout.

#### Enemy Weapons Popup

[enemyWeapons.ts](src/modules/enemyWeapons.ts) adds a matching turret-icon button beside the expansion toggle. It has its own feature scope and cleanup. The master observer synchronizes the control after resistance presentation; inserting it or changing its popup content does not feed back into another TAB pass.

`readEnemyWeapons()` finds the native local selected row inside the blue/red team containers, then reads player rows from the opposite container. A DM table instead counts every other player. Spectators are excluded. Without a recognized local team it returns unavailable rather than guessing by team order or nickname. The first icon in each row's weapon equipment block supplies the weapon; augment and resistance cells do not contribute counts. Image sources and inline mask/background URLs are preferred, with computed styles as fallback. Only validated Tanki image URLs are read. Known filename aliases map to the shared [turretIcons.ts](src/core/turretIcons.ts) resistance assets; Terminator can reuse its native silhouette, and unsupported or missing icons contribute to an unknown count. Results sort by descending count, then key.

Hover or keyboard focus creates a fixed, noninteractive popup above the button, horizontally centered and clamped to the viewport. It shows white weapon names, resistance silhouettes, and counts on an opaque `rgb(21, 21, 21)` background with a white perimeter border. Up to nine distinct weapon types use one column; more than nine use two balanced columns (seventeen types occupy nine and eight rows). A 250 ms interval runs only while open, covering equipment changes without child-node mutations. Native TAB mutations also refresh open counts immediately. Unchanged content is retained; pointer movement does not move the popup. Both TAB action buttons have enlarged square targets and nonshrinking icons. Mouse clicks on the hover button are intercepted to avoid native activation or mouse-focus decoration; keyboard focus uses a white outline. Mouse leave, focus loss, Escape, window blur, document hiding, TAB disappearance, and feature cleanup remove the popup and cancel its interval. No native bundle transformation or additional game request is needed.

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

This window does not use the shared modal controller, so it does not inherit all shared backdrop/key/cleanup behavior. Template failure is logged, and the session guard prevents an automatic retry during the same page execution. Version acknowledgement is origin-wide. The template now has seven role placeholders, including `role7` for Assistants; both EN/RU dictionaries and replacement calls cover them. Exact current names and roles are reproduced at the end of README and both full publication descriptions.

## Battle History Implementation

Sources: [facade](src/modules/battleHistory.ts) and [implementation directory](src/modules/battleHistory).

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
| `actions.ts` | ID-scoped clear, export, import, and clear confirmation |
| `localization.ts` | History, management-dialog, and status-message dictionaries |

The dependency direction is deliberate: storage does not manipulate UI; capture builds a record before saving; presentation does not query IndexedDB; views combine data and templates; navigation manages the surrounding native page. The facade connects them through narrow callbacks and a `HistoryAccount` object.

### Facade and Account Context

Ownership starts unresolved and is established only by `getVerifiedAccount()`. No last-account/nickname cache is used. Legacy `kasp_last_nickname` remains untouched.

| Function/object | Behavior |
| --- | --- |
| `updateIdentity()` | Read the native account ID; release old views on ID changes and update display metadata. |
| `account` | Expose `getUserId`, `getNickname`, and `updateIdentity` to controllers. |
| `createHistoryPage()` | Fetch/localize the overlay skeleton, check the account snapshot, insert it hidden, and bind management/close actions. |
| `ensureHistoryPage()` | Update identity and share a single pending creation promise; release that promise after completion/failure. |
| Exported `battleHistory()` | Gate by `k_history`, initialize shortcuts, inject entry controls, prepare the overlay, and dispatch/reset capture. |

First activation binds history shortcuts once and schedules an additional identity refresh after five seconds. Page preparation can start before the user clicks the footer entry.

`createHistoryPage()` snapshots user ID and language before awaiting its template. It rejects non-success responses and refuses insertion if ownership changed or another overlay appeared. Its replacements go through `renderHistoryTemplate()`.

On each eligible update, capture runs only when both the self row and result text are present. Once result text disappears, the result guard resets. Missing/stale identity defers capture without a nickname fallback. Temporary loss of identity does not unlock a previously processed result.

### Record Types

Source: [types.ts](src/modules/battleHistory/types.ts).

#### BattleData

| Field | Meaning |
| --- | --- |
| `id?` | Local IndexedDB primary key |
| `battleId?` | Portable record identity; new captures use UUIDs and legacy records derive it from their old numeric key |
| `userId` | Exact decimal native account ID; logical record owner |
| `nickname` | Historical display name; never ownership |
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

`openDatabase()` opens `TankiBattlesDB` at version 5. During upgrade it reuses or creates `battles` with `keyPath: 'id'` and `autoIncrement: true`, then ensures non-unique `date`, `map`, `mode`, `top`, and `userId` indexes. The old `nickname` index is deleted; existing unassigned records remain in the store.

The upgrade adds missing structure without explicitly clearing records. Successful connections close themselves on `versionchange`. Open failures reject; there is no dedicated user-facing blocked-upgrade handler in this helper.

#### Transaction Wrapper

`transaction<T>(mode, enqueue)` opens a connection and synchronously enqueues requests inside the transaction. A callback updates the eventual result; successful request execution alone does not resolve the outer promise.

`oncomplete` resolves after commit. Transaction errors record failure, abort rejects, and synchronous enqueue errors attempt to abort. A `finally` closes the connection regardless of outcome.

This separation matters for UI correctness: import/clear completion must mean committed writes, rather than the first request reporting success. Keeping request creation synchronous also avoids allowing the transaction to become inactive during arbitrary awaited work.

#### Repository API

| Function | Operation |
| --- | --- |
| `addBattle(battle)` | Add one record and return its generated key after commit. |
| `addBattles(battles, userId)` | Require valid IDs and matching ownership; read existing IDs and add only missing records within one write transaction. Return the committed insertion count. |
| `getAllBattles(userId)` | Read only the user ID index. Missing/invalid IDs return an empty list; never read all owners. |
| `clearAccountHistory(userId)` | Delete only the verified owner's indexed keys. |

These helpers do not sort battles by date, prove that recorded battles happened, or validate each record's complete content. Writes require valid account IDs and batch ownership must match. Controllers and views supply the intended scope and presentation order.

### Result Capture

Source: [capture.ts](src/modules/battleHistory/capture.ts).

#### Parsing Helpers

`parseMapAndMode(rawText)` trims text and checks its final word against known mode codes. A matched suffix is removed from the map text. Missing text uses `Unknown Map` and `MM`; an unrecognized suffix retains the map text and uses `MM` as mode.

`readInteger(row, column)` reads a numbered native kill-board column, removes whitespace, parses an integer, and falls back to zero.

`readPlayers(tbody)` iterates native rows, skips `rowSpace`, and uses `teamRowSpace` as the point after which `isEnemy` becomes true. It records original nickname text, rank image, GS, numbered statistics, and `isMe` from the self-row ID.

For ordinary team results, this flag initially represents position relative to the native divider; it is not recalculated from a separate authenticated team identity. DM capture replaces the flags with `isEnemy = !isMe`.

`readPlacement(selfRow)` determines which side of the divider contains the self row and computes its one-based position within that group, excluding spacer rows. Rows without IDs are excluded from its counted player set.

#### Building a Battle Record

`readBattleResult(selfRow, nickname, userId)` has no database write or capture-state mutation. It requires score/kills/deaths cells with non-empty text before producing a record.

It reads players, map/mode, and native result text. DM is recognized by mode or empty result text; missing non-DM result text can use the `Victory` fallback. Team scores are included only when both parse successfully and are oriented using the self row's divider side.

Current-player K/D is recalculated as `kills / deaths` rounded to two decimals when deaths are positive, otherwise as kills. Other player K/D values come from their displayed column. `date` uses `Date.now()` at observation, and kind uses `window.__kaspBattleKind` with `MM` fallback.

Equipment is copied from `equipmentTracker.get()` or represented by empty strings. The record therefore combines live result-screen data with the latest auxiliary equipment cache.

#### Capture Guard and Generation

`createResultCapture(account)` owns the processed account ID, result generation, and save-attempt guard. Its `capture()` updates identity, requires a self row, and exits if the current observed result is already processed.

It waits for verified account ownership and complete statistics. A contradictory self-row nickname defers capture; the row cannot establish ownership.

After building a record, it marks the result processed **before** awaiting `addBattle()`, preventing concurrent observer calls from queuing the same result repeatedly. A failed write unlocks retry only when its saved generation still matches the current generation.

`reset()` advances the generation and clears the guard. An old asynchronous failure therefore cannot unlock a newer result that has already been processed. Capture deduplication is an in-memory lifecycle guard; import additionally checks portable record identities in a write transaction. Separate captures with different identities are not merged merely because their contents look alike.

### Import Validation

Source: [validation.ts](src/modules/battleHistory/validation.ts).

`parseHistoryImport(text, userId)` parses JSON, requires a non-empty array, and applies `validateImportedBattle()` to every element before returning the normalized batch. A single invalid, foreign-owner or missing-ID record throws before `addBattles()` starts.

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

Only explicitly reconstructed fields are returned. `battleId` survives import; older positive numeric `id` values become `legacy:<id>` identities. Local destination primary keys and unrelated fields are stripped. Imports without a valid record identity are rejected. Repository insertion skips IDs already stored for the owner and repeated IDs within the same file; the UI reports the actual number added.

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

`releasePage()` closes the clear dialog through their shared close method, hides history, restores background and saved native-content display, disconnects the page observer, and removes the resize handler.

`closeHistoryOverlay()` performs release, optionally arms return handling, and invokes native back when the title still identifies history. `flashHideSettings()` briefly covers the transition, with observer-driven and 2,000 ms fallback removal.

`armExitAfterReturn()` watches for the native Settings title for up to 20 seconds. On recognition, it installs a short loader and clicks native back after 150 ms. Loader observation/fallback avoids retaining that transition indefinitely. `disarmReturnWatcher()` clears its timers and observers.

The exported `release()` combines page release and return-watcher disarming. Account changes use it without deliberately navigating native back.

#### Shortcut Rules

`bindShortcuts()` installs listeners once. While history is open, Space and digits/numpad 1–7 are blocked outside input/textarea focus to prevent Enhanced Play interference.

Escape/Z close visible history unless a clear modal exists or input/textarea focus excludes handling. A mouse-button-3 listener also closes visible history. These feature-specific guards are not identical to the broader editable-control checks in Enhanced Play or the shared modal controller.

### Management Actions

Source: [actions.ts](src/modules/battleHistory/actions.ts).

`createActionButton()` uses text nodes and optional secondary styling. `createHistoryActions(account, renderBattleList)` returns three action callbacks.

#### Clear

`clearHistoryDb()` opens `showClearConfirmModal()`. Cancel only closes; one guarded confirmation closes the modal and calls the supplied async deletion action.

Deletion captures the user ID before opening confirmation, rechecks it before writing, awaits `clearAccountHistory()`, and refreshes page one. Other accounts and unassigned legacy rows remain stored.

An account switch cancels a stale confirmation. Navigation release closes an existing clear dialog.

Nickname linking and its UI, repository operations, styles, and translations have been removed.

#### Export

`exportHistoryData()` updates identity, snapshots the user ID, and reads its records. Empty results return without a file. Otherwise, it creates a readable JSON array in an `application/json` Blob, clicks a download link, and revokes the object URL in `finally`.

The filename is `Tanki_BattleHistory_<userId>_<UTC-date>.json`. Export preserves portable `battleId` values; legacy rows receive identities derived from their original local keys. Import preserves that identity while letting the destination database allocate its own numeric primary key. This record identity is not the game's server battle ID. Export covers one account ID and does not include extension settings or all database owners.

#### Import

`importHistoryData()` creates a `.json` file picker and reads its first selected file with `FileReader`. The file extension filter is a picker hint; actual acceptance is determined by parsing and validation.

After `parseHistoryImport()` validates the entire array, `addBattles()` writes it atomically. The list then refreshes and a count message is shown. Reader, JSON, validation, or transaction errors go through `showImportError()` and a localized alert.

Every record must carry the selected native account ID. Foreign-owner and legacy missing-ID files are rejected before writing; there is no reassignment or nickname linking. Historical display names within the same ID are retained. Import skips existing record IDs and duplicate IDs within the file. It does not infer duplicates from timestamps, scores, or identical-looking contents. The complete file is read into memory; no streaming import, size cap, or chunked validation is implemented.

### Invalidated Extension Context

[context.ts](src/modules/battleHistory/context.ts) recognizes `Extension context invalidated` after the browser reloads or updates the extension while the game tab still runs its old content script. The first recognized failure stops history updates, removes the detail view, replaces the list with a localized reload notice, disables management controls, and updates the history entry tooltip. Pending renders check the invalidated flag before updating the view. Other errors retain their normal handling. Recovery requires a full game-page reload; the module does not reload the game automatically.

### History Localization

Source: [localization.ts](src/modules/battleHistory/localization.ts).

`historyTranslations` defines RU/EN view labels and result wording. `getHistoryDictionary()` chooses RU only for exact `RU`, otherwise EN. Separate getters expose clear-dialog text and import status messages.

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

The manifest declares 25 stylesheets at document start. `mainUI.css` also imports seven component styles already listed by the manifest; the current loading configuration therefore references those resources through both mechanisms.

| Stylesheet | Implementation role |
| --- | --- |
| `styles/mainUI.css` | Imports animations, shared presentation, garage buttons, navigation, header, battle statistics, and kill-board CSS. |
| `styles/shared.css` | Root color variables, loader background, shared game backgrounds, collection surfaces, and general UI treatment. |
| `styles/animations.css` | Button effects, metal shine, shared modal entrance/exit, and history card/list/detail transitions. |
| `styles/modal.css` | Shared modal overlay, dialog, body, actions, buttons, and opening/closing states. |
| `styles/battleHistory.css` | History layout, cards, detail tables, controls, pagination, equipment placeholders, and status presentation. |
| `styles/garageButtons.css` | Active/disabled button classes, mask presentation, and directional hover effects. |
| `styles/navigation.css` | Native navigation item geometry, hover, shine, and related visual rules. |
| `styles/cybersport.css` | Scoped Esports prototype and source Sport visual state; custom image variable, gradients, hover/focus, and selection. |
| `styles/header.css` | Header currencies, icon arrangement, and header presentation. |
| `styles/accountSearchNotice.css` | Delayed lobby identity-search status, monochrome artwork and fade transitions. |
| `styles/lobbyPasses.css` | Native white pass cards, two challenge tracks, lock state, linear progress and hover shine. |
| `styles/lobbyAnnouncements.css` | Text-only native announcement carousel with timer and monochrome navigation. |
| `styles/lobbyNavigation.css` | Native left-menu tiles, original icon masks, Crystal panorama and compact footer. |
| `styles/battleStats.css` | Native battle-statistics layout plus related equipment/resistance/skin presentation. |
| `styles/killBoard.css` | Result-table geometry, columns, headers, and kill-board layout. |
| `styles/overdriveTimer.css` | Two non-interactive countdown panels, colors, anchors, and visibility. |
| `styles/augmentSpecs.css` | Specification controls, tooltip columns, and adjusted-value presentation. |
| `styles/customFriends.css` | Sidebars, category controls, rarity badges, and list arrangement. |
| `styles/customPaints.css` | Paint search input and collection layout. |
| `styles/customTrophies.css` | Favorite stars, limits, lobby trophy panel, and progress bars. |
| `styles/hideCurrency.css` | Masked currency/tooltip presentation. |
| `styles/hideNickname.css` | Immediate nickname/XP masking, full UID-and-delimiter hiding, self selectors, pseudo-labels and supported hover reveal. |
| `styles/hideSupplies.css` | Zero replacement on the supply strip and omitted quantity labels on garage inventory cards. |
| `styles/settings.css` | Tiled settings navigation; four feature groups; Information links; shared image slices, entrance, scrolling and switches. |
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
| `assets/playButton.png` | Legacy/native enhanced Play artwork used by its underlying controller |
| `assets/art1.png` | Shared right-lobby card artwork and account-search notice |
| `assets/art3.jpg` | Shared left-lobby tile and settings artwork |
| `assets/cybersport.png` | Native Sport-clone artwork for the first Esports UI stage |
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

`database/augments.json` is retained as a legacy packaged file. Augment Specifications no longer fetches it, resolves its `$shared` entries, or uses it as a fallback. The current source reads the session catalog described under [Game Augment Catalog](#game-augment-catalog).

Numeric protocol properties, localized server descriptions, IDs, equipment associations, and observed artwork are saved in the session JSON. Presentation arrays and supported live multipliers are derived at lookup time. A narrative conditional effect is not automatically converted into a numeric modifier.

Augment Specifications reads decoded garage modifiers. Weapon Reload Indicator reads live native weapon cooldown state, including the duration maintained by the game, rather than recalculating a fixed turret/augment table.

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
| Thirteen `k_*` feature keys | `true`/`false` strings | Origin-wide settings; cached by Core Settings services |
| `kasp_arcade_reload_enabled` | Diagnostic Boolean string, absent means enabled | Read once for hook selection on each page load |
| `kasp_bonus_debug` | Opt-in Boolean string | Enables page-local bounded bonus journal; does not persist journal records |
| `language_store_key` | Game-owned language text | Read for language selection; not an extension setting |
| `tankiCustomCategories_uid_<userId>` | JSON object: friend user ID to color | Per native account ID; old keys remain separate |
| `kasp_trophies_favorites_uid_<userId>` | JSON array of ID/type/icon/current/max entries | Per native account ID; old shared key remains separate |
| `kasp_equipped_skins_uid_<userId>` | JSON object: canonical equipment to validated artwork URL | Account-ID-scoped equipped skin overrides |
| `kasp_tankoin_balance_uid_<userId>` | Validated numeric text: last observed Tankoin balance | Per verified native account ID |
| `kasp_equipped_skins` | Legacy shared skin overrides, no longer read or written | Preserved separately; no automatic migration |
| `kasp_base_images` | JSON object: equipment to original URL arrays; older strings supported | Origin-wide skin matching cache |
| `kasp_weapon_augment_tracker` | Legacy JSON configuration object | No longer read or written by the native reload indicator |
| `kasp_my_equipment` | JSON object: turret/augments/hull plus `savedAt` | Origin-wide latest observed self icons |
| `kasp_tab_expanded` | Boolean string | Origin-wide resistance display preference |
| `kasp_last_version` | Manifest-version string | Origin-wide welcome acknowledgement |
| `kasp_last_nickname` | Legacy nickname string | Retained, no longer read or written by history |
| `kasp_player_changes_cache` | Session-storage JSON object: nickname to count | Session/battle observations |
| `kasp_history_unassigned_v1` | Session-storage buffer of complete unassigned results | At most 20 records, 2,000,000 characters; 24-hour read-time age bound; never adopted by nickname |
| `kasp_augments_session_json` | Session-storage fallback for the device snapshot | Replaced on each page load; never restored as a data source |
| OPFS `kasp-augments.json` | Current serialized device snapshot | Game-origin private file; reset on page load, last writer across tabs |
| `TankiBattlesDB` / `battles` | IndexedDB records | Shared database, logical ownership through `userId`; legacy rows remain unassigned |

### Ownership Consequences

Account-specific history and friend categories coexist with origin-wide presentation caches. Logging into another account does not automatically clear all those caches. Original identity reading and visual privacy must remain separate from storage ownership.

Nicknames are display metadata. Renaming preserves history, friend labels, and trophy favorites for the same user ID. Legacy nickname-based/shared data is preserved separately without automatic migration.

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
| `message`, `kasp:game-augments` | MAIN-world model collector | Isolated catalog validation, indexing, and JSON persistence |
| `message`, `kasp:game-augments-request` | Isolated catalog startup | Current snapshot response for a late listener |
| Window `kasp:augments-updated` | Isolated catalog | Augment tooltip and numerical-update scheduling |
| Window `kasp:augment-cards-updated` | MAIN card binder | Reapply display after native DOM resets without another identical catalog snapshot |
| Window `kasp:settings-changed` | Settings setter | MAIN card binding, isolated specifications/privacy, Discord privacy refresh |
| `message`, `kasp:battle-presence` | Electron-only MAIN reader, once per second | Validated battle snapshot for Discord content module |
| `message`, `kasp:discord-presence` | Electron content module, every three seconds | Restricted preload/main-process IPC, or explicit clear on pagehide |
| `message`, `kasp:bonus-pickup` | Paired native pickup bridge | Enabled overdrive location/countdown state |
| `message`, `kasp:battle-kind` | Injector statistics hook | Content-script `__kaspBattleKind` |
| `message`, `kasp:battle-mode` | Injector statistics hook | No current source listener |
| Document `kasp:battle:id` | Not produced by current source files | Change Counter reset listener |
| Native local-HUD progress/position events | Game rendering | Arcade reload row from native weapon state |
| Native lifecycle/shot/readiness/damage/Supercharge callbacks | Guarded critical hooks | In-memory phase/readiness and local reload-material coloring |
| Keyboard/mouse back controls | User input or Electron adapter | Feature-specific tooltip/modal/history/navigation handling |
| `resize` | Browser window | History overlay/header geometry refresh |
| `animationend` | CSS animations | Modal removal and history transitions |

`src/core/pageMessages.ts` defines the typed page protocol and shared envelope/payload checks. Senders target the current page origin; consumers require both the same window and the exact origin. Account snapshots, action arrays, modes, positions, presence fields and Discord payloads have type/size/range checks. Augment messages additionally pass the existing full catalog validation before changing or persisting catalog state. These checks do not authenticate other scripts on the same page: messages are not proof of server-side action.

### Principal Dependencies

| Dependency | Consequence |
| --- | --- |
| Account Identity → Friends/History/Equipment/Privacy | Original nickname text must remain readable. |
| DataLoader → Paint Search/Augment Specs/History Presentation | Reference readiness or matching controls the available output. |
| Game model observer → Augment Catalog → Augment Specs | Current-session properties and exact card identity control device output independently of packaged reference readiness. |
| Injector → Change Counter/Battle Kind | Native fallback can load the game with incomplete tracking. |
| Equipment Tracker → History Capture | Recorded loadout quality depends on prior observation. |
| Shared Modal → Auto Upgrade/Clear | Common back-input and closing behavior applies to these dialogs. |
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
| Injector `bundleIntercepted` | Duplicate bundle interception | Verify successful hook execution |
| Upgrade `isRunning` and waiting-for-close | Concurrent sequences and repeated confirmation | Confirm server-side purchase completion |

Do not describe a guard as cancellation when it only ignores stale completion. Existing requests can continue and database transactions can still commit.

### Timer Reference

| Timing | Purpose |
| --- | --- |
| 150 ms | Shared heavy-module throttle |
| 250 ms | Additional garage skin observation; separate overdrive rendering interval while enabled |
| 250 ms | Supply privacy, kill-feed privacy and box-effect setting polling across worlds |
| 600 ms / 200 ms | Lobby account-search notice delay / removal transition |
| 250 ms | First verified-owner lobby presentation for trophies/Tankoin counter; not every section re-entry |
| Soft 2 ms / at most 64 steps | One native identity-discovery work slice; individual operations are not preempted |
| 0 ms then 8 ms | Initial captured-store discovery scheduling / subsequent slice delay |
| 1,000 ms | Account identity heartbeat and missing local-path retry; independent of presence heartbeat |
| 5,000 ms | Minimum secondary remote-player discovery interval after completion |
| 100 ms | Coalesced augment snapshot publication with late card binding |
| 1,000 ms | Augment binding scan while enabled; separate Electron battle-presence polling |
| 3,000 ms | Electron extension presence heartbeat |
| Up to 15,000 ms | Companion Discord changed-activity coalescing and reconnect delay |
| 50 ms | Enhanced Play selection polling |
| 1,500 ms | Enhanced Play fail-safe |
| 30 ms | Upgrade action/dialog polling |
| 100 ms × up to 80 retries | Upgrade unavailable-control handling |
| 500 ms | Currency update loop |
| Two matching observations | Skin-learning stabilization; not a fixed time delay |
| 260 ms | Shared modal removal fallback |
| 700 ms | Temporary trailing back-input suppression in applicable dialogs |
| 500–3,000 ms | Deliberate history opening transition |
| 3,000 ms | Native history-header discovery timeout |
| 20,000 ms | History return-to-settings watcher limit |
| 5,000 ms | Additional first-activation history identity refresh |

Animation durations and smaller UI-transition delays exist alongside these values. Timers can fire later under browser throttling, frame scheduling, or workload.

### Resource-Failure Differences

| Component | Current behavior on failure |
| --- | --- |
| Game bundle injector | Log and attempt one native script fallback. |
| Shared DataLoader | Log/store error; readiness remains false; no full-load retry loop. |
| Garage skin database | Log; retain the cached loading promise. |
| Trophy dictionary | Log; loaded gate suppresses panel output; ordinary initialization does not restart loading. |
| Prepared native mapping | Skip incomplete/ambiguous/stale feature plans; other accepted plans remain. |
| Unavailable preview image | Restore native placeholder; suppress retries of that URL for the current module lifetime. |
| Shared modal | Release pending ID and propagate failure to its caller. |
| History overlay | Log; release creation promise so later preparation can retry. |
| History card/detail template | Drop failed cached promise and permit another request. |
| Welcome template | Log; page-session guard remains checked. |
| History transaction | Reject/abort as appropriate and close connection. |
| History capture write | Log and reopen capture only for the matching result generation. |

Many DOM misses are ordinary early returns, not exceptions. Missing anchors, unreadable artwork, or unsupported labels can yield incomplete UI without a single global failure message.

### Cleanup Ownership

Shared modals and history native-page controllers explicitly remove temporary listeners, observers, timers, and presentation changes. View transitions also remove animation listeners and have timeouts.

Boot observers remain page-wide; feature scopes own module listeners, timers and observers. Feature quarantine runs registered presentation cleanup. See [MAINTENANCE.md](MAINTENANCE.md) for the exact per-feature boundary; static manifest CSS and previously dispatched game/database actions are outside rollback.

## Feature Failure Isolation

`src/core/featureRuntime.ts` provides independent scopes, guarded initialization/updates/callbacks, resource ownership, rolling error thresholds, synchronous timing diagnostics, idempotent cleanup, and diagnostics. `src/modules/index.ts` wraps entries separately. Boot coalesces most garage work into its 150 ms heavy pass; TAB statistics, quick-upgrade buttons and lobby presentation retain direct mutation-driven updates. Native indicators use `src/core/nativeFeature.ts`; arcade plans require `runtimeControls` and stale plans without this flag are not selected. Generated hooks remain installed until page reload, but quarantined callbacks become inert.

Three errors within ten seconds disable a scope. The synchronous duration threshold is diagnostic only: 16 ms by default and 4 ms for native HUD indicators. Exceeding it updates `slowCalls`, `lastMs`, and `maxMs` without disabling the scope, releasing resources or throttling callbacks. Timing happens after return and cannot preempt a hang. See [MAINTENANCE.md](MAINTENANCE.md) for live settings, cleanup ownership, diagnostics, test commands, and manual adapter repair.

DOM ownership has a separate sweep that continues when a screen-specific update stops. One shared one-second timer per execution world checks owned nodes and DOM listener targets. After at least one second observed disconnected, `preserve()` restores still-owned styles/classes and releases its snapshot, while `ownDOM(node, restore)` releases external caches such as paint/friend display maps and augment previews/live stats. Each scope has one DOM-registry cleanup instead of a permanent cleanup callback per decorated element. Brief detachment/reparenting retains ownership; repeated decoration rebases restoration on later native changes. Expired detached listeners go through `unlisten()`, which calls `removeEventListener()` and releases both their cleanup registrations and weak-index entries. Cached native fragments recreate extension buttons/search controls or reset initialization markers when revisited; native game handlers remain untouched. Window/document listeners retain their normal scope lifetime. The timer stops when no scope owns sweepable resources; background-tab timer throttling can postpone cleanup. Diagnostics expose `domNodes` and `listeners` as ownership/registration counters, not total browser heap counts. `npm run test:browser:dom-lifetime` checks garbage collection and reuse in isolated Chromium fixtures.

`src/modules/battleHistory/unassigned.ts` holds at most 20 complete results without an owner in session storage, with a 2,000,000-character cap and 24-hour read filter. A result confirmed while the same native result remains open follows normal ID-scoped capture; older recovery entries are never assigned by nickname. Existing durable records remain unchanged during ID loss.

## Build and Packaging Implementation

Sources: [package.json](package.json), [tsconfig.json](tsconfig.json), [manifest.json](manifest.json), and [tools/build/build-release.js](tools/build/build-release.js).

### Type Checking and Bundling

TypeScript targets ES2020, uses ESNext modules and Bundler resolution, enables `resolveJsonModule` for prepared plan imports, includes browser-extension types, and sets `noEmit`, `strict: true`, and `skipLibCheck: true`. Strictness covers implicit `any`, nullable values and function compatibility. Explicit assertions/`any` at external-data boundaries still require runtime validation. Root checking covers `src/`; the companion preload template has its own `tools/client/discord/tsconfig.json` and minimal declaration, checked separately without installing Electron here.

esbuild consumes `src/kasp_main.ts` and `src/kasp_injector.ts`, bundles imports, outputs IIFEs to `dist/`, and targets `chrome100`. No source maps or declarations are produced through the current configured workflow.

| npm command | Implementation |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `test` | Recursively discover and execute all `tools/tests/**/*.test.cjs` locally |
| `check` | Strict type checking followed by the complete test suite |
| `parse:client` | Development-only Acorn CLI in `tools/parser/client-parser.cjs`; local JS input, optional JSON AST export |
| `prepare:<feature>` | Thirteen npm analyzer CLIs; one additional direction analyzer uses a direct Node command; none run automatically during build |
| `build:js` | esbuild main, injector and network-gate entry points with bundle/IIFE/Chrome target flags |
| `build:zip` | Run local checks, rebuild JavaScript, then execute the Node release script |
| `build` | Type check → tests → bundle → package |
| `release` | Invoke `build` |
| `watch` | Watch/rebundle all three entries; no separate typecheck/package step |

`npm run parse:client -- <main.js> [--module] [--ast <output.json>]` parses a local file with Acorn (`ecmaVersion: latest`, source locations enabled) without evaluating it. The summary records input byte size/hash, parser and statement count. BigInt literals retain ESTree `bigint`/`raw`, with their non-serializable JS value replaced by null in JSON. Existing AST output is not overwritten. Missing paths are errors, not URLs to download. This inspection command does not prepare mappings; `--module` applies only to this parser CLI, not the script-mode preparation CLIs.

For a source change, the ordinary verification/build sequence is:

```powershell
npm run typecheck
$tests = @(Get-ChildItem -Path tools -Recurse -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
node --test $tests
npm run build
```

The full build and ZIP command stop on failed type checking or regression tests. `build:js` remains a fast bundling command without a test gate. No GitHub Actions workflow is configured. Reload the extension and game page after regenerating bundles to execute the updated runtime.

### Dependency Metadata

The manifest, package, and lockfile package versions are 3.0.5. Both package files declare `UNLICENSED`; the package is marked `private: true`. Package/lockfile-root ranges agree: `@types/chrome` `^0.3.0`, esbuild `^0.28.2`, TypeScript `^7.0.2`, Acorn `^8.19.0`, acorn-walk `^8.3.5`, and Astring `^1.9.0`. The parser/walker/generator are development dependencies, not imports of the runtime entries.

Use `npm ci` to install the locked dependency graph. Dependency changes should update the manifest and lockfile together; `npm install` can rewrite the lockfile. The project does not declare a Node `engines` field; tooling requires APIs such as `fs.cpSync` and the built-in Node test runner.

### Preparing and Refreshing AST Mappings

| npm script | Default output under `src/generated/` |
| --- | --- |
| `prepare:overdrive` | `overdrive.json` |
| `prepare:arcade` | `arcade.json` |
| `prepare:augments` | `augments.json` |
| `prepare:garage-details` | `garage-details.json` |
| `prepare:garage-items` | `garage-items.json` |
| `prepare:garage-inventory` | `garage-inventory.json` |
| `prepare:battle-presence` | `battle-presence.json` |
| `prepare:battle-statistics` | `battle-statistics.json` |
| `prepare:user-action` | `user-action.json` |
| `prepare:critical` | `critical.json` |
| `prepare:supply-privacy` | `supply-privacy.json` |
| `prepare:box-pickup` | `box-pickup.json` |
| `prepare:kill-feed-privacy` | `kill-feed-privacy.json` |
| `node tools/prepare/prepare-overdrive-direction.cjs <main.js>` | `overdrive-direction.json` |

The original ten npm tools accept `<main.js> [--out <plans.json>]` and `--help`. The three newer privacy/box tools and direct direction CLI accept exactly one local JavaScript input and write their fixed output path. Run from the project root with an existing, unmodified local game bundle, for example `npm run prepare:critical -- ./main.js`. Root `main.js` is permitted analysis input; it is not the extension's main bundle. No AST JSON export is required.

Preparation strips an initial BOM, parses/analyzes JavaScript without evaluating it, requires a complete unambiguous plan, applies its edits in memory, and parses the resulting syntax. The original ten tools also validate their destination plan-set formats and carry their own source metadata. The newer fixed-output tools use simpler `{ plans: [...] }` collections; do not assume they support every original CLI option or metadata field. Plans with the same SHA are replaced while other hashes are retained. Incompatible native analysis does not write a replacement plan. Syntax validation does not establish runtime correctness.

Use the [all-feature PowerShell workflow](README.md#refreshing-all-generated-mappings) for all fifteen plan sets. Commands are independent: failure of a later analyzer does not undo earlier successful outputs. Inspect JSON diffs and cross-plan tests, rebuild JavaScript, reload the extension, and fully reload the game. Build/watch/package do not run preparation automatically.

Generated JSON is statically imported into `dist/kasp_injector.js`; it is not fetched by the installed extension. `build:zip` therefore needs no separate `generated` runtime directory. Acorn, acorn-walk, Astring, tools, root game input/AST exports, and archived backups remain outside the runtime package. Follow [Prepared Plans and Runtime Matching](#prepared-plans-and-runtime-matching) for hash/compatibility semantics.

### Release Script Functions

| Function | Responsibility |
| --- | --- |
| `log(msg)` | Write packaging progress with the `[build]` prefix. |
| `readVersion()` | Require `manifest.json` and its version field. |
| `sanitize(name)` | Replace Windows-invalid/control filename characters. |
| `rmIfExists(target)` | Recursively remove an existing generated target. |
| `copyDir(src, dest)` | Copy an available resource directory and report success; log/skip a missing one. |
| `copyFile(src, dest)` | Copy an available file and report success; log/skip a missing one. |
| `zipFolder(source, zip)` | Archive the versioned outer folder using Windows `tar -a` or non-Windows `zip -r`. |
| `zipFolderContents(source, zip)` | Archive the folder contents directly for the Firefox-layout ZIP, with a root manifest. |
| `main()` | Determine version, replace generated targets, copy configured inputs, check broad counts, archive, and log size. |

Configured directories are `dist`, `styles`, `assets`, `database`, `_locales`, `templates` and `rules`. Configured root files are `manifest.json`, `LICENSE.txt`, `README.md`, `DOCUMENTATION.md`, and `MAINTENANCE.md`.

For 3.0.5, the folder and archive names are `release/Kaspersky's Inventions 3.0.5/` and `release/Kaspersky's Inventions 3.0.5.zip`. The ordinary ZIP contains that outer versioned folder. A second `Kaspersky's Inventions 3.0.5-firefox.zip` contains its contents directly, including the root manifest. Both are unsigned distribution archives.

Before replacing the existing same-version output, `tools/build/validate-runtime.cjs` verifies every declared content-script JS/CSS entry, nonempty gate and rule file, the gate's explicit web-accessible declaration and an enabled redirect to it. It repeats validation on the copied output before archiving. Missing or empty required runtime files stop packaging. Broad copy-count checks remain; optional root documentation/assets are not individually certified by this validator. `build:zip` rebuilds all JavaScript entries first.

Only README.md, DOCUMENTATION.md and MAINTENANCE.md are copied as Markdown documentation. `src/`, raw plan JSON, tools/tests, dependencies, root `main.js`, AST exports, and `archived/` are not configured copy inputs. `.gitignore` currently excludes `node_modules/`, `release/`, ZIPs, `archived/`, and root `main.js`; an already tracked file remains tracked despite an ignore entry.

### Source and Generated Files

Implementation changes belong in `src/`; stylesheet/template/data changes belong in their resource directories. Do not repair an implementation only inside `dist/kasp_main.js` or the injector bundle. A later build would overwrite that repair and leave the source incorrect.

Documentation-only changes do not require JavaScript bundling. Rebuild the ZIP if the updated copied documentation must be distributed. Documentation checks concern source accuracy, paths, navigation, examples, and formatting.

## Regression Test Reference

### Harness

The `.test.cjs` files use Node's built-in test/assert APIs, esbuild TypeScript transformation, and VM contexts. Fixtures supply targeted DOM/browser/storage/database behavior rather than running the live game.

This approach can verify deterministic state transitions and race handling without needing a real purchase or network-loaded game. It cannot prove every current native selector, stylesheet, browser policy, or server behavior matches the fixtures.

### Coverage by File

| Test file | Important scenarios |
| --- | --- |
| `tools/tests/garage/augment-specs.test.cjs` | Observer feedback settles; unchanged values reuse nodes; updated native values/devices do not compound multipliers; original display is restored; replaced/invalid/translated rows are handled. |
| `tools/tests/garage/game-augments.test.cjs` | Semantic schema discovery, guarded instrumentation, native collection snapshots, exact large IDs, React ambiguity, empty conditional effects, RU/EN escaping, modifier safety, artwork collisions, and ordered JSON replacement with storage fallback. |
| `tools/tests/history/battle-history.test.cjs` | Single-pass escaping; literal placeholder-like names; safe/spoofed image hosts; imported URL sanitization; stored card/detail markup; localized valid records; invalid shapes. |
| `tools/tests/history/battle-history-lifecycle.test.cjs` | ID-scoped reads/clear; rename/reused-nickname isolation; legacy preservation; ID preservation; commit timing and rollback; capture completeness/retry/generation; sorting/pagination; stale accounts/views; back labels; animations; native and standalone opening; visibility/cleanup/return handling; dialogs; import/export; overlay retry/account switch. |
| `tools/tests/privacy/nickname-privacy.test.cjs` | Original text/children/clan/XP remain; startup masking is synchronous; UID coverage preserves public parameters; account/language changes; identity fallbacks; friend/history ownership; disable/re-enable behavior. |
| `tools/tests/injector/injector-auto-upgrade.test.cjs` | HTTP/network/body failure fallback; original attributes; both hook patterns; same-batch interception guard; unknown-dialog stop; Ruby cancellation; normal count; disappearing confirmation. |
| `tools/tests/battle/arcade-reload.test.cjs` | Native local-HUD factory/viewport projection/visibility/disposal reuse, centered and tank-following HUD across UI scales, numeric state IDs vs actual Shaft cooldown instances, primary vs secondary progress, local weapon changes, Shaft stun/pause, renamed/minified bundles, idempotence and failures. |
| `tools/tests/battle/overdrive-timer.test.cjs` | Bonus instrumentation, model/sound association, bounded diagnostics, independent learned spawn positions, 85-second countdowns, and overlay lifecycle. |
| `tools/tests/battle/critical-indicator.test.cjs` | Exact device recognition, readiness/cycles/misses, lifecycle, Supercharge end offsets, damage synchronization, Terminator transitions, and native local/remote behavior preservation. |
| `tools/tests/core/client-patches.test.cjs` | Regex/division/template lexical cases, shared SHA lifetime, strict directives and multiple header inserts. |
| `tools/tests/core/client-parser.test.cjs` | Parser CLI, syntax/input errors, output protection and serializable AST data. |
| `tools/tests/ast/overdrive-ast.test.cjs` | Offline contract mapping, adaptive relocation, lexical decoys, native call preservation and CLI failure. |
| `tools/tests/ast/arcade-ast.test.cjs` | Compatible merged plans and preparation output protection. |
| `tools/tests/ast/augments-ast.test.cjs` | Scoped model fields/writers, renamed contracts, ambiguity, return/strict preservation and merged plans. |
| `tools/tests/garage/garage-details.test.cjs` | Native descriptions and selection, preserved action branches, disabled setting, renamed/adaptive contracts. |
| `tools/tests/garage/garage-items.test.cjs` | Existing unavailable cards/previews, disabled/native selection behavior, format/rename adaptations. |
| `tools/tests/garage/garage-inventory.test.cjs` | Read-only capture/export, item flags, mapped collection calls, bounds and adaptive plans. |
| `tools/tests/ast/battle-presence-ast.test.cjs` | Store/capacity profiles, compatible getter/writer interception, exact/adaptive merge and CLI. |
| `tools/tests/ast/battle-statistics-ast.test.cjs` | Loaded fields, native matchmaking Boolean, mode extraction, decoys and constructor behavior. |
| `tools/tests/ast/user-action-ast.test.cjs` | Mapped UID/action/relation, getter avoidance, scope ambiguity, native construction and CLI. |
| `tools/tests/privacy/supply-privacy.test.cjs` | Garage count masking, native text restoration, setting polling and mapped WebGL count contracts. |
| `tools/tests/battle/box-pickup.test.cjs` | Native completion preservation, pooled pieces, limits, geometry ownership, disable and battle/world cleanup. |
| `tools/tests/privacy/kill-feed-privacy.test.cjs` | Own-name matching, dirty revisions, glyph fallback, real native width/geometry crash regression, renamed atlases and cross-plan merging. |
| `tools/tests/battle/overdrive-direction.test.cjs` | Native local pose/camera mapping, stale telemetry, bearing and independent direction lifecycle. |
| `tools/tests/lobby/custom-trophies.test.cjs` | Initial dictionary readiness/localization and panel updates after language/favorite/progress changes. |
| `tools/tests/garage/custom-garage-skins.test.cjs` | Unavailable/owned previews with identical titles, actual mounting and standard reset, missing native card data, account switching outside garage, renames, logout, pending learning, and legacy preservation. |
| `tools/tests/client/discord-presence.test.cjs` | Payload validation/privacy, battle store/clock/capacity, IPC handshake/framing, reconnect and fixed session timestamps. |

`npm test` uses `tools/run-tests.cjs` to discover every `.test.cjs`, including companion Discord tests; `test-client-patches.cjs` is a helper, not a test file. `npm run check` combines strict type checking and these tests. Source contracts reject explicit TypeScript `any` tokens and native selector/class literals outside `src/core/gameDOM.ts`, including embedded CSS. Standalone manifest styles remain in `styles/`. Tests target source, so passing tests do not demonstrate that the installed `dist/` was rebuilt. The companion template can also be typechecked with `npx tsc --project tools/client/discord/tsconfig.json`.

### Manual Verification Boundaries

Verify live browser changes against the affected screen and transitions: settings opening/closing, privacy insertion before display, garage item changes, cards/tooltips, native dialogs, result capture, history pagination, detail return, account switching, and native window closure.

Also verify all critical devices (misses/respawn/Supercharge/delayed hits), Shaft/Scorpio HUD layouts and lower supplies, overdrive pickups/drift at both points, rapid devices/skins/shot-color switches, and Electron presence/privacy/minimization/reconnect. Possible Rewards should receive no extension item controls.

A loaded map with camera at a spawn point but no local tank has been reported intermittently; no cause or fix is confirmed. Capture the first console stack, build/environment, equipment and `__kaspCriticalDebug.status()` / `__kaspArcadeReloadDebug.status()` while the failure remains visible. Compare equivalent entries with the extension disabled. Fixture success cannot rule out a native/server/rendering failure or an integration regression.

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

## Additional Native Presentation Contracts

### Supply Privacy: DOM and WebGL

Sources: `src/modules/hideSupplies.ts`, `src/core/supplyPrivacy.ts`, `styles/hideSupplies.css`, `tools/ast/supply-privacy-ast.cjs`.

The content module initializes before boot and owns `html.kasp-hide-supplies` plus a set of marked quantity elements. Its observer follows native insertion and relevant class changes; detached or repurposed nodes release markers. Quantity text remains native. The strip displays a pseudo-element zero; inventory-card quantity labels suppress that pseudo-element entirely, so no black zero remains in the open Supplies section. Item price, duration, cooldown, hotkey and availability elements are outside these quantity selectors. Native Nuclear Energy selection does not intentionally disable masking; inserted replacement counts are observed again.

The MAIN bridge changes only strings sent to four mapped supply-count label methods. It retains each label's latest native string, including stock changes received while masked, and returns `0` when enabled. It keeps weak label references, prunes dead entries and stops at a 128-label bound. Disabling/cleanup restores the latest native strings. A 250ms setting poll handles isolated-world event limitations. The bridge does not alter supply amounts, gameplay eligibility or activation.

### Kill-Feed Privacy and Font Safety

Sources: `src/core/killFeedPrivacy.ts`, `tools/ast/kill-feed-privacy-ast.cjs`, `src/generated/kill-feed-privacy.json`.

The account's original nickname is matched as a complete parsed player label, with an optional clan prefix. Substring matches and other players are unchanged. Both text-width calculation and glyph generation receive the same replacement, with the current native glyph table supplied explicitly. The localized candidate is accepted only when every UTF-16 character code exists in that table. Russian can fall back to `Hidden`; when neither label is supported, the name is empty rather than exposing the original. The same rule applies to attacker, victim, self-destruction, equipment-change and join/leave records.

The renderer bridge remembers at most 32 weak renderer references and a revision per renderer. Settings, account and language changes increment the revision and mark retained native geometry dirty, so existing entries rebuild. It does not rewrite stored action objects, rank icons, colors or event icons. Polling is 250ms; quarantine/cleanup returns native rendering. A missing bridge leaves original expressions intact.

The offline analyzer verifies the font-table path in measurement and geometry, rejects missing/ambiguous evidence and binds those paths in compatibility templates. The regression runs actual extracted width/glyph loops as well as lightweight fixtures. An unconditional Cyrillic replacement previously caused `undefined.t63_1` during width calculation. Catching only the draw wrapper would miss that preparation failure. See [the renderer investigation](#kill-feed-rendering-investigation) for the local-bundle call chain and GuiMain layer 23; generated names in that investigation are not a stable API.

### Box Pickup Visuals

Sources: `src/core/boxPickup.ts`, `tools/ast/box-pickup-ast.cjs`, `src/generated/box-pickup.json`.

The default-off `k_box_pickup` switch replaces recognized pickup presentation. Original pickup completion/callback order remains once per pickup; the effect does not issue reward, inventory or spawn mutations. The AST contract maps native box renderers, pooling, world ownership, positions, materials, opacity and terrain-ray interfaces. Unsupported contracts retain the native path.

| Constant | Meaning |
| --- | --- |
| `count: 14` | Pieces emitted per pickup |
| `maxShards: 140` | Scene-wide piece cap |
| `fadeStart: 2.2` / `fadeDuration: .8` | Fade begins/lasts in seconds |
| `flashSec: .22` | Picked-up box flash duration |
| `glowSec: .7` | Tint cooling duration |
| `gravity: 2400` | Visual acceleration in world units per second squared |
| `speedHMin: 350` / `speedHMax: 950` | Horizontal visual speed range |
| `speedVMin: 650` / `speedVMax: 1500` | Vertical visual speed range |
| `boxHalf: 50` | Native box half-size used to size pieces |
| `groundOffset: 75` | Fallback ground offset |
| `bounce: .36` | Retained vertical speed after a bounce |
| `rayBudget: 6` / `rayInterval: 100` | Probes per frame / minimum per-piece interval in milliseconds |

Animation frames run while pieces exist. Flashes have a separate bound of 64. Mesh ownership is local: optional replacement BufferGeometry restores the original geometry before returning the pooled renderer, and only owned geometry is disposed. Engines lacking that interface retain scaled native geometry. Shared game materials and geometry must not be disposed by cleanup.

Disable, world replacement, battle-canvas removal, recognized battle exit, pagehide and scope quarantine clear owned visuals. Limits bound work; they are not proof of zero FPS cost. Preserve native control flow when changing the effect, and test completion/exception paths before live verification.

### Random Battle Weather

The default-off `k_rain_weather` option uses the two-stage `ki-rain-v2` prepared AST contract: clouds after native SkyBox, then rain before SpritesOnTop/HUD. Enabling immediately reveals localized generation controls and two full-width volume sliders. Generation preferences (`k_rain_chance`: 0–1, default .24; `k_rain_preset`: random/sunny/overcast/drizzle/sunshower/storm) are saved independently of the boolean cache and read when a new battle plan is created. Their independent 0–1 localStorage preferences (`k_rain_volume`, `k_thunder_volume`) update separate rain/thunder gain buses live and persist across sessions. Scheduling allows one preset/episode per known battle ID, with a user-selected chance (24% by default) and preset. Random selects only rainy presets; sunny and overcast are explicit dry choices. Session plans prevent rerolls within the same tab. The 1024 × 256 hemispherical cloud atlas uses soft density gradients, optional half-float colour and cubic reconstruction, is fixed in world orientation/altitude and updated up to 10 Hz; its projection follows the current view every frame without stale camera/depth silhouettes. Storm shading scales the native ambient/sun LightingBlock at upload, restoring its CPU values in finally; dynamic/emissive additions are preserved and the integrated renderer skips the old full-screen grade. Clouds/rain fade gradually, storm intensity reaches 25,000 instanced streaks, and native fog lightens distant clouds much closer than the game's fog distance, using neutral weather colours. Rare world-space branched lightning and delayed rolling thunder occur only during full-strength storms; rain audio has a stable, slightly quieter background level. Experimental puddles are a separate default-off setting requiring active rain; see the limitations below. Bounded tank-contact splash droplets are included; fluid wakes, rainbow and birds are not. High-detail puddles have small wind waves and rain rings. Audio stops on battle exit and render inactivity. See [the complete implementation contract](#weather-reference), including collision-based impacts, GPU limits, AST preparation and test boundaries.

### Supported Features versus Diagnostics

Self-equipment artwork still comes from the native statistics DOM through `equipmentTracker.sync()`. Console experiments that found TankInfoCC IDs and inventory previews did not add a shipped continuously updated native loadout/icon service. Device artwork may be absent until the native statistics UI has provided it. Do not document those experiments as an implemented automatic HUD feature.

There is no shipped general daily/weekly/special mission-completion observer or in-battle mission-completion notification module in the registry. Favorite trophy progress uses observed native quest/result text and cached values. These are different data sources. The separately discussed grenade-tracer userscript is not an extension setting or packaged module.

### Documentation and Credits Maintenance

The full publication descriptions live in the English and Russian publication sections of README.md; browser metadata remains a short localized sentence. Credit names/roles come from `templates/welcome-modal.html` and the `welcomeModal.ts` dictionaries. Keep Master/Niced as Assistants, Lukas as Design, safwan/Tenobyte/KOCMOHABTUK as Testing and safwan/Tenobyte/Shiya as Coding. Preserve all listed co-creation/quality-review names when reproducing the complete credits. These acknowledgements are not runtime dependencies.

Update source behavior first, then the user guide, technical contract, FAQ, publication descriptions and relevant maintenance checklists. Rebuild bundles after TypeScript/plan changes. CSS/template/reference-data changes are loaded directly but still require extension/page reload for a reproducible installed-page check. Existing release archives and hosted Drive documents do not change merely because local documentation was edited.

## Implementation Limits and Project Terms

The implementation depends on observed native DOM, generated bundle patterns, known labels, exact artwork identifiers, and packaged reference snapshots. It cannot reconstruct unobserved events or guarantee compatibility with future game changes.

History stores local observations rather than server-certified records. Equipment and trophy data can be cached; arcade reload presentation uses client-native weapon state. Privacy masks presentation while original account information remains available to the page and local exports.

Origin storage is accessible to appropriately situated same-origin code and is not an encrypted account vault. Injector message payloads are client-side signals, not authenticated audit events. Safe history rendering is a targeted boundary and should not be interpreted as a universal sanitizer for every module's storage or markup.

The manifest declares Chromium and Firefox support, with Firefox 128.0 as its minimum. The Chrome syntax target does not certify every Chromium, Firefox, or Electron version, and the Electron adapter is not a native installation system. Shared CSS and third-party UI modifications can interact through overlapping selectors and event handlers.

Project use and distribution are governed by [LICENSE.txt](LICENSE.txt), which contains proprietary terms and express Tanki Tweaks integration rights. The `UNLICENSED` package metadata supplies no open-source license and does not replace those terms.

---

Technical documentation aligned with source/manifest version **3.0.5**, updated **October 24, 2026**.

<a id="weather-reference"></a>

## Weather Rendering and Audio Reference

Extension 3.0.5 · Implementation review: October 25, 2026

Enable **Settings → KASPERSKY → Visual changes → Random battle weather**. The feature is off by default and enables immediately. Two full-width sliders smoothly expand beneath its switch: **Thunder volume** and **Rain volume**, localized in English/Russian. Both range from 0% (muted) to 100% of the existing sound level, default to 100%, persist across sessions and apply live. Disabling collapses the controls and releases the weather renderer and audio without discarding volume preferences.

Disable the old Tampermonkey weather script before using the integrated version. Running both creates two independent effects and extra GPU/audio work.

<a id="weather-reference-when-weather-appears"></a>

### When weather appears

The client chooses at most one episode for each observed battle ID. Rain chance is configurable from 0% to 100%, defaulting to 24%. Random selects uniformly among the three rainy presets; the two dry presets remain available by explicit selection. At 0%, no new episode is scheduled. At 100%, an eligible battle receives the chosen preset (or a rainy random choice). A zero duration prevents weather even if chance is 100%. These are probabilities, not a repeating sequence. Chance, duration and preset changes affect future plans only; the existing plan and same-battle session cache are retained.

| Preset | Rain | Atmosphere |
| --- | --- | --- |
| `sunshower` | Medium | Partial cloud cover |
| `drizzle` | Light | Broad cloud cover |
| `storm` | Dense downpour | Dark cold-grey atmosphere, rare distant branched lightning and rolling thunder |
| `overcast` | None | Heavy cloud cover |
| `sunny` | None | Light cloud cover |

`window.__kaspRain.status().timing` distinguishes clear/waiting/forming/holding/clearing/finished and exposes `startsInSeconds` and `rainStartsInSeconds`. A ready renderer with zero frames, `active: false`, `finished: false` and a future episode start is waiting normally, rather than failing. The rain countdown includes the 12-second cloud lead-in.

Rain duration is an origin preference `k_rain_duration`, bounded to 0–1 (default .30), displayed as a full-width localized 0–100% slider. Zero schedules no weather. Values below 100% create one uniformly randomly placed interval whose total duration, including formation and clearing, equals the selected share of the remaining timer at first observation. Fade-in is at most 24 seconds and fade-out at most 30 seconds, each at most 30% of a short episode. Rain follows half the forming transition, capped at 12 seconds. Full-battle (100%) plans start immediately, fade in smoothly and remain active until native battle exit rather than an estimated timeout. They persist across re-entry/toggle/reload of the same known battle. Chance remains independent: 100% duration does not override a failed chance roll or a dry preset. When no readable battle timer exists, fractional scheduling uses the existing ten-minute estimate; full-battle weather has no such timeout.

The plan is retained across settings changes and scene changes, and in a bounded per-tab session cache across reloads. Returning to the same known battle ID does not reroll or restart its episode. There is no cross-tab/server synchronization. Without a usable native battle ID, reuse is limited to the observed scene object. Different players can see different local weather.

<a id="weather-reference-rendering-and-boundaries"></a>

### Rendering and boundaries

- Rain contains up to **25,000 instanced streaks** at full storm intensity, generated in world space without a CPU terrain grid. Rain appears smoothly rather than waiting for raycasts to fill a height map.
- Ground impacts use a bounded pool of world-space ballistic droplets, sampled on colliding map surfaces; inclines remain available for rain splashes although they cannot hold puddles. Tanks emit additional droplets when rain hits their transformed hull collision faces, including stationary tanks and with puddles disabled. Shared precipitation and splash controls set the rate and launch strength; driving speed does not create track wakes. Birth positions stay fixed in world space, and native depth occludes the ribbons. These are statistical impacts, not a one-to-one collision simulation of every falling streak.
- Layered procedural clouds use a twelve-step volume pass with four-octave noise and soft erosion. A **1024 × 256 world-aligned hemispherical atlas** is updated up to 10 times per second. Half-float colour is used when supported, with an RGBA8 fallback; this preserves faint formation gradients. Smooth density thresholds, coherent integration samples and four-tap cubic reconstruction soften the former pixel-sized patches. The cloud layer has a fixed world origin and altitude, independent of camera translation/height. Each presentation frame projects the current viewing direction into that atlas. Camera rotation does not reuse a previous screen image or scene-depth silhouettes. Rain and surface impacts use the current viewport resolution.
- Native Fog controls cloud distance haze. Its distances are scaled to 18%, with onset clamped to 450–1,600 native units and the far distance capped at 6,000. Cloud detail remains partly visible through the haze. Weather haze uses the authored preset palette independently of map fog RGB, so pink map fog does not turn the clouds pink.
- Clouds compose after native SkyBox; rain and splash droplets compose before SpritesOnTop/HUD. Storm dimming uses scoped native ambient/main-light RGB attenuation, restored after each upload; native fog fades out during actual precipitation. Dynamic-light textures, emissive terms and later luminous effects are not globally multiplied by a screen overlay. Missing lighting evidence leaves native illumination unchanged; the integrated runtime does not revert to the old screen-wide darkening. Physics, rewards and network weather remain native.
- Lightning is a real procedural world-space path with a main channel and eleven fading branches, normally 152 segments, capped at 256. Segments render as glowing geometry with a hot core, not an electric image/sprite. Their endpoints remain fixed for the discharge. Native depth hides bolts behind terrain. A brief cloud glow and exposure change accompany the visible discharge; there is no periodic independent screen strobe.
- **No fluid simulation, tank wakes, rainbow, birds or bird sounds are included.** Tank-contact droplets and ground splashes are visual effects with bounded pools; they do not change vehicle or water physics.

<a id="weather-reference-experimental-puddles"></a>

### Experimental puddles

The live boolean `k_rain_puddles` defaults to false. Its RU/EN switch is inside the expanded weather controls, alongside generation and volume settings. Disabling weather hides/disables this switch while retaining its saved value. It requires `k_rain_weather` and visible rain. It does not change chance, preset, episode count or physics. Toggle changes ease over a 1.2-second time constant, multiplied by the rain and battle-entry envelopes. Water still renders in the after-SkyBox callback. Additional validated scene captures provide map collision ownership, tank interpolation and native light upload access.

`mapSurface.ts` reads only the captured native BattleMap collision DTO (boxes, planes and triangles), using validated AST-derived fields. Native Rz*Ry*Rx transforms and full box dimensions produce world-space triangles. Only upward faces within one degree of horizontal enter an owned, full-resolution collision-depth pass; tilted/downward faces do not become puddles. The ordinary visible scene depth must agree with this map depth within 14 native units in height. This rejects tanks/supply boxes, noncolliding props, hidden floors and unsupported geometry without classifying arbitrary scene objects. Missing/invalid map data disables puddles rather than falling back to all scene surfaces. Small visual-mesh bumps can remain within the tolerance, and a horizontal colliding map roof can qualify: this is collision ownership/shape filtering, not a soil/material classifier. The water itself remains a full-screen shader, attached to eligible 3D surfaces by both depth buffers; it does not replace source textures or add a visible water mesh. The former ramp-film behavior is removed. Renderer diagnostics report surfaceRevision native-fog-off-v13 and map readiness/errors. A separate CPU spatial index supports bounded splash contact lookups; it is not a tiled puddle texture.

Reflections use a separate owned normalized-colour copy of the opaque scene after sky composition, before later transparent effects and HUD. A bounded 24-step reflected ray with six binary refinements samples depth/colour for visible object intersections. Exponential stepping starts close to the water, and height confidence starts at 2–12 cm rather than discarding the first 20–90 cm of a reflected wall. Candidate hits reconstruct a camera-facing normal from neighbouring depth samples and reject rays approaching the invisible back side; this prevents a floating object’s visible top from being pasted into water underneath it. Reflection confidence also fades near the configured ray limit (12,000 native units by default). SSR still cannot recover unseen object undersides. Both qualities use dielectric Schlick Fresnel (0.02 head-on, capped at 0.72 for grazing reflections) and shallow absorption. Refraction validates all four bilinear colour taps against depth and the water plane; invalid foreground/sky taps fall back to the current ground pixel. Reflection hits and blur taps use texel-centred, depth-checked samples so a nearby gun/tank silhouette cannot be smeared from an unrelated surface into the water. This addresses the puddles-only foreground ghost; live moving-camera validation remains necessary. Final water luminance retains at least 72% of the underlying ground luminance before blending; this relative safeguard prevents black reflections from erasing the bottom without adding a constant glow to dark maps. Misses, screen edges and rejected depth intersections fade to procedural sky/cloud colours limited by locally shaded ground and bounded screen-space sun occlusion; objects outside the screen, occluded objects, the native skybox image, foliage/effects rendered later and back faces cannot be reconstructed. This is screen-space reflection, not a complete environment capture or material-metalness change. Thin geometry and moving-camera disocclusions remain limitations.

Puddles always request High detail. The quality slider and its preference reader are removed; legacy `k_rain_puddle_detail=low` values are ignored. The puddle enable switch stays default-off, persists and applies live without rerolling weather. Low remains an internal fallback only if High fails to compile.

Low compiles the original simple outline/sine-ripple shader. High adapts the user-supplied Weather 3D 3.20.2 surface functions in `puddleSurface.ts`: the nine-neighbour warped organic shoreline, concentric rain-impact rings, two-band wind noise, three directional micro-wave bands, dielectric Fresnel and refracted ground colour with depth absorption/a thin wet rim. The surface scale is fixed at 540 native units rather than inferred from tank geometry. An analytic ripple gradient evaluates the nine impact cells once instead of three finite-difference field calls. Shorelines stay fixed in world space; only the surface normal/optics animate. The reference height-grid renderer, tank response/foam/splashes, streams, day/night cycle and other unrelated systems are not imported.

Each quality has an independently cached program, compiled only when requested. A rejected High shader records `puddleErrors.high` in renderer diagnostics and falls back to Low; optional shader compilation cannot quarantine rain. Selected quality appears in `status().puddleDetail`, and each renderer reports the actual quality used. Both qualities retain the existing depth clipping, 24-step/six-refinement screen-space reflection and its visibility limitations. Surface visibility extends to 25,000 native units (300 metres), fading from 19,500 to 25,000. This is separate from the bounded 6,000-unit reflection ray length. High-detail rain rings/wind micro-waves fade between 7,000 and 18,000 units and skip their evaluation beyond that range to reduce distant shimmer and work. High adds per-fragment work; it has not been benchmarked in a live battle.

Only enabled, visible puddles allocate/copy scene colour and perform the extra draw. The shader can precompile while an episode waits. MSAA colour resolves use the exact source internal format: RGB8 for an alpha:false default buffer, RGBA8 for alpha:true, or the queried renderbuffer format for a native FBO. Supported linear normalized formats are RGB8, RGBA8, RGB565, RGBA4, RGB5_A1 and RGB10_A2. Single-sample native FBOs can convert normalized colour into RGBA8. Changing format reallocates the owned texture even if the viewport dimensions stay the same. MSAA source/destination coordinates must match exactly; nonzero viewport origins and viewports outside known source bounds skip depth-dependent weather effects rather than attempting an invalid copy. Unsupported floating-point/HDR, sRGB or unknown multisample colour targets skip puddles while rain continues. Renderer diagnostics expose sceneCopy and depthCopy with format, samples and the last skip reason. No global gl.getError drain is used. Texture/sampler unit 14, framebuffers and all other touched native state are restored. Colour resources are released after fade-out, battle exit, episode completion, weather disable and renderer disposal. No CPU pixel readback or global WebGL hook is added. A full-resolution colour texture and bounded per-fragment ray march still add GPU/memory cost; real-game FPS must be measured on the player's hardware.

<a id="weather-reference-stable-rain-audio-and-distant-thunder"></a>

### Surface Parameters

The former rain developer panel, its Ctrl+Alt+W hotkey and rain authoring/export API have been removed; Snow has a separate Ctrl+Alt+S panel below. Ordinary in-game weather controls remain available; existing saved surface preferences remain compatible.

Existing surface parameters are read from the versioned origin-local `k_rain_surface_tuning_v1` key. They apply live across presets, without shader recompilation, account data or extra particle meshes:

| Parameter | Range | Default | Meaning |
| --- | --- | --- | --- |
| `rainIntensity` | 0–1 | 1 | Common multiplier for rain count, ring density, splash rate and rain noise |
| `edgeInset` | 0–200 | 200 | Open-edge fade distance in native centimetres; native centimetres |
| `rippleSizeReduction` | 1–30 | 15 | Divide rain-ring radius and spacing by this factor |
| `rippleDensity` | 0–1 | 1 | Active fraction of world-fixed impact cells, also scaled by visible rain |
| `rippleSpeed` | 0.25–8 | 8 | Ring animation time multiplier |
| `rippleStrength` | 0–2 | 0.7 | Ring normal/height contribution; zero disables rings |
| `waveSizeReduction` | 1–30 | 16 | Divide wind-wave wavelengths by this factor |
| `waveSpeed` | 0.25–8 | 8 | Wind-wave animation time multiplier |
| `waveStrength` | 0–2 | 2 | Wind-wave normal contribution; zero disables it |
| `reflectionStrength` | 0–2 | 2 | Reflection/Fresnel multiplier; zero bypasses SSR marching |
| `reflectionDistance` | 1,000–12,000 | 12,000 | Native centimetres for SSR rays; native centimetres |
| `reflectionRoughness` | 0–1 | 1 | Bounded five-tap reflection blur |
| `refractionStrength` | 0–2 | 2 | Ground-refraction offset multiplier |
| `groundSplashDensity` | 0–4 | 4 | Statistical ground-droplet rate multiplier |
| `tankSplashDensity` | 0–4 | 4 | Rain-impact droplet rate on tank hull surfaces, including stationary tanks |
| `splashSpeed` | 0.25–4 | 4 | Launch velocity multiplier |
| `splashSize` | 0.25–4 | 0.25 | Droplet ribbon width/length multiplier |
| `splashLifetime` | 0.15–1.5 | 1.5 | Maximum droplet lifetime in seconds |
| `splashGravity` | 0.25–3 | 3 | Ballistic downward acceleration multiplier |

The supplied tuning export now defines defaults: ring radius/spacing divided by 15, active-cell fraction 1, ring speed 8, ring strength 0.7, wind wavelengths divided by 16, wind speed 8 and wind strength 2. The ring field has 225 times the old candidate-centre density, but evaluates at most nine neighbours rather than creating that many objects. Pixel-footprint filtering fades unresolved rings/waves and bounds normal perturbation. Existing saved local tuning wins over new defaults. All presets share these surface defaults; rain chance remains 24% and weather/puddles remain default off.

The shared intensity is the sampled episode rain multiplied by `rainIntensity`. This one value drives the instanced streak count, rain-ring activation, splash spawning and rain-noise gain; user volume is an additional independent multiplier. Zero stops rain audio and droplets while clouds can remain. Ground emission is bounded to 60 candidate contacts per update. Up to 12 recently interpolated tanks participate. Native hull box descriptions supply local collision faces and the interpolated body matrix transforms rain-ray hits into world positions. These are rain impacts on a hull, not track wakes: stationary tanks emit too, independently of puddles and speed. Missing hull geometry emits nothing; captured map roofs above a contact suppress its spawn. Collision hulls can differ from visual skins and do not include a separately articulated turret. The particle pool is capped at 1,024, with one preallocated GPU buffer and one instanced call. The normal rain field is not read back to the CPU and ground impacts are statistical, not exact rain-particle collisions. Hull spray does not sample the puddle mask. The owned horizontal and bank collision meshes are uploaded once per captured map, and water mask depth is rasterized only when needed for visible puddles.

`tools/ast/weather-scene-ast.cjs` adds eight validated scene capabilities: map collision capture, hull setup/interpolation, native LightingBlock upload, battle-ID/theme observation, static foliage, native skybox tone, native fog-strength suppression and drop-zone depth isolation. The upload wrapper always calls native code exactly once and restores only its own temporary CPU values in finally. The current plan contains 30 insertions and 61 evidence templates. Foliage edits wrap four vertex-source expressions without any per-draw wind callback. Fog and drop-zone edits scope temporary state around existing native uploads/dispatch. Original source assembly/program selection still executes once. DTO getters, list operations, coordinates and tank fields are derived from source evidence and adapted across renamed/minified bundles. Missing scene evidence never authorizes treating all depth as terrain. `status()` includes `environment`, `map`, `nativeLightingReady`, recent `tanks`, usable `tankSurfaces`, `splashes`, and per-renderer `mapError`/`splashError`. Live validation remains necessary for collision/visual-mesh differences on each map.

### Open edges, tree wind and map environment

The validated `edgeInset` parameter uses 0–200 cm (default 200 cm). Eight directions probe at the full inset and 1.25 times that distance, plus a conservative pixel footprint. The full configured distance stays dry beside voids/lower levels; the outer band softens the transition. Three world-fixed noise bands vary extra inward erosion beyond that minimum, creating bays, notches and detached patches instead of a uniform parallel stripe. The 1.083 directional margin conservatively covers the gaps between eight probe directions. No clock or camera offset drives the shoreline. A separate depth pass over complete static map collision faces includes retaining walls: a raised bank does not drain the lower puddle. Same-height neighbours preserve continuity. Only the original horizontal-face mask authorizes water, so walls, slopes, tanks and supply boxes do not become puddles. Abrupt levels therefore have separate water surfaces. Texel-centred, plane-relative depth avoids far-distance height noise. Off-screen probes remain unknown; this is screen-space continuity, not an exact offline fluid/topology solver. Both collision buffers upload once per map. The extra bank depth target/pass is needed only for a positive inset, with no CPU readback.

Native InstancedTrees, InstancedTreesDepth, InstancedTreesLightingPrePass and Trees vertex sources now remove foliage displacement completely. The three instanced paths gate getPositionModifiedByWind behind the frozen uniform; the standard/sprite path keeps localPosition=position and gates positionOffset in the same way. UVs, model transforms, fog, shadows and visibility stay native. This freezes both native breeze and the removed custom storm bend, even when weather is off. A new kiFoliageMotion uniform is intentionally left at WebGL's initial zero and gates all native displacement. Keeping the unreachable-at-runtime branch preserves the native mandatory time/noise uniforms at link time, avoiding missing-uniform diagnostics. No custom time upload or per-draw wind callback remains. The legacy scene capability/file name treeWind still identifies this validated foliage contract; status().foliageAnimation is false.

BattleCreateParameters.theme provides SUMMER_DAY, SUMMER_EVENING, SUMMER_NIGHT, AUTUMN_DAY, WINTER_DAY, WINTER_NIGHT and SPACE. The BattleParamInfoCC dispatch associates metadata with the exact battle ID; another battle preview cannot recolour the current map. Known SPACE battles skip weather rendering, audio, lightning, lighting attenuation, added tree wind and force previews. Other themes select seasonal/time-of-day cloud tones; native fog fades out during rain. Missing metadata is reported as environment.theme=null and retains neutral tone. Verify metadata on direct matchmaking entry: the collision DTO itself carries no theme, and localized map names are not treated as theme evidence.

Direct distance-based grading of BattleMapProgram_ / Terrain remains removed. Native fog colour/distance are unchanged; fog strength alone fades out during rain. Source textures, UV/AO and native dynamic-light calculations remain original. The weather LightingBlock wrapper darkens ambient/sun RGB only for one upload and restores its CPU buffer immediately.

Cloud colour comes from appearance.ts rather than native daylight fog RGB. Storm defaults to low=[.055,.065,.085], high=[.16,.18,.22], haze=[.085,.10,.13] and fog=[.075,.09,.115]. Drizzle uses cool grey, Overcast a lighter slate, Sunshower a pale daylight grey and Sunny the lightest palette. Formation uses the chosen preset colour from the first visible cloud instead of brightening while rain is still zero. Native fog flags, alpha and distance affect haze coverage, never a minimum cloud luminance or pink map tint. Seasonal/evening/night tint is mild, avoiding order-of-magnitude jumps between maps. A full storm therefore stays dark under white, pink and dark map fog alike. Palette coefficients are frozen defaults, not new user sliders.

Drop-zone markers use a transparent 500-unit native quad raised 5 units above the map; the render loop dispatches DropZones before Trees and SkyBox. Previously this layer could write the whole transparent square into scene depth. Water then reconstructed that raised plane instead of the underlying collision surface, producing square holes/edge discontinuities. A validated wrapper around only the native DropZones dispatch disables depth writes while active rain/puddles are visible, then restores the previous mask in finally. Native depth testing, colour blending, marker resources and opaque terrain/tank depth remain intact. Missing/disabled weather, Space and maps without puddles leave the dispatch native. No global WebGL interception, extra buffer or new water pass is introduced. A raised-marker regression checks both detail levels, 5/30-unit quad offsets, visible marker pixels and identical water outside the glyph.

Native BattleStatistics mapNameWithoutMode/mapName identifies Бойня / Massacre, optionally with a mode suffix. On this map puddle amount is forced to zero and reflection/mask resources are cleared, while rain, audio, clouds and lightning continue. The saved puddle switch is preserved for other maps. status() reports mapName, puddlesAllowed and puddleBlockedReason=map-massacre. A missing native map title remains null in diagnostics rather than guessing from terrain shape.

Sun-visibility probes suppress a bright sky fallback beside visible occluders. They do not replace native shadow maps/baked lightmaps or find off-screen occluders. Local shaded-ground luminance also bounds fallback; actual SSR hits retain sampled object colours and dynamic illumination in both quality modes.

Weather presence also supports a WebGL-only HUD: a validated native frame requires main-map capture plus loaded-battle or recent active-tank evidence. Arbitrary canvases/render calls do not establish presence. Disconnecting the native canvas, native unload or a one-second render timeout invalidates fallback presence. Manual force reports render-hook-missing, battle-not-present or battle-loading separately. `status().patch` exposes pending/loading/installed/unsupported/conflict/error. A missing render hook requires reloading the game after updating; it cannot be repaired by pretending the renderer has run.

### Stable Rain Audio and Distant Thunder

Rain uses a normalized six-second seamless stereo noise bed with fixed filters and no camera panning, distance attenuation or moving low-pass filter. Gain follows the actual visible rain intensity (`0.45 × rain`) and entry envelope, preserving the full-strength storm peak and removing the former preset-specific mismatch between drop density and background sound. Repeated equal levels do not add automation events; changing levels are limited to 20 updates per second. The old correlated low-frequency parallel branch is removed. OfflineAudioContext comparison of the full-strength storm bed measured approximately 18% lower RMS than the old implementation and about 2% variation between quarter-second windows. This is a controlled synthesis check, not a measurement of the player's full game mix.

Only the `storm` preset schedules lightning/thunder. The first strike occurs 8–18 seconds after the full-strength hold begins; subsequent gaps are 20–35 seconds. There are at most seven per episode and none during formation/clearing. Strike schedules are deterministic for the existing weather seed, so frame rate and camera movement cannot reroll them. They may occur outside the current view.

Bolts are placed beyond the playable area at a visual radius of 85,000–125,000 native units. Using the effect's 100-units-per-metre convention gives a 2.5–3.6-second thunder delay. The eight-second synthesized thunder contains a low body, several delayed acoustic arrivals and a fading rumble. It is loud relative to the rain and peak-limited before mixing. Each event is queued once; missed events are not burst-replayed when a tab resumes. Thunder buffers are prepared ahead of the strike when possible, at a suitable 16 kHz rate for their low-pass spectrum.

Leaving the battle stops audio independently of the native render callback; a watchdog also stops it if rendering stops. Disabling/page exit closes the owned context, cancelling future thunder. Browser autoplay rules may require a click/key before sound is audible.

### Native fog during rain

The separate fog and enhanced dynamic-lighting features have been rolled back. There is no independent mist setting, 3D fog texture/pass, light-gain shader or atmospheric tuner section. The regular weather settings retain rain volumes, chance, duration, preset and the puddle switch. The former rain developer panel and its surface/reflection/splash controls are removed; the Snow developer panel and snowbanks are also archived. Old atmosphere/light preference keys are no longer read or exported.

Only during a rainy preset, both native common Fog binders receive a fading fog-strength cap and the separate SkyBox fog upload receives the same fading alpha. At full preset intensity they are zero, so native fog does not whiten distant geometry, foliage or the skybox. This is normalized per preset: drizzle and sunshower remove fog fully too. Fog colour, distance, shader source and saved graphics flags remain native. Existing zero strength remains zero. Each original strength expression is evaluated once; observer errors fall back to the original. Rain ending, disabling weather, zero precipitation, SPACE and leaving battle restore native uploads automatically, including graphics changes made by the player during rain. The cloud renderer follows the same suppression envelope. Native fog is not permanently disabled in game settings.

The earlier scoped LightingBlock darkening is restored and strengthened: only ambient/main-light RGB is attenuated, up to 78% (full storm factor 0.22); direction/padding and later native dynamic/emissive additions remain untouched. CPU values restore after each native upload in finally. Skybox darkening reaches 82%, with the existing 65% night-theme multiplier. The temporary global fog/light shader changes have been removed. The original weather stage order, cloudy presets, lightning, puddles and unrelated features are preserved; the pre-fog 25,000-drop budget is restored.

### Native lighting and distance sound: investigation

The inspected local `main.js` (SHA-256 `4ef9f256178c771071ce9cc0baf2a00d939073746badf40c8656c6d5760c3db4`) provides these distinct systems. Native symbol names are evidence for this bundle, not a stable API:

- Render layers begin with Shadows (0), OpaqueDepth (1), LightingPrePass (2), Opaque (3), OutlineStencil (4) and SkyBox (5). Their buffers/passes are not interchangeable. A cloud model needs a shadow-compatible native draw contract; simply inserting its sky fragment shader into Opaque cannot make it cast a shadow.
- `BattleMapProgram_` binds LightingBlock (ambientLightColor, mainLightColor, mainLightDirection), ShadowParams and shadowMVP separately from lightmapTexture. Its fragment combines directional lighting with shadow attenuation, then caps the result using `min(2. * light, staticLight)` for baked lightmaps; dynamic light is added later. Thus baked shading cannot be undone by changing the dynamic shadow layer alone. Weather attenuates native ambient/main-light RGB only during its weather envelope and suppresses native fog during rain. Dynamic-light textures and emissive additions remain original. Cloud-shaped sunlight occlusion, native shadow-map generation and changes to baked source lightmaps remain unimplemented.
- Native SkyBox samples `samplerCube skyboxTexture` and optionally mixes map fog. Weather adds a guarded uniform after the native SkyBox binds: its fragment multiplies RGB after native fog composition. Cloud/rain/storm darkness fades smoothly up to 82%; night themes use 65% of that attenuation. A zero uniform preserves the original colour and alpha. The procedural puddle sky fallback follows the same attenuation. Individual remastered mountain/perimeter resources have not been reliably classified across maps; their source textures are not recoloured. Direct static-map material grading was rolled back. Native fog strength fades out instead; authored texture/UV/AO and dynamic-light calculations stay intact.
- The native 3D sound update calculates listener distance and inverse attenuation `reference / (reference + rolloff × (distance - reference))` beyond the reference distance, plus stereo position from the listener axis. The current rain bed deliberately stays stationary. Material-specific rain impacts near tanks/objects would need separately budgeted world emitters, verified surface contacts/materials and the listener transform; the render/fog hook alone does not provide those data. Such emitters are not implemented here. Camera motion must not modulate or repeatedly restart the background loop.

<a id="kill-feed-rendering-investigation"></a>

## Киллфид: исследование рендера и проверка символов

Разбор локального `main.js` для расширения **3.0.5**, проверено **22 октября 2026 года**.

SHA-256 исследованного бандла:
`4ef9f256178c771071ce9cc0baf2a00d939073746badf40c8656c6d5760c3db4`.

Имена ниже относятся к этому бандлу. После обновления игры они могут измениться; runtime использует подготовленные привязки, а не эти имена как постоянный API.

<a id="kill-feed-rendering-investigation-очереди-рендера"></a>

### Очереди рендера

- `df` — диспетчер; `df.y39_1` — используемый графический контекст.
- `df.g39_1` — массив очередей 26 проходов. Индекс берётся из `layer.k3_1`.
- `df.s3u(layer, instance)` добавляет обёртку в очередь прохода.
- `df.j3t(scene, camera)` сначала вызывает обход сцены через `scene.i3l(camera, dispatcher)`, затем исполняет проходы через `instance.i3j(dispatcher, camera)`.
- В конце кадра очереди очищаются. Это накопление на кадр, а не постоянный реестр моделей.

Перечисление `$l` содержит Shadows=0, Opaque=3, HudIndicators=19, Hud=21, GuiBack=22, GuiMain=23, GuiFront=24 и DebugGui=25, а также остальные проходы.

Киллфид находится в **GuiMain, индекс 23**. `pet.j3l` ставит свою обёртку в очередь через `dispatcher.s3u(aI(), this.j11i_1)`. В этом модуле `aI = f.$_$.y8`; соответствующий экспорт движка — `Kl`, возвращающий GuiMain. Поиск только в Hud=21 пропустит этот объект.

Контракт `kinds.actionLog` в исследованном бандле не подтверждён. Подтверждённые якоря: `ActionsLog`, шейдеры `ActionLog`/`ActionLogText`, имена обработчиков и структура данных ниже.

<a id="kill-feed-rendering-investigation-данные-и-вызовы"></a>

### Данные и вызовы

| Объект | Роль |
| --- | --- |
| `Vrt.qz4` | Создание HUD и подписка на события |
| `wet` | Запись: список частей и время создания |
| `get` | Имя `u11l_1`, цвет и значок звания |
| `det` | Значок события |
| `pet` | HUD: записи, dirty-флаг, геометрия текста и значков |
| `pet.l11i` | Добавление записи и установка dirty-флага |
| `pet.j3l` | Подготовка геометрии и постановка обёртки в очередь |
| `ret` → `zet.t11l` | Расчёт ширины для выравнивания справа |
| `eet` → `set` | Генерация вершин символов и значков |
| `cet` | Обёртка, ссылающаяся на `pet` через `h11m_1` |
| `cet.i3j` | Привязка шейдеров/текстур, параметры затухания и вызовы отрисовки |

В этом случае `i3j` не только перенаправляет управление: метод связывает атласы значков и текста, задаёт параметры эффектов и рисует буферы. Ошибка ширины текста возникает раньше этого этапа.

<a id="kill-feed-rendering-investigation-общий-путь-событий"></a>

### Общий путь событий

`onTankKilled` создаёт запись с двумя именами и значком между ними. `onTankSuicide` и `onTankChangeEquipment` используют `Urt`: значок и одно имя. Вход и выход игроков также проходят через `Urt`. В итоге записи попадают в один `pet`.

Поэтому ошибка замены собственного имени затрагивала самоуничтожение, переодевание и обе позиции в убийстве. Исправление только одного обработчика не покрывает весь путь.

<a id="kill-feed-rendering-investigation-причина-ошибки-t63_1"></a>

### Причина ошибки t63_1

Шрифт имеет конечный набор SDF-глифов. Таблица в этом бандле доступна как `font.g63_1.m63_1[charCode]`. Нативный расчёт ширины без проверки читает `glyph.t63_1`, а генератор вершин затем читает координаты того же глифа.

Прежняя подстановка возвращала «Скрыто» для русского языка без проверки таблицы. Если нужной буквы нет, поиск возвращает undefined и чтение `t63_1` выбрасывает TypeError. Это ошибка подготовки текста, а не сетевого запроса или непосредственного вызова WebGL.

<a id="kill-feed-rendering-investigation-исправленный-контракт"></a>

### Исправленный контракт

AST-анализатор находит таблицу глифов в расчёте ширины и построении геометрии и проверяет согласованность путей. В обе точки поступает одинаковая замена:

1. Локализованная надпись, если все символы есть в текущем шрифте.
2. Hidden, если локализованная надпись недоступна и латинский вариант поддерживается.
3. Пустая строка, если не поддерживается ни один вариант.

Настоящее собственное имя не является запасным вариантом при включённом скрытии. Имена других игроков, данные исходных записей, цвета, звания и значки не переписываются. При смене настройки/языка/аккаунта сохранённые слабые ссылки позволяют выставить dirty-флаг и обновить уже показанные записи.

<a id="kill-feed-rendering-investigation-проверка-и-границы-вывода"></a>

### Проверка и границы вывода

Регрессия исполняет извлечённые из реального бандла `ret`, `eet`, `set` и `zet.t11l`. Старая подстановка воспроизводит ошибку; новая проходит записи самоуничтожения, смены снаряжения, убийства и собственной смерти. Проверены кириллица, латинский запасной вариант и отсутствие обоих вариантов, а также переименование полей и объединение с другими патчами.

Эти проверки воспроизводят конкретный код. Они не заменяют проверку новой версии игры в живой битве и не подтверждают, что любая последующая ошибка загрузки имеет ту же причину.

Реализация: `src/core/killFeedPrivacy.ts`. Анализатор: `tools/ast/kill-feed-privacy-ast.cjs`. Регрессия: `tools/tests/privacy/kill-feed-privacy.test.cjs`.

См. [техническую документацию](DOCUMENTATION.md#kill-feed-privacy-and-font-safety), [обслуживание](MAINTENANCE.md#webgl-kill-feed-privacy) и [FAQ](README.md#faq-29-what-does-the-kill-feed-show-instead-of-my-name).

<a id="electron-client-integration"></a>

## Discord Companion Client Integration

Reference source files mentioned below are in `tools/client/discord/`. Deployment, building, verification and recovery are covered in [MAINTENANCE.md](MAINTENANCE.md#electron-client-maintenance).

Extension integration reference: **3.0.5**, updated **October 24, 2026**. Client executable versioning and automatic updates belong to the separate Electron project.

The extension reads the nickname and current screen and sends a heartbeat every three seconds. In a regular browser the module remains inactive. Discord labels are always in English, regardless of the game's interface language.

During a battle, `details` contains the English map name and available mode, `state` contains the player's nickname, `timestamps.end` supplies the countdown, and `party.size` supplies `[currentPlayers, maximumPlayers]`. Nickname hiding (`k_hideNicknameXP`) changes `state` to `Hidden`; missing identity uses `Signing in`. Settings/storage changes request an immediate extension-side refresh, subject to the client's RPC coalescing.

The MAIN reader captures the native dependency-injection store through prepared AST hooks; it does not need to climb a HUD React component chain. The runtime reader still recognizes `BattleStatistics`, `BattleUsers`, and matching `BattleParams` through semantic fields in diagnostic method source and native collection interfaces. It excludes spectators and accounts for per-team capacity. The HUD clock supplies remaining time; without it the latest server duration is counted down locally. Invalid/missing fields are omitted. Snapshots must be less than five seconds old and the current content-script screen must be `battle` to supply battle fields.

Russian map names are translated through `database/maps.json`; untranslated Cyrillic falls back to an English screen label. Outside battle the section label is used and party/countdown fields are omitted. `window.__kaspPresenceStoreDebug()` reports capture/error; `window.__kaspPresenceBattleDebug()` returns the latest snapshot in the page's MAIN console context. Native model/collection changes may still require adapting the reader, even when the AST hook matches.

Store/capacity plans are embedded from [battle-presence.json](src/generated/battle-presence.json). Known bundles use source length/SHA; changed bundles try compatible prepared templates. Refresh with `npm run prepare:battle-presence -- ./main.js` from the extension root, then rebuild JavaScript and reload the extension/game. See the [all-feature preparation workflow](README.md#refreshing-all-generated-mappings). No raw plan JSON or AST parser must be installed into the Electron client separately.

The Electron client receives these messages through a restricted preload bridge and sends the activity to the locally running Discord desktop application through Discord IPC. It does not need an account token, Client Secret, additional npm package or a local HTTP server.

Outside a timed battle, the client supplies a fixed `timestamps.start` for its session. Returning to the lobby, changing sections, restoring presence after a cleared heartbeat or reconnecting Discord reuses that start time. A timed battle uses only `timestamps.end`; restarting the client starts a new session timer.

<a id="electron-client-integration-client-files"></a>

### Client files

Copy the reference files into a compatible Electron project (the development checkout used `C:/Project/tanki-online-with-ki`):

- `preload.ts` → `src/preload.ts`: accepts messages from the main Tanki Online game page and forwards validated text, countdown and party fields to Electron.
- `discordPresence.ts` → `src/discordPresence.ts`: connects to Discord, handles framing and handshake, retries connections and clears the activity.
- `discord-presence.json` → the client root: contains the public Application ID `1558302320163291306`.

The supplied `main.patch` integrates `ipcMain`, `DiscordPresence`, `validPresence`, and `copyPresence`, sets `preload: Path.join(__dirname, "preload.js")` in `BrowserWindow.webPreferences`, and registers `ki:discord-presence`. `contextIsolation` stays enabled and `nodeIntegration` disabled. The handler checks sender, main frame, game URL and payload. Navigation, renderer failure, an explicit clear or closure clears activity. Thirty seconds without a heartbeat clears it only while visible and not minimized. Hidden/minimized windows retain the last activity because renderer timers can be throttled; restore/show grants a fresh grace period without resetting the Discord session timer.

Review `main.patch` against the target client's `src/main.ts` before applying it; it is a reference diff for the original host structure, not a universal installer. A client that already contains the handler/preload must not receive duplicate IPC listeners or another copy of this integration.

The reference client uses its existing Forge/TypeScript build and needs no additional Discord RPC dependency. Ensure the target host compiles/packages the preload and main-process module and copies the root JSON, which the patch reads through `application.getAppPath()`. Build configuration may differ in another Electron project.

<a id="electron-client-integration-configuration"></a>

### Configuration

The Application ID is resolved in this order:

1. Command-line option `--discord-application-id`.
2. Environment variable `KI_DISCORD_APPLICATION_ID`.
3. Root `discord-presence.json`, field `applicationId`.

Use a Discord application named **Tanki Online**: Discord derives the displayed game name from that application. The extension supplies the current section and nickname. Without a valid ID the client leaves presence inactive and writes a configuration message to its log.

<a id="electron-client-integration-relationship-to-the-extensions-other-native-features"></a>

### Relationship to the Extension's Other Native Features

The extension now embeds fifteen native plan sets. Account discovery is available in browsers as well as the client; full Discord battle-presence enrichment remains client-specific. A missing store mapping can affect both verified ownership and presence, while a missing direction/supply/box/kill-feed plan need not disable the Discord bridge. Inspect the failing contract before refreshing unrelated plans.

The visible UID line can be completely hidden in streamer mode without deleting the underlying identity text. This does not remove the real account from the native cache. Discord uses its own masked state field: `Hidden`, not the SDF-font fallback used by the WebGL kill-feed. Map/mode, countdown and capacity remain activity fields; nickname hiding does not clear the entire activity.

There is no per-feature Discord switch in the fifteen-option settings panel. Presence activates only when the client bridge/environment is available. In an ordinary browser, absence of Discord activity is expected. The bridge is not installed merely by importing a history backup or opening a client-source link.

Weather continuity (2026-10-27): one runtime episode belongs to the native battle ID, not individual render scenes. Before a native map title or winter/space theme arrives no plan is generated. Missing optional lobby theme does not block ordinary-map rain. Once identified, secondary/loading canvases share the same seed, preset, start and fade. A different known ID selects its own matching cached/new episode. Verify full-battle precipitation beyond ten minutes across two contexts, late metadata, garage suspension/re-entry and migration of incompatible legacy precipitation.

### Snowfall (October 26, 2026)

`src/core/snowWeather/` contains fixed profiles in `config.ts`, snowfall GLSL in `shaders.ts` and public exports in `index.ts`. The shared Random battle weather switch selects precipitation from native map themes: WINTER_DAY/WINTER_NIGHT → snow; SUMMER_DAY/SUMMER_EVENING/SUMMER_NIGHT/AUTUMN_DAY → rain except Бойня/Massacre; SPACE → none. Missing theme no longer blocks ordinary maps: native map-title Space/Космос markers disable weather, Winter/Snow/Зима markers select snow, and other titles select rain except Massacre. An explicit native theme takes precedence. Only a missing map title and theme together keep planning pending. Legacy `k_weather_precipitation` is ignored. The common chance/duration/preset controls apply to new battle plans; matching cached episodes retain their seed/start on re-entry, while incompatible legacy cached modes are replaced. The five IDs remain sunny, overcast, drizzle, sunshower and storm; Random chooses a precipitating profile. Manual previews obey the same map restrictions and cannot force rain on winter maps.

At full intensity the GPU draws at most 20,000 snow instances, with two crossing crystal planes (12 vertices) for calm snow; a blizzard splits the budget into 4,000 crystals and 16,000 six-vertex soft ribbons. Hash-based world positions, per-flake fall speeds, lateral flutter and common wind drift require no per-flake CPU mesh or texture downloads. The fragment shader uses an anti-aliased sixfold crystal with a soft low-resolution fallback. The camera-centred bounded emission volume wraps world-fixed trajectories at faded borders; native depth testing occludes flakes behind map geometry. Native state is restored after rendering; resources compile lazily and are disposed on disable/context loss. Shader failure is reported as `snowError` and does not substitute rain. Snow is not a simulated fluid or accumulation model: the snowfall renderer itself does not accumulate terrain snow, create liquid puddles/refraction, thunder or rain audio. Snowdrifts are archived and have no active pass. Saved puddle preferences cannot enable liquid effects during snow. Existing collision depth provides visual occlusion, not a full indoor precipitation-volume solution. Rain and snow are mutually exclusive within each episode.

Blizzard motion (2026-10-26): 20,000 maximum flakes. Strong wind alone scales mean horizontal drift by 8 and fall speed by 1.8; bounded local flutter and faster tumbling distinguish a blizzard. Shared gusts use integrated sinusoidal displacement, not time multiplied by a changing velocity. The original calm/sunlit motion remains unchanged below the blizzard wind threshold.

Dense blizzard ribbons (2026-10-26): a blizzard narrows its bounded emission volume to 46 × 46 × 34 metres, adds coherent drifting density bands and much faster nearly horizontal transport. Near crystals and cheap soft ribbons use separate lazy shaders; ribbons perform no crystal branches/angular texture calculation. Both follow world-space trajectories with analytic gust integration and native depth occlusion. A fixed ID partition prevents density fades from moving existing trajectories. The full blizzard issues 144,000 particle vertices rather than the former 240,000 (40% fewer); this is a geometry-work comparison, not a measured FPS improvement. Wider particle coverage can still increase fragment work. Unsupported ribbon shaders fall back to crystals. There is no new fullscreen fog or lighting pass.

### Archived snow experiments (October 27, 2026)

`archive/snowdrifts-and-snow-tuner-2026-10-27/` preserves the complete previous snow module, collision-based snowbanks, deformation/cache/mesh shaders, 102-control developer panel and tuning profiles, plus integration snapshots, AST observer/plan and related tests. These are recovery sources, not production modules. No active imports, settings row, storage reader, developer hotkey or `__kaspSnow` API remain. The snowbank-only TRACKED/HOVER observer is removed from the current prepared AST plan (28 edits / 57 evidence templates). Ordinary tank/hull capture remains for rain-impact spray. Neither the build entries nor release packaging include the archive.

Rain/snow lifecycle still suspends immediately in the garage and resumes the same battle episode on return. During snow, the runtime sets puddle amount to zero, omits collision-map construction for liquid effects, clears spray and never warms reflection resources. The renderer independently rejects liquid reflections, puddles and spray for snow frames. This guard applies even to saved enabled rain-puddle preferences.
