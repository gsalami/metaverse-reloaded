const DB_URL = '/_db/project/tasks';
const POLL_INTERVAL = 3_000;
const STATUSES = ['Offen', 'In Arbeit', 'Blockiert', 'Geplant', 'Erledigt'];
const PRIORITIES = ['Hoch', 'Mittel', 'Niedrig'];

const INITIAL_TASKS = [
  ['max-people-25', 'Maximale Raumgrösse auf 25 Personen erhöhen', 'Erledigt', 'Hoch', '25 Personen, 25 Sitzplätze, Lock für alle und Ablehnung der 26. Person sind getestet.'],
  ['room-scoped-chat', 'Chat pro Raum isolieren', 'Erledigt', 'Hoch', 'Nachrichten werden über die Raum-ID getrennt; der Wechsel zwischen zwei Räumen ist ohne Chat-Leak getestet.'],
  ['space-portals', 'Portale zu anderen Spaces', 'Erledigt', 'Hoch', 'Host/Cohost verknüpfen einen Zielraum per Guest-Code; 3D-Näheinteraktion und Portalwechsel funktionieren auf Desktop und Mobile.'],
  ['github-open-source', 'Öffentliches GitHub-Repository und Open-Source-Veröffentlichung', 'Erledigt', 'Hoch', 'Öffentlich unter github.com/gsalami/metaverse-reloaded mit MIT-Lizenz veröffentlicht.'],
  ['remove-empty-circle', 'Funktionslosen grossen Kreis entfernen', 'Erledigt', 'Mittel', 'Statische Portal-Doppelringe sind entfernt; Ringe erscheinen nur noch bei einem echten, aktiven Portal.'],
  ['avatar-customizer', 'Avatar konfigurieren', 'Erledigt', 'Hoch', 'Outfit- und Haarfarbe, vier Haarstile und drei Kleidungsstile werden gespeichert und mit Remote-Avataren synchronisiert.'],
  ['39825ecb-3f63-4b82-9065-7996a4c5e164', 'Neutraler modularer Avatar', 'Erledigt', 'Hoch', 'Das Rogue-Asset liefert nur noch das Animationsrig; sichtbarer Body, Haare und Outfits sind separate 3D-Module.'],
  ['seat-screen-direction', 'Sitzrichtung bei „Seat all“ korrigieren', 'Erledigt', 'Hoch', 'Alle 25 gesetzten Avatare werden explizit zur Main-Stage-Leinwand ausgerichtet und automatisch geprüft.'],
  ['seat-guests-auto-lock', 'Seat all setzt nur Guests und lockt automatisch', 'Erledigt', 'Hoch', 'Host/Cohost bleiben frei; Guests werden gesetzt, sofort gesperrt und durch Unlock wieder freigegeben.'],
  ['public-spaces-deeplinks', 'Öffentliche Liste aller Metaverses mit Deep Links', 'Erledigt', 'Hoch', 'Alle aktiven Räume erscheinen live unter spaces.html und können direkt als Guest geöffnet werden.'],
  ['recent-spaces-portal-feedback', 'Portal-Feedback und zuletzt besuchte Spaces', 'Erledigt', 'Hoch', 'Portalankunft benennt den neuen Space; die lokale Besuchshistorie ermöglicht die Rückkehr ohne Portal.'],
  ['mobile-room-create-keyboard', 'Mobile Raum-Erstellung bei offener Tastatur', 'Erledigt', 'Hoch', 'Der Dialog folgt dem iOS-VisualViewport, verhindert Safari-Autozoom und hält den Erstellen-Button erreichbar.'],
  ['ad999b7d-a1a0-4070-9f11-ec11c436b3ff', '10 weitere Raum-Templates', 'Erledigt', 'Mittel', 'Zehn mobile-fähige Designs sind bei der Raumerstellung auswählbar und werden pro Raum für Guests, Deep Links und Portale gespeichert.'],
  ['camera-auto-follow', 'Kamera beim Laufen automatisch hinter dem Avatar', 'Erledigt', 'Hoch', 'Bei WASD und mobiler Bewegung folgt die Third-Person-Kamera weich der Blickrichtung; freies Kameradrehen bleibt im Stand möglich.'],
  ['unique-room-name-mobile-create', 'Unique Raumnamen und mobile Erstellung', 'Erledigt', 'Hoch', 'Jede neue Seite schlägt einen einzigartigen sichtbaren Raumnamen vor; der mobile Create-Button bleibt auch über der iPhone-Tastatur sichtbar und anklickbar.'],
  ['distinct-room-architectures', 'Unterschiedliche Raumgrössen und Architekturen', 'Erledigt', 'Hoch', 'Zehn eigene Architekturen mit neun Raumabmessungen: unter anderem Alpine Lodge mit Kamin, Cyber Gallery, Zen Courtyard, Dome, Habitat und Festivalfläche; Mobile lädt reduzierte Architekturdetails.'],
  ['click-to-sit', 'Sitzplatz per Klick oder Tap auswählen', 'Erledigt', 'Hoch', 'Freie Sitze sind auf Desktop und Mobile direkt auswählbar; Belegung, Screen-Ausrichtung, Aufstehen, Lock und Multiuser-Synchronisation sind getestet.'],
  ['accounts-metaverses', 'Magic-Link-Accounts und eigene Metaverses', 'Erledigt', 'Hoch', 'Supabase Auth mit Resend-Magic-Link, Row Level Security, Owner-Dashboard, Bearbeiten, Löschen und Invite-Code-Erneuerung sind produktiv umgesetzt und getestet.'],
  ['delete-ownerless-spaces', 'Alle Spaces ohne Owner löschen', 'Erledigt', 'Hoch', '14 Legacy-Spaces ohne Account-Owner wurden aus Supabase und der Host-Datenbank entfernt; Invites, Templates, Portale, Realtime-Daten und veraltete lokale Deep Links wurden bereinigt.']
];

