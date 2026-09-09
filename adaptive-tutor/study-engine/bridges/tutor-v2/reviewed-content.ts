import type {
  TutorActionKind,
  TutorActionProposal,
} from "../../../core/v2/contracts/index.js";
import {
  OpaqueReferenceSchema,
  validateExact,
} from "../../../core/v2/contracts/index.js";
import type { MinimizedProviderContext } from "../../tutor-v2/privacy/index.js";
import type { TutorV2BridgeMemoryAccess } from "./contracts.js";
import {
  validateLearnerSafeTutorAction,
  validateProviderContextContentPrivacy,
} from "./privacy.js";

export type ReviewedTutorContentPurpose =
  | "provider-input-learner-safe-item"
  | "provider-input-grounding-content"
  | "learner-facing-action-content"
  | "learner-facing-control-code";

export interface ReviewedTutorContentScope {
  readonly householdScopeRef: string;
  readonly learnerScopeRef: string;
  readonly sessionRef: string;
  readonly interactionRef: string;
  readonly lessonRef: string;
}

export interface ReviewedTutorInstructionContextBinding {
  readonly subjectRef: string;
  readonly conceptRef: string;
  readonly learnerStageRef: string;
}

/**
 * Closed, text-free lookup key for one exact Study-reviewed content admission.
 * Raw candidate content is deliberately absent from this authority boundary.
 */
export interface ReviewedTutorContentApprovalRequest {
  readonly purpose: ReviewedTutorContentPurpose;
  readonly scope: ReviewedTutorContentScope;
  readonly context: ReviewedTutorInstructionContextBinding;
  readonly sourceRef: string;
  readonly contentKind: string;
  readonly contentDigest: `sha256:${string}`;
  readonly actionKind: TutorActionKind | null;
  readonly groundingRefs: readonly string[];
}

export type ReviewedTutorContentApprovalDecision =
  | { readonly status: "approved"; readonly approvalRef: string }
  | { readonly status: "rejected"; readonly code: "CONTENT_NOT_APPROVED" };

/** Study-owned. Provider adapters must never receive this port. */
export interface ReviewedTutorContentAuthorityPort {
  review(
    request: ReviewedTutorContentApprovalRequest,
  ): unknown | Promise<unknown>;
}

export interface ReviewedTutorContentApproval
  extends ReviewedTutorContentApprovalRequest {
  readonly approvalRef: string;
}

export type ReviewedTutorContentPrivacyDecision =
  | { readonly status: "accepted" }
  | {
      readonly status: "rejected";
      readonly code:
        | "RAW_LEARNER_ATTEMPT_NOT_DISCLOSED"
        | "CONTENT_DIGEST_MISMATCH"
        | "CONTENT_NOT_APPROVED"
        | "APPROVAL_AUTHORITY_FAILURE"
        | "LEXICAL_DEFENSE_REJECTED";
      readonly purpose: ReviewedTutorContentPurpose | "provider-input-learner-attempt";
      readonly sourceRef: string;
      readonly contentDigest: `sha256:${string}` | null;
      readonly actionKind: TutorActionKind | null;
  };

function canonicalApprovalKey(
  request: ReviewedTutorContentApprovalRequest,
): string {
  return JSON.stringify([
    request.purpose,
    request.scope.householdScopeRef,
    request.scope.learnerScopeRef,
    request.scope.sessionRef,
    request.scope.interactionRef,
    request.scope.lessonRef,
    request.context.subjectRef,
    request.context.conceptRef,
    request.context.learnerStageRef,
    request.sourceRef,
    request.contentKind,
    request.contentDigest,
    request.actionKind,
    [...request.groundingRefs].sort(),
  ]);
}

function exactOwnKeys(actual: readonly PropertyKey[], keys: readonly string[]): boolean {
  if (actual.some((key) => typeof key !== "string")) return false;
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    [...actual].sort().every((key, index) => key === expected[index]);
}

function isOpaqueRef(value: unknown): value is string {
  return validateExact(OpaqueReferenceSchema, value).status === "accepted";
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  return descriptor !== undefined &&
    Object.hasOwn(descriptor, "value") &&
    !Object.hasOwn(descriptor, "get") &&
    !Object.hasOwn(descriptor, "set");
}

/**
 * Parse an untrusted authority result without normalizing it or reading any of
 * its properties. Reflection may execute Proxy traps, so every inspection is
 * contained by the caller's fail-closed exception boundary.
 */
