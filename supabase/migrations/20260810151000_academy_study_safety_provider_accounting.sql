-- Admit only the authoritative Study safety provider dimensions to the cost ledger.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Study safety provider accounting migration must run as postgres';
  end if;
  if to_regclass('public.academy_provider_usage_ledger') is null
     or to_regclass('public.academy_provider_attempts') is null then
    raise exception 'Study safety provider accounting requires ledger and journal foundations';
  end if;
end;
$$;

alter table public.academy_provider_usage_ledger
  drop constraint academy_provider_usage_ledger_engine_check,
  drop constraint academy_provider_usage_provider_shape_check;

alter table public.academy_provider_usage_ledger
  add constraint academy_provider_usage_ledger_engine_check
    check (engine in ('tutor', 'study', 'jarvis', 'tts')),
  add constraint academy_provider_usage_provider_shape_check check (
    (
      provider = 'anthropic'
      and engine in ('tutor', 'study', 'jarvis')
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
  );

alter table public.academy_provider_usage_ledger
  add column purpose text generated always as (
    case engine
      when 'tutor' then 'tutor_turn'
      when 'study' then 'safety_classification'
      when 'jarvis' then 'jarvis_turn'
      when 'tts' then 'tts_synthesis'
    end
  ) stored not null;

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
    or p_engine not in ('tutor', 'study', 'jarvis', 'tts')
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
        p_engine not in ('tutor', 'study', 'jarvis')
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


comment on column public.academy_provider_usage_ledger.purpose is
  'Authoritative provider-operation purpose derived from the closed engine vocabulary; Study is safety_classification.';

commit;
