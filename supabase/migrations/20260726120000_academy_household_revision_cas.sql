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
  payload jsonb not null,
  result_type text not null check (result_type in ('applied', 'conflict')),
  observed_revision bigint not null check (observed_revision >= 0),
  resulting_revision bigint check (
    (result_type = 'applied' and resulting_revision > 0)
    or (result_type = 'conflict' and resulting_revision is null)
  ),
  completed_at timestamptz not null default now(),
  primary key (household_id, mutation_id)
);

do $migration_shape$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'academy_household_sync_mutations'
       and column_name = 'result_type'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'academy_household_sync_mutations'
       and column_name = 'observed_revision'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'academy_household_sync_mutations'
       and column_name = 'completed_at'
  ) or exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'academy_household_sync_mutations'
       and column_name = 'applied_at'
  ) then
    raise exception
      'Academy CAS receipt schema is incompatible with the unreleased final migration';
  end if;
end;
$migration_shape$;

alter table public.academy_household_sync_state enable row level security;
alter table public.academy_household_sync_mutations enable row level security;

revoke all on public.academy_household_sync_state from public, anon, authenticated;
revoke all on public.academy_household_sync_mutations from public, anon, authenticated;

-- Reads remain protected by profiles_select_own. Direct browser writes are
-- removed so callers cannot bypass the revision transaction.
revoke insert, update, delete on public.profiles from authenticated;

