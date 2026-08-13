-- Final additive convergence for Study gateway actor binding.
--
-- Historical production work introduced the actor-aware verifier at the
-- contested 20260808120000 lease. The final migration chain owns that version
-- with academy_admin_authorization, so this later lease recreates the valid
-- overload without renaming or reusing historical migration history.
--
-- The two-argument verifier and both four-argument runtime executors remain in
-- place for compatibility. Gateways that have authenticated a Supabase actor
-- must use the actor-aware overloads created here.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
  existing_body text;
begin
  if current_user <> 'postgres' then
    raise exception 'Study actor authority convergence must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.verified_identity_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.session_semantics_version is distinct from 2
     or marker.curriculum_binding_version is distinct from 2
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801160000_academy_study_verified_identity',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260810151000_academy_study_session_semantics_v2',
       '20260810153000_academy_study_release_registry_bridge'
     ]::text[]) then
    raise exception 'STUDY_ACTOR_AUTHORITY predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260813170000_academy_study_actor_authority_convergence'
     ]::text[] then
    raise exception 'STUDY_ACTOR_AUTHORITY already applied';
  end if;

  if to_regprocedure(
       'public.academy_study_verify_session_v1(text,text)'
     ) is null
     or to_regprocedure(
       'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)'
     ) is null then
    raise exception 'STUDY_ACTOR_AUTHORITY required predecessor function missing';
  end if;

  existing_body := pg_get_functiondef(
    'public.academy_study_verify_session_v1(text,text)'::regprocedure
  );
  if existing_body not like '%STUDY_TRUSTED_SERVER_REQUIRED%'
     or existing_body not like '%is_student_session_grant_current%'
     or existing_body not like '%student-session-invalid%' then
    raise exception 'STUDY_ACTOR_AUTHORITY predecessor verifier mismatch';
  end if;

  -- An environment that rehearsed the historical actor migration may already
  -- contain this overload. Accept it only when its body proves the exact actor
  -- and current-grant predicates; otherwise fail rather than overwrite drift.
  if to_regprocedure(
       'public.academy_study_verify_session_v1(text,text,uuid)'
     ) is not null then
    existing_body := pg_get_functiondef(
      'public.academy_study_verify_session_v1(text,text,uuid)'::regprocedure
    );
    if existing_body not like '%grant_row.issued_by = p_actor_user_id%'
       or existing_body not like '%is_student_session_grant_current%'
       or existing_body not like '%STUDY_TRUSTED_SERVER_REQUIRED%'
       or existing_body not like '%student-session-invalid%' then
      raise exception 'STUDY_ACTOR_AUTHORITY incompatible verifier collision';
    end if;
  end if;

  if to_regprocedure(
       'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb,uuid)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb,uuid)'
     ) is not null then
    raise exception 'STUDY_ACTOR_AUTHORITY executor overload collision';
  end if;
end;
$$;

-- Retain the verified envelope and all current-grant checks from the historical
-- two-argument function, while additionally binding the out-of-band verified
-- gateway actor to the guardian who owns the grant.
create or replace function public.academy_study_verify_session_v1(
  p_token_digest text,
  p_required_capability text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  verified record;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_actor_user_id is null
     or p_required_capability not in (
       'student:assignments:read',
       'student:attempts:create',
       'student:progress:read'
     ) then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'student-session-invalid'
    );
  end if;

  select
    grant_row.id,
    grant_row.household_id,
    grant_row.student_id,
    grant_row.session_version,
    grant_row.capabilities,
    grant_row.session_epoch,
    grant_row.authorization_revision,
    grant_row.issued_at,
    grant_row.expires_at,
    grant_row.contract_version
  into verified
  from academy_private.student_session_grants as grant_row
  where grant_row.token_digest = p_token_digest
    and grant_row.grant_purpose = 'study'
    and grant_row.contract_version = 1
    and grant_row.issued_by = p_actor_user_id
    and grant_row.capabilities @> array[p_required_capability]::text[]
    and academy_private.is_student_session_grant_current(grant_row.id);

  if verified.id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'student-session-invalid'
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'verified',
    'grantId', verified.id,
    'householdId', verified.household_id,
    'studentId', verified.student_id,
    'learnerSessionId', verified.session_epoch,
    'sessionEpoch', verified.session_epoch,
    'sessionVersion', verified.session_version,
    'authorizationRevision', verified.authorization_revision,
    'issuedAt', verified.issued_at,
    'expiresAt', verified.expires_at,
    'contractVersion', verified.contract_version,
    'issuerVersion', 'academy-student-session-issuer.v1',
    'scope', to_jsonb(verified.capabilities)
  );
