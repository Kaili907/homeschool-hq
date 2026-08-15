import { Type, type Static } from "../../../core/schema/typebox.js";
import {
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  validateExact,
} from "../../../core/v2/contracts/index.js";

export const PARENT_EXPLANATION_VERSION = "tutor-parent-explanation/v1" as const;

export const PARENT_EXPLANATION_REASON_CODES = [
  "prerequisite-review-suggested",
  "hint-level-change-proposed",
  "reteach-suggested",
  "break-suggested",
  "adult-review-requested",
  "evidence-not-yet-strong-enough",
  "independent-practice-requested",
  "tutor-unavailable-static-fallback-proposed",
] as const;

export type ParentExplanationReasonCode =
  (typeof PARENT_EXPLANATION_REASON_CODES)[number];

export interface ReviewedParentExplanationCopy {
  readonly title: string;
  readonly explanation: string;
}

export const REVIEWED_PARENT_EXPLANATION_COPY = {
  "prerequisite-review-suggested": {
    title: "Prerequisite review suggested",
    explanation:
      "Tutor suggested reviewing an earlier skill that may help with the current work.",
  },
  "hint-level-change-proposed": {
    title: "Hint level change proposed",
    explanation:
      "Tutor proposed changing the amount of help available for this part of the activity.",
  },
  "reteach-suggested": {
    title: "Reteach suggested",
    explanation:
      "Tutor suggested another explanation before the learner continues with this skill.",
  },
  "break-suggested": {
    title: "Break suggested",
    explanation:
      "Tutor suggested a brief pause before the learner continues the activity.",
  },
  "adult-review-requested": {
    title: "Adult review requested",
    explanation:
      "Tutor requested an authorized adult review of the next instructional step.",
  },
  "evidence-not-yet-strong-enough": {
    title: "More learning evidence needed",
    explanation:
      "The approved learning evidence was not yet strong enough to support moving ahead with less help.",
  },
  "independent-practice-requested": {
    title: "Independent practice requested",
    explanation:
      "Tutor requested another practice opportunity without Tutor help so Study can observe independent work.",
  },
  "tutor-unavailable-static-fallback-proposed": {
    title: "Reviewed fallback proposed",
    explanation:
      "Tutor was unavailable, so reviewed static guidance was proposed for Study to consider for this step.",
  },
} as const satisfies Record<
  ParentExplanationReasonCode,
  ReviewedParentExplanationCopy
>;

export const PARENT_EXPLANATION_DISCLAIMER =
  "This explains an existing recommendation. It does not make or change a learning decision." as const;

