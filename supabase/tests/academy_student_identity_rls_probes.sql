-- Academy Phase-0 identity/RLS verification probes.
--
-- LOCAL/EPHEMERAL SUPABASE ONLY. Never run against production.
--
-- Required sequence:
--   1. Create the standard Supabase roles/auth schema in an isolated database.
--   2. Apply supabase/schema.sql.
--   3. Run only the committed sentinel-preflight section below.
--   4. Apply the Phase-0 migration (migration run 1).
--   5. Run the role-probe section below (probe run 1).
--   6. Apply the Phase-0 migration again (migration run 2).
--   7. Run the role-probe section again (probe run 2).
--
-- Running this entire file as one batch is also transactionally safe: the
-- sentinel is committed before the rollback-only synthetic fixture starts.

-- ACADEMY SENTINEL PREFLIGHT BEGIN
begin;
create schema if not exists academy_private;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'academy_probe_unrelated'
  ) then
    create role academy_probe_unrelated nologin;
  end if;
end;
$$;

do $$
begin
  -- Phase 0 intentionally needs service_role schema USAGE. Establish that
  -- expected schema privilege before recording the unrelated-object baseline.
  grant usage on schema academy_private to service_role;

  if to_regclass('academy_private.academy_probe_unrelated_grant_sentinel') is null then
    create table academy_private.academy_probe_unrelated_grant_sentinel (
      id integer primary key
    );
    grant usage on schema academy_private to academy_probe_unrelated;
    grant select
      on table academy_private.academy_probe_unrelated_grant_sentinel
      to academy_probe_unrelated;
  end if;

  if to_regprocedure(
    'academy_private.academy_probe_unrelated_acl_function()'
  ) is null then
    execute $function$
      create function academy_private.academy_probe_unrelated_acl_function()
      returns integer
      language sql
      immutable
      set search_path = pg_catalog
      as 'select 1'
    $function$;
    revoke all
      on function academy_private.academy_probe_unrelated_acl_function()
      from public, anon, authenticated, service_role;
    grant execute
      on function academy_private.academy_probe_unrelated_acl_function()
      to academy_probe_unrelated;
  end if;

  if to_regclass('academy_private.academy_probe_acl_baseline') is null then
    create table academy_private.academy_probe_acl_baseline (
      singleton boolean primary key default true check (singleton),
      created_at timestamptz not null default clock_timestamp(),
      sentinel_owner name not null,
      function_owner name not null,
      schema_acl text not null,
      table_acl text not null,
      function_acl text not null
    );
    revoke all
      on table academy_private.academy_probe_acl_baseline
      from public, anon, authenticated, service_role, academy_probe_unrelated;
  end if;
end;
$$;

insert into academy_private.academy_probe_acl_baseline (
  singleton,
  sentinel_owner,
  function_owner,
  schema_acl,
  table_acl,
  function_acl
)
select
  true,
  pg_catalog.pg_get_userbyid(sentinel.relowner),
  pg_catalog.pg_get_userbyid(function_row.proowner),
  coalesce(namespace.nspacl::text, ''),
  coalesce(sentinel.relacl::text, ''),
  coalesce(function_row.proacl::text, '')
from pg_catalog.pg_namespace as namespace
join pg_catalog.pg_class as sentinel
  on sentinel.relnamespace = namespace.oid
join pg_catalog.pg_proc as function_row
  on function_row.pronamespace = namespace.oid
 and function_row.proname = 'academy_probe_unrelated_acl_function'
where namespace.nspname = 'academy_private'
  and sentinel.relname = 'academy_probe_unrelated_grant_sentinel'
on conflict (singleton) do nothing;
commit;
-- ACADEMY SENTINEL PREFLIGHT END

-- ACADEMY ROLE PROBES BEGIN
begin;

create temporary table academy_probe_results (
  probe_order integer primary key,
  probe_id text not null,
  probe text not null,
  result text not null check (result in ('PASS', 'FAIL')),
  detail text
) on commit drop;

create or replace function pg_temp.academy_record(
  result_order integer,
  result_id text,
  result_label text,
  result_passed boolean,
  result_detail text default null
)
returns void
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into pg_temp.academy_probe_results (
    probe_order,
    probe_id,
    probe,
    result,
    detail
  )
  values (
    result_order,
    result_id,
    result_label,
    case when result_passed then 'PASS' else 'FAIL' end,
    result_detail
  );
end;
$$;

create or replace function pg_temp.academy_expect_denied(
  result_order integer,
  result_id text,
  result_label text,
  test_role name,
  statement_sql text,
  expected_states text[] default array['42501']::text[]
)
returns void
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  failure_state text;
  failure_message text;
begin
  execute format('set local role %I', test_role);
  begin
    execute statement_sql;
    raise exception 'operation unexpectedly succeeded' using errcode = 'ZX001';
  exception when others then
    get stacked diagnostics
      failure_state = returned_sqlstate,
      failure_message = message_text;
    execute 'reset role';
    perform pg_temp.academy_record(
      result_order,
      result_id,
      result_label,
      failure_state = any(expected_states),
      format('[%s] %s', failure_state, failure_message)
    );
  end;
end;
$$;

create or replace function pg_temp.academy_expect_allowed(
  result_order integer,
  result_id text,
  result_label text,
  test_role name,
  statement_sql text
)
returns void
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  completion_state text;
  completion_message text;
begin
  execute format('set local role %I', test_role);
  begin
    execute statement_sql;
    raise exception 'operation completed and was rolled back by the probe'
      using errcode = 'ZX002';
  exception when others then
    get stacked diagnostics
      completion_state = returned_sqlstate,
      completion_message = message_text;
    execute 'reset role';
    perform pg_temp.academy_record(
      result_order,
      result_id,
      result_label,
      completion_state = 'ZX002',
      format('[%s] %s', completion_state, completion_message)
    );
  end;
end;
$$;

create or replace function pg_temp.academy_expect_count(
  result_order integer,
  result_id text,
  result_label text,
  test_role name,
  statement_sql text,
  expected_count bigint
)
returns void
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  actual_count bigint;
  failure_state text;
  failure_message text;
begin
  execute format('set local role %I', test_role);
  begin
    execute format('select count(*) from (%s) as academy_counted', statement_sql)
      into actual_count;
    execute 'reset role';
    perform pg_temp.academy_record(
      result_order,
      result_id,
      result_label,
      actual_count = expected_count,
      format('expected=%s actual=%s', expected_count, actual_count)
    );
  exception when others then
    get stacked diagnostics
      failure_state = returned_sqlstate,
      failure_message = message_text;
    execute 'reset role';
    perform pg_temp.academy_record(
      result_order,
      result_id,
      result_label,
      false,
      format('[%s] %s', failure_state, failure_message)
    );
  end;
end;
$$;

-- Stable test users. Setup is performed only by the migration owner.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'academy-guardian-a@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'academy-guardian-b@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.academy_households (id, name, created_by)
values
  (
    '00000000-0000-0000-0000-000000000011',
    'Academy Test Household A',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    'Academy Test Household B',
    '00000000-0000-0000-0000-0000000000b1'
  );

insert into public.academy_household_memberships (
  id,
  household_id,
  user_id,
  member_role,
  status,
  activated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-0000000000a1',
    'guardian',
    'active',
    now()
  ),
  (
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-0000000000b1',
    'guardian',
    'active',
    now()
  );

insert into public.academy_students (
  id,
  household_id,
  legacy_profile_id,
  display_name,
  current_grade_level,
  lifecycle_status,
  created_by
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'p1',
    'Student A',
    '4',
    'active',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000011',
    'p2',
    'Student A2',
    '4',
    'active',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000022',
    'p1',
    'Student B',
    '4',
    'active',
    '00000000-0000-0000-0000-0000000000b1'
  );

insert into public.academy_guardian_student_access (
  id,
  household_id,
  student_id,
  membership_id,
  permission_level,
  status,
  granted_by
)
values
  (
    '00000000-0000-0000-0000-0000000001a1',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-0000000000a2',
    'viewer',
    'active',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-0000000001a2',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-0000000000a2',
    'identity_manager',
    'active',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-0000000002b1',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-0000000000b2',
    'identity_manager',
    'active',
    '00000000-0000-0000-0000-0000000000b1'
  );

