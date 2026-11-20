-- Recordatorios: una fila por recordatorio, cada usuario ve solo los suyos.
create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 300),
  cuando timestamptz not null,
  avisado boolean not null default false,
  creado timestamptz not null default now()
);

create index if not exists recordatorios_usuario_cuando on public.recordatorios (usuario_id, cuando);

alter table public.recordatorios enable row level security;

drop policy if exists "recordatorios_ver" on public.recordatorios;
create policy "recordatorios_ver" on public.recordatorios
  for select using (auth.uid() = usuario_id);

drop policy if exists "recordatorios_crear" on public.recordatorios;
create policy "recordatorios_crear" on public.recordatorios
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "recordatorios_editar" on public.recordatorios;
create policy "recordatorios_editar" on public.recordatorios
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "recordatorios_borrar" on public.recordatorios;
create policy "recordatorios_borrar" on public.recordatorios
  for delete using (auth.uid() = usuario_id);
