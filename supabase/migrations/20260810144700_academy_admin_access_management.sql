-- ADMIN access management v1: safe principal projection plus owner-only,
-- revision-checked role changes and revocation. Capabilities remain derived
-- from the frozen role contract; callers can never assign them directly.

begin;

create table academy_private.admin_access_mutation_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  immutable_payload_digest text not null check (
    immutable_payload_digest ~ '^[0-9a-f]{32}$'
  ),
  target_assignment_ref uuid not null
    references public.academy_admin_role_assignments (id) on delete restrict,
  expected_revision bigint not null check (expected_revision > 0),
  new_role text check (new_role is null or new_role in ('owner', 'admin', 'viewer')),
  reason_code text not null check (
    reason_code in (
      'operator.request', 'policy.enforcement',
      'corrective.action', 'emergency.response'
    )
  ),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  result_assignment_ref uuid
    references public.academy_admin_role_assignments (id) on delete restrict,
  result_role text check (result_role is null or result_role in ('owner', 'admin', 'viewer')),
  result_status text check (result_status is null or result_status in ('active', 'revoked')),
  result_revision bigint,
  completed_at timestamptz,
  primary key (actor_user_ref, request_id),
  constraint admin_access_mutation_receipts_result_check check (
    (status = 'pending'
      and result_assignment_ref is null
      and result_role is null
      and result_status is null
      and result_revision is null
      and completed_at is null)
    or
    (status = 'completed'
      and result_assignment_ref is not null
      and result_role is not null
      and result_status is not null
      and result_revision is not null
      and completed_at is not null)
  )
);

alter table academy_private.admin_access_mutation_receipts owner to postgres;
alter table academy_private.admin_access_mutation_receipts enable row level security;
alter table academy_private.admin_access_mutation_receipts force row level security;

-- All current Admin roles inherit overview:read in ADMIN-0 v2. This narrow
-- projection therefore exposes the safe access view to every authorized Admin
-- without broadening the frozen capability vocabulary.
create function public.academy_admin_read_access_v1(
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  actor_role text;
  actor_matches integer;
  principal_count integer;
  projection jsonb;
begin
  if actor_user is null or p_required_capability <> 'overview:read' then
    raise exception 'ADMIN_ACCESS_READ_REQUIRED' using errcode = '42501';
  end if;

  select count(*), min(current_assignment.role)
    into actor_matches, actor_role
  from (
    select assignment.role
    from public.academy_admin_role_assignments as assignment
    where assignment.user_id = actor_user
      and assignment.status = 'active'
      and assignment.revoked_at is null
      and (assignment.expires_at is null
        or assignment.expires_at > statement_timestamp())
    order by assignment.assigned_at desc, assignment.id desc
    limit 2
  ) as current_assignment;

  if actor_matches <> 1 or actor_role not in ('owner', 'admin', 'viewer') then
    raise exception 'ADMIN_ACCESS_READ_REQUIRED' using errcode = '42501';
  end if;

  select count(*) into principal_count
  from public.academy_admin_role_assignments as assignment
  where assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null
      or assignment.expires_at > statement_timestamp());
  if principal_count > 250 then
    raise exception 'ADMIN_ACCESS_READ_UNAVAILABLE' using errcode = '54000';
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'principals', coalesce(jsonb_agg(jsonb_build_object(
      'principalRef', assignment.user_id,
      'assignmentRef', assignment.id,
      'role', assignment.role,
      'status', 'active',
      'revision', assignment.revision::text,
      'isCurrent', assignment.user_id = actor_user
    ) order by
      case assignment.role when 'owner' then 1 when 'admin' then 2 else 3 end,
      assignment.assigned_at,
      assignment.id
    ), '[]'::jsonb)
  ) into projection
  from public.academy_admin_role_assignments as assignment
  where assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null
      or assignment.expires_at > statement_timestamp());

  return projection;
end;
$$;

