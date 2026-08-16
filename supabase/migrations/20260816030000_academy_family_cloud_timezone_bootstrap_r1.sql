-- Family Cloud first-link timezone bootstrap repair R1.
--
-- Study session writes require a canonical household timezone row. The original
-- Family Cloud bootstrap created household, guardian, learner, and grant rows
-- but omitted that prerequisite, causing every real first-link insert to fail.
-- Preserve the original authority-minimized implementation behind a wrapper
-- that accepts the canonical School Plan timezone and establishes the missing
-- invariant in the same transaction.

do $$
declare marker academy_private.study_persistence_metadata%rowtype;
begin
  select * into marker from academy_private.study_persistence_metadata where singleton;
  if not found or marker.migration_names is null or not (marker.migration_names @> array[
    '20260815190000_academy_family_cloud_household_bootstrap_r1'
  ]::text[]) then
    raise exception 'Family Cloud timezone bootstrap prerequisites are missing';
  end if;
  if marker.migration_names @> array['20260816030000_academy_family_cloud_timezone_bootstrap_r1']::text[] then
    raise exception 'Family Cloud timezone bootstrap migration is already recorded';
  end if;
end;
$$;

alter function public.academy_family_cloud_bootstrap_r1(jsonb)
  rename to academy_family_cloud_bootstrap_without_timezone_r1;

revoke all on function public.academy_family_cloud_bootstrap_without_timezone_r1(jsonb)
  from public, anon, authenticated, service_role;

create function public.academy_family_cloud_bootstrap_r1(
  p_local_learners jsonb default '[]'::jsonb,
  p_household_timezone text default 'UTC'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  result_value jsonb;
  household_ref uuid;
begin
  if not public.academy_study_timezone_is_valid(p_household_timezone) then
    raise exception 'FAMILY_CLOUD_TIMEZONE_INVALID' using errcode = '22023';
  end if;

  result_value := public.academy_family_cloud_bootstrap_without_timezone_r1(
    p_local_learners
  );
  household_ref := nullif(result_value ->> 'householdRef', '')::uuid;
  if result_value ->> 'status' <> 'ready' or household_ref is null then
    raise exception 'FAMILY_CLOUD_BOOTSTRAP_INVALID' using errcode = '55000';
  end if;

  insert into public.academy_study_household_settings(
    household_id, household_timezone, revision, updated_by
  ) values (
    household_ref, p_household_timezone, 1, auth.uid()
  )
  on conflict (household_id) do update
    set household_timezone = excluded.household_timezone,
        updated_by = excluded.updated_by
    where academy_study_household_settings.household_timezone
      is distinct from excluded.household_timezone;

  return result_value;
end;
$$;

alter function public.academy_family_cloud_bootstrap_r1(jsonb, text) owner to postgres;
revoke all on function public.academy_family_cloud_bootstrap_r1(jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_family_cloud_bootstrap_r1(jsonb, text)
  to authenticated;

comment on function public.academy_family_cloud_bootstrap_r1(jsonb, text) is
  'Authenticated Family Cloud bootstrap. Household/user authority remains auth.uid()-derived; the caller supplies only local learner descriptors and a validated canonical IANA household timezone required by Study session persistence.';

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260816030000_academy_family_cloud_timezone_bootstrap_r1'
    ),
    updated_at = now()
where singleton;
