import {
  ADAPTIVE_FEATURES,
  evaluateAdaptiveAdmission,
  type AdaptiveAdmissionDecision,
  type AdaptiveFeature,
} from "../../../core/v2/admission/index.js";
import { buildConceptGraph } from "../../../core/v2/concepts/index.js";
import {
  createAcademicMisconceptionRegistry,
  type AcademicMisconceptionSignalResult,
} from "../../../core/v2/misconceptions/index.js";
import { selectBoundedHint } from "../../../core/v2/hints/index.js";
import { recommendNextIntervention } from "../../../core/v2/interventions/index.js";
import { evaluateMasteryEvidence } from "../../../core/v2/mastery/index.js";
import { validateExact } from "../../../core/v2/contracts/index.js";
import {
  explainTutorRecommendationForParentHub,
  type ParentExplanationReasonCode,
} from "../parent-explanations/index.js";
import {
  proposePrerequisiteRepair,
  type PrerequisiteRepairDependencies,
  type ProposalScopeBinding,
} from "../prerequisite-repair/index.js";
import {
  proposeReteachPlan,
  type ReteachDependencies,
  type ReteachStepKind,
} from "../reteach/index.js";
import {
  WAVE2_ADAPTIVE_COMPOSITION_VERSION,
  Wave2AdaptiveCompositionRequestSchema,
  type Wave2AdaptiveCompositionRequest,
  type Wave2StudyDecisionPacket,
} from "./contracts.js";
import type { Wave2ReplayLedgerPort } from "./replay.js";

export interface Wave2AdaptiveCompositionDependencies {
  readonly replayLedger: Wave2ReplayLedgerPort;
  readonly adaptiveSubsystems?: Wave2AdaptiveSubsystems;
}

type AcceptedConceptGraph = Extract<
  ReturnType<typeof buildConceptGraph>,
  { readonly status: "accepted" }
>;
type AcceptedMisconceptionRegistry = Extract<
  ReturnType<typeof createAcademicMisconceptionRegistry>,
  { readonly status: "ready" }
>;

/** Injectable only so authority-order tests can prove which adaptive boundaries ran. */
export interface Wave2AdaptiveSubsystems {
  readonly evaluateAdmission: typeof evaluateAdaptiveAdmission;
  readonly buildConceptGraph: typeof buildConceptGraph;
  readonly queryConceptGraph: (
    graph: AcceptedConceptGraph,
    conceptRef: string,
  ) => ReturnType<AcceptedConceptGraph["graph"]["directPrerequisites"]>;
  readonly createMisconceptionRegistry: typeof createAcademicMisconceptionRegistry;
  readonly matchMisconception: (
    registry: AcceptedMisconceptionRegistry,
    request: Wave2AdaptiveCompositionRequest["misconceptionMatch"],
  ) => AcademicMisconceptionSignalResult;
  readonly selectHint: typeof selectBoundedHint;
  readonly recommendIntervention: typeof recommendNextIntervention;
  readonly evaluateMastery: typeof evaluateMasteryEvidence;
  readonly proposeRepair: typeof proposePrerequisiteRepair;
  readonly proposeReteach: typeof proposeReteachPlan;
  readonly explainParent: typeof explainTutorRecommendationForParentHub;
}

const DEFAULT_ADAPTIVE_SUBSYSTEMS: Wave2AdaptiveSubsystems = Object.freeze({
  evaluateAdmission: evaluateAdaptiveAdmission,
  buildConceptGraph,
  queryConceptGraph: (graph: AcceptedConceptGraph, conceptRef: string) =>
    graph.graph.directPrerequisites(conceptRef),
  createMisconceptionRegistry: createAcademicMisconceptionRegistry,
  matchMisconception: (
    registry: AcceptedMisconceptionRegistry,
    request: Wave2AdaptiveCompositionRequest["misconceptionMatch"],
  ) => registry.registry.match(request),
  selectHint: selectBoundedHint,
  recommendIntervention: recommendNextIntervention,
  evaluateMastery: evaluateMasteryEvidence,
  proposeRepair: proposePrerequisiteRepair,
  proposeReteach: proposeReteachPlan,
  explainParent: explainTutorRecommendationForParentHub,
});

