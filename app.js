import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DB_PATHS = {
  presence: '/_db/presence/presence',
  messages: '/_db/chat/messages',
  signals: '/_db/realtime/signals',
  rooms: '/_db/spaces/rooms',
  roomTemplates: '/_db/spaces/room_templates',
  portals: '/_db/spaces/portals',
  avatars: '/_db/profiles/avatars'
};
const MAX_PEOPLE = 25;
const SEAT_ROWS = [
  { count: 7, radius: 9.4, start: .16, span: .68, zOffset: 2.1 },
  { count: 8, radius: 12.2, start: .14, span: .72, zOffset: 2.5 },
  { count: 10, radius: 15.2, start: .12, span: .76, zOffset: 2.9 }
];
const MAIN_STAGE_SCREEN_POSITION = Object.freeze({ x: 0, z: -11 });
const PRESENCE_TTL = 12_000;
const HEARTBEAT_MS = 4_000;
const POLL_PRESENCE_MS = 2_000;
const POLL_SIGNALS_MS = 750;
const POLL_CHAT_MS = 1_500;
const POLL_PORTALS_MS = 4_000;
const AVATAR_STORAGE_KEY = 'mr-avatar-profile';
const LAST_SPACES_KEY = 'metaverse-reloaded:last-spaces';
const MAX_RECENT_SPACES = 8;
const DEFAULT_SPACE_TEMPLATE = 'neon-stage';
const ROOM_NAME_PREFIXES = Object.freeze(['Aurora', 'Cosmic', 'Electric', 'Lunar', 'Nova', 'Orbit', 'Pixel', 'Solar', 'Stellar', 'Velvet']);
const ROOM_NAME_PLACES = Object.freeze(['Arena', 'Atelier', 'Garden', 'Lounge', 'Studio', 'Forum', 'Lab', 'Loft', 'Plaza', 'Stage']);
const SPACE_TEMPLATES = Object.freeze({
  'neon-stage': { label: 'Neon Arena', architecture: 'neon-arena', stageVariant: 'arena', floorShape: 'rect', floorSize: [44, 34], bounds: [-20.5, 20.5, -7.5, 21], background: 0x05070d, fog: 0x070a12, fogDensity: .018, floor: 0x0a0e19, grid: 0x365b87, gridSecondary: 0x172337, primary: 0x56dfff, secondary: 0x7565ff, sky: 0xb9d9ff, ground: 0x080a12, key: 0xaad8ff, decor: 'city' },
  'alpine-summit': { label: 'Alpine Lodge', architecture: 'alpine-lodge', stageVariant: 'lodge', floorShape: 'rect', floorSize: [38, 34], bounds: [-17.5, 17.5, -7.3, 19], background: 0x24343b, fog: 0x8199a0, fogDensity: .012, floor: 0x594331, grid: 0xd7c6a5, gridSecondary: 0x6b5542, primary: 0xffd89a, secondary: 0x8fc6dc, sky: 0xe9f6ff, ground: 0x27343a, key: 0xffe4bd, decor: 'alpine' },
  'tropical-island': { label: 'Tropical Pavilion', architecture: 'island-pavilion', stageVariant: 'pavilion', floorShape: 'circle', floorSize: [52, 46], bounds: [-22, 22, -8, 22], background: 0x3aa8c7, fog: 0x8ee5e0, fogDensity: .01, floor: 0xd5b66d, grid: 0xffe2a2, gridSecondary: 0x5e9e87, primary: 0x54ffd0, secondary: 0xffbf5b, sky: 0xd8ffff, ground: 0x245a5a, key: 0xfff2c7, decor: 'tropical' },
  'mars-base': { label: 'Mars Habitat', architecture: 'mars-habitat', stageVariant: 'command', floorShape: 'hex', floorSize: [48, 38], bounds: [-21.5, 21.5, -8.5, 20], background: 0x2d0d0a, fog: 0x5b2118, fogDensity: .02, floor: 0x4d2019, grid: 0xff7b52, gridSecondary: 0x6b2c24, primary: 0xff744d, secondary: 0xffc16b, sky: 0xffb08c, ground: 0x1b0808, key: 0xffd0ae, decor: 'mars' },
  'cyber-city': { label: 'Cyber Gallery', architecture: 'cyber-gallery', stageVariant: 'gallery', floorShape: 'rect', floorSize: [56, 34], bounds: [-25, 25, -7.3, 19], background: 0x080313, fog: 0x170725, fogDensity: .022, floor: 0x100b1c, grid: 0xff3edf, gridSecondary: 0x302052, primary: 0x00f7ff, secondary: 0xff39d4, sky: 0x9ddcff, ground: 0x12051d, key: 0xe4c1ff, decor: 'cyber' },
  'zen-garden': { label: 'Zen Courtyard', architecture: 'zen-courtyard', stageVariant: 'tea', floorShape: 'rect', floorSize: [42, 44], bounds: [-19, 19, -8, 24], background: 0x18231d, fog: 0x42584b, fogDensity: .017, floor: 0x7d806b, grid: 0xc8d2ad, gridSecondary: 0x596254, primary: 0xd6edb2, secondary: 0xc98a67, sky: 0xdcebd0, ground: 0x1d2b22, key: 0xfff2d8, decor: 'zen' },
  'moon-station': { label: 'Lunar Observatory', architecture: 'lunar-observatory', stageVariant: 'observatory', floorShape: 'circle', floorSize: [44, 40], bounds: [-20, 20, -8.5, 21], background: 0x010207, fog: 0x080b15, fogDensity: .009, floor: 0x686d78, grid: 0xcbd3e4, gridSecondary: 0x333a49, primary: 0xdce8ff, secondary: 0x5d7fff, sky: 0xd9e7ff, ground: 0x03040a, key: 0xffffff, decor: 'moon' },
  'ocean-dome': { label: 'Ocean Dome', architecture: 'ocean-dome', stageVariant: 'dome', floorShape: 'circle', floorSize: [50, 46], bounds: [-22, 22, -8, 22], background: 0x001b2b, fog: 0x063a49, fogDensity: .024, floor: 0x123c46, grid: 0x57dbdc, gridSecondary: 0x1a5662, primary: 0x64fff1, secondary: 0x4c79ff, sky: 0x7defff, ground: 0x001219, key: 0xb9ffff, decor: 'ocean' },
  'desert-festival': { label: 'Desert Festival', architecture: 'desert-festival', stageVariant: 'festival', floorShape: 'rect', floorSize: [58, 40], bounds: [-27, 27, -9, 23], background: 0x3b1d16, fog: 0xa95b36, fogDensity: .013, floor: 0x9b633c, grid: 0xffc879, gridSecondary: 0x76462e, primary: 0xffd26f, secondary: 0xff5e74, sky: 0xffd4a4, ground: 0x3c2116, key: 0xffead0, decor: 'desert' },
  'arctic-aurora': { label: 'Arctic Ice Hall', architecture: 'arctic-hall', stageVariant: 'ice', floorShape: 'rect', floorSize: [46, 38], bounds: [-21, 21, -8, 22], background: 0x061323, fog: 0x1a4051, fogDensity: .016, floor: 0x92b8c4, grid: 0xb9ffff, gridSecondary: 0x426b7c, primary: 0x5dffd2, secondary: 0xa274ff, sky: 0xcaffff, ground: 0x0a2430, key: 0xeaffff, decor: 'arctic' }
});
const HAIR_STYLES = new Set(['none', 'short', 'bob', 'mohawk']);
const OUTFIT_STYLES = new Set(['rogue', 'explorer', 'cyber']);
const DEFAULT_AVATAR_PROFILE = Object.freeze({
  primaryColor: '#8c6cff',
  hairStyle: 'short',
  hairColor: '#30243b',
  outfitStyle: 'rogue'
});
const COLORS = ['#8cf6ff', '#8c6cff', '#ec78c5', '#6fffc2', '#f6c76f', '#6aa3ff', '#ff8f7f', '#c7ff74', '#bb8cff', '#75e6d0'];
const EMOTES = {
  clap: { emoji: '👏', duration: 2_200, count: 4 },
  hearts: { emoji: '❤️', duration: 2_600, count: 6 },
  celebrate: { emoji: '🙌', duration: 2_400, count: 5 },
  wave: { emoji: '👋', duration: 2_000, count: 3 },
  laugh: { emoji: '😂', duration: 2_300, count: 4 }
};
const GRAVITY = 16.5;
const FIRST_JUMP_VELOCITY = 7.1;
const DOUBLE_JUMP_VELOCITY = 6.4;
const CAMERA_FOLLOW_DAMPING = 12;
const MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;

const state = {
  clientId: crypto.randomUUID(),
  eventId: '',
  roomTitle: '',
  templateId: DEFAULT_SPACE_TEMPLATE,
  roomOwner: false,
  inviteCodes: null,
  entryMode: new URLSearchParams(location.search).has('room') ? 'public' : new URLSearchParams(location.search).has('invite') ? 'join' : 'create',
  publicAccess: null,
  name: '',
  role: 'guest',
  color: '',
  avatarProfile: { ...DEFAULT_AVATAR_PROFILE },
  avatarProfiles: new Map(),
  joined: false,
  peers: new Map(),
  people: new Map(),
  processedSignals: new Set(),
  renderedMessages: new Set(),
  pendingCandidates: new Map(),
  keys: new Set(),
  micStream: null,
  screenStream: null,
  roomLocked: false,
  seatAssignments: new Map(),
  nearbyPortalId: '',
  portalTravelling: false,
  unread: 0,
  intervals: [],
  lastMoveBroadcast: 0,
  cameraYaw: Math.PI,
  cameraPitch: .42,
  cameraDistance: MOBILE ? 11.5 : 11,
  movementReferenceYaw: null,
  moving: false,
  dragging: false,
  dragX: 0,
  dragY: 0,
  audioBlocked: false
};

const ui = {
  canvas: $('#world'),
  join: $('#join-dialog'),
  joinForm: $('#join-form'),
  joinError: $('#join-error'),
  name: $('#display-name'),
  roomName: $('#room-name'),
  inviteCode: $('#invite-code'),
  avatarCustomizer: $('#avatar-customizer'),
  avatarPreview: $('#avatar-preview'),
  primaryColor: $('#avatar-primary-color'),
  hairColor: $('#avatar-hair-color'),
  createPanel: $('#create-panel'),
  joinPanel: $('#join-panel'),
  publicRoomPanel: $('#public-room-panel'),
  publicRoomTitle: $('#public-room-title'),
  entryTabs: $('.entry-tabs'),
  createMode: $('#create-mode-button'),
  joinMode: $('#join-mode-button'),
  enterLabel: $('.enter-button span'),
  inviteDialog: $('#invite-dialog'),
  guestInviteCode: $('#guest-invite-code'),
  cohostInviteCode: $('#cohost-invite-code'),
  eventLabel: $('#event-label'),
  capacity: $('#capacity-count'),
  stack: $('#avatar-stack'),
  peoplePanel: $('#people-panel'),
  peopleList: $('#people-list'),
  chatPanel: $('#chat-panel'),
  messages: $('#messages'),
  chatRoomScope: $('#chat-room-scope'),
  chatForm: $('#chat-form'),
  chatInput: $('#chat-input'),
  mentions: $('#mention-suggestions'),
  mic: $('#mic-button'),
  share: $('#share-button'),
  people: $('#people-button'),
  chat: $('#chat-button'),
  invite: $('#invite-button'),
  emote: $('#emote-button'),
  emoteTray: $('#emote-tray'),
  hostRoomControls: $('#host-room-controls'),
  seatAll: $('#seat-all-button'),
  lockSeats: $('#lock-seats-button'),
  unlockSeats: $('#unlock-seats-button'),
  portalsButton: $('#portals-button'),
  portalDialog: $('#portal-dialog'),
  portalForm: $('#portal-form'),
  portalLabel: $('#portal-label'),
  portalTargetCode: $('#portal-target-code'),
  portalError: $('#portal-error'),
  portalList: $('#portal-list'),
  portalPrompt: $('#portal-prompt'),
  portalPromptLabel: $('#portal-prompt-label'),
  roomArrival: $('#room-arrival'),
  roomArrivalTitle: $('#room-arrival-title'),
  unread: $('#unread-badge'),
  mediaStage: $('#media-stage'),
  stageVideo: $('#stage-video'),
  notifications: $('#notifications'),
  help: $('#help-dialog')
};

function syncJoinViewport() {
  const viewport = window.visualViewport;
  const height = Math.max(260, Math.round(viewport?.height || window.innerHeight));
  const top = Math.max(0, Math.round(viewport?.offsetTop || 0));
  document.documentElement.style.setProperty('--join-vv-height', `${height}px`);
  document.documentElement.style.setProperty('--join-vv-top', `${top}px`);
  if (!ui.join.open || !ui.joinForm.contains(document.activeElement) || !document.activeElement.matches('input')) return;
  const target = document.activeElement;
  requestAnimationFrame(() => {
    const entryPanel = target.closest('.entry-panel');
    (entryPanel || target).scrollIntoView({ block: entryPanel ? 'start' : 'center', inline: 'nearest', behavior: 'auto' });
  });
}

function cleanRoom(value) {
  const safe = String(value || 'main-stage').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (safe || 'main-stage').slice(0, 32);
}

function isHostRole(...roles) {
  const role = roles.length ? roles[0] : state.role;
  return role === 'host' || role === 'cohost';
}

function roleRank(role) {
  return role === 'host' ? 0 : role === 'cohost' ? 1 : 2;
}

function roleLabel(role) {
  return role === 'host' ? 'HOST / LIVE' : role === 'cohost' ? 'COHOST / LIVE' : 'GUEST';
}

function randomSegment(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
}

function randomItem(items) {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return items[value % items.length];
}

function newSuggestedRoomTitle() {
  return `${randomItem(ROOM_NAME_PREFIXES)} ${randomItem(ROOM_NAME_PLACES)} ${randomSegment(6)}`;
}

function setSuggestedRoomTitle() {
  const title = newSuggestedRoomTitle();
  ui.roomName.value = title;
  ui.roomName.dataset.generatedRoomName = title;
}

function newInviteCode(role) {
  return `${role === 'cohost' ? 'COHOST' : 'GUEST'}-${randomSegment(4)}-${randomSegment(4)}`;
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[–—−]/g, '-').replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-');
}

function normalizeSpaceTemplate(value) {
  return Object.hasOwn(SPACE_TEMPLATES, value) ? value : DEFAULT_SPACE_TEMPLATE;
}

async function loadRoomTemplate(roomId) {
  try {
    const rows = await dbGet('roomTemplates', { room_id: roomId }, 20);
    const latest = rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    return normalizeSpaceTemplate(latest?.template_id);
  } catch (error) {
    console.warn('[room-template]', error);
    return DEFAULT_SPACE_TEMPLATE;
  }
}

async function saveRoomTemplate(roomId, templateId) {
  const row = { room_id: roomId, template_id: normalizeSpaceTemplate(templateId), updated_at: new Date().toISOString() };
  await dbPost('roomTemplates', row);
  return row.template_id;
}

async function hashInviteCode(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeInviteCode(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function createUniqueRoom(title, templateId = DEFAULT_SPACE_TEMPLATE, generatedTitle = false) {
  let roomTitle = String(title || '').trim().replace(/\s+/g, ' ');
  if (roomTitle.length < 2) throw new Error('Bitte gib deinem Raum einen Namen mit mindestens zwei Zeichen.');
  if (generatedTitle) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const titleCollision = await dbGet('rooms', { title: roomTitle, status: 'active' }, 1);
      if (!titleCollision.length) break;
      roomTitle = newSuggestedRoomTitle();
      if (attempt === 5) throw new Error('Der eindeutige Raumname konnte nicht erzeugt werden. Bitte versuche es nochmals.');
    }
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const guest = newInviteCode('guest');
    const cohost = newInviteCode('cohost');
    const ownerToken = randomSegment(24);
    const roomId = `${cleanRoom(roomTitle).slice(0, 22)}-${randomSegment(6).toLowerCase()}`;
    const [existingRoom, guestCodeHash, cohostCodeHash, ownerTokenHash] = await Promise.all([
      dbGet('rooms', { room_id: roomId }, 1),
      hashInviteCode(guest),
      hashInviteCode(cohost),
      hashInviteCode(ownerToken)
    ]);
    if (existingRoom.length) continue;
    const row = {
      room_id: roomId,
      title: roomTitle.slice(0, 48),
      guest_code_hash: guestCodeHash,
      cohost_code_hash: cohostCodeHash,
      owner_token_hash: ownerTokenHash,
      status: 'active',
      created_at: new Date().toISOString()
    };
    const selectedTemplate = await saveRoomTemplate(roomId, templateId);
    await reliableDbPost('rooms', row, { room_id: roomId });
    const room = { roomId, title: row.title, role: 'host', roomOwner: true, inviteCodes: { guest, cohost }, templateId: selectedTemplate };
    localStorage.setItem(`mr-room-owner:${roomId}`, JSON.stringify({ ...room.inviteCodes, title: room.title }));
    return room;
  }
  throw new Error('Der eindeutige Raum konnte nicht erzeugt werden. Bitte versuche es nochmals.');
}

