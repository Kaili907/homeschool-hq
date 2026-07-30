import { type Static } from "../schema/typebox.js";
export declare const SpokenTurnSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    text: string;
    locale: string;
    pace: "slow" | "normal" | "brisk";
    emphasisTokens: string[];
    captionsRequired: true;
    transcriptRequired: true;
    claimsHumanIdentity: false;
    canInterrupt: boolean;
    requireLearnerResponse: boolean;
    fallbackText: string;
} & {}>;
export type SpokenTurn = Static<typeof SpokenTurnSchema>;
//# sourceMappingURL=spoken-turn.d.ts.map