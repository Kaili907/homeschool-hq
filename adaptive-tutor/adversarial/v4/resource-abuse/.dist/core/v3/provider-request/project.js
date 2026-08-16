import { validateExact } from "../../v2/contracts/validation.js";
import { BoundedCommercialProviderRequestSchema, COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED, COMMERCIAL_PROVIDER_REQUEST_VERSION, TrustedStudyCommercialInvocationFactsSchema, } from "./contracts.js";
const MAXIMUM_BOUNDARY_DEPTH = 12;
const MAXIMUM_BOUNDARY_NODES = 512;
const MAXIMUM_BOUNDARY_KEYS = 64;
const MAXIMUM_BOUNDARY_ARRAY_ITEMS = 32;
const MAXIMUM_BOUNDARY_STRING_LENGTH = 256;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
function isSafeDataDescriptor(descriptor) {
    return Boolean(descriptor &&
        "value" in descriptor &&
        descriptor.get === undefined &&
        descriptor.set === undefined &&
        descriptor.enumerable);
}
/**
 * Preflights hostile values by descriptors. Accessor values are never read.
 * This runs before the shared exact-schema validator, making its later reads
 * safe for accepted candidates.
 */
function isSafeClosedJsonBoundary(candidate) {
    const ancestors = new Set();
    let nodeCount = 0;
    const inspect = (value, depth) => {
        nodeCount += 1;
        if (nodeCount > MAXIMUM_BOUNDARY_NODES || depth > MAXIMUM_BOUNDARY_DEPTH)
            return false;
        if (value === null || typeof value === "boolean")
            return true;
        if (typeof value === "string")
            return value.length <= MAXIMUM_BOUNDARY_STRING_LENGTH;
        if (typeof value === "number")
            return Number.isFinite(value);
        if (typeof value !== "object" || ancestors.has(value))
            return false;
        let prototype;
        let ownKeys;
        let descriptors;
        try {
            prototype = Object.getPrototypeOf(value);
            ownKeys = Reflect.ownKeys(value);
            descriptors = Object.getOwnPropertyDescriptors(value);
        }
        catch {
            return false;
        }
        if (ownKeys.some((key) => typeof key === "symbol"))
            return false;
        ancestors.add(value);
        if (Array.isArray(value)) {
            const lengthDescriptor = descriptors.length;
            const arrayLength = lengthDescriptor && "value" in lengthDescriptor
                ? lengthDescriptor.value
                : null;
            if (prototype !== Array.prototype ||
                typeof arrayLength !== "number" ||
                !Number.isSafeInteger(arrayLength) ||
                arrayLength < 0 ||
                arrayLength > MAXIMUM_BOUNDARY_ARRAY_ITEMS ||
                ownKeys.length !== arrayLength + 1) {
                ancestors.delete(value);
                return false;
            }
            for (let index = 0; index < arrayLength; index += 1) {
                const descriptor = descriptors[String(index)];
                if (!isSafeDataDescriptor(descriptor) || !inspect(descriptor.value, depth + 1)) {
                    ancestors.delete(value);
                    return false;
                }
            }
            ancestors.delete(value);
            return ownKeys.includes("length");
        }
        if (prototype !== Object.prototype || ownKeys.length > MAXIMUM_BOUNDARY_KEYS) {
            ancestors.delete(value);
            return false;
        }
        for (const key of ownKeys) {
            if (typeof key !== "string" || RESERVED_KEYS.has(key)) {
                ancestors.delete(value);
                return false;
            }
            const descriptor = descriptors[key];
            if (!isSafeDataDescriptor(descriptor) || !inspect(descriptor.value, depth + 1)) {
                ancestors.delete(value);
                return false;
            }
        }
        ancestors.delete(value);
        return true;
    };
    return inspect(candidate, 0);
}
function rejected(reasonCode) {
    return {
        status: "provider-request-rejected",
        reasonCode,
        providerCallAllowed: false,
    };
}
function deepFreeze(value) {
    if (value === null || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const child of Object.values(value))
        deepFreeze(child);
    return Object.freeze(value);
}
function hasUniqueValues(values) {
    return new Set(values).size === values.length;
}
function hasUniqueReferences(values, referenceKey) {
    const references = values.map((value) => value[referenceKey]);
    return references.every((value) => typeof value === "string") &&
        new Set(references).size === references.length;
}
function semanticReason(facts) {
    const attempt = facts.attemptEvidence;
    if (attempt && attempt.attemptOrdinal > attempt.attemptCount) {
        return "INCONSISTENT_ATTEMPT_EVIDENCE";
    }
    if ((attempt &&
        (!hasUniqueValues(attempt.academicSignalCodes) ||
            !hasUniqueValues(attempt.misconceptionRefs))) ||
        !hasUniqueReferences(facts.reviewedContentEvidence, "contentRef") ||
        !hasUniqueReferences(facts.groundingEvidence, "groundingRef")) {
        return "DUPLICATE_STRUCTURED_REFERENCE";
    }
    return null;
}
function copyAcademicScope(facts) {
    return {
        subjectRef: facts.academicScope.subjectRef,
        ...(facts.academicScope.courseRef === undefined
            ? {}
            : { courseRef: facts.academicScope.courseRef }),
        conceptRef: facts.academicScope.conceptRef,
    };
}
function projectValidatedFacts(facts) {
    return {
        requestVersion: COMMERCIAL_PROVIDER_REQUEST_VERSION,
        requestKind: "bounded-commercial-provider-request",
        invocationRef: facts.invocationRef,
        logicalOperationRef: facts.logicalOperationRef,
        academicScope: copyAcademicScope(facts),
        learnerStagePolicyRef: facts.policyRefs.learnerStagePolicyRef,
        actionFamily: facts.actionFamily,
        assessmentPhase: facts.assessmentPhase,
        ...(facts.attemptEvidence === undefined
            ? {}
            : { attemptEvidence: structuredClone(facts.attemptEvidence) }),
        reviewedContentEvidence: structuredClone(facts.reviewedContentEvidence),
        groundingEvidence: structuredClone(facts.groundingEvidence),
        presentationRequirement: facts.presentationRequirement,
        providerPolicyRef: facts.policyRefs.providerPolicyRef,
        configurationRef: facts.policyRefs.configurationRef,
        safetyPolicyRef: facts.policyRefs.safetyPolicyRef,
        presentationPolicyRef: facts.policyRefs.presentationPolicyRef,
        disclosureBoundary: "STUDY_DERIVED_STRUCTURED_EVIDENCE_ONLY",
        rawAttemptDisclosureAllowed: COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED,
    };
}
/**
 * Validates an already-projected value at the final commercial provider
 * boundary. It performs no provider call and never returns rejected input.
 */
