-- Production learner-session SQL wire.
--
-- This forward migration supplies the narrow server-side operations needed by
-- the production learner-session adapters.  It does not mount a route, compose
-- an adapter, enable Study, or mutate hosted state.  Every learner association
-- is recovered from the current verified student-session grant; no household or
-- student identifier is accepted by any production operation.
--
-- The public operation functions are deliberately executable by no API role.
-- academy_study_execute_verified_runtime_v2 is the sole service-role entry
-- point.  It verifies the opaque grant, installs a transaction-local learner
-- principal, and the called operation rebinds its target to that principal.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if not found
     or marker.storage_version is distinct from 1
     or marker.authorization_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.actor_binding_version is distinct from 1
     or marker.academic_readiness_version is distinct from 1
     or marker.learner_runtime_operations_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260808120000_academy_study_actor_bound_session_verification',
       '20260808150000_academy_study_academic_readiness_contract',
       '20260809120000_academy_study_learner_runtime_operations'
     ]::text[])
     or coalesce(marker.security_manifest, '{}'::jsonb) @> jsonb_build_object(
       'academic_readiness_version', 1,
       'learner_runtime_operations_version', 1
     ) is not true then
    raise exception 'STUDY_PRODUCTION_WIRE predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260810120000_academy_study_production_wire_contract_v1'
     ]::text[] then
    raise exception 'STUDY_PRODUCTION_WIRE already applied';
  end if;

  if to_regclass('academy_private.study_production_sessions') is not null
     or to_regclass('academy_private.study_production_session_checkpoints') is not null
     or to_regclass('academy_private.study_production_calendar_segments') is not null
     or to_regprocedure('academy_private.study_production_current_binding(text)') is not null
     or to_regprocedure('academy_private.study_production_session_request_is_valid(jsonb)') is not null
     or to_regprocedure('academy_private.study_production_checkpoint_is_valid(jsonb)') is not null
     or to_regprocedure('academy_private.study_production_session_integrity(academy_private.study_production_sessions)') is not null
     or to_regprocedure('academy_private.study_production_checkpoint_integrity(academy_private.study_production_session_checkpoints)') is not null
     or to_regprocedure('academy_private.study_set_production_session_integrity()') is not null
     or to_regprocedure('academy_private.study_set_production_checkpoint_integrity()') is not null
     or to_regprocedure('academy_private.study_production_session_ownership_guard()') is not null
     or to_regprocedure('academy_private.study_production_calendar_block_json(public.academy_study_calendar_blocks)') is not null
     or to_regprocedure('academy_private.study_production_runtime_operation_contract()') is not null
     or to_regprocedure('public.academy_study_begin_production_session_v1(jsonb,text)') is not null
     or to_regprocedure('public.academy_study_read_production_session_v1(text)') is not null
     or to_regprocedure('public.academy_study_transition_production_session_v1(text,bigint,text,text,text,timestamptz,text)') is not null
     or to_regprocedure('public.academy_study_read_session_checkpoint_v1(text)') is not null
     or to_regprocedure('public.academy_study_compare_and_swap_session_checkpoint_v1(text,bigint,text,jsonb)') is not null
     or to_regprocedure('public.academy_study_list_production_calendar_v1(text)') is not null
     or to_regprocedure('public.academy_study_read_production_calendar_block_v1(text)') is not null
     or to_regprocedure('public.academy_study_transition_calendar_block_v2(text,bigint,text,timestamptz,text,text)') is not null
     or to_regprocedure('public.academy_study_complete_calendar_segment_v1(text,text,bigint,timestamptz,text)') is not null
     or to_regprocedure('public.academy_study_execute_verified_runtime_v2(text,text,text,jsonb)') is not null
     or to_regprocedure('public.academy_study_production_wire_readiness_v1()') is not null then
    raise exception 'STUDY_PRODUCTION_WIRE object collision';
  end if;

  if to_regprocedure(
       'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.academy_study_append_learner_event_v1(text,text,text,jsonb,text)'
     ) is null
     or not exists (
       select 1
       from pg_catalog.pg_constraint
       where conrelid = 'public.academy_study_calendar_blocks'::regclass
         and conname = 'academy_study_calendar_blocks_state_check'
     ) then
    raise exception 'STUDY_PRODUCTION_WIRE predecessor object mismatch';
  end if;
end;
$$;

-- A production pause is durable state, not an alias for available/scheduled.
alter table public.academy_study_calendar_blocks
  drop constraint academy_study_calendar_blocks_state_check;
alter table public.academy_study_calendar_blocks
  add constraint academy_study_calendar_blocks_state_check
    check (state in (
      'scheduled', 'available', 'in_progress', 'paused', 'completed', 'cancelled'
    ));
alter table public.academy_study_calendar_blocks
  add constraint academy_study_calendar_blocks_scope_key
    unique (id, household_id, student_id);

