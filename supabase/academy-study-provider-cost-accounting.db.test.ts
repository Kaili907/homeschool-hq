import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OWNER_ID = '00000000-0000-4000-8000-000000000101'
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
    create table public.academy_operational_events (
      event_id uuid primary key default gen_random_uuid(),
      occurred_at timestamptz not null,
      expires_at timestamptz not null,
      engine text not null,
      event_type text not null,
      metadata jsonb not null
    );
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users (id) values ('${OWNER_ID}'), ('${ACCOUNT_ID}');
    insert into public.academy_households (id, status)
    values ('${HOUSEHOLD_ID}', 'active');
  `)
  for (const migration of [
    '20260808120000_academy_admin_authorization.sql',
    '20260808122000_academy_provider_usage_cost_ledger.sql',
  ]) {
    await database.exec(await readFile(new URL(`./migrations/${migration}`, import.meta.url), 'utf8'))
  }
  await database.exec(await readFile(
    new URL('./migrations/20260809121000_academy_provider_usage_cost_aggregate.sql', import.meta.url),
    'utf8',
  ))
  await database.exec(`
    create function academy_private.operational_is_trusted_server()
    returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select auth.uid() is null
        and current_setting('request.jwt.claim.role', true) = 'service_role'
    $$;
    insert into public.academy_admin_role_assignments
      (user_id, role, assignment_reason_code)
    values ('${OWNER_ID}', 'owner', 'admin.bootstrap');
  `)
  for (const migration of [
    '20260809130000_academy_admin_audit_foundation.sql',
    '20260810120300_academy_provider_pricing_terms.sql',
    '20260810141000_academy_study_provider_cost_accounting.sql',
  ]) {
    await database.exec(await readFile(new URL(`./migrations/${migration}`, import.meta.url), 'utf8'))
  }
  return database
}

type TermInput = {
  unit?: 'input_token' | 'output_token' | 'cached_input_read_token' | 'request'
  priceMicros?: string
  unitSize?: string
  effectiveFrom?: string
  effectiveUntil?: string | null
}

function termValues(input: TermInput = {}) {
  return [
    'anthropic',
    'claude-haiku-4-5',
    'claude-haiku-4-5',
    'haiku',
    input.unit ?? 'input_token',
    input.priceMicros ?? '2500',
    input.unitSize ?? '1000000',
    input.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
    input.effectiveUntil === undefined ? null : input.effectiveUntil,
    null,
    'invoice:verified-study-test',
    'configuration.changed',
  ]
}

async function createTerm(database: PGlite, input: TermInput = {}) {
  confirmationCounter += 1
  const digest = confirmationCounter.toString(16).padStart(64, '0')
  const change = await asRole(database, 'authenticated', OWNER_ID, () => database.query<{ result: any }>(`
    select public.academy_admin_preview_provider_pricing_term_v1(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'configuration:manage'
    ) as result
  `, [...termValues(input), digest]))
  return (await asRole(database, 'authenticated', OWNER_ID, () => database.query<{ result: any }>(`
    select public.academy_admin_commit_provider_pricing_term_v1(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'configuration:manage'
    ) as result
  `, [
    ...termValues(input),
    change.rows[0].result.expectedRevision,
    randomUUID(),
    digest,
  ]))).rows[0].result
}

type UsageInput = {
  executionKey: string
  occurredAt?: string
  engine?: string
  purpose?: string | null
  provider?: string
  product?: string
  model?: string
  tier?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputReadTokens?: number | null
  cachedInputWriteTokens?: number | null
  ttsCharacters?: number | null
  latencyMs?: number
  result?: string
  reason?: string | null
  billingDisposition?: string
}

async function record(database: PGlite, input: UsageInput) {
  const engine = input.engine ?? 'study'
  const tts = engine === 'tts'
  const study = engine === 'study'
  return asRole(database, 'service_role', null, () => database.query<{
    result: { usageId: string; idempotencyResult: string }
  }>(`
    select public.academy_record_provider_usage_v2(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
    ) as result
  `, [
    input.executionKey,
    input.occurredAt ?? '2026-06-15T12:00:00.000Z',
    ACCOUNT_ID,
    HOUSEHOLD_ID,
    'resolved',
    'academy-build-study-test',
    study ? 'study-safety-v1' : tts ? null : `${engine}-v1`,
    null,
    engine,
    input.purpose === undefined ? (study ? 'safety_classification' : null) : input.purpose,
    input.provider ?? (tts ? 'elevenlabs' : 'anthropic'),
    input.product ?? (study ? 'claude-haiku-4-5' : tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.model ?? (study ? 'claude-haiku-4-5' : tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    input.tier === undefined ? (tts ? null : study ? 'haiku' : 'sonnet') : input.tier,
    input.inputTokens === undefined ? (tts ? null : 10) : input.inputTokens,
    input.outputTokens === undefined ? (tts ? null : 4) : input.outputTokens,
    input.cachedInputReadTokens === undefined ? (tts ? null : 2) : input.cachedInputReadTokens,
    input.cachedInputWriteTokens === undefined ? (tts ? null : 0) : input.cachedInputWriteTokens,
    input.ttsCharacters === undefined ? (tts ? 10 : null) : input.ttsCharacters,
    input.latencyMs ?? 25,
    input.result ?? 'success',
    input.reason === undefined ? null : input.reason,
    input.billingDisposition ?? 'billable',
  ]))
}

async function ledger(database: PGlite, executionKey: string) {
  return (await database.query<any>(`
    select * from public.academy_provider_usage_ledger where execution_key = $1
  `, [executionKey])).rows[0]
}

beforeEach(async () => {
  confirmationCounter = 0
  await createDatabase()
})
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('Study safety provider cost accounting admission', () => {
  it('admits only the exact Study safety Anthropic dimensions and inserts no price', async () => {
    const database = databases[0]
    expect((await database.query(`select count(*)::text as count
      from academy_private.provider_pricing_terms`)).rows).toEqual([{ count: '0' }])
    const result = await record(database, { executionKey: 'study-safety-accepted' })
    expect(result.rows[0].result.idempotencyResult).toBe('created')
    expect(await ledger(database, 'study-safety-accepted')).toMatchObject({
      engine: 'study',
      purpose: 'safety_classification',
      provider: 'anthropic',
      provider_product_id: 'claude-haiku-4-5',
      provider_model_id: 'claude-haiku-4-5',
      logical_model_tier: 'haiku',
      request_count: 1,
      learner_id: null,
    })
    await expect(database.exec(`update public.academy_provider_usage_ledger
      set purpose = 'tutor_completion'
      where execution_key = 'study-safety-accepted'`)).rejects.toThrow()
  })

  it('flows through the existing aggregate as Study without relabeling', async () => {
    const database = databases[0]
    await record(database, {
      executionKey: 'study-aggregate', billingDisposition: 'not_billable',
    })
    const response = await asRole(database, 'service_role', null, () => database.query<{
      aggregate: any
    }>(`
      select public.academy_aggregate_provider_usage_costs_v1(
        '2026-06-01T00:00:00Z','2026-07-01T00:00:00Z','costs:read',384
      ) as aggregate
    `))
    expect(response.rows[0].aggregate.groups).toContainEqual(expect.objectContaining({
      dimension: 'engine', key: 'study', records: '1',
    }))
  })

  it.each([
    ['unsupported purpose', { purpose: 'tutor_completion' }],
    ['missing purpose', { purpose: null }],
    ['wrong engine', { engine: 'gateway', purpose: 'safety_classification' }],
    ['wrong provider', { provider: 'elevenlabs' }],
    ['malformed product', { product: ' claude-haiku-4-5' }],
    ['missing logical tier', { tier: null }],
  ])('rejects %s instead of widening bounded dimensions', async (_label, overrides) => {
    await expect(record(databases[0], {
      executionKey: `invalid-${String(_label).replaceAll(' ', '-')}`,
      ...overrides,
    })).rejects.toThrow(/invalid provider usage record/)
  })

  it('uses exact effective-dated terms and component-wise IntegerMicros arithmetic', async () => {
    const database = databases[0]
    const created = await createTerm(database, { priceMicros: '1001', unitSize: '100' })
    const lookup = await database.query<{ result: any }>(`
      select academy_private.lookup_provider_pricing_term_v1(
        'anthropic','claude-haiku-4-5','claude-haiku-4-5','haiku',
        'input_token','2026-06-15T12:00:00Z'
      ) as result
    `)
    expect(lookup.rows[0].result).toMatchObject({
      status: 'configured', termId: created.termId,
      priceMicrosPerUnitSize: '1001', unitSize: '100',
    })
    await record(database, {
      executionKey: 'study-exact-money',
      inputTokens: 333,
      outputTokens: 0,
      cachedInputReadTokens: 0,
    })
    const row = await ledger(database, 'study-exact-money')
    expect(row).toMatchObject({ cost_kind: 'calculated', pricing_authority: 'provider_pricing_terms_v1' })
    expect(String(row.cost_micros)).toBe('3333')
    const snapshot = (await database.query<any>(`
      select pricing_term_id, pricing_term_revision::text, price_micros::text,
        unit_quantity::text, quantity::text, calculated_cost_micros::text
      from public.academy_provider_usage_cost_components
      where usage_id = $1
    `, [row.id])).rows[0]
    expect(snapshot).toEqual({
      pricing_term_id: created.termId,
      pricing_term_revision: '1',
      price_micros: '1001',
      unit_quantity: '100',
      quantity: '333',
      calculated_cost_micros: '3333',
    })
    await expect(database.exec(`update academy_private.provider_pricing_terms
      set price_micros = 999 where term_id = '${created.termId}'`)).rejects.toThrow(/safe end|immutable/)
  })

  it('keeps missing pricing unavailable and never recomputes a historical row', async () => {
    const database = databases[0]
    await record(database, { executionKey: 'study-before-pricing' })
    expect(await ledger(database, 'study-before-pricing')).toMatchObject({
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    })
    await record(database, {
      executionKey: 'study-zero-before-pricing',
      inputTokens: 0,
      outputTokens: 0,
      cachedInputReadTokens: 0,
      cachedInputWriteTokens: 0,
    })
    expect(await ledger(database, 'study-zero-before-pricing')).toMatchObject({
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    })
    await createTerm(database)
    expect(await ledger(database, 'study-before-pricing')).toMatchObject({
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    })
    expect(await ledger(database, 'study-zero-before-pricing')).toMatchObject({
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    })
  })

  it('keeps positive cache-write usage unavailable without inventing TTL economics', async () => {
    const database = databases[0]
    for (const unit of ['input_token', 'output_token', 'cached_input_read_token'] as const) {
      await createTerm(database, { unit, priceMicros: '1', unitSize: '1' })
    }
    await record(database, {
      executionKey: 'study-cache-write-unsupported',
      inputTokens: 1,
      outputTokens: 1,
      cachedInputReadTokens: 1,
      cachedInputWriteTokens: 1,
    })
    expect(await ledger(database, 'study-cache-write-unsupported')).toMatchObject({
      cost_kind: 'unavailable', cost_micros: null, pricing_authority: null,
    })
    expect((await database.query(`select count(*)::text as count
      from public.academy_provider_usage_cost_components`)).rows).toEqual([{ count: '0' }])
  })

  it('replays identical physical-attempt facts and rejects conflicting reuse', async () => {
    const database = databases[0]
    const first = await record(database, { executionKey: 'study-attempt-replay' })
    const replay = await record(database, { executionKey: 'study-attempt-replay' })
    expect(replay.rows[0].result).toEqual({
      usageId: first.rows[0].result.usageId,
      idempotencyResult: 'replayed',
    })
    await expect(record(database, {
      executionKey: 'study-attempt-replay', inputTokens: 11,
    })).rejects.toThrow(/reconciliation_conflict/)
    expect((await database.query(`select count(*)::text as count
      from public.academy_provider_usage_ledger`)).rows).toEqual([{ count: '1' }])
  })

  it('delegates Tutor, Jarvis, and TTS to the unchanged v1 contract', async () => {
    const database = databases[0]
    await record(database, {
      executionKey: 'legacy-tutor', engine: 'tutor', billingDisposition: 'not_billable',
    })
    await record(database, {
      executionKey: 'legacy-jarvis', engine: 'jarvis', billingDisposition: 'not_billable',
    })
    await record(database, {
      executionKey: 'legacy-tts', engine: 'tts', billingDisposition: 'not_billable',
    })
    expect((await database.query<any>(`
      select execution_key, engine, purpose, provider, cost_kind, cost_micros::text
      from public.academy_provider_usage_ledger order by execution_key
    `)).rows).toEqual([
      { execution_key: 'legacy-jarvis', engine: 'jarvis', purpose: null, provider: 'anthropic', cost_kind: 'calculated', cost_micros: '0' },
      { execution_key: 'legacy-tts', engine: 'tts', purpose: null, provider: 'elevenlabs', cost_kind: 'calculated', cost_micros: '0' },
      { execution_key: 'legacy-tutor', engine: 'tutor', purpose: null, provider: 'anthropic', cost_kind: 'calculated', cost_micros: '0' },
    ])
  })

  it('exposes no classifier content, output, raw provider data, or diagnostic field', async () => {
    const database = databases[0]
    const columns = (await database.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'academy_provider_usage_ledger'
    `)).rows.map((row) => row.column_name)
    const argumentsResult = await database.query<{ arguments: string }>(`
      select pg_get_function_arguments(
        'public.academy_record_provider_usage_v2(text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,text,text,text,bigint,bigint,bigint,bigint,bigint,integer,text,text,text)'::regprocedure
      ) as arguments
    `)
    const contract = `${columns.join(' ')} ${argumentsResult.rows[0].arguments}`
    expect(contract).not.toMatch(
      /classifier_input|classifier_output|learner_content|private_notes|safety_text|prompt|response|raw_provider_data|raw_error|diagnostic_inference|secret/i,
    )
  })

  it('keeps the v2 seam service-only and returns the ledger usageId for future journal linkage', async () => {
    const database = databases[0]
    await expect(asRole(database, 'authenticated', ACCOUNT_ID, () => database.query(`
      select public.academy_record_provider_usage_v2(
        'denied','2026-06-15', '${ACCOUNT_ID}', '${HOUSEHOLD_ID}', 'resolved',
        'app','study-v1',null,'study','safety_classification','anthropic',
        'claude-haiku-4-5','claude-haiku-4-5','haiku',1,1,0,0,null,1,
        'success',null,'billable'
      )
    `))).rejects.toThrow()
    const created = await record(database, { executionKey: 'future-journal-seam' })
    expect(created.rows[0].result.usageId).toBe(
      (await ledger(database, 'future-journal-seam')).id,
    )
  })
})
