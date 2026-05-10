import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT = 'test-screenshots';
fs.mkdirSync(SHOT, { recursive: true });

/**
 * Walks through the new features added in the 50-task review batch:
 * intro cinematic, daily mode, dungeon HUD chips, Q-cast frost nova,
 * boss intro card, achievements/stats modals.
 */

test('Intro cinematic — first launch', async ({ page }) => {
  // Don't seed dg_intro_seen — we want to see the intro.
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();
  // Card 1
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOT, 'nf-01-intro-card1.png') });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOT, 'nf-02-intro-card2.png') });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOT, 'nf-03-intro-card3.png') });
});

test('Title + Stats modal', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    // Seed some lifetime stats so the modal has interesting numbers.
    localStorage.setItem(
      'dg_lifetime_stats_v1',
      JSON.stringify({
        totalRuns: 12,
        wins: 4,
        deaths: 8,
        totalKills: 1247,
        totalCash: 8540,
        bestEndlessRound: 9,
        jackpots: 3,
        buildPlays: { gambler: 4, witch: 3, brute: 2, soldier: 2, duelist: 1 },
      })
    );
  });
  await page.goto('/');
  await page.screenshot({ path: path.join(SHOT, 'nf-04-title-with-stats-button.png') });
  await page.getByRole('button', { name: 'Stats' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOT, 'nf-05-stats-modal.png') });
});

test('Mode select with Daily card', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOT, 'nf-06-mode-with-daily.png'), fullPage: true });
});

test('BuildPicker — all 8 builds with swap UI', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click(); // Story
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT, 'nf-07-buildpicker-all-8.png'), fullPage: true });
  // Open weapon swap on first card
  await page.locator('.weapon-swap-btn').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT, 'nf-08-buildpicker-swap-open.png'), fullPage: true });
});

test('Wheels — spin both, JACKPOT-test mock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOT, 'nf-09-wheels-fresh.png') });
  // Click both spin buttons; capture mid-spin and after.
  await page.locator('.wheel-button-group--buff button').click();
  await page.locator('.wheel-button-group--curse button').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(SHOT, 'nf-10-wheels-spun.png') });
});

test('Dungeon — HUD chips + frost nova pip + first-help', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    // Don't seed dungeon-help so we see the first-time overlay.
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  // Spin both wheels via store so HUD chips populate
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const segs = (window as any).__DG.wheelsData;
    // Apply via the action so labels get tracked
    dg.gameStore.getState().applyWheelSegment('buff', { label: '+25 HP', color: '#4d8a52', luckScore: 8, apply: (s: any, m = 1) => { s.hp += 25 * m; s.hpMax += 25 * m; } });
    dg.gameStore.getState().applyWheelSegment('curse', { label: '-15 HP', color: '#7a3030', luckScore: 4, apply: (s: any, m = 1) => { s.hp = Math.max(20, s.hp - 15 * m); s.hpMax = Math.max(20, s.hpMax - 15 * m); } });
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForTimeout(1500); // intro card + first frame
  await page.screenshot({ path: path.join(SHOT, 'nf-11-dungeon-with-chips.png') });
  // Wait for intro + first-help to fade then capture HUD with active spell pip
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(SHOT, 'nf-12-dungeon-active-spell-ready.png') });
  // Cast frost nova
  await page.keyboard.press('q');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT, 'nf-13-frost-nova-cast.png') });
});

test('Boss raid intro card', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  // Force boss raid
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const total = dg.gameStore.getState().run.totalRaids;
    dg.gameStore.getState().setRaid(total);
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT, 'nf-14-boss-intro-card.png') });
});

test('Pause overlay via settings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').first().click();
  await page.evaluate(() => (window as any).__DG.gameStore.getState().showScene('dungeon'));
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForTimeout(3500); // let intro card clear
  // Open settings
  await page.locator('.settings-btn').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOT, 'nf-15-settings-pauses-dungeon.png') });
});
