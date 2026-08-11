import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createStudyAcademicRuntimeHandler } from '../netlify/functions/study-academic-runtime.js'
import { createStudyBoundContentHandler } from '../netlify/functions/study-bound-content.js'
import { createStudySessionIssueHandler } from '../netlify/functions/study-session-issue.js'
import { createStudyBoundContentAuthority } from '../netlify/functions/_shared/study-content/authority.js'
import { createFilesystemBoundCurriculumPackageSource } from '../netlify/functions/_shared/study-content/filesystem-source.js'

export const STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION =
  'STUDY_LOCAL_PRODUCTION_SMOKE_READY'
export const STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX =
  'STUDY_PRODUCTION_LOCAL_SMOKE_JSON='

const SMOKE_ID = 'study-production-local-smoke-v1'
const FIXTURE_CLOCK = '2026-08-10T16:00:00.000Z'
const FIXTURE_DATE = '2026-08-10'
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const RELEASE_ID = '16000000-0000-4000-8000-000000000001'
const RELEASE_VERSION = '1.0.0'
const MANIFEST_SHA =
  '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b'
const LESSON_REF = 'grade-5:academy-week-1-day-1'
const MATH_SKILL = 'ma-g5-mathematics-u01-l01'
const ELSEWHERE_MATH_SKILL = 'ma-g5-mathematics-u01-l02'
const INITIAL_SEGMENT = 'segment-smoke-a'
const SECOND_SEGMENT = 'segment-smoke-b'

const SQL_FILES = Object.freeze([
  '../supabase/schema.sql',
  '../supabase/migrations/20260724230000_academy_student_identity_foundation.sql',
  '../supabase/migrations/20260801010000_academy_study_engine_storage.sql',
  '../supabase/migrations/20260801011000_academy_study_engine_authorization.sql',
  '../supabase/migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  '../supabase/migrations/20260801160000_academy_study_verified_identity.sql',
  '../supabase/migrations/20260801170000_academy_study_adult_review_operations.sql',
  '../supabase/migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  '../supabase/tests/study_engine_fixtures.sql',
  '../supabase/migrations/20260809160000_academy_curriculum_release_registry.sql',
  '../supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql',
  '../supabase/migrations/20260810150000_academy_study_curriculum_binding.sql',
  '../supabase/migrations/20260810151000_academy_study_session_semantics_v2.sql',
  '../supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql',
  '../supabase/migrations/20260810154000_academy_study_bound_content_authority.sql',
  './fixtures/study-production-local-smoke.sql',
])

