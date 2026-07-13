const DEFAULT_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'host@example.test' };

const moduleSource = user => `
let session = ${JSON.stringify(user ? { user } : null)};

export const supabase = {
  async rpc(name, params = {}) {
    const response = await fetch('/__supabase_mock/rpc/' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  },
  from(table) {
    const state = { method: 'GET', payload: null, filters: [], columns: '*', order: null };
    const builder = {
      select(columns = '*') { state.columns = columns; return builder; },
      update(payload) { state.method = 'PATCH'; state.payload = payload; return builder; },
      delete() { state.method = 'DELETE'; return builder; },
      eq(column, value) { state.filters.push([column, value]); return builder; },
      order(column, options = {}) { state.order = [column, options.ascending !== false]; return builder; },
      async maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); }
    };
    async function execute(single) {
      const response = await fetch('/__supabase_mock/table/' + encodeURIComponent(table), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...state, single })
      });
      return response.json();
    }
    return builder;
  }
};

export function isSupabaseConfigured() { return true; }
export async function signInWithMagicLink() { return { data: {}, error: null }; }
export async function signOut() { session = null; return { error: null }; }
export async function getSession() { return session; }
export function onAuthStateChange(callback) {
  queueMicrotask(() => callback('INITIAL_SESSION', session));
  return { data: { subscription: { unsubscribe() {} } } };
}
`;

function roomRows(store) {
  if (Array.isArray(store)) return store;
  if (!Array.isArray(store.rooms)) store.rooms = [];
  return store.rooms;
}

function publicRoom(room, store) {
  const roomId = room.id || room.room_id;
  const templateMapping = !Array.isArray(store) && Array.isArray(store.room_templates)
    ? [...store.room_templates].reverse().find(item => item.room_id === roomId)
    : null;
  return {
    id: roomId,
    name: room.name || room.title,
    template_id: room.template_id || templateMapping?.template_id || 'neon-stage',
    status: room.status || 'active',
    max_users: room.max_users || 25,
    created_at: room.created_at || new Date().toISOString(),
    updated_at: room.updated_at || room.created_at || new Date().toISOString()
  };
}

export async function installSupabaseMock(page, store, options = {}) {
  const user = options.user === undefined ? DEFAULT_USER : options.user;
  await page.route('**/supabase-client.js*', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: moduleSource(user)
  }));
  await page.route('**/__supabase_mock/rpc/**', async route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    const params = route.request().postDataJSON() || {};
    const rooms = roomRows(store);
    let data = null;
    let error = null;

    if (name === 'public_list_spaces') {
      data = rooms.filter(room => (room.status || 'active') === 'active').map(room => publicRoom(room, store));
    } else if (name === 'get_public_space') {
      const room = rooms.find(item => (item.id || item.room_id) === params.p_space_id && (item.status || 'active') === 'active');
      data = room ? publicRoom(room, store) : null;
    } else if (name === 'resolve_space_invite') {
      const room = rooms.find(item => item.guest_code_hash === params.p_invite_hash || item.cohost_code_hash === params.p_invite_hash);
      data = room ? { ...publicRoom(room, store), role: room.cohost_code_hash === params.p_invite_hash ? 'cohost' : 'guest' } : null;
    } else if (name === 'create_space') {
      if (rooms.some(item => (item.id || item.room_id) === params.p_id)) {
        error = { code: '23505', message: 'duplicate key' };
      } else {
        const now = new Date().toISOString();
        const room = {
          id: params.p_id,
          room_id: params.p_id,
          owner_id: '00000000-0000-4000-8000-000000000001',
          name: params.p_name,
          title: params.p_name,
          template_id: params.p_template_id,
          guest_code_hash: params.p_guest_code_hash,
          cohost_code_hash: params.p_cohost_code_hash,
          max_users: params.p_max_users,
          status: 'active',
          created_at: now,
          updated_at: now
        };
        rooms.push(room);
        data = publicRoom(room, store);
      }
    } else if (name === 'rotate_space_invites') {
      const room = rooms.find(item => (item.id || item.room_id) === params.p_space_id
        && item.owner_id === '00000000-0000-4000-8000-000000000001');
      if (room) {
        room.guest_code_hash = params.p_guest_code_hash;
        room.cohost_code_hash = params.p_cohost_code_hash;
        data = true;
      } else {
        data = false;
      }
    } else {
      error = { code: 'PGRST202', message: `Unknown mock RPC: ${name}` };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, error })
    });
  });
  await page.route('**/__supabase_mock/table/**', async route => {
    const table = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    if (table !== 'spaces') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], error: null }) });
      return;
    }
    const request = route.request();
    const body = request.postDataJSON() || {};
    const rooms = roomRows(store);
    const matching = rooms.filter(room => (body.filters || []).every(([key, value]) => {
      const actual = key === 'id' ? (room.id || room.room_id) : room[key];
      return String(actual ?? '') === String(value ?? '');
    }));
    let data;
    if (body.method === 'PATCH') {
      matching.forEach(room => Object.assign(room, body.payload || {}));
      data = matching.map(room => publicRoom(room, store));
    } else if (body.method === 'DELETE') {
      for (const room of matching) {
        const index = rooms.indexOf(room);
        if (index >= 0) rooms.splice(index, 1);
      }
      data = [];
    } else {
      data = matching.map(room => ({ ...room, ...publicRoom(room, store) }));
      if (body.order) {
        const [column, ascending] = body.order;
        data.sort((a, b) => String(a[column] || '').localeCompare(String(b[column] || '')) * (ascending ? 1 : -1));
      }
    }
    if (body.single) data = data[0] || null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, error: null }) });
  });
}