alter function public.academy_admin_read_access_v1(text) owner to postgres;
revoke all on function public.academy_admin_read_access_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_access_v1(text)
  to authenticated;

create function public.academy_admin_mutate_access_v1(
  p_target_assignment_ref uuid,
  p_expected_revision bigint,
  p_new_role text,
  p_reason_code text,
  p_request_id uuid,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  actor_assignment uuid;
  actor_role text;
  receipt academy_private.admin_access_mutation_receipts%rowtype;
  target public.academy_admin_role_assignments%rowtype;
  new_assignment uuid := gen_random_uuid();
  payload_digest text;
  owner_count integer;
  effective_result_assignment uuid;
  effective_result_role text;
  effective_result_status text;
  effective_result_revision bigint;
begin
  if actor_user is null or p_required_capability <> 'admin_roles:manage' then
    raise exception 'ADMIN_ACCESS_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  select assignment.id, assignment.role
    into actor_assignment, actor_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null
      or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;

  if actor_assignment is null or actor_role <> 'owner' then
    raise exception 'ADMIN_ACCESS_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if p_target_assignment_ref is null
     or p_expected_revision is null
     or p_expected_revision < 1
     or p_request_id is null
     or (p_new_role is not null and p_new_role not in ('owner', 'admin', 'viewer'))
     or p_reason_code is null
     or p_reason_code not in (
       'operator.request', 'policy.enforcement',
       'corrective.action', 'emergency.response'
     ) then
    raise exception 'ADMIN_ACCESS_REQUEST_INVALID' using errcode = '22023';
  end if;

  payload_digest := md5(concat_ws('|',
    p_target_assignment_ref::text,
    p_expected_revision::text,
    coalesce(p_new_role, 'revoke'),
    p_reason_code
  ));

  insert into academy_private.admin_access_mutation_receipts (
    actor_user_ref, request_id, immutable_payload_digest,
    target_assignment_ref, expected_revision, new_role, reason_code
  ) values (
    actor_user, p_request_id, payload_digest,
    p_target_assignment_ref, p_expected_revision, p_new_role, p_reason_code
  ) on conflict (actor_user_ref, request_id) do nothing;

  if not found then
    select * into receipt
    from academy_private.admin_access_mutation_receipts
    where actor_user_ref = actor_user and request_id = p_request_id;
    if receipt.immutable_payload_digest <> payload_digest then
      raise exception 'ADMIN_ACCESS_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if receipt.status <> 'completed' then
      raise exception 'ADMIN_ACCESS_REQUEST_IN_PROGRESS' using errcode = '40001';
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'assignmentRef', receipt.result_assignment_ref,
      'role', receipt.result_role,
      'status', receipt.result_status,
      'revision', receipt.result_revision::text,
      'idempotencyResult', 'replayed'
    );
  end if;

  -- Serialize active-assignment mutations in a stable order. This makes the
  -- owner count and the target revision one protected decision and prevents
  -- two concurrent owner demotions from each observing a stale owner set.
  perform assignment.id
  from public.academy_admin_role_assignments as assignment
  where assignment.status = 'active' and assignment.revoked_at is null
  order by assignment.id
  for update;

  -- Reauthorize after acquiring the mutation locks.
  select assignment.id, assignment.role
    into actor_assignment, actor_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null
      or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
  if actor_assignment is null or actor_role <> 'owner' then
    raise exception 'ADMIN_ACCESS_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  select * into target
  from public.academy_admin_role_assignments as assignment
  where assignment.id = p_target_assignment_ref;
  if not found
     or target.status <> 'active'
     or target.revoked_at is not null
     or (target.expires_at is not null
       and target.expires_at <= statement_timestamp())
     or target.revision <> p_expected_revision then
    raise exception 'ADMIN_ACCESS_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if p_new_role is not null and p_new_role = target.role then
    raise exception 'ADMIN_ACCESS_NO_CHANGE' using errcode = '22023';
  end if;

  if target.role = 'owner' and p_new_role is distinct from 'owner' then
    select count(*) into owner_count
    from public.academy_admin_role_assignments as assignment
    where assignment.role = 'owner'
      and assignment.status = 'active'
      and assignment.revoked_at is null
      and (assignment.expires_at is null
        or assignment.expires_at > statement_timestamp());
    if owner_count <= 1 then
      raise exception 'ADMIN_ACCESS_SOLE_OWNER_PROTECTED' using errcode = '40001';
    end if;
  end if;

  -- Append before changing the actor assignment so a permitted self-demotion
  -- with another valid owner still records the original owner authority.
  perform academy_private.append_admin_audit_event_v1(
    'admin_role.revoke',
    'admin_role_assignment',
    target.id::text,
    null,
    '2',
    jsonb_build_object('role', target.role, 'status', 'active'),
    jsonb_build_object('role', target.role, 'status', 'revoked'),
    p_reason_code,
    p_request_id
  );

  if p_new_role is not null then
    perform academy_private.append_admin_audit_event_v1(
      'admin_role.assign',
      'admin_role_assignment',
      new_assignment::text,
      null,
      '1',
      jsonb_build_object('role', target.role, 'status', 'revoked'),
      jsonb_build_object('role', p_new_role, 'status', 'active'),
      p_reason_code,
      p_request_id
    );
  end if;

  update public.academy_admin_role_assignments
  set status = 'revoked',
      revision = revision + 1,
      revoked_at = statement_timestamp(),
      revoked_by = actor_user,
      revoked_by_role = 'owner',
      revocation_reason_code = p_reason_code,
      revocation_correlation_id = p_request_id
  where id = target.id;

  if p_new_role is not null then
    insert into public.academy_admin_role_assignments (
      id, user_id, role, assigned_by, assigned_by_role,
      assignment_reason_code, assignment_correlation_id
    ) values (
      new_assignment, target.user_id, p_new_role, actor_user, 'owner',
      p_reason_code, p_request_id
    );
    effective_result_assignment := new_assignment;
    effective_result_role := p_new_role;
    effective_result_status := 'active';
    effective_result_revision := 1;
  else
    effective_result_assignment := target.id;
    effective_result_role := target.role;
    effective_result_status := 'revoked';
    effective_result_revision := target.revision + 1;
  end if;

  update academy_private.admin_access_mutation_receipts
  set status = 'completed',
      result_assignment_ref = effective_result_assignment,
      result_role = effective_result_role,
      result_status = effective_result_status,
      result_revision = effective_result_revision,
      completed_at = statement_timestamp()
  where actor_user_ref = actor_user and request_id = p_request_id;

  return jsonb_build_object(
    'schemaVersion', 2,
    'assignmentRef', effective_result_assignment,
    'role', effective_result_role,
    'status', effective_result_status,
    'revision', effective_result_revision::text,
    'idempotencyResult', 'applied'
  );
end;
$$;

alter function public.academy_admin_mutate_access_v1(
  uuid, bigint, text, text, uuid, text
) owner to postgres;
revoke all on function public.academy_admin_mutate_access_v1(
  uuid, bigint, text, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_mutate_access_v1(
  uuid, bigint, text, text, uuid, text
) to authenticated;

revoke all on table academy_private.admin_access_mutation_receipts
  from public, anon, authenticated, service_role;

comment on table academy_private.admin_access_mutation_receipts is
  'Private idempotency receipts for owner-authorized Admin access mutations.';
comment on function public.academy_admin_read_access_v1(text) is
  'Authenticated, database-reauthorized projection of active Admin principals and canonical roles.';
comment on function public.academy_admin_mutate_access_v1(
  uuid, bigint, text, text, uuid, text
) is
  'Owner-only, revision-checked, sole-owner-safe, transactionally audited Admin role change or revocation.';

commit;
