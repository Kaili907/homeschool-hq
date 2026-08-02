import {
  INTERLEAVING_GUIDANCE,
  type CandidateWithheldReason,
  type InterleavingReasonCode,
  type InterleavingRecommendation,
  type InterleavingScheduleInput,
  type InterleavingSchedulerConfig,
  type PracticeMode,
  type PracticeSkillEvidence,
  type PracticeSlot,
  type WithheldReviewCandidate,
} from "./types";

interface ResolvedInterleavingConfig {
  readonly minimumBlockedAttempts: number;
  readonly minimumTransitionAccuracy: number;
  readonly minimumTransitionMastery: number;
  readonly minimumMixedAttempts: number;
  readonly minimumMixedAccuracy: number;
  readonly minimumMixedMastery: number;
  readonly minimumReviewAttempts: number;
  readonly minimumReviewAccuracy: number;
  readonly minimumReviewMastery: number;
  readonly maximumDifficultyDifference: number;
  readonly maximumContextSwitches: number;
  readonly maximumSkillsPerSet: number;
  readonly transitionReviewShare: number;
  readonly mixedReviewShare: number;
}

const DEFAULT_CONFIG: ResolvedInterleavingConfig = Object.freeze({
  minimumBlockedAttempts: 5,
  minimumTransitionAccuracy: 0.75,
  minimumTransitionMastery: 0.7,
  minimumMixedAttempts: 8,
  minimumMixedAccuracy: 0.85,
  minimumMixedMastery: 0.85,
  minimumReviewAttempts: 3,
  minimumReviewAccuracy: 0.8,
  minimumReviewMastery: 0.85,
  maximumDifficultyDifference: 1.5,
  maximumContextSwitches: 3,
  maximumSkillsPerSet: 3,
  transitionReviewShare: 0.2,
  mixedReviewShare: 0.35,
});

/**
 * Configuration may make readiness stricter, but it cannot erase the minimum
 * evidence needed to demonstrate an initial blocked-practice period.
 */
const SAFETY_FLOOR = Object.freeze({
  minimumBlockedAttempts: 3,
  minimumTransitionAccuracy: 0.6,
  minimumTransitionMastery: 0.6,
  minimumMixedAttempts: 5,
  minimumMixedAccuracy: 0.7,
  minimumMixedMastery: 0.7,
  minimumReviewAttempts: 2,
  minimumReviewAccuracy: 0.7,
  minimumReviewMastery: 0.7,
});

