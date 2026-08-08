-- Actor-bound Study session verification.
--
-- Adds a THIRD-ARGUMENT OVERLOAD of public.academy_study_verify_session_v1 that
-- binds the gateway actor the safety server verified out of band to the durable
-- owner of the grant, academy_private.student_session_grants.issued_by. Only the
-- database can make that comparison: the server holds the actor as a claim, and
-- a server-side comparison would be checking that claim against itself.
--
-- Additive and forward-only. The two-argument overload is NOT replaced, dropped,
-- or redefined here. It remains the function study-session-verify and production
-- readiness call, and 20260801190000's readiness probe still reads its ACL, so
-- disturbing it would silently take verified identity out of readiness. This
-- migration creates a second, differently-typed signature alongside it.
--
-- No hosted execution is implied by checking this in.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
  verify_body text;
begin
  if current_user <> 'postgres' then
    raise exception 'Study Engine migrations must run as postgres';
  end if;

  -- Predecessor state is asserted by containment and by explicit marker
  -- properties, never by exact equality of migration_names. Exact equality pins a
  -- migration to one chain snapshot and breaks as soon as a legitimately
  -- earlier-versioned sibling lands ahead of it; the requirement is that every
  -- predecessor this migration depends on is present, not that nothing else is.
  select * into marker
  from academy_private.study_persistence_metadata where singleton;
  -- Without this, an absent singleton leaves every comparison below NULL, no
  -- branch is taken, and an unknown state applies fail-open.
  if not found then
    raise exception 'STUDY_ACTOR_BINDING predecessor marker mismatch';
  end if;

  if marker.verified_identity_version is distinct from 1
     or marker.final_production_version is distinct from 1
     or marker.c2_operations_contract_version is distinct from 1
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260801160000_academy_study_verified_identity',
       '20260801190000_academy_study_final_production_reconciliation',
       '20260806120000_academy_study_in_app_receipt_timestamp',
       '20260806140000_academy_study_c2_operations_contract'
     ]::text[]) then
    raise exception 'STUDY_ACTOR_BINDING predecessor marker mismatch';
  end if;

  -- The reconciled C2 operations contract must be present as a PROPERTY, not
  -- merely as a name in the list. A name can be appended by a migration that
  -- failed partway; the manifest fact is written in the same statement as the
  -- version bump.
  if coalesce(marker.security_manifest, '{}'::jsonb)
       @> jsonb_build_object('c2_operations_contract_version', 1)
     is not true then
    raise exception 'STUDY_ACTOR_BINDING predecessor marker mismatch';
  end if;

  if marker.migration_names @> array[
       '20260808120000_academy_study_actor_bound_session_verification'
     ]::text[] then
    raise exception 'STUDY_ACTOR_BINDING already applied';
  end if;

  -- The two-argument overload this one is derived from must exist, and must
  -- still carry the trusted-server boundary the new body reproduces. Deriving a
  -- security-definer body from a predecessor that has drifted would copy the
  -- drift forward silently.
  if to_regprocedure(
       'public.academy_study_verify_session_v1(text,text)'
     ) is null then
    raise exception 'STUDY_ACTOR_BINDING expected two-argument predecessor missing';
  end if;
  verify_body := pg_get_functiondef(
    'public.academy_study_verify_session_v1(text,text)'::regprocedure
  );
  if verify_body not like '%STUDY_TRUSTED_SERVER_REQUIRED%'
     or verify_body not like '%is_student_session_grant_current%'
     or verify_body not like '%student-session-invalid%' then
    raise exception 'STUDY_ACTOR_BINDING predecessor function body mismatch';
  end if;

  -- Creation, never replacement. If the three-argument signature already exists
  -- this migration must refuse rather than redefine a function it did not write.
  if to_regprocedure(
       'public.academy_study_verify_session_v1(text,text,uuid)'
     ) is not null then
    raise exception 'STUDY_ACTOR_BINDING object collision';
  end if;
end;
$$;

-- Derived from the two-argument body. Two substantive additions and nothing
-- else: p_actor_user_id must be present, and it must equal the durable grant
-- owner. Every other predicate — digest shape, capability allowlist, expiry,
-- revocation, session-version, household and student active state, membership,
-- guardian access, and the identity_manager requirement inside
-- is_student_session_grant_current — is carried over unchanged, as is the
-- verified envelope.
create function public.academy_study_verify_session_v1(
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
  -- Unchanged trusted-server boundary. The gateway actor arrives as DATA that
  -- Netlify's Auth call verified; it must never become the SQL caller identity.
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  -- A null actor fails closed. Without this an unauthenticated gateway call
  -- would reach the lookup below with a NULL comparison, which is never true but
  -- would make the denial an accident of three-valued logic rather than a rule.
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
    -- Forged, expired, revoked, wrong-capability and wrong-actor all leave by
    -- this one exit. A caller that could tell them apart could use the function
    -- as an oracle for which references exist and who owns them.
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

alter function public.academy_study_verify_session_v1(text, text, uuid)
  owner to postgres;

revoke all on function public.academy_study_verify_session_v1(text, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.academy_study_verify_session_v1(text, text, uuid)
  to service_role;

alter table academy_private.study_persistence_metadata
  add column actor_binding_version smallint not null default 0
    check (actor_binding_version in (0, 1));

update academy_private.study_persistence_metadata
set actor_binding_version = 1,
    migration_names = array_append(
      migration_names,
      '20260808120000_academy_study_actor_bound_session_verification'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'actor_binding_version', 1,
      'session_verification_actor_bound', true,
      'session_verification_actor_source',
        'academy_private.student_session_grants.issued_by',
      'session_verification_two_arg_overload_retained', true,
      'session_verification_actor_execute_role', 'service_role'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_verify_session_v1(text, text, uuid) is
  'Actor-bound Study session verification. Binds the gateway actor verified by the trusted server to student_session_grants.issued_by and otherwise preserves the two-argument verified identity predicate and envelope. Denials are deliberately indistinguishable. Executable by service_role only.';

commit;
