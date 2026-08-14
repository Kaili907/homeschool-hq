-- Lossless canonical authority checkpoint repair R1.
--
-- The normalized session/checkpoint tables remain the enforcement authority for
-- granular operations. This private, versioned document is the exact minimized
-- reconstruction authority required by an empty receiving device.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study sync checkpoint repair must run as postgres';
  end if;
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found or marker.lossless_sync_version <> 2
     or not marker.migration_names @> array['20260813172000_academy_study_sync_lossless_v2']::text[] then
    raise exception 'STUDY_SYNC_CHECKPOINT_R1 predecessor marker mismatch';
  end if;
  if marker.migration_names @> array['20260813173000_academy_study_sync_lossless_checkpoint_r1']::text[]
     or to_regclass('academy_private.study_sync_authority_checkpoints_r1') is not null then
    raise exception 'STUDY_SYNC_CHECKPOINT_R1 object collision';
  end if;
end;
$$;

create function academy_private.study_sync_keys_allowed_r1(
  candidate jsonb, required_keys text[], allowed_keys text[]
)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select candidate is not null and jsonb_typeof(candidate) = 'object'
    and candidate ?& required_keys
    and not exists (
      select 1 from jsonb_object_keys(candidate) item(key)
      where not item.key = any(allowed_keys)
    );
$$;

