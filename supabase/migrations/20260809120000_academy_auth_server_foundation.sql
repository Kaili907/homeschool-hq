-- Academy Sync Protocol v2 and trusted Parent installation server foundation.
--
-- This migration is deliberately additive. The legacy Academy sync RPCs remain
-- executable until the later credential-cleanup and cutover migration. Protocol
-- control defaults are therefore safe for the currently deployed client.

do $collision_guard$
begin
  if to_regclass('academy_private.academy_sync_protocol_control') is not null
     or to_regclass('academy_private.parent_installation_capabilities') is not null
     or to_regclass('academy_private.parent_installation_bindings') is not null
     or to_regclass('academy_private.parent_installation_grants') is not null
     or to_regprocedure('public.academy_sync_snapshot_v2(integer)') is not null
     or to_regprocedure(
       'public.academy_apply_profile_mutation_v2(integer,bigint,text,jsonb)'
     ) is not null then
    raise exception
      'Academy auth server foundation collision requires reconciliation';
  end if;
end;
$collision_guard$;

create table academy_private.academy_sync_protocol_control (
  singleton boolean primary key default true check (singleton),
  current_protocol integer not null check (current_protocol >= 1),
  minimum_supported_protocol integer not null check (
    minimum_supported_protocol >= 1
    and minimum_supported_protocol <= current_protocol
  ),
  mode text not null check (mode in ('normal', 'maintenance')),
  credential_policy text not null check (
    credential_policy in ('legacy_compatible', 'reject_legacy_credentials')
  ),
  legacy_rpc_enabled boolean not null,
  updated_at timestamptz not null default now(),
  constraint academy_sync_protocol_control_safe_foundation_check check (
    not legacy_rpc_enabled
    or credential_policy = 'legacy_compatible'
  )
);

insert into academy_private.academy_sync_protocol_control (
  current_protocol,
  minimum_supported_protocol,
  mode,
  credential_policy,
  legacy_rpc_enabled
) values (2, 1, 'normal', 'legacy_compatible', true);

create table academy_private.parent_installation_capabilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  membership_id uuid not null,
  actor_user_id uuid not null,
  capability text not null check (
    capability in (
      'parent_installation:claim',
      'parent_installation:recover'
    )
  ),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint parent_installation_capabilities_membership_fk
    foreign key (membership_id, household_id)
    references public.academy_household_memberships (id, household_id)
    on delete restrict,
  constraint parent_installation_capabilities_unique
    unique (membership_id, capability),
  constraint parent_installation_capabilities_status_dates_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index parent_installation_capabilities_actor_idx
  on academy_private.parent_installation_capabilities (
    actor_user_id,
    household_id,
    capability
  );

