# BUGS.md — VEILKEEP QA / Autoplay / Visual Verification Tracker

**Repository:** `findthewizard` (VEILKEEP)
**Phases:** 1 — repository audit · `window.__veilkeep` hook surface · static graph/manifest validation · boot hygiene
2 — deterministic full-game autoplay bot (`window.__veilkeep.autoplay`), hands-free on Web and Android
**Platforms in scope:** Web (Three.js / WebGL2 desktop) · Android (mobile viewport, touch, Capacitor WebView)
**Baseline commit:** `f65b9fc` — every fix below is an uncommitted working-tree change
**Last updated:** 2026-10-24

---

## Status legend

| Status | Meaning |
| --- | --- |
| `OPEN` | Confirmed, not yet worked |
| `IN_PROGRESS` | Being fixed |
| `FIXED` | Fix written, awaiting independent verification |
| `VERIFIED` | Fix proven by an automated or manual test |

## Verification commands

| Command | Proves |
| --- | --- |
| `npm run validate:world` | Manifest integrity, door-graph symmetry, lock-and-key reachability, asset existence |
| `npm test` | 42 unit tests (world manifest, data integrity, auto-battler campaign, autoplay controller) |
| `npm run build` | `tsc` type-check + production bundle |
| `npm run e2e:boot` | Clean boot: title → New Game → 21-scene tour, zero console errors, zero failed requests |
| `npm run e2e:qa` | Full `window.__veilkeep` contract (hooks, diagnostics shape, loadScene, convictions, error capture) |
| `npm run e2e` | 50-scene / 61-task auto-battler end-to-end autoplay |
| `npm run e2e:autoplay` | Hands-free `?autoplay=1&speed=4` run: S00 → all 50 rooms → all endings, zero watchdog P1s |
| `npm run e2e:autoplay:mobile` | Same bot on a 390×844 touch viewport (Android WebView emulation): MVP chain, tappable HUD, zero P1s |

## Phase-1 evidence

| Check | Result |
| --- | --- |
| Static validator | `P0=0 P1=0 P2=29 P3=27` — exit code 0 |
| Runtime door graph | 50 scenes, 108 doors, **50/50 reachable from S00**, no blocked gates |
| Manifest graph | 50 scenes, 95 exits, 3/50 reachable (stale design manifest — see `VK-P2-001`) |
| Assets | 27 textures, 50 GLB models, 14 audio tracks — **0 missing** after fixes |
| TypeScript / build | `tsc` clean, `vite build` succeeds |
| Boot smoke | title screen → origin select → S00 → 21-scene tour, **0 console errors, 0 failed requests**, 37 draw calls / 24 330 tris / 60 fps |
| Unit tests | 22/22 passed |
| Hook contract | 10/10 assertions passed |

---

## P0 — Blocker

**Open P0: 0.** No boot blocker remains. Both entries below were raised and closed inside Phase 1.

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VK-P0-001 | P0 Blocker | Both | AG1 → MH1 (`PUZZLE_ARBOREAL_WEAVE`) | Validator reported a hard softlock: the AG1→MH1 gate requires `PUZZLE_ARBOREAL_WEAVE`, which the validator claimed no scene grants. Root cause was tooling — `Campaign.ts` awards that token through `grantsAny` (either/or reward from Yggdra), which the validator ignored. Runtime was never softlocked. | 1. `npm run validate:world` on the pre-fix validator.<br>2. Observe `P0 [softlock] AG1 -> MH1 needs PUZZLE_ARBOREAL_WEAVE, which no scene grants`. | FIXED | `threejs/scripts/validate-world.mjs` (`tokenSourcesFromCampaign` now folds in `grantsAny`) |
| VK-P0-002 | P0 Blocker | Both | MH1, SAN1, CO1, CO3 | Same root cause as `VK-P0-001`: four scenes reported unreachable from S00 because the `ABILITY_STARLIGHT_DASH` / `PUZZLE_ARBOREAL_WEAVE` grants were invisible to the reachability sweep. After the fix the runtime graph is 50/50 reachable with zero blocked gates. | 1. `npm run validate:world`.<br>2. Observe `P0 [softlock] MH1: unreachable from S00 even with every obtainable token` (and SAN1, CO1, CO3). | FIXED | `threejs/scripts/validate-world.mjs` |

---

