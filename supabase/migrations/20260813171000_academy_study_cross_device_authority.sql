-- Minimized, actor-bound Study cross-device authority and convergence layer.
--
-- Existing Study sessions and checkpoints remain canonical. This migration
-- adds only the server-custody state that those tables do not represent:
-- safety-stop/clear authority, guardian attestation, revision and accepted
-- client-operation metadata. It stores no Tutor transcript, private answer,
-- emotional label, personality inference or diagnostic inference.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study cross-device authority migration must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.actor_binding_version is distinct from 1
     or marker.storage_version is distinct from 1
     or marker.authorization_version is distinct from 1
     or marker.session_semantics_version is distinct from 2
     or marker.curriculum_binding_version is distinct from 2
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260810151000_academy_study_session_semantics_v2',
       '20260810153000_academy_study_release_registry_bridge',
       '20260813170000_academy_study_actor_authority_convergence'
     ]::text[]) then
    raise exception 'STUDY_CROSS_DEVICE predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260813171000_academy_study_cross_device_authority'
     ]::text[] then
    raise exception 'STUDY_CROSS_DEVICE already applied';
  end if;

  if to_regclass('public.academy_study_session_authority') is not null
     or to_regprocedure(
       'academy_private.study_sync_initialize_session_authority_v1()'
     ) is not null
     or to_regprocedure(
       'academy_private.study_sync_protect_session_authority_v1()'
     ) is not null
     or to_regprocedure(
       'academy_private.study_sync_resolve_actor_v1(text,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_hydrate_v1(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_write_v1(text,uuid,text,text,bigint,uuid,text,jsonb)'
     ) is not null then
    raise exception 'STUDY_CROSS_DEVICE object collision';
  end if;
end;
$$;

create table public.academy_study_session_authority (
  session_id text primary key
    check (public.academy_study_identifier_is_valid(session_id)),
  household_id uuid not null,
  student_id uuid not null,
  assignment_ref text not null
    check (public.academy_study_identifier_is_valid(assignment_ref)),
  safety_state text not null default 'clear'
    check (safety_state in ('clear', 'stopped')),
  safety_stopped_at timestamptz,
  safety_cleared_at timestamptz,
  safety_cleared_by uuid references auth.users (id) on delete restrict,
  guardian_attestation_state text not null default 'pending'
    check (guardian_attestation_state in ('pending', 'attested')),
  guardian_attested_at timestamptz,
  guardian_attested_by uuid references auth.users (id) on delete restrict,
  revision bigint not null default 1 check (revision > 0),
  last_client_operation_id uuid,
  last_actor_kind text check (
    last_actor_kind is null or last_actor_kind in ('guardian', 'student')
  ),
  last_actor_user_id uuid references auth.users (id) on delete restrict,
  last_actor_grant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_session_authority_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on update restrict on delete restrict,
  constraint academy_study_session_authority_actor_grant_fk
    foreign key (last_actor_grant_id, household_id, student_id)
    references academy_private.student_session_grants
      (id, household_id, student_id)
    on update restrict on delete restrict,
  constraint academy_study_session_authority_safety_shape check (
    (
      safety_state = 'stopped'
      and safety_stopped_at is not null
      and safety_cleared_at is null
      and safety_cleared_by is null
    )
    or (
      safety_state = 'clear'
      and safety_stopped_at is null
      and (
        (safety_cleared_at is null and safety_cleared_by is null)
        or (safety_cleared_at is not null and safety_cleared_by is not null)
      )
    )
  ),
  constraint academy_study_session_authority_attestation_shape check (
    (
      guardian_attestation_state = 'pending'
      and guardian_attested_at is null
      and guardian_attested_by is null
    )
    or (
      guardian_attestation_state = 'attested'
      and guardian_attested_at is not null
      and guardian_attested_by is not null
    )
  ),
  constraint academy_study_session_authority_last_actor_shape check (
    (
      last_client_operation_id is null
      and last_actor_kind is null
      and last_actor_user_id is null
      and last_actor_grant_id is null
    )
    or (
      last_client_operation_id is not null
      and last_actor_grant_id is not null
      and (
        (
          last_actor_kind = 'guardian'
          and last_actor_user_id is not null
        )
        or (
          last_actor_kind = 'student'
          and last_actor_user_id is null
        )
      )
    )
  )
);

alter table public.academy_study_session_authority owner to postgres;
alter table public.academy_study_session_authority enable row level security;
alter table public.academy_study_session_authority force row level security;

