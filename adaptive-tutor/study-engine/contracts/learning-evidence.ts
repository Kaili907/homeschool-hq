import type {
  ContractHeader,
  EvidenceId,
  ISODate,
  ISODateTime,
  SessionId,
  SkillId,
  StudentId,
  SubjectId,
} from './common.ts'

export type ObservationSource = 'student-report' | 'teacher-observation' | 'parent-observation' | 'system-measure'

export interface AccuracyEvidence {
  readonly correctCount: number
  readonly attemptedCount: number
  readonly accuracyPercent: number
  readonly scoringMethod: string
}

export interface CompletionEvidence {
  readonly completedCount: number
  readonly assignedCount: number
  readonly completionPercent: number
}

export interface SourcedRating {
  readonly rating: 1 | 2 | 3 | 4 | 5
  readonly source: ObservationSource
  readonly observedAt: ISODateTime
}

export interface IndependenceEvidence {
  readonly supportLevel: 'independent' | 'minimal-support' | 'guided' | 'full-support'
  readonly source: ObservationSource
}

export interface HintUseEvidence {
  readonly offeredCount: number
  readonly requestedCount: number
  readonly acceptedCount: number
  readonly kinds: readonly ('prompt' | 'visual' | 'worked-step' | 'definition' | 'example')[]
}

export interface TutorInterventionEvidence {
  readonly count: number
  readonly kinds: readonly (
    | 'clarification'
    | 'prompt'
    | 'worked-example'
    | 'reteaching'
    | 'redirection'
    | 'adult-escalation'
  )[]
}

export interface ResponseLatencyEvidence {
  readonly sampleCount: number
  readonly medianMs: number
  readonly p90Ms: number
  readonly minimumMs: number
  readonly maximumMs: number
}

export interface RandomResponseIndicator {
  readonly kind: 'unusually-fast-series' | 'repeating-choice-pattern' | 'observer-concern'
  readonly strength: 'weak' | 'moderate' | 'strong'
  readonly supportingEvidenceIds: readonly EvidenceId[]
  readonly doesNotEstablishInattention: true
}

export interface RecallEvidence {
  readonly attemptedOn: ISODate
  readonly intervalDays: number
  readonly correctCount: number
  readonly attemptedCount: number
  readonly hintCount: number
}

export interface RetentionEvidence {
  readonly status: 'not-assessed' | 'declining' | 'stable' | 'improving' | 'retained'
  readonly basisEvidenceIds: readonly EvidenceId[]
  readonly measuredAcrossDays: number
}

export interface MasteryOutcome {
  readonly status:
    | 'not-assessed'
    | 'not-yet-demonstrated'
    | 'progressing'
    | 'demonstrated'
    | 'retained'
    | 'insufficient-evidence'
  readonly criterionId?: string
  readonly algorithmVersion?: string
  readonly basisEvidenceIds: readonly EvidenceId[]
}

export interface PrerequisiteGapOutcome {
  readonly status: 'none-observed' | 'suspected' | 'confirmed' | 'insufficient-evidence'
  readonly prerequisiteSkillIds: readonly SkillId[]
  readonly basisEvidenceIds: readonly EvidenceId[]
  readonly nextAction: 'none' | 'collect-more-evidence' | 'remediate' | 'adult-review'
}

export type EngagementSignalKind =
  | 'accuracy'
  | 'response-latency'
  | 'random-response-indicator'
  | 'redirection'
  | 'student-report'
  | 'adult-observation'
  | 'technical-context'

/**
 * This is a support-planning interpretation, never a trait or diagnosis.
 * Runtime validation forbids "support-may-help" when accuracy is the only
 * supporting signal.
 */
export interface EngagementSupportInterpretation {
  readonly status: 'no-concern' | 'support-may-help' | 'insufficient-evidence'
  readonly supportingSignals: readonly EngagementSignalKind[]
  readonly wording: 'contextual-and-revisable'
}

export interface LearningEvidence
  extends ContractHeader<'learning-evidence', EvidenceId> {
  readonly studentId: StudentId
  readonly sessionId: SessionId
  readonly subjectId: SubjectId
  readonly skillIds: readonly SkillId[]
  readonly capturedAt: ISODateTime
  readonly accuracy?: AccuracyEvidence
  readonly completion?: CompletionEvidence
  readonly independence?: IndependenceEvidence
  readonly confidence?: SourcedRating
  readonly effort?: SourcedRating
  readonly frustration?: SourcedRating
  readonly hintUse?: HintUseEvidence
  readonly tutorIntervention?: TutorInterventionEvidence
  readonly redirectionCount?: number
  readonly responseLatency?: ResponseLatencyEvidence
  readonly randomResponseIndicators?: readonly RandomResponseIndicator[]
  readonly nextDayRecall?: RecallEvidence
  readonly retention?: RetentionEvidence
  readonly masteryOutcome?: MasteryOutcome
  readonly prerequisiteGapOutcome?: PrerequisiteGapOutcome
  readonly engagementSupport?: EngagementSupportInterpretation
}

