-- LOCAL/EPHEMERAL DATABASE ONLY. Stable two-household Session 13 personas.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000a5');

insert into public.academy_households (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000011', 'Study Household A', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000022', 'Study Household B', '00000000-0000-0000-0000-0000000000b1');

insert into public.academy_household_memberships (
  id, household_id, user_id, status, activated_at
) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000a1', 'active', now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000000b1', 'active', now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000a3', 'active', now()),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000a4', 'invited', null),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000a5', 'active', now());

insert into public.academy_students (
  id, household_id, display_name, lifecycle_status, created_by
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 'Study Student A', 'active', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000022', 'Study Student B', 'active', '00000000-0000-0000-0000-0000000000b1');

insert into public.academy_guardian_student_access (
  id, household_id, student_id, membership_id, permission_level,
  status, granted_by
) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000a2', 'learning_manager', 'active', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000b2', 'learning_manager', 'active', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000a3', 'viewer', 'active', '00000000-0000-0000-0000-0000000000a1');

insert into academy_private.student_access_credentials (
  id, household_id, student_id, credential_kind, credential_version,
  verifier_scheme, verifier_digest, status, created_actor_kind, created_by,
  creation_reason, correlation_id
) values
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', 'pin', 1, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE', 'active', 'guardian', '00000000-0000-0000-0000-0000000000a1', 'Synthetic Study credential A', '00000000-0000-0000-0000-00000000d101'),
  ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000201', 'pin', 1, 'argon2id', '$argon2id$v=19$m=65536,t=3,p=1$dXV1dXV1dXV1dXV1dXV1dQ$Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2M', 'active', 'guardian', '00000000-0000-0000-0000-0000000000b1', 'Synthetic Study credential B', '00000000-0000-0000-0000-00000000d201');

insert into academy_private.student_session_grants (
  id, household_id, student_id, token_digest, capabilities, credential_id,
  credential_version, session_version, issuance_flow, issued_actor_kind,
  issuance_reason, correlation_id, issued_at, expires_at
) select
  '00000000-0000-0000-0000-000000008101', student.household_id, student.id,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  array['student:profile:read', 'student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  '00000000-0000-0000-0000-000000009101', 1, student.session_version,
  'student_credential', 'trusted_server', 'Synthetic Study grant A',
  '00000000-0000-0000-0000-00000000e101', now(), now() + interval '4 hours'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000101';

insert into academy_private.student_session_grants (
  id, household_id, student_id, token_digest, capabilities, credential_id,
  credential_version, session_version, issuance_flow, issued_actor_kind,
  issuance_reason, correlation_id, issued_at, expires_at
) select
  '00000000-0000-0000-0000-000000008201', student.household_id, student.id,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  array['student:profile:read', 'student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  '00000000-0000-0000-0000-000000009201', 1, student.session_version,
  'student_credential', 'trusted_server', 'Synthetic Study grant B',
  '00000000-0000-0000-0000-00000000e201', now(), now() + interval '4 hours'
from public.academy_students as student
where student.id = '00000000-0000-0000-0000-000000000201';

insert into public.academy_study_household_settings (
  household_id, household_timezone, updated_by
) values
  ('00000000-0000-0000-0000-000000000011', 'America/New_York', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000022', 'UTC', '00000000-0000-0000-0000-0000000000b1');

insert into public.academy_study_sessions (
  id, household_id, student_id, lesson_id, subject_id, state, started_at,
  intended_local_date, household_timezone, created_by
) values
  ('session-a', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', 'lesson-a', 'math', 'active', '2026-08-01T14:00:00Z', '2026-08-01', 'UTC', '00000000-0000-0000-0000-0000000000a1'),
  ('session-b', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000201', 'lesson-b', 'reading', 'active', '2026-08-01T14:00:00Z', '2026-08-01', 'UTC', '00000000-0000-0000-0000-0000000000b1');

insert into public.academy_study_parent_settings (
  household_id, student_id, parent_override, updated_by
) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', true, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000201', false, '00000000-0000-0000-0000-0000000000b1');
