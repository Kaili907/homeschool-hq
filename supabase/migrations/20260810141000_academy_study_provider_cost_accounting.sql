-- WIN-2: admit truthful Study safety-classification provider cost accounting.
-- This migration adds no provider price and does not instrument provider calls.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Study provider cost accounting migration must run as postgres';
  end if;
  if to_regclass('public.academy_provider_usage_ledger') is null
     or to_regclass('academy_private.provider_pricing_terms') is null
     or to_regprocedure(
       'public.academy_record_provider_usage(text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,bigint,bigint,bigint,bigint,integer,text,text,text)'
     ) is null
     or to_regprocedure(
       'academy_private.lookup_provider_pricing_term_v1(text,text,text,text,text,timestamptz)'
     ) is null then
    raise exception 'Study provider cost accounting requires the cost ledger and effective-dated pricing foundation';
  end if;
end;
$$;

alter table public.academy_provider_usage_ledger
  add column purpose text;

alter table public.academy_provider_usage_ledger
  drop constraint academy_provider_usage_ledger_engine_check,
  drop constraint academy_provider_usage_provider_shape_check;

alter table public.academy_provider_usage_ledger
  add constraint academy_provider_usage_ledger_engine_v2_check
    check (engine in ('tutor', 'jarvis', 'tts', 'study')),
  add constraint academy_provider_usage_purpose_check check (
    (engine = 'study' and purpose is not distinct from 'safety_classification')
    or
    (engine <> 'study' and purpose is null)
  ),
  add constraint academy_provider_usage_provider_shape_v2_check check (
    (
      provider = 'anthropic'
      and engine in ('tutor', 'jarvis', 'study')
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

create function public.academy_record_provider_usage_v2(
  p_execution_key text,
  p_occurred_at timestamptz,
  p_account_id uuid,
  p_household_id uuid,
  p_household_attribution text,
  p_app_version text,
  p_engine_version text,
  p_curriculum_version text,
  p_engine text,
  p_purpose text,
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
begin
  if auth.uid() is not null or not academy_private.cost_is_trusted_server() then
    raise exception 'PROVIDER_USAGE_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;

  -- Preserve the established entry point and behavior for every pre-existing
  -- engine. The new implementation path is exclusively Study safety.
  if p_engine in ('tutor', 'jarvis', 'tts') and p_purpose is null then
    return public.academy_record_provider_usage(
      p_execution_key,
      p_occurred_at,
      p_account_id,
      p_household_id,
      p_household_attribution,
      p_app_version,
      p_engine_version,
      p_curriculum_version,
      p_engine,
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
      p_billing_disposition
    );
  end if;

  if p_execution_key is null or p_execution_key !~ '^[A-Za-z0-9_-]{1,128}$'
     or p_occurred_at is null
     or p_account_id is null
     or p_household_attribution is null
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
     or p_engine is distinct from 'study'
     or p_purpose is distinct from 'safety_classification'
     or p_provider is distinct from 'anthropic'
     or p_provider_product_id is null
     or p_provider_product_id is distinct from btrim(p_provider_product_id)
     or length(p_provider_product_id) not between 1 and 120
     or p_provider_product_id ~ '[[:cntrl:]]'
     or p_provider_model_id is null
     or p_provider_model_id is distinct from btrim(p_provider_model_id)
     or length(p_provider_model_id) not between 1 and 120
     or p_provider_model_id ~ '[[:cntrl:]]'
     or p_logical_model_tier is null
     or p_logical_model_tier not in ('sonnet', 'haiku')
     or p_tts_characters is not null
     or p_latency_ms is null or p_latency_ms not between 0 and 300000
     or p_result is null
     or p_result not in (
       'success', 'fallback', 'rejected', 'timeout',
       'provider_error', 'validation_error', 'safety_stop'
     )
     or (p_result_reason_code is not null and p_result_reason_code !~ '^[a-z0-9_]{1,64}$')
     or p_billing_disposition is null
     or p_billing_disposition not in ('billable', 'not_billable', 'unknown')
     or (p_input_tokens is not null and p_input_tokens not between 0 and 1000000000)
     or (p_output_tokens is not null and p_output_tokens not between 0 and 1000000000)
     or (p_cached_input_read_tokens is not null and p_cached_input_read_tokens not between 0 and 1000000000)
     or (p_cached_input_write_tokens is not null and p_cached_input_write_tokens not between 0 and 1000000000)
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
     ) then
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
          'purpose', p_purpose,
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
    purpose,
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
    p_purpose,
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

  return jsonb_build_object('usageId', new_usage_id, 'idempotencyResult', 'created');
end;
$$;

alter function public.academy_record_provider_usage_v2(
  text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,text,
  bigint,bigint,bigint,bigint,bigint,integer,text,text,text
) owner to postgres;

revoke all on function public.academy_record_provider_usage_v2(
  text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,text,
  bigint,bigint,bigint,bigint,bigint,integer,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_record_provider_usage_v2(
  text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,text,
  bigint,bigint,bigint,bigint,bigint,integer,text,text,text
) to service_role;

comment on column public.academy_provider_usage_ledger.purpose is
  'Null for legacy Tutor, Jarvis, and TTS rows; exactly safety_classification for Study provider usage.';
comment on function public.academy_record_provider_usage_v2(
  text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,text,
  bigint,bigint,bigint,bigint,bigint,integer,text,text,text
) is
  'Service-only provider usage seam. Existing engines delegate to v1; Study admits only safety_classification with Anthropic and returns usageId for future Provider Attempt Journal linkage.';

commit;
