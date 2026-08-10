import { describe, expect, it } from 'vitest'
import {
  ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
  createAssignedAssessmentAttempt,
  createRetakeAssessmentAttempt,
  isAssessmentBrowserRequestDTO,
  isAssessmentOperationalOutcomeDTO,
  isProtectedAssessmentResponsePayload,
  toAssessmentOperationalOutcome,
  transitionAssessmentAttempt,
  type AssessmentAttemptRecord,
  type AssessmentAuthorityContext,
  type AssessmentCommand,
  type AssessmentReleaseBinding,
  type AssessmentTransitionResult,
  type ProtectedAssessmentResponsePayload,
} from './index'

const BINDING: AssessmentReleaseBinding = {
  curriculumReleaseRef: 'curriculum:2026-fall',
  assessmentRef: 'hs-grammar',
  assessmentVersion: '3',
}
const ASSIGNED_AT = '2026-08-09T12:00:00.000Z'

function assigned(): AssessmentAttemptRecord {
  return createAssignedAssessmentAttempt({
    attemptRef: 'attempt-1',
    assignmentRef: 'assignment-1',
    learnerRef: 'learner-1',
    householdRef: 'household-1',
    releaseBinding: BINDING,
    assignedAt: ASSIGNED_AT,
  })
}

function authority(
  attempt: AssessmentAttemptRecord,
  acceptedAt: string,
  commandDigest: string,
): AssessmentAuthorityContext {
  return {
    learnerRef: attempt.learnerRef,
    householdRef: attempt.householdRef,
    assignmentRef: attempt.assignmentRef,
    attemptRef: attempt.attemptRef,
    releaseBinding: attempt.releaseBinding,
    acceptedAt,
    commandDigest,
  }
}

function apply(
  attempt: AssessmentAttemptRecord,
  command: AssessmentCommand,
  acceptedAt: string,
  digest = `digest:${command.commandId}`,
): Extract<AssessmentTransitionResult, { status: 'applied' }> {
  const result = transitionAssessmentAttempt(attempt, command, authority(attempt, acceptedAt, digest))
  expect(result.status).toBe('applied')
  return result as Extract<AssessmentTransitionResult, { status: 'applied' }>
}

function started(): AssessmentAttemptRecord {
  return apply(assigned(), { action: 'start', commandId: 'command-start', expectedRevision: 0 }, '2026-08-09T12:01:00.000Z').attempt
}

const RESPONSE: ProtectedAssessmentResponsePayload = {
  schemaVersion: ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
  attemptRef: 'attempt-1',
  responses: [
    { itemRef: 'g1', value: 'private answer', skipped: false, activeMs: 30_000 },
    { itemRef: 'essay-1', value: 'A deeply private essay body', skipped: false, activeMs: 600_000 },
  ],
}

function submitted(): AssessmentAttemptRecord {
  return apply(started(), {
    action: 'submit',
    commandId: 'command-submit',
    expectedRevision: 1,
    response: RESPONSE,
  }, '2026-08-09T12:20:00.000Z').attempt
}

const GRADED_RESULT = {
  outcomeCategory: 'graded' as const,
  score: {
    earned: 18,
    possible: 20,
    percent: 90,
    approvedBand: 'exceeds-expectations' as const,
  },
}

describe('authoritative assessment attempt lifecycle', () => {
  it('transitions assignment → start with a server-accepted timestamp and revision', () => {
    const initial = assigned()
    const result = apply(initial, {
      action: 'start',
      commandId: 'command-start',
      expectedRevision: 0,
    }, '2026-08-09T12:01:00.000Z')
    expect(result.attempt).toMatchObject({ status: 'started', revision: 1, startedAt: '2026-08-09T12:01:00.000Z' })
    expect(initial).toMatchObject({ status: 'assigned', revision: 0, startedAt: null })
  })

  it('transitions start → submit while returning responses only on the protected channel', () => {
    const result = apply(started(), {
      action: 'submit',
      commandId: 'command-submit',
      expectedRevision: 1,
      response: RESPONSE,
    }, '2026-08-09T12:20:00.000Z')
    expect(result.attempt).toMatchObject({ status: 'submitted', revision: 2 })
    expect(result.protectedResponse).toEqual(RESPONSE)
    expect(JSON.stringify(result.attempt)).not.toContain('private answer')
  })

  it('completes submitted auto-scored work with an authoritative result', () => {
    const result = apply(submitted(), {
      action: 'route-scoring',
      commandId: 'command-auto-score',
      expectedRevision: 2,
      decision: { kind: 'automatic', result: GRADED_RESULT },
    }, '2026-08-09T12:20:01.000Z')
    expect(result.attempt).toMatchObject({
      status: 'completed',
      revision: 3,
      completedAt: '2026-08-09T12:20:01.000Z',
      result: GRADED_RESULT,
    })
  })

  it('routes human-scored work to scoring_pending and completes only after a human result', () => {
    const pending = apply(submitted(), {
      action: 'route-scoring',
      commandId: 'command-human-route',
      expectedRevision: 2,
      decision: { kind: 'human-required' },
    }, '2026-08-09T12:21:00.000Z').attempt
    expect(pending).toMatchObject({ status: 'scoring_pending', revision: 3, completedAt: null, result: null })

    const completed = apply(pending, {
      action: 'complete-human-score',
      commandId: 'command-human-score',
      expectedRevision: 3,
      result: GRADED_RESULT,
    }, '2026-08-10T14:00:00.000Z').attempt
    expect(completed).toMatchObject({ status: 'completed', revision: 4, result: GRADED_RESULT })
  })
})

