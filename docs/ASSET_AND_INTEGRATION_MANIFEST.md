# VEILKEEP - Asset & Integration Manifest

**Status:** Phase 1 deliverable of the asset production plan (GDD sections 42-46).
**Owner:** Technical Art / Engine Integration.
**Normative companions:** `gdd/gdd.md` sections 14, 19, 34, 35, 38, 40, 41, 42-46.
**Generated index:** `threejs/src/data/pbr_materials.json` (surface kit).
**Verified by:** `threejs/tests/assetManifest.test.ts`, `threejs/__tests__/levels.spec.ts`.

This document is the single production checklist for every asset the GDD requires. The GDD
states design intent and acceptance rules; this file states exactly which files, rigs, rooms and
data tables must exist to satisfy it. If the two disagree, the GDD wins and this file is wrong.

---

## 1. Scope and sources of truth

| Question | Authoritative source |
|---|---|
| What enemies exist, their HP/behaviour/weakness/loot | GDD 14, 14b |
| Encounter tiers, budgets, timings, state machine | GDD 34.1-34.5 |
| Zone topology, room tags, seed grammar | GDD 35.1-35.6 |
| Art direction, palette, material rules | GDD 19, 40 |
| Scale, camera, world rules, manifest schema | GDD 41.1-41.3 |
| Room/exits/doors actually playable | `threejs/src/data/doorGraph.ts` + `world_manifest.json` |
| Surface textures and their licences | `threejs/src/data/pbr_materials.json`, `public/assets/textures/pbr/CREDITS.md` |
| Runtime asset paths already referenced | `threejs/src/core/AssetManifest.ts` |
| What the engine currently builds | `threejs/src/main.ts` (`loadScene`, `buildGenericScene`) |

Repository facts this manifest is built on (audited 2026-10-25, HEAD `8aa99bb` plus the Phase 3 work):

- 50 playable scenes, 108 directed exits, 28-zone macro graph.
- 9 GLB models: 2 rigged characters, 7 environment/prop pieces.
- 17 PBR surface sets + 1 night-sky HDRI staged (CC0, ambientCG).
- 5 JSON data tables: 27 zones, 42 quests, 30 puzzles, 39 items, 13 dialogue speakers (51 nodes, 78 choices).
- 0 characters, 0 enemies, 0 rooms built against this manifest yet - it is the contract for Phases 2-4.

### 1.1 What "integration" means in this engine

The master plan was written for a Godot project. This repository is Three.js + Rapier + glTF, so every
engine-specific instruction is translated:

| Godot concept in the plan | VEILKEEP equivalent |
|---|---|
| `.tscn` entity prefab | `buildGenericScene()` room assembly + per-entity factory functions in `main.ts` |
| `AnimationPlayer` / `AnimationTree` | `THREE.AnimationMixer` + clip tables in `RigLibrary.ts` |
| Imported `NavigationMesh` | `findPath()` / `autoObstacles` grid in `src/autobattler/Pathfinder.ts` |
| `CollisionShape3D` on prefab | `PhysicsWorld.addStaticBox()` calls in `addGenericColliders()` |
| `Resource` / `.tres` data | `src/data/*.json` + typed loaders |
| Editor-imported materials | `MaterialLibrary.pbrMaterial(slug)` (staged, not yet bound) |

---

## 2. Conventions (apply to every asset in this document)

**Units and axes.** 1 unit = 1 metre, +Y up, +Z forward (GDD 38.2/41.1). Characters face +Z at rest.
Origin at the floor between the feet (characters/props) or the grid corner/centre (tiles).
Camera is fixed isometric 35.264 deg pitch / 45 deg yaw, so silhouettes are judged from that angle only.

**Naming.**

| Pattern | Meaning | Example |
|---|---|---|
| `CHR_<Name>` | player / NPC mesh | `CHR_Kaelen` |
| `ENM_<Name>` | enemy mesh | `ENM_PhantasmHound` |
| `RIG_<Class>` | armature | `RIG_Humanoid` |
| `KIT_<Part>_<Size>` | modular environment piece | `KIT_Wall_Straight_4` |
| `PRP_<Name>` | prop | `PRP_Barrel` |
| `LGT_<Name>` | light fixture | `LGT_Brazier` |
| `MAT_<Slug>` | material slot referencing a staged PBR slug | `MAT_dungeon_slab` |
| `ANM_<Rig>_<Clip>` | animation track inside a GLB | `ANM_Humanoid_Attack_Primary` |

**Node suffixes inside a GLB** (suffix match is case-insensitive, checked by `validate_assets.py`):

| Suffix | Meaning | Consumer |
|---|---|---|
| `-col` | static collision hull (box/convex, no render) | `addGenericColliders()` |
| `-nav` | walkable surface used to seed the path grid | `Pathfinder` obstacle raster |
| `-break` | destructible prop, spawns a debris variant on break | encounter system |
| `-fx` | socket anchor for VFX (not rendered) | `EventBus` / effects |
| `-lgt` | light origin (position + colour metadata) | `Engine` light rig |
| `-pod` | encounter pod anchor (see GDD 43.3) | encounter director |

**Budgets.** Triangle counts are per instance, LOD0. A room is rejected above 60 draw calls.
Textures are 1024 px for hero surfaces, 512 px for tiling detail, and never exceed 2048 px in the web build.

**Colour space.** `color` maps are sRGB; `normal`, `roughness`, `ao` are linear (`NoColorSpace`).
This is enforced in `MaterialLibrary.buildPbrMaterial()`.

---

## 3. Characters - player and origins

### 3.1 Kaelen Voss, the Shadowhand (player)

| Field | Value |
|---|---|
| Mesh | `CHR_Kaelen` - exists: `public/assets/models/kaelen.glb` |
| Triangles | 1,040 shipped / 3,000 budget |
| Materials | 7 shipped / **2 budget** (atlas + vertex colour; see 3.4) |
| Joints | 23 shipped / 24 max |
| Clips | `Idle`, `Walk`, `Run`, `Attack`, `Dodge`, `Death` (shipped) |
| Missing clips | `Attack_Secondary`, `Cast`, `Hit_React`, `Stagger`, `Interact`, `Climb`, `WallLeap`, `AirDash`, `GravInvert`, `MirrorPhase` |
| Sockets | `socket_hand_r` (Whisper), `socket_hand_l` (off-hand tool), `socket_spell_origin` (chest), `socket_chest` (cloak clasp), `socket_back` (staff when sheathed), `socket_head` (Truth Lens) |
| Silhouette | 1.75 m, narrow shoulders, high collar, trailing cloak. Cloak must read as a distinct silhouette from guards at isometric distance. |
| Traversal brands | Wall-Leap, Air-Dash, Grav-Inversion, Mirror-Phase (GDD 10c) - each needs a 20-30 frame one-shot clip |

### 3.2 Origin visual variants

Origins change gear, not rig (GDD 5b.1). All four share `RIG_Humanoid` and the clip set; only the
mesh swap (cloak, tool belt, headwear) differs. One 1024 atlas per origin variant, same UV layout.

| Origin ID | Label | Visual delta | Tool socket |
|---|---|---|---|
| `ORIGIN_ALCHEMIST` | Gutter-Alchemist of Greyport | Sulfur-stained apron, bandolier of vials, singed gloves | `socket_belt_vial` |
| `ORIGIN_CHARLATAN` | Velvet-Tongued Confidence Man | Velvet coat, playing-card fan, false moustache prop | `socket_hand_l` |
| `ORIGIN_ENFORCER` | Dockside Pit-Cutthroat | Cut-off coat, forearm wraps, knuckle-plate | `socket_hand_l` |
| `ORIGIN_ANTIQUARIAN` | Occult Reliquary Fence | Spectacles, relic satchel, glove with six fingers | `socket_belt_satchel` |

### 3.3 NPC roster (47 entries, 48 named characters)

Rig classes: `humanoid_robed`, `humanoid_heavy`, `humanoid_boss`, `quadruped_boss`, `arboreal_boss`,
`prop_animated` (no skeleton), `prop_static`. Clip sets: `npc` = Idle/Talk/Gesture_A/Gesture_B/Walk;
`npc+` adds Point/Beckon; `npc_boss` adds Attack_Primary/Hit_React/Stagger/Death; `prop` = authored
animation only. Scenes marked `(zone)` are authored in the GDD but not in the 50-scene playable slice yet.

