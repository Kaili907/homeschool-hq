export const MAX_PREREQUISITE_REPAIR_DEPTH = 3;
export const MAX_PREREQUISITE_PROPOSAL_CONCEPTS = 12;
export const MAX_PREREQUISITE_REVIEWED_CONTENT_REFS = 12;

export type RepairAssessmentPhase =
  | "instruction-or-practice"
  | "active-graded-or-mastery-check"
  | "completed-assessment-review"
  | "non-graded-review";

export interface ProposalScopeBinding {
  readonly householdScopeRef: string;
  readonly learnerScopeRef: string;
  readonly sessionRef: string;
  readonly invocationRef: string;
  readonly subjectRef: string;
  readonly gradeRef: string;
  readonly curriculumRef: string;
  readonly workingLevelRef: string;
}

export interface RepairSafetyContext {
  readonly safetyHold: boolean;
  readonly mayContinueAcademicFlow: boolean;
}

export interface ReviewedStaticRepairFallback {
  readonly fallbackRef: string;
  readonly reviewedContentRefs: readonly string[];
}

export interface PrerequisiteRepairRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
  readonly assessmentPhase: RepairAssessmentPhase;
  readonly safety: RepairSafetyContext;
  readonly maxRepairDepth: number;
  readonly reviewedStaticFallback: ReviewedStaticRepairFallback;
}

export interface PrerequisiteGraphLookupRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly conceptRef: string;
}

export interface PrerequisiteGraphNode {
  readonly conceptRef: string;
  readonly subjectRef: string;
  readonly gradeRef: string;
  readonly curriculumRef: string;
}

export interface PrerequisiteGraphLookupResult {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly conceptRef: string;
  readonly prerequisites: readonly PrerequisiteGraphNode[];
}

/** Advisory graph access only. It has no assignment or sequencing methods. */
export interface PrerequisiteGraphLookupPort {
  lookup(
    request: PrerequisiteGraphLookupRequest,
  ): unknown | Promise<unknown>;
}

export interface MisconceptionSignalLookupRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
}

export interface MisconceptionSignalLookupResult {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly currentConceptRef: string;
  readonly status: "clear" | "suspected" | "conflicting";
  readonly suspectedPrerequisiteRefs: readonly string[];
}

/** Read-only evidence signal access; this port cannot write mastery or progress. */
export interface MisconceptionSignalLookupPort {
  lookup(
    request: MisconceptionSignalLookupRequest,
  ): unknown | Promise<unknown>;
}

export interface RepairReviewedContentLookupRequest {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly purpose: "prerequisite-repair";
  readonly conceptRefs: readonly string[];
}

export interface RepairReviewedContentEntry {
  readonly conceptRef: string;
  readonly reviewedContentRefs: readonly string[];
}

export interface RepairReviewedContentLookupResult {
  readonly requestRef: string;
  readonly binding: ProposalScopeBinding;
  readonly purpose: "prerequisite-repair";
  readonly entries: readonly RepairReviewedContentEntry[];
}

/** Returns references only. Raw or provider-authored prose is outside this port. */
export interface RepairReviewedContentLookupPort {
  lookup(
    request: RepairReviewedContentLookupRequest,
  ): unknown | Promise<unknown>;
}

export interface PrerequisiteRepairDependencies {
  readonly prerequisiteGraph: PrerequisiteGraphLookupPort;
  readonly misconceptionSignals: MisconceptionSignalLookupPort;
  readonly reviewedContent: RepairReviewedContentLookupPort;
}

export type PrerequisiteRepairReasonCode =
  | "PREREQUISITE_REPAIR_RECOMMENDED"
  | "PREREQUISITE_CHAIN_RECOMMENDED"
  | "MAX_REPAIR_DEPTH_REACHED"
  | "NO_PREREQUISITE_FOUND"
  | "CONFLICTING_MISCONCEPTION_SIGNALS"
  | "ADAPTIVE_DEPENDENCY_UNAVAILABLE"
  | "CROSS_CONTEXT_RESULT_REJECTED"
  | "UNAUTHORIZED_ROUTE_REJECTED"
  | "INVALID_STUDY_REQUEST"
  | "ACTIVE_ASSESSMENT_HELD"
  | "SAFETY_HOLD";

export interface ProposalAuthorityEffects {
  readonly sequencing: "none";
  readonly assignment: "none";
  readonly progressWrite: "none";
  readonly masteryWrite: "none";
  readonly workingLevelMutation: "none";
  readonly gradeMutation: "none";
  readonly courseMutation: "none";
  readonly curriculumRouteMutation: "none";
}

