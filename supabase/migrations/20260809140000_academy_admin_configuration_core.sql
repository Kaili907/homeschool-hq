begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy admin configuration migration must run as postgres';
  end if;
end;
$$;

create table academy_private.admin_configuration_registry (
  setting_key text primary key
    check (setting_key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$'),
  value_kind text not null
    check (value_kind in ('boolean', 'bounded_integer', 'integer_micros', 'tier_set', 'tier')),
  required_capability text not null check (required_capability = 'configuration:manage'),
  protective_capability text check (
    protective_capability is null or protective_capability = 'engines:operate'
  ),
  resource_type text not null check (resource_type = 'configuration'),
  audit_action text not null check (audit_action = 'configuration.update'),
  minimum_value text,
  maximum_value text,
  allowed_values text[],
  warning_level text not null check (warning_level in ('warning', 'critical')),
  deployment_ceiling_type text not null check (deployment_ceiling_type in (
    'boolean_enablement', 'integer_maximum', 'integer_micros_maximum',
    'allowlist_subset', 'allowlist_member'
  )),
  registry_version integer not null check (registry_version = 1),
  integration_status text not null default 'pending_runtime_integration'
    check (integration_status = 'pending_runtime_integration'),
  constraint admin_configuration_registry_shape_check check (
    (value_kind = 'boolean' and minimum_value is null and maximum_value is null
      and allowed_values is null)
    or (value_kind in ('bounded_integer', 'integer_micros')
      and minimum_value is not null and maximum_value is not null
      and allowed_values is null)
    or (value_kind in ('tier_set', 'tier')
      and minimum_value is null and maximum_value is null
      and allowed_values = array['sonnet', 'haiku']::text[])
  ),
  constraint admin_configuration_registry_protective_check check (
    (setting_key in ('runtime.ai.enabled', 'runtime.tts.enabled')
      and protective_capability = 'engines:operate')
    or (setting_key not in ('runtime.ai.enabled', 'runtime.tts.enabled')
      and protective_capability is null)
  )
);

create table academy_private.admin_configuration_revisions (
  setting_key text not null references academy_private.admin_configuration_registry (setting_key)
    on delete restrict,
  revision bigint not null check (revision > 0),
  value jsonb not null,
  value_digest text not null check (value_digest ~ '^[0-9a-f]{32}$'),
  actor_user_ref uuid references auth.users (id) on delete restrict,
  actor_role text check (actor_role is null or actor_role = 'owner'),
  actor_assignment_ref uuid references public.academy_admin_role_assignments (id) on delete restrict,
  reason_code text not null,
  request_id uuid,
  confirmation_id uuid,
  created_at timestamptz not null default now(),
  primary key (setting_key, revision),
  constraint admin_configuration_revisions_actor_check check (
    (revision = 1 and actor_user_ref is null and actor_role is null
      and actor_assignment_ref is null and request_id is null and confirmation_id is null
      and reason_code = 'deployment.seed')
    or (revision > 1 and actor_user_ref is not null and actor_role = 'owner'
      and actor_assignment_ref is not null and request_id is not null
      and confirmation_id is not null)
  )
);

create table academy_private.admin_configuration_heads (
  setting_key text primary key references academy_private.admin_configuration_registry (setting_key)
    on delete restrict,
  current_revision bigint not null check (current_revision > 0),
  updated_at timestamptz not null default now(),
  foreign key (setting_key, current_revision)
    references academy_private.admin_configuration_revisions (setting_key, revision)
    on delete restrict
);

create table academy_private.admin_change_confirmations (
  confirmation_id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  actor_assignment_ref uuid not null references public.academy_admin_role_assignments (id)
    on delete restrict,
  setting_key text not null references academy_private.admin_configuration_registry (setting_key)
    on delete restrict,
  expected_revision bigint not null check (expected_revision > 0),
  new_value_digest text not null check (new_value_digest ~ '^[0-9a-f]{32}$'),
  reason_code text not null,
  warning_level text not null check (warning_level in ('warning', 'critical')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint admin_change_confirmations_lifetime_check check (
    expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'
  ),
  constraint admin_change_confirmations_consumed_check check (
    consumed_at is null or consumed_at >= issued_at
  )
);

create table academy_private.admin_mutation_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  immutable_payload_digest text not null check (immutable_payload_digest ~ '^[0-9a-f]{32}$'),
  setting_key text not null references academy_private.admin_configuration_registry (setting_key)
    on delete restrict,
  expected_revision bigint not null check (expected_revision > 0),
  result_revision bigint,
  result_value_digest text check (
    result_value_digest is null or result_value_digest ~ '^[0-9a-f]{32}$'
  ),
  confirmation_id uuid references academy_private.admin_change_confirmations (confirmation_id)
    on delete restrict,
  audit_event_id uuid references academy_private.admin_audit_events (event_id)
    on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_user_ref, request_id),
  constraint admin_mutation_receipts_result_check check (
    (status = 'pending' and result_revision is null and result_value_digest is null
      and confirmation_id is null and audit_event_id is null and completed_at is null)
    or (status = 'completed' and result_revision is not null and result_value_digest is not null
      and confirmation_id is not null and audit_event_id is not null and completed_at is not null)
  )
);

