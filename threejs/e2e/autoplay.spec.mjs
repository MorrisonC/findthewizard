/**
 * Phase-2 hands-free autoplay run.
 *
 *   node e2e/autoplay.spec.mjs
 *
 * Boots `?autoplay=1&speed=4`, proves the public API surface, then watches the
 * bot play from S00 through the whole fortress without a single input event.
 * Any watchdog P1 is written into BUGS.md so the run doubles as a bug report.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUGS_FILE = path.join(ROOT, 'BUGS.md');
const RUN_TIMEOUT_MS = Number(process.env.AUTOPLAY_TIMEOUT_MS || 420_000);

/** The chain the brief names, in order. */
const REQUIRED_CHAIN = ['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'SQ1'];

const step = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));

// ---------------------------------------------------------------- boot
await page.goto(`${BASE}/?autoplay=1&speed=4`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__veilkeep?.autoplay !== undefined, null, { timeout: 30_000 });
await page.waitForFunction(() => window.__veilkeep.autoplay.getStatus().running === true, null, { timeout: 30_000 });
step('booted straight into autoplay from the URL query');

// ---------------------------------------------------------------- API surface
const api = await page.evaluate(() => {
  const a = window.__veilkeep.autoplay;
  const status = a.getStatus();
  return {
    methods: ['start', 'stop', 'pause', 'resume', 'stepToScene', 'solveCurrentRoom', 'getStatus']
      .filter((k) => typeof a[k] !== 'function'),
    hasBugs: Array.isArray(a.bugsFound),
    statusKeys: Object.keys(status).sort(),
    status,
    scene: window.__veilkeep.scene,
    hudButton: !!document.getElementById('autoplay-toggle'),
    hudLabel: document.getElementById('autoplay-toggle')?.textContent ?? '',
  };
});
assert.deepEqual(api.methods, [], `missing methods: ${api.methods.join(', ')}`);
assert.equal(api.hasBugs, true, 'bugsFound must be an array');
assert.deepEqual(api.statusKeys, [
  'completedQuests',
  'currentGoal',
  'lastError',
  'running',
  'solvedPuzzles',
  'stuckTicks',
  'visitedScenes',
]);
assert.equal(api.scene, 'S00', 'autoplay should start in the courtyard');
assert.equal(api.hudButton, true, 'the 🤖 Autoplay HUD button should exist');
assert.match(api.hudLabel, /Autoplay/i);
step(`API surface + getStatus() shape OK (scene ${api.scene}, HUD "${api.hudLabel.trim()}")`);

// --------------------------------------------------- lifecycle smoke (pause/resume)
const lifecycle = await page.evaluate(() => {
  const a = window.__veilkeep.autoplay;
  const paused = a.pause();
  const wasPaused = a.getStatus().running;
  const resumed = a.resume();
  return { paused, wasPaused, resumed, running: a.getStatus().running };
});
assert.equal(lifecycle.paused, true);
assert.equal(lifecycle.wasPaused, true, 'a paused bot still counts as running');
assert.equal(lifecycle.resumed, true);
assert.equal(lifecycle.running, true);
step('pause() / resume() keep the run alive');

// ---------------------------------------------------------------- HUD toggle
const hudBefore = await page.evaluate(() => window.__veilkeep.autoplay.getStatus().running);
await page.click('#autoplay-toggle');
await page.waitForTimeout(400);
const hudStopped = await page.evaluate(() => ({
  running: window.__veilkeep.autoplay.getStatus().running,
  label: document.getElementById('autoplay-toggle')?.textContent ?? '',
}));
assert.equal(hudStopped.running, false, 'HUD button should stop a running bot');
await page.click('#autoplay-toggle');
await page.waitForTimeout(400);
const hudResumed = await page.evaluate(() => window.__veilkeep.autoplay.getStatus().running);
assert.equal(hudResumed, true, 'HUD button should restart a stopped bot');
step(`HUD toggle works (${hudBefore} → ${hudStopped.running} → ${hudResumed}, label "${hudStopped.label.trim()}")`);


// ---------------------------------------------------------------- watch it play
const started = Date.now();
let lastVisited = 0;
let stuckReports = 0;
let finalStatus = null;

