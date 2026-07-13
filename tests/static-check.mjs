import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const [html, css, app, spacesHtml, spacesJs, avatar] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('spaces.html', root), 'utf8'),
  readFile(new URL('spaces.js', root), 'utf8'),
  readFile(new URL('public/assets/avatars/kaykit-rogue.glb', root))
]);

for (const required of ['join-dialog', 'invite-dialog', 'portal-dialog', 'portal-form', 'portal-prompt', 'create-mode-button', 'join-mode-button', 'room-name', 'invite-code', 'avatar-customizer', 'avatar-preview', 'avatar-primary-color', 'avatar-hair-color', 'world', 'chat-panel', 'people-panel', 'mic-button', 'share-button', 'stage-video', 'mobile-move', 'emote-button', 'emote-tray', 'host-room-controls', 'seat-all-button', 'lock-seats-button', 'unlock-seats-button', 'portals-button']) {
  assert.match(html, new RegExp(`id=["']${required}["']`), `Missing HTML element #${required}`);
}

for (const selector of app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)) {
  assert.match(html, new RegExp(`id=["']${selector[1]}["']`), `app.js refers to missing #${selector[1]}`);
}

assert.match(app, /const MAX_PEOPLE = 25/);
assert.match(app, /const SEAT_ROWS = \[/);
assert.match(app, /\{ count: 7, radius:/);
assert.match(app, /\{ count: 8, radius:/);
assert.match(app, /\{ count: 10, radius:/);
assert.match(html, /id=["']capacity-count["']>0 \/ 25</);
assert.match(app, /getDisplayMedia/);
assert.match(app, /getUserMedia/);
assert.match(app, /RTCPeerConnection/);
assert.match(app, /createDataChannel\('world'/);
assert.match(app, /mentionsCurrentUser/);
assert.match(app, /DOUBLE_JUMP_VELOCITY/);
assert.match(app, /triggerEmote/);
assert.match(app, /seatAllPeople/);
assert.match(app, /lockAllSeats/);
assert.match(app, /function guestParticipantIds\(\)[\s\S]*?\.filter\(person => person\.role === 'guest'\)/);
assert.match(app, /function seatAllPeople\(\)[\s\S]*?state\.roomLocked = true/);
assert.match(app, /function ensureSeatForPeer\(peerId\)[\s\S]*?role !== 'guest'/);
assert.match(app, /MAIN_STAGE_SCREEN_POSITION/);
assert.match(app, /Empty rooms deliberately contain no decorative\/static portal rings/);
assert.match(app, /public\/assets\/avatars\/kaykit-rogue\.glb/);
assert.match(app, /\/_db\/profiles\/avatars/);
assert.match(app, /function neutralizeSourceAvatar/);
assert.match(app, /function buildRiggedAvatarAppearance/);
assert.match(app, /object\.visible = false/);
assert.match(app, /part\.userData\.avatarModule = true/);
assert.match(app, /localStorage\.setItem\(AVATAR_STORAGE_KEY/);
assert.match(app, /function resolvePublicRoom/);
assert.match(app, /metaverse-reloaded:last-spaces/);
assert.match(app, /target = await resolvePublicRoom\(portal\.target_room_id\)/);
assert.match(app, /showRoomArrival\(target\.title\)/);
assert.match(app, /prüfe auch deinen Spam-Ordner/);
assert.match(app, /function syncJoinViewport/);
assert.match(app, /window\.visualViewport\?\.addEventListener\('resize', syncJoinViewport\)/);
assert.match(html, /id=["']public-room-panel["']/);
assert.match(html, /href=["']spaces\.html["']/);
assert.match(spacesHtml, /id=["']public-spaces["']/);
assert.match(spacesHtml, /id=["']recent-spaces["']/);
assert.match(spacesJs, /url\.searchParams\.set\('room', roomId\)/);
assert.match(spacesJs, /prüfe dein Postfach und auch deinen Spam-Ordner/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /\.mobile-move/);
assert.match(css, /--join-vv-height/);
assert.match(css, /#display-name, #room-name, #invite-code \{ font-size: 16px; \}/);
assert.ok((await stat(new URL('favicon.svg', root))).size > 100);
assert.equal(createHash('sha256').update(avatar).digest('hex'), '82d83a1cccb2e23d896336bd6fc1a558dc9830a220ff9ab0694de437b2b33550');

console.log('static-check: ok');
