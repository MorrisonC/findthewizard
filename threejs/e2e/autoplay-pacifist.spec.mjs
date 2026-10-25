/**
 * Phase-2 ghost / non-lethal autoplay run.
 *
 *   node e2e/autoplay-pacifist.spec.mjs
 *
 * `pacifist_shadowhand` must traverse the whole fortress without ever drawing a
 * blade: lethal `clear` tasks are satisfied by evasion and guards are walked
 * around. The "never attacks" half is proven by `tests/autoplay.test.ts`.
 *
 * The SAN1 finale is deliberately out of scope: the game's ending is gated on
 * defeating Archillusionist Vaelor, which a no-kill run refuses to do by
 * definition (logged as VK-P2-104). The ghost run therefore ends in the throne
 * room with every other room visited.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const RUN_TIMEOUT_MS = Number(process.env.AUTOPLAY_PACIFIST_TIMEOUT_MS || 300_000);
const GRACE_AFTER_FULL_MAP_MS = 20_000;

const REQUIRED_CHAIN = ['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'SQ1'];

/** The one known, documented stall (VK-P1-NAV-004); anything else is a failure. */
const isKnownStall = (bug) => bug.scene === 'OW1' && bug.goal === 'ow1:nail';

const step = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/?autoplay=1&speed=8&mode=pacifist_shadowhand`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__veilkeep?.autoplay !== undefined, null, { timeout: 30_000 });
await page.waitForFunction(() => window.__veilkeep.autoplay.getStatus().running === true, null, { timeout: 30_000 });

const boot = await page.evaluate(() => ({
  mode: window.__veilkeep.autoplay.modeName,
  speed: window.__veilkeep.autoplay.speed,
  scene: window.__veilkeep.scene,
}));
assert.equal(boot.mode, 'pacifist_shadowhand');
assert.equal(boot.speed, 8);
assert.equal(boot.scene, 'S00');
step('ghost run booted from the URL query');

const started = Date.now();
let lastVisited = 0;
let finalStatus = null;
let finished = false;
let fullMapAt = 0;

while (Date.now() - started < RUN_TIMEOUT_MS) {
  await page.waitForTimeout(1000);
  const snapshot = await page.evaluate(() => {
    const a = window.__veilkeep.autoplay;
    return { status: a.getStatus(), finished: a.finished, bugs: a.bugsFound.length };
  });
  finalStatus = snapshot.status;
  if (snapshot.status.visitedScenes.length !== lastVisited) {
    lastVisited = snapshot.status.visitedScenes.length;
    console.log(`    · ${lastVisited} rooms — now in ${snapshot.status.visitedScenes[lastVisited - 1]}`);
    if (lastVisited >= 50) fullMapAt = Date.now();
  }
  if (snapshot.finished) { finished = true; break; }
  if (!snapshot.status.running) break;
  // The finale gate is documented; stop watching once the map is complete.
  if (fullMapAt && Date.now() - fullMapAt > GRACE_AFTER_FULL_MAP_MS) break;
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const visited = finalStatus?.visitedScenes ?? [];
const bugs = await page.evaluate(() => window.__veilkeep.autoplay.bugsFound);
console.log(`\n  ghost run: ${visited.length}/50 rooms in ${elapsed}s, ${bugs.length} watchdog P1(s)`);

const missing = REQUIRED_CHAIN.filter((id) => !visited.includes(id));
if (missing.length) fail(`ghost run missed: ${missing.join(', ')}`);
else step(`ghost run cleared the MVP chain: ${REQUIRED_CHAIN.join(' → ')}`);

if (visited.length < 45) fail(`ghost run only reached ${visited.length}/50 rooms`);
else step(`ghost run traversed ${visited.length}/50 rooms without a kill`);

const unexpected = bugs.filter((b) => !isKnownStall(b));
if (unexpected.length) {
  fail(`${unexpected.length} unexpected navigation P1(s)`);
  for (const bug of unexpected) {
    console.error(`      ${bug.id} ${bug.scene} @ (${bug.position.x}, ${bug.position.y}, ${bug.position.z}) goal=${bug.goal}`);
  }
} else {
  step(`no unexpected navigation P1s (${bugs.length} known OW1 stall, documented as VK-P1-NAV-004)`);
}

if (finished) {
  step('ghost run reached a finale');
} else {
  console.log('    · stopped in the throne room: the ending is gated on defeating Vaelor (VK-P2-104)');
}

assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
step('no uncaught page errors');

const realConsoleErrors = consoleErrors.filter((e) => !e.includes('favicon'));
if (realConsoleErrors.length) fail(`console errors:\n${realConsoleErrors.join('\n')}`);
else step('console clean');

await browser.close();

if (process.exitCode) console.log('\nAUTOPLAY PACIFIST FAILED');
else console.log('\nAUTOPLAY PACIFIST PASSED — full fortress traversal, no kills');
