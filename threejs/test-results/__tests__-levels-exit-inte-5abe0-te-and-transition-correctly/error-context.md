# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: __tests__\levels.spec.ts >> exit integrity >> HM1 2 exits gate and transition correctly
- Location: __tests__\levels.spec.ts:223:5

# Error details

```
Error: HM1 -> BQ1 spawn z mismatch (-5 vs 2)

expect(received).toBeLessThan(expected)

Expected: < 0.75
Received:   7
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic: 👁️ SNEAKING (SILENT)
  - generic: 🛡️ HARMONIC PARRY ACTIVE
  - generic: "Barred Gate: Requires True Mirror Cleansed"
  - generic: Saved
  - generic: Combo x1
  - generic:
    - generic: E
    - generic: Suspicious Mirror (Requires Truth Lens Resonance)
  - generic:
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
    - generic: "!"
  - generic:
    - generic:
      - generic: Speaker
      - generic: Title
    - generic: Dialogue text goes here...
  - generic:
    - generic:
      - generic: Thief's Satchel & Relics
      - button "×"
    - generic:
      - generic: Select an item
      - generic: Click any item in your satchel to inspect its lore, attributes, and world interactions.
  - generic:
    - generic:
      - generic: Field Journal & Active Contracts
      - button "×"
    - generic:
      - generic: Active Contract (Q0)
      - generic: The Commission — Infiltrate the Keep
      - generic: Contracted by Guildmaster Sable. Breach the outer citadel, ground any phantasmal sentries with cold iron, and reach the high halls without raising alarm.
  - generic:
    - generic:
      - generic: Archival Record
      - button "×"
    - generic: Archival missive content...
  - generic:
    - generic:
      - generic: VEILKEEP — Suspended
      - button "×"
    - generic:
      - generic:
        - generic: Gothic Ambient Music
        - slider: "80"
      - generic:
        - button "Resume Expedition"
        - button "Load Last Checkpoint"
      - generic:
        - generic: Manual Save Slots
        - generic:
          - button "Save Slot 1"
          - button "Load Slot 1"
        - generic:
          - button "Save Slot 2"
          - button "Load Slot 2"
        - generic:
          - button "Save Slot 3"
          - button "Load Slot 3"
  - generic:
    - generic:
      - generic:
        - generic: 🧭 Cartography of Veilkeep
        - generic: 50 / 50 Explored
      - button "×"
    - generic:
      - generic:
        - generic:
          - generic: Zone Briefing
          - generic: Sunken Courtyard
        - generic: Select a discovered room to inspect architectural intel, relic locks, and active threats.
        - generic:
          - generic: Status & Hazards
          - generic: No active anomalies detected.
        - button "⚡ Fast Travel to Threshold" [disabled]
    - generic:
      - generic:
        - generic: 🧭 Current Location
        - generic: ✓ Cleansed
        - generic: ⚔️ Hazardous
        - generic: 🌫️ Terra Incognita
        - generic: 🌌 Starlight Portal
      - generic: Press M or Esc to return
  - generic:
    - generic:
      - generic [ref=e3]:
        - generic [ref=e4]:
          - generic [ref=e5]: VEILKEEP
          - 'button "🎵 Music: ON" [ref=e6] [cursor=pointer]':
            - generic [ref=e7]: 🎵
            - generic [ref=e8]: "Music: ON"
        - generic [ref=e9]: Banquet of Satiety
        - generic [ref=e10]:
          - generic [ref=e11]: HP
          - generic [ref=e15]: FP
          - generic [ref=e19]: STA
      - generic:
        - generic [ref=e23] [cursor=pointer]:
          - generic [ref=e24]: Folio [I / C]
          - generic [ref=e25]: 📜 Character & Relics
          - generic [ref=e26]: Kaelen (Lv. 4)
        - generic [ref=e27] [cursor=pointer]:
          - generic [ref=e28]: Expedition Map [M]
          - generic [ref=e29]: 🧭 Citadel Chart
          - generic [ref=e30]: 50 / 50 Explored
        - generic [ref=e31] [cursor=pointer]:
          - generic [ref=e32]: Active Contract [J]
          - generic [ref=e33]: S38 — The Cenacle of Eternal Satiety
          - generic [ref=e34]: "Objective: Infiltrate south ramparts"
    - generic:
      - generic:
        - generic: ⚙ Auto-Battler
        - generic: OFFLINE
      - generic: S00 · 1/50
      - generic: Press P to engage the automaton.
    - button "🤖 Autoplay" [ref=e35] [cursor=pointer]
    - generic:
      - generic: "Move: WASD | Sneak: Ctrl | Sprint: Shift | Attack: Space | Parry: X | Decoy: R | Rewind: B (RS) | Dash: C | Dart: V | Truth Lens: Q | Echo Bell: F | Folio: I | Journal: J | Map: M | Auto-Battler: P | Menu: Esc"
      - generic [ref=e36]: "Soft Clock: 21:45 (Night)"
  - generic:
    - generic:
      - generic: Alchemist's Bench
      - button "×"
    - generic:
      - generic: Select a recipe
      - generic: Click a recipe to see requirements and brew.
  - generic:
    - generic:
      - generic: Lore Codex
      - button "×"
    - generic:
      - generic: Select a discovered record
      - generic: Click a record to read its text.
  - generic: MINIMAP
  - generic: MEDIUM · 53 FPS · DPR 1.00
```

