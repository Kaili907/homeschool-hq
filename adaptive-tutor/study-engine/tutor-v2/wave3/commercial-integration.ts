import { validateExact } from "../../../core/v2/contracts/validation.js";
import {
  StudyCommercialEffectReceiptSchema,
  StudyCommercialTutorAdvisorySchema,
  type StudyCommercialEffectReceipt,
} from "../../../core/v3/contracts/index.js";
import {
  CommercialExecutionScopeSchema,
  type CommercialExecutionScope,
} from "../../../core/v3/commercial-operation/index.js";
import {
  InstructionalMemoryDeltaSchema,
  type InstructionalMemoryDelta,
} from "../../../core/v3/memory/index.js";
import {
  RecoverableInstructionalOperationCoordinator,
  type RecoverableInstructionalOperationResult,
} from "../../../core/v3/recovery/index.js";
import {
  buildMinimizedParentHubReport,
} from "../parent-reporting/index.js";

export type AcceptedCommercialEffectRecoveryResult =
  | RecoverableInstructionalOperationResult
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_STUDY_EFFECT_RECEIPT"
        | "INVALID_COMMERCIAL_EXECUTION_SCOPE"
        | "STUDY_EFFECT_NOT_ACCEPTED"
        | "COMMERCIAL_EFFECT_SCOPE_MISMATCH"
        | "INVALID_INSTRUCTIONAL_MEMORY_DELTA";
    };

function receiptMatchesCommercialScope(
  receipt: StudyCommercialEffectReceipt,
  scope: CommercialExecutionScope,
): boolean {
  return (
    receipt.commercialExecutionScopeRef === scope.scopeRef &&
    receipt.householdScopeRef === scope.householdScopeRef &&
    receipt.logicalOperationRef === scope.logicalOperationRef &&
    receipt.learnerScopeRef === scope.learnerScopeRef &&
    receipt.sessionRef === scope.sessionRef &&
    receipt.interactionRef === scope.interactionRef &&
    receipt.conceptRef === scope.conceptRef &&
    receipt.opportunityRef === scope.opportunityRef &&
    receipt.curriculumReleaseRef === scope.curriculumReleaseRef &&
    receipt.curriculumPackageRef === scope.curriculumPackageRef &&
    receipt.curriculumCourseRef === scope.curriculumCourseRef &&
    receipt.curriculumSubjectRef === scope.curriculumSubjectRef &&
    receipt.curriculumUnitRef === scope.curriculumUnitRef &&
    receipt.curriculumLessonRef === scope.curriculumLessonRef
  );
}

function deltaMatchesReceipt(
  delta: InstructionalMemoryDelta,
  receipt: StudyCommercialEffectReceipt,
): boolean {
  return (
    delta.commercialExecutionScopeRef === receipt.commercialExecutionScopeRef &&
    delta.householdScopeRef === receipt.householdScopeRef &&
    delta.logicalOperationRef === receipt.logicalOperationRef &&
    delta.sourceEventRef === receipt.receiptRef &&
    delta.scope.learnerScopeRef === receipt.learnerScopeRef &&
    delta.scope.sessionRef === receipt.sessionRef &&
    delta.scope.contextRef === receipt.interactionRef &&
    delta.conceptRef === receipt.conceptRef &&
    delta.scope.opportunityRef === receipt.opportunityRef &&
    delta.curriculumReleaseRef === receipt.curriculumReleaseRef &&
    delta.curriculumPackageRef === receipt.curriculumPackageRef &&
    delta.curriculumCourseRef === receipt.curriculumCourseRef &&
    delta.curriculumSubjectRef === receipt.curriculumSubjectRef &&
    delta.curriculumUnitRef === receipt.curriculumUnitRef &&
    delta.curriculumLessonRef === receipt.curriculumLessonRef &&
    delta.operations.every((operation) => {
      if (operation.field !== "conceptRefs") return true;
      if (operation.operationKind === "replace") {
        return (
          Array.isArray(operation.value) &&
          operation.value.every((value) => value === receipt.conceptRef)
        );
      }
      if (operation.operationKind === "remove") return true;
      return operation.value === receipt.conceptRef;
    })
  );
}

