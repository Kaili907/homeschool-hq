import { GroundedClaimsSchema, GroundedContextBundleSchema, GroundingRequirementsSchema, INSUFFICIENT_GROUNDED_CONTEXT, } from "./contracts.js";
import { validateExact } from "../../v2/contracts/validation.js";
const ACTIVE_ASSESSMENT = "active-graded-or-mastery-check";
function sortedUnique(values) {
    return [...new Set(values)].sort();
}
function sortedIssues(issues) {
    const unique = new Map();
    for (const issue of issues) {
        unique.set(`${issue.code}\u0000${issue.ref ?? ""}`, issue);
    }
    return [...unique.values()].sort((left, right) => {
        const codeOrder = left.code.localeCompare(right.code);
        return codeOrder !== 0
            ? codeOrder
            : (left.ref ?? "").localeCompare(right.ref ?? "");
    });
}
function indexByRef(values, refOf) {
    const mutable = new Map();
    for (const value of values) {
        const ref = refOf(value);
        const entries = mutable.get(ref) ?? [];
        entries.push(value);
        mutable.set(ref, entries);
    }
    return mutable;
}
function resolveContext(requirement, contextRef, expectedDigest, bundle, contextsByRef) {
    const matches = contextsByRef.get(contextRef) ?? [];
    if (matches.length === 0) {
        return [{ code: "unknown-content-ref", ref: contextRef }];
    }
    if (matches.length !== 1) {
        return [{ code: "ambiguous-context-ref", ref: contextRef }];
    }
    const item = matches[0];
    if (!item)
        return [{ code: "unknown-content-ref", ref: contextRef }];
    const issues = [];
    if (requirement.scopeRef !== bundle.scopeRef ||
        item.scopeRef !== bundle.scopeRef ||
        item.scopeRef !== requirement.scopeRef) {
        issues.push({ code: "context-scope-mismatch", ref: contextRef });
    }
    if (item.reviewAuthority !== "study" ||
        item.reviewStatus !== "study-reviewed") {
        issues.push({ code: "context-not-study-reviewed", ref: contextRef });
    }
    if (item.validity === "stale") {
        issues.push({ code: "context-stale", ref: contextRef });
    }
    else if (item.validity === "invalid") {
        issues.push({ code: "context-invalid", ref: contextRef });
    }
    if (item.contentDigest !== expectedDigest) {
        issues.push({ code: "content-digest-mismatch", ref: contextRef });
    }
    if (item.materialKind !== "instructional") {
        issues.push({ code: "unexpected-content-ref", ref: contextRef });
    }
    return issues;
}
function fallbackFor(bundle, contextsByRef) {
    const fallbackRef = bundle.fallbackContextRef;
    if (fallbackRef === null)
        return null;
    const matches = contextsByRef.get(fallbackRef) ?? [];
    if (matches.length !== 1)
        return null;
    const item = matches[0];
    if (!item ||
        item.scopeRef !== bundle.scopeRef ||
        item.materialKind !== "static-fallback" ||
        item.reviewAuthority !== "study" ||
        item.reviewStatus !== "study-reviewed" ||
        item.validity !== "valid") {
        return null;
    }
    return {
        kind: "reviewed-static-material",
        contextRef: item.contextRef,
        scopeRef: item.scopeRef,
        contentDigest: item.contentDigest,
        reviewAuthority: "study",
    };
}
function malformedAssessment(code) {
    return {
        confidence: "insufficient",
        groundedClaimRefs: [],
        unsupportedClaimRefs: [],
        issues: [{ code, ref: null }],
    };
}
function refusal(assessment, fallback) {
    return {
        status: "refused",
        code: INSUFFICIENT_GROUNDED_CONTEXT,
        proposalAllowed: false,
        providerOverrideAllowed: false,
        studyMutationAllowed: false,
        answerAuthorityExposed: false,
        assessment,
        fallback,
    };
}
function evaluateValidated(bundle, requirements, claims) {
    const issues = [];
    const groundedClaimRefs = [];
    const unsupportedClaimRefs = [];
    const contextsByRef = indexByRef(bundle.items, (item) => item.contextRef);
    const requirementsByRef = indexByRef(requirements, (requirement) => requirement.claimRef);
    const claimsByRef = indexByRef(claims, (claim) => claim.claimRef);
    for (const [contextRef, entries] of contextsByRef) {
        if (entries.length > 1) {
            issues.push({ code: "ambiguous-context-ref", ref: contextRef });
        }
    }
    for (const [claimRef, entries] of requirementsByRef) {
        if (entries.length > 1) {
            issues.push({ code: "duplicate-claim-ref", ref: claimRef });
            unsupportedClaimRefs.push(claimRef);
        }
    }
    for (const [claimRef, entries] of claimsByRef) {
        if (entries.length > 1) {
            issues.push({ code: "duplicate-claim-ref", ref: claimRef });
            unsupportedClaimRefs.push(claimRef);
        }
        if (!requirementsByRef.has(claimRef)) {
            issues.push({ code: "unknown-claim-ref", ref: claimRef });
            unsupportedClaimRefs.push(claimRef);
        }
    }
    for (const requirement of requirements) {
        const claimRef = requirement.claimRef;
        const requirementEntries = requirementsByRef.get(claimRef) ?? [];
        const claimEntries = claimsByRef.get(claimRef) ?? [];
        const claimIssues = [];
        if (requirement.scopeRef !== bundle.scopeRef) {
            claimIssues.push({ code: "scope-binding-mismatch", ref: claimRef });
        }
        if (bundle.assessmentPhase === ACTIVE_ASSESSMENT) {
            claimIssues.push({ code: "active-assessment-anti-answer", ref: claimRef });
        }
        const requiredRefs = requirement.requiredContext.map((entry) => entry.contextRef);
        if (new Set(requiredRefs).size !== requiredRefs.length) {
            claimIssues.push({ code: "duplicate-required-context-ref", ref: claimRef });
        }
        if (requirementEntries.length !== 1 || claimEntries.length !== 1) {
            if (claimEntries.length === 0) {
                claimIssues.push({ code: "unsupported-material-claim", ref: claimRef });
            }
        }
        else {
            const claim = claimEntries[0];
            if (claim) {
                const supportRefs = new Set(claim.supportRefs);
                if (supportRefs.size !== claim.supportRefs.length) {
                    claimIssues.push({ code: "duplicate-support-ref", ref: claimRef });
                }
                for (const supportRef of supportRefs) {
                    if (!requiredRefs.includes(supportRef)) {
                        claimIssues.push({
                            code: contextsByRef.has(supportRef)
                                ? "unexpected-content-ref"
                                : "unknown-content-ref",
                            ref: supportRef,
                        });
                    }
                }
                for (const required of requirement.requiredContext) {
                    if (!supportRefs.has(required.contextRef)) {
                        claimIssues.push({
                            code: "missing-required-context-ref",
                            ref: required.contextRef,
                        });
                        continue;
                    }
                    claimIssues.push(...resolveContext(requirement, required.contextRef, required.contentDigest, bundle, contextsByRef));
                }
            }
        }
        if (claimIssues.length === 0) {
            groundedClaimRefs.push(claimRef);
        }
        else {
            unsupportedClaimRefs.push(claimRef);
            issues.push(...claimIssues);
        }
    }
    const normalizedIssues = sortedIssues(issues);
    const normalizedGrounded = sortedUnique(groundedClaimRefs);
    const normalizedUnsupported = sortedUnique(unsupportedClaimRefs);
    const confidence = normalizedIssues.length === 0
        ? "sufficient"
        : normalizedGrounded.length > 0
            ? "partial"
            : "insufficient";
    const assessment = {
        confidence,
        groundedClaimRefs: normalizedGrounded,
        unsupportedClaimRefs: normalizedUnsupported,
        issues: normalizedIssues,
    };
    if (confidence !== "sufficient") {
        return refusal(assessment, fallbackFor(bundle, contextsByRef));
    }
    return {
        status: "grounded",
        proposalAllowed: true,
        providerOverrideAllowed: false,
        studyMutationAllowed: false,
        answerAuthorityExposed: false,
        assessment: {
            ...assessment,
            confidence: "sufficient",
        },
    };
}
/**
 * Evaluates provider claim references against trusted Study requirements and
 * reviewed context metadata. All three values are checked at the exact JSON
 * boundary. Callers must source bundle and requirements from Study; only the
 * claims parameter belongs to the untrusted provider proposal.
 */
