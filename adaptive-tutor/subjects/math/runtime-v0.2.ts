import type {
  AdaptiveMathSequence,
} from './types.js'
import type {
  CoreMediaFallback,
} from './core-v0.2-adapter.js'

export interface SessionEvidence {
  sessionId: string
  contextId: string
  source: 'diagnostic' | 'guided-practice' | 'independent-attempt' | 'reassessment'
  score: number
  uncertainty: number
  persistentMisconception?: boolean
}

export interface MasteryDecision {
  mastered: boolean
  evidenceCount: number
  distinctSessionCount: number
  distinctContextCount: number
  meanScore: number
  maximumUncertainty: number
  uncertaintyStatement: string
  placementDecisionAllowed: false
}

export interface InterventionRoutingInput {
  prerequisiteMisses: number
  repeatedMisconceptionSignals: number
  uncertainty: number
  repeatedCycles: number
  persistentDifficultyCycleLimit: number
}

export type SubjectRuntimePhase =
  | 'assessment'
  | 'identify-missing-concept'
  | 'teach-visually'
  | 'guided-practice'
  | 'independent-attempt'
  | 'reassess'
  | 'advance'
  | 'reteach'
  | 'prerequisite-remediation'
  | 'escalated'
  | 'adult-review'

export interface FlowTraceEvent {
  order: number
  phase: SubjectRuntimePhase
  corePhase:
    | 'assessment'
    | 'identify-missing-concept'
    | 'teach-visually'
    | 'guided-practice'
    | 'independent-attempt'
    | 'reassess'
    | 'advance'
    | 'reteach'
    | 'escalated'
  expectedInput: 'answer' | 'continue' | 'adult-review'
  uncertaintyStatement: string
  note: string
}

const NO_MASTERY_CLAIM =
  'Evidence remains uncertain; no diagnosis, mastery, or placement decision is made from one response.'

export function evaluateCrossSessionMasteryV02(
  evidence: SessionEvidence[],
): MasteryDecision {
  const independent = evidence.filter((item) =>
    item.source === 'independent-attempt' || item.source === 'reassessment')
  const evidenceCount = independent.length
  const distinctSessionCount = new Set(independent.map((item) => item.sessionId)).size
  const distinctContextCount = new Set(independent.map((item) => item.contextId)).size
  const meanScore = evidenceCount === 0
    ? 0
    : independent.reduce((sum, item) => sum + item.score, 0) / evidenceCount
  const maximumUncertainty = evidenceCount === 0
    ? 1
    : Math.max(...independent.map((item) => item.uncertainty))
  const persistentMisconception = independent.some((item) => item.persistentMisconception)
  const mastered =
    evidenceCount >= 5 &&
    distinctSessionCount >= 2 &&
    distinctContextCount >= 2 &&
    meanScore >= 0.8 &&
    maximumUncertainty <= 0.4 &&
    !persistentMisconception
  return {
    mastered,
    evidenceCount,
    distinctSessionCount,
    distinctContextCount,
    meanScore,
    maximumUncertainty,
    uncertaintyStatement: mastered
      ? 'Repeated evidence across at least two sessions supports this instructional mastery decision; adult review remains available.'
      : NO_MASTERY_CLAIM,
    placementDecisionAllowed: false,
  }
}

export function routeInterventionV02(
  input: InterventionRoutingInput,
): 'teach-visually' | 'reteach' | 'prerequisite-remediation' | 'escalated' {
  if (input.repeatedCycles >= input.persistentDifficultyCycleLimit) return 'escalated'
  if (input.prerequisiteMisses >= 2) return 'prerequisite-remediation'
  if (input.repeatedMisconceptionSignals >= 2 || input.uncertainty > 0.6) return 'reteach'
  return 'teach-visually'
}

export function resolveMediaFallbackV02(
  capability: { visualAvailable: boolean; voiceAvailable: boolean },
  fallback: CoreMediaFallback,
): {
  visualMode: 'visual-board' | 'text-alternative'
  voiceMode: 'voice' | 'displayed-text'
  visualText: string
  spokenText: string
  captionsVisible: true
  transcriptAvailable: true
  lessonMayContinue: true
} {
  return {
    visualMode: capability.visualAvailable ? 'visual-board' : 'text-alternative',
    voiceMode: capability.voiceAvailable ? 'voice' : 'displayed-text',
    visualText: capability.visualAvailable ? 'Visual board available.' : fallback.missingVisualText,
    spokenText: capability.voiceAvailable ? 'Voice available.' : fallback.missingAudioText,
    captionsVisible: true,
    transcriptAvailable: true,
    lessonMayContinue: true,
  }
}

