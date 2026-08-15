import { Type, type Static } from "../../schema/typebox.js";
import {
  AssessmentPhaseSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
} from "../../v2/contracts/primitives.js";

export const CURRICULUM_ADMISSION_VERSION =
  "study-tutor-v2.curriculum-admission.v1" as const;
export const CURRICULUM_METADATA_VERSION =
  "manuel-academy.accepted-curriculum.v1" as const;

export const CurriculumIdentifierSchema = Type.String({
  minLength: 2,
  maxLength: 160,
  pattern: "^[a-z0-9][a-z0-9-]*$",
});

export const CurriculumLessonBindingSchema = Type.Object(
  {
    lessonRef: CurriculumIdentifierSchema,
    unitRef: CurriculumIdentifierSchema,
  },
  { additionalProperties: false },
);
export type CurriculumLessonBinding = Static<typeof CurriculumLessonBindingSchema>;

export const CurriculumCourseMetadataSchema = Type.Object(
  {
    courseRef: CurriculumIdentifierSchema,
    subjectRef: CurriculumIdentifierSchema,
    grade: Type.Integer({ minimum: 0, maximum: 20 }),
    unitRefs: Type.Array(CurriculumIdentifierSchema, { minItems: 1, maxItems: 100 }),
    lessonBindings: Type.Array(CurriculumLessonBindingSchema, {
      minItems: 1,
      maxItems: 500,
    }),
  },
  { additionalProperties: false },
);
export type CurriculumCourseMetadata = Static<typeof CurriculumCourseMetadataSchema>;

export const TrustedCurriculumMetadataSchema = Type.Object(
  {
    metadataVersion: Type.Literal(CURRICULUM_METADATA_VERSION),
    metadataKind: Type.Literal("accepted-curriculum-metadata"),
    source: Type.Literal("accepted-curriculum-release"),
    releaseRef: CurriculumIdentifierSchema,
    releaseVersion: Type.String({ minLength: 1, maxLength: 40 }),
    reviewState: Type.Union([
      Type.Literal("reviewed"),
      Type.Literal("not-reviewed"),
    ]),
    admissionState: Type.Union([
      Type.Literal("admitted"),
      Type.Literal("not-admitted"),
    ]),
    courses: Type.Array(CurriculumCourseMetadataSchema, { minItems: 1, maxItems: 500 }),
  },
  { additionalProperties: false, $id: "TutorV3TrustedCurriculumMetadata" },
);
export type TrustedCurriculumMetadata = Static<typeof TrustedCurriculumMetadataSchema>;

export const CurriculumTutorRequestSchema = Type.Object(
  {
    requestVersion: Type.Literal(CURRICULUM_ADMISSION_VERSION),
    requestKind: Type.Literal("curriculum-tutor-admission-request"),
    capabilityRef: PolicyCodeSchema,
    courseRef: CurriculumIdentifierSchema,
    subjectRef: CurriculumIdentifierSchema,
    unitRef: Type.Union([CurriculumIdentifierSchema, Type.Null()]),
    lessonRef: Type.Union([CurriculumIdentifierSchema, Type.Null()]),
    nominalGrade: Type.Integer({ minimum: 0, maximum: 20 }),
    officialWorkingLevel: Type.Integer({ minimum: 0, maximum: 20 }),
    assessmentPhase: AssessmentPhaseSchema,
    actionFamily: PolicyCodeSchema,
  },
  { additionalProperties: false, $id: "TutorV3CurriculumTutorRequest" },
);
export type CurriculumTutorRequest = Static<typeof CurriculumTutorRequestSchema>;

