# Failure isolation and manual maintenance

Source reference: 3.0.5, October 24, 2026. This guide can be followed without AI.

## Navigation

- [Failure isolation](#what-stops-and-when)
- [Diagnostics](#controls-and-diagnostics)
- [Support report](#support-report-template)
- [Weather diagnostics and validation](#weather-maintenance)
- [Electron deployment and verification](#electron-client-maintenance)
- [Documentation distribution and publication](#documentation-publication)

## What stops, and when

Each feature owns an independent scope in `src/core/featureRuntime.ts`. A scope guards updates, event callbacks, timers, animation frames, microtasks, and mutation observers. The module registry guards each entry separately; one throwing entry does not skip the next feature. Module initialization has an inert fallback and disposes partially registered resources if construction throws.

Three exceptions in a rolling ten-second window disable that scope for the page session. Successful calls between those errors do not hide a recurring failure. Synchronous duration thresholds are diagnostic only: the default is 16 ms, and selected native HUD/animation scopes use 4 ms. Exceeding a threshold updates `slowCalls`, `lastMs`, and `maxMs`; it does not disable the scope, clean up presentation or delay subsequent calls. Measurements cover synchronous execution, not time awaiting a network response.

Disabling is idempotent. Cleanup runs in reverse registration order; one failed cleanup does not prevent the others. Pending scoped callbacks become inert. Tracked timer cancellation releases its registry entry; expired timeouts/frames and once listeners also release theirs. A scope permits at most 4096 tracked listeners. Native indicator ownership is limited to 32 components.

DOM ownership is swept independently of feature updates, using one shared one-second timer per execution world while DOM resources exist. A node disconnected for at least one second between sweeps releases its presentation snapshot and external cache entries (normally within one to two seconds, longer in background-throttled tabs). Brief reparenting resets that grace period. `preserve()` uses one registry cleanup per scope, rather than a permanent cleanup closure per element. `ownDOM(node, restore)` lets paint filtering, friend filtering and augment previews/stat replacements release their strong maps even after the screen dispatcher stops calling those modules. Restoration changes only values still owned by the feature; later native changes are retained.

Detached event targets are unlistened after the same grace period: `removeEventListener()` removes each extension wrapper before its cleanup registration and weak-index entry are released. Native game handlers are untouched. Cached fragments recreate extension controls or reset their initialization markers on return; brief reparenting keeps existing handlers. Window/document listeners remain scoped until explicit removal/disposal. This removes extension-held roots; the game or browser can independently retain nodes, and immediate garbage collection is not guaranteed.

JavaScript cannot interrupt a synchronous callback that never returns. Duration diagnostics are collected only after a callback returns and do not prevent a hang. A promise or an already submitted game action/database transaction is not undone by disabling its feature. Global manifest styles are not unloaded, and already inserted game call sites remain until a full page reload. These boundaries must not be described as complete rollback of the whole client.

## Controls and diagnostics

### Tool and test categories

| Location | Purpose |
| --- | --- |
| `tools/tests/` | Automated regression tests, grouped into accounts, core, lobby, garage, battle, graphics, privacy, history, injector, AST, client and documentation |
| `tools/tests/helpers/` | Shared VM/feature fixtures; not standalone tests |
| `tools/ast/` | Offline native-bundle analyzers and edit/template generators |
| `tools/prepare/` | Preparation CLIs used by the existing `npm run prepare:*` commands |
| `tools/parser/` | Read-only game-bundle parser CLI |
| `tools/browser/` | Isolated browser/layout/WebGL/audio checks and their shared Playwright launcher |
| `tools/validation/` | Optional checks against a supplied real game bundle |
| `tools/build/` | Release packaging |
| `tools/client/discord/` | Companion-client bridge reference sources and configuration |
| `artifacts/qa/` | Ignored browser reports and screenshots; generated output |

Run all automatic regressions with `npm test`, or select categories with `npm test -- privacy history` and `npm test -- core documentation`. `npm run check` still includes type checking and the complete automatic suite. The runner searches only `tools/tests/`, independently of browser output directories.

Browser checks are separate: `npm run test:browser:settings`, `npm run test:browser:trophies`, `npm run test:browser:weather`, `npm run test:browser:loader`, and `npm run test:browser:dom-lifetime`. They use temporary browser profiles, never the user's live game profile. Install Playwright or set `PLAYWRIGHT_MODULE_PATH` to its module directory; the bundled Codex runtime is detected when present. `PLAYWRIGHT_BROWSER_PATH` can select a browser executable; otherwise Windows uses installed Edge when available, with Playwright's bundled Chromium as the fallback. The DOM lifetime check exercises 300 garage/friend/paint-search mount/unmount cycles, waits for automatic cleanup, forces Chromium garbage collection and checks WeakRefs, cached-fragment reuse and restoration. Its fixture does not measure live-game memory or FPS. The report is written to `artifacts/qa/dom-lifetime/report.json`.

`npm run test:browser:friends` checks context-menu controls before the first frame, enabling after a delayed identity message without another DOM mutation, demand refresh, rejection of stale-owner clicks, and stable repeated updates. Its local fixture also rejects all external requests, so the CSS color diamonds cannot accidentally depend on CDN images.

For an optional large-bundle check, run `node tools/validation/rain-bundle.cjs ./main.js`. It reads the supplied local bundle and verifies weather-template adaptation, patch merging and JavaScript syntax without executing game code.

Client updater tests need the separate client's actual source. Set `KI_CLIENT_SOURCE` to its `src/main.ts`, then run `npm run test:client`. Without that variable, only the updater check is explicitly skipped; the Discord bridge tests still run. The updater tests extract the relevant functions and simulate file/network/extension APIs without starting Electron or writing to a user profile.

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

`__kaspPageModulesDebug.disable('criticalIndicator')` disables that page-side scope. Status includes reason, latest error, call/failure counts, slow-call count, last/maximum synchronous duration, tracked resources, `domNodes` (strong DOM ownership), `listeners` (active scoped listener registrations), and cleanup-error count. Expired detached wrappers are removed from their targets, not merely excluded from these counters. Indicator status additionally exposes its runtime state. No diagnostics are uploaded.

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

Refresh with `npm run prepare:kill-feed-privacy -- ./main.js` and run `node --test tools/tests/privacy/kill-feed-privacy.test.cjs`. Unsupported mappings leave the original action log unchanged. No global font hook, game model mutation, prototype trap or DOM text replacement is used.

Always validate replacement characters against the actual bitmap glyph table in both measurement and geometry paths. An unsupported Cyrillic character causes the native width loop to dereference an undefined glyph, interrupting rendering. Prefer the localized label, then `Hidden`, then an empty string; never fall back to the real local nickname while masking is enabled. The regression executes the native width/geometry loops for suicide, equipment changes, attacker and victim entries. See [the renderer investigation](DOCUMENTATION.md#kill-feed-rendering-investigation) for the verified GuiMain queue and call chain.

## Box pickup visuals

The **Visual changes** settings category contains `k_box_pickup`, disabled by default. It replaces only the native pickup presentation with a 0.22-second flash and fragments that fade between 2.2 and 3 seconds. Native pickup processing and rewards are unchanged. Native completion uses the original cleanup/callback order exactly once. Toggle off to clear owned fragments and restore normal presentation; page-world polling covers isolated-world settings events.

It also contains default-off `k_rain_weather`. Confirm enabling immediately expands the full-width localized rain/thunder volume sliders; verify independent live levels, mute, persistence and collapse on disable. Check the 0–100% chance and duration sliders and all six preset choices; 0% prevents a new episode, 100% plus Random selects a rainy preset, and generation edits apply to newly planned battles without rerolling an existing one. Check native Fog on/off, storm depth against map geometry and HUD, one episode after re-entry/toggle/reload of the same known battle, immediate audio stop on exit, and owned GPU cleanup on disable/context loss. Remove the old Tampermonkey weather copy. Prepare its render/fog contract with `npm run prepare:rain-weather -- ./main.js`; unknown contracts must skip weather. See [weather maintenance and validation](DOCUMENTATION.md#weather-reference). Browser QA uses a synthetic scene and is not a live-game FPS benchmark.

Weather v2 requires both native stages (after SkyBox and before SpritesOnTop). Never reintroduce a camera-screen/depth mask into the 10 Hz cloud cache or condition per-frame storm grading on depth-copy success. Test yaw/pitch, camera-height changes, pink fog maps, transparent foliage/parachutes, and cloud-only onset/clearing. Rare lightning must use its world-space branched mesh, not a periodic independent screen strobe. Confirm one delayed thunder per strike, no non-storm strikes, stable rain RMS and bounded gain automation. Lightning VAO/array-buffer state and optional half-float cloud targets must leave native rendering intact.

Refresh the offline contract after a game update with `npm run prepare:box-pickup -- ./main.js`, then run `node --test tools/tests/battle/box-pickup.test.cjs` and `npm run check`. Acorn runs only in the build tool. Runtime uses validated edits or consistent templates; an unsupported or conflicting contract leaves the original animation intact. No `Object.prototype` traps or permanent native prototype replacements are installed.

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
| Local Shaft/Scorpio state, HUD factory/projection/lifecycle | `src/core/arcadeReload.ts`, `tools/ast/arcade-ast.cjs`, `tools/ast/arcade-render.cjs` |
| Local critical readiness, shots/lifecycle/damage, Supercharge, Terminator | `src/core/criticalIndicator.ts`, `tools/ast/critical-ast.cjs`, `tools/ast/critical-events-ast.cjs`, `tools/ast/critical-supercharge.cjs`, `tools/ast/critical-vehicle.cjs` |
| Overdrive pickup model and position | `src/core/bonusPickup.ts`, `tools/ast/overdrive-ast.cjs` |
| Augment descriptions/properties and equipment baselines | `src/core/gameAugments.ts`, `tools/ast/augments-ast.cjs` |
| Native unavailable descriptions/cards and inventory | `src/core/garageDetails.ts`, `garageItems.ts`, `garageInventory.ts`; matching `tools/ast/*-ast.cjs` |
| Account store, native User ID and remote player identities | `src/core/accountIdentityNative.ts`, `accountIdentity.ts`, `tools/ast/battle-presence-ast.cjs` |
| Garage skin selection/ownership/mounted ID | `readGarageCosmeticCard()` / `installGarageSkinCardsBridge()` in `src/core/gameAugments.ts`; `src/modules/customGarageSkins.ts` |
| Overdrive direction | `src/core/overdriveDirection.ts`, `tools/ast/overdrive-direction-ast.cjs`; direct CLI `node tools/prepare/prepare-overdrive-direction.cjs ./main.js` |
| Supply-count privacy | `src/core/supplyPrivacy.ts`, `src/modules/hideSupplies.ts`, `tools/ast/supply-privacy-ast.cjs` |
| Box pickup effects | `src/core/boxPickup.ts`, `tools/ast/box-pickup-ast.cjs` |
| WebGL action-log name privacy | `src/core/killFeedPrivacy.ts`, `tools/ast/kill-feed-privacy-ast.cjs` |
| User actions and loaded battle statistics | `src/core/userActions.ts`, `src/core/battleStatistics.ts`; matching `tools/ast/*-ast.cjs` |
| Shared native DOM selectors | `src/core/gameDOM.ts`; verify related CSS separately |

The runtime has no full JavaScript AST parser. Generated mappings still depend on native structures; an accepted structural match can remain semantically wrong. Missing data is not proof of a zero value, absent effect, or critical readiness.

## Verification commands

```powershell
npm run typecheck
$tests = @(Get-ChildItem -Path tools -Recurse -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
node --test $tests
npm run build:js
```

Focused failure tests: `tools/tests/core/feature-runtime.test.cjs`, `tools/tests/history/history-unassigned.test.cjs`, `tools/tests/battle/arcade-reload.test.cjs`, `tools/tests/battle/critical-indicator.test.cjs`, and `tools/tests/history/battle-history-lifecycle.test.cjs`. Test fixtures execute the real scope implementation through `tools/tests/helpers/feature-context.cjs`.

Do not add expensive graph walks, JSON serialization, DOM scans, file writes or network work to per-frame game callbacks. Work already performed by native game code is not a justification to repeat it inside the hook. Profile a live battle and record timings before expanding responsibilities.

## Incident Triage: Game Loading and Connection Errors

An on-screen connection-lost message does not by itself identify an extension bug. Record the first console exception before the disconnect, game bundle name, extension version, browser/client, active switches and the action that preceded failure. Later errors can be consequences of an earlier render or initialization exception.

1. Export accessible history before changing storage. Keep the current profile and its data.
2. Fully reload after updating the extension; an old page can retain old MAIN hooks even if an extension directory was replaced.
3. Compare one equivalent attempt with KI disabled. Also check duplicate KI copies and other injectors/userscripts. Record whether the result changes.
4. Inspect MAIN scope diagnostics and the affected hook's mapping/runtime status. A missing mapping, a setting disabled, an uninitialized native object and a quarantined scope are different conditions.
5. Separate transport failures (bundle/resource request or game connection) from synchronous JavaScript exceptions and WebGL errors. Do not describe all of them as a server disconnect.
6. If the game itself does not load without KI, preserve that evidence; altering extension account caches does not repair a game/network failure.

The static main-bundle rule in `rules/game-bundle.json` redirects a query-free main bundle on the selected game CDNs to the packaged gate before its game code executes. It covers both script and XHR requests: the native NetworkFirst service worker uses an internal fetch, which reproduced network-gate-unavailable when only script was included. Both source reading and native recovery must use `ki_native=1`; otherwise XHR interception would return the gate as the game's own source. Do not restore the old post-insertion removal/MutationObserver path. `readGameBundle()` bounds fetch plus body reading to 15 seconds; preparation has its own 15-second deadline and cancellation checks. Reproduce unresolved fetch/body/preparation, then resolve late: recovery must request one native bypass, never a late patched copy. Once the execution marker has run, errors are terminal and must not replay the game. Inspect `window.__kaspGameLoader.status()` and preserve native attributes/nonce/SRI. A native failure must not enter a retry loop. Modules, integrity contracts, query-bearing URLs and environments without effective network rules can use the native path without AST instrumentation.

Run `npm run test:browser:loader` against the real unpacked extension and local Tanki-shaped hosts. It checks parser, async/defer, dynamic and duplicate tags, cold/warm HTTP cache, CSP/nonce, SRI, modules, native bypass, HTTP errors, hanging response/body, missing injector, partial runtime failure and syntax/native failures. Active NetworkFirst-worker regressions seed an original cached bundle, then require cold and warm controlled pages to run the instrumented path once, without unregistering the worker or clearing caches. Count game side effects, not script elements: a blocked original and a replacement existing in the DOM do not prove single execution. The test uses a separate page/CDN origin and no real game/account. Check packaging includes both `dist/kasp_game_gate.js` and `rules/game-bundle.json`; `build:zip` now rebuilds JavaScript. Live-game, Firefox and Electron checks remain separate.

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
| Overdrive bearing | `node tools/prepare/prepare-overdrive-direction.cjs ./main.js` |

The last four fixed-output tools do not implement the original ten tools' optional `--out`/`--help` interface. Work on a local unmodified game bundle, preserve previous generated plans and inspect each diff. Multiple command outputs are not a transaction; stop on failure. Full preparation is needed only when deliberately refreshing all mappings, not after every Markdown or CSS edit.

## Release and Documentation Review

Before distributing a reviewed build:

1. Compare manifest, package and lockfile version fields. A documentation date is not a version bump.
2. Run `npm run check` and regenerate JavaScript if source/plans changed. Check both generated bundles' syntax.
3. Verify only the relevant live flows plus any native collision/regression cases affected by the change. Fixture success does not establish live-server acceptance or performance.
4. Inspect package inputs: runtime directories and the three root guides plus license. Source tools remain separate.
5. Inspect both ZIP layouts: ordinary archive has a versioned outer folder; Firefox archive has a root manifest. Neither workflow signs an add-on.
6. Preserve previous same-version releases before running the packager; it replaces its output folder and both ZIPs.
7. Check README/technical/FAQ/guide links, setting counts/defaults and exact case-sensitive keys. Keep the direction CLI's special invocation documented.
8. Compare publication credits with the actual welcome template. In the full description they belong at the end. AI credits are acknowledgements, not npm dependencies.
9. Keep short browser metadata within its length constraint. Full store copy belongs in the English/Russian publication sections of README.md.
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

<a id="weather-maintenance"></a>

## Weather Diagnostics and Validation

<a id="weather-maintenance-maintenance-and-validation"></a>

### Maintenance and validation

If rain appears absent, inspect `window.__kaspRain.status()`: `timing.phase: "waiting"` and positive `startsInSeconds` indicate a normal scheduled delay; `rainStartsInSeconds` includes cloud formation before the first drops. Check runtime errors separately.

For a manual in-battle preview, first enable the setting, then run `window.__kaspRain.force("storm")` in the game's page console. Clouds/rain ramp up over 24 seconds, hold for 120 seconds and clear over 30 seconds. An optional second argument changes the hold, clamped to 15–180 seconds. `window.__kaspRain.clearOverride()` returns to the original random plan. The preview is temporary, does not rewrite the saved plan, and clears on battle exit or disabling the feature. Other retained preset IDs can also be previewed. Reload the extension and game after rebuilding to expose a newly added command.

`src/core/rainWeather/` owns scheduling, rendering, sound, numeric volume/generation preferences and the prepared patch selector. `k_rain_duration` stores a 0–1 share (default .30); `k_rain_chance` stores a 0–1 probability (default .24); `k_rain_preset` stores random/sunny/overcast/drizzle/sunshower/storm (default random). Missing/invalid settings use defaults, finite chance values are bounded, and 0 is preserved. Random chooses rainy presets only. Settings changes leave the current episode and battle-ID cache intact; preferences are read on new plan creation. `k_rain_weather` and the independent default-off `k_rain_puddles` are boolean origin settings, shared across accounts. Puddles require weather and active rain, ease on/off, and do not reroll the episode. `k_rain_volume` and `k_thunder_volume` store independent 0–1 multipliers in localStorage; they are separate from the boolean settings cache. Invalid/missing values fall back to 1; finite values are bounded to 0–1. Separate gain buses smoothly apply changes even to already scheduled thunder, without rerolling weather or restarting the rain loop. The runtime reads them on settings/storage events and its existing 200ms synchronization pass. `ki.rain-episodes.v1` stores at most 24 recent plans in sessionStorage; it contains battle IDs and timing, not account credentials.

`node tools/prepare/prepare-rain-weather.cjs ./main.js` prepares `src/generated/rain-weather.json` from an unmodified local game bundle. The **ki-rain-v2** AST contract retains two renderer callbacks: after native SkyBox and before SpritesOnTop/HUD. The current prepared plan validates map collision capture, hull setup/interpolation, guarded LightingBlock upload, battle-ID/theme metadata and four static foliage vertex paths plus native skybox, native fog-strength suppression and DropZones depth isolation (28 insertions, 57 evidence templates). Check scene.capabilities.map/lighting/tanks/environment/treeWind/skyTone/fogSuppression/dropZones and require all eight on the current bundle. It maps the camera, context and native fog fields. Both stages and exact hashes or validated structural templates are required; old single-stage v1 plans are rejected. Missing/ambiguous contracts skip weather instead of guessing a render target. Rebuild JavaScript after changing a plan.

The renderer restores the game's WebGL state, including VAO/array-buffer bindings for the lightning mesh, and disposes only its own resources. It uses five base shader programs, up to two lazily cached puddle quality programs, an optional collision-depth program and a bounded instanced splash program. Rain uses one instanced call and clouds are cached. A bolt mesh is generated/uploaded only when a new visible strike is encountered and rendered in one bounded instanced call. It does not patch global WebGL/RAF methods or read pixels back to the CPU. Depth copies, full-screen passes, shader compilation and overdraw still have a cost, particularly at high resolutions.

Validation includes schedule/lifecycle and independent volume-bus unit tests, native stage-order and prepared AST tests, and isolated Edge/WebGL2 checks of shader compilation, state restoration, fog, the 25,000-instance storm, full-width localized slider expansion/collapse/persistence, audio exit and live cleanup. Regression checks reproduce the former transition flicker, compare cached/fresh sky views after camera rotation, raise the camera by 5,000 units, supply pink fog and preserve transparent sprites. Framebuffer checks include eight depth-buffer variants, six normalized MSAA colour formats, nonzero viewport origins and four default-buffer alpha/antialias combinations. In particular, alpha:false with 4x MSAA must copy into RGB8 without GL_INVALID_OPERATION. Verify zero GL errors and preserved framebuffer, renderbuffer and viewport bindings. Offset MSAA viewports must skip depth-dependent passes with depthCopy.reason=msaa-viewport-offset; single-sample offsets must remain supported. Puddle checks change a visible wall from red to blue and require its reflection to change only on horizontal surfaces, preserve native GL bindings, release colour-copy resources when disabled, and skip unsupported HDR targets. Check the RU/EN puddle switch inside the expanded weather controls, its persistence/default-off state, and hiding/disabling without losing its saved value. Verify the quality slider is absent and High is always requested, including with a legacy Low preference. Keep the internal Low shader fallback for unsupported High programs. Browser checks cover both reflection shaders, animated High water, unchanged vertical walls and an injected High compilation failure that must fall back to Low while rain continues. Puddles use only flat, upward map collision faces. Ramp QA on 24- and 37-degree inclines must show zero continued puddle samples while the flat reference remains wet. Half-map collision membership checks require zero water on the noncolliding half, and floating object tops must stay unchanged. Surface materials are not classified and fluid wakes are absent. The current renderer revision is `native-fog-off-v13`. Surface parameters are validated by tuning.ts; existing k_rain_surface_tuning_v1 values remain readable. The former rain developer panel, its opening hotkey and authoring/export API are removed. Verify that Ctrl+Alt+W is not intercepted and that the rain panel cannot open; ordinary weather controls must still work. Map capture schedules bounded one-off preparation during loading. GPU checks compare real ring-field spatial transitions, density and equivalent time/speed values. Check the supplied 15/1/8/0.7 and 16/8/2 surface defaults; four reflection parameters; six splash parameters; and shared precipitation intensity. Zero reflection strength must remove object reflections. Zero precipitation must stop rain audio/droplets. Preserve native dynamic/emissive colour by skipping late screen grading. Unit tests verify scoped ambient/sun attenuation and restoration and exactly one native upload even on observer/native errors. Splash tests cover stationary hull hits, transformed collision faces, roof occlusion, puddles-off operation, missing geometry, world-fixed birth positions, expiry and the 1,024 cap. Bright/dark patterned ground fixtures check both qualities with RGBA16F and RGBA8 cloud atlases: shallow water must remain visible without crushing the underlying texture into black. The relative 72% ground-luminance floor complements bounded dielectric reflection and ground-based refraction fallback; it must not introduce an absolute brightness floor on dark maps. A floating top-surface fixture checks that no back-facing top texture is reflected from underneath; visible front walls must retain reflections. Distant ground samples beyond the former 90-metre cutoff must remain wet, with the new 300-metre fade limit. Test roofs, tank tops, stairs, ramps, floating supply boxes, moving-camera disocclusions and screen-edge misses in the live game. The browser scene is synthetic. Actual game appearance, compatibility with its framebuffer configuration and FPS on a player's GPU require a live-game check; no FPS improvement or zero-cost claim follows from these tests.

<a id="electron-client-maintenance"></a>

## Electron Client Deployment and Verification

<a id="electron-loader-qa"></a>

### Game Loader Compatibility Checks

Client 1.0.8 installs `installKiGameGate()` in its main process after the selected KI extension loads and before game navigation. Electron 44.8.0 does not apply this extension's MV3 static redirect on its own: the isolated no-client-gate regression deliberately reproduces `native / network-gate-unavailable`. The native gate uses the loaded extension ID and its `dist/kasp_game_gate.js`. An extension update cannot supply a missing main-process API to older clients. Do not restore a DOM-removal/replay workaround or loosen context isolation, CSP or node integration.

Inspect the client's `[KI Game Gate]` log entries. `Missing packaged gate` means the selected extension directory is incomplete or old; `Not active` means interception was not installed. Updating a different unpacked copy does not repair the selected store copy. `Enabled` should precede `Redirect requested script/xhr`. A `running` loader state with `entered: true` and `nativeFallback: false` confirms controlled execution. A successful native load event confirms neither patch installation nor game-server connectivity.

Run the separate-profile Electron suite against the same runtime and gate implementation as the client:

```powershell
$env:KI_ELECTRON_PATH = 'C:/Tanki Online with KI/node_modules/electron/dist/electron.exe'
$env:KI_CLIENT_ROOT = 'C:/Tanki Online with KI'
npm run test:electron
$env:KI_CLIENT_SOURCE = "$env:KI_CLIENT_ROOT/src/main.ts"
npm run test:client
```

`tools/electron/game-loader.cjs` loads the complete unpacked extension, compiles the client's actual gate and tests missing-gate behavior, single startup, NetworkFirst cold/warm responses and an old native cached bundle. Its fixtures use local Tanki-shaped hosts. `tools/electron/run-browser.cjs` reuses the existing settings, Friends, trophy, DOM-lifetime and weather assertions in a real Electron renderer. Test windows are hidden or fully transparent and cannot take focus; profiles and diagnostics go under ignored `artifacts/qa/`. Playwright is resolved through the shared browser runtime helper. The suite does not install Electron into the extension or change the installed client/profile.

On October 29, 2026 the Electron 44.8.0 fixtures passed, including weather WebGL state restoration/zero GL errors and 300 DOM lifecycle cycles. A separate anonymous check of the public Tanki start screen reached patched `running` on first navigation and reload. Authenticated battles, hardware-specific behavior and other Electron versions still require separate verification. The installed client 1.0.8 already contains the native gate; no client source change was needed for these checks.

Release packaging validates required runtime files both before replacing existing output and after copying it. Keep `dist/kasp_game_gate.js`, its web-accessible declaration and the enabled rule together; tests in `tools/tests/core/release-runtime.test.cjs` reject incomplete builds.

Reference file names in this section are relative to `tools/client/discord/` in the extension source checkout. The bridge contract and configuration are documented in [DOCUMENTATION.md](DOCUMENTATION.md#electron-client-integration).

<a id="electron-client-maintenance-build-and-run"></a>

### Build and run

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

<a id="electron-client-maintenance-verification"></a>

### Verification

From the extension repository:

```powershell
npx tsc --project tools/client/discord/tsconfig.json
node --test tools/tests/client/discord-presence.test.cjs
```

The local `tsconfig.json` and `preload-electron.d.ts` let the editor check the preload template without installing Electron in the extension repository. The declaration covers only the IPC method this template uses; it supplies no runtime implementation. Keep these two files here when copying `preload.ts` into the client, where Electron's own type declarations validate it.

Tests use a simulated Discord socket to verify validation, handshake, partial messages, ping/pong, activity changes, reconnect and cleanup. They do not confirm acceptance by a real Discord account or the configured application; that requires running the rebuilt client with Discord open.

<a id="electron-client-maintenance-deployment-and-recovery-checklist"></a>

### Deployment and Recovery Checklist

1. Keep the client and extension repositories distinct. Compile the client's preload/main modules in the client, and the extension's IIFEs in the extension.
2. Verify that the configured Application ID is present in the packaged client, without adding a token or Client Secret.
3. Check the logged store-managed KI path/version and skipped duplicates. A local/keyless KI copy must not override the managed copy; older clients need the updated loader.
4. Close the running client before replacing extension files. Relaunch it and fully reload the game so old MAIN hooks do not remain active.
5. Verify lobby/session time, a timed battle, map/mode, party capacity, nickname privacy, minimize/restore, Discord reconnect and clear-on-close.
6. Inspect extension-side capture errors separately from preload validation, main-process IPC acceptance and Discord socket failures.
7. Back up local battle history before moving profiles or reinstalling a host. The preload bridge does not synchronize extension web storage between clients.

The reference socket tests and local type declarations validate the bundled bridge's contracts. They cannot prove the target host's packaging paths, installed extension selection, operating-system IPC availability or Discord activity settings. Record these separately in a support report.

<a id="electron-client-maintenance-related-documentation"></a>

### Related Documentation

- [Extension overview and installation](README.md)
- [Full technical reference](DOCUMENTATION.md)
- [Manual maintenance and failure isolation](MAINTENANCE.md)
- [User FAQ](README.md#faq)
- [License and Terms of Use](LICENSE.txt)

Reference reviewed with extension **3.0.5** on **October 24, 2026**. These instructions are part of the root guides; the reference files in tools/client/discord/ are not an automatically installed companion executable.

<a id="documentation-publication"></a>

## Documentation Distribution and Publication

Extension **3.0.5** · Source review **October 24, 2026**

| Reference / section | Purpose | Language |
| --- | --- | --- |
| [Project README](README.md) | Installation, configuration, complete feature overview and final credits | English |
| [Technical reference](DOCUMENTATION.md) | Architecture, source contracts, native mappings, state and build workflow | English |
| [Maintenance guide](MAINTENANCE.md) | Failure isolation, diagnostics, regression and release checklists | English |
| [FAQ](README.md#faq) | 74 questions covering actual shipped behavior and limitations | English |
| [Random battle weather](DOCUMENTATION.md#weather-reference) | Scheduling, rain/thunder volume controls, rendering, fog and validation limits | English |
| [User guide](README.md#russian-user-guide) | Player instructions, settings, privacy, battle/history workflows and recovery | Russian |
| [Publication description](README.md#english-publication-description) | Full public feature copy with current credits at the end | English |
| [Описание для публикации](README.md#russian-publication-description) | Полное описание функций с благодарностями в конце | Russian |
| [Kill-feed investigation](DOCUMENTATION.md#kill-feed-rendering-investigation) | Specific verified render chain and font-safety regression | Russian |
| [License and Terms of Use](LICENSE.txt) | Proprietary international edition with retained Tanki Tweaks permission | English |
| [Discord client integration](DOCUMENTATION.md#electron-client-integration) | Companion preload/main-process contract; deployment and verification are in this maintenance guide | English |

<a id="documentation-publication-which-copy-changes-when"></a>

### Which Copy Changes When?

- The three root guides describe the reviewed source tree.
- Release packaging copies the three root guides and license; an old ZIP keeps its old contents until rebuilt.
- The client integration reference is split between DOCUMENTATION.md and MAINTENANCE.md. The reference source files remain under tools/client/discord/ and are not runtime packaging inputs.
- Google Drive License/FAQ links in settings point to separately published documents. Local Markdown edits do not replace their remote content.
- The README publication sections are publication drafts. They do not automatically update a store listing.
- `_locales/en/messages.json` and `_locales/ru/messages.json` supply short browser metadata. They are separate from the full descriptions and the in-game dictionaries.

Source code is authoritative for behavior. Declared support, unit/fixture checks and real-game verification are separate kinds of evidence. Do not turn diagnostic experiments into advertised features without a corresponding implementation.

Weather edge/wind regression: both qualities must leave the inner open-edge inset dry and preserve same-height joins; distant water must match the no-inset reference away from edges. `tools/validation/weather-tree-shaders.cjs` reads native GLSL assembly without executing the game. Browser QA compiles four tree paths with feature flags on/off and uses transform feedback to verify the unchanged foliage coordinates at different times (both native breeze and custom bending disabled). Check day/night cloud tone, dark near-wall reflections, battle-ID isolation and SPACE preview rejection. Verify `status().environment.theme` on direct matchmaking entry; missing metadata stays visible in diagnostics.

Prepare rain plans from a downloaded, unmodified UTF-8 bundle: the inspected hand-formatted main.js had mojibake in GLSL comments, so its strict shader-source templates did not match production main.289a5d50.js. The production source is now separately prepared and validated. Use `node tools/validation/rain-bundle.cjs artifacts/native/main.289a5d50.js` for an available local production copy. Loader patch status and distinct preview failure codes must remain visible. WebGL-only presence requires native evidence and must stop when its canvas disconnects.

Weather v8 regression: test the full 2m dry inset at drops/voids, a retained lower puddle against an 8m static wall, continuous same-height joins and no water on the upper brink. Full static collision support depth closes banks but never authorizes water; the horizontal collision mask remains separate. Positive inset adds one owned depth pass/target on texture unit 11; preserve its texture/sampler bindings along with units 12–15, and release both collision meshes on cleanup. GPU refraction tests switch a foreground object red/blue with SSR disabled: no colour difference may leak outside its silhouette, and the object must stay native. Repeat in the live game with the gun during camera/turret motion. Native skybox GLSL compiles with fog off/on, zero uniform preserves colour, storm darkens and clearing restores it. All foliage vertices must remain stationary as time changes; native transforms and UVs remain intact. Massacre map metadata must suppress puddles only, keep the preference and restore eligibility on the next map. Default surface profile now includes edgeInset=200, ringStrength=0.7, wavelengths/16, reflections=2/12000/1, refraction=2 and splash density/speed=4, size=.25, lifetime=1.5, gravity=3. Existing stored tuning takes precedence; no chance/preset override is imposed. Storm schedules now use 8–18s first delay, 20–35s gaps and a seven-strike cap.

Weather fog rollback: direct backdrop material grading stays removed. fogSuppression observes both common native Fog binders and the SkyBox fog upload; only numeric strength/alpha is overridden, not RGB, distance, graphics settings or shaders. Verify all eight capabilities, 28 edits / 57 evidence templates. Drop-zone depth isolation, frozen foliage, original native dynamic lighting and organic shore edges remain intact.






Rain-only fog suppression (2026-10-25): remove standalone atmosphere/light settings, volumeFog.ts/atmosphere.ts, dynamic light shader/binding callbacks and associated UI/tuner/export fields. Suppress only native fog cap/sky alpha, normalized for every rainy preset; dry presets and zero shared precipitation preserve native fog. Restore automatically on clearing, disable, SPACE and exit without changing persisted game graphics. Keep native zero strength zero, preserve argument evaluation and native errors, and test all three native upload sites. Scoped ambient/sun attenuation now caps at .78; skybox darkness caps at .82. Native dynamic/emissive lights are not patched. Restore the pre-fog 25,000-instance rain budget. Require compact-bundle adaptation, zero WebGL errors and the original native fog pixel result after rain ends.

Weather duration regression (2026-10-25): check localized full-width duration default 30%, 0/50/100% persistence, disabled/collapsed controls, bounded malformed preferences and next-plan-only application. Fractional episodes must fit inside the observed remaining battle with a total envelope equal to the selected share; short transitions scale without NaNs. Full-battle plans start at observation, survive more than ten minutes and cache validation/re-entry, and end on battle exit. Chance remains separate. Puddles request High regardless of legacy quality storage. The native timer fallback for fractional plans remains ten minutes.

Weather continuity (2026-10-27): one runtime episode belongs to the native battle ID, not individual render scenes. Before a native map title or winter/space theme arrives no plan is generated. Missing optional lobby theme does not block ordinary-map rain. Once identified, secondary/loading canvases share the same seed, preset, start and fade. A different known ID selects its own matching cached/new episode. Verify full-battle precipitation beyond ten minutes across two contexts, late metadata, garage suspension/re-entry and migration of incompatible legacy precipitation.

Snow regression (2026-10-27): test automatic native-theme selection, missing-lobby-theme rain fallback, seasonal native-map title markers, nonwinter Massacre and SPACE exclusion, and legacy manual-mode preferences being ignored. Preserve one matching cached episode on re-entry and replace incompatible legacy precipitation. Check five profiles, chance/duration boundaries, smooth transitions, 20,000 particles, blizzard crystals/ribbons, native occlusion and garage/exit cleanup. Snow must never warm/draw puddles, reflections, spray, rain audio or thunder, even with the rain puddle preference enabled. Browser QA writes snow.png in artifacts/qa/rain-weather; this is synthetic WebGL coverage, not live-map or FPS verification.

Blizzard motion (2026-10-26): 20,000 maximum flakes. Strong wind alone scales mean horizontal drift by 8 and fall speed by 1.8; bounded local flutter and faster tumbling distinguish a blizzard. Shared gusts use integrated sinusoidal displacement, not time multiplied by a changing velocity. The original calm/sunlit motion remains unchanged below the blizzard wind threshold.

Dense-blizzard QA: require 4,000 crystal plus 16,000 ribbon instances at full strength, exactly 144,000 particle vertices, correct native occlusion, fade-out and no liquid/rain side effects. Check strong bounded GPU advection, native state restoration and fixed hash-ID partitions while density changes. Keep light/sunlit profiles on crystal rendering. The reduction in vertex count does not imply a hardware-independent FPS benefit; inspect overdraw and actual game appearance.

Archived snow experiments (2026-10-27): original snowdrifts, all developer-panel/tuning code, integration and AST snapshots, and their dedicated tests live in `archive/snowdrifts-and-snow-tuner-2026-10-27/`. Do not import or package them. The active weather AST plan has 28 edits / 57 evidence templates, without the snowbank-only chassis getter observer. Keep the three active snow files (profiles, shaders, exports). Verify no snowbank setting, manual precipitation selector, tuner panel, Ctrl+Alt+S listener, `__kaspSnow`, compression atlas or bank mesh enters either production bundle. Existing origin storage may retain ignored legacy keys; do not interpret them as feature activation.
