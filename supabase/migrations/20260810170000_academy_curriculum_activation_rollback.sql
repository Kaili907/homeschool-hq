-- ADMIN-20C: authoritative curriculum default-pointer activation and rollback.
-- Published releases stay immutable. Existing learner release pins are never
-- read or written by this control plane.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum activation migration must run as postgres';
  end if;
end;
$$;

alter table public.academy_curriculum_active_pointers
  drop constraint academy_curriculum_active_pointers_change_kind_check,
  drop constraint academy_curriculum_active_pointers_binding_mode_check;

alter table public.academy_curriculum_active_pointers
  add constraint academy_curriculum_active_pointers_change_kind_check
    check (change_kind in ('migration_seed', 'activation', 'rollback')),
  add constraint academy_curriculum_active_pointers_binding_mode_check
    check (binding_mode in ('registry_only', 'default_authority'));

drop trigger academy_curriculum_active_pointers_immutable
  on public.academy_curriculum_active_pointers;

create table public.academy_curriculum_pointer_transitions (
  transition_id uuid not null,
  environment text not null check (environment ~ '^[a-z][a-z0-9_-]{0,39}$'),
  revision bigint not null check (revision >= 1),
  previous_release_id uuid references public.academy_curriculum_releases (release_id) on delete restrict,
  new_release_id uuid not null references public.academy_curriculum_releases (release_id) on delete restrict,
  transition_kind text not null check (transition_kind in ('migration_seed', 'activation', 'rollback')),
  reason_code text check (
    reason_code is null or reason_code in ('release.activated', 'release.rolled_back')
  ),
  actor_user_ref uuid references auth.users (id) on delete restrict,
  correlation_id uuid,
  request_sha256 text check (request_sha256 is null or request_sha256 ~ '^[0-9a-f]{64}$'),
  transitioned_at timestamptz not null default statement_timestamp(),
  primary key (environment, revision),
  constraint academy_curriculum_pointer_transitions_identity_unique unique (transition_id),
  constraint academy_curriculum_pointer_transitions_request_unique unique (environment, correlation_id),
  constraint academy_curriculum_pointer_transitions_shape_check check (
    (
      transition_kind = 'migration_seed'
      and revision = 1
      and previous_release_id is null
      and reason_code is null
      and actor_user_ref is null
      and correlation_id is null
      and request_sha256 is null
    )
    or (
      transition_kind in ('activation', 'rollback')
      and revision > 1
      and previous_release_id is not null
      and previous_release_id <> new_release_id
      and reason_code = case transition_kind
        when 'activation' then 'release.activated'
        else 'release.rolled_back'
      end
      and actor_user_ref is not null
      and correlation_id is not null
      and request_sha256 is not null
    )
  )
);

create table academy_private.curriculum_pointer_request_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  transition_id uuid,
  response jsonb not null check (
    jsonb_typeof(response) = 'object' and pg_column_size(response) <= 65536
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_user_ref, request_id),
  foreign key (transition_id)
    references public.academy_curriculum_pointer_transitions (transition_id)
    on delete restrict
);

alter table public.academy_curriculum_pointer_transitions owner to postgres;
alter table academy_private.curriculum_pointer_request_receipts owner to postgres;

alter table public.academy_curriculum_pointer_transitions enable row level security;
alter table public.academy_curriculum_pointer_transitions force row level security;
alter table academy_private.curriculum_pointer_request_receipts enable row level security;
alter table academy_private.curriculum_pointer_request_receipts force row level security;

create function academy_private.curriculum_pointer_reject_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy curriculum pointer history is append-only' using errcode = '55000';
end;
$$;

create function academy_private.curriculum_pointer_guard_current()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Academy curriculum current pointer cannot be deleted' using errcode = '55000';
  end if;
  if new.environment is distinct from old.environment
     or new.revision <> old.revision + 1
     or new.release_id = old.release_id
     or new.change_kind not in ('activation', 'rollback')
     or new.binding_mode <> 'default_authority'
     or new.registered_at < old.registered_at then
    raise exception 'Academy curriculum pointer requires a governed forward transition'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