create index academy_study_session_authority_student_idx
  on public.academy_study_session_authority
  (student_id, updated_at desc, session_id);

create function academy_private.study_sync_initialize_session_authority_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.academy_study_session_authority (
    session_id,
    household_id,
    student_id,
    assignment_ref
  ) values (
    new.id,
    new.household_id,
    new.student_id,
    coalesce(new.study_plan_id, new.lesson_id)
  );
  return new;
end;
$$;

create function academy_private.study_sync_protect_session_authority_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.session_id is distinct from new.session_id
     or old.household_id is distinct from new.household_id
     or old.student_id is distinct from new.student_id
     or old.assignment_ref is distinct from new.assignment_ref
     or old.created_at is distinct from new.created_at then
    raise exception 'STUDY_SYNC_AUTHORITY_IDENTITY_IMMUTABLE'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

alter function academy_private.study_sync_initialize_session_authority_v1()
  owner to postgres;
alter function academy_private.study_sync_protect_session_authority_v1()
  owner to postgres;

revoke all on function academy_private.study_sync_initialize_session_authority_v1()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_protect_session_authority_v1()
  from public, anon, authenticated, service_role;

-- Backfill is identity-derived and contains no learner content.
insert into public.academy_study_session_authority (
  session_id,
  household_id,
  student_id,
  assignment_ref
)
select
  session.id,
  session.household_id,
  session.student_id,
  coalesce(session.study_plan_id, session.lesson_id)
from public.academy_study_sessions as session;

create trigger academy_study_sessions_initialize_sync_authority_v1
  after insert on public.academy_study_sessions
  for each row execute function
    academy_private.study_sync_initialize_session_authority_v1();

create trigger academy_study_session_authority_revision_v1
  before update on public.academy_study_session_authority
  for each row execute function academy_private.study_prepare_revision();

create trigger academy_study_session_authority_identity_v1
  before update or delete on public.academy_study_session_authority
  for each row execute function
    academy_private.study_sync_protect_session_authority_v1();

create policy academy_study_session_authority_select
  on public.academy_study_session_authority
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));

create policy academy_study_session_authority_deny_insert
  on public.academy_study_session_authority
  for insert to authenticated
  with check (false);
create policy academy_study_session_authority_deny_update
  on public.academy_study_session_authority
  for update to authenticated
  using (false) with check (false);
create policy academy_study_session_authority_deny_delete
  on public.academy_study_session_authority
  for delete to authenticated
  using (false);

revoke all on table public.academy_study_session_authority
  from public, anon, authenticated, service_role;
grant select (
  session_id,
  household_id,
  student_id,
  assignment_ref,
  safety_state,
  safety_stopped_at,
  safety_cleared_at,
  guardian_attestation_state,
  guardian_attested_at,
  revision,
  last_client_operation_id,
  created_at,
  updated_at
) on table public.academy_study_session_authority to authenticated;

