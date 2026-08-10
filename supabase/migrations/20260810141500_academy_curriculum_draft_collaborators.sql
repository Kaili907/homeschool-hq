-- Draft-scoped Curriculum Studio collaborators. Global Admin roles remain the
-- first authorization gate; these assignments can only narrow draft access.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum collaborator migration must run as postgres';
  end if;
end;
$$;

alter table academy_private.curriculum_authoring_request_receipts
  drop constraint curriculum_authoring_request_receipts_operation_check;
alter table academy_private.curriculum_authoring_request_receipts
  add constraint curriculum_authoring_request_receipts_operation_check check (operation in (
    'draft.create', 'entity.create', 'entity.update', 'entity.tombstone',
    'collaborator.add', 'collaborator.revoke'
  ));

create table public.academy_curriculum_draft_collaborators (
  assignment_id uuid primary key default gen_random_uuid(),
  draft_id uuid not null
    references public.academy_curriculum_drafts (draft_id) on delete restrict,
  principal_user_ref uuid not null
    references auth.users (id) on delete restrict,
  responsibility text not null check (responsibility in ('editor', 'reviewer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  revision bigint not null default 1 check (revision in (1, 2)),
  assigned_at timestamptz not null default statement_timestamp(),
  assigned_by uuid not null references auth.users (id) on delete restrict,
  assignment_request_id uuid not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete restrict,
  revocation_request_id uuid,
  constraint academy_curriculum_draft_collaborators_lifecycle_check check (
    (
      status = 'active'
      and revision = 1
      and revoked_at is null
      and revoked_by is null
      and revocation_request_id is null
    )
    or (
      status = 'revoked'
      and revision = 2
      and revoked_at is not null
      and revoked_at >= assigned_at
      and revoked_by is not null
      and revocation_request_id is not null
    )
  )
);

create unique index academy_curriculum_draft_collaborators_one_active_principal_idx
  on public.academy_curriculum_draft_collaborators (draft_id, principal_user_ref)
  where status = 'active' and revoked_at is null;
create index academy_curriculum_draft_collaborators_active_navigation_idx
  on public.academy_curriculum_draft_collaborators
  (draft_id, responsibility, assigned_at, principal_user_ref)
  where status = 'active' and revoked_at is null;

alter table public.academy_curriculum_draft_collaborators owner to postgres;
alter table public.academy_curriculum_draft_collaborators enable row level security;
alter table public.academy_curriculum_draft_collaborators force row level security;

create function academy_private.curriculum_collaborator_guard_history()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Curriculum collaborator history cannot be deleted' using errcode = '55000';
  end if;
  if old.status <> 'active'
     or new.status <> 'revoked'
     or new.revision <> old.revision + 1
     or new.assignment_id is distinct from old.assignment_id
     or new.draft_id is distinct from old.draft_id
     or new.principal_user_ref is distinct from old.principal_user_ref
     or new.responsibility is distinct from old.responsibility
     or new.assigned_at is distinct from old.assigned_at
     or new.assigned_by is distinct from old.assigned_by
     or new.assignment_request_id is distinct from old.assignment_request_id then
    raise exception 'Curriculum collaborators permit only an audited revocation transition'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger academy_curriculum_draft_collaborators_guard_history
  before update or delete on public.academy_curriculum_draft_collaborators
  for each row execute function academy_private.curriculum_collaborator_guard_history();

-- Existing draft creators are the initial editors of their own workspaces.
insert into public.academy_curriculum_draft_collaborators (
  draft_id, principal_user_ref, responsibility, assigned_by,
  assignment_request_id, assigned_at
)
select draft_id, created_by, 'editor', created_by, create_request_id, created_at
from public.academy_curriculum_drafts;

create function academy_private.curriculum_collaborator_assign_creator()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.academy_curriculum_draft_collaborators (
    draft_id, principal_user_ref, responsibility, assigned_by,
    assignment_request_id, assigned_at
  ) values (
    new.draft_id, new.created_by, 'editor', new.created_by,
    new.create_request_id, new.created_at
  );
  return new;
end;
$$;

create trigger academy_curriculum_drafts_assign_creator
  after insert on public.academy_curriculum_drafts
  for each row execute function academy_private.curriculum_collaborator_assign_creator();

create function academy_private.curriculum_collaboration_require_actor(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_required_responsibility text default null
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_responsibility text;
  write_required boolean := p_required_responsibility = 'editor';
begin
  if p_required_responsibility is not null
     and p_required_responsibility <> 'editor' then
    raise exception 'CURRICULUM_COLLABORATOR_INPUT_INVALID' using errcode = '22023';
  end if;
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref,
    case when write_required then 'curriculum:drafts:write' else 'curriculum:read' end,
    write_required
  );
  if not exists (
    select 1 from public.academy_curriculum_drafts where draft_id = p_draft_id
  ) then
    raise exception 'CURRICULUM_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select collaborator.responsibility into actor_responsibility
  from public.academy_curriculum_draft_collaborators as collaborator
  where collaborator.draft_id = p_draft_id
    and collaborator.principal_user_ref = p_actor_user_ref
    and collaborator.status = 'active'
    and collaborator.revoked_at is null
  order by collaborator.assigned_at desc, collaborator.assignment_id desc
  limit 1;
  if actor_responsibility is null
     or (write_required and actor_responsibility <> 'editor') then
    raise exception 'CURRICULUM_COLLABORATION_REQUIRED' using errcode = '42501';
  end if;
  return actor_responsibility;
end;
$$;

-- Every draft update, including entity saves and collaborator mutations, is
-- reauthorized from current database state. updated_by is set only by narrow
-- trusted-server RPCs and never comes from a browser request body.
create function academy_private.curriculum_draft_require_editor_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform academy_private.curriculum_collaboration_require_actor(
    new.updated_by, new.draft_id, 'editor'
  );
  return new;
end;
$$;

create trigger academy_curriculum_drafts_require_editor_mutation
  before update on public.academy_curriculum_drafts
  for each row execute function academy_private.curriculum_draft_require_editor_mutation();

create function academy_private.curriculum_collaborator_projection(p_assignment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'principalRef', collaborator.principal_user_ref,
    'responsibility', collaborator.responsibility,
    'status', collaborator.status,
    'assignmentRevision', collaborator.revision,
    'assignedAt', collaborator.assigned_at,
    'revokedAt', collaborator.revoked_at
  )
  from public.academy_curriculum_draft_collaborators as collaborator
  where collaborator.assignment_id = p_assignment_id;
$$;

-- Replace the read projections so global curriculum:read remains necessary but
-- only explicitly assigned editors/reviewers can discover or open a draft.
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
  projection jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, false
  );
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
begin
  if p_required_capability <> 'curriculum:read' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  projection := academy_private.curriculum_draft_projection(p_draft_id);
  select coalesce(jsonb_agg(
    academy_private.curriculum_entity_projection(entity.entity_id)
    order by entity.entity_type, entity.position, entity.entity_ref
  ), '[]'::jsonb) into entities
  from public.academy_curriculum_draft_entities as entity
  where entity.draft_id = p_draft_id;
  return projection || jsonb_build_object('entities', entities);
end;
$$;

create or replace function public.academy_admin_read_curriculum_draft_entity_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_entity_type text,
  p_entity_ref text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  entity_row public.academy_curriculum_draft_entities%rowtype;
begin
  if p_required_capability <> 'curriculum:read' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  select * into entity_row
  from public.academy_curriculum_draft_entities
  where draft_id = p_draft_id
    and entity_type = p_entity_type
    and entity_ref = p_entity_ref;
  if entity_row.entity_id is null then return null; end if;
  return jsonb_build_object('schemaVersion', 1, 'draftId', p_draft_id)
    || academy_private.curriculum_entity_projection(entity_row.entity_id)
    || jsonb_build_object('payload', entity_row.payload);
end;
$$;

create function public.academy_admin_list_curriculum_draft_collaborators_v1(
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
  draft_revision bigint;
  collaborators jsonb;
  actor_responsibility text;
begin
  if p_required_capability <> 'curriculum:read' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  actor_responsibility := academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  select revision into draft_revision
  from public.academy_curriculum_drafts
  where draft_id = p_draft_id;
  select coalesce(jsonb_agg(
    academy_private.curriculum_collaborator_projection(collaborator.assignment_id)
    order by collaborator.responsibility, collaborator.assigned_at,
      collaborator.principal_user_ref
  ), '[]'::jsonb) into collaborators
  from public.academy_curriculum_draft_collaborators as collaborator
  where collaborator.draft_id = p_draft_id
    and collaborator.status = 'active'
    and collaborator.revoked_at is null;
  return jsonb_build_object(
    'schemaVersion', 1,
    'draftId', p_draft_id,
    'draftRevision', draft_revision,
    'currentResponsibility', actor_responsibility,
    'collaborators', collaborators
  );
end;
$$;

create function public.academy_admin_add_curriculum_draft_collaborator_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_principal_user_ref uuid,
  p_responsibility text,
  p_expected_draft_revision bigint,
  p_request_id uuid,
  p_request_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  target_role text;
  created_assignment uuid := gen_random_uuid();
  draft_target_version text;
  new_draft_revision bigint;
  replay jsonb;
  response jsonb;
begin
  if p_required_capability <> 'curriculum:drafts:write' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, 'editor'
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'collaborator.add', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_principal_user_ref is null
     or p_responsibility not in ('editor', 'reviewer')
     or p_expected_draft_revision is null
     or p_expected_draft_revision < 1 then
    raise exception 'CURRICULUM_COLLABORATOR_INPUT_INVALID' using errcode = '22023';
  end if;
  select assignment.role into target_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = p_principal_user_ref
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
  if target_role is null
     or (p_responsibility = 'editor' and target_role not in ('admin', 'owner')) then
    raise exception 'CURRICULUM_COLLABORATOR_PRINCIPAL_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.academy_curriculum_draft_collaborators
    where draft_id = p_draft_id
      and principal_user_ref = p_principal_user_ref
      and status = 'active'
      and revoked_at is null
  ) then
    raise exception 'CURRICULUM_COLLABORATOR_EXISTS' using errcode = '23505';
  end if;
  update public.academy_curriculum_drafts as draft
  set revision = revision + 1,
      updated_at = statement_timestamp(),
      updated_by = p_actor_user_ref
  where draft_id = p_draft_id
    and lifecycle_state = 'draft'
    and revision = p_expected_draft_revision
  returning draft.revision, draft.target_version
    into new_draft_revision, draft_target_version;
  if new_draft_revision is null then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  insert into public.academy_curriculum_draft_collaborators (
    assignment_id, draft_id, principal_user_ref, responsibility,
    assigned_by, assignment_request_id
  ) values (
    created_assignment, p_draft_id, p_principal_user_ref, p_responsibility,
    p_actor_user_ref, p_request_id
  );
  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref,
    'curriculum_draft.collaborator.add',
    p_draft_id::text,
    draft_target_version,
    new_draft_revision::text,
    null,
    jsonb_build_object(
      'collaborator_ref', p_principal_user_ref,
      'role', p_responsibility,
      'status', 'active'
    ),
    p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1,
    'replayed', false,
    'draftId', p_draft_id,
    'draftRevision', new_draft_revision,
    'collaborator', academy_private.curriculum_collaborator_projection(created_assignment)
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (
    p_actor_user_ref, p_request_id, 'collaborator.add', p_request_digest, response
  );
  return response;
end;
$$;

create function public.academy_admin_revoke_curriculum_draft_collaborator_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_principal_user_ref uuid,
  p_expected_draft_revision bigint,
  p_request_id uuid,
  p_request_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  collaborator public.academy_curriculum_draft_collaborators%rowtype;
  draft_target_version text;
  new_draft_revision bigint;
  replay jsonb;
  response jsonb;
begin
  if p_required_capability <> 'curriculum:drafts:write' then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, 'editor'
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'collaborator.revoke', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_principal_user_ref is null
     or p_expected_draft_revision is null
     or p_expected_draft_revision < 1 then
    raise exception 'CURRICULUM_COLLABORATOR_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into collaborator
  from public.academy_curriculum_draft_collaborators
  where draft_id = p_draft_id
    and principal_user_ref = p_principal_user_ref
    and status = 'active'
    and revoked_at is null
  for update;
  if collaborator.assignment_id is null then
    raise exception 'CURRICULUM_COLLABORATOR_NOT_FOUND' using errcode = 'P0002';
  end if;
  if collaborator.responsibility = 'editor'
     and not exists (
       select 1
       from public.academy_curriculum_draft_collaborators as other
       where other.draft_id = p_draft_id
         and other.responsibility = 'editor'
         and other.status = 'active'
         and other.revoked_at is null
         and other.assignment_id <> collaborator.assignment_id
     ) then
    raise exception 'CURRICULUM_COLLABORATOR_LAST_EDITOR' using errcode = '22023';
  end if;
  update public.academy_curriculum_drafts as draft
  set revision = revision + 1,
      updated_at = statement_timestamp(),
      updated_by = p_actor_user_ref
  where draft_id = p_draft_id
    and lifecycle_state = 'draft'
    and revision = p_expected_draft_revision
  returning draft.revision, draft.target_version
    into new_draft_revision, draft_target_version;
  if new_draft_revision is null then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  update public.academy_curriculum_draft_collaborators
  set status = 'revoked',
      revision = revision + 1,
      revoked_at = statement_timestamp(),
      revoked_by = p_actor_user_ref,
      revocation_request_id = p_request_id
  where assignment_id = collaborator.assignment_id;
  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref,
    'curriculum_draft.collaborator.revoke',
    p_draft_id::text,
    draft_target_version,
    new_draft_revision::text,
    jsonb_build_object(
      'collaborator_ref', collaborator.principal_user_ref,
      'role', collaborator.responsibility,
      'status', 'active'
    ),
    jsonb_build_object(
      'collaborator_ref', collaborator.principal_user_ref,
      'role', collaborator.responsibility,
      'status', 'revoked'
    ),
    p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1,
    'replayed', false,
    'draftId', p_draft_id,
    'draftRevision', new_draft_revision,
    'collaborator', academy_private.curriculum_collaborator_projection(collaborator.assignment_id)
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (
    p_actor_user_ref, p_request_id, 'collaborator.revoke', p_request_digest, response
  );
  return response;
end;
$$;

alter function public.academy_admin_list_curriculum_drafts_v1(uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_entity_v1(uuid, uuid, text, text, text) owner to postgres;
alter function public.academy_admin_list_curriculum_draft_collaborators_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_add_curriculum_draft_collaborator_v1(uuid, uuid, uuid, text, bigint, uuid, text, text) owner to postgres;
alter function public.academy_admin_revoke_curriculum_draft_collaborator_v1(uuid, uuid, uuid, bigint, uuid, text, text) owner to postgres;

revoke all on table public.academy_curriculum_draft_collaborators
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_collaborator_guard_history()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_collaborator_assign_creator()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_collaboration_require_actor(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_draft_require_editor_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_collaborator_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_list_curriculum_draft_collaborators_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_add_curriculum_draft_collaborator_v1(uuid, uuid, uuid, text, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_revoke_curriculum_draft_collaborator_v1(uuid, uuid, uuid, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_list_curriculum_draft_collaborators_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_add_curriculum_draft_collaborator_v1(uuid, uuid, uuid, text, bigint, uuid, text, text)
  to service_role;
grant execute on function public.academy_admin_revoke_curriculum_draft_collaborator_v1(uuid, uuid, uuid, bigint, uuid, text, text)
  to service_role;

comment on table public.academy_curriculum_draft_collaborators is
  'Draft-scoped editor/reviewer assignments over verified Admin principals; never a source of global capability.';
comment on column public.academy_curriculum_draft_collaborators.responsibility is
  'Bounded draft responsibility: editor requires curriculum:drafts:write; reviewer requires curriculum:read.';

commit;