const AUTHORITY_BOUNDARY = Object.freeze({
  studyDecisionRequired: true,
  studyMutationAllowed: false,
  studyEngineRemainsAuthority: true,
  tutorCanChangeOfficialWorkingLevel: false,
  tutorCanDeclareOfficialMastery: false,
} as const);

type PendingStudyDecision = Extract<
  Wave2StudyDecisionPacket,
  { readonly status: "pending-study-decision" }
>;

const ACTION_FAMILY: Readonly<Record<AdaptiveFeature, string>> = Object.freeze({
  "concept-prerequisite-graph": "check-prerequisite",
  "misconception-analysis": "academic-signal",
  "hint-ladder": "hint",
  "intervention-ladder": "intervention-recommendation",
  "mastery-evidence": "mastery-evidence",
  "prerequisite-repair": "check-prerequisite",
  reteach: "reteach",
  "parent-explanation": "parent-explanation",
});

const REQUIRED_FEATURES: readonly AdaptiveFeature[] = ADAPTIVE_FEATURES.filter(
  (feature) => feature !== "parent-explanation",
);
const INVALID_EVENT_REF = "event:invalid-wave2-request" as const;
const INVALID_FALLBACK_REF = "fallback:reviewed-static-wave2" as const;
const INVALID_CONTENT_REF = "content:reviewed-static-wave2" as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function requestFingerprint(request: Wave2AdaptiveCompositionRequest): string {
  return JSON.stringify(canonicalize(request));
}

function policyCode(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const bounded = normalized.slice(0, 96).replace(/-+$/g, "");
  return bounded.length >= 3 ? bounded : "wave2-failure";
}

function fallback(
  request: Wave2AdaptiveCompositionRequest,
  reasonCode: string,
  failedFeature: AdaptiveFeature | null,
): Wave2StudyDecisionPacket {
  return {
    compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
    status: "reviewed-static-fallback",
    eventRef: request.studyAuthority.eventRef,
    reasonCode: policyCode(reasonCode),
    failedFeature,
    fallbackRef: request.reviewedStaticFallback.fallbackRef,
    reviewedContentRefs: [...request.reviewedStaticFallback.reviewedContentRefs],
    ...AUTHORITY_BOUNDARY,
  };
}

function invalidFallback(): Wave2StudyDecisionPacket {
  return {
    compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
    status: "reviewed-static-fallback",
    eventRef: INVALID_EVENT_REF,
    reasonCode: "invalid-composition-request",
    failedFeature: null,
    fallbackRef: INVALID_FALLBACK_REF,
    reviewedContentRefs: [INVALID_CONTENT_REF],
    ...AUTHORITY_BOUNDARY,
  };
}

/**
 * The frozen Wave 2 wire contract's quarantined packet is the explicit,
 * non-actionable safety-held projection: it contains no academic proposal or
 * reviewed content and still requires Study to decide what happens next.
 */
