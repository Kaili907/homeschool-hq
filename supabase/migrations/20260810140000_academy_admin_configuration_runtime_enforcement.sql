begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy configuration runtime enforcement migration must run as postgres';
  end if;
end;
$$;

alter table academy_private.admin_configuration_registry
  disable trigger admin_configuration_registry_immutable;

alter table academy_private.admin_configuration_registry
  drop constraint admin_configuration_registry_integration_status_check;

alter table academy_private.admin_configuration_registry
  add constraint admin_configuration_registry_integration_status_check check (
    integration_status in ('pending_runtime_integration', 'runtime_enforced')
  );

update academy_private.admin_configuration_registry
set integration_status = 'runtime_enforced'
where setting_key in (
  'runtime.ai.enabled',
  'runtime.tts.enabled',
  'quota.ai.requests_per_account_day',
  'quota.tts.requests_per_account_day',
  'cost.warning.monthly_micros',
  'cost.critical.monthly_micros',
  'ai.approved_tiers',
  'ai.default_tier'
);

do $$
declare
  enforced_count integer;
  registry_count integer;
begin
  select count(*), count(*) filter (where integration_status = 'runtime_enforced')
  into registry_count, enforced_count
  from academy_private.admin_configuration_registry;
  if registry_count <> 8 or enforced_count <> 8 then
    raise exception 'ADMIN_CONFIGURATION_RUNTIME_REGISTRY_MISMATCH';
  end if;
end;
$$;

alter table academy_private.admin_configuration_registry
  enable trigger admin_configuration_registry_immutable;

create or replace function public.academy_admin_read_configuration_v1(
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
    'integrationStatus', case
      when bool_and(registry.integration_status = 'runtime_enforced') then 'runtime_enforced'
      else 'pending_runtime_integration'
    end,
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
  from public, anon, authenticated;
grant execute on function public.academy_admin_read_configuration_v1(text)
  to service_role;

comment on function public.academy_admin_read_configuration_v1(text) is
  'Sanitized service-only configuration authority with code-owned runtime-enforcement status.';

commit;
