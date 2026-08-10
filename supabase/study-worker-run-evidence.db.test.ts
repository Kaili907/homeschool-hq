import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const MIGRATION = './migrations/20260810159000_academy_study_worker_run_evidence.sql'
const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql',
  './migrations/20260810152100_academy_study_worker_operations_contract.sql',
  MIGRATION,
] as const

const WORKER = 'worker:run-evidence-synthetic'
const WORKER_CREDENTIAL = 'synthetic-worker-run-evidence-credential'
const WORKER_CONFIGURATION_VERSION = 'worker-config-run-evidence-v1'
const WORKER_CREDENTIAL_VERSION = 'credential-run-evidence-v1'
const GUARDIAN = '00000000-0000-0000-0000-0000000000a1'

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

interface RunReceipt {
  runId: string
  startedAt: string
  completedAt: string
  resultCategory: 'no_work' | 'processed' | 'partial_with_retryable_failures' | 'failed' | 'unavailable'
  claimedCount: number
  processedCount: number
  retryableFailureCount: number
  terminalFailureCount: number
  invocationKind: 'scheduled' | 'manual'
  reasonCode: 'no-work' | 'completed' | 'retryable-failures' | 'systemic-failure' | 'dependency-unavailable'
}

let database: PGlite
const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))

function runId(suffix: number) {
  return `00000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`
}

