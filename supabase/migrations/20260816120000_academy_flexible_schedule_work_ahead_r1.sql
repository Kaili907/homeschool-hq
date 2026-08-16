-- Flexible School Plan and learner work-ahead checkpoint fields R1.
--
-- Extends only the existing per-learner Family Plan checkpoint. Missing
-- allowWorkAhead remains enabled for existing families; missing provenance is
-- the historical AUTO_PLANNER value. No new cloud state family is introduced.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found or marker.migration_names is null or not (marker.migration_names @> array[
    '20260816103000_academy_family_cloud_first_link_mapping_response_r1'
  ]::text[]) then
    raise exception 'FLEXIBLE_SCHEDULE_WORK_AHEAD prerequisite mismatch';
  end if;
  if marker.migration_names @> array[
      '20260816120000_academy_flexible_schedule_work_ahead_r1'
    ]::text[]
    or to_regprocedure('academy_private.study_family_plan_subject_without_flexible_schedule_r1(jsonb)') is not null
    or to_regprocedure('academy_private.study_family_plan_school_plan_without_work_ahead_r1(jsonb)') is not null
    or to_regprocedure('academy_private.study_family_plan_materialization_without_work_ahead_r1(jsonb)') is not null
    or to_regprocedure('academy_private.study_sync_authority_checkpoint_shape_without_work_ahead_r1(jsonb)') is not null then
    raise exception 'FLEXIBLE_SCHEDULE_WORK_AHEAD object collision';
  end if;
end;
$$;

alter function academy_private.study_family_plan_subject_valid_r1(jsonb)
  rename to study_family_plan_subject_without_flexible_schedule_r1;

