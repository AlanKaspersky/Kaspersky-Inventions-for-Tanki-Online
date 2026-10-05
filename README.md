# Kaspersky's Inventions - Tanki Online Extension

## Complete Documentation

**Extension version:** 2.8.1 (`manifest.json`)

**Documentation updated:** October 5, 2026

**Interface languages:** English and Russian

**Extension format:** Chromium Manifest V3

This document describes the current source implementation, installation procedure, configuration, data storage, and maintenance workflow. The version displayed by the browser and the welcome window is obtained from the extension manifest.

## Technical Documentation

For implementation details, module logic, and workflows, see
[Complete Technical Documentation](DOCUMENTATION.md).

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technical Requirements](#technical-requirements)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Module Documentation](#module-documentation)
   - [Core Settings Module](#core-settings-module)
   - [Custom Play Button Module](#custom-play-button-module)
   - [Augment Specifications Module](#augment-specifications-module)
   - [Smart Paint Search Module](#smart-paint-search-module)
   - [Friend Tags & Categories Module](#friend-tags--categories-module)
   - [Trophy Favorites Module](#trophy-favorites-module)
   - [Auto-Upgrade Module](#auto-upgrade-module)
   - [Hide Nickname & XP Module](#hide-nickname--xp-module)
   - [Hide Currency Module](#hide-currency-module)
   - [Custom Garage Skins Module](#custom-garage-skins-module)
   - [Weapon Augment Tracker Module](#weapon-augment-tracker-module)
   - [Change Counter Module](#change-counter-module)
   - [Overdrive Timer Module](#overdrive-timer-module)
   - [Zero Resists Module](#zero-resists-module)
   - [Garage Buttons Module](#garage-buttons-module)
   - [Equipment Tracker Module](#equipment-tracker-module)
   - [Battle History Module](#battle-history-module)
   - [Welcome Window Module](#welcome-window-module)
7. [Keyboard and Mouse Controls](#keyboard-and-mouse-controls)
8. [Data Storage and Account Scope](#data-storage-and-account-scope)
9. [Battle History Import and Export Format](#battle-history-import-and-export-format)
10. [Privacy and Data Handling](#privacy-and-data-handling)
11. [CSS Customizations](#css-customizations)
12. [Architecture and Project Structure](#architecture-and-project-structure)
13. [Build and Release Procedures](#build-and-release-procedures)
14. [Testing and Verification](#testing-and-verification)
15. [Compatibility and Known Limitations](#compatibility-and-known-limitations)
16. [Troubleshooting](#troubleshooting)
17. [Maintenance Guidelines](#maintenance-guidelines)
18. [License and Project Status](#license-and-project-status)
19. [Acknowledgements](#acknowledgements)

## Overview

Kaspersky's Inventions is a browser extension that extends the Tanki Online interface with equipment information, navigation shortcuts, local battle history, privacy controls, and visual improvements. It integrates with the existing game client rather than providing a separate game interface.

The implementation consists of TypeScript modules, CSS files, HTML templates, and bundled JSON reference databases. JavaScript bundles in `dist/` are generated from the TypeScript entry points. The browser loads those bundles; it does not execute files in `src/` directly.

There are two categories of functionality:

- **Configurable features:** eight options exposed through the in-game KASPERSKY settings tab. All eight are disabled by default on a fresh storage context.
- **Automatically integrated features:** garage button styling, trophy favorites, garage skin image handling, equipment tracking, resistance presentation, equipment-change indicators, the reload indicator, and the version welcome window. These do not have individual switches in the current settings panel.

Most features affect presentation or maintain local records. The enhanced Play interface and Auto-Upgrade module also initiate ordinary game-interface actions. Auto-Upgrade can perform actual equipment purchases through the game's confirmation controls; its initial confirmation is therefore part of the workflow.

The project is an independent interface modification. Its relationship to Tanki Tweaks and conditions governing use and distribution are described in [LICENSE.txt](LICENSE.txt).

## Key Features

| Area | Current functionality |
|------|-----------------------|
| Battle navigation | Enhanced Play interface, seven mode shortcuts, quick battle, PRO battles, and festive mode |
| Equipment information | Augment descriptions and supported numerical stat adjustments |
| Collection navigation | Russian/English paint-name search with multiword matching |
| Friends | Online, offline, clan, and three color-category filters |
| Trophy progress | Favorites for up to two turrets and two hulls |
| Upgrades | X5, X10, X15, and MAX sequences with an initial confirmation |
| Privacy | Visual masking of nickname, XP, client UID, and supported currency displays |
| Garage presentation | Equipped skin artwork learned from the native skins interface |
| Battle statistics | Equipment-change indicators, resistance summaries, and captured equipment icons |
| Battle history | Result capture, cards, detailed player statistics, pagination, JSON import/export, linking, and clearing |
| Reload indication | Input-driven timing indicator with current base tables for Shaft and Scorpion |
| Interface styling | Garage icons, headers, navigation, dialogs, loading visuals, and layout adjustments |

Availability depends on the corresponding game elements being present and recognizable. The extension does not retrieve missing historical battles from the game server.

## Technical Requirements

### Browser Compatibility

The project targets Chromium-based browsers capable of loading Manifest V3 extensions. Google Chrome is the primary browser named by the installation workflow. Other Chromium browsers may provide an equivalent extensions page and unpacked-extension loader; identical behavior is not guaranteed across browser variants.

The JavaScript build targets `chrome100` syntax. This target is not a statement that every browser version has been tested. Firefox and mobile-browser installations are not documented or validated by this repository.

An Electron-specific mouse-navigation adapter is included. Its presence does not provide a standalone desktop installer or guarantee that every Electron client can load this extension.

### Runtime Resources and Access

The manifest declares content scripts for `tankionline.com` and its subdomains. Scripts run at `document_start`; the injector runs in the page's `MAIN` execution world, while the main extension logic uses the default content-script world.

Bundled `assets/`, `templates/*.html`, and `database/*.json` resources are exposed to matching game pages. The manifest contains no explicit `permissions` or `host_permissions` arrays. Feature data uses page-origin `localStorage`, `sessionStorage`, and IndexedDB, rather than `chrome.storage`.

Runtime JavaScript has no third-party UI-framework dependency. It does depend on the game DOM, browser APIs, game-provided fonts, packaged resources, and externally loaded game images or scripts.

### Development Requirements

Source builds require Node.js, npm, and the development dependencies declared in `package.json`:

- TypeScript for static type checking.
- esbuild for bundling and TypeScript transformation in regression tests.
- `@types/chrome` for browser-extension API types.

Tests require a Node.js version providing the built-in `node:test` runner. The repository does not currently declare a minimum Node.js version through an `engines` field.

Release packaging additionally requires Windows `tar` with ZIP support, or the `zip` command on non-Windows systems. These utilities are used by the existing release script.

## Installation

### Installing a Prepared Release

1. Extract the release archive to a persistent directory.
2. Locate the extracted folder containing `manifest.json` and `dist/`. Release ZIP files contain a versioned outer folder; select the extension folder inside it.
3. Open `chrome://extensions/`, or the corresponding extensions page in another compatible browser.
4. Enable Developer mode.
5. Select Load unpacked and choose the folder containing `manifest.json`.
6. Open or reload Tanki Online.
7. Configure the KASPERSKY tab in the game's settings.

Keep the extracted directory in place. An unpacked extension loads its resources from that directory; moving or deleting it can break the installation. A prepared release does not require Node.js or npm on the player's machine.

### Installing from Source

Obtain the repository through an authorized distribution channel, open a terminal in the project root, and run:

```sh
npm install
npm run typecheck
npm run build:js
```

Then load the project root as an unpacked extension. Before relying on `npm ci`, review the package/lockfile discrepancy under [Dependency Installation](#dependency-installation).

A checkout may already contain `dist/`, but its bundles can be older than the source files. Building JavaScript is required to apply TypeScript changes.

### Updating an Existing Installation

Replace or rebuild the files in the installed extension directory, reload the extension from the browser's extensions page, and reload the game tab. Updating source files alone does not update an already loaded page.

Reloading the extension or rebuilding JavaScript does not intentionally clear stored data. Clearing game site data or changing browser profiles can remove or separate those records. Export important battle history before changing storage contexts.

## Configuration

### Accessing Settings

1. Open Tanki Online settings.
2. Select KASPERSKY.
3. Enable the required features.
4. Close settings to apply the configuration workflow.

The module compares the final switch values with the values present when the panel was created. If the final configuration differs, closing settings reloads the page. Returning every switch to its original value avoids that reload.

Nickname privacy also updates its root CSS state immediately when switched on or off. Other modules may respond during their update cycle, but the settings-close reload remains the normal way to establish a consistent configuration.

### Available Settings

| Storage key | Setting | Default | Applies to |
|-------------|---------|---------|------------|
| `k_ext_btn` | Enhanced Play button | Disabled | Lobby battle navigation |
| `k_augments` | Augment specifications | Disabled | Recognized garage and equipment/reward cards |
| `k_auto_upgrade` | Quick weapon upgrades | Disabled | Supported garage upgrade controls |
| `k_friends` | Friend tags and categories | Disabled | Friends and supported invitation lists |
| `k_paints` | Smart paint search | Disabled | Garage paint collection |
| `k_hideCurrency` | Hide currency | Disabled | Supported currency displays outside battle |
| `k_hideNicknameXP` | Hide nickname and score | Disabled | Nickname, XP, self-player fields, and client UID |
| `k_history` | Keep a history of battles | Disabled | Result capture and Battle History |
| `k_overdrive_timer` | Overdrive box timer | Disabled | Automatic 85-second box countdown during battles |

Keys are case-sensitive and stored as the strings `true` or `false`. The general `k_` naming convention does not mean keys can be freely renamed; the exact keys above are used by the implementation.

### Language Selection

Language detection follows this priority:

1. `language_store_key` in the game's local storage.
2. The page's HTML language attribute.
3. A Russian-language hostname indication.
4. English as the fallback.

Russian and English are the supported interface languages. Map and paint localization also use bundled reference data. Language changes trigger update scheduling and can rebuild settings; reload the page if an already-created interface retains an older label.

## Module Documentation

### Overdrive Timer Module

**Setting:** `k_overdrive_timer` (disabled by default).

Enable **Overdrive box timer** in the KASPERSKY settings tab. A compact yellow indicator shows only the timer near the top of the battle screen (`top: 1em; left: 60%`). It displays `0:00` until an overdrive box pickup is detected, then counts down from `1:25`. Each subsequent pickup restarts the full 85-second countdown. The background transitions over 0.2 seconds, turns reddish during the final ten seconds and green at zero, while the indicator stays at `0:00`.

The indicator tracks overdrive model `1647333199409`. Model `1647333199408` is a speed boost and is ignored by this timer. The first observed pickup position is assigned to the indicator at `left: 60%`. When an overdrive pickup occurs at a distinct position, a second indicator appears at `left: 38%` with its own 85-second countdown. Picking up a box near either learned position restarts only that position's timer. Both indicators use the same presentation with `z-index: 1` and reset on battle changes. Both indicators retain their left anchors; completion keeps the numeric `0:00` display. Opening an in-battle section hides both indicators while their countdowns continue. A visible native tank preview (`TankPreviewComponentStyle-visible`) or a visible `.-container` section hides both indicators.

Positions are learned afresh in each battle, so there is no table of map-specific coordinates. Pickup positions within 250 game-world units of a learned position are grouped together to accommodate small shifts. This is a proximity heuristic based on the client's pickup vector; points closer than that tolerance or unusually large position changes may be grouped incorrectly. At most two positions are tracked. Once both positions are known, a pickup without valid coordinates or at a third distant position leaves both deadlines unchanged. Debugging can help adjust the tolerance if a map's behavior differs.

To collect diagnostics with a build containing the current injector, open the game page console, run `window.__kaspBonusDebug.enable()`, and reload the page before entering the battle. After observing box appearances and pickups at both locations, run `copy(window.__kaspBonusDebug.export())` to copy the journal. Disable collection with `window.__kaspBonusDebug.enable(false)`. Debug mode persists across reloads until disabled; up to 200 records are retained in memory per page. This journal observes the client; it does not establish a server respawn deadline.

Detection uses a hook in the game bundle's bonus pickup path, rather than screen-image recognition. The hook identifies the overdrive bonus model and sends a message to the extension module. The countdown does not depend on which player picked up the box; any matching pickup reported by the client restarts it. Other bonus types do not affect it.

The timer estimates the next appearance from the configured game interval. It does not receive a server respawn deadline or establish whether an uncollected box is currently present. Entering a battle alone does not start a countdown. Leaving the battle or replacing its canvas outside an in-battle section clears both countdowns and learned positions; deadlines are not saved across page reloads. The second indicator appears only after a pickup at its position has been observed.

Game updates may change the internal pickup code or bonus model identifier. If the hook cannot recognize a pickup, the timer remains at `0:00`; it does not invent a deadline. The overlay does not capture mouse input or add a gameplay hotkey.

### Core Settings Module

**Purpose:** Provides the KASPERSKY configuration tab inside native game settings.

The module creates localized toggles, stores changes through the settings cache, and restores native content when another settings tab is selected. A reload-required tooltip accompanies configuration labels.

The nickname-privacy toggle changes the privacy CSS state directly. See [Privacy and Data Handling](#privacy-and-data-handling) for the distinction between visual masking and removing data.

Settings are shared within the browser storage origin; they are not partitioned by game nickname.

### Custom Play Button Module

**Purpose:** Provides direct access to supported battle-selection paths from the lobby.

The interface contains the main Quick Battle button, two wide buttons for PRO and festive modes, and seven standard mode buttons:

| Shortcut | Mode |
|----------|------|
| `1` | Team Deathmatch |
| `2` | Control Points |
| `3` | Capture the Flag |
| `4` | Siege |
| `5` | Juggernaut |
| `6` | Rugby |
| `7` | Assault |

For standard modes, the module opens native Play, selects Modes, then the requested card. Quick Battle, PRO, and festive mode use direct selection paths.

Active matchmaking produces a locked/disabled state. Automated selection has a 1.5-second fail-safe; if the expected card does not appear in time, the extension exits its selection state. This timeout does not guarantee completion of a slow game menu.

Shortcuts are ignored while typing in text inputs, textareas, select controls, or editable content. They are also ignored for repeated events, modifier-key combinations, active matchmaking, and recognized native dialogs.

### Augment Specifications Module

**Purpose:** Displays bundled augment descriptions and recalculates supported visible equipment statistics.

Recognized device cards receive a specifications control. Hovering displays advantages and disadvantages in a tooltip positioned within the viewport. Its click is prevented from selecting the underlying card. Descriptions come from `database/augments.json`.

Supported parameter recognition includes damage, DPS, charge/reload values, turning speed, range, critical damage, healing, impact force, aimed and normal-shot damage, armor, mass, maximum speed, and power. Numerical adjustment requires a database modifier for the recognized parameter.

Live statistics retain the game's original value node and render a separate adjusted value. Calculations use original text rather than repeatedly multiplying adjusted output. Replacement nodes are reused when values are unchanged, and original display state is restored when a modifier no longer applies.

Conditional effects in descriptions do not imply that every effect can be represented as a permanent numerical adjustment. Bundled descriptions and modifiers may require maintenance after balance updates.

### Smart Paint Search Module

**Purpose:** Filters the paint collection using bundled Russian and English names.

The query is split into words after case normalization; Russian `ё` is normalized to `е`. Every word must appear somewhere in the combined Russian/English name. Partial names and multiple words can therefore match without a specific word order.

An empty query restores items. Nonmatching items and columns with no visible items are hidden. Matching depends on the image URL being present in `database/paints.json`; an unlisted paint is not guaranteed to appear for a nonempty query.

The module filters the collection already available in the client. It does not request additional items or modify paint ownership.

### Friend Tags & Categories Module

**Purpose:** Adds local friend classification and filters.

Available filters are All, Online, Offline, Clan, Purple, Yellow, and Red. Clan detection uses the current account's identifiable clan tag. Color assignments are managed through the supported player context menu; assigning the same category again removes that assignment.

Categories are stored under `tankiCustomCategories_{nickname}` and are not synchronized with the native friend service. Renaming or changing accounts does not automatically migrate the old category key.

The module reads real identity through the shared helper. Nickname masking therefore does not intentionally change the account key to `Hidden` or `Скрыто`.

### Trophy Favorites Module

**Purpose:** Shows locally selected equipment trophy progress in the lobby.

Favorite-star controls are added to supported trophy/quest cards. Up to two turret trophies and two hull trophies may be selected. Progress is refreshed from recognized garage cards and result-screen quest progress. The lobby panel displays current points, target points, and an item/reward icon.

Recognition uses `database/trophies.json`. Displayed progress is the latest observed interface value, not a separate live server query. Previously stored progress may remain visible until the relevant card is observed again.

Favorites are saved as one origin-wide list under `kasp_trophies_favorites`; this list is not keyed by nickname. There is no dedicated settings switch.

### Auto-Upgrade Module

**Purpose:** Performs consecutive upgrades through supported garage controls after explicit confirmation.

| Button | Requested sequence |
|--------|--------------------|
| X5 | Up to five upgrades |
| X10 | Up to ten upgrades |
| X15 | Up to fifteen upgrades |
| MAX | Continue until a recognized completion or stop condition |

Quick buttons require an eligible recognized upgrade control and an item not identified as completed or at maximum level. The initial extension dialog presents the step count; Buy or Enter starts the sequence. Canceling this dialog does not start it.

During a sequence:

- With no native dialog open, Enter initiates the next game upgrade action.
- A recognized non-Ruby confirmation button is clicked. The confirmation counter advances only if that click can be issued.
- A detected Ruby dialog is canceled and the sequence stops.
- An unrecognized open dialog stops the sequence and remains available for manual inspection. No fallback Enter is sent and the counter is not increased.
- A confirmation button disappearing before clicking also stops the sequence.
- The module waits for a confirmed dialog to close before starting another step.

Regular steps use a 30 ms scheduling interval. An unavailable-control path can retry up to 80 times at 100 ms intervals. These are polling intervals, not a guarantee of purchase speed.

Supported item/category/back-navigation clicks stop the active sequence. Recognition depends on native controls and currency markers. The local count represents confirmations issued, not an independently verified server transaction ledger. The initial extension confirmation and an unknown native dialog are handled differently by design.

### Hide Nickname & XP Module

**Purpose:** Masks supported account fields without replacing their original text.

The privacy class is established during startup before normal module updates. CSS masks known locations immediately once that class is active; a mutation observer updates markers and tooltips on newly inserted or changed elements.

Covered locations include:

- Header nickname and XP.
- The current player's nickname in native battle statistics and results.
- The current-player name in Battle History details and the linking dialog's target nickname.
- The client information parameter `UID: <nickname>`.

TYPE, VER, UPD, and SRV are not intentionally masked. Other players' names are not generally hidden.

Original text and child nodes are retained. Account-aware modules use `accountIdentity.ts`, preserving history ownership and friend-category identification.

Hover tooltips intentionally reveal original values on elements with tooltip metadata. This is visual privacy, not anonymization of the DOM, stored data, or exports.

### Hide Currency Module

**Purpose:** Masks recognized currency amounts outside battle.

Supported currency/header spans have their original numeric text saved in metadata and their displayed amount replaced with `Hidden` or `Скрыто`. Hover tooltips expose the saved value.

Unlike nickname privacy, this module replaces selected span text. It uses the normal update cycle and a 500 ms interval after initialization. Battle-screen processing is skipped; immediate masking of every price or numeric field is not guaranteed.

Coverage follows supported selectors, including displays used for rubies, crystals, and tankoins. Reload after changing this setting to reset the module and timer state consistently.

### Custom Garage Skins Module

**Purpose:** Keeps recognized garage thumbnails and mounted previews consistent with captured equipped-skin artwork.

The current implementation learns from the native skins interface. It does not provide a separate arbitrary skin-picker or unlock unowned skins. Equipment names and known stock images come from `database/skins.json`.

Learning requires the selected title to match the equipped nonstandard skin. Artwork from another selected preview is not treated as the equipped skin. A candidate must remain consistent across at least two observations before being written.

Recognized HTTPS game `.webp` artwork is stored when readable. Otherwise, a known stock image can be saved as a fallback and marked `unknown skin`. Equipping the standard skin clears the corresponding override after stabilization.

The module records recognized original image URLs and generates CSS replacements for supported thumbnails and mounted previews. It does not change the battle-rendered tank model or account ownership.

Artwork and base-image caches are origin-wide. Coverage depends on database entries and readable cards, rather than guaranteed support for every skin series. Garage checks include a 250 ms periodic pass alongside ordinary updates.

### Weapon Augment Tracker Module

**Purpose:** Displays an input-driven reload estimate for supported configurations.

Although name recognition includes many turrets, **current base reload tables exist only for Shaft and Scorpion**. Three configured augment multipliers and one timer-disabling augment are defined in `weaponAugmentTracker.ts`.

The module reads an equipped turret, MK level/step, and device icon in the garage and stores the configuration. Under pointer lock, left-button or Space press/release events drive the indicator, with separate handling for longer Shaft holds.

The bar is hidden when no duration is available or pointer lock is absent. It is not server telemetry or a measurement of every actual shot. Cached equipment, unknown devices, balance changes, interrupted inputs, or unsupported tables can affect the estimate. Visit the equipped turret's garage page to refresh its configuration. There is no settings-panel toggle.

### Change Counter Module

**Purpose:** Records observed equipment-change actions and adds a battle-statistics indicator.

The injector attempts to attach a hook to recognizable `TankUserActionLog` code. The module processes `CHANGE_EQUIPMENT` messages, stores per-player counts in `sessionStorage`, and marks players with nonzero observed counts.

The current interface adds an indicator column. It does not guarantee entire rows are highlighted yellow or numerical counts are displayed in every view.

The cache is cleared on detected departure from a battle canvas or a battle-ID reset event. Earlier unobserved actions cannot be reconstructed. Page messages are client-side signals, not an authenticated server audit trail.

### Zero Resists Module

**Purpose:** Extends native battle-statistics resistance presentation.

The module adds a shield heading, compact equipment/resistance cells, and zero-count summary entries for configured types absent from the native summary. These entries do not independently measure every player's resistance percentage.

A shield toggle switches between compact presentation and always showing all modules. State is saved under `kasp_tab_expanded`. Zero entries are removed when the corresponding resistance appears in the native summary. There is no separate settings switch.

### Garage Buttons Module

**Purpose:** Applies consistent upgrade, mount/equip, and purchase iconography.

Treatment depends on category, recognized labels, hotkeys, price markers, and surrounding controls. Paints, supplies, and equipment can receive different icons and hover states.

CSS masks provide icons, active/disabled colors, and directional effects. Native action handling is retained. Coverage follows selectors and label rules in `garageButtons.ts`.

### Equipment Tracker Module

**Purpose:** Captures the current player's equipment icons for Battle History.

The tracker locates the self row through a native ID, selected-row marker, or real nickname. It reads turret, turret augment, hull, and hull augment icons from image, background-image, or mask-image sources.

The latest recognized set is stored under `kasp_my_equipment` and copied into a result record. Missing observations can produce placeholders or previously cached icons. This is an auxiliary cache, not a complete inventory or per-battle server loadout record. Open native battle statistics during play when capture needs refreshing.

### Battle History Module

**Purpose:** Stores observed battle results locally and provides account-specific lists, detailed statistics, and backup tools.

Enable **Battle History** in extension settings. A history button is available in the lobby. Opening history prepares its templates and records and displays a short loading transition; the transition itself is not a request for server-side battle history.

#### Result capture

The module records the native result screen after identifying the current player and reading the required statistics. It captures the time of observation, map, mode, result, leaderboard position, reputation, kills, deaths, K/D, crystals, stars, and available player rows. Equipment icons come from the Equipment Tracker cache.

- The timestamp is the local capture time, not the official battle start time.
- Results are captured while the extension is running and the module is enabled. Earlier battles are not downloaded automatically.
- Account identity comes from the shared nickname reader; visual nickname hiding does not change the identity used for storage.
- Missing required result data delays capture until it becomes available. A failed database write allows another attempt.
- A processed-result guard prevents repeated capture during the same observed result-screen lifecycle. It is not a persistent duplicate detector across reloads.
- Mode, matchmaking/PRO kind, team membership, and victory status depend on recognizable native UI or available injector information. Missing information may use implementation defaults.
- Equipment and statistics reflect observed data. The extension does not independently reconcile them with a server ledger.

#### List and detailed view

The list shows records for the current nickname, newest first, with 15 records per page. Cards include the result, map, mode, date, and key statistics. Map names and artwork use the bundled map database when a match is available.

The detailed view provides captured player statistics, team grouping where applicable, and the current player's equipment icons. Missing optional data uses placeholders. Dates follow the browser's locale and time zone.

Deathmatch (DM) results show all players in one centered table: opponents use red row backgrounds and the current player is highlighted in blue. Saved player order is preserved. Team modes retain separate team tables.

The **All battles** button returns from details to the list. Back navigation also supports Escape, Z, and the mouse back button. These controls apply to the history view; an active confirmation or account-linking dialog handles its own interaction.

History integrates with the native settings window when the expected structure is available and can provide its own header otherwise. Its observer releases the view when the native window closes or navigation moves elsewhere. Async rendering checks the active account and current view before displaying results, preventing a completed older request from replacing a newer view.

#### Record management

| Action | Behavior |
| --- | --- |
| Export | Writes the current nickname's records to a JSON file. An empty history produces no export. |
| Import | Validates a non-empty JSON array and stores all accepted records in one transaction. Imported nickname ownership is retained. |
| Clear | Requires confirmation and deletes records belonging to the current nickname. Other nicknames remain stored. |
| Link account | Moves records from a selected stored nickname to the current nickname. This changes ownership; it does not copy records. |

Linking is useful after a nickname change or when importing records belonging to an earlier nickname. It does not merge friend categories, equipment caches, or other settings. The source nickname becomes empty after a successful move, and there is no dedicated undo operation. Export a backup before linking or clearing records.

Repeated imports create additional records: the module does not deduplicate by timestamp, score, or imported ID. Records imported under another nickname may therefore be present in the database without appearing in the current account's list.

#### Internal organization

[`src/modules/battleHistory.ts`](src/modules/battleHistory.ts) is the integration facade. Responsibilities are separated under [`src/modules/battleHistory/`](src/modules/battleHistory/): database access, validation, capture, presentation, views, navigation, actions, localization, and shared types.

### Welcome Window Module

**Purpose:** Presents release information and project credits after a version change.

The window loads the bundled welcome template and reads the extension version from the browser manifest. It avoids presenting the window while the game is loading. Closing it records the acknowledged version in `kasp_last_version`.

This acknowledgement belongs to the current game origin and browser profile. It is not separately tracked for each nickname. Clearing local site data can cause the window to appear again.

## Keyboard and Mouse Controls

| Context | Control | Action and conditions |
| --- | --- | --- |
| Enhanced Play panel | 1–7, including numpad digits | Select the corresponding displayed mode. |
| Enhanced Play panel | Space | Start the quick-play action when the panel is eligible. |
| Enhanced Play panel | Left Shift | Select the festive action when available. |
| Enhanced Play panel | Right Shift | Select the PRO action when available. |
| Auto Upgrade setup dialog | Enter | Start the selected upgrade sequence. |
| Extension dialog | Escape | Close a dialog where its controller provides this binding. |
| Battle History | Escape or Z | Return from details or close the history view, subject to active dialogs. |
| Battle History | Mouse back button | Invoke history back navigation. |
| Weapon/Augment Tracker | Primary mouse button and Space | Supply local firing input for the supported recharge estimate during pointer lock. |

Enhanced Play ignores editable controls, repeated key events, Ctrl/Alt/Meta combinations, recognized dialogs, and active searching/queue states. History blocks play shortcuts while its own view is open. A key's behavior therefore depends on the active screen and dialog.

Closing the Auto Upgrade setup dialog prevents a sequence from starting. Do not treat Escape as a universal emergency-stop binding for an already running upgrade sequence; item/category/back navigation is handled separately by the module.

## Data Storage and Account Scope

The extension uses the game's origin-scoped `localStorage`, `sessionStorage`, and IndexedDB. It does not use `chrome.storage` for these records.

An origin includes scheme, hostname, and port. Different game origins, browser profiles, or host applications can therefore have separate settings and histories. Logging into another account on the same origin does not necessarily create a separate storage area.

### Persistent settings and caches

| Storage key | Content | Scope within an origin |
| --- | --- | --- |
| `k_ext_btn` | Enhanced Play setting | Shared across accounts |
| `k_augments` | Augment Specifications setting | Shared across accounts |
| `k_auto_upgrade` | Auto Upgrade setting | Shared across accounts |
| `k_friends` | Friend Tags setting | Shared across accounts |
| `k_paints` | Smart Paint Search setting | Shared across accounts |
| `k_hideCurrency` | Hide Currency setting | Shared across accounts |
| `k_hideNicknameXP` | Hide Nickname/XP setting | Shared across accounts |
| `k_history` | Battle History setting | Shared across accounts |
| `tankiCustomCategories_<nickname>` | Friend category assignments | Partitioned by the recognized nickname |
| `kasp_trophies_favorites` | Trophy favorite selections and cached presentation data | Shared across accounts |
| `kasp_equipped_skins` | Observed custom skin selections | Shared across accounts |
| `kasp_base_images` | Base artwork used for skin replacement | Shared across accounts |
| `kasp_weapon_augment_tracker` | Last recognized weapon configuration | Shared across accounts |
| `kasp_my_equipment` | Latest observed self-equipment icons | Shared across accounts |
| `kasp_tab_expanded` | Resistance presentation preference | Shared across accounts |
| `kasp_last_version` | Acknowledged welcome-window version | Shared across accounts |

The game's `language_store_key` can influence language selection but is not an extension feature setting. Extension settings also participate in storage-event cache invalidation for recognized keys; this is not a guarantee that every cache or open view synchronizes immediately across tabs.

### Session data

`kasp_player_changes_cache` is stored in `sessionStorage` for observed equipment changes. Its lifetime follows the browsing session, and the module also resets it when leaving battle or receiving a battle-ID change event.

### Battle database

| Property | Value |
| --- | --- |
| Database | `TankiBattlesDB` |
| Schema version | `4` |
| Object store | `battles` |
| Primary key | Auto-generated `id` |
| Non-unique indexes | `date`, `map`, `mode`, `top`, `nickname` |

History records are partitioned logically by their `nickname` field in a shared database. Schema upgrades preserve existing records rather than deliberately recreating an empty database. Read/write helpers close their connections and handle version changes; write operations report completion after the transaction commits.

### Persistence and backups

Reloading the page normally preserves persistent settings and battle records. Clearing site data, resetting a browser profile, or using a different origin can remove or separate them. Uninstalling and reinstalling the extension is not a substitute for a data backup.

Battle History export covers battle records for the current nickname. It does not export all settings, friend categories, or every nickname in the shared database. Export each relevant account before changing profiles or clearing site data.

## Battle History Import and Export Format

Exports are UTF-8 JSON arrays with readable indentation. The filename follows `Tanki_BattleHistory_<nickname>_<YYYY-MM-DD>.json`; the filename date uses UTC, while the history UI formats dates in the browser's local time zone.

The following example illustrates the accepted structure:

```json
[
  {
    "nickname": "ExamplePlayer",
    "date": 1790899200000,
    "status": "Victory",
    "map": "ExampleMap",
    "mode": "TDM",
    "top": "1",
    "reputation": 1000,
    "kills": 12,
    "deaths": 4,
    "kd": 3,
    "crystals": 250,
    "stars": 10,
    "kind": "MM",
    "players": []
  }
]
```

### Validation rules

| Fields | Requirement |
| --- | --- |
| `nickname`, `status`, `map`, `mode`, `top` | Strings |
| `date` | A finite number greater than zero, in milliseconds |
| `reputation`, `kills`, `deaths`, `kd`, `crystals`, `stars` | Finite numbers |
| `kind` | Optional; when present, `MM` or `PRO` |
| `turretIcon`, `turretAugmentIcon`, `hullIcon`, `hullAugmentIcon` | Optional strings, subsequently sanitized as image URLs |
| `teamScoreMy`, `teamScoreEnemy` | Optional finite numbers |
| `players` | Optional array; defaults to an empty array |

Each supplied player requires string `name` and `rank`; finite numeric `gs`, `score`, `kills`, `deaths`, `kd`, `crystals`, and `stars`; and boolean `isEnemy` and `isMe`.

Validation checks the expected structure and types. It does not prove that a battle occurred, recalculate all derived statistics, or enforce non-negative values for every statistic. The example map name is illustrative rather than a bundled database entry.

### Import behavior and safe rendering

The top-level value must be a non-empty array. Every record is validated before writing begins. A validation error rejects the import; a transaction failure rolls back the write operation. Imported IDs and unrelated extra fields are not used as stored primary keys.

Nickname ownership is retained. Importing another account's backup does not silently reassign it to the logged-in account; use the history linking action when reassignment is intended.

Text from imported or existing records is escaped for HTML rendering. Player names and other stored text cannot become executable markup through the history templates.

Image URLs are restricted to HTTPS URLs on `tankionline.com` or its subdomains, without embedded credentials or a non-default port, and with a supported image extension: SVG, WebP, PNG, JPEG, GIF, AVIF, or ICO. Unsafe URLs become empty values and render through the missing-image fallback. Sanitizing an optional image does not by itself reject an otherwise valid record.

## Privacy and Data Handling

Feature settings and history data are stored locally in the game origin. The implementation does not provide cloud synchronization, a remote backup service, or an extension-owned analytics backend.

The injector requests the game's own bundle. Modules load bundled templates and databases, and some presentation uses game-hosted artwork. These operations should not be confused with a fully offline runtime.

Nickname and currency hiding are presentation features. They do not change account ownership, server requests, game transactions, or the original information available to the page. Nickname hiding preserves native text for other modules; supported locations are visually masked through CSS and metadata.

History exports contain nicknames, observed player statistics, timestamps, and equipment information. Review a backup before sharing it. Other scripts running in the same origin may be able to access origin storage; this storage is not an encrypted account vault.

## CSS Customizations

The manifest injects the extension's styles at document start. Some rules apply automatically; module-specific selectors or root classes control other effects. Disabling a feature switch does not remove every global stylesheet.

| Stylesheet | Principal responsibility |
| --- | --- |
| `mainUI.css` | General interface presentation |
| `battleHistory.css` | History list, details, and related controls |
| `animations.css` | Shared transitions and effects |
| `modal.css` | Extension dialogs |
| `shared.css` | Shared visual primitives |
| `garageButtons.css` | Garage action buttons |
| `navigation.css` | Navigation controls |
| `header.css` | Header presentation |
| `battleStats.css` | Battle statistics and equipment presentation |
| `killBoard.css` | Kill-board presentation |
| `augmentSpecs.css` | Augment parameter comparisons |
| `customFriends.css` | Friend categories |
| `customPaints.css` | Paint-search presentation |
| `customTrophies.css` | Trophy favorites |
| `hideCurrency.css` | Currency masking and hover presentation |
| `hideNickname.css` | Nickname/XP masking in supported locations |
| `settings.css` | Extension settings |
| `welcomeModal.css` | Welcome window |

Styles rely on game-generated class names and DOM structure. A game update can affect individual selectors without breaking every module. Prefer investigating the relevant stylesheet and module together when a control is misplaced or a masked element reappears.

## Architecture and Project Structure

```text
Kaspersky's Inventions/
├── manifest.json             Browser configuration and runtime entry points
├── README.md                 User and maintainer documentation
├── LICENSE.txt               Project terms
├── package.json              Build commands and dependency declarations
├── package-lock.json         Dependency lockfile
├── tsconfig.json             TypeScript configuration
├── src/
│   ├── kasp_main.ts          Main content-script entry point
│   ├── kasp_injector.ts      Game-bundle interception entry point
│   ├── core/                 Settings, identity, markup, and shared helpers
│   └── modules/
│       ├── battleHistory.ts  Battle History integration facade
│       ├── battleHistory/    History implementation and internal notes
│       └── ...               Other feature modules
├── dist/                     Generated JavaScript loaded by the browser
├── styles/                   Manifest-injected stylesheets
├── templates/                Bundled HTML templates
├── database/                 Bundled reference data
├── assets/                   Images and other presentation resources
├── _locales/                 Extension locale messages
├── tools/                    Release packaging and regression checks
└── release/                  Generated release folders and archives
```

### Runtime entry points

`dist/kasp_injector.js` runs at document start in the page's MAIN world. It observes the game script, fetches its bundle, and applies supported instrumentation before inserting the transformed script.

`dist/kasp_main.js` runs as the main content script. Its entry point guards against frame execution, initializes shared helpers and startup presentation, and schedules feature updates according to the observed game screen.

The extension manifest targets Tanki Online pages. It does not declare a background service worker or an additional `permissions` array. Bundled assets, templates, and databases are exposed through the manifest's web-accessible resource configuration.

### Update scheduling

A shared DOM observer schedules work through animation frames. Heavy module updates are throttled to approximately 150 ms, with screen changes able to trigger immediate updates. Garage and battle-statistics changes also have targeted processing paths.

Some modules maintain their own observation or timing loops, including skin observation and currency presentation. These are local UI updates rather than recurring requests for authoritative game state. Avoid adding repeated writes to already-correct DOM nodes: mutations produced by a module can otherwise trigger its own observer again.

### Injector failure handling

The injector checks `res.ok` before reading a fetched game bundle and catches errors in the fetch/transformation/insertion chain. On failure, it logs the error and attempts to restore loading through a native script element carrying the original script attributes. That recovery is attempted once; an additional load failure is logged.

Recovery can allow the game to load without the instrumentation. Features relying on intercepted game actions or battle identifiers can consequently have incomplete information. A successful HTTP response also does not guarantee that instrumentation patterns still match a changed game bundle or that every runtime/CSP condition is compatible.

### Reference data

Bundled databases supply augment modifiers, paint names, trophy metadata, and map information. They are reference snapshots, not a live server inventory. Unknown artwork or changed identifiers can prevent matching until the relevant data is updated.

## Build and Release Procedures

### Source of truth

JavaScript implementation changes belong in `src/`. Files under `dist/`, including `kasp_main.js`, are generated artifacts. Editing a generated bundle directly produces changes that the next build can overwrite.

Changes to CSS, templates, locale files, and bundled databases belong in their corresponding resource directories. Browser reloads alone do not compile TypeScript.

### Dependency installation

Use Node.js and npm capable of running the project's tooling. The project does not declare a Node.js `engines` requirement; packaging uses Node filesystem APIs such as `fs.cpSync`.

```powershell
npm install
```

The current repository has inconsistent dependency ranges between `package.json` and the root entry in `package-lock.json`: the package manifest declares `@types/chrome` `^0.0.260`, esbuild `^0.21.0`, and TypeScript `^5.4.0`, while the lockfile root declares `^0.3.0`, `^0.28.2`, and `^7.0.2`, respectively.

This discrepancy matters for reproducible installation. `npm ci` may reject an inconsistent lockfile; `npm install` can update it to match the package manifest. Maintainers should reconcile and review these declarations before relying on a clean CI installation.

### Available commands

| Command | Operation |
| --- | --- |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run build:js` | Bundles both TypeScript entry points into `dist/`. |
| `npm run build:zip` | Packages the files currently present into a release archive. |
| `npm run build` | Runs type checking, JavaScript bundling, and packaging in sequence. |
| `npm run release` | Alias for the complete build command. |
| `npm run watch` | Watches and rebuilds the JavaScript entry points. |

Bundling uses esbuild with IIFE output and the `chrome100` target. Watch mode does not run the separate TypeScript type check or create a release archive.

For a complete build:

```powershell
npm run build
```

For development without packaging:

```powershell
npm run typecheck
npm run build:js
```

After rebuilding, reload the unpacked extension and then reload the game page. An already running content script does not automatically become the rebuilt version.

### Version metadata

The current `manifest.json` version is **2.8.1**; `package.json` and the lockfile package version remain **2.8.1**. The browser, welcome window, and release-folder naming use the manifest version. These metadata values should be aligned as part of release maintenance.

### Release output

The packager copies `dist/`, `styles/`, `assets/`, `database/`, `_locales/`, and `templates/`, together with `manifest.json` and `LICENSE.txt`.

For the current manifest version, output is:

```text
release/
├── Kaspersky's Inventions 2.8.1/
│   ├── manifest.json
│   ├── LICENSE.txt
│   └── ... runtime directories
└── Kaspersky's Inventions 2.8.1.zip
```

The archive contains the versioned outer folder. Extract it and select the folder containing `manifest.json` when loading the extension. Source files, tests, `node_modules`, and this README are not included by the current packaging script.

Packaging replaces the existing output folder and ZIP for the same version. Preserve any release artifact that must be retained before rebuilding it.

On Windows, packaging invokes `tar -a`; on other platforms it invokes `zip`. The required archiver must be available on the command path.

`build:zip` does not regenerate JavaScript or run type checking. It also skips missing configured files/directories and only performs broad copy-count checks. Inspect the output contents and packaging log before distributing an archive; a successful archive operation does not prove that every required resource was included.

## Testing and Verification

### Automated checks

The repository includes focused Node regression tests under `tools/`:

| Test file | Coverage area |
| --- | --- |
| `augment-specs.test.cjs` | Augment presentation and repeat-update behavior |
| `battle-history.test.cjs` | Imported data, validation, and safe history markup |
| `battle-history-lifecycle.test.cjs` | Database transactions, account changes, async views, and navigation lifecycle |
| `nickname-privacy.test.cjs` | Privacy presentation and preservation of account identity |
| `injector-auto-upgrade.test.cjs` | Bundle-fetch recovery and recognized/unknown upgrade dialogs |

Run the type check and the regression suite explicitly:

```powershell
npm run typecheck
node --test tools/augment-specs.test.cjs tools/battle-history.test.cjs tools/battle-history-lifecycle.test.cjs tools/nickname-privacy.test.cjs tools/injector-auto-upgrade.test.cjs
```

There is no `npm test` script, and the full build does not invoke these tests. The tests use controlled fixtures and mocks; they do not replace verification against the current live game interface.

### Browser verification

For changes affecting multiple modules, verify the relevant flows after rebuilding and reloading:

1. Open extension settings, change a switch, close settings, and confirm that the expected reload and feature state occur.
2. Visit the lobby, garage, friends list, and trophy screen. Check native navigation and dialogs as well as extension controls.
3. With nickname hiding enabled, check the header, supported self rows, history, and client `UID` line. Confirm that identity-dependent features still use the actual nickname.
4. Compare augment parameters, close the tooltip, reopen it, and observe repeated garage updates for duplicated nodes or update loops.
5. Check the Auto Upgrade setup dialog and recognized confirmation flow. Use fixtures or a controlled environment for unknown-dialog handling; actual confirmation can spend account resources.
6. Capture a battle result and inspect both the history list and details. Check pagination and back navigation.
7. Export a backup, import a valid fixture, and verify account ownership. Check rejection of malformed data and literal rendering of HTML-like names.
8. Close the native settings window, navigate to another section, and reopen history. Check that stale overlays and async results do not reappear.
9. Inspect the extension errors and browser console, then inspect the packaged archive before release.

## Compatibility and Known Limitations

- The implementation relies on game-generated selectors, templates, artwork identifiers, and bundle patterns. Upstream changes can require updates to both code and reference data.
- The Chrome 100 build target specifies JavaScript output compatibility; it is not a certification that every Chromium version or host application has been tested.
- Electron-related adapter code does not by itself constitute a standalone native-client installer or universal Electron compatibility.
- The interface supports English and Russian. Recognition of native labels can be incomplete for other game languages.
- History records observed result screens, rather than retrieving an account's complete historical record from the server.
- Nickname and currency masking cover recognized locations. New or unsupported game elements may need additional selectors.
- Several caches are shared across accounts on the same origin. Their contents can be stale until the relevant module observes fresh data.
- Custom garage skins affect supported image presentation; they do not unlock items or replace the rendered 3D battle model.
- Recharge timing tables currently cover Shaft and Scorpion. Recognizing another turret name does not imply an accurate recharge model for it.
- Auto Upgrade depends on recognized native dialogs and stops on an unknown confirmation. Its local confirmation count is not an independently verified purchase ledger.
- Third-party UI modifications can alter the same elements and introduce selector, style, or event conflicts.

## Troubleshooting

| Symptom | Checks and corrective action |
| --- | --- |
| Extension cannot be loaded | Select the extracted folder containing `manifest.json`; inspect browser extension errors and confirm runtime resources exist. |
| Source edit has no effect | Rebuild `dist/`, reload the extension, and reload the game page. |
| A switch appears inactive | Confirm the switch is enabled, close settings to apply the reload, and revisit the appropriate game screen. |
| UI breaks after a game update | Inspect the affected module's native selectors, stylesheet, and reference-data matches. |
| Nickname hiding affects an unrecognized location | Add coverage for that native element while retaining the underlying account text and shared identity reader. |
| Currency appears before masking | Currency handling observes supported header controls and includes a timing loop; it does not promise immediate masking of every price on every screen. |
| A paint disappears from filtered results | Clear the query and check whether its artwork URL has an entry in the bundled paint database. |
| Trophy progress looks old | Open the corresponding native trophy cards so the module can observe fresh values. |
| Skin artwork does not update | Verify the equipped native card is recognized and its image URL is supported; allow the repeated-observation check to complete. |
| Recharge bar is unavailable | Check pointer lock, observed equipment, turret support, and augment exclusions. |
| Auto Upgrade stops unexpectedly | Inspect whether the current item/dialog is recognized, a ruby-related condition is detected, MAX is reached, or navigation interrupted the sequence. |
| History is empty after import | Check the current nickname and the imported records' `nickname` values; use linking if a transfer is intended. |
| History contains duplicates | Repeated import and reload capture do not provide persistent deduplication. Preserve a backup before clearing/reimporting a corrected set. |
| History equipment is missing or outdated | Open native battle statistics during play and allow Equipment Tracker to refresh its cache. |
| Database access fails | Check browser site-storage availability and console errors. Back up accessible records before clearing site data. |
| Settings/history differ between clients | Compare game origin, browser profile, and host application; storage is not synchronized globally. |
| Game loads but tracking is incomplete | Inspect injector errors and whether native fallback loaded the game without instrumentation. |
| `npm ci` rejects installation | Reconcile package-manifest and lockfile dependency declarations. |
| ZIP contains outdated code | Run the full build or rebuild JavaScript before `build:zip`; inspect the extracted contents. |
| Packaging command fails | Confirm the platform archiver is installed and on the command path. |

Avoid clearing all game-origin storage as the first troubleshooting step. It can remove extension history and settings as well as unrelated game data. Target the affected cache where appropriate and preserve battle exports first.

## Maintenance Guidelines

1. Modify TypeScript sources under `src/` and regenerate the runtime bundles through the documented build commands.
2. Keep configuration keys and defaults consistent with Core Settings. Document any storage migration when renaming a key.
3. Preserve native identity text. Use the shared nickname reader for account-dependent features and CSS masking for privacy presentation.
4. Make DOM updates idempotent: compare current state before changing text, attributes, or inserted nodes.
5. Release observers, listeners, timers, and overlays when their view or game context ends.
6. Guard asynchronous rendering against account changes and superseded requests.
7. Validate imported data before writing, escape stored text at rendering boundaries, and sanitize image URLs.
8. Preserve transaction completion and rollback semantics when changing history operations or schema migrations.
9. Treat unrecognized purchase confirmations as a stop condition. Keep bundle-loading error handling and native fallback intact.
10. Update EN/RU text, templates, reference data, relevant tests, version metadata, and this README when behavior changes.

Review changes in the final generated and packaged output as well as in the source tree. The browser executes the release artifacts, while future maintenance depends on the source implementation remaining authoritative.

## License and Project Status

The governing project terms are supplied in [LICENSE.txt](LICENSE.txt). That file identifies the software as proprietary and confidential, reserves rights to the author, and describes express integration rights for the official developers and maintainers of **Tanki Tweaks**. It also contains the warranty disclaimer and user agreement.

The `ISC` value currently present in `package.json` does not match the proprietary text supplied in `LICENSE.txt`. This metadata discrepancy should be resolved by the maintainer; this documentation does not grant additional distribution or modification rights.

Kaspersky's Inventions is an independent extension for the Tanki Online interface. Its presence in a project or client should not be presented as official endorsement by the game's developers.

## Acknowledgements

The current welcome-window credits identify **Kaspersky** as the originator of the project and name **safwan** and **Lukas** among contributors who helped its development.

The same template lists ChatGPT 6 Luna, ChatGPT 6.1 Sol, DeepSeek, Claude Sonnet 5.5, Claude Haiku 4.5, Gemini 3.5 Flash-Lite, Gemini 3.8 Flash, Gemini 3.1 Pro, and Grok 4.6 in its co-creation credits. Quality-review credits list Claude Fable 5.1, Claude Opus 5.5, and ChatGPT 6 Astra. These names reproduce project credits rather than specifying build dependencies.

For the in-game presentation of release information and credits, see [the welcome-window template](templates/welcome-modal.html).

---

Documentation aligned with extension manifest version **2.8.1*, updated **October 5, 2026**.
