import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const external = [];
  page.on('request', request => { if (request.url().startsWith('http') && new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
      if (source instanceof HTMLVideoElement) window.lastVideoSnapshot = {width:this.canvas.width,height:this.canvas.height};
      return draw.call(this, source, ...args);
    };
  });
  await page.route(/\/src\/vision\.ts(?:\?|$)/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    const method = 'start(video, onFrame, onError) {';
    expect(body).toContain(method);
    await route.fulfill({ response, body: body.replace(method, method + ' window.testVision = this;') });
  });
  await page.goto(base);
  await expect(page.locator('#phaser canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
  await page.locator('#demo').click();
  await expect(page.locator('#mode-label')).toHaveText('鼠标试切中');
  const bounds = await page.locator('#phaser canvas').boundingBox();
  let sliced = false;
  for (let pass = 0; pass < 55 && !sliced; pass++) {
    const y = bounds.y + bounds.height * (0.4 + (pass % 3) * 0.16);
    await page.mouse.move(bounds.x + bounds.width * 0.08, y);
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(bounds.x + bounds.width * (0.08 + step * 0.07), y);
      await page.waitForTimeout(18);
      if (await page.locator('#slice-flash').evaluate(el => el.classList.contains('visible'))) { sliced = true; break; }
    }
  }
  expect(sliced, 'mouse trajectory must slice an actual Phaser fruit').toBe(true);
  await page.screenshot({ path: 'test-results/slice.png', fullPage: true });
  await page.locator('#reset').click();
  await page.locator('#stop').click();
  await expect(page.locator('#welcome')).toBeVisible();
  await page.locator('#start').click();
  await expect(page.locator('#mode-label')).toHaveText('摄像头体验中', { timeout: 90000 });
  await expect.poll(async () => Number(await page.locator('#inference-fps').textContent()), { timeout: 60000 }).toBeGreaterThan(0);
  await expect(page.locator('#backend')).toHaveText('WebGL · GPU');
  await expect.poll(async () => Number.parseFloat(await page.locator('#latency').textContent()), { timeout: 15000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.lastVideoSnapshot)).toEqual({width:256,height:144});
  const metrics = await page.locator('.metrics-panel').innerText();
  await page.screenshot({ path: 'test-results/camera.png', fullPage: true });
  await page.evaluate(() => window.testVision.pause());
  await expect(page.locator('#inference-fps')).toHaveText('0', {timeout:5000});
  expect(await page.evaluate(() => document.querySelector('#camera').srcObject.getVideoTracks()[0].readyState)).toBe('live');
  await page.evaluate(() => window.testVision.resume());
  await expect.poll(async () => Number(await page.locator('#inference-fps').textContent()), {timeout:30000}).toBeGreaterThan(0);
  await page.evaluate(() => { window.testTracks = document.querySelector('#camera').srcObject.getTracks(); });
  await page.locator('#stop').click();
  expect(await page.evaluate(() => window.testTracks.every(track => track.readyState === 'ended'))).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#camera').srcObject)).toBeNull();
  await page.locator('#start').click();
  await expect(page.locator('#mode-label')).toHaveText('摄像头体验中', { timeout: 60000 });
  await expect.poll(async () => Number(await page.locator('#inference-fps').textContent()), { timeout: 30000 }).toBeGreaterThan(0);
  await page.locator('#stop').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('#phaser canvas')).toBeVisible();
  await page.locator('aside').scrollIntoViewIfNeeded();
  await page.locator('aside').screenshot({ path: 'test-results/mobile-controls.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external, 'runtime must not request third-party model or video services').toEqual([]);
  await context.close();
  const denied = await browser.newContext();
  const denial = await denied.newPage();
  denial.on('pageerror', error => errors.push(error.message));
  await denial.goto(base);
  await denial.locator('#start').click();
  await expect(denial.locator('#status')).toContainText('未获得摄像头权限', { timeout: 15000 });
  await expect(denial.locator('#start')).toBeEnabled();
  await denied.close();
  expect(errors).toEqual([]);
  await writeFile('test-results/browser-report.txt', `PASS: mouse slice, model inference with synthetic camera, restart, camera release, permission denial, mobile layout, no third-party requests.\nSynthetic input only; not a real-person accuracy/performance benchmark.\n${metrics}\n`);
  console.log('Browser checks passed. Screenshots and report: test-results/');
} finally { await browser.close(); }