alter function academy_private.curriculum_pointer_reject_history_mutation() owner to postgres;
alter function academy_private.curriculum_pointer_guard_current() owner to postgres;
revoke all on function academy_private.curriculum_pointer_reject_history_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_pointer_guard_current()
  from public, anon, authenticated, service_role;

create trigger academy_curriculum_pointer_transitions_append_only
  before update or delete on public.academy_curriculum_pointer_transitions
  for each row execute function academy_private.curriculum_pointer_reject_history_mutation();
create trigger academy_curriculum_pointer_receipts_immutable
  before update or delete on academy_private.curriculum_pointer_request_receipts
  for each row execute function academy_private.curriculum_pointer_reject_history_mutation();
create trigger academy_curriculum_active_pointers_governed
  before update or delete on public.academy_curriculum_active_pointers
  for each row execute function academy_private.curriculum_pointer_guard_current();

insert into public.academy_curriculum_pointer_transitions (
  transition_id, environment, revision, previous_release_id, new_release_id,
  transition_kind, reason_code, actor_user_ref, correlation_id,
  request_sha256, transitioned_at
)
select
  '17000000-0000-4000-8000-000000000002', pointer.environment,
  pointer.revision, null, pointer.release_id, 'migration_seed', null, null,
  null, null, pointer.registered_at
from public.academy_curriculum_active_pointers as pointer
where pointer.environment = 'production' and pointer.revision = 1;

