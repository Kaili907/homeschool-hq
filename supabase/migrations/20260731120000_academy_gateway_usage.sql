begin;

create table if not exists public.academy_gateway_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  endpoint text not null check (endpoint in ('anthropic', 'tts')),
  count integer not null check (count >= 1),
  primary key (user_id, day, endpoint)
);

alter table public.academy_gateway_usage enable row level security;
alter table public.academy_gateway_usage force row level security;

revoke all on table public.academy_gateway_usage from public, anon, authenticated;
grant select, insert, update on table public.academy_gateway_usage to service_role;

create or replace function public.academy_consume_gateway_usage(
  p_user_id uuid,
  p_endpoint text,
  p_limit integer,
  p_day date default current_date
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  accepted boolean := false;
begin
  if p_user_id is null
    or p_endpoint not in ('anthropic', 'tts')
    or p_limit is null
    or p_limit < 1
    or p_limit > 100000
    or p_day is null
  then
    return false;
  end if;

  insert into public.academy_gateway_usage as usage (
    user_id,
    day,
    endpoint,
    count
  ) values (
    p_user_id,
    p_day,
    p_endpoint,
    1
  )
  on conflict (user_id, day, endpoint) do update
    set count = usage.count + 1
    where usage.count < p_limit
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.academy_consume_gateway_usage(uuid, text, integer, date)
  from public, anon, authenticated;
grant execute on function public.academy_consume_gateway_usage(uuid, text, integer, date)
  to service_role;

commit;