-- The production session projection intentionally carries only fields the
-- learner-session port reads.  Broader durable session states remain in the
-- historical table but cannot enter this closed status vocabulary.
create table academy_private.study_production_sessions (
  session_id text primary key
    check (public.academy_study_identifier_is_valid(session_id)),
  household_id uuid not null,
  student_id uuid not null,
  lesson_ref text not null
    check (public.academy_study_identifier_is_valid(lesson_ref)),
  segment_ref text not null
    check (public.academy_study_identifier_is_valid(segment_ref)),
  status text not null
    check (status in ('active', 'paused', 'completed', 'stopped')),
  last_accepted_event_ref text
    check (
      last_accepted_event_ref is null
      or public.academy_study_identifier_is_valid(last_accepted_event_ref)
    ),
  revision bigint not null default 1 check (revision > 0),
  integrity_digest text not null check (integrity_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint study_production_sessions_core_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict
);

-- Minimal checkpoint storage.  Raw answers, Tutor text/audio/transcripts,
-- diagnostic labels and adult work have no columns here.  Response drafts have
-- no durable representation until an independently reviewed server authority
-- can issue and validate opaque references.
-- The checkpoint reference is a caller-chosen identifier, so its uniqueness is
-- scoped to the learner that chose it.  A globally unique key would let one
-- one household learner discover, and permanently squat, references belonging to
-- a household they cannot otherwise observe.
create table academy_private.study_production_session_checkpoints (
  session_id text primary key,
  checkpoint_ref text not null
    check (public.academy_study_identifier_is_valid(checkpoint_ref)),
  household_id uuid not null,
  student_id uuid not null,
  lesson_ref text not null
    check (public.academy_study_identifier_is_valid(lesson_ref)),
  segment_ref text not null
    check (public.academy_study_identifier_is_valid(segment_ref)),
  completed_segment_refs text[] not null default '{}'::text[]
    check (
      cardinality(completed_segment_refs) <= 512
      and public.academy_study_identifiers_are_unique(completed_segment_refs)
    ),
  elapsed_active_seconds_in_segment bigint not null default 0
    check (elapsed_active_seconds_in_segment between 0 and 9007199254740991),
  response_draft_ref text check (response_draft_ref is null),
  captured_at timestamptz not null,
  revision bigint not null default 1 check (revision > 0),
  integrity_digest text not null check (integrity_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint study_production_checkpoint_ref_scope_key
    unique (household_id, student_id, checkpoint_ref),
  constraint study_production_checkpoint_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict
);

-- Segment completion is append-only and separate from block completion.  The
-- calendar block revision serializes appends; the unique key prevents a segment
-- being counted twice even if a caller uses a new mutation reference.
create table academy_private.study_production_calendar_segments (
  block_id text not null,
  household_id uuid not null,
  student_id uuid not null,
  segment_ref text not null
    check (public.academy_study_identifier_is_valid(segment_ref)),
  completed_at timestamptz not null,
  mutation_ref text not null
    check (public.academy_study_identifier_is_valid(mutation_ref)),
  created_at timestamptz not null default clock_timestamp(),
  primary key (block_id, segment_ref),
  constraint study_production_calendar_segment_block_fk
    foreign key (block_id, household_id, student_id)
    references public.academy_study_calendar_blocks (id, household_id, student_id)
    on delete restrict
);

create function academy_private.study_production_current_binding(
  p_required_capability text
)
returns table (household_id uuid, student_id uuid)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  grant_household_id uuid;
  grant_student_id uuid;
  authorized_household_id uuid;
begin
  if auth.uid() is null
     or academy_private.study_jwt_claim_text('academy_principal_kind')
       is distinct from 'student_session_grant' then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select grant_row.household_id, grant_row.student_id
    into grant_household_id, grant_student_id
  from academy_private.student_session_grants as grant_row
  where grant_row.id = auth.uid();
  if grant_student_id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  authorized_household_id := academy_private.study_authorized_household(
    grant_student_id,
    p_required_capability,
    false
  );
  if authorized_household_id is distinct from grant_household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return query select grant_household_id, grant_student_id;
end;
$$;

create function academy_private.study_production_session_request_is_valid(
  p_candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_json_has_exact_keys(p_candidate, array[
      'sessionRef', 'lessonRef', 'subjectRef', 'studyPlanRef', 'segmentRef',
      'startedAt', 'intendedLocalDate', 'lastAcceptedEventRef',
      'rawAnswerIncluded', 'transcriptIncluded'
    ]::text[])
    and public.academy_study_payload_is_minimized(
      p_candidate - 'rawAnswerIncluded' - 'transcriptIncluded', 8192
    )
    and public.academy_study_identifier_is_valid(p_candidate ->> 'sessionRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'lessonRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'subjectRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'segmentRef')
    and (
      jsonb_typeof(p_candidate -> 'studyPlanRef') = 'null'
      or (
        jsonb_typeof(p_candidate -> 'studyPlanRef') = 'string'
        and public.academy_study_identifier_is_valid(p_candidate ->> 'studyPlanRef')
      )
    )
    and jsonb_typeof(p_candidate -> 'startedAt') = 'string'
    and (p_candidate ->> 'startedAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$'
    and jsonb_typeof(p_candidate -> 'intendedLocalDate') = 'string'
    and (p_candidate ->> 'intendedLocalDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and (
      jsonb_typeof(p_candidate -> 'lastAcceptedEventRef') = 'null'
      or (
        jsonb_typeof(p_candidate -> 'lastAcceptedEventRef') = 'string'
        and public.academy_study_identifier_is_valid(
          p_candidate ->> 'lastAcceptedEventRef'
        )
      )
    )
    and p_candidate -> 'rawAnswerIncluded' = 'false'::jsonb
    and p_candidate -> 'transcriptIncluded' = 'false'::jsonb;
$$;

create function academy_private.study_production_checkpoint_is_valid(
  p_candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_json_has_exact_keys(p_candidate, array[
      'checkpointRef', 'sessionRef', 'lessonRef', 'segmentRef', 'revision',
      'capturedAt', 'completedSegmentRefs',
      'elapsedActiveSecondsInSegment', 'responseDraftRef',
      'rawAnswerIncluded', 'transcriptIncluded'
    ]::text[])
    and public.academy_study_payload_is_minimized(
      p_candidate - 'rawAnswerIncluded' - 'transcriptIncluded', 16384
    )
    and public.academy_study_identifier_is_valid(p_candidate ->> 'checkpointRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'sessionRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'lessonRef')
    and public.academy_study_identifier_is_valid(p_candidate ->> 'segmentRef')
    and jsonb_typeof(p_candidate -> 'revision') = 'number'
    and (p_candidate ->> 'revision')::numeric between 1 and 9007199254740991
    and jsonb_typeof(p_candidate -> 'capturedAt') = 'string'
    and (p_candidate ->> 'capturedAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$'
    and jsonb_typeof(p_candidate -> 'completedSegmentRefs') = 'array'
    and jsonb_array_length(p_candidate -> 'completedSegmentRefs') <= 512
    and public.academy_study_identifiers_are_unique(array(
      select jsonb_array_elements_text(p_candidate -> 'completedSegmentRefs')
    ))
    and jsonb_typeof(p_candidate -> 'elapsedActiveSecondsInSegment') = 'number'
    and (p_candidate ->> 'elapsedActiveSecondsInSegment')::numeric
      between 0 and 9007199254740991
    and jsonb_typeof(p_candidate -> 'responseDraftRef') = 'null'
    and p_candidate -> 'rawAnswerIncluded' = 'false'::jsonb
    and p_candidate -> 'transcriptIncluded' = 'false'::jsonb;
$$;

create function academy_private.study_production_session_integrity(
  p_candidate academy_private.study_production_sessions
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select academy_private.study_sha256_json(jsonb_build_object(
    'session_id', p_candidate.session_id,
    'household_id', p_candidate.household_id,
    'student_id', p_candidate.student_id,
    'lesson_ref', p_candidate.lesson_ref,
    'segment_ref', p_candidate.segment_ref,
    'status', p_candidate.status,
    'last_accepted_event_ref', p_candidate.last_accepted_event_ref,
    'revision', p_candidate.revision,
    'created_at', p_candidate.created_at,
    'updated_at', p_candidate.updated_at
  ));
$$;

create function academy_private.study_production_checkpoint_integrity(
  p_candidate academy_private.study_production_session_checkpoints
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select academy_private.study_sha256_json(jsonb_build_object(
    'session_id', p_candidate.session_id,
    'checkpoint_ref', p_candidate.checkpoint_ref,
    'household_id', p_candidate.household_id,
    'student_id', p_candidate.student_id,
    'lesson_ref', p_candidate.lesson_ref,
    'segment_ref', p_candidate.segment_ref,
    'completed_segment_refs', p_candidate.completed_segment_refs,
    'elapsed_active_seconds_in_segment',
      p_candidate.elapsed_active_seconds_in_segment,
    'response_draft_ref', p_candidate.response_draft_ref,
    'captured_at', p_candidate.captured_at,
    'revision', p_candidate.revision,
    'created_at', p_candidate.created_at,
    'updated_at', p_candidate.updated_at
  ));
$$;

create function academy_private.study_set_production_session_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.integrity_digest :=
    academy_private.study_production_session_integrity(new);
  return new;
end;
$$;

create function academy_private.study_set_production_checkpoint_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.integrity_digest :=
    academy_private.study_production_checkpoint_integrity(new);
  return new;
end;
$$;

create trigger study_production_session_10_revision
before update on academy_private.study_production_sessions
for each row execute function academy_private.study_prepare_revision();
create trigger study_production_session_20_integrity
before insert or update on academy_private.study_production_sessions
for each row execute function
  academy_private.study_set_production_session_integrity();
create trigger study_production_checkpoint_10_revision
before update on academy_private.study_production_session_checkpoints
for each row execute function academy_private.study_prepare_revision();
create trigger study_production_checkpoint_20_integrity
before insert or update on academy_private.study_production_session_checkpoints
for each row execute function
  academy_private.study_set_production_checkpoint_integrity();
create trigger study_production_calendar_segment_immutable
before update or delete on academy_private.study_production_calendar_segments
for each row execute function academy_private.study_prevent_mutation();

-- Once the production wire projects a core session, that core row may only move
-- together with its projection.  The legacy lane advances core.revision and
-- core.state without touching the projection, which permanently quarantines
-- every production read, checkpoint and transition for that session and leaves
-- no repair operation; an ordinary authorized learner can do it to their own
-- session.  Both academy_study_transition_session and
-- academy_study_create_session are granted directly to authenticated, so the
-- guard belongs on the table rather than in any one caller.  It enforces exactly
-- the invariant the production readers already verify, refusing before the write
-- instead of detecting the damage afterwards.  Sessions the wire does not
-- project are untouched, and deletion is already refused by the on delete
-- restrict foreign key the projection carries.
create function academy_private.study_production_session_ownership_guard()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  projection academy_private.study_production_sessions%rowtype;
  expected_core_state text;
begin
  select * into projection
  from academy_private.study_production_sessions
  where session_id = old.id;
  if projection.session_id is null then
    return new;
  end if;
  -- An unmapped projection status yields null and refuses, so a status the
  -- production vocabulary does not know can never authorize a core move.
  expected_core_state := case projection.status
    when 'active' then 'active'
    when 'paused' then 'paused'
    when 'completed' then 'completed'
    when 'stopped' then 'abandoned'
  end;
  -- The revision arm is the load-bearing one: study_prepare_revision moves the
  -- revision on every update of this table and refuses a caller-supplied value,
  -- so no reachable writer can change any other column without tripping it.
  -- The remaining arms are deliberate depth.  They are unforced today and stay
  -- because they become the only guard if the revision trigger is ever dropped,
  -- and because they cross-check the mapping the production transition itself
  -- writes rather than trusting it.
  if projection.revision is distinct from new.revision
     or projection.lesson_ref is distinct from new.lesson_id
     or projection.household_id is distinct from new.household_id
     or projection.student_id is distinct from new.student_id
     or new.state is distinct from expected_core_state then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Fires after academy_study_sessions_revision, so new.revision is already the
-- value the writer will durably store.
create trigger study_production_session_30_ownership
before update on public.academy_study_sessions
for each row execute function
  academy_private.study_production_session_ownership_guard();

-- The core session identifier is global and both lanes create rows in it, so
-- both lanes must serialize on the same key.  Without this, a legacy create
-- that contests an uncommitted production begin sees no row, proceeds to its
-- insert, blocks on the primary key and surfaces a raw 23505 naming an internal
-- constraint.  Taking the same advisory key the production begin takes, before
-- this function observes either session or receipt state, turns that race into
-- the ordinary serialized answer: whichever lane runs second observes the
-- committed row and returns its closed idempotency-collision result.  The body
-- is otherwise unchanged from 20260801011000, and the signature, argument
-- names, language, volatility and return type are identical, so the academic
-- readiness metadata pins on this function continue to hold.
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
  is_student_actor boolean;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.academy_study_json_has_exact_keys(
      p_session,
      array[
        'id', 'schema_version', 'student_id', 'lesson_id', 'subject_id',
        'study_plan_id', 'state', 'started_at', 'completed_at',
        'intended_local_date'
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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('academy:study:production-session:v1'),
    pg_catalog.hashtext(p_session ->> 'id')
  );
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
  is_student_actor := academy_private.study_jwt_claim_text(
    'academy_principal_kind'
  ) = 'student_session_grant';
  insert into public.academy_study_sessions (
    id, schema_version, household_id, student_id, lesson_id, subject_id,
    study_plan_id, state, started_at, completed_at,
    intended_local_date, household_timezone, created_by
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
    case when is_student_actor then null else auth.uid() end
  );
  result_value := jsonb_build_object(
    'status', 'created',
    'sessionId', p_session ->> 'id',
    'revision', 1
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

create function academy_private.study_production_calendar_block_json(
  p_block public.academy_study_calendar_blocks
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'blockRef', p_block.id,
    'blockType', p_block.block_type,
    'externalItemRef', p_block.source_reference,
    'scheduledStart', to_char(
      p_block.scheduled_start at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'intendedLocalDate', p_block.intended_local_date,
    'householdTimeZone', p_block.household_timezone,
    'durationMinutes', p_block.duration_minutes,
    'state', case p_block.state
      when 'scheduled' then 'scheduled'
      when 'available' then 'scheduled'
      when 'in_progress' then 'active'
      when 'paused' then 'paused'
      when 'completed' then 'completed'
      else null
    end,
    'completionUnits', p_block.completion_units,
    'requiredUnits', p_block.required_units,
    'completedSegmentRefs', coalesce((
      select jsonb_agg(segment.segment_ref order by segment.created_at, segment.segment_ref)
      from academy_private.study_production_calendar_segments as segment
      where segment.block_id = p_block.id
        and segment.household_id = p_block.household_id
        and segment.student_id = p_block.student_id
    ), '[]'::jsonb),
    'resumeSessionRef', p_block.resume_session_id,
    'resumeSegmentRef', p_block.resume_segment_id,
    'revision', p_block.revision
  );
$$;

create function academy_private.study_production_runtime_operation_contract()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'session:begin', 'student:attempts:create',
    'session:read', 'student:progress:read',
    'session:transition', 'student:attempts:create',
    'checkpoint:read', 'student:progress:read',
    'checkpoint:compare-and-swap', 'student:attempts:create',
    'calendar:list', 'student:assignments:read',
    'calendar:read', 'student:assignments:read',
    'calendar:transition', 'student:attempts:create',
    'calendar:complete-segment', 'student:attempts:create',
    'event:append', 'student:attempts:create'
  );
$$;

create function public.academy_study_begin_production_session_v1(
  p_session jsonb,
  p_mutation_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  binding record;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  target_session public.academy_study_sessions%rowtype;
  started_at timestamptz;
  correlation uuid := gen_random_uuid();
begin
  if not academy_private.study_production_session_request_is_valid(p_session)
     or not public.academy_study_identifier_is_valid(p_mutation_ref) then
    raise exception 'STUDY_PRODUCTION_SESSION_INVALID' using errcode = '22023';
  end if;
  started_at := (p_session ->> 'startedAt')::timestamptz;
  if started_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'STUDY_PRODUCTION_SESSION_INVALID' using errcode = '22023';
  end if;

  select * into binding
  from academy_private.study_production_current_binding(
    'student:attempts:create'
  );
  if not exists (
    select 1 from public.academy_study_household_settings
    where household_id = binding.household_id
  ) then
    raise exception 'STUDY_HOUSEHOLD_TIMEZONE_REQUIRED' using errcode = '23514';
  end if;

  -- The core session identifier is global.  Serialize its entire begin
  -- transaction before observing either session or receipt state.  Hash
  -- collisions may over-serialize unrelated sessions but cannot admit a race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('academy:study:production-session:v1'),
    pg_catalog.hashtext(p_session ->> 'sessionRef')
  );

  -- Resolve an existing core row before consulting its mutation receipt.  A
  -- foreign learner reusing a guessed session/mutation pair must receive the
  -- same authorization refusal as every other cross-learner target, not an
  -- idempotency answer that confirms the pair exists.
  select * into target_session
  from public.academy_study_sessions
  where id = p_session ->> 'sessionRef'
  for update;
  if target_session.id is not null
     and (
       target_session.household_id is distinct from binding.household_id
       or target_session.student_id is distinct from binding.student_id
     ) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  fingerprint := jsonb_build_object(
    'session', p_session,
    'bound_household_id', binding.household_id,
    'bound_student_id', binding.student_id
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || (p_session ->> 'sessionRef')
    and operation_kind = 'production_session_begin_v1'
    and idempotency_key = p_mutation_ref;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if target_session.id is not null then
    result_value := jsonb_build_object('status', 'idempotency-collision');
  else
    insert into public.academy_study_sessions (
      id, schema_version, household_id, student_id, lesson_id, subject_id,
      study_plan_id, state, started_at, completed_at, intended_local_date,
      household_timezone, created_by
    )
    select
      p_session ->> 'sessionRef',
      1,
      binding.household_id,
      binding.student_id,
      p_session ->> 'lessonRef',
      p_session ->> 'subjectRef',
      p_session ->> 'studyPlanRef',
      'active',
      started_at,
      null,
      (p_session ->> 'intendedLocalDate')::date,
      settings.household_timezone,
      null
    from public.academy_study_household_settings as settings
    where settings.household_id = binding.household_id;

    insert into academy_private.study_production_sessions (
      session_id, household_id, student_id, lesson_ref, segment_ref, status,
      last_accepted_event_ref, revision, integrity_digest, created_at, updated_at
    ) values (
      p_session ->> 'sessionRef', binding.household_id, binding.student_id,
      p_session ->> 'lessonRef', p_session ->> 'segmentRef', 'active',
      p_session ->> 'lastAcceptedEventRef', 1, repeat('0', 64),
      started_at, started_at
    );
    result_value := jsonb_build_object(
      'status', 'saved',
      'sessionRef', p_session ->> 'sessionRef',
      'revision', 1
    );
    perform academy_private.study_append_audit(
      binding.household_id,
      binding.student_id,
      'session.start',
      'session',
      p_session ->> 'sessionRef',
      null,
      correlation,
      jsonb_build_object('revision', 1, 'result_code', 'saved')
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || (p_session ->> 'sessionRef'),
    'production_session_begin_v1',
    p_mutation_ref,
    request_digest,
    fingerprint,
    result_value,
    clock_timestamp() + interval '90 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_read_production_session_v1(
  p_session_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection academy_private.study_production_sessions%rowtype;
  core public.academy_study_sessions%rowtype;
  resolved_household_id uuid;
begin
  if not public.academy_study_identifier_is_valid(p_session_ref) then
    raise exception 'STUDY_PRODUCTION_SESSION_INVALID' using errcode = '22023';
  end if;
  select production.* into projection
  from academy_private.study_production_sessions as production
  join public.academy_study_sessions as session
    on session.id = production.session_id
   and session.household_id = production.household_id
   and session.student_id = production.student_id
  where production.session_id = p_session_ref;
  if projection.session_id is null then
    return jsonb_build_object('status', 'not-found');
  end if;
  select * into core
  from public.academy_study_sessions
  where id = projection.session_id;
  resolved_household_id := academy_private.study_authorized_household(
    projection.student_id,
    'student:progress:read',
    false
  );
  if resolved_household_id is distinct from projection.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if projection.integrity_digest is distinct from
       academy_private.study_production_session_integrity(projection)
     or projection.revision is distinct from core.revision
     or projection.lesson_ref is distinct from core.lesson_id
     or (projection.status = 'active' and core.state <> 'active')
     or (projection.status = 'paused' and core.state <> 'paused')
     or (projection.status = 'completed' and core.state <> 'completed')
     or (projection.status = 'stopped' and core.state <> 'abandoned') then
    return jsonb_build_object(
      'status', 'quarantined',
      'reasonCode', 'integrity-failed'
    );
  end if;
  return jsonb_build_object(
    'status', 'found',
    'session', jsonb_build_object(
      'sessionRef', projection.session_id,
      'lessonRef', projection.lesson_ref,
      'segmentRef', projection.segment_ref,
      'status', projection.status,
      'updatedAt', to_char(
        projection.updated_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'lastAcceptedEventRef', projection.last_accepted_event_ref,
      'revision', projection.revision,
      'rawAnswerIncluded', false,
      'transcriptIncluded', false
    )
  );
end;
$$;

create function public.academy_study_transition_production_session_v1(
  p_session_ref text,
  p_expected_revision bigint,
  p_transition text,
  p_segment_ref text,
  p_last_accepted_event_ref text,
  p_at timestamptz,
  p_mutation_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  projection academy_private.study_production_sessions%rowtype;
  core public.academy_study_sessions%rowtype;
  resolved_household_id uuid;
  target_status text;
  target_core_state text;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if not public.academy_study_identifier_is_valid(p_session_ref)
     or p_expected_revision is null or p_expected_revision < 1
     or p_transition not in ('pause', 'resume', 'complete', 'stop')
     or not public.academy_study_identifier_is_valid(p_segment_ref)
     or (p_last_accepted_event_ref is not null and not
       public.academy_study_identifier_is_valid(p_last_accepted_event_ref))
     or p_at is null
     or p_at > clock_timestamp() + interval '5 minutes'
     or not public.academy_study_identifier_is_valid(p_mutation_ref) then
    raise exception 'STUDY_PRODUCTION_SESSION_TRANSITION_INVALID'
      using errcode = '22023';
  end if;

  select production.* into projection
  from academy_private.study_production_sessions as production
  join public.academy_study_sessions as session
    on session.id = production.session_id
   and session.household_id = production.household_id
   and session.student_id = production.student_id
  where production.session_id = p_session_ref
  for update of production;
  if projection.session_id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into core
  from public.academy_study_sessions
  where id = projection.session_id
  for update;
  resolved_household_id := academy_private.study_authorized_household(
    projection.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from projection.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if projection.integrity_digest is distinct from
       academy_private.study_production_session_integrity(projection)
     or projection.revision is distinct from core.revision then
    return jsonb_build_object('status', 'quarantined');
  end if;
  if p_at < core.started_at then
    raise exception 'STUDY_PRODUCTION_SESSION_TRANSITION_INVALID'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'session_ref', p_session_ref,
    'expected_revision', p_expected_revision,
    'transition', p_transition,
    'segment_ref', p_segment_ref,
    'last_accepted_event_ref', p_last_accepted_event_ref,
    'at', p_at
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || p_session_ref
    and operation_kind = 'production_session_transition_v1'
    and idempotency_key = p_mutation_ref;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if projection.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', projection.revision
    );
  else
    target_status := case
      when p_transition = 'pause' and projection.status = 'active' then 'paused'
      when p_transition = 'resume' and projection.status = 'paused' then 'active'
      when p_transition = 'complete'
        and projection.status in ('active', 'paused') then 'completed'
      when p_transition = 'stop'
        and projection.status in ('active', 'paused') then 'stopped'
      else null
    end;
    if target_status is null then
      raise exception 'STUDY_PRODUCTION_SESSION_TRANSITION_ILLEGAL'
        using errcode = '22023';
    end if;
    target_core_state := case target_status
      when 'active' then 'active'
      when 'paused' then 'paused'
      when 'completed' then 'completed'
      when 'stopped' then 'abandoned'
    end;
    -- The projection moves first so the core update lands on a projection that
    -- already agrees with it; the ownership guard on the core table refuses any
    -- core move its projection did not make.
    update academy_private.study_production_sessions
    set status = target_status,
        segment_ref = p_segment_ref,
        last_accepted_event_ref = p_last_accepted_event_ref
    where session_id = p_session_ref;
    update public.academy_study_sessions
    set state = target_core_state,
        completed_at = case when target_core_state = 'completed' then p_at else null end
    where id = p_session_ref;
    result_value := jsonb_build_object(
      'status', 'saved',
      'revision', p_expected_revision + 1
    );
    if target_status in ('completed', 'stopped') then
      perform academy_private.study_append_audit(
        projection.household_id,
        projection.student_id,
        'session.finish',
        'session',
        p_session_ref,
        case when target_status = 'stopped' then 'stopped' else null end,
        correlation,
        jsonb_build_object(
          'expected_revision', p_expected_revision,
          'revision', p_expected_revision + 1,
          'state_from', projection.status,
          'state_to', target_status,
          'result_code', 'saved'
        )
      );
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || p_session_ref,
    'production_session_transition_v1',
    p_mutation_ref,
    request_digest,
    fingerprint,
    result_value,
    clock_timestamp() + interval '90 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_read_session_checkpoint_v1(
  p_session_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  checkpoint academy_private.study_production_session_checkpoints%rowtype;
  resolved_household_id uuid;
begin
  if not public.academy_study_identifier_is_valid(p_session_ref) then
    raise exception 'STUDY_PRODUCTION_CHECKPOINT_INVALID' using errcode = '22023';
  end if;
  select * into checkpoint
  from academy_private.study_production_session_checkpoints
  where session_id = p_session_ref;
  if checkpoint.session_id is null then
    return jsonb_build_object('status', 'not-found');
  end if;
  resolved_household_id := academy_private.study_authorized_household(
    checkpoint.student_id,
    'student:progress:read',
    false
  );
  if resolved_household_id is distinct from checkpoint.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if checkpoint.integrity_digest is distinct from
       academy_private.study_production_checkpoint_integrity(checkpoint) then
    return jsonb_build_object(
      'status', 'quarantined',
      'reasonCode', 'integrity-failed'
    );
  end if;
  return jsonb_build_object(
    'status', 'found',
    'checkpoint', jsonb_build_object(
      'checkpointRef', checkpoint.checkpoint_ref,
      'sessionRef', checkpoint.session_id,
      'lessonRef', checkpoint.lesson_ref,
      'segmentRef', checkpoint.segment_ref,
      'revision', checkpoint.revision,
      'capturedAt', to_char(
        checkpoint.captured_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'completedSegmentRefs', to_jsonb(checkpoint.completed_segment_refs),
      'elapsedActiveSecondsInSegment',
        checkpoint.elapsed_active_seconds_in_segment,
      'responseDraftRef', checkpoint.response_draft_ref,
      'rawAnswerIncluded', false,
      'transcriptIncluded', false
    )
  );
end;
$$;

create function public.academy_study_compare_and_swap_session_checkpoint_v1(
  p_session_ref text,
  p_expected_revision bigint,
  p_mutation_ref text,
  p_checkpoint jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  projection academy_private.study_production_sessions%rowtype;
  core public.academy_study_sessions%rowtype;
  current_checkpoint academy_private.study_production_session_checkpoints%rowtype;
  resolved_household_id uuid;
  expected_revision bigint := coalesce(p_expected_revision, 0);
  desired_revision bigint;
  completed_refs text[];
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if not public.academy_study_identifier_is_valid(p_session_ref)
     or p_expected_revision is not null and p_expected_revision < 1
     or not public.academy_study_identifier_is_valid(p_mutation_ref)
     or not academy_private.study_production_checkpoint_is_valid(p_checkpoint)
     or p_session_ref is distinct from p_checkpoint ->> 'sessionRef' then
    return jsonb_build_object('status', 'quarantined');
  end if;
  desired_revision := (p_checkpoint ->> 'revision')::bigint;
  if desired_revision <> expected_revision + 1 then
    return jsonb_build_object('status', 'quarantined');
  end if;

  -- Serialize on the caller-chosen reference before observing checkpoint state.
  -- Two sessions of this same learner could otherwise both pass the scope check
  -- below and then collide on the durable key, turning a closed refusal into a
  -- raw constraint error.  Hash collisions over-serialize unrelated references
  -- but cannot admit a race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('academy:study:production-checkpoint-ref:v1'),
    pg_catalog.hashtext(p_checkpoint ->> 'checkpointRef')
  );

  select * into projection
  from academy_private.study_production_sessions
  where session_id = p_session_ref
  for update;
  if projection.session_id is null
     or projection.lesson_ref is distinct from p_checkpoint ->> 'lessonRef' then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into core
  from public.academy_study_sessions
  where id = projection.session_id
  for update;
  resolved_household_id := academy_private.study_authorized_household(
    projection.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from projection.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  -- projection.session_id vs core.id is unforced by construction: core is
  -- selected by projection.session_id and the projection carries an on delete
  -- restrict foreign key, so the two cannot disagree and core cannot be
  -- missing.  It stays as an assertion of the join it depends on.
  if projection.integrity_digest is distinct from
       academy_private.study_production_session_integrity(projection)
     or projection.session_id is distinct from core.id
     or projection.household_id is distinct from core.household_id
     or projection.student_id is distinct from core.student_id
     or projection.lesson_ref is distinct from core.lesson_id
     or projection.revision is distinct from core.revision
     or (projection.status = 'active' and core.state <> 'active')
     or (projection.status = 'paused' and core.state <> 'paused')
     or (projection.status = 'completed' and core.state <> 'completed')
     or (projection.status = 'stopped' and core.state <> 'abandoned') then
    return jsonb_build_object('status', 'quarantined');
  end if;
  select * into current_checkpoint
  from academy_private.study_production_session_checkpoints
  where session_id = p_session_ref
  for update;
  if current_checkpoint.session_id is not null and (
       current_checkpoint.integrity_digest is distinct from
         academy_private.study_production_checkpoint_integrity(current_checkpoint)
       or current_checkpoint.session_id is distinct from projection.session_id
       or current_checkpoint.household_id is distinct from projection.household_id
       or current_checkpoint.student_id is distinct from projection.student_id
       or current_checkpoint.lesson_ref is distinct from projection.lesson_ref
     ) then
    return jsonb_build_object('status', 'quarantined');
  end if;
  -- Within the reference namespace of one learner a collision is a real conflict
  -- and fails closed.  Outside it there is nothing to collide with, so a foreign
  -- household learns nothing about which references exist.
  if exists (
    select 1
    from academy_private.study_production_session_checkpoints as other
    where other.household_id = projection.household_id
      and other.student_id = projection.student_id
      and other.checkpoint_ref = p_checkpoint ->> 'checkpointRef'
      and other.session_id is distinct from p_session_ref
  ) then
    return jsonb_build_object('status', 'quarantined');
  end if;

  fingerprint := jsonb_build_object(
    'session_ref', p_session_ref,
    'expected_revision', p_expected_revision,
    'checkpoint', jsonb_set(
      p_checkpoint,
      '{responseDraftRef}',
      'null'::jsonb,
      false
    )
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || p_session_ref
    and operation_kind = 'production_checkpoint_cas_v1'
    and idempotency_key = p_mutation_ref;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if coalesce(current_checkpoint.revision, 0) <> expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', coalesce(current_checkpoint.revision, 0)
    );
  else
    select coalesce(array_agg(value), '{}'::text[]) into completed_refs
    from jsonb_array_elements_text(
      p_checkpoint -> 'completedSegmentRefs'
    ) as value;
    if current_checkpoint.session_id is null then
      insert into academy_private.study_production_session_checkpoints (
        session_id, checkpoint_ref, household_id, student_id, lesson_ref,
        segment_ref, completed_segment_refs,
        elapsed_active_seconds_in_segment, response_draft_ref, captured_at,
        revision, integrity_digest
      ) values (
        p_session_ref, p_checkpoint ->> 'checkpointRef',
        projection.household_id, projection.student_id,
        p_checkpoint ->> 'lessonRef', p_checkpoint ->> 'segmentRef',
        completed_refs,
        (p_checkpoint ->> 'elapsedActiveSecondsInSegment')::bigint,
        null,
        (p_checkpoint ->> 'capturedAt')::timestamptz,
        desired_revision, repeat('0', 64)
      );
    else
      update academy_private.study_production_session_checkpoints
      set checkpoint_ref = p_checkpoint ->> 'checkpointRef',
          lesson_ref = p_checkpoint ->> 'lessonRef',
          segment_ref = p_checkpoint ->> 'segmentRef',
          completed_segment_refs = completed_refs,
          elapsed_active_seconds_in_segment =
            (p_checkpoint ->> 'elapsedActiveSecondsInSegment')::bigint,
          response_draft_ref = null,
          captured_at = (p_checkpoint ->> 'capturedAt')::timestamptz
      where session_id = p_session_ref;
    end if;
    result_value := jsonb_build_object(
      'status', 'saved',
      'revision', desired_revision
    );
    perform academy_private.study_append_audit(
      projection.household_id,
      projection.student_id,
      'checkpoint.save',
      'checkpoint',
      p_checkpoint ->> 'checkpointRef',
      null,
      correlation,
      jsonb_build_object('revision', desired_revision, 'result_code', 'saved')
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || p_session_ref,
    'production_checkpoint_cas_v1',
    p_mutation_ref,
    request_digest,
    fingerprint,
    result_value,
    clock_timestamp() + interval '90 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_list_production_calendar_v1(
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  binding record;
  blocks jsonb;
begin
  if p_cursor is not null
     and not public.academy_study_identifier_is_valid(p_cursor) then
    raise exception 'STUDY_PRODUCTION_CALENDAR_INVALID' using errcode = '22023';
  end if;
  select * into binding
  from academy_private.study_production_current_binding(
    'student:assignments:read'
  );
  select coalesce(jsonb_agg(
      academy_private.study_production_calendar_block_json(block)
      order by block.scheduled_start, block.id
    ), '[]'::jsonb)
    into blocks
  from (
    select *
    from public.academy_study_calendar_blocks
    where household_id = binding.household_id
      and student_id = binding.student_id
      and state <> 'cancelled'
      and (p_cursor is null or id > p_cursor)
    order by id
    limit 100
  ) as block;
  return jsonb_build_object('status', 'ok', 'blocks', blocks);
end;
$$;

create function public.academy_study_read_production_calendar_block_v1(
  p_block_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  block public.academy_study_calendar_blocks%rowtype;
  resolved_household_id uuid;
begin
  if not public.academy_study_identifier_is_valid(p_block_ref) then
    raise exception 'STUDY_PRODUCTION_CALENDAR_INVALID' using errcode = '22023';
  end if;
  select * into block
  from public.academy_study_calendar_blocks
  where id = p_block_ref;
  if block.id is null then
    return jsonb_build_object('status', 'not-found');
  end if;
  resolved_household_id := academy_private.study_authorized_household(
    block.student_id,
    'student:assignments:read',
    false
  );
  if resolved_household_id is distinct from block.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if block.state = 'cancelled' then
    return jsonb_build_object('status', 'not-found');
  end if;
  return jsonb_build_object(
    'status', 'found',
    'block', academy_private.study_production_calendar_block_json(block)
  );
end;
$$;

create function public.academy_study_transition_calendar_block_v2(
  p_block_ref text,
  p_expected_revision bigint,
  p_transition text,
  p_at timestamptz,
  p_pause_category text,
  p_mutation_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  block public.academy_study_calendar_blocks%rowtype;
  resolved_household_id uuid;
  target_state text;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if not public.academy_study_identifier_is_valid(p_block_ref)
     or p_expected_revision is null or p_expected_revision < 1
     or p_transition not in ('start', 'pause', 'resume', 'complete')
     or p_at is null
     or p_at > clock_timestamp() + interval '5 minutes'
     or p_at < clock_timestamp() - interval '24 hours'
     or not public.academy_study_identifier_is_valid(p_mutation_ref) then
    raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
  end if;
  if p_transition = 'pause' then
    if p_pause_category not in (
      'planned_break', 'requested_break', 'outside_interruption',
      'technical_interruption'
    ) then
      raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
    end if;
  elsif p_pause_category is not null then
    raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
  end if;

  select * into block
  from public.academy_study_calendar_blocks
  where id = p_block_ref
  for update;
  if block.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  resolved_household_id := academy_private.study_authorized_household(
    block.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from block.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  fingerprint := jsonb_build_object(
    'block_ref', p_block_ref,
    'expected_revision', p_expected_revision,
    'transition', p_transition,
    'at', p_at,
    'pause_category', p_pause_category
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'calendar:' || p_block_ref
    and operation_kind = 'production_calendar_transition_v2'
    and idempotency_key = p_mutation_ref;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if block.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', block.revision
    );
  else
    target_state := case
      when p_transition = 'start' and block.state in ('scheduled', 'available')
        then 'in_progress'
      when p_transition = 'pause' and block.state = 'in_progress'
        then 'paused'
      when p_transition = 'resume' and block.state = 'paused'
        then 'in_progress'
      when p_transition = 'complete' and block.state = 'in_progress'
        and block.completion_units = block.required_units
        then 'completed'
      else null
    end;
    if target_state is null then
      raise exception 'STUDY_CALENDAR_TRANSITION_ILLEGAL' using errcode = '22023';
    end if;
    update public.academy_study_calendar_blocks
    set state = target_state
    where id = p_block_ref;
    result_value := jsonb_build_object(
      'status', 'saved',
      'revision', p_expected_revision + 1
    );
    perform academy_private.study_append_audit(
      block.household_id,
      block.student_id,
      'calendar.schedule',
      'calendar',
      p_block_ref,
      p_pause_category,
      correlation,
      jsonb_build_object(
        'expected_revision', p_expected_revision,
        'revision', p_expected_revision + 1,
        'state_from', block.state,
        'state_to', target_state,
        'result_code', 'saved'
      )
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'calendar:' || p_block_ref,
    'production_calendar_transition_v2',
    p_mutation_ref,
    request_digest,
    fingerprint,
    result_value,
    clock_timestamp() + interval '90 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_complete_calendar_segment_v1(
  p_block_ref text,
  p_segment_ref text,
  p_expected_revision bigint,
  p_at timestamptz,
  p_mutation_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  block public.academy_study_calendar_blocks%rowtype;
  resolved_household_id uuid;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if not public.academy_study_identifier_is_valid(p_block_ref)
     or not public.academy_study_identifier_is_valid(p_segment_ref)
     or p_expected_revision is null or p_expected_revision < 1
     or p_at is null
     or p_at > clock_timestamp() + interval '5 minutes'
     or p_at < clock_timestamp() - interval '24 hours'
     or not public.academy_study_identifier_is_valid(p_mutation_ref) then
    raise exception 'STUDY_CALENDAR_SEGMENT_INVALID' using errcode = '22023';
  end if;

  select * into block
  from public.academy_study_calendar_blocks
  where id = p_block_ref
  for update;
  if block.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  resolved_household_id := academy_private.study_authorized_household(
    block.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from block.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  fingerprint := jsonb_build_object(
    'block_ref', p_block_ref,
    'segment_ref', p_segment_ref,
    'expected_revision', p_expected_revision,
    'at', p_at
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'calendar:' || p_block_ref
    and operation_kind = 'production_calendar_segment_v1'
    and idempotency_key = p_mutation_ref;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if exists (
    select 1
    from academy_private.study_production_calendar_segments
    where block_id = p_block_ref and segment_ref = p_segment_ref
  ) then
    result_value := jsonb_build_object(
      'status', 'duplicate-ignored',
      'revision', block.revision
    );
  elsif block.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', block.revision
    );
  elsif block.state <> 'in_progress'
     or block.completion_units >= block.required_units then
    raise exception 'STUDY_CALENDAR_SEGMENT_ILLEGAL' using errcode = '22023';
  else
    insert into academy_private.study_production_calendar_segments (
      block_id, household_id, student_id, segment_ref, completed_at, mutation_ref
    ) values (
      p_block_ref, block.household_id, block.student_id,
      p_segment_ref, p_at, p_mutation_ref
    );
    update public.academy_study_calendar_blocks
    set completion_units = completion_units + 1,
        resume_segment_id = case
          when resume_session_id is null then null else p_segment_ref end
    where id = p_block_ref;
    result_value := jsonb_build_object(
      'status', 'saved',
      'revision', p_expected_revision + 1
    );
    perform academy_private.study_append_audit(
      block.household_id,
      block.student_id,
      'calendar.schedule',
      'calendar',
      p_block_ref,
      null,
      correlation,
      jsonb_build_object(
        'expected_revision', p_expected_revision,
        'revision', p_expected_revision + 1,
        'result_code', 'segment_completed'
      )
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'calendar:' || p_block_ref,
    'production_calendar_segment_v1',
    p_mutation_ref,
    request_digest,
    fingerprint,
    result_value,
    clock_timestamp() + interval '90 days'
  );
  return result_value;
end;
$$;

-- The v1 executor body and operation map are untouched.  v2 owns a
-- separate closed operation map and dispatches only production-wire operations
-- plus the already-reviewed safe learner event append needed by the five-role
-- session port.  Two legacy objects the v1 lane reaches are fenced above so the
-- two lanes cannot corrupt one shared session: the core session table carries an
-- ownership guard, and academy_study_create_session serializes on the same
-- advisory key the production begin uses.
create function public.academy_study_execute_verified_runtime_v2(
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
  required_capability text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  required_capability :=
    academy_private.study_production_runtime_operation_contract() ->> p_operation;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or required_capability is null
     or p_required_capability is distinct from required_capability then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied', 'operation', p_operation
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
    and session_grant.capabilities @> array[required_capability]::text[]
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
      'schemaVersion', 2, 'status', 'denied', 'operation', p_operation
    );
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', grant_row.id,
    'role', 'authenticated',
    'academy_principal_kind', 'student_session_grant'
  )::text, true);
  begin
    case p_operation
      when 'session:begin' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['session', 'mutationRef']::text[]
        ) or jsonb_typeof(p_request -> 'session') <> 'object' then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := public.academy_study_begin_production_session_v1(
          p_request -> 'session', p_request ->> 'mutationRef'
        );
      when 'session:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['sessionRef']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_read_production_session_v1(
          p_request ->> 'sessionRef'
        );
      when 'session:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionRef', 'expectedRevision', 'transition', 'segmentRef',
          'lastAcceptedEventRef', 'at', 'mutationRef'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_transition_production_session_v1(
          p_request ->> 'sessionRef',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'transition',
          p_request ->> 'segmentRef',
          p_request ->> 'lastAcceptedEventRef',
          (p_request ->> 'at')::timestamptz,
          p_request ->> 'mutationRef'
        );
      when 'checkpoint:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['sessionRef']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_read_session_checkpoint_v1(
          p_request ->> 'sessionRef'
        );
      when 'checkpoint:compare-and-swap' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionRef', 'expectedRevision', 'mutationRef', 'checkpoint'
        ]::text[]) or jsonb_typeof(p_request -> 'checkpoint') <> 'object' then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := public.academy_study_compare_and_swap_session_checkpoint_v1(
          p_request ->> 'sessionRef',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'mutationRef',
          p_request -> 'checkpoint'
        );
      when 'calendar:list' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['cursor']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_list_production_calendar_v1(
          p_request ->> 'cursor'
        );
      when 'calendar:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['blockRef']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_read_production_calendar_block_v1(
          p_request ->> 'blockRef'
        );
      when 'calendar:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'blockRef', 'expectedRevision', 'transition', 'at',
          'pauseCategory', 'mutationRef'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_transition_calendar_block_v2(
          p_request ->> 'blockRef',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'transition',
          (p_request ->> 'at')::timestamptz,
          p_request ->> 'pauseCategory',
          p_request ->> 'mutationRef'
        );
      when 'calendar:complete-segment' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'blockRef', 'segmentRef', 'expectedRevision', 'at', 'mutationRef'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_complete_calendar_segment_v1(
          p_request ->> 'blockRef',
          p_request ->> 'segmentRef',
          (p_request ->> 'expectedRevision')::bigint,
          (p_request ->> 'at')::timestamptz,
          p_request ->> 'mutationRef'
        );
      when 'event:append' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId', 'eventId', 'eventKind', 'payload', 'idempotencyKey'
        ]::text[]) or jsonb_typeof(p_request -> 'payload') <> 'object' then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := public.academy_study_append_learner_event_v1(
          p_request ->> 'sessionId',
          p_request ->> 'eventId',
          p_request ->> 'eventKind',
          p_request -> 'payload',
          p_request ->> 'idempotencyKey'
        );
    end case;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return jsonb_build_object(
    'schemaVersion', 2,
    'status', 'ok',
    'operation', p_operation,
    'body', coalesce(body, 'null'::jsonb)
  );
end;
$$;

create function public.academy_study_production_wire_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  database_contract_ready boolean;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select coalesce(
    metadata.production_wire_version = 1
      and metadata.migration_names @> array[
        '20260810120000_academy_study_production_wire_contract_v1'
      ]::text[]
      and to_regprocedure(
        'public.academy_study_execute_verified_runtime_v2(text,text,text,jsonb)'
      ) is not null,
    false
  ) into database_contract_ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'not-ready',
    'ready', false,
    'databaseContractReady', coalesce(database_contract_ready, false),
    'downstreamAdaptersComposed', false,
    'productionCompositionReady', false,
    'blockers', jsonb_build_array(
      'production-session-adapter',
      'production-checkpoint-adapter',
      'production-calendar-adapter',
      'production-runtime-composition'
    )
  );
end;
$$;

alter table academy_private.study_production_sessions enable row level security;
alter table academy_private.study_production_sessions force row level security;
alter table academy_private.study_production_session_checkpoints enable row level security;
alter table academy_private.study_production_session_checkpoints force row level security;
alter table academy_private.study_production_calendar_segments enable row level security;
alter table academy_private.study_production_calendar_segments force row level security;

alter table academy_private.study_production_sessions owner to postgres;
alter table academy_private.study_production_session_checkpoints owner to postgres;
alter table academy_private.study_production_calendar_segments owner to postgres;
alter function academy_private.study_production_current_binding(text) owner to postgres;
alter function academy_private.study_production_session_request_is_valid(jsonb) owner to postgres;
alter function academy_private.study_production_checkpoint_is_valid(jsonb) owner to postgres;
alter function academy_private.study_production_session_integrity(academy_private.study_production_sessions) owner to postgres;
alter function academy_private.study_production_checkpoint_integrity(academy_private.study_production_session_checkpoints) owner to postgres;
alter function academy_private.study_set_production_session_integrity() owner to postgres;
alter function academy_private.study_set_production_checkpoint_integrity() owner to postgres;
alter function academy_private.study_production_session_ownership_guard() owner to postgres;
alter function academy_private.study_production_calendar_block_json(public.academy_study_calendar_blocks) owner to postgres;
alter function academy_private.study_production_runtime_operation_contract() owner to postgres;
alter function public.academy_study_begin_production_session_v1(jsonb, text) owner to postgres;
alter function public.academy_study_read_production_session_v1(text) owner to postgres;
alter function public.academy_study_transition_production_session_v1(text, bigint, text, text, text, timestamptz, text) owner to postgres;
alter function public.academy_study_read_session_checkpoint_v1(text) owner to postgres;
alter function public.academy_study_compare_and_swap_session_checkpoint_v1(text, bigint, text, jsonb) owner to postgres;
alter function public.academy_study_list_production_calendar_v1(text) owner to postgres;
alter function public.academy_study_read_production_calendar_block_v1(text) owner to postgres;
alter function public.academy_study_transition_calendar_block_v2(text, bigint, text, timestamptz, text, text) owner to postgres;
alter function public.academy_study_complete_calendar_segment_v1(text, text, bigint, timestamptz, text) owner to postgres;
alter function public.academy_study_execute_verified_runtime_v2(text, text, text, jsonb) owner to postgres;
alter function public.academy_study_production_wire_readiness_v1() owner to postgres;

revoke all on table academy_private.study_production_sessions
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_production_session_checkpoints
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_production_calendar_segments
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_current_binding(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_session_request_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_checkpoint_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_session_integrity(academy_private.study_production_sessions)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_checkpoint_integrity(academy_private.study_production_session_checkpoints)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_set_production_session_integrity()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_set_production_checkpoint_integrity()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_session_ownership_guard()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_calendar_block_json(public.academy_study_calendar_blocks)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_production_runtime_operation_contract()
  from public, anon, authenticated, service_role;

revoke all on function public.academy_study_begin_production_session_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_production_session_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_transition_production_session_v1(text, bigint, text, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_session_checkpoint_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_compare_and_swap_session_checkpoint_v1(text, bigint, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_list_production_calendar_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_production_calendar_block_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_transition_calendar_block_v2(text, bigint, text, timestamptz, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_complete_calendar_segment_v1(text, text, bigint, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_verified_runtime_v2(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_production_wire_readiness_v1()
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_execute_verified_runtime_v2(text, text, text, jsonb)
  to service_role;
grant execute on function public.academy_study_production_wire_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column production_wire_version smallint not null default 0
    check (production_wire_version in (0, 1));

update academy_private.study_persistence_metadata
set production_wire_version = 1,
    migration_names = array_append(
      migration_names,
      '20260810120000_academy_study_production_wire_contract_v1'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'production_wire_version', 1,
      'production_wire_rpc_count', 11,
      'production_wire_direct_operation_execute_role', 'none',
      'production_wire_executor_execute_role', 'service_role',
      'production_wire_browser_authority_fields', false,
      'production_wire_checkpoint_raw_answer_persisted', false,
      'production_wire_checkpoint_transcript_persisted', false,
      'production_wire_calendar_paused_state_real', true,
      'production_wire_segment_completion_separate', true,
      'production_wire_readiness_ready', false,
      'production_wire_hosted_application_claim', false,
      'production_wire_legacy_core_session_fenced', true,
      'production_wire_legacy_begin_shares_advisory_key', true,
      'production_wire_checkpoint_ref_uniqueness_scope', 'household_student'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_execute_verified_runtime_v2(text, text, text, jsonb) is
  'Sole service-role entry point for the production learner-session SQL wire. Re-verifies an opaque current learner grant, installs only its server-bound learner principal transaction-locally, dispatches a closed operation map, and restores prior claims. The v1 executor is not replaced or changed.';
comment on function public.academy_study_production_wire_readiness_v1() is
  'Trusted-server production-wire readiness. Proves the local database contract separately but remains not-ready until downstream production session, checkpoint, calendar and runtime composition adapters exist.';

commit;
