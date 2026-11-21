-- Avisos de trabajos fallidos: marca si Jarvis ya le contó al usuario el fallo.
-- Ejecutar completo en Supabase > SQL Editor.
alter table public.trabajos add column if not exists avisado boolean not null default false;
-- Lo que ya existe se da por avisado, para que no te avise de fallos viejos.
update public.trabajos set avisado = true where avisado = false;
