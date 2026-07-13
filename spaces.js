const ROOMS_DB_URL = '/_db/spaces/rooms';
const POLL_INTERVAL = 5_000;
const LAST_SPACES_KEY = 'metaverse-reloaded:last-spaces';
const MAX_RECENT_SPACES = 8;

const elements = {
  syncState: document.querySelector('#sync-state'),
  syncLabel: document.querySelector('#sync-label'),
  publicGrid: document.querySelector('#public-spaces'),
  publicState: document.querySelector('#public-state'),
  publicCount: document.querySelector('#public-count'),
  recentGrid: document.querySelector('#recent-spaces'),
  recentEmpty: document.querySelector('#recent-empty'),
  recentCount: document.querySelector('#recent-count'),
  template: document.querySelector('#space-card-template')
};

let refreshing = false;

function clean(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roomIdOf(value) {
  return clean(value?.room_id ?? value?.roomId, 120);
}

function normalizeRoom(row, recent = false) {
  const roomId = roomIdOf(row);
  const createdAt = clean(row?.created_at ?? row?._created_at, 40);
  const visitedAt = clean(row?.visitedAt ?? row?.visited_at, 40);
  return {
    roomId,
    title: clean(row?.title, 140) || `Space ${roomId.slice(0, 8)}`,
    status: clean(row?.status, 30).toLowerCase(),
    createdAt,
    visitedAt,
    sortTime: timestamp(recent ? visitedAt : createdAt)
  };
}

function deepLink(roomId) {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('room', roomId);
  return url.href;
}

function readableDate(iso, prefix) {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return prefix ? `${prefix} unbekannt` : '';
  const date = new Intl.DateTimeFormat('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(value);
  return prefix ? `${prefix} ${date}` : date;
}

function newestRooms(rows) {
  const latest = new Map();
  for (const raw of rows) {
    const room = normalizeRoom(raw);
    if (!room.roomId) continue;
    const previous = latest.get(room.roomId);
    if (!previous || room.sortTime >= previous.sortTime) latest.set(room.roomId, room);
  }
  return [...latest.values()]
    .filter(room => !room.status || room.status === 'active')
    .sort((a, b) => b.sortTime - a.sortTime || a.title.localeCompare(b.title, 'de'));
}

function recentRooms() {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_SPACES_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    const latest = new Map();
    for (const raw of stored) {
      const room = normalizeRoom(raw, true);
      if (!room.roomId) continue;
      const previous = latest.get(room.roomId);
      if (!previous || room.sortTime >= previous.sortTime) latest.set(room.roomId, room);
    }
    return [...latest.values()].sort((a, b) => b.sortTime - a.sortTime).slice(0, MAX_RECENT_SPACES);
  } catch {
    return [];
  }
}

async function copyDeepLink(room, button, status) {
  const link = deepLink(room.roomId);
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = 'Kopiert';
    status.textContent = 'Deep Link kopiert.';
  } catch {
    status.textContent = 'Kopieren nicht möglich.';
  }
  window.setTimeout(() => {
    button.textContent = 'Link kopieren';
    status.textContent = '';
  }, 2_000);
}

function createSpaceCard(room, recent = false) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.dataset.roomId = room.roomId;
  if (recent) {
    card.dataset.recent = 'true';
    card.querySelector('.live-badge').lastChild.textContent = ' Zuletzt besucht';
  }
  card.querySelector('h3').textContent = room.title;
  card.querySelector('.room-id').textContent = `Raum-ID: ${room.roomId}`;
  const time = card.querySelector('time');
  const dateValue = recent ? room.visitedAt : room.createdAt;
  time.dateTime = dateValue;
  time.textContent = readableDate(dateValue, recent ? 'Besucht' : 'Erstellt');
  const link = card.querySelector('.join-link');
  link.href = deepLink(room.roomId);
  link.setAttribute('aria-label', `${room.title} betreten`);
  const copyButton = card.querySelector('.copy-link');
  const copyStatus = card.querySelector('.copy-status');
  copyButton.addEventListener('click', () => copyDeepLink(room, copyButton, copyStatus));
  return card;
}

function renderPublic(rooms) {
  elements.publicGrid.replaceChildren(...rooms.map(room => createSpaceCard(room)));
  elements.publicGrid.setAttribute('aria-busy', 'false');
  elements.publicCount.textContent = String(rooms.length);
  elements.publicState.hidden = rooms.length > 0;
  elements.publicState.textContent = rooms.length ? '' : 'Aktuell sind keine öffentlichen Spaces aktiv.';
}

function renderRecent() {
  const rooms = recentRooms();
  elements.recentGrid.replaceChildren(...rooms.map(room => createSpaceCard(room, true)));
  elements.recentCount.textContent = String(rooms.length);
  elements.recentEmpty.hidden = rooms.length > 0;
}

function setSync(mode, label) {
  elements.syncState.classList.toggle('synced', mode === 'synced');
  elements.syncState.classList.toggle('error', mode === 'error');
  elements.syncLabel.textContent = label;
}

async function fetchRooms() {
  const response = await fetch(`${ROOMS_DB_URL}?limit=1000`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Datenbank antwortet mit ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.rows || []);
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  renderRecent();
  try {
    renderPublic(newestRooms(await fetchRooms()));
    setSync('synced', 'Live synchronisiert');
  } catch (error) {
    elements.publicGrid.setAttribute('aria-busy', 'false');
    elements.publicState.hidden = false;
    elements.publicState.textContent = 'Die Space-Liste konnte nicht geladen werden.';
    setSync('error', error.message);
  } finally {
    refreshing = false;
  }
}

refresh();
window.setInterval(refresh, POLL_INTERVAL);
window.addEventListener('storage', event => {
  if (event.key === LAST_SPACES_KEY) renderRecent();
});
