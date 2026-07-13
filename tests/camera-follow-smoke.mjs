import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installSupabaseMock } from './supabase-mock.mjs';

const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const tables = { presence: [], messages: [], signals: [], rooms: [], room_templates: [], portals: [], avatars: [] };
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

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

async function openRoom(browser, label, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/_db/**', mockDb);
  await installSupabaseMock(page, tables);
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#join-dialog[open]');
  await page.fill('#display-name', `Camera ${label}`);
  await page.fill('#room-name', `Camera Follow ${label} ${Date.now()}`);
  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
  await page.locator('#invite-dialog .close-dialog').click();
  await page.waitForFunction(() => {
    const diag = window.__mrDiag;
    return Number.isFinite(diag?.cameraYaw) && Number.isFinite(diag?.avatarRotation);
  });
  return { context, page };
}

async function waitForCameraBehind(page, message) {
  await page.waitForFunction(() => {
    const { cameraYaw, avatarRotation } = window.__mrDiag;
    const delta = Math.atan2(Math.sin(cameraYaw - avatarRotation), Math.cos(cameraYaw - avatarRotation));
    return Math.abs(delta) < 0.12;
  }, null, { timeout: 3_000 });
  const { cameraYaw, avatarRotation } = await page.evaluate(() => window.__mrDiag);
  assert.ok(angularDistance(cameraYaw, avatarRotation) < 0.12, message);
}

async function exerciseIdleDragAndForward(browser, errors) {
  const { context, page } = await openRoom(browser, 'Forward', errors);
  try {
    const canvas = page.locator('#world');
    const box = await canvas.boundingBox();
    assert.ok(box, '3D canvas must be visible');
    const beforeYaw = await page.evaluate(() => window.__mrDiag.cameraYaw);
    const x = box.x + box.width * 0.55;
    const y = box.y + box.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(start => {
      const yaw = window.__mrDiag.cameraYaw;
      return Math.abs(Math.atan2(Math.sin(yaw - start), Math.cos(yaw - start))) > 0.5;
    }, beforeYaw);
    const draggedYaw = await page.evaluate(() => window.__mrDiag.cameraYaw);
    await page.waitForTimeout(650);
    const idleYaw = await page.evaluate(() => window.__mrDiag.cameraYaw);
    assert.ok(angularDistance(draggedYaw, idleYaw) < 0.03, 'Mouse drag must remain freely adjustable while standing still');

    const before = await page.evaluate(() => window.__mrDiag.localPosition);
    await page.keyboard.down('KeyW');
    try {
      await page.waitForFunction(start => {
        const position = window.__mrDiag.localPosition;
        return Math.hypot(position[0] - start[0], position[2] - start[2]) > 0.35;
      }, before);
      await waitForCameraBehind(page, 'Camera must stay behind the avatar while moving forward');
    } finally {
      await page.keyboard.up('KeyW');
    }
  } finally {
    await context.close();
  }
}

async function exerciseSide(browser, errors, key, expectedSign, label) {
  const { context, page } = await openRoom(browser, label, errors);
  try {
    const before = await page.evaluate(() => ({
      position: window.__mrDiag.localPosition,
      cameraYaw: window.__mrDiag.cameraYaw
    }));
    await page.keyboard.down(key);
    try {
      await page.waitForTimeout(650);
      const movement = await page.evaluate(({ start, yaw, sign }) => {
        const position = window.__mrDiag.localPosition;
        const dx = position[0] - start[0];
        const dz = position[2] - start[2];
        const rightX = -Math.cos(yaw);
        const rightZ = Math.sin(yaw);
        return { position, projected: (dx * rightX + dz * rightZ) * sign };
      }, { start: before.position, yaw: before.cameraYaw, sign: expectedSign });
      assert.ok(movement.projected > 0.12, `${label} must move relative to the starting camera: ${JSON.stringify({ before, movement })}`);
      await waitForCameraBehind(page, `Camera must stay behind the avatar while moving ${label.toLowerCase()}`);
    } finally {
      await page.keyboard.up(key);
    }
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const errors = [];
try {
  await exerciseIdleDragAndForward(browser, errors);
  await exerciseSide(browser, errors, 'KeyA', -1, 'Left');
  await exerciseSide(browser, errors, 'KeyD', 1, 'Right');
  assert.deepEqual(errors, []);
  console.log('camera-follow-smoke: ok', JSON.stringify({ behindOnWASD: true, leftRightCorrect: true, idleDragFree: true }));
} finally {
  await browser.close();
}
