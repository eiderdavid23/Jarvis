-- Tareas automaticas: en que dispositivo se hacen (el nombre con el que esta vinculado en las Manos).
-- Vacio = el que este conectado. Ejecutar completo en Supabase > SQL Editor.
alter table public.tareas_auto
  add column if not exists dispositivo text check (dispositivo is null or char_length(dispositivo) <= 80);
