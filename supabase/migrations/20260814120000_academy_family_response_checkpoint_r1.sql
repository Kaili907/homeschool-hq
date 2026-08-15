-- Narrow Family Pilot learner-response checkpoint authority.
--
-- This forward-only migration extends Hosted Sync V2 without changing any
-- historical migration. Response values are stored in typed columns and
-- versioned, append-only item snapshots. There is no general Family Pilot
-- JSON bucket, prompt/answer authority, scoring guide, or Tutor conversation.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Family response checkpoint migration must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.lossless_sync_version is distinct from 2
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260813170000_academy_study_actor_authority_convergence',
       '20260813171000_academy_study_cross_device_authority',
       '20260813172000_academy_study_sync_lossless_v2',
       '20260813173000_academy_study_sync_lossless_checkpoint_r1'
     ]::text[]) then
    raise exception 'FAMILY_RESPONSE_CHECKPOINT predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260814120000_academy_family_response_checkpoint_r1'
     ]::text[] then
    raise exception 'FAMILY_RESPONSE_CHECKPOINT already applied';
  end if;

  if to_regclass('public.academy_family_response_checkpoints') is not null
     or to_regclass('public.academy_family_response_checkpoint_items') is not null
     or to_regprocedure(
       'academy_private.study_family_response_item_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_response_checkpoint_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_response_checkpoint_document_r1(uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_response_transition_valid_r1(jsonb,jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_response_insert_items_r1(uuid,uuid,text,bigint,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2_response_r1(text,uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_hydrate_v2_response_r1(text,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_write_v2_response_r1(text,uuid,text,text,bigint,uuid,text,jsonb)'
     ) is not null then
    raise exception 'FAMILY_RESPONSE_CHECKPOINT object collision';
  end if;
end;
$$;

create function academy_private.study_family_response_item_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  response_value jsonb;
  assessment_value jsonb;
  response_type text;
  response_status text;
  evidence_mode text;
