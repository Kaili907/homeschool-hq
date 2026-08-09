-- ADMIN curriculum audit contract: granular draft entity and collaborator vocabulary.
-- This extends ADMIN-15 additively. It does not create curriculum draft storage or
-- grant the append helper to an application role.

begin;

alter table academy_private.admin_audit_events
  drop constraint admin_audit_events_action_check,
  drop constraint admin_audit_events_resource_type_check;

alter table academy_private.admin_audit_events
  add constraint admin_audit_events_action_check check (action in (
    'admin_role.assign', 'admin_role.revoke', 'configuration.update',
    'engine.control', 'safety.triage', 'incident.acknowledge',
    'curriculum_draft.create', 'curriculum_draft.update',
    'curriculum_entity.create', 'curriculum_entity.update',
    'curriculum_entity.tombstone',
    'curriculum_draft.collaborator.add',
    'curriculum_draft.collaborator.revoke',
    'curriculum.approve', 'curriculum.publish',
    'release.activate', 'release.rollback'
  )),
  add constraint admin_audit_events_resource_type_check check (resource_type in (
    'admin_role_assignment', 'configuration', 'engine', 'safety_case',
    'incident', 'curriculum_draft', 'curriculum_entity',
    'curriculum_release', 'application_release'
  ));

create or replace function academy_private.admin_audit_action_resource_is_allowed(
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
    ('curriculum_entity.create', 'curriculum_entity'),
    ('curriculum_entity.update', 'curriculum_entity'),
    ('curriculum_entity.tombstone', 'curriculum_entity'),
    ('curriculum_draft.collaborator.add', 'curriculum_draft'),
    ('curriculum_draft.collaborator.revoke', 'curriculum_draft'),
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

-- The one-argument ADMIN-15 validator remains unchanged for its historical
-- vocabulary. This overload applies narrower, action-aware rules to the new
-- curriculum actions and delegates every existing action to ADMIN-15.
create function academy_private.admin_audit_value_is_safe(
  candidate_action text,
  candidate jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  entry record;
  element_text text;
  key_count integer;
  allowed_keys text[];
  numeric_value numeric;
begin
  if candidate_action not in (
    'curriculum_entity.create',
    'curriculum_entity.update',
    'curriculum_entity.tombstone',
    'curriculum_draft.collaborator.add',
    'curriculum_draft.collaborator.revoke'
  ) then
    return academy_private.admin_audit_value_is_safe(candidate);
  end if;

  if candidate is null then
    return true;
  end if;
  if jsonb_typeof(candidate) <> 'object' or pg_column_size(candidate) > 2048 then
    return false;
  end if;

  if candidate_action in (
    'curriculum_entity.create',
    'curriculum_entity.update',
    'curriculum_entity.tombstone'
  ) then
    allowed_keys := array[
      'entity_ref', 'entity_type', 'draft_revision', 'position', 'status',
      'tombstoned', 'digest'
    ];
  else
    allowed_keys := array['collaborator_ref', 'role', 'status'];
  end if;

  select count(*) into key_count from jsonb_object_keys(candidate);
  if key_count < 1 or key_count > cardinality(allowed_keys) then
    return false;
  end if;
  if candidate_action in (
    'curriculum_draft.collaborator.add',
    'curriculum_draft.collaborator.revoke'
  ) and candidate -> 'collaborator_ref' is null then
    return false;
  end if;

  for entry in select key, value from jsonb_each(candidate) loop
    if not (entry.key = any (allowed_keys)) then
      return false;
    end if;

    if entry.key in ('entity_ref', 'entity_type', 'collaborator_ref', 'role', 'status') then
      if jsonb_typeof(entry.value) <> 'string' then
        return false;
      end if;
      element_text := entry.value #>> '{}';
      if length(element_text) > 128
         or element_text !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
         or position('://' in element_text) > 0
         or element_text ~* '^eyj'
         or element_text ~* '(^|[._:/-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:/-]|$)' then
        return false;
      end if;
    elsif entry.key in ('draft_revision', 'position') then
      if jsonb_typeof(entry.value) <> 'number' then
        return false;
      end if;
      numeric_value := (entry.value #>> '{}')::numeric;
      if numeric_value < 0
         or numeric_value > 1000000000000
         or numeric_value <> trunc(numeric_value) then
        return false;
      end if;
    elsif entry.key = 'tombstoned' then
      if jsonb_typeof(entry.value) <> 'boolean' then
        return false;
      end if;
    elsif entry.key = 'digest' then
      if jsonb_typeof(entry.value) <> 'string'
         or (entry.value #>> '{}') !~ '^[0-9a-f]{64}$' then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

alter function academy_private.admin_audit_value_is_safe(text, jsonb)
  owner to postgres;
revoke all on function academy_private.admin_audit_value_is_safe(text, jsonb)
  from public, anon, authenticated, service_role;

alter table academy_private.admin_audit_events
  drop constraint admin_audit_events_previous_value_safe_check,
  drop constraint admin_audit_events_new_value_safe_check;

alter table academy_private.admin_audit_events
  add constraint admin_audit_events_previous_value_safe_check check (
    academy_private.admin_audit_value_is_safe(action, previous_value)
  ),
  add constraint admin_audit_events_new_value_safe_check check (
    academy_private.admin_audit_value_is_safe(action, new_value)
  );

create or replace function academy_private.append_admin_audit_event_v1(
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
  if not academy_private.admin_audit_value_is_safe(p_action, p_previous_value)
     or not academy_private.admin_audit_value_is_safe(p_action, p_new_value) then
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

create or replace function public.academy_admin_read_audit_events_v1(
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
       'curriculum_entity.create', 'curriculum_entity.update',
       'curriculum_entity.tombstone',
       'curriculum_draft.collaborator.add',
       'curriculum_draft.collaborator.revoke',
       'curriculum.approve', 'curriculum.publish',
       'release.activate', 'release.rollback'
     ))
     or (p_resource_type is not null and p_resource_type not in (
       'admin_role_assignment', 'configuration', 'engine', 'safety_case',
       'incident', 'curriculum_draft', 'curriculum_entity',
       'curriculum_release', 'application_release'
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

comment on function academy_private.admin_audit_value_is_safe(text, jsonb) is
  'Action-aware safe-value validator for granular curriculum entity and collaborator audit facts.';
comment on function academy_private.append_admin_audit_event_v1(
  text, text, text, text, text, jsonb, jsonb, text, uuid
) is 'Internal ungranted atomic audit append helper with backward-compatible granular curriculum validation.';

commit;