| NPC | Scene | Rig | Tris | Sockets | Clips | Barks |
|---|---|---|---|---|---|---|
| Guildmaster Sable (raven proxy) | S00 | `prop_animated` (Starlight Raven) | 600 | `socket_beak` | prop | 6 |
| Gatekeeper Orin | GH1 | humanoid_heavy | 2,200 | hand_r, chest, head | npc+ | 12 |
| Librarian Maren | L5 (zone) | humanoid_robed | 2,200 | hand_r, chest | npc+ | 12 |
| Menagerie Keeper | M4 (zone) | humanoid_heavy | 2,200 | hand_r, chest | npc+ | 10 |
| Servant Lira | SQ1 | humanoid_robed | 2,000 | hand_r, chest | npc+ | 12 |
| Cook Hesta | K (zone) | humanoid_heavy | 2,300 | hand_r, chest, belt | npc+ | 10 |
| Blind Priest | C3 (zone) | humanoid_robed | 2,200 | hand_r, chest | npc+ | 10 |
| Ghost Monk | U2 | spectral | 1,600 | hand_r, chest | npc | 8 |
| Dreamer | DG (zone) | humanoid_robed | 2,000 | hand_r | npc | 8 |
| Gardener Pim | DG (zone) | humanoid_robed | 2,000 | hand_r, belt | npc+ | 10 |
| Mirror Merchant | HM1 | humanoid_robed | 2,100 | hand_r, chest | npc+ | 12 |
| Curator (Hunter) | TR4 | humanoid_boss | 3,000 | hand_r, hand_l, chest | npc_boss | 10 |
| The Genie | TR3 (hidden) | prop_animated | 1,800 | hand_r, fx_chest | prop | 12 |
| Stargazer | AT1 | humanoid_robed | 2,100 | hand_r, head | npc+ | 10 |
| Alchemist Vex | AL3 | humanoid_robed | 2,200 | hand_r, belt, chest | npc+ | 12 |
| Prisoner Korr | PB1 | humanoid_light | 1,900 | hand_r | npc | 8 |
| Windkeeper | RG2 | humanoid_robed | 2,100 | hand_r, chest | npc | 6 |
| The Dreamer (Void) | VR2 | spectral | 1,800 | chest | npc | 6 |
| The Diner | RS6 | humanoid_robed (bulb head) | 2,300 | hand_r | npc | 6 |
| Stairkeeper | RS2 | humanoid_robed | 2,000 | hand_r | npc | 4 |
| Barnaby the Talking Horse | PH4 (zone) | quadruped_npc | 2,400 | head, back | npc+ | 14 |
| Ringmaster Valenti | PH2 (zone) | humanoid_robed | 2,300 | hand_r, head | npc+ | 12 |
| Strongman Boris | PH3 (zone) | humanoid_heavy | 2,600 | hand_r, hand_l | npc+ | 10 |
| Master Vane | BF2 (zone) | humanoid_heavy | 2,400 | hand_r, back, head | npc+ | 12 |
| Philosopher Renatus | RD2 (zone) | humanoid_robed | 2,300 | hand_r, head | npc+ | 16 |
| Ignis-Weaver Vaelen | ME2 (zone) | humanoid_robed | 2,200 | hand_r, spell_origin | npc+ | 10 |
| Mirrormancer Sylas | ME2 (zone) | humanoid_robed | 2,200 | hand_r, spell_origin | npc+ | 10 |
| Astromancer Zephyra | ME2 (zone) | humanoid_robed | 2,200 | hand_r, spell_origin | npc+ | 10 |
| Pigeon Master Corvo | AV1 (zone) | humanoid_heavy | 2,300 | hand_r, back, head | npc+ | 10 |
| Lady Aurelia the Inverted | CR2 (zone) | humanoid_robed | 2,200 | hand_r, chest | npc+ | 12 |
| Maestro Niccolò | MS2 (zone) | humanoid_robed | 2,300 | hand_r, hand_l, head | npc+ | 14 |
| Madame Clara | MS2 (zone) | humanoid_robed | 2,200 | hand_r, hand_l | npc+ | 10 |
| Lady Eleanor the Sun-Scarred | C3 (zone) | humanoid_boss | 3,200 | hand_r, hand_l, chest, head | npc_boss | 12 |
| Sir Roderick the Penitent | OW1 | humanoid_boss (marble variant) | 3,200 | hand_r, chest | npc_boss | 10 |
| Mister Bartholomew Sterling | SQ1 | humanoid_heavy | 2,400 | hand_r, chest | npc+ | 14 |
| Madame Vivienne | HA3 (zone) | spectral | 1,800 | hand_r, chest | npc | 10 |
| Lord Morvath Vaelor (portrait) | HA2 (zone) | `prop_animated` (portrait) | 900 | fx_mouth | prop | 8 |
| Lord Aurelius the Sky-Sovereign | EY2 (zone) | quadruped_boss (gryphon) | 4,000 | head, back, chest | npc_boss | 12 |
| Ariadne the Clockwork Weaver | LB1 (zone) | construct_biped | 2,600 | hand_r, hand_l, chest | npc+ | 10 |
| Asterion the Brass-Horned (ally) | LB4 (zone) | construct_boss_quadruped | 7,000 | head, back | npc_boss | 10 |
| Eldrin the Star-Carver | PB5 (zone) | humanoid_robed | 2,000 | hand_r | npc | 8 |
| Castellan Dredge the Iron Gaoler | PB2 | humanoid_boss | 4,000 | hand_r, back, head | npc_boss | 12 |
| Lord Byakko the White Tiger | M4 (zone) | quadruped_boss | 6,000 | head, back | npc_boss | 12 |
| Liber Cutis (Sentient Lexicon) | L5 (zone) | `prop_animated` (tome) | 1,200 | fx_mouth, fx_eye | prop | 10 |
| Yggdra the Star-Weeper | DG3 / AG1 | arboreal_boss | 8,000 | crown, 3 boughs, 3 roots | npc_boss | 10 |
| Mother Hazel | MH1 | humanoid_boss | 3,400 | hand_r, hand_l, chest, head | npc_boss | 14 |
| Marquess Cassian & Marchioness Genevieve | BQ1 | humanoid_robed x2 | 2,100 each | hand_r, chest | npc | 8 each |

### 3.4 Character budget rules

1. **Two materials maximum** per character: one 1024 sRGB atlas (skin, cloth, leather, metal in
   distinct UV islands) plus one shared trim/normal atlas. The shipped Kaelen and Keep Guard GLBs use
   seven materials each (one per colour), which costs 7 draw calls per instance and 7 material clones
   per scene. Fixing this is the highest-value optimisation in the character pipeline.
2. **One skin per GLB**, maximum 4 bone influences per vertex, no morph targets on enemies.
3. **Rigid props stay separate**: weapons and held tools are socket children, not skinned geometry.
4. **Face detail is texture, not geometry.** At 35 deg isometric, a 128 px face decal reads better than
   200 extra triangles.
5. **Silhouette test**: each character must be identifiable from a 256 px orthographic render at
   isometric angle with flat 50% grey material. Bosses must be identifiable by silhouette alone.

---

## 4. Enemies and bosses (31 bestiary entries + Vaelor)

Tier costs follow GDD 34.1 (Fodder 1, Striker 2, Controller 3, Tank 4, Elite 6, Boss 10+).
`Capsule` is the physics hurtbox: `radius x height` in metres. Every enemy also carries a smaller
`Hitbox` volume authored per attack (see 4.2). `Telegraph` is the wind-up colour used by the rim shader
and ground decal. Clip sets: `enemy` = Idle/Walk/Attack_Primary/Hit_React/Stagger/Death; `enemy+`
adds Run/Attack_Secondary; `enemy_boss` adds phase transitions.

