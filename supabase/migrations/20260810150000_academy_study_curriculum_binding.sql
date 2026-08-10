begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study curriculum binding migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.storage_version <> 1
     or marker.authorization_version <> 1
     or marker.final_production_version <> 1
     or marker.effective_settings_version <> 2 then
    raise exception 'Study curriculum binding prerequisite mismatch';
  end if;
  if to_regclass('academy_private.study_curriculum_release_approvals') is not null
     or to_regprocedure(
       'public.academy_study_resolve_curriculum_binding_v1(uuid,text,date,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_curriculum_binding_readiness_v1()'
     ) is not null then
    raise exception 'Study curriculum binding object collision';
  end if;
end;
$$;

-- Study approval is deliberately separate from a mutable active pointer. A
-- published release must be explicitly approved here before a production
-- session may bind to it. This migration does not add an Admin mutation path.
create table academy_private.study_curriculum_release_approvals (
  release_id uuid primary key,
  binding_schema_version smallint not null default 1
    check (binding_schema_version = 1),
  package_id text not null
    check (package_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  release_version text not null unique
    check (release_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  curriculum_manifest_sha256 text not null
    check (curriculum_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  approval_state text not null check (approval_state = 'approved'),
  approval_basis text not null
    check (approval_basis = 'published-immutable-package'),
  approved_at timestamptz not null,
  unique (
    release_id,
    package_id,
    release_version,
    curriculum_manifest_sha256
  )
);

alter table academy_private.study_curriculum_release_approvals owner to postgres;
alter table academy_private.study_curriculum_release_approvals enable row level security;
alter table academy_private.study_curriculum_release_approvals force row level security;
revoke all on table academy_private.study_curriculum_release_approvals
  from public, anon, authenticated, service_role;

create function academy_private.study_curriculum_release_approval_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Approved Study curriculum releases are immutable';
end;
$$;

alter function academy_private.study_curriculum_release_approval_immutable()
  owner to postgres;
revoke all on function academy_private.study_curriculum_release_approval_immutable()
  from public, anon, authenticated, service_role;

create trigger study_curriculum_release_approvals_immutable
  before update or delete
  on academy_private.study_curriculum_release_approvals
  for each row execute function
    academy_private.study_curriculum_release_approval_immutable();

-- These identifiers and digests match the immutable ADMIN-16A release custody
-- contract. The Study row is an approval for use, not a replacement release
-- registry or an activation pointer.
insert into academy_private.study_curriculum_release_approvals (
  release_id,
  package_id,
  release_version,
  curriculum_manifest_sha256,
  approval_state,
  approval_basis,
  approved_at
) values (
  '16000000-0000-4000-8000-000000000001',
  'manuel-academy-grades-5-7-8-curriculum-v1',
  '1.0.0',
  '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b',
  'approved',
  'published-immutable-package',
  '2026-08-10 15:00:00+00'
);

alter table public.academy_study_sessions
  add column curriculum_binding_schema_version smallint,
  add column curriculum_release_id uuid,
  add column curriculum_package_id text,
  add column curriculum_release_version text,
  add column curriculum_manifest_sha256 text;

alter table public.academy_study_sessions
  add constraint academy_study_sessions_curriculum_binding_shape check (
    (
      curriculum_binding_schema_version is null
      and curriculum_release_id is null
      and curriculum_package_id is null
      and curriculum_release_version is null
      and curriculum_manifest_sha256 is null
    )
    or (
      curriculum_binding_schema_version = 1
      and curriculum_release_id is not null
      and curriculum_package_id is not null
      and curriculum_release_version is not null
      and curriculum_manifest_sha256 is not null
    )
  ),
  add constraint academy_study_sessions_curriculum_binding_fk
    foreign key (
      curriculum_release_id,
      curriculum_package_id,
      curriculum_release_version,
      curriculum_manifest_sha256
    ) references academy_private.study_curriculum_release_approvals (
      release_id,
      package_id,
      release_version,
      curriculum_manifest_sha256
    ) on update restrict on delete restrict;

create function academy_private.study_session_curriculum_binding_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.curriculum_binding_schema_version is distinct from
       new.curriculum_binding_schema_version
     or old.curriculum_release_id is distinct from new.curriculum_release_id
     or old.curriculum_package_id is distinct from new.curriculum_package_id
     or old.curriculum_release_version is distinct from
       new.curriculum_release_version
     or old.curriculum_manifest_sha256 is distinct from
       new.curriculum_manifest_sha256 then
    raise exception 'Study session curriculum binding is immutable';
  end if;
  return new;
end;
$$;

alter function academy_private.study_session_curriculum_binding_immutable()
  owner to postgres;
revoke all on function academy_private.study_session_curriculum_binding_immutable()
  from public, anon, authenticated, service_role;

create trigger academy_study_sessions_curriculum_binding_immutable
  before update of
    curriculum_binding_schema_version,
    curriculum_release_id,
    curriculum_package_id,
    curriculum_release_version,
    curriculum_manifest_sha256
  on public.academy_study_sessions
  for each row execute function
    academy_private.study_session_curriculum_binding_immutable();

create function academy_private.study_resolve_curriculum_binding_internal_v1(
  p_student_id uuid,
  p_subject_id text,
  p_intended_local_date date,
  p_requested_release_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  approval academy_private.study_curriculum_release_approvals%rowtype;
  enrollment_release_version text;
  enrollment_release_count integer;
begin
  if p_student_id is null
     or p_subject_id is null
     or not public.academy_study_identifier_is_valid(p_subject_id)
     or p_intended_local_date is null
     or p_requested_release_version is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-missing'
    );
  end if;
  if p_requested_release_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unsupported'
    );
  end if;

  select * into approval
  from academy_private.study_curriculum_release_approvals
  where release_version = p_requested_release_version
    and approval_state = 'approved';
  if approval.release_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unsupported'
    );
  end if;

  select
    count(distinct btrim(enrollment.curriculum_version))::integer,
    min(btrim(enrollment.curriculum_version))
  into enrollment_release_count, enrollment_release_version
  from public.academy_subject_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.enrollment_status = 'active'
    and enrollment.curriculum_version is not null
    and btrim(enrollment.curriculum_version) <> ''
    and (enrollment.starts_on is null
      or enrollment.starts_on <= p_intended_local_date)
    and (enrollment.ends_on is null
      or enrollment.ends_on >= p_intended_local_date)
    and (
      enrollment.subject_key = p_subject_id
      or (p_subject_id = 'math'
        and enrollment.subject_key = 'mathematics')
      or (p_subject_id in ('reading', 'writing')
        and enrollment.subject_key = 'english-language-arts')
    );

  if enrollment_release_count = 0 then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unavailable'
    );
  end if;
  if enrollment_release_count <> 1
     or enrollment_release_version <> p_requested_release_version then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-mismatch'
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'bound',
    'releaseId', approval.release_id,
    'packageId', approval.package_id,
    'releaseVersion', approval.release_version,
    'curriculumManifestSha256', approval.curriculum_manifest_sha256
  );
