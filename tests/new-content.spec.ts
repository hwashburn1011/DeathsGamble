import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT = 'test-screenshots';
fs.mkdirSync(SHOT, { recursive: true });

/**
 * Visual checks for the latest 5 tasks (#140-#144):
 * - new Death graphic
 * - slot-mode rendering
 * - reduced statues + scattered props in dungeon
 * - replaced curse-wheel blank slot
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
});

test('Wheels — wheel mode (default) — new Death + curse wheel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT, 'nc-01-wheels-mode.png') });
});

test('Wheels — slot mode renders vertical reels', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    // Force slot mode in settings before mount.
    const raw = localStorage.getItem('deathsgamble_save_v6');
    const obj = raw ? JSON.parse(raw) : { settings: {}, persistent: {} };
    obj.settings = { ...obj.settings, wheelMode: 'slot' };
    localStorage.setItem('deathsgamble_save_v6', JSON.stringify(obj));
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOT, 'nc-02-slot-mode-fresh.png') });
  // Spin both
  await page.locator('.wheel-button-group--buff button').click();
  await page.locator('.wheel-button-group--curse button').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOT, 'nc-03-slot-mid-spin.png') });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(SHOT, 'nc-04-slot-spun.png') });
});

test('Dungeon — reduced statues + new prop layer', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.evaluate(() => (window as any).__DG.gameStore.getState().showScene('dungeon'));
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForTimeout(3500); // intro card clears
  await page.screenshot({ path: path.join(SHOT, 'nc-05-dungeon-crypt-props.png') });
});

test('Dungeon — hellscape (boss raid) shows blood-tinted props', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const total = dg.gameStore.getState().run.totalRaids;
    dg.gameStore.getState().setRaid(total);
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(SHOT, 'nc-06-dungeon-hellscape.png') });
});