alter table academy_private.admin_configuration_revisions
  add constraint admin_configuration_revisions_confirmation_fk
  foreign key (confirmation_id)
  references academy_private.admin_change_confirmations (confirmation_id)
  on delete restrict;
alter table academy_private.admin_mutation_receipts
  add constraint admin_mutation_receipts_revision_fk
  foreign key (setting_key, result_revision)
  references academy_private.admin_configuration_revisions (setting_key, revision)
  on delete restrict;

alter table academy_private.admin_configuration_registry owner to postgres;
alter table academy_private.admin_configuration_revisions owner to postgres;
alter table academy_private.admin_configuration_heads owner to postgres;
alter table academy_private.admin_change_confirmations owner to postgres;
alter table academy_private.admin_mutation_receipts owner to postgres;

alter table academy_private.admin_configuration_registry enable row level security;
alter table academy_private.admin_configuration_registry force row level security;
alter table academy_private.admin_configuration_revisions enable row level security;
alter table academy_private.admin_configuration_revisions force row level security;
alter table academy_private.admin_configuration_heads enable row level security;
alter table academy_private.admin_configuration_heads force row level security;
alter table academy_private.admin_change_confirmations enable row level security;
alter table academy_private.admin_change_confirmations force row level security;
alter table academy_private.admin_mutation_receipts enable row level security;
alter table academy_private.admin_mutation_receipts force row level security;

insert into academy_private.admin_configuration_registry (
  setting_key, value_kind, required_capability, protective_capability,
  resource_type, audit_action, minimum_value, maximum_value, allowed_values,
  warning_level, deployment_ceiling_type, registry_version
) values
  ('runtime.ai.enabled', 'boolean', 'configuration:manage', 'engines:operate',
   'configuration', 'configuration.update', null, null, null,
   'critical', 'boolean_enablement', 1),
  ('runtime.tts.enabled', 'boolean', 'configuration:manage', 'engines:operate',
   'configuration', 'configuration.update', null, null, null,
   'critical', 'boolean_enablement', 1),
  ('quota.ai.requests_per_account_day', 'bounded_integer', 'configuration:manage', null,
   'configuration', 'configuration.update', '1', '200', null,
   'warning', 'integer_maximum', 1),
  ('quota.tts.requests_per_account_day', 'bounded_integer', 'configuration:manage', null,
   'configuration', 'configuration.update', '1', '1000', null,
   'warning', 'integer_maximum', 1),
  ('cost.warning.monthly_micros', 'integer_micros', 'configuration:manage', null,
   'configuration', 'configuration.update', '1', '1000000000000', null,
   'warning', 'integer_micros_maximum', 1),
  ('cost.critical.monthly_micros', 'integer_micros', 'configuration:manage', null,
   'configuration', 'configuration.update', '1', '1000000000000', null,
   'critical', 'integer_micros_maximum', 1),
  ('ai.approved_tiers', 'tier_set', 'configuration:manage', null,
   'configuration', 'configuration.update', null, null, array['sonnet', 'haiku'],
   'critical', 'allowlist_subset', 1),
  ('ai.default_tier', 'tier', 'configuration:manage', null,
   'configuration', 'configuration.update', null, null, array['sonnet', 'haiku'],
   'warning', 'allowlist_member', 1);

