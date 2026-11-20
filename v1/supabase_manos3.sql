-- Cancelar funciones en curso: el celular pregunta si su orden fue cancelada.
create or replace function public.manos_orden_estado(p_hash text, p_orden uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.manos_dispositivos;
  e text;
begin
  select * into d from public.manos_dispositivos where token_hash = p_hash;
  if not found then
    return null;
  end if;
  select estado into e from public.manos_ordenes
    where id = p_orden and dispositivo_id = d.id;
  return e;
end;
$$;

revoke all on function public.manos_orden_estado(text, uuid) from public;
grant execute on function public.manos_orden_estado(text, uuid) to anon;

notify pgrst, 'reload schema';
