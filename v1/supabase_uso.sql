-- Uso real de la API: una fila por usuario, dia y proveedor.
create table if not exists public.uso_api (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  proveedor text not null check (proveedor in ('gemini', 'groq')),
  solicitudes integer not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_salida bigint not null default 0,
  actualizado timestamptz not null default now(),
  primary key (usuario_id, fecha, proveedor)
);

alter table public.uso_api enable row level security;

drop policy if exists "uso_api_ver" on public.uso_api;
create policy "uso_api_ver" on public.uso_api
  for select using (auth.uid() = usuario_id);

drop policy if exists "uso_api_crear" on public.uso_api;
create policy "uso_api_crear" on public.uso_api
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "uso_api_editar" on public.uso_api;
create policy "uso_api_editar" on public.uso_api
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Suma atomica: evita perder cuentas si dos mensajes llegan casi a la vez.
create or replace function public.registrar_uso(
  p_fecha date, p_proveedor text, p_solicitudes integer, p_tin bigint, p_tout bigint
) returns void
language sql
security invoker
as $$
  insert into public.uso_api (usuario_id, fecha, proveedor, solicitudes, tokens_entrada, tokens_salida)
  values (auth.uid(), p_fecha, p_proveedor, p_solicitudes, p_tin, p_tout)
  on conflict (usuario_id, fecha, proveedor) do update set
    solicitudes = public.uso_api.solicitudes + excluded.solicitudes,
    tokens_entrada = public.uso_api.tokens_entrada + excluded.tokens_entrada,
    tokens_salida = public.uso_api.tokens_salida + excluded.tokens_salida,
    actualizado = now();
$$;
