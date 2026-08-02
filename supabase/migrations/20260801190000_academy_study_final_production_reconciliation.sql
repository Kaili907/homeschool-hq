-- Session 19 final production reconciliation.
-- Corrects post-identity response/readiness boundaries and adds one
-- transactional opaque-grant academic gateway. No hosted execution is implied.

begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if marker.storage_version <> 1
     or marker.authorization_version <> 1
     or marker.verified_identity_version <> 1
     or marker.adult_review_operations_version <> 2
     or marker.migration_names <> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801012000_academy_study_engine_production_reconciliation',
       '20260801160000_academy_study_verified_identity',
       '20260801170000_academy_study_adult_review_operations'
     ]::text[] then
    raise exception 'Session 19 predecessor marker mismatch';
  end if;
  if to_regclass('academy_private.study_production_policy') is not null
     or to_regprocedure('public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)') is not null
     or to_regprocedure('public.academy_study_final_production_readiness_v1()') is not null then
    raise exception 'Session 19 object collision';
  end if;
end;
$$;

create table academy_private.study_production_policy (
  singleton boolean primary key default true check (singleton),
  adult_review_in_app_delivery_policy text not null default 'not-approved'
    check (adult_review_in_app_delivery_policy in ('approved', 'not-approved')),
  approval_reference text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  constraint study_production_policy_approval_check check (
    (adult_review_in_app_delivery_policy = 'not-approved'
      and approval_reference is null and approved_by is null and approved_at is null)
    or
    (adult_review_in_app_delivery_policy = 'approved'
      and public.academy_study_identifier_is_valid(approval_reference)
      and approved_by is not null and approved_at is not null)
  )
);
insert into academy_private.study_production_policy(singleton) values (true);
alter table academy_private.study_production_policy enable row level security;
alter table academy_private.study_production_policy force row level security;
alter table academy_private.study_production_policy owner to postgres;
revoke all on table academy_private.study_production_policy
  from public, anon, authenticated, service_role;

-- Preserve the detailed issuer as a private implementation and replace the
-- authenticated public surface with an opaque-only projection.
alter function public.academy_study_issue_guardian_launch_v1(text, text)
  set schema academy_private;
alter function academy_private.academy_study_issue_guardian_launch_v1(text, text)
  rename to study_issue_guardian_launch_internal_v1;
revoke all on function academy_private.study_issue_guardian_launch_internal_v1(text, text)
  from public, anon, authenticated, service_role;

create function public.academy_study_issue_guardian_launch_v1(
  p_selector_kind text,
  p_selector_value text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare issued jsonb;
begin
  issued := academy_private.study_issue_guardian_launch_internal_v1(
    p_selector_kind,
    p_selector_value
  );
  if issued ->> 'status' <> 'issued'
     or issued ->> 'sessionReference' is null
     or issued ->> 'expiresAt' is null then
    raise exception 'STUDY_SESSION_GENERATION_FAILED' using errcode = 'XX000';
  end if;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'issued',
    'sessionReference', issued ->> 'sessionReference',
    'expiresAt', issued ->> 'expiresAt'
  );
end;
$$;

-- The identity layer remains ready when its marker is present in a valid later
-- chain; it is no longer required to be the final migration name.
create or replace function public.academy_study_verified_identity_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare ready boolean;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select metadata.verified_identity_version = 1
    and metadata.migration_names @> array[
      '20260801160000_academy_study_verified_identity',
      '20260801170000_academy_study_adult_review_operations',
      '20260801190000_academy_study_final_production_reconciliation'
    ]::text[]
    and not has_function_privilege('anon',
      'public.academy_study_issue_guardian_launch_v1(text,text)', 'EXECUTE')
    and has_function_privilege('authenticated',
      'public.academy_study_issue_guardian_launch_v1(text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated',
      'public.academy_study_verify_session_v1(text,text)', 'EXECUTE')
    and has_function_privilege('service_role',
      'public.academy_study_verify_session_v1(text,text)', 'EXECUTE')
  into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  return jsonb_build_object(
    'status', case when coalesce(ready, false) then 'ready' else 'not-ready' end,
    'schemaVersion', 1,
    'issuerVersion', 'academy-student-session-issuer.v1'
  );
