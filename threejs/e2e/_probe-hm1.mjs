import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:5199/?autoplay=1&speed=8', { waitUntil: 'load' });
await page.waitForFunction(() => window.__veilkeep?.qa, null, { timeout: 30_000 });
await page.evaluate(() => window.__veilkeep.autoplay.stop());
await page.waitForTimeout(400);

const snap = () => page.evaluate(() => ({
  scene: window.__veilkeep.scene,
  x: +window.__veilkeep.playerState.x.toFixed(2),
  z: +window.__veilkeep.playerState.z.toFixed(2),
  spawn: window.__veilkeep.qa.spawnFor(window.__veilkeep.scene),
  cooling: window.__veilkeep.qa ? undefined : undefined,
}));

// Reproduce the HM1 test order: GH3 first, then BQ1.
await page.evaluate(() => window.__veilkeep.loadScene('HM1'));
await page.waitForTimeout(300);
console.log('HM1 loaded', JSON.stringify(await snap()));

await page.evaluate(() => window.__veilkeep.qa.teleport(0, 5));
await page.waitForTimeout(700);
console.log('after GH3 door', JSON.stringify(await snap()));

await page.evaluate(() => window.__veilkeep.loadScene('HM1'));
await page.waitForTimeout(300);
console.log('HM1 reloaded', JSON.stringify(await snap()));

await page.evaluate(() => {
  window.__veilkeep.solvedPuzzles.add('PUZZLE_TRUE_MIRROR');
  window.__veilkeep.qa.teleport(0, -5);
});

for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(100);
  console.log(i, JSON.stringify(await snap()));
}

await browser.close();
