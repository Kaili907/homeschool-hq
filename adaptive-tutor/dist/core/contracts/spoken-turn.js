import { Type } from "../schema/typebox.js";
import { LocaleSchema, StableIdSchema } from "./common.js";
export const SpokenTurnSchema = Type.Object({
    id: StableIdSchema,
    text: Type.String({ minLength: 1, maxLength: 2500 }),
    locale: LocaleSchema,
    pace: Type.Union([
        Type.Literal("slow"),
        Type.Literal("normal"),
        Type.Literal("brisk"),
    ]),
    emphasisTokens: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), { maxItems: 20 }),
    canInterrupt: Type.Boolean(),
    requireLearnerResponse: Type.Boolean(),
    fallbackText: Type.String({ minLength: 1, maxLength: 2500 }),
    captionsRequired: Type.Literal(true),
    transcriptRequired: Type.Literal(true),
    claimsHumanIdentity: Type.Literal(false),
}, { additionalProperties: false, $id: "SpokenTurn" });
//# sourceMappingURL=spoken-turn.js.map