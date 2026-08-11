import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OWNER_ID = '00000000-0000-4000-8000-000000000101'
const ADMIN_ID = '00000000-0000-4000-8000-000000000102'
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000002'
const databases: PGlite[] = []
let confirmationCounter = 0

type Role = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(
  database: PGlite,
  role: Role,
  userId: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  await database.query(`select set_config('request.jwt.claim.role', $1, false)`, [role])
  await database.exec(`set role ${role}`)
  try {
    return await operation()
  } finally {
    await database.exec('reset role')
    await database.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await database.query(`select set_config('request.jwt.claim.role', '', false)`)
  }
}

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth authorization postgres;
    create schema academy_private authorization postgres;
    create function auth.uid()
    returns uuid language sql stable set search_path = pg_catalog as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (id uuid primary key);
    create table public.academy_households (id uuid primary key, status text not null);
    create table public.academy_students (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id)
    );
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users (id) values
      ('${OWNER_ID}'), ('${ADMIN_ID}'), ('${ACCOUNT_ID}');
    insert into public.academy_households (id, status)
    values ('${HOUSEHOLD_ID}', 'active');
  `)
  for (const migration of [
    '20260808120000_academy_admin_authorization.sql',
    '20260808122000_academy_provider_usage_cost_ledger.sql',
  ]) {
    await database.exec(await readFile(new URL(`./migrations/${migration}`, import.meta.url), 'utf8'))
  }
  await database.exec(`
    create function academy_private.operational_is_trusted_server()
    returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select auth.uid() is null
        and current_setting('request.jwt.claim.role', true) = 'service_role'
    $$;
    create function academy_private.cost_is_trusted_server()
    returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select auth.uid() is null
        and current_setting('request.jwt.claim.role', true) = 'service_role'
    $$;
    insert into public.academy_admin_role_assignments
      (user_id, role, assignment_reason_code)
    values
      ('${OWNER_ID}', 'owner', 'admin.bootstrap'),
      ('${ADMIN_ID}', 'admin', 'admin.bootstrap');
  `)
  for (const migration of [
    '20260809130000_academy_admin_audit_foundation.sql',
    '20260810120300_academy_provider_pricing_terms.sql',
  ]) {
    await database.exec(await readFile(new URL(`./migrations/${migration}`, import.meta.url), 'utf8'))
  }
  return database
}

type TermInput = {
  provider?: 'anthropic' | 'elevenlabs'
  product?: string
  model?: string
  tier?: 'sonnet' | 'haiku' | null
  unit?: string
  priceMicros?: string | number
  unitSize?: string | number
  effectiveFrom?: string
  effectiveUntil?: string | null
  replacesTermId?: string | null
  verificationRef?: string
  reason?: string
}

function termValues(input: TermInput = {}) {
  const tts = input.provider === 'elevenlabs'
  return [
    input.provider ?? 'anthropic',
    input.product ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.model ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.tier === undefined ? (tts ? null : 'sonnet') : input.tier,
    input.unit ?? (tts ? 'tts_character' : 'input_token'),
    input.priceMicros ?? '2500',
    input.unitSize ?? '1000000',
    input.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
    input.effectiveUntil === undefined ? null : input.effectiveUntil,
    input.replacesTermId ?? null,
    input.verificationRef ?? 'invoice:verified-test',
    input.reason ?? 'configuration.changed',
  ]
}

function nextDigest() {
  confirmationCounter += 1
  return confirmationCounter.toString(16).padStart(64, '0')
}

async function preview(database: PGlite, input: TermInput = {}, actor = OWNER_ID) {
  const digest = nextDigest()
  const response = await asRole(database, 'authenticated', actor, () => database.query<{ result: any }>(`
    select public.academy_admin_preview_provider_pricing_term_v1(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'configuration:manage'
    ) as result
  `, [...termValues(input), digest]))
  return { ...response.rows[0].result, digest }
}

async function commit(
  database: PGlite,
  input: TermInput,
  change: { expectedRevision: string; digest: string },
  requestId = randomUUID(),
  actor = OWNER_ID,
) {
  return asRole(database, 'authenticated', actor, () => database.query<{ result: any }>(`
    select public.academy_admin_commit_provider_pricing_term_v1(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'configuration:manage'
    ) as result
  `, [...termValues(input), change.expectedRevision, requestId, change.digest]))
}

async function createTerm(database: PGlite, input: TermInput = {}) {
  const change = await preview(database, input)
  return (await commit(database, input, change)).rows[0].result
}

async function readTerms(database: PGlite) {
  return asRole(database, 'service_role', null, () => database.query<{ result: any }>(`
    select public.academy_admin_read_provider_pricing_terms_v1('costs:read') as result
  `))
}

async function lookup(database: PGlite, input: TermInput, effectiveAt: string) {
  const values = termValues(input)
  return database.query<{ result: any }>(`
    select academy_private.lookup_provider_pricing_term_v1(
      $1,$2,$3,$4,$5,$6
    ) as result
  `, [values[0], values[1], values[2], values[3], values[4], effectiveAt])
}

type UsageInput = {
  executionKey: string
  occurredAt?: string
  provider?: 'anthropic' | 'elevenlabs'
  product?: string
  model?: string
  tier?: 'sonnet' | 'haiku' | null
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputReadTokens?: number | null
  cachedInputWriteTokens?: number | null
  ttsCharacters?: number | null
}

async function record(database: PGlite, input: UsageInput) {
  const tts = input.provider === 'elevenlabs'
  return asRole(database, 'service_role', null, () => database.query(`
    select public.academy_record_provider_usage(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
    )
  `, [
    input.executionKey,
    input.occurredAt ?? '2026-06-15T12:00:00.000Z',
    ACCOUNT_ID,
    HOUSEHOLD_ID,
    'resolved',
    'academy-build-test',
    tts ? null : 'tutor-engine-test',
    null,
    tts ? 'tts' : 'tutor',
    input.provider ?? 'anthropic',
    input.product ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.model ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.tier === undefined ? (tts ? null : 'sonnet') : input.tier,
    input.inputTokens === undefined ? (tts ? null : 0) : input.inputTokens,
    input.outputTokens === undefined ? (tts ? null : 0) : input.outputTokens,
    input.cachedInputReadTokens === undefined ? (tts ? null : 0) : input.cachedInputReadTokens,
    input.cachedInputWriteTokens === undefined ? (tts ? null : 0) : input.cachedInputWriteTokens,
    input.ttsCharacters === undefined ? (tts ? 0 : null) : input.ttsCharacters,
    25,
    'success',
    null,
    'billable',
  ]))
}

beforeEach(async () => {
  confirmationCounter = 0
  await createDatabase()
})
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('effective-dated provider pricing terms database foundation', () => {
  it('starts with no guessed prices and returns pricing_unconfigured', async () => {
    const database = databases[0]
    const response = (await readTerms(database)).rows[0].result
    expect(response).toEqual({
      schemaVersion: 1,
      pricingStatus: 'pricing_unconfigured',
      currency: 'USD',
      terms: [],
    })
    expect((await database.query(`select count(*)::text as count
      from academy_private.provider_pricing_terms`)).rows).toEqual([{ count: '0' }])
    expect((await database.query(`select count(*)::text as count
      from public.academy_provider_prices`)).rows).toEqual([{ count: '0' }])
  })

  it('creates an owner-attributed exact IntegerMicros term and audits it atomically', async () => {
    const database = databases[0]
    const created = await createTerm(database)
    expect(created).toMatchObject({ revision: '1', status: 'published' })
    const stored = await database.query<any>(`
      select price_micros::text, unit_quantity::text, revision::text,
        created_by_user_ref, created_by_role, verification_ref
      from academy_private.provider_pricing_terms
    `)
    expect(stored.rows).toEqual([{
      price_micros: '2500',
      unit_quantity: '1000000',
      revision: '1',
      created_by_user_ref: OWNER_ID,
      created_by_role: 'owner',
      verification_ref: 'invoice:verified-test',
    }])
    const audit = await database.query<any>(`
      select action, resource_type, resource_ref, resource_revision,
        actor_user_ref, actor_role, new_value
      from academy_private.admin_audit_events
    `)
    expect(audit.rows[0]).toMatchObject({
      action: 'configuration.update',
      resource_type: 'configuration',
      resource_ref: `provider_pricing/${created.termId}`,
      resource_revision: '1',
      actor_user_ref: OWNER_ID,
      actor_role: 'owner',
      new_value: { status: 'published', revision: '1', value: '2500', model_tier: 'sonnet' },
    })
  })

  it('rolls back the term, confirmation consumption, and receipt when ADMIN-15 append fails', async () => {
    const database = databases[0]
    const change = await preview(database)
    await database.exec(`
      create or replace function academy_private.append_admin_audit_event_v1(
        p_action text,
        p_resource_type text,
        p_resource_ref text,
        p_resource_version text default null,
        p_resource_revision text default null,
        p_previous_value jsonb default null,
        p_new_value jsonb default null,
        p_reason_code text default null,
        p_correlation_id uuid default null
      ) returns uuid
      language plpgsql volatile security definer set search_path = pg_catalog as $$
      begin
        raise exception 'audit unavailable';
      end;
      $$;
    `)
    await expect(commit(database, {}, change)).rejects.toThrow(/audit unavailable/)
    expect((await database.query(`select count(*)::text as count
      from academy_private.provider_pricing_terms`)).rows).toEqual([{ count: '0' }])
    expect((await database.query(`select count(*)::text as count
      from academy_private.provider_pricing_mutation_receipts`)).rows).toEqual([{ count: '0' }])
    expect((await database.query(`select consumed_at
      from academy_private.provider_pricing_confirmations`)).rows).toEqual([{ consumed_at: null }])
  })

  it('uses deterministic half-open boundaries and rejects ambiguous overlap', async () => {
    const database = databases[0]
    const first = {
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: '2026-07-01T00:00:00.000Z',
    }
    await createTerm(database, first)
    await createTerm(database, {
      priceMicros: '3000',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveUntil: '2027-01-01T00:00:00.000Z',
    })
    expect((await lookup(database, first, '2026-06-30T23:59:59.999Z')).rows[0].result)
      .toMatchObject({ status: 'configured', priceMicrosPerUnitSize: '2500' })
    expect((await lookup(database, first, '2026-07-01T00:00:00.000Z')).rows[0].result)
      .toMatchObject({ status: 'configured', priceMicrosPerUnitSize: '3000' })
    await expect(preview(database, {
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      effectiveUntil: '2026-08-01T00:00:00.000Z',
    })).rejects.toThrow(/PROVIDER_PRICING_OVERLAP/)
  })

  it('preserves historical terms and component snapshots across a future replacement', async () => {
    const database = databases[0]
    const first = await createTerm(database)
    await record(database, { executionKey: 'historical', inputTokens: 1_000_000 })
    const replacementInput = {
      priceMicros: '5000',
      effectiveFrom: '2030-01-01T00:00:00.000Z',
      replacesTermId: first.termId,
    }
    const replacement = await createTerm(database, replacementInput)
    expect(replacement).toMatchObject({ revision: '2', supersedesTermId: first.termId })
    await record(database, {
      executionKey: 'future',
      occurredAt: '2030-01-01T00:00:00.000Z',
      inputTokens: 1_000_000,
    })
    const terms = await database.query<any>(`
      select term_id, revision::text, status, effective_until
      from academy_private.provider_pricing_terms order by revision
    `)
    expect(terms.rows[0]).toMatchObject({
      term_id: first.termId,
      revision: '1',
      status: 'ended',
    })
    expect(new Date(terms.rows[0].effective_until).toISOString()).toBe('2030-01-01T00:00:00.000Z')
    const snapshots = await database.query<any>(`
      select ledger.execution_key, component.pricing_term_id,
        component.pricing_term_revision::text, component.price_micros::text,
        component.calculated_cost_micros::text
      from public.academy_provider_usage_cost_components component
      join public.academy_provider_usage_ledger ledger on ledger.id = component.usage_id
      where component.billing_unit = 'input_token'
      order by ledger.execution_key
    `)
    expect(snapshots.rows).toEqual([
      {
        execution_key: 'future', pricing_term_id: replacement.termId,
        pricing_term_revision: '2', price_micros: '5000', calculated_cost_micros: '5000',
      },
      {
        execution_key: 'historical', pricing_term_id: first.termId,
        pricing_term_revision: '1', price_micros: '2500', calculated_cost_micros: '2500',
      },
    ])
  })

  it('calculates component money with arbitrary-precision half-up arithmetic', async () => {
    const database = databases[0]
    await createTerm(database, { priceMicros: '1001', unitSize: '100' })
    await record(database, { executionKey: 'exact-money', inputTokens: 333 })
    const ledger = await database.query<any>(`
      select cost_kind, cost_micros::text, pricing_catalog_version, pricing_authority
      from public.academy_provider_usage_ledger where execution_key = 'exact-money'
    `)
    expect(ledger.rows).toEqual([{
      cost_kind: 'calculated',
      cost_micros: '3333',
      pricing_catalog_version: null,
      pricing_authority: 'provider_pricing_terms_v1',
    }])
  })

  it('does not recompute an old unavailable ledger row after a later term is published', async () => {
    const database = databases[0]
    await record(database, { executionKey: 'before-configuration', inputTokens: 10 })
    await createTerm(database)
    const row = await database.query<any>(`
      select cost_kind, cost_micros, pricing_authority
      from public.academy_provider_usage_ledger where execution_key = 'before-configuration'
    `)
    expect(row.rows).toEqual([{
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    }])
  })

  it('rejects floats, malformed money, unsafe verification, and unsupported cache-write pricing', async () => {
    const database = databases[0]
    for (const priceMicros of ['1.5', '01', '-1', 0.5]) {
      await expect(preview(database, { priceMicros })).rejects.toThrow(/REQUEST_INVALID/)
    }
    await expect(preview(database, { verificationRef: 'secret:provider-key' }))
      .rejects.toThrow(/REQUEST_INVALID/)
    await expect(preview(database, { unit: 'cached_input_write_token' }))
      .rejects.toThrow(/DIMENSION_UNSUPPORTED/)
    expect((await lookup(database, {
      unit: 'cached_input_write_token',
    }, '2026-01-01T00:00:00.000Z')).rows[0].result)
      .toEqual({ status: 'unsupported_dimension' })
  })

  it('leaves positive Anthropic cache-write usage unavailable instead of guessing TTL economics', async () => {
    const database = databases[0]
    for (const unit of ['input_token', 'output_token', 'cached_input_read_token']) {
      await createTerm(database, { unit, priceMicros: '1000' })
    }
    await record(database, {
      executionKey: 'cache-write-unsupported',
      inputTokens: 1,
      outputTokens: 1,
      cachedInputReadTokens: 1,
      cachedInputWriteTokens: 1,
    })
    const result = await database.query<any>(`
      select cost_kind, cost_micros, pricing_authority
      from public.academy_provider_usage_ledger
      where execution_key = 'cache-write-unsupported'
    `)
    expect(result.rows).toEqual([{
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    }])
  })

  it('allows only Owner mutation and denies direct table access for every application role', async () => {
    const database = databases[0]
    await expect(preview(database, {}, ADMIN_ID)).rejects.toThrow(/MANAGE_REQUIRED/)
    await expect(asRole(database, 'authenticated', OWNER_ID, () =>
      database.query(`select * from academy_private.provider_pricing_terms`)))
      .rejects.toThrow()
    await expect(asRole(database, 'authenticated', OWNER_ID, () =>
      database.exec(`insert into academy_private.provider_pricing_terms (
        provider, provider_product_id, provider_model_id, logical_model_tier,
        usage_unit, price_micros, unit_quantity, effective_from, revision,
        verification_ref, created_by_user_ref, created_by_role,
        created_by_assignment_ref, created_reason_code, created_request_id
      ) values ('anthropic','x','x','sonnet','input_token',1,1,now(),1,
        'invoice:test','${OWNER_ID}','owner',gen_random_uuid(),
        'configuration.changed',gen_random_uuid())`))).rejects.toThrow()
    const grants = await database.query<any>(`
      select
        has_table_privilege('authenticated',
          'academy_private.provider_pricing_terms', 'insert,update,delete') as authenticated_write,
        has_table_privilege('service_role',
          'academy_private.provider_pricing_terms', 'insert,update,delete') as service_write,
        has_function_privilege('authenticated',
          'public.academy_admin_commit_provider_pricing_term_v1(text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,uuid,text,text)',
          'execute') as authenticated_commit,
        has_function_privilege('service_role',
          'public.academy_admin_commit_provider_pricing_term_v1(text,text,text,text,text,text,text,timestamptz,timestamptz,uuid,text,text,text,uuid,text,text)',
          'execute') as service_commit
    `)
    expect(grants.rows).toEqual([{
      authenticated_write: false,
      service_write: false,
      authenticated_commit: true,
      service_commit: false,
    }])
  })

  it('safely disables an unused future term and ends a published term without deleting history', async () => {
    const database = databases[0]
    const future = await createTerm(database, {
      unit: 'output_token',
      effectiveFrom: '2031-01-01T00:00:00.000Z',
    })
    const disabled = await asRole(database, 'authenticated', OWNER_ID, () => database.query<{ result: any }>(`
      select public.academy_admin_end_provider_pricing_term_v1(
        $1,'1','disable',null,'operator.request',$2,'configuration:manage'
      ) as result
    `, [future.termId, randomUUID()]))
    expect(disabled.rows[0].result.status).toBe('disabled')

    const current = await createTerm(database)
    const ended = await asRole(database, 'authenticated', OWNER_ID, () => database.query<{ result: any }>(`
      select public.academy_admin_end_provider_pricing_term_v1(
        $1,'1','end','2030-01-01T00:00:00.000Z',
        'scheduled.change',$2,'configuration:manage'
      ) as result
    `, [current.termId, randomUUID()]))
    expect(ended.rows[0].result).toMatchObject({ status: 'ended', revision: '1' })
    expect((await database.query(`select count(*)::text as count
      from academy_private.provider_pricing_terms`)).rows).toEqual([{ count: '2' }])
    expect((await database.query(`select count(*)::text as count
      from academy_private.admin_audit_events`)).rows).toEqual([{ count: '4' }])
  })

  it('keeps lookup dimensions exact across provider product, model, tier, and unit', async () => {
    const database = databases[0]
    await createTerm(database)
    expect((await lookup(database, { model: 'claude-other' }, '2026-06-01T00:00:00Z'))
      .rows[0].result).toEqual({ status: 'pricing_unconfigured' })
    expect((await lookup(database, { tier: 'haiku' }, '2026-06-01T00:00:00Z'))
      .rows[0].result).toEqual({ status: 'pricing_unconfigured' })
    expect((await lookup(database, { unit: 'output_token' }, '2026-06-01T00:00:00Z'))
      .rows[0].result).toEqual({ status: 'pricing_unconfigured' })
  })
})
