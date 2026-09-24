do $$
begin
  create type public.member_role as enum ('Administrador', 'Operador');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_status as enum ('Activo', 'Pendiente');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role public.member_role not null default 'Operador',
  status public.member_status not null default 'Pendiente',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.linktree_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  client_name text not null,
  slug text not null,
  status text not null default 'Activo' check (status in ('Activo', 'Pausado')),
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  client_name text not null,
  destination_url text not null,
  status text not null default 'Activo' check (status in ('Activo', 'Pausado')),
  created_at timestamptz not null default now()
);

alter table public.nfc_tags add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table public.nfc_tags add column if not exists profile_id uuid references public.linktree_profiles(id) on delete set null;

do $$
declare workspace_row record;
declare default_store uuid;
begin
  for workspace_row in select id, name from public.workspaces loop
    insert into public.stores (workspace_id, name, slug)
      values (workspace_row.id, workspace_row.name, 'principal')
      on conflict (workspace_id, slug) do update set name = excluded.name
      returning id into default_store;
    update public.nfc_tags set store_id = default_store where workspace_id = workspace_row.id and store_id is null;
    insert into public.store_members (store_id, user_id)
      select default_store, user_id from public.workspace_members where workspace_id = workspace_row.id and status = 'Activo'
      on conflict do nothing;
  end loop;
end $$;

alter table public.nfc_tags add column if not exists slug text;
create unique index if not exists nfc_tags_slug_unique on public.nfc_tags (lower(slug)) where slug is not null;

insert into public.linktree_profiles (workspace_id, store_id, name, client_name, slug)
select t.workspace_id, t.store_id, t.name, t.client_name, t.slug
from public.nfc_tags t
where t.slug is not null
  and not exists (select 1 from public.linktree_profiles p where p.workspace_id = t.workspace_id and lower(p.slug) = lower(t.slug));

update public.nfc_tags t
set profile_id = p.id
from public.linktree_profiles p
where t.profile_id is null
  and t.workspace_id = p.workspace_id
  and lower(t.slug) = lower(p.slug);

create table if not exists public.nfc_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete cascade,
  label text not null,
  url text not null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.nfc_links add column if not exists profile_id uuid references public.linktree_profiles(id) on delete cascade;
update public.nfc_links l
set profile_id = t.profile_id
from public.nfc_tags t
where l.profile_id is null and l.tag_id = t.id and t.profile_id is not null;

create table if not exists public.nfc_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.nfc_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  visitor_id text
);

create table if not exists public.nfc_scans (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  source text not null default 'directo',
  visitor_id text
);

create or replace function public.bootstrap_first_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_workspace uuid;
begin
  if not exists (select 1 from public.workspaces) then
    insert into public.workspaces (name) values ('Mi workspace') returning id into new_workspace;
    insert into public.workspace_members (workspace_id, user_id, name, email, role, status)
    values (new_workspace, new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email, 'Administrador', 'Activo');
    insert into public.stores (workspace_id, name, slug) values (new_workspace, 'Mi tienda', 'mi-tienda');
    insert into public.store_members (store_id, user_id) select id, new.id from public.stores where workspace_id = new_workspace and slug = 'mi-tienda';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.bootstrap_first_user();

alter table public.workspaces enable row level security;
alter table public.linktree_profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.nfc_scans enable row level security;
alter table public.nfc_links enable row level security;
alter table public.nfc_link_clicks enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid() and status = 'Activo');
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid() and status = 'Activo' and role = 'Administrador');
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.store_members sm join public.workspace_members wm on wm.user_id = sm.user_id join public.stores s on s.id = sm.store_id where sm.store_id = target_store and sm.user_id = auth.uid() and wm.workspace_id = s.workspace_id and wm.status = 'Activo');
$$;

create or replace function public.can_manage_store(target_store uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = target_store and (public.is_workspace_admin(s.workspace_id) or public.is_store_member(s.id)));
$$;