while (Date.now() - started < RUN_TIMEOUT_MS) {
  await page.waitForTimeout(1000);
  const snapshot = await page.evaluate(() => {
    const a = window.__veilkeep.autoplay;
    return { status: a.getStatus(), finished: a.finished, bugs: a.bugsFound.length };
  });
  finalStatus = snapshot.status;
  stuckReports = snapshot.bugs;
  if (snapshot.status.visitedScenes.length !== lastVisited) {
    lastVisited = snapshot.status.visitedScenes.length;
    console.log(
      `    · ${lastVisited}/50 rooms — now in ${snapshot.status.visitedScenes[lastVisited - 1]} ` +
        `(goal ${snapshot.status.currentGoal ?? '—'}, ${snapshot.status.solvedPuzzles.length} puzzles)`,
    );
  }
  if (snapshot.finished) break;
  if (!snapshot.status.running) break;
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const visited = finalStatus?.visitedScenes ?? [];
const bugs = await page.evaluate(() => window.__veilkeep.autoplay.bugsFound);

console.log(`\n  run: ${visited.length}/50 rooms in ${elapsed}s, ${bugs.length} watchdog P1(s)`);

// ---------------------------------------------------------------- assertions
const missingChain = REQUIRED_CHAIN.filter((id) => !visited.includes(id));
if (missingChain.length) fail(`chain rooms never visited: ${missingChain.join(', ')}`);
else step(`visited the full named chain: ${REQUIRED_CHAIN.join(' → ')}`);

// The chain must appear in order.
const positions = REQUIRED_CHAIN.map((id) => visited.indexOf(id));
const ordered = positions.every((p, i) => i === 0 || p > positions[i - 1]);
if (!ordered) fail(`chain order was not monotonic: ${positions.join(', ')}`);
else step('chain order was monotonic (S00 first, SQ1 last of the group)');

if (visited.length < 40) fail(`only ${visited.length}/50 rooms were visited`);
else step(`${visited.length}/50 rooms visited`);

if (bugs.length > 0) {
  fail(`${bugs.length} navigation P1(s) recorded — see BUGS.md`);
  for (const bug of bugs) {
    console.error(`      ${bug.id} ${bug.scene} @ (${bug.position.x}, ${bug.position.y}, ${bug.position.z}) goal=${bug.goal}`);
  }
  appendBugs(bugs, visited, elapsed);
} else {
  step('no navigation/collider P1s during the run');
}

assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
step('no uncaught page errors');

// Console errors are tolerated only for the deliberate favicon-free dev server.
const realConsoleErrors = consoleErrors.filter((e) => !e.includes('favicon'));
if (realConsoleErrors.length) fail(`console errors:\n${realConsoleErrors.join('\n')}`);
else step('console clean');

const realFailed = failedRequests.filter((u) => !u.includes('favicon'));
if (realFailed.length) fail(`failed requests:\n${realFailed.join('\n')}`);
else step('no failed network requests');

// ---------------------------------------------------------------- all endings
const endingCheck = await page.evaluate(() => {
  const modal = document.getElementById('hud-ending-modal');
  const cards = [...document.querySelectorAll('.ending-card')];
  const scroll = document.getElementById('ending-epilogue-scroll');
  return {
    modalOpen: modal ? getComputedStyle(modal).display !== 'none' : false,
    endings: cards.map((c) => c.getAttribute('data-ending')).filter(Boolean),
    initialEpilogue: scroll?.textContent?.trim().length ?? 0,
  };
});

if (endingCheck.endings.length === 0) {
  fail('the finale modal exposed no ending choices');
} else {
  const rendered = [];
  for (const type of endingCheck.endings) {
    const text = await page.evaluate((ending) => {
      const card = document.querySelector(`.ending-card[data-ending="${ending}"]`);
      if (!card) return '';
      card.click();
      const scroll = document.getElementById('ending-epilogue-scroll');
      return (scroll?.textContent ?? '').trim();
    }, type);
    rendered.push({ type, length: text.length, head: text.slice(0, 40) });
  }
  const empty = rendered.filter((r) => r.length < 40);
  if (empty.length) fail(`endings with no epilogue: ${empty.map((e) => e.type).join(', ')}`);
  else step(`all ${rendered.length} endings rendered an epilogue (${rendered.map((r) => r.type).join(', ')})`);
}

await browser.close();

if (process.exitCode) {
  console.log('\nAUTOPLAY FAILED');
} else {
  console.log('\nAUTOPLAY PASSED — 100% hands-free');
}

// ------------------------------------------------------------------ helpers
function appendBugs(found, visitedScenes, seconds) {
  const stamp = new Date().toISOString();
  const rows = found
    .map(
      (b) =>
        `| ${b.id} | P1 Critical | Both | ${b.scene} | Autoplay watchdog: capsule stalled < 0.05 m over ${b.stuckTicks} ticks while steering toward \`${b.goal ?? 'travel'}\`. Exact coordinates \`(${b.position.x}, ${b.position.y}, ${b.position.z})\`. | 1. Boot \`?autoplay=1&speed=4\`.<br>2. Wait for the bot to reach ${b.scene}.<br>3. Watchdog fires at ${b.detectedAt}. | OPEN | \`threejs/src/systems/AutoplayController.ts\` |`,
    )
    .join('\n');

  const section = `
---

## Autoplay watchdog findings — ${stamp}

Hands-free run: ${visitedScenes.length}/50 rooms in ${seconds}s. ${found.length} navigation P1(s) recorded automatically by \`AutoplayController\`.

| ID | Severity | Platform | Scene/Quest | Description | Reproduction Steps | Status | Fix Commit/File |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;

  let current = fs.readFileSync(BUGS_FILE, 'utf8');
  if (!current.endsWith('\n')) current += '\n';
  fs.writeFileSync(BUGS_FILE, current + section, 'utf8');
  console.log(`    → appended ${found.length} watchdog P1(s) to BUGS.md`);
}
