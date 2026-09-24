-- Empresas (workspaces) administradas por la plataforma, invitaciones por correo
-- y diseño personalizable de perfiles Linktree.
-- Es idempotente: se puede correr más de una vez en el SQL Editor de Supabase.

-- ─── Administradores de la plataforma ────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

-- Los administradores actuales del primer workspace pasan a ser administradores de la plataforma.
insert into public.platform_admins (user_id)
select wm.user_id
from public.workspace_members wm
where wm.role = 'Administrador' and wm.status = 'Activo'
  and wm.workspace_id = (select id from public.workspaces order by created_at limit 1)
on conflict do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ─── Datos de la empresa ─────────────────────────────────────────────────────
alter table public.workspaces add column if not exists status text not null default 'Activo' check (status in ('Activo', 'Suspendido'));
alter table public.workspaces add column if not exists contact_name text;
alter table public.workspaces add column if not exists contact_email text;
alter table public.workspaces add column if not exists contact_phone text;
alter table public.workspaces add column if not exists plates_count integer not null default 0 check (plates_count >= 0);
alter table public.workspaces add column if not exists notes text;

-- Solo la plataforma puede cambiar estado, placas y notas internas.
create or replace function public.protect_workspace_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    new.status := old.status;
    new.plates_count := old.plates_count;
    new.notes := old.notes;
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_workspace_fields on public.workspaces;
create trigger protect_workspace_fields before update on public.workspaces
  for each row execute procedure public.protect_workspace_fields();

-- ─── Helpers de RLS: la plataforma ve todo; las empresas suspendidas pierden acceso ─
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid() and wm.status = 'Activo' and w.status = 'Activo'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid() and wm.status = 'Activo' and wm.role = 'Administrador' and w.status = 'Activo'
  );
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_members sm
    join public.stores s on s.id = sm.store_id
    join public.workspace_members wm on wm.user_id = sm.user_id and wm.workspace_id = s.workspace_id
    join public.workspaces w on w.id = s.workspace_id
    where sm.store_id = target_store and sm.user_id = auth.uid() and wm.status = 'Activo' and w.status = 'Activo'
  );
$$;

-- ─── Invitaciones ────────────────────────────────────────────────────────────
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  name text not null,
  role public.member_role not null default 'Operador',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
alter table public.workspace_invitations enable row level security;

create or replace function public.invite_member(target_workspace uuid, member_email text, member_name text, member_role public.member_role default 'Operador')
returns text language plpgsql security definer set search_path = public as $$
declare
  normalized_email text := lower(trim(member_email));
  target_user uuid;
  main_store uuid;
begin
  if not public.is_workspace_admin(target_workspace) then raise exception 'No tienes permisos para invitar usuarios a esta empresa'; end if;
  if normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(normalized_email) > 254 then raise exception 'Correo inválido'; end if;
  if length(trim(member_name)) < 2 or length(member_name) > 100 then raise exception 'Nombre inválido'; end if;

  select id into target_user from auth.users where lower(email) = normalized_email;
  if target_user is null then
    insert into public.workspace_invitations (workspace_id, email, name, role, invited_by)
    values (target_workspace, normalized_email, trim(member_name), member_role, auth.uid())
    on conflict (workspace_id, email) do update set name = excluded.name, role = excluded.role;
    return 'invited';
  end if;

  insert into public.workspace_members (workspace_id, user_id, name, email, role, status)
  values (target_workspace, target_user, trim(member_name), normalized_email, member_role, 'Activo')
  on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'Activo';
  select id into main_store from public.stores where workspace_id = target_workspace order by created_at limit 1;
  if main_store is not null then
    insert into public.store_members (store_id, user_id) values (main_store, target_user) on conflict do nothing;
  end if;
  return 'added';
end;
$$;

-- Al iniciar sesión, las invitaciones al correo confirmado del usuario se convierten en membresías.
create or replace function public.claim_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  me record;
  invitation record;
  main_store uuid;
  claimed integer := 0;
begin
  select id, lower(email) as email, email_confirmed_at into me from auth.users where id = auth.uid();
  if me.id is null or me.email_confirmed_at is null then return 0; end if;
  for invitation in select * from public.workspace_invitations where email = me.email loop
    insert into public.workspace_members (workspace_id, user_id, name, email, role, status)
    values (invitation.workspace_id, me.id, invitation.name, me.email, invitation.role, 'Activo')
    on conflict (workspace_id, user_id) do nothing;
    select id into main_store from public.stores where workspace_id = invitation.workspace_id order by created_at limit 1;
    if main_store is not null then
      insert into public.store_members (store_id, user_id) values (main_store, me.id) on conflict do nothing;
    end if;
    delete from public.workspace_invitations where id = invitation.id;
    claimed := claimed + 1;
  end loop;
  return claimed;
end;
$$;

-- Empresas a las que el usuario puede entrar (la plataforma ve todas).
create or replace function public.my_workspaces()
returns table (id uuid, name text, status text, role public.member_role)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.status, coalesce(wm.role, 'Administrador'::public.member_role)
  from public.workspaces w
  left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'Activo'
  where public.is_platform_admin() or wm.id is not null
  order by w.name;
