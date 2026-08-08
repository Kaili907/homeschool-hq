begin;

create schema if not exists academy_private;

create table public.academy_provider_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  product text not null check (length(btrim(product)) between 1 and 120),
  billing_unit text not null check (
    billing_unit in (
      'input_token',
      'output_token',
      'cache_read_input_token',
      'cache_write_input_token',
      'character'
    )
  ),
  effective_from timestamptz not null,
  effective_to timestamptz,
  price_micros bigint not null check (price_micros between 0 and 1000000000),
  unit_quantity bigint not null check (unit_quantity between 1 and 1000000000),
  source_label text not null check (length(btrim(source_label)) between 1 and 240),
  created_at timestamptz not null default now(),
  constraint academy_provider_prices_period_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint academy_provider_prices_period_key unique (
    provider,
    product,
    billing_unit,
    effective_from
  )
);

create table public.academy_provider_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique check (request_key ~ '^[A-Za-z0-9_-]{1,128}$'),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete restrict,
  household_id uuid references public.academy_households (id) on delete restrict,
  learner_id uuid references public.academy_students (id) on delete restrict,
  engine text not null check (engine in ('tutor', 'jarvis', 'tts')),
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  logical_model_tier text check (logical_model_tier in ('sonnet', 'haiku')),
  provider_product text not null check (length(btrim(provider_product)) between 1 and 120),
  voice_reference text check (
    voice_reference is null or voice_reference ~ '^[A-Za-z0-9_-]{1,64}$'
  ),
  input_tokens bigint check (input_tokens between 0 and 1000000000),
  output_tokens bigint check (output_tokens between 0 and 1000000000),
  cache_read_input_tokens bigint check (cache_read_input_tokens between 0 and 1000000000),
  cache_write_input_tokens bigint check (cache_write_input_tokens between 0 and 1000000000),
  characters bigint check (characters between 0 and 1000000000),
  request_count smallint not null default 1 check (request_count = 1),
  latency_ms integer not null check (latency_ms between 0 and 300000),
  status text not null check (
    status in (
      'success',
      'provider_throttled',
      'provider_error',
      'timeout',
      'missing_usage',
      'malformed_usage',
      'response_sanitization_failure'
    )
  ),
  calculation_status text not null check (
    calculation_status in (
      'calculated',
      'not_billable',
      'usage_unavailable',
      'price_unavailable',
      'billing_outcome_unknown'
    )
  ),
  calculated_cost_micros bigint check (calculated_cost_micros >= 0),
  constraint academy_provider_usage_identity_check check (
    learner_id is null or household_id is not null
  ),
  constraint academy_provider_usage_cost_check check (
    (calculation_status in ('calculated', 'not_billable') and calculated_cost_micros is not null)
    or
    (calculation_status not in ('calculated', 'not_billable') and calculated_cost_micros is null)
  )
);

create table public.academy_provider_usage_cost_components (
  usage_id uuid not null
    references public.academy_provider_usage_ledger (id) on delete restrict,
  billing_unit text not null check (
    billing_unit in (
      'input_token',
      'output_token',
      'cache_read_input_token',
      'cache_write_input_token',
      'character'
    )
  ),
  quantity bigint not null check (quantity between 0 and 1000000000),
  price_id uuid not null references public.academy_provider_prices (id) on delete restrict,
  price_micros bigint not null check (price_micros between 0 and 1000000000),
  unit_quantity bigint not null check (unit_quantity between 1 and 1000000000),
  calculated_cost_micros bigint not null check (calculated_cost_micros >= 0),
  primary key (usage_id, billing_unit)
);

create index academy_provider_usage_ledger_occurred_idx
  on public.academy_provider_usage_ledger (occurred_at desc);
create index academy_provider_usage_ledger_household_occurred_idx
  on public.academy_provider_usage_ledger (household_id, occurred_at desc);
create index academy_provider_usage_ledger_provider_product_idx
  on public.academy_provider_usage_ledger (provider, provider_product, occurred_at desc);

alter table public.academy_provider_prices enable row level security;
alter table public.academy_provider_prices force row level security;
alter table public.academy_provider_usage_ledger enable row level security;
alter table public.academy_provider_usage_ledger force row level security;
alter table public.academy_provider_usage_cost_components enable row level security;
alter table public.academy_provider_usage_cost_components force row level security;