| # | Enemy | Type (14) | Tier | HP | Rig class | Height | Capsule | Clips | Telegraph | Asset |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Keep Guard | Real / Fodder | 1 | 40 | humanoid_heavy | 1.85 | 0.35 x 1.85 | enemy+ | amber | EXISTS `keep_guard.glb` |
| 2 | Archer Guard | Real / Striker | 2 | 30 | humanoid_ranged | 1.80 | 0.32 x 1.80 | enemy+ | amber | TODO |
| 3 | Phantasm Hound | Illusion / Striker | 2 | 25 | quadruped | 1.05 | 0.45 x 1.05 | enemy+ | cyan | TODO |
| 4 | Mirror Wraith | Illusion / Controller | 3 | 35 | spectral | 1.90 | 0.35 x 1.90 | enemy+ | violet | TODO |
| 5 | Stone Gargoyle | Construct / Tank | 4 | 60 | construct_biped | 2.40 | 0.55 x 2.40 | enemy | brass | TODO |
| 6 | Clockwork Soldier | Construct / Tank | 4 | 50 | construct_biped | 2.00 | 0.45 x 2.00 | enemy | brass | TODO |
| 7 | Phantasmal Beast | Illusion / Elite | 6 | 80 | quadruped_heavy | 2.20 | 0.70 x 2.20 | enemy_boss | cyan | TODO |
| 8 | Undead Monk | Undead / Fodder | 1 | 45 | humanoid_robed | 1.75 | 0.32 x 1.75 | enemy | sickly green | TODO |
| 9 | Clockwork Warden | Construct / Elite | 6 | 120 | construct_boss | 3.20 | 0.70 x 3.20 | enemy_boss | brass | TODO |
| 10 | Colosseum Beast | Illusion / Elite | 6 | 90 | quadruped_heavy | 2.60 | 0.75 x 2.60 | enemy_boss | cyan | TODO |
| 11 | Mimic (Chest) | Illusion / rare | 3 | 50 | `prop_animated` | 1.00 | 0.50 x 1.00 | prop | violet | TODO |
| 12 | Mirror Merchant | Illusion / Striker | 2 | 50 | humanoid_robed | 1.80 | 0.32 x 1.80 | enemy+ | violet | TODO |
| 13 | Dreamwalker | Illusion / passive | 1 | 20 | humanoid_robed (wall-walk) | 1.90 | 0.30 x 1.90 | enemy | none (passive) | TODO |
| 14 | Brigand Cutpurse | Real / Fodder | 1 | 35 | humanoid_light | 1.70 | 0.32 x 1.70 | enemy+ | amber | TODO |
| 15 | Brigand Enforcer | Real / Tank | 4 | 65 | humanoid_heavy | 2.00 | 0.45 x 2.00 | enemy | amber | TODO |
| 16 | Minor Brigand Captain | Real / Elite | 6 | 110 | humanoid_dual | 1.85 | 0.35 x 1.85 | enemy_boss | amber | TODO |
| 17 | Major Captain (Arena) | Boss | 10 | 280-360 | humanoid_boss | 2.10 | 0.45 x 2.10 | enemy_boss | per-captain | TODO x4 |
| 18 | Spectral Knife-Juggler | Illusion / Striker | 2 | 40 | spectral | 1.80 | 0.32 x 1.80 | enemy+ | violet | TODO |
| 19 | Clockwork Trapeze Phantasm | Construct / Striker | 2 | 45 | construct_biped | 1.90 | 0.35 x 1.90 | enemy+ | brass | TODO |
| 20 | Steam Automaton Centurion | Construct / Tank | 4 | 75 | construct_biped_heavy | 2.30 | 0.55 x 2.30 | enemy | brass | TODO |
| 21 | Boiler-Hulk Brigand | Real / Elite | 6 | 85 | humanoid_heavy | 2.20 | 0.55 x 2.20 | enemy_boss | amber | TODO |
| 22 | Ignis Pyregoyle | Construct / Elite | 6 | 180 | construct_winged | 2.80 | 0.70 x 2.80 | enemy_boss | ember | TODO |
| 23 | Speculor the Refractor | Illusion / Elite | 6 | 220 | quadruped_mirror | 2.40 | 0.65 x 2.40 | enemy_boss | violet | TODO |
| 24 | Astrophage the Star-Bane | Cosmic / Elite | 6 | 260 | aberration_float | 3.00 | 0.80 x 3.00 | enemy_boss | cyan | TODO |
| 25 | Temporal Paradox Wraith | Temporal / Elite | 6 | 55 | spectral | 1.90 | 0.35 x 1.90 | enemy_boss | pale gold | TODO |
| 26 | Phantasmal Templar | Undead / Elite | 6 | 95 | humanoid_armored | 1.90 | 0.40 x 1.90 | enemy_boss | white gold | TODO |
| 27 | Poltergeist Apparition | Spectral / Elite | 6 | 70 | spectral | 1.85 | 0.35 x 1.85 | enemy+ | pale cyan | TODO |
| 28 | Asterion the Brass-Horned | Construct / Boss | 10 | 240 | construct_boss_quadruped | 3.40 | 0.90 x 3.40 | enemy_boss | brass | TODO |
| 29 | Castellan Dredge | Humanoid / Elite | 6 | 210 | humanoid_boss | 2.20 | 0.50 x 2.20 | enemy_boss | iron red | TODO |
| 30 | Lord Byakko | Beast / Boss | 10+ | 380 | quadruped_boss | 2.60 | 0.85 x 2.60 | enemy_boss | moon white | TODO |
| 31 | Yggdra the Star-Weeper | Arboreal / Boss | 10+ | 320 | arboreal_boss | 6.50 | 1.20 x 6.50 | enemy_boss | starlight green | TODO |
| 32 | Archillusionist Vaelor | Humanoid / Final Boss | 10+ | 800 pooled | humanoid_boss | 2.05 | 0.45 x 2.05 | enemy_boss | mirror silver | TODO |

### 4.1 Scale and silhouette distinction

| Class | Height band | Readability requirement |
|---|---|---|
| Fodder | 1.5-1.8 m | Shoulder line below the player's eye; no shoulder pads |
| Striker | 1.0-1.9 m | Lighter build, one asymmetrical weapon, motion blur of cloth |
| Tank | 2.0-2.4 m | Wider than tall torso, slab shoulders, heavy footfall |
| Controller | 1.8-1.9 m | Floating (feet off ground >= 0.15 m) or robe-to-floor, no legs visible |
| Elite | 2.2-3.2 m | At least one silhouette hook: horn, wing, cage, halo, second head |
| Boss | 3.4-6.5 m | Occupies >= 25% of a 12 m room width; distinct ground shadow shape |

### 4.2 Hitbox / hurtbox standard

- **Hurtbox** (what the player hits): vertical capsule, `radius = clamp(0.28 * height, 0.25, 1.20)`,
  `height = 0.95 * height`, centred at `height / 2`. Authored as the `hurtbox` collision group.
- **Hitbox** (what hits the player): one capsule or sphere per active attack frame, parented to the
  attacking bone socket. Radius comes from the move, not the body: Guard sweep 0.9 m, Gargoyle slam
  1.6 m, Beast charge 1.2 m, Warden gear toss 0.5 m.
- **Weak points**: bosses with a GDD-stated vulnerability get a second, smaller hurtbox with a 1.5x
  damage multiplier: Asterion neck collar (`S31`), Byakko rift anchors, Yggdra sap roots (3),
  Vaelor mirror heart during phase 3.
- **Player hurtbox** is fixed: 0.35 r x 1.75 h, never scaled by origin.
- **Never** scale the hurtbox with animation. If a pose extends beyond the capsule, add a hitbox, not a
  bigger body.

### 4.3 Telegraphing

Every attack must be readable at 1280x800 isometric with no UI. Three channels, all keyed off the
wind-up windows in GDD 34.3:

1. **Rim light ramp**: emissive rim on the attacking limb ramps 0 -> 1 across the wind-up (amber for
   Real, cyan for Illusion, brass for Construct, white-gold for Radiant).
2. **Ground decal**: an unlit ring or wedge appears at the impact footprint for AoE moves, alpha ramps
   with wind-up.
3. **Audio cue** at wind-up start (GDD 36.3): `guard_alert` for aggro, `steam_vent` for boiler moves,
   `mirror_chime` for illusion casts, `boss_phase` for phase transitions.

