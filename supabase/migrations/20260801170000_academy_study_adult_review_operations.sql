-- Manuel Academy Study Engine adult-review operations and delivery.
-- Additive reconciliation over the accepted Session 13-15 migrations.
-- No recipient contact value, raw disclosure, transcript, provider payload,
-- credential, or adult-private note body is stored by this migration.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Study adult-review operations migration must run as postgres';
  end if;
  if to_regclass('academy_private.study_adult_review_proposals_v1') is null
     or to_regclass('academy_private.study_adult_review_delivery_jobs') is null
     or to_regclass('academy_private.study_adult_notification_permissions') is null
     or to_regprocedure('public.academy_study_resolve_adult_recipients_v1(text)') is null then
    raise exception 'Session 15 production reconciliation is required';
  end if;
  if exists (
    select 1 from unnest(array[
      'academy_private.study_adult_review_attempt_events',
      'academy_private.study_adult_review_receipt_events',
      'academy_private.study_parent_notifications',
      'academy_private.study_adult_review_worker_registry',
      'academy_private.study_adult_review_route_capabilities',
      'academy_private.study_adult_review_audit_events'
    ]) as candidate(name)
    where to_regclass(candidate.name) is not null
  ) then
    raise exception 'Unmarked adult-review operations object collision';
  end if;
end;
$$;

-- Permission is explicit, relationship-scoped, revisioned, and effective at
-- the event time. Existing grants retain their original grant time.
alter table academy_private.study_adult_notification_permissions
  add column effective_at timestamptz,
  add column expires_at timestamptz,
  add column permission_version smallint not null default 2
    check (permission_version = 2);
update academy_private.study_adult_notification_permissions
set effective_at = granted_at
where effective_at is null;
alter table academy_private.study_adult_notification_permissions
  alter column effective_at set not null,
  alter column effective_at set default clock_timestamp();
alter table academy_private.study_adult_notification_permissions
  add constraint study_notification_permissions_effective_check check (
    effective_at >= granted_at
    and (expires_at is null or expires_at > effective_at)
    and (revoked_at is null or revoked_at >= effective_at)
  );

-- Converge Session 15's transport-oriented labels to the canonical Session 17
-- operational state vocabulary. Historical migrations remain unchanged.
do $$
declare candidate record;
begin
  for candidate in
    select constraint_row.conname
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid =
      'academy_private.study_adult_review_proposals_v1'::regclass
      and constraint_row.contype = 'c'
      and (
        constraint_row.conname like '%state_check%'
        or constraint_row.conname in (
          'study_proposals_v1_lease_check',
          'study_proposals_v1_resolution_check'
        )
      )
  loop
    execute format(
      'alter table academy_private.study_adult_review_proposals_v1 drop constraint %I',
      candidate.conname
    );
  end loop;
end;
$$;
update academy_private.study_adult_review_proposals_v1
set state = case state
  when 'proposed-not-delivered' then 'proposed'
  when 'routing' then 'proposed'
  when 'routed' then 'accepted'
  when 'unavailable' then 'rejected'
  when 'indeterminate' then 'proposed'
  else state end,
  recipient_resolution_state = case recipient_resolution_state
  when 'processing' then 'pending'
  when 'unavailable' then 'no-authorized-recipient'
  when 'indeterminate' then 'failed'
  else recipient_resolution_state end;
alter table academy_private.study_adult_review_proposals_v1
  add column operations_version smallint not null default 2
    check (operations_version = 2),
  add column lease_owner text
    check (lease_owner is null or public.academy_study_identifier_is_valid(lease_owner)),
  add column expires_at timestamptz,
  add column retain_until timestamptz not null default (now() + interval '2 years'),
  add constraint study_proposals_v2_state_check check (
    state in ('proposed', 'accepted', 'rejected', 'cancelled', 'expired')
  ),
  add constraint study_proposals_v2_resolution_check check (
    recipient_resolution_state in (
      'pending', 'resolved', 'no-authorized-recipient', 'revoked', 'failed'
    )
  ),
  add constraint study_proposals_v2_lease_check check (
    (lease_token is null and lease_expires_at is null and lease_owner is null)
    or (lease_token is not null and lease_expires_at is not null and lease_owner is not null)
  ),
  add constraint study_proposals_v2_resolved_check check (
    (recipient_resolution_state = 'resolved'
      and state = 'accepted'
      and resolution_ref is not null
      and resolution_policy_version is not null)
    or (recipient_resolution_state <> 'resolved'
      and resolution_ref is null
      and resolution_policy_version is null)
  );
alter table academy_private.study_adult_review_proposals_v1
  alter column state set default 'proposed';
update academy_private.study_adult_review_proposals_v1
set expires_at = created_at + interval '7 days'
where expires_at is null;
alter table academy_private.study_adult_review_proposals_v1
  alter column expires_at set not null,
  alter column expires_at set default (clock_timestamp() + interval '7 days');

do $$
declare candidate record;
begin
  for candidate in
    select constraint_row.conname
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid =
      'academy_private.study_adult_review_delivery_jobs'::regclass
      and constraint_row.contype = 'c'
      and (
        constraint_row.conname like '%state_check%'
        or constraint_row.conname in (
          'study_delivery_jobs_lease_check',
          'study_delivery_jobs_retry_check',
          'study_delivery_jobs_failure_check'
        )
      )
  loop
    execute format(
      'alter table academy_private.study_adult_review_delivery_jobs drop constraint %I',
      candidate.conname
    );
  end loop;
end;
$$;
update academy_private.study_adult_review_delivery_jobs
set state = case state
  when 'claimed' then 'leased'
  when 'retry-scheduled' then 'retryable'
  else state end;
alter table academy_private.study_adult_review_delivery_jobs
  add column operations_version smallint not null default 2
    check (operations_version = 2),
  add column lease_owner text
    check (lease_owner is null or public.academy_study_identifier_is_valid(lease_owner)),
  add column receipt_reference uuid,
  add column retain_until timestamptz not null default (now() + interval '2 years'),
  add constraint study_delivery_jobs_v2_state_check check (
    state in (
      'pending', 'leased', 'retryable', 'indeterminate', 'delivered',
      'permanent-failure', 'cancelled'
    )
  ),
  add constraint study_delivery_jobs_v2_lease_check check (
    (state = 'leased' and lease_token is not null
      and lease_expires_at is not null and lease_owner is not null)
    or (state <> 'leased' and lease_token is null
      and lease_expires_at is null and lease_owner is null)
  ),
  add constraint study_delivery_jobs_v2_retry_check check (
    (state = 'retryable' and retry_at is not null)
    or (state <> 'retryable' and retry_at is null)
  ),
  add constraint study_delivery_jobs_v2_failure_check check (
    (state in ('retryable', 'permanent-failure', 'indeterminate')
      and last_failure_code is not null and failed_at is not null)
    or (state not in ('retryable', 'permanent-failure', 'indeterminate')
      and last_failure_code is null and failed_at is null)
  ),
  add constraint study_delivery_jobs_proposal_recipient_route_key
    unique (proposal_id, recipient_ref, route_ref);

alter table academy_private.study_adult_review_delivery_attempts
  add column provider_name text not null default 'in-app'
    check (provider_name in ('in-app', 'email', 'sms')),
  add column provider_config_version text not null default 'in-app-config-v1'
    check (public.academy_study_identifier_is_valid(provider_config_version)),
  add column retain_until timestamptz not null default (now() + interval '2 years');

alter table academy_private.study_adult_review_delivery_receipts
  add column route_ref text,
  add column channel text,
  add column recipient_ref text,
  add column delivery_idempotency_key text,
  add column provider_name text not null default 'in-app',
  add column provider_config_version text not null default 'in-app-config-v1',
  add column verification_state text not null default 'verified'
    check (verification_state = 'verified'),
  add column retain_until timestamptz not null default (now() + interval '2 years');
update academy_private.study_adult_review_delivery_receipts as receipt
set route_ref = attempt.route_ref,
    channel = attempt.channel,
    recipient_ref = attempt.recipient_ref,
    delivery_idempotency_key = attempt.delivery_idempotency_key,
    provider_name = attempt.provider_name,
    provider_config_version = attempt.provider_config_version
from academy_private.study_adult_review_delivery_attempts as attempt
where attempt.attempt_id = receipt.attempt_id;
alter table academy_private.study_adult_review_delivery_receipts
  alter column route_ref set not null,
  alter column channel set not null,
  alter column recipient_ref set not null,
  alter column delivery_idempotency_key set not null,
  add constraint study_delivery_receipts_route_check
    check (channel in ('email', 'in-app', 'sms')),
  add constraint study_delivery_receipts_binding_key unique (
    provider_name, provider_config_version, route_ref, provider_receipt_ref
  );

