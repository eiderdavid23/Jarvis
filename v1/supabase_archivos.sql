-- Archivos adjuntados a un chat (texto de zips, PDF y archivos de texto).
-- El tipo de chat_id se copia de chats.id, asi no importa si es uuid o bigint.
do $$
declare t text;
begin
  select format_type(atttypid, atttypmod) into t
  from pg_attribute
  where attrelid = 'public.chats'::regclass and attname = 'id' and not attisdropped;
  execute format($f$
    create table if not exists public.archivos_chat (
      id bigint generated always as identity primary key,
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      chat_id %s not null references public.chats(id) on delete cascade,
      ruta text not null,
      tipo text not null default 'texto',
      tam integer not null default 0,
      largo integer not null default 0,
      estado text not null default '',
      texto text not null default '',
      creado timestamptz not null default now(),
      unique (chat_id, ruta)
    )$f$, t);
end $$;

alter table public.archivos_chat enable row level security;

drop policy if exists "archivos_ver" on public.archivos_chat;
create policy "archivos_ver" on public.archivos_chat
  for select using (auth.uid() = user_id);

drop policy if exists "archivos_crear" on public.archivos_chat;
create policy "archivos_crear" on public.archivos_chat
  for insert with check (auth.uid() = user_id);

drop policy if exists "archivos_editar" on public.archivos_chat;
create policy "archivos_editar" on public.archivos_chat
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "archivos_borrar" on public.archivos_chat;
create policy "archivos_borrar" on public.archivos_chat
  for delete using (auth.uid() = user_id);