insert into public.academy_subject_enrollments (
  id,
  household_id,
  student_id,
  school_year_key,
  subject_key,
  instructional_level,
  course_id,
  curriculum_version,
  enrollment_status,
  starts_on,
  placement_source
)
values
  (
    '00000000-0000-0000-0000-000000001101',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    '2026-2027',
    'math',
    'grade-4',
    'math-grade-4',
    '2026.1',
    'active',
    date '2026-08-01',
    'parent'
  ),
  (
    '00000000-0000-0000-0000-000000001102',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    '2026-2027',
    'reading',
    'grade-6',
    'reading-fluency',
    '2026.1',
    'active',
    date '2026-08-01',
    'placement'
  ),
  (
    '00000000-0000-0000-0000-000000001201',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000102',
    '2026-2027',
    'math',
    'grade-4',
    'math-grade-4',
    '2026.1',
    'active',
    date '2026-08-01',
    'parent'
  );

-- 1-3: real anonymous operations.
select pg_temp.academy_expect_denied(
  10,
  '1',
  'Anonymous cannot read households',
  'anon',
  'select * from public.academy_households'
);
select pg_temp.academy_expect_denied(
  20,
  '2',
  'Anonymous cannot read students',
  'anon',
  'select * from public.academy_students'
);
select pg_temp.academy_expect_denied(
  30,
  '3',
  'Anonymous cannot access academy_private',
  'anon',
  'select * from academy_private.student_access_credentials'
);

-- Guardian A claims and active-household authorization.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000000a1',
  true
);

select pg_temp.academy_expect_count(
  40,
  '4',
  'Guardian A can read an authorized active student',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  1
);
select pg_temp.academy_expect_count(
  50,
  '5',
  'Guardian A cannot read an unrelated student',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000201'
  $sql$,
  0
);

-- Guardian B cannot cross the household boundary.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000000b1',
  true
);
select pg_temp.academy_expect_count(
  60,
  '6',
  'Guardian B cannot read Household A',
  'authenticated',
  $sql$
    select id from public.academy_households
    where id = '00000000-0000-0000-0000-000000000011'
  $sql$,
  0
);

-- Archive Household A as the trusted owner, then test as Guardian A.
update public.academy_households
set status = 'archived', status_reason = 'Phase-0 archive authorization probe'
where id = '00000000-0000-0000-0000-000000000011';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000000a1',
  true
);
select pg_temp.academy_expect_count(
  70,
  '7',
  'Archived household denies otherwise-valid guardian access',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  0
);

update public.academy_households
set status = 'active', status_reason = null
where id = '00000000-0000-0000-0000-000000000011';

select pg_temp.academy_expect_count(
  71,
  '7a',
  'Restoring a household restores otherwise-valid access',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  1
);

-- Membership revocation removes all student access for that guardian.
update public.academy_household_memberships
set
  status = 'revoked',
  revoked_at = now(),
  revoked_by = '00000000-0000-0000-0000-0000000000a1',
  revocation_reason = 'Phase-0 membership revocation probe'
where id = '00000000-0000-0000-0000-0000000000a2';

select pg_temp.academy_expect_count(
  80,
  '8',
  'Revoked household membership denies student access',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  0
);

update public.academy_household_memberships
set
  status = 'active',
  activated_at = now(),
  revoked_at = null,
  revoked_by = null,
  revocation_reason = null
where id = '00000000-0000-0000-0000-0000000000a2';

-- Student-specific access revocation is independent of membership.
update public.academy_guardian_student_access
set
  status = 'revoked',
  revoked_at = now(),
  revoked_by = '00000000-0000-0000-0000-0000000000a1',
  revocation_reason = 'Phase-0 student-access revocation probe'
where id = '00000000-0000-0000-0000-0000000001a1';

select pg_temp.academy_expect_count(
  90,
  '9',
  'Revoked student-specific access denies student access',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  0
);

update public.academy_guardian_student_access
set
  status = 'active',
  revoked_at = null,
  revoked_by = null,
  revocation_reason = null
where id = '00000000-0000-0000-0000-0000000001a1';

-- Student A access is viewer-only, so audit rows are filtered by RLS.
select pg_temp.academy_expect_count(
  100,
  '10',
  'Viewer cannot read learning-manager-only audit events',
  'authenticated',
  $sql$
    select id from public.academy_audit_events
    where student_id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  0
);

-- 11-15: execute actual forbidden client writes.
select pg_temp.academy_expect_denied(
  110,
  '11',
  'Authenticated client cannot insert a household',
  'authenticated',
  $sql$
    insert into public.academy_households (name)
    values ('Unauthorized Household')
  $sql$
);
select pg_temp.academy_expect_denied(
  120,
  '12',
  'Authenticated client cannot self-create membership',
  'authenticated',
  $sql$
    insert into public.academy_household_memberships (
      household_id, user_id, status, activated_at
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-0000000000a1',
      'active',
      now()
    )
  $sql$
);
select pg_temp.academy_expect_denied(
  130,
  '13',
  'Authenticated client cannot self-assign student access',
  'authenticated',
  $sql$
    insert into public.academy_guardian_student_access (
      household_id, student_id, membership_id, permission_level
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-0000000000a2',
      'identity_manager'
    )
  $sql$
);
select pg_temp.academy_expect_denied(
  140,
  '14',
  'Authenticated client cannot update student identity fields',
  'authenticated',
  $sql$
    update public.academy_students
    set display_name = 'Unauthorized Rename'
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$
);
select pg_temp.academy_expect_denied(
  150,
  '15',
  'Authenticated client cannot delete historical identity rows',
  'authenticated',
  $sql$
    delete from public.academy_subject_enrollments
    where id = '00000000-0000-0000-0000-000000001101'
  $sql$
);
select pg_temp.academy_expect_denied(
  151,
  '15a',
  'Trusted service cannot directly delete a student',
  'service_role',
  $sql$
    delete from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$
);
select pg_temp.academy_expect_denied(
  152,
  '15b',
  'Migration owner delete is blocked by historical trigger',
  current_user,
  $sql$
    delete from public.academy_subject_enrollments
    where id = '00000000-0000-0000-0000-000000001101'
  $sql$
);

-- 16-17: direct private-table reads, not privilege metadata checks.
select pg_temp.academy_expect_denied(
  160,
  '16',
  'Authenticated client cannot read credentials',
  'authenticated',
  'select * from academy_private.student_access_credentials'
);
select pg_temp.academy_expect_denied(
  170,
  '17',
  'Authenticated client cannot read session grants',
  'authenticated',
  'select * from academy_private.student_session_grants'
);

-- 18-19: append-only audit enforcement through real operations.
select pg_temp.academy_expect_denied(
  180,
  '18a',
  'Authenticated client cannot insert audit events',
  'authenticated',
  $sql$
    insert into public.academy_audit_events (
      household_id, actor_kind, target_kind, target_id, event_type
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      'guardian',
      'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created'
    )
  $sql$
);
select pg_temp.academy_expect_denied(
  181,
  '18b',
  'Authenticated client cannot update audit events',
  'authenticated',
  'update public.academy_audit_events set reason = ''tampered'''
);
select pg_temp.academy_expect_denied(
  182,
  '18c',
  'Authenticated client cannot delete audit events',
  'authenticated',
  'delete from public.academy_audit_events'
);
select pg_temp.academy_expect_denied(
  190,
  '19a',
  'Trusted service cannot update append-only audit events',
  'service_role',
  'update public.academy_audit_events set reason = ''tampered'''
);
select pg_temp.academy_expect_denied(
  191,
  '19b',
  'Trusted service cannot delete append-only audit events',
  'service_role',
  'delete from public.academy_audit_events'
);
set local role service_role;
insert into public.academy_households (
  id,
  name,
  status,
  status_reason
)
values (
  '00000000-0000-0000-0000-000000000033',
  'Trusted Service Audit Probe Household',
  'active',
  null
);
reset role;

