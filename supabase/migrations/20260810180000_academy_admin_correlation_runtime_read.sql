-- ADMIN correlation explorer: bounded privacy-minimized runtime read seam.
-- Additive and service-only. This does not expose the operational event table.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Admin correlation runtime read migration must run as postgres';
  end if;
  if to_regclass('public.academy_operational_events') is null
     or to_regprocedure('academy_private.operational_is_trusted_server()') is null
     or to_regprocedure('academy_private.operational_reference_is_valid(text)') is null then
    raise exception 'Admin correlation runtime read requires operational telemetry v2';
  end if;
end;
$$;

create function public.academy_admin_read_incident_runtime_v1(
  p_limit integer default 50,
  p_before_at timestamptz default null,
  p_before_event_id uuid default null,
  p_occurred_from timestamptz default null,
  p_occurred_to timestamptz default null,
  p_correlation_id text default null,
  p_engine text default null,
  p_result text default null,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection jsonb;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_required_capability <> 'engines:read' then
    raise exception 'ADMIN_INCIDENT_RUNTIME_READ_REQUIRED' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or ((p_before_at is null) <> (p_before_event_id is null))
     or p_occurred_from is null or p_occurred_to is null
     or p_occurred_from >= p_occurred_to
     or p_occurred_to - p_occurred_from > interval '90 days'
     or (p_correlation_id is not null and not
       academy_private.operational_reference_is_valid(p_correlation_id))
     or (p_engine is not null and p_engine not in (
       'tutor', 'study', 'assessment', 'curriculum',
       'jarvis', 'tts', 'gateway', 'sync'
     ))
     or (p_result is not null and p_result not in (
       'success', 'fallback', 'rejected', 'timeout', 'provider_error',
       'validation_error', 'safety_stop'
     )) then
    raise exception 'ADMIN_INCIDENT_RUNTIME_QUERY_INVALID' using errcode = '22023';
  end if;

  with bounded as (
    select event.*
    from public.academy_operational_events as event
    where event.expires_at > statement_timestamp()
      and event.occurred_at >= p_occurred_from
      and event.occurred_at < p_occurred_to
      and (p_before_at is null or (event.occurred_at, event.event_id) <
        (p_before_at, p_before_event_id))
      and (p_correlation_id is null or event.execution_key = p_correlation_id)
      and (p_engine is null or event.engine = p_engine)
      and (p_result is null or event.result = p_result)
    order by event.occurred_at desc, event.event_id desc
    limit p_limit + 1
  ), visible as (
    select * from bounded
    order by occurred_at desc, event_id desc
    limit p_limit
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', event_id,
        'execution_key', execution_key,
        'occurred_at', occurred_at,
        'engine', engine,
        'event_type', event_type,
        'result', result,
        'duration_ms', duration_ms,
        'metadata', jsonb_build_object(
          'operation', metadata -> 'operation',
          'reason_code', metadata -> 'reason_code',
          'provider', metadata -> 'provider',
          'http_status', metadata -> 'http_status',
          'failure_stage', metadata -> 'failure_stage',
          'retryable', metadata -> 'retryable'
        )
      ) order by occurred_at desc, event_id desc)
      from visible
    ), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from bounded)
  ) into projection;
  return projection;
end;
$$;

alter function public.academy_admin_read_incident_runtime_v1(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  text, text, text, text
) owner to postgres;

revoke all on function public.academy_admin_read_incident_runtime_v1(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_incident_runtime_v1(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  text, text, text, text
) to service_role;

comment on function public.academy_admin_read_incident_runtime_v1(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  text, text, text, text
) is 'Bounded service-only engines:read incident projection; omits learner identity, context references, raw errors, and unrestricted metadata.';

commit;
