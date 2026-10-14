# Kaspersky's Inventions - Technical Documentation

## Complete Implementation Reference

**Extension version:** 2.9.5 (`manifest.json`)

**Documentation updated:** October 14, 2026

**Interface languages:** English and Russian

**Runtime:** Chromium Manifest V3, TypeScript sources bundled as JavaScript IIFEs

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
| `src/core/clientPatches.ts`, `clientLexical.ts` | Runtime plan validation, merging, hashing, shared searches, and lexical filtering |
| `src/generated/` | Ten prepared JSON plan sets embedded into the injector build |
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

There is no universal shutdown controller for these page-lifetime observers and intervals. A page reload creates a new runtime.

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
| Every heavy pass | `changeCounter.onTick`, `overdriveTimer.sync`, welcome, nickname privacy, currency privacy, garage skins |
| Heavy pass in lobby/loading | Enhanced Play |
| Heavy pass while friends/invitations are open | Friend categories |
| Heavy pass in lobby/garage/results | Trophy favorites |
| Heavy pass in garage | Auto Upgrade, augment specifications, paint search |
| Every master check in garage | Garage button presentation |
| Every master check | Battle History |
| Every master check in lobby/results | Kill-board header synchronization |
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

The MAIN-world injector installs augment, critical, presence, statistics, action, inventory, arcade-diagnostic, and bonus bridges before observing script URLs containing `/static/js/main.`. Presence instrumentation is selected only for an Electron user agent. Runtime behavior depends on the installed `dist/` build, not unbuilt source files.

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

1. `bundleIntercepted` prevents processing multiple matching scripts, including scripts in the same mutation batch.
2. A fresh fallback script receives every original attribute, plus the original `async` property and nonce.
3. The observed element is assigned a blocked type and removed; the injector observer disconnects.
4. The original URL is fetched. Non-success HTTP status throws before reading its body.
5. Select each available prepared plan against the original source: source length/SHA-256 for known builds, AST-derived compatibility templates otherwise.
6. Report and isolate preparation failures; validate and merge accepted plans against original offsets. Reject stale or conflicting plans individually.
7. Append an inline script carrying the original type/nonce and merged text to the head or root.
8. Release the one-source analysis context in the promise chain's `finally`, including fallback paths.

Template misses leave the affected instrumentation absent. Required roles and expected match counts must resolve before a feature is installed. This is preflight compatibility checking, not a full runtime AST parse or proof of later native execution.

### Prepared Plans and Runtime Matching

Sources: [clientPatches.ts](src/core/clientPatches.ts), [clientLexical.ts](src/core/clientLexical.ts), and [src/generated/](src/generated/).

| Plan set | Runtime selector | Native contract |
| --- | --- | --- |
| `overdrive.json` | `selectBonusPatchPlan` | Pickup method/calls, pooled registration, bonus/vector prototypes |
| `arcade.json` | `selectArcadeReloadPlan` | Local weapon HUD, bar/material/layout, Shaft/Scorpio telemetry |
| `augments.json` | `selectGameAugmentsPlan` | Model cache writer, device/property/description/upgrade data, image resources |
| `garage-details.json` | `selectGarageDetailsPlan` | Native unavailable augment/skin/shot-effect selection and descriptions |
| `garage-items.json` | `selectGarageItemsPlan` | Existing unavailable item images, grayscale treatment, native selection |
| `garage-inventory.json` | `selectGarageInventoryPlan` | Read-only inventory diagnostics; no hidden-item insertion |
| `battle-presence.json` | `selectBattlePresencePlan` | Native DI store getter and battle-capacity writes; complete profile required |
| `battle-statistics.json` | `selectBattleStatisticsPlan` | Statistics constructor and loaded battle metadata |
| `user-action.json` | `selectUserActionPlan` | Action constructor and mapped player/action fields |
| `critical.json` | `selectCriticalPlan` | Critical readiness, shots, lifecycle, damage, Supercharge, equipment, local HUD |

