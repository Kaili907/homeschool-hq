-- LOCAL/EPHEMERAL DATABASE ONLY. Helpers emulate direct PostgREST role/JWT calls.
create or replace function pg_temp.study_count_as(
  test_role name,
  claim_sub text,
  claim_json text,
  statement_sql text
)
returns bigint
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  result_count bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(claim_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(claim_json, ''), true);
  execute format('set local role %I', test_role);
  execute format('select count(*) from (%s) as counted', statement_sql)
    into result_count;
  execute 'reset role';
  return result_count;
exception when others then
  execute 'reset role';
  raise;
end;
$$;

create or replace function pg_temp.study_operation_is_denied(
  test_role name,
  claim_sub text,
  claim_json text,
  statement_sql text
)
returns boolean
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  failure_state text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(claim_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(claim_json, ''), true);
  execute format('set local role %I', test_role);
  begin
    execute statement_sql;
    execute 'reset role';
    return false;
  exception when others then
    get stacked diagnostics failure_state = returned_sqlstate;
    execute 'reset role';
    return failure_state in ('28000', '42501');
  end;
end;
$$;