begin
  if not academy_private.study_sync_keys_allowed_r1(
       candidate,
       array[
         'itemRef', 'sectionRef', 'segmentRef', 'responseType',
         'evidenceMode', 'response', 'status', 'savedAt', 'assessment'
       ]::text[],
       array[
         'itemRef', 'sectionRef', 'segmentRef', 'responseType',
         'evidenceMode', 'response', 'status', 'savedAt', 'assessment'
       ]::text[]
     )
     or octet_length(candidate::text) > 32768
     or not academy_private.study_sync_local_ref_valid_v2(candidate ->> 'itemRef')
     or not academy_private.study_sync_local_ref_valid_v2(candidate ->> 'sectionRef')
     or not academy_private.study_sync_local_ref_valid_v2(candidate ->> 'segmentRef')
     or not academy_private.study_sync_instant_valid_v2(candidate ->> 'savedAt') then
    return false;
  end if;

  response_type := candidate ->> 'responseType';
  response_status := candidate ->> 'status';
  evidence_mode := candidate ->> 'evidenceMode';
  response_value := candidate -> 'response';
  assessment_value := candidate -> 'assessment';

  if response_type not in (
       'CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE',
       'ACTIVITY_EVIDENCE'
     )
     or response_status not in ('PENDING_ASSESSMENT', 'ASSESSED')
     or (
       jsonb_typeof(candidate -> 'evidenceMode') <> 'null'
       and evidence_mode not in (
         'SUPPORTED', 'INDEPENDENT', 'MASTERY', 'COMPLETION'
       )
     ) then
    return false;
  end if;

  if response_type = 'CHOICE' then
    if not academy_private.study_sync_keys_allowed_r1(
         response_value,
         array['kind', 'choiceRef']::text[],
         array['kind', 'choiceRef']::text[]
       )
       or response_value ->> 'kind' <> 'CHOICE'
       or not academy_private.study_sync_local_ref_valid_v2(
         response_value ->> 'choiceRef'
       ) then
      return false;
    end if;
  else
    if not academy_private.study_sync_keys_allowed_r1(
         response_value,
         array['kind', 'text']::text[],
         array['kind', 'text']::text[]
       )
       or response_value ->> 'kind' <> response_type
       or not academy_private.study_sync_text_valid_v2(
         response_value ->> 'text', 16384
       ) then
      return false;
    end if;
  end if;

  if response_status = 'PENDING_ASSESSMENT' then
    return jsonb_typeof(assessment_value) = 'null';
  end if;

  return academy_private.study_sync_keys_allowed_r1(
      assessment_value,
      array[
        'assessmentRef', 'assessorRef', 'assessedAt', 'decision'
      ]::text[],
      array[
        'assessmentRef', 'assessorRef', 'assessedAt', 'decision'
      ]::text[]
    )
    and academy_private.study_sync_local_ref_valid_v2(
      assessment_value ->> 'assessmentRef'
    )
    and academy_private.study_sync_local_ref_valid_v2(
      assessment_value ->> 'assessorRef'
    )
    and academy_private.study_sync_instant_valid_v2(
      assessment_value ->> 'assessedAt'
    )
    and assessment_value ->> 'decision' in (
      'CORRECT', 'INCORRECT', 'PARTIAL', 'REVIEW_REQUIRED'
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_response_checkpoint_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  identity_value jsonb;
  attempt_value jsonb;
  sync_value jsonb;
  responses_value jsonb;
begin
  if not academy_private.study_sync_keys_allowed_r1(
       candidate,
       array[
         'contract', 'contractVersion', 'identity', 'attempt', 'sync',
         'responses'
       ]::text[],
       array[
         'contract', 'contractVersion', 'identity', 'attempt', 'sync',
         'responses'
       ]::text[]
     )
     or candidate ->> 'contract' <>
       'family-pilot.learner-response-checkpoint.r1'
     or jsonb_typeof(candidate -> 'contractVersion') <> 'number'
     or candidate ->> 'contractVersion' <> '1'
     or octet_length(candidate::text) > 1048576 then
    return false;
  end if;

  identity_value := candidate -> 'identity';
  attempt_value := candidate -> 'attempt';
  sync_value := candidate -> 'sync';
  responses_value := candidate -> 'responses';

  if not academy_private.study_sync_keys_allowed_r1(
       identity_value,
       array[
         'householdRef', 'studentRef', 'learnerRef', 'assignmentRef',
         'sessionRef'
       ]::text[],
       array[
         'householdRef', 'studentRef', 'learnerRef', 'assignmentRef',
         'sessionRef'
       ]::text[]
     )
     or exists (
       select 1
       from jsonb_each_text(identity_value) as item
       where not academy_private.study_sync_local_ref_valid_v2(item.value)
     )
     or not academy_private.study_sync_keys_allowed_r1(
       attempt_value,
       array['attemptRef', 'lessonRef']::text[],
       array['attemptRef', 'lessonRef']::text[]
     )
     or not academy_private.study_sync_local_ref_valid_v2(
       attempt_value ->> 'attemptRef'
     )
     or not academy_private.study_sync_local_ref_valid_v2(
       attempt_value ->> 'lessonRef'
     )
     or not academy_private.study_sync_keys_allowed_r1(
       sync_value,
       array[
         'baseRevision', 'revision', 'operationId', 'savedAt'
       ]::text[],
       array[
         'baseRevision', 'revision', 'operationId', 'savedAt'
       ]::text[]
     )
     or jsonb_typeof(sync_value -> 'baseRevision') <> 'number'
     or jsonb_typeof(sync_value -> 'revision') <> 'number'
     or (sync_value ->> 'baseRevision')::numeric < 0
     or (sync_value ->> 'baseRevision')::numeric <> trunc(
       (sync_value ->> 'baseRevision')::numeric
     )
     or (sync_value ->> 'revision')::numeric < 0
     or (sync_value ->> 'revision')::numeric <> trunc(
       (sync_value ->> 'revision')::numeric
     )
     or (sync_value ->> 'operationId') !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or not academy_private.study_sync_instant_valid_v2(
       sync_value ->> 'savedAt'
     )
     or jsonb_typeof(responses_value) <> 'array'
     or jsonb_array_length(responses_value) > 256
     or exists (
       select 1
       from jsonb_array_elements(responses_value) as response(value)
       where not academy_private.study_family_response_item_valid_r1(
         response.value
       )
     )
     or (
       select count(*) <> count(distinct response.value ->> 'itemRef')
       from jsonb_array_elements(responses_value) as response(value)
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create table public.academy_family_response_checkpoints (
  session_id text primary key
    check (public.academy_study_identifier_is_valid(session_id)),
  household_id uuid not null,
  student_id uuid not null,
  assignment_ref text not null
    check (public.academy_study_identifier_is_valid(assignment_ref)),
  local_household_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_household_ref)),
  local_student_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_student_ref)),
  local_learner_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_learner_ref)),
  local_assignment_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_assignment_ref)),
  local_session_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_session_ref)),
  attempt_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(attempt_ref)),
  lesson_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(lesson_ref)),
  contract_version smallint not null default 1 check (contract_version = 1),
  base_revision bigint not null check (base_revision >= 0),
  revision bigint not null check (revision >= 0),
  last_client_operation_id uuid not null,
  saved_at timestamptz not null,
  document_digest text not null check (document_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint academy_family_response_checkpoint_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on update restrict on delete restrict,
  constraint academy_family_response_checkpoint_revision_pair check (
    (revision = 0 and base_revision = 0)
    or (revision > 0 and base_revision = revision - 1)
  ),
  constraint academy_family_response_checkpoint_scope_key
    unique (session_id, household_id, student_id),
  constraint academy_family_response_checkpoint_local_scope_key
    unique (
      household_id, student_id, local_household_ref, local_student_ref,
      local_assignment_ref, local_session_ref, attempt_ref
    )
);

