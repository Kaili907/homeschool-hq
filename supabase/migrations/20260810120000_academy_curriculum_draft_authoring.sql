-- ADMIN-16B: authoritative private Curriculum Studio draft-authoring plane.
-- Published release registry rows remain outside this mutable plane and retain
-- the immutable triggers installed by ADMIN-16A.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum draft authoring migration must run as postgres';
  end if;
end;
$$;

create table public.academy_curriculum_drafts (
  draft_id uuid primary key default gen_random_uuid(),
  base_release_id uuid not null
    references public.academy_curriculum_releases (release_id) on delete restrict,
  target_version text not null check (
    target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$'
  ),
  authoring_schema_version text not null check (authoring_schema_version = '2.0.0'),
  lifecycle_state text not null check (lifecycle_state = 'draft'),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  create_request_id uuid not null,
  constraint academy_curriculum_drafts_actor_request_unique unique (created_by, create_request_id),
  constraint academy_curriculum_drafts_time_check check (updated_at >= created_at)
);

create table public.academy_curriculum_draft_entities (
  entity_id uuid not null unique default gen_random_uuid(),
  draft_id uuid not null
    references public.academy_curriculum_drafts (draft_id) on delete restrict,
  entity_type text not null check (
    entity_type in ('course', 'unit', 'lesson', 'assessment', 'media_resource')
  ),
  entity_ref text not null check (
    length(entity_ref) between 3 and 128
    and entity_ref ~ '^[a-z0-9][a-z0-9:-]*$'
  ),
  origin text not null check (origin in ('base_override', 'draft_created')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 1048576
    and payload ->> 'schema_set_version' = '2.0.0'
  ),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  revision bigint not null default 1 check (revision >= 1),
  position integer not null check (position between 0 and 1000000000),
  tombstoned boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  primary key (draft_id, entity_type, entity_ref),
  constraint academy_curriculum_draft_entities_time_check check (updated_at >= created_at)
);

create index academy_curriculum_draft_entities_navigation_idx
  on public.academy_curriculum_draft_entities
  (draft_id, entity_type, tombstoned, position, entity_ref);

create table academy_private.curriculum_authoring_request_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  operation text not null check (operation in (
    'draft.create', 'entity.create', 'entity.update', 'entity.tombstone'
  )),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  response jsonb not null check (
    jsonb_typeof(response) = 'object' and pg_column_size(response) <= 8192
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_user_ref, request_id)
);

alter table public.academy_curriculum_drafts owner to postgres;
alter table public.academy_curriculum_draft_entities owner to postgres;
alter table academy_private.curriculum_authoring_request_receipts owner to postgres;

alter table public.academy_curriculum_drafts enable row level security;
alter table public.academy_curriculum_drafts force row level security;
alter table public.academy_curriculum_draft_entities enable row level security;
alter table public.academy_curriculum_draft_entities force row level security;
alter table academy_private.curriculum_authoring_request_receipts enable row level security;
alter table academy_private.curriculum_authoring_request_receipts force row level security;

create function academy_private.curriculum_draft_guard_authority()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Curriculum draft history cannot be deleted' using errcode = '55000';
  end if;
  if new.draft_id is distinct from old.draft_id
     or new.base_release_id is distinct from old.base_release_id
     or new.target_version is distinct from old.target_version
     or new.authoring_schema_version is distinct from old.authoring_schema_version
     or new.lifecycle_state is distinct from old.lifecycle_state
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.create_request_id is distinct from old.create_request_id
     or new.revision <> old.revision + 1
     or new.updated_at < old.updated_at then
    raise exception 'Curriculum draft authority transition is invalid' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function academy_private.curriculum_entity_guard_authority()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Curriculum draft entities use tombstones' using errcode = '55000';
  end if;
  if old.tombstoned
     or new.entity_id is distinct from old.entity_id
     or new.draft_id is distinct from old.draft_id
     or new.entity_type is distinct from old.entity_type
     or new.entity_ref is distinct from old.entity_ref
     or new.origin is distinct from old.origin
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.revision <> old.revision + 1
     or (old.tombstoned and not new.tombstoned)
     or new.updated_at < old.updated_at then
    raise exception 'Curriculum draft entity authority transition is invalid' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger academy_curriculum_drafts_guard_authority
  before update or delete on public.academy_curriculum_drafts
  for each row execute function academy_private.curriculum_draft_guard_authority();
