# VEILKEEP — Three.js Asset Sandbox & Prototype

This folder holds a **three.js whitebox prototype** and asset sandbox for **VEILKEEP**, bridging the GDD to engine-ready art.

## Run it

```bash
npx serve .       # or python -m http.server 8000
# open http://localhost:8000
```

`index.html` uses an import map to fetch three.js 0.170 from a CDN (no bundler needed). `main.js` boots the `noExit` whitebox using the tileset + magic mirror + chest textures.

## Playable slice status

- Rapier3D capsule player with static dungeon colliders.
- Room transitions across `S00`, `OW1`, `GH1`, `GH2`, `GH3` using manifest requirements.
- Autosave to `localStorage` on transitions, item pickup, puzzle solve, and captain defeat.
- Keep Guard and Captain patrol/chase/contact AI; Space melee; E interaction.
- `window.__veilkeep` debug hook for smoke tests and future MCP inspection.
- Zone music via `AudioManager` (Web Audio API) using open-source tracks in `public/audio/`.
- S00 uses Blender-generated GLB diorama and Kaelen/Keep Guard character models instead of whitebox primitives.
- OW1/GH1/GH2/GH3 use the modular Blender room kit (`room_shell.glb`, `gate_arch.glb`, `mirror_lock.glb`) instead of generic boxes.
- HM1/BQ1/AG1/MH1/SAN1/CO1/U1-U4/TR1-TR4/AT1-AT3 all use the modular room kit or dedicated Blender GLBs.
- `QualityManager` provides FPS/DPR overlay and Q-cycled Low/Medium/High presets (`src/core/Quality.ts`).

**Controls:** WASD/Arrows, **Space** melee, **E** interact, **P** auto-battler.

## Auto-Battler

Press **P** (or `window.__veilkeep.auto.enable()`) to hand the wheel to the
automaton. It plans a route through the fortress door graph, walks it with grid
A*, solves the puzzles, fights every hostile, advances the scripted dialogues,
and stops at the courtyard finale. Press **P** again to take control back at any
moment — the automaton never touches the save file, so a manual save and an
automated run are interchangeable.

- `src/data/doorGraph.ts` — the only door table. `FORTRESS_EXITS` is what the
  runtime uses, so a route can never disagree with what the player can walk
  through.
- `src/autobattler/Campaign.ts` — the 61-task campaign table, gate-aware route
  planner, and progress predicates (`nextGoal`, `nextPendingTask`, `taskReady`).
- `src/autobattler/Pathfinder.ts` — A* over the live Rapier static boxes with
  line-of-sight smoothing and door approach points.
- The HUD panel under the vitals card shows state, current scene, task, and
  overall progress. `window.__veilkeep.auto` exposes the same data plus
  `toggle()` / `enable()` / `disable()` for tests.

End-to-end proof (boots Chrome, starts a fresh profile, presses P, and waits for
all 50 scenes and 61 tasks):

```bash
npm run dev            # or: npx vite preview --port 4173 && BASE=http://localhost:4173 ...
node e2e/autobattler.spec.mjs
```

## Autoplay bot

`src/systems/AutoplayController.ts` is the QA autopilot. It is pure logic behind a
narrow `AutoplayHost` interface, so it can be unit-tested with a fake host and
driven in the browser through one thin adapter in `main.ts`. It never forks
movement: navigation still goes through `autoNavigate` / `findPath`, and
combat, dialogue and interaction call the same game functions the player does.

Boot it with the HUD button (**🤖 Autoplay**) or from the URL:

```bash
http://localhost:3000/?autoplay=1&speed=4               # full campaign
http://localhost:3000/?autoplay=1&speed=8&mode=mvp_slice # S00 -> OW1 -> GH1 -> GH2 -> GH3 -> SQ1
```

`?autoplay=1` skips the title screen and origin selector (defaulting to
`ORIGIN_ALCHEMIST`) and starts the bot immediately. `speed=` is clamped to 1–8
and scales both travel and the interaction/dialogue cadence. `mode=` accepts
`mvp_slice`, `full_campaign` (default), `pacifist_shadowhand` (ghost: lethal
`clear` tasks are satisfied by evasion, no blade drawn) and `all_quests`.

```js
const bot = window.__veilkeep.autoplay;
bot.start({ mode: 'full_campaign', speedMultiplier: 4 });
bot.pause(); bot.resume();
bot.stepToScene('GH2');
bot.solveCurrentRoom();
bot.getStatus();   // { running, currentGoal, visitedScenes, solvedPuzzles,
                   //   completedQuests, stuckTicks, lastError }
bot.bugsFound;     // watchdog P1 records with exact (x, y, z)
```

