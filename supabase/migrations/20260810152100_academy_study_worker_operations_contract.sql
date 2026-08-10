-- Study adult-review worker production operations contract closure.
--
-- Closes the minimum database surface the production worker adapter needs:
-- a claim projection that discloses the durable job identity to the verified
-- worker boundary, read-only lease and current-attempt proofs, a lease-bound
-- targeted cancellation, a terminal lease that survives as evidence, and a
-- delivery transaction that owns the provider-accepted transition itself.
--
-- Forward-only. Historical migrations are not edited. The durable delivery
-- idempotency key format (delivery:<sha256>) and the durable route identifier
-- format (route:<sha256>) are unchanged; the JS-side contracts are widened by
-- later cards, not here. No hosted execution is implied.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
  claim_body text;
  delivery_body text;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;
  -- Predecessor state is asserted by containment and by explicit marker
  -- properties, never by exact equality of migration_names. Exact equality
  -- pinned this migration to one historical chain snapshot and made natural
  -- version order fail as soon as an earlier-versioned sibling landed:
  -- 20260810152000 (in-app receipt timestamp normalization) sorts before this
  -- migration, so it is applied first and legitimately appends its own name.
  -- The requirement is that every predecessor this migration depends on is
  -- present, not that nothing else is.
  select * into marker from academy_private.study_persistence_metadata where singleton;
  -- Without this, an absent singleton row leaves every comparison below NULL,
  -- the branch is not taken, and an unknown state would apply fail-open.
  if not found then
    raise exception 'STUDY_C2 predecessor marker mismatch';
  end if;
  if marker.adult_review_operations_version is distinct from 2
     or marker.final_production_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801012000_academy_study_engine_production_reconciliation',
       '20260801160000_academy_study_verified_identity',
       '20260801170000_academy_study_adult_review_operations',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260810120000_academy_study_effective_settings_v2',
       '20260810150000_academy_study_curriculum_binding',
       '20260810152000_academy_study_in_app_receipt_timestamp'
     ]::text[]) then
    raise exception 'STUDY_C2 predecessor marker mismatch';
  end if;

  -- The receipt boundary must already be normalized. This migration closes the
  -- operations contract the worker drives; a worker that can claim and deliver
  -- while verification still returns a raw timestamptz would fail the server
  -- receipt contract on every delivery. Assert the property, not just the name.
  if coalesce(marker.security_manifest, '{}'::jsonb)
       @> jsonb_build_object('in_app_receipt_delivered_at_normalized', true)
     is not true then
    raise exception 'STUDY_C2 predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260810152100_academy_study_worker_operations_contract'
     ]::text[] then
    raise exception 'STUDY_C2 operations contract already applied';
  end if;

  -- The exact v2 contract this migration replaces must be present, by
  -- signature and by body, before anything is dropped or redefined.
  if to_regprocedure(
       'public.academy_study_claim_delivery_jobs_v2(text,integer,integer)'
     ) is null
     or to_regprocedure(
       'academy_private.study_deliver_in_app_notification_internal_v2(text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.academy_study_deliver_in_app_notification_v2(text,jsonb)'
     ) is null
     or to_regprocedure(
       'academy_private.study_adult_review_worker_is_authorized(text,text)'
     ) is null
     or to_regprocedure(
       'public.academy_study_release_delivery_lease_v2(text,uuid,uuid,bigint)'
     ) is null then
    raise exception 'STUDY_C2 expected v2 contract predecessor missing';
  end if;
  claim_body := pg_get_functiondef(
    'public.academy_study_claim_delivery_jobs_v2(text,integer,integer)'::regprocedure
  );
  delivery_body := pg_get_functiondef(
    'academy_private.study_deliver_in_app_notification_internal_v2(text,jsonb)'::regprocedure
  );
  if claim_body not like '%STUDY_DELIVERY_CLAIM_INVALID%'
     or claim_body not like '%lease-expired-after-submit%'
     or claim_body not like '%leaseGeneration%'
     or delivery_body not like '%STUDY_IN_APP_ATTEMPT_NOT_ACCEPTED%'
     or delivery_body not like '%STUDY_IN_APP_DELIVERY_BINDING_MISMATCH%' then
    raise exception 'STUDY_C2 predecessor function body mismatch';
  end if;

  if to_regprocedure(
       'public.academy_study_prove_delivery_lease_v2(text,uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_prove_current_attempt_v2(text,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_cancel_delivery_job_v2(text,uuid,uuid,bigint,text)'
     ) is not null then
    raise exception 'STUDY_C2 object collision';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'study_delivery_jobs_v2_lease_check'
      and conrelid = 'academy_private.study_adult_review_delivery_jobs'::regclass
  ) then
    raise exception 'STUDY_C2 expected lease constraint missing';
  end if;