select pg_temp.academy_record(
  192,
  '19c',
  'Trusted service provisioning emits an allowlisted audit event through triggers',
  (
    select count(*) = 1
    from public.academy_audit_events
    where household_id = '00000000-0000-0000-0000-000000000033'
      and target_kind = 'household'
      and event_type = 'household.created'
  ),
  null
);
select pg_temp.academy_expect_denied(
  193,
  '19d',
  'Trusted service cannot call the internal generic audit appender',
  'service_role',
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011',
      null,
      null,
      'trusted_server',
      'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created',
      'Synthetic unsafe audit probe',
      '00000000-0000-0000-0000-00000000c002',
      '{"token_digest":"should-never-be-audited"}'::jsonb
    )
  $sql$,
  array['42501']
);
select pg_temp.academy_expect_denied(
  194,
  '19e',
  'Sensitive audit detail keys are rejected by the database',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011',
      null,
      null,
      'trusted_server',
      'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created',
      'Synthetic unsafe audit probe',
      '00000000-0000-0000-0000-00000000c003',
      '{"token_digest":"should-never-be-audited"}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  195,
  '19f',
  'Oversized audit details are rejected',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011',
      null,
      null,
      'trusted_server',
      'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created',
      'Synthetic oversized audit probe',
      '00000000-0000-0000-0000-00000000c004',
      jsonb_build_object('status', repeat('x', 5000))
    )
  $sql$,
  array['23514']
);

select pg_temp.academy_expect_denied(
  1961,
  '19g',
  'Raw PIN values are rejected under an otherwise allowed audit key',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c005',
      '{"status":"1234"}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1962,
  '19h',
  'Argon2id verifier values are rejected under an allowed audit key',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c006',
      '{"status":"$argon2id$v=19$m=65536,t=3,p=1$salt$hash"}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1963,
  '19i',
  'Scrypt verifier values are rejected under an allowed audit key',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c007',
      '{"status":" $ScRyPt$ v=1 secret "}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1964,
  '19j',
  'Raw bearer-token values are rejected under an allowed audit key',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c008',
      '{"status":"aca_stu_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1965,
  '19k',
  'SHA-256 token-digest values are rejected under an allowed audit key',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c009',
      jsonb_build_object('status', repeat('a', 64))
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1966,
  '19l',
  'Transcript-like or student-content audit values are rejected',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c010',
      jsonb_build_object('status', repeat('student answer ', 40))
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1967,
  '19m',
  'Credential, token, and verifier patterns are rejected in audit reasons',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', '  ToKeN : aca_stu_v1_secretvalue  ',
      '00000000-0000-0000-0000-00000000c011',
      '{"status":"active"}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1968,
  '19n',
  'Nested caller-provided audit values are rejected',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'household',
      '00000000-0000-0000-0000-000000000011',
      'household.created', 'Synthetic nested audit probe',
      '00000000-0000-0000-0000-00000000c012',
      '{"status":{"value":"active","pin":"1234"}}'::jsonb
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  1969,
  '19o',
  'Case-varied SHA-256-looking values are rejected in audit metadata',
  current_user,
  $sql$
    select academy_private.append_audit_event(
      '00000000-0000-0000-0000-000000000011', null, null,
      'trusted_server', 'subject_enrollment',
      '00000000-0000-0000-0000-000000001101',
      'subject_enrollment.created', 'Synthetic audit-value probe',
      '00000000-0000-0000-0000-00000000c013',
      jsonb_build_object(
        'subject_key', 'math',
        'school_year_key', '2026-2027',
        'instructional_level', 'grade-4',
        'course_id', repeat('A', 64),
        'curriculum_version', null,
        'status', 'active',
        'placement_source', 'parent'
      )
    )
  $sql$,
  array['23514']
);

create temporary table academy_audit_pin_baseline as
select
  (select count(*) from public.academy_subject_enrollments) as enrollment_count,
  (select count(*) from public.academy_audit_events) as audit_count,
  (select count(*) from academy_private.student_access_credentials) as credential_count,
  (select count(*) from academy_private.student_session_grants) as session_count,
  (
    select lifecycle_status
    from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  ) as student_status,
  (
    select session_version
    from public.academy_students
    where id = '00000000-0000-0000-0000-000000000101'
  ) as student_session_version,
  (
    select status
    from public.academy_households
    where id = '00000000-0000-0000-0000-000000000033'
  ) as household_status;

select pg_temp.academy_expect_denied(
  19701,
  'audit-pin-subject-plain',
  'Enrollment audit rejects a raw four-digit PIN in subject_key',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019101',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', '1234', 'grade-4', 'pin-audit-plain', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19702,
  'audit-pin-subject-spaced',
  'Enrollment audit rejects a space-separated PIN in subject_key',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019102',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', '1 2 3 4', 'grade-4', 'pin-audit-spaced', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19703,
  'audit-pin-subject-trimmed',
  'Enrollment audit rejects a PIN with leading and trailing spaces',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019103',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', '  1234  ', 'grade-4', 'pin-audit-trimmed', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19704,
  'audit-pin-subject-tabs',
  'Enrollment audit rejects a tab-separated PIN in subject_key',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019104',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', E'1\t2\t3\t4', 'grade-4', 'pin-audit-tabs', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19705,
  'audit-pin-subject-newlines',
  'Enrollment audit rejects a newline-separated PIN in subject_key',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019105',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', E'1\n2\n3\n4', 'grade-4', 'pin-audit-newlines', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19706,
  'audit-pin-level',
  'Enrollment audit rejects a raw PIN in instructional_level',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019106',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', 'science', '1234', 'pin-audit-level', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19707,
  'audit-pin-course',
  'Enrollment audit rejects a mixed-whitespace PIN in course_id',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019107',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', 'history', 'grade-4', E'1 \t2 3\t4', 'v1',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19708,
  'audit-pin-curriculum',
  'Enrollment audit rejects a raw PIN in curriculum_version',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019108',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', 'geography', 'grade-4', 'geo-grade-4', '1234',
      'active', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19709,
  'audit-pin-status',
  'Enrollment operation rejects PIN material in a status field',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, placement_source
    ) values (
      '00000000-0000-0000-0000-000000019109',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', 'civics', 'grade-4', 'civics-grade-4', 'v1',
      '1234', 'parent'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19710,
  'audit-pin-reason-plain',
  'Household status audit rejects a raw PIN reason',
  'service_role',
  $sql$
    update public.academy_households
    set status = 'archived', status_reason = '1234'
    where id = '00000000-0000-0000-0000-000000000033'
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19711,
  'audit-pin-reason-spaced',
  'Household status audit rejects a space-separated PIN reason',
  'service_role',
  $sql$
    update public.academy_households
    set status = 'archived', status_reason = '1 2 3 4'
    where id = '00000000-0000-0000-0000-000000000033'
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19712,
  'audit-pin-reason-tabs',
  'Household status audit rejects a tab-separated PIN reason',
  'service_role',
  $sql$
    update public.academy_households
    set status = 'archived', status_reason = E'1\t2\t3\t4'
    where id = '00000000-0000-0000-0000-000000000033'
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19713,
  'audit-pin-reason-newlines',
  'Household status audit rejects a newline-separated PIN reason',
  'service_role',
  $sql$
    update public.academy_households
    set status = 'archived', status_reason = E'1\n2\n3\n4'
    where id = '00000000-0000-0000-0000-000000000033'
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  19714,
  'audit-pin-reason-embedded',
  'Household status audit rejects an embedded four-digit PIN reason',
  'service_role',
  $sql$
    update public.academy_households
    set status = 'archived', status_reason = 'Credential reset for 1234'
    where id = '00000000-0000-0000-0000-000000000033'
  $sql$,
  array['23514']
);

select pg_temp.academy_record(
  19715,
  'audit-pin-positive',
  'Approved identifiers, reason text, status, and nonsecret audit values remain valid',
  academy_private.security_text_is_safe('mathematics', 240)
    and academy_private.audit_reason_is_safe(
      'Reviewed placement correction',
      240
    )
    and academy_private.audit_details_are_safe(
      'subject_enrollment.created',
      jsonb_build_object(
        'subject_key', 'mathematics',
        'school_year_key', '2026-2027',
        'instructional_level', 'grade-4',
        'course_id', 'math-grade-4',
        'curriculum_version', '2026.1',
        'status', 'active',
        'placement_source', 'parent'
      )
    ),
  null
);
select pg_temp.academy_record(
  19716,
  'audit-pin-atomicity',
  'Rejected PIN-bearing audit operations leave identity and security state unchanged',
  (
    select
      baseline.enrollment_count =
        (select count(*) from public.academy_subject_enrollments)
      and baseline.audit_count =
        (select count(*) from public.academy_audit_events)
      and baseline.credential_count =
        (select count(*) from academy_private.student_access_credentials)
      and baseline.session_count =
        (select count(*) from academy_private.student_session_grants)
      and baseline.student_status = (
        select lifecycle_status
        from public.academy_students
        where id = '00000000-0000-0000-0000-000000000101'
      )
      and baseline.student_session_version = (
        select session_version
        from public.academy_students
        where id = '00000000-0000-0000-0000-000000000101'
      )
      and baseline.household_status = (
        select status
        from public.academy_households
        where id = '00000000-0000-0000-0000-000000000033'
      )
      and not exists (
        select 1
        from public.academy_subject_enrollments
        where id between
          '00000000-0000-0000-0000-000000019101'::uuid
          and '00000000-0000-0000-0000-000000019109'::uuid
      )
    from pg_temp.academy_audit_pin_baseline as baseline
  ),
  null
);

