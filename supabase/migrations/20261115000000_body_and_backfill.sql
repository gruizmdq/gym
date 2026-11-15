-- Phase 6: body measurements, and sessions logged afterwards for a past date.

alter table public.sessions add column backfilled boolean not null default false;

-- One weighing per day, in kg.
create table public.weights (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kg numeric(5, 2) not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, date)
);

-- The day's three waist measurements, in cm; the average is derived.
create table public.waists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  measurements numeric(5, 1)[] not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, date)
);

-- Monthly circumferences, in cm, one side.
create table public.circumferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  thigh numeric(5, 1) not null,
  calf numeric(5, 1) not null,
  arm numeric(5, 1) not null,
  chest numeric(5, 1) not null,
  shoulders numeric(5, 1) not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, date)
);

do $$
declare
  t text;
begin
  foreach t in array array['weights', 'waists', 'circumferences'] loop
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
