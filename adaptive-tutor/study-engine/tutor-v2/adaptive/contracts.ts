import { Type, type Static } from "../../../core/schema/typebox.js";
import {
  AssessmentPhaseSchema,
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  TutorActionKindSchema,
} from "../../../core/v2/contracts/index.js";
import {
  AdaptiveFeatureSchema,
  ReviewedContentAdmissionStateSchema,
  StudyAdaptiveCapabilityMetadataSchema,
} from "../../../core/v2/admission/index.js";
import { ConceptGraphSchema } from "../../../core/v2/concepts/index.js";
import {
  AcademicMisconceptionEntrySchema,
  AcademicMisconceptionMatchRequestSchema,
} from "../../../core/v2/misconceptions/index.js";
import { HintSelectionRequestSchema } from "../../../core/v2/hints/index.js";
import { InterventionLadderInputSchema } from "../../../core/v2/interventions/index.js";
import { StudyMasteryEvidenceInputSchema } from "../../../core/v2/mastery/index.js";

export const WAVE2_ADAPTIVE_COMPOSITION_VERSION =
  "study-tutor-v2.wave2-composition.v1" as const;

export const Wave2StudyAuthoritySchema = Type.Object(
  {
    authorityKind: Type.Literal("study-wave2-authority"),
    eventRef: OpaqueReferenceSchema,
    invocationBindingRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    subjectRef: OpaqueReferenceSchema,
    gradeRef: OpaqueReferenceSchema,
    curriculumBindingRef: OpaqueReferenceSchema,
    officialWorkingLevelRef: OpaqueReferenceSchema,
    instructionalContextRef: OpaqueReferenceSchema,
    currentConceptRef: OpaqueReferenceSchema,
    assessmentPhase: AssessmentPhaseSchema,
    studyHintCeiling: HintLevelSchema,
    safetyStatus: Type.Union([
      Type.Literal("academic-flow-admitted"),
      Type.Literal("academic-flow-held"),
    ]),
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
  },
  { additionalProperties: false, $id: "TutorV2Wave2StudyAuthority" },
);
export type Wave2StudyAuthority = Static<typeof Wave2StudyAuthoritySchema>;

export const Wave2ReviewedContentAdmissionSchema = Type.Object(
  {
    feature: AdaptiveFeatureSchema,
    admission: ReviewedContentAdmissionStateSchema,
  },
  { additionalProperties: false },
);

export const Wave2ConceptScopeBindingSchema = Type.Object(
  {
    conceptRef: OpaqueReferenceSchema,
    subjectRef: OpaqueReferenceSchema,
    gradeRef: OpaqueReferenceSchema,
    curriculumRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);

export const Wave2ReviewedRepairContentSchema = Type.Object(
  {
    conceptRef: OpaqueReferenceSchema,
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 12 }),
  },
  { additionalProperties: false },
);

export const Wave2RepairPolicySchema = Type.Object(
  {
    maximumDepth: Type.Integer({ minimum: 1, maximum: 64 }),
    reviewedStaticFallback: Type.Object(
      {
        fallbackRef: OpaqueReferenceSchema,
        reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 3 }),
      },
      { additionalProperties: false },
    ),
    reviewedContent: Type.Array(Wave2ReviewedRepairContentSchema, { maxItems: 12 }),
  },
  { additionalProperties: false },
);

export const Wave2ReteachPolicySchema = Type.Object(
  {
    maximumSteps: Type.Integer({ minimum: 1, maximum: 12 }),
    priorReteachLoops: Type.Integer({ minimum: 0, maximum: 100 }),
    maximumRepeatedLoops: Type.Integer({ minimum: 1, maximum: 12 }),
    reviewedStaticFallback: Type.Object(
      {
        fallbackRef: OpaqueReferenceSchema,
        reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 4 }),
      },
      { additionalProperties: false },
    ),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 4 }),
  },
  { additionalProperties: false },
);

export const Wave2ParentWhyRequestSchema = Type.Object(
  {
    selectedLearnerRef: OpaqueReferenceSchema,
    authorizedLearnerRef: OpaqueReferenceSchema,
    recommendationRef: OpaqueReferenceSchema,
    recommendationEventRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    producedAt: ISODateTimeSchema,
  },
  { additionalProperties: false },
);

