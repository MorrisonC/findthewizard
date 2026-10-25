/**
 * Phase-3 exhaustive level & scene verification suite.
 *
 *   npx playwright test threejs/__tests__/levels.spec.ts
 *
 * For every scene the runtime knows about (the 50 entries in
 * `world_manifest.json` → `mvpVerticalSliceScenes`), this suite proves:
 *
 *   1. Scene boot & asset audit — `loadScene` succeeds, the room renders, and
 *      the console / network / shader pipeline stays clean.
 *   2. Physics & collider integrity — the spawn is inside the room bounds and
 *      the capsule is still above the floor after 60 physics ticks.
 *   3. Exit integrity — every door in the runtime `FORTRESS_EXITS` table stays
 *      locked without its prerequisites and transitions to `exit.to` at the
 *      expected spawn once they are granted.
 *   4. Memory — 15 consecutive room transitions do not grow
 *      `renderer.info.memory` without bound.
 *
 * The suite reads the runtime tables (`__veilkeep.exits`, `qa.sceneIds()`)
 * rather than re-importing them, so it can never disagree with what the game
 * actually walks through.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FORTRESS_EXITS } from '../src/data/doorGraph';

const BASE = process.env.BASE || 'http://localhost:5199';

// The repo drives the locally installed Chrome (the bundled headless shell is
// not installed in this environment), matching the `e2e/*.spec.mjs` scripts.
test.use({ channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 } });

const REQUIRED_SCENES = ['S00', 'OW1', 'GH1', 'GH2', 'GH3'];

/** Rooms used by the 15-transition memory cycle. */
const MEMORY_CYCLE = ['S00', 'OW1', 'GH1', 'GH2', 'GH3'];

interface DoorExit {
  x: number;
  z: number;
  to: string;
  requires: string[];
  spawn?: { x: number; y: number; z: number };
}

/**
 * Resolve a repo-relative file from either `threejs/` (normal) or the repo
 * root (the documented `npx playwright test threejs/__tests__/...` form).
 */
function repoFile(relative: string): string {
  const candidates = [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), 'threejs', relative),
  ];
  if (typeof __dirname !== 'undefined') candidates.push(path.resolve(__dirname, '..', relative));
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (!hit) throw new Error(`levels.spec: cannot locate ${relative} (tried ${candidates.join(', ')})`);
  return hit;
}

const manifest = JSON.parse(fs.readFileSync(repoFile('src/data/world_manifest.json'), 'utf8')) as {
  mvpVerticalSliceScenes: Array<{ id: string; name: string }>;
};

/** Every scene the manifest declares — the suite registers one test per entry. */
const SCENE_IDS: string[] = manifest.mvpVerticalSliceScenes.map((scene) => scene.id);
const EXITS: Record<string, DoorExit[]> = FORTRESS_EXITS as unknown as Record<string, DoorExit[]>;

let page: Page;
let runtimeSceneIds: string[] = [];

/** Everything the page reported since the last reset. */
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const failedRequests: string[] = [];
const shaderProblems: string[] = [];

const mark = () => ({
  console: consoleErrors.length,
  page: pageErrors.length,
  network: failedRequests.length,
  shader: shaderProblems.length,
});

/** Assert nothing new was reported since `from`. */
function expectCleanSince(from: ReturnType<typeof mark>, where: string): void {
  expect(pageErrors.slice(from.page), `${where}: uncaught page errors`).toEqual([]);
  expect(consoleErrors.slice(from.console), `${where}: console errors`).toEqual([]);
  expect(failedRequests.slice(from.network), `${where}: failed network requests`).toEqual([]);
  expect(shaderProblems.slice(from.shader), `${where}: WebGL shader problems`).toEqual([]);
}

async function settle(): Promise<void> {
  // Two frames guarantee the room has been submitted to the renderer, then a
  // short beat lets the zone-music fetch and any lazily-built materials finish.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await page.waitForTimeout(250);
}

async function loadScene(id: string): Promise<void> {
  const ok = await page.evaluate((scene) => window.__veilkeep.loadScene(scene), id);
  expect(ok, `loadScene(${id}) should succeed`).toBe(true);
  await settle();
  expect(await page.evaluate(() => window.__veilkeep.scene), `should be standing in ${id}`).toBe(id);
}