export interface PrerequisiteRepairProposal {
  readonly kind: "prerequisite-repair-proposal";
  readonly status: "proposed" | "withheld";
  readonly proposalRef: string;
  readonly requestRef: string;
  readonly currentConceptRef: string;
  readonly suspectedMissingPrerequisiteRefs: readonly string[];
  readonly recommendedRepairConceptRefs: readonly string[];
  readonly reviewedContentRefs: readonly string[];
  readonly maxRepairDepth: number;
  readonly appliedRepairDepth: number;
  readonly source: "adaptive" | "reviewed-static-fallback" | "none";
  readonly reasonCode: PrerequisiteRepairReasonCode;
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
const ASSESSMENT_PHASES = new Set<RepairAssessmentPhase>([
  "instruction-or-practice",
  "active-graded-or-mastery-check",
  "completed-assessment-review",
  "non-graded-review",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.every((key) => typeof key === "string") &&
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function isRef(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_REF.test(value);
}

function compareRefs(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isUniqueRefArray(value: unknown, maximum: number, allowEmpty = true): value is string[] {
  return Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.length <= maximum &&
    value.every(isRef) &&
    new Set(value).size === value.length;
}

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

function isBinding(value: unknown): value is ProposalScopeBinding {
  return isRecord(value) && hasExactKeys(value, BINDING_KEYS) &&
    BINDING_KEYS.every((key) => isRef(value[key]));
}

function sameBinding(left: ProposalScopeBinding, right: ProposalScopeBinding): boolean {
  return BINDING_KEYS.every((key) => left[key] === right[key]);
}

function isRequest(value: unknown): value is PrerequisiteRepairRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef",
    "binding",
    "currentConceptRef",
    "assessmentPhase",
    "safety",
    "maxRepairDepth",
    "reviewedStaticFallback",
  ])) return false;
  if (!isRecord(value.safety) || !hasExactKeys(value.safety, [
    "safetyHold",
    "mayContinueAcademicFlow",
  ])) return false;
  if (!isRecord(value.reviewedStaticFallback) ||
    !hasExactKeys(value.reviewedStaticFallback, ["fallbackRef", "reviewedContentRefs"])) {
    return false;
  }
  return isRef(value.requestRef) && isBinding(value.binding) &&
    isRef(value.currentConceptRef) &&
    typeof value.assessmentPhase === "string" &&
    ASSESSMENT_PHASES.has(value.assessmentPhase as RepairAssessmentPhase) &&
    typeof value.safety.safetyHold === "boolean" &&
    typeof value.safety.mayContinueAcademicFlow === "boolean" &&
    Number.isInteger(value.maxRepairDepth) &&
    (value.maxRepairDepth as number) >= 1 &&
    isRef(value.reviewedStaticFallback.fallbackRef) &&
    isUniqueRefArray(value.reviewedStaticFallback.reviewedContentRefs, 3, false);
}

function proposalRef(prefix: string, requestRef: string): string {
  const token = requestRef.replace(/[^A-Za-z0-9._~-]/g, "-").slice(0, 120);
  return `${prefix}:${token || "invalid"}`;
}

function baseProposal(
  requestRef: string,
  conceptRef: string,
  maxDepth: number,
): Pick<
  PrerequisiteRepairProposal,
  "kind" | "proposalRef" | "requestRef" | "currentConceptRef" |
  "maxRepairDepth" | "studyDecisionRequired" | "authorityEffects"
> {
  return {
    kind: "prerequisite-repair-proposal",
    proposalRef: proposalRef("repair-proposal", requestRef),
    requestRef,
    currentConceptRef: conceptRef,
    maxRepairDepth: maxDepth,
    studyDecisionRequired: true,
    authorityEffects: AUTHORITY_EFFECTS,
  };
}

function invalidRequestProposal(value: unknown): PrerequisiteRepairProposal {
  const requestRef = isRecord(value) && isRef(value.requestRef)
    ? value.requestRef
    : "request:invalid";
  const conceptRef = isRecord(value) && isRef(value.currentConceptRef)
    ? value.currentConceptRef
    : "concept:unavailable";
  return Object.freeze({
    ...baseProposal(requestRef, conceptRef, 1),
    status: "withheld",
    suspectedMissingPrerequisiteRefs: [],
    recommendedRepairConceptRefs: [],
    reviewedContentRefs: [],
    appliedRepairDepth: 0,
    source: "none",
    reasonCode: "INVALID_STUDY_REQUEST",
  });
}

