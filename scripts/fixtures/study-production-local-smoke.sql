-- Deterministic synthetic-only additions to supabase/tests/study_engine_fixtures.sql.
-- This file is applied only to a fresh in-memory PGlite database by the local
-- Study production smoke harness.

update public.academy_guardian_student_access
set permission_level = 'identity_manager'
where id = '00000000-0000-0000-0000-0000000001a1'::uuid;

insert into public.academy_subject_enrollments (
  id, household_id, student_id, school_year_key, subject_key,
  instructional_level, course_id, curriculum_version,
  enrollment_status, starts_on, placement_source
) values (
  '15800000-0000-4000-8000-000000000028',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000101',
  '2026-2027', 'mathematics', 'grade-5', 'ma-g5-mathematics', '1.0.0',
  'active', '2026-08-01', 'parent'
);
