-- Lossless hosted Study synchronization V2.
--
-- Canonical Study sessions and checkpoints remain authoritative. This additive
-- migration extends their existing one-to-one authority row with minimized
-- Family Pilot metadata and adds only an explicit stable-reference link ledger.
-- Browser RPCs require an authenticated, current, exact Study grant; no
-- browser path uses or impersonates service_role.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study lossless sync V2 must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if not found
     or marker.cross_device_authority_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260813170000_academy_study_actor_authority_convergence',
       '20260813171000_academy_study_cross_device_authority'
     ]::text[]) then
    raise exception 'STUDY_SYNC_V2 predecessor marker mismatch';
  end if;
  if marker.migration_names @> array[
       '20260813172000_academy_study_sync_lossless_v2'
     ]::text[] then
    raise exception 'STUDY_SYNC_V2 already applied';
  end if;
  if to_regclass('academy_private.study_sync_explicit_links_v2') is not null
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_resolve_mapping_v2(text,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_hydrate_v2(text,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb)'
     ) is not null then
    raise exception 'STUDY_SYNC_V2 object collision';
  end if;
end;
$$;

create function academy_private.study_sync_local_ref_valid_v2(candidate text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and octet_length(candidate) between 1 and 192
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$';
$$;

create function academy_private.study_sync_instant_valid_v2(candidate text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed timestamptz;
begin
  if candidate is null or octet_length(candidate) not between 20 and 40 then
    return false;
  end if;
  parsed := candidate::timestamptz;
  return parsed is not null;
exception when others then
  return false;
end;
$$;

create function academy_private.study_sync_text_valid_v2(
  candidate text,
  maximum_bytes integer
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and btrim(candidate) <> ''
    and octet_length(candidate) between 1 and maximum_bytes;
$$;

create function academy_private.study_sync_source_valid_v2(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return public.academy_study_json_has_exact_keys(candidate, array[
      'studentRef', 'assignmentRef', 'lessonRef', 'sourceRef', 'title',
      'publisher', 'publishedAt', 'attachedAt', 'status'
    ]::text[])
    and public.academy_study_payload_is_minimized(candidate, 4096)
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'studentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'assignmentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'lessonRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'sourceRef')
    and academy_private.study_sync_text_valid_v2(candidate ->> 'title', 160)
    and academy_private.study_sync_text_valid_v2(candidate ->> 'publisher', 160)
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'publishedAt')
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'attachedAt')
    and candidate ->> 'status' = 'ATTACHED_SATISFIED';
exception when others then
  return false;
end;
$$;

create function academy_private.study_sync_attestation_valid_v2(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return public.academy_study_json_has_exact_keys(candidate, array[
      'studentRef', 'assignmentRef', 'lessonRef', 'sessionRef', 'authority',
      'status', 'learnerAssertedAt', 'attestedAt', 'attestedByRef',
      'evidenceMode'
    ]::text[])
    and public.academy_study_payload_is_minimized(candidate, 4096)
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'studentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'assignmentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'lessonRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'sessionRef')
    and candidate ->> 'authority' = 'GUARDIAN_ATTESTATION_REQUIRED'
    and candidate ->> 'status' in ('PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED')
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'learnerAssertedAt')
    and (
      (
        candidate ->> 'status' = 'PENDING_GUARDIAN_ATTESTATION'
        and jsonb_typeof(candidate -> 'attestedAt') = 'null'
        and jsonb_typeof(candidate -> 'attestedByRef') = 'null'
        and jsonb_typeof(candidate -> 'evidenceMode') = 'null'
      )
      or (
        candidate ->> 'status' = 'CERTIFIED'
        and academy_private.study_sync_instant_valid_v2(candidate ->> 'attestedAt')
        and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'attestedByRef')
        and candidate ->> 'evidenceMode' in (
          'adult-observed', 'simulated-alternative'
        )
      )
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_sync_assessment_valid_v2(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return public.academy_study_json_has_exact_keys(candidate, array[
      'assignmentRef', 'assessmentRef', 'studentRef', 'courseRef', 'subject',
      'grade', 'title', 'authorityClass', 'status', 'createdAt', 'updatedAt',
      'completedAt'
    ]::text[])
    and public.academy_study_payload_is_minimized(candidate, 4096)
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'assignmentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'assessmentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'studentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'courseRef')
    and candidate ->> 'subject' in (
      'mathematics', 'english-language-arts', 'science', 'social-studies',
      'ready-for-life', 'financial-literacy', 'health', 'physical-education',
      'arts-and-music', 'technology'
    )
    and jsonb_typeof(candidate -> 'grade') = 'number'
    and (candidate ->> 'grade')::integer between 3 and 12
    and academy_private.study_sync_text_valid_v2(candidate ->> 'title', 160)
    and candidate ->> 'authorityClass' in (
      'AUTO_SCOREABLE', 'RUBRIC_REQUIRED', 'GUARDIAN_REQUIRED',
      'COMPLETION_ONLY'
    )
    and candidate ->> 'status' in (
      'PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED',
      'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'
    )
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'createdAt')
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'updatedAt')
    and (
      (
        candidate ->> 'status' = 'CERTIFIED'
        and academy_private.study_sync_instant_valid_v2(candidate ->> 'completedAt')
      )
      or (
        candidate ->> 'status' <> 'CERTIFIED'
        and jsonb_typeof(candidate -> 'completedAt') = 'null'
      )
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_sync_hold_valid_v2(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and candidate ?& array[
      'schemaVersion', 'holdRef', 'studentRef', 'sessionRef', 'createdAt',
      'status', 'reasonCode', 'source', 'dedupeKey'
    ]::text[]
    and not exists (
      select 1 from jsonb_object_keys(candidate) item(key)
      where item.key <> all(array[
        'schemaVersion', 'holdRef', 'studentRef', 'sessionRef', 'createdAt',
        'status', 'reasonCode', 'source', 'dedupeKey', 'acknowledgedAt',
        'clearedAt', 'clearedBy'
      ]::text[])
    )
    and public.academy_study_payload_is_minimized(candidate, 4096)
    and candidate ->> 'schemaVersion' = '1'
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'holdRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'studentRef')
    and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'sessionRef')
    and academy_private.study_sync_instant_valid_v2(candidate ->> 'createdAt')
    and candidate ->> 'status' in ('open', 'acknowledged', 'cleared')
    and candidate ->> 'reasonCode' in (
      'study-safety-urgent', 'study-safety-uncertain',
      'tutor-concerning-content', 'parent-review-requested'
    )
    and candidate ->> 'source' in ('study-safety', 'tutor-core', 'parent')
    and academy_private.study_sync_text_valid_v2(candidate ->> 'dedupeKey', 640)
    and (
      (candidate ->> 'status' = 'open'
       and not candidate ? 'acknowledgedAt'
       and not candidate ? 'clearedAt'
       and not candidate ? 'clearedBy')
      or (candidate ->> 'status' = 'acknowledged'
       and academy_private.study_sync_instant_valid_v2(candidate ->> 'acknowledgedAt')
       and not candidate ? 'clearedAt'
       and not candidate ? 'clearedBy')
      or (candidate ->> 'status' = 'cleared'
       and academy_private.study_sync_instant_valid_v2(candidate ->> 'clearedAt')
       and academy_private.study_sync_local_ref_valid_v2(candidate ->> 'clearedBy'))
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_sync_holds_valid_v2(candidate jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'array'
    and jsonb_array_length(candidate) <= 64
    and octet_length(candidate::text) <= 65536
    and not exists (
      select 1
      from jsonb_array_elements(candidate) as held(value)
      where not academy_private.study_sync_hold_valid_v2(held.value)
    )
    and jsonb_array_length(candidate) = (
      select count(distinct held.value ->> 'holdRef')
      from jsonb_array_elements(candidate) as held(value)
    )
    and not exists (
      select 1
      from jsonb_array_elements(candidate) as left_hold(value)
      join jsonb_array_elements(candidate) as right_hold(value)
        on left_hold.value ->> 'dedupeKey' = right_hold.value ->> 'dedupeKey'
       and left_hold.value ->> 'holdRef' <> right_hold.value ->> 'holdRef'
       and left_hold.value ->> 'status' <> 'cleared'
       and right_hold.value ->> 'status' <> 'cleared'
    );
$$;

alter table public.academy_study_session_authority
  add column social_source jsonb,
  add column guardian_attestation jsonb,
  add column safety_holds jsonb not null default '[]'::jsonb,
  add column assessment_state jsonb,
  add constraint academy_study_session_authority_source_v2 check (
    social_source is null
    or academy_private.study_sync_source_valid_v2(social_source)
  ),
  add constraint academy_study_session_authority_attestation_v2 check (
    guardian_attestation is null
    or academy_private.study_sync_attestation_valid_v2(guardian_attestation)
  ),
  add constraint academy_study_session_authority_holds_v2 check (
    academy_private.study_sync_holds_valid_v2(safety_holds)
  ),
  add constraint academy_study_session_authority_assessment_v2 check (
    assessment_state is null
    or academy_private.study_sync_assessment_valid_v2(assessment_state)
  );

create table academy_private.study_sync_explicit_links_v2 (
  id uuid primary key default gen_random_uuid(),
  linked_by uuid not null references auth.users (id) on delete restrict,
  household_id uuid not null,
  student_id uuid not null,
  local_household_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_household_ref)),
  local_student_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_student_ref)),
  local_assignment_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_assignment_ref)),
  local_session_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_session_ref)),
  assignment_ref text not null
    check (public.academy_study_identifier_is_valid(assignment_ref)),
  session_id text not null
    check (public.academy_study_identifier_is_valid(session_id)),
  created_at timestamptz not null default now(),
  constraint study_sync_explicit_links_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on update restrict on delete restrict,
  constraint study_sync_explicit_links_session_key unique (session_id),
  constraint study_sync_explicit_links_local_key unique (
    household_id, local_household_ref, local_student_ref,
    local_assignment_ref, local_session_ref
  )
);

