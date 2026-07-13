import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const tables = { presence: [], messages: [], signals: [], rooms: [], portals: [], avatars: [] };
let nextId = 1;

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
      if (key !== 'limit' && String(row[key]) !== value) return false;
    }
    return true;
  }).slice(-Number(url.searchParams.get('limit') || 100));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route('**/_db/**', mockDb);
  return { context, page };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
});
const errors = [];
const sessions = [];

try {
  const hostSession = await newPage(browser);
  sessions.push(hostSession);
  const host = hostSession.page;
  host.on('pageerror', error => errors.push(error.message));
  await host.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await host.fill('#display-name', 'Capacity Host');
  await host.fill('#room-name', 'Test Capacity 25');
  await host.click('.enter-button');
  await host.waitForFunction(() => window.__mrDiag?.joined === true);
  const { eventId, inviteCodes } = await host.evaluate(() => window.__mrDiag);
  assert.equal(await host.evaluate(() => window.__mrDiag.portals), 0, 'Empty rooms must not render decorative portal rings');
  await host.locator('#invite-dialog .close-dialog').click();

  const now = new Date().toISOString();
  for (let index = 1; index <= 24; index++) {
    tables.presence.push({
      _id: nextId++,
      event_id: eventId,
      client_id: `!capacity-guest-${String(index).padStart(2, '0')}`,
      name: `Capacity Guest ${index}`,
      role: 'guest',
      color: '#8cf6ff',
      x: 0,
      z: 5,
      rotation: 0,
      status: 'online',
      created_at: now
    });
  }

  await host.waitForFunction(() => window.__mrDiag.people === 25, null, { timeout: 15_000 });
  assert.equal(await host.locator('#capacity-count').innerText(), '25 / 25');
  assert.equal(await host.evaluate(() => window.__mrDiag.seatCapacity), 25);

  await host.click('#seat-all-button');
  await host.waitForFunction(() => window.__mrDiag.seatAssignments === 25);
  await host.click('#lock-seats-button');
  await host.waitForFunction(() => window.__mrDiag.roomLocked && window.__mrDiag.avatarStates.length === 25 && window.__mrDiag.avatarStates.every(avatar => avatar.seated && avatar.seatLocked));
  const seating = await host.evaluate(() => ({
    seatFacings: window.__mrDiag.seatFacings,
    avatars: window.__mrDiag.avatarStates
  }));
  assert.equal(seating.seatFacings.length, 25);
  assert.ok(seating.seatFacings.every(seat => seat.alignment > .999999), 'Every seat rotation must point to the main-stage screen');
  assert.ok(seating.avatars.every(avatar => avatar.stageFacingAlignment > .999999), 'Every seated avatar must face the main-stage screen');

  const overflowSession = await newPage(browser);
  sessions.push(overflowSession);
  const overflow = overflowSession.page;
  overflow.on('pageerror', error => errors.push(error.message));
  await overflow.goto(`${base}?invite=${encodeURIComponent(inviteCodes.guest)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await overflow.fill('#display-name', 'Person 26');
  await overflow.fill('#invite-code', inviteCodes.guest);
  await overflow.click('.enter-button');
  await overflow.waitForFunction(() => document.querySelector('#join-error')?.textContent.includes('Maximal 25 Personen'));
  assert.equal(await overflow.evaluate(() => window.__mrDiag.joined), false);
  assert.deepEqual(errors, []);
  console.log('capacity-smoke: ok', JSON.stringify({ people: 25, seats: 25, facingScreen: 25, locked: 25, decorativePortals: 0, overflowRejected: true }));
} finally {
  await Promise.all(sessions.map(({ context }) => context.close().catch(() => {})));
  await browser.close();
}