revoke all on table public.academy_provider_prices from public, anon, authenticated;
revoke all on table public.academy_provider_usage_ledger from public, anon, authenticated;
revoke all on table public.academy_provider_usage_cost_components from public, anon, authenticated;
grant select, insert on table public.academy_provider_prices to service_role;
grant select on table public.academy_provider_usage_ledger to service_role;
grant select on table public.academy_provider_usage_cost_components to service_role;

create or replace function academy_private.prevent_provider_price_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'provider prices are append-only; add a new effective period'
    using errcode = '55000';
end;
$$;

create or replace function academy_private.prevent_provider_price_backdating()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from public.academy_provider_prices as existing
    where existing.provider = new.provider
      and existing.product = new.product
      and existing.billing_unit = new.billing_unit
      and existing.effective_from >= new.effective_from
  ) then
    raise exception 'provider prices must be appended in effective-date order' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger academy_provider_prices_no_backdating
  before insert on public.academy_provider_prices
  for each row execute function academy_private.prevent_provider_price_backdating();

create trigger academy_provider_prices_append_only
  before update or delete on public.academy_provider_prices
  for each row execute function academy_private.prevent_provider_price_mutation();

revoke all on function academy_private.prevent_provider_price_mutation() from public, anon, authenticated;
revoke all on function academy_private.prevent_provider_price_backdating() from public, anon, authenticated;

