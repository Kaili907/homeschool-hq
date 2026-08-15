-- Preserve the strict Safety clear-state shape when first link has no holds.
--
-- The Family first-link RPC correctly represents an empty hold set as clear,
-- with no cleared timestamp. Its predecessor body nevertheless assigns the
-- guardian as safety_cleared_by. The table contract intentionally requires a
-- cleared timestamp and clearer to be both present or both absent, so the
-- otherwise-valid first link is rejected. Normalize only that impossible
-- half-pair before the existing constraint is evaluated.

begin;

do $$
declare
  marker academy_private.study_persistence_metadata%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Family Safety clear-shape repair must run as postgres';
  end if;

  select * into marker
  from academy_private.study_persistence_metadata
  where singleton;

  if not found
     or marker.migration_names is null
     or not (marker.migration_names @> array[
       '20260815120000_academy_family_plan_checkpoint_r1'
     ]::text[])
     or to_regclass('public.academy_study_session_authority') is null
     or to_regprocedure(
       'public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)'
     ) is null then
    raise exception 'FAMILY_SESSION_SAFETY_CLEAR_SHAPE predecessor mismatch';
  end if;

  if marker.migration_names @> array[
       '20260815180000_academy_family_session_safety_clear_shape_r1'
     ]::text[] then
    raise exception 'FAMILY_SESSION_SAFETY_CLEAR_SHAPE already applied';
  end if;
end;
$$;

create function academy_private.study_family_normalize_safety_clear_shape_r1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.safety_state = 'clear'
     and new.safety_cleared_at is null then
    new.safety_cleared_by := null;
  end if;
  return new;
end;
$$;

alter function academy_private.study_family_normalize_safety_clear_shape_r1()
  owner to postgres;
revoke all on function
  academy_private.study_family_normalize_safety_clear_shape_r1()
  from public, anon, authenticated, service_role;

create trigger academy_study_session_authority_clear_shape_r1
  before update on public.academy_study_session_authority
  for each row execute function
    academy_private.study_family_normalize_safety_clear_shape_r1();

update academy_private.study_persistence_metadata
set migration_names = array_append(
      migration_names,
      '20260815180000_academy_family_session_safety_clear_shape_r1'
    ),
    security_manifest = security_manifest || jsonb_build_object(
      'family_session_safety_clear_shape', 'normalized-before-constraint'
    ),
    updated_at = clock_timestamp()
where singleton;

comment on function
  academy_private.study_family_normalize_safety_clear_shape_r1() is
  'Normalizes the empty-hold clear state to a null cleared-at/null clearer pair before the strict session-authority constraint.';

commit;
