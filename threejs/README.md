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
- S00 uses Blender-generated GLB diorama and Kaelen/Keep Guard character models instead of whitebox primitives.
- OW1/GH1/GH2/GH3 use the modular Blender room kit (`room_shell.glb`, `gate_arch.glb`, `mirror_lock.glb`) instead of generic boxes.
- `QualityManager` provides FPS/DPR overlay and Q-cycled Low/Medium/High presets (`src/core/Quality.ts`).

**Controls:** WASD/Arrows, **Space** melee, **E** interact.

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
