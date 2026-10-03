-- Bots de soporte para integrar Jarvis en otras plataformas.
create table if not exists public.bots (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  dueno_id uuid references auth.users(id) on delete cascade default auth.uid(),
  nombre text not null,
  color text not null default '#00d4ff',
  saludo text not null default 'Hola, ¿en qué te puedo ayudar?',
  contacto text not null default '',
  info text not null default '',
  faq jsonb not null default '[]'::jsonb,
  dominios text[] not null default '{}',
  limite_ia_dia integer not null default 200,
  limite_visitante_dia integer not null default 10,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

alter table public.bots enable row level security;

drop policy if exists "bots_dueno" on public.bots;
create policy "bots_dueno" on public.bots
  for all using (auth.uid() = dueno_id) with check (auth.uid() = dueno_id);

-- Contador de mensajes con IA por bot, por visitante y por dia.
create table if not exists public.bot_uso (
  bot_id text not null,
  clave text not null,
  fecha date not null,
  n integer not null default 0,
  primary key (bot_id, clave, fecha)
);

alter table public.bot_uso enable row level security;

create or replace function public.bot_contar(p_bot text, p_clave text, p_fecha date)
returns integer
language sql
security invoker
as $$
  insert into public.bot_uso (bot_id, clave, fecha, n)
  values (p_bot, p_clave, p_fecha, 1)
  on conflict (bot_id, clave, fecha) do update set n = public.bot_uso.n + 1
  returning n;
$$;

-- Bot de ejemplo: EDITA los textos con los datos reales de Mani Garcia.
insert into public.bots (id, nombre, color, saludo, contacto, info, faq)
values (
  'mani-garcia',
  'Maní Garcia',
  '#e0a030',
  '¡Hola! Soy el asistente de Maní Garcia. ¿En qué te puedo ayudar?',
  'EDITA: WhatsApp o correo de contacto',
  'EDITA: aqui van los productos, precios, envios, horarios y formas de pago de Maní Garcia.',
  '[
    {"p":"¿Qué productos venden?","r":"EDITA: lista de productos.","k":["producto","venden","tienen","catalogo"]},
    {"p":"¿Cómo son los envíos?","r":"EDITA: cobertura y tiempos de envío.","k":["envio","domicilio","entrega","despacho"]},
    {"p":"¿Qué formas de pago hay?","r":"EDITA: formas de pago.","k":["pago","pagar","tarjeta","efectivo","nequi"]}
  ]'::jsonb
)
on conflict (id) do nothing;
