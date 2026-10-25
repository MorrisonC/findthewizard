/**
 * Phase-1 QA: proves the `window.__veilkeep` automation surface is complete,
 * deterministic and safe to drive from Playwright / MCP / a WebView probe.
 *
 *   node e2e/qa-hooks.spec.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const step = (msg) => console.log(`  ✓ ${msg}`);
const call = (fn, arg) => page.evaluate(fn, arg);

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.click('#title-new-game');
await page.waitForLoadState('load');
await page.waitForTimeout(3500);
if (await page.locator('text=Choose Your Origin').isVisible().catch(() => false)) {
  await page.locator('button', { hasText: 'Gutter-Alchemist' }).click();
}
await page.waitForTimeout(2500);

// ------------------------------------------------------------- hook surface
const shape = await call(() => {
  const v = window.__veilkeep;
  const diag = v.getDiagnostics();
  return {
    has: ['scene', 'renderer', 'camera', 'player', 'inventory', 'questLog', 'convictions', 'loadScene', 'getDiagnostics'].filter(
      (k) => v[k] === undefined,
    ),
    scene: v.scene,
    sceneIsString: typeof v.scene === 'string',
    rendererIsWebGL: v.renderer?.isWebGLRenderer === true,
    cameraIsCamera: v.camera?.isCamera === true,
    playerIsObject3D: v.player?.isObject3D === true,
    inventoryIsSet: v.inventory instanceof Set,
    questLogKeys: Object.keys(v.questLog ?? {}),
    convictions: { ...v.convictions },
    diagKeys: Object.keys(diag).sort(),
    diag,
  };
});

assert.deepEqual(shape.has, [], `missing hooks: ${shape.has.join(', ')}`);
assert.equal(shape.sceneIsString, true, '__veilkeep.scene should be the current scene id');
assert.equal(shape.scene, 'S00');
assert.equal(shape.rendererIsWebGL, true, 'renderer should be the live WebGLRenderer');
assert.equal(shape.cameraIsCamera, true, 'camera should be the live Three camera');
assert.equal(shape.playerIsObject3D, true, 'player should be the live player mesh');
assert.equal(shape.inventoryIsSet, true, 'inventory should be a Set');
step('scene / renderer / camera / player / inventory are live');

assert.deepEqual(shape.diagKeys, [
  'activeQuests',
  'completedQuests',
  'consoleErrors',
  'currentSceneId',
  'drawCalls',
  'fps',
  'geometries',
  'playerPos',
  'textures',
  'triangles',
]);
step('getDiagnostics() returns the agreed shape');

const d = shape.diag;
assert.equal(d.currentSceneId, 'S00');
assert.equal(typeof d.playerPos.x, 'number');
assert.equal(typeof d.playerPos.y, 'number');
assert.equal(typeof d.playerPos.z, 'number');
assert.ok(d.drawCalls > 0, `drawCalls should be positive, got ${d.drawCalls}`);
assert.ok(d.triangles > 0, `triangles should be positive, got ${d.triangles}`);
assert.ok(d.geometries > 0, `geometries should be positive, got ${d.geometries}`);
assert.ok(d.textures > 0, `textures should be positive, got ${d.textures}`);
assert.ok(Array.isArray(d.activeQuests) && d.activeQuests.length > 0, 'activeQuests should list unfinished objectives');
assert.ok(d.completedQuests.includes('Q_INFILTRATE_COURTYARD'), 'the opening objective should already be complete');
assert.ok(Array.isArray(d.consoleErrors));
step(`diagnostics: ${d.drawCalls} draw calls, ${d.triangles} tris, ${d.fps} fps`);

// ------------------------------------------------------------ quest log
assert.deepEqual(shape.convictions, { empathy: 0, rationalism: 0, solipsism: 0 }, 'convictions start neutral');
const questCounts = await call(() => ({
  total: window.__veilkeep.questLog.objectives.length,
  active: window.__veilkeep.questLog.activeCount,
  completed: window.__veilkeep.questLog.completedCount,
  percent: window.__veilkeep.questLog.percent,
  unique: new Set(window.__veilkeep.questLog.objectives.map((o) => o.id)).size,
}));
assert.equal(questCounts.total, questCounts.unique, 'quest objective ids must be unique');
assert.equal(questCounts.active + questCounts.completed, questCounts.total);
assert.ok(questCounts.percent >= 0 && questCounts.percent <= 100);
step(`quest log: ${questCounts.completed}/${questCounts.total} complete (${questCounts.percent}%)`);

// -------------------------------------------------------- deterministic load
const loaded = await call(() => {
  const v = window.__veilkeep;
  const ok = v.loadScene('GH2');
  const diag = v.getDiagnostics();
  return { ok, scene: v.scene, diagScene: diag.currentSceneId, pos: diag.playerPos };
});
assert.equal(loaded.ok, true, 'loadScene should accept a manifest scene');
assert.equal(loaded.scene, 'GH2');
assert.equal(loaded.diagScene, 'GH2');
step('loadScene(GH2) teleports and updates diagnostics');

const override = await call(() => {
  const v = window.__veilkeep;
  const ok = v.loadScene('GH2', { x: 0, z: -3 });
  return { ok, pos: v.getDiagnostics().playerPos };
});
assert.equal(override.ok, true);
assert.equal(Math.round(override.pos.x), 0);
assert.equal(Math.round(override.pos.z), -3);
step('loadScene accepts a partial spawn override');

const bad = await call(() => {
  const v = window.__veilkeep;
  const ok = v.loadScene('NOT_A_SCENE');
  return { ok, scene: v.scene };
});
assert.equal(bad.ok, false, 'loadScene must reject unknown ids');
assert.equal(bad.scene, 'GH2', 'a rejected load must not change the scene');
step('loadScene rejects unknown ids without corrupting state');

// ------------------------------------------------------------- convictions
const conviction = await call(() => {
  const v = window.__veilkeep;
  v.awardConviction('empathy', 1, 'qa:probe');
  v.awardConviction('empathy', 1, 'qa:probe');
  v.awardConviction('solipsism', 2);
  return { ...v.convictions };
});
assert.equal(conviction.empathy, 1, 'repeated awards with the same reason must be idempotent');
assert.equal(conviction.solipsism, 2);
step('convictions award idempotently and clamp');

// ------------------------------------------------------------ error capture
const errors = await call(() => {
  const v = window.__veilkeep;
  console.error('qa-probe: deliberate diagnostic failure');
  return v.getDiagnostics().consoleErrors;
});
assert.ok(
  errors.some((e) => e.includes('qa-probe: deliberate diagnostic failure')),
  `consoleErrors should capture console.error, got ${JSON.stringify(errors)}`,
);
step('console errors are captured for diagnostics');

assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
step('no uncaught page errors');

await browser.close();
console.log('\nQA HOOKS PASSED');