function heldProposal(
  request: PrerequisiteRepairRequest,
  reasonCode: "ACTIVE_ASSESSMENT_HELD" | "SAFETY_HOLD",
): PrerequisiteRepairProposal {
  return Object.freeze({
    ...baseProposal(request.requestRef, request.currentConceptRef,
      Math.min(request.maxRepairDepth, MAX_PREREQUISITE_REPAIR_DEPTH)),
    status: "withheld",
    suspectedMissingPrerequisiteRefs: [],
    recommendedRepairConceptRefs: [],
    reviewedContentRefs: [],
    appliedRepairDepth: 0,
    source: "none",
    reasonCode,
  });
}

function fallbackProposal(
  request: PrerequisiteRepairRequest,
  reasonCode: Exclude<PrerequisiteRepairReasonCode,
    "PREREQUISITE_REPAIR_RECOMMENDED" | "PREREQUISITE_CHAIN_RECOMMENDED" |
    "MAX_REPAIR_DEPTH_REACHED" | "INVALID_STUDY_REQUEST" |
    "ACTIVE_ASSESSMENT_HELD" | "SAFETY_HOLD">,
  suspectedRefs: readonly string[] = [],
): PrerequisiteRepairProposal {
  return Object.freeze({
    ...baseProposal(request.requestRef, request.currentConceptRef,
      Math.min(request.maxRepairDepth, MAX_PREREQUISITE_REPAIR_DEPTH)),
    status: "proposed",
    suspectedMissingPrerequisiteRefs: [...suspectedRefs]
      .sort()
      .slice(0, MAX_PREREQUISITE_PROPOSAL_CONCEPTS),
    recommendedRepairConceptRefs: [],
    reviewedContentRefs: [...request.reviewedStaticFallback.reviewedContentRefs]
      .sort()
      .slice(0, MAX_PREREQUISITE_REVIEWED_CONTENT_REFS),
    appliedRepairDepth: 0,
    source: "reviewed-static-fallback",
    reasonCode,
  });
}

type DependencyFailure = "dependency" | "context" | "route";

function graphResult(
  value: unknown,
  request: PrerequisiteRepairRequest,
  conceptRef: string,
): PrerequisiteGraphLookupResult | DependencyFailure {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "conceptRef", "prerequisites",
  ]) || !isRef(value.requestRef) || !isBinding(value.binding) ||
    !isRef(value.conceptRef) || !Array.isArray(value.prerequisites) ||
    value.prerequisites.length > MAX_PREREQUISITE_PROPOSAL_CONCEPTS) return "dependency";
  if (value.requestRef !== request.requestRef || value.conceptRef !== conceptRef ||
    !sameBinding(value.binding, request.binding)) return "context";
  const prerequisites: PrerequisiteGraphNode[] = [];
  for (const candidate of value.prerequisites) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, [
      "conceptRef", "subjectRef", "gradeRef", "curriculumRef",
    ]) || !isRef(candidate.conceptRef) || !isRef(candidate.subjectRef) ||
      !isRef(candidate.gradeRef) || !isRef(candidate.curriculumRef)) return "dependency";
    if (candidate.subjectRef !== request.binding.subjectRef ||
      candidate.gradeRef !== request.binding.gradeRef ||
      candidate.curriculumRef !== request.binding.curriculumRef) return "route";
    prerequisites.push({
      conceptRef: candidate.conceptRef,
      subjectRef: candidate.subjectRef,
      gradeRef: candidate.gradeRef,
      curriculumRef: candidate.curriculumRef,
    });
  }
  if (new Set(prerequisites.map(({ conceptRef: ref }) => ref)).size !== prerequisites.length) {
    return "dependency";
  }
  return {
    requestRef: value.requestRef,
    binding: value.binding,
    conceptRef: value.conceptRef,
    prerequisites,
  };
}

function signalResult(
  value: unknown,
  request: PrerequisiteRepairRequest,
): MisconceptionSignalLookupResult | DependencyFailure {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "currentConceptRef", "status",
    "suspectedPrerequisiteRefs",
  ]) || !isRef(value.requestRef) || !isBinding(value.binding) ||
    !isRef(value.currentConceptRef) ||
    !["clear", "suspected", "conflicting"].includes(String(value.status)) ||
    !isUniqueRefArray(value.suspectedPrerequisiteRefs,
      MAX_PREREQUISITE_PROPOSAL_CONCEPTS)) return "dependency";
  if (value.requestRef !== request.requestRef ||
    value.currentConceptRef !== request.currentConceptRef ||
    !sameBinding(value.binding, request.binding)) return "context";
  if (value.status === "clear" && value.suspectedPrerequisiteRefs.length !== 0) {
    return "dependency";
  }
  if (value.status === "suspected" && value.suspectedPrerequisiteRefs.length === 0) {
    return "dependency";
  }
  return value as unknown as MisconceptionSignalLookupResult;
}