end;
$$;

alter function academy_private.study_resolve_curriculum_binding_internal_v1(
  uuid, text, date, text
) owner to postgres;
revoke all on function
  academy_private.study_resolve_curriculum_binding_internal_v1(
    uuid, text, date, text
  ) from public, anon, authenticated, service_role;

create function public.academy_study_resolve_curriculum_binding_v1(
  p_student_id uuid,
  p_subject_id text,
  p_intended_local_date date,
  p_requested_release_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  perform academy_private.study_authorized_household(
    p_student_id,
    'student:attempts:create',
    false
  );
  return academy_private.study_resolve_curriculum_binding_internal_v1(
    p_student_id,
    p_subject_id,
    p_intended_local_date,
    p_requested_release_version
  );
end;
$$;

alter function public.academy_study_resolve_curriculum_binding_v1(
  uuid, text, date, text
) owner to postgres;
revoke all on function public.academy_study_resolve_curriculum_binding_v1(
  uuid, text, date, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_study_resolve_curriculum_binding_v1(
  uuid, text, date, text
) to authenticated;

create function academy_private.study_session_curriculum_binding_v1(
  p_session_id text,
  p_household_id uuid,
  p_student_id uuid,
  p_requested_release_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
begin
  select * into session_row
  from public.academy_study_sessions
  where id = p_session_id
    and household_id = p_household_id
    and student_id = p_student_id;
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
  if p_requested_release_version is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-missing'
    );
  end if;
  if session_row.curriculum_release_version <>
       p_requested_release_version then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-mismatch'
    );
  end if;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'bound',
    'releaseId', session_row.curriculum_release_id,
    'packageId', session_row.curriculum_package_id,
    'releaseVersion', session_row.curriculum_release_version,
    'curriculumManifestSha256', session_row.curriculum_manifest_sha256
  );