alter table academy_private.study_sync_explicit_links_v2 owner to postgres;
alter table academy_private.study_sync_explicit_links_v2 enable row level security;
alter table academy_private.study_sync_explicit_links_v2 force row level security;
revoke all on table academy_private.study_sync_explicit_links_v2
  from public, anon, authenticated, service_role;

create function academy_private.study_sync_scope_matches_v2(
  p_session_id text,
  p_student_id uuid,
  p_assignment_ref text,
  p_local_student_ref text default null,
  p_local_assignment_ref text default null,
  p_local_session_ref text default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from academy_private.study_sync_explicit_links_v2 as link
    where link.session_id = p_session_id
      and link.student_id = p_student_id
      and link.assignment_ref = p_assignment_ref
      and (p_local_student_ref is null
        or link.local_student_ref = p_local_student_ref)
      and (p_local_assignment_ref is null
        or link.local_assignment_ref = p_local_assignment_ref)
      and (p_local_session_ref is null
        or link.local_session_ref = p_local_session_ref)
  );
$$;

alter function academy_private.study_sync_local_ref_valid_v2(text)
  owner to postgres;
alter function academy_private.study_sync_instant_valid_v2(text)
  owner to postgres;
alter function academy_private.study_sync_text_valid_v2(text, integer)
  owner to postgres;
alter function academy_private.study_sync_source_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_sync_attestation_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_sync_assessment_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_sync_hold_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_sync_holds_valid_v2(jsonb)
  owner to postgres;
alter function academy_private.study_sync_scope_matches_v2(
  text, uuid, text, text, text, text
) owner to postgres;

