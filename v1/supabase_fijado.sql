-- Chats fijados: los fijados salen primero en la lista del sidebar.
alter table public.chats add column if not exists fijado boolean not null default false;