function safetyHeld(
  request: Wave2AdaptiveCompositionRequest,
  reasonCode:
    | "study-safety-held"
    | "safety-representation-conflict"
    | "study-safety-held-binding-conflict"
    | "study-safety-held-replay-unavailable",
): Wave2StudyDecisionPacket {
  return {
    compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
    status: "quarantined",
    eventRef: request.studyAuthority.eventRef,
    reasonCode,
    ...AUTHORITY_BOUNDARY,
  };
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function safetyBindingsAreValid(request: Wave2AdaptiveCompositionRequest): boolean {
  const held = request.studyAuthority.safetyStatus === "academic-flow-held";
  if (request.capabilityMetadata.safetyAdmission !== (held ? "restricted" : "admitted")) {
    return false;
  }
  return request.intervention.safetyRestriction.status ===
    (held ? "academic-flow-held" : "none");
}

function compositionBindingsAreValid(request: Wave2AdaptiveCompositionRequest): boolean {
  const authority = request.studyAuthority;
  const metadata = request.capabilityMetadata;
  if (
    !safetyBindingsAreValid(request) ||
    metadata.invocationBindingRef !== authority.invocationBindingRef ||
    metadata.subjectRef !== authority.subjectRef ||
    metadata.curriculumBindingRef !== authority.curriculumBindingRef
  ) return false;
  if (new Set(authority.allowedActions).size !== authority.allowedActions.length) return false;

  const admissions = request.reviewedContentAdmissions;
  if (
    new Set(admissions.map(({ feature }) => feature)).size !== ADAPTIVE_FEATURES.length ||
    ADAPTIVE_FEATURES.some((feature) => !admissions.some((entry) => entry.feature === feature))
  ) return false;

  const nodeRefs = request.conceptGraph.nodes.map(({ conceptRef }) => conceptRef);
  const scopeRefs = request.conceptScopeBindings.map(({ conceptRef }) => conceptRef);
  if (
    new Set(nodeRefs).size !== nodeRefs.length ||
    new Set(scopeRefs).size !== scopeRefs.length ||
    nodeRefs.length !== scopeRefs.length ||
    nodeRefs.some((ref) => !scopeRefs.includes(ref))
  ) return false;
  const scopeByConcept = new Map(
    request.conceptScopeBindings.map((scope) => [scope.conceptRef, scope]),
  );
  if (request.conceptGraph.nodes.some((node) =>
    scopeByConcept.get(node.conceptRef)?.subjectRef !== node.context.subjectRef
  )) return false;
  const currentScope = scopeByConcept.get(authority.currentConceptRef);
  if (
    currentScope === undefined ||
    currentScope.subjectRef !== authority.subjectRef ||
    currentScope.gradeRef !== authority.gradeRef ||
    currentScope.curriculumRef !== authority.curriculumBindingRef
  ) return false;

  const match = request.misconceptionMatch;
  if (
    match.learnerScopeRef !== authority.learnerScopeRef ||
    match.instructionalContextRef !== authority.instructionalContextRef ||
    match.conceptRef !== authority.currentConceptRef ||
    match.evidence.some((item) =>
      item.learnerScopeRef !== authority.learnerScopeRef ||
      item.instructionalContextRef !== authority.instructionalContextRef ||
      item.conceptRef !== authority.currentConceptRef
    )
  ) return false;

  if (
    request.hintSelection.contextRef !== authority.instructionalContextRef ||
    request.hintSelection.assessmentPhase !== authority.assessmentPhase ||
    request.hintSelection.studyHintCeiling !== authority.studyHintCeiling ||
    request.hintSelection.misconceptionSignalCode !== null
  ) return false;

  if (
    request.intervention.interactionRef !== authority.interactionRef ||
    request.intervention.assessmentPhase !== authority.assessmentPhase ||
    !sameStringArray(request.intervention.allowedActions, authority.allowedActions) ||
    request.intervention.misconceptionSignal.status !== "none" ||
    request.intervention.prerequisiteSignal.status !== "none"
  ) return false;

  if (
    request.masteryEvidence.learnerScopeRef !== authority.learnerScopeRef ||
    request.masteryEvidence.conceptRef !== authority.currentConceptRef ||
    request.masteryEvidence.evidence.some((item) =>
      item.learnerScopeRef !== authority.learnerScopeRef ||
      item.conceptRef !== authority.currentConceptRef
    )
  ) return false;

  if (
    new Set(request.repairPolicy.reviewedContent.map(({ conceptRef }) => conceptRef)).size !==
      request.repairPolicy.reviewedContent.length ||
    request.repairPolicy.reviewedContent.some(({ conceptRef }) => !scopeByConcept.has(conceptRef)) ||
    new Set(request.reteachPolicy.reviewedContentRefs).size !==
      request.reteachPolicy.reviewedContentRefs.length
  ) return false;

  const parent = request.parentWhy;
  if (parent !== null && (
    parent.selectedLearnerRef !== authority.learnerScopeRef ||
    parent.authorizedLearnerRef !== authority.learnerScopeRef ||
    parent.recommendationEventRef !== authority.eventRef
  )) return false;
  return true;
}

function admissionsFor(
  request: Wave2AdaptiveCompositionRequest,
  subsystems: Wave2AdaptiveSubsystems,
): readonly {
  readonly feature: AdaptiveFeature;
  readonly decision: AdaptiveAdmissionDecision;
}[] {
  const features = request.parentWhy === null
    ? REQUIRED_FEATURES
    : ADAPTIVE_FEATURES;
  return features.map((feature) => {
    const reviewed = request.reviewedContentAdmissions.find(
      (entry) => entry.feature === feature,
    );
    return {
      feature,
      decision: subsystems.evaluateAdmission({
        inputKind: "study-adaptive-admission",
        request: {
          requestVersion: "study-tutor-v2.adaptive-admission.v1",
          requestKind: "study-adaptive-admission-request",
          invocationBindingRef: request.studyAuthority.invocationBindingRef,
          subjectRef: request.studyAuthority.subjectRef,
          curriculumBindingRef: request.studyAuthority.curriculumBindingRef,
          feature,
          actionFamily: ACTION_FAMILY[feature],
          reviewedContentAdmission: reviewed?.admission ?? "not-admitted",
        },
        capabilityMetadata: request.capabilityMetadata,
      }),
    };
  });
}

function repairDependencies(
  request: Wave2AdaptiveCompositionRequest,
  graph: AcceptedConceptGraph,
  signal: AcademicMisconceptionSignalResult,
): PrerequisiteRepairDependencies {
  const scopeByConcept = new Map(
    request.conceptScopeBindings.map((scope) => [scope.conceptRef, scope]),
  );
  const reviewedByConcept = new Map(
    request.repairPolicy.reviewedContent.map((entry) => [entry.conceptRef, entry.reviewedContentRefs]),
  );
  return {
    prerequisiteGraph: {
      lookup(value) {
        const result = graph.graph.directPrerequisites(value.conceptRef);
        if (result.status !== "found") throw new Error("Concept lookup unavailable");
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          conceptRef: value.conceptRef,
          prerequisites: result.conceptRefs.map((conceptRef) => {
            const scope = scopeByConcept.get(conceptRef);
            if (scope === undefined) throw new Error("Concept scope unavailable");
            return {
              conceptRef,
              subjectRef: scope.subjectRef,
              gradeRef: scope.gradeRef,
              curriculumRef: scope.curriculumRef,
            };
          }),
        };
      },
    },
    misconceptionSignals: {
      lookup(value) {
        const status = signal.status === "conflicting-evidence"
          ? "conflicting"
          : signal.status === "possible-misconception"
            ? "suspected"
            : "clear";
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          currentConceptRef: value.currentConceptRef,
          status,
          suspectedPrerequisiteRefs: status === "suspected"
            ? [...signal.prerequisiteConceptRefs]
            : [],
        };
      },
    },
    reviewedContent: {
      lookup(value) {
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          purpose: "prerequisite-repair",
          entries: value.conceptRefs.map((conceptRef) => ({
            conceptRef,
            reviewedContentRefs: [...(reviewedByConcept.get(conceptRef) ?? [])],
          })),
        };
      },
    },
  };
}

