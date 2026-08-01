import { Type, type Static } from "../schema/typebox.js";
import { AssessmentItemSchema } from "./assessment.js";
import { StableIdSchema } from "./common.js";
import { ConfidenceEstimateSchema } from "./confidence.js";
import { SpokenTurnSchema } from "./spoken-turn.js";
import { VisualBoardCommandSchema } from "./visual-board.js";

export const TutorPhaseSchema = Type.Union([
  Type.Literal("assessment"),
  Type.Literal("identify-missing-concept"),
  Type.Literal("teach-visually"),
  Type.Literal("guided-practice"),
  Type.Literal("independent-attempt"),
  Type.Literal("reassess"),
  Type.Literal("advance"),
  Type.Literal("reteach"),
  Type.Literal("escalated"),
]);
export type TutorPhase = Static<typeof TutorPhaseSchema>;

export const TutorResponseSchema = Type.Object(
  {
    id: StableIdSchema,
    phase: TutorPhaseSchema,
    skillId: StableIdSchema,
    learnerMessage: Type.String({ minLength: 1, maxLength: 3000 }),
    spokenTurn: SpokenTurnSchema,
    boardCommands: Type.Array(VisualBoardCommandSchema, { maxItems: 80 }),
    assessmentItem: Type.Union([AssessmentItemSchema, Type.Null()]),
    expectedInput: Type.Union([
      Type.Literal("none"),
      Type.Literal("continue"),
      Type.Literal("answer"),
      Type.Literal("adult-review"),
    ]),
    oneUsefulStepOnly: Type.Literal(true),
    givesFinalGradedAnswer: Type.Literal(false),
    asksLearnerToParticipate: Type.Boolean(),
    uncertaintyStatement: Type.String({ minLength: 1, maxLength: 1000 }),
    confidence: Type.Union([ConfidenceEstimateSchema, Type.Null()]),
    alternateExplanationAvailable: Type.Boolean(),
    escalationReason: Type.Union([Type.String({ minLength: 1, maxLength: 1000 }), Type.Null()]),
    jarvisClaimsHumanIdentity: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorResponse" },
);
export type TutorResponse = Static<typeof TutorResponseSchema>;
