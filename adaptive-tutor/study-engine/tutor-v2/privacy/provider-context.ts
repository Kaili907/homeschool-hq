import { Type, type Static } from "../../../core/schema/typebox.js";
import {
  AllowedGroundingReferenceSchema,
  ApprovedEvidenceSummarySchema,
  AssessmentPhaseSchema,
  HintLevelSchema,
  LearnerSafeItemSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  StudyAuthorityContextSchema,
  TutorActionKindSchema,
  TutorSafetyConstraintsSchema,
  TutorV2VersionHeaderSchema,
  validateExact,
  type ExactValidationIssue,
} from "../../../core/v2/contracts/index.js";

export const PROVIDER_CONTEXT_ALLOWLIST = [
  "contractVersion",
  "actionSchemaVersion",
  "compatibilityId",
  "actionCompatibilityId",
  "contextKind",
  "interactionRef",
  "instruction.subjectRef",
  "instruction.conceptRef",
  "instruction.workingLevelInstructionRef (only when explicitly enabled)",
  "instruction.learnerStageRef",
  "instruction.learnerSafeItem",
  "instruction.currentLearnerAttempt (only with an ephemeral policy grant)",
  "instruction.approvedEvidenceSummary",
  "instruction.allowedActions",
  "instruction.hintCeiling",
  "instruction.assessmentPhase",
  "instruction.groundingReferences",
  "instruction.agePolicyParameters (only when explicitly enabled)",
  "instruction.safetyConstraints",
] as const;

export const PROVIDER_CONTEXT_DENYLIST = [
  "raw PIN or PIN",
  "authentication bearer or token",
  "parent, learner, or service-role credentials",
  "direct learner or household authority identifiers",
  "sibling records",
  "household private data",
  "adult private notes",
  "answer-key or scoring-authority locators",
  "mastery or working-level mutation authority",
  "full long-term learner profile",
  "raw Tutor conversation or transcript",
  "unknown fields of any kind",
] as const;

export const ProviderLearnerAttemptSchema = Type.Object(
  {
    itemRef: OpaqueReferenceSchema,
    responseFormat: PolicyCodeSchema,
    learnerResponse: Type.String({ minLength: 1, maxLength: 4000 }),
  },
  { additionalProperties: false, $id: "TutorV2ProviderLearnerAttempt" },
);
export type ProviderLearnerAttempt = Static<typeof ProviderLearnerAttemptSchema>;