export const Wave2ReviewedStaticFallbackSchema = Type.Object(
  {
    fallbackRef: OpaqueReferenceSchema,
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 12 }),
  },
  { additionalProperties: false },
);

export const Wave2AdaptiveCompositionRequestSchema = Type.Object(
  {
    compositionVersion: Type.Literal(WAVE2_ADAPTIVE_COMPOSITION_VERSION),
    requestKind: Type.Literal("study-wave2-adaptive-composition"),
    studyAuthority: Wave2StudyAuthoritySchema,
    capabilityMetadata: StudyAdaptiveCapabilityMetadataSchema,
    reviewedContentAdmissions: Type.Array(Wave2ReviewedContentAdmissionSchema, {
      minItems: 8,
      maxItems: 8,
    }),
    conceptGraph: ConceptGraphSchema,
    conceptScopeBindings: Type.Array(Wave2ConceptScopeBindingSchema, { minItems: 1, maxItems: 1_000 }),
    misconceptionRegistry: Type.Array(AcademicMisconceptionEntrySchema, { minItems: 1, maxItems: 1_000 }),
    misconceptionMatch: AcademicMisconceptionMatchRequestSchema,
    hintSelection: HintSelectionRequestSchema,
    intervention: InterventionLadderInputSchema,
    masteryEvidence: StudyMasteryEvidenceInputSchema,
    repairPolicy: Wave2RepairPolicySchema,
    reteachPolicy: Wave2ReteachPolicySchema,
    parentWhy: Type.Union([Wave2ParentWhyRequestSchema, Type.Null()]),
    reviewedStaticFallback: Wave2ReviewedStaticFallbackSchema,
  },
  { additionalProperties: false, $id: "TutorV2Wave2AdaptiveCompositionRequest" },
);
export type Wave2AdaptiveCompositionRequest = Static<
  typeof Wave2AdaptiveCompositionRequestSchema
>;

const Wave2AuthorityBoundarySchema = Type.Object(
  {
    studyDecisionRequired: Type.Literal(true),
    studyMutationAllowed: Type.Literal(false),
    studyEngineRemainsAuthority: Type.Literal(true),
    tutorCanChangeOfficialWorkingLevel: Type.Literal(false),
    tutorCanDeclareOfficialMastery: Type.Literal(false),
  },
  { additionalProperties: false },
);

const AdmissionProjectionSchema = Type.Object(
  {
    feature: AdaptiveFeatureSchema,
    status: Type.Union([Type.Literal("admitted"), Type.Literal("refused")]),
    reason: PolicyCodeSchema,
  },
  { additionalProperties: false },
);

const ConceptProjectionSchema = Type.Object(
  {
    status: Type.Literal("accepted"),
    currentConceptRef: OpaqueReferenceSchema,
    directPrerequisiteRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 1_000 }),
  },
  { additionalProperties: false },
);

const MisconceptionProjectionSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("no-signal"),
      Type.Literal("insufficient-evidence"),
      Type.Literal("possible-misconception"),
      Type.Literal("conflicting-evidence"),
    ]),
    academicMisconceptionCode: Type.Union([Type.String(), Type.Null()]),
    possibleInstructionalSignalOnly: Type.Literal(true),
    authoritativeDiagnosis: Type.Literal(false),
    durableLearnerClassificationAllowed: Type.Literal(false),
  },
  { additionalProperties: false },
);

const HintProjectionSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("recommended"), Type.Literal("no-hint")]),
    hintLevel: HintLevelSchema,
    reviewedContentRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    unrestrictedProviderProseAllowed: Type.Literal(false),
  },
  { additionalProperties: false },
);

const InterventionProjectionSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("recommended"), Type.Literal("blocked")]),
    actionKind: Type.Union([TutorActionKindSchema, Type.Null()]),
    reasonCode: PolicyCodeSchema,
    tutorMayExecute: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false },
);

