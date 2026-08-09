import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { STUDY_ACADEMIC_OPERATIONS } from '../src/study/client/studyIdentityClient'

/**
 * Learner-session runtime operations: event:append and calendar:transition.
 *
 * Everything here runs through academy_study_execute_verified_runtime_v1 with a
 * real opaque grant, because that is the only way either operation is reachable:
 * the two functions the migration adds are granted to nobody. A test that called
 * them directly as postgres would prove the SQL works and prove nothing about
 * the authority model that has to hold in production.
 *
 * The drift suite is the reason the operation list is three literals rather than
 * one shared import. The SQL authority is executed, not parsed, and the gateway
 * and browser maps are the modules the runtime actually loads.
 */
const LEARNER_RUNTIME_MIGRATION =
  './migrations/20260809120000_academy_study_learner_runtime_operations.sql'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260806120000_academy_study_in_app_receipt_timestamp.sql',
  './migrations/20260806140000_academy_study_c2_operations_contract.sql',
  './migrations/20260808120000_academy_study_actor_bound_session_verification.sql',
  './migrations/20260808150000_academy_study_academic_readiness_contract.sql',
  LEARNER_RUNTIME_MIGRATION,
  './tests/study_engine_fixtures.sql',
] as const

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'

const ATTEMPTS = 'student:attempts:create'

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

let database: PGlite
let digestA: string
let digestB: string

async function asRole<T>(
  role: 'authenticated' | 'service_role',
  subject: string | null,
  run: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) }).replaceAll("'", "''")
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await run()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function issueDigest(guardian: string, student: string): Promise<string> {
  const issued = await asRole('authenticated', guardian, async () => {
    const result = await database.query<{ result: Record<string, unknown> }>(
      'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
      ['academy-student-id', student],
    )
    return result.rows[0].result
  })
  return createHash('sha256').update(String(issued.sessionReference), 'ascii').digest('hex')
}

interface RuntimeEnvelope {
  schemaVersion: number
  status: string
  operation: string
  body?: Record<string, unknown>
}

async function execute(
  digest: string,
  capability: string,
  operation: string,
  request: unknown,
): Promise<RuntimeEnvelope> {
  return asRole('service_role', null, async () => {
    const result = await database.query<{ result: RuntimeEnvelope }>(
      `select public.academy_study_execute_verified_runtime_v1(
        $1::text, $2::text, $3::text, $4::jsonb
      ) as result`,
      [digest, capability, operation, JSON.stringify(request)],
    )
    return result.rows[0].result
  })
}

/** Appends one calendar block owned by the given household/student. */
async function seedBlock(
  id: string,
  household: string,
  student: string,
  state: string,
  resumeSessionId: string | null = null,
): Promise<void> {
  // The local date and explicit offset are derived from the household's own
  // timezone snapshot rather than hard-coded, because study_apply_timezone_snapshot
  // refuses a block whose declared offset disagrees with that timezone.
  await database.query(
    `insert into public.academy_study_calendar_blocks (
       id, household_id, student_id, block_type, source_reference,
       scheduled_start, intended_local_date, household_timezone,
       explicit_offset, duration_minutes, completion_units, required_units,
       resume_session_id, resume_segment_id, state, idempotency_key
     )
     select
       $1, settings.household_id, $3::uuid, 'lesson', 'lesson-a',
       start_at, (start_at at time zone settings.household_timezone)::date,
       settings.household_timezone,
       (extract(epoch from (
         (start_at at time zone settings.household_timezone)
         - (start_at at time zone 'UTC')
       ))::integer / 60),
       30, 0, 4, $4::text,
       case when $4::text is null then null else 'segment.seed' end,
       $5::text, $1
     from public.academy_study_household_settings as settings
     cross join (select '2026-08-09T14:00:00Z'::timestamptz as start_at) as anchor
     where settings.household_id = $2::uuid`,
    [id, household, student, resumeSessionId, state],
  )
}