create table academy_private.study_adult_review_attempt_events (
  event_id uuid primary key default gen_random_uuid(),
  attempt_id text not null,
  job_id uuid not null,
  state text not null check (state in (
    'created', 'submitted', 'provider-accepted', 'provider-rejected',
    'timeout-indeterminate', 'receipt-verified', 'receipt-rejected',
    'permanent-failure'
  )),
  occurred_at timestamptz not null default now(),
  completed_at timestamptz,
  structured_result text not null
    check (public.academy_study_identifier_is_valid(structured_result)),
  timeout_state text not null default 'not-timed-out'
    check (timeout_state in ('not-timed-out', 'before-submit', 'after-submit')),
  receipt_reference uuid,
  retry_decision text not null default 'not-applicable'
    check (retry_decision in ('not-applicable', 'safe-retry', 'do-not-retry', 'reconcile')),
  error_code text
    check (error_code is null or public.academy_study_identifier_is_valid(error_code)),
  lease_generation bigint not null check (lease_generation > 0),
  provider_name text not null check (provider_name in ('in-app', 'email', 'sms')),
  provider_config_version text not null
    check (public.academy_study_identifier_is_valid(provider_config_version)),
  delivery_idempotency_key text not null
    check (public.academy_study_identifier_is_valid(delivery_idempotency_key)),
  retain_until timestamptz not null default (now() + interval '2 years'),
  constraint study_attempt_events_attempt_fk
    foreign key (attempt_id, job_id)
    references academy_private.study_adult_review_delivery_attempts
      (attempt_id, job_id) on delete restrict,
  constraint study_attempt_events_state_key unique (attempt_id, state)
);

create table academy_private.study_adult_review_receipt_events (
  event_id uuid primary key default gen_random_uuid(),
  receipt_ref text not null
    check (public.academy_study_identifier_is_valid(receipt_ref)),
  state text not null check (state in (
    'absent', 'pending-verification', 'verified', 'rejected', 'replayed', 'mismatched'
  )),
  provider_name text not null check (provider_name in ('in-app', 'email', 'sms')),
  provider_config_version text not null,
  route_ref text not null,
  job_id uuid not null,
  attempt_id text not null,
  delivery_idempotency_key text not null,
  recipient_ref text not null,
  evidence_ref text not null,
  reason_code text not null,
  occurred_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '2 years'),
  constraint study_receipt_events_attempt_fk
    foreign key (attempt_id, job_id)
    references academy_private.study_adult_review_delivery_attempts
      (attempt_id, job_id) on delete restrict,
  constraint study_receipt_events_identity_key unique (receipt_ref, state, attempt_id)
);

create table academy_private.study_parent_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_ref text not null unique
    check (public.academy_study_identifier_is_valid(notification_ref)),
  household_id uuid not null,
  student_id uuid not null,
  membership_id uuid not null,
  permission_id uuid not null,
  permission_revision bigint not null check (permission_revision > 0),
  recipient_ref text not null,
  route_ref text not null,
  proposal_id text not null,
  job_id uuid not null,
  attempt_id text not null,
  delivery_idempotency_key text not null unique,
  learner_safe_title text not null
    check (learner_safe_title = 'Study check-in needs your review'),
  reason_category text not null check (reason_category in (
    'immediate-safety', 'possible-safety', 'review-required'
  )),
  urgency text not null check (urgency in ('urgent', 'uncertain', 'review-required')),
  action_ref text not null
    check (public.academy_study_identifier_is_valid(action_ref)),
  delivered_at timestamptz not null,
  read_at timestamptz,
  revoked_at timestamptz,
  retain_until timestamptz not null default (now() + interval '1 year'),
  created_at timestamptz not null default now(),
  constraint study_parent_notifications_permission_fk
    foreign key (permission_id, household_id, student_id)
    references academy_private.study_adult_notification_permissions
      (id, household_id, student_id) on delete restrict,
  constraint study_parent_notifications_route_fk
    foreign key (route_ref, household_id, student_id)
    references academy_private.study_adult_notification_routes
      (route_ref, household_id, student_id) on delete restrict,
  constraint study_parent_notifications_job_fk
    foreign key (job_id, household_id, student_id)
    references academy_private.study_adult_review_delivery_jobs
      (id, household_id, student_id) on delete restrict,
  constraint study_parent_notifications_attempt_fk
    foreign key (attempt_id, job_id)
    references academy_private.study_adult_review_delivery_attempts
      (attempt_id, job_id) on delete restrict,
  constraint study_parent_notifications_route_job_key
    unique (proposal_id, recipient_ref, route_ref)
);

create table academy_private.study_adult_review_worker_registry (
  worker_id text primary key
    check (public.academy_study_identifier_is_valid(worker_id)),
  status text not null default 'active' check (status in ('active', 'revoked')),
  configuration_version text not null,
  authorized_scopes text[] not null,
  credential_digest text not null check (credential_digest ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null default now(),
  revoked_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  constraint study_worker_registry_scope_check check (
    cardinality(authorized_scopes) between 1 and 8
    and authorized_scopes <@ array[
      'proposal-resolution', 'delivery-claim', 'delivery-attempt',
      'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'
    ]::text[]
  ),
  constraint study_worker_registry_status_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table academy_private.study_adult_review_route_capabilities (
  route text primary key check (route in ('in-app', 'email', 'sms')),
  readiness text not null check (readiness in ('ready', 'not-ready', 'degraded')),
  provider_name text not null,
  provider_config_version text not null,
  allows_production boolean not null default false,
  supports_idempotency boolean not null,
  supports_receipt_verification boolean not null,
  decision_code text not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
insert into academy_private.study_adult_review_route_capabilities (
  route, readiness, provider_name, provider_config_version,
  allows_production, supports_idempotency, supports_receipt_verification,
  decision_code
) values
  ('in-app', 'ready', 'academy-in-app', 'in-app-config-v1', true, true, true,
   'durable-in-app-route'),
  ('email', 'not-ready', 'unconfigured', 'external-provider-unconfigured-v1',
   false, false, false, 'approved-provider-required'),
  ('sms', 'not-ready', 'disabled', 'sms-disabled-v1', false, false, false,
   'route-disabled');

create table academy_private.study_adult_review_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  event_name text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  worker_id text,
  proposal_ref text,
  job_ref text,
  reason_code text not null,
  dimensions jsonb not null default '{}'::jsonb
    check (public.academy_study_payload_is_minimized(dimensions, 1024)),
  occurred_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '2 years')
);

-- Existing durable limiter now covers all Session 17 server routes. The v2 RPC
-- below is the only supported entry point and owns server time.
alter table academy_private.study_safety_rate_limit_buckets
  drop constraint study_safety_rate_limit_buckets_scope_check;
alter table academy_private.study_safety_rate_limit_buckets
  add column retain_until timestamptz not null default (now() + interval '2 days'),
  add constraint study_safety_rate_limit_buckets_scope_v2_check check (scope in (
    'classification', 'proposal-creation', 'recipient-resolution',
    'worker-claim', 'delivery-attempt', 'parent-notification-read'
  ));

alter table academy_private.study_safety_rate_limit_reservations
  add column retain_until timestamptz not null default (now() + interval '2 days');

alter table academy_private.study_safety_monitoring_events
  drop constraint study_safety_monitoring_events_name_check,
  drop constraint study_safety_monitoring_events_schema_version_check,
  drop constraint study_safety_monitoring_events_service_check,
  drop constraint study_safety_monitoring_events_severity_check;
alter table academy_private.study_safety_monitoring_events
  alter column schema_version set default 2,
  add column retain_until timestamptz not null default (now() + interval '1 year'),
  add constraint study_safety_monitoring_events_schema_version_v2_check
    check (schema_version in (1, 2)),
  add constraint study_safety_monitoring_events_service_v2_check
    check (service in ('study-safety', 'study-adult-review')),
  add constraint study_safety_monitoring_events_severity_v2_check
    check (severity in ('info', 'warning', 'error', 'critical')),
  add constraint study_safety_monitoring_events_name_v2_check check (name in (
    'study_safety.classifier_unavailable',
    'study_safety.classifier_malformed_response',
    'study_safety.classification_urgent',
    'study_safety.classification_uncertain',
    'study_safety.outbox_backlog',
    'study_safety.delivery_repeated_failure',
    'study_safety.proposal_duplicate',
    'study_safety.recipient_resolution_failure',
    'study_safety.request_unauthorized',
    'study_safety.request_rate_limited',
    'study_safety.provider_timeout',
    'study_safety.circuit_breaker_open',
    'study.adult_review.proposal_backlog',
    'study.adult_review.outbox_backlog',
    'study.adult_review.oldest_pending_job',
    'study.adult_review.lease_expiration',
    'study.adult_review.repeated_worker_crash',
    'study.adult_review.repeated_retry',
    'study.adult_review.indeterminate_job',
    'study.adult_review.receipt_verification_failure',
    'study.adult_review.recipient_resolution_failure',
    'study.adult_review.permission_revocation',
    'study.adult_review.duplicate_suppression',
    'study.adult_review.rate_limit_threshold',
    'study.adult_review.provider_not_ready',
    'study.adult_review.provider_timeout',
    'study.adult_review.provider_circuit_open',
    'study.adult_review.delivery_permanent_failure',
    'study.adult_review.unauthorized_worker',
    'study.adult_review.cross_household_attempt'
  ));

-- Append-only evidence remains immutable to application callers. A postgres-owned,
-- scope-authorized retention function may delete only the explicitly listed tables.
create or replace function academy_private.study_prevent_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     and current_user = 'postgres'
     and current_setting('academy.study_retention_authorized', true) = 'on'
     and tg_table_schema = 'academy_private'
     and tg_table_name in (
       'study_protected_learner_work',
       'study_adult_notes',
       'study_mutation_receipts',
       'study_adult_review_delivery_attempts',
       'study_adult_review_delivery_receipts',
       'study_safety_rate_limit_reservations',
       'study_safety_monitoring_events',
       'study_adult_review_attempt_events',
       'study_adult_review_receipt_events',
       'study_adult_review_audit_events'
     ) then
    return old;
  end if;
  raise exception 'STUDY_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function academy_private.study_adult_review_worker_is_authorized(
  p_worker_id text,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is null
    and academy_private.study_is_trusted_server()
    and exists (
      select 1
      from academy_private.study_adult_review_worker_registry as worker
      where worker.worker_id = p_worker_id
        and worker.status = 'active'
        and worker.revoked_at is null
        and worker.effective_at <= clock_timestamp()
        and p_scope = any(worker.authorized_scopes)
    );
$$;

create or replace function public.academy_study_record_adult_review_monitoring_v2(
  p_worker_id text,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing academy_private.study_safety_monitoring_events%rowtype;
  retention_days integer;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'monitoring'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_event,
    array[
      'schemaVersion', 'eventName', 'eventId', 'occurredAt', 'severity',
      'retentionDays', 'dimensions', 'measurement', 'threshold'
    ]::text[]
  ) or (p_event ->> 'schemaVersion')::integer <> 2
     or jsonb_typeof(p_event -> 'dimensions') <> 'object'
     or jsonb_typeof(p_event -> 'measurement') <> 'object'
     or jsonb_typeof(p_event -> 'threshold') <> 'object'
     or p_event ->> 'severity' not in ('info', 'warning', 'error', 'critical')
     or not public.academy_study_identifier_is_valid(p_event ->> 'eventId')
     or not public.academy_study_identifier_is_valid(
       p_event -> 'measurement' ->> 'name'
     )
     or not public.academy_study_payload_is_minimized(p_event, 4096) then
    raise exception 'STUDY_MONITORING_EVENT_INVALID' using errcode = '22023';
  end if;
  retention_days := (p_event ->> 'retentionDays')::integer;
  if retention_days not in (90, 180, 365) then
    raise exception 'STUDY_MONITORING_RETENTION_INVALID' using errcode = '22023';
  end if;
  select * into existing
  from academy_private.study_safety_monitoring_events
  where event_id = p_event ->> 'eventId';
  if existing.event_id is not null then
    if existing.name <> p_event ->> 'eventName'
       or existing.severity <> p_event ->> 'severity'
       or existing.occurred_at <> (p_event ->> 'occurredAt')::timestamptz then
      raise exception 'STUDY_MONITORING_EVENT_IDEMPOTENCY_COLLISION'
        using errcode = '23505';
    end if;
    return jsonb_build_object('recorded', true);
  end if;
  insert into academy_private.study_safety_monitoring_events (
    event_id, schema_version, name, severity, occurred_at, code, service,
    metric_name, runbook_id, attributes, retain_until
  ) values (
    p_event ->> 'eventId', 2, p_event ->> 'eventName',
    p_event ->> 'severity', (p_event ->> 'occurredAt')::timestamptz,
    'adult-review-monitor', 'study-adult-review',
    p_event -> 'measurement' ->> 'name', 'adult-review-operations-v2',
    jsonb_build_object(
      'dimensions', p_event -> 'dimensions',
      'measurement', p_event -> 'measurement',
      'threshold', p_event -> 'threshold'
    ),
    clock_timestamp() + make_interval(days => retention_days)
  );
  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.academy_study_claim_adult_review_proposals_v2(
  p_worker_id text,
  p_batch_size integer default 10,
  p_lease_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare claimed jsonb;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'proposal-resolution'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_batch_size not between 1 and 50 or p_lease_seconds not between 5 and 300 then
    raise exception 'STUDY_PROPOSAL_CLAIM_INVALID' using errcode = '22023';
  end if;
  update academy_private.study_adult_review_proposals_v1
  set lease_token = null, lease_expires_at = null, lease_owner = null,
      revision = revision + 1, updated_at = clock_timestamp()
  where state = 'proposed' and recipient_resolution_state = 'pending'
    and lease_expires_at <= clock_timestamp();
  update academy_private.study_adult_review_proposals_v1
  set state = 'expired', lease_token = null, lease_expires_at = null,
      lease_owner = null, revision = revision + 1, updated_at = clock_timestamp()
  where state = 'proposed' and expires_at <= clock_timestamp();
  with available as (
    select proposal_id
    from academy_private.study_adult_review_proposals_v1
    where state = 'proposed' and recipient_resolution_state = 'pending'
      and lease_token is null and expires_at > clock_timestamp()
    order by occurred_at, proposal_id
    for update skip locked limit p_batch_size
  ), leased as (
    update academy_private.study_adult_review_proposals_v1 as proposal
    set lease_token = gen_random_uuid(), lease_owner = p_worker_id,
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        lease_generation = lease_generation + 1, revision = revision + 1,
        updated_at = clock_timestamp()
    from available where proposal.proposal_id = available.proposal_id
    returning proposal.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'proposalId', leased.proposal_id,
    'classification', leased.classification,
    'urgency', leased.urgency,
    'occurredAt', leased.occurred_at,
    'leaseToken', leased.lease_token,
    'leaseExpiresAt', leased.lease_expires_at,
    'leaseGeneration', leased.lease_generation,
    'revision', leased.revision
  )), '[]'::jsonb) into claimed from leased;
  return jsonb_build_object('proposals', claimed, 'serverTime', clock_timestamp());