create temporary table academy_audit_event_contract (
  contract_order integer primary key,
  event_type text not null,
  target_kind text not null,
  details jsonb not null
) on commit drop;

insert into pg_temp.academy_audit_event_contract (
  contract_order,
  event_type,
  target_kind,
  details
)
values
  (1, 'household.created', 'household', '{"status":"active"}'),
  (
    2,
    'household.status_changed',
    'household',
    '{"from":"active","to":"archived"}'
  ),
  (3, 'membership.invited', 'membership', '{"status":"invited"}'),
  (4, 'membership.activated', 'membership', '{"status":"active"}'),
  (5, 'membership.revoked', 'membership', '{"status":"revoked"}'),
  (6, 'student.created', 'student', '{"status":"active"}'),
  (
    7,
    'student.lifecycle_changed',
    'student',
    '{"from":"active","to":"paused"}'
  ),
  (
    8,
    'student.external_exit',
    'student',
    '{"from":"active","to":"transferred"}'
  ),
  (
    9,
    'student.session_version_changed',
    'student',
    '{"version_from":1,"version_to":2}'
  ),
  (
    10,
    'student.session_version_reset',
    'student',
    '{"version":2}'
  ),
  (
    11,
    'guardian_access.granted',
    'guardian_access',
    '{
      "membership_id":"00000000-0000-0000-0000-0000000000a2",
      "permission_level":"viewer"
    }'
  ),
  (
    12,
    'guardian_access.changed',
    'guardian_access',
    '{
      "membership_id":"00000000-0000-0000-0000-0000000000a2",
      "status_from":"active",
      "status_to":"revoked",
      "permission_from":"viewer",
      "permission_to":"learning_manager"
    }'
  ),
  (
    13,
    'subject_enrollment.created',
    'subject_enrollment',
    '{
      "subject_key":"mathematics",
      "school_year_key":"2026-2027",
      "instructional_level":"grade-4",
      "course_id":"math-grade-4",
      "curriculum_version":"2026.1",
      "status":"active",
      "placement_source":"parent"
    }'
  ),
  (
    14,
    'subject_enrollment.changed',
    'subject_enrollment',
    '{
      "subject_key":"mathematics",
      "status_from":"active",
      "status_to":"paused",
      "level_from":"grade-4",
      "level_to":"grade-5",
      "placement_source":"parent"
    }'
  ),
  (
    15,
    'credential.created',
    'credential',
    '{"version":1,"status":"active","failed_attempts":0}'
  ),
  (
    16,
    'credential.failed_attempt',
    'credential',
    '{"version":1,"status":"active","failed_attempts":1}'
  ),
  (
    17,
    'credential.locked',
    'credential',
    '{"version":1,"status":"locked","failed_attempts":3}'
  ),
  (
    18,
    'credential.unlocked',
    'credential',
    '{"version":1,"status":"active","failed_attempts":0}'
  ),
  (
    19,
    'credential.reset_required',
    'credential',
    '{"version":1,"status":"reset_required","failed_attempts":3}'
  ),
  (
    20,
    'credential.replaced',
    'credential',
    '{"version":1,"status":"replaced","failed_attempts":0}'
  ),
  (
    21,
    'credential.revoked',
    'credential',
    '{"version":1,"status":"revoked","failed_attempts":0}'
  ),
  (
    22,
    'student_session.issued',
    'student_session',
    '{
      "issuance_flow":"student_credential",
      "expires_at":"2026-08-01T12:00:00+00:00",
      "version":1,
      "capability_schema_version":1
    }'
  ),
  (
    23,
    'student_session.revoked',
    'student_session',
    '{"version":1}'
  ),
  (
    24,
    'student_session.expired',
    'student_session',
    '{"version":1}'
  );

do $academy_audit_event_pin_contract$
declare
  contract record;
  positive_error text;
  negative_state text;
  negative_error text;
begin
  for contract in
    select *
    from pg_temp.academy_audit_event_contract
    order by contract_order
  loop
    positive_error := null;
    begin
      perform academy_private.append_audit_event(
        '00000000-0000-0000-0000-000000000011',
        case
          when contract.target_kind in (
            'student',
            'guardian_access',
            'subject_enrollment',
            'credential',
            'student_session'
          ) then '00000000-0000-0000-0000-000000000101'::uuid
          else null
        end,
        null,
        'trusted_server',
        contract.target_kind,
        '00000000-0000-0000-0000-000000000101',
        contract.event_type,
        'Approved audit contract probe',
        '00000000-0000-0000-0000-00000000a111',
        contract.details
      );
    exception when others then
      get stacked diagnostics positive_error = message_text;
    end;

    perform pg_temp.academy_record(
      19800 + contract.contract_order * 2,
      'audit-event-positive-' || contract.contract_order::text,
      contract.event_type || ' accepts only its approved nonsecret audit shape',
      positive_error is null,
      positive_error
    );

    negative_state := null;
    negative_error := null;
    begin
      perform academy_private.append_audit_event(
        '00000000-0000-0000-0000-000000000011',
        case
          when contract.target_kind in (
            'student',
            'guardian_access',
            'subject_enrollment',
            'credential',
            'student_session'
          ) then '00000000-0000-0000-0000-000000000101'::uuid
          else null
        end,
        null,
        'trusted_server',
        contract.target_kind,
        '00000000-0000-0000-0000-000000000101',
        contract.event_type,
        '1 2 3 4',
        '00000000-0000-0000-0000-00000000a112',
        contract.details
      );
    exception when others then
      get stacked diagnostics
        negative_state = returned_sqlstate,
        negative_error = message_text;
    end;

    perform pg_temp.academy_record(
      19801 + contract.contract_order * 2,
      'audit-event-pin-denied-' || contract.contract_order::text,
      contract.event_type || ' rejects PIN material in its reason',
      positive_error is null and negative_state = '23514',
      format('[%s] %s', negative_state, negative_error)
    );
  end loop;
end;
$academy_audit_event_pin_contract$;

-- Valid credential fixtures use synthetic but structurally valid encodings.
insert into academy_private.student_access_credentials (
  id,
  household_id,
  student_id,
  credential_kind,
  credential_version,
  verifier_scheme,
  verifier_digest,
  status,
  created_actor_kind,
  created_by,
  creation_reason,
  correlation_id
)
values
  (
    '00000000-0000-0000-0000-000000009101',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    'pin',
    1,
    'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
    'active',
    'guardian',
    '00000000-0000-0000-0000-0000000000a1',
    'Synthetic Argon2id credential probe',
    '00000000-0000-0000-0000-00000000d001'
  ),
  (
    '00000000-0000-0000-0000-000000009102',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000102',
    'pin',
    1,
    'scrypt',
    '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
    'active',
    'guardian',
    '00000000-0000-0000-0000-0000000000a1',
    'Synthetic scrypt credential probe',
    '00000000-0000-0000-0000-00000000d002'
  ),
  (
    '00000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000201',
    'pin',
    1,
    'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$dXV1dXV1dXV1dXV1dXV1dQ$Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2M',
    'active',
    'guardian',
    '00000000-0000-0000-0000-0000000000b1',
    'Synthetic cross-household credential probe',
    '00000000-0000-0000-0000-00000000d003'
  );

select pg_temp.academy_record(
  200,
  '20',
  'Structurally valid Argon2id and scrypt fixtures are accepted',
  (
    select count(*) = 2
    from academy_private.student_access_credentials
    where id in (
      '00000000-0000-0000-0000-000000009101',
      '00000000-0000-0000-0000-000000009102'
    )
  ),
  null
);

