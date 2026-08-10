-- ADMIN-15: append-only Admin audit foundation.
-- The internal writer is intentionally ungranted. Future privileged mutation
-- RPCs owned by postgres may call it in the same transaction as their mutation.

begin;

create table academy_private.admin_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  schema_version integer not null default 2 check (schema_version = 2),
  occurred_at timestamptz not null default statement_timestamp(),

  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role in ('owner', 'admin', 'viewer')),
  actor_assignment_ref uuid not null
    references public.academy_admin_role_assignments (id) on delete restrict,

  action text not null check (action in (
    'admin_role.assign', 'admin_role.revoke', 'configuration.update',
    'engine.control', 'safety.triage', 'incident.acknowledge',
    'curriculum_draft.create', 'curriculum_draft.update',
    'curriculum.approve', 'curriculum.publish',
    'release.activate', 'release.rollback'
  )),
  resource_type text not null check (resource_type in (
    'admin_role_assignment', 'configuration', 'engine', 'safety_case',
    'incident', 'curriculum_draft', 'curriculum_release',
    'application_release'
  )),
  resource_ref text not null,
  resource_version text,
  resource_revision text,

  previous_value jsonb,
  new_value jsonb,
  reason_code text,
  correlation_id uuid not null,

  constraint admin_audit_events_resource_ref_check check (
    length(resource_ref) between 1 and 160
    and resource_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
  ),
  constraint admin_audit_events_resource_version_check check (
    resource_version is null or (
      length(resource_version) between 1 and 80
      and resource_version ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$'
    )
  ),
  constraint admin_audit_events_resource_revision_check check (
    resource_revision is null or (
      length(resource_revision) between 1 and 80
      and resource_revision ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$'
    )
  ),
  constraint admin_audit_events_has_value_check check (
    previous_value is not null or new_value is not null
  )
);

alter table academy_private.admin_audit_events owner to postgres;

create index admin_audit_events_occurred_event_idx
  on academy_private.admin_audit_events (occurred_at desc, event_id desc);
create index admin_audit_events_action_cursor_idx
  on academy_private.admin_audit_events (action, occurred_at desc, event_id desc);
create index admin_audit_events_resource_cursor_idx
  on academy_private.admin_audit_events (
    resource_type, resource_ref, occurred_at desc, event_id desc
  );

alter table academy_private.admin_audit_events enable row level security;
alter table academy_private.admin_audit_events force row level security;

create function academy_private.admin_audit_reject_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy Admin audit events are append-only' using errcode = '55000';
end;
$$;

alter function academy_private.admin_audit_reject_mutation() owner to postgres;
revoke all on function academy_private.admin_audit_reject_mutation()
  from public, anon, authenticated, service_role;

create trigger admin_audit_events_append_only
  before update or delete on academy_private.admin_audit_events
  for each row execute function academy_private.admin_audit_reject_mutation();

