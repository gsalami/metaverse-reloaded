import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const live = process.env.MR_LIVE === '1';
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

async function makePage(context, errors) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  if (!live) await page.route('**/_db/**', database);
  return page;
}

async function createRoom(page, personName, roomTitle) {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', personName);
  await page.fill('#room-name', roomTitle);
  await page.click('.enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
  const details = await page.evaluate(() => ({ eventId: window.__mrDiag.eventId, codes: window.__mrDiag.inviteCodes }));
  await page.locator('#invite-dialog .close-dialog').click();
  return details;
}

async function sendMessage(page, text) {
  await page.click('#chat-button');
  await page.fill('#chat-input', text);
  await page.click('.send-button');
  await page.waitForSelector(`.message-text:text-is("${text}")`);
  await page.click('#chat-button');
}

async function joinWithCode(page, name, code) {
  await page.goto(`${base}?invite=${encodeURIComponent(code)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', name);
  await page.click('.enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
}

async function hold(page, key, milliseconds) {
  const button = page.locator(`[data-key="${key}"]`);
  await button.dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch' });
  await page.waitForTimeout(milliseconds);
  await button.dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch' });
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
});
const errors = [];

try {
  const destinationContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const sourceContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const destination = await makePage(destinationContext, errors);
  const source = await makePage(sourceContext, errors);
  const guest = await makePage(guestContext, errors);

  const suffix = Date.now();
  const targetRoom = await createRoom(destination, 'Destination Host', `Test Portal Destination ${suffix}`);
  await sendMessage(destination, 'NUR IM ZIELRAUM');
  const sourceRoom = await createRoom(source, 'Source Host', `Test Portal Source ${suffix}`);

  await source.click('#portals-button');
  await source.fill('#portal-label', 'Zur Destination Lounge');
  await source.fill('#portal-target-code', targetRoom.codes.guest);
  await source.click('.portal-create-button');
  await source.waitForFunction(() => window.__mrDiag.portals === 1);
  assert.equal(await source.locator('.portal-list-item').count(), 1);
  await source.locator('[data-close-dialog="portal-dialog"]').click();
  await sendMessage(source, 'NUR IM QUELLRAUM');

  await joinWithCode(guest, 'Portal Traveller', sourceRoom.codes.guest);
  await guest.waitForFunction(() => window.__mrDiag.portals === 1);
  assert.equal(await guest.evaluate(() => window.__mrDiag.eventId), sourceRoom.eventId);
  await guest.click('#chat-button');
  await guest.waitForSelector('.message-text:text-is("NUR IM QUELLRAUM")');
  assert.equal(await guest.locator('.message-text:text-is("NUR IM ZIELRAUM")').count(), 0, 'Destination chat must not leak into source room');
  await guest.click('#chat-button');
  await guest.evaluate(() => document.activeElement?.blur());

  const portalPosition = await guest.evaluate(() => window.__mrDiag.portalTargets[0].position);
  for (let attempt = 0; attempt < 70; attempt++) {
    const { position, yaw } = await guest.evaluate(() => ({ position: window.__mrDiag.localPosition, yaw: window.__mrDiag.cameraYaw }));
    const dx = portalPosition[0] - position[0];
    const dz = portalPosition[2] - position[2];
    if (Math.hypot(dx, dz) < 2.5) break;
    const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const right = dx * -Math.cos(yaw) + dz * Math.sin(yaw);
    const key = Math.abs(forward) >= Math.abs(right)
      ? forward >= 0 ? 'KeyW' : 'KeyS'
      : right >= 0 ? 'KeyD' : 'KeyA';
    await hold(guest, key, 220);
  }
  await guest.waitForSelector('#portal-prompt:not([hidden])', { timeout: 5_000 });
  await guest.click('#portal-prompt');
  await guest.waitForFunction(targetId => window.__mrDiag?.joined === true && window.__mrDiag.eventId === targetId, targetRoom.eventId, { timeout: 30_000 });
  assert.equal(await guest.evaluate(() => window.__mrDiag.role), 'guest');
  await guest.waitForSelector('#room-arrival:not([hidden])');
  assert.match(await guest.locator('#room-arrival-title').textContent(), /Destination/);
  assert.match(await guest.locator('#room-arrival a').getAttribute('href'), /spaces\.html#recent-title$/);
  const recentSpaces = await guest.evaluate(() => JSON.parse(localStorage.getItem('metaverse-reloaded:last-spaces') || '[]'));
  assert.equal(recentSpaces[0]?.roomId, targetRoom.eventId, 'destination is newest recent space');
  assert.ok(recentSpaces.some(space => space.roomId === sourceRoom.eventId), 'source remains available for return without portal');
  await guest.click('#chat-button');
  await guest.waitForSelector('.message-text:text-is("NUR IM ZIELRAUM")');
  assert.equal(await guest.locator('.message-text:text-is("NUR IM QUELLRAUM")').count(), 0, 'Source chat must not leak into destination room');
  assert.match(await guest.locator('#chat-room-scope').innerText(), /DESTINATION/);

  assert.deepEqual(errors, []);
  console.log('portal-smoke: ok', JSON.stringify({ roomScopedChat: true, portalCreated: true, threeDProximity: true, portalTravel: true, destinationRole: 'guest', arrivalFeedback: true, recentReturn: true }));

  await Promise.all([destinationContext.close(), sourceContext.close(), guestContext.close()]);
} finally {
  await browser.close();
}
