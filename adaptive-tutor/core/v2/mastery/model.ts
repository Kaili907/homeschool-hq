import { validateExact } from "../contracts/validation.js";
import {
  StudyMasteryEvidenceInputSchema,
  type MasteryAssistanceProfile,
  type MasteryEvidenceEvaluation,
  type MasteryEvidenceRecommendation,
  type MasteryEvidenceSummary,
  type StudyMasteryEvidenceInput,
  type StudyMasteryEvidenceItem,
} from "./contracts.js";

const AUTHORITY_BOUNDARY = {
  studyDecisionRequired: true,
  studyMutationAllowed: false,
  authoritative: false,
} as const;

function rejected(reasonCodes: readonly string[]): MasteryEvidenceEvaluation {
  return {
    envelope: "tutor-mastery-evidence-summary",
    evaluationStatus: "rejected",
    recommendation: "insufficient-evidence",
    reasonCodes: [...reasonCodes],
    ...AUTHORITY_BOUNDARY,
  };
}

function signature(evidence: StudyMasteryEvidenceItem): string {
  return [
    evidence.issuer,
    evidence.learnerScopeRef,
    evidence.conceptRef,
    evidence.outcome,
    evidence.assistanceLevel,
    evidence.recency,
    evidence.spacing,
    evidence.observedAt,
  ].join("\u001f");
}

interface ReplayResolution {
  readonly evidence: readonly StudyMasteryEvidenceItem[];
  readonly duplicateReplayCount: number;
  readonly conflictingReplayCount: number;
}

function resolveReplays(input: StudyMasteryEvidenceInput): ReplayResolution {
  const byReference = new Map<string, Map<string, StudyMasteryEvidenceItem>>();
  let duplicateReplayCount = 0;

  for (const item of input.evidence) {
    const versions = byReference.get(item.evidenceRef) ?? new Map();
    const itemSignature = signature(item);
    if (versions.has(itemSignature)) duplicateReplayCount += 1;
    else versions.set(itemSignature, item);
    byReference.set(item.evidenceRef, versions);
  }

  const evidence: StudyMasteryEvidenceItem[] = [];
  let conflictingReplayCount = 0;
  for (const evidenceRef of [...byReference.keys()].sort()) {
    const versions = byReference.get(evidenceRef);
    if (!versions) continue;
    if (versions.size > 1) {
      conflictingReplayCount += 1;
      continue;
    }
    const item = versions.values().next().value as StudyMasteryEvidenceItem | undefined;
    if (item) evidence.push(item);
  }

  return { evidence, duplicateReplayCount, conflictingReplayCount };
}

function countAssistance(
  evidence: readonly StudyMasteryEvidenceItem[],
): MasteryAssistanceProfile {
  const profile: MasteryAssistanceProfile = {
    independent: 0,
    lightHint: 0,
    guided: 0,
    reteachRequired: 0,
  };
  for (const item of evidence) {
    if (item.assistanceLevel === "independent") profile.independent += 1;
    else if (item.assistanceLevel === "light-hint") profile.lightHint += 1;
    else if (item.assistanceLevel === "guided") profile.guided += 1;
    else profile.reteachRequired += 1;
  }
  return profile;
}

interface RecommendationFactors {
  readonly evidence: readonly StudyMasteryEvidenceItem[];
  readonly demonstratedCount: number;
  readonly notDemonstratedCount: number;
  readonly independentDemonstratedCount: number;
  readonly currentConclusiveCount: number;
  readonly currentIndependentDemonstratedCount: number;
  readonly currentSpacedIndependentDemonstratedCount: number;
  readonly conflictingReplayCount: number;
}

function recommend(factors: RecommendationFactors): MasteryEvidenceRecommendation {
  if (factors.conflictingReplayCount > 0) return "conflicting-evidence";
  if (factors.demonstratedCount > 0 && factors.notDemonstratedCount > 0) {
    return "conflicting-evidence";
  }
  if (factors.currentConclusiveCount === 0) return "insufficient-evidence";
  if (factors.demonstratedCount === 0) return "insufficient-evidence";

  if (
    factors.currentIndependentDemonstratedCount >= 2 &&
    factors.currentSpacedIndependentDemonstratedCount >= 1
  ) {
    return "supported-evidence";
  }
  if (factors.currentIndependentDemonstratedCount >= 1) return "emerging-evidence";

  const currentDemonstrated = factors.evidence.filter(
    (item) => item.recency === "current" && item.outcome === "demonstrated",
  );
  if (currentDemonstrated.some((item) => item.assistanceLevel !== "reteach-required")) {
    return "emerging-evidence";
  }
  return "insufficient-evidence";
}

