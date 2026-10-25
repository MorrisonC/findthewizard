/**
 * Phase-2 mobile / Android WebView autoplay run.
 *
 *   node e2e/autoplay-mobile.spec.mjs
 *
 * Android ships this game inside a WebView, so the hands-free path has to work
 * on a touch device with no keyboard and no mouse: 390x844 portrait, touch
 * enabled, booted straight from the URL query. The bot must clear the MVP slice
 * (S00 -> OW1 -> GH1 -> GH2 -> GH3 -> SQ1) with zero human input.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';
const RUN_TIMEOUT_MS = Number(process.env.AUTOPLAY_MOBILE_TIMEOUT_MS || 300_000);

/** The MVP slice the brief names, in order. */
const REQUIRED_CHAIN = ['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'SQ1'];

/** A representative Android phone: Pixel-class portrait viewport. */
const DEVICE = {
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/131.0.0.0 Mobile Safari/537.36',
};

const step = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext(DEVICE);
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

// ---------------------------------------------------------------- boot
await page.goto(`${BASE}/?autoplay=1&speed=8&mode=mvp_slice`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__veilkeep?.autoplay !== undefined, null, { timeout: 30_000 });
await page.waitForFunction(() => window.__veilkeep.autoplay.getStatus().running === true, null, { timeout: 30_000 });

const boot = await page.evaluate(() => {
  const a = window.__veilkeep.autoplay;
  const button = document.getElementById('autoplay-toggle');
  const rect = button?.getBoundingClientRect();
  return {
    mode: a.modeName,
    speed: a.speed,
    scene: window.__veilkeep.scene,
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    layoutWidth: document.documentElement.clientWidth,
    layoutHeight: document.documentElement.clientHeight,
    button: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, visible: getComputedStyle(button).display !== 'none' }
      : null,
  };
});

assert.equal(boot.mode, 'mvp_slice', 'URL mode= should select the MVP slice');
assert.equal(boot.speed, 8, 'URL speed=8 should be applied (clamped to 8)');
assert.equal(boot.scene, 'S00', 'autoplay should start in the courtyard');
assert.equal(boot.hasTouch, true, 'the emulated Android device must expose touch');
// `window.innerWidth` is unreliable under headless mobile emulation; the layout
// viewport is the honest number and must match the configured phone size.
assert.equal(boot.layoutWidth, 390, 'layout viewport width must be 390 CSS px');
assert.equal(boot.layoutHeight, 844, 'layout viewport height must be 844 CSS px');
step(`booted hands-free on Android emulation (${boot.layoutWidth}x${boot.layoutHeight} CSS px, touch)`);
step(`mode=${boot.mode} speed=${boot.speed} starting in ${boot.scene}`);

// The HUD toggle has to be reachable by a thumb, not hidden behind the canvas.
assert.ok(boot.button, 'the 🤖 Autoplay button must exist on mobile');
assert.equal(boot.button.visible, true, 'the Autoplay button must be visible');
const insideViewport =
  boot.button.x >= 0 &&
  boot.button.y >= 0 &&
  boot.button.x + boot.button.width <= boot.layoutWidth &&
  boot.button.y + boot.button.height <= boot.layoutHeight;
assert.equal(insideViewport, true, `Autoplay button is off-screen: ${JSON.stringify(boot.button)}`);
step(`HUD button inside the ${boot.layoutWidth}x${boot.layoutHeight} viewport`);

// It must also win the hit test at its own centre (canvas must not swallow taps).
const hit = await page.evaluate(() => {
  const button = document.getElementById('autoplay-toggle');
  if (!button) return null;
  const r = button.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return top ? { id: top.id, tag: top.tagName, isButton: top === button || button.contains(top) } : null;
});
assert.ok(hit, 'hit test failed');
assert.equal(hit.isButton, true, `canvas intercepts taps on the Autoplay button (top element: ${hit.tag}#${hit.id})`);
step('HUD button receives taps above the WebGL canvas');

