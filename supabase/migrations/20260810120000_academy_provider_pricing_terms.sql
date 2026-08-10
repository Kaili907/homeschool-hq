-- WINDOWS-ADMIN-5: verified private, effective-dated provider pricing terms.
-- This migration deliberately inserts no provider price or account term.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Provider pricing terms migration must run as postgres';
  end if;
  if to_regclass('public.academy_provider_usage_ledger') is null
     or to_regclass('public.academy_provider_usage_cost_components') is null
     or to_regprocedure('academy_private.append_admin_audit_event_v1(text,text,text,text,text,jsonb,jsonb,text,uuid)') is null
     or to_regprocedure('academy_private.cost_is_trusted_server()') is null then
    raise exception 'Provider pricing terms require the cost ledger, aggregate, and ADMIN-15 audit foundation';
  end if;
  if exists (select 1 from public.academy_provider_pricing_catalogs)
     or exists (select 1 from public.academy_provider_prices) then
    raise exception 'PROVIDER_PRICING_LEGACY_TERMS_REQUIRE_REVIEW' using errcode = '55000';
  end if;
end;
$$;

create table academy_private.provider_pricing_terms (
  term_id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('anthropic', 'elevenlabs')),
  provider_product_id text not null check (
    provider_product_id = btrim(provider_product_id)
    and length(provider_product_id) between 1 and 120
    and provider_product_id !~ '[[:cntrl:]]'
  ),
  provider_model_id text not null check (
    provider_model_id = btrim(provider_model_id)
    and length(provider_model_id) between 1 and 120
    and provider_model_id !~ '[[:cntrl:]]'
  ),
  logical_model_tier text check (
    logical_model_tier is null or logical_model_tier in ('sonnet', 'haiku')
  ),
  usage_unit text not null check (usage_unit in (
    'input_token', 'output_token', 'cached_input_read_token',
    'cached_input_write_token', 'tts_character', 'request'
  )),
  currency text not null default 'USD' check (currency = 'USD'),
  price_micros bigint not null check (price_micros between 0 and 1000000000),
  unit_quantity bigint not null check (unit_quantity between 1 and 1000000000),
  effective_from timestamptz not null,
  effective_until timestamptz,
  revision bigint not null check (revision > 0),
  status text not null default 'published' check (status in ('published', 'ended', 'disabled')),
  supersedes_term_id uuid references academy_private.provider_pricing_terms (term_id)
    on delete restrict,
  verification_ref text not null check (
    length(verification_ref) between 1 and 128
    and verification_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    and position('://' in verification_ref) = 0
    and verification_ref !~* '(^|[._:/-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:/-]|$)'
  ),
  created_at timestamptz not null default statement_timestamp(),
  created_by_user_ref uuid not null references auth.users (id) on delete restrict,
  created_by_role text not null check (created_by_role = 'owner'),
  created_by_assignment_ref uuid not null
    references public.academy_admin_role_assignments (id) on delete restrict,
  created_reason_code text not null,
  created_request_id uuid not null,
  ended_at timestamptz,
  ended_by_user_ref uuid references auth.users (id) on delete restrict,
  ended_by_role text check (ended_by_role is null or ended_by_role = 'owner'),
  ended_by_assignment_ref uuid
    references public.academy_admin_role_assignments (id) on delete restrict,
  ended_reason_code text,
  ended_request_id uuid,
  constraint provider_pricing_terms_period_check check (
    effective_until is null or effective_until > effective_from
  ),
  constraint provider_pricing_terms_provider_shape_check check (
    (
      provider = 'anthropic'
      and logical_model_tier in ('sonnet', 'haiku')
      and usage_unit in (
        'input_token', 'output_token', 'cached_input_read_token', 'request'
      )
    )
    or
    (
      provider = 'elevenlabs'
      and logical_model_tier is null
      and usage_unit in ('tts_character', 'request')
    )
  ),
  constraint provider_pricing_terms_lifecycle_check check (
    (
      status = 'published'
      and ended_at is null
      and ended_by_user_ref is null
      and ended_by_role is null
      and ended_by_assignment_ref is null
      and ended_reason_code is null
      and ended_request_id is null
    )
    or
    (
      status in ('ended', 'disabled')
      and ended_at is not null
      and ended_by_user_ref is not null
      and ended_by_role = 'owner'
      and ended_by_assignment_ref is not null
      and ended_reason_code is not null
      and ended_request_id is not null
      and (status <> 'ended' or effective_until is not null)
    )
  )
);

alter table academy_private.provider_pricing_terms owner to postgres;

create unique index provider_pricing_terms_dimension_revision_idx
  on academy_private.provider_pricing_terms (
    provider, provider_product_id, provider_model_id,
    coalesce(logical_model_tier, ''), usage_unit, currency, revision
  );
create index provider_pricing_terms_effective_lookup_idx
  on academy_private.provider_pricing_terms (
    provider, provider_product_id, provider_model_id,
    logical_model_tier, usage_unit, effective_from, effective_until
  ) where status in ('published', 'ended');

create table academy_private.provider_pricing_confirmations (
  confirmation_id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{32}$'),
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  actor_assignment_ref uuid not null
    references public.academy_admin_role_assignments (id) on delete restrict,
  expected_revision bigint not null check (expected_revision >= 0),
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint provider_pricing_confirmations_lifetime_check check (
    expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'
  ),
  constraint provider_pricing_confirmations_consumed_check check (
    consumed_at is null or consumed_at >= issued_at
  )
);

