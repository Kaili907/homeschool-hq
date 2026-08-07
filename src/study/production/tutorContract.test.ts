import { describe, expect, it } from 'vitest'
import {
  createProductionTutorSafeText,
  createProductionTutorSessionCorrelationRef,
  type ProductionTutorKeyDifference,
  type ProductionTutorAssertNoLeak,
  type ProductionTutorAuthorityLeak,
  type ProductionTutorCheckpoint,
  type ProductionTutorForbiddenAuthorityKey,
  type ProductionTutorPresentation,
  type ProductionTutorPrivacyLeak,
  type ProductionTutorRuntime,
  type ProductionTutorSafeText,
  type ProductionTutorSanitizationAttestation,
  type ProductionTutorSessionCorrelationRef,
  type ProductionTutorSessionEstablished,
  type ProductionTutorSessionInput,
  type ProductionTutorTurnInput,
  type ProductionTutorTurnResult,
} from './tutorContract'

const SANITIZED: ProductionTutorSanitizationAttestation = {
  sanitizedBy: 'study-bridge-learner-safe-projection',
  transcriptIncluded: false,
  rawLearnerTextIncluded: false,
}

const DIGEST = 'a3f19c7e4b28d05a6f1e9c3b7d240a85e6c1b9f3072d4a8e5c0b1f6a9d3e7c24'

const correlationRef: ProductionTutorSessionCorrelationRef =
  createProductionTutorSessionCorrelationRef(DIGEST, {
    derivation: 'server-verified-pseudonymous-digest',
    reversibleToLearnerIdentity: false,
    containsLearnerIdentifier: false,
  })

const visibleText: ProductionTutorSafeText = createProductionTutorSafeText(
  'Your work was recorded as one piece of learning evidence. It does not label you.',
  SANITIZED,
)

const presentation: ProductionTutorPresentation = {
  messageCode: 'evidence-recorded',
  visibleText,
  mayContinue: true,
  adultReviewPending: false,
  captionsAlwaysVisible: true,
  lessonMayContinueWithoutMedia: true,
  transcriptIncluded: false,
}

const checkpoint: ProductionTutorCheckpoint = {
  checkpointRef: 'tutor-checkpoint:1',
  revision: 1,
  capturedAt: '2026-08-07T15:04:05.000Z',
  sessionCorrelationRef: correlationRef,
  lessonRef: 'lesson-fractions-01',
  segmentRef: 'segment-01',
  instructionalCursor: {
    phase: 'guided-practice',
    cycleNumber: 1,
    itemIndex: 0,
    teachingTurnIndex: 2,
  },
  protectedTutorStateRef: 'tutor-state:opaque-sidecar-handle',
  lastAcceptedEventRef: null,
  rawAnswerIncluded: false,
  transcriptIncluded: false,
}

const sessionInput: ProductionTutorSessionInput = {
  sessionCorrelationRef: correlationRef,
  lessonRef: 'lesson-fractions-01',
  segmentRef: 'segment-01',
  subjectRef: 'math',
  gradeBand: 'elementary-3-5',
  learnerLocalDate: '2026-08-07',
  householdTimeZone: 'America/Detroit',
}

const turnInput: ProductionTutorTurnInput = {
  sessionCorrelationRef: correlationRef,
  turnRef: 'turn-000001',
  occurredAt: '2026-08-07T15:04:05.000Z',
  lessonRef: 'lesson-fractions-01',
  segmentRef: 'segment-01',
  skillRef: 'skill-equivalent-fractions',
  transientLearnerText: 'ready',
}

const acceptedResult: ProductionTutorTurnResult = {
  status: 'accepted',
  eventRef: 'event-000001',
  directive: 'continue-plan',
  reasonCode: 'tutor-core-cycle-in-progress',
  presentation,
  checkpoint,
}

// ---------------------------------------------------------------------------
// Phases 7, 9 and 10 — compile-time negative proofs.
//
// These aliases have no runtime existence. They fail `npm run typecheck` if a
// future edit adds an authority or privacy field anywhere in the contract.
// ---------------------------------------------------------------------------

type _NoAuthorityInTurnResult = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorTurnResult>
>
type _NoAuthorityInTurnInput = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorTurnInput>
>
type _NoAuthorityInSessionInput = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorSessionInput>
>
type _NoAuthorityInCheckpoint = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorCheckpoint>
>
type _NoAuthorityInPresentation = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorPresentation>
>
type _NoAuthorityInEstablished = ProductionTutorAssertNoLeak<
  ProductionTutorAuthorityLeak<ProductionTutorSessionEstablished>
