import { Type, type Static } from "../../schema/typebox.js";

export const MULTIMODAL_CONTRACT_VERSION = "3.0.0-foundation.1" as const;

export const MultimodalReferenceSchema = Type.String({
  minLength: 3,
  maxLength: 160,
  pattern: "^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$",
});
export type MultimodalReference = Static<typeof MultimodalReferenceSchema>;

export const MultimodalDigestSchema = Type.String({
  pattern: "^sha256:[a-f0-9]{64}$",
});
export type MultimodalDigest = Static<typeof MultimodalDigestSchema>;

export const MultimodalISODateTimeSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const MultimodalModeSchema = Type.Union([
  Type.Literal("text"),
  Type.Literal("speech"),
  Type.Literal("reviewed-image"),
  Type.Literal("reviewed-diagram"),
  Type.Literal("caption"),
]);
export type MultimodalMode = Static<typeof MultimodalModeSchema>;

export const MULTIMODAL_MODES = [
  "text",
  "speech",
  "reviewed-image",
  "reviewed-diagram",
  "caption",
] as const satisfies readonly MultimodalMode[];

export const MediaInferenceRestrictionsSchema = Type.Object(
  {
    biometricInferenceAllowed: Type.Literal(false),
    emotionInferenceAllowed: Type.Literal(false),
    faceIdentityAllowed: Type.Literal(false),
    personalityClassificationAllowed: Type.Literal(false),
    diagnosticClassificationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3MediaInferenceRestrictions" },
);
export type MediaInferenceRestrictions = Static<typeof MediaInferenceRestrictionsSchema>;

export const TRANSIENT_MEDIA_INFERENCE_RESTRICTIONS = Object.freeze({
  biometricInferenceAllowed: false,
  emotionInferenceAllowed: false,
  faceIdentityAllowed: false,
  personalityClassificationAllowed: false,
  diagnosticClassificationAllowed: false,
} as const satisfies MediaInferenceRestrictions);

export const TransientMediaDescriptorSchema = Type.Object(
  {
    mediaRef: MultimodalReferenceSchema,
    mediaKind: Type.Union([Type.Literal("raw-audio"), Type.Literal("raw-learner-image")]),
    mimeType: Type.String({
      minLength: 7,
      maxLength: 96,
      pattern: "^(?:audio|image)/[a-z0-9][a-z0-9.+-]*$",
    }),
    byteLength: Type.Integer({ minimum: 1, maximum: 52_428_800 }),
    capturedAt: MultimodalISODateTimeSchema,
    disposition: Type.Literal("transient-memory-only"),
    persistenceAllowed: Type.Literal(false),
    inferenceRestrictions: MediaInferenceRestrictionsSchema,
  },
  { additionalProperties: false, $id: "TutorV3TransientMediaDescriptor" },
);
export type TransientMediaDescriptor = Static<typeof TransientMediaDescriptorSchema>;

/**
 * Raw bytes deliberately have no JSON schema. They are an in-memory capability
 * paired with a strictly transient descriptor and must never cross a durable
 * evidence boundary.
 */
export interface TransientMediaPayload {
  readonly descriptor: TransientMediaDescriptor;
  readonly bytes: Uint8Array;
}

export const TransientTranscriptSchema = Type.Object(
  {
    transcriptRef: MultimodalReferenceSchema,
    text: Type.String({ minLength: 1, maxLength: 8_000 }),
    locale: Type.String({ minLength: 2, maxLength: 35, pattern: "^[A-Za-z0-9-]+$" }),
    persistence: Type.Literal("disabled"),
    expiresWithTurn: Type.Literal(true),
  },
  { additionalProperties: false, $id: "TutorV3TransientTranscript" },
);
export type TransientTranscript = Static<typeof TransientTranscriptSchema>;

export const AvailableCaptionSchema = Type.Object(
  {
    captionRef: MultimodalReferenceSchema,
    text: Type.String({ minLength: 1, maxLength: 8_000 }),
    locale: Type.String({ minLength: 2, maxLength: 35, pattern: "^[A-Za-z0-9-]+$" }),
    availability: Type.Literal("available"),
    persistence: Type.Literal("transient-session-only"),
  },
  { additionalProperties: false, $id: "TutorV3AvailableCaption" },
);
export type AvailableCaption = Static<typeof AvailableCaptionSchema>;

export const VisualStepReferenceSchema = Type.Object(
  {
    visualStepRef: MultimodalReferenceSchema,
    stepIndex: Type.Integer({ minimum: 1, maximum: 200 }),
  },
  { additionalProperties: false, $id: "TutorV3VisualStepReference" },
);
export type VisualStepReference = Static<typeof VisualStepReferenceSchema>;

export const ReviewedVisualReferenceSchema = Type.Object(
  {
    visualRef: MultimodalReferenceSchema,
    visualKind: Type.Union([Type.Literal("image"), Type.Literal("diagram")]),
    contentDigest: MultimodalDigestSchema,
    reviewStatus: Type.Literal("approved"),
    reviewRef: MultimodalReferenceSchema,
    reviewedAt: MultimodalISODateTimeSchema,
    learnerSafe: Type.Literal(true),
  },
  { additionalProperties: false, $id: "TutorV3ReviewedVisualReference" },
);
export type ReviewedVisualReference = Static<typeof ReviewedVisualReferenceSchema>;

export const TransientLearnerImageReviewRequestSchema = Type.Object(
  {
    requestRef: MultimodalReferenceSchema,
    image: Type.Composite([
      TransientMediaDescriptorSchema,
      Type.Object(
        { mediaKind: Type.Literal("raw-learner-image") },
        { additionalProperties: false },
      ),
    ]),
    reviewPurpose: Type.Literal("learner-safe-curricular-content"),
    outputMayContainRawImage: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3TransientLearnerImageReviewRequest" },
);
export type TransientLearnerImageReviewRequest = Static<
  typeof TransientLearnerImageReviewRequestSchema
>;

export const LearnerImageReviewDecisionSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("approved"),
        requestRef: MultimodalReferenceSchema,
        reviewedVisual: ReviewedVisualReferenceSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("rejected"),
        requestRef: MultimodalReferenceSchema,
        reasonCode: Type.String({
          minLength: 3,
          maxLength: 96,
          pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
        }),
        lessonContinuation: Type.Literal("required"),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV3LearnerImageReviewDecision" },
);
export type LearnerImageReviewDecision = Static<typeof LearnerImageReviewDecisionSchema>;

const TextContentSchema = Type.Object(
  {
    mode: Type.Literal("text"),
    text: Type.String({ minLength: 1, maxLength: 8_000 }),
  },
  { additionalProperties: false },
);

const SpeechContentSchema = Type.Object(
  {
    mode: Type.Literal("speech"),
    audio: Type.Composite([
      TransientMediaDescriptorSchema,
      Type.Object({ mediaKind: Type.Literal("raw-audio") }, { additionalProperties: false }),
    ]),
    transcript: TransientTranscriptSchema,
  },
  { additionalProperties: false },
);

const ReviewedImageContentSchema = Type.Object(
  {
    mode: Type.Literal("reviewed-image"),
    visual: Type.Composite([
      ReviewedVisualReferenceSchema,
      Type.Object({ visualKind: Type.Literal("image") }, { additionalProperties: false }),
    ]),
  },
  { additionalProperties: false },
);

const ReviewedDiagramContentSchema = Type.Object(
  {
    mode: Type.Literal("reviewed-diagram"),
    visual: Type.Composite([
      ReviewedVisualReferenceSchema,
      Type.Object({ visualKind: Type.Literal("diagram") }, { additionalProperties: false }),
    ]),
  },
  { additionalProperties: false },
);

const CaptionContentSchema = Type.Object(
  {
    mode: Type.Literal("caption"),
    captionRef: MultimodalReferenceSchema,
  },
  { additionalProperties: false },
);

export const MultimodalContentSchema = Type.Union(
  [
    TextContentSchema,
    SpeechContentSchema,
    ReviewedImageContentSchema,
    ReviewedDiagramContentSchema,
    CaptionContentSchema,
  ],
  { $id: "TutorV3MultimodalContent" },
);
export type MultimodalContent = Static<typeof MultimodalContentSchema>;

export const AssessmentDisclosurePolicySchema = Type.Union(
  [
    Type.Object(
      {
        phase: Type.Literal("active-assessment"),
        antiAnswerPolicy: Type.Literal("required"),
        answerExposure: Type.Union([Type.Literal("none"), Type.Literal("bounded-hint")]),
        appliesToAllModalities: Type.Literal(true),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        phase: Type.Union([
          Type.Literal("instruction-or-practice"),
          Type.Literal("completed-assessment-review"),
          Type.Literal("non-graded-review"),
        ]),
        antiAnswerPolicy: Type.Literal("not-active"),
        answerExposure: Type.Union([
          Type.Literal("none"),
          Type.Literal("bounded-hint"),
          Type.Literal("reviewed-answer"),
        ]),
        appliesToAllModalities: Type.Literal(true),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV3AssessmentDisclosurePolicy" },
);
export type AssessmentDisclosurePolicy = Static<typeof AssessmentDisclosurePolicySchema>;

export const MultimodalPresentationSchema = Type.Object(
  {
    contractVersion: Type.Literal(MULTIMODAL_CONTRACT_VERSION),
    envelope: Type.Literal("multimodal-presentation"),
    interactionRef: MultimodalReferenceSchema,
    turnRef: MultimodalReferenceSchema,
    speaker: Type.Union([Type.Literal("learner"), Type.Literal("tutor")]),
    content: MultimodalContentSchema,
    caption: AvailableCaptionSchema,
    visualStep: Type.Optional(VisualStepReferenceSchema),
    assessmentDisclosure: AssessmentDisclosurePolicySchema,
  },
  { additionalProperties: false, $id: "TutorV3MultimodalPresentation" },
);
export type MultimodalPresentation = Static<typeof MultimodalPresentationSchema>;

export const ContinuationFallbackSchema = Type.Object(
  {
    mode: Type.Union([Type.Literal("text"), Type.Literal("caption")]),
    contentRef: MultimodalReferenceSchema,
    caption: AvailableCaptionSchema,
    lessonContinuation: Type.Literal("required"),
    blocking: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3ContinuationFallback" },
);
export type ContinuationFallback = Static<typeof ContinuationFallbackSchema>;

export const MultimodalDeliveryOutcomeSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("delivered"),
        interactionRef: MultimodalReferenceSchema,
        turnRef: MultimodalReferenceSchema,
        mode: MultimodalModeSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("media-unavailable"),
        interactionRef: MultimodalReferenceSchema,
        turnRef: MultimodalReferenceSchema,
        failedMode: Type.Union([
          Type.Literal("speech"),
          Type.Literal("reviewed-image"),
          Type.Literal("reviewed-diagram"),
        ]),
        reasonCode: Type.Union([
          Type.Literal("media-timeout"),
          Type.Literal("media-unavailable"),
          Type.Literal("media-unsupported"),
          Type.Literal("review-rejected"),
        ]),
        fallback: ContinuationFallbackSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV3MultimodalDeliveryOutcome" },
);
export type MultimodalDeliveryOutcome = Static<typeof MultimodalDeliveryOutcomeSchema>;

export const MultimodalObservationOutcomeSchema = Type.Union([
  Type.Literal("demonstrated"),
  Type.Literal("not-demonstrated"),
  Type.Literal("inconclusive"),
]);
export type MultimodalObservationOutcome = Static<
  typeof MultimodalObservationOutcomeSchema
>;

export const MultimodalAssistanceLevelSchema = Type.Union([
  Type.Literal("independent"),
  Type.Literal("light-hint"),
  Type.Literal("guided"),
  Type.Literal("reteach-required"),
]);
export type MultimodalAssistanceLevel = Static<typeof MultimodalAssistanceLevelSchema>;

const ReviewedVisualEvidenceMetadataSchema = Type.Object(
  {
    visualRef: MultimodalReferenceSchema,
    reviewRef: MultimodalReferenceSchema,
    contentDigest: MultimodalDigestSchema,
    visualKind: Type.Union([Type.Literal("image"), Type.Literal("diagram")]),
    reviewStatus: Type.Literal("approved"),
  },
  { additionalProperties: false },
);

export const DurableMultimodalEvidenceSchema = Type.Object(
  {
    contractVersion: Type.Literal(MULTIMODAL_CONTRACT_VERSION),
    envelope: Type.Literal("durable-multimodal-evidence"),
    evidenceRef: MultimodalReferenceSchema,
    sessionRef: MultimodalReferenceSchema,
    interactionRef: MultimodalReferenceSchema,
    turnRef: MultimodalReferenceSchema,
    mode: MultimodalModeSchema,
    outcome: MultimodalObservationOutcomeSchema,
    assistanceLevel: MultimodalAssistanceLevelSchema,
    observedAt: MultimodalISODateTimeSchema,
    captionRef: MultimodalReferenceSchema,
    captionAvailability: Type.Literal("available"),
    transcriptPersisted: Type.Literal(false),
    rawMediaPersisted: Type.Literal(false),
    reviewedVisual: Type.Optional(ReviewedVisualEvidenceMetadataSchema),
    visualStep: Type.Optional(VisualStepReferenceSchema),
  },
  { additionalProperties: false, $id: "TutorV3DurableMultimodalEvidence" },
);
export type DurableMultimodalEvidence = Static<typeof DurableMultimodalEvidenceSchema>;

export interface MultimodalEvidenceProjectionSource {
  readonly evidenceRef: MultimodalReference;
  readonly sessionRef: MultimodalReference;
  readonly presentation: MultimodalPresentation;
  readonly outcome: MultimodalObservationOutcome;
  readonly assistanceLevel: MultimodalAssistanceLevel;
  readonly observedAt: string;
  readonly transient?: {
    readonly rawAudio?: Uint8Array;
    readonly rawLearnerImage?: Uint8Array;
    readonly transcriptText?: string;
    readonly captionText?: string;
  };
}
