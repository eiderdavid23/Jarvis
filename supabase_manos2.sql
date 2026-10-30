-- Manos de Jarvis, parte 2: token propio del celular. Ejecutar completo en Supabase > SQL Editor.
alter table public.manos_dispositivos add column if not exists token_hash text unique;

create or replace function public.manos_orden_siguiente(p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.manos_dispositivos;
  o public.manos_ordenes;
begin
  select * into d from public.manos_dispositivos where token_hash = p_hash;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  update public.manos_dispositivos set visto = now() where id = d.id;
  select * into o from public.manos_ordenes
    where dispositivo_id = d.id and estado = 'pendiente'
    order by creado
    limit 1
    for update skip locked;
  if not found then
    return jsonb_build_object('ok', true, 'orden', null);
  end if;
  update public.manos_ordenes set estado = 'enviada' where id = o.id;
  return jsonb_build_object('ok', true, 'orden',
    jsonb_build_object('id', o.id, 'tipo', o.tipo, 'args', o.args));
end;
$$;

create or replace function public.manos_orden_resultado(
  p_hash text, p_orden uuid, p_estado text, p_texto text,
  p_pantalla text, p_ancho int, p_alto int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.manos_dispositivos;
begin
  select * into d from public.manos_dispositivos where token_hash = p_hash;
  if not found or p_estado not in ('hecha', 'error', 'rechazada') then
    return false;
  end if;
  update public.manos_ordenes
    set estado = p_estado, resultado = left(coalesce(p_texto, ''), 6000), hecho = now()
    where id = p_orden and dispositivo_id = d.id and estado = 'enviada';
  if not found then
    return false;
  end if;
  if p_pantalla is not null then
    update public.manos_dispositivos
      set pantalla = p_pantalla, pantalla_en = now(), ancho = p_ancho, alto = p_alto
      where id = d.id;
  end if;
  return true;
end;
$$;

revoke all on function public.manos_orden_siguiente(text) from public;
revoke all on function public.manos_orden_resultado(text, uuid, text, text, text, int, int) from public;
grant execute on function public.manos_orden_siguiente(text) to anon;
grant execute on function public.manos_orden_resultado(text, uuid, text, text, text, int, int) to anon;
