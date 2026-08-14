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
  './migrations/20260810120200_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810151000_academy_study_session_semantics_v2.sql',
  './migrations/20260810153000_academy_study_release_registry_bridge.sql',
  './migrations/20260813170000_academy_study_actor_authority_convergence.sql',
  './migrations/20260813171000_academy_study_cross_device_authority.sql',
  './migrations/20260813172000_academy_study_sync_lossless_v2.sql',
  './migrations/20260813173000_academy_study_sync_lossless_checkpoint_r1.sql',
] as const

const sources = Promise.all(files.map((filename) =>
  readFile(new URL(filename, import.meta.url), 'utf8')))

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const SIBLING_A = '00000000-0000-0000-0000-000000000102'
const IMPORT_OPERATION = '51000000-0000-4000-8000-000000000001'

let database: PGlite
let digestA: string
let digestB: string
let grantA: string

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
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub',
        ''
      )::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  studentPrincipal: boolean,
  operation: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({
    role,
    ...(subject ? { sub: subject } : {}),
    ...(studentPrincipal ? { academy_principal_kind: 'student_session_grant' } : {}),
  }).replaceAll("'", "''")
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

function guardian<T>(id: string, operation: () => Promise<T>) {
  return asRole('authenticated', id, false, operation)
}

function student<T>(id: string, operation: () => Promise<T>) {
  return asRole('authenticated', id, true, operation)
}

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, false, operation)
}

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

async function issue(guardianId: string, studentId: string) {
  return guardian(guardianId, () => rpc<{ sessionReference: string }>(
    'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
    ['academy-student-id', studentId],
  ))
}

const localScope = Object.freeze({
  householdRef: 'local-household-a',
  studentRef: 'local-student-a',
  assignmentRef: 'local-assignment-a',
  sessionRef: 'local-session-a',
})

const existingScope = Object.freeze({
  householdRef: 'existing-household-a',
  studentRef: 'existing-student-a',
  assignmentRef: 'existing-assignment-a',
  sessionRef: 'existing-session-a',
})

function checkpoint(revision: number) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint-import-a',
    revision,
    createdAt: '2026-08-01T14:05:00.000Z',
    updatedAt: `2026-08-01T14:0${Math.min(revision + 5, 9)}:00.000Z`,
    sessionId: localScope.sessionRef,
    lessonId: 'lesson-import-a',
    segmentId: 'segment-import-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 2,
      currentItemId: 'task-import-a',
      currentItemIndex: 1,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: ['segment-before-import-a'],
    perSegmentActiveTime: [
      { segmentId: 'segment-before-import-a', activeSeconds: 32 },
      { segmentId: 'segment-import-a', activeSeconds: 17 },
    ],
    pausedSeconds: 8,
    breakSeconds: 12,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:import-a',
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-import-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

const source = Object.freeze({
  studentRef: localScope.studentRef,
  assignmentRef: localScope.assignmentRef,
  lessonRef: 'lesson-import-a',
  sourceRef: 'source:current-events:a',
  title: 'Local government budget update',
  publisher: 'County public information office',
  publishedAt: '2026-07-31T12:00:00.000Z',
  attachedAt: '2026-08-01T13:55:00.000Z',
  status: 'ATTACHED_SATISFIED',
})

const attestation = Object.freeze({
  studentRef: localScope.studentRef,
  assignmentRef: localScope.assignmentRef,
  lessonRef: 'lesson-import-a',
  sessionRef: localScope.sessionRef,
  authority: 'GUARDIAN_ATTESTATION_REQUIRED',
  status: 'PENDING_GUARDIAN_ATTESTATION',
  learnerAssertedAt: '2026-08-01T14:08:00.000Z',
  attestedAt: null,
  attestedByRef: null,
  evidenceMode: null,
})

const initialHold = Object.freeze({
  schemaVersion: 1,
  holdRef: 'family-pilot-safety-hold:import-a',
  studentRef: localScope.studentRef,
  sessionRef: localScope.sessionRef,
  createdAt: '2026-08-01T14:07:00.000Z',
  status: 'open',
  reasonCode: 'parent-review-requested',
  source: 'parent',
  dedupeKey: `${localScope.studentRef}\u001f${localScope.sessionRef}\u001fparent-review-requested`,
})

const assessment = Object.freeze({
  assignmentRef: localScope.assignmentRef,
  assessmentRef: 'assessment:import-a',
  studentRef: localScope.studentRef,
  courseRef: 'course:ready-for-life-a',
  subject: 'ready-for-life',
  grade: 5,
  title: 'Household planning activity',
  authorityClass: 'GUARDIAN_REQUIRED',
  status: 'ACTIVE',
  createdAt: '2026-08-01T13:50:00.000Z',
  updatedAt: '2026-08-01T13:55:00.000Z',
  completedAt: null,
})

