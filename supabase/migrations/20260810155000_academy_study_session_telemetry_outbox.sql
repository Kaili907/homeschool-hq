-- WIN-13: durable, privacy-minimized Study session telemetry outbox.
-- Additive only; depends on Study session semantics V2 and ADMIN telemetry V2.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Study session telemetry outbox migration must run as postgres';
  end if;
  if to_regprocedure(
       'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.academy_record_operational_event_v2(text,jsonb)'
     ) is null
     or to_regprocedure(
       'academy_private.operational_is_trusted_server()'
     ) is null then
    raise exception
      'Study session telemetry outbox requires Study semantics V2 and operational telemetry V2';
  end if;
  if to_regclass('academy_private.study_session_telemetry_outbox') is not null
     or to_regprocedure(
       'academy_private.study_enqueue_session_telemetry_v1(uuid,uuid,text,jsonb,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_claim_study_session_telemetry_outbox_v1(integer,integer)'
     ) is not null then
    raise exception 'Study session telemetry outbox object collision';
  end if;
end;
$$;

-- ADMIN-2 was authored against a provisional learner column named `status`.
-- The integrated Academy identity contract calls it `lifecycle_status`.
-- Preserve the frozen V2 RPC and validation; repair only that column binding.
create or replace function public.academy_record_operational_event_v2(
  p_execution_key text,
  p_facts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_scope text;
  target_household_id uuid;
  target_learner_id uuid;
  target_engine text;
  target_app_version text;
  target_engine_version text;
  target_curriculum_version text;
  target_course_ref text;
  target_unit_ref text;
  target_lesson_ref text;
  target_skill_ref text;
  target_event_type text;
  target_result text;
  target_duration_ms bigint;
  target_metadata jsonb;
  target_retention_category text;
  accepted_at timestamptz;
  existing public.academy_operational_events%rowtype;
  inserted public.academy_operational_events%rowtype;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'OPERATIONAL_TELEMETRY_TRUSTED_SERVER_REQUIRED'
      using errcode = '42501';
  end if;
  if not academy_private.operational_reference_is_valid(p_execution_key)
     or not academy_private.operational_json_has_exact_keys(
       p_facts,
       array[
         'schema_version', 'scope', 'household_id', 'learner_id', 'engine',
         'app_version', 'engine_version', 'curriculum_version', 'course_ref',
         'unit_ref', 'lesson_ref', 'skill_ref', 'event_type', 'result',
         'duration_ms', 'metadata'
       ]::text[]
     )
     or jsonb_typeof(p_facts->'schema_version') <> 'number'
     or p_facts->>'schema_version' <> '2'
     or p_facts->>'scope' not in ('household', 'system')
     or p_facts->>'engine' not in (
       'tutor', 'study', 'assessment', 'curriculum',
       'jarvis', 'tts', 'gateway', 'sync'
     )
     or p_facts->>'event_type' not in (
       'tutor.turn', 'study.session', 'assessment.attempt',
       'curriculum.load', 'jarvis.turn', 'tts.synthesis',
       'gateway.request', 'sync.operation', 'safety.classification',
       'persistence.operation'
     )
     or p_facts->>'result' not in (
       'success', 'fallback', 'rejected', 'timeout', 'provider_error',
       'validation_error', 'safety_stop'
     )
     or not academy_private.operational_version_is_valid(
       p_facts->>'app_version'
     )
     or not academy_private.operational_version_is_valid(
       p_facts->>'engine_version'
     )
     or not academy_private.operational_metadata_is_valid(p_facts->'metadata') then
    raise exception 'OPERATIONAL_EVENT_INVALID' using errcode = '22023';
  end if;

  target_scope := p_facts->>'scope';
  target_household_id := case
    when p_facts->'household_id' = 'null'::jsonb then null
    when academy_private.operational_uuid_text_is_valid(p_facts->>'household_id')
      then (p_facts->>'household_id')::uuid
    else null
  end;
  target_learner_id := case
    when p_facts->'learner_id' = 'null'::jsonb then null
    when academy_private.operational_uuid_text_is_valid(p_facts->>'learner_id')
      then (p_facts->>'learner_id')::uuid
    else null
  end;
  if not academy_private.operational_scope_is_valid(
    target_scope, target_household_id, target_learner_id
  ) or (
    p_facts->'household_id' <> 'null'::jsonb and target_household_id is null
  ) or (
    p_facts->'learner_id' <> 'null'::jsonb and target_learner_id is null
  ) then
    raise exception 'OPERATIONAL_EVENT_SCOPE_INVALID' using errcode = '22023';
  end if;

  target_engine := p_facts->>'engine';
  target_app_version := p_facts->>'app_version';
  target_engine_version := p_facts->>'engine_version';
  target_curriculum_version := case
    when p_facts->'curriculum_version' = 'null'::jsonb then null
    when academy_private.operational_version_is_valid(
      p_facts->>'curriculum_version'
    ) then p_facts->>'curriculum_version'
    else null
  end;
  target_course_ref := case
    when p_facts->'course_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'course_ref')
      then p_facts->>'course_ref'
    else null
  end;
  target_unit_ref := case
    when p_facts->'unit_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'unit_ref')
      then p_facts->>'unit_ref'
    else null
  end;
  target_lesson_ref := case
    when p_facts->'lesson_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'lesson_ref')
      then p_facts->>'lesson_ref'
    else null
  end;
  target_skill_ref := case
    when p_facts->'skill_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'skill_ref')
      then p_facts->>'skill_ref'
    else null
  end;
  if (
    p_facts->'curriculum_version' <> 'null'::jsonb
    and target_curriculum_version is null
  ) or (
    p_facts->'course_ref' <> 'null'::jsonb and target_course_ref is null
  ) or (
    p_facts->'unit_ref' <> 'null'::jsonb and target_unit_ref is null
  ) or (
    p_facts->'lesson_ref' <> 'null'::jsonb and target_lesson_ref is null
  ) or (
    p_facts->'skill_ref' <> 'null'::jsonb and target_skill_ref is null
  ) or (
    target_curriculum_version is null
    and (
      target_course_ref is not null or target_unit_ref is not null
      or target_lesson_ref is not null or target_skill_ref is not null
    )
  ) then
    raise exception 'OPERATIONAL_EVENT_CONTEXT_INVALID' using errcode = '22023';
  end if;

  target_event_type := p_facts->>'event_type';
  target_result := p_facts->>'result';
  if not academy_private.operational_event_engine_is_valid(
    target_event_type, target_engine
  ) or (
    target_event_type = 'curriculum.load' and target_curriculum_version is null
  ) then
    raise exception 'OPERATIONAL_EVENT_ENGINE_INVALID' using errcode = '22023';
  end if;

  if p_facts->'duration_ms' = 'null'::jsonb then
    target_duration_ms := null;
  elsif jsonb_typeof(p_facts->'duration_ms') = 'number'
    and (p_facts->>'duration_ms')::numeric = trunc(
      (p_facts->>'duration_ms')::numeric
    )
    and (p_facts->>'duration_ms')::numeric between 0 and 86400000 then
    target_duration_ms := (p_facts->>'duration_ms')::bigint;
  else
    raise exception 'OPERATIONAL_EVENT_DURATION_INVALID' using errcode = '22023';
  end if;
  target_metadata := p_facts->'metadata';

  if target_scope = 'household' and not exists (
    select 1
    from public.academy_households as household
    where household.id = target_household_id
      and household.status = 'active'
  ) then
    raise exception 'OPERATIONAL_EVENT_HOUSEHOLD_INVALID' using errcode = '22023';
  end if;
  if target_learner_id is not null and not exists (
    select 1
    from public.academy_students as student
    where student.id = target_learner_id
      and student.household_id = target_household_id
      and student.lifecycle_status = 'active'
  ) then
    raise exception 'OPERATIONAL_EVENT_LEARNER_INVALID' using errcode = '22023';
  end if;

  select * into existing
  from public.academy_operational_events
  where execution_key = p_execution_key;
  if existing.event_id is not null then
    if existing.schema_version = 2
       and existing.scope = target_scope
       and existing.household_id is not distinct from target_household_id
       and existing.learner_id is not distinct from target_learner_id
       and existing.engine = target_engine
       and existing.app_version = target_app_version
       and existing.engine_version = target_engine_version
       and existing.curriculum_version is not distinct from target_curriculum_version
       and existing.course_ref is not distinct from target_course_ref
       and existing.unit_ref is not distinct from target_unit_ref
       and existing.lesson_ref is not distinct from target_lesson_ref
       and existing.skill_ref is not distinct from target_skill_ref
       and existing.event_type = target_event_type
       and existing.result = target_result
       and existing.duration_ms is not distinct from target_duration_ms
       and existing.metadata = target_metadata then
      return jsonb_build_object(
        'status', 'replayed',
        'event', academy_private.operational_event_json(existing)
      );
    end if;
    return jsonb_build_object('status', 'reconciliation_conflict');
  end if;

  accepted_at := clock_timestamp();
  target_retention_category := academy_private.operational_retention_category(
    target_event_type, target_result
  );
  insert into public.academy_operational_events (
    event_id, execution_key, schema_version, occurred_at, scope,
    household_id, learner_id, engine, app_version, engine_version,
    curriculum_version, course_ref, unit_ref, lesson_ref, skill_ref,
    event_type, result, duration_ms, metadata, retention_category, expires_at
  ) values (
    gen_random_uuid(), p_execution_key, 2, accepted_at, target_scope,
    target_household_id, target_learner_id, target_engine,
    target_app_version, target_engine_version, target_curriculum_version,
    target_course_ref, target_unit_ref, target_lesson_ref, target_skill_ref,
    target_event_type, target_result, target_duration_ms, target_metadata,
    target_retention_category,
    accepted_at + make_interval(
      days => academy_private.operational_retention_days(
        target_retention_category
      )
    )
  )
  on conflict (execution_key) do nothing
  returning * into inserted;

  if inserted.event_id is not null then
    return jsonb_build_object(
      'status', 'created',
      'event', academy_private.operational_event_json(inserted)
    );
  end if;

  select * into existing
  from public.academy_operational_events
  where execution_key = p_execution_key;
  if existing.scope = target_scope
     and existing.household_id is not distinct from target_household_id
     and existing.learner_id is not distinct from target_learner_id
     and existing.engine = target_engine
     and existing.app_version = target_app_version
     and existing.engine_version = target_engine_version
     and existing.curriculum_version is not distinct from target_curriculum_version
     and existing.course_ref is not distinct from target_course_ref
     and existing.unit_ref is not distinct from target_unit_ref
     and existing.lesson_ref is not distinct from target_lesson_ref
     and existing.skill_ref is not distinct from target_skill_ref
     and existing.event_type = target_event_type
     and existing.result = target_result
     and existing.duration_ms is not distinct from target_duration_ms
     and existing.metadata = target_metadata then
    return jsonb_build_object(
      'status', 'replayed',
      'event', academy_private.operational_event_json(existing)
    );
  end if;
  return jsonb_build_object('status', 'reconciliation_conflict');
end;
$$;

create table academy_private.study_session_telemetry_outbox (
  outbox_id uuid primary key default gen_random_uuid(),
  execution_key text not null unique
    check (academy_private.operational_reference_is_valid(execution_key)),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  session_id text not null
    references public.academy_study_sessions (id) on delete restrict,
  authoritative_operation text not null
    check (authoritative_operation in (
      'session:begin', 'session:resume', 'session:transition',
      'checkpoint:compare-and-swap'
    )),
  operation text not null
    check (operation in (
      'begin', 'resume', 'transition', 'checkpoint', 'complete', 'abandon'
    )),
  result text not null check (result = 'success'),
  session_revision bigint not null check (session_revision > 0),
  checkpoint_revision bigint check (checkpoint_revision > 0),
  accepted_at timestamptz not null,
  curriculum_version text not null
    check (academy_private.operational_version_is_valid(curriculum_version)),
  lesson_ref text not null
    check (academy_private.operational_reference_is_valid(lesson_ref)),
  reason_code text not null check (reason_code in (
    'session-begun', 'session-resumable', 'session-closed',
    'segment-started', 'segment-completed', 'pause-started',
    'session-resumed', 'break-requested', 'break-started', 'break-ended',
    'technical-interruption-started', 'technical-interruption-ended',
    'session-completed', 'session-abandoned', 'checkpoint-saved'
  )),
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'claimed', 'delivered')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  operational_event_id uuid,
  delivered_at timestamptz,
  last_failure_code text check (last_failure_code in (
    'validation_error', 'timeout', 'telemetry_unavailable',
    'reconciliation_conflict'
  )),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint study_session_telemetry_checkpoint_shape check (
    (authoritative_operation = 'checkpoint:compare-and-swap'
      and checkpoint_revision is not null)
    or (authoritative_operation <> 'checkpoint:compare-and-swap'
      and checkpoint_revision is null)
  ),
  constraint study_session_telemetry_delivery_shape check (
    (delivery_state = 'pending'
      and lease_token is null and lease_expires_at is null
      and operational_event_id is null and delivered_at is null)
    or (delivery_state = 'claimed'
      and lease_token is not null and lease_expires_at is not null
      and operational_event_id is null and delivered_at is null)
    or (delivery_state = 'delivered'
      and lease_token is null and lease_expires_at is null
      and operational_event_id is not null and delivered_at is not null)
  ),
  constraint study_session_telemetry_accepted_time_check check (
    accepted_at <= created_at + interval '5 minutes'
  )
);