async function resolveInviteCode(value) {
  const code = normalizeInviteCode(value);
  if (!/^(GUEST|COHOST)-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) throw new Error('Dieser Invite-Code hat kein gültiges Format.');
  const hash = await hashInviteCode(code);
  const field = code.startsWith('COHOST-') ? 'cohost_code_hash' : 'guest_code_hash';
  const rows = await dbGet('rooms', { [field]: hash, status: 'active' }, 2);
  const room = rows[0];
  if (!room) throw new Error('Dieser Invite-Code ist ungültig oder nicht mehr aktiv.');
  const templateId = await loadRoomTemplate(room.room_id);
  return { roomId: room.room_id, title: room.title, role: field === 'cohost_code_hash' ? 'cohost' : 'guest', roomOwner: false, inviteCodes: null, templateId };
}

async function resolvePublicRoom(value) {
  const roomId = String(value || '').trim();
  if (!/^[a-z0-9_-]{3,64}$/i.test(roomId)) throw new Error('Dieser Space-Link ist ungültig.');
  const rows = await dbGet('rooms', { room_id: roomId, status: 'active' }, 2);
  const room = rows[0];
  if (!room) throw new Error('Dieser öffentliche Space ist nicht mehr aktiv.');
  const templateId = await loadRoomTemplate(room.room_id);
  return { roomId: room.room_id, title: room.title, role: 'guest', roomOwner: false, inviteCodes: null, templateId };
}

function rememberVisitedSpace(roomId, title) {
  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_SPACES_KEY) || '[]');
    if (Array.isArray(parsed)) stored = parsed;
  } catch (_) {}
  const visited = {
    roomId: String(roomId),
    title: String(title || roomId).slice(0, 140),
    visitedAt: new Date().toISOString()
  };
  const recent = [visited, ...stored.filter(item => String(item?.roomId ?? item?.room_id) !== visited.roomId)].slice(0, MAX_RECENT_SPACES);
  localStorage.setItem(LAST_SPACES_KEY, JSON.stringify(recent));
}

function showRoomArrival(title) {
  ui.roomArrivalTitle.textContent = `Du bist jetzt in „${title}“`;
  ui.roomArrival.hidden = false;
  clearTimeout(showRoomArrival.timeout);
  showRoomArrival.timeout = setTimeout(() => { ui.roomArrival.hidden = true; }, 10_000);
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

function hashColor(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function safeHexColor(value, fallback) {
  const color = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback;
}

function normalizeAvatarProfile(profile = {}) {
  return {
    primaryColor: safeHexColor(profile.primaryColor ?? profile.primary_color, DEFAULT_AVATAR_PROFILE.primaryColor),
    hairStyle: HAIR_STYLES.has(profile.hairStyle ?? profile.hair_style) ? (profile.hairStyle ?? profile.hair_style) : DEFAULT_AVATAR_PROFILE.hairStyle,
    hairColor: safeHexColor(profile.hairColor ?? profile.hair_color, DEFAULT_AVATAR_PROFILE.hairColor),
    outfitStyle: OUTFIT_STYLES.has(profile.outfitStyle ?? profile.outfit_style) ? (profile.outfitStyle ?? profile.outfit_style) : DEFAULT_AVATAR_PROFILE.outfitStyle
  };
}

function loadAvatarProfile() {
  try {
    return normalizeAvatarProfile(JSON.parse(localStorage.getItem(AVATAR_STORAGE_KEY) || '{}'));
  } catch (_) {
    return { ...DEFAULT_AVATAR_PROFILE };
  }
}

function avatarProfileFromControls() {
  return normalizeAvatarProfile({
    primaryColor: ui.primaryColor.value,
    hairStyle: $('[name="hair-style"]:checked', ui.avatarCustomizer)?.value,
    hairColor: ui.hairColor.value,
    outfitStyle: $('[name="outfit-style"]:checked', ui.avatarCustomizer)?.value
  });
}

function renderAvatarPreview(profile = state.avatarProfile) {
  const safe = normalizeAvatarProfile(profile);
  ui.avatarPreview.dataset.hair = safe.hairStyle;
  ui.avatarPreview.dataset.outfit = safe.outfitStyle;
  ui.avatarPreview.style.setProperty('--avatar-primary', safe.primaryColor);
  ui.avatarPreview.style.setProperty('--avatar-hair', safe.hairColor);
}

function updateAvatarProfileFromControls() {
  state.avatarProfile = avatarProfileFromControls();
  state.color = state.avatarProfile.primaryColor;
  localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(state.avatarProfile));
  renderAvatarPreview();
}

function setAvatarControls(profile) {
  const safe = normalizeAvatarProfile(profile);
  ui.primaryColor.value = safe.primaryColor;
  ui.hairColor.value = safe.hairColor;
  const hair = $(`[name="hair-style"][value="${safe.hairStyle}"]`, ui.avatarCustomizer);
  const outfit = $(`[name="outfit-style"][value="${safe.outfitStyle}"]`, ui.avatarCustomizer);
  if (hair) hair.checked = true;
  if (outfit) outfit.checked = true;
  state.avatarProfile = safe;
  renderAvatarPreview(safe);
}

function latestAvatarProfiles(rows) {
  const latest = new Map();
  for (const row of rows) {
    const time = new Date(row.updated_at || row._created_at || row.created_at).getTime() || 0;
    const current = latest.get(row.client_id);
    if (!current || time >= current.time) latest.set(row.client_id, { time, profile: normalizeAvatarProfile(row) });
  }
  return new Map([...latest].map(([clientId, value]) => [clientId, value.profile]));
}

async function saveAvatarProfile() {
  const profile = normalizeAvatarProfile(state.avatarProfile);
  const updatedAt = new Date().toISOString();
  const row = {
    event_id: state.eventId,
    client_id: state.clientId,
    primary_color: profile.primaryColor,
    hair_style: profile.hairStyle,
    hair_color: profile.hairColor,
    outfit_style: profile.outfitStyle,
    updated_at: updatedAt
  };
  state.avatarProfiles.set(state.clientId, profile);
  try {
    await dbPost('avatars', row);
  } catch (error) {
    console.warn('[avatar-profile]', error);
  }
}

async function fetchAvatarProfiles() {
  const rows = await dbGet('avatars', { event_id: state.eventId }, MAX_PEOPLE * 12);
  return latestAvatarProfiles(rows);
}

function displayTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.rows || payload?.data || payload?.results || [];
}

async function dbGet(table, filters = {}, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit), ...filters });
  const response = await fetch(`${DB_PATHS[table]}?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Daten konnten nicht geladen werden (${response.status})`);
  return getRows(await response.json());
}

async function dbPost(table, row) {
  const response = await fetch(DB_PATHS[table], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row)
  });
  if (!response.ok) throw new Error(`Daten konnten nicht gesendet werden (${response.status})`);
  return response.json();
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function reliableDbPost(table, row, verifyFilters, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await dbPost(table, row);
      await wait(120 + Math.random() * 180);
      const rows = await dbGet(table, verifyFilters, 200);
      if (rows.some(saved => saved.created_at === row.created_at)) return savedResult(rows, row.created_at);
      lastError = new Error('Die Realtime-Nachricht wurde durch einen parallelen Schreibvorgang verdrängt.');
    } catch (error) {
      lastError = error;
    }
    await wait(180 * (attempt + 1) + Math.random() * 260);
  }
  throw lastError || new Error('Realtime-Nachricht konnte nicht bestätigt werden.');
}

function savedResult(rows, createdAt) {
  return rows.find(row => row.created_at === createdAt) || null;
}

function notify(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  ui.notifications.append(toast);
  setTimeout(() => toast.remove(), 4_200);
}

function setButtonLive(button, live, onLabel, offLabel) {
  button.classList.toggle('live-control', live);
  const label = button.querySelector(':scope > span:last-child');
  if (label) label.textContent = live ? onLabel : offLabel;
  button.setAttribute('aria-pressed', String(live));
}

// 3D WORLD
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x070a12, MOBILE ? .025 : .018);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 180);
camera.position.set(0, 7.5, 12);

const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const world = {
  local: null,
  avatars: new Map(),
  animated: [],
  stageMaterial: null,
  effects: [],
  seats: [],
  portals: new Map(),
  stageDefaultTexture: null,
  videoTexture: null,
  model: null,
  clips: [],
  modelPromise: null,
  built: false,
  templateDecorations: 0,
  architectureType: '',
  architectureObjects: [],
  floorArea: 0,
  floorShape: 'rect',
  floorSize: [44, 34],
  roomBounds: { minX: -18.5, maxX: 18.5, minZ: -7.3, maxZ: 18.5, width: 37, depth: 25.8 }
};

function makeFloorGeometry(template) {
  const [width, depth] = template.floorSize;
  if (template.floorShape === 'rect') return new THREE.PlaneGeometry(width, depth, MOBILE ? 1 : 2, MOBILE ? 1 : 2);
  const geometry = new THREE.CircleGeometry(width / 2, template.floorShape === 'hex' ? 6 : MOBILE ? 48 : 96);
  geometry.scale(1, depth / width, 1);
  return geometry;
}

function clampRoomPosition(x, z) {
  const bounds = world.roomBounds;
  let nextX = THREE.MathUtils.clamp(Number(x) || 0, bounds.minX, bounds.maxX);
  let nextZ = THREE.MathUtils.clamp(Number(z) || 0, bounds.minZ, bounds.maxZ);
  if (world.floorShape === 'rect') return { x: nextX, z: nextZ };

  const radiusX = Math.max(1, world.floorSize[0] / 2 - .8);
  const radiusZ = Math.max(1, world.floorSize[1] / 2 - .8);
  const centerZ = 4;
  const normalizedX = nextX / radiusX;
  const normalizedZ = (nextZ - centerZ) / radiusZ;
  const distance = Math.hypot(normalizedX, normalizedZ);
  const limit = world.floorShape === 'hex' ? .84 : .96;
  if (distance > limit) {
    const scale = limit / distance;
    nextX = normalizedX * scale * radiusX;
    nextZ = centerZ + normalizedZ * scale * radiusZ;
  }
  return { x: nextX, z: nextZ };
}