>

type _NoPrivacyInTurnResult = ProductionTutorAssertNoLeak<
  ProductionTutorPrivacyLeak<ProductionTutorTurnResult>
>
type _NoPrivacyInTurnInput = ProductionTutorAssertNoLeak<
  ProductionTutorPrivacyLeak<ProductionTutorTurnInput>
>
type _NoPrivacyInSessionInput = ProductionTutorAssertNoLeak<
  ProductionTutorPrivacyLeak<ProductionTutorSessionInput>
>
type _NoPrivacyInCheckpoint = ProductionTutorAssertNoLeak<
  ProductionTutorPrivacyLeak<ProductionTutorCheckpoint>
>

/** The runtime itself exposes no authority-granting method. */
type _NoAuthorityMethods = ProductionTutorAssertNoLeak<
  Extract<keyof ProductionTutorRuntime, ProductionTutorForbiddenAuthorityKey>
>

/**
 * Closed output surfaces.
 *
 * Stronger than the denylist above, and the reason the denylist can be nouns
 * only: these pin each surface to its COMPLETE key set. Any added field or
 * method — a mutator, a transcript, a raw answer, an identifier, anything at
 * all — fails to compile, including names nobody thought to forbid.
 */
type _RuntimeSurfaceIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof ProductionTutorRuntime,
    'beginSession' | 'submitTurn' | 'resumeSession'
  >
>

type _PresentationIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof ProductionTutorPresentation,
    | 'messageCode'
    | 'visibleText'
    | 'mayContinue'
    | 'adultReviewPending'
    | 'captionsAlwaysVisible'
    | 'lessonMayContinueWithoutMedia'
    | 'transcriptIncluded'
  >
>

type _AcceptedResultIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof Extract<ProductionTutorTurnResult, { status: 'accepted' }>,
    | 'status'
    | 'eventRef'
    | 'directive'
    | 'reasonCode'
    | 'presentation'
    | 'checkpoint'
  >
>

type _StoppedResultIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof Extract<ProductionTutorTurnResult, { status: 'stopped' }>,
    | 'status'
    | 'reasonCode'
    | 'classification'
    | 'adultHelpState'
    | 'presentation'
    | 'coreSubmitInvocations'
  >
>

type _CheckpointIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof ProductionTutorCheckpoint,
    | 'checkpointRef'
    | 'revision'
    | 'capturedAt'
    | 'sessionCorrelationRef'
    | 'lessonRef'
    | 'segmentRef'
    | 'instructionalCursor'
    | 'protectedTutorStateRef'
    | 'lastAcceptedEventRef'
    | 'rawAnswerIncluded'
    | 'transcriptIncluded'
  >
>

type _TurnInputIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof ProductionTutorTurnInput,
    | 'sessionCorrelationRef'
    | 'turnRef'
    | 'occurredAt'
    | 'lessonRef'
    | 'segmentRef'
    | 'skillRef'
    | 'transientLearnerText'
  >
>

type _SessionInputIsClosed = ProductionTutorAssertNoLeak<
  ProductionTutorKeyDifference<
    keyof ProductionTutorSessionInput,
    | 'sessionCorrelationRef'
    | 'lessonRef'
    | 'segmentRef'
    | 'subjectRef'
    | 'gradeBand'
    | 'learnerLocalDate'
    | 'householdTimeZone'
  >
>

/**
 * Non-vacuity. A detector that resolved to `never` for every input would make
 * every assertion above pass while proving nothing, so these two shapes must be
 * caught. They are the reason the proofs are worth reading.
 */
type _DetectsAuthorityLeak = ProductionTutorAuthorityLeak<{
  readonly nested: { readonly workingLevel: number }
}>
type _DetectsPrivacyLeak = ProductionTutorPrivacyLeak<{
  readonly presentation: { readonly transcript: readonly string[] }
}>

const detectedAuthorityLeak: _DetectsAuthorityLeak = 'workingLevel'
const detectedPrivacyLeak: _DetectsPrivacyLeak = 'transcript'

/**
 * And the closed-surface assertion is non-vacuous too: an extra field on a
 * result is a real difference, not `never`.
 */
type _DetectsExtraKey = ProductionTutorKeyDifference<
  'status' | 'clearSafetyStop',
  'status'
>
const detectedExtraKey: _DetectsExtraKey = 'clearSafetyStop'

