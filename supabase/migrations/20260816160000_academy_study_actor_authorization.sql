begin;

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Study actor authorization migration must run as postgres';
  end if;
  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;
  if marker.verified_identity_version <> 1
     or not marker.migration_names @> array[
       '20260801160000_academy_study_verified_identity',
       '20260801190000_academy_study_final_production_reconciliation'
     ]::text[] then
    raise exception 'Study actor authorization prerequisite mismatch';
  end if;
  if to_regprocedure(
       'public.academy_study_authorize_guardian_session_v1(text,text)'
     ) is not null
     or to_regprocedure(
       'public.academy_study_authorize_guardian_action_v1(text)'
     ) is not null then
    raise exception 'Study actor authorization object collision';
  end if;
end;
$$;

-- Global Study readiness is a guardian-facing read before a learner session
-- exists. It still requires a verified actor with a current active household,
-- learner relationship, and an action-specific capability marker.
create function public.academy_study_authorize_guardian_action_v1(
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare authorized boolean := false;
begin
  if auth.uid() is null
     or academy_private.study_jwt_claim_text('academy_principal_kind') =
       'student_session_grant'
     or p_required_capability <> 'study:production-readiness:read' then
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied');
  end if;

  select exists (
    select 1
    from public.academy_household_memberships as membership
    join public.academy_households as household
      on household.id = membership.household_id
     and household.status = 'active'
    join public.academy_guardian_student_access as access
      on access.membership_id = membership.id
     and access.household_id = membership.household_id
     and access.permission_level in ('learning_manager', 'identity_manager')
     and access.status = 'active'
     and access.revoked_at is null
    join public.academy_students as student
      on student.id = access.student_id
     and student.household_id = membership.household_id
     and student.lifecycle_status = 'active'
    where membership.user_id = auth.uid()
      and membership.member_role = 'guardian'
      and membership.status = 'active'
      and membership.revoked_at is null
  ) into authorized;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when authorized then 'authorized' else 'denied' end
  );
end;
$$;

-- Actor authorization is deliberately separate from trusted-server session
-- verification. The caller's verified Supabase bearer supplies auth.uid(); a
-- service-role credential cannot invoke this function or nominate an actor.
-- The result is minimized so the authenticated client learns no household,
-- student, grant, membership, scope, or session identity.
create function public.academy_study_authorize_guardian_session_v1(
  p_token_digest text,
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare authorized boolean := false;
begin
  if auth.uid() is null
     or academy_private.study_jwt_claim_text('academy_principal_kind') =
       'student_session_grant'
     or p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_required_capability not in (
       'student:assignments:read',
       'student:attempts:create',
       'student:progress:read'
     ) then
    return jsonb_build_object('schemaVersion', 1, 'status', 'denied');
  end if;

  select exists (
    select 1
    from academy_private.student_session_grants as session_grant
    join public.academy_households as household
      on household.id = session_grant.household_id
     and household.status = 'active'
    join public.academy_students as student
      on student.id = session_grant.student_id
     and student.household_id = session_grant.household_id
     and student.lifecycle_status = 'active'
    join public.academy_household_memberships as membership
      on membership.id = session_grant.issuing_membership_id
     and membership.household_id = session_grant.household_id
     and membership.user_id = auth.uid()
     and membership.member_role = 'guardian'
     and membership.status = 'active'
     and membership.revoked_at is null
    join public.academy_guardian_student_access as access
      on access.id = session_grant.issuing_access_id
     and access.household_id = session_grant.household_id
     and access.student_id = session_grant.student_id
     and access.membership_id = membership.id
     and access.permission_level = 'identity_manager'
     and access.status = 'active'
     and access.revoked_at is null
    where session_grant.token_digest = p_token_digest
      and session_grant.grant_purpose = 'study'
      and session_grant.contract_version = 1
      and session_grant.issuance_flow = 'guardian_activation'
      and session_grant.issued_by = auth.uid()
      and session_grant.capabilities @> array[p_required_capability]::text[]
      and academy_private.is_student_session_grant_current(session_grant.id)
  ) into authorized;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', case when authorized then 'authorized' else 'denied' end
  );
end;
$$;

alter function public.academy_study_authorize_guardian_session_v1(text, text)
  owner to postgres;
alter function public.academy_study_authorize_guardian_action_v1(text)
  owner to postgres;
revoke all on function public.academy_study_authorize_guardian_session_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_study_authorize_guardian_action_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_authorize_guardian_session_v1(text, text)
  to authenticated;
grant execute on function public.academy_study_authorize_guardian_action_v1(text)
  to authenticated;

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260816160000_academy_study_actor_authorization'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'study_actor_authorization_version', 1,
      'study_actor_authorization', 'verified-bearer-guardian-grant-owner',
      'study_actor_authorization_service_role', 'denied'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function public.academy_study_authorize_guardian_session_v1(text, text) is
  'Authenticates the current guardian bearer against one exact Study grant capability without returning authority-bearing identity.';
comment on function public.academy_study_authorize_guardian_action_v1(text) is
  'Authenticates a current guardian relationship for one exact pre-session Study capability without returning household or learner identity.';

commit;
