-- Family Cloud first-link complete mapping response repair R1.
--
-- The canonical first-link implementation persists all eight local/hosted
-- mapping fields, but its successful response historically projected only the
-- four hosted fields. The strict browser adapter correctly rejects that body as
-- malformed and therefore cannot perform the mandatory hydrate/read-back.
-- Preserve the existing write path and add only the four already-validated
-- local references to successful response documents.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260816030000_academy_family_cloud_timezone_bootstrap_r1'
     ]::text[])
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)'
     ) is null then
    raise exception 'FAMILY_CLOUD_FIRST_LINK_MAPPING_RESPONSE prerequisite mismatch';
  end if;

  if marker.migration_names @> array[
       '20260816103000_academy_family_cloud_first_link_mapping_response_r1'
     ]::text[]
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2_mapping_response_r1(text,uuid,uuid,jsonb)'
     ) is not null then
    raise exception 'FAMILY_CLOUD_FIRST_LINK_MAPPING_RESPONSE object collision';
  end if;
end;
$$;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) rename to academy_study_sync_first_link_v2_mapping_response_r1;

revoke all on function
  public.academy_study_sync_first_link_v2_mapping_response_r1(
    text, uuid, uuid, jsonb
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
  result_value jsonb;
begin
  result_value := public.academy_study_sync_first_link_v2_mapping_response_r1(
    p_token_digest,
    p_student_id,
    p_client_operation_id,
    p_import
  );

  if result_value ->> 'status' in ('imported', 'linked-existing') then
    if jsonb_typeof(result_value -> 'mapping') <> 'object' then
      raise exception 'STUDY_SYNC_MAPPING_RESPONSE_INVALID' using errcode = '55000';
    end if;
    result_value := jsonb_set(
      result_value,
      '{mapping}',
      (result_value -> 'mapping') || jsonb_build_object(
        'localHouseholdRef', p_import #>> '{localScope,householdRef}',
        'localStudentRef', p_import #>> '{localScope,studentRef}',
        'localAssignmentRef', p_import #>> '{localScope,assignmentRef}',
        'localSessionRef', p_import #>> '{localScope,sessionRef}'
      ),
      false
    );
  end if;

  return result_value;
end;
$$;

alter function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) owner to postgres;
revoke all on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) to authenticated;

comment on function public.academy_study_sync_first_link_v2(
  text, uuid, uuid, jsonb
) is
  'Authenticated Hosted Sync V2 first-link entry point. Successful responses contain the complete validated local and hosted mapping required for strict browser read-back verification.';

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260816103000_academy_family_cloud_first_link_mapping_response_r1'
    ),
    updated_at = clock_timestamp()
where singleton;

commit;
