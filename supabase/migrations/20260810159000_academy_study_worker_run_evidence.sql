-- Durable, privacy-safe execution evidence for the Study adult-review worker.
--
-- One immutable receipt is accepted per server-generated invocation identity.
-- The table intentionally has no learner, household, review, delivery, provider,
-- transcript, note, diagnostic, secret, or raw-error field. Browser roles have
-- neither table access nor RPC execution. The write RPC reuses the durable
-- worker registry's credential, version, scope, expiry, and revocation checks.

begin;

do $$
begin
  if not exists (
    select 1
    from academy_private.study_persistence_metadata
    where singleton and c2_operations_contract_version = 1
  ) then
    raise exception 'STUDY_WORKER_RUN_EVIDENCE_PREDECESSOR_REQUIRED';
  end if;
end;
$$;

create table academy_private.study_adult_review_worker_runs (
  run_id uuid primary key,
  worker_id text not null references academy_private.study_adult_review_worker_registry(worker_id),
  worker_version text not null
    check (public.academy_study_identifier_is_valid(worker_version)),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  result_category text not null check (result_category in (
    'no_work', 'processed', 'partial_with_retryable_failures', 'failed', 'unavailable'
  )),
  claimed_count smallint not null check (claimed_count between 0 and 50),
  processed_count smallint not null check (processed_count between 0 and 50),
  retryable_failure_count smallint not null
    check (retryable_failure_count between 0 and 50),
  terminal_failure_count smallint not null
    check (terminal_failure_count between 0 and 50),
  invocation_kind text not null check (invocation_kind in ('scheduled', 'manual')),
  reason_code text not null check (reason_code in (
    'no-work', 'completed', 'retryable-failures',
    'systemic-failure', 'dependency-unavailable'
  )),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint study_worker_run_time_check check (completed_at >= started_at),
  constraint study_worker_run_count_check check (
    processed_count + retryable_failure_count + terminal_failure_count = claimed_count
  ),
  constraint study_worker_run_reason_check check (
    (result_category = 'no_work' and reason_code = 'no-work')
    or (result_category = 'processed' and reason_code = 'completed')
    or (result_category = 'partial_with_retryable_failures'
      and reason_code = 'retryable-failures')
    or (result_category = 'failed'
      and reason_code in ('retryable-failures', 'systemic-failure'))
    or (result_category = 'unavailable' and reason_code = 'dependency-unavailable')
  )
);

create index study_adult_review_worker_runs_completed_idx
  on academy_private.study_adult_review_worker_runs (completed_at desc, run_id desc);

create index study_adult_review_worker_runs_success_idx
  on academy_private.study_adult_review_worker_runs (completed_at desc, run_id desc)
  where result_category in ('no_work', 'processed');

