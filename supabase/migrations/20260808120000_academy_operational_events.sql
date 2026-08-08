-- Privacy-minimized operational telemetry foundation for the Admin Console.
-- Additive only. Depends on the Academy identity foundation and intentionally
-- provides no student/browser table write path.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Operational telemetry migration must run as postgres';
  end if;
  if to_regclass('public.academy_households') is null
     or to_regclass('public.academy_students') is null
     or to_regprocedure(
       'public.academy_is_active_household_guardian(uuid)'
     ) is null
     or to_regprocedure(
       'public.academy_has_student_permission(uuid,text)'
     ) is null
     or to_regprocedure('auth.uid()') is null then
    raise exception
      'Operational telemetry requires the Academy identity foundation';
  end if;
end;
$$;

create or replace function academy_private.operational_json_has_exact_keys(
  candidate jsonb,
  expected_keys text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and (
      select count(*) = cardinality(expected_keys)
        and coalesce(bool_and(key = any(expected_keys)), false)
      from jsonb_object_keys(candidate) as key
    );
$$;

create or replace function academy_private.operational_uuid_text_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function academy_private.operational_instant_is_valid(
  candidate text
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if candidate is null
     or candidate !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then
    return false;
  end if;
  return to_char(
    candidate::timestamptz at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) = candidate;
exception
  when others then
    return false;
end;
$$;

create or replace function academy_private.operational_metadata_is_valid(
  target_event_type text,
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if candidate is null
     or jsonb_typeof(candidate) <> 'object'
     or pg_column_size(candidate) > 1024 then
    return false;
  end if;

  case target_event_type
    when 'session.lifecycle' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['phase']::text[]
      ) and candidate->>'phase' in (
        'launched', 'paused', 'resumed', 'completed', 'stopped'
      );
    when 'persistence.operation' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['operation', 'retryable']::text[]
      ) and candidate->>'operation' in (
        'learner-state', 'checkpoint', 'event-ledger', 'sync-state'
      ) and jsonb_typeof(candidate->'retryable') = 'boolean';
    when 'sync.lifecycle' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['phase', 'direction']::text[]
      ) and candidate->>'phase' in (
        'started', 'completed', 'conflict', 'recovered'
      ) and candidate->>'direction' in ('push', 'pull', 'bidirectional');
    when 'safety.decision' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['decision']::text[]
      ) and candidate->>'decision' in ('clear', 'stop', 'uncertain', 'invalid');
    when 'assessment.lifecycle' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['phase']::text[]
      ) and candidate->>'phase' in (
        'started', 'submitted', 'completed', 'abandoned'
      );
    when 'application.lifecycle' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['phase']::text[]
      ) and candidate->>'phase' in (
        'started', 'ready', 'backgrounded', 'stopped'
      );
    when 'infrastructure.health' then
      return academy_private.operational_json_has_exact_keys(
        candidate, array['component', 'state']::text[]
      ) and candidate->>'component' in (
        'database', 'network', 'study-worker', 'sync-worker'
      ) and candidate->>'state' in ('healthy', 'degraded', 'unavailable');
    else
      return false;
  end case;
end;
$$;

create or replace function academy_private.operational_event_scope_is_valid(
  target_event_type text,
  target_engine text,
  target_learner_id uuid
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case target_event_type
    when 'session.lifecycle' then
      target_engine in ('study', 'tutor') and target_learner_id is not null
    when 'persistence.operation' then
      target_engine in (
        'study', 'tutor', 'assessment', 'sync', 'application', 'infrastructure'
      )
    when 'sync.lifecycle' then target_engine = 'sync'
    when 'safety.decision' then
      target_engine in ('study', 'tutor') and target_learner_id is not null
    when 'assessment.lifecycle' then
      target_engine = 'assessment' and target_learner_id is not null
    when 'application.lifecycle' then target_engine = 'application'
    when 'infrastructure.health' then
      target_engine = 'infrastructure' and target_learner_id is null
    else false
  end;
$$;

create or replace function academy_private.operational_is_trusted_server()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select auth.uid() is null
    and coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      case
        when nullif(current_setting('request.jwt.claims', true), '') is null
          then null
        else current_setting('request.jwt.claims', true)::jsonb->>'role'
      end,
      nullif(current_setting('role', true), '')
    ) = 'service_role';
