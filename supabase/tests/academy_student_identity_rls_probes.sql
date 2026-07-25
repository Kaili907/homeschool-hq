-- Academy Phase-0 identity/RLS verification probes.
--
-- LOCAL/EPHEMERAL SUPABASE ONLY. Never run against production.
-- Apply supabase/schema.sql and the Phase-0 migration first, then run this whole
-- file as a migration-owner role. Everything is wrapped in a transaction and
-- rolled back. Each result row must say PASS.

begin;

-- Stable test users. These inserts match the standard Supabase auth.users shape
-- and are rolled back at the end.
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
    'identity_manager',
    'active',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-0000000001a2',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-0000000000a2',
    'learning_manager',
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

insert into academy_private.student_access_credentials (
  id,
  household_id,
  student_id,
  credential_kind,
  verifier_scheme,
  verifier_digest,
  verifier_parameters
)
values (
  '00000000-0000-0000-0000-000000009101',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000101',
  'pin',
  'argon2id',
  '$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$ZHVtbXktdmVyaWZpZXItZGlnZXN0',
  '{"memory_kib":65536,"iterations":3,"parallelism":1}'::jsonb
);

-- Guardian A.
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
set local role authenticated;

select
  '1. Guardian A can access Student A when authorized' as probe,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result
from public.academy_students
where id = '00000000-0000-0000-0000-000000000101';

select
  '2. Guardian A cannot access Student B without a relationship' as probe,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from public.academy_students
where id = '00000000-0000-0000-0000-000000000201';

select
  '7. A student can have multiple subject enrollments' as probe,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as result
from public.academy_subject_enrollments
where student_id = '00000000-0000-0000-0000-000000000101';

select
  '8. Shared curriculum retains separate enrollment IDs' as probe,
  case
    when count(*) = 2 and count(distinct id) = 2 and count(distinct student_id) = 2
      then 'PASS'
    else 'FAIL'
  end as result
from public.academy_subject_enrollments
where course_id = 'math-grade-4'
  and curriculum_version = '2026.1';

reset role;

-- Guardian B.
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
set local role authenticated;

select
  '3. Guardian B cannot access Household A' as probe,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from public.academy_households
where id = '00000000-0000-0000-0000-000000000011';

reset role;

select
  '4. Anonymous users have no student-table read privilege' as probe,
  case
    when not has_table_privilege('anon', 'public.academy_students', 'select')
      then 'PASS'
    else 'FAIL'
  end as result;

select
  '9a. Authenticated clients cannot read credential verifiers' as probe,
  case
    when not has_table_privilege(
      'authenticated',
      'academy_private.student_access_credentials',
      'select'
    )
      then 'PASS'
    else 'FAIL'
  end as result;

select
  '9b. Authenticated clients cannot read session token digests' as probe,
  case
    when not has_table_privilege(
      'authenticated',
      'academy_private.student_session_grants',
      'select'
    )
      then 'PASS'
    else 'FAIL'
  end as result;

select
  '9c. No credential or token digest is present in the public schema' as probe,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from information_schema.columns
where table_schema = 'public'
  and column_name in ('verifier_digest', 'token_digest');

select
  '10. Direct clients cannot self-assign guardian access' as probe,
  case
    when not has_table_privilege(
      'authenticated',
      'public.academy_guardian_student_access',
      'insert'
    )
      and not has_table_privilege(
        'authenticated',
        'public.academy_household_memberships',
        'insert'
      )
      and not has_table_privilege(
        'authenticated',
        'public.academy_students',
        'insert'
      )
      and not has_table_privilege(
        'authenticated',
        'public.academy_households',
        'insert'
      )
      then 'PASS'
    else 'FAIL'
  end as result;

select
  '12. Service APIs cannot update or delete append-only audit events' as probe,
  case
    when not has_table_privilege(
      'service_role',
      'public.academy_audit_events',
      'update'
    )
      and not has_table_privilege(
        'service_role',
        'public.academy_audit_events',
        'delete'
      )
      then 'PASS'
    else 'FAIL'
  end as result;

-- Revoke Guardian A's Student A relationship as the trusted migration owner.
update public.academy_guardian_student_access
set
  status = 'revoked',
  revoked_at = now(),
  revoked_by = '00000000-0000-0000-0000-0000000000a1'
where id = '00000000-0000-0000-0000-0000000001a1';

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
set local role authenticated;

select
  '5. Revoked guardian access immediately fails' as probe,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from public.academy_students
where id = '00000000-0000-0000-0000-000000000101';

reset role;

-- Restore the relationship, then deactivate without deleting any records.
update public.academy_guardian_student_access
set
  status = 'active',
  revoked_at = null,
  revoked_by = null
where id = '00000000-0000-0000-0000-0000000001a1';

update public.academy_students
set
  lifecycle_status = 'deactivated',
  lifecycle_changed_at = now(),
  lifecycle_reason = 'Phase-0 verification'
where id = '00000000-0000-0000-0000-000000000101';

select
  '6. Deactivation does not delete student or enrollment references' as probe,
  case
    when (
      select count(*)
      from public.academy_students
      where id = '00000000-0000-0000-0000-000000000101'
    ) = 1
    and (
      select count(*)
      from public.academy_subject_enrollments
      where student_id = '00000000-0000-0000-0000-000000000101'
    ) = 2
      then 'PASS'
    else 'FAIL'
  end as result;

select
  '11a. Historical rows remain addressable after lifecycle change' as probe,
  case
    when count(*) = 1
      and max(lifecycle_status) = 'deactivated'
      then 'PASS'
    else 'FAIL'
  end as result
from public.academy_students
where id = '00000000-0000-0000-0000-000000000101';

select
  '11b. Lifecycle and relationship changes created audit events' as probe,
  case
    when count(*) >= 4 then 'PASS' else 'FAIL'
  end as result
from public.academy_audit_events
where student_id = '00000000-0000-0000-0000-000000000101'
  and event_type in (
    'student.created',
    'student.lifecycle_changed',
    'guardian_access.granted',
    'guardian_access.changed'
  );

-- Authorized guardians retain historical read access after deactivation.
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
set local role authenticated;

select
  '11c. Authorized guardian can still read deactivated student history' as probe,
  case
    when count(*) = 1
      and max(lifecycle_status) = 'deactivated'
      then 'PASS'
    else 'FAIL'
  end as result
from public.academy_students
where id = '00000000-0000-0000-0000-000000000101';

reset role;

rollback;
