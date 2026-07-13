import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const rooms = [
  { room_id: 'space-zurich', title: 'Kuble Zürich', status: 'active', created_at: '2026-07-13T08:00:00.000Z' },
  { room_id: 'space-closed', title: 'Geschlossener Space', status: 'closed', created_at: '2026-07-13T08:30:00.000Z' },
  { room_id: 'space-safe', title: '<img src=x onerror="window.hacked=true"> Safe Space', status: 'active', created_at: '2026-07-13T09:00:00.000Z' }
];
let failDb = false;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/_db/spaces/rooms') {
    if (failDb) {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'test outage' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ rows: rooms.slice(-Number(url.searchParams.get('limit') || 100)) }));
    return;
  }

  const filename = url.pathname === '/spaces.html' ? 'spaces.html' : url.pathname.slice(1);
  if (!['spaces.html', 'spaces.css', 'spaces.js', 'favicon.svg'].includes(filename)) {
    response.writeHead(404).end();
    return;
  }
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
  response.writeHead(200, { 'Content-Type': types[extname(filename)] });
  response.end(await readFile(join(root, filename)));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async value => localStorage.setItem('spaces-test-clipboard', value),
        readText: async () => localStorage.getItem('spaces-test-clipboard') || ''
      }
    });
    localStorage.setItem('metaverse-reloaded:last-spaces', JSON.stringify([
      { roomId: 'space-old', title: 'Alter Besuch', visitedAt: '2026-07-12T10:00:00.000Z' },
      { room_id: 'space-zurich', title: 'Kuble Zürich', visited_at: '2026-07-13T10:00:00.000Z' },
      { roomId: 'space-old', title: 'Erneut besucht', visitedAt: '2026-07-13T09:00:00.000Z' }
    ]));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/supabase-client.js*', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `
      export const supabase = null;
      export function isSupabaseConfigured() { return false; }
      export async function signInWithMagicLink() { return { data: null, error: null }; }
      export async function signOut() { return { data: null, error: null }; }
      export async function getSession() { return { data: { session: null }, error: null }; }
      export function onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      }
    `
  }));
  await page.goto(`${origin}/spaces.html`);
  await page.waitForFunction(() => document.querySelectorAll('#public-spaces .space-card').length === 2);

  assert.equal(await page.locator('#public-count').textContent(), '2', 'only active rooms appear');
  assert.equal(await page.locator('[data-room-id="space-closed"]').count(), 0, 'closed room hidden');
  assert.equal(await page.locator('#public-spaces img').count(), 0, 'room title is rendered as text');
  assert.equal(await page.evaluate(() => window.hacked), undefined, 'injected room title did not execute');

  const zurich = page.locator('#public-spaces [data-room-id="space-zurich"]');
  assert.equal(await zurich.locator('h3').textContent(), 'Kuble Zürich');
  assert.equal(await zurich.locator('.room-id').textContent(), 'Raum-ID: space-zurich');
  assert.equal(await zurich.locator('.join-link').getAttribute('href'), `${origin}/?room=space-zurich`);

  assert.equal(await page.locator('#recent-count').textContent(), '2', 'recent rooms are deduplicated');
  const recentFirst = page.locator('#recent-spaces .space-card').first();
  assert.equal(await recentFirst.getAttribute('data-room-id'), 'space-zurich', 'latest visit first');
  assert.match(await recentFirst.locator('time').textContent(), /^Besucht /);
  assert.equal(await recentFirst.locator('.join-link').getAttribute('href'), `${origin}/?room=space-zurich`);

  await zurich.locator('.copy-link').click();
  await page.waitForFunction(() => document.querySelector('#public-spaces [data-room-id="space-zurich"] .copy-status')?.textContent.includes('kopiert'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/?room=space-zurich`);

  rooms.push({ room_id: 'space-new', title: 'Neuer Live Space', status: 'active', created_at: '2026-07-13T11:00:00.000Z' });
  await page.waitForFunction(() => document.querySelectorAll('#public-spaces .space-card').length === 3, null, { timeout: 7_000 });
  assert.equal(await page.locator('#public-count').textContent(), '3', 'polling renders newly created rooms');

  failDb = true;
  await page.waitForFunction(() => document.querySelector('#sync-state')?.classList.contains('error'), null, { timeout: 7_000 });
  assert.match(await page.locator('#public-state').textContent(), /nicht geladen/);
  failDb = false;

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${origin}/spaces.html`);
  await mobile.waitForFunction(() => document.querySelectorAll('#public-spaces .space-card').length === 3);
  assert.equal(await mobile.locator('#public-spaces .space-card').count(), 3);
  assert.equal(await mobile.locator('#recent-spaces .space-card').count(), 2);

  assert.deepEqual(errors, []);
  console.log('spaces-smoke: ok', JSON.stringify({ activeOnly: true, deepLinks: true, copy: true, recent: true, polling: true, xssSafe: true, error: true, mobile: true }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
