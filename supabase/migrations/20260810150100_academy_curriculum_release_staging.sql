-- ADMIN-20A: authoritative, immutable curriculum release staging.
-- STAGED is deliberately distinct from PUBLISHED and ACTIVE. This migration
-- creates no published release, pointer mutation, learner pin, or runtime bind.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum release staging migration must run as postgres';
  end if;
end;
$$;

-- Extend the bounded audit vocabulary with a staging fact. Retain the complete
-- vocabulary composed by the approval migration.
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
    'curriculum_draft.collaborator.add', 'curriculum_draft.collaborator.revoke',
    'curriculum_standard_review.update',
    'curriculum_approval.approve', 'curriculum_approval.changes_requested',
    'curriculum_release.stage',
    'curriculum.approve', 'curriculum.publish',
    'release.activate', 'release.rollback'
  )),
  add constraint admin_audit_events_resource_type_check check (resource_type in (
    'admin_role_assignment', 'configuration', 'engine', 'safety_case',
    'incident', 'curriculum_draft', 'curriculum_entity',
    'curriculum_standard_review', 'curriculum_approval',
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
    ('curriculum_standard_review.update', 'curriculum_standard_review'),
    ('curriculum_approval.approve', 'curriculum_approval'),
    ('curriculum_approval.changes_requested', 'curriculum_approval'),
    ('curriculum_release.stage', 'curriculum_release'),
    ('curriculum.approve', 'curriculum_release'),
    ('curriculum.publish', 'curriculum_release'),
    ('release.activate', 'application_release'),
    ('release.rollback', 'application_release')
  );
$$;

create or replace function academy_private.admin_audit_reason_is_allowed(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate is null or candidate = any (array[
    'operator.request', 'scheduled.change', 'policy.enforcement',
    'incident.response', 'corrective.action', 'emergency.response',
    'access.granted', 'access.revoked', 'configuration.changed',
    'engine.controlled', 'safety.reviewed', 'incident.acknowledged',
    'curriculum.authored', 'curriculum.approved', 'curriculum.staged',
    'curriculum.published', 'release.activated', 'release.rolled_back'
  ]::text[]);
$$;

create table public.academy_curriculum_staged_releases (
  staging_id uuid primary key,
  schema_version integer not null default 1 check (schema_version = 1),
  status text not null default 'staged' check (status = 'staged'),
  publication_status text not null default 'not_published'
    check (publication_status = 'not_published'),
  draft_id uuid not null references public.academy_curriculum_drafts (draft_id) on delete restrict,
  draft_revision bigint not null check (draft_revision >= 1),
  base_release_id uuid not null references public.academy_curriculum_releases (release_id) on delete restrict,
  target_version text not null check (
    target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$'
  ),
  schema_set_version text not null check (schema_set_version = '2.0.0'),
  validation_snapshot_id uuid not null
    references public.academy_curriculum_draft_validation_snapshots (validation_snapshot_id) on delete restrict,
  validation_result_sha256 text not null check (validation_result_sha256 ~ '^[0-9a-f]{64}$'),
  approval_id uuid not null
    references public.academy_curriculum_draft_approval_decisions (approval_id) on delete restrict,
  entity_counts jsonb not null check (jsonb_typeof(entity_counts) = 'object'),
  file_count integer not null check (file_count between 1 and 100),
  byte_count bigint not null check (byte_count >= 1),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  package_sha256 text not null check (package_sha256 ~ '^[0-9a-f]{64}$'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  manifest_canonical text not null,
  staged_by uuid not null references auth.users (id) on delete restrict,
  staged_at timestamptz not null default statement_timestamp(),
  request_id uuid not null,
  constraint academy_curriculum_staged_revision_unique unique (draft_id, draft_revision),
  constraint academy_curriculum_staged_target_unique unique (target_version),
  constraint academy_curriculum_staged_package_unique unique (package_sha256),
  constraint academy_curriculum_staged_manifest_canonical_check check (
    octet_length(manifest_canonical) between 2 and 1000000
  )
);

create table public.academy_curriculum_staged_release_artifacts (
  staging_id uuid not null
    references public.academy_curriculum_staged_releases (staging_id) on delete restrict,
  relative_path text not null check (
    relative_path ~ '^snapshot/[a-z][a-z_]{0,63}\.json$'
    and position('..' in relative_path) = 0
  ),
  byte_count bigint not null check (byte_count >= 2),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content jsonb not null,
  canonical_content text not null,
  primary key (staging_id, relative_path),
  constraint academy_curriculum_staged_artifact_canonical_check check (
    octet_length(canonical_content) = byte_count
  )
);

create table academy_private.curriculum_staging_request_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  staging_id uuid not null references public.academy_curriculum_staged_releases (staging_id) on delete restrict,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_user_ref, request_id)
);

alter table public.academy_curriculum_staged_releases owner to postgres;
alter table public.academy_curriculum_staged_release_artifacts owner to postgres;
alter table academy_private.curriculum_staging_request_receipts owner to postgres;

alter table public.academy_curriculum_staged_releases enable row level security;
alter table public.academy_curriculum_staged_releases force row level security;
alter table public.academy_curriculum_staged_release_artifacts enable row level security;
alter table public.academy_curriculum_staged_release_artifacts force row level security;
alter table academy_private.curriculum_staging_request_receipts enable row level security;
alter table academy_private.curriculum_staging_request_receipts force row level security;

create function academy_private.curriculum_staging_reject_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy staged curriculum packages are immutable' using errcode = '55000';
end;
$$;

create trigger academy_curriculum_staged_releases_immutable
  before update or delete on public.academy_curriculum_staged_releases
  for each row execute function academy_private.curriculum_staging_reject_mutation();
create trigger academy_curriculum_staged_artifacts_immutable
  before update or delete on public.academy_curriculum_staged_release_artifacts
  for each row execute function academy_private.curriculum_staging_reject_mutation();
create trigger academy_curriculum_staging_receipts_immutable
  before update or delete on academy_private.curriculum_staging_request_receipts
  for each row execute function academy_private.curriculum_staging_reject_mutation();

create function academy_private.curriculum_staging_require_actor(
  p_actor_user_ref uuid,
  p_required_capability text
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
     or p_required_capability not in ('curriculum:read', 'curriculum:publish') then
    raise exception 'CURRICULUM_STAGING_REQUIRED' using errcode = '42501';
  end if;
  select assignment.role into actor_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = p_actor_user_ref
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
  if actor_role is null
     or (p_required_capability = 'curriculum:publish' and actor_role <> 'owner') then
    raise exception 'CURRICULUM_STAGING_REQUIRED' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

create function academy_private.curriculum_staging_candidate_projection(p_staging_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'stagingId', candidate.staging_id,
    'status', 'staged',
    'publicationStatus', 'not_published',
    'validationSnapshotId', candidate.validation_snapshot_id,
    'approvalId', candidate.approval_id,
    'entityCounts', candidate.entity_counts,
    'fileCount', candidate.file_count,
    'byteCount', candidate.byte_count,
    'contentHash', candidate.content_sha256,
    'manifestHash', candidate.manifest_sha256,
    'packageHash', candidate.package_sha256,
    'stagedAt', to_char(candidate.staged_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'authority', 'curriculum:publish'
  )
  from public.academy_curriculum_staged_releases as candidate
  where candidate.staging_id = p_staging_id;
$$;

create function academy_private.curriculum_staging_status_projection(p_draft_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  draft_row public.academy_curriculum_drafts%rowtype;
  candidate_row public.academy_curriculum_staged_releases%rowtype;
  approval_status jsonb;
  publish_gate jsonb;
  latest_validation jsonb;
  current_decision jsonb;
  reasons jsonb := '[]'::jsonb;
  target_collision boolean := false;
  stage_state text;
begin
  select * into draft_row
  from public.academy_curriculum_drafts
  where draft_id = p_draft_id;
  if draft_row.draft_id is null then
    raise exception 'CURRICULUM_STAGING_NOT_FOUND' using errcode = 'P0002';
  end if;

  approval_status := academy_private.curriculum_approval_status_projection(p_draft_id);
  publish_gate := approval_status -> 'publishGate';
  latest_validation := approval_status -> 'latestValidation';
  current_decision := approval_status -> 'currentDecision';

  select * into candidate_row
  from public.academy_curriculum_staged_releases
  where draft_id = p_draft_id and draft_revision = draft_row.revision;

  if candidate_row.staging_id is null then
    select exists (
      select 1 from public.academy_curriculum_releases
      where version = draft_row.target_version
      union all
      select 1 from public.academy_curriculum_staged_releases
      where target_version = draft_row.target_version
    ) into target_collision;
    if draft_row.authoring_schema_version <> '2.0.0' then
      reasons := reasons || jsonb_build_array('schema_set_unsupported');
    end if;
    if coalesce((publish_gate ->> 'eligible')::boolean, false) is false then
      reasons := reasons || jsonb_build_array(publish_gate ->> 'reason');
    end if;
    if target_collision then
      reasons := reasons || jsonb_build_array('target_version_collision');
    end if;
  end if;

  stage_state := case
    when candidate_row.staging_id is not null then 'staged'
    when jsonb_array_length(reasons) = 0 then 'eligible'
    else 'blocked'
  end;

  return jsonb_build_object(
    'schemaVersion', 1,
    'draftId', draft_row.draft_id,
    'draftRevision', draft_row.revision,
    'baseReleaseVersion', (
      select release.version from public.academy_curriculum_releases as release
      where release.release_id = draft_row.base_release_id
    ),
    'targetVersion', draft_row.target_version,
    'schemaSetVersion', draft_row.authoring_schema_version,
    'stageState', stage_state,
    'eligible', stage_state = 'eligible',
    'blockingReasons', reasons,
    'validation', case when latest_validation is null or latest_validation = 'null'::jsonb
      then null else jsonb_build_object(
      'status', latest_validation ->> 'status',
      'validationSnapshotId', latest_validation ->> 'validationSnapshotId'
    ) end,
    'approval', case when current_decision is null or current_decision = 'null'::jsonb
      then null else jsonb_build_object(
      'status', case when approval_status ->> 'status' = 'stale'
        then 'stale' else current_decision ->> 'decision' end,
      'approvalId', current_decision ->> 'approvalId'
    ) end,
    'candidate', case when candidate_row.staging_id is null then null
      else academy_private.curriculum_staging_candidate_projection(candidate_row.staging_id) end
  );
end;
$$;

create function academy_private.curriculum_staging_append_audit(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_target_version text,
  p_draft_revision bigint,
  p_staging_id uuid,
  p_manifest_sha256 text,
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
    'academy_principal_kind', 'admin_curriculum_staging_server'
  )::text, true);
  begin
    event_id := academy_private.append_admin_audit_event_v1(
      'curriculum_release.stage', 'curriculum_release', p_draft_id::text,
      p_target_version, p_draft_revision::text,
      jsonb_build_object(
        'state', 'approved', 'status', 'approval.ready',
        'revision', p_draft_revision, 'release', p_target_version
      ),
      jsonb_build_object(
        'state', 'staged', 'status', 'staged', 'revision', p_draft_revision,
        'release', p_target_version, 'value', p_manifest_sha256
      ),
      'curriculum.staged', p_correlation_id
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

create function public.academy_admin_read_curriculum_staging_v1(
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
begin
  perform academy_private.curriculum_staging_require_actor(
    p_actor_user_ref, p_required_capability
  );
  return academy_private.curriculum_staging_status_projection(p_draft_id);
end;
$$;

-- Project exact persisted bytes only to the trusted server verifier. The
-- browser never receives canonical_content or curriculum payloads.
create function public.academy_admin_read_curriculum_staging_integrity_v1(
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
  perform academy_private.curriculum_staging_require_actor(
    p_actor_user_ref, p_required_capability
  );
  select jsonb_build_object(
    'schemaVersion', 1,
    'candidates', coalesce(jsonb_agg(jsonb_build_object(
      'stagingId', candidate.staging_id,
      'schemaVersion', candidate.schema_version,
      'status', candidate.status,
      'publicationStatus', candidate.publication_status,
      'draftId', candidate.draft_id,
      'draftRevision', candidate.draft_revision,
      'baseReleaseVersion', base_release.version,
      'targetVersion', candidate.target_version,
      'schemaSetVersion', candidate.schema_set_version,
      'validationSnapshotId', candidate.validation_snapshot_id,
      'validationResultDigest', candidate.validation_result_sha256,
      'approvalId', candidate.approval_id,
      'entityCounts', candidate.entity_counts,
      'fileCount', candidate.file_count,
      'byteCount', candidate.byte_count,
      'contentHash', candidate.content_sha256,
      'manifestHash', candidate.manifest_sha256,
      'packageHash', candidate.package_sha256,
      'manifest', candidate.manifest,
      'manifestCanonical', candidate.manifest_canonical,
      'stagedAt', to_char(candidate.staged_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'validation', jsonb_build_object(
        'validationSnapshotId', validation.validation_snapshot_id,
        'draftId', validation.draft_id,
        'draftRevision', validation.draft_revision,
        'baseReleaseVersion', base_release.version,
        'targetVersion', validation.target_version,
        'schemaSetVersion', validation.schema_set_version,
        'resultDigest', validation.result_sha256,
        'status', validation.validation_status,
        'publicationReady', validation.publication_ready
      ),
      'approval', jsonb_build_object(
        'approvalId', approval.approval_id,
        'draftId', approval.draft_id,
        'draftRevision', approval.draft_revision,
        'baseReleaseVersion', base_release.version,
        'targetVersion', approval.target_version,
        'schemaSetVersion', approval.schema_set_version,
        'validationSnapshotId', approval.validation_snapshot_id,
        'validationResultDigest', approval.validation_result_sha256,
        'decision', approval.decision,
        'reasonCode', approval.reason_code
      ),
      'artifacts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'relativePath', artifact.relative_path,
          'byteCount', artifact.byte_count,
          'sha256', artifact.sha256,
          'canonicalContent', artifact.canonical_content
        ) order by artifact.relative_path)
        from public.academy_curriculum_staged_release_artifacts as artifact
        where artifact.staging_id = candidate.staging_id
      ), '[]'::jsonb)
    ) order by candidate.target_version, candidate.staging_id), '[]'::jsonb)
  ) into projection
  from public.academy_curriculum_staged_releases as candidate
  join public.academy_curriculum_releases as base_release
    on base_release.release_id = candidate.base_release_id
  join public.academy_curriculum_draft_validation_snapshots as validation
    on validation.validation_snapshot_id = candidate.validation_snapshot_id
  join public.academy_curriculum_draft_approval_decisions as approval
    on approval.approval_id = candidate.approval_id;
  return projection;
end;
$$;

create function public.academy_admin_stage_curriculum_release_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_draft_revision bigint,
  p_validation_snapshot_id uuid,
  p_approval_id uuid,
  p_manifest jsonb,
  p_manifest_canonical text,
  p_artifacts jsonb,
  p_content_sha256 text,
  p_manifest_sha256 text,
  p_package_sha256 text,
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
  draft_row public.academy_curriculum_drafts%rowtype;
  existing_candidate public.academy_curriculum_staged_releases%rowtype;
  receipt academy_private.curriculum_staging_request_receipts%rowtype;
  gate jsonb;
  artifact jsonb;
  artifact_path text;
  artifact_bytes bigint;
  artifact_hash text;
  artifact_content text;
  seen_paths text[] := array[]::text[];
  total_bytes bigint := 0;
  validation_digest text;
  response jsonb;
begin
  perform academy_private.curriculum_staging_require_actor(
    p_actor_user_ref, p_required_capability
  );

  select * into receipt
  from academy_private.curriculum_staging_request_receipts
  where actor_user_ref = p_actor_user_ref and request_id = p_request_id;
  if receipt.request_id is not null then
    select * into existing_candidate
    from public.academy_curriculum_staged_releases
    where staging_id = receipt.staging_id;
    if receipt.request_sha256 <> p_request_digest
       or existing_candidate.draft_id is distinct from p_draft_id
       or existing_candidate.draft_revision is distinct from p_draft_revision
       or existing_candidate.validation_snapshot_id
          is distinct from p_validation_snapshot_id
       or existing_candidate.approval_id is distinct from p_approval_id
       or existing_candidate.content_sha256 is distinct from p_content_sha256
       or existing_candidate.manifest_sha256 is distinct from p_manifest_sha256
       or existing_candidate.package_sha256 is distinct from p_package_sha256
       or existing_candidate.manifest is distinct from p_manifest
       or existing_candidate.manifest_canonical
          is distinct from p_manifest_canonical
       or p_artifacts is distinct from coalesce((
         select jsonb_agg(jsonb_build_object(
           'relativePath', artifact.relative_path,
           'byteCount', artifact.byte_count,
           'sha256', artifact.sha256,
           'canonicalContent', artifact.canonical_content
         ) order by artifact.relative_path)
         from public.academy_curriculum_staged_release_artifacts as artifact
         where artifact.staging_id = receipt.staging_id
       ), '[]'::jsonb) then
      raise exception 'CURRICULUM_STAGING_REPLAY_CONFLICT' using errcode = '23505';
    end if;
    return receipt.response || jsonb_build_object('replayed', true);
  end if;

  select * into draft_row
  from public.academy_curriculum_drafts
  where draft_id = p_draft_id
  for update;
  if draft_row.draft_id is null then
    raise exception 'CURRICULUM_STAGING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if draft_row.lifecycle_state <> 'draft'
     or draft_row.revision <> p_draft_revision then
    raise exception 'CURRICULUM_STAGING_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if draft_row.authoring_schema_version <> '2.0.0' then
    raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
  end if;

  gate := academy_private.curriculum_approval_publish_gate_v1(
    p_draft_id, p_draft_revision
  );
  if coalesce((gate ->> 'eligible')::boolean, false) is false
     or gate ->> 'approvalId' <> p_approval_id::text
     or gate ->> 'validationSnapshotId' <> p_validation_snapshot_id::text then
    raise exception 'CURRICULUM_STAGING_GATE_BLOCKED' using errcode = '55000';
  end if;

  select result_sha256 into validation_digest
  from public.academy_curriculum_draft_validation_snapshots
  where validation_snapshot_id = p_validation_snapshot_id
    and draft_id = p_draft_id
    and draft_revision = p_draft_revision;

  if p_request_id is null or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_content_sha256 !~ '^[0-9a-f]{64}$'
     or p_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or p_package_sha256 !~ '^[0-9a-f]{64}$'
     or validation_digest is null
     or jsonb_typeof(p_manifest) <> 'object'
     or p_manifest_canonical is null
     or octet_length(p_manifest_canonical) not between 2 and 1000000
     or p_manifest_canonical::jsonb <> p_manifest
     or jsonb_typeof(p_artifacts) <> 'array'
     or jsonb_array_length(p_artifacts) not between 1 and 100
     or p_manifest ->> 'packageFormat' <> 'manuel-academy-curriculum-staged-v1'
     or p_manifest ->> 'baseReleaseVersion' <> (
       select version from public.academy_curriculum_releases
       where release_id = draft_row.base_release_id
     )
     or p_manifest ->> 'targetVersion' <> draft_row.target_version
     or p_manifest ->> 'schemaSetVersion' <> draft_row.authoring_schema_version
     or p_manifest #>> '{draft,id}' <> p_draft_id::text
     or p_manifest #>> '{draft,revision}' <> p_draft_revision::text
     or p_manifest #>> '{validation,id}' <> p_validation_snapshot_id::text
     or p_manifest #>> '{validation,resultDigest}' <> validation_digest
     or p_manifest #>> '{approval,id}' <> p_approval_id::text
     or p_manifest ->> 'contentHash' <> p_content_sha256
     or p_manifest ->> 'fileCount' <> jsonb_array_length(p_artifacts)::text
     or jsonb_typeof(p_manifest -> 'files') <> 'array'
     or jsonb_array_length(p_manifest -> 'files') <> jsonb_array_length(p_artifacts)
     or jsonb_typeof(p_manifest -> 'entityCounts') <> 'object' then
    raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
  end if;

  for artifact in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(artifact) <> 'object'
       or (select count(*) from jsonb_object_keys(artifact)) <> 4
       or not artifact ?& array['relativePath', 'byteCount', 'sha256', 'canonicalContent'] then
      raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
    end if;
    artifact_path := artifact ->> 'relativePath';
    artifact_hash := artifact ->> 'sha256';
    artifact_content := artifact ->> 'canonicalContent';
    begin
      artifact_bytes := (artifact ->> 'byteCount')::bigint;
      perform artifact_content::jsonb;
    exception when others then
      raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
    end;
    if artifact_path !~ '^snapshot/[a-z][a-z_]{0,63}\.json$'
       or position('..' in artifact_path) > 0
       or artifact_path = any(seen_paths)
       or artifact_hash !~ '^[0-9a-f]{64}$'
       or artifact_bytes < 2
       or octet_length(artifact_content) <> artifact_bytes
       or not exists (
         select 1 from jsonb_array_elements(p_manifest -> 'files') as file
         where file ->> 'relativePath' = artifact_path
           and file ->> 'byteCount' = artifact_bytes::text
           and file ->> 'sha256' = artifact_hash
       ) then
      raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
    end if;
    seen_paths := array_append(seen_paths, artifact_path);
    total_bytes := total_bytes + artifact_bytes;
  end loop;
  if p_manifest ->> 'byteCount' <> total_bytes::text then
    raise exception 'CURRICULUM_STAGING_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into existing_candidate
  from public.academy_curriculum_staged_releases
  where draft_id = p_draft_id and draft_revision = p_draft_revision;
  if existing_candidate.staging_id is not null then
    if existing_candidate.validation_snapshot_id <> p_validation_snapshot_id
       or existing_candidate.approval_id <> p_approval_id
       or existing_candidate.content_sha256 <> p_content_sha256
       or existing_candidate.manifest_sha256 <> p_manifest_sha256
       or existing_candidate.package_sha256 <> p_package_sha256
       or existing_candidate.manifest <> p_manifest then
      raise exception 'CURRICULUM_STAGING_PACKAGE_CONFLICT' using errcode = '23505';
    end if;
    response := academy_private.curriculum_staging_status_projection(p_draft_id);
    insert into academy_private.curriculum_staging_request_receipts (
      actor_user_ref, request_id, request_sha256, staging_id, response
    ) values (
      p_actor_user_ref, p_request_id, p_request_digest,
      existing_candidate.staging_id, response
    );
    return response || jsonb_build_object('replayed', true);
  end if;

  if exists (
    select 1 from public.academy_curriculum_releases
    where version = draft_row.target_version
  ) or exists (
    select 1 from public.academy_curriculum_staged_releases
    where target_version = draft_row.target_version
  ) then
    raise exception 'CURRICULUM_STAGING_TARGET_COLLISION' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.academy_curriculum_staged_releases
    where staging_id = p_request_id
  ) then
    raise exception 'CURRICULUM_STAGING_PACKAGE_CONFLICT' using errcode = '23505';
  end if;

  insert into public.academy_curriculum_staged_releases (
    staging_id, draft_id, draft_revision, base_release_id, target_version,
    schema_set_version, validation_snapshot_id, validation_result_sha256,
    approval_id, entity_counts, file_count, byte_count, content_sha256,
    manifest_sha256, package_sha256, manifest, manifest_canonical,
    staged_by, request_id
  ) values (
    p_request_id, p_draft_id, p_draft_revision, draft_row.base_release_id,
    draft_row.target_version, draft_row.authoring_schema_version,
    p_validation_snapshot_id, validation_digest, p_approval_id,
    p_manifest -> 'entityCounts', jsonb_array_length(p_artifacts), total_bytes,
    p_content_sha256, p_manifest_sha256, p_package_sha256, p_manifest,
    p_manifest_canonical, p_actor_user_ref, p_request_id
  );

  for artifact in select value from jsonb_array_elements(p_artifacts) loop
    insert into public.academy_curriculum_staged_release_artifacts (
      staging_id, relative_path, byte_count, sha256, content, canonical_content
    ) values (
      p_request_id,
      artifact ->> 'relativePath',
      (artifact ->> 'byteCount')::bigint,
      artifact ->> 'sha256',
      (artifact ->> 'canonicalContent')::jsonb,
      artifact ->> 'canonicalContent'
    );
  end loop;

  perform academy_private.curriculum_staging_append_audit(
    p_actor_user_ref, p_draft_id, draft_row.target_version, p_draft_revision,
    p_request_id, p_manifest_sha256, p_request_id
  );
  response := academy_private.curriculum_staging_status_projection(p_draft_id);
  insert into academy_private.curriculum_staging_request_receipts (
    actor_user_ref, request_id, request_sha256, staging_id, response
  ) values (
    p_actor_user_ref, p_request_id, p_request_digest, p_request_id, response
  );
  return response || jsonb_build_object('replayed', false);
end;
$$;

alter function academy_private.admin_audit_action_resource_is_allowed(text, text) owner to postgres;
alter function academy_private.admin_audit_reason_is_allowed(text) owner to postgres;
alter function academy_private.curriculum_staging_reject_mutation() owner to postgres;
alter function academy_private.curriculum_staging_require_actor(uuid, text) owner to postgres;
alter function academy_private.curriculum_staging_candidate_projection(uuid) owner to postgres;
alter function academy_private.curriculum_staging_status_projection(uuid) owner to postgres;
alter function academy_private.curriculum_staging_append_audit(uuid, uuid, text, bigint, uuid, text, uuid) owner to postgres;
alter function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_read_curriculum_staging_integrity_v1(uuid, text) owner to postgres;
alter function public.academy_admin_stage_curriculum_release_v1(uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text) owner to postgres;

revoke all on table public.academy_curriculum_staged_releases
  from public, anon, authenticated, service_role;
revoke all on table public.academy_curriculum_staged_release_artifacts
  from public, anon, authenticated, service_role;
revoke all on table academy_private.curriculum_staging_request_receipts
  from public, anon, authenticated, service_role;

revoke all on function academy_private.curriculum_staging_reject_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_staging_require_actor(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_staging_candidate_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_staging_status_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_staging_append_audit(uuid, uuid, text, bigint, uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_staging_integrity_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_stage_curriculum_release_v1(uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_staging_integrity_v1(uuid, text)
  to service_role;
grant execute on function public.academy_admin_stage_curriculum_release_v1(uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text)
  to service_role;

comment on table public.academy_curriculum_staged_releases is
  'Immutable exact-revision curriculum candidates. STAGED is not PUBLISHED or ACTIVE.';
comment on table public.academy_curriculum_staged_release_artifacts is
  'Complete deterministic Schema v2 snapshot artifacts for a staged candidate.';
comment on function public.academy_admin_stage_curriculum_release_v1(uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text) is
  'Service-only curriculum:publish staging mutation; never publishes or activates.';
comment on function public.academy_admin_read_curriculum_staging_integrity_v1(uuid, text) is
  'Service-only curriculum:read evidence projection for independent read-only integrity verification.';

commit;
