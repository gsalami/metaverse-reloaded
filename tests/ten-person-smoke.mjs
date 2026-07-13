import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const live = process.env.MR_LIVE === '1';
const base = process.env.MR_URL || 'http://127.0.0.1:8899/';
const room = `Test Ten ${Date.now()}`;
const output = new URL('../output/', import.meta.url);
const tables = { presence: [], messages: [], signals: [], rooms: [], portals: [], avatars: [] };
let nextId = 1;

async function database(route) {
  const request = route.request();
  const url = new URL(request.url());
  const table = url.pathname.split('/').pop();
  if (!tables[table]) return route.continue();
  if (request.method() === 'POST') {
    const row = { _id: nextId++, _created_at: new Date().toISOString(), ...request.postDataJSON() };
    tables[table].push(row);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ row }) });
  }
  const rows = tables[table].filter(row => {
    for (const [key, value] of url.searchParams) {
      if (key !== 'limit' && String(row[key]) !== value) return false;
    }
    return true;
  }).slice(-Number(url.searchParams.get('limit') || 100));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
}

async function makePage(browser, index, errors, inviteCode = '') {
  const context = await browser.newContext({ viewport: { width: 520, height: 360 }, permissions: index === 0 ? ['microphone'] : [] });
  await context.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 80);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#132947';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#8cf6ff';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText('10 PERSON EVENT', 130, 190);
      window.__captureCanvas = canvas;
      return canvas.captureStream(8);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`p${index}:${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`p${index}:${message.text()}`); });
  if (!live) await page.route('**/_db/**', database);
  let loaded = false;
  for (let attempt = 0; attempt < 3 && !loaded; attempt += 1) {
    try {
      await page.goto(index === 0 ? base : `${base}?invite=${encodeURIComponent(inviteCode)}`, { waitUntil: 'commit', timeout: 30_000 });
      await page.waitForFunction(() => Boolean(window.__mrDiag), null, { timeout: 60_000 });
      loaded = true;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(500);
    }
  }
  await page.evaluate(({ name, room, index, inviteCode }) => {
    document.querySelector('#display-name').value = name;
    if (index === 0) document.querySelector('#room-name').value = room;
    else document.querySelector('#invite-code').value = inviteCode;
    document.querySelector('#join-form').requestSubmit();
  }, { name: index === 0 ? 'Main Host' : `Guest ${index}`, room, index, inviteCode });
  try {
    await page.waitForFunction(() => window.__mrDiag?.joined === true, null, { timeout: live ? 45_000 : 30_000 });
  } catch (error) {
    const details = await page.evaluate(() => ({ diag: window.__mrDiag, joinError: document.querySelector('#join-error')?.textContent, dialogOpen: document.querySelector('#join-dialog')?.open }));
    console.error('join-failed', JSON.stringify({ index, room, details, errors }));
    throw error;
  }
  if (index === 0) await page.locator('#invite-dialog .close-dialog').click();
  return { context, page };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
});
const errors = [];
const clients = [];
try {
  clients.push(await makePage(browser, 0, errors));
  const guestCode = await clients[0].page.evaluate(() => window.__mrDiag.inviteCodes.guest);
  for (let index = 1; index < 10; index++) {
    clients.push(await makePage(browser, index, errors, guestCode));
    await new Promise(resolve => setTimeout(resolve, live ? 550 : 150));
  }

  await Promise.all(clients.map(({ page }) => page.waitForFunction(() => window.__mrDiag.people === 10, null, { timeout: live ? 60_000 : 30_000 })));
  await Promise.all(clients.map(({ page }) => page.waitForFunction(() => window.__mrDiag.connectedPeers === 9 && window.__mrDiag.openChannels === 9, null, { timeout: 120_000 })));

  const host = clients[0].page;
  await host.click('#mic-button');
  await host.waitForFunction(() => window.__mrDiag.micLive === true);
  await Promise.all(clients.slice(1).map(({ page }) => page.waitForFunction(() => window.__mrDiag.remoteAudioElements === 1, null, { timeout: 30_000 })));

  await host.click('#share-button');
  await host.waitForFunction(() => window.__mrDiag.screenLive === true);
  await Promise.all(clients.slice(1).map(({ page }) => page.waitForFunction(() => window.__mrDiag.stageVideoTracks === 1, null, { timeout: 30_000 })));

  await host.click('#chat-button');
  await host.fill('#chat-input', 'Hallo @Guest 9, der Raum ist mit zehn Personen live.');
  await host.click('.send-button');
  await clients[9].page.waitForSelector('.message.mentioned .message-text', { timeout: 15_000 });

  const diagnostics = await Promise.all(clients.map(({ page }) => page.evaluate(() => window.__mrDiag)));
  assert.equal(diagnostics.length, 10);
  assert.ok(diagnostics.every(diag => diag.people === 10 && diag.connectedPeers === 9 && diag.openChannels === 9));
  assert.ok(diagnostics.slice(1).every(diag => diag.remoteAudioElements === 1 && diag.stageVideoTracks === 1));
  assert.deepEqual(errors, []);
  await host.screenshot({ path: fileURLToPath(new URL(`ten-person-${live ? 'live' : 'local'}.png`, output)), fullPage: true });
  console.log('ten-person-smoke: ok', JSON.stringify({ live, room, people: 10, peerConnections: 90, hostAudioRecipients: 9, hostScreenRecipients: 9, mention: true }));
} finally {
  await Promise.all(clients.map(({ context }) => context.close().catch(() => {})));
  await browser.close();
}