function reviewedResult(
  value: unknown,
  request: PrerequisiteRepairRequest,
  conceptRefs: readonly string[],
): RepairReviewedContentLookupResult | DependencyFailure {
  if (!isRecord(value) || !hasExactKeys(value, [
    "requestRef", "binding", "purpose", "entries",
  ]) || !isRef(value.requestRef) || !isBinding(value.binding) ||
    value.purpose !== "prerequisite-repair" || !Array.isArray(value.entries) ||
    value.entries.length > MAX_PREREQUISITE_PROPOSAL_CONCEPTS) return "dependency";
  if (value.requestRef !== request.requestRef ||
    !sameBinding(value.binding, request.binding)) return "context";
  const allowed = new Set(conceptRefs);
  const entries: RepairReviewedContentEntry[] = [];
  for (const entry of value.entries) {
    if (!isRecord(entry) || !hasExactKeys(entry, [
      "conceptRef", "reviewedContentRefs",
    ]) || !isRef(entry.conceptRef) ||
      !isUniqueRefArray(entry.reviewedContentRefs, 4, false)) return "dependency";
    if (!allowed.has(entry.conceptRef)) return "route";
    entries.push({
      conceptRef: entry.conceptRef,
      reviewedContentRefs: [...entry.reviewedContentRefs],
    });
  }
  if (new Set(entries.map(({ conceptRef }) => conceptRef)).size !== entries.length) {
    return "dependency";
  }
  return {
    requestRef: value.requestRef,
    binding: value.binding,
    purpose: "prerequisite-repair",
    entries,
  };
}

function reasonForFailure(failure: DependencyFailure):
  "ADAPTIVE_DEPENDENCY_UNAVAILABLE" | "CROSS_CONTEXT_RESULT_REJECTED" |
  "UNAUTHORIZED_ROUTE_REJECTED" {
  if (failure === "context") return "CROSS_CONTEXT_RESULT_REJECTED";
  if (failure === "route") return "UNAUTHORIZED_ROUTE_REJECTED";
  return "ADAPTIVE_DEPENDENCY_UNAVAILABLE";
}