export function adultEscalationV02(input: {
  repeatedCycles: number
  persistentDifficultyCycleLimit: number
  disputedGrading?: boolean
}): {
  escalationRecommended: boolean
  expectedInput: 'adult-review'
  reason: 'persistent-difficulty' | 'disputed-grading' | 'review-available'
  diagnosticClaimMade: false
  highStakesPlacementDecisionMade: false
  identifyingInformationRequested: false
  uncertaintyStatement: string
} {
  const persistent = input.repeatedCycles >= input.persistentDifficultyCycleLimit
  return {
    escalationRecommended: persistent || input.disputedGrading === true,
    expectedInput: 'adult-review',
    reason: input.disputedGrading
      ? 'disputed-grading'
      : persistent
        ? 'persistent-difficulty'
        : 'review-available',
    diagnosticClaimMade: false,
    highStakesPlacementDecisionMade: false,
    identifyingInformationRequested: false,
    uncertaintyStatement: NO_MASTERY_CLAIM,
  }
}

export function createAdaptiveFlowTraceV02(
  sequence: AdaptiveMathSequence,
  scenario: 'advance' | 'reteach-prerequisite' | 'persistent-escalation',
): FlowTraceEvent[] {
  const base: Array<Omit<FlowTraceEvent, 'order'>> = [
    {
      phase: 'assessment',
      corePhase: 'assessment',
      expectedInput: 'answer',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: `Assess ${sequence.title}, one item at a time.`,
    },
    {
      phase: 'identify-missing-concept',
      corePhase: 'identify-missing-concept',
      expectedInput: 'continue',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: 'Treat the misconception as a hypothesis, not a diagnosis.',
    },
    {
      phase: 'teach-visually',
      corePhase: 'teach-visually',
      expectedInput: 'answer',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: 'Use a Core visual primitive or the complete text alternative.',
    },
    {
      phase: 'guided-practice',
      corePhase: 'guided-practice',
      expectedInput: 'answer',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: 'Offer one non-answer-revealing hint at a time.',
    },
    {
      phase: 'independent-attempt',
      corePhase: 'independent-attempt',
      expectedInput: 'answer',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: 'Collect independent evidence without hints.',
    },
    {
      phase: 'reassess',
      corePhase: 'reassess',
      expectedInput: 'answer',
      uncertaintyStatement: NO_MASTERY_CLAIM,
      note: 'Reassess; one response cannot establish mastery.',
    },
  ]
  if (scenario === 'advance') {
    base.push({
      phase: 'advance',
      corePhase: 'advance',
      expectedInput: 'adult-review',
      uncertaintyStatement: 'Repeated cross-session evidence supports advancement; this is not a placement decision.',
      note: 'Make the parent or teacher review available.',
    })
  } else {
    base.push(
      {
        phase: 'reteach',
        corePhase: 'reteach',
        expectedInput: 'continue',
        uncertaintyStatement: NO_MASTERY_CLAIM,
        note: 'Use a different explanation and parallel example.',
      },
      {
        phase: 'prerequisite-remediation',
        corePhase: 'reteach',
        expectedInput: 'continue',
        uncertaintyStatement: NO_MASTERY_CLAIM,
        note: 'A subject-owned subphase uses the approved prerequisite remediation branch without changing the frozen Core phase union.',
      },
    )
    if (scenario === 'persistent-escalation') {
      base.push(
        {
          phase: 'escalated',
          corePhase: 'escalated',
          expectedInput: 'adult-review',
          uncertaintyStatement: NO_MASTERY_CLAIM,
          note: 'Persistent difficulty triggers adult escalation without a diagnosis.',
        },
        {
          phase: 'adult-review',
          corePhase: 'escalated',
          expectedInput: 'adult-review',
          uncertaintyStatement: NO_MASTERY_CLAIM,
          note: 'Parent or teacher reviews strengths, needs, evidence, and uncertainty.',
        },
      )
    }
  }
  return base.map((event, index) => ({ ...event, order: index + 1 }))
}