$$;

-- ─── Gestión de empresas (solo plataforma) ───────────────────────────────────
create or replace function public.create_workspace(p_name text, p_contact_name text default null, p_contact_email text default null, p_contact_phone text default null, p_plates integer default 0, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Solo el administrador de la plataforma puede crear empresas'; end if;
  if length(trim(p_name)) < 2 or length(p_name) > 120 then raise exception 'Nombre de empresa inválido'; end if;
  insert into public.workspaces (name, contact_name, contact_email, contact_phone, plates_count, notes)
  values (trim(p_name), nullif(trim(p_contact_name), ''), nullif(lower(trim(p_contact_email)), ''), nullif(trim(p_contact_phone), ''), greatest(coalesce(p_plates, 0), 0), nullif(trim(p_notes), ''))
  returning id into new_id;
  insert into public.stores (workspace_id, name, slug) values (new_id, trim(p_name), 'principal');
  return new_id;
end;
$$;

create or replace function public.platform_workspaces()
returns table (id uuid, name text, status text, contact_name text, contact_email text, contact_phone text, plates_count integer, notes text, created_at timestamptz, members bigint, tags bigint, scans_30d bigint)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.status, w.contact_name, w.contact_email, w.contact_phone, w.plates_count, w.notes, w.created_at,
    (select count(*) from public.workspace_members m where m.workspace_id = w.id and m.status = 'Activo'),
    (select count(*) from public.nfc_tags t where t.workspace_id = w.id),
    (select count(*) from public.nfc_scans s join public.nfc_tags t on t.id = s.tag_id where t.workspace_id = w.id and s.scanned_at > now() - interval '30 days')
  from public.workspaces w
  where public.is_platform_admin()
  order by w.created_at desc;
$$;

-- El primer usuario del sistema también se vuelve administrador de la plataforma.
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
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ─── Diseño del perfil Linktree ──────────────────────────────────────────────
alter table public.linktree_profiles add column if not exists logo_url text check (logo_url is null or logo_url ~ '^https://');
alter table public.linktree_profiles add column if not exists bio text check (bio is null or length(bio) <= 280);
alter table public.linktree_profiles add column if not exists bg_style text not null default 'gradient' check (bg_style in ('solid', 'gradient', 'image'));
alter table public.linktree_profiles add column if not exists bg_color text not null default '#f5e6d8' check (bg_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.linktree_profiles add column if not exists bg_color_2 text not null default '#dcece5' check (bg_color_2 ~ '^#[0-9a-fA-F]{6}$');
alter table public.linktree_profiles add column if not exists bg_image_url text check (bg_image_url is null or bg_image_url ~ '^https://');
alter table public.linktree_profiles add column if not exists text_color text not null default '#292a26' check (text_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.linktree_profiles add column if not exists button_color text not null default '#292a26' check (button_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.linktree_profiles add column if not exists button_text_color text not null default '#f7f5eb' check (button_text_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.linktree_profiles add column if not exists button_shape text not null default 'rounded' check (button_shape in ('rounded', 'pill', 'square'));

-- Los enlaces pertenecen al perfil; borrar un tag ya no borra los enlaces compartidos.
alter table public.nfc_links alter column tag_id drop not null;
alter table public.nfc_links drop constraint if exists nfc_links_tag_id_fkey;
alter table public.nfc_links add constraint nfc_links_tag_id_fkey foreign key (tag_id) references public.nfc_tags(id) on delete set null;

-- Solo enlaces web, correo o teléfono (evita javascript: y similares). NOT VALID respeta filas antiguas.
alter table public.nfc_links drop constraint if exists nfc_links_url_scheme;
alter table public.nfc_links add constraint nfc_links_url_scheme check (url ~* '^(https?:|mailto:|tel:)') not valid;

-- ─── Página pública ──────────────────────────────────────────────────────────
create or replace function public.get_public_tag(tag_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'tag', jsonb_build_object('name', p.name, 'client_name', p.client_name),
    'design', jsonb_build_object(
      'logo_url', p.logo_url, 'bio', p.bio, 'bg_style', p.bg_style, 'bg_color', p.bg_color, 'bg_color_2', p.bg_color_2,
      'bg_image_url', p.bg_image_url, 'text_color', p.text_color, 'button_color', p.button_color,
      'button_text_color', p.button_text_color, 'button_shape', p.button_shape
    ),
    'links', coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url) order by l.position) filter (where l.id is not null), '[]'::jsonb)
  )
  from public.nfc_tags t
  join public.workspaces w on w.id = t.workspace_id and w.status = 'Activo'
  join public.linktree_profiles p on p.id = t.profile_id and p.status = 'Activo'
  left join public.nfc_links l on l.profile_id = p.id and l.active = true
  where lower(t.slug) = lower(tag_slug) and t.status = 'Activo'
  group by p.id;
$$;

create or replace function public.register_nfc_scan(tag_slug text, visitor text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_tag uuid;
begin
  select t.id into target_tag from public.nfc_tags t join public.workspaces w on w.id = t.workspace_id and w.status = 'Activo'
  where lower(t.slug) = lower(tag_slug) and t.status = 'Activo';
  if target_tag is null then return false; end if;
  insert into public.nfc_scans (tag_id, source, visitor_id) values (target_tag, 'nfc', nullif(left(visitor, 128), ''));
  return true;
end;
$$;

-- ─── Logos e imágenes de fondo ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_write_brand_folder(folder text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return folder ~ '^[0-9a-fA-F-]{36}$' and public.is_workspace_member(folder::uuid);
end;
$$;

drop policy if exists "members upload brand assets" on storage.objects;
drop policy if exists "members update brand assets" on storage.objects;
drop policy if exists "members delete brand assets" on storage.objects;
create policy "members upload brand assets" on storage.objects for insert to authenticated with check (bucket_id = 'brand-assets' and public.can_write_brand_folder((storage.foldername(name))[1]));
create policy "members update brand assets" on storage.objects for update to authenticated using (bucket_id = 'brand-assets' and public.can_write_brand_folder((storage.foldername(name))[1]));
create policy "members delete brand assets" on storage.objects for delete to authenticated using (bucket_id = 'brand-assets' and public.can_write_brand_folder((storage.foldername(name))[1]));

-- ─── Permisos y políticas ────────────────────────────────────────────────────
drop function if exists public.get_auth_user_id_by_email(text);

revoke execute on function public.protect_workspace_fields() from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.invite_member(uuid, text, text, public.member_role) from public, anon;
revoke execute on function public.claim_invitations() from public, anon;
revoke execute on function public.my_workspaces() from public, anon;
revoke execute on function public.create_workspace(text, text, text, text, integer, text) from public, anon;
revoke execute on function public.platform_workspaces() from public, anon;
revoke execute on function public.can_write_brand_folder(text) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.invite_member(uuid, text, text, public.member_role) to authenticated;
grant execute on function public.claim_invitations() to authenticated;
grant execute on function public.my_workspaces() to authenticated;
grant execute on function public.create_workspace(text, text, text, text, integer, text) to authenticated;
grant execute on function public.platform_workspaces() to authenticated;
grant execute on function public.can_write_brand_folder(text) to authenticated;

-- Solo nombre, rol y estado de un miembro son editables desde la app.
revoke update on public.workspace_members from authenticated;
grant update (name, role, status) on public.workspace_members to authenticated;
grant delete on public.workspace_members to authenticated;

drop policy if exists "members can view workspace members" on public.workspace_members;
drop policy if exists "admins can update workspace members" on public.workspace_members;
drop policy if exists "admins can remove workspace members" on public.workspace_members;
create policy "members can view workspace members" on public.workspace_members for select using (public.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy "admins can update workspace members" on public.workspace_members for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "admins can remove workspace members" on public.workspace_members for delete using (public.is_workspace_admin(workspace_id) and user_id <> auth.uid());

drop policy if exists "admins can update workspaces" on public.workspaces;
drop policy if exists "platform can delete workspaces" on public.workspaces;
create policy "admins can update workspaces" on public.workspaces for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy "platform can delete workspaces" on public.workspaces for delete using (public.is_platform_admin());

drop policy if exists "admins can view invitations" on public.workspace_invitations;
drop policy if exists "admins can cancel invitations" on public.workspace_invitations;
create policy "admins can view invitations" on public.workspace_invitations for select using (public.is_workspace_admin(workspace_id));
create policy "admins can cancel invitations" on public.workspace_invitations for delete using (public.is_workspace_admin(workspace_id));

drop policy if exists "admins can insert links" on public.nfc_links;
drop policy if exists "members can view links" on public.nfc_links;
drop policy if exists "admins can update links" on public.nfc_links;
drop policy if exists "admins can delete links" on public.nfc_links;
create policy "admins can insert links" on public.nfc_links for insert with check (exists (select 1 from public.linktree_profiles p where p.id = profile_id and public.can_manage_store(p.store_id)));
create policy "members can view links" on public.nfc_links for select using (exists (select 1 from public.linktree_profiles p where p.id = profile_id and public.can_manage_store(p.store_id)));
create policy "admins can update links" on public.nfc_links for update using (exists (select 1 from public.linktree_profiles p where p.id = profile_id and public.can_manage_store(p.store_id))) with check (exists (select 1 from public.linktree_profiles p where p.id = profile_id and public.can_manage_store(p.store_id)));
create policy "admins can delete links" on public.nfc_links for delete using (exists (select 1 from public.linktree_profiles p where p.id = profile_id and public.can_manage_store(p.store_id)));

drop policy if exists "members can view link clicks" on public.nfc_link_clicks;
create policy "members can view link clicks" on public.nfc_link_clicks for select using (exists (select 1 from public.nfc_links l join public.linktree_profiles p on p.id = l.profile_id where l.id = nfc_link_clicks.link_id and public.can_manage_store(p.store_id)));
