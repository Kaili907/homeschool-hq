-- Manuel Academy verified guardian launch and opaque Study learner sessions.
-- Additive to the Session 13 identity foundation and Session 15 Study chain.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study verified identity migration must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if marker.storage_version <> 1
     or marker.authorization_version <> 1
     or marker.production_reconciliation_version <> 1
     or marker.migration_names <> array[
       '20260801010000_academy_study_engine_storage',
       '20260801011000_academy_study_engine_authorization',
       '20260801012000_academy_study_engine_production_reconciliation'
     ]::text[] then
    raise exception 'Study verified identity predecessor marker mismatch';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid =
      'academy_private.student_session_grants'::regclass
      and attribute.attname in (
        'grant_purpose', 'contract_version', 'session_epoch',
        'authorization_revision'
      )
      and not attribute.attisdropped
  ) or exists (
    select 1
    from unnest(array[
      'public.academy_study_issue_guardian_launch_v1(text,text)',
      'public.academy_study_verify_session_v1(text,text)',
      'public.academy_study_revoke_session_v1(text)',
      'public.academy_study_verified_identity_readiness_v1()',
      'academy_private.study_protect_session_identity_fields()'
    ]) as candidate(signature)
    where to_regprocedure(candidate.signature) is not null
  ) then
    raise exception 'Unmarked Study verified identity object collision';
  end if;
end;
$$;

alter table academy_private.student_session_grants
  add column grant_purpose text not null default 'academy-core'
    check (grant_purpose in ('academy-core', 'study')),
  add column contract_version smallint not null default 1
    check (contract_version = 1),
  add column session_epoch uuid not null default gen_random_uuid(),
  add column authorization_revision bigint not null default 1
    check (authorization_revision > 0);

create or replace function academy_private.study_protect_session_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
    new.grant_purpose,
    new.contract_version,
    new.session_epoch,
    new.authorization_revision
  ) is distinct from row(
    old.grant_purpose,
    old.contract_version,
    old.session_epoch,
    old.authorization_revision
  ) then
    raise exception 'Study session identity fields are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger academy_student_sessions_protect_study_identity
  before update of
    grant_purpose, contract_version, session_epoch, authorization_revision
  on academy_private.student_session_grants
  for each row execute function
    academy_private.study_protect_session_identity_fields();

create unique index academy_student_session_grants_epoch_idx
  on academy_private.student_session_grants (session_epoch);

-- At most one unrevoked guardian-launched Study grant may exist for the same
-- guardian and learner. Reissue first revokes the predecessor, so an old raw
-- reference cannot become current again after rotation.
create unique index academy_student_session_grants_guardian_study_current_idx
  on academy_private.student_session_grants
    (student_id, issued_by, grant_purpose)
  where issuance_flow = 'guardian_activation'
    and grant_purpose = 'study'
    and revoked_at is null;

create index academy_student_session_grants_study_verify_idx
  on academy_private.student_session_grants
    (token_digest, grant_purpose, expires_at)
  where revoked_at is null;