end;
$$;

-- Actor-aware compatibility wrapper for the Session 13 verified runtime.
-- Verification happens before delegation; the original executor still performs
-- its complete grant and capability verification inside the same statement.
create function public.academy_study_execute_verified_runtime_v1(
  p_token_digest text,
  p_required_capability text,
  p_operation text,
  p_request jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_verification jsonb;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  actor_verification := public.academy_study_verify_session_v1(
    p_token_digest,
    p_required_capability,
    p_actor_user_id
  );
  if actor_verification ->> 'status' <> 'verified' then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'operation', p_operation
    );
  end if;

  return public.academy_study_execute_verified_runtime_v1(
    p_token_digest,
    p_required_capability,
    p_operation,
    p_request
  );
end;
$$;

-- Actor-aware compatibility wrapper for the V2 lifecycle executor used by
-- cross-device begin/resume/transition/checkpoint transports.
create function public.academy_study_execute_session_lifecycle_v2(
  p_token_digest text,
  p_required_capability text,
  p_operation text,
  p_request jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_verification jsonb;
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  actor_verification := public.academy_study_verify_session_v1(
    p_token_digest,
    p_required_capability,
    p_actor_user_id
  );
  if actor_verification ->> 'status' <> 'verified' then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'operation', p_operation
    );
  end if;

  return public.academy_study_execute_session_lifecycle_v2(
    p_token_digest,
    p_required_capability,
    p_operation,
    p_request
  );
end;
$$;

alter function public.academy_study_verify_session_v1(text, text, uuid)
  owner to postgres;
alter function public.academy_study_execute_verified_runtime_v1(
  text, text, text, jsonb, uuid
) owner to postgres;
alter function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb, uuid
) owner to postgres;

revoke all on function public.academy_study_verify_session_v1(text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_verified_runtime_v1(
  text, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.academy_study_verify_session_v1(
  text, text, uuid
) to service_role;
grant execute on function public.academy_study_execute_verified_runtime_v1(
  text, text, text, jsonb, uuid
) to service_role;
grant execute on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb, uuid
) to service_role;

alter table academy_private.study_persistence_metadata
  add column if not exists actor_binding_version smallint not null default 0;

do $$
begin
  if exists (
    select 1
    from academy_private.study_persistence_metadata
    where actor_binding_version not in (0, 1)
  ) then
    raise exception 'STUDY_ACTOR_AUTHORITY marker column mismatch';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'academy_private.study_persistence_metadata'::regclass
      and conname = 'study_persistence_metadata_actor_binding_version_check'
  ) then
    alter table academy_private.study_persistence_metadata
      add constraint study_persistence_metadata_actor_binding_version_check
      check (actor_binding_version in (0, 1));
  end if;
end;
$$;

update academy_private.study_persistence_metadata
set actor_binding_version = 1,
    migration_names = case
      when migration_names @> array[
        '20260813170000_academy_study_actor_authority_convergence'
      ]::text[] then migration_names
      else array_append(
        migration_names,
        '20260813170000_academy_study_actor_authority_convergence'
      )
    end,
    security_manifest = security_manifest || jsonb_build_object(
      'actor_binding_version', 1,
      'session_verification_actor_bound', true,
      'session_verification_actor_source',
        'academy_private.student_session_grants.issued_by',
      'session_verification_two_arg_overload_retained', true,
      'actor_aware_runtime_overloads', jsonb_build_array(
        'academy_study_execute_verified_runtime_v1',
        'academy_study_execute_session_lifecycle_v2'
      ),
      'actor_aware_execute_role', 'service_role'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_verify_session_v1(
  text, text, uuid
) is
  'Actor-aware Study session verification. Binds a trusted gateway Supabase actor to the current guardian-owned Study grant. Denials are deliberately indistinguishable. Service-role server use only.';
comment on function public.academy_study_execute_verified_runtime_v1(
  text, text, text, jsonb, uuid
) is
  'Actor-aware wrapper for the retained verified runtime executor. Gateways with a Supabase actor must use this overload.';
comment on function public.academy_study_execute_session_lifecycle_v2(
  text, text, text, jsonb, uuid
) is
  'Actor-aware wrapper for Study V2 lifecycle and checkpoint operations. Gateways with a Supabase actor must use this overload.';

commit;