create or replace function public.academy_study_record_adult_review_worker_run_v1(
  p_worker_id text,
  p_run jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  parsed_run_id uuid;
  parsed_started_at timestamptz;
  parsed_completed_at timestamptz;
  parsed_claimed smallint;
  parsed_processed smallint;
  parsed_retryable smallint;
  parsed_terminal smallint;
  parsed_result text;
  parsed_kind text;
  parsed_reason text;
  configured_worker academy_private.study_adult_review_worker_registry%rowtype;
  existing academy_private.study_adult_review_worker_runs%rowtype;
  inserted_run_id uuid;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'monitoring'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if not public.academy_study_json_has_exact_keys(p_run, array[
    'runId', 'startedAt', 'completedAt', 'resultCategory', 'claimedCount',
    'processedCount', 'retryableFailureCount', 'terminalFailureCount',
    'invocationKind', 'reasonCode'
  ]) then
    raise exception 'STUDY_WORKER_RUN_INVALID';
  end if;

  if coalesce(p_run ->> 'runId', '')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_run ->> 'startedAt', '')
       !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
     or coalesce(p_run ->> 'completedAt', '')
       !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
     or jsonb_typeof(p_run -> 'claimedCount') <> 'number'
     or jsonb_typeof(p_run -> 'processedCount') <> 'number'
     or jsonb_typeof(p_run -> 'retryableFailureCount') <> 'number'
     or jsonb_typeof(p_run -> 'terminalFailureCount') <> 'number'
     or coalesce(p_run ->> 'claimedCount', '') !~ '^(0|[1-9][0-9]?)$'
     or coalesce(p_run ->> 'processedCount', '') !~ '^(0|[1-9][0-9]?)$'
     or coalesce(p_run ->> 'retryableFailureCount', '') !~ '^(0|[1-9][0-9]?)$'
     or coalesce(p_run ->> 'terminalFailureCount', '') !~ '^(0|[1-9][0-9]?)$' then
    raise exception 'STUDY_WORKER_RUN_INVALID';
  end if;

  begin
    parsed_run_id := (p_run ->> 'runId')::uuid;
    parsed_started_at := (p_run ->> 'startedAt')::timestamptz;
    parsed_completed_at := (p_run ->> 'completedAt')::timestamptz;
    parsed_claimed := (p_run ->> 'claimedCount')::smallint;
    parsed_processed := (p_run ->> 'processedCount')::smallint;
    parsed_retryable := (p_run ->> 'retryableFailureCount')::smallint;
    parsed_terminal := (p_run ->> 'terminalFailureCount')::smallint;
  exception when others then
    raise exception 'STUDY_WORKER_RUN_INVALID';
  end;

  parsed_result := p_run ->> 'resultCategory';
  parsed_kind := p_run ->> 'invocationKind';
  parsed_reason := p_run ->> 'reasonCode';
  if parsed_completed_at < parsed_started_at
     or parsed_claimed > 50 or parsed_processed > 50
     or parsed_retryable > 50 or parsed_terminal > 50
     or parsed_processed + parsed_retryable + parsed_terminal <> parsed_claimed
     or parsed_result not in (
       'no_work', 'processed', 'partial_with_retryable_failures', 'failed', 'unavailable'
     )
     or parsed_kind not in ('scheduled', 'manual')
     or not (
       (parsed_result = 'no_work' and parsed_reason = 'no-work')
       or (parsed_result = 'processed' and parsed_reason = 'completed')
       or (parsed_result = 'partial_with_retryable_failures'
         and parsed_reason = 'retryable-failures')
       or (parsed_result = 'failed'
         and parsed_reason in ('retryable-failures', 'systemic-failure'))
       or (parsed_result = 'unavailable' and parsed_reason = 'dependency-unavailable')
     ) then
    raise exception 'STUDY_WORKER_RUN_INVALID';
  end if;

  select * into strict configured_worker
  from academy_private.study_adult_review_worker_registry
  where worker_id = p_worker_id;

  insert into academy_private.study_adult_review_worker_runs (
    run_id, worker_id, worker_version, started_at, completed_at,
    result_category, claimed_count, processed_count,
    retryable_failure_count, terminal_failure_count, invocation_kind, reason_code
  ) values (
    parsed_run_id, p_worker_id, configured_worker.configuration_version,
    parsed_started_at, parsed_completed_at, parsed_result, parsed_claimed,
    parsed_processed, parsed_retryable, parsed_terminal, parsed_kind, parsed_reason
  )
  on conflict (run_id) do nothing
  returning run_id into inserted_run_id;

  if inserted_run_id is not null then
    return jsonb_build_object('recorded', true, 'replayed', false);
  end if;

  select * into strict existing
  from academy_private.study_adult_review_worker_runs
  where run_id = parsed_run_id;
  if existing.worker_id is distinct from p_worker_id
     or existing.worker_version is distinct from configured_worker.configuration_version
     or existing.started_at is distinct from parsed_started_at
     or existing.completed_at is distinct from parsed_completed_at
     or existing.result_category is distinct from parsed_result
     or existing.claimed_count is distinct from parsed_claimed
     or existing.processed_count is distinct from parsed_processed
     or existing.retryable_failure_count is distinct from parsed_retryable
     or existing.terminal_failure_count is distinct from parsed_terminal
     or existing.invocation_kind is distinct from parsed_kind
     or existing.reason_code is distinct from parsed_reason then
    raise exception 'STUDY_WORKER_RUN_REPLAY_CONFLICT' using errcode = '23505';
  end if;

  return jsonb_build_object('recorded', true, 'replayed', true);