create table public.academy_family_response_checkpoint_items (
  session_id text not null,
  household_id uuid not null,
  student_id uuid not null,
  checkpoint_revision bigint not null check (checkpoint_revision >= 0),
  item_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(item_ref)),
  section_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(section_ref)),
  segment_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(segment_ref)),
  response_type text not null check (response_type in (
    'CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE',
    'ACTIVITY_EVIDENCE'
  )),
  evidence_mode text check (
    evidence_mode is null
    or evidence_mode in ('SUPPORTED', 'INDEPENDENT', 'MASTERY', 'COMPLETION')
  ),
  choice_ref text check (
    choice_ref is null
    or academy_private.study_sync_local_ref_valid_v2(choice_ref)
  ),
  response_text text check (
    response_text is null
    or academy_private.study_sync_text_valid_v2(response_text, 16384)
  ),
  response_status text not null
    check (response_status in ('PENDING_ASSESSMENT', 'ASSESSED')),
  response_saved_at timestamptz not null,
  assessment_ref text check (
    assessment_ref is null
    or academy_private.study_sync_local_ref_valid_v2(assessment_ref)
  ),
  assessor_ref text check (
    assessor_ref is null
    or academy_private.study_sync_local_ref_valid_v2(assessor_ref)
  ),
  assessed_at timestamptz,
  assessment_decision text check (
    assessment_decision is null
    or assessment_decision in (
      'CORRECT', 'INCORRECT', 'PARTIAL', 'REVIEW_REQUIRED'
    )
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key (session_id, checkpoint_revision, item_ref),
  constraint academy_family_response_item_checkpoint_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_family_response_checkpoints
      (session_id, household_id, student_id)
    on update restrict on delete restrict,
  constraint academy_family_response_item_value_shape check (
    (response_type = 'CHOICE' and choice_ref is not null and response_text is null)
    or (response_type <> 'CHOICE' and choice_ref is null and response_text is not null)
  ),
  constraint academy_family_response_item_assessment_shape check (
    (
      response_status = 'PENDING_ASSESSMENT'
      and assessment_ref is null
      and assessor_ref is null
      and assessed_at is null
      and assessment_decision is null
    )
    or (
      response_status = 'ASSESSED'
      and assessment_ref is not null
      and assessor_ref is not null
      and assessed_at is not null
      and assessment_decision is not null
    )
  )
);

alter table public.academy_family_response_checkpoints owner to postgres;
alter table public.academy_family_response_checkpoint_items owner to postgres;
alter table public.academy_family_response_checkpoints enable row level security;
alter table public.academy_family_response_checkpoints force row level security;
alter table public.academy_family_response_checkpoint_items enable row level security;
alter table public.academy_family_response_checkpoint_items force row level security;

create index academy_family_response_checkpoints_student_idx
  on public.academy_family_response_checkpoints
  (student_id, updated_at desc, session_id);
