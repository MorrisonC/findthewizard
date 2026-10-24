# VEILKEEP — Master AI Implementation Prompt Packet

> **Instructions for the Newer / Frontier Model:**
> You are implementing the core gameplay systems for **VEILKEEP**, a 2.5D isometric Victorian Gothic Steampunk Action-RPG built in Three.js (WebGL2/WebGPU) and TypeScript.
> All project scaffolding, strictly typed domain schemas, complete data registries (quests, items, puzzles, zones, dialogues), asset manifests, and test suites are already built and verified in this directory.

---

## 1. Project Layout & Source Map

```
threejs/
├── src/
│   ├── types/               # Strict TypeScript contracts (DO NOT deviate from these schemas)
│   │   ├── ItemTypes.ts     # Weapons, armor, relics, consumables, stats
│   │   ├── QuestTypes.ts    # 42 quests, objectives, rewards, softlock rules
│   │   ├── PuzzleTypes.ts   # 30 puzzles, mechanics, validation criteria
│   │   ├── ZoneTypes.ts     # 27 zones, lighting, audio configs, exits
│   │   ├── DialogueTypes.ts # Dialogue trees & choices
│   │   ├── GameState.ts     # Full persistence save state schema
│   │   └── EventTypes.ts    # Strongly-typed EventBus map
│   ├── data/                # Immutable registries (100% extracted from GDD)
│   │   ├── items.json       # All weapons, relics, keys, and consumables
│   │   ├── quests.json      # 42 quests (7 Main, 31 Side, 4 Hidden)
│   │   ├── puzzles.json     # 30 illusionist puzzles
│   │   ├── zones.json       # 27 fortress zones
│   │   └── dialogue.json    # Dialogue trees for major NPCs
│   ├── core/
│   │   ├── AssetManifest.ts # Strongly-typed asset paths for tiles, sprites, audio
│   │   ├── EventBus.ts      # GlobalEventBus for decoupled pub/sub events
│   │   ├── IsometricCamera.ts # 35.264° pitch tilt / 45° yaw dimetric rig
│   │   └── Engine.ts        # Fixed 60Hz timestep loop & Edward Hopper lighting
│   └── main.ts              # Entry bootstrapper & diorama prototype
├── public/assets/art/       # CC0 tiles, spritesheets, sequence frames, concept art
└── tests/                   # Vitest unit test suite (run `npm test`)
```

---

## 2. Engine & Mathematical Guardrails

1. **Camera Projection:**
   - **True Dimetric Isometric:** $\text{Pitch} = \text{atan}(1 / \sqrt{2}) \approx 35.264^\circ$, $\text{Yaw} = 45^\circ$.
   - Use `IsometricCameraRig` in `src/core/IsometricCamera.ts`. Do not use arbitrary perspective angles.

2. **Fixed Timestep Loop:**
   - Physics and gameplay state update strictly inside `onUpdate(dt = 1/60s)`.
   - Rendering interpolates via accumulator alpha in `onRender(alpha)`.

3. **Performance & Memory Allocations:**
   - **Zero heap allocations in the 60Hz update loop.** Pre-allocate scratch vectors (`THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion`) outside loops.
   - Batch all dungeon tiles and environmental props using `THREE.InstancedMesh`. Never create individual `Mesh` objects per floor tile. Keep total draw calls below 35 per scene.

4. **Lighting Aesthetic:**
   - Edward Hopper cinematic lighting: warm golden key light (`#fef08a`, $1.8$ intensity) at $[16, 28, 18]$ casting PCF soft shadows, balanced by a cool navy ambient fill (`#1e293b`, $0.5$ intensity) and a subtle blue rim light (`#38bdf8`, $0.6$ intensity).

---

## 3. Recommended Implementation Roadmap for the Next Model

1. **Sprite & Character Animation System:**
   - Wire `ASSETS.CHARACTERS.WIZARD_*_BASE` and `ASSETS.CHARACTERS.RPG_CHARACTERS_32` frames into an animated sprite sheet component for Kaelen, Orin, and Bartholomew.
   - Implement 8-directional sprite billboard orientations facing the isometric camera.

2. **Tilemap & Grid Collision System:**
   - Parse ASCII room layouts from GDD §32 / `assets/art/tiles.js` into `InstancedMesh` floor and wall colliders.
   - Establish tile bitmask autotiling (GDD §35.4) and grid-to-world coordinate transforms (`worldX = tileX - tileZ`, `worldZ = (tileX + tileZ) / 2`).

3. **Dialogue & Interaction Modal System:**
   - Build an in-game HUD modal that binds to `dialogue.json` nodes and choices.
   - Check stat requirements (`[STR]`, `[DEX]`, `[INT]`) and inventory items (`hasItem()`).
   - Trigger `GlobalEventBus` events on choice selection (`ACCEPT_QUEST`, `GIVE_ITEM`, `START_COMBAT`).

4. **Active Relic & Illusion Mechanics:**
   - **Truth Lens (`[Space]` hold):** Apply a noise-dissolve shader to reveal secret doors, invisible ethereal traps, and disguised mimic chests.
   - **Echo Bell (`[E]` tap):** Emit an expanding 3D acoustic ring that pings resonance crystals, opens echo doors, and tunes Aeolian wind-baffles.
   - **Iron Nails:** Anchor non-Euclidean perspective stairways in the Relativity Cloister and Keystone chasm crossings.

5. **Climactic Multi-Phase Boss State Machine (Archillusionist Vaelor):**
   - **Phase 1 (The Mirage):** 3 illusion clones casting Mirror Bolts; only the real caster casts a directional shadow.
   - **Phase 2 (The Phantasm):** Intangible boss teleporting through wall mirrors; summon phantasmal hounds; shatter 4 mirrors to force vulnerability.
   - **Phase 3 (The Nightmare):** Dream-logic gravity inversions; timed 4s flips; anchor 4 stress points with Iron Nails.
   - **Phase 4 (Reality):** Illusions stripped; physical telekinesis; Heart of Mirrors exposed; trigger the 4 Ending dialogue choices at 5% HP.

6. **Web Audio Engine & Dynamic Music Layering:**
   - Attach a single `THREE.AudioListener` to the `IsometricCameraRig`.
   - Route exploration ambient pads and combat percussion into separate `GainNode` buses with smooth 1.5s cross-fading.
   - Attach `THREE.PositionalAudio` with exponential distance roll-off to steam valves, clockwork gears, and weeping fountains.

7. **Inventory, Equipment & Combat Loop:**
   - Weapon hitboxes, light/heavy attack windups, active hitframes, and recovery punish windows (GDD §34.3).
   - Harmonic Parry timing window with the Maestro's Chrono-Metronome (+50% parry window).

8. **Save / Load Persistence & GameState:**
   - Serialize player attributes, inventory slots, active quest flags, and solved puzzles to `localStorage` matching the `GameSaveState` schema.
