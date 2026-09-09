import { Type } from "../../schema/typebox.js";
import { ContentDigestSchema, OpaqueReferenceSchema, PolicyCodeSchema, } from "./primitives.js";
export const INSUFFICIENT_GROUNDED_CONTEXT = "INSUFFICIENT_GROUNDED_CONTEXT";
export const GroundingReferenceKindSchema = Type.Union([
    Type.Literal("curriculum-excerpt"),
    Type.Literal("concept-definition"),
    Type.Literal("worked-example"),
    Type.Literal("source-citation"),
    Type.Literal("static-fallback"),
]);
export const AllowedGroundingReferenceSchema = Type.Object({
    groundingRef: OpaqueReferenceSchema,
    kind: GroundingReferenceKindSchema,
    contentDigest: ContentDigestSchema,
    learnerSafeContent: Type.Union([
        Type.String({ minLength: 1, maxLength: 4000 }),
        Type.Null(),
    ]),
}, { additionalProperties: false, $id: "TutorV2AllowedGroundingReference" });
export const ProviderGroundingClaimSchema = Type.Object({
    groundingRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
    claimKind: Type.Union([
        Type.Literal("direct-support"),
        Type.Literal("paraphrase-support"),
        Type.Literal("example-source"),
    ]),
}, { additionalProperties: false, $id: "TutorV2ProviderGroundingClaim" });
export const InvalidGroundingClaimSchema = Type.Object({
    groundingRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
}, { additionalProperties: false });
export const InsufficientGroundingAssessmentSchema = Type.Union([
    Type.Object({
        status: Type.Literal("insufficient-grounding"),
        code: Type.Literal(INSUFFICIENT_GROUNDED_CONTEXT),
        missingGroundingRefs: Type.Array(OpaqueReferenceSchema, {
            minItems: 1,
            maxItems: 12,
        }),
        invalidClaims: Type.Array(InvalidGroundingClaimSchema, { maxItems: 12 }),
    }, { additionalProperties: false }),
    Type.Object({
        status: Type.Literal("insufficient-grounding"),
        code: Type.Literal(INSUFFICIENT_GROUNDED_CONTEXT),
        missingGroundingRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 0 }),
        invalidClaims: Type.Array(InvalidGroundingClaimSchema, {
            minItems: 1,
            maxItems: 12,
        }),
    }, { additionalProperties: false }),
]);
export const GroundingAssessmentSchema = Type.Union([
    Type.Object({
        status: Type.Literal("grounded"),
        claims: Type.Array(ProviderGroundingClaimSchema, { minItems: 1, maxItems: 12 }),
    }, { additionalProperties: false }),
    Type.Object({
        status: Type.Literal("missing-grounding"),
        missingGroundingRefs: Type.Array(OpaqueReferenceSchema, {
            minItems: 1,
            maxItems: 12,
        }),
    }, { additionalProperties: false }),
    Type.Object({
        status: Type.Literal("invalid-grounding"),
        invalidClaims: Type.Array(InvalidGroundingClaimSchema, {
            minItems: 1,
            maxItems: 12,
        }),
    }, { additionalProperties: false }),
    InsufficientGroundingAssessmentSchema,
], { $id: "TutorV2GroundingAssessment" });