Boss phases additionally flash the arena lighting once (`boss_phase` stinger) and must never start a
new phase during a player i-frame window.

---

## 5. Rigging and animation specification

### 5.1 Bone hierarchies

All rigs are single-skin, Y-up, +Z forward, rest pose = T-pose for humanoids and neutral stand for
quadrupeds. Bone names are lowercase snake_case and identical across every rig of the same class, so
`AnimationClip` retargeting is a name remap, not a bake.

**`RIG_Humanoid` (23 joints, shipped on `kaelen.glb`)**

```
root
  pelvis
    spine_01
      spine_02
        spine_03
          neck
            head
          clavicle_l -> upperarm_l -> forearm_l -> hand_l
          clavicle_r -> upperarm_r -> forearm_r -> hand_r
    thigh_l -> calf_l -> foot_l -> toe_l
    thigh_r -> calf_r -> foot_r -> toe_r
```

`keep_guard.glb` ships 24 joints: the same tree plus `jaw` (used for helmet visor and shout barks).

**`RIG_Quadruped` (26 joints)**

```
root
  pelvis
    spine_01 -> spine_02 -> chest
      neck_01 -> neck_02 -> head -> jaw
      tail_01 -> tail_02 -> tail_03
      clavicle_l -> upperarm_l -> forearm_l -> paw_f_l
      clavicle_r -> upperarm_r -> forearm_r -> paw_f_r
    thigh_l -> calf_l -> hock_l -> paw_h_l
    thigh_r -> calf_r -> hock_r -> paw_h_r
```

**`RIG_Construct` (26 joints)** - humanoid tree with `hip_l/r` pistons replacing clavicles and a
`boiler` bone under `spine_02` for steam vent VFX. Quadruped constructs (Asterion) use `RIG_Quadruped`
with `horn_l/r` added under `head`.

**`RIG_Spectral` (19 joints)** - humanoid tree without feet/toes, plus `tatter_01..03` under `pelvis`
for cloth drift. Feet are authored as geometry that follows `calf_*`, which keeps the "floating" read.

**`RIG_Arboreal` (34 joints)**

```
root
  trunk_01 -> trunk_02 -> trunk_03 -> trunk_04 -> crown
    face
    bough_l1 -> bough_l2 -> bough_l3
    bough_r1 -> bough_r2 -> bough_r3
    bough_b1 -> bough_b2 -> bough_b3
    root_a1 -> root_a2 -> root_a3
    root_b1 -> root_b2 -> root_b3
    root_c1 -> root_c2 -> root_c3
```

### 5.2 Sockets

| Socket | Parent bone | Used by |
|---|---|---|
| `socket_hand_r` | `hand_r` | weapon, tool, lantern |
| `socket_hand_l` | `hand_l` | off-hand, shield, second blade |
| `socket_staff` | `hand_r` | staff/wand grip offset (rotated 90 deg on X) |
| `socket_spell_origin` | `spine_03` | cast VFX origin |
| `socket_chest` | `spine_02` | cloak clasp, amulet, armour plate |
| `socket_back` | `spine_03` | sheathed weapon, backpack, boiler tank |
| `socket_head` | `head` | Truth Lens, hat, crown |
| `socket_fx_ground` | `root` | ground decals, summon circles |

Sockets are empty nodes named exactly as above, exported in the GLB. The engine resolves them with
`Object3D.getObjectByName()`; a missing socket is a hard import error (caught by `validate_assets.py`).

### 5.3 Clip library

Authoring rate is 30 fps. Clip names are fixed; the engine looks them up by name, never by index.
Frame counts are LOD0; LOD1 may halve them.

| Clip | Frames @30 | Loop | Root motion | Notes |
|---|---|---|---|---|
| `Idle` | 90 | yes | none | Breathing loop, 3 s |
| `Walk` | 32 | yes | in-place | 2 steps, 1.07 s |
| `Run` | 24 | yes | in-place | 2 steps, 0.8 s |
| `Attack_Primary` | 36 | no | none | wind-up 20f / active 4f / recovery 12f (matches Guard 650/120/420 ms) |
| `Attack_Secondary` | 42 | no | none | heavy or thrown variant |
| `Cast` | 48 | no | none | spell-origin VFX at frame 30 |
| `Hit_React` | 12 | no | none | additive, upper body only |
| `Stagger` | 24 | no | none | full body, interrupts |
| `Death` | 45 | no | none | holds last frame |
| `Dodge` | 20 | no | in-place | player only, i-frames 4-12 |
| `Interact` | 30 | no | none | levers, chests, dialogue |
| `Talk` | 60 | yes | none | NPC ambient |
| `Gesture_A` / `Gesture_B` | 40 / 40 | no | none | NPC punctuation |
| `Phase_Shift` | 60 | no | none | boss only, 2 s invulnerable transition |

Per-rig minimums:

| Rig | Required clips |
|---|---|
| Humanoid (player) | Idle, Walk, Run, Attack_Primary, Attack_Secondary, Cast, Hit_React, Stagger, Death, Dodge, Interact |
| Humanoid (NPC) | Idle, Walk, Talk, Gesture_A, Gesture_B |
| Humanoid (enemy) | Idle, Walk, Attack_Primary, Hit_React, Stagger, Death (+Run, Attack_Secondary for Strikers) |
| Quadruped | Idle, Walk, Run, Attack_Primary, Hit_React, Stagger, Death |
| Construct | Idle, Walk, Attack_Primary, Attack_Secondary, Hit_React, Stagger, Death |
| Spectral | Idle, Walk, Attack_Primary, Hit_React, Death (no Stagger; phases instead) |
| Arboreal | Idle, Bough_Lash, Root_Eruption, Spore_Cloud, Hit_React, Death, Phase_Shift |
| Boss (any) | enemy set + Phase_Shift (one per phase) |

### 5.4 Export contract

- One GLB per entity, Draco-compressed, no external `.bin` or texture references (textures are
  separate files resolved by `MaterialLibrary`).
- Exactly one skin; `skins[0].joints` ordered by hierarchy depth so retargeting is stable.
- Animation tracks are named `<Clip>` exactly; the exporter must not prefix the armature name.
- `scene.name` = mesh name (`CHR_Kaelen`, `ENM_PhantasmHound`); armature node named `RIG_<Class>`.
- Rest pose must be the bind pose (no baked pose offsets), or GLTF skinning will double-transform.
- Max 4 influences per vertex; no scale animation on bones; no negative scale anywhere.
- Origin at floor centre; forward +Z; height in metres.

### 5.5 Validation

`tools/asset_pipeline/validate_assets.py` checks, per GLB: parse, single skin, joint count within class
budget, clip-name set superset of the required set, socket presence, triangle budget, material count,
texture size, node suffix correctness (`-col` / `-nav` / `-fx`), and pivot/origin within 1 cm of the
floor plane. It exits non-zero on any violation and is wired into `npm run assets:verify`.

---

## 6. Modular dungeon kit

The kit replaces the single `room_shell.glb` (11,044 tris, 10 materials, 12.35 m square) with a
snap-together system that can build the room archetypes in GDD 43.2. All pieces snap to a 1 m grid;
the macro-tile is 4 x 4 m because that is the smallest unit a 14 m room divides into cleanly and the
largest unit an artist can re-tile without visible repetition at isometric distance.

### 6.1 Kit parts

Dimensions are `width x height x depth` in metres. `Tris` is the LOD0 budget for one instance.
Every wall/floor/pillar piece carries a `-col` child; every walkable top surface carries `-nav`.

