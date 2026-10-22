# Failure isolation and manual maintenance

Source reference: 3.0.0, October 22, 2026. This guide can be followed without AI.

## What stops, and when

Each feature owns an independent scope in `src/core/featureRuntime.ts`. A scope guards updates, event callbacks, timers, animation frames, microtasks, and mutation observers. The module registry guards each entry separately; one throwing entry does not skip the next feature. Module initialization has an inert fallback and disposes partially registered resources if construction throws.

Three exceptions in a rolling ten-second window disable that scope for the page session. Successful calls between those errors do not hide a recurring failure. Synchronous duration thresholds are diagnostic only: the default is 16 ms, and selected native HUD/animation scopes use 4 ms. Exceeding a threshold updates `slowCalls`, `lastMs`, and `maxMs`; it does not disable the scope, clean up presentation or delay subsequent calls. Measurements cover synchronous execution, not time awaiting a network response.

Disabling is idempotent. Cleanup runs in reverse registration order; one failed cleanup does not prevent the others. Pending scoped callbacks become inert. Tracked timer cancellation releases its registry entry; expired timeouts/frames and once listeners also release theirs. Detached element listeners are pruned after a grace period when new listeners are added. A scope permits at most 4096 tracked listeners. Native indicator ownership is limited to 32 components.

JavaScript cannot interrupt a synchronous callback that never returns. Duration diagnostics are collected only after a callback returns and do not prevent a hang. A promise or an already submitted game action/database transaction is not undone by disabling its feature. Global manifest styles are not unloaded, and already inserted game call sites remain until a full page reload. These boundaries must not be described as complete rollback of the whole client.

## Controls and diagnostics

Run `npm run check` for local strict type checking and all regression tests. Release/ZIP commands require these checks; no GitHub Actions workflow is installed. Source contracts keep native TypeScript selectors/classes in `src/core/gameDOM.ts` and reject explicit `any`. Check related static CSS separately. The shared `src/core/pageMessages.ts` bridge validates window/origin and message schemas, but cannot authenticate another script on the same page. Trophy panels create DOM nodes with literal text and validated game artwork. Garage skin observations still run every 250 ms; bounded parsed-storage and CSS caches avoid repeated work without skipping mounted-skin observations.

The settings panel contains **Arcade reload indicator** (`k_arcade_reload`) and **Critical shot indicator** (`k_critical_indicator`). Both default to enabled to retain existing behavior. Their switches take effect without closing settings or reloading the game. Turning a healthy indicator back on allows its existing hooks to resume; the critical cycle waits for fresh native readiness/lifecycle evidence when necessary. A feature quarantined after recurring errors requires a page reload; slow-call diagnostics alone never quarantine it.

In the game-page console:

```js
window.__kaspPageModulesDebug.status()
window.__kaspArcadeReloadDebug.status()
window.__kaspCriticalDebug.status()
```

In the extension content-script console context:

```js
window.__kaspModulesDebug.status()
window.__kaspModulesDebug.disable('customGarageSkins')
```

`__kaspPageModulesDebug.disable('criticalIndicator')` disables that page-side scope. Status includes reason, latest error, call/failure counts, slow-call count, last/maximum synchronous duration, tracked resources, and cleanup-error count. Indicator status additionally exposes its runtime state. No diagnostics are uploaded.

The old `__kaspArcadeReloadDebug.setEnabled()` controls whether its hook is installed on the next reload. Use the new settings switch for live presentation changes. A legacy diagnostic disable still requires reloading before the missing hook can be installed.

## Cleanup ownership

