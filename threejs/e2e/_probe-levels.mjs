import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

await page.goto('http://localhost:5199/?autoplay=1&speed=8', { waitUntil: 'load' });
await page.waitForFunction(() => window.__veilkeep?.qa, null, { timeout: 30_000 });
await page.evaluate(() => window.__veilkeep.autoplay.stop());
await page.waitForTimeout(300);

const snap = () => page.evaluate(() => ({
  scene: window.__veilkeep.scene,
  pos: window.__veilkeep.getDiagnostics().playerPos,
  state: { x: window.__veilkeep.playerState.x, z: window.__veilkeep.playerState.z },
  diag: window.__veilkeep.getDiagnostics(),
  mem: window.__veilkeep.renderer.info.memory,
}));

console.log('boot', JSON.stringify(await snap()));

// spawn floor
await page.evaluate(() => window.__veilkeep.loadScene('S00'));
await page.waitForTimeout(400);
console.log('S00 loaded', JSON.stringify(await snap()));
const stepped = await page.evaluate(() => window.__veilkeep.qa.stepPhysics(60));
console.log('after 60 physics steps', JSON.stringify(stepped));

// S00 -> OW1
await page.evaluate(() => window.__veilkeep.qa.teleport(0, -4.8));
await page.waitForTimeout(500);
console.log('after teleport to S00->OW1 door', JSON.stringify(await snap()));

// locked door: GH1 -> GH2 without the nail
await page.evaluate(() => window.__veilkeep.loadScene('GH1'));
await page.waitForTimeout(300);
await page.evaluate(() => window.__veilkeep.qa.teleport(0, -5));
await page.waitForTimeout(500);
console.log('GH1 locked door (expect GH1)', JSON.stringify(await snap()));

await page.evaluate(() => {
  window.__veilkeep.inventory.add('ITEM_IRON_NAIL');
  window.__veilkeep.qa.teleport(0, -5);
});
await page.waitForTimeout(500);
console.log('GH1 unlocked door (expect GH2)', JSON.stringify(await snap()));

// memory cycle
const mem = [];
const cycle = ['S00', 'OW1', 'GH1', 'GH2', 'GH3'];
await page.evaluate((scenes) => {
  for (const s of scenes) window.__veilkeep.loadScene(s);
}, cycle);
await page.waitForTimeout(300);
mem.push(await page.evaluate(() => window.__veilkeep.renderer.info.memory));
for (let rep = 0; rep < 3; rep++) {
  for (const s of [...cycle, 'S00']) {
    await page.evaluate((id) => window.__veilkeep.loadScene(id), s);
    await page.waitForTimeout(120);
  }
  mem.push(await page.evaluate(() => window.__veilkeep.renderer.info.memory));
}
console.log('memory', JSON.stringify(mem));

await browser.close();