Plans store `format`, `sha256`, `sourceLength`, `status`, guarded `edits`, and `templates`, plus feature schemas/profiles. Each edit uses original offsets, `expected` text, and up to 24 characters of context on each side. Templates store patterns, shared-role captures, counts, bounded search anchors, and generated insertion parts. Captured identifiers and role agreement are validated; quoted data uses JSON serialization. Temporary identifier collisions are avoided.

`clientSourceHash()` caches one digest promise per current source. `codeOffsets()` and `resolveTemplateEdits()` share a lazy lexical filter and anchor cache. One source is retained, anchor entries are bounded, and the injector releases the context after preparation. This cache is transient and unrelated to persistent garage items.

`createCodeOffsetGuard()` excludes comments, strings, regex literals, and template raw text while retaining substitutions as code. It tracks control parentheses, expression/block endings, labels/case heads, and line terminators to distinguish regex from division. It is a lexical filter, not a complete ECMAScript parser; new syntax remains a maintenance boundary.

`mergeClientPatchPlans()` validates complete plans and isolates conflicts. Multiple zero-length insertions at one offset are allowed because independent headers and HUD observers share legitimate locations. `clientPatchHeader()` preserves native top-level strictness before configuration statements; adaptive augment and critical headers use it.

Hash mismatch triggers template matching rather than immediate disablement. Compatible changes can relocate hooks without new mappings. Missing or ambiguous contracts skip the affected interception. Runtime errors after insertion are outside this preflight guarantee.

### Recovery and Limits

Fetch rejection, HTTP failure, body-reading failure, or synchronous transformation/insertion failure enters the catch handler. It logs the original error and appends the saved native script once. An error event on that fallback script and synchronous insertion failures are logged separately.

Fallback loading does not reinstall interception or guarantee instrumentation. A successfully appended inline script can still encounter a later runtime error or policy restriction that is outside the promise chain's synchronous catch. Mutation timing also remains a browser integration constraint; the injector is not a general script execution supervisor.

## Shared Core Services

### Settings Cache

Source: [src/core/settings.ts](src/core/settings.ts).

`SETTINGS_KEYS` defines nine known keys. At import time, each is read with default `false` and cached in `settingsCache`.

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

`installGameAugments(window)` runs in MAIN world before the game starts. Offline [tools/augments-ast.cjs](tools/augments-ast.cjs) maps fields from `DevicePropertiesCC`, `DevicePropertyEntity`, `DescriptionModelCC`, `GarageDeviceObject`, and upgrade diagnostics. It uses AST scope rather than an obfuscated constructor name alone. `selectGameAugmentsPlan()` selects an exact or compatible plan; `patchGameAugments(code, report, plan)` validates and applies it without rediscovering the full schema at runtime.

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

Sources: [garageDetails.ts](src/core/garageDetails.ts), [garageItems.ts](src/core/garageItems.ts), [garageInventory.ts](src/core/garageInventory.ts), and their `tools/*-ast.cjs` analyzers.

The description plan adjusts native unknown-item gates only while `k_augments` is true, allowing the game's original selected-device/skin/shot-effect description prefix to execute. It substitutes actual native previews and grayscale treatment for unavailable items. Purchase/mounting closures remain outside that templated prefix; showing information does not grant ownership or equip permission.

The item plan affects already existing garage cards: it permits their native preview and selection for supported unavailable non-paint items while enabled, then applies grayscale to unavailable artwork. It does not enumerate hidden/secret inventory into the UI. Paint special cases and disabled-setting behavior retain their native guards.

`installGarageInventoryDiagnostics()` captures an inventory reference/schema through a guarded hook. Calling `window.__kaspGarageInventoryDebug()` reads it on demand, returning counts and detached item rows including ID, name, categories, description, owned/buyable/visible/secret flags, preview and `renderedInDOM`. Reading is capped at 20,000 entries, invokes mapped collection/resource methods, and reports partial results on error. Unlike descriptor-only readers, this diagnostic can execute native getters/methods. Virtualization means `renderedInDOM` is not ownership or whole-page availability. There is no periodic inventory scan, hidden-item display switch, or purchase/ownership change.

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