end;
$$;

create or replace function public.academy_study_adult_review_worker_status_v1(
  p_observed_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  observed_at timestamptz := coalesce(p_observed_at, now());
  configured boolean;
  latest academy_private.study_adult_review_worker_runs%rowtype;
  latest_success_at timestamptz;
  staleness text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from academy_private.study_adult_review_worker_registry as worker
    where worker.status = 'active'
      and worker.revoked_at is null
      and worker.effective_at <= observed_at
      and worker.expires_at > observed_at
  ) into configured;

  select * into latest
  from academy_private.study_adult_review_worker_runs as run
  where run.completed_at <= observed_at
  order by run.completed_at desc, run.run_id desc
  limit 1;

  select max(run.completed_at) into latest_success_at
  from academy_private.study_adult_review_worker_runs as run
  where run.completed_at <= observed_at
    and run.result_category in ('no_work', 'processed');

  staleness := case
    when not configured then 'unavailable'
    when latest.run_id is null then 'unknown'
    when latest.result_category = 'unavailable' then 'unavailable'
    when latest.result_category in ('partial_with_retryable_failures', 'failed') then 'degraded'
    when latest.completed_at < observed_at - interval '15 minutes' then 'degraded'
    else 'healthy'
  end;

  return jsonb_build_object(
    'schemaVersion', 1,
    'configuredState', case when configured then 'configured' else 'not_configured' end,
    'latestRunTimestamp', case when latest.run_id is null then null else
      to_char(latest.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'latestSuccessfulRunTimestamp', case when latest_success_at is null then null else
      to_char(latest_success_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'latestResultCategory', latest.result_category,
    'stalenessClassification', staleness,
    'workerVersion', latest.worker_version
  );
end;
$$;

alter table academy_private.study_adult_review_worker_runs enable row level security;
alter table academy_private.study_adult_review_worker_runs force row level security;
alter table academy_private.study_adult_review_worker_runs owner to postgres;

revoke all on table academy_private.study_adult_review_worker_runs
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_adult_review_worker_run_v1(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_adult_review_worker_status_v1(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_record_adult_review_worker_run_v1(text, jsonb)
  to service_role;
grant execute on function public.academy_study_adult_review_worker_status_v1(timestamptz)
  to service_role;

alter table academy_private.study_persistence_metadata
  add column worker_run_evidence_version smallint not null default 0
    check (worker_run_evidence_version in (0, 1));
update academy_private.study_persistence_metadata
set worker_run_evidence_version = 1,
    migration_names = array_append(
      migration_names, '20260810159000_academy_study_worker_run_evidence'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'worker_run_evidence_version', 1,
      'worker_run_receipts', 'server-private',
      'worker_run_idempotency', 'immutable-invocation-id',
      'worker_run_projection', 'service-role-minimized',
      'worker_run_freshness_window_minutes', 15
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table academy_private.study_adult_review_worker_runs is
  'Bounded, content-free execution receipts for authorized Study adult-review worker invocations.';
comment on function public.academy_study_record_adult_review_worker_run_v1(text, jsonb) is
  'Records or idempotently replays one credential-authorized, privacy-safe worker invocation receipt.';
comment on function public.academy_study_adult_review_worker_status_v1(timestamptz) is
  'Returns the minimized server-only Admin Study Operations worker status projection.';

commit;