| ID | Dims | Tris | Material slug | Notes |
|---|---|---|---|---|
| `KIT_Floor_1x1` | 1 x 0.15 x 1 | 12 | per-room | Base slab; 3 material variants (slate/marble/parquet) |
| `KIT_Floor_2x2` | 2 x 0.15 x 2 | 12 | per-room | Standard room tile |
| `KIT_Floor_4x4` | 4 x 0.15 x 4 | 12 | per-room | Macro-tile, used for open halls |
| `KIT_Floor_4x4_Chasm` | 4 x 0.15 x 4 | 60 | `dungeon_slab` | Rim with 3 x 3 hole, `-nav` on rim only |
| `KIT_Floor_4x4_Grate` | 4 x 0.15 x 4 | 80 | `metal_plate_rusted` | `-nav` top, `-col` rim; see-through |
| `KIT_Ramp_2x4` | 2 x 1.5 x 4 | 40 | per-room | 0 -> 1.5 m rise, `-nav` sloped |
| `KIT_Stair_2x4` | 2 x 1.5 x 4 | 120 | per-room | 8 steps, `-nav` per tread |
| `KIT_Stair_Spiral_4x4` | 4 x 3.0 x 4 | 300 | per-room | 0 -> 3.0 m, 12 treads |
| `KIT_Dais_6x6` | 6 x 0.9 x 6 | 200 | `sanctum_marble` | 3 tiers at 0.3 / 0.6 / 0.9 |
| `KIT_Bridge_2x8` | 2 x 0.3 x 8 | 90 | `planks_weathered` | `-nav` deck, `-col` rails |
| `KIT_Wall_Straight_1` | 1 x 4 x 0.4 | 20 | per-room | Base wall module |
| `KIT_Wall_Straight_2` | 2 x 4 x 0.4 | 24 | per-room | |
| `KIT_Wall_Straight_4` | 4 x 4 x 0.4 | 32 | per-room | |
| `KIT_Wall_Half_4` | 4 x 2 x 0.4 | 24 | per-room | Parapet / balcony rail |
| `KIT_Wall_Corner_2` | 2 x 4 x 2 | 40 | per-room | L corner |
| `KIT_Wall_T_4` | 4 x 4 x 4 | 60 | per-room | T junction |
| `KIT_Wall_Cross_4` | 4 x 4 x 4 | 72 | per-room | 4-way junction |
| `KIT_Wall_End_2` | 2 x 4 x 0.4 | 28 | per-room | Dead-end cap |
| `KIT_Wall_Cathedral_4` | 4 x 8 x 0.6 | 120 | `wall_ashlar` | Clerestory opening at 5.5 m |
| `KIT_Pillar_Round_0.8` | 0.8 dia x 4 | 64 | `wall_ashlar` | Capital + base as separate nodes |
| `KIT_Pillar_Square_0.9` | 0.9 x 4 x 0.9 | 48 | `wall_ashlar` | |
| `KIT_Pillar_Cluster_1.4` | 1.4 dia x 6 | 160 | `wall_ashlar` | 4 shafts + capital |
| `KIT_Arch_Gothic_4` | 4 x 4 x 0.6 | 220 | `wall_ashlar` | Pointed arch opening |
| `KIT_Arch_Round_4` | 4 x 4 x 0.6 | 180 | `wall_ashlar` | |
| `KIT_Arch_FogGate_4` | 4 x 4 x 0.6 | 240 | `wall_ashlar` | Fog plane + `-nav` threshold + `-pod` anchor |
| `KIT_Gate_Portcullis_3` | 3 x 3.5 x 0.2 | 90 | `metal_plate_rusted` | `-break`, raises on lever |
| `KIT_Door_Wood_2` | 2 x 2.6 x 0.15 | 60 | `planks_weathered` | Hinged; blocks `-nav` when closed |
| `KIT_Door_Iron_2` | 2 x 2.6 x 0.15 | 70 | `metal_plate_rusted` | |
| `KIT_Door_Mirror_2` | 2 x 2.6 x 0.15 | 90 | `sanctum_marble` | Mirror-lock puzzle variant |
| `KIT_Ceiling_Vault_4x4` | 4 x 1.2 x 4 | 160 | `wall_plaster_aged` | Rib vault |
| `KIT_Ceiling_Beam_4x4` | 4 x 0.6 x 4 | 60 | `planks_weathered` | Exposed beams |
| `KIT_Roof_Hip_4x4` | 4 x 2 x 4 | 100 | `roof_clay_tiles` | Exterior roofs |
| `PRP_Barrel` | 0.7 dia x 1.0 | 120 | `planks_weathered` | `-break` |
| `PRP_Urn` | 0.5 dia x 0.9 | 90 | `wall_plaster_aged` | `-break` |
| `PRP_Crate` | 1.0 x 1.0 x 1.0 | 60 | `planks_weathered` | `-break`, climbable |
| `PRP_Bookshelf` | 1.2 x 2.2 x 0.4 | 180 | `planks_weathered` | `-break`, LoS blocker |
| `PRP_Table_Long` | 3.0 x 0.9 x 0.8 | 120 | `parlour_parquet` | Banquet rows |
| `PRP_Chair` | 0.5 x 1.0 x 0.5 | 70 | `parlour_parquet` | `-break` |
| `PRP_Statue` | 0.9 x 2.4 x 0.9 | 400 | `wall_ashlar` | Cover node, `-col` |
| `PRP_Chandelier` | 1.6 dia x 1.2 | 260 | `gold_gilt` | Hangs 3.5 m, `-lgt` |
| `PRP_Banner` | 1.2 x 3.0 | 40 | `fabric_wool_red` | Wall-mounted, no collider |
| `PRP_Brazier` | 0.6 x 1.2 | 150 | `bronze_eroded` | `-lgt`, `-fx` embers |
| `PRP_Cage` | 2.0 x 2.5 x 2.0 | 300 | `metal_plate_rusted` | Menagerie / prison |
| `PRP_Coffin` | 0.8 x 2.2 x 0.6 | 140 | `castle_floor_broken` | Crypt |
| `PRP_Altar` | 2.4 x 1.1 x 1.0 | 220 | `sanctum_marble` | |
| `PRP_Chest` | 1.0 x 0.8 x 0.7 | 160 | `planks_weathered` | Loot, `-break` for Mimic swap |
| `PRP_Throne` | 1.4 x 2.6 x 1.4 | 380 | `gold_gilt` | Sanctum |
| `PRP_Piano` | 1.6 x 1.4 x 0.8 | 300 | `parlour_parquet` | Music salon |
| `PRP_Mirror_Frame` | 1.2 x 2.4 x 0.2 | 120 | `bronze_eroded` | Mirror puzzles |
| `LGT_Sconce` | 0.3 x 0.5 | 40 | `bronze_eroded` | `-lgt`, warm amber |
| `LGT_Brazier` | 0.6 x 0.4 | 60 | `bronze_eroded` | `-lgt`, flicker |
| `LGT_Chandelier` | 1.6 dia | 180 | `gold_gilt` | `-lgt`, 6 point lights baked to 2 |
| `LGT_CandleCluster` | 0.4 x 0.3 | 30 | `wall_plaster_aged` | `-lgt`, low intensity |
| `LGT_SteamVent` | 0.6 x 0.6 | 20 | `copper_dirty` | `-fx` only, hazard marker |

### 6.2 Assembly rules

1. **Grid.** Floors tile on 1 m; walls sit on tile edges with their `-col` inset 0.05 m so the
   player capsule cannot catch on seams.
2. **Corners.** A room must be closed by `KIT_Wall_*` pieces on every perimeter edge except explicit
   door openings. A gap wider than 0.1 m is a level bug (caught by the collider audit in the Phase 3
   suite).
3. **Nav.** Every walkable surface must have a `-nav` node. The path grid rasterises `-nav` as walkable
   and every `-col` as blocked, with a 0.35 m agent radius inflation.
4. **Verticality.** Height changes use `KIT_Ramp_2x4`, `KIT_Stair_2x4`, `KIT_Stair_Spiral_4x4` or a
   `KIT_Dais_6x6` tier. Nothing is climbed without a traversal brand or an authored stair.
5. **Chasms.** `KIT_Floor_4x4_Chasm` must be ringed by either a rail (`KIT_Wall_Half_4`) or a bridge
   (`KIT_Bridge_2x8`); an unrailed chasm is only legal in Void Realm scenes where falling is a mechanic.
6. **Doors.** Every door connector is `KIT_Arch_FogGate_4` + a door piece; the `-pod` anchor inside the
   arch is the transition trigger, and the existing 108-exit door graph stays authoritative.
7. **Instancing.** Identical kit pieces in the same room share one `InstancedMesh` per material.
   Per-room material tint is applied through `instanceColor`, never by cloning materials.

