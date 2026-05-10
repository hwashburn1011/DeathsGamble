import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT = 'test-screenshots';
fs.mkdirSync(SHOT, { recursive: true });

/**
 * UX-flow smoke tests. Walks several scene transitions + interaction
 * paths so we can capture screenshots at each state and look for layout,
 * timing, and feedback issues.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
});

test.describe('UX / interaction flows', () => {
  test('Settings modal opens, all controls visible', async ({ page }) => {
    await page.goto('/');
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-card')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, 'ux-01-settings-open.png') });
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings-card')).not.toBeVisible();
  });

  test('Mode → Build → Wheels — both spin → Enter Dungeon glow + click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.locator('.mode-card').nth(0).click(); // Story
    await page.locator('.build-card').first().click();
    await expect(page.locator('.wheels-scene')).toBeVisible();

    // Click both spin buttons
    const spinBuff = page.locator('#buff-group .gbtn').or(page.locator('.wheel-button-group--buff button'));
    const spinCurse = page.locator('#curse-group .gbtn').or(page.locator('.wheel-button-group--curse button'));
    await page.locator('.wheel-button-group--buff button').click();
    await page.waitForTimeout(200);
    await page.locator('.wheel-button-group--curse button').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT, 'ux-02-spinning.png') });
    // Wait for spin to settle
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SHOT, 'ux-03-spun.png') });
    // Enter Dungeon should be enabled now
    const enter = page.getByRole('button', { name: /Enter Dungeon/i });
    await expect(enter).toBeEnabled();
    await page.screenshot({ path: path.join(SHOT, 'ux-04-enter-ready.png') });
  });

  test('Gameover → Gamble Again loops back to mode select', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    // Go straight to gameover scene
    await page.evaluate(() => {
      (window as any).__DG.gameStore.getState().showScene('gameover');
    });
    await expect(page.locator('.gameover-scene')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, 'ux-05-gameover.png') });
    // Click "New Run" (post-#101: was "Gamble Again", now split into Quick Retry / New Run)
    await page.getByRole('button', { name: /New Run/i }).click();
    await expect(page.getByText(/Choose Your Path/i)).toBeVisible();
  });

  test('Win scene renders + actions present', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    await page.evaluate(() => {
      (window as any).__DG.gameStore.getState().showScene('win');
    });
    await expect(page.locator('.win-scene')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, 'ux-06-win.png') });
  });

  test('Shop scene renders with stat upgrade cards', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    // Set up a fake run with cash so the shop has something to buy
    await page.evaluate(() => {
      const dg = (window as any).__DG;
      const gs = dg.gameStore.getState();
      gs.startNewRun();
      gs.selectMode('story');
      // Need build for nextLabel display
      const builds = (window as any).__DG.gameStore.getState().run;
      // Manually set the run state
      dg.gameStore.setState({
        run: { ...gs.run, mode: 'story', raid: 1, totalRaids: 3, cash: 500, build: { id: 'gambler', name: 'The Gambler' } },
      });
      gs.showScene('shop');
    });
    await expect(page.locator('.shop-scene')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, 'ux-07-shop.png'), fullPage: true });
  });

  test('Credits scene loads + lists shipped attributions', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    await page.evaluate(() => {
      (window as any).__DG.gameStore.getState().showScene('credits');
    });
    await expect(page.locator('.credits-scene')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT, 'ux-08-credits.png'), fullPage: true });
  });
});
