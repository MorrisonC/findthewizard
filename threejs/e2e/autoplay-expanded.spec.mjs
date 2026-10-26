import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));

// Clear storage before navigating
await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.clear();
});

console.log('Navigating with autoplay to', BASE);
await page.goto(`${BASE}?autoplay=1&speed=4&mode=mvp_slice`, { waitUntil: 'load' });
await page.waitForTimeout(3000);

if (await page.locator('#title-new-game').isVisible().catch(() => false)) {
  await page.click('#title-new-game');
  await page.waitForTimeout(2000);
}
if (await page.locator('text=Choose Your Origin').isVisible().catch(() => false)) {
  await page.locator('button', { hasText: 'Gutter-Alchemist' }).click();
  await page.waitForTimeout(1500);
}

// Ensure autoplay is started
await page.evaluate(() => {
  const vk = window.__veilkeep;
  if (vk && vk.autoplay && !vk.autoplay.running) {
    vk.autoplay.start({ mode: 'mvp_slice', speedMultiplier: 4 });
  }
});

// Track autoplay for 30 seconds
const history = [];
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const vk = window.__veilkeep;
    if (!vk) return null;
    const ap = vk.autoplay;
    const status = ap ? ap.getStatus() : null;
    return {
      scene: vk.scene,
      playerPos: vk.playerState ? { x: vk.playerState.x, z: vk.playerState.z } : null,
      autoStatus: status?.running ? 'running' : (vk.auto?.status || 'off'),
      autoGoal: status?.currentGoal || vk.auto?.goal,
      autoError: status?.lastError || vk.auto?.error,
      inventory: Array.from(vk.inventory ?? []),
      solvedPuzzles: Array.from(vk.solvedPuzzles ?? []),
      tasksDone: vk.auto?.tasksDone,
      stuckTicks: status?.stuckTicks ?? 0,
      visited: status?.visitedScenes ?? [],
      running: ap?.running || vk.auto?.enabled,
    };
  });
  if (state) {
    history.push(state);
    if (i % 4 === 0) {
      console.log(`[t=${(i*0.5).toFixed(1)}s] Scene: ${state.scene}, Pos: (${state.playerPos?.x?.toFixed(1)}, ${state.playerPos?.z?.toFixed(1)}), Goal: ${state.autoGoal}, Inv: [${state.inventory.join(',')}], Solved: [${state.solvedPuzzles.join(',')}], Tasks: ${state.tasksDone}, Error: ${state.autoError}, Stuck: ${state.stuckTicks}`);
    }
  }
}

await page.screenshot({ path: 'test-results/autoplay-expanded.png' });
console.log('Final Scene:', history[history.length - 1]?.scene);
console.log('All Visited Scenes:', history[history.length - 1]?.visited);
console.log('Errors:', errors);

await browser.close();