end;
$$;

alter function academy_private.study_session_curriculum_binding_v1(
  text, uuid, uuid, text
) owner to postgres;
revoke all on function academy_private.study_session_curriculum_binding_v1(
  text, uuid, uuid, text
) from public, anon, authenticated, service_role;

create or replace function public.academy_study_create_session(
  p_session jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_household_id uuid;
  target_student_id uuid;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  binding jsonb;
  is_student_actor boolean;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_session is null
     or jsonb_typeof(p_session) <> 'object'
     or not (p_session ? 'curriculum_release_version')
     or p_session ->> 'curriculum_release_version' is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-missing'
    );
  end if;
  if not public.academy_study_json_has_exact_keys(
      p_session,
      array[
        'id', 'schema_version', 'student_id', 'lesson_id', 'subject_id',
        'study_plan_id', 'state', 'started_at', 'completed_at',
        'intended_local_date', 'curriculum_release_version'
      ]::text[]
    )
    or not public.academy_study_payload_is_minimized(p_session, 8192)
    or p_session ->> 'schema_version' <> '1'
    or not public.academy_study_identifier_is_valid(p_session ->> 'id')
    or not public.academy_study_identifier_is_valid(p_session ->> 'lesson_id')
    or not public.academy_study_identifier_is_valid(p_session ->> 'subject_id')
    or not public.academy_study_identifier_is_valid(p_idempotency_key) then
    raise exception 'STUDY_SESSION_INVALID' using errcode = '22023';
  end if;
  target_student_id := (p_session ->> 'student_id')::uuid;
  target_household_id := academy_private.study_authorized_household(
    target_student_id,
    'student:attempts:create',
    false
  );
  if not exists (
    select 1 from public.academy_study_household_settings
    where household_id = target_household_id
  ) then
    raise exception 'STUDY_HOUSEHOLD_TIMEZONE_REQUIRED' using errcode = '23514';
  end if;

  fingerprint := jsonb_build_object('session', p_session);
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || (p_session ->> 'id')
    and operation_kind = 'session_create_v1'
    and idempotency_key = p_idempotency_key;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  if exists (
    select 1 from public.academy_study_sessions
    where id = p_session ->> 'id'
  ) then
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  binding := academy_private.study_resolve_curriculum_binding_internal_v1(
    target_student_id,
    p_session ->> 'subject_id',
    (p_session ->> 'intended_local_date')::date,
    p_session ->> 'curriculum_release_version'
  );
  if binding ->> 'status' <> 'bound' then
    return binding;
  end if;

  is_student_actor := academy_private.study_jwt_claim_text(
    'academy_principal_kind'
  ) = 'student_session_grant';
  insert into public.academy_study_sessions (
    id, schema_version, household_id, student_id, lesson_id, subject_id,
    study_plan_id, state, started_at, completed_at,
    intended_local_date, household_timezone, created_by,
    curriculum_binding_schema_version, curriculum_release_id,
    curriculum_package_id, curriculum_release_version,
    curriculum_manifest_sha256
  ) values (
    p_session ->> 'id',
    1,
    target_household_id,
    target_student_id,
    p_session ->> 'lesson_id',
    p_session ->> 'subject_id',
    p_session ->> 'study_plan_id',
    p_session ->> 'state',
    (p_session ->> 'started_at')::timestamptz,
    (p_session ->> 'completed_at')::timestamptz,
    (p_session ->> 'intended_local_date')::date,
    'UTC',
    case when is_student_actor then null else auth.uid() end,
    1,
    (binding ->> 'releaseId')::uuid,
    binding ->> 'packageId',
    binding ->> 'releaseVersion',
    binding ->> 'curriculumManifestSha256'
  );
  result_value := jsonb_build_object(
    'status', 'created',
    'sessionId', p_session ->> 'id',
    'revision', 1,
    'curriculumBinding', binding
  );
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || (p_session ->> 'id'),
    'session_create_v1',
    p_idempotency_key,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  perform academy_private.study_append_audit(
    target_household_id,
    target_student_id,
    'session.start',
    'session',
    p_session ->> 'id',
    null,
    correlation,
    jsonb_build_object('revision', 1, 'result_code', 'created')
  );
  return result_value;