revoke all on function academy_private.study_sync_local_ref_valid_v2(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_instant_valid_v2(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_text_valid_v2(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_source_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_attestation_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_assessment_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_hold_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_holds_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_scope_matches_v2(
  text, uuid, text, text, text, text
) from public, anon, authenticated, service_role;

-- Guardian-controlled compare-and-create import. Existing canonical state is
-- linked but is never changed by this RPC.
create function public.academy_study_sync_first_link_v2(
  p_token_digest text,
  p_student_id uuid,
  p_client_operation_id uuid,
  p_import jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  local_scope jsonb;
  hosted_scope jsonb;
  session_input jsonb;
  checkpoint_input jsonb;
  source_input jsonb;
  attestation_input jsonb;
  safety_input jsonb;
  assessment_input jsonb;
  session_row public.academy_study_sessions%rowtype;
  authority_row public.academy_study_session_authority%rowtype;
  prior_receipt academy_private.study_mutation_receipts%rowtype;
  prior_link academy_private.study_sync_explicit_links_v2%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  segment_ids text[];
  event_id text;
  target_session_id text;
  target_assignment_ref text;
  session_state text;
  started_at timestamptz;
  completed_at timestamptz;
  created_new boolean := false;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null or p_client_operation_id is null
     or not public.academy_study_json_has_exact_keys(p_import, array[
       'localScope', 'hostedScope', 'session', 'checkpoint', 'socialSource',
       'guardianAttestation', 'safetyState', 'assessment'
     ]::text[])
     or not public.academy_study_payload_is_minimized(p_import, 98304) then
    raise exception 'STUDY_SYNC_IMPORT_INVALID' using errcode = '22023';
  end if;
  local_scope := p_import -> 'localScope';
  hosted_scope := p_import -> 'hostedScope';
  session_input := p_import -> 'session';
  checkpoint_input := p_import -> 'checkpoint';
  source_input := p_import -> 'socialSource';
  attestation_input := p_import -> 'guardianAttestation';
  safety_input := p_import -> 'safetyState';
  assessment_input := p_import -> 'assessment';
  if not public.academy_study_json_has_exact_keys(local_scope, array[
       'householdRef', 'studentRef', 'assignmentRef', 'sessionRef'
     ]::text[])
     or not public.academy_study_json_has_exact_keys(hosted_scope, array[
       'assignmentRef', 'sessionRef'
     ]::text[])
     or not public.academy_study_json_has_exact_keys(session_input, array[
       'lessonRef', 'subjectRef', 'state', 'startedAt', 'completedAt',
       'intendedLocalDate'
     ]::text[])
     or not public.academy_study_json_has_exact_keys(safety_input, array[
       'schemaVersion', 'holds'
     ]::text[])
     or safety_input ->> 'schemaVersion' <> '1'
     or not academy_private.study_sync_holds_valid_v2(safety_input -> 'holds')
     or exists (
       select 1 from jsonb_array_elements(safety_input -> 'holds') as held(value)
       where held.value ->> 'studentRef' <> local_scope ->> 'studentRef'
          or held.value ->> 'sessionRef' <> local_scope ->> 'sessionRef'
     )
     or not academy_private.study_sync_local_ref_valid_v2(local_scope ->> 'householdRef')
     or not academy_private.study_sync_local_ref_valid_v2(local_scope ->> 'studentRef')
     or not academy_private.study_sync_local_ref_valid_v2(local_scope ->> 'assignmentRef')
     or not academy_private.study_sync_local_ref_valid_v2(local_scope ->> 'sessionRef')
     or not public.academy_study_identifier_is_valid(hosted_scope ->> 'assignmentRef')
     or not public.academy_study_identifier_is_valid(hosted_scope ->> 'sessionRef')
     or not public.academy_study_identifier_is_valid(session_input ->> 'lessonRef')
     or not public.academy_study_identifier_is_valid(session_input ->> 'subjectRef')
     or session_input ->> 'state' not in (
       'planned', 'active', 'paused', 'approved-break',
       'student-requested-break', 'technical-interruption',
       'completed', 'abandoned'
     )
     or not academy_private.study_iso_date_is_valid_v2(
       session_input ->> 'intendedLocalDate'
     )
     or (
       session_input ->> 'state' = 'planned'
       and (jsonb_typeof(session_input -> 'startedAt') <> 'null'
         or jsonb_typeof(session_input -> 'completedAt') <> 'null')
     )
     or (
       session_input ->> 'state' = 'completed'
       and (not academy_private.study_sync_instant_valid_v2(session_input ->> 'startedAt')
         or not academy_private.study_sync_instant_valid_v2(session_input ->> 'completedAt'))
     )
     or (
       session_input ->> 'state' not in ('planned', 'completed')
       and (not academy_private.study_sync_instant_valid_v2(session_input ->> 'startedAt')
         or jsonb_typeof(session_input -> 'completedAt') <> 'null')
     )
     or (jsonb_typeof(source_input) <> 'null'
       and (not academy_private.study_sync_source_valid_v2(source_input)
         or source_input ->> 'studentRef' <> local_scope ->> 'studentRef'
         or source_input ->> 'assignmentRef' <> local_scope ->> 'assignmentRef'
         or source_input ->> 'lessonRef' <> session_input ->> 'lessonRef'))
     or (jsonb_typeof(attestation_input) <> 'null'
       and (not academy_private.study_sync_attestation_valid_v2(attestation_input)
         or attestation_input ->> 'studentRef' <> local_scope ->> 'studentRef'
         or attestation_input ->> 'assignmentRef' <> local_scope ->> 'assignmentRef'
         or attestation_input ->> 'lessonRef' <> session_input ->> 'lessonRef'
         or attestation_input ->> 'sessionRef' <> local_scope ->> 'sessionRef'))
     or (jsonb_typeof(assessment_input) <> 'null'
       and (not academy_private.study_sync_assessment_valid_v2(assessment_input)
         or assessment_input ->> 'studentRef' <> local_scope ->> 'studentRef'
         or assessment_input ->> 'assignmentRef' <> local_scope ->> 'assignmentRef'))
     or (jsonb_typeof(checkpoint_input) <> 'null'
       and (not academy_private.study_checkpoint_is_valid(checkpoint_input)
         or checkpoint_input ->> 'sessionId' <> local_scope ->> 'sessionRef'
         or checkpoint_input ->> 'lessonId' <> session_input ->> 'lessonRef')) then
    raise exception 'STUDY_SYNC_IMPORT_INVALID' using errcode = '22023';
  end if;

  select * into actor
  from academy_private.study_sync_resolve_actor_v1(
    p_token_digest, p_student_id, 'student:attempts:create'
  );
  if actor.actor_grant_id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;
  if actor.actor_kind <> 'guardian' then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'actor-not-authorized'
    );
  end if;

  target_session_id := hosted_scope ->> 'sessionRef';
  target_assignment_ref := hosted_scope ->> 'assignmentRef';
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'study-sync-first-link:' || target_session_id, 0
    )
  );
  fingerprint := jsonb_build_object(
    'actor_user_id', actor.actor_user_id,
    'student_id', p_student_id,
    'import', p_import
  );
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into prior_receipt
  from academy_private.study_mutation_receipts
  where actor_scope = 'study-sync-first-link:' || actor.actor_user_id::text
    and operation_kind = 'study_sync_first_link_v2'
    and idempotency_key = p_client_operation_id::text;
  if prior_receipt.idempotency_key is not null then
    if prior_receipt.request_digest = request_digest
       and prior_receipt.request_fingerprint = fingerprint then
      return prior_receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'idempotency-collision'
    );
  end if;

  select * into prior_link
  from academy_private.study_sync_explicit_links_v2 as candidate_link
  where candidate_link.session_id = target_session_id
     or (
       household_id = actor.actor_household_id
       and local_household_ref = local_scope ->> 'householdRef'
       and local_student_ref = local_scope ->> 'studentRef'
       and local_assignment_ref = local_scope ->> 'assignmentRef'
       and local_session_ref = local_scope ->> 'sessionRef'
     )
  for update;
  if prior_link.id is not null and (
       prior_link.household_id <> actor.actor_household_id
       or prior_link.student_id <> p_student_id
       or prior_link.assignment_ref <> target_assignment_ref
       or prior_link.session_id <> target_session_id
       or prior_link.local_household_ref <> local_scope ->> 'householdRef'
       or prior_link.local_student_ref <> local_scope ->> 'studentRef'
       or prior_link.local_assignment_ref <> local_scope ->> 'assignmentRef'
       or prior_link.local_session_ref <> local_scope ->> 'sessionRef'
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2, 'status', 'mapping-conflict'
    );
  else
    select * into session_row
    from public.academy_study_sessions as study_session
    where study_session.id = target_session_id
    for update;
    if session_row.id is not null and (
         session_row.household_id <> actor.actor_household_id
         or session_row.student_id <> p_student_id
         or coalesce(session_row.study_plan_id, session_row.lesson_id) <>
           target_assignment_ref
         or session_row.lesson_id <> session_input ->> 'lessonRef'
       ) then
      result_value := jsonb_build_object(
        'schemaVersion', 2, 'status', 'mapping-conflict'
      );
    else
      if session_row.id is null then
        created_new := true;
        session_state := replace(session_input ->> 'state', '-', '_');
        started_at := case when jsonb_typeof(session_input -> 'startedAt') = 'null'
          then null else (session_input ->> 'startedAt')::timestamptz end;
        completed_at := case when jsonb_typeof(session_input -> 'completedAt') = 'null'
          then null else (session_input ->> 'completedAt')::timestamptz end;
        insert into public.academy_study_sessions (
          id, schema_version, household_id, student_id, lesson_id, subject_id,
          study_plan_id, state, started_at, completed_at, intended_local_date,
          household_timezone, created_by
        ) values (
          target_session_id, 1, actor.actor_household_id, p_student_id,
          session_input ->> 'lessonRef', session_input ->> 'subjectRef',
          case when target_assignment_ref = session_input ->> 'lessonRef'
            then null else target_assignment_ref end,
          session_state, started_at, completed_at,
          (session_input ->> 'intendedLocalDate')::date, 'UTC', auth.uid()
        );

        update public.academy_study_session_authority
        set social_source = case when jsonb_typeof(source_input) = 'null'
              then null else source_input end,
            guardian_attestation = case
              when jsonb_typeof(attestation_input) = 'null' then null
              else attestation_input end,
            safety_holds = safety_input -> 'holds',
            assessment_state = case
              when jsonb_typeof(assessment_input) = 'null' then null
              else assessment_input end,
            safety_state = case when exists (
              select 1 from jsonb_array_elements(safety_input -> 'holds') held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then 'stopped' else 'clear' end,
            safety_stopped_at = (
              select max((held.value ->> 'createdAt')::timestamptz)
              from jsonb_array_elements(safety_input -> 'holds') held(value)
              where held.value ->> 'status' <> 'cleared'
            ),
            safety_cleared_at = case when exists (
              select 1 from jsonb_array_elements(safety_input -> 'holds') held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then null else (
              select max((held.value ->> 'clearedAt')::timestamptz)
              from jsonb_array_elements(safety_input -> 'holds') held(value)
              where held.value ->> 'status' = 'cleared'
            ) end,
            safety_cleared_by = case when exists (
              select 1 from jsonb_array_elements(safety_input -> 'holds') held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then null else actor.actor_user_id end,
            guardian_attestation_state = case
              when attestation_input ->> 'status' = 'CERTIFIED'
                then 'attested' else 'pending' end,
            guardian_attested_at = case
              when attestation_input ->> 'status' = 'CERTIFIED'
                then (attestation_input ->> 'attestedAt')::timestamptz
              else null end,
            guardian_attested_by = case
              when attestation_input ->> 'status' = 'CERTIFIED'
                then actor.actor_user_id else null end,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where academy_study_session_authority.session_id = target_session_id
        returning * into authority_row;

        if jsonb_typeof(checkpoint_input) <> 'null' then
          event_id := checkpoint_input ->> 'lastAcceptedEventId';
          if event_id is not null then
            insert into public.academy_study_event_ledger (
              session_id, event_id, household_id, student_id, event_version,
              event_kind, sequence_number, minimized_payload, payload_digest,
              idempotency_key
            ) values (
              target_session_id, event_id, actor.actor_household_id,
              p_student_id, 1,
              'tutor_event_accepted', 1, jsonb_build_object('schema_version', 1),
              academy_private.study_sha256_json(jsonb_build_object('schema_version', 1)),
              'sync-import:' || p_client_operation_id::text
            );
          end if;
          select coalesce(array_agg(value), '{}'::text[]) into segment_ids
          from jsonb_array_elements_text(
            checkpoint_input -> 'completedSegmentIds'
          ) as value;
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
            checkpoint_input ->> 'checkpointId', actor.actor_household_id,
            p_student_id, target_session_id,
            checkpoint_input ->> 'lessonId',
            checkpoint_input ->> 'segmentId',
            checkpoint_input -> 'safeInstructionalCursor' ->> 'currentItemId',
            checkpoint_input -> 'safeInstructionalCursor', segment_ids,
            checkpoint_input -> 'perSegmentActiveTime',
            (checkpoint_input ->> 'pausedSeconds')::bigint,
            (checkpoint_input ->> 'breakSeconds')::bigint,
            checkpoint_input ->> 'protectedDraftRef',
            case when jsonb_typeof(checkpoint_input -> 'protectedDraftRef') = 'null'
              then 0 else (checkpoint_input ->> 'revision')::bigint end,
            event_id, 1, checkpoint_input ->> 'protectedTutorStateRef',
            checkpoint_input ->> 'tutorInteractionRef',
            checkpoint_input -> 'technicalInterruption', 'UTC', repeat('0', 64),
            (checkpoint_input ->> 'revision')::bigint,
            greatest(now(), (checkpoint_input ->> 'createdAt')::timestamptz)
              + interval '30 days',
            (checkpoint_input ->> 'createdAt')::timestamptz,
            (checkpoint_input ->> 'updatedAt')::timestamptz
          );
        end if;
      else
        select * into authority_row
        from public.academy_study_session_authority
        where academy_study_session_authority.session_id = target_session_id;
      end if;

      if prior_link.id is null then
        insert into academy_private.study_sync_explicit_links_v2 (
          linked_by, household_id, student_id, local_household_ref,
          local_student_ref, local_assignment_ref, local_session_ref,
          assignment_ref, session_id
        ) values (
          actor.actor_user_id, actor.actor_household_id, p_student_id,
          local_scope ->> 'householdRef', local_scope ->> 'studentRef',
          local_scope ->> 'assignmentRef', local_scope ->> 'sessionRef',
          target_assignment_ref, target_session_id
        );
      end if;
      select * into session_row
      from public.academy_study_sessions
      where id = target_session_id;
      result_value := jsonb_build_object(
        'schemaVersion', 2,
        'status', case when created_new then 'imported'
          else 'linked-existing' end,
        'mapping', jsonb_build_object(
          'hostedHouseholdId', session_row.household_id,
          'hostedStudentId', session_row.student_id,
          'hostedAssignmentRef', target_assignment_ref,
          'hostedSessionRef', target_session_id
        ),
        'revisions', jsonb_build_object(
          'authority', authority_row.revision,
          'session', session_row.revision,
          'checkpoint', coalesce((select revision
            from public.academy_study_checkpoints
            where academy_study_checkpoints.session_id = target_session_id), 0)
        )
      );
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'study-sync-first-link:' || actor.actor_user_id::text,
    'study_sync_first_link_v2', p_client_operation_id::text,
    request_digest, fingerprint, result_value, now() + interval '180 days'
  );
  return result_value;
end;
$$;

create function public.academy_study_sync_resolve_mapping_v2(
  p_token_digest text,
  p_student_id uuid,
  p_local_scope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null
     or not public.academy_study_json_has_exact_keys(p_local_scope, array[
       'householdRef', 'studentRef', 'assignmentRef', 'sessionRef'
     ]::text[])
     or exists (
       select 1 from jsonb_each_text(p_local_scope) item
       where not academy_private.study_sync_local_ref_valid_v2(item.value)
     ) then
    raise exception 'STUDY_SYNC_MAPPING_REQUEST_INVALID' using errcode = '22023';
  end if;
  select * into actor
  from academy_private.study_sync_resolve_actor_v1(
    p_token_digest, p_student_id, 'student:progress:read'
  );
  if actor.actor_grant_id is null then
    return jsonb_build_object('schemaVersion', 2, 'status', 'unavailable');
  end if;
  select jsonb_build_object(
    'schemaVersion', 2, 'status', 'mapped',
    'mapping', jsonb_build_object(
      'localHouseholdRef', link.local_household_ref,
      'localStudentRef', link.local_student_ref,
      'localAssignmentRef', link.local_assignment_ref,
      'localSessionRef', link.local_session_ref,
      'hostedHouseholdId', link.household_id,
      'hostedStudentId', link.student_id,
      'hostedAssignmentRef', link.assignment_ref,
      'hostedSessionRef', link.session_id
    )
  ) into result_value
  from academy_private.study_sync_explicit_links_v2 as link
  where link.household_id = actor.actor_household_id
    and link.student_id = p_student_id
    and link.local_household_ref = p_local_scope ->> 'householdRef'
    and link.local_student_ref = p_local_scope ->> 'studentRef'
    and link.local_assignment_ref = p_local_scope ->> 'assignmentRef'
    and link.local_session_ref = p_local_scope ->> 'sessionRef';
  return coalesce(result_value,
    jsonb_build_object('schemaVersion', 2, 'status', 'unavailable'));
end;
$$;

create function public.academy_study_sync_hydrate_v2(
  p_token_digest text,
  p_student_id uuid,
  p_assignment_ref text,
  p_session_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null
     or not public.academy_study_identifier_is_valid(p_assignment_ref)
     or not public.academy_study_identifier_is_valid(p_session_id) then
    raise exception 'STUDY_SYNC_REQUEST_INVALID' using errcode = '22023';
  end if;
  select * into actor
  from academy_private.study_sync_resolve_actor_v1(
    p_token_digest, p_student_id, 'student:progress:read'
  );
  if actor.actor_grant_id is null then
    return jsonb_build_object('schemaVersion', 2, 'status', 'unavailable');
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'status', 'ready',
    'mapping', jsonb_build_object(
      'localHouseholdRef', link.local_household_ref,
      'localStudentRef', link.local_student_ref,
      'localAssignmentRef', link.local_assignment_ref,
      'localSessionRef', link.local_session_ref,
      'hostedHouseholdId', link.household_id,
      'hostedStudentId', link.student_id,
      'hostedAssignmentRef', link.assignment_ref,
      'hostedSessionRef', link.session_id
    ),
    'document', jsonb_build_object(
      'studentRef', link.local_student_ref,
      'assignmentRef', link.local_assignment_ref,
      'lessonRef', session.lesson_id,
      'studySessionId', link.local_session_ref,
      'completion', jsonb_build_object(
        'state', academy_private.study_session_wire_state_v2(session.state),
        'startedAt', case when session.started_at is null then null else
          to_char(session.started_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'completedAt', case when session.completed_at is null then null else
          to_char(session.completed_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
      ),
      'revisions', jsonb_build_object(
        'authority', authority.revision,
        'session', session.revision,
        'checkpoint', coalesce(checkpoint.revision, 0)
      ),
      'checkpoint', case when checkpoint.id is null then null else
        jsonb_build_object(
          'contract', 'study-core-bridge.recovery-checkpoint.v1',
          'contractVersion', 1,
          'checkpointId', checkpoint.id,
          'revision', checkpoint.revision,
          'createdAt', to_char(checkpoint.created_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'updatedAt', to_char(checkpoint.updated_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'sessionId', link.local_session_ref,
          'lessonId', checkpoint.lesson_id,
          'segmentId', checkpoint.segment_id,
          'safeInstructionalCursor', checkpoint.safe_instructional_cursor,
          'completedSegmentIds', to_jsonb(checkpoint.completed_segment_ids),
          'perSegmentActiveTime', checkpoint.per_segment_active_time,
          'pausedSeconds', checkpoint.paused_time,
          'breakSeconds', checkpoint.break_time,
          'protectedDraftRef', checkpoint.protected_draft_reference,
          'protectedTutorStateRef', checkpoint.opaque_tutor_state_reference,
          'lastAcceptedEventId', checkpoint.last_accepted_event_id,
          'eventVersion', checkpoint.event_version,
          'tutorInteractionRef', checkpoint.tutor_interaction_reference,
          'technicalInterruption', checkpoint.technical_interruption_state,
          'rawAnswerIncluded', false,
          'transcriptIncluded', false
        ) end,
      'socialSource', authority.social_source,
      'guardianAttestation', authority.guardian_attestation,
      'safetyState', jsonb_build_object(
        'schemaVersion', 1, 'holds', authority.safety_holds
      ),
      'assessment', authority.assessment_state,
      'syncMetadata', jsonb_build_object(
        'lastAuthorityClientOperationId', authority.last_client_operation_id,
        'serverAcceptedAt', to_char(authority.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    )
  ) into result_value
  from academy_private.study_sync_explicit_links_v2 as link
  join public.academy_study_sessions as session
    on session.id = link.session_id
   and session.household_id = link.household_id
   and session.student_id = link.student_id
  join public.academy_study_session_authority as authority
    on authority.session_id = session.id
   and authority.household_id = session.household_id
   and authority.student_id = session.student_id
  left join public.academy_study_checkpoints as checkpoint
    on checkpoint.session_id = session.id
   and checkpoint.household_id = session.household_id
   and checkpoint.student_id = session.student_id
  where link.household_id = actor.actor_household_id
    and link.student_id = p_student_id
    and link.assignment_ref = p_assignment_ref
    and link.session_id = p_session_id
    and (
      checkpoint.id is null
      or checkpoint.integrity_digest =
        academy_private.study_checkpoint_integrity(checkpoint)
    );
  return coalesce(result_value,
    jsonb_build_object('schemaVersion', 2, 'status', 'unavailable'));
end;
$$;

create function public.academy_study_sync_write_v2(
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
  link_row academy_private.study_sync_explicit_links_v2%rowtype;
  session_row public.academy_study_sessions%rowtype;
  authority_row public.academy_study_session_authority%rowtype;
  prior_receipt academy_private.study_mutation_receipts%rowtype;
  fingerprint jsonb;
  request_digest text;
  result_value jsonb;
  nested_result jsonb;
  candidate jsonb;
  rewritten_checkpoint jsonb;
  new_holds jsonb;
  checkpoint_event_id text;
  next_event_sequence bigint;
  current_revision bigint;
  revision_domain text;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_student_id is null
     or not public.academy_study_identifier_is_valid(p_assignment_ref)
     or not public.academy_study_identifier_is_valid(p_session_id)
     or p_expected_revision is null or p_expected_revision < 0
     or p_client_operation_id is null
     or p_operation not in (
       'checkpoint:compare-and-swap', 'session:complete',
       'social-source:attach', 'rfl:assert', 'rfl:attest',
       'safety:hold', 'safety:clear', 'assessment:set-state'
     )
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not public.academy_study_payload_is_minimized(p_payload, 16384) then
    raise exception 'STUDY_SYNC_REQUEST_INVALID' using errcode = '22023';
  end if;

  select * into actor
  from academy_private.study_sync_resolve_actor_v1(
    p_token_digest, p_student_id, 'student:attempts:create'
  );
  if actor.actor_grant_id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;
  select * into session_row
  from public.academy_study_sessions as study_session
  where study_session.id = p_session_id
    and study_session.household_id = actor.actor_household_id
    and study_session.student_id = p_student_id
  for update;
  if session_row.id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;
  select * into link_row
  from academy_private.study_sync_explicit_links_v2
  where session_id = p_session_id
    and household_id = actor.actor_household_id
    and student_id = p_student_id
    and assignment_ref = p_assignment_ref;
  select * into authority_row
  from public.academy_study_session_authority
  where session_id = p_session_id;
  if link_row.id is null or authority_row.session_id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  fingerprint := jsonb_build_object(
    'actor_kind', actor.actor_kind,
    'actor_user_id', actor.actor_user_id,
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
  where actor_scope = 'study-sync-v2:' || p_session_id
    and operation_kind = 'study_sync_write_v2'
    and idempotency_key = p_client_operation_id::text;
  if prior_receipt.idempotency_key is not null then
    if prior_receipt.request_digest = request_digest
       and prior_receipt.request_fingerprint = fingerprint then
      return prior_receipt.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'idempotency-collision',
      'operation', p_operation
    );
  end if;

  if actor.actor_kind = 'student'
     and p_operation in (
       'rfl:attest', 'safety:clear'
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'actor-not-authorized'
    );
  elsif actor.actor_kind = 'student'
     and p_operation = 'assessment:set-state'
     and p_payload #>> '{assessment,status}' in (
       'ADULT_REVIEW_REQUIRED', 'CERTIFIED'
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'actor-not-authorized'
    );
  elsif authority_row.safety_state = 'stopped'
     and (
       p_operation in ('session:complete', 'rfl:attest')
       or (
         p_operation = 'assessment:set-state'
         and p_payload #>> '{assessment,status}' = 'CERTIFIED'
       )
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'safety-hold-active'
    );
  elsif session_row.state in ('completed', 'abandoned')
     and p_operation in (
       'checkpoint:compare-and-swap', 'session:complete',
       'social-source:attach', 'rfl:assert', 'safety:hold',
       'assessment:set-state'
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-closed'
    );
  else
    revision_domain := case
      when p_operation = 'checkpoint:compare-and-swap' then 'checkpoint'
      when p_operation = 'session:complete' then 'session'
      else 'authority'
    end;
    current_revision := case revision_domain
      when 'checkpoint' then coalesce((select revision
        from public.academy_study_checkpoints
        where session_id = p_session_id), 0)
      when 'session' then session_row.revision
      else authority_row.revision
    end;
    if current_revision <> p_expected_revision then
      result_value := jsonb_build_object(
        'schemaVersion', 2, 'status', 'revision-conflict',
        'operation', p_operation, 'revisionDomain', revision_domain,
        'serverRevision', current_revision
      );
    elsif p_operation = 'checkpoint:compare-and-swap' then
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['checkpoint']::text[]
         ) or jsonb_typeof(p_payload -> 'checkpoint') <> 'object'
         or not academy_private.study_checkpoint_is_valid(p_payload -> 'checkpoint')
         or p_payload #>> '{checkpoint,sessionId}' <> link_row.local_session_ref
         or p_payload #>> '{checkpoint,lessonId}' <> session_row.lesson_id
         or (p_payload #>> '{checkpoint,revision}')::bigint <>
           p_expected_revision + 1
         or exists (
           select 1 from public.academy_study_checkpoints
           where id = p_payload #>> '{checkpoint,checkpointId}'
             and session_id <> p_session_id
         ) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-checkpoint'
        );
      else
        rewritten_checkpoint := jsonb_set(
          p_payload -> 'checkpoint', '{sessionId}', to_jsonb(p_session_id), false
        );
        checkpoint_event_id := rewritten_checkpoint ->> 'lastAcceptedEventId';
        if checkpoint_event_id is not null and not exists (
          select 1 from public.academy_study_event_ledger
          where session_id = p_session_id and event_id = checkpoint_event_id
        ) then
          select coalesce(max(sequence_number), 0) + 1
          into next_event_sequence
          from public.academy_study_event_ledger
          where session_id = p_session_id;
          insert into public.academy_study_event_ledger (
            session_id, event_id, household_id, student_id, event_version,
            event_kind, sequence_number, minimized_payload, payload_digest,
            idempotency_key
          ) values (
            p_session_id, checkpoint_event_id, session_row.household_id,
            session_row.student_id, 1, 'tutor_event_accepted',
            next_event_sequence, jsonb_build_object('schema_version', 1),
            academy_private.study_sha256_json(
              jsonb_build_object('schema_version', 1)
            ),
            'sync-event:' || md5(checkpoint_event_id)
          );
        end if;
        nested_result := public.academy_study_compare_and_swap_checkpoint(
          p_session_id, p_expected_revision,
          p_client_operation_id::text, rewritten_checkpoint
        );
        result_value := case nested_result ->> 'status'
          when 'stored' then jsonb_build_object(
            'schemaVersion', 2, 'status', 'stored',
            'operation', p_operation, 'revisionDomain', 'checkpoint',
            'serverRevision', (nested_result ->> 'revision')::bigint
          )
          when 'revision-conflict' then jsonb_build_object(
            'schemaVersion', 2, 'status', 'revision-conflict',
            'operation', p_operation, 'revisionDomain', 'checkpoint',
            'serverRevision', (nested_result ->> 'currentRevision')::bigint
          )
          else jsonb_build_object(
            'schemaVersion', 2, 'status', 'invalid-write',
            'operation', p_operation,
            'reasonCode', coalesce(
              nested_result #>> '{quarantine,reasonCode}', 'invalid-checkpoint'
            )
          )
        end;
      end if;
    elsif p_operation = 'session:complete' then
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['completedAt']::text[]
         )
         or not academy_private.study_sync_instant_valid_v2(
           p_payload ->> 'completedAt'
         )
         or session_row.started_at is null
         or (p_payload ->> 'completedAt')::timestamptz < session_row.started_at
         or (session_row.accepted_at is not null
           and (p_payload ->> 'completedAt')::timestamptz < session_row.accepted_at) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-completion'
        );
      else
        update public.academy_study_sessions
        set state = 'completed',
            completed_at = (p_payload ->> 'completedAt')::timestamptz,
            last_transition_kind = case when session_semantics_version = 2
              then 'session-completed' else last_transition_kind end,
            last_transition_at = case when session_semantics_version = 2
              then (p_payload ->> 'completedAt')::timestamptz
              else last_transition_at end
        where id = p_session_id
        returning * into session_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'session',
          'serverRevision', session_row.revision,
          'completionState', 'completed',
          'completedAt', p_payload ->> 'completedAt'
        );
      end if;
    elsif p_operation = 'social-source:attach' then
      candidate := p_payload -> 'source';
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['source']::text[]
         )
         or not academy_private.study_sync_source_valid_v2(candidate)
         or not academy_private.study_sync_scope_matches_v2(
           p_session_id, p_student_id, p_assignment_ref,
           candidate ->> 'studentRef', candidate ->> 'assignmentRef', null
         )
         or candidate ->> 'lessonRef' <> session_row.lesson_id
         or authority_row.social_source is not null then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode',
          case when authority_row.social_source is not null
            then 'remote-state-exists' else 'invalid-source' end
        );
      else
        update public.academy_study_session_authority
        set social_source = candidate,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where session_id = p_session_id returning * into authority_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision
        );
      end if;
    elsif p_operation in ('rfl:assert', 'rfl:attest') then
      candidate := p_payload -> 'attestation';
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['attestation']::text[]
         )
         or not academy_private.study_sync_attestation_valid_v2(candidate)
         or not academy_private.study_sync_scope_matches_v2(
           p_session_id, p_student_id, p_assignment_ref,
           candidate ->> 'studentRef', candidate ->> 'assignmentRef',
           candidate ->> 'sessionRef'
         )
         or candidate ->> 'lessonRef' <> session_row.lesson_id
         or (p_operation = 'rfl:assert'
           and candidate ->> 'status' <> 'PENDING_GUARDIAN_ATTESTATION')
         or (p_operation = 'rfl:attest'
           and (candidate ->> 'status' <> 'CERTIFIED'
             or authority_row.guardian_attestation is null
             or authority_row.guardian_attestation ->> 'status'
               <> 'PENDING_GUARDIAN_ATTESTATION'
             or authority_row.guardian_attestation ->> 'learnerAssertedAt'
               <> candidate ->> 'learnerAssertedAt'))
         or (p_operation = 'rfl:assert'
           and authority_row.guardian_attestation is not null) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-attestation'
        );
      else
        update public.academy_study_session_authority
        set guardian_attestation = candidate,
            guardian_attestation_state = case
              when candidate ->> 'status' = 'CERTIFIED'
                then 'attested' else 'pending' end,
            guardian_attested_at = case
              when candidate ->> 'status' = 'CERTIFIED'
                then (candidate ->> 'attestedAt')::timestamptz else null end,
            guardian_attested_by = case
              when candidate ->> 'status' = 'CERTIFIED'
                then actor.actor_user_id else null end,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where session_id = p_session_id returning * into authority_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision,
          'guardianAttestationStatus', candidate ->> 'status'
        );
      end if;
    elsif p_operation = 'safety:hold' then
      candidate := p_payload -> 'hold';
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['hold']::text[]
         )
         or not academy_private.study_sync_hold_valid_v2(candidate)
         or candidate ->> 'status' = 'cleared'
         or not academy_private.study_sync_scope_matches_v2(
           p_session_id, p_student_id, p_assignment_ref,
           candidate ->> 'studentRef', null, candidate ->> 'sessionRef'
         ) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-safety-hold'
        );
      elsif exists (
        select 1 from jsonb_array_elements(authority_row.safety_holds) held(value)
        where held.value ->> 'dedupeKey' = candidate ->> 'dedupeKey'
          and held.value ->> 'status' <> 'cleared'
      ) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision, 'deduplicated', true
        );
      else
        new_holds := authority_row.safety_holds || jsonb_build_array(candidate);
        update public.academy_study_session_authority
        set safety_holds = new_holds, safety_state = 'stopped',
            safety_stopped_at = (candidate ->> 'createdAt')::timestamptz,
            safety_cleared_at = null, safety_cleared_by = null,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where session_id = p_session_id returning * into authority_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision, 'safetyState', 'stopped'
        );
      end if;
    elsif p_operation = 'safety:clear' then
      if not public.academy_study_json_has_exact_keys(p_payload, array[
           'holdRef', 'clearedAt', 'clearedByRef'
         ]::text[])
         or not academy_private.study_sync_local_ref_valid_v2(p_payload ->> 'holdRef')
         or not academy_private.study_sync_instant_valid_v2(p_payload ->> 'clearedAt')
         or not academy_private.study_sync_local_ref_valid_v2(p_payload ->> 'clearedByRef')
         or not exists (
           select 1 from jsonb_array_elements(authority_row.safety_holds) held(value)
           where held.value ->> 'holdRef' = p_payload ->> 'holdRef'
             and held.value ->> 'status' <> 'cleared'
         ) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-safety-clear'
        );
      else
        select jsonb_agg(case
          when held.value ->> 'holdRef' = p_payload ->> 'holdRef'
          then held.value || jsonb_build_object(
            'status', 'cleared',
            'clearedAt', p_payload ->> 'clearedAt',
            'clearedBy', p_payload ->> 'clearedByRef'
          )
          else held.value end order by held.ordinality)
        into new_holds
        from jsonb_array_elements(authority_row.safety_holds)
          with ordinality as held(value, ordinality);
        update public.academy_study_session_authority
        set safety_holds = new_holds,
            safety_state = case when exists (
              select 1 from jsonb_array_elements(new_holds) held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then 'stopped' else 'clear' end,
            safety_stopped_at = case when exists (
              select 1 from jsonb_array_elements(new_holds) held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then safety_stopped_at else null end,
            safety_cleared_at = case when exists (
              select 1 from jsonb_array_elements(new_holds) held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then null else (p_payload ->> 'clearedAt')::timestamptz end,
            safety_cleared_by = case when exists (
              select 1 from jsonb_array_elements(new_holds) held(value)
              where held.value ->> 'status' <> 'cleared'
            ) then null else actor.actor_user_id end,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where session_id = p_session_id returning * into authority_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision,
          'safetyState', authority_row.safety_state
        );
      end if;
    elsif p_operation = 'assessment:set-state' then
      candidate := p_payload -> 'assessment';
      if not public.academy_study_json_has_exact_keys(
           p_payload, array['assessment']::text[]
         )
         or not academy_private.study_sync_assessment_valid_v2(candidate)
         or not academy_private.study_sync_scope_matches_v2(
           p_session_id, p_student_id, p_assignment_ref,
           candidate ->> 'studentRef', candidate ->> 'assignmentRef', null
         ) then
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'invalid-write',
          'operation', p_operation, 'reasonCode', 'invalid-assessment'
        );
      else
        update public.academy_study_session_authority
        set assessment_state = candidate,
            last_client_operation_id = p_client_operation_id,
            last_actor_kind = actor.actor_kind,
            last_actor_user_id = actor.actor_user_id,
            last_actor_grant_id = actor.actor_grant_id
        where session_id = p_session_id returning * into authority_row;
        result_value := jsonb_build_object(
          'schemaVersion', 2, 'status', 'stored',
          'operation', p_operation, 'revisionDomain', 'authority',
          'serverRevision', authority_row.revision,
          'assessmentStatus', candidate ->> 'status'
        );
      end if;
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'study-sync-v2:' || p_session_id, 'study_sync_write_v2',
    p_client_operation_id::text, request_digest, fingerprint,
    result_value, now() + interval '180 days'
  );
  return result_value;
