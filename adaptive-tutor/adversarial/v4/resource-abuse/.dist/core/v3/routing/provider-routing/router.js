import { createCommercialRouteAttemptPlan, parseCanonicalIntegerMicros, } from "../../commercial-operation/index.js";
import { validateExact } from "../../../v2/contracts/validation.js";
import { readEligibleRouteCatalog } from "./catalog.js";
import { ROUTING_DECISION_VERSION, RoutingRequestSchema, } from "./contracts.js";
const INVALID_REQUEST_REF = "routing-request:invalid";
const TRUSTED_STATIC_FALLBACK_POLICY_REF = "fallback-policy:trusted-default";
const INVALID_PERMISSION_REF = "study-permission:invalid";
const INVALID_ACTION_FAMILY = "EXPLANATION";
const REASON_ORDER = [
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
function unique(values) {
    return new Set(values).size === values.length;
}
function authorityBoundary(request) {
    return {
        scope: "ROUTING_ONLY",
        permissionRef: request?.studyPermissionBoundary.permissionRef ?? INVALID_PERMISSION_REF,
        actionFamily: request?.studyPermissionBoundary.authorizedActionFamily ?? INVALID_ACTION_FAMILY,
        permissionsWidened: false,
        masteryChanged: false,
        gradeChanged: false,
        workingLevelChanged: false,
        curriculumChanged: false,
    };
}
function orderedReasons(reasons) {
    return REASON_ORDER.filter((reason) => reasons.has(reason));
}
function noRoute(request, rejectionReasons) {
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
        staticFallbackPolicyRef: request?.staticFallbackPolicyRef ?? TRUSTED_STATIC_FALLBACK_POLICY_REF,
        authorityBoundary: authorityBoundary(request),
        reasonCodes: orderedReasons(reasons),
    };
}
function hasDuplicates(profile) {
    if ("modelRefs" in profile)
        return !unique(profile.modelRefs);
    return !unique(profile.actionFamilies) ||
        !unique(profile.subjectCapabilities) ||
        !unique(profile.learnerStages) ||
        !unique(profile.safetyCapabilities) ||
        !unique(profile.multimodalCapabilities);
}
function matchingAvailability(request, providerRef, modelRef, modelRevisionRef) {
    const matches = request.providerAvailability.filter((entry) => entry.providerRef === providerRef &&
        entry.modelRef === modelRef &&
        entry.modelRevisionRef === modelRevisionRef);
    return matches.length === 1 ? matches[0] ?? null : null;
}
function evaluateCandidate(entry, request, reasons) {
    const { provider, model } = entry;
    if (provider.lifecycle !== "ACTIVE" ||
        model.lifecycle !== "ACTIVE" ||
        model.providerRef !== provider.providerRef ||
        !provider.modelRefs.includes(model.modelRef) ||
        hasDuplicates(provider) ||
        hasDuplicates(model)) {
        reasons.add("PROVIDER_MODEL_BINDING_MISMATCH");
        return null;
    }
    if (!model.actionFamilies.includes(request.actionFamily) ||
        !model.subjectCapabilities.includes(request.subjectCapability)) {
        reasons.add("CAPABILITY_MISMATCH");
        return null;
    }
    if (!model.learnerStages.includes(request.learnerStage)) {
        reasons.add("LEARNER_STAGE_MISMATCH");
        return null;
    }
    const totalContextTokens = request.contextSizeRequirement.inputTokens +
        request.contextSizeRequirement.requiredOutputTokens;
    if (!Number.isSafeInteger(totalContextTokens) ||
        totalContextTokens > model.maximumContextTokens ||
        request.contextSizeRequirement.requiredOutputTokens > model.maximumOutputTokens) {
        reasons.add("CONTEXT_SIZE_MISMATCH");
        return null;
    }
    if (!model.safetyCapabilities.includes(request.safetyRequirement)) {
        reasons.add("SAFETY_MISMATCH");
        return null;
    }
    if (!model.multimodalCapabilities.includes(request.multimodalRequirement)) {
        reasons.add("MULTIMODAL_MISMATCH");
        return null;
    }
    if (request.reviewedContentRequirement === "PROVIDER_REVIEWED_GROUNDING_REQUIRED" &&
        model.reviewedContentSupport !== "PROVIDED_REVIEWED_GROUNDING") {
        reasons.add("REVIEWED_CONTENT_MISMATCH");
        return null;
    }
    const availability = matchingAvailability(request, provider.providerRef, model.modelRef, model.modelRevisionRef);
    if (!availability || availability.state !== "AVAILABLE") {
        reasons.add("PROVIDER_UNAVAILABLE");
        return null;
    }
    if (model.estimatedLatencyMs > request.latencyCeilingMs ||
        model.attemptTimeoutMs > request.latencyCeilingMs ||
        model.attemptTimeoutMs < provider.minimumTimeoutMs ||
        model.attemptTimeoutMs > provider.maximumTimeoutMs) {
        reasons.add("LATENCY_CEILING_EXCEEDED");
        return null;
    }
    const costMicros = parseCanonicalIntegerMicros(model.worstCaseCostMicros);
    const costCeilingMicros = parseCanonicalIntegerMicros(request.costCeilingMicros);
    if (costMicros === null || costCeilingMicros === null) {
        reasons.add("INVALID_ROUTING_CONTRACT");
        return null;
    }
    if (costMicros > costCeilingMicros) {
        reasons.add("COST_CEILING_EXCEEDED");
        return null;
    }
    return { ...entry, costMicros };
}
function compareCandidate(left, right) {
    if (left.costMicros !== right.costMicros)
        return left.costMicros < right.costMicros ? -1 : 1;
    if (left.model.estimatedLatencyMs !== right.model.estimatedLatencyMs) {
        return left.model.estimatedLatencyMs - right.model.estimatedLatencyMs;
    }
    return [
        left.provider.providerClass.localeCompare(right.provider.providerClass),
        left.provider.providerRef.localeCompare(right.provider.providerRef),
        left.model.modelClass.localeCompare(right.model.modelClass),
        left.model.modelRef.localeCompare(right.model.modelRef),
        left.model.modelRevisionRef.localeCompare(right.model.modelRevisionRef),
        left.model.routeRef.localeCompare(right.model.routeRef),
    ].find((comparison) => comparison !== 0) ?? 0;
}
function chooseFallback(primary, candidates, request) {
    if (request.physicalAttemptRefs.length < 2)
        return null;
    const ceiling = parseCanonicalIntegerMicros(request.costCeilingMicros);
    if (ceiling === null)
        return null;
    return candidates.find((candidate) => candidate !== primary &&
        candidate.model.routeRef !== primary.model.routeRef &&
        primary.costMicros + candidate.costMicros <= ceiling &&
        primary.model.attemptTimeoutMs + candidate.model.attemptTimeoutMs <= request.latencyCeilingMs) ?? null;
}
function commercialAttempt(request, candidate, attemptIndex) {
    const physicalAttemptRef = request.physicalAttemptRefs[attemptIndex];
    if (!physicalAttemptRef)
        return null;
    return {
        logicalOperationRef: request.logicalOperationRef,
        physicalAttemptRef,
        attemptIndex,
        role: attemptIndex === 0 ? "primary" : "failover",
        routeRef: candidate.model.routeRef,
        providerRef: candidate.provider.providerRef,
        modelRef: candidate.model.modelRef,
        modelRevisionRef: candidate.model.modelRevisionRef,
        configurationDigest: candidate.model.configurationDigest,
        capabilityProfileRevisionRef: candidate.model.capabilityProfileRevisionRef,
        capabilityProfileDigest: candidate.model.capabilityProfileDigest,
        providerPolicyRevisionRef: candidate.providerPolicyDecision.providerPolicyRevisionRef,
        providerPolicyEvidenceRef: candidate.providerPolicyDecision.providerPolicyEvidenceRef,
        reservedCostMicros: candidate.model.worstCaseCostMicros,
        timeoutMs: candidate.model.attemptTimeoutMs,
    };
}
function selectedDecision(request, primary, fallback) {
    const primaryAttempt = commercialAttempt(request, primary, 0);
    const fallbackAttempt = fallback === null ? null : commercialAttempt(request, fallback, 1);
    if (primaryAttempt === null || (fallback !== null && fallbackAttempt === null)) {
        return noRoute(request, new Set(["INVALID_ROUTING_CONTRACT"]));
    }
    const attempts = fallbackAttempt === null ? [primaryAttempt] : [primaryAttempt, fallbackAttempt];
    const routeAttemptPlan = createCommercialRouteAttemptPlan({
        routePlanRef: request.routePlanRef,
        logicalOperationRef: request.logicalOperationRef,
        attempts,
    });
    if (routeAttemptPlan === null) {
        return noRoute(request, new Set(["INVALID_ROUTING_CONTRACT"]));
    }
    const reasonCodes = ["PRIMARY_ROUTE_SELECTED"];
    if (fallbackAttempt)
        reasonCodes.push("FALLBACK_ROUTE_SELECTED");
    const decision = {
        decisionVersion: ROUTING_DECISION_VERSION,
        status: "ROUTE_SELECTED",
        requestRef: request.requestRef,
        routeAttemptPlan,
        retryCount: 0,
        reservedCostMicros: routeAttemptPlan.totalReservedCostMicros,
        staticReviewedFallbackRequirement: "REQUIRED_ON_ROUTE_FAILURE",
        staticFallbackPolicyRef: request.staticFallbackPolicyRef,
        authorityBoundary: authorityBoundary(request),
        reasonCodes,
    };
    return decision;
}
/** Pure selection from a catalog whose provider eligibility was evaluated by W3-08. */
export function routeProviderModel(routingRequest, eligibleRouteCatalog) {
    try {
        const requestValidation = validateExact(RoutingRequestSchema, routingRequest);
        if (requestValidation.status === "rejected") {
            return noRoute(null, new Set(["INVALID_ROUTING_CONTRACT"]));
        }
        const request = requestValidation.value;
        if (!unique(request.physicalAttemptRefs)) {
            return noRoute(request, new Set(["INVALID_ROUTING_CONTRACT"]));
        }
        const catalogEntries = readEligibleRouteCatalog(eligibleRouteCatalog);
        if (catalogEntries === null) {
            return noRoute(request, new Set(["INVALID_ROUTING_CONTRACT"]));
        }
        if (request.actionFamily !== request.studyPermissionBoundary.authorizedActionFamily) {
            return noRoute(request, new Set(["STUDY_PERMISSION_MISMATCH"]));
        }
        if (request.reviewedContentRequirement === "STATIC_REVIEWED_ONLY") {
            return noRoute(request, new Set(["STATIC_REVIEWED_ONLY"]));
        }
        if (catalogEntries.length === 0) {
            return noRoute(request, new Set(["PROVIDER_POLICY_INELIGIBLE"]));
        }
        const reasons = new Set();
        const candidates = catalogEntries
            .map((entry) => evaluateCandidate(entry, request, reasons))
            .filter((candidate) => candidate !== null)
            .sort(compareCandidate);
        const primary = candidates[0];
        if (!primary)
            return noRoute(request, reasons);
        return selectedDecision(request, primary, chooseFallback(primary, candidates, request));
    }
    catch {
        return noRoute(null, new Set(["INVALID_ROUTING_CONTRACT"]));
    }
}