create function academy_private.study_sync_resume_valid_r1(candidate jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select academy_private.study_sync_keys_allowed_r1(candidate,
    array['segmentId','segmentOrdinal','elapsedActiveSecondsInSegment','completedSegmentIds','remainingSegmentIds','capturedAt']::text[],
    array['segmentId','segmentOrdinal','elapsedActiveSecondsInSegment','responseDraftRef','completedSegmentIds','remainingSegmentIds','capturedAt']::text[]);
$$;

create function academy_private.study_sync_authority_checkpoint_shape_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; nested jsonb; held jsonb;
begin
  if not public.academy_study_payload_is_minimized(candidate, 2097152)
     or not public.academy_study_json_has_exact_keys(candidate, array[
       'contractVersion','identity','sync','student','studentProfile','appUpdatedAt',
       'setupCompletedAt','assignments','assessmentStates','rflStates','socialSources',
       'safetyHolds','indexedDbDocument','privacy']::text[])
     or candidate ->> 'contractVersion' <> 'hosted-study-sync-state.r2.v1'
     or not public.academy_study_json_has_exact_keys(candidate -> 'identity',
       array['householdRef','studentRef','learnerRef']::text[])
     or not public.academy_study_json_has_exact_keys(candidate -> 'sync', array[
       'serverRevision','baseRevision','operationId','idempotencyKey','operationKind',
       'deviceRef','localSequence','createdAt']::text[])
     or (candidate #>> '{sync,operationId}') <> (candidate #>> '{sync,idempotencyKey}')
     or (candidate #>> '{sync,serverRevision}')::bigint < 0
     or (candidate #>> '{sync,baseRevision}')::bigint < 0
     or (candidate #>> '{sync,baseRevision}')::bigint > (candidate #>> '{sync,serverRevision}')::bigint
     or not public.academy_study_json_has_exact_keys(candidate -> 'privacy', array[
       'pinIncluded','bearerIncluded','rawLearnerResponseIncluded','rawTutorConversationIncluded',
       'rawAudioIncluded','inferenceIncluded','adultAnswerAuthorityIncluded','answerMaterialIncluded']::text[])
     or exists (select 1 from jsonb_each(candidate -> 'privacy') p where p.value <> 'false'::jsonb)
     or not public.academy_study_json_has_exact_keys(candidate -> 'student', array[
       'studentRef','displayName','createdAt','updatedAt','activeAssignmentRef','assignments']::text[])
     or not public.academy_study_json_has_exact_keys(candidate -> 'studentProfile', array[
       'studentRef','displayName','nominalGrade','workingGradeBySubject','enabledSubjects','createdAt','updatedAt']::text[])
     or candidate #>> '{student,studentRef}' <> candidate #>> '{identity,studentRef}'
     or candidate #>> '{studentProfile,studentRef}' <> candidate #>> '{identity,studentRef}'
     or jsonb_typeof(candidate -> 'assignments') <> 'array'
     or jsonb_typeof(candidate -> 'assessmentStates') <> 'array'
     or jsonb_typeof(candidate -> 'rflStates') <> 'array'
     or jsonb_typeof(candidate -> 'socialSources') <> 'array'
     or jsonb_typeof(candidate -> 'safetyHolds') <> 'array' then return false;
  end if;

  for item in select value from jsonb_array_elements(candidate #> '{student,assignments}') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'assignmentRef','lessonRef','subject','title','state','sessionRef','progress','pause',
      'completedAt','createdAt','updatedAt','rawAnswerIncluded','transcriptIncluded']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'progress', array[
         'completedSegmentRefs','totalSegments','lastSegmentRef','activeSeconds']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'pause', array[
         'pausedAt','resumedAt','pausedSeconds','resumeSegmentRef']::text[])
       or item -> 'rawAnswerIncluded' <> 'false'::jsonb
       or item -> 'transcriptIncluded' <> 'false'::jsonb then return false;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(candidate -> 'assignments') loop
    if not public.academy_study_json_has_exact_keys(item,
      array['record','authorityRevision','sessionIdentity','completion']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'completion', array['kind','completedAt']::text[])
       or item #>> '{completion,kind}' not in ('INCOMPLETE','NORMAL_CERTIFIED','RFL_PENDING_GUARDIAN','RFL_CERTIFIED')
       or (item #>> '{authorityRevision}')::bigint < 0
       or (jsonb_typeof(item -> 'sessionIdentity') <> 'null' and
         not public.academy_study_json_has_exact_keys(item -> 'sessionIdentity', array[
           'assignmentRef','lessonRef','blockRef','sessionRef','lineageRootRef','continuationKey']::text[]))
    then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(candidate -> 'assessmentStates') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'assignmentRef','assessmentRef','studentRef','courseRef','subject','grade','title','authorityClass',
      'status','createdAt','updatedAt','completedAt','evidenceRefs','outcome','authorityRevision']::text[])
       or item ->> 'studentRef' <> candidate #>> '{identity,studentRef}'
       or item ->> 'status' not in ('PLANNED','ACTIVE','PENDING_ASSESSMENT','SCORING_COMPLETE',
         'ADULT_REVIEW_REQUIRED','PENDING_GUARDIAN_ATTESTATION','CERTIFIED')
       or (item ->> 'authorityRevision')::bigint < 0
       or (jsonb_typeof(item -> 'outcome') <> 'null' and
         not public.academy_study_json_has_exact_keys(item -> 'outcome', array[
           'assessmentRecordRef','decision','assessedAt','assessorRef']::text[])) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(candidate -> 'rflStates') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'studentRef','assignmentRef','lessonRef','sessionRef','learnerAssertionState','learnerAssertedAt',
      'guardianState','certifiedAt','attesterRef','evidenceMode','authorityRevision']::text[])
       or item ->> 'studentRef' <> candidate #>> '{identity,studentRef}'
       or item ->> 'learnerAssertionState' <> 'ASSERTED'
       or item ->> 'guardianState' not in ('PENDING','CERTIFIED')
       or (item ->> 'authorityRevision')::bigint < 0
       or (item ->> 'guardianState' = 'PENDING' and
         (jsonb_typeof(item -> 'certifiedAt') <> 'null' or jsonb_typeof(item -> 'attesterRef') <> 'null'
          or jsonb_typeof(item -> 'evidenceMode') <> 'null'))
       or (item ->> 'guardianState' = 'CERTIFIED' and
         (jsonb_typeof(item -> 'certifiedAt') <> 'string' or jsonb_typeof(item -> 'attesterRef') <> 'string'
          or item ->> 'evidenceMode' not in ('adult-observed','simulated-alternative'))) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(candidate -> 'socialSources') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'studentRef','assignmentRef','lessonRef','readiness','sourceRef','kind','title','publisher',
      'publishedAt','attachedAt','sourceRevision']::text[])
       or item ->> 'studentRef' <> candidate #>> '{identity,studentRef}'
       or item ->> 'readiness' <> 'ATTACHED_SATISFIED'
       or (item ->> 'sourceRevision')::bigint < 0 then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(candidate -> 'safetyHolds') loop
    if not public.academy_study_json_has_exact_keys(item, array[
      'holdRef','studentRef','sessionRef','reasonCode','category','source','dedupeKey','createdAt','status',
      'acknowledgedAt','clearedAt','clearAuthority','clearerRef','logicalRevision']::text[])
       or item ->> 'studentRef' <> candidate #>> '{identity,studentRef}'
       or item ->> 'status' not in ('OPEN','ACKNOWLEDGED','CLEARED')
       or (item ->> 'logicalRevision')::bigint < 0
       or (item ->> 'status' = 'CLEARED' and
         (jsonb_typeof(item -> 'clearedAt') <> 'string' or item ->> 'clearAuthority' <> 'GUARDIAN'
          or jsonb_typeof(item -> 'clearerRef') <> 'string'))
       or (item ->> 'status' <> 'CLEARED' and
         (jsonb_typeof(item -> 'clearedAt') <> 'null' or jsonb_typeof(item -> 'clearAuthority') <> 'null'
          or jsonb_typeof(item -> 'clearerRef') <> 'null')) then return false; end if;
  end loop;

  held := candidate -> 'indexedDbDocument';
  if not public.academy_study_json_has_exact_keys(held, array[
       'schemaVersion','updatedAt','scope','preferences','parentSettings','calendar','sessions',
       'checkpoints','reviews','events','outbox']::text[])
     or held ->> 'schemaVersion' <> '1'
     or not public.academy_study_json_has_exact_keys(held -> 'scope', array['householdRef','learnerRef']::text[])
     or held #>> '{scope,householdRef}' <> candidate #>> '{identity,householdRef}'
     or held #>> '{scope,learnerRef}' <> candidate #>> '{identity,learnerRef}' then return false;
  end if;
  if jsonb_typeof(held -> 'preferences') <> 'null' then
    if not public.academy_study_json_has_exact_keys(held -> 'preferences', array['accessibility','timerPreference']::text[])
       or not public.academy_study_json_has_exact_keys(held #> '{preferences,accessibility}', array[
         'largeText','reducedMotion','noAudio','captions','transientTranscript','highContrast','oneTaskAtATime']::text[])
       or not public.academy_study_json_has_exact_keys(held #> '{preferences,timerPreference}', array['visibility','milestonesOnly']::text[])
    then return false; end if;
  end if;
  if jsonb_typeof(held -> 'parentSettings') <> 'null' then
    nested := held -> 'parentSettings';
    if not public.academy_study_json_has_exact_keys(nested, array[
      'maximumWorkMinutes','breakMinutes','timerHidden','accommodations','recommendationDecisions',
      'interruptions','reschedules','adultReviewRequests','revision']::text[]) then return false; end if;
    for item in select value from jsonb_array_elements(nested -> 'accommodations') loop
      if not academy_private.study_sync_keys_allowed_r1(item,
        array['accommodationRef','functionalDescription','studentMessage']::text[],
        array['accommodationRef','functionalDescription','studentMessage','maximumWorkMinutes','breakMinutes','timerHidden']::text[]) then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(nested -> 'recommendationDecisions') loop
      if not public.academy_study_json_has_exact_keys(item,array['recommendationRef','decision','reasonCode']::text[]) then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(nested -> 'interruptions') loop
      if not public.academy_study_json_has_exact_keys(item,array['blockRef','kind','at']::text[]) then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(nested -> 'reschedules') loop
      if not public.academy_study_json_has_exact_keys(item,array['blockRef','replacementStart']::text[]) then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(nested -> 'adultReviewRequests') loop
      if not public.academy_study_json_has_exact_keys(item,array['requestRef','audience','status','reason']::text[]) then return false; end if;
    end loop;
  end if;

  for item in select value from jsonb_array_elements(held -> 'calendar') loop
    if not public.academy_study_json_has_exact_keys(item,array['block','plan']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'plan',array[
         'lessonRef','title','subject','skillRefs','segments','masteryAuthority','source']::text[])
       or not academy_private.study_sync_keys_allowed_r1(item -> 'block', array[
         'schemaVersion','internalBlockId','learnerRef','sourceIdentity','lineage','title','blockType','canonicalTask',
         'householdTimeZone','scheduledLocalStart','scheduledStartInstant','intendedLocalDate','placementSource',
         'estimatedDurationMinutes','actualDurationSeconds','timerVisibility','state','segments','interruptionHistory',
         'revision','lastEventAt','events']::text[], array[
         'schemaVersion','internalBlockId','learnerRef','sourceIdentity','lineage','title','subject','blockType','canonicalTask',
         'householdTimeZone','scheduledLocalStart','scheduledStartInstant','intendedLocalDate','placementSource',
         'estimatedDurationMinutes','actualDurationSeconds','timerVisibility','state','segments','activeSince','resumePoint',
         'currentInterruption','interruptionHistory','revision','lastEventAt','events']::text[])
       or not public.academy_study_json_has_exact_keys(item #> '{block,sourceIdentity}',array['source','externalItemId']::text[])
       or not academy_private.study_sync_keys_allowed_r1(item #> '{block,lineage}',
         array['rootInternalBlockId','continuationKey','completedBeforeOccurrence']::text[],
         array['rootInternalBlockId','continuationKey','continuationOf','completedBeforeOccurrence']::text[])
    then return false; end if;
    if jsonb_typeof(item #> '{block,canonicalTask}') = 'object' and not
       academy_private.study_sync_keys_allowed_r1(item #> '{block,canonicalTask}',array['taskType']::text[],array['taskType','customTaskTypeId']::text[])
    then return false; end if;
    for nested in select value from jsonb_array_elements(item #> '{plan,segments}') loop
      if not academy_private.study_sync_keys_allowed_r1(nested,
        array['segmentRef','title','taskType','estimatedMinutes','required']::text[],
        array['segmentRef','title','taskType','customTaskTypeId','estimatedMinutes','required']::text[]) then return false; end if;
    end loop;
    for nested in select value from jsonb_array_elements(item #> '{block,segments}') loop
      if not academy_private.study_sync_keys_allowed_r1(nested,
        array['segmentId','planOrdinal','title','canonicalTaskType','estimatedMinutes','required','actualActiveSeconds','elapsedActiveSecondsBeforeBlock']::text[],
        array['segmentId','planOrdinal','title','canonicalTaskType','customTaskTypeId','estimatedMinutes','required','actualActiveSeconds','elapsedActiveSecondsBeforeBlock','completedAt']::text[]) then return false; end if;
    end loop;
    if item #> '{block,resumePoint}' is not null and not academy_private.study_sync_resume_valid_r1(item #> '{block,resumePoint}') then return false; end if;
    for nested in select value from jsonb_array_elements(item #> '{block,interruptionHistory}') loop
      if not public.academy_study_json_has_exact_keys(nested,array['category','approvalState','interruptedAt','actor','resumePoint']::text[])
         or not academy_private.study_sync_resume_valid_r1(nested -> 'resumePoint') then return false; end if;
    end loop;
    if item #> '{block,currentInterruption}' is not null and
       (not public.academy_study_json_has_exact_keys(item #> '{block,currentInterruption}',array['category','approvalState','interruptedAt','actor','resumePoint']::text[])
        or not academy_private.study_sync_resume_valid_r1(item #> '{block,currentInterruption,resumePoint}')) then return false; end if;
    for nested in select value from jsonb_array_elements(item #> '{block,events}') loop
      if not academy_private.study_sync_keys_allowed_r1(nested,array['type','at','actor']::text[],array[
        'type','at','actor','segmentId','category','approvalState','fromLocalStart','toLocalStart','fromStartInstant',
        'toStartInstant','fromIntendedLocalDate','toIntendedLocalDate','changedFields','continuationBlockId','continuationKey']::text[]) then return false; end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(held -> 'sessions') loop
    if not public.academy_study_json_has_exact_keys(item,array[
      'scope','lessonRef','segmentRef','status','updatedAt','lastAcceptedEventRef','rawAnswerIncluded','transcriptIncluded']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'scope',array['householdRef','learnerRef','sessionRef']::text[])
       or item -> 'rawAnswerIncluded' <> 'false'::jsonb or item -> 'transcriptIncluded' <> 'false'::jsonb then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(held -> 'checkpoints') loop
    if not public.academy_study_json_has_exact_keys(item,array[
      'checkpointRef','householdRef','learnerRef','sessionRef','lessonRef','segmentRef','revision','capturedAt',
      'completedSegmentRefs','elapsedActiveSecondsInSegment','responseDraftRef','rawAnswerIncluded','transcriptIncluded']::text[])
       or item -> 'rawAnswerIncluded' <> 'false'::jsonb or item -> 'transcriptIncluded' <> 'false'::jsonb then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(held -> 'reviews') loop
    if not public.academy_study_json_has_exact_keys(item,array[
      'recommendationRef','householdRef','learnerRef','sourceEvidenceRef','lessonRef','dueDate','reasonCodes','status','rawAnswerIncluded','transcriptIncluded']::text[])
       or item -> 'rawAnswerIncluded' <> 'false'::jsonb or item -> 'transcriptIncluded' <> 'false'::jsonb then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(held -> 'events') loop
    if not public.academy_study_json_has_exact_keys(item,array['sessionRef','eventRef','semanticKey','event']::text[])
       or not public.academy_study_json_has_exact_keys(item -> 'event',array['eventRef','occurredAt','type','payload']::text[]) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(held -> 'outbox') loop
    if not public.academy_study_json_has_exact_keys(item,array['proposalRef','route','evidenceRefs','status']::text[]) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create function academy_private.study_sync_authority_transition_valid_r1(old_doc jsonb, new_doc jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select old_doc #> '{identity}' = new_doc #> '{identity}'
    and old_doc -> 'studentProfile' = new_doc -> 'studentProfile'
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'assignments') old_assignment(value)
      where old_assignment.value #>> '{completion,kind}' in ('NORMAL_CERTIFIED','RFL_CERTIFIED')
        and not exists (
          select 1 from jsonb_array_elements(new_doc -> 'assignments') new_assignment(value)
          where new_assignment.value #>> '{record,assignmentRef}' = old_assignment.value #>> '{record,assignmentRef}'
            and new_assignment.value -> 'completion' = old_assignment.value -> 'completion'
        )
    )
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'rflStates') old_rfl(value)
      where old_rfl.value ->> 'guardianState' = 'CERTIFIED'
        and not new_doc -> 'rflStates' @> jsonb_build_array(old_rfl.value)
    )
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'assessmentStates') old_assessment(value)
      where old_assessment.value ->> 'status' = 'CERTIFIED'
        and not new_doc -> 'assessmentStates' @> jsonb_build_array(old_assessment.value)
    )
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'socialSources') old_source(value)
      where not new_doc -> 'socialSources' @> jsonb_build_array(old_source.value)
    )
    and not exists (
      select 1 from jsonb_array_elements(old_doc -> 'safetyHolds') old_hold(value)
      where not exists (
        select 1 from jsonb_array_elements(new_doc -> 'safetyHolds') new_hold(value)
        where new_hold.value ->> 'holdRef' = old_hold.value ->> 'holdRef'
          and (
            new_hold.value = old_hold.value
            or (old_hold.value ->> 'status' <> 'CLEARED'
              and new_hold.value ->> 'status' = 'CLEARED'
              and (new_hold.value ->> 'logicalRevision')::bigint >
                (old_hold.value ->> 'logicalRevision')::bigint)
          )
      )
    );
$$;

create table academy_private.study_sync_authority_checkpoints_r1 (
  household_id uuid not null,
  student_id uuid not null,
  local_household_ref text not null,
  local_student_ref text not null,
  local_learner_ref text not null,
  contract_version text not null check (contract_version = 'hosted-study-sync-state.r2.v1'),
  revision bigint not null check (revision >= 0),
  authority_checkpoint jsonb not null check (
    academy_private.study_sync_authority_checkpoint_shape_valid_r1(authority_checkpoint)
  ),
  last_client_operation_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (household_id, student_id),
  foreign key (student_id, household_id) references public.academy_students(id, household_id)
    on update restrict on delete restrict
);
alter table academy_private.study_sync_authority_checkpoints_r1 owner to postgres;
alter table academy_private.study_sync_authority_checkpoints_r1 enable row level security;
alter table academy_private.study_sync_authority_checkpoints_r1 force row level security;
revoke all on table academy_private.study_sync_authority_checkpoints_r1 from public, anon, authenticated, service_role;

alter function public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)
  rename to academy_study_sync_first_link_v2_session_r1;
alter function public.academy_study_sync_hydrate_v2(text,uuid,text,text)
  rename to academy_study_sync_hydrate_v2_session_r1;
alter function public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb)
  rename to academy_study_sync_write_v2_session_r1;
revoke all on function public.academy_study_sync_first_link_v2_session_r1(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.academy_study_sync_hydrate_v2_session_r1(text,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.academy_study_sync_write_v2_session_r1(text,uuid,text,text,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.academy_study_sync_first_link_v2(
  p_token_digest text, p_student_id uuid, p_client_operation_id uuid, p_import jsonb
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare candidate jsonb; held academy_private.study_sync_authority_checkpoints_r1%rowtype; result_value jsonb;
begin
  if not (p_import ? 'authorityCheckpoint') then
    return public.academy_study_sync_first_link_v2_session_r1(p_token_digest,p_student_id,p_client_operation_id,p_import);
  end if;
  if not academy_private.study_sync_keys_allowed_r1(p_import,
       array['localScope','hostedScope','session','checkpoint','socialSource','guardianAttestation','safetyState','assessment','authorityCheckpoint']::text[],
       array['localScope','hostedScope','session','checkpoint','socialSource','guardianAttestation','safetyState','assessment','authorityCheckpoint']::text[])
  then raise exception 'STUDY_SYNC_IMPORT_INVALID' using errcode='22023'; end if;
  candidate := p_import -> 'authorityCheckpoint';
  if not academy_private.study_sync_authority_checkpoint_shape_valid_r1(candidate)
     or candidate #>> '{identity,householdRef}' <> p_import #>> '{localScope,householdRef}'
     or candidate #>> '{identity,studentRef}' <> p_import #>> '{localScope,studentRef}'
     or candidate #>> '{sync,operationId}' <> p_client_operation_id::text
  then raise exception 'STUDY_SYNC_AUTHORITY_CHECKPOINT_INVALID' using errcode='22023'; end if;
  select * into held from academy_private.study_sync_authority_checkpoints_r1
    where student_id=p_student_id for update;
  if held.student_id is not null and held.authority_checkpoint <> candidate then
    return jsonb_build_object('schemaVersion',2,'status',case
      when held.last_client_operation_id=p_client_operation_id then 'idempotency-collision'
      else 'mapping-conflict' end);
  end if;
  result_value := public.academy_study_sync_first_link_v2_session_r1(
    p_token_digest,p_student_id,p_client_operation_id,p_import - 'authorityCheckpoint');
  if result_value ->> 'status' not in ('imported','linked-existing') then return result_value; end if;
  if held.student_id is null then
    insert into academy_private.study_sync_authority_checkpoints_r1(
      household_id,student_id,local_household_ref,local_student_ref,local_learner_ref,
      contract_version,revision,authority_checkpoint,last_client_operation_id
    ) select link.household_id,link.student_id,link.local_household_ref,link.local_student_ref,
      candidate #>> '{identity,learnerRef}',candidate ->> 'contractVersion',
      (candidate #>> '{sync,serverRevision}')::bigint,candidate,p_client_operation_id
      from academy_private.study_sync_explicit_links_v2 link
      where link.student_id=p_student_id and link.local_household_ref=p_import #>> '{localScope,householdRef}'
        and link.local_student_ref=p_import #>> '{localScope,studentRef}'
        and link.local_assignment_ref=p_import #>> '{localScope,assignmentRef}'
        and link.local_session_ref=p_import #>> '{localScope,sessionRef}';
  end if;
  return jsonb_set(result_value,'{revisions,authorityCheckpoint}',
    to_jsonb((candidate #>> '{sync,serverRevision}')::bigint),true);
end;
$$;

create function public.academy_study_sync_hydrate_v2(
  p_token_digest text,p_student_id uuid,p_assignment_ref text,p_session_id text
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare result_value jsonb; held academy_private.study_sync_authority_checkpoints_r1%rowtype;
begin
  result_value := public.academy_study_sync_hydrate_v2_session_r1(p_token_digest,p_student_id,p_assignment_ref,p_session_id);
  if result_value ->> 'status' <> 'ready' then return result_value; end if;
  select checkpoint.* into held from academy_private.study_sync_authority_checkpoints_r1 checkpoint
    join academy_private.study_sync_explicit_links_v2 link
      on link.household_id=checkpoint.household_id and link.student_id=checkpoint.student_id
    where link.student_id=p_student_id and link.assignment_ref=p_assignment_ref and link.session_id=p_session_id;
  if held.student_id is null then return result_value; end if;
  return result_value || jsonb_build_object('authorityCheckpoint',held.authority_checkpoint,
    'authorityCheckpointRevision',held.revision);
end;
$$;

create function public.academy_study_sync_write_v2(
  p_token_digest text,p_student_id uuid,p_assignment_ref text,p_session_id text,
  p_expected_revision bigint,p_client_operation_id uuid,p_operation text,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare actor record; held academy_private.study_sync_authority_checkpoints_r1%rowtype;
  candidate jsonb; fingerprint jsonb; request_digest text;
  prior academy_private.study_mutation_receipts%rowtype; result_value jsonb;
begin
  if p_operation <> 'authority-checkpoint:compare-and-swap' then
    return public.academy_study_sync_write_v2_session_r1(p_token_digest,p_student_id,p_assignment_ref,p_session_id,
      p_expected_revision,p_client_operation_id,p_operation,p_payload);
  end if;
  if auth.uid() is null then raise exception 'STUDY_AUTH_REQUIRED' using errcode='28000'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_client_operation_id is null
     or not public.academy_study_json_has_exact_keys(p_payload,array['authorityCheckpoint']::text[])
  then raise exception 'STUDY_SYNC_REQUEST_INVALID' using errcode='22023'; end if;
  select * into actor from academy_private.study_sync_resolve_actor_v1(
    p_token_digest,p_student_id,'student:attempts:create');
  if actor.actor_grant_id is null then return jsonb_build_object('schemaVersion',2,'status','denied','code','study-session-invalid'); end if;
  if actor.actor_kind <> 'guardian' then return jsonb_build_object('schemaVersion',2,'status','denied','code','actor-not-authorized'); end if;
  select checkpoint.* into held from academy_private.study_sync_authority_checkpoints_r1 checkpoint
    join academy_private.study_sync_explicit_links_v2 link
      on link.household_id=checkpoint.household_id and link.student_id=checkpoint.student_id
    where link.household_id=actor.actor_household_id and link.student_id=p_student_id
      and link.assignment_ref=p_assignment_ref and link.session_id=p_session_id for update of checkpoint;
  if held.student_id is null then return jsonb_build_object('schemaVersion',2,'status','denied','code','study-session-invalid'); end if;
  fingerprint := jsonb_build_object('actor_kind',actor.actor_kind,'actor_user_id',actor.actor_user_id,
    'actor_grant_id',actor.actor_grant_id,'student_id',p_student_id,'assignment_ref',p_assignment_ref,
    'session_id',p_session_id,'expected_revision',p_expected_revision,'operation',p_operation,'payload',p_payload);
  request_digest := academy_private.study_sha256_json(fingerprint);
  select * into prior from academy_private.study_mutation_receipts
    where actor_scope='study-sync-authority-checkpoint-r1:'||p_student_id::text
      and operation_kind='study_sync_authority_checkpoint_r1' and idempotency_key=p_client_operation_id::text;
  if prior.idempotency_key is not null then
    if prior.request_digest=request_digest and prior.request_fingerprint=fingerprint then return prior.result; end if;
    return jsonb_build_object('schemaVersion',2,'status','idempotency-collision','operation',p_operation);
  end if;
  if held.revision <> p_expected_revision then
    result_value := jsonb_build_object('schemaVersion',2,'status','revision-conflict','operation',p_operation,
      'revisionDomain','authority-checkpoint','serverRevision',held.revision);
  else
    candidate := p_payload -> 'authorityCheckpoint';
    if not academy_private.study_sync_authority_checkpoint_shape_valid_r1(candidate)
       or candidate #>> '{identity,householdRef}' <> held.local_household_ref
       or candidate #>> '{identity,studentRef}' <> held.local_student_ref
       or candidate #>> '{identity,learnerRef}' <> held.local_learner_ref
       or (candidate #>> '{sync,baseRevision}')::bigint <> p_expected_revision
       or (candidate #>> '{sync,serverRevision}')::bigint <> p_expected_revision+1
       or candidate #>> '{sync,operationId}' <> p_client_operation_id::text
       or candidate #>> '{sync,idempotencyKey}' <> p_client_operation_id::text
       or not academy_private.study_sync_authority_transition_valid_r1(held.authority_checkpoint,candidate)
    then
      result_value := jsonb_build_object('schemaVersion',2,'status','invalid-write','operation',p_operation,
        'reasonCode','invalid-authority-checkpoint');
    else
      update academy_private.study_sync_authority_checkpoints_r1 set authority_checkpoint=candidate,
        revision=p_expected_revision+1,last_client_operation_id=p_client_operation_id,updated_at=statement_timestamp()
        where household_id=held.household_id and student_id=held.student_id;
      result_value := jsonb_build_object('schemaVersion',2,'status','stored','operation',p_operation,
        'revisionDomain','authority-checkpoint','serverRevision',p_expected_revision+1);
    end if;
  end if;
  insert into academy_private.study_mutation_receipts(actor_scope,operation_kind,idempotency_key,
    request_digest,request_fingerprint,result,expires_at) values(
      'study-sync-authority-checkpoint-r1:'||p_student_id::text,'study_sync_authority_checkpoint_r1',
      p_client_operation_id::text,request_digest,fingerprint,result_value,now()+interval '180 days');
  return result_value;
end;
$$;

alter function academy_private.study_sync_keys_allowed_r1(jsonb,text[],text[]) owner to postgres;
alter function academy_private.study_sync_resume_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_sync_authority_transition_valid_r1(jsonb,jsonb) owner to postgres;
revoke all on function academy_private.study_sync_keys_allowed_r1(jsonb,text[],text[]) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_resume_valid_r1(jsonb) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) from public,anon,authenticated,service_role;
revoke all on function academy_private.study_sync_authority_transition_valid_r1(jsonb,jsonb) from public,anon,authenticated,service_role;

alter function public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb) owner to postgres;
alter function public.academy_study_sync_hydrate_v2(text,uuid,text,text) owner to postgres;
alter function public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb) owner to postgres;
revoke all on function public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.academy_study_sync_hydrate_v2(text,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb) to authenticated;
grant execute on function public.academy_study_sync_hydrate_v2(text,uuid,text,text) to authenticated;
grant execute on function public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb) to authenticated;

update academy_private.study_persistence_metadata set
  migration_names=array_append(migration_names,'20260813173000_academy_study_sync_lossless_checkpoint_r1'),
  security_manifest=security_manifest||jsonb_build_object(
    'lossless_checkpoint_repair','r1','authority_checkpoint_contract','hosted-study-sync-state.r2.v1',
    'authority_checkpoint_max_bytes',2097152,'authority_checkpoint_cas',true,
    'authority_checkpoint_identity_server_bound',true,'authority_checkpoint_unknown_keys','deny'),
  updated_at=clock_timestamp() where singleton;

comment on table academy_private.study_sync_authority_checkpoints_r1 is
  'Bounded, versioned, minimized canonical reconstruction authority. No browser table grants; identity is bound by RPC to exact link and current grant.';
comment on function public.academy_study_sync_hydrate_v2(text,uuid,text,text) is
  'Exact-grant hydrate of normalized session authority plus the lossless canonical R2 authority checkpoint when present.';

commit;
