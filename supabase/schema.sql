-- Homeschool HQ — M6 sync schema reference snapshot.
--
-- Deployment source of truth:
--   supabase/migrations/20260724074106_academy_profiles_base.sql
--
-- This file remains for legacy/local setup consumers and must stay
-- semantically identical to the table, RLS, policy, owner, and ACL contract in
-- the timestamped migration. Do not use it as an independent deployment path.
-- It creates a single `profiles` table that mirrors the app's Profile type as JSONB,
-- one row per (household, profile), with Row-Level Security so each household (Dad's
-- login) can only read and write its OWN rows. Nothing here needs the service key.

create table if not exists public.profiles (
  -- the household owner = the signed-in user; filled automatically, never sent by the client.
  household_id uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  -- the app's profile id ('p1'…'p5'); unique within a household.
  profile_id   text    not null,
  -- the whole Profile object as JSON.
  data         jsonb   not null,
  -- content-modification time; the client sends this and the app uses it for last-write-wins.
  updated_at   timestamptz not null default now(),
  primary key (household_id, profile_id)
);

alter table public.profiles owner to postgres;

-- Row-Level Security: a household sees and writes only its own rows.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (household_id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (household_id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (household_id = auth.uid()) with check (household_id = auth.uid());
create policy "profiles_delete_own" on public.profiles
  for delete using (household_id = auth.uid());

-- The signed-in (authenticated) role may use the table; anon gets nothing.
revoke all privileges on table public.profiles
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated;

-- The app upserts with ON CONFLICT (household_id, profile_id) = the primary key above,
-- so a second push of the same profile updates the row instead of erroring.