## P1 — Critical

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VK-P1-001 | P1 Critical | Both | BT1, RG1–RG4, AL1–AL3, PB1–PB4 (zone music) | `AudioManager` referenced two audio files that do not exist in `public/audio/`: `/audio/lonely_mournful_tune.ogg` (BT1) and `/audio/the_field_of_dreams.mp3` (several zones). Every visit produced an unhandled `AudioLoader` 404 and silenced the room. | 1. Boot and start a new game.<br>2. `window.__veilkeep.loadScene('BT1')`.<br>3. DevTools Network shows `404 /audio/lonely_mournful_tune.ogg`; console shows a failed-resource error; no music plays. | FIXED | `threejs/src/core/AudioManager.ts` — BT1 remapped to `apparitions_ball_piano.ogg`, `the_field_of_dreams.mp3` remapped to `snowfall_loop.ogg`, plus `FALLBACK_TRACK` and a `loadTrack()` error path that warns once per URL and degrades to the fallback instead of throwing |
| VK-P1-002 | P1 Critical | Both | All scenes / test harness | `window.__veilkeep` did not expose the contract required for automated QA: `renderer`, `camera`, `player`, `questLog`, `convictions` and `getDiagnostics()` were all absent, so no harness could assert render health, quest progress or runtime errors. | 1. Boot the game.<br>2. In DevTools run `window.__veilkeep.getDiagnostics()`.<br>3. Throws `TypeError: getDiagnostics is not a function`; `window.__veilkeep.renderer` is `undefined`. | FIXED | `threejs/src/main.ts` (`__veilkeep` block) — `scene` (id string), `sceneId`, `sceneName`, `threeScene`, `renderer`, `camera`, `player`, `questLog`, `convictions`, `awardConviction()`, `loadScene()`, `getDiagnostics()` |
| VK-P1-003 | P1 Critical | Both | Any scene via `loadScene()` | `loadScene(id, spawn)` was unguarded: an unknown scene id left the engine with `activeGroup` removed, colliders cleared and `currentSceneId` pointing at a non-existent room (half-loaded, unrecoverable). It also required a *complete* `Spawn`, so a harness could not override a single axis. | 1. Boot the game.<br>2. `window.__veilkeep.loadScene('NOT_A_SCENE')`.<br>3. Engine tears down the current room before failing; player is stranded and `currentSceneId` is corrupted. | FIXED | `threejs/src/main.ts` (`loadScene`) — validates against `sceneById`, returns `false` and leaves state untouched on unknown ids; accepts `Partial<Spawn>` merged over the manifest spawn; returns `boolean` |
| VK-P1-004 | P1 Critical | Both | All scenes / test harness | Runtime failures were invisible to automation. `getDiagnostics().consoleErrors` had no backing store, so a harness could only see errors it happened to attach a listener for, and errors thrown before the listener attached were lost. | 1. Boot the game.<br>2. `console.error('probe')`.<br>3. Nothing records it; no API can read it back. | FIXED | `threejs/src/main.ts` — `runtimeErrors` ring buffer (cap 50), `console.error` wrapper, `window.error` and `unhandledrejection` listeners installed before boot; surfaced as `getDiagnostics().consoleErrors` |
| VK-P1-005 | P1 Critical | Both | Quest Log / HUD / diagnostics | Quest state had three divergent sources: the journal modal built an inline hardcoded objective array, the HUD tracked its own counters, and diagnostics had nothing. Progress shown in the journal could disagree with the actual save state. | 1. Boot and open the Quest Log (`J`).<br>2. Compare an objective's state with `solvedPuzzles` / `inventory`.<br>3. Objectives are literals with no relation to the shared state, and no single API reports them. | FIXED | `threejs/src/main.ts` — single `questObjectives()` table (28 unique ids) now drives the journal UI, the HUD and `questLog`; `questLog.active` / `completed` / `percent` / `isComplete()` derive from it |

---