export function evaluateGrounding(bundle, requirements, claims) {
    let bundleResult;
    try {
        bundleResult = validateExact(GroundedContextBundleSchema, bundle);
    }
    catch {
        return refusal(malformedAssessment("malformed-context-bundle"), null);
    }
    if (bundleResult.status === "rejected") {
        return refusal(malformedAssessment("malformed-context-bundle"), null);
    }
    const contextsByRef = indexByRef(bundleResult.value.items, (item) => item.contextRef);
    let requirementResult;
    try {
        requirementResult = validateExact(GroundingRequirementsSchema, requirements);
    }
    catch {
        return refusal(malformedAssessment("malformed-grounding-requirements"), fallbackFor(bundleResult.value, contextsByRef));
    }
    if (requirementResult.status === "rejected") {
        return refusal(malformedAssessment("malformed-grounding-requirements"), fallbackFor(bundleResult.value, contextsByRef));
    }
    let claimResult;
    try {
        claimResult = validateExact(GroundedClaimsSchema, claims);
    }
    catch {
        return refusal(malformedAssessment("malformed-grounding-claims"), fallbackFor(bundleResult.value, contextsByRef));
    }
    if (claimResult.status === "rejected") {
        return refusal(malformedAssessment("malformed-grounding-claims"), fallbackFor(bundleResult.value, contextsByRef));
    }
    return evaluateValidated(bundleResult.value, requirementResult.value, claimResult.value);
}
