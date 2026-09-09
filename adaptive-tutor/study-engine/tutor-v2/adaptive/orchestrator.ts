import { createHash } from "node:crypto";
import type { TSchema } from "../../../core/schema/typebox.js";
import {
  ADAPTIVE_FEATURES,
  evaluateAdaptiveAdmission,
  type AdaptiveAdmissionDecision,
  type AdaptiveFeature,
} from "../../../core/v2/admission/index.js";
import {
  buildConceptGraph,
  ConceptPrerequisiteGraph,
} from "../../../core/v2/concepts/index.js";
import {
  ACADEMIC_MISCONCEPTION_REGISTRY_VERSION,
  AcademicMisconceptionSignalResultSchema,
  createAcademicMisconceptionRegistry,
  type AcademicMisconceptionSignalResult,
  type SerializedAcademicMisconceptionSignal,
} from "../../../core/v2/misconceptions/index.js";
import {
  HintSelectionResultSchema,
  selectBoundedHint,
} from "../../../core/v2/hints/index.js";
import {
  InterventionLadderResultSchema,
  recommendNextIntervention,
} from "../../../core/v2/interventions/index.js";
import {
  evaluateMasteryEvidence,
  MasteryEvidenceEvaluationSchema,
} from "../../../core/v2/mastery/index.js";
import {
  validateExact,
  type AssistanceLevel,
  type HintLevel,
  type TutorActionKind,
} from "../../../core/v2/contracts/index.js";
import {
  explainTutorRecommendationForParentHub,
  ParentExplanationSchema,
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
  Wave2AdaptiveAdmissionDecisionSchema,
  Wave2AdaptiveCompositionRequestSchema,
  Wave2ConceptQueryResultSchema,
  Wave2PrerequisiteRepairProposalSchema,
  Wave2ReteachPlanProposalSchema,
  Wave2StudyDecisionPacketSchema,
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

function isSemanticSetPath(path: readonly string[]): boolean {
  const joined = path.join(".");
  return joined === "studyAuthority.allowedActions" ||
    joined === "intervention.allowedActions" ||
    joined === "reviewedContentAdmissions" ||
    joined === "capabilityMetadata.capabilities" ||
    joined === "capabilityMetadata.capabilities.[].actionFamilies";
}

function canonicalize(value: unknown, path: readonly string[] = []): unknown {
  if (Array.isArray(value)) {
    const children = value.map((child) => canonicalize(child, [...path, "[]"]));
    return isSemanticSetPath(path)
      ? children.sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)))
      : children;
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child, [...path, key])]),
  );
}

function requestDigest(request: Wave2AdaptiveCompositionRequest): string {
  const canonicalRequest = JSON.stringify(canonicalize(request));
  return `sha256:${createHash("sha256").update(canonicalRequest).digest("hex")}`;
}

const INVALID_SUBSYSTEM_RESULT = Symbol("invalid-wave2-subsystem-result");

function snapshotSubsystemResult(value: unknown): unknown {
  const ancestors = new Set<object>();
  const snapshot = (candidate: unknown): unknown => {
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "number" ||
      typeof candidate === "boolean"
    ) return candidate;
    if (typeof candidate !== "object" || ancestors.has(candidate)) {
      throw new TypeError("Subsystem result is not closed JSON data.");
    }
    ancestors.add(candidate);
    try {
      const prototype = Object.getPrototypeOf(candidate);
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      const ownKeys = Reflect.ownKeys(candidate);
      if (Array.isArray(candidate)) {
        if (prototype !== Array.prototype) throw new TypeError("Invalid array prototype.");
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || (length as number) < 0) {
          throw new TypeError("Invalid array length.");
        }
        if (ownKeys.some((key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(?:0|[1-9][0-9]*)$/.test(key)))) {
          throw new TypeError("Invalid array key.");
        }
        const result: unknown[] = [];
        for (let index = 0; index < (length as number); index += 1) {
          const descriptor = descriptors[String(index)];
          if (
            descriptor === undefined ||
            descriptor.get !== undefined ||
            descriptor.set !== undefined ||
            !("value" in descriptor)
          ) throw new TypeError("Sparse or accessor array result.");
          result.push(snapshot(descriptor.value));
        }
        return result;
      }
      if (prototype !== Object.prototype) throw new TypeError("Invalid object prototype.");
      if (ownKeys.some((key) => typeof key !== "string")) {
        throw new TypeError("Symbol subsystem result keys are not allowed.");
      }
      const result: Record<string, unknown> = {};
      for (const key of ownKeys as string[]) {
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined ||
          !("value" in descriptor)
        ) throw new TypeError("Accessor subsystem result.");
        result[key] = snapshot(descriptor.value);
      }
      return result;
    } finally {
      ancestors.delete(candidate);
    }
  };
  return snapshot(value);
}

