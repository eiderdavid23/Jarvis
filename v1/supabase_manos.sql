-- Manos de Jarvis: dispositivos controlables y cola de ordenes. Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.manos_dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  plataforma text not null default 'pc' check (plataforma in ('pc', 'android')),
  visto timestamptz not null default now(),
  pantalla text,
  pantalla_en timestamptz,
  ancho int,
  alto int,
  creado timestamptz not null default now(),
  unique (usuario_id, nombre)
);

create table if not exists public.manos_ordenes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dispositivo_id uuid not null references public.manos_dispositivos(id) on delete cascade,
  tipo text not null,
  args jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviada', 'hecha', 'error', 'rechazada', 'vencida')),
  resultado text,
  creado timestamptz not null default now(),
  hecho timestamptz
);

create index if not exists manos_ordenes_cola on public.manos_ordenes (dispositivo_id, estado, creado);

alter table public.manos_dispositivos enable row level security;
alter table public.manos_ordenes enable row level security;

drop policy if exists "manos_dispositivos_propios" on public.manos_dispositivos;
create policy "manos_dispositivos_propios" on public.manos_dispositivos
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "manos_ordenes_propias" on public.manos_ordenes;
create policy "manos_ordenes_propias" on public.manos_ordenes
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
