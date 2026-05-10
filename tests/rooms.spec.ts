import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT = 'test-screenshots';
fs.mkdirSync(SHOT, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
});

test('Story-mode room layout — visible zones in raid 1', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click(); // Story
  await page.locator('.build-card').first().click(); // Gambler
  // Skip wheels (use noop segments) and jump to dungeon
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const noop = (s: any) => s;
    dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
    dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(3500); // intro card clears
  await page.screenshot({ path: path.join(SHOT, 'rm-01-raid1-spawn.png') });
  // Walk east to discover the next zone
  await page.keyboard.down('d');
  await page.waitForTimeout(2500);
  await page.keyboard.up('d');
  await page.screenshot({ path: path.join(SHOT, 'rm-02-raid1-walking.png') });
  // Capture HUD info
  const hud = await page.evaluate(() => document.querySelector('.dungeon-info')?.textContent);
  console.log('\nHUD:', hud);
});

test('Story-mode room layout — raid 3 (more rooms)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const noop = (s: any) => s;
    dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
    dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
    dg.gameStore.getState().setRaid(3);
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(SHOT, 'rm-03-raid3-spawn.png') });
  const hud = await page.evaluate(() => document.querySelector('.dungeon-info')?.textContent);
  console.log('\nHUD raid3:', hud);
});