-- Resolve a current Study grant against the authenticated browser principal.
-- Guardians are bound to a grant they issued and still need learning-manager
-- authority. Student JWT principals are bound to their own exact grant id.
create function academy_private.study_sync_resolve_actor_v1(
  p_token_digest text,
  p_student_id uuid,
  p_required_capability text
)
returns table (
  actor_kind text,
  actor_user_id uuid,
  actor_grant_id uuid,
  actor_household_id uuid,
  actor_session_epoch uuid
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    case
      when academy_private.study_jwt_claim_text(
        'academy_principal_kind'
      ) = 'student_session_grant' then 'student'
      else 'guardian'
    end,
    case
      when academy_private.study_jwt_claim_text(
        'academy_principal_kind'
      ) = 'student_session_grant' then null
      else auth.uid()
    end,
    grant_row.id,
    grant_row.household_id,
    grant_row.session_epoch
  from academy_private.student_session_grants as grant_row
  where auth.uid() is not null
    and p_token_digest ~ '^[0-9a-f]{64}$'
    and p_required_capability in (
      'student:assignments:read',
      'student:attempts:create',
      'student:progress:read'
    )
    and grant_row.token_digest = p_token_digest
    and grant_row.student_id = p_student_id
    and grant_row.grant_purpose = 'study'
    and grant_row.contract_version = 1
    and grant_row.capabilities @> array[p_required_capability]::text[]
    and academy_private.is_student_session_grant_current(grant_row.id)
    and (
      (
        academy_private.study_jwt_claim_text(
          'academy_principal_kind'
        ) = 'student_session_grant'
        and grant_row.id = auth.uid()
      )
      or (
        public.academy_study_is_adult_principal()
        and grant_row.issued_by = auth.uid()
        and public.academy_study_can_manage(p_student_id)
      )
    )
  limit 1;
$$;

alter function academy_private.study_sync_resolve_actor_v1(text, uuid, text)
  owner to postgres;
revoke all on function academy_private.study_sync_resolve_actor_v1(
  text, uuid, text
) from public, anon, authenticated, service_role;

-- Initial hydrate/read is SECURITY INVOKER: authenticated table SELECT grants
-- and the forced RLS policies remain the primary row boundary. A wrong actor,
-- household, student, assignment or session projects no document.
create function public.academy_study_sync_hydrate_v1(
  p_student_id uuid,
  p_assignment_ref text,
  p_session_id text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null
     or p_assignment_ref is null
     or octet_length(p_assignment_ref) not between 1 and 160
     or p_assignment_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
     or p_session_id is null
     or octet_length(p_session_id) not between 1 and 160
     or p_session_id !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$' then
    raise exception 'STUDY_SYNC_REQUEST_INVALID' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ready',
    'document', jsonb_build_object(
      'studentRef', session.student_id,
      'assignmentRef', authority.assignment_ref,
      'lessonRef', session.lesson_id,
      'studySessionId', session.id,
      'completionState', case session.state
        when 'approved_break' then 'approved-break'
        when 'student_requested_break' then 'student-requested-break'
        when 'technical_interruption' then 'technical-interruption'
        else session.state
      end,
      'revisions', jsonb_build_object(
        'authority', authority.revision,
        'session', session.revision,
        'checkpoint', coalesce(checkpoint.revision, 0)
      ),
      'progress', jsonb_build_object(
        'currentSegmentRef', coalesce(
          session.current_segment_id,
          checkpoint.segment_id
        ),
        'completedSegmentRefs', coalesce(
          to_jsonb(checkpoint.completed_segment_ids),
          '[]'::jsonb
        ),
        'safeInstructionalCursor', checkpoint.safe_instructional_cursor,
        'checkpointUpdatedAt', checkpoint.updated_at
      ),
      'safety', jsonb_build_object(
        'state', authority.safety_state,
        'stoppedAt', authority.safety_stopped_at,
        'clearedAt', authority.safety_cleared_at
      ),
      'guardianAttestation', jsonb_build_object(
        'state', authority.guardian_attestation_state,
        'attestedAt', authority.guardian_attested_at
      ),
      'dynamicSourceReadiness', jsonb_build_object(
        'state', case
          when session.session_semantics_version = 2
           and session.curriculum_binding_schema_version = 1
           and session.effective_settings_snapshot ->> 'status' = 'ready'
          then 'ready'
          else 'not-ready'
        end,
        'curriculumReleaseVersion', session.curriculum_release_version
      ),
      'syncMetadata', jsonb_build_object(
        'lastAuthorityClientOperationId',
          authority.last_client_operation_id,
        'serverAcceptedAt', authority.updated_at
      )
    )
  ) into result_value
  from public.academy_study_session_authority as authority
  join public.academy_study_sessions as session
    on session.id = authority.session_id
   and session.household_id = authority.household_id
   and session.student_id = authority.student_id
  left join public.academy_study_checkpoints as checkpoint
    on checkpoint.session_id = session.id
   and checkpoint.household_id = session.household_id
   and checkpoint.student_id = session.student_id
  where authority.student_id = p_student_id
    and authority.assignment_ref = p_assignment_ref
    and authority.session_id = p_session_id;

  return coalesce(result_value, jsonb_build_object(
    'schemaVersion', 1,
    'status', 'unavailable'
  ));
end;
$$;

-- Revision-aware and idempotent browser write boundary. It accepts only the
-- existing minimized checkpoint contract plus three authority transitions.
-- The session digest is a binding input; raw session references are never
-- stored. Every accepted or conflict result is keyed by client operation id.
create function public.academy_study_sync_write_v1(
  p_token_digest text,
  p_student_id uuid,
  p_assignment_ref text,
  p_session_id text,
  p_expected_revision bigint,
  p_client_operation_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  session_row public.academy_study_sessions%rowtype;
  authority_row public.academy_study_session_authority%rowtype;
  prior_receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  nested_result jsonb;
  result_value jsonb;
  operation_result text;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null
     or p_assignment_ref is null
     or p_session_id is null
     or p_expected_revision is null
     or p_expected_revision < 0
     or p_client_operation_id is null
     or p_operation is null
     or not public.academy_study_identifier_is_valid(p_assignment_ref)
     or not public.academy_study_identifier_is_valid(p_session_id)
     or p_operation not in (
       'checkpoint:compare-and-swap',
       'safety:stop',
       'safety:clear',
       'guardian-attestation:attest'
     )
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not public.academy_study_payload_is_minimized(p_payload, 16384)
     or (
       p_operation = 'checkpoint:compare-and-swap'
       and (
         not public.academy_study_json_has_exact_keys(
           p_payload,
           array['checkpoint']::text[]
         )
         or jsonb_typeof(p_payload -> 'checkpoint') <> 'object'
       )
     )
     or (
       p_operation <> 'checkpoint:compare-and-swap'
       and p_payload <> '{}'::jsonb
     ) then
    raise exception 'STUDY_SYNC_REQUEST_INVALID' using errcode = '22023';
  end if;

  select * into actor
  from academy_private.study_sync_resolve_actor_v1(
    p_token_digest,
    p_student_id,
    'student:attempts:create'
  );
  if actor.actor_grant_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  select session.*
  into session_row
  from public.academy_study_sessions as session
  join public.academy_study_session_authority as authority
    on authority.session_id = session.id
   and authority.household_id = session.household_id
   and authority.student_id = session.student_id
  where session.id = p_session_id
    and session.student_id = p_student_id
    and session.household_id = actor.actor_household_id
    and authority.assignment_ref = p_assignment_ref
  for update of session, authority;

  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  select authority.* into authority_row
  from public.academy_study_session_authority as authority
  where authority.session_id = session_row.id;

  if actor.actor_kind = 'student'
     and p_operation in (
       'safety:clear',
       'guardian-attestation:attest'
     ) then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'actor-not-authorized'
    );
  end if;
  if actor.actor_kind = 'student'
     and session_row.state in ('completed', 'abandoned') then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'study-session-closed'
    );
  end if;

  fingerprint := jsonb_build_object(
    'actor_kind', actor.actor_kind,
    'actor_grant_id', actor.actor_grant_id,
    'student_id', p_student_id,
    'assignment_ref', p_assignment_ref,
    'session_id', p_session_id,
    'expected_revision', p_expected_revision,
    'operation', p_operation,
    'payload', p_payload
  );
  request_digest := academy_private.study_sha256_json(fingerprint);

  select * into prior_receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'study-sync:' || p_session_id
    and operation_kind = 'study_sync_write_v1'
    and idempotency_key = p_client_operation_id::text;

  if prior_receipt.idempotency_key is not null then
    if prior_receipt.request_digest = request_digest
       and prior_receipt.request_fingerprint = fingerprint then
      return prior_receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'idempotency-collision',
      'operation', p_operation
    );
  end if;

  if p_operation = 'checkpoint:compare-and-swap' then
    if session_row.state in ('completed', 'abandoned') then
      result_value := jsonb_build_object(
        'schemaVersion', 1,
        'status', 'denied',
        'code', 'study-session-closed'
      );
    else
      nested_result := public.academy_study_compare_and_swap_checkpoint(
        p_session_id,
        p_expected_revision,
        p_client_operation_id::text,
        p_payload -> 'checkpoint'
      );
      operation_result := nested_result ->> 'status';
      result_value := case operation_result
        when 'stored' then jsonb_build_object(
          'schemaVersion', 1,
          'status', 'stored',
          'operation', p_operation,
          'serverRevision', (nested_result ->> 'revision')::bigint
        )
        when 'revision-conflict' then jsonb_build_object(
          'schemaVersion', 1,
          'status', 'revision-conflict',
          'operation', p_operation,
          'serverRevision',
            (nested_result ->> 'currentRevision')::bigint
        )
        when 'idempotency-collision' then jsonb_build_object(
          'schemaVersion', 1,
          'status', 'idempotency-collision',
          'operation', p_operation
        )
        else jsonb_build_object(
          'schemaVersion', 1,
          'status', 'invalid-write',
          'operation', p_operation,
          'reasonCode', coalesce(
            nested_result #>> '{quarantine,reasonCode}',
            'invalid-checkpoint'
          )
        )
      end;
    end if;
  elsif authority_row.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'schemaVersion', 1,
      'status', 'revision-conflict',
      'operation', p_operation,
      'serverRevision', authority_row.revision
    );
  else
    update public.academy_study_session_authority
    set safety_state = case p_operation
          when 'safety:stop' then 'stopped'
          when 'safety:clear' then 'clear'
          else safety_state
        end,
        safety_stopped_at = case p_operation
          when 'safety:stop' then clock_timestamp()
          when 'safety:clear' then null
          else safety_stopped_at
        end,
        safety_cleared_at = case p_operation
          when 'safety:stop' then null
          when 'safety:clear' then clock_timestamp()
          else safety_cleared_at
        end,
        safety_cleared_by = case p_operation
          when 'safety:stop' then null
          when 'safety:clear' then actor.actor_user_id
          else safety_cleared_by
        end,
        guardian_attestation_state = case p_operation
          when 'guardian-attestation:attest' then 'attested'
          else guardian_attestation_state
        end,
        guardian_attested_at = case p_operation
          when 'guardian-attestation:attest' then clock_timestamp()
          else guardian_attested_at
        end,
        guardian_attested_by = case p_operation
          when 'guardian-attestation:attest' then actor.actor_user_id
          else guardian_attested_by
        end,
        last_client_operation_id = p_client_operation_id,
        last_actor_kind = actor.actor_kind,
        last_actor_user_id = actor.actor_user_id,
        last_actor_grant_id = actor.actor_grant_id
    where session_id = p_session_id
    returning * into authority_row;

    perform academy_private.study_append_audit(
      session_row.household_id,
      session_row.student_id,
      'administrative.operation',
      'session',
      session_row.id,
      replace(p_operation, ':', '-'),
      p_client_operation_id,
      jsonb_build_object(
        'revision', authority_row.revision,
        'expected_revision', p_expected_revision,
        'result_code', 'stored'
      )
    );

    result_value := jsonb_build_object(
      'schemaVersion', 1,
      'status', 'stored',
      'operation', p_operation,
      'serverRevision', authority_row.revision,
      'safetyState', authority_row.safety_state,
      'guardianAttestationState',
        authority_row.guardian_attestation_state
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope,
    operation_kind,
    idempotency_key,
    request_digest,
    request_fingerprint,
    result,
    expires_at
  ) values (
    'study-sync:' || p_session_id,
    'study_sync_write_v1',
    p_client_operation_id::text,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '180 days'
  );

  return result_value;
