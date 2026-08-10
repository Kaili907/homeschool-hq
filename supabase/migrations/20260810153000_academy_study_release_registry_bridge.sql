begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
  approval_count integer;
begin
  if current_user <> 'postgres' then
    raise exception 'Study release registry bridge migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.curriculum_binding_version <> 1
     or not marker.migration_names @> array[
       '20260810150000_academy_study_curriculum_binding'
     ]::text[] then
    raise exception 'Study release registry bridge prerequisite mismatch';
  end if;
  if to_regclass('public.academy_curriculum_releases') is null
     or to_regclass('public.academy_curriculum_active_pointers') is null
     or to_regclass(
       'academy_private.study_curriculum_release_approvals'
     ) is null then
    raise exception 'Study release registry bridge registry prerequisite missing';
  end if;
  if marker.migration_names @> array[
       '20260810153000_academy_study_release_registry_bridge'
     ]::text[]
     or to_regprocedure(
       'public.academy_curriculum_active_pointer_append_guard()'
     ) is not null
     or exists (
       select 1 from pg_catalog.pg_constraint
       where conname = 'academy_curriculum_releases_study_binding_key'
     ) then
    raise exception 'Study release registry bridge object collision';
  end if;

  select count(*)::integer into approval_count
  from academy_private.study_curriculum_release_approvals;
  if approval_count = 0 or exists (
    select 1
    from academy_private.study_curriculum_release_approvals as approval
    left join public.academy_curriculum_releases as release
      on release.release_id = approval.release_id
     and release.package_id = approval.package_id
     and release.version = approval.release_version
     and release.curriculum_manifest_sha256 =
       approval.curriculum_manifest_sha256
     and release.status = 'published'
    where release.release_id is null
  ) then
    raise exception 'Study approval does not match an immutable published registry release';
  end if;
  if exists (
    select 1
    from public.academy_study_sessions as session
    left join public.academy_curriculum_releases as release
      on release.release_id = session.curriculum_release_id
     and release.package_id = session.curriculum_package_id
     and release.version = session.curriculum_release_version
     and release.curriculum_manifest_sha256 =
       session.curriculum_manifest_sha256
     and release.status = 'published'
    where session.curriculum_binding_schema_version is not null
      and release.release_id is null
  ) then
    raise exception 'Existing Study session binding does not match the release registry';
  end if;
  if (select count(*) from public.academy_curriculum_active_pointers
      where environment = 'production') <> 1 then
    raise exception 'Study release registry bridge requires one production pointer seed';
  end if;
end;
$$;

alter table public.academy_curriculum_releases
  add constraint academy_curriculum_releases_study_binding_key
    unique (
      release_id,
      package_id,
      version,
      curriculum_manifest_sha256
    );

alter table public.academy_study_sessions
  drop constraint academy_study_sessions_curriculum_binding_fk,
  add constraint academy_study_sessions_curriculum_registry_fk
    foreign key (
      curriculum_release_id,
      curriculum_package_id,
      curriculum_release_version,
      curriculum_manifest_sha256
    ) references public.academy_curriculum_releases (
      release_id,
      package_id,
      version,
      curriculum_manifest_sha256
    ) on update restrict on delete restrict;

drop trigger study_curriculum_release_approvals_immutable
  on academy_private.study_curriculum_release_approvals;
drop function academy_private.study_curriculum_release_approval_immutable();
drop table academy_private.study_curriculum_release_approvals;

-- ADMIN-16A seeded a single immutable registry-only pointer. Preserve that row
-- as revision 1, evolve the relation into append-only history, and append the
-- explicit bridge activation as revision 2. No browser role receives INSERT.
alter table public.academy_curriculum_active_pointers
  drop constraint academy_curriculum_active_pointers_pkey,
  drop constraint academy_curriculum_active_pointers_change_kind_check,
  drop constraint academy_curriculum_active_pointers_binding_mode_check,
  add constraint academy_curriculum_active_pointers_pkey
    primary key (environment, revision),
  add constraint academy_curriculum_active_pointers_change_kind_check
    check (change_kind in (
      'migration_seed', 'bridge_activation', 'activate', 'rollback'
    )),
  add constraint academy_curriculum_active_pointers_binding_mode_check
    check (binding_mode in ('registry_only', 'study_new_sessions'));