function validateSubsystemResult<const T extends TSchema>(schema: T, value: unknown) {
  try {
    return validateExact(schema, snapshotSubsystemResult(value));
  } catch {
    return validateExact(schema, INVALID_SUBSYSTEM_RESULT);
  }
}

function exactDataRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (!keys.every((key) => {
      const descriptor = descriptors[key];
      return descriptor !== undefined && descriptor.get === undefined &&
        descriptor.set === undefined && "value" in descriptor;
    })) return null;
    return Object.fromEntries(keys.map((key) => [key, descriptors[key]?.value]));
  } catch {
    return null;
  }
}

function acceptedConceptGraph(value: unknown): AcceptedConceptGraph | null {
  const result = exactDataRecord(value, ["status", "graph"]);
  if (result === null) return null;
  return result.status === "accepted" && result.graph instanceof ConceptPrerequisiteGraph
    ? { status: "accepted", graph: result.graph } as AcceptedConceptGraph
    : null;
}

function acceptedMisconceptionRegistry(value: unknown): AcceptedMisconceptionRegistry | null {
  const result = exactDataRecord(value, ["status", "registry"]);
  if (result === null || result.status !== "ready") return null;
  const registry = exactDataRecord(result.registry, [
    "version",
    "entryCount",
    "match",
    "reviewSerializedSignal",
  ]);
  if (registry === null) return null;
  if (
    registry.version !== ACADEMIC_MISCONCEPTION_REGISTRY_VERSION ||
    !Number.isSafeInteger(registry.entryCount) ||
    (registry.entryCount as number) < 0 ||
    typeof registry.match !== "function" ||
    typeof registry.reviewSerializedSignal !== "function"
  ) return null;
  return {
    status: "ready",
    registry: {
      version: ACADEMIC_MISCONCEPTION_REGISTRY_VERSION,
      entryCount: registry.entryCount as number,
      match: registry.match as AcceptedMisconceptionRegistry["registry"]["match"],
      reviewSerializedSignal: registry.reviewSerializedSignal as
        AcceptedMisconceptionRegistry["registry"]["reviewSerializedSignal"],
    },
  };
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

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
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
    request.hintSelection.learnerScopeRef !== authority.learnerScopeRef ||
    request.hintSelection.sessionRef !== authority.sessionRef ||
    request.hintSelection.contextRef !== authority.instructionalContextRef ||
    request.hintSelection.currentOpportunityRef !== authority.currentOpportunityRef ||
    request.hintSelection.assessmentPhase !== authority.assessmentPhase ||
    request.hintSelection.studyHintCeiling !== authority.studyHintCeiling ||
    request.hintSelection.misconceptionSignalCode !== null ||
    request.hintSelection.interventionHistory.some((entry) =>
      entry.learnerScopeRef !== authority.learnerScopeRef ||
      entry.sessionRef !== authority.sessionRef ||
      entry.contextRef !== authority.instructionalContextRef
    )
  ) return false;

  if (
    request.intervention.learnerScopeRef !== authority.learnerScopeRef ||
    request.intervention.sessionRef !== authority.sessionRef ||
    request.intervention.instructionalContextRef !== authority.instructionalContextRef ||
    request.intervention.currentOpportunityRef !== authority.currentOpportunityRef ||
    request.intervention.interactionRef !== authority.interactionRef ||
    request.intervention.assessmentPhase !== authority.assessmentPhase ||
    !sameStringSet(request.intervention.allowedActions, authority.allowedActions) ||
    request.intervention.misconceptionSignal.status !== "none" ||
    request.intervention.prerequisiteSignal.status !== "none" ||
    request.intervention.assistanceHistory.some((entry) =>
      entry.learnerScopeRef !== authority.learnerScopeRef ||
      entry.sessionRef !== authority.sessionRef ||
      entry.instructionalContextRef !== authority.instructionalContextRef
    )
  ) return false;

  if (
    request.masteryEvidence.learnerScopeRef !== authority.learnerScopeRef ||
    request.masteryEvidence.conceptRef !== authority.currentConceptRef ||
    request.masteryEvidence.currentSessionRef !== authority.sessionRef ||
    request.masteryEvidence.currentInstructionalContextRef !== authority.instructionalContextRef ||
    request.masteryEvidence.currentOpportunityRef !== authority.currentOpportunityRef ||
    request.masteryEvidence.evidence.some((item) =>
      item.learnerScopeRef !== authority.learnerScopeRef ||
      item.conceptRef !== authority.currentConceptRef ||
      (item.opportunityRef === authority.currentOpportunityRef && (
        item.sessionRef !== authority.sessionRef ||
        item.instructionalContextRef !== authority.instructionalContextRef
      ))
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
    parent.recommendationEventRef !== authority.eventRef ||
    parent.guardianVisibilityAuthorization.householdScopeRef !==
      authority.householdScopeRef ||
    parent.guardianVisibilityAuthorization.learnerScopeRef !==
      authority.learnerScopeRef ||
    parent.guardianVisibilityAuthorization.sessionRef !== authority.sessionRef ||
    parent.guardianVisibilityAuthorization.instructionalContextRef !==
      authority.instructionalContextRef ||
    parent.guardianVisibilityAuthorization.currentOpportunityRef !==
      authority.currentOpportunityRef
  )) return false;
  return true;
}

