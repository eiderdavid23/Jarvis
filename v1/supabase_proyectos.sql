-- Proyectos: carpetas que agrupan chats, con instrucciones opcionales para Jarvis.
create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  instrucciones text not null default '' check (char_length(instrucciones) <= 2000),
  creado timestamptz not null default now()
);

create index if not exists proyectos_usuario on public.proyectos (usuario_id, creado);

alter table public.proyectos enable row level security;

drop policy if exists "proyectos_ver" on public.proyectos;
create policy "proyectos_ver" on public.proyectos
  for select using (auth.uid() = usuario_id);

drop policy if exists "proyectos_crear" on public.proyectos;
create policy "proyectos_crear" on public.proyectos
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "proyectos_editar" on public.proyectos;
create policy "proyectos_editar" on public.proyectos
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "proyectos_borrar" on public.proyectos;
create policy "proyectos_borrar" on public.proyectos
  for delete using (auth.uid() = usuario_id);

-- Si se borra un proyecto, sus chats no se borran: quedan sin proyecto.
alter table public.chats
  add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;

create index if not exists chats_proyecto on public.chats (proyecto_id);