export const StudyCurriculumAuthorityScopeSchema = Type.Object(
  {
    scopeKind: Type.Literal("study-curriculum-tutor-authority"),
    authorityRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    curriculumReleaseRef: CurriculumIdentifierSchema,
    courseRef: CurriculumIdentifierSchema,
    subjectRef: CurriculumIdentifierSchema,
    unitRef: Type.Union([CurriculumIdentifierSchema, Type.Null()]),
    lessonRef: Type.Union([CurriculumIdentifierSchema, Type.Null()]),
    nominalGrade: Type.Integer({ minimum: 0, maximum: 20 }),
    officialWorkingLevel: Type.Integer({ minimum: 0, maximum: 20 }),
    allowedActionFamilies: Type.Array(PolicyCodeSchema, { minItems: 1, maxItems: 32 }),
    curriculumAssignmentAllowed: Type.Literal(false),
    officialWorkingLevelMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3StudyCurriculumAuthorityScope" },
);
export type StudyCurriculumAuthorityScope = Static<
  typeof StudyCurriculumAuthorityScopeSchema
>;

export const TutorCapabilityDeclarationSchema = Type.Object(
  {
    declarationKind: Type.Literal("reviewed-tutor-capability"),
    declarationRef: OpaqueReferenceSchema,
    capabilityRef: PolicyCodeSchema,
    reviewState: Type.Union([
      Type.Literal("reviewed"),
      Type.Literal("not-reviewed"),
      Type.Literal("rejected"),
    ]),
    admissionState: Type.Union([
      Type.Literal("admitted"),
      Type.Literal("static-only"),
      Type.Literal("refused"),
    ]),
    deliveryMode: Type.Union([
      Type.Literal("free-form-instruction"),
      Type.Literal("reviewed-static"),
    ]),
    supportedCourseRefs: Type.Array(CurriculumIdentifierSchema, { maxItems: 500 }),
    supportedSubjectRefs: Type.Array(CurriculumIdentifierSchema, { maxItems: 100 }),
    allowedAssessmentPhases: Type.Array(AssessmentPhaseSchema, { minItems: 1, maxItems: 4 }),
    allowedActionFamilies: Type.Array(PolicyCodeSchema, { minItems: 1, maxItems: 32 }),
    unsupportedOutcome: Type.Union([
      Type.Literal("static-only"),
      Type.Literal("refuse"),
    ]),
  },
  { additionalProperties: false, $id: "TutorV3ReviewedCapabilityDeclaration" },
);
export type TutorCapabilityDeclaration = Static<typeof TutorCapabilityDeclarationSchema>;

export const CurriculumAdmissionInputSchema = Type.Object(
  {
    inputKind: Type.Literal("curriculum-tutor-admission"),
    request: CurriculumTutorRequestSchema,
    studyAuthorityScope: StudyCurriculumAuthorityScopeSchema,
    capabilityDeclaration: Type.Union([
      TutorCapabilityDeclarationSchema,
      Type.Null(),
    ]),
  },
  { additionalProperties: false, $id: "TutorV3CurriculumAdmissionInput" },
);
export type CurriculumAdmissionInput = Static<typeof CurriculumAdmissionInputSchema>;

export const CURRICULUM_ADMISSION_REASONS = [
  "curriculum-capability-admitted",
  "capability-static-only",
  "unsupported-tutor-capability-static-only",
  "active-assessment-static-only",
  "invalid-admission-input",
  "invalid-curriculum-metadata",
  "curriculum-release-not-admitted",
  "unknown-course",
  "course-subject-mismatch",
  "unknown-unit",
  "lesson-requires-unit",
  "unknown-lesson",
  "lesson-unit-mismatch",
  "official-working-level-unavailable",
  "course-working-level-mismatch",
  "study-authority-scope-mismatch",
  "action-family-not-authorized",
  "missing-reviewed-capability-declaration",
  "capability-declaration-not-reviewed",
  "invalid-capability-declaration",
  "unsupported-tutor-capability",
  "tutor-capability-refused",
] as const;
export type CurriculumAdmissionReason =
  (typeof CURRICULUM_ADMISSION_REASONS)[number];

export interface CurriculumTutorAuthorityExclusions {
  readonly scope: "curriculum-tutor-admission-only";
  readonly curriculumAssignmentAllowed: false;
  readonly curriculumMutationAllowed: false;
  readonly nominalGradeMutationAllowed: false;
  readonly officialWorkingLevelMutationAllowed: false;
  readonly studyAuthorityMutationAllowed: false;
}

interface BoundCurriculumDecision {
  readonly releaseRef: string;
  readonly courseRef: string;
  readonly subjectRef: string;
  readonly unitRef: string | null;
  readonly lessonRef: string | null;
  readonly nominalGrade: number;
  readonly officialWorkingLevel: number;
  readonly capabilityRef: string;
  readonly actionFamily: string;
}

export type CurriculumAdmissionDecision =
  | (CurriculumTutorAuthorityExclusions & BoundCurriculumDecision & {
      readonly status: "admitted";
      readonly reason: "curriculum-capability-admitted";
      readonly tutorInvocationAllowed: true;
      readonly freeFormInstructionAllowed: true;
      readonly staticCurriculumAllowed: true;
    })
  | (CurriculumTutorAuthorityExclusions & BoundCurriculumDecision & {
      readonly status: "static-only";
      readonly reason:
        | "capability-static-only"
        | "unsupported-tutor-capability-static-only"
        | "active-assessment-static-only";
      readonly tutorInvocationAllowed: false;
      readonly freeFormInstructionAllowed: false;
      readonly staticCurriculumAllowed: true;
    })
  | (CurriculumTutorAuthorityExclusions & {
      readonly status: "refused";
      readonly reason: Exclude<
        CurriculumAdmissionReason,
        | "curriculum-capability-admitted"
        | "capability-static-only"
        | "unsupported-tutor-capability-static-only"
        | "active-assessment-static-only"
      >;
      readonly tutorInvocationAllowed: false;
      readonly freeFormInstructionAllowed: false;
      readonly staticCurriculumAllowed: false;
    });