| Feature | Cleanup and recovery boundary |
| --- | --- |
| Arcade reload | Removes its additional mesh and clears its progress/weapon references; lower centered supply icons no longer reserve the added row. Original health/reload updates remain native. |
| Critical indicator | Restores retained native foreground colors and discards ordinary readiness, cycle, and recovery state, including stale Supercharge readiness. Material restoration is best effort if the native object has already become invalid. |
| Overdrive timer | Removes its timer panels, resets estimates, disconnects its observer, and stops owned callbacks. It cannot change the server's next box spawn. |
| Augment specifications | Restores unavailable previews/placeholders and hidden statistic values, and removes comparison buttons/tooltips. Native model cache contents are not changed. |
| Garage skins | Removes generated replacement CSS and unknown-skin labels, clears pending learning and owner state; stored account selections are preserved. |
| Auto Upgrade | Stops pending steps and input polling and closes extension controls. A purchase already dispatched to the game is not reversible. |
| Friends | Removes category controls/badges/sidebar wrappers and restores tracked filtered rows. Saved categories are preserved. |
| Trophies | Removes extension favorites panel/owned star controls, clears transient owner/cache state; stored favorites remain. |
| Enhanced Play | Cancels extension auto-queue work, removes added buttons/styles, and restores captured presentation properties where the game has not replaced them. A game search already started is not reversed. |
| Paint search | Removes search controls and releases filtering; no paint is equipped or purchased by cleanup. |
| Garage action buttons | Restores captured icon styles and extension classes where they still equal the extension's last write. |
| Nickname/currency privacy | Stops owned callbacks and removes the privacy root class or restores captured currency text and masking metadata. |
| Kill-feed privacy | Restores native text selection and dirties retained renderers; original action objects are never rewritten. Live glyph-table validation is required in width and geometry paths. |
| Box pickup visuals | Clears owned flashes/fragments, restores owned geometry, returns pooled renderers once, and leaves native reward/completion behavior intact. |
| Settings artwork | Disconnects the menu/grid ResizeObserver on close or reinjection; static styles remain loaded. |
| Supply privacy | Removes garage masking classes; restores latest native WebGL label text, clears weak label references and stops the settings poll. Actual stock and activation are unchanged. Refresh mappings with `npm run prepare:supply-privacy -- ./main.js`. |
| Esports | Releases parameter locks, pending rank work, map filters, and the additional format card. It does not undo a battle creation request. |
| Battle history | Invalidates pending views, releases navigation observers, and removes extension overlays/entry. Committed records are preserved. |
| Change Counter/resistance display | Removes added columns, summaries and controls; shared static layout CSS remains loaded. |
| Equipment tracker | Clears its transient captured-equipment cache; other functions may display empty equipment artwork. |
| Discord presence | Stops owned callbacks and requests clearing the extension-provided activity through the client bridge. |

Cleanup failure is visible as `cleanupErrors`. It is not a successful restoration guarantee. A full game reload is the recovery path when native presentation cannot be restored safely.

## WebGL kill feed privacy

The existing `k_hideNicknameXP` switch masks only the local nickname in the native action log, including both attacker and victim positions and join/leave entries. The offline mapping intercepts the string at text measurement and glyph generation; original message objects, account identity, ranks, team colors and icons are preserved. Mask changes mark the native renderer dirty so existing entries update without waiting for another event. English and Russian labels follow the game language. Runtime observers keep only bounded weak renderer references and restore native presentation on disable or quarantine.

Refresh with `npm run prepare:kill-feed-privacy -- ./main.js` and run `node --test tools/kill-feed-privacy.test.cjs`. Unsupported mappings leave the original action log unchanged. No global font hook, game model mutation, prototype trap or DOM text replacement is used.

Always validate replacement characters against the actual bitmap glyph table in both measurement and geometry paths. An unsupported Cyrillic character causes the native width loop to dereference an undefined glyph, interrupting rendering. Prefer the localized label, then `Hidden`, then an empty string; never fall back to the real local nickname while masking is enabled. The regression executes the native width/geometry loops for suicide, equipment changes, attacker and victim entries. See [the renderer investigation](docs/kill-feed-rendering.md) for the verified GuiMain queue and call chain.

## Box pickup visuals

The **Visual changes** settings category contains `k_box_pickup`, disabled by default. It replaces only the native pickup presentation with a 0.22-second flash and fragments that fade between 2.2 and 3 seconds. Native pickup processing and rewards are unchanged. Native completion uses the original cleanup/callback order exactly once. Toggle off to clear owned fragments and restore normal presentation; page-world polling covers isolated-world settings events.

Refresh the offline contract after a game update with `npm run prepare:box-pickup -- ./main.js`, then run `node --test tools/box-pickup.test.cjs` and `npm run check`. Acorn runs only in the build tool. Runtime uses validated edits or consistent templates; an unsupported or conflicting contract leaves the original animation intact. No `Object.prototype` traps or permanent native prototype replacements are installed.

The runtime caps fragments at 140, bounds flashes at 64, limits ground probes to six per frame, and schedules animation frames only while fragments exist. It clears resources on world replacement, battle canvas removal, battle-presence exit, pagehide, disable and feature quarantine. Native pooled renderers are returned once. Optional BufferGeometry fragments restore the original geometry and dispose only their owned geometry before pooling; engines without that interface keep scaled native geometry. Do not dispose shared game geometry or materials.

## Missing account ID

Never substitute a nickname or the last account ID for an unavailable verified owner. Existing ID-scoped history, skin artwork, friend categories, and trophy favorites remain stored. Settings and history explain temporary ID unavailability. Features that do not need account ownership continue independently.

