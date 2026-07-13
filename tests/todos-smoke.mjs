import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const rows = [];
let nextId = 1;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/_db/project/tasks') {
    if (request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const row = { _id: nextId++, ...JSON.parse(body) };
      rows.push(row);
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ row }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ rows: rows.slice(-Number(url.searchParams.get('limit') || 100)) }));
    return;
  }

  const filename = url.pathname === '/todos.html' ? 'todos.html' : url.pathname.slice(1);
  if (!['todos.html', 'todos.css', 'todos.js'].includes(filename)) { response.writeHead(404).end(); return; }
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  response.writeHead(200, { 'Content-Type': types[extname(filename)] });
  response.end(await readFile(join(root, filename)));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/todos.html`);
  await page.waitForFunction(() => document.querySelectorAll('.task-card').length === 19);

  assert.equal(await page.locator('.column').count(), 5, 'five Kanban columns');
  assert.equal(rows.length, 19, 'initial tasks seeded once');
  assert.equal(await page.locator('#task-total').textContent(), '19');

  const githubCard = page.locator('.task-card', { hasText: 'Öffentliches GitHub-Repository' });
  await githubCard.locator('select').selectOption('Blockiert');
  await page.waitForFunction(() => document.querySelector('[data-task-list="Blockiert"]')?.textContent.includes('Öffentliches GitHub-Repository'));
  assert.equal(rows.at(-1).status, 'Blockiert');

  await page.click('#new-task-button');
  await page.fill('#task-title', '<img src=x onerror="window.hacked=true"> Neue Testaufgabe');
  await page.selectOption('#task-status', 'Offen');
  await page.selectOption('#task-priority', 'Niedrig');
  await page.fill('#task-note', '<script>window.hacked=true</script> sichere Notiz');
  await page.click('#task-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('.task-card').length === 20);
  assert.equal(await page.locator('.task-card img').count(), 0, 'task titles render as text');
  assert.equal(await page.locator('.task-card script').count(), 0, 'task notes render as text');
  assert.equal(await page.evaluate(() => window.hacked), undefined, 'injected code did not execute');

  const secondPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await secondPage.goto(`http://127.0.0.1:${address.port}/todos.html`);
  await secondPage.waitForFunction(() => document.querySelectorAll('.task-card').length === 20);
  assert.equal(rows.filter(row => row.task_id === 'max-people-25').length, 1, 'non-empty board is not seeded again');
  assert.equal(await secondPage.locator('.column').count(), 5);
  assert.deepEqual(errors, []);
  console.log('todos-smoke: ok', JSON.stringify({ seeded: 19, statusUpdate: true, createTask: true, xssSafe: true, mobile: true }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
