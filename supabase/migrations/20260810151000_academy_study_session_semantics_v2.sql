begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study session semantics V2 migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.storage_version <> 1
     or marker.authorization_version <> 1
     or marker.final_production_version <> 1
     or marker.effective_settings_version <> 2
     or marker.curriculum_binding_version <> 1 then
    raise exception 'Study session semantics V2 prerequisite mismatch';
  end if;
  if to_regprocedure(
       'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_session_semantics_readiness_v2()'
     ) is not null then
    raise exception 'Study session semantics V2 object collision';
  end if;
end;
$$;

create function academy_private.study_iso_date_is_valid_v2(candidate text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed date;
begin
  if candidate is null or candidate !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  parsed := candidate::date;
  return to_char(parsed, 'YYYY-MM-DD') = candidate;
exception when others then
  return false;
end;
$$;

create function academy_private.study_settings_provenance_is_valid_v2(
  candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'array'
    and jsonb_array_length(candidate) <= 4
    and not exists (
      select 1
      from jsonb_array_elements(candidate) as source(value)
      where jsonb_typeof(source.value) <> 'string'
        or source.value #>> '{}' not in (
          'admin_default', 'guardian', 'accommodation', 'safety'
        )
    )
    and jsonb_array_length(candidate) = (
      select count(distinct source.value #>> '{}')
      from jsonb_array_elements(candidate) as source(value)
    );
$$;

create function academy_private.study_effective_settings_snapshot_is_valid_v2(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  settings jsonb;
  provenance jsonb;
  field_name text;
begin
  if not public.academy_study_json_has_exact_keys(candidate, array[
      'schemaVersion', 'status', 'studentId', 'effectiveDate',
      'settings', 'provenance'
    ]::text[])
     or candidate ->> 'schemaVersion' <> '2'
     or candidate ->> 'status' <> 'ready'
     or (candidate ->> 'studentId')::text !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not academy_private.study_iso_date_is_valid_v2(
       candidate ->> 'effectiveDate'
     ) then
    return false;
  end if;
  settings := candidate -> 'settings';
  provenance := candidate -> 'provenance';
  if not public.academy_study_json_has_exact_keys(settings, array[
      'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes',
      'breakMaximumMinutes', 'minimumBreakCount',
      'requiredBreakIntervalMinutes', 'reducedMotion', 'noAudio',
      'largeText', 'readAloud', 'speechInputAllowed'
    ]::text[])
     or not public.academy_study_json_has_exact_keys(provenance, array[
      'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes',
      'breakMaximumMinutes', 'minimumBreakCount',
      'requiredBreakIntervalMinutes', 'reducedMotion', 'noAudio',
      'largeText', 'readAloud', 'speechInputAllowed'
    ]::text[])
     or settings ->> 'timerMode' not in (
       'visible', 'hidden', 'count_up', 'count_down'
     )
     or jsonb_typeof(settings -> 'maximumWorkMinutes') <> 'number'
     or (settings ->> 'maximumWorkMinutes')::integer not between 1 and 480
     or jsonb_typeof(settings -> 'breakMinimumMinutes') <> 'number'
     or (settings ->> 'breakMinimumMinutes')::integer not between 1 and 120
     or jsonb_typeof(settings -> 'breakMaximumMinutes') <> 'number'
     or (settings ->> 'breakMaximumMinutes')::integer not between 1 and 180
     or (settings ->> 'breakMinimumMinutes')::integer >
       (settings ->> 'breakMaximumMinutes')::integer
     or jsonb_typeof(settings -> 'minimumBreakCount') <> 'number'
     or (settings ->> 'minimumBreakCount')::integer not between 0 and 12
     or jsonb_typeof(settings -> 'requiredBreakIntervalMinutes') <> 'number'
     or (settings ->> 'requiredBreakIntervalMinutes')::integer
       not between 1 and 240 then
    return false;
  end if;
  foreach field_name in array array[
    'reducedMotion', 'noAudio', 'largeText', 'readAloud',
    'speechInputAllowed'
  ] loop
    if jsonb_typeof(settings -> field_name) <> 'boolean' then
      return false;
    end if;
  end loop;
  foreach field_name in array array[
    'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes',
    'breakMaximumMinutes', 'minimumBreakCount',
    'requiredBreakIntervalMinutes', 'reducedMotion', 'noAudio',
    'largeText', 'readAloud', 'speechInputAllowed'
  ] loop
    if not academy_private.study_settings_provenance_is_valid_v2(
      provenance -> field_name
    ) then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.academy_study_sessions
  add column session_semantics_version smallint,
  add column accepted_at timestamptz,
  add column effective_settings_snapshot jsonb,
  add column current_segment_id text,
  add column last_transition_kind text,
  add column last_transition_at timestamptz;

alter table public.academy_study_sessions
  add constraint academy_study_sessions_current_segment_check check (
    current_segment_id is null
    or public.academy_study_identifier_is_valid(current_segment_id)
  ),
  add constraint academy_study_sessions_semantics_v2_shape check (
    (
      session_semantics_version is null
      and accepted_at is null
      and effective_settings_snapshot is null
      and current_segment_id is null
      and last_transition_kind is null
      and last_transition_at is null
    )
    or (
      session_semantics_version = 2
      and accepted_at is not null
      and academy_private.study_effective_settings_snapshot_is_valid_v2(
        effective_settings_snapshot
      )
      and last_transition_kind in (
        'session-started', 'segment-started', 'segment-completed',
        'pause-started', 'session-resumed', 'break-requested',
        'break-started', 'break-ended',
        'technical-interruption-started',
        'technical-interruption-ended', 'session-completed',
        'session-abandoned'
      )
      and last_transition_at is not null
      and last_transition_at >= accepted_at
    )
  );

create function academy_private.study_session_authority_immutable_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.session_semantics_version is distinct from new.session_semantics_version
     or old.accepted_at is distinct from new.accepted_at
     or old.effective_settings_snapshot is distinct from
       new.effective_settings_snapshot then
    raise exception 'Study session authority snapshot is immutable';
  end if;
  return new;
end;
$$;

alter function academy_private.study_session_authority_immutable_v2()
  owner to postgres;
revoke all on function academy_private.study_session_authority_immutable_v2()
  from public, anon, authenticated, service_role;

create trigger academy_study_sessions_authority_immutable_v2
  before update of
    session_semantics_version, accepted_at, effective_settings_snapshot
  on public.academy_study_sessions
  for each row execute function
    academy_private.study_session_authority_immutable_v2();

create function academy_private.study_session_wire_state_v2(state_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case state_value
    when 'approved_break' then 'approved-break'
    when 'student_requested_break' then 'student-requested-break'
    when 'technical_interruption' then 'technical-interruption'
    else state_value
  end;
$$;

create function academy_private.study_transition_target_state_v2(
  current_state text,
  transition_type text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when current_state = 'active'
      and transition_type in ('segment-started', 'segment-completed')
      then 'active'
    when current_state = 'active' and transition_type = 'pause-started'
      then 'paused'
    when current_state = 'paused' and transition_type = 'session-resumed'
      then 'active'
    when current_state = 'active' and transition_type = 'break-requested'
      then 'student_requested_break'
    when current_state in ('active', 'student_requested_break')
      and transition_type = 'break-started' then 'approved_break'
    when current_state = 'approved_break' and transition_type = 'break-ended'
      then 'active'
    when current_state = 'active'
      and transition_type = 'technical-interruption-started'
      then 'technical_interruption'
    when current_state = 'technical_interruption'
      and transition_type = 'technical-interruption-ended'
      then 'active'
    when current_state not in ('completed', 'abandoned')
      and transition_type = 'session-completed' then 'completed'
    when current_state not in ('completed', 'abandoned')
      and transition_type = 'session-abandoned' then 'abandoned'
    else null
  end;
$$;

create function academy_private.study_session_projection_v2(
  p_session_id text,
  p_household_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  binding jsonb;
begin
  select * into session_row
  from public.academy_study_sessions
  where id = p_session_id
    and household_id = p_household_id
    and student_id = p_student_id;
  if session_row.id is null or session_row.session_semantics_version <> 2 then
    return null;
  end if;
  binding := academy_private.study_session_curriculum_binding_v1(
    session_row.id,
    session_row.household_id,
    session_row.student_id,
    session_row.curriculum_release_version
  );
  if binding ->> 'status' <> 'bound' then
    return null;
  end if;
  return jsonb_build_object(
    'schemaVersion', 2,
    'sessionId', session_row.id,
    'state', academy_private.study_session_wire_state_v2(session_row.state),
    'revision', session_row.revision,
    'acceptedAt', to_char(session_row.accepted_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(session_row.updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lessonId', session_row.lesson_id,
    'subjectId', session_row.subject_id,
    'studyPlanId', session_row.study_plan_id,
    'intendedLocalDate', to_char(
      session_row.intended_local_date, 'YYYY-MM-DD'
    ),
    'currentSegmentId', session_row.current_segment_id,
    'completedAt', case when session_row.completed_at is null then null
      else to_char(session_row.completed_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'lastTransition', jsonb_build_object(
      'type', session_row.last_transition_kind,
      'acceptedAt', to_char(session_row.last_transition_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'curriculumBinding', binding,
    'effectiveSettings', session_row.effective_settings_snapshot -> 'settings'
  );
end;
$$;

create function academy_private.study_begin_session_v2(
  p_household_id uuid,
  p_student_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  settings_result jsonb;
  binding jsonb;
  accepted_timestamp timestamptz;
  generated_session_id text;
  target_timezone text;
begin
  if auth.uid() is null
     or academy_private.study_authorized_household(
       p_student_id, 'student:attempts:create', false
     ) is distinct from p_household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(p_request, array[
      'idempotencyKey', 'lessonId', 'subjectId', 'studyPlanId',
      'intendedLocalDate', 'initialSegmentId', 'curriculumContext'
    ]::text[])
     or not public.academy_study_json_has_exact_keys(
       p_request -> 'curriculumContext',
       array['releaseVersion', 'lessonRef', 'skillRefs']::text[]
     )
     or not public.academy_study_payload_is_minimized(p_request, 8192)
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'idempotencyKey'
     )
     or not public.academy_study_identifier_is_valid(p_request ->> 'lessonId')
     or not public.academy_study_identifier_is_valid(p_request ->> 'subjectId')
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'initialSegmentId'
     )
     or (jsonb_typeof(p_request -> 'studyPlanId') <> 'null'
       and not public.academy_study_identifier_is_valid(
         p_request ->> 'studyPlanId'
       ))
     or not academy_private.study_iso_date_is_valid_v2(
       p_request ->> 'intendedLocalDate'
     )
     or p_request #>> '{curriculumContext,lessonRef}' <>
       p_request ->> 'lessonId'
     or p_request #>> '{curriculumContext,releaseVersion}' !~
       '^[0-9]+\.[0-9]+\.[0-9]+$'
     or jsonb_typeof(p_request #> '{curriculumContext,skillRefs}') <> 'array'
     or jsonb_array_length(
       p_request #> '{curriculumContext,skillRefs}'
     ) > 64
     or exists (
       select 1
       from jsonb_array_elements_text(
         p_request #> '{curriculumContext,skillRefs}'
       ) as skill(value)
       where not public.academy_study_identifier_is_valid(skill.value)
     ) then
    raise exception 'STUDY_SESSION_BEGIN_INVALID' using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object('request', p_request);
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'student:' || p_student_id::text
    and operation_kind = 'session_begin_v2'
    and idempotency_key = p_request ->> 'idempotencyKey';
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'idempotency-collision'
    );
  end if;

  settings_result := public.academy_study_effective_settings_v2(
    p_student_id,
    (p_request ->> 'intendedLocalDate')::date
  );
  if settings_result ->> 'status' = 'manual_review' then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'manual_review',
      'reasonCodes', settings_result -> 'reasonCodes',
      'sourceCategories', settings_result -> 'sourceCategories'
    );
  elsif settings_result ->> 'status' = 'unavailable' then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'unavailable',
      'reasonCode', settings_result ->> 'reasonCode'
    );
  elsif settings_result ->> 'status' <> 'ready'
     or not academy_private.study_effective_settings_snapshot_is_valid_v2(
       settings_result
     )
     or settings_result ->> 'studentId' <> p_student_id::text
     or settings_result ->> 'effectiveDate' <>
       p_request ->> 'intendedLocalDate' then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'unavailable',
      'reasonCode', 'authoritative_source_unavailable'
    );
  else
    binding := academy_private.study_resolve_curriculum_binding_internal_v1(
      p_student_id,
      p_request ->> 'subjectId',
      (p_request ->> 'intendedLocalDate')::date,
      p_request #>> '{curriculumContext,releaseVersion}'
    );
    if binding ->> 'status' <> 'bound' then
      result_value := binding;
    else
      select household_timezone into target_timezone
      from public.academy_study_household_settings
      where household_id = p_household_id;
      if target_timezone is null then
        result_value := jsonb_build_object(
          'schemaVersion', 2,
          'status', 'unavailable',
          'reasonCode', 'authoritative_source_unavailable'
        );
      else
        accepted_timestamp := clock_timestamp();
        generated_session_id := 'session:' ||
          replace(gen_random_uuid()::text, '-', '');
        insert into public.academy_study_sessions (
          id, schema_version, household_id, student_id, lesson_id,
          subject_id, study_plan_id, state, started_at, completed_at,
          intended_local_date, household_timezone, created_by,
          curriculum_binding_schema_version, curriculum_release_id,
          curriculum_package_id, curriculum_release_version,
          curriculum_manifest_sha256, session_semantics_version,
          accepted_at, effective_settings_snapshot, current_segment_id,
          last_transition_kind, last_transition_at
        ) values (
          generated_session_id, 1, p_household_id, p_student_id,
          p_request ->> 'lessonId', p_request ->> 'subjectId',
          p_request ->> 'studyPlanId', 'active', accepted_timestamp, null,
          (p_request ->> 'intendedLocalDate')::date, target_timezone, null,
          1, (binding ->> 'releaseId')::uuid,
          binding ->> 'packageId', binding ->> 'releaseVersion',
          binding ->> 'curriculumManifestSha256', 2,
          accepted_timestamp, settings_result,
          p_request ->> 'initialSegmentId', 'session-started',
          accepted_timestamp
        );
        result_value := academy_private.study_session_projection_v2(
          generated_session_id, p_household_id, p_student_id
        ) || jsonb_build_object('status', 'begun');
        perform academy_private.study_append_audit(
          p_household_id,
          p_student_id,
          'session.start',
          'session',
          generated_session_id,
          null,
          gen_random_uuid(),
          jsonb_build_object('revision', 1, 'result_code', 'begun')
        );
      end if;
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'student:' || p_student_id::text,
    'session_begin_v2',
    p_request ->> 'idempotencyKey',
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

create function academy_private.study_resume_session_v2(
  p_household_id uuid,
  p_student_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  binding jsonb;
  projection jsonb;
  checkpoint jsonb;
begin
  if auth.uid() is null
     or not public.academy_study_json_has_exact_keys(p_request, array[
       'sessionId', 'curriculumReleaseVersion'
     ]::text[])
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'sessionId'
     )
     or p_request ->> 'curriculumReleaseVersion' !~
       '^[0-9]+\.[0-9]+\.[0-9]+$' then
    raise exception 'STUDY_SESSION_RESUME_INVALID' using errcode = '22023';
  end if;
  select * into session_row
  from public.academy_study_sessions
  where id = p_request ->> 'sessionId'
    and household_id = p_household_id
    and student_id = p_student_id;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;
  binding := academy_private.study_session_curriculum_binding_v1(
    session_row.id,
    p_household_id,
    p_student_id,
    p_request ->> 'curriculumReleaseVersion'
  );
  if binding ->> 'status' <> 'bound' then
    return binding;
  end if;
  if session_row.session_semantics_version <> 2 then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;
  projection := academy_private.study_session_projection_v2(
    session_row.id, p_household_id, p_student_id
  );
  checkpoint := public.academy_study_read_checkpoint(session_row.id);
  return projection || jsonb_build_object(
    'status', case when session_row.state in ('completed', 'abandoned')
      then 'closed' else 'resumable' end,
    'checkpoint', checkpoint
  );
end;
$$;

create function academy_private.study_transition_session_v2(
  p_household_id uuid,
  p_student_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  binding jsonb;
  transition_type text;
  segment_id text;
  target_state text;
  accepted_timestamp timestamptz;
  segment_is_valid boolean;
begin
  if auth.uid() is null
     or not public.academy_study_json_has_exact_keys(p_request, array[
       'sessionId', 'expectedRevision', 'idempotencyKey',
       'curriculumReleaseVersion', 'transition'
     ]::text[])
     or not public.academy_study_json_has_exact_keys(
       p_request -> 'transition', array['type', 'segmentId']::text[]
     )
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'sessionId'
     )
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'idempotencyKey'
     )
     or p_request ->> 'expectedRevision' !~ '^[1-9][0-9]*$'
     or p_request ->> 'curriculumReleaseVersion' !~
       '^[0-9]+\.[0-9]+\.[0-9]+$'
     or p_request #>> '{transition,type}' not in (
       'segment-started', 'segment-completed', 'pause-started',
       'session-resumed', 'break-requested', 'break-started',
       'break-ended', 'technical-interruption-started',
       'technical-interruption-ended', 'session-completed',
       'session-abandoned'
     )
     or (jsonb_typeof(p_request #> '{transition,segmentId}') <> 'null'
       and not public.academy_study_identifier_is_valid(
         p_request #>> '{transition,segmentId}'
       )) then
    raise exception 'STUDY_SESSION_TRANSITION_INVALID' using errcode = '22023';
  end if;

  select * into session_row
  from public.academy_study_sessions
  where id = p_request ->> 'sessionId'
    and household_id = p_household_id
    and student_id = p_student_id
  for update;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;

  fingerprint := jsonb_build_object('request', p_request);
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || session_row.id
    and operation_kind = 'session_transition_v2'
    and idempotency_key = p_request ->> 'idempotencyKey';
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'idempotency-collision'
    );
  end if;

  binding := academy_private.study_session_curriculum_binding_v1(
    session_row.id,
    p_household_id,
    p_student_id,
    p_request ->> 'curriculumReleaseVersion'
  );
  if binding ->> 'status' <> 'bound' then
    result_value := binding;
  elsif session_row.session_semantics_version <> 2 then
    result_value := jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  elsif session_row.revision <>
    (p_request ->> 'expectedRevision')::bigint then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'revision-conflict',
      'currentRevision', session_row.revision,
      'currentState', academy_private.study_session_wire_state_v2(
        session_row.state
      )
    );
  else
    transition_type := p_request #>> '{transition,type}';
    segment_id := p_request #>> '{transition,segmentId}';
    target_state := academy_private.study_transition_target_state_v2(
      session_row.state, transition_type
    );
    segment_is_valid := case
      when transition_type = 'segment-started' then
        segment_id is not null and session_row.current_segment_id is null
      when transition_type = 'segment-completed' then
        segment_id is not null
        and segment_id = session_row.current_segment_id
      when transition_type in (
        'pause-started', 'session-resumed', 'break-requested',
        'break-started', 'break-ended',
        'technical-interruption-started',
        'technical-interruption-ended'
      ) then segment_id is not null
        and segment_id = session_row.current_segment_id
      when transition_type = 'session-completed' then
        segment_id is null and session_row.current_segment_id is null
      when transition_type = 'session-abandoned' then
        segment_id is not distinct from session_row.current_segment_id
      else false
    end;
    if target_state is null or not segment_is_valid then
      result_value := jsonb_build_object(
        'schemaVersion', 2,
        'status', 'invalid-transition',
        'currentRevision', session_row.revision,
        'currentState', academy_private.study_session_wire_state_v2(
          session_row.state
        ),
        'transitionType', transition_type
      );
    else
      accepted_timestamp := clock_timestamp();
      update public.academy_study_sessions
      set state = target_state,
          current_segment_id = case
            when transition_type = 'segment-started' then segment_id
            when transition_type = 'segment-completed' then null
            else current_segment_id
          end,
          completed_at = case when target_state = 'completed'
            then accepted_timestamp else null end,
          last_transition_kind = transition_type,
          last_transition_at = accepted_timestamp
      where id = session_row.id;
      result_value := academy_private.study_session_projection_v2(
        session_row.id, p_household_id, p_student_id
      ) || jsonb_build_object('status', 'stored');
      if target_state in ('completed', 'abandoned') then
        perform academy_private.study_append_audit(
          p_household_id,
          p_student_id,
          'session.finish',
          'session',
          session_row.id,
          null,
          gen_random_uuid(),
          jsonb_build_object(
            'revision', session_row.revision + 1,
            'result_code', case when target_state = 'completed'
              then 'completed' else 'abandoned' end
          )
        );
      end if;
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || session_row.id,
    'session_transition_v2',
    p_request ->> 'idempotencyKey',
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

create function academy_private.study_read_checkpoint_v2(
  p_household_id uuid,
  p_student_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  binding jsonb;
  checkpoint jsonb;
begin
  if auth.uid() is null
     or not public.academy_study_json_has_exact_keys(p_request, array[
       'sessionId', 'curriculumReleaseVersion'
     ]::text[])
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'sessionId'
     )
     or p_request ->> 'curriculumReleaseVersion' !~
       '^[0-9]+\.[0-9]+\.[0-9]+$' then
    raise exception 'STUDY_CHECKPOINT_READ_INVALID' using errcode = '22023';
  end if;
  select * into session_row
  from public.academy_study_sessions
  where id = p_request ->> 'sessionId'
    and household_id = p_household_id
    and student_id = p_student_id;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1, 'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;
  binding := academy_private.study_session_curriculum_binding_v1(
    session_row.id, p_household_id, p_student_id,
    p_request ->> 'curriculumReleaseVersion'
  );
  if binding ->> 'status' <> 'bound' then return binding; end if;
  if session_row.session_semantics_version <> 2 then
    return jsonb_build_object(
      'schemaVersion', 1, 'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;
  checkpoint := public.academy_study_read_checkpoint(session_row.id);
  return jsonb_build_object(
    'schemaVersion', 2,
    'status', case when checkpoint is null then 'not-found'
      when checkpoint ->> 'status' = 'integrity-failed'
        then 'integrity-failed' else 'found' end,
    'sessionRevision', session_row.revision,
    'currentState', academy_private.study_session_wire_state_v2(
      session_row.state
    ),
    'curriculumBinding', binding,
    'checkpoint', case when checkpoint is null
      or checkpoint ->> 'status' = 'integrity-failed'
      then null else checkpoint end
  );
end;
$$;

create function academy_private.study_compare_and_swap_checkpoint_v2(
  p_household_id uuid,
  p_student_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  stored_result jsonb;
  binding jsonb;
begin
  if auth.uid() is null
     or not public.academy_study_json_has_exact_keys(p_request, array[
       'sessionId', 'expectedRevision', 'mutationId', 'checkpoint',
       'curriculumReleaseVersion'
     ]::text[])
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'sessionId'
     )
     or not public.academy_study_identifier_is_valid(
       p_request ->> 'mutationId'
     )
     or p_request ->> 'expectedRevision' !~ '^[0-9]+$'
     or p_request ->> 'curriculumReleaseVersion' !~
       '^[0-9]+\.[0-9]+\.[0-9]+$'
     or jsonb_typeof(p_request -> 'checkpoint') <> 'object' then
    raise exception 'STUDY_CHECKPOINT_MUTATION_INVALID' using errcode = '22023';
  end if;
  select * into session_row
  from public.academy_study_sessions
  where id = p_request ->> 'sessionId'
    and household_id = p_household_id
    and student_id = p_student_id
  for update;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1, 'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  end if;

  fingerprint := jsonb_build_object('request', p_request);
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || session_row.id
    and operation_kind = 'checkpoint_cas_v2'
    and idempotency_key = p_request ->> 'mutationId';
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'idempotency-collision'
    );
  end if;

  binding := academy_private.study_session_curriculum_binding_v1(
    session_row.id, p_household_id, p_student_id,
    p_request ->> 'curriculumReleaseVersion'
  );
  if binding ->> 'status' <> 'bound' then
    result_value := binding;
  elsif session_row.session_semantics_version <> 2 then
    result_value := jsonb_build_object(
      'schemaVersion', 1, 'status', 'unavailable',
      'reasonCode', 'study-session-unavailable'
    );
  elsif session_row.state in ('completed', 'abandoned') then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'invalid-transition',
      'currentRevision', session_row.revision,
      'currentState', academy_private.study_session_wire_state_v2(
        session_row.state
      ),
      'transitionType', 'checkpoint'
    );
  else
    stored_result := public.academy_study_compare_and_swap_checkpoint(
      session_row.id,
      (p_request ->> 'expectedRevision')::bigint,
      p_request ->> 'mutationId',
      p_request -> 'checkpoint'
    );
    result_value := case stored_result ->> 'status'
      when 'stored' then jsonb_build_object(
        'schemaVersion', 2,
        'status', 'stored',
        'checkpointRevision', (stored_result ->> 'revision')::bigint,
        'sessionRevision', session_row.revision,
        'currentState', academy_private.study_session_wire_state_v2(
          session_row.state
        ),
        'curriculumBinding', binding
      )
      when 'revision-conflict' then jsonb_build_object(
        'schemaVersion', 2,
        'status', 'revision-conflict',
        'currentCheckpointRevision',
          (stored_result ->> 'currentRevision')::bigint,
        'sessionRevision', session_row.revision,
        'currentState', academy_private.study_session_wire_state_v2(
          session_row.state
        )
      )
      else jsonb_build_object(
        'schemaVersion', 2,
        'status', 'invalid-checkpoint',
        'reasonCode', coalesce(
          stored_result #>> '{quarantine,reasonCode}', 'malformed-event'
        )
      )
    end;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || session_row.id,
    'checkpoint_cas_v2',
    p_request ->> 'mutationId',
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_execute_session_lifecycle_v2(
  p_token_digest text,
  p_required_capability text,
  p_operation text,
  p_request jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  grant_row academy_private.student_session_grants%rowtype;
  old_claims text := current_setting('request.jwt.claims', true);
  body jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_operation not in (
       'session:begin', 'session:resume', 'session:transition',
       'checkpoint:read', 'checkpoint:compare-and-swap'
     )
     or p_required_capability <> (case
       when p_operation in ('session:resume', 'checkpoint:read')
         then 'student:progress:read'
       else 'student:attempts:create'
     end) then
    return jsonb_build_object(
      'schemaVersion', 1, 'status', 'denied', 'operation', p_operation
    );
  end if;
  select session_grant.* into grant_row
  from academy_private.student_session_grants as session_grant
  join public.academy_students as student
    on student.id = session_grant.student_id
   and student.household_id = session_grant.household_id
  join public.academy_households as household
    on household.id = session_grant.household_id
  join academy_private.student_access_credentials as credential
    on credential.id = session_grant.credential_id
   and credential.student_id = session_grant.student_id
   and credential.credential_version = session_grant.credential_version
  join public.academy_household_memberships as membership
    on membership.id = session_grant.issuing_membership_id
   and membership.household_id = session_grant.household_id
  join public.academy_guardian_student_access as access
    on access.id = session_grant.issuing_access_id
   and access.household_id = session_grant.household_id
   and access.student_id = session_grant.student_id
   and access.membership_id = session_grant.issuing_membership_id
  where session_grant.token_digest = p_token_digest
    and session_grant.grant_purpose = 'study'
    and session_grant.contract_version = 1
    and session_grant.capabilities @> array[p_required_capability]::text[]
    and session_grant.issuance_flow = 'guardian_activation'
    and session_grant.issued_at <= clock_timestamp()
    and session_grant.revoked_at is null
    and session_grant.expires_at > clock_timestamp()
    and household.status = 'active'
    and student.lifecycle_status = 'active'
    and session_grant.session_version = student.session_version
    and credential.status = 'active'
    and membership.status = 'active'
    and membership.revoked_at is null
    and membership.user_id = session_grant.issued_by
    and access.status = 'active'
    and access.revoked_at is null
    and access.permission_level = 'identity_manager'
  for share of session_grant, student, household, credential, membership, access;
  if grant_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1, 'status', 'denied', 'operation', p_operation
    );
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', grant_row.id,
    'role', 'authenticated',
    'academy_principal_kind', 'student_session_grant'
  )::text, true);
  begin
    body := case p_operation
      when 'session:begin' then academy_private.study_begin_session_v2(
        grant_row.household_id, grant_row.student_id, p_request
      )
      when 'session:resume' then academy_private.study_resume_session_v2(
        grant_row.household_id, grant_row.student_id, p_request
      )
      when 'session:transition' then
        academy_private.study_transition_session_v2(
          grant_row.household_id, grant_row.student_id, p_request
        )
      when 'checkpoint:read' then academy_private.study_read_checkpoint_v2(
        grant_row.household_id, grant_row.student_id, p_request
      )
      when 'checkpoint:compare-and-swap' then
        academy_private.study_compare_and_swap_checkpoint_v2(
          grant_row.household_id, grant_row.student_id, p_request
        )
    end;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ok',
    'operation', p_operation,
    'body', body
  );