create or replace function public.academy_study_issue_guardian_launch_v1(
  p_selector_kind text,
  p_selector_value text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  authority record;
  eligible_count bigint;
  resolved_student_id uuid;
  raw_token text;
  raw_token_digest text;
  new_grant academy_private.student_session_grants%rowtype;
begin
  if auth.uid() is null
     or academy_private.study_jwt_claim_text('academy_principal_kind') =
       'student_session_grant' then
    raise exception 'STUDY_AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not (
    (
      p_selector_kind = 'academy-student-id'
      and p_selector_value ~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    or (
      p_selector_kind = 'legacy-profile-id'
      and p_selector_value ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    )
  ) then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  -- A legacy profile id is unique only inside one household. Count all
  -- guardian-authorized matches and reject ambiguity instead of choosing a
  -- household. The selector never carries household authority.
  select count(*), min(student.id::text)::uuid
  into eligible_count, resolved_student_id
  from public.academy_students as student
  join public.academy_households as household
    on household.id = student.household_id
   and household.status = 'active'
  join public.academy_household_memberships as membership
    on membership.household_id = student.household_id
   and membership.user_id = auth.uid()
   and membership.member_role = 'guardian'
   and membership.status = 'active'
   and membership.revoked_at is null
  join public.academy_guardian_student_access as access
    on access.household_id = student.household_id
   and access.student_id = student.id
   and access.membership_id = membership.id
   and access.status = 'active'
   and access.revoked_at is null
   and access.permission_level = 'identity_manager'
  join academy_private.student_access_credentials as credential
    on credential.household_id = student.household_id
   and credential.student_id = student.id
   and credential.credential_kind = 'pin'
   and credential.status = 'active'
  where student.lifecycle_status = 'active'
    and (
      (
        p_selector_kind = 'academy-student-id'
        and student.id = p_selector_value::uuid
      )
      or (
        p_selector_kind = 'legacy-profile-id'
        and student.legacy_profile_id = p_selector_value
      )
    );

  if eligible_count <> 1 or resolved_student_id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  -- Household, membership, relationship, role, permission, credential, and
  -- session version are all derived here. The caller supplies only a learner
  -- selector and cannot nominate any authority-bearing identifier.
  select
    student.household_id,
    student.session_version,
    membership.id as membership_id,
    access.id as access_id,
    credential.id as credential_id,
    credential.credential_version
  into authority
  from public.academy_students as student
  join public.academy_households as household
    on household.id = student.household_id
   and household.status = 'active'
  join public.academy_household_memberships as membership
    on membership.household_id = student.household_id
   and membership.user_id = auth.uid()
   and membership.member_role = 'guardian'
   and membership.status = 'active'
   and membership.revoked_at is null
  join public.academy_guardian_student_access as access
    on access.household_id = student.household_id
   and access.student_id = student.id
   and access.membership_id = membership.id
   and access.status = 'active'
   and access.revoked_at is null
   and access.permission_level = 'identity_manager'
  join academy_private.student_access_credentials as credential
    on credential.household_id = student.household_id
   and credential.student_id = student.id
   and credential.credential_kind = 'pin'
   and credential.status = 'active'
  where student.id = resolved_student_id
    and student.lifecycle_status = 'active'
  order by credential.credential_version desc
  limit 1
  for update of student, membership, access, credential;

  if authority.household_id is null then
    raise exception 'STUDY_OPERATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  update academy_private.student_session_grants
  set revoked_at = now(),
      revoked_actor_kind = 'guardian',
      revoked_by = auth.uid(),
      revocation_reason = 'study-session-reissued'
  where student_id = resolved_student_id
    and issued_by = auth.uid()
    and issuance_flow = 'guardian_activation'
    and grant_purpose = 'study'
    and revoked_at is null;

  -- Hashing three core cryptographic UUIDs yields a 256-bit opaque value without
  -- depending on a mutable extension schema. Only its digest is persisted.
  raw_token := 'aca_stu_v1_' || pg_catalog.translate(
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.gen_random_uuid()::text ||
        pg_catalog.gen_random_uuid()::text ||
        pg_catalog.gen_random_uuid()::text,
        'UTF8'
      )),
      'base64'
    ),
    E'+/=\n\r',
    '-_'
  );
  if not academy_private.is_valid_raw_student_session_token(raw_token) then
    raise exception 'STUDY_SESSION_GENERATION_FAILED' using errcode = 'XX000';
  end if;
  raw_token_digest := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(raw_token, 'UTF8')),
    'hex'
  );

  insert into academy_private.student_session_grants (
    household_id,
    student_id,
    token_digest,
    capabilities,
    credential_id,
    credential_version,
    session_version,
    issuance_flow,
    issued_actor_kind,
    issued_by,
    issuing_membership_id,
    issuing_access_id,
    issuance_reason,
    correlation_id,
    issued_at,
    expires_at,
    grant_purpose,
    contract_version,
    session_epoch,
    authorization_revision
  ) values (
    authority.household_id,
    resolved_student_id,
    raw_token_digest,
    array[
      'student:assignments:read',
      'student:attempts:create',
      'student:progress:read'
    ]::text[],
    authority.credential_id,
    authority.credential_version,
    authority.session_version,
    'guardian_activation',
    'guardian',
    auth.uid(),
    authority.membership_id,
    authority.access_id,
    'study-session-guardian-launch',
    gen_random_uuid(),
    now(),
    now() + interval '15 minutes',
    'study',
    1,
    gen_random_uuid(),
    authority.session_version
  ) returning * into new_grant;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'issued',
    'sessionReference', raw_token,
    'grantId', new_grant.id,
    'studentId', new_grant.student_id,
    'learnerSessionId', new_grant.session_epoch,
    'sessionEpoch', new_grant.session_epoch,
    'authorizationRevision', new_grant.authorization_revision,
    'issuedAt', new_grant.issued_at,
    'expiresAt', new_grant.expires_at,
    'contractVersion', new_grant.contract_version,
    'issuerVersion', 'academy-student-session-issuer.v1',
    'scope', to_jsonb(new_grant.capabilities)
  );