const ASSISTANCE_ORDER: readonly AssistanceLevel[] = [
  "independent",
  "light-hint",
  "guided",
  "reteach-required",
];

function mostAssisted(
  left: AssistanceLevel,
  right: AssistanceLevel,
): AssistanceLevel {
  return ASSISTANCE_ORDER.indexOf(left) >= ASSISTANCE_ORDER.indexOf(right)
    ? left
    : right;
}

function hintAssistance(level: HintLevel): AssistanceLevel {
  if (level === "none") return "independent";
  if (level === "nudge" || level === "concept-cue") return "light-hint";
  return "guided";
}

function interventionAssistance(action: TutorActionKind): AssistanceLevel {
  if (action === "reteach") return "reteach-required";
  if (action === "check-prerequisite" || action === "show-example") return "guided";
  if (action === "hint" || action === "explain") return "light-hint";
  return "independent";
}

function effectiveCurrentOpportunityAssistance(
  request: Wave2AdaptiveCompositionRequest,
  currentHintLevel: HintLevel,
): AssistanceLevel {
  const opportunityRef = request.studyAuthority.currentOpportunityRef;
  let effective = mostAssisted(
    request.hintSelection.previousAssistanceLevel,
    hintAssistance(currentHintLevel),
  );
  for (const entry of request.hintSelection.interventionHistory) {
    if (entry.opportunityRef === opportunityRef) {
      effective = mostAssisted(effective, entry.assistanceLevel);
    }
  }
  for (const entry of request.intervention.assistanceHistory) {
    if (entry.opportunityRef === opportunityRef) {
      effective = mostAssisted(effective, interventionAssistance(entry.actionKind));
    }
  }
  return effective;
}

function admissionsFor(
  request: Wave2AdaptiveCompositionRequest,
  subsystems: Wave2AdaptiveSubsystems,
):
  | {
    readonly status: "ready";
    readonly admissions: readonly {
      readonly feature: AdaptiveFeature;
      readonly decision: AdaptiveAdmissionDecision;
    }[];
  }
  | { readonly status: "unavailable"; readonly failedFeature: AdaptiveFeature } {
  const features = request.parentWhy === null
    ? REQUIRED_FEATURES
    : ADAPTIVE_FEATURES;
  const admissions: {
    readonly feature: AdaptiveFeature;
    readonly decision: AdaptiveAdmissionDecision;
  }[] = [];
  for (const feature of features) {
    const reviewed = request.reviewedContentAdmissions.find(
      (entry) => entry.feature === feature,
    );
    let decision: AdaptiveAdmissionDecision;
    try {
      const rawDecision: unknown = subsystems.evaluateAdmission({
        inputKind: "study-adaptive-admission",
        request: {
          requestVersion: "study-tutor-v2.adaptive-admission.v2",
          requestKind: "study-adaptive-admission-request",
          invocationBindingRef: request.studyAuthority.invocationBindingRef,
          householdScopeRef: request.studyAuthority.householdScopeRef,
          learnerScopeRef: request.studyAuthority.learnerScopeRef,
          sessionRef: request.studyAuthority.sessionRef,
          instructionalContextRef: request.studyAuthority.instructionalContextRef,
          subjectRef: request.studyAuthority.subjectRef,
          curriculumBindingRef: request.studyAuthority.curriculumBindingRef,
          feature,
          actionFamily: ACTION_FAMILY[feature],
          reviewedContentAdmission: reviewed?.admission ?? "not-admitted",
        },
        capabilityMetadata: request.capabilityMetadata,
      });
      const validation = validateSubsystemResult(
        Wave2AdaptiveAdmissionDecisionSchema,
        rawDecision,
      );
      if (validation.status === "rejected") {
        return { status: "unavailable", failedFeature: feature };
      }
      decision = validation.value as AdaptiveAdmissionDecision;
      if (decision.status === "admitted" && (
        decision.invocationBindingRef !== request.studyAuthority.invocationBindingRef ||
        decision.householdScopeRef !== request.studyAuthority.householdScopeRef ||
        decision.learnerScopeRef !== request.studyAuthority.learnerScopeRef ||
        decision.sessionRef !== request.studyAuthority.sessionRef ||
        decision.instructionalContextRef !==
          request.studyAuthority.instructionalContextRef ||
        decision.subjectRef !== request.studyAuthority.subjectRef ||
        decision.curriculumBindingRef !== request.studyAuthority.curriculumBindingRef ||
        decision.feature !== feature ||
        decision.actionFamily !== ACTION_FAMILY[feature]
      )) return { status: "unavailable", failedFeature: feature };
    } catch {
      return { status: "unavailable", failedFeature: feature };
    }
    admissions.push({ feature, decision });
  }
  return { status: "ready", admissions };
}

