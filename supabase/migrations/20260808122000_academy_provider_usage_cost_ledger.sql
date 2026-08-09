begin;

create schema if not exists academy_private;

create table public.academy_provider_pricing_catalogs (
  version text primary key check (version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  currency text not null check (currency = 'USD'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  published_at timestamptz not null,
  source_ref text not null check (
    length(btrim(source_ref)) between 1 and 240
    and source_ref !~ '[[:cntrl:]]'
  ),
  constraint academy_provider_pricing_catalogs_period_check check (
    effective_to is null or effective_to > effective_from
  )
);

create table public.academy_provider_prices (
  id uuid primary key default gen_random_uuid(),
  pricing_catalog_version text not null
    references public.academy_provider_pricing_catalogs (version) on delete restrict,
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  provider_product_id text not null check (length(btrim(provider_product_id)) between 1 and 120),
  provider_model_id text not null check (length(btrim(provider_model_id)) between 1 and 120),
  logical_model_tier text check (
    logical_model_tier is null or logical_model_tier in ('sonnet', 'haiku')
  ),
  billing_unit text not null check (
    billing_unit in (
      'input_token',
      'output_token',
      'cached_input_read_token',
      'cached_input_write_token',
      'tts_character',
      'request'
    )
  ),
  currency text not null check (currency = 'USD'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  price_micros bigint not null check (price_micros between 0 and 1000000000),
  unit_quantity bigint not null check (unit_quantity between 1 and 1000000000),
  created_at timestamptz not null default now(),
  constraint academy_provider_prices_period_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint academy_provider_prices_period_key unique (
    pricing_catalog_version,
    provider,
    provider_product_id,
    logical_model_tier,
    billing_unit,
    currency,
    effective_from
  )
);

create table public.academy_provider_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique check (execution_key ~ '^[A-Za-z0-9_-]{1,128}$'),
  immutable_facts_digest text not null check (immutable_facts_digest ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  account_id uuid not null references auth.users (id) on delete restrict,
  household_id uuid references public.academy_households (id) on delete restrict,
  household_attribution text not null check (
    household_attribution in (
      'resolved',
      'no_active_household',
      'ambiguous',
      'lookup_unavailable'
    )
  ),
  learner_id uuid references public.academy_students (id) on delete restrict,
  engine text not null check (engine in ('tutor', 'jarvis', 'tts')),
  app_version text not null check (
    length(app_version) between 1 and 128 and app_version !~ '[[:cntrl:]]'
  ),
  engine_version text check (
    engine_version is null
    or (length(engine_version) between 1 and 128 and engine_version !~ '[[:cntrl:]]')
  ),
  curriculum_version text check (
    curriculum_version is null
    or (length(curriculum_version) between 1 and 128 and curriculum_version !~ '[[:cntrl:]]')
  ),
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  provider_product_id text not null check (length(btrim(provider_product_id)) between 1 and 120),
  provider_model_id text not null check (length(btrim(provider_model_id)) between 1 and 120),
  logical_model_tier text check (
    logical_model_tier is null or logical_model_tier in ('sonnet', 'haiku')
  ),
  input_tokens bigint check (input_tokens between 0 and 1000000000),
  output_tokens bigint check (output_tokens between 0 and 1000000000),
  cached_input_read_tokens bigint check (cached_input_read_tokens between 0 and 1000000000),
  cached_input_write_tokens bigint check (cached_input_write_tokens between 0 and 1000000000),
  tts_characters bigint check (tts_characters between 0 and 1000000000),
  request_count smallint not null default 1 check (request_count = 1),
  latency_ms integer not null check (latency_ms between 0 and 300000),
  result text not null check (
    result in (
      'success',
      'fallback',
      'rejected',
      'timeout',
      'provider_error',
      'validation_error',
      'safety_stop'
    )
  ),
  result_reason_code text check (
    result_reason_code is null or result_reason_code ~ '^[a-z0-9_]{1,64}$'
  ),
  billing_disposition text not null check (
    billing_disposition in ('billable', 'not_billable', 'unknown')
  ),
  cost_kind text not null check (
    cost_kind in ('calculated', 'reconciled', 'unavailable')
  ),
  cost_micros bigint check (cost_micros >= 0),
  currency text not null check (currency = 'USD'),
  pricing_catalog_version text references public.academy_provider_pricing_catalogs (version) on delete restrict,
  reconciliation_ref text check (
    reconciliation_ref is null
    or (length(reconciliation_ref) between 1 and 128 and reconciliation_ref !~ '[[:cntrl:]]')
  ),
  constraint academy_provider_usage_attribution_check check (
    (household_attribution = 'resolved' and household_id is not null)
    or
    (household_attribution <> 'resolved' and household_id is null)
  ),
  constraint academy_provider_usage_learner_check check (
    learner_id is null or (household_attribution = 'resolved' and household_id is not null)
  ),
  constraint academy_provider_usage_provider_shape_check check (
    (
      provider = 'anthropic'
      and engine in ('tutor', 'jarvis')
      and logical_model_tier in ('sonnet', 'haiku')
      and tts_characters is null
      and (
        (
          input_tokens is null
          and output_tokens is null
          and cached_input_read_tokens is null
          and cached_input_write_tokens is null
        )
        or
        (
          input_tokens is not null
          and output_tokens is not null
          and cached_input_read_tokens is not null
          and cached_input_write_tokens is not null
        )
      )
    )
    or
    (
      provider = 'elevenlabs'
      and engine = 'tts'
      and logical_model_tier is null
      and input_tokens is null
      and output_tokens is null
      and cached_input_read_tokens is null
      and cached_input_write_tokens is null
      and tts_characters is not null
    )
  ),
  constraint academy_provider_usage_cost_check check (
    (
      cost_kind = 'unavailable'
      and cost_micros is null
      and pricing_catalog_version is null
      and reconciliation_ref is null
      and billing_disposition <> 'not_billable'
    )
    or
    (
      cost_kind = 'calculated'
      and cost_micros is not null
      and reconciliation_ref is null
      and billing_disposition <> 'unknown'
      and (
        billing_disposition <> 'not_billable'
        or (cost_micros = 0 and pricing_catalog_version is null)
      )
    )
    or
    (
      cost_kind = 'reconciled'
      and cost_micros is not null
      and reconciliation_ref is not null
      and pricing_catalog_version is null
      and billing_disposition <> 'unknown'
    )
  )
);

create table public.academy_provider_usage_cost_components (
  usage_id uuid not null references public.academy_provider_usage_ledger (id) on delete restrict,
  billing_unit text not null check (
    billing_unit in (
      'input_token',
      'output_token',
      'cached_input_read_token',
      'cached_input_write_token',
      'tts_character',
      'request'
    )
  ),
  quantity bigint not null check (quantity between 0 and 1000000000),
  rate_id uuid not null references public.academy_provider_prices (id) on delete restrict,
  pricing_catalog_version text not null,
  provider text not null,
  provider_product_id text not null,
  provider_model_id text not null,
  logical_model_tier text,
  currency text not null check (currency = 'USD'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  price_micros bigint not null check (price_micros between 0 and 1000000000),
  unit_quantity bigint not null check (unit_quantity between 1 and 1000000000),
  calculated_cost_micros bigint not null check (calculated_cost_micros >= 0),
  primary key (usage_id, billing_unit),
  constraint academy_provider_usage_components_period_check check (
    effective_to is null or effective_to > effective_from
  )
);

create index academy_provider_usage_ledger_occurred_idx
  on public.academy_provider_usage_ledger (occurred_at desc);
create index academy_provider_usage_ledger_household_occurred_idx
  on public.academy_provider_usage_ledger (household_id, occurred_at desc);
create index academy_provider_usage_ledger_provider_product_idx
  on public.academy_provider_usage_ledger (provider, provider_product_id, occurred_at desc);

alter table public.academy_provider_pricing_catalogs enable row level security;
alter table public.academy_provider_pricing_catalogs force row level security;
alter table public.academy_provider_prices enable row level security;
alter table public.academy_provider_prices force row level security;
alter table public.academy_provider_usage_ledger enable row level security;
alter table public.academy_provider_usage_ledger force row level security;
alter table public.academy_provider_usage_cost_components enable row level security;
alter table public.academy_provider_usage_cost_components force row level security;

revoke all on table public.academy_provider_pricing_catalogs from public, anon, authenticated;
revoke all on table public.academy_provider_prices from public, anon, authenticated;
revoke all on table public.academy_provider_usage_ledger from public, anon, authenticated;
revoke all on table public.academy_provider_usage_cost_components from public, anon, authenticated;
grant select, insert on table public.academy_provider_pricing_catalogs to service_role;
grant select, insert on table public.academy_provider_prices to service_role;
grant select on table public.academy_provider_usage_ledger to service_role;
grant select on table public.academy_provider_usage_cost_components to service_role;

create or replace function academy_private.prevent_provider_accounting_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'provider accounting configuration is immutable; add a new version'
    using errcode = '55000';
end;
$$;

create or replace function academy_private.validate_provider_catalog_period()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  lock table public.academy_provider_pricing_catalogs in share row exclusive mode;
  if exists (
    select 1
    from public.academy_provider_pricing_catalogs as existing
    where existing.effective_from < coalesce(new.effective_to, 'infinity'::timestamptz)
      and new.effective_from < coalesce(existing.effective_to, 'infinity'::timestamptz)
  ) then
    raise exception 'provider pricing catalog periods may not overlap' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function academy_private.validate_provider_rate_period()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  catalog public.academy_provider_pricing_catalogs%rowtype;
begin
  lock table public.academy_provider_prices in share row exclusive mode;
  select * into catalog
  from public.academy_provider_pricing_catalogs
  where version = new.pricing_catalog_version;

  if catalog.version is null
    or new.currency <> catalog.currency
    or new.effective_from < catalog.effective_from
    or (
      catalog.effective_to is not null
      and (new.effective_to is null or new.effective_to > catalog.effective_to)
    )
  then
    raise exception 'provider rate must be inside its catalog period and currency'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.academy_provider_prices as existing
    where existing.pricing_catalog_version = new.pricing_catalog_version
      and existing.provider = new.provider
      and existing.provider_product_id = new.provider_product_id
      and existing.logical_model_tier is not distinct from new.logical_model_tier
      and existing.billing_unit = new.billing_unit
      and existing.currency = new.currency
      and existing.effective_from < coalesce(new.effective_to, 'infinity'::timestamptz)
      and new.effective_from < coalesce(existing.effective_to, 'infinity'::timestamptz)
  ) then
    raise exception 'provider rate periods may not overlap' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger academy_provider_pricing_catalogs_no_overlap
  before insert on public.academy_provider_pricing_catalogs
  for each row execute function academy_private.validate_provider_catalog_period();
create trigger academy_provider_pricing_catalogs_immutable
  before update or delete on public.academy_provider_pricing_catalogs
  for each row execute function academy_private.prevent_provider_accounting_mutation();
create trigger academy_provider_prices_no_overlap
  before insert on public.academy_provider_prices
  for each row execute function academy_private.validate_provider_rate_period();
create trigger academy_provider_prices_immutable
  before update or delete on public.academy_provider_prices
  for each row execute function academy_private.prevent_provider_accounting_mutation();

revoke all on function academy_private.prevent_provider_accounting_mutation() from public, anon, authenticated;
revoke all on function academy_private.validate_provider_catalog_period() from public, anon, authenticated;
revoke all on function academy_private.validate_provider_rate_period() from public, anon, authenticated;

create or replace function public.academy_record_provider_usage(
  p_execution_key text,
  p_occurred_at timestamptz,
  p_account_id uuid,
  p_household_id uuid,
  p_household_attribution text,
  p_app_version text,
  p_engine_version text,
  p_curriculum_version text,
  p_engine text,
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_cached_input_read_tokens bigint,
  p_cached_input_write_tokens bigint,
  p_tts_characters bigint,
  p_latency_ms integer,
  p_result text,
  p_result_reason_code text,
  p_billing_disposition text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_usage_id uuid := gen_random_uuid();
  existing_usage_id uuid;
  immutable_facts_digest text;
  existing_facts_digest text;
  selected_catalog_version text;
  matching_catalog_count bigint;
  component record;
  matching_rate_count bigint;
  matching_rate_id uuid;
  selected_rate public.academy_provider_prices%rowtype;
  component_cost numeric;
  total_cost numeric := 0;
  has_positive_usage_quantity boolean := false;
  has_priced_component boolean := false;
  request_quantity bigint;
begin
  if p_execution_key is null or p_execution_key !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_occurred_at is null
    or p_account_id is null
    or p_household_attribution not in (
      'resolved', 'no_active_household', 'ambiguous', 'lookup_unavailable'
    )
    or (p_household_attribution = 'resolved') <> (p_household_id is not null)
    or p_app_version is null
    or length(p_app_version) not between 1 and 128
    or p_app_version ~ '[[:cntrl:]]'
    or (p_engine_version is not null and (
      length(p_engine_version) not between 1 and 128 or p_engine_version ~ '[[:cntrl:]]'
    ))
    or (p_curriculum_version is not null and (
      length(p_curriculum_version) not between 1 and 128 or p_curriculum_version ~ '[[:cntrl:]]'
    ))
    or p_engine not in ('tutor', 'jarvis', 'tts')
    or p_provider not in ('anthropic', 'elevenlabs')
    or p_provider_product_id is null
    or length(btrim(p_provider_product_id)) not between 1 and 120
    or p_provider_model_id is null
    or length(btrim(p_provider_model_id)) not between 1 and 120
    or p_latency_ms is null or p_latency_ms not between 0 and 300000
    or p_result not in (
      'success', 'fallback', 'rejected', 'timeout',
      'provider_error', 'validation_error', 'safety_stop'
    )
    or (p_result_reason_code is not null and p_result_reason_code !~ '^[a-z0-9_]{1,64}$')
    or p_billing_disposition not in ('billable', 'not_billable', 'unknown')
    or (p_input_tokens is not null and p_input_tokens not between 0 and 1000000000)
    or (p_output_tokens is not null and p_output_tokens not between 0 and 1000000000)
    or (p_cached_input_read_tokens is not null and p_cached_input_read_tokens not between 0 and 1000000000)
    or (p_cached_input_write_tokens is not null and p_cached_input_write_tokens not between 0 and 1000000000)
    or (p_tts_characters is not null and p_tts_characters not between 0 and 1000000000)
    or (
      p_provider = 'anthropic'
      and (
        p_engine not in ('tutor', 'jarvis')
        or p_logical_model_tier not in ('sonnet', 'haiku')
        or p_tts_characters is not null
        or not (
          (
            p_input_tokens is null
            and p_output_tokens is null
            and p_cached_input_read_tokens is null
            and p_cached_input_write_tokens is null
          )
          or
          (
            p_input_tokens is not null
            and p_output_tokens is not null
            and p_cached_input_read_tokens is not null
            and p_cached_input_write_tokens is not null
          )
        )
      )
    )
    or (
      p_provider = 'elevenlabs'
      and (
        p_engine <> 'tts'
        or p_logical_model_tier is not null
        or p_input_tokens is not null
        or p_output_tokens is not null
        or p_cached_input_read_tokens is not null
        or p_cached_input_write_tokens is not null
        or p_tts_characters is null
      )
    )
  then
    raise exception 'invalid provider usage record' using errcode = '22023';
  end if;

  immutable_facts_digest := encode(
    sha256(
      convert_to(
        jsonb_build_object(
          'occurred_at', to_char(
            p_occurred_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          'account_id', p_account_id,
          'household_id', p_household_id,
          'household_attribution', p_household_attribution,
          'app_version', p_app_version,
          'engine_version', p_engine_version,
          'curriculum_version', p_curriculum_version,
          'engine', p_engine,
          'provider', p_provider,
          'provider_product_id', p_provider_product_id,
          'provider_model_id', p_provider_model_id,
          'logical_model_tier', p_logical_model_tier,
          'input_tokens', p_input_tokens,
          'output_tokens', p_output_tokens,
          'cached_input_read_tokens', p_cached_input_read_tokens,
          'cached_input_write_tokens', p_cached_input_write_tokens,
          'tts_characters', p_tts_characters,
          'latency_ms', p_latency_ms,
          'result', p_result,
          'result_reason_code', p_result_reason_code,
          'billing_disposition', p_billing_disposition,
          'currency', 'USD'
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  insert into public.academy_provider_usage_ledger (
    id,
    execution_key,
    immutable_facts_digest,
    occurred_at,
    account_id,
    household_id,
    household_attribution,
    learner_id,
    engine,
    app_version,
    engine_version,
    curriculum_version,
    provider,
    provider_product_id,
    provider_model_id,
    logical_model_tier,
    input_tokens,
    output_tokens,
    cached_input_read_tokens,
    cached_input_write_tokens,
    tts_characters,
    latency_ms,
    result,
    result_reason_code,
    billing_disposition,
    cost_kind,
    cost_micros,
    currency,
    pricing_catalog_version,
    reconciliation_ref
  ) values (
    new_usage_id,
    p_execution_key,
    immutable_facts_digest,
    p_occurred_at,
    p_account_id,
    p_household_id,
    p_household_attribution,
    null,
    p_engine,
    p_app_version,
    p_engine_version,
    p_curriculum_version,
    p_provider,
    p_provider_product_id,
    p_provider_model_id,
    p_logical_model_tier,
    p_input_tokens,
    p_output_tokens,
    p_cached_input_read_tokens,
    p_cached_input_write_tokens,
    p_tts_characters,
    p_latency_ms,
    p_result,
    p_result_reason_code,
    p_billing_disposition,
    case when p_billing_disposition = 'not_billable' then 'calculated' else 'unavailable' end,
    case when p_billing_disposition = 'not_billable' then 0 else null end,
    'USD',
    null,
    null
  )
  on conflict (execution_key) do nothing;

  if not found then
    select id, ledger.immutable_facts_digest
    into existing_usage_id, existing_facts_digest
    from public.academy_provider_usage_ledger as ledger
    where ledger.execution_key = p_execution_key;

    if existing_facts_digest = immutable_facts_digest then
      return jsonb_build_object(
        'usageId', existing_usage_id,
        'idempotencyResult', 'replayed'
      );
    end if;
    raise exception 'reconciliation_conflict' using errcode = '23505';
  end if;

  select ledger.request_count::bigint
  into request_quantity
  from public.academy_provider_usage_ledger as ledger
  where ledger.id = new_usage_id;

  if p_billing_disposition <> 'billable' then
    return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
  end if;

  if p_provider = 'anthropic' and p_input_tokens is null then
    return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
  end if;

  has_positive_usage_quantity :=
    coalesce(p_input_tokens, 0) > 0
    or coalesce(p_output_tokens, 0) > 0
    or coalesce(p_cached_input_read_tokens, 0) > 0
    or coalesce(p_cached_input_write_tokens, 0) > 0
    or coalesce(p_tts_characters, 0) > 0;

  select count(*), min(catalog.version)
  into matching_catalog_count, selected_catalog_version
  from public.academy_provider_pricing_catalogs as catalog
  where catalog.currency = 'USD'
    and catalog.effective_from <= p_occurred_at
    and (catalog.effective_to is null or p_occurred_at < catalog.effective_to);

  if matching_catalog_count = 0 and not has_positive_usage_quantity then
    update public.academy_provider_usage_ledger
    set cost_kind = 'calculated', cost_micros = 0
    where id = new_usage_id;
    return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
  end if;

  if matching_catalog_count <> 1 then
    return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
  end if;

  for component in
    select * from (values
      ('input_token'::text, p_input_tokens, false),
      ('output_token'::text, p_output_tokens, false),
      ('cached_input_read_token'::text, p_cached_input_read_tokens, false),
      ('cached_input_write_token'::text, p_cached_input_write_tokens, false),
      ('tts_character'::text, p_tts_characters, false),
      ('request'::text, request_quantity, true)
    ) as quantities(billing_unit, quantity, optional_rate)
    where quantity is not null and quantity > 0
  loop
    matching_rate_id := null;
    select count(*), min(price.id::text)::uuid
    into matching_rate_count, matching_rate_id
    from public.academy_provider_prices as price
    where price.pricing_catalog_version = selected_catalog_version
      and price.provider = p_provider
      and price.provider_product_id = p_provider_product_id
      and price.provider_model_id = p_provider_model_id
      and price.logical_model_tier is not distinct from p_logical_model_tier
      and price.billing_unit = component.billing_unit
      and price.currency = 'USD'
      and price.effective_from <= p_occurred_at
      and (price.effective_to is null or p_occurred_at < price.effective_to);

    if component.optional_rate and matching_rate_count = 0 then
      continue;
    end if;

    if matching_rate_count <> 1 then
      delete from public.academy_provider_usage_cost_components where usage_id = new_usage_id;
      return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
    end if;

    select * into selected_rate
    from public.academy_provider_prices
    where id = matching_rate_id;

    component_cost := floor(
      (
        component.quantity::numeric * selected_rate.price_micros::numeric
        + selected_rate.unit_quantity::numeric / 2
      ) / selected_rate.unit_quantity::numeric
    );
    if component_cost > 9223372036854775807 then
      raise exception 'calculated provider cost exceeds bigint bounds' using errcode = '22003';
    end if;

    insert into public.academy_provider_usage_cost_components (
      usage_id,
      billing_unit,
      quantity,
      rate_id,
      pricing_catalog_version,
      provider,
      provider_product_id,
      provider_model_id,
      logical_model_tier,
      currency,
      effective_from,
      effective_to,
      price_micros,
      unit_quantity,
      calculated_cost_micros
    ) values (
      new_usage_id,
      component.billing_unit,
      component.quantity,
      selected_rate.id,
      selected_rate.pricing_catalog_version,
      selected_rate.provider,
      selected_rate.provider_product_id,
      selected_rate.provider_model_id,
      selected_rate.logical_model_tier,
      selected_rate.currency,
      selected_rate.effective_from,
      selected_rate.effective_to,
      selected_rate.price_micros,
      selected_rate.unit_quantity,
      component_cost::bigint
    );
    total_cost := total_cost + component_cost;
    has_priced_component := true;
  end loop;

  if not has_priced_component then
    update public.academy_provider_usage_ledger
    set cost_kind = 'calculated', cost_micros = 0
    where id = new_usage_id;
    return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
  end if;

  if total_cost > 9223372036854775807 then
    raise exception 'calculated provider cost exceeds bigint bounds' using errcode = '22003';
  end if;

  update public.academy_provider_usage_ledger
  set cost_kind = 'calculated',
      cost_micros = total_cost::bigint,
      pricing_catalog_version = selected_catalog_version
  where id = new_usage_id;

  return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
end;
$$;

create or replace function public.academy_read_provider_usage_costs(
  p_limit integer default 100,
  p_before timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(projected.record order by projected.occurred_at desc), '[]'::jsonb)
  from (
    select
      ledger.occurred_at,
      jsonb_build_object(
        'schemaVersion', 2,
        'usageId', ledger.id,
        'occurredAt', to_char(ledger.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'accountRef', ledger.account_id,
        'householdRef', ledger.household_id,
        'householdAttribution', ledger.household_attribution,
        'learnerRef', ledger.learner_id,
        'engine', ledger.engine,
        'appVersion', ledger.app_version,
        'engineVersion', ledger.engine_version,
        'curriculumVersion', ledger.curriculum_version,
        'provider', ledger.provider,
        'providerProductId', ledger.provider_product_id,
        'logicalModelTier', ledger.logical_model_tier,
        'providerModelId', ledger.provider_model_id,
        'inputTokens', ledger.input_tokens,
        'outputTokens', ledger.output_tokens,
        'cachedInputReadTokens', ledger.cached_input_read_tokens,
        'cachedInputWriteTokens', ledger.cached_input_write_tokens,
        'ttsCharacters', ledger.tts_characters,
        'requestCount', ledger.request_count,
        'latencyMs', ledger.latency_ms,
        'result', ledger.result,
        'resultReasonCode', ledger.result_reason_code,
        'billingDisposition', ledger.billing_disposition,
        'costMicros', case when ledger.cost_micros is null then null else ledger.cost_micros::text end,
        'currency', ledger.currency,
        'costKind', ledger.cost_kind,
        'pricingCatalogVersion', ledger.pricing_catalog_version,
        'costComponents', case
          when ledger.cost_kind <> 'calculated' then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'unit', component.billing_unit,
                'quantity', component.quantity,
                'rate', jsonb_build_object(
                  'rateId', component.rate_id,
                  'pricingCatalogVersion', component.pricing_catalog_version,
                  'provider', component.provider,
                  'providerProductId', component.provider_product_id,
                  'logicalModelTier', component.logical_model_tier,
                  'unit', component.billing_unit,
                  'unitSize', component.unit_quantity,
                  'priceMicrosPerUnitSize', component.price_micros::text,
                  'currency', component.currency,
                  'effectiveFrom', to_char(component.effective_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                  'effectiveTo', case when component.effective_to is null then null else
                    to_char(component.effective_to at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end
                ),
                'calculatedCostMicros', component.calculated_cost_micros::text
              )
              order by component.billing_unit
            )
            from public.academy_provider_usage_cost_components as component
            where component.usage_id = ledger.id
          ), '[]'::jsonb)
        end,
        'reconciliationRef', ledger.reconciliation_ref
      ) as record
    from public.academy_provider_usage_ledger as ledger
    where p_limit between 1 and 500
      and p_before is not null
      and ledger.occurred_at < p_before
    order by ledger.occurred_at desc
    limit p_limit
  ) as projected;
$$;

revoke all on function public.academy_record_provider_usage(
  text, timestamptz, uuid, uuid, text, text, text, text, text, text, text,
  text, text, bigint, bigint, bigint, bigint, bigint, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.academy_record_provider_usage(
  text, timestamptz, uuid, uuid, text, text, text, text, text, text, text,
  text, text, bigint, bigint, bigint, bigint, bigint, integer, text, text, text
) to service_role;

revoke all on function public.academy_read_provider_usage_costs(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.academy_read_provider_usage_costs(integer, timestamptz)
  to service_role;

commit;
