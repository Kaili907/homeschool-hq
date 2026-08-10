import {
  ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
  type AcceptedAssessmentCommand,
  type AssessmentAttemptRecord,
  type AssessmentAuthoritativeResult,
  type AssessmentAuthorityContext,
  type AssessmentCommand,
  type AssessmentReleaseBinding,
  type AssessmentTransitionResult,
  type ProtectedAssessmentResponsePayload,
} from './types'

export interface AssignedAssessmentAttemptInput {
  readonly attemptRef: string
  readonly assignmentRef: string
  readonly learnerRef: string
  readonly householdRef: string
  readonly releaseBinding: AssessmentReleaseBinding
  readonly assignedAt: string
}

export function createAssignedAssessmentAttempt(
  input: AssignedAssessmentAttemptInput,
): AssessmentAttemptRecord {
  return Object.freeze({
    schemaVersion: ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
    attemptRef: input.attemptRef,
    assignmentRef: input.assignmentRef,
    learnerRef: input.learnerRef,
    householdRef: input.householdRef,
    releaseBinding: freezeBinding(input.releaseBinding),
    lineage: Object.freeze({
      rootAttemptRef: input.attemptRef,
      previousAttemptRef: null,
      attemptOrdinal: 1,
    }),
    status: 'assigned',
    revision: 0,
    assignedAt: input.assignedAt,
    startedAt: null,
    submittedAt: null,
    completedAt: null,
    result: null,
    acceptedCommands: Object.freeze([]),
  })
}

export type CreateRetakeResult =
  | { readonly status: 'created'; readonly attempt: AssessmentAttemptRecord }
  | {
      readonly status: 'invalid-retake'
      readonly reason: 'prior-attempt-not-completed' | 'attempt-ref-reused'
    }

/**
 * Retakes are new attempts. Identity and release binding are derived from the
 * completed prior attempt; callers cannot substitute a newer active release.
 */
export function createRetakeAssessmentAttempt(
  prior: AssessmentAttemptRecord,
  input: {
    readonly attemptRef: string
    readonly assignmentRef: string
    readonly assignedAt: string
  },
): CreateRetakeResult {
  if (prior.status !== 'completed') {
    return Object.freeze({ status: 'invalid-retake', reason: 'prior-attempt-not-completed' })
  }
  if (input.attemptRef === prior.attemptRef) {
    return Object.freeze({ status: 'invalid-retake', reason: 'attempt-ref-reused' })
  }
  return Object.freeze({
    status: 'created',
    attempt: Object.freeze({
      ...createAssignedAssessmentAttempt({
        attemptRef: input.attemptRef,
        assignmentRef: input.assignmentRef,
        learnerRef: prior.learnerRef,
        householdRef: prior.householdRef,
        releaseBinding: prior.releaseBinding,
        assignedAt: input.assignedAt,
      }),
      lineage: Object.freeze({
        rootAttemptRef: prior.lineage.rootAttemptRef,
        previousAttemptRef: prior.attemptRef,
        attemptOrdinal: prior.lineage.attemptOrdinal + 1,
      }),
    }),
  })
}

export function transitionAssessmentAttempt(
  attempt: AssessmentAttemptRecord,
  command: AssessmentCommand,
  authority: AssessmentAuthorityContext,
): AssessmentTransitionResult {
  const priorReceipt = attempt.acceptedCommands.find(
    (receipt) => receipt.commandId === command.commandId,
  )
  if (priorReceipt) {
    if (
      priorReceipt.action === command.action &&
      priorReceipt.commandDigest === authority.commandDigest
    ) {
      return Object.freeze({
        status: 'replayed',
        attempt,
        receipt: priorReceipt,
        protectedResponse: null,
      })
    }
    return conflict(attempt, {
      kind: 'idempotency-collision',
      commandId: command.commandId,
    })
  }

  const authorityConflict = findAuthorityConflict(attempt, authority)
  if (authorityConflict) return conflict(attempt, authorityConflict)

  if (command.expectedRevision !== attempt.revision) {
    return conflict(attempt, {
      kind: 'revision-conflict',
      expectedRevision: command.expectedRevision,
      currentRevision: attempt.revision,
    })
  }

  switch (command.action) {
    case 'start':
      if (attempt.status !== 'assigned') return invalid(attempt, command, 'only an assigned attempt can start')
      return apply(attempt, command, authority, {
        status: 'started',
        startedAt: authority.acceptedAt,
      })

    case 'submit':
      if (attempt.status !== 'started') return invalid(attempt, command, 'only a started attempt can submit')
      if (!validProtectedResponse(command.response, attempt.attemptRef)) {
        return invalid(attempt, command, 'protected response payload is invalid or belongs to another attempt')
      }
      return apply(attempt, command, authority, {
        status: 'submitted',
        submittedAt: authority.acceptedAt,
      }, command.response)

    case 'route-scoring':
      if (attempt.status !== 'submitted') {
        return invalid(attempt, command, 'scoring can only be routed after submission')
      }
      if (command.decision.kind === 'human-required') {
        return apply(attempt, command, authority, { status: 'scoring_pending' })
      }
      if (!validResult(command.decision.result)) {
        return invalid(attempt, command, 'automatic score result is invalid')
      }
      return apply(attempt, command, authority, {
        status: 'completed',
        completedAt: authority.acceptedAt,
        result: freezeResult(command.decision.result),
      })

    case 'complete-human-score':
      if (attempt.status !== 'scoring_pending') {
        return invalid(attempt, command, 'human scoring can only complete a scoring-pending attempt')
      }
      if (!validResult(command.result)) {
        return invalid(attempt, command, 'human score result is invalid')
      }
      return apply(attempt, command, authority, {
        status: 'completed',
        completedAt: authority.acceptedAt,
        result: freezeResult(command.result),
      })
  }
}

