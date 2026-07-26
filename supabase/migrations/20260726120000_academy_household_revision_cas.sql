-- Academy household sync: server-enforced revision compare-and-swap.
--
-- This migration intentionally derives household identity only from auth.uid().
-- It removes direct authenticated profile mutation grants; all writes go through
-- academy_apply_profile_mutation so a server revision is consumed exactly once.

create table if not exists public.academy_household_sync_state (
  household_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_household_sync_mutations (
  household_id uuid not null references auth.users (id) on delete cascade,
  mutation_id text not null check (
    length(mutation_id) between 1 and 200
    and mutation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  expected_revision bigint not null check (expected_revision >= 0),
  resulting_revision bigint not null check (resulting_revision > 0),
  payload jsonb not null,
  applied_at timestamptz not null default now(),
  primary key (household_id, mutation_id)
);

alter table public.academy_household_sync_state enable row level security;
alter table public.academy_household_sync_mutations enable row level security;

revoke all on public.academy_household_sync_state from public, anon, authenticated;
revoke all on public.academy_household_sync_mutations from public, anon, authenticated;

-- Reads remain protected by profiles_select_own. Direct browser writes are
-- removed so callers cannot bypass the revision transaction.
revoke insert, update, delete on public.profiles from authenticated;

create or replace function public.academy_sync_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_household_id uuid := auth.uid();
  v_revision bigint;
  v_rows jsonb;
begin
  if v_household_id is null then
    raise exception 'Academy sync requires an authenticated household'
      using errcode = '28000';
  end if;

  select state.revision
    into v_revision
    from public.academy_household_sync_state as state
   where state.household_id = v_household_id;

  v_revision := coalesce(v_revision, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', profile.profile_id,
        'data', profile.data,
        'updated_at', profile.updated_at
      )
      order by profile.profile_id
    ),
    '[]'::jsonb
  )
    into v_rows
    from public.profiles as profile
   where profile.household_id = v_household_id;

  return jsonb_build_object(
    'revision', v_revision::text,
    'rows', v_rows
  );
end;
$function$;

create or replace function public.academy_apply_profile_mutation(
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
  v_household_id uuid := auth.uid();
  v_current_revision bigint;
  v_next_revision bigint;
  v_receipt public.academy_household_sync_mutations%rowtype;
  v_row jsonb;
  v_profile_count integer;
begin
  if v_household_id is null then
    raise exception 'Academy sync requires an authenticated household'
      using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected Academy revision is invalid'
      using errcode = '22023';
  end if;
  if p_mutation_id is null
     or length(p_mutation_id) not between 1 and 200
     or p_mutation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception 'Academy mutation id is invalid'
      using errcode = '22023';
  end if;
  if p_profiles is null or jsonb_typeof(p_profiles) <> 'array' then
    raise exception 'Academy profile mutation must be an array'
      using errcode = '22023';
  end if;

  v_profile_count := jsonb_array_length(p_profiles);
  if v_profile_count < 1 or v_profile_count > 5 then
    raise exception 'Academy profile mutation has an invalid row count'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_profiles) as item(value)
     where jsonb_typeof(item.value) <> 'object'
        or not (item.value ? 'profile_id')
        or not (item.value ? 'data')
        or not (item.value ? 'updated_at')
        or item.value->>'profile_id' !~ '^p[1-5]$'
        or jsonb_typeof(item.value->'data') <> 'object'
        or item.value->'data'->>'id' is distinct from item.value->>'profile_id'
        or length(item.value->>'updated_at') > 64
  ) then
    raise exception 'Academy profile mutation contains an invalid row'
      using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct item.value->>'profile_id')
      from jsonb_array_elements(p_profiles) as item(value)
  ) then
    raise exception 'Academy profile mutation contains duplicate profile ids'
      using errcode = '22023';
  end if;

  insert into public.academy_household_sync_state (household_id, revision)
  values (v_household_id, 0)
  on conflict (household_id) do nothing;

  select state.revision
    into v_current_revision
    from public.academy_household_sync_state as state
   where state.household_id = v_household_id
   for update;

  select receipt.*
    into v_receipt
    from public.academy_household_sync_mutations as receipt
   where receipt.household_id = v_household_id
     and receipt.mutation_id = p_mutation_id;

  if found then
    if v_receipt.expected_revision <> p_expected_revision
       or v_receipt.payload <> p_profiles then
      raise exception 'Academy mutation id was reused with different input'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'status', 'replayed',
      'revision', v_receipt.resulting_revision::text
    );
  end if;

  if v_current_revision <> p_expected_revision then
    return jsonb_build_object(
      'status', 'conflict',
      'revision', v_current_revision::text
    );
  end if;

  for v_row in
    select item.value
      from jsonb_array_elements(p_profiles) as item(value)
  loop
    insert into public.profiles (
      household_id,
      profile_id,
      data,
      updated_at
    )
    values (
      v_household_id,
      v_row->>'profile_id',
      v_row->'data',
      (v_row->>'updated_at')::timestamptz
    )
    on conflict (household_id, profile_id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at;
  end loop;

  v_next_revision := v_current_revision + 1;

  update public.academy_household_sync_state
     set revision = v_next_revision,
         updated_at = now()
   where household_id = v_household_id;

  insert into public.academy_household_sync_mutations (
    household_id,
    mutation_id,
    expected_revision,
    resulting_revision,
    payload
  )
  values (
    v_household_id,
    p_mutation_id,
    p_expected_revision,
    v_next_revision,
    p_profiles
  );

  return jsonb_build_object(
    'status', 'applied',
    'revision', v_next_revision::text
  );
end;
$function$;

alter function public.academy_sync_snapshot() owner to postgres;
alter function public.academy_apply_profile_mutation(bigint, text, jsonb)
  owner to postgres;

revoke all on function public.academy_sync_snapshot() from public, anon;
revoke all on function public.academy_apply_profile_mutation(bigint, text, jsonb)
  from public, anon;
grant execute on function public.academy_sync_snapshot() to authenticated;
grant execute on function public.academy_apply_profile_mutation(bigint, text, jsonb)
  to authenticated;
