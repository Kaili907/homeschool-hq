import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
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
    create table public.academy_households (id uuid primary key, status text not null);
    create table public.academy_students (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id)
    );
    insert into auth.users (id) values ('${ACCOUNT_ID}');
    insert into public.academy_households (id, status) values ('${HOUSEHOLD_ID}', 'active');
  `)
  const migration = await readFile(
    new URL('./migrations/20260808122000_academy_provider_usage_cost_ledger.sql', import.meta.url),
    'utf8',
  )
  await database.exec(migration)
  return database
}

type UsageInput = {
  executionKey: string
  occurredAt?: string
  accountRef?: string
  householdRef?: string | null
  householdAttribution?: 'resolved' | 'no_active_household' | 'ambiguous' | 'lookup_unavailable'
  appVersion?: string
  engineVersion?: string | null
  curriculumVersion?: string | null
  engine?: 'tutor' | 'jarvis' | 'tts'
  provider?: 'anthropic' | 'elevenlabs'
  product?: string
  model?: string
  tier?: 'sonnet' | 'haiku' | null
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputReadTokens?: number | null
  cachedInputWriteTokens?: number | null
  ttsCharacters?: number | null
  latencyMs?: number
  result?: string
  reason?: string | null
  billingDisposition?: 'billable' | 'not_billable' | 'unknown'
}

async function record(database: PGlite, input: UsageInput) {
  const tts = input.provider === 'elevenlabs' || input.engine === 'tts'
  return database.query<{ result: { usageId: string; idempotencyResult: string } }>(
    `select public.academy_record_provider_usage(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    ) as result`,
    [
      input.executionKey,
      input.occurredAt ?? '2026-06-15T12:00:00.000Z',
      input.accountRef ?? ACCOUNT_ID,
      input.householdRef === undefined ? HOUSEHOLD_ID : input.householdRef,
      input.householdAttribution ?? 'resolved',
      input.appVersion ?? 'academy-build-1',
      input.engineVersion === undefined ? (tts ? null : 'tutor-engine-1') : input.engineVersion,
      input.curriculumVersion === undefined ? null : input.curriculumVersion,
      input.engine ?? (tts ? 'tts' : 'tutor'),
      input.provider ?? (tts ? 'elevenlabs' : 'anthropic'),
      input.product ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      input.model ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      input.tier === undefined ? (tts ? null : 'sonnet') : input.tier,
      input.inputTokens === undefined ? (tts ? null : 0) : input.inputTokens,
      input.outputTokens === undefined ? (tts ? null : 0) : input.outputTokens,
      input.cachedInputReadTokens === undefined ? (tts ? null : 0) : input.cachedInputReadTokens,
      input.cachedInputWriteTokens === undefined ? (tts ? null : 0) : input.cachedInputWriteTokens,
      input.ttsCharacters === undefined ? (tts ? 0 : null) : input.ttsCharacters,
      input.latencyMs ?? 25,
      input.result ?? 'success',
      input.reason === undefined ? null : input.reason,
      input.billingDisposition ?? 'billable',
    ],
  )
}

async function insertCatalog(
  database: PGlite,
  version = 'test-catalog-v1',
  effectiveFrom = '2026-01-01T00:00:00.000Z',
  effectiveTo: string | null = '2026-07-01T00:00:00.000Z',
  currency = 'USD',
) {
  await database.query(
    `insert into public.academy_provider_pricing_catalogs
      (version, currency, effective_from, effective_to, published_at, source_ref)
     values ($1, $2, $3, $4, '2025-12-15T00:00:00Z', 'DETERMINISTIC TEST FIXTURE')`,
    [version, currency, effectiveFrom, effectiveTo],
  )
}

async function insertRate(database: PGlite, values: {
  catalog?: string
  provider?: string
  product?: string
  model?: string
  tier?: string | null
  unit: string
  priceMicros: number
  unitQuantity?: number
  effectiveFrom?: string
  effectiveTo?: string | null
  currency?: string
}) {
  const tts = values.provider === 'elevenlabs'
  await database.query(
    `insert into public.academy_provider_prices (
      pricing_catalog_version, provider, provider_product_id, provider_model_id,
      logical_model_tier, billing_unit, currency, effective_from, effective_to,
      price_micros, unit_quantity
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      values.catalog ?? 'test-catalog-v1',
      values.provider ?? 'anthropic',
      values.product ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      values.model ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      values.tier === undefined ? (tts ? null : 'sonnet') : values.tier,
      values.unit,
      values.currency ?? 'USD',
      values.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
      values.effectiveTo === undefined ? '2026-07-01T00:00:00.000Z' : values.effectiveTo,
      values.priceMicros,
      values.unitQuantity ?? 1_000_000,
    ],
  )
}

async function ledger(database: PGlite, executionKey: string) {
  const result = await database.query<Record<string, unknown>>(
    `select * from public.academy_provider_usage_ledger where execution_key = $1`,
    [executionKey],
  )
  return result.rows[0]
}

