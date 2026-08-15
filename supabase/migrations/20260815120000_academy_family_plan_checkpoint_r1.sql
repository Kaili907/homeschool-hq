-- Narrow Family Pilot School Plan and Auto Planner checkpoint authority.
--
-- The document accepted here is the exact FamilyAutoPlannerDocumentV1 shape
-- plus cloud CAS metadata. It is not a generic state bucket. Manual assignment,
-- Study, assessment, completion and Safety authority remain in Hosted Sync R2;
-- this checkpoint stores only the School Plan and deterministic automatic
-- materialization provenance that cannot be safely reconstructed on a new
-- device.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Family plan checkpoint migration must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.lossless_sync_version is distinct from 2
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260813173000_academy_study_sync_lossless_checkpoint_r1',
       '20260814120000_academy_family_response_checkpoint_r1'
     ]::text[]) then
    raise exception 'FAMILY_PLAN_CHECKPOINT predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260815120000_academy_family_plan_checkpoint_r1'
     ]::text[] then
    raise exception 'FAMILY_PLAN_CHECKPOINT already applied';
  end if;

  if to_regclass('public.academy_family_plan_checkpoints') is not null
     or to_regprocedure(
       'academy_private.study_family_plan_date_valid_r1(text)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_plan_subject_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_plan_school_plan_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_plan_materialization_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_plan_checkpoint_valid_r1(jsonb)'
     ) is not null
     or to_regprocedure(
       'academy_private.study_family_plan_transition_valid_r1(jsonb,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2_family_plan_r1(text,uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_hydrate_v2_family_plan_r1(text,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_sync_write_v2_family_plan_r1(text,uuid,text,text,bigint,uuid,text,jsonb)'
     ) is not null then
    raise exception 'FAMILY_PLAN_CHECKPOINT object collision';
  end if;
end;
$$;

