// Pilot-only smoke test (session CLAUDE-WIN-FAMILY-PILOT-PERSISTENCE-SMOKE-R1).
// Exercises the existing production Study session lifecycle RPC
// (academy_study_execute_session_lifecycle_v2) against a local PGlite instance.
// No production runtime code is touched or modified by this file.
//
// This file lives under supabase/ (not tests/family-pilot/persistence/) because
// vite.config.ts only routes supabase/**/*.test.ts to the "root-supabase"
// vitest project, which runs PGlite-backed files sequentially with a single
// worker. tests/**/*.test.js would land in "root-app" (parallel workers) and
// would not even match a .ts file, since that project's include glob is JS-only.
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  '../../schema.sql',
  '../../migrations/20260724230000_academy_student_identity_foundation.sql',
  '../../migrations/20260801010000_academy_study_engine_storage.sql',
  '../../migrations/20260801011000_academy_study_engine_authorization.sql',
  '../../migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  '../../migrations/20260801160000_academy_study_verified_identity.sql',
  '../../migrations/20260801170000_academy_study_adult_review_operations.sql',
  '../../migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  '../../tests/study_engine_fixtures.sql',
  '../../migrations/20260809160000_academy_curriculum_release_registry.sql',
  '../../migrations/20260810120200_academy_study_effective_settings_v2.sql',
  '../../migrations/20260810150000_academy_study_curriculum_binding.sql',
  '../../migrations/20260810151000_academy_study_session_semantics_v2.sql',
  '../../migrations/20260810153000_academy_study_release_registry_bridge.sql',
  '../../migrations/20260810159100_academy_study_session_timestamp_coherence.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'

const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'

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

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, operation)
}

