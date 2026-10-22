# Kaspersky's Inventions — FAQ

Source-reviewed edition for **3.0.0**, **October 22, 2026**. This local FAQ describes implemented behavior. The published Drive FAQ is a separately maintained publication; editing this file does not update it automatically.

For installation and a complete feature reference, see [README](../README.md). For Russian instructions, see [Руководство пользователя](USER_GUIDE.ru.md). The governing English terms are in [LICENSE.txt](../LICENSE.txt).

## Installation and Updates

### 1. What is this extension?

An independent interface extension for Tanki Online. It adds supported equipment information, lobby presentation, local records and privacy controls using the game's current interface and native data. It is not a replacement game server or an account-management service.

### 2. Which languages are supported?

English and Russian. The game language preference is checked first, followed by page language and hostname indications. Browser-store metadata uses its own locale files; it is independent of the in-game dictionaries.

### 3. Which browser can I use?

The repository provides a Manifest V3 extension for desktop Chromium and declares Firefox 128 or newer. A declared minimum or build syntax target does not establish that every current game feature works in every browser. Follow the browser-specific installation instructions and test the current build.

### 4. Do I need Node.js to use a release?

No. A prepared release contains the bundles and runtime resources. Node.js and npm are for source development, testing and building.

### 5. Which folder should I load in Chromium?

The extracted directory containing `manifest.json`, `dist/`, `styles/` and the other runtime resources. The ordinary ZIP has an outer versioned folder. Keep that installed directory in place.

### 6. Why does my temporary Firefox installation disappear?

