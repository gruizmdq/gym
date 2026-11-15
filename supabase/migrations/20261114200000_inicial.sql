-- Datos de entrenamiento que sincroniza el teléfono (Dexie es la fuente de verdad allá).
-- Un solo usuario: RLS limita cada fila a su dueño. Las columnas usan los mismos nombres que
-- la app para que Claude pueda analizar con SQL sin traducir.

-- Cursor de sincronización: cada escritura toma el siguiente número. El teléfono pide "lo que
-- tenga secuencia mayor a la última que vi"; no depende de ningún reloj.
create sequence public.sync_secuencia;

-- Gana la última escritura por fila, según la hora del teléfono que la hizo: una versión más
-- vieja que la guardada se descarta en silencio.
create function public.antes_de_escribir() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.actualizado_en < old.actualizado_en then
    return null;
  end if;
  new.secuencia := nextval('public.sync_secuencia');
  return new;
end;
$$;

create table public.rutinas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version text not null,
  contenido jsonb not null,
  vista_en timestamptz not null,
  actualizado_en timestamptz not null,
  eliminado_en timestamptz,
  secuencia bigint not null default nextval('public.sync_secuencia'),
  primary key (user_id, version)
);
comment on table public.rutinas is 'Cada versión de rutina/rutina.json que vio la app (version = hash del contenido).';

create table public.mesociclos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero integer not null,
  plan text not null,
  inicio date not null,
  actualizado_en timestamptz not null,
  eliminado_en timestamptz,
  secuencia bigint not null default nextval('public.sync_secuencia'),
  primary key (user_id, numero)
);
comment on table public.mesociclos is 'Solo los mesociclos que se tocaron; los demás se derivan de 6 semanas desde el anterior.';

create table public.sesiones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  plan text not null,
  dia text not null,
  fecha date not null,
  estado text not null check (estado in ('en-curso', 'terminada', 'salteada', 'descartada')),
  mesociclo integer not null,
  semana integer not null,
  descarga boolean not null default false,
  version_rutina text not null,
  iniciada_en timestamptz not null,
  finalizada_en timestamptz,
  orden bigint not null,
  elegidos jsonb not null default '{}',
  extras jsonb not null default '{}',
  salteados text[] not null default '{}',
  descanso jsonb,
  notas text,
  actualizado_en timestamptz not null,
  eliminado_en timestamptz,
  secuencia bigint not null default nextval('public.sync_secuencia'),
  primary key (user_id, id)
);
comment on column public.sesiones.elegidos is 'slot → ejercicio usado cuando fue una alternativa.';

create table public.series (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  sesion_id uuid not null,
  slot_id text not null,
  ejercicio_id text not null,
  firma text not null,
  indice integer not null,
  lado text check (lado in ('izquierda', 'derecha')),
  peso numeric(7, 2),
  unidad text not null check (unidad in ('kg', 'lb', 'ladrillos')),
  reps integer not null,
  cadencia_ok boolean not null,
  tecnica_hecha boolean not null,
  reps_tecnica integer,
  hecha boolean not null,
  actualizado_en timestamptz not null,
  eliminado_en timestamptz,
  secuencia bigint not null default nextval('public.sync_secuencia'),
  primary key (user_id, id),
  foreign key (user_id, sesion_id) references public.sesiones (user_id, id)
);
comment on column public.series.firma is 'día|ejercicio|reps|cadencia|técnica: dos series son comparables si coincide.';
comment on column public.series.hecha is 'false = serie editada pero todavía no completada.';

create table public.ajustes_ejercicio (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ejercicio_id text not null,
  unidad text not null check (unidad in ('kg', 'lb', 'ladrillos')),
  paso numeric(6, 2) not null,
  actualizado_en timestamptz not null,
  eliminado_en timestamptz,
  secuencia bigint not null default nextval('public.sync_secuencia'),
  primary key (user_id, ejercicio_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['rutinas', 'mesociclos', 'sesiones', 'series', 'ajustes_ejercicio'] loop
    execute format('create index on public.%I (user_id, secuencia)', t);
    execute format(
      'create trigger antes_de_escribir before insert or update on public.%I
         for each row execute function public.antes_de_escribir()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy solo_el_duenio on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    -- Sin delete: los borrados son lógicos (eliminado_en) para que también se sincronicen.
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;

create index on public.series (user_id, ejercicio_id);
create index on public.series (user_id, sesion_id);

grant usage on sequence public.sync_secuencia to authenticated;

-- Para el cron que evita que el plan gratuito pause el proyecto: toca la base sin datos.
create function public.latido() returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;
grant execute on function public.latido() to anon;
