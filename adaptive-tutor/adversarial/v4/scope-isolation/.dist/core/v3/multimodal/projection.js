import { DurableMultimodalEvidenceSchema, MULTIMODAL_CONTRACT_VERSION, } from "./contracts.js";
import { enforceMultimodalPresentationPolicy } from "./policy.js";
import { validateExactSnapshot } from "./runtime-snapshot.js";
const SOURCE_KEYS = new Set([
    "evidenceRef",
    "sessionRef",
    "presentation",
    "trustedContext",
    "outcome",
    "assistanceLevel",
    "observedAt",
    "transient",
]);
function snapshotProjectionSource(candidate) {
    if (typeof candidate !== "object"
        || candidate === null
        || Array.isArray(candidate)
        || Object.getPrototypeOf(candidate) !== Object.prototype) {
        return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    if (Object.keys(descriptors).some((key) => !SOURCE_KEYS.has(key)))
        return undefined;
    const required = [
        "evidenceRef",
        "sessionRef",
        "presentation",
        "trustedContext",
        "outcome",
        "assistanceLevel",
        "observedAt",
    ];
    const values = {};
    for (const key of required) {
        const descriptor = descriptors[key];
        if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor)) {
            return undefined;
        }
        values[key] = descriptor.value;
    }
    const transient = descriptors.transient;
    if (transient?.get || transient?.set || (transient && !("value" in transient))) {
        return undefined;
    }
    if (transient && "value" in transient)
        values.transient = transient.value;
    return Object.freeze(values);
}
function reviewedVisualFrom(presentation) {
    const content = presentation.content;
    if (content.mode === "reviewed-image" || content.mode === "reviewed-diagram") {
        return content.visual;
    }
    return undefined;
}
/**
 * Whitelist projection. Caller-owned objects are snapshotted before property
 * reads, and transient bytes/text have no route into the durable result.
 */
export function projectDurableMultimodalEvidence(sourceCandidate) {
    const source = snapshotProjectionSource(sourceCandidate);
    if (source === undefined) {
        return {
            status: "rejected",
            code: "INVALID_MULTIMODAL_EVIDENCE_SOURCE",
            issues: ["Evidence source must be a closed, data-property-only plain object."],
        };
    }
    const policyResult = enforceMultimodalPresentationPolicy(source.presentation, source.trustedContext);
    if (policyResult.status === "rejected") {
        return {
            status: "rejected",
            code: "INVALID_MULTIMODAL_EVIDENCE_SOURCE",
            issues: [...policyResult.issues],
        };
    }
    if (source.sessionRef !== policyResult.presentation.scope.sessionRef) {
        return {
            status: "rejected",
            code: "INVALID_MULTIMODAL_EVIDENCE_SOURCE",
            issues: ["Evidence session does not match trusted presentation lineage."],
        };
    }
    const presentation = policyResult.presentation;
    const reviewedVisual = reviewedVisualFrom(presentation);
    const candidate = {
        contractVersion: MULTIMODAL_CONTRACT_VERSION,
        envelope: "durable-multimodal-evidence",
        evidenceRef: source.evidenceRef,
        commercialExecutionScopeRef: presentation.scope.commercialExecutionScopeRef,
        householdScopeRef: presentation.scope.householdScopeRef,
        learnerScopeRef: presentation.scope.learnerScopeRef,
        sessionRef: presentation.scope.sessionRef,
        interactionRef: presentation.scope.interactionRef,
        logicalOperationRef: presentation.scope.logicalOperationRef,
        conceptRef: presentation.scope.conceptRef,
        opportunityRef: presentation.scope.opportunityRef,
        presentationRef: presentation.scope.presentationRef,
        turnRef: presentation.turnRef,
        mode: presentation.content.mode,
        outcome: source.outcome,
        assistanceLevel: source.assistanceLevel,
        observedAt: source.observedAt,
        captionRef: source.presentation.caption.captionRef,
        captionAvailability: "available",
        transcriptPersisted: false,
        rawMediaPersisted: false,
        ...(reviewedVisual === undefined
            ? {}
            : {
                reviewedVisual: {
                    visualRef: reviewedVisual.visualRef,
                    reviewRef: reviewedVisual.reviewRef,
                    contentDigest: reviewedVisual.contentDigest,
                    mimeType: reviewedVisual.mimeType,
                    visualKind: reviewedVisual.visualKind,
                    reviewStatus: "approved",
                    provenanceRef: reviewedVisual.provenanceRef,
                },
            }),
        ...(presentation.visualStep === undefined
            ? {}
            : {
                visualStep: {
                    visualStepRef: presentation.visualStep.visualStepRef,
                    stepIndex: presentation.visualStep.stepIndex,
                },
            }),
    };
    const validation = validateExactSnapshot(DurableMultimodalEvidenceSchema, candidate);
    if (validation.status === "rejected") {
        return {
            status: "rejected",
            code: "INVALID_DURABLE_MULTIMODAL_EVIDENCE",
            issues: validation.issues.map((issue) => `${issue.path.length > 0 ? issue.path : "$"}: ${issue.message}`),
        };
    }
    return { status: "accepted", evidence: validation.value };
}