## P2 — Visual/UX

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VK-P2-001 | P2 Visual/UX | Both | Global — `world_manifest.json` vs `doorGraph.ts` | The design manifest has drifted far from the runtime door graph. 47/50 manifest scenes are unreachable from S00, 14 exits are asymmetric (`S00→GH4`, `GH2→SQ1`, `SQ1→GH1`, `HM1→GH3`, `SAN1→S00`, `CO1→MH1`, `U1/TR1/AT1/AL1/PB1/RG1/VR1/RS1→OW1`), 12 one-way shortcuts have no return path, and `RC1` / `BT1` declare no exits at all. Runtime is unaffected because `doorGraph.ts` is authoritative, but any tool reading the manifest (map screen, minimap, future exporters) will show a broken fortress. | 1. `npm run validate:world`.<br>2. Read the `manifest-symmetry` and `manifest-graph` sections: `reachable from S00: 3/50`. | OPEN | `threejs/src/data/world_manifest.json` (data debt — runtime source of truth is `threejs/src/data/doorGraph.ts`) |
| VK-P2-002 | P2 Visual/UX | Android | Global — packaging | The GDD targets Android via Capacitor/WebView, but the repository contains no Capacitor config, no `android/` project, no `AndroidManifest.xml`, no Gradle files and no APK/AAB output. The game currently exists only as a web build; Android QA has to run through browser device emulation, which cannot reproduce WebView-specific behaviour (touch latency, back-button handling, audio unlock, safe-area insets). | 1. `Get-ChildItem -Recurse -Depth 3 -Include capacitor.config.*,AndroidManifest.xml,build.gradle`.<br>2. Zero results outside `gdd/`. | OPEN | — (no packaging present) |
| VK-P2-003 | P2 Visual/UX | Both | `S00→GH4`, `OW1→B1`, `GH1→GH2`, `GH1→GH4` | Four manifest gates require tokens the manifest never defines as obtainable anywhere: `STAT_AGI_11`, `ITEM_BARRACKS_POSTERN_KEY`, `ORIN_RESOLVED_OR_FAIL_FORWARD`, `SKILL_CLIMBING_2`. In the manifest these are permanent softlocks; the runtime graph satisfies all four through campaign grants. Design contract gap, not a runtime failure. | 1. `npm run validate:world`.<br>2. Read `P3 [manifest-graph] … blocked by …` entries. | OPEN | `threejs/src/data/world_manifest.json` |

---

## P3 — Minor

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VK-P3-001 | P3 Minor | Both | Boot / title screen | No favicon declared, so every page load requested `/favicon.ico` and logged `404` — two console errors per session (initial load + New Game reload). This polluted every console-clean assertion in automated runs. | 1. Boot the game.<br>2. DevTools console shows `Failed to load resource: 404` for `/favicon.ico`, twice. | FIXED | `threejs/index.html` — inline SVG data-URI `<link rel="icon">` in `<head>` |
| VK-P3-002 | P3 Minor | Both | `world_manifest.json` (all scenes) | 75 of 95 manifest exits have no `id`, so exits cannot be referenced by tests, analytics or the map UI. | 1. `npm run validate:world`.<br>2. Observe `P3 [manifest] 75/95 exits have no id`. | OPEN | `threejs/src/data/world_manifest.json` |
| VK-P3-003 | P3 Minor | Both | 22 doors across S00, OW1, GH1, SQ1, BT1, U4, TR4, AT3, AL3, PB1, PB4, RG1, RG4, VR1, VR3, RS1, RS6, CO3, SAN1 | 22 runtime doors have no direct return door. All are navigable — each returns via a different room in the loop — so this is a readability issue for the map screen, not a softlock. | 1. `npm run validate:world`.<br>2. Read the `doorGraph-symmetry` P3 list. | OPEN | `threejs/src/data/doorGraph.ts` |
| VK-P3-004 | P3 Minor | Both | BT1 — Aeolian Bell Tower | The journal listed the Bell Tower objective twice, so the quest log reported 29 objectives for 28 rooms and one entry could never complete independently. | 1. Boot and open the Quest Log (`J`).<br>2. Two rows reference the Bell Tower / Aeolian Baffles. | FIXED | `threejs/src/main.ts` (`questObjectives()` — one `Q_AEOLIAN_CHIME` entry) |
| VK-P3-005 | P3 Minor | Both | HM1 — Halls of Mirrors | The "Infiltrate the Halls of Mirrors" objective was evaluated as `currentSceneId === 'HM1'`, so it *un-completed itself* the moment the player left the room. Journal progress went backwards. | 1. Reach HM1, open the Quest Log — objective shows complete.<br>2. Leave to BQ1, reopen the Quest Log — objective is active again. | FIXED | `threejs/src/main.ts` — now `discoveredScenes.has('HM1')`, monotonic |
| VK-P3-006 | P3 Minor | Both | Test tooling | The e2e suites were not wired to npm; only the auto-battler run was reachable (`npm run e2e`), so the boot and hook suites were effectively invisible to anyone but the author. | 1. `npm run` in `threejs/`.<br>2. Only `e2e` is listed; `qa-hooks` and `boot` have no script. | FIXED | `threejs/package.json` — `validate:world`, `e2e:qa`, `e2e:boot` scripts added |
| VK-P3-007 | P3 Minor | Both | CI / test tooling | There is still no `playwright.config.ts` and no CI workflow running the e2e suites. Each suite is a standalone `node e2e/*.mjs` script that requires a manually started dev server on port 5199. | 1. `Get-ChildItem threejs -Filter playwright.config.*` — no results.<br>2. `.github/` contains no job that starts vite or runs Playwright. | OPEN | — |
| VK-P3-008 | P3 Minor | Both | BT1 / zone audio | Two zones lost their intended soundtrack because the referenced tracks never existed in the repo; they now fall back to `apparitions_ball_piano.ogg` and `snowfall_loop.ogg`. Audibly correct and stable, but the authored intent is unmet until the real tracks are added. | 1. Visit BT1 and listen.<br>2. `public/audio/` contains no mournful-tune or field-of-dreams track. | OPEN | `threejs/src/core/AudioManager.ts` (interim remap) |

