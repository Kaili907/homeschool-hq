export const INTERLEAVING_GUIDANCE =
  "Interleaving readiness is evidence-based and configurable; this recommendation does not declare one practice pattern optimal for every learner.";

/**
 * Aggregated, non-identifying evidence for one skill. Difficulty is a local
 * course scale from 1 (least complex) through 5 (most complex).
 */
export interface PracticeSkillEvidence {
  readonly skillId: string;
  readonly difficulty: number;
  readonly prerequisiteReady: boolean;
  readonly independentAttempts: number;
  readonly independentAccuracy: number | null;
  readonly mastery: number;
  /** Candidates must be explicitly marked; the scheduler does not infer mastery. */
  readonly previouslyMastered: boolean;
}

export interface InterleavingSchedulerConfig {
  readonly minimumBlockedAttempts?: number;
  readonly minimumTransitionAccuracy?: number;
  readonly minimumTransitionMastery?: number;
  readonly minimumMixedAttempts?: number;
  readonly minimumMixedAccuracy?: number;
  readonly minimumMixedMastery?: number;
  readonly minimumReviewAttempts?: number;
  readonly minimumReviewAccuracy?: number;
  readonly minimumReviewMastery?: number;
  readonly maximumDifficultyDifference?: number;
  readonly maximumContextSwitches?: number;
  /** Includes the target skill. Must be at least 2. */
  readonly maximumSkillsPerSet?: number;
  readonly transitionReviewShare?: number;
  readonly mixedReviewShare?: number;
}

export interface InterleavingScheduleInput {
  readonly target: PracticeSkillEvidence;
  readonly reviewCandidates: readonly PracticeSkillEvidence[];
  readonly itemCount: number;
  /** Deterministically rotates equally eligible review skills across sessions. */
  readonly rotationOffset?: number;
  readonly config?: InterleavingSchedulerConfig;
}

export type PracticeMode = "blocked" | "transition" | "mixed";
export type PracticeSlotPurpose = "target_practice" | "mastered_retrieval";

export interface PracticeSlot {
  readonly position: number;
  readonly skillId: string;
  readonly purpose: PracticeSlotPurpose;
  readonly difficulty: number;
}

export type InterleavingReasonCode =
  | "initial_blocked_practice"
  | "premature_interleaving_prevented"
  | "prerequisite_not_ready"
  | "insufficient_independent_attempts"
  | "independent_accuracy_not_observed"
  | "independent_accuracy_below_transition_threshold"
  | "target_mastery_below_transition_threshold"
  | "no_eligible_mastered_skill"
  | "item_count_too_small_to_mix"
  | "context_switch_cap_prevents_mixing"
  | "transition_to_mixed_practice"
  | "mixed_practice"
  | "mastered_skill_inserted"
  | "difficulty_balanced"
  | "context_switch_limit_applied";

export type CandidateWithheldReason =
  | "not_explicitly_mastered"
  | "prerequisite_not_ready"
  | "insufficient_independent_attempts"
  | "independent_accuracy_not_observed"
  | "independent_accuracy_too_low"
  | "mastery_too_low"
  | "difficulty_difference_too_large"
  | "duplicate_skill_id"
  | "not_selected_this_cycle";

export interface WithheldReviewCandidate {
  readonly skillId: string;
  readonly reason: CandidateWithheldReason;
}

export interface InterleavingRecommendation {
  readonly mode: PracticeMode;
  readonly slots: readonly PracticeSlot[];
  readonly contextSwitches: number;
  readonly selectedReviewSkillIds: readonly string[];
  readonly withheldReviewCandidates: readonly WithheldReviewCandidate[];
  readonly reasons: readonly InterleavingReasonCode[];
  readonly guidance: typeof INTERLEAVING_GUIDANCE;
}