create or replace function public.academy_record_provider_usage(
  p_request_key text,
  p_occurred_at timestamptz,
  p_user_id uuid,
  p_engine text,
  p_provider text,
  p_logical_model_tier text,
  p_provider_product text,
  p_voice_reference text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_cache_read_input_tokens bigint,
  p_cache_write_input_tokens bigint,
  p_characters bigint,
  p_latency_ms integer,
  p_status text,
  p_billing_basis text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_usage_id uuid;
  resolved_household_id uuid;
  household_count bigint;
  component record;
  matching_price_id uuid;
  selected_price public.academy_provider_prices%rowtype;
  component_cost numeric;
  total_cost numeric := 0;
begin
  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_occurred_at is null
    or p_user_id is null
    or p_engine not in ('tutor', 'jarvis', 'tts')
    or p_provider not in ('anthropic', 'elevenlabs')
    or p_provider_product is null
    or length(btrim(p_provider_product)) not between 1 and 120
    or p_latency_ms is null or p_latency_ms not between 0 and 300000
    or p_status not in (
      'success', 'provider_throttled', 'provider_error', 'timeout',
      'missing_usage', 'malformed_usage', 'response_sanitization_failure'
    )
    or p_billing_basis not in ('estimate', 'none', 'unknown')
    or (p_input_tokens is not null and p_input_tokens not between 0 and 1000000000)
    or (p_output_tokens is not null and p_output_tokens not between 0 and 1000000000)
    or (p_cache_read_input_tokens is not null and p_cache_read_input_tokens not between 0 and 1000000000)
    or (p_cache_write_input_tokens is not null and p_cache_write_input_tokens not between 0 and 1000000000)
    or (p_characters is not null and p_characters not between 0 and 1000000000)
    or (
      p_provider = 'anthropic'
      and (
        p_engine not in ('tutor', 'jarvis')
        or p_logical_model_tier not in ('sonnet', 'haiku')
        or p_voice_reference is not null
        or p_characters is not null
      )
    )
    or (
      p_provider = 'elevenlabs'
      and (
        p_engine <> 'tts'
        or p_logical_model_tier is not null
        or p_voice_reference is null
        or p_voice_reference !~ '^[A-Za-z0-9_-]{1,64}$'
        or p_input_tokens is not null
        or p_output_tokens is not null
        or p_cache_read_input_tokens is not null
        or p_cache_write_input_tokens is not null
      )
    )
  then
    raise exception 'invalid provider usage record' using errcode = '22023';
  end if;

  select
    count(distinct membership.household_id),
    min(membership.household_id::text)::uuid
  into household_count, resolved_household_id
  from public.academy_household_memberships as membership
  join public.academy_households as household
    on household.id = membership.household_id
   and household.status = 'active'
  where membership.user_id = p_user_id
    and membership.status = 'active'
    and membership.revoked_at is null;

  if household_count <> 1 then
    resolved_household_id := null;
  end if;

  insert into public.academy_provider_usage_ledger (
    request_key,
    occurred_at,
    user_id,
    household_id,
    learner_id,
    engine,
    provider,
    logical_model_tier,
    provider_product,
    voice_reference,
    input_tokens,
    output_tokens,
    cache_read_input_tokens,
    cache_write_input_tokens,
    characters,
    latency_ms,
    status,
    calculation_status,
    calculated_cost_micros
  ) values (
    p_request_key,
    p_occurred_at,
    p_user_id,
    resolved_household_id,
    null,
    p_engine,
    p_provider,
    p_logical_model_tier,
    p_provider_product,
    p_voice_reference,
    p_input_tokens,
    p_output_tokens,
    p_cache_read_input_tokens,
    p_cache_write_input_tokens,
    p_characters,
    p_latency_ms,
    p_status,
    case p_billing_basis
      when 'none' then 'not_billable'
      when 'unknown' then 'billing_outcome_unknown'
      else 'usage_unavailable'
    end,
    case when p_billing_basis = 'none' then 0 else null end
  )
  on conflict (request_key) do nothing
  returning id into new_usage_id;

  if new_usage_id is null then
    select ledger.id into new_usage_id
    from public.academy_provider_usage_ledger as ledger
    where ledger.request_key = p_request_key;
    return new_usage_id;
  end if;

  if p_billing_basis <> 'estimate' then
    return new_usage_id;
  end if;

  if p_provider = 'anthropic'
    and (p_input_tokens is null or p_output_tokens is null)
  then
    return new_usage_id;
  end if;
  if p_provider = 'elevenlabs' and p_characters is null then
    return new_usage_id;
  end if;

  for component in
    select * from (values
      ('input_token'::text, p_input_tokens),
      ('output_token'::text, p_output_tokens),
      ('cache_read_input_token'::text, p_cache_read_input_tokens),
      ('cache_write_input_token'::text, p_cache_write_input_tokens),
      ('character'::text, p_characters)
    ) as quantities(billing_unit, quantity)
    where quantity is not null and quantity > 0
  loop
    select price.id
    into matching_price_id
    from public.academy_provider_prices as price
    where price.provider = p_provider
      and price.product = p_provider_product
      and price.billing_unit = component.billing_unit
      and price.effective_from <= p_occurred_at
      and (price.effective_to is null or p_occurred_at < price.effective_to)
    order by price.effective_from desc
    limit 1;

    if matching_price_id is null then
      delete from public.academy_provider_usage_cost_components
      where academy_provider_usage_cost_components.usage_id = new_usage_id;
      update public.academy_provider_usage_ledger
      set calculation_status = 'price_unavailable', calculated_cost_micros = null
      where id = new_usage_id;
      return new_usage_id;
    end if;

    select * into selected_price
    from public.academy_provider_prices
    where id = matching_price_id;

    component_cost := floor(
      (
        component.quantity::numeric * selected_price.price_micros::numeric
        + selected_price.unit_quantity::numeric / 2
      ) / selected_price.unit_quantity::numeric
    );
    if component_cost > 9223372036854775807 then
      raise exception 'calculated provider cost exceeds bigint bounds' using errcode = '22003';
    end if;

    insert into public.academy_provider_usage_cost_components (
      usage_id,
      billing_unit,
      quantity,
      price_id,
      price_micros,
      unit_quantity,
      calculated_cost_micros
    ) values (
      new_usage_id,
      component.billing_unit,
      component.quantity,
      selected_price.id,
      selected_price.price_micros,
      selected_price.unit_quantity,
      component_cost::bigint
    );
    total_cost := total_cost + component_cost;
  end loop;

  update public.academy_provider_usage_ledger
  set calculation_status = 'calculated', calculated_cost_micros = total_cost::bigint
  where id = new_usage_id;

  return new_usage_id;
end;
$$;

revoke all on function public.academy_record_provider_usage(
  text, timestamptz, uuid, text, text, text, text, text,
  bigint, bigint, bigint, bigint, bigint, integer, text, text
) from public, anon, authenticated;
grant execute on function public.academy_record_provider_usage(
  text, timestamptz, uuid, text, text, text, text, text,
  bigint, bigint, bigint, bigint, bigint, integer, text, text
) to service_role;

commit;