end;
$$;

-- M5 (schema half). A delivered job keeps its lease identity as evidence of
-- which worker and which lease produced the terminal receipt. Terminal jobs are
-- still not reclaimable: every lease-consuming path below requires state
-- 'leased', which 'delivered' never satisfies. Pre-existing delivered rows
-- carrying no lease identity remain legal.
alter table academy_private.study_adult_review_delivery_jobs
  drop constraint study_delivery_jobs_v2_lease_check,
  add constraint study_delivery_jobs_v2_lease_check check (
    (state = 'leased' and lease_token is not null
      and lease_expires_at is not null and lease_owner is not null)
    or (state = 'delivered' and (
      (lease_token is not null and lease_expires_at is not null
        and lease_owner is not null)
      or (lease_token is null and lease_expires_at is null
        and lease_owner is null)
    ))
    or (state not in ('leased', 'delivered') and lease_token is null
      and lease_expires_at is null and lease_owner is null)
  );

-- M1. Same signature, same envelope, same idempotency key. Adds the durable
-- claim identity the adapter needs to bind a claim to a household and learner
-- without a second privileged read.
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

  perform public.academy_study_cancel_invalid_delivery_jobs_v2(
    p_worker_id, least(100, greatest(1, p_batch_size * 2))
  );

  with available as (
    select job.id
    from academy_private.study_adult_review_delivery_jobs as job
    join academy_private.study_adult_review_proposals_v1 as proposal
      on proposal.proposal_id = job.proposal_id
    where job.state in ('pending', 'retryable')
      and (job.retry_at is null or job.retry_at <= clock_timestamp())
      and proposal.state = 'accepted'
      and proposal.expires_at > clock_timestamp()
      and academy_private.study_delivery_job_is_authorized(
        job.id, clock_timestamp()
      )
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
    returning job.id, job.proposal_id, job.household_id, job.student_id,
      job.recipient_ref, job.route_ref, job.channel, job.template_code,
      job.delivery_idempotency_key, job.lease_token,
      job.lease_expires_at, job.lease_generation, job.revision
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'claimId', leased.id,
    'jobId', leased.id, 'proposalId', leased.proposal_id,
    'householdId', leased.household_id, 'studentId', leased.student_id,
    'templateCode', leased.template_code,
    'recipientRef', leased.recipient_ref, 'routeRef', leased.route_ref,
    'route', leased.channel,
    'idempotencyKey', leased.delivery_idempotency_key,
    'leaseToken', leased.lease_token, 'leaseExpiresAt', leased.lease_expires_at,
    'leaseGeneration', leased.lease_generation, 'revision', leased.revision
  )), '[]'::jsonb) into claimed from leased;
  return jsonb_build_object('jobs', claimed, 'serverTime', clock_timestamp());
end;
$$;

