import { Type, type Static } from "../../schema/typebox.js";
import {
  ActiveHintLevelSchema,
  AssessmentPhaseSchema,
  AssistanceLevelSchema,
  HintLevelSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
} from "../contracts/index.js";

export const LearnerStageHintProfileSchema = Type.Object(
  {
    profileKind: Type.Literal("approved-learning-stage-hint-policy"),
    profileRef: OpaqueReferenceSchema,
    learningStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
    approvalKind: Type.Literal("study-approved"),
    maximumHintEscalationsBeforeRecheck: Type.Integer({ minimum: 0, maximum: 8 }),
  },
  { additionalProperties: false, $id: "TutorV2LearnerStageHintProfile" },
);
export type LearnerStageHintProfile = Static<typeof LearnerStageHintProfileSchema>;

export const ReviewedHintMetadataSchema = Type.Object(
  {
    metadataKind: Type.Literal("study-reviewed-hint"),
    hintRef: OpaqueReferenceSchema,
    reviewedContentRef: OpaqueReferenceSchema,
    reviewRef: OpaqueReferenceSchema,
    hintLevel: ActiveHintLevelSchema,
    eligibleMisconceptionCodes: Type.Array(PolicyCodeSchema, { maxItems: 12 }),
    eligibleLearnerStageRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
  },
  { additionalProperties: false, $id: "TutorV2ReviewedHintMetadata" },
);
export type ReviewedHintMetadata = Static<typeof ReviewedHintMetadataSchema>;

export const HintInterventionHistoryEntrySchema = Type.Object(
  {
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interventionRef: OpaqueReferenceSchema,
    contextRef: OpaqueReferenceSchema,
    sourceInteractionRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    ordinal: Type.Integer({ minimum: 0, maximum: 10_000 }),
    interventionKind: Type.Union([
      Type.Literal("hint-provided"),
      Type.Literal("comprehension-recheck"),
      Type.Literal("learner-completion"),
      Type.Literal("reteach"),
    ]),
    hintLevel: HintLevelSchema,
    assistanceLevel: AssistanceLevelSchema,
  },
  { additionalProperties: false, $id: "TutorV2HintInterventionHistoryEntry" },
);
export type HintInterventionHistoryEntry = Static<
  typeof HintInterventionHistoryEntrySchema
>;

export const COMPLETED_ASSESSMENT_REVIEW_PERMISSION_VERSION =
  "study-tutor-v2.completed-assessment-review-permission.v1" as const;

export const CompletedAssessmentReviewPermissionSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("not-authorized"),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        permissionVersion: Type.Literal(
          COMPLETED_ASSESSMENT_REVIEW_PERMISSION_VERSION,
        ),
        status: Type.Literal("authorized"),
        permissionKind: Type.Literal(
          "study-completed-assessment-review-permission",
        ),
        issuer: Type.Literal("study"),
        permissionRef: OpaqueReferenceSchema,
        learnerScopeRef: OpaqueReferenceSchema,
        sessionRef: OpaqueReferenceSchema,
        instructionalContextRef: OpaqueReferenceSchema,
        opportunityRef: OpaqueReferenceSchema,
        reviewEventRef: OpaqueReferenceSchema,
        policyRevisionRef: OpaqueReferenceSchema,
        privacyApprovalRef: Type.Union([
          OpaqueReferenceSchema,
          Type.Null(),
        ]),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV2CompletedAssessmentReviewPermission" },
);
export type CompletedAssessmentReviewPermission = Static<
  typeof CompletedAssessmentReviewPermissionSchema
>;

export const HintSelectionRequestSchema = Type.Object(
  {
    requestKind: Type.Literal("bounded-hint-selection"),
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    contextRef: OpaqueReferenceSchema,
    currentOpportunityRef: OpaqueReferenceSchema,
    currentReviewEventRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    currentReviewPolicyRevisionRef: Type.Union([
      OpaqueReferenceSchema,
      Type.Null(),
    ]),
    assessmentPhase: AssessmentPhaseSchema,
    studyHintCeiling: HintLevelSchema,
    previousAssistanceLevel: AssistanceLevelSchema,
    attemptCount: Type.Integer({ minimum: 0, maximum: 100 }),
    misconceptionSignalCode: Type.Union([PolicyCodeSchema, Type.Null()]),
    learnerStageProfile: LearnerStageHintProfileSchema,
    reviewPermission: CompletedAssessmentReviewPermissionSchema,
    interventionHistory: Type.Array(HintInterventionHistoryEntrySchema, {
      maxItems: 24,
    }),
    reviewedHints: Type.Array(ReviewedHintMetadataSchema, { maxItems: 24 }),
  },
  { additionalProperties: false, $id: "TutorV2HintSelectionRequest" },
);
export type HintSelectionRequest = Static<typeof HintSelectionRequestSchema>;

export const HINT_SELECTION_REASON_CODES = [
  "attempt-not-yet-made",
  "active-assessment-structural-block",
  "completed-review-not-authorized",
  "study-hint-ceiling-none",
  "learner-stage-recheck-required",
  "reviewed-hint-unavailable",
  "attempt-count-recommendation",
  "misconception-signal-recommendation",
  "intervention-history-recommendation",
  "study-hint-ceiling-applied",
] as const;
export type HintSelectionReasonCode = (typeof HINT_SELECTION_REASON_CODES)[number];

export const HintSelectionReasonCodeSchema = Type.Union([
  Type.Literal("attempt-not-yet-made"),
  Type.Literal("active-assessment-structural-block"),
  Type.Literal("completed-review-not-authorized"),
  Type.Literal("study-hint-ceiling-none"),
  Type.Literal("learner-stage-recheck-required"),
  Type.Literal("reviewed-hint-unavailable"),
  Type.Literal("attempt-count-recommendation"),
  Type.Literal("misconception-signal-recommendation"),
  Type.Literal("intervention-history-recommendation"),
  Type.Literal("study-hint-ceiling-applied"),
]);

export const HintSelectionResultSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("recommended"),
        hintLevel: ActiveHintLevelSchema,
        hintMetadata: ReviewedHintMetadataSchema,
        assistanceLevel: AssistanceLevelSchema,
        reasonCodes: Type.Array(HintSelectionReasonCodeSchema, { minItems: 1, maxItems: 4 }),
        unrestrictedProviderProseAllowed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("no-hint"),
        hintLevel: Type.Literal("none"),
        hintMetadata: Type.Null(),
        assistanceLevel: AssistanceLevelSchema,
        reasonCodes: Type.Array(HintSelectionReasonCodeSchema, { minItems: 1, maxItems: 4 }),
        unrestrictedProviderProseAllowed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("rejected"),
        code: Type.Literal("INVALID_HINT_STATE"),
        tutorMayProvideHint: Type.Literal(false),
        unrestrictedProviderProseAllowed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV2HintSelectionResult" },
);
export type HintSelectionResult = Static<typeof HintSelectionResultSchema>;