end;
$$;

-- Recompose the verified gateway so browser curriculum context stays advisory:
-- the server injects the verified student and resolves the approved binding.
create or replace function public.academy_study_execute_verified_runtime_v1(
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
  session_payload jsonb;
  binding jsonb;
  checkpoint jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_operation not in (
       'dashboard:read', 'calendar:read', 'session:begin',
       'session:transition', 'checkpoint:read', 'checkpoint:compare-and-swap'
     )
     or p_required_capability <> (case
       when p_operation in ('dashboard:read', 'checkpoint:read') then
         'student:progress:read'
       when p_operation = 'calendar:read' then 'student:assignments:read'
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
    case p_operation
      when 'dashboard:read' then
        if p_request <> '{}'::jsonb then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := (select jsonb_build_object(
          'sessions', coalesce(jsonb_agg(jsonb_build_object(
            'sessionId', session.id,
            'state', session.state,
            'lessonId', session.lesson_id,
            'revision', session.revision,
            'updatedAt', session.updated_at,
            'curriculumBinding', case
              when session.curriculum_binding_schema_version is null then
                jsonb_build_object(
                  'schemaVersion', 1,
                  'status', 'manual-review',
                  'reasonCode', 'legacy-curriculum-binding-ambiguous'
                )
              else jsonb_build_object(
                'schemaVersion', 1,
                'status', 'bound',
                'releaseId', session.curriculum_release_id,
                'packageId', session.curriculum_package_id,
                'releaseVersion', session.curriculum_release_version,
                'curriculumManifestSha256',
                  session.curriculum_manifest_sha256
              )
            end
          ) order by session.updated_at desc), '[]'::jsonb))
        from (
          select * from public.academy_study_sessions
          where household_id = grant_row.household_id
            and student_id = grant_row.student_id
          order by updated_at desc limit 50
        ) as session);
      when 'calendar:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['cursor']::text[]
        ) or (p_request ->> 'cursor' is not null
          and not public.academy_study_identifier_is_valid(
            p_request ->> 'cursor'
          )) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := (select jsonb_build_object(
          'blocks', coalesce(jsonb_agg(jsonb_build_object(
            'blockId', block.id,
            'blockType', block.block_type,
            'sourceReference', block.source_reference,
            'scheduledStart', block.scheduled_start,
            'intendedLocalDate', block.intended_local_date,
            'state', block.state,
            'revision', block.revision,
            'resumeSessionId', block.resume_session_id,
            'resumeSegmentId', block.resume_segment_id,
            'resumeCurriculumBinding', case
              when block.resume_session_id is null then null
              when block.curriculum_binding_schema_version is null then
                jsonb_build_object(
                  'schemaVersion', 1,
                  'status', 'manual-review',
                  'reasonCode', 'legacy-curriculum-binding-ambiguous'
                )
              else jsonb_build_object(
                'schemaVersion', 1,
                'status', 'bound',
                'releaseId', block.curriculum_release_id,
                'packageId', block.curriculum_package_id,
                'releaseVersion', block.curriculum_release_version,
                'curriculumManifestSha256',
                  block.curriculum_manifest_sha256
              )
            end
          ) order by block.scheduled_start), '[]'::jsonb))
        from (
          select calendar.*,
            session.curriculum_binding_schema_version,
            session.curriculum_release_id,
            session.curriculum_package_id,
            session.curriculum_release_version,
            session.curriculum_manifest_sha256
          from public.academy_study_calendar_blocks as calendar
          left join public.academy_study_sessions as session
            on session.id = calendar.resume_session_id
           and session.household_id = calendar.household_id
           and session.student_id = calendar.student_id
          where calendar.household_id = grant_row.household_id
            and calendar.student_id = grant_row.student_id
            and (p_request ->> 'cursor' is null
              or calendar.id > p_request ->> 'cursor')
          order by calendar.scheduled_start limit 100
        ) as block);
      when 'session:begin' then
        if not public.academy_study_json_has_exact_keys(
          p_request,
          array['session', 'idempotencyKey', 'curriculumContext']::text[]
        )
        or jsonb_typeof(p_request -> 'session') <> 'object'
        or jsonb_typeof(p_request -> 'curriculumContext') <> 'object'
        or not public.academy_study_json_has_exact_keys(
          p_request -> 'session',
          array[
            'id', 'schema_version', 'lesson_id', 'subject_id',
            'study_plan_id', 'state', 'started_at', 'completed_at',
            'intended_local_date'
          ]::text[]
        )
        or not public.academy_study_json_has_exact_keys(
          p_request -> 'curriculumContext',
          array['releaseVersion', 'lessonRef', 'skillRefs']::text[]
        )
        or p_request #>> '{curriculumContext,lessonRef}' <>
          p_request #>> '{session,lesson_id}'
        or jsonb_typeof(
          p_request #> '{curriculumContext,skillRefs}'
        ) <> 'array'
        or jsonb_array_length(
          p_request #> '{curriculumContext,skillRefs}'
        ) > 64
        or exists (
          select 1
          from jsonb_array_elements_text(
            p_request #> '{curriculumContext,skillRefs}'
          ) as skill(value)
          where not public.academy_study_identifier_is_valid(skill.value)
        )
        or not public.academy_study_identifier_is_valid(
          p_request #>> '{curriculumContext,lessonRef}'
        ) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        session_payload := (p_request -> 'session') || jsonb_build_object(
          'student_id', grant_row.student_id,
          'curriculum_release_version',
            p_request #>> '{curriculumContext,releaseVersion}'
        );
        body := public.academy_study_create_session(
          session_payload, p_request ->> 'idempotencyKey'
        );
      when 'session:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId', 'expectedRevision', 'state', 'completedAt',
          'idempotencyKey', 'curriculumReleaseVersion'
        ]::text[]) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        binding := academy_private.study_session_curriculum_binding_v1(
          p_request ->> 'sessionId',
          grant_row.household_id,
          grant_row.student_id,
          p_request ->> 'curriculumReleaseVersion'
        );
        if binding ->> 'status' <> 'bound' then
          body := binding;
        else
          body := public.academy_study_transition_session(
            p_request ->> 'sessionId',
            (p_request ->> 'expectedRevision')::bigint,
            p_request ->> 'state',
            (p_request ->> 'completedAt')::timestamptz,
            p_request ->> 'idempotencyKey'
          ) || jsonb_build_object('curriculumBinding', binding);
        end if;
      when 'checkpoint:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request,
          array['sessionId', 'curriculumReleaseVersion']::text[]
        ) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        binding := academy_private.study_session_curriculum_binding_v1(
          p_request ->> 'sessionId',
          grant_row.household_id,
          grant_row.student_id,
          p_request ->> 'curriculumReleaseVersion'
        );
        if binding ->> 'status' <> 'bound' then
          body := binding;
        else
          checkpoint := public.academy_study_read_checkpoint(
            p_request ->> 'sessionId'
          );
          body := case when checkpoint is null then jsonb_build_object(
            'status', 'not-found', 'curriculumBinding', binding
          ) else checkpoint || jsonb_build_object(
            'curriculumBinding', binding
          ) end;
        end if;
      when 'checkpoint:compare-and-swap' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId', 'expectedRevision', 'mutationId', 'checkpoint',
          'curriculumReleaseVersion'
        ]::text[]) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        binding := academy_private.study_session_curriculum_binding_v1(
          p_request ->> 'sessionId',
          grant_row.household_id,
          grant_row.student_id,
          p_request ->> 'curriculumReleaseVersion'
        );
        if binding ->> 'status' <> 'bound' then
          body := binding;
        else
          body := public.academy_study_compare_and_swap_checkpoint(
            p_request ->> 'sessionId',
            (p_request ->> 'expectedRevision')::bigint,
            p_request ->> 'mutationId',
            p_request -> 'checkpoint'
          ) || jsonb_build_object('curriculumBinding', binding);
        end if;
    end case;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ok',
    'operation', p_operation,
    'body', coalesce(body, 'null'::jsonb)
  );
