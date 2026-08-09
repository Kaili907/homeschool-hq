import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000002'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OTHER_LEARNER_ID = '20000000-0000-4000-8000-000000000002'
const USER_ID = '30000000-0000-4000-8000-000000000001'
const databases: PGlite[] = []

const migrationSql = readFile(
  new URL('./migrations/20260808123000_academy_admin_safety_operations.sql', import.meta.url),
  'utf8',
)

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create schema academy_private authorization postgres;
  create or replace function auth.uid() returns uuid language sql stable set search_path = pg_catalog as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create or replace function academy_private.operational_is_trusted_server()
  returns boolean language sql stable set search_path = pg_catalog as $$
    select auth.uid() is null and current_setting('request.jwt.claim.role', true) = 'service_role'
  $$;
  create table public.academy_students (
    id uuid primary key, household_id uuid not null, display_name text not null,
    unique (id, household_id)
  );
  create table public.academy_operational_events (
    event_id uuid primary key, occurred_at timestamptz not null, scope text not null,
    household_id uuid, learner_id uuid, engine text not null, app_version text not null,
    engine_version text not null, curriculum_version text, result text not null,
    metadata jsonb not null default '{}'::jsonb
  );
  create table academy_private.study_adult_review_proposals_v1 (
    proposal_id text primary key, household_id uuid not null, student_id uuid not null,
    occurred_at timestamptz not null, reason_codes text[] not null,
    recipient_resolution_state text not null
  );
  create table academy_private.study_safety_monitoring_events (
    event_id text primary key, name text not null, occurred_at timestamptz not null,
    attributes jsonb not null default '{}'::jsonb
  );
  insert into public.academy_students values
    ('${LEARNER_ID}', '${HOUSEHOLD_ID}', 'Learner One'),
    ('${OTHER_LEARNER_ID}', '${OTHER_HOUSEHOLD_ID}', 'Learner Two');
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