$$;

create table public.academy_operational_events (
  event_id uuid primary key,
  schema_version smallint not null default 1
    constraint academy_operational_events_schema_version_check
      check (schema_version = 1),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  learner_id uuid,
  engine text not null
    constraint academy_operational_events_engine_check check (
      engine in (
        'study', 'tutor', 'assessment', 'sync', 'application', 'infrastructure'
      )
    ),
  engine_version text not null
    constraint academy_operational_events_engine_version_check check (
      engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
    ),
  application_version text
    constraint academy_operational_events_application_version_check check (
      application_version is null
      or application_version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
    ),
  curriculum_version text
    constraint academy_operational_events_curriculum_version_check check (
      curriculum_version is null
      or curriculum_version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
    ),
  course_ref text,
  unit_ref text,
  lesson_ref text,
  skill_ref text,
  event_type text not null
    constraint academy_operational_events_event_type_check check (
      event_type in (
        'session.lifecycle',
        'persistence.operation',
        'sync.lifecycle',
        'safety.decision',
        'assessment.lifecycle',
        'application.lifecycle',
        'infrastructure.health'
      )
    ),
  result text not null
    constraint academy_operational_events_result_check check (
      result in (
        'success', 'failure', 'cancelled', 'rejected', 'timeout',
        'unavailable', 'duplicate'
      )
    ),
  duration_ms bigint
    constraint academy_operational_events_duration_check check (
      duration_ms is null or duration_ms between 0 and 86400000
    ),
  metadata jsonb not null,
  constraint academy_operational_events_learner_household_fk
    foreign key (learner_id, household_id)
    references public.academy_students (id, household_id) on delete restrict,
  constraint academy_operational_events_context_refs_check check (
    (course_ref is null or course_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')
    and (unit_ref is null or unit_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')
    and (lesson_ref is null or lesson_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')
    and (skill_ref is null or skill_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')
    and (
      curriculum_version is not null
      or (
        course_ref is null and unit_ref is null
        and lesson_ref is null and skill_ref is null
      )
    )
  ),
  constraint academy_operational_events_scope_check check (
    academy_private.operational_event_scope_is_valid(
      event_type, engine, learner_id
    )
  ),
  constraint academy_operational_events_metadata_check check (
    academy_private.operational_metadata_is_valid(event_type, metadata)
  )
);

comment on table public.academy_operational_events is
  'Append-only, privacy-minimized operational telemetry. No raw learner content.';
comment on column public.academy_operational_events.metadata is
  'Exact-key typed metadata validated by event_type; never arbitrary content.';

create index academy_operational_events_household_time_idx
  on public.academy_operational_events (household_id, occurred_at desc, event_id);
create index academy_operational_events_learner_time_idx
  on public.academy_operational_events (learner_id, occurred_at desc, event_id)
  where learner_id is not null;
create index academy_operational_events_engine_type_time_idx
  on public.academy_operational_events (
    engine, event_type, occurred_at desc, event_id
  );

alter table public.academy_operational_events enable row level security;
alter table public.academy_operational_events force row level security;

create policy academy_operational_events_guardian_select
  on public.academy_operational_events
  for select
  to authenticated
  using (
    public.academy_is_active_household_guardian(household_id)
    and (
      learner_id is null
      or public.academy_has_student_permission(learner_id, 'viewer')
    )
  );

create or replace function public.academy_record_operational_event_v1(
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_household_id uuid;
  target_learner_id uuid;
  target_duration_ms bigint;
  target_event_id uuid;
begin
  if not academy_private.operational_json_has_exact_keys(
    p_event,
    array[
      'schema_version', 'event_id', 'occurred_at', 'household_id',
      'learner_id', 'engine', 'engine_version', 'application_version',
      'curriculum_version', 'course_ref', 'unit_ref', 'lesson_ref',
      'skill_ref', 'event_type', 'result', 'duration_ms', 'metadata'
    ]::text[]
  )
     or jsonb_typeof(p_event->'schema_version') <> 'number'
     or p_event->>'schema_version' <> '1'
     or not academy_private.operational_uuid_text_is_valid(p_event->>'event_id')
     or not academy_private.operational_instant_is_valid(p_event->>'occurred_at')
     or not academy_private.operational_uuid_text_is_valid(p_event->>'household_id')
     or (
       p_event->'learner_id' <> 'null'::jsonb
       and not academy_private.operational_uuid_text_is_valid(p_event->>'learner_id')
     )
     or p_event->>'engine' not in (
       'study', 'tutor', 'assessment', 'sync', 'application', 'infrastructure'
     )
     or p_event->>'engine_version' !~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
     or (
       p_event->'application_version' <> 'null'::jsonb
       and p_event->>'application_version' !~
         '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
     )
     or (
       p_event->'curriculum_version' <> 'null'::jsonb
       and p_event->>'curriculum_version' !~
         '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'
     )
     or p_event->>'result' not in (
       'success', 'failure', 'cancelled', 'rejected', 'timeout',
       'unavailable', 'duplicate'
     )
     or p_event->>'event_type' not in (
       'session.lifecycle', 'persistence.operation', 'sync.lifecycle',
       'safety.decision', 'assessment.lifecycle', 'application.lifecycle',
       'infrastructure.health'
     )
     or not academy_private.operational_metadata_is_valid(
       p_event->>'event_type', p_event->'metadata'
     ) then
    raise exception 'OPERATIONAL_EVENT_INVALID' using errcode = '22023';
  end if;

  target_household_id := (p_event->>'household_id')::uuid;
  target_event_id := (p_event->>'event_id')::uuid;
  target_learner_id := case
    when p_event->'learner_id' = 'null'::jsonb then null
    else (p_event->>'learner_id')::uuid
  end;

  if not academy_private.operational_event_scope_is_valid(
    p_event->>'event_type', p_event->>'engine', target_learner_id
  ) then
    raise exception 'OPERATIONAL_EVENT_SCOPE_INVALID' using errcode = '22023';
  end if;

  if (
    p_event->'duration_ms' <> 'null'::jsonb
    and (
      jsonb_typeof(p_event->'duration_ms') <> 'number'
      or (p_event->>'duration_ms')::numeric < 0
      or (p_event->>'duration_ms')::numeric > 86400000
      or trunc((p_event->>'duration_ms')::numeric) <>
         (p_event->>'duration_ms')::numeric
    )
  ) then
    raise exception 'OPERATIONAL_EVENT_DURATION_INVALID' using errcode = '22023';
  end if;
  target_duration_ms := case
    when p_event->'duration_ms' = 'null'::jsonb then null
    else (p_event->>'duration_ms')::bigint
  end;

  if (
    p_event->'curriculum_version' = 'null'::jsonb
    and (
      p_event->'course_ref' <> 'null'::jsonb
      or p_event->'unit_ref' <> 'null'::jsonb
      or p_event->'lesson_ref' <> 'null'::jsonb
      or p_event->'skill_ref' <> 'null'::jsonb
    )
  ) then
    raise exception 'OPERATIONAL_EVENT_CONTEXT_INVALID' using errcode = '22023';
  end if;

  if auth.uid() is null then
    if not academy_private.operational_is_trusted_server() then
      raise exception 'OPERATIONAL_TELEMETRY_UNAUTHORIZED' using errcode = '42501';
    end if;
  elsif not public.academy_is_active_household_guardian(target_household_id)
     or (
       target_learner_id is not null
       and not public.academy_has_student_permission(target_learner_id, 'viewer')
     ) then
    raise exception 'OPERATIONAL_TELEMETRY_UNAUTHORIZED' using errcode = '42501';
  end if;

  insert into public.academy_operational_events (
    event_id,
    schema_version,
    occurred_at,
    household_id,
    learner_id,
    engine,
    engine_version,
    application_version,
    curriculum_version,
    course_ref,
    unit_ref,
    lesson_ref,
    skill_ref,
    event_type,
    result,
    duration_ms,
    metadata
  ) values (
    target_event_id,
    1,
    (p_event->>'occurred_at')::timestamptz,
    target_household_id,
    target_learner_id,
    p_event->>'engine',
    p_event->>'engine_version',
    nullif(p_event->>'application_version', ''),
    nullif(p_event->>'curriculum_version', ''),
    nullif(p_event->>'course_ref', ''),
    nullif(p_event->>'unit_ref', ''),
    nullif(p_event->>'lesson_ref', ''),
    nullif(p_event->>'skill_ref', ''),
    p_event->>'event_type',
    p_event->>'result',
    target_duration_ms,
    p_event->'metadata'
  );

  return jsonb_build_object('status', 'recorded', 'eventId', target_event_id);
end;
$$;

create or replace function public.academy_list_operational_events_v1(
  p_household_id uuid,
  p_learner_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if p_household_id is null
     or p_limit is null
     or p_limit < 1
     or p_limit > 500 then
    raise exception 'OPERATIONAL_TELEMETRY_READ_INVALID' using errcode = '22023';
  end if;

  if auth.uid() is null then
    if not academy_private.operational_is_trusted_server() then
      raise exception 'OPERATIONAL_TELEMETRY_UNAUTHORIZED' using errcode = '42501';
    end if;
  elsif not public.academy_is_active_household_guardian(p_household_id)
     or (
       p_learner_id is not null
       and not public.academy_has_student_permission(p_learner_id, 'viewer')
     ) then
    raise exception 'OPERATIONAL_TELEMETRY_UNAUTHORIZED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row.event order by row.occurred_at desc, row.event_id), '[]'::jsonb)
  into result
  from (
    select
      event.occurred_at,
      event.event_id,
      jsonb_build_object(
        'schemaVersion', event.schema_version,
        'eventId', event.event_id,
        'occurredAt', to_char(
          event.occurred_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'householdRef', event.household_id,
        'learnerRef', event.learner_id,
        'engine', event.engine,
        'engineVersion', event.engine_version,
        'applicationVersion', event.application_version,
        'curriculumVersion', event.curriculum_version,
        'courseRef', event.course_ref,
        'unitRef', event.unit_ref,
        'lessonRef', event.lesson_ref,
        'skillRef', event.skill_ref,
        'eventType', event.event_type,
        'result', event.result,
        'durationMs', event.duration_ms,
        'metadata', event.metadata
      ) as event
    from public.academy_operational_events as event
    where event.household_id = p_household_id
      and (p_learner_id is null or event.learner_id = p_learner_id)
      and (
        auth.uid() is null
        or event.learner_id is null
        or public.academy_has_student_permission(event.learner_id, 'viewer')
      )
    order by event.occurred_at desc, event.event_id
    limit p_limit
  ) as row;

  return result;
end;
$$;

revoke all on table public.academy_operational_events
  from public, anon, authenticated, service_role;
grant select on table public.academy_operational_events to service_role;

revoke all on function academy_private.operational_json_has_exact_keys(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_uuid_text_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_instant_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_metadata_is_valid(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_event_scope_is_valid(text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_is_trusted_server()
  from public, anon, authenticated, service_role;

revoke all on function public.academy_record_operational_event_v1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_record_operational_event_v1(jsonb)
  to authenticated, service_role;

revoke all on function public.academy_list_operational_events_v1(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_list_operational_events_v1(uuid, uuid, integer)
  to authenticated, service_role;

commit;
