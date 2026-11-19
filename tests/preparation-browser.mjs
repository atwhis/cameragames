import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] });
try {
  const page = await browser.newPage({ permissions: ['camera'], viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Stub only inference output; exercise the real camera lifecycle, mapping, slots, scene and UI.
  await page.route(/\/src\/vision\.ts(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: `
    export class Vision {
      settings = {}; async load() {}
      start(video, onFrame) { this.timer = setInterval(() => !this.paused && onFrame({poses: window.testPoses || [], time: performance.now(), ms: 10, width: 1280, height: 720}), 50); }
      pause() { this.paused = true; window.pauseCount = (window.pauseCount || 0) + 1; } resume() { this.paused = false; window.resumeCount = (window.resumeCount || 0) + 1; }
      async stop() { clearInterval(this.timer); }
    }` }));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
  await page.clock.install();
  await expect(page.locator('#players')).toHaveValue('1');
  await page.locator('#players').selectOption('2');
  const poses = async (raised, ids = [1, 2]) => page.evaluate(({raised, ids}) => {
    window.testPoses = ids.map((id, player) => {
      if (!id) return null;
      const center = player === 0 ? 960 : 320;
      const keypoints = Array.from({length:17}, (_, i) => ({x:center + (i % 2 ? -50 : 50), y:i < 7 ? 200 : i < 9 ? 310 : i < 11 ? raised[player] ? 350 : 550 : 500, score:i >= 5 && i <= 12 ? .95 : 0}));
      return {id,score:.95,keypoints};
    }).filter(Boolean);
  }, { raised, ids });
  await poses([false, false]);
  await page.locator('#start').click();
  await expect(page.locator('#preparation')).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(page.locator('#countdown')).toBeHidden();
  await expect(page.locator('#prepare-0')).not.toHaveClass(/confirmed/);
  await poses([true, false]);
  await expect(page.locator('#prepare-0')).toHaveClass(/confirmed/, {timeout:5000});
  await expect(page.locator('#countdown')).toBeHidden();
  await poses([false, false]);
  await page.waitForTimeout(400);
  await expect(page.locator('#prepare-0')).toHaveClass(/confirmed/);
  await page.screenshot({path:'test-results/preparation-waiting.png', fullPage:true});
  await poses([false, true]);
  await expect(page.locator('#countdown')).toBeVisible({timeout:5000});
  await poses([false, false], [1, null]);
  await expect(page.locator('#preparation')).toBeVisible({timeout:2500});
  await expect(page.locator('#countdown')).toBeHidden();
  await expect(page.locator('#prepare-0')).toHaveClass(/confirmed/);
  await poses([false, false], [1, 22]);
  await page.waitForTimeout(1500);
  await expect(page.locator('#prepare-1')).not.toHaveClass(/confirmed/);
  await poses([false, true], [1, 22]);
  await expect(page.locator('#countdown')).toBeVisible({timeout:5000});
  await expect(page.locator('#countdown')).toBeHidden({timeout:5000});
  await expect(page.locator('#preparation')).toBeHidden();
  await expect.poll(async () => Number((await page.locator('#round-clock').textContent()).replace('s',''))).toBeLessThan(60);
  await page.clock.fastForward(64000);
  await expect(page.locator('#results')).toBeVisible();
  expect(await page.evaluate(() => window.pauseCount)).toBe(1);
  await page.clock.runFor(1500);
  await expect(page.locator('#inference-fps')).toHaveText('0');
  expect(await page.evaluate(() => document.querySelector('#camera').srcObject.getVideoTracks()[0].readyState)).toBe('live');
  await page.locator('#replay').click();
  expect(await page.evaluate(() => window.resumeCount)).toBe(1);
  await expect.poll(async()=>Number(await page.locator('#inference-fps').textContent())).toBeGreaterThan(0);
  await page.locator('#reset').click();
  await poses([false, false], [1, 22]);
  await expect(page.locator('#preparation')).toBeVisible();
  await expect(page.locator('#prepare-0')).not.toHaveClass(/confirmed/);
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  await page.locator('#stage').screenshot({path:'test-results/preparation-mobile.png'});
  await page.locator('#stop').click();
  await page.locator('#players').selectOption('1');
  await poses([true], [1]);
  await page.locator('#start').click();
  await expect(page.locator('#prepare-1')).toBeHidden();
  await expect(page.locator('#countdown')).toBeVisible({timeout:5000});
  await page.locator('#stop').click();
  expect(errors).toEqual([]);
  console.log('Preparation browser checks passed: hands-down gate, independent confirmation, loss cancellation, replacement, actual game start, reset, mobile, single player. Synthetic poses only.');
} finally { await browser.close(); }
