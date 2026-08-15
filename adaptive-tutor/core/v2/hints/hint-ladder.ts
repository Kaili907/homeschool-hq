import type {
  AssistanceLevel,
  HintLevel,
} from "../contracts/index.js";
import { validateExact } from "../contracts/index.js";
import {
  HintSelectionRequestSchema,
  type HintInterventionHistoryEntry,
  type HintSelectionReasonCode,
  type HintSelectionRequest,
  type HintSelectionResult,
  type ReviewedHintMetadata,
} from "./contracts.js";

const HINT_ORDER: readonly HintLevel[] = [
  "none",
  "nudge",
  "concept-cue",
  "guided-step",
];

const ASSISTANCE_ORDER: readonly AssistanceLevel[] = [
  "independent",
  "light-hint",
  "guided",
  "reteach-required",
];

function greaterHint(left: HintLevel, right: HintLevel): HintLevel {
  return HINT_ORDER.indexOf(left) >= HINT_ORDER.indexOf(right) ? left : right;
}

function lesserHint(left: HintLevel, right: HintLevel): HintLevel {
  return HINT_ORDER.indexOf(left) <= HINT_ORDER.indexOf(right) ? left : right;
}

function compareReferences(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function greaterAssistance(
  left: AssistanceLevel,
  right: AssistanceLevel,
): AssistanceLevel {
  return ASSISTANCE_ORDER.indexOf(left) >= ASSISTANCE_ORDER.indexOf(right)
    ? left
    : right;
}

function assistanceForHint(hintLevel: HintLevel): AssistanceLevel {
  switch (hintLevel) {
    case "none":
      return "independent";
    case "nudge":
    case "concept-cue":
      return "light-hint";
    case "guided-step":
      return "guided";
  }
}

function isSemanticallyValidHistoryEntry(entry: HintInterventionHistoryEntry): boolean {
  switch (entry.interventionKind) {
    case "hint-provided":
      return (
        entry.hintLevel !== "none" &&
        entry.assistanceLevel === assistanceForHint(entry.hintLevel)
      );
    case "comprehension-recheck":
    case "learner-completion":
      return entry.hintLevel === "none";
    case "reteach":
      return entry.hintLevel === "none" && entry.assistanceLevel === "reteach-required";
  }
}

function isSemanticallyValidRequest(request: HintSelectionRequest): boolean {
  const interventionRefs = request.interventionHistory.map((entry) => entry.interventionRef);
  const sourceInteractionRefs = request.interventionHistory.map(
    (entry) => entry.sourceInteractionRef,
  );
  const hintRefs = request.reviewedHints.map((hint) => hint.hintRef);
  return (
    new Set(interventionRefs).size === interventionRefs.length &&
    new Set(sourceInteractionRefs).size === sourceInteractionRefs.length &&
    new Set(hintRefs).size === hintRefs.length &&
    (request.assessmentPhase !== "completed-assessment-review" ||
      (request.currentReviewEventRef !== null &&
        request.currentReviewPolicyRevisionRef !== null)) &&
    request.interventionHistory.every(
      (entry) =>
        entry.learnerScopeRef === request.learnerScopeRef &&
        entry.sessionRef === request.sessionRef &&
        entry.contextRef === request.contextRef &&
        isSemanticallyValidHistoryEntry(entry),
    ) &&
    request.reviewedHints.every(
      (hint) =>
        new Set(hint.eligibleMisconceptionCodes).size ===
          hint.eligibleMisconceptionCodes.length &&
        new Set(hint.eligibleLearnerStageRefs).size ===
          hint.eligibleLearnerStageRefs.length,
    )
  );
}

function hasCurrentCompletedReviewAuthorization(
  request: HintSelectionRequest,
): boolean {
  const permission = request.reviewPermission;
  return (
    permission.status === "authorized" &&
    request.currentReviewEventRef !== null &&
    request.currentReviewPolicyRevisionRef !== null &&
    permission.learnerScopeRef === request.learnerScopeRef &&
    permission.sessionRef === request.sessionRef &&
    permission.instructionalContextRef === request.contextRef &&
    permission.opportunityRef === request.currentOpportunityRef &&
    permission.reviewEventRef === request.currentReviewEventRef &&
    permission.policyRevisionRef === request.currentReviewPolicyRevisionRef &&
    permission.privacyApprovalRef === request.currentReviewPrivacyApprovalRef
  );
}

function sortedHistory(
  request: HintSelectionRequest,
): readonly HintInterventionHistoryEntry[] {
  return request.interventionHistory
    .sort(
      (left, right) =>
        left.ordinal - right.ordinal ||
        compareReferences(left.interventionRef, right.interventionRef),
    );
}

function activeCurrentOpportunityHistory(
  request: HintSelectionRequest,
  history: readonly HintInterventionHistoryEntry[],
): readonly HintInterventionHistoryEntry[] {
  const currentOpportunityHistory = history.filter(
    (entry) => entry.opportunityRef === request.currentOpportunityRef,
  );
  let lastCompletionIndex = -1;
  for (
    let index = currentOpportunityHistory.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      currentOpportunityHistory[index]?.interventionKind ===
      "learner-completion"
    ) {
      lastCompletionIndex = index;
      break;
    }
  }
  return currentOpportunityHistory.slice(lastCompletionIndex + 1);
}