const elements = {
  board: document.querySelector('#todo-board'),
  syncState: document.querySelector('#sync-state'),
  syncLabel: document.querySelector('#sync-label'),
  total: document.querySelector('#task-total'),
  active: document.querySelector('#task-active'),
  done: document.querySelector('#task-done'),
  progress: document.querySelector('#task-progress'),
  dialog: document.querySelector('#task-dialog'),
  form: document.querySelector('#task-form'),
  formError: document.querySelector('#form-error'),
  template: document.querySelector('#task-card-template')
};

let tasks = new Map();
let polling = false;
let seeded = false;

function validStatus(value) { return STATUSES.includes(value) ? value : 'Offen'; }
function validPriority(value) { return PRIORITIES.includes(value) ? value : 'Mittel'; }
function clean(value, limit) { return String(value ?? '').trim().slice(0, limit); }
function timestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeTask(row) {
  return {
    task_id: clean(row.task_id, 100),
    title: clean(row.title, 140),
    status: validStatus(row.status),
    priority: validPriority(row.priority),
    note: clean(row.note, 600),
    updated_at: clean(row.updated_at, 40)
  };
}

function newestByTaskId(rows) {
  const latest = new Map();
  for (const raw of rows) {
    const task = normalizeTask(raw);
    if (!task.task_id || !task.title) continue;
    const previous = latest.get(task.task_id);
    if (!previous || timestamp(task.updated_at) >= timestamp(previous.updated_at)) latest.set(task.task_id, task);
  }
  return latest;
}

async function dbGet() {
  const response = await fetch(`${DB_URL}?limit=1000`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Datenbank antwortet mit ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.rows || []);
}

async function dbAppend(task) {
  const response = await fetch(DB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(task)
  });
  if (!response.ok) throw new Error(`Speichern fehlgeschlagen (${response.status})`);
}

function setSync(mode, label) {
  elements.syncState.classList.toggle('synced', mode === 'synced');
  elements.syncState.classList.toggle('error', mode === 'error');
  elements.syncLabel.textContent = label;
}

function readableDate(iso) {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return '';
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value);
}

