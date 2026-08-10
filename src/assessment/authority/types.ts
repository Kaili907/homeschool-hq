/**
 * Server-authoritative assessment attempt contracts.
 *
 * These types deliberately do not extend the browser Profile assessment state.
 * They describe the future durable server record that will eventually replace
 * browser mutation as the source of truth.
 */

export const ASSESSMENT_AUTHORITY_SCHEMA_VERSION = 1 as const

export type AssessmentAssignmentRef = string
export type AssessmentAttemptRef = string
export type AssessmentAttemptRevision = number
export type AssessmentRequestId = string
export type AssessmentCommandId = string
export type AssessmentIdempotencyKey = string
export type AssessmentCommandDigest = string
export type AssessmentLearnerRef = string
export type AssessmentHouseholdRef = string

export interface AssessmentReleaseBinding {
  readonly curriculumReleaseRef: string
  readonly assessmentRef: string
  readonly assessmentVersion: string
}

export interface AssessmentAttemptLineage {
  readonly rootAttemptRef: AssessmentAttemptRef
  readonly previousAttemptRef: AssessmentAttemptRef | null
  readonly attemptOrdinal: number
}

export type AssessmentAttemptStatus =
  | 'assigned'
  | 'started'
  | 'submitted'
  | 'scoring_pending'
  | 'completed'

export type AssessmentScoreBand =
  | 'below-expectations'
  | 'approaching-expectations'
  | 'meets-expectations'
  | 'exceeds-expectations'

export type AssessmentOutcomeCategory =
  | 'graded'
  | 'ungraded'
  | 'needs-follow-up'
  | 'incomplete'

export interface AssessmentAuthoritativeScore {
  readonly earned: number
  readonly possible: number
  readonly percent: number
  /** Only a server-approved band may enter the operational projection. */
  readonly approvedBand: AssessmentScoreBand | null
}

export interface AssessmentAuthoritativeResult {
  readonly outcomeCategory: AssessmentOutcomeCategory
  readonly score: AssessmentAuthoritativeScore | null
}

export interface AcceptedAssessmentCommand {
  readonly commandId: AssessmentCommandId
  /** A trusted server derives this digest from the complete command payload. */
  readonly commandDigest: AssessmentCommandDigest
  readonly action: AssessmentCommandAction
  readonly acceptedRevision: AssessmentAttemptRevision
  readonly acceptedAt: string
}

export interface AssessmentAttemptRecord {
  readonly schemaVersion: typeof ASSESSMENT_AUTHORITY_SCHEMA_VERSION
  readonly attemptRef: AssessmentAttemptRef
  readonly assignmentRef: AssessmentAssignmentRef
  readonly learnerRef: AssessmentLearnerRef
  readonly householdRef: AssessmentHouseholdRef
  readonly releaseBinding: AssessmentReleaseBinding
  readonly lineage: AssessmentAttemptLineage
  readonly status: AssessmentAttemptStatus
  readonly revision: AssessmentAttemptRevision
  readonly assignedAt: string
  readonly startedAt: string | null
  readonly submittedAt: string | null
  readonly completedAt: string | null
  readonly result: AssessmentAuthoritativeResult | null
  readonly acceptedCommands: readonly AcceptedAssessmentCommand[]
}

/** PROTECTED ASSESSMENT RESPONSE PAYLOAD — never an analytics/telemetry DTO. */
export interface ProtectedAssessmentResponseEntry {
  readonly itemRef: string
  readonly value: string
  readonly skipped: boolean
  readonly activeMs: number
}

/** PROTECTED ASSESSMENT RESPONSE PAYLOAD — store behind restricted access. */
export interface ProtectedAssessmentResponsePayload {
  readonly schemaVersion: typeof ASSESSMENT_AUTHORITY_SCHEMA_VERSION
  readonly attemptRef: AssessmentAttemptRef
  readonly responses: readonly ProtectedAssessmentResponseEntry[]
}

interface AssessmentCommandBase {
  readonly commandId: AssessmentCommandId
  /** This is a compare-and-swap assertion, never the accepted server revision. */
  readonly expectedRevision: AssessmentAttemptRevision
}

export interface StartAssessmentAttemptCommand extends AssessmentCommandBase {
  readonly action: 'start'
}

export interface SubmitAssessmentAttemptCommand extends AssessmentCommandBase {
  readonly action: 'submit'
  readonly response: ProtectedAssessmentResponsePayload
}

export interface RouteAssessmentScoringCommand extends AssessmentCommandBase {
  readonly action: 'route-scoring'
  readonly decision:
    | { readonly kind: 'automatic'; readonly result: AssessmentAuthoritativeResult }
    | { readonly kind: 'human-required' }
}