### Discord Rich Presence

`src/modules/discordPresence.ts` uses the shared Electron detector and sends versioned `kasp:discord-presence` messages every three seconds. It stays inactive in ordinary browsers. `pagehide` clears activity; `pageshow` resumes the heartbeat. Labels are English; a recognized battle uses translated map plus mode. `state` is the account nickname, `Hidden` while nickname privacy is enabled, or `Signing in` without identity. Settings/storage changes refresh privacy immediately at the extension layer; client RPC coalescing still applies.

The MAIN reader in `battlePresence.ts` activates only for an Electron user agent. Prepared hooks capture a native DI store getter and capacity writes without changing their return values. Store reading still inspects semantic `toString` source and native collection/map interfaces: bounded traversal finds `BattleStatistics`, `BattleUsers`, and matching `BattleParams`. Spectators are excluded; capacity fallback accounts for team limits. AST migration does not replace every runtime field/collection assumption.

The reader polls once per second, preferring the native HUD clock and otherwise counting down from the latest native duration. The content listener validates map/mode/time/counts, ignores snapshots at least five seconds old, and applies only while `state.currentScreen === 'battle'`. Available `timestamps.end` and `party.size` are omitted outside that state or if invalid. Deadline changes within three seconds are suppressed to reduce jitter. Cyrillic names without an English translation fall back to an English screen label. `__kaspPresenceStoreDebug()` reports capture/error; `__kaspPresenceBattleDebug()` returns the last snapshot.

The companion preload/main-process integration accepts messages from the main HTTPS Tanki Online game page, validates sender/frame and payload, copies allowed fields, and uses native Discord IPC. Changed activities are coalesced over up to fifteen seconds; explicit clears are immediate and reconnect is automatic. Navigation, renderer failure, and closure clear activity. The supplied main patch clears a missing heartbeat after thirty seconds while visible; minimized/hidden windows retain the last activity, and restore/show grants a fresh grace period. Without an end timestamp, `DiscordPresence` reuses its fixed session start across lobby returns/reconnects. The public Application ID is client configuration; no account token is used. See [integration guide](tools/electron-discord/README.md).

### Electron Mouse Adapter

Source: [src/core/electron.ts](src/core/electron.ts).

`setupElectronZKey()` detects `Electron` in the user agent or an available `window.process.type`. It installs capture-phase mouse listeners only in that context.

Mouse button 3 generates synthetic Z keydown and keyup events unless focus is in an editable control. Buttons 3 and 4 have their default browser behavior suppressed on supported mouse phases. The adapter simulates input; it does not directly operate a native Electron navigation API.

### Window Declarations

[src/types/window.d.ts](src/types/window.d.ts) declares action/statistics callbacks, augment bridges/debug, critical bridge/debug, arcade debug, bonus callbacks/debug, and optional battle metadata. Presence and inventory bridges have additional local Window intersection types in their core modules. Declarations are type contracts, not runtime assignments; not every optional metadata global is populated.

## Settings Integration

Source: [src/core/coreSettings.ts](src/core/coreSettings.ts).

`coreSettings.inject()` requires the native options block and its menu. An existing `kaspersky-tab` prevents duplicate injection. It creates a reload tooltip, the KASPERSKY tab, and nine localized switches.

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

Initialization is one shared dictionary-loading promise; updates wait for it and require `trophyDictionaryLoaded`, avoiding a first panel with untranslated fallback IDs while the dictionary is still pending. `updateInterface()` compares `[state.lang, getFavs()]` with `panel.dataset.trophiesKey`; changed language/favorites/progress replace the panel, and empty favorites remove it. Dictionary failure does not automatically retry. Favorite-card listeners still capture values at creation, and progress remains observed/cached rather than a separate authoritative feed.

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

Source: [src/core/arcadeReload.ts](src/core/arcadeReload.ts), invoked by [src/kasp_injector.ts](src/kasp_injector.ts).

