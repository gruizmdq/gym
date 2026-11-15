-- The first migration used Spanish names and never held data (no sign-in had happened yet).
-- This one drops it and recreates the same schema with the names the app uses now.
drop table if exists public.series, public.sesiones, public.ajustes_ejercicio, public.mesociclos,
  public.rutinas;
drop function if exists public.antes_de_escribir();
drop function if exists public.latido();
drop sequence if exists public.sync_secuencia;

-- Training data the phone syncs (Dexie is the source of truth there).
-- A single user: RLS limits every row to its owner. Columns use the same names as the app, so
-- Claude can analyze with SQL without translating.

-- Sync cursor: every write takes the next number. The phone asks for "everything with a seq
-- greater than the last one I saw"; it doesn't depend on any clock.
create sequence public.sync_seq;

-- Last write wins per row, by the phone time that made it: a version older than the stored one
-- is silently discarded.
create function public.before_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.seq := nextval('public.sync_seq');
  return new;
end;
$$;

create table public.routines (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version text not null,
  content jsonb not null,
  seen_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, version)
);
comment on table public.routines is 'Every version of routine/routine.json the app saw (version = content hash).';

create table public.mesocycles (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number integer not null,
  plan text not null,
  start date not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, number)
);
comment on table public.mesocycles is 'Only the mesocycles that were touched; the rest derive from 6 weeks after the previous one.';

create table public.sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  plan text not null,
  day text not null,
  date date not null,
  status text not null check (status in ('in-progress', 'finished', 'skipped', 'discarded')),
  mesocycle integer not null,
  week integer not null,
  deload boolean not null default false,
  routine_version text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  sort_order bigint not null,
  chosen jsonb not null default '{}',
  extra_sets jsonb not null default '{}',
  skipped text[] not null default '{}',
  rest jsonb,
  notes text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, id)
);
comment on column public.sessions.chosen is 'slot → exercise used when it was an alternative.';

create table public.sets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  session_id uuid not null,
  slot_id text not null,
  exercise_id text not null,
  signature text not null,
  number integer not null,
  side text check (side in ('left', 'right')),
  weight numeric(7, 2),
  unit text not null check (unit in ('kg', 'lb', 'bricks')),
  reps integer not null,
  tempo_ok boolean not null,
  technique_done boolean not null,
  technique_reps integer,
  done boolean not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, id),
  foreign key (user_id, session_id) references public.sessions (user_id, id)
);
comment on column public.sets.signature is 'day|exercise|reps|tempo|technique: two sets are comparable when it matches.';
comment on column public.sets.done is 'false = set edited but not completed yet.';

create table public.exercise_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null,
  unit text not null check (unit in ('kg', 'lb', 'bricks')),
  step numeric(6, 2) not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, exercise_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['routines', 'mesocycles', 'sessions', 'sets', 'exercise_settings'] loop
    execute format('create index on public.%I (user_id, seq)', t);
    execute format(
      'create trigger before_write before insert or update on public.%I
         for each row execute function public.before_write()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_only on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    -- No delete: deletions are logical (deleted_at) so they sync too.
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;

create index on public.sets (user_id, exercise_id);
create index on public.sets (user_id, session_id);

grant usage on sequence public.sync_seq to authenticated;

-- For the cron that keeps the free plan from pausing the project: touches the database, reads no data.
create function public.heartbeat() returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;
grant execute on function public.heartbeat() to anon;
