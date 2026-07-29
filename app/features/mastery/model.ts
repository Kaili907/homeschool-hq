import type {
  EvidenceId,
  MasteryState,
  OverrideAuditEntryId,
  OverrideId,
  SkillId,
  StudentId,
} from "../../../adaptive-learning/mastery/index.js";

/**
 * A display projection over the mastery domain.
 *
 * The adaptive-learning package remains the source of truth for mastery
 * decisions. This view model contains only presentation-ready explanations;
 * UI components must never derive mastery from completion or mutate engine
 * records directly.
 */
export interface MasteryLearnerView {
  readonly studentId: StudentId;
  readonly displayName: string;
  readonly gradeBand: string;
  readonly generatedAt: string;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface MasteryConfidenceView {
  /** Normalized confidence from 0 through 1. */
  readonly score: number;
  readonly level: ConfidenceLevel;
  readonly explanation: string;
}

export type MasteryEvidenceKind =
  | "assessment_attempt"
  | "tutor_intervention"
  | "independent_demonstration";

export interface MasteryEvidenceView {
  readonly evidenceId: EvidenceId;
  readonly kind: MasteryEvidenceKind;
  readonly title: string;
  readonly summary: string;
  readonly observedAt: string;
  readonly sourceLabel: string;
  /** True only when the learner performed without instructional support. */
  readonly independent: boolean;
  readonly resultLabel?: string;
}

export interface MasteryPrerequisiteView {
  readonly skillId: SkillId;
  readonly title: string;
  readonly state: MasteryState;
  readonly isBlocking: boolean;
}

export interface MasteryUnlockView {
  readonly skillId: SkillId;
  readonly title: string;
}

export interface MasteryOverrideAuditView {
  readonly auditEntryId?: OverrideAuditEntryId;
  readonly overrideId: OverrideId;
  readonly changedAt: string;
  readonly actorLabel: string;
  readonly actorRole: "parent" | "teacher" | "system";
  readonly previousState: MasteryState;
  readonly overrideState: MasteryState;
  readonly reason: string;
  readonly status: "active" | "superseded" | "revoked";
}

export interface MasterySkillView {
  readonly skillId: SkillId;
  readonly title: string;
  /** Student-readable learning objective. */
  readonly description: string;
  /** Optional additional context for the parent/teacher detail view. */
  readonly parentDescription?: string;
  readonly subject: string;
  readonly gradeBand: string;
  readonly state: MasteryState;
  /**
   * Zero-based prerequisite depth. It is calculated by the validated domain
   * graph, not inferred by the UI.
   */
  readonly graphLevel: number;
  readonly prerequisites: readonly MasteryPrerequisiteView[];
  readonly unlocks: readonly MasteryUnlockView[];
  readonly evidence: readonly MasteryEvidenceView[];
  readonly confidence: MasteryConfidenceView;
  readonly explanation: readonly string[];
  readonly nextStep: string;
  readonly lastIndependentDemonstrationAt?: string;
  readonly overrideAudit: readonly MasteryOverrideAuditView[];
}

export interface MasteryDashboardModel {
  readonly learner: MasteryLearnerView;
  readonly skills: readonly MasterySkillView[];
}

/**
 * UI command boundary. Production integrations translate this request to a
 * validated ManualMasteryOverride in adaptive-learning/mastery.
 */
export interface MasteryOverrideRequest {
  readonly studentId: StudentId;
  readonly skillId: SkillId;
  readonly overrideState: MasteryState;
  readonly actorRole: "parent" | "teacher";
  readonly actorLabel: string;
  readonly reason: string;
  readonly requestedAt: string;
}

export interface MasteryFeatureAdapter {
  load(studentId: StudentId): Promise<MasteryDashboardModel>;
  requestOverride(request: MasteryOverrideRequest): Promise<MasteryDashboardModel>;
}

export const EMPTY_MASTERY_FILTER_VALUE = "all" as const;
export type MasteryFilterValue = typeof EMPTY_MASTERY_FILTER_VALUE;

export interface MasteryFiltersValue {
  readonly subject: string | MasteryFilterValue;
  readonly state: MasteryState | MasteryFilterValue;
  readonly gradeBand: string | MasteryFilterValue;
}

export const DEFAULT_MASTERY_FILTERS: MasteryFiltersValue = {
  subject: EMPTY_MASTERY_FILTER_VALUE,
  state: EMPTY_MASTERY_FILTER_VALUE,
  gradeBand: EMPTY_MASTERY_FILTER_VALUE,
};
