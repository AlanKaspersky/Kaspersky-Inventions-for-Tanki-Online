# Discord Rich Presence for the Electron client

The extension reads the nickname and current screen and sends a heartbeat every three seconds. In a regular browser the module remains inactive. Discord labels are always in English, regardless of the game's interface language.

During a battle, `details` contains the English map name, `state` contains the player's nickname, `timestamps.end` supplies the battle countdown and `party.size` supplies `[currentPlayers, maximumPlayers]`. The MAIN-world reader locates the game's React store and recognizes `BattleStatistics`, `BattleUsers` and the current battle's `BattleParams` through semantic field names in their `toString` implementations. It excludes spectators and doubles the per-team limit for team modes. The native HUD clock supplies the current remaining time; if it is absent, the initial server duration is counted down locally until another duration arrives. Unsupported or missing data is omitted instead of inventing a map, timer or capacity.

Russian map names are translated through `database/maps.json`. Outside a battle the section label is used, and battle party/countdown fields are removed. `window.__kaspPresenceBattleDebug()` in the game's main console context returns the latest battle snapshot for diagnosis. Data capture depends on the game's React store and semantic model strings; developer changes to those structures may require adapting the reader.

The Electron client receives these messages through a restricted preload bridge and sends the activity to the locally running Discord desktop application through Discord IPC. It does not need an account token, Client Secret, additional npm package or a local HTTP server.

Outside a timed battle, the client supplies a fixed `timestamps.start` for its session. Returning to the lobby, changing sections, restoring presence after a cleared heartbeat or reconnecting Discord reuses that start time. A timed battle uses only `timestamps.end`; restarting the client starts a new session timer.

## Client files

These files have also been applied to `C:/Project/tanki-online-with-ki`:

- `preload.ts` → `src/preload.ts`: accepts messages from the main Tanki Online game page and forwards validated text, countdown and party fields to Electron.
- `discordPresence.ts` → `src/discordPresence.ts`: connects to Discord, handles framing and handshake, retries connections and clears the activity.
- `discord-presence.json` → the client root: contains the public Application ID `1558302320163291306`.

The client's `src/main.ts` imports `ipcMain`, `DiscordPresence` and `validPresence`, specifies `preload: Path.join(__dirname, "preload.js")` in `BrowserWindow.webPreferences`, and registers the `ki:discord-presence` handler. `contextIsolation` remains enabled and `nodeIntegration` remains disabled. The handler checks the sender, main frame, game URL and payload. Navigation, window closure or thirty seconds without a heartbeat clears the activity.

`main.patch` records the exact changes to `src/main.ts` for review or applying to another checkout of the same client version. The local client already contains these changes; do not apply the patch to it again.

The existing `forge.config.ts`, `tsconfig.json` and npm dependencies require no changes. TypeScript compiles both new modules into `build`; the root JSON is packaged with the app and read through `application.getAppPath()`.

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
node --test tools/electron-discord/discord-presence.test.cjs
```

Tests use a simulated Discord socket to verify validation, handshake, partial messages, ping/pong, activity changes, reconnect and cleanup. They do not confirm acceptance by a real Discord account or the configured application; that requires running the rebuilt client with Discord open.
