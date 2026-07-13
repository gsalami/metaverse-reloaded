import {
  supabase,
  isSupabaseConfigured,
  signInWithMagicLink,
  signOut,
  getSession,
  onAuthStateChange
} from './supabase-client.js';

const ROOMS_DB_URL = '/_db/spaces/rooms';
const POLL_INTERVAL = 5_000;
const LAST_SPACES_KEY = 'metaverse-reloaded:last-spaces';
const MAX_RECENT_SPACES = 8;
const TEMPLATE_LABELS = Object.freeze({
  'neon-stage': 'Neon Arena',
  'alpine-summit': 'Alpine Lodge',
  'tropical-island': 'Tropical Pavilion',
  'mars-base': 'Mars Habitat',
  'cyber-city': 'Cyber Gallery',
  'zen-garden': 'Zen Courtyard',
  'moon-station': 'Lunar Observatory',
  'ocean-dome': 'Ocean Dome',
  'desert-festival': 'Desert Festival',
  'arctic-aurora': 'Arctic Ice Hall'
});

const elements = {
  syncState: document.querySelector('#sync-state'),
  syncLabel: document.querySelector('#sync-label'),
  publicGrid: document.querySelector('#public-spaces'),
  publicState: document.querySelector('#public-state'),
  publicCount: document.querySelector('#public-count'),
  recentGrid: document.querySelector('#recent-spaces'),
  recentEmpty: document.querySelector('#recent-empty'),
  recentCount: document.querySelector('#recent-count'),
  ownSection: document.querySelector('#own-section'),
  ownGrid: document.querySelector('#own-spaces'),
  ownState: document.querySelector('#own-state'),
  ownCount: document.querySelector('#own-count'),
  publicTemplate: document.querySelector('#space-card-template'),
  ownTemplate: document.querySelector('#own-space-card-template'),
  magicLinkForm: document.querySelector('#magic-link-form'),
  accountEmail: document.querySelector('#account-email'),
  accountStatus: document.querySelector('#account-status'),
  signedIn: document.querySelector('#signed-in'),
  accountIdentity: document.querySelector('#account-identity'),
  signOut: document.querySelector('#sign-out'),
  editDialog: document.querySelector('#edit-dialog'),
  editForm: document.querySelector('#edit-form'),
  editRoomId: document.querySelector('#edit-room-id'),
  editTitle: document.querySelector('#edit-title-field'),
  editTemplate: document.querySelector('#edit-template'),
  editStatus: document.querySelector('#edit-status'),
  editStatusMessage: document.querySelector('#edit-status-message'),
  deleteDialog: document.querySelector('#delete-dialog'),
  deleteForm: document.querySelector('#delete-form'),
  deleteRoomId: document.querySelector('#delete-room-id'),
  deleteSpaceName: document.querySelector('#delete-space-name'),
  deleteStatusMessage: document.querySelector('#delete-status-message'),
  inviteCodesDialog: document.querySelector('#invite-codes-dialog'),
  newGuestCode: document.querySelector('#new-guest-code'),
  newCohostCode: document.querySelector('#new-cohost-code'),
  inviteCodesStatus: document.querySelector('#invite-codes-status')
};

let refreshing = false;
let currentUser = null;
let ownRooms = [];

