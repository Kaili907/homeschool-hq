import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000002'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OTHER_LEARNER_ID = '20000000-0000-4000-8000-000000000002'
const GUARDIAN_ID = '30000000-0000-4000-8000-000000000001'

const migrationSql = readFile(
  new URL('./migrations/20260808121000_academy_operational_events.sql', import.meta.url),
  'utf8',
)
const foundationMigrationSql = readFile(
  new URL('./migrations/20260809120000_academy_operational_telemetry_foundation.sql', import.meta.url),
  'utf8',
)

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create schema academy_private authorization postgres;

  create or replace function auth.uid()
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

  insert into public.academy_households (id, status) values
    ('${HOUSEHOLD_ID}', 'active'), ('${OTHER_HOUSEHOLD_ID}', 'active');
  insert into public.academy_students (id, household_id, status) values
    ('${LEARNER_ID}', '${HOUSEHOLD_ID}', 'active'),
    ('${OTHER_LEARNER_ID}', '${OTHER_HOUSEHOLD_ID}', 'active');
`

const databases: PGlite[] = []
type DatabaseRole = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(
  database: PGlite,
  role: DatabaseRole,
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

function facts(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2,
    scope: 'household', household_id: HOUSEHOLD_ID, learner_id: LEARNER_ID,
    engine: 'study', app_version: 'deploy.2026.08.08', engine_version: 'study.v2',
    curriculum_version: 'math-r1', course_ref: 'math-5', unit_ref: 'unit-1',
    lesson_ref: 'lesson-2', skill_ref: 'fractions.compare',
    event_type: 'study.session', result: 'success', duration_ms: 1_250,
    metadata: { operation: 'complete', reason_code: 'completed' },
    ...overrides,
  }
}

async function record(
  database: PGlite,
  executionKey: string,
  eventFacts: Record<string, unknown>,
) {
  return database.query<{ result: Record<string, unknown> }>(
    'select public.academy_record_operational_event_v2($1, $2::jsonb) as result',
    [executionKey, JSON.stringify(eventFacts)],
  )
}

async function recordAsService(
  database: PGlite,
  executionKey: string,
  eventFacts: Record<string, unknown>,
) {
  return asRole(database, 'service_role', null, () => record(database, executionKey, eventFacts))
}

async function listAsService(database: PGlite, parameters: unknown[]) {
  return asRole(database, 'service_role', null, () =>
    database.query<{ events: unknown[] }>(
      'select public.academy_list_operational_events_v2($1, $2, $3, $4, $5) as events',
      parameters,
    ))
}

async function aggregateAsService(database: PGlite, parameters: unknown[]) {
  return asRole(database, 'service_role', null, () =>
    database.query<{ aggregate: Record<string, unknown> }>(
      `select public.academy_aggregate_operational_events_v2(
        $1, $2, $3, $4, $5, $6, $7
      ) as aggregate`,
      parameters,
    ))
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrapSql)
  await database.exec(await migrationSql)
  await database.exec(await foundationMigrationSql)
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('ADMIN-0 v2 operational event database contract', () => {
  it.each([
    ['tutor', 'tutor.turn'], ['study', 'study.session'],
    ['assessment', 'assessment.attempt'], ['curriculum', 'curriculum.load'],
    ['jarvis', 'jarvis.turn'], ['tts', 'tts.synthesis'],
    ['gateway', 'gateway.request'], ['sync', 'sync.operation'],
  ] as const)('accepts canonical engine %s and event %s', async (engine, eventType) => {
    const eventFacts = facts({
      engine, event_type: eventType, engine_version: `${engine}.v2`,
      curriculum_version: eventType === 'curriculum.load' ? 'curriculum.v2' : null,
      course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    })
    const written = await recordAsService(databases[0], `${engine}:execution:0001`, eventFacts)
    expect(written.rows[0].result).toMatchObject({ status: 'created' })
  })

  it.each([
    'success', 'fallback', 'rejected', 'timeout', 'provider_error',
    'validation_error', 'safety_stop',
  ])('accepts canonical result %s', async (result) => {
    const written = await recordAsService(
      databases[0], `study:${result}:0001`, facts({ result }),
    )
    expect(written.rows[0].result).toMatchObject({ status: 'created' })
  })

  it('stores explicit household and system scope', async () => {
    const database = databases[0]
    await recordAsService(database, 'study:household:0001', facts())
    await recordAsService(database, 'gateway:system:0001', facts({
      scope: 'system', household_id: null, learner_id: null,
      engine: 'gateway', engine_version: 'gateway.v2', curriculum_version: null,
      course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
      event_type: 'gateway.request',
    }))
    const listed = await listAsService(database, [null, null, null, 10, 'engines:read'])
    expect(listed.rows[0].events).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'household', householdRef: HOUSEHOLD_ID }),
      expect.objectContaining({ scope: 'system', householdRef: null, learnerRef: null }),
    ]))
  })

  it('requires app/engine versions and applies curriculum version to relevant context', async () => {
    const database = databases[0]
    await expect(recordAsService(database, 'bad:app:0001', facts({ app_version: null })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:engine:0001', facts({ engine_version: null })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:curriculum:0001', facts({ curriculum_version: null })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:load:0001', facts({
      engine: 'curriculum', event_type: 'curriculum.load', engine_version: 'curriculum.v2',
      curriculum_version: null, course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    }))).rejects.toThrow()
    await expect(recordAsService(database, 'gateway:no-curriculum:0001', facts({
      engine: 'gateway', event_type: 'gateway.request', engine_version: 'gateway.v2',
      curriculum_version: null, course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    }))).resolves.toBeDefined()
  })

  it('rejects invalid scope, learner ownership, event pairings, and durations', async () => {
    const database = databases[0]
    await expect(recordAsService(database, 'bad:system:0001', facts({ scope: 'system' })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:learner:0001', facts({ learner_id: OTHER_LEARNER_ID })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:pair:0001', facts({ engine: 'gateway' })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'bad:duration:0001', facts({ duration_ms: 86_400_001 })))
      .rejects.toThrow()
  })

  it('enforces canonical, bounded, flat, privacy-safe metadata', async () => {
    const database = databases[0]
    await expect(recordAsService(database, 'metadata:valid:0001', facts({ metadata: {
      attempt: 2, cache_hit: false, http_status: 503, retryable: true,
      reason_code: 'provider_timeout', severity: 'error',
    } }))).resolves.toBeDefined()
    await expect(recordAsService(database, 'metadata:unknown:0001', facts({ metadata: { phase: 'done' } })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'metadata:nested:0001', facts({ metadata: { provider: { name: 'x' } } })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'metadata:long:0001', facts({ metadata: { provider: 'x'.repeat(129) } })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'metadata:secret:0001', facts({ metadata: { provider: 'sk-secret-value' } })))
      .rejects.toThrow()
    await expect(recordAsService(database, 'metadata:raw:0001', facts({ metadata: { raw_answer: 'private' } })))
      .rejects.toThrow()
  })

  it('generates durable event identity and occurrence time on the server', async () => {
    const database = databases[0]
    await expect(recordAsService(database, 'trusted:extra:0001', {
      ...facts(), event_id: '40000000-0000-4000-8000-000000000001',
    })).rejects.toThrow()
    const before = Date.now()
    const written = await recordAsService(database, 'trusted:server:0001', facts())
    const after = Date.now()
    const event = written.rows[0].result.event as { eventId: string; occurredAt: string }
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(event.occurredAt)).toBeGreaterThanOrEqual(before - 1_000)
    expect(Date.parse(event.occurredAt)).toBeLessThanOrEqual(after + 1_000)
  })

  it('replays identical stable executions and reports differing facts as conflicts', async () => {
    const database = databases[0]
    const first = await recordAsService(database, 'stable:execution:0001', facts())
    const replay = await recordAsService(database, 'stable:execution:0001', facts())
    const conflict = await recordAsService(
      database, 'stable:execution:0001', facts({ result: 'fallback' }),
    )
    expect(first.rows[0].result.status).toBe('created')
    expect(replay.rows[0].result).toMatchObject({
      status: 'replayed', event: first.rows[0].result.event,
    })
    expect(conflict.rows[0].result).toEqual({ status: 'reconciliation_conflict' })
    const count = await database.query<{ count: number }>(
      'select count(*)::integer as count from public.academy_operational_events',
    )
    expect(count.rows[0].count).toBe(1)
  })

  it('denies ordinary guardians and requires the canonical Admin read capability', async () => {
    const database = databases[0]
    await recordAsService(database, 'auth:seed:0001', facts())
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      record(database, 'auth:guardian:0001', facts()))).rejects.toThrow()
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query('select public.academy_list_operational_events_v2(null, null, null, 10, $1)', ['engines:read'])))
      .rejects.toThrow()
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query('select * from public.academy_operational_events'))).rejects.toThrow()
    await expect(listAsService(database, [null, null, null, 10, 'health:read']))
      .rejects.toThrow()
    await expect(listAsService(database, ['household', HOUSEHOLD_ID, null, 10, 'engines:read']))
      .resolves.toMatchObject({ rows: [{ events: [expect.objectContaining({ scope: 'household' })] }] })
  })

  it('declares and computes bounded retention categories', async () => {
    const database = databases[0]
    await recordAsService(database, 'retention:short:0001', facts())
    await recordAsService(database, 'retention:standard:0001', facts({
      engine: 'gateway', engine_version: 'gateway.v2', event_type: 'gateway.request',
      result: 'provider_error', curriculum_version: null,
      course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    }))
    await recordAsService(database, 'retention:safety:0001', facts({
      engine: 'tutor', engine_version: 'tutor.v2', event_type: 'safety.classification',
      result: 'safety_stop', curriculum_version: null,
      course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
    }))
    const rows = await database.query<{
      retention_category: string; days: number
    }>(`select retention_category,
          extract(epoch from (expires_at - occurred_at))::integer / 86400 as days
        from public.academy_operational_events order by retention_category`)
    expect(rows.rows).toEqual([
      { retention_category: 'diagnostic_short', days: 30 },
      { retention_category: 'operational_standard', days: 90 },
      { retention_category: 'safety_extended', days: 365 },
    ])
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query('select public.academy_purge_expired_operational_events_v2(100)')))
      .rejects.toThrow()
  })

  it('returns a complete bounded aggregate beyond the raw 500-event read ceiling', async () => {
    const database = databases[0]
    await asRole(database, 'service_role', null, () => database.query(`
      select public.academy_record_operational_event_v2(
        'aggregate:execution:' || series::text,
        jsonb_set($1::jsonb, '{duration_ms}', to_jsonb(series))
      )
      from generate_series(1, 501) as series
    `, [JSON.stringify(facts({
      curriculum_version: null, course_ref: null, unit_ref: null,
      lesson_ref: null, skill_ref: null,
    }))]))
    const end = new Date(Date.now() + 60_000)
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1_000)
    const response = await aggregateAsService(database, [
      start.toISOString(), end.toISOString(), 'study', null, null, null, 'engines:read',
    ])
    const aggregate = response.rows[0].aggregate as any
    expect(aggregate).toMatchObject({
      schemaVersion: 2,
      totalEventCount: 501,
      completeness: {
        grouping: 'complete', groupCount: 1, groupLimit: 4096,
        allRetentionClasses: true,
      },
      summary: {
        eventCount: 501, successCount: 501, durationCount: 501,
        durationP50Ms: 251, durationP95Ms: 476,
      },
      engineSummaries: [{
        engine: 'study', eventCount: 501, successCount: 501,
        durationCount: 501, durationP50Ms: 251, durationP95Ms: 476,
      }],
      groups: [{
        engine: 'study', eventType: 'study.session', eventCount: 501,
        durationP50Ms: 251, durationP95Ms: 476,
      }],
    })
    expect(JSON.stringify(aggregate)).not.toMatch(
      /eventId|executionKey|householdRef|learnerRef|metadata|conversation|prompt|response|audio|assessmentAnswer/i,
    )
  })

  it('returns exact cross-group latency summaries for health engines and services', async () => {
    const database = databases[0]
    await asRole(database, 'service_role', null, () => database.query(`
      select public.academy_record_operational_event_v2(
        'health-latency:execution:' || series::text,
        jsonb_set($1::jsonb, '{duration_ms}', to_jsonb(series))
      )
      from generate_series(1, 20) as series
    `, [JSON.stringify(facts({
      scope: 'system', household_id: null, learner_id: null,
      engine: 'gateway', engine_version: 'gateway.v2', curriculum_version: null,
      course_ref: null, unit_ref: null, lesson_ref: null, skill_ref: null,
      event_type: 'gateway.request', metadata: { operation: 'request', provider: 'anthropic' },
    }))]))
    const end = new Date(Date.now() + 60_000)
    const start = new Date(end.getTime() - 60 * 60 * 1_000)
    const response = await aggregateAsService(database, [
      start.toISOString(), end.toISOString(), 'gateway', null, null, null, 'health:read',
    ])
    expect(response.rows[0].aggregate).toMatchObject({
      summary: { eventCount: 20, durationCount: 20, durationP50Ms: 11, durationP95Ms: 19 },
      engineSummaries: [{
        engine: 'gateway', eventCount: 20, durationP50Ms: 11, durationP95Ms: 19,
      }],
      serviceSummaries: [{
        serviceId: 'anthropic_gateway', eventCount: 20, durationP50Ms: 11, durationP95Ms: 19,
      }],
    })
  })

  it('declares retention-safe windows instead of mixing differently retained populations', async () => {
    const end = new Date(Date.now() + 60_000)
    const start = new Date(end.getTime() - 31 * 24 * 60 * 60 * 1_000)
    const response = await aggregateAsService(databases[0], [
      start.toISOString(), end.toISOString(), null, null, null, null, 'engines:read',
    ])
    const completeness = (response.rows[0].aggregate as any).completeness
    expect(completeness.allRetentionClasses).toBe(false)
    expect(completeness.retentionClasses).toEqual([
      { category: 'diagnostic_short', retainedDays: 30, complete: false },
      { category: 'operational_standard', retainedDays: 90, complete: true },
      { category: 'safety_extended', retainedDays: 365, complete: true },
    ])
  })

  it('enforces Admin authorization and deterministic aggregate range bounds', async () => {
    const database = databases[0]
    const end = new Date(Date.now() + 60_000)
    const validStart = new Date(end.getTime() - 24 * 60 * 60 * 1_000)
    const tooEarly = new Date(end.getTime() - 367 * 24 * 60 * 60 * 1_000)
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query(`select public.academy_aggregate_operational_events_v2(
        $1, $2, null, null, null, null, 'engines:read'
      )`, [validStart.toISOString(), end.toISOString()]))).rejects.toThrow()
    await expect(aggregateAsService(database, [
      validStart.toISOString(), end.toISOString(), null, null, null, null, 'learners:read',
    ])).rejects.toThrow()
    await expect(aggregateAsService(database, [
      validStart.toISOString(), end.toISOString(), null, null, null, null, null,
    ])).rejects.toThrow()
    await expect(aggregateAsService(database, [
      tooEarly.toISOString(), end.toISOString(), null, null, null, null, 'health:read',
    ])).rejects.toThrow()
  })
})
