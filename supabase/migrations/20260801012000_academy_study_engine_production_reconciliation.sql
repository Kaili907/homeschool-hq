-- Manuel Academy Study Engine production reconciliation.
--
-- This migration is intentionally additive. The accepted Session 13 storage
-- and authorization migrations remain byte-for-byte historical artifacts.
-- Sensitive delivery state is reachable only through narrowly granted,
-- security-definer RPCs. Opaque references are persisted; recipient addresses,
-- raw learner text, transcripts, and provider payloads have no storage column.

begin;

create table academy_private.study_adult_notification_permissions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  student_id uuid not null,
  guardian_access_id uuid not null,
  membership_id uuid not null,
  recipient_ref text not null
    check (public.academy_study_identifier_is_valid(recipient_ref)),
  allowed_channels text[] not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  policy_version text not null
    check (public.academy_study_identifier_is_valid(policy_version)),
  provenance_ref text not null
    check (public.academy_study_identifier_is_valid(provenance_ref)),
  revision bigint not null default 1 check (revision > 0),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_notification_permissions_access_fk
    foreign key (
      guardian_access_id, household_id, student_id, membership_id
    ) references public.academy_guardian_student_access (
      id, household_id, student_id, membership_id
    ) on delete restrict,
  constraint study_notification_permissions_channels_check check (
    cardinality(allowed_channels) between 1 and 3
    and allowed_channels <@ array['email', 'in-app', 'sms']::text[]
    and public.academy_study_identifiers_are_unique(allowed_channels)
  ),
  constraint study_notification_permissions_status_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  constraint study_notification_permissions_scope_key
    unique (id, household_id, student_id),
  constraint study_notification_permissions_recipient_scope_key
    unique (id, recipient_ref),
  constraint study_notification_permissions_recipient_key
    unique (recipient_ref),
  constraint study_notification_permissions_access_key
    unique (household_id, student_id, guardian_access_id)
);

