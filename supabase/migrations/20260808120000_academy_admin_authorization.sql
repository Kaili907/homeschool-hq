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
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete restrict,
  assignment_reason text not null
    check (
      length(btrim(assignment_reason)) between 1 and 240
      and assignment_reason !~ '[[:cntrl:]]'
    ),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete restrict,
  revocation_reason text,
  constraint academy_admin_role_assignments_lifecycle_check check (
    (
      status = 'active'
      and revoked_at is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_at >= assigned_at
      and revocation_reason is not null
      and length(btrim(revocation_reason)) between 1 and 240
      and revocation_reason !~ '[[:cntrl:]]'
    )
  )
);

alter table public.academy_admin_role_assignments owner to postgres;

create unique index academy_admin_role_assignments_one_active_user_idx
  on public.academy_admin_role_assignments (user_id)
  where status = 'active' and revoked_at is null;

alter table public.academy_admin_role_assignments enable row level security;
alter table public.academy_admin_role_assignments force row level security;

-- There is intentionally no client policy. Even an accidental future SELECT
-- grant to a browser role still returns no rows through RLS. The trusted
-- Netlify authorization boundary receives only SELECT; role management remains
-- a future owner-authorized workflow rather than a service-key side effect.
revoke all on table public.academy_admin_role_assignments
  from public, anon, authenticated, service_role;
grant select on table public.academy_admin_role_assignments to service_role;

comment on table public.academy_admin_role_assignments is
  'Server-read Academy Admin Console role assignments backed by Supabase Auth; no browser access.';
comment on column public.academy_admin_role_assignments.role is
  'Fixed Admin Console vocabulary: owner, admin, viewer.';

commit;
