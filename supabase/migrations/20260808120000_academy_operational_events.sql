-- ADMIN-2-R1: privacy-minimized operational telemetry, ADMIN contract v2.
-- Additive only. This timestamp remains intentionally unchanged; the shared
-- ADMIN migration-version collision is resolved only by the integrator.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Operational telemetry migration must run as postgres';
  end if;
  if to_regclass('public.academy_households') is null
     or to_regclass('public.academy_students') is null
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

create or replace function academy_private.operational_version_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$';
$$;

create or replace function academy_private.operational_reference_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$';
$$;

create or replace function academy_private.operational_token_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    and candidate !~* '(^|[._:-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:-]|$)';
$$;

create or replace function academy_private.operational_metadata_is_valid(
  candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item record;
  numeric_value numeric;
begin
  if candidate is null
     or jsonb_typeof(candidate) <> 'object'
     or octet_length(candidate::text) > 2048 then
    return false;
  end if;

  for item in select key, value from jsonb_each(candidate)
  loop
    if item.key not in (
      'attempt', 'cache_hit', 'failure_stage', 'feature_flag',
      'http_status', 'operation', 'provider', 'reason_code', 'retryable',
      'route', 'severity', 'source', 'voice_ref'
    ) then
      return false;
    end if;

    if item.value = 'null'::jsonb then
      continue;
    elsif item.key in ('attempt', 'http_status') then
      if jsonb_typeof(item.value) <> 'number' then return false; end if;
      numeric_value := (item.value #>> '{}')::numeric;
      if numeric_value <> trunc(numeric_value)
         or numeric_value < 0
         or numeric_value > 9007199254740991
         or (
           item.key = 'http_status'
           and (numeric_value < 100 or numeric_value > 599)
         ) then
        return false;
      end if;
    elsif item.key in ('cache_hit', 'retryable') then
      if jsonb_typeof(item.value) <> 'boolean' then return false; end if;
    else
      if jsonb_typeof(item.value) <> 'string'
         or not academy_private.operational_token_is_valid(item.value #>> '{}')
         or (
           item.key = 'severity'
           and item.value #>> '{}' not in ('info', 'warning', 'error', 'critical')
         ) then
        return false;
      end if;
    end if;
  end loop;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function academy_private.operational_event_engine_is_valid(
  target_event_type text,
  target_engine text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case target_event_type
    when 'tutor.turn' then target_engine = 'tutor'
    when 'study.session' then target_engine = 'study'
    when 'assessment.attempt' then target_engine = 'assessment'
    when 'curriculum.load' then target_engine = 'curriculum'
    when 'jarvis.turn' then target_engine = 'jarvis'
    when 'tts.synthesis' then target_engine = 'tts'
    when 'gateway.request' then target_engine = 'gateway'
    when 'sync.operation' then target_engine = 'sync'
    when 'safety.classification' then
      target_engine in ('tutor', 'study', 'assessment', 'jarvis', 'gateway')
    when 'persistence.operation' then target_engine in (
      'tutor', 'study', 'assessment', 'curriculum',
      'jarvis', 'tts', 'gateway', 'sync'
    )
    else false
  end;
$$;

create or replace function academy_private.operational_scope_is_valid(
  target_scope text,
  target_household_id uuid,
  target_learner_id uuid
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case target_scope
    when 'household' then target_household_id is not null
    when 'system' then target_household_id is null and target_learner_id is null
    else false
  end;
$$;

create or replace function academy_private.operational_retention_category(
  target_event_type text,
  target_result text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when target_event_type = 'safety.classification'
      or target_result = 'safety_stop' then 'safety_extended'
    when target_result <> 'success'
      or target_event_type in (
        'gateway.request', 'sync.operation', 'persistence.operation'
      ) then 'operational_standard'
    else 'diagnostic_short'
  end;
$$;

create or replace function academy_private.operational_retention_days(
  target_category text
)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case target_category
    when 'diagnostic_short' then 30
    when 'operational_standard' then 90
    when 'safety_extended' then 365
    else null
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
  execution_key text not null unique
    constraint academy_operational_events_execution_key_check check (
      academy_private.operational_reference_is_valid(execution_key)
    ),
  schema_version smallint not null default 2
    constraint academy_operational_events_schema_version_check check (
      schema_version = 2
    ),
  occurred_at timestamptz not null,
  scope text not null
    constraint academy_operational_events_scope_name_check check (
      scope in ('household', 'system')
    ),
  household_id uuid references public.academy_households (id) on delete restrict,
  learner_id uuid,
  engine text not null
    constraint academy_operational_events_engine_check check (
      engine in (
        'tutor', 'study', 'assessment', 'curriculum',
        'jarvis', 'tts', 'gateway', 'sync'
      )
    ),
  app_version text not null
    constraint academy_operational_events_app_version_check check (
      academy_private.operational_version_is_valid(app_version)
    ),
  engine_version text not null
    constraint academy_operational_events_engine_version_check check (
      academy_private.operational_version_is_valid(engine_version)
    ),
  curriculum_version text
    constraint academy_operational_events_curriculum_version_check check (
      curriculum_version is null
      or academy_private.operational_version_is_valid(curriculum_version)
    ),
  course_ref text,
  unit_ref text,
  lesson_ref text,
  skill_ref text,
  event_type text not null
    constraint academy_operational_events_event_type_check check (
      event_type in (
        'tutor.turn', 'study.session', 'assessment.attempt',
        'curriculum.load', 'jarvis.turn', 'tts.synthesis',
        'gateway.request', 'sync.operation', 'safety.classification',
        'persistence.operation'
      )
    ),
  result text not null
    constraint academy_operational_events_result_check check (
      result in (
        'success', 'fallback', 'rejected', 'timeout', 'provider_error',
        'validation_error', 'safety_stop'
      )
    ),
  duration_ms bigint
    constraint academy_operational_events_duration_check check (
      duration_ms is null or duration_ms between 0 and 86400000
    ),
  metadata jsonb not null default '{}'::jsonb,
  retention_category text not null,
  expires_at timestamptz not null,
  constraint academy_operational_events_learner_household_fk
    foreign key (learner_id, household_id)
    references public.academy_students (id, household_id) on delete restrict,
  constraint academy_operational_events_scope_check check (
    academy_private.operational_scope_is_valid(scope, household_id, learner_id)
  ),
  constraint academy_operational_events_context_refs_check check (
    (course_ref is null or academy_private.operational_reference_is_valid(course_ref))
    and (unit_ref is null or academy_private.operational_reference_is_valid(unit_ref))
    and (lesson_ref is null or academy_private.operational_reference_is_valid(lesson_ref))
    and (skill_ref is null or academy_private.operational_reference_is_valid(skill_ref))
    and (
      curriculum_version is not null
      or (
        course_ref is null and unit_ref is null
        and lesson_ref is null and skill_ref is null
      )
    )
  ),
  constraint academy_operational_events_curriculum_load_check check (
    event_type <> 'curriculum.load' or curriculum_version is not null
  ),
  constraint academy_operational_events_event_engine_check check (
    academy_private.operational_event_engine_is_valid(event_type, engine)
  ),
  constraint academy_operational_events_metadata_check check (
    academy_private.operational_metadata_is_valid(metadata)
  ),
  constraint academy_operational_events_retention_check check (
    retention_category = academy_private.operational_retention_category(
      event_type, result
    )
    and expires_at = occurred_at + make_interval(
      days => academy_private.operational_retention_days(retention_category)
    )
  )
);

comment on table public.academy_operational_events is
  'ADMIN contract v2 operational projection; append-only until declared expiry.';
comment on column public.academy_operational_events.metadata is
  'Flat canonical 2 KiB metadata; no learner content, secrets, or arbitrary JSON.';
comment on column public.academy_operational_events.execution_key is
  'Trusted idempotency key; never used as durable event identity.';

create index academy_operational_events_scope_time_idx
  on public.academy_operational_events (scope, occurred_at desc, event_id);
create index academy_operational_events_household_time_idx
  on public.academy_operational_events (household_id, occurred_at desc, event_id)
  where household_id is not null;
create index academy_operational_events_learner_time_idx
  on public.academy_operational_events (learner_id, occurred_at desc, event_id)
  where learner_id is not null;
create index academy_operational_events_engine_type_time_idx
  on public.academy_operational_events (
    engine, event_type, occurred_at desc, event_id
  );
create index academy_operational_events_expiry_idx
  on public.academy_operational_events (expires_at, event_id);

alter table public.academy_operational_events enable row level security;
alter table public.academy_operational_events force row level security;

create or replace function academy_private.operational_event_json(
  event public.academy_operational_events
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'schemaVersion', event.schema_version,
    'eventId', event.event_id,
    'occurredAt', to_char(
      event.occurred_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'scope', event.scope,
    'householdRef', event.household_id,
    'learnerRef', event.learner_id,
    'engine', event.engine,
    'appVersion', event.app_version,
    'engineVersion', event.engine_version,
    'curriculumVersion', event.curriculum_version,
    'courseRef', event.course_ref,
    'unitRef', event.unit_ref,
    'lessonRef', event.lesson_ref,
    'skillRef', event.skill_ref,
    'eventType', event.event_type,
    'result', event.result,
    'durationMs', event.duration_ms,
    'metadata', event.metadata
  );
$$;

create or replace function public.academy_record_operational_event_v2(
  p_execution_key text,
  p_facts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_scope text;
  target_household_id uuid;
  target_learner_id uuid;
  target_engine text;
  target_app_version text;
  target_engine_version text;
  target_curriculum_version text;
  target_course_ref text;
  target_unit_ref text;
  target_lesson_ref text;
  target_skill_ref text;
  target_event_type text;
  target_result text;
  target_duration_ms bigint;
  target_metadata jsonb;
  target_retention_category text;
  accepted_at timestamptz;
  existing public.academy_operational_events%rowtype;
  inserted public.academy_operational_events%rowtype;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'OPERATIONAL_TELEMETRY_TRUSTED_SERVER_REQUIRED'
      using errcode = '42501';
  end if;
  if not academy_private.operational_reference_is_valid(p_execution_key)
     or not academy_private.operational_json_has_exact_keys(
       p_facts,
       array[
         'schema_version', 'scope', 'household_id', 'learner_id', 'engine',
         'app_version', 'engine_version', 'curriculum_version', 'course_ref',
         'unit_ref', 'lesson_ref', 'skill_ref', 'event_type', 'result',
         'duration_ms', 'metadata'
       ]::text[]
     )
     or jsonb_typeof(p_facts->'schema_version') <> 'number'
     or p_facts->>'schema_version' <> '2'
     or p_facts->>'scope' not in ('household', 'system')
     or p_facts->>'engine' not in (
       'tutor', 'study', 'assessment', 'curriculum',
       'jarvis', 'tts', 'gateway', 'sync'
     )
     or p_facts->>'event_type' not in (
       'tutor.turn', 'study.session', 'assessment.attempt',
       'curriculum.load', 'jarvis.turn', 'tts.synthesis',
       'gateway.request', 'sync.operation', 'safety.classification',
       'persistence.operation'
     )
     or p_facts->>'result' not in (
       'success', 'fallback', 'rejected', 'timeout', 'provider_error',
       'validation_error', 'safety_stop'
     )
     or not academy_private.operational_version_is_valid(
       p_facts->>'app_version'
     )
     or not academy_private.operational_version_is_valid(
       p_facts->>'engine_version'
     )
     or not academy_private.operational_metadata_is_valid(p_facts->'metadata') then
    raise exception 'OPERATIONAL_EVENT_INVALID' using errcode = '22023';
  end if;

  target_scope := p_facts->>'scope';
  target_household_id := case
    when p_facts->'household_id' = 'null'::jsonb then null
    when academy_private.operational_uuid_text_is_valid(p_facts->>'household_id')
      then (p_facts->>'household_id')::uuid
    else null
  end;
  target_learner_id := case
    when p_facts->'learner_id' = 'null'::jsonb then null
    when academy_private.operational_uuid_text_is_valid(p_facts->>'learner_id')
      then (p_facts->>'learner_id')::uuid
    else null
  end;
  if not academy_private.operational_scope_is_valid(
    target_scope, target_household_id, target_learner_id
  ) or (
    p_facts->'household_id' <> 'null'::jsonb and target_household_id is null
  ) or (
    p_facts->'learner_id' <> 'null'::jsonb and target_learner_id is null
  ) then
    raise exception 'OPERATIONAL_EVENT_SCOPE_INVALID' using errcode = '22023';
  end if;

  target_engine := p_facts->>'engine';
  target_app_version := p_facts->>'app_version';
  target_engine_version := p_facts->>'engine_version';
  target_curriculum_version := case
    when p_facts->'curriculum_version' = 'null'::jsonb then null
    when academy_private.operational_version_is_valid(
      p_facts->>'curriculum_version'
    ) then p_facts->>'curriculum_version'
    else null
  end;
  target_course_ref := case
    when p_facts->'course_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'course_ref')
      then p_facts->>'course_ref'
    else null
  end;
  target_unit_ref := case
    when p_facts->'unit_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'unit_ref')
      then p_facts->>'unit_ref'
    else null
  end;
  target_lesson_ref := case
    when p_facts->'lesson_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'lesson_ref')
      then p_facts->>'lesson_ref'
    else null
  end;
  target_skill_ref := case
    when p_facts->'skill_ref' = 'null'::jsonb then null
    when academy_private.operational_reference_is_valid(p_facts->>'skill_ref')
      then p_facts->>'skill_ref'
    else null
  end;
  if (
    p_facts->'curriculum_version' <> 'null'::jsonb
    and target_curriculum_version is null
  ) or (
    p_facts->'course_ref' <> 'null'::jsonb and target_course_ref is null
  ) or (
    p_facts->'unit_ref' <> 'null'::jsonb and target_unit_ref is null
  ) or (
    p_facts->'lesson_ref' <> 'null'::jsonb and target_lesson_ref is null
  ) or (
    p_facts->'skill_ref' <> 'null'::jsonb and target_skill_ref is null
  ) or (
    target_curriculum_version is null
    and (
      target_course_ref is not null or target_unit_ref is not null
      or target_lesson_ref is not null or target_skill_ref is not null
    )
  ) then
    raise exception 'OPERATIONAL_EVENT_CONTEXT_INVALID' using errcode = '22023';
  end if;

  target_event_type := p_facts->>'event_type';
  target_result := p_facts->>'result';
  if not academy_private.operational_event_engine_is_valid(
    target_event_type, target_engine
  ) or (
    target_event_type = 'curriculum.load' and target_curriculum_version is null
  ) then
    raise exception 'OPERATIONAL_EVENT_ENGINE_INVALID' using errcode = '22023';
  end if;

  if p_facts->'duration_ms' = 'null'::jsonb then
    target_duration_ms := null;
  elsif jsonb_typeof(p_facts->'duration_ms') = 'number'
    and (p_facts->>'duration_ms')::numeric = trunc(
      (p_facts->>'duration_ms')::numeric
    )
    and (p_facts->>'duration_ms')::numeric between 0 and 86400000 then
    target_duration_ms := (p_facts->>'duration_ms')::bigint;
  else
    raise exception 'OPERATIONAL_EVENT_DURATION_INVALID' using errcode = '22023';
  end if;
  target_metadata := p_facts->'metadata';

  if target_scope = 'household' and not exists (
    select 1
    from public.academy_households as household
    where household.id = target_household_id
      and household.status = 'active'
  ) then
    raise exception 'OPERATIONAL_EVENT_HOUSEHOLD_INVALID' using errcode = '22023';
  end if;
  if target_learner_id is not null and not exists (
    select 1
    from public.academy_students as student
    where student.id = target_learner_id
      and student.household_id = target_household_id
      and student.status = 'active'
  ) then
    raise exception 'OPERATIONAL_EVENT_LEARNER_INVALID' using errcode = '22023';
  end if;

  select * into existing
  from public.academy_operational_events
  where execution_key = p_execution_key;
  if existing.event_id is not null then
    if existing.schema_version = 2
       and existing.scope = target_scope
       and existing.household_id is not distinct from target_household_id
       and existing.learner_id is not distinct from target_learner_id
       and existing.engine = target_engine
       and existing.app_version = target_app_version
       and existing.engine_version = target_engine_version
       and existing.curriculum_version is not distinct from target_curriculum_version
       and existing.course_ref is not distinct from target_course_ref
       and existing.unit_ref is not distinct from target_unit_ref
       and existing.lesson_ref is not distinct from target_lesson_ref
       and existing.skill_ref is not distinct from target_skill_ref
       and existing.event_type = target_event_type
       and existing.result = target_result
       and existing.duration_ms is not distinct from target_duration_ms
       and existing.metadata = target_metadata then
      return jsonb_build_object(
        'status', 'replayed',
        'event', academy_private.operational_event_json(existing)
      );
    end if;
    return jsonb_build_object('status', 'reconciliation_conflict');
  end if;

  accepted_at := clock_timestamp();
  target_retention_category := academy_private.operational_retention_category(
    target_event_type, target_result
  );
  insert into public.academy_operational_events (
    event_id, execution_key, schema_version, occurred_at, scope,
    household_id, learner_id, engine, app_version, engine_version,
    curriculum_version, course_ref, unit_ref, lesson_ref, skill_ref,
    event_type, result, duration_ms, metadata, retention_category, expires_at
  ) values (
    gen_random_uuid(), p_execution_key, 2, accepted_at, target_scope,
    target_household_id, target_learner_id, target_engine,
    target_app_version, target_engine_version, target_curriculum_version,
    target_course_ref, target_unit_ref, target_lesson_ref, target_skill_ref,
    target_event_type, target_result, target_duration_ms, target_metadata,
    target_retention_category,
    accepted_at + make_interval(
      days => academy_private.operational_retention_days(
        target_retention_category
      )
    )
  )
  on conflict (execution_key) do nothing
  returning * into inserted;

  if inserted.event_id is not null then
    return jsonb_build_object(
      'status', 'created',
      'event', academy_private.operational_event_json(inserted)
    );
  end if;

  select * into existing
  from public.academy_operational_events
  where execution_key = p_execution_key;
  if existing.scope = target_scope
     and existing.household_id is not distinct from target_household_id
     and existing.learner_id is not distinct from target_learner_id
     and existing.engine = target_engine
     and existing.app_version = target_app_version
     and existing.engine_version = target_engine_version
     and existing.curriculum_version is not distinct from target_curriculum_version
     and existing.course_ref is not distinct from target_course_ref
     and existing.unit_ref is not distinct from target_unit_ref
     and existing.lesson_ref is not distinct from target_lesson_ref
     and existing.skill_ref is not distinct from target_skill_ref
     and existing.event_type = target_event_type
     and existing.result = target_result
     and existing.duration_ms is not distinct from target_duration_ms
     and existing.metadata = target_metadata then
    return jsonb_build_object(
      'status', 'replayed',
      'event', academy_private.operational_event_json(existing)
    );
  end if;
  return jsonb_build_object('status', 'reconciliation_conflict');
end;
$$;

create or replace function public.academy_list_operational_events_v2(
  p_scope text default null,
  p_household_id uuid default null,
  p_learner_id uuid default null,
  p_limit integer default 100,
  p_required_capability text default null
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
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_required_capability <> 'engines:read' then
    raise exception 'OPERATIONAL_TELEMETRY_ADMIN_READ_REQUIRED'
      using errcode = '42501';
  end if;
  if (p_scope is not null and p_scope not in ('household', 'system'))
     or p_limit is null or p_limit < 1 or p_limit > 500
     or (p_scope = 'system' and (p_household_id is not null or p_learner_id is not null))
     or (p_learner_id is not null and p_household_id is null) then
    raise exception 'OPERATIONAL_TELEMETRY_READ_INVALID' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(row.event order by row.occurred_at desc, row.event_id),
    '[]'::jsonb
  ) into result
  from (
    select
      event.occurred_at,
      event.event_id,
      academy_private.operational_event_json(event) as event
    from public.academy_operational_events as event
    where (p_scope is null or event.scope = p_scope)
      and (p_household_id is null or event.household_id = p_household_id)
      and (p_learner_id is null or event.learner_id = p_learner_id)
    order by event.occurred_at desc, event.event_id
    limit p_limit
  ) as row;
  return result;
end;
$$;

create or replace function public.academy_purge_expired_operational_events_v2(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  purged integer;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server() then
    raise exception 'OPERATIONAL_TELEMETRY_TRUSTED_SERVER_REQUIRED'
      using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'OPERATIONAL_TELEMETRY_PURGE_INVALID' using errcode = '22023';
  end if;
  with expired as (
    select event_id
    from public.academy_operational_events
    where expires_at <= clock_timestamp()
    order by expires_at, event_id
    limit p_limit
    for update skip locked
  )
  delete from public.academy_operational_events as event
  using expired
  where event.event_id = expired.event_id;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on table public.academy_operational_events
  from public, anon, authenticated, service_role;

revoke all on function academy_private.operational_json_has_exact_keys(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_uuid_text_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_version_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_reference_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_token_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_metadata_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_event_engine_is_valid(text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_scope_is_valid(text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_retention_category(text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_retention_days(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_is_trusted_server()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.operational_event_json(
  public.academy_operational_events
) from public, anon, authenticated, service_role;

revoke all on function public.academy_record_operational_event_v2(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_record_operational_event_v2(text, jsonb)
  to service_role;

revoke all on function public.academy_list_operational_events_v2(
  text, uuid, uuid, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_list_operational_events_v2(
  text, uuid, uuid, integer, text
) to service_role;

revoke all on function public.academy_purge_expired_operational_events_v2(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_purge_expired_operational_events_v2(integer)
  to service_role;

commit;
