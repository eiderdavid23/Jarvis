-- Metas del contador de uso: una fila por usuario y proveedor.
create table if not exists public.metas_uso (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proveedor text not null check (proveedor in ('gemini', 'groq')),
  meta integer not null check (meta >= 1),
  actualizado timestamptz not null default now(),
  primary key (usuario_id, proveedor)
);

alter table public.metas_uso enable row level security;

drop policy if exists "metas_uso_ver" on public.metas_uso;
create policy "metas_uso_ver" on public.metas_uso
  for select using (auth.uid() = usuario_id);

drop policy if exists "metas_uso_crear" on public.metas_uso;
create policy "metas_uso_crear" on public.metas_uso
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "metas_uso_editar" on public.metas_uso;
create policy "metas_uso_editar" on public.metas_uso
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