revoke execute on function public.bootstrap_first_user() from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_workspace_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_store_member(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_store(uuid) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function public.can_manage_store(uuid) to authenticated;

revoke update (workspace_id, user_id) on public.workspace_members from authenticated;
revoke delete on public.workspace_members from authenticated;

drop policy if exists "members can view workspace members" on public.workspace_members;
drop policy if exists "admins can manage workspace members" on public.workspace_members;
drop policy if exists "admins can update workspace members" on public.workspace_members;
drop policy if exists "members can view workspaces" on public.workspaces;
drop policy if exists "members can view profiles" on public.linktree_profiles;
drop policy if exists "admins can manage profiles" on public.linktree_profiles;
drop policy if exists "admins can insert profiles" on public.linktree_profiles;
drop policy if exists "admins can update profiles" on public.linktree_profiles;
drop policy if exists "admins can delete profiles" on public.linktree_profiles;
drop policy if exists "members can view tags" on public.nfc_tags;
drop policy if exists "admins can manage tags" on public.nfc_tags;
drop policy if exists "admins can insert tags" on public.nfc_tags;
drop policy if exists "admins can update tags" on public.nfc_tags;
drop policy if exists "admins can delete tags" on public.nfc_tags;
drop policy if exists "members can view stores" on public.stores;
drop policy if exists "members can view store members" on public.store_members;
drop policy if exists "admins can insert links" on public.nfc_links;
drop policy if exists "members can view links" on public.nfc_links;
drop policy if exists "admins can update links" on public.nfc_links;
drop policy if exists "admins can delete links" on public.nfc_links;
drop policy if exists "members can view scans" on public.nfc_scans;
drop policy if exists "public can register scans" on public.nfc_scans;
drop policy if exists "members can view link clicks" on public.nfc_link_clicks;

create policy "members can view workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members can view profiles" on public.linktree_profiles for select using (public.is_workspace_member(workspace_id) and (public.is_workspace_admin(workspace_id) or public.is_store_member(store_id)));
create policy "admins can insert profiles" on public.linktree_profiles for insert with check (public.can_manage_store(store_id));
create policy "admins can update profiles" on public.linktree_profiles for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "admins can delete profiles" on public.linktree_profiles for delete using (public.can_manage_store(store_id));
create policy "members can view workspace members" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "admins can update workspace members" on public.workspace_members for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "members can view stores" on public.stores for select using (public.is_workspace_member(workspace_id));
create policy "members can view store members" on public.store_members for select using (public.is_store_member(store_id) or exists (select 1 from public.stores s where s.id = store_id and public.is_workspace_admin(s.workspace_id)));
create policy "members can view tags" on public.nfc_tags for select using (public.is_workspace_member(workspace_id) and (public.is_workspace_admin(workspace_id) or public.is_store_member(store_id)));
create policy "admins can insert tags" on public.nfc_tags for insert with check (public.is_workspace_admin(workspace_id) or (public.is_store_member(store_id) and exists (select 1 from public.stores s where s.id = store_id and s.workspace_id = workspace_id)));
create policy "admins can update tags" on public.nfc_tags for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "admins can delete tags" on public.nfc_tags for delete using (public.can_manage_store(store_id));
create policy "admins can insert links" on public.nfc_links for insert with check (exists (select 1 from public.nfc_tags t where t.id = tag_id and public.can_manage_store(t.store_id)));
create policy "members can view links" on public.nfc_links for select using (exists (select 1 from public.nfc_tags t where t.id = tag_id and public.can_manage_store(t.store_id)));
create policy "admins can update links" on public.nfc_links for update using (exists (select 1 from public.nfc_tags t where t.id = tag_id and public.can_manage_store(t.store_id))) with check (exists (select 1 from public.nfc_tags t where t.id = tag_id and public.can_manage_store(t.store_id)));
create policy "admins can delete links" on public.nfc_links for delete using (exists (select 1 from public.nfc_tags t where t.id = tag_id and public.can_manage_store(t.store_id)));
create policy "members can view scans" on public.nfc_scans for select using (exists (select 1 from public.nfc_tags t where t.id = nfc_scans.tag_id and public.can_manage_store(t.store_id)));
drop policy if exists "public can register scans" on public.nfc_scans;
create policy "members can view link clicks" on public.nfc_link_clicks for select using (exists (select 1 from public.nfc_links l join public.nfc_tags t on t.id = l.tag_id where l.id = nfc_link_clicks.link_id and public.can_manage_store(t.store_id)));

create or replace function public.get_public_tag(tag_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'tag', jsonb_build_object('name', p.name, 'client_name', p.client_name),
    'links', coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url) order by l.position) filter (where l.id is not null), '[]'::jsonb)
  )
  from public.nfc_tags t
  join public.linktree_profiles p on p.id = t.profile_id and p.status = 'Activo'
  left join public.nfc_links l on l.profile_id = p.id and l.active = true
  where lower(t.slug) = lower(tag_slug) and t.status = 'Activo'
  group by p.id;
$$;

create or replace function public.register_nfc_scan(tag_slug text, visitor text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_tag uuid;
begin
  select id into target_tag from public.nfc_tags where lower(slug) = lower(tag_slug) and status = 'Activo';
  if target_tag is null then return false; end if;
  insert into public.nfc_scans (tag_id, source, visitor_id) values (target_tag, 'nfc', nullif(left(visitor, 128), ''));
  return true;
end;
$$;

create or replace function public.register_link_click(link uuid, visitor text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.nfc_links l join public.linktree_profiles p on p.id = l.profile_id where l.id = link and l.active and p.status = 'Activo') then return false; end if;
  insert into public.nfc_link_clicks (link_id, visitor_id) values (link, nullif(left(visitor, 128), ''));
  return true;
end;
$$;

grant execute on function public.get_public_tag(text) to anon, authenticated;
grant execute on function public.register_nfc_scan(text, text) to anon, authenticated;
grant execute on function public.register_link_click(uuid, text) to anon, authenticated;

-- Cambios posteriores: ver supabase/migrations/ (correr en orden en el SQL Editor).