# Test source

```ts
  153 |   // `?autoplay=1` skips the title screen and origin picker deterministically.
  154 |   // The bot is stopped immediately so the level suite owns the player.
  155 |   await page.goto(`${BASE}/?autoplay=1&speed=8`, { waitUntil: 'load' });
  156 |   await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
  157 |   await page.evaluate(() => window.__veilkeep.autoplay.stop());
  158 |   await page.waitForTimeout(400);
  159 | 
  160 |   runtimeSceneIds = await page.evaluate(() => window.__veilkeep.qa.sceneIds());
  161 | });
  162 | 
  163 | test.afterAll(async () => {
  164 |   await page?.close();
  165 | });
  166 | 
  167 | test('runtime scene table is complete', async () => {
  168 |   expect(runtimeSceneIds.length).toBeGreaterThanOrEqual(50);
  169 |   expect(new Set(runtimeSceneIds).size).toBe(runtimeSceneIds.length);
  170 |   for (const id of REQUIRED_SCENES) expect(runtimeSceneIds).toContain(id);
  171 |   // The suite's static list and the runtime's scene map must agree, otherwise
  172 |   // the "every scene" claim is a lie.
  173 |   expect([...runtimeSceneIds].sort()).toEqual([...SCENE_IDS].sort());
  174 |   for (const id of SCENE_IDS) {
  175 |     expect(EXITS[id], `${id} must have an exit table`).toBeDefined();
  176 |   }
  177 |   const exitCount = Object.values(EXITS).reduce((sum, list) => sum + list.length, 0);
  178 |   expect(exitCount).toBeGreaterThanOrEqual(100);
  179 |   console.log(`  · ${SCENE_IDS.length} scenes, ${exitCount} exits`);
  180 | });
  181 | 
  182 | // --------------------------------------------------------------------------
  183 | // 1 + 2. Per-scene boot, asset audit, spawn and floor integrity.
  184 | // --------------------------------------------------------------------------
  185 | test.describe('scene boot, assets and colliders', () => {
  186 |   for (const id of SCENE_IDS) {
  187 |     test(`${id} boots clean and spawns on solid floor`, async () => {
  188 |       const from = mark();
  189 |       await loadScene(id);
  190 | 
  191 |       const spawn = await page.evaluate((scene) => window.__veilkeep.qa.spawnFor(scene), id);
  192 |       const bounds = await page.evaluate((scene) => window.__veilkeep.qa.boundsFor(scene), id);
  193 | 
  194 |       expect(spawn, `${id} needs a spawn`).toBeTruthy();
  195 |       expect(bounds, `${id} needs bounds`).toBeTruthy();
  196 | 
  197 |       // Spawn must be inside the authored room, not in the void beyond a wall.
  198 |       expect(Math.abs(spawn.x), `${id} spawn x is outside the room`).toBeLessThanOrEqual(bounds.width / 2 + 1);
  199 |       expect(Math.abs(spawn.z), `${id} spawn z is outside the room`).toBeLessThanOrEqual(bounds.height / 2 + 1);
  200 |       expect(spawn.y, `${id} spawn y is below the floor plane`).toBeGreaterThan(-1.0);
  201 | 
  202 |       // 60 physics ticks with gravity: the capsule must settle, not fall through.
  203 |       const afterTicks = await page.evaluate(() => window.__veilkeep.qa.stepPhysics(60));
  204 |       expect(afterTicks.y, `${id} capsule fell through the floor`).toBeGreaterThan(-1.0);
  205 |       expect(Number.isFinite(afterTicks.y), `${id} capsule position is not finite`).toBe(true);
  206 | 
  207 |       const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
  208 |       expect(diag.currentSceneId, `${id} diagnostics disagree with the scene`).toBe(id);
  209 |       expect(diag.drawCalls, `${id} rendered nothing`).toBeGreaterThan(0);
  210 |       expect(diag.geometries, `${id} has no geometry`).toBeGreaterThan(0);
  211 | 
  212 |       expectCleanSince(from, id);
  213 |     });
  214 |   }
  215 | });
  216 | 
  217 | // --------------------------------------------------------------------------
  218 | // 3. Every exit, locked and unlocked.
  219 | // --------------------------------------------------------------------------
  220 | test.describe('exit integrity', () => {
  221 |   for (const id of SCENE_IDS) {
  222 |     const exits = EXITS[id] ?? [];
  223 |     test(`${id} ${exits.length} exits gate and transition correctly`, async () => {
  224 |       for (const exit of exits) {
  225 |         const label = `${id} -> ${exit.to}`;
  226 | 
  227 |         // --- locked side: without the prerequisites the door must hold.
  228 |         await loadScene(id);
  229 |         const met = await requirementsMet(exit.requires);
  230 |         if (!met) {
  231 |           const from = mark();
  232 |           await page.evaluate(({ x, z }) => window.__veilkeep.qa.teleport(x, z), exit);
  233 |           await page.waitForTimeout(450);
  234 |           expect(await page.evaluate(() => window.__veilkeep.scene), `${label} opened without ${exit.requires.join('+')}`).toBe(id);
  235 |           expectCleanSince(from, `${label} locked`);
  236 |         }
  237 | 
  238 |         // --- unlocked side: granting the prerequisites must open it.
  239 |         await grant(exit.requires);
  240 |         const from = mark();
  241 |         await page.evaluate(({ x, z }) => window.__veilkeep.qa.teleport(x, z), exit);
  242 |         await expect
  243 |           .poll(() => page.evaluate(() => window.__veilkeep.scene), {
  244 |             message: `${label} never fired`,
  245 |             timeout: 5_000,
  246 |             intervals: [50, 100, 200],
  247 |           })
  248 |           .toBe(exit.to);
  249 | 
  250 |         const expected = exit.spawn ?? (await page.evaluate((scene) => window.__veilkeep.qa.spawnFor(scene), exit.to));
  251 |         const pos = await page.evaluate(() => window.__veilkeep.getDiagnostics().playerPos);
  252 |         expect(Math.abs(pos.x - expected.x), `${label} spawn x mismatch (${pos.x} vs ${expected.x})`).toBeLessThan(0.75);
> 253 |         expect(Math.abs(pos.z - expected.z), `${label} spawn z mismatch (${pos.z} vs ${expected.z})`).toBeLessThan(0.75);
      |                                                                                                       ^ Error: HM1 -> BQ1 spawn z mismatch (-5 vs 2)
  254 |         expect(pos.y, `${label} landed below the floor`).toBeGreaterThan(-1.0);
  255 | 
  256 |         const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
  257 |         expect(diag.drawCalls, `${label} destination rendered nothing`).toBeGreaterThan(0);
  258 |         expectCleanSince(from, label);
  259 |       }
  260 |     });
  261 |   }
  262 | });
  263 | 
  264 | // --------------------------------------------------------------------------
  265 | // 4. Memory stability over repeated room transitions.
  266 | // --------------------------------------------------------------------------
  267 | test('15 room transitions do not leak geometries or textures', async () => {
  268 |   // Warm every room in the cycle first: the first visit builds the room and is
  269 |   // expected to allocate. The leak question is what happens *after* that.
  270 |   await page.evaluate((cycle) => {
  271 |     for (const scene of cycle) window.__veilkeep.loadScene(scene);
  272 |   }, MEMORY_CYCLE);
  273 |   await settle();
  274 | 
  275 |   const readMemory = () =>
  276 |     page.evaluate(() => {
  277 |       const info = window.__veilkeep.renderer.info.memory;
  278 |       return { geometries: info.geometries, textures: info.textures };
  279 |     });
  280 | 
  281 |   const baseline = await readMemory();
  282 |   const samples: Array<{ geometries: number; textures: number }> = [];
  283 | 
  284 |   // S00 -> OW1 -> GH1 -> GH2 -> GH3 -> S00, three times = 15 transitions.
  285 |   for (let rep = 0; rep < 3; rep++) {
  286 |     for (const scene of [...MEMORY_CYCLE, 'S00']) {
  287 |       await page.evaluate((id) => window.__veilkeep.loadScene(id), scene);
  288 |       await page.waitForTimeout(100);
  289 |       samples.push(await readMemory());
  290 |     }
  291 |   }
  292 | 
  293 |   const final = samples[samples.length - 1];
  294 |   const maxGeometries = Math.max(...samples.map((s) => s.geometries));
  295 |   const maxTextures = Math.max(...samples.map((s) => s.textures));
  296 | 
  297 |   console.log(
  298 |     `  · memory baseline ${baseline.geometries}g/${baseline.textures}t -> ` +
  299 |       `final ${final.geometries}g/${final.textures}t ` +
  300 |       `(peak ${maxGeometries}g/${maxTextures}t over ${samples.length} samples)`,
  301 |   );
  302 | 
  303 |   // A room transition may reuse or rebuild a handful of objects, but it must
  304 |   // not scale with the number of transitions.
  305 |   expect(final.geometries - baseline.geometries, 'geometries grew across 15 transitions').toBeLessThanOrEqual(8);
  306 |   expect(final.textures - baseline.textures, 'textures grew across 15 transitions').toBeLessThanOrEqual(4);
  307 |   expect(maxGeometries - baseline.geometries, 'geometry peak grew across 15 transitions').toBeLessThanOrEqual(12);
  308 |   expect(maxTextures - baseline.textures, 'texture peak grew across 15 transitions').toBeLessThanOrEqual(6);
  309 | 
  310 |   // And the cycle must still render after the churn.
  311 |   const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
  312 |   expect(diag.drawCalls).toBeGreaterThan(0);
  313 |   expect(diag.currentSceneId).toBe('S00');
  314 | });
  315 | 
```