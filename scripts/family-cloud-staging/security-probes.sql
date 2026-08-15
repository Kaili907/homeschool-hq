-- Family Cloud Sync R1 staging-only database probes.
-- The entire synthetic fixture is rolled back. Run only after an independent
-- project-ref guard has pinned the authorized non-production project.
begin;

create temporary table probe_results (
  probe text primary key,
  result jsonb not null
) on commit drop;
grant insert, select on pg_temp.probe_results to authenticated;

create or replace function pg_temp.response_checkpoint(
  p_operation_id uuid,
  p_revision bigint,
  p_base_revision bigint,
  p_household_ref text default 'local-household-a',
  p_student_ref text default 'local-student-a',
  p_assignment_ref text default 'local-assignment-a',
  p_session_ref text default 'local-session-a'
) returns jsonb
language sql
as $$
  select jsonb_build_object(
    'contract', 'family-pilot.learner-response-checkpoint.r1',
    'contractVersion', 1,
    'identity', jsonb_build_object(
      'householdRef', p_household_ref,
      'studentRef', p_student_ref,
      'learnerRef', p_student_ref,
      'assignmentRef', p_assignment_ref,
      'sessionRef', p_session_ref
    ),
    'attempt', jsonb_build_object(
      'attemptRef', 'attempt:staging-a',
      'lessonRef', 'lesson-staging-a'
    ),
    'sync', jsonb_build_object(
      'baseRevision', p_base_revision,
      'revision', p_revision,
      'operationId', p_operation_id,
      'savedAt', '2026-08-15T18:00:00.000Z'
    ),
    'responses', jsonb_build_array(jsonb_build_object(
      'itemRef', 'item:staging-a',
      'sectionRef', 'section:staging-a',
      'segmentRef', 'segment-staging-a',
      'responseType', 'TEXT',
      'evidenceMode', 'SUPPORTED',
      'response', jsonb_build_object('kind', 'TEXT', 'text', 'Synthetic staging response.'),
      'status', 'PENDING_ASSESSMENT',
      'savedAt', '2026-08-15T18:00:00.000Z',
      'assessment', null
    ))
  )
$$;

create or replace function pg_temp.first_link_import(
  p_local_household text,
  p_local_student text,
  p_local_assignment text,
  p_local_session text,
  p_hosted_assignment text,
  p_hosted_session text,
  p_lesson text,
  p_response jsonb default null
) returns jsonb
language sql
as $$
  select jsonb_build_object(
    'localScope', jsonb_build_object(
      'householdRef', p_local_household,
      'studentRef', p_local_student,
      'assignmentRef', p_local_assignment,
      'sessionRef', p_local_session
    ),
    'hostedScope', jsonb_build_object(
      'assignmentRef', p_hosted_assignment,
      'sessionRef', p_hosted_session
    ),
    'session', jsonb_build_object(
      'lessonRef', p_lesson,
      'subjectRef', 'mathematics',
      'state', 'active',
      'startedAt', '2026-08-15T18:00:00.000Z',
      'completedAt', null,
      'intendedLocalDate', '2026-08-15'
    ),
    'checkpoint', null,
    'socialSource', null,
    'guardianAttestation', null,
    'safetyState', jsonb_build_object('schemaVersion', 1, 'holds', jsonb_build_array()),
    'assessment', null
  ) || case when p_response is null then '{}'::jsonb
       else jsonb_build_object('learnerResponseCheckpoint', p_response) end
$$;

insert into auth.users (id) values
  ('90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-0000000000b1');

