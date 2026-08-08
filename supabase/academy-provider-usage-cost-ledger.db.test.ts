import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000002'
const databases: PGlite[] = []

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth authorization postgres;
    create table auth.users (id uuid primary key);
    create table public.academy_households (
      id uuid primary key,
      status text not null
    );
    create table public.academy_students (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id)
    );
    create table public.academy_household_memberships (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id),
      user_id uuid references auth.users (id),
      status text not null,
      revoked_at timestamptz
    );
    insert into auth.users (id) values ('${USER_ID}');
    insert into public.academy_households (id, status) values ('${HOUSEHOLD_ID}', 'active');
    insert into public.academy_household_memberships (
      id, household_id, user_id, status, revoked_at
    ) values (
      '00000000-0000-4000-8000-000000000003',
      '${HOUSEHOLD_ID}',
      '${USER_ID}',
      'active',
      null
    );
  `)
  const migration = await readFile(
    new URL('./migrations/20260808120000_academy_provider_usage_cost_ledger.sql', import.meta.url),
    'utf8',
  )
  await database.exec(migration)
  return database
}

type UsageInput = {
  requestKey: string
  occurredAt?: string
  engine?: 'tutor' | 'jarvis' | 'tts'
  provider?: 'anthropic' | 'elevenlabs'
  logicalModelTier?: 'sonnet' | 'haiku' | null
  product?: string
  voiceReference?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  cacheReadInputTokens?: number | null
  cacheWriteInputTokens?: number | null
  characters?: number | null
  latencyMs?: number
  status?: string
  billingBasis?: 'estimate' | 'none' | 'unknown'
}

async function record(database: PGlite, input: UsageInput) {
  const isTts = input.provider === 'elevenlabs' || input.engine === 'tts'
  return database.query<{ usage_id: string }>(
    `select public.academy_record_provider_usage(
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16
    )::text as usage_id`,
    [
      input.requestKey,
      input.occurredAt ?? '2026-06-15T12:00:00.000Z',
      USER_ID,
      input.engine ?? 'tutor',
      input.provider ?? 'anthropic',
      input.logicalModelTier === undefined ? (isTts ? null : 'sonnet') : input.logicalModelTier,
      input.product ?? (isTts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      input.voiceReference === undefined ? (isTts ? 'voice-1' : null) : input.voiceReference,
      input.inputTokens === undefined ? (isTts ? null : 0) : input.inputTokens,
      input.outputTokens === undefined ? (isTts ? null : 0) : input.outputTokens,
      input.cacheReadInputTokens === undefined ? (isTts ? null : 0) : input.cacheReadInputTokens,
      input.cacheWriteInputTokens === undefined ? (isTts ? null : 0) : input.cacheWriteInputTokens,
      input.characters === undefined ? (isTts ? 0 : null) : input.characters,
      input.latencyMs ?? 25,
      input.status ?? 'success',
      input.billingBasis ?? 'estimate',
    ],
  )
}

async function insertPrice(
  database: PGlite,
  values: {
    provider?: string
    product?: string
    billingUnit: string
    effectiveFrom?: string
    effectiveTo?: string | null
    priceMicros: number
    unitQuantity?: number
  },
) {
  await database.query(
    `insert into public.academy_provider_prices (
      provider, product, billing_unit, effective_from, effective_to,
      price_micros, unit_quantity, source_label
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      values.provider ?? 'anthropic',
      values.product ?? 'claude-sonnet-4-6',
      values.billingUnit,
      values.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
      values.effectiveTo ?? null,
      values.priceMicros,
      values.unitQuantity ?? 1_000_000,
      'DETERMINISTIC TEST FIXTURE - NOT PRODUCTION PRICING',
    ],
  )
}

async function ledger(database: PGlite, requestKey: string) {
  const result = await database.query<{
    calculated_cost_micros: number | bigint | null
    calculation_status: string
    household_id: string | null
    learner_id: string | null
    status: string
  }>(
    `select calculated_cost_micros, calculation_status, household_id::text,
            learner_id::text, status
     from public.academy_provider_usage_ledger where request_key = $1`,
    [requestKey],
  )
  return result.rows[0]
}