create function public.academy_curriculum_active_pointer_append_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  prior_revision bigint;
  prior_registered_at timestamptz;
begin
  select pointer.revision, pointer.registered_at
  into prior_revision, prior_registered_at
  from public.academy_curriculum_active_pointers as pointer
  where pointer.environment = new.environment
  order by pointer.revision desc
  limit 1;
  if new.revision <> coalesce(prior_revision, 0) + 1 then
    raise exception 'Curriculum active pointer revision must append exactly once';
  end if;
  if prior_registered_at is not null
     and new.registered_at <= prior_registered_at then
    raise exception 'Curriculum active pointer time must advance';
  end if;
  if new.revision = 1 then
    if new.change_kind <> 'migration_seed'
       or new.binding_mode <> 'registry_only' then
      raise exception 'Curriculum active pointer seed is invalid';
    end if;
  elsif new.change_kind = 'migration_seed'
        or new.binding_mode <> 'study_new_sessions' then
    raise exception 'Curriculum active pointer append is invalid';
  end if;
  return new;
end;
$$;

alter function public.academy_curriculum_active_pointer_append_guard()
  owner to postgres;
revoke all on function public.academy_curriculum_active_pointer_append_guard()
  from public, anon, authenticated, service_role;

create trigger academy_curriculum_active_pointers_append_guard
  before insert on public.academy_curriculum_active_pointers
  for each row execute function
    public.academy_curriculum_active_pointer_append_guard();

insert into public.academy_curriculum_active_pointers (
  environment,
  release_id,
  revision,
  change_kind,
  binding_mode,
  registered_at
)
select
  'production',
  pointer.release_id,
  2,
  'bridge_activation',
  'study_new_sessions',
  '2026-08-10 15:30:00+00'
from public.academy_curriculum_active_pointers as pointer
where pointer.environment = 'production'
  and pointer.revision = 1;

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
      when 'study_new_sessions' then 'study-new-sessions'
      else 'hard-coded'
    end,
    'registeredAt', to_char(
      pointer.registered_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  ) into projection
  from public.academy_curriculum_active_pointers as pointer
  join public.academy_curriculum_releases as release
    on release.release_id = pointer.release_id
   and release.status = 'published'
  where pointer.environment = 'production'
  order by pointer.revision desc
  limit 1;
  return projection;
end;
$$;

alter function public.academy_admin_read_curriculum_production_pointer_v1(text)
  owner to postgres;
revoke all on function
  public.academy_admin_read_curriculum_production_pointer_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.academy_admin_read_curriculum_production_pointer_v1(text)
  to service_role;

create or replace function academy_private.study_resolve_curriculum_binding_internal_v1(
  p_student_id uuid,
  p_subject_id text,
  p_intended_local_date date,
  p_requested_release_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  requested_release public.academy_curriculum_releases%rowtype;
  active_release public.academy_curriculum_releases%rowtype;
  enrollment_release_version text;
  enrollment_release_count integer;
begin
  if p_student_id is null
     or p_subject_id is null
     or not public.academy_study_identifier_is_valid(p_subject_id)
     or p_intended_local_date is null
     or p_requested_release_version is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-missing'
    );
  end if;
  if p_requested_release_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unsupported'
    );
  end if;

  select * into requested_release
  from public.academy_curriculum_releases
  where version = p_requested_release_version
    and status = 'published';
  if requested_release.release_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unsupported'
    );
  end if;

  select release.* into active_release
  from public.academy_curriculum_active_pointers as pointer
  join public.academy_curriculum_releases as release
    on release.release_id = pointer.release_id
   and release.status = 'published'
  where pointer.environment = 'production'
    and pointer.binding_mode = 'study_new_sessions'
  order by pointer.revision desc
  limit 1;
  if active_release.release_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unavailable'
    );
  end if;
  if active_release.release_id <> requested_release.release_id then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-mismatch'
    );
  end if;

  select
    count(distinct btrim(enrollment.curriculum_version))::integer,
    min(btrim(enrollment.curriculum_version))
  into enrollment_release_count, enrollment_release_version
  from public.academy_subject_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.enrollment_status = 'active'
    and enrollment.curriculum_version is not null
    and btrim(enrollment.curriculum_version) <> ''
    and (enrollment.starts_on is null
      or enrollment.starts_on <= p_intended_local_date)
    and (enrollment.ends_on is null
      or enrollment.ends_on >= p_intended_local_date)
    and (
      enrollment.subject_key = p_subject_id
      or (p_subject_id = 'math'
        and enrollment.subject_key = 'mathematics')
      or (p_subject_id in ('reading', 'writing')
        and enrollment.subject_key = 'english-language-arts')
    );
  if enrollment_release_count = 0 then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-unavailable'
    );
  end if;
  if enrollment_release_count <> 1
     or enrollment_release_version <> active_release.version then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unavailable',
      'reasonCode', 'curriculum-release-mismatch'
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'bound',
    'releaseId', active_release.release_id,
    'packageId', active_release.package_id,
    'releaseVersion', active_release.version,
    'curriculumManifestSha256',
      active_release.curriculum_manifest_sha256
  );
