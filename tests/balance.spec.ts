import { test, type Page } from '@playwright/test';
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

interface Reading {
  t: number;        // wall-clock seconds elapsed since combat start
  hudTime: string;  // HUD's TIME field
  kills: number;
  hp: string;       // "X / Y"
  hpPct: number;    // 0-1
}

async function readHud(page: Page): Promise<{ kills: number; hp: string; hpPct: number; hudTime: string }> {
  return await page.evaluate(() => {
    const pairs = Array.from(document.querySelectorAll('.dungeon-info .info-pair'));
    const get = (label: string) => {
      const p = pairs.find((el) => el.querySelector('.info-l')?.textContent?.trim().toUpperCase() === label);
      return p?.querySelector('.info-v')?.textContent?.trim() ?? '';
    };
    const hpRow = Array.from(document.querySelectorAll('.dungeon-hud .hud-row')).find(
      (r) => r.textContent?.includes('HP'),
    );
    // Direct children only — the first span has nested icon, the second is the value.
    const hpValueSpan = hpRow ? hpRow.children[hpRow.children.length - 1] : null;
    const hpText = hpValueSpan?.textContent?.trim() ?? '0 / 0';
    const m = hpText.match(/(\d+)\s*\/\s*(\d+)/);
    const hpPct = m ? Number(m[1]) / Number(m[2]) : 0;
    return {
      kills: Number(get('KILLS')) || 0,
      hudTime: get('TIME'),
      hp: hpText,
      hpPct,
    };
  });
}

async function jumpToDungeon(page: Page, buildIdx: number, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
  if (difficulty !== 'normal') {
    await page.evaluate((d) => {
      (window as any).__DG.settingsStore.setState({ difficulty: d });
    }, difficulty);
  }
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.mode-card').nth(0).click();        // Story
  await page.locator('.build-card').nth(buildIdx).click(); // first build (Gambler)
  // Skip both wheel spins by injecting trivial segments via the store action.
  await page.evaluate(() => {
    const dg = (window as any).__DG;
    const noop = (s: any) => s;
    dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
    dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
    dg.gameStore.getState().showScene('dungeon');
  });
  await page.waitForSelector('.dungeon-canvas-wrap canvas');
  // Wait for preload to clear and intro card to fade.
  await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(2700);
}

/** Sample HUD every `intervalMs` for `durationMs`. Stops early if player dies. */
async function sampleCombat(page: Page, durationMs: number, intervalMs = 5000): Promise<Reading[]> {
  const start = Date.now();
  const readings: Reading[] = [];
  while (Date.now() - start < durationMs) {
    const elapsed = (Date.now() - start) / 1000;
    const r = await readHud(page);
    readings.push({ t: Math.round(elapsed), ...r });
    if (r.hpPct <= 0.0) break; // dead
    await page.waitForTimeout(intervalMs);
  }
  return readings;
}

const BUILDS = [
  { name: 'Gambler (Pistol)',  idx: 0 },
  { name: 'Brute (Club)',      idx: 2 },
  { name: 'Soldier (Rifle)',   idx: 7 },
];

for (const b of BUILDS) {
  test(`Combat baseline — ${b.name} standing still 25s`, async ({ page }) => {
    test.setTimeout(60_000);
    await jumpToDungeon(page, b.idx);
    const readings = await sampleCombat(page, 25_000, 5_000);
    console.log(`\n=== ${b.name} — STAND STILL ===`);
    for (const r of readings) {
      console.log(`  t=${r.t}s  kills=${r.kills}  hp=${r.hp}  hpPct=${(r.hpPct * 100).toFixed(0)}%`);
    }
    const final = readings[readings.length - 1];
    console.log(`  RESULT: ${final.hpPct <= 0 ? 'DIED' : 'survived'} | kills=${final.kills} hp=${(final.hpPct * 100).toFixed(0)}%`);
    await page.screenshot({ path: path.join(SHOT, `bal-${b.idx}-${b.name.replace(/\s+/g, '_')}-still.png`) });
  });
}

