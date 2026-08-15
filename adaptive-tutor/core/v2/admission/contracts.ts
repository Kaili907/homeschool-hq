import { Type, type Static } from "../../schema/typebox.js";
import { OpaqueReferenceSchema, PolicyCodeSchema } from "../contracts/primitives.js";

export const ADAPTIVE_ADMISSION_VERSION =
  "study-tutor-v2.adaptive-admission.v1" as const;
export const ADAPTIVE_CAPABILITY_METADATA_VERSION =
  "study-tutor-v2.adaptive-capabilities.v1" as const;

export const ADAPTIVE_FEATURES = [
  "concept-prerequisite-graph",
  "misconception-analysis",
  "hint-ladder",
  "intervention-ladder",
  "mastery-evidence",
  "prerequisite-repair",
  "reteach",
  "parent-explanation",
] as const;

export type AdaptiveFeature = (typeof ADAPTIVE_FEATURES)[number];

export const AdaptiveFeatureSchema = Type.Union([
  Type.Literal("concept-prerequisite-graph"),
  Type.Literal("misconception-analysis"),
  Type.Literal("hint-ladder"),
  Type.Literal("intervention-ladder"),
  Type.Literal("mastery-evidence"),
  Type.Literal("prerequisite-repair"),
  Type.Literal("reteach"),
  Type.Literal("parent-explanation"),
]);

export const CapabilityAdmissionStateSchema = Type.Union([
  Type.Literal("admitted"),
  Type.Literal("not-admitted"),
]);
export type CapabilityAdmissionState = Static<typeof CapabilityAdmissionStateSchema>;

export const ReviewedContentAdmissionStateSchema = Type.Union([
  Type.Literal("admitted"),
  Type.Literal("not-admitted"),
]);
export type ReviewedContentAdmissionState = Static<
  typeof ReviewedContentAdmissionStateSchema
>;

export const AdaptiveCapabilityRecordSchema = Type.Object(
  {
    feature: AdaptiveFeatureSchema,
    admission: CapabilityAdmissionStateSchema,
    actionFamilies: Type.Array(PolicyCodeSchema, { minItems: 1, maxItems: 24 }),
    reviewedContent: Type.Union([
      Type.Literal("not-required"),
      Type.Literal("required"),
    ]),
  },
  { additionalProperties: false, $id: "TutorV2AdaptiveCapabilityRecord" },
);
export type AdaptiveCapabilityRecord = Static<typeof AdaptiveCapabilityRecordSchema>;

export const StudyAdaptiveCapabilityMetadataSchema = Type.Object(
  {
    metadataVersion: Type.Literal(ADAPTIVE_CAPABILITY_METADATA_VERSION),
    metadataKind: Type.Literal("study-adaptive-capabilities"),
    source: Type.Literal("study-authority"),
    invocationBindingRef: OpaqueReferenceSchema,
    subjectRef: OpaqueReferenceSchema,
    curriculumBindingRef: OpaqueReferenceSchema,
    curriculumAdmission: CapabilityAdmissionStateSchema,
    safetyAdmission: Type.Union([
      Type.Literal("admitted"),
      Type.Literal("restricted"),
    ]),
    capabilities: Type.Array(AdaptiveCapabilityRecordSchema, {
      maxItems: ADAPTIVE_FEATURES.length,
    }),
  },
  { additionalProperties: false, $id: "TutorV2StudyAdaptiveCapabilityMetadata" },
);
export type StudyAdaptiveCapabilityMetadata = Static<
  typeof StudyAdaptiveCapabilityMetadataSchema
>;

export const AdaptiveAdmissionRequestSchema = Type.Object(
  {
    requestVersion: Type.Literal(ADAPTIVE_ADMISSION_VERSION),
    requestKind: Type.Literal("study-adaptive-admission-request"),
    invocationBindingRef: OpaqueReferenceSchema,
    subjectRef: OpaqueReferenceSchema,
    curriculumBindingRef: OpaqueReferenceSchema,
    feature: AdaptiveFeatureSchema,
    actionFamily: PolicyCodeSchema,
    reviewedContentAdmission: ReviewedContentAdmissionStateSchema,
  },
  { additionalProperties: false, $id: "TutorV2AdaptiveAdmissionRequest" },
);
export type AdaptiveAdmissionRequest = Static<typeof AdaptiveAdmissionRequestSchema>;

export const StudyAdaptiveAdmissionInputSchema = Type.Object(
  {
    inputKind: Type.Literal("study-adaptive-admission"),
    request: AdaptiveAdmissionRequestSchema,
    capabilityMetadata: StudyAdaptiveCapabilityMetadataSchema,
  },
  { additionalProperties: false, $id: "TutorV2StudyAdaptiveAdmissionInput" },
);
export type StudyAdaptiveAdmissionInput = Static<typeof StudyAdaptiveAdmissionInputSchema>;

export const ADMISSION_REFUSAL_REASONS = [
  "insufficient-capability-metadata",
  "unsupported-subject-capability",
  "unsupported-action-family",
  "safety-restricted",
  "curriculum-not-admitted",
  "reviewed-content-required",
  "adaptive-feature-not-admitted",
] as const;
export type AdmissionRefusalReason = (typeof ADMISSION_REFUSAL_REASONS)[number];

export interface TutorFeatureAuthorityExclusions {
  readonly scope: "tutor-feature-permission-only";
  readonly officialGradeMutationAllowed: false;
  readonly workingLevelMutationAllowed: false;
  readonly masteryDeclarationAllowed: false;
  readonly curriculumMutationAllowed: false;
  readonly permissionMutationAllowed: false;
  readonly safetyClearanceAllowed: false;
  readonly guardianAuthorityAllowed: false;
  readonly answerAuthorityExposed: false;
}

export type AdaptiveAdmissionDecision =
  | (TutorFeatureAuthorityExclusions & {
      readonly status: "admitted";
      readonly reason: "admitted";
      readonly tutorFeaturePermission: "allowed";
      readonly invocationBindingRef: string;
      readonly subjectRef: string;
      readonly curriculumBindingRef: string;
      readonly feature: AdaptiveFeature;
      readonly actionFamily: string;
    })
  | (TutorFeatureAuthorityExclusions & {
      readonly status: "refused";
      readonly reason: AdmissionRefusalReason;
      readonly tutorFeaturePermission: "denied";
    });
