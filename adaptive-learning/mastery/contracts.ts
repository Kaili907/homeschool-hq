import type {
  AssessmentAttemptId,
  EvidenceId,
  GradeBand,
  IndependentDemonstrationId,
  ISODateTime,
  MasteryRecordId,
  OverrideAuditEntryId,
  OverrideId,
  SkillGraphId,
  SkillId,
  StudentId,
  SubjectId,
  TutorInterventionId,
} from './ids.ts'

export const MASTERY_SCHEMA_VERSION = 1 as const
export type MasterySchemaVersion = typeof MASTERY_SCHEMA_VERSION

export const MASTERY_STATES = [
  'mastered',
  'currently_learning',
  'needs_reinforcement',
  'blocked_by_prerequisite',
  'not_yet_assessed',
  'evidence_uncertain',
] as const

export type MasteryState = (typeof MASTERY_STATES)[number]

export const MASTERY_STATE_LABELS: Readonly<Record<MasteryState, string>> = {
  mastered: 'Mastered',
  currently_learning: 'Currently learning',
  needs_reinforcement: 'Needs reinforcement',
  blocked_by_prerequisite: 'Blocked by prerequisite',
  not_yet_assessed: 'Not yet assessed',
  evidence_uncertain: 'Evidence uncertain',
}

export const GRADE_BANDS = [
  'elementary-3-5',
  'middle-6-8',
  'high-9-12',
] as const

export type { GradeBand } from './ids.ts'

export interface SkillDefinition {
  readonly id: SkillId
  readonly subjectId: SubjectId
  readonly title: string
  /** Student-readable statement of what is being learned. */
  readonly learningObjective: string
  /** Parent/teacher detail without student-private content. */
  readonly description: string
  readonly gradeBand: GradeBand
  readonly domain: string
  readonly tags?: readonly string[]
}

/**
 * Edge direction is always prerequisite -> dependent. `required` is explicit
 * so a future optional/recommended relation cannot silently change blocking.
 */
export interface PrerequisiteEdge {
  readonly prerequisiteSkillId: SkillId
  readonly dependentSkillId: SkillId
  readonly relation: 'required'
  readonly rationale: string
}

export interface SkillGraph {
  readonly kind: 'mastery-skill-graph'
  readonly schemaVersion: MasterySchemaVersion
  readonly id: SkillGraphId
  readonly revision: number
  readonly subjectId: SubjectId
  readonly title: string
  readonly skills: readonly SkillDefinition[]
  readonly prerequisites: readonly PrerequisiteEdge[]
}

export type EvidenceQuality =
  | 'reliable'
  | 'limited'
  | 'conflicting'
  | 'invalidated'

export type SupportLevel =
  | 'independent'
  | 'minimal_support'
  | 'guided'
  | 'full_support'

export interface MasteryEvidenceBase {
  readonly id: EvidenceId
  readonly schemaVersion: MasterySchemaVersion
  readonly studentId: StudentId
  readonly skillId: SkillId
  readonly capturedAt: ISODateTime
  /**
   * Opaque reference to the producing session/attempt/event. Raw student
   * responses and transcripts do not belong in this aggregate.
   */
  readonly sourceRef: string
  readonly quality: EvidenceQuality
}

/**
 * An assessment attempt is evidence, not a mastery conclusion. Even a perfect
 * attempt cannot establish mastery until independent-demonstration evidence is
 * recorded explicitly.
 */
export interface AssessmentAttemptEvidence extends MasteryEvidenceBase {
  readonly kind: 'assessment_attempt'
  readonly attemptId: AssessmentAttemptId
  readonly assessmentType: 'diagnostic' | 'formative' | 'retrieval' | 'summative'
  readonly scoringStatus: 'scored' | 'partially_scored' | 'unscored'
  readonly attemptedItemCount: number
  readonly correctItemCount?: number
  readonly supportLevel: SupportLevel
}

export interface TutorInterventionEvidence extends MasteryEvidenceBase {
  readonly kind: 'tutor_intervention'
  readonly interventionId: TutorInterventionId
  readonly interventionType:
    | 'clarification'
    | 'prompt'
    | 'hint'
    | 'worked_example'
    | 'reteach'
    | 'redirection'
    | 'adult_escalation'
  readonly supportLevel: Exclude<SupportLevel, 'independent'>
  readonly outcome:
    | 'resolved_with_support'
    | 'not_resolved'
    | 'inconclusive'
}

export interface DemonstrationCriterion {
  readonly criterionId: string
  readonly minimumAccuracy: number
  readonly minimumItemCount: number
}

/**
 * The only evidence kind that can satisfy the independent-performance mastery
 * gate. A producer must make the independent context explicit instead of
 * asking this subsystem to infer it from completion or score.
 */
export interface IndependentDemonstrationEvidence
  extends MasteryEvidenceBase {
  readonly kind: 'independent_demonstration'
  readonly demonstrationId: IndependentDemonstrationId
  readonly context: 'assessment' | 'retrieval' | 'authentic_task'
  readonly supportLevel: 'independent'
  readonly attemptedItemCount: number
  readonly correctItemCount: number
  readonly criterion: DemonstrationCriterion
  readonly outcome: 'successful' | 'unsuccessful' | 'inconclusive'
  readonly taskNovelty: 'new_items' | 'transfer' | 'familiar_items'
  readonly sourceEvidenceIds: readonly EvidenceId[]
}

export type MasteryEvidence =
  | AssessmentAttemptEvidence
  | TutorInterventionEvidence
  | IndependentDemonstrationEvidence

