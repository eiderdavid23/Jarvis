-- Add-ons de Minecraft: se guardan para poder descargarlos por enlace (Chrome y APK).
create table if not exists public.addons_mc (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  archivo text not null,
  datos text not null,
  creado timestamptz not null default now()
);

alter table public.addons_mc enable row level security;

drop policy if exists "addons_mc_propios" on public.addons_mc;
create policy "addons_mc_propios" on public.addons_mc
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create or replace function public.addon_descargar(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('archivo', archivo, 'datos', datos)
  from public.addons_mc where id = p_id;
$$;

revoke all on function public.addon_descargar(uuid) from public;
grant execute on function public.addon_descargar(uuid) to anon;

notify pgrst, 'reload schema';
