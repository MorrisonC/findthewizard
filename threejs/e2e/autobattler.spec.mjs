/**
 * End-to-end proof that the auto-battler can finish Veilkeep unattended.
 *
 *   node e2e/autobattler.spec.mjs            # against http://localhost:5199
 *   BASE=http://localhost:4173 node e2e/autobattler.spec.mjs
 *
 * The run asserts the toggle, the HUD panel, full campaign coverage (every
 * scene visited, every task completed) and the finale modal.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const TIMEOUT_MS = Number(process.env.AUTO_TIMEOUT_MS || 300_000);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
const failedRequests = [];
page.on('pageerror', (e) => pageErrors.push(`${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join('\n')}`));
page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}`));

const readAuto = () =>
  page.evaluate(() => {
    const a = window.__veilkeep?.auto;
    if (!a) return null;
    return {
      enabled: a.enabled,
      status: a.status,
      scene: a.scene,
      goal: a.goal,
      task: a.task,
      visited: a.visited,
      visitedCount: a.visitedCount,
      tasksDone: a.tasksDone,
      totalTasks: a.totalTasks,
      route: a.route,
      error: a.error,
    };
  });

const step = (msg) => console.log(`  ✓ ${msg}`);

// ---------------------------------------------------------------- boot
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(3500);
assert.equal(await page.locator('#title-screen').isVisible(), true, 'title screen should greet a fresh browser');
step('title screen visible');

// New Game reloads with a one-shot session flag so the autosave cannot
// resurrect the previous profile.
await page.click('#title-new-game');
await page.waitForLoadState('load');
await page.waitForTimeout(3500);
assert.equal(await page.locator('#title-screen').isVisible(), false, 'New Game should skip the title after reload');
step('New Game skipped the title and cleared the save');

const originVisible = await page.locator('text=Choose Your Origin').isVisible().catch(() => false);
assert.equal(originVisible, true, 'origin selector should appear for a new profile');
await page.locator('button', { hasText: 'Gutter-Alchemist' }).click();
await page.waitForTimeout(2000);

assert.equal(await page.evaluate(() => window.__veilkeep?.sceneId), 'S00', 'should spawn in the courtyard');
assert.equal(await page.evaluate(() => !!window.__veilkeep?.auto), true, 'debug API should expose the automaton');
step('new profile spawned in S00 with the auto API available');

// ------------------------------------------------------------- toggle
const panel = page.locator('#hud-autobattler');
assert.equal(await panel.evaluate((el) => el.classList.contains('active')), false);
assert.equal(await page.locator('#auto-state-label').textContent(), 'OFFLINE');
step('panel starts offline');

await page.keyboard.press('p');
await page.waitForTimeout(700);
let auto = await readAuto();
assert.equal(auto.enabled, true, 'P should engage the automaton');
assert.ok(['travel', 'task', 'combat'].includes(auto.status), `engaging should start an active leg (got ${auto.status})`);
assert.equal(await panel.evaluate((el) => el.classList.contains('active')), true, 'panel should light up');
step('P engaged the automaton and the HUD lit up');

await page.keyboard.press('p');
await page.waitForTimeout(700);
auto = await readAuto();
assert.equal(auto.enabled, false, 'a second P should disengage');
assert.equal(auto.status, 'off');
assert.equal(await page.locator('#auto-state-label').textContent(), 'OFFLINE');
step('P disengaged the automaton');

await page.keyboard.press('p');
await page.waitForTimeout(700);
auto = await readAuto();
assert.equal(auto.enabled, true, 'P should re-engage');
step('P re-engaged the automaton');

// -------------------------------------------------------- full campaign
const started = Date.now();
let last = auto;
let lastLog = 0;
let stagnantSince = Date.now();

while (Date.now() - started < TIMEOUT_MS) {
  await page.waitForTimeout(1000);
  const current = await readAuto();
  if (!current) break;
  if (current.visitedCount !== last.visitedCount || current.tasksDone !== last.tasksDone) {
    stagnantSince = Date.now();
  }
  last = current;
  if (current.error && Date.now() - lastLog > 5000) {
    console.log(`    ! ${current.scene} status=${current.status} error=${current.error} task=${current.task}`);
    lastLog = Date.now();
  }
  if (current.status === 'done') break;
  // Guard against a silent hang: if nothing moves for 90 s the run is wedged.
  assert.ok(
    Date.now() - stagnantSince < 90_000,
    `automaton stalled in ${current.scene} (status=${current.status}, task=${current.task}, error=${current.error})`,
  );
}

auto = await readAuto();
const elapsed = Math.round((Date.now() - started) / 1000);
assert.equal(auto.status, 'done', `automaton should finish the campaign, ended in ${auto.scene} (${auto.error || 'no error'})`);
step(`campaign finished in ${elapsed}s`);

const uniqueVisited = new Set(auto.visited);
assert.equal(uniqueVisited.size, 50, `all 50 scenes must be traversed, got ${uniqueVisited.size}`);
assert.equal(auto.tasksDone, auto.totalTasks, `all tasks must complete (${auto.tasksDone}/${auto.totalTasks})`);
assert.equal(auto.error, '', `no planner errors should remain (${auto.error})`);
step(`all ${uniqueVisited.size} scenes visited, ${auto.tasksDone}/${auto.totalTasks} tasks complete`);

// ------------------------------------------------------------- finale
assert.equal(auto.scene, 'S00', 'the automaton should return to the courtyard');
assert.equal(await page.locator('#hud-ending-modal').isVisible(), true, 'the finale modal should open on return');
await page.screenshot({ path: 'C:/Users/cyber/AppData/Local/Temp/opencode/autobattler-finale-modal.png' });
step('finale modal opened');

await page.click('#ending-close-btn');
await page.waitForTimeout(600);
assert.equal(await page.locator('#hud-ending-modal').isVisible(), false, 'the epilogue close button should dismiss the modal');
step('epilogue dismissed');

// --------------------------------------------------------------- HUD
assert.equal(await page.locator('#auto-state-label').textContent(), 'DONE');
assert.equal(await page.locator('#auto-task-label').textContent(), 'Expedition complete.');
step('HUD reports the completed expedition');

// ------------------------------------------------------------- errors
assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
step('no uncaught page errors');

const missing = failedRequests.filter((r) => !r.includes('favicon'));
if (missing.length) console.log(`  note: ${missing.length} failed requests (pre-existing assets):\n    ${missing.slice(0, 6).join('\n    ')}`);

await page.screenshot({ path: 'C:/Users/cyber/AppData/Local/Temp/opencode/autobattler-finale.png' });
console.log('\nAUTO-BATTLER E2E PASSED');
await browser.close();