function parseRawApprovalDecision(
  candidate: unknown,
): ReviewedTutorContentApprovalDecision | null {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  if (Object.getPrototypeOf(candidate) !== Object.prototype) return null;

  const ownKeys = Reflect.ownKeys(candidate);
  const approvedShape = exactOwnKeys(ownKeys, ["status", "approvalRef"]);
  const rejectedShape = exactOwnKeys(ownKeys, ["status", "code"]);
  if (!approvedShape && !rejectedShape) return null;

  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  const expectedKeys = approvedShape
    ? ["status", "approvalRef"] as const
    : ["status", "code"] as const;
  if (!exactOwnKeys(Reflect.ownKeys(descriptors), expectedKeys)) return null;

  const statusDescriptor = descriptors.status;
  const valueDescriptor = approvedShape
    ? descriptors.approvalRef
    : descriptors.code;
  if (!isDataDescriptor(statusDescriptor) || !isDataDescriptor(valueDescriptor)) {
    return null;
  }

  const status = statusDescriptor.value;
  const value = valueDescriptor.value;
  if (approvedShape) {
    return status === "approved" && typeof value === "string" && isOpaqueRef(value)
      ? Object.freeze({ status: "approved", approvalRef: value })
      : null;
  }
  return status === "rejected" && value === "CONTENT_NOT_APPROVED"
    ? Object.freeze({ status: "rejected", code: "CONTENT_NOT_APPROVED" })
    : null;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 over the exact UTF-8 bytes that would cross the boundary. */
export async function reviewedTutorContentDigest(
  content: string,
): Promise<`sha256:${string}`> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return `sha256:${toHex(new Uint8Array(digest))}`;
}

function scopeFrom(
  memoryAccess: TutorV2BridgeMemoryAccess,
): ReviewedTutorContentScope {
  return {
    householdScopeRef: memoryAccess.scope.householdScopeRef,
    learnerScopeRef: memoryAccess.scope.learnerScopeRef,
    sessionRef: memoryAccess.scope.sessionRef,
    interactionRef: memoryAccess.scope.interactionRef,
    lessonRef: memoryAccess.scope.lessonRef,
  };
}

function contextFrom(
  context: MinimizedProviderContext,
): ReviewedTutorInstructionContextBinding {
  return {
    subjectRef: context.instruction.subjectRef,
    conceptRef: context.instruction.conceptRef,
    learnerStageRef: context.instruction.learnerStageRef,
  };
}

async function isApproved(
  authority: ReviewedTutorContentAuthorityPort,
  request: ReviewedTutorContentApprovalRequest,
): Promise<"approved" | "rejected" | "failure"> {
  try {
    const rawDecision = await authority.review(structuredClone(request));
    const decision = parseRawApprovalDecision(rawDecision);
    return decision?.status ?? "failure";
  } catch {
    return "failure";
  }
}

function rejected(
  code: Extract<ReviewedTutorContentPrivacyDecision, { status: "rejected" }>["code"],
  purpose: Extract<ReviewedTutorContentPrivacyDecision, { status: "rejected" }>["purpose"],
  sourceRef: string,
  contentDigest: `sha256:${string}` | null,
  actionKind: TutorActionKind | null,
): ReviewedTutorContentPrivacyDecision {
  return { status: "rejected", code, purpose, sourceRef, contentDigest, actionKind };
}

async function requireApproval(
  authority: ReviewedTutorContentAuthorityPort,
  request: ReviewedTutorContentApprovalRequest,
): Promise<ReviewedTutorContentPrivacyDecision> {
  const decision = await isApproved(authority, request);
  return decision === "approved"
    ? { status: "accepted" }
    : rejected(
        decision === "failure" ? "APPROVAL_AUTHORITY_FAILURE" : "CONTENT_NOT_APPROVED",
        request.purpose,
        request.sourceRef,
        request.contentDigest,
        request.actionKind,
      );
}

/**
 * Fail-closed provider-input admission. The free-form learner attempt channel
 * is disabled for Wave 1 even when the canonical minimizer could project it.
 */