---

## Phase-2 backlog (not yet started)

Queued for the Web + mobile-viewport visual and autoplay pass; not logged as defects until observed.

- Visual verification of all 50 scenes at desktop (1280×800) and mobile (390×844) viewports — geometry, lighting, fog, HUD occlusion, camera framing.
- Touch input: virtual stick, spell wheel swipe, action buttons, tap-to-interact radius under a finger.
- Safe-area insets and notch handling on a mobile viewport.
- Auto-battler full-traversal autoplay recorded at mobile viewport with frame-time sampling.
- Performance budget check on a throttled mobile profile (draw calls, triangles, texture memory, fps floor).
- WebGL context-loss and resume behaviour.

---

## Phase 2 — deterministic full-game autoplay

**Phase:** 2 — `AutoplayController` (`window.__veilkeep.autoplay`), HUD toggle, `?autoplay=1&speed=4`, headless Web + Android-emulation runs.
**Scope:** the bot must play S00 → all endings, on Web and Android, with zero human input.

### Deliverables

| Surface | Where |
| --- | --- |
| `window.__veilkeep.autoplay` | `threejs/src/systems/AutoplayController.ts` (logic) + `threejs/src/main.ts` (`autoplayHost` adapter) |
| `start/stop/pause/resume/stepToScene/solveCurrentRoom/getStatus/bugsFound` | `AutoplayController` |
| Rapier capsule sweep for gated ledges/chasms | `RapierPhysics.probeClearance()` in `threejs/src/physics/PhysicsWorld.ts` |
| HUD toggle `🤖 Autoplay` | `threejs/index.html` (`#autoplay-toggle`) |
| URL boot `?autoplay=1&speed=4&mode=mvp_slice` | `main.ts` `startAutoplayFromQuery()` |
| Headless Web run | `threejs/e2e/autoplay.spec.mjs` |
| Headless Android-emulation run | `threejs/e2e/autoplay-mobile.spec.mjs` |
| Unit coverage (20 tests) | `threejs/tests/autoplay.test.ts` |