function assistanceFromState(
  request: HintSelectionRequest,
  contextHistory: readonly HintInterventionHistoryEntry[],
  selectedHintLevel: HintLevel,
): AssistanceLevel {
  return contextHistory.reduce(
    (highest, entry) => greaterAssistance(highest, entry.assistanceLevel),
    greaterAssistance(
      request.previousAssistanceLevel,
      assistanceForHint(selectedHintLevel),
    ),
  );
}

function attemptRecommendation(attemptCount: number): HintLevel {
  if (attemptCount === 0) return "none";
  if (attemptCount === 1) return "nudge";
  if (attemptCount === 2) return "concept-cue";
  return "guided-step";
}

function historyHintFloor(
  history: readonly HintInterventionHistoryEntry[],
): HintLevel {
  return history.reduce(
    (highest, entry) =>
      entry.interventionKind === "hint-provided"
        ? greaterHint(highest, entry.hintLevel)
        : highest,
    "none" as HintLevel,
  );
}

function hintEscalationsSinceLastRecheck(
  history: readonly HintInterventionHistoryEntry[],
): number {
  let lastRecheckIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.interventionKind === "comprehension-recheck") {
      lastRecheckIndex = index;
      break;
    }
  }
  let highest: HintLevel = "none";
  let escalations = 0;
  for (const entry of history.slice(lastRecheckIndex + 1)) {
    if (
      entry.interventionKind === "hint-provided" &&
      HINT_ORDER.indexOf(entry.hintLevel) > HINT_ORDER.indexOf(highest)
    ) {
      highest = entry.hintLevel;
      escalations += 1;
    }
  }
  return escalations;
}

function copyHintMetadata(hint: ReviewedHintMetadata): ReviewedHintMetadata {
  return {
    metadataKind: hint.metadataKind,
    hintRef: hint.hintRef,
    reviewedContentRef: hint.reviewedContentRef,
    reviewRef: hint.reviewRef,
    hintLevel: hint.hintLevel,
    eligibleMisconceptionCodes: [...hint.eligibleMisconceptionCodes],
    eligibleLearnerStageRefs: [...hint.eligibleLearnerStageRefs],
  };
}

function chooseReviewedHint(
  request: HintSelectionRequest,
  hintLevel: Exclude<HintLevel, "none">,
): ReviewedHintMetadata | null {
  const signal = request.misconceptionSignalCode;
  const stageRef = request.learnerStageProfile.learningStageRef;
  const eligible = request.reviewedHints.filter(
    (hint) =>
      hint.hintLevel === hintLevel &&
      (hint.eligibleMisconceptionCodes.length === 0 ||
        (signal !== null && hint.eligibleMisconceptionCodes.includes(signal))) &&
      (hint.eligibleLearnerStageRefs.length === 0 ||
        hint.eligibleLearnerStageRefs.includes(stageRef)),
  );

  const ranked = eligible.sort((left, right) => {
    const leftSpecificity =
      Number(
        signal !== null && left.eligibleMisconceptionCodes.includes(signal),
      ) + Number(left.eligibleLearnerStageRefs.includes(stageRef));
    const rightSpecificity =
      Number(
        signal !== null && right.eligibleMisconceptionCodes.includes(signal),
      ) + Number(right.eligibleLearnerStageRefs.includes(stageRef));
    return rightSpecificity - leftSpecificity || compareReferences(left.hintRef, right.hintRef);
  });
  const selected = ranked[0];
  return selected ? copyHintMetadata(selected) : null;
}

