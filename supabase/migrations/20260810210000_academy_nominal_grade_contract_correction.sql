-- Additive correction: align the CAS profile contract with the canonical
-- NOMINAL grade vocabulary.
--
-- The 20260726 CAS validator hardcoded ('3', '4', '6', '10', '12') twice --
-- the five PROFILE_SEEDS grades (src/migration.ts), not the nominal Grade
-- contract. The client authority is grades 3-12 (src/types.ts `Grade`, mirrored
-- by GRADES in src/sync/provenance.ts), so a household that moved a learner to
-- grade 5, 7, 8, 9, or 11 passed client validation and was then rejected by
-- academy_apply_profile_mutation as an invalid row.
--
-- NOMINAL grade (what a learner IS, for transcripts/placement) stays a distinct
-- vocabulary from CURRICULUM-SUPPORTED grade (what content exists for, 3, 4, 5,
-- 7, 8, 9, 10, 11, 12 -- see src/curriculum/grade-authority/constants.ts).
-- Grade 6 is a valid nominal grade with no authored curriculum; this contract
-- accepts it as nominal and says nothing about content support.
--
-- The historical 20260726 migration is a hosted-equivalent baseline and its
-- bytes are pinned by supabase/study-engine-migrations.db.test.ts, so it is
-- never rewritten. This migration supersedes the function definition forward
-- with `create or replace`. The two grade set literals become one shared
-- authority; every other predicate, limit, and the CAS/authorization surface are
-- re-emitted byte-identical.
--
-- One deliberate narrowing rides along at the tutorChats[] site. The historical
-- predicate `v_item->>'grade' not in (...)` evaluated to SQL NULL for a jsonb
-- `null` grade, and a PL/pgSQL `if` over a NULL OR-chain is not taken, so
-- `{"grade": null}` inside tutorChats[] was accepted -- a fail-open gap the
-- `?&` key-existence guard cannot catch, because the key is present. The helper
-- coalesces to false, so that payload is now rejected. This closes the hole in
-- the direction the TS authority already enforced (`GRADES.has(String(null))`
-- is false, src/sync/provenance.ts). Profile.grade never had this gap: its
-- retained `jsonb_typeof(...) not in ('number','string')` guard rejects jsonb
-- null before the set test, so that site is a pure widening.

create or replace function public.academy_sync_is_nominal_grade(p_value jsonb)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(
    p_value #>> '{}' in
      ('3', '4', '5', '6', '7', '8', '9', '10', '11', '12'),
    false
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
     or not public.academy_sync_is_nominal_grade(p_data->'grade')
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
         or not public.academy_sync_is_nominal_grade(v_item->'grade')
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

alter function public.academy_sync_is_nominal_grade(jsonb) owner to postgres;
alter function public.academy_sync_profile_is_valid(text, jsonb)
  owner to postgres;

revoke all on function public.academy_sync_is_nominal_grade(jsonb)
  from public, anon, authenticated;
revoke all on function public.academy_sync_profile_is_valid(text, jsonb)
  from public, anon, authenticated;