select pg_temp.academy_record(
  2001,
  '20x',
  'Credential auxiliary JSON is absent from the Phase-0 schema',
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'academy_private'
      and table_name = 'student_access_credentials'
      and column_name = 'verifier_parameters'
  ),
  null
);
select pg_temp.academy_expect_denied(
  2002,
  '20x1',
  'Credential inserts cannot carry raw-PIN auxiliary JSON',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, verifier_parameters, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 20, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      '{"raw_pin":"1234"}'::jsonb, 'trusted_server',
      'Auxiliary column absence probe'
    )
  $sql$,
  array['42703']
);
select pg_temp.academy_expect_denied(
  2003,
  '20x2',
  'Credential inserts cannot carry reset-token or password JSON',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, verifier_parameters, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 20, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      '{"reset_token":"secret","password":"secret"}'::jsonb,
      'trusted_server', 'Auxiliary column absence probe'
    )
  $sql$,
  array['42703']
);
select pg_temp.academy_expect_denied(
  2004,
  '20x3',
  'Credential inserts cannot duplicate verifier, salt, or hash JSON',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, verifier_parameters, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 20, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      '{"verifier":"secret","salt":"secret","hash":"secret"}'::jsonb,
      'trusted_server', 'Auxiliary column absence probe'
    )
  $sql$,
  array['42703']
);
select pg_temp.academy_expect_denied(
  2005,
  '20x4',
  'Credential inserts cannot carry unknown, nested, array, or mismatched parameters',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, verifier_parameters, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 20, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      '{"unknown":{"m":1},"array":[1],"memory_cost":1}'::jsonb,
      'trusted_server', 'Auxiliary column absence probe'
    )
  $sql$,
  array['42703']
);

-- Negative verifier probes execute real service-role inserts. Each insert is
-- rolled back by academy_expect_denied after the constraint error.
select pg_temp.academy_expect_denied(
  201,
  '20a',
  'Verifier rejects arbitrary plaintext with a valid-looking prefix',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009901',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'argon2id',
      '$argon2id$plaintext-plaintext-plaintext-plaintext-plaintext',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  202,
  '20b',
  'Verifier rejects truncated PHC data',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009902',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$short',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  203,
  '20c',
  'Verifier rejects a missing salt',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009903',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$$YWFhYWFhYWFhYWFhYWFhYQ',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  204,
  '20d',
  'Verifier rejects a missing hash',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009904',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'scrypt', '$scrypt$v=1$ln=15,r=8,p=1$c3ludGhldGljLXNhbHQ$',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  205,
  '20e',
  'Verifier rejects malformed cost parameters',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009905',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'argon2id',
      '$argon2id$v=19$m=lots,t=3,p=1$c3ludGhldGljLXNhbHQ$YWFhYWFhYWFhYWFhYWFhYQ',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  206,
  '20f',
  'Verifier rejects unsupported algorithm versions',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009906',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'argon2id',
      '$argon2id$v=16$m=65536,t=3,p=1$c3ludGhldGljLXNhbHQ$YWFhYWFhYWFhYWFhYWFhYQ',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  207,
  '20g',
  'Verifier rejects whitespace or appended text',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009907',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$c3ludGhldGljLXNhbHQ$YmJiYmJiYmJiYmJiYmJiYmJi trailing',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  208,
  '20h',
  'Verifier rejects an unsupported algorithm',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      id, household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, status, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000009908',
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      9, 'bcrypt',
      '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12',
      'active', 'trusted_server', 'Invalid verifier probe'
    )
  $sql$,
  array['23514']
);

select pg_temp.academy_expect_denied(
  2081,
  '20i',
  'Verifier rejects impossible unpadded-Base64 modulo length',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAA$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2082,
  '20j',
  'Verifier rejects internal Base64 padding',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nz=c3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2083,
  '20k',
  'Verifier rejects padded Base64 in the canonical unpadded format',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw==$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2084,
  '20l',
  'Verifier rejects non-Base64 characters',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzc-$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2085,
  '20m',
  'Verifier rejects an excessively short decoded salt',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$YWJjZA$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2086,
  '20n',
  'Verifier rejects an excessively short decoded hash',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYQ',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2087,
  '20o',
  'Verifier rejects an excessively long decoded salt',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$' || repeat('A', 87)
        || '$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  2088,
  '20p',
  'Verifier rejects an excessively long decoded hash',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$'
        || repeat('A', 87),
      'trusted_server', 'Invalid canonical encoding probe'
    )
  $sql$,
  array['23514']
);