end;
$$;

create or replace function public.academy_study_verify_session_v1(
  p_token_digest text,
  p_required_capability text
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

create or replace function public.academy_study_revoke_session_v1(
  p_token_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  if p_token_digest is not null
     and p_token_digest ~ '^[0-9a-f]{64}$' then
    update academy_private.student_session_grants
    set revoked_at = now(),
        revoked_actor_kind = 'trusted_server',
        revoked_by = null,
        revocation_reason = 'study-session-self-revoked'
    where token_digest = p_token_digest
      and grant_purpose = 'study'
      and revoked_at is null;
  end if;

  -- Idempotent and non-enumerating: callers learn no token-existence detail.
  return jsonb_build_object('schemaVersion', 1, 'status', 'revoked');
end;
$$;

alter table academy_private.study_persistence_metadata
  add column verified_identity_version smallint not null default 0
    check (verified_identity_version in (0, 1));

update academy_private.study_persistence_metadata
set verified_identity_version = 1,
    migration_names = array_append(
      migration_names,
      '20260801160000_academy_study_verified_identity'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'verified_identity_version', 1,
      'guardian_authority', 'server-derived-identity-manager',
      'study_session_ttl_seconds', 900,
      'opaque_reference_digest', 'sha256',
      'rotation', 'one-unrevoked-per-guardian-learner'
    ),
    updated_at = now()
where singleton;

create or replace function public.academy_study_verified_identity_readiness_v1()
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

  select metadata.verified_identity_version = 1
    and metadata.migration_names[array_length(metadata.migration_names, 1)] =
      '20260801160000_academy_study_verified_identity'
    and not pg_catalog.has_function_privilege(
      'anon',
      'public.academy_study_issue_guardian_launch_v1(text,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'authenticated',
      'public.academy_study_issue_guardian_launch_v1(text,text)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.academy_study_verify_session_v1(text,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.academy_study_verify_session_v1(text,text)',
      'EXECUTE'
    )
  into ready
  from academy_private.study_persistence_metadata as metadata
  where metadata.singleton;

  return jsonb_build_object(
    'status', case when coalesce(ready, false) then 'ready' else 'not-ready' end,
    'schemaVersion', 1,
    'issuerVersion', 'academy-student-session-issuer.v1'
  );
end;
$$;

alter function public.academy_study_issue_guardian_launch_v1(text, text)
  owner to postgres;
alter function public.academy_study_verify_session_v1(text, text)
  owner to postgres;
alter function public.academy_study_revoke_session_v1(text)
  owner to postgres;
alter function public.academy_study_verified_identity_readiness_v1()
  owner to postgres;
alter function academy_private.study_protect_session_identity_fields()
  owner to postgres;

revoke all on function public.academy_study_issue_guardian_launch_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_verify_session_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_revoke_session_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_verified_identity_readiness_v1()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.study_protect_session_identity_fields()
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_issue_guardian_launch_v1(text, text)
  to authenticated;
grant execute on function public.academy_study_verify_session_v1(text, text)
  to service_role;
grant execute on function public.academy_study_revoke_session_v1(text)
  to service_role;
grant execute on function public.academy_study_verified_identity_readiness_v1()
  to service_role;

commit;
