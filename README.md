# Kaspersky's Inventions - Tanki Online Extension

## Complete Documentation

**Extension version:** 3.0.0 (`manifest.json`)

**Documentation updated:** October 22, 2026

**Interface languages:** English and Russian

**Extension format:** Manifest V3 for Chromium and Firefox (Firefox 128.0 minimum declared in the manifest)

**Project terms:** Proprietary; package metadata: `UNLICENSED`. See [LICENSE.txt](LICENSE.txt).

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
   - [Lobby Navigation Tiles](#lobby-navigation-tiles)
   - [Account ID Discovery and Lobby Status](#account-id-discovery-and-lobby-status)
   - [Tankoin Balance](#tankoin-balance)
   - [Lobby Pass Cards](#lobby-pass-cards)
   - [Core Settings Module](#core-settings-module)
   - [Custom Play Button Module](#custom-play-button-module)
   - [Cybersport Format Prototype](#cybersport-format-prototype)
   - [Augment Specifications Module](#augment-specifications-module)
   - [Smart Paint Search Module](#smart-paint-search-module)
   - [Friend Tags & Categories Module](#friend-tags--categories-module)
   - [Trophy Favorites Module](#trophy-favorites-module)
   - [Auto-Upgrade Module](#auto-upgrade-module)
   - [Hide Nickname & XP Module](#hide-nickname--xp-module)
   - [Hide Currency Module](#hide-currency-module)
   - [Hide Supplies Module](#hide-supplies-module)
   - [Box Pickup Visuals](#box-pickup-visuals)
   - [Custom Garage Skins Module](#custom-garage-skins-module)
   - [Weapon Augment Tracker Module](#weapon-augment-tracker-module)
   - [Critical Shot Indicator](#critical-shot-indicator)
   - [Discord Rich Presence](#discord-rich-presence)
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

## Start Here

This repository documents extension **3.0.0**, reviewed against source on **October 22, 2026**. A feature described as implemented below has a corresponding runtime module; experimental console reports are not treated as shipped features.

| Document | Audience and contents |
| --- | --- |
| [README](README.md) | Installation, feature behavior, settings, backups, troubleshooting and credits |
| [Technical reference](DOCUMENTATION.md) | Execution worlds, native mappings, module contracts, storage, lifecycle and development |
| [Maintenance guide](MAINTENANCE.md) | Failure isolation, diagnostics, native updates, regression checks and release review |
| [FAQ](docs/FAQ.md) | Practical questions about settings, privacy, history, account discovery and compatibility |
| [Russian user guide](docs/USER_GUIDE.ru.md) | Installation, feature groups, everyday workflows, data and recovery in Russian |
| [English store description](docs/DESCRIPTION.en.md) / [Russian store description](docs/DESCRIPTION.ru.md) | Full public descriptions, ending with the current welcome-window credits |
| [Electron integration](tools/electron-discord/README.md) | Optional client-side Discord preload/IPC integration |
| [License and Terms of Use](LICENSE.txt) | English international edition; proprietary terms and retained Tanki Tweaks permission |

For players, begin with Installation and Configuration. For a developer changing native hooks, begin with the technical reference and maintenance guide. A prepared extension needs no Node.js installation; source development does.

## Overview

Kaspersky's Inventions is a browser extension for Chromium and Firefox that extends the Tanki Online interface with equipment information, navigation shortcuts, local battle history, privacy controls, and visual improvements. It integrates with the existing game client rather than providing a separate game interface.

The implementation consists of TypeScript modules, CSS files, HTML templates, and bundled JSON reference databases. JavaScript bundles in `dist/` are generated from the TypeScript entry points. The browser loads those bundles; it does not execute files in `src/` directly.

There are two categories of functionality:

- **Configurable features:** thirteen options exposed through the in-game KASPERSKY settings tab. Eleven default to disabled; arcade reload and critical indicators default to enabled.
- **Automatically integrated features:** garage button styling, trophy favorites, garage skin image handling, equipment tracking, resistance presentation, equipment-change indicators, the version welcome window, and Discord presence in a compatible Electron client. Arcade reload and critical indicators have their own live switches. The remaining automatic integrations have no individual switches in the current settings panel.

Most features affect presentation or maintain local records. The enhanced Play interface and Auto-Upgrade module also initiate ordinary game-interface actions. Auto-Upgrade can perform actual equipment purchases through the game's confirmation controls; its initial confirmation is therefore part of the workflow.

The project is an independent interface modification. Its relationship to Tanki Tweaks and conditions governing use and distribution are described in [LICENSE.txt](LICENSE.txt).

## Key Features

| Area | Current functionality |
|------|-----------------------|
| Battle navigation | Enhanced Play interface, seven mode shortcuts, quick battle, PRO battles, and festive mode |
| PRO format prototype | Esports card between Sport and Parkour, selecting native Sport with custom artwork |
| Equipment information | Augment advantages/disadvantages and supported numerical stat adjustments |
| Collection navigation | Russian/English paint-name search with multiword matching |
| Friends | Online, offline, clan, and three color-category filters |
| Trophy progress | Favorites for up to two turrets and two hulls |
| Upgrades | X5, X10, X15, and MAX sequences with an initial confirmation |
| Privacy | Visual masking of nickname, XP, client UID, and supported currency displays |
| Supply privacy | Garage inventory quantities omitted; supported strip and WebGL battle quantities replaced with zero |
| Garage presentation | Equipped skin artwork learned from the native skins interface |
| Battle statistics | Equipment-change indicators, resistance summaries, and captured equipment icons |
| Battle history | Result capture, cards, detailed player statistics, pagination, ID-scoped JSON import/export and clearing |
| Arcade reload | An additional native HUD bar for the local Shaft or Scorpio, driven by game cooldown state |
| Critical shots | Native reload-bar coloring for Thunder/Strict Ammunition Load, Smoky/Sorted Ammunition, and Hammer/Revolver; Supercharge handling and a Terminator guard during Juggernaut transformations |
| Overdrive boxes | Automatic pickup-based 85-second countdowns for up to two learned positions |
| Discord presence | English map/mode, nickname or Hidden, battle countdown, and player capacity in a compatible Electron client |
| Interface styling | Garage icons, headers, navigation, dialogs, loading visuals, and layout adjustments |
| Lobby and settings | Original icon tiles, native pass notifications, continuous artwork, grouped RU/EN settings and hidden-scrollbar scrolling |
| Account ownership | Early cooperative native ID discovery, page-local path/schema cache and a lobby-only search notice |
| Box pickup visuals | Optional flash and bounded fading fragments; native pickup rewards and completion remain |

Availability depends on the corresponding game elements being present and recognizable. The extension does not retrieve missing historical battles from the game server.

## Technical Requirements

### Browser Compatibility

The manifest supports Chromium-based desktop browsers with Manifest V3 and declares Firefox support through `browser_specific_settings.gecko`:

- **Chromium:** install through the browser's unpacked-extension loader; Chrome instructions are provided below.
- **Firefox:** minimum declared version **128.0**, with add-on ID `kaspersky-inventions@tankionline.local`. Local testing and signed installation use different workflows, described below.

The JavaScript build still targets `chrome100` syntax and produces the same two bundles for both browsers. The manifest declaration is not evidence that every feature has been tested on every browser version. Firefox should be checked in the live game, including page-world injection, packaged resources, settings, and local storage. Mobile-browser installation is not covered by this project.

An Electron-specific mouse-navigation adapter is included. Its presence does not provide a standalone desktop installer or guarantee that every Electron client can load this extension.

Discord Rich Presence is available in a compatible Electron client with the KI preload bridge. The extension supplies the activity data; the client communicates with the locally running Discord desktop application. Ordinary browser sessions do not activate this module. See [Discord Rich Presence](#discord-rich-presence) and the [client integration guide](tools/electron-discord/README.md). Updating the extension alone cannot install a missing preload bridge into an existing client executable.

### Runtime Resources and Access

The manifest declares content scripts for `tankionline.com` and its subdomains. Scripts run at `document_start`; the injector runs in the page's `MAIN` execution world, while the main extension logic uses the default content-script world.

Bundled `assets/`, `templates/*.html`, and `database/*.json` resources are exposed to matching game pages. The manifest contains no explicit `permissions` or `host_permissions` arrays. Feature data uses page-origin `localStorage`, `sessionStorage`, and IndexedDB, rather than `chrome.storage`.

Runtime JavaScript has no third-party UI-framework dependency. It does depend on the game DOM, browser APIs, game-provided fonts, packaged resources, and externally loaded game images or scripts.

### Development Requirements

Source builds require Node.js, npm, and the development dependencies declared in `package.json`:

- TypeScript for static type checking.
- esbuild for bundling and TypeScript transformation in regression tests.
- `@types/chrome` for browser-extension API types.
- Acorn and acorn-walk for offline game-bundle parsing and analysis.
- Astring for generating code used in prepared patch plans.

Tests require a Node.js version providing the built-in `node:test` runner. The repository does not currently declare a minimum Node.js version through an `engines` field.

Release packaging additionally requires Windows `tar` with ZIP support, or the `zip` command on non-Windows systems. These utilities are used by the existing release script.

## Installation

### Installing a Prepared Release

#### Chromium

1. Extract the release archive to a persistent directory.
2. Locate the extracted folder containing `manifest.json` and `dist/`. Release ZIP files contain a versioned outer folder; select the extension folder inside it.
3. Open `chrome://extensions/`, or the corresponding extensions page in another compatible browser.
4. Enable Developer mode.
5. Select Load unpacked and choose the folder containing `manifest.json`.
6. Open or reload Tanki Online.
7. Configure the KASPERSKY tab in the game's settings.

Keep the extracted directory in place. An unpacked extension loads its resources from that directory; moving or deleting it can break the installation. A prepared release does not require Node.js or npm on the player's machine.

#### Firefox

For local testing with Firefox 128 or newer:

1. Extract the archive and locate the inner folder containing `manifest.json` and `dist/`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose that folder's `manifest.json`.
4. Open or fully reload Tanki Online and configure the KASPERSKY settings tab.

A temporary add-on remains installed until Firefox restarts or it is removed. See Mozilla's [temporary installation instructions](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

For persistent installation in standard Firefox, use an author-provided Mozilla-signed add-on, through its published listing or **Install Add-on From File** in `about:addons`. See Mozilla's [signed self-distribution instructions](https://extensionworkshop.com/documentation/publish/install-self-distributed/). This repository's `build:zip` creates both an outer-folder distribution ZIP and a Firefox-layout ZIP with a root manifest; it does not sign a Firefox XPI. Adding the Gecko ID does not sign the extension.

### Installing from Source

Obtain the repository through an authorized distribution channel, open a terminal in the project root, and run:

```sh
npm ci
npm run typecheck
npm run build:js
```

Then load the project root using the Chromium unpacked-extension workflow or select its `manifest.json` as a temporary Firefox add-on. The package manifest and lockfile currently agree; see [Dependency installation](#dependency-installation).

A checkout may already contain `dist/`, but its bundles can be older than the source files. Building JavaScript is required to apply TypeScript changes.

### Updating an Existing Installation

Replace or rebuild the files in the installed extension directory, reload the extension from the browser's extensions page, and reload the game tab. Updating source files alone does not update an already loaded page.

For a temporary Firefox installation, use **Reload** in `about:debugging`; load it again after restarting Firefox. For a signed installation, install the updated signed package through its distribution channel.

Reloading the extension or rebuilding JavaScript does not intentionally clear stored data. Clearing game site data or changing browser profiles can remove or separate those records. Export important battle history before changing storage contexts.

## Configuration

### Accessing Settings

1. Open Tanki Online settings.
2. Select KASPERSKY.
3. Enable the required features.
4. Close settings to apply the configuration workflow.

The module compares the final switch values with the values present when the panel was created. If the final configuration differs for a setting that requires reload, closing settings reloads the page. Arcade reload, critical indicator, supply privacy and box pickup animation switches apply live and do not by themselves request that reload. Returning every switch to its original value avoids that reload.

Nickname privacy also updates its root CSS state immediately when switched on or off. Other modules may respond during their update cycle, but the settings-close reload remains the normal way to establish a consistent configuration.

### Available Settings

| Storage key | Setting | Default | Applies to |
|-------------|---------|---------|------------|
| `k_ext_btn` | Enhanced Play button | Disabled | Lobby battle navigation |
| `k_augments` | Augment specifications | Disabled | Recognized garage cards, unavailable item previews, and native unavailable-item descriptions; excludes Possible Rewards |
| `k_auto_upgrade` | Quick weapon upgrades | Disabled | Supported garage upgrade controls |
| `k_friends` | Friend tags and categories | Disabled | Friends and supported invitation lists |
| `k_paints` | Smart paint search | Disabled | Garage paint collection |
| `k_hideCurrency` | Hide currency | Disabled | Supported currency displays outside battle |
| `k_hideNicknameXP` | Hide nickname and score | Disabled | Nickname, XP, self-player fields, client UID and the local player's WebGL action-log names |
| `k_hideSupplies` | Hide supplies | Disabled | Supply quantities in the garage and battle HUD; applies live |
| `k_history` | Keep a history of battles | Disabled | Result capture and Battle History |
| `k_overdrive_timer` | Overdrive box timer | Disabled | Automatic 85-second box countdown during battles |
| `k_arcade_reload` | Arcade reload indicator | Enabled | Additional Shaft/Scorpio bar; live switch |
| `k_critical_indicator` | Critical shot indicator | Enabled | Native reload-bar coloring; live switch |
| `k_box_pickup` | Modified box pickup animation in battle | Disabled | Visual changes category; flash and fading fragments for observed pickups by any player; live switch |

The Russian label for `k_augments` is **«Характеристики устройств»**, with the description **«Включая недоступные предметы»**. The English interface currently uses **Augment specifications**. Both labels control the same setting and storage key.

Keys are case-sensitive and stored as the strings `true` or `false`. The general `k_` naming convention does not mean keys can be freely renamed; the exact keys above are used by the implementation.

### Settings Groups and Layout

The tab has four feature categories and an Information panel. History belongs to Standard features.

| Category | Options |
| --- | --- |
| Standard features / Функции обычной серьёзности | Friend tags; Augment specifications; Quick upgrades; Enhanced Play button; Smart paint search; Battle history |
| Streamer mode / Режим стримера | Hide nickname and XP; Hide currency; Hide supplies |
| Advanced features / Функции повышенной серьёзности | Overdrive box timer; Arcade reload indicator; Critical shot indicator |
| Visual changes / Графические изменения | Modified box pickup animation in battle |

There are **13 switches**: only arcade reload and critical indication default to enabled. These labels organize the interface; they do not describe official approval or promise a particular performance cost.

The standard panel occupies the left column; streamer and advanced panels share the right column. Visual changes and Information span the content width. Narrow content uses one column. Each column's artwork uses a shared image origin rather than restarting the same picture on every card. The left navigation likewise shows successive slices of one image across all nine buttons, including KASPERSKY.

Panels enter smoothly when the section opens. Only image layers receive the 2px blur; text and switches remain sharp. Geometry is expressed in scalable units, with intentionally fixed pixel borders/blur. Hidden scrollbars do not remove scrolling: wheel, touchpad and supported keyboard focus navigation remain usable. The menu and content can scroll independently. Native settings content retains its own implementation; the extension styles the left navigation and its own tab.

The Information panel links to the Chrome Web Store, extension source, companion-client source, License and Terms of Use, and FAQ. Opening one follows an external link; it does not submit diagnostics or modify an account.

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

Enable **Overdrive box timer** in the KASPERSKY settings tab. The timer appears near the top of the battle screen only after the first observed overdrive pickup, then counts down from `1:25`. Each subsequent pickup restarts the full 85-second countdown. The background transitions over 0.2 seconds, turns reddish during the final ten seconds and green at zero, while the indicator stays at `0:00`.

The indicator tracks overdrive model `1647333199409`. Model `1647333199408` is a speed boost and is ignored by this timer. The first observed pickup position is assigned to the right timer. A pickup at a distinct position reveals the left timer with its own 85-second countdown. Both sit in a centered wrapper with a fixed gap and `z-index: 1`. Picking up a box near either learned position restarts only that position's timer. Both reset on battle changes. Opening an in-battle section, a visible native tank preview (`TankPreviewComponentStyle-visible`), or a visible `.-container` hides both indicators while their countdowns continue.

A black segment moves around each timer's edge to point toward its learned overdrive location relative to the camera: top means ahead, right means right, and bottom means behind. The independent direction hook samples local tank position and actual camera rotation at most once every 80 ms; it does not require the critical-shot indicator. Missing or stale telemetry hides only the segment, as does being within 100 horizontal world units of the point. This is a bearing to the point, not route guidance around obstacles. Inspect recognition with `window.__kaspOverdriveDirectionDebug.status()`.

Positions are learned afresh in each battle, so there is no table of map-specific coordinates. The native bonus instance supplies a detached registered spawn origin; if unavailable, the pickup vector is used. Positions within 1,000 horizontal game-world units of a learned position are grouped together to accommodate small shifts, ignoring height differences. This is a proximity heuristic; points closer than that tolerance or unusually large position changes may be grouped incorrectly. At most two positions are tracked. Once both positions are known, a pickup without valid coordinates or at a third distant position leaves both deadlines unchanged. Debugging can help adjust the tolerance if a map's behavior differs.

To collect diagnostics with a build containing the current injector, open the game page console, run `window.__kaspBonusDebug.enable()`, and reload the page before entering the battle. After observing box appearances and pickups at both locations, run `copy(window.__kaspBonusDebug.export())` to copy the journal. Disable collection with `window.__kaspBonusDebug.enable(false)`. Debug mode persists across reloads until disabled; up to 200 records are retained in memory per page. This journal observes the client; it does not establish a server respawn deadline.

Offline AST tools identify the pickup path, pooled bonus registration, and coordinate/resource fields using semantic strings and native structure. The extension receives prepared plans and compatibility templates; it does not parse the whole bundle into an AST at runtime. Run `window.__kaspBonusDebug.status()` to inspect recognition without enabling logging. Compatible renamed code can use the templates; unsupported structures require new mappings. The countdown does not depend on which player picked up the box; any matching pickup reported by the client restarts it. Other bonus types do not affect it.

The timer estimates the next appearance from the configured game interval. It does not receive a server respawn deadline or establish whether an uncollected box is currently present. Entering a battle alone does not start a countdown. Leaving the battle or replacing its canvas outside an in-battle section clears both countdowns and learned positions; deadlines are not saved across page reloads. The second indicator appears only after a pickup at its position has been observed.

Game updates may change the internal pickup code or bonus model identifier. If the hook cannot recognize a pickup, the timer stays hidden; it does not invent a deadline. Unsupported direction mappings leave the countdown operational without the black segment. The overlay does not capture mouse input or add a gameplay hotkey.

### Lobby Pass Cards

Challenges and the Elite Pass use white cards with black text, matching the extension's lobby buttons. The Elite Pass sits directly below Challenges at the same width, with a straight progress line. Reward artwork and repeated captions are hidden; native labels, timers, purchase/lock state, and click handlers remain in place. Favorite trophies follow below the cards.

The pass and favorite-trophy cards share a continuous `assets/art1.png` background with a light overlay and 2px image blur. Only the backdrop is blurred; card content and dimensions stay unchanged.

The redesign is CSS over the existing game elements. A small DOM adapter supplies progress percentages, alignment coordinates, and RU/EN pseudo-labels. It reads stars from the native counter and Elite Pass progress from the native circle's two rendered half-ring angles. It never infers progress from the level number; unsupported ring layouts hide the line. No game bundle hook or additional server request is used.

### Lobby Navigation Tiles

The main menu uses the game's existing entries and icons in a two-column tile layout. Containers, Missions, Garage and Shop retain native navigation. Settings spans the last row, uses an uppercase localized caption and a slightly enlarged native icon. Section icons use 2.3em boxes; the Settings icon uses 1.85em. Sizes scale with the game's interface font.

Quick Battle remains centered in the main tile. The main button and mode buttons use the shared metal-shine hover effect. During matchmaking the main image darkens and mode controls dim; the game's search lock remains authoritative. The five footer controls stay near the bottom of the lobby. Native notification badges on styled sections are presented as small monochrome dots.

One continuous art3 image is sliced across the lobby controls. Only this image is blurred by 2px. Decorative layers do not capture clicks. The adapter does not replace the game's event handlers or manufacture mode selection events of its own.

### Account ID Discovery and Lobby Status

Verified ownership comes from the native game account ID, not a nickname or the visible UID label. Store capture starts during game initialization. A fast path checks the store's local state, then cooperative bounded discovery handles other supported layouts. Work is divided into small tasks; finding the local account takes priority over collecting remote players.

The current page caches the resolved path, schema and verified account. Once the native User is loaded, repeated reads follow that path instead of searching the whole object graph again. Login without a full reload is handled; a new page after logout must verify ownership again. The extension does not persist an old ID as proof of a new login.

If no ID is available after a 600ms lobby delay, a bottom-center art-backed notice says **Searching for account ID** / **Поиск ID аккаунта**. It appears only while a real lobby menu is present. Finding the ID or leaving the lobby fades the notice out. A slow computer or changed native layout can still delay discovery; the notice is a status display, not another search process.

Favorites and the custom Tankoin counter wait for verified ownership in the lobby. Their first appearance for an owner can fade in over 250ms; opening and closing sections does not replay that entrance for the same owner during the page session. Reduced-motion settings suppress the animation. Existing saved records remain untouched if ownership is unavailable.

### Tankoin Balance

The automatic counter complements headers that lack a native Tankoin display. Native shop/exchange values are observed, and validated numeric text is cached under the verified account ID. A native counter takes precedence. Without a live observation or a saved balance, the display can show a dash rather than inventing a zero.

Returning to a known account restores that account's last observed balance. Renaming the same ID does not create a different owner; another ID with the same nickname does. This counter does not query a separate balance endpoint, initiate an exchange or buy currency. Hide currency also masks this counter.

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

### Cybersport Format Prototype

**Purpose:** Adds an automatic **Esports / Киберспорт** entry between Sport and Parkour on the PRO battle creation Format page.

The card clones the native Sport card, uses `assets/cybersport.png`, and retains native card layout with scoped gradients/hover styling. Clicking it or pressing Enter while focused selects the original Sport format and then automatically clicks the native CTF mode card when it appears. This applies only to Esports. Native battle settings and creation remain owned by the game. The Sport description and live battle count are mirrored. Selecting a native format clears the custom selection, and reopening the section does not accumulate clones.

While Esports is active, the Map page shows only the seven configured map artwork resource paths. Red Alert MM shares artwork with Red Alert MM Esports; an additional exact RU/EN name check retains only ordinary Red Alert MM. Native cards are retained and visually packed into columns of three. If the game's selected map is excluded, the first available allowed card is selected through its native click handler. Search/theme changes still belong to the game; only allowed variants present in that result are shown. Choosing a native format or leaving battle creation clears the filter. This uses the server's Sport format with CTF. There is no individual settings switch. Native Q/E/gamepad navigation is not extended to include the custom format entry.

The native creation settings are kept at **12 minutes**, **6 players per team (6 vs 6 in CTF)**, **Private battle**, and the **first available minimum rank (First Sergeant in the supplied game configuration)**. Changes made by the game after selecting another map are corrected. The two numeric fields and the private checkbox are locked while Esports is active; minimum-rank changes are prevented once the desired rank is selected. If additional settings expand, the native Close action restores the compact panel and preview. Choosing another format or leaving creation releases these controls. Maximum rank and other settings remain native. These actions update the game's form state for its normal server submission; battle creation still requires pressing Start.

A small MAIN-world bridge also calls native form callbacks using numeric values and verifies the real creation state. Before submission, the original creation callback receives 6 players per team, 12 minutes, the verified minimum-rank number, and current native options. A missing rank or unconfirmed Private option postpones Start rather than submitting defaults; after the form is ready, press Start again. Ordinary formats use their original callback. `window.__kaspCybersportDebug.status()` reports native readiness and the numeric arguments passed in the last guarded creation call; this is not a server acknowledgement.

### Augment Specifications Module

**Purpose:** Displays augment properties received by the game and recalculates supported visible equipment statistics.

The injector observes decoded device model data as the game stores it during the current page session. Properties, names, and descriptions are joined by the exact game object ID. This feature no longer loads `database/augments.json` and does not issue additional requests for device data.

Recognized device cards receive a specifications control. Hovering displays the first paragraph of the device description above two columns: advantages and disadvantages. “Other parameters” appears below them only when at least one property cannot be classified. Its click is prevented from selecting the underlying card. The parameter dictionary covers all 227 protocol properties in the inspected game bundle, including weapon-specific mechanics, hulls, resistances, drones, and overdrives; RU/EN labels switch locally. Server descriptions retain their captured language; a locale mismatch displays a localized reload instruction.

Card matching uses IDs read from the native React properties. Artwork is used as a fallback only when all matching entries have identical properties, metadata, and equipment baselines. Shared names and ambiguous artwork are not treated as reliable device identifiers.

Supported numerical adjustments include damage, DPS, charge/reload values, turning speed, range, critical damage, healing, impact force, aimed and normal-shot damage, armor, mass, and maximum speed. Only unambiguous `DELTA_PERCENT` values are converted into live multipliers. Parameter-specific rules distinguish beneficial changes from drawbacks: increasing critical chance is beneficial, while increasing time between salvo shots is a drawback.

The collector also observes `UpgradeParamsCC` and derives raw equipment values at the current upgrade level using the game's linear property calculation. An absolute `OVERRIDE_VALUE` is compared with the matching property of the exact base equipment ID and displayed as `base → replacement`. Critical probabilities use percentage notation. These replacements are not converted into guessed live multipliers.

Live statistics retain the game's original value node and render a separate adjusted value. Calculations use original text rather than repeatedly multiplying adjusted output. Replacement nodes are reused when values are unchanged, and original display state is restored when a modifier no longer applies.

An empty numeric property list does not mean that a device has no effect; its description remains visible. Unknown effect direction, missing equipment baselines, and special negative probability sentinels are displayed under “Other parameters” rather than assigned an invented advantage or drawback. Zero deltas and confirmed unchanged replacements are omitted from automatic presentation and do not create that section. All raw properties remain in the JSON. Empty comparison columns say “No confirmed changes”; the extension does not claim that unavailable data proves the absence of an effect.

#### Manual Parameter Classification

Unavailable device cards can display a grayscale preview and name when their exact device ID and a native icon resource are available. Eligible unavailable skins and shot effects also receive previews. Purchased cards and standard settings keep their normal artwork. Placeholders remain visible until replacement data is available; late data and native image/class resets refresh the open cards without requiring another visit. Failed image loads restore the native placeholder and suppress repeated retries of that URL for the current module lifetime. Disabling Augment Specifications restores its replacements. Possible Rewards is excluded.

The associated garage hooks allow supported unavailable cards to invoke the game's native description panel. They do not create ownership or permit equipping unowned items. Device specification tooltips are mouse-hover controls; they do not provide equivalent keyboard, gamepad, or touch interaction.

[database/augment-rules.json](database/augment-rules.json) provides an editable `rules` array. Each entry applies to one device and one protocol property:

```json
{
  "rules": [
    { "objectId": "123", "property": "HULL_MASS", "status": "better" },
    { "objectId": "123", "property": "SHOT_RANGE", "status": "lower" }
  ]
}
```

`better` assigns the parameter directly to Advantages; `lower` assigns it directly to Disadvantages. These statuses do not specify a comparison direction. A manual entry takes priority over automatic classification, including missing baselines, special values, and unchanged values. It changes presentation only; raw observations and numerical equipment calculations remain intact. An empty array retains automatic classification. The packaged `example` entry is informational and is not applied.

Keep `objectId` as a string and use the device's ID, not its equipment `baseItemId`. Prefer the exact protocol identifier in `property`. An unambiguous Russian or English parameter name is also accepted; the spelling `properity` is supported as an alias. Invalid entries are skipped with a console warning; the last duplicate device/property entry wins. The file loads once per page. After editing the JSON in the installed extension directory, reload the extension and game; rebuilding JavaScript is unnecessary for subsequent JSON-only edits.

Open the required weapon's Augments page and run this in the game page's DevTools Console:

```js
copy(window.__kaspAugmentsDebug.exportPage())
```

The clipboard JSON contains device IDs, equipment associations, names, descriptions, protocol property identifiers, RU/EN labels, operations, raw values, and available equipment baselines. To inspect the same data without copying, use `window.__kaspAugmentsDebug.page()`. Only rendered cards with layout on the current page are included; scroll virtualized lists and export again for additional cards. Cards without a confirmed identity or captured properties are reported under `unmatchedCards`. The existing `export()` method still exports the entire captured session.

The current snapshot is saved as `kasp-augments.json` in the game's browser-local private file storage (OPFS), with `kasp_augments_session_json` in `sessionStorage` as a fallback. Reload replaces the snapshot; the extension never restores device properties from the preceding page session. This is not a file in the extension directory or an automatic download. See [Session data](#session-data) for inspection commands and storage behavior.

### Smart Paint Search Module

**Purpose:** Filters the paint collection using bundled Russian and English names.

The query is split into words after case normalization; Russian `ё` is normalized to `е`. Every word must appear somewhere in the combined Russian/English name. Partial names and multiple words can therefore match without a specific word order.

An empty query restores items. Nonmatching items and columns with no visible items are hidden. Matching depends on the image URL being present in `database/paints.json`; an unlisted paint is not guaranteed to appear for a nonempty query.

The module filters the collection already available in the client. It does not request additional items or modify paint ownership.

### Friend Tags & Categories Module

**Purpose:** Adds local friend classification and filters.

Available filters are All, Online, Offline, Clan, Purple, Yellow, and Red. Clan detection uses the current account's identifiable clan tag. Color assignments are managed through the supported player context menu; assigning the same category again removes that assignment.

Categories are stored under `tankiCustomCategories_uid_<userId>`, with friend user IDs as keys. Renaming either account preserves assignments. Labels remain local and are not synchronized with the native friend service. Legacy nickname-based keys remain untouched and are not imported automatically.

The module reads real identity through the shared helper. Nickname masking therefore does not intentionally change the account key to `Hidden` or `Скрыто`.

### Trophy Favorites Module

**Purpose:** Shows locally selected equipment trophy progress in the lobby.

Favorite-star controls are added to supported trophy/quest cards. Up to two turret trophies and two hull trophies may be selected. Progress is refreshed from recognized garage cards and result-screen quest progress. The lobby panel uses a two-column grid of white tiles below the passes, with equipment names, percentages, black progress bars, and exact current/target points. Reward icons are omitted.

Recognition uses `database/trophies.json`. Displayed progress is the latest observed interface value, not a separate live server query. Previously stored progress may remain visible until the relevant card is observed again.

The panel waits for the trophy dictionary before its first render and refreshes when language, favorites, or observed progress change. This prevents an initial panel with untranslated equipment IDs while the dictionary is still loading.

Favorites are saved per account under `kasp_trophies_favorites_uid_<userId>`. The panel and in-memory cache reset on account changes. The legacy shared list remains untouched and is not imported automatically. There is no dedicated settings switch.

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
- The current-player name in Battle History details.
- The client information parameter `UID: <nickname>` is hidden entirely along with its following separator; TYPE, VER, UPD and SRV remain visible.

The local player's WebGL kill-feed name is also masked in kills, deaths, self-destruction, equipment changes and join/leave entries. Its bitmap font must support every replacement character: the label uses `Скрыто` or `Hidden` when available, falls back to `Hidden`, and becomes empty if neither label is supported. Native identity data, other players, ranks and event icons are preserved.

TYPE, VER, UPD, and SRV are not intentionally masked. Other players' names are not generally hidden.

Original text and child nodes are retained. Account-aware modules use `accountIdentity.ts`, preserving history ownership and friend-category identification.

Hover tooltips intentionally reveal original values on elements with tooltip metadata. This is visual privacy, not anonymization of the DOM, stored data, or exports.

### Hide Currency Module

**Purpose:** Masks recognized currency amounts outside battle.

Supported currency/header spans have their original numeric text saved in metadata and their displayed amount replaced with `Hidden` or `Скрыто`. Hover tooltips expose the saved value.

Unlike nickname privacy, this module replaces selected span text. It uses the normal update cycle and a 500 ms interval after initialization. Battle-screen processing is skipped; immediate masking of every price or numeric field is not guaranteed.

Coverage follows supported selectors, including displays used for rubies, crystals, and tankoins. Reload after changing this setting to reset the module and timer state consistently.

Tankoins also have an automatic persistent header counter outside the shop. It refreshes from the native shop balance or the Ruby exchange balance, respects currency privacy, and shows `—` until the first balance is observed. The last known amount is stored locally under `kasp_tankoin_balance_uid_<userId>` and restored after reload once the current account ID is verified. Different accounts have separate balances, and a rename keeps the same saved value. Until an ID is verified, live shop/exchange observations still work without reading or writing a persistent cache. The native shop counter is never duplicated.

### Hide Supplies Module

The **Hide supplies** switch (`k_hideSupplies`, disabled by default) omits supply item quantities on garage cards and displays `0` for the supply strip and native supply count labels in the WebGL battle HUD. RU/EN settings labels are available. Switching it off restores the latest native display, including changes received while hidden. Prices, cooldowns, availability and actual stock are unchanged.

Garage values remain in the DOM and are masked with CSS. Battle privacy intercepts only the formatted text sent to the four recognized native count label renderers. An offline AST plan and rename-compatible templates identify these methods; unsupported client structures are left unchanged. Prepare an updated mapping with `npm run prepare:supply-privacy -- ./main.js`. The page-side switch also polls the saved setting every 250 ms for cross-world changes. Label references are weak and diagnostic cleanup restores their last native text.

### Box Pickup Visuals

**Setting:** `k_box_pickup`, disabled by default; **Visual changes** category.

Recognized pickups use a short flash and scattering fragments. The native pickup/reward logic remains in place, and pickups observed for other players can also produce the visual. This feature changes the pickup animation; it does not change box spawn locations, delivery timing, collected stock or server rewards.

Each pickup emits up to 14 pieces. A scene-wide cap of 140 pieces bounds the effect. The flash lasts 0.22 seconds; fragments begin fading after 2.2 seconds and finish over another 0.8 seconds. Terrain probes are limited to six per frame. The animation schedules frames only while pieces exist and clears owned resources on disable, battle/world replacement and page exit. Limits reduce cost but do not promise identical FPS on every GPU.

The switch applies live. If its native contract is unavailable or conflicts with another plan, normal pickup presentation remains. This feature is independent of the overdrive countdown: one is visual, the other observes the overdrive pickup to maintain a local timer.

### Custom Garage Skins Module

**Purpose:** Keeps recognized garage thumbnails and mounted previews consistent with captured equipped-skin artwork.

The current implementation learns from the native skins interface. It does not provide a separate arbitrary skin-picker or unlock unowned skins. Equipment names and known stock images come from `database/skins.json`.

Learning reads the committed native React card state. The selected card must have the exact equipped skin ID, be owned, and not be unknown; matching names alone are insufficient, including when XT HD and XT Classic share a title. Artwork from another selected preview is not treated as the equipped skin. A candidate must remain consistent across at least two observations before being written. Missing or ambiguous native card data leaves the saved artwork unchanged.

The page-world injector reads the native card state and passes only card metadata through DOM attributes to the content script. This bridge is automatic and does not require enabling Augment specifications or loading its catalog.

Recognized HTTPS game `.webp` artwork is stored when readable. Otherwise, a known stock image can be saved as a fallback and marked `unknown skin`. Equipping the standard skin clears the corresponding override after stabilization.

The module records recognized original image URLs and generates CSS replacements for supported thumbnails and mounted previews. It does not change the battle-rendered tank model or account ownership.

Equipped artwork is stored under `kasp_equipped_skins_uid_<userId>` using the verified native account ID. Account changes and unavailable identity clear active replacements, unknown-skin labels, and pending learning; renaming the same account retains its selections. The old shared `kasp_equipped_skins` data remains separate and is not migrated automatically. Open the equipped skin in the native skins interface to learn it for the current account. The base-image cache remains shared because it stores original equipment artwork rather than account selections. Coverage depends on database entries and readable cards, rather than guaranteed support for every skin series. Garage checks include a 250 ms periodic pass alongside ordinary updates.

### Weapon Augment Tracker Module

**Purpose:** Adds a third native local-HUD bar for the player's Shaft or Scorpion arcade-shot reload.

Prepared AST plans identify the native local HUD factory and layout through semantic game markers. The injector creates one additional native bar with the original dimensions and scene layer, plus its own material whose current foreground is yellow-orange (`#FFBB1C`). The original background and border style are preserved. Its draw callback reuses the original bar's final screen rectangle to align the extra row in centered and tank-following HUD layouts and at different UI scales. Native resize, visibility and removal govern its lifecycle. Other weapons and remote tanks do not receive the extra row; remote nickname/health rendering is not patched by this feature.

The extra row has a fixed zero gap. In the centered HUD, the lower native active-effect/supply row moves down by the added bar's height only while the local Shaft or Scorpion arcade bar is visible. The upper status row and other weapons keep their native positions; offsets are recalculated each layout pass.

Scorpion progress comes from its primary-shot recharge state, independently of its secondary missile indicator. Shaft progress comes from its current native cooldown-state instance, deadline and duration (the registered state ID is not a timer object); observed progress is retained while its native stun/pause flags are active. The module uses game data without garage visits, MK tables, device image URLs, input listeners, or a separate animation loop. It does not use the old saved reload configuration. The Arcade reload indicator setting applies immediately.

Run `window.__kaspArcadeReloadDebug.status()` in the game console to inspect the mapping strategy, observed weapon/progress, mesh creation/visibility and latest runtime error. For diagnosis, `window.__kaspArcadeReloadDebug.setEnabled(false)` persists a separate disable flag; reload the game to apply it. Restore with `setEnabled(true)` and another reload. Use the settings switch for live display changes; no gap-adjustment command is provided.

### Critical Shot Indicator

**Purpose:** Colors the native local reload bar red when a critical shot is expected. This is automatic and does not add another HUD row.

| Weapon | Required augment | Ordinary cycle | First shot after a detected respawn | Expected first critical after Supercharge |
| --- | --- | --- | --- | --- |
| Thunder | Strict Ammunition Load | Every third shot | Critical | Fourth shot |
| Smoky | Sorted Ammunition | Every fourth shot | Critical | Fifth shot |
| Hammer | Revolver | Every third shot | Third shot is critical | Fourth shot |

These cycles are derived from the inspected augment properties. The indicator observes native shots, including misses, tank lifecycle, equipment identity, critical-readiness messages, and shooter damage acknowledgements. Live augment metadata takes priority; snapshots of the three known augment IDs allow recognition before opening the garage. An unrelated augment with a similar name is not automatically a supported combination: the equipment association and usable critical properties must also match.

Transparent spawn, death, and other inactive tank states suppress the indicator. A detected respawn resets the phase. Joining an already active tank without a known phase waits for native readiness or a confirmed critical hit instead of inventing a shot count. The feature observes tank state; it does not request spawns or change tank visibility.

Hornet/Dictator Supercharge forces critical readiness, including when the ordinary device cycle is unsupported or unknown. After it ends, supported device cycles use the recovery offsets above and can synchronize from the first accepted critical damage acknowledgement. Delayed forced hits are filtered, and shots fired while an acknowledgement is in flight are preserved. The post-effect offsets reflect observed behavior, not a server-side calculation exposed by the game; upstream mechanic changes can require adjustment.

The local tank is checked for the native Terminator weapon component on each HUD update. During a Juggernaut transformation, the ordinary equipped augment cycle is disabled and its stale readiness/recovery state is discarded. Supercharge still takes priority; after it ends, Terminator retains normal reload color. Returning to the ordinary tank resumes from its own lifecycle or confirmed critical state.

Inspect `window.__kaspCriticalDebug.status()` for the `juggernaut` flag, equipment IDs, recognized weapon/device, readiness source, shot/lifecycle counters, Supercharge recovery, HUD attachment, mapping status, and errors. Outside forced Supercharge, missing metadata or unsupported devices leave normal reload color in use; incomplete mappings skip this interception. The Critical shot indicator setting applies immediately.

### Discord Rich Presence

**Activation:** A compatible Electron client, the KI preload/main-process bridge, and the Discord desktop application. Browser sessions remain inactive.

The extension sends English activity labels every three seconds. During a recognized battle, `details` contains the English map and available mode; `state` contains the current nickname, or `Hidden` when `k_hideNicknameXP` is enabled. Missing account identity uses `Signing in`. Untranslated Cyrillic map names fall back to an English screen label.

`timestamps.end` provides the remaining battle countdown. `party.size` provides `[currentPlayers, maximumPlayers]` when both values are valid; spectators are excluded. Outside battle or when the snapshot is more than five seconds old, those battle-specific fields are omitted. The client supplies a fixed session start time for activities without a battle deadline, so returning to the lobby does not start a new session timer.

The MAIN-world reader captures the native dependency-injection store through a prepared hook and polls it once per second. It still recognizes model fields through semantic diagnostic methods and some native collection interfaces; AST migration does not make that reader independent of all game changes.

The companion client validates messages, uses Discord IPC, coalesces changed activities over up to fifteen seconds, and reconnects automatically. Its supplied main-process integration retains the last activity while minimized/hidden and grants a new heartbeat grace period on restore. See [client integration and verification](tools/electron-discord/README.md). Inspect `window.__kaspPresenceStoreDebug()` and `window.__kaspPresenceBattleDebug()` in an Electron game page when battle data is missing.


### Change Counter Module

**Purpose:** Records observed equipment-change actions and adds a battle-statistics indicator.

The injector attempts to attach a hook to recognizable `TankUserActionLog` code. The module processes `CHANGE_EQUIPMENT` messages, stores per-player counts in `sessionStorage`, and marks players with nonzero observed counts.

The current interface adds an indicator column. It does not guarantee entire rows are highlighted yellow or numerical counts are displayed in every view.

The cache is cleared on detected departure from a battle canvas or a battle-ID reset event. Earlier unobserved actions cannot be reconstructed. Page messages are client-side signals, not an authenticated server audit trail.

### Zero Resists Module

**Purpose:** Extends native battle-statistics resistance presentation.

The module adds a shield heading, compact equipment/resistance cells, and zero-count summary entries for configured types absent from the native summary. These entries do not independently measure every player's resistance percentage.

A shield toggle switches between compact presentation and always showing all modules. State is saved under `kasp_tab_expanded`. Zero entries are removed when the corresponding resistance appears in the native summary. There is no separate settings switch.

The adjacent turret button opens an **Enemy weapons** popup directly above its button on hover (or keyboard focus). It counts the opposite team's current weapon icons, using the same icons as the resistance summary and sorting by count. DM counts everyone except the local player. Counts refresh while the popup is open; leaving the button or closing TAB hides it. An unidentified local team produces an explicit message, and unreadable weapons are grouped as unknown. The feature reads the displayed TAB only and adds no native hooks or game requests.

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
- Ownership comes from the loaded native `User.id`, preserved as an exact decimal string. Nicknames are display metadata. Missing or stale identity postpones storage operations; there is no nickname fallback.
- Missing required result data delays capture until it becomes available. A failed database write allows another attempt.
- A processed-result guard prevents repeated capture during the same observed result-screen lifecycle. It is not a persistent duplicate detector across reloads.
- Mode, matchmaking/PRO kind, team membership, and victory status depend on recognizable native UI or available injector information. Missing information may use implementation defaults.
- Equipment and statistics reflect observed data. The extension does not independently reconcile them with a server ledger.

#### List and detailed view

The list shows records for the current account user ID, newest first, with 15 records per page. Cards include the result, map, mode, date, and key statistics. Map names and artwork use the bundled map database when a match is available.

The detailed view provides captured player statistics, team grouping where applicable, and the current player's equipment icons. Missing optional data uses placeholders. Dates follow the browser's locale and time zone.

Deathmatch (DM) results show all players in one centered table: opponents use red row backgrounds and the current player is highlighted in blue. Saved player order is preserved. Team modes retain separate team tables.

The **All battles** button returns from details to the list. Back navigation also supports Escape, Z, and the mouse back button. These controls apply to the history view; an active confirmation dialog handles its own interaction.

History integrates with the native settings window when the expected structure is available and can provide its own header otherwise. Its observer releases the view when the native window closes or navigation moves elsewhere. Async rendering checks the active account and current view before displaying results, preventing a completed older request from replacing a newer view.

#### Record management

| Action | Behavior |
| --- | --- |
| Export | Writes the current account ID's records to a JSON file. An empty history produces no export. |
| Import | Validates a non-empty JSON array and stores all accepted records in one transaction. Every record must carry the current account user ID; foreign-account and legacy files without IDs are rejected. |
| Clear | Requires confirmation and deletes records belonging to the current user ID. Other accounts and legacy records remain stored. |

Changing a nickname keeps the same history because ownership uses the immutable account ID. Linking histories by nickname has been removed. Old records without an ID remain stored separately and are not assigned automatically.

Imports add only missing battle record IDs for the current user ID. Duplicate IDs within a file are also skipped, and existing records are never overwritten. New captures receive a portable UUID `battleId`; older exports use their numeric `id` as a stable legacy identity. This is a local history record ID, not a server battle ID. Historical nicknames within the same account ID remain visible; they do not establish ownership.

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
| Native arcade/critical indicators | No additional key binding | Follow game telemetry; pointer lock and simulated firing input are not their timing source. |

Enhanced Play ignores editable controls, repeated key events, Ctrl/Alt/Meta combinations, recognized dialogs, and active searching/queue states. History blocks play shortcuts while its own view is open. A key's behavior therefore depends on the active screen and dialog.

Closing the Auto Upgrade setup dialog prevents a sequence from starting. During a running sequence, any keyboard key, new gamepad button press, or mouse press/click cancels the remaining upgrades. Programmatic Enter and confirmation clicks from the module do not cancel it.

## Data Storage and Account Scope

The extension uses the game's origin-scoped `localStorage`, `sessionStorage`, IndexedDB, and private file storage (OPFS). It does not use `chrome.storage` for these records.

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
| `k_hideSupplies` | Hide supply counts | Shared across accounts |
| `k_box_pickup` | Modified box pickup presentation | Shared across accounts |
| `k_history` | Battle History setting | Shared across accounts |
| `k_overdrive_timer` | Overdrive box timer setting | Shared across accounts |
| `k_arcade_reload` | Live arcade indicator switch; defaults to enabled | Shared across accounts |
| `k_critical_indicator` | Live critical indicator switch; defaults to enabled | Shared across accounts |
| `kasp_arcade_reload_enabled` | Diagnostic arcade hook override; absent means enabled | Shared across accounts; requires a page reload |
| `kasp_bonus_debug` | Opt-in bonus diagnostic collection | Shared across accounts; journal itself is page-local |
| `kasp_last_nickname` | Legacy history nickname cache, no longer read or written | Retained separately |
| `tankiCustomCategories_uid_<userId>` | Friend user ID to category assignments | Per account user ID |
| `kasp_trophies_favorites_uid_<userId>` | Trophy favorite selections and cached presentation data | Per account user ID |
| `kasp_equipped_skins_uid_<userId>` | Observed equipped-skin artwork | Per account user ID |
| `kasp_tankoin_balance_uid_<userId>` | Last observed Tankoin balance | Per verified account user ID |
| `kasp_equipped_skins` | Legacy shared skin selections, no longer read or written | Retained separately |
| `kasp_base_images` | Base artwork used for skin replacement | Shared across accounts |
| `kasp_weapon_augment_tracker` | Legacy reload configuration; no longer read or written | Shared across accounts |
| `kasp_my_equipment` | Latest observed self-equipment icons | Shared across accounts |
| `kasp_tab_expanded` | Resistance presentation preference | Shared across accounts |
| `kasp_last_version` | Acknowledged welcome-window version | Shared across accounts |

The game's `language_store_key` can influence language selection but is not an extension feature setting. Extension settings also participate in storage-event cache invalidation for recognized keys; this is not a guarantee that every cache or open view synchronizes immediately across tabs.

### Session data

`kasp_player_changes_cache` is stored in `sessionStorage` for observed equipment changes. Its lifetime follows the browsing session, and the module also resets it when leaving battle or receiving a battle-ID change event.

The augment catalog starts empty on each page load and replaces `kasp-augments.json` and the `kasp_augments_session_json` fallback with the new session's observations. Writes are ordered and coalesced as descriptions, properties, equipment associations, and artwork become available. File-storage failure does not prevent in-memory lookups or session-storage writes. Multiple tabs have separate in-memory catalogs; the origin-wide file reflects whichever tab wrote it last.

After rebuilding and reloading the game, inspect the collector from the page's DevTools console:

```js
window.__kaspAugmentsDebug.status();
copy(window.__kaspAugmentsDebug.export());
```

`hooked: true` reports that the expected model-cache pattern was instrumented. `devices` counts captured numeric property lists, including empty lists; `equipment` counts captured equipment baselines. These checks do not guarantee that every visible card has been matched. If `hooked` is false, the current game bundle was not recognized; previous-session data is not substituted.

Unassigned complete results can be retained separately in `sessionStorage.kasp_history_unassigned_v1` while history recording is enabled and a verified owner is unavailable. This buffer is limited to 20 records, 2,000,000 serialized characters and a 24-hour read-time age filter. It is not a history backup and is never automatically assigned to a later account by nickname. See the maintenance guide before attempting recovery.

### Battle database

| Property | Value |
| --- | --- |
| Database | `TankiBattlesDB` |
| Schema version | `5` |
| Object store | `battles` |
| Primary key | Auto-generated `id` |
| Non-unique indexes | `date`, `map`, `mode`, `top`, `userId` |

History records are partitioned by their `userId` field in a shared database. The obsolete nickname index is removed; legacy records without IDs are preserved separately and are not shown in the new history. Schema upgrades preserve existing records rather than deliberately recreating an empty database. Read/write helpers close their connections and handle version changes; write operations report completion after the transaction commits.

### Persistence and backups

Reloading the page normally preserves persistent settings and battle records. Clearing site data, resetting a browser profile, or using a different origin can remove or separate them. Uninstalling and reinstalling the extension is not a substitute for a data backup.

Battle History export covers battle records for the current user ID. It does not export all settings, friend categories, or every account in the shared database. Export each relevant account before changing profiles or clearing site data.

## Battle History Import and Export Format

Exports are UTF-8 JSON arrays with readable indentation. The filename follows `Tanki_BattleHistory_<userId>_<YYYY-MM-DD>.json`; the filename date uses UTC, while the history UI formats dates in the browser's local time zone.

The following example illustrates the accepted structure:

```json
[
  {
    "battleId": "a8a3b866-4b34-4e83-a651-4d29cb04e33d",
    "userId": "3074457415316504379",
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
| `battleId` | Portable record ID; older files may supply a positive safe-integer `id` instead |
| `userId` | Exact decimal ID string matching the current account |
| `nickname`, `status`, `map`, `mode`, `top` | Strings; nickname is historical display text |
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

Account ID ownership is enforced. Records for another user ID and legacy records without an ID are rejected before any write. There is no ownership reassignment action.

Text from imported or existing records is escaped for HTML rendering. Player names and other stored text cannot become executable markup through the history templates.

Image URLs are restricted to HTTPS URLs on `tankionline.com` or its subdomains, without embedded credentials or a non-default port, and with a supported image extension: SVG, WebP, PNG, JPEG, GIF, AVIF, or ICO. Unsafe URLs become empty values and render through the missing-image fallback. Sanitizing an optional image does not by itself reject an otherwise valid record.

## Privacy and Data Handling

Feature settings and history data are stored locally in the game origin. The implementation does not provide cloud synchronization, a remote backup service, or an extension-owned analytics backend.

The Firefox manifest declares `data_collection_permissions.required: ["none"]`. This is the extension's collection declaration; local history and favorites still exist, and ordinary game traffic and optional Electron-to-Discord presence are described here separately.

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
| `cybersport.css` | Scoped Esports card and native Sport selection presentation during the prototype |
| `header.css` | Header presentation |
| `lobbyPasses.css` | Native challenge/Elite Pass cards, monochrome presentation and linear progress |
| `battleStats.css` | Battle statistics and equipment presentation |
| `killBoard.css` | Kill-board presentation |
| `overdriveTimer.css` | Independent overdrive countdown panels and visibility |
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
│   ├── generated/            Offline-prepared AST plans and compatibility templates
│   └── modules/
│       ├── battleHistory.ts  Battle History integration facade
│       ├── battleHistory/    History implementation
│       └── ...               Other feature modules
├── dist/                     Generated JavaScript loaded by the browser
├── styles/                   Manifest-injected stylesheets
├── templates/                Bundled HTML templates
├── database/                 Bundled reference data
├── assets/                   Images and other presentation resources
├── _locales/                 Extension locale messages
├── tools/                    Offline AST preparation, release packaging, and regression checks
├── main.js                   Optional local game-bundle input; not a runtime dependency
├── archived/                 Optional backups; not loaded or packaged
└── release/                  Generated release folders and archives
```

### Runtime entry points

`dist/kasp_injector.js` runs at document start in the page's MAIN world. It observes the game script, fetches its bundle, and applies supported instrumentation before inserting the transformed script.

`dist/kasp_main.js` runs as the main content script. Its entry point guards against frame execution, initializes shared helpers and startup presentation, and schedules feature updates according to the observed game screen.

The extension manifest targets Tanki Online pages. It does not declare a background service worker or an additional `permissions` array. Bundled assets, templates, and databases are exposed through the manifest's web-accessible resource configuration.

### Update scheduling

A shared DOM observer schedules work through animation frames. Heavy module updates are throttled to approximately 150 ms, with screen changes able to trigger immediate updates. Garage and battle-statistics changes also have targeted processing paths.

Some modules maintain their own observation or timing loops, including skin observation, currency presentation, and a one-second augment card identity scan. These are local UI updates rather than recurring requests for authoritative game state. Avoid adding repeated writes to already-correct DOM nodes: mutations produced by a module can otherwise trigger its own observer again.

### Injector failure handling

The injector checks `res.ok` before reading a fetched game bundle and catches errors in the fetch/transformation/insertion chain. On failure, it logs the error and attempts to restore loading through a native script element carrying the original script attributes. That recovery is attempted once; an additional load failure is logged.

Recovery can allow the game to load without the instrumentation. Features relying on intercepted game actions or battle identifiers can consequently have incomplete information. A successful HTTP response also does not guarantee that instrumentation patterns still match a changed game bundle or that every runtime/CSP condition is compatible.

### AST plans and compatibility

Fourteen JSON plan sets under `src/generated/` are imported into the injector bundle. Known builds are selected by source length and SHA-256. An unknown hash triggers a compatibility attempt using templates generated from native AST evidence, with shared symbol checks, lexical filtering, expected match counts, and edit guards. A renamed `main.<hash>.js` URL does not by itself invalidate a plan.

All accepted plans refer to the original source and are merged once. Stale or conflicting plans are rejected individually. This is compatibility checking before execution, not a guarantee that a later rendering, network, or native runtime error can be recovered automatically.

AST parsing occurs in development tools. The installed extension uses prepared data and lightweight template matching; Acorn, acorn-walk, Astring, the local game bundle, and exported AST files are not runtime dependencies. Temporary source-analysis caching lasts only through patch preparation and is unrelated to persistent garage item caching.

### Reference data

Bundled databases supply paint names, skin data, trophy metadata, and map information. They are reference snapshots, not a live server inventory. Augment Specifications instead uses decoded data from the current game session; its injector and native card bindings can require maintenance after a game update. The Weapon Reload Indicator reads native weapon cooldown state and reuses the native panel renderer.

## Build and Release Procedures

### Source of truth

JavaScript implementation changes belong in `src/`. Files under `dist/`, including `kasp_main.js`, are generated artifacts. Editing a generated bundle directly produces changes that the next build can overwrite.

Changes to CSS, templates, locale files, and bundled databases belong in their corresponding resource directories. Browser reloads alone do not compile TypeScript.

### Dependency installation

Use Node.js and npm capable of running the project's tooling. The project does not declare a Node.js `engines` requirement; packaging uses Node filesystem APIs such as `fs.cpSync`.

```powershell
npm ci
```

The package manifest and lockfile root agree on `@types/chrome` `^0.3.0`, esbuild `^0.28.2`, TypeScript `^7.0.2`, Acorn `^8.19.0`, acorn-walk `^8.3.5`, and Astring `^1.9.0`. Use `npm ci` for the locked graph. Use `npm install` when intentionally changing dependencies and review the resulting lockfile changes.

The localized browser description is a separate plain-text metadata field limited to 132 characters; full descriptions and credits live under `docs/`, not in that short field. See [Chrome's manifest description reference](https://developer.chrome.com/docs/extensions/reference/manifest/description).

### Available commands

| Command | Operation |
| --- | --- |
| `npm run typecheck` | Runs `tsc --noEmit` with TypeScript strict checking enabled. |
| `npm test` | Runs every `tools/**/*.test.cjs` file, including Discord companion tests. |
| `npm run check` | Runs strict type checking and the full test suite locally. |
| `npm run parse:client -- <main.js>` | Parses a local game bundle with Acorn; optionally exports its AST with `--ast <output.json>`. |
| `npm run prepare:<feature> -- <main.js>` | Generates or refreshes that feature's AST plan and templates; see the complete command matrix below. |
| `npm run build:js` | Bundles both TypeScript entry points into `dist/`. |
| `npm run build:zip` | Runs local checks, then packages the files currently present into a release archive. |
| `npm run build` | Runs local checks, JavaScript bundling, and packaging in sequence. |
| `npm run release` | Alias for the complete build command. |
| `npm run watch` | Watches and rebuilds the JavaScript entry points. |

The development-only JS parser is [tools/client-parser.cjs](tools/client-parser.cjs). For example:

```powershell
npm run parse:client -- "C:/path/to/main.js"
npm run parse:client -- "C:/path/to/main.js" --ast "main.ast.json"
```

The default input mode is `script`; add `--module` for an ES module. The command reports the absolute input path, parser version, file size, SHA-256 and top-level statement count. AST exports include node offsets and line/column locations; output files must not already exist. Acorn is a development dependency and is not imported by the extension. This step does not migrate interceptors, generate mappings or modify the `archived` backups.

### Refreshing all generated mappings

Save the current, unmodified game bundle as `main.js` in the project root, or provide its real local path. Do not use the extension's `dist/kasp_main.js` as input. An exported `main.ast.json` is optional; preparation commands read JavaScript directly.

From the project root in PowerShell:

```powershell
$features = @(
    'overdrive', 'arcade', 'augments', 'garage-details', 'garage-items',
    'garage-inventory', 'battle-presence', 'battle-statistics', 'user-action', 'critical',
    'supply-privacy', 'box-pickup', 'kill-feed-privacy'
)
foreach ($feature in $features) {
    npm run "prepare:$feature" -- ./main.js
    if ($LASTEXITCODE -ne 0) { throw "Mapping preparation failed: $feature" }
}
node tools/prepare-overdrive-direction.cjs ./main.js
if ($LASTEXITCODE -ne 0) { throw "Direction mapping preparation failed" }
npm run typecheck
npm run build:js
```

Each command writes its matching `src/generated/<feature>.json` by default. It replaces the plan for the same SHA-256 and preserves plans for other builds. The original ten npm preparation commands accept `--out <plans.json>` and `--help`. The supply-privacy, box-pickup and kill-feed-privacy tools, and the direction tool, accept one local input and use their fixed generated output paths; do not pass the older tools' options to them. Incomplete/ambiguous analysis or invalid generated syntax causes that command to fail before writing its output. The sequence produces **14 plan sets** through **13 npm commands and one direct direction CLI** and is not an atomic transaction: an earlier successful file can already have changed when a later command fails. Review changes and run the tests before publishing.

Neither `build:js` nor `build:zip` regenerates mappings. Changes to `src/generated/` require a JavaScript rebuild because plans are embedded in `dist/kasp_injector.js`. **Do not add `src/generated/` as a separate runtime directory to `build:zip`.** The packager already includes the injector bundle containing those plans. Local `main.js`, AST exports, tools, dependencies, and `archived/` are not copied into the release.

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

The current manifest, package, and lockfile package versions are **3.0.0**. The browser, welcome window, and release-folder naming use the manifest version. Keep these metadata values aligned when preparing another version.

### Release output

The packager copies `dist/`, `styles/`, `assets/`, `database/`, `_locales/`, `templates/` and `docs/`, together with `manifest.json`, `LICENSE.txt`, `README.md`, `DOCUMENTATION.md` and `MAINTENANCE.md`.

For the current manifest version, output is:

```text
release/
├── Kaspersky's Inventions 3.0.0/
│   ├── manifest.json
│   ├── LICENSE.txt
│   ├── README.md
│   ├── DOCUMENTATION.md
│   └── ... runtime directories
├── Kaspersky's Inventions 3.0.0.zip
└── Kaspersky's Inventions 3.0.0-firefox.zip
```

The ordinary archive contains the versioned outer folder. The `-firefox.zip` archive instead contains `manifest.json` at its root; it is a packaging layout for submission/testing, not a Mozilla signature or an automatically signed XPI. Extract it and select the folder containing `manifest.json` when loading the extension. Source files, tests, `node_modules`, the local game bundle, and raw generated-plan JSON are not separately included. All three root Markdown guides and the `docs/` directory are included. The separate Electron reference under `tools/` remains source-only.

Packaging replaces the existing output folder and ZIP for the same version. Preserve any release artifact that must be retained before rebuilding it.

On Windows, packaging invokes `tar -a`; on other platforms it invokes `zip`. The required archiver must be available on the command path.

`build:zip` runs type checking and tests but does not regenerate JavaScript. It also skips missing configured files/directories and only performs broad copy-count checks. Inspect the output contents and packaging log before distributing an archive; a successful archive operation does not prove that every required resource was included.

## Testing and Verification

### Automated checks

The repository includes focused Node regression tests under `tools/`:

| Test file | Coverage area |
| --- | --- |
| `augment-specs.test.cjs` | Augment presentation and repeat-update behavior |
| `game-augments.test.cjs` | Device-data instrumentation, exact identity, RU/EN tooltips, collision handling, and session JSON replacement |
| `battle-history.test.cjs` | Imported data, validation, and safe history markup |
| `battle-history-lifecycle.test.cjs` | Database transactions, account changes, async views, and navigation lifecycle |
| `nickname-privacy.test.cjs` | Privacy presentation and preservation of account identity |
| `injector-auto-upgrade.test.cjs` | Bundle-fetch recovery and recognized/unknown upgrade dialogs |
| `arcade-reload.test.cjs` | Native bar reuse, independent arcade progress, equipment changes, pause/stun, renamed/minified bundles and failure isolation |
| `overdrive-timer.test.cjs` | Bonus hooks, independent spawn locations, countdowns, and timer visibility |
| `critical-indicator.test.cjs` | Supported devices, shot/lifecycle telemetry, native readiness, Supercharge recovery, Terminator transitions, and HUD color restoration |
| `client-patches.test.cjs` | Lexical filtering, shared hashing, strict directives, and compatible header merging |
| `client-parser.test.cjs` | Non-executing parser CLI, syntax errors, output protection, and AST serialization |
| `*-ast.test.cjs`, `garage-*.test.cjs` | Exact/adaptive mappings, renamed contracts, ambiguities, native behavior preservation, and preparation CLI failures |
| `supply-privacy.test.cjs` | Garage and battle quantity privacy, live toggles and latest native value restoration |
| `box-pickup.test.cjs` | Pickup completion, fragments/caps, resource ownership and battle cleanup |
| `kill-feed-privacy.test.cjs` | Font-safe own-name replacement, suicide/equipment changes, both kill positions and native loop regression |
| `overdrive-direction.test.cjs` | Camera-relative bearing and independent telemetry mapping/lifecycle |
| `custom-trophies.test.cjs` | Dictionary readiness, initial localized display, favorite/progress changes, and panel refresh |
| `electron-discord/discord-presence.test.cjs` | Extension payloads, privacy, battle reader, IPC framing, reconnect, and session timestamps |

Run the type check and the regression suite explicitly:

```powershell
npm run typecheck
$tests = @(Get-ChildItem -Path tools -Recurse -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
node --test $tests
```

`npm test` discovers all `.test.cjs` files recursively. `npm run check`, `npm run build`, `npm run release`, and `npm run build:zip` require successful tests and strict type checking before proceeding. Checks run locally; no GitHub Actions workflow is installed. The tests use controlled fixtures and mocks; they do not replace verification against the current live game interface. Source contracts also reject explicit TypeScript `any` and native selector/class literals outside `src/core/gameDOM.ts` (including embedded CSS templates). Static `styles/*.css` retain their native stylesheet selectors.

### Browser verification

For changes affecting multiple modules, verify the relevant flows after rebuilding and reloading:

Repeat the affected checks in Chromium and Firefox. Manifest support does not substitute for testing the current build in each browser.

1. Open extension settings, change a switch, close settings, and confirm that the expected reload and feature state occur.
2. Visit the lobby, garage, friends list, and trophy screen. Check native navigation and dialogs as well as extension controls.
3. With nickname hiding enabled, check the header, supported self rows, history, and client `UID` line. Confirm that history/favorites ownership still uses the native account ID.
4. Repeatedly open devices, skins, and shot colors on different equipment. Check late card filling, gray unavailable previews, standard/owned artwork, native descriptions, tooltip closure, and that Possible Rewards remains untouched.
5. Check the Auto Upgrade setup dialog and recognized confirmation flow. Use fixtures or a controlled environment for unknown-dialog handling; actual confirmation can spend account resources.
6. Capture a battle result and inspect both the history list and details. Check pagination and back navigation.
7. Export a backup, import a valid fixture, and verify account ownership. Check rejection of malformed data and literal rendering of HTML-like names.
8. Close the native settings window, navigate to another section, and reopen history. Check that stale overlays and async results do not reappear.
9. Inspect the extension errors and browser console, then inspect the packaged archive before release.
10. Check Shaft/Scorpio arcade progress in centered and tank-following HUD layouts, after death, stun, pause, resize, and equipment changes. Check lower supply-row placement.
11. Check the three critical-device combinations, misses, respawn, Supercharge activation/end, and delayed critical acknowledgements. Confirm other players' nameplates retain native behavior.
12. Pick up overdrive boxes at each available point, including teammate pickups and landing drift; check independent timers and returning from an in-battle section.
13. In the Electron client, verify Discord map/mode, nickname hiding, countdown, party size, lobby session time, minimization, and reconnect. Browser sessions should not send activity.

## Compatibility and Known Limitations

- The implementation relies on game-generated selectors, templates, artwork identifiers, and bundle patterns. Upstream changes can require updates to both code and reference data.
- The Chrome 100 build target specifies JavaScript output compatibility; it is not a certification that every Chromium version or host application has been tested.
- Electron-related adapter code does not by itself constitute a standalone native-client installer or universal Electron compatibility.
- The interface supports English and Russian. Recognition of native labels can be incomplete for other game languages.
- History records observed result screens, rather than retrieving an account's complete historical record from the server.
- Nickname and currency masking cover recognized locations. New or unsupported game elements may need additional selectors.
- Several caches are shared across accounts on the same origin. Their contents can be stale until the relevant module observes fresh data.
- Custom garage skins affect supported image presentation; they do not unlock items or replace the rendered 3D battle model.
- The extra arcade reload row supports local Shaft and Scorpio using native cooldown state; no timing tables or input-based estimates are used.
- Ordinary critical-cycle indication supports the three specified weapon/augment pairs. Post-Supercharge phase assumptions require verification if the game changes its mechanics.
- Device tooltips use mouse hover. Equivalent keyboard, gamepad, and mobile tooltip interaction is not implemented.
- AST compatibility templates reduce dependence on symbol names but still depend on native structure. A runtime exception is not automatically rolled back by the injector's preparation guards.
- An intermittent missing local tank after entering a loaded map has been reported. Its cause and relationship to the extension remain unconfirmed; it is not listed as fixed in 3.0.0.
- Auto Upgrade depends on recognized native dialogs and stops on an unknown confirmation. Its local confirmation count is not an independently verified purchase ledger.
- Third-party UI modifications can alter the same elements and introduce selector, style, or event conflicts.

## Failure Isolation and Recovery

Feature updates and owned callbacks now have independent failure scopes. Three errors within ten seconds stop that feature for the page session and run its cleanup. Slow synchronous calls are recorded in diagnostics without disabling the feature or delaying its updates. A failure in one entry does not skip other module updates. Healthy native indicators can be toggled off/on immediately; a quarantined feature requires reloading the game. Duration measurements cannot interrupt a callback that never returns. TAB updates skip batches containing only recognized extension presentation insertions or edits inside generated content; native and mixed changes remain immediate.

When account ID is missing, existing records remain untouched. Complete results may be held separately in a bounded, unassigned session buffer; earlier pending records are never assigned by nickname. See the [manual maintenance and recovery guide](MAINTENANCE.md) for diagnostics, cleanup boundaries, recovery-buffer export, and repair without AI.

## Troubleshooting

| Symptom | Checks and corrective action |
| --- | --- |
| Extension cannot be loaded | Select the extracted folder containing `manifest.json`; inspect browser extension errors and confirm runtime resources exist. |
| Firefox add-on disappears after restart | A temporary add-on loaded through `about:debugging` must be loaded again; use an author-provided signed package for persistent installation. |
| Source edit has no effect | Rebuild `dist/`, reload the extension, and reload the game page. |
| A switch appears inactive | Confirm the switch is enabled, close settings to apply the reload, and revisit the appropriate game screen. |
| UI breaks after a game update | Inspect the affected module's native selectors, stylesheet, and reference-data matches. |
| Nickname hiding affects an unrecognized location | Add coverage for that native element while retaining the underlying account text and shared identity reader. |
| Currency appears before masking | Currency handling observes supported header controls and includes a timing loop; it does not promise immediate masking of every price on every screen. |
| A paint disappears from filtered results | Clear the query and check whether its artwork URL has an entry in the bundled paint database. |
| Trophy progress looks old | Open the corresponding native trophy cards so the module can observe fresh values. |
| Skin artwork does not update | Verify the equipped native card is recognized and its image URL is supported; allow the repeated-observation check to complete. |
| Arcade reload row is unavailable | Inspect `window.__kaspArcadeReloadDebug.status()`, supported local weapon, mapping readiness, diagnostic disable flag, mesh visibility, and runtime errors; pointer lock is not its timing source. |
| Critical indicator is unavailable or out of phase | Inspect `window.__kaspCriticalDebug.status()`: required augment/equipment IDs, lifecycle, readiness source, shot counters, and recovery state. |
| Unavailable cards remain empty | Stay in the section; inspect console errors, `window.__kaspAugmentsDebug.status()` and `.page()`, and whether the installed bundle includes the late-binding/card-reset fix. |
| Map loads but the local tank does not appear | Preserve the first console error and stack, weapon/augment, browser/client and game build; inspect critical/arcade statuses and compare equivalent entries with the extension disabled. No confirmed fix is currently documented. |
| Discord lacks battle details | Check the Electron bridge and `__kaspPresenceStoreDebug()` / `__kaspPresenceBattleDebug()`; English map data, valid capacity, and fresh snapshots are required. |
| Auto Upgrade stops unexpectedly | Inspect whether the current item/dialog is recognized, a ruby-related condition is detected, MAX is reached, or navigation interrupted the sequence. |
| History is empty after import | Check that every imported record has the current account's `userId`. Old backups without IDs remain separate. |
| History contains duplicates | Re-importing the same IDs now skips existing records. Earlier duplicates and separately captured records with different IDs are not removed automatically. |
| History equipment is missing or outdated | Open native battle statistics during play and allow Equipment Tracker to refresh its cache. |
| History shows a reload notice or `Extension context invalidated` | Fully reload the game tab after reloading/updating the extension. The old page cannot restore its invalidated extension context. |
| Database access fails | Check browser site-storage availability and console errors. Back up accessible records before clearing site data. |
| Settings/history differ between clients | Compare game origin, browser profile, and host application; storage is not synchronized globally. |
| Game loads but tracking is incomplete | Inspect injector errors and whether native fallback loaded the game without instrumentation. |
| `npm ci` rejects installation | Inspect the specific npm error and ensure dependency edits updated both package files; the checked-in ranges currently agree. |
| `[client-parser] ENOENT` | Supply an existing game-bundle path, for example `npm run parse:client -- ./main.js`; placeholder paths are not downloaded automatically. |
| `prepare:<feature>` fails | Keep/review the existing mapping, inspect the reported missing or ambiguous contract, and adapt the offline analyzer to the current game source before rebuilding. |
| ZIP contains outdated code | Run the full build or rebuild JavaScript before `build:zip`; inspect the extracted contents. |
| Packaging command fails | Confirm the platform archiver is installed and on the command path. |

Avoid clearing all game-origin storage as the first troubleshooting step. It can remove extension history and settings as well as unrelated game data. Target the affected cache where appropriate and preserve battle exports first.

## Maintenance Guidelines

1. Modify TypeScript sources under `src/` and regenerate the runtime bundles through the documented build commands.
2. Keep configuration keys and defaults consistent with Core Settings. Document any storage migration when renaming a key.
3. Preserve native identity text. Use verified native user IDs for history/favorites ownership, the shared nickname reader for display/self-row recognition, and CSS masking for privacy presentation.
4. Make DOM updates idempotent: compare current state before changing text, attributes, or inserted nodes.
5. Release observers, listeners, timers, and overlays when their view or game context ends.
6. Guard asynchronous rendering against account changes and superseded requests.
7. Validate imported data before writing, escape stored text at rendering boundaries, and sanitize image URLs.
8. Preserve transaction completion and rollback semantics when changing history operations or schema migrations.
9. Treat unrecognized purchase confirmations as a stop condition. Keep bundle-loading error handling and native fallback intact.
10. Update EN/RU text, templates, reference data, relevant tests, version metadata, and this README when behavior changes.

Review changes in the final generated and packaged output as well as in the source tree. The browser executes the release artifacts, while future maintenance depends on the source implementation remaining authoritative.

## License and Project Status

The governing project terms are supplied in [LICENSE.txt](LICENSE.txt). The English international edition grants ordinary use of official unmodified copies, reserves source/distribution rights and retains express integration permission for the official developers and maintainers of **Tanki Tweaks**. It also contains the warranty disclaimer and user agreement.

`package.json` and the lockfile root declare `UNLICENSED`. This metadata does not grant an open-source license or replace the proprietary terms in `LICENSE.txt`. The package is also marked `private: true`.

Kaspersky's Inventions is an independent extension for the Tanki Online interface. Its presence in a project or client should not be presented as official endorsement by the game's developers.

## Documentation Revision

Reviewed against the **3.0.0** source and manifest on **October 22, 2026**. Build/fixture checks are distinct from live-game verification. Public full descriptions are maintained in English and Russian under `docs/`; browser manifest descriptions remain short because they are separate metadata fields.

## Acknowledgements

The roles and spelling below reproduce `templates/welcome-modal.html`, interpreted using the role dictionaries in `src/modules/welcomeModal.ts`. AI names are project acknowledgements, not build dependencies, required services or product-availability claims.

| Role | Contributors |
| --- | --- |
| Project idea | Kaspersky |
| Co-creation credits | ChatGPT 6 Luna, ChatGPT 6.1 Sol, DeepSeek V4, Claude Sonnet 5.5, Claude Haiku 4.5, Gemini 3.5 Flash-Lite, Gemini 3.8 Flash, Gemini 3.1 Pro, Grok 4.6 |
| Quality review credits | Claude Fable 5.1, Claude Opus 5.5, Gemini 4 Argon, ChatGPT 6 Astra |
| Design | Lukas |
| Testing | safwan, Tenobyte, KOCMOHABTUK |
| Coding | safwan, Tenobyte, Shiya |
| Assistants | Niced, Master |