end;
$$;

alter function academy_private.study_resolve_curriculum_binding_internal_v1(
  uuid, text, date, text
) owner to postgres;
revoke all on function
  academy_private.study_resolve_curriculum_binding_internal_v1(
    uuid, text, date, text
  ) from public, anon, authenticated, service_role;

alter table academy_private.study_persistence_metadata
  drop constraint study_persistence_metadata_curriculum_binding_version_check,
  add constraint study_persistence_metadata_curriculum_binding_version_check
    check (curriculum_binding_version in (0, 1, 2));
update academy_private.study_persistence_metadata
set curriculum_binding_version = 2,
    migration_names = array_append(
      migration_names,
      '20260810153000_academy_study_release_registry_bridge'
    )
where singleton;

create or replace function public.academy_study_curriculum_binding_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  ready boolean;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  select metadata.curriculum_binding_version = 2
    and metadata.migration_names @> array[
      '20260810150000_academy_study_curriculum_binding',
      '20260810153000_academy_study_release_registry_bridge'
    ]::text[]
    and to_regclass(
      'academy_private.study_curriculum_release_approvals'
    ) is null
    and exists (
      select 1
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
       and release.status = 'published'
      where pointer.environment = 'production'
        and pointer.binding_mode = 'study_new_sessions'
        and pointer.revision = (
          select max(latest.revision)
          from public.academy_curriculum_active_pointers as latest
          where latest.environment = 'production'
        )
    )
    and exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.academy_study_sessions'::regclass
        and confrelid = 'public.academy_curriculum_releases'::regclass
        and conname = 'academy_study_sessions_curriculum_registry_fk'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.academy_study_sessions'::regclass
        and tgname = 'academy_study_sessions_curriculum_binding_immutable'
        and tgenabled <> 'D'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.academy_curriculum_active_pointers'::regclass
        and tgname = 'academy_curriculum_active_pointers_immutable'
        and tgenabled <> 'D'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.academy_curriculum_active_pointers'::regclass
        and tgname = 'academy_curriculum_active_pointers_append_guard'
        and tgenabled <> 'D'
    )
    and not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in (
          'academy_curriculum_releases',
          'academy_curriculum_active_pointers'
        )
        and grantee in ('anon', 'authenticated', 'service_role')
    )
    and has_function_privilege(
      'authenticated',
      'public.academy_study_resolve_curriculum_binding_v1(uuid,text,date,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.academy_study_resolve_curriculum_binding_v1(uuid,text,date,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)',
      'EXECUTE'
    )
  into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;
  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when coalesce(ready, false)
      then 'ready' else 'not-ready' end
  );
end;
$$;

alter function public.academy_study_curriculum_binding_readiness_v1()
  owner to postgres;
revoke all on function public.academy_study_curriculum_binding_readiness_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_curriculum_binding_readiness_v1()
  to service_role;

comment on table public.academy_curriculum_active_pointers is
  'Append-only Admin release pointer history; the latest production revision selects only new Study sessions.';
comment on column public.academy_study_sessions.curriculum_release_version is
  'Immutable server-resolved Admin registry release version; null only for legacy ambiguous sessions.';
comment on function public.academy_study_resolve_curriculum_binding_v1(
  uuid, text, date, text
) is
  'Resolves advisory browser context against the latest published Admin pointer and active learner enrollment.';

commit;