// Hard-difficulty viability — runs each build for 25s standing still on hard
// (1.4×hp 1.4×spawn 1.3×dmg 1.15×spd) and reports survival.
for (const b of BUILDS) {
  test(`HARD difficulty — ${b.name} 25s standing still`, async ({ page }) => {
    test.setTimeout(60_000);
    await jumpToDungeon(page, b.idx, 'hard');
    const readings = await sampleCombat(page, 25_000, 5_000);
    console.log(`\n=== HARD: ${b.name} ===`);
    for (const r of readings) {
      console.log(`  t=${r.t}s  kills=${r.kills}  hp=${r.hp}  hpPct=${(r.hpPct * 100).toFixed(0)}%`);
    }
    const final = readings[readings.length - 1];
    console.log(`  RESULT: ${final.hpPct <= 0 ? 'DIED' : 'survived'} | kills=${final.kills} hp=${(final.hpPct * 100).toFixed(0)}%`);
  });
}

// Cash-per-round economy: kite a full 60s round and read the final $ value.
// Compares to shop costs (Vigor $50, Strength $50, ATKSPD $80, etc.) to
// verify the run economy is meaningful but not trivial.
for (const b of BUILDS) {
  test(`ECONOMY — ${b.name} cash earned per 60s round (kiting)`, async ({ page }) => {
    test.setTimeout(120_000);
    await jumpToDungeon(page, b.idx);
    const start = Date.now();
    const dirs: Array<'d' | 's' | 'a' | 'w'> = ['d', 's', 'a', 'w'];
    let pressed: string | null = null;
    let lastSample = 0;
    let lastReading: { kills: number; cash: number; hpPct: number } | null = null;
    for (let i = 0; Date.now() - start < 60_000; i++) {
      const dir = dirs[i % 4];
      if (pressed) await page.keyboard.up(pressed);
      await page.keyboard.down(dir);
      pressed = dir;
      const segStart = Date.now();
      while (Date.now() - segStart < 2_000 && Date.now() - start < 60_000) {
        await page.waitForTimeout(250);
        const elapsed = Date.now() - start;
        if (elapsed - lastSample >= 10_000) {
          lastSample = elapsed;
          const sample = await page.evaluate(() => {
            const pairs = Array.from(document.querySelectorAll('.dungeon-info .info-pair'));
            const get = (label: string) => {
              const p = pairs.find((el) => el.querySelector('.info-l')?.textContent?.trim() === label);
              return p?.querySelector('.info-v')?.textContent?.trim() ?? '';
            };
            const hpRow = Array.from(document.querySelectorAll('.dungeon-hud .hud-row')).find(
              (r) => r.textContent?.includes('HP'),
            );
            const hpV = hpRow ? hpRow.children[hpRow.children.length - 1].textContent?.trim() : '0/0';
            const m = hpV?.match(/(\d+)\s*\/\s*(\d+)/);
            const hpPct = m ? Number(m[1]) / Number(m[2]) : 0;
            return {
              kills: Number(get('KILLS')) || 0,
              cash: Number(get('$')) || 0,
              hpPct,
            };
          });
          lastReading = sample;
          const t = Math.round(elapsed / 1000);
          console.log(`  t=${t}s  kills=${sample.kills}  $=${sample.cash}  hp=${(sample.hpPct * 100).toFixed(0)}%`);
          if (sample.hpPct <= 0) break;
        }
      }
      if (lastReading && lastReading.hpPct <= 0) break;
    }
    if (pressed) await page.keyboard.up(pressed);
    console.log(`\n=== ECONOMY: ${b.name} ===`);
    if (lastReading) {
      console.log(`  Final: kills=${lastReading.kills}  $=${lastReading.cash}`);
      console.log(`  Avg cash/kill: ${(lastReading.cash / Math.max(1, lastReading.kills)).toFixed(2)}`);
      console.log(`  Shop affordability: Vigor($50)=${(lastReading.cash / 50).toFixed(1)}x, Atkspd($80)=${(lastReading.cash / 80).toFixed(1)}x, Greed($120)=${(lastReading.cash / 120).toFixed(1)}x`);
    }
  });
}

