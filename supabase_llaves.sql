-- Llaves de IA por cuenta (cifradas por el servidor con LLAVES_SECRET).
create table if not exists public.llaves_ia (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proveedor text not null check (proveedor in ('gemini', 'groq')),
  llave_cifrada text not null,
  actualizado timestamptz not null default now(),
  primary key (user_id, proveedor)
);

alter table public.llaves_ia enable row level security;

drop policy if exists "llaves_ver" on public.llaves_ia;
create policy "llaves_ver" on public.llaves_ia
  for select using (auth.uid() = user_id);

drop policy if exists "llaves_crear" on public.llaves_ia;
create policy "llaves_crear" on public.llaves_ia
  for insert with check (auth.uid() = user_id);

drop policy if exists "llaves_editar" on public.llaves_ia;
create policy "llaves_editar" on public.llaves_ia
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "llaves_borrar" on public.llaves_ia;
create policy "llaves_borrar" on public.llaves_ia
  for delete using (auth.uid() = user_id);
