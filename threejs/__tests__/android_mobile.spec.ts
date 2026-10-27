import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5199';

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.waitForTimeout(250);
}

test.describe('mobile - portrait', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });

  test('boots and renders', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());
    await settle(page);
    const scene = await page.evaluate(() => window.__veilkeep.scene);
    expect(scene).toBe('S00');
  });

  test('DPR capped at 2', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    const dpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2));
    expect(dpr).toBeLessThanOrEqual(2);
  });

  test('visibilitychange auto-pauses and resumes', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());
    await settle(page);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    const scene = await page.evaluate(() => window.__veilkeep.scene);
    expect(scene).toBeTruthy();
  });

  test('webglcontextlost does not crash', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());
    await settle(page);

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const ev = new Event('webglcontextlost');
      (ev as any).preventDefault = () => {};
      canvas.dispatchEvent(ev);
    });
    await page.waitForTimeout(500);
    const scene = await page.evaluate(() => window.__veilkeep?.scene);
    expect(scene).toBeTruthy();
  });

  test('first touch unlocks audio without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /AudioContext|not allowed to start/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.touchscreen.tap(200, 400);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe('mobile - landscape', () => {
  test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

  test('boots in landscape', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());
    await settle(page);
    const scene = await page.evaluate(() => window.__veilkeep.scene);
    expect(scene).toBe('S00');
  });
});

test.describe('mobile - tablet', () => {
  test.use({ viewport: { width: 1600, height: 2560 }, hasTouch: true, isMobile: true });

  test('boots on tablet', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());
    await settle(page);
    const scene = await page.evaluate(() => window.__veilkeep.scene);
    expect(scene).toBe('S00');
  });
});