end;
$$;

-- Repair notification reads so a recreated permission or revoked route cannot
-- authorize an old delivery.
create or replace function public.academy_study_list_parent_notifications_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
volatile
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
      on membership.id = n.membership_id and membership.household_id = n.household_id
    join public.academy_guardian_student_access as access
      on access.membership_id = membership.id
     and access.household_id = n.household_id and access.student_id = n.student_id
    join academy_private.study_adult_notification_permissions as permission
      on permission.id = n.permission_id
     and permission.household_id = n.household_id
     and permission.student_id = n.student_id
     and permission.membership_id = membership.id
     and permission.recipient_ref = n.recipient_ref
     and permission.revision = n.permission_revision
    join academy_private.study_adult_notification_routes as route
      on route.route_ref = n.route_ref
     and route.permission_id = permission.id
     and route.household_id = n.household_id
     and route.student_id = n.student_id
     and route.recipient_ref = n.recipient_ref
     and route.channel = 'in-app'
    where membership.user_id = auth.uid()
      and membership.member_role = 'guardian'
      and membership.status = 'active' and membership.revoked_at is null
      and access.status = 'active' and access.revoked_at is null
      and permission.status = 'active' and permission.revoked_at is null
      and permission.effective_at <= clock_timestamp()
      and (permission.expires_at is null or permission.expires_at > clock_timestamp())
      and 'in-app' = any(permission.allowed_channels)
      and route.status = 'active' and route.revoked_at is null
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
volatile
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
       academy_private.study_adult_notification_permissions as permission,
       academy_private.study_adult_notification_routes as route
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
    and permission.household_id = notification.household_id
    and permission.student_id = notification.student_id
    and permission.membership_id = notification.membership_id
    and permission.recipient_ref = notification.recipient_ref
    and permission.revision = notification.permission_revision
    and permission.status = 'active' and permission.revoked_at is null
    and permission.effective_at <= clock_timestamp()
    and (permission.expires_at is null or permission.expires_at > clock_timestamp())
    and 'in-app' = any(permission.allowed_channels)
    and route.route_ref = notification.route_ref
    and route.permission_id = permission.id
    and route.household_id = notification.household_id
    and route.student_id = notification.student_id
    and route.recipient_ref = notification.recipient_ref
    and route.channel = 'in-app'
    and route.status = 'active' and route.revoked_at is null
    and notification.revoked_at is null
    and notification.retain_until > clock_timestamp();
  if not found then
    raise exception 'STUDY_NOTIFICATION_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return jsonb_build_object('read', true);
end;
$$;

