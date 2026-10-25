/**
 * Phase-1 boot / asset smoke test.
 *
 *   node e2e/boot.spec.mjs
 *
 * Boots a fresh profile, walks a representative set of scenes (including the
 * two that used to point at missing music), and asserts the console stays clean
 * and the renderer actually produces frames.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(`${e.message}`));
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

const step = (msg) => console.log(`  ✓ ${msg}`);

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(3500);
assert.equal(await page.locator('#title-screen').isVisible(), true, 'title screen should render');
step('title screen rendered');

await page.click('#title-new-game');
await page.waitForLoadState('load');
await page.waitForTimeout(3500);
if (await page.locator('text=Choose Your Origin').isVisible().catch(() => false)) {
  await page.locator('button', { hasText: 'Gutter-Alchemist' }).click();
}
await page.waitForTimeout(2500);

const canvas = await page.evaluate(() => {
  const c = document.getElementById('game-canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return { width: c.width, height: c.height, webgl2: !!c.getContext('webgl2'), anyGL: !!gl };
});
assert.ok(canvas.width > 0 && canvas.height > 0, 'canvas should be sized');
assert.equal(canvas.anyGL, true, 'a WebGL context should exist');
step(`canvas ${canvas.width}x${canvas.height} with WebGL${canvas.webgl2 ? '2' : '1'}`);

const diag = await page.evaluate(() => window.__veilkeep.getDiagnostics());
assert.ok(diag.fps > 0, `renderer should be producing frames (fps=${diag.fps})`);
assert.ok(diag.drawCalls > 0, 'the scene should draw');
step(`first frame: ${diag.drawCalls} calls, ${diag.triangles} tris, ${diag.fps} fps`);

// Scenes whose music used to 404 (BT1, RG1) plus every zone that loads a GLB.
const tour = ['OW1', 'GH1', 'GH2', 'GH3', 'BT1', 'HM1', 'BQ1', 'AG1', 'MH1', 'SAN1', 'CO1', 'U2', 'TR2', 'AT2', 'PB2', 'RG1', 'VR2', 'RS3', 'AL2', 'CR1', 'MS3'];
for (const id of tour) {
  const ok = await page.evaluate((scene) => window.__veilkeep.loadScene(scene), id);
  assert.equal(ok, true, `loadScene(${id}) should succeed`);
  await page.waitForTimeout(120);
  const current = await page.evaluate(() => window.__veilkeep.scene);
  assert.equal(current, id, `should be standing in ${id}`);
}
step(`toured ${tour.length} scenes without a load failure`);

const after = await page.evaluate(() => window.__veilkeep.getDiagnostics());
assert.equal(after.currentSceneId, 'MS3');

assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
assert.deepEqual(consoleErrors, [], `console errors:\n${consoleErrors.join('\n')}`);
assert.deepEqual(failedRequests, [], `failed requests:\n${failedRequests.join('\n')}`);
step('console and network are clean');

await browser.close();
console.log('\nBOOT PASSED');
