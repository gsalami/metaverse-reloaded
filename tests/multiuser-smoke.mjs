import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { installSupabaseMock } from './supabase-mock.mjs';

const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const room = `Test Mesh ${Date.now()}`;
const output = new URL('../output/', import.meta.url);
const tables = { presence: [], messages: [], signals: [], rooms: [], room_templates: [], portals: [], avatars: [] };
let nextId = 1;

async function database(route) {
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
      if (key !== 'limit' && String(row[key]) !== value) return false;
    }
    return true;
  }).slice(-Number(url.searchParams.get('limit') || 100));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

async function prepare(context, errors) {
  await context.addInitScript(() => {
    const original = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#173153';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#8cf6ff';
      ctx.font = '40px sans-serif';
      ctx.fillText('TEST SCREEN', 170, 190);
      window.__captureCanvas = canvas;
      return canvas.captureStream(8);
    };
    window.__originalDisplayMedia = original;
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  if (!process.env.MR_LIVE) {
    await page.route('**/_db/**', database);
    await installSupabaseMock(page, tables);
  }
  return page;
}

async function selectAvatar(page, profile) {
  await page.locator('#avatar-primary-color').fill(profile.primaryColor);
  await page.locator('#avatar-hair-color').fill(profile.hairColor);
  await page.locator(`label:has([name="hair-style"][value="${profile.hairStyle}"])`).click();
  await page.locator(`label:has([name="outfit-style"][value="${profile.outfitStyle}"])`).click();
}

async function createRoom(page, name, profile) {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#join-dialog[open]');
  await page.fill('#display-name', name);
  await page.fill('#room-name', room);
  await selectAvatar(page, profile);
  await page.click('.enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
  const codes = await page.evaluate(() => window.__mrDiag.inviteCodes);
  await page.locator('#invite-dialog .close-dialog').click();
  return codes;
}

async function joinWithCode(page, name, code, profile) {
  await page.goto(`${base}?invite=${encodeURIComponent(code)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#join-dialog[open]');
  await page.fill('#display-name', name);
  await selectAvatar(page, profile);
  await page.click('.enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
}

async function pressSpace(page) {
  await page.evaluate(() => document.activeElement?.blur());
  const before = await page.evaluate(() => window.__mrDiag.jumpCount);
  await page.keyboard.press('Space');
  await page.waitForTimeout(40);
  if (await page.evaluate(expected => window.__mrDiag.jumpCount === expected, before)) {
    await page.evaluate(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    });
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});
const errors = [];
try {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
  const visitorContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const cohostContext = await browser.newContext({ viewport: { width: 1180, height: 780 }, permissions: ['microphone'] });
  const host = await prepare(hostContext, errors);
  const visitor = await prepare(visitorContext, errors);
  const cohost = await prepare(cohostContext, errors);

  const hostProfile = { primaryColor: '#d246a6', hairStyle: 'mohawk', hairColor: '#1a9ee8', outfitStyle: 'cyber' };
  const guestProfile = { primaryColor: '#19b88a', hairStyle: 'bob', hairColor: '#d36b27', outfitStyle: 'explorer' };
  const cohostProfile = { primaryColor: '#8c6cff', hairStyle: 'none', hairColor: '#30243b', outfitStyle: 'rogue' };
  const codes = await createRoom(host, 'Event Host', hostProfile);
  await joinWithCode(visitor, 'Mobile Visitor', codes.guest, guestProfile);
  await joinWithCode(cohost, 'Event Cohost', codes.cohost, cohostProfile);
  assert.equal(await host.evaluate(() => window.__mrDiag.role), 'host');
  assert.equal(await visitor.evaluate(() => window.__mrDiag.role), 'guest');
  assert.equal(await cohost.evaluate(() => window.__mrDiag.role), 'cohost');
  assert.equal(await cohost.locator('#host-room-controls').isVisible(), true);
  assert.equal(await cohost.locator('#mic-button').isEnabled(), true);
  await Promise.all([host, visitor, cohost].map(page => page.waitForFunction(() => window.__mrDiag.people === 3 && window.__mrDiag.connectedPeers === 2 && window.__mrDiag.openChannels === 2, null, { timeout: 30_000 })));
  await host.waitForFunction(expected => window.__mrDiag.avatarStates.some(avatar => !avatar.local && JSON.stringify(avatar.profile) === JSON.stringify(expected)), guestProfile);
  assert.ok(await host.evaluate(() => window.__mrDiag.avatarStates.filter(avatar => !avatar.local).every(avatar => avatar.profile && avatar.accessories.length >= 1)));

  await host.click('#mic-button');
  await host.waitForFunction(() => window.__mrDiag.micLive === true);
  await visitor.waitForFunction(() => window.__mrDiag.remoteAudioElements >= 1, null, { timeout: 10_000 });

  await host.click('#share-button');
  await host.waitForFunction(() => window.__mrDiag.screenLive === true);
  await visitor.waitForFunction(() => window.__mrDiag.stageVideoTracks === 1, null, { timeout: 10_000 });
  assert.equal(await visitor.locator('#media-stage').isVisible(), true);

  await host.click('#chat-button');
  await host.fill('#chat-input', 'Willkommen @Mobile Visitor auf der Main Stage!');
  await host.click('.send-button');
  await visitor.waitForSelector('.message.mentioned .message-text', { timeout: 10_000 });
  assert.match(await visitor.locator('.message.mentioned .message-text').innerText(), /@Mobile Visitor/);

  const before = (await visitor.evaluate(() => window.__mrDiag.localPosition))[2];
  await visitor.keyboard.down('KeyW');
  await visitor.waitForTimeout(500);
  await visitor.keyboard.up('KeyW');
  const after = (await visitor.evaluate(() => window.__mrDiag.localPosition))[2];
  assert.ok(after < before - .5, 'W should move the mobile visitor toward the stage');

  const leftStart = await visitor.evaluate(() => ({ position: window.__mrDiag.localPosition, yaw: window.__mrDiag.cameraYaw }));
  await visitor.keyboard.down('KeyA');
  await visitor.waitForTimeout(420);
  await visitor.keyboard.up('KeyA');
  const leftEnd = await visitor.evaluate(() => window.__mrDiag.localPosition);
  const leftDx = leftEnd[0] - leftStart.position[0];
  const leftDz = leftEnd[2] - leftStart.position[2];
  const leftScreenDistance = leftDx * Math.cos(leftStart.yaw) - leftDz * Math.sin(leftStart.yaw);
  assert.ok(leftScreenDistance > .5, 'A should move left relative to the camera');
  const rightStart = await visitor.evaluate(() => ({ position: window.__mrDiag.localPosition, yaw: window.__mrDiag.cameraYaw }));
  await visitor.keyboard.down('KeyD');
  await visitor.waitForTimeout(840);
  await visitor.keyboard.up('KeyD');
  const rightEnd = await visitor.evaluate(() => window.__mrDiag.localPosition);
  const rightDx = rightEnd[0] - rightStart.position[0];
  const rightDz = rightEnd[2] - rightStart.position[2];
  const rightScreenDistance = rightDx * -Math.cos(rightStart.yaw) + rightDz * Math.sin(rightStart.yaw);
  assert.ok(rightScreenDistance > 1, 'D should move right relative to the camera');

  await pressSpace(visitor);
  await visitor.waitForFunction(() => window.__mrDiag.airborne && window.__mrDiag.jumpCount === 1 && window.__mrDiag.localPosition[1] > .15);
  await pressSpace(visitor);
  await visitor.waitForFunction(() => window.__mrDiag.jumpCount === 2 && Math.abs(window.__mrDiag.flipRotation) > .2);
  await host.waitForFunction(() => window.__mrDiag.avatarStates.some(avatar => !avatar.local && avatar.jumpCount === 2 && Math.abs(avatar.flipRotation) > .2));

  await visitor.click('#emote-button');
  await visitor.click('[data-emote="clap"]');
  await visitor.waitForFunction(() => window.__mrDiag.activeEmote === 'clap' && window.__mrDiag.emojiEffects >= 1);
  await host.waitForFunction(() => window.__mrDiag.avatarStates.some(avatar => !avatar.local && avatar.emote === 'clap') && window.__mrDiag.emojiEffects >= 1);
  await visitor.waitForFunction(() => !window.__mrDiag.airborne && window.__mrDiag.jumpCount === 0 && Math.abs(window.__mrDiag.flipRotation) < .001, null, { timeout: 3_000 });

  await cohost.click('#seat-all-button');
  await Promise.all([host, visitor, cohost].map(page => page.waitForFunction(() => {
    const diag = window.__mrDiag;
    const guests = diag.avatarStates.filter(avatar => avatar.role === 'guest');
    const controllers = diag.avatarStates.filter(avatar => avatar.role === 'host' || avatar.role === 'cohost');
    return diag.roomLocked && diag.seatAssignments === 1 && guests.length === 1
      && guests.every(avatar => avatar.seated && avatar.seatLocked)
      && controllers.length === 2 && controllers.every(avatar => !avatar.seated && !avatar.seatLocked);
  })));

  const cohostPositionBefore = await cohost.evaluate(() => window.__mrDiag.localPosition);
  await cohost.keyboard.down('KeyW');
  await cohost.waitForTimeout(400);
  await cohost.keyboard.up('KeyW');
  const cohostPositionAfter = await cohost.evaluate(() => window.__mrDiag.localPosition);
  assert.ok(Math.hypot(cohostPositionAfter[0] - cohostPositionBefore[0], cohostPositionAfter[2] - cohostPositionBefore[2]) > .2, 'Cohost must remain movable while Guests are locked');

  const lockedPosition = await visitor.evaluate(() => window.__mrDiag.localPosition);
  await visitor.keyboard.down('KeyW');
  await pressSpace(visitor);
  await visitor.waitForTimeout(500);
  await visitor.keyboard.up('KeyW');
  const stillLockedPosition = await visitor.evaluate(() => window.__mrDiag.localPosition);
  assert.ok(Math.hypot(stillLockedPosition[0] - lockedPosition[0], stillLockedPosition[2] - lockedPosition[2]) < .01, 'Locked visitor must remain on the assigned seat');
  assert.equal(await visitor.evaluate(() => window.__mrDiag.airborne), false);

  await cohost.click('#unlock-seats-button');
  await visitor.waitForFunction(() => !window.__mrDiag.roomLocked && !window.__mrDiag.seatLocked);
  await visitor.keyboard.down('KeyW');
  await visitor.waitForTimeout(500);
  await visitor.keyboard.up('KeyW');
  await visitor.waitForFunction(() => !window.__mrDiag.seated);

  await host.screenshot({ path: fileURLToPath(new URL('multiuser-host.png', output)), fullPage: true });
  await visitor.screenshot({ path: fileURLToPath(new URL('multiuser-visitor.png', output)), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('multiuser-smoke: ok', JSON.stringify({ people: 3, roles: ['host', 'guest', 'cohost'], peerConnections: 6, hostAudio: true, hostScreen: true, mention: true, movement: true, leftRight: true, doubleJump: true, flip: true, emotes: true, cohostControls: true, guestOnlySeatAll: true, autoLock: true, controllersMovable: true, unlock: true }));

  await hostContext.close();
  await visitorContext.close();
  await cohostContext.close();
} finally {
  await browser.close();
}