function reteachDependencies(request: Wave2AdaptiveCompositionRequest): ReteachDependencies {
  return {
    hintInterventions: {
      recommend(value) {
        const kinds: readonly ReteachStepKind[] = [
          "review-model", "concept-cue", "guided-example", "guided-practice",
        ];
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          currentConceptRef: value.currentConceptRef,
          steps: request.reteachPolicy.reviewedContentRefs.map((reviewedContentRef, index) => ({
            stepRef: `reteach-step:wave2-${index + 1}`,
            sequence: index + 1,
            stepKind: kinds[index] ?? "guided-practice",
            conceptRef: value.currentConceptRef,
            reviewedContentRef,
          })),
        };
      },
    },
    reviewedContent: {
      lookup(value) {
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          purpose: "reteach",
          currentConceptRef: value.currentConceptRef,
          approvedContentRefs: [...value.candidateContentRefs],
        };
      },
    },
  };
}

function parentReason(
  hintStatus: "recommended" | "no-hint",
  interventionAction: string | null,
  repairStatus: "proposed" | "withheld",
  repairSource: "adaptive" | "reviewed-static-fallback" | "none",
  reteachStatus: "proposed" | "withheld",
  masteryRecommendation: string,
): ParentExplanationReasonCode {
  if (repairSource === "reviewed-static-fallback") return "tutor-unavailable-static-fallback-used";
  if (repairStatus === "proposed") return "prerequisite-review-suggested";
  if (reteachStatus === "proposed") return "reteach-suggested";
  if (interventionAction === "suggest-break") return "break-suggested";
  if (interventionAction === "escalate") return "adult-review-requested";
  if (hintStatus === "recommended") return "hint-level-changed";
  if (masteryRecommendation === "insufficient-evidence" || masteryRecommendation === "conflicting-evidence") {
    return "evidence-not-yet-strong-enough";
  }
  return "independent-practice-requested";
}

