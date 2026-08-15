-- Family cross-device data completeness R1.
--
-- Extends the canonical authority checkpoint with School Plan/Auto Planner
-- provenance and the minimum learner-authored instructional input required for
-- exact continuation. No hosted project is contacted by this migration file.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Family cross-device data R1 must run as postgres';
  end if;
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found or not marker.migration_names @> array[
    '20260813173000_academy_study_sync_lossless_checkpoint_r1'
  ]::text[] then
    raise exception 'FAMILY_CROSS_DEVICE_DATA_R1 predecessor marker mismatch';
  end if;
  if marker.migration_names @> array['20260814120000_academy_family_cross_device_data_r1']::text[]
     or to_regprocedure('academy_private.study_sync_authority_checkpoint_shape_valid_legacy_r1(jsonb)') is not null then
    raise exception 'FAMILY_CROSS_DEVICE_DATA_R1 object collision';
  end if;
end;
$$;

alter function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb)
  rename to study_sync_authority_checkpoint_shape_valid_legacy_r1;
alter function academy_private.study_sync_authority_transition_valid_r1(jsonb,jsonb)
  rename to study_sync_authority_transition_valid_legacy_r1;

create function academy_private.study_sync_authority_checkpoint_shape_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare legacy jsonb; planner jsonb; plan jsonb; item jsonb; held jsonb;
begin
  if not public.academy_study_payload_is_minimized(candidate, 2097152)
     or jsonb_typeof(candidate -> 'instructionalInputs') <> 'array'
     or jsonb_array_length(candidate -> 'instructionalInputs') > 10000
     or jsonb_typeof(candidate -> 'plannerDocument') <> 'object'
     or jsonb_typeof(candidate -> 'privacy' -> 'instructionalInputIncluded') <> 'boolean'
     or (candidate -> 'privacy' -> 'instructionalInputIncluded') <>
       to_jsonb(jsonb_array_length(candidate -> 'instructionalInputs') > 0) then
    return false;
  end if;

  legacy := (candidate - 'plannerDocument' - 'instructionalInputs') || jsonb_build_object(
    'privacy', (candidate -> 'privacy') - 'instructionalInputIncluded'
  );
  if not academy_private.study_sync_authority_checkpoint_shape_valid_legacy_r1(legacy) then
    return false;
  end if;

  planner := candidate -> 'plannerDocument';
  if not public.academy_study_json_has_exact_keys(planner, array[
       'schemaVersion','scope','revision','updatedAt','schoolPlan','materializations']::text[])
     or planner ->> 'schemaVersion' <> '1'
     or not public.academy_study_json_has_exact_keys(planner -> 'scope', array['householdRef','learnerRef']::text[])
     or planner #>> '{scope,householdRef}' <> candidate #>> '{identity,householdRef}'
     or planner #>> '{scope,learnerRef}' <> candidate #>> '{identity,learnerRef}'
     or (planner ->> 'revision')::bigint < 0
     or not academy_private.study_sync_instant_valid_v2(planner ->> 'updatedAt')
     or jsonb_typeof(planner -> 'materializations') <> 'array'
     or jsonb_array_length(planner -> 'materializations') > 10000 then
    return false;
  end if;

  plan := planner -> 'schoolPlan';
  if jsonb_typeof(plan) <> 'null' then
    if not public.academy_study_json_has_exact_keys(plan, array[
         'schemaVersion','householdTimeZone','schoolYearStart','schoolYearEnd','schoolWeekdays',
         'nonSchoolDates','addedSchoolDates','subjects','configuredAt','updatedAt']::text[])
       or plan ->> 'schemaVersion' <> '1'
       or jsonb_typeof(plan -> 'schoolWeekdays') <> 'array'
       or jsonb_typeof(plan -> 'nonSchoolDates') <> 'array'
       or jsonb_typeof(plan -> 'addedSchoolDates') <> 'array'
       or jsonb_typeof(plan -> 'subjects') <> 'array'
       or jsonb_array_length(plan -> 'subjects') = 0
       or not academy_private.study_sync_instant_valid_v2(plan ->> 'configuredAt')
       or not academy_private.study_sync_instant_valid_v2(plan ->> 'updatedAt') then
      return false;
    end if;
    for item in select value from jsonb_array_elements(plan -> 'subjects') loop
      if not academy_private.study_sync_keys_allowed_r1(item,
        array['subject','order','paused','lessonsPerDay','startLocalTime']::text[],
        array['subject','order','paused','courseRef','lessonsPerDay','startLocalTime']::text[])
         or (item ->> 'order')::integer < 0
         or (item ->> 'lessonsPerDay')::integer not between 1 and 5
         or jsonb_typeof(item -> 'paused') <> 'boolean' then return false; end if;
    end loop;
  end if;

  for item in select value from jsonb_array_elements(planner -> 'materializations') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'materializationRef','kind','localDate','subject','workingGrade','courseRef','unitRef',
      'itemRef','assignmentRef','title','createdAt']::text[])
       or item ->> 'kind' not in ('LESSON','ASSESSMENT')
       or not academy_private.study_sync_instant_valid_v2(item ->> 'createdAt')
       or not exists (
         select 1 from jsonb_array_elements(candidate -> 'assignments') assignment
          where assignment.value #>> '{record,assignmentRef}' = item ->> 'assignmentRef'
         union all
         select 1 from jsonb_array_elements(candidate -> 'assessmentStates') assessment
          where assessment.value ->> 'assignmentRef' = item ->> 'assignmentRef'
       ) then return false; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(planner -> 'materializations') item
    group by item.value ->> 'materializationRef' having count(*) > 1
  ) then return false; end if;

  for item in select value from jsonb_array_elements(candidate -> 'instructionalInputs') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'schemaVersion','studentRef','assignmentRef','lessonRef','attemptRef','sectionRef','itemRef',
      'segmentRef','input','evidenceMode','assessmentState','savedAt','trustedReceipt']::text[])
       or item ->> 'schemaVersion' <> '1'
       or item ->> 'studentRef' <> candidate #>> '{identity,studentRef}'
       or not public.academy_study_json_has_exact_keys(item -> 'input', array['kind','choiceRef','text']::text[])
       or item #>> '{input,kind}' not in ('CHOICE','TEXT','NUMERIC','CONSTRUCTED_RESPONSE','ACTIVITY_EVIDENCE')
       or item ->> 'assessmentState' not in ('PENDING_ASSESSMENT','ASSESSED')
       or not academy_private.study_sync_instant_valid_v2(item ->> 'savedAt')
       or not exists (
         select 1 from jsonb_array_elements(candidate -> 'assignments') assignment
          where assignment.value #>> '{record,assignmentRef}' = item ->> 'assignmentRef'
            and assignment.value #>> '{completion,kind}' not in ('NORMAL_CERTIFIED','RFL_CERTIFIED')
         union all
         select 1 from jsonb_array_elements(candidate -> 'assessmentStates') assessment
          where assessment.value ->> 'assignmentRef' = item ->> 'assignmentRef'
            and assessment.value ->> 'status' <> 'CERTIFIED'
       ) then return false; end if;
    held := item -> 'input';
    if (held ->> 'kind' = 'CHOICE' and
        (jsonb_typeof(held -> 'choiceRef') <> 'string' or jsonb_typeof(held -> 'text') <> 'null'))
       or (held ->> 'kind' <> 'CHOICE' and
        (jsonb_typeof(held -> 'choiceRef') <> 'null' or jsonb_typeof(held -> 'text') <> 'string'
         or length(btrim(held ->> 'text')) = 0 or length(held ->> 'text') > 16000)) then return false; end if;
    if item ->> 'assessmentState' = 'PENDING_ASSESSMENT' then
      if jsonb_typeof(item -> 'trustedReceipt') <> 'null' then return false; end if;
    else
      held := item -> 'trustedReceipt';
      if not public.academy_study_json_has_exact_keys(held,
        array['assessmentRef','assessorRef','assessedAt','decision']::text[])
         or held ->> 'decision' not in ('CORRECT','INCORRECT','PARTIAL','REVIEW_REQUIRED')
         or held ->> 'assessorRef' <> 'trusted:production-item:r1'
         or not academy_private.study_sync_instant_valid_v2(held ->> 'assessedAt') then return false; end if;
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(candidate -> 'instructionalInputs') item
    group by item.value ->> 'attemptRef', item.value ->> 'itemRef' having count(*) > 1
  ) then return false; end if;
  return true;