// Hard kiting test — squishy builds need movement to survive Hard.
// If they DIE despite kiting, Hard is genuinely impossible for ranged.
for (const buildIdx of [0, 7] as const) {
  const name = buildIdx === 0 ? 'Gambler' : 'Soldier';
  test(`HARD kiting — ${name} square pattern 35s`, async ({ page }) => {
    test.setTimeout(90_000);
    await jumpToDungeon(page, buildIdx, 'hard');
    const start = Date.now();
    const readings: Reading[] = [];
    const dirs: Array<'d' | 's' | 'a' | 'w'> = ['d', 's', 'a', 'w'];
    let lastSample = 0;
    let pressed: string | null = null;
    for (let i = 0; Date.now() - start < 35_000; i++) {
      const dir = dirs[i % 4];
      if (pressed) await page.keyboard.up(pressed);
      await page.keyboard.down(dir);
      pressed = dir;
      const segStart = Date.now();
      while (Date.now() - segStart < 2_000 && Date.now() - start < 35_000) {
        await page.waitForTimeout(250);
        const elapsed = Date.now() - start;
        if (elapsed - lastSample >= 5_000) {
          lastSample = elapsed;
          const r = await readHud(page);
          readings.push({ t: Math.round(elapsed / 1000), ...r });
          if (r.hpPct <= 0) break;
        }
      }
      if (readings.length && readings[readings.length - 1].hpPct <= 0) break;
    }
    if (pressed) await page.keyboard.up(pressed);
    console.log(`\n=== HARD KITE: ${name} ===`);
    for (const r of readings) {
      console.log(`  t=${r.t}s  kills=${r.kills}  hp=${r.hp}  hpPct=${(r.hpPct * 100).toFixed(0)}%`);
    }
    const final = readings[readings.length - 1];
    console.log(`  RESULT: ${final.hpPct <= 0 ? 'DIED' : 'survived'} | kills=${final.kills} hp=${(final.hpPct * 100).toFixed(0)}%`);
  });
}