create function academy_private.admin_frozen_capability_v2(
  p_role text,
  p_capability text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case p_capability
    when 'curriculum:read' then p_role in ('owner', 'admin', 'viewer')
    when 'releases:manage' then p_role in ('owner')
    else false
  end;
$$;

create function academy_private.curriculum_pointer_require_actor(
  p_actor_user_ref uuid,
  p_required_capability text
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_assignment uuid;
begin
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_actor_user_ref is null
     or p_required_capability not in ('curriculum:read', 'releases:manage') then
    raise exception 'CURRICULUM_ACTIVATION_REQUIRED' using errcode = '42501';
  end if;

  select assignment.id into actor_assignment
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = p_actor_user_ref
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
    and academy_private.admin_frozen_capability_v2(
      assignment.role, p_required_capability
    )
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;

  if actor_assignment is null then
    raise exception 'CURRICULUM_ACTIVATION_REQUIRED' using errcode = '42501';
  end if;
  return actor_assignment;
end;
$$;

create function academy_private.curriculum_release_activation_eligible(
  p_release_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.academy_curriculum_releases as release
    where release.release_id = p_release_id
      and release.status = 'published'
      and release.file_count > 0
      and release.byte_count > 0
      and (
        select count(*) from public.academy_curriculum_release_files as file
        where file.release_id = release.release_id
      ) = release.file_count
      and (
        select coalesce(sum(file.byte_count), 0)
        from public.academy_curriculum_release_files as file
        where file.release_id = release.release_id
      ) = release.byte_count
      and (
        (
          release.provenance_class = 'legacy_import'
          and not exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.immutable_locator <> 'git_commit_path:'
                || release.source_commit || ':' || release.source_root || '/'
                || file.relative_path
          )
          and exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.relative_path = 'MANIFEST.json'
              and file.sha256 = release.package_manifest_sha256
          )
          and exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.relative_path = 'SHA256SUMS.txt'
              and file.sha256 = release.checksum_manifest_sha256
          )
          and exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.relative_path = 'curriculum-manifest.json'
              and file.sha256 = release.curriculum_manifest_sha256
          )
          and exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.relative_path = 'validation/manifest-verification.txt'
          )
          and exists (
            select 1 from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and file.relative_path = 'validation/validation.json'
          )
        )
        or (
          release.provenance_class = 'staged_publish'
          and release.release_id = release.staging_id
          and exists (
            select 1
            from public.academy_curriculum_staged_releases as staged
            where staged.staging_id = release.staging_id
              and staged.target_version = release.version
              and staged.file_count = release.file_count
              and staged.byte_count = release.byte_count
              and staged.content_sha256 = release.publication_content_sha256
              and staged.manifest_sha256 = release.publication_manifest_sha256
              and staged.package_sha256 = release.publication_package_sha256
              and academy_private.curriculum_publication_verification(staged.staging_id)
                @> '{"artifactSetComplete":true,"contentVerified":true,"manifestVerified":true,"packageVerified":true}'::jsonb
          )
          and not exists (
            select 1
            from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and (
                file.safe_classification <> 'immutable_embedded_json'
                or file.immutable_locator <> 'curriculum_registry:'
                  || release.staging_id::text || ':' || file.relative_path
                or file.content is null
                or file.canonical_content is null
                or octet_length(file.canonical_content) <> file.byte_count
                or file.canonical_content::jsonb <> file.content
                or encode(
                  sha256(convert_to(file.canonical_content, 'UTF8')), 'hex'
                ) <> file.sha256
              )
          )
          and not exists (
            select 1
            from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
              and not exists (
                select 1
                from public.academy_curriculum_staged_release_artifacts as artifact
                where artifact.staging_id = release.staging_id
                  and artifact.relative_path = file.relative_path
                  and artifact.byte_count = file.byte_count
                  and artifact.sha256 = file.sha256
                  and artifact.content = file.content
                  and artifact.canonical_content = file.canonical_content
              )
          )
          and not exists (
            select 1
            from public.academy_curriculum_staged_release_artifacts as artifact
            where artifact.staging_id = release.staging_id
              and not exists (
                select 1
                from public.academy_curriculum_release_files as file
                where file.release_id = release.release_id
                  and file.relative_path = artifact.relative_path
                  and file.byte_count = artifact.byte_count
                  and file.sha256 = artifact.sha256
                  and file.content = artifact.content
                  and file.canonical_content = artifact.canonical_content
              )
          )
          and (
            select encode(sha256(decode(coalesce(string_agg(
              encode(
                convert_to(file.relative_path, 'UTF8') || decode('00', 'hex') ||
                convert_to(file.byte_count::text, 'UTF8') || decode('00', 'hex') ||
                convert_to(file.sha256, 'UTF8') || convert_to(E'\n', 'UTF8'),
                'hex'
              ), '' order by file.relative_path
            ), ''), 'hex')), 'hex')
            from public.academy_curriculum_release_files as file
            where file.release_id = release.release_id
          ) = release.publication_content_sha256
        )
      )
  );
$$;

