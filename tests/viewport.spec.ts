import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SHOT = 'test-screenshots';
fs.mkdirSync(SHOT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-portrait', w: 375, h: 667 },   // iPhone SE
  { name: 'mobile-landscape', w: 667, h: 375 },
  { name: 'tablet', w: 1024, h: 768 },
  { name: 'desktop', w: 1920, h: 1080 },
  { name: 'ultrawide', w: 3440, h: 1440 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_intro_seen', '1');
    localStorage.setItem('dg_dungeon_help_seen', '1');
  });
});

for (const v of VIEWPORTS) {
  test(`Viewport ${v.name} ${v.w}x${v.h} — title + mode + wheels + dungeon`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto('/?debug=1');
    await page.waitForFunction(() => Boolean((window as any).__DG?.gameStore));
    await page.screenshot({ path: path.join(SHOT, `vp-${v.name}-01-title.png`) });

    await page.evaluate(() => (window as any).__DG.gameStore.getState().showScene('modeselect'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT, `vp-${v.name}-02-mode.png`) });

    await page.evaluate(() => (window as any).__DG.gameStore.getState().showScene('shop'));
    await page.evaluate(() => {
      const dg = (window as any).__DG;
      const gs = dg.gameStore.getState();
      dg.gameStore.setState({ run: { ...gs.run, mode: 'story', cash: 999 } });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT, `vp-${v.name}-03-shop.png`), fullPage: true });

    await page.evaluate(() => (window as any).__DG.gameStore.getState().showScene('credits'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT, `vp-${v.name}-04-credits.png`), fullPage: true });
  });
}
