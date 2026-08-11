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
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const RELEASE_1_ID = '16000000-0000-4000-8000-000000000001'
const RELEASE_2_ID = '26000000-0000-4000-8000-000000000002'
const MANIFEST_2_SHA = 'b'.repeat(64)

let database: PGlite
let digestA: string
let digestB: string
let authoritySessionId: string
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
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  run: () => Promise<T>,
  extraClaims: Record<string, unknown> = {},
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}), ...extraClaims })
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

function guardian<T>(subject: string, operation: () => Promise<T>) {
  return asRole('authenticated', subject, operation)
}

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, operation)
}

async function runtime(
  digest: string,
  operation: string,
  request: Record<string, unknown>,
  capability?: string,
) {
  const requiredCapability = capability ?? (
    ['session:resume', 'checkpoint:read'].includes(operation)
      ? 'student:progress:read'
      : 'student:attempts:create'
  )
  return service(() => rpc<{
    schemaVersion: number
    status: string
    operation: string
    body?: Record<string, unknown>
  }>(`
    select public.academy_study_execute_session_lifecycle_v2(
      $1::text, $2::text, $3::text, $4::jsonb
    ) as result
  `, [digest, requiredCapability, operation, JSON.stringify(request)]))
}

function beginRequest(idempotencyKey: string, lessonId: string, overrides = {}) {
  return {
    idempotencyKey,
    lessonId,
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: currentLocalDate,
    initialSegmentId: `segment-${lessonId}`,
    curriculumContext: {
      releaseVersion: '1.0.0',
      lessonRef: lessonId,
      skillRefs: [`skill-${lessonId}`],
    },
    ...overrides,
  }
}

async function begin(idempotencyKey: string, lessonId: string, overrides = {}) {
  return runtime(digestA, 'session:begin', beginRequest(idempotencyKey, lessonId, overrides))
}

function transition(
  sessionId: string,
  expectedRevision: number,
  idempotencyKey: string,
  type: string,
  segmentId: string | null,
  curriculumReleaseVersion = '1.0.0',
) {
  return runtime(digestA, 'session:transition', {
    sessionId,
    expectedRevision,
    idempotencyKey,
    curriculumReleaseVersion,
    transition: { type, segmentId },
  })
}