function clean(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roomIdOf(value) {
  return clean(value?.room_id ?? value?.roomId ?? value?.space_id ?? value?.id, 120);
}

function normalizeRoom(row, recent = false) {
  const roomId = roomIdOf(row);
  const createdAt = clean(row?.created_at ?? row?._created_at, 40);
  const visitedAt = clean(row?.visitedAt ?? row?.visited_at, 40);
  return {
    roomId,
    title: clean(row?.name ?? row?.title, 140) || `Space ${roomId.slice(0, 8)}`,
    status: clean(row?.status, 30).toLowerCase() || 'active',
    templateId: clean(row?.template_id ?? row?.templateId, 50) || 'neon-stage',
    ownerId: clean(row?.owner_id ?? row?.ownerId, 80),
    maxUsers: Number(row?.max_users ?? row?.maxUsers) || 25,
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

function randomInviteSegment(length = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
}

function newInviteCode(role) {
  return `${role === 'cohost' ? 'COHOST' : 'GUEST'}-${randomInviteSegment()}-${randomInviteSegment()}`;
}

async function hashInviteCode(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).trim().toUpperCase()));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
    .filter(room => room.status === 'active')
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
  const card = elements.publicTemplate.content.firstElementChild.cloneNode(true);
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

function createOwnSpaceCard(room) {
  const card = elements.ownTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.roomId = room.roomId;
  card.dataset.status = room.status;
  card.querySelector('.status-label').textContent = room.status === 'active' ? 'Aktiv' : 'Archiviert';
  card.querySelector('h3').textContent = room.title;
  card.querySelector('.room-id').textContent = `Raum-ID: ${room.roomId}`;
  card.querySelector('.template-label').textContent = `Architektur: ${TEMPLATE_LABELS[room.templateId] || room.templateId}`;
  const time = card.querySelector('time');
  time.dateTime = room.createdAt;
  time.textContent = readableDate(room.createdAt, 'Erstellt');
  const link = card.querySelector('.join-link');
  link.href = deepLink(room.roomId);
  link.setAttribute('aria-label', `${room.title} öffnen`);
  card.querySelector('.edit-space').addEventListener('click', () => openEditDialog(room));
  card.querySelector('.rotate-invites').addEventListener('click', () => rotateInviteCodes(room));
  card.querySelector('.delete-space').addEventListener('click', () => openDeleteDialog(room));
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

function renderOwn(rooms) {
  elements.ownGrid.replaceChildren(...rooms.map(createOwnSpaceCard));
  elements.ownGrid.setAttribute('aria-busy', 'false');
  elements.ownCount.textContent = String(rooms.length);
  elements.ownState.hidden = rooms.length > 0;
  elements.ownState.textContent = rooms.length ? '' : 'Du hast noch keine eigenen Spaces.';
}

function setSync(mode, label) {
  elements.syncState.classList.toggle('synced', mode === 'synced');
  elements.syncState.classList.toggle('error', mode === 'error');
  elements.syncLabel.textContent = label;
}

function setAccountStatus(message = '', error = false) {
  elements.accountStatus.textContent = message;
  elements.accountStatus.classList.toggle('error', error);
}

async function fetchLegacyRooms() {
  const response = await fetch(`${ROOMS_DB_URL}?limit=1000`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Datenbank antwortet mit ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.rows || []);
}

async function fetchPublicRooms() {
  if (!isSupabaseConfigured()) return fetchLegacyRooms();
  const { data, error } = await supabase.rpc('public_list_spaces');
  if (error) return fetchLegacyRooms();
  return Array.isArray(data) ? data : [];
}

async function fetchOwnRooms() {
  if (!currentUser || !isSupabaseConfigured()) return [];
  elements.ownGrid.setAttribute('aria-busy', 'true');
  const { data, error } = await supabase
    .from('spaces')
    .select('id,name,template_id,status,owner_id,max_users,created_at,updated_at')
    .eq('owner_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => normalizeRoom(row));
}

async function refreshPublic() {
  renderPublic(newestRooms(await fetchPublicRooms()));
  setSync('synced', 'Live synchronisiert');
}

async function refreshOwn() {
  if (!currentUser) return;
  try {
    ownRooms = await fetchOwnRooms();
    renderOwn(ownRooms);
  } catch (error) {
    elements.ownGrid.setAttribute('aria-busy', 'false');
    elements.ownState.hidden = false;
    elements.ownState.textContent = 'Deine Spaces konnten nicht geladen werden.';
    setAccountStatus(error.message || 'Deine Spaces konnten nicht geladen werden.', true);
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  renderRecent();
  try {
    await refreshPublic();
  } catch (error) {
    elements.publicGrid.setAttribute('aria-busy', 'false');
    elements.publicState.hidden = false;
    elements.publicState.textContent = 'Die Space-Liste konnte nicht geladen werden.';
    setSync('error', error.message);
  } finally {
    refreshing = false;
  }
}

function sessionFrom(value) {
  return value?.data?.session ?? value?.session ?? value ?? null;
}

async function applySession(sessionValue) {
  const session = sessionFrom(sessionValue);
  currentUser = session?.user || null;
  elements.magicLinkForm.hidden = Boolean(currentUser);
  elements.signedIn.hidden = !currentUser;
  elements.ownSection.hidden = !currentUser;
  elements.accountIdentity.textContent = currentUser?.email || '';
  if (currentUser) {
    setAccountStatus('Erfolgreich angemeldet.');
    await refreshOwn();
  } else {
    ownRooms = [];
    renderOwn([]);
    setAccountStatus('');
  }
}

async function initializeAccount() {
  if (!isSupabaseConfigured()) {
    elements.magicLinkForm.hidden = true;
    setAccountStatus('Die Account-Funktion wird gerade eingerichtet. Die öffentliche Liste bleibt verfügbar.');
    return;
  }
  try {
    await applySession(await getSession());
    onAuthStateChange((...args) => {
      const session = args.length > 1 ? args[1] : args[0];
      window.setTimeout(() => applySession(session), 0);
    });
  } catch (error) {
    setAccountStatus(error.message || 'Der Account-Status konnte nicht geladen werden.', true);
  }
}

elements.magicLinkForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = clean(elements.accountEmail.value, 254).toLowerCase();
  const button = elements.magicLinkForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setAccountStatus('Magic Link wird gesendet…');
  try {
    const result = await signInWithMagicLink(email, new URL('/spaces.html', window.location.origin).href);
    if (result?.error) throw result.error;
    elements.accountEmail.value = '';
    setAccountStatus(`Magic Link an ${email} gesendet. Bitte prüfe dein Postfach.`);
  } catch (error) {
    setAccountStatus(error.message || 'Magic Link konnte nicht gesendet werden.', true);
  } finally {
    button.disabled = false;
  }
});

elements.signOut.addEventListener('click', async () => {
  elements.signOut.disabled = true;
  setAccountStatus('Du wirst abgemeldet…');
  try {
    const result = await signOut();
    if (result?.error) throw result.error;
    await applySession(null);
  } catch (error) {
    setAccountStatus(error.message || 'Abmelden ist fehlgeschlagen.', true);
  } finally {
    elements.signOut.disabled = false;
  }
});

function ensureSelectOption(select, value) {
  if ([...select.options].some(option => option.value === value)) return;
  select.add(new Option(value, value));
}

function openEditDialog(room) {
  elements.editRoomId.value = room.roomId;
  elements.editTitle.value = room.title;
  ensureSelectOption(elements.editTemplate, room.templateId);
  elements.editTemplate.value = room.templateId;
  elements.editStatus.value = room.status;
  elements.editStatusMessage.textContent = '';
  elements.editStatusMessage.classList.remove('error');
  elements.editDialog.showModal();
}

function openDeleteDialog(room) {
  elements.deleteRoomId.value = room.roomId;
  elements.deleteSpaceName.textContent = room.title;
  elements.deleteStatusMessage.textContent = '';
  elements.deleteStatusMessage.classList.remove('error');
  elements.deleteDialog.showModal();
}

async function rotateInviteCodes(room) {
  if (!currentUser || !window.confirm(`Neue Invite-Codes für „${room.title}“ erstellen? Die bisherigen Codes werden ungültig.`)) return;
  const guest = newInviteCode('guest');
  const cohost = newInviteCode('cohost');
  elements.inviteCodesStatus.textContent = 'Neue Codes werden erstellt…';
  try {
    const [guestHash, cohostHash] = await Promise.all([hashInviteCode(guest), hashInviteCode(cohost)]);
    const { data, error } = await supabase.rpc('rotate_space_invites', {
      p_space_id: room.roomId,
      p_guest_code_hash: guestHash,
      p_cohost_code_hash: cohostHash
    });
    if (error) throw error;
    if (data !== true) throw new Error('Der Space konnte deinem Account nicht zugeordnet werden.');
    elements.newGuestCode.textContent = guest;
    elements.newCohostCode.textContent = cohost;
    elements.inviteCodesStatus.textContent = 'Codes erfolgreich erneuert.';
    localStorage.setItem(`mr-room-owner:${room.roomId}`, JSON.stringify({ guest, cohost, title: room.title }));
    elements.inviteCodesDialog.showModal();
  } catch (error) {
    setAccountStatus(error.message || 'Invite-Codes konnten nicht erneuert werden.', true);
  }
}

document.querySelectorAll('[data-close-dialog]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

for (const dialog of [elements.editDialog, elements.deleteDialog, elements.inviteCodesDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}

document.querySelectorAll('[data-copy-code]').forEach(button => {
  button.addEventListener('click', async () => {
    const code = document.querySelector(`#${button.dataset.copyCode}`)?.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      elements.inviteCodesStatus.textContent = 'Code kopiert.';
    } catch {
      elements.inviteCodesStatus.textContent = 'Kopieren nicht möglich.';
    }
  });
});

elements.editForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = elements.editForm.querySelector('button[type="submit"]');
  const roomId = clean(elements.editRoomId.value, 120);
  const updates = {
    name: clean(elements.editTitle.value, 120),
    template_id: clean(elements.editTemplate.value, 50),
    status: clean(elements.editStatus.value, 30),
    updated_at: new Date().toISOString()
  };
  submit.disabled = true;
  elements.editStatusMessage.textContent = 'Änderungen werden gespeichert…';
  elements.editStatusMessage.classList.remove('error');
  try {
    const { error } = await supabase.from('spaces').update(updates).eq('id', roomId).eq('owner_id', currentUser.id);
    if (error) throw error;
    elements.editStatusMessage.textContent = 'Gespeichert.';
    await Promise.all([refreshOwn(), refreshPublic()]);
    window.setTimeout(() => elements.editDialog.open && elements.editDialog.close(), 550);
  } catch (error) {
    elements.editStatusMessage.textContent = error.message || 'Änderungen konnten nicht gespeichert werden.';
    elements.editStatusMessage.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});

elements.deleteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = elements.deleteForm.querySelector('button[type="submit"]');
  const roomId = clean(elements.deleteRoomId.value, 120);
  submit.disabled = true;
  elements.deleteStatusMessage.textContent = 'Space wird gelöscht…';
  elements.deleteStatusMessage.classList.remove('error');
  try {
    const { error } = await supabase.from('spaces').delete().eq('id', roomId).eq('owner_id', currentUser.id);
    if (error) throw error;
    elements.deleteDialog.close();
    await Promise.all([refreshOwn(), refreshPublic()]);
    setAccountStatus('Space wurde gelöscht.');
  } catch (error) {
    elements.deleteStatusMessage.textContent = error.message || 'Space konnte nicht gelöscht werden.';
    elements.deleteStatusMessage.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});

refresh();
initializeAccount();
window.setInterval(refresh, POLL_INTERVAL);
window.addEventListener('storage', event => {
  if (event.key === LAST_SPACES_KEY) renderRecent();
});