**Activation:** Automatic, for the local tank with Shaft or Scorpion. No garage configuration or settings toggle is needed.

Offline [arcade-ast.cjs](tools/arcade-ast.cjs) discovers the local HUD through `progressBarMaterial`, `LocalTank`, and `shaftWeapon`/`scorpioWeapon` semantics. [arcade-render.cjs](tools/arcade-render.cjs) generates guarded edits. Runtime `selectArcadeReloadPlan()` and `patchArcadeReload(code, report, plan)` select/validate an exact or adapted plan, without a full AST parser. The native bar/material constructors and scene layer create one extra `__kaspArcadeReloadBar`. Its instance projection delegates to the base mesh's final screen rectangle, then adds one row height. Native progress/resize/visibility/disposal control it. Remote tank title code is not modified. These are WebGL meshes, not DOM/SVG indicator elements.

The extra row has a fixed zero gap and an independent material whose current foreground is `#FFBB1C` (`0xffbb1c` in the offline generator). Native background/border parameters are preserved; this arcade feature does not recolor the base material. Centered HUD lower supply/effect icons shift by the added row height only while a supported local bar is visible. Upper icons and other weapons keep native positions.

Scorpion's arcade progress is the primary recharge field identified by its native shot-readiness calculation, rather than its secondary missile-charge field used by the original weapon bar. Shaft uses the current state object when it is an instance of the dedicated cooldown class discovered in the native state-machine registration. The registration result is an integer state ID, not the cooldown object. Its current state, cooldown deadline, duration, clock and arithmetic helpers are discovered from native functions. Completion outside that cooldown state shows a full bar. During native stun/pause flags, the last observed progress for the same weapon instance is retained until the native state and deadline resume. Missing or nonfinite telemetry hides the extra row. Original health and weapon progress updates remain intact.

No independent reload timer, firing-input listener, timing table, or augment-artwork multiplier is used. Native removal also removes the extra row. A separate diagnostic local-storage flag, `kasp_arcade_reload_enabled`, controls whether the injector installs the hook on the next page load; absent means enabled. `__kaspArcadeReloadDebug.setEnabled(false/true)` persists it but does not hot-remove existing meshes. No gap setter or settings-panel switch exists.


All necessary signatures must match uniquely before modification. Identifier renaming, dollar signs, whitespace, quote styles and tested minification variants are supported. Unsupported structures leave this feature's source unchanged and produce a diagnostic. This is an adapter to the current game structure, not a guarantee against arbitrary engine rewrites. Runtime errors hide the extra row, disable further attempts for that native HUD component and preserve the original panel update. `window.__kaspArcadeReloadDebug.status()` reports `hooked`, `panel`, `issues`, update count, the latest weapon/progress/mesh sample and `error`.

### Critical Shot Indicator

Sources: [criticalIndicator.ts](src/core/criticalIndicator.ts), [criticalDevices.ts](src/core/criticalDevices.ts), [critical-ast.cjs](tools/critical-ast.cjs), [critical-events-ast.cjs](tools/critical-events-ast.cjs), and [critical-supercharge.cjs](tools/critical-supercharge.cjs).

**Activation:** Automatic native local-HUD observation, with no settings-panel switch. Ordinary device cycles support Thunder/Strict Ammunition Load, Smoky/Sorted Ammunition, and Hammer/Revolver. Supercharge can show forced critical readiness even without a supported ordinary device cycle.

The prepared contract covers server readiness/reset callbacks, `TankInfoCC` equipment fields, native shot/lifecycle event prototypes, entity event dispatch, shooter damage metadata/collections, `TankSuperchargeCC` and its activation paths, local bar material attachment/frame/disposal. No native tank or remote nameplate visibility field is written. Mappings must be complete before installation.

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

Sources: [src/modules/overdriveTimer.ts](src/modules/overdriveTimer.ts), [src/core/bonusPickup.ts](src/core/bonusPickup.ts), and [styles/overdriveTimer.css](styles/overdriveTimer.css).

