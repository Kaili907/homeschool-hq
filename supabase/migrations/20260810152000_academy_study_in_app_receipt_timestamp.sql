-- Study Engine verified in-app receipt timestamp normalization.
-- Forward-only correction of one server-owned receipt field. Session 17's
-- verification RPC returned `deliveredAt` as a raw timestamptz, which Postgres
-- renders with microsecond precision and a numeric session offset
-- (2026-08-01T12:00:00.123456+00:00). The server receipt contract requires
-- normalized UTC milliseconds (2026-08-01T12:00:00.123Z), and the adapter must
-- not rewrite server-owned receipt evidence. This migration replaces only that
-- function, reusing the established repository timestamp idiom
-- (to_char(value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')).
-- No other field, authorization check, binding check, return key, privilege,
-- role, or stored value changes. No hosted execution is implied.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found
     or marker.adult_review_operations_version is distinct from 2
     or marker.final_production_version is distinct from 1
     or marker.effective_settings_version is distinct from 2
     or marker.curriculum_binding_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801170000_academy_study_adult_review_operations',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260810120200_academy_study_effective_settings_v2',
       '20260810150000_academy_study_curriculum_binding'
     ]::text[]) then
    raise exception 'Study in-app receipt timestamp predecessor marker mismatch';
  end if;
  if to_regprocedure(
       'public.academy_study_verify_in_app_notification_v2(text,jsonb)'
     ) is null then
    raise exception 'Session 17 in-app verification RPC is required';
  end if;
  if marker.migration_names @> array[
       '20260810152000_academy_study_in_app_receipt_timestamp'
     ]::text[] then
    raise exception 'Study in-app receipt timestamp normalization already applied';
  end if;
end;
$$;

-- Byte-for-byte the Session 17 definition apart from the `deliveredAt`
-- projection: same signature, volatility, security posture, pinned search_path,
-- worker authorization, exact-key validation, proposal/household/student/job/
-- attempt/recipient binding, receipt and receipt-event state checks, and the
-- same eighteen returned keys in the same order.
create or replace function public.academy_study_verify_in_app_notification_v2(
  p_worker_id text,
  p_binding jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  notification academy_private.study_parent_notifications%rowtype;
  receipt academy_private.study_adult_review_delivery_receipts%rowtype;
  receipt_event academy_private.study_adult_review_receipt_events%rowtype;
begin
  if not academy_private.study_adult_review_worker_is_authorized(
    p_worker_id, 'delivery-attempt'
  ) then
    raise exception 'STUDY_WORKER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_binding,
    array[
      'providerReceiptRef', 'providerName', 'route', 'routeRef',
      'jobId', 'attemptId', 'proposalId', 'householdId', 'studentId',
      'recipientRef', 'deliveryIdempotencyKey', 'providerConfigVersion'
    ]::text[]
  ) or p_binding ->> 'providerName' <> 'academy-in-app'
     or p_binding ->> 'route' <> 'in-app'
     or p_binding ->> 'providerConfigVersion' <> 'in-app-config-v1' then
    raise exception 'STUDY_IN_APP_RECEIPT_INVALID' using errcode = '22023';
  end if;
  select * into notification
  from academy_private.study_parent_notifications
  where delivery_idempotency_key = p_binding ->> 'deliveryIdempotencyKey'
    and recipient_ref = p_binding ->> 'recipientRef'
    and route_ref = p_binding ->> 'routeRef'
    and job_id = (p_binding ->> 'jobId')::uuid
    and attempt_id = p_binding ->> 'attemptId'
    and proposal_id = p_binding ->> 'proposalId'
    and household_id = (p_binding ->> 'householdId')::uuid
    and student_id = (p_binding ->> 'studentId')::uuid;
  select * into receipt
  from academy_private.study_adult_review_delivery_receipts
  where job_id = notification.job_id
    and attempt_id = notification.attempt_id
    and provider_receipt_ref = p_binding ->> 'providerReceiptRef'
    and proposal_id = notification.proposal_id
    and household_id = notification.household_id
    and student_id = notification.student_id
    and recipient_ref = notification.recipient_ref
    and route_ref = notification.route_ref
    and channel = 'in-app'
    and delivery_idempotency_key = notification.delivery_idempotency_key
    and provider_name = 'academy-in-app'
    and provider_config_version = 'in-app-config-v1'
    and verification_state = 'verified'
    and receipt_schema_version = 1
    and receipt_environment = 'production'
    and receipt_source = 'server-verified'
    and not test_receipt;
  select * into receipt_event
  from academy_private.study_adult_review_receipt_events
  where receipt_id = receipt.id
    and receipt_ref = receipt.provider_receipt_ref
    and state = 'verified'
    and provider_name = receipt.provider_name
    and provider_config_version = receipt.provider_config_version
    and route_ref = receipt.route_ref
    and job_id = receipt.job_id
    and attempt_id = receipt.attempt_id
    and proposal_id = receipt.proposal_id
    and household_id = receipt.household_id
    and student_id = receipt.student_id
    and delivery_idempotency_key = receipt.delivery_idempotency_key
    and recipient_ref = receipt.recipient_ref
    and accepted_at = receipt.accepted_at
    and delivered_at = receipt.delivered_at
    and evidence_ref = receipt.receipt_evidence_ref
    and receipt_schema_version = receipt.receipt_schema_version
    and receipt_environment = receipt.receipt_environment;
  if notification.id is null or receipt.id is null or receipt_event.event_id is null then
    return jsonb_build_object('verified', false);
  end if;
  return jsonb_build_object(
    'verified', true,
    'receiptSchemaVersion', receipt.receipt_schema_version,
    'providerReceiptRef', receipt.provider_receipt_ref,
    'jobId', notification.job_id,
    'attemptId', notification.attempt_id,
    'deliveryIdempotencyKey', notification.delivery_idempotency_key,
    'recipientRef', notification.recipient_ref,
    'proposalId', notification.proposal_id,
    'householdId', notification.household_id,
    'studentId', notification.student_id,
    'routeRef', notification.route_ref,
    'route', 'in-app',
    'providerName', 'academy-in-app',
    'providerConfigVersion', 'in-app-config-v1',
    'deliveredAt', to_char(notification.delivered_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'evidenceRef', receipt.receipt_evidence_ref,
    'eventIdempotencyKey', receipt_event.event_idempotency_key,
    'receiptSource', receipt.receipt_source,
    'testReceipt', receipt.test_receipt
  );
end;
$$;

-- CREATE OR REPLACE preserves owner and ACL, but the Session 17 posture is
-- restated so the replaced function cannot inherit or obscure a weaker one.
-- This is exactly the Session 17 privilege set: no role gains access.
alter function public.academy_study_verify_in_app_notification_v2(text, jsonb)
  owner to postgres;
revoke all on function public.academy_study_verify_in_app_notification_v2(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_verify_in_app_notification_v2(text, jsonb)
  to service_role;

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260810152000_academy_study_in_app_receipt_timestamp'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'in_app_receipt_delivered_at_normalized', true
    ),
    updated_at = clock_timestamp()
where singleton;

commit;