A temporary add-on loaded through `about:debugging` lasts until removal or browser restart. Persistent standard installation uses an appropriately signed package. The release's Firefox ZIP has a root manifest but is not automatically signed. See [Mozilla's installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) and [signed distribution instructions](https://extensionworkshop.com/documentation/publish/install-self-distributed/).

### 7. Why did editing source files not change the game?

The browser executes `dist/`, not TypeScript in `src/`. Run `npm run build:js` after source or prepared-plan changes, reload the extension, then fully reload the game. An existing page can retain old scripts from both execution worlds.

### 8. Do CSS or template changes require a JavaScript build?

They are separate packaged resources, so a JavaScript rebuild is not needed just for those edits. Reload the extension and page to verify the installed resources. A release archive must be recreated to distribute changed resources.

### 9. Is the separate desktop client included?

No. The companion Electron project is separate. This repository contains reference Discord bridge files, not a universal client installer. Updating the browser extension cannot install a missing preload into an existing executable.

## Settings

### 10. Where are KI settings?

Open game settings and select **KASPERSKY**. The Information panel contains the store, source, license and FAQ links.

### 11. How are the features divided?

Standard features: friends, augment specifications, quick upgrades, Enhanced Play, paint search and history. Streamer mode: nickname/XP, currency and supplies. Advanced features: overdrive timer and the two shot indicators. Visual changes: modified box pickup animation.

### 12. Which features are enabled by default?

Only **Arcade reload indicator** and **Critical shot indicator**. There are 13 switches; the other 11 default to disabled. Automatic integrations such as the version window or lobby artwork do not each have an individual switch.

### 13. Which switches apply without a reload?

Supply privacy, modified box pickup visuals, arcade reload and critical indication. Nickname and currency presentation can also react immediately, but their settings still participate in the settings-close reload workflow.

### 14. Why does closing settings reload the game?

At least one non-live option differs from its value when the panel opened. Returning every non-live option to that initial value cancels the reload requirement. A reload establishes a consistent page configuration and native hooks.

### 15. Why is no scrollbar visible?

The custom panel hides scrollbar chrome while preserving scrolling. Use the wheel or touchpad and normal supported focus navigation. On a narrow content area the cards become one column. The left menu and content can scroll independently.

### 16. Are settings saved per account?

The feature switches are shared within the current game origin and browser/client profile. Some feature records are separated by verified account ID, but the whole settings panel is not account-specific.

## Account ID and Lobby

### 17. Is the visible UID the account ID used for storage?

No. `UID: nickname` is a display label. Persistent ownership-sensitive features use the numeric native user ID validated by the account reader, represented as an exact decimal string.

### 18. When does ID discovery start?

During game initialization when the native store is captured. The local User has priority. A fast local-state path is attempted, and supported alternative layouts use bounded work split across small scheduled tasks.

### 19. Is the ID permanently cached?

Verified ownership, resolved paths and schemas are cached in the current page session. The extension does not trust an old ID from disk as proof of a new login. New pages verify again; native invalidation, store replacement or account changes update the current cache.

### 20. Why can I see “Searching for account ID”?

The actual lobby is visible and no verified account is available after a 600ms delay. The notice fades away when the account becomes available or the lobby is left. It is not shown in the battle, garage or another section just because discovery continues.

### 21. Does a slow computer disable account discovery?

Slow-call measurements alone do not disable a scope. Discovery yields between bounded pieces of work. Repeated exceptions can quarantine a feature, and individual browser reflection operations cannot be interrupted halfway through. Inspect the account and runtime statuses before changing budgets.

### 22. Can login complete without reloading the page?

Yes. The account reader observes the captured store's loaded User and can publish ownership after login finishes. Logout normally reloads the page, so the next page establishes a new verified cache.

### 23. Why do trophies and Tankoins appear later than the rest of the lobby?

They wait for verified ownership before using an account cache. Their first presentation for that owner can fade in. Returning from another section does not intentionally replay that entrance for the same owner/page session.

### 24. What does the Tankoin counter know?

The latest observed native shop/exchange value or the last validated value cached for the verified account. It is not an independent live server balance request. A dash can mean no known value; it must not be interpreted as confirmed zero.

### 25. Does a nickname change erase favorites or history?

The same verified user ID keeps its ownership-sensitive records. Another ID is a different owner even when the nickname matches. Older nickname-keyed or legacy shared data remains separate rather than being silently reassigned.

### 26. What are the lobby trophy favorites?

Up to two turrets and two hulls selected from supported trophy cards. The lobby shows localized names, percentages, progress bars and current/target values. Values are observed and cached; the extension does not obtain an independent authoritative mission feed.

## Streamer Mode

### 27. What exactly does Hide nickname and XP cover?

Supported header name/XP, self rows in statistics/results, current-player history presentation, the native client UID line, and the local player's name in the WebGL action log. New unsupported game elements may need additional selectors or native mappings.

### 28. What happens to the UID footer?

The UID element and its following separator are absent from the layout while privacy is enabled. TYPE, VER, UPD and SRV remain. The actual text and native node remain in the DOM so identity reading and native UI reconciliation continue; disabling restores the line.

### 29. What does the kill-feed show instead of my name?

`Скрыто` or `Hidden` if its native font supports all characters. It can fall back to `Hidden`, or an empty name when neither label is supported. This prevents missing-glyph exceptions. Rank/event icons and other players' names are preserved.

### 30. Does this apply to both sides of a kill?

Yes: the exact local player label is handled as attacker or victim, and in self-destruction, equipment-change and supported join/leave entries. A nickname merely containing the same substring is not the local player.

### 31. Is the account anonymous when privacy is enabled?

No. These are presentation controls. Original game data and local exports can still contain names and account IDs. Some supported DOM fields intentionally reveal original values on hover; the hidden UID line itself cannot be hovered. Check recordings, overlays and presence settings separately.

### 32. What currency values are hidden?

Recognized currency/header spans outside the battle and the custom Tankoin counter. This is not a promise to mask every numeric price or every third-party interface. The general currency module retains latest native values and restores them when masking ends.

### 33. Does Hide supplies make supplies unavailable?

No. It changes supported count presentation only. Real stock, activation, cooldowns, duration, prices and availability remain controlled by the game.

### 34. Why is there no zero on the open Supplies cards?

Those inventory-card quantity labels are omitted entirely. The garage supply strip and supported battle HUD counters instead display zero. This is intentional, including when the native card changes after selecting Nuclear Energy.

### 35. Will the real count return after I turn masking off?

Yes for the supported paths: DOM masking is released, and the native battle label bridge restores the latest string observed while hidden. Unsupported client structures are left native; a stale or missing patch can require a mapping update and page reload.

## Garage and Navigation

### 36. Does augment information unlock unavailable items?

No. It presents supported native item data, descriptions and statistic adjustments. Ownership and server purchase eligibility do not change.

### 37. Are Possible Rewards cards handled the same way?

No. The unavailable-item preview/description integration excludes Possible Rewards. Do not assume every card-like surface is a supported garage item.

### 38. Why might an augment value be missing or unresolved?

The relevant native description, property or equipment association may not have been observed, or the mapping may no longer match. Missing data is not a zero effect. Revisit the native device card and preserve diagnostics if it remains unresolved.

### 39. Does paint search understand every paint?

It searches recognized image/name entries in the bundled paint data using supported English/Russian names and multiword matching. Unknown or changed artwork can need a database update. Clearing the query restores the ordinary collection filtering path.

### 40. Are friend categories synchronized to a server?

No. Three local color categories are saved by the verified owner ID and recognized friend user IDs. Supported native lists supply current online/offline/clan information. Ambiguous or unavailable friend IDs are not safely replaced with guessed ownership.

### 41. Can quick upgrades spend resources?

Yes. It drives recognized game purchase confirmations after its setup confirmation. X5/X10/X15/MAX are sequences of actual upgrade actions, not a visual preview. Stopping a queue does not reverse an already accepted purchase.

### 42. Why does a quick-upgrade queue stop?

Navigation, an unrecognized confirmation, unsupported item/control, a detected Ruby-related condition, maximum upgrade state or other guard can stop it. Do not weaken dialog recognition just to force continuation.

### 43. Can I choose arbitrary skins with this extension?

There is no general arbitrary-skin unlocker. The module learns recognized owned/equipped native skin-card artwork and uses it for supported garage images. It does not replace the server loadout or the tank's rendered battle model.

### 44. Is the Esports card a new official mode?

No. It is a prototype UI card based on the native Sport format with custom presentation. It does not establish a separate official server ruleset.

## Battle Indicators and Visuals

### 45. Which weapons use the extra arcade bar?

The local Shaft and Scorpio. The extra foreground is white, and timing follows supported native cooldown state. It does not recolor unrelated original charge indicators or infer cooldown from mouse input.

### 46. Which critical-shot combinations are supported?

The implemented combinations cover Thunder with Strict Ammunition Load, Smoky with Sorted Ammunition and Hammer with Revolver, with supported native lifecycle/readiness handling. Supercharge and Terminator/Juggernaut transitions have special guards. Other combinations are not automatically supported just because they can fire critical shots.

### 47. Does the overdrive timer start on battle entry?

No. A matching observed overdrive pickup starts or restarts the corresponding 85-second timer. Up to two positions are learned during that battle. It can observe a matching pickup by another player as well as your own.

### 48. Is its direction marker a route to the box?

No. It is a camera-relative bearing to a learned pickup position. It does not route around walls or establish whether an uncollected box exists. Missing/stale telemetry can hide the marker while the countdown continues.

### 49. Does zero on the timer guarantee a box has appeared?

No. The deadline is a local estimate from the configured interval and observed pickup, not a server spawn acknowledgement. The timer can remain at zero. A new battle clears learned positions and deadlines.

### 50. What changes when box pickup visuals are enabled?

A brief flash and scattering/fading fragments replace recognized pickup presentation. Native reward processing remains. The effect can apply to any observed player's pickup, with bounded pieces and terrain probes. Turn the switch off to clear owned visuals immediately.

### 51. Are the box effect and overdrive timer the same feature?

No. One changes a visual animation; the other observes a specific bonus to estimate respawn timing. Each has its own setting and native contract.

### 52. Is the grenade tracer bundled?

The separately discussed gtrail userscript is not a module or setting in this extension's current registry. Do not install or describe that script as a required KI component.

### 53. Are live mission-completion notifications included?

No general daily/weekly/special mission observer or battle notification feature is shipped in the current registry. Trophy favorites show a different observed/cached progress source. Prior console diagnostics do not establish a production mission feature.

## History and Backups

### 54. What gets recorded?

Supported complete result screens observed while history is enabled and ownership can be established. Cards/details contain captured battle and player data. The extension cannot reconstruct results never shown to this page or download the account's complete past history.

### 55. Does opening TAB matter for equipment images?

The shipped equipment tracker reads supported self-equipment icons from the native statistics DOM. If that interface has not supplied usable icons, history artwork can be missing or cached. Native TankInfoCC/inventory console experiments did not become a continuously updated equipment-icon service.

### 56. How do I move history to another profile?

Export JSON from the history controls, keep the file, open the target profile/client, sign into the same verified account and import through the history controls. The game origin/profile normally has separate storage. Check the resulting list before removing the original data.

### 57. Can I import another account's history?

Normal import validates account IDs and does not assign records to the current account by nickname. Legacy backups without accepted ownership remain separate rather than being silently adopted. Review the documented format and validation rules before editing an export.

### 58. What happens if I import the same backup twice?

Existing record IDs are skipped. This does not retroactively merge separately recorded duplicates with different IDs or repair old malformed records. Import success depends on validation and the database transaction completing.

### 59. What if the result appears before my account ID?

A complete observed result can be held in a separate bounded session recovery buffer while history is enabled. It is not automatically assigned to a later owner by nickname. A currently open matching result can still be captured normally once ownership becomes available. See the maintenance guide before manual recovery.

### 60. Are history files private?

They can contain account IDs, nicknames, participants, equipment and battle results. Streamer masking does not anonymize JSON exports. Review backups and diagnostics before sharing them.

### 61. Does clearing history reset my game account?

No. The history action clears supported locally stored records for the current verified owner through its confirmation flow. It does not reset server progress or other accounts' records. Export important data first.

## Performance, Failures and Support

### 62. Will enabling KI keep exactly the same FPS?

No fixed FPS guarantee is made. Visuals, DOM work, browser throttling, other extensions and the game all affect performance. The implementation bounds several native tasks and caches, but a controlled comparison is needed to measure a particular machine.

### 63. What is feature quarantine?

Three exceptions within ten seconds stop the affected scope for the page session and run its registered cleanup. Slow-call duration alone is diagnostic. A healthy feature can be toggled according to its setting; a quarantined scope needs a full reload.

### 64. Does quarantine undo everything?

No. It stops owned callbacks/resources and performs feature-specific cleanup. It cannot reverse a purchase, a committed transaction or arbitrary native code, and it cannot interrupt a synchronous function that never returns. Static manifest styles remain loaded.

### 65. Why can the game say connection lost?

The message alone does not identify the cause. Preserve the first console error and the preceding action, fully reload after extension updates, check duplicate injectors and compare an equivalent attempt with KI disabled. A rendering exception can precede a disconnect; a transport/server failure may be independent of KI.

### 66. What should I send in a bug report?

Extension and game build, browser/client and language, enabled settings, reproduction steps, expected/actual result, first stack trace and the smallest relevant diagnostic status. State whether it repeats after a full reload and without KI. Remove login tokens, cookies and unrelated personal information.

### 67. Is there automatic cloud synchronization or support upload?

No built-in history cloud synchronization or automatic diagnostic uploader is implemented. Local storage is not an encrypted vault. Game requests, update mechanisms, external links and optional client presence are separate traffic paths.

## Discord and Project Terms

### 68. Why does Discord presence not work in my browser?

It requires the compatible companion Electron preload/main-process bridge and the local Discord application. Ordinary browser sessions do not activate this module. The extension alone cannot add that bridge to an installed client.

### 69. What activity can Discord display?

The current section, masked or real nickname and available English battle map/mode, countdown and capacity. Nickname privacy uses Hidden for the presence name but does not remove the other activity fields. Client and Discord settings control publication.

### 70. Does public source mean an open-source license?

No. The repository is proprietary and the package says UNLICENSED. Read the [License and Terms of Use](../LICENSE.txt) for ordinary-use permissions, restrictions, warranties/liability provisions and the retained special permission for Tanki Tweaks. Public visibility and project credits do not themselves grant redistribution rights.

## Official Project Links and Credits

- [Extension repository](https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online)
- [Companion-client repository](https://github.com/AlanKaspersky/Tanki-Online-with-KI)
- [Published License and Terms of Use](https://drive.google.com/file/d/1j6pNdN7SJZAcRsM2WwLQfzQuWYTcG8ZO/view)
- [Published FAQ](https://drive.google.com/file/d/15xzcltFZiiC9bbiKaZd3-Le6AGvqoTlz/view)
- [Project credits](../README.md#acknowledgements)

The full English and Russian publication descriptions reproduce the complete current welcome-window acknowledgements at their end, including assistants **Niced** and **Master**.
