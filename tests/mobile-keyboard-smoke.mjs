import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { installSupabaseMock } from './supabase-mock.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const tables = { presence: [], messages: [], signals: [], rooms: [], room_templates: [], portals: [], avatars: [] };
let nextId = 1;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try {
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
    response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream' });
    response.end(await readFile(join(root, filename)));
  } catch {
    response.writeHead(404).end();
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
  });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { width: 390, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    window.__setKeyboardViewport = (height, offsetTop = 0) => {
      viewport.height = height;
      viewport.offsetTop = offsetTop;
      viewport.dispatchEvent(new Event('resize'));
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/_db/**', mockDb);
  await installSupabaseMock(page, tables);
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', 'Mobile Creator');
  const suggestedTitle = (await page.inputValue('#room-name')).trim();
  assert.ok(suggestedTitle.length >= 4, 'mobile create flow should start with a suggested room title');
  assert.doesNotMatch(suggestedTitle, /^mein(?:e[rs]?)? metaverse$/i);
  const selectedTemplateId = 'arctic-aurora';
  await page.check(`input[name="room-template"][value="${selectedTemplateId}"]`, { force: true });
  assert.equal(await page.locator('input[name="room-template"]:checked').inputValue(), selectedTemplateId);
  await page.focus('#room-name');
  await page.evaluate(() => window.__setKeyboardViewport(430));
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--join-vv-height').trim() === '430px');
  await page.waitForFunction(() => document.querySelector('#join-form .enter-button').getBoundingClientRect().bottom <= 430);

  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('#join-dialog').getBoundingClientRect();
    const form = document.querySelector('#join-form');
    const button = document.querySelector('#join-form .enter-button').getBoundingClientRect();
    return {
      dialogHeight: dialog.height,
      formClientHeight: form.clientHeight,
      formScrollHeight: form.scrollHeight,
      buttonTop: button.top,
      buttonBottom: button.bottom,
      roomFontSize: getComputedStyle(document.querySelector('#room-name')).fontSize
    };
  });
  assert.equal(Math.round(metrics.dialogHeight), 430, JSON.stringify(metrics));
  assert.ok(metrics.formScrollHeight > metrics.formClientHeight, JSON.stringify(metrics));
  assert.ok(metrics.buttonTop >= 0 && metrics.buttonBottom <= 430, JSON.stringify(metrics));
  assert.equal(metrics.roomFontSize, '16px');

  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);
  assert.equal(await page.evaluate(() => window.__mrDiag.role), 'host');
  const createdRoom = tables.rooms.find(room => room.title === suggestedTitle);
  assert.ok(createdRoom?.room_id, 'mobile submit creates the suggested room');
  assert.equal(createdRoom.template_id, selectedTemplateId);
  assert.equal(await page.evaluate(() => window.__mrDiag.templateId), selectedTemplateId);
  assert.equal(await page.locator('#event-label').textContent(), suggestedTitle.toUpperCase());
  assert.equal(new URL(page.url()).searchParams.get('room'), createdRoom.room_id);
  assert.deepEqual(errors, []);
  console.log('mobile-keyboard-smoke: ok', JSON.stringify({ visualViewport: 430, submitVisible: true, safariAutoZoomPrevented: true, roomCreated: true, templateSelected: selectedTemplateId, suggestedTitle }));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