create function public.academy_study_execute_verified_runtime_v1(
  p_token_digest text,
  p_required_capability text,
  p_operation text,
  p_request jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  grant_row academy_private.student_session_grants%rowtype;
  old_claims text := current_setting('request.jwt.claims', true);
  body jsonb;
  session_payload jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_operation not in (
       'dashboard:read', 'calendar:read', 'session:begin',
       'session:transition', 'checkpoint:read', 'checkpoint:compare-and-swap'
     )
     or p_required_capability <> (case
       when p_operation in ('dashboard:read', 'checkpoint:read') then 'student:progress:read'
       when p_operation = 'calendar:read' then 'student:assignments:read'
       else 'student:attempts:create'
     end) then
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied', 'operation', p_operation);
  end if;
  select session_grant.* into grant_row
  from academy_private.student_session_grants as session_grant
  join public.academy_students as student
    on student.id = session_grant.student_id
   and student.household_id = session_grant.household_id
  join public.academy_households as household
    on household.id = session_grant.household_id
  join academy_private.student_access_credentials as credential
    on credential.id = session_grant.credential_id
   and credential.student_id = session_grant.student_id
   and credential.credential_version = session_grant.credential_version
  join public.academy_household_memberships as membership
    on membership.id = session_grant.issuing_membership_id
   and membership.household_id = session_grant.household_id
  join public.academy_guardian_student_access as access
    on access.id = session_grant.issuing_access_id
   and access.household_id = session_grant.household_id
   and access.student_id = session_grant.student_id
   and access.membership_id = session_grant.issuing_membership_id
  where session_grant.token_digest = p_token_digest
    and session_grant.grant_purpose = 'study'
    and session_grant.contract_version = 1
    and session_grant.capabilities @> array[p_required_capability]::text[]
    and session_grant.issuance_flow = 'guardian_activation'
    and session_grant.issued_at <= clock_timestamp()
    and session_grant.revoked_at is null
    and session_grant.expires_at > clock_timestamp()
    and household.status = 'active'
    and student.lifecycle_status = 'active'
    and session_grant.session_version = student.session_version
    and credential.status = 'active'
    and membership.status = 'active'
    and membership.revoked_at is null
    and membership.user_id = session_grant.issued_by
    and access.status = 'active'
    and access.revoked_at is null
    and access.permission_level = 'identity_manager'
  for share of session_grant, student, household, credential, membership, access;
  if grant_row.id is null then
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied', 'operation', p_operation);
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', grant_row.id,
    'role', 'authenticated',
    'academy_principal_kind', 'student_session_grant'
  )::text, true);
  begin
    case p_operation
      when 'dashboard:read' then
        if p_request <> '{}'::jsonb then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := (select jsonb_build_object(
          'sessions', coalesce(jsonb_agg(jsonb_build_object(
            'sessionId', session.id,
            'state', session.state,
            'lessonId', session.lesson_id,
            'revision', session.revision,
            'updatedAt', session.updated_at
          ) order by session.updated_at desc), '[]'::jsonb))
        from (
          select * from public.academy_study_sessions
          where household_id = grant_row.household_id and student_id = grant_row.student_id
          order by updated_at desc limit 50
        ) as session);
      when 'calendar:read' then
        if not public.academy_study_json_has_exact_keys(p_request, array['cursor']::text[])
           or (p_request ->> 'cursor' is not null
             and not public.academy_study_identifier_is_valid(p_request ->> 'cursor')) then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        body := (select jsonb_build_object(
          'blocks', coalesce(jsonb_agg(jsonb_build_object(
            'blockId', block.id,
            'blockType', block.block_type,
            'sourceReference', block.source_reference,
            'scheduledStart', block.scheduled_start,
            'intendedLocalDate', block.intended_local_date,
            'state', block.state,
            'revision', block.revision
          ) order by block.scheduled_start), '[]'::jsonb))
        from (
          select * from public.academy_study_calendar_blocks
          where household_id = grant_row.household_id and student_id = grant_row.student_id
            and (p_request ->> 'cursor' is null or id > p_request ->> 'cursor')
          order by scheduled_start limit 100
        ) as block);
      when 'session:begin' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['session','idempotencyKey']::text[]
        ) or jsonb_typeof(p_request -> 'session') <> 'object' then
          raise exception 'STUDY_RUNTIME_REQUEST_INVALID';
        end if;
        session_payload := (p_request -> 'session') ||
          jsonb_build_object('student_id', grant_row.student_id);
        body := public.academy_study_create_session(
          session_payload, p_request ->> 'idempotencyKey'
        );
      when 'session:transition' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId','expectedRevision','state','completedAt','idempotencyKey'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_transition_session(
          p_request ->> 'sessionId',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'state',
          (p_request ->> 'completedAt')::timestamptz,
          p_request ->> 'idempotencyKey'
        );
      when 'checkpoint:read' then
        if not public.academy_study_json_has_exact_keys(
          p_request, array['sessionId']::text[]
        ) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_read_checkpoint(p_request ->> 'sessionId');
      when 'checkpoint:compare-and-swap' then
        if not public.academy_study_json_has_exact_keys(p_request, array[
          'sessionId','expectedRevision','mutationId','checkpoint'
        ]::text[]) then raise exception 'STUDY_RUNTIME_REQUEST_INVALID'; end if;
        body := public.academy_study_compare_and_swap_checkpoint(
          p_request ->> 'sessionId',
          (p_request ->> 'expectedRevision')::bigint,
          p_request ->> 'mutationId',
          p_request -> 'checkpoint'
        );
    end case;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ok',
    'operation', p_operation,
    'body', coalesce(body, 'null'::jsonb)
  );
end;
$$;

