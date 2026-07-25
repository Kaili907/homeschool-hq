-- Academy student identity foundation (Phase 0).
--
-- Additive and unused:
--   * leaves public.profiles and the current local-profile sync path unchanged;
--   * grants authenticated guardians read-only access through active households
--     and explicit active student relationships;
--   * reserves provisioning and mutation for a trusted service role;
--   * never exposes credential verifiers or student-session token digests.
--
-- This migration is intentionally not applied by the application.

begin;

create schema if not exists academy_private;

-- Do not silently remove API-schema access that might belong to an unrelated
-- pre-existing object. A conflicting exposed schema is an explicit deployment
-- error that an operator must resolve before applying this migration.
do $$
begin
  if has_schema_privilege('anon', 'academy_private', 'usage')
     or has_schema_privilege('authenticated', 'academy_private', 'usage') then
    raise exception
      'academy_private must not grant USAGE to anon/authenticated or be exposed by the Data API';
  end if;
end;
$$;

create or replace function academy_private.is_valid_student_verifier(
  verifier_scheme text,
  verifier_digest text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select verifier_digest is not null
    and length(verifier_digest) between 50 and 512
    and verifier_digest !~ '[[:space:]]'
    and (
      (
        verifier_scheme = 'argon2id'
        and verifier_digest ~
          '^\$argon2id\$v=19\$m=[1-9][0-9]{3,8},t=[1-9][0-9]{0,2},p=[1-9][0-9]{0,2}\$[A-Za-z0-9+/]{8,128}={0,2}\$[A-Za-z0-9+/]{16,255}={0,2}$'
      )
      or (
        verifier_scheme = 'scrypt'
        and verifier_digest ~
          '^\$scrypt\$v=1\$ln=(1[4-9]|2[0-2]),r=[1-9][0-9]{0,3},p=[1-9][0-9]{0,2}\$[A-Za-z0-9+/]{8,128}={0,2}\$[A-Za-z0-9+/]{16,255}={0,2}$'
      )
    );
$$;

create or replace function academy_private.student_capabilities_are_valid(
  capability_values text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select capability_values is not null
    and cardinality(capability_values) between 1 and 4
    and array_position(capability_values, null) is null
    and capability_values <@ array[
      'student:profile:read',
      'student:assignments:read',
      'student:attempts:create',
      'student:progress:read'
    ]::text[]
    and cardinality(capability_values) = (
      select count(distinct capability)
      from unnest(capability_values) as capability
    );
$$;

create or replace function academy_private.audit_details_are_safe(
  detail_values jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select detail_values is not null
    and jsonb_typeof(detail_values) = 'object'
    and octet_length(detail_values::text) <= 4096
    and detail_values::text !~*
      '"(credential|credential_verifier|verifier|verifier_digest|raw_pin|pin|reset_token|bearer|bearer_token|token|token_digest|device_digest|jarvis|jarvis_transcript|transcript|student_content)"[[:space:]]*:'
    and not exists (
      select 1
      from jsonb_each(detail_values) as item(detail_key, detail_value)
      where item.detail_key not in (
        'from',
        'to',
        'status',
        'status_from',
        'status_to',
        'permission_level',
        'permission_from',
        'permission_to',
        'membership_id',
        'subject_key',
        'school_year_key',
        'instructional_level',
        'course_id',
        'curriculum_version',
        'level_from',
        'level_to',
        'placement_source',
        'override_reason',
        'failed_attempts',
        'version',
        'version_from',
        'version_to',
        'issuance_flow',
        'expires_at',
        'capability_schema_version'
      )
      or jsonb_typeof(item.detail_value) not in (
        'string',
        'number',
        'boolean',
        'null'
      )
    );
$$;

create table if not exists public.academy_households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  status_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_households_status_reason_check check (
    status = 'active'
    or (
      status_reason is not null
      and length(btrim(status_reason)) between 1 and 1000
    )
  )
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
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_household_memberships_status_dates_check check (
    (
      status = 'active'
      and user_id is not null
      and activated_at is not null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'invited'
      and activated_at is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_at >= invited_at
      and revocation_reason is not null
      and length(btrim(revocation_reason)) between 1 and 1000
    )
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
  session_version bigint not null default 1 check (session_version > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_students_id_household_key unique (id, household_id),
  constraint academy_students_household_legacy_profile_key
    unique (household_id, legacy_profile_id),
  constraint academy_students_lifecycle_reason_check check (
    lifecycle_status not in ('transferred', 'archived', 'deactivated')
    or (
      lifecycle_reason is not null
      and length(btrim(lifecycle_reason)) between 1 and 1000
    )
  )
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
  revocation_reason text,
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
  constraint academy_guardian_student_access_identity_key
    unique (id, household_id, student_id, membership_id),
  constraint academy_guardian_student_access_status_dates_check check (
    (
      status = 'active'
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_at >= granted_at
      and revocation_reason is not null
      and length(btrim(revocation_reason)) between 1 and 1000
    )
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
  course_id text
    check (course_id is null or length(btrim(course_id)) between 1 and 120),
  curriculum_version text
    check (
      curriculum_version is null
      or length(btrim(curriculum_version)) between 1 and 120
    ),
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
  constraint academy_subject_enrollments_override_check check (
    (override_by is null and override_reason is null)
    or (
      override_by is not null
      and override_reason is not null
      and length(btrim(override_reason)) between 1 and 1000
    )
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
  target_kind text not null
    check (
      target_kind in (
        'household',
        'membership',
        'student',
        'guardian_access',
        'subject_enrollment',
        'credential',
        'student_session'
      )
    ),
  target_id uuid not null,
  event_type text not null
    check (
      event_type in (
        'household.created',
        'household.status_changed',
        'membership.invited',
        'membership.activated',
        'membership.revoked',
        'student.created',
        'student.lifecycle_changed',
        'student.external_exit',
        'student.session_version_changed',
        'student.session_version_reset',
        'guardian_access.granted',
        'guardian_access.changed',
        'subject_enrollment.created',
        'subject_enrollment.changed',
        'credential.created',
        'credential.failed_attempt',
        'credential.locked',
        'credential.unlocked',
        'credential.reset_required',
        'credential.replaced',
        'credential.revoked',
        'student_session.issued',
        'student_session.revoked',
        'student_session.expired'
      )
    ),
  reason text check (reason is null or length(btrim(reason)) between 1 and 1000),
  correlation_id uuid,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
    check (academy_private.audit_details_are_safe(details)),
  constraint academy_audit_events_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_audit_events_guardian_actor_check check (
    actor_kind <> 'guardian' or actor_user_id is not null
  )
);

create table if not exists academy_private.student_access_credentials (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  credential_kind text not null default 'pin'
    check (credential_kind = 'pin'),
  credential_version integer not null check (credential_version > 0),
  verifier_scheme text not null
    check (verifier_scheme in ('argon2id', 'scrypt')),
  verifier_format_version smallint not null default 1
    check (verifier_format_version = 1),
  verifier_digest text not null,
  verifier_parameters jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(verifier_parameters) = 'object'
      and octet_length(verifier_parameters::text) <= 2048
    ),
  status text not null default 'active'
    check (status in ('active', 'locked', 'reset_required', 'revoked', 'replaced')),
  replaces_credential_id uuid,
  created_actor_kind text not null
    check (created_actor_kind in ('guardian', 'trusted_server', 'system')),
  created_by uuid references auth.users (id) on delete set null,
  creation_reason text not null
    check (length(btrim(creation_reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  activated_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  last_failed_at timestamptz,
  lock_started_at timestamptz,
  locked_until timestamptz,
  reset_required_at timestamptz,
  reset_reason text,
  replaced_at timestamptz,
  replaced_actor_kind text
    check (
      replaced_actor_kind is null
      or replaced_actor_kind in ('guardian', 'trusted_server', 'system')
    ),
  replaced_by uuid references auth.users (id) on delete set null,
  replacement_reason text,
  revoked_at timestamptz,
  revoked_actor_kind text
    check (
      revoked_actor_kind is null
      or revoked_actor_kind in ('guardian', 'trusted_server', 'system')
    ),
  revoked_by uuid references auth.users (id) on delete set null,
  revocation_reason text,
  correlation_id uuid,
  updated_at timestamptz not null default now(),
  constraint academy_student_credentials_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_student_credentials_identity_key
    unique (id, student_id, credential_kind),
  constraint academy_student_credentials_session_key
    unique (id, student_id, credential_version),
  constraint academy_student_credentials_student_version_key
    unique (student_id, credential_kind, credential_version),
  constraint academy_student_credentials_replaces_fk
    foreign key (replaces_credential_id, student_id, credential_kind)
    references academy_private.student_access_credentials
      (id, student_id, credential_kind)
    on delete restrict,
  constraint academy_student_credentials_not_self_replacement_check
    check (replaces_credential_id is null or replaces_credential_id <> id),
  constraint academy_student_credentials_actor_check check (
    created_actor_kind <> 'guardian' or created_by is not null
  ),
  constraint academy_student_credentials_encoded_verifier_check
    check (
      academy_private.is_valid_student_verifier(
        verifier_scheme,
        verifier_digest
      )
    ),
  constraint academy_student_credentials_status_dates_check check (
    (
      status = 'active'
      and revoked_at is null
      and replaced_at is null
      and lock_started_at is null
      and locked_until is null
      and reset_required_at is null
      and reset_reason is null
      and replaced_actor_kind is null
      and replaced_by is null
      and replacement_reason is null
      and revoked_actor_kind is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      status = 'locked'
      and revoked_at is null
      and replaced_at is null
      and reset_required_at is null
      and reset_reason is null
      and lock_started_at is not null
      and locked_until is not null
      and locked_until > lock_started_at
      and replaced_actor_kind is null
      and replaced_by is null
      and replacement_reason is null
      and revoked_actor_kind is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      status = 'reset_required'
      and revoked_at is null
      and replaced_at is null
      and lock_started_at is null
      and locked_until is null
      and reset_required_at is not null
      and reset_reason is not null
      and length(btrim(reset_reason)) between 1 and 1000
      and replaced_actor_kind is null
      and replaced_by is null
      and replacement_reason is null
      and revoked_actor_kind is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_at >= activated_at
      and revoked_actor_kind is not null
      and revocation_reason is not null
      and length(btrim(revocation_reason)) between 1 and 1000
      and replaced_at is null
      and replaced_actor_kind is null
      and replaced_by is null
      and replacement_reason is null
      and lock_started_at is null
      and locked_until is null
      and reset_required_at is null
      and reset_reason is null
    )
    or (
      status = 'replaced'
      and replaced_at is not null
      and replaced_at >= activated_at
      and replaced_actor_kind is not null
      and replacement_reason is not null
      and length(btrim(replacement_reason)) between 1 and 1000
      and revoked_at is null
      and revoked_actor_kind is null
      and revoked_by is null
      and revocation_reason is null
      and lock_started_at is null
      and locked_until is null
      and reset_required_at is null
      and reset_reason is null
    )
  ),
  constraint academy_student_credentials_revocation_actor_check check (
    revoked_actor_kind <> 'guardian' or revoked_by is not null
  ),
  constraint academy_student_credentials_replacement_actor_check check (
    replaced_actor_kind <> 'guardian' or replaced_by is not null
  ),
  constraint academy_student_credentials_failed_attempt_time_check check (
    (failed_attempts = 0 and last_failed_at is null)
    or (failed_attempts > 0 and last_failed_at is not null)
  )
);

create table if not exists academy_private.student_session_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  token_digest_algorithm text not null default 'sha256'
    check (token_digest_algorithm = 'sha256'),
  token_digest text not null unique
    check (token_digest ~ '^[0-9a-f]{64}$'),
  capability_schema_version smallint not null default 1
    check (capability_schema_version = 1),
  capabilities text[] not null
    check (academy_private.student_capabilities_are_valid(capabilities)),
  credential_id uuid not null,
  credential_version integer not null check (credential_version > 0),
  session_version bigint not null check (session_version > 0),
  issuance_flow text not null
    check (
      issuance_flow in (
        'student_credential',
        'guardian_activation',
        'trusted_recovery'
      )
    ),
  issued_actor_kind text not null
    check (issued_actor_kind in ('guardian', 'trusted_server', 'system')),
  issued_by uuid references auth.users (id) on delete set null,
  issuing_membership_id uuid,
  issuing_access_id uuid,
  issuance_reason text not null
    check (length(btrim(issuance_reason)) between 1 and 1000),
  correlation_id uuid not null,
  device_digest text
    check (device_digest is null or device_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_actor_kind text
    check (
      revoked_actor_kind is null
      or revoked_actor_kind in ('guardian', 'trusted_server', 'system')
    ),
  revoked_by uuid references auth.users (id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint academy_student_session_grants_student_household_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on delete restrict,
  constraint academy_student_session_grants_credential_fk
    foreign key (credential_id, student_id, credential_version)
    references academy_private.student_access_credentials
      (id, student_id, credential_version)
    on delete restrict,
  constraint academy_student_session_grants_membership_fk
    foreign key (issuing_membership_id, household_id)
    references public.academy_household_memberships (id, household_id)
    on delete restrict,
  constraint academy_student_session_grants_access_fk
    foreign key (
      issuing_access_id,
      household_id,
      student_id,
      issuing_membership_id
    )
    references public.academy_guardian_student_access
      (id, household_id, student_id, membership_id)
    on delete restrict,
  constraint academy_student_session_grants_issuance_actor_check check (
    (issued_actor_kind = 'guardian' and issued_by is not null)
    or issued_actor_kind in ('trusted_server', 'system')
  ),
  constraint academy_student_session_grants_flow_check check (
    (
      issuance_flow = 'guardian_activation'
      and issued_actor_kind = 'guardian'
      and issued_by is not null
      and issuing_membership_id is not null
      and issuing_access_id is not null
    )
    or (
      issuance_flow = 'student_credential'
      and issued_actor_kind = 'trusted_server'
      and issued_by is null
      and issuing_membership_id is null
      and issuing_access_id is null
    )
    or (
      issuance_flow = 'trusted_recovery'
      and issued_actor_kind in ('trusted_server', 'system')
      and issuing_membership_id is null
      and issuing_access_id is null
    )
  ),
  constraint academy_student_session_grants_expiry_check
    check (expires_at > issued_at),
  constraint academy_student_session_grants_revocation_check check (
    (
      revoked_at is null
      and revoked_actor_kind is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      revoked_at is not null
      and revoked_at >= issued_at
      and revoked_actor_kind is not null
      and revocation_reason is not null
      and length(btrim(revocation_reason)) between 1 and 1000
      and (revoked_actor_kind <> 'guardian' or revoked_by is not null)
    )
  )
);

-- Fail clearly if an object with one of these names existed with an incompatible
-- essential column type. Extra future additive columns remain valid.
do $$
declare
  expected record;
begin
  for expected in
    select *
    from (
      values
        ('public', 'academy_households', 'id', 'uuid'::regtype),
        ('public', 'academy_households', 'status', 'text'::regtype),
        ('public', 'academy_household_memberships', 'id', 'uuid'::regtype),
        ('public', 'academy_household_memberships', 'household_id', 'uuid'::regtype),
        ('public', 'academy_students', 'id', 'uuid'::regtype),
        ('public', 'academy_students', 'household_id', 'uuid'::regtype),
        ('public', 'academy_students', 'session_version', 'bigint'::regtype),
        ('public', 'academy_guardian_student_access', 'student_id', 'uuid'::regtype),
        ('public', 'academy_subject_enrollments', 'subject_key', 'text'::regtype),
        ('public', 'academy_audit_events', 'event_type', 'text'::regtype),
        ('academy_private', 'student_access_credentials', 'credential_version', 'integer'::regtype),
        ('academy_private', 'student_access_credentials', 'verifier_digest', 'text'::regtype),
        ('academy_private', 'student_session_grants', 'token_digest', 'text'::regtype),
        ('academy_private', 'student_session_grants', 'capabilities', 'text[]'::regtype)
    ) as required(schema_name, table_name, column_name, column_type)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_namespace as namespace
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
      where namespace.nspname = expected.schema_name
        and relation.relname = expected.table_name
        and relation.relkind in ('r', 'p')
        and attribute.attname = expected.column_name
        and attribute.atttypid = expected.column_type
        and attribute.attnum > 0
        and not attribute.attisdropped
    ) then
      raise exception
        'incompatible pre-existing object: %.% requires column % of type %',
        expected.schema_name,
        expected.table_name,
        expected.column_name,
        expected.column_type;
    end if;
  end loop;
end;
$$;

create unique index if not exists academy_student_credentials_one_current_kind_idx
  on academy_private.student_access_credentials (student_id, credential_kind)
  where status in ('active', 'locked', 'reset_required');

create index if not exists academy_household_memberships_user_idx
  on public.academy_household_memberships (user_id, household_id)
  where status = 'active' and revoked_at is null;

create index if not exists academy_guardian_student_access_membership_idx
  on public.academy_guardian_student_access (membership_id, student_id)
  where status = 'active' and revoked_at is null;

create unique index if not exists academy_subject_enrollments_one_current_idx
  on public.academy_subject_enrollments (
    student_id,
    school_year_key,
    subject_key,
    coalesce(course_id, ''),
    coalesce(curriculum_version, '')
  )
  where enrollment_status in ('planned', 'active', 'paused');

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

create index if not exists academy_student_session_grants_credential_idx
  on academy_private.student_session_grants (credential_id, credential_version);

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
      from public.academy_households as household
      join public.academy_household_memberships as membership
        on membership.household_id = household.id
      where household.id = target_household_id
        and household.status = 'active'
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
      join public.academy_households as household
        on household.id = membership.household_id
      where membership.id = target_membership_id
        and household.status = 'active'
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
      join public.academy_households as household
        on household.id = access.household_id
      where access.student_id = target_student_id
        and household.status = 'active'
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
  using (public.academy_is_current_guardian_membership(id));

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

-- Explicit object grants only. No ALL TABLES/FUNCTIONS statements are used.
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

revoke all on table academy_private.student_access_credentials
  from public, anon, authenticated;
revoke all on table academy_private.student_session_grants
  from public, anon, authenticated;

grant usage on schema academy_private to service_role;
grant select, insert, update
  on table
    public.academy_households,
    public.academy_household_memberships,
    public.academy_students,
    public.academy_guardian_student_access,
    public.academy_subject_enrollments,
    academy_private.student_access_credentials,
    academy_private.student_session_grants
  to service_role;
grant select on table public.academy_audit_events to service_role;

revoke delete, truncate
  on table
    public.academy_households,
    public.academy_household_memberships,
    public.academy_students,
    public.academy_guardian_student_access,
    public.academy_subject_enrollments,
    public.academy_audit_events,
    academy_private.student_access_credentials,
    academy_private.student_session_grants
  from service_role;
revoke insert, update
  on table public.academy_audit_events from service_role;

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

create or replace function academy_private.prevent_historical_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'hard deletion is disabled for historical Academy identity records'
    using errcode = '42501';
end;
$$;

create or replace function academy_private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy audit events are append-only' using errcode = '42501';
end;
$$;

create or replace function academy_private.current_correlation_id()
returns uuid
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  configured_value text;
begin
  configured_value := current_setting('academy.correlation_id', true);
  if configured_value is null
     or configured_value !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return configured_value::uuid;
end;
$$;

create or replace function academy_private.append_audit_event(
  target_household_id uuid,
  target_student_id uuid,
  audit_actor_user_id uuid,
  audit_actor_kind text,
  audit_target_kind text,
  audit_target_id uuid,
  audit_event_type text,
  audit_reason text,
  audit_correlation_id uuid,
  audit_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  created_event_id uuid;
begin
  insert into public.academy_audit_events (
    household_id,
    student_id,
    actor_user_id,
    actor_kind,
    target_kind,
    target_id,
    event_type,
    reason,
    correlation_id,
    details
  )
  values (
    target_household_id,
    target_student_id,
    audit_actor_user_id,
    audit_actor_kind,
    audit_target_kind,
    audit_target_id,
    audit_event_type,
    audit_reason,
    audit_correlation_id,
    audit_details
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

create or replace function academy_private.prepare_student_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception
      'academy_students.household_id is immutable; cross-household transfer requires a separately reviewed workflow'
      using errcode = '42501';
  end if;

  if new.session_version < old.session_version then
    raise exception 'student session_version cannot decrease'
      using errcode = '23514';
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    new.lifecycle_changed_at := now();
    if new.lifecycle_status in ('transferred', 'archived', 'deactivated')
       and new.session_version <= old.session_version then
      new.session_version := old.session_version + 1;
    end if;
  end if;

  return new;
end;
$$;

create or replace function academy_private.audit_household()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform academy_private.append_audit_event(
      new.id,
      null,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'household',
      new.id,
      'household.created',
      null,
      academy_private.current_correlation_id(),
      jsonb_build_object('status', new.status)
    );
  elsif new.status is distinct from old.status then
    perform academy_private.append_audit_event(
      new.id,
      null,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'household',
      new.id,
      'household.status_changed',
      new.status_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object('from', old.status, 'to', new.status)
    );

    if new.status = 'archived' then
      update public.academy_students
      set session_version = session_version + 1
      where household_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function academy_private.audit_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := case
      when new.status = 'active' then 'membership.activated'
      else 'membership.invited'
    end;
  elsif new.status is distinct from old.status then
    event_name := case new.status
      when 'active' then 'membership.activated'
      when 'revoked' then 'membership.revoked'
      else 'membership.invited'
    end;
  else
    return new;
  end if;

  perform academy_private.append_audit_event(
    new.household_id,
    null,
    auth.uid(),
    case when auth.uid() is null then 'trusted_server' else 'guardian' end,
    'membership',
    new.id,
    event_name,
    new.revocation_reason,
    academy_private.current_correlation_id(),
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

create or replace function academy_private.audit_student()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform academy_private.append_audit_event(
      new.household_id,
      new.id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'student',
      new.id,
      'student.created',
      null,
      academy_private.current_correlation_id(),
      jsonb_build_object('status', new.lifecycle_status)
    );
    return new;
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    perform academy_private.append_audit_event(
      new.household_id,
      new.id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'student',
      new.id,
      case
        when new.lifecycle_status = 'transferred'
          then 'student.external_exit'
        else 'student.lifecycle_changed'
      end,
      new.lifecycle_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object('from', old.lifecycle_status, 'to', new.lifecycle_status)
    );
  end if;

  if new.session_version is distinct from old.session_version then
    perform academy_private.append_audit_event(
      new.household_id,
      new.id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'student',
      new.id,
      'student.session_version_changed',
      new.lifecycle_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object(
        'version_from', old.session_version,
        'version_to', new.session_version
      )
    );
  end if;

  if new.lifecycle_status = 'transferred'
     and new.lifecycle_status is distinct from old.lifecycle_status then
    update public.academy_guardian_student_access
    set
      status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(
        new.lifecycle_reason,
        'Student exited the Phase-0 household tenant'
      )
    where student_id = new.id
      and status = 'active';
  end if;

  return new;
end;
$$;

create or replace function academy_private.audit_guardian_access()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'guardian_access',
      new.id,
      'guardian_access.granted',
      null,
      academy_private.current_correlation_id(),
      jsonb_build_object(
        'membership_id', new.membership_id,
        'permission_level', new.permission_level
      )
    );
  elsif new.status is distinct from old.status
     or new.permission_level is distinct from old.permission_level then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'guardian_access',
      new.id,
      'guardian_access.changed',
      new.revocation_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object(
        'membership_id', new.membership_id,
        'status_from', old.status,
        'status_to', new.status,
        'permission_from', old.permission_level,
        'permission_to', new.permission_level
      )
    );
  end if;
  return new;
end;
$$;

create or replace function academy_private.audit_subject_enrollment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'subject_enrollment',
      new.id,
      'subject_enrollment.created',
      new.override_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object(
        'subject_key', new.subject_key,
        'school_year_key', new.school_year_key,
        'instructional_level', new.instructional_level,
        'course_id', new.course_id,
        'curriculum_version', new.curriculum_version,
        'status', new.enrollment_status,
        'placement_source', new.placement_source
      )
    );
  elsif row(
      new.enrollment_status,
      new.instructional_level,
      new.course_id,
      new.curriculum_version,
      new.starts_on,
      new.ends_on,
      new.placement_source,
      new.override_by,
      new.override_reason
    ) is distinct from row(
      old.enrollment_status,
      old.instructional_level,
      old.course_id,
      old.curriculum_version,
      old.starts_on,
      old.ends_on,
      old.placement_source,
      old.override_by,
      old.override_reason
    ) then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      auth.uid(),
      case when auth.uid() is null then 'trusted_server' else 'guardian' end,
      'subject_enrollment',
      new.id,
      'subject_enrollment.changed',
      new.override_reason,
      academy_private.current_correlation_id(),
      jsonb_build_object(
        'subject_key', new.subject_key,
        'status_from', old.enrollment_status,
        'status_to', new.enrollment_status,
        'level_from', old.instructional_level,
        'level_to', new.instructional_level,
        'placement_source', new.placement_source,
        'override_reason', new.override_reason
      )
    );
  end if;
  return new;
end;
$$;

create or replace function academy_private.validate_credential_lineage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  prior_status text;
  prior_version integer;
begin
  if new.replaces_credential_id is null then
    return new;
  end if;

  select credential.status, credential.credential_version
  into prior_status, prior_version
  from academy_private.student_access_credentials as credential
  where credential.id = new.replaces_credential_id
    and credential.student_id = new.student_id
    and credential.credential_kind = new.credential_kind;

  if not found
     or prior_status <> 'replaced'
     or prior_version >= new.credential_version then
    raise exception
      'replacement credential must reference an older replaced credential for the same student and kind'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function academy_private.prepare_credential_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.household_id,
    new.student_id,
    new.credential_kind,
    new.credential_version,
    new.verifier_scheme,
    new.verifier_format_version,
    new.verifier_digest,
    new.verifier_parameters,
    new.replaces_credential_id,
    new.created_actor_kind,
    new.created_by,
    new.creation_reason,
    new.created_at,
    new.activated_at,
    new.correlation_id
  ) is distinct from row(
    old.id,
    old.household_id,
    old.student_id,
    old.credential_kind,
    old.credential_version,
    old.verifier_scheme,
    old.verifier_format_version,
    old.verifier_digest,
    old.verifier_parameters,
    old.replaces_credential_id,
    old.created_actor_kind,
    old.created_by,
    old.creation_reason,
    old.created_at,
    old.activated_at,
    old.correlation_id
  ) then
    raise exception 'credential identity, verifier, version, and lineage are immutable'
      using errcode = '42501';
  end if;

  if old.status in ('revoked', 'replaced')
     and new.status is distinct from old.status then
    raise exception 'revoked and replaced credentials are terminal history'
      using errcode = '42501';
  end if;

  if old.status = 'reset_required'
     and new.status not in ('reset_required', 'revoked', 'replaced') then
    raise exception 'reset-required credentials must be replaced or revoked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function academy_private.audit_credential()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  event_name text;
  event_reason text;
begin
  if tg_op = 'INSERT' then
    event_name := 'credential.created';
    event_reason := new.creation_reason;
  elsif new.status is distinct from old.status then
    event_name := case new.status
      when 'active' then 'credential.unlocked'
      when 'locked' then 'credential.locked'
      when 'reset_required' then 'credential.reset_required'
      when 'replaced' then 'credential.replaced'
      when 'revoked' then 'credential.revoked'
    end;
    event_reason := case new.status
      when 'reset_required' then new.reset_reason
      when 'replaced' then new.replacement_reason
      when 'revoked' then new.revocation_reason
      else null
    end;
  elsif new.failed_attempts > old.failed_attempts then
    event_name := 'credential.failed_attempt';
    event_reason := null;
  else
    return new;
  end if;

  perform academy_private.append_audit_event(
    new.household_id,
    new.student_id,
    case
      when tg_op = 'INSERT' then new.created_by
      when new.status = 'replaced' then new.replaced_by
      when new.status = 'revoked' then new.revoked_by
      else auth.uid()
    end,
    case
      when tg_op = 'INSERT' then new.created_actor_kind
      when new.status = 'replaced' then new.replaced_actor_kind
      when new.status = 'revoked' then new.revoked_actor_kind
      when auth.uid() is null then 'trusted_server'
      else 'guardian'
    end,
    'credential',
    new.id,
    event_name,
    event_reason,
    new.correlation_id,
    jsonb_build_object(
      'version', new.credential_version,
      'status', new.status,
      'failed_attempts', new.failed_attempts
    )
  );

  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('locked', 'reset_required', 'replaced', 'revoked') then
    update public.academy_students
    set session_version = session_version + 1
    where id = new.student_id;
  end if;

  return new;
end;
$$;

create or replace function academy_private.prepare_student_session_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.household_id,
    new.student_id,
    new.token_digest_algorithm,
    new.token_digest,
    new.capability_schema_version,
    new.capabilities,
    new.credential_id,
    new.credential_version,
    new.session_version,
    new.issuance_flow,
    new.issued_actor_kind,
    new.issued_by,
    new.issuing_membership_id,
    new.issuing_access_id,
    new.issuance_reason,
    new.correlation_id,
    new.device_digest,
    new.issued_at,
    new.expires_at,
    new.created_at
  ) is distinct from row(
    old.id,
    old.household_id,
    old.student_id,
    old.token_digest_algorithm,
    old.token_digest,
    old.capability_schema_version,
    old.capabilities,
    old.credential_id,
    old.credential_version,
    old.session_version,
    old.issuance_flow,
    old.issued_actor_kind,
    old.issued_by,
    old.issuing_membership_id,
    old.issuing_access_id,
    old.issuance_reason,
    old.correlation_id,
    old.device_digest,
    old.issued_at,
    old.expires_at,
    old.created_at
  ) then
    raise exception 'student session scope and issuance metadata are immutable'
      using errcode = '42501';
  end if;

  if old.revoked_at is not null
     and row(
       new.revoked_at,
       new.revoked_actor_kind,
       new.revoked_by,
       new.revocation_reason
     ) is distinct from row(
       old.revoked_at,
       old.revoked_actor_kind,
       old.revoked_by,
       old.revocation_reason
     ) then
    raise exception 'student session revocation is terminal and immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function academy_private.audit_student_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      new.issued_by,
      new.issued_actor_kind,
      'student_session',
      new.id,
      'student_session.issued',
      new.issuance_reason,
      new.correlation_id,
      jsonb_build_object(
        'issuance_flow', new.issuance_flow,
        'expires_at', new.expires_at,
        'version', new.session_version,
        'capability_schema_version', new.capability_schema_version
      )
    );
  elsif new.revoked_at is distinct from old.revoked_at
     and new.revoked_at is not null then
    perform academy_private.append_audit_event(
      new.household_id,
      new.student_id,
      new.revoked_by,
      new.revoked_actor_kind,
      'student_session',
      new.id,
      'student_session.revoked',
      new.revocation_reason,
      new.correlation_id,
      jsonb_build_object('version', new.session_version)
    );
  end if;
  return new;
end;
$$;

create or replace function academy_private.is_student_session_grant_current(
  target_grant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from academy_private.student_session_grants as grant_row
    join public.academy_students as student
      on student.id = grant_row.student_id
     and student.household_id = grant_row.household_id
    join public.academy_households as household
      on household.id = grant_row.household_id
    join academy_private.student_access_credentials as credential
      on credential.id = grant_row.credential_id
     and credential.student_id = grant_row.student_id
     and credential.credential_version = grant_row.credential_version
    left join public.academy_household_memberships as membership
      on membership.id = grant_row.issuing_membership_id
     and membership.household_id = grant_row.household_id
    left join public.academy_guardian_student_access as access
      on access.id = grant_row.issuing_access_id
     and access.household_id = grant_row.household_id
     and access.student_id = grant_row.student_id
     and access.membership_id = grant_row.issuing_membership_id
    where grant_row.id = target_grant_id
      and household.status = 'active'
      and student.lifecycle_status = 'active'
      and grant_row.revoked_at is null
      and grant_row.expires_at > now()
      and grant_row.session_version = student.session_version
      and credential.status = 'active'
      and (
        grant_row.issuance_flow <> 'guardian_activation'
        or (
          membership.status = 'active'
          and membership.revoked_at is null
          and membership.user_id = grant_row.issued_by
          and access.status = 'active'
          and access.revoked_at is null
          and access.permission_level = 'identity_manager'
        )
      )
  );
$$;

create or replace function academy_private.reset_student_sessions(
  target_student_id uuid,
  reset_reason text,
  reset_correlation_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_student public.academy_students%rowtype;
begin
  if reset_reason is null
     or length(btrim(reset_reason)) not between 1 and 1000 then
    raise exception 'session reset reason is required' using errcode = '23514';
  end if;

  update public.academy_students
  set session_version = session_version + 1
  where id = target_student_id
  returning * into updated_student;

  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  perform academy_private.append_audit_event(
    updated_student.household_id,
    updated_student.id,
    auth.uid(),
    case when auth.uid() is null then 'trusted_server' else 'guardian' end,
    'student',
    updated_student.id,
    'student.session_version_reset',
    reset_reason,
    reset_correlation_id,
    jsonb_build_object('version', updated_student.session_version)
  );

  return updated_student.session_version;
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

drop trigger if exists academy_students_prepare_update
  on public.academy_students;
create trigger academy_students_prepare_update
  before update on public.academy_students
  for each row execute function academy_private.prepare_student_update();

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

drop trigger if exists academy_student_credentials_validate_lineage
  on academy_private.student_access_credentials;
create trigger academy_student_credentials_validate_lineage
  before insert or update of replaces_credential_id, credential_version
  on academy_private.student_access_credentials
  for each row execute function academy_private.validate_credential_lineage();

drop trigger if exists academy_student_credentials_prepare_update
  on academy_private.student_access_credentials;
create trigger academy_student_credentials_prepare_update
  before update on academy_private.student_access_credentials
  for each row execute function academy_private.prepare_credential_update();

drop trigger if exists academy_student_sessions_prepare_update
  on academy_private.student_session_grants;
create trigger academy_student_sessions_prepare_update
  before update on academy_private.student_session_grants
  for each row execute function academy_private.prepare_student_session_update();

drop trigger if exists academy_households_audit
  on public.academy_households;
create trigger academy_households_audit
  after insert or update of status on public.academy_households
  for each row execute function academy_private.audit_household();

drop trigger if exists academy_memberships_audit
  on public.academy_household_memberships;
create trigger academy_memberships_audit
  after insert or update of status on public.academy_household_memberships
  for each row execute function academy_private.audit_membership();

drop trigger if exists academy_students_audit
  on public.academy_students;
create trigger academy_students_audit
  after insert or update of lifecycle_status, session_version
  on public.academy_students
  for each row execute function academy_private.audit_student();

drop trigger if exists academy_guardian_access_audit
  on public.academy_guardian_student_access;
create trigger academy_guardian_access_audit
  after insert or update of status, permission_level
  on public.academy_guardian_student_access
  for each row execute function academy_private.audit_guardian_access();

drop trigger if exists academy_subject_enrollments_audit
  on public.academy_subject_enrollments;
create trigger academy_subject_enrollments_audit
  after insert or update of
    enrollment_status,
    instructional_level,
    course_id,
    curriculum_version,
    starts_on,
    ends_on,
    placement_source,
    override_by,
    override_reason
  on public.academy_subject_enrollments
  for each row execute function academy_private.audit_subject_enrollment();

drop trigger if exists academy_student_credentials_audit
  on academy_private.student_access_credentials;
create trigger academy_student_credentials_audit
  after insert or update of status, failed_attempts
  on academy_private.student_access_credentials
  for each row execute function academy_private.audit_credential();

drop trigger if exists academy_student_sessions_audit
  on academy_private.student_session_grants;
create trigger academy_student_sessions_audit
  after insert or update of revoked_at
  on academy_private.student_session_grants
  for each row execute function academy_private.audit_student_session();

drop trigger if exists academy_households_prevent_delete
  on public.academy_households;
create trigger academy_households_prevent_delete
  before delete on public.academy_households
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_memberships_prevent_delete
  on public.academy_household_memberships;
create trigger academy_memberships_prevent_delete
  before delete on public.academy_household_memberships
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_students_prevent_delete
  on public.academy_students;
create trigger academy_students_prevent_delete
  before delete on public.academy_students
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_guardian_access_prevent_delete
  on public.academy_guardian_student_access;
create trigger academy_guardian_access_prevent_delete
  before delete on public.academy_guardian_student_access
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_subject_enrollments_prevent_delete
  on public.academy_subject_enrollments;
create trigger academy_subject_enrollments_prevent_delete
  before delete on public.academy_subject_enrollments
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_student_credentials_prevent_delete
  on academy_private.student_access_credentials;
create trigger academy_student_credentials_prevent_delete
  before delete on academy_private.student_access_credentials
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_student_sessions_prevent_delete
  on academy_private.student_session_grants;
create trigger academy_student_sessions_prevent_delete
  before delete on academy_private.student_session_grants
  for each row execute function academy_private.prevent_historical_delete();

drop trigger if exists academy_audit_events_prevent_mutation
  on public.academy_audit_events;
create trigger academy_audit_events_prevent_mutation
  before update or delete on public.academy_audit_events
  for each row execute function academy_private.prevent_audit_mutation();

-- Remove default PUBLIC execute and grant only the exact callable surface.
revoke all on function public.academy_is_active_household_guardian(uuid)
  from public, anon, authenticated;
revoke all on function public.academy_is_current_guardian_membership(uuid)
  from public, anon, authenticated;
revoke all on function public.academy_has_student_permission(uuid, text)
  from public, anon, authenticated;
grant execute on function public.academy_is_active_household_guardian(uuid)
  to authenticated;
grant execute on function public.academy_is_current_guardian_membership(uuid)
  to authenticated;
grant execute on function public.academy_has_student_permission(uuid, text)
  to authenticated;

revoke all on function academy_private.is_valid_student_verifier(text, text)
  from public, anon, authenticated;
revoke all on function academy_private.student_capabilities_are_valid(text[])
  from public, anon, authenticated;
revoke all on function academy_private.audit_details_are_safe(jsonb)
  from public, anon, authenticated;
revoke all on function academy_private.touch_updated_at()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.prevent_historical_delete()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.prevent_audit_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.current_correlation_id()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.append_audit_event(
  uuid, uuid, uuid, text, text, uuid, text, text, uuid, jsonb
) from public, anon, authenticated;
revoke all on function academy_private.prepare_student_update()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_household()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_membership()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_student()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_guardian_access()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_subject_enrollment()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.validate_credential_lineage()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.prepare_credential_update()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_credential()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.prepare_student_session_update()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.audit_student_session()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.is_student_session_grant_current(uuid)
  from public, anon, authenticated;
revoke all on function academy_private.reset_student_sessions(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function academy_private.is_valid_student_verifier(text, text)
  to service_role;
grant execute on function academy_private.student_capabilities_are_valid(text[])
  to service_role;
grant execute on function academy_private.is_student_session_grant_current(uuid)
  to service_role;
grant execute on function academy_private.reset_student_sessions(uuid, text, uuid)
  to service_role;

commit;
