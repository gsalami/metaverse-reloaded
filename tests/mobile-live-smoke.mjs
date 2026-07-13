import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const base = process.env.MR_URL || 'https://metaverse-reloaded.host.kuble.com/';
const room = `Test Mobile ${Date.now()}`;
const output = new URL('../output/mobile-live.png', import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', 'Mobile Live');
  await page.fill('#room-name', room);
  await page.click('.enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true && window.__mrDiag.people === 1, null, { timeout: 45_000 });
  await page.waitForSelector('#invite-dialog[open]');
  await page.locator('#invite-dialog .close-dialog').click();

  assert.equal(await page.locator('#mobile-move').isVisible(), true);
  assert.equal(await page.locator('#chat-button').isVisible(), true);
  assert.equal(await page.locator('#mic-button').isEnabled(), true);
  const screenShareSupported = await page.evaluate(() => Boolean(navigator.mediaDevices?.getDisplayMedia));
  assert.equal(await page.locator('#share-button').isDisabled(), !screenShareSupported);

  const before = await page.evaluate(() => window.__mrDiag.localPosition);
  const forward = page.locator('[data-key="KeyW"]');
  await forward.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(600);
  await forward.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  const after = await page.evaluate(() => window.__mrDiag.localPosition);
  assert.ok(before && after && (Math.abs(after[0] - before[0]) > 0.05 || Math.abs(after[2] - before[2]) > 0.05));

  const jump = page.locator('[data-action="jump"]');
  await jump.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
  await jump.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
  await page.waitForTimeout(120);
  await jump.dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch' });
  await jump.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch' });
  await page.waitForFunction(() => window.__mrDiag.jumpCount === 2 && Math.abs(window.__mrDiag.flipRotation) > .2);

  await page.click('#emote-button');
  await page.click('[data-emote="hearts"]');
  await page.waitForFunction(() => window.__mrDiag.activeEmote === 'hearts' && window.__mrDiag.emojiEffects >= 1);

  await page.click('#chat-button');
  await page.fill('#chat-input', 'Hallo aus dem mobilen Live-Test');
  await page.click('.send-button');
  await page.waitForSelector('.message-text:text-is("Hallo aus dem mobilen Live-Test")', { timeout: 15_000 });
  await page.screenshot({ path: fileURLToPath(output), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('mobile-live-smoke: ok', JSON.stringify({ room, joined: true, touchMovement: true, doubleJump: true, flip: true, emotes: true, chat: true }));
  await context.close();
} finally {
  await browser.close();
}