export async function proposePrerequisiteRepair(
  requestValue: unknown,
  dependencies: PrerequisiteRepairDependencies,
): Promise<PrerequisiteRepairProposal> {
  let request: PrerequisiteRepairRequest;
  try {
    if (!isRequest(requestValue)) return invalidRequestProposal(requestValue);
    request = structuredClone(requestValue);
  } catch {
    return invalidRequestProposal(null);
  }
  const maxDepth = Math.min(request.maxRepairDepth, MAX_PREREQUISITE_REPAIR_DEPTH);

  if (request.safety.safetyHold || !request.safety.mayContinueAcademicFlow) {
    return heldProposal(request, "SAFETY_HOLD");
  }
  if (request.assessmentPhase === "active-graded-or-mastery-check") {
    return heldProposal(request, "ACTIVE_ASSESSMENT_HELD");
  }

  let signal: MisconceptionSignalLookupResult | DependencyFailure;
  try {
    const rawSignal = await dependencies.misconceptionSignals.lookup(structuredClone({
      requestRef: request.requestRef,
      binding: request.binding,
      currentConceptRef: request.currentConceptRef,
    }));
    signal = signalResult(rawSignal, request);
  } catch {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  }
  if (typeof signal === "string") {
    return fallbackProposal(request, reasonForFailure(signal));
  }
  if (signal.status === "conflicting") {
    return fallbackProposal(request, "CONFLICTING_MISCONCEPTION_SIGNALS",
      signal.suspectedPrerequisiteRefs);
  }

  const depthByConcept = new Map<string, number>();
  const parentByConcept = new Map<string, string>();
  const queue: Array<{ conceptRef: string; depth: number }> = [
    { conceptRef: request.currentConceptRef, depth: 0 },
  ];
  const visited = new Set<string>();
  let maxDepthReached = false;

  while (queue.length > 0 && depthByConcept.size < MAX_PREREQUISITE_PROPOSAL_CONCEPTS) {
    const next = queue.shift();
    if (next === undefined || visited.has(next.conceptRef)) continue;
    visited.add(next.conceptRef);
    let graph: PrerequisiteGraphLookupResult | DependencyFailure;
    try {
      const rawGraph = await dependencies.prerequisiteGraph.lookup(structuredClone({
        requestRef: request.requestRef,
        binding: request.binding,
        conceptRef: next.conceptRef,
      }));
      graph = graphResult(rawGraph, request, next.conceptRef);
    } catch {
      return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
    }
    if (typeof graph === "string") {
      return fallbackProposal(request, reasonForFailure(graph));
    }
    const sorted = [...graph.prerequisites]
      .sort((left, right) => compareRefs(left.conceptRef, right.conceptRef));
    if (next.depth >= maxDepth) {
      if (sorted.length > 0) maxDepthReached = true;
      continue;
    }
    for (const node of sorted) {
      if (node.conceptRef === request.currentConceptRef || depthByConcept.has(node.conceptRef)) {
        continue;
      }
      const depth = next.depth + 1;
      depthByConcept.set(node.conceptRef, depth);
      parentByConcept.set(node.conceptRef, next.conceptRef);
      queue.push({ conceptRef: node.conceptRef, depth });
      if (depthByConcept.size >= MAX_PREREQUISITE_PROPOSAL_CONCEPTS) {
        maxDepthReached = true;
        break;
      }
    }
    if (signal.status === "suspected" && signal.suspectedPrerequisiteRefs.every(
      (ref) => depthByConcept.has(ref),
    )) {
      queue.length = 0;
    }
  }

  const allGraphRefs = [...depthByConcept.keys()];
  if (allGraphRefs.length === 0) {
    return fallbackProposal(request, "NO_PREREQUISITE_FOUND");
  }
  const graphSet = new Set(allGraphRefs);
  const suspected = signal.status === "suspected"
    ? [...signal.suspectedPrerequisiteRefs]
    : allGraphRefs;
  if (suspected.some((ref) => !graphSet.has(ref))) {
    return fallbackProposal(request, "CONFLICTING_MISCONCEPTION_SIGNALS", suspected);
  }

  const included = new Set<string>();
  for (const suspectedRef of suspected) {
    let cursor: string | undefined = suspectedRef;
    while (cursor !== undefined && cursor !== request.currentConceptRef) {
      included.add(cursor);
      cursor = parentByConcept.get(cursor);
    }
  }
  const recommended = [...included].sort((left, right) => {
    const depthDifference = (depthByConcept.get(left) ?? 0) -
      (depthByConcept.get(right) ?? 0);
    return depthDifference || compareRefs(left, right);
  });

  let reviewed: RepairReviewedContentLookupResult | DependencyFailure;
  try {
    const rawReviewed = await dependencies.reviewedContent.lookup(structuredClone({
      requestRef: request.requestRef,
      binding: request.binding,
      purpose: "prerequisite-repair" as const,
      conceptRefs: recommended,
    }));
    reviewed = reviewedResult(rawReviewed, request, recommended);
  } catch {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE", suspected);
  }
  if (typeof reviewed === "string") {
    return fallbackProposal(request, reasonForFailure(reviewed), suspected);
  }
  const reviewedByConcept = new Map(
    reviewed.entries.map((entry) => [entry.conceptRef, entry.reviewedContentRefs] as const),
  );
  if (recommended.some((ref) => !reviewedByConcept.has(ref))) {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE", suspected);
  }
  const reviewedContentRefs = [...new Set(recommended.flatMap(
    (ref) => reviewedByConcept.get(ref) ?? [],
  ))].slice(0, MAX_PREREQUISITE_REVIEWED_CONTENT_REFS);
  if (reviewedContentRefs.length === 0) {
    return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE", suspected);
  }

  const appliedRepairDepth = Math.max(...recommended.map(
    (ref) => depthByConcept.get(ref) ?? 0,
  ));
  const reasonCode: PrerequisiteRepairReasonCode = maxDepthReached
    ? "MAX_REPAIR_DEPTH_REACHED"
    : appliedRepairDepth > 1
      ? "PREREQUISITE_CHAIN_RECOMMENDED"
      : "PREREQUISITE_REPAIR_RECOMMENDED";
  return Object.freeze({
    ...baseProposal(request.requestRef, request.currentConceptRef, maxDepth),
    status: "proposed",
    suspectedMissingPrerequisiteRefs: [...suspected].sort(),
    recommendedRepairConceptRefs: recommended,
    reviewedContentRefs,
    appliedRepairDepth,
    source: "adaptive",
    reasonCode,
  });
}
