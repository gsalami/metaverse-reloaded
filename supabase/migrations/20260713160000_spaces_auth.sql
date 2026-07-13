create extension if not exists pgcrypto;

create table if not exists public.spaces (
  id text primary key check (char_length(id) between 3 and 64),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  template_id text not null default 'neon-stage' check (char_length(template_id) between 1 and 64),
  status text not null default 'active' check (status in ('active', 'archived')),
  is_public boolean not null default true,
  max_users smallint not null default 25 check (max_users between 1 and 25),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_invites (
  space_id text primary key references public.spaces(id) on delete cascade,
  guest_code_hash text not null unique check (char_length(guest_code_hash) = 64),
  cohost_code_hash text not null unique check (char_length(cohost_code_hash) = 64),
  created_at timestamptz not null default now()
);

-- Preserve the rooms that existed in the legacy host database at cutover time.
-- They remain publicly reachable and their invite codes keep working, but they
-- have no account owner until a future claim flow assigns one.
insert into public.spaces (
  id, owner_id, name, template_id, status, is_public, max_users, created_at
) values
  ('mein-metaverse-3wxb36', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T09:54:36.054Z'),
  ('mein-metaverse-yy5rnj', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T09:55:01.204Z'),
  ('mein-metaverse-5lpvjs', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T10:20:02.611Z'),
  ('mein-metaverse-7rn2f3', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T10:24:40.423Z'),
  ('mein-metaverse-sbnhmu', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T10:26:27.150Z'),
  ('mein-metaverse-a3f35z', null, 'Mein Metaverse', 'neon-stage', 'active', true, 25, '2026-07-13T11:20:43.558Z'),
  ('gu-station-gul89c', null, 'Gu Station', 'neon-stage', 'active', true, 25, '2026-07-13T11:40:59.715Z'),
  ('gu-mobile-vtmpna', null, 'Gu Mobile', 'neon-stage', 'active', true, 25, '2026-07-13T11:44:39.767Z'),
  ('test-3-yzdrwp', null, 'Test 3', 'tropical-island', 'active', true, 25, '2026-07-13T12:02:38.611Z'),
  ('mein-metaverse-g388va', null, 'Mein Metaverse', 'tropical-island', 'active', true, 25, '2026-07-13T12:36:29.319Z'),
  ('orbit-lounge-6qdyxt-8qplt6', null, 'Orbit Lounge 6QDYXT', 'moon-station', 'active', true, 25, '2026-07-13T13:09:52.494Z'),
  ('velvet-lab-7jkgrk-p344mg', null, 'Velvet Lab 7JKGRK', 'cyber-city', 'active', true, 25, '2026-07-13T13:10:53.834Z'),
  ('orbit-lounge-j68cys-amtwbu', null, 'Orbit Lounge J68CYS', 'arctic-aurora', 'active', true, 25, '2026-07-13T13:46:27.313Z'),
  ('velvet-loft-hkre4z-alsukx', null, 'Velvet Loft HKRE4Z', 'neon-stage', 'active', true, 25, '2026-07-13T13:46:57.626Z')
on conflict (id) do nothing;

insert into public.space_invites (
  space_id, guest_code_hash, cohost_code_hash
) values
  ('mein-metaverse-3wxb36', 'c56c9fc17b44c11a5f0454b3ce910170f028dc97da3445ac6be200d85174d10f', '39116ef1b2b10847a0ac4350cc395fd0aacb54093b9528a50c456a5c4a0ff418'),
  ('mein-metaverse-yy5rnj', '9b4a0c0576074a58eedf6796b7f2c49e1562f1c1b7c9fa70eb41b166bb7300cf', '78830b328936e50163480610a09f9d75effadceff74716aab5eede2439774642'),
  ('mein-metaverse-5lpvjs', 'c68a0d560e33efdaf9dec9cff04a5e890737fd6ebdfefcc675cd287c251f6bb1', '65ace791837c0aeea62c05d6cb76b8d480e51011377ad2eec9f0fea7106bf56b'),
  ('mein-metaverse-7rn2f3', 'd81a60ad1692f3cb3209af3bf43b9cdec5d3eba14eea46069822aa47dd97bee9', 'e895a46bd012d7a5fd9157089e271c1d5392728333b9b3448c538ad66e6fa432'),
  ('mein-metaverse-sbnhmu', '51698ea2134fbac613f69fc1ea91b561822eb08e3ca6a489e5ddbfb61b805833', '33dffddad41cef937d063e51bc0f7169a3c0730bbc7dbe41b695d85cff2ae3c6'),
  ('mein-metaverse-a3f35z', '11b6fae1e678da0098dfeb5ad558a355a7200d00578a3b7cc3c666ed83ff7970', '8f56c00eed10dc0767192dfbbec4f3eac7ce150a2ad47e142e4d4b6aaf00dcf1'),
  ('gu-station-gul89c', 'cb22a52c14f3a911cd7b7a206136d411b708942368b44feb161aba3df97b7505', '4e881bab6c0f1b1ec3f90726a5cc89e39aa5727632a9f25b2cec0ffeb0574889'),
  ('gu-mobile-vtmpna', '0d5a02ca5ee069fabfcc89971c86e4b14cabf0b250582103b912fd76c411f677', '859f6d29e0a9a5db6a844f648f33abc607a2c7188bffac5b70dbcad30b42cdc3'),
  ('test-3-yzdrwp', '31ea1bfff74c2d0cbbf7db4cc419026aa1322357f02060e30d6f5b8de474d3b6', 'ead5d18095015830bff09eeb47bbf463ebb9470f68262190e614abdd9791b551'),
  ('mein-metaverse-g388va', 'a93caa0684ad0b17cf075691537cebdbb112df78353fc9a177be71fcb807b831', '8b4e5837db0f09d16f2aadcc3fa9c03afac25331a69e2efe5f722422d11cc479'),
  ('orbit-lounge-6qdyxt-8qplt6', 'b09faab4b8176f7bd884037b6d41f55fe21504b551339e81dd3f6fec6721ecda', '5d3cb16d2e0c64acbc3a3042765828105524c284b259c9527448a645d2623428'),
  ('velvet-lab-7jkgrk-p344mg', 'f3f6e0dbbd65101508031ec4e1c46bb946258637c51fa3defbacc60762336f1f', 'afc2e1b07b0cdd895702ddce0127d6e500324c14aa5a73255ca34fadc09b8fd4'),
  ('orbit-lounge-j68cys-amtwbu', '5266808361b1a633ab56c201f67f9a602cd4e66529fc899e63c9764c99ab0a2a', '362b4498fd909edd9892591e7e3f3b56bf2fb7ae879c1012f2f5d3103a710a14'),
  ('velvet-loft-hkre4z-alsukx', '1d1a6dda579b6f23f864f37fa3718cd6783c5308e85c0ac6767c12715767e146', 'f2136f2e8c3ae85c17ab5af99e18d660f287af45fb91a375e4a8e043452d3db9')
on conflict (space_id) do nothing;

alter table public.spaces enable row level security;
alter table public.space_invites enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

drop policy if exists spaces_owner_select on public.spaces;
create policy spaces_owner_select on public.spaces
for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists spaces_owner_insert on public.spaces;
create policy spaces_owner_insert on public.spaces
for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists spaces_owner_update on public.spaces;
create policy spaces_owner_update on public.spaces
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists spaces_owner_delete on public.spaces;
create policy spaces_owner_delete on public.spaces
for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists space_invites_owner_select on public.space_invites;
create policy space_invites_owner_select on public.space_invites
for select to authenticated
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists space_invites_owner_insert on public.space_invites;
create policy space_invites_owner_insert on public.space_invites
for insert to authenticated
with check (
  exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists space_invites_owner_update on public.space_invites;
create policy space_invites_owner_update on public.space_invites
for update to authenticated
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists space_invites_owner_delete on public.space_invites;
create policy space_invites_owner_delete on public.space_invites
for delete to authenticated
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = (select auth.uid())
  )
);

create or replace function public.create_space(
  p_id text,
  p_name text,
  p_template_id text,
  p_guest_code_hash text,
  p_cohost_code_hash text,
  p_max_users smallint default 25
)
returns public.spaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_space public.spaces;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if trim(p_id) !~ '^[a-z0-9_-]{3,64}$' then
    raise exception 'Invalid space id';
  end if;
  if char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'Invalid space name';
  end if;
  if p_guest_code_hash !~ '^[0-9a-fA-F]{64}$'
     or p_cohost_code_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid invite hash';
  end if;

  insert into public.spaces (
    id, owner_id, name, template_id, max_users
  ) values (
    lower(trim(p_id)), auth.uid(), trim(p_name), trim(p_template_id), least(coalesce(p_max_users, 25), 25)
  )
  returning * into created_space;

  insert into public.space_invites (
    space_id, guest_code_hash, cohost_code_hash
  ) values (
    created_space.id, lower(p_guest_code_hash), lower(p_cohost_code_hash)
  );

  return created_space;
end;
$$;

create or replace function public.public_list_spaces()
returns table (
  id text,
  name text,
  template_id text,
  max_users smallint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.template_id, s.max_users, s.created_at, s.updated_at
  from public.spaces s
  where s.status = 'active' and s.is_public = true
  order by s.created_at desc;
$$;

create or replace function public.get_public_space(p_space_id text)
returns table (
  id text,
  name text,
  template_id text,
  max_users smallint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.template_id, s.max_users, s.created_at, s.updated_at
  from public.spaces s
  where s.id = lower(trim(p_space_id))
    and s.status = 'active'
    and s.is_public = true
  limit 1;
$$;

create or replace function public.resolve_space_invite(p_invite_hash text)
returns table (
  id text,
  name text,
  template_id text,
  max_users smallint,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.template_id,
    s.max_users,
    case
      when i.cohost_code_hash = lower(trim(p_invite_hash)) then 'cohost'
      else 'guest'
    end
  from public.spaces s
  join public.space_invites i on i.space_id = s.id
  where s.status = 'active'
    and (
      i.guest_code_hash = lower(trim(p_invite_hash))
      or i.cohost_code_hash = lower(trim(p_invite_hash))
    )
  limit 1;
$$;

create or replace function public.rotate_space_invites(
  p_space_id text,
  p_guest_code_hash text,
  p_cohost_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_guest_code_hash !~ '^[0-9a-fA-F]{64}$'
     or p_cohost_code_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid invite hash';
  end if;

  update public.space_invites i
  set guest_code_hash = lower(p_guest_code_hash),
      cohost_code_hash = lower(p_cohost_code_hash)
  from public.spaces s
  where i.space_id = s.id
    and s.id = lower(trim(p_space_id))
    and s.owner_id = auth.uid();

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on public.spaces from anon;
revoke all on public.space_invites from anon;
revoke insert on public.spaces from authenticated;
revoke all on public.space_invites from authenticated;
grant select, update, delete on public.spaces to authenticated;

revoke all on function public.create_space(text, text, text, text, text, smallint) from public;
grant execute on function public.create_space(text, text, text, text, text, smallint) to authenticated;

revoke all on function public.public_list_spaces() from public;
grant execute on function public.public_list_spaces() to anon, authenticated;

revoke all on function public.get_public_space(text) from public;
grant execute on function public.get_public_space(text) to anon, authenticated;

revoke all on function public.resolve_space_invite(text) from public;
grant execute on function public.resolve_space_invite(text) to anon, authenticated;

revoke all on function public.rotate_space_invites(text, text, text) from public;
grant execute on function public.rotate_space_invites(text, text, text) to authenticated;