end;
$$;

create function public.academy_study_session_semantics_readiness_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  ready boolean;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select metadata.session_semantics_version = 2
    and metadata.migration_names @> array[
      '20260810151000_academy_study_session_semantics_v2'
    ]::text[]
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.academy_study_sessions'::regclass
        and tgname = 'academy_study_sessions_authority_immutable_v2'
        and tgenabled <> 'D'
    )
    and has_function_privilege(
      'service_role',
      'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)',
      'EXECUTE'
    )
  into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  return jsonb_build_object(
    'schemaVersion', 2,
    'status', case when coalesce(ready, false)
      then 'ready' else 'not-ready' end
  );
end;
$$;

alter function academy_private.study_iso_date_is_valid_v2(text)
  owner to postgres;
alter function academy_private.study_settings_provenance_is_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_effective_settings_snapshot_is_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_session_wire_state_v2(text)
  owner to postgres;
alter function academy_private.study_transition_target_state_v2(text, text)
  owner to postgres;
alter function academy_private.study_session_projection_v2(text, uuid, uuid)
  owner to postgres;
alter function academy_private.study_begin_session_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function academy_private.study_resume_session_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function academy_private.study_transition_session_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function academy_private.study_read_checkpoint_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function academy_private.study_compare_and_swap_checkpoint_v2(uuid, uuid, jsonb)
  owner to postgres;
alter function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) owner to postgres;
alter function public.academy_study_session_semantics_readiness_v2()
  owner to postgres;

revoke all on function academy_private.study_iso_date_is_valid_v2(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_settings_provenance_is_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_effective_settings_snapshot_is_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_session_wire_state_v2(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_transition_target_state_v2(text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_session_projection_v2(text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_begin_session_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_resume_session_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_transition_session_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_read_checkpoint_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_compare_and_swap_checkpoint_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) to service_role;
revoke all on function public.academy_study_session_semantics_readiness_v2()
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_session_semantics_readiness_v2()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column session_semantics_version smallint not null default 0
    check (session_semantics_version in (0, 2));
update academy_private.study_persistence_metadata
set session_semantics_version = 2,
    migration_names = array_append(
      migration_names,
      '20260810151000_academy_study_session_semantics_v2'
    )
where singleton;

comment on column public.academy_study_sessions.accepted_at is
  'Immutable trusted-server acceptance timestamp for a V2 production Study session.';
comment on column public.academy_study_sessions.effective_settings_snapshot is
  'Immutable Effective Settings V2 snapshot resolved at authoritative session begin.';
comment on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) is
  'Trusted production Study begin, resume, canonical transition, and checkpoint boundary.';

commit;
