-- Tareas automaticas: Jarvis las ejecuta solo a su hora. Cada usuario ve solo las suyas.
-- Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.tareas_auto (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  instruccion text not null check (char_length(instruccion) between 1 and 800),
  cuando timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'hecha', 'fallida')),
  resultado text check (resultado is null or char_length(resultado) <= 600),
  ejecutado timestamptz,
  creado timestamptz not null default now()
);

create index if not exists tareas_auto_usuario_cuando on public.tareas_auto (usuario_id, cuando);

alter table public.tareas_auto enable row level security;

drop policy if exists "tareas_auto_propias" on public.tareas_auto;
create policy "tareas_auto_propias" on public.tareas_auto
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
