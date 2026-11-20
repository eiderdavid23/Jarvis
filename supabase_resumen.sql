alter table public.chats add column if not exists resumen text;
alter table public.chats add column if not exists resumen_hasta timestamptz;