export async function authorizeReviewedProviderContext(
  context: MinimizedProviderContext,
  memoryAccess: TutorV2BridgeMemoryAccess,
  authority: ReviewedTutorContentAuthorityPort,
): Promise<ReviewedTutorContentPrivacyDecision> {
  if ("currentLearnerAttempt" in context.instruction) {
    return rejected(
      "RAW_LEARNER_ATTEMPT_NOT_DISCLOSED",
      "provider-input-learner-attempt",
      context.instruction.currentLearnerAttempt.itemRef,
      null,
      null,
    );
  }

  const scope = scopeFrom(memoryAccess);
  const item = context.instruction.learnerSafeItem;
  if (item !== null) {
    const contentDigest = await reviewedTutorContentDigest(item.learnerSafeContent);
    const approval = await requireApproval(authority, {
      purpose: "provider-input-learner-safe-item",
      scope,
      context: contextFrom(context),
      sourceRef: item.itemRef,
      contentKind: item.itemKind,
      contentDigest,
      actionKind: null,
      groundingRefs: [],
    });
    if (approval.status === "rejected") return approval;
  }

  for (const grounding of context.instruction.groundingReferences) {
    if (grounding.learnerSafeContent === null) continue;
    const contentDigest = await reviewedTutorContentDigest(grounding.learnerSafeContent);
    if (contentDigest !== grounding.contentDigest) {
      return rejected(
        "CONTENT_DIGEST_MISMATCH",
        "provider-input-grounding-content",
        grounding.groundingRef,
        contentDigest,
        null,
      );
    }
    const approval = await requireApproval(authority, {
      purpose: "provider-input-grounding-content",
      scope,
      context: contextFrom(context),
      sourceRef: grounding.groundingRef,
      contentKind: grounding.kind,
      contentDigest,
      actionKind: null,
      groundingRefs: [grounding.groundingRef],
    });
    if (approval.status === "rejected") return approval;
  }

  return validateProviderContextContentPrivacy(context).status === "accepted"
    ? { status: "accepted" }
    : rejected("LEXICAL_DEFENSE_REJECTED", "provider-input-learner-safe-item", "privacy:defense-in-depth", null, null);
}

function actionContent(proposal: TutorActionProposal): {
  readonly purpose: "learner-facing-action-content" | "learner-facing-control-code";
  readonly content: string;
  readonly sourceRef: string;
  readonly contentKind: string;
  readonly groundingRefs: readonly string[];
} {
  const action = proposal.action;
  if ("content" in action) {
    return {
      purpose: "learner-facing-action-content",
      content: action.content,
      sourceRef: proposal.proposalRef,
      contentKind: "teaching-content",
      groundingRefs: action.groundingRefs,
    };
  }
  if ("question" in action) {
    return {
      purpose: "learner-facing-action-content",
      content: action.question,
      sourceRef: proposal.proposalRef,
      contentKind: `question-${action.checkKind}`,
      groundingRefs: action.groundingRefs,
    };
  }
  return {
    purpose: "learner-facing-control-code",
    content: action.reasonCode,
    sourceRef: action.reasonCode,
    contentKind: "policy-reason-code",
    groundingRefs: "groundingRefs" in action ? action.groundingRefs : [],
  };
}

/** Exact learner-facing prose/control-code admission after canonical policy. */
export async function authorizeReviewedLearnerAction(
  proposal: TutorActionProposal,
  context: MinimizedProviderContext,
  memoryAccess: TutorV2BridgeMemoryAccess,
  authority: ReviewedTutorContentAuthorityPort,
): Promise<ReviewedTutorContentPrivacyDecision> {
  const candidate = actionContent(proposal);
  const contentDigest = await reviewedTutorContentDigest(candidate.content);
  const request: ReviewedTutorContentApprovalRequest = {
    purpose: candidate.purpose,
    scope: scopeFrom(memoryAccess),
    context: contextFrom(context),
    sourceRef: candidate.sourceRef,
    contentKind: candidate.contentKind,
    contentDigest,
    actionKind: proposal.action.kind,
    groundingRefs: [...candidate.groundingRefs],
  };
  const approval = await requireApproval(authority, request);
  if (approval.status === "rejected") return approval;
  return validateLearnerSafeTutorAction(proposal.action).status === "accepted"
    ? { status: "accepted" }
    : rejected(
        "LEXICAL_DEFENSE_REJECTED",
        candidate.purpose,
        candidate.sourceRef,
        contentDigest,
        proposal.action.kind,
      );
}

/** Deterministic foundation implementation; production registry wiring is later-wave work. */
export function createInMemoryReviewedTutorContentAuthority(
  approvals: readonly ReviewedTutorContentApproval[],
): ReviewedTutorContentAuthorityPort {
  const catalog = new Map<string, string>();
  for (const approval of structuredClone(approvals)) {
    catalog.set(canonicalApprovalKey(approval), approval.approvalRef);
  }
  return Object.freeze({
    review(request: ReviewedTutorContentApprovalRequest): ReviewedTutorContentApprovalDecision {
      const approvalRef = catalog.get(canonicalApprovalKey(request));
      return approvalRef === undefined
        ? { status: "rejected", code: "CONTENT_NOT_APPROVED" }
        : { status: "approved", approvalRef };
    },
  });
}