// ---------------------------------------------------------------- tap lifecycle
// Proven before the finale so the ending modal cannot absorb the tap.
await page.tap('#autoplay-toggle');
await page.waitForTimeout(600);
const tappedOff = await page.evaluate(() => ({
  running: window.__veilkeep.autoplay.getStatus().running,
  label: document.getElementById('autoplay-toggle')?.textContent ?? '',
}));
assert.equal(tappedOff.running, false, 'a tap on the HUD button must stop the bot');
step(`tap stopped the bot (label "${tappedOff.label.trim()}")`);

await page.tap('#autoplay-toggle');
await page.waitForTimeout(600);
const tappedOn = await page.evaluate(() => ({
  running: window.__veilkeep.autoplay.getStatus().running,
  mode: window.__veilkeep.autoplay.modeName,
  speed: window.__veilkeep.autoplay.speed,
}));
assert.equal(tappedOn.running, true, 'a second tap must restart the bot');
assert.equal(tappedOn.mode, 'mvp_slice', 'restart must keep the URL mode');
assert.equal(tappedOn.speed, 8, 'restart must keep the URL speed');
step('second tap restarted it in the same mode/speed');

// ---------------------------------------------------------------- watch it play
const started = Date.now();
let lastVisited = 0;
let finalStatus = null;
let finished = false;

while (Date.now() - started < RUN_TIMEOUT_MS) {
  await page.waitForTimeout(1000);
  const snapshot = await page.evaluate(() => {
    const a = window.__veilkeep.autoplay;
    return { status: a.getStatus(), finished: a.finished, bugs: a.bugsFound.length };
  });
  finalStatus = snapshot.status;
  if (snapshot.status.visitedScenes.length !== lastVisited) {
    lastVisited = snapshot.status.visitedScenes.length;
    console.log(
      `    · ${lastVisited} rooms — now in ${snapshot.status.visitedScenes[lastVisited - 1]} ` +
        `(goal ${snapshot.status.currentGoal ?? '—'}, ${snapshot.status.solvedPuzzles.length} puzzles)`,
    );
  }
  if (snapshot.finished) { finished = true; break; }
  if (!snapshot.status.running) break;
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const visited = finalStatus?.visitedScenes ?? [];
const bugs = await page.evaluate(() => window.__veilkeep.autoplay.bugsFound);

console.log(`\n  mobile run: ${visited.length} rooms in ${elapsed}s, ${bugs.length} watchdog P1(s)`);

// ---------------------------------------------------------------- assertions
const missing = REQUIRED_CHAIN.filter((id) => !visited.includes(id));
if (missing.length) fail(`MVP chain rooms never visited on mobile: ${missing.join(', ')}`);
else step(`cleared the MVP chain on mobile: ${REQUIRED_CHAIN.join(' → ')}`);

const positions = REQUIRED_CHAIN.map((id) => visited.indexOf(id));
const ordered = positions.every((p, i) => i === 0 || p > positions[i - 1]);
if (!ordered) fail(`mobile chain order was not monotonic: ${positions.join(', ')}`);
else step('mobile chain order was monotonic');

if (!finished) fail(`mvp_slice never reported finished (last goal ${finalStatus?.currentGoal ?? '—'})`);
else step('mvp_slice reached its finale hands-free');

if (bugs.length > 0) {
  fail(`${bugs.length} navigation P1(s) on mobile`);
  for (const bug of bugs) {
    console.error(`      ${bug.id} ${bug.scene} @ (${bug.position.x}, ${bug.position.y}, ${bug.position.z}) goal=${bug.goal}`);
  }
} else {
  step('no navigation/collider P1s on mobile');
}

const touchStuck = await page.evaluate(() => window.__veilkeep.autoplay.getStatus().stuckTicks);
assert.ok(touchStuck < 90, `watchdog window left open on mobile: ${touchStuck} stuck ticks`);

assert.deepEqual(pageErrors, [], `uncaught page errors:\n${pageErrors.join('\n')}`);
step('no uncaught page errors');

const realConsoleErrors = consoleErrors.filter((e) => !e.includes('favicon'));
if (realConsoleErrors.length) fail(`console errors:\n${realConsoleErrors.join('\n')}`);
else step('console clean');

await browser.close();

if (process.exitCode) console.log('\nAUTOPLAY MOBILE FAILED');
else console.log('\nAUTOPLAY MOBILE PASSED — hands-free on Android emulation');
