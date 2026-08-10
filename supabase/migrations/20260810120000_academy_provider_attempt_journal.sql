-- MAC-ADMIN-6: durable provider-attempt coverage without changing cost authority.
-- The provider usage ledger remains the sole authority for usage and cost.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Provider attempt journal migration must run as postgres';
  end if;
  if to_regclass('public.academy_provider_usage_ledger') is null
     or to_regclass('public.academy_households') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception
      'Provider attempt journal requires identity and provider cost ledger foundations';
  end if;
end;
$$;

create or replace function academy_private.provider_attempt_json_has_exact_keys(
  candidate jsonb,
  expected_keys text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and jsonb_typeof(candidate) = 'object'
    and (
      select count(*) = cardinality(expected_keys)
        and coalesce(bool_and(key = any(expected_keys)), false)
      from jsonb_object_keys(candidate) as key
    );
$$;

create or replace function academy_private.provider_attempt_reference_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$';
$$;

create or replace function academy_private.provider_attempt_token_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'
    and candidate !~* '(^|[._:-])(secret|credential|bearer|password|jwt|api.?key)([._:-]|$)';
$$;

create or replace function academy_private.provider_attempt_ledger_key_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9_-]{1,128}$';
$$;

create or replace function academy_private.provider_attempt_version_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~ '^[A-Za-z0-9][A-Za-z0-9._:@/+\x2D]{0,127}$';
$$;

