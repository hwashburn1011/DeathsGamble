import { test, expect, Page, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT_DIR = 'test-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

interface FailedRequest {
  url: string;
  status: number;
}

/**
 * Hook console errors + 4xx/5xx responses on the page.
 * Returns getters that the test can assert against.
 */
// Skip the first-launch intro card sequence — tests assume the title button
// goes straight to mode select.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
});

function watch(page: Page) {
  const failed: FailedRequest[] = [];
  const consoleErrors: string[] = [];
  page.on('response', (r: Response) => {
    if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGEERROR: ${err.message}`);
  });
  return {
    get failed() { return failed; },
    get consoleErrors() { return consoleErrors; },
  };
}

/** Wait until the dungeon's preload card disappears (assets loaded). */
async function waitForDungeonReady(page: Page) {
  // Preload card has class .dungeon-preload-card. When loading completes,
  // the parent .dungeon-loading is removed.
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30_000 });
}

/** Use the debug hook to jump straight into a dungeon for the given theme. */
async function jumpToDungeonForTheme(
  page: Page,
  setup: 'crypt' | 'catacomb' | 'hellscape-boss' | 'cavern-endless'
) {
  await page.goto('/?debug=1');
  // Wait for the debug hook to attach
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore), null, { timeout: 5_000 });
  // Jump through pickBuild → wheels first to populate stats
  await page.evaluate((scenario) => {
    type Storeish = {
      getState: () => any;
      setState: (s: any) => void;
    };
    const dg = (window as any).__DG as {
      gameStore: Storeish;
      settingsStore: Storeish;
    };

    // Difficulty + mode setup (defaults: normal/story)
    if (scenario === 'cavern-endless') {
      dg.settingsStore.setState({ difficulty: 'normal' });
    } else {
      dg.settingsStore.setState({ difficulty: 'normal' });
    }
  }, setup);

  // Walk normal UI: title → mode → build picker → wheels (then jump scenes)
  await page.getByRole('button', { name: 'Start Game' }).click();
  if (setup === 'cavern-endless') {
    await page.locator('.mode-card').nth(1).click(); // Infinite
  } else {
    await page.locator('.mode-card').nth(0).click(); // Story
  }
  // Pick first build
  await page.locator('.build-card').first().click();
  await expect(page.locator('.wheels-scene')).toBeVisible();

  // Now jump store state for the specific theme target, then route to dungeon
  await page.evaluate((scenario) => {
    const dg = (window as any).__DG;
    const gs = dg.gameStore.getState();
    if (scenario === 'crypt') {
      // Story raid 1 default — already there
    } else if (scenario === 'catacomb') {
      gs.setRaid(2);
    } else if (scenario === 'hellscape-boss') {
      // raid >= totalRaids → boss raid
      const totalRaids = dg.gameStore.getState().run.totalRaids;
      gs.setRaid(totalRaids);
    } else if (scenario === 'cavern-endless') {
      // endlessRound=2 → cavern in the rotation
      gs.setEndlessRound(2);
    }
    gs.initStatsForRaid();
    gs.showScene('dungeon');
  }, setup);

  await waitForDungeonReady(page);
  // Give a beat for first-frame render
  await page.waitForTimeout(800);
}

test.describe('Asset / texture smoke tests', () => {
  test('Title → mode → build picker — clean load', async ({ page }) => {
    const w = watch(page);

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '01-title.png'), fullPage: false });

    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByText(/Choose Your Path/i)).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '02-modeselect.png'), fullPage: false });

    await page.locator('.mode-card').nth(0).click();
    await expect(page.getByText(/Choose Your Build/i)).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '03-buildpicker.png'), fullPage: false });

    await page.locator('.build-card').first().click();
    await expect(page.locator('.wheels-scene')).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOT_DIR, '04-wheels.png'), fullPage: false });

    expect(w.failed, 'No failed network requests:\n' + JSON.stringify(w.failed, null, 2)).toEqual([]);
    expect(w.consoleErrors, 'No console errors:\n' + w.consoleErrors.join('\n')).toEqual([]);
  });

  test('Theme: crypt (story raid 1) loads cleanly', async ({ page }) => {
    const w = watch(page);
    await jumpToDungeonForTheme(page, 'crypt');
    await page.screenshot({ path: path.join(SHOT_DIR, '05-dungeon-crypt.png') });
    expect(w.failed, 'No failed asset requests:\n' + JSON.stringify(w.failed, null, 2)).toEqual([]);
    expect(w.consoleErrors).toEqual([]);
  });

  test('Theme: catacomb (story raid 2) loads cleanly', async ({ page }) => {
    const w = watch(page);
    await jumpToDungeonForTheme(page, 'catacomb');
    await page.screenshot({ path: path.join(SHOT_DIR, '06-dungeon-catacomb.png') });
    expect(w.failed, 'No failed asset requests:\n' + JSON.stringify(w.failed, null, 2)).toEqual([]);
    expect(w.consoleErrors).toEqual([]);
  });

  test('Theme: hellscape boss raid loads cleanly', async ({ page }) => {
    const w = watch(page);
    await jumpToDungeonForTheme(page, 'hellscape-boss');
    await page.screenshot({ path: path.join(SHOT_DIR, '07-dungeon-hellscape-boss.png') });
    expect(w.failed, 'No failed asset requests:\n' + JSON.stringify(w.failed, null, 2)).toEqual([]);
    expect(w.consoleErrors).toEqual([]);
    // Boss-specific UI present
    await expect(page.locator('.dungeon-boss-name')).toBeVisible();
  });

  test('Theme: cavern (endless round 2) loads cleanly', async ({ page }) => {
    const w = watch(page);
    await jumpToDungeonForTheme(page, 'cavern-endless');
    await page.screenshot({ path: path.join(SHOT_DIR, '08-dungeon-cavern.png') });
    expect(w.failed, 'No failed asset requests:\n' + JSON.stringify(w.failed, null, 2)).toEqual([]);
    expect(w.consoleErrors).toEqual([]);
  });
});