### Defects found during Phase 2

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VK-P1-NAV-001 | P1 Critical | Both | OW1 | Autoplay deadlocked in the Outer Ward: the controller navigated toward a goal but never recorded the room as visited, so the goal never advanced. The bot stood still at `(1.27, 0.57, -1.12)` and the run could never leave OW1. | 1. Boot `?autoplay=1&speed=4`.<br>2. Let the bot cross S00 → OW1.<br>3. Observe `getStatus().visitedScenes` stuck at `["S00"]` while the scene id is `OW1`. | FIXED | `threejs/src/systems/AutoplayController.ts (markVisited each tick), threejs/src/main.ts (host adapter)` |
| VK-P1-NAV-002 | P1 Critical | Both | GH2 (`PUZ_GH2_MIRROR_LOCK`) | Task `radius` is an interaction radius (1.9 m at the mirror), but the controller used it as the arrival tolerance. The bot stopped 1.3 m short of the mirror lock, pressed interact, and the puzzle never fired — a hard softlock in GH2. | 1. `?autoplay=1&speed=4`.<br>2. Reach GH2 with `ITEM_IRON_NAIL`.<br>3. Observe goal `gh2:mirror` never resolving and `PUZZLE_MIRROR_LOCK` never entering `solvedPuzzles`. | FIXED | `threejs/src/systems/AutoplayController.ts — arrival uses a fixed 0.6 m tolerance, matching the proven legacy auto-battler` |
| VK-P1-NAV-003 | P1 Critical | Both | All rooms (after any watchdog nudge) | The stuck-recovery nudge never expired under the autoplay controller: `autoNudgeTimer` was decremented only inside the legacy `autoTick`, which the controller replaces. A single watchdog trip therefore rotated the movement vector 90° for the rest of the run, and the bot orbited room perimeters forever (observed lapping B1 and OW1 at 8x, crossing doors back and forth). | 1. Boot `?autoplay=1&speed=8&mode=pacifist_shadowhand`.<br>2. Let the capsule stall once so the watchdog files a P1.<br>3. Observe `navigate()` still returning false while the position traces the room walls in a loop. | FIXED | `threejs/src/main.ts` — nudge is now a wall-clock deadline (`autoNudgeUntil`) checked in `autoNavigate`, so it expires with or without `autoTick` |
| VK-P1-NAV-004 | P1 Critical | Both | OW1 (path to `ITEM_IRON_NAIL`) | The capsule halts at `(0.814, 0.609, 0.780)` on the way to the Iron Nail. `findPath` reports a route and `probeClearance` reports clear at chest height, yet `physics.movePlayer` returns the same position for 90+ ticks. The blocking geometry therefore sits below the chest rays and outside the A* walking band (`autoObstacles()` drops boxes whose top is at or under 0.35 m). The watchdog files the P1 and the nudge breaks the stall, so the run completes — but the room shell or the obstacle band should be corrected. | 1. Boot `?autoplay=1&speed=8&mode=pacifist_shadowhand`.<br>2. Reach OW1.<br>3. The bot stalls at the coordinates above, `getStatus().stuckTicks` reaches 90, and a P1 appears in `bugsFound`. | OPEN | `threejs/src/main.ts` (`autoObstacles` y-band) / OW1 room shell |
| VK-P2-101 | P2 Visual/UX | Both | All (HUD) | The new `🤖 Autoplay` HUD button sat inside the `.hud-layer` element, which sets `pointer-events: none`. Clicks fell through to `#game-canvas`, so the button was visible but dead on desktop and untappable on Android. Playwright reported `<canvas> intercepts pointer events` on every retry. | 1. Load the game.<br>2. Click `#autoplay-toggle`.<br>3. Observe nothing happens and `document.elementFromPoint` returns the canvas. | FIXED | `threejs/index.html — .autoplay-toggle { pointer-events: auto; z-index: 30; }` |
| VK-P2-102 | P2 Visual/UX | Both | All (autoplay speed) | `speedMultiplier` only scaled the `physics.movePlayer` term. Because a run is dominated by fixed per-task interaction cadence (interact every 0.55 s, attack every 0.42 s, dialogue turn delay), `?autoplay=1&speed=4` finished within ~5% of a 1x run, so the query parameter looked broken. | 1. Time `?autoplay=1&speed=1` and `?autoplay=1&speed=4`.<br>2. Observe near-identical wall-clock durations. | FIXED | `threejs/src/systems/AutoplayController.ts — action and dialogue timers now consume dt * speedMultiplier` |
| VK-P2-103 | P2 Visual/UX | Both | SAN1 → finale | After the bot reached the finale, `start()` was a silent no-op: the ending modal (`#hud-ending-modal`) stayed open and the first tick immediately called `finish()` again. The HUD `🤖 Autoplay` button therefore could not restart a run without a page reload. | 1. Let an autoplay run finish.<br>2. Click `#autoplay-toggle` twice (stop, then start).<br>3. Observe the button flips back to stopped and the modal stays up. | FIXED | `threejs/src/systems/AutoplayController.ts (closeEnding on start), threejs/src/main.ts (host implementation)` |
| VK-P2-104 | P2 Visual/UX | Both | SAN1 (`san1:cynthia`) | `pacifist_shadowhand` cannot reach an ending: the final task `san1:cynthia` never resolves while Archillusionist Vaelor is alive, so a no-kill run ends in the throne room with 50/50 rooms visited and no finale. This is a design gate — the ending requires defeating Vaelor — rather than a navigation failure; the lethal `full_campaign` run reaches all four endings. | 1. Boot `?autoplay=1&speed=8&mode=pacifist_shadowhand`.<br>2. Let the bot traverse to SAN1.<br>3. Observe goal `san1:cynthia` with `finished === false` after the map is complete. | OPEN | Design: `threejs/src/autobattler/Campaign.ts` (`san1:cynthia`), `threejs/src/main.ts` (SAN1 ending gate) |