async function blockRow(id: string): Promise<Record<string, unknown>> {
  const result = await database.query<Record<string, unknown>>(
    `select state, revision, completion_units, required_units, resume_segment_id,
       block_type, duration_minutes, scheduled_start
     from public.academy_study_calendar_blocks where id = $1`,
    [id],
  )
  return result.rows[0]
}

function eventRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'session-a',
    eventId: 'event.default',
    eventKind: 'session_started',
    payload: { schema_version: 1, state_to: 'active' },
    idempotencyKey: 'idem.default',
    ...overrides,
  }
}

function transitionRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    blockId: 'block.default',
    expectedRevision: 1,
    transition: 'start',
    at: '2026-08-09T14:00:00Z',
    segmentRef: null,
    pauseCategory: null,
    idempotencyKey: 'calendar.idem.default',
    ...overrides,
  }
}

/** The database's own clock, so the bounded `at` window is measured against it. */
let nowIso: string
let nowPlusIso: string

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  const sources = await Promise.all(
    files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  )
  for (const [index, migration] of sources.entries()) {
    try {
      await database.exec(migration)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  // Guardian launch issuance requires identity_manager on both lineages so that
  // the foreign-household cases have a real grant to be refused with.
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in (
      '00000000-0000-0000-0000-0000000001a1'::uuid,
      '00000000-0000-0000-0000-0000000001b1'::uuid
    )
  `)
  digestA = await issueDigest(GUARDIAN_A, STUDENT_A)
  digestB = await issueDigest(GUARDIAN_B, STUDENT_B)
  const clock = await database.query<{ now: string; later: string }>(`
    select
      to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as now,
      to_char((clock_timestamp() + interval '1 second') at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"') as later
  `)
  nowIso = clock.rows[0].now
  nowPlusIso = clock.rows[0].later
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('operation allow-list drift', () => {
  it('agrees across the SQL authority, the Netlify gateway and the browser client', async () => {
    const authority = await database.query<{ contract: Record<string, string> }>(
      'select academy_private.study_runtime_operation_contract() as contract',
    )
    const sql = authority.rows[0].contract
    const gateway = await import(
      '../netlify/functions/_shared/study-runtime/verified-academic-runtime.js'
    )

    // Sorted plain objects, so a difference reports as a diff of the whole map
    // rather than as "one key missing" on whichever side is checked first.
    const normalise = (value: Record<string, string>) =>
      Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))

    expect(normalise(sql)).toEqual(normalise(gateway.OPERATIONS))
    expect(normalise(sql)).toEqual(normalise(STUDY_ACADEMIC_OPERATIONS))
  })

  it('carries both new operations and no adult preferences write', async () => {
    const authority = await database.query<{ contract: Record<string, string> }>(
      'select academy_private.study_runtime_operation_contract() as contract',
    )
    const sql = authority.rows[0].contract
    expect(sql['event:append']).toBe(ATTEMPTS)
    expect(sql['calendar:transition']).toBe(ATTEMPTS)
    // Adult preferences belong to the adult authority lane. This is the whole
    // reason the learner surface is a closed list and not a prefix match.
    expect(Object.keys(sql)).not.toContain('preferences:write')
    expect(Object.keys(sql).some((operation) => operation.startsWith('preferences:'))).toBe(false)
  })

  it('dispatches every operation the authority admits', async () => {
    // A branch missing from the executor's CASE raises case_not_found (20000),
    // which is a different failure from a rejected request. Every admitted
    // operation must reach its own branch and refuse this request on its own
    // terms, so an operation added to the authority alone cannot go unnoticed.
    const authority = await database.query<{ contract: Record<string, string> }>(
      'select academy_private.study_runtime_operation_contract() as contract',
    )
    for (const [operation, capability] of Object.entries(authority.rows[0].contract)) {
      await expect(
        execute(digestA, capability, operation, { unroutableKey: 1 }),
        operation,
      ).rejects.toThrow(/STUDY_RUNTIME_REQUEST_INVALID/)
    }
  })

  it('denies an operation whose declared capability is not the one the authority names', async () => {
    const denied = await execute(digestA, 'student:progress:read', 'event:append', eventRequest())
    expect(denied).toMatchObject({ schemaVersion: 1, status: 'denied', operation: 'event:append' })
    const conflicting = await execute(
      digestA, ATTEMPTS, 'calendar:read', { cursor: null },
    )
    expect(conflicting).toMatchObject({ status: 'denied', operation: 'calendar:read' })
  })

  it('denies an operation nobody wrote down', async () => {
    const denied = await execute(digestA, ATTEMPTS, 'preferences:write', { anything: 1 })
    expect(denied).toMatchObject({ status: 'denied', operation: 'preferences:write' })
  })
})

describe.sequential('N1 event:append', () => {
  it('appends a minimized event and records the kind it was told', async () => {
    const result = await execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.append.1',
      idempotencyKey: 'idem.append.1',
      eventKind: 'segment_completed',
      payload: { schema_version: 1, segment_id: 'segment.1', outcome_code: 'completed' },
    }))
    expect(result).toMatchObject({ schemaVersion: 1, status: 'ok', operation: 'event:append' })
    expect(result.body).toEqual({ status: 'appended' })

    const row = await database.query<{
      event_kind: string
      household_id: string
      student_id: string
      minimized_payload: Record<string, unknown>
      sequence_number: string
    }>(
      `select event_kind, household_id, student_id, minimized_payload, sequence_number
       from public.academy_study_event_ledger
       where session_id = 'session-a' and event_id = 'event.append.1'`,
    )
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0].event_kind).toBe('segment_completed')
    expect(row.rows[0].household_id).toBe(HOUSEHOLD_A)
    expect(row.rows[0].student_id).toBe(STUDENT_A)
    expect(row.rows[0].minimized_payload).toEqual({
      schema_version: 1, segment_id: 'segment.1', outcome_code: 'completed',
    })
  })

  it('reports an exact replay as duplicate-ignored without a second row', async () => {
    const request = eventRequest({
      eventId: 'event.replay.1',
      idempotencyKey: 'idem.replay.1',
      eventKind: 'session_started',
      payload: { schema_version: 1, state_to: 'active' },
    })
    expect((await execute(digestA, ATTEMPTS, 'event:append', request)).body)
      .toEqual({ status: 'appended' })
    expect((await execute(digestA, ATTEMPTS, 'event:append', request)).body)
      .toEqual({ status: 'duplicate-ignored' })
    const count = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.academy_study_event_ledger
       where session_id = 'session-a' and event_id = 'event.replay.1'`,
    )
    expect(count.rows[0].count).toBe(1)
  })

  it('reports a reused idempotency key under a new event id as a collision', async () => {
    await execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.collide.a', idempotencyKey: 'idem.collide',
    }))
    const collided = await execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.collide.b', idempotencyKey: 'idem.collide',
    }))
    expect(collided.body).toEqual({ status: 'idempotency-collision' })
    const count = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.academy_study_event_ledger
       where session_id = 'session-a' and idempotency_key = 'idem.collide'`,
    )
    expect(count.rows[0].count).toBe(1)
  })

  it('reports a reused event id carrying a different payload as a collision', async () => {
    await execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.repayload', idempotencyKey: 'idem.repayload.a',
      eventKind: 'segment_completed',
      payload: { schema_version: 1, segment_id: 'segment.1', outcome_code: 'completed' },
    }))
    const collided = await execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.repayload', idempotencyKey: 'idem.repayload.b',
      eventKind: 'segment_completed',
      payload: { schema_version: 1, segment_id: 'segment.1', outcome_code: 'partial' },
    }))
    expect(collided.body).toEqual({ status: 'idempotency-collision' })
    const stored = await database.query<{ outcome: string }>(
      `select minimized_payload ->> 'outcome_code' as outcome
       from public.academy_study_event_ledger
       where session_id = 'session-a' and event_id = 'event.repayload'`,
    )
    expect(stored.rows[0].outcome).toBe('completed')
  })

  it('refuses a session belonging to another household and learner', async () => {
    await expect(execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      sessionId: 'session-b', eventId: 'event.foreign', idempotencyKey: 'idem.foreign',
    }))).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    const leaked = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.academy_study_event_ledger
       where session_id = 'session-b'`,
    )
    expect(leaked.rows[0].count).toBe(0)
  })

  it('refuses an event kind this lane does not admit', async () => {
    // Known to the ledger's payload validator, deliberately absent from the
    // learner authority: the server-appended tutor acceptance record.
    await expect(execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.kind.tutor', idempotencyKey: 'idem.kind.tutor',
      eventKind: 'tutor_event_accepted', payload: { schema_version: 1 },
    }))).rejects.toThrow(/STUDY_EVENT_INVALID/)
    await expect(execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.kind.unknown', idempotencyKey: 'idem.kind.unknown',
      eventKind: 'study.invented-kind', payload: { schema_version: 1 },
    }))).rejects.toThrow(/STUDY_EVENT_INVALID/)
  })

  it('refuses a payload that is not the exact schema for its kind', async () => {
    for (const payload of [
      // Extra key.
      { schema_version: 1, state_to: 'active', extra: 'x' },
      // Missing key.
      { schema_version: 1 },
      // Value outside the enumerated domain.
      { schema_version: 1, state_to: 'in_progress' },
      // Right shape, wrong kind's shape.
      { schema_version: 1, segment_id: 'segment.1', outcome_code: 'completed' },
    ]) {
      await expect(execute(digestA, ATTEMPTS, 'event:append', eventRequest({
        eventId: 'event.payload.reject', idempotencyKey: 'idem.payload.reject', payload,
      })), JSON.stringify(payload)).rejects.toThrow(/STUDY_EVENT_INVALID/)
    }
  })

  it('refuses free-form learner prose in the ledger', async () => {
    await expect(execute(digestA, ATTEMPTS, 'event:append', eventRequest({
      eventId: 'event.prose', idempotencyKey: 'idem.prose',
      payload: { schema_version: 1, state_to: 'active', transcript: 'I think the answer is 7' },
    }))).rejects.toThrow(/STUDY_EVENT_INVALID/)
    const leaked = await database.query<{ count: number }>(
      `select count(*)::integer as count from public.academy_study_event_ledger
       where minimized_payload::text ilike '%answer is%'`,
    )
    expect(leaked.rows[0].count).toBe(0)
  })

  it('refuses a request that carries any key beyond the exact five', async () => {
    for (const extra of [{ learnerRef: 'learner-1' }, { householdId: HOUSEHOLD_B }, { studentId: STUDENT_B }]) {
      await expect(execute(digestA, ATTEMPTS, 'event:append', {
        ...eventRequest({ eventId: 'event.extra', idempotencyKey: 'idem.extra' }),
        ...extra,
      }), JSON.stringify(extra)).rejects.toThrow(/STUDY_RUNTIME_REQUEST_INVALID/)
    }
  })

  it('files the event under the grant, never under a value the client sent', async () => {
    const audit = await database.query<{
      actor_kind: string
      household_id: string
      student_id: string
      metadata: Record<string, unknown>
    }>(
      `select actor_kind, household_id, student_id, metadata
       from public.academy_study_audit_events
       where target_id = 'event.append.1' and event_type = 'event.accept'`,
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0]).toMatchObject({
      actor_kind: 'student', household_id: HOUSEHOLD_A, student_id: STUDENT_A,
    })
    expect(audit.rows[0].metadata).toMatchObject({
      event_kind: 'segment_completed', result_code: 'appended',
    })
  })
})

