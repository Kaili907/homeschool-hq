-- Academy Phase-0 identity/RLS verification probes.
--
-- LOCAL/EPHEMERAL SUPABASE ONLY. Never run against production.
--
-- Required sequence:
--   1. Create the standard Supabase roles/auth schema in an isolated database.
--   2. Apply supabase/schema.sql.
--   3. Apply the Phase-0 migration (migration run 1).
--   4. Run this file (probe run 1).
--   5. Apply the Phase-0 migration again (migration run 2).
--   6. Run this file again (probe run 2).
--
-- The unrelated private sentinel is intentionally created outside the rolled
-- back fixture transaction. Probe 32 becomes meaningful on the second run: a
-- schema-wide GRANT would add service_role privileges and fail that probe.

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
  if to_regclass('academy_private.academy_probe_unrelated_grant_sentinel') is null then
    create table academy_private.academy_probe_unrelated_grant_sentinel (
      id integer primary key
    );
    grant usage on schema academy_private to academy_probe_unrelated;
    grant select
      on table academy_private.academy_probe_unrelated_grant_sentinel
      to academy_probe_unrelated;
  end if;
end;
$$;

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

-- Valid credential fixtures use synthetic but structurally valid encodings.
insert into academy_private.student_access_credentials (
  id,
  household_id,
  student_id,
  credential_kind,
  credential_version,
  verifier_scheme,
  verifier_digest,
  verifier_parameters,
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
    '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljLXNhbHQxMjM0NTY$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ',
    '{"memory_kib":65536,"iterations":3,"parallelism":1}'::jsonb,
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
    '$scrypt$v=1$ln=15,r=8,p=1$c3ludGhldGljLXNhbHQ$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
    '{"ln":15,"r":8,"p":1}'::jsonb,
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
    '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljLXNhbHRCMjM0NTY$Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2M',
    '{"memory_kib":65536,"iterations":3,"parallelism":1}'::jsonb,
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
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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
    verifier_parameters,
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
    '$argon2id$v=19$m=65536,t=3,p=1$bmV3LXN5bnRoZXRpYy1zYWx0$ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQ',
    '{"memory_kib":65536,"iterations":3,"parallelism":1}'::jsonb,
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
  'All eight Phase-0 tables exist after migration application',
  (
    select count(*) = 8
    from information_schema.tables
    where (table_schema, table_name) in (
      ('public', 'academy_households'),
      ('public', 'academy_household_memberships'),
      ('public', 'academy_students'),
      ('public', 'academy_guardian_student_access'),
      ('public', 'academy_subject_enrollments'),
      ('public', 'academy_audit_events'),
      ('academy_private', 'student_access_credentials'),
      ('academy_private', 'student_session_grants')
    )
  ),
  null
);

select pg_temp.academy_record(
  320,
  '32',
  'Migration preserves an unrelated private object and its grants',
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
