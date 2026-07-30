import { type Static } from "../schema/typebox.js";
export declare const SafetyTriggerSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    category: "academic-integrity" | "identifying-information" | "medical-or-disability-diagnosis" | "disputed-grading" | "persistent-difficulty" | "high-stakes-placement" | "self-harm-or-immediate-danger" | "abuse-or-neglect-disclosure" | "unsupported-subject-risk";
    severity: "inform" | "redirect" | "escalate" | "urgent-escalation";
    matchedText: string;
    learnerSafeMessage: string;
    parentTeacherMessage: string;
    continueTutoringAllowed: boolean;
} & {}>;
export declare const SafetyDecisionSchema: import("../schema/typebox.js").TSchema<{
    triggers: ({
        id: string;
        category: "academic-integrity" | "identifying-information" | "medical-or-disability-diagnosis" | "disputed-grading" | "persistent-difficulty" | "high-stakes-placement" | "self-harm-or-immediate-danger" | "abuse-or-neglect-disclosure" | "unsupported-subject-risk";
        severity: "inform" | "redirect" | "escalate" | "urgent-escalation";
        matchedText: string;
        learnerSafeMessage: string;
        parentTeacherMessage: string;
        continueTutoringAllowed: boolean;
    } & {})[];
    responseRuleIds: string[];
    allowed: boolean;
    redactedInput: string;
    mustEscalateToAdult: boolean;
    mustStopAcademicFlow: boolean;
} & {}>;
export type SafetyTrigger = Static<typeof SafetyTriggerSchema>;
export type SafetyDecision = Static<typeof SafetyDecisionSchema>;
//# sourceMappingURL=safety.d.ts.map