function importDocument(overrides: Record<string, unknown> = {}) {
  return {
    localScope,
    hostedScope: { assignmentRef: 'assignment-import-a', sessionRef: 'session-import-a' },
    session: {
      lessonRef: 'lesson-import-a', subjectRef: 'ready-for-life', state: 'active',
      startedAt: '2026-08-01T14:00:00.000Z', completedAt: null,
      intendedLocalDate: '2026-08-01',
    },
    checkpoint: checkpoint(3),
    socialSource: source,
    guardianAttestation: attestation,
    safetyState: { schemaVersion: 1, holds: [initialHold] },
    assessment,
    ...overrides,
  }
}

function authorityCheckpoint(operationId: string, serverRevision = 0, baseRevision = serverRevision) {
  const assignmentRecord = {
    assignmentRef: localScope.assignmentRef, lessonRef: 'lesson-import-a', subject: 'mathematics',
    title: 'Math lesson', state: 'active', sessionRef: localScope.sessionRef,
    progress: { completedSegmentRefs: ['segment-before-import-a'], totalSegments: 2,
      lastSegmentRef: 'segment-import-a', activeSeconds: 49 },
    pause: { pausedAt: null, resumedAt: null, pausedSeconds: 8, resumeSegmentRef: 'segment-import-a' },
    completedAt: null, createdAt: '2026-08-01T14:00:00.000Z',
    updatedAt: '2026-08-01T14:05:00.000Z', rawAnswerIncluded: false, transcriptIncluded: false,
  }
  const resume = { segmentId: 'segment-import-a', segmentOrdinal: 2,
    elapsedActiveSecondsInSegment: 17, completedSegmentIds: ['segment-before-import-a'],
    remainingSegmentIds: ['segment-import-a'], capturedAt: '2026-08-01T14:05:00.000Z' }
  return {
    contractVersion: 'hosted-study-sync-state.r2.v1',
    identity: { householdRef: localScope.householdRef, studentRef: localScope.studentRef,
      learnerRef: localScope.studentRef },
    sync: { serverRevision, baseRevision, operationId, idempotencyKey: operationId,
      operationKind: serverRevision === 0 ? 'FIRST_LINK_IMPORT' : 'CHECKPOINT',
      deviceRef: 'device:a', localSequence: serverRevision + 1, createdAt: '2026-08-01T14:05:00.000Z' },
    student: { studentRef: localScope.studentRef, displayName: 'Ada',
      createdAt: '2026-08-01T13:00:00.000Z', updatedAt: '2026-08-01T14:05:00.000Z',
      activeAssignmentRef: localScope.assignmentRef, assignments: [assignmentRecord] },
    studentProfile: { studentRef: localScope.studentRef, displayName: 'Ada', nominalGrade: '5',
      workingGradeBySubject: { mathematics: '5' }, enabledSubjects: ['mathematics'],
      createdAt: '2026-08-01T13:00:00.000Z', updatedAt: '2026-08-01T14:05:00.000Z' },
    appUpdatedAt: '2026-08-01T14:05:00.000Z', setupCompletedAt: '2026-08-01T13:00:00.000Z',
    assignments: [{ record: assignmentRecord, authorityRevision: 1,
      sessionIdentity: { assignmentRef: localScope.assignmentRef, lessonRef: 'lesson-import-a',
        blockRef: 'block-import-a', sessionRef: localScope.sessionRef,
        lineageRootRef: 'block-import-a', continuationKey: 'root' },
      completion: { kind: 'INCOMPLETE', completedAt: null } }],
    assessmentStates: [{ assignmentRef: localScope.assignmentRef, assessmentRef: 'assessment-import-a',
      studentRef: localScope.studentRef, courseRef: 'course-math-a', subject: 'mathematics', grade: 5,
      title: 'Math check', authorityClass: 'AUTO_SCOREABLE', status: 'SCORING_COMPLETE',
      createdAt: '2026-08-01T13:00:00.000Z', updatedAt: '2026-08-01T14:04:00.000Z', completedAt: null,
      evidenceRefs: ['evidence:math:a'], outcome: { assessmentRecordRef: 'assessment-record:math:a',
        decision: 'PARTIAL', assessedAt: '2026-08-01T14:04:00.000Z', assessorRef: 'assessor:math' },
      authorityRevision: 2 }],
    rflStates: [{ studentRef: localScope.studentRef, assignmentRef: localScope.assignmentRef,
      lessonRef: 'lesson-import-a', sessionRef: localScope.sessionRef, learnerAssertionState: 'ASSERTED',
      learnerAssertedAt: '2026-08-01T14:04:00.000Z', guardianState: 'PENDING', certifiedAt: null,
      attesterRef: null, evidenceMode: null, authorityRevision: 1 }],
    socialSources: [{ studentRef: localScope.studentRef, assignmentRef: localScope.assignmentRef,
      lessonRef: 'lesson-import-a', readiness: 'ATTACHED_SATISFIED', sourceRef: 'source:math:a',
      kind: 'reference', title: 'Math reference', publisher: 'Manuel Academy',
      publishedAt: '2026-07-01T00:00:00.000Z', attachedAt: '2026-08-01T14:02:00.000Z', sourceRevision: 1 }],
    safetyHolds: [
      { holdRef: 'hold:open:a', studentRef: localScope.studentRef, sessionRef: localScope.sessionRef,
        reasonCode: 'study-safety-uncertain', category: 'UNCERTAIN', source: 'study-safety',
        dedupeKey: 'hold-open-a', createdAt: '2026-08-01T14:03:00.000Z', status: 'OPEN',
        acknowledgedAt: null, clearedAt: null, clearAuthority: null, clearerRef: null, logicalRevision: 1 },
      { holdRef: 'hold:cleared:a', studentRef: localScope.studentRef, sessionRef: localScope.sessionRef,
        reasonCode: 'parent-review-requested', category: 'ADULT_REVIEW', source: 'parent',
        dedupeKey: 'hold-cleared-a', createdAt: '2026-08-01T13:30:00.000Z', status: 'CLEARED',
        acknowledgedAt: '2026-08-01T13:40:00.000Z', clearedAt: '2026-08-01T13:50:00.000Z',
        clearAuthority: 'GUARDIAN', clearerRef: 'guardian:a', logicalRevision: 2 },
    ],
    indexedDbDocument: {
      schemaVersion: 1, updatedAt: '2026-08-01T14:05:00.000Z',
      scope: { householdRef: localScope.householdRef, learnerRef: localScope.studentRef },
      preferences: null, parentSettings: null,
      calendar: [{
        block: { schemaVersion: 'calendar-parent-runtime.v1', internalBlockId: 'block-import-a',
          learnerRef: localScope.studentRef,
          sourceIdentity: { source: 'manuel_academy', externalItemId: 'lesson-import-a' },
          lineage: { rootInternalBlockId: 'block-import-a', continuationKey: 'root',
            completedBeforeOccurrence: [] }, title: 'Math lesson', blockType: 'new_instruction',
          canonicalTask: { taskType: 'direct-instruction' }, householdTimeZone: 'America/Detroit',
          scheduledLocalStart: '2026-08-01T10:00', scheduledStartInstant: '2026-08-01T14:00:00.000Z',
          intendedLocalDate: '2026-08-01', placementSource: 'explicit-offset',
          estimatedDurationMinutes: 20, actualDurationSeconds: 49, timerVisibility: 'shown',
          state: 'active', segments: [
            { segmentId: 'segment-before-import-a', planOrdinal: 1, title: 'Warm up',
              canonicalTaskType: 'retrieval-practice', estimatedMinutes: 5, required: true,
              actualActiveSeconds: 32, elapsedActiveSecondsBeforeBlock: 0,
              completedAt: '2026-08-01T14:03:00.000Z' },
            { segmentId: 'segment-import-a', planOrdinal: 2, title: 'Practice',
              canonicalTaskType: 'guided-practice', estimatedMinutes: 15, required: true,
              actualActiveSeconds: 17, elapsedActiveSecondsBeforeBlock: 0 },
          ], resumePoint: resume, interruptionHistory: [], revision: 3,
          lastEventAt: '2026-08-01T14:05:00.000Z', events: [] },
        plan: { lessonRef: 'lesson-import-a', title: 'Math lesson', subject: 'math',
          skillRefs: ['skill-import-a'], segments: [
            { segmentRef: 'segment-before-import-a', title: 'Warm up', taskType: 'retrieval-practice', estimatedMinutes: 5, required: true },
            { segmentRef: 'segment-import-a', title: 'Practice', taskType: 'guided-practice', estimatedMinutes: 15, required: true },
          ], masteryAuthority: 'completion-only', source: 'manuel-academy' },
      }],
      sessions: [{ scope: { householdRef: localScope.householdRef, learnerRef: localScope.studentRef,
        sessionRef: localScope.sessionRef }, lessonRef: 'lesson-import-a', segmentRef: 'segment-import-a',
        status: 'active', updatedAt: '2026-08-01T14:05:00.000Z', lastAcceptedEventRef: null,
        rawAnswerIncluded: false, transcriptIncluded: false }],
      checkpoints: [{ checkpointRef: 'durable-checkpoint-import-a', householdRef: localScope.householdRef,
        learnerRef: localScope.studentRef, sessionRef: localScope.sessionRef, lessonRef: 'lesson-import-a',
        segmentRef: 'segment-import-a', revision: 3, capturedAt: '2026-08-01T14:05:00.000Z',
        completedSegmentRefs: ['segment-before-import-a'], elapsedActiveSecondsInSegment: 17,
        responseDraftRef: null, rawAnswerIncluded: false, transcriptIncluded: false }],
      reviews: [], events: [], outbox: [],
    },
    privacy: { pinIncluded: false, bearerIncluded: false, rawLearnerResponseIncluded: false,
      rawTutorConversationIncluded: false, rawAudioIncluded: false, inferenceIncluded: false,
      adultAnswerAuthorityIncluded: false, answerMaterialIncluded: false },
  }
}

