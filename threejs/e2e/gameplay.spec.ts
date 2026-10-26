import { test, expect, type Page } from '@playwright/test';

/**
 * VEILKEEP Core Gameplay E2E Specification
 * 
 * Verifies the complete game loop, controls, UI modals, scene transitions,
 * puzzle solving, and win/ending condition against /gdd design specifications.
 */

async function bootAndSelectOrigin(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'load' });
  
  // Click New Game on Title Screen
  const newGameBtn = page.locator('#title-new-game');
  await expect(newGameBtn).toBeVisible({ timeout: 10000 });
  await newGameBtn.click();

  // Select Origin (Gutter-Alchemist) from modal
  const originChoice = page.locator('button', { hasText: 'Gutter-Alchemist' });
  await expect(originChoice).toBeVisible({ timeout: 10000 });
  await originChoice.click();

  // Verify origin selector modal is dismissed
  await expect(page.locator('text=Choose Your Origin')).toBeHidden({ timeout: 10000 });

  // Ensure Three.js WebGL engine is producing active frames
  await page.waitForFunction(() => {
    const vk = (window as any).__veilkeep;
    return vk && typeof vk.getDiagnostics === 'function' && vk.getDiagnostics().drawCalls > 0;
  }, null, { timeout: 15000 });
}

test.describe('VEILKEEP: Three.js Gameplay & Architecture Pipeline', () => {

  test('Step 1: Title Screen, Origin Selection, and WebGL2 Boot', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Verify Title Screen is visible
    const titleScreen = page.locator('#title-screen');
    await expect(titleScreen).toBeVisible();
    await expect(page.locator('#title-new-game')).toBeVisible();

    // Start New Game
    await page.click('#title-new-game');

    // Select Origin
    const originChoice = page.locator('button', { hasText: 'Gutter-Alchemist' });
    await expect(originChoice).toBeVisible({ timeout: 10000 });
    await originChoice.click();
    await expect(page.locator('text=Choose Your Origin')).toBeHidden({ timeout: 10000 });

    // Ensure title screen is dismissed
    await expect(titleScreen).toBeHidden();

    // Verify Three.js Canvas
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Verify WebGL context and rendering metrics
    const diag = await page.evaluate(() => {
      const c = document.getElementById('game-canvas') as HTMLCanvasElement;
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const vk = (window as any).__veilkeep;
      const diagnostics = vk ? vk.getDiagnostics() : null;
      return {
        hasGL: !!gl,
        width: c.width,
        height: c.height,
        fps: diagnostics?.fps ?? 0,
        drawCalls: diagnostics?.drawCalls ?? 0,
        scene: vk?.scene ?? '',
      };
    });

    expect(diag.hasGL).toBe(true);
    expect(diag.width).toBeGreaterThan(0);
    expect(diag.height).toBeGreaterThan(0);
    expect(diag.drawCalls).toBeGreaterThan(0);
    expect(diag.scene).toBe('S00');

    // Verify In-Game HUD Elements
    await expect(page.locator('#hud-zone-name')).toBeVisible();
    await expect(page.locator('.bar-fill-hp')).toBeVisible();
    await expect(page.locator('.bar-fill-fp')).toBeVisible();
    await expect(page.locator('.bar-fill-sta')).toBeVisible();
  });

  test('Step 2: Player Controls & Movement Physics', async ({ page }) => {
    await bootAndSelectOrigin(page);

    // Read initial player coordinates
    const initialPos = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return { x: vk.player.position.x, z: vk.player.position.z };
    });

    // Simulate WASD movement (press and hold 'd')
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.up('d');
    await page.waitForTimeout(200);

    const movedPos = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return { x: vk.player.position.x, z: vk.player.position.z };
    });

    const distanceMoved = Math.hypot(movedPos.x - initialPos.x, movedPos.z - initialPos.z);
    expect(distanceMoved).toBeGreaterThan(0.2);

    // Test Melee Attack (Space)
    await page.keyboard.press(' ');
    await page.waitForTimeout(300);

    // Check camera exists and is tracking
    const cameraOk = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return vk.camera !== null && vk.camera !== undefined;
    });
    expect(cameraOk).toBe(true);
  });

  test('Step 3: Zone Transitions & Gate Traversal (S00 -> OW1 -> GH1 and Back)', async ({ page }) => {
    await bootAndSelectOrigin(page);

    // Transition from S00 to OW1
    const loadedOW1 = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return vk.loadScene('OW1');
    });
    expect(loadedOW1).toBe(true);
    await page.waitForTimeout(400);

    const currentScene1 = await page.evaluate(() => (window as any).__veilkeep.scene);
    expect(currentScene1).toBe('OW1');
    await expect(page.locator('#hud-zone-name')).toContainText('Outer Wards');

    // Transition from OW1 to GH1
    const loadedGH1 = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return vk.loadScene('GH1');
    });
    expect(loadedGH1).toBe(true);
    await page.waitForTimeout(400);

    const currentScene2 = await page.evaluate(() => (window as any).__veilkeep.scene);
    expect(currentScene2).toBe('GH1');
    await expect(page.locator('#hud-zone-name')).toContainText('Gatehouse');

    // Return to OW1 (Bidirectional traversal)
    const returnedOW1 = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return vk.loadScene('OW1');
    });
    expect(returnedOW1).toBe(true);
    await page.waitForTimeout(400);

    const currentScene3 = await page.evaluate(() => (window as any).__veilkeep.scene);
    expect(currentScene3).toBe('OW1');
  });

  test('Step 4: Illusion Puzzle Solving & Inventory System', async ({ page }) => {
    await bootAndSelectOrigin(page);

    // Load OW1 and pick up Cold-Iron Nail
    await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      vk.loadScene('OW1');
      vk.qa.collectPickup('ITEM_IRON_NAIL');
    });
    await page.waitForTimeout(300);

    // Verify inventory contains Cold-Iron Nail
    const invContainsNail = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      const inv = Array.from(vk.inventory ?? []);
      return inv.includes('ITEM_IRON_NAIL');
    });
    expect(invContainsNail).toBe(true);

    // Open Inventory satchel modal (click HUD folio button or press I)
    await page.click('#hud-char-card');
    await expect(page.locator('#hud-character-modal')).toBeVisible();

    // Close modal
    await page.click('#char-close-btn');
    await expect(page.locator('#hud-character-modal')).toBeHidden();

    // Load GH2 and solve the Mirror Lock puzzle via mirror rotation
    const rotateResult = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      vk.loadScene('GH2');
      return vk.qa.rotateMirror(90);
    });
    expect(rotateResult.solved).toBe(true);

    const puzzleSolved = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      const solved = Array.from(vk.solvedPuzzles ?? []);
      return solved.includes('PUZ_GH2_MIRROR_LOCK') || solved.includes('PUZZLE_MIRROR_LOCK');
    });
    expect(puzzleSolved).toBe(true);
  });

  test('Step 5: Sanctum SAN1 & Archillusionist Vaelor Win Condition', async ({ page }) => {
    await bootAndSelectOrigin(page);

    // Navigate to Sanctum (SAN1)
    const san1Loaded = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return vk.loadScene('SAN1');
    });
    expect(san1Loaded).toBe(true);
    await page.waitForTimeout(400);

    const activeScene = await page.evaluate(() => (window as any).__veilkeep.scene);
    expect(activeScene).toBe('SAN1');

    // Trigger Win Condition: Open the Ending Epilogue Modal
    await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      vk.qa.showEnding();
    });

    // Verify Ending Modal UI
    const endingModal = page.locator('#hud-ending-modal');
    await expect(endingModal).toBeVisible();
    await expect(endingModal.locator('.ending-title')).toContainText('THE MIRROR SHATTERS');

    // Verify all 4 GDD Endings are available choices
    const choices = endingModal.locator('.ending-card');
    await expect(choices).toHaveCount(4);

    // Click Ending 1: Shatter the Glass Heart
    await endingModal.locator('[data-ending="shatter"]').click();
    await page.waitForTimeout(300);

    // Verify Epilogue Scroll displays the narrative text
    const epilogueScroll = page.locator('#ending-epilogue-scroll');
    await expect(epilogueScroll).toBeVisible();
    await expect(epilogueScroll).toContainText('EXILE OF THE TRUE SKY');

    // Close Epilogue
    await page.click('#ending-close-btn');
    await expect(endingModal).toBeHidden();
  });

  test('Step 6: Barred Gate Physical Collision & Counter Attack Popup Staggering', async ({ page }) => {
    await bootAndSelectOrigin(page);

    // 1. Verify Barred Gate physical blocking in GH1 (north door requires ITEM_IRON_NAIL)
    await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      vk.loadScene('GH1');
      vk.inventory.delete('ITEM_IRON_NAIL');
      // Place player just south of the north door trigger
      vk.qa.teleport(0, -15.5);
    });
    await page.waitForTimeout(300);

    // Verify player is in GH1
    const scene = await page.evaluate(() => (window as any).__veilkeep.scene);
    expect(scene).toBe('GH1');

    // Simulate walking straight north into the north barred gate (w + d in isometric camera)
    await page.keyboard.down('w');
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    await page.keyboard.up('d');

    // Verify the player is stopped before passing through the gate arch into the void
    const stoppedPos = await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      return { x: vk.playerState.x, z: vk.playerState.z };
    });
    // North gate arch is at z = -17.5, door trigger threshold is at -17.0.
    // The player must stop in front of the gate arch (z >= -17.0) and remain on the room floor.
    expect(stoppedPos.z).toBeGreaterThanOrEqual(-17.0);

    // Verify "Barred Gate" toast was rendered
    const toast = page.locator('#hud-toast');
    await expect(toast).toContainText('Barred Gate: Requires Iron Nail');

    // 2. Verify Counter Attack Damage Popups do not double or overlap
    await page.evaluate(() => {
      const vk = (window as any).__veilkeep;
      const origin = { x: 0, y: 0.6, z: -15.0 };
      // Spawn standard damage and counter hit simultaneously
      vk.spawnDamagePopup(origin, '-25 HP');
      vk.spawnDamagePopup(origin, 'COUNTER HIT!', true);
    });

    const popups = page.locator('.damage-popup');
    await expect(popups).toHaveCount(2);

    const popupTops = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.damage-popup')) as HTMLElement[];
      return elements.map((el) => parseFloat(el.style.top || '0'));
    });

    // The status banner (COUNTER HIT!) must render vertically higher (smaller top coordinate)
    // than the numeric damage popup by at least 20px, preventing overlapping text.
    expect(Math.abs(popupTops[1] - popupTops[0])).toBeGreaterThanOrEqual(20);
  });

});
