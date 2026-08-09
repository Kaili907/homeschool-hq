-- Learner-session runtime operations: event append and calendar transition.
--
-- The verified academic runtime surface has, until now, been able to read a
-- learner's calendar and dashboard and to drive session and checkpoint state.
-- The production session bundle needs two more operations, and only two:
--
--   event:append        durable, idempotent append to the session event ledger
--   calendar:transition server-validated calendar block state change under CAS
--
-- preferences:write is deliberately NOT here. Preferences are adult-managed
-- records and belong to the adult/parent authority lane, which reaches the
-- database through academy_study_upsert_adult_managed_record with adult_only
-- authorization. Putting it on the learner surface would hand a learner-session
-- grant a write it must never hold.
--
--
-- ONE OPERATION AUTHORITY
--
-- The executor used to spell its operation set twice in its own body: once as a
-- literal `p_operation not in (...)` list, and once as a `case` expression that
-- derived the required capability. Two lists that must agree, in one function,
-- with nothing forcing them to. Adding operations to that shape means editing
-- both, and an operation added to the first and missed by the second falls
-- through to the `else` arm and silently acquires student:attempts:create.
--
-- So the pair collapses into one function, academy_private.study_runtime_
-- operation_contract(), which returns the whole operation -> capability map.
-- Admission and capability derivation now read the SAME object: an operation
-- absent from the map is denied, and the capability the caller declared must
-- equal the one the map names. There is no `else` arm left to fall through.
--
-- That function is also what the drift test reads. The gateway (Netlify) and the
-- browser runtime each carry their own literal copy of this map, deliberately --
-- three independent lists, cross-checked, rather than one list imported three
-- ways, because the server list must be able to disagree with a stale deployed
-- client and be caught doing it. The test executes this function and compares it
-- to both, so a list that drifts fails a test rather than a learner request.
--
--
-- N1  event:append
--
-- academy_study_append_learner_event_v1 appends one minimized event to
-- academy_study_event_ledger. The existing academy_study_append_event is not
-- widened: it is a frozen, hosted-history function that hard-codes a single kind
-- ('tutor_event_accepted') and a constant payload, and it has no parameter for a
-- kind or a payload at all. The new function is the general form.
--
-- Exact keys, closed statuses, no client authority:
--   * the event kind must be one this lane admits, per
--     academy_private.study_learner_event_kind_supported;
--   * the payload must satisfy academy_study_event_payload_is_valid for THAT
--     kind, which enforces the per-kind exact key set, the minimization rule and
--     the value domains -- the same predicate the ledger's own CHECK constraint
--     enforces, so the validator and the table cannot disagree;
--   * the session is resolved by id and then re-bound to the grant: the caller's
--     authorized household must be the session's household, and the grant's
--     student must be the session's student. A session id belonging to another
--     household or another learner fails closed;
--   * status is one of appended / duplicate-ignored / idempotency-collision.
--
-- The apply-time assertion below establishes that every kind this lane admits is
-- a kind the frozen payload validator accepts, so the two cannot drift into a
-- state where a kind is admitted here and then rejected by the table CHECK as an
-- unhandled exception rather than a closed status. The reverse containment is
-- deliberately NOT asserted: a kind the validator knows and this lane omits is a
-- kind the learner surface cannot append, which is the fail-closed direction.
--
--
-- N2  calendar:transition
--
-- academy_study_transition_calendar_block_v1 changes ONE calendar block's state
-- and nothing else. The learner may not whole-row-upsert a calendar block: the
-- only function that writes a whole calendar row is
-- academy_study_upsert_adult_managed_record, whose authorization is adult_only,
-- and it is unreachable from this surface. There is no calendar write on the
-- learner lane other than this transition.
--
-- The legal state machine is server-owned and lives in exactly one place,
-- academy_private.study_calendar_transition_target(transition, state), which
-- returns the target state or NULL. NULL means illegal, and illegal fails closed
-- -- it does not become a no-op, and it does not become 'stored'. The client
-- names a transition; it never names a target state, so there is no shape in
-- which a client-chosen state reaches the row.
--
--   start     scheduled | available -> in_progress
--   pause     in_progress           -> available
--   complete  in_progress           -> completed
--
-- There is no 'resume' transition: `start` already admits `available`, which is
-- where `pause` leaves the block, so a separate resume would be a second name
-- for the same edge. 'cancelled' is not reachable from here at all -- cancelling
-- a scheduled block is an adult decision.
--
-- pauseCategory is required on pause and forbidden otherwise; it is recorded
-- durably as the audit event's reason_code. segmentRef is optional on pause and
-- forbidden otherwise; when present it records the resume point in
-- resume_segment_id, which academy_study_calendar_resume_check permits only on a
-- block that already carries a resume_session_id -- so a segment ref offered for
-- a block with no bound session fails closed rather than violating the
-- constraint at insert time.
--
-- `at` is the learner-asserted instant of the transition. It is not trusted as
-- authority and it does not become the row's updated_at, which is trigger-owned.
-- It is bounded (not meaningfully in the future, not stale beyond a day) and it
-- is part of the idempotency fingerprint, so a replay of the same idempotency
-- key with a different `at` is an idempotency-collision rather than a silent
-- second application.
--
-- expectedRevision is mandatory and is compared for exact equality. A missing
-- expectedRevision is refused as an invalid request, NOT reported as a
-- revision-conflict: revision-conflict tells a client "retry with
-- currentRevision", which would let a caller that never had a revision learn one
-- and then blind-write. The two failures are distinguishable on purpose.
--
--
-- PRIVACY
--
-- No conversation, transcript or prompt text reaches either function. Event
-- payloads are exact-key structures of enumerated codes, identifiers and
-- numbers; academy_study_payload_is_minimized (inside the payload validator)
-- refuses raw answers, transcripts and credential-shaped strings. Audit metadata
-- is restricted by academy_study_audit_metadata_is_valid to an allow-listed key
-- set of identifier-valid values, so no free-form learner prose can enter the
-- ledger through either path.
--
--
-- REACHABILITY
--
-- Neither new function is granted to anon, authenticated or service_role. They
-- are reachable only from academy_study_execute_verified_runtime_v1, which is
-- SECURITY DEFINER, owned by postgres, executable by service_role alone, and
-- which resolves the learner-session grant itself before rebinding claims. A
-- browser that obtains a service-role key still cannot call these directly, and
-- no second HTTP endpoint is added: both operations ride the one existing
-- academic-runtime endpoint.
--
-- Forward-only. No historical migration is edited. The Academic readiness
-- contract from 20260808150000 is untouched: the function whose body it pins by
-- SHA-256 is academy_study_upsert_adult_managed_record, which this migration
-- does not read, replace or call. No hosted execution is implied by checking
-- this in, and nothing here enables Study.

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
    raise exception 'STUDY_LEARNER_RUNTIME predecessor marker mismatch';
  end if;

  if marker.storage_version is distinct from 1
     or marker.authorization_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.actor_binding_version is distinct from 1
     or marker.academic_readiness_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260808120000_academy_study_actor_bound_session_verification',
       '20260808150000_academy_study_academic_readiness_contract'
     ]::text[]) then
    raise exception 'STUDY_LEARNER_RUNTIME predecessor marker mismatch';
  end if;

  -- The academic readiness contract must be present as a PROPERTY, not merely as
  -- a name in the list. A name can be appended by a migration that failed
  -- partway; the manifest fact is written in the same statement as the bump.
  if coalesce(marker.security_manifest, '{}'::jsonb)
       @> jsonb_build_object('academic_readiness_version', 1)
     is not true then
    raise exception 'STUDY_LEARNER_RUNTIME predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260809120000_academy_study_learner_runtime_operations'
     ]::text[] then
    raise exception 'STUDY_LEARNER_RUNTIME already applied';
  end if;

  -- Creation, never replacement, for everything this migration owns. If any of
  -- these signatures already exists the migration refuses rather than redefining
  -- a function it did not write.
  if to_regprocedure(
       'academy_private.study_runtime_operation_contract()') is not null
     or to_regprocedure(
       'academy_private.study_learner_event_kind_supported(text)') is not null
     or to_regprocedure(
       'academy_private.study_calendar_transition_target(text,text)') is not null
     or to_regprocedure(
       'public.academy_study_append_learner_event_v1(text,text,text,jsonb,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_transition_calendar_block_v1(text,bigint,text,timestamptz,text,text,text)'
     ) is not null then
    raise exception 'STUDY_LEARNER_RUNTIME object collision';
  end if;

  -- The executor this migration replaces must already exist in the exact
  -- signature being replaced. Without this, a lineage missing it would have the
  -- executor CREATED here with none of the grants or ownership the original
  -- carries, which is a silently different security posture.
  if to_regprocedure(
       'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)'
     ) is null then
    raise exception 'STUDY_LEARNER_RUNTIME executor missing';
  end if;
