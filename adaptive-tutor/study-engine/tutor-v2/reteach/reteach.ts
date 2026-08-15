import type {
  ProposalAuthorityEffects,
  ProposalScopeBinding,
  RepairAssessmentPhase,
  RepairSafetyContext,
} from "../prerequisite-repair/index.js";

export const MAX_RETEACH_STEPS = 4;
export const MAX_REPEATED_RETEACH_LOOPS = 2;

export interface ReviewedStaticReteachFallback {
  readonly fallbackRef: string;
  readonly reviewedContentRefs: readonly string[];
}

export interface ReteachPlanRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
  readonly assessmentPhase: RepairAssessmentPhase;
  readonly safety: RepairSafetyContext;
  readonly maxReteachSteps: number;
  readonly priorReteachLoops: number;
  readonly maxRepeatedLoops: number;
  readonly reviewedStaticFallback: ReviewedStaticReteachFallback;
}

export type ReteachStepKind =
  | "review-model"
  | "concept-cue"
  | "guided-example"
  | "guided-practice";

export interface ReteachRecommendationRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
  readonly maximumSteps: number;
  readonly priorReteachLoops: number;
}

export interface ReteachRecommendationStep {
  readonly stepRef: string;
  readonly sequence: number;
  readonly stepKind: ReteachStepKind;
  readonly conceptRef: string;
  readonly reviewedContentRef: string;
}

export interface ReteachRecommendationResult {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
  readonly steps: readonly ReteachRecommendationStep[];
}

/** Reference-only recommendation seam. Provider prose and answers are not accepted. */
export interface HintInterventionRecommendationPort {
  recommend(
    request: ReteachRecommendationRequest,
  ): unknown | Promise<unknown>;
}

export interface ReteachReviewedContentLookupRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly purpose: "reteach";
  readonly currentConceptRef: string;
  readonly candidateContentRefs: readonly string[];
}

export interface ReteachReviewedContentLookupResult {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly purpose: "reteach";
  readonly currentConceptRef: string;
  readonly approvedContentRefs: readonly string[];
}

/** Review admission seam only; it cannot generate content or authorize answers. */
export interface ReteachReviewedContentLookupPort {
  lookup(
    request: ReteachReviewedContentLookupRequest,
  ): unknown | Promise<unknown>;
}

export interface ReteachDependencies {
  readonly hintInterventions: HintInterventionRecommendationPort;
  readonly reviewedContent: ReteachReviewedContentLookupPort;
}

export type ReteachReasonCode =
  | "RETEACH_RECOMMENDED"
  | "RETEACH_STEP_CAP_REACHED"
  | "REPEATED_RETEACH_LOOP_CAP_REACHED"
  | "ADAPTIVE_DEPENDENCY_UNAVAILABLE"
  | "CROSS_CONTEXT_RESULT_REJECTED"
  | "UNAUTHORIZED_ROUTE_REJECTED"
  | "UNREVIEWED_CONTENT_REJECTED"
  | "INVALID_STUDY_REQUEST"
  | "ACTIVE_ASSESSMENT_HELD"
  | "SAFETY_HOLD";

export interface ReteachPlanProposal {
  readonly kind: "reteach-plan-proposal";
  readonly status: "proposed" | "withheld";
  readonly proposalRef: string;
  readonly requestRef: string;
  readonly currentConceptRef: string;
  readonly steps: readonly ReteachRecommendationStep[];
  readonly reviewedContentRefs: readonly string[];
  readonly maxReteachSteps: number;
  readonly priorReteachLoops: number;
  readonly maxRepeatedLoops: number;
  readonly source: "adaptive" | "reviewed-static-fallback" | "none";
  readonly reasonCode: ReteachReasonCode;
  readonly answerAuthority: "none";
  readonly activeAssessmentBypass: false;
  readonly studyDecisionRequired: true;
  readonly authorityEffects: ProposalAuthorityEffects;
}

const AUTHORITY_EFFECTS: ProposalAuthorityEffects = Object.freeze({
  sequencing: "none",
  assignment: "none",
  progressWrite: "none",
  masteryWrite: "none",
  workingLevelMutation: "none",
  gradeMutation: "none",
  courseMutation: "none",
  curriculumRouteMutation: "none",
});