function addWorld(templateId = DEFAULT_SPACE_TEMPLATE) {
  if (world.built) return;
  const template = SPACE_TEMPLATES[normalizeSpaceTemplate(templateId)];
  const [minX, maxX, minZ, maxZ] = template.bounds;
  world.architectureType = template.architecture;
  world.architectureObjects.length = 0;
  world.floorShape = template.floorShape;
  world.floorSize = [...template.floorSize];
  world.roomBounds = { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
  world.floorArea = template.floorShape === 'rect'
    ? template.floorSize[0] * template.floorSize[1]
    : Math.PI * template.floorSize[0] * template.floorSize[1] / 4;
  scene.background = new THREE.Color(template.background);
  scene.fog = new THREE.FogExp2(template.fog, MOBILE ? template.fogDensity * 1.28 : template.fogDensity);
  scene.add(new THREE.HemisphereLight(template.sky, template.ground, 1.45));
  const key = new THREE.DirectionalLight(template.key, MOBILE ? 1.3 : 2.2);
  key.position.set(9, 16, 8);
  key.castShadow = !MOBILE;
  key.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024);
  scene.add(key);
  const cyan = new THREE.PointLight(template.primary, 28, 28, 2);
  cyan.position.set(-7, 5, -5);
  scene.add(cyan);
  const violet = new THREE.PointLight(template.secondary, 25, 26, 2);
  violet.position.set(8, 4, 3);
  scene.add(violet);

  const floor = new THREE.Mesh(
    makeFloorGeometry(template),
    new THREE.MeshStandardMaterial({ color: template.floor, metalness: .64, roughness: .42 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 4;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridSize = Math.max(...template.floorSize) * .9;
  const grid = new THREE.GridHelper(gridSize, MOBILE ? 28 : 48, template.grid, template.gridSecondary);
  grid.scale.z = template.floorSize[1] / template.floorSize[0];
  grid.position.z = 4;
  grid.position.y = .015;
  grid.material.opacity = .22;
  grid.material.transparent = true;
  scene.add(grid);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(7.8, 7.9, 96),
    new THREE.MeshBasicMaterial({ color: template.primary, transparent: true, opacity: .42, side: THREE.DoubleSide })
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = .025;
  scene.add(innerRing);

  const outerMaterial = new THREE.LineBasicMaterial({ color: template.secondary, transparent: true, opacity: .58 });
  const outerRing = template.floorShape === 'rect'
    ? new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(template.floorSize[0] * .92, .02, template.floorSize[1] * .92)), outerMaterial)
    : new THREE.Mesh(new THREE.TorusGeometry(Math.min(...template.floorSize) * .42, .045, 8, MOBILE ? 72 : 144), new THREE.MeshBasicMaterial({ color: template.secondary, transparent: true, opacity: .58 }));
  if (template.floorShape !== 'rect') outerRing.rotation.x = Math.PI / 2;
  outerRing.position.set(0, .05, 4);
  scene.add(outerRing);

  buildRoomArchitecture(template);
  buildStage(template);
  buildSeating(template);
  buildTemplateDecorations(template);
  if (!MOBILE) addParticles(template.primary);
  world.built = true;
}

function registerArchitecture(object, name) {
  object.name = `Architecture:${name}`;
  scene.add(object);
  world.architectureObjects.push(name);
  return object;
}

function architectureBox(name, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = !MOBILE;
  mesh.receiveShadow = true;
  return registerArchitecture(mesh, name);
}

function buildRoomArchitecture(template) {
  const primary = new THREE.MeshStandardMaterial({ color: template.primary, roughness: .42, metalness: .28, emissive: template.primary, emissiveIntensity: .06 });
  const secondary = new THREE.MeshStandardMaterial({ color: template.secondary, roughness: .58, metalness: .18 });
  const dark = new THREE.MeshStandardMaterial({ color: template.ground, roughness: .82, metalness: .08 });
  const glass = new THREE.MeshBasicMaterial({ color: template.primary, transparent: true, opacity: .15, wireframe: true, depthWrite: false, side: THREE.DoubleSide });

  if (template.architecture === 'neon-arena') {
    for (const [index, [x, z]] of [[-21, -5], [21, -5], [-21, 19], [21, 19]].entries()) {
      architectureBox(`arena-truss-${index + 1}`, [.45, 10, .45], [x, 5, z], index % 2 ? secondary : primary);
    }
    const railCount = MOBILE ? 2 : 4;
    for (let index = 0; index < railCount; index++) {
      const z = -4 + index * (22 / Math.max(1, railCount - 1));
      architectureBox(`arena-light-rail-${index + 1}`, [42, .16, .18], [0, 9.4, z], primary);
    }
    return;
  }

  if (template.architecture === 'alpine-lodge') {
    architectureBox('lodge-left-wall', [.6, 7.5, 31], [-18.7, 3.75, 4], dark);
    architectureBox('lodge-right-wall', [.6, 7.5, 31], [18.7, 3.75, 4], dark);
    architectureBox('lodge-back-beam', [36, .7, .7], [0, 8.2, 19.5], secondary);
    for (const [index, z] of (MOBILE ? [-2, 12] : [-5, 2, 9, 16]).entries()) {
      architectureBox(`lodge-roof-beam-left-${index + 1}`, [.42, 12, .5], [-8.5, 9.8, z], secondary, [0, 0, -.66]);
      architectureBox(`lodge-roof-beam-right-${index + 1}`, [.42, 12, .5], [8.5, 9.8, z], secondary, [0, 0, .66]);
    }
    const fireplace = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x6f6256, roughness: .95 });
    const opening = new THREE.MeshBasicMaterial({ color: 0x120906 });
    fireplace.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.5, 1.4), stone));
    const fireOpening = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, .12), opening);
    fireOpening.position.set(0, -.7, .76);
    fireplace.add(fireOpening);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a28, transparent: true, opacity: .92 });
    for (const x of [-.65, 0, .65]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.35 + Math.abs(x) * .35, 5), flameMaterial);
      flame.position.set(x, -1, .92);
      fireplace.add(flame);
    }
    fireplace.position.set(-17.6, 2.75, -4.5);
    fireplace.rotation.y = Math.PI / 2;
    registerArchitecture(fireplace, 'fireplace-hearth');
    const chandelier = new THREE.Mesh(new THREE.CylinderGeometry(1.5, .55, .55, 8), primary);
    chandelier.position.set(0, 7.8, -1);
    registerArchitecture(chandelier, 'lodge-chandelier');
    return;
  }

  if (template.architecture === 'island-pavilion') {
    const count = MOBILE ? 6 : 10;
    const columnGeometry = new THREE.CylinderGeometry(.28, .4, 7.5, 7);
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2;
      const column = new THREE.Mesh(columnGeometry, index % 2 ? dark : primary);
      column.position.set(Math.cos(angle) * 23, 3.75, 4 + Math.sin(angle) * 19);
      registerArchitecture(column, `pavilion-column-${index + 1}`);
    }
    const canopy = new THREE.Mesh(new THREE.TorusGeometry(20.5, .28, 6, MOBILE ? 36 : 64), secondary);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, 7.4, 4);
    registerArchitecture(canopy, 'pavilion-canopy-ring');
    return;
  }

  if (template.architecture === 'mars-habitat') {
    const ribCount = MOBILE ? 3 : 6;
    const ribGeometry = new THREE.TorusGeometry(21, .18, 6, MOBILE ? 28 : 48, Math.PI);
    for (let index = 0; index < ribCount; index++) {
      const rib = new THREE.Mesh(ribGeometry, index % 2 ? secondary : primary);
      rib.position.set(0, 0, -5 + index * (25 / Math.max(1, ribCount - 1)));
      registerArchitecture(rib, `habitat-rib-${index + 1}`);
    }
    for (const [index, x] of [-22.5, 22.5].entries()) {
      const airlock = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.4, 8), dark);
      airlock.rotation.z = Math.PI / 2;
      airlock.position.set(x, 2.7, 7);
      registerArchitecture(airlock, `habitat-airlock-${index + 1}`);
    }
    return;
  }

  if (template.architecture === 'cyber-gallery') {
    architectureBox('gallery-left-wall', [.35, 7, 30], [-27.2, 3.5, 5], dark);
    architectureBox('gallery-right-wall', [.35, 7, 30], [27.2, 3.5, 5], dark);
    const frameCount = MOBILE ? 6 : 14;
    const frameGeometry = new THREE.BoxGeometry(.16, 2.4, 3.4);
    const artworkGeometry = new THREE.PlaneGeometry(2.8, 1.85);
    for (let index = 0; index < frameCount; index++) {
      const side = index % 2 ? 1 : -1;
      const slot = Math.floor(index / 2);
      const z = -5 + slot * (22 / Math.max(1, Math.ceil(frameCount / 2) - 1));
      const group = new THREE.Group();
      group.add(new THREE.Mesh(frameGeometry, primary));
      const art = new THREE.Mesh(artworkGeometry, new THREE.MeshBasicMaterial({ color: index % 3 ? template.secondary : template.primary, transparent: true, opacity: .78, side: THREE.DoubleSide }));
      art.rotation.y = Math.PI / 2;
      art.position.x = side < 0 ? .12 : -.12;
      group.add(art);
      group.position.set(side * 26.85, 3.7, z);
      registerArchitecture(group, `gallery-frame-${index + 1}`);
    }
    architectureBox('gallery-ceiling-track-left', [.18, .18, 29], [-9, 8.2, 5], primary);
    architectureBox('gallery-ceiling-track-right', [.18, .18, 29], [9, 8.2, 5], primary);
    for (const [index, x] of [-7.5, 7.5].entries()) {
      const exhibit = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, .2), primary);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.5), new THREE.MeshBasicMaterial({ color: index ? template.primary : template.secondary, transparent: true, opacity: .82, side: THREE.DoubleSide }));
      art.position.z = -.12;
      exhibit.add(frame, art);
      exhibit.position.set(x, 5.3, -2.2);
      registerArchitecture(exhibit, `gallery-entry-exhibit-${index + 1}`);
    }
    return;
  }

  if (template.architecture === 'zen-courtyard') {
    architectureBox('courtyard-left-engawa', [2.2, .5, 38], [-19.8, .25, 5], secondary);
    architectureBox('courtyard-right-engawa', [2.2, .5, 38], [19.8, .25, 5], secondary);
    architectureBox('courtyard-back-wall', [40, 3.8, .45], [0, 1.9, 25.4], dark);
    const torii = new THREE.Group();
    for (const x of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.35, .48, 6.8, 8), secondary);
      post.position.set(x, 3.4, 0);
      torii.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.2, .55, .65), secondary);
    lintel.position.y = 6.3;
    torii.add(lintel);
    torii.position.set(0, 0, 23.8);
    registerArchitecture(torii, 'courtyard-torii-gate');
    if (!MOBILE) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(5.5, .35, 2.2), primary);
      bridge.position.set(15.2, .45, 18);
      bridge.rotation.x = -.08;
      registerArchitecture(bridge, 'courtyard-moon-bridge');
    }
    return;
  }

  if (template.architecture === 'lunar-observatory') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(22, MOBILE ? 16 : 28, MOBILE ? 8 : 14, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.position.set(0, 0, 4);
    registerArchitecture(dome, 'observatory-dome');
    const ribCount = MOBILE ? 3 : 6;
    for (let index = 0; index < ribCount; index++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(21.4, .13, 6, MOBILE ? 36 : 64), primary);
      rib.rotation.y = index / ribCount * Math.PI;
      rib.position.set(0, 0, 4);
      registerArchitecture(rib, `observatory-rib-${index + 1}`);
    }
    return;
  }

  if (template.architecture === 'ocean-dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(24.5, MOBILE ? 18 : 32, MOBILE ? 9 : 16, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.position.set(0, 0, 4);
    registerArchitecture(dome, 'ocean-glass-dome');
    const ribCount = MOBILE ? 3 : 7;
    for (let index = 0; index < ribCount; index++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(23.8, .11, 6, MOBILE ? 36 : 72), secondary);
      rib.rotation.y = index / ribCount * Math.PI;
      rib.position.set(0, 0, 4);
      registerArchitecture(rib, `ocean-dome-rib-${index + 1}`);
    }
    return;
  }

  if (template.architecture === 'desert-festival') {
    const tentCount = MOBILE ? 4 : 8;
    for (let index = 0; index < tentCount; index++) {
      const side = index % 2 ? 1 : -1;
      const z = -2 + Math.floor(index / 2) * 7;
      const tent = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 4), index % 3 ? secondary : primary);
      canopy.position.y = 5.6;
      canopy.rotation.y = Math.PI / 4;
      tent.add(canopy);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 5, 7), dark);
      pole.position.y = 2.5;
      tent.add(pole);
      tent.position.set(side * 27.8, 0, z);
      registerArchitecture(tent, `festival-canopy-${index + 1}`);
    }
    architectureBox('festival-banner-rail', [51, .18, .18], [0, 8.2, 18], primary);
    return;
  }

  if (template.architecture === 'arctic-hall') {
    const archCount = MOBILE ? 3 : 6;
    for (let index = 0; index < archCount; index++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(19.5, .22, 5, MOBILE ? 20 : 36, Math.PI), index % 2 ? secondary : primary);
      arch.position.set(0, 0, -5 + index * (26 / Math.max(1, archCount - 1)));
      registerArchitecture(arch, `ice-hall-arch-${index + 1}`);
    }
    const crystalCount = MOBILE ? 4 : 10;
    for (let index = 0; index < crystalCount; index++) {
      const side = index % 2 ? 1 : -1;
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5 + index % 3, 5), glass);
      crystal.position.set(side * 22.2, 2.75, -3 + Math.floor(index / 2) * 5.5);
      registerArchitecture(crystal, `ice-crystal-${index + 1}`);
    }
  }
}

function buildStage(template) {
  const group = new THREE.Group();
  group.position.set(0, 0, -10.7);
  const rectangularStage = ['lodge', 'gallery', 'tea', 'command', 'festival', 'ice'].includes(template.stageVariant);
  const stageWidth = template.stageVariant === 'festival' ? 16 : template.stageVariant === 'gallery' ? 13 : 14.6;
  const platform = new THREE.Mesh(
    rectangularStage
      ? new THREE.BoxGeometry(stageWidth, .58, template.stageVariant === 'gallery' ? 3.2 : 4.2)
      : new THREE.CylinderGeometry(7.3, 7.8, .58, template.stageVariant === 'pavilion' ? 6 : MOBILE ? 32 : 64, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: template.ground, metalness: template.stageVariant === 'lodge' ? .08 : .68, roughness: template.stageVariant === 'lodge' ? .8 : .3 })
  );
  if (!rectangularStage) platform.rotation.y = Math.PI / 2;
  platform.position.y = .28;
  platform.castShadow = !MOBILE;
  platform.receiveShadow = true;
  group.add(platform);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(6.9, .055, 8, 96, Math.PI),
    new THREE.MeshBasicMaterial({ color: template.primary, transparent: true, opacity: .8 })
  );
  glow.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  glow.position.y = .6;
  group.add(glow);

  const screenTexture = makeStageTexture(template);
  world.stageDefaultTexture = screenTexture;
  world.stageMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5.85), world.stageMaterial);
  screen.position.set(0, 4.1, -.3);
  group.add(screen);

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(10.8, 6.25, .18)),
    new THREE.LineBasicMaterial({ color: template.primary, transparent: true, opacity: .5 })
  );
  frame.position.set(0, 4.1, -.38);
  group.add(frame);

  for (const x of [-5.7, 5.7]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(.09, .18, 6.5, 8),
      new THREE.MeshBasicMaterial({ color: x < 0 ? template.primary : template.secondary, transparent: true, opacity: .62 })
    );
    pillar.position.set(x, 3.2, -.55);
    group.add(pillar);
  }
  scene.add(group);
}

function makeStageTexture(template = SPACE_TEMPLATES[DEFAULT_SPACE_TEMPLATE]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  const primary = `#${template.primary.toString(16).padStart(6, '0')}`;
  const secondary = `#${template.secondary.toString(16).padStart(6, '0')}`;
  gradient.addColorStop(0, secondary);
  gradient.addColorStop(.5, '#090d1a');
  gradient.addColorStop(1, primary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.strokeStyle = 'rgba(140,246,255,.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1280; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
  for (let y = 0; y < 720; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
  ctx.textAlign = 'center';
  ctx.fillStyle = primary;
  ctx.font = '700 25px monospace';
  ctx.fillText('METAVERSE / RELOADED', 640, 305);
  ctx.fillStyle = '#f3f6ff';
  ctx.font = '600 64px sans-serif';
  ctx.fillText(template.label.toUpperCase(), 640, 385);
  ctx.fillStyle = '#8996af';
  ctx.font = '400 20px monospace';
  ctx.fillText(`${template.stageVariant.toUpperCase()} / READY FOR LIVE EVENTS`, 640, 435);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSeating(template = SPACE_TEMPLATES[DEFAULT_SPACE_TEMPLATE]) {
  world.seats.length = 0;
  const seatMaterial = new THREE.MeshStandardMaterial({ color: template.ground, metalness: template.stageVariant === 'lodge' ? .12 : .62, roughness: template.stageVariant === 'lodge' ? .78 : .38 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: template.primary, transparent: true, opacity: .24 });
  for (const row of SEAT_ROWS) {
    for (let index = 0; index < row.count; index++) {
      const progress = row.count === 1 ? .5 : index / (row.count - 1);
      const angle = Math.PI * (row.start + row.span * progress);
      const x = Math.cos(angle) * row.radius;
      const z = row.zOffset + Math.sin(angle) * row.radius * .55;
      const seat = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.85, 1.05, .28, 16), seatMaterial);
      base.position.y = .14;
      base.castShadow = !MOBILE;
      seat.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.82, .025, 6, 32), glowMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .3;
      seat.add(ring);
      seat.position.set(x, 0, z);
      // Avatar movement defines local +Z as forward. Use the same explicit yaw
      // here so every seated avatar faces the physical centre of the screen.
      seat.rotation.y = yawTowardStage(x, z);
      scene.add(seat);
      world.seats.push({ x, y: .3, z, rotation: seat.rotation.y });
    }
  }
}

function yawTowardStage(x, z) {
  return Math.atan2(MAIN_STAGE_SCREEN_POSITION.x - x, MAIN_STAGE_SCREEN_POSITION.z - z);
}

function stageFacingAlignment({ x, z, rotation }) {
  const toStageX = MAIN_STAGE_SCREEN_POSITION.x - x;
  const toStageZ = MAIN_STAGE_SCREEN_POSITION.z - z;
  const distance = Math.hypot(toStageX, toStageZ);
  if (!distance) return 1;
  const forwardX = Math.sin(rotation);
  const forwardZ = Math.cos(rotation);
  return (forwardX * toStageX + forwardZ * toStageZ) / distance;
}

function makePortalLabel(label, targetTitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(6,10,18,.88)';
  roundRect(ctx, 18, 18, 732, 156, 34);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,246,255,.58)';
  ctx.lineWidth = 4;
  roundRect(ctx, 18, 18, 732, 156, 34);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3f6ff';
  ctx.font = '700 43px sans-serif';
  ctx.fillText(String(label).slice(0, 28), 384, 88);
  ctx.fillStyle = '#8cf6ff';
  ctx.font = '700 21px monospace';
  ctx.fillText(`TO: ${String(targetTitle).slice(0, 34).toUpperCase()}`, 384, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.y = 5.9;
  sprite.scale.set(5.1, 1.28, 1);
  sprite.renderOrder = 9;
  return sprite;
}

// Functional portals only: pollPortals calls this exclusively for active DB
// records. Empty rooms deliberately contain no decorative/static portal rings.
function buildPortal(portalData, index) {
  const positions = [[-13, -1], [13, 2], [-16, 8], [16, 8], [-10, 14], [10, 14]];
  const [x, z] = positions[index % positions.length];
  const color = index % 2 ? 0x8c6cff : 0x8cf6ff;
  const portal = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, .06, 10, 72), mat);
  ring.position.y = 2.7;
  portal.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(.8);
  ring2.material = mat.clone();
  ring2.material.opacity = .18;
  portal.add(ring2);
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(2.22, 56),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false })
  );
  surface.position.y = 2.7;
  portal.add(surface);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, .2, 48), new THREE.MeshStandardMaterial({ color: 0x101829, metalness: .8, roughness: .25 }));
  pad.position.y = .1;
  portal.add(pad);
  portal.add(makePortalLabel(portalData.label, portalData.target_title));
  portal.position.set(x, 0, z);
  portal.rotation.y = x < 0 ? .45 : -.45;
  portal.userData.portalId = portalData.portal_id;
  scene.add(portal);
  world.animated.push({ object: ring2, type: 'spin', speed: .2 });
  return portal;
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material?.map?.dispose?.();
      material?.dispose?.();
    }
  });
  object.removeFromParent();
}

function renderPortalList() {
  ui.portalList.replaceChildren();
  for (const { row } of world.portals.values()) {
    const item = document.createElement('div');
    item.className = 'portal-list-item';
    const label = document.createElement('strong');
    label.textContent = row.label;
    const target = document.createElement('span');
    target.textContent = `Ziel: ${row.target_title}`;
    const status = document.createElement('b');
    status.textContent = 'ACTIVE';
    item.append(label, target, status);
    ui.portalList.append(item);
  }
}

async function pollPortals() {
  if (!state.joined) return;
  try {
    const rows = await dbGet('portals', { source_room_id: state.eventId, status: 'active' }, 24);
    const latest = new Map();
    for (const row of rows) latest.set(row.portal_id, row);
    const ordered = [...latest.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, 6);
    const activeIds = new Set(ordered.map(row => row.portal_id));
    for (const [portalId, portal] of world.portals) {
      if (activeIds.has(portalId)) continue;
      disposeObject(portal.group);
      world.portals.delete(portalId);
    }
    ordered.forEach((row, index) => {
      if (world.portals.has(row.portal_id)) return;
      world.portals.set(row.portal_id, { row, group: buildPortal(row, index) });
    });
    renderPortalList();
  } catch (error) {
    console.warn('[portals]', error);
  }
}