end;
$$;

alter function public.academy_study_sync_hydrate_v1(uuid, text, text)
  owner to postgres;
alter function public.academy_study_sync_write_v1(
  text, uuid, text, text, bigint, uuid, text, jsonb
) owner to postgres;

revoke all on function public.academy_study_sync_hydrate_v1(
  uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_write_v1(
  text, uuid, text, text, bigint, uuid, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.academy_study_sync_hydrate_v1(
  uuid, text, text
) to authenticated;
grant execute on function public.academy_study_sync_write_v1(
  text, uuid, text, text, bigint, uuid, text, jsonb
) to authenticated;

alter table academy_private.study_persistence_metadata
  add column cross_device_authority_version smallint not null default 0
    check (cross_device_authority_version in (0, 1));

update academy_private.study_persistence_metadata
set cross_device_authority_version = 1,
    migration_names = array_append(
      migration_names,
      '20260813171000_academy_study_cross_device_authority'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'cross_device_authority_version', 1,
      'cross_device_public_authority_tables', 1,
      'cross_device_rls_primary_read_boundary', true,
      'cross_device_browser_role', 'authenticated',
      'cross_device_browser_service_role_required', false,
      'cross_device_revision_domains',
        array['authority', 'session', 'checkpoint']::text[],
      'cross_device_cas_required', true,
      'cross_device_idempotency_required', true,
      'cross_device_session_digest_binding_required_for_writes', true,
      'cross_device_raw_answer_storage', false,
      'cross_device_transcript_storage', false,
      'cross_device_inference_storage', false
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table public.academy_study_session_authority is
  'One-to-one server-custody extension of canonical Study sessions: safety, guardian attestation, authority revision, actor and client operation metadata only. No raw learner content.';
comment on function public.academy_study_sync_hydrate_v1(
  uuid, text, text
) is
  'RLS-filtered minimized cross-device Study hydrate. Returns canonical session/checkpoint progress plus server-custody safety and guardian attestation state.';
comment on function public.academy_study_sync_write_v1(
  text, uuid, text, text, bigint, uuid, text, jsonb
) is
  'Authenticated browser cross-device write boundary. Requires a current exact Study session digest, exact student/assignment/session binding, expected revision and client operation UUID. Students cannot attest guardian work or clear safety.';

commit;
