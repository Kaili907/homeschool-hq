-- ADMIN-10B: authorized, read-only Safety Operations projection.
-- Reuses existing durable evidence; creates no safety ledger or mutation path.

begin;

create or replace function public.academy_admin_read_safety_operations_v1(
  p_limit integer default 51,
  p_before_at timestamptz default null,
  p_before_ref text default null,
  p_household_id uuid default null,
  p_learner_id uuid default null,
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
     or p_required_capability <> 'safety:read' then
    raise exception 'ADMIN_SAFETY_READ_REQUIRED' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 101
     or ((p_before_at is null) <> (p_before_ref is null))
     or (p_before_ref is not null and (
       length(p_before_ref) > 128
       or p_before_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
     ))
     or (p_learner_id is not null and p_household_id is null) then
    raise exception 'ADMIN_SAFETY_READ_INVALID' using errcode = '22023';
  end if;
  if p_learner_id is not null and not exists (
    select 1
    from public.academy_students as student
    where student.id = p_learner_id
      and student.household_id = p_household_id
  ) then
    raise exception 'ADMIN_SAFETY_SCOPE_INVALID' using errcode = '22023';
  end if;

  with operational_rows as (
    select
      event.occurred_at,
      'operational:' || event.event_id::text as event_ref,
      jsonb_build_object(
        'schemaVersion', 1,
        'eventRef', 'operational:' || event.event_id::text,
        'source', 'operational-telemetry',
        'learner', case when event.learner_id is null then null else jsonb_build_object(
          'reference', event.learner_id::text,
          'displayName', student.display_name
        ) end,
        'occurredAt', to_char(event.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'engine', event.engine,
        'versionSnapshot', jsonb_build_object(
          'appVersion', event.app_version,
          'engineVersion', event.engine_version,
          'curriculumVersion', event.curriculum_version
        ),
        'evidenceCategory', 'safety-stop',
        'reasonCode', coalesce(event.metadata ->> 'reason_code', 'unknown-safety-condition'),
        'state', 'unknown',
        'resolution', jsonb_build_object('state', 'unknown'),
        'history', '[]'::jsonb
      ) - case when event.learner_id is null then 'learner' else '' end as event
    from public.academy_operational_events as event
    left join public.academy_students as student on student.id = event.learner_id
    where event.result = 'safety_stop'
      and (p_household_id is null or event.household_id = p_household_id)
      and (p_learner_id is null or event.learner_id = p_learner_id)
  ),
  adult_review_rows as (
    select
      proposal.occurred_at,
      'adult-review:' || proposal.proposal_id as event_ref,
      jsonb_build_object(
        'schemaVersion', 1,
        'eventRef', 'adult-review:' || proposal.proposal_id,
        'source', 'study-adult-review',
        'learner', jsonb_build_object(
          'reference', proposal.student_id::text,
          'displayName', student.display_name
        ),
        'occurredAt', to_char(proposal.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'engine', 'study',
        'evidenceCategory', 'adult-review',
        'reasonCode', proposal.reason_codes[1],
        'state', case
          when proposal.recipient_resolution_state = 'resolved' then 'resolved'
          when proposal.recipient_resolution_state in ('pending', 'processing') then 'pending-review'
          else 'unknown'
        end,
        'resolution', jsonb_build_object('state', case
          when proposal.recipient_resolution_state = 'resolved' then 'resolved'
          when proposal.recipient_resolution_state in ('pending', 'processing') then 'pending-adult-review'
          else 'unknown'
        end),
        'history', '[]'::jsonb
      ) as event
    from academy_private.study_adult_review_proposals_v1 as proposal
    join public.academy_students as student on student.id = proposal.student_id
    where (p_household_id is null or proposal.household_id = p_household_id)
      and (p_learner_id is null or proposal.student_id = p_learner_id)
  ),
  monitoring_rows as (
    select
      monitoring.occurred_at,
      'monitoring:' || monitoring.event_id as event_ref,
      jsonb_build_object(
        'schemaVersion', 1,
        'eventRef', 'monitoring:' || monitoring.event_id,
        'source', 'study-safety-monitoring',
        'occurredAt', to_char(monitoring.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'engine', 'study',
        'evidenceCategory', case
          when monitoring.name in ('study_safety.request_unauthorized', 'study_safety.request_rate_limited')
            then 'fallback-rejection'
          else 'fail-closed'
        end,
        'reasonCode', monitoring.name,
        'state', case
          when monitoring.name in ('study_safety.request_unauthorized', 'study_safety.request_rate_limited')
            then 'rejected'
          else 'fail-closed'
        end,
        'resolution', jsonb_build_object('state', 'not-applicable'),
        'history', '[]'::jsonb
      ) as event
    from academy_private.study_safety_monitoring_events as monitoring
    where p_household_id is null
      and p_learner_id is null
      and monitoring.name in (
        'study_safety.classifier_unavailable',
        'study_safety.classifier_malformed_response',
        'study_safety.outbox_backlog',
        'study_safety.delivery_repeated_failure',
        'study_safety.recipient_resolution_failure',
        'study_safety.request_unauthorized',
        'study_safety.request_rate_limited',
        'study_safety.provider_timeout',
        'study_safety.circuit_breaker_open'
      )
  ),
  all_events as (
    select * from operational_rows
    union all select * from adult_review_rows
    union all select * from monitoring_rows
  ),
  bounded_events as (
    select row.occurred_at, row.event_ref, row.event
    from all_events as row
    where p_before_at is null
       or row.occurred_at < p_before_at
       or (row.occurred_at = p_before_at and row.event_ref < p_before_ref)
    order by row.occurred_at desc, row.event_ref desc
    limit p_limit
  ),
  counts as (
    select
      (select count(*)::integer from operational_rows) as safety_stop_events,
      (select count(*)::integer from adult_review_rows as row
       join academy_private.study_adult_review_proposals_v1 as proposal
         on row.event_ref = 'adult-review:' || proposal.proposal_id
       where proposal.recipient_resolution_state <> 'resolved') as open_safety_stops,
      (select count(*)::integer from adult_review_rows as row
       join academy_private.study_adult_review_proposals_v1 as proposal
         on row.event_ref = 'adult-review:' || proposal.proposal_id
       where proposal.recipient_resolution_state = 'resolved') as resolved_safety_stops,
      (select count(*)::integer from adult_review_rows as row
       join academy_private.study_adult_review_proposals_v1 as proposal
         on row.event_ref = 'adult-review:' || proposal.proposal_id
       where proposal.recipient_resolution_state in ('pending', 'processing')) as adult_review_pending,
      (select count(*)::integer from monitoring_rows where event ->> 'evidenceCategory' = 'fail-closed') as fail_closed_events,
      (select count(*)::integer from monitoring_rows where event ->> 'evidenceCategory' = 'fallback-rejection') as fallback_rejection_events
  )
  select jsonb_build_object(
    'observedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'summary', jsonb_build_object(
      'openSafetyStops', jsonb_build_object('status', 'available', 'value', counts.open_safety_stops),
      'resolvedSafetyStops', jsonb_build_object('status', 'available', 'value', counts.resolved_safety_stops),
      'adultReviewPending', jsonb_build_object('status', 'available', 'value', counts.adult_review_pending),
      'failClosedEvents', jsonb_build_object('status', 'available', 'value', counts.fail_closed_events),
      'safetyStopEvents', jsonb_build_object('status', 'available', 'value', counts.safety_stop_events),
      'fallbackRejectionEvents', jsonb_build_object('status', 'available', 'value', counts.fallback_rejection_events),
      'unresolvedSafetyConditions', jsonb_build_object(
        'status', 'available',
        'value', counts.open_safety_stops + counts.fail_closed_events
      )
    ),
    'sources', jsonb_build_array(
      jsonb_build_object('source', 'operational-telemetry', 'status', 'available'),
      jsonb_build_object('source', 'study-adult-review', 'status', 'available'),
      jsonb_build_object('source', 'study-safety-monitoring', 'status', 'available')
    ),
    'operationalTelemetry', jsonb_build_object('status', 'available'),
    'events', coalesce((
      select jsonb_agg(event order by occurred_at desc, event_ref desc)
      from bounded_events
    ), '[]'::jsonb)
  ) into projection
  from counts;

  return projection;
end;
$$;

alter function public.academy_admin_read_safety_operations_v1(
  integer, timestamptz, text, uuid, uuid, text
) owner to postgres;

revoke all on function public.academy_admin_read_safety_operations_v1(
  integer, timestamptz, text, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_safety_operations_v1(
  integer, timestamptz, text, uuid, uuid, text
) to service_role;

comment on function public.academy_admin_read_safety_operations_v1(
  integer, timestamptz, text, uuid, uuid, text
) is 'Bounded service-only ADMIN safety:read projection over existing canonical evidence.';

commit;
