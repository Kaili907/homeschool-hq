import { Type, type Static } from "../../schema/typebox.js";
import { AllowedGroundingReferenceSchema } from "./grounding.js";
import {
  AssessmentPhaseSchema,
  AssistanceLevelSchema,
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  TutorActionKindSchema,
} from "./primitives.js";
import { TutorV2VersionHeaderSchema } from "./version.js";

export const ApprovedEvidenceSummarySchema = Type.Object(
  {
    summaryRef: OpaqueReferenceSchema,
    evidenceCode: PolicyCodeSchema,
    attemptCount: Type.Integer({ minimum: 0, maximum: 100 }),
    assistanceLevel: AssistanceLevelSchema,
    observationRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
  },
  { additionalProperties: false, $id: "TutorV2ApprovedEvidenceSummary" },
);
export type ApprovedEvidenceSummary = Static<typeof ApprovedEvidenceSummarySchema>;

export const TutorSafetyConstraintsSchema = Type.Object(
  {
    safetyMode: Type.Union([Type.Literal("standard"), Type.Literal("restricted")]),
    mayContinueAcademicFlow: Type.Boolean(),
    learnerSafeLanguageRequired: Type.Literal(true),
    disallowedContentCodes: Type.Array(PolicyCodeSchema, { maxItems: 24 }),
  },
  { additionalProperties: false, $id: "TutorV2SafetyConstraints" },
);
export type TutorSafetyConstraints = Static<typeof TutorSafetyConstraintsSchema>;

export const LearnerSafeItemSchema = Type.Object(
  {
    itemRef: OpaqueReferenceSchema,
    itemKind: PolicyCodeSchema,
    learnerSafeContent: Type.String({ minLength: 1, maxLength: 4000 }),
  },
  { additionalProperties: false, $id: "TutorV2LearnerSafeItem" },
);
export type LearnerSafeItem = Static<typeof LearnerSafeItemSchema>;

export const TutorInstructionContextSchema = Type.Object(
  {
    contextKind: Type.Literal("tutor-instruction"),
    subjectRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    workingLevelInstructionRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    learnerSafeItem: Type.Union([LearnerSafeItemSchema, Type.Null()]),
    assessmentPhase: AssessmentPhaseSchema,
    approvedEvidenceSummary: ApprovedEvidenceSummarySchema,
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
    hintCeiling: HintLevelSchema,
    safetyConstraints: TutorSafetyConstraintsSchema,
    groundingReferences: Type.Array(AllowedGroundingReferenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
  },
  { additionalProperties: false, $id: "TutorV2InstructionContext" },
);
export type TutorInstructionContext = Static<typeof TutorInstructionContextSchema>;

export const StudyPolicyReferencesSchema = Type.Object(
  {
    authorityPolicyRef: OpaqueReferenceSchema,
    assessmentPolicyRef: OpaqueReferenceSchema,
    answerPolicyRef: OpaqueReferenceSchema,
    safetyPolicyRef: OpaqueReferenceSchema,
    privacyPolicyRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);

export const StudyAuthorityContextSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        contextKind: Type.Literal("study-authority"),
        interactionRef: OpaqueReferenceSchema,
        invocationBindingRef: OpaqueReferenceSchema,
        authorizationRef: OpaqueReferenceSchema,
        authorizationRevision: Type.Integer({ minimum: 1 }),
        safetyClearanceRef: OpaqueReferenceSchema,
        policyRefs: StudyPolicyReferencesSchema,
        instructionContext: TutorInstructionContextSchema,
        issuedAt: ISODateTimeSchema,
        expiresAt: ISODateTimeSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2StudyAuthorityContext" },
);
export type StudyAuthorityContext = Static<typeof StudyAuthorityContextSchema>;

export const ProviderInstructionProjectionSchema = Type.Object(
  {
    subjectRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    learnerSafeItem: Type.Union([LearnerSafeItemSchema, Type.Null()]),
    assessmentPhase: AssessmentPhaseSchema,
    approvedEvidenceSummary: ApprovedEvidenceSummarySchema,
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
    hintCeiling: HintLevelSchema,
    safetyConstraints: TutorSafetyConstraintsSchema,
    groundingReferences: Type.Array(AllowedGroundingReferenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
  },
  { additionalProperties: false },
);

export const ProviderContextSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        contextKind: Type.Literal("provider"),
        interactionRef: OpaqueReferenceSchema,
        instruction: ProviderInstructionProjectionSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2ProviderContext" },
);
export type ProviderContext = Static<typeof ProviderContextSchema>;
