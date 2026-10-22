# Discord Rich Presence for the Electron client

Extension integration reference: **3.0.0**, updated **October 22, 2026**. Client executable versioning and automatic updates belong to the separate Electron project.

The extension reads the nickname and current screen and sends a heartbeat every three seconds. In a regular browser the module remains inactive. Discord labels are always in English, regardless of the game's interface language.

During a battle, `details` contains the English map name and available mode, `state` contains the player's nickname, `timestamps.end` supplies the countdown, and `party.size` supplies `[currentPlayers, maximumPlayers]`. Nickname hiding (`k_hideNicknameXP`) changes `state` to `Hidden`; missing identity uses `Signing in`. Settings/storage changes request an immediate extension-side refresh, subject to the client's RPC coalescing.

The MAIN reader captures the native dependency-injection store through prepared AST hooks; it does not need to climb a HUD React component chain. The runtime reader still recognizes `BattleStatistics`, `BattleUsers`, and matching `BattleParams` through semantic fields in diagnostic method source and native collection interfaces. It excludes spectators and accounts for per-team capacity. The HUD clock supplies remaining time; without it the latest server duration is counted down locally. Invalid/missing fields are omitted. Snapshots must be less than five seconds old and the current content-script screen must be `battle` to supply battle fields.

Russian map names are translated through `database/maps.json`; untranslated Cyrillic falls back to an English screen label. Outside battle the section label is used and party/countdown fields are omitted. `window.__kaspPresenceStoreDebug()` reports capture/error; `window.__kaspPresenceBattleDebug()` returns the latest snapshot in the page's MAIN console context. Native model/collection changes may still require adapting the reader, even when the AST hook matches.

