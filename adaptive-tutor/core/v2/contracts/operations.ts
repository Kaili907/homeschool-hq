import { Type, type Static } from "../../schema/typebox.js";
import {
  AssistanceLevelSchema,
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  TutorActionKindSchema,
} from "./primitives.js";
import { TutorV2VersionHeaderSchema } from "./version.js";

export const ActionBudgetSchema = Type.Object(
  {
    remainingActions: Type.Integer({ minimum: 0, maximum: 20 }),
  },
  { additionalProperties: false },
);

export const RetryBudgetSchema = Type.Object(
  {
    remainingRetries: Type.Integer({ minimum: 0, maximum: 3 }),
  },
  { additionalProperties: false },
);

export const ProviderModelRouteSchema = Type.Object(
  {
    routeRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);

export const CostBudgetMetadataSchema = Type.Object(
  {
    unit: Type.Literal("integer-cost-unit"),
    maximumCostUnits: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const TutorBudgetRoutingContextSchema = Type.Object(
  {
    actionBudget: ActionBudgetSchema,
    timeoutBudgetMs: Type.Integer({ minimum: 50, maximum: 120000 }),
    retryBudget: RetryBudgetSchema,
    route: ProviderModelRouteSchema,
    costBudget: CostBudgetMetadataSchema,
  },
  { additionalProperties: false, $id: "TutorV2BudgetRoutingContext" },
);
export type TutorBudgetRoutingContext = Static<typeof TutorBudgetRoutingContextSchema>;

export const TutorShortTermStateSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        stateKind: Type.Literal("ephemeral-interaction-state"),
        interactionRef: OpaqueReferenceSchema,
        turnCount: Type.Integer({ minimum: 0, maximum: 24 }),
        assistanceLevel: AssistanceLevelSchema,
        highestHintUsed: HintLevelSchema,
        lastAction: Type.Union([TutorActionKindSchema, Type.Null()]),
        usedGroundingRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 24 }),
        expiresAt: ISODateTimeSchema,
        persistenceAllowed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2ShortTermState" },
);
export type TutorShortTermState = Static<typeof TutorShortTermStateSchema>;

export const TutorTelemetryOutcomeCodeSchema = Type.Union([
  Type.Literal("ACTION_PROPOSED"),
  Type.Literal("ACTION_ACCEPTED"),
  Type.Literal("POLICY_REJECTION"),
  Type.Literal("PROVIDER_UNAVAILABLE"),
  Type.Literal("PROVIDER_TIMEOUT"),
  Type.Literal("MALFORMED_RESPONSE"),
  Type.Literal("UNSUPPORTED_ACTION"),
  Type.Literal("SAFETY_STOP"),
  Type.Literal("STATIC_FALLBACK_REQUIRED"),
  Type.Literal("INSUFFICIENT_GROUNDED_CONTEXT"),
]);

export const TutorTelemetryEnvelopeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        telemetryKind: Type.Literal("minimized-operation"),
        interactionRef: OpaqueReferenceSchema,
        action: Type.Union([TutorActionKindSchema, Type.Null()]),
        providerRef: OpaqueReferenceSchema,
        modelRef: OpaqueReferenceSchema,
        inputTokenCount: Type.Integer({ minimum: 0 }),
        outputTokenCount: Type.Integer({ minimum: 0 }),
        latencyMs: Type.Integer({ minimum: 0 }),
        costUnits: Type.Integer({ minimum: 0 }),
        outcomeCode: TutorTelemetryOutcomeCodeSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2TelemetryEnvelope" },
);
export type TutorTelemetryEnvelope = Static<typeof TutorTelemetryEnvelopeSchema>;
