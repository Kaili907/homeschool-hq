import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260808121000_academy_operational_events.sql',
  './tests/study_engine_fixtures.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810151000_academy_study_session_semantics_v2.sql',
  './migrations/20260810155000_academy_study_session_telemetry_outbox.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'

let database: PGlite
let sessionDigest: string
let sessionId: string
let abandonedSessionId: string
let currentLocalDate: string

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

async function asRole<T>(
  role: 'authenticated' | 'service_role',
  subject: string | null,
  run: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) })
    .replaceAll("'", "''")
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

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function guardian<T>(operation: () => Promise<T>) {
  return asRole('authenticated', GUARDIAN_A, operation)
}

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, operation)
}

async function runtime(operation: string, request: Record<string, unknown>) {
  const capability = ['session:resume', 'checkpoint:read'].includes(operation)
    ? 'student:progress:read'
    : 'student:attempts:create'
  return service(() => rpc<{
    schemaVersion: number
    status: string
    operation: string
    body: Record<string, unknown>
  }>(`
    select public.academy_study_execute_session_lifecycle_v2(
      $1::text, $2::text, $3::text, $4::jsonb
    ) as result
  `, [sessionDigest, capability, operation, JSON.stringify(request)]))
}

function beginRequest(idempotencyKey: string) {
  return {
    idempotencyKey,
    lessonId: 'lesson-production-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: currentLocalDate,
    initialSegmentId: 'segment-production-a',
    curriculumContext: {
      releaseVersion: '1.0.0',
      lessonRef: 'lesson-production-a',
      skillRefs: ['skill-production-a'],
    },
  }
}

function transition(
  targetSessionId: string,
  expectedRevision: number,
  idempotencyKey: string,
  type: string,
  segmentId: string | null,
) {
  return runtime('session:transition', {
    sessionId: targetSessionId,
    expectedRevision,
    idempotencyKey,
    curriculumReleaseVersion: '1.0.0',
    transition: { type, segmentId },
  })
}

function checkpoint(revision: number) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: `checkpoint-${sessionId}`,
    revision,
    createdAt: '1999-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
    sessionId,
    lessonId: 'lesson-production-a',
    segmentId: 'segment-production-b',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice', cycleNumber: 1,
      currentItemId: 'task-production-a', currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: ['segment-production-a'],
    perSegmentActiveTime: [
      { segmentId: 'segment-production-a', activeSeconds: 30 },
    ],
    pausedSeconds: 5,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: `tutor-state:${sessionId}`,
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-production-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

async function countOutbox() {
  return (await database.query<{ count: number }>(`
    select count(*)::integer as count
    from academy_private.study_session_telemetry_outbox
  `)).rows[0].count
}

async function claim(limit = 100, leaseSeconds = 30) {
  return service(() => rpc<Array<Record<string, unknown>>>(`
    select public.academy_claim_study_session_telemetry_outbox_v1($1, $2)
      as result
  `, [limit, leaseSeconds]))
}

function operationalFacts(item: Record<string, unknown>) {
  return {
    schema_version: 2,
    scope: 'household',
    household_id: item.householdRef,
    learner_id: null,
    engine: 'study',
    app_version: 'deploy.2026.08.10',
    engine_version: 'study.v2',
    curriculum_version: item.curriculumVersion,
    course_ref: null,
    unit_ref: null,
    lesson_ref: item.lessonRef,
    skill_ref: null,
    event_type: 'study.session',
    result: item.result,
    duration_ms: null,
    metadata: {
      operation: item.operation,
      reason_code: item.reasonCode,
      source: 'study-session-outbox',
    },
  }
}

