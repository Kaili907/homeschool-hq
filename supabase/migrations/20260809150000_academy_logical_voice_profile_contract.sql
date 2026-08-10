-- Additive profile contract for server-owned logical TTS selections.
-- Historical tutor.voiceMap values are preserved and remain governed by the
-- 20260726 CAS validator. New tagged values live at tutor.voiceSelections.

create or replace function public.academy_sync_logical_voice_contract_is_valid(
  p_data jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  selection_map jsonb;
  entry record;
  entry_key_count integer;
begin
  if jsonb_typeof(p_data) <> 'object' then return false; end if;
  if not (p_data ? 'tutor') then return true; end if;
  if jsonb_typeof(p_data->'tutor') <> 'object' then return false; end if;
  if not (p_data->'tutor' ? 'voiceSelections') then return true; end if;

  selection_map := p_data->'tutor'->'voiceSelections';
  if jsonb_typeof(selection_map) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(selection_map)) > 5 then return false; end if;

  for entry in select key, value from jsonb_each(selection_map) loop
    if entry.key not in ('mathTutor', 'mindset', 'japanese', 'assistant', 'default')
       or jsonb_typeof(entry.value) <> 'object' then
      return false;
    end if;
    select count(*) into entry_key_count from jsonb_object_keys(entry.value);
    if entry.value->>'kind' = 'catalog' then
      if entry_key_count <> 4
         or not (entry.value ?& array['kind', 'voiceRef', 'voiceVersion', 'displayLabel'])
         or entry.value->>'voiceRef' !~ '^academy\.tts\.[a-z0-9]+([.-][a-z0-9]+)*$'
         or char_length(entry.value->>'voiceRef') > 128
         or entry.value->>'voiceVersion' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
         or not public.academy_sync_is_text(entry.value->'displayLabel', 120, false) then
        return false;
      end if;
    elsif entry.value->>'kind' = 'browser' then
      if entry_key_count <> 3
         or not (entry.value ?& array['kind', 'voiceURI', 'displayLabel'])
         or not public.academy_sync_is_text(entry.value->'voiceURI', 1000000, false)
         or not public.academy_sync_is_text(entry.value->'displayLabel', 120, false) then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;
  return true;
end;
$function$;

alter function public.academy_sync_logical_voice_contract_is_valid(jsonb)
  owner to postgres;
revoke all on function public.academy_sync_logical_voice_contract_is_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_sync_logical_voice_contract_is_valid(jsonb)
  to authenticated;

do $logical_voice_constraint$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Logical voice profile contract requires public.profiles';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_logical_voice_contract_check'
  ) then
    alter table public.profiles
      add constraint profiles_logical_voice_contract_check
      check (public.academy_sync_logical_voice_contract_is_valid(data))
      not valid;
  end if;
end;
$logical_voice_constraint$;

alter table public.profiles
  validate constraint profiles_logical_voice_contract_check;