create or replace function academy_private.provider_attempt_uuid_text_is_valid(
  candidate text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate is not null
    and candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function academy_private.provider_attempt_shape_is_valid(
  target_engine text,
  target_purpose text,
  target_provider text,
  target_logical_model_tier text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when target_engine = 'tutor' and target_purpose = 'tutor_turn' then
      target_provider = 'anthropic'
      and target_logical_model_tier in ('sonnet', 'haiku')
    when target_engine = 'jarvis' and target_purpose = 'jarvis_turn' then
      target_provider = 'anthropic'
      and target_logical_model_tier in ('sonnet', 'haiku')
    when target_engine = 'study' and target_purpose = 'safety_classification' then
      target_provider = 'anthropic'
      and target_logical_model_tier in ('sonnet', 'haiku')
    when target_engine = 'tts' and target_purpose = 'tts_synthesis' then
      target_provider = 'elevenlabs'
      and target_logical_model_tier is null
    else false
  end;
$$;

create or replace function academy_private.provider_attempt_is_trusted_server()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select auth.uid() is null
    and coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      case
        when nullif(current_setting('request.jwt.claims', true), '') is null
          then null
        else current_setting('request.jwt.claims', true)::jsonb->>'role'
      end,
      nullif(current_setting('role', true), '')
    ) = 'service_role';
$$;

create table public.academy_provider_attempts (
  attempt_id uuid primary key,
  schema_version smallint not null default 1 check (schema_version = 1),
  reservation_key text not null unique
    check (academy_private.provider_attempt_reference_is_valid(reservation_key)),
  immutable_facts_digest text not null check (immutable_facts_digest ~ '^[0-9a-f]{64}$'),
  logical_operation_key text not null
    check (academy_private.provider_attempt_reference_is_valid(logical_operation_key)),
  physical_retry_index integer not null check (physical_retry_index between 0 and 100),
  operational_execution_key text not null unique
    check (academy_private.provider_attempt_reference_is_valid(operational_execution_key)),
  ledger_execution_key text not null unique
    check (academy_private.provider_attempt_ledger_key_is_valid(ledger_execution_key)),
  reserved_at timestamptz not null,
  account_id uuid not null references auth.users (id) on delete restrict,
  household_id uuid references public.academy_households (id) on delete restrict,
  household_attribution text not null check (
    household_attribution in (
      'resolved', 'no_active_household', 'ambiguous', 'lookup_unavailable'
    )
  ),
  engine text not null check (engine in ('tutor', 'study', 'jarvis', 'tts')),
  purpose text not null check (
    purpose in ('tutor_turn', 'jarvis_turn', 'tts_synthesis', 'safety_classification')
  ),
  app_version text not null
    check (academy_private.provider_attempt_version_is_valid(app_version)),
  engine_version text check (
    engine_version is null
    or academy_private.provider_attempt_version_is_valid(engine_version)
  ),
  curriculum_version text check (
    curriculum_version is null
    or academy_private.provider_attempt_version_is_valid(curriculum_version)
  ),
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  provider_product_id text not null check (
    length(btrim(provider_product_id)) between 1 and 120
    and provider_product_id !~ '[[:cntrl:]]'
  ),
  provider_model_id text not null check (
    length(btrim(provider_model_id)) between 1 and 120
    and provider_model_id !~ '[[:cntrl:]]'
  ),
  logical_model_tier text check (
    logical_model_tier is null or logical_model_tier in ('sonnet', 'haiku')
  ),
  constraint academy_provider_attempts_logical_retry_unique
    unique (logical_operation_key, physical_retry_index),
  constraint academy_provider_attempts_attribution_check check (
    (household_attribution = 'resolved' and household_id is not null)
    or (household_attribution <> 'resolved' and household_id is null)
  ),
  constraint academy_provider_attempts_shape_check check (
    academy_private.provider_attempt_shape_is_valid(
      engine, purpose, provider, logical_model_tier
    )
  )
);

create table public.academy_provider_attempt_transitions (
  transition_id uuid primary key,
  attempt_id uuid not null
    references public.academy_provider_attempts (attempt_id) on delete restrict,
  sequence integer not null check (sequence > 0),
  transition_key text not null unique
    check (academy_private.provider_attempt_reference_is_valid(transition_key)),
  from_state text,
  to_state text not null check (
    to_state in (
      'reserved', 'dispatch_possible', 'outcome_observed', 'ledgered',
      'gap_pending', 'reconciliation_conflict', 'reconciled',
      'confirmed_not_dispatched', 'unresolvable'
    )
  ),
  transitioned_at timestamptz not null,
  outcome_result text check (
    outcome_result is null or outcome_result in (
      'success', 'fallback', 'rejected', 'timeout', 'provider_error',
      'validation_error', 'safety_stop'
    )
  ),
  reason_code text check (
    reason_code is null
    or academy_private.provider_attempt_token_is_valid(reason_code)
  ),
  reconciliation_ref text check (
    reconciliation_ref is null
    or academy_private.provider_attempt_reference_is_valid(reconciliation_ref)
  ),
  ledger_usage_id uuid
    references public.academy_provider_usage_ledger (id) on delete restrict,
  constraint academy_provider_attempt_transitions_sequence_unique
    unique (attempt_id, sequence),
  constraint academy_provider_attempt_transitions_from_state_check check (
    from_state is null or from_state in (
      'reserved', 'dispatch_possible', 'outcome_observed', 'ledgered',
      'gap_pending', 'reconciliation_conflict', 'reconciled',
      'confirmed_not_dispatched', 'unresolvable'
    )
  ),
  constraint academy_provider_attempt_transitions_payload_check check (
    (
      to_state in ('reserved', 'dispatch_possible', 'ledgered')
      and outcome_result is null and reason_code is null
      and reconciliation_ref is null
      and (to_state = 'ledgered') = (ledger_usage_id is not null)
    )
    or (
      to_state = 'outcome_observed'
      and outcome_result is not null
      and reconciliation_ref is null and ledger_usage_id is null
    )
    or (
      to_state in ('gap_pending', 'confirmed_not_dispatched')
      and outcome_result is null and reason_code is not null
      and reconciliation_ref is null and ledger_usage_id is null
    )
    or (
      to_state = 'reconciliation_conflict'
      and outcome_result is null and reason_code is not null
      and reconciliation_ref is null
    )
    or (
      to_state = 'reconciled'
      and outcome_result is null and reason_code is not null
      and reconciliation_ref is not null and ledger_usage_id is null
    )
    or (
      to_state = 'unresolvable'
      and outcome_result is null and reason_code is not null
      and ledger_usage_id is null
    )
  )
);

create table public.academy_provider_attempt_ledger_links (
  attempt_id uuid primary key
    references public.academy_provider_attempts (attempt_id) on delete restrict,
  usage_id uuid not null unique
    references public.academy_provider_usage_ledger (id) on delete restrict,
  link_transition_id uuid not null unique
    references public.academy_provider_attempt_transitions (transition_id) on delete restrict,
  linked_at timestamptz not null
);

create index academy_provider_attempts_reserved_idx
  on public.academy_provider_attempts (reserved_at desc, attempt_id);
create index academy_provider_attempts_operation_retry_idx
  on public.academy_provider_attempts (logical_operation_key, physical_retry_index);
create index academy_provider_attempts_dimensions_idx
  on public.academy_provider_attempts (engine, purpose, provider, reserved_at desc);
create index academy_provider_attempt_transitions_attempt_idx
  on public.academy_provider_attempt_transitions (attempt_id, sequence desc);
create index academy_provider_attempt_transitions_state_idx
  on public.academy_provider_attempt_transitions (to_state, transitioned_at desc);

alter table public.academy_provider_attempts enable row level security;
alter table public.academy_provider_attempts force row level security;
alter table public.academy_provider_attempt_transitions enable row level security;
alter table public.academy_provider_attempt_transitions force row level security;
alter table public.academy_provider_attempt_ledger_links enable row level security;
alter table public.academy_provider_attempt_ledger_links force row level security;

create or replace function academy_private.prevent_provider_attempt_evidence_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'provider attempt evidence is append-only' using errcode = '55000';
end;
$$;

create trigger academy_provider_attempts_append_only
  before update or delete on public.academy_provider_attempts
  for each row execute function academy_private.prevent_provider_attempt_evidence_mutation();
create trigger academy_provider_attempt_transitions_append_only
  before update or delete on public.academy_provider_attempt_transitions
  for each row execute function academy_private.prevent_provider_attempt_evidence_mutation();
create trigger academy_provider_attempt_ledger_links_append_only
  before update or delete on public.academy_provider_attempt_ledger_links
  for each row execute function academy_private.prevent_provider_attempt_evidence_mutation();

create or replace function academy_private.provider_attempt_receipt(
  target_status text,
  target_attempt_id uuid,
  target_state text
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'status', target_status,
    'attemptId', target_attempt_id,
    'state', target_state
  );
$$;

create or replace function public.academy_reserve_provider_attempt_v1(
  p_reservation_key text,
  p_facts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_attempt_id uuid := gen_random_uuid();
  target_reserved_at timestamptz := clock_timestamp();
  target_digest text;
  target_account_id uuid;
  target_household_id uuid;
  target_retry_index integer;
  existing_state text;
  existing public.academy_provider_attempts%rowtype;
  inserted public.academy_provider_attempts%rowtype;
begin
  if not academy_private.provider_attempt_is_trusted_server()
     or auth.uid() is not null then
    raise exception 'PROVIDER_ATTEMPT_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if not academy_private.provider_attempt_reference_is_valid(p_reservation_key)
     or not academy_private.provider_attempt_json_has_exact_keys(
       p_facts,
       array[
         'schema_version', 'logical_operation_key', 'physical_retry_index',
         'operational_execution_key', 'ledger_execution_key', 'account_id',
         'household_id', 'household_attribution', 'engine', 'purpose',
         'app_version', 'engine_version', 'curriculum_version', 'provider',
         'provider_product_id', 'provider_model_id', 'logical_model_tier'
       ]::text[]
     )
     or p_facts->>'schema_version' <> '1'
     or not academy_private.provider_attempt_reference_is_valid(
       p_facts->>'logical_operation_key'
     )
     or not academy_private.provider_attempt_reference_is_valid(
       p_facts->>'operational_execution_key'
     )
     or not academy_private.provider_attempt_ledger_key_is_valid(
       p_facts->>'ledger_execution_key'
     )
     or not academy_private.provider_attempt_uuid_text_is_valid(p_facts->>'account_id')
     or p_facts->>'household_attribution' not in (
       'resolved', 'no_active_household', 'ambiguous', 'lookup_unavailable'
     )
     or p_facts->>'engine' not in ('tutor', 'study', 'jarvis', 'tts')
     or p_facts->>'purpose' not in (
       'tutor_turn', 'jarvis_turn', 'tts_synthesis', 'safety_classification'
     )
     or not academy_private.provider_attempt_version_is_valid(p_facts->>'app_version')
     or p_facts->>'provider' not in ('anthropic', 'elevenlabs')
     or length(btrim(p_facts->>'provider_product_id')) not between 1 and 120
     or length(btrim(p_facts->>'provider_model_id')) not between 1 and 120
     or (p_facts->>'provider_product_id') ~ '[[:cntrl:]]'
     or (p_facts->>'provider_model_id') ~ '[[:cntrl:]]' then
    raise exception 'PROVIDER_ATTEMPT_RESERVATION_INVALID' using errcode = '22023';
  end if;

  if jsonb_typeof(p_facts->'physical_retry_index') = 'number'
     and (p_facts->>'physical_retry_index')::numeric = trunc(
       (p_facts->>'physical_retry_index')::numeric
     )
     and (p_facts->>'physical_retry_index')::numeric between 0 and 100 then
    target_retry_index := (p_facts->>'physical_retry_index')::integer;
  else
    raise exception 'PROVIDER_ATTEMPT_RETRY_INVALID' using errcode = '22023';
  end if;

  target_account_id := (p_facts->>'account_id')::uuid;
  target_household_id := case
    when p_facts->'household_id' = 'null'::jsonb then null
    when academy_private.provider_attempt_uuid_text_is_valid(p_facts->>'household_id')
      then (p_facts->>'household_id')::uuid
    else null
  end;
  if (
    p_facts->'household_id' <> 'null'::jsonb and target_household_id is null
  ) or (
    (p_facts->>'household_attribution' = 'resolved') <> (target_household_id is not null)
  ) or not exists (
    select 1 from auth.users as account where account.id = target_account_id
  ) or (
    target_household_id is not null and not exists (
      select 1
      from public.academy_households as household
      where household.id = target_household_id and household.status = 'active'
    )
  ) then
    raise exception 'PROVIDER_ATTEMPT_AUTHORITY_INVALID' using errcode = '22023';
  end if;

  if (p_facts->'engine_version' <> 'null'::jsonb and not
      academy_private.provider_attempt_version_is_valid(p_facts->>'engine_version'))
     or (p_facts->'curriculum_version' <> 'null'::jsonb and not
      academy_private.provider_attempt_version_is_valid(p_facts->>'curriculum_version'))
     or (p_facts->'logical_model_tier' <> 'null'::jsonb and
      p_facts->>'logical_model_tier' not in ('sonnet', 'haiku'))
     or not academy_private.provider_attempt_shape_is_valid(
       p_facts->>'engine',
       p_facts->>'purpose',
       p_facts->>'provider',
       case when p_facts->'logical_model_tier' = 'null'::jsonb
         then null else p_facts->>'logical_model_tier' end
     ) then
    raise exception 'PROVIDER_ATTEMPT_DIMENSIONS_INVALID' using errcode = '22023';
  end if;

  target_digest := encode(sha256(convert_to(
    (jsonb_build_object('reservation_key', p_reservation_key) || p_facts)::text,
    'UTF8'
  )), 'hex');

  insert into public.academy_provider_attempts (
    attempt_id, schema_version, reservation_key, immutable_facts_digest,
    logical_operation_key, physical_retry_index, operational_execution_key,
    ledger_execution_key, reserved_at, account_id, household_id,
    household_attribution, engine, purpose, app_version, engine_version,
    curriculum_version, provider, provider_product_id, provider_model_id,
    logical_model_tier
  ) values (
    target_attempt_id, 1, p_reservation_key, target_digest,
    p_facts->>'logical_operation_key', target_retry_index,
    p_facts->>'operational_execution_key', p_facts->>'ledger_execution_key',
    target_reserved_at, target_account_id, target_household_id,
    p_facts->>'household_attribution', p_facts->>'engine', p_facts->>'purpose',
    p_facts->>'app_version',
    case when p_facts->'engine_version' = 'null'::jsonb
      then null else p_facts->>'engine_version' end,
    case when p_facts->'curriculum_version' = 'null'::jsonb
      then null else p_facts->>'curriculum_version' end,
    p_facts->>'provider', p_facts->>'provider_product_id',
    p_facts->>'provider_model_id',
    case when p_facts->'logical_model_tier' = 'null'::jsonb
      then null else p_facts->>'logical_model_tier' end
  )
  on conflict do nothing
  returning * into inserted;

  if inserted.attempt_id is null then
    select attempt.* into existing
    from public.academy_provider_attempts as attempt
    where attempt.reservation_key = p_reservation_key
       or (
         attempt.logical_operation_key = p_facts->>'logical_operation_key'
         and attempt.physical_retry_index = target_retry_index
       )
       or attempt.operational_execution_key = p_facts->>'operational_execution_key'
       or attempt.ledger_execution_key = p_facts->>'ledger_execution_key'
    order by (attempt.reservation_key = p_reservation_key) desc, attempt.reserved_at
    limit 1;
    if existing.attempt_id is not null
       and existing.immutable_facts_digest = target_digest then
      select transition.to_state into existing_state
      from public.academy_provider_attempt_transitions as transition
      where transition.attempt_id = existing.attempt_id
      order by transition.sequence desc
      limit 1;
      return academy_private.provider_attempt_receipt(
        'replayed', existing.attempt_id, existing_state
      );
    end if;
    raise exception 'reconciliation_conflict' using errcode = '23505';
  end if;

  insert into public.academy_provider_attempt_transitions (
    transition_id, attempt_id, sequence, transition_key, from_state, to_state,
    transitioned_at, outcome_result, reason_code, reconciliation_ref, ledger_usage_id
  ) values (
    gen_random_uuid(), target_attempt_id, 1,
    'reserve:' || p_reservation_key, null, 'reserved', target_reserved_at,
    null, null, null, null
  );

  return academy_private.provider_attempt_receipt(
    'created', target_attempt_id, 'reserved'
  );
end;
$$;

create or replace function public.academy_transition_provider_attempt_v1(
  p_attempt_id uuid,
  p_transition_key text,
  p_to_state text,
  p_outcome_result text default null,
  p_reason_code text default null,
  p_reconciliation_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_transition public.academy_provider_attempt_transitions%rowtype;
  existing public.academy_provider_attempt_transitions%rowtype;
  inserted public.academy_provider_attempt_transitions%rowtype;
begin
  if not academy_private.provider_attempt_is_trusted_server()
     or auth.uid() is not null then
    raise exception 'PROVIDER_ATTEMPT_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_attempt_id is null
     or not academy_private.provider_attempt_reference_is_valid(p_transition_key)
     or p_to_state is null
     or p_to_state not in (
       'dispatch_possible', 'outcome_observed', 'gap_pending',
       'reconciliation_conflict', 'reconciled',
       'confirmed_not_dispatched', 'unresolvable'
     )
     or (p_outcome_result is not null and p_outcome_result not in (
       'success', 'fallback', 'rejected', 'timeout', 'provider_error',
       'validation_error', 'safety_stop'
     ))
     or (p_reason_code is not null and not
       academy_private.provider_attempt_token_is_valid(p_reason_code))
     or (p_reconciliation_ref is not null and not
       academy_private.provider_attempt_reference_is_valid(p_reconciliation_ref)) then
    raise exception 'PROVIDER_ATTEMPT_TRANSITION_INVALID' using errcode = '22023';
  end if;

  select transition.* into existing
  from public.academy_provider_attempt_transitions as transition
  where transition.transition_key = p_transition_key;
  if existing.transition_id is not null then
    if existing.attempt_id = p_attempt_id
       and existing.to_state = p_to_state
       and existing.outcome_result is not distinct from p_outcome_result
       and existing.reason_code is not distinct from p_reason_code
       and existing.reconciliation_ref is not distinct from p_reconciliation_ref then
      return academy_private.provider_attempt_receipt(
        'replayed', p_attempt_id, p_to_state
      );
    end if;
    raise exception 'reconciliation_conflict' using errcode = '23505';
  end if;

  perform 1 from public.academy_provider_attempts
  where attempt_id = p_attempt_id for update;
  if not found then
    raise exception 'PROVIDER_ATTEMPT_NOT_FOUND' using errcode = '22023';
  end if;
  select transition.* into current_transition
  from public.academy_provider_attempt_transitions as transition
  where transition.attempt_id = p_attempt_id
  order by transition.sequence desc
  limit 1;

  if not (
    (current_transition.to_state = 'reserved'
      and p_to_state in ('dispatch_possible', 'confirmed_not_dispatched'))
    or (current_transition.to_state = 'dispatch_possible'
      and p_to_state in ('outcome_observed', 'confirmed_not_dispatched'))
    or (current_transition.to_state = 'outcome_observed'
      and p_to_state in ('gap_pending', 'reconciliation_conflict'))
    or (current_transition.to_state = 'gap_pending'
      and p_to_state in ('reconciliation_conflict', 'reconciled', 'unresolvable'))
    or (current_transition.to_state = 'reconciliation_conflict'
      and p_to_state in ('reconciled', 'unresolvable'))
  ) then
    raise exception 'PROVIDER_ATTEMPT_STATE_TRANSITION_INVALID' using errcode = '22023';
  end if;

  if (p_to_state = 'outcome_observed') <> (p_outcome_result is not null)
     or (p_to_state <> 'outcome_observed' and p_outcome_result is not null)
     or (p_to_state in (
       'gap_pending', 'reconciliation_conflict', 'reconciled',
       'confirmed_not_dispatched', 'unresolvable'
     )) <> (p_reason_code is not null)
     or (p_to_state = 'reconciled') <> (p_reconciliation_ref is not null) then
    raise exception 'PROVIDER_ATTEMPT_TRANSITION_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  insert into public.academy_provider_attempt_transitions (
    transition_id, attempt_id, sequence, transition_key, from_state, to_state,
    transitioned_at, outcome_result, reason_code, reconciliation_ref, ledger_usage_id
  ) values (
    gen_random_uuid(), p_attempt_id, current_transition.sequence + 1,
    p_transition_key, current_transition.to_state, p_to_state, clock_timestamp(),
    p_outcome_result, p_reason_code, p_reconciliation_ref, null
  )
  on conflict (transition_key) do nothing
  returning * into inserted;

  if inserted.transition_id is null then
    select transition.* into existing
    from public.academy_provider_attempt_transitions as transition
    where transition.transition_key = p_transition_key;
    if existing.attempt_id = p_attempt_id
       and existing.to_state = p_to_state
       and existing.outcome_result is not distinct from p_outcome_result
       and existing.reason_code is not distinct from p_reason_code
       and existing.reconciliation_ref is not distinct from p_reconciliation_ref then
      return academy_private.provider_attempt_receipt(
        'replayed', p_attempt_id, p_to_state
      );
    end if;
    raise exception 'reconciliation_conflict' using errcode = '23505';
  end if;

  return academy_private.provider_attempt_receipt('created', p_attempt_id, p_to_state);
end;
$$;

create or replace function public.academy_link_provider_attempt_ledger_v1(
  p_attempt_id uuid,
  p_transition_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  attempt public.academy_provider_attempts%rowtype;
  current_transition public.academy_provider_attempt_transitions%rowtype;
  existing_transition public.academy_provider_attempt_transitions%rowtype;
  usage public.academy_provider_usage_ledger%rowtype;
  existing_link public.academy_provider_attempt_ledger_links%rowtype;
  inserted_transition public.academy_provider_attempt_transitions%rowtype;
  target_state text;
  target_reason text;
begin
  if not academy_private.provider_attempt_is_trusted_server()
     or auth.uid() is not null then
    raise exception 'PROVIDER_ATTEMPT_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_attempt_id is null
     or not academy_private.provider_attempt_reference_is_valid(p_transition_key) then
    raise exception 'PROVIDER_ATTEMPT_LEDGER_LINK_INVALID' using errcode = '22023';
  end if;

  select transition.* into existing_transition
  from public.academy_provider_attempt_transitions as transition
  where transition.transition_key = p_transition_key;
  if existing_transition.transition_id is not null then
    if existing_transition.attempt_id = p_attempt_id
       and existing_transition.to_state in (
         'ledgered', 'gap_pending', 'reconciliation_conflict'
       ) then
      return academy_private.provider_attempt_receipt(
        'replayed', p_attempt_id, existing_transition.to_state
      );
    end if;
    raise exception 'reconciliation_conflict' using errcode = '23505';
  end if;

  select * into attempt
  from public.academy_provider_attempts
  where attempt_id = p_attempt_id
  for update;
  if attempt.attempt_id is null then
    raise exception 'PROVIDER_ATTEMPT_NOT_FOUND' using errcode = '22023';
  end if;
  select transition.* into current_transition
  from public.academy_provider_attempt_transitions as transition
  where transition.attempt_id = p_attempt_id
  order by transition.sequence desc
  limit 1;

  select link.* into existing_link
  from public.academy_provider_attempt_ledger_links as link
  where link.attempt_id = p_attempt_id;
  if existing_link.attempt_id is not null then
    return academy_private.provider_attempt_receipt('replayed', p_attempt_id, 'ledgered');
  end if;
  if current_transition.to_state not in ('outcome_observed', 'gap_pending') then
    raise exception 'PROVIDER_ATTEMPT_STATE_TRANSITION_INVALID' using errcode = '22023';
  end if;

  select ledger.* into usage
  from public.academy_provider_usage_ledger as ledger
  where ledger.execution_key = attempt.ledger_execution_key
  for update;

  if usage.id is null then
    if current_transition.to_state = 'gap_pending' then
      return academy_private.provider_attempt_receipt(
        'replayed', p_attempt_id, 'gap_pending'
      );
    end if;
    target_state := 'gap_pending';
    target_reason := 'ledger_missing';
  elsif exists (
    select 1
    from public.academy_provider_attempt_ledger_links as link
    where link.usage_id = usage.id and link.attempt_id <> p_attempt_id
  ) then
    target_state := 'reconciliation_conflict';
    target_reason := 'ledger_already_linked';
  elsif usage.occurred_at < attempt.reserved_at
     or usage.account_id <> attempt.account_id
     or usage.household_id is distinct from attempt.household_id
     or usage.household_attribution <> attempt.household_attribution
     or usage.engine <> attempt.engine
     or usage.app_version <> attempt.app_version
     or usage.engine_version is distinct from attempt.engine_version
     or usage.curriculum_version is distinct from attempt.curriculum_version
     or usage.provider <> attempt.provider
     or usage.provider_product_id <> attempt.provider_product_id
     or usage.provider_model_id <> attempt.provider_model_id
     or usage.logical_model_tier is distinct from attempt.logical_model_tier then
    target_state := 'reconciliation_conflict';
    target_reason := 'ledger_dimension_mismatch';
  else
    target_state := 'ledgered';
    target_reason := null;
  end if;

  insert into public.academy_provider_attempt_transitions (
    transition_id, attempt_id, sequence, transition_key, from_state, to_state,
    transitioned_at, outcome_result, reason_code, reconciliation_ref, ledger_usage_id
  ) values (
    gen_random_uuid(), p_attempt_id, current_transition.sequence + 1,
    p_transition_key, current_transition.to_state, target_state, clock_timestamp(),
    null, target_reason, null, case when usage.id is null then null else usage.id end
  )
  returning * into inserted_transition;

  if target_state = 'ledgered' then
    insert into public.academy_provider_attempt_ledger_links (
      attempt_id, usage_id, link_transition_id, linked_at
    ) values (
      p_attempt_id, usage.id, inserted_transition.transition_id,
      inserted_transition.transitioned_at
    );
  end if;

  return academy_private.provider_attempt_receipt('created', p_attempt_id, target_state);
end;
$$;

create or replace function public.academy_read_provider_attempt_coverage_v1(
  p_start_at timestamptz,
  p_end_exclusive timestamptz,
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  recorded_count bigint;
  linked_count bigint;
  reserved_count bigint;
  dispatch_count bigint;
  outcome_count bigint;
  ledgered_count bigint;
  gap_count bigint;
  conflict_count bigint;
  reconciled_count bigint;
  not_dispatched_count bigint;
  unresolvable_count bigint;
  missing_relationship_count bigint;
  ledger_without_journal_count bigint;
  coverage_status text;
begin
  if not academy_private.provider_attempt_is_trusted_server()
     or auth.uid() is not null
     or p_required_capability <> 'costs:read' then
    raise exception 'PROVIDER_ATTEMPT_COVERAGE_ADMIN_READ_REQUIRED' using errcode = '42501';
  end if;
  if p_start_at is null or p_end_exclusive is null
     or p_end_exclusive <= p_start_at
     or p_end_exclusive - p_start_at > interval '366 days' then
    raise exception 'PROVIDER_ATTEMPT_COVERAGE_RANGE_INVALID' using errcode = '22023';
  end if;

  with current_attempts as (
    select attempt.attempt_id, transition.to_state
    from public.academy_provider_attempts as attempt
    cross join lateral (
      select history.to_state
      from public.academy_provider_attempt_transitions as history
      where history.attempt_id = attempt.attempt_id
      order by history.sequence desc
      limit 1
    ) as transition
    where attempt.reserved_at >= p_start_at
      and attempt.reserved_at < p_end_exclusive
  )
  select
    count(*),
    count(*) filter (where to_state = 'reserved'),
    count(*) filter (where to_state = 'dispatch_possible'),
    count(*) filter (where to_state = 'outcome_observed'),
    count(*) filter (where to_state = 'ledgered'),
    count(*) filter (where to_state = 'gap_pending'),
    count(*) filter (where to_state = 'reconciliation_conflict'),
    count(*) filter (where to_state = 'reconciled'),
    count(*) filter (where to_state = 'confirmed_not_dispatched'),
    count(*) filter (where to_state = 'unresolvable')
  into
    recorded_count, reserved_count, dispatch_count, outcome_count, ledgered_count,
    gap_count, conflict_count, reconciled_count, not_dispatched_count,
    unresolvable_count
  from current_attempts;

  select count(*) into linked_count
  from public.academy_provider_attempt_ledger_links as link
  join public.academy_provider_attempts as attempt
    on attempt.attempt_id = link.attempt_id
  where attempt.reserved_at >= p_start_at
    and attempt.reserved_at < p_end_exclusive;

  select count(*) into missing_relationship_count
  from public.academy_provider_attempts as attempt
  left join public.academy_provider_attempt_ledger_links as link
    on link.attempt_id = attempt.attempt_id
  cross join lateral (
    select history.to_state
    from public.academy_provider_attempt_transitions as history
    where history.attempt_id = attempt.attempt_id
    order by history.sequence desc
    limit 1
  ) as transition
  where attempt.reserved_at >= p_start_at
    and attempt.reserved_at < p_end_exclusive
    and link.attempt_id is null
    and transition.to_state in (
      'outcome_observed', 'gap_pending', 'reconciliation_conflict', 'unresolvable'
    );

  select count(*) into ledger_without_journal_count
  from public.academy_provider_usage_ledger as ledger
  left join public.academy_provider_attempt_ledger_links as link
    on link.usage_id = ledger.id
  where ledger.occurred_at >= p_start_at
    and ledger.occurred_at < p_end_exclusive
    and link.usage_id is null;

  coverage_status := case
    when gap_count + conflict_count + unresolvable_count
       + missing_relationship_count + ledger_without_journal_count > 0
      then 'attention_required'
    when reserved_count + dispatch_count + outcome_count > 0 then 'in_progress'
    when recorded_count = 0 then 'no_data'
    else 'covered'
  end;

  return jsonb_build_object(
    'schemaVersion', 1,
    'coverageStatus', coverage_status,
    'range', jsonb_build_object(
      'startAt', to_char(p_start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'endExclusive', to_char(p_end_exclusive at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'recordedProviderAttempts', recorded_count,
    'ledgerLinkedAttempts', linked_count,
    'journaledMissingLedgerRelationship', missing_relationship_count,
    'ledgerRowsWithoutJournalRelationship', ledger_without_journal_count,
    'states', jsonb_build_object(
      'reserved', reserved_count,
      'dispatchPossible', dispatch_count,
      'outcomeObserved', outcome_count,
      'ledgered', ledgered_count,
      'gapPending', gap_count,
      'reconciliationConflict', conflict_count,
      'reconciled', reconciled_count,
      'confirmedNotDispatched', not_dispatched_count,
      'unresolvable', unresolvable_count
    ),
    'costAuthority', 'academy_provider_usage_ledger',
    'invoiceCompletenessClaim', false
  );
end;
$$;

alter table public.academy_provider_attempts owner to postgres;
alter table public.academy_provider_attempt_transitions owner to postgres;
alter table public.academy_provider_attempt_ledger_links owner to postgres;
alter function public.academy_reserve_provider_attempt_v1(text, jsonb) owner to postgres;
alter function public.academy_transition_provider_attempt_v1(
  uuid, text, text, text, text, text
) owner to postgres;
alter function public.academy_link_provider_attempt_ledger_v1(uuid, text) owner to postgres;
alter function public.academy_read_provider_attempt_coverage_v1(
  timestamptz, timestamptz, text
) owner to postgres;

revoke all on table public.academy_provider_attempts
  from public, anon, authenticated, service_role;
revoke all on table public.academy_provider_attempt_transitions
  from public, anon, authenticated, service_role;
revoke all on table public.academy_provider_attempt_ledger_links
  from public, anon, authenticated, service_role;
revoke all on function public.academy_reserve_provider_attempt_v1(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_transition_provider_attempt_v1(
  uuid, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_link_provider_attempt_ledger_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_read_provider_attempt_coverage_v1(
  timestamptz, timestamptz, text
) from public, anon, authenticated, service_role;
grant execute on function public.academy_reserve_provider_attempt_v1(text, jsonb)
  to service_role;
grant execute on function public.academy_transition_provider_attempt_v1(
  uuid, text, text, text, text, text
) to service_role;
grant execute on function public.academy_link_provider_attempt_ledger_v1(uuid, text)
  to service_role;
grant execute on function public.academy_read_provider_attempt_coverage_v1(
  timestamptz, timestamptz, text
) to service_role;

revoke all on function academy_private.provider_attempt_json_has_exact_keys(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_reference_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_token_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_ledger_key_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_version_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_uuid_text_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_shape_is_valid(text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_is_trusted_server()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.prevent_provider_attempt_evidence_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_attempt_receipt(text, uuid, text)
  from public, anon, authenticated, service_role;

comment on table public.academy_provider_attempts is
  'Private authoritative reservation evidence: one row per physical provider attempt/retry.';
comment on table public.academy_provider_attempt_transitions is
  'Append-only Provider Attempt Journal lifecycle evidence; no learner/provider content.';
comment on table public.academy_provider_attempt_ledger_links is
  'One-to-one coverage relationship to the authoritative provider usage/cost ledger.';
comment on column public.academy_provider_attempts.purpose is
  'Provider-operation purpose; Study safety is study/safety_classification.';
comment on function public.academy_read_provider_attempt_coverage_v1(
  timestamptz, timestamptz, text
) is 'Coverage-only reconciliation summary; never a provider invoice total.';

commit;
