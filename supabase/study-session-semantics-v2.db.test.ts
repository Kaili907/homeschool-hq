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
  './tests/study_engine_fixtures.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810151000_academy_study_session_semantics_v2.sql',
  './migrations/20260810153000_academy_study_release_registry_bridge.sql',
  './migrations/20260810159100_academy_study_session_timestamp_coherence.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const RELEASE_ID = '16000000-0000-4000-8000-000000000001'
const RELEASE_2_ID = '26000000-0000-4000-8000-000000000002'
const MANIFEST_2_SHA = 'b'.repeat(64)

let database: PGlite
let sessionDigest: string
let sessionId: string
let beginRequest: Record<string, unknown>
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

function transition(
  expectedRevision: number,
  idempotencyKey: string,
  type: string,
  segmentId: string | null,
  curriculumReleaseVersion = '1.0.0',
) {
  return runtime('session:transition', {
    sessionId,
    expectedRevision,
    idempotencyKey,
    curriculumReleaseVersion,
    transition: { type, segmentId },
  })
}

function checkpoint(revision: number) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: `checkpoint-${sessionId}`,
    revision,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: `2026-08-10T15:0${revision + 1}:00.000Z`,
    sessionId,
    lessonId: 'lesson-production-a',
    segmentId: 'segment-production-b',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-production-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: ['segment-production-a'],
    perSegmentActiveTime: [
      { segmentId: 'segment-production-a', activeSeconds: 30 },
      { segmentId: 'segment-production-b', activeSeconds: 10 },
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

async function registerRelease2() {
  await database.exec(`
    insert into public.academy_curriculum_releases (
      release_id, package_id, version, status, registered_at, authored_on,
      provenance_class, source_commit, source_root,
      package_manifest_sha256, checksum_manifest_sha256,
      curriculum_manifest_sha256, file_inventory_sha256,
      file_count, byte_count, course_count, unit_count, lesson_count,
      assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    )
    select
      '${RELEASE_2_ID}', 'manuel-academy-grades-5-7-8-curriculum-v2',
      '2.0.0', 'published', '2026-08-10T15:35:00Z', '2026-08-10',
      'legacy_import', '${'2'.repeat(40)}',
      'curriculum-content/manuel-academy/2.0.0',
      '${'a'.repeat(64)}', '${'c'.repeat(64)}', '${MANIFEST_2_SHA}',
      '${'d'.repeat(64)}',
      1, 1, course_count, unit_count, lesson_count,
      assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    from public.academy_curriculum_releases
    where version = '1.0.0';
    insert into public.academy_curriculum_release_files (
      release_id, relative_path, byte_count, sha256, content_type,
      safe_classification, immutable_locator
    ) values (
      '${RELEASE_2_ID}', 'curriculum-manifest.json', 1,
      '${MANIFEST_2_SHA}', 'application/json',
      'metadata_only_internal_source',
      'git_commit_path:${'2'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/curriculum-manifest.json'
    );
  `)
}

async function appendProductionPointer(
  releaseId: string,
  revision: number,
  changeKind: 'activate' | 'rollback',
  registeredAt: string,
) {
  await database.exec(`
    insert into public.academy_curriculum_active_pointers (
      environment, release_id, revision, change_kind, binding_mode,
      registered_at
    ) values (
      'production', '${releaseId}', ${revision}, '${changeKind}',
      'study_new_sessions', '${registeredAt}'
    )
  `)
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
      '15100000-0000-4000-8000-000000000001',
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
  beginRequest = {
    idempotencyKey: 'begin-production-a',
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
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('authoritative production Study session semantics V2', () => {
  it('reports readiness and begins from trusted identity, settings, release, time, and revision', async () => {
    await expect(service(() => rpc(
      'select public.academy_study_session_semantics_readiness_v2() as result',
    ))).resolves.toEqual({ schemaVersion: 2, status: 'ready' })

    const begun = await runtime('session:begin', beginRequest)
    expect(begun).toMatchObject({
      schemaVersion: 1,
      status: 'ok',
      operation: 'session:begin',
      body: {
        schemaVersion: 2,
        status: 'begun',
        state: 'active',
        revision: 1,
        lessonId: 'lesson-production-a',
        currentSegmentId: 'segment-production-a',
        curriculumBinding: {
          status: 'bound', releaseId: RELEASE_ID, releaseVersion: '1.0.0',
        },
        effectiveSettings: { maximumWorkMinutes: 30 },
      },
    })
    sessionId = begun.body.sessionId as string
    expect(sessionId).toMatch(/^session:[0-9a-f]{32}$/)
    expect(begun.body.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Date.parse(begun.body.updatedAt as string)).toBeGreaterThanOrEqual(
      Date.parse(begun.body.acceptedAt as string),
    )
    expect(JSON.stringify(begun.body)).not.toContain(STUDENT_A)

    const timestampMarker = await database.query<{
      session_timestamp_coherence_version: number
      marker: string
    }>(`
      select session_timestamp_coherence_version,
        migration_names[array_length(migration_names, 1)] as marker
      from academy_private.study_persistence_metadata
      where singleton
    `)
    expect(timestampMarker.rows).toEqual([{
      session_timestamp_coherence_version: 1,
      marker: '20260810159100_academy_study_session_timestamp_coherence',
    }])

    const stored = await database.query<{
      household_id: string
      student_id: string
      revision: number
      session_semantics_version: number
      accepted_by_server: boolean
      settings_version: number
    }>(`
      select household_id, student_id, revision, session_semantics_version,
        accepted_at = started_at as accepted_by_server,
        (effective_settings_snapshot ->> 'schemaVersion')::integer
          as settings_version
      from public.academy_study_sessions where id = $1
    `, [sessionId])
    expect(stored.rows).toEqual([{
      household_id: HOUSEHOLD_A,
      student_id: STUDENT_A,
      revision: 1,
      session_semantics_version: 2,
      accepted_by_server: true,
      settings_version: 2,
    }])
  })

  it('replays an identical begin and conflicts a changed request identity digest', async () => {
    const replay = await runtime('session:begin', beginRequest)
    expect(replay.body).toMatchObject({
      status: 'begun', sessionId, revision: 1,
    })
    const conflict = await runtime('session:begin', {
      ...beginRequest,
      lessonId: 'lesson-production-changed',
      curriculumContext: {
        releaseVersion: '1.0.0',
        lessonRef: 'lesson-production-changed',
        skillRefs: ['skill-production-a'],
      },
    })
    expect(conflict.body).toEqual({
      schemaVersion: 2, status: 'idempotency-collision',
    })
    expect((await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_study_sessions
      where session_semantics_version = 2
    `)).rows[0].count).toBe(1)
  })

  it('enforces canonical transitions, replay, stale CAS, and invalid edges', async () => {
    const completed = await transition(
      1, 'transition-segment-a', 'segment-completed', 'segment-production-a',
    )
    expect(completed.body).toMatchObject({
      status: 'stored', state: 'active', revision: 2, currentSegmentId: null,
    })
    await expect(transition(
      1, 'transition-segment-a', 'segment-completed', 'segment-production-a',
    )).resolves.toMatchObject({ body: completed.body })
    await expect(transition(
      1, 'transition-segment-a', 'segment-started', 'segment-production-b',
    )).resolves.toMatchObject({
      body: { schemaVersion: 2, status: 'idempotency-collision' },
    })
    await expect(transition(
      1, 'transition-stale-a', 'segment-started', 'segment-production-b',
    )).resolves.toMatchObject({
      body: { status: 'revision-conflict', currentRevision: 2 },
    })
    await expect(transition(
      2, 'transition-invalid-a', 'break-ended', null,
    )).resolves.toMatchObject({
      body: { status: 'invalid-transition', currentState: 'active' },
    })
    await expect(transition(
      2, 'transition-segment-b', 'segment-started', 'segment-production-b',
    )).resolves.toMatchObject({ body: { status: 'stored', revision: 3 } })
    await expect(transition(
      3, 'transition-pause-a', 'pause-started', 'segment-production-b',
    )).resolves.toMatchObject({ body: { status: 'stored', state: 'paused', revision: 4 } })
    await expect(transition(
      4, 'transition-resume-a', 'session-resumed', 'segment-production-b',
    )).resolves.toMatchObject({ body: { status: 'stored', state: 'active', revision: 5 } })
  })

  it('stores a revision-safe checkpoint and resumes deterministically with bounded state', async () => {
    const request = {
      sessionId,
      expectedRevision: 0,
      mutationId: 'checkpoint-production-a',
      checkpoint: checkpoint(1),
      curriculumReleaseVersion: '1.0.0',
    }
    const stored = await runtime('checkpoint:compare-and-swap', request)
    expect(stored.body).toMatchObject({
      schemaVersion: 2,
      status: 'stored',
      checkpointRevision: 1,
      sessionRevision: 5,
      curriculumBinding: { releaseVersion: '1.0.0' },
    })
    await expect(runtime('checkpoint:compare-and-swap', request))
      .resolves.toMatchObject({ body: stored.body })
    await expect(runtime('checkpoint:compare-and-swap', {
      ...request,
      checkpoint: { ...checkpoint(1), pausedSeconds: 6 },
    })).resolves.toMatchObject({
      body: { schemaVersion: 2, status: 'idempotency-collision' },
    })

    const resumed = await runtime('session:resume', {
      sessionId, curriculumReleaseVersion: '1.0.0',
    })
    expect(resumed.body).toMatchObject({
      schemaVersion: 2,
      status: 'resumable',
      state: 'active',
      revision: 5,
      currentSegmentId: 'segment-production-b',
      checkpoint: {
        checkpointId: `checkpoint-${sessionId}`,
        revision: 1,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      },
    })
    expect(Object.keys(resumed.body).sort()).toEqual([
      'acceptedAt', 'checkpoint', 'completedAt', 'currentSegmentId',
      'curriculumBinding', 'effectiveSettings', 'intendedLocalDate',
      'lastTransition', 'lessonId', 'revision', 'schemaVersion', 'sessionId',
      'state', 'status', 'studyPlanId', 'subjectId', 'updatedAt',
    ].sort())
    expect(JSON.stringify(resumed.body)).not.toMatch(
      /private.?note|raw.?safety|tutor.?chat|assessment.?answer|emotional|personality|diagnostic|secret|raw.?db/i,
    )
  })

  it('pins V2 sessions across registry activation and rollback', async () => {
    await registerRelease2()
    await appendProductionPointer(
      RELEASE_2_ID, 3, 'activate', '2026-08-10T15:40:00Z',
    )
    const release2Request = {
      ...beginRequest,
      idempotencyKey: 'begin-production-release-2',
      lessonId: 'lesson-production-release-2',
      initialSegmentId: 'segment-production-release-2',
      curriculumContext: {
        releaseVersion: '2.0.0',
        lessonRef: 'lesson-production-release-2',
        skillRefs: ['skill-production-release-2'],
      },
    }
    await expect(runtime('session:begin', {
      ...release2Request,
      idempotencyKey: 'begin-production-release-2-mismatch',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })

    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '2.0.0'
      where id = '15100000-0000-4000-8000-000000000001'::uuid
    `)
    const release2 = await runtime('session:begin', release2Request)
    expect(release2.body).toMatchObject({
      status: 'begun', revision: 1,
      curriculumBinding: {
        status: 'bound', releaseId: RELEASE_2_ID, releaseVersion: '2.0.0',
      },
    })
    const release2SessionId = release2.body.sessionId as string
    await expect(runtime('session:resume', {
      sessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'resumable',
        curriculumBinding: { releaseId: RELEASE_ID, releaseVersion: '1.0.0' },
      },
    })

    await appendProductionPointer(
      RELEASE_ID, 4, 'rollback', '2026-08-10T15:50:00Z',
    )
    const rollbackRequest = {
      ...beginRequest,
      idempotencyKey: 'begin-production-after-rollback',
      lessonId: 'lesson-production-after-rollback',
      initialSegmentId: 'segment-production-after-rollback',
      curriculumContext: {
        releaseVersion: '1.0.0',
        lessonRef: 'lesson-production-after-rollback',
        skillRefs: ['skill-production-after-rollback'],
      },
    }
    await expect(runtime('session:begin', {
      ...rollbackRequest,
      idempotencyKey: 'begin-production-after-rollback-mismatch',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '1.0.0'
      where id = '15100000-0000-4000-8000-000000000001'::uuid
    `)
    const rollback = await runtime('session:begin', rollbackRequest)
    expect(rollback.body).toMatchObject({
      status: 'begun', revision: 1,
      curriculumBinding: {
        status: 'bound', releaseId: RELEASE_ID, releaseVersion: '1.0.0',
      },
    })
    const rollbackSessionId = rollback.body.sessionId as string
    await expect(runtime('session:resume', {
      sessionId: release2SessionId, curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'resumable',
        curriculumBinding: { releaseId: RELEASE_2_ID, releaseVersion: '2.0.0' },
      },
    })

    const pinned = await database.query<{
      id: string
      curriculum_release_version: string
    }>(`
      select id, curriculum_release_version
      from public.academy_study_sessions
      where id in ($1, $2, $3)
      order by curriculum_release_version, id
    `, [sessionId, release2SessionId, rollbackSessionId])
    expect(pinned.rows).toEqual([
      { id: rollbackSessionId, curriculum_release_version: '1.0.0' },
      { id: sessionId, curriculum_release_version: '1.0.0' },
      { id: release2SessionId, curriculum_release_version: '2.0.0' },
    ].sort((a, b) =>
      a.curriculum_release_version.localeCompare(b.curriculum_release_version)
      || a.id.localeCompare(b.id)))
  })

  it('preserves the immutable release and rejects a mid-session release change', async () => {
    await expect(runtime('session:resume', {
      sessionId, curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    await expect(transition(
      5, 'transition-release-change', 'segment-completed',
      'segment-production-b', '2.0.0',
    )).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    expect((await database.query<{ release_version: string }>(`
      select curriculum_release_version as release_version
      from public.academy_study_sessions where id = $1
    `, [sessionId])).rows[0].release_version).toBe('1.0.0')
  })

  it('fails closed when Effective Settings V2 is unavailable', async () => {
    await database.exec('delete from academy_private.study_effective_settings_safety_policy')
    try {
      const result = await runtime('session:begin', {
        ...beginRequest,
        idempotencyKey: 'begin-settings-unavailable',
      })
      expect(result.body).toEqual({
        schemaVersion: 2,
        status: 'unavailable',
        reasonCode: 'safety_constraints_unavailable',
      })
    } finally {
      await database.exec(`
        insert into academy_private.study_effective_settings_safety_policy (
          minimum_work_minutes, maximum_work_minutes,
          break_minimum_minutes, break_maximum_minutes,
          required_break_interval_minutes
        ) values (1, 240, 1, 120, 240)
      `)
    }

    await database.exec(`
      update academy_private.study_effective_settings_safety_policy
      set minimum_work_minutes = 60
    `)
    try {
      const result = await runtime('session:begin', {
        ...beginRequest,
        idempotencyKey: 'begin-settings-manual-review',
      })
      expect(result.body).toMatchObject({
        schemaVersion: 2,
        status: 'manual_review',
        reasonCodes: ['work_duration_conflict'],
      })
    } finally {
      await database.exec(`
        update academy_private.study_effective_settings_safety_policy
        set minimum_work_minutes = 1
      `)
    }
  })

  it('denies cross-household access and classifies ambiguous legacy sessions', async () => {
    await expect(runtime('session:resume', {
      sessionId: 'session-b', curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'study-session-unavailable' },
    })
    await expect(runtime('session:resume', {
      sessionId: 'session-a', curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'manual-review',
        reasonCode: 'legacy-curriculum-binding-ambiguous',
      },
    })
  })

  it('closes only through valid server-timestamped terminal transitions', async () => {
    await expect(transition(
      5, 'transition-segment-b-complete', 'segment-completed', 'segment-production-b',
    )).resolves.toMatchObject({ body: { status: 'stored', revision: 6 } })
    const closed = await transition(
      6, 'transition-session-complete', 'session-completed', null,
    )
    expect(closed.body).toMatchObject({
      status: 'stored', state: 'completed', revision: 7,
    })
    expect(closed.body.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    await expect(runtime('session:resume', {
      sessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'closed', state: 'completed', revision: 7 },
    })
    await expect(transition(
      7, 'transition-after-close', 'session-abandoned', null,
    )).resolves.toMatchObject({
      body: { status: 'invalid-transition', currentState: 'completed' },
    })
  })

  it('rejects caller-authored identity, role, revision, and timestamps', async () => {
    for (const tamper of [
      { studentId: STUDENT_A },
      { role: 'guardian' },
      { revision: 99 },
      { acceptedAt: '1999-01-01T00:00:00.000Z' },
    ]) {
      await expect(runtime('session:begin', { ...beginRequest, ...tamper }))
        .rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)
    }
  })
})