comment on table academy_private.study_session_telemetry_outbox is
  'Server-private transactional receipts for post-commit Study operational telemetry; contains no learner content or learner identifier.';
comment on column academy_private.study_session_telemetry_outbox.execution_key is
  'Stable server-derived operational event idempotency key; never browser-authored.';
comment on column academy_private.study_session_telemetry_outbox.accepted_at is
  'Trusted Study acceptance time. Operational event occurredAt remains owned by the telemetry ledger at delivery.';

create index study_session_telemetry_outbox_claim_idx
  on academy_private.study_session_telemetry_outbox (
    delivery_state, available_at, lease_expires_at, accepted_at, outbox_id
  )
  where delivery_state <> 'delivered';

alter table academy_private.study_session_telemetry_outbox enable row level security;
alter table academy_private.study_session_telemetry_outbox force row level security;

create function academy_private.study_enqueue_session_telemetry_v1(
  p_household_id uuid,
  p_student_id uuid,
  p_authoritative_operation text,
  p_request jsonb,
  p_result jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  target_session_id text;
  target_operation text;
  target_reason_code text;
  target_revision bigint;
  target_checkpoint_revision bigint;
  target_accepted_at timestamptz;
  target_execution_key text;
  transition_type text;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    return;
  end if;

  if p_authoritative_operation = 'session:begin'
     and p_result ->> 'status' = 'begun' then
    target_session_id := p_result ->> 'sessionId';
    target_operation := 'begin';
    target_reason_code := 'session-begun';
    target_revision := (p_result ->> 'revision')::bigint;
    target_accepted_at := (p_result ->> 'acceptedAt')::timestamptz;
  elsif p_authoritative_operation = 'session:resume'
     and p_result ->> 'status' in ('resumable', 'closed') then
    target_session_id := p_result ->> 'sessionId';
    target_operation := 'resume';
    target_reason_code := case p_result ->> 'status'
      when 'closed' then 'session-closed' else 'session-resumable' end;
    target_revision := (p_result ->> 'revision')::bigint;
    target_accepted_at := clock_timestamp();
  elsif p_authoritative_operation = 'session:transition'
     and p_result ->> 'status' = 'stored' then
    target_session_id := p_result ->> 'sessionId';
    target_revision := (p_result ->> 'revision')::bigint;
    transition_type := p_result #>> '{lastTransition,type}';
    target_operation := case transition_type
      when 'session-completed' then 'complete'
      when 'session-abandoned' then 'abandon'
      when 'session-resumed' then 'resume'
      else 'transition'
    end;
    target_reason_code := transition_type;
    target_accepted_at :=
      (p_result #>> '{lastTransition,acceptedAt}')::timestamptz;
  elsif p_authoritative_operation = 'checkpoint:compare-and-swap'
     and p_result ->> 'status' = 'stored' then
    target_session_id := p_request ->> 'sessionId';
    target_operation := 'checkpoint';
    target_reason_code := 'checkpoint-saved';
    target_revision := (p_result ->> 'sessionRevision')::bigint;
    target_checkpoint_revision :=
      (p_result ->> 'checkpointRevision')::bigint;
    target_accepted_at := clock_timestamp();
  else
    return;
  end if;

  select session.* into session_row
  from public.academy_study_sessions as session
  where session.id = target_session_id
    and session.household_id = p_household_id
    and session.student_id = p_student_id
    and session.session_semantics_version = 2;
  if session_row.id is null or session_row.revision < target_revision then
    raise exception 'STUDY_TELEMETRY_AUTHORITY_INVALID' using errcode = '23514';
  end if;
  if p_authoritative_operation = 'checkpoint:compare-and-swap'
     and not exists (
       select 1
       from public.academy_study_checkpoints as checkpoint
       where checkpoint.session_id = session_row.id
         and checkpoint.household_id = p_household_id
         and checkpoint.student_id = p_student_id
         and checkpoint.revision = target_checkpoint_revision
     ) then
    return;
  end if;
  if target_reason_code not in (
       'session-begun', 'session-resumable', 'session-closed',
       'segment-started', 'segment-completed', 'pause-started',
       'session-resumed', 'break-requested', 'break-started', 'break-ended',
       'technical-interruption-started', 'technical-interruption-ended',
       'session-completed', 'session-abandoned', 'checkpoint-saved'
     ) then
    raise exception 'STUDY_TELEMETRY_REASON_INVALID' using errcode = '23514';
  end if;

  target_execution_key := 'study:session:' ||
    academy_private.study_sha256_json(jsonb_build_object(
      'sessionId', session_row.id,
      'authoritativeOperation', p_authoritative_operation,
      'operation', target_operation,
      'sessionRevision', target_revision,
      'checkpointRevision', target_checkpoint_revision
    ));

  insert into academy_private.study_session_telemetry_outbox (
    execution_key, household_id, session_id, authoritative_operation,
    operation, result, session_revision, checkpoint_revision, accepted_at,
    curriculum_version, lesson_ref, reason_code
  ) values (
    target_execution_key, p_household_id, session_row.id,
    p_authoritative_operation, target_operation, 'success', target_revision,
    target_checkpoint_revision, target_accepted_at,
    session_row.curriculum_release_version, session_row.lesson_id,
    target_reason_code
  ) on conflict (execution_key) do nothing;
end;
$$;

create or replace function public.academy_study_execute_session_lifecycle_v2(
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
    perform academy_private.study_enqueue_session_telemetry_v1(
      grant_row.household_id,
      grant_row.student_id,
      p_operation,
      p_request,
      body
    );
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

create function public.academy_claim_study_session_telemetry_outbox_v1(
  p_limit integer default 25,
  p_lease_seconds integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  claimed jsonb;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'STUDY_TELEMETRY_WORKER_REQUIRED' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or p_lease_seconds is null or p_lease_seconds < 5
     or p_lease_seconds > 300 then
    raise exception 'STUDY_TELEMETRY_CLAIM_INVALID' using errcode = '22023';
  end if;

  with candidates as (
    select item.outbox_id
    from academy_private.study_session_telemetry_outbox as item
    where item.delivery_state <> 'delivered'
      and item.available_at <= statement_timestamp()
      and (
        item.delivery_state = 'pending'
        or item.lease_expires_at <= statement_timestamp()
      )
    order by item.accepted_at, item.outbox_id
    for update skip locked
    limit p_limit
  ), updated as (
    update academy_private.study_session_telemetry_outbox as item
    set delivery_state = 'claimed',
        attempt_count = item.attempt_count + 1,
        lease_token = gen_random_uuid(),
        lease_expires_at = statement_timestamp()
          + make_interval(secs => p_lease_seconds),
        updated_at = statement_timestamp()
    from candidates
    where item.outbox_id = candidates.outbox_id
    returning item.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outboxId', item.outbox_id,
    'executionKey', item.execution_key,
    'householdRef', item.household_id,
    'authoritativeOperation', item.authoritative_operation,
    'operation', item.operation,
    'result', item.result,
    'sessionRevision', item.session_revision,
    'checkpointRevision', item.checkpoint_revision,
    'acceptedAt', to_char(item.accepted_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'curriculumVersion', item.curriculum_version,
    'lessonRef', item.lesson_ref,
    'reasonCode', item.reason_code,
    'attemptCount', item.attempt_count,
    'leaseToken', item.lease_token
  ) order by item.accepted_at, item.outbox_id), '[]'::jsonb)
  into claimed
  from updated as item;
  return claimed;
end;
$$;

create function public.academy_complete_study_session_telemetry_outbox_v1(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_operational_event_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'STUDY_TELEMETRY_WORKER_REQUIRED' using errcode = '42501';
  end if;
  update academy_private.study_session_telemetry_outbox
  set delivery_state = 'delivered',
      operational_event_id = p_operational_event_id,
      delivered_at = statement_timestamp(),
      lease_token = null,
      lease_expires_at = null,
      last_failure_code = null,
      updated_at = statement_timestamp()
  where outbox_id = p_outbox_id
    and delivery_state = 'claimed'
    and lease_token = p_lease_token;
  return found;
end;
$$;

create function public.academy_retry_study_session_telemetry_outbox_v1(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_failure_code text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'STUDY_TELEMETRY_WORKER_REQUIRED' using errcode = '42501';
  end if;
  if p_failure_code not in (
       'validation_error', 'timeout', 'telemetry_unavailable',
       'reconciliation_conflict'
     ) then
    raise exception 'STUDY_TELEMETRY_FAILURE_INVALID' using errcode = '22023';
  end if;
  update academy_private.study_session_telemetry_outbox
  set delivery_state = 'pending',
      available_at = statement_timestamp() + make_interval(
        secs => least(300, 5 * power(2, least(attempt_count - 1, 6))::integer)
      ),
      lease_token = null,
      lease_expires_at = null,
      last_failure_code = p_failure_code,
      updated_at = statement_timestamp()
  where outbox_id = p_outbox_id
    and delivery_state = 'claimed'
    and lease_token = p_lease_token;
  return found;
end;
$$;

create function public.academy_study_session_telemetry_outbox_readiness_v1()
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
     or not academy_private.operational_is_trusted_server() then
    raise exception 'STUDY_TELEMETRY_WORKER_REQUIRED' using errcode = '42501';
  end if;
  select metadata.session_telemetry_outbox_version = 1
    and metadata.migration_names @> array[
      '20260810155000_academy_study_session_telemetry_outbox'
    ]::text[]
    and c.relrowsecurity and c.relforcerowsecurity
    and has_function_privilege(
      'service_role',
      'public.academy_claim_study_session_telemetry_outbox_v1(integer,integer)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.academy_claim_study_session_telemetry_outbox_v1(integer,integer)',
      'EXECUTE'
    )
  into ready
  from academy_private.study_persistence_metadata as metadata
  cross join pg_catalog.pg_class as c
  where metadata.singleton
    and c.oid = 'academy_private.study_session_telemetry_outbox'::regclass;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when coalesce(ready, false)
      then 'ready' else 'not-ready' end
  );
end;
$$;

alter table academy_private.study_session_telemetry_outbox owner to postgres;
alter function academy_private.study_enqueue_session_telemetry_v1(
  uuid, uuid, text, jsonb, jsonb
) owner to postgres;
alter function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) owner to postgres;
alter function public.academy_claim_study_session_telemetry_outbox_v1(
  integer, integer
) owner to postgres;
alter function public.academy_complete_study_session_telemetry_outbox_v1(
  uuid, uuid, uuid
) owner to postgres;
alter function public.academy_retry_study_session_telemetry_outbox_v1(
  uuid, uuid, text
) owner to postgres;
alter function public.academy_study_session_telemetry_outbox_readiness_v1()
  owner to postgres;

revoke all on table academy_private.study_session_telemetry_outbox
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_enqueue_session_telemetry_v1(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb
) to service_role;
revoke all on function public.academy_claim_study_session_telemetry_outbox_v1(
  integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.academy_claim_study_session_telemetry_outbox_v1(
  integer, integer
) to service_role;
revoke all on function public.academy_complete_study_session_telemetry_outbox_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.academy_complete_study_session_telemetry_outbox_v1(
  uuid, uuid, uuid
) to service_role;
revoke all on function public.academy_retry_study_session_telemetry_outbox_v1(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_retry_study_session_telemetry_outbox_v1(
  uuid, uuid, text
) to service_role;
revoke all on function public.academy_study_session_telemetry_outbox_readiness_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_session_telemetry_outbox_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column session_telemetry_outbox_version smallint not null default 0
    check (session_telemetry_outbox_version in (0, 1));
update academy_private.study_persistence_metadata
set session_telemetry_outbox_version = 1,
    migration_names = array_append(
      migration_names,
      '20260810155000_academy_study_session_telemetry_outbox'
    )
where singleton;

comment on function public.academy_claim_study_session_telemetry_outbox_v1(
  integer, integer
) is
  'Service-only lease-safe claim for post-commit Study operational telemetry delivery.';
comment on function public.academy_complete_study_session_telemetry_outbox_v1(
  uuid, uuid, uuid
) is
  'Service-only durable acknowledgement of an idempotently recorded operational event.';
comment on function public.academy_retry_study_session_telemetry_outbox_v1(
  uuid, uuid, text
) is
  'Service-only bounded retry transition; never stores raw exception or database text.';

commit;
