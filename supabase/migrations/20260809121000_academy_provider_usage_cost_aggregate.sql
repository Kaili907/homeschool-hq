-- ADMIN-COSTS-AGGREGATE-V2: exact, bounded provider usage/cost aggregation.
-- Additive only; depends on 20260809120000_academy_operational_telemetry_foundation.sql.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Provider usage cost aggregate migration must run as postgres';
  end if;
  if to_regclass('public.academy_provider_usage_ledger') is null
     or to_regclass('public.academy_operational_events') is null
     or to_regprocedure('public.academy_record_provider_usage(text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,bigint,bigint,bigint,bigint,integer,text,text,text)') is null then
    raise exception
      'Provider usage cost aggregate requires the cost ledger and operational telemetry foundation';
  end if;
end;
$$;

create or replace function academy_private.cost_is_trusted_server()
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

create or replace function public.academy_aggregate_provider_usage_costs_v1(
  p_start timestamptz,
  p_end_exclusive timestamptz,
  p_required_capability text default null,
  p_group_limit integer default 384
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  reference_time timestamptz := statement_timestamp();
  maximum_days constant integer := 366;
  maximum_groups constant integer := 384;
  detected_groups integer;
  total_records text;
  aggregate_groups jsonb;
  observed_accounting_gaps text;
begin
  if auth.uid() is not null
     or not academy_private.cost_is_trusted_server()
     or p_required_capability is distinct from 'costs:read' then
    raise exception 'PROVIDER_COST_AGGREGATE_ADMIN_REQUIRED'
      using errcode = '42501';
  end if;

  if p_start is null
     or p_end_exclusive is null
     or p_start >= p_end_exclusive
     or p_end_exclusive > (
       date_trunc('day', reference_time at time zone 'UTC') + interval '1 day'
     ) at time zone 'UTC'
     or p_end_exclusive - p_start > make_interval(days => maximum_days)
     or p_group_limit is null
     or p_group_limit < 1
     or p_group_limit > maximum_groups then
    raise exception 'PROVIDER_COST_AGGREGATE_RANGE_INVALID'
      using errcode = '22023';
  end if;

  with filtered as materialized (
    select
      to_char(ledger.occurred_at at time zone 'UTC', 'YYYY-MM-DD') as group_day,
      ledger.engine as group_engine,
      ledger.provider as group_provider,
      coalesce(ledger.logical_model_tier, 'speech') as group_logical_tier,
      ledger.cost_kind as group_cost_kind,
      ledger.billing_disposition as group_billing_disposition,
      ledger.request_count,
      ledger.input_tokens,
      ledger.output_tokens,
      ledger.cached_input_read_tokens,
      ledger.cached_input_write_tokens,
      ledger.tts_characters,
      ledger.cost_micros,
      ledger.household_attribution
    from public.academy_provider_usage_ledger as ledger
    where ledger.occurred_at >= p_start
      and ledger.occurred_at < p_end_exclusive
  ), grouped as materialized (
    select
      case
        when grouping(group_day) = 0 then 'day'
        when grouping(group_engine) = 0 then 'engine'
        when grouping(group_provider) = 0 then 'provider'
        when grouping(group_logical_tier) = 0 then 'logical_tier'
        when grouping(group_cost_kind) = 0 then 'cost_kind'
        when grouping(group_billing_disposition) = 0 then 'billing_disposition'
        else 'summary'
      end as dimension,
      case
        when grouping(group_day) = 0 then group_day
        when grouping(group_engine) = 0 then group_engine
        when grouping(group_provider) = 0 then group_provider
        when grouping(group_logical_tier) = 0 then group_logical_tier
        when grouping(group_cost_kind) = 0 then group_cost_kind
        when grouping(group_billing_disposition) = 0 then group_billing_disposition
        else 'all'
      end as key,
      count(*)::text as record_count,
      coalesce(sum(request_count), 0)::text as total_requests,
      coalesce(sum(request_count) filter (where group_engine <> 'tts'), 0)::text as ai_requests,
      coalesce(sum(request_count) filter (where group_engine = 'tts'), 0)::text as tts_requests,
      coalesce(sum(input_tokens) filter (where group_engine <> 'tts'), 0)::text as input_tokens,
      count(input_tokens) filter (where group_engine <> 'tts')::text as input_tokens_known,
      count(*) filter (where group_engine <> 'tts' and input_tokens is null)::text as input_tokens_unavailable,
      coalesce(sum(output_tokens) filter (where group_engine <> 'tts'), 0)::text as output_tokens,
      count(output_tokens) filter (where group_engine <> 'tts')::text as output_tokens_known,
      count(*) filter (where group_engine <> 'tts' and output_tokens is null)::text as output_tokens_unavailable,
      coalesce(sum(cached_input_read_tokens) filter (where group_engine <> 'tts'), 0)::text as cache_read_tokens,
      count(cached_input_read_tokens) filter (where group_engine <> 'tts')::text as cache_read_tokens_known,
      count(*) filter (
        where group_engine <> 'tts' and cached_input_read_tokens is null
      )::text as cache_read_tokens_unavailable,
      coalesce(sum(cached_input_write_tokens) filter (where group_engine <> 'tts'), 0)::text as cache_write_tokens,
      count(cached_input_write_tokens) filter (where group_engine <> 'tts')::text as cache_write_tokens_known,
      count(*) filter (
        where group_engine <> 'tts' and cached_input_write_tokens is null
      )::text as cache_write_tokens_unavailable,
      coalesce(sum(tts_characters) filter (where group_engine = 'tts'), 0)::text as tts_characters,
      count(tts_characters) filter (where group_engine = 'tts')::text as tts_characters_known,
      count(*) filter (where group_engine = 'tts' and tts_characters is null)::text as tts_characters_unavailable,
      coalesce(sum(cost_micros) filter (where group_cost_kind = 'calculated'), 0)::text as calculated_cost_micros,
      count(*) filter (where group_cost_kind = 'calculated')::text as calculated_cost_known,
      count(*) filter (where group_cost_kind in ('reconciled', 'unavailable'))::text as calculated_cost_unavailable,
      coalesce(sum(cost_micros) filter (where group_cost_kind = 'reconciled'), 0)::text as reconciled_cost_micros,
      count(*) filter (where group_cost_kind = 'unavailable')::text as unavailable_cost_count,
      count(*) filter (where group_engine <> 'tts' and input_tokens is null)::text as usage_unavailable_count,
      count(*) filter (where group_billing_disposition = 'billable')::text as billing_billable_count,
      count(*) filter (where group_billing_disposition = 'not_billable')::text as billing_not_billable_count,
      count(*) filter (where group_billing_disposition = 'unknown')::text as billing_unknown_count,
      count(*) filter (where group_cost_kind = 'calculated')::text as cost_calculated_count,
      count(*) filter (where group_cost_kind = 'reconciled')::text as cost_reconciled_count,
      count(*) filter (where group_cost_kind = 'unavailable')::text as cost_unavailable_count,
      count(*) filter (where household_attribution = 'resolved')::text as attribution_resolved_count,
      count(*) filter (where household_attribution = 'ambiguous')::text as attribution_ambiguous_count,
      count(*) filter (
        where household_attribution in ('no_active_household', 'lookup_unavailable')
      )::text as attribution_unresolved_count
    from filtered
    group by grouping sets (
      (),
      (group_day),
      (group_engine),
      (group_provider),
      (group_logical_tier),
      (group_cost_kind),
      (group_billing_disposition)
    )
  )
  select
    count(*)::integer,
    max(record_count) filter (where dimension = 'summary'),
    jsonb_agg(
      jsonb_build_object(
        'dimension', dimension,
        'key', key,
        'records', record_count,
        'requests', jsonb_build_object(
          'total', total_requests,
          'ai', ai_requests,
          'tts', tts_requests
        ),
        'usage', jsonb_build_object(
          'inputTokens', jsonb_build_object(
            'total', input_tokens,
            'known', input_tokens_known,
            'unavailable', input_tokens_unavailable
          ),
          'outputTokens', jsonb_build_object(
            'total', output_tokens,
            'known', output_tokens_known,
            'unavailable', output_tokens_unavailable
          ),
          'cachedInputReadTokens', jsonb_build_object(
            'total', cache_read_tokens,
            'known', cache_read_tokens_known,
            'unavailable', cache_read_tokens_unavailable
          ),
          'cachedInputWriteTokens', jsonb_build_object(
            'total', cache_write_tokens,
            'known', cache_write_tokens_known,
            'unavailable', cache_write_tokens_unavailable
          ),
          'ttsCharacters', jsonb_build_object(
            'total', tts_characters,
            'known', tts_characters_known,
            'unavailable', tts_characters_unavailable
          )
        ),
        'cost', jsonb_build_object(
          'calculated', jsonb_build_object(
            'micros', calculated_cost_micros,
            'known', calculated_cost_known,
            'unavailable', calculated_cost_unavailable
          ),
          'reconciledMicros', reconciled_cost_micros,
          'unavailableCount', unavailable_cost_count
        ),
        'counts', jsonb_build_object(
          'usageUnavailable', usage_unavailable_count,
          'billingDisposition', jsonb_build_object(
            'billable', billing_billable_count,
            'notBillable', billing_not_billable_count,
            'unknown', billing_unknown_count
          ),
          'costKind', jsonb_build_object(
            'calculated', cost_calculated_count,
            'reconciled', cost_reconciled_count,
            'unavailable', cost_unavailable_count
          ),
          'attribution', jsonb_build_object(
            'resolved', attribution_resolved_count,
            'ambiguous', attribution_ambiguous_count,
            'unresolved', attribution_unresolved_count
          )
        )
      )
      order by
        case dimension
          when 'summary' then 0
          when 'day' then 1
          when 'engine' then 2
          when 'provider' then 3
          when 'logical_tier' then 4
          when 'cost_kind' then 5
          else 6
        end,
        key
    )
  into detected_groups, total_records, aggregate_groups
  from grouped;

  if detected_groups > p_group_limit then
    raise exception 'PROVIDER_COST_AGGREGATE_GROUP_LIMIT'
      using errcode = '54000';
  end if;

  select count(*)::text
  into observed_accounting_gaps
  from public.academy_operational_events as event
  where event.occurred_at >= p_start
    and event.occurred_at < p_end_exclusive
    and event.expires_at > reference_time
    and event.engine = 'gateway'
    and event.event_type = 'gateway.request'
    and event.metadata ->> 'reason_code' = 'accounting_unavailable'
    and event.metadata ->> 'failure_stage' = 'accounting_persistence';

  return jsonb_build_object(
    'schemaVersion', 1,
    'range', jsonb_build_object(
      'startAt', to_char(p_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'endExclusive', to_char(p_end_exclusive at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'maximumDays', maximum_days
    ),
    'completeness', jsonb_build_object(
      'queryCoverage', 'complete',
      'providerTrafficCoverage', 'coverage_unverified',
      'groupCount', detected_groups,
      'groupLimit', p_group_limit
    ),
    'accountingGapEvidence', jsonb_build_object(
      'observedCount', observed_accounting_gaps,
      'retentionCoverage', case
        when p_start >= reference_time - interval '30 days' then 'within_retention'
        else 'retention_limited'
      end
    ),
    'recordsIncluded', coalesce(total_records, '0'),
    'groups', coalesce(aggregate_groups, '[]'::jsonb)
  );
end;
$$;

comment on function public.academy_aggregate_provider_usage_costs_v1(
  timestamptz, timestamptz, text, integer
) is
  'Service-only exact bounded aggregate of recorded provider usage; returns no raw ledger rows and does not claim complete provider-account economics or provider-attempt coverage.';

revoke all on function academy_private.cost_is_trusted_server()
  from public, anon, authenticated, service_role;
revoke all on function public.academy_aggregate_provider_usage_costs_v1(
  timestamptz, timestamptz, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.academy_aggregate_provider_usage_costs_v1(
  timestamptz, timestamptz, text, integer
) to service_role;

commit;