const FORBIDDEN_KEY_PATTERN =
  /^(setWorkingLevel|setGrade|grantPermission|clearSafetyStop|changeCurriculum|changeParentSettings|workingLevel|grade|permission|permissions|authorization|authorizationState|curriculum|curriculumSelection|parentSettings|parentDecision|safetyOverride|masteryDecision|transcript|rawTranscript|rawAnswer|rawResponse|rawLearnerResponse|rawText|matchedText|audio|audioUri|audioBlob|emotion|emotionalState|personality|personalityLabel|diagnosis|diagnosisLabel|studentId|studentUuid|learnerId|learnerUuid|householdId)$/

function deepKeys(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || typeof value !== 'object' || seen.has(value)) return []
  seen.add(value)
  if (Array.isArray(value)) return value.flatMap((entry) => deepKeys(entry, seen))
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [key, ...deepKeys(child, seen)],
  )
}

describe('production Tutor host contract', () => {
  it('detects an authority or privacy leak when one is present', () => {
    expect(detectedAuthorityLeak).toBe('workingLevel')
    expect(detectedPrivacyLeak).toBe('transcript')
    expect(detectedExtraKey).toBe('clearSafetyStop')
  })

  it('accepts the minimum valid session and turn input', () => {
    expect(sessionInput.sessionCorrelationRef).toBe(DIGEST)
    expect(turnInput.transientLearnerText).toBe('ready')
    // Host-established facts only. The wrapper holds verified identity; it is
    // never a turn parameter.
    expect(Object.keys(turnInput).sort()).toEqual([
      'lessonRef',
      'occurredAt',
      'segmentRef',
      'sessionCorrelationRef',
      'skillRef',
      'transientLearnerText',
      'turnRef',
    ])
  })

  it('accepts the minimum valid accepted result and carries a checkpoint', () => {
    expect(acceptedResult.status).toBe('accepted')
    if (acceptedResult.status !== 'accepted') throw new Error('unreachable')
    expect(acceptedResult.directive).toBe('continue-plan')
    expect(acceptedResult.checkpoint.instructionalCursor.phase).toBe(
      'guided-practice',
    )
    expect(acceptedResult.checkpoint.protectedTutorStateRef).toMatch(
      /^tutor-state:/,
    )
  })

  it('represents resume with structural state and an opaque tutor-state handle', () => {
    const resumed: ProductionTutorCheckpoint = {
      ...checkpoint,
      revision: checkpoint.revision + 1,
      lastAcceptedEventRef: 'event-000001',
    }
    expect(resumed.rawAnswerIncluded).toBe(false)
    expect(resumed.transcriptIncluded).toBe(false)
    // Position only: no attempts, scores, responses or observations.
    expect(Object.keys(resumed.instructionalCursor).sort()).toEqual([
      'cycleNumber',
      'itemIndex',
      'phase',
      'teachingTurnIndex',
    ])
  })

  it('carries no transcript, audio, diagnostic or authority field at runtime', () => {
    const surfaces: readonly unknown[] = [
      sessionInput,
      turnInput,
      acceptedResult,
      checkpoint,
      presentation,
    ]
    const offending = surfaces
      .flatMap((surface) => deepKeys(surface))
      .filter((key) => FORBIDDEN_KEY_PATTERN.test(key))
    expect(offending).toEqual([])
  })

  it('requires no raw student UUID anywhere in the contract', () => {
    const identifierKeys = [
      ...deepKeys(sessionInput),
      ...deepKeys(turnInput),
      ...deepKeys(acceptedResult),
      ...deepKeys(checkpoint),
    ].filter((key) =>
      ['studentId', 'studentRef', 'studentUuid', 'learnerRef', 'learnerId', 'householdRef', 'householdId'].includes(key),
    )
    expect(identifierKeys).toEqual([])
    // The only session-scoped identifier is the opaque pseudonymous digest, and
    // it is a strict subset of the frozen bridge's opaque-id bound.
    expect(correlationRef).toMatch(/^[0-9a-f]{32,64}$/)
    expect(correlationRef).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/)
  })
})

