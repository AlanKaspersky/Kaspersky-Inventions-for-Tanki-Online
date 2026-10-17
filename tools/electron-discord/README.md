# Discord Rich Presence for the Electron client

Extension integration reference: **2.9.7**, updated **October 13, 2026**. Client executable versioning and automatic updates belong to the separate Electron project.

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

The updated client recognizes KI by its store key or its manifest name. If a manually installed KI copy without a store key exists, it takes precedence over the store copy, and duplicate KI directories are skipped. Other extensions still load normally. Fully close the client before replacing extension files and start it again afterwards: a running page can retain scripts from a removed directory.

Start the Discord desktop application, enable activity sharing in Discord and open the rebuilt client. The status should contain the application name, current section and nickname. If Discord starts later, the bridge retries automatically. Changed activity is coalesced for up to fifteen seconds to limit RPC traffic; clearing is immediate.

## Verification

From the extension repository:

```powershell
npx tsc --project tools/electron-discord/tsconfig.json
node --test tools/electron-discord/discord-presence.test.cjs
```

The local `tsconfig.json` and `preload-electron.d.ts` let the editor check the preload template without installing Electron in the extension repository. The declaration covers only the IPC method this template uses; it supplies no runtime implementation. Keep these two files here when copying `preload.ts` into the client, where Electron's own type declarations validate it.

Tests use a simulated Discord socket to verify validation, handshake, partial messages, ping/pong, activity changes, reconnect and cleanup. They do not confirm acceptance by a real Discord account or the configured application; that requires running the rebuilt client with Discord open.
