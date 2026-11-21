-- Datos de los conectores (Telegram, Gmail, WhatsApp, etc.), cifrados por el servidor con LLAVES_SECRET.
create table if not exists public.conectores (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conector text not null,
  datos_cifrados text not null,
  actualizado timestamptz not null default now(),
  primary key (user_id, conector)
);

alter table public.conectores enable row level security;

drop policy if exists "conectores_ver" on public.conectores;
create policy "conectores_ver" on public.conectores
  for select using (auth.uid() = user_id);

drop policy if exists "conectores_crear" on public.conectores;
create policy "conectores_crear" on public.conectores
  for insert with check (auth.uid() = user_id);

drop policy if exists "conectores_editar" on public.conectores;
create policy "conectores_editar" on public.conectores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conectores_borrar" on public.conectores;
create policy "conectores_borrar" on public.conectores
  for delete using (auth.uid() = user_id);
