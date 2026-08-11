-- TEL-FOUNDATION: bounded, retention-aware operational telemetry aggregation.
-- Additive only; depends on 20260808123000_academy_admin_safety_operations.sql.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Operational telemetry foundation migration must run as postgres';
  end if;
  if to_regclass('public.academy_operational_events') is null
     or to_regprocedure('academy_private.operational_is_trusted_server()') is null
     or to_regprocedure('academy_private.operational_retention_days(text)') is null then
    raise exception
      'Operational telemetry foundation requires the ADMIN-2 operational ledger';
  end if;
end;
$$;

create index academy_operational_events_aggregate_time_idx
  on public.academy_operational_events (occurred_at, engine, event_type);

create or replace function public.academy_aggregate_operational_events_v2(
  p_start timestamptz,
  p_end timestamptz,
  p_engine text default null,
  p_engine_version text default null,
  p_course_ref text default null,
  p_unit_ref text default null,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  reference_time timestamptz := statement_timestamp();
  maximum_groups constant integer := 4096;
  detected_groups integer;
  total_events bigint;
  aggregate_groups jsonb;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_required_capability is null
     or p_required_capability not in ('engines:read', 'health:read') then
    raise exception 'OPERATIONAL_TELEMETRY_ADMIN_AGGREGATE_REQUIRED'
      using errcode = '42501';
  end if;

  if p_start is null
     or p_end is null
     or p_start >= p_end
     or p_end > reference_time + interval '5 minutes'
     or p_end - p_start > interval '366 days'
     or (p_engine is not null and p_engine not in (
       'tutor', 'study', 'assessment', 'curriculum',
       'jarvis', 'tts', 'gateway', 'sync'
     ))
     or (
       p_engine_version is not null
       and not academy_private.operational_version_is_valid(p_engine_version)
     )
     or (
       p_course_ref is not null
       and not academy_private.operational_reference_is_valid(p_course_ref)
     )
     or (
       p_unit_ref is not null
       and not academy_private.operational_reference_is_valid(p_unit_ref)
     ) then
    raise exception 'OPERATIONAL_TELEMETRY_AGGREGATE_RANGE_INVALID'
      using errcode = '22023';
  end if;

  select count(*)::integer into detected_groups
  from (
    select 1
    from public.academy_operational_events as event
    where event.occurred_at >= p_start
      and event.occurred_at < p_end
      and event.expires_at > reference_time
      and (p_engine is null or event.engine = p_engine)
      and (p_engine_version is null or event.engine_version = p_engine_version)
      and (p_course_ref is null or event.course_ref = p_course_ref)
      and (p_unit_ref is null or event.unit_ref = p_unit_ref)
    group by
      event.retention_category,
      event.engine,
      event.app_version,
      event.engine_version,
      event.curriculum_version,
      event.course_ref,
      event.unit_ref,
      event.event_type,
      event.result,
      event.metadata ->> 'operation',
      event.metadata ->> 'reason_code',
      event.metadata ->> 'provider',
      event.metadata ->> 'route'
    limit maximum_groups + 1
  ) as bounded_groups;

  if detected_groups > maximum_groups then
    raise exception 'OPERATIONAL_TELEMETRY_AGGREGATE_GROUP_LIMIT'
      using errcode = '54000';
  end if;

  select
    coalesce(sum(grouped.event_count), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'retentionCategory', grouped.retention_category,
          'engine', grouped.engine,
          'appVersion', grouped.app_version,
          'engineVersion', grouped.engine_version,
          'curriculumVersion', grouped.curriculum_version,
          'courseRef', grouped.course_ref,
          'unitRef', grouped.unit_ref,
          'eventType', grouped.event_type,
          'result', grouped.result,
          'operation', grouped.operation,
          'reasonCode', grouped.reason_code,
          'provider', grouped.provider,
          'route', grouped.route,
          'eventCount', grouped.event_count,
          'durationCount', grouped.duration_count,
          'durationTotalMs', grouped.duration_total_ms,
          'durationP50Ms', grouped.duration_p50_ms,
          'durationP95Ms', grouped.duration_p95_ms,
          'firstOccurredAt', grouped.first_occurred_at,
          'lastOccurredAt', grouped.last_occurred_at
        )
        order by
          grouped.engine,
          grouped.event_type,
          grouped.result,
          grouped.engine_version,
          grouped.operation,
          grouped.reason_code,
          grouped.provider,
          grouped.route,
          grouped.course_ref,
          grouped.unit_ref,
          grouped.retention_category
      ),
      '[]'::jsonb
    )
  into total_events, aggregate_groups
  from (
    select
      event.retention_category,
      event.engine,
      event.app_version,
      event.engine_version,
      event.curriculum_version,
      event.course_ref,
      event.unit_ref,
      event.event_type,
      event.result,
      event.metadata ->> 'operation' as operation,
      event.metadata ->> 'reason_code' as reason_code,
      event.metadata ->> 'provider' as provider,
      event.metadata ->> 'route' as route,
      count(*)::bigint as event_count,
      count(event.duration_ms)::bigint as duration_count,
      coalesce(sum(event.duration_ms), 0)::bigint as duration_total_ms,
      percentile_disc(0.50) within group (order by event.duration_ms)
        filter (where event.duration_ms is not null) as duration_p50_ms,
      percentile_disc(0.95) within group (order by event.duration_ms)
        filter (where event.duration_ms is not null) as duration_p95_ms,
      min(event.occurred_at) as first_occurred_at,
      max(event.occurred_at) as last_occurred_at
    from public.academy_operational_events as event
    where event.occurred_at >= p_start
      and event.occurred_at < p_end
      and event.expires_at > reference_time
      and (p_engine is null or event.engine = p_engine)
      and (p_engine_version is null or event.engine_version = p_engine_version)
      and (p_course_ref is null or event.course_ref = p_course_ref)
      and (p_unit_ref is null or event.unit_ref = p_unit_ref)
    group by
      event.retention_category,
      event.engine,
      event.app_version,
      event.engine_version,
      event.curriculum_version,
      event.course_ref,
      event.unit_ref,
      event.event_type,
      event.result,
      event.metadata ->> 'operation',
      event.metadata ->> 'reason_code',
      event.metadata ->> 'provider',
      event.metadata ->> 'route'
  ) as grouped;

  return jsonb_build_object(
    'schemaVersion', 2,
    'range', jsonb_build_object(
      'start', p_start,
      'endExclusive', p_end,
      'maximumDays', 366
    ),
    'filters', jsonb_build_object(
      'engine', p_engine,
      'engineVersion', p_engine_version,
      'courseRef', p_course_ref,
      'unitRef', p_unit_ref
    ),
    'completeness', jsonb_build_object(
      'grouping', 'complete',
      'groupCount', detected_groups,
      'groupLimit', maximum_groups,
      'allRetentionClasses',
        p_start > reference_time - interval '30 days',
      'retentionClasses', jsonb_build_array(
        jsonb_build_object(
          'category', 'diagnostic_short',
          'retainedDays', 30,
          'complete', p_start > reference_time - interval '30 days'
        ),
        jsonb_build_object(
          'category', 'operational_standard',
          'retainedDays', 90,
          'complete', p_start > reference_time - interval '90 days'
        ),
        jsonb_build_object(
          'category', 'safety_extended',
          'retainedDays', 365,
          'complete', p_start > reference_time - interval '365 days'
        )
      )
    ),
    'totalEventCount', total_events,
    'groups', aggregate_groups
  );
end;
$$;

comment on function public.academy_aggregate_operational_events_v2(
  timestamptz, timestamptz, text, text, text, text, text
) is
  'Service-only bounded ADMIN aggregate; returns complete grouped facts, never raw events or identities.';

revoke all on function public.academy_aggregate_operational_events_v2(
  timestamptz, timestamptz, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_aggregate_operational_events_v2(
  timestamptz, timestamptz, text, text, text, text, text
) to service_role;

commit;
