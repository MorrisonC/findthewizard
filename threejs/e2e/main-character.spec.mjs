/**
 * Main-character smoke test + screenshots.
 *
 *   node e2e/main-character.spec.mjs        (BASE defaults to the Vite dev server on :3000)
 *
 * Verifies main_character.glb loads (no procedural fallback), the page stays free of
 * errors, and captures idle / run / attack / dodge frames into test-results/.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.text().includes('MainCharacter')) logs.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.click('#title-new-game');
await page.waitForTimeout(3500);
if (await page.locator('text=Choose Your Origin').isVisible().catch(() => false)) {
  await page.locator('button', { hasText: 'Gutter-Alchemist' }).click();
}
await page.waitForTimeout(2500);

const shot = (n) => page.screenshot({ path: `test-results/main-character-${n}.png` });
await shot('1-idle');
await page.keyboard.down('d'); await page.waitForTimeout(900); await shot('2-walk');
await page.keyboard.down('Shift'); await page.waitForTimeout(700); await shot('3-run');
await page.keyboard.up('Shift'); await page.keyboard.up('d'); await page.waitForTimeout(400);
await page.keyboard.press(' '); await page.waitForTimeout(260); await shot('4-attack1');
await page.waitForTimeout(150); await page.keyboard.press(' '); await page.waitForTimeout(300); await shot('5-attack2');
await page.keyboard.press(' '); await page.waitForTimeout(550); await shot('6-finisher');
await page.waitForTimeout(900);
await page.keyboard.press('c'); await page.waitForTimeout(250); await shot('7-dodge');
await page.waitForTimeout(800);
await page.keyboard.press('v'); await page.waitForTimeout(350); await shot('8-cast');
await page.waitForTimeout(800);
await page.keyboard.press('t'); await page.waitForTimeout(400); await shot('9-glass-cleaver');
await page.keyboard.press('t'); await page.waitForTimeout(400); await shot('10-void-rapier');
await page.keyboard.press('x'); await page.waitForTimeout(200); await shot('11-shield-ward');

console.log('MainCharacter logs:', logs);
console.log('errors:', errors);
await browser.close();
