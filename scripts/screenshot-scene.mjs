import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.URL ?? 'http://localhost:5174/';
const OUT = process.env.OUT ?? 'screenshots/verify';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

// Preset short timings + skipEnabled so we can flip phases.
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    'pomodoro.settings.v1',
    JSON.stringify({
      workMinutes: 1,
      breakMinutes: 1,
      soundEnabled: false,
      notificationsEnabled: false,
      autoCycle: true,
      skipEnabled: true,
    }),
  );
});

// Install a controllable clock so we can advance progress without real waits.
await page.clock.install({ time: new Date('2026-05-14T10:00:00Z') });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.clock.runFor(500);
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '01-idle.png') });

await page.getByRole('button', { name: 'Start' }).click();
// 25% into a 60s work phase: chicken ~25% across, dirt fills 0..25%.
await page.clock.runFor(15000);
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '02-work-25.png') });

// 70% into the work phase.
await page.clock.runFor(27000);
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '03-work-70.png') });

// Skip to break, then 30% into break.
await page.getByRole('button', { name: 'Settings' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Skip' }).click();
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.clock.runFor(18000);
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '04-break-30.png') });

// 70% into break — chicken has walked back to ~30% across, dirt erased ahead.
await page.clock.runFor(24000);
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '05-break-70.png') });

await browser.close();
console.log(`wrote screenshots under ${OUT}`);
