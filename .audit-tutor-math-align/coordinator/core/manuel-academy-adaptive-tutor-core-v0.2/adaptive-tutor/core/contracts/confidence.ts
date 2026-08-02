import { Type, type Static } from "../schema/typebox.js";
import { EvidenceSourceSchema, StableIdSchema } from "./common.js";

export const ConfidenceObservationSchema = Type.Object(
  {
    id: StableIdSchema,
    skillId: StableIdSchema,
    source: EvidenceSourceSchema,
    score: Type.Number({ minimum: 0, maximum: 1 }),
    weight: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
    independence: Type.Number({ minimum: 0, maximum: 1 }),
    contextId: StableIdSchema,
    evidenceTags: Type.Array(StableIdSchema, { maxItems: 30 }),
  },
  { additionalProperties: false },
);

export const ConfidenceEstimateSchema = Type.Object(
  {
    skillId: StableIdSchema,
    value: Type.Number({ minimum: 0, maximum: 1 }),
    uncertainty: Type.Number({ minimum: 0, maximum: 1 }),
    lowerBound: Type.Number({ minimum: 0, maximum: 1 }),
    upperBound: Type.Number({ minimum: 0, maximum: 1 }),
    evidenceCount: Type.Integer({ minimum: 0 }),
    effectiveEvidence: Type.Number({ minimum: 0 }),
    distinctContextCount: Type.Integer({ minimum: 0 }),
    band: Type.Union([
      Type.Literal("very-low"),
      Type.Literal("low"),
      Type.Literal("developing"),
      Type.Literal("strong"),
      Type.Literal("insufficient-evidence"),
    ]),
    explanation: Type.String({ minLength: 1, maxLength: 1200 }),
    placementDecisionAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "ConfidenceEstimate" },
);

export type ConfidenceObservation = Static<typeof ConfidenceObservationSchema>;
export type ConfidenceEstimate = Static<typeof ConfidenceEstimateSchema>;