insert into public.academy_households (id, name, created_by) values
  ('90000000-0000-4000-8000-000000000011', 'Staging Probe Household A', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-000000000022', 'Staging Probe Household B', '90000000-0000-4000-8000-0000000000b1');

insert into public.academy_household_memberships (
  id, household_id, user_id, status, activated_at
) values
  ('90000000-0000-4000-8000-0000000000a2', '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-0000000000a1', 'active', now()),
  ('90000000-0000-4000-8000-0000000000b2', '90000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-0000000000b1', 'active', now());

insert into public.academy_students (
  id, household_id, display_name, lifecycle_status, created_by
) values
  ('90000000-0000-4000-8000-000000000101', '90000000-0000-4000-8000-000000000011', 'Staging Learner A', 'active', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-000000000102', '90000000-0000-4000-8000-000000000011', 'Staging Sibling A', 'active', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-000000000201', '90000000-0000-4000-8000-000000000022', 'Staging Learner B', 'active', '90000000-0000-4000-8000-0000000000b1');

insert into public.academy_guardian_student_access (
  id, household_id, student_id, membership_id, permission_level, status, granted_by
) values
  ('90000000-0000-4000-8000-0000000001a1', '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000101', '90000000-0000-4000-8000-0000000000a2', 'identity_manager', 'active', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-0000000001a2', '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000102', '90000000-0000-4000-8000-0000000000a2', 'identity_manager', 'active', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-0000000001b1', '90000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000201', '90000000-0000-4000-8000-0000000000b2', 'identity_manager', 'active', '90000000-0000-4000-8000-0000000000b1');

insert into public.academy_study_household_settings (
  household_id, household_timezone, updated_by
) values
  ('90000000-0000-4000-8000-000000000011', 'America/Detroit', '90000000-0000-4000-8000-0000000000a1'),
  ('90000000-0000-4000-8000-000000000022', 'America/Detroit', '90000000-0000-4000-8000-0000000000b1');

insert into academy_private.student_access_credentials (
  id, household_id, student_id, credential_kind, credential_version,
  verifier_scheme, verifier_digest, status, created_actor_kind, created_by,
  creation_reason, correlation_id
) values
  ('90000000-0000-4000-8000-000000009101', '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000101', 'pin', 1, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE', 'active', 'guardian', '90000000-0000-4000-8000-0000000000a1', 'Staging probe only', '90000000-0000-4000-8000-00000000d101'),
  ('90000000-0000-4000-8000-000000009102', '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000102', 'pin', 1, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE', 'active', 'guardian', '90000000-0000-4000-8000-0000000000a1', 'Staging probe only', '90000000-0000-4000-8000-00000000d102'),
  ('90000000-0000-4000-8000-000000009201', '90000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000201', 'pin', 1, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$dXV1dXV1dXV1dXV1dXV1dQ$Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2M', 'active', 'guardian', '90000000-0000-4000-8000-0000000000b1', 'Staging probe only', '90000000-0000-4000-8000-00000000d201');

insert into academy_private.student_session_grants (
  id, household_id, student_id, token_digest, capabilities, credential_id,
  credential_version, session_version, issuance_flow, issued_actor_kind,
  issued_by, issuing_membership_id, issuing_access_id,
  issuance_reason, correlation_id, issued_at, expires_at, grant_purpose
) select grant_id, student.household_id, student.id, digest,
  array['student:profile:read', 'student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  credential_id, 1, student.session_version, 'guardian_activation', 'guardian',
  guardian_id, membership_id, access_id,
  'Staging probe only', correlation_id, now(), now() + interval '1 hour', 'study'
from (values
  ('90000000-0000-4000-8000-000000008101'::uuid, '90000000-0000-4000-8000-000000000101'::uuid, repeat('a', 64), '90000000-0000-4000-8000-000000009101'::uuid, '90000000-0000-4000-8000-0000000000a1'::uuid, '90000000-0000-4000-8000-0000000000a2'::uuid, '90000000-0000-4000-8000-0000000001a1'::uuid, '90000000-0000-4000-8000-00000000e101'::uuid),
  ('90000000-0000-4000-8000-000000008102'::uuid, '90000000-0000-4000-8000-000000000102'::uuid, repeat('c', 64), '90000000-0000-4000-8000-000000009102'::uuid, '90000000-0000-4000-8000-0000000000a1'::uuid, '90000000-0000-4000-8000-0000000000a2'::uuid, '90000000-0000-4000-8000-0000000001a2'::uuid, '90000000-0000-4000-8000-00000000e102'::uuid),
  ('90000000-0000-4000-8000-000000008201'::uuid, '90000000-0000-4000-8000-000000000201'::uuid, repeat('b', 64), '90000000-0000-4000-8000-000000009201'::uuid, '90000000-0000-4000-8000-0000000000b1'::uuid, '90000000-0000-4000-8000-0000000000b2'::uuid, '90000000-0000-4000-8000-0000000001b1'::uuid, '90000000-0000-4000-8000-00000000e201'::uuid)
) as fixture(grant_id, student_id, digest, credential_id, guardian_id, membership_id, access_id, correlation_id)
join public.academy_students student on student.id = fixture.student_id;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-0000000000a1"}', true);

insert into pg_temp.probe_results
select 'valid_first_link',
  public.academy_study_sync_first_link_v2(
    repeat('a', 64),
    '90000000-0000-4000-8000-000000000101',
    '91000000-0000-4000-8000-000000000001',
    pg_temp.first_link_import(
      'local-household-a', 'local-student-a', 'local-assignment-a', 'local-session-a',
      'assignment-staging-a', 'session-staging-a', 'lesson-staging-a'
    )
  ) as result;

reset role;

insert into public.academy_family_response_checkpoints (
  session_id, household_id, student_id, assignment_ref,
  local_household_ref, local_student_ref, local_learner_ref,
  local_assignment_ref, local_session_ref, attempt_ref, lesson_ref,
  base_revision, revision, last_client_operation_id, saved_at, document_digest
) values (
  'session-staging-a',
  '90000000-0000-4000-8000-000000000011',
  '90000000-0000-4000-8000-000000000101',
  'assignment-staging-a',
  'local-household-a', 'local-student-a', 'local-student-a',
  'local-assignment-a', 'local-session-a', 'attempt:staging-a', 'lesson-staging-a',
  0, 0, '91000000-0000-4000-8000-000000000001',
  '2026-08-15T18:00:00.000Z',
  academy_private.study_sha256_json(
    pg_temp.response_checkpoint('91000000-0000-4000-8000-000000000001', 0, 0)
  )
);

select academy_private.study_family_response_insert_items_r1(
  '90000000-0000-4000-8000-000000000011',
  '90000000-0000-4000-8000-000000000101',
  'session-staging-a', 0,
  pg_temp.response_checkpoint(
    '91000000-0000-4000-8000-000000000001', 0, 0
  ) -> 'responses'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-0000000000a1"}', true);

insert into pg_temp.probe_results
select 'wrong_learner_rpc',
  public.academy_study_sync_first_link_v2(
    repeat('a', 64),
    '90000000-0000-4000-8000-000000000102',
    '91000000-0000-4000-8000-000000000002',
    pg_temp.first_link_import(
      'local-household-a', 'local-sibling-a', 'local-assignment-sibling', 'local-session-sibling',
      'assignment-staging-sibling', 'session-staging-sibling', 'lesson-staging-sibling'
    )
  ) as result;

insert into pg_temp.probe_results
select 'valid_sibling_first_link',
  public.academy_study_sync_first_link_v2(
    repeat('c', 64),
    '90000000-0000-4000-8000-000000000102',
    '91000000-0000-4000-8000-000000000003',
    pg_temp.first_link_import(
      'local-household-a', 'local-sibling-a', 'local-assignment-sibling', 'local-session-sibling',
      'assignment-staging-sibling', 'session-staging-sibling', 'lesson-staging-sibling'
    )
  ) as result;

insert into pg_temp.probe_results
select 'guardian_a_rls', jsonb_build_object(
  'ownHouseholds', count(*) filter (where id = '90000000-0000-4000-8000-000000000011')::int,
  'wrongHouseholds', count(*) filter (where id = '90000000-0000-4000-8000-000000000022')::int
)
from public.academy_households
where id in ('90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000022');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-0000000000b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-0000000000b1"}', true);

insert into pg_temp.probe_results
select 'wrong_household_rpc',
  public.academy_study_sync_hydrate_v2(
    repeat('b', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a'
  ) as result;

insert into pg_temp.probe_results
select 'guardian_b_rls', jsonb_build_object(
  'ownHouseholds', count(*) filter (where id = '90000000-0000-4000-8000-000000000022')::int,
  'wrongHouseholds', count(*) filter (where id = '90000000-0000-4000-8000-000000000011')::int
)
from public.academy_households
where id in ('90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000022');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000008101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000008101","academy_principal_kind":"student_session_grant"}', true);

insert into pg_temp.probe_results
select 'sibling_private_rls', jsonb_build_object(
  'ownRows', count(*) filter (where student_id = '90000000-0000-4000-8000-000000000101')::int,
  'siblingRows', count(*) filter (where student_id = '90000000-0000-4000-8000-000000000102')::int
)
from public.academy_study_session_authority
where student_id in ('90000000-0000-4000-8000-000000000101', '90000000-0000-4000-8000-000000000102');

insert into pg_temp.probe_results
select 'response_write',
  public.academy_study_sync_write_v2(
    repeat('a', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a', 0,
    '92000000-0000-4000-8000-000000000001',
    'learner-response-checkpoint:compare-and-swap',
    jsonb_build_object('learnerResponseCheckpoint',
      pg_temp.response_checkpoint('92000000-0000-4000-8000-000000000001', 1, 0))
  ) as result;

insert into pg_temp.probe_results
select 'stale_cas_revision',
  public.academy_study_sync_write_v2(
    repeat('a', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a', 0,
    '92000000-0000-4000-8000-000000000002',
    'learner-response-checkpoint:compare-and-swap',
    jsonb_build_object('learnerResponseCheckpoint',
      pg_temp.response_checkpoint('92000000-0000-4000-8000-000000000002', 1, 0))
  ) as result;

with forbidden(label, field, value, operation_id) as (values
  ('unexpected_response_field', 'unexpectedField', 'true'::jsonb, '93000000-0000-4000-8000-000000000001'::uuid),
  ('answer_key_field', 'answerKey', '"forbidden"'::jsonb, '93000000-0000-4000-8000-000000000002'::uuid),
  ('correct_answer_field', 'correctAnswer', '"forbidden"'::jsonb, '93000000-0000-4000-8000-000000000003'::uuid),
  ('adult_rubric_field', 'adultRubric', '"forbidden"'::jsonb, '93000000-0000-4000-8000-000000000004'::uuid),
  ('tutor_transcript_field', 'tutorTranscript', '["forbidden"]'::jsonb, '93000000-0000-4000-8000-000000000005'::uuid)
)
insert into pg_temp.probe_results
select label,
  public.academy_study_sync_write_v2(
    repeat('a', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a', 1,
    operation_id,
    'learner-response-checkpoint:compare-and-swap',
    jsonb_build_object('learnerResponseCheckpoint',
      jsonb_set(
        pg_temp.response_checkpoint(operation_id, 2, 1),
        array['responses', '0', field], value, true
      )
    )
  ) as result
from forbidden
order by label;

with forbidden(label, document, operation_id) as (values
  ('pin_field', pg_temp.response_checkpoint('93000000-0000-4000-8000-000000000006', 2, 1) || '{"parentPin":"1234"}'::jsonb, '93000000-0000-4000-8000-000000000006'::uuid),
  ('token_field', pg_temp.response_checkpoint('93000000-0000-4000-8000-000000000007', 2, 1) || '{"refreshToken":"forbidden"}'::jsonb, '93000000-0000-4000-8000-000000000007'::uuid)
)
insert into pg_temp.probe_results
select label,
  public.academy_study_sync_write_v2(
    repeat('a', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a', 1,
    operation_id,
    'learner-response-checkpoint:compare-and-swap',
    jsonb_build_object('learnerResponseCheckpoint', document)
  ) as result
from forbidden
order by label;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000999', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000000999"}', true);

insert into pg_temp.probe_results
select 'invalid_identity_rls', jsonb_build_object(
  'householdRows', (select count(*)::int from public.academy_households),
  'learnerRows', (select count(*)::int from public.academy_students)
);

insert into pg_temp.probe_results
select 'invalid_identity_rpc',
  public.academy_study_sync_hydrate_v2(
    repeat('a', 64), '90000000-0000-4000-8000-000000000101',
    'assignment-staging-a', 'session-staging-a'
  ) as result;

reset role;

insert into pg_temp.probe_results
select 'anonymous_acl', jsonb_build_object(
  'householdRead', has_table_privilege('anon', 'public.academy_households', 'select'),
  'learnerRead', has_table_privilege('anon', 'public.academy_students', 'select'),
  'hydrateExecute', has_function_privilege(
    'anon', 'public.academy_study_sync_hydrate_v2(text,uuid,text,text)', 'execute'
  )
);

insert into pg_temp.probe_results
select 'synthetic_rows_before_rollback', jsonb_build_object(
  'households', (select count(*)::int from public.academy_households where id::text like '90000000-%'),
  'learners', (select count(*)::int from public.academy_students where id::text like '90000000-%')
);

do $$
declare
  failures text[];
begin
  select array_agg(probe order by probe) into failures
  from pg_temp.probe_results
  where case probe
    when 'valid_first_link' then result ->> 'status' not in ('imported', 'linked-existing')
    when 'valid_sibling_first_link' then result ->> 'status' not in ('imported', 'linked-existing')
    when 'wrong_learner_rpc' then result ->> 'status' <> 'denied'
    when 'wrong_household_rpc' then result ->> 'status' <> 'unavailable'
    when 'guardian_a_rls' then result <> '{"ownHouseholds":1,"wrongHouseholds":0}'::jsonb
    when 'guardian_b_rls' then result <> '{"ownHouseholds":1,"wrongHouseholds":0}'::jsonb
    when 'sibling_private_rls' then result <> '{"ownRows":1,"siblingRows":0}'::jsonb
    when 'response_write' then result ->> 'status' <> 'stored'
    when 'stale_cas_revision' then result ->> 'status' <> 'revision-conflict'
    when 'unexpected_response_field' then result ->> 'status' <> 'invalid-write'
    when 'answer_key_field' then result ->> 'status' <> 'invalid-write'
    when 'correct_answer_field' then result ->> 'status' <> 'invalid-write'
    when 'adult_rubric_field' then result ->> 'status' <> 'invalid-write'
    when 'tutor_transcript_field' then result ->> 'status' <> 'invalid-write'
    when 'pin_field' then result ->> 'status' <> 'invalid-write'
    when 'token_field' then result ->> 'status' <> 'invalid-write'
    when 'invalid_identity_rls' then result <> '{"householdRows":0,"learnerRows":0}'::jsonb
    when 'invalid_identity_rpc' then result ->> 'status' <> 'unavailable'
    when 'anonymous_acl' then result <> '{"householdRead":false,"learnerRead":false,"hydrateExecute":false}'::jsonb
    when 'synthetic_rows_before_rollback' then result <> '{"households":2,"learners":3}'::jsonb
    else true
  end;
  if failures is not null then
    raise exception 'FAMILY_CLOUD_STAGING_SECURITY_PROBE_FAILED:%', failures;
  end if;
end;
$$;

select probe, result
from pg_temp.probe_results
order by probe;

rollback;
