-- ADMIN-20B: publish one exact staged curriculum candidate into the immutable
-- release registry. Publication is deliberately separate from activation.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum release publishing migration must run as postgres';
  end if;
end;
$$;

-- The existing registry remains authoritative. Legacy releases retain their
-- commit-pinned provenance; newly authored releases point at immutable staging
-- evidence and carry the exact staged content, manifest, and package digests.
alter table public.academy_curriculum_releases
  drop constraint academy_curriculum_releases_version_check,
  drop constraint academy_curriculum_releases_provenance_class_check,
  alter column source_commit drop not null,
  alter column source_root drop not null,
  alter column package_manifest_sha256 drop not null,
  alter column checksum_manifest_sha256 drop not null,
  alter column curriculum_manifest_sha256 drop not null,
  alter column file_inventory_sha256 drop not null,
  add column staging_id uuid unique
    references public.academy_curriculum_staged_releases (staging_id) on delete restrict,
  add column published_by uuid references auth.users (id) on delete restrict,
  add column publication_content_sha256 text
    check (publication_content_sha256 is null or publication_content_sha256 ~ '^[0-9a-f]{64}$'),
  add column publication_manifest_sha256 text
    check (publication_manifest_sha256 is null or publication_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  add column publication_package_sha256 text
    check (publication_package_sha256 is null or publication_package_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint academy_curriculum_releases_version_check check (
    version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$'
  ),
  add constraint academy_curriculum_releases_provenance_class_check check (
    provenance_class in ('legacy_import', 'staged_publish')
  ),
  add constraint academy_curriculum_releases_provenance_coherence check (
    (
      provenance_class = 'legacy_import'
      and staging_id is null and published_by is null
      and source_commit is not null and source_root is not null
      and package_manifest_sha256 is not null
      and checksum_manifest_sha256 is not null
      and curriculum_manifest_sha256 is not null
      and file_inventory_sha256 is not null
      and publication_content_sha256 is null
      and publication_manifest_sha256 is null
      and publication_package_sha256 is null
    ) or (
      provenance_class = 'staged_publish'
      and staging_id is not null and published_by is not null
      and source_commit is null and source_root is null
      and package_manifest_sha256 is null
      and checksum_manifest_sha256 is null
      and curriculum_manifest_sha256 is null
      and file_inventory_sha256 is null
      and publication_content_sha256 is not null
      and publication_manifest_sha256 is not null
      and publication_package_sha256 is not null
    )
  );

-- Staged JSON bytes become the production-suitable published artifact plane.
-- Legacy inventory rows keep their commit locators and deliberately have no
-- embedded content. Both variants remain protected by the existing immutable
-- registry trigger.
alter table public.academy_curriculum_release_files
  drop constraint academy_curriculum_release_files_safe_classification_check,
  drop constraint academy_curriculum_release_files_immutable_locator_check,
  add column content jsonb,
  add column canonical_content text,
  add constraint academy_curriculum_release_files_safe_classification_check check (
    safe_classification in ('metadata_only_internal_source', 'immutable_embedded_json')
  ),
  add constraint academy_curriculum_release_files_custody_check check (
    (
      safe_classification = 'metadata_only_internal_source'
      and content is null and canonical_content is null
      and immutable_locator ~ '^git_commit_path:[0-9a-f]{40}:curriculum-content/manuel-academy/[0-9]+\.[0-9]+\.[0-9]+/.+$'
    ) or (
      safe_classification = 'immutable_embedded_json'
      and content is not null and canonical_content is not null
      and octet_length(canonical_content) = byte_count
      and canonical_content::jsonb = content
      and immutable_locator ~ '^curriculum_registry:[0-9a-f-]{36}:snapshot/[a-z][a-z_]{0,63}\.json$'
    )
  );

create table academy_private.curriculum_publication_request_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  staging_id uuid not null
    references public.academy_curriculum_staged_releases (staging_id) on delete restrict,
  release_id uuid not null
    references public.academy_curriculum_releases (release_id) on delete restrict,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_user_ref, request_id)
);