async function createPortal(event) {
  event.preventDefault();
  if (!isHostRole()) return;
  const submit = ui.portalForm.querySelector('button[type="submit"]');
  const label = ui.portalLabel.value.trim().replace(/\s+/g, ' ');
  ui.portalError.textContent = '';
  submit.disabled = true;
  try {
    if (world.portals.size >= 6) throw new Error('Pro Raum sind aktuell maximal sechs Portale möglich.');
    if (label.length < 2) throw new Error('Bitte gib dem Portal einen Namen.');
    const destination = await resolveInviteCode(ui.portalTargetCode.value);
    if (destination.role !== 'guest') throw new Error('Für ein Portal brauchst du den Guest-Code des Zielraums.');
    if (destination.roomId === state.eventId) throw new Error('Ein Portal kann nicht in denselben Raum führen.');
    const row = {
      source_room_id: state.eventId,
      portal_id: crypto.randomUUID(),
      label: label.slice(0, 32),
      target_room_id: destination.roomId,
      target_title: destination.title,
      created_by: state.clientId,
      status: 'active',
      created_at: new Date().toISOString()
    };
    await reliableDbPost('portals', row, { source_room_id: state.eventId, portal_id: row.portal_id });
    ui.portalForm.reset();
    await pollPortals();
    notify(`Portal „${row.label}“ wurde erstellt.`, 'success');
  } catch (error) {
    ui.portalError.textContent = error.message || 'Das Portal konnte nicht erstellt werden.';
  } finally {
    submit.disabled = false;
  }
}

function updatePortalInteraction() {
  if (!state.joined || !world.local || state.portalTravelling) {
    state.nearbyPortalId = '';
    ui.portalPrompt.hidden = true;
    return;
  }
  let nearest = null;
  for (const [portalId, portal] of world.portals) {
    const distance = Math.hypot(world.local.root.position.x - portal.group.position.x, world.local.root.position.z - portal.group.position.z);
    if (distance > 3.2 || (nearest && distance >= nearest.distance)) continue;
    nearest = { portalId, distance, portal };
  }
  state.nearbyPortalId = nearest?.portalId || '';
  ui.portalPrompt.hidden = !nearest;
  if (nearest) ui.portalPromptLabel.textContent = `${nearest.portal.row.label} · ${nearest.portal.row.target_title}`;
}

function travelThroughPortal() {
  const portal = world.portals.get(state.nearbyPortalId);
  if (!portal || state.portalTravelling) return;
  state.portalTravelling = true;
  sessionStorage.setItem('mr-portal-route', portal.row.portal_id);
  notify(`Portal zu „${portal.row.target_title}“ wird geöffnet …`, 'success');
  setTimeout(() => {
    leaveEvent();
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('portal', portal.row.portal_id);
    location.assign(url);
  }, 260);
}

async function resumePortalTravel() {
  const portalId = new URLSearchParams(location.search).get('portal');
  if (!portalId) return;
  const route = sessionStorage.getItem('mr-portal-route');
  sessionStorage.removeItem('mr-portal-route');
  if (route !== portalId) {
    ui.joinError.textContent = 'Dieses Portal muss aus seinem Ursprungsraum betreten werden.';
    return;
  }
  const rows = await dbGet('portals', { portal_id: portalId, status: 'active' }, 2);
  const portal = rows[0];
  const name = String(localStorage.getItem('mr-display-name') || '').trim();
  if (!portal || name.length < 2) {
    ui.joinError.textContent = 'Dieses Portal ist nicht mehr aktiv.';
    return;
  }
  await enterRoom({ roomId: portal.target_room_id, title: portal.target_title, role: 'guest', roomOwner: false, inviteCodes: null, name });
  showRoomArrival(portal.target_title);
  notify(`Portal angekommen: Du bist jetzt in „${portal.target_title}“.`, 'success');
}

function addTemplateDecoration(object, x, y, z) {
  object.position.set(x, y, z);
  scene.add(object);
  world.templateDecorations++;
}

function buildTemplateDecorations(template) {
  const count = MOBILE ? 10 : 20;
  const primary = new THREE.MeshStandardMaterial({ color: template.primary, roughness: .62, metalness: .12 });
  const secondary = new THREE.MeshStandardMaterial({ color: template.secondary, roughness: .55, metalness: .18 });
  const dark = new THREE.MeshStandardMaterial({ color: template.ground, roughness: .8, metalness: .08 });
  const glow = new THREE.MeshBasicMaterial({ color: template.primary, transparent: true, opacity: .32, wireframe: true });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 22.5 + (i % 3) * 2.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 3.4 + (i % 5) * 1.35;
    let object;
    let y = height / 2;
    if (template.decor === 'alpine' || template.decor === 'arctic') {
      object = new THREE.Mesh(new THREE.ConeGeometry(2.2 + (i % 3) * .55, height + 2.5, 5), i % 3 ? dark : primary);
      object.rotation.y = angle;
      if (template.decor === 'arctic') object.scale.x = .62;
    } else if (template.decor === 'tropical') {
      object = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, height, 7), dark);
      trunk.position.y = height / 2;
      object.add(trunk);
      for (let leaf = 0; leaf < 5; leaf++) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(.55, 2.3, 5), primary);
        crown.position.y = height;
        crown.rotation.z = Math.PI / 2.8;
        crown.rotation.y = leaf / 5 * Math.PI * 2;
        object.add(crown);
      }
      addTemplateDecoration(object, x, 0, z);
      continue;
    } else if (template.decor === 'mars') {
      object = i % 4 === 0
        ? new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), glow)
        : new THREE.Mesh(new THREE.DodecahedronGeometry(1 + (i % 3) * .4, 0), i % 2 ? secondary : dark);
      y = i % 4 === 0 ? 0 : 1;
    } else if (template.decor === 'zen') {
      object = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.75 + (i % 3) * .35, 1), dark);
      rock.scale.y = .55;
      object.add(rock);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (i % 2) * .35, 9, 6), primary);
      crown.scale.y = .55;
      crown.position.y = 1.5;
      object.add(crown);
      addTemplateDecoration(object, x, 0, z);
      continue;
    } else if (template.decor === 'moon') {
      object = i % 4 === 0
        ? new THREE.Mesh(new THREE.TorusGeometry(1.5, .16, 8, 28), secondary)
        : new THREE.Mesh(new THREE.DodecahedronGeometry(.7 + (i % 4) * .28, 1), dark);
      if (i % 4 === 0) object.rotation.x = Math.PI / 2;
      y = i % 4 === 0 ? .14 : .75;
    } else if (template.decor === 'ocean') {
      object = new THREE.Group();
      for (let branch = 0; branch < 3; branch++) {
        const coral = new THREE.Mesh(new THREE.CylinderGeometry(.12, .28, 2.2 + branch * .6, 7), branch % 2 ? secondary : primary);
        coral.position.set((branch - 1) * .45, 1 + branch * .25, 0);
        coral.rotation.z = (branch - 1) * .22;
        object.add(coral);
      }
      addTemplateDecoration(object, x, 0, z);
      continue;
    } else if (template.decor === 'desert') {
      object = i % 3 === 0
        ? new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.8, 4), secondary)
        : new THREE.Mesh(new THREE.CylinderGeometry(.22, .34, 3.2 + (i % 2), 7), primary);
      y = i % 3 === 0 ? 1.4 : 1.7 + (i % 2) * .5;
    } else {
      object = new THREE.Mesh(new THREE.CylinderGeometry(.6 + (i % 2) * .3, 1.2, height, i % 2 ? 6 : 8), i % 3 ? dark : glow);
    }
    addTemplateDecoration(object, x, y, z);
  }
}

function addParticles(color = 0x91e9ff) {
  const count = 380;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 7 + Math.random() * 32;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 1 + Math.random() * 14;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .045, transparent: true, opacity: .6 }));
  scene.add(points);
  world.animated.push({ object: points, type: 'turn', speed: .008 });
}

function loadAvatarModel() {
  if (world.modelPromise) return world.modelPromise;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/libs/draco/');
  loader.setDRACOLoader(draco);
  world.modelPromise = loader.loadAsync('public/assets/avatars/kaykit-rogue.glb').then(gltf => {
    world.model = gltf.scene;
    world.clips = gltf.animations || [];
    return gltf;
  }).catch(error => {
    console.error('[avatar]', error);
    notify('Avatar-Modell konnte nicht geladen werden. Hologramm-Fallback aktiv.', 'error');
    return null;
  });
  return world.modelPromise;
}

function makeNameSprite(person) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(6,10,18,.82)';
  roundRect(ctx, 16, 15, 480, 98, 28);
  ctx.fill();
  ctx.strokeStyle = isHostRole(person.role) ? 'rgba(140,246,255,.65)' : 'rgba(220,230,255,.24)';
  ctx.lineWidth = 3;
  roundRect(ctx, 16, 15, 480, 98, 28);
  ctx.stroke();
  ctx.fillStyle = '#f3f6ff';
  ctx.textAlign = 'center';
  ctx.font = '600 38px sans-serif';
  ctx.fillText(person.name.slice(0, 22), 256, 66);
  ctx.fillStyle = isHostRole(person.role) ? '#8cf6ff' : '#98a4b9';
  ctx.font = '700 17px monospace';
  ctx.fillText(roleLabel(person.role), 256, 94);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.y = 2.42;
  sprite.scale.set(2.35, .59, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function makeLockSprite() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEmojiTexture('🔒'), transparent: true, depthTest: false }));
  sprite.position.set(.72, 2.48, 0);
  sprite.scale.setScalar(.38);
  sprite.renderOrder = 13;
  sprite.visible = false;
  return sprite;
}

function avatarMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? .48,
    metalness: options.metalness ?? .12,
    emissive: options.emissive ? color : 0x000000,
    emissiveIntensity: options.emissive ? .18 : 0
  });
}

function addAccessory(group, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = !MOBILE;
  group.add(mesh);
  return mesh;
}

function buildFallbackAvatarAccessories(profile) {
  const safe = normalizeAvatarProfile(profile);
  const group = new THREE.Group();
  group.name = 'AvatarCustomization';
  group.userData.profile = safe;
  const hair = avatarMaterial(safe.hairColor, { roughness: .7 });
  const cloth = avatarMaterial(safe.primaryColor, { roughness: .5 });
  const accent = avatarMaterial(safe.outfitStyle === 'cyber' ? '#8cf6ff' : '#d4a15b', { metalness: safe.outfitStyle === 'cyber' ? .72 : .18, emissive: safe.outfitStyle === 'cyber' });

  if (safe.hairStyle === 'short') {
    addAccessory(group, new THREE.SphereGeometry(.31, 14, 8, 0, Math.PI * 2, 0, Math.PI * .48), hair, [0, 1.79, 0], [1, .72, 1], [0, 0, 0], 'HairShort');
  } else if (safe.hairStyle === 'bob') {
    addAccessory(group, new THREE.SphereGeometry(.34, 14, 10, 0, Math.PI * 2, 0, Math.PI * .72), hair, [0, 1.75, .01], [1.03, 1.12, 1.02], [0, 0, 0], 'HairBob');
    addAccessory(group, new THREE.BoxGeometry(.1, .34, .13), hair, [-.27, 1.59, .01], [1, 1, 1], [0, 0, -.1], 'HairBobLeft');
    addAccessory(group, new THREE.BoxGeometry(.1, .34, .13), hair, [.27, 1.59, .01], [1, 1, 1], [0, 0, .1], 'HairBobRight');
  } else if (safe.hairStyle === 'mohawk') {
    for (let index = 0; index < 5; index++) {
      addAccessory(group, new THREE.ConeGeometry(.105, .32 + index * .018, 5), hair, [0, 1.98, -.2 + index * .1], [1, 1, .8], [0, 0, 0], `HairMohawk${index}`);
    }
  }

  if (safe.outfitStyle === 'rogue') {
    addAccessory(group, new THREE.TorusGeometry(.3, .045, 6, 18), accent, [0, .83, 0], [1, 1, .82], [Math.PI / 2, 0, 0], 'RogueBelt');
  } else if (safe.outfitStyle === 'explorer') {
    addAccessory(group, new THREE.BoxGeometry(.48, .62, .18), accent, [0, 1.08, .27], [1, 1, 1], [0, 0, 0], 'ExplorerPack');
    addAccessory(group, new THREE.TorusGeometry(.31, .05, 6, 18), accent, [0, .84, 0], [1.04, 1, .85], [Math.PI / 2, 0, 0], 'ExplorerBelt');
    addAccessory(group, new THREE.BoxGeometry(.1, .68, .08), cloth, [-.2, 1.2, -.27], [1, 1, 1], [0, 0, -.1], 'ExplorerStrap');
  } else if (safe.outfitStyle === 'cyber') {
    addAccessory(group, new THREE.BoxGeometry(.28, .14, .42), cloth, [-.38, 1.42, 0], [1, 1, 1], [0, 0, -.22], 'CyberShoulderLeft');
    addAccessory(group, new THREE.BoxGeometry(.28, .14, .42), cloth, [.38, 1.42, 0], [1, 1, 1], [0, 0, .22], 'CyberShoulderRight');
    addAccessory(group, new THREE.BoxGeometry(.43, .34, .06), accent, [0, 1.2, -.29], [1, 1, 1], [0, 0, 0], 'CyberChest');
  }
  return group;
}

function neutralizeSourceAvatar(model) {
  model.traverse(object => {
    if (!object.isMesh) return;
    object.visible = false;
    object.castShadow = false;
    object.receiveShadow = false;
    object.userData.neutralizedSourceMesh = true;
  });
}

function sourceAvatarMeshStats(model) {
  const stats = { total: 0, visible: 0 };
  model?.traverse(object => {
    if (!object.isMesh || !object.userData.neutralizedSourceMesh) return;
    stats.total++;
    if (object.visible) stats.visible++;
  });
  return stats;
}

function addRigPart(appearance, parent, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], name = '') {
  if (!parent) return null;
  const part = addAccessory(parent, geometry, material, position, scale, rotation, name);
  part.userData.avatarModule = true;
  appearance.children.push(part);
  return part;
}