function apply(
  attempt: AssessmentAttemptRecord,
  command: AssessmentCommand,
  authority: AssessmentAuthorityContext,
  patch: Partial<AssessmentAttemptRecord>,
  protectedResponse: ProtectedAssessmentResponsePayload | null = null,
): AssessmentTransitionResult {
  const nextRevision = attempt.revision + 1
  const receipt: AcceptedAssessmentCommand = Object.freeze({
    commandId: command.commandId,
    commandDigest: authority.commandDigest,
    action: command.action,
    acceptedRevision: nextRevision,
    acceptedAt: authority.acceptedAt,
  })
  const next = Object.freeze({
    ...attempt,
    ...patch,
    revision: nextRevision,
    acceptedCommands: Object.freeze([...attempt.acceptedCommands, receipt]),
  })
  return Object.freeze({
    status: 'applied',
    attempt: next,
    receipt,
    protectedResponse,
  })
}

function conflict(
  attempt: AssessmentAttemptRecord,
  value: Extract<AssessmentTransitionResult, { status: 'conflict' }>['conflict'],
): AssessmentTransitionResult {
  return Object.freeze({ status: 'conflict', attempt, conflict: Object.freeze(value) })
}

function invalid(
  attempt: AssessmentAttemptRecord,
  command: AssessmentCommand,
  reason: string,
): AssessmentTransitionResult {
  return Object.freeze({
    status: 'invalid-transition',
    attempt,
    action: command.action,
    fromStatus: attempt.status,
    reason,
  })
}

function findAuthorityConflict(
  attempt: AssessmentAttemptRecord,
  authority: AssessmentAuthorityContext,
): Extract<AssessmentTransitionResult, { status: 'conflict' }>['conflict'] | null {
  if (authority.learnerRef !== attempt.learnerRef) return { kind: 'authority-conflict', field: 'learnerRef' }
  if (authority.householdRef !== attempt.householdRef) return { kind: 'authority-conflict', field: 'householdRef' }
  if (authority.assignmentRef !== attempt.assignmentRef) return { kind: 'authority-conflict', field: 'assignmentRef' }
  if (authority.attemptRef !== attempt.attemptRef) return { kind: 'authority-conflict', field: 'attemptRef' }
  if (!sameBinding(authority.releaseBinding, attempt.releaseBinding)) {
    return { kind: 'authority-conflict', field: 'releaseBinding' }
  }
  return null
}

function sameBinding(a: AssessmentReleaseBinding, b: AssessmentReleaseBinding): boolean {
  return a.curriculumReleaseRef === b.curriculumReleaseRef &&
    a.assessmentRef === b.assessmentRef &&
    a.assessmentVersion === b.assessmentVersion
}

function freezeBinding(binding: AssessmentReleaseBinding): AssessmentReleaseBinding {
  return Object.freeze({ ...binding })
}

function validProtectedResponse(value: ProtectedAssessmentResponsePayload, attemptRef: string): boolean {
  if (value.schemaVersion !== ASSESSMENT_AUTHORITY_SCHEMA_VERSION || value.attemptRef !== attemptRef) return false
  const seen = new Set<string>()
  for (const response of value.responses) {
    if (
      typeof response.itemRef !== 'string' || response.itemRef.length === 0 || response.itemRef.length > 200 ||
      typeof response.value !== 'string' || response.value.length > 100_000 ||
      typeof response.skipped !== 'boolean' ||
      !Number.isSafeInteger(response.activeMs) || response.activeMs < 0 ||
      seen.has(response.itemRef)
    ) return false
    seen.add(response.itemRef)
  }
  return value.responses.length <= 500
}

function validResult(result: AssessmentAuthoritativeResult): boolean {
  if (!['graded', 'ungraded', 'needs-follow-up', 'incomplete'].includes(result.outcomeCategory)) return false
  if (result.score === null) return true
  const { earned, possible, percent, approvedBand } = result.score
  return Number.isFinite(earned) && earned >= 0 &&
    Number.isFinite(possible) && possible > 0 && earned <= possible &&
    Number.isFinite(percent) && percent >= 0 && percent <= 100 &&
    (approvedBand === null || [
      'below-expectations',
      'approaching-expectations',
      'meets-expectations',
      'exceeds-expectations',
    ].includes(approvedBand))
}

function freezeResult(result: AssessmentAuthoritativeResult): AssessmentAuthoritativeResult {
  return Object.freeze({
    outcomeCategory: result.outcomeCategory,
    score: result.score === null ? null : Object.freeze({ ...result.score }),
  })
}
