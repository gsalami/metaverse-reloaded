import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const tables = { presence: [], messages: [], signals: [], rooms: [], room_templates: [], portals: [], avatars: [] };
let nextId = 1;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try {
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.svg': 'image/svg+xml',
      '.glb': 'model/gltf-binary'
    };
    const body = await readFile(join(root, filename));
    response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end();
  }
});

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

async function makePage(browser, errors, options = {}) {
  const mobile = Boolean(options.mobile);
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1180, height: 780 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${options.name}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${options.name}: ${message.text()}`);
  });
  await page.route('**/_db/**', mockDb);
  return { context, page };
}

async function createRoom(page) {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', 'Seat Host');
  await page.fill('#room-name', 'Seat Selection Smoke');
  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
  const codes = await page.evaluate(() => window.__mrDiag.inviteCodes);
  await page.locator('#invite-dialog .close-dialog').click();
  return codes;
}

async function joinGuest(page, name, code) {
  await page.goto(`${origin}/?invite=${encodeURIComponent(code)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', name);
  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
}

async function seatTarget(page, index = null) {
  await page.waitForFunction(() => window.__mrDiag?.seatScreenPositions?.some(seat => seat.visible), null, { timeout: 10_000 });
  return page.evaluate(requestedIndex => {
    const positions = window.__mrDiag.seatScreenPositions;
    const target = requestedIndex === null
      ? positions.find(seat => seat.visible && !seat.occupiedBy)
      : positions.find(seat => seat.index === requestedIndex && seat.visible);
    if (!target) throw new Error(`No visible seat target for index ${requestedIndex ?? 'free'}`);
    return target;
  }, index);
}

async function visibleSeatIndices(page) {
  await page.waitForFunction(() => window.__mrDiag?.seatScreenPositions?.some(seat => seat.visible), null, { timeout: 10_000 });
  return page.evaluate(() => window.__mrDiag.seatScreenPositions.filter(seat => seat.visible).map(seat => seat.index));
}

async function pointerSeat(page, target, pointerType) {
  if (pointerType === 'touch') await page.touchscreen.tap(target.x, target.y);
  else await page.mouse.click(target.x, target.y);
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = process.env.MR_URL?.replace(/\/$/, '') || `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
});
const errors = [];
const sessions = [];

try {
  const hostSession = await makePage(browser, errors, { name: 'host' });
  const desktopSession = await makePage(browser, errors, { name: 'desktop guest' });
  const mobileSession = await makePage(browser, errors, { name: 'mobile guest', mobile: true });
  sessions.push(hostSession, desktopSession, mobileSession);
  const host = hostSession.page;
  const desktop = desktopSession.page;
  const mobile = mobileSession.page;

  const codes = await createRoom(host);
  await joinGuest(desktop, 'Click Guest', codes.guest);
  await joinGuest(mobile, 'Touch Guest', codes.guest);
  await Promise.all([host, desktop, mobile].map(page => page.waitForFunction(() => {
    const diag = window.__mrDiag;
    return diag.people === 3 && diag.connectedPeers === 2 && diag.openChannels === 2;
  }, null, { timeout: 30_000 })));

  // Desktop: a real pointer click seats the local avatar and faces it at the stage.
  const mobileVisibleSeats = new Set(await visibleSeatIndices(mobile));
  const desktopVisibleSeats = await visibleSeatIndices(desktop);
  const sharedVisibleSeat = desktopVisibleSeats.find(index => mobileVisibleSeats.has(index));
  assert.notEqual(sharedVisibleSeat, undefined, 'Desktop and mobile must have at least one commonly visible seat');
  let desktopTarget = await seatTarget(desktop, sharedVisibleSeat);

  // Camera dragging from a seat must not be mistaken for a seat click.
  await desktop.mouse.move(desktopTarget.x, desktopTarget.y);
  await desktop.mouse.down();
  await desktop.mouse.move(desktopTarget.x + 35, desktopTarget.y + 20, { steps: 3 });
  await desktop.mouse.up();
  await desktop.waitForTimeout(150);
  assert.equal(await desktop.evaluate(() => window.__mrDiag.seated), false, 'Dragging the camera over a seat must not sit the avatar');
  desktopTarget = await seatTarget(desktop, sharedVisibleSeat);

  await pointerSeat(desktop, desktopTarget, 'mouse');
  await desktop.waitForFunction(index => {
    const diag = window.__mrDiag;
    const local = diag.avatarStates.find(avatar => avatar.local);
    return diag.seated && diag.seatIndex === index && local?.stageFacingAlignment > .999999;
  }, desktopTarget.index);
  await host.waitForFunction(({ guestId, seatIndex }) => {
    const diag = window.__mrDiag;
    return diag.seatAssignmentsDetail.some(item => item.clientId === guestId && item.seatIndex === seatIndex)
      && diag.avatarStates.some(avatar => avatar.clientId === guestId && avatar.seated && avatar.seatIndex === seatIndex);
  }, { guestId: await desktop.evaluate(() => window.__mrDiag.clientId), seatIndex: desktopTarget.index }, { timeout: 10_000 });

  // The same occupied seat cannot be taken over by another participant.
  const occupiedTarget = await seatTarget(mobile, desktopTarget.index);
  await pointerSeat(mobile, occupiedTarget, 'touch');
  await mobile.waitForTimeout(500);
  assert.equal(await mobile.evaluate(() => window.__mrDiag.seated), false, 'An occupied seat must stay unavailable');
  assert.equal(await desktop.evaluate(() => window.__mrDiag.seatIndex), desktopTarget.index, 'The first occupant must keep the seat');

  // Clicking the current seat again toggles back to standing while the room is unlocked.
  const currentDesktopTarget = await seatTarget(desktop, desktopTarget.index);
  await pointerSeat(desktop, currentDesktopTarget, 'mouse');
  await desktop.waitForFunction(() => !window.__mrDiag.seated && window.__mrDiag.seatIndex === -1);
  await host.waitForFunction(guestId => !window.__mrDiag.seatAssignmentsDetail.some(item => item.clientId === guestId), await desktop.evaluate(() => window.__mrDiag.clientId));

  // Mobile: a touch tap chooses a free seat. Movement then releases it when unlocked.
  const mobileTarget = await seatTarget(mobile);
  await pointerSeat(mobile, mobileTarget, 'touch');
  await mobile.waitForFunction(index => {
    const diag = window.__mrDiag;
    const local = diag.avatarStates.find(avatar => avatar.local);
    return diag.seated && diag.seatIndex === index && local?.stageFacingAlignment > .999999;
  }, mobileTarget.index);
  const mobileId = await mobile.evaluate(() => window.__mrDiag.clientId);
  await host.waitForFunction(({ guestId, seatIndex }) => window.__mrDiag.seatAssignmentsDetail
    .some(item => item.clientId === guestId && item.seatIndex === seatIndex), { guestId: mobileId, seatIndex: mobileTarget.index });

  const forward = mobile.locator('[data-key="KeyW"]');
  await forward.dispatchEvent('pointerdown', { pointerId: 81, pointerType: 'touch' });
  await mobile.waitForTimeout(250);
  await forward.dispatchEvent('pointerup', { pointerId: 81, pointerType: 'touch' });
  await mobile.waitForFunction(() => !window.__mrDiag.seated && window.__mrDiag.seatIndex === -1);
  await host.waitForFunction(guestId => !window.__mrDiag.seatAssignmentsDetail.some(item => item.clientId === guestId), mobileId);

  assert.deepEqual(errors, []);
  console.log('seat-selection-smoke: ok', JSON.stringify({
    desktopClick: true,
    stageFacing: true,
    occupancySynchronized: true,
    occupiedSeatRejected: true,
    cameraDragIgnored: true,
    clickToStand: true,
    mobileTouch: true,
    movementToStand: true
  }));
} finally {
  await Promise.all(sessions.map(({ context }) => context.close().catch(() => {})));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
