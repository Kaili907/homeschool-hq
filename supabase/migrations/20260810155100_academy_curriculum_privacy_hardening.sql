-- Defense in depth for draft-scoped pre-publish workflow RPCs.
-- Global curriculum capability is necessary but never sufficient for a draft:
-- reads require an active collaborator assignment and mutations require editor.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'migration must run as postgres';
  end if;
end;
$$;

alter function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text)
  rename to academy_admin_list_curriculum_standard_reviews_unscoped_v1;
alter function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) rename to academy_admin_update_curriculum_standard_review_unscoped_v1;
alter function public.academy_admin_record_curriculum_validation_v1(
  uuid, uuid, bigint, text, text, text, boolean, integer, integer, integer, text
) rename to academy_admin_record_curriculum_validation_unscoped_v1;
alter function public.academy_admin_read_curriculum_approval_v1(uuid, uuid, text)
  rename to academy_admin_read_curriculum_approval_unscoped_v1;
alter function public.academy_admin_decide_curriculum_approval_v1(
  uuid, uuid, bigint, text, text, uuid, uuid, text, text
) rename to academy_admin_decide_curriculum_approval_unscoped_v1;
alter function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text)
  rename to academy_admin_read_curriculum_staging_unscoped_v1;
alter function public.academy_admin_stage_curriculum_release_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) rename to academy_admin_stage_curriculum_release_unscoped_v1;

create function public.academy_admin_list_curriculum_standard_reviews_v1(
  p_actor_user_ref uuid,
  p_context_kind text,
  p_context_ref text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if p_context_kind = 'draft' then
    if p_context_ref is null
       or p_context_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
    end if;
    perform academy_private.curriculum_collaboration_require_actor(
      p_actor_user_ref, p_context_ref::uuid, null
    );
  end if;
  return public.academy_admin_list_curriculum_standard_reviews_unscoped_v1(
    p_actor_user_ref, p_context_kind, p_context_ref, p_required_capability
  );
end;
$$;

create function public.academy_admin_update_curriculum_standard_review_v1(
  p_actor_user_ref uuid,
  p_review_key text,
  p_context_kind text,
  p_context_ref text,
  p_source_label text,
  p_grade smallint,
  p_course_ref text,
  p_finding_rule text,
  p_finding_ids text[],
  p_affected_count integer,
  p_status text,
  p_canonical_standard_id text,
  p_framework_version text,
  p_canonical_title text,
  p_evidence_source text,
  p_reviewer_note text,
  p_expected_revision bigint,
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
begin
  if p_context_kind = 'draft' then
    if p_context_ref is null
       or p_context_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'CURRICULUM_STANDARDS_REVIEW_INPUT_INVALID' using errcode = '22023';
    end if;
    perform academy_private.curriculum_collaboration_require_actor(
      p_actor_user_ref, p_context_ref::uuid, 'editor'
    );
  end if;
  return public.academy_admin_update_curriculum_standard_review_unscoped_v1(
    p_actor_user_ref, p_review_key, p_context_kind, p_context_ref, p_source_label,
    p_grade, p_course_ref, p_finding_rule, p_finding_ids, p_affected_count,
    p_status, p_canonical_standard_id, p_framework_version, p_canonical_title,
    p_evidence_source, p_reviewer_note, p_expected_revision, p_request_id,
    p_request_digest, p_required_capability
  );
end;
$$;

create function public.academy_admin_record_curriculum_validation_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_draft_revision bigint,
  p_engine_version text,
  p_result_digest text,
  p_status text,
  p_publication_ready boolean,
  p_blocking_count integer,
  p_blocking_error_count integer,
  p_human_review_blocker_count integer,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, 'editor'
  );
  return public.academy_admin_record_curriculum_validation_unscoped_v1(
    p_actor_user_ref, p_draft_id, p_draft_revision, p_engine_version,
    p_result_digest, p_status, p_publication_ready, p_blocking_count,
    p_blocking_error_count, p_human_review_blocker_count, p_required_capability
  );
end;
$$;

create function public.academy_admin_read_curriculum_approval_v1(
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
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  return public.academy_admin_read_curriculum_approval_unscoped_v1(
    p_actor_user_ref, p_draft_id, p_required_capability
  );
end;
$$;

create function public.academy_admin_decide_curriculum_approval_v1(
  p_actor_user_ref uuid,
  p_draft_id uuid,
  p_draft_revision bigint,
  p_decision text,
  p_reason_code text,
  p_validation_snapshot_id uuid,
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
begin
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, 'editor'
  );
  return public.academy_admin_decide_curriculum_approval_unscoped_v1(
    p_actor_user_ref, p_draft_id, p_draft_revision, p_decision, p_reason_code,
    p_validation_snapshot_id, p_request_id, p_request_digest, p_required_capability
  );
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
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, null
  );
  return public.academy_admin_read_curriculum_staging_unscoped_v1(
    p_actor_user_ref, p_draft_id, p_required_capability
  );
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
begin
  perform academy_private.curriculum_collaboration_require_actor(
    p_actor_user_ref, p_draft_id, 'editor'
  );
  return public.academy_admin_stage_curriculum_release_unscoped_v1(
    p_actor_user_ref, p_draft_id, p_draft_revision, p_validation_snapshot_id,
    p_approval_id, p_manifest, p_manifest_canonical, p_artifacts,
    p_content_sha256, p_manifest_sha256, p_package_sha256, p_request_id,
    p_request_digest, p_required_capability
  );
end;
$$;

alter function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text) owner to postgres;
alter function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) owner to postgres;
alter function public.academy_admin_record_curriculum_validation_v1(
  uuid, uuid, bigint, text, text, text, boolean, integer, integer, integer, text
) owner to postgres;
alter function public.academy_admin_read_curriculum_approval_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_decide_curriculum_approval_v1(
  uuid, uuid, bigint, text, text, uuid, uuid, text, text
) owner to postgres;
alter function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text) owner to postgres;
alter function public.academy_admin_stage_curriculum_release_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) owner to postgres;

