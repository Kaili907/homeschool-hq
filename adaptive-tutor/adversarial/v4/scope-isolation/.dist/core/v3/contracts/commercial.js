import { Type } from "../../schema/typebox.js";
import { AssessmentPhaseSchema, ContentDigestSchema, OpaqueReferenceSchema, TutorActionKindSchema, } from "../../v2/contracts/primitives.js";
import { GroundedClaimsSchema, GroundedContextBundleSchema, GroundingRequirementsSchema, } from "../grounding/index.js";
import { ProviderModelOutputEnvelopeSchema } from "../model-output/index.js";
import { PresentationIntentSchema, PresentationMappingContextSchema } from "../presentation/index.js";
import { CommercialReviewedContentEvidenceSchema, } from "../provider-request/index.js";
import { CanonicalIntegerMicrosSchema } from "../commercial-operation/contracts.js";
import { TutorCommercialTelemetryEventSchema } from "../telemetry/index.js";
export const STUDY_COMMERCIAL_TUTOR_INVOCATION_VERSION = "study-tutor-v3.commercial-invocation.v1";
export const BOUNDED_COMMERCIAL_PROVIDER_RESPONSE_VERSION = "study-tutor-v3.bounded-provider-response.v1";
export const STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION = "study-tutor-v3.commercial-advisory.v1";
export const STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION = "study-tutor-v3.commercial-effect-receipt.v1";
const CurriculumIdentifierSchema = Type.String({
    minLength: 2,
    maxLength: 160,
    pattern: "^[a-z0-9][a-z0-9-]*$",
});
const RevisionStringSchema = Type.String({
    minLength: 1,
    maxLength: 80,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
});
const ActionFamilySchema = Type.Union([
    Type.Literal("EXPLANATION"),
    Type.Literal("HINT"),
    Type.Literal("GUIDING_QUESTION"),
    Type.Literal("GROUNDED_EXAMPLE"),
    Type.Literal("PREREQUISITE_RECOMMENDATION"),
    Type.Literal("PARENT_SAFE_DRAFT"),
]);
const SubjectCapabilitySchema = Type.Union([
    Type.Literal("NUMERICAL_REASONING"),
    Type.Literal("SYMBOLIC_REASONING"),
    Type.Literal("PROSE_EXPLANATION"),
    Type.Literal("SOURCE_GROUNDED_ANALYSIS"),
    Type.Literal("SPATIAL_VISUAL_INTERPRETATION"),
    Type.Literal("MULTILINGUAL_EXPLANATION"),
]);
const InstructionalDisplayModeSchema = Type.Union([
    Type.Literal("reviewed-text"),
    Type.Literal("reviewed-visual"),
    Type.Literal("reviewed-text-and-visual"),
    Type.Literal("structured-check"),
]);
export const StudyCommercialTutorInvocationSchema = Type.Object({
    contractVersion: Type.Literal(STUDY_COMMERCIAL_TUTOR_INVOCATION_VERSION),
    invocationKind: Type.Literal("trusted-study-commercial-tutor-invocation"),
    issuedBy: Type.Literal("study-engine"),
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    subjectRef: OpaqueReferenceSchema,
    nominalGradeRef: OpaqueReferenceSchema,
    officialWorkingLevelRef: OpaqueReferenceSchema,
    nominalGrade: Type.Integer({ minimum: 0, maximum: 20 }),
    officialWorkingLevel: Type.Integer({ minimum: 0, maximum: 20 }),
    curriculum: Type.Object({
        releaseRef: CurriculumIdentifierSchema,
        packageRef: OpaqueReferenceSchema,
        version: RevisionStringSchema,
        digest: ContentDigestSchema,
        courseRef: CurriculumIdentifierSchema,
        subjectId: CurriculumIdentifierSchema,
        unitRef: CurriculumIdentifierSchema,
        lessonRef: CurriculumIdentifierSchema,
        conceptRef: OpaqueReferenceSchema,
        opportunityRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    learnerStageRef: OpaqueReferenceSchema,
    assessmentPhase: AssessmentPhaseSchema,
    requestedActionFamily: ActionFamilySchema,
    subjectCapability: SubjectCapabilitySchema,
    allowedTutorActions: Type.Array(TutorActionKindSchema, {
        minItems: 1,
        maxItems: 9,
        uniqueItems: true,
    }),
    requestedPresentation: Type.Object({
        modalityRequirement: Type.Union([
            Type.Literal("TEXT_ONLY"),
            Type.Literal("REVIEWED_IMAGE"),
        ]),
        allowedDisplayModes: Type.Array(InstructionalDisplayModeSchema, {
            minItems: 1,
            maxItems: 4,
            uniqueItems: true,
        }),
        mappingContext: PresentationMappingContextSchema,
    }, { additionalProperties: false }),
    reviewedContentEvidence: Type.Array(CommercialReviewedContentEvidenceSchema, {
        minItems: 1,
        maxItems: 12,
    }),
    groundedContext: GroundedContextBundleSchema,
    groundingRequirements: GroundingRequirementsSchema,
    authorization: Type.Object({
        curriculumAuthorityRef: OpaqueReferenceSchema,
        curriculumPolicyRevisionRef: OpaqueReferenceSchema,
        learnerStageCatalogVersion: RevisionStringSchema,
        learnerStagePolicyRevisionRef: OpaqueReferenceSchema,
        providerPolicyRevisionRef: OpaqueReferenceSchema,
        configurationRef: OpaqueReferenceSchema,
        safetyPolicyRef: OpaqueReferenceSchema,
        presentationPolicyRef: OpaqueReferenceSchema,
        studyPermissionRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    authorityBoundary: Type.Object({
        tutorRecommendationIsAdvisory: Type.Literal(true),
        studyProgressionDecisionRequired: Type.Literal(true),
        tutorCanCompleteStudySegment: Type.Literal(false),
        tutorCanDeclareOfficialMastery: Type.Literal(false),
        tutorCanChangeOfficialWorkingLevel: Type.Literal(false),
        tutorCanChangeNominalGrade: Type.Literal(false),
        tutorCanAssignCurriculum: Type.Literal(false),
        tutorCanClearSafety: Type.Literal(false),
        tutorCanGrantGuardianAuthority: Type.Literal(false),
    }, { additionalProperties: false }),
}, { additionalProperties: false, $id: "StudyCommercialTutorInvocation" });
export const BoundedCommercialProviderResponseSchema = Type.Object({
    responseVersion: Type.Literal(BOUNDED_COMMERCIAL_PROVIDER_RESPONSE_VERSION),
    responseKind: Type.Literal("bounded-commercial-provider-response"),
    output: ProviderModelOutputEnvelopeSchema,
    groundedClaims: GroundedClaimsSchema,
    metrics: Type.Object({
        inputTokenCount: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
        outputTokenCount: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
        latencyMs: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
        costMicros: CanonicalIntegerMicrosSchema,
    }, { additionalProperties: false }),
}, { additionalProperties: false, $id: "BoundedCommercialProviderResponse" });
export const COMMERCIAL_ADVISORY_REASON_CODES = [
    "COMMERCIAL_PROPOSAL_READY",
    "PROVIDER_REFUSED",
    "CURRICULUM_ADMISSION_FAILED",
    "LEARNER_STAGE_POLICY_FAILED",
    "NO_ELIGIBLE_PROVIDER_ROUTE",
    "BUDGET_OR_DEADLINE_EXHAUSTED",
    "PROVIDER_TRANSPORT_FAILED",
    "UNTRUSTED_MODEL_OUTPUT_REJECTED",
    "INSUFFICIENT_GROUNDED_CONTEXT",
    "PRESENTATION_INTENT_REJECTED",
];
const CommercialAdvisoryReasonCodeSchema = Type.Union(COMMERCIAL_ADVISORY_REASON_CODES.map((reason) => Type.Literal(reason)));
export const StudyCommercialTutorAdvisorySchema = Type.Object({
    contractVersion: Type.Literal(STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION),
    advisoryKind: Type.Literal("study-commercial-tutor-advisory"),
    invocationRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    status: Type.Union([
        Type.Literal("proposed"),
        Type.Literal("refused"),
        Type.Literal("static-fallback-required"),
    ]),
    proposedTutorAction: Type.Union([TutorActionKindSchema, Type.Null()]),
    reasonCodes: Type.Array(CommercialAdvisoryReasonCodeSchema, {
        minItems: 1,
        maxItems: COMMERCIAL_ADVISORY_REASON_CODES.length,
        uniqueItems: true,
    }),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    groundingDecision: Type.Union([
        Type.Literal("sufficient"),
        Type.Literal("insufficient"),
        Type.Literal("not-executed"),
    ]),
    assistanceEvidenceRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    presentationIntent: Type.Union([PresentationIntentSchema, Type.Null()]),
    studyDecisionRequired: Type.Literal(true),
    studyMutationAllowed: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    officialWorkingLevelAuthority: Type.Literal(false),
    nominalGradeAuthority: Type.Literal(false),
    curriculumAuthority: Type.Literal(false),
    segmentCompletionAuthority: Type.Literal(false),
}, { additionalProperties: false, $id: "StudyCommercialTutorAdvisory" });
export const StudyCommercialEffectReceiptSchema = Type.Object({
    contractVersion: Type.Literal(STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION),
    receiptKind: Type.Literal("trusted-study-commercial-effect-receipt"),
    issuedBy: Type.Literal("study-engine"),
    receiptRef: OpaqueReferenceSchema,
    invocationRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    decision: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
    effectRef: OpaqueReferenceSchema,
    effectDigest: ContentDigestSchema,
    studyProgressCommitted: Type.Boolean(),
    tutorMutationAuthorityGranted: Type.Literal(false),
}, { additionalProperties: false, $id: "StudyCommercialEffectReceipt" });
/** Serialized audit envelope; its payload is already minimized by W3-09. */
export const CommercialOperationTelemetryEnvelopeSchema = Type.Object({
    envelopeKind: Type.Literal("commercial-operation-telemetry-envelope"),
    event: TutorCommercialTelemetryEventSchema,
}, { additionalProperties: false, $id: "CommercialOperationTelemetryEnvelope" });
