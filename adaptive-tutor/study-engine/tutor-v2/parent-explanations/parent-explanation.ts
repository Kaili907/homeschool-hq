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
  "hint-level-changed",
  "reteach-suggested",
  "break-suggested",
  "adult-review-requested",
  "evidence-not-yet-strong-enough",
  "independent-practice-requested",
  "tutor-unavailable-static-fallback-used",
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
  "hint-level-changed": {
    title: "Hint level changed",
    explanation:
      "Tutor changed the amount of help offered for this part of the activity.",
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
  "tutor-unavailable-static-fallback-used": {
    title: "Reviewed fallback used",
    explanation:
      "Tutor was unavailable, so Study used reviewed static guidance for this step.",
  },
} as const satisfies Record<
  ParentExplanationReasonCode,
  ReviewedParentExplanationCopy
>;

export const PARENT_EXPLANATION_DISCLAIMER =
  "This explains an existing recommendation. It does not make or change a learning decision." as const;

export const ParentExplanationRequestSchema = Type.Object(
  {
    requestKind: Type.Literal("parent-hub-why"),
    scope: Type.Object(
      {
        selectedLearnerRef: OpaqueReferenceSchema,
        authorizedLearnerRef: OpaqueReferenceSchema,
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

export const ParentExplanationSchema = Type.Object(
  {
    explanationVersion: Type.Literal(PARENT_EXPLANATION_VERSION),
    audience: Type.Literal("parent-hub"),
    reasonCode: Type.Union(
      PARENT_EXPLANATION_REASON_CODES.map((code) => Type.Literal(code)),
    ),
    title: Type.String({ minLength: 1, maxLength: 80 }),
    explanation: Type.String({ minLength: 1, maxLength: 240 }),
    disclaimer: Type.Literal(PARENT_EXPLANATION_DISCLAIMER),
    provenance: Type.Object(
      {
        recommendationRef: OpaqueReferenceSchema,
        producedAt: ISODateTimeSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "TutorV2ParentExplanation" },
);
export type ParentExplanation = Static<typeof ParentExplanationSchema>;

export type ParentExplanationResult =
  | { readonly status: "accepted"; readonly value: ParentExplanation }
  | {
      readonly status: "rejected";
      readonly code:
        | "PARENT_EXPLANATION_REQUEST_REJECTED"
        | "PARENT_EXPLANATION_SCOPE_MISMATCH"
        | "PARENT_EXPLANATION_UNKNOWN_REASON";
    };

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
  if (
    scope.authorizedLearnerRef !== scope.selectedLearnerRef ||
    recommendation.learnerRef !== scope.selectedLearnerRef
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
      producedAt: recommendation.provenance.producedAt,
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