revoke all on function public.academy_admin_list_curriculum_standard_reviews_unscoped_v1(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_update_curriculum_standard_review_unscoped_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_record_curriculum_validation_unscoped_v1(
  uuid, uuid, bigint, text, text, text, boolean, integer, integer, integer, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_approval_unscoped_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_decide_curriculum_approval_unscoped_v1(
  uuid, uuid, bigint, text, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_staging_unscoped_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_stage_curriculum_release_unscoped_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_record_curriculum_validation_v1(
  uuid, uuid, bigint, text, text, text, boolean, integer, integer, integer, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_approval_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_decide_curriculum_approval_v1(
  uuid, uuid, bigint, text, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_stage_curriculum_release_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_list_curriculum_standard_reviews_v1(uuid, text, text, text)
  to service_role;
grant execute on function public.academy_admin_update_curriculum_standard_review_v1(
  uuid, text, text, text, text, smallint, text, text, text[], integer, text,
  text, text, text, text, text, bigint, uuid, text, text
) to service_role;
grant execute on function public.academy_admin_record_curriculum_validation_v1(
  uuid, uuid, bigint, text, text, text, boolean, integer, integer, integer, text
) to service_role;
grant execute on function public.academy_admin_read_curriculum_approval_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_decide_curriculum_approval_v1(
  uuid, uuid, bigint, text, text, uuid, uuid, text, text
) to service_role;
grant execute on function public.academy_admin_read_curriculum_staging_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.academy_admin_stage_curriculum_release_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) to service_role;

comment on function public.academy_admin_read_curriculum_approval_v1(uuid, uuid, text) is
  'Service-only approval status projection; requires current draft collaborator assignment.';
comment on function public.academy_admin_stage_curriculum_release_v1(
  uuid, uuid, bigint, uuid, uuid, jsonb, text, jsonb, text, text, text, uuid, text, text
) is 'Service-only staging mutation; requires current draft editor and never publishes or activates.';

commit;
