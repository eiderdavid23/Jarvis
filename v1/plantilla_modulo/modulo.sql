-- Plantilla de modulo: una tabla por usuario con RLS. Ejecutar completo en Supabase > SQL Editor.
create table if not exists public.ejemplo_items (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  creado timestamptz not null default now()
);

alter table public.ejemplo_items enable row level security;

drop policy if exists "ejemplo_items_propios" on public.ejemplo_items;
create policy "ejemplo_items_propios" on public.ejemplo_items
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