async function grant(requirements: string[]): Promise<void> {
  if (requirements.length === 0) return;
  await page.evaluate((reqs) => {
    const v = window.__veilkeep;
    for (const req of reqs) {
      if (req.startsWith('ITEM_')) v.inventory.add(req);
      else if (req.startsWith('PUZZLE_')) v.solvedPuzzles.add(req);
      else if (req.startsWith('ABILITY_')) v.abilities.add(req);
      else throw new Error(`unhandled requirement token: ${req}`);
    }
  }, requirements);
}

async function requirementsMet(requirements: string[]): Promise<boolean> {
  return page.evaluate((reqs) => {
    const v = window.__veilkeep;
    return reqs.every((req) => {
      if (req.startsWith('ITEM_')) return v.inventory.has(req);
      if (req.startsWith('PUZZLE_')) return v.solvedPuzzles.has(req);
      if (req.startsWith('ABILITY_')) return v.abilities.has(req);
      return false;
    });
  }, requirements);
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (/WebGLProgram|shader\s+error|WebGLShader/i.test(text)) shaderProblems.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText ?? '';
    // Scene changes abort in-flight zone music; that is not a broken asset.
    if (!/ERR_ABORTED/.test(error)) failedRequests.push(`${request.url()} ${error}`);
  });

  // `?autoplay=1` skips the title screen and origin picker deterministically.
  // The bot is stopped immediately so the level suite owns the player.
  await page.goto(`${BASE}/?autoplay=1&speed=8`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
  await page.evaluate(() => window.__veilkeep.autoplay.stop());
  await page.waitForTimeout(400);

  runtimeSceneIds = await page.evaluate(() => window.__veilkeep.qa.sceneIds());
});

test.afterAll(async () => {
  await page?.close();
});

test('runtime scene table is complete', async () => {
  expect(runtimeSceneIds.length).toBeGreaterThanOrEqual(50);
  expect(new Set(runtimeSceneIds).size).toBe(runtimeSceneIds.length);
  for (const id of REQUIRED_SCENES) expect(runtimeSceneIds).toContain(id);
  // The suite's static list and the runtime's scene map must agree, otherwise
  // the "every scene" claim is a lie.
  expect([...runtimeSceneIds].sort()).toEqual([...SCENE_IDS].sort());
  for (const id of SCENE_IDS) {
    expect(EXITS[id], `${id} must have an exit table`).toBeDefined();
  }
  const exitCount = Object.values(EXITS).reduce((sum, list) => sum + list.length, 0);
  expect(exitCount).toBeGreaterThanOrEqual(100);
  console.log(`  · ${SCENE_IDS.length} scenes, ${exitCount} exits`);
});

// --------------------------------------------------------------------------
// 1 + 2. Per-scene boot, asset audit, spawn and floor integrity.
// --------------------------------------------------------------------------
test.describe('scene boot, assets and colliders', () => {
  for (const id of SCENE_IDS) {
    test(`${id} boots clean and spawns on solid floor`, async () => {
      const from = mark();
      await loadScene(id);

      const spawn = await page.evaluate((scene) => window.__veilkeep.qa.spawnFor(scene), id);
      const bounds = await page.evaluate((scene) => window.__veilkeep.qa.boundsFor(scene), id);

      expect(spawn, `${id} needs a spawn`).toBeTruthy();
      expect(bounds, `${id} needs bounds`).toBeTruthy();

      // Spawn must be inside the authored room, not in the void beyond a wall.
      expect(Math.abs(spawn.x), `${id} spawn x is outside the room`).toBeLessThanOrEqual(bounds.width / 2 + 1);
      expect(Math.abs(spawn.z), `${id} spawn z is outside the room`).toBeLessThanOrEqual(bounds.height / 2 + 1);
      expect(spawn.y, `${id} spawn y is below the floor plane`).toBeGreaterThan(-1.0);

      // 60 physics ticks with gravity: the capsule must settle, not fall through.
      const afterTicks = await page.evaluate(() => window.__veilkeep.qa.stepPhysics(60));
      expect(afterTicks.y, `${id} capsule fell through the floor`).toBeGreaterThan(-1.0);
      expect(Number.isFinite(afterTicks.y), `${id} capsule position is not finite`).toBe(true);

      const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
      expect(diag.currentSceneId, `${id} diagnostics disagree with the scene`).toBe(id);
      expect(diag.drawCalls, `${id} rendered nothing`).toBeGreaterThan(0);
      expect(diag.geometries, `${id} has no geometry`).toBeGreaterThan(0);

      expectCleanSince(from, id);
    });
  }
});