function assertProportion(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number from 0 to 1.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function resolveConfig(
  config: InterleavingSchedulerConfig | undefined,
): ResolvedInterleavingConfig {
  if (config) {
    const rawAttemptMinimums = [
      ["minimumBlockedAttempts", config.minimumBlockedAttempts],
      ["minimumMixedAttempts", config.minimumMixedAttempts],
      ["minimumReviewAttempts", config.minimumReviewAttempts],
    ] as const;
    for (const [name, value] of rawAttemptMinimums) {
      if (value !== undefined) {
        assertNonNegativeInteger(value, name);
      }
    }

    const rawScoreMinimums = [
      ["minimumTransitionAccuracy", config.minimumTransitionAccuracy],
      ["minimumTransitionMastery", config.minimumTransitionMastery],
      ["minimumMixedAccuracy", config.minimumMixedAccuracy],
      ["minimumMixedMastery", config.minimumMixedMastery],
      ["minimumReviewAccuracy", config.minimumReviewAccuracy],
      ["minimumReviewMastery", config.minimumReviewMastery],
    ] as const;
    for (const [name, value] of rawScoreMinimums) {
      if (value !== undefined) {
        assertProportion(value, name);
      }
    }
  }

  const resolved: ResolvedInterleavingConfig = {
    minimumBlockedAttempts: Math.max(
      config?.minimumBlockedAttempts ?? DEFAULT_CONFIG.minimumBlockedAttempts,
      SAFETY_FLOOR.minimumBlockedAttempts,
    ),
    minimumTransitionAccuracy: Math.max(
      config?.minimumTransitionAccuracy ??
        DEFAULT_CONFIG.minimumTransitionAccuracy,
      SAFETY_FLOOR.minimumTransitionAccuracy,
    ),
    minimumTransitionMastery: Math.max(
      config?.minimumTransitionMastery ??
        DEFAULT_CONFIG.minimumTransitionMastery,
      SAFETY_FLOOR.minimumTransitionMastery,
    ),
    minimumMixedAttempts: Math.max(
      config?.minimumMixedAttempts ?? DEFAULT_CONFIG.minimumMixedAttempts,
      SAFETY_FLOOR.minimumMixedAttempts,
    ),
    minimumMixedAccuracy: Math.max(
      config?.minimumMixedAccuracy ?? DEFAULT_CONFIG.minimumMixedAccuracy,
      SAFETY_FLOOR.minimumMixedAccuracy,
    ),
    minimumMixedMastery: Math.max(
      config?.minimumMixedMastery ?? DEFAULT_CONFIG.minimumMixedMastery,
      SAFETY_FLOOR.minimumMixedMastery,
    ),
    minimumReviewAttempts: Math.max(
      config?.minimumReviewAttempts ?? DEFAULT_CONFIG.minimumReviewAttempts,
      SAFETY_FLOOR.minimumReviewAttempts,
    ),
    minimumReviewAccuracy: Math.max(
      config?.minimumReviewAccuracy ?? DEFAULT_CONFIG.minimumReviewAccuracy,
      SAFETY_FLOOR.minimumReviewAccuracy,
    ),
    minimumReviewMastery: Math.max(
      config?.minimumReviewMastery ?? DEFAULT_CONFIG.minimumReviewMastery,
      SAFETY_FLOOR.minimumReviewMastery,
    ),
    maximumDifficultyDifference:
      config?.maximumDifficultyDifference ??
      DEFAULT_CONFIG.maximumDifficultyDifference,
    maximumContextSwitches:
      config?.maximumContextSwitches ??
      DEFAULT_CONFIG.maximumContextSwitches,
    maximumSkillsPerSet:
      config?.maximumSkillsPerSet ?? DEFAULT_CONFIG.maximumSkillsPerSet,
    transitionReviewShare:
      config?.transitionReviewShare ?? DEFAULT_CONFIG.transitionReviewShare,
    mixedReviewShare:
      config?.mixedReviewShare ?? DEFAULT_CONFIG.mixedReviewShare,
  };

  assertNonNegativeInteger(
    resolved.minimumBlockedAttempts,
    "minimumBlockedAttempts",
  );
  assertNonNegativeInteger(
    resolved.minimumMixedAttempts,
    "minimumMixedAttempts",
  );
  assertNonNegativeInteger(
    resolved.minimumReviewAttempts,
    "minimumReviewAttempts",
  );
  assertNonNegativeInteger(
    resolved.maximumContextSwitches,
    "maximumContextSwitches",
  );
  assertNonNegativeInteger(
    resolved.maximumSkillsPerSet,
    "maximumSkillsPerSet",
  );
  if (resolved.maximumSkillsPerSet < 2) {
    throw new RangeError("maximumSkillsPerSet must be at least 2.");
  }

  assertProportion(
    resolved.minimumTransitionAccuracy,
    "minimumTransitionAccuracy",
  );
  assertProportion(
    resolved.minimumTransitionMastery,
    "minimumTransitionMastery",
  );
  assertProportion(resolved.minimumMixedAccuracy, "minimumMixedAccuracy");
  assertProportion(resolved.minimumMixedMastery, "minimumMixedMastery");
  assertProportion(resolved.minimumReviewAccuracy, "minimumReviewAccuracy");
  assertProportion(resolved.minimumReviewMastery, "minimumReviewMastery");
  assertProportion(resolved.transitionReviewShare, "transitionReviewShare");
  assertProportion(resolved.mixedReviewShare, "mixedReviewShare");

  if (resolved.minimumMixedAttempts < resolved.minimumBlockedAttempts) {
    throw new RangeError(
      "minimumMixedAttempts cannot be below minimumBlockedAttempts.",
    );
  }
  if (
    resolved.minimumMixedAccuracy < resolved.minimumTransitionAccuracy ||
    resolved.minimumMixedMastery < resolved.minimumTransitionMastery
  ) {
    throw new RangeError(
      "Mixed-practice thresholds cannot be below transition thresholds.",
    );
  }
  if (
    resolved.transitionReviewShare <= 0 ||
    resolved.transitionReviewShare >= 0.5 ||
    resolved.mixedReviewShare <= 0 ||
    resolved.mixedReviewShare >= 0.5 ||
    resolved.mixedReviewShare < resolved.transitionReviewShare
  ) {
    throw new RangeError(
      "Review shares must be above 0, below 0.5, and mixedReviewShare must not be below transitionReviewShare.",
    );
  }
  if (
    !Number.isFinite(resolved.maximumDifficultyDifference) ||
    resolved.maximumDifficultyDifference < 0 ||
    resolved.maximumDifficultyDifference > 4
  ) {
    throw new RangeError(
      "maximumDifficultyDifference must be a finite number from 0 to 4.",
    );
  }

  return resolved;
}

function validateSkill(skill: PracticeSkillEvidence, label: string): void {
  if (skill.skillId.trim().length === 0) {
    throw new RangeError(`${label}.skillId must be a non-empty string.`);
  }
  if (
    !Number.isFinite(skill.difficulty) ||
    skill.difficulty < 1 ||
    skill.difficulty > 5
  ) {
    throw new RangeError(`${label}.difficulty must be from 1 to 5.`);
  }
  assertNonNegativeInteger(
    skill.independentAttempts,
    `${label}.independentAttempts`,
  );
  if (skill.independentAccuracy !== null) {
    assertProportion(
      skill.independentAccuracy,
      `${label}.independentAccuracy`,
    );
  }
  assertProportion(skill.mastery, `${label}.mastery`);
  if (typeof skill.prerequisiteReady !== "boolean") {
    throw new TypeError(`${label}.prerequisiteReady must be a boolean.`);
  }
  if (typeof skill.previouslyMastered !== "boolean") {
    throw new TypeError(`${label}.previouslyMastered must be a boolean.`);
  }
}

function blockedReasons(
  target: PracticeSkillEvidence,
  config: ResolvedInterleavingConfig,
): InterleavingReasonCode[] {
  const reasons: InterleavingReasonCode[] = [];
  if (!target.prerequisiteReady) {
    reasons.push("prerequisite_not_ready");
  }
  if (target.independentAttempts < config.minimumBlockedAttempts) {
    reasons.push("insufficient_independent_attempts");
  }
  if (target.independentAccuracy === null) {
    reasons.push("independent_accuracy_not_observed");
  } else if (
    target.independentAccuracy < config.minimumTransitionAccuracy
  ) {
    reasons.push("independent_accuracy_below_transition_threshold");
  }
  if (target.mastery < config.minimumTransitionMastery) {
    reasons.push("target_mastery_below_transition_threshold");
  }
  return reasons;
}

function determineReadyMode(
  target: PracticeSkillEvidence,
  config: ResolvedInterleavingConfig,
): Exclude<PracticeMode, "blocked"> {
  const mixedReady =
    target.independentAttempts >= config.minimumMixedAttempts &&
    target.independentAccuracy !== null &&
    target.independentAccuracy >= config.minimumMixedAccuracy &&
    target.mastery >= config.minimumMixedMastery;
  return mixedReady ? "mixed" : "transition";
}

interface CandidateResult {
  readonly eligible: readonly PracticeSkillEvidence[];
  readonly withheld: readonly WithheldReviewCandidate[];
}

function withheldReason(
  candidate: PracticeSkillEvidence,
  target: PracticeSkillEvidence,
  config: ResolvedInterleavingConfig,
): CandidateWithheldReason | null {
  if (candidate.skillId === target.skillId) {
    return "duplicate_skill_id";
  }
  if (!candidate.previouslyMastered) {
    return "not_explicitly_mastered";
  }
  if (!candidate.prerequisiteReady) {
    return "prerequisite_not_ready";
  }
  if (candidate.independentAttempts < config.minimumReviewAttempts) {
    return "insufficient_independent_attempts";
  }
  if (candidate.independentAccuracy === null) {
    return "independent_accuracy_not_observed";
  }
  if (candidate.independentAccuracy < config.minimumReviewAccuracy) {
    return "independent_accuracy_too_low";
  }
  if (candidate.mastery < config.minimumReviewMastery) {
    return "mastery_too_low";
  }
  if (
    Math.abs(candidate.difficulty - target.difficulty) >
    config.maximumDifficultyDifference
  ) {
    return "difficulty_difference_too_large";
  }
  return null;
}

function classifyCandidates(
  candidates: readonly PracticeSkillEvidence[],
  target: PracticeSkillEvidence,
  config: ResolvedInterleavingConfig,
): CandidateResult {
  const eligible: PracticeSkillEvidence[] = [];
  const withheld: WithheldReviewCandidate[] = [];
  const seenIds = new Set<string>([target.skillId]);

  candidates.forEach((candidate, index) => {
    validateSkill(candidate, `reviewCandidates[${index}]`);
    if (seenIds.has(candidate.skillId)) {
      withheld.push({
        skillId: candidate.skillId,
        reason: "duplicate_skill_id",
      });
      return;
    }
    seenIds.add(candidate.skillId);

    const reason = withheldReason(candidate, target, config);
    if (reason) {
      withheld.push({ skillId: candidate.skillId, reason });
    } else {
      eligible.push(candidate);
    }
  });

  eligible.sort(
    (left, right) =>
      Math.abs(left.difficulty - target.difficulty) -
        Math.abs(right.difficulty - target.difficulty) ||
      left.difficulty - right.difficulty ||
      left.skillId.localeCompare(right.skillId),
  );

  return { eligible, withheld };
}

function rotate<T>(values: readonly T[], offset: number): readonly T[] {
  if (values.length === 0) {
    return [];
  }
  const normalized = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function selectCompatibleCandidates(
  eligible: readonly PracticeSkillEvidence[],
  target: PracticeSkillEvidence,
  maximumCandidates: number,
  maximumDifficultyDifference: number,
  rotationOffset: number,
): readonly PracticeSkillEvidence[] {
  const rotated = rotate(eligible, rotationOffset);
  const selected: PracticeSkillEvidence[] = [];
  let previousDifficulty = target.difficulty;

  for (const candidate of rotated) {
    if (selected.length >= maximumCandidates) {
      break;
    }
    if (
      Math.abs(candidate.difficulty - previousDifficulty) <=
      maximumDifficultyDifference
    ) {
      selected.push(candidate);
      previousDifficulty = candidate.difficulty;
    }
  }
  return selected;
}

function blockedSlots(
  target: PracticeSkillEvidence,
  itemCount: number,
): readonly PracticeSlot[] {
  return Array.from({ length: itemCount }, (_, position) => ({
    position,
    skillId: target.skillId,
    purpose: "target_practice" as const,
    difficulty: target.difficulty,
  }));
}

function distribute(total: number, groups: number): readonly number[] {
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from(
    { length: groups },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function mixedSlots(
  target: PracticeSkillEvidence,
  selectedCandidates: readonly PracticeSkillEvidence[],
  itemCount: number,
  reviewShare: number,
  maximumContextSwitches: number,
): readonly PracticeSlot[] {
  const maximumReviewSlots = Math.floor((itemCount - 1) / 2);
  const reviewSlotCount = Math.min(
    maximumReviewSlots,
    Math.max(1, Math.round(itemCount * reviewShare)),
  );
  const targetSlotCount = itemCount - reviewSlotCount;
  const candidateDistribution = distribute(
    reviewSlotCount,
    selectedCandidates.length,
  );

  const skillBlocks: Array<{
    readonly skill: PracticeSkillEvidence;
    readonly count: number;
    readonly purpose: PracticeSlot["purpose"];
  }> = [];

  if (maximumContextSwitches === 1) {
    selectedCandidates.forEach((candidate, index) => {
      const count = candidateDistribution[index]!;
      if (count > 0) {
        skillBlocks.push({
          skill: candidate,
          count,
          purpose: "mastered_retrieval",
        });
      }
    });
    skillBlocks.push({
      skill: target,
      count: targetSlotCount,
      purpose: "target_practice",
    });
  } else {
    const firstTargetBlock = Math.ceil(targetSlotCount / 2);
    skillBlocks.push({
      skill: target,
      count: firstTargetBlock,
      purpose: "target_practice",
    });
    selectedCandidates.forEach((candidate, index) => {
      const count = candidateDistribution[index]!;
      if (count > 0) {
        skillBlocks.push({
          skill: candidate,
          count,
          purpose: "mastered_retrieval",
        });
      }
    });
    skillBlocks.push({
      skill: target,
      count: targetSlotCount - firstTargetBlock,
      purpose: "target_practice",
    });
  }

  const slots: PracticeSlot[] = [];
  for (const block of skillBlocks) {
    for (let index = 0; index < block.count; index += 1) {
      slots.push({
        position: slots.length,
        skillId: block.skill.skillId,
        purpose: block.purpose,
        difficulty: block.skill.difficulty,
      });
    }
  }
  return slots;
}

export function countContextSwitches(
  slots: readonly Pick<PracticeSlot, "skillId">[],
): number {
  let switches = 0;
  for (let index = 1; index < slots.length; index += 1) {
    if (slots[index]!.skillId !== slots[index - 1]!.skillId) {
      switches += 1;
    }
  }
  return switches;
}

function blockedRecommendation(
  target: PracticeSkillEvidence,
  itemCount: number,
  reasons: readonly InterleavingReasonCode[],
  withheld: readonly WithheldReviewCandidate[],
): InterleavingRecommendation {
  return {
    mode: "blocked",
    slots: blockedSlots(target, itemCount),
    contextSwitches: 0,
    selectedReviewSkillIds: [],
    withheldReviewCandidates: withheld,
    reasons: [
      "initial_blocked_practice",
      "premature_interleaving_prevented",
      ...reasons,
    ],
    guidance: INTERLEAVING_GUIDANCE,
  };
}

/**
 * Create an abstract practice sequence. The scheduler operates on skill-level
 * evidence only; the tutor core remains responsible for choosing and teaching
 * the actual instructional items.
 */
export function scheduleInterleavedPractice(
  input: InterleavingScheduleInput,
): InterleavingRecommendation {
  const config = resolveConfig(input.config);
  validateSkill(input.target, "target");
  if (!Number.isSafeInteger(input.itemCount) || input.itemCount <= 0) {
    throw new RangeError("itemCount must be a positive safe integer.");
  }
  const rotationOffset = input.rotationOffset ?? 0;
  if (!Number.isSafeInteger(rotationOffset)) {
    throw new RangeError("rotationOffset must be a safe integer.");
  }

  const candidates = classifyCandidates(
    input.reviewCandidates,
    input.target,
    config,
  );
  const readinessReasons = blockedReasons(input.target, config);
  if (readinessReasons.length > 0) {
    return blockedRecommendation(
      input.target,
      input.itemCount,
      readinessReasons,
      candidates.withheld,
    );
  }
  if (input.itemCount < 3) {
    return blockedRecommendation(
      input.target,
      input.itemCount,
      ["item_count_too_small_to_mix"],
      candidates.withheld,
    );
  }
  if (config.maximumContextSwitches === 0) {
    return blockedRecommendation(
      input.target,
      input.itemCount,
      ["context_switch_cap_prevents_mixing"],
      candidates.withheld,
    );
  }
  if (candidates.eligible.length === 0) {
    return blockedRecommendation(
      input.target,
      input.itemCount,
      ["no_eligible_mastered_skill"],
      candidates.withheld,
    );
  }

  const mode = determineReadyMode(input.target, config);
  const reviewShare =
    mode === "mixed" ? config.mixedReviewShare : config.transitionReviewShare;
  const reviewSlotCount = Math.min(
    Math.floor((input.itemCount - 1) / 2),
    Math.max(1, Math.round(input.itemCount * reviewShare)),
  );
  const contextBoundCandidateCount =
    config.maximumContextSwitches === 1
      ? 1
      : config.maximumContextSwitches - 1;
  const maximumCandidates = Math.min(
    reviewSlotCount,
    config.maximumSkillsPerSet - 1,
    contextBoundCandidateCount,
  );
  const selected = selectCompatibleCandidates(
    candidates.eligible,
    input.target,
    maximumCandidates,
    config.maximumDifficultyDifference,
    rotationOffset,
  );

  if (selected.length === 0) {
    return blockedRecommendation(
      input.target,
      input.itemCount,
      ["no_eligible_mastered_skill"],
      candidates.withheld,
    );
  }

  const slots = mixedSlots(
    input.target,
    selected,
    input.itemCount,
    reviewShare,
    config.maximumContextSwitches,
  );
  const contextSwitches = countContextSwitches(slots);
  const selectedIds = new Set(selected.map((candidate) => candidate.skillId));
  const notSelected: WithheldReviewCandidate[] = candidates.eligible
    .filter((candidate) => !selectedIds.has(candidate.skillId))
    .map((candidate) => ({
      skillId: candidate.skillId,
      reason: "not_selected_this_cycle" as const,
    }));
  const reasons: InterleavingReasonCode[] = [
    mode === "mixed" ? "mixed_practice" : "transition_to_mixed_practice",
    "mastered_skill_inserted",
    "difficulty_balanced",
  ];
  if (
    selected.length < candidates.eligible.length ||
    contextSwitches === config.maximumContextSwitches
  ) {
    reasons.push("context_switch_limit_applied");
  }

  return {
    mode,
    slots,
    contextSwitches,
    selectedReviewSkillIds: selected.map((candidate) => candidate.skillId),
    withheldReviewCandidates: [...candidates.withheld, ...notSelected],
    reasons,
    guidance: INTERLEAVING_GUIDANCE,
  };
}