function buildRiggedAvatarAppearance(model, profile) {
  const safe = normalizeAvatarProfile(profile);
  const appearance = { children: [], rigged: true };
  const boneIndex = new Map();
  model.traverse(object => {
    if (object.isBone) boneIndex.set(object.name.toLowerCase().replace(/[^a-z0-9]/g, ''), object);
  });
  const bone = name => boneIndex.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const skin = avatarMaterial('#c88768', { roughness: .78 });
  const base = avatarMaterial('#222837', { roughness: .72 });
  const cloth = avatarMaterial(safe.primaryColor, { roughness: .48 });
  const hair = avatarMaterial(safe.hairColor, { roughness: .76 });
  const accentColor = safe.outfitStyle === 'cyber' ? '#8cf6ff' : safe.outfitStyle === 'explorer' ? '#d4a15b' : '#d8ddea';
  const accent = avatarMaterial(accentColor, {
    metalness: safe.outfitStyle === 'cyber' ? .72 : .16,
    emissive: safe.outfitStyle === 'cyber'
  });

  // The KayKit Rogue remains the animation skeleton only. These matte, neutral
  // body parts contain no baked-in hair or clothing and follow the same bones.
  addRigPart(appearance, bone('head'), new THREE.SphereGeometry(.245, 16, 12), skin, [0, .13, 0], [1, 1.08, .96], [0, 0, 0], 'BaseHead');
  addRigPart(appearance, bone('chest'), new THREE.CapsuleGeometry(.25, .22, 5, 10), base, [0, .03, 0], [1.08, 1, .8], [0, 0, 0], 'BaseTorso');
  addRigPart(appearance, bone('hips'), new THREE.BoxGeometry(.48, .3, .3), base, [0, .15, 0], [1, 1, 1], [0, 0, 0], 'BaseHips');
  for (const side of ['l', 'r']) {
    addRigPart(appearance, bone(`upperarm.${side}`), new THREE.CapsuleGeometry(.105, .14, 4, 8), skin, [0, .12, 0], [1, 1, 1], [0, 0, 0], `BaseUpperArm-${side}`);
    addRigPart(appearance, bone(`lowerarm.${side}`), new THREE.CapsuleGeometry(.09, .13, 4, 8), skin, [0, .12, 0], [1, 1, 1], [0, 0, 0], `BaseLowerArm-${side}`);
    addRigPart(appearance, bone(`hand.${side}`), new THREE.SphereGeometry(.105, 10, 8), skin, [0, .075, 0], [1, 1.15, .9], [0, 0, 0], `BaseHand-${side}`);
    addRigPart(appearance, bone(`upperleg.${side}`), new THREE.CapsuleGeometry(.135, .15, 4, 8), base, [0, .14, 0], [1, 1, .92], [0, 0, 0], `BaseUpperLeg-${side}`);
    addRigPart(appearance, bone(`lowerleg.${side}`), new THREE.CapsuleGeometry(.115, .14, 4, 8), base, [0, .13, 0], [1, 1, .9], [0, 0, 0], `BaseLowerLeg-${side}`);
    addRigPart(appearance, bone(`foot.${side}`), new THREE.BoxGeometry(.21, .14, .34), base, [0, .07, .07], [1, 1, 1], [0, 0, 0], `BaseFoot-${side}`);
  }

  if (safe.hairStyle === 'short') {
    addRigPart(appearance, bone('head'), new THREE.SphereGeometry(.263, 16, 9, 0, Math.PI * 2, 0, Math.PI * .48), hair, [0, .2, 0], [1, .72, 1], [0, 0, 0], 'HairShort');
  } else if (safe.hairStyle === 'bob') {
    addRigPart(appearance, bone('head'), new THREE.SphereGeometry(.275, 16, 12, 0, Math.PI * 2, 0, Math.PI * .75), hair, [0, .18, .01], [1.02, 1.08, 1.02], [0, 0, 0], 'HairBob');
    addRigPart(appearance, bone('head'), new THREE.BoxGeometry(.08, .28, .12), hair, [-.235, .07, .01], [1, 1, 1], [0, 0, -.08], 'HairBobLeft');
    addRigPart(appearance, bone('head'), new THREE.BoxGeometry(.08, .28, .12), hair, [.235, .07, .01], [1, 1, 1], [0, 0, .08], 'HairBobRight');
  } else if (safe.hairStyle === 'mohawk') {
    for (let index = 0; index < 5; index++) {
      addRigPart(appearance, bone('head'), new THREE.ConeGeometry(.085, .26 + index * .012, 5), hair, [0, .37, -.16 + index * .08], [1, 1, .82], [0, 0, 0], `HairMohawk${index}`);
    }
  }

  if (safe.outfitStyle === 'rogue') {
    addRigPart(appearance, bone('chest'), new THREE.CapsuleGeometry(.275, .28, 5, 10), cloth, [0, .035, 0], [1.13, 1, .9], [0, 0, 0], 'OutfitCasualTop');
    addRigPart(appearance, bone('hips'), new THREE.TorusGeometry(.255, .035, 6, 18), accent, [0, .22, 0], [1, 1, .78], [Math.PI / 2, 0, 0], 'OutfitCasualBelt');
    for (const side of ['l', 'r']) addRigPart(appearance, bone(`foot.${side}`), new THREE.BoxGeometry(.235, .16, .37), cloth, [0, .07, .075], [1, 1, 1], [0, 0, 0], `OutfitCasualShoe-${side}`);
  } else if (safe.outfitStyle === 'explorer') {
    addRigPart(appearance, bone('chest'), new THREE.BoxGeometry(.57, .46, .36), cloth, [0, .01, 0], [1, 1, 1], [0, 0, 0], 'OutfitExplorerVest');
    addRigPart(appearance, bone('chest'), new THREE.BoxGeometry(.48, .55, .18), accent, [0, .03, -.28], [1, 1, 1], [0, 0, 0], 'OutfitExplorerPack');
    addRigPart(appearance, bone('hips'), new THREE.TorusGeometry(.27, .045, 6, 18), accent, [0, .22, 0], [1.05, 1, .8], [Math.PI / 2, 0, 0], 'OutfitExplorerBelt');
  } else if (safe.outfitStyle === 'cyber') {
    addRigPart(appearance, bone('chest'), new THREE.BoxGeometry(.58, .43, .38), cloth, [0, .02, 0], [1, 1, 1], [0, 0, 0], 'OutfitCyberCore');
    addRigPart(appearance, bone('chest'), new THREE.BoxGeometry(.4, .28, .055), accent, [0, .035, .22], [1, 1, 1], [0, 0, 0], 'OutfitCyberChest');
    for (const side of ['l', 'r']) {
      addRigPart(appearance, bone(`upperarm.${side}`), new THREE.BoxGeometry(.22, .18, .27), cloth, [0, .04, 0], [1, 1, 1], [0, 0, 0], `OutfitCyberShoulder-${side}`);
      addRigPart(appearance, bone(`lowerleg.${side}`), new THREE.BoxGeometry(.22, .26, .24), accent, [0, .11, -.02], [1, 1, 1], [0, 0, 0], `OutfitCyberShin-${side}`);
    }
  }
  return appearance;
}

function disposeAvatarAppearance(appearance) {
  for (const object of appearance?.children || []) {
    object.parent?.remove(object);
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material?.dispose?.());
  }
}

function applyAvatarProfile(avatar, profile) {
  if (!avatar) return;
  const safe = normalizeAvatarProfile(profile);
  const signature = JSON.stringify(safe);
  if (avatar.profileSignature === signature) return;
  avatar.profile = safe;
  avatar.profileSignature = signature;
  avatar.person.avatarProfile = safe;
  avatar.person.color = safe.primaryColor;
  if (avatar.accessories) {
    if (avatar.accessories.isGroup) avatar.bodyVisual.remove(avatar.accessories);
    else disposeAvatarAppearance(avatar.accessories);
  }
  if (avatar.model) {
    avatar.accessories = buildRiggedAvatarAppearance(avatar.model, safe);
  } else {
    avatar.accessories = buildFallbackAvatarAccessories(safe);
    avatar.bodyVisual.add(avatar.accessories);
  }
  if (avatar.aura?.material?.color) avatar.aura.material.color.set(safe.primaryColor);
}

function createAvatar(person, local = false) {
  if (world.avatars.has(person.client_id)) return world.avatars.get(person.client_id);
  const profile = normalizeAvatarProfile(person.avatarProfile || state.avatarProfiles.get(person.client_id) || { primaryColor: person.color });
  person.color = profile.primaryColor;
  person.avatarProfile = profile;
  const root = new THREE.Group();
  const initialPosition = clampRoomPosition(Number(person.x) || 0, Number(person.z) || 5);
  root.position.set(initialPosition.x, 0, initialPosition.z);
  root.rotation.y = Number(person.rotation) || 0;
  root.userData.target = root.position.clone();
  root.userData.targetRotation = root.rotation.y;
  root.userData.walking = false;

  const flipPivot = new THREE.Group();
  flipPivot.position.y = 1;
  const bodyVisual = new THREE.Group();
  bodyVisual.position.y = -1;
  flipPivot.add(bodyVisual);
  root.add(flipPivot);

  const placeholder = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.36, .7, 6, 12),
    new THREE.MeshStandardMaterial({ color: person.color, emissive: person.color, emissiveIntensity: .15, metalness: .55, roughness: .3 })
  );
  body.position.y = .85;
  body.castShadow = !MOBILE;
  placeholder.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.33, 1), body.material.clone());
  head.position.y = 1.7;
  placeholder.add(head);
  bodyVisual.add(placeholder);
  root.add(makeNameSprite(person));
  const lockSprite = makeLockSprite();
  root.add(lockSprite);

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(.7, local ? .035 : .018, 6, 48),
    new THREE.MeshBasicMaterial({ color: person.color, transparent: true, opacity: local ? .85 : .34 })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = .035;
  root.add(aura);
  world.animated.push({ object: aura, type: 'pulse', speed: 1.4, base: aura.scale.clone() });

  scene.add(root);
  const avatar = {
    root,
    bodyVisual,
    flipPivot,
    placeholder,
    lockSprite,
    model: null,
    mixer: null,
    actions: {},
    clip: '',
    local,
    lastUpdate: Date.now(),
    person,
    aura,
    accessories: null,
    profile: null,
    profileSignature: '',
    verticalVelocity: 0,
    jumpCount: 0,
    airborne: false,
    flipActive: false,
    flipProgress: 0,
    emote: '',
    emoteUntil: 0,
    seated: false,
    seatLocked: false,
    seatIndex: -1
  };
  world.avatars.set(person.client_id, avatar);
  if (local) world.local = avatar;
  applyAvatarProfile(avatar, profile);

  loadAvatarModel().then(gltf => {
    if (!gltf || !root.parent) return;
    const model = cloneSkeleton(gltf.scene);
    const box = skinnedBounds(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > .05 ? 2 / size.y : 1.2;
    model.scale.setScalar(scale);
    model.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale);
    neutralizeSourceAvatar(model);
    bodyVisual.add(model);
    bodyVisual.remove(placeholder);
    avatar.model = model;
    if (avatar.accessories?.isGroup) bodyVisual.remove(avatar.accessories);
    else disposeAvatarAppearance(avatar.accessories);
    avatar.accessories = buildRiggedAvatarAppearance(model, avatar.profile);
    avatar.mixer = new THREE.AnimationMixer(model);
    setupActions(avatar);
  });
  return avatar;
}

function skinnedBounds(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const temp = new THREE.Box3();
  let found = false;
  model.traverse(object => {
    if (object.isSkinnedMesh) {
      try {
        object.skeleton?.update();
        object.computeBoundingBox();
        temp.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
        bounds.union(temp);
        found = true;
      } catch (_) {}
    } else if (object.isMesh) {
      temp.setFromObject(object);
      bounds.union(temp);
      found = true;
    }
  });
  return found ? bounds : new THREE.Box3().setFromObject(model);
}

function setupActions(avatar) {
  const find = name => THREE.AnimationClip.findByName(world.clips, name);
  const idleClip = find('Idle') || world.clips[0];
  const walkClip = find('Walking_A');
  const cheerClip = find('Cheer');
  const sitClip = find('Sit_Chair_Idle');
  if (idleClip) avatar.actions.idle = avatar.mixer.clipAction(idleClip);
  if (walkClip) avatar.actions.walk = avatar.mixer.clipAction(walkClip);
  if (sitClip) avatar.actions.sit = avatar.mixer.clipAction(sitClip);
  if (cheerClip) {
    avatar.actions.cheer = avatar.mixer.clipAction(cheerClip);
    avatar.actions.cheer.setLoop(THREE.LoopOnce, 1);
    avatar.actions.cheer.clampWhenFinished = true;
  }
  if (avatar.actions.idle) {
    avatar.actions.idle.play();
    avatar.actions.idle.time = Math.random() * idleClip.duration;
    avatar.clip = 'idle';
  }
}

function setAvatarAction(avatar, next) {
  if (!avatar?.actions[next] || avatar.clip === next) return;
  const from = avatar.actions[avatar.clip];
  const to = avatar.actions[next];
  to.reset().play();
  if (from) from.crossFadeTo(to, .2, false);
  avatar.clip = next;
}

function setSeatState(avatar, seatIndex, locked) {
  const seat = world.seats[seatIndex];
  if (!avatar || !seat) return;
  avatar.airborne = false;
  avatar.verticalVelocity = 0;
  avatar.jumpCount = 0;
  avatar.flipActive = false;
  avatar.flipProgress = 0;
  avatar.flipPivot.rotation.x = 0;
  avatar.seated = true;
  avatar.seatLocked = Boolean(locked);
  avatar.seatIndex = seatIndex;
  avatar.lockSprite.visible = avatar.seatLocked;
  avatar.root.position.set(seat.x, seat.y, seat.z);
  avatar.root.userData.target.set(seat.x, seat.y, seat.z);
  avatar.root.rotation.y = seat.rotation;
  avatar.root.userData.targetRotation = seat.rotation;
  if (!avatar.emote) setAvatarAction(avatar, 'sit');
}

function releaseSeat(avatar, force = false) {
  if (!avatar || (avatar.seatLocked && !force)) return false;
  state.seatAssignments.delete(avatar.person?.client_id);
  avatar.seated = false;
  avatar.seatLocked = false;
  avatar.seatIndex = -1;
  avatar.root.position.y = 0;
  avatar.root.userData.target.y = 0;
  avatar.lockSprite.visible = false;
  if (!avatar.emote) setAvatarAction(avatar, 'idle');
  return true;
}

function roomControlPayload() {
  return {
    t: 'room-control',
    locked: state.roomLocked,
    assignments: [...state.seatAssignments.entries()].map(([clientId, seatIndex]) => ({
      clientId,
      seatIndex,
      role: clientId === state.clientId
        ? state.role
        : state.people.get(clientId)?.role || world.avatars.get(clientId)?.person?.role || ''
    }))
  };
}

function updateRoomControlUi() {
  ui.hostRoomControls.classList.toggle('locked', state.roomLocked);
  ui.lockSeats.disabled = state.roomLocked;
  ui.unlockSeats.disabled = !state.roomLocked;
  ui.seatAll.disabled = state.roomLocked;
}

function applyRoomControl(payload) {
  state.roomLocked = Boolean(payload.locked);
  state.seatAssignments.clear();
  for (const assignment of payload.assignments || []) {
    const seatIndex = Number(assignment.seatIndex);
    const knownRole = assignment.clientId === state.clientId
      ? state.role
      : state.people.get(assignment.clientId)?.role || world.avatars.get(assignment.clientId)?.person?.role;
    const role = knownRole || assignment.role;
    if (role !== 'guest' || !world.seats[seatIndex]) continue;
    state.seatAssignments.set(assignment.clientId, seatIndex);
  }
  for (const [clientId, seatIndex] of state.seatAssignments) {
    setSeatState(world.avatars.get(clientId), seatIndex, state.roomLocked);
  }
  for (const [clientId, avatar] of world.avatars) {
    if (!state.seatAssignments.has(clientId) && avatar.seated) releaseSeat(avatar, true);
  }
  updateRoomControlUi();
}

function guestParticipantIds() {
  const people = new Map(state.people);
  if (world.local) people.set(state.clientId, { client_id: state.clientId, role: state.role, name: state.name });
  return [...people.values()]
    .filter(person => person.role === 'guest')
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name) || a.client_id.localeCompare(b.client_id))
    .map(person => person.client_id)
    .slice(0, world.seats.length);
}

function assignSeatsToCurrentPeople() {
  state.seatAssignments.clear();
  guestParticipantIds().forEach((clientId, seatIndex) => state.seatAssignments.set(clientId, seatIndex));
}

function publishRoomControl(message) {
  applyRoomControl(roomControlPayload());
  broadcastData(roomControlPayload());
  if (message) notify(message, 'success');
}

function seatAllPeople() {
  if (!isHostRole()) return;
  assignSeatsToCurrentPeople();
  state.roomLocked = true;
  const count = state.seatAssignments.size;
  publishRoomControl(count === 1 ? '1 Guest wurde gesetzt und gesperrt.' : `${count} Guests wurden gesetzt und gesperrt.`);
}

function lockAllSeats() {
  if (!isHostRole()) return;
  if (!state.seatAssignments.size) assignSeatsToCurrentPeople();
  state.roomLocked = true;
  publishRoomControl('Guest-Sitzplätze gesperrt. Hosts und Cohosts bleiben beweglich.');
}

function unlockAllSeats() {
  if (!isHostRole()) return;
  state.roomLocked = false;
  publishRoomControl('Guest-Sitzplätze freigegeben. Guests können wieder aufstehen.');
}

function ensureSeatForPeer(peerId) {
  const role = state.people.get(peerId)?.role || world.avatars.get(peerId)?.person?.role;
  if (!state.roomLocked || role !== 'guest' || state.seatAssignments.has(peerId)) return false;
  const used = new Set(state.seatAssignments.values());
  const seatIndex = world.seats.findIndex((_, index) => !used.has(index));
  if (seatIndex < 0) return false;
  state.seatAssignments.set(peerId, seatIndex);
  return true;
}

function hostRoleForPeer(peerId) {
  return isHostRole(state.people.get(peerId)?.role) || isHostRole(world.avatars.get(peerId)?.person?.role);
}

function requestJump() {
  const avatar = world.local;
  if (!state.joined || !avatar) return false;
  if (avatar.seatLocked) {
    notify('Der Host hat die Sitzplätze gesperrt.');
    return false;
  }
  if (avatar.seated) releaseSeat(avatar);
  if (!avatar.airborne) return startAvatarJump(avatar, false, true);
  if (avatar.jumpCount === 1) return startAvatarJump(avatar, true, true);
  return false;
}

function startAvatarJump(avatar, doubleJump = false, shouldBroadcast = false) {
  if (!avatar) return false;
  if (avatar.seatLocked) return false;
  if (avatar.seated) releaseSeat(avatar);
  if (!doubleJump && avatar.airborne) return false;
  if (doubleJump && avatar.jumpCount >= 2) return false;
  avatar.airborne = true;
  avatar.jumpCount = doubleJump ? 2 : 1;
  avatar.verticalVelocity = doubleJump ? DOUBLE_JUMP_VELOCITY : FIRST_JUMP_VELOCITY;
  if (doubleJump) {
    avatar.flipActive = true;
    avatar.flipProgress = 0;
  }
  if (shouldBroadcast) broadcastData({ t: 'jump', double: doubleJump });
  return true;
}