While history recording is enabled, complete result screens observed without a verified owner can be retained in `sessionStorage.kasp_history_unassigned_v1`. This recovery buffer has no owner ID, keeps at most 20 records, is limited to 2,000,000 serialized characters, and excludes entries older than 24 hours when read. Session storage follows the tab's browser-managed lifetime; it is not a durable backup. It is not imported into an account by nickname. If the native owner becomes available while the same result is still open and its displayed nickname matches, normal capture saves that current result and removes its corresponding pending copy. Earlier pending results remain unassigned.

To inspect/export the raw recovery buffer from the game console:

```js
copy(sessionStorage.getItem('kasp_history_unassigned_v1') || '[]')
```

This JSON is a separate recovery format, not an ordinary history import file. Review it before sharing: it contains observed results and player names. Storage failures do not reassign records or interrupt the game.

## Repair a native adapter manually

1. Record extension/game versions, browser, affected screen, reproduction steps, first failure, and relevant diagnostic status. Compare with the extension disabled.
2. Identify the smallest failing feature. Disable it, verify its cleanup, and check that unrelated features still work. Preserve existing user data.
3. Locate the feature in the table below. Compare the current native method/model with the analyzer's expected contract. Look for semantic labels, data flow, call order, and optional-component checks; generated identifier spelling alone is not a contract.
4. Fix the offline analyzer or DOM reader. Reject ambiguous matches. Preserve native argument evaluation, return values, exceptions and call counts. Never wrap the game's own exception as if it were an extension failure.
5. Add a regression reproducing the failure and a case in which the feature must decline to act. Check cleanup twice, late asynchronous completion, account/vehicle changes, invalid values, exceptions and original game behavior.
6. Run `npm run prepare:<feature> -- ./main.js` only for the affected adapter. Preparation parses input without executing it. Inspect the generated JSON diff; if analysis fails, keep existing plans until the analyzer is repaired. The arcade adapter requires `status.runtimeControls`; older plans without cleanup controls are not selected.
7. Run type checking and relevant tests, then build JavaScript. Check the live game in Chromium and Firefox. Fixture/syntax success does not establish compatibility with a changed native implementation.

| Contract | Runtime / offline analyzer |
| --- | --- |
| Local Shaft/Scorpio state, HUD factory/projection/lifecycle | `src/core/arcadeReload.ts`, `tools/arcade-ast.cjs`, `tools/arcade-render.cjs` |
| Local critical readiness, shots/lifecycle/damage, Supercharge, Terminator | `src/core/criticalIndicator.ts`, `tools/critical-ast.cjs`, `tools/critical-events-ast.cjs`, `tools/critical-supercharge.cjs`, `tools/critical-vehicle.cjs` |
| Overdrive pickup model and position | `src/core/bonusPickup.ts`, `tools/overdrive-ast.cjs` |
| Augment descriptions/properties and equipment baselines | `src/core/gameAugments.ts`, `tools/augments-ast.cjs` |
| Native unavailable descriptions/cards and inventory | `src/core/garageDetails.ts`, `garageItems.ts`, `garageInventory.ts`; matching `tools/*-ast.cjs` |
| Account store, native User ID and remote player identities | `src/core/accountIdentityNative.ts`, `accountIdentity.ts`, `tools/battle-presence-ast.cjs` |
| Garage skin selection/ownership/mounted ID | `readGarageCosmeticCard()` / `installGarageSkinCardsBridge()` in `src/core/gameAugments.ts`; `src/modules/customGarageSkins.ts` |
| Overdrive direction | `src/core/overdriveDirection.ts`, `tools/overdrive-direction-ast.cjs`; direct CLI `node tools/prepare-overdrive-direction.cjs ./main.js` |
| Supply-count privacy | `src/core/supplyPrivacy.ts`, `src/modules/hideSupplies.ts`, `tools/supply-privacy-ast.cjs` |
| Box pickup effects | `src/core/boxPickup.ts`, `tools/box-pickup-ast.cjs` |
| WebGL action-log name privacy | `src/core/killFeedPrivacy.ts`, `tools/kill-feed-privacy-ast.cjs` |
| User actions and loaded battle statistics | `src/core/userActions.ts`, `src/core/battleStatistics.ts`; matching `tools/*-ast.cjs` |
| Shared native DOM selectors | `src/core/gameDOM.ts`; verify related CSS separately |

The runtime has no full JavaScript AST parser. Generated mappings still depend on native structures; an accepted structural match can remain semantically wrong. Missing data is not proof of a zero value, absent effect, or critical readiness.

## Verification commands

