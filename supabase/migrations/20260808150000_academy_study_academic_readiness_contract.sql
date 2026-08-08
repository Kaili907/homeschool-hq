-- Read-only consolidated academic readiness contract.
--
-- Study production readiness names seven academic dependencies. Two of them —
-- study-session-adapter and checkpoint-adapter — are provable from the Netlify
-- operation surface, because academy_study_execute_verified_runtime_v1 exposes
-- session:begin/session:transition and checkpoint:read/checkpoint:compare-and-swap.
-- The remaining five have no operation on that surface at all. Calendar's single
-- operation, calendar:read, carries the student:assignments:read capability and
-- never touches the mutation contract the calendar adapter actually requires, so
-- treating it as evidence of calendar readiness would be a category error.
--
-- This migration adds one function that reads catalog and contract metadata for
-- all seven and reports a closed per-dependency status. It is READ ONLY: it
-- executes no academic RPC, inserts no review, writes no calendar block, appends
-- no event, and reads no learner row, no settings value and no adult-private
-- content. Privacy-sensitive subsystems are established from schema and function
-- metadata alone.
--
-- Additive and forward-only. No academic subsystem is modified, no academic
-- privilege is widened, and nothing here authorizes Study. The seven DB facts
-- this function returns are one half of a defence-in-depth pair; the Netlify
-- operation surface remains an independent prerequisite, and neither side alone
-- may report a dependency fully ready.
--
-- No hosted execution is implied by checking this in.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;

  -- Predecessor state is asserted by containment and by explicit marker
  -- properties, never by exact equality of migration_names. Exact equality pins
  -- a migration to one chain snapshot and breaks as soon as a legitimately
  -- earlier-versioned sibling lands ahead of it.
  select * into marker
  from academy_private.study_persistence_metadata where singleton;
  -- Without this, an absent singleton leaves every comparison below NULL, no
  -- branch is taken, and an unknown state applies fail-open.
  if not found then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  -- The academic contract this function describes is defined by the storage and
  -- authorization migrations; the actor-binding predecessor is the immediate
  -- lineage requirement.
  if marker.storage_version is distinct from 1
     or marker.authorization_version is distinct from 1
     or marker.verified_identity_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.actor_binding_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260808120000_academy_study_actor_bound_session_verification'
     ]::text[]) then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  -- The actor binding must be present as a PROPERTY, not merely as a name in the
  -- list. A name can be appended by a migration that failed partway; the manifest
  -- fact is written in the same statement as the version bump.
  if coalesce(marker.security_manifest, '{}'::jsonb)
       @> jsonb_build_object('actor_binding_version', 1)
     is not true then
    raise exception 'STUDY_ACADEMIC_READINESS predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260808150000_academy_study_academic_readiness_contract'
     ]::text[] then
    raise exception 'STUDY_ACADEMIC_READINESS already applied';
  end if;

  -- Creation, never replacement. If any of these signatures already exists this
  -- migration must refuse rather than redefine a function it did not write.
  if to_regprocedure('public.academy_study_academic_readiness_v1()') is not null
     or to_regprocedure(
       'academy_private.study_academic_function_ready(text)') is not null
     or to_regprocedure(
       'academy_private.study_academic_table_ready(text,text[])') is not null
     or to_regprocedure(
       'academy_private.study_academic_record_kind_ready(text)') is not null then
    raise exception 'STUDY_ACADEMIC_READINESS object collision';
  end if;
end;
$$;

