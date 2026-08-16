import { validateExact } from "../../../v2/contracts/validation.js";
import { evaluateProviderEligibility, isTrustedProviderProfileRegistry, } from "../../provider-policy/index.js";
import { MODEL_CAPABILITY_PROFILE_VERSION, ModelCapabilityProfileSchema, PROVIDER_CAPABILITY_PROFILE_VERSION, ProviderCapabilityProfileSchema, } from "./contracts.js";
export const ELIGIBLE_ROUTE_CATALOG_VERSION = "study-tutor-v3.eligible-route-catalog.v1";
const TRUSTED_CATALOGS = new WeakMap();
function cloneProvider(profile) {
    return Object.freeze({ ...profile, modelRefs: Object.freeze([...profile.modelRefs]) });
}
function cloneModel(profile) {
    return Object.freeze({
        ...profile,
        actionFamilies: Object.freeze([...profile.actionFamilies]),
        subjectCapabilities: Object.freeze([...profile.subjectCapabilities]),
        learnerStages: Object.freeze([...profile.learnerStages]),
        safetyCapabilities: Object.freeze([...profile.safetyCapabilities]),
        multimodalCapabilities: Object.freeze([...profile.multimodalCapabilities]),
    });
}
function validatedProfiles(input, schema, expectedVersion) {
    if (!Array.isArray(input) || input.length === 0 || input.length > 64)
        return null;
    const profiles = [];
    for (const candidate of input) {
        const validation = validateExact(schema, candidate);
        if (validation.status === "rejected" || validation.value.profileVersion !== expectedVersion) {
            return null;
        }
        profiles.push(validation.value);
    }
    return profiles;
}
function unique(values) {
    return new Set(values).size === values.length;
}
/**
 * Evaluates W3-08 once per provider and snapshots only trusted eligible routes.
 * Plain caller-declared eligibility values never enter this boundary.
 */
export function createEligibleRouteCatalog(input) {
    if (!isTrustedProviderProfileRegistry(input.providerPolicyRegistry))
        return null;
    const providers = validatedProfiles(input.providerProfiles, ProviderCapabilityProfileSchema, PROVIDER_CAPABILITY_PROFILE_VERSION);
    const models = validatedProfiles(input.modelProfiles, ModelCapabilityProfileSchema, MODEL_CAPABILITY_PROFILE_VERSION);
    if (!providers || !models)
        return null;
    if (!unique(providers.map((profile) => profile.providerRef)) ||
        !unique(models.map((profile) => profile.modelRef)) ||
        !unique(models.map((profile) => profile.routeRef)) ||
        !unique(input.providerPolicyRequirements.map((requirements) => requirements.providerRef))) {
        return null;
    }
    const requirementsByProvider = new Map(input.providerPolicyRequirements.map((requirements) => [requirements.providerRef, requirements]));
    const entries = [];
    for (const providerInput of providers) {
        const requirements = requirementsByProvider.get(providerInput.providerRef);
        if (!requirements)
            continue;
        const decision = evaluateProviderEligibility(input.providerPolicyRegistry, requirements);
        if (decision.decision !== "eligible" ||
            decision.providerRef !== providerInput.providerRef ||
            decision.providerPolicyRevisionRef === null ||
            decision.providerPolicyEvidenceRef === null) {
            continue;
        }
        const provider = cloneProvider(providerInput);
        for (const modelInput of models) {
            if (modelInput.providerRef !== provider.providerRef)
                continue;
            entries.push(Object.freeze({
                provider,
                model: cloneModel(modelInput),
                providerPolicyDecision: decision,
            }));
        }
    }
    const catalog = Object.freeze({
        catalogVersion: ELIGIBLE_ROUTE_CATALOG_VERSION,
        eligibleProviderCount: new Set(entries.map((entry) => entry.provider.providerRef)).size,
        eligibleRouteCount: entries.length,
    });
    TRUSTED_CATALOGS.set(catalog, Object.freeze(entries));
    return catalog;
}
export function readEligibleRouteCatalog(catalog) {
    if (typeof catalog !== "object" || catalog === null)
        return null;
    return TRUSTED_CATALOGS.get(catalog) ?? null;
}