// Boss TTK — measure how long each build takes to kill the final boss
// (1200 HP, phase-2 enrage at 50%). Player kites continuously to avoid
// the AOE pulse + shadowbolts. Test ends when boss dies or 60s pass.
for (const b of BUILDS) {
  test(`BOSS TTK — ${b.name} kiting`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.locator('.mode-card').nth(0).click();
    await page.locator('.build-card').nth(b.idx).click();
    // Force boss raid + skip wheels
    await page.evaluate(() => {
      const dg = (window as any).__DG;
      const noop = (s: any) => s;
      dg.gameStore.getState().applyWheelSegment('buff',  { label: 'TEST', color: '#4d8a52', luckScore: 5, apply: noop });
      dg.gameStore.getState().applyWheelSegment('curse', { label: 'TEST', color: '#7a3030', luckScore: 5, apply: noop });
      const total = dg.gameStore.getState().run.totalRaids;
      dg.gameStore.getState().setRaid(total);
      dg.gameStore.getState().showScene('dungeon');
    });
    await page.waitForSelector('.dungeon-canvas-wrap canvas');
    await page.waitForSelector('.dungeon-loading', { state: 'detached', timeout: 30000 });
    await page.waitForTimeout(4500); // boss intro card

    const start = Date.now();
    const dirs: Array<'d' | 's' | 'a' | 'w'> = ['d', 's', 'a', 'w'];
    let pressed: string | null = null;
    let bossDead = false;
    let lastSample = 0;
    let lastBossPct = 1;
    for (let i = 0; Date.now() - start < 60_000 && !bossDead; i++) {
      const dir = dirs[i % 4];
      if (pressed) await page.keyboard.up(pressed);
      await page.keyboard.down(dir);
      pressed = dir;
      const segStart = Date.now();
      while (Date.now() - segStart < 1_500 && Date.now() - start < 60_000) {
        await page.waitForTimeout(250);
        const elapsed = Date.now() - start;
        if (elapsed - lastSample >= 5_000) {
          lastSample = elapsed;
          const sample = await page.evaluate(() => {
            const bossBar = document.querySelector('.dungeon-boss-fill') as HTMLElement | null;
            const bossPct = bossBar ? parseFloat(bossBar.style.width) / 100 : -1;
            const hpRow = Array.from(document.querySelectorAll('.dungeon-hud .hud-row')).find(
              (r) => r.textContent?.includes('HP'),
            );
            const hpV = hpRow ? hpRow.children[hpRow.children.length - 1].textContent?.trim() : '0/0';
            const m = hpV?.match(/(\d+)\s*\/\s*(\d+)/);
            const hpPct = m ? Number(m[1]) / Number(m[2]) : 0;
            return { bossPct, hpV, hpPct };
          });
          const t = Math.round(elapsed / 1000);
          console.log(`  t=${t}s  boss=${(sample.bossPct * 100).toFixed(0)}%  player=${sample.hpV} (${(sample.hpPct * 100).toFixed(0)}%)`);
          lastBossPct = sample.bossPct;
          if (sample.bossPct < 0 || sample.bossPct === 0 || sample.hpPct <= 0) {
            bossDead = sample.bossPct === 0 || sample.bossPct < 0;
            break;
          }
        }
      }
    }
    if (pressed) await page.keyboard.up(pressed);
    const elapsed = (Date.now() - start) / 1000;
    console.log(`\n=== BOSS TTK: ${b.name} ===`);
    console.log(`  RESULT: ${bossDead ? `KILLED in ${elapsed.toFixed(0)}s` : `boss at ${(lastBossPct * 100).toFixed(0)}% after 60s`}`);
  });
}

test('Combat baseline — Gambler kiting (square pattern) 35s', async ({ page }) => {
  test.setTimeout(90_000);
  await jumpToDungeon(page, 0);
  const start = Date.now();
  const readings: Reading[] = [];
  // Hold a direction for 2s, rotate clockwise — traces a square pattern that
  // avoids most contact damage so HP loss isolates ranged hits.
  const dirs: Array<'d' | 's' | 'a' | 'w'> = ['d', 's', 'a', 'w'];
  let lastSample = 0;
  let pressed: string | null = null;
  for (let i = 0; Date.now() - start < 35_000; i++) {
    const dir = dirs[i % 4];
    if (pressed) await page.keyboard.up(pressed);
    await page.keyboard.down(dir);
    pressed = dir;
    // Hold this direction for 2s while sampling occasionally.
    const segStart = Date.now();
    while (Date.now() - segStart < 2_000 && Date.now() - start < 35_000) {
      await page.waitForTimeout(250);
      const elapsed = Date.now() - start;
      if (elapsed - lastSample >= 5_000) {
        lastSample = elapsed;
        const r = await readHud(page);
        readings.push({ t: Math.round(elapsed / 1000), ...r });
        if (r.hpPct <= 0) break;
      }
    }
    if (readings.length && readings[readings.length - 1].hpPct <= 0) break;
  }
  if (pressed) await page.keyboard.up(pressed);
  console.log('\n=== Gambler — KITE (square pattern, isolates ranged hits) ===');
  for (const r of readings) {
    console.log(`  t=${r.t}s  kills=${r.kills}  hp=${r.hp}  hpPct=${(r.hpPct * 100).toFixed(0)}%`);
  }
  const final = readings[readings.length - 1];
  console.log(`  RESULT: ${final.hpPct <= 0 ? 'DIED' : 'survived'} | kills=${final.kills} hp=${(final.hpPct * 100).toFixed(0)}%`);
  await page.screenshot({ path: path.join(SHOT, 'bal-gambler-kite.png') });
});