const OPAQUE_REF = /^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const PHASES = new Set<RepairAssessmentPhase>([
  "instruction-or-practice",
  "active-graded-or-mastery-check",
  "completed-assessment-review",
  "non-graded-review",
]);
const STEP_KINDS = new Set<ReteachStepKind>([
  "review-model",
  "concept-cue",
  "guided-example",
  "guided-practice",
]);
const BINDING_KEYS = [
  "householdScopeRef",
  "learnerScopeRef",
  "sessionRef",
  "invocationRef",
  "subjectRef",
  "gradeRef",
  "curriculumRef",
  "workingLevelRef",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.every((key) => typeof key === "string") &&
    actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRef(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_REF.test(value);
}

function compareRefs(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isUniqueRefArray(value: unknown, maximum: number, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) &&
    value.length <= maximum && value.every(isRef) &&
    new Set(value).size === value.length;
}

function isBinding(value: unknown): value is ProposalScopeBinding {
  return isRecord(value) && hasExactKeys(value, BINDING_KEYS) &&
    BINDING_KEYS.every((key) => isRef(value[key]));
}

function sameBinding(left: ProposalScopeBinding, right: ProposalScopeBinding): boolean {
  return BINDING_KEYS.every((key) => left[key] === right[key]);
}

function isRequest(value: unknown): value is ReteachPlanRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "currentConceptRef", "assessmentPhase", "safety",
    "maxReteachSteps", "priorReteachLoops", "maxRepeatedLoops",
    "reviewedStaticFallback",
  ])) return false;
  if (!isRecord(value.safety) || !hasExactKeys(value.safety, [
    "safetyHold", "mayContinueAcademicFlow",
  ])) return false;
  if (!isRecord(value.reviewedStaticFallback) ||
    !hasExactKeys(value.reviewedStaticFallback, ["fallbackRef", "reviewedContentRefs"])) {
    return false;
  }
  return isRef(value.requestRef) && isBinding(value.binding) &&
    isRef(value.currentConceptRef) && typeof value.assessmentPhase === "string" &&
    PHASES.has(value.assessmentPhase as RepairAssessmentPhase) &&
    typeof value.safety.safetyHold === "boolean" &&
    typeof value.safety.mayContinueAcademicFlow === "boolean" &&
    Number.isInteger(value.maxReteachSteps) && (value.maxReteachSteps as number) >= 1 &&
    Number.isInteger(value.priorReteachLoops) && (value.priorReteachLoops as number) >= 0 &&
    Number.isInteger(value.maxRepeatedLoops) && (value.maxRepeatedLoops as number) >= 1 &&
    isRef(value.reviewedStaticFallback.fallbackRef) &&
    isUniqueRefArray(value.reviewedStaticFallback.reviewedContentRefs,
      MAX_RETEACH_STEPS, false);
}

function proposalRef(requestRef: string): string {
  const token = requestRef.replace(/[^A-Za-z0-9._~-]/g, "-").slice(0, 120);
  return `reteach-proposal:${token || "invalid"}`;
}

function common(
  requestRef: string,
  conceptRef: string,
  maximumSteps: number,
  priorLoops: number,
  maximumLoops: number,
): Pick<ReteachPlanProposal,
  "kind" | "proposalRef" | "requestRef" | "currentConceptRef" |
  "maxReteachSteps" | "priorReteachLoops" | "maxRepeatedLoops" |
  "answerAuthority" | "activeAssessmentBypass" | "studyDecisionRequired" |
  "authorityEffects"> {
  return {
    kind: "reteach-plan-proposal",
    proposalRef: proposalRef(requestRef),
    requestRef,
    currentConceptRef: conceptRef,
    maxReteachSteps: maximumSteps,
    priorReteachLoops: priorLoops,
    maxRepeatedLoops: maximumLoops,
    answerAuthority: "none",
    activeAssessmentBypass: false,
    studyDecisionRequired: true,
    authorityEffects: AUTHORITY_EFFECTS,
  };
}

function invalidRequestProposal(value: unknown): ReteachPlanProposal {
  const requestRef = isRecord(value) && isRef(value.requestRef)
    ? value.requestRef
    : "request:invalid";
  const conceptRef = isRecord(value) && isRef(value.currentConceptRef)
    ? value.currentConceptRef
    : "concept:unavailable";
  return Object.freeze({
    ...common(requestRef, conceptRef, 1, 0, 1),
    status: "withheld",
    steps: [],
    reviewedContentRefs: [],
    source: "none",
    reasonCode: "INVALID_STUDY_REQUEST",
  });
}

