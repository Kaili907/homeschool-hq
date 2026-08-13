import {
  emptyFamilyPilotState,
  parseFamilyPilotState,
  type FamilyPilotAssignmentRecordV1,
  type FamilyPilotStateV1,
  type FamilyPilotStudentRecordV1,
} from '../../src/study/family-pilot/core'
import {
  emptyDurableStudyDocument,
  parseDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../../src/study/family-pilot/durable-ports'
import {
  emptyFinalFamilyPilotAppState,
  parseFinalFamilyPilotAppState,
  type FinalFamilyPilotAppStateV1,
  type FinalFamilyPilotAssessmentAssignment,
  type FinalFamilyPilotSourceAttachment,
} from '../../src/study/family-pilot/final-app/state'
import type { FinalAssessmentAttemptV1 } from '../../src/study/family-pilot/final-app/assessment'
import type {
  LearnerAssessmentReceipt,
  LearnerResponseRecord,
} from '../../src/study/family-pilot/final-app/learner-response/types'
import type { FinalFamilyPilotAttestationRecord } from '../../src/study/family-pilot/final-composition'
import type { SafetyHoldV1 } from '../../src/study/family-pilot/safety'
import type { FamilySetupStudent } from '../../src/study/family-pilot/setup'

export const R2_SCHEMA_VERSION = 2 as const
export const HOUSEHOLD_ALPHA = 'household:family-pilot-alpha'
export const HOUSEHOLD_BETA = 'household:family-pilot-beta'
export const STUDENT_ADA = 'student:ada'
export const STUDENT_GRACE = 'student:grace'
export const LESSON_MATH = 'ma-g5-mathematics-u01-l01'
export const LESSON_RFL = 'ma-g5-ready-for-life-u01-l01'
export const LESSON_SOCIAL = 'ma-g5-social-studies-u01-l01'
export const LESSON_SAFETY = 'ma-g5-health-u01-l01'
export const ASSESSMENT_MATH = 'ma-g5-mathematics-u01-assessment'
export const ASSIGNMENT_MATH = 'assignment:ada:math-u01-l01'
export const ASSIGNMENT_RFL = 'assignment:ada:rfl-u01-l01'
export const ASSIGNMENT_SOCIAL = 'assignment:ada:social-u01-l01'
export const ASSIGNMENT_SAFETY = 'assignment:ada:safety-u01-l01'
export const ASSESSMENT_ASSIGNMENT = 'assessment:ada:math-u01'
export const SESSION_MATH = 'session:ada:math-u01-l01'
export const SEGMENTS_MATH = Object.freeze([
  `${LESSON_MATH}:segment:learn`,
  `${LESSON_MATH}:segment:practice`,
  `${LESSON_MATH}:segment:reflect`,
])

export const FIXED_NOW = '2026-08-13T12:00:00.000Z'

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export interface LearnerSyncDocumentR2 {
  readonly schemaVersion: typeof R2_SCHEMA_VERSION
  readonly householdRef: string
  readonly studentRef: string
  readonly setupProfile: FamilySetupStudent
  readonly coreStudent: FamilyPilotStudentRecordV1
  readonly app: {
    readonly sessions: FinalFamilyPilotAppStateV1['sessions']
    readonly sourceAttachments: readonly FinalFamilyPilotSourceAttachment[]
    readonly assessmentAssignments: readonly FinalFamilyPilotAssessmentAssignment[]
    readonly attestations: readonly FinalFamilyPilotAttestationRecord[]
    readonly safetyHolds: readonly SafetyHoldV1[]
  }
  readonly durableStudy: DurableStudyDocumentV1
  readonly learnerResponses: readonly LearnerResponseRecord[]
  readonly assessmentAttempts: readonly FinalAssessmentAttemptV1[]
  readonly serverRevision: number
  readonly serverAcceptedAt: string
}

export interface HouseholdSnapshotR2 {
  readonly schemaVersion: typeof R2_SCHEMA_VERSION
  readonly householdRef: string
  readonly learners: readonly LearnerSyncDocumentR2[]
  readonly cursor: number
}

export type SyncOperationR2 =
  | { readonly type: 'assign'; readonly assignment: FamilyPilotAssignmentRecordV1 }
  | { readonly type: 'start'; readonly assignmentRef: string; readonly lessonRef: string; readonly sessionRef: string }
  | { readonly type: 'complete-segment'; readonly assignmentRef: string; readonly lessonRef: string; readonly sessionRef: string; readonly segmentRef: string; readonly activeSeconds: number }
  | { readonly type: 'save-response'; readonly response: LearnerResponseRecord }
  | { readonly type: 'score-response'; readonly itemRef: string; readonly receipt: LearnerAssessmentReceipt }
  | { readonly type: 'assign-assessment'; readonly assignment: FinalFamilyPilotAssessmentAssignment }
  | { readonly type: 'set-assessment-attempt'; readonly attempt: FinalAssessmentAttemptV1 }
  | { readonly type: 'finish'; readonly assignmentRef: string; readonly authority: 'STANDARD' | 'GUARDIAN_ATTESTATION_REQUIRED' }
  | { readonly type: 'attest'; readonly attestation: FinalFamilyPilotAttestationRecord }
  | { readonly type: 'attach-source'; readonly attachment: FinalFamilyPilotSourceAttachment }
  | { readonly type: 'place-safety-hold'; readonly hold: SafetyHoldV1 }
  | { readonly type: 'clear-safety-hold'; readonly holdRef: string; readonly clearedAt: string; readonly clearedBy: string }

export interface SyncMutationR2 {
  readonly requestRef: string
  readonly idempotencyKey: string
  readonly householdRef: string
  readonly studentRef: string
  readonly baseRevision: number
  /** Diagnostic evidence only. It never chooses the winner. */
  readonly deviceOccurredAt: string
  readonly operation: SyncOperationR2
}

export interface FirstLinkRequestR2 {
  readonly rpc: 'family_pilot_sync_first_link_r2'
  readonly requestRef: string
  readonly deviceInstallRef: string
  readonly householdRef: string
  readonly localLearners: readonly LearnerSyncDocumentR2[]
}

export interface PullRequestR2 {
  readonly rpc: 'family_pilot_sync_pull_r2'
  readonly requestRef: string
  readonly householdRef: string
  readonly afterCursor: number
}

export interface PushRequestR2 {
  readonly rpc: 'family_pilot_sync_push_r2'
  readonly requestRef: string
  readonly householdRef: string
  readonly mutations: readonly SyncMutationR2[]
}

export type R2RpcRequest = FirstLinkRequestR2 | PullRequestR2 | PushRequestR2

export type R2RpcResponse =
  | { readonly status: 'ok'; readonly requestRef: string; readonly snapshot: HouseholdSnapshotR2; readonly duplicate: boolean }
  | { readonly status: 'stale'; readonly requestRef: string; readonly remote: LearnerSyncDocumentR2 }
  | { readonly status: 'auth-error'; readonly requestRef: string; readonly reasonCode: 'session-expired' | 'session-invalid' }
  | { readonly status: 'forbidden'; readonly requestRef: string; readonly reasonCode: 'wrong-household' | 'student-scope-forbidden' | 'parent-role-required' }
  | { readonly status: 'safety-blocked'; readonly requestRef: string; readonly reasonCode: 'safety-hold' }
  | { readonly status: 'retryable'; readonly requestRef: string; readonly reasonCode: 'offline' | 'server-error' | 'lost-ack' }
  | { readonly status: 'invalid-response'; readonly requestRef: string; readonly reasonCode: 'malformed-response' | 'corrupt-remote-state' | 'reordered-response' }

export interface R2Session {
  readonly sessionRef: string
  readonly householdRef: string
  readonly actorRef: string
  readonly role: 'parent' | 'student'
  readonly authorizedStudentRefs: readonly string[]
  readonly bearerToken: string
  readonly expiresAt: string
}

function setupStudent(studentRef: string, displayName: string, now = FIXED_NOW): FamilySetupStudent {
  return Object.freeze({
    studentRef,
    displayName,
    nominalGrade: '5',
    workingGradeBySubject: Object.freeze({ mathematics: '5' }),
    enabledSubjects: Object.freeze(['mathematics', 'ready-for-life', 'social-studies', 'health']),
    pinRequired: studentRef === STUDENT_ADA,
    createdAt: now,
    updatedAt: now,
  })
}

function coreStudent(profile: FamilySetupStudent): FamilyPilotStudentRecordV1 {
  return Object.freeze({
    studentRef: profile.studentRef,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    activeAssignmentRef: null,
    assignments: Object.freeze([]),
  })
}

export function assignmentFixture(input: {
  assignmentRef: string
  lessonRef: string
  subject: string
  title: string
  now?: string
}): FamilyPilotAssignmentRecordV1 {
  const now = input.now ?? FIXED_NOW
  return Object.freeze({
    assignmentRef: input.assignmentRef,
    lessonRef: input.lessonRef,
    subject: input.subject,
    title: input.title,
    state: 'planned',
    sessionRef: null,
    progress: Object.freeze({ completedSegmentRefs: Object.freeze([]), totalSegments: 3, lastSegmentRef: null, activeSeconds: 0 }),
    pause: Object.freeze({ pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null }),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

export function createLearnerDocument(
  studentRef: string,
  householdRef = HOUSEHOLD_ALPHA,
  now = FIXED_NOW,
): LearnerSyncDocumentR2 {
  const profile = setupStudent(studentRef, studentRef === STUDENT_ADA ? 'Ada' : 'Grace', now)
  return Object.freeze({
    schemaVersion: R2_SCHEMA_VERSION,
    householdRef,
    studentRef,
    setupProfile: profile,
    coreStudent: coreStudent(profile),
    app: Object.freeze({
      sessions: Object.freeze([]),
      sourceAttachments: Object.freeze([]),
      assessmentAssignments: Object.freeze([]),
      attestations: Object.freeze([]),
      safetyHolds: Object.freeze([]),
    }),
    durableStudy: emptyDurableStudyDocument({ householdRef, learnerRef: studentRef }, now),
    learnerResponses: Object.freeze([]),
    assessmentAttempts: Object.freeze([]),
    serverRevision: 0,
    serverAcceptedAt: now,
  })
}

export function createEmptyDeviceState(householdRef = HOUSEHOLD_ALPHA, now = FIXED_NOW): {
  core: FamilyPilotStateV1
  app: FinalFamilyPilotAppStateV1
} {
  return {
    core: emptyFamilyPilotState(now),
    app: emptyFinalFamilyPilotAppState(now, householdRef),
  }
}

function assessmentAttemptIsCurrent(value: FinalAssessmentAttemptV1): boolean {
  if (value.schemaVersion !== 1 || !value.assignmentRef || !value.assessmentRef || !value.studentRef || !value.updatedAt) return false
  if (!['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'].includes(value.status)) return false
  return Object.entries(value.responses).every(([taskRef, response]) =>
    response.taskRef === taskRef && Boolean(response.savedAt) &&
    (typeof response.value === 'string' || typeof response.value === 'number' || Array.isArray(response.value)))
}

function responseIsCurrent(value: LearnerResponseRecord): boolean {
  if (value.schemaVersion !== 1 || !value.lessonRef || !value.studentRef || !value.assignmentRef || !value.attemptRef || !value.itemRef) return false
  if (value.status === 'PENDING_ASSESSMENT') return value.assessment === null
  return value.status === 'ASSESSED' && value.assessment !== null && Boolean(value.assessment.assessorRef)
}

/** Validates the aggregate through the current production parsers, not a parallel toy parser. */
export function validateLearnerDocument(value: LearnerSyncDocumentR2): boolean {
  if (value.schemaVersion !== R2_SCHEMA_VERSION || value.householdRef !== value.durableStudy.scope.householdRef || value.studentRef !== value.durableStudy.scope.learnerRef) return false
  if (!Number.isSafeInteger(value.serverRevision) || value.serverRevision < 0 || !Number.isFinite(Date.parse(value.serverAcceptedAt))) return false
  const core = parseFamilyPilotState({
    schemaVersion: 1,
    updatedAt: value.coreStudent.updatedAt,
    activeStudentRef: value.coreStudent.studentRef,
    students: [value.coreStudent],
  })
  if (!core || core.students.length !== 1) return false
  const app = parseFinalFamilyPilotAppState({
    schemaVersion: 1,
    householdRef: value.householdRef,
    updatedAt: value.serverAcceptedAt,
    setup: { students: [value.setupProfile], completedAt: value.setupProfile.updatedAt },
    activeStudentRef: value.studentRef,
    sessions: value.app.sessions,
    sourceAttachments: value.app.sourceAttachments,
    assessmentAssignments: value.app.assessmentAssignments,
    attestations: value.app.attestations,
    safety: { schemaVersion: 1, holds: value.app.safetyHolds },
    pinDigests: {},
  })
  if (!app.state) return false
  if (parseDurableStudyDocument(value.durableStudy, { householdRef: value.householdRef, learnerRef: value.studentRef }).status !== 'current') return false
  if (!value.learnerResponses.every((record) => record.studentRef === value.studentRef && responseIsCurrent(record))) return false
  if (!value.assessmentAttempts.every((attempt) => attempt.studentRef === value.studentRef && assessmentAttemptIsCurrent(attempt))) return false
  return true
}

export function parseHouseholdSnapshot(value: unknown, expectedHouseholdRef: string): HouseholdSnapshotR2 | null {
  if (!value || typeof value !== 'object') return null
  const held = value as Partial<HouseholdSnapshotR2>
  if (held.schemaVersion !== R2_SCHEMA_VERSION || held.householdRef !== expectedHouseholdRef || !Array.isArray(held.learners)) return null
  if (!Number.isSafeInteger(held.cursor) || Number(held.cursor) < 0) return null
  if (!held.learners.every(validateLearnerDocument)) return null
  if (new Set(held.learners.map((learner) => learner.studentRef)).size !== held.learners.length) return null
  return clone(held as HouseholdSnapshotR2)
}

export function fullCoreState(learners: readonly LearnerSyncDocumentR2[], now: string): FamilyPilotStateV1 {
  return Object.freeze({
    schemaVersion: 1,
    updatedAt: now,
    activeStudentRef: learners[0]?.studentRef ?? null,
    students: Object.freeze(learners.map((learner) => clone(learner.coreStudent))),
  })
}

export function fullAppState(learners: readonly LearnerSyncDocumentR2[], householdRef: string, now: string): FinalFamilyPilotAppStateV1 {
  return Object.freeze({
    schemaVersion: 1,
    householdRef,
    updatedAt: now,
    setup: Object.freeze({ students: Object.freeze(learners.map((learner) => clone(learner.setupProfile))), completedAt: now }),
    activeStudentRef: learners[0]?.studentRef ?? null,
    sessions: Object.freeze(learners.flatMap((learner) => clone(learner.app.sessions))),
    sourceAttachments: Object.freeze(learners.flatMap((learner) => clone(learner.app.sourceAttachments))),
    assessmentAssignments: Object.freeze(learners.flatMap((learner) => clone(learner.app.assessmentAssignments))),
    attestations: Object.freeze(learners.flatMap((learner) => clone(learner.app.attestations))),
    safety: Object.freeze({ schemaVersion: 1, holds: Object.freeze(learners.flatMap((learner) => clone(learner.app.safetyHolds))) }),
    // Device-only. The server snapshot can never reconstruct or distribute it.
    pinDigests: Object.freeze({}),
  })
}

export function hasOpenSafetyHold(document: LearnerSyncDocumentR2): boolean {
  return document.app.safetyHolds.some((hold) => hold.status !== 'cleared')
}