export function validateBoundedCommercialProviderRequest(candidate) {
    if (!isSafeClosedJsonBoundary(candidate)) {
        return rejected("INVALID_COMMERCIAL_PROVIDER_REQUEST");
    }
    const validation = validateExact(BoundedCommercialProviderRequestSchema, candidate);
    if (validation.status === "rejected") {
        return rejected("INVALID_COMMERCIAL_PROVIDER_REQUEST");
    }
    const reason = semanticReason(validation.value);
    if (reason)
        return rejected(reason);
    const request = deepFreeze(structuredClone(validation.value));
    return {
        status: "accepted-commercial-provider-request",
        request,
    };
}
/**
 * Projects exact Study-authored facts into the narrower commercial request.
 * Unknown fields are rejected rather than silently discarded.
 */
export function projectCommercialProviderRequest(candidate) {
    if (!isSafeClosedJsonBoundary(candidate)) {
        return rejected("INVALID_TRUSTED_STUDY_FACTS");
    }
    const validation = validateExact(TrustedStudyCommercialInvocationFactsSchema, candidate);
    if (validation.status === "rejected") {
        return rejected("INVALID_TRUSTED_STUDY_FACTS");
    }
    const reason = semanticReason(validation.value);
    if (reason)
        return rejected(reason);
    return validateBoundedCommercialProviderRequest(projectValidatedFacts(validation.value));
}
export const minimizeCommercialProviderRequest = projectCommercialProviderRequest;