export const ProviderEphemeralLearnerAttemptSchema = Type.Object(
  {
    itemRef: OpaqueReferenceSchema,
    responseFormat: PolicyCodeSchema,
    learnerResponse: Type.String({ minLength: 1, maxLength: 4000 }),
    policyPermissionRef: OpaqueReferenceSchema,
    persistenceAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV2ProviderEphemeralLearnerAttempt" },
);
export type ProviderEphemeralLearnerAttempt = Static<
  typeof ProviderEphemeralLearnerAttemptSchema
>;

export const ProviderAgePolicyParametersSchema = Type.Object(
  {
    agePolicyRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    responseStyleCode: PolicyCodeSchema,
    maximumResponseWords: Type.Integer({ minimum: 1, maximum: 1000 }),
  },
  { additionalProperties: false, $id: "TutorV2ProviderAgePolicyParameters" },
);
export type ProviderAgePolicyParameters = Static<
  typeof ProviderAgePolicyParametersSchema
>;

const LearnerAttemptDisclosureSchema = Type.Union([
  Type.Object(
    { mode: Type.Literal("omit") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("permit-current-attempt"),
      policyPermissionRef: OpaqueReferenceSchema,
      attempt: ProviderLearnerAttemptSchema,
    },
    { additionalProperties: false },
  ),
]);

const AgePolicyDisclosureSchema = Type.Union([
  Type.Object(
    { mode: Type.Literal("omit") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("include"),
      parameters: ProviderAgePolicyParametersSchema,
    },
    { additionalProperties: false },
  ),
]);

export const ProviderContextDisclosurePolicySchema = Type.Object(
  {
    workingLevel: Type.Union([Type.Literal("omit"), Type.Literal("include")]),
    learnerAttempt: LearnerAttemptDisclosureSchema,
    agePolicy: AgePolicyDisclosureSchema,
  },
  { additionalProperties: false, $id: "TutorV2ProviderContextDisclosurePolicy" },
);
export type ProviderContextDisclosurePolicy = Static<
  typeof ProviderContextDisclosurePolicySchema
>;

export const ProviderContextMinimizationInputSchema = Type.Object(
  {
    studyAuthorityContext: StudyAuthorityContextSchema,
    disclosurePolicy: ProviderContextDisclosurePolicySchema,
  },
  { additionalProperties: false, $id: "TutorV2ProviderContextMinimizationInput" },
);
export type ProviderContextMinimizationInput = Static<
  typeof ProviderContextMinimizationInputSchema
>;

export const MinimizedProviderInstructionSchema = Type.Object(
  {
    subjectRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    workingLevelInstructionRef: Type.Optional(Type.Union([OpaqueReferenceSchema])),
    learnerStageRef: OpaqueReferenceSchema,
    learnerSafeItem: Type.Union([LearnerSafeItemSchema, Type.Null()]),
    currentLearnerAttempt: Type.Optional(
      Type.Union([ProviderEphemeralLearnerAttemptSchema]),
    ),
    assessmentPhase: AssessmentPhaseSchema,
    approvedEvidenceSummary: ApprovedEvidenceSummarySchema,
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
    hintCeiling: HintLevelSchema,
    agePolicyParameters: Type.Optional(
      Type.Union([ProviderAgePolicyParametersSchema]),
    ),
    safetyConstraints: TutorSafetyConstraintsSchema,
    groundingReferences: Type.Array(AllowedGroundingReferenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
  },
  { additionalProperties: false, $id: "TutorV2MinimizedProviderInstruction" },
);
export type MinimizedProviderInstruction = Static<
  typeof MinimizedProviderInstructionSchema
>;

export const MinimizedProviderContextSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        contextKind: Type.Literal("provider"),
        interactionRef: OpaqueReferenceSchema,
        instruction: MinimizedProviderInstructionSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2MinimizedProviderContext" },
);
export type MinimizedProviderContext = Static<typeof MinimizedProviderContextSchema>;

export type ProviderContextPrivacyResult =
  | { readonly status: "accepted"; readonly value: MinimizedProviderContext }
  | {
      readonly status: "rejected";
      readonly code: "PROVIDER_CONTEXT_PRIVACY_REJECTED";
      readonly issues: readonly ExactValidationIssue[];
    };

function rejected(issues: readonly ExactValidationIssue[]): ProviderContextPrivacyResult {
  return {
    status: "rejected",
    code: "PROVIDER_CONTEXT_PRIVACY_REJECTED",
    issues,
  };
}

export function validateMinimizedProviderContext(
  value: unknown,
): ProviderContextPrivacyResult {
  const result = validateExact(MinimizedProviderContextSchema, value);
  return result.status === "accepted"
    ? { status: "accepted", value: result.value }
    : rejected(result.issues);
}

export function minimizeProviderContext(
  value: unknown,
): ProviderContextPrivacyResult {
  const inputResult = validateExact(ProviderContextMinimizationInputSchema, value);
  if (inputResult.status === "rejected") return rejected(inputResult.issues);

  const { studyAuthorityContext, disclosurePolicy } = inputResult.value;
  const source = studyAuthorityContext.instructionContext;

  if (disclosurePolicy.learnerAttempt.mode === "permit-current-attempt") {
    if (source.learnerSafeItem === null) {
      return rejected([
        {
          path: "$/disclosurePolicy/learnerAttempt/attempt/itemRef",
          message: "A learner attempt cannot be disclosed without a current learner-safe item.",
        },
      ]);
    }
    if (disclosurePolicy.learnerAttempt.attempt.itemRef !== source.learnerSafeItem.itemRef) {
      return rejected([
        {
          path: "$/disclosurePolicy/learnerAttempt/attempt/itemRef",
          message: "The learner attempt must be bound to the current learner-safe item.",
        },
      ]);
    }
  }

  if (
    disclosurePolicy.agePolicy.mode === "include" &&
    disclosurePolicy.agePolicy.parameters.learnerStageRef !== source.learnerStageRef
  ) {
    return rejected([
      {
        path: "$/disclosurePolicy/agePolicy/parameters/learnerStageRef",
        message: "Age-policy parameters must match the authorized learner stage.",
      },
    ]);
  }

  const learnerSafeItem = source.learnerSafeItem === null
    ? null
    : {
        itemRef: source.learnerSafeItem.itemRef,
        itemKind: source.learnerSafeItem.itemKind,
        learnerSafeContent: source.learnerSafeItem.learnerSafeContent,
      };

  const projection = {
    contractVersion: studyAuthorityContext.contractVersion,
    actionSchemaVersion: studyAuthorityContext.actionSchemaVersion,
    compatibilityId: studyAuthorityContext.compatibilityId,
    actionCompatibilityId: studyAuthorityContext.actionCompatibilityId,
    contextKind: "provider",
    interactionRef: studyAuthorityContext.interactionRef,
    instruction: {
      subjectRef: source.subjectRef,
      conceptRef: source.conceptRef,
      ...(disclosurePolicy.workingLevel === "include"
        ? { workingLevelInstructionRef: source.workingLevelInstructionRef }
        : {}),
      learnerStageRef: source.learnerStageRef,
      learnerSafeItem,
      ...(disclosurePolicy.learnerAttempt.mode === "permit-current-attempt"
        ? {
            currentLearnerAttempt: {
              itemRef: disclosurePolicy.learnerAttempt.attempt.itemRef,
              responseFormat: disclosurePolicy.learnerAttempt.attempt.responseFormat,
              learnerResponse: disclosurePolicy.learnerAttempt.attempt.learnerResponse,
              policyPermissionRef: disclosurePolicy.learnerAttempt.policyPermissionRef,
              persistenceAllowed: false,
            },
          }
        : {}),
      assessmentPhase: source.assessmentPhase,
      approvedEvidenceSummary: {
        summaryRef: source.approvedEvidenceSummary.summaryRef,
        evidenceCode: source.approvedEvidenceSummary.evidenceCode,
        attemptCount: source.approvedEvidenceSummary.attemptCount,
        assistanceLevel: source.approvedEvidenceSummary.assistanceLevel,
        observationRefs: [...source.approvedEvidenceSummary.observationRefs],
      },
      allowedActions: [...source.allowedActions],
      hintCeiling: source.hintCeiling,
      ...(disclosurePolicy.agePolicy.mode === "include"
        ? {
            agePolicyParameters: {
              agePolicyRef: disclosurePolicy.agePolicy.parameters.agePolicyRef,
              learnerStageRef: disclosurePolicy.agePolicy.parameters.learnerStageRef,
              responseStyleCode: disclosurePolicy.agePolicy.parameters.responseStyleCode,
              maximumResponseWords: disclosurePolicy.agePolicy.parameters.maximumResponseWords,
            },
          }
        : {}),
      safetyConstraints: {
        safetyMode: source.safetyConstraints.safetyMode,
        mayContinueAcademicFlow: source.safetyConstraints.mayContinueAcademicFlow,
        learnerSafeLanguageRequired: source.safetyConstraints.learnerSafeLanguageRequired,
        disallowedContentCodes: [...source.safetyConstraints.disallowedContentCodes],
      },
      groundingReferences: source.groundingReferences.map((reference) => ({
        groundingRef: reference.groundingRef,
        kind: reference.kind,
        contentDigest: reference.contentDigest,
        learnerSafeContent: reference.learnerSafeContent,
      })),
    },
  };

  return validateMinimizedProviderContext(projection);
}
