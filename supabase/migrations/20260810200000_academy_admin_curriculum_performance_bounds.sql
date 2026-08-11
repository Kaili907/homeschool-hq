begin;

-- Authoritative Admin reads must fail closed when a workspace or registry has
-- outgrown the bounded materialization contract.  The limit + 1 probes below
-- distinguish a complete bounded result from silent truncation.
create or replace function public.academy_admin_list_curriculum_drafts_v1(
  p_actor_user_ref uuid,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  candidate_count integer;
  projection jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, false
  );

  select count(*) into candidate_count
  from (
    select workspace.draft_id
    from public.academy_curriculum_drafts as workspace
    where exists (
      select 1
      from public.academy_curriculum_draft_collaborators as collaborator
      where collaborator.draft_id = workspace.draft_id
        and collaborator.principal_user_ref = p_actor_user_ref
        and collaborator.status = 'active'
        and collaborator.revoked_at is null
    )
    order by workspace.updated_at desc, workspace.draft_id
    limit 1001
  ) as candidate;
  if candidate_count > 1000 then
    raise exception 'CURRICULUM_DRAFT_LIST_LIMIT' using errcode = '54000';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'drafts', coalesce(jsonb_agg(
      academy_private.curriculum_draft_projection(draft.draft_id)
      order by draft.updated_at desc, draft.draft_id
    ), '[]'::jsonb)
  ) into projection
  from (
    select workspace.draft_id, workspace.updated_at
    from public.academy_curriculum_drafts as workspace
    where exists (
      select 1
      from public.academy_curriculum_draft_collaborators as collaborator
      where collaborator.draft_id = workspace.draft_id
        and collaborator.principal_user_ref = p_actor_user_ref
        and collaborator.status = 'active'
        and collaborator.revoked_at is null
    )
    order by workspace.updated_at desc, workspace.draft_id
    limit 1000
  ) as draft;
  return projection;
end;
$$;

create or replace function public.academy_admin_read_curriculum_draft_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
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
  entities jsonb;
  entity_count integer;
  payload_bytes bigint;
begin
  if p_required_capability <> 'curriculum:read' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  projection := academy_private.curriculum_draft_projection(p_draft_id);

  select count(*), coalesce(sum(pg_column_size(candidate.payload)), 0)
    into entity_count, payload_bytes
  from (
    select entity.payload
    from public.academy_curriculum_draft_entities as entity
    where entity.draft_id = p_draft_id
    order by entity.entity_type, entity.position, entity.entity_ref
    limit 501
  ) as candidate;
  if entity_count > 500 or payload_bytes > 4000000 then
    raise exception 'CURRICULUM_DRAFT_MATERIALIZATION_LIMIT' using errcode = '54000';
  end if;

  select coalesce(jsonb_agg(
    academy_private.curriculum_entity_projection(entity.entity_id)
    order by entity.entity_type, entity.position, entity.entity_ref
  ), '[]'::jsonb) into entities
  from public.academy_curriculum_draft_entities as entity
  where entity.draft_id = p_draft_id;
  return projection || jsonb_build_object('entities', entities);
end;
$$;

-- Materialize an internally consistent draft with one bounded RPC rather than
-- issuing one service round trip for every entity in the workspace.
create or replace function public.academy_admin_read_curriculum_draft_entities_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_expected_revision bigint,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  draft_revision bigint;
  entities jsonb;
  entity_count integer;
  payload_bytes bigint;
begin
  if p_required_capability <> 'curriculum:read' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  select draft.revision into draft_revision
  from public.academy_curriculum_drafts as draft
  where draft.draft_id = p_draft_id;
  if p_expected_revision is null or draft_revision is distinct from p_expected_revision then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;

  select count(*), coalesce(sum(pg_column_size(candidate.payload)), 0)
    into entity_count, payload_bytes
  from (
    select entity.payload
    from public.academy_curriculum_draft_entities as entity
    where entity.draft_id = p_draft_id
      and (not entity.tombstoned or entity.entity_type = 'media_resource')
    order by entity.entity_type, entity.position, entity.entity_ref
    limit 501
  ) as candidate;
  if entity_count > 500 or payload_bytes > 4000000 then
    raise exception 'CURRICULUM_DRAFT_MATERIALIZATION_LIMIT' using errcode = '54000';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('schemaVersion', 1, 'draftId', p_draft_id)
      || academy_private.curriculum_entity_projection(entity.entity_id)
      || jsonb_build_object('payload', entity.payload)
    order by entity.entity_type, entity.position, entity.entity_ref
  ), '[]'::jsonb) into entities
  from public.academy_curriculum_draft_entities as entity
  where entity.draft_id = p_draft_id
    and (not entity.tombstoned or entity.entity_type = 'media_resource');

  return jsonb_build_object(
    'schemaVersion', 1,
    'draftId', p_draft_id,
    'draftRevision', draft_revision,
    'entities', entities
  );
end;
$$;

create or replace function public.academy_admin_list_curriculum_releases_v1(
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  candidate_count integer;
  projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;

  select count(*) into candidate_count
  from (
    select release.release_id
    from public.academy_curriculum_releases as release
    order by release.registered_at desc, release.version desc
    limit 1001
  ) as candidate;
  if candidate_count > 1000 then
    raise exception 'CURRICULUM_RELEASE_LIST_LIMIT' using errcode = '54000';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'releases', coalesce(jsonb_agg(jsonb_build_object(
      'packageId', release.package_id,
      'version', release.version,
      'status', release.status,
      'registeredAt', to_char(release.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'authoredOn', to_char(release.authored_on, 'YYYY-MM-DD'),
      'provenanceClass', release.provenance_class,
      'sourceCommit', release.source_commit,
      'sourceRoot', release.source_root,
      'stagingId', release.staging_id,
      'fileCount', release.file_count,
      'byteCount', release.byte_count,
      'counts', jsonb_build_object(
        'courses', release.course_count, 'units', release.unit_count,
        'lessons', release.lesson_count, 'assessments', release.assessment_count,
        'texts', release.text_count, 'schedules', release.schedule_count
      )
    ) order by release.registered_at desc, release.version desc), '[]'::jsonb)
  ) into projection
  from (
    select release.*
    from public.academy_curriculum_releases as release
    order by release.registered_at desc, release.version desc
    limit 1000
  ) as release;
  return projection;
end;
$$;

alter function public.academy_admin_list_curriculum_drafts_v1(uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_entities_v1(uuid, uuid, bigint, text) owner to postgres;
alter function public.academy_admin_list_curriculum_releases_v1(text) owner to postgres;

revoke all on function public.academy_admin_list_curriculum_drafts_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_draft_entities_v1(uuid, uuid, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_list_curriculum_releases_v1(text)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_list_curriculum_drafts_v1(uuid, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_draft_entities_v1(uuid, uuid, bigint, text)
  to service_role;
grant execute on function public.academy_admin_list_curriculum_releases_v1(text)
  to service_role;

comment on function public.academy_admin_read_curriculum_draft_entities_v1(uuid, uuid, bigint, text) is
  'Bounded, revision-pinned draft entity batch for Admin preview, validation, diff, and resource projections.';
comment on function public.academy_admin_list_curriculum_releases_v1(text) is
  'Complete release registry through 1000 releases; fails closed rather than silently truncating overflow.';

commit;