end;
$$;

create or replace function public.academy_study_resolve_adult_recipients_v2(
  p_proposal_id text,
  p_worker_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  resolution jsonb;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'proposal-resolution'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = p_proposal_id;
  if proposal.proposal_id is null or proposal.state <> 'proposed'
     or proposal.expires_at <= clock_timestamp() then
    return jsonb_build_object(
      'state', 'no-authorized-recipient', 'reasonCode', 'proposal-unavailable'
    );
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'recipientRef', permission.recipient_ref,
    'permissionRef', 'permission:' || academy_private.study_sha256_json(
      jsonb_build_object('permissionId', permission.id)
    ),
    'permissionRevision', permission.revision,
    'recipientVersion', permission.permission_version,
    'effectiveAt', permission.effective_at,
    'route', route.channel,
    'routeRef', route.route_ref,
    'routeRevision', route.revision
  ) order by permission.recipient_ref, route.channel), '[]'::jsonb)
  into resolution
  from academy_private.study_adult_notification_permissions as permission
  join academy_private.study_adult_notification_routes as route
    on route.permission_id = permission.id
   and route.household_id = permission.household_id
   and route.student_id = permission.student_id
   and route.recipient_ref = permission.recipient_ref
  join public.academy_guardian_student_access as access
    on access.id = permission.guardian_access_id
   and access.membership_id = permission.membership_id
   and access.household_id = permission.household_id
   and access.student_id = permission.student_id
  join public.academy_household_memberships as membership
    on membership.id = permission.membership_id
   and membership.household_id = permission.household_id
  where permission.household_id = proposal.household_id
    and permission.student_id = proposal.student_id
    and permission.recipient_ref ~ '^recipient:[0-9a-f]{64}$'
    and permission.status = 'active'
    and permission.revoked_at is null
    and permission.effective_at <= proposal.occurred_at
    and (permission.expires_at is null or permission.expires_at > proposal.occurred_at)
    and route.status = 'active' and route.revoked_at is null
    and route.route_ref ~ '^route:[0-9a-f]{64}$'
    and route.channel = any(permission.allowed_channels)
    and membership.member_role = 'guardian'
    and membership.status = 'active' and membership.revoked_at is null
    and membership.user_id is not null
    and access.status = 'active' and access.revoked_at is null;
  if jsonb_array_length(resolution) = 0 then
    return jsonb_build_object(
      'state', 'no-authorized-recipient',
      'reasonCode', 'explicit-permission-not-available'
    );
  end if;
  return jsonb_build_object(
    'state', 'resolved',
    'resolutionRef', 'resolution:' || academy_private.study_sha256_json(
      jsonb_build_object('proposalId', p_proposal_id, 'recipients', resolution)
    ),
    'policyVersion', 'adult-notification-policy-v2',
    'recipients', resolution
  );
end;
$$;