describe.sequential('N2 calendar:transition', () => {
  it('starts a scheduled block and advances the revision', async () => {
    await seedBlock('block.start', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    const result = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.start', at: nowIso, idempotencyKey: 'calendar.start.1',
    }))
    expect(result.body).toEqual({ status: 'stored', revision: 2 })
    expect(await blockRow('block.start')).toMatchObject({ state: 'in_progress', revision: 2 })
  })

  it('completes an in-progress block and settles its completion units', async () => {
    await seedBlock('block.complete', HOUSEHOLD_A, STUDENT_A, 'in_progress')
    const result = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.complete', transition: 'complete', at: nowIso,
      idempotencyKey: 'calendar.complete.1',
    }))
    expect(result.body).toEqual({ status: 'stored', revision: 2 })
    const row = await blockRow('block.complete')
    expect(row).toMatchObject({ state: 'completed', completion_units: 4, required_units: 4 })
  })

  it('leaves everything the transition does not own untouched', async () => {
    const row = await blockRow('block.start')
    expect(row).toMatchObject({ block_type: 'lesson', duration_minutes: 30 })
    expect(new Date(row.scheduled_start as string).toISOString()).toBe('2026-08-09T14:00:00.000Z')
  })

  it('requires a pause category on pause and refuses one anywhere else', async () => {
    await seedBlock('block.pause', HOUSEHOLD_A, STUDENT_A, 'in_progress')
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.pause', transition: 'pause', at: nowIso,
      idempotencyKey: 'calendar.pause.missing',
    }))).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.pause', transition: 'pause', at: nowIso,
      pauseCategory: 'invented-category', idempotencyKey: 'calendar.pause.bad',
    }))).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.pause', transition: 'start', at: nowIso,
      pauseCategory: 'student-request', idempotencyKey: 'calendar.pause.misplaced',
    }))).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    expect(await blockRow('block.pause')).toMatchObject({ state: 'in_progress', revision: 1 })

    const paused = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.pause', transition: 'pause', at: nowIso,
      pauseCategory: 'student-request', idempotencyKey: 'calendar.pause.ok',
    }))
    expect(paused.body).toEqual({ status: 'stored', revision: 2 })
    expect(await blockRow('block.pause')).toMatchObject({ state: 'available' })
    const audit = await database.query<{ reason_code: string; metadata: Record<string, unknown> }>(
      `select reason_code, metadata from public.academy_study_audit_events
       where target_id = 'block.pause' and event_type = 'calendar.schedule'`,
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].reason_code).toBe('student-request')
    expect(audit.rows[0].metadata).toMatchObject({ state_from: 'in_progress', state_to: 'available' })
  })

  it('fails closed on a transition that is illegal from the current state', async () => {
    await seedBlock('block.illegal', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    for (const transition of ['complete', 'pause']) {
      await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
        blockId: 'block.illegal', transition, at: nowIso,
        pauseCategory: transition === 'pause' ? 'student-request' : null,
        idempotencyKey: `calendar.illegal.${transition}`,
      })), transition).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_ILLEGAL/)
    }
    // Not a no-op that reports success, and not a silent write either.
    expect(await blockRow('block.illegal')).toMatchObject({ state: 'scheduled', revision: 1 })
  })

  it('refuses a target state the client tries to name directly', async () => {
    await seedBlock('block.named', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    for (const transition of ['completed', 'cancelled', 'in_progress']) {
      await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
        blockId: 'block.named', transition, at: nowIso,
        idempotencyKey: `calendar.named.${transition}`,
      })), transition).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    }
    expect(await blockRow('block.named')).toMatchObject({ state: 'scheduled' })
  })

  it('reports a stale expected revision as a conflict and writes nothing', async () => {
    await seedBlock('block.cas', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    const conflict = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.cas', expectedRevision: 7, at: nowIso, idempotencyKey: 'calendar.cas.stale',
    }))
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })
    expect(await blockRow('block.cas')).toMatchObject({ state: 'scheduled', revision: 1 })
  })

  it('refuses a missing expected revision instead of reporting a conflict', async () => {
    // Deliberately distinguishable: a conflict hands back currentRevision, which
    // would let a caller that never held a revision learn one and blind-write.
    await seedBlock('block.norev', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    for (const expectedRevision of [null, 0]) {
      await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
        blockId: 'block.norev', expectedRevision, at: nowIso,
        idempotencyKey: `calendar.norev.${expectedRevision}`,
      })), String(expectedRevision)).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    }
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', {
      blockId: 'block.norev', transition: 'start', at: nowIso, segmentRef: null,
      pauseCategory: null, idempotencyKey: 'calendar.norev.absent',
    })).rejects.toThrow(/STUDY_RUNTIME_REQUEST_INVALID/)
    expect(await blockRow('block.norev')).toMatchObject({ state: 'scheduled', revision: 1 })
  })

  it('replays an identical request without applying it twice', async () => {
    await seedBlock('block.replay', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    const request = transitionRequest({
      blockId: 'block.replay', at: nowIso, idempotencyKey: 'calendar.replay.1',
    })
    expect((await execute(digestA, ATTEMPTS, 'calendar:transition', request)).body)
      .toEqual({ status: 'stored', revision: 2 })
    expect((await execute(digestA, ATTEMPTS, 'calendar:transition', request)).body)
      .toEqual({ status: 'stored', revision: 2 })
    expect(await blockRow('block.replay')).toMatchObject({ state: 'in_progress', revision: 2 })
  })

  it('reports a reused idempotency key with different content as a collision', async () => {
    await seedBlock('block.collide', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.collide', at: nowIso, idempotencyKey: 'calendar.collide',
    }))
    const collided = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.collide', transition: 'complete', at: nowIso,
      idempotencyKey: 'calendar.collide',
    }))
    expect(collided.body).toEqual({ status: 'idempotency-collision' })
    expect(await blockRow('block.collide')).toMatchObject({ state: 'in_progress', revision: 2 })
  })

  it('treats a replay whose asserted instant moved as a collision', async () => {
    await seedBlock('block.at', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.at', at: nowIso, idempotencyKey: 'calendar.at.1',
    }))
    const moved = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.at', at: nowPlusIso, idempotencyKey: 'calendar.at.1',
    }))
    expect(moved.body).toEqual({ status: 'idempotency-collision' })
  })

  it('refuses an asserted instant outside the bounded window', async () => {
    await seedBlock('block.window', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    for (const at of ['2999-01-01T00:00:00Z', '2020-01-01T00:00:00Z']) {
      await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
        blockId: 'block.window', at, idempotencyKey: `calendar.window.${at}`,
      })), at).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)
    }
    expect(await blockRow('block.window')).toMatchObject({ state: 'scheduled', revision: 1 })
  })

  it('refuses a block belonging to another household', async () => {
    await seedBlock('block.foreign', HOUSEHOLD_B, STUDENT_B, 'scheduled')
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.foreign', at: nowIso, idempotencyKey: 'calendar.foreign',
    }))).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    expect(await blockRow('block.foreign')).toMatchObject({ state: 'scheduled', revision: 1 })
    // And the household that does own it can still drive it, so the refusal
    // above is about ownership rather than about the block being unusable.
    const owned = await execute(digestB, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.foreign', at: nowIso, idempotencyKey: 'calendar.foreign.owner',
    }))
    expect(owned.body).toEqual({ status: 'stored', revision: 2 })
  })

  it('records a resume segment only where a bound session makes it storable', async () => {
    await seedBlock('block.noresume', HOUSEHOLD_A, STUDENT_A, 'in_progress')
    await expect(execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.noresume', transition: 'pause', at: nowIso,
      pauseCategory: 'student-request', segmentRef: 'segment.9',
      idempotencyKey: 'calendar.noresume',
    }))).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_INVALID/)

    await seedBlock('block.resume', HOUSEHOLD_A, STUDENT_A, 'in_progress', 'session-a')
    const stored = await execute(digestA, ATTEMPTS, 'calendar:transition', transitionRequest({
      blockId: 'block.resume', transition: 'pause', at: nowIso,
      pauseCategory: 'accessibility-need', segmentRef: 'segment.9',
      idempotencyKey: 'calendar.resume',
    }))
    expect(stored.body).toEqual({ status: 'stored', revision: 2 })
    expect(await blockRow('block.resume')).toMatchObject({ resume_segment_id: 'segment.9' })
  })

  it('refuses a request that carries any key beyond the exact seven', async () => {
    await seedBlock('block.extra', HOUSEHOLD_A, STUDENT_A, 'scheduled')
    for (const extra of [
      { learnerRef: 'learner-1' },
      { householdId: HOUSEHOLD_B },
      { state: 'completed' },
      { completionUnits: 4 },
    ]) {
      await expect(execute(digestA, ATTEMPTS, 'calendar:transition', {
        ...transitionRequest({ blockId: 'block.extra', at: nowIso, idempotencyKey: 'calendar.extra' }),
        ...extra,
      }), JSON.stringify(extra)).rejects.toThrow(/STUDY_RUNTIME_REQUEST_INVALID/)
    }
    expect(await blockRow('block.extra')).toMatchObject({ state: 'scheduled', revision: 1 })
  })
})

