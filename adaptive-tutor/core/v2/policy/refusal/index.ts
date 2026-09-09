import {
  TUTOR_ACTION_KINDS,
  TutorActionProposalSchema,
  validateExact,
  type StudyAuthorityContext,
  type TutorActionProposal,
  type TutorStaticFallbackOutcome,
} from "../../contracts/index.js";
import {
  ANSWER_POLICY_REJECTED,
  detectAnswerBearingFields,
  evaluateAnswerPolicy,
  type CanonicalAssessmentPolicyContext,
} from "../anti-answer/index.js";
import { evaluateAuthorityPolicy } from "../authority/index.js";
import { evaluateGroundingPolicy } from "../grounding/index.js";

export const POLICY_REJECTION = "POLICY_REJECTION" as const;
export const UNSUPPORTED_ACTION = "UNSUPPORTED_ACTION" as const;
export const SAFETY_STOP = "SAFETY_STOP" as const;
export const STATIC_FALLBACK_REQUIRED = "STATIC_FALLBACK_REQUIRED" as const;

export interface TutorPolicyIssue {
  readonly path: string;
  readonly code: string;
}

export type TutorPolicyRejectionCode =
  | typeof POLICY_REJECTION
  | typeof ANSWER_POLICY_REJECTED
  | typeof UNSUPPORTED_ACTION
  | "INSUFFICIENT_GROUNDED_CONTEXT";

export type TutorPolicyDecision =
  | {
      readonly status: "accepted";
      readonly code: "ACTION_PROPOSED";
      readonly proposal: TutorActionProposal;
    }
  | {
      readonly status: "rejected";
      readonly code: TutorPolicyRejectionCode;
      readonly issues: readonly TutorPolicyIssue[];
      readonly studyMutationAllowed: false;
      readonly fallbackRequired: true;
    }
  | {
      readonly status: "quarantined";
      readonly code: typeof SAFETY_STOP;
      readonly safetyRef: string;
      readonly studyMutationAllowed: false;
    };

export interface StaticFallbackOptions {
  readonly fallbackRef: string;
}

export interface TutorFallbackDecision {
  readonly status: "fallback";
  readonly code: typeof STATIC_FALLBACK_REQUIRED;
  readonly triggerCode: TutorPolicyRejectionCode;
  readonly studyMutationAllowed: false;
  readonly outcome: TutorStaticFallbackOutcome;
}

const KNOWN_ACTIONS = new Set<string>(TUTOR_ACTION_KINDS);

function rejection(
  code: TutorPolicyRejectionCode,
  issues: readonly TutorPolicyIssue[],
): TutorPolicyDecision {
  return {
    status: "rejected",
    code,
    issues,
    studyMutationAllowed: false,
    fallbackRequired: true,
  };
}

function rawActionKind(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    return undefined;
  }
  const actionDescriptor = Object.getOwnPropertyDescriptor(value, "action");
  if (!actionDescriptor || !("value" in actionDescriptor) || actionDescriptor.get || actionDescriptor.set) {
    return undefined;
  }
  const action = actionDescriptor.value;
  if (action === null || typeof action !== "object" || Object.getPrototypeOf(action) !== Object.prototype) {
    return undefined;
  }
  const kindDescriptor = Object.getOwnPropertyDescriptor(action, "kind");
  return kindDescriptor && "value" in kindDescriptor && typeof kindDescriptor.value === "string"
    ? kindDescriptor.value
    : undefined;
}

/**
 * Evaluates an untrusted AI proposal against trusted Study context. The
 * function is pure and returns proposals or decisions; it cannot mutate Study.
 */
export function evaluateTutorProposalPolicy(
  untrustedProposal: unknown,
  studyContext: StudyAuthorityContext,
  assessmentPolicy?: CanonicalAssessmentPolicyContext,
): TutorPolicyDecision {
  if (!studyContext.instructionContext.safetyConstraints.mayContinueAcademicFlow) {
    return {
      status: "quarantined",
      code: SAFETY_STOP,
      safetyRef: studyContext.safetyClearanceRef,
      studyMutationAllowed: false,
    };
  }

  const authority = evaluateAuthorityPolicy(untrustedProposal);
  if (authority.status === "rejected") {
    return rejection(POLICY_REJECTION, authority.issues);
  }

  const answerFields = detectAnswerBearingFields(untrustedProposal);
  if (answerFields.length > 0) {
    return rejection(ANSWER_POLICY_REJECTED, answerFields);
  }

  const proposedKind = rawActionKind(untrustedProposal);
  if (proposedKind !== undefined && !KNOWN_ACTIONS.has(proposedKind)) {
    return rejection(UNSUPPORTED_ACTION, [
      { path: "$/action/kind", code: "unsupported-action" },
    ]);
  }

  const contractResult = validateExact(TutorActionProposalSchema, untrustedProposal);
  if (contractResult.status === "rejected") {
    return rejection(
      POLICY_REJECTION,
      contractResult.issues.map((issue) => ({
        path: issue.path,
        code: "unsupported-or-malformed-field",
      })),
    );
  }
  const proposal = contractResult.value;

  if (proposal.interactionRef !== studyContext.interactionRef) {
    return rejection(POLICY_REJECTION, [
      { path: "$/interactionRef", code: "interaction-binding-mismatch" },
    ]);
  }

  if (!studyContext.instructionContext.allowedActions.includes(proposal.action.kind)) {
    return rejection(UNSUPPORTED_ACTION, [
      { path: "$/action/kind", code: "action-not-allowed-by-study" },
    ]);
  }

  const grounding = evaluateGroundingPolicy(proposal, studyContext.instructionContext);
  if (grounding.status === "rejected") {
    return rejection(grounding.code, grounding.issues);
  }

  const answer = evaluateAnswerPolicy(
    proposal,
    studyContext.instructionContext,
    assessmentPolicy,
  );
  if (answer.status === "rejected") {
    return rejection(answer.code, answer.issues);
  }

  return { status: "accepted", code: "ACTION_PROPOSED", proposal };
}

/** Converts any rejected proposal into a contract-compatible static fallback. */
export function createStaticFallbackDecision(
  rejected: Extract<TutorPolicyDecision, { readonly status: "rejected" }>,
  studyContext: StudyAuthorityContext,
  options: StaticFallbackOptions,
): TutorFallbackDecision {
  const reasonCode =
    rejected.code === "INSUFFICIENT_GROUNDED_CONTEXT"
      ? "INSUFFICIENT_GROUNDED_CONTEXT"
      : rejected.code === UNSUPPORTED_ACTION
        ? UNSUPPORTED_ACTION
        : POLICY_REJECTION;

  return {
    status: "fallback",
    code: STATIC_FALLBACK_REQUIRED,
    triggerCode: rejected.code,
    studyMutationAllowed: false,
    outcome: {
      contractVersion: studyContext.contractVersion,
      actionSchemaVersion: studyContext.actionSchemaVersion,
      compatibilityId: studyContext.compatibilityId,
      actionCompatibilityId: studyContext.actionCompatibilityId,
      envelope: "tutor-static-fallback-required",
      interactionRef: studyContext.interactionRef,
      code: STATIC_FALLBACK_REQUIRED,
      fallbackRef: options.fallbackRef,
      reasonCode,
    },
  };
}