const MasteryProjectionSchema = Type.Object(
  {
    evaluationStatus: Type.Union([Type.Literal("summarized"), Type.Literal("rejected")]),
    recommendation: Type.Union([
      Type.Literal("insufficient-evidence"),
      Type.Literal("emerging-evidence"),
      Type.Literal("supported-evidence"),
      Type.Literal("conflicting-evidence"),
    ]),
    sampleCount: Type.Integer({ minimum: 0, maximum: 100 }),
    authoritative: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false },
);

const RepairProjectionSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("proposed"), Type.Literal("withheld")]),
    proposalRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
    source: Type.Union([
      Type.Literal("adaptive"),
      Type.Literal("reviewed-static-fallback"),
      Type.Literal("none"),
    ]),
    recommendedConceptRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    appliedRepairDepth: Type.Integer({ minimum: 0, maximum: 3 }),
    workingLevelMutation: Type.Literal("none"),
    masteryWrite: Type.Literal("none"),
  },
  { additionalProperties: false },
);

const ReteachProjectionSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("proposed"), Type.Literal("withheld")]),
    proposalRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
    source: Type.Union([
      Type.Literal("adaptive"),
      Type.Literal("reviewed-static-fallback"),
      Type.Literal("none"),
    ]),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 4 }),
    stepCount: Type.Integer({ minimum: 0, maximum: 4 }),
    answerAuthority: Type.Literal("none"),
    activeAssessmentBypass: Type.Literal(false),
    workingLevelMutation: Type.Literal("none"),
    masteryWrite: Type.Literal("none"),
  },
  { additionalProperties: false },
);

const ParentProjectionSchema = Type.Object(
  {
    reasonCode: PolicyCodeSchema,
    title: Type.String({ minLength: 1, maxLength: 80 }),
    explanation: Type.String({ minLength: 1, maxLength: 240 }),
    disclaimer: Type.String({ minLength: 1, maxLength: 160 }),
    recommendationRef: OpaqueReferenceSchema,
    producedAt: ISODateTimeSchema,
  },
  { additionalProperties: false },
);

const PendingDecisionSchema = Type.Composite(
  [
    Wave2AuthorityBoundarySchema,
    Type.Object(
      {
        compositionVersion: Type.Literal(WAVE2_ADAPTIVE_COMPOSITION_VERSION),
        status: Type.Literal("pending-study-decision"),
        eventRef: OpaqueReferenceSchema,
        admissions: Type.Array(AdmissionProjectionSchema, { minItems: 7, maxItems: 8 }),
        concept: ConceptProjectionSchema,
        misconception: MisconceptionProjectionSchema,
        hint: HintProjectionSchema,
        intervention: InterventionProjectionSchema,
        mastery: MasteryProjectionSchema,
        repair: RepairProjectionSchema,
        reteach: ReteachProjectionSchema,
        parentExplanation: Type.Union([ParentProjectionSchema, Type.Null()]),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

const FallbackDecisionSchema = Type.Composite(
  [
    Wave2AuthorityBoundarySchema,
    Type.Object(
      {
        compositionVersion: Type.Literal(WAVE2_ADAPTIVE_COMPOSITION_VERSION),
        status: Type.Literal("reviewed-static-fallback"),
        eventRef: OpaqueReferenceSchema,
        reasonCode: PolicyCodeSchema,
        failedFeature: Type.Union([AdaptiveFeatureSchema, Type.Null()]),
        fallbackRef: OpaqueReferenceSchema,
        reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 12 }),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

const ReplayDecisionSchema = Type.Composite(
  [
    Wave2AuthorityBoundarySchema,
    Type.Object(
      {
        compositionVersion: Type.Literal(WAVE2_ADAPTIVE_COMPOSITION_VERSION),
        status: Type.Union([Type.Literal("duplicate-ignored"), Type.Literal("quarantined")]),
        eventRef: OpaqueReferenceSchema,
        reasonCode: PolicyCodeSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

export const Wave2StudyDecisionPacketSchema = Type.Union(
  [PendingDecisionSchema, FallbackDecisionSchema, ReplayDecisionSchema],
  { $id: "TutorV2Wave2StudyDecisionPacket" },
);
export type Wave2StudyDecisionPacket = Static<typeof Wave2StudyDecisionPacketSchema>;