### 6.3 Material palette (staged, CC0)

17 surface sets and one HDRI are staged in `public/assets/textures/pbr/`. `metresCovered` is the world
size one UV tile represents, which is what `MaterialLibrary` uses to set `texture.repeat`.

| Slug | ambientCG asset | Role | metresCovered | Primary use |
|---|---|---|---|---|
| `courtyard_cobble` | PavingStones051 | floor | 3.0 | Approach, Outer Wards |
| `dungeon_slab` | PavingStones127 | floor | 4.0 | Corridors, Undercrypt |
| `castle_floor_broken` | Tiles130 | floor | 3.0 | Ruined chapel, crypt |
| `sanctum_marble` | Marble006 | floor | 4.0 | Sanctum, boss dais |
| `parlour_parquet` | Wood051 | floor | 2.0 | Dollhouse, banquet, salon |
| `planks_weathered` | Planks037A | wood | 2.0 | Crates, doors, bridges |
| `wall_ashlar` | Bricks066 | wall | 3.0 | Fortress ashlar |
| `wall_brick_medieval` | Bricks094 | wall | 2.5 | Gatehouse, barracks |
| `wall_plaster_aged` | Plaster007 | wall | 3.0 | Interior parlours |
| `metal_plate_rusted` | MetalPlates013 | metal | 2.0 | Clockwork Spire, boilers |
| `bronze_eroded` | Metal017 | metal | 1.0 | Sconces, statuary, trim |
| `copper_dirty` | Metal047B | metal | 1.5 | Steam conduits |
| `gold_gilt` | Metal048C | metal | 0.75 | Antique gold accent (#d4af37) |
| `fabric_wool_red` | Fabric085 | cloth | 1.0 | Banners, drapes, runners |
| `roof_clay_tiles` | RoofingTiles014B | roof | 2.0 | Keep and gatehouse roofs |
| `ground_gravel` | Ground110 | ground | 4.0 | Courtyard soil |
| `snow_trodden` | Snow013 | ground | 3.0 | Winter Gauntlet |
| `night_sky_moon` | NightSkyHDRI003 | HDRI | - | PMREM environment / backdrop |

All CC0 1.0. Provenance and download recipe: `public/assets/textures/pbr/CREDITS.md` and
`tools/asset_pipeline/fetch_surfaces.py`. Nothing here is bound to geometry yet; the binding pass is
Phase 4 and is tracked as `VK-P4-002` in `BUGS.md`.

### 6.4 Room budgets

| Room class | Footprint | Tris | Draw calls | Unique materials | Lights |
|---|---|---|---|---|---|
| Pocket (S) | 12 x 12 | <= 45,000 | <= 35 | <= 4 | 2 |
| Chamber (M) | 24 x 24 | <= 90,000 | <= 45 | <= 5 | 4 |
| Wing (L) | 36 x 36 | <= 140,000 | <= 60 | <= 6 | 6 |
| Arena (XL) | 48 x 36 | <= 180,000 | <= 70 | <= 6 | 8 |
| Cathedral | 64 x 48 | <= 220,000 | <= 80 | <= 8 | 10 |

One directional shadow map (2048) plus a baked lightmap is the target; point lights beyond the budget
are faked with emissive materials and `-lgt` decals.

---

## 7. Text, localization and lore data

### 7.1 Existing tables

| File | Shape | Count | Notes |
|---|---|---|---|
| `src/data/dialogue.json` | keyed by speaker | 13 speakers, 51 nodes, 78 choices | Branch nodes carry `requiredStat` checks |
| `src/data/items.json` | array | 39 items | 13 categories, weapon stats, icon paths |
| `src/data/puzzles.json` | array | 30 puzzles | `roomCode`, `mechanicCategory`, step list |
| `src/data/quests.json` | array | 42 quests (7 main / 31 side / 4 hidden) | objectives, rewards, softlock safeguard |
| `src/data/zones.json` | array | 27 zones | adjacency, exits, spawn tiles |
| `src/data/world_manifest.json` | object | 50 scenes + 28-zone macro graph | bounds, surfaces, exits, puzzles |

These are already test-covered (`tests/dataIntegrity.test.ts`, `tests/worldManifest.test.ts`). They stay
the runtime source; the new text files below add the string domains they do not cover.

### 7.2 New files

| File | Purpose | Target size |
|---|---|---|
| `src/data/texts/ui.json` | Every HUD, menu, tooltip, button, error string | 180 keys |
| `src/data/texts/barks.json` | Combat and ambient barks per enemy/NPC | 32 entities x 6-16 lines |
| `src/data/texts/lore.json` | Codex entries, enemy lore, item flavour, journal | 120 entries |
| `src/data/texts/ask_wizard.json` | "Ask the Wizard" prompt/response bank | 64 entries, 8 topics |
| `src/data/enemies/bestiary.json` | 32 stat blocks derived from GDD 14/34.1 | 32 entries |
| `src/data/encounters/pods.json` | Encounter pods per scene (GDD 43.3) | 1-6 pods per scene |

### 7.3 Key and schema conventions

- **Key format**: `<domain>.<subject>.<id>` - e.g. `ui.hud.health`, `bark.guard.aggro.01`,
  `lore.byakko.entry_02`, `wizard.prompt.mirrors.01`.
- **Entry shape** (all text files):

```json
{
  "key": "ui.hud.health",
  "text": "Vitality {current}/{max}",
  "context": "HUD, bottom-left, always visible",
  "tokens": ["current", "max"],
  "maxChars": 24,
  "speaker": null,
  "gddRef": "16"
}
```

- **Interpolation**: `{token}` only; no printf, no HTML. Plurals are declared per entry as a
  `plural` object with `one` and `other` forms, selected by `{count}`.
- **No hardcoded strings**: every `textContent`, `innerHTML`, `aria-label` and tooltip in the UI reads
  from `ui.json`. The acceptance test greps the built bundle for a deny-list of literal English words
  in UI components.
- **Localization**: `text` is the English source; a sibling `loc/<lang>.json` with the same keys is
  optional. Missing keys fall back to English and log once, never throw.

### 7.4 Bark schema

```json
{
  "entityId": "keep_guard",
  "barks": {
    "aggro": ["Halt! In the Master's name!", "You there - stand and be counted."],
    "hurt": ["Agh - the ribs...", "You'll pay for that."],
    "death": ["The Master... sees...", "Cold... so cold..."],
    "alert": ["Alarm! Alarm on the west stair!"],
    "idle": ["Nothing on the parapet. Nothing all night.", "Eighty winters of this."]
  },
  "cooldownMs": 9000,
  "priority": ["alert", "aggro", "hurt", "death", "idle"]
}
```

Rules: 6 lines minimum per entity, 16 maximum; each line <= 90 characters; no line may name a mechanic
the player has not been taught; death lines are non-looping and never play twice for the same corpse.

### 7.5 "Ask the Wizard" bank

The game's framing device is asking the wizard (or the keep's echo of him) a question and receiving a
diegetic, unreliable answer. Each entry carries the state gate that unlocks it.

```json
{
  "id": "wizard.mirrors.01",
  "topic": "mirrors",
  "prompt": "Why do the mirrors in the east hall show me a different coat?",
  "answer": "Because a coat is a story you tell about your shoulders, and glass is a better liar than you are.",
  "requires": { "scene": "HM1", "flag": "PUZZLE_TRUE_MIRROR" },
  "gddRef": "11",
  "tone": "wry"
}
```

Topics (8 x 8 entries): `keep`, `mirrors`, `memory`, `steam`, `beasts`, `wizard`, `kaelen`, `ending`.
Every entry must cite a GDD section and must not contradict GDD 41.4's conflict resolutions.

### 7.6 Coverage targets

| Domain | Target | Gate |
|---|---|---|
| UI strings | 100% externalized | bundle grep for literals in `ui/` components |
| Enemies with barks | 32 / 32 | `bestiary.json` cross-check |
| NPCs with at least one greeting + 3 topics | 47 / 47 | dialogue.json coverage report |
| Items with description + flavour | 39 / 39 | existing test extended |
| Codex entries | 120 | lore.json count |
| Ask-the-Wizard | 64 | ask_wizard.json count |