const BOOTSTRAP_SQL = `
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

class SmokeFailure extends Error {
  constructor(code, cause) {
    super(code, { cause })
    this.code = code
  }
}

function invariant(condition, code) {
  if (!condition) throw new SmokeFailure(code)
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
}

async function rejects(operation) {
  try {
    await operation()
    return false
  } catch {
    return true
  }
}

function responseJson(response) {
  try {
    return JSON.parse(response.body)
  } catch (error) {
    throw new SmokeFailure('response-json-invalid', error)
  }
}

function checkpoint(sessionId) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: `checkpoint-${sessionId}`,
    revision: 1,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    sessionId,
    lessonId: LESSON_REF,
    segmentId: SECOND_SEGMENT,
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-smoke-a',
      currentItemIndex: 0,
      teachingTurnIndex: 1,
    },
    completedSegmentIds: [INITIAL_SEGMENT],
    perSegmentActiveTime: [
      { segmentId: INITIAL_SEGMENT, activeSeconds: 30 },
      { segmentId: SECOND_SEGMENT, activeSeconds: 10 },
    ],
    pausedSeconds: 5,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: `tutor-state:${sessionId}`,
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-smoke-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

function beginRequest(overrides = {}) {
  return {
    idempotencyKey: 'begin-study-production-smoke-v1',
    lessonId: LESSON_REF,
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: FIXTURE_DATE,
    initialSegmentId: INITIAL_SEGMENT,
    curriculumContext: {
      releaseVersion: RELEASE_VERSION,
      lessonRef: LESSON_REF,
      skillRefs: [MATH_SKILL],
    },
    ...overrides,
  }
}

function buildReport({ steps, negativeCases, externalAttempts, failure }) {
  const all = [...steps, ...negativeCases]
  const passed = all.filter(({ status }) => status === 'PASS').length
  const failed = all.filter(({ status }) => status === 'FAIL').length
  const ready = !failure && failed === 0 && externalAttempts === 0
  return Object.freeze({
    schemaVersion: 1,
    smokeId: SMOKE_ID,
    fixtureClock: FIXTURE_CLOCK,
    status: ready ? 'pass' : 'blocked',
    classification: ready ? STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION : 'BLOCKED',
    mode: 'local-ephemeral',
    scenario: Object.freeze({
      fixture: 'synthetic-authorized-learner-v1',
      releaseVersion: RELEASE_VERSION,
      terminalState: ready ? 'completed' : 'not-confirmed',
      syntheticDataOnly: true,
    }),
    isolation: Object.freeze({
      database: 'in-memory-pglite',
      persistedOutsideHarness: false,
    }),
    externalContact: Object.freeze({
      allowed: false,
      attempts: externalAttempts,
      status: externalAttempts === 0 ? 'PASS' : 'FAIL',
    }),
    steps: Object.freeze(steps.map((step) => Object.freeze({ ...step }))),
    negativeCases: Object.freeze(negativeCases.map((step) => Object.freeze({ ...step }))),
    totals: Object.freeze({ passed, failed }),
    ...(failure ? { failure: Object.freeze({ code: failure }) } : {}),
  })
}

export function renderStudyProductionLocalSmokeSummary(report) {
  const lines = [
    `Study production local smoke: ${report.status === 'pass' ? 'PASS' : 'BLOCKED'}`,
    ...report.steps
      .filter(({ id }) => id !== 'external-contact')
      .map(({ label, status }) => `${label} ${status}`),
    ...report.negativeCases.map(({ label, status }) => `negative ${label} ${status}`),
    `external contact ${report.externalContact.status} (${report.externalContact.attempts} attempts)`,
    `isolation ${report.isolation.persistedOutsideHarness ? 'FAIL' : 'PASS'} (ephemeral local database)`,
    `classification ${report.classification}`,
  ]
  return lines.join('\n')
}

export async function runStudyProductionLocalSmoke() {
  const steps = []
  const negativeCases = []
  let database
  let externalAttempts = 0
  let activeCheck = 'database-bootstrap'
  let activeCollection = steps

  const pass = (collection, id, label, evidence) => {
    collection.push({ id, label, status: 'PASS', evidence })
  }
  const check = async (collection, id, label, evidence, operation) => {
    activeCheck = id
    activeCollection = collection
    await operation()
    pass(collection, id, label, evidence)
  }
  const noExternalFetch = async () => {
    externalAttempts += 1
    throw new SmokeFailure('external-contact-blocked')
  }

  try {
    database = await PGlite.create()
    await database.exec(BOOTSTRAP_SQL)
    for (const path of SQL_FILES) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8')
      try {
        await database.exec(source)
      } catch (error) {
        throw new SmokeFailure('database-migration-apply', error)
      }
    }
    const asRole = async (role, subject, operation) => {
      const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) })
        .replaceAll("'", "''")
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
    const rpc = async (statement, parameters = []) => {
      const result = await database.query(statement, parameters)
      return result.rows[0]?.result
    }
    const guardian = (operation) => asRole('authenticated', GUARDIAN_A, operation)
    const service = (operation) => asRole('service_role', null, operation)

    let rpcCallCount = 0
    const localRpc = Object.freeze({
      isConfigured: () => true,
      async call(name, args = {}) {
        rpcCallCount += 1
        if (name === 'academy_study_execute_session_lifecycle_v2') {
          return service(() => rpc(`
            select public.academy_study_execute_session_lifecycle_v2(
              $1::text, $2::text, $3::text, $4::jsonb
            ) as result
          `, [
            args.p_token_digest,
            args.p_required_capability,
            args.p_operation,
            JSON.stringify(args.p_request),
          ]))
        }
        if (name === 'academy_study_read_bound_content_authority_v1') {
          return service(() => rpc(`
            select public.academy_study_read_bound_content_authority_v1(
              $1::text, $2::text
            ) as result
          `, [args.p_token_digest, args.p_session_id]))
        }
        throw new SmokeFailure('unexpected-local-rpc')
      },
    })

    const issuer = Object.freeze({
      isDurable: true,
      isReady: () => true,
      async issue({ selectedStudentRef }) {
        try {
          return await guardian(() => rpc(
            'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
            [selectedStudentRef.kind, selectedStudentRef.value],
          ))
        } catch (error) {
          return error?.code === '42501' ? { status: 'denied' } : { status: 'unavailable' }
        }
      },
    })
    const authVerifier = async (event) => event?.headers?.authorization ===
      'Bearer local-guardian-smoke'
      ? { ok: true, accessToken: 'local-only-test-token', user: { id: GUARDIAN_A } }
      : { ok: false, response: { statusCode: 401, body: '{"error":{"code":"unauthorized"}}' } }
    const enabledEnv = Object.freeze({ ACADEMY_STUDY_ENABLED: 'true' })
    const issueHandler = createStudySessionIssueHandler({
      env: enabledEnv,
      fetchImpl: noExternalFetch,
      authVerifier,
      issuer,
    })
    const academicHandler = createStudyAcademicRuntimeHandler({
      env: enabledEnv,
      fetchImpl: noExternalFetch,
      rpc: localRpc,
    })
    const contentHandler = createStudyBoundContentHandler({
      env: enabledEnv,
      fetchImpl: noExternalFetch,
      rpc: localRpc,
    })

    const issue = (studentId) => issueHandler({
      path: '/api/study/session/issue',
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer local-guardian-smoke',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        selectedStudentRef: { kind: 'academy-student-id', value: studentId },
      }),
    })
    let sessionReference
    let sessionId
    const academic = (operation, request) => academicHandler({
      path: '/api/study/academic-runtime',
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${sessionReference}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, operation, request }),
    })
    const content = (skillRefs) => contentHandler({
      path: '/api/study/bound-content',
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${sessionReference}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        sessionId,
        lessonRef: LESSON_REF,
        skillRefs,
      }),
    })

    await check(steps, 'settings', 'settings', 'effective-settings-v2-ready', async () => {
      const result = await guardian(() => rpc(
        'select public.academy_study_effective_settings_v2($1::uuid, $2::date) as result',
        [STUDENT_A, FIXTURE_DATE],
      ))
      invariant(result?.schemaVersion === 2 && result?.status === 'ready', 'settings-not-ready')
      invariant(result.settings?.maximumWorkMinutes === 30, 'settings-value-unexpected')
    })

    await check(steps, 'release-authority', 'release authority',
      'published-admin-registry-pointer-ready', async () => {
        const readiness = await service(() => rpc(
          'select public.academy_study_curriculum_binding_readiness_v1() as result',
        ))
        invariant(readiness?.status === 'ready', 'release-readiness-not-ready')
        const custody = await database.query(`
          select release.release_id, release.version, release.status,
            release.curriculum_manifest_sha256, pointer.revision, pointer.binding_mode
          from public.academy_curriculum_releases as release
          join public.academy_curriculum_active_pointers as pointer
            on pointer.release_id = release.release_id
          where pointer.environment = 'production'
          order by pointer.revision desc limit 1
        `)
        invariant(custody.rows.length === 1, 'release-custody-missing')
        invariant(custody.rows[0].release_id === RELEASE_ID, 'release-id-mismatch')
        invariant(custody.rows[0].version === RELEASE_VERSION, 'release-version-mismatch')
        invariant(custody.rows[0].status === 'published', 'release-not-published')
        invariant(custody.rows[0].curriculum_manifest_sha256 === MANIFEST_SHA,
          'release-manifest-mismatch')
        invariant(custody.rows[0].revision === 2 &&
          custody.rows[0].binding_mode === 'study_new_sessions', 'release-pointer-mismatch')
        invariant(await rejects(() => service(() => database.query(
          'select release_id from public.academy_curriculum_releases',
        ))), 'service-role-direct-registry-read-allowed')
      })

    await check(steps, 'enrollment', 'enrollment', 'active-date-effective-enrollment', async () => {
      const result = await database.query(`
        select count(*)::integer as count
        from public.academy_subject_enrollments
        where student_id = $1::uuid and enrollment_status = 'active'
          and subject_key = 'mathematics' and curriculum_version = $2
          and starts_on <= $3::date and (ends_on is null or ends_on >= $3::date)
      `, [STUDENT_A, RELEASE_VERSION, FIXTURE_DATE])
      invariant(result.rows[0]?.count === 1, 'enrollment-not-exact')
    })

    await check(steps, 'authorized-learner', 'authorized learner',
      'guardian-launch-issued-by-database-authority', async () => {
        const response = await issue(STUDENT_A)
        const body = responseJson(response)
        invariant(response.statusCode === 201 && body.status === 'issued', 'learner-issue-failed')
        invariant(exactKeys(body, ['schemaVersion', 'status', 'sessionReference', 'expiresAt']),
          'learner-issue-contract')
        sessionReference = body.sessionReference
        invariant(typeof sessionReference === 'string' && sessionReference.length >= 32,
          'learner-reference-invalid')
      })

    const startRequest = beginRequest()
    await check(steps, 'session-begin', 'session begin', 'server-bound-session-v2', async () => {
      const response = await academic('session:begin', startRequest)
      const result = responseJson(response)
      invariant(response.statusCode === 200, 'session-begin-http')
      invariant(result?.body?.status === 'begun' && result.body.revision === 1,
        'session-begin-result')
      invariant(result.body.curriculumBinding?.releaseId === RELEASE_ID &&
        result.body.curriculumBinding?.releaseVersion === RELEASE_VERSION,
      'session-binding-result')
      invariant(result.body.effectiveSettings?.maximumWorkMinutes === 30,
        'session-settings-result')
      invariant(typeof result.body.sessionId === 'string' &&
        /^session:[0-9a-f]{32}$/.test(result.body.sessionId), 'session-id-invalid')
      sessionId = result.body.sessionId
    })

    await check(negativeCases, 'duplicate-replay', 'duplicate/replay',
      'identical-replay-stable-and-collision-bounded', async () => {
        const replay = responseJson(await academic('session:begin', startRequest))
        invariant(replay.body?.status === 'begun' && replay.body.sessionId === sessionId,
          'session-replay-not-stable')
        const changed = beginRequest({
          lessonId: 'grade-5:academy-week-1-day-2',
          curriculumContext: {
            releaseVersion: RELEASE_VERSION,
            lessonRef: 'grade-5:academy-week-1-day-2',
            skillRefs: [MATH_SKILL],
          },
        })
        const collision = responseJson(await academic('session:begin', changed))
        invariant(collision.body?.status === 'idempotency-collision',
          'session-idempotency-collision-missing')
      })

    await check(steps, 'immutable-release-binding', 'immutable release binding',
      'release-binding-update-rejected', async () => {
        invariant(await rejects(() => database.query(`
          update public.academy_study_sessions
          set curriculum_release_version = '9.9.9'
          where id = $1
        `, [sessionId])), 'release-binding-update-allowed')
        const stored = await database.query(`
          select curriculum_release_id, curriculum_release_version,
            curriculum_manifest_sha256
          from public.academy_study_sessions where id = $1
        `, [sessionId])
        invariant(stored.rows[0]?.curriculum_release_id === RELEASE_ID &&
          stored.rows[0]?.curriculum_release_version === RELEASE_VERSION &&
          stored.rows[0]?.curriculum_manifest_sha256 === MANIFEST_SHA,
        'release-binding-changed')
      })

    await check(steps, 'bound-content', 'bound content',
      'manifest-verified-scheduled-learner-content', async () => {
        const response = await content([MATH_SKILL])
        const result = responseJson(response)
        invariant(response.statusCode === 200 && result.status === 'ready' &&
          result.reasonCode === 'content-ready', 'bound-content-not-ready')
        invariant(result.curriculumBinding?.releaseId === RELEASE_ID &&
          result.curriculumBinding?.curriculumManifestSha256 === MANIFEST_SHA,
        'bound-content-binding-mismatch')
        invariant(result.lessons?.length === 1 && result.lessons[0]?.lessonId === MATH_SKILL,
          'bound-content-lesson-mismatch')
        invariant(!JSON.stringify(result.lessons[0]).match(
          /scoringGuidance|masteryRule|adaptiveTutorRoutes|safetyAndPrivacy|parentVisibility/i,
        ), 'bound-content-protected-field')
      })

    let revision = 1
    await check(steps, 'transition', 'transition', 'canonical-segment-transitions', async () => {
      const completed = responseJson(await academic('session:transition', {
        sessionId,
        expectedRevision: revision,
        idempotencyKey: 'transition-smoke-segment-a-complete',
        curriculumReleaseVersion: RELEASE_VERSION,
        transition: { type: 'segment-completed', segmentId: INITIAL_SEGMENT },
      }))
      invariant(completed.body?.status === 'stored' && completed.body.revision === 2,
        'transition-segment-complete')
      revision = completed.body.revision
    })

    await check(negativeCases, 'stale-revision', 'stale revision',
      'revision-conflict-bounded', async () => {
        const stale = responseJson(await academic('session:transition', {
          sessionId,
          expectedRevision: 1,
          idempotencyKey: 'transition-smoke-stale',
          curriculumReleaseVersion: RELEASE_VERSION,
          transition: { type: 'segment-started', segmentId: SECOND_SEGMENT },
        }))
        invariant(stale.body?.status === 'revision-conflict' &&
          stale.body.currentRevision === revision, 'stale-revision-not-bounded')
      })

    const started = responseJson(await academic('session:transition', {
      sessionId,
      expectedRevision: revision,
      idempotencyKey: 'transition-smoke-segment-b-start',
      curriculumReleaseVersion: RELEASE_VERSION,
      transition: { type: 'segment-started', segmentId: SECOND_SEGMENT },
    }))
    invariant(started.body?.status === 'stored' && started.body.revision === 3,
      'transition-segment-start')
    revision = started.body.revision

    await check(steps, 'checkpoint', 'checkpoint', 'revision-safe-checkpoint-stored', async () => {
      const response = await academic('checkpoint:compare-and-swap', {
        sessionId,
        expectedRevision: 0,
        mutationId: 'checkpoint-study-production-smoke-v1',
        checkpoint: checkpoint(sessionId),
        curriculumReleaseVersion: RELEASE_VERSION,
      })
      const stored = responseJson(response)
      invariant(response.statusCode === 200,
        `checkpoint-http-${response.statusCode}-${stored.error?.code ?? 'none'}`)
      invariant(stored.body?.status === 'stored' && stored.body.checkpointRevision === 1 &&
        stored.body.sessionRevision === revision,
      `checkpoint-not-stored-${stored.body?.status ?? 'missing'}-${stored.body?.reasonCode ?? 'none'}`)
    })

    await check(steps, 'resume', 'resume', 'bounded-checkpoint-resume', async () => {
      const response = await academic('session:resume', {
        sessionId,
        curriculumReleaseVersion: RELEASE_VERSION,
      })
      const resumed = responseJson(response)
      invariant(response.statusCode === 200,
        `resume-http-${response.statusCode}-${resumed.error?.code ?? 'none'}`)
      invariant(resumed.body?.status === 'resumable' &&
        resumed.body.revision === revision &&
        resumed.body.checkpoint?.revision === 1 &&
        resumed.body.checkpoint?.rawAnswerIncluded === false &&
        resumed.body.checkpoint?.transcriptIncluded === false,
      `session-resume-invalid-${resumed.body?.status ?? 'missing'}-${resumed.body?.checkpoint?.status ?? 'none'}`)
    })

    await check(steps, 'completion', 'completion', 'approved-terminal-completed', async () => {
      const segmentCompleted = responseJson(await academic('session:transition', {
        sessionId,
        expectedRevision: revision,
        idempotencyKey: 'transition-smoke-segment-b-complete',
        curriculumReleaseVersion: RELEASE_VERSION,
        transition: { type: 'segment-completed', segmentId: SECOND_SEGMENT },
      }))
      invariant(segmentCompleted.body?.status === 'stored' &&
        segmentCompleted.body.revision === 4, 'completion-segment-invalid')
      revision = segmentCompleted.body.revision
      const completed = responseJson(await academic('session:transition', {
        sessionId,
        expectedRevision: revision,
        idempotencyKey: 'transition-smoke-session-complete',
        curriculumReleaseVersion: RELEASE_VERSION,
        transition: { type: 'session-completed', segmentId: null },
      }))
      invariant(completed.body?.status === 'stored' && completed.body.state === 'completed' &&
        completed.body.revision === 5, 'completion-terminal-invalid')
      revision = completed.body.revision
      const closed = responseJson(await academic('session:resume', {
        sessionId,
        curriculumReleaseVersion: RELEASE_VERSION,
      }))
      invariant(closed.body?.status === 'closed' && closed.body.state === 'completed' &&
        closed.body.revision === revision, 'completion-resume-not-closed')
    })

    await check(negativeCases, 'settings-unavailable', 'settings unavailable',
      'safety-constraints-unavailable', async () => {
        await database.exec('delete from academy_private.study_effective_settings_safety_policy')
        try {
          const result = responseJson(await academic('session:begin', beginRequest({
            idempotencyKey: 'begin-smoke-settings-unavailable',
          })))
          invariant(result.body?.status === 'unavailable' &&
            result.body.reasonCode === 'safety_constraints_unavailable',
          'settings-unavailable-not-bounded')
        } finally {
          await database.exec(`
            insert into academy_private.study_effective_settings_safety_policy (
              minimum_work_minutes, maximum_work_minutes,
              break_minimum_minutes, break_maximum_minutes,
              required_break_interval_minutes
            ) values (1, 240, 1, 120, 240)
          `)
        }
      })

    await check(negativeCases, 'unpublished-release', 'unpublished release',
      'curriculum-release-unsupported', async () => {
        const result = responseJson(await academic('session:begin', beginRequest({
          idempotencyKey: 'begin-smoke-unpublished-release',
          curriculumContext: {
            releaseVersion: '9.9.9',
            lessonRef: LESSON_REF,
            skillRefs: [MATH_SKILL],
          },
        })))
        invariant(result.body?.status === 'unavailable' &&
          result.body.reasonCode === 'curriculum-release-unsupported',
        'unpublished-release-not-bounded')
      })

    await check(negativeCases, 'wrong-enrollment', 'wrong enrollment',
      'curriculum-release-unavailable', async () => {
        const result = responseJson(await academic('session:begin', beginRequest({
          idempotencyKey: 'begin-smoke-wrong-enrollment',
          subjectId: 'science',
        })))
        invariant(result.body?.status === 'unavailable' &&
          result.body.reasonCode === 'curriculum-release-unavailable',
        'wrong-enrollment-not-bounded')
        const wrongLearner = await issue(STUDENT_B)
        const wrongLearnerBody = responseJson(wrongLearner)
        invariant(wrongLearner.statusCode === 403 &&
          wrongLearnerBody.error?.code === 'learner_unavailable',
        `wrong-learner-not-denied-${wrongLearner.statusCode}-${wrongLearnerBody.error?.code ?? 'none'}`)
      })

    await check(negativeCases, 'manifest-mismatch', 'manifest mismatch',
      'curriculum-manifest-mismatch', async () => {
        const authority = createStudyBoundContentAuthority({ rpc: localRpc })
        const trusted = await authority.read({ sessionReference, sessionId })
        invariant(trusted.status === 'ready', 'content-authority-not-ready')
        const packageSource = createFilesystemBoundCurriculumPackageSource()
        const opened = await packageSource.open({
          ...trusted.curriculumBinding,
          curriculumManifestSha256: 'f'.repeat(64),
        })
        invariant(opened.status === 'manifest_mismatch' &&
          opened.reasonCode === 'curriculum-manifest-mismatch',
        'manifest-mismatch-not-bounded')
      })

    await check(negativeCases, 'content-membership-mismatch',
      'content membership mismatch', 'skill-not-eligible-for-lesson', async () => {
        const result = responseJson(await content([ELSEWHERE_MATH_SKILL]))
        invariant(result.status === 'membership_mismatch' &&
          result.reasonCode === 'skill-not-eligible-for-lesson' &&
          result.rejectedSkillRef === ELSEWHERE_MATH_SKILL,
        'content-membership-not-bounded')
      })

    await check(negativeCases, 'malformed-dto', 'malformed DTO',
      'invalid-request-before-rpc', async () => {
        const callsBefore = rpcCallCount
        const response = await academicHandler({
          path: '/api/study/academic-runtime',
          httpMethod: 'POST',
          headers: {
            authorization: `Bearer ${sessionReference}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            schemaVersion: 1,
            operation: 'session:resume',
            request: { sessionId, curriculumReleaseVersion: RELEASE_VERSION },
            releaseId: RELEASE_ID,
          }),
        })
        invariant(response.statusCode === 400 &&
          responseJson(response).error?.code === 'invalid_request',
        'malformed-dto-not-bounded')
        invariant(rpcCallCount === callsBefore, 'malformed-dto-reached-rpc')
      })

    await check(negativeCases, 'legacy-ambiguous-session', 'legacy ambiguous session',
      'legacy-curriculum-binding-ambiguous', async () => {
        const result = responseJson(await academic('session:resume', {
          sessionId: 'session-a',
          curriculumReleaseVersion: RELEASE_VERSION,
        }))
        invariant(result.body?.status === 'manual-review' &&
          result.body.reasonCode === 'legacy-curriculum-binding-ambiguous',
        'legacy-session-not-bounded')
      })

    await check(negativeCases, 'forged-authority', 'forged authority',
      'caller-authority-rejected-before-rpc', async () => {
        const callsBefore = rpcCallCount
        const response = await academic('session:begin', {
          ...beginRequest({ idempotencyKey: 'begin-smoke-forged-authority' }),
          studentId: STUDENT_A,
          role: 'guardian',
        })
        invariant(response.statusCode === 401 &&
          responseJson(response).error?.code === 'student_session_invalid',
        'forged-authority-not-denied')
        invariant(rpcCallCount === callsBefore, 'forged-authority-reached-rpc')
      })

    await check(steps, 'external-contact', 'external contact',
      'zero-fetch-attempts-local-seams-only', async () => {
        invariant(externalAttempts === 0, 'external-contact-attempted')
        invariant(rpcCallCount > 0, 'local-rpc-not-exercised')
      })

    return buildReport({ steps, negativeCases, externalAttempts, failure: null })
  } catch (error) {
    const failure = error instanceof SmokeFailure ? error.code : activeCheck
    const target = activeCollection
    if (!target.some(({ id }) => id === activeCheck)) {
      target.push({ id: activeCheck, label: activeCheck.replaceAll('-', ' '),
        status: 'FAIL', evidence: 'unexpected-result' })
    }
    return buildReport({ steps, negativeCases, externalAttempts, failure })
  } finally {
    await database?.close()
  }
}