select pg_temp.academy_record(
  20881,
  '20p-canonical-salt',
  'Canonical salt passes while a pad-bit mutation decodes identically and fails',
  pg_catalog.decode('dHR0dHR0dHR0dHR0dHR0dA==', 'base64')
    = pg_catalog.decode('dHR0dHR0dHR0dHR0dHR0dB==', 'base64')
    and academy_private.is_canonical_unpadded_base64(
      'dHR0dHR0dHR0dHR0dHR0dA',
      16,
      64
    )
    and not academy_private.is_canonical_unpadded_base64(
      'dHR0dHR0dHR0dHR0dHR0dB',
      16,
      64
    ),
  null
);
select pg_temp.academy_record(
  20882,
  '20p-canonical-hash',
  'Canonical hash passes while a pad-bit mutation decodes identically and fails',
  pg_catalog.decode(
    'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=',
    'base64'
  ) = pg_catalog.decode(
    'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJ=',
    'base64'
  )
    and academy_private.is_canonical_unpadded_base64(
      'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
      32,
      64
    )
    and not academy_private.is_canonical_unpadded_base64(
      'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJ',
      32,
      64
    ),
  null
);
select pg_temp.academy_record(
  20883,
  '20p-argon2id-canonical',
  'Full Argon2id verifier accepts only canonical unpadded components',
  academy_private.is_valid_student_verifier(
    'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
  )
    and not academy_private.is_valid_student_verifier(
      'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$dHR0dHR0dHR0dHR0dHR0dB$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    )
    and not academy_private.is_valid_student_verifier(
      'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJ'
    ),
  null
);
select pg_temp.academy_record(
  20884,
  '20p-scrypt-canonical',
  'Full scrypt verifier accepts only canonical unpadded components',
  academy_private.is_valid_student_verifier(
    'scrypt',
    '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
  )
    and not academy_private.is_valid_student_verifier(
      'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dB$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    )
    and not academy_private.is_valid_student_verifier(
      'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJ'
    ),
  null
);
select pg_temp.academy_record(
  20885,
  '20p-argon2id-invalid-encodings',
  'Argon2id rejects padding, whitespace, invalid alphabet, and wrong lengths',
  not academy_private.is_valid_student_verifier(
    'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$dHR0dHR0dHR0dHR0dHR0dA==$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
  )
    and not academy_private.is_valid_student_verifier(
      'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$dHR0 dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    )
    and not academy_private.is_valid_student_verifier(
      'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$dHR0dHR0dHR0dHR0dHR0d-$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    )
    and not academy_private.is_valid_student_verifier(
      'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$YWJjZA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    ),
  null
);
select pg_temp.academy_record(
  20886,
  '20p-scrypt-invalid-encodings',
  'Scrypt rejects padding, whitespace, invalid alphabet, and wrong lengths',
  not academy_private.is_valid_student_verifier(
    'scrypt',
    '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA==$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
  )
    and not academy_private.is_valid_student_verifier(
      'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJi YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI'
    )
    and not academy_private.is_valid_student_verifier(
      'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYm-'
    )
    and not academy_private.is_valid_student_verifier(
      'scrypt',
      '$scrypt$v=1$ln=15,r=8,p=1$dHR0dHR0dHR0dHR0dHR0dA$YWJjZA'
    ),
  null
);
select pg_temp.academy_expect_denied(
  2089,
  '20q',
  'Credential lifecycle reason columns reject a standalone four-digit PIN',
  'service_role',
  $sql$
    insert into academy_private.student_access_credentials (
      household_id, student_id, credential_version, verifier_scheme,
      verifier_digest, created_actor_kind, creation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201', 21, 'argon2id',
      '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
      'trusted_server', '1234'
    )
  $sql$,
  array['23514']
);

-- Valid current session fixtures use exact lowercase SHA-256 hex digests.
insert into academy_private.student_session_grants (
  id,
  household_id,
  student_id,
  token_digest,
  capabilities,
  credential_id,
  credential_version,
  session_version,
  issuance_flow,
  issued_actor_kind,
  issuance_reason,
  correlation_id,
  device_digest,
  issued_at,
  expires_at
)
select
  '00000000-0000-0000-0000-000000008101',
  student.household_id,
  student.id,
  '7622985c70518971754832bfecbce888cd460c0189152e431e6045957e10fb1c',
  array['student:profile:read', 'student:progress:read'],
  '00000000-0000-0000-0000-000000009101',
  1,
  student.session_version,
  'student_credential',
  'trusted_server',
  'Synthetic current-session probe',
  '00000000-0000-0000-0000-00000000e001',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  now(),
  now() + interval '1 hour'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000101';

insert into academy_private.student_session_grants (
  id,
  household_id,
  student_id,
  token_digest,
  capabilities,
  credential_id,
  credential_version,
  session_version,
  issuance_flow,
  issued_actor_kind,
  issuance_reason,
  correlation_id,
  issued_at,
  expires_at
)
select
  '00000000-0000-0000-0000-000000008102',
  student.household_id,
  student.id,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  array['student:assignments:read', 'student:attempts:create'],
  '00000000-0000-0000-0000-000000009102',
  1,
  student.session_version,
  'student_credential',
  'trusted_server',
  'Synthetic lifecycle-session probe',
  '00000000-0000-0000-0000-00000000e002',
  now(),
  now() + interval '1 hour'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000102';

select pg_temp.academy_record(
  210,
  '21',
  'Valid lowercase SHA-256 digest and constrained capabilities are accepted',
  academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008101'
  ),
  null
);
select pg_temp.academy_record(
  2101,
  '21x',
  'Canonical raw token format is disjoint from the stored digest format',
  academy_private.is_valid_raw_student_session_token(
    'aca_stu_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  )
    and 'aca_stu_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      !~ '^[0-9a-f]{64}$'
    and not academy_private.is_valid_raw_student_session_token(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
    and exists (
      select 1
      from academy_private.student_session_grants
      where id = '00000000-0000-0000-0000-000000008101'
        and token_digest =
          '7622985c70518971754832bfecbce888cd460c0189152e431e6045957e10fb1c'
    ),
  'External runner independently verifies SHA-256(raw token) equals the stored fixture digest'
);
select pg_temp.academy_expect_denied(
  2102,
  '21y',
  'Canonical raw session token cannot be stored as a digest',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'aca_stu_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid raw-token storage probe',
      '00000000-0000-0000-0000-00000000f000', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);

insert into academy_private.student_session_grants (
  id,
  household_id,
  student_id,
  token_digest,
  capabilities,
  credential_id,
  credential_version,
  session_version,
  issuance_flow,
  issued_actor_kind,
  issuance_reason,
  correlation_id,
  issued_at,
  expires_at
)
select
  '00000000-0000-0000-0000-000000008204',
  student.household_id,
  student.id,
  '1111111111111111111111111111111111111111111111111111111111111111',
  array['student:profile:read'],
  '00000000-0000-0000-0000-000000009201',
  1,
  student.session_version,
  'student_credential',
  'trusted_server',
  'Synthetic future-issuance probe',
  '00000000-0000-0000-0000-00000000e204',
  now() + interval '1 hour',
  now() + interval '2 hours'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000201';

select pg_temp.academy_record(
  2103,
  '21z',
  'Future-issued session grant is not current before issuance',
  not academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008204'
  ),
  null
);

-- Token-digest, expiry, and revocation consistency negatives.
select pg_temp.academy_expect_denied(
  211,
  '21a',
  'Session rejects a raw-looking bearer token',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'rawBearerTokenThatIsLongButIsNotASha256Digest1234567890',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid token probe',
      '00000000-0000-0000-0000-00000000f001', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  212,
  '21b',
  'Session rejects a short digest',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'abcd', array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid token probe',
      '00000000-0000-0000-0000-00000000f002', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  213,
  '21c',
  'Session rejects an overlong digest',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid token probe',
      '00000000-0000-0000-0000-00000000f003', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  214,
  '21d',
  'Session rejects non-hex digest characters',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid token probe',
      '00000000-0000-0000-0000-00000000f004', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  215,
  '21e',
  'Session rejects uppercase digest encoding',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid token probe',
      '00000000-0000-0000-0000-00000000f005', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  216,
  '21f',
  'Session rejects expiry at or before issuance',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, issued_at, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid expiry probe',
      '00000000-0000-0000-0000-00000000f006', now(), now()
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  217,
  '21g',
  'Session rejects revocation before issuance',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, issued_at, expires_at, revoked_at,
      revoked_actor_kind, revocation_reason
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid revocation probe',
      '00000000-0000-0000-0000-00000000f007',
      now(), now() + interval '1 hour', now() - interval '1 minute',
      'trusted_server', 'Invalid revocation probe'
    )
  $sql$,
  array['23514']
);

-- Capability vocabulary negatives.
select pg_temp.academy_expect_denied(
  220,
  '22a',
  'Session rejects duplicate capabilities',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['student:profile:read', 'student:profile:read'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid capability probe',
      '00000000-0000-0000-0000-00000000f008', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  221,
  '22b',
  'Session rejects wildcard capabilities',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['student:*'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid capability probe',
      '00000000-0000-0000-0000-00000000f009', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  222,
  '22c',
  'Session rejects guardian capabilities',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['guardian:household:manage'],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid capability probe',
      '00000000-0000-0000-0000-00000000f010', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  223,
  '22d',
  'Session rejects an empty capability set',
  'service_role',
  $sql$
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000201',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array[]::text[],
      '00000000-0000-0000-0000-000000009201', 1, 1,
      'student_credential', 'trusted_server', 'Invalid capability probe',
      '00000000-0000-0000-0000-00000000f011', now() + interval '1 hour'
    )
  $sql$,
  array['23514']
);

select pg_temp.academy_expect_denied(
  230,
  '23',
  'Credential lock-state inconsistency is rejected',
  'service_role',
  $sql$
    update academy_private.student_access_credentials
    set status = 'locked'
    where id = '00000000-0000-0000-0000-000000009201'
  $sql$,
  array['23514']
);
select pg_temp.academy_expect_denied(
  240,
  '24',
  'Session revocation-timestamp inconsistency is rejected',
  'service_role',
  $sql$
    update academy_private.student_session_grants
    set
      revoked_at = issued_at - interval '1 second',
      revoked_actor_kind = 'trusted_server',
      revocation_reason = 'Invalid timestamp probe'
    where id = '00000000-0000-0000-0000-000000008101'
  $sql$,
  array['23514']
);

-- Expired and validly revoked grants are never current.
insert into academy_private.student_session_grants (
  id,
  household_id,
  student_id,
  token_digest,
  capabilities,
  credential_id,
  credential_version,
  session_version,
  issuance_flow,
  issued_actor_kind,
  issuance_reason,
  correlation_id,
  issued_at,
  expires_at
)
values
  (
    '00000000-0000-0000-0000-000000008201',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000201',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    array['student:profile:read'],
    '00000000-0000-0000-0000-000000009201',
    1,
    1,
    'student_credential',
    'trusted_server',
    'Synthetic expired-session probe',
    '00000000-0000-0000-0000-00000000e201',
    now() - interval '2 hours',
    now() - interval '1 hour'
  ),
  (
    '00000000-0000-0000-0000-000000008202',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000201',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    array['student:profile:read'],
    '00000000-0000-0000-0000-000000009201',
    1,
    1,
    'student_credential',
    'trusted_server',
    'Synthetic revocation-session probe',
    '00000000-0000-0000-0000-00000000e202',
    now(),
    now() + interval '1 hour'
  );

update academy_private.student_session_grants
set
  revoked_at = now(),
  revoked_actor_kind = 'trusted_server',
  revocation_reason = 'Phase-0 valid revocation probe'
where id = '00000000-0000-0000-0000-000000008202';

select pg_temp.academy_record(
  241,
  '24a',
  'Expired grants are not current',
  not academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008201'
  ),
  null
);
select pg_temp.academy_record(
  242,
  '24b',
  'Revoked grants are not current',
  not academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008202'
  ),
  null
);
select pg_temp.academy_expect_denied(
  243,
  '24c',
  'Revoked grant cannot be silently unrevoked',
  'service_role',
  $sql$
    update academy_private.student_session_grants
    set
      revoked_at = null,
      revoked_actor_kind = null,
      revocation_reason = null
    where id = '00000000-0000-0000-0000-000000008202'
  $sql$,
  array['42501']
);

-- Lifecycle invalidation preserves history and never revives the old grant.
do $$
declare
  old_version bigint;
  deactivated_version bigint;
begin
  select session_version into old_version
  from public.academy_students
  where id = '00000000-0000-0000-0000-000000000102';

  update public.academy_students
  set
    lifecycle_status = 'deactivated',
    lifecycle_reason = 'Phase-0 lifecycle invalidation probe'
  where id = '00000000-0000-0000-0000-000000000102';

  select session_version into deactivated_version
  from public.academy_students
  where id = '00000000-0000-0000-0000-000000000102';

  perform pg_temp.academy_record(
    250,
    '25',
    'Security-sensitive lifecycle transition increments session version',
    deactivated_version = old_version + 1,
    format('old=%s deactivated=%s', old_version, deactivated_version)
  );

  perform pg_temp.academy_record(
    251,
    '25a',
    'Old grant no longer matches the student session version',
    not academy_private.is_student_session_grant_current(
      '00000000-0000-0000-0000-000000008102'
    ),
    null
  );
end;
$$;

select pg_temp.academy_record(
  290,
  '29',
  'Deactivated student and enrollment history remain preserved',
  (
    select count(*) = 1
    from public.academy_students
    where id = '00000000-0000-0000-0000-000000000102'
      and lifecycle_status = 'deactivated'
  )
  and (
    select count(*) = 1
    from public.academy_subject_enrollments
    where student_id = '00000000-0000-0000-0000-000000000102'
  ),
  null
);

select pg_temp.academy_expect_count(
  291,
  '29a',
  'Authorized guardian can still read deactivated student history',
  'authenticated',
  $sql$
    select id from public.academy_students
    where id = '00000000-0000-0000-0000-000000000102'
      and lifecycle_status = 'deactivated'
  $sql$,
  1
);

update public.academy_students
set
  lifecycle_status = 'active',
  lifecycle_reason = 'Phase-0 lifecycle restoration probe'
where id = '00000000-0000-0000-0000-000000000102';

select pg_temp.academy_record(
  252,
  '25b',
  'Restoring a student does not silently revive an old grant',
  not academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008102'
  ),
  null
);

-- Credential replacement invalidates all prior student session versions.
do $$
declare
  version_before bigint;
  version_after bigint;
begin
  select session_version into version_before
  from public.academy_students
  where id = '00000000-0000-0000-0000-000000000101';

  update academy_private.student_access_credentials
  set
    status = 'replaced',
    replaced_at = now(),
    replaced_actor_kind = 'guardian',
    replaced_by = '00000000-0000-0000-0000-0000000000a1',
    replacement_reason = 'Phase-0 credential replacement probe'
  where id = '00000000-0000-0000-0000-000000009101';

  insert into academy_private.student_access_credentials (
    id,
    household_id,
    student_id,
    credential_kind,
    credential_version,
    verifier_scheme,
    verifier_digest,
    status,
    replaces_credential_id,
    created_actor_kind,
    created_by,
    creation_reason,
    correlation_id
  )
  values (
    '00000000-0000-0000-0000-000000009111',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000101',
    'pin',
    2,
    'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$bm5ubm5ubm5ubm5ubm5ubg$ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQ',
    'active',
    '00000000-0000-0000-0000-000000009101',
    'guardian',
    '00000000-0000-0000-0000-0000000000a1',
    'Phase-0 replacement credential probe',
    '00000000-0000-0000-0000-00000000d011'
  );

  select session_version into version_after
  from public.academy_students
  where id = '00000000-0000-0000-0000-000000000101';

  perform pg_temp.academy_record(
    260,
    '26',
    'Credential replacement increments student session version',
    version_after = version_before + 1,
    format('before=%s after=%s', version_before, version_after)
  );

  perform pg_temp.academy_record(
    261,
    '26a',
    'Credential replacement invalidates grants issued under the old credential',
    not academy_private.is_student_session_grant_current(
      '00000000-0000-0000-0000-000000008101'
    ),
    null
  );
end;
$$;

-- Enrollment sharing, duplicate prevention, and historical reenrollment.
select pg_temp.academy_record(
  270,
  '27',
  'Two students can share one course and curriculum version',
  (
    select count(*) = 2 and count(distinct student_id) = 2
    from public.academy_subject_enrollments
    where course_id = 'math-grade-4'
      and curriculum_version = '2026.1'
  ),
  null
);
select pg_temp.academy_record(
  271,
  '27a',
  'One student can hold different subject enrollments',
  (
    select count(distinct subject_key) = 2
    from public.academy_subject_enrollments
    where student_id = '00000000-0000-0000-0000-000000000101'
  ),
  null
);
select pg_temp.academy_expect_denied(
  280,
  '28',
  'Duplicate current enrollment is rejected',
  'service_role',
  $sql$
    insert into public.academy_subject_enrollments (
      household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, starts_on, placement_source
    ) values (
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000101',
      '2026-2027', 'math', 'grade-4', 'math-grade-4', '2026.1',
      'active', date '2026-09-01', 'parent'
    )
  $sql$,
  array['23505']
);

update public.academy_subject_enrollments
set
  enrollment_status = 'completed',
  ends_on = date '2027-05-31'
where id = '00000000-0000-0000-0000-000000001101';

insert into public.academy_subject_enrollments (
  id,
  household_id,
  student_id,
  school_year_key,
  subject_key,
  instructional_level,
  course_id,
  curriculum_version,
  enrollment_status,
  starts_on,
  placement_source
)
values (
  '00000000-0000-0000-0000-000000001111',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000101',
  '2026-2027',
  'math',
  'grade-4-retake',
  'math-grade-4',
  '2026.1',
  'active',
  date '2027-06-01',
  'parent'
);

select pg_temp.academy_record(
  281,
  '28a',
  'Historical completion permits a legitimate reenrollment',
  (
    select count(*) = 2
      and count(*) filter (where enrollment_status = 'completed') = 1
      and count(*) filter (where enrollment_status = 'active') = 1
    from public.academy_subject_enrollments
    where student_id = '00000000-0000-0000-0000-000000000101'
      and school_year_key = '2026-2027'
      and subject_key = 'math'
      and course_id = 'math-grade-4'
      and curriculum_version = '2026.1'
  ),
  null
);

-- Household ID is immutable even for the trusted service role.
select pg_temp.academy_expect_denied(
  300,
  '30',
  'Direct student household transfer update fails',
  'service_role',
  $sql$
    update public.academy_students
    set household_id = '00000000-0000-0000-0000-000000000022'
    where id = '00000000-0000-0000-0000-000000000101'
  $sql$,
  array['42501']
);

insert into academy_private.student_session_grants (
  id,
  household_id,
  student_id,
  token_digest,
  capabilities,
  credential_id,
  credential_version,
  session_version,
  issuance_flow,
  issued_actor_kind,
  issuance_reason,
  correlation_id,
  issued_at,
  expires_at
)
select
  '00000000-0000-0000-0000-000000008203',
  student.household_id,
  student.id,
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  array['student:profile:read'],
  '00000000-0000-0000-0000-000000009201',
  1,
  student.session_version,
  'student_credential',
  'trusted_server',
  'Synthetic external-exit session probe',
  '00000000-0000-0000-0000-00000000e203',
  now(),
  now() + interval '1 hour'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000201';

update public.academy_students
set
  lifecycle_status = 'transferred',
  lifecycle_reason = 'Responsibility moved outside the Phase-0 tenant'
where id = '00000000-0000-0000-0000-000000000201';

select pg_temp.academy_record(
  301,
  '30a',
  'External exit preserves the original household and student history',
  (
    select count(*) = 1
    from public.academy_students
    where id = '00000000-0000-0000-0000-000000000201'
      and household_id = '00000000-0000-0000-0000-000000000022'
      and lifecycle_status = 'transferred'
  ),
  null
);
select pg_temp.academy_record(
  302,
  '30b',
  'External exit revokes prior guardian access',
  (
    select count(*) = 1
    from public.academy_guardian_student_access
    where id = '00000000-0000-0000-0000-0000000002b1'
      and status = 'revoked'
  ),
  null
);
select pg_temp.academy_record(
  303,
  '30c',
  'External exit invalidates the prior student session',
  not academy_private.is_student_session_grant_current(
    '00000000-0000-0000-0000-000000008203'
  ),
  null
);
select pg_temp.academy_record(
  304,
  '30d',
  'External exit creates a dedicated audit event',
  (
    select count(*) = 1
    from public.academy_audit_events
    where student_id = '00000000-0000-0000-0000-000000000201'
      and event_type = 'student.external_exit'
  ),
  null
);

-- Rerun cardinality checks: exact migration rerun success is reported by the
-- external runner, while these queries ensure policies/triggers are singular.
select pg_temp.academy_record(
  310,
  '31a',
  'All six public RLS policies are singular',
  (
    select count(*) = 6 and count(distinct policyname) = 6
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname in (
        'academy_households_guardian_select',
        'academy_memberships_self_select',
        'academy_students_guardian_select',
        'academy_guardian_access_self_select',
        'academy_subject_enrollments_guardian_select',
        'academy_audit_events_guardian_select'
      )
  ),
  null
);
select pg_temp.academy_record(
  311,
  '31b',
  'All Academy triggers are singular after migration application',
  (
    select count(*) = 25 and count(distinct trigger_row.tgname) = 25
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation
      on relation.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where not trigger_row.tgisinternal
      and namespace.nspname in ('public', 'academy_private')
      and trigger_row.tgname like 'academy_%'
  ),
  null
);
select pg_temp.academy_record(
  312,
  '31c',
  'All nine Phase-0 tables, including the security marker, exist',
  (
    select count(*) = 9
    from information_schema.tables
    where (table_schema, table_name) in (
      ('public', 'academy_households'),
      ('public', 'academy_household_memberships'),
      ('public', 'academy_students'),
      ('public', 'academy_guardian_student_access'),
      ('public', 'academy_subject_enrollments'),
      ('public', 'academy_audit_events'),
      ('academy_private', 'student_access_credentials'),
      ('academy_private', 'student_session_grants'),
      ('academy_private', 'identity_foundation_metadata')
    )
  ),
  null
);

select pg_temp.academy_record(
  320,
  '32',
  'ACL sentinel exists and retains its deliberately assigned privileges',
  to_regclass('academy_private.academy_probe_unrelated_grant_sentinel') is not null
    and has_table_privilege(
      'academy_probe_unrelated',
      'academy_private.academy_probe_unrelated_grant_sentinel',
      'select'
    )
    and not has_table_privilege(
      'service_role',
      'academy_private.academy_probe_unrelated_grant_sentinel',
      'select'
    )
    and not has_table_privilege(
      'service_role',
      'academy_private.academy_probe_unrelated_grant_sentinel',
      'insert'
    )
    and not has_table_privilege(
      'service_role',
      'academy_private.academy_probe_unrelated_grant_sentinel',
      'update'
    )
    and not has_table_privilege(
      'service_role',
      'academy_private.academy_probe_unrelated_grant_sentinel',
      'delete'
    ),
  null
);
select pg_temp.academy_record(
  321,
  '32a',
  'ACL sentinel owner and unrelated function owner are unchanged',
  (
    select baseline.sentinel_owner = pg_catalog.pg_get_userbyid(sentinel.relowner)
      and baseline.function_owner =
        pg_catalog.pg_get_userbyid(function_row.proowner)
    from academy_private.academy_probe_acl_baseline as baseline
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = 'academy_private'
    join pg_catalog.pg_class as sentinel
      on sentinel.relnamespace = namespace.oid
     and sentinel.relname = 'academy_probe_unrelated_grant_sentinel'
    join pg_catalog.pg_proc as function_row
      on function_row.pronamespace = namespace.oid
     and function_row.proname = 'academy_probe_unrelated_acl_function'
    where baseline.singleton
  ),
  null
);
select pg_temp.academy_record(
  322,
  '32b',
  'ACL sentinel schema, table, and function ACLs are byte-for-byte unchanged',
  (
    select baseline.schema_acl = coalesce(namespace.nspacl::text, '')
      and baseline.table_acl = coalesce(sentinel.relacl::text, '')
      and baseline.function_acl = coalesce(function_row.proacl::text, '')
    from academy_private.academy_probe_acl_baseline as baseline
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = 'academy_private'
    join pg_catalog.pg_class as sentinel
      on sentinel.relnamespace = namespace.oid
     and sentinel.relname = 'academy_probe_unrelated_grant_sentinel'
    join pg_catalog.pg_proc as function_row
      on function_row.pronamespace = namespace.oid
     and function_row.proname = 'academy_probe_unrelated_acl_function'
    where baseline.singleton
  ),
  null
);
select pg_temp.academy_record(
  323,
  '32c',
  'ACL sentinel predates Migration Run 2 and was not recreated afterward',
  (
    select marker.verification_count = 1
      or (
        marker.verification_count >= 2
        and baseline.created_at < marker.last_verified_at
      )
    from academy_private.academy_probe_acl_baseline as baseline
    cross join academy_private.identity_foundation_metadata as marker
    where baseline.singleton and marker.singleton
  ),
  null
);
select pg_temp.academy_record(
  324,
  '32d',
  'Migration marker manifest still matches every security-critical object',
  (
    select marker.security_manifest =
      academy_private.identity_foundation_manifest()
    from academy_private.identity_foundation_metadata as marker
    where marker.singleton
  ),
  null
);
select pg_temp.academy_record(
  325,
  '32e',
  'Security-definer functions are owned by postgres with safe search paths',
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner_role
      on owner_role.oid = procedure.proowner
    where namespace.nspname in ('public', 'academy_private')
      and procedure.prosecdef
      and (
        owner_role.rolname <> 'postgres'
        or not (
          coalesce(procedure.proconfig, array[]::text[])
          @> array['search_path=pg_catalog']::text[]
        )
      )
      and (
        procedure.proname like 'academy_%'
        or namespace.nspname = 'academy_private'
      )
  ),
  null
);

-- Guardian removal is revocation, not deletion of an Auth identity that is
-- still needed for historical attribution.
update public.academy_guardian_student_access
set
  status = 'revoked',
  revoked_at = now(),
  revoked_by = '00000000-0000-0000-0000-0000000000a1',
  revocation_reason = 'Supported guardian account-removal revocation probe'
where membership_id = '00000000-0000-0000-0000-0000000000a2'
  and status = 'active';

update public.academy_household_memberships
set
  status = 'revoked',
  revoked_at = now(),
  revoked_by = '00000000-0000-0000-0000-0000000000a1',
  revocation_reason = 'Supported guardian account-removal revocation probe'
where id = '00000000-0000-0000-0000-0000000000a2';

select pg_temp.academy_record(
  326,
  'guardian-delete-1',
  'Supported guardian removal revokes membership and student access',
  (
    select membership.status = 'revoked'
      and not exists (
        select 1
        from public.academy_guardian_student_access as access_row
        where access_row.membership_id = membership.id
          and access_row.status = 'active'
      )
    from public.academy_household_memberships as membership
    where membership.id = '00000000-0000-0000-0000-0000000000a2'
  ),
  null
);
select pg_temp.academy_expect_denied(
  327,
  'guardian-delete-2',
  'Direct Auth-user deletion is rejected while historical attribution exists',
  current_user,
  $sql$
    delete from auth.users
    where id = '00000000-0000-0000-0000-0000000000a1'
  $sql$,
  array['23503', '23514', '42501']
);
select pg_temp.academy_record(
  328,
  'guardian-delete-3',
  'Historical guardian audit attribution remains interpretable after revocation',
  exists (
    select 1
    from public.academy_audit_events
    where actor_user_id = '00000000-0000-0000-0000-0000000000a1'
      and actor_kind = 'guardian'
  )
    and exists (
      select 1
      from auth.users
      where id = '00000000-0000-0000-0000-0000000000a1'
    ),
  null
);

-- Audit coverage and version lineage are checked from owner-only fixtures.
select pg_temp.academy_record(
  330,
  'audit',
  'Identity, credential, session, enrollment, and household events were audited',
  (
    select count(distinct event_type) >= 12
    from public.academy_audit_events
    where event_type in (
      'household.created',
      'household.status_changed',
      'membership.activated',
      'membership.revoked',
      'student.created',
      'student.lifecycle_changed',
      'student.session_version_changed',
      'guardian_access.granted',
      'guardian_access.changed',
      'subject_enrollment.created',
      'subject_enrollment.changed',
      'credential.created',
      'credential.replaced',
      'student_session.issued'
    )
  ),
  null
);

select
  probe_id,
  probe,
  result,
  detail
from pg_temp.academy_probe_results
order by probe_order;

select
  count(*) filter (where result = 'PASS') as pass_count,
  count(*) filter (where result = 'FAIL') as fail_count,
  count(*) as total_count
from pg_temp.academy_probe_results;

rollback;
-- ACADEMY ROLE PROBES END