The watchdog files a `P1 Navigation/Collider Bug` (deduped per scene + rounded
position + goal) when the capsule moves less than 0.05 m for 90 consecutive
ticks while trying to reach a goal, then nudges and re-paths. Every record is
appended to `BUGS.md` by the web end-to-end run.

```bash
npm run e2e:autoplay           # 50/50 rooms at ?autoplay=1&speed=4, all 4 endings
npm run e2e:autoplay:mobile    # same bot on a 390x844 touch viewport (Android WebView)
npm run e2e:autoplay:pacifist  # ghost traversal, zero kills
```

## Level & scene verification suite

`__tests__/levels.spec.ts` is the exhaustive Playwright pass over the world: it
boots the real game, visits **all 50 scenes** and walks **every one of the 108
doors** in the runtime graph. It reads the live tables through
`window.__veilkeep` (`exits`, `qa.sceneIds/spawnFor/boundsFor/teleport/
stepPhysics`) rather than re-importing `doorGraph.ts`, so it can never drift
from what the game actually uses.

```bash
npm run dev -- --port 5199 --strictPort   # terminal 1
npm run test:levels                       # terminal 2, from threejs/
```

Per scene it asserts: `loadScene(id)` succeeds and the room renders
(`drawCalls > 0`), zero `console.error`, zero uncaught `pageerror`, zero 4xx
asset responses, zero `WebGLProgram` shader errors, the authored spawn is inside
the room bounds, and the capsule is still above `y = -1.0` after 60 gravity
ticks. Per door it asserts the door holds while locked, opens once its
requirements are granted, transitions to `exit.to`, lands within 0.75 m of the
destination spawn, and that the destination renders. Finally it runs 15
consecutive room transitions (`S00 -> OW1 -> GH1 -> GH2 -> GH3 -> S00` x3) and
requires `renderer.info.memory` to stay flat (measured: 356 geometries / 4
textures, unchanged).

Run it from `threejs/`. The root-level form
(`npx playwright test threejs/__tests__/levels.spec.ts`) picks up a different
`@playwright/test` instance from the npx cache, which rejects the spec's
`beforeAll`. A failing arrival prints the last 24 game-loop frames (scene,
`playerState`, capsule translation) plus diagnostics, which is how the one
harness race in this suite was found (see `BUGS.md`, `VK-P3-010`).


## Assets & surfaces

The production asset contract is GDD §42–46, with the file-by-file checklist in
[`../docs/ASSET_AND_INTEGRATION_MANIFEST.md`](../docs/ASSET_AND_INTEGRATION_MANIFEST.md).
This prototype ships only part of it; what is staged today:

| What | Where | Status |
| --- | --- | --- |
| PBR surface kit (17 sets + 1 HDRI) | `public/assets/textures/pbr/` | staged, not yet bound to geometry |
| Surface index (slug, role, `metresCovered`, map paths) | `src/data/pbr_materials.json` | generated, imported by code and tests |
| Lazy PBR loader | `src/core/MaterialLibrary.ts` | ready, unused by `buildGenericScene` |
| Model inventory (2 rigged + 7 environment GLBs) | `public/assets/models/` | in use |
| Provenance and licence table (all CC0) | `public/assets/textures/pbr/CREDITS.md` | — |

```ts
import { pbrMaterial } from './src/core/MaterialLibrary';

// metresCovered drives texture.repeat, so a 4 m slab tiles once per 4 m
const slab = await pbrMaterial('dungeon_slab', { repeat: 1 });
mesh.material = slab;
```

- `pbrMaterial(slug, { repeat, tint, anisotropy })` caches one material per
  (slug, repeat, tint, anisotropy) tuple; `disposePbrCache()` releases everything.
- `color` maps load as sRGB, `normal`/`roughness`/`ao` as linear (`NoColorSpace`).
- Metalness comes from the entry's role (`metal` = 0.9, everything else 0).
- Unknown slugs throw instead of silently rendering untextured.

Surfaces are **not** wired into rooms yet — `buildGenericScene()` still clones the
flat `VK_*` materials from `room_shell.glb`, so `renderer.info.memory.textures`
stays at 4 (tracked as `VK-P4-002` in `../BUGS.md`).

`tests/assetManifest.test.ts` guards the contract: index integrity, every
advertised map present on disk at the indexed byte size, HDRI presence, material
assembly, unknown-slug rejection, GLB parse, rig/clip sets and triangle budgets.

To re-download the surface kit (idempotent, CC0, needs Python + Pillow):

```bash
python ../tools/asset_pipeline/fetch_surfaces.py
```

## How it maps to the GDD