-- ADMIN-0 v2 does not freeze audit reason codes. ADMIN-15 owns this local exact
-- allowlist until a later contract revision promotes a shared vocabulary.
create function academy_private.admin_audit_reason_is_allowed(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate is null or candidate = any (array[
    'operator.request',
    'scheduled.change',
    'policy.enforcement',
    'incident.response',
    'corrective.action',
    'emergency.response',
    'access.granted',
    'access.revoked',
    'configuration.changed',
    'engine.controlled',
    'safety.reviewed',
    'incident.acknowledged',
    'curriculum.authored',
    'curriculum.approved',
    'curriculum.published',
    'release.activated',
    'release.rolled_back'
  ]::text[]);
$$;

alter function academy_private.admin_audit_reason_is_allowed(text) owner to postgres;
revoke all on function academy_private.admin_audit_reason_is_allowed(text)
  from public, anon, authenticated, service_role;

create function academy_private.admin_audit_action_resource_is_allowed(
  candidate_action text,
  candidate_resource_type text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select (candidate_action, candidate_resource_type) in (
    ('admin_role.assign', 'admin_role_assignment'),
    ('admin_role.revoke', 'admin_role_assignment'),
    ('configuration.update', 'configuration'),
    ('engine.control', 'engine'),
    ('safety.triage', 'safety_case'),
    ('incident.acknowledge', 'incident'),
    ('curriculum_draft.create', 'curriculum_draft'),
    ('curriculum_draft.update', 'curriculum_draft'),
    ('curriculum.approve', 'curriculum_release'),
    ('curriculum.publish', 'curriculum_release'),
    ('release.activate', 'application_release'),
    ('release.rollback', 'application_release')
  );
$$;

alter function academy_private.admin_audit_action_resource_is_allowed(text, text)
  owner to postgres;
revoke all on function academy_private.admin_audit_action_resource_is_allowed(text, text)
  from public, anon, authenticated, service_role;

create function academy_private.admin_audit_value_is_safe(candidate jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  entry record;
  element jsonb;
  element_text text;
  key_count integer;
  allowed_keys constant text[] := array[
    'value', 'state', 'enabled', 'limit', 'quota', 'model_tier',
    'model_tiers', 'voice', 'version', 'revision', 'role', 'status',
    'release'
  ];
begin
  if candidate is null then
    return true;
  end if;
  if jsonb_typeof(candidate) <> 'object' or pg_column_size(candidate) > 2048 then
    return false;
  end if;
  select count(*) into key_count from jsonb_object_keys(candidate);
  if key_count < 1 or key_count > 8 then return false; end if;

  for entry in select key, value from jsonb_each(candidate) loop
    if not (entry.key = any (allowed_keys)) then
      return false;
    end if;

    if jsonb_typeof(entry.value) = 'array' then
      if jsonb_array_length(entry.value) > 16 then
        return false;
      end if;
      for element in select value from jsonb_array_elements(entry.value) loop
        if jsonb_typeof(element) not in ('string', 'number', 'boolean', 'null') then
          return false;
        end if;
        if jsonb_typeof(element) = 'string' then
          element_text := element #>> '{}';
          if length(element_text) > 128
             or element_text !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
             or position('://' in element_text) > 0
             or element_text ~* '^eyj'
         or element_text ~* '(^|[._:/-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:/-]|$)' then
            return false;
          end if;
        elsif jsonb_typeof(element) = 'number'
              and abs((element #>> '{}')::numeric) > 1000000000000 then
          return false;
        end if;
      end loop;
    elsif jsonb_typeof(entry.value) = 'string' then
      element_text := entry.value #>> '{}';
      if length(element_text) > 128
         or element_text !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
         or position('://' in element_text) > 0
         or element_text ~* '^eyj'
         or element_text ~* '(^|[._:/-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:/-]|$)' then
        return false;
      end if;
    elsif jsonb_typeof(entry.value) = 'number' then
      if abs((entry.value #>> '{}')::numeric) > 1000000000000 then
        return false;
      end if;
    elsif jsonb_typeof(entry.value) not in ('boolean', 'null') then
      return false;
    end if;

    if entry.key = 'role'
       and (entry.value #>> '{}') not in ('owner', 'admin', 'viewer') then
      return false;
    end if;
  end loop;
  return true;
exception
  when others then
    return false;
end;
$$;

alter function academy_private.admin_audit_value_is_safe(jsonb) owner to postgres;
revoke all on function academy_private.admin_audit_value_is_safe(jsonb)
  from public, anon, authenticated, service_role;
alter table academy_private.admin_audit_events
  add constraint admin_audit_events_action_resource_pair_check check (
    academy_private.admin_audit_action_resource_is_allowed(action, resource_type)
  ),
  add constraint admin_audit_events_reason_allowlist_check check (
    academy_private.admin_audit_reason_is_allowed(reason_code)
  ),
  add constraint admin_audit_events_previous_value_safe_check check (
    academy_private.admin_audit_value_is_safe(previous_value)
  ),
  add constraint admin_audit_events_new_value_safe_check check (
    academy_private.admin_audit_value_is_safe(new_value)
  );

create function academy_private.append_admin_audit_event_v1(
  p_action text,
  p_resource_type text,
  p_resource_ref text,
  p_resource_version text default null,
  p_resource_revision text default null,
  p_previous_value jsonb default null,
  p_new_value jsonb default null,
  p_reason_code text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  actor_assignment uuid;
  actor_admin_role text;
  created_event uuid := gen_random_uuid();
  effective_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if actor_user is null then
    raise exception 'ADMIN_AUDIT_ACTOR_REQUIRED' using errcode = '42501';
  end if;

  select assignment.id, assignment.role
    into actor_assignment, actor_admin_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;

  if actor_assignment is null then
    raise exception 'ADMIN_AUDIT_ACTOR_REQUIRED' using errcode = '42501';
  end if;
  if not academy_private.admin_audit_action_resource_is_allowed(
    p_action, p_resource_type
  ) then
    raise exception 'ADMIN_AUDIT_ACTION_RESOURCE_INVALID' using errcode = '22023';
  end if;
  if p_resource_ref is null
     or length(p_resource_ref) not between 1 and 160
     or p_resource_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
     or (p_resource_version is not null and (
       length(p_resource_version) not between 1 and 80
       or p_resource_version !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$'
     ))
     or (p_resource_revision is not null and (
       length(p_resource_revision) not between 1 and 80
       or p_resource_revision !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$'
     )) then
    raise exception 'ADMIN_AUDIT_RESOURCE_INVALID' using errcode = '22023';
  end if;
  if not academy_private.admin_audit_reason_is_allowed(p_reason_code) then
    raise exception 'ADMIN_AUDIT_REASON_INVALID' using errcode = '22023';
  end if;
  if p_previous_value is null and p_new_value is null then
    raise exception 'ADMIN_AUDIT_VALUE_REQUIRED' using errcode = '22023';
  end if;
  if not academy_private.admin_audit_value_is_safe(p_previous_value)
     or not academy_private.admin_audit_value_is_safe(p_new_value) then
    raise exception 'ADMIN_AUDIT_VALUE_INVALID' using errcode = '22023';
  end if;

  insert into academy_private.admin_audit_events (
    event_id, actor_user_ref, actor_role, actor_assignment_ref,
    action, resource_type, resource_ref, resource_version, resource_revision,
    previous_value, new_value, reason_code, correlation_id
  ) values (
    created_event, actor_user, actor_admin_role, actor_assignment,
    p_action, p_resource_type, p_resource_ref, p_resource_version,
    p_resource_revision, p_previous_value, p_new_value, p_reason_code,
    effective_correlation_id
  );
  return created_event;
end;
$$;

alter function academy_private.append_admin_audit_event_v1(
  text, text, text, text, text, jsonb, jsonb, text, uuid
) owner to postgres;
revoke all on function academy_private.append_admin_audit_event_v1(
  text, text, text, text, text, jsonb, jsonb, text, uuid
) from public, anon, authenticated, service_role;

create function public.academy_admin_read_audit_events_v1(
  p_limit integer default 50,
  p_before_at timestamptz default null,
  p_before_event_id uuid default null,
  p_action text default null,
  p_resource_type text default null,
  p_resource_ref text default null,
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
     or p_required_capability <> 'audit:read' then
    raise exception 'ADMIN_AUDIT_READ_REQUIRED' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or ((p_before_at is null) <> (p_before_event_id is null))
     or (p_action is not null and p_action not in (
       'admin_role.assign', 'admin_role.revoke', 'configuration.update',
       'engine.control', 'safety.triage', 'incident.acknowledge',
       'curriculum_draft.create', 'curriculum_draft.update',
       'curriculum.approve', 'curriculum.publish',
       'release.activate', 'release.rollback'
     ))
     or (p_resource_type is not null and p_resource_type not in (
       'admin_role_assignment', 'configuration', 'engine', 'safety_case',
       'incident', 'curriculum_draft', 'curriculum_release',
       'application_release'
     ))
     or (p_resource_ref is not null and (
       length(p_resource_ref) not between 1 and 160
       or p_resource_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
     )) then
    raise exception 'ADMIN_AUDIT_QUERY_INVALID' using errcode = '22023';
  end if;

  with bounded as (
    select event.*
    from academy_private.admin_audit_events as event
    where (p_before_at is null or (event.occurred_at, event.event_id) <
      (p_before_at, p_before_event_id))
      and (p_action is null or event.action = p_action)
      and (p_resource_type is null or event.resource_type = p_resource_type)
      and (p_resource_ref is null or event.resource_ref = p_resource_ref)
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
        'eventId', event_id,
        'schemaVersion', schema_version,
        'occurredAt', occurred_at,
        'actorRole', actor_role,
        'action', action,
        'resourceType', resource_type,
        'resourceRef', resource_ref,
        'resourceVersion', resource_version,
        'resourceRevision', resource_revision,
        'previousValue', previous_value,
        'newValue', new_value,
        'reasonCode', reason_code,
        'correlationId', correlation_id
      ) order by occurred_at desc, event_id desc)
      from visible
    ), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from bounded)
  ) into projection;
  return projection;
end;
$$;

alter function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
) owner to postgres;
revoke all on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
) to service_role;

revoke all on table academy_private.admin_audit_events
  from public, anon, authenticated, service_role;

comment on table academy_private.admin_audit_events is
  'Immutable Admin audit history; browser and application roles have no direct access.';
comment on function academy_private.append_admin_audit_event_v1(
  text, text, text, text, text, jsonb, jsonb, text, uuid
) is 'Internal ungranted atomic audit append helper deriving the active Admin actor from auth.uid().';
comment on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
) is 'Bounded service-only audit:read projection; omits actor identity and assignment internals.';

commit;