function heldProposal(
  request: ReteachPlanRequest,
  reasonCode: "ACTIVE_ASSESSMENT_HELD" | "SAFETY_HOLD",
): ReteachPlanProposal {
  return Object.freeze({
    ...common(
      request.requestRef,
      request.currentConceptRef,
      Math.min(request.maxReteachSteps, MAX_RETEACH_STEPS),
      request.priorReteachLoops,
      Math.min(request.maxRepeatedLoops, MAX_REPEATED_RETEACH_LOOPS),
    ),
    status: "withheld",
    steps: [],
    reviewedContentRefs: [],
    source: "none",
    reasonCode,
  });
}

function loopCapProposal(request: ReteachPlanRequest): ReteachPlanProposal {
  return Object.freeze({
    ...common(
      request.requestRef,
      request.currentConceptRef,
      Math.min(request.maxReteachSteps, MAX_RETEACH_STEPS),
      request.priorReteachLoops,
      Math.min(request.maxRepeatedLoops, MAX_REPEATED_RETEACH_LOOPS),
    ),
    status: "withheld",
    steps: [],
    reviewedContentRefs: [],
    source: "none",
    reasonCode: "REPEATED_RETEACH_LOOP_CAP_REACHED",
  });
}

function fallbackProposal(
  request: ReteachPlanRequest,
  reasonCode: Exclude<ReteachReasonCode,
    "RETEACH_RECOMMENDED" | "RETEACH_STEP_CAP_REACHED" |
    "REPEATED_RETEACH_LOOP_CAP_REACHED" | "INVALID_STUDY_REQUEST" |
    "ACTIVE_ASSESSMENT_HELD" | "SAFETY_HOLD">,
): ReteachPlanProposal {
  const maxSteps = Math.min(request.maxReteachSteps, MAX_RETEACH_STEPS);
  const contentRefs = [...request.reviewedStaticFallback.reviewedContentRefs]
    .sort()
    .slice(0, maxSteps);
  const steps: ReteachRecommendationStep[] = contentRefs.map((reviewedContentRef, index) => ({
    stepRef: `reteach-step:static-${index + 1}`,
    sequence: index + 1,
    stepKind: "review-model",
    conceptRef: request.currentConceptRef,
    reviewedContentRef,
  }));
  return Object.freeze({
    ...common(
      request.requestRef,
      request.currentConceptRef,
      maxSteps,
      request.priorReteachLoops,
      Math.min(request.maxRepeatedLoops, MAX_REPEATED_RETEACH_LOOPS),
    ),
    status: "proposed",
    steps,
    reviewedContentRefs: contentRefs,
    source: "reviewed-static-fallback",
    reasonCode,
  });
}

type DependencyFailure = "dependency" | "context" | "route" | "unreviewed";

function recommendationResult(
  value: unknown,
  request: ReteachPlanRequest,
): ReteachRecommendationResult | DependencyFailure {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "currentConceptRef", "steps",
  ]) || !isRef(value.requestRef) || !isBinding(value.binding) ||
    !isRef(value.currentConceptRef) || !Array.isArray(value.steps) ||
    value.steps.length === 0 || value.steps.length > 24) return "dependency";
  if (value.requestRef !== request.requestRef ||
    !sameBinding(value.binding, request.binding)) return "context";
  if (value.currentConceptRef !== request.currentConceptRef) return "route";
  const steps: ReteachRecommendationStep[] = [];
  for (const candidate of value.steps) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, [
      "stepRef", "sequence", "stepKind", "conceptRef", "reviewedContentRef",
    ]) || !isRef(candidate.stepRef) || !Number.isInteger(candidate.sequence) ||
      (candidate.sequence as number) < 1 || typeof candidate.stepKind !== "string" ||
      !STEP_KINDS.has(candidate.stepKind as ReteachStepKind) ||
      !isRef(candidate.conceptRef) || !isRef(candidate.reviewedContentRef)) {
      return "dependency";
    }
    if (candidate.conceptRef !== request.currentConceptRef) return "route";
    steps.push(candidate as unknown as ReteachRecommendationStep);
  }
  if (new Set(steps.map(({ stepRef }) => stepRef)).size !== steps.length ||
    new Set(steps.map(({ sequence }) => sequence)).size !== steps.length) return "dependency";
  return {
    requestRef: value.requestRef,
    binding: value.binding,
    currentConceptRef: value.currentConceptRef,
    steps,
  };
}