create or replace function public.academy_sync_is_text(
  p_value jsonb,
  p_max_length integer default 1000000,
  p_allow_empty boolean default true
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(
    jsonb_typeof(p_value) = 'string'
     and char_length(p_value #>> '{}') <= p_max_length
     and (p_allow_empty or char_length(p_value #>> '{}') > 0),
    false
  )
$function$;

create or replace function public.academy_sync_is_number(p_value jsonb)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(
    jsonb_typeof(p_value) = 'number'
     and abs((p_value #>> '{}')::numeric)
         <= 1.7976931348623157e308::numeric,
    false
  )
$function$;

create or replace function public.academy_sync_is_date(
  p_value jsonb,
  p_allow_empty boolean default false
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_text text;
  v_date date;
begin
  if coalesce(jsonb_typeof(p_value), 'null') <> 'string' then
    return false;
  end if;
  v_text := p_value #>> '{}';
  if p_allow_empty and v_text = '' then
    return true;
  end if;
  if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  v_date := v_text::date;
  return to_char(v_date, 'YYYY-MM-DD') = v_text;
exception when others then
  return false;
end;
$function$;

create or replace function public.academy_sync_is_timestamp(p_value jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_text text;
  v_timestamp timestamptz;
begin
  if coalesce(jsonb_typeof(p_value), 'null') <> 'string' then
    return false;
  end if;
  v_text := p_value #>> '{}';
  if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return false;
  end if;
  v_timestamp := v_text::timestamptz;
  return isfinite(v_timestamp);
exception when others then
  return false;
end;
$function$;

create or replace function public.academy_sync_json_within_limits(p_value jsonb)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  with recursive walk(value, depth) as (
    select p_value, 0
    union all
    select child.value, walk.depth + 1
      from walk
      cross join lateral (
        select array_item.value
          from jsonb_array_elements(
            case when jsonb_typeof(walk.value) = 'array'
                 then walk.value else '[]'::jsonb end
          ) as array_item(value)
        union all
        select object_item.value
          from jsonb_each(
            case when jsonb_typeof(walk.value) = 'object'
                 then walk.value else '{}'::jsonb end
          ) as object_item(key, value)
      ) as child
     where walk.depth < 128
  )
  select octet_length(p_value::text) <= 10000000
     and (select count(*) <= 500000 from walk)
     and not exists (
       select 1
         from walk
        where depth = 128
          and (
            (jsonb_typeof(value) = 'array' and jsonb_array_length(value) > 0)
            or
            (jsonb_typeof(value) = 'object'
             and (select count(*) from jsonb_object_keys(value)) > 0)
          )
     )
     and not exists (
       select 1
         from walk
        where (jsonb_typeof(value) = 'array'
               and jsonb_array_length(value) > 50000)
           or (jsonb_typeof(value) = 'object'
               and (select count(*) from jsonb_object_keys(value)) > 50000)
           or (jsonb_typeof(value) = 'string'
               and char_length(value #>> '{}') > 1000000)
           or (jsonb_typeof(value) = 'number'
               and not public.academy_sync_is_number(value))
     )
     and not exists (
       select 1
         from walk
         cross join lateral jsonb_each(
           case when jsonb_typeof(walk.value) = 'object'
                then walk.value else '{}'::jsonb end
         ) as object_item(key, value)
        where char_length(object_item.key) > 256
           or object_item.key in ('__proto__', 'prototype', 'constructor')
     )
$function$;

create or replace function public.academy_sync_profile_is_valid(
  p_profile_id text,
  p_data jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_entry record;
  v_item jsonb;
  v_nested jsonb;
  v_value jsonb;
begin
  if p_profile_id !~ '^p[1-5]$'
     or jsonb_typeof(p_data) <> 'object'
     or not public.academy_sync_json_within_limits(p_data)
     or not (p_data ?& array[
       'id', 'name', 'grade', 'pin', 'theme', 'skills', 'missions',
       'streaks', 'createdAt', 'placementDone', 'totals'
     ])
     or p_data->>'id' is distinct from p_profile_id
     or not public.academy_sync_is_text(p_data->'name')
     or jsonb_typeof(p_data->'grade') not in ('number', 'string')
     or p_data->>'grade' not in ('3', '4', '6', '10', '12')
     or not public.academy_sync_is_text(p_data->'pin', 64)
     or p_data->>'theme' not in ('playful', 'cool', 'clean')
     or jsonb_typeof(p_data->'skills') <> 'object'
     or jsonb_typeof(p_data->'missions') <> 'object'
     or jsonb_typeof(p_data->'streaks') <> 'object'
     or not public.academy_sync_is_number(p_data->'streaks'->'current')
     or not public.academy_sync_is_number(p_data->'streaks'->'best')
     or not public.academy_sync_is_date(
       p_data->'streaks'->'lastActiveDate',
       true
     )
     or not public.academy_sync_is_timestamp(p_data->'createdAt')
     or jsonb_typeof(p_data->'placementDone') <> 'boolean'
     or jsonb_typeof(p_data->'totals') <> 'object'
     or not public.academy_sync_is_number(
       p_data->'totals'->'questionsAnswered'
     )
     or not public.academy_sync_is_number(p_data->'totals'->'correct')
     or not public.academy_sync_is_number(p_data->'totals'->'bestStreak')
     or not public.academy_sync_is_number(p_data->'totals'->'sessions') then
    return false;
  end if;

  for v_entry in select key, value from jsonb_each(p_data->'skills') loop
    if char_length(v_entry.key) > 256
       or v_entry.key in ('__proto__', 'prototype', 'constructor')
       or jsonb_typeof(v_entry.value) <> 'object'
       or not public.academy_sync_is_number(v_entry.value->'attempts')
       or not public.academy_sync_is_number(v_entry.value->'correct')
       or not public.academy_sync_is_number(v_entry.value->'mastery')
       or (
         v_entry.value ? 'lastSeen'
         and not public.academy_sync_is_date(v_entry.value->'lastSeen')
       ) then
      return false;
    end if;
  end loop;

  for v_entry in select key, value from jsonb_each(p_data->'missions') loop
    if not public.academy_sync_is_date(to_jsonb(v_entry.key))
       or jsonb_typeof(v_entry.value) <> 'object'
       or not (v_entry.value ? 'items')
       or jsonb_typeof(v_entry.value->'items') <> 'array' then
      return false;
    end if;
    for v_item in select value from jsonb_array_elements(v_entry.value->'items') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['id', 'label', 'done'])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'label')
         or jsonb_typeof(v_item->'done') <> 'boolean'
         or (v_item ? 'auto' and jsonb_typeof(v_item->'auto') <> 'boolean')
         or (
           v_item ? 'autoKind'
           and v_item->>'autoKind' not in ('math', 'typing', 'reading', 'mindset')
         ) then
        return false;
      end if;
    end loop;
  end loop;

  if p_data ? 'lastPracticeDate'
     and not public.academy_sync_is_date(p_data->'lastPracticeDate') then
    return false;
  end if;
  if p_data ? 'coolStars'
     and jsonb_typeof(p_data->'coolStars') <> 'boolean' then
    return false;
  end if;
  if p_data ? 'tutorDailyCap'
     and not public.academy_sync_is_number(p_data->'tutorDailyCap') then
    return false;
  end if;
  if p_data ? 'tutorCalls' then
    if jsonb_typeof(p_data->'tutorCalls') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'tutorCalls') loop
      if not public.academy_sync_is_number(v_item) then return false; end if;
    end loop;
  end if;

  if p_data ? 'template' then
    v_value := p_data->'template';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['weekday', 'friday'])
       or jsonb_typeof(v_value->'weekday') <> 'array'
       or jsonb_typeof(v_value->'friday') <> 'array' then return false; end if;
    for v_item in
      select value from jsonb_array_elements((v_value->'weekday') || (v_value->'friday'))
    loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['id', 'label'])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'label')
         or (v_item ? 'auto' and jsonb_typeof(v_item->'auto') <> 'boolean')
         or (v_item ? 'weeklyOnce' and jsonb_typeof(v_item->'weeklyOnce') <> 'boolean')
         or (v_item ? 'season' and v_item->>'season' <> 'fall')
         or (
           v_item ? 'autoKind'
           and v_item->>'autoKind' not in ('math', 'typing', 'reading', 'mindset')
         )
         or (v_item ? 'days' and jsonb_typeof(v_item->'days') <> 'array') then
        return false;
      end if;
      if v_item ? 'days' then
        if jsonb_array_length(v_item->'days') > 5 then return false; end if;
        for v_nested in select value from jsonb_array_elements(v_item->'days') loop
          if not public.academy_sync_is_number(v_nested)
             or (v_nested #>> '{}')::numeric not between 1 and 5
             or trunc((v_nested #>> '{}')::numeric) <> (v_nested #>> '{}')::numeric then
            return false;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  if p_data ? 'assessments' then
    v_value := p_data->'assessments';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['assigned', 'attempts'])
       or jsonb_typeof(v_value->'assigned') <> 'array'
       or jsonb_typeof(v_value->'attempts') <> 'array'
       or (v_value ? 'retakeUnlocked'
           and jsonb_typeof(v_value->'retakeUnlocked') <> 'array') then
      return false;
    end if;
    for v_item in select value from jsonb_array_elements(v_value->'assigned') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['testId', 'startCode', 'assignedAt'])
         or not public.academy_sync_is_text(v_item->'testId', 512, false)
         or not public.academy_sync_is_text(v_item->'startCode', 512)
         or not public.academy_sync_is_timestamp(v_item->'assignedAt') then
        return false;
      end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'attempts') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['testId', 'profileId', 'startedAt', 'answers'])
         or not public.academy_sync_is_text(v_item->'testId', 512, false)
         or not public.academy_sync_is_text(v_item->'profileId', 512, false)
         or not public.academy_sync_is_timestamp(v_item->'startedAt')
         or (v_item ? 'finishedAt'
             and not public.academy_sync_is_timestamp(v_item->'finishedAt'))
         or jsonb_typeof(v_item->'answers') <> 'object' then
        return false;
      end if;
      for v_entry in select key, value from jsonb_each(v_item->'answers') loop
        if jsonb_typeof(v_entry.value) <> 'object'
           or not (v_entry.value ?& array['value', 'skipped', 'msOnItem'])
           or not public.academy_sync_is_text(v_entry.value->'value')
           or jsonb_typeof(v_entry.value->'skipped') <> 'boolean'
           or not public.academy_sync_is_number(v_entry.value->'msOnItem') then
          return false;
        end if;
      end loop;
      if v_item ? 'autoScore' then
        v_nested := v_item->'autoScore';
        if jsonb_typeof(v_nested) <> 'object'
           or not (v_nested ?& array['bySection', 'gradedItems', 'skips'])
           or jsonb_typeof(v_nested->'bySection') <> 'object'
           or not public.academy_sync_is_number(v_nested->'gradedItems')
           or not public.academy_sync_is_number(v_nested->'skips') then
          return false;
        end if;
        for v_entry in select key, value from jsonb_each(v_nested->'bySection') loop
          if jsonb_typeof(v_entry.value) <> 'object'
             or not (v_entry.value ?& array['correct', 'of'])
             or not public.academy_sync_is_number(v_entry.value->'correct')
             or not public.academy_sync_is_number(v_entry.value->'of') then
            return false;
          end if;
        end loop;
      end if;
    end loop;
    if v_value ? 'retakeUnlocked' then
      for v_item in select value from jsonb_array_elements(v_value->'retakeUnlocked') loop
        if not public.academy_sync_is_text(v_item, 512, false) then
          return false;
        end if;
      end loop;
    end if;
  end if;

  if p_data ? 'hsStats' then
    if jsonb_typeof(p_data->'hsStats') <> 'object' then return false; end if;
    for v_entry in select key, value from jsonb_each(p_data->'hsStats') loop
      if jsonb_typeof(v_entry.value) <> 'object'
         or not (v_entry.value ?& array['attempts', 'correct'])
         or not public.academy_sync_is_number(v_entry.value->'attempts')
         or not public.academy_sync_is_number(v_entry.value->'correct')
         or (v_entry.value ? 'lastSeen'
             and not public.academy_sync_is_date(v_entry.value->'lastSeen')) then
        return false;
      end if;
    end loop;
  end if;

  if p_data ? 'courses' then
    if jsonb_typeof(p_data->'courses') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'courses') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['id', 'name', 'units'])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'name')
         or jsonb_typeof(v_item->'units') <> 'array' then return false; end if;
      for v_nested in select value from jsonb_array_elements(v_item->'units') loop
        if jsonb_typeof(v_nested) <> 'object'
           or not (v_nested ?& array['id', 'label', 'done'])
           or not public.academy_sync_is_text(v_nested->'id', 512, false)
           or not public.academy_sync_is_text(v_nested->'label')
           or jsonb_typeof(v_nested->'done') <> 'boolean' then return false; end if;
      end loop;
    end loop;
  end if;

  if p_data ? 'collegeTasks' then
    if jsonb_typeof(p_data->'collegeTasks') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'collegeTasks') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['id', 'label', 'due', 'done'])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'label')
         or not public.academy_sync_is_date(v_item->'due', true)
         or jsonb_typeof(v_item->'done') <> 'boolean' then return false; end if;
    end loop;
  end if;

  if p_data ? 'tutor' then
    v_value := p_data->'tutor';
    if jsonb_typeof(v_value) <> 'object'
       or (v_value ? 'voiceURI' and not public.academy_sync_is_text(v_value->'voiceURI'))
       or (v_value ? 'rate' and not public.academy_sync_is_number(v_value->'rate'))
       or (v_value ? 'voiceOptIn' and jsonb_typeof(v_value->'voiceOptIn') <> 'boolean')
       or (v_value ? 'voiceMap' and jsonb_typeof(v_value->'voiceMap') <> 'object') then
      return false;
    end if;
    if v_value ? 'voiceMap' then
      for v_entry in select key, value from jsonb_each(v_value->'voiceMap') loop
        if jsonb_typeof(v_entry.value) <> 'object'
           or v_entry.value->>'provider' not in ('elevenlabs', 'browser')
           or not public.academy_sync_is_text(v_entry.value->'ref')
           or not public.academy_sync_is_text(v_entry.value->'label') then return false; end if;
      end loop;
    end if;
  end if;

  if p_data ? 'tutorFlags' then
    if jsonb_typeof(p_data->'tutorFlags') <> 'object' then return false; end if;
    for v_entry in select key, value from jsonb_each(p_data->'tutorFlags') loop
      if jsonb_typeof(v_entry.value) <> 'object'
         or not (v_entry.value ?& array[
           'since', 'reason', 'sessionCount', 'weekCount'
         ])
         or not public.academy_sync_is_date(v_entry.value->'since')
         or not public.academy_sync_is_text(v_entry.value->'reason')
         or not public.academy_sync_is_number(v_entry.value->'sessionCount')
         or not public.academy_sync_is_number(v_entry.value->'weekCount') then return false; end if;
    end loop;
  end if;

  if p_data ? 'walkthroughLog' then
    if jsonb_typeof(p_data->'walkthroughLog') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'walkthroughLog') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['skillId', 'ts', 'day'])
         or not public.academy_sync_is_text(v_item->'skillId', 512, false)
         or not public.academy_sync_is_number(v_item->'ts')
         or not public.academy_sync_is_date(v_item->'day') then return false; end if;
    end loop;
  end if;

  if p_data ? 'stars' then
    v_value := p_data->'stars';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array[
         'balance', 'lifetimeEarned', 'ledger', 'pendingRedemptions'
       ])
       or not public.academy_sync_is_number(v_value->'balance')
       or not public.academy_sync_is_number(v_value->'lifetimeEarned')
       or jsonb_typeof(v_value->'ledger') <> 'array'
       or jsonb_typeof(v_value->'pendingRedemptions') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(v_value->'ledger') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array[
           'id', 'at', 'day', 'amount', 'reason', 'source'
         ])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_timestamp(v_item->'at')
         or not public.academy_sync_is_date(v_item->'day')
         or not public.academy_sync_is_number(v_item->'amount')
         or not public.academy_sync_is_text(v_item->'reason')
         or v_item->>'source' not in (
           'practice-session', 'accuracy-bonus', 'tutor-retry',
           'mission-complete', 'weekly-streak', 'manual-grant', 'redeem'
         ) then return false; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'pendingRedemptions') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array[
           'id', 'prizeId', 'name', 'emoji', 'cost', 'requestedAt'
         ])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'prizeId', 512, false)
         or not public.academy_sync_is_text(v_item->'name')
         or not public.academy_sync_is_text(v_item->'emoji', 64)
         or not public.academy_sync_is_number(v_item->'cost')
         or not public.academy_sync_is_timestamp(v_item->'requestedAt') then return false; end if;
    end loop;
  end if;

  if p_data ? 'typing' then
    v_value := p_data->'typing';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array[
         'unlockedIndex', 'drillsCompleted', 'lessons'
       ])
       or not public.academy_sync_is_number(v_value->'unlockedIndex')
       or not public.academy_sync_is_number(v_value->'drillsCompleted')
       or jsonb_typeof(v_value->'lessons') <> 'object'
       or (v_value ? 'lastPracticedDate'
           and not public.academy_sync_is_date(v_value->'lastPracticedDate')) then return false; end if;
    for v_entry in select key, value from jsonb_each(v_value->'lessons') loop
      if jsonb_typeof(v_entry.value) <> 'object'
         or not (v_entry.value ?& array[
           'bestAccuracy', 'bestWpm', 'passed'
         ])
         or not public.academy_sync_is_number(v_entry.value->'bestAccuracy')
         or not public.academy_sync_is_number(v_entry.value->'bestWpm')
         or jsonb_typeof(v_entry.value->'passed') <> 'boolean'
         or (v_entry.value ? 'lastSeen'
             and not public.academy_sync_is_date(v_entry.value->'lastSeen')) then return false; end if;
    end loop;
  end if;

  if p_data ? 'reading' then
    v_value := p_data->'reading';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array[
         'sessions', 'seenPassageIds', 'calibrations'
       ])
       or jsonb_typeof(v_value->'sessions') <> 'array'
       or jsonb_typeof(v_value->'seenPassageIds') <> 'array'
       or jsonb_typeof(v_value->'calibrations') <> 'array'
       or (v_value ? 'lastReadDate'
           and not public.academy_sync_is_date(v_value->'lastReadDate')) then return false; end if;
    for v_item in select value from jsonb_array_elements(v_value->'sessions') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array[
           'date', 'passageId', 'mode', 'wcpm',
           'wordsPracticed', 'durationSec'
         ])
         or not public.academy_sync_is_date(v_item->'date')
         or not public.academy_sync_is_text(v_item->'passageId', 512, false)
         or v_item->>'mode' not in ('estimated', 'assessed', 'manual')
         or not public.academy_sync_is_number(v_item->'wcpm')
         or jsonb_typeof(v_item->'wordsPracticed') <> 'array'
         or not public.academy_sync_is_number(v_item->'durationSec') then return false; end if;
      for v_nested in select value from jsonb_array_elements(v_item->'wordsPracticed') loop
        if not public.academy_sync_is_text(v_nested) then return false; end if;
      end loop;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'seenPassageIds') loop
      if not public.academy_sync_is_text(v_item, 512, false) then return false; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'calibrations') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['date', 'wcpm'])
         or not public.academy_sync_is_date(v_item->'date')
         or (v_item ? 'passageId'
             and not public.academy_sync_is_text(v_item->'passageId', 512, false))
         or not public.academy_sync_is_number(v_item->'wcpm') then return false; end if;
    end loop;
  end if;

  if p_data ? 'attendance' then
    v_value := p_data->'attendance';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ? 'log')
       or jsonb_typeof(v_value->'log') <> 'array'
       or (v_value ? 'hoursPerDay'
           and not public.academy_sync_is_number(v_value->'hoursPerDay')) then return false; end if;
    for v_item in select value from jsonb_array_elements(v_value->'log') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['date', 'hours'])
         or not public.academy_sync_is_date(v_item->'date')
         or not public.academy_sync_is_number(v_item->'hours') then return false; end if;
    end loop;
  end if;

  if p_data ? 'serviceLog' then
    if jsonb_typeof(p_data->'serviceLog') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'serviceLog') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array[
           'id', 'date', 'org', 'hours', 'note', 'approved', 'createdAt'
         ])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_date(v_item->'date')
         or not public.academy_sync_is_text(v_item->'org')
         or not public.academy_sync_is_number(v_item->'hours')
         or not public.academy_sync_is_text(v_item->'note')
         or jsonb_typeof(v_item->'approved') <> 'boolean'
         or not public.academy_sync_is_timestamp(v_item->'createdAt') then return false; end if;
    end loop;
  end if;

  if p_data ? 'tutorChats' then
    if jsonb_typeof(p_data->'tutorChats') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'tutorChats') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array[
           'id', 'skillId', 'grade', 'day', 'startedTs',
           'problem', 'correctAnswer', 'herAnswer', 'messages'
         ])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_text(v_item->'skillId', 512, false)
         or v_item->>'grade' not in ('3', '4', '6', '10', '12')
         or not public.academy_sync_is_date(v_item->'day')
         or not public.academy_sync_is_number(v_item->'startedTs')
         or not public.academy_sync_is_text(v_item->'problem')
         or not public.academy_sync_is_text(v_item->'correctAnswer')
         or not public.academy_sync_is_text(v_item->'herAnswer')
         or jsonb_typeof(v_item->'messages') <> 'array'
         or (v_item ? 'outcome' and v_item->>'outcome' not in ('flagged', 'closed')) then return false; end if;
      for v_nested in select value from jsonb_array_elements(v_item->'messages') loop
        if jsonb_typeof(v_nested) <> 'object'
           or not (v_nested ?& array['role', 'text', 'ts'])
           or v_nested->>'role' not in ('kid', 'tutor')
           or not public.academy_sync_is_text(v_nested->'text')
           or not public.academy_sync_is_number(v_nested->'ts')
           or (v_nested ? 'source'
               and v_nested->>'source' not in ('api', 'scripted')) then return false; end if;
      end loop;
    end loop;
  end if;

  if p_data ? 'mindset' then
    v_value := p_data->'mindset';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ? 'weeks')
       or jsonb_typeof(v_value->'weeks') <> 'object' then return false; end if;
    for v_entry in select key, value from jsonb_each(v_value->'weeks') loop
      if v_entry.key !~ '^[0-9]+$'
         or v_entry.key::numeric < 1
         or jsonb_typeof(v_entry.value) <> 'object'
         or (v_entry.value ? 'viewed'
             and jsonb_typeof(v_entry.value->'viewed') <> 'boolean')
         or (v_entry.value ? 'reflected'
             and jsonb_typeof(v_entry.value->'reflected') <> 'boolean')
         or (v_entry.value ? 'completedAt'
             and not public.academy_sync_is_date(v_entry.value->'completedAt')) then return false; end if;
    end loop;
  end if;

  if p_data ? 'assistant' then
    v_value := p_data->'assistant';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['calls', 'sessions'])
       or jsonb_typeof(v_value->'calls') <> 'array'
       or jsonb_typeof(v_value->'sessions') <> 'array'
       or (v_value ? 'dailyCap' and not public.academy_sync_is_number(v_value->'dailyCap'))
       or (v_value ? 'name' and not public.academy_sync_is_text(v_value->'name'))
       or (v_value ? 'persona' and not public.academy_sync_is_text(v_value->'persona')) then return false; end if;
    for v_item in select value from jsonb_array_elements(v_value->'calls') loop
      if not public.academy_sync_is_number(v_item) then return false; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'sessions') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['id', 'day', 'startedTs', 'messages'])
         or not public.academy_sync_is_text(v_item->'id', 512, false)
         or not public.academy_sync_is_date(v_item->'day')
         or not public.academy_sync_is_number(v_item->'startedTs')
         or jsonb_typeof(v_item->'messages') <> 'array' then return false; end if;
      for v_nested in select value from jsonb_array_elements(v_item->'messages') loop
        if jsonb_typeof(v_nested) <> 'object'
           or not (v_nested ?& array['role', 'text', 'ts'])
           or v_nested->>'role' not in ('girl', 'assistant')
           or not public.academy_sync_is_text(v_nested->'text')
           or not public.academy_sync_is_number(v_nested->'ts')
           or (v_nested ? 'source' and v_nested->>'source' not in ('api', 'scripted'))
           or (v_nested ? 'flagged' and jsonb_typeof(v_nested->'flagged') <> 'boolean')
           or (v_nested ? 'action' and jsonb_typeof(v_nested->'action') <> 'object') then return false; end if;
        if v_nested ? 'action' then
          v_value := v_nested->'action';
          if v_value->>'kind' not in ('check_mission', 'mark_college_task', 'start_session')
             or not (v_value ?& array['kind', 'label', 'targetKey', 'ts'])
             or not public.academy_sync_is_text(v_value->'label')
             or not public.academy_sync_is_text(v_value->'targetKey', 512, false)
             or not public.academy_sync_is_number(v_value->'ts') then return false; end if;
        end if;
      end loop;
    end loop;
  end if;

  if p_data ? 'pacing' then
    v_value := p_data->'pacing';
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['pointers', 'nudges'])
       or jsonb_typeof(v_value->'pointers') <> 'object'
       or jsonb_typeof(v_value->'nudges') <> 'array' then return false; end if;
    for v_entry in select key, value from jsonb_each(v_value->'pointers') loop
      if not public.academy_sync_is_number(v_entry.value) then return false; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_value->'nudges') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['at', 'subjectId', 'from', 'to', 'reason'])
         or not public.academy_sync_is_timestamp(v_item->'at')
         or not public.academy_sync_is_text(v_item->'subjectId', 512, false)
         or not public.academy_sync_is_number(v_item->'from')
         or not public.academy_sync_is_number(v_item->'to')
         or not public.academy_sync_is_text(v_item->'reason') then return false; end if;
    end loop;
  end if;

  if p_data ? 'masterySnapshots' then
    if jsonb_typeof(p_data->'masterySnapshots') <> 'array' then return false; end if;
    for v_item in select value from jsonb_array_elements(p_data->'masterySnapshots') loop
      if jsonb_typeof(v_item) <> 'object'
         or not (v_item ?& array['at', 'subject', 'level'])
         or not public.academy_sync_is_timestamp(v_item->'at')
         or not public.academy_sync_is_text(v_item->'subject')
         or not public.academy_sync_is_number(v_item->'level')
         or (v_item ? 'note' and not public.academy_sync_is_text(v_item->'note')) then return false; end if;
    end loop;
  end if;

  return true;
