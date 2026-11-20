-- Plantilla de modulo: una tabla por usuario con RLS. Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.gastos_items (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  creado timestamptz not null default now()
);

alter table public.gastos_items enable row level security;

drop policy if exists "gastos_items_propios" on public.gastos_items;
create policy "gastos_items_propios" on public.gastos_items
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