The module is registered as `modules.overdriveTimer`. Boot calls `setup()` once and `sync()` during normal heavy passes. A 250 ms interval maintains the display even when the battle DOM is otherwise idle. The setting `k_overdrive_timer` defaults to `false` and uses the existing settings panel, boolean cache, and settings-close reload workflow.

#### Pickup Bridge and Bundle Transformation

The MAIN-world injector installs the bonus bridge before processing the bundle. Offline [overdrive-ast.cjs](tools/overdrive-ast.cjs) uses `bonus pickup`, `onBonusCollision`, resource fields, and native pool structure to generate a complete plan and templates. `selectBonusPatchPlan()` selects exact/adaptive data and `patchBonusPickups(code, report, plan)` validates edits. Missing or ambiguous contracts skip this interception without replacing its original operations. The runtime does not rediscover diagnostic schemas by parsing the entire bundle.

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

`render()` creates `#kasp-overdrive-timer` only during a battle with the setting enabled. It displays only numeric `minutes:seconds`, using `0:00` before the first pickup and after completion. The background is yellow during the normal countdown, reddish during the final ten seconds, and green at zero; the text remains dark in every state, with a 0.2-second background-color transition. Text and title updates are conditional to avoid repeatedly waking the master DOM observer. Disabled or non-battle states remove the panel. The stylesheet uses `top: 2.5em`, `left: 55%`, medium-weight game fonts, and dimensions in `em`, with pointer events disabled, so it does not intercept battle controls.

The displayed deadline estimates a box's next appearance from a pickup; it does not confirm that a box is currently on the map. There is no manual restart key, sound alert, paid-access gate, or persistent deadline.

`renderTimer()` uses the `.kasp-overdrive-timer` styling. The primary panel is always shown during an enabled battle at `left: 55%`. `#kasp-overdrive-timer-secondary` appears at `left: 42.86%` after the second learned point is picked up, then remains visible until battle reset or disabling the feature. Both panels use `z-index: 1` and represent the same overdrive model at different positions; speed boosts remain excluded. Both panels retain their left anchors. Completion keeps `0:00` and changes only the background to green. An observer watches section insertion/removal and class, style, or hidden attribute changes: a visible native preview or `.-container` hides both panels without clearing deadlines, and returning to battle restores their current values. Container visibility is checked through layout rectangles and computed display, visibility, and opacity. Selectors are defined in `gameDOM.screens.tankPreview`, `gameDOM.screens.visibleTankPreview`, and `gameDOM.common.container`. The proximity tolerance is heuristic and requires verification on real maps, especially when spawn points are close together or pickup vectors vary significantly.

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
| `styles/cybersport.css` | Scoped Esports prototype and source Sport visual state; custom image variable, gradients, hover/focus, and selection. |
| `styles/header.css` | Header currencies, icon arrangement, and header presentation. |
| `styles/battleStats.css` | Native battle-statistics layout plus related equipment/resistance/skin presentation. |
| `styles/killBoard.css` | Result-table geometry, columns, headers, and kill-board layout. |
| `styles/overdriveTimer.css` | Two non-interactive countdown panels, colors, anchors, and visibility. |
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
| Nine `k_*` feature keys | `true`/`false` strings | Origin-wide settings; cached by Core Settings services |
| `kasp_arcade_reload_enabled` | Diagnostic Boolean string, absent means enabled | Read once for hook selection on each page load |
| `kasp_bonus_debug` | Opt-in Boolean string | Enables page-local bounded bonus journal; does not persist journal records |
| `language_store_key` | Game-owned language text | Read for language selection; not an extension setting |
| `tankiCustomCategories_<nickname>` | JSON object: friend name to color | Per recognized account nickname |
| `kasp_trophies_favorites` | JSON array of ID/type/icon/current/max entries | Origin-wide favorites with private memory cache |
| `kasp_equipped_skins` | JSON object: canonical equipment to artwork URL | Origin-wide learned skin overrides |
| `kasp_base_images` | JSON object: equipment to original URL arrays; older strings supported | Origin-wide skin matching cache |
| `kasp_weapon_augment_tracker` | Legacy JSON configuration object | No longer read or written by the native reload indicator |
| `kasp_my_equipment` | JSON object: turret/augments/hull plus `savedAt` | Origin-wide latest observed self icons |
| `kasp_tab_expanded` | Boolean string | Origin-wide resistance display preference |
| `kasp_last_version` | Manifest-version string | Origin-wide welcome acknowledgement |
| `kasp_last_nickname` | Nickname string | History's last recognized identity fallback |
| `kasp_player_changes_cache` | Session-storage JSON object: nickname to count | Session/battle observations |
| `kasp_augments_session_json` | Session-storage fallback for the device snapshot | Replaced on each page load; never restored as a data source |
| OPFS `kasp-augments.json` | Current serialized device snapshot | Game-origin private file; reset on page load, last writer across tabs |
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