exception when others then return false;
end;
$$;

create function academy_private.study_sync_authority_transition_valid_r1(old_doc jsonb, new_doc jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select academy_private.study_sync_authority_transition_valid_legacy_r1(
      old_doc - 'plannerDocument' - 'instructionalInputs' || jsonb_build_object(
        'privacy',(old_doc -> 'privacy') - 'instructionalInputIncluded'),
      new_doc - 'plannerDocument' - 'instructionalInputs' || jsonb_build_object(
        'privacy',(new_doc -> 'privacy') - 'instructionalInputIncluded')
    )
    and (new_doc #>> '{plannerDocument,revision}')::bigint between
      (old_doc #>> '{plannerDocument,revision}')::bigint and
      (old_doc #>> '{plannerDocument,revision}')::bigint + 1
    and ((new_doc #>> '{plannerDocument,revision}')::bigint >
         (old_doc #>> '{plannerDocument,revision}')::bigint
      or new_doc -> 'plannerDocument' = old_doc -> 'plannerDocument')
    and not exists (
      select 1 from jsonb_array_elements(old_doc #> '{plannerDocument,materializations}') old_item
      where not exists (
        select 1 from jsonb_array_elements(new_doc #> '{plannerDocument,materializations}') new_item
        where new_item.value = old_item.value
      )
    )
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'instructionalInputs') old_item
      where not exists (
        select 1 from jsonb_array_elements(new_doc -> 'instructionalInputs') new_item
        where new_item.value ->> 'attemptRef' = old_item.value ->> 'attemptRef'
          and new_item.value ->> 'itemRef' = old_item.value ->> 'itemRef'
          and (new_item.value = old_item.value or
            (new_item.value ->> 'savedAt') >= (old_item.value ->> 'savedAt'))
      )
    );
$$;

alter table academy_private.study_sync_authority_checkpoints_r1
  drop constraint study_sync_authority_checkpoints_r1_authority_checkpoint_check;

update academy_private.study_sync_authority_checkpoints_r1 set
  authority_checkpoint = authority_checkpoint || jsonb_build_object(
    'plannerDocument', jsonb_build_object(
      'schemaVersion',1,
      'scope',jsonb_build_object('householdRef',local_household_ref,'learnerRef',local_learner_ref),
      'revision',0,
      'updatedAt',authority_checkpoint ->> 'appUpdatedAt',
      'schoolPlan',null,
      'materializations',jsonb_build_array()
    ),
    'instructionalInputs',jsonb_build_array(),
    'privacy',(authority_checkpoint -> 'privacy') || jsonb_build_object('instructionalInputIncluded',false)
  );

alter table academy_private.study_sync_authority_checkpoints_r1 add constraint
  study_sync_authority_checkpoints_r1_authority_checkpoint_check check (
    academy_private.study_sync_authority_checkpoint_shape_valid_r1(authority_checkpoint)
  );

alter function academy_private.study_sync_authority_checkpoint_shape_valid_legacy_r1(jsonb) owner to postgres;
alter function academy_private.study_sync_authority_transition_valid_legacy_r1(jsonb,jsonb) owner to postgres;
alter function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_sync_authority_transition_valid_r1(jsonb,jsonb) owner to postgres;
revoke all on function academy_private.study_sync_authority_checkpoint_shape_valid_legacy_r1(jsonb) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_authority_transition_valid_legacy_r1(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_authority_transition_valid_r1(jsonb,jsonb) from public,anon,authenticated,service_role;

update academy_private.study_persistence_metadata set
  migration_names=array_append(migration_names,'20260814120000_academy_family_cross_device_data_r1'),
  security_manifest=security_manifest||jsonb_build_object(
    'family_cross_device_data','r1','school_plan_sync',true,
    'auto_planner_identity','deterministic-plus-document-cas',
    'instructional_input_checkpoint','privacy-minimized',
    'instructional_input_answer_authority',false,
    'backup_independence','preserved'
  ),
  updated_at=clock_timestamp() where singleton;

comment on function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) is
  'Strict Family cross-device checkpoint: useful school state plus bounded learner-authored instructional input; no answer authority, Tutor text, audio, or inference.';

commit;