Store/capacity plans are embedded from [battle-presence.json](../../src/generated/battle-presence.json). Known bundles use source length/SHA; changed bundles try compatible prepared templates. Refresh with `npm run prepare:battle-presence -- ./main.js` from the extension root, then rebuild JavaScript and reload the extension/game. See the [all-feature preparation workflow](../../README.md#refreshing-all-generated-mappings). No raw plan JSON or AST parser must be installed into the Electron client separately.

The Electron client receives these messages through a restricted preload bridge and sends the activity to the locally running Discord desktop application through Discord IPC. It does not need an account token, Client Secret, additional npm package or a local HTTP server.

Outside a timed battle, the client supplies a fixed `timestamps.start` for its session. Returning to the lobby, changing sections, restoring presence after a cleared heartbeat or reconnecting Discord reuses that start time. A timed battle uses only `timestamps.end`; restarting the client starts a new session timer.

## Client files

Copy the reference files into a compatible Electron project (the development checkout used `C:/Project/tanki-online-with-ki`):

- `preload.ts` → `src/preload.ts`: accepts messages from the main Tanki Online game page and forwards validated text, countdown and party fields to Electron.
- `discordPresence.ts` → `src/discordPresence.ts`: connects to Discord, handles framing and handshake, retries connections and clears the activity.
- `discord-presence.json` → the client root: contains the public Application ID `1558302320163291306`.

The supplied `main.patch` integrates `ipcMain`, `DiscordPresence`, `validPresence`, and `copyPresence`, sets `preload: Path.join(__dirname, "preload.js")` in `BrowserWindow.webPreferences`, and registers `ki:discord-presence`. `contextIsolation` stays enabled and `nodeIntegration` disabled. The handler checks sender, main frame, game URL and payload. Navigation, renderer failure, an explicit clear or closure clears activity. Thirty seconds without a heartbeat clears it only while visible and not minimized. Hidden/minimized windows retain the last activity because renderer timers can be throttled; restore/show grants a fresh grace period without resetting the Discord session timer.

Review `main.patch` against the target client's `src/main.ts` before applying it; it is a reference diff for the original host structure, not a universal installer. A client that already contains the handler/preload must not receive duplicate IPC listeners or another copy of this integration.

The reference client uses its existing Forge/TypeScript build and needs no additional Discord RPC dependency. Ensure the target host compiles/packages the preload and main-process module and copies the root JSON, which the patch reads through `application.getAppPath()`. Build configuration may differ in another Electron project.

## Configuration

The Application ID is resolved in this order:

1. Command-line option `--discord-application-id`.
2. Environment variable `KI_DISCORD_APPLICATION_ID`.
3. Root `discord-presence.json`, field `applicationId`.

Use a Discord application named **Tanki Online**: Discord derives the displayed game name from that application. The extension supplies the current section and nickname. Without a valid ID the client leaves presence inactive and writes a configuration message to its log.

## Build and run

Build the extension in its repository:

```powershell
npm run build:js
```

Build the client from `C:/Project/tanki-online-with-ki`:

```powershell
npm run build
npm run start
```

For a new Windows installer, use the client's existing `npm run make` command. The already installed executable needs to be replaced by the rebuilt client once; updating the extension alone cannot add a preload bridge to it.

The client downloads its extension through its existing update mechanism. Ensure it loads the extension version containing `setupDiscordPresence`; rebuilding local extension files alone does not publish that version to the client's update source.

The current client selects the keyed Chrome Web Store copy of KI. Same-name local/keyless copies no longer take precedence and are skipped. If no store copy exists, it downloads one into a free managed directory without overwriting local files, and retains the store key in the extracted manifest for later startups. Other extensions still load normally. Update checks and loading have separate error handling, so an offline update endpoint does not block an installed copy. The Discord-only main.patch does not modify extension selection; use the current client implementation for this policy. Fully close the client before replacing files: a running page can retain old scripts.

Start the Discord desktop application, enable activity sharing in Discord and open the rebuilt client. The status should contain the application name, current section and nickname. If Discord starts later, the bridge retries automatically. Changed activity is coalesced for up to fifteen seconds to limit RPC traffic; clearing is immediate.

## Verification

From the extension repository:

```powershell
npx tsc --project tools/electron-discord/tsconfig.json
node --test tools/electron-discord/discord-presence.test.cjs
```

The local `tsconfig.json` and `preload-electron.d.ts` let the editor check the preload template without installing Electron in the extension repository. The declaration covers only the IPC method this template uses; it supplies no runtime implementation. Keep these two files here when copying `preload.ts` into the client, where Electron's own type declarations validate it.

Tests use a simulated Discord socket to verify validation, handshake, partial messages, ping/pong, activity changes, reconnect and cleanup. They do not confirm acceptance by a real Discord account or the configured application; that requires running the rebuilt client with Discord open.

## Relationship to the Extension's Other Native Features

The extension now embeds fourteen native plan sets. Account discovery is available in browsers as well as the client; full Discord battle-presence enrichment remains client-specific. A missing store mapping can affect both verified ownership and presence, while a missing direction/supply/box/kill-feed plan need not disable the Discord bridge. Inspect the failing contract before refreshing unrelated plans.

The visible UID line can be completely hidden in streamer mode without deleting the underlying identity text. This does not remove the real account from the native cache. Discord uses its own masked state field: `Hidden`, not the SDF-font fallback used by the WebGL kill-feed. Map/mode, countdown and capacity remain activity fields; nickname hiding does not clear the entire activity.

There is no per-feature Discord switch in the thirteen-option settings panel. Presence activates only when the client bridge/environment is available. In an ordinary browser, absence of Discord activity is expected. The bridge is not installed merely by importing a history backup or opening a client-source link.

## Deployment and Recovery Checklist

1. Keep the client and extension repositories distinct. Compile the client's preload/main modules in the client, and the extension's IIFEs in the extension.
2. Verify that the configured Application ID is present in the packaged client, without adding a token or Client Secret.
3. Check the logged store-managed KI path/version and skipped duplicates. A local/keyless KI copy must not override the managed copy; older clients need the updated loader.
4. Close the running client before replacing extension files. Relaunch it and fully reload the game so old MAIN hooks do not remain active.
5. Verify lobby/session time, a timed battle, map/mode, party capacity, nickname privacy, minimize/restore, Discord reconnect and clear-on-close.
6. Inspect extension-side capture errors separately from preload validation, main-process IPC acceptance and Discord socket failures.
7. Back up local battle history before moving profiles or reinstalling a host. The preload bridge does not synchronize extension web storage between clients.

The reference socket tests and local type declarations validate the bundled bridge's contracts. They cannot prove the target host's packaging paths, installed extension selection, operating-system IPC availability or Discord activity settings. Record these separately in a support report.

## Related Documentation

- [Extension overview and installation](../../README.md)
- [Full technical reference](../../DOCUMENTATION.md)
- [Manual maintenance and failure isolation](../../MAINTENANCE.md)
- [User FAQ](../../docs/FAQ.md)
- [License and Terms of Use](../../LICENSE.txt)

Reference reviewed with extension **3.0.0** on **October 22, 2026**. This guide is shipped in the source repository under `tools/`, not as an automatically installed companion executable.
