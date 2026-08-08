begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy admin authorization migration must run as postgres';
  end if;
end;
$$;

-- Supabase Auth remains the identity provider. This table adds only Academy
-- administrative authority and deliberately stores no email, password, token,
-- parent PIN, or student credential.
create table public.academy_admin_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'viewer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  revision bigint not null default 1 check (revision in (1, 2)),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete restrict,
  assigned_by_role text check (assigned_by_role is null or assigned_by_role = 'owner'),
  assignment_reason_code text not null
    check (assignment_reason_code ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'),
  assignment_correlation_id uuid not null default gen_random_uuid(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete restrict,
  revoked_by_role text check (revoked_by_role is null or revoked_by_role = 'owner'),
  revocation_reason_code text,
  revocation_correlation_id uuid,
  constraint academy_admin_role_assignments_assignment_actor_check check (
    (assigned_by is null and assigned_by_role is null)
    or (assigned_by is not null and assigned_by_role = 'owner')
  ),
  constraint academy_admin_role_assignments_expiry_check check (
    expires_at is null or expires_at > assigned_at
  ),
  constraint academy_admin_role_assignments_lifecycle_check check (
    (
      status = 'active'
      and revision = 1
      and revoked_at is null
      and revoked_by is null
      and revoked_by_role is null
      and revocation_reason_code is null
      and revocation_correlation_id is null
    )
    or (
      status = 'revoked'
      and revision = 2
      and revoked_at is not null
      and revoked_at >= assigned_at
      and revoked_by is not null
      and revoked_by_role = 'owner'
      and revocation_reason_code ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'
      and revocation_correlation_id is not null
    )
  )
);

alter table public.academy_admin_role_assignments owner to postgres;

create unique index academy_admin_role_assignments_one_active_user_idx
  on public.academy_admin_role_assignments (user_id)
  where status = 'active' and revoked_at is null;

alter table public.academy_admin_role_assignments enable row level security;
alter table public.academy_admin_role_assignments force row level security;

-- Role assignments are history. Until an owner-authorized, atomically audited
-- mutation RPC is introduced, only the one-way active-to-revoked transition is
-- structurally permitted and deletion is refused.
create function public.academy_admin_guard_role_assignment_history()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Academy admin role assignment history cannot be deleted';
  end if;
  if old.status <> 'active'
     or new.status <> 'revoked'
     or new.revision <> old.revision + 1
     or new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.assigned_at is distinct from old.assigned_at
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_by_role is distinct from old.assigned_by_role
     or new.assignment_reason_code is distinct from old.assignment_reason_code
     or new.assignment_correlation_id is distinct from old.assignment_correlation_id
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Academy admin role assignments permit only an audited revocation transition';
  end if;
  return new;
end;
$$;

alter function public.academy_admin_guard_role_assignment_history() owner to postgres;
revoke all on function public.academy_admin_guard_role_assignment_history()
  from public, anon, authenticated, service_role;

create trigger academy_admin_role_assignments_guard_history
  before update or delete on public.academy_admin_role_assignments
  for each row execute function public.academy_admin_guard_role_assignment_history();

-- This is the only application-readable database boundary. The authenticated
-- access token supplies auth.uid(); no caller-controlled user or role argument
-- exists. Expired and revoked assignments return no row.
create function public.academy_admin_authorization_v2()
returns table (role text)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select assignment.role
  from public.academy_admin_role_assignments as assignment
  where auth.uid() is not null
    and assignment.user_id = auth.uid()
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id
  limit 2;
$$;

alter function public.academy_admin_authorization_v2() owner to postgres;

-- No application role can read or mutate the table directly. Authenticated
-- callers receive EXECUTE only on the current-role projection.
revoke all on table public.academy_admin_role_assignments
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_authorization_v2()
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_authorization_v2()
  to authenticated;

comment on table public.academy_admin_role_assignments is
  'Server-controlled Academy Admin role history backed by Supabase Auth; no direct application-role access.';
comment on column public.academy_admin_role_assignments.role is
  'Fixed Admin Console vocabulary: owner, admin, viewer.';
comment on column public.academy_admin_role_assignments.assignment_correlation_id is
  'Future admin_role.assign audit correlation reference; the assignment id is the canonical resource ref.';
comment on column public.academy_admin_role_assignments.revocation_correlation_id is
  'Future admin_role.revoke audit correlation reference; required on the one-way revoke transition.';

commit;
