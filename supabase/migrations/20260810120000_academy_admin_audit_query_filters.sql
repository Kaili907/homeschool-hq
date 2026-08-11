begin;

create index admin_audit_events_actor_cursor_idx
  on academy_private.admin_audit_events (
    actor_role, occurred_at desc, event_id desc
  );
create index admin_audit_events_correlation_cursor_idx
  on academy_private.admin_audit_events (
    correlation_id, occurred_at desc, event_id desc
  );
create index admin_audit_events_reason_cursor_idx
  on academy_private.admin_audit_events (
    reason_code, occurred_at desc, event_id desc
  );

revoke all on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
) from public, anon, authenticated, service_role;

drop function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text
);

create function public.academy_admin_read_audit_events_v1(
  p_limit integer default 50,
  p_before_at timestamptz default null,
  p_before_event_id uuid default null,
  p_action text default null,
  p_resource_type text default null,
  p_resource_ref text default null,
  p_required_capability text default null,
  p_actor_role text default null,
  p_occurred_from timestamptz default null,
  p_occurred_to timestamptz default null,
  p_correlation_id uuid default null,
  p_reason_code text default null
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
     or (p_occurred_from is not null and p_occurred_to is not null
       and p_occurred_from > p_occurred_to)
     or (p_action is not null and p_action not in (
       'admin_role.assign', 'admin_role.revoke', 'configuration.update',
       'engine.control', 'safety.triage', 'incident.acknowledge',
       'curriculum_draft.create', 'curriculum_draft.update',
       'curriculum_entity.create', 'curriculum_entity.update',
       'curriculum_entity.tombstone',
       'curriculum_draft.collaborator.add',
       'curriculum_draft.collaborator.revoke',
       'curriculum_standard_review.update',
       'curriculum_approval.approve',
       'curriculum_approval.changes_requested',
       'curriculum_release.stage',
       'curriculum.approve', 'curriculum.publish',
       'release.activate', 'release.rollback'
     ))
     or (p_resource_type is not null and p_resource_type not in (
       'admin_role_assignment', 'configuration', 'engine', 'safety_case',
       'incident', 'curriculum_draft', 'curriculum_entity',
       'curriculum_standard_review', 'curriculum_approval', 'curriculum_release',
       'application_release'
     ))
     or (p_actor_role is not null and p_actor_role not in (
       'owner', 'admin', 'viewer'
     ))
     or (p_resource_ref is not null and (
       length(p_resource_ref) not between 1 and 160
       or p_resource_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
     ))
     or (p_reason_code is not null and (
       length(p_reason_code) not between 1 and 128
       or p_reason_code !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
     )) then
    raise exception 'ADMIN_AUDIT_QUERY_INVALID' using errcode = '22023';
  end if;

  with bounded as (
    select event.*
    from academy_private.admin_audit_events as event
    where (p_before_at is null or (event.occurred_at, event.event_id) <
      (p_before_at, p_before_event_id))
      and (p_occurred_from is null or event.occurred_at >= p_occurred_from)
      and (p_occurred_to is null or event.occurred_at <= p_occurred_to)
      and (p_action is null or event.action = p_action)
      and (p_resource_type is null or event.resource_type = p_resource_type)
      and (p_resource_ref is null or event.resource_ref = p_resource_ref)
      and (p_actor_role is null or event.actor_role = p_actor_role)
      and (p_correlation_id is null or event.correlation_id = p_correlation_id)
      and (p_reason_code is null or event.reason_code = p_reason_code)
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
  integer, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, uuid, text
) owner to postgres;
revoke all on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, uuid, text
) to service_role;

comment on function public.academy_admin_read_audit_events_v1(
  integer, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, uuid, text
) is 'Bounded service-only audit:read projection with safe exact and time-range filters; omits actor identity and assignment internals.';

commit;