create index academy_family_response_items_current_idx
  on public.academy_family_response_checkpoint_items
  (household_id, student_id, session_id, checkpoint_revision, item_ref);

create policy academy_family_response_checkpoints_select
  on public.academy_family_response_checkpoints
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_family_response_checkpoints_deny_insert
  on public.academy_family_response_checkpoints
  for insert to authenticated with check (false);
create policy academy_family_response_checkpoints_deny_update
  on public.academy_family_response_checkpoints
  for update to authenticated using (false) with check (false);
create policy academy_family_response_checkpoints_deny_delete
  on public.academy_family_response_checkpoints
  for delete to authenticated using (false);

create policy academy_family_response_items_current_select
  on public.academy_family_response_checkpoint_items
  for select to authenticated
  using (
    public.academy_study_can_view(household_id, student_id)
    and exists (
      select 1
      from public.academy_family_response_checkpoints as checkpoint
      where checkpoint.session_id =
          academy_family_response_checkpoint_items.session_id
        and checkpoint.household_id =
          academy_family_response_checkpoint_items.household_id
        and checkpoint.student_id =
          academy_family_response_checkpoint_items.student_id
        and checkpoint.revision =
          academy_family_response_checkpoint_items.checkpoint_revision
    )
  );
create policy academy_family_response_items_deny_insert
  on public.academy_family_response_checkpoint_items
  for insert to authenticated with check (false);
create policy academy_family_response_items_deny_update
  on public.academy_family_response_checkpoint_items
  for update to authenticated using (false) with check (false);
create policy academy_family_response_items_deny_delete
  on public.academy_family_response_checkpoint_items
  for delete to authenticated using (false);

revoke all on table public.academy_family_response_checkpoints
  from public, anon, authenticated, service_role;
revoke all on table public.academy_family_response_checkpoint_items
  from public, anon, authenticated, service_role;

grant select (
  session_id, household_id, student_id, assignment_ref,
  local_household_ref, local_student_ref, local_learner_ref,
  local_assignment_ref, local_session_ref, attempt_ref, lesson_ref,
  contract_version, base_revision, revision, last_client_operation_id,
  saved_at, created_at, updated_at
) on table public.academy_family_response_checkpoints to authenticated;

grant select (
  session_id, household_id, student_id, checkpoint_revision, item_ref,
  section_ref, segment_ref, response_type, evidence_mode, choice_ref,
  response_text, response_status, response_saved_at, assessment_ref,
  assessor_ref, assessed_at, assessment_decision, created_at
) on table public.academy_family_response_checkpoint_items to authenticated;

create function academy_private.study_family_response_checkpoint_document_r1(
  target_household_id uuid,
  target_student_id uuid,
  target_session_id text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'contract', 'family-pilot.learner-response-checkpoint.r1',
    'contractVersion', checkpoint.contract_version,
    'identity', jsonb_build_object(
      'householdRef', checkpoint.local_household_ref,
      'studentRef', checkpoint.local_student_ref,
      'learnerRef', checkpoint.local_learner_ref,
      'assignmentRef', checkpoint.local_assignment_ref,
      'sessionRef', checkpoint.local_session_ref
    ),
    'attempt', jsonb_build_object(
      'attemptRef', checkpoint.attempt_ref,
      'lessonRef', checkpoint.lesson_ref
    ),
    'sync', jsonb_build_object(
      'baseRevision', checkpoint.base_revision,
      'revision', checkpoint.revision,
      'operationId', checkpoint.last_client_operation_id,
      'savedAt', to_char(
        checkpoint.saved_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    'responses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'itemRef', item.item_ref,
          'sectionRef', item.section_ref,
          'segmentRef', item.segment_ref,
          'responseType', item.response_type,
          'evidenceMode', item.evidence_mode,
          'response', case when item.response_type = 'CHOICE'
            then jsonb_build_object(
              'kind', 'CHOICE', 'choiceRef', item.choice_ref
            )
            else jsonb_build_object(
              'kind', item.response_type, 'text', item.response_text
            )
          end,
          'status', item.response_status,
          'savedAt', to_char(
            item.response_saved_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'assessment', case when item.response_status = 'ASSESSED'
            then jsonb_build_object(
              'assessmentRef', item.assessment_ref,
              'assessorRef', item.assessor_ref,
              'assessedAt', to_char(
                item.assessed_at at time zone 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
              ),
              'decision', item.assessment_decision
            )
            else 'null'::jsonb
          end
        ) order by item.item_ref
      )
      from public.academy_family_response_checkpoint_items as item
      where item.session_id = checkpoint.session_id
        and item.household_id = checkpoint.household_id
        and item.student_id = checkpoint.student_id
        and item.checkpoint_revision = checkpoint.revision
    ), '[]'::jsonb)
  )
  from public.academy_family_response_checkpoints as checkpoint
  where checkpoint.household_id = target_household_id
    and checkpoint.student_id = target_student_id
    and checkpoint.session_id = target_session_id;