create or replace function public.academy_study_record_recipient_resolution_v2(
  p_worker_id text,
  p_resolution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  recipient jsonb;
  route academy_private.study_adult_notification_routes%rowtype;
  inserted academy_private.study_adult_review_delivery_jobs%rowtype;
  jobs jsonb := '[]'::jsonb;
  requested_state text;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'proposal-resolution'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_resolution) <> 'object'
     or not (p_resolution ?& array[
       'proposalId', 'leaseToken', 'expectedRevision', 'state'
     ]) then
    raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = p_resolution ->> 'proposalId' for update;
  if proposal.proposal_id is null or proposal.state <> 'proposed'
     or proposal.lease_owner <> p_worker_id
     or proposal.lease_token <> (p_resolution ->> 'leaseToken')::uuid
     or proposal.lease_expires_at <= clock_timestamp()
     or proposal.revision <> (p_resolution ->> 'expectedRevision')::bigint then
    raise exception 'STUDY_PROPOSAL_LEASE_CONFLICT' using errcode = '40001';
  end if;
  requested_state := p_resolution ->> 'state';
  if requested_state <> 'resolved' then
    if requested_state not in ('no-authorized-recipient', 'revoked', 'failed')
       or not public.academy_study_json_has_exact_keys(
         p_resolution,
         array[
           'proposalId', 'leaseToken', 'expectedRevision', 'state', 'reasonCode'
         ]::text[]
       ) or not public.academy_study_identifier_is_valid(
         p_resolution ->> 'reasonCode'
       ) then
      raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
    end if;
    update academy_private.study_adult_review_proposals_v1
    set state = case when requested_state = 'revoked' then 'cancelled'
      when requested_state = 'no-authorized-recipient' then 'rejected'
      else 'proposed' end,
      recipient_resolution_state = requested_state,
      lease_token = null, lease_expires_at = null, lease_owner = null,
      revision = revision + 1, updated_at = clock_timestamp()
    where proposal_id = proposal.proposal_id;
    return jsonb_build_object('state', requested_state, 'jobs', '[]'::jsonb);
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_resolution,
    array[
      'proposalId', 'leaseToken', 'expectedRevision', 'state',
      'resolutionRef', 'policyVersion', 'recipients'
    ]::text[]
  ) or jsonb_typeof(p_resolution -> 'recipients') <> 'array'
     or jsonb_array_length(p_resolution -> 'recipients') not between 1 and 32
     or not public.academy_study_identifier_is_valid(
       p_resolution ->> 'resolutionRef'
     ) or not public.academy_study_identifier_is_valid(
       p_resolution ->> 'policyVersion'
     ) then
    raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
  end if;
  for recipient in select value from jsonb_array_elements(p_resolution -> 'recipients')
  loop
    if not public.academy_study_json_has_exact_keys(
      recipient,
      array[
        'recipientRef', 'permissionRef', 'permissionRevision',
        'recipientVersion', 'effectiveAt', 'route', 'routeRef', 'routeRevision'
      ]::text[]
    ) then
      raise exception 'STUDY_RECIPIENT_ROUTE_INVALID' using errcode = '22023';
    end if;
    select route_row.* into route
    from academy_private.study_adult_notification_routes as route_row
    join academy_private.study_adult_notification_permissions as permission
      on permission.id = route_row.permission_id
     and permission.household_id = route_row.household_id
     and permission.student_id = route_row.student_id
    where route_row.route_ref = recipient ->> 'routeRef'
      and route_row.recipient_ref = recipient ->> 'recipientRef'
      and route_row.channel = recipient ->> 'route'
      and route_row.household_id = proposal.household_id
      and route_row.student_id = proposal.student_id
      and route_row.revision = (recipient ->> 'routeRevision')::bigint
      and route_row.status = 'active' and route_row.revoked_at is null
      and permission.revision = (recipient ->> 'permissionRevision')::bigint
      and recipient ->> 'permissionRef' = 'permission:' ||
        academy_private.study_sha256_json(
          jsonb_build_object('permissionId', permission.id)
        )
      and (recipient ->> 'recipientVersion')::integer = permission.permission_version
      and (recipient ->> 'effectiveAt')::timestamptz = permission.effective_at
      and permission.status = 'active' and permission.revoked_at is null
      and permission.effective_at <= proposal.occurred_at
      and (permission.expires_at is null
        or permission.expires_at > proposal.occurred_at);
    if route.route_ref is null then
      raise exception 'STUDY_RECIPIENT_ROUTE_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    insert into academy_private.study_adult_review_delivery_jobs (
      proposal_id, household_id, student_id, recipient_ref, route_ref,
      channel, delivery_idempotency_key
    ) values (
      proposal.proposal_id, proposal.household_id, proposal.student_id,
      route.recipient_ref, route.route_ref, route.channel,
      'delivery:' || academy_private.study_sha256_json(jsonb_build_object(
        'proposalId', proposal.proposal_id,
        'recipientRef', route.recipient_ref,
        'routeRef', route.route_ref
      ))
    ) on conflict (proposal_id, recipient_ref, route_ref) do update
      set updated_at = academy_private.study_adult_review_delivery_jobs.updated_at
    returning * into inserted;
    jobs := jobs || jsonb_build_array(jsonb_build_object(
      'jobId', inserted.id, 'proposalId', inserted.proposal_id,
      'recipientRef', inserted.recipient_ref, 'routeRef', inserted.route_ref,
      'route', inserted.channel, 'idempotencyKey', inserted.delivery_idempotency_key,
      'state', inserted.state, 'revision', inserted.revision
    ));
  end loop;
  update academy_private.study_adult_review_proposals_v1
  set state = 'accepted', recipient_resolution_state = 'resolved',
      resolution_ref = p_resolution ->> 'resolutionRef',
      resolution_policy_version = p_resolution ->> 'policyVersion',
      lease_token = null, lease_expires_at = null, lease_owner = null,
      revision = revision + 1, updated_at = clock_timestamp()
  where proposal_id = proposal.proposal_id;
  return jsonb_build_object('state', 'resolved', 'jobs', jobs);
end;
$$;

create or replace function public.academy_study_claim_delivery_jobs_v2(
  p_worker_id text,
  p_batch_size integer default 10,
  p_lease_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  claimed jsonb;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_batch_size not between 1 and 50 or p_lease_seconds not between 5 and 300 then
    raise exception 'STUDY_DELIVERY_CLAIM_INVALID' using errcode = '22023';
  end if;
  -- Submitted work is quarantined. Work with only a created event is safe to
  -- recover because the provider boundary has not been crossed.
  update academy_private.study_adult_review_delivery_jobs as job
  set state = case when exists (
        select 1 from academy_private.study_adult_review_attempt_events as event
        join academy_private.study_adult_review_delivery_attempts as attempt
          on attempt.attempt_id = event.attempt_id
        where attempt.job_id = job.id
          and attempt.lease_generation = job.lease_generation
          and event.state in ('submitted', 'provider-accepted', 'timeout-indeterminate')
      ) then 'indeterminate' else 'pending' end,
      last_failure_code = case when exists (
        select 1 from academy_private.study_adult_review_attempt_events as event
        join academy_private.study_adult_review_delivery_attempts as attempt
          on attempt.attempt_id = event.attempt_id
        where attempt.job_id = job.id
          and attempt.lease_generation = job.lease_generation
          and event.state in ('submitted', 'provider-accepted', 'timeout-indeterminate')
      ) then 'lease-expired-after-submit' else null end,
      failed_at = case when exists (
        select 1 from academy_private.study_adult_review_attempt_events as event
        join academy_private.study_adult_review_delivery_attempts as attempt
          on attempt.attempt_id = event.attempt_id
        where attempt.job_id = job.id
          and attempt.lease_generation = job.lease_generation
          and event.state in ('submitted', 'provider-accepted', 'timeout-indeterminate')
      ) then clock_timestamp() else null end,
      lease_token = null, lease_expires_at = null, lease_owner = null,
      revision = revision + 1, updated_at = clock_timestamp()
  where job.state = 'leased' and job.lease_expires_at <= clock_timestamp();

  with available as (
    select job.id
    from academy_private.study_adult_review_delivery_jobs as job
    join academy_private.study_adult_review_proposals_v1 as proposal
      on proposal.proposal_id = job.proposal_id
    where job.state in ('pending', 'retryable')
      and (job.retry_at is null or job.retry_at <= clock_timestamp())
      and proposal.state = 'accepted'
      and proposal.expires_at > clock_timestamp()
    order by job.created_at, job.id
    for update of job skip locked
    limit p_batch_size
  ), leased as (
    update academy_private.study_adult_review_delivery_jobs as job
    set state = 'leased', retry_at = null, last_failure_code = null,
        failed_at = null, lease_token = gen_random_uuid(),
        lease_owner = p_worker_id,
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        lease_generation = lease_generation + 1,
        revision = revision + 1, updated_at = clock_timestamp()
    from available
    where job.id = available.id
    returning job.id, job.proposal_id, job.recipient_ref, job.route_ref,
      job.channel, job.delivery_idempotency_key, job.lease_token,
      job.lease_expires_at, job.lease_generation, job.revision
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', leased.id, 'proposalId', leased.proposal_id,
    'recipientRef', leased.recipient_ref, 'routeRef', leased.route_ref,
    'route', leased.channel,
    'idempotencyKey', leased.delivery_idempotency_key,
    'leaseToken', leased.lease_token, 'leaseExpiresAt', leased.lease_expires_at,
    'leaseGeneration', leased.lease_generation, 'revision', leased.revision
  )), '[]'::jsonb) into claimed from leased;
  return jsonb_build_object('jobs', claimed, 'serverTime', clock_timestamp());
end;
$$;

create or replace function public.academy_study_renew_delivery_lease_v2(
  p_worker_id text,
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_revision bigint,
  p_lease_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare updated_job academy_private.study_adult_review_delivery_jobs%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) or p_lease_seconds not between 5 and 300 then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  update academy_private.study_adult_review_delivery_jobs
  set lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      revision = revision + 1, updated_at = clock_timestamp()
  where id = p_job_id and state = 'leased' and lease_owner = p_worker_id
    and lease_token = p_lease_token and revision = p_expected_revision
    and lease_expires_at > clock_timestamp()
  returning * into updated_job;
  if updated_job.id is null then
    raise exception 'STUDY_DELIVERY_LEASE_CONFLICT' using errcode = '40001';
  end if;
  return jsonb_build_object(
    'renewed', true, 'revision', updated_job.revision,
    'leaseExpiresAt', updated_job.lease_expires_at
  );
end;
$$;