-- M2. Minimized lease proof. Reads only; the only write reachable from here is
-- the pre-existing worker-authorization audit event, which is why the function
-- is volatile rather than stable. A non-active outcome discloses nothing beyond
-- the caller's own job identifier.
create function public.academy_study_prove_delivery_lease_v2(
  p_worker_id text,
  p_job_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare job academy_private.study_adult_review_delivery_jobs%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = p_job_id;
  if job.id is null
     or job.lease_owner is distinct from p_worker_id
     or job.lease_token is distinct from p_lease_token
     or job.lease_expires_at is null
     or job.lease_expires_at <= clock_timestamp() then
    return jsonb_build_object(
      'active', false, 'jobId', p_job_id, 'leaseToken', null,
      'leaseRevision', null, 'leaseExpiresAt', null
    );
  end if;
  return jsonb_build_object(
    'active', true,
    'jobId', job.id,
    'leaseToken', job.lease_token,
    'leaseRevision', job.revision,
    'leaseExpiresAt', to_char(job.lease_expires_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- M3. Current-attempt proof read entirely from the durable attempt row. No
-- attempt event is created, so repeated proofs leave the evidence ledger
-- untouched.
create function public.academy_study_prove_current_attempt_v2(
  p_worker_id text,
  p_job_id uuid,
  p_attempt_id text,
  p_lease_token uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  attempt academy_private.study_adult_review_delivery_attempts%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = p_job_id;
  select * into attempt
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_attempt_id and job_id = p_job_id;
  if job.id is null
     or attempt.attempt_id is null
     or job.lease_owner is distinct from p_worker_id
     or job.lease_token is distinct from p_lease_token
     or attempt.lease_generation <> job.lease_generation
     or attempt.attempt_ordinal <> job.attempt_count then
    return jsonb_build_object(
      'current', false, 'attemptId', p_attempt_id, 'jobId', p_job_id,
      'leaseToken', null, 'deliveryIdempotencyKey', null,
      'providerName', null, 'providerConfigVersion', null
    );
  end if;
  return jsonb_build_object(
    'current', true,
    'attemptId', attempt.attempt_id,
    'jobId', attempt.job_id,
    'leaseToken', job.lease_token,
    'deliveryIdempotencyKey', attempt.delivery_idempotency_key,
    'providerName', attempt.provider_name,
    'providerConfigVersion', attempt.provider_config_version
  );
end;
$$;

-- M4. Targeted, lease-bound cancellation of exactly one job. There is no
-- set-based form: the worker must hold the current lease on that one job, at
-- that exact revision, for one of two enumerated reasons.
create function public.academy_study_cancel_delivery_job_v2(
  p_worker_id text,
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_revision bigint,
  p_reason_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  cancelled academy_private.study_adult_review_delivery_jobs%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-claim'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_reason_code is null
     or p_reason_code not in ('invalid_delivery', 'invalid_recipient') then
    raise exception 'STUDY_DELIVERY_CANCEL_REASON_INVALID' using errcode = '22023';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = p_job_id for update;
  -- Replay: the same worker re-issuing the same cancellation for the same job
  -- and the same reason observes the settled outcome and writes nothing.
  if job.id is not null and job.state = 'cancelled' then
    if exists (
      select 1 from academy_private.study_adult_review_audit_events as audit
      where audit.event_name = 'delivery-job-cancelled'
        and audit.job_ref = p_job_id::text
        and audit.worker_id = p_worker_id
        and audit.reason_code = p_reason_code
    ) then
      return jsonb_build_object(
        'cancelled', false, 'replay', true, 'state', 'cancelled',
        'jobId', job.id, 'reasonCode', p_reason_code, 'revision', job.revision
      );
    end if;
    raise exception 'STUDY_DELIVERY_CANCEL_CONFLICT' using errcode = '40001';
  end if;
  if job.id is null
     or job.state <> 'leased'
     or job.lease_owner is distinct from p_worker_id
     or job.lease_token is distinct from p_lease_token
     or job.lease_expires_at is null
     or job.lease_expires_at <= clock_timestamp()
     or job.revision <> p_expected_revision then
    raise exception 'STUDY_DELIVERY_CANCEL_CONFLICT' using errcode = '40001';
  end if;
  update academy_private.study_adult_review_delivery_jobs
  set state = 'cancelled', lease_token = null, lease_expires_at = null,
      lease_owner = null, retry_at = null, last_failure_code = null,
      failed_at = null, revision = revision + 1, updated_at = clock_timestamp()
  where id = job.id and state = 'leased' and lease_owner = p_worker_id
    and lease_token = p_lease_token and revision = p_expected_revision
  returning * into cancelled;
  if cancelled.id is null then
    raise exception 'STUDY_DELIVERY_CANCEL_CONFLICT' using errcode = '40001';
  end if;
  insert into academy_private.study_adult_review_audit_events (
    event_name, severity, worker_id, proposal_ref, job_ref, reason_code,
    dimensions
  ) values (
    'delivery-job-cancelled', 'warning', p_worker_id, cancelled.proposal_id,
    cancelled.id::text, p_reason_code,
    jsonb_build_object(
      'jobRevision', cancelled.revision,
      'leaseGeneration', cancelled.lease_generation
    )
  );
  return jsonb_build_object(
    'cancelled', true, 'replay', false, 'state', 'cancelled',
    'jobId', cancelled.id, 'reasonCode', p_reason_code,
    'revision', cancelled.revision
  );
end;
$$;

-- M5 (function half) and M6. The delivery transaction now accepts an attempt
-- whose latest recorded state is 'submitted', records 'provider-accepted'
-- itself, and only then records receipt verification and the terminal
-- transition. The adapter no longer pre-records the provider transition, so the
-- provider boundary and its durable evidence share one transaction. On success
-- the lease identity is retained as evidence rather than torn down.
create or replace function academy_private.study_deliver_in_app_notification_internal_v2(
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
  accepted_time timestamptz;
  latest_state text;
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
      'proposalId', 'householdId', 'studentId',
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
       or existing.route_ref <> p_delivery ->> 'routeRef'
       or existing.proposal_id <> p_delivery ->> 'proposalId'
       or existing.household_id <> (p_delivery ->> 'householdId')::uuid
       or existing.student_id <> (p_delivery ->> 'studentId')::uuid
       or existing.attempt_id <> p_delivery ->> 'attemptId' then
      raise exception 'STUDY_IN_APP_IDEMPOTENCY_COLLISION' using errcode = '23505';
    end if;
    select * into receipt
    from academy_private.study_adult_review_delivery_receipts
    where job_id = existing.job_id and attempt_id = existing.attempt_id;
    if receipt.id is null or receipt.verification_state <> 'verified'
       or receipt.receipt_environment <> 'production'
       or receipt.receipt_source <> 'server-verified'
       or receipt.test_receipt then
      raise exception 'STUDY_IN_APP_IDEMPOTENCY_COLLISION' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'state', 'already-delivered',
      'providerReceiptRef', receipt.provider_receipt_ref,
      'jobId', existing.job_id,
      'attemptId', existing.attempt_id,
      'proposalId', existing.proposal_id,
      'householdId', existing.household_id,
      'studentId', existing.student_id,
      'deliveryIdempotencyKey', existing.delivery_idempotency_key,
      'recipientRef', existing.recipient_ref,
      'routeRef', existing.route_ref,
      'providerName', receipt.provider_name,
      'providerConfigVersion', receipt.provider_config_version,
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
     or job.route_ref <> p_delivery ->> 'routeRef'
     or job.proposal_id <> p_delivery ->> 'proposalId'
     or job.household_id <> (p_delivery ->> 'householdId')::uuid
     or job.student_id <> (p_delivery ->> 'studentId')::uuid then
    raise exception 'STUDY_IN_APP_DELIVERY_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = job.proposal_id;
  if proposal.proposal_id is null
     or proposal.household_id <> job.household_id
     or proposal.student_id <> job.student_id
     or proposal.state <> 'accepted'
     or proposal.recipient_resolution_state <> 'resolved'
     or proposal.expires_at <= delivered_time then
    update academy_private.study_adult_review_delivery_jobs
    set state = 'cancelled', lease_token = null, lease_expires_at = null,
        lease_owner = null, retry_at = null, last_failure_code = null,
        failed_at = null, revision = revision + 1, updated_at = delivered_time
    where id = job.id;
    insert into academy_private.study_adult_review_audit_events (
      event_name, severity, worker_id, proposal_ref, job_ref,
      reason_code, dimensions
    ) values (
      'invalid-job-cancelled', 'warning', p_worker_id, job.proposal_id,
      job.id::text, 'proposal-invalid-before-insert',
      jsonb_build_object('jobRevision', job.revision)
    );
    return jsonb_build_object(
      'state', 'revoked', 'reasonCode', 'proposal-invalid-before-insert'
    );
  end if;
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
    and route.household_id = job.household_id
    and route.student_id = job.student_id
    and route.recipient_ref = job.recipient_ref
    and route.permission_id = job.permission_id
    and route.revision = job.route_revision
    and route.status = 'active' and route.revoked_at is null
    and permission_row.recipient_ref = job.recipient_ref
    and permission_row.id = job.permission_id
    and permission_row.household_id = job.household_id
    and permission_row.student_id = job.student_id
    and permission_row.revision = job.permission_revision
    and permission_row.permission_version = job.recipient_version
    and permission_row.status = 'active' and permission_row.revoked_at is null
    and permission_row.effective_at <= delivered_time
    and (permission_row.expires_at is null
      or permission_row.expires_at > delivered_time)
    and 'in-app' = any(permission_row.allowed_channels)
    and membership.member_role = 'guardian'
    and membership.status = 'active' and membership.revoked_at is null
    and membership.user_id is not null
    and access.status = 'active' and access.revoked_at is null
    and access.permission_level in ('learning_manager', 'identity_manager')
    and academy_private.study_delivery_job_is_authorized(job.id, delivered_time);
  if permission.id is null then
    update academy_private.study_adult_review_delivery_jobs
    set state = 'cancelled', lease_token = null, lease_expires_at = null,
        lease_owner = null, retry_at = null, last_failure_code = null,
        failed_at = null, revision = revision + 1, updated_at = delivered_time
    where id = job.id;
    insert into academy_private.study_adult_review_audit_events (
      event_name, severity, worker_id, proposal_ref, job_ref,
      reason_code, dimensions
    ) values (
      'invalid-job-cancelled', 'warning', p_worker_id, job.proposal_id,
      job.id::text, 'recipient-revoked-before-insert',
      jsonb_build_object('jobRevision', job.revision)
    );
    return jsonb_build_object(
      'state', 'revoked', 'reasonCode', 'recipient-revoked-before-insert'
    );
  end if;
  select * into attempt
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_delivery ->> 'attemptId' and job_id = job.id;
  select event.state into latest_state
  from academy_private.study_adult_review_attempt_events as event
  where event.attempt_id = attempt.attempt_id
  order by event.occurred_at desc, event.event_id desc
  limit 1;
  -- M6. The provider transition belongs to this transaction, so the caller must
  -- arrive with 'submitted' as the latest recorded state. A pre-recorded
  -- 'provider-accepted' is now a contract violation, not a precondition.
  if attempt.attempt_id is null
     or attempt.lease_generation <> job.lease_generation
     or attempt.attempt_ordinal <> job.attempt_count
     or attempt.provider_name <> 'academy-in-app'
     or attempt.provider_config_version <> 'in-app-config-v1'
     or coalesce(latest_state, 'none') <> 'submitted' then
    raise exception 'STUDY_IN_APP_ATTEMPT_NOT_SUBMITTED' using errcode = '42501';
  end if;
  if exists (
    select 1
    from academy_private.study_adult_review_delivery_receipts as prior
    where prior.job_id = job.id
      and prior.verification_state = 'verified'
  ) then
    raise exception 'STUDY_IN_APP_RECEIPT_ALREADY_VERIFIED' using errcode = '23505';
  end if;
  accepted_time := clock_timestamp();
  insert into academy_private.study_adult_review_attempt_events (
    attempt_id, job_id, state, occurred_at, completed_at, structured_result,
    timeout_state, retry_decision, lease_generation, provider_name,
    provider_config_version, delivery_idempotency_key, event_idempotency_key
  ) values (
    attempt.attempt_id, job.id, 'provider-accepted', accepted_time, null,
    'in-app-accepted', 'not-timed-out', 'do-not-retry', attempt.lease_generation,
    'academy-in-app', 'in-app-config-v1', job.delivery_idempotency_key,
    'attempt-event:' || academy_private.study_sha256_json(jsonb_build_object(
      'attemptId', attempt.attempt_id, 'state', 'provider-accepted'
    ))
  );
  -- Receipt evidence must order strictly after the acceptance it verifies.
  delivered_time := greatest(
    clock_timestamp(), accepted_time + interval '1 microsecond'
  );
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
    proposal_id, provider_name, provider_config_version, accepted_at,
    receipt_schema_version, receipt_environment, receipt_source,
    test_receipt, verification_state
  ) values (
    attempt.attempt_id, job.id, job.household_id, job.student_id,
    'academy-in-app:in-app-config-v1', receipt_ref, evidence_ref,
    delivered_time, job.route_ref, job.channel, job.recipient_ref,
    job.delivery_idempotency_key, job.proposal_id, 'academy-in-app',
    'in-app-config-v1', accepted_time, 1, 'production',
    'server-verified', false, 'verified'
  ) returning * into receipt;
  insert into academy_private.study_adult_review_receipt_events (
    event_idempotency_key, receipt_id, receipt_ref, state, provider_name,
    provider_config_version, route_ref, job_id, attempt_id, proposal_id,
    household_id, student_id, delivery_idempotency_key, recipient_ref,
    accepted_at, delivered_at, evidence_ref, receipt_schema_version,
    receipt_environment, reason_code, occurred_at
  ) values (
    'receipt-event:' || academy_private.study_sha256_json(jsonb_build_object(
      'receiptId', receipt.id, 'state', 'verified',
      'attemptId', attempt.attempt_id
    )), receipt.id, receipt_ref, 'verified', 'academy-in-app',
    'in-app-config-v1', job.route_ref, job.id, attempt.attempt_id,
    job.proposal_id, job.household_id, job.student_id,
    job.delivery_idempotency_key, job.recipient_ref, accepted_time,
    delivered_time, evidence_ref, 1, 'production',
    'server-verified-in-app', delivered_time
  );
  insert into academy_private.study_adult_review_attempt_events (
    attempt_id, job_id, state, occurred_at, completed_at, structured_result,
    timeout_state, receipt_reference, retry_decision, lease_generation,
    provider_name, provider_config_version, delivery_idempotency_key,
    event_idempotency_key
  ) values (
    attempt.attempt_id, job.id, 'receipt-verified', delivered_time,
    delivered_time, 'in-app-visible', 'not-timed-out', receipt.id,
    'do-not-retry', attempt.lease_generation, 'academy-in-app',
    'in-app-config-v1', job.delivery_idempotency_key,
    'attempt-event:' || academy_private.study_sha256_json(jsonb_build_object(
      'attemptId', attempt.attempt_id, 'state', 'receipt-verified',
      'receiptId', receipt.id
    ))
  );
  -- M5. The lease identity is retained as terminal evidence. 'delivered' is not
  -- a leased state, so no claim, renewal, release, attempt, or cancellation
  -- path can act on it.
  update academy_private.study_adult_review_delivery_jobs
  set state = 'delivered', delivered_at = delivered_time,
      receipt_reference = receipt.id,
      revision = revision + 1, updated_at = delivered_time
  where id = job.id;
  return jsonb_build_object(
    'state', 'delivered', 'providerReceiptRef', receipt_ref,
    'jobId', job.id, 'attemptId', attempt.attempt_id,
    'proposalId', job.proposal_id,
    'householdId', job.household_id,
    'studentId', job.student_id,
    'deliveryIdempotencyKey', job.delivery_idempotency_key,
    'recipientRef', job.recipient_ref,
    'routeRef', job.route_ref,
    'providerName', 'academy-in-app',
    'providerConfigVersion', 'in-app-config-v1',
    'notification', jsonb_build_object(
      'title', notification.learner_safe_title,
      'reasonCategory', notification.reason_category,
      'urgency', notification.urgency,
      'actionRef', notification.action_ref
    )
  );
end;
$$;

alter function public.academy_study_claim_delivery_jobs_v2(text, integer, integer)
  owner to postgres;
alter function public.academy_study_prove_delivery_lease_v2(text, uuid, uuid)
  owner to postgres;
alter function public.academy_study_prove_current_attempt_v2(text, uuid, text, uuid)
  owner to postgres;
alter function public.academy_study_cancel_delivery_job_v2(text, uuid, uuid, bigint, text)
  owner to postgres;
alter function academy_private.study_deliver_in_app_notification_internal_v2(text, jsonb)
  owner to postgres;

revoke all on function public.academy_study_claim_delivery_jobs_v2(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_prove_delivery_lease_v2(text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_prove_current_attempt_v2(text, uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_cancel_delivery_job_v2(text, uuid, uuid, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_deliver_in_app_notification_internal_v2(text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_claim_delivery_jobs_v2(text, integer, integer)
  to service_role;
grant execute on function public.academy_study_prove_delivery_lease_v2(text, uuid, uuid)
  to service_role;
grant execute on function public.academy_study_prove_current_attempt_v2(text, uuid, text, uuid)
  to service_role;
grant execute on function public.academy_study_cancel_delivery_job_v2(text, uuid, uuid, bigint, text)
  to service_role;

alter table academy_private.study_persistence_metadata
  add column c2_operations_contract_version smallint not null default 0
    check (c2_operations_contract_version in (0, 1));
update academy_private.study_persistence_metadata
set c2_operations_contract_version = 1,
    migration_names = array_append(
      migration_names,
      '20260810152100_academy_study_worker_operations_contract'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'c2_operations_contract_version', 1,
      'claim_discloses_durable_job_identity', true,
      'read_only_lease_proof', true,
      'read_only_current_attempt_proof', true,
      'targeted_lease_bound_cancellation', true,
      'terminal_lease_retained_as_evidence', true,
      'provider_accepted_recorded_in_delivery_transaction', true,
      'delivery_idempotency_key_format', 'unchanged',
      'route_identifier_format', 'unchanged'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_prove_delivery_lease_v2(text, uuid, uuid) is
  'Read-only lease proof for the verified worker boundary. Reports the current job revision; never renews, extends, or mutates the lease.';
comment on function public.academy_study_prove_current_attempt_v2(text, uuid, text, uuid) is
  'Read-only current-attempt proof projected from stored durable attempt fields. Creates no attempt event.';
comment on function public.academy_study_cancel_delivery_job_v2(text, uuid, uuid, bigint, text) is
  'Targeted single-job cancellation bound to the current lease, exact token, and exact revision. Reasons are limited to invalid_delivery and invalid_recipient.';

commit;
