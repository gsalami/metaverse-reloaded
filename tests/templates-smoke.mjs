import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const expectedTemplateIds = [
  'neon-stage',
  'alpine-summit',
  'tropical-island',
  'mars-base',
  'cyber-city',
  'zen-garden',
  'moon-station',
  'ocean-dome',
  'desert-festival',
  'arctic-aurora'
];
const tables = {
  presence: [],
  messages: [],
  signals: [],
  rooms: [],
  portals: [],
  avatars: [],
  room_templates: []
};
let nextId = 1;

const appSource = await readFile(join(root, 'app.js'), 'utf8');
assert.match(appSource, /roomTemplates\s*:\s*['"]\/_db\/spaces\/room_templates['"]/, 'room-template DB endpoint is configured');
for (const templateId of expectedTemplateIds) {
  assert.ok(appSource.includes(`'${templateId}'`) || appSource.includes(`"${templateId}"`), `app.js is missing template ${templateId}`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try {
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
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

async function makePage(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/_db/**', mockDb);
  return { context, page };
}

async function joinPublicRoom(browser, errors, origin, roomId, personName) {
  const { context, page } = await makePage(browser, errors);
  await page.goto(`${origin}/?room=${encodeURIComponent(roomId)}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', personName);
  await page.click('#join-form .enter-button');
  await page.waitForFunction(id => window.__mrDiag?.joined === true && window.__mrDiag.eventId === id, roomId);
  const templateId = await page.evaluate(() => window.__mrDiag.templateId);
  await context.close();
  return templateId;
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const errors = [];

try {
  const { context, page } = await makePage(browser, errors);
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });

  const uiTemplateIds = await page.locator('input[name="room-template"]').evaluateAll(inputs => inputs.map(input => input.value));
  const runtimeTemplateIds = await page.evaluate(() => window.__mrDiag.availableTemplateIds);
  assert.equal(uiTemplateIds.length, 10, 'template picker must expose exactly ten templates');
  assert.equal(new Set(uiTemplateIds).size, 10, 'template IDs must be unique');
  assert.deepEqual([...uiTemplateIds].sort(), [...expectedTemplateIds].sort(), 'template picker exposes the agreed template IDs');
  assert.deepEqual([...runtimeTemplateIds].sort(), [...expectedTemplateIds].sort(), 'runtime exposes exactly the same ten template IDs');
  const defaultTemplateId = await page.locator('input[name="room-template"]:checked').inputValue();
  assert.equal(defaultTemplateId, 'neon-stage', 'Neon Stage remains the fallback for existing rooms');

  const selectedTemplateId = 'ocean-dome';
  await page.fill('#display-name', 'Template Host');
  await page.fill('#room-name', 'Ocean Workshop');
  await page.check(`input[name="room-template"][value="${selectedTemplateId}"]`, { force: true });
  await page.click('#join-form .enter-button');
  await page.waitForFunction(() => window.__mrDiag?.joined === true);

  const createdRoom = tables.rooms.find(room => room.title === 'Ocean Workshop');
  assert.ok(createdRoom?.room_id, 'room creation persisted the room');
  const createdMapping = tables.room_templates.find(mapping => mapping.room_id === createdRoom.room_id);
  assert.equal(createdMapping?.template_id, selectedTemplateId, 'room creation persisted its selected template separately');
  assert.ok(!Number.isNaN(Date.parse(createdMapping?.updated_at)), 'template mapping has an update timestamp');
  assert.equal(await page.evaluate(() => window.__mrDiag.templateId), selectedTemplateId, 'new room applies its selected template');
  await context.close();

  tables.rooms.push({ room_id: 'stored-template-room', title: 'Stored Mars Room', status: 'active', created_at: new Date().toISOString() });
  tables.room_templates.push({ room_id: 'stored-template-room', template_id: 'mars-base', updated_at: new Date().toISOString() });
  const joinedStoredTemplate = await joinPublicRoom(browser, errors, origin, 'stored-template-room', 'Mars Guest');
  assert.equal(joinedStoredTemplate, 'mars-base', 'joining a room applies its persisted template mapping');

  tables.rooms.push({ room_id: 'legacy-room', title: 'Legacy Room', status: 'active', created_at: new Date().toISOString() });
  const joinedFallbackTemplate = await joinPublicRoom(browser, errors, origin, 'legacy-room', 'Legacy Guest');
  assert.equal(joinedFallbackTemplate, defaultTemplateId, 'rooms without a template mapping use the default template');

  assert.deepEqual(errors, []);
  console.log('templates-smoke: ok', JSON.stringify({
    templates: uiTemplateIds.length,
    persisted: selectedTemplateId,
    joined: joinedStoredTemplate,
    fallback: joinedFallbackTemplate
  }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
