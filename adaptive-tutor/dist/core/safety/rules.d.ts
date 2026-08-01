export interface SafetyRule {
    id: string;
    category: "academic-integrity" | "identifying-information" | "medical-or-disability-diagnosis" | "disputed-grading" | "persistent-difficulty" | "high-stakes-placement" | "self-harm-or-immediate-danger" | "abuse-or-neglect-disclosure" | "unsupported-subject-risk";
    patterns: RegExp[];
    severity: "inform" | "redirect" | "escalate" | "urgent-escalation";
    learnerSafeMessage: string;
    parentTeacherMessage: string;
    continueTutoringAllowed: boolean;
}
export declare const safetyRules: readonly SafetyRule[];
//# sourceMappingURL=rules.d.ts.map