function render() {
  const ordered = [...tasks.values()].sort((a, b) => timestamp(b.updated_at) - timestamp(a.updated_at));
  for (const status of STATUSES) {
    const list = document.querySelector(`[data-task-list="${status}"]`);
    const columnTasks = ordered.filter(task => task.status === status);
    list.replaceChildren(...columnTasks.map(createTaskCard));
    document.querySelector(`.column[data-status="${status}"] .count`).textContent = String(columnTasks.length);
  }
  const done = ordered.filter(task => task.status === 'Erledigt').length;
  const active = ordered.filter(task => task.status === 'In Arbeit' || task.status === 'Blockiert').length;
  elements.total.textContent = String(ordered.length);
  elements.active.textContent = String(active);
  elements.done.textContent = String(done);
  elements.progress.textContent = `${ordered.length ? Math.round(done / ordered.length * 100) : 0}%`;
}

function createTaskCard(task) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.dataset.taskId = task.task_id;
  const priority = card.querySelector('.priority');
  priority.textContent = task.priority;
  priority.dataset.priority = task.priority;
  const time = card.querySelector('time');
  time.dateTime = task.updated_at;
  time.textContent = readableDate(task.updated_at);
  card.querySelector('h3').textContent = task.title;
  card.querySelector('.task-note').textContent = task.note;
  const select = card.querySelector('select');
  select.value = task.status;
  select.addEventListener('change', () => changeStatus(task.task_id, select.value, select));
  return card;
}

async function appendAndApply(task) {
  setSync('syncing', 'Speichert…');
  await dbAppend(task);
  tasks.set(task.task_id, task);
  render();
  setSync('synced', 'Live synchronisiert');
}

async function changeStatus(taskId, nextStatus, control) {
  const current = tasks.get(taskId);
  if (!current || current.status === nextStatus) return;
  control.disabled = true;
  try {
    await appendAndApply({ ...current, status: validStatus(nextStatus), updated_at: new Date().toISOString() });
  } catch (error) {
    control.value = current.status;
    setSync('error', error.message);
  } finally {
    control.disabled = false;
  }
}

async function seedInitialTasks() {
  if (seeded) return;
  seeded = true;
  const now = Date.now();
  await Promise.all(INITIAL_TASKS.map((task, index) => dbAppend({
    task_id: task[0], title: task[1], status: task[2], priority: task[3], note: task[4],
    updated_at: new Date(now + index).toISOString()
  })));
}

async function refresh() {
  if (polling) return;
  polling = true;
  try {
    const rows = await dbGet();
    if (!rows.length) {
      await seedInitialTasks();
      tasks = newestByTaskId(await dbGet());
    } else {
      tasks = newestByTaskId(rows);
    }
    render();
    setSync('synced', 'Live synchronisiert');
  } catch (error) {
    setSync('error', error.message);
  } finally {
    polling = false;
  }
}

function openTaskDialog() {
  elements.form.reset();
  elements.formError.textContent = '';
  elements.dialog.showModal();
  document.querySelector('#task-title').focus();
}

function closeTaskDialog() { elements.dialog.close(); }

elements.form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(elements.form);
  const title = clean(data.get('title'), 140);
  if (!title) { elements.formError.textContent = 'Bitte einen Titel eingeben.'; return; }
  const submit = elements.form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await appendAndApply({
      task_id: crypto.randomUUID(),
      title,
      status: validStatus(data.get('status')),
      priority: validPriority(data.get('priority')),
      note: clean(data.get('note'), 600),
      updated_at: new Date().toISOString()
    });
    closeTaskDialog();
  } catch (error) {
    elements.formError.textContent = error.message;
    setSync('error', error.message);
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#new-task-button').addEventListener('click', openTaskDialog);
document.querySelector('#close-task-dialog').addEventListener('click', closeTaskDialog);
document.querySelector('#cancel-task').addEventListener('click', closeTaskDialog);
elements.dialog.addEventListener('click', event => { if (event.target === elements.dialog) closeTaskDialog(); });

refresh();
setInterval(refresh, POLL_INTERVAL);