```powershell
npm run typecheck
$tests = @(Get-ChildItem -Path tools -Recurse -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
node --test $tests
npm run build:js
```

Focused failure tests: `tools/feature-runtime.test.cjs`, `tools/history-unassigned.test.cjs`, `tools/arcade-reload.test.cjs`, `tools/critical-indicator.test.cjs`, and `tools/battle-history-lifecycle.test.cjs`. Test fixtures execute the real scope implementation through `tools/test-feature-context.cjs`.

Do not add expensive graph walks, JSON serialization, DOM scans, file writes or network work to per-frame game callbacks. Work already performed by native game code is not a justification to repeat it inside the hook. Profile a live battle and record timings before expanding responsibilities.

## Incident Triage: Game Loading and Connection Errors

An on-screen connection-lost message does not by itself identify an extension bug. Record the first console exception before the disconnect, game bundle name, extension version, browser/client, active switches and the action that preceded failure. Later errors can be consequences of an earlier render or initialization exception.

1. Export accessible history before changing storage. Keep the current profile and its data.
2. Fully reload after updating the extension; an old page can retain old MAIN hooks even if an extension directory was replaced.
3. Compare one equivalent attempt with KI disabled. Also check duplicate KI copies and other injectors/userscripts. Record whether the result changes.
4. Inspect MAIN scope diagnostics and the affected hook's mapping/runtime status. A missing mapping, a setting disabled, an uninitialized native object and a quarantined scope are different conditions.
5. Separate transport failures (bundle/resource request or game connection) from synchronous JavaScript exceptions and WebGL errors. Do not describe all of them as a server disconnect.
6. If the game itself does not load without KI, preserve that evidence; altering extension account caches does not repair a game/network failure.

The injector's original-script fallback handles fetch/preparation/insertion failures in its guarded path. It is not an automatic rollback after arbitrary code has executed, and it cannot recover a rendering loop already throwing on every frame. Do not remove that fallback or broaden a native match simply to suppress an error.

## Incident Triage: Account ID and Delayed Lobby Elements

Use the page's MAIN console:

```js
window.__kaspAccountDebug.status()
window.__kaspPageModulesDebug.status()
```

Inspect `captured`, mapping readiness, current verified account, discovery `pending/direct/slices/lastError`, and runtime disabled/reason/error. `status()` reads the cached state; explicit `inspect()` performs extra bounded synchronous diagnostics. Do not call the latter every frame or put it in a one-second production loop.

Local account discovery has priority over remote-player ID gathering. Native store capture queues work rather than traversing the graph inside the hook. A cached path remains page-local and is checked against object replacement. Login can finish without navigation; the same captured store can publish newly loaded ownership. Logout reloads the page. Do not reinstate a persisted ID or nickname as proof of ownership.

The search notice waits 600ms and is lobby-only; it should disappear on identity resolution or section exit. A missing notice outside the lobby is intentional. Favorites and the custom Tankoin counter can wait for the ID; this does not mean their saved data was deleted. Their reveal is once per owner/page session, not every return from Garage or another section.

If identity fails, retain existing ID-scoped data. Check the fast TOState/User path, loaded flag and cached schema before expanding the graph budget. Slow-call counters alone must not disable the reader. Remote-player freshness limits still apply independently of the retained local owner.

## Incident Triage: Streamer Mode

| Symptom | Check |
| --- | --- |
| A native UID line is visible | Root privacy class, UID marker, first-child public classification and stylesheet version |
| A leading separator remains after UID hiding | Adjacent native delimiter selector; UID and its following delimiter should both be absent from layout |
| TYPE/VER/UPD/SRV disappear | Stale UID marker or incorrect public classification; do not blanket-hide the shared parameter class |
| Kill-feed freezes on suicide/equipment change | First error in native width/glyph generation; actual font table must support the replacement |
| Kill-feed width and text disagree | Compare the atlas and replacement passed at both call sites; never patch only drawing |
| Supply cards show a black zero | Inventory-card override must suppress the replacement pseudo-element entirely |
| Nuclear Energy selection reveals counts | Replaced/reclassified card counts must receive existing quantity markers again |
| Supply count does not restore | The page bridge must retain the latest native string, not only the first string seen |
| Other players are masked | Exact own-label comparison, clan parsing and verified/current nickname source |

Do not delete React-owned UID/count/name nodes. Presentation hiding must preserve the original text for identity and the game's reconciliation. Manual DOM removal can cause native `insertBefore`/`removeChild` failures later. No global Node method override is an acceptable repair for that ownership violation.

## Visual Layout Maintenance