beforeEach(async () => {
  await createDatabase()
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy provider usage cost ledger', () => {
  it('calculates exact input, output, combined, and cached-token components', async () => {
    const database = databases[0]
    await insertPrice(database, { billingUnit: 'input_token', priceMicros: 3_000_000 })
    await insertPrice(database, { billingUnit: 'output_token', priceMicros: 15_000_000 })
    await insertPrice(database, { billingUnit: 'cache_read_input_token', priceMicros: 300_000 })
    await insertPrice(database, { billingUnit: 'cache_write_input_token', priceMicros: 3_750_000 })

    await record(database, {
      requestKey: 'combined-ai',
      inputTokens: 500_000,
      outputTokens: 200_000,
      cacheReadInputTokens: 100_000,
      cacheWriteInputTokens: 100_000,
    })
    expect(await ledger(database, 'combined-ai')).toMatchObject({
      calculated_cost_micros: 4_905_000,
      calculation_status: 'calculated',
      household_id: HOUSEHOLD_ID,
      learner_id: null,
    })
    const components = await database.query<{ billing_unit: string; calculated_cost_micros: number }>(
      `select billing_unit, calculated_cost_micros
       from public.academy_provider_usage_cost_components order by billing_unit`,
    )
    expect(components.rows).toEqual([
      { billing_unit: 'cache_read_input_token', calculated_cost_micros: 30_000 },
      { billing_unit: 'cache_write_input_token', calculated_cost_micros: 375_000 },
      { billing_unit: 'input_token', calculated_cost_micros: 1_500_000 },
      { billing_unit: 'output_token', calculated_cost_micros: 3_000_000 },
    ])
  })

  it('calculates exact TTS character cost and stores no audio or submitted text', async () => {
    const database = databases[0]
    await insertPrice(database, {
      provider: 'elevenlabs',
      product: 'eleven_turbo_v2_5',
      billingUnit: 'character',
      priceMicros: 300_000,
      unitQuantity: 1_000,
    })
    await record(database, {
      requestKey: 'tts-exact',
      engine: 'tts',
      provider: 'elevenlabs',
      characters: 333,
    })
    expect(await ledger(database, 'tts-exact')).toMatchObject({
      calculated_cost_micros: 99_900,
      calculation_status: 'calculated',
    })
    const forbiddenColumns = await database.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public'
        and table_name like 'academy_provider_usage%'
        and column_name ~ '(prompt|response|conversation|audio|answer|text)'
    `)
    expect(forbiddenColumns.rows).toEqual([])
  })

  it('calculates zero usage as exactly zero without requiring a price', async () => {
    const database = databases[0]
    await record(database, { requestKey: 'zero-usage' })
    expect(await ledger(database, 'zero-usage')).toMatchObject({
      calculated_cost_micros: 0,
      calculation_status: 'calculated',
    })
  })

  it('uses half-up integer rounding for each billing component', async () => {
    const database = databases[0]
    await insertPrice(database, {
      product: 'rounding-product',
      billingUnit: 'input_token',
      priceMicros: 1,
      unitQuantity: 2,
    })
    await record(database, {
      requestKey: 'rounding',
      product: 'rounding-product',
      inputTokens: 1,
    })
    expect(await ledger(database, 'rounding')).toMatchObject({ calculated_cost_micros: 1 })
  })

  it('selects prices by half-open effective period, including the boundary', async () => {
    const database = databases[0]
    await insertPrice(database, {
      product: 'dated-product',
      billingUnit: 'input_token',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: '2026-07-01T00:00:00.000Z',
      priceMicros: 2,
      unitQuantity: 1,
    })
    await insertPrice(database, {
      product: 'dated-product',
      billingUnit: 'input_token',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      priceMicros: 3,
      unitQuantity: 1,
    })
    await record(database, {
      requestKey: 'before-boundary',
      product: 'dated-product',
      occurredAt: '2026-06-30T23:59:59.999Z',
      inputTokens: 10,
    })
    await record(database, {
      requestKey: 'at-boundary',
      product: 'dated-product',
      occurredAt: '2026-07-01T00:00:00.000Z',
      inputTokens: 10,
    })
    expect(await ledger(database, 'before-boundary')).toMatchObject({ calculated_cost_micros: 20 })
    expect(await ledger(database, 'at-boundary')).toMatchObject({ calculated_cost_micros: 30 })
  })

  it('marks missing prices explicitly and preserves unknown billing outcomes', async () => {
    const database = databases[0]
    await record(database, { requestKey: 'missing-price', inputTokens: 1 })
    await record(database, {
      requestKey: 'provider-timeout',
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheWriteInputTokens: null,
      status: 'timeout',
      billingBasis: 'unknown',
    })
    expect(await ledger(database, 'missing-price')).toMatchObject({
      calculated_cost_micros: null,
      calculation_status: 'price_unavailable',
    })
    expect(await ledger(database, 'provider-timeout')).toMatchObject({
      calculated_cost_micros: null,
      calculation_status: 'billing_outcome_unknown',
      status: 'timeout',
    })
  })

  it('deduplicates repeated executions by trusted request key', async () => {
    const database = databases[0]
    await insertPrice(database, {
      billingUnit: 'input_token',
      priceMicros: 1,
      unitQuantity: 1,
    })
    const first = await record(database, { requestKey: 'same-execution', inputTokens: 5 })
    const duplicate = await record(database, { requestKey: 'same-execution', inputTokens: 999 })
    expect(duplicate.rows[0].usage_id).toBe(first.rows[0].usage_id)
    expect(await ledger(database, 'same-execution')).toMatchObject({ calculated_cost_micros: 5 })
    const count = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.academy_provider_usage_ledger
       where request_key = 'same-execution'`,
    )
    expect(count.rows[0].count).toBe(1)
  })

  it('enforces quantity and price bounds while retaining exact maximum arithmetic', async () => {
    const database = databases[0]
    await insertPrice(database, {
      product: 'bounded-product',
      billingUnit: 'input_token',
      priceMicros: 1_000_000_000,
      unitQuantity: 1,
    })
    await record(database, {
      requestKey: 'maximum-bounded-cost',
      product: 'bounded-product',
      inputTokens: 1_000_000_000,
    })
    expect(await ledger(database, 'maximum-bounded-cost')).toMatchObject({
      calculated_cost_micros: 1_000_000_000_000_000_000n,
    })
    await expect(
      record(database, { requestKey: 'usage-overflow', inputTokens: 1_000_000_001 }),
    ).rejects.toThrow()
    await expect(
      insertPrice(database, {
        product: 'price-overflow',
        billingUnit: 'input_token',
        priceMicros: 1_000_000_001,
      }),
    ).rejects.toThrow()
  })

  it('allows forward price versions, rejects backdating or mutation, and denies browser roles', async () => {
    const database = databases[0]
    await insertPrice(database, {
      product: 'immutable-product',
      billingUnit: 'input_token',
      priceMicros: 1,
    })
    await insertPrice(database, {
      product: 'immutable-product',
      billingUnit: 'input_token',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      priceMicros: 2,
    })
    await expect(
      insertPrice(database, {
        product: 'immutable-product',
        billingUnit: 'input_token',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        priceMicros: 3,
      }),
    ).rejects.toThrow()
    await expect(
      database.exec(`update public.academy_provider_prices set price_micros = 2`),
    ).rejects.toThrow()

    await database.exec('set role authenticated;')
    await expect(database.query('select * from public.academy_provider_usage_ledger')).rejects.toThrow()
    await expect(database.query('select * from public.academy_provider_prices')).rejects.toThrow()
    await database.exec('reset role;')
  })
})
