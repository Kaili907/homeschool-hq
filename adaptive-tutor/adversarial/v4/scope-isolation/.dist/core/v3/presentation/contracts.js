import { Type } from "../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../v2/contracts/primitives.js";
import { ProviderModelProposalEnvelopeSchema, ProviderModelRefusalEnvelopeSchema, } from "../model-output/contracts.js";
export const PRESENTATION_CONTRACT_VERSION = "study-tutor-v2.presentation-intent.v1";
export const COMMERCIAL_RESPONSE_CONTRACT_VERSION = "study-tutor-v2.commercial-model-response.v1";
export const PresentationDeliveryChannelSchema = Type.Union([
    Type.Literal("text"),
    Type.Literal("visual"),
    Type.Literal("speech-after-acceptance"),
]);
export const ReviewedVisualIntentSchema = Type.Object({
    kind: Type.Union([Type.Literal("image"), Type.Literal("diagram")]),
    contentRef: OpaqueReferenceSchema,
    contentDigest: Type.String({ pattern: "^sha256:[a-f0-9]{64}$" }),
    provenanceRef: OpaqueReferenceSchema,
}, { additionalProperties: false, $id: "TutorV3ReviewedVisualIntent" });
export const FallbackPresentationIntentSchema = Type.Object({
    presentationRef: OpaqueReferenceSchema,
    requestedDeliveryChannels: Type.Array(Type.Union([Type.Literal("text"), Type.Literal("visual")]), { minItems: 1, maxItems: 2, uniqueItems: true }),
}, { additionalProperties: false, $id: "TutorV3FallbackPresentationIntent" });
/**
 * The canonical presentation vocabulary. Every instructional value is an
 * opaque reviewed reference. A caption is metadata and is deliberately not a
 * content slot or delivery channel.
 */
export const PresentationIntentSchema = Type.Object({
    contractVersion: Type.Literal(PRESENTATION_CONTRACT_VERSION),
    intentKind: Type.Literal("reference-only-presentation-intent"),
    reviewedTextRef: Type.Optional(OpaqueReferenceSchema),
    reviewedVisual: Type.Optional(ReviewedVisualIntentSchema),
    structuredCheckRef: Type.Optional(OpaqueReferenceSchema),
    accessibilityCaptionRef: Type.Optional(OpaqueReferenceSchema),
    requestedDeliveryChannels: Type.Array(PresentationDeliveryChannelSchema, {
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
    }),
    fallbackPresentation: Type.Optional(FallbackPresentationIntentSchema),
}, { additionalProperties: false, $id: "TutorV3PresentationIntent" });
export const PresentationMappingContextSchema = Type.Object({
    reviewedVisuals: Type.Array(ReviewedVisualIntentSchema, {
        maxItems: 12,
        uniqueItems: true,
    }),
    accessibilityCaptionRef: Type.Optional(OpaqueReferenceSchema),
    requestSpeechAfterAcceptance: Type.Boolean(),
    fallbackPresentation: Type.Optional(FallbackPresentationIntentSchema),
}, { additionalProperties: false, $id: "TutorV3PresentationMappingContext" });
export const ReferenceOnlyGroundingClaimSchema = Type.Object({
    claimKind: Type.Literal("reference-only-grounding-claim"),
    claimScope: Type.Literal("references-only"),
    groundingRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
}, { additionalProperties: false, $id: "TutorV3ReferenceOnlyGroundingClaim" });
export const CommercialProposalResponseSchema = Type.Object({
    contractVersion: Type.Literal(COMMERCIAL_RESPONSE_CONTRACT_VERSION),
    envelope: Type.Literal("commercial-model-response"),
    validationStatus: Type.Literal("accepted-proposal"),
    validatedOutput: ProviderModelProposalEnvelopeSchema,
    groundingClaim: ReferenceOnlyGroundingClaimSchema,
    presentationIntent: PresentationIntentSchema,
}, { additionalProperties: false, $id: "TutorV3CommercialProposalResponse" });
export const CommercialRefusalResponseSchema = Type.Object({
    contractVersion: Type.Literal(COMMERCIAL_RESPONSE_CONTRACT_VERSION),
    envelope: Type.Literal("commercial-model-response"),
    validationStatus: Type.Literal("refused"),
    validatedOutput: ProviderModelRefusalEnvelopeSchema,
    groundingClaim: ReferenceOnlyGroundingClaimSchema,
    presentationIntent: Type.Null(),
}, { additionalProperties: false, $id: "TutorV3CommercialRefusalResponse" });
export const CommercialModelResponseSchema = Type.Union([CommercialProposalResponseSchema, CommercialRefusalResponseSchema], { $id: "TutorV3CommercialModelResponse" });
export const TrustedPresentationAcceptanceSchema = Type.Object({
    acceptanceKind: Type.Literal("trusted-study-provider-output-acceptance"),
    acceptanceRef: OpaqueReferenceSchema,
    presentationIntent: PresentationIntentSchema,
}, { additionalProperties: false, $id: "TutorV3TrustedPresentationAcceptance" });
const ReviewedTextPieceSchema = Type.Object({
    pieceKind: Type.Literal("reviewed-text-reference"),
    contentRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReviewedVisualPieceSchema = Type.Object({
    pieceKind: Type.Union([
        Type.Literal("reviewed-image-reference"),
        Type.Literal("reviewed-diagram-reference"),
    ]),
    contentRef: OpaqueReferenceSchema,
    contentDigest: Type.String({ pattern: "^sha256:[a-f0-9]{64}$" }),
    provenanceRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const StructuredCheckPieceSchema = Type.Object({
    pieceKind: Type.Literal("structured-check-reference"),
    contentRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const AccessibilityCaptionPieceSchema = Type.Object({
    pieceKind: Type.Literal("accessibility-caption-metadata"),
    captionRef: OpaqueReferenceSchema,
    instructionalText: Type.Literal(false),
}, { additionalProperties: false });
const SpeechDeliveryPieceSchema = Type.Object({
    pieceKind: Type.Literal("speech-delivery"),
    deliveryChannel: Type.Literal("speech-after-acceptance"),
    sourceContentRef: OpaqueReferenceSchema,
    acceptanceRequired: Type.Literal(true),
    rawAudioAuthorityGranted: Type.Literal(false),
}, { additionalProperties: false });
const FallbackPresentationPieceSchema = Type.Object({
    pieceKind: Type.Literal("fallback-presentation-reference"),
    presentationRef: OpaqueReferenceSchema,
    requestedDeliveryChannels: Type.Array(Type.Union([Type.Literal("text"), Type.Literal("visual")]), { minItems: 1, maxItems: 2, uniqueItems: true }),
}, { additionalProperties: false });
export const W306PresentationPieceSchema = Type.Union([
    ReviewedTextPieceSchema,
    ReviewedVisualPieceSchema,
    StructuredCheckPieceSchema,
    AccessibilityCaptionPieceSchema,
    SpeechDeliveryPieceSchema,
    FallbackPresentationPieceSchema,
]);
export const W306PresentationPiecesSchema = Type.Object({
    adapterKind: Type.Literal("w3-06-reference-presentation-pieces"),
    acceptanceRef: OpaqueReferenceSchema,
    pieces: Type.Array(W306PresentationPieceSchema, { minItems: 1, maxItems: 6 }),
    rawAudioAccepted: Type.Literal(false),
    rawImageBytesAccepted: Type.Literal(false),
    providerRawMediaAccepted: Type.Literal(false),
}, { additionalProperties: false, $id: "TutorV3W306PresentationPieces" });