function noHint(
  assistanceLevel: AssistanceLevel,
  ...reasonCodes: HintSelectionReasonCode[]
): HintSelectionResult {
  return {
    status: "no-hint",
    hintLevel: "none",
    hintMetadata: null,
    assistanceLevel,
    reasonCodes,
    unrestrictedProviderProseAllowed: false,
  };
}

function invalidHintState(): HintSelectionResult {
  return {
    status: "rejected",
    code: "INVALID_HINT_STATE",
    tutorMayProvideHint: false,
    unrestrictedProviderProseAllowed: false,
  };
}

/**
 * Selects a Study-reviewed hint reference without authoring learner-facing prose.
 * Assistance classification is monotone within the active Study opportunity.
 */
export function selectBoundedHint(requestCandidate: unknown): HintSelectionResult {
  let request: HintSelectionRequest;
  try {
    const validation = validateExact(HintSelectionRequestSchema, requestCandidate);
    if (validation.status === "rejected") return invalidHintState();
    request = structuredClone(validation.value);
    if (!isSemanticallyValidRequest(request)) return invalidHintState();
  } catch {
    return invalidHintState();
  }

  const history = sortedHistory(request);
  const activeHistory = activeCurrentOpportunityHistory(request, history);
  const currentAssistance = assistanceFromState(request, activeHistory, "none");

  // Wave 1 structural anti-answer policy is authoritative. Neither completed
  // review permission nor a privacy approval can open this phase to hint prose.
  if (request.assessmentPhase === "active-graded-or-mastery-check") {
    return noHint(currentAssistance, "active-assessment-structural-block");
  }
  if (
    request.assessmentPhase === "completed-assessment-review" &&
    !hasCurrentCompletedReviewAuthorization(request)
  ) {
    return noHint(currentAssistance, "completed-review-not-authorized");
  }
  if (request.attemptCount === 0) {
    return noHint(currentAssistance, "attempt-not-yet-made");
  }
  if (request.studyHintCeiling === "none") {
    return noHint(currentAssistance, "study-hint-ceiling-none");
  }

  const attemptLevel = attemptRecommendation(request.attemptCount);
  const priorHintLevel = historyHintFloor(activeHistory);
  let targetLevel = greaterHint(attemptLevel, priorHintLevel);
  const reasons: HintSelectionReasonCode[] = ["attempt-count-recommendation"];

  if (request.misconceptionSignalCode !== null) {
    const misconceptionLevel = greaterHint(targetLevel, "concept-cue");
    if (misconceptionLevel !== targetLevel) {
      targetLevel = misconceptionLevel;
    }
    reasons.push("misconception-signal-recommendation");
  }
  if (HINT_ORDER.indexOf(priorHintLevel) > HINT_ORDER.indexOf(attemptLevel)) {
    reasons.push("intervention-history-recommendation");
  }

  const escalationRequested =
    HINT_ORDER.indexOf(targetLevel) > HINT_ORDER.indexOf(priorHintLevel);
  if (
    escalationRequested &&
    hintEscalationsSinceLastRecheck(activeHistory) >=
      request.learnerStageProfile.maximumHintEscalationsBeforeRecheck
  ) {
    return noHint(currentAssistance, "learner-stage-recheck-required");
  }

  const boundedLevel = lesserHint(targetLevel, request.studyHintCeiling);
  if (boundedLevel !== targetLevel) reasons.push("study-hint-ceiling-applied");
  if (boundedLevel === "none") {
    return noHint(currentAssistance, "study-hint-ceiling-none");
  }

  const hintMetadata = chooseReviewedHint(request, boundedLevel);
  if (!hintMetadata) {
    return noHint(currentAssistance, "reviewed-hint-unavailable");
  }

  return {
    status: "recommended",
    hintLevel: boundedLevel,
    hintMetadata,
    assistanceLevel: assistanceFromState(request, activeHistory, boundedLevel),
    reasonCodes: reasons,
    unrestrictedProviderProseAllowed: false,
  };
}