Six of these were found by the hands-free run itself and are covered by a regression test:
`VK-P1-NAV-001`/`002` by the full-campaign e2e, `VK-P1-NAV-003` by the ghost-mode e2e (the nudge bug only surfaced once a stall happened), `VK-P2-101`/`103` by the HUD-toggle assertions in both e2e specs, and `VK-P2-102` by the scaled-timer assertions in `tests/autoplay.test.ts`. `VK-P1-NAV-004` stays OPEN: it is self-healing at runtime, so it does not block a hands-free completion.

### Coverage notes

**Brief identifiers vs. this build.** Several identifiers named in the Phase-2 brief do not exist verbatim in this repository. The game names its puzzles `PUZZLE_*` and schedules them through `SCENE_PLANS`, so the bot solves the real tokens instead of a parallel re-implementation:

| Brief identifier | Status here | What the bot drives instead |
| --- | --- | --- |
| `PUZ_S00_BRAMBLES` | not present | S00 has a single task (the Sable dialogue); the bramble road is narrative lore text, not a puzzle token |
| `PUZ_38_PANOPTICON_GAZE` | not present | no Panopticon room exists in the 50-scene door graph |
| `PUZ_GH2_MIRROR_LOCK` | present as `PUZZLE_MIRROR_LOCK` | task `gh2:mirror` (this is the softlock fixed as `VK-P1-NAV-002`) |
| `OPTICAL_BEACON` | not present | nearest analogues are `PUZZLE_CRYSTAL_THEATER`, `PUZZLE_CONSTELLATION`, and data puzzle P26 (Solar Prism Refraction Alignment) |
| `ROTATE_MIRRORS_45_90_135` | not present | mirror alignment is `PUZZLE_MIRROR_LOCK`, `PUZZLE_TRUE_MIRROR`, `PUZZLE_MIRROR_VAULT` |
| `IRON_NAIL_GROUND_FAULT` | not present | cold-iron anchoring is `PUZZLE_RELATIVITY_ANCHOR` and `PUZZLE_RETROCAUSAL_PORTCULLIS`, both gated on `ITEM_IRON_NAIL` |
| `STEAM_PISTON_BYPASS` | not present | steam/pneumatic content is `PUZZLE_VENT_ASCENT` and data puzzle P19 (Pneumatic Steam-Condenser Circuit) |
| `DROP_COUNTERWEIGHT_CAGE` | not present | cage/escape analogue `PUZZLE_PRISON_ESCAPE`; the non-lethal path is the `pacifist_shadowhand` evasion mode |
| `STEALTH_PICKPOCKET_KEY` | not present | key acquisition is modelled as item pickups (`ITEM_BARRACKS_POSTERN_KEY`, `ITEM_CAPTAIN_LEDGER`), not a pickpocket minigame |
| `EVENT_ORIN_PANIC_STEAM_JAM` | present as the `ORIN_BLUFF` dialogue branch (`CHA < 9`) | the "Orin panics! Steam vents jam…" outcome; recovery is covered by the Failing Forward tests below |

**Failing Forward.** `tests/autoplay.test.ts` adds two cases for the failed-skill-check outcome: a dialogue that closes into an alerted guard, where lethal mode engages and ghost mode evades with zero attacks. The controller treats every failing-forward state the same way — close dialogue, then fight or evade, then resume the task list.

**Ghost / non-lethal mode.** `npm run e2e:autoplay:pacifist` boots `?autoplay=1&speed=8&mode=pacifist_shadowhand`, clears the MVP chain, and traverses all 50 rooms without a kill. Lethal `clear` tasks are satisfied by evasion, so no blade is drawn. The finale itself is gated on defeating Vaelor, so the ghost run stops in the throne room (`VK-P2-104`, OPEN).

**Endings.** `npm run e2e:autoplay` clicks every ending card (`shatter`, `crown`, `weave`, `iron`) and asserts each renders a non-empty epilogue, so "all endings" is verified rather than assumed.

**Speed.** `speedMultiplier` (clamped 1–8) scales both travel and the action/dialogue cadence; the 8x MVP run takes ~10 s versus ~130 s for the full 50-room campaign at 4x.
