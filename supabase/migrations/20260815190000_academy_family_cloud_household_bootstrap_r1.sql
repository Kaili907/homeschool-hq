-- Family Cloud browser onboarding R1.
--
-- The four Study Sync RPCs intentionally assume trusted household/student
-- identity already exists. A newly authenticated Parent has no safe direct-DML
-- route to create that identity. This narrow RPC derives every authority-bearing
-- identifier from auth.uid(), is idempotent under a per-user transaction lock,
-- and can create/manage learners only inside that user's one active household.

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found or marker.migration_names is null or not (marker.migration_names @> array[
    '20260813172000_academy_study_sync_lossless_v2',
    '20260814120000_academy_family_response_checkpoint_r1',
    '20260815120000_academy_family_plan_checkpoint_r1',
    '20260815180000_academy_family_session_safety_clear_shape_r1'
  ]::text[]) then
    raise exception 'Family Cloud browser onboarding prerequisites are missing';
  end if;
  if marker.migration_names @> array['20260815190000_academy_family_cloud_household_bootstrap_r1']::text[] then
    raise exception 'Family Cloud browser onboarding migration is already recorded';
  end if;
end;
$$;

create function public.academy_family_cloud_bootstrap_r1(
  p_local_learners jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  household_count integer;
  household_ref uuid;
  membership_ref uuid;
  learner jsonb;
  student_ref uuid;
  access_ref uuid;
  credential_ref uuid;
  credential_version integer;
  token_digest_value text;
  result_learners jsonb := '[]'::jsonb;
  row_value record;
  verifier_salt text;
  verifier_hash text;
begin
  if current_user_id is null
     or academy_private.study_jwt_claim_text('academy_principal_kind') = 'student_session_grant' then
    raise exception 'FAMILY_CLOUD_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if jsonb_typeof(p_local_learners) <> 'array'
     or jsonb_array_length(p_local_learners) > 24
     or exists (
       select 1
       from jsonb_array_elements(p_local_learners) as item(value)
       where not public.academy_study_json_has_exact_keys(item.value, array[
         'learnerRef', 'displayName', 'gradeLevel'
       ]::text[])
          or item.value ->> 'learnerRef' !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$'
          or length(btrim(item.value ->> 'displayName')) not between 1 and 120
          or not (
            jsonb_typeof(item.value -> 'gradeLevel') = 'null'
            or (
              jsonb_typeof(item.value -> 'gradeLevel') = 'string'
              and length(item.value ->> 'gradeLevel') between 1 and 40
            )
          )
     )
     or (
       select count(*) <> count(distinct item.value ->> 'learnerRef')
       from jsonb_array_elements(p_local_learners) as item(value)
     ) then
    raise exception 'FAMILY_CLOUD_LEARNER_INPUT_INVALID' using errcode = '22023';
  end if;

  -- Serializes first-account bootstrap without relying on a caller-selected ID.
  perform pg_catalog.pg_advisory_xact_lock(
    ('x' || substr(md5(current_user_id::text), 1, 16))::bit(64)::bigint
  );

  select count(*), min(membership.household_id::text)::uuid,
         min(membership.id::text)::uuid
  into household_count, household_ref, membership_ref
  from public.academy_household_memberships as membership
  join public.academy_households as household
    on household.id = membership.household_id
   and household.status = 'active'
  where membership.user_id = current_user_id
    and membership.member_role = 'guardian'
    and membership.status = 'active'
    and membership.revoked_at is null;

  if household_count > 1 then
    raise exception 'FAMILY_CLOUD_HOUSEHOLD_AMBIGUOUS' using errcode = '42501';
  elsif household_count = 0 then
    insert into public.academy_households(name, status, created_by)
    values ('Manuel Academy Family', 'active', current_user_id)
    returning id into household_ref;

    insert into public.academy_household_memberships(
      household_id, user_id, member_role, status, invited_at, activated_at
    ) values (
      household_ref, current_user_id, 'guardian', 'active', now(), now()
    ) returning id into membership_ref;
  end if;

  for learner in select item.value from jsonb_array_elements(p_local_learners) as item(value)
  loop
    insert into public.academy_students(
      household_id, legacy_profile_id, display_name, current_grade_level,
      lifecycle_status, lifecycle_changed_at, created_by
    ) values (
      household_ref,
      learner ->> 'learnerRef',
      btrim(learner ->> 'displayName'),
      case when jsonb_typeof(learner -> 'gradeLevel') = 'null' then null else learner ->> 'gradeLevel' end,
      'active', now(), current_user_id
    )
    on conflict (household_id, legacy_profile_id) do update
      set display_name = excluded.display_name,
          current_grade_level = excluded.current_grade_level,
          updated_at = now()
      where academy_students.household_id = household_ref
    returning id into student_ref;

    insert into public.academy_guardian_student_access(
      household_id, student_id, membership_id, permission_level,
      status, granted_at, granted_by
    ) values (
      household_ref, student_ref, membership_ref, 'identity_manager',
      'active', now(), current_user_id
    )
    on conflict (student_id, membership_id) do update
      set permission_level = 'identity_manager', status = 'active',
          revoked_at = null, revoked_by = null, revocation_reason = null,
          updated_at = now()
      where academy_guardian_student_access.household_id = household_ref;

    select credential.id, credential.credential_version
    into credential_ref, credential_version
    from academy_private.student_access_credentials as credential
    where credential.household_id = household_ref
      and credential.student_id = student_ref
      and credential.credential_kind = 'pin'
      and credential.status = 'active'
    order by credential.credential_version desc
    limit 1;

    if credential_ref is null then
      -- This random server-only launch seed is not derived from, usable as, or
      -- returned as the learner's device PIN. Device PIN verifiers remain local.
      verifier_salt := rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'base64'), E'+/=\n\r', '+/'), '=');
      verifier_hash := rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'base64'), E'+/=\n\r', '+/'), '=');
      insert into academy_private.student_access_credentials(
        household_id, student_id, credential_kind, credential_version,
        verifier_scheme, verifier_format_version, verifier_digest, status,
        created_actor_kind, created_by, creation_reason, correlation_id
      ) values (
        household_ref, student_ref, 'pin', 1,
        'scrypt', 1,
        '$scrypt$v=1$ln=14,r=8,p=1$' || verifier_salt || '$' || verifier_hash,
        'active', 'guardian', current_user_id,
        'family-cloud-server-launch-seed', gen_random_uuid()
      ) returning id into credential_ref;
      credential_version := 1;
    end if;
  end loop;

  for row_value in
    select student.id, student.legacy_profile_id, access.id as access_id,
           credential.id as credential_id, credential.credential_version,
           student.session_version
    from public.academy_students as student
    join public.academy_guardian_student_access as access
      on access.household_id = student.household_id
     and access.student_id = student.id
     and access.membership_id = membership_ref
     and access.status = 'active' and access.revoked_at is null
     and access.permission_level = 'identity_manager'
    join lateral (
      select held.id, held.credential_version
      from academy_private.student_access_credentials as held
      where held.household_id = student.household_id
        and held.student_id = student.id
        and held.credential_kind = 'pin'
        and held.status = 'active'
      order by held.credential_version desc limit 1
    ) as credential on true
    where student.household_id = household_ref
      and student.lifecycle_status = 'active'
      and student.legacy_profile_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$'
    order by student.created_at, student.id
  loop
    update academy_private.student_session_grants
      set revoked_at = now(), revoked_actor_kind = 'guardian',
          revoked_by = current_user_id, revocation_reason = 'family-cloud-directory-refreshed'
    where student_id = row_value.id
      and issued_by = current_user_id
      and issuance_flow = 'guardian_activation'
      and grant_purpose = 'study'
      and revoked_at is null;

    token_digest_value := encode(
      sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')),
      'hex'
    );
    insert into academy_private.student_session_grants(
      household_id, student_id, token_digest, capabilities,
      credential_id, credential_version, session_version,
      issuance_flow, issued_actor_kind, issued_by,
      issuing_membership_id, issuing_access_id, issuance_reason,
      correlation_id, issued_at, expires_at, grant_purpose,
      contract_version, session_epoch, authorization_revision
    ) values (
      household_ref, row_value.id, token_digest_value,
      array['student:assignments:read','student:attempts:create','student:progress:read']::text[],
      row_value.credential_id, row_value.credential_version, row_value.session_version,
      'guardian_activation', 'guardian', current_user_id,
      membership_ref, row_value.access_id, 'family-cloud-browser-sync',
      gen_random_uuid(), now(), now() + interval '15 minutes', 'study',
      1, gen_random_uuid(), row_value.session_version
    );

    result_learners := result_learners || jsonb_build_array(jsonb_build_object(
      'learnerRef', row_value.legacy_profile_id,
      'hostedStudentId', row_value.id,
      'tokenDigest', token_digest_value,
      'hostedAssignmentRef', 'family-cloud:learner-authority',
      'hostedSessionRef', left('family-cloud:session:' || row_value.id::text, 192)
    ));
  end loop;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'ready',
    'householdRef', household_ref,
    'learners', result_learners
  );
end;
$$;

alter function public.academy_family_cloud_bootstrap_r1(jsonb) owner to postgres;
revoke all on function public.academy_family_cloud_bootstrap_r1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_family_cloud_bootstrap_r1(jsonb)
  to authenticated;

comment on function public.academy_family_cloud_bootstrap_r1(jsonb) is
  'Authenticated, idempotent Family Cloud household/guardian/learner bootstrap. Household and user authority are derived only from auth.uid(); no caller-selected household, user, role, grant, credential, or hosted scope is accepted.';

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260815190000_academy_family_cloud_household_bootstrap_r1'
    ),
    updated_at = now()
where singleton;