describe('idempotency, conflicts, and invalid transitions', () => {
  it('replays the same accepted command without changing revision', () => {
    const command: AssessmentCommand = { action: 'start', commandId: 'same-command', expectedRevision: 0 }
    const first = apply(assigned(), command, '2026-08-09T12:01:00.000Z', 'trusted-digest')
    const replay = transitionAssessmentAttempt(
      first.attempt,
      command,
      authority(first.attempt, '2026-08-09T12:05:00.000Z', 'trusted-digest'),
    )
    expect(replay).toMatchObject({ status: 'replayed', attempt: { revision: 1, status: 'started' } })
  })

  it('rejects command-id reuse with a different trusted digest', () => {
    const command: AssessmentCommand = { action: 'start', commandId: 'same-command', expectedRevision: 0 }
    const first = apply(assigned(), command, '2026-08-09T12:01:00.000Z', 'digest-one')
    const collision = transitionAssessmentAttempt(
      first.attempt,
      command,
      authority(first.attempt, '2026-08-09T12:02:00.000Z', 'digest-two'),
    )
    expect(collision).toMatchObject({
      status: 'conflict',
      conflict: { kind: 'idempotency-collision', commandId: 'same-command' },
    })
  })

  it('returns an optimistic revision conflict without mutating state', () => {
    const attempt = started()
    const result = transitionAssessmentAttempt(
      attempt,
      { action: 'submit', commandId: 'stale-submit', expectedRevision: 0, response: RESPONSE },
      authority(attempt, '2026-08-09T12:20:00.000Z', 'digest:stale'),
    )
    expect(result).toMatchObject({
      status: 'conflict',
      attempt: { revision: 1, status: 'started' },
      conflict: { kind: 'revision-conflict', expectedRevision: 0, currentRevision: 1 },
    })
  })

  it('does not silently accept an invalid lifecycle transition', () => {
    const result = transitionAssessmentAttempt(
      assigned(),
      { action: 'complete-human-score', commandId: 'too-soon', expectedRevision: 0, result: GRADED_RESULT },
      authority(assigned(), '2026-08-09T12:03:00.000Z', 'digest:too-soon'),
    )
    expect(result).toMatchObject({
      status: 'invalid-transition',
      action: 'complete-human-score',
      fromStatus: 'assigned',
    })
  })

  it('rejects trusted-context identity or release substitution', () => {
    const attempt = assigned()
    const context = { ...authority(attempt, '2026-08-09T12:01:00.000Z', 'digest'), learnerRef: 'browser-claimed-learner' }
    const result = transitionAssessmentAttempt(
      attempt,
      { action: 'start', commandId: 'start', expectedRevision: 0 },
      context,
    )
    expect(result).toMatchObject({ status: 'conflict', conflict: { kind: 'authority-conflict', field: 'learnerRef' } })
  })
})