create or replace function public.academy_study_release_delivery_lease_v2(
  p_worker_id text,
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if exists (
    select 1 from academy_private.study_adult_review_attempt_events as event
    join academy_private.study_adult_review_delivery_attempts as attempt
      on attempt.attempt_id = event.attempt_id
    where attempt.job_id = p_job_id
      and event.state in ('submitted', 'provider-accepted', 'timeout-indeterminate')
  ) then
    raise exception 'STUDY_DELIVERY_RELEASE_UNSAFE' using errcode = '22023';
  end if;
  update academy_private.study_adult_review_delivery_jobs
  set state = 'pending', lease_token = null, lease_expires_at = null,
      lease_owner = null, revision = revision + 1, updated_at = clock_timestamp()
  where id = p_job_id and state = 'leased' and lease_owner = p_worker_id
    and lease_token = p_lease_token and revision = p_expected_revision;
  if not found then
    raise exception 'STUDY_DELIVERY_LEASE_CONFLICT' using errcode = '40001';
  end if;
  return jsonb_build_object('released', true);
end;
$$;

create or replace function public.academy_study_record_worker_crash_v2(
  p_worker_id text,
  p_job_id uuid,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'monitoring'
  ) or not public.academy_study_identifier_is_valid(p_reason_code) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  insert into academy_private.study_adult_review_audit_events
    (event_name, severity, worker_id, job_ref, reason_code)
  values ('worker-crash', 'critical', p_worker_id, p_job_id::text, p_reason_code);
  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.academy_study_cancel_invalid_delivery_jobs_v2(
  p_worker_id text,
  p_batch_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare cancelled_count integer;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) or p_batch_size not between 1 and 100 then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  with invalid as (
    select job.id
    from academy_private.study_adult_review_delivery_jobs as job
    join academy_private.study_adult_review_proposals_v1 as proposal
      on proposal.proposal_id = job.proposal_id
    join academy_private.study_adult_notification_routes as route
      on route.route_ref = job.route_ref
    join academy_private.study_adult_notification_permissions as permission
      on permission.id = route.permission_id
    where job.state in ('pending', 'retryable')
      and (proposal.expires_at <= clock_timestamp()
        or proposal.state in ('cancelled', 'expired')
        or route.status <> 'active' or route.revoked_at is not null
        or permission.status <> 'active' or permission.revoked_at is not null)
    order by job.created_at
    for update of job skip locked
    limit p_batch_size
  )
  update academy_private.study_adult_review_delivery_jobs as job
  set state = 'cancelled', lease_token = null, lease_expires_at = null,
      lease_owner = null, retry_at = null, revision = revision + 1,
      updated_at = clock_timestamp()
  from invalid where job.id = invalid.id;
  get diagnostics cancelled_count = row_count;
  return jsonb_build_object('cancelledCount', cancelled_count);
end;
$$;

create or replace function public.academy_study_reserve_rate_limit_v2(
  p_scope text,
  p_actor_ref text,
  p_household_ref text default 'none',
  p_learner_ref text default 'none',
  p_route_ref text default 'none',
  p_worker_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  bucket academy_private.study_safety_rate_limit_buckets%rowtype;
  window_start timestamptz;
  limit_capacity integer;
  allowed boolean;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_scope not in (
    'classification', 'proposal-creation', 'recipient-resolution',
    'worker-claim', 'delivery-attempt', 'parent-notification-read'
  ) or p_actor_ref !~ '^actor:[0-9a-f]{64}$'
     or (p_household_ref <> 'none' and p_household_ref !~ '^household:[0-9a-f]{64}$')
     or (p_learner_ref <> 'none' and p_learner_ref !~ '^learner:[0-9a-f]{64}$')
     or (p_route_ref <> 'none' and p_route_ref !~ '^route:[0-9a-f]{64}$') then
    raise exception 'STUDY_RATE_LIMIT_SCOPE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if p_scope in ('worker-claim', 'delivery-attempt')
     and not academy_private.study_adult_review_worker_is_authorized(
       p_worker_id, 'rate-limit'
     ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  limit_capacity := case p_scope
    when 'classification' then 20 when 'proposal-creation' then 10
    when 'recipient-resolution' then 30 when 'worker-claim' then 120
    when 'delivery-attempt' then 60 else 120 end;
  window_start := date_trunc('minute', clock_timestamp());
  insert into academy_private.study_safety_rate_limit_buckets (
    actor_ref, household_ref, learner_ref, route_ref, scope,
    window_started_at, window_seconds, capacity, used
  ) values (
    p_actor_ref, p_household_ref, p_learner_ref, p_route_ref, p_scope,
    window_start, 60, limit_capacity, 0
  ) on conflict (
    actor_ref, household_ref, learner_ref, route_ref, scope,
    window_started_at, window_seconds
  ) do nothing;
  select * into bucket
  from academy_private.study_safety_rate_limit_buckets
  where actor_ref = p_actor_ref and household_ref = p_household_ref
    and learner_ref = p_learner_ref and route_ref = p_route_ref
    and scope = p_scope and window_started_at = window_start
    and window_seconds = 60
  for update;
  allowed := bucket.used < bucket.capacity;
  if allowed then
    update academy_private.study_safety_rate_limit_buckets
    set used = used + 1, revision = revision + 1, updated_at = clock_timestamp()
    where id = bucket.id;
  end if;
  insert into academy_private.study_safety_rate_limit_reservations (
    actor_ref, household_ref, learner_ref, route_ref, scope, bucket_id,
    request_digest, allowed, reserved_at
  ) values (
    p_actor_ref, p_household_ref, p_learner_ref, p_route_ref, p_scope,
    bucket.id, academy_private.study_sha256_json(jsonb_build_object(
      'scope', p_scope, 'actorRef', p_actor_ref,
      'reservedAt', clock_timestamp()
    )), allowed, clock_timestamp()
  );
  return case when allowed then jsonb_build_object('allowed', true)
    else jsonb_build_object(
      'allowed', false, 'reasonCode', 'rate-limit-threshold',
      'retryAfterSeconds', greatest(1, 60 - extract(second from clock_timestamp())::integer)
    ) end;
end;
$$;

create or replace function public.academy_study_create_delivery_attempt_v2(
  p_worker_id text,
  p_attempt jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  existing academy_private.study_adult_review_delivery_attempts%rowtype;
  ordinal integer;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_attempt,
    array[
      'jobId', 'leaseToken', 'expectedRevision', 'attemptId',
      'providerName', 'providerConfigVersion'
    ]::text[]
  ) or not public.academy_study_identifier_is_valid(p_attempt ->> 'attemptId')
     or p_attempt ->> 'providerName' not in ('in-app', 'email', 'sms')
     or not public.academy_study_identifier_is_valid(
       p_attempt ->> 'providerConfigVersion'
     ) then
    raise exception 'STUDY_DELIVERY_ATTEMPT_INVALID' using errcode = '22023';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = (p_attempt ->> 'jobId')::uuid for update;
  if job.id is null or job.state <> 'leased' or job.lease_owner <> p_worker_id
     or job.lease_token <> (p_attempt ->> 'leaseToken')::uuid
     or job.lease_expires_at <= clock_timestamp()
     or job.revision <> (p_attempt ->> 'expectedRevision')::bigint
     or job.channel <> p_attempt ->> 'providerName' then
    raise exception 'STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_attempt ->> 'attemptId';
  if existing.attempt_id is not null then
    if existing.job_id <> job.id
       or existing.lease_generation <> job.lease_generation
       or existing.provider_name <> p_attempt ->> 'providerName'
       or existing.provider_config_version <> p_attempt ->> 'providerConfigVersion' then
      raise exception 'STUDY_DELIVERY_ATTEMPT_IDEMPOTENCY_COLLISION'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'created', false, 'attemptId', existing.attempt_id,
      'revision', job.revision
    );
  end if;
  ordinal := job.attempt_count + 1;
  insert into academy_private.study_adult_review_delivery_attempts (
    attempt_id, job_id, household_id, student_id, attempt_ordinal,
    lease_generation, delivery_idempotency_key, recipient_ref, route_ref,
    channel, provider_version, provider_name, provider_config_version,
    authorization_evidence_ref, attempted_at
  ) values (
    p_attempt ->> 'attemptId', job.id, job.household_id, job.student_id,
    ordinal, job.lease_generation, job.delivery_idempotency_key,
    job.recipient_ref, job.route_ref, job.channel,
    (p_attempt ->> 'providerName') || ':' || (p_attempt ->> 'providerConfigVersion'),
    p_attempt ->> 'providerName', p_attempt ->> 'providerConfigVersion',
    'authorization:' || academy_private.study_sha256_json(jsonb_build_object(
      'jobId', job.id, 'leaseGeneration', job.lease_generation,
      'recipientRef', job.recipient_ref
    )), clock_timestamp()
  );
  update academy_private.study_adult_review_delivery_jobs
  set attempt_count = ordinal, revision = revision + 1,
      updated_at = clock_timestamp()
  where id = job.id returning * into job;
  return jsonb_build_object(
    'created', true, 'attemptId', p_attempt ->> 'attemptId',
    'attemptCount', ordinal, 'revision', job.revision
  );
end;
$$;

create or replace function public.academy_study_record_attempt_event_v2(
  p_worker_id text,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  attempt academy_private.study_adult_review_delivery_attempts%rowtype;
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  prior_state text;
  requested_state text;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_event,
    array[
      'attemptId', 'jobId', 'state', 'structuredResult', 'timeoutState',
      'retryDecision', 'errorCode'
    ]::text[]
  ) then
    raise exception 'STUDY_ATTEMPT_EVENT_INVALID' using errcode = '22023';
  end if;
  select * into attempt
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_event ->> 'attemptId'
    and job_id = (p_event ->> 'jobId')::uuid;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = attempt.job_id for update;
  if attempt.attempt_id is null or job.id is null
     or job.state <> 'leased' or job.lease_owner <> p_worker_id
     or job.lease_expires_at <= clock_timestamp()
     or attempt.lease_generation <> job.lease_generation then
    raise exception 'STUDY_ATTEMPT_EVENT_BINDING_MISMATCH' using errcode = '42501';
  end if;
  requested_state := p_event ->> 'state';
  if requested_state not in (
    'created', 'submitted', 'provider-accepted', 'provider-rejected',
    'timeout-indeterminate', 'receipt-verified', 'receipt-rejected',
    'permanent-failure'
  ) or not public.academy_study_identifier_is_valid(
    p_event ->> 'structuredResult'
  ) or p_event ->> 'timeoutState' not in (
    'not-timed-out', 'before-submit', 'after-submit'
  ) or p_event ->> 'retryDecision' not in (
    'not-applicable', 'safe-retry', 'do-not-retry', 'reconcile'
  ) or (
    p_event ->> 'errorCode' is not null
    and not public.academy_study_identifier_is_valid(p_event ->> 'errorCode')
  ) then
    raise exception 'STUDY_ATTEMPT_EVENT_INVALID' using errcode = '22023';
  end if;
  select event.state into prior_state
  from academy_private.study_adult_review_attempt_events as event
  where event.attempt_id = attempt.attempt_id
  order by event.occurred_at desc, event.event_id desc limit 1;
  if not (
    (prior_state is null and requested_state = 'created')
    or (prior_state = 'created' and requested_state in ('submitted', 'permanent-failure'))
    or (prior_state = 'submitted' and requested_state in (
      'provider-accepted', 'provider-rejected', 'timeout-indeterminate',
      'permanent-failure'
    ))
    or (prior_state in ('provider-accepted', 'timeout-indeterminate')
      and requested_state in (
        'receipt-verified', 'receipt-rejected', 'permanent-failure'
      ))
    or (prior_state in ('provider-rejected', 'receipt-rejected')
      and requested_state = 'permanent-failure')
  ) then
    raise exception 'STUDY_ATTEMPT_EVENT_TRANSITION_INVALID' using errcode = '22023';
  end if;
  insert into academy_private.study_adult_review_attempt_events (
    attempt_id, job_id, state, occurred_at, completed_at, structured_result,
    timeout_state, retry_decision, error_code, lease_generation,
    provider_name, provider_config_version, delivery_idempotency_key
  ) values (
    attempt.attempt_id, attempt.job_id, requested_state, clock_timestamp(),
    case when requested_state in (
      'provider-rejected', 'receipt-verified', 'receipt-rejected',
      'permanent-failure'
    ) then clock_timestamp() else null end,
    p_event ->> 'structuredResult', p_event ->> 'timeoutState',
    p_event ->> 'retryDecision', nullif(p_event ->> 'errorCode', ''),
    attempt.lease_generation, attempt.provider_name,
    attempt.provider_config_version, attempt.delivery_idempotency_key
  );
  return jsonb_build_object('recorded', true, 'state', requested_state);
end;
$$;

create or replace function public.academy_study_deliver_in_app_notification_v2(
  p_worker_id text,
  p_delivery jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  attempt academy_private.study_adult_review_delivery_attempts%rowtype;
  permission academy_private.study_adult_notification_permissions%rowtype;
  existing academy_private.study_parent_notifications%rowtype;
  notification academy_private.study_parent_notifications%rowtype;
  receipt academy_private.study_adult_review_delivery_receipts%rowtype;
  delivered_time timestamptz := clock_timestamp();
  notification_ref text;
  receipt_ref text;
  evidence_ref text;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_delivery,
    array[
      'schemaVersion', 'jobId', 'leaseToken', 'expectedRevision',
      'attemptId', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef',
      'providerName', 'providerConfigVersion'
    ]::text[]
  ) or (p_delivery ->> 'schemaVersion')::integer <> 2
     or p_delivery ->> 'providerName' <> 'academy-in-app'
     or p_delivery ->> 'providerConfigVersion' <> 'in-app-config-v1' then
    raise exception 'STUDY_IN_APP_DELIVERY_INVALID' using errcode = '22023';
  end if;
  select * into existing
  from academy_private.study_parent_notifications
  where delivery_idempotency_key = p_delivery ->> 'deliveryIdempotencyKey';
  if existing.id is not null then
    if existing.job_id <> (p_delivery ->> 'jobId')::uuid
       or existing.recipient_ref <> p_delivery ->> 'recipientRef'
       or existing.route_ref <> p_delivery ->> 'routeRef' then
      raise exception 'STUDY_IN_APP_IDEMPOTENCY_COLLISION' using errcode = '23505';
    end if;
    select * into receipt
    from academy_private.study_adult_review_delivery_receipts
    where job_id = existing.job_id and attempt_id = existing.attempt_id;
    return jsonb_build_object(
      'state', 'already-delivered',
      'providerReceiptRef', receipt.provider_receipt_ref,
      'jobId', existing.job_id,
      'attemptId', existing.attempt_id,
      'deliveredAt', existing.delivered_at,
      'evidenceRef', receipt.receipt_evidence_ref,
      'notification', jsonb_build_object(
        'title', existing.learner_safe_title,
        'reasonCategory', existing.reason_category,
        'urgency', existing.urgency,
        'actionRef', existing.action_ref
      )
    );
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = (p_delivery ->> 'jobId')::uuid for update;
  if job.id is null or job.state <> 'leased' or job.lease_owner <> p_worker_id
     or job.lease_token <> (p_delivery ->> 'leaseToken')::uuid
     or job.lease_expires_at <= delivered_time
     or job.revision <> (p_delivery ->> 'expectedRevision')::bigint
     or job.channel <> 'in-app'
     or job.delivery_idempotency_key <> p_delivery ->> 'deliveryIdempotencyKey'
     or job.recipient_ref <> p_delivery ->> 'recipientRef'
     or job.route_ref <> p_delivery ->> 'routeRef' then
    raise exception 'STUDY_IN_APP_DELIVERY_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = job.proposal_id;
  select permission_row.* into permission
  from academy_private.study_adult_notification_routes as route
  join academy_private.study_adult_notification_permissions as permission_row
    on permission_row.id = route.permission_id
   and permission_row.household_id = route.household_id
   and permission_row.student_id = route.student_id
  join public.academy_household_memberships as membership
    on membership.id = permission_row.membership_id
   and membership.household_id = permission_row.household_id
  join public.academy_guardian_student_access as access
    on access.id = permission_row.guardian_access_id
   and access.membership_id = membership.id
   and access.student_id = permission_row.student_id
  where route.route_ref = job.route_ref and route.channel = 'in-app'
    and route.status = 'active' and route.revoked_at is null
    and permission_row.recipient_ref = job.recipient_ref
    and permission_row.status = 'active' and permission_row.revoked_at is null
    and permission_row.effective_at <= proposal.occurred_at
    and (permission_row.expires_at is null
      or permission_row.expires_at > proposal.occurred_at)
    and (permission_row.expires_at is null
      or permission_row.expires_at > delivered_time)
    and membership.member_role = 'guardian'
    and membership.status = 'active' and membership.revoked_at is null
    and access.status = 'active' and access.revoked_at is null;
  if permission.id is null then
    return jsonb_build_object(
      'state', 'revoked', 'reasonCode', 'recipient-revoked-before-insert'
    );
  end if;
  select * into attempt
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_delivery ->> 'attemptId' and job_id = job.id;
  if attempt.attempt_id is null
     or attempt.lease_generation <> job.lease_generation
     or attempt.provider_name <> 'in-app'
     or attempt.provider_config_version <> 'in-app-config-v1'
     or not exists (
       select 1 from academy_private.study_adult_review_attempt_events
       where attempt_id = attempt.attempt_id and state = 'provider-accepted'
     ) then
    raise exception 'STUDY_IN_APP_ATTEMPT_NOT_ACCEPTED' using errcode = '42501';
  end if;
  notification_ref := 'notification:' || academy_private.study_sha256_json(
    jsonb_build_object('deliveryIdempotencyKey', job.delivery_idempotency_key)
  );
  receipt_ref := 'in-app-receipt:' || academy_private.study_sha256_json(
    jsonb_build_object(
      'deliveryIdempotencyKey', job.delivery_idempotency_key,
      'attemptId', attempt.attempt_id
    )
  );
  evidence_ref := 'in-app-evidence:' || academy_private.study_sha256_json(
    jsonb_build_object('notificationRef', notification_ref, 'at', delivered_time)
  );
  insert into academy_private.study_parent_notifications (
    notification_ref, household_id, student_id, membership_id,
    permission_id, permission_revision, recipient_ref, route_ref,
    proposal_id, job_id, attempt_id, delivery_idempotency_key,
    learner_safe_title, reason_category, urgency, action_ref, delivered_at
  ) values (
    notification_ref, job.household_id, job.student_id,
    permission.membership_id, permission.id, permission.revision,
    job.recipient_ref, job.route_ref, job.proposal_id, job.id,
    attempt.attempt_id, job.delivery_idempotency_key,
    'Study check-in needs your review',
    case proposal.classification when 'urgent' then 'immediate-safety'
      when 'uncertain' then 'possible-safety' else 'review-required' end,
    proposal.urgency, 'adult-review:' || proposal.proposal_id, delivered_time
  ) returning * into notification;
  insert into academy_private.study_adult_review_delivery_receipts (
    attempt_id, job_id, household_id, student_id, provider_version,
    provider_receipt_ref, receipt_evidence_ref, delivered_at,
    route_ref, channel, recipient_ref, delivery_idempotency_key,
    provider_name, provider_config_version
  ) values (
    attempt.attempt_id, job.id, job.household_id, job.student_id,
    'academy-in-app:in-app-config-v1', receipt_ref, evidence_ref,
    delivered_time, job.route_ref, job.channel, job.recipient_ref,
    job.delivery_idempotency_key, 'in-app', 'in-app-config-v1'
  ) returning * into receipt;
  insert into academy_private.study_adult_review_attempt_events (
    attempt_id, job_id, state, occurred_at, completed_at, structured_result,
    timeout_state, receipt_reference, retry_decision, lease_generation,
    provider_name, provider_config_version, delivery_idempotency_key
  ) values (
    attempt.attempt_id, job.id, 'receipt-verified', delivered_time,
    delivered_time, 'in-app-visible', 'not-timed-out', receipt.id,
    'do-not-retry', attempt.lease_generation, 'in-app',
    'in-app-config-v1', job.delivery_idempotency_key
  );
  update academy_private.study_adult_review_delivery_jobs
  set state = 'delivered', delivered_at = delivered_time,
      receipt_reference = receipt.id, lease_token = null,
      lease_expires_at = null, lease_owner = null,
      revision = revision + 1, updated_at = delivered_time
  where id = job.id;
  return jsonb_build_object(
    'state', 'delivered', 'providerReceiptRef', receipt_ref,
    'jobId', job.id, 'attemptId', attempt.attempt_id,
    'deliveredAt', delivered_time, 'evidenceRef', evidence_ref,
    'notification', jsonb_build_object(
      'title', notification.learner_safe_title,
      'reasonCategory', notification.reason_category,
      'urgency', notification.urgency,
      'actionRef', notification.action_ref
    )
  );
end;
$$;

create or replace function public.academy_study_verify_in_app_notification_v2(
  p_worker_id text,
  p_binding jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  notification academy_private.study_parent_notifications%rowtype;
  receipt academy_private.study_adult_review_delivery_receipts%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_binding,
    array[
      'deliveryIdempotencyKey', 'recipientRef', 'routeRef',
      'providerReceiptRef'
    ]::text[]
  ) then
    raise exception 'STUDY_IN_APP_RECEIPT_INVALID' using errcode = '22023';
  end if;
  select * into notification
  from academy_private.study_parent_notifications
  where delivery_idempotency_key = p_binding ->> 'deliveryIdempotencyKey'
    and recipient_ref = p_binding ->> 'recipientRef'
    and route_ref = p_binding ->> 'routeRef';
  select * into receipt
  from academy_private.study_adult_review_delivery_receipts
  where job_id = notification.job_id
    and attempt_id = notification.attempt_id
    and provider_receipt_ref = p_binding ->> 'providerReceiptRef'
    and provider_name = 'in-app'
    and provider_config_version = 'in-app-config-v1';
  if notification.id is null or receipt.id is null then
    return jsonb_build_object('verified', false);
  end if;
  return jsonb_build_object(
    'verified', true,
    'providerReceiptRef', receipt.provider_receipt_ref,
    'jobId', notification.job_id,
    'attemptId', notification.attempt_id,
    'deliveryIdempotencyKey', notification.delivery_idempotency_key,
    'recipientRef', notification.recipient_ref,
    'routeRef', notification.route_ref,
    'providerName', 'academy-in-app',
    'providerConfigVersion', 'in-app-config-v1',
    'deliveredAt', notification.delivered_at,
    'evidenceRef', receipt.receipt_evidence_ref,
    'notification', jsonb_build_object(
      'title', notification.learner_safe_title,
      'reasonCategory', notification.reason_category,
      'urgency', notification.urgency,
      'actionRef', notification.action_ref
    )
  );
end;
$$;

create or replace function public.academy_study_list_parent_notifications_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare result jsonb;
begin
  if auth.uid() is null or p_limit not between 1 and 100 then
    raise exception 'STUDY_GUARDIAN_REQUIRED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'notificationId', notification.notification_ref,
    'title', notification.learner_safe_title,
    'reasonCategory', notification.reason_category,
    'urgency', notification.urgency,
    'createdAt', notification.created_at,
    'deliveredAt', notification.delivered_at,
    'read', notification.read_at is not null,
    'actionRef', notification.action_ref
  ) order by notification.created_at desc), '[]'::jsonb)
  into result
  from (
    select n.*
    from academy_private.study_parent_notifications as n
    join public.academy_household_memberships as membership
      on membership.id = n.membership_id
     and membership.household_id = n.household_id
    join public.academy_guardian_student_access as access
      on access.membership_id = membership.id
     and access.household_id = n.household_id
     and access.student_id = n.student_id
    join academy_private.study_adult_notification_permissions as permission
      on permission.id = n.permission_id
     and permission.membership_id = membership.id
    where membership.user_id = auth.uid()
      and membership.member_role = 'guardian'
      and membership.status = 'active' and membership.revoked_at is null
      and access.status = 'active' and access.revoked_at is null
      and permission.status = 'active' and permission.revoked_at is null
      and permission.effective_at <= clock_timestamp()
      and (permission.expires_at is null or permission.expires_at > clock_timestamp())
      and n.revoked_at is null and n.retain_until > clock_timestamp()
    order by n.created_at desc
    limit p_limit
  ) as notification;
  return jsonb_build_object('notifications', result);