function reviewedResult(
  value: unknown,
  request: ReteachPlanRequest,
  candidates: readonly string[],
): ReteachReviewedContentLookupResult | DependencyFailure {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "purpose", "currentConceptRef", "approvedContentRefs",
  ]) || !isRef(value.requestRef) || !isBinding(value.binding) ||
    value.purpose !== "reteach" || !isRef(value.currentConceptRef) ||
    !isUniqueRefArray(value.approvedContentRefs, MAX_RETEACH_STEPS)) return "dependency";
  if (value.requestRef !== request.requestRef ||
    !sameBinding(value.binding, request.binding)) return "context";
  if (value.currentConceptRef !== request.currentConceptRef) return "route";
  const candidateSet = new Set(candidates);
  const approvedContentRefs = value.approvedContentRefs as string[];
  if (approvedContentRefs.some((ref) => !candidateSet.has(ref))) return "route";
  if (candidates.some((ref) => !approvedContentRefs.includes(ref))) return "unreviewed";
  return value as unknown as ReteachReviewedContentLookupResult;
}

function reasonForFailure(failure: DependencyFailure):
  "ADAPTIVE_DEPENDENCY_UNAVAILABLE" | "CROSS_CONTEXT_RESULT_REJECTED" |
  "UNAUTHORIZED_ROUTE_REJECTED" | "UNREVIEWED_CONTENT_REJECTED" {
  if (failure === "context") return "CROSS_CONTEXT_RESULT_REJECTED";
  if (failure === "route") return "UNAUTHORIZED_ROUTE_REJECTED";
  if (failure === "unreviewed") return "UNREVIEWED_CONTENT_REJECTED";
  return "ADAPTIVE_DEPENDENCY_UNAVAILABLE";
}

export async function proposeReteachPlan(
  requestValue: unknown,
  dependencies: ReteachDependencies,
): Promise<ReteachPlanProposal> {
  let request: ReteachPlanRequest;
  try {
    if (!isRequest(requestValue)) return invalidRequestProposal(requestValue);
    request = structuredClone(requestValue);
  } catch {
    return invalidRequestProposal(null);
  }
  const maxSteps = Math.min(request.maxReteachSteps, MAX_RETEACH_STEPS);
  const maxLoops = Math.min(request.maxRepeatedLoops, MAX_REPEATED_RETEACH_LOOPS);

  if (request.safety.safetyHold || !request.safety.mayContinueAcademicFlow) {
    return heldProposal(request, "SAFETY_HOLD");
  }
  if (request.assessmentPhase === "active-graded-or-mastery-check") {
    return heldProposal(request, "ACTIVE_ASSESSMENT_HELD");
  }
  if (request.priorReteachLoops >= maxLoops) {
    return loopCapProposal(request);
  }

  let recommendation: ReteachRecommendationResult | DependencyFailure;
  try {
    const rawRecommendation = await dependencies.hintInterventions.recommend(structuredClone({
      requestRef: request.requestRef,
      binding: request.binding,
      currentConceptRef: request.currentConceptRef,
      maximumSteps: maxSteps,
      priorReteachLoops: request.priorReteachLoops,
    }));
    recommendation = recommendationResult(rawRecommendation, request);
  } catch {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  }
  if (typeof recommendation === "string") {
    return fallbackProposal(request, reasonForFailure(recommendation));
  }
  const sorted = [...recommendation.steps].sort((left, right) =>
    left.sequence - right.sequence || compareRefs(left.stepRef, right.stepRef));
  const capped = sorted.slice(0, maxSteps).map((step, index) => ({
    ...step,
    sequence: index + 1,
  }));
  const candidateContentRefs = [...new Set(capped.map(
    ({ reviewedContentRef }) => reviewedContentRef,
  ))];

  let reviewed: ReteachReviewedContentLookupResult | DependencyFailure;
  try {
    const rawReviewed = await dependencies.reviewedContent.lookup(structuredClone({
      requestRef: request.requestRef,
      binding: request.binding,
      purpose: "reteach" as const,
      currentConceptRef: request.currentConceptRef,
      candidateContentRefs,
    }));
    reviewed = reviewedResult(rawReviewed, request, candidateContentRefs);
  } catch {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  }
  if (typeof reviewed === "string") {
    return fallbackProposal(request, reasonForFailure(reviewed));
  }

  return Object.freeze({
    ...common(
      request.requestRef,
      request.currentConceptRef,
      maxSteps,
      request.priorReteachLoops,
      maxLoops,
    ),
    status: "proposed",
    steps: capped,
    reviewedContentRefs: candidateContentRefs,
    source: "adaptive",
    reasonCode: sorted.length > maxSteps
      ? "RETEACH_STEP_CAP_REACHED"
      : "RETEACH_RECOMMENDED",
  });
}