function receipt(overrides: Partial<RunReceipt> = {}): RunReceipt {
  return {
    runId: runId(1),
    startedAt: '2026-08-10T12:00:00.000Z',
    completedAt: '2026-08-10T12:00:01.000Z',
    resultCategory: 'processed',
    claimedCount: 1,
    processedCount: 1,
    retryableFailureCount: 0,
    terminalFailureCount: 0,
    invocationKind: 'scheduled',
    reasonCode: 'completed',
    ...overrides,
  }
}

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(subject ? { sub: subject, role } : { role })
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await operation()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function asWorker<T>(operation: () => Promise<T>, credential = WORKER_CREDENTIAL) {
  await database.exec(`
    select set_config('academy.study_worker_credential', '${credential}', false);
    select set_config(
      'academy.study_worker_configuration_version',
      '${WORKER_CONFIGURATION_VERSION}',
      false
    );
    select set_config(
      'academy.study_worker_credential_version',
      '${WORKER_CREDENTIAL_VERSION}',
      false
    );
  `)
  try {
    return await asRole('service_role', null, operation)
  } finally {
    await database.exec(`
      select set_config('academy.study_worker_credential', '', false);
      select set_config('academy.study_worker_configuration_version', '', false);
      select set_config('academy.study_worker_credential_version', '', false);
    `)
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function record(run: RunReceipt) {
  return asWorker(() => rpc<{ recorded: boolean; replayed: boolean }>(
    'select public.academy_study_record_adult_review_worker_run_v1($1, $2::jsonb) as result',
    [WORKER, JSON.stringify(run)],
  ))
}

function status(observedAt: string) {
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_adult_review_worker_status_v1($1::timestamptz) as result',
    [observedAt],
  ))
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  const sources = await sql
  for (const [index, migration] of sources.entries()) {
    try {
      await database.exec(migration)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
}, 180_000)

beforeEach(async () => {
  await database.exec(`
    delete from academy_private.study_adult_review_worker_runs;
    delete from academy_private.study_adult_review_worker_registry
    where worker_id = '${WORKER}';
    insert into academy_private.study_adult_review_worker_registry (
      worker_id, status, configuration_version, credential_version,
      authorized_scopes, credential_digest, effective_at, expires_at, rotated_at
    ) values (
      '${WORKER}', 'active', '${WORKER_CONFIGURATION_VERSION}',
      '${WORKER_CREDENTIAL_VERSION}', array['monitoring'],
      academy_private.study_sha256_json(
        jsonb_build_object('credential', '${WORKER_CREDENTIAL}')
      ),
      '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
    );
  `)
})

afterAll(async () => database?.close())

describe.sequential('Study adult-review worker run evidence database contract', () => {
  it('installs a forced-RLS private receipt table and narrow service-only RPCs', async () => {
    const result = await database.query<{
      version: number
      marker: string
      forced: boolean
      tableGrants: number
      serviceWrite: boolean
      serviceRead: boolean
      authenticatedWrite: boolean
      authenticatedRead: boolean
      anonWrite: boolean
      anonRead: boolean
    }>(`
      select
        metadata.worker_run_evidence_version as version,
        metadata.migration_names[array_length(metadata.migration_names, 1)] as marker,
        relation.relrowsecurity and relation.relforcerowsecurity as forced,
        (select count(*)::integer from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name = 'study_adult_review_worker_runs'
            and grantee in ('anon', 'authenticated', 'service_role')) as "tableGrants",
        has_function_privilege('service_role',
          'public.academy_study_record_adult_review_worker_run_v1(text,jsonb)', 'execute') as "serviceWrite",
        has_function_privilege('service_role',
          'public.academy_study_adult_review_worker_status_v1(timestamptz)', 'execute') as "serviceRead",
        has_function_privilege('authenticated',
          'public.academy_study_record_adult_review_worker_run_v1(text,jsonb)', 'execute') as "authenticatedWrite",
        has_function_privilege('authenticated',
          'public.academy_study_adult_review_worker_status_v1(timestamptz)', 'execute') as "authenticatedRead",
        has_function_privilege('anon',
          'public.academy_study_record_adult_review_worker_run_v1(text,jsonb)', 'execute') as "anonWrite",
        has_function_privilege('anon',
          'public.academy_study_adult_review_worker_status_v1(timestamptz)', 'execute') as "anonRead"
      from academy_private.study_persistence_metadata as metadata
      join pg_catalog.pg_class as relation on relation.relname = 'study_adult_review_worker_runs'
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
        and namespace.nspname = 'academy_private'
      where metadata.singleton
    `)
    expect(result.rows).toEqual([{
      version: 1,
      marker: '20260810159000_academy_study_worker_run_evidence',
      forced: true,
      tableGrants: 0,
      serviceWrite: true,
      serviceRead: true,
      authenticatedWrite: false,
      authenticatedRead: false,
      anonWrite: false,
      anonRead: false,
    }])
  })

  it('records scheduled/manual invocations and every preserved result category', async () => {
    const runs: RunReceipt[] = [
      receipt({ runId: runId(1), resultCategory: 'no_work', claimedCount: 0,
        processedCount: 0, reasonCode: 'no-work' }),
      receipt({ runId: runId(2), invocationKind: 'manual' }),
      receipt({ runId: runId(3), resultCategory: 'partial_with_retryable_failures',
        claimedCount: 3, processedCount: 2, retryableFailureCount: 1,
        reasonCode: 'retryable-failures' }),
      receipt({ runId: runId(4), resultCategory: 'failed', claimedCount: 2,
        processedCount: 0, retryableFailureCount: 2, reasonCode: 'retryable-failures' }),
      receipt({ runId: runId(5), resultCategory: 'unavailable', claimedCount: 0,
        processedCount: 0, reasonCode: 'dependency-unavailable' }),
      receipt({ runId: runId(6), claimedCount: 1, processedCount: 0,
        terminalFailureCount: 1 }),
    ]
    for (const run of runs) expect(await record(run)).toEqual({ recorded: true, replayed: false })

    const result = await database.query<{
      result: string
      kind: string
      claimed: number
      processed: number
      retryable: number
      terminal: number
    }>(`
      select result_category as result, invocation_kind as kind,
        claimed_count as claimed, processed_count as processed,
        retryable_failure_count as retryable, terminal_failure_count as terminal
      from academy_private.study_adult_review_worker_runs
      order by run_id
    `)
    expect(result.rows.map((row) => row.result)).toEqual([
      'no_work', 'processed', 'partial_with_retryable_failures',
      'failed', 'unavailable', 'processed',
    ])
    expect(result.rows[1].kind).toBe('manual')
    expect(result.rows[5]).toMatchObject({ claimed: 1, processed: 0, terminal: 1 })
  })

  it('replays the same invocation idempotently, rejects changed replay data, and keeps distinct runs', async () => {
    const first = receipt()
    expect(await record(first)).toEqual({ recorded: true, replayed: false })
    expect(await record(first)).toEqual({ recorded: true, replayed: true })
    await expect(record({ ...first, completedAt: '2026-08-10T12:00:02.000Z' }))
      .rejects.toThrow(/STUDY_WORKER_RUN_REPLAY_CONFLICT/)
    expect(await record({ ...first, runId: runId(2) }))
      .toEqual({ recorded: true, replayed: false })
    const count = await database.query<{ count: number }>(
      'select count(*)::integer as count from academy_private.study_adult_review_worker_runs',
    )
    expect(count.rows[0].count).toBe(2)
  })

  it('projects latest success independently and applies the 15-minute boundary exactly', async () => {
    await record(receipt({
      runId: runId(1),
      completedAt: '2026-08-10T12:00:00.000Z',
      startedAt: '2026-08-10T11:59:59.000Z',
    }))
    expect(await status('2026-08-10T12:15:00.000Z')).toEqual({
      schemaVersion: 1,
      configuredState: 'configured',
      latestRunTimestamp: '2026-08-10T12:00:00.000Z',
      latestSuccessfulRunTimestamp: '2026-08-10T12:00:00.000Z',
      latestResultCategory: 'processed',
      stalenessClassification: 'healthy',
      workerVersion: WORKER_CONFIGURATION_VERSION,
    })
    expect((await status('2026-08-10T12:15:00.001Z')).stalenessClassification)
      .toBe('degraded')

    await record(receipt({
      runId: runId(2),
      startedAt: '2026-08-10T12:04:59.000Z',
      completedAt: '2026-08-10T12:05:00.000Z',
      resultCategory: 'failed',
      claimedCount: 1,
      processedCount: 0,
      retryableFailureCount: 1,
      reasonCode: 'retryable-failures',
    }))
    const degraded = await status('2026-08-10T12:06:00.000Z')
    expect(degraded).toMatchObject({
      latestRunTimestamp: '2026-08-10T12:05:00.000Z',
      latestSuccessfulRunTimestamp: '2026-08-10T12:00:00.000Z',
      latestResultCategory: 'failed',
      stalenessClassification: 'degraded',
    })
  })

  it('distinguishes configured-with-no-evidence, unavailable results, and missing configuration', async () => {
    const noEvidence = await status('2026-08-10T12:00:00.000Z')
    expect(noEvidence).toEqual({
      schemaVersion: 1,
      configuredState: 'configured',
      latestRunTimestamp: null,
      latestSuccessfulRunTimestamp: null,
      latestResultCategory: null,
      stalenessClassification: 'unknown',
      workerVersion: null,
    })

    await record(receipt({
      resultCategory: 'unavailable', claimedCount: 0, processedCount: 0,
      reasonCode: 'dependency-unavailable',
    }))
    expect((await status('2026-08-10T12:01:00.000Z')).stalenessClassification)
      .toBe('unavailable')

    await database.exec(`
      delete from academy_private.study_adult_review_worker_runs;
      delete from academy_private.study_adult_review_worker_registry
      where worker_id = '${WORKER}';
    `)
    expect(await status('2026-08-10T12:01:00.000Z')).toMatchObject({
      configuredState: 'not_configured',
      stalenessClassification: 'unavailable',
    })
  })

  it('requires credential-bound worker authority and refuses browser authors/readers', async () => {
    const run = receipt()
    await expect(asRole('service_role', null, () => rpc(
      'select public.academy_study_record_adult_review_worker_run_v1($1, $2::jsonb) as result',
      [WORKER, JSON.stringify(run)],
    ))).rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await expect(asWorker(() => rpc(
      'select public.academy_study_record_adult_review_worker_run_v1($1, $2::jsonb) as result',
      [WORKER, JSON.stringify(run)],
    ), 'wrong-worker-credential-that-is-still-bounded'))
      .rejects.toThrow(/STUDY_WORKER_NOT_AUTHORIZED/)
    await expect(asRole('authenticated', GUARDIAN, () => rpc(
      'select public.academy_study_adult_review_worker_status_v1($1) as result',
      ['2026-08-10T12:00:00.000Z'],
    ))).rejects.toThrow()
    await expect(asRole('anon', null, () => rpc(
      'select public.academy_study_adult_review_worker_status_v1($1) as result',
      ['2026-08-10T12:00:00.000Z'],
    ))).rejects.toThrow()
    await expect(asRole('service_role', null, () => database.query(
      'select * from academy_private.study_adult_review_worker_runs',
    ))).rejects.toThrow()
  })

  it('has a content-free schema, rejects payload-shaped extras, and minimizes the projection', async () => {
    const columns = await database.query<{ name: string }>(`
      select column_name as name
      from information_schema.columns
      where table_schema = 'academy_private'
        and table_name = 'study_adult_review_worker_runs'
      order by ordinal_position
    `)
    expect(columns.rows.map((row) => row.name)).toEqual([
      'run_id', 'worker_id', 'worker_version', 'started_at', 'completed_at',
      'result_category', 'claimed_count', 'processed_count',
      'retryable_failure_count', 'terminal_failure_count', 'invocation_kind',
      'reason_code', 'recorded_at',
    ])
    const unsafe = { ...receipt(), studentId: 'learner-private', payload: 'review-private' }
    await expect(asWorker(() => rpc(
      'select public.academy_study_record_adult_review_worker_run_v1($1, $2::jsonb) as result',
      [WORKER, JSON.stringify(unsafe)],
    ))).rejects.toThrow(/STUDY_WORKER_RUN_INVALID/)

    const projection = await status('2026-08-10T12:00:00.000Z')
    expect(Object.keys(projection).sort()).toEqual([
      'configuredState', 'latestResultCategory', 'latestRunTimestamp',
      'latestSuccessfulRunTimestamp', 'schemaVersion', 'stalenessClassification',
      'workerVersion',
    ])
    expect(JSON.stringify(projection)).not.toMatch(/student|learner|payload|content|note|transcript/i)
  })
})