const ParentExplanationScopeProvenanceSchema = Type.Object(
  {
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    instructionalContextRef: OpaqueReferenceSchema,
    currentOpportunityRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);

export const ParentExplanationRequestSchema = Type.Object(
  {
    requestKind: Type.Literal("parent-hub-why"),
    scope: Type.Object(
      {
        householdScopeRef: OpaqueReferenceSchema,
        selectedLearnerRef: OpaqueReferenceSchema,
        authorizedLearnerRef: OpaqueReferenceSchema,
        sessionRef: OpaqueReferenceSchema,
        instructionalContextRef: OpaqueReferenceSchema,
        currentOpportunityRef: OpaqueReferenceSchema,
      },
      { additionalProperties: false },
    ),
    recommendation: Type.Object(
      {
        learnerRef: OpaqueReferenceSchema,
        recommendationRef: OpaqueReferenceSchema,
        reasonCode: PolicyCodeSchema,
        provenance: Type.Object(
          {
            producer: Type.Literal("study-engine"),
            recommendationEventRef: OpaqueReferenceSchema,
            policyRef: OpaqueReferenceSchema,
            producedAt: ISODateTimeSchema,
            scope: ParentExplanationScopeProvenanceSchema,
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "TutorV2ParentExplanationRequest" },
);
export type ParentExplanationRequest = Static<
  typeof ParentExplanationRequestSchema
>;

const ParentExplanationResultProvenanceSchema = Type.Object(
  {
    recommendationRef: OpaqueReferenceSchema,
    recommendationEventRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    producedAt: ISODateTimeSchema,
    scope: ParentExplanationScopeProvenanceSchema,
  },
  { additionalProperties: false },
);

export const ParentExplanationSchema = Type.Union(
  PARENT_EXPLANATION_REASON_CODES.map((reasonCode) => {
    const copy = REVIEWED_PARENT_EXPLANATION_COPY[reasonCode];
    return Type.Object(
      {
        explanationVersion: Type.Literal(PARENT_EXPLANATION_VERSION),
        audience: Type.Literal("parent-hub"),
        reasonCode: Type.Literal(reasonCode),
        title: Type.Literal(copy.title),
        explanation: Type.Literal(copy.explanation),
        disclaimer: Type.Literal(PARENT_EXPLANATION_DISCLAIMER),
        provenance: ParentExplanationResultProvenanceSchema,
      },
      { additionalProperties: false },
    );
  }),
  { $id: "TutorV2ParentExplanation" },
);
export type ParentExplanation = Static<typeof ParentExplanationSchema>;

export const ParentExplanationResultSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("accepted"),
        value: ParentExplanationSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("rejected"),
        code: Type.Union([
          Type.Literal("PARENT_EXPLANATION_REQUEST_REJECTED"),
          Type.Literal("PARENT_EXPLANATION_SCOPE_MISMATCH"),
          Type.Literal("PARENT_EXPLANATION_UNKNOWN_REASON"),
        ]),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV2ParentExplanationResult" },
);
export type ParentExplanationResult = Static<
  typeof ParentExplanationResultSchema
>;

function isKnownReasonCode(
  value: string,
): value is ParentExplanationReasonCode {
  return Object.hasOwn(REVIEWED_PARENT_EXPLANATION_COPY, value);
}

export function explainTutorRecommendationForParentHub(
  value: unknown,
): ParentExplanationResult {
  const requestResult = validateExact(ParentExplanationRequestSchema, value);
  if (requestResult.status === "rejected") {
    return {
      status: "rejected",
      code: "PARENT_EXPLANATION_REQUEST_REJECTED",
    };
  }

  const { recommendation, scope } = requestResult.value;
  const recommendationScope = recommendation.provenance.scope;
  if (
    scope.authorizedLearnerRef !== scope.selectedLearnerRef ||
    recommendation.learnerRef !== scope.selectedLearnerRef ||
    recommendationScope.householdScopeRef !== scope.householdScopeRef ||
    recommendationScope.learnerScopeRef !== scope.selectedLearnerRef ||
    recommendationScope.sessionRef !== scope.sessionRef ||
    recommendationScope.instructionalContextRef !==
      scope.instructionalContextRef ||
    recommendationScope.currentOpportunityRef !== scope.currentOpportunityRef
  ) {
    return {
      status: "rejected",
      code: "PARENT_EXPLANATION_SCOPE_MISMATCH",
    };
  }

  if (!isKnownReasonCode(recommendation.reasonCode)) {
    return {
      status: "rejected",
      code: "PARENT_EXPLANATION_UNKNOWN_REASON",
    };
  }

  const copy = REVIEWED_PARENT_EXPLANATION_COPY[recommendation.reasonCode];
  const explanation = {
    explanationVersion: PARENT_EXPLANATION_VERSION,
    audience: "parent-hub",
    reasonCode: recommendation.reasonCode,
    title: copy.title,
    explanation: copy.explanation,
    disclaimer: PARENT_EXPLANATION_DISCLAIMER,
    provenance: {
      recommendationRef: recommendation.recommendationRef,
      recommendationEventRef:
        recommendation.provenance.recommendationEventRef,
      policyRef: recommendation.provenance.policyRef,
      producedAt: recommendation.provenance.producedAt,
      scope: {
        householdScopeRef: recommendationScope.householdScopeRef,
        learnerScopeRef: recommendationScope.learnerScopeRef,
        sessionRef: recommendationScope.sessionRef,
        instructionalContextRef: recommendationScope.instructionalContextRef,
        currentOpportunityRef: recommendationScope.currentOpportunityRef,
      },
    },
  } as const;

  const explanationResult = validateExact(ParentExplanationSchema, explanation);
  if (explanationResult.status === "rejected") {
    return {
      status: "rejected",
      code: "PARENT_EXPLANATION_REQUEST_REJECTED",
    };
  }
  return { status: "accepted", value: explanationResult.value };
}
