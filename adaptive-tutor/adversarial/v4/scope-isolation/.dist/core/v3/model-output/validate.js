import { validateExact } from "../../v2/contracts/index.js";
import { ProviderModelOutputEnvelopeSchema, } from "./contracts.js";
const AUTHORITY_FIELD_FRAGMENTS = [
    "mastery",
    "workinglevel",
    "nominalgrade",
    "curriculum",
    "guardian",
    "toolcall",
    "toolinvocation",
    "executetool",
];
const AUTHORITY_FIELD_NAMES = new Set([
    "grade",
    "clearsafety",
    "safetyclearance",
    "safetycleared",
    "safetyauthorization",
    "tools",
]);
const ANSWER_BEARING_FIELD_NAMES = new Set([
    "answer",
    "answerkey",
    "correctanswer",
    "correctchoice",
    "correctoption",
    "finalanswer",
    "protectedanswer",
    "solution",
    "solutionkey",
]);
const FREE_FORM_TUTORING_FIELD_NAMES = new Set([
    "content",
    "explanation",
    "freeform",
    "hint",
    "hinttext",
    "message",
    "prose",
    "question",
    "response",
    "text",
    "tutoringtext",
]);
const OBVIOUS_ANSWER_DISCLOSURES = [
    /\b(?:the\s+)?(?:correct|final)\s+answer\s*(?:is|=|:)\s*\S+/i,
    /\banswer\s*(?:is|=|:)\s*\S+/i,
    /\b(?:correct|right)\s+(?:choice|option)\s*(?:is|=|:)\s*[A-Za-z0-9]+\b/i,
    /\b(?:the\s+)?solution\s*(?:is|=|:)\s*\S+/i,
];
function normalizedFieldName(field) {
    return field.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function fieldClaimsAuthority(field) {
    const normalized = normalizedFieldName(field);
    return AUTHORITY_FIELD_NAMES.has(normalized)
        || AUTHORITY_FIELD_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}
function fieldCanCarryFreeFormAnswer(field) {
    const normalized = normalizedFieldName(field);
    return ANSWER_BEARING_FIELD_NAMES.has(normalized)
        || FREE_FORM_TUTORING_FIELD_NAMES.has(normalized);
}
/**
 * Examines own data properties without invoking getters. Exact schema
 * validation remains responsible for all general JSON-shape rejection.
 */
function detectOutputHazard(root, activeAssessment) {
    const ancestors = new Set();
    let visited = 0;
    let hazard;
    const visit = (value, owningField, depth) => {
        if (hazard || visited >= 10_000 || depth > 24)
            return;
        visited += 1;
        if (activeAssessment
            && typeof value === "string"
            && ((owningField !== undefined && fieldCanCarryFreeFormAnswer(owningField))
                || OBVIOUS_ANSWER_DISCLOSURES.some((pattern) => pattern.test(value)))) {
            hazard = "active-assessment-answer";
            return;
        }
        if (value === null || typeof value !== "object" || ancestors.has(value))
            return;
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        for (const [field, descriptor] of Object.entries(descriptors)) {
            if (fieldClaimsAuthority(field)) {
                hazard = "authority";
                break;
            }
            if (descriptor.get || descriptor.set || !("value" in descriptor))
                continue;
            visit(descriptor.value, field, depth + 1);
        }
        ancestors.delete(value);
    };
    visit(root, undefined, 0);
    return hazard;
}
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
/**
 * Copies data descriptors into fresh plain values before schema evaluation so
 * later validation never performs a property read against provider-owned data.
 */
function snapshotJsonBoundary(root) {
    const ancestors = new Set();
    let visited = 0;
    const visit = (value, depth) => {
        visited += 1;
        if (visited > 10_000 || depth > 24)
            return { status: "rejected" };
        if (value === null || typeof value === "boolean") {
            return { status: "accepted", value };
        }
        if (typeof value === "string") {
            return value.length <= 16_000
                ? { status: "accepted", value }
                : { status: "rejected" };
        }
        if (typeof value === "number") {
            return Number.isFinite(value)
                ? { status: "accepted", value }
                : { status: "rejected" };
        }
        if (typeof value !== "object" || ancestors.has(value)) {
            return { status: "rejected" };
        }
        const isArray = Array.isArray(value);
        const expectedPrototype = isArray ? Array.prototype : Object.prototype;
        if (Object.getPrototypeOf(value) !== expectedPrototype) {
            return { status: "rejected" };
        }
        const ownKeys = Reflect.ownKeys(value);
        if (ownKeys.some((key) => typeof key === "symbol"))
            return { status: "rejected" };
        const stringKeys = ownKeys;
        if (stringKeys.length > (isArray ? 1_001 : 100)) {
            return { status: "rejected" };
        }
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        if (isArray) {
            const lengthDescriptor = descriptors.length;
            if (!lengthDescriptor
                || !("value" in lengthDescriptor)
                || !Number.isInteger(lengthDescriptor.value)
                || lengthDescriptor.value < 0
                || lengthDescriptor.value > 1_000
                || stringKeys.length !== lengthDescriptor.value + 1) {
                ancestors.delete(value);
                return { status: "rejected" };
            }
            const snapshot = [];
            for (let index = 0; index < lengthDescriptor.value; index += 1) {
                const descriptor = descriptors[String(index)];
                if (!descriptor
                    || descriptor.enumerable !== true
                    || descriptor.get
                    || descriptor.set
                    || !("value" in descriptor)) {
                    ancestors.delete(value);
                    return { status: "rejected" };
                }
                const item = visit(descriptor.value, depth + 1);
                if (item.status === "rejected") {
                    ancestors.delete(value);
                    return item;
                }
                snapshot.push(item.value);
            }
            ancestors.delete(value);
            return { status: "accepted", value: snapshot };
        }
        const snapshot = {};
        for (const key of stringKeys) {
            const descriptor = descriptors[key];
            if (RESERVED_KEYS.has(key)
                || !descriptor
                || descriptor.enumerable !== true
                || descriptor.get
                || descriptor.set
                || !("value" in descriptor)) {
                ancestors.delete(value);
                return { status: "rejected" };
            }
            const child = visit(descriptor.value, depth + 1);
            if (child.status === "rejected") {
                ancestors.delete(value);
                return child;
            }
            Object.defineProperty(snapshot, key, {
                enumerable: true,
                configurable: true,
                writable: true,
                value: child.value,
            });
        }
        ancestors.delete(value);
        return { status: "accepted", value: snapshot };
    };
    return visit(root, 0);
}
function malformedResult() {
    return {
        status: "malformed",
        reasonCode: "MODEL_OUTPUT_SCHEMA_REJECTED",
        staticFallbackRequired: true,
    };
}
function staticFallback(reasonCode) {
    return {
        status: "static-fallback-required",
        reasonCode,
        staticFallbackRequired: true,
    };
}
function hasUnknownReference(proposed, allowed) {
    const allowedSet = new Set(allowed);
    return proposed.some((reference) => !allowedSet.has(reference));
}
function normalizedProposal(proposal) {
    return Object.freeze({
        responseKind: proposal.responseKind,
        reviewedContentRefs: Object.freeze([...proposal.reviewedContentRefs]),
        groundingRefs: Object.freeze([...proposal.groundingRefs]),
        reasonCodes: Object.freeze([...proposal.reasonCodes]),
        requestedTutorAction: proposal.requestedTutorAction,
        instructionalDisplayMode: proposal.instructionalDisplayMode,
        refusalState: proposal.refusalState,
    });
}
function normalizedRefusal(refusal) {
    return Object.freeze({
        responseKind: refusal.responseKind,
        reviewedContentRefs: Object.freeze([]),
        groundingRefs: Object.freeze([]),
        reasonCodes: Object.freeze([...refusal.reasonCodes]),
        requestedTutorAction: refusal.requestedTutorAction,
        instructionalDisplayMode: refusal.instructionalDisplayMode,
        refusalState: refusal.refusalState,
    });
}
/**
 * Converts an untrusted, already-decoded provider/model value into one of four
 * closed outcomes. It performs no model, provider, tool, or authority action.
 */
export function validateProviderModelOutput(output, context) {
    try {
        const hazard = detectOutputHazard(output, context.assessmentPhase === "active-graded-or-mastery-check");
        if (hazard === "authority") {
            return staticFallback("FORBIDDEN_MODEL_AUTHORITY");
        }
        if (hazard === "active-assessment-answer") {
            return staticFallback("ACTIVE_ASSESSMENT_ANSWER_BEARING_OUTPUT");
        }
        const snapshot = snapshotJsonBoundary(output);
        if (snapshot.status === "rejected")
            return malformedResult();
        const validated = validateExact(ProviderModelOutputEnvelopeSchema, snapshot.value);
        if (validated.status === "rejected")
            return malformedResult();
        if (validated.value.responseKind === "refusal") {
            return {
                status: "refused",
                refusal: normalizedRefusal(validated.value),
                staticFallbackRequired: true,
            };
        }
        const proposal = validated.value;
        if (hasUnknownReference(proposal.reviewedContentRefs, context.reviewedContentRefs)) {
            return staticFallback("UNREVIEWED_CONTENT_REFERENCE");
        }
        if (hasUnknownReference(proposal.groundingRefs, context.groundingRefs)) {
            return staticFallback("UNKNOWN_GROUNDING_REFERENCE");
        }
        if (!context.allowedTutorActions.includes(proposal.requestedTutorAction)) {
            return staticFallback("REQUESTED_TUTOR_ACTION_NOT_ALLOWED");
        }
        if (!context.allowedInstructionalDisplayModes.includes(proposal.instructionalDisplayMode)) {
            return staticFallback("INSTRUCTIONAL_DISPLAY_MODE_NOT_ALLOWED");
        }
        return {
            status: "accepted-proposal",
            proposal: normalizedProposal(proposal),
            staticFallbackRequired: false,
        };
    }
    catch {
        return malformedResult();
    }
}