describe('retake lineage and immutable release binding', () => {
  function completed(): AssessmentAttemptRecord {
    return apply(submitted(), {
      action: 'route-scoring',
      commandId: 'command-auto-score',
      expectedRevision: 2,
      decision: { kind: 'automatic', result: GRADED_RESULT },
    }, '2026-08-09T12:20:01.000Z').attempt
  }

  it('creates a separate retake linked to its completed predecessor', () => {
    const prior = completed()
    const result = createRetakeAssessmentAttempt(prior, {
      attemptRef: 'attempt-2',
      assignmentRef: 'assignment-2',
      assignedAt: '2026-08-11T12:00:00.000Z',
    })
    expect(result).toMatchObject({
      status: 'created',
      attempt: {
        attemptRef: 'attempt-2',
        status: 'assigned',
        revision: 0,
        lineage: { rootAttemptRef: 'attempt-1', previousAttemptRef: 'attempt-1', attemptOrdinal: 2 },
      },
    })
    expect(prior).toMatchObject({ attemptRef: 'attempt-1', status: 'completed' })
  })

  it('preserves release and assessment version pins across completion and retakes', () => {
    const prior = completed()
    const result = createRetakeAssessmentAttempt(prior, {
      attemptRef: 'attempt-2',
      assignmentRef: 'assignment-2',
      assignedAt: '2026-08-11T12:00:00.000Z',
    })
    expect(result.status).toBe('created')
    if (result.status === 'created') {
      expect(result.attempt.releaseBinding).toEqual(BINDING)
      expect(result.attempt.releaseBinding).toEqual(prior.releaseBinding)
    }
  })

  it('refuses retake lineage from an unfinished attempt', () => {
    expect(createRetakeAssessmentAttempt(started(), {
      attemptRef: 'attempt-2',
      assignmentRef: 'assignment-2',
      assignedAt: '2026-08-11T12:00:00.000Z',
    })).toEqual({ status: 'invalid-retake', reason: 'prior-attempt-not-completed' })
  })
})

describe('privacy-safe operational outcome projection', () => {
  it('emits only approved operational facts and a safely derived duration class', () => {
    const complete = apply(submitted(), {
      action: 'route-scoring',
      commandId: 'command-auto-score',
      expectedRevision: 2,
      decision: { kind: 'automatic', result: GRADED_RESULT },
    }, '2026-08-09T12:20:01.000Z').attempt
    const dto = toAssessmentOperationalOutcome(complete)
    expect(dto).toEqual({
      schemaVersion: 1,
      attemptRef: 'attempt-1',
      status: 'completed',
      retake: false,
      durationClass: '15-to-44-minutes',
      scoreBand: 'exceeds-expectations',
      outcomeCategory: 'graded',
    })
    expect(isAssessmentOperationalOutcomeDTO(dto)).toBe(true)
  })

  it('cannot serialize answers or essay content through the operational projection', () => {
    const dto = toAssessmentOperationalOutcome(submitted())
    const serialized = JSON.stringify(dto)
    expect(serialized).not.toContain('private answer')
    expect(serialized).not.toContain('deeply private essay')
    expect(serialized).not.toContain('responses')
    expect(serialized).not.toContain('value')
    expect(isAssessmentOperationalOutcomeDTO({ ...dto, answers: RESPONSE.responses })).toBe(false)
    expect(isAssessmentOperationalOutcomeDTO({ ...dto, essay: 'A deeply private essay body' })).toBe(false)
  })
})

describe('browser DTO validation and trust boundary', () => {
  it('accepts exact start and submit DTOs', () => {
    expect(isAssessmentBrowserRequestDTO({
      schemaVersion: 1,
      action: 'start',
      requestId: 'request-start',
      idempotencyKey: 'key-start',
      assignmentRef: 'assignment-1',
      expectedRevision: 0,
    })).toBe(true)
    expect(isAssessmentBrowserRequestDTO({
      schemaVersion: 1,
      action: 'submit',
      requestId: 'request-submit',
      idempotencyKey: 'key-submit',
      attemptRef: 'attempt-1',
      expectedRevision: 1,
      response: RESPONSE,
    })).toBe(true)
    expect(isProtectedAssessmentResponsePayload(RESPONSE, 'attempt-1')).toBe(true)
  })

  it.each([
    ['learner identity', { learnerRef: 'browser-claim' }],
    ['role', { role: 'admin' }],
    ['completion timestamp', { completedAt: '1999-01-01T00:00:00.000Z' }],
    ['score', { score: 100 }],
    ['accepted revision', { revision: 999 }],
    ['release version', { assessmentVersion: 'browser-version' }],
  ])('rejects browser-supplied authoritative %s', (_label, injected) => {
    expect(isAssessmentBrowserRequestDTO({
      schemaVersion: 1,
      action: 'start',
      requestId: 'request-start',
      idempotencyKey: 'key-start',
      assignmentRef: 'assignment-1',
      expectedRevision: 0,
      ...injected,
    })).toBe(false)
  })

  it('rejects malformed, mismatched, or duplicate protected response items', () => {
    expect(isProtectedAssessmentResponsePayload({ ...RESPONSE, attemptRef: 'other' }, 'attempt-1')).toBe(false)
    expect(isProtectedAssessmentResponsePayload({
      ...RESPONSE,
      responses: [RESPONSE.responses[0], RESPONSE.responses[0]],
    })).toBe(false)
    expect(isAssessmentBrowserRequestDTO({ action: 'submit' })).toBe(false)
  })
})