export const CONFIDENCE_LEVELS = [
  'very_low',
  'low',
  'moderate',
  'high',
] as const

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export interface ConfidenceFactor {
  readonly code:
    | 'evidence_volume'
    | 'independent_samples'
    | 'distinct_days'
    | 'recent_evidence'
    | 'consistent_results'
    | 'conflicting_results'
    | 'limited_quality'
    | 'invalidated_evidence_excluded'
    | 'no_independent_evidence'
  readonly effect: 'raises' | 'lowers' | 'neutral'
  readonly explanation: string
}

export interface ConfidenceAssessment {
  /** A bounded estimate, never a probability or diagnosis. */
  readonly score: number
  readonly level: ConfidenceLevel
  readonly assessedAt: ISODateTime
  readonly algorithmVersion: string
  readonly basisEvidenceIds: readonly EvidenceId[]
  readonly factors: readonly ConfidenceFactor[]
}

export interface PrerequisiteStatus {
  readonly skillId: SkillId
  readonly state: MasteryState | 'missing_record'
  readonly satisfied: boolean
  readonly recordRevision?: number
}

export const MASTERY_REASON_CODES = [
  'no_evidence',
  'prerequisite_record_missing',
  'prerequisite_not_mastered',
  'only_supported_performance',
  'independent_evidence_below_threshold',
  'independent_criterion_met',
  'independent_evidence_stale',
  'recent_independent_failure',
  'conflicting_independent_results',
  'evidence_quality_low',
  'reinforcement_succeeded',
  'manual_override_active',
] as const

export type MasteryReasonCode = (typeof MASTERY_REASON_CODES)[number]

export type NextActionKind =
  | 'collect_initial_evidence'
  | 'continue_adaptive_instruction'
  | 'reteach_prerequisite'
  | 'schedule_reinforcement'
  | 'collect_independent_demonstration'
  | 'maintain_with_spaced_review'
  | 'resolve_conflicting_evidence'
  | 'adult_review'

export interface MasteryNextAction {
  readonly kind: NextActionKind
  readonly label: string
  readonly rationale: string
  readonly targetSkillIds: readonly SkillId[]
}

export interface OverrideActor {
  readonly role: 'parent' | 'teacher'
  readonly actorId: string
}

export interface ManualMasteryOverride {
  readonly kind: 'manual_mastery_override'
  readonly schemaVersion: MasterySchemaVersion
  readonly id: OverrideId
  readonly studentId: StudentId
  readonly skillId: SkillId
  readonly state: MasteryState
  readonly reason: string
  readonly actor: OverrideActor
  readonly createdAt: ISODateTime
  readonly expiresAt?: ISODateTime
}

export type OverrideAuditAction = 'applied' | 'replaced' | 'revoked' | 'expired'

export interface OverrideAuditEntry {
  readonly id: OverrideAuditEntryId
  readonly overrideId: OverrideId
  readonly studentId: StudentId
  readonly skillId: SkillId
  readonly action: OverrideAuditAction
  readonly actor: OverrideActor | { readonly role: 'system'; readonly actorId: string }
  readonly at: ISODateTime
  readonly reason: string
  readonly fromState: MasteryState
  readonly toState: MasteryState
  /** Snapshot is retained for append-only accountability. */
  readonly overrideSnapshot: ManualMasteryOverride
}

export interface StudentSkillMastery {
  readonly kind: 'student-skill-mastery'
  readonly schemaVersion: MasterySchemaVersion
  readonly id: MasteryRecordId
  readonly revision: number
  readonly studentId: StudentId
  readonly skillId: SkillId
  /** State produced only by evidence, prerequisites, and decay policy. */
  readonly computedState: MasteryState
  /** Effective state after applying a current manual override, if any. */
  readonly state: MasteryState
  readonly confidence: ConfidenceAssessment
  readonly evidence: readonly MasteryEvidence[]
  readonly basisEvidenceIds: readonly EvidenceId[]
  readonly prerequisiteStatus: readonly PrerequisiteStatus[]
  readonly reasonCodes: readonly MasteryReasonCode[]
  readonly nextAction: MasteryNextAction
  readonly evaluatedAt: ISODateTime
  /** Last successful, reliable independent demonstration; never tutor-assisted. */
  readonly lastIndependentDemonstrationAt?: ISODateTime
  readonly lastReinforcedAt?: ISODateTime
  readonly override?: ManualMasteryOverride
  readonly overrideAuditHistory: readonly OverrideAuditEntry[]
}

export interface EvidenceExplanation {
  readonly evidenceId: EvidenceId
  readonly kind: MasteryEvidence['kind']
  readonly capturedAt: ISODateTime
  readonly contribution: 'supports' | 'limits' | 'context'
  readonly summary: string
}

export interface BlockingPrerequisiteExplanation {
  readonly skillId: SkillId
  readonly title: string
  readonly state: MasteryState | 'missing_record'
  readonly explanation: string
}

/**
 * Read model that directly answers every required skill-detail question.
 */
export interface MasteryExplanation {
  readonly skillId: SkillId
  readonly title: string
  readonly learningObjective: string
  readonly state: MasteryState
  readonly stateLabel: string
  readonly whyThisState: string
  readonly blockingPrerequisites: readonly BlockingPrerequisiteExplanation[]
  readonly evidence: readonly EvidenceExplanation[]
  readonly confidence: ConfidenceAssessment
  readonly confidenceSummary: string
  readonly nextAction: MasteryNextAction
  readonly lastIndependentDemonstrationAt?: ISODateTime
  readonly lastIndependentDemonstrationSummary: string
  readonly manualOverride?: {
    readonly state: MasteryState
    readonly reason: string
    readonly actorRole: OverrideActor['role']
    readonly createdAt: ISODateTime
    readonly expiresAt?: ISODateTime
  }
}
