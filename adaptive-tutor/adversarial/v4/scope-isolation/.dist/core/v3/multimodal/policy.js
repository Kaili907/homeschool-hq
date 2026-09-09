import { Value } from "../../schema/value.js";
import { MultimodalPresentationSchema, } from "./contracts.js";
/**
 * Enforces the same assessment disclosure rule after modality selection. A
 * caller cannot obtain different anti-answer behavior by switching channels.
 */
export function enforceMultimodalPresentationPolicy(candidate) {
    if (typeof candidate === "object" && candidate !== null) {
        const disclosure = candidate.assessmentDisclosure;
        if (typeof disclosure === "object" && disclosure !== null) {
            const policy = disclosure;
            if (policy.phase === "active-assessment" &&
                (policy.answerExposure === "reviewed-answer" ||
                    policy.antiAnswerPolicy !== "required" ||
                    policy.appliesToAllModalities !== true)) {
                return {
                    status: "rejected",
                    code: "ACTIVE_ASSESSMENT_ANSWER_BLOCKED",
                    issues: ["Active-assessment answer disclosure is blocked for every modality."],
                };
            }
        }
    }
    if (!Value.Check(MultimodalPresentationSchema, candidate)) {
        return {
            status: "rejected",
            code: "INVALID_MULTIMODAL_PRESENTATION",
            issues: [...Value.Errors(MultimodalPresentationSchema, candidate)].map((error) => `${error.path.length > 0 ? error.path : "$"}: ${error.message}`),
        };
    }
    const presentation = candidate;
    return { status: "accepted", presentation };
}