beforeEach(createDatabase)
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('Academy provider usage cost ledger v2', () => {
  it('keeps cache read/write quantities, prices, and immutable component snapshots distinct', async () => {
    const database = databases[0]
    await insertCatalog(database)
    await insertRate(database, { unit: 'input_token', priceMicros: 3_000_000 })
    await insertRate(database, { unit: 'output_token', priceMicros: 15_000_000 })
    await insertRate(database, { unit: 'cached_input_read_token', priceMicros: 300_000 })
    await insertRate(database, { unit: 'cached_input_write_token', priceMicros: 3_750_000 })
    await record(database, {
      executionKey: 'combined-ai', inputTokens: 500_000, outputTokens: 200_000,
      cachedInputReadTokens: 100_000, cachedInputWriteTokens: 100_000,
    })
    expect(await ledger(database, 'combined-ai')).toMatchObject({
      account_id: ACCOUNT_ID,
      household_id: HOUSEHOLD_ID,
      household_attribution: 'resolved',
      cached_input_read_tokens: 100_000,
      cached_input_write_tokens: 100_000,
      cost_kind: 'calculated',
      pricing_catalog_version: 'test-catalog-v1',
    })
    expect(String((await ledger(database, 'combined-ai')).cost_micros)).toBe('4905000')
    const components = await database.query<Record<string, unknown>>(
      `select billing_unit, quantity, price_micros, calculated_cost_micros
       from public.academy_provider_usage_cost_components order by billing_unit`,
    )
    expect(components.rows.map((row) => ({ ...row, calculated_cost_micros: String(row.calculated_cost_micros) }))).toEqual([
      { billing_unit: 'cached_input_read_token', quantity: 100_000, price_micros: 300_000, calculated_cost_micros: '30000' },
      { billing_unit: 'cached_input_write_token', quantity: 100_000, price_micros: 3_750_000, calculated_cost_micros: '375000' },
      { billing_unit: 'input_token', quantity: 500_000, price_micros: 3_000_000, calculated_cost_micros: '1500000' },
      { billing_unit: 'output_token', quantity: 200_000, price_micros: 15_000_000, calculated_cost_micros: '3000000' },
    ])
  })

  it('records exact TTS characters with a null logical tier and no content columns', async () => {
    const database = databases[0]
    await insertCatalog(database)
    await insertRate(database, { provider: 'elevenlabs', tier: null, unit: 'tts_character', priceMicros: 300_000, unitQuantity: 1_000 })
    await record(database, { executionKey: 'tts-exact', engine: 'tts', provider: 'elevenlabs', ttsCharacters: 333 })
    const row = await ledger(database, 'tts-exact')
    expect(row).toMatchObject({ logical_model_tier: null, tts_characters: 333, cost_kind: 'calculated' })
    expect(String(row.cost_micros)).toBe('99900')
    const forbidden = await database.query(`select column_name from information_schema.columns
      where table_schema = 'public' and table_name like 'academy_provider_usage%'
      and column_name ~ '(prompt|conversation|student_audio|assessment_answer|answer_content|raw_answer)'`)
    expect(forbidden.rows).toEqual([])
  })

  it.each(['resolved', 'no_active_household', 'ambiguous', 'lookup_unavailable'] as const)(
    'persists verified account and canonical %s household attribution',
    async (attribution) => {
      const database = databases[0]
      await record(database, {
        executionKey: `identity-${attribution}`,
        householdAttribution: attribution,
        householdRef: attribution === 'resolved' ? HOUSEHOLD_ID : null,
      })
      expect(await ledger(database, `identity-${attribution}`)).toMatchObject({
        account_id: ACCOUNT_ID,
        household_id: attribution === 'resolved' ? HOUSEHOLD_ID : null,
        household_attribution: attribution,
      })
    },
  )

  it('uses exactly one catalog at half-open boundaries and rejects catalog/rate overlap', async () => {
    const database = databases[0]
    await insertCatalog(database)
    await insertCatalog(database, 'test-catalog-v2', '2026-07-01T00:00:00.000Z', null)
    await insertRate(database, { unit: 'input_token', priceMicros: 2, unitQuantity: 1 })
    await insertRate(database, { catalog: 'test-catalog-v2', unit: 'input_token', priceMicros: 3, unitQuantity: 1, effectiveFrom: '2026-07-01T00:00:00.000Z', effectiveTo: null })
    await record(database, { executionKey: 'before-boundary', occurredAt: '2026-06-30T23:59:59.999Z', inputTokens: 10 })
    await record(database, { executionKey: 'at-boundary', occurredAt: '2026-07-01T00:00:00.000Z', inputTokens: 10 })
    expect(String((await ledger(database, 'before-boundary')).cost_micros)).toBe('20')
    expect(String((await ledger(database, 'at-boundary')).cost_micros)).toBe('30')
    await expect(insertCatalog(database, 'overlap', '2026-06-01T00:00:00Z', '2026-08-01T00:00:00Z')).rejects.toThrow(/may not overlap/)
    await expect(insertRate(database, { unit: 'input_token', priceMicros: 4, effectiveFrom: '2026-06-01T00:00:00Z' })).rejects.toThrow(/may not overlap/)
  })

  it('enforces USD and represents unavailable, calculated, reconciled, and billing independently', async () => {
    const database = databases[0]
    await expect(insertCatalog(database, 'eur-catalog', '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', 'EUR')).rejects.toThrow()
    await insertCatalog(database)
    await expect(insertRate(database, { unit: 'input_token', priceMicros: 1, currency: 'EUR' })).rejects.toThrow()
    await record(database, { executionKey: 'unknown', inputTokens: null, outputTokens: null, cachedInputReadTokens: null, cachedInputWriteTokens: null, result: 'timeout', reason: 'upstream_timeout', billingDisposition: 'unknown' })
    await record(database, { executionKey: 'not-billable', billingDisposition: 'not_billable', result: 'rejected', reason: 'trusted_not_billed' })
    expect(await ledger(database, 'unknown')).toMatchObject({ cost_kind: 'unavailable', cost_micros: null, billing_disposition: 'unknown', result: 'timeout' })
    expect(await ledger(database, 'not-billable')).toMatchObject({ cost_kind: 'calculated', cost_micros: 0, billing_disposition: 'not_billable', result: 'rejected' })
    await database.exec(`update public.academy_provider_usage_ledger set
      cost_kind = 'reconciled', cost_micros = 123456789, billing_disposition = 'billable',
      pricing_catalog_version = null, reconciliation_ref = 'invoice-line-1'
      where execution_key = 'unknown'`)
    expect(await ledger(database, 'unknown')).toMatchObject({ cost_kind: 'reconciled', reconciliation_ref: 'invoice-line-1', billing_disposition: 'billable' })
  })

  it('persists required and optional version snapshots without reconstruction', async () => {
    const database = databases[0]
    await record(database, { executionKey: 'versions', appVersion: 'app-9', engineVersion: 'tutor-4', curriculumVersion: 'math-r1-7' })
    expect(await ledger(database, 'versions')).toMatchObject({ app_version: 'app-9', engine_version: 'tutor-4', curriculum_version: 'math-r1-7' })
    await expect(record(database, { executionKey: 'missing-app', appVersion: '' })).rejects.toThrow(/invalid provider usage record/)
  })

  it('replays identical immutable facts and rejects conflicting facts for one execution key', async () => {
    const database = databases[0]
    const facts: UsageInput = { executionKey: 'same-execution', inputTokens: 5 }
    const first = await record(database, facts)
    await database.exec(`set timezone = 'America/Los_Angeles'`)
    const replay = await record(database, facts)
    expect(replay.rows[0].result).toEqual({ usageId: first.rows[0].result.usageId, idempotencyResult: 'replayed' })
    await expect(record(database, { ...facts, inputTokens: 6 })).rejects.toThrow(/reconciliation_conflict/)
  })

  it('transports IntegerMicros and rates as exact decimal strings beyond JS safe integers', async () => {
    const database = databases[0]
    await insertCatalog(database)
    await insertRate(database, { unit: 'input_token', priceMicros: 1_000_000_000, unitQuantity: 1 })
    await record(database, { executionKey: 'large-cost', inputTokens: 1_000_000_000 })
    const projection = await database.query<{ records: Array<Record<string, any>> }>(
      `select public.academy_read_provider_usage_costs(10, '2026-08-01T00:00:00Z') as records`,
    )
    const recordValue = projection.rows[0].records[0]
    expect(recordValue.costMicros).toBe('1000000000000000000')
    expect(recordValue.costComponents[0].rate.priceMicrosPerUnitSize).toBe('1000000000')
    expect(recordValue.costComponents[0].calculatedCostMicros).toBe('1000000000000000000')
  })

  it('keeps ledger tables and canonical read RPC unavailable to browser roles', async () => {
    const database = databases[0]
    await database.exec('set role authenticated;')
    await expect(database.query('select * from public.academy_provider_usage_ledger')).rejects.toThrow()
    await expect(database.query(`select public.academy_read_provider_usage_costs(10, now())`)).rejects.toThrow()
    await database.exec('reset role;')
  })

  it('uses half-up component rounding and makes catalogs/rates immutable', async () => {
    const database = databases[0]
    await insertCatalog(database)
    await insertRate(database, { unit: 'input_token', priceMicros: 1, unitQuantity: 2 })
    await record(database, { executionKey: 'rounding', inputTokens: 1 })
    expect(String((await ledger(database, 'rounding')).cost_micros)).toBe('1')
    await expect(database.exec(`update public.academy_provider_prices set price_micros = 2`)).rejects.toThrow(/immutable/)
    await expect(database.exec(`delete from public.academy_provider_pricing_catalogs`)).rejects.toThrow(/immutable/)
  })
})