create function academy_private.curriculum_pointer_status_projection()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with current_pointer as (
    select pointer.*, release.version as release_version
    from public.academy_curriculum_active_pointers as pointer
    join public.academy_curriculum_releases as release
      on release.release_id = pointer.release_id
    where pointer.environment = 'production'
  ), candidate_rows as (
    select
      release.release_id,
      release.version,
      release.status,
      release.registered_at,
      academy_private.curriculum_release_activation_eligible(release.release_id) as eligible,
      exists (
        select 1
        from public.academy_curriculum_pointer_transitions as transition
        where transition.environment = 'production'
          and transition.new_release_id = release.release_id
      ) as previously_active,
      release.release_id = current_pointer.release_id as active
    from public.academy_curriculum_releases as release
    cross join current_pointer
  ), history_rows as (
    select transition.*,
      previous_release.version as previous_version,
      next_release.version as next_version
    from public.academy_curriculum_pointer_transitions as transition
    left join public.academy_curriculum_releases as previous_release
      on previous_release.release_id = transition.previous_release_id
    join public.academy_curriculum_releases as next_release
      on next_release.release_id = transition.new_release_id
    where transition.environment = 'production'
    order by transition.revision desc
    limit 100
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'environment', 'production',
    'authority', 'default_current_curriculum',
    'existingLearnersRepinned', false,
    'pointer', jsonb_build_object(
      'releaseVersion', current_pointer.release_version,
      'revision', current_pointer.revision,
      'transitionKind', current_pointer.change_kind,
      'bindingMode', current_pointer.binding_mode,
      'transitionedAt', to_char(
        current_pointer.registered_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'releaseVersion', candidate.version,
        'status', candidate.status,
        'registeredAt', to_char(
          candidate.registered_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'artifactState', case when candidate.eligible then 'available' else 'unavailable' end,
        'eligible', candidate.eligible,
        'previouslyActive', candidate.previously_active,
        'active', candidate.active
      ) order by candidate.registered_at desc, candidate.version desc)
      from candidate_rows as candidate
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pointerRevision', history.revision,
        'previousReleaseVersion', history.previous_version,
        'newReleaseVersion', history.next_version,
        'transitionKind', history.transition_kind,
        'reasonCode', history.reason_code,
        'correlationId', history.correlation_id,
        'transitionedAt', to_char(
          history.transitioned_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      ) order by history.revision desc)
      from history_rows as history
    ), '[]'::jsonb),
    'historyTruncated', (
      select count(*) > 100
      from public.academy_curriculum_pointer_transitions as transition
      where transition.environment = 'production'
    )
  )
  from current_pointer;
$$;