async function record(item: Record<string, unknown>) {
  return service(() => rpc<Record<string, unknown>>(`
    select public.academy_record_operational_event_v2($1, $2::jsonb) as result
  `, [item.executionKey, JSON.stringify(operationalFacts(item))]))
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const [index, source] of (await sql).entries()) {
    try {
      await database.exec(source)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  currentLocalDate = (await database.query<{ local_date: string }>(`
    select to_char(clock_timestamp() at time zone 'America/New_York', 'YYYY-MM-DD') as local_date
  `)).rows[0].local_date
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id = '00000000-0000-0000-0000-0000000001a1'::uuid;
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, starts_on, placement_source
    ) values (
      '15500000-0000-4000-8000-000000000001',
      '${HOUSEHOLD_A}', '${STUDENT_A}', '2026-2027', 'mathematics',
      'grade-5', 'ma-g5-mathematics', '1.0.0',
      'active', '2026-08-01', 'parent'
    );
  `)
  const issued = await guardian(() => rpc<{ sessionReference: string }>(
    'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
    ['academy-student-id', STUDENT_A],
  ))
  sessionDigest = createHash('sha256')
    .update(issued.sessionReference, 'ascii')
    .digest('hex')
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study session telemetry transactional outbox', () => {
  it('is private, forced-RLS, service-only, and reports ready', async () => {
    await expect(service(() => rpc(
      'select public.academy_study_session_telemetry_outbox_readiness_v1() as result',
    ))).resolves.toEqual({ schemaVersion: 1, status: 'ready' })

    const catalog = await database.query<{
      relrowsecurity: boolean
      relforcerowsecurity: boolean
      student_column_count: number
    }>(`
      select c.relrowsecurity, c.relforcerowsecurity,
        count(a.attname) filter (where a.attname in (
          'student_id', 'learner_id', 'user_id'
        ))::integer as student_column_count
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      left join pg_catalog.pg_attribute as a
        on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'academy_private'
        and c.relname = 'study_session_telemetry_outbox'
      group by c.relrowsecurity, c.relforcerowsecurity
    `)
    expect(catalog.rows).toEqual([{
      relrowsecurity: true,
      relforcerowsecurity: true,
      student_column_count: 0,
    }])
    await expect(asRole('authenticated', GUARDIAN_A, () =>
      database.query('select * from academy_private.study_session_telemetry_outbox')))
      .rejects.toThrow()
    await expect(asRole('authenticated', GUARDIAN_A, () =>
      database.query('select public.academy_claim_study_session_telemetry_outbox_v1(1, 30)')))
      .rejects.toThrow()
  })

  it('creates one server-authoritative begin receipt and replays without duplication', async () => {
    const begun = await runtime('session:begin', beginRequest('telemetry-begin-a'))
    expect(begun.body).toMatchObject({ status: 'begun', revision: 1 })
    sessionId = begun.body.sessionId as string

    const row = await database.query<{
      operation: string
      result: string
      session_revision: number
      accepted_by_server: boolean
      execution_key: string
    }>(`
      select outbox.operation, outbox.result, outbox.session_revision,
        outbox.accepted_at = session.accepted_at as accepted_by_server,
        outbox.execution_key
      from academy_private.study_session_telemetry_outbox as outbox
      join public.academy_study_sessions as session
        on session.id = outbox.session_id
      where outbox.session_id = $1
    `, [sessionId])
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0]).toMatchObject({
      operation: 'begin',
      result: 'success',
      session_revision: 1,
      accepted_by_server: true,
    })
    expect(row.rows[0].execution_key).toMatch(/^study:session:[0-9a-f]{64}$/)

    await runtime('session:begin', beginRequest('telemetry-begin-a'))
    expect(await countOutbox()).toBe(1)
  })

  it('does not emit false success for rejected, conflicting, or caller-tampered mutations', async () => {
    const before = await countOutbox()
    await expect(transition(
      sessionId, 99, 'telemetry-stale-a', 'segment-completed',
      'segment-production-a',
    )).resolves.toMatchObject({ body: { status: 'revision-conflict' } })
    await expect(transition(
      sessionId, 1, 'telemetry-invalid-a', 'break-ended', null,
    )).resolves.toMatchObject({ body: { status: 'invalid-transition' } })
    await expect(runtime('session:begin', {
      ...beginRequest('telemetry-tamper-a'),
      acceptedAt: '1999-01-01T00:00:00.000Z',
    })).rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)
    expect(await countOutbox()).toBe(before)
  })

  it('covers transition, checkpoint, resume, completion, and abandonment once each', async () => {
    const segmentComplete = await transition(
      sessionId, 1, 'telemetry-segment-complete-a',
      'segment-completed', 'segment-production-a',
    )
    expect(segmentComplete.body).toMatchObject({ status: 'stored', revision: 2 })

    const checkpointStartedAt = Date.now()
    const checkpointResult = await runtime('checkpoint:compare-and-swap', {
      sessionId,
      expectedRevision: 0,
      mutationId: 'telemetry-checkpoint-a',
      checkpoint: checkpoint(1),
      curriculumReleaseVersion: '1.0.0',
    })
    expect(checkpointResult.body).toMatchObject({
      status: 'stored', sessionRevision: 2, checkpointRevision: 1,
    })
    const checkpointReceipt = (await database.query<{
      accepted_at: string
      checkpoint_revision: number
    }>(`
      select accepted_at::text, checkpoint_revision
      from academy_private.study_session_telemetry_outbox
      where session_id = $1 and operation = 'checkpoint'
    `, [sessionId])).rows[0]
    expect(checkpointReceipt.checkpoint_revision).toBe(1)
    expect(Date.parse(checkpointReceipt.accepted_at)).toBeGreaterThanOrEqual(
      checkpointStartedAt - 5_000,
    )
    expect(Date.parse(checkpointReceipt.accepted_at)).toBeLessThanOrEqual(
      Date.now() + 5_000,
    )

    await expect(runtime('session:resume', {
      sessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({ body: { status: 'resumable', revision: 2 } })
    const afterResume = await countOutbox()
    await runtime('session:resume', { sessionId, curriculumReleaseVersion: '1.0.0' })
    expect(await countOutbox()).toBe(afterResume)

    await expect(transition(
      sessionId, 2, 'telemetry-complete-a', 'session-completed', null,
    )).resolves.toMatchObject({ body: { status: 'stored', revision: 3 } })
    await runtime('session:resume', { sessionId, curriculumReleaseVersion: '1.0.0' })

    const abandoned = await runtime('session:begin', beginRequest('telemetry-begin-abandon'))
    abandonedSessionId = abandoned.body.sessionId as string
    await expect(transition(
      abandonedSessionId, 1, 'telemetry-abandon-a',
      'session-abandoned', 'segment-production-a',
    )).resolves.toMatchObject({ body: { status: 'stored', revision: 2 } })

    const rows = await database.query<{
      operation: string
      reason_code: string
      session_revision: number
    }>(`
      select operation, reason_code, session_revision
      from academy_private.study_session_telemetry_outbox
      order by created_at, outbox_id
    `)
    expect(rows.rows.map((row) => row.operation)).toEqual([
      'begin', 'transition', 'checkpoint', 'resume',
      'complete', 'resume', 'begin', 'abandon',
    ])
    expect(rows.rows).toContainEqual({
      operation: 'complete', reason_code: 'session-completed', session_revision: 3,
    })
    expect(rows.rows).toContainEqual({
      operation: 'abandon', reason_code: 'session-abandoned', session_revision: 2,
    })
  })

  it('claims without overlap, retains failures for retry, and leaves committed sessions authoritative', async () => {
    const claims = await claim()
    expect(claims).toHaveLength(8)
    expect(await claim()).toEqual([])
    expect(new Set(claims.map((item) => item.outboxId)).size).toBe(8)
    expect(JSON.stringify(claims)).not.toMatch(
      /student|learner|answer|transcript|prompt|response|audio|emotion|personality|diagnos|secret|raw.?error/i,
    )

    const retryItem = claims[0]
    await expect(service(() => rpc(`
      select public.academy_retry_study_session_telemetry_outbox_v1(
        $1::uuid, $2::uuid, $3::text
      ) as result
    `, [retryItem.outboxId, retryItem.leaseToken, 'raw database exception'])))
      .rejects.toThrow(/STUDY_TELEMETRY_FAILURE_INVALID/)
    await expect(service(() => rpc(`
      select public.academy_retry_study_session_telemetry_outbox_v1(
        $1::uuid, $2::uuid, 'telemetry_unavailable'
      ) as result
    `, [retryItem.outboxId, retryItem.leaseToken]))).resolves.toBe(true)

    const states = await database.query<{ id: string; state: string; revision: number }>(`
      select id, state, revision from public.academy_study_sessions
      where id in ($1, $2) order by id
    `, [sessionId, abandonedSessionId])
    expect(states.rows).toEqual(expect.arrayContaining([
      { id: sessionId, state: 'completed', revision: 3 },
      { id: abandonedSessionId, state: 'abandoned', revision: 2 },
    ]))

    await database.query(`
      update academy_private.study_session_telemetry_outbox
      set available_at = statement_timestamp()
      where outbox_id = $1
    `, [retryItem.outboxId])
    const reclaimed = await claim()
    expect(reclaimed).toHaveLength(1)
    expect(reclaimed[0]).toMatchObject({
      outboxId: retryItem.outboxId,
      executionKey: retryItem.executionKey,
      attemptCount: 2,
    })

    const allClaims = [...claims.slice(1), reclaimed[0]]
    for (const item of allClaims) {
      const written = await record(item)
      expect(written).toMatchObject({ status: 'created' })
      const event = written.event as Record<string, unknown>
      await expect(service(() => rpc(`
        select public.academy_complete_study_session_telemetry_outbox_v1(
          $1::uuid, $2::uuid, $3::uuid
        ) as result
      `, [item.outboxId, item.leaseToken, event.eventId]))).resolves.toBe(true)
    }
    expect(await claim()).toEqual([])
  })

  it('deduplicates delivery and durably marks every receipt delivered', async () => {
    const first = (await database.query<Record<string, unknown>>(`
      select execution_key as "executionKey", household_id as "householdRef",
        operation, result, curriculum_version as "curriculumVersion",
        lesson_ref as "lessonRef", reason_code as "reasonCode"
      from academy_private.study_session_telemetry_outbox
      order by accepted_at, outbox_id limit 1
    `)).rows[0]
    await expect(record(first)).resolves.toMatchObject({ status: 'replayed' })

    const counts = await database.query<{
      outbox_count: number
      delivered_count: number
      event_count: number
    }>(`
      select
        (select count(*)::integer
         from academy_private.study_session_telemetry_outbox) as outbox_count,
        (select count(*)::integer
         from academy_private.study_session_telemetry_outbox
         where delivery_state = 'delivered') as delivered_count,
        (select count(*)::integer
         from public.academy_operational_events
         where engine = 'study' and event_type = 'study.session') as event_count
    `)
    expect(counts.rows).toEqual([{
      outbox_count: 8,
      delivered_count: 8,
      event_count: 8,
    }])
  })
})
