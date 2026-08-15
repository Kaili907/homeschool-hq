import { validateExact } from "../../../v2/contracts/validation.js";
import {
  MODEL_CAPABILITY_PROFILE_VERSION,
  ModelCapabilityProfileSchema,
  PROVIDER_CAPABILITY_PROFILE_VERSION,
  ProviderCapabilityProfileSchema,
  ROUTING_DECISION_VERSION,
  RoutingRequestSchema,
  type ActionFamily,
  type ModelCapabilityProfile,
  type NoEligibleRoutingDecision,
  type ProviderAvailabilityState,
  type ProviderCapabilityProfile,
  type RoutingAuthorityBoundary,
  type RoutingDecision,
  type RoutingReasonCode,
  type RoutingRequest,
  type SelectedRoutingDecision,
} from "./contracts.js";

const INVALID_REQUEST_REF = "routing-request:invalid";
const TRUSTED_STATIC_FALLBACK_POLICY_REF = "fallback-policy:trusted-default";
const INVALID_PERMISSION_REF = "study-permission:invalid";
const INVALID_ACTION_FAMILY: ActionFamily = "EXPLANATION";

const REASON_ORDER: readonly RoutingReasonCode[] = [
  "INVALID_ROUTING_CONTRACT",
  "STUDY_PERMISSION_MISMATCH",
  "STATIC_REVIEWED_ONLY",
  "PROVIDER_MODEL_BINDING_MISMATCH",
  "CAPABILITY_MISMATCH",
  "LEARNER_STAGE_MISMATCH",
  "CONTEXT_SIZE_MISMATCH",
  "SAFETY_MISMATCH",
  "MULTIMODAL_MISMATCH",
  "REVIEWED_CONTENT_MISMATCH",
  "PROVIDER_POLICY_INELIGIBLE",
  "PROVIDER_UNAVAILABLE",
  "COST_CEILING_EXCEEDED",
  "LATENCY_CEILING_EXCEEDED",
  "PRIMARY_ROUTE_SELECTED",
  "FALLBACK_ROUTE_SELECTED",
  "NO_ELIGIBLE_PROVIDER_ROUTE",
];

interface Candidate {
  readonly provider: ProviderCapabilityProfile;
  readonly model: ModelCapabilityProfile;
  readonly costMicros: bigint;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function closedProfiles<T>(
  values: unknown,
  schema: typeof ProviderCapabilityProfileSchema | typeof ModelCapabilityProfileSchema,
  expectedVersion:
    | typeof PROVIDER_CAPABILITY_PROFILE_VERSION
    | typeof MODEL_CAPABILITY_PROFILE_VERSION,
): readonly T[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > 64) return null;
  const profiles: T[] = [];
  for (const value of values) {
    const validation = validateExact(schema, value);
    if (validation.status === "rejected") return null;
    const profile = validation.value as Record<string, unknown>;
    if (profile.profileVersion !== expectedVersion) return null;
    profiles.push(validation.value as T);
  }
  return profiles;
}

function authorityBoundary(request: RoutingRequest | null): RoutingAuthorityBoundary {
  return {
    scope: "ROUTING_ONLY",
    permissionRef: request?.studyPermissionBoundary.permissionRef ?? INVALID_PERMISSION_REF,
    actionFamily:
      request?.studyPermissionBoundary.authorizedActionFamily ?? INVALID_ACTION_FAMILY,
    permissionsWidened: false,
    masteryChanged: false,
    gradeChanged: false,
    workingLevelChanged: false,
    curriculumChanged: false,
  };
}

function orderedReasons(reasons: ReadonlySet<RoutingReasonCode>): readonly RoutingReasonCode[] {
  return REASON_ORDER.filter((reason) => reasons.has(reason));
}

function noRoute(
  request: RoutingRequest | null,
  rejectionReasons: ReadonlySet<RoutingReasonCode>,
): NoEligibleRoutingDecision {
  const reasons = new Set(rejectionReasons);
  reasons.add("NO_ELIGIBLE_PROVIDER_ROUTE");
  return {
    decisionVersion: ROUTING_DECISION_VERSION,
    status: "NO_ELIGIBLE_PROVIDER_ROUTE",
    requestRef: request?.requestRef ?? INVALID_REQUEST_REF,
    providerClass: null,
    providerRef: null,
    modelClass: null,
    modelRef: null,
    routeRef: null,
    maxOutputTokens: 0,
    timeoutMs: 0,
    retryCount: 0,
    fallbackProviderClass: null,
    fallbackProviderRef: null,
    fallbackModelClass: null,
    fallbackModelRef: null,
    fallbackRouteRef: null,
    fallbackMaxOutputTokens: 0,
    fallbackTimeoutMs: 0,
    reservedCostMicros: "0",
    staticReviewedFallbackRequirement: "REQUIRED_IMMEDIATELY",
    staticFallbackPolicyRef:
      request?.staticFallbackPolicyRef ?? TRUSTED_STATIC_FALLBACK_POLICY_REF,
    authorityBoundary: authorityBoundary(request),
    reasonCodes: orderedReasons(reasons),
  };
}