Injector messages use `postMessage(..., '*')`. Current consumers classify payload content; they are not authenticated observations suitable as proof of server-side action.

### Principal Dependencies

| Dependency | Consequence |
| --- | --- |
| Account Identity → Friends/History/Equipment/Privacy | Original nickname text must remain readable. |
| DataLoader → Paint Search/Augment Specs/History Presentation | Reference readiness or matching controls the available output. |
| Game model observer → Augment Catalog → Augment Specs | Current-session properties and exact card identity control device output independently of packaged reference readiness. |
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
| 250 ms | Additional garage skin observation; separate overdrive rendering interval while enabled |
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
| 5,000 ms | Additional first-activation history nickname refresh |

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

Boot, Enhanced Play polling, currency polling, and privacy observation primarily live for the page execution. There is no single disposal registry covering them all. Feature disable/reload and view close are different operations with different cleanup scope.

## Build and Packaging Implementation

Sources: [package.json](package.json), [tsconfig.json](tsconfig.json), [manifest.json](manifest.json), and [tools/build-release.js](tools/build-release.js).

### Type Checking and Bundling

TypeScript targets ES2020, uses ESNext modules and Bundler resolution, enables `resolveJsonModule` for prepared plan imports, includes browser-extension types, and sets `noEmit`, `strict: true`, and `skipLibCheck: true`. Strictness covers implicit `any`, nullable values and function compatibility. Explicit assertions/`any` at external-data boundaries still require runtime validation. Root checking covers `src/`; the companion preload template has its own `tools/electron-discord/tsconfig.json` and minimal declaration, checked separately without installing Electron here.

esbuild consumes `src/kasp_main.ts` and `src/kasp_injector.ts`, bundles imports, outputs IIFEs to `dist/`, and targets `chrome100`. No source maps or declarations are produced through the current configured workflow.

| npm command | Implementation |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `parse:client` | Development-only Acorn CLI in `tools/client-parser.cjs`; local JS input, optional JSON AST export |
| `prepare:<feature>` | Ten development-only analyzer CLIs, detailed below; not invoked automatically by build |
| `build:js` | esbuild both entry points with bundle/IIFE/Chrome target flags |
| `build:zip` | Execute the Node release script |
| `build` | Type check → bundle → package |
| `release` | Invoke `build` |
| `watch` | Watch/rebundle both entries; no separate typecheck/package step |

`npm run parse:client -- <main.js> [--module] [--ast <output.json>]` parses a local file with Acorn (`ecmaVersion: latest`, source locations enabled) without evaluating it. The summary records input byte size/hash, parser and statement count. BigInt literals retain ESTree `bigint`/`raw`, with their non-serializable JS value replaced by null in JSON. Existing AST output is not overwritten. Missing paths are errors, not URLs to download. This inspection command does not prepare mappings; `--module` applies only to this parser CLI, not the script-mode preparation CLIs.

For a source change, the ordinary verification/build sequence is:

```powershell
npm run typecheck
$tests = @(Get-ChildItem -Path tools -Recurse -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
node --test $tests
npm run build
```

The build does not invoke regression tests automatically. Reload the extension and game page after regenerating bundles to execute them.

### Dependency Metadata