- `assets/art/tiles.js` — ASCII dungeon maps (GDD §32) → three.js-ready tile list (`buildFromAscii()`, `OVERVIEW`). These maps are illustrative; the production world graph lives in `src/data/world_manifest.json` (GDD §41).
- `src/data/world_manifest.json` — canonical scene graph: bounds, spawns, exits, requirements, one-way flags, and encounter variants. Validated by `tests/worldManifest.test.ts`. The current S00 courtyard reads its player spawn from this manifest and uses Rapier3D capsule collision instead of clamped movement.
- `main.js` — whitebox 3D scene with InstancedMesh floors/walls/doors and a hero marker; see GDD §38 for architecture, physics, and asset pipeline. Scene 00 art (`scene00_approach_sunken.png`) is used as the 3D scene's backdrop (`scene.background`).
- `assets/art/` — all CC0 assets sourced from OpenGameArt.

## How to use with three.js

```js
import * as THREE from 'three';
import { TILE_SIZE, TILESET_KEYS, buildFromAscii, OVERVIEW } from './assets/art/tiles.js';

async function loadTexture(url){ return new THREE.TextureLoader().load(url); }
const tiles = await loadTexture('./assets/art/dungeon_tiles/TilesDungeon/Tile.png');
const characters = await loadTexture('./assets/art/rpgCharacterSprites32x32.png');
const skeleton = await loadTexture('./assets/art/skeleton_attack.png');
const gargoyle = await loadTexture('./assets/art/gargoyle.png');
const chest = await loadTexture('./assets/art/chest2.png');
const coin = await loadTexture('./assets/art/coin_11.png');
const mirror = await loadTexture('./assets/art/magic_mirror.png');
```

- Use a **texture atlas** by setting `tex.repeat` and `tex.offset` per tile.
- Build 32x32 sprites:

```js
function makeSprite(tex,col,row,size=32){
  const mat = new THREE.SpriteMaterial();
  const t = tex.clone(); t.encoding = THREE.sRGBEncoding;
  t.repeat.set(1/(size*4), 1/(size*4));
  t.offset.set(col/(size*4), row/(size*4));
  mat.map = t; mat.transparent = true;
  return new THREE.Sprite(mat);
}
```

## Files

### Dungeon tileset (32x32, tiles)
- `dungeon_tiles/TilesDungeon/Tile.png` — floor tile
- `dungeon_tiles/TilesDungeon/Wall.png` — wall tile
- `tileset_dungeon.png` — full 32x32 dungeon tileset
- `topdown16_326.png` — top-down 16x16 map tileset and sprites

### Characters & enemies
- `rpgCharacterSprites32x32.png` — 32x32 RPG character sprite set (includes thief-like and mage-like figures)
- `magician/` — animated wizard sprite sequences (idle / walk / run / attack / damage / die)
- `male_top_down_01.png` — top-down male character sheet
- `skeleton_attack.png` — animated skeleton/undead attack sheet
- `gargoyle.png` — stone gargoyle enemy sprite
- `magic_mirror.png` — mirror portal sprite
- `chest2.png` — treasure chest (create a mimic variant by scaling + palette shift)
- `coin_11.png` — spinning coin sprite

## Note on asset association

Every art file maps to a game object in the GDD. See:
- `../gdd/gdd.md` — Section 37: Visual Asset Sources (Open Source) for mapping.
- `../gdd/assets/` — concept art layers (fluid art direction guide).

## AI Implementation Prompt (Master Directive)

For automated or pair-programming implementation via AI coding assistants (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, Antigravity/Cursor), copy and paste the **Master AI System Prompt** defined in:
- [`../gdd/gdd.md` — Section 39: Master AI Prompt Specification for Three.js Game Implementation](file:///c:/Development/findthewizard/gdd/gdd.md#L2995)

This directive enforces:
- Fixed-timestep physics accumulator (`dt = 1/60s`) decoupled from render loop.
- Zero-garbage rendering loop with pre-allocated scratch vectors and explicit `.dispose()`.
- `THREE.InstancedMesh` batching for dungeon tiles keeping draw calls < 35 per scene.
- True Dimetric/Isometric orthographic camera ($35.264^\circ$ tilt, $45^\circ$ yaw).
- Edward Hopper PBR lighting with directional key shadows and ambient cool fill.
- Noise-dissolve shader for illusion phasing and secret walls.

## Next
- Switch prototype to an animated sprite first: load `magician/sequences/idle/*.png` as a strip and animate via `THREE.Sprite` frames.
- Wire `buildFromAscii()` to a physics adapter (Rapier3D): each wall tile becomes a static cuboid, each floor tile is walkable.
- Add minigame hooks from GDD §34 (encounter budgets) to animate the `@` hero and doors.

## Related skills / MCP servers

- [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)
- [alton47/threejs-skills](https://github.com/alton47/threejs-skills)
- [locchung/three-js-mcp](https://github.com/locchung/three-js-mcp)
- [deya-0x/ThreeJSMCP](https://github.com/deya-0x/ThreeJSMCP)