---

## 8. Integration map

| Asset | Loader | Consumer | Verification |
|---|---|---|---|
| Character/enemy GLB | `GLTFLoader` + `RigLibrary` | `createGuard`, `playerMesh`, entity factories | `validate_assets.py`, `levels.spec.ts` |
| Kit GLB | `GLTFLoader` + instancing | `buildGenericScene` room assembler | room budget report, draw-call counter |
| PBR surface set | `MaterialLibrary.pbrMaterial(slug)` | room assembler materials | `assetManifest.test.ts` |
| Night HDRI | `EXRLoader` + `PMREMGenerator` | `Engine` environment | boot smoke test |
| `pbr_materials.json` | direct import | `MaterialLibrary` | `assetManifest.test.ts` |
| `bestiary.json` | typed loader | enemy factory, encounter director | unit test vs GDD 14 counts |
| `pods.json` | typed loader | encounter director | pod budget test (GDD 34.1) |
| `texts/*.json` | typed loader | HUD, dialogue, codex, announcer | key-coverage test |
| `doorGraph.ts` | static import | `checkExits` | `levels.spec.ts` (108 exits) |
| `world_manifest.json` | static import | scene registry, map | `worldManifest.test.ts` |

---

## 9. Verification gates

| Gate | Command | Threshold |
|---|---|---|
| Type check | `npx tsc --noEmit` | 0 errors |
| Unit tests | `npm test` | all pass (53 existing + asset manifest suite) |
| Data integrity | `npm test` | 27 zones / 42 quests / 30 puzzles / 39 items |
| World manifest | `npm run validate:world` | P0 = 0, P1 = 0 |
| Asset import | `python tools/asset_pipeline/validate_assets.py` | 0 violations |
| Surface kit | `npm test -- assetManifest` | every advertised map on disk |
| Scene boot + exits | `npm run test:levels` | 102/102 |
| Autoplay regression | `npm run e2e:autoplay` | 50/50 scenes, 4 endings |
| Build | `npm run build` | 0 errors, bundle within budget |

---

## 10. Staging inventory (what exists today)

### 10.1 Models (`public/assets/models/`)

| File | Tris | Materials | Joints | Clips | Role |
|---|---|---|---|---|---|
| `kaelen.glb` | 1,040 | 7 | 23 | Idle, Walk, Run, Attack, Dodge, Death | Player |
| `keep_guard.glb` | 1,254 | 7 | 24 | Idle, Walk, Attack, Hit, Death | Enemy + Orin body |
| `room_shell.glb` | 11,044 | 10 | - | - | Legacy single-room shell |
| `s00_courtyard.glb` | 27,880 | 14 | - | - | Approach diorama |
| `gate_arch.glb` | 3,148 | 7 | - | - | Door connector |
| `mirror_lock.glb` | 4,380 | 8 | - | - | Puzzle prop |
| `ag1_tree.glb` | 8,248 | 6 | - | - | Ancient Bough / Yggdra base |
| `bq1_feast.glb` | 19,972 | 8 | - | - | Banquet set piece |
| `mh1_hearth.glb` | 12,964 | 13 | - | - | Dollhouse hearth |
| `san1_sanctum.glb` | 4,932 | 6 | - | - | Sanctum throne |

Plus two `.blend` sources (`s00_courtyard.blend`, `veilkeep_room_kit.blend`).

### 10.2 Surfaces (`public/assets/textures/pbr/`)

17 material folders (Color 1024, NormalGL 1024, Roughness 512, AO 512 where the source has one) and
`night_sky_moon/sky_1k.exr`. Total staged payload 13.6 MB. Index: `src/data/pbr_materials.json`.

### 10.3 What is still missing

| Gap | Count | Blocking phase |
|---|---|---|
| Enemy meshes + rigs | 31 + Vaelor | Phase 3 |
| NPC meshes + rigs | 47 entries | Phase 3 |
| Player clips (secondary/cast/traversal) | 10 | Phase 3 |
| Modular kit pieces | 50 | Phase 3 |
| Diablo-scale room templates | 16 | Phase 2 |
| Encounter pod data | 1-6 per scene | Phase 2 |
| Text/bark/lore tables | 6 files | Phase 3 |
| Surface binding to geometry | all kit pieces | Phase 4 |

---

## Appendix A - Scene to room template assignment

All 50 playable scenes mapped to one of the 16 room templates defined in GDD 43.2.
`Now` is the authored `bounds` in `world_manifest.json`; `Target` is the Diablo-scale footprint
in metres the Phase 2 rebuild must reach. `Pods` is the encounter-pod count (GDD 43.3).

| Scene | Name | Zone | Now | Target | Template | Pods | Tag |
|---|---|---|---|---|---|---|---|
| S00 | The Approach & Sunken Courtyard | approach | 16x12 | 32x24 | Approach_Terrace | 3 | Z.Entry |
| OW1 | Outer Wards Courtyard & Panopticon | outer_wards | 20x16 | 32x24 | Approach_Terrace | 3 | Z.Hub |
| GH1 | Gatehouse Exterior & Orin's Watch | gatehouse | 14x12 | 10x32 | Grand_Corridor | 2 | Z.Narrative |
| GH2 | Gatehouse Mirror Lock Interior | gatehouse | 16x14 | 24x24 | Mirror_Maze_Wing | 2 | Z.Puzzle |
| GH3 | Captain's Landing & Bastion Overlook | gatehouse | 18x18 | 36x28 | Pillar_Hall_Arena | 3 | Z.Combat.SheriffRush |
| B1 | Barracks Postern | extended | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Combat.Boardroom |
| GH4 | Gatehouse Vent Ascent | extended | 14x14 | 16x16 | Spiral_Ascent | 2 | Z.Ascend |
| SQ1 | Servants Quarters | extended | 14x14 | 20x40 | Banquet_Long_Hall | 3 | Z.Hub |
| HM1 | Halls of Mirrors | extended | 14x14 | 32x32 | Mirror_Maze_Wing | 3 | Z.Puzzle |
| BQ1 | Banquet of Satiety | extended | 14x14 | 20x40 | Banquet_Long_Hall | 3 | Z.Narrative |
| AG1 | Ancient Bough | extended | 14x14 | 28x40 | Cathedral_Nave | 4 | Z.Narrative |
| MH1 | Mother Hazel Hearth | extended | 14x14 | 12x12 | Dollhouse_Miniature | 1 | Z.Boss |
| SAN1 | Sanctum of Vaelor | extended | 14x14 | 40x32 | Ritual_Chamber_Boss | 1 | Z.Boss |
| RC1 | Relativity Cloister | extended | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| BT1 | Belfry of the Void | extended | 14x14 | 16x16 | Spiral_Ascent | 2 | Z.Secret |
| CO1 | The Veil Colosseum | colosseum | 20x20 | 40x40 | Pillar_Hall_Arena | 4 | Z.Combat.Boardroom |
| U1 | Undercrypt Entrance | undercrypt | 14x14 | 32x28 | Split_Level_Crypt | 3 | Z.Combat.SheriffRush |
| U2 | Monk Tombs | undercrypt | 14x14 | 24x36 | Cathedral_Nave | 3 | Z.Combat.SheriffRush |
| U3 | Echo Chamber | undercrypt | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| U4 | Secret Vault | undercrypt | 14x14 | 20x20 | Hub_Sanctum | 2 | Z.Secret |
| TR1 | Trophy Hall Entrance | trophy | 14x14 | 32x24 | Gallery_Portrait_Hall | 3 | Z.Narrative |
| TR2 | Beast Row | trophy | 14x14 | 32x24 | Gallery_Portrait_Hall | 3 | Z.Narrative |
| TR3 | The Slain Beast | trophy | 14x14 | 32x24 | Gallery_Portrait_Hall | 3 | Z.Secret |
| TR4 | Curator's Alcove | trophy | 14x14 | 32x24 | Gallery_Portrait_Hall | 3 | Z.Narrative |
| AT1 | Star Chamber | astronomy | 14x14 | 16x16 | Spiral_Ascent | 2 | Z.Puzzle |
| AT2 | Constellation Floor | astronomy | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| AT3 | Hidden Room | astronomy | 14x14 | 20x20 | Hub_Sanctum | 2 | Z.Secret |
| AL1 | Lab | alchemy | 14x14 | 28x24 | Boiler_Core_Industrial | 3 | Z.Puzzle |
| AL2 | Storage | alchemy | 14x14 | 24x20 | Boiler_Core_Industrial | 2 | Z.Secret |
| AL3 | Vex Office | alchemy | 14x14 | 20x20 | Boiler_Core_Industrial | 2 | Z.Shop |
| PB1 | Cell Row | prison | 14x14 | 28x24 | Menagerie_Cages | 3 | Z.Combat.SheriffRush |
| PB2 | Guard Post | prison | 14x14 | 32x28 | Pillar_Hall_Arena | 1 | Z.Boss |
| PB3 | Warden Office | prison | 14x14 | 24x20 | Menagerie_Cages | 2 | Z.Narrative |
| PB4 | Escape Tunnel | prison | 14x14 | 10x32 | Grand_Corridor | 2 | Z.Secret |
| RG1 | Terrace | rooftop | 14x14 | 24x24 | Approach_Terrace | 2 | Z.Ascend |
| RG2 | Wind Maze | rooftop | 14x14 | 24x24 | Approach_Terrace | 2 | Z.Puzzle |
| RG3 | Glider Launch | rooftop | 14x14 | 24x24 | Approach_Terrace | 2 | Z.Ascend |
| RG4 | Vista Point | rooftop | 14x14 | 24x24 | Approach_Terrace | 2 | Z.Secret |
| VR1 | Threshold | void | 14x14 | 24x40 | Chasm_Bridge_Gauntlet | 3 | Z.Combat.SheriffRush |
| VR2 | Dream Logic Room | void | 14x14 | 24x40 | Chasm_Bridge_Gauntlet | 3 | Z.Puzzle |
| VR3 | The Core | void | 14x14 | 32x32 | Ritual_Chamber_Boss | 1 | Z.Boss |
| RS1 | Entry Landing | relativity | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| RS2 | Double-Sided Stair | relativity | 14x14 | 32x28 | Split_Level_Crypt | 3 | Z.Puzzle |
| RS3 | Wall-Floor Gallery | relativity | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| RS4 | Perspective Hub | relativity | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| RS5 | Window Garden | relativity | 14x14 | 24x24 | Cloister_Gallery | 2 | Z.Secret |
| RS6 | The Dining Table | relativity | 14x14 | 20x36 | Banquet_Long_Hall | 3 | Z.Narrative |
| CO3 | Crystal Theater | colosseum | 18x18 | 36x36 | Pillar_Hall_Arena | 4 | Z.Narrative |
| CR1 | Chronomantic Scriptorium | chronomancy | 18x18 | 24x24 | Cloister_Gallery | 2 | Z.Puzzle |
| MS3 | Parquet of Resonant Harmonies | music | 18x18 | 20x36 | Banquet_Long_Hall | 3 | Z.Narrative |

