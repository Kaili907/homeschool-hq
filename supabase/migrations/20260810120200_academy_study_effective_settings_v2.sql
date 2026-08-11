begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Effective Settings V2 migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.storage_version <> 1
     or marker.authorization_version <> 1
     or marker.final_production_version <> 1 then
    raise exception 'Study Effective Settings V2 prerequisite mismatch';
  end if;
  if to_regclass('academy_private.study_effective_settings_admin_defaults') is not null
     or to_regclass('academy_private.study_effective_settings_safety_policy') is not null
     or to_regprocedure(
       'public.academy_study_effective_settings_v2(uuid,date)'
     ) is not null then
    raise exception 'Study Effective Settings V2 object collision';
  end if;
end;
$$;

create table academy_private.study_effective_settings_admin_defaults (
  singleton boolean primary key default true check (singleton),
  schema_version smallint not null default 2 check (schema_version = 2),
  timer_mode text not null
    check (timer_mode in ('visible', 'hidden', 'count_up', 'count_down')),
  maximum_work_minutes integer not null
    check (maximum_work_minutes between 1 and 240),
  break_minimum_minutes integer not null
    check (break_minimum_minutes between 1 and 120),
  break_maximum_minutes integer not null
    check (break_maximum_minutes between 1 and 180),
  required_break_interval_minutes integer not null
    check (required_break_interval_minutes between 1 and 240),
  reduced_motion boolean not null,
  no_audio boolean not null,
  large_text boolean not null,
  read_aloud boolean not null,
  speech_input_allowed boolean not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint study_effective_settings_admin_break_range_check
    check (break_minimum_minutes <= break_maximum_minutes)
);

create table academy_private.study_effective_settings_safety_policy (
  singleton boolean primary key default true check (singleton),
  schema_version smallint not null default 2 check (schema_version = 2),
  minimum_work_minutes integer
    check (minimum_work_minutes between 1 and 480),
  maximum_work_minutes integer
    check (maximum_work_minutes between 1 and 480),
  break_minimum_minutes integer
    check (break_minimum_minutes between 1 and 120),
  break_maximum_minutes integer
    check (break_maximum_minutes between 1 and 180),
  required_break_interval_minutes integer
    check (required_break_interval_minutes between 1 and 240),
  timer_visibility text not null default 'follow_lower_authority'
    check (timer_visibility in ('follow_lower_authority', 'visible', 'hidden')),
  reduced_motion boolean,
  no_audio boolean,
  large_text boolean,
  read_aloud boolean,
  speech_input_allowed boolean,
  policy_version integer not null default 2 check (policy_version = 2),
  updated_at timestamptz not null default now(),
  constraint study_effective_settings_safety_work_range_check check (
    minimum_work_minutes is null
    or maximum_work_minutes is null
    or minimum_work_minutes <= maximum_work_minutes
  ),
  constraint study_effective_settings_safety_break_range_check check (
    break_minimum_minutes is null
    or break_maximum_minutes is null
    or break_minimum_minutes <= break_maximum_minutes
  )
);

alter table academy_private.study_effective_settings_admin_defaults owner to postgres;
alter table academy_private.study_effective_settings_safety_policy owner to postgres;
alter table academy_private.study_effective_settings_admin_defaults enable row level security;
alter table academy_private.study_effective_settings_admin_defaults force row level security;
alter table academy_private.study_effective_settings_safety_policy enable row level security;
alter table academy_private.study_effective_settings_safety_policy force row level security;
revoke all on table academy_private.study_effective_settings_admin_defaults
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_effective_settings_safety_policy
  from public, anon, authenticated, service_role;

insert into academy_private.study_effective_settings_admin_defaults (
  timer_mode, maximum_work_minutes, break_minimum_minutes,
  break_maximum_minutes, required_break_interval_minutes,
  reduced_motion, no_audio, large_text, read_aloud, speech_input_allowed
) values (
  'visible', 30, 5, 15, 30,
  false, false, false, false, false
);

