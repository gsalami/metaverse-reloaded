import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { installSupabaseMock } from './supabase-mock.mjs';

const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const output = new URL('../output/', import.meta.url);
const tables = { presence: [], messages: [{ _id: 1, event_id: 'main-stage', client_id: 'system', name: 'Metaverse', text: 'Willkommen im Test.', mentions: [], created_at: new Date().toISOString() }], signals: [], rooms: [], room_templates: [], portals: [], avatars: [] };
let nextId = 10;

async function mockDb(route) {
  const request = route.request();
  const url = new URL(request.url());
  const table = url.pathname.split('/').pop();
  if (!tables[table]) return route.continue();
  if (request.method() === 'POST') {
    const row = { _id: nextId++, _created_at: new Date().toISOString(), ...request.postDataJSON() };
    tables[table].push(row);
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ row }) });
  }
  const rows = tables[table].filter(row => {
    for (const [key, value] of url.searchParams) {
      if (key === 'limit') continue;
      if (String(row[key]) !== value) return false;
    }
    return true;
  }).slice(-Number(url.searchParams.get('limit') || 100));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

async function exercise(browser, options) {
  const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: options.deviceScaleFactor || 1, isMobile: options.mobile, hasTouch: options.mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/_db/**', mockDb);
  await installSupabaseMock(page, tables);
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#join-dialog[open]');
  await page.screenshot({ path: fileURLToPath(new URL(`join-${options.name}.png`, output)), fullPage: true });
  await page.fill('#display-name', options.name === 'mobile' ? 'Mobile Test' : 'Desktop Host');
  await page.fill('#room-name', `Test ${options.name} Space`);
  const avatarChoice = options.mobile
    ? { primaryColor: '#19b88a', hairStyle: 'bob', hairColor: '#d36b27', outfitStyle: 'explorer' }
    : { primaryColor: '#d246a6', hairStyle: 'none', hairColor: '#1a9ee8', outfitStyle: 'cyber' };
  await page.locator('#avatar-primary-color').fill(avatarChoice.primaryColor);
  await page.locator('#avatar-hair-color').fill(avatarChoice.hairColor);
  await page.locator(`label:has([name="hair-style"][value="${avatarChoice.hairStyle}"])`).click();
  await page.locator(`label:has([name="outfit-style"][value="${avatarChoice.outfitStyle}"])`).click();
  assert.equal(await page.locator('#avatar-preview').getAttribute('data-hair'), avatarChoice.hairStyle);
  assert.equal(await page.locator('#avatar-preview').getAttribute('data-outfit'), avatarChoice.outfitStyle);
  await page.click('.enter-button');
  await page.waitForFunction(() => !document.querySelector('#join-dialog').open);
  await page.waitForSelector('#invite-dialog[open]');
  assert.match(await page.locator('#guest-invite-code').innerText(), /^GUEST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.match(await page.locator('#cohost-invite-code').innerText(), /^COHOST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(await page.evaluate(() => window.__mrDiag.role), 'host');
  assert.equal(await page.evaluate(() => window.__mrDiag.roomOwner), true);
  assert.deepEqual(await page.evaluate(() => window.__mrDiag.avatarProfile), avatarChoice);
  assert.deepEqual(await page.evaluate(() => window.__mrDiag.avatarStates.find(avatar => avatar.local)?.profile), avatarChoice);
  await page.waitForFunction(() => window.__mrDiag.avatarStates.find(avatar => avatar.local)?.riggedAppearance === true);
  const avatarState = await page.evaluate(() => window.__mrDiag.avatarStates.find(avatar => avatar.local));
  assert.ok(avatarState.accessories.length >= 18, JSON.stringify(avatarState));
  assert.equal(avatarState.sourceAvatarMeshes.total, 6);
  assert.equal(avatarState.sourceAvatarMeshes.visible, 0);
  assert.ok(avatarState.accessories.some(name => name.startsWith('Base')));
  assert.equal(avatarState.accessories.some(name => name.startsWith('Hair')), avatarChoice.hairStyle !== 'none');
  assert.ok(avatarState.accessories.some(name => name.startsWith('Outfit')));
  assert.deepEqual(JSON.parse(await page.evaluate(() => window.localStorage.getItem('mr-avatar-profile'))), avatarChoice);
  await page.locator('#invite-dialog .close-dialog').click();
  await page.waitForSelector('#capacity-count:text-is("1 / 25")');
  await page.waitForTimeout(2_000);
  assert.equal(await page.locator('#mobile-move').isVisible(), Boolean(options.mobile));
  assert.equal(await page.locator('#chat-button').isVisible(), true);
  assert.equal(await page.locator('#host-room-controls').isVisible(), true);
  assert.equal(await page.locator('#mic-button').isEnabled(), true);
  await page.click('#chat-button');
  await page.fill('#chat-input', 'Hallo aus dem Browser-Smoke-Test');
  await page.click('.send-button');
  await page.waitForSelector('.message-text:text-is("Hallo aus dem Browser-Smoke-Test")');
  if (options.mobile) {
    const before = await page.locator('#world').boundingBox();
    assert.ok(before && before.width <= 430);
    await page.locator('[data-key="KeyW"]').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(250);
    await page.locator('[data-key="KeyW"]').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    const jump = page.locator('[data-action="jump"]');
    await jump.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
    await jump.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
    await page.waitForFunction(() => window.__mrDiag.jumpCount === 1 && window.__mrDiag.airborne);
    await jump.dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch' });
    await jump.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch' });
    await page.waitForFunction(() => window.__mrDiag.jumpCount === 2 && Math.abs(window.__mrDiag.flipRotation) > .2);
    await page.click('#emote-button');
    assert.equal(await page.locator('#emote-tray').isVisible(), true);
    await page.screenshot({ path: fileURLToPath(new URL('emotes-mobile.png', output)), fullPage: true });
    await page.click('[data-emote="hearts"]');
    await page.waitForFunction(() => window.__mrDiag.activeEmote === 'hearts' && window.__mrDiag.emojiEffects >= 1);
  }
  await page.screenshot({ path: fileURLToPath(new URL(`room-${options.name}.png`, output)), fullPage: true });
  const publicRoom = await page.evaluate(() => ({ eventId: window.__mrDiag.eventId, title: window.__mrDiag.roomTitle }));
  await page.goto(`${base}?room=${encodeURIComponent(publicRoom.eventId)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(title => document.querySelector('#public-room-title')?.textContent === title, publicRoom.title);
  assert.equal(await page.locator('#public-room-panel').isVisible(), true);
  assert.equal(await page.locator('.entry-tabs').isVisible(), false);
  assert.equal(await page.locator('#join-form .enter-button span').textContent(), 'Eigenen Space als Host betreten');
  await page.click('#join-form .enter-button');
  await page.waitForFunction(eventId => window.__mrDiag?.joined === true && window.__mrDiag.eventId === eventId, publicRoom.eventId);
  assert.equal(await page.evaluate(() => window.__mrDiag.role), 'host');
  assert.equal(await page.evaluate(() => window.__mrDiag.roomOwner), true);
  const recent = await page.evaluate(() => JSON.parse(localStorage.getItem('metaverse-reloaded:last-spaces') || '[]'));
  assert.equal(recent[0]?.roomId, publicRoom.eventId);
  assert.deepEqual(errors, []);
  await context.close();
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  await exercise(browser, { name: 'desktop', viewport: { width: 1440, height: 900 } });
  await exercise(browser, { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, mobile: true });
  console.log('browser-smoke: ok');
} finally {
  await browser.close();
}
