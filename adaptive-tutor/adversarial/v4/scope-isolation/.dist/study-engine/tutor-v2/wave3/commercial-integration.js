import { validateExact } from "../../../core/v2/contracts/validation.js";
import { StudyCommercialEffectReceiptSchema, StudyCommercialTutorAdvisorySchema, } from "../../../core/v3/contracts/index.js";
import { InstructionalMemoryDeltaSchema, } from "../../../core/v3/memory/index.js";
import { RecoverableInstructionalOperationCoordinator, } from "../../../core/v3/recovery/index.js";
import { buildMinimizedParentHubReport, } from "../parent-reporting/index.js";
/**
 * Memory advances only after a trusted Study-owned acceptance receipt. The
 * coordinator retains the accepted effect identity so a retry repairs memory
 * without repeating the Study effect or provider operation.
 */
export function recoverAcceptedCommercialEffect(receiptCandidate, advisoryCandidate, memoryDeltaCandidate, coordinator) {
    const receiptValidation = validateExact(StudyCommercialEffectReceiptSchema, receiptCandidate);
    if (receiptValidation.status === "rejected") {
        return { status: "rejected", code: "INVALID_STUDY_EFFECT_RECEIPT" };
    }
    const receipt = receiptValidation.value;
    if (receipt.decision !== "accepted" || !receipt.studyProgressCommitted) {
        return { status: "rejected", code: "STUDY_EFFECT_NOT_ACCEPTED" };
    }
    const advisoryValidation = validateExact(StudyCommercialTutorAdvisorySchema, advisoryCandidate);
    if (advisoryValidation.status === "rejected") {
        return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
    }
    const advisory = advisoryValidation.value;
    if (receipt.invocationRef !== advisory.invocationRef ||
        receipt.logicalOperationRef !== advisory.logicalOperationRef ||
        receipt.learnerScopeRef !== advisory.learnerScopeRef ||
        receipt.sessionRef !== advisory.sessionRef ||
        receipt.interactionRef !== advisory.interactionRef ||
        receipt.opportunityRef !== advisory.opportunityRef) {
        return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
    }
    const deltaValidation = validateExact(InstructionalMemoryDeltaSchema, memoryDeltaCandidate);
    if (deltaValidation.status === "rejected") {
        return { status: "rejected", code: "INVALID_INSTRUCTIONAL_MEMORY_DELTA" };
    }
    const memoryDelta = deltaValidation.value;
    const scope = {
        scopeKind: "trusted-study-instructional-memory-scope",
        learnerScopeRef: receipt.learnerScopeRef,
        sessionRef: receipt.sessionRef,
        contextRef: receipt.interactionRef,
        opportunityRef: receipt.opportunityRef,
    };
    if (memoryDelta.logicalOperationRef !== receipt.logicalOperationRef ||
        memoryDelta.sourceEventRef !== receipt.receiptRef ||
        memoryDelta.scope.learnerScopeRef !== scope.learnerScopeRef ||
        memoryDelta.scope.sessionRef !== scope.sessionRef ||
        memoryDelta.scope.contextRef !== scope.contextRef ||
        memoryDelta.scope.opportunityRef !== scope.opportunityRef) {
        return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
    }
    return coordinator.replay(scope, {
        recoveryKind: "recoverable-instructional-operation",
        logicalOperationRef: receipt.logicalOperationRef,
        sourceEventRef: receipt.receiptRef,
        effectRef: receipt.effectRef,
        effectDigest: receipt.effectDigest,
        scope,
        memoryDelta,
    });
}
/** Parent-report authority remains the accepted W3-07/R6 closed boundary. */
export function buildAuthorizedCommercialParentReport(...args) {
    return buildMinimizedParentHubReport(...args);
}
