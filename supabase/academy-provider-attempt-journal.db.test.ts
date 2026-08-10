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
    create function auth.uid() returns uuid language sql stable set search_path = pg_catalog as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (id uuid primary key);
    create table public.academy_households (id uuid primary key, status text not null);
    create table public.academy_students (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id)
    );
    insert into auth.users (id) values ('${ACCOUNT_ID}');
    insert into public.academy_households (id, status)
      values ('${HOUSEHOLD_ID}', 'active');
  `)
  for (const name of [
    '20260808122000_academy_provider_usage_cost_ledger.sql',
    '20260810131000_academy_provider_attempt_journal.sql',
    '20260810151000_academy_study_safety_provider_accounting.sql',
  ]) {
    const migration = await readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8')
    await database.exec(migration)
  }
  await database.query(`select set_config('request.jwt.claim.role', 'service_role', false)`)
  await database.query(`select set_config('request.jwt.claim.sub', '', false)`)
  return database
}

type ReserveOverrides = Partial<{
  logicalOperationKey: string
  physicalRetryIndex: number
  operationalExecutionKey: string
  ledgerExecutionKey: string
  accountRef: string
  householdRef: string | null
  householdAttribution: string
  engine: string
  purpose: string
  appVersion: string
  engineVersion: string | null
  curriculumVersion: string | null
  provider: string
  providerProductId: string
  providerModelId: string
  logicalModelTier: string | null
  extraFacts: Record<string, unknown>
}>

function facts(key: string, overrides: ReserveOverrides = {}) {
  const tts = overrides.engine === 'tts' || overrides.provider === 'elevenlabs'
  return {
    schema_version: 1,
    logical_operation_key: overrides.logicalOperationKey ?? `operation.${key}`,
    physical_retry_index: overrides.physicalRetryIndex ?? 0,
    operational_execution_key: overrides.operationalExecutionKey ?? `telemetry.${key}`,
    ledger_execution_key: overrides.ledgerExecutionKey ?? `ledger_${key}`,
    account_id: overrides.accountRef ?? ACCOUNT_ID,
    household_id: overrides.householdRef === undefined ? HOUSEHOLD_ID : overrides.householdRef,
    household_attribution: overrides.householdAttribution ?? 'resolved',
    engine: overrides.engine ?? (tts ? 'tts' : 'tutor'),
    purpose: overrides.purpose ?? (tts ? 'tts_synthesis' : 'tutor_turn'),
    app_version: overrides.appVersion ?? 'academy.2026.08.10',
    engine_version: overrides.engineVersion === undefined ? (tts ? null : 'engine.v1') : overrides.engineVersion,
    curriculum_version: overrides.curriculumVersion ?? null,
    provider: overrides.provider ?? (tts ? 'elevenlabs' : 'anthropic'),
    provider_product_id: overrides.providerProductId ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    provider_model_id: overrides.providerModelId ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
    logical_model_tier: overrides.logicalModelTier === undefined ? (tts ? null : 'sonnet') : overrides.logicalModelTier,
    ...(overrides.extraFacts ?? {}),
  }
}

async function reserve(database: PGlite, key: string, overrides: ReserveOverrides = {}) {
  return database.query<{ result: { status: string; attemptId: string; state: string } }>(
    `select public.academy_reserve_provider_attempt_v1($1, $2::jsonb) as result`,
    [`reserve.${key}`, JSON.stringify(facts(key, overrides))],
  )
}

async function transition(
  database: PGlite,
  attemptId: string,
  key: string,
  state: string,
  result: string | null = null,
  reason: string | null = null,
  reconciliationRef: string | null = null,
) {
  return database.query<{ result: { status: string; attemptId: string; state: string } }>(
    `select public.academy_transition_provider_attempt_v1($1,$2,$3,$4,$5,$6) as result`,
    [attemptId, `transition.${key}`, state, result, reason, reconciliationRef],
  )
}

async function linkLedger(database: PGlite, attemptId: string, key: string) {
  return database.query<{ result: { status: string; attemptId: string; state: string } }>(
    `select public.academy_link_provider_attempt_ledger_v1($1,$2) as result`,
    [attemptId, `transition.${key}`],
  )
}

async function recordLedger(database: PGlite, executionKey: string, overrides: ReserveOverrides = {}) {
  const tts = overrides.engine === 'tts' || overrides.provider === 'elevenlabs'
  return database.query(
    `select public.academy_record_provider_usage(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    )`,
    [
      executionKey,
      new Date(Date.now() + 1_000).toISOString(),
      overrides.accountRef ?? ACCOUNT_ID,
      overrides.householdRef === undefined ? HOUSEHOLD_ID : overrides.householdRef,
      overrides.householdAttribution ?? 'resolved',
      overrides.appVersion ?? 'academy.2026.08.10',
      overrides.engineVersion === undefined ? (tts ? null : 'engine.v1') : overrides.engineVersion,
      overrides.curriculumVersion ?? null,
      overrides.engine ?? (tts ? 'tts' : 'tutor'),
      overrides.provider ?? (tts ? 'elevenlabs' : 'anthropic'),
      overrides.providerProductId ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      overrides.providerModelId ?? (tts ? 'eleven_turbo_v2_5' : 'claude-sonnet-4-6'),
      overrides.logicalModelTier === undefined ? (tts ? null : 'sonnet') : overrides.logicalModelTier,
      tts ? null : 0,
      tts ? null : 0,
      tts ? null : 0,
      tts ? null : 0,
      tts ? 0 : null,
      10,
      'success',
      null,
      'billable',
    ],
  )
}

async function states(database: PGlite, attemptId: string) {
  const result = await database.query<{ to_state: string }>(
    `select to_state from public.academy_provider_attempt_transitions
     where attempt_id = $1 order by sequence`,
    [attemptId],
  )
  return result.rows.map((row) => row.to_state)
}

async function readyOutcome(database: PGlite, key: string, overrides: ReserveOverrides = {}) {
  const receipt = await reserve(database, key, overrides)
  const attemptId = receipt.rows[0].result.attemptId
  await transition(database, attemptId, `${key}.dispatch`, 'dispatch_possible')
  await transition(database, attemptId, `${key}.outcome`, 'outcome_observed', 'success')
  return attemptId
}

beforeEach(createDatabase)
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('Academy Provider Attempt Journal foundation', () => {
  it('reserves before dispatch and records outcome plus authoritative ledger linkage', async () => {
    const database = databases[0]
    const attemptId = await readyOutcome(database, 'happy')
    await recordLedger(database, 'ledger_happy')
    await expect(linkLedger(database, attemptId, 'happy.ledger')).resolves.toMatchObject({
      rows: [{ result: { status: 'created', attemptId, state: 'ledgered' } }],
    })
    expect(await states(database, attemptId)).toEqual([
      'reserved', 'dispatch_possible', 'outcome_observed', 'ledgered',
    ])
    const link = await database.query(
      `select attempt_id, usage_id from public.academy_provider_attempt_ledger_links`,
    )
    expect(link.rows).toHaveLength(1)
  })

  it('records a missing ledger gap and supports explicit reconciliation or unresolvable closure', async () => {
    const database = databases[0]
    const reconciledId = await readyOutcome(database, 'gap-reconciled')
    await expect(linkLedger(database, reconciledId, 'gap-reconciled.link')).resolves.toMatchObject({
      rows: [{ result: { state: 'gap_pending' } }],
    })
    await transition(
      database, reconciledId, 'gap-reconciled.resolve', 'reconciled', null,
      'external_coverage_verified', 'reconciliation.case-1',
    )
    expect(await states(database, reconciledId)).toEqual([
      'reserved', 'dispatch_possible', 'outcome_observed', 'gap_pending', 'reconciled',
    ])

    const unresolvableId = await readyOutcome(database, 'gap-unresolvable')
    await linkLedger(database, unresolvableId, 'gap-unresolvable.link')
    await transition(
      database, unresolvableId, 'gap-unresolvable.close', 'unresolvable', null,
      'evidence_expired', null,
    )
    expect((await states(database, unresolvableId)).at(-1)).toBe('unresolvable')

    const lateLedgerId = await readyOutcome(database, 'gap-late-ledger')
    await linkLedger(database, lateLedgerId, 'gap-late-ledger.missing')
    await recordLedger(database, 'ledger_gap-late-ledger')
    await linkLedger(database, lateLedgerId, 'gap-late-ledger.linked')
    expect((await states(database, lateLedgerId)).at(-1)).toBe('ledgered')
  })

  it('confirms a reserved or dispatch-possible attempt was not dispatched', async () => {
    const database = databases[0]
    const first = await reserve(database, 'not-dispatched-reserved')
    const firstId = first.rows[0].result.attemptId
    await transition(
      database, firstId, 'not-dispatched-reserved.close',
      'confirmed_not_dispatched', null, 'validation_failed_before_dispatch',
    )
    const second = await reserve(database, 'not-dispatched-ready')
    const secondId = second.rows[0].result.attemptId
    await transition(database, secondId, 'not-dispatched-ready.dispatch', 'dispatch_possible')
    await transition(
      database, secondId, 'not-dispatched-ready.close',
      'confirmed_not_dispatched', null, 'provider_call_not_started',
    )
    expect((await states(database, firstId)).at(-1)).toBe('confirmed_not_dispatched')
    expect((await states(database, secondId)).at(-1)).toBe('confirmed_not_dispatched')
  })

  it('rejects invalid transitions and normalized-evidence violations', async () => {
    const database = databases[0]
    const receipt = await reserve(database, 'invalid-transition')
    const attemptId = receipt.rows[0].result.attemptId
    await expect(transition(
      database, attemptId, 'invalid-transition.outcome', 'outcome_observed', 'success',
    )).rejects.toThrow(/STATE_TRANSITION_INVALID/)
    await transition(database, attemptId, 'invalid-transition.dispatch', 'dispatch_possible')
    await expect(transition(
      database, attemptId, 'invalid-transition.bad-reason', 'outcome_observed',
      'success', 'raw provider error body',
    )).rejects.toThrow(/TRANSITION_INVALID/)
  })

  it('replays the same physical attempt and prevents duplicate or conflicting reservations', async () => {
    const database = databases[0]
    const first = await reserve(database, 'replay')
    await transition(
      database, first.rows[0].result.attemptId, 'replay.dispatch', 'dispatch_possible',
    )
    const replay = await reserve(database, 'replay')
    expect(replay.rows[0].result).toEqual({
      ...first.rows[0].result,
      status: 'replayed',
      state: 'dispatch_possible',
    })
    await expect(reserve(database, 'replay-conflict', {
      logicalOperationKey: 'operation.replay',
      operationalExecutionKey: 'telemetry.replay-conflict',
      ledgerExecutionKey: 'ledger_replay-conflict',
    })).rejects.toThrow(/reconciliation_conflict/)
    const count = await database.query(`select count(*)::integer as count from public.academy_provider_attempts`)
    expect(count.rows).toEqual([{ count: 1 }])
  })

  it('uses one attempt per physical retry while preserving one logical operation', async () => {
    const database = databases[0]
    const retry0 = await reserve(database, 'physical-0', {
      logicalOperationKey: 'operation.physical', physicalRetryIndex: 0,
    })
    const retry1 = await reserve(database, 'physical-1', {
      logicalOperationKey: 'operation.physical', physicalRetryIndex: 1,
    })
    expect(retry1.rows[0].result.attemptId).not.toBe(retry0.rows[0].result.attemptId)
    const rows = await database.query(
      `select logical_operation_key, physical_retry_index
       from public.academy_provider_attempts order by physical_retry_index`,
    )
    expect(rows.rows).toEqual([
      { logical_operation_key: 'operation.physical', physical_retry_index: 0 },
      { logical_operation_key: 'operation.physical', physical_retry_index: 1 },
    ])
  })

  it('links Study safety only as study/safety_classification', async () => {
    const database = databases[0]
    const study = {
      engine: 'study', purpose: 'safety_classification', logicalModelTier: 'haiku',
      engineVersion: 'study.v1',
    }
    const attemptId = await readyOutcome(database, 'study-safety', study)
    await recordLedger(database, 'ledger_study-safety', study)
    await linkLedger(database, attemptId, 'study-safety.link')
    const row = await database.query(
      `select engine, purpose, logical_model_tier from public.academy_provider_attempts
       where attempt_id = $1`,
      [attemptId],
    )
    expect(row.rows).toEqual([{
      engine: 'study', purpose: 'safety_classification', logical_model_tier: 'haiku',
    }])
    expect((await states(database, attemptId)).at(-1)).toBe('ledgered')
    const usage = await database.query(
      `select engine, purpose, logical_model_tier from public.academy_provider_usage_ledger
       where execution_key = 'ledger_study-safety'`,
    )
    expect(usage.rows).toEqual([{
      engine: 'study', purpose: 'safety_classification', logical_model_tier: 'haiku',
    }])
    await expect(reserve(database, 'study-mislabeled', {
      engine: 'tutor', purpose: 'safety_classification', logicalModelTier: 'haiku',
    })).rejects.toThrow(/DIMENSIONS_INVALID/)
  })

  it('denies browser writes/reads and preserves all journal evidence append-only', async () => {
    const database = databases[0]
    const receipt = await reserve(database, 'authorization')
    const attemptId = receipt.rows[0].result.attemptId
    await database.query(`select set_config('request.jwt.claim.role', 'authenticated', false)`)
    await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ACCOUNT_ID])
    await database.exec(`set role authenticated`)
    await expect(database.query(`select * from public.academy_provider_attempts`)).rejects.toThrow()
    await expect(reserve(database, 'forged-browser')).rejects.toThrow(
      /permission denied|TRUSTED_SERVER_REQUIRED/,
    )
    await expect(database.query(`
      select public.academy_read_provider_attempt_coverage_v1(
        clock_timestamp() - interval '1 day',
        clock_timestamp() + interval '1 day',
        'costs:read'
      )
    `)).rejects.toThrow(/permission denied|ADMIN_READ_REQUIRED/)
    await database.exec(`reset role`)
    await database.query(`select set_config('request.jwt.claim.role', 'service_role', false)`)
    await database.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await expect(database.query(
      `update public.academy_provider_attempts set purpose = 'jarvis_turn' where attempt_id = $1`,
      [attemptId],
    )).rejects.toThrow(/append-only/)
    await expect(database.query(
      `delete from public.academy_provider_attempt_transitions where attempt_id = $1`,
      [attemptId],
    )).rejects.toThrow(/append-only/)
  })

  it('stores only minimized accounting metadata and rejects extra content-shaped facts', async () => {
    const database = databases[0]
    await expect(reserve(database, 'privacy', {
      extraFacts: { prompt: 'private learner content' },
    })).rejects.toThrow(/RESERVATION_INVALID/)
    const forbidden = await database.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in (
          'academy_provider_attempts',
          'academy_provider_attempt_transitions',
          'academy_provider_attempt_ledger_links'
        )
        and column_name ~ '(prompt|response|transcript|answer|audio|journal|note|emotion|personality|diagnos|secret|raw)'
    `)
    expect(forbidden.rows).toEqual([])
  })

  it('detects dimension conflicts and never links a mismatched cost-ledger row', async () => {
    const database = databases[0]
    const attemptId = await readyOutcome(database, 'mismatch')
    await recordLedger(database, 'ledger_mismatch', { providerProductId: 'different-product' })
    await expect(linkLedger(database, attemptId, 'mismatch.link')).resolves.toMatchObject({
      rows: [{ result: { state: 'reconciliation_conflict' } }],
    })
    expect((await states(database, attemptId)).at(-1)).toBe('reconciliation_conflict')
    const links = await database.query(`select * from public.academy_provider_attempt_ledger_links`)
    expect(links.rows).toEqual([])
  })

  it('projects coverage gaps and orphan ledger rows without claiming invoice completeness', async () => {
    const database = databases[0]
    const linkedId = await readyOutcome(database, 'coverage-linked')
    await recordLedger(database, 'ledger_coverage-linked')
    await linkLedger(database, linkedId, 'coverage-linked.link')
    const gapId = await readyOutcome(database, 'coverage-gap')
    await linkLedger(database, gapId, 'coverage-gap.link')
    await recordLedger(database, 'ledger_coverage-orphan')
    const projection = await database.query<{ coverage: Record<string, any> }>(`
      select public.academy_read_provider_attempt_coverage_v1(
        clock_timestamp() - interval '1 day',
        clock_timestamp() + interval '1 day',
        'costs:read'
      ) as coverage
    `)
    expect(projection.rows[0].coverage).toMatchObject({
      coverageStatus: 'attention_required',
      recordedProviderAttempts: 2,
      ledgerLinkedAttempts: 1,
      journaledMissingLedgerRelationship: 1,
      ledgerRowsWithoutJournalRelationship: 1,
      invoiceCompletenessClaim: false,
      costAuthority: 'academy_provider_usage_ledger',
      states: { ledgered: 1, gapPending: 1 },
      breakdowns: {
        engines: [{
          key: 'tutor', recordedProviderAttempts: 2, ledgerLinkedAttempts: 1,
          journaledMissingLedgerRelationship: 1,
          states: { ledgered: 1, gapPending: 1 },
        }],
        purposes: [{
          key: 'tutor_turn', recordedProviderAttempts: 2, ledgerLinkedAttempts: 1,
          journaledMissingLedgerRelationship: 1,
        }],
        providers: [{
          key: 'anthropic', recordedProviderAttempts: 2, ledgerLinkedAttempts: 1,
          journaledMissingLedgerRelationship: 1,
        }],
      },
    })
  })

  it('returns insufficient raw evidence and empty safe dimensions for an empty range', async () => {
    const projection = await databases[0].query<{ coverage: Record<string, any> }>(`
      select public.academy_read_provider_attempt_coverage_v1(
        clock_timestamp() - interval '1 day',
        clock_timestamp() + interval '1 day',
        'costs:read'
      ) as coverage
    `)
    expect(projection.rows[0].coverage).toMatchObject({
      coverageStatus: 'no_data',
      recordedProviderAttempts: 0,
      ledgerLinkedAttempts: 0,
      breakdowns: { engines: [], purposes: [], providers: [] },
      invoiceCompletenessClaim: false,
    })
  })
})