function updateAvatarJump(avatar, dt) {
  if (!avatar.airborne || avatar.seated) return;
  avatar.verticalVelocity -= GRAVITY * dt;
  avatar.root.position.y += avatar.verticalVelocity * dt;
  if (avatar.flipActive) {
    avatar.flipProgress = Math.min(1, avatar.flipProgress + dt / .68);
    const eased = 1 - Math.pow(1 - avatar.flipProgress, 2);
    avatar.flipPivot.rotation.x = -Math.PI * 2 * eased;
  }
  if (avatar.root.position.y <= 0 && avatar.verticalVelocity <= 0) {
    avatar.root.position.y = 0;
    avatar.verticalVelocity = 0;
    avatar.jumpCount = 0;
    avatar.airborne = false;
    avatar.flipActive = false;
    avatar.flipProgress = 0;
    avatar.flipPivot.rotation.x = 0;
  }
}

function makeEmojiTexture(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '82px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillText(emoji, 64, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spawnEmojiBurst(avatar, definition) {
  for (let index = 0; index < definition.count; index++) {
    const texture = makeEmojiTexture(definition.emoji);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    const angle = (index / definition.count) * Math.PI * 2 + Math.random() * .45;
    sprite.position.set(Math.cos(angle) * (.2 + Math.random() * .35), 2.45 + Math.random() * .35, Math.sin(angle) * .25);
    const baseScale = .42 + Math.random() * .18;
    sprite.scale.setScalar(baseScale);
    sprite.renderOrder = 12;
    sprite.visible = false;
    avatar.root.add(sprite);
    world.effects.push({
      avatar,
      sprite,
      texture,
      age: -index * .11,
      duration: definition.duration / 1_000,
      baseScale,
      drift: new THREE.Vector3((Math.random() - .5) * .28, .75 + Math.random() * .35, (Math.random() - .5) * .12)
    });
  }
}

function updateEmojiEffects(dt) {
  for (let index = world.effects.length - 1; index >= 0; index--) {
    const effect = world.effects[index];
    effect.age += dt;
    if (effect.age < 0) continue;
    effect.sprite.visible = true;
    effect.sprite.position.addScaledVector(effect.drift, dt);
    const progress = effect.age / effect.duration;
    effect.sprite.material.opacity = Math.min(1, progress * 7) * Math.max(0, 1 - Math.pow(progress, 2));
    const scale = effect.baseScale * (1 + Math.sin(Math.min(1, progress) * Math.PI) * .28);
    effect.sprite.scale.setScalar(scale);
    if (progress < 1 && effect.sprite.parent) continue;
    effect.sprite.removeFromParent();
    effect.sprite.material.dispose();
    effect.texture.dispose();
    world.effects.splice(index, 1);
  }
}

function triggerEmote(type, avatar = world.local, shouldBroadcast = avatar?.local) {
  const definition = EMOTES[type];
  if (!definition || !avatar) return;
  avatar.emote = type;
  avatar.emoteUntil = performance.now() + definition.duration;
  if (avatar.actions.cheer) setAvatarAction(avatar, 'cheer');
  spawnEmojiBurst(avatar, definition);
  if (shouldBroadcast) broadcastData({ t: 'emote', emote: type });
}

function updateRemoteAvatar(person) {
  let avatar = world.avatars.get(person.client_id);
  if (!avatar) avatar = createAvatar(person, false);
  avatar.person = person;
  applyAvatarProfile(avatar, person.avatarProfile || state.avatarProfiles.get(person.client_id));
  avatar.lastUpdate = Date.now();
  const seatIndex = state.seatAssignments.get(person.client_id);
  if (seatIndex !== undefined) {
    setSeatState(avatar, seatIndex, state.roomLocked);
    return;
  }
  const target = clampRoomPosition(Number(person.x) || 0, Number(person.z) || 0);
  avatar.root.userData.target.set(target.x, 0, target.z);
  avatar.root.userData.targetRotation = Number(person.rotation) || 0;
}

function removeAvatar(clientId) {
  const avatar = world.avatars.get(clientId);
  if (!avatar || avatar.local) return;
  scene.remove(avatar.root);
  world.avatars.delete(clientId);
}

function applyStageVideo() {
  if (!ui.stageVideo.srcObject || !world.stageMaterial) return;
  if (world.videoTexture) world.videoTexture.dispose();
  world.videoTexture = new THREE.VideoTexture(ui.stageVideo);
  world.videoTexture.colorSpace = THREE.SRGBColorSpace;
  world.stageMaterial.map = world.videoTexture;
  world.stageMaterial.needsUpdate = true;
}

function clearStageVideo() {
  ui.stageVideo.srcObject = null;
  ui.mediaStage.hidden = true;
  if (world.stageMaterial) {
    world.stageMaterial.map = world.stageDefaultTexture;
    world.stageMaterial.needsUpdate = true;
  }
  world.videoTexture?.dispose();
  world.videoTexture = null;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  const elapsed = clock.elapsedTime;
  const now = performance.now();
  updateLocalMovement(dt);
  for (const avatar of world.avatars.values()) {
    updateAvatarJump(avatar, dt);
    if (avatar.emote && now >= avatar.emoteUntil) {
      avatar.emote = '';
      avatar.emoteUntil = 0;
      setAvatarAction(avatar, 'idle');
    }
    avatar.mixer?.update(dt);
    if (!avatar.local) {
      const dx = avatar.root.userData.target.x - avatar.root.position.x;
      const dz = avatar.root.userData.target.z - avatar.root.position.z;
      const distance = Math.hypot(dx, dz);
      const blend = 1 - Math.pow(.004, dt);
      avatar.root.position.x += dx * blend;
      avatar.root.position.z += dz * blend;
      avatar.root.rotation.y = lerpAngle(avatar.root.rotation.y, avatar.root.userData.targetRotation, 1 - Math.pow(.01, dt));
      if (!avatar.emote) setAvatarAction(avatar, avatar.seated ? 'sit' : avatar.airborne ? 'idle' : distance > .035 ? 'walk' : 'idle');
    }
  }
  updateEmojiEffects(dt);
  updatePortalInteraction();
  for (const item of world.animated) {
    if (!item.object.parent) continue;
    if (item.type === 'spin') item.object.rotation.z += dt * item.speed;
    if (item.type === 'turn') item.object.rotation.y += dt * item.speed;
    if (item.type === 'pulse') {
      const scale = 1 + Math.sin(elapsed * item.speed) * .055;
      item.object.scale.copy(item.base).multiplyScalar(scale);
    }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

function updateLocalMovement(dt) {
  if (!state.joined || !world.local) {
    state.moving = false;
    state.movementReferenceYaw = null;
    return;
  }
  let forward = 0;
  let side = 0;
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) forward += 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) forward -= 1;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) side -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) side += 1;
  const moving = forward !== 0 || side !== 0;
  state.moving = moving;
  if (world.local.seated) {
    if (world.local.seatLocked || !moving) {
      state.moving = false;
      state.movementReferenceYaw = null;
      if (!world.local.emote) setAvatarAction(world.local, 'sit');
      return;
    }
    releaseSeat(world.local);
  }
  if (moving) {
    if (state.movementReferenceYaw === null) state.movementReferenceYaw = state.cameraYaw;
    const input = new THREE.Vector2(side, forward).normalize();
    const sin = Math.sin(state.movementReferenceYaw);
    const cos = Math.cos(state.movementReferenceYaw);
    const dx = (-input.x * cos + input.y * sin) * 4.2 * dt;
    const dz = (input.x * sin + input.y * cos) * 4.2 * dt;
    const nextPosition = clampRoomPosition(world.local.root.position.x + dx, world.local.root.position.z + dz);
    world.local.root.position.set(nextPosition.x, world.local.root.position.y, nextPosition.z);
    world.local.root.rotation.y = Math.atan2(dx, dz);
    if (!world.local.emote) setAvatarAction(world.local, world.local.airborne ? 'idle' : 'walk');
  } else {
    state.movementReferenceYaw = null;
    if (!world.local.emote) setAvatarAction(world.local, 'idle');
  }

  const now = performance.now();
  if ((moving || world.local.airborne) && now - state.lastMoveBroadcast > 100) {
    state.lastMoveBroadcast = now;
    broadcastData({ t: 'move', x: world.local.root.position.x, z: world.local.root.position.z, r: world.local.root.rotation.y });
  }
}

function updateCamera(dt) {
  const target = world.local?.root.position || new THREE.Vector3(0, 0, 2);
  if (state.moving && world.local && !world.local.seatLocked) {
    const followBlend = 1 - Math.exp(-CAMERA_FOLLOW_DAMPING * dt);
    state.cameraYaw = lerpAngle(state.cameraYaw, world.local.root.rotation.y, followBlend);
  }
  const horizontal = Math.cos(state.cameraPitch) * state.cameraDistance;
  const desired = new THREE.Vector3(
    target.x - Math.sin(state.cameraYaw) * horizontal,
    target.y + Math.sin(state.cameraPitch) * state.cameraDistance + 2,
    target.z - Math.cos(state.cameraYaw) * horizontal
  );
  camera.position.lerp(desired, 1 - Math.pow(.002, dt));
  camera.lookAt(target.x, target.y + 1.25, target.z);
}

// PRESENCE AND CHAT
async function currentPeople(eventId = state.eventId) {
  const rows = await dbGet('presence', { event_id: eventId }, 160);
  const latest = new Map();
  for (const row of rows) {
    const old = latest.get(row.client_id);
    const time = new Date(row.created_at || row._created_at).getTime();
    if (!old || time > old.time) latest.set(row.client_id, { row, time });
  }
  const now = Date.now();
  return [...latest.values()].filter(item => now - item.time < PRESENCE_TTL && item.row.status !== 'left').map(item => item.row);
}

async function sendPresence(status = 'online') {
  if (!state.joined && !['joining', 'left'].includes(status)) return;
  const position = world.local?.root.position || { x: 0, z: 5 };
  await dbPost('presence', {
    event_id: state.eventId,
    client_id: state.clientId,
    name: state.name,
    role: state.role,
    x: Number(position.x.toFixed(3)),
    z: Number(position.z.toFixed(3)),
    rotation: Number((world.local?.root.rotation.y || 0).toFixed(3)),
    color: state.color,
    status,
    created_at: new Date().toISOString()
  });
}

async function pollPresence() {
  if (!state.joined) return;
  try {
    const [people, profiles] = await Promise.all([
      currentPeople(),
      fetchAvatarProfiles().catch(error => {
        console.warn('[avatar-profiles]', error);
        return state.avatarProfiles;
      })
    ]);
    state.avatarProfiles = profiles;
    state.people.clear();
    for (const person of people) {
      person.avatarProfile = profiles.get(person.client_id) || normalizeAvatarProfile({ primaryColor: person.color });
      person.color = person.avatarProfile.primaryColor;
      state.people.set(person.client_id, person);
      if (person.client_id !== state.clientId) updateRemoteAvatar(person);
    }
    state.people.set(state.clientId, {
      event_id: state.eventId,
      client_id: state.clientId,
      name: state.name,
      role: state.role,
      color: state.color,
      avatarProfile: state.avatarProfile,
      x: world.local?.root.position.x || 0,
      z: world.local?.root.position.z || 5,
      rotation: world.local?.root.rotation.y || 0
    });
    if (isHostRole() && state.roomLocked) {
      let seatingChanged = false;
      for (const person of people) seatingChanged = ensureSeatForPeer(person.client_id) || seatingChanged;
      if (seatingChanged) {
        const payload = roomControlPayload();
        applyRoomControl(payload);
        broadcastData(payload);
      }
    }
    for (const [id] of world.avatars) if (id !== state.clientId && !state.people.has(id)) removeAvatar(id);
    for (const [id, peer] of state.peers) {
      if (!state.people.has(id) && Date.now() - peer.lastSeen > PRESENCE_TTL + 4_000) closePeer(id);
    }
    for (const person of people) {
      if (person.client_id !== state.clientId && !state.peers.has(person.client_id) && state.clientId.localeCompare(person.client_id) < 0) {
        await createPeer(person.client_id, true);
      }
    }
    renderPeople();
  } catch (error) {
    console.warn('[presence]', error);
  }
}

function renderPeople() {
  const people = [...state.people.values()].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name));
  ui.capacity.textContent = `${people.length} / ${MAX_PEOPLE}`;
  ui.stack.replaceChildren();
  for (const person of people.slice(0, 5).reverse()) {
    const dot = document.createElement('span');
    dot.className = 'stack-dot';
    dot.style.background = person.color;
    dot.textContent = initials(person.name);
    dot.title = person.name;
    ui.stack.append(dot);
  }
  ui.peopleList.replaceChildren();
  for (const person of people) {
    const button = document.createElement('button');
    button.className = 'person-row';
    button.type = 'button';
    const avatar = document.createElement('span');
    avatar.className = 'person-avatar';
    avatar.style.background = person.color;
    avatar.textContent = initials(person.name);
    const info = document.createElement('span');
    info.className = 'person-info';
    const name = document.createElement('strong');
    name.textContent = person.client_id === state.clientId ? `${person.name} (du)` : person.name;
    const status = document.createElement('span');
    status.textContent = person.role === 'host' ? 'Raum-Host' : person.role === 'cohost' ? 'Cohost mit Raumkontrolle' : 'Guest im Raum';
    info.append(name, status);
    button.append(avatar, info);
    if (isHostRole(person.role)) {
      const chip = document.createElement('span');
      chip.className = 'role-chip';
      chip.textContent = person.role === 'host' ? 'HOST' : 'COHOST';
      button.append(chip);
    }
    button.addEventListener('click', () => mentionPerson(person.name));
    ui.peopleList.append(button);
  }
}

function mentionPerson(name) {
  openPanel('chat');
  const prefix = ui.chatInput.value.trim() ? `${ui.chatInput.value.trim()} ` : '';
  ui.chatInput.value = `${prefix}@${name} `;
  ui.chatInput.focus();
  resizeTextarea();
}

async function pollMessages() {
  if (!state.joined) return;
  try {
    const rows = await dbGet('messages', { event_id: state.eventId }, 100);
    rows.sort((a, b) => (a._id || 0) - (b._id || 0));
    let added = 0;
    for (const row of rows) {
      const key = row._id || `${row.client_id}-${row.created_at}-${row.text}`;
      if (state.renderedMessages.has(key)) continue;
      state.renderedMessages.add(key);
      renderMessage(row);
      if (row.client_id !== state.clientId && row.client_id !== 'system') added++;
    }
    if (added && !ui.chatPanel.classList.contains('open')) {
      state.unread += added;
      updateUnread();
    }
    if (added) ui.messages.scrollTop = ui.messages.scrollHeight;
  } catch (error) {
    console.warn('[chat]', error);
  }
}

function renderMessage(row) {
  if (row.client_id === 'system') {
    const system = document.createElement('div');
    system.className = 'system-message';
    system.textContent = row.text;
    ui.messages.append(system);
    return;
  }
  const message = document.createElement('article');
  const mentioned = mentionsCurrentUser(row);
  message.className = `message${mentioned ? ' mentioned' : ''}`;
  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  avatar.style.background = hashColor(row.client_id);
  avatar.textContent = initials(row.name);
  const content = document.createElement('div');
  content.className = 'message-content';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const sender = document.createElement('strong');
  sender.textContent = row.name;
  const time = document.createElement('time');
  time.textContent = displayTime(row.created_at || row._created_at);
  meta.append(sender, time);
  const text = document.createElement('p');
  text.className = 'message-text';
  appendMentionText(text, row.text);
  content.append(meta, text);
  message.append(avatar, content);
  ui.messages.append(message);
  if (mentioned && row.client_id !== state.clientId) notify(`${row.name} hat dich im Chat erwähnt.`, 'success');
}

function mentionsCurrentUser(row) {
  const mentions = Array.isArray(row.mentions) ? row.mentions : [];
  return mentions.some(name => String(name).toLowerCase() === state.name.toLowerCase()) || String(row.text).toLowerCase().includes(`@${state.name.toLowerCase()}`);
}

