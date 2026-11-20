-- Trabajos en segundo plano: Jarvis hace una tarea larga mientras el usuario hace otra cosa.
-- Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.trabajos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  instruccion text not null check (char_length(instruccion) between 1 and 1500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'hecho', 'fallido', 'cancelado')),
  pasos jsonb not null default '[]'::jsonb,
  resultado text check (resultado is null or char_length(resultado) <= 3000),
  dispositivo text,
  actualizado timestamptz not null default now(),
  creado timestamptz not null default now()
);

create index if not exists trabajos_usuario_creado on public.trabajos (usuario_id, creado desc);

alter table public.trabajos enable row level security;

drop policy if exists "trabajos_propios" on public.trabajos;
create policy "trabajos_propios" on public.trabajos
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
