-- NEXUS23 dentro de Jarvis: perfiles (rol y aprobacion), plataformas y asignaciones.
-- Ejecutar completo en Supabase > SQL Editor.

-- 1. Perfiles: quien puede entrar a Nexus. Los usuarios nuevos quedan "pendiente".
create table if not exists public.nexus_perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'usuario' check (rol in ('admin', 'usuario')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado')),
  nombre text not null default '',
  correo text not null default '',
  creado timestamptz not null default now()
);

-- Funciones de ayuda (security definer: leen los perfiles sin chocar con RLS).
create or replace function public.nexus_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nexus_perfiles
                 where user_id = auth.uid() and rol = 'admin' and estado = 'aprobado');
$$;

create or replace function public.nexus_es_aprobado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nexus_perfiles
                 where user_id = auth.uid() and estado = 'aprobado');
$$;

-- El nombre y el correo los pone la base (nadie los puede falsificar).
create or replace function public.nexus_perfil_datos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select u.email, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))
    into new.correo, new.nombre
    from auth.users u where u.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists nexus_perfil_datos on public.nexus_perfiles;
create trigger nexus_perfil_datos before insert on public.nexus_perfiles
  for each row execute function public.nexus_perfil_datos();

alter table public.nexus_perfiles enable row level security;

drop policy if exists "nexus_perfiles_ver" on public.nexus_perfiles;
create policy "nexus_perfiles_ver" on public.nexus_perfiles
  for select using (auth.uid() = user_id or public.nexus_es_admin());

-- Cada quien solo puede pedir acceso para si mismo, siempre como usuario pendiente.
drop policy if exists "nexus_perfiles_pedir" on public.nexus_perfiles;
create policy "nexus_perfiles_pedir" on public.nexus_perfiles
  for insert with check (auth.uid() = user_id and rol = 'usuario' and estado = 'pendiente');

drop policy if exists "nexus_perfiles_editar" on public.nexus_perfiles;
create policy "nexus_perfiles_editar" on public.nexus_perfiles
  for update using (public.nexus_es_admin()) with check (public.nexus_es_admin());

drop policy if exists "nexus_perfiles_borrar" on public.nexus_perfiles;
create policy "nexus_perfiles_borrar" on public.nexus_perfiles
  for delete using (public.nexus_es_admin());

-- 2. Plataformas: dueno_id vacio = plataforma global (catalogo del admin); con dueno = personal.
create table if not exists public.nexus_plataformas (
  id uuid primary key default gen_random_uuid(),
  dueno_id uuid references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  descripcion text not null default '' check (char_length(descripcion) <= 200),
  url text not null check (url ~* '^https?://' and char_length(url) <= 500),
  creado timestamptz not null default now()
);

create index if not exists nexus_plataformas_dueno on public.nexus_plataformas (dueno_id);

-- 3. Asignaciones: que plataformas globales ve cada usuario normal.
create table if not exists public.nexus_asignaciones (
  usuario_id uuid not null references public.nexus_perfiles(user_id) on delete cascade,
  plataforma_id uuid not null references public.nexus_plataformas(id) on delete cascade,
  primary key (usuario_id, plataforma_id)
);

alter table public.nexus_plataformas enable row level security;
alter table public.nexus_asignaciones enable row level security;

drop policy if exists "nexus_asig_ver" on public.nexus_asignaciones;
create policy "nexus_asig_ver" on public.nexus_asignaciones
  for select using (public.nexus_es_admin() or (auth.uid() = usuario_id and public.nexus_es_aprobado()));

drop policy if exists "nexus_asig_crear" on public.nexus_asignaciones;
create policy "nexus_asig_crear" on public.nexus_asignaciones
  for insert with check (public.nexus_es_admin());

drop policy if exists "nexus_asig_borrar" on public.nexus_asignaciones;
create policy "nexus_asig_borrar" on public.nexus_asignaciones
  for delete using (public.nexus_es_admin());

drop policy if exists "nexus_plat_ver" on public.nexus_plataformas;
create policy "nexus_plat_ver" on public.nexus_plataformas
  for select using (
    public.nexus_es_admin()
    or (public.nexus_es_aprobado() and (
      dueno_id = auth.uid()
      or exists (select 1 from public.nexus_asignaciones a
                 where a.plataforma_id = nexus_plataformas.id and a.usuario_id = auth.uid())
    ))
  );

-- Crear: cualquier aprobado crea las suyas; solo el admin crea globales.
drop policy if exists "nexus_plat_crear" on public.nexus_plataformas;
create policy "nexus_plat_crear" on public.nexus_plataformas
  for insert with check (
    (public.nexus_es_aprobado() and dueno_id = auth.uid())
    or (public.nexus_es_admin() and dueno_id is null)
  );

drop policy if exists "nexus_plat_editar" on public.nexus_plataformas;
create policy "nexus_plat_editar" on public.nexus_plataformas
  for update
  using (public.nexus_es_admin() or (public.nexus_es_aprobado() and dueno_id = auth.uid()))
  with check (
    (public.nexus_es_aprobado() and dueno_id = auth.uid())
    or (public.nexus_es_admin() and dueno_id is null)
  );

drop policy if exists "nexus_plat_borrar" on public.nexus_plataformas;
create policy "nexus_plat_borrar" on public.nexus_plataformas
  for delete using (public.nexus_es_admin() or (public.nexus_es_aprobado() and dueno_id = auth.uid()));

-- 4. Tu cuenta queda como administrador aprobado (si el correo no existe en Jarvis, no inserta nada).
insert into public.nexus_perfiles (user_id, rol, estado)
select id, 'admin', 'aprobado' from auth.users where email = 'eiderdavidgarcia23@gmail.com'
on conflict (user_id) do update set rol = 'admin', estado = 'aprobado';
