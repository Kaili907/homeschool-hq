-- Red-team hardening: make each privileged Curriculum write independently
-- revalidate the current database role at its state-change linearization point.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum write reauthorization migration must run as postgres';
  end if;
  if to_regprocedure(
       'academy_private.curriculum_authoring_require_actor(uuid,text,boolean)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_collaboration_require_actor(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_standard_review_require_actor(uuid,text)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_approval_require_actor(uuid,text)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_staging_require_actor(uuid,text)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_publication_require_actor(uuid,text)'
     ) is null
     or to_regprocedure(
       'academy_private.curriculum_pointer_require_actor(uuid,text)'
     ) is null then
    raise exception 'Academy curriculum write reauthorization prerequisites are unavailable';
  end if;
end;
$$;

create function academy_private.curriculum_reauthorize_privileged_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid;
  staged_by_user uuid;
  staged_draft_id uuid;
  published_by_user uuid;
  release_provenance text;
begin
  if tg_relid = 'public.academy_curriculum_drafts'::regclass then
    perform academy_private.curriculum_authoring_require_actor(
      new.created_by, 'curriculum:drafts:write', true
    );
  elsif tg_relid = 'public.academy_curriculum_draft_entities'::regclass then
    actor_user := case when tg_op = 'INSERT' then new.created_by else new.updated_by end;
    perform academy_private.curriculum_collaboration_require_actor(
      actor_user, new.draft_id, 'editor'
    );
  elsif tg_relid = 'public.academy_curriculum_draft_collaborators'::regclass then
    actor_user := case when tg_op = 'INSERT' then new.assigned_by else new.revoked_by end;
    perform academy_private.curriculum_authoring_require_actor(
      actor_user, 'curriculum:drafts:write', true
    );
    if tg_op = 'INSERT' and not exists (
      select 1
      from public.academy_curriculum_draft_collaborators as collaborator
      where collaborator.draft_id = new.draft_id
    ) then
      if new.principal_user_ref is distinct from actor_user
         or new.responsibility <> 'editor'
         or not exists (
           select 1
           from public.academy_curriculum_drafts as draft
           where draft.draft_id = new.draft_id
             and draft.created_by = actor_user
             and draft.create_request_id = new.assignment_request_id
         ) then
        raise exception 'CURRICULUM_COLLABORATION_REQUIRED' using errcode = '42501';
      end if;
    else
      perform academy_private.curriculum_collaboration_require_actor(
        actor_user, new.draft_id, 'editor'
      );
    end if;
  elsif tg_relid = 'public.academy_curriculum_standard_reviews'::regclass then
    if new.context_kind = 'draft' then
      perform academy_private.curriculum_collaboration_require_actor(
        new.updated_by, new.context_ref::uuid, 'editor'
      );
    end if;
    perform academy_private.curriculum_standard_review_require_actor(
      new.updated_by,
      case when new.status = 'approved_mapping'
        then 'curriculum:approve' else 'curriculum:drafts:write' end
    );
  elsif tg_relid = 'public.academy_curriculum_draft_validation_snapshots'::regclass then
    perform academy_private.curriculum_collaboration_require_actor(
      new.validated_by, new.draft_id, 'editor'
    );
  elsif tg_relid = 'public.academy_curriculum_draft_approval_decisions'::regclass then
    perform academy_private.curriculum_collaboration_require_actor(
      new.decided_by, new.draft_id, 'editor'
    );
    perform academy_private.curriculum_approval_require_actor(
      new.decided_by, 'curriculum:approve'
    );
  elsif tg_relid = 'public.academy_curriculum_staged_releases'::regclass then
    perform academy_private.curriculum_collaboration_require_actor(
      new.staged_by, new.draft_id, 'editor'
    );
    perform academy_private.curriculum_staging_require_actor(
      new.staged_by, 'curriculum:publish'
    );
  elsif tg_relid = 'public.academy_curriculum_staged_release_artifacts'::regclass then
    select candidate.staged_by, candidate.draft_id
      into staged_by_user, staged_draft_id
    from public.academy_curriculum_staged_releases as candidate
    where candidate.staging_id = new.staging_id;
    perform academy_private.curriculum_collaboration_require_actor(
      staged_by_user, staged_draft_id, 'editor'
    );
    perform academy_private.curriculum_staging_require_actor(
      staged_by_user, 'curriculum:publish'
    );
  elsif tg_relid = 'public.academy_curriculum_releases'::regclass then
    perform academy_private.curriculum_publication_require_actor(
      new.published_by, 'curriculum:publish'
    );
  elsif tg_relid = 'public.academy_curriculum_release_files'::regclass then
    select release.published_by, release.provenance_class
      into published_by_user, release_provenance
    from public.academy_curriculum_releases as release
    where release.release_id = new.release_id;
    if release_provenance <> 'staged_publish' then
      raise exception 'CURRICULUM_PUBLICATION_REQUIRED' using errcode = '42501';
    end if;
    perform academy_private.curriculum_publication_require_actor(
      published_by_user, 'curriculum:publish'
    );
  elsif tg_relid = 'public.academy_curriculum_pointer_transitions'::regclass then
    if new.transition_kind in ('activation', 'rollback') then
      perform academy_private.curriculum_pointer_require_actor(
        new.actor_user_ref, 'releases:manage'
      );
    end if;
  else
    raise exception 'CURRICULUM_WRITE_REAUTHORIZATION_TARGET_INVALID'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

alter function academy_private.curriculum_reauthorize_privileged_write()
  owner to postgres;
revoke all on function academy_private.curriculum_reauthorize_privileged_write()
  from public, anon, authenticated, service_role;

create trigger academy_curriculum_drafts_reauthorize_insert
  before insert on public.academy_curriculum_drafts
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_draft_entities_reauthorize_write
  before insert or update on public.academy_curriculum_draft_entities
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_draft_collaborators_reauthorize_write
  before insert or update on public.academy_curriculum_draft_collaborators
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_standard_reviews_reauthorize_write
  before insert or update on public.academy_curriculum_standard_reviews
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_validation_snapshots_reauthorize_insert
  before insert on public.academy_curriculum_draft_validation_snapshots
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_approval_decisions_reauthorize_insert
  before insert on public.academy_curriculum_draft_approval_decisions
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_staged_releases_reauthorize_insert
  before insert on public.academy_curriculum_staged_releases
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_staged_artifacts_reauthorize_insert
  before insert on public.academy_curriculum_staged_release_artifacts
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_releases_reauthorize_insert
  before insert on public.academy_curriculum_releases
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_release_files_reauthorize_insert
  before insert on public.academy_curriculum_release_files
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();
create trigger academy_curriculum_pointer_transitions_reauthorize_insert
  before insert on public.academy_curriculum_pointer_transitions
  for each row execute function
    academy_private.curriculum_reauthorize_privileged_write();

comment on function academy_private.curriculum_reauthorize_privileged_write() is
  'Ungrantable trigger boundary that revalidates the current Curriculum actor and exact capability at every privileged state write.';

commit;