end;
$$;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) owner to postgres;
alter function public.academy_study_sync_resolve_mapping_v2(
  text, uuid, jsonb
) owner to postgres;
alter function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) owner to postgres;
alter function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) owner to postgres;

revoke all on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_resolve_mapping_v2(
  text, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) to authenticated;
grant execute on function public.academy_study_sync_resolve_mapping_v2(
  text, uuid, jsonb
) to authenticated;
grant execute on function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) to authenticated;
grant execute on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) to authenticated;

alter table academy_private.study_persistence_metadata
  add column lossless_sync_version smallint not null default 0
    check (lossless_sync_version in (0, 2));

update academy_private.study_persistence_metadata
set lossless_sync_version = 2,
    migration_names = array_append(
      migration_names, '20260813172000_academy_study_sync_lossless_v2'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'lossless_sync_version', 2,
      'first_link_guardian_only', true,
      'existing_remote_overwrite', false,
      'hydrate_exact_grant_binding', true,
      'mapping_name_guessing', false,
      'revision_domains', array['authority', 'session', 'checkpoint']::text[],
      'cas_required', true,
      'idempotency_receipt_days', 180,
      'browser_service_role', false,
      'checkpoint_full_schema', true,
      'rfl_exact_state', true,
      'social_source_exact_state', true,
      'safety_hold_history', true,
      'assessment_exact_state', true
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table academy_private.study_sync_explicit_links_v2 is
  'Guardian-confirmed stable-reference mapping to canonical household/student/assignment/session identity. Contains no names and has no browser table grants.';
comment on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) is
  'Guardian-only, actor-bound, idempotent compare-and-create Study import. Existing canonical state is linked but never overwritten.';
comment on function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) is
  'Current-grant-bound lossless minimized hydrate including full checkpoint, completion, RFL, Social source, safety hold history, assessment and explicit mapping state.';
comment on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) is
  'Current-grant-bound revision-domain CAS with UUID idempotency for checkpoint, completion, RFL, Social source, safety and assessment state.';

commit;