end;
$$;

-- The single operation authority. Admission and capability derivation both read
-- this one object, so an operation cannot be admitted with a capability nobody
-- wrote down, and a capability cannot be assigned to an operation nobody
-- admitted.
create function academy_private.study_runtime_operation_contract()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'dashboard:read', 'student:progress:read',
    'calendar:read', 'student:assignments:read',
    'calendar:transition', 'student:attempts:create',
    'session:begin', 'student:attempts:create',
    'session:transition', 'student:attempts:create',
    'checkpoint:read', 'student:progress:read',
    'checkpoint:compare-and-swap', 'student:attempts:create',
    'event:append', 'student:attempts:create'
  );
$$;

-- The event kinds a learner session may append. Narrower than what the ledger's
-- payload validator knows, and allowed to stay narrower: a kind omitted here is
-- simply not appendable from this lane.
create function academy_private.study_learner_event_kind_supported(
  p_event_kind text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_event_kind in (
    'session_started', 'session_paused', 'session_resumed',
    'session_completed', 'session_abandoned', 'segment_completed',
    'technical_interruption'
  );
$$;

-- The calendar state machine, in one place. NULL target means the transition is
-- illegal from that state; callers fail closed on NULL rather than treating it
-- as "no change".
create function academy_private.study_calendar_transition_target(
  p_transition text,
  p_state text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_transition = 'start' and p_state in ('scheduled', 'available')
      then 'in_progress'
    when p_transition = 'pause' and p_state = 'in_progress'
      then 'available'
    when p_transition = 'complete' and p_state = 'in_progress'
      then 'completed'
    else null
  end;
$$;

do $$
declare
  probe_kind text;
  probe_payload jsonb;
begin
  -- Every kind this lane admits must be a kind the frozen payload validator
  -- accepts, or the ledger CHECK constraint would turn a legitimate append into
  -- an unhandled constraint violation instead of a closed status. Probed with a
  -- well-formed payload per kind rather than assumed.
  for probe_kind, probe_payload in
    select * from (values
      ('session_started', jsonb_build_object(
        'schema_version', 1, 'state_to', 'active')),
      ('session_paused', jsonb_build_object(
        'schema_version', 1, 'segment_id', 'segment.1',
        'state_from', 'active', 'state_to', 'paused')),
      ('session_resumed', jsonb_build_object(
        'schema_version', 1, 'segment_id', 'segment.1',
        'state_from', 'paused', 'state_to', 'active')),
      ('session_completed', jsonb_build_object(
        'schema_version', 1, 'state_from', 'active', 'state_to', 'completed',
        'outcome_code', 'completed', 'active_seconds', 0,
        'paused_seconds', 0, 'break_seconds', 0)),
      ('session_abandoned', jsonb_build_object(
        'schema_version', 1, 'state_from', 'active', 'state_to', 'abandoned',
        'outcome_code', 'abandoned', 'active_seconds', 0,
        'paused_seconds', 0, 'break_seconds', 0)),
      ('segment_completed', jsonb_build_object(
        'schema_version', 1, 'segment_id', 'segment.1',
        'outcome_code', 'completed')),
      ('technical_interruption', jsonb_build_object(
        'schema_version', 1, 'segment_id', 'segment.1',
        'reason_code', 'network-unavailable',
        'state_to', 'technical_interruption'))
    ) as probe(kind, payload)
  loop
    if not academy_private.study_learner_event_kind_supported(probe_kind) then
      raise exception 'STUDY_LEARNER_RUNTIME event kind probe incomplete: %',
        probe_kind;
    end if;
    if not public.academy_study_event_payload_is_valid(
      probe_kind, probe_payload
    ) then
      raise exception 'STUDY_LEARNER_RUNTIME event kind not accepted by ledger: %',
        probe_kind;
    end if;
  end loop;
  -- And a kind nobody wrote down is admitted by neither.
  if academy_private.study_learner_event_kind_supported(
       'study.unknown-event-kind')
     or public.academy_study_event_payload_is_valid(
       'study.unknown-event-kind', jsonb_build_object('schema_version', 1)) then
    raise exception 'STUDY_LEARNER_RUNTIME event kind probe fails open';
  end if;
end;
$$;

create function public.academy_study_append_learner_event_v1(
  p_session_id text,
  p_event_id text,
  p_event_kind text,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  target_session public.academy_study_sessions%rowtype;
  resolved_household_id uuid;
  prior_event public.academy_study_event_ledger%rowtype;
  next_sequence bigint;
  payload_digest text;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  -- Kind and payload are validated together, against the same predicate the
  -- ledger's CHECK constraint uses, so an admitted kind can never reach the
  -- table with a payload the table refuses.
  if not public.academy_study_identifier_is_valid(p_session_id)
     or not public.academy_study_identifier_is_valid(p_event_id)
     or not public.academy_study_identifier_is_valid(p_idempotency_key)
     or not academy_private.study_learner_event_kind_supported(p_event_kind)
     or not public.academy_study_event_payload_is_valid(
       p_event_kind, p_payload
     ) then
    raise exception 'STUDY_EVENT_INVALID' using errcode = '22023';
  end if;

  select * into target_session
  from public.academy_study_sessions
  where id = p_session_id
  for update;
  if target_session.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  -- Re-verifies the grant against the session's OWN student, then re-verifies
  -- that the household the grant authorizes is the household the session is
  -- filed under. A session id from another household or another learner cannot
  -- satisfy both.
  resolved_household_id := academy_private.study_authorized_household(
    target_session.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from target_session.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  payload_digest := academy_private.study_sha256_json(p_payload);

  select * into prior_event
  from public.academy_study_event_ledger
  where session_id = p_session_id
    and (event_id = p_event_id or idempotency_key = p_idempotency_key)
  order by case when event_id = p_event_id then 0 else 1 end
  limit 1;
  if prior_event.event_id is not null then
    if prior_event.event_id = p_event_id
       and prior_event.event_version = 1
       and prior_event.event_kind = p_event_kind
       and prior_event.idempotency_key = p_idempotency_key
       and prior_event.payload_digest = payload_digest
       and prior_event.minimized_payload = p_payload then
      perform academy_private.study_append_audit(
        target_session.household_id,
        target_session.student_id,
        'event.replay',
        'event',
        p_event_id,
        null,
        correlation,
        jsonb_build_object(
          'event_id', p_event_id,
          'event_version', 1,
          'event_kind', p_event_kind,
          'result_code', 'duplicate_ignored'
        )
      );
      return jsonb_build_object('status', 'duplicate-ignored');
    end if;
    perform academy_private.study_append_audit(
      target_session.household_id,
      target_session.student_id,
      'event.collision',
      'event',
      p_event_id,
      'idempotency_collision',
      correlation,
      jsonb_build_object(
        'event_id', p_event_id,
        'event_version', 1,
        'event_kind', p_event_kind,
        'result_code', 'idempotency_collision'
      )
    );
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  select coalesce(max(event.sequence_number), 0) + 1
    into next_sequence
  from public.academy_study_event_ledger as event
  where event.session_id = p_session_id;
  insert into public.academy_study_event_ledger (
    session_id,
    event_id,
    household_id,
    student_id,
    event_version,
    event_kind,
    sequence_number,
    minimized_payload,
    payload_digest,
    idempotency_key
  ) values (
    p_session_id,
    p_event_id,
    target_session.household_id,
    target_session.student_id,
    1,
    p_event_kind,
    next_sequence,
    p_payload,
    payload_digest,
    p_idempotency_key
  );
  perform academy_private.study_append_audit(
    target_session.household_id,
    target_session.student_id,
    'event.accept',
    'event',
    p_event_id,
    null,
    correlation,
    jsonb_build_object(
      'event_id', p_event_id,
      'event_version', 1,
      'event_kind', p_event_kind,
      'result_code', 'appended'
    )
  );
  return jsonb_build_object('status', 'appended');
end;
$$;

create function public.academy_study_transition_calendar_block_v1(
  p_block_id text,
  p_expected_revision bigint,
  p_transition text,
  p_at timestamptz,
  p_segment_ref text,
  p_pause_category text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  target_block public.academy_study_calendar_blocks%rowtype;
  resolved_household_id uuid;
  target_state text;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  -- A missing expectedRevision is an invalid request, never a revision
  -- conflict: reporting a conflict would hand back currentRevision and let a
  -- caller that never held a revision learn one and then blind-write.
  if p_expected_revision is null or p_expected_revision < 1
     or not public.academy_study_identifier_is_valid(p_block_id)
     or not public.academy_study_identifier_is_valid(p_idempotency_key)
     or p_transition not in ('start', 'pause', 'complete')
     or p_at is null
     or p_at > clock_timestamp() + interval '5 minutes'
     or p_at < clock_timestamp() - interval '24 hours' then
    raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
  end if;
  -- pauseCategory is required by pause and refused by everything else;
  -- segmentRef is optional for pause and refused by everything else.
  if p_transition = 'pause' then
    if p_pause_category is null
       or p_pause_category not in (
         'student-request', 'adult-directed', 'scheduled', 'accessibility-need'
       )
       or (p_segment_ref is not null
         and not public.academy_study_identifier_is_valid(p_segment_ref)) then
      raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
    end if;
  elsif p_pause_category is not null or p_segment_ref is not null then
    raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
  end if;

  select * into target_block
  from public.academy_study_calendar_blocks
  where id = p_block_id
  for update;
  if target_block.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  -- Same two-part re-verification as the event lane: the grant must authorize
  -- the block's OWN student, and the household it authorizes must be the
  -- household the block is filed under.
  resolved_household_id := academy_private.study_authorized_household(
    target_block.student_id,
    'student:attempts:create',
    false
  );
  if resolved_household_id is distinct from target_block.household_id then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  -- A resume point is a (session, segment) pair. Offering a segment for a block
  -- with no bound session fails closed here rather than violating
  -- academy_study_calendar_resume_check at write time.
  if p_segment_ref is not null and target_block.resume_session_id is null then
    raise exception 'STUDY_CALENDAR_TRANSITION_INVALID' using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'block_id', p_block_id,
    'expected_revision', p_expected_revision,
    'transition', p_transition,
    'at', p_at,
    'segment_ref', p_segment_ref,
    'pause_category', p_pause_category
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'calendar:' || p_block_id
    and operation_kind = 'calendar_transition_v1'
    and idempotency_key = p_idempotency_key;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  -- The transition is legal or it is not. An illegal transition raises; it never
  -- degrades into a silent no-op that reports 'stored'.
  target_state := academy_private.study_calendar_transition_target(
    p_transition, target_block.state
  );
  if target_state is null then
    raise exception 'STUDY_CALENDAR_TRANSITION_ILLEGAL' using errcode = '22023';
  end if;

  if target_block.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', target_block.revision
    );
  else
    update public.academy_study_calendar_blocks
    set state = target_state,
        completion_units = case
          when target_state = 'completed' then required_units
          else completion_units end,
        resume_segment_id = coalesce(p_segment_ref, resume_segment_id)
    where id = p_block_id
      and household_id = resolved_household_id
      and student_id = target_block.student_id;
    result_value := jsonb_build_object(
      'status', 'stored',
      'revision', p_expected_revision + 1
    );
    perform academy_private.study_append_audit(
      target_block.household_id,
      target_block.student_id,
      'calendar.schedule',
      'calendar',
      p_block_id,
      p_pause_category,
      correlation,
      jsonb_build_object(
        'expected_revision', p_expected_revision,
        'revision', p_expected_revision + 1,
        'state_from', target_block.state,
        'state_to', target_state,
        'result_code', 'stored'
      )
    );
  end if;
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'calendar:' || p_block_id,
    'calendar_transition_v1',
    p_idempotency_key,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

-- The executor gains the two operations and loses its duplicated operation
-- list. Replacement, not creation: ownership and the service_role-only execute
-- grant are the ones the original carries, and are re-asserted below.
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
  required_capability text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  -- One authority for both questions. An operation absent from the contract has
  -- no capability, so it is denied; there is no fall-through arm that could
  -- assign a capability to an operation nobody admitted.
  required_capability :=
    academy_private.study_runtime_operation_contract() ->> p_operation;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or required_capability is null
     or p_required_capability is distinct from required_capability then
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied', 'operation', p_operation);
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
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied', 'operation', p_operation);
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', grant_row.id,
    'role', 'authenticated',
    'academy_principal_kind', 'student_session_grant'
  )::text, true);
  begin
    case p_operation
      when 'dashboard:read' then
        if p_request <> '{}'::jsonb then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := (select jsonb_build_object(
          'sessions', coalesce(jsonb_agg(jsonb_build_object(
            'sessionId', session.id,
            'state', session.state,
            'lessonId', session.lesson_id,
            'revision', session.revision,
            'updatedAt', session.updated_at
          ) order by session.updated_at desc), '[]'::jsonb))
        from (
          select * from public.academy_study_sessions
          where household_id = grant_row.household_id and student_id = grant_row.student_id
          order by updated_at desc limit 50
        ) as session);
      when 'calendar:read' then
        if not public.academy_study_json_has_exact_keys(p_request, array['cursor']::text[])
           or (p_request ->> 'cursor' is not null
             and not public.academy_study_identifier_is_valid(p_request ->> 'cursor')) then
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
            'revision', block.revision
          ) order by block.scheduled_start), '[]'::jsonb))
        from (
          select * from public.academy_study_calendar_blocks
          where household_id = grant_row.household_id and student_id = grant_row.student_id
            and (p_request ->> 'cursor' is null or id > p_request ->> 'cursor')
          order by scheduled_start limit 100
        ) as block);
      when 'calendar:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'blockId','expectedRevision','transition','at','segmentRef',
          'pauseCategory','idempotencyKey'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_transition_calendar_block_v1(
          p_request ->> 'blockId',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'transition',
          (p_request ->> 'at')::timestamptz,
          p_request ->> 'segmentRef',
          p_request ->> 'pauseCategory',
          p_request ->> 'idempotencyKey'
        );
      when 'session:begin' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['session','idempotencyKey']::text[]
        ) or jsonb_typeof(p_request -> 'session') <> 'object' then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        session_payload := (p_request -> 'session') ||
          jsonb_build_object('student_id', grant_row.student_id);
        body := public.academy_study_create_session(
          session_payload, p_request ->> 'idempotencyKey'
        );
      when 'session:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId','expectedRevision','state','completedAt','idempotencyKey'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_transition_session(
          p_request ->> 'sessionId',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'state',
          (p_request ->> 'completedAt')::timestamptz,
          p_request ->> 'idempotencyKey'
        );
      when 'checkpoint:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['sessionId']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_read_checkpoint(p_request ->> 'sessionId');
      when 'checkpoint:compare-and-swap' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId','expectedRevision','mutationId','checkpoint'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_compare_and_swap_checkpoint(
          p_request ->> 'sessionId',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'mutationId',
          p_request -> 'checkpoint'
        );
      when 'event:append' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId','eventId','eventKind','payload','idempotencyKey'
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
    'schemaVersion', 1,
    'status', 'ok',
    'operation', p_operation,
    'body', coalesce(body, 'null'::jsonb)
  );
