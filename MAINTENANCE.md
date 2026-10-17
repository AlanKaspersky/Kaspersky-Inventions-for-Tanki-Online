# Failure isolation and manual maintenance

Source reference: 2.9.6, October 17, 2026. This guide can be followed without AI.

## What stops, and when

Each feature owns an independent scope in `src/core/featureRuntime.ts`. A scope guards updates, event callbacks, timers, animation frames, microtasks, and mutation observers. The module registry guards each entry separately; one throwing entry does not skip the next feature. Module initialization has an inert fallback and disposes partially registered resources if construction throws.

Three exceptions in a rolling ten-second window disable that scope for the page session. Successful calls between those errors do not hide a recurring failure. Five consecutive synchronous calls exceeding the scope budget also disable it: the default is 16 ms, and the two native HUD indicators use 4 ms. These are conservative limits, not performance guarantees. Measurements cover synchronous execution, not time awaiting a network response.

Disabling is idempotent. Cleanup runs in reverse registration order; one failed cleanup does not prevent the others. Pending scoped callbacks become inert. Tracked timer cancellation releases its registry entry; expired timeouts/frames and once listeners also release theirs. Detached element listeners are pruned after a grace period when new listeners are added. A scope permits at most 4096 tracked listeners. Native indicator ownership is limited to 32 components.

JavaScript cannot interrupt a synchronous callback that never returns. The budget stops later calls only after the current call returns. A promise or an already submitted game action/database transaction is not undone by disabling its feature. Global manifest styles are not unloaded, and already inserted game call sites remain until a full page reload. These boundaries must not be described as complete rollback of the whole client.

## Controls and diagnostics

Run `npm run check` for local strict type checking and all regression tests. Release/ZIP commands require these checks; no GitHub Actions workflow is installed. Source contracts keep native TypeScript selectors/classes in `src/core/gameDOM.ts` and reject explicit `any`. Check related static CSS separately. The shared `src/core/pageMessages.ts` bridge validates window/origin and message schemas, but cannot authenticate another script on the same page. Trophy panels create DOM nodes with literal text and validated game artwork. Garage skin observations still run every 250 ms; bounded parsed-storage and CSS caches avoid repeated work without skipping mounted-skin observations.

The settings panel contains **Arcade reload indicator** (`k_arcade_reload`) and **Critical shot indicator** (`k_critical_indicator`). Both default to enabled to retain existing behavior. Their switches take effect without closing settings or reloading the game. Turning a healthy indicator back on allows its existing hooks to resume; the critical cycle waits for fresh native readiness/lifecycle evidence when necessary. A feature quarantined after errors or budget overruns requires a page reload.

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
| Esports | Releases parameter locks, pending rank work, map filters, and the additional format card. It does not undo a battle creation request. |
| Battle history | Invalidates pending views, releases navigation observers, and removes extension overlays/entry. Committed records are preserved. |
| Change Counter/resistance display | Removes added columns, summaries and controls; shared static layout CSS remains loaded. |
| Equipment tracker | Clears its transient captured-equipment cache; other functions may display empty equipment artwork. |
| Discord presence | Stops owned callbacks and requests clearing the extension-provided activity through the client bridge. |

Cleanup failure is visible as `cleanupErrors`. It is not a successful restoration guarantee. A full game reload is the recovery path when native presentation cannot be restored safely.

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