create trigger academy_curriculum_draft_entities_guard_authority
  before update or delete on public.academy_curriculum_draft_entities
  for each row execute function academy_private.curriculum_entity_guard_authority();

create function academy_private.curriculum_json_has_only_keys(
  candidate jsonb,
  required_keys text[],
  allowed_keys text[]
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and candidate ?& required_keys
    and not exists (
      select 1 from jsonb_object_keys(candidate) as key
      where not (key = any (allowed_keys))
    );
$$;

create function academy_private.curriculum_entity_payload_is_structurally_valid(
  candidate_type text,
  candidate_ref text,
  candidate jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  required_keys text[];
  allowed_keys text[];
  identity_key text;
begin
  if candidate_type not in ('course', 'unit', 'lesson', 'assessment', 'media_resource')
     or candidate_ref is null or length(candidate_ref) not between 3 and 128
     or candidate_ref !~ '^[a-z0-9][a-z0-9:-]*$'
     or candidate is null or jsonb_typeof(candidate) <> 'object'
     or pg_column_size(candidate) > 1048576
     or candidate ->> 'schema_set_version' <> '2.0.0' then
    return false;
  end if;

  case candidate_type
    when 'course' then
      identity_key := 'course_id';
      required_keys := array['schema_set_version','course_id','grade','subject','title','description','days','order','unit_refs','standards'];
      allowed_keys := required_keys || array['capstone','extensions'];
    when 'unit' then
      identity_key := 'unit_id';
      required_keys := array['schema_set_version','unit_id','course_ref','grade','subject','order','title','days','standards','essential_question','topics','performance_task','lesson_refs'];
      allowed_keys := required_keys || array['assessment_ref','extensions'];
    when 'lesson' then
      identity_key := 'lesson_id';
      required_keys := array['schema_set_version','lesson_id','course_ref','unit_ref','grade','subject','course_day','day_in_unit','title','phase','focus','estimated_duration','standards','essential_question','learning_objectives','success_criteria','materials','lesson_flow','student_activity','formative_check','scoring_guidance','mastery','tutor_routes','accessibility','safety_privacy','resource_refs','guardian_visibility_note'];
      allowed_keys := required_keys || array['extension_activity','home_connection','extensions'];
    when 'assessment' then
      identity_key := 'assessment_id';
      required_keys := array['schema_set_version','assessment_id','course_ref','unit_ref','title','standards','total_points','prompts','rubric_dimensions','accommodation_note','protected_interpretation_ref'];
      allowed_keys := required_keys || array['extensions'];
    when 'media_resource' then
      identity_key := 'resource_id';
      required_keys := array['schema_set_version','resource_id','kind','title','locator','rights','required','text_fallback'];
      allowed_keys := required_keys || array['caption_or_transcript','alt_text','long_description'];
  end case;

  return candidate ->> identity_key = candidate_ref
    and academy_private.curriculum_json_has_only_keys(candidate, required_keys, allowed_keys);
end;
$$;

create function academy_private.curriculum_authoring_require_actor(
  p_actor_user_ref uuid,
  p_required_capability text,
  p_write boolean
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_role text;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_actor_user_ref is null
     or p_required_capability <> (
       case when p_write then 'curriculum:drafts:write' else 'curriculum:read' end
     ) then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  select assignment.role into actor_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = p_actor_user_ref
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
  if actor_role is null or (p_write and actor_role not in ('admin', 'owner')) then
    raise exception 'CURRICULUM_AUTHORING_REQUIRED' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

create function academy_private.curriculum_authoring_append_audit(
  p_actor_user_ref uuid,
  p_action text,
  p_resource_ref text,
  p_resource_version text,
  p_resource_revision text,
  p_previous_value jsonb,
  p_new_value jsonb,
  p_correlation_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  old_claims text := current_setting('request.jwt.claims', true);
  event_id uuid;
begin
  perform set_config('request.jwt.claim.sub', p_actor_user_ref::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_actor_user_ref, 'role', 'authenticated',
    'academy_principal_kind', 'admin_authoring_server'
  )::text, true);
  begin
    event_id := academy_private.append_admin_audit_event_v1(
      p_action,
      case when p_action like 'curriculum_entity.%' then 'curriculum_entity' else 'curriculum_draft' end,
      p_resource_ref, p_resource_version, p_resource_revision,
      p_previous_value, p_new_value, 'curriculum.authored', p_correlation_id
    );
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return event_id;
end;
$$;

create function academy_private.curriculum_authoring_replay(
  p_actor_user_ref uuid,
  p_request_id uuid,
  p_operation text,
  p_request_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  receipt academy_private.curriculum_authoring_request_receipts%rowtype;
begin
  if p_request_id is null or p_request_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CURRICULUM_ENTITY_INPUT_INVALID' using errcode = '22023';
  end if;
  -- Serialize the same actor/request pair so concurrent retries cannot both
  -- pass the receipt lookup and duplicate state or audit.
  perform pg_advisory_xact_lock(hashtextextended(
    p_actor_user_ref::text || ':' || p_request_id::text, 0
  ));
  select * into receipt
  from academy_private.curriculum_authoring_request_receipts
  where actor_user_ref = p_actor_user_ref and request_id = p_request_id
  for update;
  if receipt.request_id is null then return null; end if;
  if receipt.operation <> p_operation or receipt.request_sha256 <> p_request_sha256 then
    raise exception 'CURRICULUM_REPLAY_CONFLICT' using errcode = '40001';
  end if;
  return receipt.response || jsonb_build_object('replayed', true);
end;
$$;

create function academy_private.curriculum_draft_projection(p_draft_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'draftId', draft.draft_id,
    'baseReleaseVersion', release.version,
    'targetVersion', draft.target_version,
    'authoringSchemaVersion', draft.authoring_schema_version,
    'lifecycleState', draft.lifecycle_state,
    'revision', draft.revision,
    'createdAt', draft.created_at,
    'updatedAt', draft.updated_at
  )
  from public.academy_curriculum_drafts as draft
  join public.academy_curriculum_releases as release on release.release_id = draft.base_release_id
  where draft.draft_id = p_draft_id;
$$;

create function academy_private.curriculum_entity_projection(p_entity_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'entityType', entity.entity_type,
    'entityRef', entity.entity_ref,
    'origin', entity.origin,
    'revision', entity.revision,
    'position', entity.position,
    'tombstoned', entity.tombstoned,
    'digest', entity.payload_sha256,
    'createdAt', entity.created_at,
    'updatedAt', entity.updated_at
  )
  from public.academy_curriculum_draft_entities as entity
  where entity.entity_id = p_entity_id;
$$;

create function public.academy_admin_list_curriculum_drafts_v1(
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
    select draft_id, updated_at
    from public.academy_curriculum_drafts
    order by updated_at desc, draft_id
    limit 1000
  ) as draft;
  return projection;
end;
$$;

create function public.academy_admin_read_curriculum_draft_v1(
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
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, false
  );
  projection := academy_private.curriculum_draft_projection(p_draft_id);
  if projection is null then return null; end if;
  select coalesce(jsonb_agg(
    academy_private.curriculum_entity_projection(entity.entity_id)
    order by entity.entity_type, entity.position, entity.entity_ref
  ), '[]'::jsonb) into entities
  from public.academy_curriculum_draft_entities as entity
  where entity.draft_id = p_draft_id;
  return projection || jsonb_build_object('entities', entities);
end;
$$;

create function public.academy_admin_read_curriculum_draft_entity_v1(
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
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, false
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

create function public.academy_admin_create_curriculum_draft_v1(
  p_actor_user_ref uuid,
  p_base_release_version text,
  p_target_version text,
  p_authoring_schema_version text,
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
  base_release uuid;
  created_draft uuid := gen_random_uuid();
  replay jsonb;
  response jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, true
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'draft.create', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_base_release_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     or p_target_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$'
     or p_target_version = p_base_release_version
     or p_authoring_schema_version <> '2.0.0' then
    raise exception 'CURRICULUM_DRAFT_INPUT_INVALID' using errcode = '22023';
  end if;
  select release_id into base_release
  from public.academy_curriculum_releases
  where version = p_base_release_version and status = 'published';
  if base_release is null or exists (
    select 1 from public.academy_curriculum_releases where version = p_target_version
  ) then
    raise exception 'CURRICULUM_BASE_RELEASE_INVALID' using errcode = '22023';
  end if;

  insert into public.academy_curriculum_drafts (
    draft_id, base_release_id, target_version, authoring_schema_version,
    lifecycle_state, created_by, updated_by, create_request_id
  ) values (
    created_draft, base_release, p_target_version, p_authoring_schema_version,
    'draft', p_actor_user_ref, p_actor_user_ref, p_request_id
  );

  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref, 'curriculum_draft.create', created_draft::text,
    p_target_version, '1', null,
    jsonb_build_object('status', 'draft', 'version', p_target_version, 'revision', 1),
    p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1, 'replayed', false,
    'draftId', created_draft, 'draftRevision', 1
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (p_actor_user_ref, p_request_id, 'draft.create', p_request_digest, response);
  return response;
end;
$$;

create function public.academy_admin_create_curriculum_draft_entity_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_entity_type text,
  p_entity_ref text,
  p_origin text,
  p_position integer,
  p_payload jsonb,
  p_payload_digest text,
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
  created_entity uuid := gen_random_uuid();
  draft_target_version text;
  new_draft_revision bigint;
  replay jsonb;
  response jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, true
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'entity.create', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_origin not in ('base_override', 'draft_created')
     or p_position not between 0 and 1000000000
     or p_payload_digest !~ '^[0-9a-f]{64}$'
     or not academy_private.curriculum_entity_payload_is_structurally_valid(
       p_entity_type, p_entity_ref, p_payload
     ) then
    raise exception 'CURRICULUM_ENTITY_INPUT_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.academy_curriculum_draft_entities
    where draft_id = p_draft_id and entity_type = p_entity_type and entity_ref = p_entity_ref
  ) then
    raise exception 'CURRICULUM_ENTITY_EXISTS' using errcode = '23505';
  end if;
  update public.academy_curriculum_drafts as draft
  set revision = revision + 1, updated_at = statement_timestamp(), updated_by = p_actor_user_ref
  where draft_id = p_draft_id
    and lifecycle_state = 'draft'
    and revision = p_expected_draft_revision
  returning draft.revision, draft.target_version into new_draft_revision, draft_target_version;
  if new_draft_revision is null then
    if not exists (select 1 from public.academy_curriculum_drafts where draft_id = p_draft_id) then
      raise exception 'CURRICULUM_DRAFT_NOT_FOUND' using errcode = 'P0002';
    end if;
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  insert into public.academy_curriculum_draft_entities (
    entity_id, draft_id, entity_type, entity_ref, origin, payload, payload_sha256,
    position, created_by, updated_by
  ) values (
    created_entity, p_draft_id, p_entity_type, p_entity_ref, p_origin, p_payload,
    p_payload_digest, p_position, p_actor_user_ref, p_actor_user_ref
  );
  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref, 'curriculum_entity.create', created_entity::text,
    draft_target_version, '1', null,
    jsonb_build_object(
      'entity_ref', p_entity_ref, 'entity_type', p_entity_type,
      'draft_revision', new_draft_revision, 'position', p_position,
      'status', 'active', 'tombstoned', false, 'digest', p_payload_digest
    ), p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1, 'replayed', false, 'draftId', p_draft_id,
    'draftRevision', new_draft_revision,
    'entity', academy_private.curriculum_entity_projection(created_entity)
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (p_actor_user_ref, p_request_id, 'entity.create', p_request_digest, response);
  return response;
end;
$$;

create function public.academy_admin_update_curriculum_draft_entity_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_entity_type text,
  p_entity_ref text,
  p_position integer,
  p_payload jsonb,
  p_payload_digest text,
  p_expected_revision bigint,
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
  entity_row public.academy_curriculum_draft_entities%rowtype;
  draft_target_version text;
  new_draft_revision bigint;
  replay jsonb;
  response jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, true
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'entity.update', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_position not between 0 and 1000000000
     or p_expected_revision < 1 or p_expected_draft_revision < 1
     or p_payload_digest !~ '^[0-9a-f]{64}$'
     or not academy_private.curriculum_entity_payload_is_structurally_valid(
       p_entity_type, p_entity_ref, p_payload
     ) then
    raise exception 'CURRICULUM_ENTITY_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into entity_row
  from public.academy_curriculum_draft_entities
  where draft_id = p_draft_id and entity_type = p_entity_type and entity_ref = p_entity_ref
  for update;
  if entity_row.entity_id is null then
    raise exception 'CURRICULUM_ENTITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if entity_row.tombstoned or entity_row.revision <> p_expected_revision then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  update public.academy_curriculum_drafts as draft
  set revision = revision + 1, updated_at = statement_timestamp(), updated_by = p_actor_user_ref
  where draft_id = p_draft_id
    and lifecycle_state = 'draft'
    and revision = p_expected_draft_revision
  returning draft.revision, draft.target_version into new_draft_revision, draft_target_version;
  if new_draft_revision is null then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  update public.academy_curriculum_draft_entities
  set payload = p_payload,
      payload_sha256 = p_payload_digest,
      position = p_position,
      revision = revision + 1,
      updated_at = statement_timestamp(),
      updated_by = p_actor_user_ref
  where entity_id = entity_row.entity_id;
  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref, 'curriculum_entity.update', entity_row.entity_id::text,
    draft_target_version, (entity_row.revision + 1)::text,
    jsonb_build_object(
      'entity_ref', entity_row.entity_ref, 'entity_type', entity_row.entity_type,
      'draft_revision', p_expected_draft_revision, 'position', entity_row.position,
      'status', 'active', 'tombstoned', false, 'digest', entity_row.payload_sha256
    ),
    jsonb_build_object(
      'entity_ref', p_entity_ref, 'entity_type', p_entity_type,
      'draft_revision', new_draft_revision, 'position', p_position,
      'status', 'active', 'tombstoned', false, 'digest', p_payload_digest
    ), p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1, 'replayed', false, 'draftId', p_draft_id,
    'draftRevision', new_draft_revision,
    'entity', academy_private.curriculum_entity_projection(entity_row.entity_id)
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (p_actor_user_ref, p_request_id, 'entity.update', p_request_digest, response);
  return response;
end;
$$;

create function public.academy_admin_tombstone_curriculum_draft_entity_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_entity_type text,
  p_entity_ref text,
  p_expected_revision bigint,
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
  entity_row public.academy_curriculum_draft_entities%rowtype;
  draft_target_version text;
  new_draft_revision bigint;
  replay jsonb;
  response jsonb;
begin
  perform academy_private.curriculum_authoring_require_actor(
    p_actor_user_ref, p_required_capability, true
  );
  replay := academy_private.curriculum_authoring_replay(
    p_actor_user_ref, p_request_id, 'entity.tombstone', p_request_digest
  );
  if replay is not null then return replay; end if;
  if p_entity_type not in ('course', 'unit', 'lesson', 'assessment', 'media_resource')
     or p_entity_ref !~ '^[a-z0-9][a-z0-9:-]{2,127}$'
     or p_expected_revision < 1 or p_expected_draft_revision < 1 then
    raise exception 'CURRICULUM_ENTITY_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into entity_row
  from public.academy_curriculum_draft_entities
  where draft_id = p_draft_id and entity_type = p_entity_type and entity_ref = p_entity_ref
  for update;
  if entity_row.entity_id is null then
    raise exception 'CURRICULUM_ENTITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if entity_row.tombstoned or entity_row.revision <> p_expected_revision then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  update public.academy_curriculum_drafts as draft
  set revision = revision + 1, updated_at = statement_timestamp(), updated_by = p_actor_user_ref
  where draft_id = p_draft_id
    and lifecycle_state = 'draft'
    and revision = p_expected_draft_revision
  returning draft.revision, draft.target_version into new_draft_revision, draft_target_version;
  if new_draft_revision is null then
    raise exception 'CURRICULUM_CAS_CONFLICT' using errcode = '40001';
  end if;
  update public.academy_curriculum_draft_entities
  set tombstoned = true,
      revision = revision + 1,
      updated_at = statement_timestamp(),
      updated_by = p_actor_user_ref
  where entity_id = entity_row.entity_id;
  perform academy_private.curriculum_authoring_append_audit(
    p_actor_user_ref, 'curriculum_entity.tombstone', entity_row.entity_id::text,
    draft_target_version, (entity_row.revision + 1)::text,
    jsonb_build_object(
      'entity_ref', entity_row.entity_ref, 'entity_type', entity_row.entity_type,
      'draft_revision', p_expected_draft_revision, 'position', entity_row.position,
      'status', 'active', 'tombstoned', false, 'digest', entity_row.payload_sha256
    ),
    jsonb_build_object(
      'entity_ref', entity_row.entity_ref, 'entity_type', entity_row.entity_type,
      'draft_revision', new_draft_revision, 'position', entity_row.position,
      'status', 'tombstoned', 'tombstoned', true, 'digest', entity_row.payload_sha256
    ), p_request_id
  );
  response := jsonb_build_object(
    'schemaVersion', 1, 'replayed', false, 'draftId', p_draft_id,
    'draftRevision', new_draft_revision,
    'entity', academy_private.curriculum_entity_projection(entity_row.entity_id)
  );
  insert into academy_private.curriculum_authoring_request_receipts (
    actor_user_ref, request_id, operation, request_sha256, response
  ) values (p_actor_user_ref, p_request_id, 'entity.tombstone', p_request_digest, response);
  return response;
end;
$$;

alter function public.academy_admin_list_curriculum_drafts_v1(uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_draft_entity_v1(uuid, uuid, text, text, text) owner to postgres;
alter function public.academy_admin_create_curriculum_draft_v1(uuid, text, text, text, uuid, text, text) owner to postgres;
alter function public.academy_admin_create_curriculum_draft_entity_v1(uuid, uuid, text, text, text, integer, jsonb, text, bigint, uuid, text, text) owner to postgres;
alter function public.academy_admin_update_curriculum_draft_entity_v1(uuid, uuid, text, text, integer, jsonb, text, bigint, bigint, uuid, text, text) owner to postgres;
alter function public.academy_admin_tombstone_curriculum_draft_entity_v1(uuid, uuid, text, text, bigint, bigint, uuid, text, text) owner to postgres;

revoke all on table public.academy_curriculum_drafts
  from public, anon, authenticated, service_role;
revoke all on table public.academy_curriculum_draft_entities
  from public, anon, authenticated, service_role;
revoke all on table academy_private.curriculum_authoring_request_receipts
  from public, anon, authenticated, service_role;

revoke all on function academy_private.curriculum_draft_guard_authority()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_entity_guard_authority()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_json_has_only_keys(jsonb, text[], text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_entity_payload_is_structurally_valid(text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_authoring_require_actor(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_authoring_append_audit(uuid, text, text, text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_authoring_replay(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_draft_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_entity_projection(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.academy_admin_list_curriculum_drafts_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_draft_entity_v1(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_create_curriculum_draft_v1(uuid, text, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_create_curriculum_draft_entity_v1(uuid, uuid, text, text, text, integer, jsonb, text, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_update_curriculum_draft_entity_v1(uuid, uuid, text, text, integer, jsonb, text, bigint, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_tombstone_curriculum_draft_entity_v1(uuid, uuid, text, text, bigint, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_list_curriculum_drafts_v1(uuid, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_draft_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_draft_entity_v1(uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.academy_admin_create_curriculum_draft_v1(uuid, text, text, text, uuid, text, text)
  to service_role;
grant execute on function public.academy_admin_create_curriculum_draft_entity_v1(uuid, uuid, text, text, text, integer, jsonb, text, bigint, uuid, text, text)
  to service_role;
grant execute on function public.academy_admin_update_curriculum_draft_entity_v1(uuid, uuid, text, text, integer, jsonb, text, bigint, bigint, uuid, text, text)
  to service_role;
grant execute on function public.academy_admin_tombstone_curriculum_draft_entity_v1(uuid, uuid, text, text, bigint, bigint, uuid, text, text)
  to service_role;

comment on table public.academy_curriculum_drafts is
  'Private mutable Curriculum Studio workspaces, each bound to one immutable published base release.';
comment on table public.academy_curriculum_draft_entities is
  'Schema Set 2.0.0 draft entities with independent revision CAS and tombstone history.';

commit;
