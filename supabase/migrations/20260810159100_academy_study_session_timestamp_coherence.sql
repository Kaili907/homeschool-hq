-- Keep authoritative Study session acceptance and update timestamps coherent.
--
-- The storage schema's updated_at default uses transaction time (now()), while
-- Session Semantics V2 accepts a session with wall-clock time
-- (clock_timestamp()). A transaction that began before acceptance can therefore
-- project updatedAt before acceptedAt. Normalize only new V2 session inserts at
-- the database boundary; existing migration identities remain unchanged.

begin;

do $migration_guard$
begin
  if current_user <> 'postgres' then
    raise exception 'Study session timestamp coherence migration must run as postgres';
  end if;

  if not exists (
    select 1
    from academy_private.study_persistence_metadata
    where singleton and session_semantics_version = 2
  ) then
    raise exception 'Study session timestamp coherence prerequisite mismatch';
  end if;

  if to_regprocedure(
    'academy_private.study_session_timestamp_coherence_v2()'
  ) is not null or exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.academy_study_sessions'::regclass
      and tgname = 'academy_study_sessions_timestamp_coherence_v2'
      and not tgisinternal
  ) then
    raise exception 'Study session timestamp coherence object collision';
  end if;
end;
$migration_guard$;

create function academy_private.study_session_timestamp_coherence_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.session_semantics_version = 2
     and new.accepted_at is not null
     and (new.updated_at is null or new.updated_at < new.accepted_at) then
    new.updated_at := new.accepted_at;
  end if;
  return new;
end;
$$;

alter function academy_private.study_session_timestamp_coherence_v2()
  owner to postgres;
revoke all on function academy_private.study_session_timestamp_coherence_v2()
  from public, anon, authenticated, service_role;

create trigger academy_study_sessions_timestamp_coherence_v2
  before insert on public.academy_study_sessions
  for each row execute function
    academy_private.study_session_timestamp_coherence_v2();

alter table academy_private.study_persistence_metadata
  add column session_timestamp_coherence_version smallint not null default 0
    check (session_timestamp_coherence_version in (0, 1));

update academy_private.study_persistence_metadata
set session_timestamp_coherence_version = 1,
    migration_names = array_append(
      migration_names,
      '20260810159100_academy_study_session_timestamp_coherence'
    )
where singleton;

comment on function academy_private.study_session_timestamp_coherence_v2() is
  'Normalizes new V2 Study session updated_at to never precede accepted_at.';

commit;