The manifest, package, and lockfile package versions are 2.9.5. Package/lockfile-root ranges agree: `@types/chrome` `^0.3.0`, esbuild `^0.28.2`, TypeScript `^7.0.2`, Acorn `^8.19.0`, acorn-walk `^8.3.5`, and Astring `^1.9.0`. The parser/walker/generator are development dependencies, not imports of the runtime entries.

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

Every command accepts `<main.js> [--out <plans.json>]` and `--help`. Run from the project root with an existing, unmodified local game bundle, for example `npm run prepare:critical -- ./main.js`. Root `main.js` is permitted analysis input; it is not the extension's main bundle. No AST JSON export is required.

The CLI strips an initial BOM, parses/analyzes JavaScript without evaluating it, requires a complete unambiguous plan, applies its edits in memory, and parses the resulting syntax. Before writing it checks the destination plan-set format. Plans with the same SHA are replaced; historical hashes are retained and the new plan is appended with `sourceName`. Incompatible analysis does not write a replacement file. Syntax validation does not establish runtime correctness.

Use the [all-feature PowerShell workflow](README.md#refreshing-all-generated-mappings) for all ten files. Commands are independent: failure of a later analyzer does not undo earlier successful outputs. Inspect JSON diffs and cross-plan tests, rebuild JavaScript, reload the extension, and fully reload the game. Build/watch/package do not run preparation automatically.

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
| `zipFolder(source, zip)` | Invoke Windows `tar -a` or non-Windows `zip -r`. |
| `main()` | Determine version, replace generated targets, copy configured inputs, check broad counts, archive, and log size. |

Configured directories are `dist`, `styles`, `assets`, `database`, `_locales`, and `templates`. Configured root files are `manifest.json`, `LICENSE.txt`, `README.md`, and `DOCUMENTATION.md`.

For 2.9.5, the folder and archive names are `release/Kaspersky's Inventions 2.9.5/` and `release/Kaspersky's Inventions 2.9.5.zip`. The ZIP contains that outer versioned folder.

The script removes the existing same-version output before recreating it. It throws if no directory or no root file was copied, but does not require every configured input to exist. `build:zip` can package stale bundles or partial resources if invoked without appropriate preparation.

Both root documentation files are copied. `src/`, raw plan JSON, tools/tests, dependencies, root `main.js`, AST exports, and `archived/` are not configured copy inputs. `.gitignore` currently excludes `node_modules/`, `release/`, ZIPs, `archived/`, and root `main.js`; an already tracked file remains tracked despite an ignore entry.

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
| `tools/augment-specs.test.cjs` | Observer feedback settles; unchanged values reuse nodes; updated native values/devices do not compound multipliers; original display is restored; replaced/invalid/translated rows are handled. |
| `tools/game-augments.test.cjs` | Semantic schema discovery, guarded instrumentation, native collection snapshots, exact large IDs, React ambiguity, empty conditional effects, RU/EN escaping, modifier safety, artwork collisions, and ordered JSON replacement with storage fallback. |
| `tools/battle-history.test.cjs` | Single-pass escaping; literal placeholder-like names; safe/spoofed image hosts; imported URL sanitization; stored card/detail markup; localized valid records; invalid shapes. |
| `tools/battle-history-lifecycle.test.cjs` | Account-scoped reads/clear/link; ID preservation; commit timing and rollback; capture completeness/retry/generation; sorting/pagination; stale accounts/views; back labels; animations; native and standalone opening; visibility/cleanup/return handling; dialogs; import/export; overlay retry/account switch. |
| `tools/nickname-privacy.test.cjs` | Original text/children/clan/XP remain; startup masking is synchronous; UID coverage preserves public parameters; account/language changes; identity fallbacks; friend/history ownership; disable/re-enable behavior. |
| `tools/injector-auto-upgrade.test.cjs` | HTTP/network/body failure fallback; original attributes; both hook patterns; same-batch interception guard; unknown-dialog stop; Ruby cancellation; normal count; disappearing confirmation. |
| `tools/arcade-reload.test.cjs` | Native local-HUD factory/viewport projection/visibility/disposal reuse, centered and tank-following HUD across UI scales, numeric state IDs vs actual Shaft cooldown instances, primary vs secondary progress, local weapon changes, Shaft stun/pause, renamed/minified bundles, idempotence and failures. |
| `tools/overdrive-timer.test.cjs` | Bonus instrumentation, model/sound association, bounded diagnostics, independent learned spawn positions, 85-second countdowns, and overlay lifecycle. |
| `tools/critical-indicator.test.cjs` | Exact device recognition, readiness/cycles/misses, lifecycle, Supercharge end offsets, damage synchronization, and native local/remote behavior preservation. |
| `tools/client-patches.test.cjs` | Regex/division/template lexical cases, shared SHA lifetime, strict directives and multiple header inserts. |
| `tools/client-parser.test.cjs` | Parser CLI, syntax/input errors, output protection and serializable AST data. |
| `tools/overdrive-ast.test.cjs` | Offline contract mapping, adaptive relocation, lexical decoys, native call preservation and CLI failure. |
| `tools/arcade-ast.test.cjs` | Compatible merged plans and preparation output protection. |
| `tools/augments-ast.test.cjs` | Scoped model fields/writers, renamed contracts, ambiguity, return/strict preservation and merged plans. |
| `tools/garage-details.test.cjs` | Native descriptions and selection, preserved action branches, disabled setting, renamed/adaptive contracts. |
| `tools/garage-items.test.cjs` | Existing unavailable cards/previews, disabled/native selection behavior, format/rename adaptations. |
| `tools/garage-inventory.test.cjs` | Read-only capture/export, item flags, mapped collection calls, bounds and adaptive plans. |
| `tools/battle-presence-ast.test.cjs` | Store/capacity profiles, compatible getter/writer interception, exact/adaptive merge and CLI. |
| `tools/battle-statistics-ast.test.cjs` | Loaded fields, native matchmaking Boolean, mode extraction, decoys and constructor behavior. |
| `tools/user-action-ast.test.cjs` | Mapped UID/action/relation, getter avoidance, scope ambiguity, native construction and CLI. |
| `tools/custom-trophies.test.cjs` | Initial dictionary readiness/localization and panel updates after language/favorite/progress changes. |
| `tools/electron-discord/discord-presence.test.cjs` | Payload validation/privacy, battle store/clock/capacity, IPC handshake/framing, reconnect and fixed session timestamps. |

There is no `npm test` command. The recursive PowerShell invocation above includes every `.test.cjs`, including companion Discord tests; `test-client-patches.cjs` is a helper, not a test file. Tests target source, so passing tests do not demonstrate that the installed `dist/` was rebuilt. The companion template can also be typechecked with `npx tsc --project tools/electron-discord/tsconfig.json`.

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

## Implementation Limits and Project Terms

The implementation depends on observed native DOM, generated bundle patterns, known labels, exact artwork identifiers, and packaged reference snapshots. It cannot reconstruct unobserved events or guarantee compatibility with future game changes.

History stores local observations rather than server-certified records. Equipment and trophy data can be cached; arcade reload presentation uses client-native weapon state. Privacy masks presentation while original account information remains available to the page and local exports.

Origin storage is accessible to appropriately situated same-origin code and is not an encrypted account vault. Injector message payloads are client-side signals, not authenticated audit events. Safe history rendering is a targeted boundary and should not be interpreted as a universal sanitizer for every module's storage or markup.

The Chrome build target does not certify every Chromium/Electron version, and the Electron adapter is not a native installation system. Shared CSS and third-party UI modifications can interact through overlapping selectors and event handlers.

Project use and distribution are governed by [LICENSE.txt](LICENSE.txt), which contains proprietary terms and express Tanki Tweaks integration rights. The package's `ISC` metadata differs from that file and should not be interpreted here as granting additional rights.

---

Technical documentation aligned with source/manifest version **2.9.5**, updated **October 14, 2026**.