function hasDuplicates(profile: ProviderCapabilityProfile | ModelCapabilityProfile): boolean {
  if ("modelRefs" in profile) {
    return !unique(profile.modelRefs) || !unique(profile.providerPolicyEligibilityRefs);
  }
  return !unique(profile.actionFamilies) ||
    !unique(profile.subjectCapabilities) ||
    !unique(profile.learnerStages) ||
    !unique(profile.safetyCapabilities) ||
    !unique(profile.multimodalCapabilities);
}

function matchingAvailability(
  request: RoutingRequest,
  providerRef: string,
  modelRef: string,
): ProviderAvailabilityState | null {
  const matches = request.providerAvailability.filter(
    (entry) => entry.providerRef === providerRef && entry.modelRef === modelRef,
  );
  return matches.length === 1 ? matches[0] ?? null : null;
}

function isSafetyEligible(
  model: ModelCapabilityProfile,
  request: RoutingRequest,
): boolean {
  return model.safetyCapabilities.includes(request.safetyRequirement);
}

function evaluateCandidate(
  provider: ProviderCapabilityProfile,
  model: ModelCapabilityProfile,
  request: RoutingRequest,
  reasons: Set<RoutingReasonCode>,
): Candidate | null {
  if (
    provider.lifecycle !== "ACTIVE" ||
    model.lifecycle !== "ACTIVE" ||
    model.providerRef !== provider.providerRef ||
    !provider.modelRefs.includes(model.modelRef) ||
    hasDuplicates(provider) ||
    hasDuplicates(model)
  ) {
    reasons.add("PROVIDER_MODEL_BINDING_MISMATCH");
    return null;
  }
  if (
    !model.actionFamilies.includes(request.actionFamily) ||
    !model.subjectCapabilities.includes(request.subjectCapability)
  ) {
    reasons.add("CAPABILITY_MISMATCH");
    return null;
  }
  if (!model.learnerStages.includes(request.learnerStage)) {
    reasons.add("LEARNER_STAGE_MISMATCH");
    return null;
  }
  const totalContextTokens =
    request.contextSizeRequirement.inputTokens +
    request.contextSizeRequirement.requiredOutputTokens;
  if (
    !Number.isSafeInteger(totalContextTokens) ||
    totalContextTokens > model.maximumContextTokens ||
    request.contextSizeRequirement.requiredOutputTokens > model.maximumOutputTokens
  ) {
    reasons.add("CONTEXT_SIZE_MISMATCH");
    return null;
  }
  if (!isSafetyEligible(model, request)) {
    reasons.add("SAFETY_MISMATCH");
    return null;
  }
  if (!model.multimodalCapabilities.includes(request.multimodalRequirement)) {
    reasons.add("MULTIMODAL_MISMATCH");
    return null;
  }
  if (
    request.reviewedContentRequirement === "PROVIDER_REVIEWED_GROUNDING_REQUIRED" &&
    model.reviewedContentSupport !== "PROVIDED_REVIEWED_GROUNDING"
  ) {
    reasons.add("REVIEWED_CONTENT_MISMATCH");
    return null;
  }
  if (!provider.providerPolicyEligibilityRefs.includes(request.providerPolicyEligibilityRef)) {
    reasons.add("PROVIDER_POLICY_INELIGIBLE");
    return null;
  }
  const availability = matchingAvailability(request, provider.providerRef, model.modelRef);
  if (!availability || availability.state !== "AVAILABLE") {
    reasons.add("PROVIDER_UNAVAILABLE");
    return null;
  }
  if (
    model.estimatedLatencyMs > request.latencyCeilingMs ||
    model.attemptTimeoutMs > request.latencyCeilingMs ||
    model.attemptTimeoutMs < provider.minimumTimeoutMs ||
    model.attemptTimeoutMs > provider.maximumTimeoutMs
  ) {
    reasons.add("LATENCY_CEILING_EXCEEDED");
    return null;
  }
  const costMicros = BigInt(model.worstCaseCostMicros);
  if (costMicros > BigInt(request.costCeilingMicros)) {
    reasons.add("COST_CEILING_EXCEEDED");
    return null;
  }
  return { provider, model, costMicros };
}

function compareCandidate(left: Candidate, right: Candidate): number {
  if (left.costMicros !== right.costMicros) {
    return left.costMicros < right.costMicros ? -1 : 1;
  }
  if (left.model.estimatedLatencyMs !== right.model.estimatedLatencyMs) {
    return left.model.estimatedLatencyMs - right.model.estimatedLatencyMs;
  }
  return [
    left.provider.providerClass.localeCompare(right.provider.providerClass),
    left.provider.providerRef.localeCompare(right.provider.providerRef),
    left.model.modelClass.localeCompare(right.model.modelClass),
    left.model.modelRef.localeCompare(right.model.modelRef),
    left.model.routeRef.localeCompare(right.model.routeRef),
  ].find((comparison) => comparison !== 0) ?? 0;
}