function checkpoint(sessionId: string, revision: number) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: `checkpoint-${sessionId}`,
    revision,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: `2026-08-10T15:0${revision + 1}:00.000Z`,
    sessionId,
    lessonId: 'lesson-authority-a',
    segmentId: 'segment-lesson-authority-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice', cycleNumber: 1,
      currentItemId: 'task-authority-a', currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [
      { segmentId: 'segment-lesson-authority-a', activeSeconds: 10 },
    ],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: `tutor-state:${sessionId}`,
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-authority-a',
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
    where id in (
      '00000000-0000-0000-0000-0000000001a1'::uuid,
      '00000000-0000-0000-0000-0000000001b1'::uuid
    );
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
  const issuedA = await guardian(GUARDIAN_A, () => rpc<{ sessionReference: string }>(
    'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
    ['academy-student-id', STUDENT_A],
  ))
  const issuedB = await guardian(GUARDIAN_B, () => rpc<{ sessionReference: string }>(
    'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
    ['academy-student-id', '00000000-0000-0000-0000-000000000201'],
  ))
  digestA = createHash('sha256').update(issuedA.sessionReference, 'ascii').digest('hex')
  digestB = createHash('sha256').update(issuedB.sessionReference, 'ascii').digest('hex')
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study Production Security / Adversarial Gate R4 database boundary', () => {
  it('keeps production RPC grants narrow and browser/private table mutation closed', async () => {
    const privileges = await database.query<{
      auth_execute: boolean
      anon_execute: boolean
      service_execute: boolean
      auth_private_helper: boolean
      auth_session_insert: boolean
      service_session_update: boolean
    }>(`
      select
        has_function_privilege('authenticated',
          'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)', 'execute') as auth_execute,
        has_function_privilege('anon',
          'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)', 'execute') as anon_execute,
        has_function_privilege('service_role',
          'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)', 'execute') as service_execute,
        has_function_privilege('authenticated',
          'academy_private.study_begin_session_v2(uuid,uuid,jsonb)', 'execute') as auth_private_helper,
        has_table_privilege('authenticated', 'public.academy_study_sessions', 'insert') as auth_session_insert,
        has_table_privilege('service_role', 'public.academy_study_sessions', 'update') as service_session_update
    `)
    expect(privileges.rows[0]).toEqual({
      auth_execute: false,
      anon_execute: false,
      service_execute: true,
      auth_private_helper: false,
      auth_session_insert: false,
      service_session_update: false,
    })

    const forced = await database.query<{ relation: string; forced: boolean }>(`
      select n.nspname || '.' || c.relname as relation,
        c.relforcerowsecurity as forced
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname in ('public', 'academy_private')
        and c.relname in (
          'academy_study_sessions', 'academy_study_checkpoints',
          'study_mutation_receipts', 'study_effective_settings_admin_defaults',
          'study_effective_settings_safety_policy',
          'academy_curriculum_releases', 'academy_curriculum_active_pointers'
        )
      order by relation
    `)
    expect(forced.rows).toHaveLength(7)
    expect(forced.rows.every(({ forced: enabled }) => enabled)).toBe(true)

    await expect(asRole('authenticated', GUARDIAN_A, () => database.exec(`
      update public.academy_study_sessions set revision = 999 where id = 'session-a'
    `))).rejects.toThrow(/permission denied/i)
    await expect(service(() => database.exec(`
      update public.academy_study_sessions set revision = 999 where id = 'session-a'
    `))).rejects.toThrow(/permission denied/i)
    await expect(asRole('authenticated', GUARDIAN_A, () => rpc(`
      select public.academy_study_execute_session_lifecycle_v2(
        '${digestA}', 'student:progress:read', 'session:resume', '{}'::jsonb
      ) as result
    `), { role: 'service_role' })).rejects.toThrow(/permission denied/i)
  })

  it('derives learner, household, role, and capability only from a current verified grant', async () => {
    await expect(runtime('f'.repeat(64), 'session:resume', {
      sessionId: 'session-a', curriculumReleaseVersion: '1.0.0',
    })).resolves.toEqual({
      schemaVersion: 1, status: 'denied', operation: 'session:resume',
    })
    await expect(runtime(digestA, 'session:resume', {
      sessionId: 'session-a', curriculumReleaseVersion: '1.0.0',
    }, 'student:attempts:create')).resolves.toEqual({
      schemaVersion: 1, status: 'denied', operation: 'session:resume',
    })
    await expect(runtime(digestA, 'session:delete', {})).resolves.toEqual({
      schemaVersion: 1, status: 'denied', operation: 'session:delete',
    })
  })

  it('rejects unknown, forged, malformed, and oversized begin authority', async () => {
    const topLevelTampering = [
      { studentId: STUDENT_A },
      { householdId: HOUSEHOLD_A },
      { role: 'guardian' },
      { capability: 'student:attempts:create' },
      { releaseId: RELEASE_1_ID },
      { acceptedAt: '1999-01-01T00:00:00.000Z' },
      { revision: 999 },
      { unknown: true },
    ]
    for (const [index, tamper] of topLevelTampering.entries()) {
      await expect(begin(`begin-forged-${index}`, `lesson-forged-${index}`, tamper))
        .rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)
    }

    const nestedTampering = [
      { releaseId: RELEASE_1_ID },
      { packageId: 'forged-package' },
      { curriculumManifestSha256: 'f'.repeat(64) },
      { status: 'published' },
      { activePointer: { revision: 999 } },
    ]
    for (const [index, tamper] of nestedTampering.entries()) {
      const lessonId = `lesson-nested-${index}`
      await expect(begin(`begin-nested-${index}`, lessonId, {
        curriculumContext: {
          releaseVersion: '1.0.0', lessonRef: lessonId,
          skillRefs: [`skill-nested-${index}`], ...tamper,
        },
      })).rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)
    }

    for (const [index, invalid] of [
      { intendedLocalDate: '2026-02-30' },
      { intendedLocalDate: 'not-a-date' },
      { idempotencyKey: `x${'a'.repeat(160)}` },
      { curriculumContext: {
        releaseVersion: 'not-semver', lessonRef: 'lesson-malformed-3', skillRefs: [],
      } },
      { curriculumContext: {
        releaseVersion: '1.0.0', lessonRef: 'lesson-malformed-4',
        skillRefs: Array.from({ length: 65 }, (_, item) => `skill-${item}`),
      } },
      { curriculumContext: {
        releaseVersion: '1.0.0', lessonRef: 'lesson-malformed-5',
        skillRefs: Array.from({ length: 64 }, (_, item) =>
          `skill-${item}-${'x'.repeat(140)}`),
      } },
    ].entries()) {
      await expect(begin(`begin-malformed-${index}`, `lesson-malformed-${index}`, invalid))
        .rejects.toThrow(/STUDY_SESSION_BEGIN_INVALID/)
    }
  })

  it('binds only server settings, time, enrollment, and registry authority with collision-safe begin', async () => {
    const request = beginRequest('begin-authority-a', 'lesson-authority-a')
    const begun = await runtime(digestA, 'session:begin', request)
    expect(begun).toMatchObject({
      schemaVersion: 1, status: 'ok', operation: 'session:begin',
      body: {
        schemaVersion: 2, status: 'begun', state: 'active', revision: 1,
        curriculumBinding: {
          releaseId: RELEASE_1_ID,
          packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
          releaseVersion: '1.0.0',
        },
        effectiveSettings: { maximumWorkMinutes: 30 },
      },
    })
    authoritySessionId = begun.body?.sessionId as string
    await expect(runtime(digestA, 'session:begin', request))
      .resolves.toMatchObject({ body: { sessionId: authoritySessionId, revision: 1 } })
    await expect(runtime(digestA, 'session:begin', {
      ...request, lessonId: 'lesson-authority-changed',
      curriculumContext: {
        ...request.curriculumContext, lessonRef: 'lesson-authority-changed',
      },
    })).resolves.toMatchObject({ body: { status: 'idempotency-collision' } })

    const stored = await database.query<{
      accepted_by_server: boolean
      settings_student: string
      settings_date: string
      release_id: string
      manifest_sha: string
      count: number
    }>(`
      select accepted_at = started_at as accepted_by_server,
        effective_settings_snapshot ->> 'studentId' as settings_student,
        effective_settings_snapshot ->> 'effectiveDate' as settings_date,
        curriculum_release_id::text as release_id,
        curriculum_manifest_sha256 as manifest_sha,
        (select count(*)::integer from public.academy_study_sessions
          where session_semantics_version = 2 and lesson_id like 'lesson-authority%') as count
      from public.academy_study_sessions where id = $1
    `, [authoritySessionId])
    expect(stored.rows[0]).toMatchObject({
      accepted_by_server: true,
      settings_student: STUDENT_A,
      settings_date: currentLocalDate,
      release_id: RELEASE_1_ID,
      count: 1,
    })
    expect(stored.rows[0].manifest_sha).toMatch(/^[0-9a-f]{64}$/)

    await expect(database.exec(`
      update public.academy_study_sessions
      set accepted_at = '1999-01-01T00:00:00Z'
      where id = '${authoritySessionId}'
    `)).rejects.toThrow(/authority snapshot is immutable/i)
    await expect(database.exec(`
      update public.academy_study_sessions
      set curriculum_release_id = '${RELEASE_2_ID}'
      where id = '${authoritySessionId}'
    `)).rejects.toThrow(/curriculum binding is immutable/i)
  })

  it('denies cross-household and treats legacy binding as ambiguous', async () => {
    await expect(runtime(digestB, 'session:resume', {
      sessionId: authoritySessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'study-session-unavailable' },
    })
    await expect(runtime(digestA, 'session:resume', {
      sessionId: 'session-a', curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'manual-review', reasonCode: 'legacy-curriculum-binding-ambiguous',
      },
    })
    const visible = await guardian(GUARDIAN_A, () =>
      database.query<{ id: string }>(`
        select id from public.academy_study_sessions where id in ('session-a', 'session-b') order by id
      `))
    expect(visible.rows).toEqual([{ id: 'session-a' }])
  })

  it('enforces transition replay digests, exact CAS, and terminal completion', async () => {
    const segmentId = 'segment-lesson-authority-a'
    const first = await transition(
      authoritySessionId, 1, 'transition-authority-a', 'segment-completed', segmentId,
    )
    expect(first.body).toMatchObject({ status: 'stored', revision: 2 })
    await expect(transition(
      authoritySessionId, 1, 'transition-authority-a', 'segment-completed', segmentId,
    )).resolves.toMatchObject({ body: first.body })
    await expect(transition(
      authoritySessionId, 1, 'transition-authority-a', 'segment-started', 'segment-changed',
    )).resolves.toMatchObject({ body: { status: 'idempotency-collision' } })
    await expect(transition(
      authoritySessionId, 1, 'transition-stale-a', 'segment-started', 'segment-next',
    )).resolves.toMatchObject({
      body: { status: 'revision-conflict', currentRevision: 2 },
    })
    await expect(transition(
      authoritySessionId, 4, 'transition-skip-a', 'segment-started', 'segment-next',
    )).resolves.toMatchObject({
      body: { status: 'revision-conflict', currentRevision: 2 },
    })
    const completed = await transition(
      authoritySessionId, 2, 'transition-complete-a', 'session-completed', null,
    )
    expect(completed.body).toMatchObject({ status: 'stored', state: 'completed', revision: 3 })
    await expect(transition(
      authoritySessionId, 3, 'transition-after-complete', 'session-abandoned', null,
    )).resolves.toMatchObject({
      body: { status: 'invalid-transition', currentState: 'completed' },
    })
  })

  it('rejects transitions after abandonment', async () => {
    const begun = await begin('begin-abandoned-a', 'lesson-abandoned-a')
    const sessionId = begun.body?.sessionId as string
    const segmentId = 'segment-lesson-abandoned-a'
    await expect(transition(
      sessionId, 1, 'transition-abandon-a', 'session-abandoned', segmentId,
    )).resolves.toMatchObject({ body: { status: 'stored', state: 'abandoned', revision: 2 } })
    await expect(transition(
      sessionId, 2, 'transition-after-abandon', 'session-completed', null,
    )).resolves.toMatchObject({
      body: { status: 'invalid-transition', currentState: 'abandoned' },
    })
  })

  it('enforces checkpoint nested DTO, idempotency digest, and exact CAS', async () => {
    const begun = await begin('begin-checkpoint-a', 'lesson-checkpoint-a')
    const sessionId = begun.body?.sessionId as string
    const valid = checkpoint(sessionId, 1)
    valid.lessonId = 'lesson-checkpoint-a'
    valid.segmentId = 'segment-lesson-checkpoint-a'
    valid.perSegmentActiveTime = [
      { segmentId: 'segment-lesson-checkpoint-a', activeSeconds: 10 },
    ]
    const request = {
      sessionId, expectedRevision: 0, mutationId: 'checkpoint-store-a',
      checkpoint: valid, curriculumReleaseVersion: '1.0.0',
    }
    const stored = await runtime(digestA, 'checkpoint:compare-and-swap', request)
    expect(stored.body).toMatchObject({ status: 'stored', checkpointRevision: 1 })
    await expect(runtime(digestA, 'checkpoint:compare-and-swap', request))
      .resolves.toMatchObject({ body: stored.body })
    await expect(runtime(digestA, 'checkpoint:compare-and-swap', {
      ...request, checkpoint: { ...valid, pausedSeconds: 1 },
    })).resolves.toMatchObject({ body: { status: 'idempotency-collision' } })

    await expect(runtime(digestA, 'checkpoint:compare-and-swap', {
      sessionId, expectedRevision: 0, mutationId: 'checkpoint-stale-a',
      checkpoint: { ...valid, revision: 1 }, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'revision-conflict', currentCheckpointRevision: 1 },
    })
    await expect(runtime(digestA, 'checkpoint:compare-and-swap', {
      sessionId, expectedRevision: 3, mutationId: 'checkpoint-skip-a',
      checkpoint: { ...valid, revision: 4 }, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'revision-conflict', currentCheckpointRevision: 1 },
    })
    await expect(runtime(digestA, 'checkpoint:compare-and-swap', {
      sessionId, expectedRevision: 1, mutationId: 'checkpoint-malformed-a',
      checkpoint: {
        ...valid,
        revision: 2,
        safeInstructionalCursor: {
          ...valid.safeInstructionalCursor, learnerAnswers: ['private'],
        },
      },
      curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'invalid-checkpoint', reasonCode: 'malformed-event' },
    })

    const read = await runtime(digestA, 'checkpoint:read', {
      sessionId, curriculumReleaseVersion: '1.0.0',
    })
    expect(Object.keys(read.body ?? {}).sort()).toEqual([
      'checkpoint', 'currentState', 'curriculumBinding', 'schemaVersion',
      'sessionRevision', 'status',
    ].sort())
    expect(JSON.stringify(read.body)).not.toMatch(
      /private.?note|raw.?safety|learner.?answer|tutor.?conversation|assessment.?response|emotional|personality|diagnostic|credential|secret|sql|raw.?provider/i,
    )
  })

  it('pins sessions when enrollment, activation, and rollback authority later change', async () => {
    await database.exec(`
      update public.academy_subject_enrollments
      set enrollment_status = 'withdrawn'
      where id = '15100000-0000-4000-8000-000000000001'::uuid
    `)
    await expect(runtime(digestA, 'session:resume', {
      sessionId: authoritySessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { status: 'closed', curriculumBinding: { releaseVersion: '1.0.0' } },
    })
    await expect(begin('begin-withdrawn-a', 'lesson-withdrawn-a'))
      .resolves.toMatchObject({
        body: { status: 'unavailable', reasonCode: 'curriculum-release-unavailable' },
      })
    await database.exec(`
      update public.academy_subject_enrollments
      set enrollment_status = 'active'
      where id = '15100000-0000-4000-8000-000000000001'::uuid
    `)

    await registerRelease2()
    await database.exec(`
      insert into public.academy_curriculum_active_pointers (
        environment, release_id, revision, change_kind, binding_mode, registered_at
      ) values (
        'production', '${RELEASE_2_ID}', 3, 'activate',
        'study_new_sessions', '2026-08-10T15:40:00Z'
      )
    `)
    await expect(runtime(digestA, 'session:resume', {
      sessionId: authoritySessionId, curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: { curriculumBinding: { releaseId: RELEASE_1_ID, releaseVersion: '1.0.0' } },
    })
    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '2.0.0'
      where id = '15100000-0000-4000-8000-000000000001'::uuid
    `)
    const release2 = await runtime(digestA, 'session:begin', {
      ...beginRequest('begin-release-2-a', 'lesson-release-2-a'),
      curriculumContext: {
        releaseVersion: '2.0.0', lessonRef: 'lesson-release-2-a', skillRefs: [],
      },
    })
    const release2SessionId = release2.body?.sessionId as string
    expect(release2.body).toMatchObject({
      status: 'begun',
      curriculumBinding: { releaseId: RELEASE_2_ID, releaseVersion: '2.0.0' },
    })

    await database.exec(`
      insert into public.academy_curriculum_active_pointers (
        environment, release_id, revision, change_kind, binding_mode, registered_at
      ) values (
        'production', '${RELEASE_1_ID}', 4, 'rollback',
        'study_new_sessions', '2026-08-10T15:50:00Z'
      )
    `)
    await expect(runtime(digestA, 'session:resume', {
      sessionId: release2SessionId, curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: { curriculumBinding: { releaseId: RELEASE_2_ID, releaseVersion: '2.0.0' } },
    })

    await expect(asRole('authenticated', GUARDIAN_A, () => database.exec(`
      update public.academy_curriculum_releases
      set status = 'published' where release_id = '${RELEASE_1_ID}'
    `))).rejects.toThrow(/permission denied/i)
    await expect(service(() => database.exec(`
      update public.academy_curriculum_active_pointers
      set release_id = '${RELEASE_2_ID}' where environment = 'production'
    `))).rejects.toThrow(/permission denied/i)
  })

  it('stores only bounded identifiers and reason codes in security-sensitive audit metadata', async () => {
    const audit = await database.query<{ event_type: string; metadata: string }>(`
      select event_type, metadata::text
      from public.academy_study_audit_events
      where target_id in ($1, 'checkpoint-' || $1)
      order by occurred_at
    `, [authoritySessionId])
    expect(audit.rows.length).toBeGreaterThan(0)
    for (const row of audit.rows) {
      expect(row.metadata).toMatch(/revision|result_code/)
      expect(row.metadata).not.toMatch(
        /private.?note|raw.?safety|learner.?answer|tutor.?conversation|assessment.?response|secret|credential|token|sql/i,
      )
    }
  })
})