-- These are code-owned outer bounds, not learner or guardian content. They are
-- intentionally non-binding against the seeded Admin defaults while ensuring
-- the highest-authority safety layer is always present in the reduction.
insert into academy_private.study_effective_settings_safety_policy (
  minimum_work_minutes, maximum_work_minutes,
  break_minimum_minutes, break_maximum_minutes,
  required_break_interval_minutes
) values (1, 240, 1, 120, 240);

create function public.academy_study_effective_settings_v2(
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
  effective_date_text text;
  admin_defaults academy_private.study_effective_settings_admin_defaults%rowtype;
  safety academy_private.study_effective_settings_safety_policy%rowtype;
  guardian public.academy_study_parent_settings%rowtype;
  guardian_present boolean := false;

  accommodation_maximum_work integer;
  accommodation_break_interval integer;
  accommodation_break_minimum integer;
  accommodation_timer_hidden boolean;
  accommodation_timer_visible boolean;
  accommodation_has_reduced_motion boolean;
  accommodation_reduced_motion boolean;
  accommodation_has_no_audio boolean;
  accommodation_no_audio boolean;
  accommodation_has_large_text boolean;
  accommodation_large_text boolean;
  accommodation_has_read_aloud boolean;
  accommodation_read_aloud boolean;
  accommodation_has_speech_input boolean;
  accommodation_speech_input boolean;

  timer_mode text;
  maximum_work_minutes integer;
  break_minimum_minutes integer;
  break_maximum_minutes integer;
  minimum_break_count integer;
  required_break_interval_minutes integer;
  reduced_motion boolean;
  no_audio boolean;
  large_text boolean;
  read_aloud boolean;
  speech_input_allowed boolean;

  timer_provenance jsonb;
  maximum_work_provenance jsonb;
  break_minimum_provenance jsonb;
  break_maximum_provenance jsonb;
  minimum_break_count_provenance jsonb;
  break_interval_provenance jsonb;
  reduced_motion_provenance jsonb;
  no_audio_provenance jsonb;
  large_text_provenance jsonb;
  read_aloud_provenance jsonb;
  speech_input_provenance jsonb;
  conflict_sources jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_effective_date is null then
    raise exception 'STUDY_EFFECTIVE_DATE_INVALID' using errcode = '22023';
  end if;

  select student.household_id into target_household_id
  from public.academy_students as student
  where student.id = p_student_id;
  if target_household_id is null
     or not public.academy_study_can_view(target_household_id, p_student_id) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  effective_date_text := to_char(p_effective_date, 'YYYY-MM-DD');

  select * into admin_defaults
  from academy_private.study_effective_settings_admin_defaults
  where singleton;
  if not found then
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'unavailable',
      'studentId', p_student_id,
      'effectiveDate', effective_date_text,
      'reasonCode', 'admin_defaults_unavailable'
    );
  end if;

  select * into safety
  from academy_private.study_effective_settings_safety_policy
  where singleton;
  if not found then
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'unavailable',
      'studentId', p_student_id,
      'effectiveDate', effective_date_text,
      'reasonCode', 'safety_constraints_unavailable'
    );
  end if;

  select * into guardian
  from public.academy_study_parent_settings
  where household_id = target_household_id
    and student_id = p_student_id;
  guardian_present := found;

  if guardian_present then
    timer_mode := guardian.timer_mode;
    maximum_work_minutes := guardian.maximum_work_minutes;
    break_minimum_minutes := guardian.break_minimum_minutes;
    break_maximum_minutes := guardian.break_maximum_minutes;
    minimum_break_count := guardian.required_breaks;
    reduced_motion := guardian.reduced_motion;
    no_audio := guardian.no_audio;
    large_text := guardian.large_text;
    read_aloud := guardian.read_aloud;
    speech_input_allowed := guardian.speech_input_allowed;
    timer_provenance := jsonb_build_array('guardian');
    maximum_work_provenance := jsonb_build_array('guardian');
    break_minimum_provenance := jsonb_build_array('guardian');
    break_maximum_provenance := jsonb_build_array('guardian');
    minimum_break_count_provenance := jsonb_build_array('guardian');
    reduced_motion_provenance := jsonb_build_array('guardian');
    no_audio_provenance := jsonb_build_array('guardian');
    large_text_provenance := jsonb_build_array('guardian');
    read_aloud_provenance := jsonb_build_array('guardian');
    speech_input_provenance := jsonb_build_array('guardian');
  else
    timer_mode := admin_defaults.timer_mode;
    maximum_work_minutes := admin_defaults.maximum_work_minutes;
    break_minimum_minutes := admin_defaults.break_minimum_minutes;
    break_maximum_minutes := admin_defaults.break_maximum_minutes;
    minimum_break_count := 0;
    reduced_motion := admin_defaults.reduced_motion;
    no_audio := admin_defaults.no_audio;
    large_text := admin_defaults.large_text;
    read_aloud := admin_defaults.read_aloud;
    speech_input_allowed := admin_defaults.speech_input_allowed;
    timer_provenance := jsonb_build_array('admin_default');
    maximum_work_provenance := jsonb_build_array('admin_default');
    break_minimum_provenance := jsonb_build_array('admin_default');
    break_maximum_provenance := jsonb_build_array('admin_default');
    minimum_break_count_provenance := jsonb_build_array();
    reduced_motion_provenance := jsonb_build_array('admin_default');
    no_audio_provenance := jsonb_build_array('admin_default');
    large_text_provenance := jsonb_build_array('admin_default');
    read_aloud_provenance := jsonb_build_array('admin_default');
    speech_input_provenance := jsonb_build_array('admin_default');
  end if;
  required_break_interval_minutes :=
    admin_defaults.required_break_interval_minutes;
  break_interval_provenance := jsonb_build_array('admin_default');

  select
    min(accommodation.maximum_duration_minutes),
    min(accommodation.required_break_interval_minutes),
    max(accommodation.required_break_duration_minutes),
    bool_or(accommodation.timer_visibility = 'hidden'),
    bool_or(accommodation.timer_visibility = 'visible'),
    bool_or(accommodation.presentation_accommodations ? 'reduced_motion'),
    bool_or((accommodation.presentation_accommodations ->> 'reduced_motion')::boolean)
      filter (where accommodation.presentation_accommodations ? 'reduced_motion'),
    bool_or(accommodation.presentation_accommodations ? 'no_audio'),
    bool_or((accommodation.presentation_accommodations ->> 'no_audio')::boolean)
      filter (where accommodation.presentation_accommodations ? 'no_audio'),
    bool_or(accommodation.presentation_accommodations ? 'large_text'),
    bool_or((accommodation.presentation_accommodations ->> 'large_text')::boolean)
      filter (where accommodation.presentation_accommodations ? 'large_text'),
    bool_or(accommodation.presentation_accommodations ? 'read_aloud'),
    bool_or((accommodation.presentation_accommodations ->> 'read_aloud')::boolean)
      filter (where accommodation.presentation_accommodations ? 'read_aloud'),
    bool_or(accommodation.presentation_accommodations ? 'speech_input_allowed'),
    bool_and((accommodation.presentation_accommodations ->> 'speech_input_allowed')::boolean)
      filter (where accommodation.presentation_accommodations ? 'speech_input_allowed')
  into
    accommodation_maximum_work,
    accommodation_break_interval,
    accommodation_break_minimum,
    accommodation_timer_hidden,
    accommodation_timer_visible,
    accommodation_has_reduced_motion,
    accommodation_reduced_motion,
    accommodation_has_no_audio,
    accommodation_no_audio,
    accommodation_has_large_text,
    accommodation_large_text,
    accommodation_has_read_aloud,
    accommodation_read_aloud,
    accommodation_has_speech_input,
    accommodation_speech_input
  from public.academy_study_accommodations as accommodation
  where accommodation.household_id = target_household_id
    and accommodation.student_id = p_student_id
    and accommodation.state = 'active'
    and accommodation.effective_from <= p_effective_date
    and (
      accommodation.effective_until is null
      or accommodation.effective_until >= p_effective_date
    );

  if accommodation_maximum_work is not null
     and accommodation_maximum_work <= maximum_work_minutes then
    if accommodation_maximum_work < maximum_work_minutes then
      maximum_work_provenance := jsonb_build_array('accommodation');
    else
      maximum_work_provenance :=
        maximum_work_provenance || jsonb_build_array('accommodation');
    end if;
    maximum_work_minutes := accommodation_maximum_work;
  end if;
  if safety.maximum_work_minutes is not null
     and safety.maximum_work_minutes <= maximum_work_minutes then
    if safety.maximum_work_minutes < maximum_work_minutes then
      maximum_work_provenance := jsonb_build_array('safety');
    else
      maximum_work_provenance :=
        maximum_work_provenance || jsonb_build_array('safety');
    end if;
    maximum_work_minutes := safety.maximum_work_minutes;
  end if;
  if safety.minimum_work_minutes is not null
     and safety.minimum_work_minutes > maximum_work_minutes then
    conflict_sources := maximum_work_provenance;
    if not conflict_sources ? 'safety' then
      conflict_sources := conflict_sources || jsonb_build_array('safety');
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'manual_review',
      'studentId', p_student_id,
      'effectiveDate', effective_date_text,
      'reasonCodes', jsonb_build_array('work_duration_conflict'),
      'sourceCategories', conflict_sources
    );
  end if;

  if accommodation_break_minimum is not null
     and accommodation_break_minimum >= break_minimum_minutes then
    if accommodation_break_minimum > break_minimum_minutes then
      break_minimum_provenance := jsonb_build_array('accommodation');
    else
      break_minimum_provenance :=
        break_minimum_provenance || jsonb_build_array('accommodation');
    end if;
    break_minimum_minutes := accommodation_break_minimum;
  end if;
  if safety.break_minimum_minutes is not null
     and safety.break_minimum_minutes >= break_minimum_minutes then
    if safety.break_minimum_minutes > break_minimum_minutes then
      break_minimum_provenance := jsonb_build_array('safety');
    else
      break_minimum_provenance :=
        break_minimum_provenance || jsonb_build_array('safety');
    end if;
    break_minimum_minutes := safety.break_minimum_minutes;
  end if;
  if safety.break_maximum_minutes is not null
     and safety.break_maximum_minutes <= break_maximum_minutes then
    if safety.break_maximum_minutes < break_maximum_minutes then
      break_maximum_provenance := jsonb_build_array('safety');
    else
      break_maximum_provenance :=
        break_maximum_provenance || jsonb_build_array('safety');
    end if;
    break_maximum_minutes := safety.break_maximum_minutes;
  end if;
  if break_minimum_minutes > break_maximum_minutes then
    conflict_sources := jsonb_build_array();
    if break_minimum_provenance ? 'admin_default'
       or break_maximum_provenance ? 'admin_default' then
      conflict_sources := conflict_sources || jsonb_build_array('admin_default');
    end if;
    if break_minimum_provenance ? 'guardian'
       or break_maximum_provenance ? 'guardian' then
      conflict_sources := conflict_sources || jsonb_build_array('guardian');
    end if;
    if break_minimum_provenance ? 'accommodation'
       or break_maximum_provenance ? 'accommodation' then
      conflict_sources := conflict_sources || jsonb_build_array('accommodation');
    end if;
    if break_minimum_provenance ? 'safety'
       or break_maximum_provenance ? 'safety' then
      conflict_sources := conflict_sources || jsonb_build_array('safety');
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'status', 'manual_review',
      'studentId', p_student_id,
      'effectiveDate', effective_date_text,
      'reasonCodes', jsonb_build_array('break_duration_conflict'),
      'sourceCategories', conflict_sources
    );
  end if;

  if accommodation_break_interval is not null
     and accommodation_break_interval <= required_break_interval_minutes then
    if accommodation_break_interval < required_break_interval_minutes then
      break_interval_provenance := jsonb_build_array('accommodation');
    else
      break_interval_provenance :=
        break_interval_provenance || jsonb_build_array('accommodation');
    end if;
    required_break_interval_minutes := accommodation_break_interval;
  end if;
  if safety.required_break_interval_minutes is not null
     and safety.required_break_interval_minutes <= required_break_interval_minutes then
    if safety.required_break_interval_minutes < required_break_interval_minutes then
      break_interval_provenance := jsonb_build_array('safety');
    else
      break_interval_provenance :=
        break_interval_provenance || jsonb_build_array('safety');
    end if;
    required_break_interval_minutes := safety.required_break_interval_minutes;
  end if;

  if coalesce(accommodation_timer_hidden, false) then
    timer_mode := 'hidden';
    timer_provenance := jsonb_build_array('accommodation');
  elsif coalesce(accommodation_timer_visible, false) then
    timer_mode := 'visible';
    timer_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.timer_visibility in ('visible', 'hidden') then
    timer_mode := safety.timer_visibility;
    timer_provenance := jsonb_build_array('safety');
  end if;

  if coalesce(accommodation_has_reduced_motion, false) then
    reduced_motion := accommodation_reduced_motion;
    reduced_motion_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.reduced_motion is not null then
    reduced_motion := safety.reduced_motion;
    reduced_motion_provenance := jsonb_build_array('safety');
  end if;
  if coalesce(accommodation_has_no_audio, false) then
    no_audio := accommodation_no_audio;
    no_audio_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.no_audio is not null then
    no_audio := safety.no_audio;
    no_audio_provenance := jsonb_build_array('safety');
  end if;
  if coalesce(accommodation_has_large_text, false) then
    large_text := accommodation_large_text;
    large_text_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.large_text is not null then
    large_text := safety.large_text;
    large_text_provenance := jsonb_build_array('safety');
  end if;
  if coalesce(accommodation_has_read_aloud, false) then
    read_aloud := accommodation_read_aloud;
    read_aloud_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.read_aloud is not null then
    read_aloud := safety.read_aloud;
    read_aloud_provenance := jsonb_build_array('safety');
  end if;
  if coalesce(accommodation_has_speech_input, false) then
    speech_input_allowed := accommodation_speech_input;
    speech_input_provenance := jsonb_build_array('accommodation');
  end if;
  if safety.speech_input_allowed is not null then
    speech_input_allowed := safety.speech_input_allowed;
    speech_input_provenance := jsonb_build_array('safety');
  end if;

  return jsonb_build_object(
    'schemaVersion', 2,
    'status', 'ready',
    'studentId', p_student_id,
    'effectiveDate', effective_date_text,
    'settings', jsonb_build_object(
      'timerMode', timer_mode,
      'maximumWorkMinutes', maximum_work_minutes,
      'breakMinimumMinutes', break_minimum_minutes,
      'breakMaximumMinutes', break_maximum_minutes,
      'minimumBreakCount', minimum_break_count,
      'requiredBreakIntervalMinutes', required_break_interval_minutes,
      'reducedMotion', reduced_motion,
      'noAudio', no_audio,
      'largeText', large_text,
      'readAloud', read_aloud,
      'speechInputAllowed', speech_input_allowed
    ),
    'provenance', jsonb_build_object(
      'timerMode', timer_provenance,
      'maximumWorkMinutes', maximum_work_provenance,
      'breakMinimumMinutes', break_minimum_provenance,
      'breakMaximumMinutes', break_maximum_provenance,
      'minimumBreakCount', minimum_break_count_provenance,
      'requiredBreakIntervalMinutes', break_interval_provenance,
      'reducedMotion', reduced_motion_provenance,
      'noAudio', no_audio_provenance,
      'largeText', large_text_provenance,
      'readAloud', read_aloud_provenance,
      'speechInputAllowed', speech_input_provenance
    )
  );
end;
$$;

alter function public.academy_study_effective_settings_v2(uuid, date)
  owner to postgres;
revoke all on function public.academy_study_effective_settings_v2(uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_effective_settings_v2(uuid, date)
  to authenticated;

alter table academy_private.study_persistence_metadata
  add column effective_settings_version smallint not null default 0
    check (effective_settings_version in (0, 2));
update academy_private.study_persistence_metadata
set effective_settings_version = 2,
    migration_names = array_append(
      migration_names,
      '20260810120200_academy_study_effective_settings_v2'
    )
where singleton;

commit;