function appendMentionText(container, value) {
  const names = [...state.people.values()].map(person => person.name).sort((a, b) => b.length - a.length);
  const pattern = names.length ? new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))`, 'gi') : /(@\w+)/g;
  for (const part of String(value || '').split(pattern)) {
    if (part.startsWith('@')) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      container.append(mark);
    } else container.append(document.createTextNode(part));
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sendChat(event) {
  event.preventDefault();
  const text = ui.chatInput.value.trim();
  if (!text) return;
  const mentions = [...state.people.values()].filter(person => text.toLowerCase().includes(`@${person.name.toLowerCase()}`)).map(person => person.name);
  const button = ui.chatForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const row = {
      event_id: state.eventId,
      client_id: state.clientId,
      name: state.name,
      text,
      mentions,
      created_at: new Date().toISOString()
    };
    await reliableDbPost('messages', row, { event_id: state.eventId, client_id: state.clientId, created_at: row.created_at }, 3);
    ui.chatInput.value = '';
    resizeTextarea();
    await pollMessages();
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

// WEBRTC MESH: hosts publish microphone and screen, all participants receive.
function rtcConfig() {
  return { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }], iceCandidatePoolSize: 4 };
}

let signalPostQueue = Promise.resolve();

function waitForIceGathering(pc, timeout = 5_000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, timeout);
    function done() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', change);
      resolve();
    }
    function change() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', change);
  });
}

async function createPeer(peerId, initiator = false) {
  if (peerId === state.clientId) return null;
  if (state.peers.has(peerId)) {
    state.peers.get(peerId).lastSeen = Date.now();
    return state.peers.get(peerId);
  }
  const pc = new RTCPeerConnection(rtcConfig());
  const peer = { id: peerId, pc, channel: null, lastSeen: Date.now(), makingOffer: false };
  state.peers.set(peerId, peer);

  // Non-trickle ICE: Offer und Antwort werden erst nach dem Candidate-Gathering
  // als je eine atomare Datenbankzeile gesendet. Das ist auf dem JSON-Host
  // zuverlässiger als mehrere gleichzeitig eintreffende Candidate-POSTs.
  pc.onicecandidate = () => {};
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') peer.lastSeen = Date.now();
    if (['failed', 'closed'].includes(pc.connectionState)) closePeer(peerId);
    if (pc.connectionState === 'disconnected') setTimeout(() => {
      if (pc.connectionState === 'disconnected') closePeer(peerId);
    }, 8_000);
  };
  pc.ontrack = event => handleRemoteTrack(peerId, event.track);
  pc.ondatachannel = event => bindDataChannel(peer, event.channel);

  if (initiator) {
    bindDataChannel(peer, pc.createDataChannel('world', { ordered: false, maxRetransmits: 2 }));
    const audio = pc.addTransceiver('audio', { direction: isHostRole() ? 'sendrecv' : 'recvonly' });
    const video = pc.addTransceiver('video', { direction: isHostRole() ? 'sendrecv' : 'recvonly' });
    if (isHostRole()) {
      await audio.sender.replaceTrack(state.micStream?.getAudioTracks()[0] || null);
      await video.sender.replaceTrack(state.screenStream?.getVideoTracks()[0] || null);
    }
    await makeOffer(peer);
  }
  return peer;
}

async function makeOffer(peer) {
  if (peer.makingOffer || peer.pc.signalingState !== 'stable') return;
  peer.makingOffer = true;
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    await waitForIceGathering(peer.pc);
    await sendSignal(peer.id, 'offer', peer.pc.localDescription.toJSON());
  } finally {
    peer.makingOffer = false;
  }
}

function bindDataChannel(peer, channel) {
  peer.channel = channel;
  channel.onopen = () => {
    peer.lastSeen = Date.now();
    if (world.local) channel.send(JSON.stringify({ t: 'move', x: world.local.root.position.x, z: world.local.root.position.z, r: world.local.root.rotation.y }));
    if (isHostRole() && (state.roomLocked || state.seatAssignments.size)) {
      ensureSeatForPeer(peer.id);
      const payload = roomControlPayload();
      applyRoomControl(payload);
      broadcastData(payload);
    }
  };
  channel.onmessage = event => {
    peer.lastSeen = Date.now();
    try {
      const data = JSON.parse(event.data);
      if (data.t === 'move') {
        const avatar = world.avatars.get(peer.id);
        if (avatar && !avatar.seatLocked) {
          if (avatar.seated) releaseSeat(avatar);
          const target = clampRoomPosition(Number(data.x) || 0, Number(data.z) || 0);
          avatar.root.userData.target.set(target.x, 0, target.z);
          avatar.root.userData.targetRotation = Number(data.r) || 0;
        }
      } else if (data.t === 'jump') {
        startAvatarJump(world.avatars.get(peer.id), Boolean(data.double), false);
      } else if (data.t === 'emote') {
        triggerEmote(data.emote, world.avatars.get(peer.id), false);
      } else if (data.t === 'room-control' && hostRoleForPeer(peer.id)) {
        applyRoomControl(data);
      }
    } catch (_) {}
  };
}

function broadcastData(payload) {
  const data = JSON.stringify(payload);
  for (const peer of state.peers.values()) if (peer.channel?.readyState === 'open') peer.channel.send(data);
}

async function sendSignal(toId, type, payload) {
  const row = { event_id: state.eventId, from_id: state.clientId, to_id: toId, type, payload, created_at: new Date().toISOString() };
  const post = () => reliableDbPost('signals', row, { event_id: state.eventId, from_id: state.clientId, to_id: toId, type, created_at: row.created_at }, 6);
  signalPostQueue = signalPostQueue.catch(() => {}).then(post);
  return signalPostQueue;
}

async function pollSignals() {
  if (!state.joined) return;
  try {
    const rows = await dbGet('signals', { event_id: state.eventId, to_id: state.clientId }, 100);
    rows.sort((a, b) => (a._id || 0) - (b._id || 0));
    for (const signal of rows) {
      const key = signal._id || `${signal.from_id}-${signal.created_at}-${signal.type}`;
      if (state.processedSignals.has(key)) continue;
      state.processedSignals.add(key);
      await handleSignal(signal);
    }
    if (state.processedSignals.size > 600) state.processedSignals = new Set([...state.processedSignals].slice(-300));
  } catch (error) {
    console.warn('[signals]', error);
  }
}

async function handleSignal(signal) {
  if (signal.from_id === state.clientId) return;
  const peer = await createPeer(signal.from_id, false);
  if (!peer) return;
  peer.lastSeen = Date.now();
  const payload = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
  if (signal.type === 'offer') {
    await peer.pc.setRemoteDescription(payload);
    for (const transceiver of peer.pc.getTransceivers()) transceiver.direction = isHostRole() ? 'sendrecv' : 'recvonly';
    await syncLocalTracks(peer.pc);
    await flushCandidates(signal.from_id, peer.pc);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    await waitForIceGathering(peer.pc);
    await sendSignal(signal.from_id, 'answer', peer.pc.localDescription.toJSON());
  } else if (signal.type === 'answer') {
    if (peer.pc.signalingState === 'have-local-offer') await peer.pc.setRemoteDescription(payload);
    await flushCandidates(signal.from_id, peer.pc);
  } else if (signal.type === 'candidate') {
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(payload).catch(console.warn);
    else {
      const queue = state.pendingCandidates.get(signal.from_id) || [];
      queue.push(payload);
      state.pendingCandidates.set(signal.from_id, queue);
    }
  } else if (signal.type === 'bye') closePeer(signal.from_id);
}

async function flushCandidates(peerId, pc) {
  const queue = state.pendingCandidates.get(peerId) || [];
  state.pendingCandidates.delete(peerId);
  for (const candidate of queue) await pc.addIceCandidate(candidate).catch(console.warn);
}

async function syncLocalTracks(pc) {
  if (!isHostRole()) return;
  const audioTrack = state.micStream?.getAudioTracks()[0] || null;
  const videoTrack = state.screenStream?.getVideoTracks()[0] || null;
  for (const transceiver of pc.getTransceivers()) {
    const kind = transceiver.receiver?.track?.kind;
    if (kind === 'audio') await transceiver.sender.replaceTrack(audioTrack);
    if (kind === 'video') await transceiver.sender.replaceTrack(videoTrack);
  }
}

async function replaceTrackForAll(kind, track) {
  await Promise.all([...state.peers.values()].map(async peer => {
    const transceiver = peer.pc.getTransceivers().find(item => item.receiver?.track?.kind === kind);
    if (transceiver) await transceiver.sender.replaceTrack(track);
  }));
}

function handleRemoteTrack(peerId, track) {
  if (track.kind === 'audio') {
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio-${peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.hidden = true;
      document.body.append(audio);
    }
    audio.srcObject = new MediaStream([track]);
    audio.play().catch(() => {
      state.audioBlocked = true;
      notify('Tippe einmal auf die Seite, um den Live-Ton zu aktivieren.');
    });
    track.onended = () => audio.remove();
  }
  if (track.kind === 'video') {
    ui.stageVideo.srcObject = new MediaStream([track]);
    ui.mediaStage.hidden = false;
    ui.stageVideo.play().then(applyStageVideo).catch(() => {});
    track.onunmute = () => {
      ui.mediaStage.hidden = false;
      ui.stageVideo.play().then(applyStageVideo).catch(() => {});
    };
    track.onended = clearStageVideo;
  }
}

function closePeer(peerId) {
  const peer = state.peers.get(peerId);
  if (!peer) return;
  peer.channel?.close();
  peer.pc.close();
  state.peers.delete(peerId);
  document.getElementById(`audio-${peerId}`)?.remove();
}

async function toggleMicrophone() {
  if (!isHostRole()) return;
  if (state.micStream) {
    state.micStream.getTracks().forEach(track => track.stop());
    state.micStream = null;
    await replaceTrackForAll('audio', null);
    setButtonLive(ui.mic, false, 'Stumm', 'Mikrofon');
    notify('Mikrofon-Broadcast beendet.');
    return;
  }
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    await replaceTrackForAll('audio', state.micStream.getAudioTracks()[0]);
    setButtonLive(ui.mic, true, 'Live', 'Mikrofon');
    notify('Deine Stimme wird jetzt an den Eventraum übertragen.', 'success');
  } catch (error) {
    notify(error.name === 'NotAllowedError' ? 'Mikrofonzugriff wurde nicht erlaubt.' : 'Mikrofon konnte nicht gestartet werden.', 'error');
  }
}

async function toggleScreenShare() {
  if (!isHostRole()) return;
  if (state.screenStream) {
    stopScreenShare();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    notify('Dieser Browser unterstützt Screensharing nicht. Nutze Chrome oder Safari auf einem Computer.', 'error');
    return;
  }
  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 15, max: 24 } }, audio: false });
    const track = state.screenStream.getVideoTracks()[0];
    track.contentHint = 'detail';
    track.onended = stopScreenShare;
    await replaceTrackForAll('video', track);
    ui.stageVideo.srcObject = state.screenStream;
    ui.mediaStage.hidden = false;
    await ui.stageVideo.play().catch(() => {});
    applyStageVideo();
    ui.share.classList.add('sharing');
    ui.share.querySelector('span:last-child').textContent = 'Teilen stoppen';
    ui.share.setAttribute('aria-pressed', 'true');
    notify('Dein Bildschirm ist jetzt auf der Main Stage sichtbar.', 'success');
  } catch (error) {
    if (error.name !== 'NotAllowedError') notify('Bildschirm konnte nicht geteilt werden.', 'error');
  }
}

async function stopScreenShare() {
  if (!state.screenStream) return;
  const stream = state.screenStream;
  state.screenStream = null;
  stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
  await replaceTrackForAll('video', null).catch(() => {});
  clearStageVideo();
  ui.share.classList.remove('sharing');
  ui.share.querySelector('span:last-child').textContent = 'Screen teilen';
  ui.share.setAttribute('aria-pressed', 'false');
  notify('Screensharing beendet.');
}

// UI AND SESSION LIFECYCLE
async function joinEvent(event) {
  event.preventDefault();
  const form = new FormData(ui.joinForm);
  const name = String(form.get('name') || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    ui.joinError.textContent = 'Bitte gib einen Namen mit mindestens zwei Zeichen ein.';
    return;
  }
  const submit = ui.joinForm.querySelector('button[type="submit"]');
  updateAvatarProfileFromControls();
  submit.disabled = true;
  ui.joinError.textContent = '';
  try {
    const requestedRoomTitle = String(form.get('room-name') || '').trim().replace(/\s+/g, ' ');
    const generatedRoomTitle = requestedRoomTitle === ui.roomName.dataset.generatedRoomName;
    const access = state.entryMode === 'create'
      ? await createUniqueRoom(requestedRoomTitle, form.get('room-template'), generatedRoomTitle)
      : state.entryMode === 'public'
        ? state.publicAccess || await resolvePublicRoom(new URLSearchParams(location.search).get('room'))
        : await resolveInviteCode(form.get('invite-code'));
    await enterRoom({ ...access, name });
    if (access.roomOwner) setTimeout(showInviteConsole, 450);
  } catch (error) {
    ui.joinError.textContent = error.message || 'Der Raum konnte nicht betreten werden.';
    state.joined = false;
  } finally {
    submit.disabled = false;
  }
}

async function enterRoom({ roomId, title, role, roomOwner, inviteCodes, name, templateId = null }) {
  const [people, resolvedTemplate] = await Promise.all([
    currentPeople(roomId),
    templateId ? Promise.resolve(normalizeSpaceTemplate(templateId)) : loadRoomTemplate(roomId)
  ]);
  if (people.length >= MAX_PEOPLE) throw new Error(`Dieser Raum ist bereits voll. Maximal ${MAX_PEOPLE} Personen können teilnehmen.`);
  state.eventId = roomId;
  state.roomTitle = title;
  state.templateId = resolvedTemplate;
  state.roomOwner = roomOwner;
  state.inviteCodes = inviteCodes;
  state.name = name;
  state.role = role;
  state.avatarProfile = normalizeAvatarProfile(state.avatarProfile);
  state.color = state.avatarProfile.primaryColor;
  localStorage.setItem('mr-display-name', name);
  rememberVisitedSpace(roomId, title);
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('room', roomId);
  history.replaceState({}, '', url);
  ui.eventLabel.textContent = title.toUpperCase();
  ui.chatRoomScope.textContent = `ROOM: ${title.toUpperCase()}`;
  const spawnIndex = people.length;
  const angle = (spawnIndex / MAX_PEOPLE) * Math.PI * 2;
  addWorld(state.templateId);
  await saveAvatarProfile();
  createAvatar({ client_id: state.clientId, name, role, color: state.color, avatarProfile: state.avatarProfile, x: Math.sin(angle) * 3.2, z: 5 + Math.cos(angle) * 2.2, rotation: Math.PI }, true);
  state.joined = true;
  await sendPresence('online');
  ui.join.close();
  document.body.classList.add('joined');
  document.body.classList.toggle('is-host', isHostRole());
  ui.mic.disabled = !isHostRole();
  ui.share.disabled = !isHostRole() || !navigator.mediaDevices?.getDisplayMedia;
  ui.hostRoomControls.hidden = !isHostRole();
  updateRoomControlUi();
  ui.mic.title = isHostRole() ? 'Mikrofon an alle übertragen' : 'Nur Host und Cohosts können senden';
  ui.share.title = !navigator.mediaDevices?.getDisplayMedia ? 'Screensharing ist auf diesem Browser nicht verfügbar' : isHostRole() ? 'Bildschirm auf der Bühne teilen' : 'Nur Host und Cohosts können teilen';
  startRealtime();
  await Promise.all([pollPresence(), pollSignals(), pollMessages(), pollPortals()]);
  notify(role === 'host' ? `Dein Raum „${title}“ ist bereit.` : `Willkommen in „${title}“ als ${role === 'cohost' ? 'Cohost' : 'Guest'}.`, 'success');
}

function startRealtime() {
  clearRealtime();
  state.intervals.push(setInterval(() => sendPresence().catch(console.warn), HEARTBEAT_MS));
  state.intervals.push(setInterval(pollPresence, POLL_PRESENCE_MS));
  state.intervals.push(setInterval(pollSignals, POLL_SIGNALS_MS));
  state.intervals.push(setInterval(pollMessages, POLL_CHAT_MS));
  state.intervals.push(setInterval(pollPortals, POLL_PORTALS_MS));
}

function clearRealtime() {
  state.intervals.forEach(clearInterval);
  state.intervals = [];
}

function leaveEvent() {
  if (!state.joined) return;
  state.joined = false;
  clearRealtime();
  sendPresence('left').catch(() => {});
  for (const id of state.peers.keys()) {
    sendSignal(id, 'bye', {}).catch(() => {});
    closePeer(id);
  }
  state.micStream?.getTracks().forEach(track => track.stop());
  state.screenStream?.getTracks().forEach(track => track.stop());
}

function openPanel(type) {
  ui.emoteTray.hidden = true;
  ui.emote.classList.remove('active');
  ui.emote.setAttribute('aria-expanded', 'false');
  const chat = type === 'chat';
  ui.chatPanel.classList.toggle('open', chat ? !ui.chatPanel.classList.contains('open') : false);
  ui.peoplePanel.classList.toggle('open', !chat ? !ui.peoplePanel.classList.contains('open') : false);
  ui.chat.classList.toggle('active', ui.chatPanel.classList.contains('open'));
  ui.people.classList.toggle('active', ui.peoplePanel.classList.contains('open'));
  if (ui.chatPanel.classList.contains('open')) {
    state.unread = 0;
    updateUnread();
    setTimeout(() => ui.chatInput.focus(), 220);
  }
}

function updateUnread() {
  ui.unread.hidden = state.unread === 0;
  ui.unread.textContent = String(Math.min(state.unread, 99));
}

function resizeTextarea() {
  ui.chatInput.style.height = 'auto';
  ui.chatInput.style.height = `${Math.min(ui.chatInput.scrollHeight, 110)}px`;
}

function updateMentionSuggestions() {
  const match = ui.chatInput.value.match(/@([^\s@]*)$/);
  if (!match) {
    ui.mentions.hidden = true;
    return;
  }
  const query = match[1].toLowerCase();
  const matches = [...state.people.values()].filter(person => person.client_id !== state.clientId && person.name.toLowerCase().includes(query)).slice(0, 5);
  ui.mentions.replaceChildren();
  for (const person of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `@${person.name}`;
    button.addEventListener('click', () => {
      ui.chatInput.value = ui.chatInput.value.replace(/@[^\s@]*$/, `@${person.name} `);
      ui.mentions.hidden = true;
      ui.chatInput.focus();
    });
    ui.mentions.append(button);
  }
  ui.mentions.hidden = matches.length === 0;
}

function setEntryMode(mode) {
  state.entryMode = mode === 'public' ? 'public' : mode === 'join' ? 'join' : 'create';
  const joining = state.entryMode === 'join';
  const publicEntry = state.entryMode === 'public';
  ui.entryTabs.hidden = publicEntry;
  ui.createPanel.hidden = joining || publicEntry;
  ui.joinPanel.hidden = !joining;
  ui.publicRoomPanel.hidden = !publicEntry;
  ui.createMode.classList.toggle('active', !joining && !publicEntry);
  ui.joinMode.classList.toggle('active', joining);
  ui.createMode.setAttribute('aria-selected', String(!joining && !publicEntry));
  ui.joinMode.setAttribute('aria-selected', String(joining));
  ui.roomName.required = !joining && !publicEntry;
  ui.inviteCode.required = joining;
  ui.enterLabel.textContent = publicEntry ? 'Space als Guest betreten' : joining ? 'Mit Invite-Code beitreten' : 'Eigenen Raum erstellen';
  ui.joinError.textContent = '';
  setTimeout(() => (publicEntry ? ui.name : joining ? ui.inviteCode : ui.roomName).focus(), 0);
}

async function preparePublicDeepLink() {
  const roomId = new URLSearchParams(location.search).get('room');
  if (!roomId || new URLSearchParams(location.search).has('portal')) return false;
  setEntryMode('public');
  ui.publicRoomTitle.textContent = 'Space wird geladen …';
  try {
    state.publicAccess = await resolvePublicRoom(roomId);
    ui.publicRoomTitle.textContent = state.publicAccess.title;
    ui.eventLabel.textContent = state.publicAccess.title.toUpperCase();
    return true;
  } catch (error) {
    state.publicAccess = null;
    ui.joinError.textContent = error.message || 'Dieser Space-Link konnte nicht geöffnet werden.';
    ui.enterLabel.textContent = 'Space nicht verfügbar';
    ui.joinForm.querySelector('button[type="submit"]').disabled = true;
    return false;
  }
}

function showInviteConsole() {
  if (!state.roomOwner || !state.inviteCodes) {
    notify('Die Invite-Codes sind nur beim Haupt-Host verfügbar.');
    return;
  }
  ui.guestInviteCode.textContent = state.inviteCodes.guest;
  ui.cohostInviteCode.textContent = state.inviteCodes.cohost;
  ui.inviteDialog.showModal();
}

async function copyInvite(role) {
  const code = state.inviteCodes?.[role];
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    notify(`${role === 'cohost' ? 'Cohost' : 'Guest'}-Code kopiert.`, 'success');
  } catch (_) {
    prompt('Invite-Code kopieren:', code);
  }
}

function unlockAudio() {
  if (!state.audioBlocked) return;
  state.audioBlocked = false;
  $$('audio').forEach(audio => audio.play().catch(() => {}));
}

function bindUi() {
  syncJoinViewport();
  setAvatarControls(loadAvatarProfile());
  ui.name.value = localStorage.getItem('mr-display-name') || '';
  setSuggestedRoomTitle();
  ui.inviteCode.value = normalizeInviteCode(new URLSearchParams(location.search).get('invite') || '');
  ui.eventLabel.textContent = 'NEW SPACE';
  setEntryMode(state.entryMode);
  $$('[data-entry-mode]').forEach(button => button.addEventListener('click', () => setEntryMode(button.dataset.entryMode)));
  ui.avatarCustomizer.addEventListener('input', updateAvatarProfileFromControls);
  ui.avatarCustomizer.addEventListener('change', updateAvatarProfileFromControls);
  ui.roomName.addEventListener('input', () => {
    if (ui.roomName.value !== ui.roomName.dataset.generatedRoomName) delete ui.roomName.dataset.generatedRoomName;
  });
  ui.inviteCode.addEventListener('blur', () => { ui.inviteCode.value = normalizeInviteCode(ui.inviteCode.value); });
  ui.joinForm.addEventListener('focusin', () => setTimeout(syncJoinViewport, 60));
  for (const input of [ui.roomName, ui.inviteCode]) {
    input.addEventListener('keydown', event => {
      const activeMode = input === ui.roomName ? 'create' : 'join';
      if (event.key !== 'Enter' || state.entryMode !== activeMode) return;
      event.preventDefault();
      ui.joinForm.requestSubmit();
    });
  }
  ui.joinForm.addEventListener('submit', joinEvent);
  ui.chatForm.addEventListener('submit', sendChat);
  ui.chatInput.addEventListener('input', () => { resizeTextarea(); updateMentionSuggestions(); });
  ui.chatInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ui.chatForm.requestSubmit();
    }
  });
  ui.people.addEventListener('click', () => openPanel('people'));
  ui.chat.addEventListener('click', () => openPanel('chat'));
  ui.invite.addEventListener('click', showInviteConsole);
  $$('[data-copy-invite]').forEach(button => button.addEventListener('click', () => copyInvite(button.dataset.copyInvite)));
  ui.emote.addEventListener('click', event => {
    event.stopPropagation();
    const opening = ui.emoteTray.hidden;
    if (opening) {
      ui.chatPanel.classList.remove('open');
      ui.peoplePanel.classList.remove('open');
      ui.chat.classList.remove('active');
      ui.people.classList.remove('active');
    }
    ui.emoteTray.hidden = !opening;
    ui.emote.classList.toggle('active', opening);
    ui.emote.setAttribute('aria-expanded', String(opening));
  });
  $$('[data-emote]').forEach(button => button.addEventListener('click', () => {
    triggerEmote(button.dataset.emote);
    ui.emoteTray.hidden = true;
    ui.emote.classList.remove('active');
    ui.emote.setAttribute('aria-expanded', 'false');
  }));
  addEventListener('pointerdown', event => {
    if (ui.emoteTray.hidden || ui.emoteTray.contains(event.target) || ui.emote.contains(event.target)) return;
    ui.emoteTray.hidden = true;
    ui.emote.classList.remove('active');
    ui.emote.setAttribute('aria-expanded', 'false');
  });
  ui.mic.addEventListener('click', toggleMicrophone);
  ui.share.addEventListener('click', toggleScreenShare);
  ui.seatAll.addEventListener('click', seatAllPeople);
  ui.lockSeats.addEventListener('click', lockAllSeats);
  ui.unlockSeats.addEventListener('click', unlockAllSeats);
  ui.portalsButton.addEventListener('click', () => {
    renderPortalList();
    ui.portalDialog.showModal();
  });
  ui.portalForm.addEventListener('submit', createPortal);
  ui.portalTargetCode.addEventListener('blur', () => { ui.portalTargetCode.value = normalizeInviteCode(ui.portalTargetCode.value); });
  ui.portalPrompt.addEventListener('click', travelThroughPortal);
  $('#close-room-arrival').addEventListener('click', () => { ui.roomArrival.hidden = true; });
  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));
  $('#close-hint').addEventListener('click', () => $('#world-hint').classList.add('hide'));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => {
    document.getElementById(button.dataset.close)?.classList.remove('open');
    ui.people.classList.remove('active');
    ui.chat.classList.remove('active');
  }));
  $('#minimise-stage').addEventListener('click', () => ui.mediaStage.classList.toggle('minimised'));
  addEventListener('keydown', event => {
    const movementKey = /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(event.code);
    if (event.target.matches('input,textarea') || (event.target.matches('button') && !movementKey)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) requestJump();
      return;
    }
    if (event.code === 'KeyE' && state.nearbyPortalId) {
      event.preventDefault();
      travelThroughPortal();
      return;
    }
    state.keys.add(event.code);
    if (event.code === 'Slash' && event.shiftKey) ui.help.showModal();
  });
  addEventListener('keyup', event => {
    state.keys.delete(event.code);
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(event.code)) state.movementReferenceYaw = null;
  });
  addEventListener('blur', () => {
    state.keys.clear();
    state.moving = false;
    state.movementReferenceYaw = null;
  });
  addEventListener('pointerdown', unlockAudio, { passive: true });
  addEventListener('beforeunload', leaveEvent);
  addEventListener('pagehide', leaveEvent);
  window.visualViewport?.addEventListener('resize', syncJoinViewport);
  window.visualViewport?.addEventListener('scroll', syncJoinViewport);
  addEventListener('resize', () => {
    syncJoinViewport();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.8));
  });

  ui.canvas.addEventListener('pointerdown', event => {
    state.dragging = true;
    state.dragX = event.clientX;
    state.dragY = event.clientY;
    ui.canvas.setPointerCapture?.(event.pointerId);
  });
  ui.canvas.addEventListener('pointermove', event => {
    if (!state.dragging) return;
    const dx = event.clientX - state.dragX;
    const dy = event.clientY - state.dragY;
    if (!state.moving) state.cameraYaw -= dx * .006;
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + dy * .004, .12, .82);
    state.dragX = event.clientX;
    state.dragY = event.clientY;
  });
  const endDrag = () => { state.dragging = false; };
  ui.canvas.addEventListener('pointerup', endDrag);
  ui.canvas.addEventListener('pointercancel', endDrag);
  ui.canvas.addEventListener('wheel', event => {
    state.cameraDistance = THREE.MathUtils.clamp(state.cameraDistance + event.deltaY * .008, 5.5, 15);
  }, { passive: true });

  $$('#mobile-move button[data-key]').forEach(button => {
    const start = event => { event.preventDefault(); state.keys.add(button.dataset.key); button.classList.add('pressed'); };
    const stop = event => {
      event.preventDefault();
      state.keys.delete(button.dataset.key);
      state.movementReferenceYaw = null;
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('pointerleave', stop);
  });
  $('#mobile-move [data-action="jump"]').addEventListener('pointerdown', event => {
    event.preventDefault();
    requestJump();
    event.currentTarget.classList.add('pressed');
  });
  const stopMobileJump = event => event.currentTarget.classList.remove('pressed');
  $('#mobile-move [data-action="jump"]').addEventListener('pointerup', stopMobileJump);
  $('#mobile-move [data-action="jump"]').addEventListener('pointercancel', stopMobileJump);
}

Object.defineProperty(window, '__mrDiag', {
  configurable: false,
  get() {
    return {
      joined: state.joined,
      clientId: state.clientId,
      role: state.role,
      eventId: state.eventId,
      roomTitle: state.roomTitle,
      templateId: state.templateId,
      templateLabel: SPACE_TEMPLATES[state.templateId]?.label || SPACE_TEMPLATES[DEFAULT_SPACE_TEMPLATE].label,
      availableTemplateIds: Object.keys(SPACE_TEMPLATES),
      templateDecorations: world.templateDecorations,
      architectureType: world.architectureType,
      architectureObjects: [...world.architectureObjects],
      roomBounds: { ...world.roomBounds },
      floorArea: world.floorArea,
      floorShape: world.floorShape,
      floorSize: [...world.floorSize],
      stageVariant: SPACE_TEMPLATES[state.templateId]?.stageVariant || '',
      rendererStats: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures
      },
      roomOwner: state.roomOwner,
      inviteCodes: state.roomOwner ? state.inviteCodes : null,
      avatarProfile: { ...state.avatarProfile },
      avatarProfilePersisted: localStorage.getItem(AVATAR_STORAGE_KEY),
      portals: world.portals.size,
      portalTargets: [...world.portals.values()].map(portal => ({ id: portal.row.portal_id, label: portal.row.label, targetRoomId: portal.row.target_room_id, targetTitle: portal.row.target_title, position: portal.group.position.toArray() })),
      nearbyPortalId: state.nearbyPortalId,
      people: state.people.size,
      peers: state.peers.size,
      connectedPeers: [...state.peers.values()].filter(peer => peer.pc.connectionState === 'connected').length,
      openChannels: [...state.peers.values()].filter(peer => peer.channel?.readyState === 'open').length,
      remoteAudioElements: $$('audio[id^="audio-"]').length,
      stageVideoTracks: ui.stageVideo.srcObject?.getVideoTracks?.().length || 0,
      micLive: Boolean(state.micStream),
      screenLive: Boolean(state.screenStream),
      localPosition: world.local ? world.local.root.position.toArray() : null,
      cameraPosition: camera.position.toArray(),
      cameraYaw: state.cameraYaw,
      avatarRotation: world.local?.root.rotation.y ?? null,
      cameraMoving: state.moving,
      movementReferenceYaw: state.movementReferenceYaw,
      cameraFollowAngleError: world.local
        ? Math.abs(Math.atan2(Math.sin(state.cameraYaw - world.local.root.rotation.y), Math.cos(state.cameraYaw - world.local.root.rotation.y)))
        : null,
      airborne: Boolean(world.local?.airborne),
      jumpCount: world.local?.jumpCount || 0,
      flipRotation: world.local?.flipPivot.rotation.x || 0,
      activeEmote: world.local?.emote || '',
      emojiEffects: world.effects.length,
      roomLocked: state.roomLocked,
      seatCapacity: world.seats.length,
      seatAssignments: state.seatAssignments.size,
      seatFacings: world.seats.map((seat, index) => ({
        index,
        rotation: seat.rotation,
        alignment: stageFacingAlignment(seat)
      })),
      seated: Boolean(world.local?.seated),
      seatLocked: Boolean(world.local?.seatLocked),
      seatIndex: world.local?.seatIndex ?? -1,
      avatarStates: [...world.avatars.entries()].map(([clientId, avatar]) => ({
        clientId,
        local: avatar.local,
        role: avatar.person?.role || '',
        profile: avatar.profile ? { ...avatar.profile } : null,
        accessories: avatar.accessories?.children.map(object => object.name) || [],
        riggedAppearance: Boolean(avatar.accessories?.rigged),
        sourceAvatarMeshes: sourceAvatarMeshStats(avatar.model),
        y: avatar.root.position.y,
        airborne: avatar.airborne,
        jumpCount: avatar.jumpCount,
        flipRotation: avatar.flipPivot.rotation.x,
        emote: avatar.emote,
        seated: avatar.seated,
        seatLocked: avatar.seatLocked,
        seatIndex: avatar.seatIndex,
        rotation: avatar.root.rotation.y,
        stageFacingAlignment: stageFacingAlignment({
          x: avatar.root.position.x,
          z: avatar.root.position.z,
          rotation: avatar.root.rotation.y
        })
      }))
    };
  }
});

bindUi();
loadAvatarModel();
animate();
ui.join.showModal();
preparePublicDeepLink().catch(error => {
  ui.joinError.textContent = error.message || 'Dieser Space-Link konnte nicht geöffnet werden.';
});
resumePortalTravel().catch(error => {
  ui.joinError.textContent = error.message || 'Das Portal konnte nicht geöffnet werden.';
});