insert into academy_private.admin_configuration_revisions (
  setting_key, revision, value, value_digest, reason_code
) values
  ('runtime.ai.enabled', 1, 'false'::jsonb, md5('false'), 'deployment.seed'),
  ('runtime.tts.enabled', 1, 'false'::jsonb, md5('false'), 'deployment.seed'),
  ('quota.ai.requests_per_account_day', 1, '50'::jsonb, md5('50'), 'deployment.seed'),
  ('quota.tts.requests_per_account_day', 1, '200'::jsonb, md5('200'), 'deployment.seed'),
  ('cost.warning.monthly_micros', 1, '"10000000"'::jsonb, md5('"10000000"'), 'deployment.seed'),
  ('cost.critical.monthly_micros', 1, '"25000000"'::jsonb, md5('"25000000"'), 'deployment.seed'),
  ('ai.approved_tiers', 1, '["sonnet","haiku"]'::jsonb,
   md5('["sonnet", "haiku"]'), 'deployment.seed'),
  ('ai.default_tier', 1, '"sonnet"'::jsonb, md5('"sonnet"'), 'deployment.seed');

insert into academy_private.admin_configuration_heads (setting_key, current_revision)
select setting_key, revision from academy_private.admin_configuration_revisions;

create function academy_private.admin_configuration_reject_registry_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy admin configuration registry is deployment-owned and immutable';
end;
$$;

create function academy_private.admin_configuration_reject_revision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Academy admin configuration revisions are append-only';
end;
$$;

alter function academy_private.admin_configuration_reject_registry_mutation() owner to postgres;
alter function academy_private.admin_configuration_reject_revision_mutation() owner to postgres;
revoke all on function academy_private.admin_configuration_reject_registry_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.admin_configuration_reject_revision_mutation()
  from public, anon, authenticated, service_role;

create trigger admin_configuration_registry_immutable
  before update or delete on academy_private.admin_configuration_registry
  for each row execute function academy_private.admin_configuration_reject_registry_mutation();
create trigger admin_configuration_revisions_append_only
  before update or delete on academy_private.admin_configuration_revisions
  for each row execute function academy_private.admin_configuration_reject_revision_mutation();