create function academy_private.curriculum_pointer_append_audit(
  p_actor_user_ref uuid,
  p_previous_version text,
  p_new_version text,
  p_revision bigint,
  p_transition_kind text,
  p_reason_code text,
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
    'sub', p_actor_user_ref,
    'role', 'authenticated',
    'academy_principal_kind', 'admin_curriculum_pointer_server'
  )::text, true);
  begin
    event_id := academy_private.append_admin_audit_event_v1(
      case p_transition_kind
        when 'activation' then 'release.activate'
        else 'release.rollback'
      end,
      'application_release', 'curriculum:production', p_new_version,
      p_revision::text,
      jsonb_build_object(
        'state', 'active', 'release', p_previous_version,
        'revision', p_revision - 1
      ),
      jsonb_build_object(
        'state', 'active', 'release', p_new_version,
        'revision', p_revision, 'status', p_transition_kind
      ),
      p_reason_code, p_correlation_id
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

create function public.academy_admin_read_curriculum_activation_v1(
  p_actor_user_ref uuid,
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  perform academy_private.curriculum_pointer_require_actor(
    p_actor_user_ref, p_required_capability
  );
  return academy_private.curriculum_pointer_status_projection();
end;
$$;

create function public.academy_admin_transition_curriculum_pointer_v1(
  p_actor_user_ref uuid,
  p_target_version text,
  p_expected_pointer_revision bigint,
  p_transition_kind text,
  p_reason_code text,
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
  receipt academy_private.curriculum_pointer_request_receipts%rowtype;
  pointer_row public.academy_curriculum_active_pointers%rowtype;
  target_release public.academy_curriculum_releases%rowtype;
  previous_version text;
  transition_id uuid := gen_random_uuid();
  next_revision bigint;
  updated_rows integer;
  response jsonb;
begin
  perform academy_private.curriculum_pointer_require_actor(
    p_actor_user_ref, p_required_capability
  );

  if p_target_version is null
     or p_target_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?$'
     or p_expected_pointer_revision is null
     or p_expected_pointer_revision < 1
     or p_transition_kind not in ('activation', 'rollback')
     or p_reason_code is distinct from (case p_transition_kind
       when 'activation' then 'release.activated'
       else 'release.rolled_back'
     end)
     or p_request_id is null
     or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'CURRICULUM_ACTIVATION_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into receipt
  from academy_private.curriculum_pointer_request_receipts
  where actor_user_ref = p_actor_user_ref and request_id = p_request_id;
  if receipt.request_id is not null then
    if receipt.request_sha256 <> p_request_digest then
      raise exception 'CURRICULUM_ACTIVATION_REPLAY_CONFLICT' using errcode = '23505';
    end if;
    return receipt.response || jsonb_build_object('replayed', true);
  end if;

  select * into pointer_row
  from public.academy_curriculum_active_pointers
  where environment = 'production'
  for update;
  if pointer_row.environment is null then
    raise exception 'CURRICULUM_ACTIVATION_POINTER_UNAVAILABLE' using errcode = '55000';
  end if;
  if pointer_row.revision <> p_expected_pointer_revision then
    raise exception 'CURRICULUM_ACTIVATION_POINTER_CONFLICT' using errcode = '40001';
  end if;

  select * into target_release
  from public.academy_curriculum_releases
  where version = p_target_version and status = 'published';
  if target_release.release_id is null then
    if exists (
      select 1 from public.academy_curriculum_staged_releases
      where target_version = p_target_version
    ) then
      raise exception 'CURRICULUM_ACTIVATION_TARGET_NOT_PUBLISHED' using errcode = '55000';
    end if;
    raise exception 'CURRICULUM_ACTIVATION_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not academy_private.curriculum_release_activation_eligible(target_release.release_id) then
    raise exception 'CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE' using errcode = '55000';
  end if;

  select release.version into previous_version
  from public.academy_curriculum_releases as release
  where release.release_id = pointer_row.release_id;

  if pointer_row.release_id = target_release.release_id then
    response := academy_private.curriculum_pointer_status_projection()
      || jsonb_build_object('transition', jsonb_build_object(
        'state', 'no_op',
        'transitionKind', p_transition_kind,
        'previousReleaseVersion', previous_version,
        'newReleaseVersion', p_target_version,
        'pointerRevision', pointer_row.revision,
        'correlationId', p_request_id
      ));
    insert into academy_private.curriculum_pointer_request_receipts (
      actor_user_ref, request_id, request_sha256, transition_id, response
    ) values (
      p_actor_user_ref, p_request_id, p_request_digest, null, response
    );
    return response || jsonb_build_object('replayed', false);
  end if;

  if p_transition_kind = 'rollback' and not exists (
    select 1
    from public.academy_curriculum_pointer_transitions as transition
    where transition.environment = 'production'
      and transition.new_release_id = target_release.release_id
  ) then
    raise exception 'CURRICULUM_ACTIVATION_KIND_CONFLICT' using errcode = '55000';
  end if;
  if p_transition_kind = 'activation' and exists (
    select 1
    from public.academy_curriculum_pointer_transitions as transition
    where transition.environment = 'production'
      and transition.new_release_id = target_release.release_id
  ) then
    raise exception 'CURRICULUM_ACTIVATION_KIND_CONFLICT' using errcode = '55000';
  end if;

  next_revision := pointer_row.revision + 1;
  update public.academy_curriculum_active_pointers
  set release_id = target_release.release_id,
      revision = next_revision,
      change_kind = p_transition_kind,
      binding_mode = 'default_authority',
      registered_at = statement_timestamp()
  where environment = 'production'
    and revision = p_expected_pointer_revision;
  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception 'CURRICULUM_ACTIVATION_POINTER_CONFLICT' using errcode = '40001';
  end if;

  insert into public.academy_curriculum_pointer_transitions (
    transition_id, environment, revision, previous_release_id, new_release_id,
    transition_kind, reason_code, actor_user_ref, correlation_id,
    request_sha256
  ) values (
    transition_id, 'production', next_revision, pointer_row.release_id,
    target_release.release_id, p_transition_kind, p_reason_code,
    p_actor_user_ref, p_request_id, p_request_digest
  );

  perform academy_private.curriculum_pointer_append_audit(
    p_actor_user_ref, previous_version, p_target_version, next_revision,
    p_transition_kind, p_reason_code, p_request_id
  );

  response := academy_private.curriculum_pointer_status_projection()
    || jsonb_build_object('transition', jsonb_build_object(
      'state', 'transitioned',
      'transitionKind', p_transition_kind,
      'previousReleaseVersion', previous_version,
      'newReleaseVersion', p_target_version,
      'pointerRevision', next_revision,
      'correlationId', p_request_id
    ));
  insert into academy_private.curriculum_pointer_request_receipts (
    actor_user_ref, request_id, request_sha256, transition_id, response
  ) values (
    p_actor_user_ref, p_request_id, p_request_digest, transition_id, response
  );
  return response || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.academy_admin_read_curriculum_production_pointer_v1(
  p_required_capability text
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
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'environment', pointer.environment,
    'packageId', release.package_id,
    'releaseVersion', release.version,
    'revision', pointer.revision,
    'changeKind', pointer.change_kind,
    'bindingMode', pointer.binding_mode,
    'registryOnly', pointer.binding_mode = 'registry_only',
    'runtimeBinding', case pointer.binding_mode
      when 'registry_only' then 'hard-coded'
      else 'default-authority'
    end,
    'existingLearnersRepinned', false,
    'registeredAt', to_char(
      pointer.registered_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  ) into projection
  from public.academy_curriculum_active_pointers as pointer
  join public.academy_curriculum_releases as release
    on release.release_id = pointer.release_id
  where pointer.environment = 'production';
  return projection;
end;
$$;

alter function academy_private.admin_frozen_capability_v2(text, text) owner to postgres;
alter function academy_private.curriculum_pointer_require_actor(uuid, text) owner to postgres;
alter function academy_private.curriculum_release_activation_eligible(uuid) owner to postgres;
alter function academy_private.curriculum_pointer_status_projection() owner to postgres;
alter function academy_private.curriculum_pointer_append_audit(uuid, text, text, bigint, text, text, uuid) owner to postgres;
alter function public.academy_admin_read_curriculum_activation_v1(uuid, text) owner to postgres;
alter function public.academy_admin_transition_curriculum_pointer_v1(uuid, text, bigint, text, text, uuid, text, text) owner to postgres;
alter function public.academy_admin_read_curriculum_production_pointer_v1(text) owner to postgres;

revoke all on table public.academy_curriculum_pointer_transitions
  from public, anon, authenticated, service_role;
revoke all on table academy_private.curriculum_pointer_request_receipts
  from public, anon, authenticated, service_role;
revoke all on function academy_private.admin_frozen_capability_v2(text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_pointer_require_actor(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_release_activation_eligible(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_pointer_status_projection()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.curriculum_pointer_append_audit(uuid, text, text, bigint, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_activation_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_transition_curriculum_pointer_v1(uuid, text, bigint, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_curriculum_activation_v1(uuid, text)
  to service_role;
grant execute on function public.academy_admin_transition_curriculum_pointer_v1(uuid, text, bigint, text, text, uuid, text, text)
  to service_role;

comment on table public.academy_curriculum_pointer_transitions is
  'Append-only active/default curriculum pointer revisions; never learner repins.';
comment on table academy_private.curriculum_pointer_request_receipts is
  'Actor-scoped exact idempotency receipts for curriculum pointer transitions.';
comment on function public.academy_admin_read_curriculum_activation_v1(uuid, text) is
  'Trusted-server curriculum:read activation control-plane projection.';
comment on function public.academy_admin_transition_curriculum_pointer_v1(uuid, text, bigint, text, text, uuid, text, text) is
  'Trusted-server releases:manage CAS activation/rollback; never mutates releases or learner pins.';
comment on table public.academy_curriculum_active_pointers is
  'Current default curriculum authority. Existing Profile.academy.releaseVersion pins remain unchanged.';
comment on function public.academy_admin_read_curriculum_production_pointer_v1(text) is
  'Service-only current default curriculum authority; explicitly reports that existing learners are not repinned.';

commit;