create table academy_private.study_adult_notification_routes (
  route_ref text primary key
    check (public.academy_study_identifier_is_valid(route_ref)),
  permission_id uuid not null,
  household_id uuid not null,
  student_id uuid not null,
  recipient_ref text not null,
  channel text not null check (channel in ('email', 'in-app', 'sms')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  provider_route_version text not null
    check (public.academy_study_identifier_is_valid(provider_route_version)),
  revision bigint not null default 1 check (revision > 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_notification_routes_permission_fk
    foreign key (permission_id, household_id, student_id)
    references academy_private.study_adult_notification_permissions
      (id, household_id, student_id)
    on delete restrict,
  constraint study_notification_routes_recipient_fk
    foreign key (permission_id, recipient_ref)
    references academy_private.study_adult_notification_permissions
      (id, recipient_ref)
    on delete restrict,
  constraint study_notification_routes_status_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  constraint study_notification_routes_scope_key
    unique (route_ref, household_id, student_id),
  constraint study_notification_routes_permission_channel_key
    unique (permission_id, channel)
);

create table academy_private.study_adult_review_proposals_v1 (
  proposal_id text primary key
    check (public.academy_study_identifier_is_valid(proposal_id)),
  schema_version smallint not null default 1 check (schema_version = 1),
  household_id uuid not null,
  student_id uuid not null,
  session_id text not null,
  category text not null default 'student-support'
    check (category = 'student-support'),
  classification text not null
    check (classification in ('urgent', 'uncertain', 'invalid')),
  urgency text not null
    check (urgency in ('urgent', 'uncertain', 'review-required')),
  reason_codes text[] not null,
  classifier_version text not null
    check (public.academy_study_identifier_is_valid(classifier_version)),
  occurred_at timestamptz not null,
  idempotency_key text not null
    check (public.academy_study_identifier_is_valid(idempotency_key)),
  state text not null default 'proposed-not-delivered'
    check (state in (
      'proposed-not-delivered', 'routing', 'routed',
      'unavailable', 'indeterminate', 'cancelled'
    )),
  recipient_resolution_state text not null default 'pending'
    check (recipient_resolution_state in (
      'pending', 'processing', 'resolved', 'unavailable', 'indeterminate'
    )),
  resolution_ref text
    check (
      resolution_ref is null
      or public.academy_study_identifier_is_valid(resolution_ref)
    ),
  resolution_policy_version text
    check (
      resolution_policy_version is null
      or public.academy_study_identifier_is_valid(resolution_policy_version)
    ),
  lease_token uuid,
  lease_expires_at timestamptz,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_proposals_v1_session_fk
    foreign key (session_id, household_id, student_id)
    references public.academy_study_sessions (id, household_id, student_id)
    on delete restrict,
  constraint study_proposals_v1_reason_codes_check check (
    cardinality(reason_codes) between 1 and 16
    and public.academy_study_identifiers_are_unique(reason_codes)
  ),
  constraint study_proposals_v1_classification_urgency_check check (
    (classification = 'urgent' and urgency = 'urgent')
    or (classification = 'uncertain' and urgency = 'uncertain')
    or (classification = 'invalid' and urgency = 'review-required')
  ),
  constraint study_proposals_v1_lease_check check (
    (recipient_resolution_state = 'processing'
      and state = 'routing'
      and lease_token is not null
      and lease_expires_at is not null)
    or (recipient_resolution_state <> 'processing'
      and lease_token is null
      and lease_expires_at is null)
  ),
  constraint study_proposals_v1_resolution_check check (
    (recipient_resolution_state = 'resolved'
      and state = 'routed'
      and resolution_ref is not null
      and resolution_policy_version is not null)
    or (recipient_resolution_state <> 'resolved'
      and resolution_ref is null
      and resolution_policy_version is null)
  ),
  constraint study_proposals_v1_scope_key
    unique (proposal_id, household_id, student_id),
  constraint study_proposals_v1_idempotency_key
    unique (household_id, student_id, idempotency_key)
);

create table academy_private.study_adult_review_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null,
  household_id uuid not null,
  student_id uuid not null,
  recipient_ref text not null,
  route_ref text not null,
  channel text not null check (channel in ('email', 'in-app', 'sms')),
  template_code text not null default 'study-safety-adult-review-v1'
    check (template_code = 'study-safety-adult-review-v1'),
  delivery_idempotency_key text not null
    check (public.academy_study_identifier_is_valid(delivery_idempotency_key)),
  state text not null default 'pending'
    check (state in (
      'pending', 'claimed', 'retry-scheduled', 'delivered',
      'permanent-failure', 'indeterminate', 'cancelled'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  last_failure_code text
    check (
      last_failure_code is null
      or public.academy_study_identifier_is_valid(last_failure_code)
    ),
  failed_at timestamptz,
  delivered_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_delivery_jobs_proposal_fk
    foreign key (proposal_id, household_id, student_id)
    references academy_private.study_adult_review_proposals_v1
      (proposal_id, household_id, student_id)
    on delete restrict,
  constraint study_delivery_jobs_route_fk
    foreign key (route_ref, household_id, student_id)
    references academy_private.study_adult_notification_routes
      (route_ref, household_id, student_id)
    on delete restrict,
  constraint study_delivery_jobs_lease_check check (
    (state = 'claimed' and lease_token is not null and lease_expires_at is not null)
    or (state <> 'claimed' and lease_token is null and lease_expires_at is null)
  ),
  constraint study_delivery_jobs_retry_check check (
    (state = 'retry-scheduled' and retry_at is not null)
    or (state <> 'retry-scheduled' and retry_at is null)
  ),
  constraint study_delivery_jobs_delivered_check check (
    (state = 'delivered' and delivered_at is not null)
    or (state <> 'delivered' and delivered_at is null)
  ),
  constraint study_delivery_jobs_failure_check check (
    (state in ('retry-scheduled', 'permanent-failure', 'indeterminate')
      and last_failure_code is not null and failed_at is not null)
    or (state not in ('retry-scheduled', 'permanent-failure', 'indeterminate')
      and last_failure_code is null and failed_at is null)
  ),
  constraint study_delivery_jobs_proposal_route_key unique (proposal_id, route_ref),
  constraint study_delivery_jobs_idempotency_key unique (delivery_idempotency_key),
  constraint study_delivery_jobs_scope_key unique (id, household_id, student_id)
);

create table academy_private.study_adult_review_delivery_attempts (
  attempt_id text primary key
    check (public.academy_study_identifier_is_valid(attempt_id)),
  job_id uuid not null,
  household_id uuid not null,
  student_id uuid not null,
  attempt_ordinal integer not null check (attempt_ordinal > 0),
  lease_generation bigint not null check (lease_generation > 0),
  delivery_idempotency_key text not null,
  recipient_ref text not null,
  route_ref text not null,
  channel text not null check (channel in ('email', 'in-app', 'sms')),
  provider_version text not null
    check (public.academy_study_identifier_is_valid(provider_version)),
  authorization_evidence_ref text not null
    check (public.academy_study_identifier_is_valid(authorization_evidence_ref)),
  attempted_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint study_delivery_attempts_job_fk
    foreign key (job_id, household_id, student_id)
    references academy_private.study_adult_review_delivery_jobs
      (id, household_id, student_id)
    on delete restrict,
  constraint study_delivery_attempts_ordinal_key unique (job_id, attempt_ordinal),
  constraint study_delivery_attempts_scope_key unique (attempt_id, job_id)
);

create table academy_private.study_adult_review_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  attempt_id text not null,
  job_id uuid not null,
  household_id uuid not null,
  student_id uuid not null,
  provider_version text not null,
  provider_receipt_ref text not null
    check (public.academy_study_identifier_is_valid(provider_receipt_ref)),
  receipt_evidence_ref text not null
    check (public.academy_study_identifier_is_valid(receipt_evidence_ref)),
  delivered_at timestamptz not null,
  verified_at timestamptz not null default now(),
  constraint study_delivery_receipts_attempt_fk
    foreign key (attempt_id, job_id)
    references academy_private.study_adult_review_delivery_attempts
      (attempt_id, job_id)
    on delete restrict,
  constraint study_delivery_receipts_job_fk
    foreign key (job_id, household_id, student_id)
    references academy_private.study_adult_review_delivery_jobs
      (id, household_id, student_id)
    on delete restrict,
  constraint study_delivery_receipts_attempt_key unique (attempt_id),
  constraint study_delivery_receipts_provider_key
    unique (provider_version, provider_receipt_ref)
);

create table academy_private.study_safety_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  actor_ref text not null check (actor_ref ~ '^actor:[0-9a-f]{64}$'),
  household_ref text not null
    check (household_ref = 'none' or household_ref ~ '^household:[0-9a-f]{64}$'),
  learner_ref text not null
    check (learner_ref = 'none' or learner_ref ~ '^learner:[0-9a-f]{64}$'),
  route_ref text not null
    check (route_ref = 'none' or route_ref ~ '^route:[0-9a-f]{64}$'),
  scope text not null check (scope in (
    'study-safety-classify', 'study-safety-classify-subject-route'
  )),
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  capacity integer not null check (capacity between 1 and 10000),
  used integer not null default 0 check (used >= 0 and used <= capacity),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_rate_limit_buckets_scope_key unique (
    actor_ref, household_ref, learner_ref, route_ref, scope,
    window_started_at, window_seconds
  )
);

create table academy_private.study_safety_rate_limit_reservations (
  id uuid primary key default gen_random_uuid(),
  actor_ref text not null,
  household_ref text not null,
  learner_ref text not null,
  route_ref text not null,
  scope text not null,
  bucket_id uuid not null
    references academy_private.study_safety_rate_limit_buckets (id)
    on delete restrict,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  allowed boolean not null,
  reserved_at timestamptz not null default now()
);

create table academy_private.study_safety_monitoring_events (
  event_id text primary key
    check (public.academy_study_identifier_is_valid(event_id)),
  schema_version smallint not null default 1 check (schema_version = 1),
  name text not null check (name in (
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
    'study_safety.circuit_breaker_open'
  )),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  occurred_at timestamptz not null,
  code text not null check (public.academy_study_identifier_is_valid(code)),
  service text not null check (service = 'study-safety'),
  metric_name text not null
    check (public.academy_study_identifier_is_valid(metric_name)),
  runbook_id text not null
    check (public.academy_study_identifier_is_valid(runbook_id)),
  attributes jsonb not null check (
    jsonb_typeof(attributes) = 'object'
    and public.academy_study_payload_is_minimized(attributes, 1024)
  ),
  recorded_at timestamptz not null default now()
);

create index study_notification_permissions_resolution_idx
  on academy_private.study_adult_notification_permissions
  (household_id, student_id, status);
create index study_notification_routes_resolution_idx
  on academy_private.study_adult_notification_routes
  (household_id, student_id, status);
create index study_proposals_v1_claim_idx
  on academy_private.study_adult_review_proposals_v1
  (recipient_resolution_state, lease_expires_at, occurred_at);
create index study_delivery_jobs_claim_idx
  on academy_private.study_adult_review_delivery_jobs
  (state, retry_at, lease_expires_at, created_at);
create index study_delivery_attempts_job_idx
  on academy_private.study_adult_review_delivery_attempts
  (job_id, attempt_ordinal);
create index study_monitoring_name_time_idx
  on academy_private.study_safety_monitoring_events (name, occurred_at desc);

-- Preserve the timezone snapshot carried by an existing durable record. A
-- household timezone change affects only records inserted after that revision.
alter table public.academy_study_sessions
  add column timezone_snapshot_revision bigint,
  add column timezone_snapshot_provenance text;
alter table public.academy_study_checkpoints
  add column timezone_snapshot_revision bigint,
  add column timezone_snapshot_provenance text;
alter table public.academy_study_reviews
  add column timezone_snapshot_revision bigint,
  add column timezone_snapshot_provenance text;
alter table public.academy_study_calendar_blocks
  add column timezone_snapshot_revision bigint,
  add column timezone_snapshot_provenance text,
  add column intended_local_time time without time zone,
  add column dst_resolution text;

update public.academy_study_sessions as item
set timezone_snapshot_revision = settings.revision,
    timezone_snapshot_provenance = 'session-13-backfill-v1'
from public.academy_study_household_settings as settings
where settings.household_id = item.household_id;
update public.academy_study_checkpoints as item
set timezone_snapshot_revision = settings.revision,
    timezone_snapshot_provenance = 'session-13-backfill-v1'
from public.academy_study_household_settings as settings
where settings.household_id = item.household_id;
update public.academy_study_reviews as item
set timezone_snapshot_revision = settings.revision,
    timezone_snapshot_provenance = 'session-13-backfill-v1'
from public.academy_study_household_settings as settings
where settings.household_id = item.household_id;
update public.academy_study_calendar_blocks as item
set timezone_snapshot_revision = settings.revision,
    timezone_snapshot_provenance = 'session-13-backfill-v1',
    intended_local_time = (item.scheduled_start at time zone item.household_timezone)::time,
    dst_resolution = 'explicit-offset'
from public.academy_study_household_settings as settings
where settings.household_id = item.household_id;

alter table public.academy_study_sessions
  alter column timezone_snapshot_revision set not null,
  alter column timezone_snapshot_provenance set not null,
  add constraint academy_study_sessions_timezone_revision_check
    check (timezone_snapshot_revision > 0),
  add constraint academy_study_sessions_timezone_provenance_check
    check (public.academy_study_identifier_is_valid(timezone_snapshot_provenance));
alter table public.academy_study_checkpoints
  alter column timezone_snapshot_revision set not null,
  alter column timezone_snapshot_provenance set not null,
  add constraint academy_study_checkpoints_timezone_revision_check
    check (timezone_snapshot_revision > 0),
  add constraint academy_study_checkpoints_timezone_provenance_check
    check (public.academy_study_identifier_is_valid(timezone_snapshot_provenance));
alter table public.academy_study_reviews
  alter column timezone_snapshot_revision set not null,
  alter column timezone_snapshot_provenance set not null,
  add constraint academy_study_reviews_timezone_revision_check
    check (timezone_snapshot_revision > 0),
  add constraint academy_study_reviews_timezone_provenance_check
    check (public.academy_study_identifier_is_valid(timezone_snapshot_provenance));
alter table public.academy_study_calendar_blocks
  alter column timezone_snapshot_revision set not null,
  alter column timezone_snapshot_provenance set not null,
  alter column intended_local_time set not null,
  alter column dst_resolution set not null,
  add constraint academy_study_calendar_timezone_revision_check
    check (timezone_snapshot_revision > 0),
  add constraint academy_study_calendar_timezone_provenance_check
    check (public.academy_study_identifier_is_valid(timezone_snapshot_provenance)),
  add constraint academy_study_calendar_dst_resolution_check
    check (dst_resolution in ('explicit-offset', 'earlier-offset', 'later-offset'));

create or replace function academy_private.study_apply_timezone_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  canonical_timezone text;
  canonical_revision bigint;
  actual_offset integer;
  actual_local_time time without time zone;
begin
  if tg_op = 'INSERT' then
    select settings.household_timezone, settings.revision
      into canonical_timezone, canonical_revision
    from public.academy_study_household_settings as settings
    where settings.household_id = new.household_id;
    if canonical_timezone is null then
      raise exception 'STUDY_HOUSEHOLD_TIMEZONE_REQUIRED' using errcode = '23514';
    end if;
    new.household_timezone := canonical_timezone;
    new.timezone_snapshot_revision := canonical_revision;
    new.timezone_snapshot_provenance := 'household-settings-v1';
  else
    if new.household_id is distinct from old.household_id then
      raise exception 'STUDY_TIMEZONE_SCOPE_IMMUTABLE' using errcode = '23514';
    end if;
    new.household_timezone := old.household_timezone;
    new.timezone_snapshot_revision := old.timezone_snapshot_revision;
    new.timezone_snapshot_provenance := old.timezone_snapshot_provenance;
    canonical_timezone := old.household_timezone;
  end if;

  if tg_table_name = 'academy_study_sessions' then
    if new.started_at is not null
       and (new.started_at at time zone canonical_timezone)::date
         <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
  elsif tg_table_name = 'academy_study_reviews' then
    if (new.due_at at time zone canonical_timezone)::date
       <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
  elsif tg_table_name = 'academy_study_calendar_blocks' then
    if (new.scheduled_start at time zone canonical_timezone)::date
       <> new.intended_local_date then
      raise exception 'STUDY_LOCAL_DATE_MISMATCH' using errcode = '23514';
    end if;
    actual_offset := extract(epoch from (
      (new.scheduled_start at time zone canonical_timezone)
      - (new.scheduled_start at time zone 'UTC')
    ))::integer / 60;
    if actual_offset <> new.explicit_offset then
      raise exception 'STUDY_EXPLICIT_OFFSET_MISMATCH' using errcode = '23514';
    end if;
    actual_local_time := (new.scheduled_start at time zone canonical_timezone)::time;
    if tg_op = 'INSERT' then
      new.intended_local_time := actual_local_time;
      new.dst_resolution := 'explicit-offset';
    elsif new.intended_local_time is distinct from actual_local_time then
      raise exception 'STUDY_LOCAL_TIME_MISMATCH' using errcode = '23514';
    else
      new.intended_local_time := old.intended_local_time;
      new.dst_resolution := old.dst_resolution;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.academy_study_set_adult_notification_permission_v1(
  p_permission jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  access_row public.academy_guardian_student_access%rowtype;
  existing academy_private.study_adult_notification_permissions%rowtype;
  permission_id uuid;
  requested_status text;
  requested_channels text[];
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or not public.academy_study_json_has_exact_keys(
       p_permission,
       array[
         'permissionId', 'guardianAccessId', 'recipientRef',
         'allowedChannels', 'status', 'policyVersion', 'provenanceRef'
       ]::text[]
     )
     or jsonb_typeof(p_permission -> 'allowedChannels') <> 'array' then
    raise exception 'STUDY_NOTIFICATION_PERMISSION_INVALID' using errcode = '22023';
  end if;
  permission_id := (p_permission ->> 'permissionId')::uuid;
  requested_status := p_permission ->> 'status';
  select coalesce(array_agg(value order by value), '{}'::text[])
    into requested_channels
  from jsonb_array_elements_text(p_permission -> 'allowedChannels') as channel(value);
  if requested_status not in ('active', 'revoked')
     or cardinality(requested_channels) not between 1 and 3
     or not requested_channels <@ array['email', 'in-app', 'sms']::text[]
     or not public.academy_study_identifiers_are_unique(requested_channels)
     or not public.academy_study_identifier_is_valid(p_permission ->> 'recipientRef')
     or not public.academy_study_identifier_is_valid(p_permission ->> 'policyVersion')
     or not public.academy_study_identifier_is_valid(p_permission ->> 'provenanceRef') then
    raise exception 'STUDY_NOTIFICATION_PERMISSION_INVALID' using errcode = '22023';
  end if;

  select access.* into access_row
  from public.academy_guardian_student_access as access
  join public.academy_household_memberships as membership
    on membership.id = access.membership_id
   and membership.household_id = access.household_id
  join public.academy_households as household
    on household.id = access.household_id
  join public.academy_students as student
    on student.id = access.student_id
   and student.household_id = access.household_id
  where access.id = (p_permission ->> 'guardianAccessId')::uuid;
  if requested_status = 'active' and (
       access_row.id is null
       or access_row.status <> 'active'
       or access_row.revoked_at is not null
       or access_row.permission_level not in ('learning_manager', 'identity_manager')
       or not exists (
         select 1
         from public.academy_household_memberships as membership
         join public.academy_households as household
           on household.id = membership.household_id
         join public.academy_students as student
           on student.household_id = membership.household_id
          and student.id = access_row.student_id
         where membership.id = access_row.membership_id
           and membership.household_id = access_row.household_id
           and membership.status = 'active'
           and membership.revoked_at is null
           and membership.user_id is not null
           and household.status = 'active'
           and student.lifecycle_status = 'active'
       )
     ) then
    raise exception 'STUDY_NOTIFICATION_PERMISSION_AUTHORITY_NOT_AVAILABLE'
      using errcode = '42501';
  end if;

  select * into existing
  from academy_private.study_adult_notification_permissions
  where id = permission_id
  for update;
  if existing.id is null then
    if p_expected_revision <> 0 or access_row.id is null then
      return jsonb_build_object('status', 'revision-conflict', 'currentRevision', 0);
    end if;
    insert into academy_private.study_adult_notification_permissions (
      id, household_id, student_id, guardian_access_id, membership_id,
      recipient_ref, allowed_channels, status, policy_version,
      provenance_ref, revoked_at
    ) values (
      permission_id, access_row.household_id, access_row.student_id,
      access_row.id, access_row.membership_id,
      p_permission ->> 'recipientRef', requested_channels,
      requested_status, p_permission ->> 'policyVersion',
      p_permission ->> 'provenanceRef',
      case when requested_status = 'revoked' then now() else null end
    );
    return jsonb_build_object('status', 'stored', 'revision', 1);
  end if;
  if existing.revision <> p_expected_revision then
    return jsonb_build_object(
      'status', 'revision-conflict', 'currentRevision', existing.revision
    );
  end if;
  if existing.guardian_access_id <> (p_permission ->> 'guardianAccessId')::uuid
     or existing.recipient_ref <> p_permission ->> 'recipientRef' then
    raise exception 'STUDY_NOTIFICATION_PERMISSION_BINDING_IMMUTABLE'
      using errcode = '42501';
  end if;
  update academy_private.study_adult_notification_permissions
  set allowed_channels = requested_channels,
      status = requested_status,
      policy_version = p_permission ->> 'policyVersion',
      provenance_ref = p_permission ->> 'provenanceRef',
      revoked_at = case when requested_status = 'revoked' then now() else null end,
      revision = revision + 1,
      updated_at = now()
  where id = existing.id;
  return jsonb_build_object('status', 'stored', 'revision', existing.revision + 1);
end;
$$;

create or replace function public.academy_study_set_adult_notification_route_v1(
  p_route jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  permission academy_private.study_adult_notification_permissions%rowtype;
  existing academy_private.study_adult_notification_routes%rowtype;
  requested_status text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or not public.academy_study_json_has_exact_keys(
       p_route,
       array[
         'routeRef', 'permissionId', 'recipientRef', 'channel',
         'status', 'providerRouteVersion'
       ]::text[]
     ) then
    raise exception 'STUDY_NOTIFICATION_ROUTE_INVALID' using errcode = '22023';
  end if;
  requested_status := p_route ->> 'status';
  select * into permission
  from academy_private.study_adult_notification_permissions
  where id = (p_route ->> 'permissionId')::uuid
    and recipient_ref = p_route ->> 'recipientRef'
    and (requested_status = 'revoked' or status = 'active')
  for update;
  if permission.id is null
     or p_route ->> 'channel' not in ('email', 'in-app', 'sms')
     or not (p_route ->> 'channel' = any(permission.allowed_channels))
     or requested_status not in ('active', 'revoked')
     or not public.academy_study_identifier_is_valid(p_route ->> 'routeRef')
     or not public.academy_study_identifier_is_valid(
       p_route ->> 'providerRouteVersion'
     ) then
    raise exception 'STUDY_NOTIFICATION_ROUTE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_notification_routes
  where route_ref = p_route ->> 'routeRef'
  for update;
  if existing.route_ref is null then
    if p_expected_revision <> 0 then
      return jsonb_build_object('status', 'revision-conflict', 'currentRevision', 0);
    end if;
    insert into academy_private.study_adult_notification_routes (
      route_ref, permission_id, household_id, student_id, recipient_ref,
      channel, status, provider_route_version, revoked_at
    ) values (
      p_route ->> 'routeRef', permission.id, permission.household_id,
      permission.student_id, permission.recipient_ref,
      p_route ->> 'channel', requested_status,
      p_route ->> 'providerRouteVersion',
      case when requested_status = 'revoked' then now() else null end
    );
    return jsonb_build_object('status', 'stored', 'revision', 1);
  end if;
  if existing.revision <> p_expected_revision then
    return jsonb_build_object(
      'status', 'revision-conflict', 'currentRevision', existing.revision
    );
  end if;
  if existing.permission_id <> permission.id
     or existing.recipient_ref <> permission.recipient_ref
     or existing.channel <> p_route ->> 'channel' then
    raise exception 'STUDY_NOTIFICATION_ROUTE_BINDING_IMMUTABLE'
      using errcode = '42501';
  end if;
  update academy_private.study_adult_notification_routes
  set status = requested_status,
      provider_route_version = p_route ->> 'providerRouteVersion',
      revoked_at = case when requested_status = 'revoked' then now() else null end,
      revision = revision + 1,
      updated_at = now()
  where route_ref = existing.route_ref;
  return jsonb_build_object('status', 'stored', 'revision', existing.revision + 1);
end;
$$;

create or replace function public.academy_study_create_adult_review_proposal_v1(
  p_proposal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  session_row public.academy_study_sessions%rowtype;
  existing academy_private.study_adult_review_proposals_v1%rowtype;
  reasons text[];
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_proposal,
    array[
      'schemaVersion', 'proposalId', 'householdId', 'studentId', 'sessionId',
      'category', 'classification', 'urgency', 'reasonCodes',
      'classifierVersion', 'occurredAt', 'idempotencyKey', 'deliveryState',
      'authorizedRecipientResolutionState'
    ]::text[]
  ) or not public.academy_study_payload_is_minimized(p_proposal, 4096)
    or jsonb_typeof(p_proposal -> 'reasonCodes') <> 'array' then
    raise exception 'STUDY_PROPOSAL_V1_INVALID' using errcode = '22023';
  end if;
  select coalesce(array_agg(value order by ordinal), '{}'::text[])
    into reasons
  from jsonb_array_elements_text(p_proposal -> 'reasonCodes')
    with ordinality as reason(value, ordinal);
  if (p_proposal ->> 'schemaVersion')::integer <> 1
     or p_proposal ->> 'category' <> 'student-support'
     or p_proposal ->> 'classification' not in ('urgent', 'uncertain', 'invalid')
     or p_proposal ->> 'urgency' not in ('urgent', 'uncertain', 'review-required')
     or (p_proposal ->> 'classification', p_proposal ->> 'urgency') not in (
       ('urgent', 'urgent'), ('uncertain', 'uncertain'),
       ('invalid', 'review-required')
     )
     or p_proposal ->> 'deliveryState' <> 'proposed-not-delivered'
     or p_proposal ->> 'authorizedRecipientResolutionState' <> 'pending'
     or cardinality(reasons) not between 1 and 16
     or not public.academy_study_identifiers_are_unique(reasons)
     or not public.academy_study_identifier_is_valid(p_proposal ->> 'proposalId')
     or not public.academy_study_identifier_is_valid(p_proposal ->> 'classifierVersion')
     or not public.academy_study_identifier_is_valid(p_proposal ->> 'idempotencyKey') then
    raise exception 'STUDY_PROPOSAL_V1_INVALID' using errcode = '22023';
  end if;
  select * into session_row
  from public.academy_study_sessions
  where id = p_proposal ->> 'sessionId'
    and household_id = (p_proposal ->> 'householdId')::uuid
    and student_id = (p_proposal ->> 'studentId')::uuid;
  if session_row.id is null then
    raise exception 'STUDY_PROPOSAL_V1_SCOPE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_review_proposals_v1
  where household_id = session_row.household_id
    and student_id = session_row.student_id
    and idempotency_key = p_proposal ->> 'idempotencyKey';
  if existing.proposal_id is not null then
    if existing.proposal_id = p_proposal ->> 'proposalId'
       and existing.session_id = session_row.id
       and existing.classification = p_proposal ->> 'classification'
       and existing.urgency = p_proposal ->> 'urgency'
       and existing.reason_codes = reasons
       and existing.classifier_version = p_proposal ->> 'classifierVersion' then
      return jsonb_build_object(
        'created', false, 'duplicateProposalId', existing.proposal_id
      );
    end if;
    raise exception 'STUDY_PROPOSAL_V1_IDEMPOTENCY_COLLISION' using errcode = '23505';
  end if;
  insert into academy_private.study_adult_review_proposals_v1 (
    proposal_id, household_id, student_id, session_id, classification,
    urgency, reason_codes, classifier_version, occurred_at, idempotency_key
  ) values (
    p_proposal ->> 'proposalId', session_row.household_id,
    session_row.student_id, session_row.id,
    p_proposal ->> 'classification', p_proposal ->> 'urgency', reasons,
    p_proposal ->> 'classifierVersion',
    (p_proposal ->> 'occurredAt')::timestamptz,
    p_proposal ->> 'idempotencyKey'
  );
  return jsonb_build_object('created', true);
end;
$$;

create or replace function public.academy_study_claim_adult_review_proposals_v1(
  p_now timestamptz,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item academy_private.study_adult_review_proposals_v1%rowtype;
  token uuid;
  expires_at timestamptz;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_now is null or p_limit not between 1 and 100
     or p_lease_seconds not between 5 and 300 then
    raise exception 'STUDY_PROPOSAL_CLAIM_INVALID' using errcode = '22023';
  end if;
  update academy_private.study_adult_review_proposals_v1
  set state = 'proposed-not-delivered',
      recipient_resolution_state = 'pending',
      lease_token = null,
      lease_expires_at = null,
      revision = revision + 1,
      updated_at = p_now
  where recipient_resolution_state = 'processing'
    and lease_expires_at <= p_now;

  for item in
    select proposal.*
    from academy_private.study_adult_review_proposals_v1 as proposal
    where proposal.recipient_resolution_state = 'pending'
      and proposal.state = 'proposed-not-delivered'
    order by proposal.occurred_at, proposal.proposal_id
    for update skip locked
    limit p_limit
  loop
    token := gen_random_uuid();
    expires_at := p_now + make_interval(secs => p_lease_seconds);
    update academy_private.study_adult_review_proposals_v1
    set state = 'routing',
        recipient_resolution_state = 'processing',
        lease_token = token,
        lease_expires_at = expires_at,
        lease_generation = lease_generation + 1,
        revision = revision + 1,
        updated_at = p_now
    where proposal_id = item.proposal_id;
    result := result || jsonb_build_array(jsonb_build_object(
      'proposal', jsonb_build_object(
        'schemaVersion', 1,
        'proposalId', item.proposal_id,
        'householdId', item.household_id,
        'studentId', item.student_id,
        'sessionId', item.session_id,
        'category', item.category,
        'classification', item.classification,
        'urgency', item.urgency,
        'reasonCodes', to_jsonb(item.reason_codes),
        'classifierVersion', item.classifier_version,
        'occurredAt', item.occurred_at,
        'idempotencyKey', item.idempotency_key,
        'deliveryState', 'proposed-not-delivered',
        'authorizedRecipientResolutionState', 'pending'
      ),
      'leaseToken', token,
      'leaseExpiresAt', expires_at
    ));
  end loop;
  return result;
end;
$$;

create or replace function public.academy_study_resolve_adult_recipients_v1(
  p_proposal_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  recipient record;
  route record;
  recipients jsonb := '[]'::jsonb;
  routes jsonb;
  resolution_ref text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = p_proposal_id;
  if proposal.proposal_id is null then
    return jsonb_build_object(
      'state', 'unavailable', 'reasonCode', 'proposal-not-found'
    );
  end if;
  for recipient in
    select permission.id, permission.recipient_ref,
      permission.membership_id, permission.guardian_access_id
    from academy_private.study_adult_notification_permissions as permission
    join public.academy_guardian_student_access as access
      on access.id = permission.guardian_access_id
     and access.household_id = permission.household_id
     and access.student_id = permission.student_id
     and access.membership_id = permission.membership_id
    join public.academy_household_memberships as membership
      on membership.id = permission.membership_id
     and membership.household_id = permission.household_id
    join public.academy_households as household
      on household.id = permission.household_id
    join public.academy_students as student
      on student.id = permission.student_id
     and student.household_id = permission.household_id
    where permission.household_id = proposal.household_id
      and permission.student_id = proposal.student_id
      and permission.status = 'active'
      and permission.revoked_at is null
      and access.status = 'active'
      and access.revoked_at is null
      and access.permission_level in ('learning_manager', 'identity_manager')
      and membership.status = 'active'
      and membership.revoked_at is null
      and membership.user_id is not null
      and household.status = 'active'
      and student.lifecycle_status = 'active'
    order by permission.recipient_ref
  loop
    routes := '[]'::jsonb;
    for route in
      select notification_route.route_ref, notification_route.channel
      from academy_private.study_adult_notification_routes as notification_route
      join academy_private.study_adult_notification_permissions as route_permission
        on route_permission.id = notification_route.permission_id
      where notification_route.permission_id = recipient.id
        and notification_route.recipient_ref = recipient.recipient_ref
        and notification_route.status = 'active'
        and notification_route.revoked_at is null
        and notification_route.channel = any(route_permission.allowed_channels)
      order by notification_route.channel, notification_route.route_ref
    loop
      routes := routes || jsonb_build_array(jsonb_build_object(
        'channel', route.channel,
        'routeRef', route.route_ref
      ));
    end loop;
    if jsonb_array_length(routes) > 0 then
      recipients := recipients || jsonb_build_array(jsonb_build_object(
        'recipientRef', recipient.recipient_ref,
        'membershipRef', recipient.membership_id,
        'learnerRelationshipRef', recipient.guardian_access_id,
        'notificationPermissionRef', recipient.id,
        'relationship', 'guardian',
        'routes', routes
      ));
    end if;
  end loop;
  if jsonb_array_length(recipients) = 0 then
    return jsonb_build_object(
      'state', 'unavailable', 'reasonCode', 'no-authorized-adult-route'
    );
  end if;
  resolution_ref := 'resolution:' || substr(
    academy_private.study_sha256_json(jsonb_build_object(
      'proposalId', proposal.proposal_id,
      'policyVersion', 'adult-notification-policy-v1',
      'recipients', recipients
    )), 1, 48
  );
  return jsonb_build_object(
    'state', 'resolved',
    'resolutionRef', resolution_ref,
    'policyVersion', 'adult-notification-policy-v1',
    'recipients', recipients
  );
end;
$$;

create or replace function public.academy_study_reauthorize_adult_route_v1(
  p_input jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  binding record;
  evidence_ref text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_input, array['proposalRef', 'recipientRef', 'routeRef', 'now']::text[]
  ) then
    raise exception 'STUDY_ROUTE_REAUTHORIZATION_INVALID' using errcode = '22023';
  end if;
  select route.channel, permission.id as permission_id,
    permission.revision as permission_revision,
    route.revision as route_revision,
    access.id as access_id,
    membership.id as membership_id
    into binding
  from academy_private.study_adult_review_proposals_v1 as proposal
  join academy_private.study_adult_notification_routes as route
    on route.household_id = proposal.household_id
   and route.student_id = proposal.student_id
  join academy_private.study_adult_notification_permissions as permission
    on permission.id = route.permission_id
   and permission.household_id = proposal.household_id
   and permission.student_id = proposal.student_id
  join public.academy_guardian_student_access as access
    on access.id = permission.guardian_access_id
   and access.membership_id = permission.membership_id
   and access.household_id = permission.household_id
   and access.student_id = permission.student_id
  join public.academy_household_memberships as membership
    on membership.id = permission.membership_id
   and membership.household_id = permission.household_id
  join public.academy_households as household
    on household.id = permission.household_id
  join public.academy_students as student
    on student.id = permission.student_id
   and student.household_id = permission.household_id
  where proposal.proposal_id = p_input ->> 'proposalRef'
    and permission.recipient_ref = p_input ->> 'recipientRef'
    and route.recipient_ref = p_input ->> 'recipientRef'
    and route.route_ref = p_input ->> 'routeRef'
    and permission.status = 'active'
    and permission.revoked_at is null
    and route.status = 'active'
    and route.revoked_at is null
    and route.channel = any(permission.allowed_channels)
    and access.status = 'active'
    and access.revoked_at is null
    and access.permission_level in ('learning_manager', 'identity_manager')
    and membership.status = 'active'
    and membership.revoked_at is null
    and membership.user_id is not null
    and household.status = 'active'
    and student.lifecycle_status = 'active';
  if binding.channel is null then
    return jsonb_build_object('state', 'revoked', 'reasonCode', 'route-not-authorized');
  end if;
  evidence_ref := 'authorization-evidence:' || substr(
    academy_private.study_sha256_json(jsonb_build_object(
      'proposalRef', p_input ->> 'proposalRef',
      'recipientRef', p_input ->> 'recipientRef',
      'routeRef', p_input ->> 'routeRef',
      'permissionId', binding.permission_id,
      'permissionRevision', binding.permission_revision,
      'routeRevision', binding.route_revision,
      'accessId', binding.access_id,
      'membershipId', binding.membership_id,
      'at', p_input ->> 'now'
    )), 1, 40
  );
  return jsonb_build_object(
    'state', 'authorized',
    'channel', binding.channel,
    'authorizationEvidenceRef', evidence_ref
  );
end;
$$;

create or replace function public.academy_study_record_recipient_resolution_v1(
  p_resolution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  route_input jsonb;
  binding record;
  existing academy_private.study_adult_review_delivery_jobs%rowtype;
  inserted academy_private.study_adult_review_delivery_jobs%rowtype;
  result jsonb := '[]'::jsonb;
  requested_state text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_resolution) <> 'object'
     or not (p_resolution ?& array['proposalId', 'proposalLeaseToken']) then
    raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
  end if;
  select * into proposal
  from academy_private.study_adult_review_proposals_v1
  where proposal_id = p_resolution ->> 'proposalId'
  for update;
  if proposal.proposal_id is null
     or proposal.recipient_resolution_state <> 'processing'
     or proposal.lease_token <> (p_resolution ->> 'proposalLeaseToken')::uuid
     or proposal.lease_expires_at <= now() then
    raise exception 'STUDY_PROPOSAL_LEASE_NOT_AVAILABLE' using errcode = '40001';
  end if;

  requested_state := coalesce(p_resolution ->> 'state', 'resolved');
  if requested_state in ('unavailable', 'indeterminate') then
    if not (p_resolution ? 'reasonCode')
       or not public.academy_study_identifier_is_valid(
         p_resolution ->> 'reasonCode'
       ) then
      raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
    end if;
    update academy_private.study_adult_review_proposals_v1
    set state = requested_state,
        recipient_resolution_state = requested_state,
        lease_token = null,
        lease_expires_at = null,
        revision = revision + 1,
        updated_at = now()
    where proposal_id = proposal.proposal_id;
    return jsonb_build_object('recorded', true);
  end if;
  if requested_state <> 'resolved'
     or not (p_resolution ?& array['resolutionRef', 'policyVersion', 'routes'])
     or jsonb_typeof(p_resolution -> 'routes') <> 'array'
     or jsonb_array_length(p_resolution -> 'routes') not between 1 and 32
     or not public.academy_study_identifier_is_valid(
       p_resolution ->> 'resolutionRef'
     )
     or not public.academy_study_identifier_is_valid(
       p_resolution ->> 'policyVersion'
     ) then
    raise exception 'STUDY_RECIPIENT_RESOLUTION_INVALID' using errcode = '22023';
  end if;

  for route_input in select value from jsonb_array_elements(p_resolution -> 'routes')
  loop
    if not public.academy_study_json_has_exact_keys(
      route_input,
      array['recipientRef', 'routeRef', 'channel', 'deliveryIdempotencyKey']::text[]
    ) then
      raise exception 'STUDY_RECIPIENT_ROUTE_INVALID' using errcode = '22023';
    end if;
    select route.route_ref, route.recipient_ref, route.channel
      into binding
    from academy_private.study_adult_notification_routes as route
    join academy_private.study_adult_notification_permissions as permission
      on permission.id = route.permission_id
     and permission.household_id = route.household_id
     and permission.student_id = route.student_id
    join public.academy_guardian_student_access as access
      on access.id = permission.guardian_access_id
     and access.membership_id = permission.membership_id
     and access.household_id = permission.household_id
     and access.student_id = permission.student_id
    join public.academy_household_memberships as membership
      on membership.id = permission.membership_id
     and membership.household_id = permission.household_id
    where route.route_ref = route_input ->> 'routeRef'
      and route.recipient_ref = route_input ->> 'recipientRef'
      and route.channel = route_input ->> 'channel'
      and route.household_id = proposal.household_id
      and route.student_id = proposal.student_id
      and route.status = 'active' and route.revoked_at is null
      and permission.status = 'active' and permission.revoked_at is null
      and route.channel = any(permission.allowed_channels)
      and access.status = 'active' and access.revoked_at is null
      and access.permission_level in ('learning_manager', 'identity_manager')
      and membership.status = 'active' and membership.revoked_at is null
      and membership.user_id is not null;
    if binding.route_ref is null then
      raise exception 'STUDY_RECIPIENT_ROUTE_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    select * into existing
    from academy_private.study_adult_review_delivery_jobs
    where proposal_id = proposal.proposal_id
      and route_ref = binding.route_ref;
    if existing.id is not null then
      if existing.delivery_idempotency_key <>
           route_input ->> 'deliveryIdempotencyKey'
         or existing.recipient_ref <> binding.recipient_ref
         or existing.channel <> binding.channel then
        raise exception 'STUDY_DELIVERY_JOB_IDEMPOTENCY_COLLISION'
          using errcode = '23505';
      end if;
      inserted := existing;
    else
      insert into academy_private.study_adult_review_delivery_jobs (
        proposal_id, household_id, student_id, recipient_ref, route_ref,
        channel, delivery_idempotency_key
      ) values (
        proposal.proposal_id, proposal.household_id, proposal.student_id,
        binding.recipient_ref, binding.route_ref, binding.channel,
        route_input ->> 'deliveryIdempotencyKey'
      ) returning * into inserted;
    end if;
    result := result || jsonb_build_array(jsonb_build_object(
      'schemaVersion', 1,
      'outboxId', inserted.id,
      'proposalId', inserted.proposal_id,
      'deliveryIdempotencyKey', inserted.delivery_idempotency_key,
      'recipientRef', inserted.recipient_ref,
      'routeRef', inserted.route_ref,
      'channel', inserted.channel,
      'templateCode', inserted.template_code,
      'state', inserted.state,
      'attemptCount', inserted.attempt_count,
      'retryAt', inserted.retry_at,
      'version', inserted.revision
    ));
  end loop;
  update academy_private.study_adult_review_proposals_v1
  set state = 'routed',
      recipient_resolution_state = 'resolved',
      resolution_ref = p_resolution ->> 'resolutionRef',
      resolution_policy_version = p_resolution ->> 'policyVersion',
      lease_token = null,
      lease_expires_at = null,
      revision = revision + 1,
      updated_at = now()
  where proposal_id = proposal.proposal_id;
  return jsonb_build_object('jobs', result);
end;
$$;

create or replace function public.academy_study_claim_delivery_jobs_v1(
  p_now timestamptz,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item academy_private.study_adult_review_delivery_jobs%rowtype;
  proposal academy_private.study_adult_review_proposals_v1%rowtype;
  token uuid;
  expires_at timestamptz;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_now is null or p_limit not between 1 and 100
     or p_lease_seconds not between 5 and 300 then
    raise exception 'STUDY_DELIVERY_CLAIM_INVALID' using errcode = '22023';
  end if;

  -- If an attempt escaped the worker and its lease expired, provider acceptance
  -- is unknowable. Quarantine it instead of performing a second delivery.
  update academy_private.study_adult_review_delivery_jobs as job
  set state = 'indeterminate',
      lease_token = null,
      lease_expires_at = null,
      retry_at = null,
      last_failure_code = 'lease-expired-after-attempt',
      failed_at = p_now,
      revision = revision + 1,
      updated_at = p_now
  where job.state = 'claimed'
    and job.lease_expires_at <= p_now
    and exists (
      select 1
      from academy_private.study_adult_review_delivery_attempts as attempt
      where attempt.job_id = job.id
        and attempt.lease_generation = job.lease_generation
    );

  -- An expired lease that never recorded an attempt is safe to recover.
  update academy_private.study_adult_review_delivery_jobs as job
  set state = 'pending',
      lease_token = null,
      lease_expires_at = null,
      revision = revision + 1,
      updated_at = p_now
  where job.state = 'claimed'
    and job.lease_expires_at <= p_now
    and not exists (
      select 1
      from academy_private.study_adult_review_delivery_attempts as attempt
      where attempt.job_id = job.id
        and attempt.lease_generation = job.lease_generation
    );

  for item in
    select job.*
    from academy_private.study_adult_review_delivery_jobs as job
    where job.state = 'pending'
      or (job.state = 'retry-scheduled' and job.retry_at <= p_now)
    order by job.created_at, job.id
    for update skip locked
    limit p_limit
  loop
    token := gen_random_uuid();
    expires_at := p_now + make_interval(secs => p_lease_seconds);
    update academy_private.study_adult_review_delivery_jobs
    set state = 'claimed',
        retry_at = null,
        last_failure_code = null,
        failed_at = null,
        lease_token = token,
        lease_expires_at = expires_at,
        lease_generation = lease_generation + 1,
        revision = revision + 1,
        updated_at = p_now
    where id = item.id;
    select * into proposal
    from academy_private.study_adult_review_proposals_v1
    where proposal_id = item.proposal_id;
    result := result || jsonb_build_array(jsonb_build_object(
      'record', jsonb_build_object(
        'schemaVersion', 1,
        'outboxId', item.id,
        'proposalId', item.proposal_id,
        'deliveryIdempotencyKey', item.delivery_idempotency_key,
        'recipientRef', item.recipient_ref,
        'routeRef', item.route_ref,
        'channel', item.channel,
        'templateCode', item.template_code,
        'state', 'claimed',
        'attemptCount', item.attempt_count,
        'retryAt', null,
        'version', item.revision + 1
      ),
      'proposal', jsonb_build_object(
        'schemaVersion', 1,
        'proposalId', proposal.proposal_id,
        'householdId', proposal.household_id,
        'studentId', proposal.student_id,
        'sessionId', proposal.session_id,
        'category', proposal.category,
        'classification', proposal.classification,
        'urgency', proposal.urgency,
        'reasonCodes', to_jsonb(proposal.reason_codes),
        'classifierVersion', proposal.classifier_version,
        'occurredAt', proposal.occurred_at,
        'idempotencyKey', proposal.idempotency_key,
        'deliveryState', 'proposed-not-delivered',
        'authorizedRecipientResolutionState', 'pending'
      ),
      'leaseToken', token,
      'leaseExpiresAt', expires_at
    ));
  end loop;
  return result;
end;
$$;

create or replace function public.academy_study_record_delivery_attempt_v1(
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
  next_ordinal integer;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_attempt,
    array[
      'outboxId', 'leaseToken', 'attemptId', 'deliveryIdempotencyKey',
      'recipientRef', 'routeRef', 'channel', 'providerVersion',
      'authorizationEvidenceRef', 'attemptedAt'
    ]::text[]
  ) then
    raise exception 'STUDY_DELIVERY_ATTEMPT_INVALID' using errcode = '22023';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = (p_attempt ->> 'outboxId')::uuid
  for update;
  if job.id is null or job.state <> 'claimed'
     or job.lease_token <> (p_attempt ->> 'leaseToken')::uuid
     or job.lease_expires_at <= now() then
    raise exception 'STUDY_DELIVERY_LEASE_NOT_AVAILABLE' using errcode = '40001';
  end if;
  if job.delivery_idempotency_key <> p_attempt ->> 'deliveryIdempotencyKey'
     or job.recipient_ref <> p_attempt ->> 'recipientRef'
     or job.route_ref <> p_attempt ->> 'routeRef'
     or job.channel <> p_attempt ->> 'channel'
     or not public.academy_study_identifier_is_valid(p_attempt ->> 'attemptId')
     or not public.academy_study_identifier_is_valid(p_attempt ->> 'providerVersion')
     or not public.academy_study_identifier_is_valid(
       p_attempt ->> 'authorizationEvidenceRef'
     ) then
    raise exception 'STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_attempt ->> 'attemptId';
  if existing.attempt_id is not null then
    if existing.job_id <> job.id
       or existing.delivery_idempotency_key <>
         p_attempt ->> 'deliveryIdempotencyKey'
       or existing.recipient_ref <> p_attempt ->> 'recipientRef'
       or existing.route_ref <> p_attempt ->> 'routeRef'
       or existing.channel <> p_attempt ->> 'channel'
       or existing.provider_version <> p_attempt ->> 'providerVersion'
       or existing.authorization_evidence_ref <>
         p_attempt ->> 'authorizationEvidenceRef' then
      raise exception 'STUDY_DELIVERY_ATTEMPT_IDEMPOTENCY_COLLISION'
        using errcode = '23505';
    end if;
    return jsonb_build_object('attemptCount', job.attempt_count);
  end if;
  next_ordinal := job.attempt_count + 1;
  insert into academy_private.study_adult_review_delivery_attempts (
    attempt_id, job_id, household_id, student_id, attempt_ordinal,
    lease_generation, delivery_idempotency_key, recipient_ref, route_ref,
    channel, provider_version, authorization_evidence_ref, attempted_at
  ) values (
    p_attempt ->> 'attemptId', job.id, job.household_id, job.student_id,
    next_ordinal, job.lease_generation, job.delivery_idempotency_key,
    job.recipient_ref, job.route_ref, job.channel,
    p_attempt ->> 'providerVersion',
    p_attempt ->> 'authorizationEvidenceRef',
    (p_attempt ->> 'attemptedAt')::timestamptz
  );
  update academy_private.study_adult_review_delivery_jobs
  set attempt_count = next_ordinal,
      revision = revision + 1,
      updated_at = now()
  where id = job.id;
  return jsonb_build_object('attemptCount', next_ordinal);
end;
$$;

create or replace function public.academy_study_record_delivery_receipt_v1(
  p_receipt jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  attempt academy_private.study_adult_review_delivery_attempts%rowtype;
  existing academy_private.study_adult_review_delivery_receipts%rowtype;
  reused academy_private.study_adult_review_delivery_receipts%rowtype;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_receipt,
    array[
      'outboxId', 'leaseToken', 'attemptId', 'deliveryIdempotencyKey',
      'recipientRef', 'routeRef', 'channel', 'providerVersion',
      'authorizationEvidenceRef', 'attemptedAt', 'deliveredAt',
      'providerReceiptRef', 'receiptEvidenceRef'
    ]::text[]
  ) then
    raise exception 'STUDY_DELIVERY_RECEIPT_INVALID' using errcode = '22023';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = (p_receipt ->> 'outboxId')::uuid
  for update;
  if job.id is null or job.state <> 'claimed'
     or job.lease_token <> (p_receipt ->> 'leaseToken')::uuid
     or job.lease_expires_at <= now() then
    raise exception 'STUDY_DELIVERY_LEASE_NOT_AVAILABLE' using errcode = '40001';
  end if;
  select * into attempt
  from academy_private.study_adult_review_delivery_attempts
  where attempt_id = p_receipt ->> 'attemptId'
    and job_id = job.id;
  if attempt.attempt_id is null
     or attempt.delivery_idempotency_key <> p_receipt ->> 'deliveryIdempotencyKey'
     or attempt.recipient_ref <> p_receipt ->> 'recipientRef'
     or attempt.route_ref <> p_receipt ->> 'routeRef'
     or attempt.channel <> p_receipt ->> 'channel'
     or attempt.provider_version <> p_receipt ->> 'providerVersion'
     or not public.academy_study_identifier_is_valid(
       p_receipt ->> 'providerReceiptRef'
     )
     or not public.academy_study_identifier_is_valid(
       p_receipt ->> 'receiptEvidenceRef'
     ) then
    raise exception 'STUDY_DELIVERY_RECEIPT_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select * into existing
  from academy_private.study_adult_review_delivery_receipts
  where attempt_id = attempt.attempt_id;
  if existing.id is not null then
    if existing.provider_version <> attempt.provider_version
       or existing.provider_receipt_ref <> p_receipt ->> 'providerReceiptRef'
       or existing.receipt_evidence_ref <> p_receipt ->> 'receiptEvidenceRef' then
      raise exception 'STUDY_DELIVERY_RECEIPT_IDEMPOTENCY_COLLISION'
        using errcode = '23505';
    end if;
    return jsonb_build_object('recorded', true);
  end if;
  select * into reused
  from academy_private.study_adult_review_delivery_receipts
  where provider_version = attempt.provider_version
    and provider_receipt_ref = p_receipt ->> 'providerReceiptRef';
  if reused.id is not null then
    raise exception 'STUDY_DELIVERY_RECEIPT_REUSE' using errcode = '23505';
  end if;
  insert into academy_private.study_adult_review_delivery_receipts (
    attempt_id, job_id, household_id, student_id, provider_version,
    provider_receipt_ref, receipt_evidence_ref, delivered_at
  ) values (
    attempt.attempt_id, job.id, job.household_id, job.student_id,
    attempt.provider_version, p_receipt ->> 'providerReceiptRef',
    p_receipt ->> 'receiptEvidenceRef',
    (p_receipt ->> 'deliveredAt')::timestamptz
  );
  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.academy_study_record_delivery_outcome_v1(
  p_outcome jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  job academy_private.study_adult_review_delivery_jobs%rowtype;
  receipt academy_private.study_adult_review_delivery_receipts%rowtype;
  requested_state text;
  requested_attempt_id text;
  occurred_at timestamptz;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
    p_outcome,
    array[
      'outboxId', 'leaseToken', 'state', 'attemptId', 'occurredAt',
      'retryAt', 'failureCode'
    ]::text[]
  ) then
    raise exception 'STUDY_DELIVERY_OUTCOME_INVALID' using errcode = '22023';
  end if;
  select * into job
  from academy_private.study_adult_review_delivery_jobs
  where id = (p_outcome ->> 'outboxId')::uuid
  for update;
  if job.id is null or job.state <> 'claimed'
     or job.lease_token <> (p_outcome ->> 'leaseToken')::uuid
     or job.lease_expires_at <= now() then
    raise exception 'STUDY_DELIVERY_LEASE_NOT_AVAILABLE' using errcode = '40001';
  end if;
  requested_state := p_outcome ->> 'state';
  requested_attempt_id := nullif(p_outcome ->> 'attemptId', '');
  occurred_at := (p_outcome ->> 'occurredAt')::timestamptz;
  if requested_state = 'delivered' then
    if requested_attempt_id is null
       or p_outcome ->> 'retryAt' is not null
       or p_outcome ->> 'failureCode' is not null then
      raise exception 'STUDY_VERIFIED_RECEIPT_REQUIRED' using errcode = '22023';
    end if;
    select delivery_receipt.* into receipt
    from academy_private.study_adult_review_delivery_receipts as delivery_receipt
    where delivery_receipt.job_id = job.id
      and delivery_receipt.attempt_id = requested_attempt_id;
    if receipt.id is null then
      raise exception 'STUDY_VERIFIED_RECEIPT_REQUIRED' using errcode = '42501';
    end if;
    update academy_private.study_adult_review_delivery_jobs
    set state = 'delivered', delivered_at = receipt.delivered_at,
        lease_token = null, lease_expires_at = null,
        revision = revision + 1, updated_at = occurred_at
    where id = job.id;
  elsif requested_state = 'retry-scheduled' then
    if requested_attempt_id is null or p_outcome ->> 'retryAt' is null
       or p_outcome ->> 'failureCode' is null
       or p_outcome ->> 'failureCode' in (
         'delivery-response-lost', 'provider-timeout',
         'delivery-acceptance-unknown'
       )
       or (p_outcome ->> 'retryAt')::timestamptz <= occurred_at
       or not exists (
         select 1 from academy_private.study_adult_review_delivery_attempts
         where job_id = job.id and attempt_id = requested_attempt_id
       ) then
      raise exception 'STUDY_DELIVERY_RETRY_NOT_PROVEN_SAFE' using errcode = '22023';
    end if;
    update academy_private.study_adult_review_delivery_jobs
    set state = 'retry-scheduled',
        retry_at = (p_outcome ->> 'retryAt')::timestamptz,
        last_failure_code = p_outcome ->> 'failureCode', failed_at = occurred_at,
        lease_token = null, lease_expires_at = null,
        revision = revision + 1, updated_at = occurred_at
    where id = job.id;
  elsif requested_state in ('permanent-failure', 'indeterminate') then
    if p_outcome ->> 'failureCode' is null
       or p_outcome ->> 'retryAt' is not null
       or not public.academy_study_identifier_is_valid(
         p_outcome ->> 'failureCode'
       ) then
      raise exception 'STUDY_DELIVERY_OUTCOME_INVALID' using errcode = '22023';
    end if;
    update academy_private.study_adult_review_delivery_jobs
    set state = requested_state,
        last_failure_code = p_outcome ->> 'failureCode', failed_at = occurred_at,
        lease_token = null, lease_expires_at = null,
        revision = revision + 1, updated_at = occurred_at
    where id = job.id;
  else
    raise exception 'STUDY_DELIVERY_OUTCOME_INVALID' using errcode = '22023';
  end if;
  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.academy_study_reserve_safety_rate_limit_v1(
  p_reservation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  bucket academy_private.study_safety_rate_limit_buckets%rowtype;
  digest text;
  allowed boolean;
  retry_seconds integer;
  window_start timestamptz;
  rate_window_seconds integer := 60;
  requested_capacity integer;
  requested_now bigint;
  requested_scope text;
  requested_household_ref text := 'none';
  requested_learner_ref text := 'none';
  requested_route_ref text := 'none';
  actor_only boolean;
  subject_route boolean;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  actor_only := public.academy_study_json_has_exact_keys(
    p_reservation, array['actorRef', 'scope', 'now']::text[]
  );
  subject_route := public.academy_study_json_has_exact_keys(
    p_reservation,
    array[
      'actorRef', 'householdRef', 'learnerRef', 'routeRef', 'scope', 'now'
    ]::text[]
  );
  if not actor_only and not subject_route then
    raise exception 'STUDY_RATE_LIMIT_RESERVATION_INVALID' using errcode = '22023';
  end if;
  requested_now := (p_reservation ->> 'now')::bigint;
  requested_scope := p_reservation ->> 'scope';
  if subject_route then
    requested_household_ref := p_reservation ->> 'householdRef';
    requested_learner_ref := p_reservation ->> 'learnerRef';
    requested_route_ref := p_reservation ->> 'routeRef';
  end if;
  if p_reservation ->> 'actorRef' !~ '^actor:[0-9a-f]{64}$'
     or requested_now < 0
     or (actor_only and requested_scope <> 'study-safety-classify')
     or (subject_route and requested_scope <>
       'study-safety-classify-subject-route')
     or (subject_route and (
       requested_household_ref !~ '^household:[0-9a-f]{64}$'
       or requested_learner_ref !~ '^learner:[0-9a-f]{64}$'
       or requested_route_ref !~ '^route:[0-9a-f]{64}$'
     )) then
    raise exception 'STUDY_RATE_LIMIT_SCOPE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  requested_capacity := case
    when requested_scope = 'study-safety-classify' then 20
    else 10
  end;
  window_start := to_timestamp(
    ((requested_now / 1000) / rate_window_seconds) * rate_window_seconds
  );
  digest := academy_private.study_sha256_json(p_reservation);
  select * into bucket
  from academy_private.study_safety_rate_limit_buckets as rate_bucket
  where rate_bucket.actor_ref = p_reservation ->> 'actorRef'
    and rate_bucket.household_ref = requested_household_ref
    and rate_bucket.learner_ref = requested_learner_ref
    and rate_bucket.route_ref = requested_route_ref
    and rate_bucket.scope = requested_scope
    and rate_bucket.window_started_at = window_start
    and rate_bucket.window_seconds = rate_window_seconds
  for update;
  if bucket.id is null then
    insert into academy_private.study_safety_rate_limit_buckets (
      actor_ref, household_ref, learner_ref, route_ref, scope, window_started_at,
      window_seconds, capacity, used
    ) values (
      p_reservation ->> 'actorRef', requested_household_ref,
      requested_learner_ref, requested_route_ref,
      requested_scope, window_start, rate_window_seconds, requested_capacity, 0
    ) returning * into bucket;
  end if;
  allowed := bucket.used < bucket.capacity;
  if allowed then
    update academy_private.study_safety_rate_limit_buckets
    set used = used + 1, revision = revision + 1, updated_at = now()
    where id = bucket.id;
  end if;
  insert into academy_private.study_safety_rate_limit_reservations (
    actor_ref, household_ref, learner_ref, route_ref, scope,
    bucket_id, request_digest, allowed, reserved_at
  ) values (
    p_reservation ->> 'actorRef', requested_household_ref,
    requested_learner_ref, requested_route_ref,
    requested_scope, bucket.id, digest, allowed, to_timestamp(requested_now / 1000.0)
  );
  if allowed then
    return jsonb_build_object('allowed', true);
  end if;
  retry_seconds := greatest(1, ceil(
    extract(epoch from window_start) + rate_window_seconds - (requested_now / 1000.0)
  )::integer);
  return jsonb_build_object(
    'allowed', false, 'retryAfterSeconds', retry_seconds
  );
end;
$$;

create or replace function public.academy_study_record_safety_monitoring_event_v1(
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing academy_private.study_safety_monitoring_events%rowtype;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not public.academy_study_json_has_exact_keys(
       p_event,
       array[
         'schemaVersion', 'eventId', 'name', 'service', 'severity',
         'occurredAt', 'code', 'metricName', 'runbookId', 'attributes'
       ]::text[]
     )
     or (p_event ->> 'schemaVersion')::integer <> 1
     or p_event ->> 'service' <> 'study-safety'
     or jsonb_typeof(p_event -> 'attributes') <> 'object'
     or exists (
       select 1 from jsonb_object_keys(p_event -> 'attributes') as key(name)
       where not (key.name = any(array[
         'adultReviewState', 'backlogCount', 'oldestAgeSeconds', 'attemptCount'
       ]::text[]))
     )
     or not public.academy_study_payload_is_minimized(p_event, 2048) then
    raise exception 'STUDY_MONITORING_EVENT_INVALID' using errcode = '22023';
  end if;
  select * into existing
  from academy_private.study_safety_monitoring_events
  where event_id = p_event ->> 'eventId';
  if existing.event_id is not null then
    if existing.name <> p_event ->> 'name'
       or existing.severity <> p_event ->> 'severity'
       or existing.code <> p_event ->> 'code'
       or existing.occurred_at <> (p_event ->> 'occurredAt')::timestamptz then
      raise exception 'STUDY_MONITORING_EVENT_IDEMPOTENCY_COLLISION'
        using errcode = '23505';
    end if;
    return jsonb_build_object('recorded', true);
  end if;
  insert into academy_private.study_safety_monitoring_events (
    event_id, name, severity, occurred_at, code, service,
    metric_name, runbook_id, attributes
  ) values (
    p_event ->> 'eventId', p_event ->> 'name', p_event ->> 'severity',
    (p_event ->> 'occurredAt')::timestamptz, p_event ->> 'code',
    p_event ->> 'service', p_event ->> 'metricName',
    p_event ->> 'runbookId', p_event -> 'attributes'
  );
  return jsonb_build_object('recorded', true);
end;
$$;

alter table academy_private.study_persistence_metadata
  add column production_reconciliation_version smallint not null default 0
    check (production_reconciliation_version in (0, 1));

update academy_private.study_persistence_metadata
set production_reconciliation_version = 1,
    migration_names = array_append(
      migration_names,
      '20260801012000_academy_study_engine_production_reconciliation'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'production_reconciliation_version', 1,
      'canonical_safety_proposal', 'study_adult_review_proposals_v1',
      'attempt_bound_receipts', true,
      'durable_rate_limit', true,
      'adult_notification_permission', true,
      'timezone_snapshot_revision', true
    ),
    updated_at = now()
where singleton;

create or replace function public.academy_study_safety_durable_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  ready boolean;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select metadata.production_reconciliation_version = 1
    and to_regclass('academy_private.study_adult_notification_permissions') is not null
    and to_regclass('academy_private.study_adult_notification_routes') is not null
    and to_regclass('academy_private.study_adult_review_proposals_v1') is not null
    and to_regclass('academy_private.study_adult_review_delivery_jobs') is not null
    and to_regclass('academy_private.study_adult_review_delivery_attempts') is not null
    and to_regclass('academy_private.study_adult_review_delivery_receipts') is not null
    and to_regclass('academy_private.study_safety_rate_limit_buckets') is not null
    and to_regclass('academy_private.study_safety_rate_limit_reservations') is not null
    and to_regclass('academy_private.study_safety_monitoring_events') is not null
    and not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'academy_private'
        and relation.relname = any(array[
          'study_adult_notification_permissions',
          'study_adult_notification_routes',
          'study_adult_review_proposals_v1',
          'study_adult_review_delivery_jobs',
          'study_adult_review_delivery_attempts',
          'study_adult_review_delivery_receipts',
          'study_safety_rate_limit_buckets',
          'study_safety_rate_limit_reservations',
          'study_safety_monitoring_events'
        ]::text[])
        and (
          not relation.relrowsecurity
          or not relation.relforcerowsecurity
          or pg_catalog.pg_get_userbyid(relation.relowner) <> 'postgres'
        )
    )
    and not exists (
      select 1
      from information_schema.role_table_grants as privilege
      where privilege.table_schema = 'academy_private'
        and privilege.table_name = any(array[
          'study_adult_notification_permissions',
          'study_adult_notification_routes',
          'study_adult_review_proposals_v1',
          'study_adult_review_delivery_jobs',
          'study_adult_review_delivery_attempts',
          'study_adult_review_delivery_receipts',
          'study_safety_rate_limit_buckets',
          'study_safety_rate_limit_reservations',
          'study_safety_monitoring_events'
        ]::text[])
        and privilege.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
    )
    and 14 = (
      select count(distinct procedure.proname)
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = any(array[
          'academy_study_set_adult_notification_permission_v1',
          'academy_study_set_adult_notification_route_v1',
          'academy_study_create_adult_review_proposal_v1',
          'academy_study_claim_adult_review_proposals_v1',
          'academy_study_resolve_adult_recipients_v1',
          'academy_study_reauthorize_adult_route_v1',
          'academy_study_record_recipient_resolution_v1',
          'academy_study_claim_delivery_jobs_v1',
          'academy_study_record_delivery_attempt_v1',
          'academy_study_record_delivery_receipt_v1',
          'academy_study_record_delivery_outcome_v1',
          'academy_study_reserve_safety_rate_limit_v1',
          'academy_study_record_safety_monitoring_event_v1',
          'academy_study_safety_durable_readiness_v1'
        ]::text[])
    )
    and not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = any(array[
          'academy_study_set_adult_notification_permission_v1',
          'academy_study_set_adult_notification_route_v1',
          'academy_study_create_adult_review_proposal_v1',
          'academy_study_claim_adult_review_proposals_v1',
          'academy_study_resolve_adult_recipients_v1',
          'academy_study_reauthorize_adult_route_v1',
          'academy_study_record_recipient_resolution_v1',
          'academy_study_claim_delivery_jobs_v1',
          'academy_study_record_delivery_attempt_v1',
          'academy_study_record_delivery_receipt_v1',
          'academy_study_record_delivery_outcome_v1',
          'academy_study_reserve_safety_rate_limit_v1',
          'academy_study_record_safety_monitoring_event_v1',
          'academy_study_safety_durable_readiness_v1'
        ]::text[])
        and (
          not procedure.prosecdef
          or pg_catalog.pg_get_userbyid(procedure.proowner) <> 'postgres'
          or not coalesce(
            procedure.proconfig @> array['search_path=pg_catalog']::text[],
            false
          )
          or pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
        )
    )
    into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  if coalesce(ready, false) then
    return jsonb_build_object('status', 'ready', 'schemaVersion', 1);
  end if;
  return jsonb_build_object('status', 'not-ready', 'schemaVersion', 1);
end;
$$;

create trigger study_delivery_attempts_immutable
  before update or delete
  on academy_private.study_adult_review_delivery_attempts
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_delivery_receipts_immutable
  before update or delete
  on academy_private.study_adult_review_delivery_receipts
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_rate_limit_reservations_immutable
  before update or delete
  on academy_private.study_safety_rate_limit_reservations
  for each row execute function academy_private.study_prevent_mutation();
create trigger study_safety_monitoring_events_immutable
  before update or delete
  on academy_private.study_safety_monitoring_events
  for each row execute function academy_private.study_prevent_mutation();

alter table academy_private.study_adult_notification_permissions enable row level security;
alter table academy_private.study_adult_notification_permissions force row level security;
alter table academy_private.study_adult_notification_routes enable row level security;
alter table academy_private.study_adult_notification_routes force row level security;
alter table academy_private.study_adult_review_proposals_v1 enable row level security;
alter table academy_private.study_adult_review_proposals_v1 force row level security;
alter table academy_private.study_adult_review_delivery_jobs enable row level security;
alter table academy_private.study_adult_review_delivery_jobs force row level security;
alter table academy_private.study_adult_review_delivery_attempts enable row level security;
alter table academy_private.study_adult_review_delivery_attempts force row level security;
alter table academy_private.study_adult_review_delivery_receipts enable row level security;
alter table academy_private.study_adult_review_delivery_receipts force row level security;
alter table academy_private.study_safety_rate_limit_buckets enable row level security;
alter table academy_private.study_safety_rate_limit_buckets force row level security;
alter table academy_private.study_safety_rate_limit_reservations enable row level security;
alter table academy_private.study_safety_rate_limit_reservations force row level security;
alter table academy_private.study_safety_monitoring_events enable row level security;
alter table academy_private.study_safety_monitoring_events force row level security;

alter table academy_private.study_adult_notification_permissions owner to postgres;
alter table academy_private.study_adult_notification_routes owner to postgres;
alter table academy_private.study_adult_review_proposals_v1 owner to postgres;
alter table academy_private.study_adult_review_delivery_jobs owner to postgres;
alter table academy_private.study_adult_review_delivery_attempts owner to postgres;
alter table academy_private.study_adult_review_delivery_receipts owner to postgres;
alter table academy_private.study_safety_rate_limit_buckets owner to postgres;
alter table academy_private.study_safety_rate_limit_reservations owner to postgres;
alter table academy_private.study_safety_monitoring_events owner to postgres;

revoke all on table academy_private.study_adult_notification_permissions
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_notification_routes
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_proposals_v1
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_delivery_jobs
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_delivery_attempts
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_adult_review_delivery_receipts
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_safety_rate_limit_buckets
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_safety_rate_limit_reservations
  from public, anon, authenticated, service_role;
revoke all on table academy_private.study_safety_monitoring_events
  from public, anon, authenticated, service_role;

-- The legacy Session 13 transition accepted an arbitrary receipt reference.
-- Keep its historical function for migration compatibility but make it
-- unreachable from application roles after the attempt-bound replacement.
revoke all on function public.academy_study_create_adult_review_proposal(jsonb)
  from service_role;
revoke all on function public.academy_study_enqueue_outbox(jsonb)
  from service_role;
revoke all on function public.academy_study_transition_outbox(jsonb)
  from service_role;
revoke all on function public.academy_study_outbox_status(uuid)
  from service_role;

revoke all on function public.academy_study_set_adult_notification_permission_v1(jsonb, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_set_adult_notification_route_v1(jsonb, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_create_adult_review_proposal_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_claim_adult_review_proposals_v1(timestamptz, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_resolve_adult_recipients_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_reauthorize_adult_route_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_recipient_resolution_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_claim_delivery_jobs_v1(timestamptz, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_delivery_attempt_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_delivery_receipt_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_delivery_outcome_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_reserve_safety_rate_limit_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_record_safety_monitoring_event_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_safety_durable_readiness_v1()
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_set_adult_notification_permission_v1(jsonb, bigint)
  to service_role;
grant execute on function public.academy_study_set_adult_notification_route_v1(jsonb, bigint)
  to service_role;
grant execute on function public.academy_study_create_adult_review_proposal_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_claim_adult_review_proposals_v1(timestamptz, integer, integer)
  to service_role;
grant execute on function public.academy_study_resolve_adult_recipients_v1(text)
  to service_role;
grant execute on function public.academy_study_reauthorize_adult_route_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_record_recipient_resolution_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_claim_delivery_jobs_v1(timestamptz, integer, integer)
  to service_role;
grant execute on function public.academy_study_record_delivery_attempt_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_record_delivery_receipt_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_record_delivery_outcome_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_reserve_safety_rate_limit_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_record_safety_monitoring_event_v1(jsonb)
  to service_role;
grant execute on function public.academy_study_safety_durable_readiness_v1()
  to service_role;

revoke all on function academy_private.study_apply_timezone_snapshot()
  from public, anon, authenticated, service_role;

commit;