-- Enforce the Director-owned policy in the durable delivery transaction, not
-- only in readiness or process configuration.
alter function public.academy_study_deliver_in_app_notification_v2(text, jsonb)
  set schema academy_private;
alter function academy_private.academy_study_deliver_in_app_notification_v2(text, jsonb)
  rename to study_deliver_in_app_notification_internal_v2;
revoke all on function academy_private.study_deliver_in_app_notification_internal_v2(text, jsonb)
  from public, anon, authenticated, service_role;

create function public.academy_study_deliver_in_app_notification_v2(
  p_worker_id text,
  p_delivery jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare policy text;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select adult_review_in_app_delivery_policy into policy
  from academy_private.study_production_policy where singleton;
  if coalesce(policy, 'not-approved') <> 'approved' then
    raise exception 'STUDY_ADULT_REVIEW_POLICY_NOT_APPROVED' using errcode = '42501';
  end if;
  return academy_private.study_deliver_in_app_notification_internal_v2(
    p_worker_id,
    p_delivery
  );
end;
$$;

-- Wrap Session 17 readiness with the explicit Director-owned policy record.
alter function public.academy_study_adult_review_readiness_v2()
  set schema academy_private;
alter function academy_private.academy_study_adult_review_readiness_v2()
  rename to study_adult_review_readiness_internal_v2;
revoke all on function academy_private.study_adult_review_readiness_internal_v2()
  from public, anon, authenticated, service_role;

create function public.academy_study_adult_review_readiness_v2()
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare base jsonb; policy text;
begin
  base := academy_private.study_adult_review_readiness_internal_v2();
  select adult_review_in_app_delivery_policy into policy
  from academy_private.study_production_policy where singleton;
  return base || jsonb_build_object(
    'state', case when base ->> 'state' = 'ready' and policy = 'approved'
      then 'ready' else 'not-ready' end,
    'adultReviewInAppDeliveryPolicy', coalesce(policy, 'not-approved')
  );
end;
$$;

create function public.academy_study_final_production_readiness_v1()
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare identity jsonb; adult_review jsonb;
begin
  if auth.uid() is not null or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  identity := public.academy_study_verified_identity_readiness_v1();
  adult_review := public.academy_study_adult_review_readiness_v2();
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when identity ->> 'status' = 'ready'
      and adult_review ->> 'state' = 'ready' then 'ready' else 'not-ready' end,
    'staffAuthorization', 'disabled'
  );
end;
$$;

alter function public.academy_study_issue_guardian_launch_v1(text, text) owner to postgres;
alter function public.academy_study_verified_identity_readiness_v1() owner to postgres;
alter function public.academy_study_list_parent_notifications_v1(integer) owner to postgres;
alter function public.academy_study_mark_parent_notification_read_v1(text) owner to postgres;
alter function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb) owner to postgres;
alter function public.academy_study_deliver_in_app_notification_v2(text, jsonb) owner to postgres;
alter function public.academy_study_adult_review_readiness_v2() owner to postgres;
alter function public.academy_study_final_production_readiness_v1() owner to postgres;

revoke all on function public.academy_study_issue_guardian_launch_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_deliver_in_app_notification_v2(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_adult_review_readiness_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_final_production_readiness_v1()
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_issue_guardian_launch_v1(text, text)
  to authenticated;
grant execute on function public.academy_study_execute_verified_runtime_v1(text, text, text, jsonb)
  to service_role;
grant execute on function public.academy_study_deliver_in_app_notification_v2(text, jsonb)
  to service_role;
grant execute on function public.academy_study_adult_review_readiness_v2()
  to service_role;
grant execute on function public.academy_study_final_production_readiness_v1()
  to service_role;

alter table academy_private.study_persistence_metadata
  add column final_production_version smallint not null default 0
    check (final_production_version in (0, 1));
update academy_private.study_persistence_metadata
set final_production_version = 1,
    migration_names = array_append(
      migration_names,
      '20260801190000_academy_study_final_production_reconciliation'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'final_production_version', 1,
      'guardian_launch_projection', 'opaque-only',
      'verified_runtime_transactional_gateway', true,
      'adult_review_in_app_delivery_policy', 'not-approved',
      'staff_authorization', 'disabled'
    ),
    updated_at = clock_timestamp()
where singleton;

commit;