function chooseFallback(
  primary: Candidate,
  candidates: readonly Candidate[],
  request: RoutingRequest,
): Candidate | null {
  const ceiling = BigInt(request.costCeilingMicros);
  return candidates.find((candidate) =>
    candidate !== primary &&
    primary.costMicros + candidate.costMicros <= ceiling &&
    primary.model.attemptTimeoutMs + candidate.model.attemptTimeoutMs <=
      request.latencyCeilingMs
  ) ?? null;
}

function selectedDecision(
  request: RoutingRequest,
  primary: Candidate,
  fallback: Candidate | null,
): SelectedRoutingDecision {
  const reasonCodes: RoutingReasonCode[] = ["PRIMARY_ROUTE_SELECTED"];
  if (fallback) reasonCodes.push("FALLBACK_ROUTE_SELECTED");
  return {
    decisionVersion: ROUTING_DECISION_VERSION,
    status: "ROUTE_SELECTED",
    requestRef: request.requestRef,
    providerClass: primary.provider.providerClass,
    providerRef: primary.provider.providerRef,
    modelClass: primary.model.modelClass,
    modelRef: primary.model.modelRef,
    routeRef: primary.model.routeRef,
    maxOutputTokens: request.contextSizeRequirement.requiredOutputTokens,
    timeoutMs: primary.model.attemptTimeoutMs,
    retryCount: 0,
    fallbackProviderClass: fallback?.provider.providerClass ?? null,
    fallbackProviderRef: fallback?.provider.providerRef ?? null,
    fallbackModelClass: fallback?.model.modelClass ?? null,
    fallbackModelRef: fallback?.model.modelRef ?? null,
    fallbackRouteRef: fallback?.model.routeRef ?? null,
    fallbackMaxOutputTokens:
      fallback === null ? 0 : request.contextSizeRequirement.requiredOutputTokens,
    fallbackTimeoutMs: fallback?.model.attemptTimeoutMs ?? 0,
    reservedCostMicros: (primary.costMicros + (fallback?.costMicros ?? 0n)).toString(),
    staticReviewedFallbackRequirement: "REQUIRED_ON_ROUTE_FAILURE",
    staticFallbackPolicyRef: request.staticFallbackPolicyRef,
    authorityBoundary: authorityBoundary(request),
    reasonCodes,
  };
}

/**
 * Pure provider/model selection. It performs no I/O and treats profiles,
 * availability, and policy eligibility as closed reviewed inputs.
 */
export function routeProviderModel(
  routingRequest: unknown,
  providerProfilesInput: unknown,
  modelProfilesInput: unknown,
): RoutingDecision {
  try {
    const requestValidation = validateExact(RoutingRequestSchema, routingRequest);
    if (requestValidation.status === "rejected") {
      return noRoute(null, new Set(["INVALID_ROUTING_CONTRACT"]));
    }
    const request = requestValidation.value as unknown as RoutingRequest;
    const providers = closedProfiles<ProviderCapabilityProfile>(
      providerProfilesInput,
      ProviderCapabilityProfileSchema,
      PROVIDER_CAPABILITY_PROFILE_VERSION,
    );
    const models = closedProfiles<ModelCapabilityProfile>(
      modelProfilesInput,
      ModelCapabilityProfileSchema,
      MODEL_CAPABILITY_PROFILE_VERSION,
    );
    if (!providers || !models) {
      return noRoute(request, new Set(["INVALID_ROUTING_CONTRACT"]));
    }
    if (
      request.actionFamily !== request.studyPermissionBoundary.authorizedActionFamily
    ) {
      return noRoute(request, new Set(["STUDY_PERMISSION_MISMATCH"]));
    }
    if (request.reviewedContentRequirement === "STATIC_REVIEWED_ONLY") {
      return noRoute(request, new Set(["STATIC_REVIEWED_ONLY"]));
    }

    const providerRefs = providers.map((profile) => profile.providerRef);
    const modelRefs = models.map((profile) => profile.modelRef);
    const routeRefs = models.map((profile) => profile.routeRef);
    if (!unique(providerRefs) || !unique(modelRefs) || !unique(routeRefs)) {
      return noRoute(request, new Set(["PROVIDER_MODEL_BINDING_MISMATCH"]));
    }

    const reasons = new Set<RoutingReasonCode>();
    const candidates: Candidate[] = [];
    for (const provider of providers) {
      for (const model of models) {
        if (model.providerRef !== provider.providerRef) continue;
        const candidate = evaluateCandidate(provider, model, request, reasons);
        if (candidate) candidates.push(candidate);
      }
    }
    candidates.sort(compareCandidate);
    const primary = candidates[0];
    if (!primary) return noRoute(request, reasons);
    const fallback = chooseFallback(primary, candidates, request);
    return selectedDecision(request, primary, fallback);
  } catch {
    return noRoute(null, new Set(["INVALID_ROUTING_CONTRACT"]));
  }
}