type Role = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(database: PGlite, role: Role, userId: string | null, operation: () => Promise<T>): Promise<T> {
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

async function readProjection(database: PGlite, values: unknown[] = [50, null, null, null, null, 'safety:read']) {
  return asRole(database, 'service_role', null, () => database.query<{ projection: any }>(
    'select public.academy_admin_read_safety_operations_v1($1, $2, $3, $4, $5, $6) as projection',
    values,
  ))
}

async function insertOperational(database: PGlite, values: {
  id: string; occurredAt: string; engine?: string; result?: string;
  household?: string | null; learner?: string | null; metadata?: Record<string, unknown>
}) {
  await database.query(`insert into public.academy_operational_events (
    event_id, occurred_at, scope, household_id, learner_id, engine,
    app_version, engine_version, curriculum_version, result, metadata
  ) values ($1,$2,$3,$4,$5,$6,'app-1',$7,null,$8,$9::jsonb)`, [
    values.id, values.occurredAt,
    values.household === null ? 'system' : 'household',
    values.household === undefined ? HOUSEHOLD_ID : values.household,
    values.learner === undefined ? LEARNER_ID : values.learner,
    values.engine ?? 'study', `${values.engine ?? 'study'}-v1`, values.result ?? 'safety_stop',
    JSON.stringify(values.metadata ?? { reason_code: 'study-safety-stop' }),
  ])
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrapSql)
  await database.exec(await migrationSql)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('ADMIN-10B database safety projection', () => {
  it('is service-only, requires exactly safety:read, and denies browser roles', async () => {
    const database = databases[0]
    await expect(asRole(database, 'anon', null, () =>
      database.query('select public.academy_admin_read_safety_operations_v1(50,null,null,null,null,$1)', ['safety:read'])))
      .rejects.toThrow()
    await expect(asRole(database, 'authenticated', USER_ID, () =>
      database.query('select public.academy_admin_read_safety_operations_v1(50,null,null,null,null,$1)', ['safety:read'])))
      .rejects.toThrow()
    await expect(readProjection(database, [50, null, null, null, null, 'engines:read']))
      .rejects.toThrow()
    await expect(readProjection(database)).resolves.toBeDefined()
  })

  it.each(['tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync']) (
    'projects canonical safety_stop evidence for engine %s', async (engine) => {
      const suffix = String(['tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync'].indexOf(engine) + 1).padStart(12, '0')
      await insertOperational(databases[0], {
        id: `40000000-0000-4000-8000-${suffix}`,
        occurredAt: '2026-08-08T12:00:00.000Z', engine,
      })
      const result = await readProjection(databases[0])
      expect(result.rows[0].projection.events[0]).toMatchObject({
        engine, source: 'operational-telemetry', evidenceCategory: 'safety-stop',
        versionSnapshot: { appVersion: 'app-1', engineVersion: `${engine}-v1`, curriculumVersion: null },
      })
    },
  )

  it('does not adapt provider_error, timeout, rejected, or fallback as safety events', async () => {
    const results = ['provider_error', 'timeout', 'rejected', 'fallback', 'safety_stop']
    for (const [index, result] of results.entries()) {
      await insertOperational(databases[0], {
        id: `41000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        occurredAt: `2026-08-08T12:00:0${index}.000Z`, result,
      })
    }
    const projection = (await readProjection(databases[0])).rows[0].projection
    expect(projection.events).toHaveLength(1)
    expect(projection.events[0].eventRef).toContain('000000000005')
    expect(projection.summary.safetyStopEvents.value).toBe(1)
  })

  it('projects pending and resolved adult-review state without private resolution content', async () => {
    await databases[0].exec(`insert into academy_private.study_adult_review_proposals_v1 values
      ('proposal:pending', '${HOUSEHOLD_ID}', '${LEARNER_ID}', '2026-08-08T12:00:00Z', array['safety-uncertain-danger-v1'], 'pending'),
      ('proposal:resolved', '${HOUSEHOLD_ID}', '${LEARNER_ID}', '2026-08-08T11:00:00Z', array['safety-urgent-immediate-danger-v1'], 'resolved')`)
    const projection = (await readProjection(databases[0])).rows[0].projection
    expect(projection.summary).toMatchObject({
      openSafetyStops: { status: 'available', value: 1 },
      resolvedSafetyStops: { status: 'available', value: 1 },
      adultReviewPending: { status: 'available', value: 1 },
    })
    expect(projection.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventRef: 'adult-review:proposal:pending', state: 'pending-review', resolution: { state: 'pending-adult-review' } }),
      expect.objectContaining({ eventRef: 'adult-review:proposal:resolved', state: 'resolved', resolution: { state: 'resolved' } }),
    ]))
    expect(JSON.stringify(projection)).not.toMatch(/note|resolutionRef|membership/i)
  })

  it('projects only allowlisted fail-closed/rejection monitoring facts and no attributes', async () => {
    await databases[0].exec(`insert into academy_private.study_safety_monitoring_events values
      ('monitor:timeout', 'study_safety.provider_timeout', '2026-08-08T12:00:00Z', '{"conversation":"private"}'),
      ('monitor:denied', 'study_safety.request_unauthorized', '2026-08-08T11:00:00Z', '{"providerBody":"private"}'),
      ('monitor:info', 'study_safety.proposal_duplicate', '2026-08-08T10:00:00Z', '{"raw":"private"}')`)
    const projection = (await readProjection(databases[0])).rows[0].projection
    expect(projection.events).toHaveLength(2)
    expect(projection.summary.failClosedEvents.value).toBe(1)
    expect(projection.summary.fallbackRejectionEvents.value).toBe(1)
    expect(JSON.stringify(projection)).not.toContain('private')
    expect(JSON.stringify(projection)).not.toContain('attributes')
  })

  it('keeps a real zero distinct from unavailable evidence', async () => {
    const projection = (await readProjection(databases[0])).rows[0].projection
    expect(projection.events).toEqual([])
    expect(Object.values(projection.summary)).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'available', value: 0 }),
    ]))
    expect(projection.sources.every((source: any) => source.status === 'available')).toBe(true)
  })

  it('enforces learner-within-household scope and excludes other households', async () => {
    await insertOperational(databases[0], { id: '42000000-0000-4000-8000-000000000001', occurredAt: '2026-08-08T12:00:00Z' })
    await insertOperational(databases[0], {
      id: '42000000-0000-4000-8000-000000000002', occurredAt: '2026-08-08T11:00:00Z',
      household: OTHER_HOUSEHOLD_ID, learner: OTHER_LEARNER_ID,
    })
    const scoped = await readProjection(databases[0], [50, null, null, HOUSEHOLD_ID, LEARNER_ID, 'safety:read'])
    expect(scoped.rows[0].projection.events).toHaveLength(1)
    expect(scoped.rows[0].projection.events[0].learner.reference).toBe(LEARNER_ID)
    await expect(readProjection(databases[0], [50, null, null, HOUSEHOLD_ID, OTHER_LEARNER_ID, 'safety:read']))
      .rejects.toThrow()
    await expect(readProjection(databases[0], [50, null, null, null, LEARNER_ID, 'safety:read']))
      .rejects.toThrow()
  })

  it('bounds reads and applies a stable occurred-time/event-ref cursor', async () => {
    for (let index = 1; index <= 3; index += 1) {
      await insertOperational(databases[0], {
        id: `43000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        occurredAt: '2026-08-08T12:00:00.000Z',
      })
    }
    const first = (await readProjection(databases[0], [2, null, null, null, null, 'safety:read'])).rows[0].projection
    expect(first.events).toHaveLength(2)
    const last = first.events[1]
    const second = (await readProjection(databases[0], [2, last.occurredAt, last.eventRef, null, null, 'safety:read'])).rows[0].projection
    expect(second.events).toHaveLength(1)
    expect(first.events.map((item: any) => item.eventRef)).not.toContain(second.events[0].eventRef)
    await expect(readProjection(databases[0], [102, null, null, null, null, 'safety:read']))
      .rejects.toThrow()
  })
})