create function academy_private.study_family_plan_subject_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare weekdays jsonb;
begin
  if jsonb_typeof(candidate) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(candidate) key
       where key not in ('subject','order','paused','schoolWeekdays','courseRef','lessonsPerDay','startLocalTime')
     ) then return false; end if;
  weekdays := candidate -> 'schoolWeekdays';
  if candidate ? 'schoolWeekdays' and (
    jsonb_typeof(weekdays) <> 'array'
    or jsonb_array_length(weekdays) not between 1 and 7
    or exists (
      select 1 from jsonb_array_elements(weekdays) day(value)
      where jsonb_typeof(day.value) <> 'number'
        or (day.value #>> '{}')::numeric not between 1 and 7
        or (day.value #>> '{}')::numeric <> trunc((day.value #>> '{}')::numeric)
    )
    or (select count(*) <> count(distinct day.value #>> '{}') from jsonb_array_elements(weekdays) day(value))
  ) then return false; end if;
  return academy_private.study_family_plan_subject_without_flexible_schedule_r1(
    candidate - 'schoolWeekdays'
  );
exception when others then return false;
end;
$$;

alter function academy_private.study_family_plan_school_plan_valid_r1(jsonb)
  rename to study_family_plan_school_plan_without_work_ahead_r1;

create function academy_private.study_family_plan_school_plan_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare sanitized jsonb; subjects jsonb;
begin
  if jsonb_typeof(candidate) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(candidate) key
       where key not in ('schemaVersion','householdTimeZone','schoolYearStart','schoolYearEnd','schoolWeekdays','nonSchoolDates','addedSchoolDates','allowWorkAhead','subjects','configuredAt','updatedAt')
     )
     or (candidate ? 'allowWorkAhead' and jsonb_typeof(candidate -> 'allowWorkAhead') <> 'boolean') then
    return false;
  end if;
  if jsonb_typeof(candidate -> 'subjects') <> 'array' then return false; end if;
  select coalesce(jsonb_agg(item.value - 'schoolWeekdays' order by item.ordinality), '[]'::jsonb)
    into subjects
    from jsonb_array_elements(candidate -> 'subjects') with ordinality item(value, ordinality);
  sanitized := jsonb_set(candidate - 'allowWorkAhead', '{subjects}', subjects, false);
  return academy_private.study_family_plan_school_plan_without_work_ahead_r1(sanitized)
    and not exists (
      select 1 from jsonb_array_elements(candidate -> 'subjects') item(value)
      where not academy_private.study_family_plan_subject_valid_r1(item.value)
    );
exception when others then return false;
end;
$$;

alter function academy_private.study_family_plan_materialization_valid_r1(jsonb)
  rename to study_family_plan_materialization_without_work_ahead_r1;

create function academy_private.study_family_plan_materialization_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare provenance text;
begin
  if jsonb_typeof(candidate) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(candidate) key
       where key not in ('materializationRef','kind','localDate','subject','workingGrade','courseRef','unitRef','itemRef','assignmentRef','title','createdAt','provenance')
     ) then return false; end if;
  provenance := coalesce(candidate ->> 'provenance', 'AUTO_PLANNER');
  if provenance not in ('AUTO_PLANNER','LEARNER_WORK_AHEAD') then return false; end if;
  if provenance = 'AUTO_PLANNER' and candidate ->> 'materializationRef' not like 'auto:%' then return false; end if;
  if provenance = 'LEARNER_WORK_AHEAD' and candidate ->> 'materializationRef' not like 'work-ahead:%' then return false; end if;
  return academy_private.study_family_plan_materialization_without_work_ahead_r1(
    case when provenance = 'LEARNER_WORK_AHEAD'
      then jsonb_set(candidate - 'provenance', '{materializationRef}', to_jsonb('auto:' || substr(md5(candidate ->> 'materializationRef'), 1, 20)), false)
      else candidate - 'provenance'
    end
  );
exception when others then return false;
end;
$$;

alter function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb)
  rename to study_sync_authority_checkpoint_shape_without_work_ahead_r1;

create function academy_private.study_sync_authority_checkpoint_shape_valid_r1(candidate jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare planner jsonb; plan jsonb; subjects jsonb; materializations jsonb; sanitized jsonb;
begin
  planner := candidate -> 'plannerDocument';
  plan := planner -> 'schoolPlan';
  if jsonb_typeof(plan) = 'object' then
    if not academy_private.study_family_plan_school_plan_valid_r1(plan) then return false; end if;
    select coalesce(jsonb_agg(item.value - 'schoolWeekdays' order by item.ordinality), '[]'::jsonb)
      into subjects from jsonb_array_elements(plan -> 'subjects') with ordinality item(value, ordinality);
    plan := jsonb_set(plan - 'allowWorkAhead', '{subjects}', subjects, false);
    planner := jsonb_set(planner, '{schoolPlan}', plan, false);
  end if;
  if jsonb_typeof(planner -> 'materializations') <> 'array' then return false; end if;
  if exists (
    select 1 from jsonb_array_elements(planner -> 'materializations') item(value)
    where not academy_private.study_family_plan_materialization_valid_r1(item.value)
  ) then return false; end if;
  select coalesce(jsonb_agg(
    case when coalesce(item.value ->> 'provenance', 'AUTO_PLANNER') = 'LEARNER_WORK_AHEAD'
      then jsonb_set(item.value - 'provenance', '{materializationRef}', to_jsonb('auto:' || substr(md5(item.value ->> 'materializationRef'), 1, 20)), false)
      else item.value - 'provenance' end
    order by item.ordinality
  ), '[]'::jsonb) into materializations
  from jsonb_array_elements(planner -> 'materializations') with ordinality item(value, ordinality);
  planner := jsonb_set(planner, '{materializations}', materializations, false);
  sanitized := jsonb_set(candidate, '{plannerDocument}', planner, false);
  return academy_private.study_sync_authority_checkpoint_shape_without_work_ahead_r1(sanitized);
exception when others then return false;
end;
$$;

alter function academy_private.study_family_plan_subject_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_family_plan_school_plan_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_family_plan_materialization_valid_r1(jsonb) owner to postgres;
alter function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) owner to postgres;

revoke all on function academy_private.study_family_plan_subject_valid_r1(jsonb) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_school_plan_valid_r1(jsonb) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_family_plan_materialization_valid_r1(jsonb) from public, anon, authenticated, service_role;
revoke all on function academy_private.study_sync_authority_checkpoint_shape_valid_r1(jsonb) from public, anon, authenticated, service_role;

update academy_private.study_persistence_metadata
set migration_names = array_append(migration_names, '20260816120000_academy_flexible_schedule_work_ahead_r1'),
    updated_at = clock_timestamp()
where singleton;

commit;
