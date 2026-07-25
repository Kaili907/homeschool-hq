-- Academy student identity foundation (Phase 0).
--
-- Additive only:
--   * leaves public.profiles and the current local-profile sync path unchanged;
--   * grants authenticated guardians read-only access through explicit relationships;
--   * reserves all identity, relationship, credential, and session writes for a
--     trusted server/service-role path;
--   * exposes no credential verifier or student-session token through public tables.
--
-- This migration is intentionally not applied by the application.

begin;

create schema if not exists academy_private;

create table if not exists public.academy_households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  member_role text not null default 'guardian'
    check (member_role = 'guardian'),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_household_memberships_status_dates_check check (
    (status = 'active' and activated_at is not null and revoked_at is null)
    or (status = 'invited' and activated_at is null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  constraint academy_household_memberships_id_household_key
    unique (id, household_id),
  constraint academy_household_memberships_household_user_key
    unique (household_id, user_id)
);

create table if not exists public.academy_students (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  -- Nullable until a reviewed local-profile import explicitly establishes it.
  legacy_profile_id text,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  current_grade_level text,
  lifecycle_status text not null default 'invited'
    check (
      lifecycle_status in (
        'invited',
        'active',
        'paused',
        'transferred',
        'graduated',
        'archived',
        'deactivated'
      )
    ),
  lifecycle_changed_at timestamptz not null default now(),
  lifecycle_reason text,
  -- A trusted issuer includes this version in future student sessions. Incrementing
  -- it revokes every older session without deleting the student or academic history.
  session_version bigint not null default 1 check (session_version > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_students_id_household_key unique (id, household_id),
  constraint academy_students_household_legacy_profile_key
    unique (household_id, legacy_profile_id)
);

create table if not exists public.academy_guardian_student_access (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  membership_id uuid not null,
  permission_level text not null default 'viewer'
    check (permission_level in ('viewer', 'learning_manager', 'identity_manager')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_guardian_student_access_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_guardian_student_access_membership_household_fk
    foreign key (membership_id, household_id)
    references public.academy_household_memberships (id, household_id)
    on delete restrict,
  constraint academy_guardian_student_access_student_membership_key
    unique (student_id, membership_id),
  constraint academy_guardian_student_access_status_dates_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table if not exists public.academy_subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  school_year_key text not null
    check (length(btrim(school_year_key)) between 1 and 40),
  subject_key text not null
    check (length(btrim(subject_key)) between 1 and 80),
  instructional_level text not null
    check (length(btrim(instructional_level)) between 1 and 80),
  -- Reusable curriculum references. They are identifiers, not copied content.
  course_id text,
  curriculum_version text,
  enrollment_status text not null default 'planned'
    check (
      enrollment_status in (
        'planned',
        'active',
        'paused',
        'completed',
        'withdrawn',
        'archived'
      )
    ),
  starts_on date,
  ends_on date,
  placement_source text not null default 'parent'
    check (placement_source in ('placement', 'parent', 'staff', 'import')),
  override_by uuid references auth.users (id) on delete set null,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_subject_enrollments_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_subject_enrollments_date_order_check
    check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint academy_subject_enrollments_override_check
    check (
      (override_by is null and override_reason is null)
      or (override_by is not null and length(btrim(override_reason)) > 0)
    )
);

create table if not exists public.academy_audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  student_id uuid,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_kind text not null
    check (actor_kind in ('guardian', 'trusted_server', 'system')),
  event_type text not null
    check (length(btrim(event_type)) between 1 and 120),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  constraint academy_audit_events_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict
);

-- Credential verifiers and future session grants live outside the public API
-- schema. Only encoded password verifiers/token digests are accepted here.
create table if not exists academy_private.student_access_credentials (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  credential_kind text not null default 'pin'
    check (credential_kind = 'pin'),
  verifier_scheme text not null
    check (verifier_scheme in ('argon2id', 'scrypt')),
  verifier_digest text not null check (length(verifier_digest) >= 32),
  verifier_parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(verifier_parameters) = 'object'),
  status text not null default 'active'
    check (status in ('active', 'locked', 'revoked')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint academy_student_credentials_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_student_credentials_encoded_verifier_check check (
    (verifier_scheme = 'argon2id' and verifier_digest like '$argon2id$%')
    or (verifier_scheme = 'scrypt' and verifier_digest like '$scrypt$%')
  ),
  constraint academy_student_credentials_status_dates_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create table if not exists academy_private.student_session_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  -- Digest of a high-entropy opaque token; never the bearer token itself.
  token_digest text not null unique check (length(token_digest) >= 43),
  capabilities text[] not null
    check (cardinality(capabilities) between 1 and 32),
  session_version bigint not null check (session_version > 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint academy_student_session_grants_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_student_session_grants_expiry_check
    check (expires_at > issued_at)
);

create unique index if not exists academy_student_credentials_one_active_kind_idx
  on academy_private.student_access_credentials (student_id, credential_kind)
  where status in ('active', 'locked');

create index if not exists academy_household_memberships_user_idx
  on public.academy_household_memberships (user_id, household_id)
  where status = 'active';

create index if not exists academy_guardian_student_access_membership_idx
  on public.academy_guardian_student_access (membership_id, student_id)
  where status = 'active';

create index if not exists academy_subject_enrollments_student_idx
  on public.academy_subject_enrollments
  (student_id, school_year_key, subject_key, enrollment_status);

create index if not exists academy_subject_enrollments_course_idx
  on public.academy_subject_enrollments (course_id, curriculum_version)
  where course_id is not null;

create index if not exists academy_audit_events_student_time_idx
  on public.academy_audit_events (student_id, occurred_at desc);

create index if not exists academy_student_session_grants_student_idx
  on academy_private.student_session_grants (student_id, expires_at)
  where revoked_at is null;

-- Security-definer helpers avoid recursive RLS lookups. They expose only a
-- boolean about the current caller and use fully qualified object names.
create or replace function public.academy_is_active_household_guardian(
  target_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.academy_household_memberships as membership
      where membership.household_id = target_household_id
        and membership.user_id = auth.uid()
        and membership.member_role = 'guardian'
        and membership.status = 'active'
        and membership.revoked_at is null
    );
$$;

create or replace function public.academy_is_current_guardian_membership(
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.academy_household_memberships as membership
      where membership.id = target_membership_id
        and membership.user_id = auth.uid()
        and membership.member_role = 'guardian'
        and membership.status = 'active'
        and membership.revoked_at is null
    );
$$;

create or replace function public.academy_has_student_permission(
  target_student_id uuid,
  required_permission text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and required_permission in ('viewer', 'learning_manager', 'identity_manager')
    and exists (
      select 1
      from public.academy_guardian_student_access as access
      join public.academy_household_memberships as membership
        on membership.id = access.membership_id
       and membership.household_id = access.household_id
      join public.academy_students as student
        on student.id = access.student_id
       and student.household_id = access.household_id
      where access.student_id = target_student_id
        and membership.user_id = auth.uid()
        and membership.member_role = 'guardian'
        and membership.status = 'active'
        and membership.revoked_at is null
        and access.status = 'active'
        and access.revoked_at is null
        and case access.permission_level
          when 'viewer' then 1
          when 'learning_manager' then 2
          when 'identity_manager' then 3
          else 0
        end >= case required_permission
          when 'viewer' then 1
          when 'learning_manager' then 2
          when 'identity_manager' then 3
          else 99
        end
    );
$$;

revoke all on function public.academy_is_active_household_guardian(uuid) from public;
revoke all on function public.academy_is_current_guardian_membership(uuid) from public;
revoke all on function public.academy_has_student_permission(uuid, text) from public;
grant execute on function public.academy_is_active_household_guardian(uuid) to authenticated;
grant execute on function public.academy_is_current_guardian_membership(uuid) to authenticated;
grant execute on function public.academy_has_student_permission(uuid, text) to authenticated;

alter table public.academy_households enable row level security;
alter table public.academy_household_memberships enable row level security;
alter table public.academy_students enable row level security;
alter table public.academy_guardian_student_access enable row level security;
alter table public.academy_subject_enrollments enable row level security;
alter table public.academy_audit_events enable row level security;
alter table academy_private.student_access_credentials enable row level security;
alter table academy_private.student_access_credentials force row level security;
alter table academy_private.student_session_grants enable row level security;
alter table academy_private.student_session_grants force row level security;

drop policy if exists academy_households_guardian_select
  on public.academy_households;
create policy academy_households_guardian_select
  on public.academy_households
  for select
  to authenticated
  using (public.academy_is_active_household_guardian(id));

drop policy if exists academy_memberships_self_select
  on public.academy_household_memberships;
create policy academy_memberships_self_select
  on public.academy_household_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and member_role = 'guardian'
    and status = 'active'
    and revoked_at is null
  );

drop policy if exists academy_students_guardian_select
  on public.academy_students;
create policy academy_students_guardian_select
  on public.academy_students
  for select
  to authenticated
  using (public.academy_has_student_permission(id, 'viewer'));

drop policy if exists academy_guardian_access_self_select
  on public.academy_guardian_student_access;
create policy academy_guardian_access_self_select
  on public.academy_guardian_student_access
  for select
  to authenticated
  using (
    status = 'active'
    and revoked_at is null
    and public.academy_is_current_guardian_membership(membership_id)
  );

drop policy if exists academy_subject_enrollments_guardian_select
  on public.academy_subject_enrollments;
create policy academy_subject_enrollments_guardian_select
  on public.academy_subject_enrollments
  for select
  to authenticated
  using (public.academy_has_student_permission(student_id, 'viewer'));

drop policy if exists academy_audit_events_guardian_select
  on public.academy_audit_events;
create policy academy_audit_events_guardian_select
  on public.academy_audit_events
  for select
  to authenticated
  using (
    student_id is not null
    and public.academy_has_student_permission(student_id, 'learning_manager')
  );

-- Supabase commonly applies permissive default grants in public. Reset them
-- explicitly: normal clients can only read rows admitted by the policies above.
revoke all on table public.academy_households from anon, authenticated;
revoke all on table public.academy_household_memberships from anon, authenticated;
revoke all on table public.academy_students from anon, authenticated;
revoke all on table public.academy_guardian_student_access from anon, authenticated;
revoke all on table public.academy_subject_enrollments from anon, authenticated;
revoke all on table public.academy_audit_events from anon, authenticated;

grant select on table public.academy_households to authenticated;
grant select on table public.academy_household_memberships to authenticated;
grant select on table public.academy_students to authenticated;
grant select on table public.academy_guardian_student_access to authenticated;
grant select on table public.academy_subject_enrollments to authenticated;
grant select on table public.academy_audit_events to authenticated;

revoke all on schema academy_private from public, anon, authenticated;
revoke all on all tables in schema academy_private from public, anon, authenticated;
revoke all on all sequences in schema academy_private from public, anon, authenticated;

grant usage on schema academy_private to service_role;
grant select, insert, update, delete
  on all tables in schema academy_private to service_role;
grant select, insert, update, delete
  on table
    public.academy_households,
    public.academy_household_memberships,
    public.academy_students,
    public.academy_guardian_student_access,
    public.academy_subject_enrollments
  to service_role;
revoke update, delete, truncate
  on table public.academy_audit_events from service_role;
grant select, insert
  on table public.academy_audit_events to service_role;

-- Consistent timestamps for trusted-server updates.
create or replace function academy_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists academy_households_touch_updated_at
  on public.academy_households;
create trigger academy_households_touch_updated_at
  before update on public.academy_households
  for each row execute function academy_private.touch_updated_at();

drop trigger if exists academy_memberships_touch_updated_at
  on public.academy_household_memberships;
create trigger academy_memberships_touch_updated_at
  before update on public.academy_household_memberships
  for each row execute function academy_private.touch_updated_at();

drop trigger if exists academy_students_touch_updated_at
  on public.academy_students;
create trigger academy_students_touch_updated_at
  before update on public.academy_students
  for each row execute function academy_private.touch_updated_at();

drop trigger if exists academy_guardian_access_touch_updated_at
  on public.academy_guardian_student_access;
create trigger academy_guardian_access_touch_updated_at
  before update on public.academy_guardian_student_access
  for each row execute function academy_private.touch_updated_at();

drop trigger if exists academy_subject_enrollments_touch_updated_at
  on public.academy_subject_enrollments;
create trigger academy_subject_enrollments_touch_updated_at
  before update on public.academy_subject_enrollments
  for each row execute function academy_private.touch_updated_at();

drop trigger if exists academy_student_credentials_touch_updated_at
  on academy_private.student_access_credentials;
create trigger academy_student_credentials_touch_updated_at
  before update on academy_private.student_access_credentials
  for each row execute function academy_private.touch_updated_at();

-- Lifecycle and authorization changes are audited without recording names,
-- verifier digests, tokens, or other secrets.
create or replace function academy_private.audit_student_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  event_name text;
  event_details jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'student.created';
    event_details := jsonb_build_object('status', new.lifecycle_status);
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    event_name := 'student.lifecycle_changed';
    event_details := jsonb_build_object(
      'from', old.lifecycle_status,
      'to', new.lifecycle_status,
      'reason', new.lifecycle_reason
    );
  else
    return new;
  end if;

  insert into public.academy_audit_events (
    household_id,
    student_id,
    actor_user_id,
    actor_kind,
    event_type,
    details
  )
  values (
    new.household_id,
    new.id,
    auth.uid(),
    case when auth.uid() is null then 'trusted_server' else 'guardian' end,
    event_name,
    event_details
  );
  return new;
end;
$$;

drop trigger if exists academy_students_audit_lifecycle
  on public.academy_students;
create trigger academy_students_audit_lifecycle
  after insert or update of lifecycle_status on public.academy_students
  for each row execute function academy_private.audit_student_lifecycle();

create or replace function academy_private.audit_guardian_access()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  event_name text;
  event_details jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'guardian_access.granted';
    event_details := jsonb_build_object(
      'membership_id', new.membership_id,
      'permission_level', new.permission_level
    );
  elsif new.status is distinct from old.status
     or new.permission_level is distinct from old.permission_level then
    event_name := 'guardian_access.changed';
    event_details := jsonb_build_object(
      'membership_id', new.membership_id,
      'status_from', old.status,
      'status_to', new.status,
      'permission_from', old.permission_level,
      'permission_to', new.permission_level
    );
  else
    return new;
  end if;

  insert into public.academy_audit_events (
    household_id,
    student_id,
    actor_user_id,
    actor_kind,
    event_type,
    details
  )
  values (
    new.household_id,
    new.student_id,
    auth.uid(),
    case when auth.uid() is null then 'trusted_server' else 'guardian' end,
    event_name,
    event_details
  );
  return new;
end;
$$;

drop trigger if exists academy_guardian_access_audit
  on public.academy_guardian_student_access;
create trigger academy_guardian_access_audit
  after insert or update of status, permission_level
  on public.academy_guardian_student_access
  for each row execute function academy_private.audit_guardian_access();

create or replace function academy_private.audit_subject_enrollment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  event_name text;
  event_details jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'subject_enrollment.created';
    event_details := jsonb_build_object(
      'subject_key', new.subject_key,
      'school_year_key', new.school_year_key,
      'instructional_level', new.instructional_level,
      'course_id', new.course_id,
      'curriculum_version', new.curriculum_version,
      'status', new.enrollment_status
    );
  elsif new.enrollment_status is distinct from old.enrollment_status
     or new.instructional_level is distinct from old.instructional_level
     or new.course_id is distinct from old.course_id
     or new.curriculum_version is distinct from old.curriculum_version then
    event_name := 'subject_enrollment.changed';
    event_details := jsonb_build_object(
      'subject_key', new.subject_key,
      'status_from', old.enrollment_status,
      'status_to', new.enrollment_status,
      'level_from', old.instructional_level,
      'level_to', new.instructional_level,
      'override_reason', new.override_reason
    );
  else
    return new;
  end if;

  insert into public.academy_audit_events (
    household_id,
    student_id,
    actor_user_id,
    actor_kind,
    event_type,
    details
  )
  values (
    new.household_id,
    new.student_id,
    auth.uid(),
    case when auth.uid() is null then 'trusted_server' else 'guardian' end,
    event_name,
    event_details
  );
  return new;
end;
$$;

drop trigger if exists academy_subject_enrollments_audit
  on public.academy_subject_enrollments;
create trigger academy_subject_enrollments_audit
  after insert or update of
    enrollment_status,
    instructional_level,
    course_id,
    curriculum_version
  on public.academy_subject_enrollments
  for each row execute function academy_private.audit_subject_enrollment();

revoke all on all functions in schema academy_private
  from public, anon, authenticated;
grant execute on all functions in schema academy_private to service_role;

commit;