create function academy_private.admin_configuration_value(setting text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select revision.value
  from academy_private.admin_configuration_heads as head
  join academy_private.admin_configuration_revisions as revision
    on revision.setting_key = head.setting_key
   and revision.revision = head.current_revision
  where head.setting_key = setting
$$;

alter function academy_private.admin_configuration_value(text) owner to postgres;
revoke all on function academy_private.admin_configuration_value(text)
  from public, anon, authenticated, service_role;

create function academy_private.admin_configuration_reason_is_allowed(
  candidate text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate = any (array[
    'operator.request',
    'scheduled.change',
    'policy.enforcement',
    'incident.response',
    'corrective.action',
    'emergency.response',
    'configuration.changed'
  ]::text[]);
$$;

alter function academy_private.admin_configuration_reason_is_allowed(text) owner to postgres;
revoke all on function academy_private.admin_configuration_reason_is_allowed(text)
  from public, anon, authenticated, service_role;

create function academy_private.admin_configuration_validate_value(
  p_setting_key text,
  p_value jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  registry academy_private.admin_configuration_registry%rowtype;
  value_text text;
  value_number numeric;
  other_number numeric;
  default_tier text;
  item jsonb;
  tiers text[] := array[]::text[];
begin
  select * into registry
  from academy_private.admin_configuration_registry
  where setting_key = p_setting_key;
  if not found then
    raise exception 'ADMIN_CONFIGURATION_UNKNOWN_KEY' using errcode = '22023';
  end if;
  if p_value is null then
    raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
  end if;

  if registry.value_kind = 'boolean' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
  elsif registry.value_kind = 'bounded_integer' then
    value_text := p_value #>> '{}';
    if jsonb_typeof(p_value) <> 'number' or value_text !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
    value_number := value_text::numeric;
    if value_number < registry.minimum_value::numeric
       or value_number > registry.maximum_value::numeric then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
  elsif registry.value_kind = 'integer_micros' then
    value_text := p_value #>> '{}';
    if jsonb_typeof(p_value) <> 'string'
       or value_text !~ '^(0|[1-9][0-9]*)$'
       or length(value_text) > 13 then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
    value_number := value_text::numeric;
    if value_number < registry.minimum_value::numeric
       or value_number > registry.maximum_value::numeric then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
  elsif registry.value_kind = 'tier' then
    value_text := p_value #>> '{}';
    if jsonb_typeof(p_value) <> 'string'
       or not (value_text = any (registry.allowed_values)) then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
  elsif registry.value_kind = 'tier_set' then
    if jsonb_typeof(p_value) <> 'array'
       or jsonb_array_length(p_value) not between 1 and 2 then
      raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_value) loop
      value_text := item #>> '{}';
      if jsonb_typeof(item) <> 'string'
         or not (value_text = any (registry.allowed_values))
         or value_text = any (tiers) then
        raise exception 'ADMIN_CONFIGURATION_VALUE_INVALID' using errcode = '22023';
      end if;
      tiers := array_append(tiers, value_text);
    end loop;
  end if;

  if p_setting_key = 'cost.warning.monthly_micros' then
    other_number := (academy_private.admin_configuration_value(
      'cost.critical.monthly_micros'
    ) #>> '{}')::numeric;
    if value_number >= other_number then
      raise exception 'ADMIN_CONFIGURATION_CROSS_SETTING_INVALID' using errcode = '22023';
    end if;
  elsif p_setting_key = 'cost.critical.monthly_micros' then
    other_number := (academy_private.admin_configuration_value(
      'cost.warning.monthly_micros'
    ) #>> '{}')::numeric;
    if value_number <= other_number then
      raise exception 'ADMIN_CONFIGURATION_CROSS_SETTING_INVALID' using errcode = '22023';
    end if;
  elsif p_setting_key = 'ai.default_tier' then
    if not academy_private.admin_configuration_value('ai.approved_tiers') @> p_value then
      raise exception 'ADMIN_CONFIGURATION_CROSS_SETTING_INVALID' using errcode = '22023';
    end if;
  elsif p_setting_key = 'ai.approved_tiers' then
    default_tier := academy_private.admin_configuration_value('ai.default_tier') #>> '{}';
    if not p_value @> to_jsonb(default_tier) then
      raise exception 'ADMIN_CONFIGURATION_CROSS_SETTING_INVALID' using errcode = '22023';
    end if;
  end if;
end;
$$;

alter function academy_private.admin_configuration_validate_value(text, jsonb) owner to postgres;
revoke all on function academy_private.admin_configuration_validate_value(text, jsonb)
  from public, anon, authenticated, service_role;

create function academy_private.admin_configuration_audit_value(
  p_setting_key text,
  p_value jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select case
    when p_setting_key like 'runtime.%' then jsonb_build_object('enabled', p_value)
    when p_setting_key like 'quota.%' then jsonb_build_object('quota', p_value)
    when p_setting_key = 'ai.approved_tiers' then jsonb_build_object('model_tiers', p_value)
    when p_setting_key = 'ai.default_tier' then jsonb_build_object('model_tier', p_value)
    else jsonb_build_object('value', p_value)
  end
$$;

alter function academy_private.admin_configuration_audit_value(text, jsonb) owner to postgres;
revoke all on function academy_private.admin_configuration_audit_value(text, jsonb)
  from public, anon, authenticated, service_role;

create function public.academy_admin_read_configuration_v1(
  p_required_capability text default null
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
  if auth.uid() is not null
     or not academy_private.operational_is_trusted_server()
     or p_required_capability <> 'configuration:read' then
    raise exception 'ADMIN_CONFIGURATION_READ_REQUIRED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'integrationStatus', 'pending_runtime_integration',
    'settings', coalesce(jsonb_agg(jsonb_build_object(
      'key', registry.setting_key,
      'value', revision.value,
      'revision', head.current_revision::text,
      'requiredCapability', registry.required_capability,
      'protectiveCapability', registry.protective_capability,
      'warningLevel', registry.warning_level,
      'bounds', case when registry.minimum_value is null then null else jsonb_build_object(
        'minimum', registry.minimum_value, 'maximum', registry.maximum_value
      ) end,
      'allowlist', to_jsonb(registry.allowed_values),
      'deploymentCeilingType', registry.deployment_ceiling_type,
      'registryVersion', registry.registry_version,
      'integrationStatus', registry.integration_status
    ) order by registry.setting_key), '[]'::jsonb)
  ) into projection
  from academy_private.admin_configuration_registry as registry
  join academy_private.admin_configuration_heads as head
    on head.setting_key = registry.setting_key
  join academy_private.admin_configuration_revisions as revision
    on revision.setting_key = head.setting_key
   and revision.revision = head.current_revision;
  return projection;
end;
$$;

alter function public.academy_admin_read_configuration_v1(text) owner to postgres;
revoke all on function public.academy_admin_read_configuration_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_read_configuration_v1(text)
  to service_role;

create function public.academy_admin_preview_configuration_change_v1(
  p_setting_key text,
  p_expected_revision bigint,
  p_new_value jsonb,
  p_reason_code text,
  p_confirmation_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  actor_assignment uuid;
  actor_admin_role text;
  current_revision bigint;
  current_value jsonb;
  registry academy_private.admin_configuration_registry%rowtype;
  confirmation uuid := gen_random_uuid();
  issued timestamptz := statement_timestamp();
  expires timestamptz := statement_timestamp() + interval '5 minutes';
begin
  if actor_user is null or p_required_capability <> 'configuration:manage' then
    raise exception 'ADMIN_CONFIGURATION_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  select assignment.id, assignment.role into actor_assignment, actor_admin_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc limit 1;
  if actor_assignment is null or actor_admin_role <> 'owner' then
    raise exception 'ADMIN_CONFIGURATION_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1
     or p_confirmation_digest is null
     or p_confirmation_digest !~ '^[0-9a-f]{64}$'
     or p_reason_code is null
     or not academy_private.admin_configuration_reason_is_allowed(p_reason_code) then
    raise exception 'ADMIN_CONFIGURATION_REQUEST_INVALID' using errcode = '22023';
  end if;

  select * into registry from academy_private.admin_configuration_registry
  where setting_key = p_setting_key;
  if not found then
    raise exception 'ADMIN_CONFIGURATION_UNKNOWN_KEY' using errcode = '22023';
  end if;
  select head.current_revision, revision.value into current_revision, current_value
  from academy_private.admin_configuration_heads as head
  join academy_private.admin_configuration_revisions as revision
    on revision.setting_key = head.setting_key and revision.revision = head.current_revision
  where head.setting_key = p_setting_key;
  if current_revision <> p_expected_revision then
    raise exception 'ADMIN_CONFIGURATION_REVISION_CONFLICT' using errcode = '40001';
  end if;
  perform academy_private.admin_configuration_validate_value(p_setting_key, p_new_value);

  insert into academy_private.admin_change_confirmations (
    confirmation_id, token_digest, actor_user_ref, actor_assignment_ref,
    setting_key, expected_revision, new_value_digest, reason_code,
    warning_level, issued_at, expires_at
  ) values (
    confirmation, p_confirmation_digest, actor_user, actor_assignment,
    p_setting_key, p_expected_revision, md5(p_new_value::text), p_reason_code,
    registry.warning_level, issued, expires
  );
  return jsonb_build_object(
    'schemaVersion', 2,
    'settingKey', p_setting_key,
    'currentValue', current_value,
    'newValue', p_new_value,
    'expectedRevision', current_revision::text,
    'warningLevel', registry.warning_level,
    'confirmationId', confirmation,
    'confirmationExpiresAt', expires,
    'integrationStatus', registry.integration_status
  );
end;
$$;

alter function public.academy_admin_preview_configuration_change_v1(
  text, bigint, jsonb, text, text, text
) owner to postgres;
revoke all on function public.academy_admin_preview_configuration_change_v1(
  text, bigint, jsonb, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_preview_configuration_change_v1(
  text, bigint, jsonb, text, text, text
) to authenticated;

create function public.academy_admin_commit_configuration_change_v1(
  p_setting_key text,
  p_expected_revision bigint,
  p_new_value jsonb,
  p_reason_code text,
  p_request_id uuid,
  p_confirmation_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  actor_assignment uuid;
  actor_admin_role text;
  registry academy_private.admin_configuration_registry%rowtype;
  confirmation academy_private.admin_change_confirmations%rowtype;
  receipt academy_private.admin_mutation_receipts%rowtype;
  current_revision bigint;
  new_revision bigint;
  current_value jsonb;
  payload_digest text;
  audit_event uuid;
begin
  if actor_user is null or p_required_capability <> 'configuration:manage' then
    raise exception 'ADMIN_CONFIGURATION_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  select assignment.id, assignment.role into actor_assignment, actor_admin_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc limit 1;
  if actor_assignment is null or actor_admin_role <> 'owner' then
    raise exception 'ADMIN_CONFIGURATION_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1
     or p_request_id is null
     or p_confirmation_digest is null
     or p_confirmation_digest !~ '^[0-9a-f]{64}$'
     or p_reason_code is null
     or not academy_private.admin_configuration_reason_is_allowed(p_reason_code) then
    raise exception 'ADMIN_CONFIGURATION_REQUEST_INVALID' using errcode = '22023';
  end if;
  select * into registry from academy_private.admin_configuration_registry
  where setting_key = p_setting_key;
  if not found then
    raise exception 'ADMIN_CONFIGURATION_UNKNOWN_KEY' using errcode = '22023';
  end if;

  payload_digest := md5(concat_ws('|', p_setting_key, p_expected_revision::text,
    p_new_value::text, p_reason_code, p_confirmation_digest));
  insert into academy_private.admin_mutation_receipts (
    actor_user_ref, request_id, immutable_payload_digest, setting_key, expected_revision
  ) values (actor_user, p_request_id, payload_digest, p_setting_key, p_expected_revision)
  on conflict (actor_user_ref, request_id) do nothing;
  if not found then
    select * into receipt from academy_private.admin_mutation_receipts
    where actor_user_ref = actor_user and request_id = p_request_id;
    if receipt.immutable_payload_digest <> payload_digest then
      raise exception 'ADMIN_CONFIGURATION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if receipt.status <> 'completed' then
      raise exception 'ADMIN_CONFIGURATION_REQUEST_IN_PROGRESS' using errcode = '40001';
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'settingKey', receipt.setting_key,
      'value', (
        select revision.value
        from academy_private.admin_configuration_revisions as revision
        where revision.setting_key = receipt.setting_key
          and revision.revision = receipt.result_revision
      ),
      'revision', receipt.result_revision::text,
      'idempotencyResult', 'replayed',
      'integrationStatus', registry.integration_status
    );
  end if;

  select * into confirmation
  from academy_private.admin_change_confirmations
  where token_digest = p_confirmation_digest and actor_user_ref = actor_user
  for update;
  if not found then
    raise exception 'ADMIN_CONFIGURATION_CONFIRMATION_INVALID' using errcode = '22023';
  end if;
  if confirmation.consumed_at is not null then
    raise exception 'ADMIN_CONFIGURATION_CONFIRMATION_REUSED' using errcode = '40001';
  end if;
  if confirmation.expires_at <= statement_timestamp() then
    raise exception 'ADMIN_CONFIGURATION_CONFIRMATION_EXPIRED' using errcode = '40001';
  end if;
  if confirmation.setting_key <> p_setting_key
     or confirmation.expected_revision <> p_expected_revision
     or confirmation.new_value_digest <> md5(p_new_value::text)
     or confirmation.reason_code <> p_reason_code
     or confirmation.warning_level <> registry.warning_level
     or confirmation.actor_assignment_ref <> actor_assignment then
    raise exception 'ADMIN_CONFIGURATION_CONFIRMATION_MISMATCH' using errcode = '22023';
  end if;

  perform 1 from academy_private.admin_configuration_heads
  order by setting_key for update;
  select head.current_revision, revision.value into current_revision, current_value
  from academy_private.admin_configuration_heads as head
  join academy_private.admin_configuration_revisions as revision
    on revision.setting_key = head.setting_key and revision.revision = head.current_revision
  where head.setting_key = p_setting_key;
  if current_revision <> p_expected_revision then
    raise exception 'ADMIN_CONFIGURATION_REVISION_CONFLICT' using errcode = '40001';
  end if;
  perform academy_private.admin_configuration_validate_value(p_setting_key, p_new_value);

  new_revision := current_revision + 1;
  update academy_private.admin_change_confirmations
  set consumed_at = statement_timestamp()
  where confirmation_id = confirmation.confirmation_id;
  insert into academy_private.admin_configuration_revisions (
    setting_key, revision, value, value_digest, actor_user_ref, actor_role,
    actor_assignment_ref, reason_code, request_id, confirmation_id
  ) values (
    p_setting_key, new_revision, p_new_value, md5(p_new_value::text),
    actor_user, actor_admin_role, actor_assignment, p_reason_code,
    p_request_id, confirmation.confirmation_id
  );
  update academy_private.admin_configuration_heads
  set current_revision = new_revision, updated_at = statement_timestamp()
  where setting_key = p_setting_key;

  audit_event := academy_private.append_admin_audit_event_v1(
    registry.audit_action,
    registry.resource_type,
    p_setting_key,
    'registry-v' || registry.registry_version::text,
    new_revision::text,
    academy_private.admin_configuration_audit_value(p_setting_key, current_value),
    academy_private.admin_configuration_audit_value(p_setting_key, p_new_value),
    p_reason_code,
    p_request_id
  );
  update academy_private.admin_mutation_receipts
  set status = 'completed', result_revision = new_revision,
      result_value_digest = md5(p_new_value::text),
      confirmation_id = confirmation.confirmation_id,
      audit_event_id = audit_event, completed_at = statement_timestamp()
  where actor_user_ref = actor_user and request_id = p_request_id;

  return jsonb_build_object(
    'schemaVersion', 2,
    'settingKey', p_setting_key,
    'value', p_new_value,
    'revision', new_revision::text,
    'idempotencyResult', 'created',
    'integrationStatus', registry.integration_status
  );
end;
$$;

alter function public.academy_admin_commit_configuration_change_v1(
  text, bigint, jsonb, text, uuid, text, text
) owner to postgres;
revoke all on function public.academy_admin_commit_configuration_change_v1(
  text, bigint, jsonb, text, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_commit_configuration_change_v1(
  text, bigint, jsonb, text, uuid, text, text
) to authenticated;

revoke all on table academy_private.admin_configuration_registry
  from public, anon, authenticated, service_role;
revoke all on table academy_private.admin_configuration_revisions
  from public, anon, authenticated, service_role;
revoke all on table academy_private.admin_configuration_heads
  from public, anon, authenticated, service_role;
revoke all on table academy_private.admin_change_confirmations
  from public, anon, authenticated, service_role;
revoke all on table academy_private.admin_mutation_receipts
  from public, anon, authenticated, service_role;

comment on table academy_private.admin_configuration_registry is
  'Deployment-owned immutable allowlist for durable Admin configuration; Admin cannot register keys.';
comment on table academy_private.admin_configuration_revisions is
  'Append-only immutable configuration history; rollback is a new revision.';
comment on function public.academy_admin_read_configuration_v1(text) is
  'Sanitized service-only configuration:read projection; values remain pending runtime integration.';
comment on function public.academy_admin_preview_configuration_change_v1(
  text, bigint, jsonb, text, text, text
) is 'Owner-only bounded confirmation issuance for a validated configuration change.';
comment on function public.academy_admin_commit_configuration_change_v1(
  text, bigint, jsonb, text, uuid, text, text
) is 'Owner-only CAS/idempotent configuration commit with same-transaction ADMIN-15 audit append.';

commit;