export interface CompleteHumanAssessmentScoreCommand extends AssessmentCommandBase {
  readonly action: 'complete-human-score'
  readonly result: AssessmentAuthoritativeResult
}

export type AssessmentCommand =
  | StartAssessmentAttemptCommand
  | SubmitAssessmentAttemptCommand
  | RouteAssessmentScoringCommand
  | CompleteHumanAssessmentScoreCommand

export type AssessmentCommandAction = AssessmentCommand['action']

/**
 * Populated only after authentication, household authorization, assignment
 * lookup, release lookup, and accepted-time selection on the trusted server.
 * A transport adapter must never copy these values from browser JSON.
 */
export interface AssessmentAuthorityContext {
  readonly learnerRef: AssessmentLearnerRef
  readonly householdRef: AssessmentHouseholdRef
  readonly assignmentRef: AssessmentAssignmentRef
  readonly attemptRef: AssessmentAttemptRef
  readonly releaseBinding: AssessmentReleaseBinding
  readonly acceptedAt: string
  readonly commandDigest: AssessmentCommandDigest
}

export const ASSESSMENT_SERVER_AUTHORITATIVE_FIELDS = Object.freeze([
  'learner identity',
  'household authorization',
  'assignment identity',
  'attempt reference',
  'accepted timestamps',
  'accepted revision',
  'curriculum release',
  'assessment identity and version',
  'completion status',
  'score and result',
] as const)

export const ASSESSMENT_BROWSER_REQUEST_FIELDS = Object.freeze([
  'requested action',
  'permitted assessment or assignment reference',
  'assessment response input',
  'idempotency key',
  'expected revision assertion',
] as const)

export interface AssessmentRevisionConflict {
  readonly kind: 'revision-conflict'
  readonly expectedRevision: AssessmentAttemptRevision
  readonly currentRevision: AssessmentAttemptRevision
}

export interface AssessmentIdempotencyCollision {
  readonly kind: 'idempotency-collision'
  readonly commandId: AssessmentCommandId
}

export interface AssessmentAuthorityConflict {
  readonly kind: 'authority-conflict'
  readonly field:
    | 'learnerRef'
    | 'householdRef'
    | 'assignmentRef'
    | 'attemptRef'
    | 'releaseBinding'
}

export type AssessmentTransitionConflict =
  | AssessmentRevisionConflict
  | AssessmentIdempotencyCollision
  | AssessmentAuthorityConflict

export interface AppliedAssessmentTransition {
  readonly status: 'applied'
  readonly attempt: AssessmentAttemptRecord
  readonly receipt: AcceptedAssessmentCommand
  /** Present only for submit; it must go to protected persistence. */
  readonly protectedResponse: ProtectedAssessmentResponsePayload | null
}

export interface ReplayedAssessmentTransition {
  readonly status: 'replayed'
  readonly attempt: AssessmentAttemptRecord
  readonly receipt: AcceptedAssessmentCommand
  readonly protectedResponse: null
}

export interface ConflictedAssessmentTransition {
  readonly status: 'conflict'
  readonly attempt: AssessmentAttemptRecord
  readonly conflict: AssessmentTransitionConflict
}

export interface InvalidAssessmentTransition {
  readonly status: 'invalid-transition'
  readonly attempt: AssessmentAttemptRecord
  readonly action: AssessmentCommandAction
  readonly fromStatus: AssessmentAttemptStatus
  readonly reason: string
}

export type AssessmentTransitionResult =
  | AppliedAssessmentTransition
  | ReplayedAssessmentTransition
  | ConflictedAssessmentTransition
  | InvalidAssessmentTransition

export interface StartAssessmentAttemptRequestDTO {
  readonly schemaVersion: typeof ASSESSMENT_AUTHORITY_SCHEMA_VERSION
  readonly action: 'start'
  readonly requestId: AssessmentRequestId
  readonly idempotencyKey: AssessmentIdempotencyKey
  readonly assignmentRef: AssessmentAssignmentRef
  readonly expectedRevision: AssessmentAttemptRevision
}

export interface SubmitAssessmentAttemptRequestDTO {
  readonly schemaVersion: typeof ASSESSMENT_AUTHORITY_SCHEMA_VERSION
  readonly action: 'submit'
  readonly requestId: AssessmentRequestId
  readonly idempotencyKey: AssessmentIdempotencyKey
  readonly attemptRef: AssessmentAttemptRef
  readonly expectedRevision: AssessmentAttemptRevision
  readonly response: ProtectedAssessmentResponsePayload
}

export type AssessmentBrowserRequestDTO =
  | StartAssessmentAttemptRequestDTO
  | SubmitAssessmentAttemptRequestDTO
