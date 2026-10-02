-- Modo redirección: un perfil puede mandar directo a uno de sus enlaces en lugar de mostrar la página.
-- Es idempotente: se puede correr más de una vez en el SQL Editor de Supabase.

alter table public.linktree_profiles add column if not exists redirect_link_id uuid references public.nfc_links(id) on delete set null;

-- Si el enlace elegido está oculto o es de otro perfil, se ignora y se muestra la página normal.
create or replace function public.get_public_tag(tag_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'tag', jsonb_build_object('name', p.name, 'client_name', p.client_name),
    'design', jsonb_build_object(
      'logo_url', p.logo_url, 'bio', p.bio, 'bg_style', p.bg_style, 'bg_color', p.bg_color, 'bg_color_2', p.bg_color_2,
      'bg_image_url', p.bg_image_url, 'text_color', p.text_color, 'button_color', p.button_color,
      'button_text_color', p.button_text_color, 'button_shape', p.button_shape
    ),
    'links', coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url) order by l.position) filter (where l.id is not null), '[]'::jsonb),
    'redirect', (jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url)) filter (where l.id = p.redirect_link_id)) -> 0
  )
  from public.nfc_tags t
  join public.workspaces w on w.id = t.workspace_id and w.status = 'Activo'
  join public.linktree_profiles p on p.id = t.profile_id and p.status = 'Activo'
  left join public.nfc_links l on l.profile_id = p.id and l.active = true
  where lower(t.slug) = lower(tag_slug) and t.status = 'Activo'
  group by p.id;
$$;

grant execute on function public.get_public_tag(text) to anon, authenticated;
