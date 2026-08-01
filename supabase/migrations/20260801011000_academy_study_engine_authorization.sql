-- Manuel Academy Study Engine authorization and trusted mutation surface.
-- Depends on 20260801010000_academy_study_engine_storage.sql.

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
  if marker.storage_version <> 1 or marker.authorization_version <> 0
     or marker.migration_names <>
       array['20260801010000_academy_study_engine_storage']::text[] then
    raise exception 'Study Engine storage marker mismatch';
  end if;
  if exists (
    select 1
    from unnest(array[
      'public.academy_study_is_current_student(uuid,uuid,text)',
      'public.academy_study_is_adult_principal()',
      'public.academy_study_can_view(uuid,uuid)',
      'public.academy_study_can_manage(uuid)',
      'public.academy_study_append_event(text,text,integer,text)',
      'public.academy_study_compare_and_swap_checkpoint(text,bigint,text,jsonb)',
      'public.academy_study_read_checkpoint(text)',
      'public.academy_study_set_household_timezone(uuid,text,bigint,text)',
      'public.academy_study_create_session(jsonb,text)',
      'public.academy_study_transition_session(text,bigint,text,timestamptz,text)',
      'public.academy_study_upsert_adult_managed_record(text,jsonb,bigint,text)',
      'public.academy_study_effective_settings(uuid,date)',
      'public.academy_study_store_protected_work(jsonb)',
      'public.academy_study_read_protected_work(uuid,text,bigint)',
      'public.academy_study_append_adult_note(jsonb)',
      'public.academy_study_list_adult_note_metadata(uuid)',
      'public.academy_study_read_adult_note(uuid,text,bigint,uuid)',
      'public.academy_study_create_adult_review_proposal(jsonb)',
      'public.academy_study_enqueue_outbox(jsonb)',
      'public.academy_study_confirm_crypto_erasure(text,uuid,text,bigint,text)',
      'public.academy_study_transition_outbox(jsonb)',
      'public.academy_study_outbox_status(uuid)',
      'academy_private.study_jwt_claim_text(text)',
      'academy_private.study_sha256_json(jsonb)',
      'academy_private.study_authorized_household(uuid,text,boolean)',
      'academy_private.study_append_audit(uuid,uuid,text,text,text,text,uuid,jsonb)',
      'academy_private.study_checkpoint_is_valid(jsonb)',
      'academy_private.study_checkpoint_integrity(public.academy_study_checkpoints)',
      'academy_private.study_set_checkpoint_integrity()',
      'academy_private.study_is_trusted_server()'
    ]) as candidate(signature)
    where to_regprocedure(candidate.signature) is not null
  ) then
    raise exception 'Unmarked Study Engine authorization function collision';
  end if;
end;
$$;

create or replace function academy_private.study_jwt_claim_text(
  claim_name text
)
returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  raw_claims text;
begin
  raw_claims := nullif(current_setting('request.jwt.claims', true), '');
  if raw_claims is null then
    return null;
  end if;
  begin
    return (raw_claims::jsonb) ->> claim_name;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function academy_private.study_sha256_json(candidate jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(candidate::text, 'UTF8')), 'hex');
$$;

create or replace function public.academy_study_is_adult_principal()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and coalesce(
      academy_private.study_jwt_claim_text('academy_principal_kind') <>
        'student_session_grant',
      true
    );
$$;