end;
$$;

alter function academy_private.study_runtime_operation_contract() owner to postgres;
alter function academy_private.study_learner_event_kind_supported(text) owner to postgres;
alter function academy_private.study_calendar_transition_target(text, text) owner to postgres;
alter function public.academy_study_append_learner_event_v1(text, text, text, jsonb, text)
  owner to postgres;
alter function public.academy_study_transition_calendar_block_v1(
  text, bigint, text, timestamptz, text, text, text) owner to postgres;
alter function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb)
  owner to postgres;

revoke all on function academy_private.study_runtime_operation_contract()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_learner_event_kind_supported(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_calendar_transition_target(text, text)
  from public, anon, authenticated, service_role;

-- Neither learner operation is granted to anyone. The only caller is the
-- service_role-only executor above, which is SECURITY DEFINER and owned by
-- postgres; there is no direct path to either from a browser or from a
-- service-role client.
revoke all on function public.academy_study_append_learner_event_v1(text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_transition_calendar_block_v1(
  text, bigint, text, timestamptz, text, text, text)
  from public, anon, authenticated, service_role;

revoke all on function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb)
  to service_role;

alter table academy_private.study_persistence_metadata
  add column learner_runtime_operations_version smallint not null default 0
    check (learner_runtime_operations_version in (0, 1));

update academy_private.study_persistence_metadata
set learner_runtime_operations_version = 1,
    migration_names = array_append(
      migration_names,
      '20260809120000_academy_study_learner_runtime_operations'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'learner_runtime_operations_version', 1,
      -- The operation set is not restated here. Restating it would create a
      -- fourth list to keep in step with the three that already have to agree,
      -- and this one would be the only one nothing executes. The authority is
      -- named instead.
      'learner_runtime_operation_authority',
        'academy_private.study_runtime_operation_contract',
      'learner_runtime_operation_authority_is_sole_admission', true,
      'learner_runtime_operations_added',
        array['event:append', 'calendar:transition']::text[],
      'learner_runtime_preferences_write_present', false,
      'learner_runtime_endpoint_count', 1,
      'learner_runtime_event_kind_authority',
        'academy_private.study_learner_event_kind_supported',
      'learner_runtime_event_payload_validator',
        'public.academy_study_event_payload_is_valid',
      'learner_runtime_calendar_state_authority',
        'academy_private.study_calendar_transition_target',
      'learner_runtime_calendar_whole_row_upsert_reachable', false,
      'learner_runtime_client_supplied_authority_accepted', false,
      'learner_runtime_operations_directly_executable_by', 'none',
      'learner_runtime_calendar_cas_required', true,
      'learner_runtime_calendar_missing_revision_is_invalid_not_conflict', true
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_append_learner_event_v1(text, text, text, jsonb, text) is
  'Learner-session event ledger append. Validates the event kind against academy_private.study_learner_event_kind_supported and the payload against academy_study_event_payload_is_valid -- the same predicate the ledger CHECK constraint enforces, so an admitted kind can never reach the table with a payload the table refuses. Re-verifies the caller''s grant against the session''s own student and re-verifies that the authorized household is the session''s household, so a session belonging to another household or learner fails closed. Idempotent: returns appended, duplicate-ignored or idempotency-collision. Accepts no client-supplied learner, household or grant authority, and no free-form prose. Not granted to any role; reachable only from academy_study_execute_verified_runtime_v1.';

comment on function public.academy_study_transition_calendar_block_v1(text, bigint, text, timestamptz, text, text, text) is
  'Server-validated learner calendar block transition. The client names a transition, never a target state: the legal state machine is academy_private.study_calendar_transition_target, and an illegal transition raises rather than becoming a no-op or a stored result. No whole-row upsert is possible from this lane -- only state, completion units on completion, and an optional resume segment change. Compare-and-swap on the block revision is mandatory and exact; a missing expectedRevision is an invalid request, deliberately distinguishable from revision-conflict, which would otherwise hand a currentRevision to a caller that never held one. pauseCategory is required by pause and refused elsewhere, and is recorded as the audit reason code; the asserted `at` is bounded and enters the idempotency fingerprint but never becomes authority. Returns stored + revision, revision-conflict + currentRevision, or idempotency-collision. Not granted to any role; reachable only from academy_study_execute_verified_runtime_v1.';

comment on function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb) is
  'Verified academic runtime executor for learner-session grants. Admission and capability derivation read one authority, academy_private.study_runtime_operation_contract, so an operation cannot be admitted without a written capability and no fall-through arm can assign one to an operation nobody admitted. Resolves and re-verifies the opaque grant, rebinds request claims for the duration of the operation and restores them on every path. Carries the eight learner operations; preferences:write is not among them and belongs to the adult authority lane. Executable by service_role only.';

commit;