alter table academy_private.curriculum_publication_request_receipts owner to postgres;
alter table academy_private.curriculum_publication_request_receipts enable row level security;
alter table academy_private.curriculum_publication_request_receipts force row level security;

create trigger academy_curriculum_publication_receipts_immutable
  before update or delete on academy_private.curriculum_publication_request_receipts
  for each row execute function public.academy_curriculum_registry_guard_immutable();

create function academy_private.curriculum_publication_require_actor(
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
    raise exception 'CURRICULUM_PUBLICATION_REQUIRED' using errcode = '42501';
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
    raise exception 'CURRICULUM_PUBLICATION_REQUIRED' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;

-- Recompute every staged identity from stored bytes. PostgreSQL bytea hashing
-- is used so verification does not trust browser- or function-supplied hashes.
create function academy_private.curriculum_publication_verification(p_staging_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  candidate public.academy_curriculum_staged_releases%rowtype;
  actual_file_count integer := 0;
  actual_byte_count bigint := 0;
  artifacts_hashed boolean := false;
  manifest_files_complete boolean := false;
  entity_counts_valid boolean := false;
  computed_content_sha256 text;
  computed_manifest_sha256 text;
  computed_package_sha256 text;
  manifest_identity_verified boolean := false;
begin
  select * into candidate
  from public.academy_curriculum_staged_releases
  where staging_id = p_staging_id;
  if candidate.staging_id is null then return null; end if;

  select count(*)::integer, coalesce(sum(artifact.byte_count), 0),
    coalesce(bool_and(
      octet_length(artifact.canonical_content) = artifact.byte_count
      and artifact.canonical_content::jsonb = artifact.content
      and encode(sha256(convert_to(artifact.canonical_content, 'UTF8')), 'hex') = artifact.sha256
    ), false)
  into actual_file_count, actual_byte_count, artifacts_hashed
  from public.academy_curriculum_staged_release_artifacts as artifact
  where artifact.staging_id = p_staging_id;

  select encode(sha256(decode(coalesce(string_agg(
    encode(
      convert_to(artifact.relative_path, 'UTF8') || decode('00', 'hex') ||
      convert_to(artifact.byte_count::text, 'UTF8') || decode('00', 'hex') ||
      convert_to(artifact.sha256, 'UTF8') || convert_to(E'\n', 'UTF8'),
      'hex'
    ), '' order by artifact.relative_path
  ), ''), 'hex')), 'hex')
  into computed_content_sha256
  from public.academy_curriculum_staged_release_artifacts as artifact
  where artifact.staging_id = p_staging_id;

  computed_manifest_sha256 := encode(
    sha256(convert_to(candidate.manifest_canonical, 'UTF8')), 'hex'
  );
  computed_package_sha256 := encode(sha256(convert_to(
    'manuel-academy-curriculum-staged-v1' || E'\n' ||
    candidate.content_sha256 || E'\n' || candidate.manifest_sha256 || E'\n',
    'UTF8'
  )), 'hex');

  if jsonb_typeof(candidate.manifest -> 'files') = 'array' then
    select
      jsonb_array_length(candidate.manifest -> 'files') = actual_file_count
      and not exists (
        select 1
        from public.academy_curriculum_staged_release_artifacts as artifact
        where artifact.staging_id = p_staging_id
          and not exists (
            select 1 from jsonb_array_elements(candidate.manifest -> 'files') as file
            where file ->> 'relativePath' = artifact.relative_path
              and file ->> 'byteCount' = artifact.byte_count::text
              and file ->> 'sha256' = artifact.sha256
          )
      )
      and not exists (
        select 1 from jsonb_array_elements(candidate.manifest -> 'files') as file
        where not exists (
          select 1
          from public.academy_curriculum_staged_release_artifacts as artifact
          where artifact.staging_id = p_staging_id
            and artifact.relative_path = file ->> 'relativePath'
            and artifact.byte_count::text = file ->> 'byteCount'
            and artifact.sha256 = file ->> 'sha256'
        )
      )
    into manifest_files_complete;
  end if;

  select jsonb_typeof(candidate.entity_counts) = 'object'
    and not exists (
      select 1 from jsonb_each(candidate.entity_counts) as entry
      where jsonb_typeof(entry.value) <> 'number'
        or entry.value::text !~ '^[0-9]+$'
        or (entry.value::text)::numeric > 1000000
    )
  into entity_counts_valid;

  manifest_identity_verified :=
    candidate.manifest_canonical::jsonb = candidate.manifest
    and candidate.manifest ->> 'packageFormat' = 'manuel-academy-curriculum-staged-v1'
    and candidate.manifest #>> '{releaseIdentity,packageId}' ~ '^[a-z0-9][a-z0-9-]{0,119}$'
    and candidate.manifest #>> '{releaseIdentity,version}' = candidate.target_version
    and candidate.manifest ->> 'baseReleaseVersion' = (
      select release.version from public.academy_curriculum_releases as release
      where release.release_id = candidate.base_release_id
    )
    and candidate.manifest ->> 'targetVersion' = candidate.target_version
    and candidate.manifest ->> 'schemaSetVersion' = candidate.schema_set_version
    and candidate.manifest #>> '{draft,id}' = candidate.draft_id::text
    and candidate.manifest #>> '{draft,revision}' = candidate.draft_revision::text
    and candidate.manifest #>> '{validation,id}' = candidate.validation_snapshot_id::text
    and candidate.manifest #>> '{validation,resultDigest}' = candidate.validation_result_sha256
    and candidate.manifest #>> '{approval,id}' = candidate.approval_id::text
    and candidate.manifest ->> 'contentHash' = candidate.content_sha256
    and candidate.manifest ->> 'fileCount' = candidate.file_count::text
    and candidate.manifest ->> 'byteCount' = candidate.byte_count::text
    and candidate.manifest -> 'entityCounts' = candidate.entity_counts
    and entity_counts_valid;

  return jsonb_build_object(
    'artifactSetComplete', coalesce(
      actual_file_count = candidate.file_count
      and actual_byte_count = candidate.byte_count
      and artifacts_hashed, false),
    'contentVerified', coalesce(computed_content_sha256 = candidate.content_sha256, false),
    'manifestVerified', coalesce(
      manifest_files_complete and manifest_identity_verified
      and computed_manifest_sha256 = candidate.manifest_sha256, false),
    'packageVerified', coalesce(computed_package_sha256 = candidate.package_sha256, false),
    'actualFileCount', actual_file_count,
    'actualByteCount', actual_byte_count
  );
exception when others then
  return jsonb_build_object(
    'artifactSetComplete', false,
    'contentVerified', false,
    'manifestVerified', false,
    'packageVerified', false,
    'actualFileCount', actual_file_count,
    'actualByteCount', actual_byte_count
  );
end;
$$;

create function academy_private.curriculum_publication_status_projection(p_draft_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  draft_row public.academy_curriculum_drafts%rowtype;
  candidate public.academy_curriculum_staged_releases%rowtype;
  release_row public.academy_curriculum_releases%rowtype;
  validation_row public.academy_curriculum_draft_validation_snapshots%rowtype;
  latest_validation_row public.academy_curriculum_draft_validation_snapshots%rowtype;
  latest_approval_id uuid;
  gate jsonb;
  verification jsonb;
  reasons jsonb := '[]'::jsonb;
  identity_current boolean := false;
  validation_ready boolean := false;
  human_review_clear boolean := false;
  approval_current boolean := false;
  target_available boolean := false;
  eligible boolean := false;
  publication_state text;
begin
  select * into draft_row
  from public.academy_curriculum_drafts
  where draft_id = p_draft_id;
  if draft_row.draft_id is null then
    raise exception 'CURRICULUM_PUBLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into candidate
  from public.academy_curriculum_staged_releases
  where draft_id = p_draft_id
  order by draft_revision desc
  limit 1;

  if candidate.staging_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'draftId', draft_row.draft_id,
      'draftRevision', draft_row.revision,
      'baseReleaseVersion', (
        select version from public.academy_curriculum_releases
        where release_id = draft_row.base_release_id
      ),
      'targetVersion', draft_row.target_version,
      'schemaSetVersion', draft_row.authoring_schema_version,
      'publicationState', 'not_staged',
      'eligible', false,
      'blockingReasons', jsonb_build_array('staged_candidate_missing'),
      'candidate', null,
      'published', null
    );
  end if;

  select * into release_row
  from public.academy_curriculum_releases
  where staging_id = candidate.staging_id;
  verification := academy_private.curriculum_publication_verification(candidate.staging_id);

  select * into validation_row
  from public.academy_curriculum_draft_validation_snapshots
  where validation_snapshot_id = candidate.validation_snapshot_id;
  select * into latest_validation_row
  from public.academy_curriculum_draft_validation_snapshots
  where draft_id = candidate.draft_id and draft_revision = candidate.draft_revision
  order by validation_sequence desc
  limit 1;
  select approval_id into latest_approval_id
  from public.academy_curriculum_draft_approval_decisions
  where draft_id = candidate.draft_id and draft_revision = candidate.draft_revision
  order by decision_sequence desc
  limit 1;

  identity_current :=
    candidate.status = 'staged'
    and draft_row.lifecycle_state = 'draft'
    and draft_row.revision = candidate.draft_revision
    and draft_row.base_release_id = candidate.base_release_id
    and draft_row.target_version = candidate.target_version
    and draft_row.authoring_schema_version = candidate.schema_set_version;
  validation_ready :=
    validation_row.validation_snapshot_id = candidate.validation_snapshot_id
    and validation_row.draft_id = candidate.draft_id
    and validation_row.draft_revision = candidate.draft_revision
    and validation_row.base_release_id = candidate.base_release_id
    and validation_row.target_version = candidate.target_version
    and validation_row.schema_set_version = candidate.schema_set_version
    and validation_row.result_sha256 = candidate.validation_result_sha256
    and validation_row.validation_status = 'valid'
    and validation_row.publication_ready
    and validation_row.blocking_count = 0
    and validation_row.blocking_error_count = 0
    and latest_validation_row.validation_snapshot_id is not null
    and latest_validation_row.validation_status = 'valid'
    and latest_validation_row.publication_ready
    and latest_validation_row.blocking_count = 0
    and latest_validation_row.blocking_error_count = 0;
  human_review_clear := validation_row.validation_snapshot_id is not null
    and validation_row.human_review_blocker_count = 0
    and latest_validation_row.validation_snapshot_id is not null
    and latest_validation_row.human_review_blocker_count = 0;
  gate := academy_private.curriculum_approval_publish_gate_v1(
    candidate.draft_id, candidate.draft_revision
  );
  approval_current :=
    coalesce((gate ->> 'eligible')::boolean, false)
    and gate ->> 'approvalId' = candidate.approval_id::text
    and gate ->> 'validationSnapshotId' = candidate.validation_snapshot_id::text
    and latest_validation_row.validation_snapshot_id = candidate.validation_snapshot_id
    and latest_approval_id = candidate.approval_id;
  target_available := not exists (
    select 1 from public.academy_curriculum_releases
    where version = candidate.target_version
  );

  if release_row.release_id is null then
    if not identity_current then reasons := reasons || jsonb_build_array('staging_identity_mismatch'); end if;
    if coalesce((verification ->> 'artifactSetComplete')::boolean, false) is false then
      reasons := reasons || jsonb_build_array('artifact_set_incomplete');
    end if;
    if coalesce((verification ->> 'contentVerified')::boolean, false) is false then
      reasons := reasons || jsonb_build_array('artifact_tampered');
    end if;
    if coalesce((verification ->> 'manifestVerified')::boolean, false) is false then
      reasons := reasons || jsonb_build_array('manifest_mismatch');
    end if;
    if coalesce((verification ->> 'packageVerified')::boolean, false) is false then
      reasons := reasons || jsonb_build_array('package_mismatch');
    end if;
    if not validation_ready then reasons := reasons || jsonb_build_array('validation_blocked'); end if;
    if not human_review_clear then reasons := reasons || jsonb_build_array('human_review_blocked'); end if;
    if validation_ready and human_review_clear and not approval_current then
      reasons := reasons || jsonb_build_array('approval_stale');
    end if;
    if not target_available then reasons := reasons || jsonb_build_array('target_version_collision'); end if;
  end if;

  eligible := release_row.release_id is null and jsonb_array_length(reasons) = 0;
  publication_state := case
    when release_row.release_id is not null then 'published'
    when eligible then 'eligible'
    else 'blocked'
  end;

  return jsonb_build_object(
    'schemaVersion', 1,
    'draftId', candidate.draft_id,
    'draftRevision', candidate.draft_revision,
    'baseReleaseVersion', (
      select version from public.academy_curriculum_releases
      where release_id = candidate.base_release_id
    ),
    'targetVersion', candidate.target_version,
    'schemaSetVersion', candidate.schema_set_version,
    'publicationState', publication_state,
    'eligible', eligible,
    'blockingReasons', reasons,
    'candidate', jsonb_build_object(
      'stagingId', candidate.staging_id,
      'status', 'staged',
      'draftRevision', candidate.draft_revision,
      'validationSnapshotId', candidate.validation_snapshot_id,
      'validationStatus', case when validation_ready then 'publication_ready' else 'blocked' end,
      'approvalId', candidate.approval_id,
      'approvalStatus', case when approval_current then 'current' else 'stale' end,
      'humanReviewStatus', case when human_review_clear then 'clear' else 'blocked' end,
      'fileCount', candidate.file_count,
      'byteCount', candidate.byte_count,
      'contentHash', candidate.content_sha256,
      'manifestHash', candidate.manifest_sha256,
      'packageHash', candidate.package_sha256,
      'verification', verification
    ),
    'published', case when release_row.release_id is null then null else jsonb_build_object(
      'releaseId', release_row.release_id,
      'version', release_row.version,
      'status', 'published',
      'activationStatus', 'not_active',
      'stagingId', release_row.staging_id,
      'contentHash', release_row.publication_content_sha256,
      'manifestHash', release_row.publication_manifest_sha256,
      'packageHash', release_row.publication_package_sha256,
      'fileCount', release_row.file_count,
      'byteCount', release_row.byte_count,
      'publishedAt', to_char(release_row.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'authority', 'curriculum:publish'
    ) end
  );
end;
$$;

create function academy_private.curriculum_publication_append_audit(
  p_actor_user_ref uuid,
  p_staging_id uuid,
  p_target_version text,
  p_draft_revision bigint,
  p_manifest_sha256 text,
  p_package_sha256 text,
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
    'academy_principal_kind', 'admin_curriculum_publication_server'
  )::text, true);
  begin
    event_id := academy_private.append_admin_audit_event_v1(
      'curriculum.publish', 'curriculum_release', p_staging_id::text,
      p_target_version, p_draft_revision::text,
      jsonb_build_object(
        'state', 'staged', 'status', 'verified', 'revision', p_draft_revision,
        'release', p_target_version, 'value', p_staging_id
      ),
      jsonb_build_object(
        'state', 'published', 'status', 'not_active', 'revision', p_draft_revision,
        'release', p_target_version, 'version', p_manifest_sha256,
        'value', p_package_sha256
      ),
      'curriculum.published', p_correlation_id
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

create function public.academy_admin_read_curriculum_publication_v1(
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
  perform academy_private.curriculum_publication_require_actor(
    p_actor_user_ref, p_required_capability
  );
  return academy_private.curriculum_publication_status_projection(p_draft_id);
end;
$$;

create function public.academy_admin_publish_curriculum_release_v1(
  p_actor_user_ref uuid,
  p_staging_id uuid,
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
  candidate public.academy_curriculum_staged_releases%rowtype;
  existing_release public.academy_curriculum_releases%rowtype;
  receipt academy_private.curriculum_publication_request_receipts%rowtype;
  status_projection jsonb;
  response jsonb;
begin
  perform academy_private.curriculum_publication_require_actor(
    p_actor_user_ref, p_required_capability
  );
  if p_staging_id is null or p_request_id is null
     or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'CURRICULUM_PUBLICATION_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'curriculum-publication-request:' || p_actor_user_ref::text || ':' || p_request_id::text, 0
  ));
  select * into receipt
  from academy_private.curriculum_publication_request_receipts
  where actor_user_ref = p_actor_user_ref and request_id = p_request_id
  for update;
  if receipt.request_id is not null then
    if receipt.request_sha256 <> p_request_digest
       or receipt.staging_id <> p_staging_id then
      raise exception 'CURRICULUM_PUBLICATION_REPLAY_CONFLICT' using errcode = '40001';
    end if;
    return receipt.response || jsonb_build_object('replayed', true);
  end if;

  select * into candidate
  from public.academy_curriculum_staged_releases
  where staging_id = p_staging_id
  for update;
  if candidate.staging_id is null then
    raise exception 'CURRICULUM_PUBLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'curriculum-publication-target:' || candidate.target_version, 0
  ));

  select * into existing_release
  from public.academy_curriculum_releases
  where version = candidate.target_version;
  if existing_release.release_id is not null then
    if existing_release.staging_id is distinct from candidate.staging_id
       or existing_release.publication_package_sha256 is distinct from candidate.package_sha256 then
      raise exception 'CURRICULUM_PUBLICATION_TARGET_COLLISION' using errcode = '23505';
    end if;
    response := academy_private.curriculum_publication_status_projection(candidate.draft_id);
    insert into academy_private.curriculum_publication_request_receipts (
      actor_user_ref, request_id, request_sha256, staging_id, release_id, response
    ) values (
      p_actor_user_ref, p_request_id, p_request_digest, p_staging_id,
      existing_release.release_id, response
    );
    return response || jsonb_build_object('replayed', true);
  end if;

  status_projection := academy_private.curriculum_publication_status_projection(candidate.draft_id);
  if coalesce((status_projection ->> 'eligible')::boolean, false) is false then
    if status_projection -> 'blockingReasons' ? 'staging_identity_mismatch' then
      raise exception 'CURRICULUM_PUBLICATION_REVISION_CONFLICT' using errcode = '40001';
    elsif status_projection -> 'blockingReasons' ? 'artifact_set_incomplete'
       or status_projection -> 'blockingReasons' ? 'artifact_tampered' then
      raise exception 'CURRICULUM_PUBLICATION_ARTIFACT_INVALID' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'manifest_mismatch' then
      raise exception 'CURRICULUM_PUBLICATION_MANIFEST_MISMATCH' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'package_mismatch' then
      raise exception 'CURRICULUM_PUBLICATION_PACKAGE_MISMATCH' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'human_review_blocked' then
      raise exception 'CURRICULUM_PUBLICATION_HUMAN_REVIEW_BLOCKED' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'validation_blocked' then
      raise exception 'CURRICULUM_PUBLICATION_VALIDATION_BLOCKED' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'approval_stale' then
      raise exception 'CURRICULUM_PUBLICATION_APPROVAL_STALE' using errcode = '55000';
    elsif status_projection -> 'blockingReasons' ? 'target_version_collision' then
      raise exception 'CURRICULUM_PUBLICATION_TARGET_COLLISION' using errcode = '23505';
    else
      raise exception 'CURRICULUM_PUBLICATION_GATE_BLOCKED' using errcode = '55000';
    end if;
  end if;

  insert into public.academy_curriculum_releases (
    release_id, package_id, version, status, registered_at, authored_on,
    provenance_class, source_commit, source_root,
    package_manifest_sha256, checksum_manifest_sha256,
    curriculum_manifest_sha256, file_inventory_sha256,
    file_count, byte_count,
    course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
    grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
    grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
    grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
    grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
    grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
    grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count,
    staging_id, published_by, publication_content_sha256,
    publication_manifest_sha256, publication_package_sha256
  ) values (
    candidate.staging_id,
    candidate.manifest #>> '{releaseIdentity,packageId}',
    candidate.target_version, 'published', statement_timestamp(), null,
    'staged_publish', null, null,
    null, null, null, null,
    candidate.file_count, candidate.byte_count,
    coalesce((candidate.entity_counts ->> 'courses')::integer, 0),
    coalesce((candidate.entity_counts ->> 'units')::integer, 0),
    coalesce((candidate.entity_counts ->> 'lessons')::integer, 0),
    coalesce((candidate.entity_counts ->> 'assessments')::integer, 0),
    coalesce((candidate.entity_counts ->> 'resources')::integer, 0),
    coalesce((candidate.entity_counts ->> 'schedules')::integer, 0),
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    candidate.staging_id, p_actor_user_ref, candidate.content_sha256,
    candidate.manifest_sha256, candidate.package_sha256
  );

  insert into public.academy_curriculum_release_files (
    release_id, relative_path, byte_count, sha256, content_type,
    safe_classification, immutable_locator, content, canonical_content
  )
  select
    candidate.staging_id, artifact.relative_path, artifact.byte_count,
    artifact.sha256, 'application/json', 'immutable_embedded_json',
    'curriculum_registry:' || candidate.staging_id::text || ':' || artifact.relative_path,
    artifact.content, artifact.canonical_content
  from public.academy_curriculum_staged_release_artifacts as artifact
  where artifact.staging_id = candidate.staging_id
  order by artifact.relative_path;

  perform academy_private.curriculum_publication_append_audit(
    p_actor_user_ref, candidate.staging_id, candidate.target_version,
    candidate.draft_revision, candidate.manifest_sha256,
    candidate.package_sha256, p_request_id
  );

  response := academy_private.curriculum_publication_status_projection(candidate.draft_id);
  if response ->> 'publicationState' <> 'published'
     or response #>> '{published,activationStatus}' <> 'not_active' then
    raise exception 'CURRICULUM_PUBLICATION_ATOMIC_FAILURE' using errcode = '55000';
  end if;
  insert into academy_private.curriculum_publication_request_receipts (
    actor_user_ref, request_id, request_sha256, staging_id, release_id, response
  ) values (
    p_actor_user_ref, p_request_id, p_request_digest, candidate.staging_id,
    candidate.staging_id, response
  );
  return response || jsonb_build_object('replayed', false);
end;
$$;

-- Keep the staging view truthful after publication without mutating immutable
-- staging rows.
create or replace function academy_private.curriculum_staging_candidate_projection(p_staging_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'stagingId', candidate.staging_id,
    'status', 'staged',
    'publicationStatus', case when exists (
      select 1 from public.academy_curriculum_releases as release
      where release.staging_id = candidate.staging_id
    ) then 'published' else 'not_published' end,
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

-- Registry reads support both provenance classes while exposing metadata only.
create or replace function public.academy_admin_list_curriculum_releases_v1(
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
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
  from public.academy_curriculum_releases as release;
  return projection;
end;
$$;

create or replace function public.academy_admin_read_curriculum_release_v1(
  p_version text,
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;
  if p_version is null or p_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$' then
    raise exception 'A canonical curriculum release version is required';
  end if;
  select jsonb_build_object(
    'schemaVersion', 1,
    'packageId', release.package_id,
    'version', release.version,
    'status', release.status,
    'registeredAt', to_char(release.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'authoredOn', to_char(release.authored_on, 'YYYY-MM-DD'),
    'provenanceClass', release.provenance_class,
    'sourceCommit', release.source_commit,
    'sourceRoot', release.source_root,
    'stagingId', release.staging_id,
    'digests', jsonb_build_object(
      'packageManifestSha256', coalesce(release.package_manifest_sha256, release.publication_manifest_sha256),
      'checksumManifestSha256', coalesce(release.checksum_manifest_sha256, release.publication_package_sha256),
      'curriculumManifestSha256', coalesce(release.curriculum_manifest_sha256, release.publication_content_sha256),
      'fileInventorySha256', coalesce(release.file_inventory_sha256, release.publication_content_sha256)
    ),
    'publicationEvidence', case when release.provenance_class <> 'staged_publish' then null
      else jsonb_build_object(
        'stagingId', release.staging_id,
        'contentHash', release.publication_content_sha256,
        'manifestHash', release.publication_manifest_sha256,
        'packageHash', release.publication_package_sha256,
        'activationStatus', 'not_active'
      ) end,
    'fileCount', release.file_count,
    'byteCount', release.byte_count,
    'counts', jsonb_build_object(
      'courses', release.course_count, 'units', release.unit_count,
      'lessons', release.lesson_count, 'assessments', release.assessment_count,
      'texts', release.text_count, 'schedules', release.schedule_count
    ),
    'gradeCounts', jsonb_build_object(
      '5', jsonb_build_object(
        'courses', release.grade_5_course_count, 'units', release.grade_5_unit_count,
        'lessons', release.grade_5_lesson_count, 'assessments', release.grade_5_assessment_count,
        'texts', release.grade_5_text_count, 'schedules', release.grade_5_schedule_count
      ),
      '7', jsonb_build_object(
        'courses', release.grade_7_course_count, 'units', release.grade_7_unit_count,
        'lessons', release.grade_7_lesson_count, 'assessments', release.grade_7_assessment_count,
        'texts', release.grade_7_text_count, 'schedules', release.grade_7_schedule_count
      ),
      '8', jsonb_build_object(
        'courses', release.grade_8_course_count, 'units', release.grade_8_unit_count,
        'lessons', release.grade_8_lesson_count, 'assessments', release.grade_8_assessment_count,
        'texts', release.grade_8_text_count, 'schedules', release.grade_8_schedule_count
      )
    ),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', file.relative_path, 'byteCount', file.byte_count,
        'sha256', file.sha256, 'contentType', file.content_type,
        'safeClassification', file.safe_classification,
        'immutableLocator', file.immutable_locator
      ) order by file.relative_path)
      from public.academy_curriculum_release_files as file
      where file.release_id = release.release_id
    ), '[]'::jsonb)
  ) into projection
  from public.academy_curriculum_releases as release
  where release.version = p_version;
  return projection;
end;
$$;

revoke all on table academy_private.curriculum_publication_request_receipts
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_publication_require_actor(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_publication_verification(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_publication_status_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_publication_append_audit(uuid, uuid, text, bigint, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_publication_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_publish_curriculum_release_v1(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_curriculum_publication_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_publish_curriculum_release_v1(uuid, uuid, uuid, text, text)
  to service_role;

comment on column public.academy_curriculum_releases.staging_id is
  'Exact immutable staging evidence for a staged_publish release; null for legacy imports.';
comment on column public.academy_curriculum_release_files.canonical_content is
  'Exact immutable published JSON bytes for staged_publish artifacts; null for legacy inventory.';
comment on function public.academy_admin_publish_curriculum_release_v1(uuid, uuid, uuid, text, text) is
  'Service-only curriculum:publish transaction. Publishes exact staged bytes and never activates.';

commit;
