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

for (const templateId of expectedTemplateIds) {
  const roomId = `architecture-${templateId}`;
  tables.rooms.push({
    _id: nextId++,
    room_id: roomId,
    title: `Architecture ${templateId}`,
    status: 'active',
    created_at: new Date().toISOString()
  });
  tables.room_templates.push({
    _id: nextId++,
    room_id: roomId,
    template_id: templateId,
    updated_at: new Date().toISOString()
  });
}

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

async function makePage(browser, mobile, errors) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 760 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${mobile ? 'mobile' : 'desktop'}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${mobile ? 'mobile' : 'desktop'}: ${message.text()}`);
  });
  await page.route('**/_db/**', mockDb);
  return { context, page };
}

async function inspectArchitecture(page, origin, templateId, mobile) {
  await page.goto(`${origin}/?room=architecture-${templateId}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.fill('#display-name', `${mobile ? 'Mobile' : 'Desktop'} ${templateId}`);
  await page.click('#join-form .enter-button');
  await page.waitForFunction(id => {
    const diag = window.__mrDiag;
    return diag?.joined === true
      && diag.templateId === id
      && typeof diag.architectureType === 'string'
      && diag.architectureType.length > 0
      && Array.isArray(diag.architectureObjects);
  }, templateId, { timeout: 15_000 });
  const diagnostics = await page.evaluate(() => {
    const diag = window.__mrDiag;
    return {
      templateId: diag.templateId,
      architectureType: diag.architectureType,
      roomBounds: diag.roomBounds,
      floorArea: diag.floorArea,
      architectureObjects: diag.architectureObjects,
      seatCapacity: diag.seatCapacity,
      portals: diag.portals
    };
  });
  return diagnostics;
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.MR_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const errors = [];
const contexts = [];

try {
  const desktopSession = await makePage(browser, false, errors);
  contexts.push(desktopSession.context);
  const desktopDiagnostics = [];
  for (const templateId of expectedTemplateIds) {
    desktopDiagnostics.push(await inspectArchitecture(desktopSession.page, origin, templateId, false));
    if (templateId === 'alpine-summit' || templateId === 'cyber-city') {
      await desktopSession.page.waitForTimeout(900);
      await desktopSession.page.screenshot({ path: join(root, 'output', `architecture-${templateId}-desktop.png`) });
    }
  }

  for (const diagnostics of desktopDiagnostics) {
    assert.equal(diagnostics.seatCapacity, 25, `${diagnostics.templateId} must retain all 25 seats`);
    assert.equal(diagnostics.portals, 0, `${diagnostics.templateId} must not create decorative or unsafe portals`);
    assert.ok(Number.isFinite(diagnostics.roomBounds?.width) && diagnostics.roomBounds.width > 0,
      `${diagnostics.templateId} must expose a positive room width`);
    assert.ok(Number.isFinite(diagnostics.roomBounds?.depth) && diagnostics.roomBounds.depth > 0,
      `${diagnostics.templateId} must expose a positive room depth`);
    assert.ok(Number.isFinite(diagnostics.floorArea) && diagnostics.floorArea > 0,
      `${diagnostics.templateId} must expose a positive floor area`);
    assert.ok(diagnostics.architectureObjects.length > 0,
      `${diagnostics.templateId} must expose its actual architecture objects`);
  }

  const architectureTypes = desktopDiagnostics.map(diagnostics => diagnostics.architectureType);
  assert.equal(new Set(architectureTypes).size, expectedTemplateIds.length,
    'all ten templates must use a distinct architecture type, not the same recoloured room');

  const uniqueSizes = new Set(desktopDiagnostics.map(({ roomBounds }) => `${roomBounds.width}x${roomBounds.depth}`));
  assert.ok(uniqueSizes.size >= 4, `ten templates should provide at least four distinct room sizes, got ${[...uniqueSizes].join(', ')}`);
  const floorAreas = desktopDiagnostics.map(diagnostics => diagnostics.floorArea);
  assert.ok(Math.max(...floorAreas) / Math.min(...floorAreas) >= 1.35,
    'largest and smallest architecture should differ in floor area by at least 35%');

  const alpine = desktopDiagnostics.find(diagnostics => diagnostics.templateId === 'alpine-summit');
  assert.ok(alpine.architectureObjects.some(name => /fireplace|hearth|kamin/i.test(name)),
    'Alpine Summit must contain a fireplace/hearth architecture object');
  const cyber = desktopDiagnostics.find(diagnostics => diagnostics.templateId === 'cyber-city');
  assert.ok(cyber.architectureObjects.some(name => /gallery|exhibit|artwork|frame/i.test(name)),
    'Cyber City must contain a gallery/exhibit architecture object');

  const mobileSession = await makePage(browser, true, errors);
  contexts.push(mobileSession.context);
  const mobileCyber = await inspectArchitecture(mobileSession.page, origin, 'cyber-city', true);
  await mobileSession.page.waitForTimeout(900);
  await mobileSession.page.screenshot({ path: join(root, 'output', 'architecture-cyber-city-mobile.png') });
  assert.ok(mobileCyber.architectureObjects.length < cyber.architectureObjects.length,
    `mobile architecture should reduce object count (${mobileCyber.architectureObjects.length} vs ${cyber.architectureObjects.length})`);
  assert.equal(mobileCyber.seatCapacity, 25, 'mobile optimization must not remove participant seats');
  assert.equal(mobileCyber.portals, 0, 'mobile optimization must not introduce decorative portals');

  assert.deepEqual(errors, []);
  console.log('architectures-smoke: ok', JSON.stringify({
    templates: desktopDiagnostics.length,
    architectureTypes,
    uniqueSizes: uniqueSizes.size,
    floorAreaRange: [Math.min(...floorAreas), Math.max(...floorAreas)],
    alpineFireplace: true,
    cyberGallery: true,
    mobileObjects: mobileCyber.architectureObjects.length,
    desktopObjects: cyber.architectureObjects.length,
    seatsPerRoom: 25,
    decorativePortals: 0
  }));
} finally {
  await Promise.all(contexts.map(context => context.close().catch(() => {})));
  await browser.close();
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}
