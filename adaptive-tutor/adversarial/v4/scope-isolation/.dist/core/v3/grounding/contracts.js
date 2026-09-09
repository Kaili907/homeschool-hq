import { Type } from "../../schema/typebox.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { AssessmentPhaseSchema, ContentDigestSchema, OpaqueReferenceSchema, } from "../../v2/contracts/primitives.js";
export const GROUNDING_CONTRACT_VERSION = "study-tutor-v2.grounding.v3";
export const INSUFFICIENT_GROUNDED_CONTEXT = "INSUFFICIENT_GROUNDED_CONTEXT";
export const GROUNDING_CONFIDENCE_CLASSES = [
    "sufficient",
    "partial",
    "insufficient",
];
export const GroundedContextItemSchema = Type.Object({
    contextRef: OpaqueReferenceSchema,
    scopeRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
    materialKind: Type.Union([
        Type.Literal("instructional"),
        Type.Literal("static-fallback"),
    ]),
    reviewAuthority: Type.Literal("study"),
    reviewStatus: Type.Union([
        Type.Literal("study-reviewed"),
        Type.Literal("not-reviewed"),
    ]),
    validity: Type.Union([
        Type.Literal("valid"),
        Type.Literal("stale"),
        Type.Literal("invalid"),
    ]),
}, { additionalProperties: false, $id: "TutorV3GroundedContextItem" });
export const GroundedContextBundleSchema = Type.Object({
    contractVersion: Type.Literal(GROUNDING_CONTRACT_VERSION),
    bundleRef: OpaqueReferenceSchema,
    source: Type.Literal("study-authority"),
    scopeRef: OpaqueReferenceSchema,
    assessmentPhase: AssessmentPhaseSchema,
    items: Type.Array(GroundedContextItemSchema, { maxItems: 64 }),
    fallbackContextRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
}, { additionalProperties: false, $id: "TutorV3GroundedContextBundle" });
export const RequiredContextReferenceSchema = Type.Object({
    contextRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
}, { additionalProperties: false });
/**
 * A trusted Study-side declaration of what must support one material claim.
 * The provider cannot author or weaken this requirement.
 */
export const GroundingRequirementSchema = Type.Object({
    claimRef: OpaqueReferenceSchema,
    scopeRef: OpaqueReferenceSchema,
    claimKind: Type.Union([
        Type.Literal("factual"),
        Type.Literal("instructional"),
    ]),
    requiredContext: Type.Array(RequiredContextReferenceSchema, {
        minItems: 1,
        maxItems: 16,
    }),
}, { additionalProperties: false, $id: "TutorV3GroundingRequirement" });
/**
 * The complete untrusted provider contribution. Review, validity, digest,
 * scope, and confidence attestations are intentionally absent.
 */
export const GroundedClaimSchema = Type.Object({
    claimRef: OpaqueReferenceSchema,
    supportRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 16,
    }),
}, { additionalProperties: false, $id: "TutorV3GroundedClaim" });
export const GroundingRequirementsSchema = Type.Array(GroundingRequirementSchema, { maxItems: 32 });
export const GroundedClaimsSchema = Type.Array(GroundedClaimSchema, {
    maxItems: 32,
});
export const GROUNDING_ISSUE_CODES = [
    "active-assessment-anti-answer",
    "ambiguous-context-ref",
    "content-digest-mismatch",
    "context-invalid",
    "context-not-study-reviewed",
    "context-scope-mismatch",
    "context-stale",
    "duplicate-claim-ref",
    "duplicate-required-context-ref",
    "duplicate-support-ref",
    "malformed-context-bundle",
    "malformed-grounding-claims",
    "malformed-grounding-requirements",
    "missing-required-context-ref",
    "scope-binding-mismatch",
    "unexpected-content-ref",
    "unknown-claim-ref",
    "unknown-content-ref",
    "unsupported-material-claim",
];
export function validateGroundedContextBundle(value) {
    try {
        return validateExact(GroundedContextBundleSchema, value).status === "accepted";
    }
    catch {
        return false;
    }
}
export function validateGroundingRequirements(value) {
    try {
        return validateExact(GroundingRequirementsSchema, value).status === "accepted";
    }
    catch {
        return false;
    }
}
export function validateGroundedClaims(value) {
    try {
        return validateExact(GroundedClaimsSchema, value).status === "accepted";
    }
    catch {
        return false;
    }
}
