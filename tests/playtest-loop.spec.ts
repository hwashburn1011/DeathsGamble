import { test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Playtest exploration spec — runs 5 scenarios, captures screenshots and
// console errors at key moments, prints observations to stdout. NOT a
// pass/fail test; reads as a checklist for the human reviewer.

const SHOT = 'test-screenshots/playtest';
fs.mkdirSync(SHOT, { recursive: true });

interface Observations {
  loop: string;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
  notes: string[];
}

async function setupPage(page: Page) {
  // Seed all unlocks + skip intros so we can pick any build.
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
    localStorage.setItem('deathsgamble_souls_v1', JSON.stringify({
      souls: 999,
      unlocked: ['unlock_soldier', 'unlock_duelist', 'unlock_huntsman', 'unlock_arcanist', 'unlock_rogue'],
      hasPlayed: true,
    }));
  });
}

function attachLog(page: Page, obs: Observations) {
  page.on('console', (m) => {
    if (m.type() === 'error') obs.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => {
    obs.pageErrors.push(e.message);
  });
}

async function shot(page: Page, obs: Observations, name: string) {
  const file = path.join(SHOT, `${obs.loop}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  obs.screenshots.push(file);
}

async function readHud(page: Page) {
  return await page.evaluate(() => {
    const pairs = Array.from(document.querySelectorAll('.dungeon-info .info-pair'));
    const get = (label: string) => {
      const p = pairs.find((el) => el.querySelector('.info-l')?.textContent?.trim().toUpperCase() === label);
      return p?.querySelector('.info-v')?.textContent?.trim() ?? '';
    };
    const hpRow = Array.from(document.querySelectorAll('.dungeon-hud .hud-row')).find(
      (r) => r.textContent?.includes('HP'),
    );
    const hpValueSpan = hpRow ? hpRow.children[hpRow.children.length - 1] : null;
    const hpText = hpValueSpan?.textContent?.trim() ?? '0 / 0';
    return {
      kills: get('KILLS'),
      time: get('TIME'),
      hp: hpText,
      raid: get('RAID'),
    };
  });
}

async function jumpToDungeon(page: Page, buildIdx: number, mode: 'story' | 'infinite' = 'story', difficulty: 'easy' | 'normal' | 'hard' = 'normal', raid?: number) {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  if (difficulty !== 'normal') {
    await page.evaluate((d) => {
      (window as any).__DG.settingsStore.setState({ difficulty: d });
    }, difficulty);
  }
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(mode === 'story' ? 0 : 1).click();
  await page.locator('.build-card').nth(buildIdx).click();
  // Skip both wheel spins; if `raid` is set, jump to that raid first.
  await page.evaluate((r) => {
    const dg = (window as any).__DG;
    const noop = (s: any) => s;
    if (r !== undefined) dg.gameStore.getState().setRaid(r);
    dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
    dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
    dg.gameStore.getState().showScene('dungeon');
  }, raid);
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(2700);
}

// Walk the player a small distance using key presses.
async function walk(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

const observations: Observations[] = [];

test.afterAll(() => {
  console.log('\n\n============= PLAYTEST OBSERVATIONS =============\n');
  for (const o of observations) {
    console.log(`\n--- LOOP: ${o.loop} ---`);
    if (o.consoleErrors.length) console.log(`Console errors (${o.consoleErrors.length}):`);
    for (const e of o.consoleErrors) console.log(`  - ${e}`);
    if (o.pageErrors.length) console.log(`Page errors (${o.pageErrors.length}):`);
    for (const e of o.pageErrors) console.log(`  - ${e}`);
    if (o.notes.length) console.log(`Notes (${o.notes.length}):`);
    for (const n of o.notes) console.log(`  - ${n}`);
    console.log(`Screenshots: ${o.screenshots.length}`);
  }
  console.log('\n============ END OBSERVATIONS ============\n');
});

test('Loop 1 — Gambler story raid 1: walk three rooms, capture wall + door behavior', async ({ page }) => {
  test.setTimeout(120_000);
  const obs: Observations = { loop: 'L1-gambler-story', consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };
  observations.push(obs);
  await setupPage(page);
  attachLog(page, obs);
  await jumpToDungeon(page, 0, 'story', 'normal');
  await shot(page, obs, '01-spawn');
  obs.notes.push(`Spawn HUD: ${JSON.stringify(await readHud(page))}`);

  // Walk east into room 1 to trigger wave.
  await walk(page, 'd', 2500);
  await page.waitForTimeout(500);
  await shot(page, obs, '02-room1-entered');

  // Stand and let auto-fire clear the wave (or take damage).
  await page.waitForTimeout(8000);
  await shot(page, obs, '03-room1-mid');
  obs.notes.push(`After room1 fight HUD: ${JSON.stringify(await readHud(page))}`);

  // Check for bargain modal after room clear
  await page.waitForTimeout(4000);
  const bargainOpen = await page.locator('.bargain-modal').count();
  obs.notes.push(`Bargain modal visible after room1 clear: ${bargainOpen > 0}`);
  if (bargainOpen > 0) {
    await shot(page, obs, '04-bargain-modal');
    // Click first option
    await page.locator('.bargain-option').nth(0).click();
    obs.notes.push('Took first bargain option');
    await page.waitForTimeout(500);
  }

  // Walk into room 2
  await walk(page, 'd', 3500);
  await shot(page, obs, '05-room2-entered');
  await page.waitForTimeout(8000);
  obs.notes.push(`After room2 HUD: ${JSON.stringify(await readHud(page))}`);

  // Walk into room 3
  await walk(page, 'd', 3500);
  await shot(page, obs, '06-room3-entered');
  await page.waitForTimeout(10000);
  await shot(page, obs, '07-room3-after');
  obs.notes.push(`Final HUD: ${JSON.stringify(await readHud(page))}`);
});

test('Loop 2 — Brute story raid 2: trigger mini-boss zone, observe cleave telegraph', async ({ page }) => {
  test.setTimeout(120_000);
  const obs: Observations = { loop: 'L2-brute-miniboss', consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };
  observations.push(obs);
  await setupPage(page);
  attachLog(page, obs);
  // Brute is now at idx 2 in the BUILDS array (gambler, duelist, brute, ...).
  await jumpToDungeon(page, 2, 'story', 'normal', 2);
  await shot(page, obs, '01-spawn-raid2');

  // Walk east through rooms aggressively to reach mini-boss zone (which is
  // second-to-last in raid 2; raid 2 has 4 rooms).
  for (let i = 0; i < 5; i++) {
    await walk(page, 'd', 3000);
    await page.waitForTimeout(4000);
    await shot(page, obs, `02-walk-${i}`);
    // Dismiss any bargain modal that opens
    const open = await page.locator('.bargain-modal').count();
    if (open > 0) {
      await page.locator('.bargain-option').nth(0).click();
      obs.notes.push(`Bargain at step ${i}, took first option`);
      await page.waitForTimeout(500);
    }
    // Check mini-boss intro
    const miniIntro = await page.locator('.dungeon-intro--miniboss').count();
    if (miniIntro > 0) {
      obs.notes.push(`Mini-boss intro fired at step ${i}`);
      await shot(page, obs, `03-miniboss-intro-${i}`);
    }
  }
  await shot(page, obs, '99-final');
  obs.notes.push(`Final HUD: ${JSON.stringify(await readHud(page))}`);
});

test('Loop 3 — Slot mode: spin 8 times consecutively, watch for black + alignment', async ({ page }) => {
  test.setTimeout(120_000);
  const obs: Observations = { loop: 'L3-slot-mode', consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };
  observations.push(obs);
  await setupPage(page);
  attachLog(page, obs);
  // Set slot mode in settings store
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.evaluate(() => {
    (window as any).__DG.settingsStore.setState({ wheelMode: 'slot' });
  });
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').nth(0).click();
  await page.waitForSelector('.wheels-canvas-wrap canvas');
  await page.waitForTimeout(800);
  await shot(page, obs, '01-slot-initial');

  // Drive 8 buff/curse spins via direct store calls
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const wheels = (window as any).__DG?.wheelsRef;
      if (wheels) {
        if (!wheels.isSpun('buff')) wheels.startSpin('buff');
      }
    });
    await page.waitForTimeout(4500);
    await shot(page, obs, `02-buff-spin-${i}`);
    // Reset spun flag by reloading the wheel scene? Actually startSpin guards
    // against repeated spins. Skip directly using the engine state.
    // For exploration, just observe single spin per scene visit.
    break;
  }

  // Try the curse spin
  await page.evaluate(() => {
    const wheels = (window as any).__DG?.wheelsRef;
    if (wheels && !wheels.isSpun('curse')) wheels.startSpin('curse');
  });
  await page.waitForTimeout(4500);
  await shot(page, obs, '03-curse-spin');

  // Reload page and spin again 4 more times to test "after a few spins"
  for (let session = 0; session < 4; session++) {
    await page.evaluate(() => {
      (window as any).__DG.settingsStore.setState({ wheelMode: 'slot' });
      (window as any).__DG.gameStore.getState().showScene('wheels');
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const wheels = (window as any).__DG?.wheelsRef;
      if (wheels) {
        if (!wheels.isSpun('buff')) wheels.startSpin('buff');
      }
    });
    await page.waitForTimeout(4500);
    await shot(page, obs, `04-session-${session}-buff`);
    await page.evaluate(() => {
      const wheels = (window as any).__DG?.wheelsRef;
      if (wheels && !wheels.isSpun('curse')) wheels.startSpin('curse');
    });
    await page.waitForTimeout(4500);
    await shot(page, obs, `04-session-${session}-curse`);
  }
});

test('Loop 4 — Witch story raid 3: lich mini-boss summon behavior', async ({ page }) => {
  test.setTimeout(120_000);
  const obs: Observations = { loop: 'L4-witch-lich', consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };
  observations.push(obs);
  await setupPage(page);
  attachLog(page, obs);
  // Witch is at idx 6 in BUILDS array (gambler, duelist, brute, arcanist, rogue, huntsman, witch, soldier).
  await jumpToDungeon(page, 6, 'story', 'normal', 3);
  await shot(page, obs, '01-spawn-raid3');

  for (let i = 0; i < 6; i++) {
    await walk(page, 'd', 3000);
    await page.waitForTimeout(5000);
    await shot(page, obs, `02-walk-${i}`);
    const open = await page.locator('.bargain-modal').count();
    if (open > 0) {
      await page.locator('.bargain-option').nth(0).click();
      obs.notes.push(`Bargain at step ${i}`);
      await page.waitForTimeout(500);
    }
    const miniIntro = await page.locator('.dungeon-intro--miniboss').count();
    if (miniIntro > 0) {
      obs.notes.push(`Mini-boss intro fired at step ${i}`);
      await shot(page, obs, `03-miniboss-intro-${i}`);
    }
  }
  await shot(page, obs, '99-final');
  obs.notes.push(`Final HUD: ${JSON.stringify(await readHud(page))}`);
});

test('Loop 5 — Boss raid (Death itself): check intro + AOE + souls reward', async ({ page }) => {
  test.setTimeout(120_000);
  const obs: Observations = { loop: 'L5-boss-fight', consoleErrors: [], pageErrors: [], screenshots: [], notes: [] };
  observations.push(obs);
  await setupPage(page);
  attachLog(page, obs);
  // Force into a boss raid (raid === totalRaids)
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.build-card').nth(0).click();
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const noop = (s: any) => s;
    // Story raid count = 3, so set raid to 3 (boss raid).
    dg.gameStore.getState().setRaid(3);
    dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
    dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
  await shot(page, obs, '01-boss-intro');
  await page.waitForTimeout(4500);
  await shot(page, obs, '02-boss-fight');
  obs.notes.push(`Boss HUD: ${JSON.stringify(await readHud(page))}`);

  // Just stand still and observe boss behavior.
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    await shot(page, obs, `03-fight-${i}`);
    const hud = await readHud(page);
    obs.notes.push(`t+${(i + 1) * 5}s: ${JSON.stringify(hud)}`);
    // Check for gameover scene
    const goCount = await page.locator('.gameover-scene, .scene-gameover').count();
    if (goCount > 0) {
      obs.notes.push(`Gameover scene appeared at iteration ${i}`);
      await shot(page, obs, '04-gameover');
      break;
    }
  }
});