-- A required academic function is ready only when the whole contract holds: the
-- exact signature exists, it is owned by postgres, it is security definer with a
-- pinned search_path, the learner-facing role the adapters authenticate as can
-- execute it, and no unauthenticated role can. Anything less is a name.
--
-- The anon test is what catches a PUBLIC grant: anon inherits PUBLIC, so a
-- privilege widened to PUBLIC shows up here without a separate probe.
create function academy_private.study_academic_function_ready(p_signature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  ready boolean;
begin
  target := to_regprocedure(p_signature);
  if target is null then
    return false;
  end if;
  select routine.prosecdef
    and pg_get_userbyid(routine.proowner) = 'postgres'
    and coalesce(routine.proconfig, array[]::text[])
      @> array['search_path=pg_catalog']
    and has_function_privilege('authenticated', target, 'EXECUTE')
    and not has_function_privilege('anon', target, 'EXECUTE')
  into ready
  from pg_proc as routine
  where routine.oid = target;
  return coalesce(ready, false);
end;
$$;

-- A required academic table is ready only when the relation exists, still
-- enforces row level security, and still carries every column the adapter
-- writes. Existence alone would be satisfied by an empty relation wearing the
-- right name, which is exactly the confusion this contract has to remove.
create function academy_private.study_academic_table_ready(
  p_table text,
  p_required_columns text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  present text[];
  protected boolean;
begin
  target := to_regclass(p_table);
  if target is null or p_required_columns is null then
    return false;
  end if;
  select relation.relrowsecurity into protected
  from pg_class as relation where relation.oid = target;
  if coalesce(protected, false) is not true then
    return false;
  end if;
  select coalesce(array_agg(attribute.attname::text), array[]::text[])
  into present
  from pg_attribute as attribute
  where attribute.attrelid = target
    and attribute.attnum > 0
    and not attribute.attisdropped;
  return present @> p_required_columns;
end;
$$;

-- Review, calendar and parent settings are three record kinds of ONE adult-managed
-- mutation, so their required signature is identical and signature checks alone
-- cannot tell them apart. The per-kind branch is the only place the contract for
-- an individual kind is expressed, so that is what is checked. A function that
-- kept its name, signature, owner, privileges and search_path but quietly stopped
-- accepting a kind would otherwise read as ready for a subsystem it can no longer
-- serve.
create function academy_private.study_academic_record_kind_ready(p_kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target oid;
  definition text;
begin
  target := to_regprocedure(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );
  if target is null or p_kind is null then
    return false;
  end if;
  definition := pg_get_functiondef(target);
  return strpos(definition, format('p_record_kind = %L', p_kind)) > 0;
end;
$$;

-- The consolidated contract. One closed record, seven closed dependency states,
-- no rows, no learner data, no free-text database error body.
create function public.academy_study_academic_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  contract_current boolean;
  session_ready boolean;
  checkpoint_ready boolean;
  adult_managed_ready boolean;
  review_ready boolean;
  calendar_ready boolean;
  parent_settings_ready boolean;
  adult_private_ready boolean;
  event_ledger_ready boolean;
begin
  -- Unchanged trusted-server boundary, copied from the sibling readiness RPCs.
  -- A learner-facing caller must never reach a catalog probe.
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  -- The academic contract version. An absent singleton leaves this NULL, which
  -- coalesces to false and fails every dependency closed rather than leaving an
  -- unknown estate looking ready.
  --
  -- authorization_version is the marker checked here because it is the one that
  -- can actually be wrong: it admits 0 or 1. storage_version is deliberately not
  -- checked — its column constraint is `check (storage_version = 1)`, so while
  -- the singleton exists it cannot hold any other value, and a predicate that
  -- can never be false is not a gate. The objects the storage migration creates
  -- are proven directly by the table checks below instead.
  select metadata.authorization_version = 1
  into contract_current
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  contract_current := coalesce(contract_current, false);

  adult_managed_ready := academy_private.study_academic_function_ready(
    'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)'
  );

  session_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_create_session(jsonb,text)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_transition_session(text,bigint,text,timestamptz,text)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_sessions',
      array[
        'id', 'household_id', 'student_id', 'lesson_id', 'subject_id', 'state',
        'started_at', 'completed_at', 'intended_local_date', 'household_timezone',
        'revision'
      ]::text[]);

  checkpoint_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_checkpoint(text)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_compare_and_swap_checkpoint(text,bigint,text,jsonb)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_checkpoints',
      array[
        'id', 'household_id', 'student_id', 'session_id', 'lesson_id',
        'segment_id', 'safe_instructional_cursor', 'completed_segment_ids',
        'per_segment_active_time', 'paused_time', 'break_time'
      ]::text[]);

  review_ready := contract_current
    and adult_managed_ready
    and academy_private.study_academic_record_kind_ready('review')
    and academy_private.study_academic_table_ready(
      'public.academy_study_reviews',
      array[
        'id', 'household_id', 'student_id', 'skill_id', 'source_session_id',
        'review_kind', 'due_at', 'intended_local_date', 'priority', 'state',
        'attempt_count', 'interval_days', 'reteaching_required',
        'prerequisite_remediation_required', 'idempotency_key', 'revision'
      ]::text[]);

  calendar_ready := contract_current
    and adult_managed_ready
    and academy_private.study_academic_record_kind_ready('calendar')
    and academy_private.study_academic_table_ready(
      'public.academy_study_calendar_blocks',
      array[
        'id', 'household_id', 'student_id', 'block_type', 'source_reference',
        'scheduled_start', 'intended_local_date', 'explicit_offset',
        'duration_minutes', 'completion_units', 'required_units',
        'resume_session_id', 'resume_segment_id', 'state', 'idempotency_key',
        'revision'
      ]::text[]);

  parent_settings_ready := contract_current
    and adult_managed_ready
    and academy_private.study_academic_record_kind_ready('parent_settings')
    and academy_private.study_academic_function_ready(
      'public.academy_study_effective_settings(uuid,date)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_parent_settings',
      array[
        'household_id', 'student_id', 'timer_mode', 'maximum_work_minutes',
        'break_minimum_minutes', 'break_maximum_minutes', 'required_breaks',
        'reduced_motion', 'no_audio', 'large_text', 'read_aloud',
        'speech_input_allowed', 'parent_override', 'revision'
      ]::text[]);

  -- Privacy-sensitive. Schema and function metadata only: no note body, no
  -- protected work payload, no author, no count of either.
  adult_private_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_store_protected_work(jsonb)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_protected_work(uuid,text,bigint)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_append_adult_note(jsonb)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_list_adult_note_metadata(uuid)')
    and academy_private.study_academic_function_ready(
      'public.academy_study_read_adult_note(uuid,text,bigint,uuid)')
    and academy_private.study_academic_table_ready(
      'academy_private.study_protected_learner_work',
      array[
        'id', 'revision', 'household_id', 'student_id', 'session_id',
        'encryption_scheme', 'kms_key_reference', 'wrapped_data_key', 'nonce',
        'authentication_tag', 'encrypted_payload', 'keyed_integrity_tag',
        'retention_state', 'expires_at'
      ]::text[])
    and academy_private.study_academic_table_ready(
      'academy_private.study_adult_notes',
      array[
        'note_id', 'revision', 'household_id', 'student_id', 'category',
        'encrypted_body', 'encryption_scheme', 'kms_key_reference',
        'wrapped_data_key', 'nonce', 'authentication_tag', 'keyed_integrity_tag',
        'author_user_id', 'retention_state', 'expires_at'
      ]::text[]);

  event_ledger_ready := contract_current
    and academy_private.study_academic_function_ready(
      'public.academy_study_append_event(text,text,integer,text)')
    and academy_private.study_academic_table_ready(
      'public.academy_study_event_ledger',
      array[
        'session_id', 'event_id', 'household_id', 'student_id', 'event_kind',
        'sequence_number', 'accepted_at', 'minimized_payload', 'payload_digest',
        'idempotency_key'
      ]::text[]);

  return jsonb_build_object(
    'schemaVersion', 1,
    'contractVersion', 1,
    'status', case when session_ready and checkpoint_ready and review_ready
        and calendar_ready and parent_settings_ready and adult_private_ready
        and event_ledger_ready
      then 'ready' else 'not-ready' end,
    'dependencies', jsonb_build_object(
      'study-session-adapter',
        case when session_ready then 'ready' else 'not-ready' end,
      'checkpoint-adapter',
        case when checkpoint_ready then 'ready' else 'not-ready' end,
      'review-queue',
        case when review_ready then 'ready' else 'not-ready' end,
      'calendar-adapter',
        case when calendar_ready then 'ready' else 'not-ready' end,
      'parent-settings-adapter',
        case when parent_settings_ready then 'ready' else 'not-ready' end,
      'adult-private-adapter',
        case when adult_private_ready then 'ready' else 'not-ready' end,
      'event-ledger',
        case when event_ledger_ready then 'ready' else 'not-ready' end
    )
  );
end;
$$;

alter function academy_private.study_academic_function_ready(text)
  owner to postgres;
alter function academy_private.study_academic_table_ready(text, text[])
  owner to postgres;
alter function academy_private.study_academic_record_kind_ready(text)
  owner to postgres;
alter function public.academy_study_academic_readiness_v1() owner to postgres;

-- The helpers are implementation detail of the readiness function, which runs as
-- postgres; no role needs them directly.
revoke all on function academy_private.study_academic_function_ready(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_academic_table_ready(text, text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_academic_record_kind_ready(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_academic_readiness_v1()
  from public, anon, authenticated, service_role;

-- Server/trusted service only, matching every other Study readiness RPC. A
-- learner-facing role gaining this would learn the shape of the estate.
grant execute on function public.academy_study_academic_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column academic_readiness_version smallint not null default 0
    check (academic_readiness_version in (0, 1));

update academy_private.study_persistence_metadata
set academic_readiness_version = 1,
    migration_names = array_append(
      migration_names,
      '20260808150000_academy_study_academic_readiness_contract'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'academic_readiness_version', 1,
      'academic_readiness_read_only', true,
      'academic_readiness_execute_role', 'service_role',
      'academic_readiness_dependency_count', 7,
      'academic_readiness_authorizes_study', false
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_academic_readiness_v1() is
  'Read-only consolidated Study academic readiness. Reports a closed per-dependency status for all seven academic dependencies from catalog and contract metadata only: no academic RPC is executed, no row is read, written or counted, and no learner, settings or adult-private content is exposed. Ready means the required server-side contract exists in the expected shape, not that a table name exists. Executable by service_role only. Authorizes nothing.';

commit;
