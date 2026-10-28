# VEILKEEP: The Illusionist's Fortress — Master GDD v3.0
**Full-Scene Room Architecture, Dual-Perspective Camera (First-Person + Isometric), Skyrim-Inspired RPG Scaling, 3-Phase Boss Battles & Multi-Step Environmental Puzzles**

## 1. Executive Summary & v3.0 Overhaul Scope

**Veilkeep: The Illusionist's Fortress** (`findthewizard`) follows **Kaelen Voss, the Shadowhand**, infiltrating the sky-fortress of **Archillusionist Vaelor** to seize the *Heart of Mirrors*. Version 3.0 upgrades the whitebox single-prop rooms and 1–2 hit encounters into a richly dressed Victorian Gothic / Arcane Fantasy action-RPG featuring:

1. **Dual-Perspective Camera & Movement Architecture**:
   - Seamless real-time toggle (`V` key or HUD switch) between **First-Person Perspective Mode** (`75° FOV`, eye height `1.68m` grounded to local floor height with subtle stride head-bob, pointer-lock + drag mouse-look, first-person weapon/hand viewmodel, automatic culling of the player's own head/torso mesh to prevent internal geometry clipping, camera-relative WASD + strafe movement) and **Classic Dimetric Isometric Mode** (`35.264°` pitch, `45°` yaw orthographic projection with world-axis movement and full character rig visibility).
2. **Strict Grounding & Elevation Alignment (`Y = 0.0` Floor Anchor)**:
   - Every static prop, interactive puzzle mechanism, NPC, item pickup pedestal, and rigged mob enforces a root-at-feet / base-at-zero convention (`localMinY = 0.0`).
   - Only explicitly designated aerial or arcane-suspended entities (`floating: true`, such as **Scholar Specters**, **Floating Grimoires**, **Wraiths**, and **Harpies**) hover above the ground using deterministic sinusoidal levitation offsets.
3. **Full Multi-Prop Scene Dressing Across All Fortress Rooms**:
   - Every room is transformed from a sparse box with one item and one mob into a dense, atmospheric architectural diorama and navigable 3D space with 25–80 modular props, perimeter architectural framing, secondary lighting, and interactive environmental storytelling.
4. **Skyrim-Inspired RPG Leveling, Skill Trees & Difficulty Sliding**:
   - Replaces flat 1–2 hit kills with a 6-tier **Difficulty Slider** (*Novice, Apprentice, Adept, Expert, Master, Legendary*), hyperbolic **Armor Rating mitigation** ($\text{Mitigation} = \min(0.80, \text{ArmorRating} \times 0.0012 + \text{WardBonus})$), **Zone Level Scaling** with floor/ceiling clamping, and **Usage-Based Skill Progression** (*Blade & Parry*, *Shadowcraft & Evasion*, *Arcane Lore & Wards*).
   - Tactical stamina management governs Light Strikes, Armor-Piercing Heavy Strikes, Timed Parries, and Invulnerability-Frame (`i-frame`) Dodge Rolls.
5. **Rigged, Animated 3-Phase Boss Encounters**:
   - All five major fortress bosses (**Barbican Captain**, **Major Captain of the Colosseum**, **The Sunken Wyrm**, **Grand Inquisitor Vael**, and **Archillusionist Vaelor**) operate on a 3-Phase State Machine (`100%–66%`, `66%–33%`, `33%–0%` HP) with distinct skeletal animations, ground telegraph decals, stamina-punishing combos, arena hazards, and non-lethal Thief Tradecraft sabotage resolutions.
6. **Complex Multi-Step Spatial & Mechanical Puzzles**:
   - Eliminates single-click or "talk-to-NPC-to-solve" shortcuts. NPCs provide lore ciphers and observational hints, while puzzles require multi-stage physical manipulation in 3D space (navigating the 9x9 **Hedge Maze** to trigger 3 pressure plates and install the Clockwork Gear; cross-referencing 4 **Arcane Tomes** in the Grand Library and rotating mirror reflectors; balancing **Hydraulic Sluice Valves** in the Flooded Crypts).

---

## 2. Full-Scene Room Architecture & Prop Manifests

Every zone in `zones.json` and `RoomSceneBuilder.ts` is populated with a full architectural kit, perimeter dressing, lighting fixtures, interactive puzzle machinery, grounded patrols, and environmental storytelling.

| Zone / Scene ID | Room Name | Grid Size | Architectural Kit & Full-Scene Prop Manifest | Grounded Mobs & Bosses (`floating` flag) | Multi-Step Puzzle & Key Items |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `OW1` (`outer`) | **Outer Wards & Sunken Courtyard** | `20m × 20m` | Crumbled gothic curtain walls, 6 weathered gargoyle plinths, 4 wrought-iron gatehouse braziers (flickering point lights), sunken cobblestone drainage basin, overturned supply wagon, 8 moss-draped stone columns, wooden scaffolding, weapon barrels, iron portcullis arch. | 2× **Risen Watchmen** (`floating: false`), 1× **Aether Cultist Initiate** (`floating: false`) | **P1 / P9 Counterweight Winch**: Requires locating `ITEM_IRON_NAIL` in the overturned wagon, jamming the ratcheted gear housing, and hauling the 2-stage chain hoist to unseal the North Barbican Gate. |
| `GH1–GH3` (`gate`) | **Gatehouse & Barbican Keep** | `18m × 18m` | Murder-hole ceiling grating, 6 heavy oak weapon racks (halberds, crossbows, kite shields), 4 stone arrow-slit alcoves, suspended iron counterweight cage on overhead chains, war-map tactical table with miniature fortress markers, 6 wall sconces, oil cauldron embrasures. | 2× **Barbican Halberdiers** (`floating: false`), **Boss: Barbican Captain** (`floating: false`) | **P2 Portcullis Pinion & Cage Sabotage**: Align 3 gatehouse lever ratchets (`W-E-N` sequence) to unlock the portcullis or release the overhead counterweight cage during the Captain boss fight. |
| `C01` (`barracks` / `courtyard`) | **Colosseum Courtyard & Sundial Plaza** | `24m × 24m` | Sunken gladiatorial sand pit ringed by 12 tiered stone spectator arches, central bronze **Meridian Sundial** with rotatable gnomon, 4 directional heliostat mirror pedestals, 6 chained lion cages, banner standards of the Radiant Aegis, 8 perimeter torch pillars. | 2× **Corrupted Knights** (`floating: false`), **Boss: Major Captain of the Colosseum** (`floating: false`) | **P26 Meridian Sundial & Heliostat Array**: Install `ITEM_SUNDIAL_GNOMON`, rotate the 4 perimeter heliostat mirrors to bounce the moonbeam across the plaza onto the 3 lunar sigils (`Azimuth 45° → 135° → 225°`). |
| `L1` (`library`) | **Grand Arcane Library & Archival Sanctum** | `22m × 22m` | 16 towering two-story mahogany **Bookshelves** packed with 400+ procedural leather-bound tomes, upper-tier wrought-iron mezzanine gallery with rolling brass ladders, 4 green-glass scholar **Study Desks** with inkwells and quills, central **Brass Chronomantic Astrolabe**, 4 elemental **Archival Lecterns** (*Ignis, Aqua, Terra, Aer*), 6 floating candelabrum chandeliers, scattered scroll racks, reading globes, and velvet armchairs. | 2× **Scholar Specters** (`floating: true`, `hoverHeight: 0.45m`), 1× **Animated Ink Automaton** (`floating: false`) | **P12 Four-Tome Elemental Cipher & Mirror Lock**: Read the cipher clue from Archivist Orin, locate and inspect the 4 elemental grimoires hidden across the shelves to learn the verse order (`Ignis → Aer → Aqua → Terra`), then activate the 4 Archival Lecterns in sequence while holding `ITEM_SCHOLAR_CIPHER`. |
| `HM1` (`hedge_maze`) | **Labyrinthine Hedge Maze** | `26m × 26m` | Full navigable **9×9 Grid Yew Hedge Labyrinth** (`3.2m` tall dense topiary walls with collision bounds), 3 retractable **Iron Thorn Gates** (`Gate Alpha, Beta, Gamma`), 3 sunken stone **Moon-Rune Pressure Plates** hidden in dead-end alcoves, 4 weeping marble dryad statues, luminous blue nightshade flora clusters, central **Clockwork Gazebo** with exposed brass differential gears, mist emitters. | 2× **Bramble Stalkers** (`floating: false`), **Mini-Boss: Labyrinth Minotaur Warden** (`floating: false`) | **P23 / P24 Navigable Labyrinth & Clockwork Differential**: Physically navigate the 3D hedge corridors (no dialogue bypass), step on the 3 Moon-Rune Pressure Plates in sequence (`SW Alcove → NE Alcove → NW Alcove`) to retract the Iron Thorn Gates, recover `ITEM_CLOCKWORK_GEAR`, and mesh the 3 gazebo gear ratios (`12T : 24T : 36T`). |
| `CR01` (`columbarium`) | **The Columbarium & Flooded Crypts** | `20m × 20m` | 24 recessed catacomb burial niches with funerary urns, 6 carved templar stone **Sarcophagi**, sunken flooded canal basin (`water level Y = -0.4m`), 3 brass **Hydraulic Sluice Gate Wheels** (`Intake, Bypass, Drain`) with live pressure gauges, weeping angel effigies, bone reliquaries, green soul-fire braziers. | 2× **Crypt Skeleton Archers** (`floating: false`), 1× **Mourning Wraith** (`floating: true`, `hoverHeight: 0.5m`), **Boss: The Sunken Wyrm** (`floating: false`, amphibious) | **P14 / P30 Hydraulic Sluice Pressure Balancing**: Install `ITEM_UNDERCITY_VALVE_HANDLE` and adjust the 3 sluice valves (`Intake = 2, Bypass = 1, Drain = 3`) to equalize pressure at `40 PSI`, draining the crypt basin to expose the Wyrm's ventral weak point and unlock the sanctum crypt door. |
| `RT1` (`rooftop`) | **Fortress Rooftops & Aeolian Belfry** | `18m × 18m` | Sloped slate battlements, 8winged gothic **Gargoyle Waterspouts**, central **Aeolian Belfry** with 4 tuned bronze resonance bells, spinning copper **Rooftop Anemometer**, lightning rod capacitors, rain-slicked stone walkways, wooden crane jib. | 2× **Tempest Harpies** (`floating: true`, `hoverHeight: 0.85m`), 1× **Clockwork Sentinel** (`floating: false`) | **P13 Aeolian Harmonic Bell Sequence**: Unlock the water basin with `ITEM_ROOFTOP_WATER_KEY` to fill the resonance troughs, then strike the 4 bronze bells in harmonic interval order (`Fourth → Fifth → Octave → Root`) matching the wind vane direction. |
| `T01` (`chantry`) | **Inquisitor's Chantry & Astral Nave** | `22m × 22m` | 10 vaulted gothic stained-glass lancet windows casting colored light pools, 12 carved oak pews, raised inquisitorial pulpit, 4 **Aether Conduit Pylons** with rotating crystal rings, hanging thurible censers, inquisitorial chains and reliquary cases. | 2× **Radiant Aegis Paladins** (`floating: false`), **Boss: Grand Inquisitor Vael** (`floating: false`) | **P28 Chantry Light Refraction**: Rotate the 4 prism lecterns between the pews so stained-glass beams converge on the pulpit seal, disabling Vael's divine ward generator. |
| `T05` / `S1` (`sanctum`) | **Upper Spire & Vaelor's Shattered Sanctum** | `26m × 26m` | Circular obsidian astral platform ringed by 8 towering **Shattered Mirror Monoliths**, central floating **Heart of Mirrors** containment astrolabe, 4 **Aether Conduit Generators**, non-Euclidean floating stair segments at perimeter, arcane bookshelves, alchemical distillation apparatus, star-chart floor inlay. | **Final Boss: Archillusionist Vaelor (The Wizard)** (`floating: false` Phases 1–2, controlled levitation during Phase 3 Shattered Veil) | **P29 Aether Conduit Resonance & Mirror Dispel**: Ring `ITEM_ECHO_BELL` at the 4 Aether Conduits when their harmonic phase aligns to shatter Vaelor's illusion tethers or seal the conduits for the non-lethal resolution. |

---

## 3. First-Person & Classic Isometric Dual-Camera Specification

### 3.1 First-Person Perspective Mode (`fpMode = true`)
- **Projection & Framing**: `THREE.PerspectiveCamera(75, aspect, 0.08, 250)`.
- **Grounded Eye Height & Head-Bob**:
  - Camera position is anchored at the player's grounded XZ coordinates with `eyeHeight = groundY + 1.68m`.
  - During movement, a damped sinusoidal stride oscillation applies `verticalBob = sin(walkPhase * 2) * 0.035m` and `horizontalSway = cos(walkPhase) * 0.018m`.
  - During a **Dodge Roll**, camera height smoothly ducks to `groundY + 0.85m` with a subtle roll tilt (`±6°`) instead of disorienting 360° camera flips.
- **Look Controls & Smooth Transition**:
  - Supports **Pointer Lock** (`canvas.requestPointerLock()`) for raw mouse-look (`yaw -= movementX * 0.0022`, `pitch = clamp(pitch - movementY * 0.0022, -78°, +78°)`), plus fallback **Right-Click / Left-Drag Look** and `Q / E` or Arrow-key turn support so gameplay works seamlessly inside embedded browser iframes and Canvas previews.
  - Switching from Isometric to First-Person initializes `yaw` directly from `player.rotation.y` and sets `pitch = -0.08 rad`, eliminating camera snapping.
- **Self-Mesh Culling & First-Person Viewmodel**:
  - In First-Person mode, the third-person character mesh's head, neck, torso, and cape sub-meshes are set to `visible = false` (while keeping `castShadow = true` via shadow-only material override or frustum offset), completely eliminating internal head/hair clipping.
  - A dedicated **First-Person Viewmodel Rig** renders Kaelen's right-hand blade (`Shadowfang Dagger` / `Astral Broadsword`) and left-hand arcane ward/lantern in the lower screen corners, animating in sync with light attacks, heavy windups, parry blocks, and spell casts.
- **Camera-Relative Movement & Wall Sliding**:
  - `W / S` move along the camera's horizontal forward vector $(\sin(\text{yaw}), 0, \cos(\text{yaw}))$; `A / D` strafe along the perpendicular right vector.
  - Capsule collision checks against room walls, bookshelves, and hedge maze corridors resolve penetration with smooth wall-sliding along the surface normal.

### 3.2 Classic Isometric Diorama Mode (`fpMode = false`)
- **Projection**: `THREE.OrthographicCamera` at true dimetric angles (`35.264°` pitch, `45°` yaw, distance `40m`, configurable zoom `viewSize = 14–22`).
- **Wall Cutaway Shader / Occlusion Fade**: South and East perimeter walls or tall bookshelves between the isometric camera and the player automatically fade to `opacity = 0.22` (`transparent = true`) when occluding Kaelen or nearby enemies.

---

## 4. Grounding & Elevation System (`Y = 0.0` Guarantee)

To eliminate floating mobs and props across all 50 scenes:
1. **Blender & GLB Origin Convention**:
   - All character armatures (`Hips` parented to `Root` at `[0,0,0]`) and static meshes are shifted prior to export so the lowest vertex of their rest pose sits at `Z = 0.000` in Blender (`Y = 0.000` in glTF 2.0).
2. **Runtime Grounding Pass (`snapObjectToGround`)**:
   - In `EnemyFactory.ts`, `NpcFactory.ts`, `PuzzleFactory.ts`, and `RoomSceneBuilder.ts`, every spawned `THREE.Object3D` executes:
     ```ts
     object.updateMatrixWorld(true);
     const bounds = new THREE.Box3().setFromObject(object);
     const localBottomOffset = bounds.min.y - object.position.y;
     const floorY = physicsWorld.sampleFloorHeight(object.position.x, object.position.z);
     object.position.y = floorY - localBottomOffset + (entity.floating ? entity.hoverHeight : 0);
     ```
   - Skinned meshes reset their skeleton to rest pose (`skeleton.pose()`) before bounding-box sampling so keyframe offsets never corrupt the vertical ground offset.

---

## 5. Skyrim-Inspired RPG Scaling, Combat & Progression

### 5.1 Difficulty Slider (6 Skyrim Tiers)
Accessible at any time from the HUD / Settings menu, dynamically scaling both player damage output and enemy damage/aggression:

| Difficulty Tier | Player Damage Multiplier | Enemy Damage Multiplier | Enemy Poise & HP Scale | AI Aggression & Feint Rate |
| :--- | :---: | :---: | :---: | :--- |
| **Novice** | `1.50×` | `0.50×` | `0.75×` | Low (generous telegraph windows) |
| **Apprentice** | `1.25×` | `0.75×` | `0.90×` | Moderate |
| **Adept (Default)** | `1.00×` | `1.00×` | `1.00×` | Balanced tactical spacing |
| **Expert** | `0.75×` | `1.50×` | `1.25×` | High (Roll-catching delayed swings) |
| **Master** | `0.50×` | `2.00×` | `1.55×` | Very High (Coordinated flanking) |
| **Legendary** | `0.35×` | `3.00×` | `2.10×` | Relentless (Requires mastery of parry & i-frames) |

### 5.2 Zone Level Scaling & Combat Math (No More 1–2 Hit Kills)
- **Enemy Level Calculation**:
  $$\text{EnemyLevel} = \text{clamp}\left(\text{ round}(\text{PlayerLevel} \times 0.85 + \text{ZoneBaseOffset}),\; \text{ZoneMinLevel},\; \text{ZoneMaxLevel} \right)$$
- **Enemy Health & Armor Scaling**:
  $$\text{MaxHP}_{\text{mob}} = \text{BaseHP} \times \left(1 + 0.18 \times (\text{EnemyLevel} - 1)\right) \times \text{DifficultyHPScale}$$
  - *Standard Guard (`BaseHP = 140`)* at Level 1 Adept has **140 HP** and **120 Armor Rating** (~18% damage reduction).
  - Player Light Attack deals `18–22` raw damage (`~15–18` mitigated), requiring **7–9 tactical hits** (or 4–5 hits with Heavy Attacks, Parries, and Bleed/Backstab crits) to defeat a standard guard—never 1–2 hits.
  - *Bosses (`BaseHP = 520–950`)* require sustained multi-phase engagements across 2–4 minutes of active dodging, parrying, and environmental tactics.
- **Skyrim Hyperbolic Armor Mitigation**:
  $$\text{DamageReduction} = \min\left(0.80,\; \text{ArmorRating} \times 0.0012 + \text{ActiveWardBonus}\right)$$
- **Usage-Based Skill Leveling & Perks**:
  - **Blade & Parry**: Gains XP on landing light/heavy strikes and timed parries. Perks: *Armsmen (+20% melee)*, *Deep Wounds (bleed DoT)*, *Deflect Arrows & Spells*.
  - **Shadowcraft & Evasion**: Gains XP on i-frame dodge-rolls through enemy attacks, backstabs, and lockpicking/puzzles. Perks: *Silent Roll (+0.12s i-frames, -25% roll stamina)*, *Assassin's Blade (2.5× stealth/stagger crit)*.
  - **Arcane Lore & Wards**: Gains XP on casting Aether Pulse, Ward Shield, and solving arcane puzzles. Perks: *Resonant Ward (parrying restores Focus)*, *Shatter Illusion (bonus damage vs clones/specters)*.

### 5.3 Tactical Stamina, Dodge-Roll i-Frames & Parry Poise
- **Light Attack (`LMB` / `J`)**: Fast `0.42s` swing, `12 Stamina`, builds combo chain (`1.0× → 1.15× → 1.35×` damage).
- **Heavy Attack (`RMB` / `K` or `Shift+LMB`)**: Charged `0.85s` cleave, `28 Stamina`, deals `2.1×` damage and `3.0×` **Poise Damage** to shatter enemy shields.
- **Dodge Roll (`Space`)**: Consumes `22 Stamina`, propels Kaelen `3.4m` along input vector over `0.55s` with **Invulnerability Frames (`0.06s – 0.42s`)**. Rolling through a red unparriable boss AoE triggers a *Shadow Counter* window (`+40%` next strike damage).
- **Timed Parry / Block (`F` / `Right-Click Hold`)**: Raising the blade within `0.22s` of an incoming yellow-telegraphed attack triggers a **Harmonic Parry**, negating 100% damage, dealing `45 Poise Damage`, and opening the enemy to a high-damage **Riposte**.

---

## 6. Three-Phase Boss Encounters (Rigged & Animated)

Every boss encounter features a 3-segment Phase Bar (`Phase I: 100%–66%`, `Phase II: 66%–33%`, `Phase III: 33%–0%`), custom skeletal animations, color-coded ground telegraphs (**Yellow Ring** = Parriable, **Red Ring** = Unblockable / Must Dodge-Roll), and a non-lethal sabotage alternative:

1. **Barbican Captain (`GH3`)**:
   - *Phase I (Disciplined Bastion)*: Shield-wall advances, 2-hit halberd thrust + sweep combo, calls arrow volleys from alcoves.
   - *Phase II (Iron Juggernaut — 66% HP)*: Ignites oil-soaked halberd; performs leaping overhead slams (Red AoE cone) and shield bash rushes that require sideways dodge-rolling.
   - *Phase III (Last Stand of the Gate — 33% HP)*: Enrages with +30% attack speed, spinning 360° halberd whirlwinds and portcullis shockwaves. *Non-Lethal*: Lure him beneath the central floor grate and release the **Counterweight Cage** (`P2`).
2. **Major Captain of the Colosseum (`C01`)**:
   - *Phase I*: Twin-blade gladiator lunges and sand-blindness sweeps.
   - *Phase II*: Unlocks perimeter lion-trap hazards and chained-blade whirlwind pulls.
   - *Phase III*: Solar Aegis overdrive—reflects frontal attacks unless blinded by aligning the **Meridian Sundial Heliostats** (`P26`).
3. **The Sunken Wyrm (`CR01`)**:
   - *Phase I*: Submerges in the flooded crypt canal, lunging for bite sweeps and tail-whip shockwaves.
   - *Phase II*: Spits corrosive bile geysers (Red ground pools) and coils around sarcophagi to crush cover.
   - *Phase III*: Electrifies the floodwaters—player must either hop between stone sarcophagi or solve the **Hydraulic Sluice Valves** (`P30`) to drain the basin and expose its ventral scales.
4. **Grand Inquisitor Vael (`T01`)**:
   - *Phase I*: Radiant mace combos and condemnation chains.
   - *Phase II*: Summons **Aether Conduit Wards** that regenerate his Poise until the player shatters the prism beams (`P28`).
   - *Phase III*: Ascendant Zealot—teleports between stained-glass beams, calling down pillar-of-light AoEs requiring timed directional rolls.
5. **Archillusionist Vaelor — The Wizard (`T05` / `S1`)**:
   - *Phase I (Master of Mirrors — 100%–66% HP)*: Casts linear Arcane Bolts, teleports between the 8 Mirror Monoliths, and summons 2 **Mirror Decoy Clones** (clones shimmer with violet phase-distortion and shatter in 1 hit or via `Aether Pulse`).
   - *Phase II (Chronomantic Fracture — 66%–33% HP)*: Summons expanding temporal slow-domes, fires 5-orb homing **Arcane Barrages**, and sweeps the arena with rotating mirror-laser beams that must be dodge-rolled through using i-frames.
   - *Phase III (Shattered Veil Reality Shift — 33%–0% HP)*: Darkens the sanctum into the Astral Void, levitates above the central astrolabe, chains teleport-scythe combos with meteoric Glass Storms, and channels the *Unmaking Nova* unless interrupted by ringing the **Echo Bell** at the active Aether Conduits (`P29`).