function reasonCodes(
  recommendation: MasteryEvidenceRecommendation,
  factors: RecommendationFactors,
  duplicateReplayCount: number,
): string[] {
  const reasons: string[] = [];
  if (factors.evidence.length === 0 && factors.conflictingReplayCount === 0) {
    reasons.push("no-usable-evidence");
  }
  if (duplicateReplayCount > 0) reasons.push("replay-deduplicated");
  if (factors.conflictingReplayCount > 0) reasons.push("conflicting-replay");
  if (factors.demonstratedCount > 0 && factors.notDemonstratedCount > 0) {
    reasons.push("contradiction-detected");
  }
  if (
    factors.currentConclusiveCount === 0 &&
    factors.demonstratedCount + factors.notDemonstratedCount > 0
  ) {
    reasons.push("stale-evidence-only");
  }
  if (factors.demonstratedCount === 0 && factors.notDemonstratedCount > 0) {
    reasons.push("failure-evidence-only");
  }
  if (
    factors.demonstratedCount > 0 &&
    factors.evidence
      .filter((item) => item.outcome === "demonstrated")
      .every((item) => item.assistanceLevel === "reteach-required")
  ) {
    reasons.push("reteach-required-only");
  }
  if (
    factors.demonstratedCount > 0 &&
    factors.independentDemonstratedCount === 0 &&
    factors.evidence
      .filter((item) => item.outcome === "demonstrated")
      .every((item) => item.assistanceLevel === "guided")
  ) {
    reasons.push("guided-evidence-only");
  }
  if (factors.currentIndependentDemonstratedCount === 1) {
    reasons.push("single-independent-sample");
  }
  if (
    factors.currentIndependentDemonstratedCount >= 2 &&
    factors.currentSpacedIndependentDemonstratedCount === 0
  ) {
    reasons.push("insufficient-spacing");
  }
  if (recommendation === "supported-evidence") {
    reasons.push("repeated-independent-evidence", "spaced-evidence");
  }
  if (
    factors.evidence.length > 0 &&
    factors.demonstratedCount === 0 &&
    factors.notDemonstratedCount === 0
  ) {
    reasons.push("inconclusive-evidence-only");
  }
  if (reasons.length === 0) reasons.push("assistance-limited-evidence");
  return reasons;
}

function summarize(input: StudyMasteryEvidenceInput): MasteryEvidenceSummary {
  const replay = resolveReplays(input);
  const evidence = replay.evidence;
  const demonstrated = evidence.filter((item) => item.outcome === "demonstrated");
  const notDemonstratedCount = evidence.filter(
    (item) => item.outcome === "not-demonstrated",
  ).length;
  const inconclusiveCount = evidence.filter((item) => item.outcome === "inconclusive").length;
  const independentDemonstratedCount = demonstrated.filter(
    (item) => item.assistanceLevel === "independent",
  ).length;
  const currentConclusiveCount = evidence.filter(
    (item) => item.recency === "current" && item.outcome !== "inconclusive",
  ).length;
  const currentIndependentDemonstratedCount = demonstrated.filter(
    (item) => item.recency === "current" && item.assistanceLevel === "independent",
  ).length;
  const currentSpacedIndependentDemonstratedCount = demonstrated.filter(
    (item) =>
      item.recency === "current" &&
      item.spacing === "spaced" &&
      item.assistanceLevel === "independent",
  ).length;
  const factors: RecommendationFactors = {
    evidence,
    demonstratedCount: demonstrated.length,
    notDemonstratedCount,
    independentDemonstratedCount,
    currentConclusiveCount,
    currentIndependentDemonstratedCount,
    currentSpacedIndependentDemonstratedCount,
    conflictingReplayCount: replay.conflictingReplayCount,
  };
  const recommendation = recommend(factors);

  return {
    envelope: "tutor-mastery-evidence-summary",
    evaluationStatus: "summarized",
    recommendation,
    learnerScopeRef: input.learnerScopeRef,
    conceptRef: input.conceptRef,
    evaluatedAt: input.evaluatedAt,
    sampleCount: evidence.length,
    demonstratedCount: demonstrated.length,
    notDemonstratedCount,
    inconclusiveCount,
    independentDemonstratedCount,
    currentEvidenceCount: evidence.filter((item) => item.recency === "current").length,
    staleEvidenceCount: evidence.filter((item) => item.recency === "stale").length,
    spacedEvidenceCount: evidence.filter((item) => item.spacing === "spaced").length,
    duplicateReplayCount: replay.duplicateReplayCount,
    conflictingReplayCount: replay.conflictingReplayCount,
    assistanceProfile: countAssistance(evidence),
    reasonCodes: reasonCodes(recommendation, factors, replay.duplicateReplayCount),
    ...AUTHORITY_BOUNDARY,
  };
}

/**
 * Produces a deterministic, non-authoritative recommendation from exact,
 * Study-issued evidence metadata. It never scores learner content or mutates
 * Study state.
 */
export function evaluateMasteryEvidence(input: unknown): MasteryEvidenceEvaluation {
  const validation = validateExact(StudyMasteryEvidenceInputSchema, input);
  if (validation.status === "rejected") return rejected(["invalid-study-evidence"]);

  const value = validation.value;
  const reasonCodes: string[] = [];
  if (value.evidence.some((item) => item.learnerScopeRef !== value.learnerScopeRef)) {
    reasonCodes.push("cross-learner-evidence");
  }
  if (value.evidence.some((item) => item.conceptRef !== value.conceptRef)) {
    reasonCodes.push("cross-concept-evidence");
  }
  const evaluatedAt = Date.parse(value.evaluatedAt);
  if (
    !Number.isFinite(evaluatedAt) ||
    value.evidence.some((item) => !Number.isFinite(Date.parse(item.observedAt)))
  ) {
    reasonCodes.push("invalid-evidence-time");
  } else if (value.evidence.some((item) => Date.parse(item.observedAt) > evaluatedAt)) {
    reasonCodes.push("future-evidence");
  }
  if (reasonCodes.length > 0) return rejected(reasonCodes);

  return summarize(value);
}