create function academy_private.study_family_plan_date_valid_r1(candidate text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed date;
begin
  if candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  parsed := candidate::date;
  return to_char(parsed, 'YYYY-MM-DD') = candidate;
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_plan_subject_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return academy_private.study_sync_keys_allowed_r1(
      candidate,
      array[
        'subject', 'order', 'paused', 'lessonsPerDay', 'startLocalTime'
      ]::text[],
      array[
        'subject', 'order', 'paused', 'courseRef', 'lessonsPerDay',
        'startLocalTime'
      ]::text[]
    )
    and candidate ->> 'subject' in (
      'mathematics', 'english-language-arts', 'science', 'social-studies',
      'health', 'physical-education', 'ready-for-life', 'technology',
      'arts-and-music', 'financial-literacy'
    )
    and jsonb_typeof(candidate -> 'order') = 'number'
    and (candidate ->> 'order')::numeric >= 0
    and (candidate ->> 'order')::numeric =
      trunc((candidate ->> 'order')::numeric)
    and jsonb_typeof(candidate -> 'paused') = 'boolean'
    and (
      not (candidate ? 'courseRef')
      or academy_private.study_sync_local_ref_valid_v2(
        candidate ->> 'courseRef'
      )
    )
    and jsonb_typeof(candidate -> 'lessonsPerDay') = 'number'
    and (candidate ->> 'lessonsPerDay')::numeric between 1 and 5
    and (candidate ->> 'lessonsPerDay')::numeric =
      trunc((candidate ->> 'lessonsPerDay')::numeric)
    and candidate ->> 'startLocalTime' ~
      '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$';
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_plan_school_plan_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  weekdays jsonb;
  non_school_dates jsonb;
  added_school_dates jsonb;
  subjects jsonb;
begin
  if not academy_private.study_sync_keys_allowed_r1(
       candidate,
       array[
         'schemaVersion', 'householdTimeZone', 'schoolYearStart',
         'schoolYearEnd', 'schoolWeekdays', 'nonSchoolDates',
         'addedSchoolDates', 'subjects', 'configuredAt', 'updatedAt'
       ]::text[],
       array[
         'schemaVersion', 'householdTimeZone', 'schoolYearStart',
         'schoolYearEnd', 'schoolWeekdays', 'nonSchoolDates',
         'addedSchoolDates', 'subjects', 'configuredAt', 'updatedAt'
       ]::text[]
     )
     or candidate ->> 'schemaVersion' <> '1'
     or candidate ->> 'householdTimeZone' !~
       '^(UTC|[A-Za-z_]+/[A-Za-z0-9_+.-]+)$'
     or not academy_private.study_family_plan_date_valid_r1(
       candidate ->> 'schoolYearStart'
     )
     or not academy_private.study_family_plan_date_valid_r1(
       candidate ->> 'schoolYearEnd'
     )
     or (candidate ->> 'schoolYearEnd') <
       (candidate ->> 'schoolYearStart')
     or not academy_private.study_sync_instant_valid_v2(
       candidate ->> 'configuredAt'
     )
     or not academy_private.study_sync_instant_valid_v2(
       candidate ->> 'updatedAt'
     ) then
    return false;
  end if;

  weekdays := candidate -> 'schoolWeekdays';
  non_school_dates := candidate -> 'nonSchoolDates';
  added_school_dates := candidate -> 'addedSchoolDates';
  subjects := candidate -> 'subjects';

  if jsonb_typeof(weekdays) <> 'array'
     or jsonb_array_length(weekdays) not between 1 and 7
     or exists (
       select 1
       from jsonb_array_elements(weekdays) as weekday(value)
       where jsonb_typeof(weekday.value) <> 'number'
          or (weekday.value #>> '{}')::numeric not between 1 and 7
          or (weekday.value #>> '{}')::numeric <>
            trunc((weekday.value #>> '{}')::numeric)
     )
     or (
       select count(*) <> count(distinct weekday.value #>> '{}')
       from jsonb_array_elements(weekdays) as weekday(value)
     )
     or jsonb_typeof(non_school_dates) <> 'array'
     or jsonb_array_length(non_school_dates) > 732
     or exists (
       select 1
       from jsonb_array_elements_text(non_school_dates) as held(value)
       where not academy_private.study_family_plan_date_valid_r1(held.value)
     )
     or (
       select count(*) <> count(distinct held.value)
       from jsonb_array_elements_text(non_school_dates) as held(value)
     )
     or jsonb_typeof(added_school_dates) <> 'array'
     or jsonb_array_length(added_school_dates) > 732
     or exists (
       select 1
       from jsonb_array_elements_text(added_school_dates) as held(value)
       where not academy_private.study_family_plan_date_valid_r1(held.value)
     )
     or (
       select count(*) <> count(distinct held.value)
       from jsonb_array_elements_text(added_school_dates) as held(value)
     )
     or exists (
       select 1
       from jsonb_array_elements_text(non_school_dates) as closed(value)
       join jsonb_array_elements_text(added_school_dates) as added(value)
         on added.value = closed.value
     )
     or jsonb_typeof(subjects) <> 'array'
     or jsonb_array_length(subjects) not between 1 and 10
     or exists (
       select 1
       from jsonb_array_elements(subjects) as subject(value)
       where not academy_private.study_family_plan_subject_valid_r1(
         subject.value
       )
     )
     or (
       select count(*) <> count(distinct subject.value ->> 'subject')
       from jsonb_array_elements(subjects) as subject(value)
     )
     or (
       select count(*) <> count(distinct subject.value ->> 'order')
       from jsonb_array_elements(subjects) as subject(value)
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_plan_materialization_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return academy_private.study_sync_keys_allowed_r1(
      candidate,
      array[
        'materializationRef', 'kind', 'localDate', 'subject',
        'workingGrade', 'courseRef', 'unitRef', 'itemRef', 'assignmentRef',
        'title', 'createdAt'
      ]::text[],
      array[
        'materializationRef', 'kind', 'localDate', 'subject',
        'workingGrade', 'courseRef', 'unitRef', 'itemRef', 'assignmentRef',
        'title', 'createdAt'
      ]::text[]
    )
    and academy_private.study_sync_local_ref_valid_v2(
      candidate ->> 'materializationRef'
    )
    and candidate ->> 'materializationRef' like 'auto:%'
    and candidate ->> 'kind' in ('LESSON', 'ASSESSMENT')
    and academy_private.study_family_plan_date_valid_r1(
      candidate ->> 'localDate'
    )
    and candidate ->> 'subject' in (
      'mathematics', 'english-language-arts', 'science', 'social-studies',
      'health', 'physical-education', 'ready-for-life', 'technology',
      'arts-and-music', 'financial-literacy'
    )
    and candidate ->> 'workingGrade' in (
      '3', '4', '5', '7', '8', '9', '10', '11', '12'
    )
    and academy_private.study_sync_local_ref_valid_v2(
      candidate ->> 'courseRef'
    )
    and academy_private.study_sync_local_ref_valid_v2(
      candidate ->> 'unitRef'
    )
    and academy_private.study_sync_local_ref_valid_v2(
      candidate ->> 'itemRef'
    )
    and academy_private.study_sync_local_ref_valid_v2(
      candidate ->> 'assignmentRef'
    )
    and academy_private.study_sync_text_valid_v2(
      candidate ->> 'title', 200
    )
    and academy_private.study_sync_instant_valid_v2(
      candidate ->> 'createdAt'
    );
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_plan_checkpoint_valid_r1(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  identity_value jsonb;
  sync_value jsonb;
  planner_value jsonb;
  materializations jsonb;
begin
  if not academy_private.study_sync_keys_allowed_r1(
       candidate,
       array[
         'contract', 'contractVersion', 'identity', 'sync', 'planner'
       ]::text[],
       array[
         'contract', 'contractVersion', 'identity', 'sync', 'planner'
       ]::text[]
     )
     or candidate ->> 'contract' <>
       'family-pilot.family-plan-checkpoint.r1'
     or candidate ->> 'contractVersion' <> '1'
     or octet_length(candidate::text) > 8388608 then
    return false;
  end if;

  identity_value := candidate -> 'identity';
  sync_value := candidate -> 'sync';
  planner_value := candidate -> 'planner';

  if not academy_private.study_sync_keys_allowed_r1(
       identity_value,
       array['householdRef', 'studentRef', 'learnerRef']::text[],
       array['householdRef', 'studentRef', 'learnerRef']::text[]
     )
     or exists (
       select 1
       from jsonb_each_text(identity_value) as item
       where not academy_private.study_sync_local_ref_valid_v2(item.value)
     )
     or not academy_private.study_sync_keys_allowed_r1(
       sync_value,
       array['baseRevision', 'revision', 'operationId', 'savedAt']::text[],
       array['baseRevision', 'revision', 'operationId', 'savedAt']::text[]
     )
     or jsonb_typeof(sync_value -> 'baseRevision') <> 'number'
     or jsonb_typeof(sync_value -> 'revision') <> 'number'
     or (sync_value ->> 'baseRevision')::numeric < 0
     or (sync_value ->> 'baseRevision')::numeric <>
       trunc((sync_value ->> 'baseRevision')::numeric)
     or (sync_value ->> 'revision')::numeric < 0
     or (sync_value ->> 'revision')::numeric <>
       trunc((sync_value ->> 'revision')::numeric)
     or (sync_value ->> 'operationId') !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or not academy_private.study_sync_instant_valid_v2(
       sync_value ->> 'savedAt'
     )
     or not academy_private.study_sync_keys_allowed_r1(
       planner_value,
       array[
         'schemaVersion', 'scope', 'revision', 'updatedAt', 'schoolPlan',
         'materializations'
       ]::text[],
       array[
         'schemaVersion', 'scope', 'revision', 'updatedAt', 'schoolPlan',
         'materializations'
       ]::text[]
     )
     or planner_value ->> 'schemaVersion' <> '1'
     or not academy_private.study_sync_keys_allowed_r1(
       planner_value -> 'scope',
       array['householdRef', 'learnerRef']::text[],
       array['householdRef', 'learnerRef']::text[]
     )
     or planner_value #>> '{scope,householdRef}' <>
       identity_value ->> 'householdRef'
     or planner_value #>> '{scope,learnerRef}' <>
       identity_value ->> 'learnerRef'
     or jsonb_typeof(planner_value -> 'revision') <> 'number'
     or (planner_value ->> 'revision')::numeric < 0
     or (planner_value ->> 'revision')::numeric <>
       trunc((planner_value ->> 'revision')::numeric)
     or not academy_private.study_sync_instant_valid_v2(
       planner_value ->> 'updatedAt'
     )
     or not (
       jsonb_typeof(planner_value -> 'schoolPlan') = 'null'
       or academy_private.study_family_plan_school_plan_valid_r1(
         planner_value -> 'schoolPlan'
       )
     ) then
    return false;
  end if;

  materializations := planner_value -> 'materializations';
  if jsonb_typeof(materializations) <> 'array'
     or jsonb_array_length(materializations) > 10000
     or exists (
       select 1
       from jsonb_array_elements(materializations) as item(value)
       where not academy_private.study_family_plan_materialization_valid_r1(
         item.value
       )
     )
     or (
       select count(*) <> count(distinct item.value ->> 'materializationRef')
       from jsonb_array_elements(materializations) as item(value)
     )
     or (
       select count(*) <> count(distinct item.value ->> 'assignmentRef')
       from jsonb_array_elements(materializations) as item(value)
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create function academy_private.study_family_plan_transition_valid_r1(
  old_document jsonb,
  new_document jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return academy_private.study_family_plan_checkpoint_valid_r1(old_document)
    and academy_private.study_family_plan_checkpoint_valid_r1(new_document)
    and old_document -> 'identity' = new_document -> 'identity'
    and (new_document #>> '{planner,revision}')::bigint =
      (old_document #>> '{planner,revision}')::bigint + 1
    and (new_document #>> '{planner,updatedAt}')::timestamptz >=
      (old_document #>> '{planner,updatedAt}')::timestamptz
    and not exists (
      select 1
      from jsonb_array_elements(
        old_document #> '{planner,materializations}'
      ) as old_item(value)
      where not new_document #> '{planner,materializations}' @>
        jsonb_build_array(old_item.value)
    );
exception when others then
  return false;
end;
$$;

create table public.academy_family_plan_checkpoints (
  household_id uuid not null,
  student_id uuid not null,
  local_household_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_household_ref)),
  local_student_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_student_ref)),
  local_learner_ref text not null
    check (academy_private.study_sync_local_ref_valid_v2(local_learner_ref)),
  contract_version smallint not null default 1 check (contract_version = 1),
  base_revision bigint not null check (base_revision >= 0),
  revision bigint not null check (revision >= 0),
  local_planner_revision bigint not null check (local_planner_revision >= 0),
  last_client_operation_id uuid not null,
  saved_at timestamptz not null,
  document_digest text not null check (document_digest ~ '^[0-9a-f]{64}$'),
  plan_checkpoint jsonb not null check (
    academy_private.study_family_plan_checkpoint_valid_r1(plan_checkpoint)
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (household_id, student_id),
  constraint academy_family_plan_checkpoint_student_fk
    foreign key (student_id, household_id)
    references public.academy_students (id, household_id)
    on update restrict on delete restrict,
  constraint academy_family_plan_checkpoint_revision_pair check (
    (revision = 0 and base_revision = 0)
    or (revision > 0 and base_revision = revision - 1)
  )
);

alter table public.academy_family_plan_checkpoints owner to postgres;
alter table public.academy_family_plan_checkpoints enable row level security;
alter table public.academy_family_plan_checkpoints force row level security;

create policy academy_family_plan_checkpoints_select
  on public.academy_family_plan_checkpoints
  for select to authenticated
  using (public.academy_study_can_view(household_id, student_id));
create policy academy_family_plan_checkpoints_deny_insert
  on public.academy_family_plan_checkpoints
  for insert to authenticated with check (false);
create policy academy_family_plan_checkpoints_deny_update
  on public.academy_family_plan_checkpoints
  for update to authenticated using (false) with check (false);
create policy academy_family_plan_checkpoints_deny_delete
  on public.academy_family_plan_checkpoints
  for delete to authenticated using (false);

revoke all on table public.academy_family_plan_checkpoints
  from public, anon, authenticated, service_role;
grant select (
  household_id, student_id, local_household_ref, local_student_ref,
  local_learner_ref, contract_version, base_revision, revision,
  local_planner_revision, last_client_operation_id, saved_at,
  plan_checkpoint, created_at, updated_at
) on table public.academy_family_plan_checkpoints to authenticated;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) rename to academy_study_sync_first_link_v2_family_plan_r1;
alter function public.academy_study_sync_hydrate_v2(
  text, uuid, text, text
) rename to academy_study_sync_hydrate_v2_family_plan_r1;
alter function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) rename to academy_study_sync_write_v2_family_plan_r1;

revoke all on function public.academy_study_sync_first_link_v2_family_plan_r1(
  text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_hydrate_v2_family_plan_r1(
  text, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_sync_write_v2_family_plan_r1(
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
  held public.academy_family_plan_checkpoints%rowtype;
  result_value jsonb;
  candidate_digest text;
begin
  if not (p_import ? 'familyPlanCheckpoint') then
    return public.academy_study_sync_first_link_v2_family_plan_r1(
      p_token_digest, p_student_id, p_client_operation_id, p_import
    );
  end if;

  if not academy_private.study_sync_keys_allowed_r1(
       p_import,
       array[
         'localScope', 'hostedScope', 'session', 'checkpoint',
         'socialSource', 'guardianAttestation', 'safetyState', 'assessment',
         'authorityCheckpoint', 'familyPlanCheckpoint'
       ]::text[],
       array[
         'localScope', 'hostedScope', 'session', 'checkpoint',
         'socialSource', 'guardianAttestation', 'safetyState', 'assessment',
         'authorityCheckpoint', 'learnerResponseCheckpoint',
         'familyPlanCheckpoint'
       ]::text[]
     ) then
    raise exception 'STUDY_SYNC_IMPORT_INVALID' using errcode = '22023';
  end if;

  candidate := p_import -> 'familyPlanCheckpoint';
  if not academy_private.study_family_plan_checkpoint_valid_r1(candidate)
     or candidate #>> '{identity,householdRef}' <>
       p_import #>> '{localScope,householdRef}'
     or candidate #>> '{identity,studentRef}' <>
       p_import #>> '{localScope,studentRef}'
     or candidate #>> '{identity,learnerRef}' <>
       p_import #>> '{authorityCheckpoint,identity,learnerRef}'
     or (candidate #>> '{sync,baseRevision}')::bigint <> 0
     or (candidate #>> '{sync,revision}')::bigint <> 0
     or candidate #>> '{sync,operationId}' <> p_client_operation_id::text then
    raise exception 'FAMILY_PLAN_CHECKPOINT_INVALID' using errcode = '22023';
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
      'family-plan-first-link:' || actor.actor_household_id::text || ':' ||
      p_student_id::text,
      0
    )
  );
  candidate_digest := academy_private.study_sha256_json(candidate);
  select * into held
  from public.academy_family_plan_checkpoints as checkpoint
  where checkpoint.household_id = actor.actor_household_id
    and checkpoint.student_id = p_student_id
  for update;

  if held.student_id is not null
     and (
       held.last_client_operation_id <> p_client_operation_id
       or held.document_digest <> candidate_digest
     ) then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'mapping-conflict'
    );
  end if;

  result_value := public.academy_study_sync_first_link_v2_family_plan_r1(
    p_token_digest,
    p_student_id,
    p_client_operation_id,
    p_import - 'familyPlanCheckpoint'
  );
  if result_value ->> 'status' not in ('imported', 'linked-existing') then
    return result_value;
  end if;

  if held.student_id is null then
    insert into public.academy_family_plan_checkpoints (
      household_id, student_id, local_household_ref, local_student_ref,
      local_learner_ref, base_revision, revision, local_planner_revision,
      last_client_operation_id, saved_at, document_digest, plan_checkpoint
    ) values (
      actor.actor_household_id,
      p_student_id,
      candidate #>> '{identity,householdRef}',
      candidate #>> '{identity,studentRef}',
      candidate #>> '{identity,learnerRef}',
      0,
      0,
      (candidate #>> '{planner,revision}')::bigint,
      p_client_operation_id,
      (candidate #>> '{sync,savedAt}')::timestamptz,
      candidate_digest,
      candidate
    );
  end if;

  return jsonb_set(
    result_value,
    '{revisions,familyPlanCheckpoint}',
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
  plan_document jsonb;
  enrollment_documents jsonb;
begin
  result_value := public.academy_study_sync_hydrate_v2_family_plan_r1(
    p_token_digest, p_student_id, p_assignment_ref, p_session_id
  );
  if result_value ->> 'status' <> 'ready' then
    return result_value;
  end if;

  select checkpoint.plan_checkpoint into plan_document
  from public.academy_family_plan_checkpoints as checkpoint
  join academy_private.study_sync_explicit_links_v2 as link
    on link.household_id = checkpoint.household_id
   and link.student_id = checkpoint.student_id
  where link.student_id = p_student_id
    and link.assignment_ref = p_assignment_ref
    and link.session_id = p_session_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'enrollmentRef', enrollment.id,
    'schoolYearKey', enrollment.school_year_key,
    'subject', enrollment.subject_key,
    'instructionalLevel', enrollment.instructional_level,
    'courseRef', enrollment.course_id,
    'curriculumVersion', enrollment.curriculum_version,
    'status', enrollment.enrollment_status,
    'startsOn', enrollment.starts_on,
    'endsOn', enrollment.ends_on,
    'placementSource', enrollment.placement_source,
    'updatedAt', to_char(
      enrollment.updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  ) order by enrollment.school_year_key, enrollment.subject_key), '[]'::jsonb)
  into enrollment_documents
  from public.academy_subject_enrollments as enrollment
  join academy_private.study_sync_explicit_links_v2 as link
    on link.household_id = enrollment.household_id
   and link.student_id = enrollment.student_id
  where link.student_id = p_student_id
    and link.assignment_ref = p_assignment_ref
    and link.session_id = p_session_id;

  result_value := result_value || jsonb_build_object(
    'courseEnrollments', enrollment_documents
  );
  if plan_document is not null then
    result_value := result_value || jsonb_build_object(
      'familyPlanCheckpoint', plan_document,
      'familyPlanCheckpointRevision',
        (plan_document #>> '{sync,revision}')::bigint
    );
  end if;
  return result_value;
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
  link academy_private.study_sync_explicit_links_v2%rowtype;
  authority academy_private.study_sync_authority_checkpoints_r1%rowtype;
  held public.academy_family_plan_checkpoints%rowtype;
  candidate jsonb;
  fingerprint jsonb;
  request_digest text;
  prior academy_private.study_mutation_receipts%rowtype;
  result_value jsonb;
begin
  if p_operation <> 'family-plan-checkpoint:compare-and-swap' then
    return public.academy_study_sync_write_v2_family_plan_r1(
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
       p_payload, array['familyPlanCheckpoint']::text[]
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
  if actor.actor_kind <> 'guardian' then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'actor-not-authorized'
    );
  end if;

  select candidate_link.* into link
  from academy_private.study_sync_explicit_links_v2 as candidate_link
  where candidate_link.household_id = actor.actor_household_id
    and candidate_link.student_id = p_student_id
    and candidate_link.assignment_ref = p_assignment_ref
    and candidate_link.session_id = p_session_id;
  if link.id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  select * into authority
  from academy_private.study_sync_authority_checkpoints_r1 as checkpoint
  where checkpoint.household_id = link.household_id
    and checkpoint.student_id = link.student_id;
  if authority.student_id is null then
    return jsonb_build_object(
      'schemaVersion', 2, 'status', 'denied',
      'code', 'study-session-invalid'
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'family-plan-write:' || actor.actor_household_id::text || ':' ||
      p_student_id::text,
      0
    )
  );
  select * into held
  from public.academy_family_plan_checkpoints as checkpoint
  where checkpoint.household_id = actor.actor_household_id
    and checkpoint.student_id = p_student_id
  for update;

  candidate := p_payload -> 'familyPlanCheckpoint';
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
  where actor_scope = 'family-plan-checkpoint-r1:' || p_student_id::text
    and operation_kind = 'family_plan_checkpoint_r1'
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

  if held.student_id is null and p_expected_revision <> 0 then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'revision-conflict',
      'operation', p_operation,
      'revisionDomain', 'family-plan-checkpoint',
      'serverRevision', 0
    );
  elsif held.student_id is not null and held.revision <> p_expected_revision then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'revision-conflict',
      'operation', p_operation,
      'revisionDomain', 'family-plan-checkpoint',
      'serverRevision', held.revision
    );
  elsif not academy_private.study_family_plan_checkpoint_valid_r1(candidate)
     or candidate #>> '{identity,householdRef}' <> link.local_household_ref
     or candidate #>> '{identity,studentRef}' <> link.local_student_ref
     or candidate #>> '{identity,learnerRef}' <>
       authority.local_learner_ref
     or (candidate #>> '{sync,baseRevision}')::bigint <>
       p_expected_revision
     or (candidate #>> '{sync,revision}')::bigint <>
       p_expected_revision + 1
     or candidate #>> '{sync,operationId}' <>
       p_client_operation_id::text
     or (
       held.student_id is not null
       and not academy_private.study_family_plan_transition_valid_r1(
         held.plan_checkpoint, candidate
       )
     ) then
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'invalid-write',
      'operation', p_operation,
      'reasonCode', 'invalid-family-plan-checkpoint'
    );
  else
    if held.student_id is null then
      insert into public.academy_family_plan_checkpoints (
        household_id, student_id, local_household_ref, local_student_ref,
        local_learner_ref, base_revision, revision, local_planner_revision,
        last_client_operation_id, saved_at, document_digest, plan_checkpoint
      ) values (
        link.household_id,
        link.student_id,
        link.local_household_ref,
        link.local_student_ref,
        candidate #>> '{identity,learnerRef}',
        p_expected_revision,
        p_expected_revision + 1,
        (candidate #>> '{planner,revision}')::bigint,
        p_client_operation_id,
        (candidate #>> '{sync,savedAt}')::timestamptz,
        academy_private.study_sha256_json(candidate),
        candidate
      );
    else
      update public.academy_family_plan_checkpoints
      set base_revision = p_expected_revision,
          revision = p_expected_revision + 1,
          local_planner_revision =
            (candidate #>> '{planner,revision}')::bigint,
          last_client_operation_id = p_client_operation_id,
          saved_at = (candidate #>> '{sync,savedAt}')::timestamptz,
          document_digest = academy_private.study_sha256_json(candidate),
          plan_checkpoint = candidate,
          updated_at = statement_timestamp()
      where household_id = held.household_id
        and student_id = held.student_id;
    end if;
    result_value := jsonb_build_object(
      'schemaVersion', 2,
      'status', 'stored',
      'operation', p_operation,
      'revisionDomain', 'family-plan-checkpoint',
      'serverRevision', p_expected_revision + 1
    );
  end if;

  insert into academy_private.study_mutation_receipts (
    actor_scope, operation_kind, idempotency_key, request_digest,
    request_fingerprint, result, expires_at
  ) values (
    'family-plan-checkpoint-r1:' || p_student_id::text,
    'family_plan_checkpoint_r1',
    p_client_operation_id::text,
    request_digest,
    fingerprint,
    result_value,
    now() + interval '180 days'
  );
  return result_value;
end;
$$;

alter function academy_private.study_family_plan_date_valid_r1(text)
  owner to postgres;
alter function academy_private.study_family_plan_subject_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_plan_school_plan_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_plan_materialization_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_plan_checkpoint_valid_r1(jsonb)
  owner to postgres;
alter function academy_private.study_family_plan_transition_valid_r1(jsonb,jsonb)
  owner to postgres;

revoke all on function academy_private.study_family_plan_date_valid_r1(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_subject_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_school_plan_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_materialization_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_checkpoint_valid_r1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_transition_valid_r1(jsonb,jsonb)
  from public, anon, authenticated, service_role;

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
      '20260815120000_academy_family_plan_checkpoint_r1'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'family_plan_checkpoint_contract',
        'family-pilot.family-plan-checkpoint.r1',
      'family_plan_checkpoint_max_bytes', 8388608,
      'family_plan_checkpoint_max_materializations', 10000,
      'family_plan_checkpoint_cas', true,
      'family_plan_checkpoint_rls', 'forced-household-and-student',
      'family_plan_checkpoint_materializations', 'append-only',
      'family_plan_checkpoint_unknown_keys', 'deny'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table public.academy_family_plan_checkpoints is
  'Strict FamilyAutoPlannerDocumentV1 School Plan and deterministic materialization checkpoint. Authenticated reads are household/student RLS-bound; Parent writes are RPC-only CAS.';
comment on function public.academy_study_sync_write_v2(
  text, uuid, text, text, bigint, uuid, text, jsonb
) is
  'Current-grant-bound Hosted Sync V2 write surface, including Parent-only Family Plan CAS and learner-response CAS.';

commit;
