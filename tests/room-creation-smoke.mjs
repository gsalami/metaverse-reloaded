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
  }).slice(-Number(url.searchParams.get('limit') || 100));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

function assertUsefulSuggestion(value) {
  const suggestion = String(value || '').trim();
  assert.ok(suggestion.length >= 4, `fresh page should suggest a useful room name, got ${JSON.stringify(value)}`);
  assert.doesNotMatch(suggestion, /^mein(?:e[rs]?)? metaverse$/i, 'suggestion must not be the generic "Mein Metaverse" title');
  assert.doesNotMatch(suggestion, /^(?:metaverse|space|raum)$/i, 'suggestion must not be a generic product noun');
  return suggestion;
}

async function createSuggestedRoom(browser, origin, creatorName, templateId) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/_db/**', mockDb);
  await installSupabaseMock(page, tables);
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });

  const suggestedTitle = assertUsefulSuggestion(await page.inputValue('#room-name'));
  await page.fill('#display-name', creatorName);
  await page.check(`input[name="room-template"][value="${templateId}"]`, { force: true });
  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);

  const runtime = await page.evaluate(() => ({
    roomId: window.__mrDiag.eventId,
    title: window.__mrDiag.roomTitle,
    templateId: window.__mrDiag.templateId,
    visibleTitle: document.querySelector('#event-label')?.textContent?.trim(),
    deepLinkRoomId: new URL(location.href).searchParams.get('room')
  }));
  assert.equal(runtime.title, suggestedTitle, 'created room keeps the suggested visible title');
  assert.equal(runtime.visibleTitle, suggestedTitle.toUpperCase(), 'room header displays the created title');
  assert.equal(runtime.deepLinkRoomId, runtime.roomId, 'browser URL visibly exposes the unique room deep link ID');
  assert.equal(runtime.templateId, templateId);
  assert.match(runtime.roomId, /^[a-z0-9_-]+-[a-z0-9]{6}$/i, 'created room has a generated unique ID');
  assert.deepEqual(errors, []);
  await context.close();
  return { suggestedTitle, ...runtime };
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});

try {
  const first = await createSuggestedRoom(browser, origin, 'First Creator', 'neon-stage');
  const second = await createSuggestedRoom(browser, origin, 'Second Creator', 'zen-garden');

  assert.notEqual(first.suggestedTitle, second.suggestedTitle, 'each fresh page load proposes a different room title');
  assert.notEqual(first.roomId, second.roomId, 'separate room creations have different IDs');
  assert.equal(new Set(tables.rooms.map(room => room.title)).size, 2, 'two distinct room titles were persisted');
  assert.equal(new Set(tables.rooms.map(room => room.room_id)).size, 2, 'two distinct room IDs were persisted');

  console.log('room-creation-smoke: ok', JSON.stringify({
    suggestionsUnique: true,
    createdTitles: [first.suggestedTitle, second.suggestedTitle],
    createdIds: [first.roomId, second.roomId]
  }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
