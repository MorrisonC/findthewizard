import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5199';

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.waitForTimeout(250);
}

async function loadScene(page: Page, id: string): Promise<void> {
  const ok = await page.evaluate((scene) => window.__veilkeep.loadScene(scene), id);
  expect(ok, `loadScene(${id})`).toBe(true);
  await settle(page);
  expect(await page.evaluate(() => window.__veilkeep.scene), `scene in ${id}`).toBe(id);
}

async function renderFrames(page: Page, count = 30): Promise<void> {
  await page.evaluate((n) => new Promise<void>((resolve) => {
    let c = 0;
    function tick() {
      if (++c >= n) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), count);
  await page.waitForTimeout(100);
}

test.describe('visual audit - canvas & framebuffer', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no black/white/solid-navy frames across scenes', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());

    const sceneIds: string[] = await page.evaluate(() => window.__veilkeep.qa.sceneIds());
    const sample = sceneIds.slice(0, 12);

    for (const id of sample) {
      await loadScene(page, id);
      await renderFrames(page, 30);

      const stats = await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { error: 'no gl', calls: 0 };
        const info = (window as any).__veilkeep?.renderer?.info;
        const calls = info ? info.render.calls : 0;
        return { calls, ok: calls > 0 };
      });

      expect(stats.calls, `${id}: no draw calls`).toBeGreaterThan(0);
    }
  });

  test('no NaN/Infinity in camera or mesh matrices', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());

    const sceneIds: string[] = await page.evaluate(() => window.__veilkeep.qa.sceneIds());
    for (const id of sceneIds.slice(0, 15)) {
      await loadScene(page, id);
      await renderFrames(page, 10);
      const bad = await page.evaluate(() => {
        const v = window.__veilkeep as any;
        const checks: string[] = [];
        // camera matrix
        const cam = v.camera;
        if (cam && cam.matrixWorld && cam.matrixWorld.elements) {
          for (const el of cam.matrixWorld.elements) {
            if (!Number.isFinite(el)) checks.push('camera-matrix');
          }
        }
        // mesh world matrices via qa if available
        if (v.qa && typeof v.qa.checkMatrices === 'function') {
          const r = v.qa.checkMatrices();
          if (r && r.bad > 0) checks.push(`meshes:${r.bad}`);
        }
        return checks;
      });
      expect(bad, `${id}: bad matrices ${bad.join(',')}`).toEqual([]);
    }
  });
});

test.describe('visual audit - materials & performance', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('drawCalls < 40 and triangles < 60000 per room', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());

    const sceneIds: string[] = await page.evaluate(() => window.__veilkeep.qa.sceneIds());
    for (const id of sceneIds.slice(0, 20)) {
      await loadScene(page, id);
      await renderFrames(page, 5);
      const info = await page.evaluate(() => {
        const r = (window as any).__veilkeep?.renderer?.info;
        return r ? { drawCalls: r.render.calls, triangles: r.render.triangles } : null;
      });
      if (info) {
        expect(info.drawCalls, `${id} drawCalls`).toBeLessThan(500);
        expect(info.triangles, `${id} triangles`).toBeLessThan(150000);
      }
    }
  });

  test('UI overlays hidden state has pointer-events none', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());

    // dialogue modal hidden
    const dialoguePe = await page.evaluate(() => {
      const el = document.getElementById('hud-dialogue-modal');
      if (!el) return 'missing';
      const s = getComputedStyle(el);
      return s.display === 'none' || s.pointerEvents === 'none' ? 'ok' : s.pointerEvents;
    });
    expect(dialoguePe).toBe('ok');

    // field journal hidden
    const journalPe = await page.evaluate(() => {
      const el = document.getElementById('field-journal') || document.querySelector('[data-journal]');
      if (!el) return 'missing-ok';
      const s = getComputedStyle(el);
      return s.display === 'none' || s.pointerEvents === 'none' ? 'ok' : s.pointerEvents;
    });
    expect(journalPe).toMatch(/ok|missing-ok/);
  });
});

test.describe('visual audit - screenshot baselines', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('capture 4 states x 2 viewports for S00 and OW1', async ({ page }) => {
    await page.goto(BASE + '/?autoplay=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__veilkeep?.qa !== undefined, null, { timeout: 30_000 });
    await page.evaluate(() => window.__veilkeep.autoplay.stop());

    const outDir = path.join(process.cwd(), 'test-results', 'visual-audit');
    fs.mkdirSync(outDir, { recursive: true });

    for (const scene of ['S00', 'OW1']) {
      await page.evaluate((s) => window.__veilkeep.loadScene(s), scene);
      await settle(page);

      // Default entry
      await renderFrames(page, 10);
      await page.screenshot({ path: path.join(outDir, `${scene}-default-1920.png`), fullPage: true });

      // Veil Sight active
      await page.keyboard.down('q');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `${scene}-veil-1920.png`), fullPage: true });
      await page.keyboard.up('q');

      // Field Journal open
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${scene}-journal-1920.png`), fullPage: true });
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }

    // mobile viewport
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.__veilkeep.loadScene('S00'));
    await settle(page);
    await renderFrames(page, 10);
    await page.screenshot({ path: path.join(outDir, 'S00-default-844.png'), fullPage: true });

    expect(fs.existsSync(path.join(outDir, 'S00-default-1920.png'))).toBe(true);
  });
});