$$;

create function academy_private.study_family_response_transition_valid_r1(
  old_document jsonb,
  new_document jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return academy_private.study_family_response_checkpoint_valid_r1(old_document)
    and academy_private.study_family_response_checkpoint_valid_r1(new_document)
    and old_document -> 'identity' = new_document -> 'identity'
    and old_document -> 'attempt' = new_document -> 'attempt'
    and (new_document #>> '{sync,savedAt}')::timestamptz >=
      (old_document #>> '{sync,savedAt}')::timestamptz
    and not exists (
      select 1
      from jsonb_array_elements(old_document -> 'responses') as old_item(value)
      where not exists (
        select 1
        from jsonb_array_elements(new_document -> 'responses') as new_item(value)
        where new_item.value ->> 'itemRef' = old_item.value ->> 'itemRef'
          and (new_item.value ->> 'savedAt')::timestamptz >=
            (old_item.value ->> 'savedAt')::timestamptz
          and (
            (new_item.value ->> 'savedAt')::timestamptz >
              (old_item.value ->> 'savedAt')::timestamptz
            or new_item.value = old_item.value
          )
      )
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_response_insert_items_r1(
  target_household_id uuid,
  target_student_id uuid,
  target_session_id text,
  target_revision bigint,
  response_items jsonb
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  insert into public.academy_family_response_checkpoint_items (
    session_id, household_id, student_id, checkpoint_revision,
    item_ref, section_ref, segment_ref, response_type, evidence_mode,
    choice_ref, response_text, response_status, response_saved_at,
    assessment_ref, assessor_ref, assessed_at, assessment_decision
  )
  select
    target_session_id,
    target_household_id,
    target_student_id,
    target_revision,
    item.value ->> 'itemRef',
    item.value ->> 'sectionRef',
    item.value ->> 'segmentRef',
    item.value ->> 'responseType',
    item.value ->> 'evidenceMode',
    case when item.value ->> 'responseType' = 'CHOICE'
      then item.value #>> '{response,choiceRef}' else null end,
    case when item.value ->> 'responseType' <> 'CHOICE'
      then item.value #>> '{response,text}' else null end,
    item.value ->> 'status',
    (item.value ->> 'savedAt')::timestamptz,
    item.value #>> '{assessment,assessmentRef}',
    item.value #>> '{assessment,assessorRef}',
    case when jsonb_typeof(item.value -> 'assessment') = 'object'
      then (item.value #>> '{assessment,assessedAt}')::timestamptz
      else null end,
    item.value #>> '{assessment,decision}'
  from jsonb_array_elements(response_items) as item(value);
$$;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) rename to academy_study_sync_first_link_v2_response_r1;
alter function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) rename to academy_study_sync_hydrate_v2_response_r1;
alter function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) rename to academy_study_sync_write_v2_response_r1;

revoke all on function public.academy_study_sync_first_link_v2_response_r1(
  text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_hydrate_v2_response_r1(
  text, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_write_v2_response_r1(
  text, uuid, text, text, bigint, uuid, text, jsonb
) from public, anon, authenticated, service_role;

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
  candidate jsonb;
  actor record;
  held public.academy_family_response_checkpoints%rowtype;
  link academy_private.study_sync_explicit_links_v2%rowtype;
  result_value jsonb;
  candidate_digest text;
begin
  if not (p_import ? 'learnerResponseCheckpoint') then
    return public.academy_study_sync_first_link_v2_response_r1(
      p_token_digest, p_student_id, p_client_operation_id, p_import
    );
  end if;

  if not academy_private.study_sync_keys_allowed_r1(
       p_import,
       array[
         'localScope', 'hostedScope', 'session', 'checkpoint',
         'socialSource', 'guardianAttestation', 'safetyState', 'assessment',
         'authorityCheckpoint', 'learnerResponseCheckpoint'
       ]::text[],
       array[
         'localScope', 'hostedScope', 'session', 'checkpoint',
         'socialSource', 'guardianAttestation', 'safetyState', 'assessment',
         'authorityCheckpoint', 'learnerResponseCheckpoint'
       ]::text[]
     ) then
    raise exception 'STUDY_SYNC_IMPORT_INVALID' using errcode = '22023';
  end if;

  candidate := p_import -> 'learnerResponseCheckpoint';
  if not academy_private.study_family_response_checkpoint_valid_r1(candidate)
     or candidate #>> '{identity,householdRef}' <>
       p_import #>> '{localScope,householdRef}'
     or candidate #>> '{identity,studentRef}' <>
       p_import #>> '{localScope,studentRef}'
     or candidate #>> '{identity,assignmentRef}' <>
       p_import #>> '{localScope,assignmentRef}'
     or candidate #>> '{identity,sessionRef}' <>
       p_import #>> '{localScope,sessionRef}'
     or candidate #>> '{attempt,lessonRef}' <>
       p_import #>> '{session,lessonRef}'
     or candidate #>> '{identity,learnerRef}' <>
       p_import #>> '{authorityCheckpoint,identity,learnerRef}'
     or (candidate #>> '{sync,baseRevision}')::bigint <> 0
     or (candidate #>> '{sync,revision}')::bigint <> 0
     or candidate #>> '{sync,operationId}' <> p_client_operation_id::text then
    raise exception 'FAMILY_RESPONSE_CHECKPOINT_INVALID' using errcode = '22023';
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'family-response-first-link:' || actor.actor_household_id::text || ':' ||
      p_student_id::text || ':' || (p_import #>> '{hostedScope,sessionRef}'),
      0
    )
  );
  candidate_digest := academy_private.study_sha256_json(candidate);
  select * into held
  from public.academy_family_response_checkpoints as checkpoint
  where checkpoint.household_id = actor.actor_household_id
    and checkpoint.student_id = p_student_id
    and checkpoint.session_id = p_import #>> '{hostedScope,sessionRef}'
  for update;

  if held.session_id is not null
     and (
       held.last_client_operation_id <> p_client_operation_id
       or held.document_digest <> candidate_digest
     ) then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'mapping-conflict'
    );
  end if;

  result_value := public.academy_study_sync_first_link_v2_response_r1(
    p_token_digest,
    p_student_id,
    p_client_operation_id,
    p_import - 'learnerResponseCheckpoint'
  );
  if result_value ->> 'status' not in ('imported', 'linked-existing') then
    return result_value;
  end if;

  if held.session_id is null then
    select candidate_link.* into link
    from academy_private.study_sync_explicit_links_v2 as candidate_link
    where candidate_link.household_id = actor.actor_household_id
      and candidate_link.student_id = p_student_id
      and candidate_link.assignment_ref =
        p_import #>> '{hostedScope,assignmentRef}'
      and candidate_link.session_id = p_import #>> '{hostedScope,sessionRef}'
      and candidate_link.local_household_ref =
        candidate #>> '{identity,householdRef}'
      and candidate_link.local_student_ref =
        candidate #>> '{identity,studentRef}'
      and candidate_link.local_assignment_ref =
        candidate #>> '{identity,assignmentRef}'
      and candidate_link.local_session_ref =
        candidate #>> '{identity,sessionRef}';
    if link.id is null then
      raise exception 'FAMILY_RESPONSE_CHECKPOINT_LINK_MISSING';
    end if;

    insert into public.academy_family_response_checkpoints (
      session_id, household_id, student_id, assignment_ref,
      local_household_ref, local_student_ref, local_learner_ref,
      local_assignment_ref, local_session_ref, attempt_ref, lesson_ref,
      base_revision, revision, last_client_operation_id, saved_at,
      document_digest
    ) values (
      link.session_id, link.household_id, link.student_id, link.assignment_ref,
      link.local_household_ref, link.local_student_ref,
      candidate #>> '{identity,learnerRef}',
      link.local_assignment_ref, link.local_session_ref,
      candidate #>> '{attempt,attemptRef}',
      candidate #>> '{attempt,lessonRef}', 0, 0, p_client_operation_id,
      (candidate #>> '{sync,savedAt}')::timestamptz, candidate_digest
    );
    perform academy_private.study_family_response_insert_items_r1(
      link.household_id,
      link.student_id,
      link.session_id,
      0,
      candidate -> 'responses'
    );
  end if;

  return jsonb_set(
    result_value,
    '{revisions,learnerResponseCheckpoint}',
    '0'::jsonb,
    true
  );
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
  result_value jsonb;
  response_document jsonb;
begin
  result_value := public.academy_study_sync_hydrate_v2_response_r1(
    p_token_digest, p_student_id, p_assignment_ref, p_session_id
  );
  if result_value ->> 'status' <> 'ready' then
    return result_value;
  end if;

  select academy_private.study_family_response_checkpoint_document_r1(
    checkpoint.household_id,
    checkpoint.student_id,
    checkpoint.session_id
  ) into response_document
  from public.academy_family_response_checkpoints as checkpoint
  join academy_private.study_sync_explicit_links_v2 as link
    on link.household_id = checkpoint.household_id
   and link.student_id = checkpoint.student_id
   and link.assignment_ref = checkpoint.assignment_ref
   and link.session_id = checkpoint.session_id
  where link.student_id = p_student_id
    and link.assignment_ref = p_assignment_ref
    and link.session_id = p_session_id;

  if response_document is null then
    return result_value;
  end if;
  return result_value || jsonb_build_object(
    'learnerResponseCheckpoint', response_document,
    'learnerResponseCheckpointRevision',
      (response_document #>> '{sync,revision}')::bigint
  );
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
  held public.academy_family_response_checkpoints%rowtype;
  candidate jsonb;
  old_document jsonb;
  fingerprint jsonb;
  request_digest text;
  prior academy_private.study_mutation_receipts%rowtype;
  result_value jsonb;
begin
  if p_operation <> 'learner-response-checkpoint:compare-and-swap' then
    return public.academy_study_sync_write_v2_response_r1(
      p_token_digest, p_student_id, p_assignment_ref, p_session_id,
      p_expected_revision, p_client_operation_id, p_operation, p_payload
    );
  end if;

  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_expected_revision is null
     or p_expected_revision < 0
     or p_client_operation_id is null
     or not public.academy_study_identifier_is_valid(p_assignment_ref)
     or not public.academy_study_identifier_is_valid(p_session_id)
     or not public.academy_study_json_has_exact_keys(
       p_payload, array['learnerResponseCheckpoint']::text[]
     ) then
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

  select checkpoint.* into held
  from public.academy_family_response_checkpoints as checkpoint
  join academy_private.study_sync_explicit_links_v2 as link
    on link.household_id = checkpoint.household_id
   and link.student_id = checkpoint.student_id
   and link.assignment_ref = checkpoint.assignment_ref
   and link.session_id = checkpoint.session_id
  where link.household_id = actor.actor_household_id
    and link.student_id = p_student_id
    and link.assignment_ref = p_assignment_ref
    and link.session_id = p_session_id
  for update of checkpoint;
  if held.session_id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  candidate := p_payload -> 'learnerResponseCheckpoint';
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
  select * into prior
  from academy_private.study_mutation_receipts
  where actor_scope =
      'family-response-checkpoint-r1:' || p_student_id::text || ':' || p_session_id
    and operation_kind = 'family_response_checkpoint_r1'
    and idempotency_key = p_client_operation_id::text;

  if prior.idempotency_key is not null then
    if prior.request_digest = request_digest
       and prior.request_fingerprint = fingerprint then
      return prior.result;
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'idempotency-collision',
      'operation', p_operation
    );
  end if;

  if held.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'revision-conflict',
      'operation', p_operation,
      'revisionDomain', 'learner-response-checkpoint',
      'serverRevision', held.revision
    );
  else
    old_document :=
      academy_private.study_family_response_checkpoint_document_r1(
        held.household_id, held.student_id, held.session_id
      );
    if not academy_private.study_family_response_checkpoint_valid_r1(candidate)
       or candidate #>> '{identity,householdRef}' <> held.local_household_ref
       or candidate #>> '{identity,studentRef}' <> held.local_student_ref
       or candidate #>> '{identity,learnerRef}' <> held.local_learner_ref
       or candidate #>> '{identity,assignmentRef}' <> held.local_assignment_ref
       or candidate #>> '{identity,sessionRef}' <> held.local_session_ref
       or candidate #>> '{attempt,attemptRef}' <> held.attempt_ref
       or candidate #>> '{attempt,lessonRef}' <> held.lesson_ref
       or (candidate #>> '{sync,baseRevision}')::bigint <>
         p_expected_revision
       or (candidate #>> '{sync,revision}')::bigint <>
         p_expected_revision + 1
       or candidate #>> '{sync,operationId}' <>
         p_client_operation_id::text
       or not academy_private.study_family_response_transition_valid_r1(
         old_document, candidate
       ) then
      result_value := jsonb_build_object(
        'schemaVersion', 2,
        'status', 'invalid-write',
        'operation', p_operation,
        'reasonCode', 'invalid-learner-response-checkpoint'
      );
    else
      update public.academy_family_response_checkpoints
      set base_revision = p_expected_revision,
          revision = p_expected_revision + 1,
          last_client_operation_id = p_client_operation_id,
          saved_at = (candidate #>> '{sync,savedAt}')::timestamptz,
          document_digest = academy_private.study_sha256_json(candidate),
          updated_at = statement_timestamp()
      where session_id = held.session_id;

      perform academy_private.study_family_response_insert_items_r1(
        held.household_id,
        held.student_id,
        held.session_id,
        p_expected_revision + 1,
        candidate -> 'responses'
      );
      result_value := jsonb_build_object(
        'schemaVersion', 2,
        'status', 'stored',
        'operation', p_operation,
        'revisionDomain', 'learner-response-checkpoint',
        'serverRevision', p_expected_revision + 1
      );
    end if;
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'family-response-checkpoint-r1:' || p_student_id::text || ':' || p_session_id,
    'family_response_checkpoint_r1',
    p_client_operation_id::text,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '180 days'
  );
  return result_value;
end;
$$;

alter function academy_private.study_family_response_item_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_response_checkpoint_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_response_checkpoint_document_r1(
  uuid, uuid, text
) owner to postgres;
alter function academy_private.study_family_response_transition_valid_r1(
  jsonb, jsonb
) owner to postgres;
alter function academy_private.study_family_response_insert_items_r1(
  uuid, uuid, text, bigint, jsonb
) owner to postgres;

revoke all on function academy_private.study_family_response_item_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_response_checkpoint_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_response_checkpoint_document_r1(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_response_transition_valid_r1(
  jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_response_insert_items_r1(
  uuid, uuid, text, bigint, jsonb
) from public, anon, authenticated, service_role;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
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
revoke all on function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) to authenticated;
grant execute on function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) to authenticated;
grant execute on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) to authenticated;

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260814120000_academy_family_response_checkpoint_r1'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'family_response_checkpoint_contract',
        'family-pilot.learner-response-checkpoint.r1',
      'family_response_checkpoint_max_bytes', 1048576,
      'family_response_checkpoint_max_items', 256,
      'family_response_checkpoint_item_text_max_bytes', 16384,
      'family_response_checkpoint_storage', 'typed-append-only-snapshots',
      'family_response_checkpoint_cas', true,
      'family_response_checkpoint_rls', 'forced-household-and-student',
      'family_response_checkpoint_answer_authority', false,
      'family_response_checkpoint_tutor_conversation', false,
      'family_response_checkpoint_unknown_keys', 'deny'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table public.academy_family_response_checkpoints is
  'Current narrow learner-response checkpoint headers. Authenticated reads are household/student RLS-bound; browser writes are RPC-only.';
comment on table public.academy_family_response_checkpoint_items is
  'Typed append-only learner-response item snapshots. No prompts, answer authority, scoring guides, or Tutor conversations.';
comment on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) is
  'Lossless parent first-link. A learnerResponseCheckpoint is committed atomically with the existing explicit link and must be verified by hydrate before device completion.';

commit;