Template distribution:

- `Cloister_Gallery` - 9 scenes
- `Approach_Terrace` - 6 scenes
- `Pillar_Hall_Arena` - 4 scenes
- `Banquet_Long_Hall` - 4 scenes
- `Gallery_Portrait_Hall` - 4 scenes
- `Spiral_Ascent` - 3 scenes
- `Boiler_Core_Industrial` - 3 scenes
- `Grand_Corridor` - 2 scenes
- `Mirror_Maze_Wing` - 2 scenes
- `Cathedral_Nave` - 2 scenes
- `Ritual_Chamber_Boss` - 2 scenes
- `Split_Level_Crypt` - 2 scenes
- `Hub_Sanctum` - 2 scenes
- `Menagerie_Cages` - 2 scenes
- `Chasm_Bridge_Gauntlet` - 2 scenes
- `Dollhouse_Miniature` - 1 scenes

## Appendix B - Encounter pod registry (seed rows)

Budget costs use GDD 34.1 (Fodder 1, Striker 2, Controller 3, Tank 4, Elite 6, Boss 10).
A regular room may hold at most 6 cost of *active* pods; arenas may hold 10 per wave.
`Trigger` is the player-proximity radius that wakes a pod; `Leash` is the radius it may chase
before returning. A pod never wakes a neighbouring pod (GDD 43.3 rule 2).

| Pod | Scene | Sector | Trigger | Leash | Cost | Composition | Waves | Notes |
|---|---|---|---|---|---|---|---|---|
| OW1_POD_A | OW1 | north_gate | 6 m | 12 m | 2 | 2x keep_guard | 1 | Gate choke; teaches the pod rule |
| OW1_POD_B | OW1 | west_arcade | 7 m | 14 m | 3 | 1x archer_guard + 1x keep_guard | 1 | Ranged on the arcade, melee below |
| GH1_POD_A | GH1 | orin_watch | 5 m | 10 m | 0 | none (Orin dialogue) | 0 | Social pod, no combat budget |
| GH1_POD_B | GH1 | vent_ascent | 6 m | 12 m | 2 | 2x brigand_cutpurse | 1 | Ambush from the vent mouth |
| GH2_POD_A | GH2 | mirror_lock | 8 m | 8 m | 3 | 1x mirror_wraith | 1 | Wraith teleports between the lock mirrors |
| GH3_POD_A | GH3 | bastion | 10 m | 18 m | 6 | 1x minor_brigand_captain + 2x brigand_cutpurse | 2 | Captain pod; wave 2 adds an enforcer |
| B1_POD_A | B1 | bunk_row | 7 m | 14 m | 4 | 3x keep_guard + 1x clockwork_soldier | 2 | Barracks budget from GDD 34.1 |
| B1_POD_B | B1 | rafters | 6 m | 12 m | 2 | 1x archer_guard | 1 | Fires through the rafter gap |
| HM1_POD_A | HM1 | hall_center | 8 m | 16 m | 3 | 1x mirror_wraith + 1x phantasm_hound | 1 | Illusion pair, mirror source must be broken |
| BQ1_POD_A | BQ1 | long_table | 7 m | 12 m | 2 | 2x poltergeist_apparition | 1 | Hurls cutlery; no chase past the table |
| AG1_POD_A | AG1 | root_dais | 9 m | 16 m | 6 | 1x phantasmal_beast | 1 | Elite pod guarding the bough |
| MH1_POD_A | MH1 | hearth | 6 m | 6 m | 10 | 1x mother_hazel | 1 | Puzzle boss; lethal counter on direct attack |
| SAN1_POD_BOSS | SAN1 | throne | 12 m | 30 m | 10 | 1x vaelor | 4 | Phase-locked; arena seals on entry |
| CO1_POD_A | CO1 | west_ring | 8 m | 16 m | 2 | 2x keep_guard | 1 | Wave 1 of the colosseum |
| CO1_POD_B | CO1 | east_ring | 8 m | 16 m | 4 | 1x mirror_wraith + 2x phantasm_hound | 1 | Wave 2 |
| CO1_POD_C | CO1 | center_ring | 10 m | 20 m | 6 | 1x colosseum_beast | 1 | Wave 3 elite |
| U1_POD_A | U1 | stairwell | 6 m | 12 m | 3 | 2x undead_monk + 1x stone_gargoyle | 1 | Gargoyle starts as a statue |
| PB2_POD_BOSS | PB2 | guard_post | 9 m | 16 m | 6 | 1x castellan_dredge | 2 | Hammer recovery is the punish window |
| TR1_POD_A | TR1 | beast_row | 7 m | 12 m | 2 | 1x spectral_knife_juggler | 1 | Dagger fan down the row |
| RS2_POD_A | RS2 | double_stair | 7 m | 12 m | 3 | 1x dreamwalker (passive) | 1 | Never aggros; blocks the sightline |
| VR1_POD_A | VR1 | threshold | 8 m | 14 m | 4 | 1x temporal_paradox_wraith | 1 | Rewinds damage every 4 s |

Pod composition totals are asserted against GDD 34.1 by `tests/encounters.test.ts` once
`data/encounters/pods.json` exists (Phase 2).