async function firstLink(
  digest: string,
  studentId: string,
  operationId: string,
  document: Record<string, unknown>,
) {
  return rpc<Record<string, unknown>>(`
    select public.academy_study_sync_first_link_v2(
      $1::text, $2::uuid, $3::uuid, $4::jsonb
    ) as result
  `, [digest, studentId, operationId, JSON.stringify(document)])
}

async function write(
  digest: string,
  studentId: string,
  assignmentRef: string,
  sessionId: string,
  expectedRevision: number,
  operationId: string,
  operation: string,
  payload: Record<string, unknown>,
) {
  return rpc<Record<string, unknown>>(`
    select public.academy_study_sync_write_v2(
      $1::text, $2::uuid, $3::text, $4::text, $5::bigint,
      $6::uuid, $7::text, $8::jsonb
    ) as result
  `, [digest, studentId, assignmentRef, sessionId, expectedRevision,
    operationId, operation, JSON.stringify(payload)])
}

async function hydrate(digest: string, studentId: string, assignmentRef: string, sessionId: string) {
  return rpc<Record<string, unknown>>(`
    select public.academy_study_sync_hydrate_v2(
      $1::text, $2::uuid, $3::text, $4::text
    ) as result
  `, [digest, studentId, assignmentRef, sessionId])
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const [index, migration] of (await sources).entries()) {
    try {
      await database.exec(migration)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in (
      '00000000-0000-0000-0000-0000000001a1',
      '00000000-0000-0000-0000-0000000001b1'
    );
    insert into public.academy_students (
      id, household_id, display_name, lifecycle_status, created_by
    ) values (
      '${SIBLING_A}', '00000000-0000-0000-0000-000000000011',
      'Study Sibling A', 'active', '${GUARDIAN_A}'
    );
    insert into public.academy_guardian_student_access (
      id, household_id, student_id, membership_id, permission_level,
      status, granted_by
    ) values (
      '00000000-0000-0000-0000-0000000001a2',
      '00000000-0000-0000-0000-000000000011', '${SIBLING_A}',
      '00000000-0000-0000-0000-0000000000a2', 'identity_manager',
      'active', '${GUARDIAN_A}'
    );
  `)
  const launchA = await issue(GUARDIAN_A, STUDENT_A)
  const launchB = await issue(GUARDIAN_B, STUDENT_B)
  digestA = createHash('sha256').update(launchA.sessionReference, 'ascii').digest('hex')
  digestB = createHash('sha256').update(launchB.sessionReference, 'ascii').digest('hex')
  const grant = await database.query<{ id: string }>(`
    select id from academy_private.student_session_grants where token_digest = $1
  `, [digestA])
  grantA = grant.rows[0].id
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study hosted sync lossless V2', () => {
  it('replays the fresh/upgrade chain and installs narrow browser RPC ACLs', async () => {
    const result = await database.query<{
      lossless_sync_version: number
      prior_rows_defaulted: number
      authenticated_first_link: boolean
      authenticated_hydrate: boolean
      authenticated_write: boolean
      service_first_link: boolean
      service_hydrate: boolean
      service_write: boolean
      mapping_authenticated_grants: number
      checkpoint_authenticated_grants: number
    }>(`
      select metadata.lossless_sync_version,
        (select count(*)::integer from public.academy_study_session_authority
          where safety_holds = '[]'::jsonb and social_source is null
            and guardian_attestation is null and assessment_state is null)
          as prior_rows_defaulted,
        has_function_privilege('authenticated',
          'public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)', 'execute')
          as authenticated_first_link,
        has_function_privilege('authenticated',
          'public.academy_study_sync_hydrate_v2(text,uuid,text,text)', 'execute')
          as authenticated_hydrate,
        has_function_privilege('authenticated',
          'public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb)', 'execute')
          as authenticated_write,
        has_function_privilege('service_role',
          'public.academy_study_sync_first_link_v2(text,uuid,uuid,jsonb)', 'execute')
          as service_first_link,
        has_function_privilege('service_role',
          'public.academy_study_sync_hydrate_v2(text,uuid,text,text)', 'execute')
          as service_hydrate,
        has_function_privilege('service_role',
          'public.academy_study_sync_write_v2(text,uuid,text,text,bigint,uuid,text,jsonb)', 'execute')
          as service_write,
        (select count(*)::integer from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name = 'study_sync_explicit_links_v2'
            and grantee in ('anon', 'authenticated', 'service_role'))
          as mapping_authenticated_grants,
        (select count(*)::integer from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name = 'study_sync_authority_checkpoints_r1'
            and grantee in ('anon', 'authenticated', 'service_role'))
          as checkpoint_authenticated_grants
      from academy_private.study_persistence_metadata as metadata
      where singleton
    `)
    expect(result.rows[0]).toEqual({
      lossless_sync_version: 2,
      prior_rows_defaulted: 2,
      authenticated_first_link: true,
      authenticated_hydrate: true,
      authenticated_write: true,
      service_first_link: false,
      service_hydrate: false,
      service_write: false,
      mapping_authenticated_grants: 0,
      checkpoint_authenticated_grants: 0,
    })
  })

  it('fails first-link closed for student, wrong household and sibling grants', async () => {
    const studentDenied = await student(grantA, () => firstLink(
      digestA, STUDENT_A, '51000000-0000-4000-8000-000000000010', importDocument(),
    ))
    const householdDenied = await guardian(GUARDIAN_B, () => firstLink(
      digestB, STUDENT_A, '51000000-0000-4000-8000-000000000011', importDocument(),
    ))
    const siblingDenied = await guardian(GUARDIAN_A, () => firstLink(
      digestA, SIBLING_A, '51000000-0000-4000-8000-000000000012', importDocument(),
    ))
    expect(studentDenied).toMatchObject({ status: 'denied', code: 'actor-not-authorized' })
    expect(householdDenied).toMatchObject({ status: 'denied', code: 'study-session-invalid' })
    expect(siblingDenied).toMatchObject({ status: 'denied', code: 'study-session-invalid' })
  })

  it('links existing canonical state without silently importing over it', async () => {
    const result = await guardian(GUARDIAN_A, () => firstLink(
      digestA,
      STUDENT_A,
      '51000000-0000-4000-8000-000000000020',
      importDocument({
        localScope: existingScope,
        hostedScope: { assignmentRef: 'lesson-a', sessionRef: 'session-a' },
        session: {
          lessonRef: 'lesson-a', subjectRef: 'math', state: 'completed',
          startedAt: '2026-08-01T14:00:00.000Z',
          completedAt: '2026-08-01T14:30:00.000Z', intendedLocalDate: '2026-08-01',
        },
        checkpoint: null, socialSource: null, guardianAttestation: null,
        safetyState: { schemaVersion: 1, holds: [] }, assessment: null,
      }),
    ))
    const stored = await database.query<{ state: string; revision: number }>(`
      select state, revision from public.academy_study_sessions where id = 'session-a'
    `)
    expect(result).toMatchObject({ status: 'linked-existing' })
    expect(stored.rows[0]).toEqual({ state: 'active', revision: 1 })
  })

  it('imports exact minimized state and repeats idempotently', async () => {
    const imported = await guardian(GUARDIAN_A, () => firstLink(
      digestA, STUDENT_A, IMPORT_OPERATION, importDocument(),
    ))
    const replay = await guardian(GUARDIAN_A, () => firstLink(
      digestA, STUDENT_A, IMPORT_OPERATION, importDocument(),
    ))
    const collision = await guardian(GUARDIAN_A, () => firstLink(
      digestA, STUDENT_A, IMPORT_OPERATION,
      importDocument({ socialSource: { ...source, title: 'Different title' } }),
    ))
    expect(imported).toMatchObject({
      status: 'imported',
      mapping: { hostedStudentId: STUDENT_A, hostedSessionRef: 'session-import-a' },
      revisions: { authority: 2, session: 1, checkpoint: 3 },
    })
    expect(replay).toEqual(imported)
    expect(collision).toMatchObject({ status: 'idempotency-collision' })
  })

  it('resolves only the exact explicit mapping', async () => {
    const mapped = await guardian(GUARDIAN_A, () => rpc<Record<string, unknown>>(`
      select public.academy_study_sync_resolve_mapping_v2(
        $1::text, $2::uuid, $3::jsonb
      ) as result
    `, [digestA, STUDENT_A, JSON.stringify(localScope)]))
    const unavailable = await guardian(GUARDIAN_A, () => rpc<Record<string, unknown>>(`
      select public.academy_study_sync_resolve_mapping_v2(
        $1::text, $2::uuid, $3::jsonb
      ) as result
    `, [digestA, STUDENT_A, JSON.stringify({ ...localScope, studentRef: 'local-sibling' })]))
    expect(mapped).toMatchObject({
      status: 'mapped',
      mapping: { localStudentRef: localScope.studentRef, hostedStudentId: STUDENT_A },
    })
    expect(unavailable).toEqual({ schemaVersion: 2, status: 'unavailable' })
  })

  it('hydrates the full checkpoint and exact RFL, Social, safety and assessment state', async () => {
    const hydrated = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    expect(hydrated).toMatchObject({
      status: 'ready',
      mapping: { localSessionRef: localScope.sessionRef, hostedSessionRef: 'session-import-a' },
      document: {
        studentRef: localScope.studentRef,
        assignmentRef: localScope.assignmentRef,
        studySessionId: localScope.sessionRef,
        completion: { state: 'active', completedAt: null },
        revisions: { authority: 2, session: 1, checkpoint: 3 },
        checkpoint: {
          checkpointId: 'checkpoint-import-a', revision: 3,
          sessionId: localScope.sessionRef,
          safeInstructionalCursor: checkpoint(3).safeInstructionalCursor,
          completedSegmentIds: checkpoint(3).completedSegmentIds,
          perSegmentActiveTime: checkpoint(3).perSegmentActiveTime,
          pausedSeconds: 8, breakSeconds: 12,
          protectedTutorStateRef: 'tutor-state:import-a',
          tutorInteractionRef: 'interaction-import-a',
          technicalInterruption: checkpoint(3).technicalInterruption,
          rawAnswerIncluded: false, transcriptIncluded: false,
        },
        socialSource: source,
        guardianAttestation: attestation,
        safetyState: { schemaVersion: 1, holds: [initialHold] },
        assessment,
      },
    })
    expect(JSON.stringify(hydrated)).not.toMatch(/answerText|transcriptText|diagnos|emotion/i)
  })

  it('fails hydrate and writes closed for wrong household, student, assignment and session', async () => {
    const wrongHousehold = await guardian(GUARDIAN_B, () => hydrate(
      digestB, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    const wrongSibling = await guardian(GUARDIAN_A, () => hydrate(
      digestA, SIBLING_A, 'assignment-import-a', 'session-import-a',
    ))
    const wrongAssignment = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-wrong', 'session-import-a',
    ))
    const wrongSession = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-a', 2,
      '52000000-0000-4000-8000-000000000001', 'safety:hold', { hold: initialHold },
    ))
    expect(wrongHousehold).toMatchObject({ status: 'unavailable' })
    expect(wrongSibling).toMatchObject({ status: 'unavailable' })
    expect(wrongAssignment).toMatchObject({ status: 'unavailable' })
    expect(wrongSession).toMatchObject({ status: 'denied', code: 'study-session-invalid' })
  })

  it('enforces RLS for guardian, sibling and student principals', async () => {
    const guardianRows = await guardian(GUARDIAN_A, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))
    const otherRows = await guardian(GUARDIAN_B, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))
    const learnerRows = await student(grantA, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))
    expect(guardianRows.rows.map((row) => row.session_id)).toEqual([
      'session-a', 'session-import-a',
    ])
    expect(otherRows.rows.map((row) => row.session_id)).toEqual(['session-b'])
    expect(learnerRows.rows.map((row) => row.session_id)).toEqual([
      'session-a', 'session-import-a',
    ])
  })

  it('applies authority CAS, lost-retry idempotency and stale revision conflicts', async () => {
    const hold = {
      ...initialHold,
      holdRef: 'family-pilot-safety-hold:second-a',
      createdAt: '2026-08-01T14:09:00.000Z',
      reasonCode: 'study-safety-uncertain',
      source: 'study-safety',
      dedupeKey: `${localScope.studentRef}\u001f${localScope.sessionRef}\u001fstudy-safety-uncertain`,
    }
    const operationId = '53000000-0000-4000-8000-000000000001'
    const stored = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 2,
      operationId, 'safety:hold', { hold },
    ))
    const lostRetry = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 2,
      operationId, 'safety:hold', { hold },
    ))
    const collision = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 3,
      operationId, 'safety:hold', { hold },
    ))
    const stale = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 2,
      '53000000-0000-4000-8000-000000000002', 'safety:hold', { hold },
    ))
    expect(stored).toMatchObject({ status: 'stored', serverRevision: 3 })
    expect(lostRetry).toEqual(stored)
    expect(collision).toMatchObject({ status: 'idempotency-collision' })
    expect(stale).toMatchObject({ status: 'revision-conflict', serverRevision: 3 })
  })

  it('allows student progress/assert and guardian source, safety-clear and RFL-attest privileges', async () => {
    const checkpointStored = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 3,
      '54000000-0000-4000-8000-000000000001',
      'checkpoint:compare-and-swap', { checkpoint: checkpoint(4) },
    ))
    const studentClear = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 3,
      '54000000-0000-4000-8000-000000000002', 'safety:clear', {
        holdRef: initialHold.holdRef,
        clearedAt: '2026-08-01T14:12:00.000Z',
        clearedByRef: 'adult:guardian-a',
      },
    ))
    const certified = { ...attestation, status: 'CERTIFIED',
      attestedAt: '2026-08-01T14:13:00.000Z', attestedByRef: 'adult:guardian-a',
      evidenceMode: 'adult-observed' }
    const studentAttest = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 3,
      '54000000-0000-4000-8000-000000000003', 'rfl:attest',
      { attestation: certified },
    ))
    const heldCompletion = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 1,
      '54000000-0000-4000-8000-000000000008', 'session:complete',
      { completedAt: '2026-08-01T14:12:30.000Z' },
    ))
    const existingAttestation = {
      studentRef: existingScope.studentRef,
      assignmentRef: existingScope.assignmentRef,
      lessonRef: 'lesson-a',
      sessionRef: existingScope.sessionRef,
      authority: 'GUARDIAN_ATTESTATION_REQUIRED',
      status: 'PENDING_GUARDIAN_ATTESTATION',
      learnerAssertedAt: '2026-08-01T14:10:00.000Z',
      attestedAt: null,
      attestedByRef: null,
      evidenceMode: null,
    }
    const asserted = await student(grantA, () => write(
      digestA, STUDENT_A, 'lesson-a', 'session-a', 1,
      '54000000-0000-4000-8000-000000000006', 'rfl:assert',
      { attestation: existingAttestation },
    ))
    const existingSource = {
      studentRef: existingScope.studentRef,
      assignmentRef: existingScope.assignmentRef,
      lessonRef: 'lesson-a',
      sourceRef: 'source:existing-a',
      title: 'Existing session source',
      publisher: 'County public information office',
      publishedAt: '2026-07-31T12:00:00.000Z',
      attachedAt: '2026-08-01T14:11:00.000Z',
      status: 'ATTACHED_SATISFIED',
    }
    const sourceAttached = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'lesson-a', 'session-a', 2,
      '54000000-0000-4000-8000-000000000007', 'social-source:attach',
      { source: existingSource },
    ))
    const cleared = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 3,
      '54000000-0000-4000-8000-000000000004', 'safety:clear', {
        holdRef: initialHold.holdRef,
        clearedAt: '2026-08-01T14:12:00.000Z',
        clearedByRef: 'adult:guardian-a',
      },
    ))
    const allCleared = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 4,
      '54000000-0000-4000-8000-000000000009', 'safety:clear', {
        holdRef: 'family-pilot-safety-hold:second-a',
        clearedAt: '2026-08-01T14:12:30.000Z',
        clearedByRef: 'adult:guardian-a',
      },
    ))
    const attested = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 5,
      '54000000-0000-4000-8000-000000000005', 'rfl:attest',
      { attestation: certified },
    ))
    expect(checkpointStored).toMatchObject({ status: 'stored', serverRevision: 4 })
    expect(studentClear).toMatchObject({ status: 'denied', code: 'actor-not-authorized' })
    expect(studentAttest).toMatchObject({ status: 'denied', code: 'actor-not-authorized' })
    expect(heldCompletion).toMatchObject({ status: 'denied', code: 'safety-hold-active' })
    expect(asserted).toMatchObject({ status: 'stored', serverRevision: 2 })
    expect(sourceAttached).toMatchObject({ status: 'stored', serverRevision: 3 })
    expect(cleared).toMatchObject({ status: 'stored', serverRevision: 4 })
    expect(allCleared).toMatchObject({
      status: 'stored', serverRevision: 5, safetyState: 'clear',
    })
    expect(attested).toMatchObject({
      status: 'stored', serverRevision: 6, guardianAttestationStatus: 'CERTIFIED',
    })
  })

  it('CAS-writes assessment and completion, then hydrates exact Device-B state', async () => {
    const certifiedAssessment = {
      ...assessment, status: 'CERTIFIED',
      updatedAt: '2026-08-01T14:14:00.000Z',
      completedAt: '2026-08-01T14:14:00.000Z',
    }
    const assessed = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 6,
      '55000000-0000-4000-8000-000000000001', 'assessment:set-state',
      { assessment: certifiedAssessment },
    ))
    const completed = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 1,
      '55000000-0000-4000-8000-000000000002', 'session:complete',
      { completedAt: '2026-08-01T14:15:00.000Z' },
    ))
    const hydrated = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    expect(assessed).toMatchObject({ status: 'stored', serverRevision: 7 })
    expect(completed).toMatchObject({
      status: 'stored', serverRevision: 2, completionState: 'completed',
    })
    expect(hydrated).toMatchObject({
      status: 'ready',
      document: {
        completion: { state: 'completed', completedAt: '2026-08-01T14:15:00.000Z' },
        revisions: { authority: 7, session: 2, checkpoint: 4 },
        checkpoint: { revision: 4, sessionId: localScope.sessionRef },
        guardianAttestation: {
          status: 'CERTIFIED', learnerAssertedAt: attestation.learnerAssertedAt,
          attestedByRef: 'adult:guardian-a', evidenceMode: 'adult-observed',
        },
        safetyState: { holds: [
          { holdRef: initialHold.holdRef, status: 'cleared', clearedBy: 'adult:guardian-a' },
          { holdRef: 'family-pilot-safety-hold:second-a', status: 'cleared' },
        ] },
        assessment: certifiedAssessment,
      },
    })
  })

  it('losslessly round-trips canonical A→DB→B and B→DB→A with checkpoint CAS', async () => {
    const firstId = '57000000-0000-4000-8000-000000000001'
    const original = authorityCheckpoint(firstId)
    const linked = await guardian(GUARDIAN_A, () => firstLink(
      digestA, STUDENT_A, firstId, importDocument({ authorityCheckpoint: original }),
    ))
    const hydratedB = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    expect(linked).toMatchObject({ status: 'linked-existing', revisions: { authorityCheckpoint: 0 } })
    expect(hydratedB).toMatchObject({ status: 'ready', authorityCheckpointRevision: 0 })
    expect(hydratedB.authorityCheckpoint).toEqual(original)

    const writeId = '57000000-0000-4000-8000-000000000002'
    const advanced = structuredClone(authorityCheckpoint(writeId, 1, 0))
    const durable = advanced.indexedDbDocument as Record<string, any>
    durable.updatedAt = '2026-08-01T14:06:00.000Z'
    durable.checkpoints[0].revision = 4
    durable.checkpoints[0].elapsedActiveSecondsInSegment = 31
    durable.checkpoints[0].capturedAt = '2026-08-01T14:06:00.000Z'
    durable.calendar[0].block.resumePoint.elapsedActiveSecondsInSegment = 31
    durable.calendar[0].block.resumePoint.capturedAt = '2026-08-01T14:06:00.000Z'
    durable.calendar[0].block.revision = 4
    durable.calendar[0].block.lastEventAt = '2026-08-01T14:06:00.000Z'
    durable.sessions[0].updatedAt = '2026-08-01T14:06:00.000Z'
    const deniedStudent = await student(grantA, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 0, writeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: advanced },
    ))
    const stored = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 0, writeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: advanced },
    ))
    const retry = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 0, writeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: advanced },
    ))
    const collisionPayload = structuredClone(advanced)
    const collisionDocument = collisionPayload.indexedDbDocument as Record<string, any>
    collisionDocument.checkpoints[0].elapsedActiveSecondsInSegment = 32
    const collision = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 0, writeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: collisionPayload },
    ))
    const stale = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 0,
      '57000000-0000-4000-8000-000000000003',
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: advanced },
    ))
    const hydratedA = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    expect(deniedStudent).toMatchObject({ status: 'denied', code: 'actor-not-authorized' })
    expect(stored).toMatchObject({ status: 'stored', revisionDomain: 'authority-checkpoint', serverRevision: 1 })
    expect(retry).toEqual(stored)
    expect(collision).toMatchObject({ status: 'idempotency-collision' })
    expect(stale).toMatchObject({ status: 'revision-conflict', serverRevision: 1 })
    expect(hydratedA).toMatchObject({ status: 'ready', authorityCheckpointRevision: 1 })
    expect(hydratedA.authorityCheckpoint).toEqual(advanced)

    const malformed = structuredClone(authorityCheckpoint(
      '57000000-0000-4000-8000-000000000004', 2, 1,
    )) as Record<string, any>
    malformed.indexedDbDocument.checkpoints[0].unknownAuthority = true
    const refused = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 1,
      '57000000-0000-4000-8000-000000000004',
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: malformed },
    ))
    expect(refused).toMatchObject({ status: 'invalid-write', reasonCode: 'invalid-authority-checkpoint' })

    const completeId = '57000000-0000-4000-8000-000000000005'
    const completedState = structuredClone(authorityCheckpoint(completeId, 2, 1)) as Record<string, any>
    const completedRecord = { ...completedState.student.assignments[0], state: 'completed',
      sessionRef: null, completedAt: '2026-08-01T14:10:00.000Z', updatedAt: '2026-08-01T14:10:00.000Z' }
    completedState.student.assignments[0] = completedRecord
    completedState.assignments[0].record = completedRecord
    completedState.assignments[0].completion = { kind: 'NORMAL_CERTIFIED', completedAt: '2026-08-01T14:10:00.000Z' }
    const completedWrite = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 1, completeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: completedState },
    ))
    const revertId = '57000000-0000-4000-8000-000000000006'
    const reverted = authorityCheckpoint(revertId, 3, 2)
    const revertWrite = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 2, revertId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: reverted },
    ))
    expect(completedWrite).toMatchObject({ status: 'stored', serverRevision: 2 })
    expect(revertWrite).toMatchObject({ status: 'invalid-write', reasonCode: 'invalid-authority-checkpoint' })
    const unsafeId = '57000000-0000-4000-8000-000000000007'
    const unsafeRemoval = structuredClone(completedState)
    unsafeRemoval.sync = { ...unsafeRemoval.sync, serverRevision: 3, baseRevision: 2,
      operationId: unsafeId, idempotencyKey: unsafeId, localSequence: 3 }
    unsafeRemoval.safetyHolds = unsafeRemoval.safetyHolds.filter((item: any) => item.status === 'CLEARED')
    const unsafeWrite = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 2, unsafeId,
      'authority-checkpoint:compare-and-swap', { authorityCheckpoint: unsafeRemoval },
    ))
    expect(unsafeWrite).toMatchObject({ status: 'invalid-write', reasonCode: 'invalid-authority-checkpoint' })
    const oversized = await database.query<{ refused: boolean }>(`
      select not academy_private.study_sync_authority_checkpoint_shape_valid_r1(
        jsonb_build_object('oversized', repeat('x', 2097152))
      ) as refused
    `)
    expect(oversized.rows[0].refused).toBe(true)
  })

  it('revocation immediately removes hydrate, write and RLS authority', async () => {
    const revoked = await service(() => rpc<Record<string, unknown>>(
      'select public.academy_study_revoke_session_v1($1::text) as result',
      [digestA],
    ))
    const unavailable = await guardian(GUARDIAN_A, () => hydrate(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a',
    ))
    const denied = await guardian(GUARDIAN_A, () => write(
      digestA, STUDENT_A, 'assignment-import-a', 'session-import-a', 6,
      '56000000-0000-4000-8000-000000000001', 'assessment:set-state',
      { assessment },
    ))
    const learnerRows = await student(grantA, () => database.query<{ count: number }>(`
      select count(*)::integer as count from public.academy_study_session_authority
    `))
    expect(revoked).toMatchObject({ status: 'revoked' })
    expect(unavailable).toMatchObject({ status: 'unavailable' })
    expect(denied).toMatchObject({ status: 'denied', code: 'study-session-invalid' })
    expect(learnerRows.rows[0].count).toBe(0)
  })
})