create table academy_private.parent_installation_bindings (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null check (
    installation_id::text ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  dataset_epoch uuid not null check (
    dataset_epoch::text ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  binding_revision bigint not null default 1
    check (binding_revision >= 1),
  session_generation bigint not null default 1
    check (session_generation >= 1),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  bound_by uuid not null,
  bound_at timestamptz not null default now(),
  last_recovered_at timestamptz,
  last_local_credential_enrollment_id uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_installation_bindings_status_dates_check check (
    (
      status = 'active'
      and revoked_at is null
      and revoked_by is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_by is not null
      and revocation_reason in ('manager_revoke', 'security_revoke')
    )
  ),
  constraint parent_installation_bindings_recovery_check check (
    (
      last_recovered_at is null
      and last_local_credential_enrollment_id is null
    )
    or (
      last_recovered_at is not null
      and last_local_credential_enrollment_id is not null
    )
  )
);

create unique index parent_installation_bindings_one_active_idx
  on academy_private.parent_installation_bindings (installation_id)
  where status = 'active';

create index parent_installation_bindings_household_idx
  on academy_private.parent_installation_bindings (
    household_id,
    installation_id,
    created_at desc
  );

create table academy_private.parent_installation_grants (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (
    token_digest ~ '^[0-9a-f]{64}$'
  ),
  household_id uuid not null
    references public.academy_households (id) on delete restrict,
  membership_id uuid not null,
  actor_user_id uuid not null,
  installation_id uuid not null check (
    installation_id::text ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  dataset_epoch uuid not null check (
    dataset_epoch::text ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  purpose text not null check (
    purpose in ('first_claim', 'legacy_upgrade', 'recovery')
  ),
  capability_id uuid not null
    references academy_private.parent_installation_capabilities (id)
    on delete restrict,
  capability text not null check (
    capability in (
      'parent_installation:claim',
      'parent_installation:recover'
    )
  ),
  authority_revision bigint not null check (authority_revision >= 1),
  expected_binding_revision bigint check (expected_binding_revision >= 1),
  expected_session_generation bigint check (expected_session_generation >= 1),
  status text not null default 'issued'
    check (status in ('issued', 'consumed', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  issued_correlation_id uuid not null,
  consumed_correlation_id uuid,
  constraint parent_installation_grants_membership_fk
    foreign key (membership_id, household_id)
    references public.academy_household_memberships (id, household_id)
    on delete restrict,
  constraint parent_installation_grants_lifetime_check check (
    expires_at > issued_at
    and expires_at <= issued_at + interval '10 minutes'
  ),
  constraint parent_installation_grants_purpose_capability_check check (
    (
      purpose in ('first_claim', 'legacy_upgrade')
      and capability = 'parent_installation:claim'
    )
    or (
      purpose = 'recovery'
      and capability = 'parent_installation:recover'
    )
  ),
  constraint parent_installation_grants_authorization_epoch_check check (
    (
      purpose = 'recovery'
      and expected_binding_revision is not null
      and expected_session_generation is not null
    )
    or (
      purpose in ('first_claim', 'legacy_upgrade')
      and expected_binding_revision is null
      and expected_session_generation is null
    )
  ),
  constraint parent_installation_grants_status_dates_check check (
    (
      status = 'issued'
      and consumed_at is null
      and revoked_at is null
      and consumed_correlation_id is null
    )
    or (
      status = 'consumed'
      and consumed_at is not null
      and revoked_at is null
      and consumed_correlation_id is not null
    )
    or (
      status = 'revoked'
      and consumed_at is null
      and revoked_at is not null
      and consumed_correlation_id is null
    )
  )
);

create index parent_installation_grants_lookup_idx
  on academy_private.parent_installation_grants (token_digest);

create index parent_installation_grants_active_idx
  on academy_private.parent_installation_grants (
    actor_user_id,
    installation_id,
    purpose,
    expires_at
  )
  where status = 'issued';

create function academy_private.parent_installation_uuid_is_v4(
  candidate uuid
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog
as $function$
  select candidate is not null
    and candidate::text ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$function$;

create function academy_private.current_parent_installation_capability(
  p_household_id uuid,
  p_capability text
)
returns academy_private.parent_installation_capabilities
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  authority academy_private.parent_installation_capabilities%rowtype;
begin
  select capability_row.*
    into authority
    from academy_private.parent_installation_capabilities as capability_row
    join public.academy_household_memberships as membership
      on membership.id = capability_row.membership_id
     and membership.household_id = capability_row.household_id
    join public.academy_households as household
      on household.id = capability_row.household_id
   where capability_row.household_id = p_household_id
     and capability_row.actor_user_id = auth.uid()
     and capability_row.capability = p_capability
     and capability_row.status = 'active'
     and capability_row.revoked_at is null
     and membership.user_id = auth.uid()
     and membership.member_role = 'guardian'
     and membership.status = 'active'
     and membership.revoked_at is null
     and household.status = 'active'
   limit 1
   for key share of capability_row, membership, household;

  return authority;
end;
$function$;

create function academy_private.academy_sync_v2_gate(
  p_protocol_version integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  control academy_private.academy_sync_protocol_control%rowtype;
begin
  select value.*
    into strict control
    from academy_private.academy_sync_protocol_control as value
   where value.singleton;

  if p_protocol_version is null
     or p_protocol_version < control.minimum_supported_protocol
     or p_protocol_version > control.current_protocol then
    return jsonb_build_object(
      'status', 'update-required',
      'syncProtocolVersion', control.current_protocol,
      'minimumSupportedSyncVersion', control.minimum_supported_protocol
    );
  end if;

  if control.mode = 'maintenance' then
    return jsonb_build_object(
      'status', 'maintenance',
      'syncProtocolVersion', control.current_protocol,
      'minimumSupportedSyncVersion', control.minimum_supported_protocol
    );
  end if;

  return null;
end;
$function$;

create function academy_private.academy_sync_payload_has_legacy_credentials(
  p_profiles jsonb
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(
    jsonb_typeof(p_profiles) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(p_profiles) as item(value)
      where jsonb_typeof(item.value) = 'object'
        and jsonb_typeof(item.value->'data') = 'object'
        and item.value->'data' ? 'pin'
    ),
    false
  )
$function$;

create function academy_private.consume_parent_installation_grant(
  p_token_digest text,
  p_installation_id uuid,
  p_dataset_epoch uuid,
  p_purpose text,
  p_correlation_id uuid
)
returns academy_private.parent_installation_grants
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  grant_row academy_private.parent_installation_grants%rowtype;
  authority academy_private.parent_installation_capabilities%rowtype;
  target_binding academy_private.parent_installation_bindings%rowtype;
begin
  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or not academy_private.parent_installation_uuid_is_v4(p_installation_id)
     or not academy_private.parent_installation_uuid_is_v4(p_dataset_epoch)
     or p_purpose not in ('first_claim', 'legacy_upgrade', 'recovery')
     or not academy_private.parent_installation_uuid_is_v4(p_correlation_id)
     or auth.uid() is null then
    raise exception 'Parent installation grant denied'
      using errcode = '42501';
  end if;

  -- Recovery serializes on the installation binding before the grant row.
  -- Every recovery path uses this same lock order, so two old-generation
  -- grants cannot both validate before the authorization epoch rotates.
  if p_purpose = 'recovery' then
    select stored.*
      into target_binding
      from academy_private.parent_installation_bindings as stored
     where stored.installation_id = p_installation_id
       and stored.dataset_epoch = p_dataset_epoch
       and stored.status = 'active'
       and stored.revoked_at is null
     for update;

    if not found then
      raise exception 'Parent installation grant denied'
        using errcode = '42501';
    end if;
  end if;

  select stored.*
    into grant_row
    from academy_private.parent_installation_grants as stored
   where stored.token_digest = p_token_digest
   for update;

  if not found
     or grant_row.status <> 'issued'
     or grant_row.consumed_at is not null
     or grant_row.revoked_at is not null
     or grant_row.expires_at <= now()
     or grant_row.actor_user_id <> auth.uid()
     or grant_row.installation_id <> p_installation_id
     or grant_row.dataset_epoch <> p_dataset_epoch
     or grant_row.purpose <> p_purpose
     or (
       p_purpose = 'recovery'
       and (
         grant_row.household_id <> target_binding.household_id
         or grant_row.expected_binding_revision
              is distinct from target_binding.binding_revision
         or grant_row.expected_session_generation
              is distinct from target_binding.session_generation
       )
     ) then
    raise exception 'Parent installation grant denied'
      using errcode = '42501';
  end if;

  authority := academy_private.current_parent_installation_capability(
    grant_row.household_id,
    grant_row.capability
  );
  if authority.id is null
     or authority.id <> grant_row.capability_id
     or authority.membership_id <> grant_row.membership_id
     or authority.actor_user_id <> grant_row.actor_user_id
     or authority.authority_revision <> grant_row.authority_revision then
    raise exception 'Parent installation grant denied'
      using errcode = '42501';
  end if;

  update academy_private.parent_installation_grants
     set status = 'consumed',
         consumed_at = now(),
         consumed_correlation_id = p_correlation_id
   where id = grant_row.id
  returning * into grant_row;

  return grant_row;
end;
$function$;

create function public.academy_sync_protocol_status_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  control academy_private.academy_sync_protocol_control%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Academy sync requires authentication'
      using errcode = '28000';
  end if;

  select value.*
    into strict control
    from academy_private.academy_sync_protocol_control as value
   where value.singleton;

  return jsonb_build_object(
    'syncProtocolVersion', control.current_protocol,
    'minimumSupportedSyncVersion', control.minimum_supported_protocol,
    'mode', control.mode
  );
end;
$function$;

create function public.academy_sync_snapshot_v2(
  p_protocol_version integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  caller_household_id uuid := auth.uid();
  rejection jsonb;
  snapshot jsonb;
begin
  -- The legacy sync authority model derives the household boundary directly
  -- from auth.uid(). Authenticate before protocol-control or data access.
  if caller_household_id is null then
    raise exception 'Academy sync requires an authenticated household'
      using errcode = '28000';
  end if;

  rejection := academy_private.academy_sync_v2_gate(p_protocol_version);
  if rejection is not null then
    return rejection;
  end if;

  snapshot := public.academy_sync_snapshot();
  return snapshot || jsonb_build_object(
    'syncProtocolVersion', p_protocol_version
  );
end;
$function$;

create function public.academy_apply_profile_mutation_v2(
  p_protocol_version integer,
  p_expected_revision bigint,
  p_mutation_id text,
  p_profiles jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  caller_household_id uuid := auth.uid();
  rejection jsonb;
  credential_policy text;
  mutation_result jsonb;
begin
  -- Preserve the legacy sync authority model while denying unauthenticated
  -- callers before protocol, maintenance, or credential-policy disclosure.
  if caller_household_id is null then
    raise exception 'Academy sync requires an authenticated household'
      using errcode = '28000';
  end if;

  -- After authentication, the gate still precedes validation, receipt work,
  -- the CAS lock, and profile writes.
  rejection := academy_private.academy_sync_v2_gate(p_protocol_version);
  if rejection is not null then
    return rejection;
  end if;

  select control.credential_policy
    into strict credential_policy
    from academy_private.academy_sync_protocol_control as control
   where control.singleton;

  if credential_policy = 'reject_legacy_credentials'
     and academy_private.academy_sync_payload_has_legacy_credentials(
       p_profiles
     ) then
    raise exception 'Academy credential-bearing sync payload rejected'
      using errcode = '22023';
  end if;

  mutation_result := public.academy_apply_profile_mutation(
    p_expected_revision,
    p_mutation_id,
    p_profiles
  );
  return mutation_result || jsonb_build_object(
    'syncProtocolVersion', p_protocol_version
  );
end;
$function$;

create function public.academy_parent_installation_status_v1(
  p_household_id uuid,
  p_installation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  claim_authority academy_private.parent_installation_capabilities%rowtype;
  recover_authority academy_private.parent_installation_capabilities%rowtype;
  binding academy_private.parent_installation_bindings%rowtype;
begin
  if not academy_private.parent_installation_uuid_is_v4(p_household_id)
     or not academy_private.parent_installation_uuid_is_v4(p_installation_id)
     or auth.uid() is null then
    raise exception 'Parent installation status denied'
      using errcode = '42501';
  end if;

  claim_authority := academy_private.current_parent_installation_capability(
    p_household_id,
    'parent_installation:claim'
  );
  recover_authority := academy_private.current_parent_installation_capability(
    p_household_id,
    'parent_installation:recover'
  );
  if claim_authority.id is null and recover_authority.id is null then
    raise exception 'Parent installation status denied'
      using errcode = '42501';
  end if;

  select stored.*
    into binding
    from academy_private.parent_installation_bindings as stored
   where stored.household_id = p_household_id
     and stored.installation_id = p_installation_id
   order by stored.created_at desc, stored.id desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'unclaimed',
      'installationId', p_installation_id
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'status', binding.status,
    'bindingId', binding.id,
    'installationId', binding.installation_id,
    'householdId', binding.household_id,
    'datasetEpoch', binding.dataset_epoch,
    'bindingRevision', binding.binding_revision::text,
    'sessionGeneration', binding.session_generation::text,
    'boundAt', binding.bound_at,
    'lastRecoveredAt', binding.last_recovered_at,
    'revokedAt', binding.revoked_at
  ));
end;
$function$;

create function public.academy_parent_issue_installation_grant_v1(
  p_household_id uuid,
  p_installation_id uuid,
  p_dataset_epoch uuid,
  p_purpose text,
  p_token_digest text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  required_capability text;
  authority academy_private.parent_installation_capabilities%rowtype;
  issuance_binding academy_private.parent_installation_bindings%rowtype;
  issued academy_private.parent_installation_grants%rowtype;
begin
  required_capability := case
    when p_purpose in ('first_claim', 'legacy_upgrade')
      then 'parent_installation:claim'
    when p_purpose = 'recovery'
      then 'parent_installation:recover'
    else null
  end;

  if not academy_private.parent_installation_uuid_is_v4(p_household_id)
     or not academy_private.parent_installation_uuid_is_v4(p_installation_id)
     or not academy_private.parent_installation_uuid_is_v4(p_dataset_epoch)
     or not academy_private.parent_installation_uuid_is_v4(p_correlation_id)
     or p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or required_capability is null
     or auth.uid() is null then
    raise exception 'Parent installation grant issuance denied'
      using errcode = '42501';
  end if;

  authority := academy_private.current_parent_installation_capability(
    p_household_id,
    required_capability
  );
  if authority.id is null then
    raise exception 'Parent installation grant issuance denied'
      using errcode = '42501';
  end if;

  if p_purpose = 'recovery' then
    -- Capture the current server-side authorization epoch while preventing a
    -- concurrent recovery/revocation from rotating it during issuance.
    select stored.*
      into issuance_binding
      from academy_private.parent_installation_bindings as stored
     where stored.installation_id = p_installation_id
       and stored.household_id = p_household_id
       and stored.dataset_epoch = p_dataset_epoch
       and stored.status = 'active'
       and stored.revoked_at is null
     for update;

    if not found then
      raise exception 'Parent installation grant issuance denied'
        using errcode = '42501';
    end if;
  elsif exists (
    select 1
    from academy_private.parent_installation_bindings as binding
    where binding.installation_id = p_installation_id
      and binding.status = 'active'
  ) then
    raise exception 'Parent installation grant issuance denied'
      using errcode = '42501';
  end if;

  update academy_private.parent_installation_grants
     set status = 'revoked',
         revoked_at = now()
   where actor_user_id = auth.uid()
     and installation_id = p_installation_id
     and purpose = p_purpose
     and status = 'issued';

  insert into academy_private.parent_installation_grants (
    token_digest,
    household_id,
    membership_id,
    actor_user_id,
    installation_id,
    dataset_epoch,
    purpose,
    capability_id,
    capability,
    authority_revision,
    expected_binding_revision,
    expected_session_generation,
    expires_at,
    issued_correlation_id
  ) values (
    p_token_digest,
    p_household_id,
    authority.membership_id,
    auth.uid(),
    p_installation_id,
    p_dataset_epoch,
    p_purpose,
    authority.id,
    authority.capability,
    authority.authority_revision,
    case
      when p_purpose = 'recovery' then issuance_binding.binding_revision
    end,
    case
      when p_purpose = 'recovery' then issuance_binding.session_generation
    end,
    now() + interval '10 minutes',
    p_correlation_id
  )
  returning * into issued;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'issued',
    'grantId', issued.id,
    'installationId', issued.installation_id,
    'datasetEpoch', issued.dataset_epoch,
    'purpose', issued.purpose,
    'capability', issued.capability,
    'issuedAt', issued.issued_at,
    'expiresAt', issued.expires_at,
    'correlationId', issued.issued_correlation_id
  );
end;
$function$;

create function public.academy_parent_claim_installation_v1(
  p_installation_id uuid,
  p_dataset_epoch uuid,
  p_purpose text,
  p_token_digest text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  consumed academy_private.parent_installation_grants%rowtype;
  binding academy_private.parent_installation_bindings%rowtype;
begin
  if p_purpose not in ('first_claim', 'legacy_upgrade') then
    raise exception 'Parent installation claim denied'
      using errcode = '42501';
  end if;

  consumed := academy_private.consume_parent_installation_grant(
    p_token_digest,
    p_installation_id,
    p_dataset_epoch,
    p_purpose,
    p_correlation_id
  );

  if exists (
    select 1
    from academy_private.parent_installation_bindings as existing
    where existing.installation_id = p_installation_id
      and existing.status = 'active'
  ) then
    raise exception 'Parent installation claim denied'
      using errcode = '42501';
  end if;

  insert into academy_private.parent_installation_bindings (
    installation_id,
    household_id,
    dataset_epoch,
    bound_by
  ) values (
    p_installation_id,
    consumed.household_id,
    p_dataset_epoch,
    auth.uid()
  )
  returning * into binding;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'active',
    'bindingId', binding.id,
    'installationId', binding.installation_id,
    'householdId', binding.household_id,
    'datasetEpoch', binding.dataset_epoch,
    'bindingRevision', binding.binding_revision::text,
    'sessionGeneration', binding.session_generation::text,
    'boundAt', binding.bound_at,
    'correlationId', p_correlation_id
  );
end;
$function$;

create function public.academy_parent_recover_installation_v1(
  p_installation_id uuid,
  p_dataset_epoch uuid,
  p_token_digest text,
  p_local_credential_enrollment_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  consumed academy_private.parent_installation_grants%rowtype;
  binding academy_private.parent_installation_bindings%rowtype;
begin
  if not academy_private.parent_installation_uuid_is_v4(
    p_local_credential_enrollment_id
  ) then
    raise exception 'Parent installation recovery denied'
      using errcode = '42501';
  end if;

  consumed := academy_private.consume_parent_installation_grant(
    p_token_digest,
    p_installation_id,
    p_dataset_epoch,
    'recovery',
    p_correlation_id
  );

  update academy_private.parent_installation_bindings
     set binding_revision = binding_revision + 1,
         session_generation = session_generation + 1,
         last_recovered_at = now(),
         last_local_credential_enrollment_id =
           p_local_credential_enrollment_id,
         updated_at = now()
   where installation_id = p_installation_id
     and household_id = consumed.household_id
     and dataset_epoch = p_dataset_epoch
     and binding_revision = consumed.expected_binding_revision
     and session_generation = consumed.expected_session_generation
     and status = 'active'
     and revoked_at is null
  returning * into binding;

  if not found then
    raise exception 'Parent installation recovery denied'
      using errcode = '42501';
  end if;

  -- The successful rotation ends every outstanding authority-transition grant
  -- for this installation and dataset. The consumed grant is already excluded
  -- by status; unrelated household grants are untouched.
  update academy_private.parent_installation_grants
     set status = 'revoked',
         revoked_at = now()
   where household_id = consumed.household_id
     and installation_id = p_installation_id
     and dataset_epoch = p_dataset_epoch
     and purpose in ('first_claim', 'legacy_upgrade', 'recovery')
     and status = 'issued';

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'active',
    'bindingId', binding.id,
    'installationId', binding.installation_id,
    'householdId', binding.household_id,
    'datasetEpoch', binding.dataset_epoch,
    'bindingRevision', binding.binding_revision::text,
    'sessionGeneration', binding.session_generation::text,
    'recoveredAt', binding.last_recovered_at,
    'correlationId', p_correlation_id
  );
end;
$function$;

create function public.academy_parent_revoke_installation_v1(
  p_household_id uuid,
  p_installation_id uuid,
  p_dataset_epoch uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  authority academy_private.parent_installation_capabilities%rowtype;
  binding academy_private.parent_installation_bindings%rowtype;
begin
  if not academy_private.parent_installation_uuid_is_v4(p_household_id)
     or not academy_private.parent_installation_uuid_is_v4(p_installation_id)
     or not academy_private.parent_installation_uuid_is_v4(p_dataset_epoch)
     or not academy_private.parent_installation_uuid_is_v4(p_correlation_id)
     or auth.uid() is null then
    raise exception 'Parent installation revocation denied'
      using errcode = '42501';
  end if;

  authority := academy_private.current_parent_installation_capability(
    p_household_id,
    'parent_installation:recover'
  );
  if authority.id is null then
    raise exception 'Parent installation revocation denied'
      using errcode = '42501';
  end if;

  update academy_private.parent_installation_bindings
     set binding_revision = binding_revision + 1,
         session_generation = session_generation + 1,
         status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revocation_reason = 'manager_revoke',
         updated_at = now()
   where installation_id = p_installation_id
     and household_id = p_household_id
     and dataset_epoch = p_dataset_epoch
     and status = 'active'
     and revoked_at is null
  returning * into binding;

  if not found then
    raise exception 'Parent installation revocation denied'
      using errcode = '42501';
  end if;

  update academy_private.parent_installation_grants
     set status = 'revoked',
         revoked_at = now()
   where household_id = p_household_id
     and installation_id = p_installation_id
     and status = 'issued';

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'revoked',
    'bindingId', binding.id,
    'installationId', binding.installation_id,
    'householdId', binding.household_id,
    'datasetEpoch', binding.dataset_epoch,
    'bindingRevision', binding.binding_revision::text,
    'sessionGeneration', binding.session_generation::text,
    'revokedAt', binding.revoked_at,
    'correlationId', p_correlation_id
  );
end;
$function$;

alter table academy_private.academy_sync_protocol_control
  enable row level security;
alter table academy_private.academy_sync_protocol_control
  force row level security;
alter table academy_private.parent_installation_capabilities
  enable row level security;
alter table academy_private.parent_installation_capabilities
  force row level security;
alter table academy_private.parent_installation_bindings
  enable row level security;
alter table academy_private.parent_installation_bindings
  force row level security;
alter table academy_private.parent_installation_grants
  enable row level security;
alter table academy_private.parent_installation_grants
  force row level security;

alter table academy_private.academy_sync_protocol_control owner to postgres;
alter table academy_private.parent_installation_capabilities owner to postgres;
alter table academy_private.parent_installation_bindings owner to postgres;
alter table academy_private.parent_installation_grants owner to postgres;

alter function academy_private.parent_installation_uuid_is_v4(uuid)
  owner to postgres;
alter function academy_private.current_parent_installation_capability(uuid, text)
  owner to postgres;
alter function academy_private.academy_sync_v2_gate(integer)
  owner to postgres;
alter function academy_private.academy_sync_payload_has_legacy_credentials(jsonb)
  owner to postgres;
alter function academy_private.consume_parent_installation_grant(
  text, uuid, uuid, text, uuid
) owner to postgres;
alter function public.academy_sync_protocol_status_v1() owner to postgres;
alter function public.academy_sync_snapshot_v2(integer) owner to postgres;
alter function public.academy_apply_profile_mutation_v2(
  integer, bigint, text, jsonb
) owner to postgres;
alter function public.academy_parent_installation_status_v1(uuid, uuid)
  owner to postgres;
alter function public.academy_parent_issue_installation_grant_v1(
  uuid, uuid, uuid, text, text, uuid
) owner to postgres;
alter function public.academy_parent_claim_installation_v1(
  uuid, uuid, text, text, uuid
) owner to postgres;
alter function public.academy_parent_recover_installation_v1(
  uuid, uuid, text, uuid, uuid
) owner to postgres;
alter function public.academy_parent_revoke_installation_v1(
  uuid, uuid, uuid, uuid
) owner to postgres;

revoke all on table academy_private.academy_sync_protocol_control
  from public, anon, authenticated, service_role;
revoke all on table academy_private.parent_installation_capabilities
  from public, anon, authenticated, service_role;
revoke all on table academy_private.parent_installation_bindings
  from public, anon, authenticated, service_role;
revoke all on table academy_private.parent_installation_grants
  from public, anon, authenticated, service_role;

revoke all on function academy_private.parent_installation_uuid_is_v4(uuid)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.current_parent_installation_capability(
  uuid, text
) from public, anon, authenticated, service_role;
revoke all on function academy_private.academy_sync_v2_gate(integer)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.academy_sync_payload_has_legacy_credentials(
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function academy_private.consume_parent_installation_grant(
  text, uuid, uuid, text, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.academy_sync_protocol_status_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.academy_sync_snapshot_v2(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_apply_profile_mutation_v2(
  integer, bigint, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.academy_parent_installation_status_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_parent_issue_installation_grant_v1(
  uuid, uuid, uuid, text, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.academy_parent_claim_installation_v1(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.academy_parent_recover_installation_v1(
  uuid, uuid, text, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.academy_parent_revoke_installation_v1(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.academy_sync_protocol_status_v1()
  to authenticated;
grant execute on function public.academy_sync_snapshot_v2(integer)
  to authenticated;
grant execute on function public.academy_apply_profile_mutation_v2(
  integer, bigint, text, jsonb
) to authenticated;
grant execute on function public.academy_parent_installation_status_v1(uuid, uuid)
  to authenticated;
grant execute on function public.academy_parent_issue_installation_grant_v1(
  uuid, uuid, uuid, text, text, uuid
) to authenticated;
grant execute on function public.academy_parent_claim_installation_v1(
  uuid, uuid, text, text, uuid
) to authenticated;
grant execute on function public.academy_parent_recover_installation_v1(
  uuid, uuid, text, uuid, uuid
) to authenticated;
grant execute on function public.academy_parent_revoke_installation_v1(
  uuid, uuid, uuid, uuid
) to authenticated;

comment on table academy_private.academy_sync_protocol_control is
  'Private protocol floor, maintenance, staged credential, and legacy retirement control.';
comment on table academy_private.parent_installation_capabilities is
  'Explicit normalized installation-manager authority; guardian, PIN, Study, and Admin authority do not imply rows.';
comment on table academy_private.parent_installation_bindings is
  'Non-secret UUIDv4 Parent installation bindings with revision and revocation generations.';
comment on table academy_private.parent_installation_grants is
  'Private one-time Parent installation grants; token digests only, never raw grants or PINs.';