function repairDependencies(
  request: Wave2AdaptiveCompositionRequest,
  graph: AcceptedConceptGraph,
  trustedPrerequisiteRefs: readonly string[],
): PrerequisiteRepairDependencies {
  const scopeByConcept = new Map(
    request.conceptScopeBindings.map((scope) => [scope.conceptRef, scope]),
  );
  const reviewedByConcept = new Map(
    request.repairPolicy.reviewedContent.map((entry) => [entry.conceptRef, entry.reviewedContentRefs]),
  );
  const routeIsCompatible = (conceptRef: string): boolean => {
    const scope = scopeByConcept.get(conceptRef);
    return scope !== undefined &&
      scope.subjectRef === request.studyAuthority.subjectRef &&
      scope.gradeRef === request.studyAuthority.gradeRef &&
      scope.curriculumRef === request.studyAuthority.curriculumBindingRef;
  };
  return {
    prerequisiteGraph: {
      lookup(value) {
        const result = graph.graph.directPrerequisites(value.conceptRef);
        if (result.status !== "found") throw new Error("Concept lookup unavailable");
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          conceptRef: value.conceptRef,
          prerequisites: result.conceptRefs.filter(routeIsCompatible).map((conceptRef) => {
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
        const status = trustedPrerequisiteRefs.length > 0 ? "suspected" : "clear";
        return {
          requestRef: value.requestRef,
          binding: value.binding,
          currentConceptRef: value.currentConceptRef,
          status,
          suspectedPrerequisiteRefs: status === "suspected" ? [...trustedPrerequisiteRefs] : [],
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
  interventionAction: string | null,
  repairSource: "adaptive" | "reviewed-static-fallback" | "none",
  masteryRecommendation: string,
): ParentExplanationReasonCode {
  if (interventionAction === "check-prerequisite") {
    return repairSource === "reviewed-static-fallback"
      ? "tutor-unavailable-static-fallback-proposed"
      : "prerequisite-review-suggested";
  }
  if (interventionAction === "reteach") return "reteach-suggested";
  if (interventionAction === "hint") return "hint-level-change-proposed";
  if (interventionAction === "suggest-break") return "break-suggested";
  if (interventionAction === "escalate") return "adult-review-requested";
  if (interventionAction === "return-to-lesson") return "independent-practice-requested";
  if (masteryRecommendation === "insufficient-evidence" || masteryRecommendation === "conflicting-evidence") {
    return "evidence-not-yet-strong-enough";
  }
  return "independent-practice-requested";
}

async function commitReplayProtectedDecision(
  request: Wave2AdaptiveCompositionRequest,
  dependencies: Wave2AdaptiveCompositionDependencies,
  decision: Wave2StudyDecisionPacket,
): Promise<Wave2StudyDecisionPacket> {
  let replayClaim: unknown;
  try {
    replayClaim = await dependencies.replayLedger.claim(
      request.studyAuthority.eventRef,
      requestDigest(request),
    );
  } catch {
    return request.studyAuthority.safetyStatus === "academic-flow-held"
      ? safetyHeld(request, "study-safety-held-replay-unavailable")
      : fallback(request, "replay-ledger-unavailable", null);
  }

  if (replayClaim === "claimed") return decision;
  if (replayClaim === "duplicate" || replayClaim === "collision") {
    return {
      compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
      status: replayClaim === "duplicate" ? "duplicate-ignored" : "quarantined",
      eventRef: request.studyAuthority.eventRef,
      reasonCode: replayClaim === "duplicate"
        ? "duplicate-study-effect-prevented"
        : "event-identity-collision",
      ...AUTHORITY_BOUNDARY,
    };
  }

  return request.studyAuthority.safetyStatus === "academic-flow-held"
    ? safetyHeld(request, "study-safety-held-replay-unavailable")
    : fallback(request, "replay-ledger-unavailable", null);
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

  if (request.studyAuthority.safetyStatus === "academic-flow-held") {
    return commitReplayProtectedDecision(
      request,
      dependencies,
      safetyHeld(request, "study-safety-held"),
    );
  }

  const subsystems = dependencies.adaptiveSubsystems ?? DEFAULT_ADAPTIVE_SUBSYSTEMS;
  const admissionResult = admissionsFor(request, subsystems);
  if (admissionResult.status === "unavailable") {
    return fallback(request, "adaptive-admission-unavailable", admissionResult.failedFeature);
  }
  const admissions = admissionResult.admissions;
  const refused = admissions.find(({ decision }) => decision.status === "refused");
  if (refused !== undefined) {
    return fallback(request, `admission-${refused.decision.reason}`, refused.feature);
  }

  let graph: AcceptedConceptGraph;
  try {
    const rawGraph: unknown = subsystems.buildConceptGraph(request.conceptGraph);
    const accepted = acceptedConceptGraph(rawGraph);
    if (accepted === null) {
      return fallback(request, "invalid-concept-graph", "concept-prerequisite-graph");
    }
    graph = accepted;
  } catch {
    return fallback(request, "concept-graph-unavailable", "concept-prerequisite-graph");
  }
  let prerequisiteQuery: Extract<
    ReturnType<Wave2AdaptiveSubsystems["queryConceptGraph"]>,
    { readonly status: "found" }
  >;
  try {
    const rawQuery: unknown = subsystems.queryConceptGraph(
      graph,
      request.studyAuthority.currentConceptRef,
    );
    const validation = validateSubsystemResult(Wave2ConceptQueryResultSchema, rawQuery);
    if (
      validation.status === "rejected" ||
      validation.value.status !== "found" ||
      new Set(validation.value.conceptRefs).size !== validation.value.conceptRefs.length
    ) return fallback(request, "concept-query-rejected", "concept-prerequisite-graph");
    prerequisiteQuery = validation.value;
  } catch {
    return fallback(request, "concept-query-unavailable", "concept-prerequisite-graph");
  }

  let registry: AcceptedMisconceptionRegistry;
  try {
    const rawRegistry: unknown = subsystems.createMisconceptionRegistry(
      request.misconceptionRegistry,
    );
    const accepted = acceptedMisconceptionRegistry(rawRegistry);
    if (
      accepted === null ||
      accepted.registry.entryCount !== request.misconceptionRegistry.length
    ) return fallback(request, "invalid-misconception-registry", "misconception-analysis");
    registry = accepted;
  } catch {
    return fallback(request, "misconception-registry-unavailable", "misconception-analysis");
  }
  let misconception: AcademicMisconceptionSignalResult;
  try {
    const rawMisconception: unknown = subsystems.matchMisconception(
      registry,
      request.misconceptionMatch,
    );
    const validation = validateSubsystemResult(
      AcademicMisconceptionSignalResultSchema,
      rawMisconception,
    );
    if (validation.status === "rejected") {
      return fallback(request, "misconception-match-unavailable", "misconception-analysis");
    }
    misconception = validation.value;
  } catch {
    return fallback(request, "misconception-match-unavailable", "misconception-analysis");
  }
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

  if (
    misconception.conceptRef !== null &&
    misconception.conceptRef !== request.studyAuthority.currentConceptRef
  ) return fallback(request, "misconception-scope-rejected", "misconception-analysis");

  let misconceptionProjectionCandidate: SerializedAcademicMisconceptionSignal;
  if (misconception.status === "possible-misconception") {
    if (
      misconception.misconceptionRef === null ||
      misconception.academicMisconceptionCode === null
    ) {
      return fallback(
        request,
        "misconception-serialization-rejected",
        "misconception-analysis",
      );
    }
    misconceptionProjectionCandidate = {
        status: "possible-misconception",
        misconceptionRef: misconception.misconceptionRef,
        academicMisconceptionCode: misconception.academicMisconceptionCode,
        possibleInstructionalSignalOnly: true,
        authoritativeDiagnosis: false,
        authoritativeMasteryState: false,
        durableLearnerClassificationAllowed: false,
    };
  } else {
    misconceptionProjectionCandidate = {
      status: misconception.status,
      misconceptionRef: null,
      academicMisconceptionCode: null,
      possibleInstructionalSignalOnly: true,
      authoritativeDiagnosis: false,
      authoritativeMasteryState: false,
      durableLearnerClassificationAllowed: false,
    };
  }
  const serializedMisconception = registry.registry.reviewSerializedSignal(
    misconceptionProjectionCandidate,
  );
  if (serializedMisconception.status === "rejected") {
    return fallback(
      request,
      "misconception-serialization-rejected",
      "misconception-analysis",
    );
  }

  const scopeByConcept = new Map(
    request.conceptScopeBindings.map((scope) => [scope.conceptRef, scope]),
  );
  const routeIsCompatible = (conceptRef: string): boolean => {
    const scope = scopeByConcept.get(conceptRef);
    return scope !== undefined &&
      scope.subjectRef === request.studyAuthority.subjectRef &&
      scope.gradeRef === request.studyAuthority.gradeRef &&
      scope.curriculumRef === request.studyAuthority.curriculumBindingRef;
  };
  const scopedPrerequisiteRefs = prerequisiteQuery.conceptRefs.filter(routeIsCompatible);
  const trustedPrerequisiteRefs = misconception.status === "possible-misconception"
    ? misconception.prerequisiteConceptRefs.filter((conceptRef) =>
      scopedPrerequisiteRefs.includes(conceptRef) && routeIsCompatible(conceptRef))
    : [];
  const prerequisiteRef = trustedPrerequisiteRefs[0];

  let intervention: ReturnType<Wave2AdaptiveSubsystems["recommendIntervention"]>;
  try {
    const rawIntervention: unknown = subsystems.recommendIntervention({
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
    const validation = validateSubsystemResult(
      InterventionLadderResultSchema,
      rawIntervention,
    );
    if (validation.status === "rejected") {
      return fallback(request, "intervention-ladder-unavailable", "intervention-ladder");
    }
    intervention = validation.value;
    if (intervention.status === "recommended" && (
      intervention.recommendation.interactionRef !== request.studyAuthority.interactionRef ||
      !request.studyAuthority.allowedActions.includes(intervention.recommendation.actionKind)
    )) return fallback(request, "invalid-intervention-state", "intervention-ladder");
  } catch {
    return fallback(request, "intervention-ladder-unavailable", "intervention-ladder");
  }

  const interventionAction = intervention.status === "recommended"
    ? intervention.recommendation.actionKind
    : null;
  const interventionReason = intervention.status === "recommended"
    ? intervention.recommendation.reasonCode
    : intervention.code;

  let hintProjection: PendingStudyDecision["hint"] = {
    status: "no-hint",
    hintLevel: "none",
    reviewedContentRef: null,
    unrestrictedProviderProseAllowed: false,
  };
  if (interventionAction === "hint") {
    try {
      const rawHint: unknown = subsystems.selectHint({
        ...request.hintSelection,
        misconceptionSignalCode: misconception.status === "possible-misconception"
          ? "academic-misconception-signal"
          : null,
      });
      const validation = validateSubsystemResult(HintSelectionResultSchema, rawHint);
      if (validation.status === "rejected" || validation.value.status === "rejected") {
        return fallback(request, "invalid-hint-state", "hint-ladder");
      }
      const hint = validation.value;
      if (hint.status === "recommended" && !request.hintSelection.reviewedHints.some(
        (reviewed) =>
          reviewed.hintRef === hint.hintMetadata.hintRef &&
          reviewed.reviewedContentRef === hint.hintMetadata.reviewedContentRef &&
          reviewed.reviewRef === hint.hintMetadata.reviewRef &&
          reviewed.hintLevel === hint.hintMetadata.hintLevel,
      )) return fallback(request, "invalid-hint-state", "hint-ladder");
      hintProjection = {
        status: hint.status,
        hintLevel: hint.hintLevel,
        reviewedContentRef: hint.hintMetadata?.reviewedContentRef ?? null,
        unrestrictedProviderProseAllowed: false,
      };
    } catch {
      return fallback(request, "hint-ladder-unavailable", "hint-ladder");
    }
  }

  const effectiveAssistance = effectiveCurrentOpportunityAssistance(
    request,
    hintProjection.hintLevel,
  );
  if (
    request.masteryEvidence.currentOpportunityAssistanceLevel !== effectiveAssistance
  ) {
    return fallback(
      request,
      "current-opportunity-assistance-binding-rejected",
      "mastery-evidence",
    );
  }
  let mastery: ReturnType<Wave2AdaptiveSubsystems["evaluateMastery"]>;
  try {
    const rawMastery: unknown = subsystems.evaluateMastery({
      ...request.masteryEvidence,
      currentSessionRef: request.studyAuthority.sessionRef,
      currentInstructionalContextRef: request.studyAuthority.instructionalContextRef,
      currentOpportunityRef: request.studyAuthority.currentOpportunityRef,
      currentOpportunityAssistanceLevel: effectiveAssistance,
    });
    const validation = validateSubsystemResult(MasteryEvidenceEvaluationSchema, rawMastery);
    if (validation.status === "rejected") {
      return fallback(request, "mastery-evidence-unavailable", "mastery-evidence");
    }
    mastery = validation.value;
    if (mastery.evaluationStatus === "summarized" && (
      mastery.learnerScopeRef !== request.studyAuthority.learnerScopeRef ||
      mastery.conceptRef !== request.studyAuthority.currentConceptRef
    )) return fallback(request, "invalid-mastery-evidence", "mastery-evidence");
  } catch {
    return fallback(request, "mastery-evidence-unavailable", "mastery-evidence");
  }
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
  if (interventionAction === "check-prerequisite") {
    let repair: Awaited<ReturnType<Wave2AdaptiveSubsystems["proposeRepair"]>>;
    const repairRequestRef = `request:${request.studyAuthority.eventRef.replace(":", "-")}-repair`;
    try {
      const rawRepair: unknown = await subsystems.proposeRepair({
        requestRef: repairRequestRef,
        binding,
        currentConceptRef: request.studyAuthority.currentConceptRef,
        assessmentPhase: request.studyAuthority.assessmentPhase,
        safety,
        maxRepairDepth: request.repairPolicy.maximumDepth,
        reviewedStaticFallback: request.repairPolicy.reviewedStaticFallback,
      }, repairDependencies(request, graph, trustedPrerequisiteRefs));
      const validation = validateSubsystemResult(
        Wave2PrerequisiteRepairProposalSchema,
        rawRepair,
      );
      if (validation.status === "rejected") {
        return fallback(request, "prerequisite-repair-unavailable", "prerequisite-repair");
      }
      repair = validation.value;
      const allowedRepairContentRefs = new Set([
        ...request.repairPolicy.reviewedStaticFallback.reviewedContentRefs,
        ...request.repairPolicy.reviewedContent.flatMap((entry) => entry.reviewedContentRefs),
      ]);
      if (
        repair.requestRef !== repairRequestRef ||
        repair.currentConceptRef !== request.studyAuthority.currentConceptRef ||
        repair.suspectedMissingPrerequisiteRefs.some((ref) => !routeIsCompatible(ref)) ||
        repair.recommendedRepairConceptRefs.some((ref) => !routeIsCompatible(ref)) ||
        repair.reviewedContentRefs.some((ref) => !allowedRepairContentRefs.has(ref))
      ) return fallback(request, "invalid-prerequisite-repair", "prerequisite-repair");
    } catch {
      return fallback(request, "prerequisite-repair-unavailable", "prerequisite-repair");
    }
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
      reasonCode: request.studyAuthority.allowedActions.includes("check-prerequisite")
        ? "primary-adaptive-action-not-selected"
        : "study-action-not-authorized",
      source: "none",
      recommendedConceptRefs: [],
      reviewedContentRefs: [],
      appliedRepairDepth: 0,
      workingLevelMutation: "none",
      masteryWrite: "none",
    };
  }

  let reteachProjection: PendingStudyDecision["reteach"];
  if (interventionAction === "reteach") {
    let reteach: Awaited<ReturnType<Wave2AdaptiveSubsystems["proposeReteach"]>>;
    const reteachRequestRef = `request:${request.studyAuthority.eventRef.replace(":", "-")}-reteach`;
    try {
      const rawReteach: unknown = await subsystems.proposeReteach({
        requestRef: reteachRequestRef,
        binding,
        currentConceptRef: request.studyAuthority.currentConceptRef,
        assessmentPhase: request.studyAuthority.assessmentPhase,
        safety,
        maxReteachSteps: request.reteachPolicy.maximumSteps,
        priorReteachLoops: request.reteachPolicy.priorReteachLoops,
        maxRepeatedLoops: request.reteachPolicy.maximumRepeatedLoops,
        reviewedStaticFallback: request.reteachPolicy.reviewedStaticFallback,
      }, reteachDependencies(request));
      const validation = validateSubsystemResult(Wave2ReteachPlanProposalSchema, rawReteach);
      if (validation.status === "rejected") {
        return fallback(request, "reteach-unavailable", "reteach");
      }
      reteach = validation.value;
      const allowedReteachContentRefs = new Set([
        ...request.reteachPolicy.reviewedContentRefs,
        ...request.reteachPolicy.reviewedStaticFallback.reviewedContentRefs,
      ]);
      if (
        reteach.requestRef !== reteachRequestRef ||
        reteach.currentConceptRef !== request.studyAuthority.currentConceptRef ||
        reteach.steps.some((step) =>
          step.conceptRef !== request.studyAuthority.currentConceptRef ||
          !allowedReteachContentRefs.has(step.reviewedContentRef)) ||
        reteach.reviewedContentRefs.some((ref) => !allowedReteachContentRefs.has(ref))
      ) return fallback(request, "invalid-reteach-plan", "reteach");
    } catch {
      return fallback(request, "reteach-unavailable", "reteach");
    }
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
      reasonCode: request.studyAuthority.allowedActions.includes("reteach")
        ? "primary-adaptive-action-not-selected"
        : "study-action-not-authorized",
      source: "none",
      reviewedContentRefs: [],
      stepCount: 0,
      answerAuthority: "none",
      activeAssessmentBypass: false,
      workingLevelMutation: "none",
      masteryWrite: "none",
    };
  }

  const masterySampleCount = mastery.evaluationStatus === "summarized"
    ? mastery.sampleCount
    : 0;
  let parentExplanation: PendingStudyDecision["parentExplanation"] = null;
  if (request.parentWhy !== null) {
    const explanationReason = parentReason(
      interventionAction,
      repairProjection.source,
      mastery.recommendation,
    );
    try {
      const rawExplanation: unknown = subsystems.explainParent({
        requestKind: "parent-hub-why",
        scope: {
          householdScopeRef: request.studyAuthority.householdScopeRef,
          selectedLearnerRef: request.parentWhy.selectedLearnerRef,
          authorizedLearnerRef: request.parentWhy.authorizedLearnerRef,
          sessionRef: request.studyAuthority.sessionRef,
          instructionalContextRef: request.studyAuthority.instructionalContextRef,
          currentOpportunityRef: request.studyAuthority.currentOpportunityRef,
        },
        recommendation: {
          learnerRef: request.studyAuthority.learnerScopeRef,
          recommendationRef: request.parentWhy.recommendationRef,
          reasonCode: explanationReason,
          provenance: {
            producer: "study-engine",
            recommendationEventRef: request.parentWhy.recommendationEventRef,
            policyRef: request.parentWhy.policyRef,
            producedAt: request.parentWhy.producedAt,
            scope: {
              householdScopeRef: request.studyAuthority.householdScopeRef,
              learnerScopeRef: request.studyAuthority.learnerScopeRef,
              sessionRef: request.studyAuthority.sessionRef,
              instructionalContextRef: request.studyAuthority.instructionalContextRef,
              currentOpportunityRef: request.studyAuthority.currentOpportunityRef,
            },
          },
        },
      });
      const explanationResult = exactDataRecord(rawExplanation, ["status", "value"]);
      if (explanationResult?.status !== "accepted") {
        return fallback(request, "parent-explanation-rejected", "parent-explanation");
      }
      const validation = validateSubsystemResult(
        ParentExplanationSchema,
        explanationResult.value,
      );
      if (
        validation.status === "rejected" ||
        validation.value.reasonCode !== explanationReason ||
        validation.value.provenance.recommendationRef !== request.parentWhy.recommendationRef ||
        validation.value.provenance.producedAt !== request.parentWhy.producedAt
      ) return fallback(request, "parent-explanation-unavailable", "parent-explanation");
      const explanation = validation.value;
      parentExplanation = {
        explanation,
        visibilityAuthorization: {
          ...request.parentWhy.guardianVisibilityAuthorization,
        },
        authoritative: false,
        studyMutationAllowed: false,
      };
    } catch {
      return fallback(request, "parent-explanation-unavailable", "parent-explanation");
    }
  }

  const pendingDecision: Wave2StudyDecisionPacket = {
    compositionVersion: WAVE2_ADAPTIVE_COMPOSITION_VERSION,
    status: "pending-study-decision",
    eventRef: request.studyAuthority.eventRef,
    decisionProvenance: {
      learnerScopeRef: request.studyAuthority.learnerScopeRef,
      sessionRef: request.studyAuthority.sessionRef,
      instructionalContextRef: request.studyAuthority.instructionalContextRef,
      opportunityRef: request.studyAuthority.currentOpportunityRef,
      effectiveAssistanceLevel: effectiveAssistance,
    },
    admissions: admissions.map(({ feature, decision }) => ({
      feature,
      status: decision.status,
      reason: policyCode(decision.reason),
    })),
    concept: {
      status: "accepted",
      currentConceptRef: request.studyAuthority.currentConceptRef,
      directPrerequisiteRefs: [...scopedPrerequisiteRefs],
    },
    misconception: serializedMisconception.signal,
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
  try {
    const finalValidation = validateExact(Wave2StudyDecisionPacketSchema, pendingDecision);
    if (finalValidation.status === "rejected") {
      return fallback(request, "invalid-final-study-decision-packet", null);
    }
    return commitReplayProtectedDecision(request, dependencies, finalValidation.value);
  } catch {
    return fallback(request, "invalid-final-study-decision-packet", null);
  }
}
