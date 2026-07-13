import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { installSupabaseMock } from './supabase-mock.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ownerId = '00000000-0000-4000-8000-000000000001';
const store = {
  rooms: [
    {
      id: 'owned-space',
      room_id: 'owned-space',
      owner_id: ownerId,
      name: 'Mein Account Space',
      title: 'Mein Account Space',
      template_id: 'neon-stage',
      status: 'active',
      max_users: 25,
      guest_code_hash: 'a'.repeat(64),
      cohost_code_hash: 'b'.repeat(64),
      created_at: '2026-07-13T10:00:00.000Z'
    },
    {
      id: 'public-space',
      room_id: 'public-space',
      owner_id: '00000000-0000-4000-8000-000000000099',
      name: 'Öffentlicher Space',
      title: 'Öffentlicher Space',
      template_id: 'alpine-summit',
      status: 'active',
      max_users: 25,
      created_at: '2026-07-13T11:00:00.000Z'
    }
  ]
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
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
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installSupabaseMock(page, store);
  page.on('dialog', dialog => dialog.accept());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/spaces.html`);
  await page.waitForFunction(() => document.querySelectorAll('#own-spaces .own-space-card').length === 1);
  assert.equal(await page.locator('#public-spaces .space-card').count(), 2, 'public directory uses Supabase RPC');
  assert.equal(await page.locator('#own-count').textContent(), '1', 'only signed-in owner space is listed');
  const ownerActionsLayout = await page.locator('#own-spaces .owner-actions').evaluate(element => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    overflowing: element.scrollWidth > element.clientWidth,
    labelsFit: [...element.children].every(child => child.scrollWidth <= child.clientWidth)
  }));
  assert.deepEqual(ownerActionsLayout, { columns: 2, overflowing: false, labelsFit: true }, 'owner actions form a clean mobile grid');

  await page.locator('#own-spaces .edit-space').click();
  await page.locator('#edit-title-field').fill('Neuer Space Name');
  await page.locator('#edit-template').selectOption('ocean-dome');
  await page.locator('#edit-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#own-spaces h3')?.textContent === 'Neuer Space Name');
  assert.equal(store.rooms[0].template_id, 'ocean-dome', 'owner update reaches Supabase table mock');

  await page.locator('#own-spaces .rotate-invites').click();
  await page.waitForFunction(() => document.querySelector('#invite-codes-dialog')?.open === true);
  assert.match(await page.locator('#new-guest-code').textContent(), /^GUEST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.match(await page.locator('#new-cohost-code').textContent(), /^COHOST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await page.locator('#invite-codes-dialog .primary-button[data-close-dialog]').click();

  await page.locator('#own-spaces .delete-space').click();
  await page.locator('#delete-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#own-spaces .own-space-card').length === 0);
  assert.equal(store.rooms.length, 1, 'owner delete removes only the selected space');
  assert.deepEqual(errors, []);
  console.log('spaces-owner-smoke: ok', JSON.stringify({ ownerActionsGrid: true, labelsFit: true }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
