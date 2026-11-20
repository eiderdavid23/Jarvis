-- Control de TV (Android TV): permite la plataforma 'tv' en los dispositivos. Ejecutar completo en Supabase > SQL Editor.
alter table public.manos_dispositivos drop constraint if exists manos_dispositivos_plataforma_check;
alter table public.manos_dispositivos
  add constraint manos_dispositivos_plataforma_check check (plataforma in ('pc', 'android', 'tv'));

notify pgrst, 'reload schema';
