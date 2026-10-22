# Kaspersky's Inventions — Tanki Online

Full English publication description for extension **3.0.0**. Updated **October 22, 2026**.

Kaspersky's Inventions brings equipment information, a redesigned lobby, local battle history and streamer controls into Tanki Online. It builds on the game's familiar interface: original navigation, game icons, account data and native actions remain the basis of the experience.

Choose the features you need in the **KASPERSKY** tab inside game settings. The interface is available in **English and Russian**.

## A Lobby with More Information

- A tiled left menu with the game's original section icons and localized labels.
- A centered Quick Battle button, battle-mode shortcuts, PRO battles and festive mode controls.
- Matching metal-shine hover effects and a dimmed main button while searching for a battle.
- Challenges and Elite Pass cards with clear progress lines, native timers and reward notification indicators.
- Favorite trophy progress in a compact grid: up to two turrets and two hulls.
- A Tankoin counter that restores the latest observed balance for the verified account.
- A consistent monochrome design with shared artwork and softly blurred image layers.

Favorite trophies and the custom Tankoin counter appear after the account is identified. Their entrance does not repeat every time you return from another section. If discovery takes longer, a discreet **Searching for account ID** notice appears near the bottom of the lobby and disappears once the ID is found.

## Standard Features

**Friend tags.** Give recognized friends one of three color categories and use the available online, offline, clan and category filters. Categories are stored locally for the verified account.

**Augment specifications.** Read supported advantages, disadvantages and numerical effects on equipment statistics. The same feature handles recognized unavailable-item previews and descriptions. Coverage follows the native data and supported item structures; it does not unlock equipment.

**Quick upgrades.** Choose X5, X10, X15 or MAX for supported upgrade controls. A setup confirmation precedes the sequence, and recognized game confirmations remain part of the purchase flow. Upgrades spend real in-game resources; stopping the sequence does not reverse purchases already accepted by the game.

**Enhanced Play button.** Select supported battle modes directly from the lobby while keeping the original game search and navigation behavior.

**Smart paint search.** Search recognized paints by English or Russian names, including multiword queries, in the garage collection.

**Battle history.** Save observed result screens locally, browse battle cards and detailed player statistics, and manage account-specific JSON backups. History is recorded while the feature is enabled; it does not download an account's past battles from the server.

## Streamer Mode

Three separate switches let you choose what to hide:

- **Hide nickname and XP:** masks supported self-name and experience fields. The client UID line and its separator disappear entirely. Your own name is also masked in the WebGL kill-feed, including kills, deaths, self-destruction and equipment changes.
- **Hide currency:** masks recognized currency displays, including the extension's Tankoin counter.
- **Hide supplies:** hides quantity labels on garage inventory cards and replaces supported supply-strip and battle-HUD quantities with zero.

The kill-feed uses a replacement supported by its actual font: the localized label, an English fallback or an empty name. Other players' names, team colors, ranks and event icons remain intact.

These controls change selected on-screen displays. They do not change the account, stock, game servers or exported history. Some supported masked fields intentionally reveal their original value on hover, so check the screen before streaming.

## Advanced Indicators

**Overdrive box timer.** Matching observed pickups start an 85-second local countdown. Up to two pickup locations can be learned independently in the current battle. A camera-relative direction segment can point toward the learned location when native telemetry is available. The countdown is an estimate based on observed pickups, not a server-provided spawn guarantee.

**Arcade reload indicator.** Adds a separate white native HUD bar for the local Shaft or Scorpio, using the game's cooldown state.

**Critical shot indicator.** Colors the native reload bar for the supported Thunder, Smoky and Hammer device combinations, with handling for Supercharge and supported equipment/lifecycle changes. Unsupported equipment keeps its normal presentation.

Arcade reload and critical indication are enabled by default. Other configurable features default to disabled.

## Visual Changes

Enable **Modified box pickup animation in battle** for a short flash and scattering fragments when recognized boxes are collected. Pieces fade smoothly and the effect has limits on active fragments and terrain checks. The visual can apply to pickups observed for any player; it does not alter rewards, inventory, spawn points or the game's pickup logic.

The effect can be switched off immediately. Performance depends on the computer, graphics settings and current battle.

## Other Integrated Improvements

- Equipment-change indicators and expanded resistance presentation in supported native statistics.
- An enemy-weapons popup for supported statistics data.
- Garage action-button styling and equipped-skin artwork learned from recognized native skin cards.
- Equipment artwork captured from the native statistics interface for battle-history presentation.
- A prototype Esports format card based on the native Sport interface; it is a UI prototype, not a separate server ruleset.
- A welcome window with the installed version and project acknowledgements.
- Optional Discord Rich Presence in a compatible companion Electron client, including the current screen and available battle details.

The ordinary browser extension does not install a desktop client or a Discord preload bridge. Client support is a separate integration.

## Settings Built into the Game

The KASPERSKY tab groups its 13 switches into **Standard features**, **Streamer mode**, **Advanced features** and **Visual changes**. History is in Standard features. The Information panel provides links to the store, source repositories, License and Terms of Use, and FAQ.

Settings use matching panels, one continuous image across each artwork group, sharp text, smooth entrance transitions and scrolling without a visible scrollbar. Supply privacy, box pickup visuals, arcade reload and critical indication apply live. Other changed settings can reload the game when the settings window closes.

## Local Data and Backups

Settings, categories, favorites, cached presentation and recorded history are stored in the current game origin and browser/client profile. Features requiring account ownership use a verified native user ID; nickname changes do not intentionally create a new history owner. Different origins, profiles and clients can have separate data.

Export important history before clearing site data, changing profiles or reinstalling a client. Backups can contain names and other observed battle information; review files before sharing them. There is no built-in cloud history synchronization or automatic support upload.

## Availability and Project Links

The repository provides Manifest V3 builds for desktop Chromium and declares Firefox 128 or newer. A Firefox-layout archive is not a signed add-on. Game updates can require new native mappings or selectors; supported browsers and declared compatibility still need live verification.

Kaspersky's Inventions is an independent project. Use and distribution are governed by its proprietary License and Terms of Use, including retained permission for Tanki Tweaks. A category name is not an endorsement by the game's operator.

- [Chrome Web Store](https://chromewebstore.google.com/detail/tanki-online-kasperskys-i/eemohhfjcdlhmdpflloipmdeeggmofio)
- [Extension source](https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online)
- [Companion client source](https://github.com/AlanKaspersky/Tanki-Online-with-KI)
- [License and Terms of Use](https://drive.google.com/file/d/1j6pNdN7SJZAcRsM2WwLQfzQuWYTcG8ZO/view)
- [Published FAQ](https://drive.google.com/file/d/15xzcltFZiiC9bbiKaZd3-Le6AGvqoTlz/view)
- [Project Discord](https://discord.gg/yNeB7Ah752)

## Credits and Thanks

The following names and roles reproduce the current welcome window. AI names are acknowledgements, not required services or dependencies.

| Role | Contributors |
| --- | --- |
| Project idea | Kaspersky |
| Co-creation credits | ChatGPT 6 Luna, ChatGPT 6.1 Sol, DeepSeek V4, Claude Sonnet 5.5, Claude Haiku 4.5, Gemini 3.5 Flash-Lite, Gemini 3.8 Flash, Gemini 3.1 Pro, Grok 4.6 |
| Quality review credits | Claude Fable 5.1, Claude Opus 5.5, Gemini 4 Argon, ChatGPT 6 Astra |
| Design | Lukas |
| Testing | safwan, Tenobyte, KOCMOHABTUK |
| Coding | safwan, Tenobyte, Shiya |
| Assistants | Niced, Master |