describe.sequential('reachability and marker', () => {
  it('grants neither learner operation to any role', async () => {
    const result = await database.query<Record<string, boolean>>(`
      select
        has_function_privilege('anon',
          'public.academy_study_append_learner_event_v1(text,text,text,jsonb,text)', 'execute') as append_anon,
        has_function_privilege('authenticated',
          'public.academy_study_append_learner_event_v1(text,text,text,jsonb,text)', 'execute') as append_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_append_learner_event_v1(text,text,text,jsonb,text)', 'execute') as append_service,
        has_function_privilege('anon',
          'public.academy_study_transition_calendar_block_v1(text,bigint,text,timestamptz,text,text,text)', 'execute') as calendar_anon,
        has_function_privilege('authenticated',
          'public.academy_study_transition_calendar_block_v1(text,bigint,text,timestamptz,text,text,text)', 'execute') as calendar_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_transition_calendar_block_v1(text,bigint,text,timestamptz,text,text,text)', 'execute') as calendar_service,
        has_function_privilege('authenticated',
          'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)', 'execute') as executor_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)', 'execute') as executor_service
    `)
    expect(result.rows[0]).toEqual({
      append_anon: false,
      append_authenticated: false,
      append_service: false,
      calendar_anon: false,
      calendar_authenticated: false,
      calendar_service: false,
      executor_authenticated: false,
      executor_service: true,
    })
  })

  it('keeps the adult whole-row calendar upsert off the learner lane', async () => {
    // The only function that writes a whole calendar row authorizes adults only.
    // A learner-session grant reaching it would be the whole-row upsert this
    // card refuses, so the refusal is measured rather than asserted from shape.
    await expect(asRole('service_role', null, () => database.query(`
      select set_config('request.jwt.claims', jsonb_build_object(
        'sub', (select id from academy_private.student_session_grants
                where household_id = '${HOUSEHOLD_A}'::uuid limit 1),
        'role', 'authenticated',
        'academy_principal_kind', 'student_session_grant'
      )::text, true);
      select public.academy_study_upsert_adult_managed_record(
        'calendar', '{}'::jsonb, 1, 'learner.upsert'
      )
    `))).rejects.toThrow()
  })

  it('records the marker and its manifest facts', async () => {
    const result = await database.query<{
      version: number
      names: string[]
      manifest: Record<string, unknown>
    }>(`
      select learner_runtime_operations_version as version, migration_names as names,
        security_manifest as manifest
      from academy_private.study_persistence_metadata where singleton
    `)
    expect(result.rows[0].version).toBe(1)
    expect(result.rows[0].names).toContain('20260809120000_academy_study_learner_runtime_operations')
    expect(result.rows[0].manifest).toMatchObject({
      learner_runtime_operations_version: 1,
      learner_runtime_operation_authority: 'academy_private.study_runtime_operation_contract',
      learner_runtime_operations_added: ['event:append', 'calendar:transition'],
      learner_runtime_preferences_write_present: false,
      learner_runtime_endpoint_count: 1,
      learner_runtime_calendar_whole_row_upsert_reachable: false,
      learner_runtime_operations_directly_executable_by: 'none',
      learner_runtime_calendar_cas_required: true,
    })
  })

  it('refuses to apply twice', async () => {
    const source = await readFile(new URL(LEARNER_RUNTIME_MIGRATION, import.meta.url), 'utf8')
    await expect(database.exec(source)).rejects.toThrow(/STUDY_LEARNER_RUNTIME already applied/)
  })
})