Settings menu buttons share a single art3 panorama; content panels share another group origin. Keep identical background size/origin across slices, including the KASPERSKY tab. Native tab switching, language rebuild, hidden content, narrow layouts and scrollbar changes must not restart each button's picture.

The lobby uses native icon masks and native event targets. Settings text is visually uppercase. Section icon boxes are 2.3em; Settings is 1.85em. Only image layers are blurred (2px). Keep thin border/blur pixels intentional and other layout dimensions scalable. Pseudo-elements/decorative spans must remain pointer-transparent.

Verify menu and content scrolling with hidden scrollbars. Compare equal panel edges, shared gutters, translated entrance frames, long RU/EN labels and reduced motion. Watch geometry updates for repeated identical style writes or ResizeObserver loops. Do not move a native entry into a new wrapper to solve a purely visual alignment problem.

## Native Contract Refresh Matrix

There are fourteen generated plan sets. Thirteen have npm preparation scripts; the direction tool is currently direct Node only.

| Contract | Command from repository root |
| --- | --- |
| Bonus pickups | `npm run prepare:overdrive -- ./main.js` |
| Arcade reload | `npm run prepare:arcade -- ./main.js` |
| Augment catalog | `npm run prepare:augments -- ./main.js` |
| Garage descriptions | `npm run prepare:garage-details -- ./main.js` |
| Garage item presentation | `npm run prepare:garage-items -- ./main.js` |
| Garage inventory diagnostics | `npm run prepare:garage-inventory -- ./main.js` |
| Account/presence store | `npm run prepare:battle-presence -- ./main.js` |
| Battle metadata | `npm run prepare:battle-statistics -- ./main.js` |
| User action observations | `npm run prepare:user-action -- ./main.js` |
| Critical indicator | `npm run prepare:critical -- ./main.js` |
| Supply text | `npm run prepare:supply-privacy -- ./main.js` |
| Box pickup visual | `npm run prepare:box-pickup -- ./main.js` |
| Kill-feed text | `npm run prepare:kill-feed-privacy -- ./main.js` |
| Overdrive bearing | `node tools/prepare-overdrive-direction.cjs ./main.js` |

The last four fixed-output tools do not implement the original ten tools' optional `--out`/`--help` interface. Work on a local unmodified game bundle, preserve previous generated plans and inspect each diff. Multiple command outputs are not a transaction; stop on failure. Full preparation is needed only when deliberately refreshing all mappings, not after every Markdown or CSS edit.

## Release and Documentation Review

Before distributing a reviewed build:

1. Compare manifest, package and lockfile version fields. A documentation date is not a version bump.
2. Run `npm run check` and regenerate JavaScript if source/plans changed. Check both generated bundles' syntax.
3. Verify only the relevant live flows plus any native collision/regression cases affected by the change. Fixture success does not establish live-server acceptance or performance.
4. Inspect package inputs: runtime directories, `docs/` and the three root guides plus license. Source tools remain separate.
5. Inspect both ZIP layouts: ordinary archive has a versioned outer folder; Firefox archive has a root manifest. Neither workflow signs an add-on.
6. Preserve previous same-version releases before running the packager; it replaces its output folder and both ZIPs.
7. Check README/technical/FAQ/guide links, setting counts/defaults and exact case-sensitive keys. Keep the direction CLI's special invocation documented.
8. Compare publication credits with the actual welcome template. In the full description they belong at the end. AI credits are acknowledgements, not npm dependencies.
9. Keep short browser metadata within its length constraint. Full store copy belongs in the English/Russian description files.
10. Confirm which artifacts were changed locally and which were actually published. Editing local guides does not update a store listing or a hosted Drive PDF.

For the box effect, cover disabled, one pickup, simultaneous pickups, piece caps, world replacement and cleanup twice. For kill-feed masking, cover localized/fallback/empty labels and every own-name position. For history, cover no-ID capture, current-owner import, duplicate IDs, transaction completion and navigation during async work. For client presence, verify the rebuilt host/preload and real Discord separately from socket fixtures.

## Support Report Template

```text
Extension version:
Game build (VER/UPD):
Browser or Electron client/version:
Game origin and interface language:
Enabled KI settings / other extensions or userscripts:
Exact action and expected / actual result:
First console error and stack:
Relevant MAIN/content scope status:
Comparison after a full reload with KI disabled:
Whether the issue repeats:
```

Review diagnostics and exports before sharing. Names, account IDs, battle participants and equipment can be present. Share the smallest relevant snapshot; never include passwords, login tokens, cookies or an entire browser profile. The project does not automatically upload these diagnostics.