export async function composeWave2AdaptiveIntelligence(
  input: unknown,
  dependencies: Wave2AdaptiveCompositionDependencies,
): Promise<Wave2StudyDecisionPacket> {
  let request: Wave2AdaptiveCompositionRequest;
  try {
    const validation = validateExact(Wave2AdaptiveCompositionRequestSchema, input);
    if (validation.status === "rejected") return invalidFallback();
    request = structuredClone(validation.value);
  } catch {
    return invalidFallback();
  }

  if (!safetyBindingsAreValid(request)) {
    return safetyHeld(request, "safety-representation-conflict");
  }

  if (!compositionBindingsAreValid(request)) {
    if (request.studyAuthority.safetyStatus === "academic-flow-held") {
      return safetyHeld(request, "study-safety-held-binding-conflict");
    }
    return fallback(request, "cross-context-or-authority-binding-rejected", null);
  }

  let replayClaim: Awaited<ReturnType<Wave2ReplayLedgerPort["claim"]>>;
  try {
    replayClaim = await dependencies.replayLedger.claim(
      request.studyAuthority.eventRef,
      requestFingerprint(request),
    );
  } catch {
    if (request.studyAuthority.safetyStatus === "academic-flow-held") {
      return safetyHeld(request, "study-safety-held-replay-unavailable");
    }
    return fallback(request, "replay-ledger-unavailable", null);
  }
  if (replayClaim !== "claimed") {
    return {
      compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
      status: replayClaim === "duplicate" ? "duplicate-ignored" : "quarantined",
      eventRef: request.studyAuthority.eventRef,
      reasonCode: replayClaim === "duplicate" ? "duplicate-study-effect-prevented" : "event-identity-collision",
      ...AUTHORITY_BOUNDARY,
    };
  }

  if (request.studyAuthority.safetyStatus === "academic-flow-held") {
    return safetyHeld(request, "study-safety-held");
  }

  const subsystems = dependencies.adaptiveSubsystems ?? DEFAULT_ADAPTIVE_SUBSYSTEMS;
  const admissions = admissionsFor(request, subsystems);
  const refused = admissions.find(({ decision }) => decision.status === "refused");
  if (refused !== undefined) {
    return fallback(request, `admission-${refused.decision.reason}`, refused.feature);
  }

  const graph = subsystems.buildConceptGraph(request.conceptGraph);
  if (graph.status === "rejected") {
    return fallback(request, "invalid-concept-graph", "concept-prerequisite-graph");
  }
  const prerequisiteQuery = subsystems.queryConceptGraph(
    graph,
    request.studyAuthority.currentConceptRef,
  );
  if (prerequisiteQuery.status !== "found") {
    return fallback(request, "concept-query-rejected", "concept-prerequisite-graph");
  }

  const registry = subsystems.createMisconceptionRegistry(request.misconceptionRegistry);
  if (registry.status === "rejected") {
    return fallback(request, "invalid-misconception-registry", "misconception-analysis");
  }
  const misconception = subsystems.matchMisconception(registry, request.misconceptionMatch);
  if (
    misconception.reasonCodes.includes("CROSS_LEARNER_EVIDENCE") ||
    misconception.reasonCodes.includes("CROSS_CONTEXT_EVIDENCE") ||
    misconception.reasonCodes.includes("CROSS_CONCEPT_EVIDENCE")
  ) {
    return fallback(request, "misconception-scope-rejected", "misconception-analysis");
  }
  if (
    misconception.authoritativeDiagnosis ||
    misconception.authoritativeMasteryState ||
    misconception.durableLearnerClassificationAllowed
  ) {
    return fallback(request, "misconception-authority-rejected", "misconception-analysis");
  }

  let hintProjection: PendingStudyDecision["hint"];
  if (request.studyAuthority.allowedActions.includes("hint")) {
    const hint = subsystems.selectHint({
      ...request.hintSelection,
      misconceptionSignalCode: misconception.status === "possible-misconception"
        ? "academic-misconception-signal"
        : null,
    });
    if (hint.status === "rejected") {
      return fallback(request, "invalid-hint-state", "hint-ladder");
    }
    hintProjection = {
      status: hint.status,
      hintLevel: hint.hintLevel,
      reviewedContentRef: hint.hintMetadata?.reviewedContentRef ?? null,
      unrestrictedProviderProseAllowed: false,
    };
  } else {
    hintProjection = {
      status: "no-hint",
      hintLevel: "none",
      reviewedContentRef: null,
      unrestrictedProviderProseAllowed: false,
    };
  }

  const prerequisiteRef = misconception.status === "possible-misconception"
    ? misconception.prerequisiteConceptRefs[0] ?? prerequisiteQuery.conceptRefs[0]
    : prerequisiteQuery.conceptRefs[0];
  const intervention = subsystems.recommendIntervention({
    ...request.intervention,
    misconceptionSignal: misconception.status === "possible-misconception" &&
      misconception.misconceptionRef !== null
      ? { status: "suspected", hypothesisRef: misconception.misconceptionRef }
      : { status: "none", hypothesisRef: null },
    prerequisiteSignal: prerequisiteRef === undefined
      ? { status: "none", prerequisiteConceptRef: null }
      : { status: "suspected", prerequisiteConceptRef: prerequisiteRef },
    safetyRestriction: { status: "none", restrictionRef: null },
  });

  const mastery = subsystems.evaluateMastery(request.masteryEvidence);
  const binding: ProposalScopeBinding = {
    householdScopeRef: request.studyAuthority.householdScopeRef,
    learnerScopeRef: request.studyAuthority.learnerScopeRef,
    sessionRef: request.studyAuthority.sessionRef,
    invocationRef: request.studyAuthority.invocationBindingRef,
    subjectRef: request.studyAuthority.subjectRef,
    gradeRef: request.studyAuthority.gradeRef,
    curriculumRef: request.studyAuthority.curriculumBindingRef,
    workingLevelRef: request.studyAuthority.officialWorkingLevelRef,
  };
  const safety = { safetyHold: false, mayContinueAcademicFlow: true } as const;
  let repairProjection: PendingStudyDecision["repair"];
  if (request.studyAuthority.allowedActions.includes("check-prerequisite")) {
    const repair = await subsystems.proposeRepair({
      requestRef: `request:${request.studyAuthority.eventRef.replace(":", "-")}-repair`,
      binding,
      currentConceptRef: request.studyAuthority.currentConceptRef,
      assessmentPhase: request.studyAuthority.assessmentPhase,
      safety,
      maxRepairDepth: request.repairPolicy.maximumDepth,
      reviewedStaticFallback: request.repairPolicy.reviewedStaticFallback,
    }, repairDependencies(request, graph, misconception));
    repairProjection = {
      status: repair.status,
      proposalRef: repair.proposalRef,
      reasonCode: policyCode(repair.reasonCode),
      source: repair.source,
      recommendedConceptRefs: [...repair.recommendedRepairConceptRefs],
      reviewedContentRefs: [...repair.reviewedContentRefs],
      appliedRepairDepth: repair.appliedRepairDepth,
      workingLevelMutation: repair.authorityEffects.workingLevelMutation,
      masteryWrite: repair.authorityEffects.masteryWrite,
    };
  } else {
    repairProjection = {
      status: "withheld",
      proposalRef: "proposal:wave2-repair-withheld",
      reasonCode: "study-action-not-authorized",
      source: "none",
      recommendedConceptRefs: [],
      reviewedContentRefs: [],
      appliedRepairDepth: 0,
      workingLevelMutation: "none",
      masteryWrite: "none",
    };
  }

  let reteachProjection: PendingStudyDecision["reteach"];
  if (request.studyAuthority.allowedActions.includes("reteach")) {
    const reteach = await subsystems.proposeReteach({
      requestRef: `request:${request.studyAuthority.eventRef.replace(":", "-")}-reteach`,
      binding,
      currentConceptRef: request.studyAuthority.currentConceptRef,
      assessmentPhase: request.studyAuthority.assessmentPhase,
      safety,
      maxReteachSteps: request.reteachPolicy.maximumSteps,
      priorReteachLoops: request.reteachPolicy.priorReteachLoops,
      maxRepeatedLoops: request.reteachPolicy.maximumRepeatedLoops,
      reviewedStaticFallback: request.reteachPolicy.reviewedStaticFallback,
    }, reteachDependencies(request));
    reteachProjection = {
      status: reteach.status,
      proposalRef: reteach.proposalRef,
      reasonCode: policyCode(reteach.reasonCode),
      source: reteach.source,
      reviewedContentRefs: [...reteach.reviewedContentRefs],
      stepCount: reteach.steps.length,
      answerAuthority: reteach.answerAuthority,
      activeAssessmentBypass: reteach.activeAssessmentBypass,
      workingLevelMutation: reteach.authorityEffects.workingLevelMutation,
      masteryWrite: reteach.authorityEffects.masteryWrite,
    };
  } else {
    reteachProjection = {
      status: "withheld",
      proposalRef: "proposal:wave2-reteach-withheld",
      reasonCode: "study-action-not-authorized",
      source: "none",
      reviewedContentRefs: [],
      stepCount: 0,
      answerAuthority: "none",
      activeAssessmentBypass: false,
      workingLevelMutation: "none",
      masteryWrite: "none",
    };
  }

  const interventionAction = intervention.status === "recommended"
    ? intervention.recommendation.actionKind
    : null;
  const interventionReason = intervention.status === "recommended"
    ? intervention.recommendation.reasonCode
    : intervention.code;
  const masterySampleCount = mastery.evaluationStatus === "summarized"
    ? mastery.sampleCount
    : 0;
  let parentExplanation: PendingStudyDecision["parentExplanation"] = null;
  if (request.parentWhy !== null) {
    const explanation = subsystems.explainParent({
      requestKind: "parent-hub-why",
      scope: {
        selectedLearnerRef: request.parentWhy.selectedLearnerRef,
        authorizedLearnerRef: request.parentWhy.authorizedLearnerRef,
      },
      recommendation: {
        learnerRef: request.studyAuthority.learnerScopeRef,
        recommendationRef: request.parentWhy.recommendationRef,
        reasonCode: parentReason(
          hintProjection.status,
          interventionAction,
          repairProjection.status,
          repairProjection.source,
          reteachProjection.status,
          mastery.recommendation,
        ),
        provenance: {
          producer: "study-engine",
          recommendationEventRef: request.parentWhy.recommendationEventRef,
          policyRef: request.parentWhy.policyRef,
          producedAt: request.parentWhy.producedAt,
        },
      },
    });
    if (explanation.status === "rejected") {
      return fallback(request, "parent-explanation-rejected", "parent-explanation");
    }
    parentExplanation = {
      reasonCode: explanation.value.reasonCode,
      title: explanation.value.title,
      explanation: explanation.value.explanation,
      disclaimer: explanation.value.disclaimer,
      recommendationRef: explanation.value.provenance.recommendationRef,
      producedAt: explanation.value.provenance.producedAt,
    };
  }

  return {
    compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
    status: "pending-study-decision",
    eventRef: request.studyAuthority.eventRef,
    admissions: admissions.map(({ feature, decision }) => ({
      feature,
      status: decision.status,
      reason: policyCode(decision.reason),
    })),
    concept: {
      status: "accepted",
      currentConceptRef: request.studyAuthority.currentConceptRef,
      directPrerequisiteRefs: [...prerequisiteQuery.conceptRefs],
    },
    misconception: {
      status: misconception.status,
      academicMisconceptionCode: misconception.academicMisconceptionCode,
      possibleInstructionalSignalOnly: true,
      authoritativeDiagnosis: false,
      durableLearnerClassificationAllowed: false,
    },
    hint: hintProjection,
    intervention: {
      status: intervention.status,
      actionKind: interventionAction,
      reasonCode: policyCode(interventionReason),
      tutorMayExecute: false,
      studyMutationAllowed: false,
    },
    mastery: {
      evaluationStatus: mastery.evaluationStatus,
      recommendation: mastery.recommendation,
      sampleCount: masterySampleCount,
      authoritative: false,
      studyMutationAllowed: false,
    },
    repair: repairProjection,
    reteach: reteachProjection,
    parentExplanation,
    ...AUTHORITY_BOUNDARY,
  };
}