function validateReceipt(candidate: unknown) {
  return validateExact(StudyCommercialEffectReceiptSchema, candidate);
}

/**
 * Memory advances only after a trusted Study-owned acceptance receipt. The
 * coordinator retains the accepted effect identity so a retry repairs memory
 * without repeating the Study effect or provider operation.
 */
export function recoverAcceptedCommercialEffect(
  receiptCandidate: unknown,
  advisoryCandidate: unknown,
  memoryDeltaCandidate: unknown,
  commercialExecutionScopeCandidate: unknown,
  coordinator: RecoverableInstructionalOperationCoordinator,
): AcceptedCommercialEffectRecoveryResult {
  const commercialScopeValidation = validateExact(
    CommercialExecutionScopeSchema,
    commercialExecutionScopeCandidate,
  );
  if (commercialScopeValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_COMMERCIAL_EXECUTION_SCOPE" };
  }
  const commercialScope = commercialScopeValidation.value;
  const receiptValidation = validateReceipt(receiptCandidate);
  if (receiptValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_STUDY_EFFECT_RECEIPT" };
  }
  const receipt = receiptValidation.value;
  if (receipt.decision !== "accepted" || !receipt.studyProgressCommitted) {
    return { status: "rejected", code: "STUDY_EFFECT_NOT_ACCEPTED" };
  }
  if (!receiptMatchesCommercialScope(receipt, commercialScope)) {
    return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
  }
  const advisoryValidation = validateExact(
    StudyCommercialTutorAdvisorySchema,
    advisoryCandidate,
  );
  if (advisoryValidation.status === "rejected") {
    return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
  }
  const advisory = advisoryValidation.value;
  if (
    receipt.invocationRef !== advisory.invocationRef ||
    advisory.commercialScopeRef !== commercialScope.scopeRef ||
    receipt.householdScopeRef !== advisory.householdScopeRef ||
    receipt.logicalOperationRef !== advisory.logicalOperationRef ||
    receipt.learnerScopeRef !== advisory.learnerScopeRef ||
    receipt.sessionRef !== advisory.sessionRef ||
    receipt.interactionRef !== advisory.interactionRef ||
    receipt.conceptRef !== advisory.conceptRef ||
    receipt.opportunityRef !== advisory.opportunityRef
  ) {
    return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
  }
  const deltaValidation = validateExact(
    InstructionalMemoryDeltaSchema,
    memoryDeltaCandidate,
  );
  if (deltaValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_INSTRUCTIONAL_MEMORY_DELTA" };
  }
  const memoryDelta = deltaValidation.value;
  const memoryScope = {
    scopeKind: "trusted-study-instructional-memory-scope" as const,
    learnerScopeRef: receipt.learnerScopeRef,
    sessionRef: receipt.sessionRef,
    contextRef: receipt.interactionRef,
    opportunityRef: receipt.opportunityRef,
  };
  if (!deltaMatchesReceipt(memoryDelta, receipt)) {
    return { status: "rejected", code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH" };
  }
  return coordinator.replay(commercialScope, {
    recoveryKind: "recoverable-instructional-operation",
    commercialExecutionScopeRef: receipt.commercialExecutionScopeRef,
    householdScopeRef: receipt.householdScopeRef,
    logicalOperationRef: receipt.logicalOperationRef,
    sourceEventRef: receipt.receiptRef,
    effectRef: receipt.effectRef,
    effectDigest: receipt.effectDigest,
    conceptRef: receipt.conceptRef,
    curriculumReleaseRef: receipt.curriculumReleaseRef,
    curriculumPackageRef: receipt.curriculumPackageRef,
    curriculumCourseRef: receipt.curriculumCourseRef,
    curriculumSubjectRef: receipt.curriculumSubjectRef,
    curriculumUnitRef: receipt.curriculumUnitRef,
    curriculumLessonRef: receipt.curriculumLessonRef,
    scope: memoryScope,
    memoryDelta,
  });
}

/** Parent-report authority remains the accepted W3-07/R6 closed boundary. */
export function buildAuthorizedCommercialParentReport(
  ...args: Parameters<typeof buildMinimizedParentHubReport>
): ReturnType<typeof buildMinimizedParentHubReport> {
  return buildMinimizedParentHubReport(...args);
}