exception when others then
  return false;
end;
$function$;

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
  if octet_length(p_profiles::text) > 10000000
     or not public.academy_sync_json_within_limits(p_profiles) then
    raise exception 'Academy profile mutation exceeds structural limits'
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
        or not public.academy_sync_is_timestamp(item.value->'updated_at')
        or not public.academy_sync_profile_is_valid(
          item.value->>'profile_id',
          item.value->'data'
        )
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
    if v_receipt.result_type = 'conflict' then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', v_receipt.observed_revision::text,
        'replayed', true
      );
    end if;
    return jsonb_build_object(
      'status', 'replayed',
      'revision', v_receipt.resulting_revision::text
    );
  end if;

  if v_current_revision <> p_expected_revision then
    insert into public.academy_household_sync_mutations (
      household_id,
      mutation_id,
      expected_revision,
      payload,
      result_type,
      observed_revision,
      resulting_revision
    )
    values (
      v_household_id,
      p_mutation_id,
      p_expected_revision,
      p_profiles,
      'conflict',
      v_current_revision,
      null
    );
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
    payload,
    result_type,
    observed_revision,
    resulting_revision
  )
  values (
    v_household_id,
    p_mutation_id,
    p_expected_revision,
    p_profiles,
    'applied',
    v_current_revision,
    v_next_revision
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
alter function public.academy_sync_is_text(jsonb, integer, boolean)
  owner to postgres;
alter function public.academy_sync_is_number(jsonb) owner to postgres;
alter function public.academy_sync_is_date(jsonb, boolean) owner to postgres;
alter function public.academy_sync_is_timestamp(jsonb) owner to postgres;
alter function public.academy_sync_json_within_limits(jsonb) owner to postgres;
alter function public.academy_sync_profile_is_valid(text, jsonb)
  owner to postgres;

revoke all on function public.academy_sync_snapshot() from public, anon;
revoke all on function public.academy_apply_profile_mutation(bigint, text, jsonb)
  from public, anon;
revoke all on function public.academy_sync_is_text(jsonb, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.academy_sync_is_number(jsonb)
  from public, anon, authenticated;
revoke all on function public.academy_sync_is_date(jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.academy_sync_is_timestamp(jsonb)
  from public, anon, authenticated;
revoke all on function public.academy_sync_json_within_limits(jsonb)
  from public, anon, authenticated;
revoke all on function public.academy_sync_profile_is_valid(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.academy_sync_snapshot() to authenticated;
grant execute on function public.academy_apply_profile_mutation(bigint, text, jsonb)
  to authenticated;
