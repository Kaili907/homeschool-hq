import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationSql = readFile(
  new URL('./migrations/20260808121000_academy_operational_events.sql', import.meta.url),
  'utf8',
)
const correlationMigrationSql = readFile(
  new URL('./migrations/20260810180000_academy_admin_correlation_runtime_read.sql', import.meta.url),
  'utf8',
)
const databases: PGlite[] = []

type Role = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(database: PGlite, role: Role, userId: string | null, operation: () => Promise<T>) {
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

function facts(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2,
    scope: 'system', household_id: null, learner_id: null,
    engine: 'gateway', app_version: 'deploy.2026.08.10', engine_version: 'gateway.v2',
    curriculum_version: null, course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    event_type: 'gateway.request', result: 'timeout', duration_ms: 540,
    metadata: {
      operation: 'anthropic_messages', reason_code: 'provider_timeout', provider: 'anthropic',
      http_status: 504, retryable: true, route: 'anthropic', severity: 'error',
    },
    ...overrides,
  }
}

async function record(database: PGlite, correlationId: string, overrides: Record<string, unknown> = {}) {
  return asRole(database, 'service_role', null, () => database.query(
    `select public.academy_record_operational_event_v2($1, $2::jsonb) as result`,
    [correlationId, JSON.stringify(facts(overrides))],
  ))
}

async function readRuntime(database: PGlite, parameters: unknown[]) {
  return asRole(database, 'service_role', null, () => database.query<{ projection: any }>(`
    select public.academy_admin_read_incident_runtime_v1(
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) as projection
  `, parameters))
}

beforeEach(async () => {
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
    create table public.academy_households (id uuid primary key, status text not null);
    create table public.academy_students (
      id uuid primary key,
      household_id uuid not null references public.academy_households (id),
      status text not null,
      unique (id, household_id)
    );
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  await database.exec(await migrationSql)
  await database.exec(await correlationMigrationSql)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('Admin correlation runtime database read seam', () => {
  it('supports exact correlation, time, engine, and result filters with a privacy-minimized DTO', async () => {
    const database = databases[0]
    await record(database, 'request-correlation-1')
    await record(database, 'request-correlation-2', { result: 'success', duration_ms: 120 })
    const projection = (await readRuntime(database, [
      50, null, null,
      new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
      'request-correlation-1', 'gateway', 'timeout', 'engines:read',
    ])).rows[0].projection

    expect(projection.schemaVersion).toBe(2)
    expect(projection.hasMore).toBe(false)
    expect(projection.events).toHaveLength(1)
    expect(projection.events[0]).toMatchObject({
      execution_key: 'request-correlation-1', engine: 'gateway',
      event_type: 'gateway.request', result: 'timeout', duration_ms: 540,
      metadata: {
        operation: 'anthropic_messages', reason_code: 'provider_timeout',
        provider: 'anthropic', http_status: 504, failure_stage: null, retryable: true,
      },
    })
    expect(JSON.stringify(projection)).not.toMatch(
      /household|learner|course_ref|unit_ref|lesson_ref|skill_ref|prompt|response|raw_error|secret/i,
    )
  })

  it('paginates deterministically with a two-part cursor and never downloads unbounded rows', async () => {
    const database = databases[0]
    await record(database, 'page-correlation-1')
    await record(database, 'page-correlation-2')
    const range = [
      new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
    ]
    const first = (await readRuntime(database, [
      1, null, null, range[0], range[1], null, null, null, 'engines:read',
    ])).rows[0].projection
    expect(first.events).toHaveLength(1)
    expect(first.hasMore).toBe(true)
    const cursor = first.events[0]
    const second = (await readRuntime(database, [
      1, cursor.occurred_at, cursor.event_id, range[0], range[1],
      null, null, null, 'engines:read',
    ])).rows[0].projection
    expect(second.events).toHaveLength(1)
    expect(second.events[0].event_id).not.toBe(cursor.event_id)
    expect(second.hasMore).toBe(false)
  })

  it('requires trusted service engines:read authority and preserves direct table denial', async () => {
    const database = databases[0]
    const invoke = () => database.query(`select public.academy_admin_read_incident_runtime_v1(
      50, null, null, now() - interval '1 hour', now() + interval '1 hour',
      null, null, null, 'engines:read'
    )`)
    await expect(asRole(database, 'anon', null, invoke)).rejects.toThrow()
    await expect(asRole(database, 'authenticated', '30000000-0000-4000-8000-000000000001', invoke))
      .rejects.toThrow()
    await expect(readRuntime(database, [
      50, null, null, new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(), null, null, null, 'health:read',
    ])).rejects.toThrow(/RUNTIME_READ_REQUIRED/)
    await expect(asRole(database, 'service_role', null, () =>
      database.query('select * from public.academy_operational_events'))).rejects.toThrow()
  })

  it('rejects malformed/unbounded queries and excludes logically expired events', async () => {
    const database = databases[0]
    await database.exec(`insert into public.academy_operational_events (
      event_id, execution_key, occurred_at, scope, household_id, learner_id,
      engine, app_version, engine_version, curriculum_version,
      course_ref, unit_ref, lesson_ref, skill_ref, event_type, result,
      duration_ms, metadata, retention_category, expires_at
    ) values (
      '10000000-0000-4000-8000-000000000099', 'expired-correlation',
      now() - interval '31 days', 'system', null, null, 'study',
      'deploy.1', 'study.v2', null, null, null, null, null,
      'study.session', 'success', 100, '{}', 'diagnostic_short',
      now() - interval '1 day'
    )`)
    await expect(readRuntime(database, [
      101, null, null, new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(), null, null, null, 'engines:read',
    ])).rejects.toThrow(/QUERY_INVALID/)
    await expect(readRuntime(database, [
      50, null, null, new Date(Date.now() - 91 * 86_400_000).toISOString(),
      new Date().toISOString(), null, null, null, 'engines:read',
    ])).rejects.toThrow(/QUERY_INVALID/)
    const projection = (await readRuntime(database, [
      50, null, null, new Date(Date.now() - 40 * 86_400_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(), 'expired-correlation',
      null, null, 'engines:read',
    ])).rows[0].projection
    expect(projection.events).toEqual([])
  })
})