end;
$$;

create function public.academy_study_curriculum_binding_readiness_v1()
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
  select metadata.curriculum_binding_version = 1
    and metadata.migration_names @> array[
      '20260810150000_academy_study_curriculum_binding'
    ]::text[]
    and (select count(*) = 1
      from academy_private.study_curriculum_release_approvals
      where release_version = '1.0.0'
        and approval_state = 'approved'
        and curriculum_manifest_sha256 =
          '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b')
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.academy_study_sessions'::regclass
        and tgname = 'academy_study_sessions_curriculum_binding_immutable'
        and tgenabled <> 'D'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid =
        'academy_private.study_curriculum_release_approvals'::regclass
        and tgname = 'study_curriculum_release_approvals_immutable'
        and tgenabled <> 'D'
    )
    and has_function_privilege(
      'authenticated',
      'public.academy_study_resolve_curriculum_binding_v1(uuid,text,date,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.academy_study_resolve_curriculum_binding_v1(uuid,text,date,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)',
      'EXECUTE'
    )
  into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when coalesce(ready, false)
      then 'ready' else 'not-ready' end
  );
end;
$$;

alter function public.academy_study_curriculum_binding_readiness_v1()
  owner to postgres;
revoke all on function public.academy_study_curriculum_binding_readiness_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_curriculum_binding_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column curriculum_binding_version smallint not null default 0
    check (curriculum_binding_version in (0, 1));
update academy_private.study_persistence_metadata
set curriculum_binding_version = 1,
    migration_names = array_append(
      migration_names,
      '20260810150000_academy_study_curriculum_binding'
    )
where singleton;

comment on table academy_private.study_curriculum_release_approvals is
  'Immutable releases approved for authoritative production Study session binding.';
comment on column public.academy_study_sessions.curriculum_release_version is
  'Immutable server-resolved curriculum release version; null only for legacy ambiguous sessions.';
comment on function public.academy_study_resolve_curriculum_binding_v1(
  uuid, text, date, text
) is
  'Resolves browser advisory release context against server approval and active learner enrollment.';

commit;
