import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
  await expect(page.locator('#players')).toHaveValue('1');
  await page.locator('#players').selectOption('2');
  await expect(page.locator('#phaser canvas')).toBeVisible();
  await page.clock.install();
  await page.locator('#demo').click();
  await expect(page.locator('#countdown')).toHaveText('3');
  await page.clock.runFor(4100);
  await expect(page.locator('#countdown')).toBeHidden();
  const b = await page.locator('#phaser canvas').boundingBox();
  for (const player of [0, 1]) {
    const other = await page.locator(`#score-${1 - player}`).textContent();
    for (let pass = 0; pass < 35 && Number(await page.locator(`#score-${player}`).textContent()) === 0; pass++) {
      const y = b.y + b.height * (.35 + (pass % 3) * .18);
      for (let step = 0; step <= 12; step++) {
        await page.mouse.move(b.x + b.width * (player * .5 + .06 + step * .032), y);
        await page.clock.runFor(24);
      }
    }
    expect(Number(await page.locator(`#score-${player}`).textContent())).toBeGreaterThan(0);
    await expect(page.locator(`#score-${1 - player}`)).toHaveText(other);
  }
  await page.screenshot({ path: 'test-results/round-playing.png', fullPage: true });
  await page.clock.fastForward(64000);
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#round-clock')).toHaveText('0s');
  const scores = await page.locator('#result-scores').textContent();
  await page.mouse.move(b.x + 20, b.y + 100); await page.mouse.move(b.x + b.width - 20, b.y + 100);
  await page.clock.runFor(300);
  await expect(page.locator('#result-scores')).toHaveText(scores);
  await page.screenshot({ path: 'test-results/round-finished.png', fullPage: true });
  await page.locator('#replay').click();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#score-0')).toHaveText('0');
  await expect(page.locator('#score-1')).toHaveText('0');
  await expect(page.locator('#round-clock')).toHaveText('60s');
  await page.locator('#stop').click();
  await page.locator('#players').selectOption('1');
  await page.locator('#demo').click();
  await expect(page.locator('.score-right')).toBeHidden();
  await page.clock.fastForward(64000);
  await expect(page.locator('#result-title')).toHaveText('挑战完成！');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(300);
  await page.locator('#results').screenshot({ path: 'test-results/round-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('Round browser checks passed: countdown, both scoring lanes, finish lock, replay, single player, mobile results.');
} finally { await browser.close(); }