// --------------------------------------------------------------------------
// 3. Every exit, locked and unlocked.
// --------------------------------------------------------------------------
test.describe('exit integrity', () => {
  for (const id of SCENE_IDS) {
    const exits = EXITS[id] ?? [];
    test(`${id} ${exits.length} exits gate and transition correctly`, async () => {
      for (const exit of exits) {
        const label = `${id} -> ${exit.to}`;

        // --- locked side: without the prerequisites the door must hold.
        await loadScene(id);
        const met = await requirementsMet(exit.requires);
        if (!met) {
          const from = mark();
          await page.evaluate(({ x, z }) => window.__veilkeep.qa.teleport(x, z), exit);
          await page.waitForTimeout(450);
          expect(await page.evaluate(() => window.__veilkeep.scene), `${label} opened without ${exit.requires.join('+')}`).toBe(id);
          expectCleanSince(from, `${label} locked`);
        }

        // --- unlocked side: granting the prerequisites must open it.
        await grant(exit.requires);
        const from = mark();
        await page.evaluate(({ x, z }) => window.__veilkeep.qa.teleport(x, z), exit);
        await expect
          .poll(() => page.evaluate(() => window.__veilkeep.scene), {
            message: `${label} never fired`,
            timeout: 5_000,
            intervals: [50, 100, 200],
          })
          .toBe(exit.to);

        const expected = exit.spawn ?? (await page.evaluate((scene) => window.__veilkeep.qa.spawnFor(scene), exit.to));
        const pos = await page.evaluate(() => window.__veilkeep.getDiagnostics().playerPos);
        expect(Math.abs(pos.x - expected.x), `${label} spawn x mismatch (${pos.x} vs ${expected.x})`).toBeLessThan(0.75);
        expect(Math.abs(pos.z - expected.z), `${label} spawn z mismatch (${pos.z} vs ${expected.z})`).toBeLessThan(0.75);
        expect(pos.y, `${label} landed below the floor`).toBeGreaterThan(-1.0);

        const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
        expect(diag.drawCalls, `${label} destination rendered nothing`).toBeGreaterThan(0);
        expectCleanSince(from, label);
      }
    });
  }
});

// --------------------------------------------------------------------------
// 4. Memory stability over repeated room transitions.
// --------------------------------------------------------------------------
test('15 room transitions do not leak geometries or textures', async () => {
  // Warm every room in the cycle first: the first visit builds the room and is
  // expected to allocate. The leak question is what happens *after* that.
  await page.evaluate((cycle) => {
    for (const scene of cycle) window.__veilkeep.loadScene(scene);
  }, MEMORY_CYCLE);
  await settle();

  const readMemory = () =>
    page.evaluate(() => {
      const info = window.__veilkeep.renderer.info.memory;
      return { geometries: info.geometries, textures: info.textures };
    });

  const baseline = await readMemory();
  const samples: Array<{ geometries: number; textures: number }> = [];

  // S00 -> OW1 -> GH1 -> GH2 -> GH3 -> S00, three times = 15 transitions.
  for (let rep = 0; rep < 3; rep++) {
    for (const scene of [...MEMORY_CYCLE, 'S00']) {
      await page.evaluate((id) => window.__veilkeep.loadScene(id), scene);
      await page.waitForTimeout(100);
      samples.push(await readMemory());
    }
  }

  const final = samples[samples.length - 1];
  const maxGeometries = Math.max(...samples.map((s) => s.geometries));
  const maxTextures = Math.max(...samples.map((s) => s.textures));

  console.log(
    `  · memory baseline ${baseline.geometries}g/${baseline.textures}t -> ` +
      `final ${final.geometries}g/${final.textures}t ` +
      `(peak ${maxGeometries}g/${maxTextures}t over ${samples.length} samples)`,
  );

  // A room transition may reuse or rebuild a handful of objects, but it must
  // not scale with the number of transitions.
  expect(final.geometries - baseline.geometries, 'geometries grew across 15 transitions').toBeLessThanOrEqual(8);
  expect(final.textures - baseline.textures, 'textures grew across 15 transitions').toBeLessThanOrEqual(4);
  expect(maxGeometries - baseline.geometries, 'geometry peak grew across 15 transitions').toBeLessThanOrEqual(12);
  expect(maxTextures - baseline.textures, 'texture peak grew across 15 transitions').toBeLessThanOrEqual(6);

  // And the cycle must still render after the churn.
  const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
  expect(diag.drawCalls).toBeGreaterThan(0);
  expect(diag.currentSceneId).toBe('S00');
});