create table academy_private.provider_pricing_mutation_receipts (
  actor_user_ref uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  operation text not null check (operation in ('commit', 'end', 'disable')),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{32}$'),
  result_projection jsonb,
  audit_event_id uuid references academy_private.admin_audit_events (event_id)
    on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  primary key (actor_user_ref, request_id),
  constraint provider_pricing_mutation_receipts_result_check check (
    (
      status = 'pending'
      and result_projection is null
      and audit_event_id is null
      and completed_at is null
    )
    or
    (
      status = 'completed'
      and result_projection is not null
      and audit_event_id is not null
      and completed_at is not null
    )
  )
);

alter table academy_private.provider_pricing_confirmations owner to postgres;
alter table academy_private.provider_pricing_mutation_receipts owner to postgres;

alter table academy_private.provider_pricing_terms enable row level security;
alter table academy_private.provider_pricing_terms force row level security;
alter table academy_private.provider_pricing_confirmations enable row level security;
alter table academy_private.provider_pricing_confirmations force row level security;
alter table academy_private.provider_pricing_mutation_receipts enable row level security;
alter table academy_private.provider_pricing_mutation_receipts force row level security;

create function academy_private.provider_pricing_dimension_is_supported(
  p_provider text,
  p_logical_model_tier text,
  p_usage_unit text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case
    when p_provider = 'anthropic' then
      p_logical_model_tier in ('sonnet', 'haiku')
      and p_usage_unit in (
        'input_token', 'output_token', 'cached_input_read_token', 'request'
      )
    when p_provider = 'elevenlabs' then
      p_logical_model_tier is null
      and p_usage_unit in ('tts_character', 'request')
    else false
  end;
$$;

create function academy_private.provider_pricing_reason_is_allowed(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select candidate = any (array[
    'operator.request', 'scheduled.change', 'corrective.action',
    'configuration.changed'
  ]::text[]);
$$;

create function academy_private.provider_pricing_actor_v1()
returns table (actor_user uuid, actor_assignment uuid, actor_role text)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select assignment.user_id, assignment.id, assignment.role
  from public.academy_admin_role_assignments as assignment
  where auth.uid() is not null
    and assignment.user_id = auth.uid()
    and assignment.role = 'owner'
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1;
$$;

create function academy_private.provider_pricing_validate_term_v1(
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_usage_unit text,
  p_price_micros text,
  p_unit_quantity text,
  p_effective_from timestamptz,
  p_effective_until timestamptz,
  p_verification_ref text,
  p_reason_code text
)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
begin
  if p_provider not in ('anthropic', 'elevenlabs')
     or p_provider_product_id is null
     or p_provider_product_id <> btrim(p_provider_product_id)
     or length(p_provider_product_id) not between 1 and 120
     or p_provider_product_id ~ '[[:cntrl:]]'
     or p_provider_model_id is null
     or p_provider_model_id <> btrim(p_provider_model_id)
     or length(p_provider_model_id) not between 1 and 120
     or p_provider_model_id ~ '[[:cntrl:]]'
     or p_usage_unit not in (
       'input_token', 'output_token', 'cached_input_read_token',
       'cached_input_write_token', 'tts_character', 'request'
     )
     or p_price_micros is null
     or p_price_micros !~ '^(0|[1-9][0-9]{0,18})$'
     or length(p_price_micros) > 19
     or p_price_micros::numeric > 1000000000
     or p_unit_quantity is null
     or p_unit_quantity !~ '^[1-9][0-9]{0,18}$'
     or length(p_unit_quantity) > 19
     or p_unit_quantity::numeric > 1000000000
     or p_effective_from is null
     or (p_effective_until is not null and p_effective_until <= p_effective_from)
     or p_verification_ref is null
     or length(p_verification_ref) not between 1 and 128
     or p_verification_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
     or position('://' in p_verification_ref) > 0
     or p_verification_ref ~* '(^|[._:/-])(sk|pk|secret|credential|bearer|token|password|jwt|api.?key)([._:/-]|$)'
     or not academy_private.provider_pricing_reason_is_allowed(p_reason_code) then
    raise exception 'PROVIDER_PRICING_REQUEST_INVALID' using errcode = '22023';
  end if;
  if not academy_private.provider_pricing_dimension_is_supported(
    p_provider, p_logical_model_tier, p_usage_unit
  ) then
    raise exception 'PROVIDER_PRICING_DIMENSION_UNSUPPORTED' using errcode = '0A000';
  end if;
end;
$$;

create function academy_private.provider_pricing_payload_digest_v1(
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_usage_unit text,
  p_price_micros text,
  p_unit_quantity text,
  p_effective_from timestamptz,
  p_effective_until timestamptz,
  p_replaces_term_id uuid,
  p_verification_ref text,
  p_reason_code text,
  p_expected_revision bigint
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select md5(jsonb_build_object(
    'provider', p_provider,
    'providerProductId', p_provider_product_id,
    'providerModelId', p_provider_model_id,
    'logicalModelTier', p_logical_model_tier,
    'usageUnit', p_usage_unit,
    'priceMicros', p_price_micros,
    'unitQuantity', p_unit_quantity,
    'effectiveFrom', p_effective_from,
    'effectiveUntil', p_effective_until,
    'replacesTermId', p_replaces_term_id,
    'verificationRef', p_verification_ref,
    'reasonCode', p_reason_code,
    'expectedRevision', p_expected_revision
  )::text);
$$;

create function academy_private.provider_pricing_reject_term_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Provider pricing terms cannot be deleted' using errcode = '55000';
  end if;
  if old.status <> 'published'
     or new.status not in ('ended', 'disabled')
     or new.term_id is distinct from old.term_id
     or new.provider is distinct from old.provider
     or new.provider_product_id is distinct from old.provider_product_id
     or new.provider_model_id is distinct from old.provider_model_id
     or new.logical_model_tier is distinct from old.logical_model_tier
     or new.usage_unit is distinct from old.usage_unit
     or new.currency is distinct from old.currency
     or new.price_micros is distinct from old.price_micros
     or new.unit_quantity is distinct from old.unit_quantity
     or new.effective_from is distinct from old.effective_from
     or new.revision is distinct from old.revision
     or new.supersedes_term_id is distinct from old.supersedes_term_id
     or new.verification_ref is distinct from old.verification_ref
     or new.created_at is distinct from old.created_at
     or new.created_by_user_ref is distinct from old.created_by_user_ref
     or new.created_by_role is distinct from old.created_by_role
     or new.created_by_assignment_ref is distinct from old.created_by_assignment_ref
     or new.created_reason_code is distinct from old.created_reason_code
     or new.created_request_id is distinct from old.created_request_id
     or new.ended_at is null
     or new.ended_by_user_ref is null
     or new.ended_by_role <> 'owner'
     or new.ended_by_assignment_ref is null
     or new.ended_reason_code is null
     or new.ended_request_id is null
     or (new.status = 'disabled' and new.effective_until is distinct from old.effective_until)
     or (new.status = 'ended' and (
       new.effective_until is null
       or new.effective_until <= new.effective_from
       or (old.effective_until is not null and new.effective_until > old.effective_until)
     )) then
    raise exception 'Provider pricing terms permit only a safe end or future disable transition'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create function academy_private.provider_pricing_reject_overlap()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  lock table academy_private.provider_pricing_terms in share row exclusive mode;
  if exists (
    select 1
    from academy_private.provider_pricing_terms as existing
    where existing.term_id <> new.term_id
      and existing.status in ('published', 'ended')
      and existing.provider = new.provider
      and existing.provider_product_id = new.provider_product_id
      and existing.provider_model_id = new.provider_model_id
      and existing.logical_model_tier is not distinct from new.logical_model_tier
      and existing.usage_unit = new.usage_unit
      and existing.currency = new.currency
      and existing.effective_from < coalesce(new.effective_until, 'infinity'::timestamptz)
      and new.effective_from < coalesce(existing.effective_until, 'infinity'::timestamptz)
  ) then
    raise exception 'PROVIDER_PRICING_OVERLAP' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger provider_pricing_terms_guard_history
  before update or delete on academy_private.provider_pricing_terms
  for each row execute function academy_private.provider_pricing_reject_term_mutation();
create trigger provider_pricing_terms_no_overlap
  before insert on academy_private.provider_pricing_terms
  for each row execute function academy_private.provider_pricing_reject_overlap();

alter table public.academy_provider_usage_cost_components
  alter column rate_id drop not null,
  alter column pricing_catalog_version drop not null,
  add column pricing_term_id uuid
    references academy_private.provider_pricing_terms (term_id) on delete restrict,
  add column pricing_term_revision bigint check (pricing_term_revision > 0),
  add constraint provider_usage_component_pricing_authority_check check (
    (
      rate_id is not null
      and pricing_catalog_version is not null
      and pricing_term_id is null
      and pricing_term_revision is null
    )
    or
    (
      rate_id is null
      and pricing_catalog_version is null
      and pricing_term_id is not null
      and pricing_term_revision is not null
    )
  );

alter table public.academy_provider_usage_ledger
  add column pricing_authority text check (
    pricing_authority is null or pricing_authority = 'provider_pricing_terms_v1'
  );

revoke insert on table public.academy_provider_pricing_catalogs from service_role;
revoke insert on table public.academy_provider_prices from service_role;

create function academy_private.apply_provider_pricing_terms_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  component record;
  matching_count bigint;
  selected_term academy_private.provider_pricing_terms%rowtype;
  component_cost numeric;
  total_cost numeric := 0;
  has_component boolean := false;
begin
  if new.billing_disposition <> 'billable'
     or (new.provider = 'anthropic' and new.input_tokens is null) then
    return new;
  end if;

  -- The runtime does not preserve trusted Anthropic cache-write TTL splits.
  -- A positive cache-write quantity therefore remains unavailable rather than
  -- being assigned a generic or guessed rate.
  if new.provider = 'anthropic' and coalesce(new.cached_input_write_tokens, 0) > 0 then
    return new;
  end if;

  for component in
    select * from (values
      ('input_token'::text, new.input_tokens, false),
      ('output_token'::text, new.output_tokens, false),
      ('cached_input_read_token'::text, new.cached_input_read_tokens, false),
      ('tts_character'::text, new.tts_characters, false),
      ('request'::text, new.request_count::bigint, true)
    ) as quantities(usage_unit, quantity, optional_term)
    where quantity is not null and quantity > 0
  loop
    selected_term := null;
    select count(*) into matching_count
    from academy_private.provider_pricing_terms as term
    where term.status in ('published', 'ended')
      and term.provider = new.provider
      and term.provider_product_id = new.provider_product_id
      and term.provider_model_id = new.provider_model_id
      and term.logical_model_tier is not distinct from new.logical_model_tier
      and term.usage_unit = component.usage_unit
      and term.currency = new.currency
      and term.effective_from <= new.occurred_at
      and (term.effective_until is null or new.occurred_at < term.effective_until);

    if component.optional_term and matching_count = 0 then
      continue;
    end if;
    if matching_count <> 1 then
      delete from public.academy_provider_usage_cost_components
      where usage_id = new.id and pricing_term_id is not null;
      return new;
    end if;

    select * into selected_term
    from academy_private.provider_pricing_terms as term
    where term.status in ('published', 'ended')
      and term.provider = new.provider
      and term.provider_product_id = new.provider_product_id
      and term.provider_model_id = new.provider_model_id
      and term.logical_model_tier is not distinct from new.logical_model_tier
      and term.usage_unit = component.usage_unit
      and term.currency = new.currency
      and term.effective_from <= new.occurred_at
      and (term.effective_until is null or new.occurred_at < term.effective_until);

    component_cost := floor(
      (
        component.quantity::numeric * selected_term.price_micros::numeric
        + selected_term.unit_quantity::numeric / 2
      ) / selected_term.unit_quantity::numeric
    );
    if component_cost > 9223372036854775807 then
      raise exception 'calculated provider cost exceeds bigint bounds' using errcode = '22003';
    end if;

    insert into public.academy_provider_usage_cost_components (
      usage_id, billing_unit, quantity, rate_id, pricing_catalog_version,
      provider, provider_product_id, provider_model_id, logical_model_tier,
      currency, effective_from, effective_to, price_micros, unit_quantity,
      calculated_cost_micros, pricing_term_id, pricing_term_revision
    ) values (
      new.id, component.usage_unit, component.quantity, null, null,
      selected_term.provider, selected_term.provider_product_id,
      selected_term.provider_model_id, selected_term.logical_model_tier,
      selected_term.currency, selected_term.effective_from,
      selected_term.effective_until, selected_term.price_micros,
      selected_term.unit_quantity, component_cost::bigint,
      selected_term.term_id, selected_term.revision
    );
    total_cost := total_cost + component_cost;
    has_component := true;
  end loop;

  if has_component then
    if total_cost > 9223372036854775807 then
      raise exception 'calculated provider cost exceeds bigint bounds' using errcode = '22003';
    end if;
    update public.academy_provider_usage_ledger
    set cost_kind = 'calculated',
        cost_micros = total_cost::bigint,
        pricing_catalog_version = null,
        pricing_authority = 'provider_pricing_terms_v1'
    where id = new.id;
  end if;
  return new;
end;
$$;

create function academy_private.preserve_provider_pricing_term_cost_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.pricing_authority = 'provider_pricing_terms_v1' then
    new.cost_kind := old.cost_kind;
    new.cost_micros := old.cost_micros;
    new.pricing_catalog_version := old.pricing_catalog_version;
    new.pricing_authority := old.pricing_authority;
  end if;
  return new;
end;
$$;

create trigger provider_usage_apply_pricing_terms
  after insert on public.academy_provider_usage_ledger
  for each row execute function academy_private.apply_provider_pricing_terms_v1();
create trigger provider_usage_preserve_pricing_term_cost
  before update of cost_kind, cost_micros, pricing_catalog_version, pricing_authority
  on public.academy_provider_usage_ledger
  for each row execute function academy_private.preserve_provider_pricing_term_cost_v1();

create function academy_private.lookup_provider_pricing_term_v1(
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_usage_unit text,
  p_effective_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  matching_count bigint;
  selected academy_private.provider_pricing_terms%rowtype;
begin
  if p_effective_at is null
     or not academy_private.provider_pricing_dimension_is_supported(
       p_provider, p_logical_model_tier, p_usage_unit
     ) then
    return jsonb_build_object('status', 'unsupported_dimension');
  end if;
  select count(*) into matching_count
  from academy_private.provider_pricing_terms as term
  where term.status in ('published', 'ended')
    and term.provider = p_provider
    and term.provider_product_id = p_provider_product_id
    and term.provider_model_id = p_provider_model_id
    and term.logical_model_tier is not distinct from p_logical_model_tier
    and term.usage_unit = p_usage_unit
    and term.currency = 'USD'
    and term.effective_from <= p_effective_at
    and (term.effective_until is null or p_effective_at < term.effective_until);
  if matching_count = 0 then
    return jsonb_build_object('status', 'pricing_unconfigured');
  end if;
  if matching_count <> 1 then
    return jsonb_build_object('status', 'pricing_ambiguous');
  end if;
  select * into selected
  from academy_private.provider_pricing_terms as term
  where term.status in ('published', 'ended')
    and term.provider = p_provider
    and term.provider_product_id = p_provider_product_id
    and term.provider_model_id = p_provider_model_id
    and term.logical_model_tier is not distinct from p_logical_model_tier
    and term.usage_unit = p_usage_unit
    and term.currency = 'USD'
    and term.effective_from <= p_effective_at
    and (term.effective_until is null or p_effective_at < term.effective_until);
  return jsonb_build_object(
    'status', 'configured',
    'termId', selected.term_id,
    'revision', selected.revision::text,
    'priceMicrosPerUnitSize', selected.price_micros::text,
    'unitSize', selected.unit_quantity::text,
    'currency', selected.currency,
    'effectiveFrom', selected.effective_from,
    'effectiveUntil', selected.effective_until
  );
end;
$$;

create function public.academy_admin_read_provider_pricing_terms_v1(
  p_required_capability text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  term_count bigint;
  projection jsonb;
begin
  if auth.uid() is not null
     or not academy_private.cost_is_trusted_server()
     or p_required_capability <> 'costs:read' then
    raise exception 'PROVIDER_PRICING_READ_REQUIRED' using errcode = '42501';
  end if;
  select count(*) into term_count from academy_private.provider_pricing_terms;
  if term_count > 500 then
    raise exception 'PROVIDER_PRICING_READ_LIMIT' using errcode = '54000';
  end if;
  select jsonb_build_object(
    'schemaVersion', 1,
    'pricingStatus', case when term_count = 0 then 'pricing_unconfigured' else 'configured' end,
    'currency', 'USD',
    'terms', coalesce(jsonb_agg(jsonb_build_object(
      'termId', term.term_id,
      'provider', term.provider,
      'providerProductId', term.provider_product_id,
      'providerModelId', term.provider_model_id,
      'logicalModelTier', term.logical_model_tier,
      'usageUnit', term.usage_unit,
      'priceMicrosPerUnitSize', term.price_micros::text,
      'unitSize', term.unit_quantity::text,
      'currency', term.currency,
      'effectiveFrom', term.effective_from,
      'effectiveUntil', term.effective_until,
      'revision', term.revision::text,
      'status', term.status,
      'supersedesTermId', term.supersedes_term_id,
      'verificationRef', term.verification_ref,
      'createdAt', term.created_at,
      'createdAuthority', jsonb_build_object('role', term.created_by_role)
    ) order by term.provider, term.provider_product_id, term.provider_model_id,
       term.logical_model_tier nulls first, term.usage_unit, term.effective_from,
       term.revision), '[]'::jsonb)
  ) into projection
  from academy_private.provider_pricing_terms as term;
  return projection;
end;
$$;

create function public.academy_admin_preview_provider_pricing_term_v1(
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_usage_unit text,
  p_price_micros text,
  p_unit_quantity text,
  p_effective_from timestamptz,
  p_effective_until timestamptz,
  p_replaces_term_id uuid,
  p_verification_ref text,
  p_reason_code text,
  p_confirmation_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  replacement academy_private.provider_pricing_terms%rowtype;
  current_revision bigint;
  confirmation uuid := gen_random_uuid();
  issued timestamptz := statement_timestamp();
  expires timestamptz := statement_timestamp() + interval '5 minutes';
  payload_digest text;
begin
  select * into actor from academy_private.provider_pricing_actor_v1();
  if actor.actor_user is null or p_required_capability <> 'configuration:manage' then
    raise exception 'PROVIDER_PRICING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.provider_pricing_validate_term_v1(
    p_provider, p_provider_product_id, p_provider_model_id,
    p_logical_model_tier, p_usage_unit, p_price_micros, p_unit_quantity,
    p_effective_from, p_effective_until, p_verification_ref, p_reason_code
  );
  if p_confirmation_digest is null or p_confirmation_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'PROVIDER_PRICING_REQUEST_INVALID' using errcode = '22023';
  end if;

  if p_replaces_term_id is not null then
    select * into replacement from academy_private.provider_pricing_terms
    where term_id = p_replaces_term_id;
    if not found
       or replacement.status <> 'published'
       or replacement.provider <> p_provider
       or replacement.provider_product_id <> p_provider_product_id
       or replacement.provider_model_id <> p_provider_model_id
       or replacement.logical_model_tier is distinct from p_logical_model_tier
       or replacement.usage_unit <> p_usage_unit
       or replacement.currency <> 'USD'
       or p_effective_from <= statement_timestamp()
       or p_effective_from <= replacement.effective_from
       or (
         replacement.effective_until is not null
         and p_effective_from >= replacement.effective_until
       ) then
      raise exception 'PROVIDER_PRICING_REPLACEMENT_INVALID' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from academy_private.provider_pricing_terms as existing
    where existing.term_id is distinct from p_replaces_term_id
      and existing.status in ('published', 'ended')
      and existing.provider = p_provider
      and existing.provider_product_id = p_provider_product_id
      and existing.provider_model_id = p_provider_model_id
      and existing.logical_model_tier is not distinct from p_logical_model_tier
      and existing.usage_unit = p_usage_unit
      and existing.currency = 'USD'
      and existing.effective_from < coalesce(p_effective_until, 'infinity'::timestamptz)
      and p_effective_from < coalesce(existing.effective_until, 'infinity'::timestamptz)
  ) then
    raise exception 'PROVIDER_PRICING_OVERLAP' using errcode = '23514';
  end if;

  select coalesce(max(term.revision), 0) into current_revision
  from academy_private.provider_pricing_terms as term
  where term.provider = p_provider
    and term.provider_product_id = p_provider_product_id
    and term.provider_model_id = p_provider_model_id
    and term.logical_model_tier is not distinct from p_logical_model_tier
    and term.usage_unit = p_usage_unit
    and term.currency = 'USD';
  payload_digest := academy_private.provider_pricing_payload_digest_v1(
    p_provider, p_provider_product_id, p_provider_model_id,
    p_logical_model_tier, p_usage_unit, p_price_micros, p_unit_quantity,
    p_effective_from, p_effective_until, p_replaces_term_id,
    p_verification_ref, p_reason_code, current_revision
  );
  insert into academy_private.provider_pricing_confirmations (
    confirmation_id, token_digest, payload_digest, actor_user_ref,
    actor_assignment_ref, expected_revision, issued_at, expires_at
  ) values (
    confirmation, p_confirmation_digest, payload_digest, actor.actor_user,
    actor.actor_assignment, current_revision, issued, expires
  );
  return jsonb_build_object(
    'schemaVersion', 1,
    'operation', case when p_replaces_term_id is null then 'create' else 'replace' end,
    'expectedRevision', current_revision::text,
    'newRevision', (current_revision + 1)::text,
    'term', jsonb_build_object(
      'provider', p_provider,
      'providerProductId', p_provider_product_id,
      'providerModelId', p_provider_model_id,
      'logicalModelTier', p_logical_model_tier,
      'usageUnit', p_usage_unit,
      'priceMicrosPerUnitSize', p_price_micros,
      'unitSize', p_unit_quantity,
      'currency', 'USD',
      'effectiveFrom', p_effective_from,
      'effectiveUntil', p_effective_until,
      'replacesTermId', p_replaces_term_id
    ),
    'confirmationId', confirmation,
    'confirmationExpiresAt', expires
  );
end;
$$;

create function public.academy_admin_commit_provider_pricing_term_v1(
  p_provider text,
  p_provider_product_id text,
  p_provider_model_id text,
  p_logical_model_tier text,
  p_usage_unit text,
  p_price_micros text,
  p_unit_quantity text,
  p_effective_from timestamptz,
  p_effective_until timestamptz,
  p_replaces_term_id uuid,
  p_verification_ref text,
  p_reason_code text,
  p_expected_revision text,
  p_request_id uuid,
  p_confirmation_digest text,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  replacement academy_private.provider_pricing_terms%rowtype;
  confirmation academy_private.provider_pricing_confirmations%rowtype;
  receipt academy_private.provider_pricing_mutation_receipts%rowtype;
  expected_revision bigint;
  current_revision bigint;
  new_revision bigint;
  new_term_id uuid := gen_random_uuid();
  payload_digest text;
  audit_event uuid;
  result jsonb;
  previous_audit_value jsonb;
begin
  select * into actor from academy_private.provider_pricing_actor_v1();
  if actor.actor_user is null or p_required_capability <> 'configuration:manage' then
    raise exception 'PROVIDER_PRICING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  perform academy_private.provider_pricing_validate_term_v1(
    p_provider, p_provider_product_id, p_provider_model_id,
    p_logical_model_tier, p_usage_unit, p_price_micros, p_unit_quantity,
    p_effective_from, p_effective_until, p_verification_ref, p_reason_code
  );
  if p_expected_revision is null
     or p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$'
     or length(p_expected_revision) > 19
     or p_expected_revision::numeric > 9223372036854775807
     or p_request_id is null
     or p_confirmation_digest is null
     or p_confirmation_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'PROVIDER_PRICING_REQUEST_INVALID' using errcode = '22023';
  end if;
  expected_revision := p_expected_revision::bigint;
  payload_digest := academy_private.provider_pricing_payload_digest_v1(
    p_provider, p_provider_product_id, p_provider_model_id,
    p_logical_model_tier, p_usage_unit, p_price_micros, p_unit_quantity,
    p_effective_from, p_effective_until, p_replaces_term_id,
    p_verification_ref, p_reason_code, expected_revision
  );

  insert into academy_private.provider_pricing_mutation_receipts (
    actor_user_ref, request_id, operation, payload_digest
  ) values (actor.actor_user, p_request_id, 'commit', payload_digest)
  on conflict (actor_user_ref, request_id) do nothing;
  if not found then
    select * into receipt from academy_private.provider_pricing_mutation_receipts
    where actor_user_ref = actor.actor_user and request_id = p_request_id;
    if receipt.operation <> 'commit' or receipt.payload_digest <> payload_digest then
      raise exception 'PROVIDER_PRICING_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if receipt.status <> 'completed' then
      raise exception 'PROVIDER_PRICING_REQUEST_IN_PROGRESS' using errcode = '40001';
    end if;
    return jsonb_set(receipt.result_projection, '{idempotencyResult}', '"replayed"'::jsonb);
  end if;

  select * into confirmation
  from academy_private.provider_pricing_confirmations
  where token_digest = p_confirmation_digest
    and actor_user_ref = actor.actor_user
  for update;
  if not found then
    raise exception 'PROVIDER_PRICING_CONFIRMATION_INVALID' using errcode = '22023';
  end if;
  if confirmation.consumed_at is not null then
    raise exception 'PROVIDER_PRICING_CONFIRMATION_REUSED' using errcode = '40001';
  end if;
  if confirmation.expires_at <= statement_timestamp() then
    raise exception 'PROVIDER_PRICING_CONFIRMATION_EXPIRED' using errcode = '40001';
  end if;
  if confirmation.payload_digest <> payload_digest
     or confirmation.expected_revision <> expected_revision
     or confirmation.actor_assignment_ref <> actor.actor_assignment then
    raise exception 'PROVIDER_PRICING_CONFIRMATION_MISMATCH' using errcode = '22023';
  end if;

  lock table academy_private.provider_pricing_terms in share row exclusive mode;
  select coalesce(max(term.revision), 0) into current_revision
  from academy_private.provider_pricing_terms as term
  where term.provider = p_provider
    and term.provider_product_id = p_provider_product_id
    and term.provider_model_id = p_provider_model_id
    and term.logical_model_tier is not distinct from p_logical_model_tier
    and term.usage_unit = p_usage_unit
    and term.currency = 'USD';
  if current_revision <> expected_revision then
    raise exception 'PROVIDER_PRICING_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if p_replaces_term_id is not null then
    select * into replacement from academy_private.provider_pricing_terms
    where term_id = p_replaces_term_id for update;
    if not found
       or replacement.status <> 'published'
       or replacement.provider <> p_provider
       or replacement.provider_product_id <> p_provider_product_id
       or replacement.provider_model_id <> p_provider_model_id
       or replacement.logical_model_tier is distinct from p_logical_model_tier
       or replacement.usage_unit <> p_usage_unit
       or replacement.currency <> 'USD'
       or p_effective_from <= statement_timestamp()
       or p_effective_from <= replacement.effective_from
       or (
         replacement.effective_until is not null
         and p_effective_from >= replacement.effective_until
       ) then
      raise exception 'PROVIDER_PRICING_REPLACEMENT_INVALID' using errcode = '22023';
    end if;
    previous_audit_value := jsonb_build_object(
      'status', replacement.status,
      'revision', replacement.revision::text,
      'value', replacement.price_micros::text
    );
    update academy_private.provider_pricing_terms
    set status = 'ended', effective_until = p_effective_from,
        ended_at = statement_timestamp(), ended_by_user_ref = actor.actor_user,
        ended_by_role = actor.actor_role,
        ended_by_assignment_ref = actor.actor_assignment,
        ended_reason_code = p_reason_code, ended_request_id = p_request_id
    where term_id = replacement.term_id;
  end if;

  if exists (
    select 1 from academy_private.provider_pricing_terms as existing
    where existing.status in ('published', 'ended')
      and existing.provider = p_provider
      and existing.provider_product_id = p_provider_product_id
      and existing.provider_model_id = p_provider_model_id
      and existing.logical_model_tier is not distinct from p_logical_model_tier
      and existing.usage_unit = p_usage_unit
      and existing.currency = 'USD'
      and existing.effective_from < coalesce(p_effective_until, 'infinity'::timestamptz)
      and p_effective_from < coalesce(existing.effective_until, 'infinity'::timestamptz)
  ) then
    raise exception 'PROVIDER_PRICING_OVERLAP' using errcode = '23514';
  end if;

  new_revision := current_revision + 1;
  update academy_private.provider_pricing_confirmations
  set consumed_at = statement_timestamp()
  where confirmation_id = confirmation.confirmation_id;
  insert into academy_private.provider_pricing_terms (
    term_id, provider, provider_product_id, provider_model_id,
    logical_model_tier, usage_unit, currency, price_micros, unit_quantity,
    effective_from, effective_until, revision, status, supersedes_term_id,
    verification_ref, created_by_user_ref, created_by_role,
    created_by_assignment_ref, created_reason_code, created_request_id
  ) values (
    new_term_id, p_provider, p_provider_product_id, p_provider_model_id,
    p_logical_model_tier, p_usage_unit, 'USD', p_price_micros::bigint,
    p_unit_quantity::bigint, p_effective_from, p_effective_until,
    new_revision, 'published', p_replaces_term_id, p_verification_ref,
    actor.actor_user, actor.actor_role, actor.actor_assignment,
    p_reason_code, p_request_id
  );

  audit_event := academy_private.append_admin_audit_event_v1(
    'configuration.update', 'configuration',
    'provider_pricing/' || new_term_id::text,
    'provider-pricing-v1', new_revision::text,
    previous_audit_value,
    jsonb_build_object(
      'status', 'published',
      'revision', new_revision::text,
      'value', p_price_micros,
      'model_tier', p_logical_model_tier
    ),
    p_reason_code, p_request_id
  );
  result := jsonb_build_object(
    'schemaVersion', 1,
    'termId', new_term_id,
    'revision', new_revision::text,
    'status', 'published',
    'effectiveFrom', p_effective_from,
    'effectiveUntil', p_effective_until,
    'supersedesTermId', p_replaces_term_id,
    'idempotencyResult', 'created'
  );
  update academy_private.provider_pricing_mutation_receipts
  set status = 'completed', result_projection = result,
      audit_event_id = audit_event, completed_at = statement_timestamp()
  where actor_user_ref = actor.actor_user and request_id = p_request_id;
  return result;
end;
$$;

create function public.academy_admin_end_provider_pricing_term_v1(
  p_term_id uuid,
  p_expected_revision text,
  p_mode text,
  p_effective_until timestamptz,
  p_reason_code text,
  p_request_id uuid,
  p_required_capability text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor record;
  term academy_private.provider_pricing_terms%rowtype;
  receipt academy_private.provider_pricing_mutation_receipts%rowtype;
  expected_revision bigint;
  payload_digest text;
  audit_event uuid;
  result jsonb;
  next_status text;
begin
  select * into actor from academy_private.provider_pricing_actor_v1();
  if actor.actor_user is null or p_required_capability <> 'configuration:manage' then
    raise exception 'PROVIDER_PRICING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if p_term_id is null
     or p_expected_revision is null
     or p_expected_revision !~ '^[1-9][0-9]{0,18}$'
     or length(p_expected_revision) > 19
     or p_expected_revision::numeric > 9223372036854775807
     or p_mode not in ('end', 'disable')
     or (p_mode = 'end') <> (p_effective_until is not null)
     or not academy_private.provider_pricing_reason_is_allowed(p_reason_code)
     or p_request_id is null then
    raise exception 'PROVIDER_PRICING_REQUEST_INVALID' using errcode = '22023';
  end if;
  expected_revision := p_expected_revision::bigint;
  payload_digest := md5(jsonb_build_object(
    'termId', p_term_id,
    'expectedRevision', expected_revision,
    'mode', p_mode,
    'effectiveUntil', p_effective_until,
    'reasonCode', p_reason_code
  )::text);
  insert into academy_private.provider_pricing_mutation_receipts (
    actor_user_ref, request_id, operation, payload_digest
  ) values (actor.actor_user, p_request_id, p_mode, payload_digest)
  on conflict (actor_user_ref, request_id) do nothing;
  if not found then
    select * into receipt from academy_private.provider_pricing_mutation_receipts
    where actor_user_ref = actor.actor_user and request_id = p_request_id;
    if receipt.operation <> p_mode or receipt.payload_digest <> payload_digest then
      raise exception 'PROVIDER_PRICING_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if receipt.status <> 'completed' then
      raise exception 'PROVIDER_PRICING_REQUEST_IN_PROGRESS' using errcode = '40001';
    end if;
    return jsonb_set(receipt.result_projection, '{idempotencyResult}', '"replayed"'::jsonb);
  end if;

  lock table academy_private.provider_pricing_terms in share row exclusive mode;
  select * into term from academy_private.provider_pricing_terms
  where term_id = p_term_id for update;
  if not found then
    raise exception 'PROVIDER_PRICING_TERM_NOT_FOUND' using errcode = '22023';
  end if;
  if term.revision <> expected_revision then
    raise exception 'PROVIDER_PRICING_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if term.status <> 'published' then
    raise exception 'PROVIDER_PRICING_STATUS_CONFLICT' using errcode = '40001';
  end if;

  if p_mode = 'disable' then
    if term.effective_from <= statement_timestamp()
       or exists (
         select 1 from public.academy_provider_usage_cost_components
         where pricing_term_id = term.term_id
       ) then
      raise exception 'PROVIDER_PRICING_DISABLE_UNSAFE' using errcode = '55000';
    end if;
    next_status := 'disabled';
  else
    if p_effective_until < statement_timestamp()
       or p_effective_until <= term.effective_from
       or (term.effective_until is not null and p_effective_until > term.effective_until)
       or exists (
         select 1
         from public.academy_provider_usage_cost_components as component
         join public.academy_provider_usage_ledger as ledger
           on ledger.id = component.usage_id
         where component.pricing_term_id = term.term_id
           and ledger.occurred_at >= p_effective_until
       ) then
      raise exception 'PROVIDER_PRICING_END_UNSAFE' using errcode = '55000';
    end if;
    next_status := 'ended';
  end if;

  update academy_private.provider_pricing_terms
  set status = next_status,
      effective_until = case when p_mode = 'end' then p_effective_until else effective_until end,
      ended_at = statement_timestamp(), ended_by_user_ref = actor.actor_user,
      ended_by_role = actor.actor_role,
      ended_by_assignment_ref = actor.actor_assignment,
      ended_reason_code = p_reason_code, ended_request_id = p_request_id
  where term_id = term.term_id;

  audit_event := academy_private.append_admin_audit_event_v1(
    'configuration.update', 'configuration',
    'provider_pricing/' || term.term_id::text,
    'provider-pricing-v1', term.revision::text,
    jsonb_build_object(
      'status', term.status,
      'revision', term.revision::text,
      'value', term.price_micros::text
    ),
    jsonb_build_object(
      'status', next_status,
      'revision', term.revision::text,
      'value', term.price_micros::text
    ),
    p_reason_code, p_request_id
  );
  result := jsonb_build_object(
    'schemaVersion', 1,
    'termId', term.term_id,
    'revision', term.revision::text,
    'status', next_status,
    'effectiveUntil', case when p_mode = 'end' then p_effective_until else term.effective_until end,
    'idempotencyResult', 'created'
  );
  update academy_private.provider_pricing_mutation_receipts
  set status = 'completed', result_projection = result,
      audit_event_id = audit_event, completed_at = statement_timestamp()
  where actor_user_ref = actor.actor_user and request_id = p_request_id;
  return result;
end;
$$;

alter function public.academy_admin_read_provider_pricing_terms_v1(text) owner to postgres;
alter function public.academy_admin_preview_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,text
) owner to postgres;
alter function public.academy_admin_commit_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,uuid,text,text
) owner to postgres;
alter function public.academy_admin_end_provider_pricing_term_v1(
  uuid,text,text,timestamptz,text,uuid,text
) owner to postgres;

revoke all on table academy_private.provider_pricing_terms
  from public, anon, authenticated, service_role;
revoke all on table academy_private.provider_pricing_confirmations
  from public, anon, authenticated, service_role;
revoke all on table academy_private.provider_pricing_mutation_receipts
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_dimension_is_supported(text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_reason_is_allowed(text)
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_actor_v1()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_validate_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,text,text
) from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_payload_digest_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,bigint
) from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_reject_term_mutation()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.provider_pricing_reject_overlap()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.apply_provider_pricing_terms_v1()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.preserve_provider_pricing_term_cost_v1()
  from public, anon, authenticated, service_role;
revoke all on function academy_private.lookup_provider_pricing_term_v1(
  text,text,text,text,text,timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_provider_pricing_terms_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_preview_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_commit_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,uuid,text,text
) from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_end_provider_pricing_term_v1(
  uuid,text,text,timestamptz,text,uuid,text
) from public, anon, authenticated, service_role;

grant execute on function public.academy_admin_read_provider_pricing_terms_v1(text)
  to service_role;
grant execute on function public.academy_admin_preview_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,text
) to authenticated;
grant execute on function public.academy_admin_commit_provider_pricing_term_v1(
  text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,uuid,text,text
) to authenticated;
grant execute on function public.academy_admin_end_provider_pricing_term_v1(
  uuid,text,text,timestamptz,text,uuid,text
) to authenticated;

comment on table academy_private.provider_pricing_terms is
  'Verified private effective-dated provider pricing terms; no list prices or guessed terms are seeded.';
comment on function academy_private.lookup_provider_pricing_term_v1(
  text,text,text,text,text,timestamptz
) is
  'Deterministic half-open provider pricing lookup; unconfigured, ambiguous, and unsupported dimensions fail closed.';
comment on column public.academy_provider_usage_ledger.pricing_authority is
  'Non-null only when immutable component snapshots were calculated from provider_pricing_terms_v1.';

commit;