end;
$$;

create or replace function public.academy_study_mark_parent_notification_read_v1(
  p_notification_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'STUDY_GUARDIAN_REQUIRED' using errcode = '42501';
  end if;
  update academy_private.study_parent_notifications as notification
  set read_at = coalesce(read_at, clock_timestamp())
  from public.academy_household_memberships as membership,
       public.academy_guardian_student_access as access,
       academy_private.study_adult_notification_permissions as permission
  where notification.notification_ref = p_notification_ref
    and membership.id = notification.membership_id
    and membership.household_id = notification.household_id
    and membership.user_id = auth.uid()
    and membership.member_role = 'guardian'
    and membership.status = 'active' and membership.revoked_at is null
    and access.membership_id = membership.id
    and access.household_id = notification.household_id
    and access.student_id = notification.student_id
    and access.status = 'active' and access.revoked_at is null
    and permission.id = notification.permission_id
    and permission.status = 'active' and permission.revoked_at is null
    and permission.effective_at <= clock_timestamp()
    and (permission.expires_at is null or permission.expires_at > clock_timestamp())
    and notification.revoked_at is null
    and notification.retain_until > clock_timestamp();
  if not found then
    raise exception 'STUDY_NOTIFICATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return jsonb_build_object('read', true);
end;
$$;

create or replace function public.academy_study_purge_adult_review_retention_v2(
  p_worker_id text,
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cutoff timestamptz := clock_timestamp();
  notifications_deleted integer := 0;
  receipt_events_deleted integer := 0;
  attempt_events_deleted integer := 0;
  receipts_deleted integer := 0;
  attempts_deleted integer := 0;
  jobs_deleted integer := 0;
  proposals_deleted integer := 0;
  reservations_deleted integer := 0;
  buckets_deleted integer := 0;
  monitoring_deleted integer := 0;
  audit_deleted integer := 0;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'retention'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_batch_size not between 1 and 5000 then
    raise exception 'STUDY_RETENTION_BATCH_INVALID' using errcode = '22023';
  end if;

  perform set_config('academy.study_retention_authorized', 'on', true);

  delete from academy_private.study_parent_notifications
  where id in (
    select id from academy_private.study_parent_notifications
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics notifications_deleted = row_count;

  delete from academy_private.study_adult_review_receipt_events
  where event_id in (
    select event_id from academy_private.study_adult_review_receipt_events
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics receipt_events_deleted = row_count;

  delete from academy_private.study_adult_review_attempt_events
  where event_id in (
    select event_id from academy_private.study_adult_review_attempt_events
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics attempt_events_deleted = row_count;

  delete from academy_private.study_adult_review_delivery_receipts
  where id in (
    select receipt.id
    from academy_private.study_adult_review_delivery_receipts as receipt
    join academy_private.study_adult_review_delivery_jobs as job
      on job.id = receipt.job_id
    where receipt.retain_until <= cutoff
      and job.state in ('delivered', 'permanent-failure', 'cancelled')
      and not exists (
        select 1 from academy_private.study_parent_notifications as notification
        where notification.job_id = receipt.job_id
          and notification.attempt_id = receipt.attempt_id
      )
    order by receipt.retain_until limit p_batch_size
  );
  get diagnostics receipts_deleted = row_count;

  delete from academy_private.study_adult_review_delivery_attempts
  where attempt_id in (
    select attempt.attempt_id
    from academy_private.study_adult_review_delivery_attempts as attempt
    join academy_private.study_adult_review_delivery_jobs as job
      on job.id = attempt.job_id
    where attempt.retain_until <= cutoff
      and job.state in ('delivered', 'permanent-failure', 'cancelled')
      and not exists (
        select 1 from academy_private.study_adult_review_delivery_receipts as receipt
        where receipt.attempt_id = attempt.attempt_id
      )
      and not exists (
        select 1 from academy_private.study_adult_review_attempt_events as event
        where event.attempt_id = attempt.attempt_id
      )
      and not exists (
        select 1 from academy_private.study_adult_review_receipt_events as event
        where event.attempt_id = attempt.attempt_id
      )
      and not exists (
        select 1 from academy_private.study_parent_notifications as notification
        where notification.attempt_id = attempt.attempt_id
      )
    order by attempt.retain_until limit p_batch_size
  );
  get diagnostics attempts_deleted = row_count;

  delete from academy_private.study_adult_review_delivery_jobs
  where id in (
    select job.id
    from academy_private.study_adult_review_delivery_jobs as job
    where job.retain_until <= cutoff
      and job.state in ('delivered', 'permanent-failure', 'cancelled')
      and not exists (
        select 1 from academy_private.study_adult_review_delivery_attempts as attempt
        where attempt.job_id = job.id
      )
      and not exists (
        select 1 from academy_private.study_parent_notifications as notification
        where notification.job_id = job.id
      )
    order by job.retain_until limit p_batch_size
  );
  get diagnostics jobs_deleted = row_count;

  delete from academy_private.study_adult_review_proposals_v1
  where proposal_id in (
    select proposal.proposal_id
    from academy_private.study_adult_review_proposals_v1 as proposal
    where proposal.retain_until <= cutoff
      and proposal.state in ('rejected', 'cancelled', 'expired')
      and not exists (
        select 1 from academy_private.study_adult_review_delivery_jobs as job
        where job.proposal_id = proposal.proposal_id
      )
    order by proposal.retain_until limit p_batch_size
  );
  get diagnostics proposals_deleted = row_count;

  delete from academy_private.study_safety_rate_limit_reservations
  where id in (
    select id from academy_private.study_safety_rate_limit_reservations
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics reservations_deleted = row_count;

  delete from academy_private.study_safety_rate_limit_buckets
  where id in (
    select bucket.id
    from academy_private.study_safety_rate_limit_buckets as bucket
    where bucket.retain_until <= cutoff
      and not exists (
        select 1 from academy_private.study_safety_rate_limit_reservations as reservation
        where reservation.bucket_id = bucket.id
      )
    order by bucket.retain_until limit p_batch_size
  );
  get diagnostics buckets_deleted = row_count;

  delete from academy_private.study_safety_monitoring_events
  where event_id in (
    select event_id from academy_private.study_safety_monitoring_events
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics monitoring_deleted = row_count;

  delete from academy_private.study_adult_review_audit_events
  where event_id in (
    select event_id from academy_private.study_adult_review_audit_events
    where retain_until <= cutoff order by retain_until limit p_batch_size
  );
  get diagnostics audit_deleted = row_count;

  insert into academy_private.study_adult_review_audit_events (
    event_name, severity, worker_id, reason_code, dimensions
  ) values (
    'retention-purge', 'info', p_worker_id, 'retention-purge-completed',
    jsonb_build_object(
      'notifications', notifications_deleted,
      'receiptEvents', receipt_events_deleted,
      'attemptEvents', attempt_events_deleted,
      'receipts', receipts_deleted,
      'attempts', attempts_deleted,
      'jobs', jobs_deleted,
      'proposals', proposals_deleted,
      'reservations', reservations_deleted,
      'buckets', buckets_deleted,
      'monitoring', monitoring_deleted,
      'audit', audit_deleted
    )
  );

  return jsonb_build_object(
    'state', 'completed',
    'deleted', jsonb_build_object(
      'notifications', notifications_deleted,
      'receiptEvents', receipt_events_deleted,
      'attemptEvents', attempt_events_deleted,
      'receipts', receipts_deleted,
      'attempts', attempts_deleted,
      'jobs', jobs_deleted,
      'proposals', proposals_deleted,
      'reservations', reservations_deleted,
      'buckets', buckets_deleted,
      'monitoring', monitoring_deleted,
      'audit', audit_deleted
    )
  );
end;
$$;

create or replace function public.academy_study_adult_review_readiness_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  has_route boolean;
  has_worker boolean;
  state text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select exists (
    select 1 from academy_private.study_adult_review_route_capabilities
    where readiness = 'ready' and allows_production
      and supports_idempotency and supports_receipt_verification
  ) into has_route;
  select exists (
    select 1 from academy_private.study_adult_review_worker_registry
    where status = 'active' and revoked_at is null
      and authorized_scopes @> array[
        'proposal-resolution', 'delivery-claim', 'delivery-attempt',
        'delivery-reconcile', 'monitoring', 'rate-limit', 'retention'
      ]::text[]
  ) into has_worker;
  state := case when has_route and has_worker then 'ready' else 'not-ready' end;
  return jsonb_build_object(
    'state', state, 'schemaVersion', 2,
    'dependencies', jsonb_build_object(
      'durableProposalStore', true,
      'durableRecipientPermission', true,
      'recipientResolver', true,
      'durableOutbox', true,
      'leaseOperations', true,
      'attemptLedger', true,
      'allowedProductionRoute', has_route,
      'receiptValidator', true,
      'durableRateLimiter', true,
      'monitoringSink', true,
      'boundedRetentionPurge', has_worker,
      'authorizedWorkerConfiguration', has_worker
    )
  );
end;
$$;

create trigger study_attempt_events_immutable
before update or delete on academy_private.study_adult_review_attempt_events
for each row execute function academy_private.study_prevent_mutation();
create trigger study_receipt_events_immutable
before update or delete on academy_private.study_adult_review_receipt_events
for each row execute function academy_private.study_prevent_mutation();
create trigger study_adult_review_audit_immutable
before update or delete on academy_private.study_adult_review_audit_events
for each row execute function academy_private.study_prevent_mutation();

alter table academy_private.study_adult_review_attempt_events enable row level security;
alter table academy_private.study_adult_review_attempt_events force row level security;
alter table academy_private.study_adult_review_receipt_events enable row level security;
alter table academy_private.study_adult_review_receipt_events force row level security;
alter table academy_private.study_parent_notifications enable row level security;
alter table academy_private.study_parent_notifications force row level security;
alter table academy_private.study_adult_review_worker_registry enable row level security;
alter table academy_private.study_adult_review_worker_registry force row level security;
alter table academy_private.study_adult_review_route_capabilities enable row level security;
alter table academy_private.study_adult_review_route_capabilities force row level security;
alter table academy_private.study_adult_review_audit_events enable row level security;
alter table academy_private.study_adult_review_audit_events force row level security;

alter table academy_private.study_adult_review_attempt_events owner to postgres;
alter table academy_private.study_adult_review_receipt_events owner to postgres;
alter table academy_private.study_parent_notifications owner to postgres;
alter table academy_private.study_adult_review_worker_registry owner to postgres;
alter table academy_private.study_adult_review_route_capabilities owner to postgres;
alter table academy_private.study_adult_review_audit_events owner to postgres;

revoke all on table academy_private.study_adult_review_attempt_events from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_receipt_events from public, anon, authenticated, service_role;
revoke all on table academy_private.study_parent_notifications from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_worker_registry from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_route_capabilities from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_audit_events from public, anon, authenticated, service_role;

revoke all on function academy_private.study_adult_review_worker_is_authorized(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_adult_review_monitoring_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_resolve_adult_recipients_v2(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_claim_adult_review_proposals_v2(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_recipient_resolution_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_claim_delivery_jobs_v2(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_renew_delivery_lease_v2(text, uuid, uuid, bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_release_delivery_lease_v2(text, uuid, uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_worker_crash_v2(text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_cancel_invalid_delivery_jobs_v2(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_reserve_rate_limit_v2(text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_attempt_event_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_create_delivery_attempt_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_deliver_in_app_notification_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_verify_in_app_notification_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_list_parent_notifications_v1(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_mark_parent_notification_read_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_purge_adult_review_retention_v2(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_adult_review_readiness_v2()
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_resolve_adult_recipients_v2(text, text)
  to service_role;
grant execute on function public.academy_study_record_adult_review_monitoring_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_claim_adult_review_proposals_v2(text, integer, integer)
  to service_role;
grant execute on function public.academy_study_record_recipient_resolution_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_claim_delivery_jobs_v2(text, integer, integer)
  to service_role;
grant execute on function public.academy_study_renew_delivery_lease_v2(text, uuid, uuid, bigint, integer)
  to service_role;
grant execute on function public.academy_study_release_delivery_lease_v2(text, uuid, uuid, bigint)
  to service_role;
grant execute on function public.academy_study_record_worker_crash_v2(text, uuid, text)
  to service_role;
grant execute on function public.academy_study_cancel_invalid_delivery_jobs_v2(text, integer)
  to service_role;
grant execute on function public.academy_study_reserve_rate_limit_v2(text, text, text, text, text, text)
  to service_role;
grant execute on function public.academy_study_record_attempt_event_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_create_delivery_attempt_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_deliver_in_app_notification_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_verify_in_app_notification_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_purge_adult_review_retention_v2(text, integer)
  to service_role;
grant execute on function public.academy_study_adult_review_readiness_v2()
  to service_role;
grant execute on function public.academy_study_list_parent_notifications_v1(integer)
  to authenticated;
grant execute on function public.academy_study_mark_parent_notification_read_v1(text)
  to authenticated;

alter table academy_private.study_persistence_metadata
  add column adult_review_operations_version smallint not null default 0
    check (adult_review_operations_version in (0, 2));
update academy_private.study_persistence_metadata
set adult_review_operations_version = 2,
    migration_names = array_append(
      migration_names,
      '20260801170000_academy_study_adult_review_operations'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'adult_review_operations_version', 2,
      'canonical_operational_states', true,
      'durable_in_app_delivery', true,
      'authorized_worker_schedule', true,
      'attempt_event_ledger', true,
      'receipt_validation_events', true,
      'server_clock_rate_limits', true,
      'bounded_retention_purge', true
    ),
    updated_at = clock_timestamp()
where singleton;

comment on table academy_private.study_parent_notifications is
  'Adult-private durable in-app notifications. Contains minimized reason metadata only; no disclosure or transcript.';
comment on table academy_private.study_adult_review_attempt_events is
  'Immutable attempt lifecycle evidence. Provider payloads, contact values, credentials, and raw text are forbidden.';

commit;