describe('learner-facing safe-render boundary', () => {
  it('produces renderable text only through the attested constructor', () => {
    expect(visibleText).toContain('learning evidence')
    expect(presentation.transcriptIncluded).toBe(false)
    expect(presentation.captionsAlwaysVisible).toBe(true)
  })

  it('refuses text that no named sanitizer attested', () => {
    expect(() =>
      createProductionTutorSafeText('Nice work.', {
        sanitizedBy: 'unreviewed-sanitizer',
        transcriptIncluded: false,
        rawLearnerTextIncluded: false,
      } as unknown as ProductionTutorSanitizationAttestation),
    ).toThrow('production_tutor_presentation_attestation_invalid')
  })

  it('refuses an attestation that admits a transcript or raw learner text', () => {
    for (const bad of [
      { sanitizedBy: 'study-bridge-learner-safe-projection', transcriptIncluded: true, rawLearnerTextIncluded: false },
      { sanitizedBy: 'study-bridge-learner-safe-projection', transcriptIncluded: false, rawLearnerTextIncluded: true },
    ]) {
      expect(() =>
        createProductionTutorSafeText(
          'Nice work.',
          bad as unknown as ProductionTutorSanitizationAttestation,
        ),
      ).toThrow('production_tutor_presentation_attestation_invalid')
    }
  })

  it('refuses empty, oversized and control-character text', () => {
    const nul = String.fromCharCode(0)
    const newline = String.fromCharCode(10)
    for (const bad of ['', 'x'.repeat(2_501), 'a' + nul + 'b', 'a' + newline + 'b']) {
      expect(() => createProductionTutorSafeText(bad, SANITIZED)).toThrow(
        'production_tutor_presentation_text_invalid',
      )
    }
  })

  it('never echoes the rejected candidate in the thrown message', () => {
    const secret = 'call me at 555-0100 ' + String.fromCharCode(0)
    expect(() => createProductionTutorSafeText(secret, SANITIZED)).toThrow(
      /^production_tutor_presentation_text_invalid$/,
    )
  })
})

describe('pseudonymous session correlation', () => {
  it('refuses a readable host session reference', () => {
    // The host's own reference is `${blockRef}:session`, which is exactly the
    // kind of weak pseudonym this brand exists to keep out.
    expect(() =>
      createProductionTutorSessionCorrelationRef('block-2026-08-07-math:session', {
        derivation: 'server-verified-pseudonymous-digest',
        reversibleToLearnerIdentity: false,
        containsLearnerIdentifier: false,
      }),
    ).toThrow('production_tutor_correlation_ref_invalid')
  })

  it('refuses a digest whose derivation was not attested', () => {
    expect(() =>
      createProductionTutorSessionCorrelationRef(DIGEST, {
        derivation: 'server-verified-pseudonymous-digest',
        reversibleToLearnerIdentity: true,
        containsLearnerIdentifier: false,
      } as never),
    ).toThrow('production_tutor_correlation_attestation_invalid')
  })

  it('refuses a digest that is too short to be opaque', () => {
    expect(() =>
      createProductionTutorSessionCorrelationRef('abc123', {
        derivation: 'server-verified-pseudonymous-digest',
        reversibleToLearnerIdentity: false,
        containsLearnerIdentifier: false,
      }),
    ).toThrow('production_tutor_correlation_ref_invalid')
  })
})

describe('future wrapper fit', () => {
  /**
   * Phase 12 rehearsal. This stub stands where a real wrapper around the frozen
   * orchestrator would sit. It proves the interface is implementable and that
   * every value the host needs can be produced without an authority or privacy
   * field — it does NOT call Tutor, and nothing here is mounted.
   */
  const stub: ProductionTutorRuntime = {
    beginSession: async (input) => ({
      sessionCorrelationRef: input.sessionCorrelationRef,
      checkpoint,
    }),
    submitTurn: async () => acceptedResult,
    resumeSession: async (restored) => ({
      sessionCorrelationRef: restored.sessionCorrelationRef,
      checkpoint: restored,
    }),
  }

  it('is implementable end to end', async () => {
    const established: ProductionTutorSessionEstablished =
      await stub.beginSession(sessionInput)
    expect(established.sessionCorrelationRef).toBe(DIGEST)

    const result = await stub.submitTurn(turnInput)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('unreachable')

    const resumed = await stub.resumeSession(result.checkpoint)
    expect(resumed.checkpoint.protectedTutorStateRef).toBe(
      'tutor-state:opaque-sidecar-handle',
    )
  })

  it('models every branch the host surface has to handle', () => {
    const branches: readonly ProductionTutorTurnResult[] = [
      acceptedResult,
      {
        status: 'stopped',
        reasonCode: 'mounted-input-safety-urgent',
        classification: 'urgent',
        adultHelpState: 'proposed-not-delivered',
        presentation: { ...presentation, mayContinue: false, adultReviewPending: true },
        coreSubmitInvocations: 0,
      },
      {
        status: 'interrupted',
        interruption: { kind: 'rate-limit' },
        coreSubmitInvocations: 0,
      },
      { status: 'quarantined', reasonCode: 'identity-binding-mismatch' },
    ]
    expect(branches.map((branch) => branch.status)).toEqual([
      'accepted',
      'stopped',
      'interrupted',
      'quarantined',
    ])
  })
})