async function runtime(
  tokenDigest: string,
  operation: string,
  request: Record<string, unknown>,
) {
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
  `, [tokenDigest, capability, operation, JSON.stringify(request)]))
}

function checkpointPayload(
  sessionId: string, revision: number, lessonId: string, segmentId: string,
) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: `checkpoint-${sessionId}`,
    revision,
    createdAt: '2026-08-12T15:01:00.000Z',
    updatedAt: `2026-08-12T15:0${revision + 1}:00.000Z`,
    sessionId,
    lessonId,
    segmentId,
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-pilot-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [{ segmentId, activeSeconds: 12 }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: `tutor-state:${sessionId}`,
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-pilot-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

interface Learner {
  household: string
  student: string
  guardian: string
  tokenDigest: string
  beginRequest: Record<string, unknown>
}

async function issueLearner(
  guardian: string,
  household: string,
  student: string,
  enrollmentId: string,
  lessonId: string,
  intendedLocalDate: string,
): Promise<Learner> {
  await database.exec(`
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, starts_on, placement_source
    ) values (
      '${enrollmentId}',
      '${household}', '${student}', '2026-2027', 'mathematics',
      'grade-5', 'ma-g5-mathematics', '1.0.0',
      'active', '2026-08-01', 'parent'
    );
  `)
  const issued = await asRole('authenticated', guardian, () => rpc<{ sessionReference: string }>(
    'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
    ['academy-student-id', student],
  ))
  const { createHash } = await import('node:crypto')
  const tokenDigest = createHash('sha256').update(issued.sessionReference, 'ascii').digest('hex')
  return {
    household,
    student,
    guardian,
    tokenDigest,
    beginRequest: {
      idempotencyKey: `begin-${lessonId}`,
      lessonId,
      subjectId: 'math',
      studyPlanId: null,
      intendedLocalDate,
      initialSegmentId: 'segment-pilot-a',
      curriculumContext: {
        releaseVersion: '1.0.0',
        lessonRef: lessonId,
        skillRefs: ['skill-pilot-a'],
      },
    },
  }
}

let learnerA: Learner
let learnerB: Learner
let sessionAId: string

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
  const currentLocalDate = (await database.query<{ local_date: string }>(`
    select to_char(clock_timestamp() at time zone 'America/New_York', 'YYYY-MM-DD') as local_date
  `)).rows[0].local_date
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where household_id in ('${HOUSEHOLD_A}', '${HOUSEHOLD_B}');
  `)
  learnerA = await issueLearner(
    GUARDIAN_A, HOUSEHOLD_A, STUDENT_A,
    '15100000-0000-4000-8000-000000000001', 'lesson-pilot-a', currentLocalDate,
  )
  learnerB = await issueLearner(
    GUARDIAN_B, HOUSEHOLD_B, STUDENT_B,
    '15200000-0000-4000-8000-000000000002', 'lesson-pilot-b', currentLocalDate,
  )
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('family pilot — supervised learner progress persistence smoke', () => {
  it('learner A starts a session, checkpoints progress, and reads it back', async () => {
    const begun = await runtime(learnerA.tokenDigest, 'session:begin', learnerA.beginRequest)
    expect(begun.body).toMatchObject({ status: 'begun', state: 'active', revision: 1 })
    sessionAId = begun.body.sessionId as string

    const stored = await runtime(learnerA.tokenDigest, 'checkpoint:compare-and-swap', {
      sessionId: sessionAId,
      expectedRevision: 0,
      mutationId: 'checkpoint-pilot-a-1',
      checkpoint: checkpointPayload(sessionAId, 1, 'lesson-pilot-a', 'segment-pilot-a'),
      curriculumReleaseVersion: '1.0.0',
    })
    expect(stored.body).toMatchObject({ status: 'stored', checkpointRevision: 1 })

    const read = await runtime(learnerA.tokenDigest, 'checkpoint:read', {
      sessionId: sessionAId, curriculumReleaseVersion: '1.0.0',
    })
    expect(read.body).toMatchObject({
      status: 'found',
      checkpoint: { checkpointId: `checkpoint-${sessionAId}`, revision: 1 },
    })
  })

  it('a fresh RPC call (simulating an app restart) resumes with the same stored state', async () => {
    // A real client would only have the sessionId persisted locally after a
    // restart, not any in-memory RPC state — so this deliberately issues a
    // brand-new runtime() call rather than reusing anything from the prior test.
    const resumed = await runtime(learnerA.tokenDigest, 'session:resume', {
      sessionId: sessionAId, curriculumReleaseVersion: '1.0.0',
    })
    expect(resumed.body).toMatchObject({
      status: 'resumable',
      state: 'active',
      revision: 1,
      checkpoint: { checkpointId: `checkpoint-${sessionAId}`, revision: 1 },
    })
  })

  it('retrying the same checkpoint write does not duplicate or corrupt stored progress', async () => {
    const replay = await runtime(learnerA.tokenDigest, 'checkpoint:compare-and-swap', {
      sessionId: sessionAId,
      expectedRevision: 0,
      mutationId: 'checkpoint-pilot-a-1',
      checkpoint: checkpointPayload(sessionAId, 1, 'lesson-pilot-a', 'segment-pilot-a'),
      curriculumReleaseVersion: '1.0.0',
    })
    expect(replay.body).toMatchObject({ status: 'stored', checkpointRevision: 1 })

    const rowCount = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_study_checkpoints where session_id = $1
    `, [sessionAId])
    expect(rowCount.rows[0].count).toBe(1)

    const conflicting = await runtime(learnerA.tokenDigest, 'checkpoint:compare-and-swap', {
      sessionId: sessionAId,
      expectedRevision: 0,
      mutationId: 'checkpoint-pilot-a-1',
      checkpoint: {
        ...checkpointPayload(sessionAId, 1, 'lesson-pilot-a', 'segment-pilot-a'),
        pausedSeconds: 99,
      },
      curriculumReleaseVersion: '1.0.0',
    })
    expect(conflicting.body).toEqual({ schemaVersion: 2, status: 'idempotency-collision' })

    // Same expectedRevision as the very first write (0), but the checkpoint
    // has already advanced to revision 1 in between — a stale-state retry.
    const stale = await runtime(learnerA.tokenDigest, 'checkpoint:compare-and-swap', {
      sessionId: sessionAId,
      expectedRevision: 0,
      mutationId: 'checkpoint-pilot-a-2',
      checkpoint: checkpointPayload(sessionAId, 1, 'lesson-pilot-a', 'segment-pilot-a'),
      curriculumReleaseVersion: '1.0.0',
    })
    expect(stale.body).toMatchObject({
      status: 'revision-conflict', currentCheckpointRevision: 1,
    })

    const unchanged = await database.query<{ revision: number }>(`
      select revision from public.academy_study_checkpoints where session_id = $1
    `, [sessionAId])
    expect(unchanged.rows).toEqual([{ revision: 1 }])
  })

  it('learner B starts an independent session while learner A stays untouched (isolation)', async () => {
    const begunB = await runtime(learnerB.tokenDigest, 'session:begin', learnerB.beginRequest)
    expect(begunB.body).toMatchObject({ status: 'begun', state: 'active', revision: 1 })
    const sessionBId = begunB.body.sessionId as string
    expect(sessionBId).not.toBe(sessionAId)

    const storedB = await runtime(learnerB.tokenDigest, 'checkpoint:compare-and-swap', {
      sessionId: sessionBId,
      expectedRevision: 0,
      mutationId: 'checkpoint-pilot-b-1',
      checkpoint: checkpointPayload(sessionBId, 1, 'lesson-pilot-b', 'segment-pilot-a'),
      curriculumReleaseVersion: '1.0.0',
    })
    expect(storedB.body).toMatchObject({ status: 'stored', checkpointRevision: 1 })

    // Learner A's session and checkpoint must be byte-for-byte unaffected by
    // any of learner B's writes.
    const readA = await runtime(learnerA.tokenDigest, 'checkpoint:read', {
      sessionId: sessionAId, curriculumReleaseVersion: '1.0.0',
    })
    expect(readA.body).toMatchObject({
      status: 'found',
      checkpoint: { checkpointId: `checkpoint-${sessionAId}`, revision: 1 },
    })

    const crossHouseholdRows = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_study_checkpoints
      where session_id = $1 and household_id <> $2
    `, [sessionAId, HOUSEHOLD_A])
    expect(crossHouseholdRows.rows[0].count).toBe(0)

    const sessionRows = await database.query<{ id: string; household_id: string }>(`
      select id, household_id from public.academy_study_sessions
      where id in ($1, $2) order by id
    `, [sessionAId, sessionBId])
    expect(sessionRows.rows).toEqual([
      { id: sessionAId, household_id: HOUSEHOLD_A },
      { id: sessionBId, household_id: HOUSEHOLD_B },
    ].sort((left, right) => left.id.localeCompare(right.id)))
  })

  it('cross-learner access and malformed writes fail closed instead of raw database errors', async () => {
    // Learner B's own valid credential, pointed at learner A's session, must
    // be denied through the same structured response shape — not a thrown
    // Postgres error and not a silent leak of A's progress.
    await expect(runtime(learnerB.tokenDigest, 'checkpoint:read', {
      sessionId: sessionAId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'study-session-unavailable' },
    })
    await expect(runtime(learnerB.tokenDigest, 'session:resume', {
      sessionId: sessionAId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'study-session-unavailable' },
    })

    // A caller-authored studentId is rejected with a named, structured error
    // code — never an unhandled/opaque database exception.
    await expect(runtime(learnerA.tokenDigest, 'session:begin', {
      ...learnerA.beginRequest,
      idempotencyKey: 'begin-pilot-a-tampered',
      studentId: STUDENT_B,
    })).rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)

    // A malformed checkpoint read (missing a required key) is rejected the
    // same closed way, not with a raw SQL/column-not-found crash.
    await expect(runtime(learnerA.tokenDigest, 'checkpoint:read', {
      sessionId: sessionAId,
    })).rejects.toThrow(/STUDY_CHECKPOINT_READ_INVALID/)
  })
})
