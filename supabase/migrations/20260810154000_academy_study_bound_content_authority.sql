begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study bound content authority migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.curriculum_binding_version <> 2
     or not marker.migration_names @> array[
       '20260810150000_academy_study_curriculum_binding',
       '20260810153000_academy_study_release_registry_bridge'
     ]::text[] then
    raise exception 'Study bound content authority prerequisite mismatch';
  end if;
  if to_regprocedure(
       'public.academy_study_read_bound_content_authority_v1(text,text)'
     ) is not null then
    raise exception 'Study bound content authority object collision';
  end if;
end;
$$;

-- This projection is intentionally service-only. It authenticates the opaque
-- learner session, selects exactly one Study session in that learner scope,
-- and returns only bounded refs plus immutable release custody. Curriculum
-- bodies remain in the immutable package and never enter operational storage.
create function public.academy_study_read_bound_content_authority_v1(
  p_token_digest text,
  p_session_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  grant_row academy_private.student_session_grants%rowtype;
  session_row public.academy_study_sessions%rowtype;
  release_row public.academy_curriculum_releases%rowtype;
  eligible_course_refs text[];
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_session_id is null
     or not public.academy_study_identifier_is_valid(p_session_id) then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'reasonCode', 'student-session-invalid'
    );
  end if;

  select item.* into grant_row
  from academy_private.student_session_grants as item
  where item.token_digest = p_token_digest
    and item.grant_purpose = 'study'
    and item.contract_version = 1
    and item.capabilities @> array['student:progress:read']::text[]
    and academy_private.is_student_session_grant_current(item.id);
  if grant_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'reasonCode', 'student-session-invalid'
    );
  end if;

  select item.* into session_row
  from public.academy_study_sessions as item
  where item.id = p_session_id
    and item.household_id = grant_row.household_id
    and item.student_id = grant_row.student_id;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;
  if session_row.curriculum_binding_schema_version is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'manual-review',
      'reasonCode', 'legacy-curriculum-binding-ambiguous'
    );
  end if;

  select item.* into release_row
  from public.academy_curriculum_releases as item
  where item.release_id = session_row.curriculum_release_id
    and item.package_id = session_row.curriculum_package_id
    and item.version = session_row.curriculum_release_version
    and item.curriculum_manifest_sha256 =
      session_row.curriculum_manifest_sha256
    and item.status = 'published';
  if release_row.release_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unavailable'
    );
  end if;

  select array_agg(distinct btrim(enrollment.course_id)
    order by btrim(enrollment.course_id))
  into eligible_course_refs
  from public.academy_subject_enrollments as enrollment
  where enrollment.household_id = grant_row.household_id
    and enrollment.student_id = grant_row.student_id
    and enrollment.enrollment_status = 'active'
    and enrollment.curriculum_version is not null
    and btrim(enrollment.curriculum_version) = release_row.version
    and enrollment.course_id is not null
    and btrim(enrollment.course_id) <> ''
    and (enrollment.starts_on is null
      or enrollment.starts_on <= session_row.intended_local_date)
    and (enrollment.ends_on is null
      or enrollment.ends_on >= session_row.intended_local_date);
  if coalesce(cardinality(eligible_course_refs), 0) = 0 then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'learner-curriculum-scope-unavailable'
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ready',
    'session', jsonb_build_object(
      'sessionRef', session_row.id,
      'lessonRef', session_row.lesson_id,
      'subjectRef', session_row.subject_id,
      'intendedLocalDate', session_row.intended_local_date
    ),
    'learnerScope', jsonb_build_object(
      'eligibleCourseRefs', to_jsonb(eligible_course_refs)
    ),
    'curriculumBinding', jsonb_build_object(
      'schemaVersion', 1,
      'status', 'bound',
      'releaseId', release_row.release_id,
      'packageId', release_row.package_id,
      'releaseVersion', release_row.version,
      'curriculumManifestSha256',
        release_row.curriculum_manifest_sha256,
      'sourceRoot', release_row.source_root
    )
  );
end;
$$;

alter function public.academy_study_read_bound_content_authority_v1(
  text, text
) owner to postgres;
revoke all on function public.academy_study_read_bound_content_authority_v1(
  text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_study_read_bound_content_authority_v1(
  text, text
) to service_role;

comment on function public.academy_study_read_bound_content_authority_v1(
  text, text
) is
  'Service-only exact-session release and learner-course authority for fail-closed Study curriculum loading.';

commit;