create or replace function public.academy_study_is_current_student(
  target_household_id uuid,
  target_student_id uuid,
  required_capability text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and academy_private.study_jwt_claim_text('academy_principal_kind') =
      'student_session_grant'
    and required_capability in (
      'student:assignments:read',
      'student:attempts:create',
      'student:progress:read'
    )
    and exists (
      select 1
      from academy_private.student_session_grants as grant_row
      where grant_row.id = auth.uid()
        and grant_row.household_id = target_household_id
        and grant_row.student_id = target_student_id
        and grant_row.capabilities @> array[required_capability]::text[]
        and academy_private.is_student_session_grant_current(grant_row.id)
    );
$$;

create or replace function public.academy_study_can_view(
  target_household_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and (
      (
        public.academy_study_is_adult_principal()
        and public.academy_has_student_permission(target_student_id, 'viewer')
      )
      or public.academy_study_is_current_student(
        target_household_id,
        target_student_id,
        'student:progress:read'
      )
      or public.academy_study_is_current_student(
        target_household_id,
        target_student_id,
        'student:assignments:read'
      )
    );
$$;

create or replace function public.academy_study_can_manage(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.academy_study_is_adult_principal()
    and public.academy_has_student_permission(
      target_student_id,
      'learning_manager'
    );
$$;

create or replace function academy_private.study_authorized_household(
  target_student_id uuid,
  required_student_capability text,
  adult_only boolean default false
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  resolved_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select student.household_id
    into resolved_household_id
  from public.academy_students as student
  join public.academy_households as household
    on household.id = student.household_id
  where student.id = target_student_id
    and student.lifecycle_status = 'active'
    and household.status = 'active';

  if resolved_household_id is null
     or not (
       public.academy_study_can_manage(target_student_id)
       or (
         not adult_only
         and public.academy_study_is_current_student(
           resolved_household_id,
           target_student_id,
           required_student_capability
         )
       )
     ) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return resolved_household_id;
end;
$$;

create or replace function academy_private.study_append_audit(
  target_household_id uuid,
  target_student_id uuid,
  audit_event_type text,
  audit_target_kind text,
  audit_target_id text,
  audit_reason_code text,
  audit_correlation_id uuid,
  audit_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  inserted_id uuid;
  student_actor boolean;
begin
  student_actor := auth.uid() is not null
    and academy_private.study_jwt_claim_text('academy_principal_kind') =
      'student_session_grant';
  insert into public.academy_study_audit_events (
    household_id,
    student_id,
    actor_kind,
    actor_user_id,
    actor_student_grant_id,
    event_type,
    target_kind,
    target_id,
    reason_code,
    correlation_id,
    metadata
  ) values (
    target_household_id,
    target_student_id,
    case
      when student_actor then 'student'
      when auth.uid() is not null then 'guardian'
      when coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        academy_private.study_jwt_claim_text('role'),
        nullif(current_setting('role', true), '')
      ) = 'service_role' then 'trusted_server'
      else 'system'
    end,
    case when student_actor then null else auth.uid() end,
    case when student_actor then auth.uid() else null end,
    audit_event_type,
    audit_target_kind,
    audit_target_id,
    audit_reason_code,
    audit_correlation_id,
    audit_metadata
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

-- Safe reads are row-filtered. Every browser mutation remains function-only.
create policy academy_study_household_settings_select
  on public.academy_study_household_settings
  for select to authenticated
  using (
    public.academy_study_is_adult_principal()
    and public.academy_is_active_household_guardian(household_id)
  );
create policy academy_study_sessions_select
  on public.academy_study_sessions
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_study_checkpoints_select
  on public.academy_study_checkpoints
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_study_reviews_select
  on public.academy_study_reviews
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_study_calendar_select
  on public.academy_study_calendar_blocks
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_study_event_ledger_select
  on public.academy_study_event_ledger
  for select to authenticated
  using (
    public.academy_study_can_manage(student_id)
    or public.academy_study_is_current_student(
      household_id,
      student_id,
      'student:progress:read'
    )
  );
create policy academy_study_parent_settings_select
  on public.academy_study_parent_settings
  for select to authenticated
  using (public.academy_study_can_manage(student_id));
create policy academy_study_accommodations_select
  on public.academy_study_accommodations
  for select to authenticated
  using (public.academy_study_can_manage(student_id));
create policy academy_study_audit_select
  on public.academy_study_audit_events
  for select to authenticated
  using (
    student_id is not null
    and public.academy_study_can_manage(student_id)
  );

do $$
declare
  relation_name text;
  policy_prefix text;
begin
  foreach relation_name in array array[
    'academy_study_household_settings',
    'academy_study_sessions',
    'academy_study_event_ledger',
    'academy_study_checkpoints',
    'academy_study_reviews',
    'academy_study_calendar_blocks',
    'academy_study_parent_settings',
    'academy_study_accommodations',
    'academy_study_audit_events'
  ]
  loop
    policy_prefix := relation_name || '_deny';
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (false)',
      policy_prefix || '_insert',
      relation_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (false) with check (false)',
      policy_prefix || '_update',
      relation_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (false)',
      policy_prefix || '_delete',
      relation_name
    );
  end loop;
end;
$$;

grant select on table
  public.academy_study_household_settings,
  public.academy_study_sessions,
  public.academy_study_event_ledger,
  public.academy_study_checkpoints,
  public.academy_study_reviews,
  public.academy_study_calendar_blocks,
  public.academy_study_parent_settings,
  public.academy_study_accommodations,
  public.academy_study_audit_events
to authenticated;

revoke insert, update, delete, truncate on table
  public.academy_study_household_settings,
  public.academy_study_sessions,
  public.academy_study_event_ledger,
  public.academy_study_checkpoints,
  public.academy_study_reviews,
  public.academy_study_calendar_blocks,
  public.academy_study_parent_settings,
  public.academy_study_accommodations,
  public.academy_study_audit_events
from authenticated;

create or replace function academy_private.study_checkpoint_is_valid(
  candidate jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select public.academy_study_json_has_exact_keys(
      candidate,
      array[
        'contract', 'contractVersion', 'checkpointId', 'revision',
        'createdAt', 'updatedAt', 'sessionId', 'lessonId', 'segmentId',
        'safeInstructionalCursor', 'completedSegmentIds',
        'perSegmentActiveTime', 'pausedSeconds', 'breakSeconds',
        'protectedDraftRef', 'protectedTutorStateRef',
        'lastAcceptedEventId', 'eventVersion', 'tutorInteractionRef',
        'technicalInterruption', 'rawAnswerIncluded', 'transcriptIncluded'
      ]::text[]
    )
    and public.academy_study_payload_is_minimized(
      candidate - 'rawAnswerIncluded' - 'transcriptIncluded',
      32768
    )
    and candidate ->> 'contract' =
      'study-core-bridge.recovery-checkpoint.v1'
    and candidate ->> 'contractVersion' = '1'
    and candidate ->> 'eventVersion' = '1'
    and public.academy_study_identifier_is_valid(candidate ->> 'checkpointId')
    and public.academy_study_identifier_is_valid(candidate ->> 'sessionId')
    and public.academy_study_identifier_is_valid(candidate ->> 'lessonId')
    and public.academy_study_identifier_is_valid(candidate ->> 'segmentId')
    and public.academy_study_identifier_is_valid(
      candidate ->> 'tutorInteractionRef'
    )
    and (candidate ->> 'protectedTutorStateRef') ~
      '^tutor-state:[A-Za-z0-9][A-Za-z0-9._:/-]{0,113}$'
    and jsonb_typeof(candidate -> 'revision') = 'number'
    and (candidate ->> 'revision')::numeric between 1 and 9007199254740991
    and jsonb_typeof(candidate -> 'createdAt') = 'string'
    and jsonb_typeof(candidate -> 'updatedAt') = 'string'
    and (candidate ->> 'createdAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$'
    and (candidate ->> 'updatedAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$'
    and (candidate ->> 'updatedAt')::timestamptz >=
      (candidate ->> 'createdAt')::timestamptz
    and public.academy_study_cursor_is_valid(
      candidate -> 'safeInstructionalCursor'
    )
    and public.academy_study_segment_times_are_valid(
      candidate -> 'perSegmentActiveTime'
    )
    and public.academy_study_technical_state_is_valid(
      candidate -> 'technicalInterruption'
    )
    and jsonb_typeof(candidate -> 'completedSegmentIds') = 'array'
    and public.academy_study_identifiers_are_unique(
      array(
        select jsonb_array_elements_text(
          candidate -> 'completedSegmentIds'
        )
      )
    )
    and jsonb_typeof(candidate -> 'pausedSeconds') = 'number'
    and (candidate ->> 'pausedSeconds')::numeric between 0 and 9007199254740991
    and jsonb_typeof(candidate -> 'breakSeconds') = 'number'
    and (candidate ->> 'breakSeconds')::numeric between 0 and 9007199254740991
    and (
      jsonb_typeof(candidate -> 'protectedDraftRef') = 'null'
      or (
        jsonb_typeof(candidate -> 'protectedDraftRef') = 'string'
        and (candidate ->> 'protectedDraftRef') ~
          '^draft:[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
      )
    )
    and (
      jsonb_typeof(candidate -> 'lastAcceptedEventId') = 'null'
      or (
        jsonb_typeof(candidate -> 'lastAcceptedEventId') = 'string'
        and public.academy_study_identifier_is_valid(
          candidate ->> 'lastAcceptedEventId'
        )
      )
    )
    and candidate -> 'rawAnswerIncluded' = 'false'::jsonb
    and candidate -> 'transcriptIncluded' = 'false'::jsonb;
$$;

create or replace function academy_private.study_checkpoint_integrity(
  candidate public.academy_study_checkpoints
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select academy_private.study_sha256_json(jsonb_build_object(
    'id', candidate.id,
    'household_id', candidate.household_id,
    'student_id', candidate.student_id,
    'session_id', candidate.session_id,
    'lesson_id', candidate.lesson_id,
    'segment_id', candidate.segment_id,
    'canonical_task_id', candidate.canonical_task_id,
    'safe_instructional_cursor', candidate.safe_instructional_cursor,
    'completed_segment_ids', candidate.completed_segment_ids,
    'per_segment_active_time', candidate.per_segment_active_time,
    'paused_time', candidate.paused_time,
    'break_time', candidate.break_time,
    'protected_draft_reference', candidate.protected_draft_reference,
    'draft_revision', candidate.draft_revision,
    'last_accepted_event_id', candidate.last_accepted_event_id,
    'event_version', candidate.event_version,
    'opaque_tutor_state_reference', candidate.opaque_tutor_state_reference,
    'tutor_interaction_reference', candidate.tutor_interaction_reference,
    'technical_interruption_state', candidate.technical_interruption_state,
    'household_timezone', candidate.household_timezone,
    'revision', candidate.revision,
    'expires_at', candidate.expires_at
  ));
$$;

create or replace function academy_private.study_set_checkpoint_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.integrity_digest := academy_private.study_checkpoint_integrity(new);
  return new;
end;
$$;

create trigger academy_study_checkpoints_z_integrity
  before insert or update on public.academy_study_checkpoints
  for each row execute function academy_private.study_set_checkpoint_integrity();

create or replace function public.academy_study_append_event(
  p_session_id text,
  p_event_id text,
  p_event_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_session public.academy_study_sessions%rowtype;
  prior_event public.academy_study_event_ledger%rowtype;
  next_sequence bigint;
  canonical_payload jsonb := jsonb_build_object('schema_version', 1);
  canonical_digest text;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_event_version <> 1
     or not public.academy_study_identifier_is_valid(p_event_id)
     or not public.academy_study_identifier_is_valid(p_idempotency_key) then
    raise exception 'STUDY_EVENT_INVALID' using errcode = '22023';
  end if;
  select * into target_session
  from public.academy_study_sessions
  where id = p_session_id
  for update;
  if target_session.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  perform academy_private.study_authorized_household(
    target_session.student_id,
    'student:attempts:create',
    false
  );
  canonical_digest := academy_private.study_sha256_json(canonical_payload);

  select * into prior_event
  from public.academy_study_event_ledger
  where session_id = p_session_id
    and (event_id = p_event_id or idempotency_key = p_idempotency_key)
  order by case when event_id = p_event_id then 0 else 1 end
  limit 1;
  if prior_event.event_id is not null then
    if prior_event.event_id = p_event_id
       and prior_event.event_version = 1
       and prior_event.event_kind = 'tutor_event_accepted'
       and prior_event.idempotency_key = p_idempotency_key
       and prior_event.payload_digest = canonical_digest
       and prior_event.minimized_payload = canonical_payload then
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
    'tutor_event_accepted',
    next_sequence,
    canonical_payload,
    canonical_digest,
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
      'result_code', 'appended'
    )
  );
  return jsonb_build_object('status', 'appended');
end;
$$;

create or replace function public.academy_study_compare_and_swap_checkpoint(
  p_session_id text,
  p_expected_revision bigint,
  p_mutation_id text,
  p_checkpoint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_session public.academy_study_sessions%rowtype;
  current_checkpoint public.academy_study_checkpoints%rowtype;
  prior_receipt academy_private.study_mutation_receipts%rowtype;
  expected_revision bigint := coalesce(p_expected_revision, 0);
  desired_revision bigint;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
  segment_ids text[];
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_session_id is distinct from p_checkpoint ->> 'sessionId'
     or not public.academy_study_identifier_is_valid(p_mutation_id)
     or not academy_private.study_checkpoint_is_valid(p_checkpoint) then
    return jsonb_build_object(
      'status', 'quarantined',
      'quarantine', jsonb_build_object(
        'reasonCode', 'malformed-event',
        'sourceKind', 'checkpoint'
      )
    );
  end if;
  desired_revision := (p_checkpoint ->> 'revision')::bigint;
  if desired_revision <> expected_revision + 1 then
    return jsonb_build_object(
      'status', 'quarantined',
      'quarantine', jsonb_build_object(
        'reasonCode', 'stale-checkpoint',
        'sourceKind', 'checkpoint'
      )
    );
  end if;
  select * into target_session
  from public.academy_study_sessions
  where id = p_session_id
  for update;
  if target_session.id is null
     or target_session.lesson_id <> p_checkpoint ->> 'lessonId' then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  perform academy_private.study_authorized_household(
    target_session.student_id,
    'student:attempts:create',
    false
  );

  fingerprint := jsonb_build_object(
    'session_id', p_session_id,
    'expected_revision', expected_revision,
    'checkpoint', p_checkpoint
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into prior_receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || p_session_id
    and operation_kind = 'checkpoint_cas_v1'
    and idempotency_key = p_mutation_id;
  if prior_receipt.idempotency_key is not null then
    if prior_receipt.request_digest = request_digest
       and prior_receipt.request_fingerprint = fingerprint then
      return prior_receipt.result;
    end if;
    perform academy_private.study_append_audit(
      target_session.household_id,
      target_session.student_id,
      'checkpoint.reject',
      'checkpoint',
      p_checkpoint ->> 'checkpointId',
      'idempotency_collision',
      correlation,
      jsonb_build_object(
        'expected_revision', expected_revision,
        'result_code', 'idempotency_collision'
      )
    );
    return jsonb_build_object(
      'status', 'quarantined',
      'quarantine', jsonb_build_object(
        'reasonCode', 'idempotency-collision',
        'sourceKind', 'checkpoint'
      )
    );
  end if;

  select * into current_checkpoint
  from public.academy_study_checkpoints
  where session_id = p_session_id
  for update;
  if coalesce(current_checkpoint.revision, 0) <> expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', coalesce(current_checkpoint.revision, 0)
    );
    insert into academy_private.study_mutation_receipts (
      actor_scope, operation_kind, idempotency_key, request_digest,
      request_fingerprint, result, expires_at
    ) values (
      'session:' || p_session_id,
      'checkpoint_cas_v1',
      p_mutation_id,
      request_digest,
      fingerprint,
      result_value,
      now() + interval '90 days'
    );
    perform academy_private.study_append_audit(
      target_session.household_id,
      target_session.student_id,
      'checkpoint.reject',
      'checkpoint',
      p_checkpoint ->> 'checkpointId',
      'revision_conflict',
      correlation,
      jsonb_build_object(
        'expected_revision', expected_revision,
        'revision', coalesce(current_checkpoint.revision, 0),
        'result_code', 'revision_conflict'
      )
    );
    return result_value;
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into segment_ids
  from jsonb_array_elements_text(
    p_checkpoint -> 'completedSegmentIds'
  ) as value;

  if current_checkpoint.id is null then
    insert into public.academy_study_checkpoints (
      id, household_id, student_id, session_id, lesson_id, segment_id,
      canonical_task_id, safe_instructional_cursor, completed_segment_ids,
      per_segment_active_time, paused_time, break_time,
      protected_draft_reference, draft_revision, last_accepted_event_id,
      event_version, opaque_tutor_state_reference,
      tutor_interaction_reference, technical_interruption_state,
      household_timezone, integrity_digest, revision, expires_at,
      created_at, updated_at
    ) values (
      p_checkpoint ->> 'checkpointId',
      target_session.household_id,
      target_session.student_id,
      p_session_id,
      p_checkpoint ->> 'lessonId',
      p_checkpoint ->> 'segmentId',
      p_checkpoint -> 'safeInstructionalCursor' ->> 'currentItemId',
      p_checkpoint -> 'safeInstructionalCursor',
      segment_ids,
      p_checkpoint -> 'perSegmentActiveTime',
      (p_checkpoint ->> 'pausedSeconds')::bigint,
      (p_checkpoint ->> 'breakSeconds')::bigint,
      p_checkpoint ->> 'protectedDraftRef',
      case when jsonb_typeof(p_checkpoint -> 'protectedDraftRef') = 'null'
        then 0 else desired_revision end,
      p_checkpoint ->> 'lastAcceptedEventId',
      1,
      p_checkpoint ->> 'protectedTutorStateRef',
      p_checkpoint ->> 'tutorInteractionRef',
      p_checkpoint -> 'technicalInterruption',
      'UTC',
      repeat('0', 64),
      desired_revision,
      now() + interval '30 days',
      (p_checkpoint ->> 'createdAt')::timestamptz,
      (p_checkpoint ->> 'updatedAt')::timestamptz
    );
  else
    update public.academy_study_checkpoints
    set lesson_id = p_checkpoint ->> 'lessonId',
        segment_id = p_checkpoint ->> 'segmentId',
        canonical_task_id =
          p_checkpoint -> 'safeInstructionalCursor' ->> 'currentItemId',
        safe_instructional_cursor = p_checkpoint -> 'safeInstructionalCursor',
        completed_segment_ids = segment_ids,
        per_segment_active_time = p_checkpoint -> 'perSegmentActiveTime',
        paused_time = (p_checkpoint ->> 'pausedSeconds')::bigint,
        break_time = (p_checkpoint ->> 'breakSeconds')::bigint,
        protected_draft_reference = p_checkpoint ->> 'protectedDraftRef',
        draft_revision = case
          when jsonb_typeof(p_checkpoint -> 'protectedDraftRef') = 'null'
            then 0 else desired_revision end,
        last_accepted_event_id = p_checkpoint ->> 'lastAcceptedEventId',
        event_version = 1,
        opaque_tutor_state_reference = p_checkpoint ->> 'protectedTutorStateRef',
        tutor_interaction_reference = p_checkpoint ->> 'tutorInteractionRef',
        technical_interruption_state = p_checkpoint -> 'technicalInterruption'
    where id = current_checkpoint.id;
  end if;

  result_value := jsonb_build_object(
    'status', 'stored',
    'revision', desired_revision
  );
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || p_session_id,
    'checkpoint_cas_v1',
    p_mutation_id,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  perform academy_private.study_append_audit(
    target_session.household_id,
    target_session.student_id,
    'checkpoint.save',
    'checkpoint',
    p_checkpoint ->> 'checkpointId',
    null,
    correlation,
    jsonb_build_object(
      'revision', desired_revision,
      'result_code', 'stored'
    )
  );
  return result_value;
end;
$$;

create or replace function public.academy_study_read_checkpoint(
  p_session_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  row_value public.academy_study_checkpoints%rowtype;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select checkpoint.* into row_value
  from public.academy_study_checkpoints as checkpoint
  where checkpoint.session_id = p_session_id;
  if row_value.id is null then
    return null;
  end if;
  if not public.academy_study_can_view(
    row_value.household_id,
    row_value.student_id
  ) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if row_value.integrity_digest <>
     academy_private.study_checkpoint_integrity(row_value) then
    return jsonb_build_object('status', 'integrity-failed');
  end if;
  return jsonb_build_object(
    'contract', 'study-core-bridge.recovery-checkpoint.v1',
    'contractVersion', 1,
    'checkpointId', row_value.id,
    'revision', row_value.revision,
    'createdAt', to_char(row_value.created_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(row_value.updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'sessionId', row_value.session_id,
    'lessonId', row_value.lesson_id,
    'segmentId', row_value.segment_id,
    'safeInstructionalCursor', row_value.safe_instructional_cursor,
    'completedSegmentIds', to_jsonb(row_value.completed_segment_ids),
    'perSegmentActiveTime', row_value.per_segment_active_time,
    'pausedSeconds', row_value.paused_time,
    'breakSeconds', row_value.break_time,
    'protectedDraftRef', row_value.protected_draft_reference,
    'protectedTutorStateRef', row_value.opaque_tutor_state_reference,
    'lastAcceptedEventId', row_value.last_accepted_event_id,
    'eventVersion', row_value.event_version,
    'tutorInteractionRef', row_value.tutor_interaction_reference,
    'technicalInterruption', row_value.technical_interruption_state,
    'rawAnswerIncluded', false,
    'transcriptIncluded', false
  );
end;
$$;

create or replace function public.academy_study_set_household_timezone(
  p_household_id uuid,
  p_timezone text,
  p_expected_revision bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_row public.academy_study_household_settings%rowtype;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or not public.academy_study_is_adult_principal()
     or not public.academy_is_active_household_guardian(p_household_id)
     or not public.academy_study_timezone_is_valid(p_timezone)
     or not public.academy_study_identifier_is_valid(p_idempotency_key) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  fingerprint := jsonb_build_object(
    'household_id', p_household_id,
    'timezone', p_timezone,
    'expected_revision', p_expected_revision
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'guardian:' || auth.uid()::text
    and operation_kind = 'household_timezone_v1'
    and idempotency_key = p_idempotency_key;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  select * into current_row
  from public.academy_study_household_settings
  where household_id = p_household_id
  for update;
  if coalesce(current_row.revision, 0) <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', coalesce(current_row.revision, 0)
    );
  elsif current_row.household_id is null then
    insert into public.academy_study_household_settings (
      household_id, household_timezone, revision, updated_by
    ) values (p_household_id, p_timezone, 1, auth.uid());
    result_value := jsonb_build_object('status', 'stored', 'revision', 1);
  else
    update public.academy_study_household_settings
    set household_timezone = p_timezone,
        updated_by = auth.uid()
    where household_id = p_household_id;
    result_value := jsonb_build_object(
      'status', 'stored',
      'revision', p_expected_revision + 1
    );
  end if;
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'guardian:' || auth.uid()::text,
    'household_timezone_v1',
    p_idempotency_key,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

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

create or replace function public.academy_study_transition_session(
  p_session_id text,
  p_expected_revision bigint,
  p_state text,
  p_completed_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_session public.academy_study_sessions%rowtype;
  receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_state not in (
    'active', 'paused', 'approved_break', 'student_requested_break',
    'technical_interruption', 'completed', 'abandoned'
  ) or p_expected_revision is null or p_expected_revision < 1
    or not public.academy_study_identifier_is_valid(p_idempotency_key) then
    raise exception 'STUDY_SESSION_TRANSITION_INVALID' using errcode = '22023';
  end if;
  select * into target_session
  from public.academy_study_sessions
  where id = p_session_id
  for update;
  if target_session.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  perform academy_private.study_authorized_household(
    target_session.student_id,
    'student:attempts:create',
    false
  );
  fingerprint := jsonb_build_object(
    'session_id', p_session_id,
    'expected_revision', p_expected_revision,
    'state', p_state,
    'completed_at', p_completed_at
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'session:' || p_session_id
    and operation_kind = 'session_transition_v1'
    and idempotency_key = p_idempotency_key;
  if receipt.idempotency_key is not null then
    if receipt.request_digest = request_digest
       and receipt.request_fingerprint = fingerprint then
      return receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  if target_session.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', target_session.revision
    );
  else
    update public.academy_study_sessions
    set state = p_state,
        started_at = case
          when started_at is null then now() else started_at end,
        completed_at = case
          when p_state = 'completed' then coalesce(p_completed_at, now())
          else null end
    where id = p_session_id;
    result_value := jsonb_build_object(
      'status', 'stored',
      'revision', p_expected_revision + 1
    );
    if p_state = 'completed' then
      perform academy_private.study_append_audit(
        target_session.household_id,
        target_session.student_id,
        'session.finish',
        'session',
        p_session_id,
        null,
        correlation,
        jsonb_build_object(
          'revision', p_expected_revision + 1,
          'result_code', 'completed'
        )
      );
    end if;
  end if;
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'session:' || p_session_id,
    'session_transition_v1',
    p_idempotency_key,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

create or replace function public.academy_study_upsert_adult_managed_record(
  p_record_kind text,
  p_record jsonb,
  p_expected_revision bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_student_id uuid;
  target_household_id uuid;
  current_revision bigint;
  target_id text;
  fingerprint jsonb;
  request_digest text;
  prior_receipt academy_private.study_mutation_receipts%rowtype;
  result_value jsonb;
  audit_type text;
  audit_kind text;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_record_kind not in (
    'review', 'calendar', 'parent_settings', 'accommodation'
  ) or p_expected_revision is null or p_expected_revision < 0
    or not public.academy_study_payload_is_minimized(p_record, 16384)
    or not public.academy_study_identifier_is_valid(p_idempotency_key) then
    raise exception 'STUDY_RECORD_INVALID' using errcode = '22023';
  end if;
  target_student_id := (p_record ->> 'student_id')::uuid;
  target_household_id := academy_private.study_authorized_household(
    target_student_id,
    'student:progress:read',
    true
  );
  target_id := case
    when p_record_kind = 'parent_settings' then target_student_id::text
    else p_record ->> 'id'
  end;
  if not public.academy_study_identifier_is_valid(target_id) then
    raise exception 'STUDY_RECORD_INVALID' using errcode = '22023';
  end if;
  if (p_record_kind = 'review' and exists (
        select 1 from public.academy_study_reviews
        where id = target_id
          and (household_id <> target_household_id
            or student_id <> target_student_id)
      ))
     or (p_record_kind = 'calendar' and exists (
        select 1 from public.academy_study_calendar_blocks
        where id = target_id
          and (household_id <> target_household_id
            or student_id <> target_student_id)
      ))
     or (p_record_kind = 'accommodation' and exists (
        select 1 from public.academy_study_accommodations
        where id = target_id
          and (household_id <> target_household_id
            or student_id <> target_student_id)
      )) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  fingerprint := jsonb_build_object(
    'record_kind', p_record_kind,
    'expected_revision', p_expected_revision,
    'record', p_record
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into prior_receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'student:' || target_student_id::text
    and operation_kind = p_record_kind || '_upsert_v1'
    and idempotency_key = p_idempotency_key;
  if prior_receipt.idempotency_key is not null then
    if prior_receipt.request_digest = request_digest
       and prior_receipt.request_fingerprint = fingerprint then
      return prior_receipt.result;
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;

  if p_record_kind = 'review' then
    if not public.academy_study_json_has_exact_keys(
      p_record,
      array[
        'id', 'student_id', 'skill_id', 'source_session_id',
        'review_kind', 'due_at', 'intended_local_date', 'priority',
        'state', 'attempt_count', 'interval_days', 'reteaching_required',
        'prerequisite_remediation_required'
      ]::text[]
    ) then
      raise exception 'STUDY_REVIEW_INVALID' using errcode = '22023';
    end if;
    select revision into current_revision
    from public.academy_study_reviews
    where id = target_id
      and household_id = target_household_id
      and student_id = target_student_id
    for update;
    if coalesce(current_revision, 0) = p_expected_revision then
      if current_revision is null then
        insert into public.academy_study_reviews (
          id, household_id, student_id, skill_id, source_session_id,
          review_kind, due_at, intended_local_date, household_timezone,
          priority, state, attempt_count, interval_days,
          reteaching_required, prerequisite_remediation_required,
          idempotency_key
        ) values (
          target_id, target_household_id, target_student_id,
          p_record ->> 'skill_id', p_record ->> 'source_session_id',
          p_record ->> 'review_kind', (p_record ->> 'due_at')::timestamptz,
          (p_record ->> 'intended_local_date')::date, 'UTC',
          (p_record ->> 'priority')::smallint, p_record ->> 'state',
          (p_record ->> 'attempt_count')::integer,
          (p_record ->> 'interval_days')::integer,
          (p_record ->> 'reteaching_required')::boolean,
          (p_record ->> 'prerequisite_remediation_required')::boolean,
          p_idempotency_key
        );
      else
        update public.academy_study_reviews
        set due_at = (p_record ->> 'due_at')::timestamptz,
            intended_local_date = (p_record ->> 'intended_local_date')::date,
            priority = (p_record ->> 'priority')::smallint,
            state = p_record ->> 'state',
            attempt_count = (p_record ->> 'attempt_count')::integer,
            interval_days = (p_record ->> 'interval_days')::integer,
            reteaching_required =
              (p_record ->> 'reteaching_required')::boolean,
            prerequisite_remediation_required =
              (p_record ->> 'prerequisite_remediation_required')::boolean
        where id = target_id
          and household_id = target_household_id
          and student_id = target_student_id;
      end if;
    end if;
    audit_type := 'review.schedule';
    audit_kind := 'review';
  elsif p_record_kind = 'calendar' then
    if not public.academy_study_json_has_exact_keys(
      p_record,
      array[
        'id', 'student_id', 'block_type', 'source_reference',
        'scheduled_start', 'intended_local_date', 'explicit_offset',
        'duration_minutes', 'completion_units', 'required_units',
        'resume_session_id', 'resume_segment_id', 'state'
      ]::text[]
    ) then
      raise exception 'STUDY_CALENDAR_INVALID' using errcode = '22023';
    end if;
    select revision into current_revision
    from public.academy_study_calendar_blocks
    where id = target_id
      and household_id = target_household_id
      and student_id = target_student_id
    for update;
    if coalesce(current_revision, 0) = p_expected_revision then
      if current_revision is null then
        insert into public.academy_study_calendar_blocks (
          id, household_id, student_id, block_type, source_reference,
          scheduled_start, intended_local_date, household_timezone,
          explicit_offset, duration_minutes, completion_units,
          required_units, resume_session_id, resume_segment_id,
          state, idempotency_key
        ) values (
          target_id, target_household_id, target_student_id,
          p_record ->> 'block_type', p_record ->> 'source_reference',
          (p_record ->> 'scheduled_start')::timestamptz,
          (p_record ->> 'intended_local_date')::date, 'UTC',
          (p_record ->> 'explicit_offset')::smallint,
          (p_record ->> 'duration_minutes')::integer,
          (p_record ->> 'completion_units')::integer,
          (p_record ->> 'required_units')::integer,
          p_record ->> 'resume_session_id', p_record ->> 'resume_segment_id',
          p_record ->> 'state', p_idempotency_key
        );
      else
        update public.academy_study_calendar_blocks
        set scheduled_start = (p_record ->> 'scheduled_start')::timestamptz,
            intended_local_date = (p_record ->> 'intended_local_date')::date,
            explicit_offset = (p_record ->> 'explicit_offset')::smallint,
            duration_minutes = (p_record ->> 'duration_minutes')::integer,
            completion_units = (p_record ->> 'completion_units')::integer,
            required_units = (p_record ->> 'required_units')::integer,
            resume_session_id = p_record ->> 'resume_session_id',
            resume_segment_id = p_record ->> 'resume_segment_id',
            state = p_record ->> 'state'
        where id = target_id
          and household_id = target_household_id
          and student_id = target_student_id;
      end if;
    end if;
    audit_type := 'calendar.schedule';
    audit_kind := 'calendar';
  elsif p_record_kind = 'parent_settings' then
    if not public.academy_study_json_has_exact_keys(
      p_record,
      array[
        'student_id', 'timer_mode', 'maximum_work_minutes',
        'break_minimum_minutes', 'break_maximum_minutes', 'required_breaks',
        'reduced_motion', 'no_audio', 'large_text', 'read_aloud',
        'speech_input_allowed', 'parent_override'
      ]::text[]
    ) then
      raise exception 'STUDY_PARENT_SETTINGS_INVALID' using errcode = '22023';
    end if;
    select revision into current_revision
    from public.academy_study_parent_settings
    where household_id = target_household_id and student_id = target_student_id
    for update;
    if coalesce(current_revision, 0) = p_expected_revision then
      if current_revision is null then
        insert into public.academy_study_parent_settings (
          household_id, student_id, timer_mode, maximum_work_minutes,
          break_minimum_minutes, break_maximum_minutes, required_breaks,
          reduced_motion, no_audio, large_text, read_aloud,
          speech_input_allowed, parent_override, updated_by
        ) values (
          target_household_id, target_student_id, p_record ->> 'timer_mode',
          (p_record ->> 'maximum_work_minutes')::integer,
          (p_record ->> 'break_minimum_minutes')::integer,
          (p_record ->> 'break_maximum_minutes')::integer,
          (p_record ->> 'required_breaks')::integer,
          (p_record ->> 'reduced_motion')::boolean,
          (p_record ->> 'no_audio')::boolean,
          (p_record ->> 'large_text')::boolean,
          (p_record ->> 'read_aloud')::boolean,
          (p_record ->> 'speech_input_allowed')::boolean,
          (p_record ->> 'parent_override')::boolean,
          auth.uid()
        );
      else
        update public.academy_study_parent_settings
        set timer_mode = p_record ->> 'timer_mode',
            maximum_work_minutes =
              (p_record ->> 'maximum_work_minutes')::integer,
            break_minimum_minutes =
              (p_record ->> 'break_minimum_minutes')::integer,
            break_maximum_minutes =
              (p_record ->> 'break_maximum_minutes')::integer,
            required_breaks = (p_record ->> 'required_breaks')::integer,
            reduced_motion = (p_record ->> 'reduced_motion')::boolean,
            no_audio = (p_record ->> 'no_audio')::boolean,
            large_text = (p_record ->> 'large_text')::boolean,
            read_aloud = (p_record ->> 'read_aloud')::boolean,
            speech_input_allowed =
              (p_record ->> 'speech_input_allowed')::boolean,
            parent_override = (p_record ->> 'parent_override')::boolean,
            updated_by = auth.uid()
        where household_id = target_household_id
          and student_id = target_student_id;
      end if;
    end if;
    audit_type := 'parent.override';
    audit_kind := 'parent_settings';
  else
    if not public.academy_study_json_has_exact_keys(
      p_record,
      array[
        'id', 'student_id', 'maximum_duration_minutes',
        'required_break_interval_minutes', 'required_break_duration_minutes',
        'timer_visibility', 'presentation_accommodations', 'source_kind',
        'provenance_reference', 'effective_from', 'effective_until', 'state'
      ]::text[]
    ) then
      raise exception 'STUDY_ACCOMMODATION_INVALID' using errcode = '22023';
    end if;
    select revision into current_revision
    from public.academy_study_accommodations
    where id = target_id
      and household_id = target_household_id
      and student_id = target_student_id
    for update;
    if coalesce(current_revision, 0) = p_expected_revision then
      if current_revision is null then
        insert into public.academy_study_accommodations (
          id, household_id, student_id, maximum_duration_minutes,
          required_break_interval_minutes, required_break_duration_minutes,
          timer_visibility, presentation_accommodations, source_kind,
          provenance_reference, authorized_by, effective_from,
          effective_until, state
        ) values (
          target_id, target_household_id, target_student_id,
          (p_record ->> 'maximum_duration_minutes')::integer,
          (p_record ->> 'required_break_interval_minutes')::integer,
          (p_record ->> 'required_break_duration_minutes')::integer,
          p_record ->> 'timer_visibility',
          p_record -> 'presentation_accommodations',
          p_record ->> 'source_kind', p_record ->> 'provenance_reference',
          auth.uid(), (p_record ->> 'effective_from')::date,
          (p_record ->> 'effective_until')::date, p_record ->> 'state'
        );
      else
        update public.academy_study_accommodations
        set maximum_duration_minutes =
              (p_record ->> 'maximum_duration_minutes')::integer,
            required_break_interval_minutes =
              (p_record ->> 'required_break_interval_minutes')::integer,
            required_break_duration_minutes =
              (p_record ->> 'required_break_duration_minutes')::integer,
            timer_visibility = p_record ->> 'timer_visibility',
            presentation_accommodations =
              p_record -> 'presentation_accommodations',
            source_kind = p_record ->> 'source_kind',
            provenance_reference = p_record ->> 'provenance_reference',
            authorized_by = auth.uid(),
            effective_from = (p_record ->> 'effective_from')::date,
            effective_until = (p_record ->> 'effective_until')::date,
            state = p_record ->> 'state'
        where id = target_id
          and household_id = target_household_id
          and student_id = target_student_id;
      end if;
    end if;
    audit_type := 'accommodation.change';
    audit_kind := 'accommodation';
  end if;

  if coalesce(current_revision, 0) <> p_expected_revision then
    result_value := jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', coalesce(current_revision, 0)
    );
  else
    result_value := jsonb_build_object(
      'status', 'stored',
      'revision', p_expected_revision + 1
    );
    perform academy_private.study_append_audit(
      target_household_id,
      target_student_id,
      audit_type,
      audit_kind,
      target_id,
      null,
      correlation,
      jsonb_build_object(
        'revision', p_expected_revision + 1,
        'result_code', 'stored'
      )
    );
  end if;
  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'student:' || target_student_id::text,
    p_record_kind || '_upsert_v1',
    p_idempotency_key,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '90 days'
  );
  return result_value;
end;
$$;

create or replace function public.academy_study_effective_settings(
  p_student_id uuid,
  p_effective_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  target_household_id uuid;
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select household_id into target_household_id
  from public.academy_students where id = p_student_id;
  if target_household_id is null
     or not public.academy_study_can_view(
       target_household_id,
       p_student_id
     ) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'student_id', p_student_id,
    'timer_mode', coalesce(settings.timer_mode, 'visible'),
    'maximum_work_minutes', coalesce(settings.maximum_work_minutes, 30),
    'break_minimum_minutes', coalesce(settings.break_minimum_minutes, 5),
    'break_maximum_minutes', coalesce(settings.break_maximum_minutes, 15),
    'required_breaks', coalesce(settings.required_breaks, 1),
    'reduced_motion', coalesce(settings.reduced_motion, false),
    'no_audio', coalesce(settings.no_audio, false),
    'large_text', coalesce(settings.large_text, false),
    'read_aloud', coalesce(settings.read_aloud, false),
    'speech_input_allowed', coalesce(settings.speech_input_allowed, false),
    'accommodations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', accommodation.id,
        'revision', accommodation.revision,
        'maximum_duration_minutes', accommodation.maximum_duration_minutes,
        'required_break_interval_minutes',
          accommodation.required_break_interval_minutes,
        'required_break_duration_minutes',
          accommodation.required_break_duration_minutes,
        'timer_visibility', accommodation.timer_visibility,
        'presentation_accommodations',
          accommodation.presentation_accommodations,
        'effective_from', accommodation.effective_from,
        'effective_until', accommodation.effective_until
      ) order by accommodation.id)
      from public.academy_study_accommodations as accommodation
      where accommodation.household_id = target_household_id
        and accommodation.student_id = p_student_id
        and accommodation.state = 'active'
        and accommodation.effective_from <= p_effective_date
        and (
          accommodation.effective_until is null
          or accommodation.effective_until >= p_effective_date
        )
    ), '[]'::jsonb)
  ) into result_value
  from (select 1) as one
  left join public.academy_study_parent_settings as settings
    on settings.household_id = target_household_id
   and settings.student_id = p_student_id;
  return result_value;
end;
$$;

create or replace function public.academy_study_store_protected_work(
  p_work jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_session public.academy_study_sessions%rowtype;
  prior academy_private.study_protected_learner_work%rowtype;
  work_id text;
  work_revision bigint;
  expires_at_value timestamptz;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_work,
    array[
      'id', 'revision', 'session_id', 'checkpoint_id',
      'kms_key_reference', 'wrapped_data_key_base64', 'nonce_base64',
      'authentication_tag_base64', 'encrypted_payload_base64',
      'keyed_integrity_tag_base64', 'expires_at'
    ]::text[]
  ) then
    raise exception 'STUDY_PROTECTED_WORK_INVALID' using errcode = '22023';
  end if;
  work_id := p_work ->> 'id';
  work_revision := (p_work ->> 'revision')::bigint;
  expires_at_value := (p_work ->> 'expires_at')::timestamptz;
  if not public.academy_study_identifier_is_valid(work_id)
     or work_revision < 1
     or expires_at_value <= now()
     or expires_at_value > now() + interval '365 days' then
    raise exception 'STUDY_PROTECTED_WORK_INVALID' using errcode = '22023';
  end if;
  select * into target_session
  from public.academy_study_sessions
  where id = p_work ->> 'session_id';
  if target_session.id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  perform academy_private.study_authorized_household(
    target_session.student_id,
    'student:attempts:create',
    false
  );
  select * into prior
  from academy_private.study_protected_learner_work
  where household_id = target_session.household_id
    and student_id = target_session.student_id
    and id = work_id and revision = work_revision;
  if prior.id is not null then
    if prior.household_id = target_session.household_id
       and prior.student_id = target_session.student_id
       and prior.session_id = target_session.id
       and prior.keyed_integrity_tag = decode(
         p_work ->> 'keyed_integrity_tag_base64', 'base64'
       ) then
      return jsonb_build_object('status', 'duplicate-ignored');
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  insert into academy_private.study_protected_learner_work (
    id, revision, household_id, student_id, session_id, checkpoint_id,
    kms_key_reference, wrapped_data_key, nonce, authentication_tag,
    encrypted_payload, keyed_integrity_tag, expires_at
  ) values (
    work_id, work_revision, target_session.household_id,
    target_session.student_id, target_session.id,
    p_work ->> 'checkpoint_id', p_work ->> 'kms_key_reference',
    decode(p_work ->> 'wrapped_data_key_base64', 'base64'),
    decode(p_work ->> 'nonce_base64', 'base64'),
    decode(p_work ->> 'authentication_tag_base64', 'base64'),
    decode(p_work ->> 'encrypted_payload_base64', 'base64'),
    decode(p_work ->> 'keyed_integrity_tag_base64', 'base64'),
    expires_at_value
  );
  return jsonb_build_object(
    'status', 'stored', 'id', work_id, 'revision', work_revision
  );
end;
$$;

create or replace function public.academy_study_read_protected_work(
  p_student_id uuid,
  p_work_id text,
  p_revision bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  work academy_private.study_protected_learner_work%rowtype;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select * into work
  from academy_private.study_protected_learner_work
  where student_id = p_student_id
    and id = p_work_id and revision = p_revision
    and retention_state = 'active' and expires_at > now();
  if work.id is null
     or not (
       public.academy_study_can_manage(work.student_id)
       or public.academy_study_is_current_student(
         work.household_id,
         work.student_id,
         'student:progress:read'
       )
     ) then
    raise exception 'STUDY_PROTECTED_WORK_NOT_AVAILABLE'
      using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', work.id,
    'revision', work.revision,
    'session_id', work.session_id,
    'kms_key_reference', work.kms_key_reference,
    'wrapped_data_key_base64', encode(work.wrapped_data_key, 'base64'),
    'nonce_base64', encode(work.nonce, 'base64'),
    'authentication_tag_base64', encode(work.authentication_tag, 'base64'),
    'encrypted_payload_base64', encode(work.encrypted_payload, 'base64'),
    'keyed_integrity_tag_base64', encode(work.keyed_integrity_tag, 'base64'),
    'expires_at', work.expires_at
  );
end;
$$;

create or replace function public.academy_study_append_adult_note(
  p_note jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_student_id uuid;
  target_household_id uuid;
  prior academy_private.study_adult_notes%rowtype;
  expected_revision bigint;
  next_revision bigint;
  expires_at_value timestamptz;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_note,
    array[
      'note_id', 'student_id', 'expected_revision', 'category',
      'encrypted_body_base64', 'kms_key_reference',
      'wrapped_data_key_base64', 'nonce_base64',
      'authentication_tag_base64', 'keyed_integrity_tag_base64',
      'expires_at'
    ]::text[]
  ) then
    raise exception 'STUDY_ADULT_NOTE_INVALID' using errcode = '22023';
  end if;
  target_student_id := (p_note ->> 'student_id')::uuid;
  target_household_id := academy_private.study_authorized_household(
    target_student_id,
    'student:progress:read',
    true
  );
  expected_revision := (p_note ->> 'expected_revision')::bigint;
  next_revision := expected_revision + 1;
  expires_at_value := (p_note ->> 'expires_at')::timestamptz;
  if not public.academy_study_identifier_is_valid(p_note ->> 'note_id')
     or expected_revision < 0
     or expires_at_value <= now()
     or expires_at_value > now() + interval '365 days' then
    raise exception 'STUDY_ADULT_NOTE_INVALID' using errcode = '22023';
  end if;
  select * into prior
  from academy_private.study_adult_notes
  where household_id = target_household_id
    and student_id = target_student_id
    and note_id = p_note ->> 'note_id'
  order by revision desc
  limit 1
  for update;
  if coalesce(prior.revision, 0) <> expected_revision then
    return jsonb_build_object(
      'status', 'revision-conflict',
      'currentRevision', coalesce(prior.revision, 0)
    );
  end if;
  insert into academy_private.study_adult_notes (
    note_id, revision, household_id, student_id, category,
    encrypted_body, kms_key_reference, wrapped_data_key, nonce,
    authentication_tag, keyed_integrity_tag, author_user_id, expires_at
  ) values (
    p_note ->> 'note_id', next_revision, target_household_id,
    target_student_id, p_note ->> 'category',
    decode(p_note ->> 'encrypted_body_base64', 'base64'),
    p_note ->> 'kms_key_reference',
    decode(p_note ->> 'wrapped_data_key_base64', 'base64'),
    decode(p_note ->> 'nonce_base64', 'base64'),
    decode(p_note ->> 'authentication_tag_base64', 'base64'),
    decode(p_note ->> 'keyed_integrity_tag_base64', 'base64'),
    auth.uid(), expires_at_value
  );
  perform academy_private.study_append_audit(
    target_household_id,
    target_student_id,
    'adult_note.change',
    'adult_note',
    p_note ->> 'note_id',
    null,
    correlation,
    jsonb_build_object('revision', next_revision, 'result_code', 'stored')
  );
  return jsonb_build_object('status', 'stored', 'revision', next_revision);
end;
$$;

create or replace function public.academy_study_list_adult_note_metadata(
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
     or not public.academy_study_can_manage(p_student_id) then
    raise exception 'STUDY_ADULT_NOTES_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'note_id', note.note_id,
      'revision', note.revision,
      'category', note.category,
      'retention_state', note.retention_state,
      'expires_at', note.expires_at,
      'created_at', note.created_at
    ) order by note.created_at desc)
    from (
      select distinct on (record.note_id) record.*
      from academy_private.study_adult_notes as record
      where record.student_id = p_student_id
      order by record.note_id, record.revision desc
    ) as note
  ), '[]'::jsonb);
end;
$$;

create or replace function public.academy_study_read_adult_note(
  p_student_id uuid,
  p_note_id text,
  p_revision bigint,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  note academy_private.study_adult_notes%rowtype;
begin
  if auth.uid() is null
     or not public.academy_study_can_manage(p_student_id) then
    raise exception 'STUDY_ADULT_NOTE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into note
  from academy_private.study_adult_notes
  where note_id = p_note_id
    and revision = p_revision
    and student_id = p_student_id
    and retention_state = 'active'
    and expires_at > now();
  if note.note_id is null then
    raise exception 'STUDY_ADULT_NOTE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  perform academy_private.study_append_audit(
    note.household_id,
    note.student_id,
    'adult_note.access',
    'adult_note',
    note.note_id,
    null,
    p_correlation_id,
    jsonb_build_object(
      'revision', note.revision,
      'access_kind', 'body_read',
      'result_code', 'allowed'
    )
  );
  return jsonb_build_object(
    'note_id', note.note_id,
    'revision', note.revision,
    'category', note.category,
    'encrypted_body_base64', encode(note.encrypted_body, 'base64'),
    'kms_key_reference', note.kms_key_reference,
    'wrapped_data_key_base64', encode(note.wrapped_data_key, 'base64'),
    'nonce_base64', encode(note.nonce, 'base64'),
    'authentication_tag_base64', encode(note.authentication_tag, 'base64'),
    'keyed_integrity_tag_base64', encode(note.keyed_integrity_tag, 'base64'),
    'expires_at', note.expires_at
  );
end;
$$;

create or replace function academy_private.study_is_trusted_server()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select auth.uid() is null
    and coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      academy_private.study_jwt_claim_text('role'),
      nullif(current_setting('role', true), '')
    ) = 'service_role';
$$;

create or replace function public.academy_study_create_adult_review_proposal(
  p_proposal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  source_event public.academy_study_event_ledger%rowtype;
  existing academy_private.study_adult_review_proposals%rowtype;
  audit_id uuid;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_proposal,
    array[
      'id', 'source_session_id', 'source_event_id', 'safety_category',
      'structured_reason_code', 'urgency', 'idempotency_key'
    ]::text[]
  ) or not public.academy_study_payload_is_minimized(p_proposal, 4096) then
    raise exception 'STUDY_PROPOSAL_INVALID' using errcode = '22023';
  end if;
  select * into source_event
  from public.academy_study_event_ledger
  where session_id = p_proposal ->> 'source_session_id'
    and event_id = p_proposal ->> 'source_event_id';
  if source_event.event_id is null then
    raise exception 'STUDY_PROPOSAL_SOURCE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_review_proposals
  where household_id = source_event.household_id
    and student_id = source_event.student_id
    and idempotency_key = p_proposal ->> 'idempotency_key';
  if existing.id is not null then
    if existing.id = p_proposal ->> 'id'
       and existing.source_session_id = source_event.session_id
       and existing.source_event_id = source_event.event_id
       and existing.safety_category = p_proposal ->> 'safety_category'
       and existing.structured_reason_code =
         p_proposal ->> 'structured_reason_code'
       and existing.urgency = p_proposal ->> 'urgency' then
      return jsonb_build_object(
        'status', 'duplicate-ignored', 'proposalId', existing.id
      );
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  audit_id := academy_private.study_append_audit(
    source_event.household_id,
    source_event.student_id,
    'safety.proposal',
    'proposal',
    p_proposal ->> 'id',
    p_proposal ->> 'structured_reason_code',
    gen_random_uuid(),
    jsonb_build_object(
      'proposal_id', p_proposal ->> 'id',
      'result_code', 'proposed_not_delivered'
    )
  );
  insert into academy_private.study_adult_review_proposals (
    id, household_id, student_id, source_session_id, source_event_id,
    safety_category, structured_reason_code, urgency,
    audit_event_id, idempotency_key
  ) values (
    p_proposal ->> 'id', source_event.household_id, source_event.student_id,
    source_event.session_id, source_event.event_id,
    p_proposal ->> 'safety_category',
    p_proposal ->> 'structured_reason_code', p_proposal ->> 'urgency',
    audit_id, p_proposal ->> 'idempotency_key'
  );
  return jsonb_build_object(
    'status', 'proposed-not-delivered',
    'proposalId', p_proposal ->> 'id'
  );
end;
$$;

create or replace function public.academy_study_enqueue_outbox(
  p_outbox jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  proposal academy_private.study_adult_review_proposals%rowtype;
  recipient public.academy_guardian_student_access%rowtype;
  existing academy_private.study_outbox%rowtype;
  inserted_id uuid;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_outbox,
    array[
      'proposal_id', 'recipient_access_id', 'recipient_membership_id',
      'idempotency_key'
    ]::text[]
  ) then
    raise exception 'STUDY_OUTBOX_INVALID' using errcode = '22023';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals
  where id = p_outbox ->> 'proposal_id'
  for update;
  if proposal.id is null then
    raise exception 'STUDY_OUTBOX_SOURCE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select access.* into recipient
  from public.academy_guardian_student_access as access
  join public.academy_household_memberships as membership
    on membership.id = access.membership_id
   and membership.household_id = access.household_id
  join public.academy_households as household
    on household.id = access.household_id
  where access.id = (p_outbox ->> 'recipient_access_id')::uuid
    and access.membership_id = (p_outbox ->> 'recipient_membership_id')::uuid
    and access.household_id = proposal.household_id
    and access.student_id = proposal.student_id
    and access.status = 'active'
    and access.revoked_at is null
    and access.permission_level in ('learning_manager', 'identity_manager')
    and membership.status = 'active'
    and membership.revoked_at is null
    and membership.user_id is not null
    and household.status = 'active';
  if recipient.id is null then
    raise exception 'STUDY_OUTBOX_RECIPIENT_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_outbox
  where household_id = proposal.household_id
    and student_id = proposal.student_id
    and idempotency_key = p_outbox ->> 'idempotency_key';
  if existing.id is not null then
    if existing.proposal_id = proposal.id
       and existing.recipient_access_id = recipient.id
       and existing.recipient_membership_id = recipient.membership_id then
      return jsonb_build_object(
        'status', 'duplicate-ignored', 'outboxId', existing.id
      );
    end if;
    return jsonb_build_object('status', 'idempotency-collision');
  end if;
  update academy_private.study_adult_review_proposals
  set recipient_resolution_state = 'resolved',
      recipient_access_id = recipient.id,
      recipient_membership_id = recipient.membership_id,
      state = 'approved'
  where id = proposal.id;
  insert into academy_private.study_outbox (
    household_id, student_id, proposal_id, source_session_id,
    source_event_id, proposal_kind, recipient_access_id,
    recipient_membership_id, idempotency_key
  ) values (
    proposal.household_id, proposal.student_id, proposal.id,
    proposal.source_session_id, proposal.source_event_id,
    'adult_review_notification', recipient.id, recipient.membership_id,
    p_outbox ->> 'idempotency_key'
  ) returning id into inserted_id;
  perform academy_private.study_append_audit(
    proposal.household_id,
    proposal.student_id,
    'delivery.transition',
    'outbox',
    inserted_id::text,
    null,
    gen_random_uuid(),
    jsonb_build_object(
      'outbox_id', inserted_id,
      'result_code', 'pending'
    )
  );
  return jsonb_build_object(
    'status', 'enqueued', 'outboxId', inserted_id
  );
end;
$$;

create or replace function public.academy_study_confirm_crypto_erasure(
  p_object_kind text,
  p_student_id uuid,
  p_object_id text,
  p_revision bigint,
  p_destruction_receipt text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_household_id uuid;
  target_student_id uuid;
  target_expires_at timestamptz;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_object_kind not in ('protected_work', 'adult_note')
     or not public.academy_study_identifier_is_valid(p_object_id)
     or p_revision < 1
     or not public.academy_study_identifier_is_valid(p_destruction_receipt) then
    raise exception 'STUDY_RETENTION_CONFIRMATION_INVALID' using errcode = '22023';
  end if;
  if p_object_kind = 'protected_work' then
    select household_id, student_id, expires_at
      into target_household_id, target_student_id, target_expires_at
    from academy_private.study_protected_learner_work
    where student_id = p_student_id
      and id = p_object_id and revision = p_revision;
  else
    select household_id, student_id, expires_at
      into target_household_id, target_student_id, target_expires_at
    from academy_private.study_adult_notes
    where student_id = p_student_id
      and note_id = p_object_id and revision = p_revision;
  end if;
  if target_household_id is null or target_expires_at > now() then
    raise exception 'STUDY_RETENTION_TARGET_NOT_DUE' using errcode = '22023';
  end if;
  perform set_config('academy.study_retention_authorized', 'on', true);
  if p_object_kind = 'protected_work' then
    delete from academy_private.study_protected_learner_work
    where student_id = p_student_id
      and id = p_object_id and revision = p_revision;
  else
    delete from academy_private.study_adult_notes
    where student_id = p_student_id
      and note_id = p_object_id and revision = p_revision;
  end if;
  perform set_config('academy.study_retention_authorized', 'off', true);
  perform academy_private.study_append_audit(
    target_household_id,
    target_student_id,
    'retention.delete',
    p_object_kind,
    p_object_id,
    'crypto_erased',
    gen_random_uuid(),
    jsonb_build_object(
      'revision', p_revision,
      'retention_state', 'crypto_erased'
    )
  );
  return jsonb_build_object('status', 'deleted-after-crypto-erasure');
end;
$$;

create or replace function public.academy_study_transition_outbox(
  p_transition jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  outbox academy_private.study_outbox%rowtype;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_transition,
    array[
      'outbox_id', 'expected_state', 'state', 'attempt_count',
      'retry_at', 'last_error_code', 'delivered_at', 'receipt_reference'
    ]::text[]
  ) or p_transition ->> 'expected_state' is null
    or p_transition ->> 'state' not in (
    'pending', 'leased', 'delivered', 'retry', 'failed', 'cancelled'
  ) then
    raise exception 'STUDY_OUTBOX_TRANSITION_INVALID' using errcode = '22023';
  end if;
  select * into outbox
  from academy_private.study_outbox
  where id = (p_transition ->> 'outbox_id')::uuid
  for update;
  if outbox.id is null then
    raise exception 'STUDY_OUTBOX_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if outbox.delivery_state <> p_transition ->> 'expected_state' then
    return jsonb_build_object(
      'status', 'state-conflict', 'currentState', outbox.delivery_state
    );
  end if;
  if (p_transition ->> 'attempt_count')::integer < outbox.attempt_count
     or (p_transition ->> 'attempt_count')::integer > outbox.attempt_count + 1
     or not (
       (outbox.delivery_state = 'pending'
         and p_transition ->> 'state' in ('leased', 'cancelled'))
       or (outbox.delivery_state = 'leased'
         and p_transition ->> 'state' in ('delivered', 'retry', 'failed'))
       or (outbox.delivery_state = 'retry'
         and p_transition ->> 'state' in ('leased', 'failed', 'cancelled'))
     )
     or (
       p_transition ->> 'state' = 'retry'
       and p_transition ->> 'retry_at' is null
     )
     or (
       p_transition ->> 'state' in ('retry', 'failed')
       and p_transition ->> 'last_error_code' is null
     )
     or (
       p_transition ->> 'state' = 'delivered'
       and (
         p_transition ->> 'delivered_at' is null
         or p_transition ->> 'receipt_reference' is null
       )
     )
     or (
       p_transition ->> 'state' <> 'delivered'
       and (
         p_transition ->> 'delivered_at' is not null
         or p_transition ->> 'receipt_reference' is not null
       )
     ) then
    raise exception 'STUDY_OUTBOX_TRANSITION_INVALID' using errcode = '22023';
  end if;
  update academy_private.study_outbox
  set delivery_state = p_transition ->> 'state',
      attempt_count = (p_transition ->> 'attempt_count')::integer,
      retry_at = (p_transition ->> 'retry_at')::timestamptz,
      last_error_code = p_transition ->> 'last_error_code',
      delivered_at = (p_transition ->> 'delivered_at')::timestamptz,
      receipt_reference = p_transition ->> 'receipt_reference',
      updated_at = now()
  where id = outbox.id;
  perform academy_private.study_append_audit(
    outbox.household_id,
    outbox.student_id,
    'delivery.transition',
    'outbox',
    outbox.id::text,
    null,
    gen_random_uuid(),
    jsonb_build_object(
      'state_from', outbox.delivery_state,
      'state_to', p_transition ->> 'state',
      'result_code', 'stored'
    )
  );
  return jsonb_build_object('status', 'stored');
end;
$$;

create or replace function public.academy_study_outbox_status(
  p_outbox_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  outbox academy_private.study_outbox%rowtype;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select * into outbox
  from academy_private.study_outbox where id = p_outbox_id;
  if outbox.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'outboxId', outbox.id,
    'deliveryState', outbox.delivery_state,
    'attemptCount', outbox.attempt_count,
    'retryAt', outbox.retry_at,
    'lastErrorCode', outbox.last_error_code,
    'deliveredAt', outbox.delivered_at,
    'receiptReference', outbox.receipt_reference
  );
end;
$$;

revoke all on function academy_private.study_jwt_claim_text(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sha256_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_authorized_household(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_append_audit(
  uuid, uuid, text, text, text, text, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_checkpoint_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_checkpoint_integrity(
  public.academy_study_checkpoints
) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_set_checkpoint_integrity()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_is_trusted_server()
  from public, anon, authenticated, service_role;

revoke all on function public.academy_study_is_current_student(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_is_adult_principal()
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_can_view(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_can_manage(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_append_event(text, text, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_compare_and_swap_checkpoint(text, bigint, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_checkpoint(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_set_household_timezone(uuid, text, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_create_session(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_transition_session(text, bigint, text, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_upsert_adult_managed_record(text, jsonb, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_effective_settings(uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_store_protected_work(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_protected_work(uuid, text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_append_adult_note(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_list_adult_note_metadata(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_read_adult_note(uuid, text, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_create_adult_review_proposal(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_enqueue_outbox(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_confirm_crypto_erasure(text, uuid, text, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_transition_outbox(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_outbox_status(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_is_current_student(uuid, uuid, text)
  to authenticated;
grant execute on function public.academy_study_is_adult_principal()
  to authenticated;
grant execute on function public.academy_study_can_view(uuid, uuid)
  to authenticated;
grant execute on function public.academy_study_can_manage(uuid)
  to authenticated;
grant execute on function public.academy_study_append_event(text, text, integer, text)
  to authenticated;
grant execute on function public.academy_study_compare_and_swap_checkpoint(text, bigint, text, jsonb)
  to authenticated;
grant execute on function public.academy_study_read_checkpoint(text)
  to authenticated;
grant execute on function public.academy_study_set_household_timezone(uuid, text, bigint, text)
  to authenticated;
grant execute on function public.academy_study_create_session(jsonb, text)
  to authenticated;
grant execute on function public.academy_study_transition_session(text, bigint, text, timestamptz, text)
  to authenticated;
grant execute on function public.academy_study_upsert_adult_managed_record(text, jsonb, bigint, text)
  to authenticated;
grant execute on function public.academy_study_effective_settings(uuid, date)
  to authenticated;
grant execute on function public.academy_study_store_protected_work(jsonb)
  to authenticated;
grant execute on function public.academy_study_read_protected_work(uuid, text, bigint)
  to authenticated;
grant execute on function public.academy_study_append_adult_note(jsonb)
  to authenticated;
grant execute on function public.academy_study_list_adult_note_metadata(uuid)
  to authenticated;
grant execute on function public.academy_study_read_adult_note(uuid, text, bigint, uuid)
  to authenticated;

grant execute on function public.academy_study_create_adult_review_proposal(jsonb)
  to service_role;
grant execute on function public.academy_study_enqueue_outbox(jsonb)
  to service_role;
grant execute on function public.academy_study_confirm_crypto_erasure(text, uuid, text, bigint, text)
  to service_role;
grant execute on function public.academy_study_transition_outbox(jsonb)
  to service_role;
grant execute on function public.academy_study_outbox_status(uuid)
  to service_role;

update academy_private.study_persistence_metadata
set authorization_version = 1,
    migration_names = array[
      '20260801010000_academy_study_engine_storage',
      '20260801011000_academy_study_engine_authorization'
    ]::text[],
    security_manifest = security_manifest || jsonb_build_object(
      'authorization_version', 1,
      'student_principal', 'signed-student-session-grant-jwt',
      'browser_mutations', 'rpc-only',
      'private_browser_table_grants', 0
    ),
    updated_at = now()
where singleton;

commit;
