import type { SegmentId, SessionId } from "@study-contracts";
import type { TutorCoreBoundaryReceipt } from "../runtimeTypes";

export const TEMPORARY_SESSION6_BRIDGE_VERSION =
  "student-runtime.session6-bridge.v2" as const;

export interface TemporarySession6BridgeRequest {
  readonly schemaVersion: typeof TEMPORARY_SESSION6_BRIDGE_VERSION;
  readonly requestId: string;
  readonly sessionId: SessionId;
  /** DEC-004: this exact canonical SegmentId is the sole task identity. */
  readonly taskRef: SegmentId;
  readonly responseRef: string;
  readonly submissionRevision: number;
  /**
   * The temporary bridge may inspect local entered work for this browser demo.
   * It never returns, logs, or places that work in canonical evidence.
   */
  readonly localResponse: string;
  readonly expectedAnswer?: string;
  readonly minimumLength?: number;
  readonly occurredAt: string;
}

export type TemporarySession6BridgeResult =
  | { readonly ok: true; readonly receipt: TutorCoreBoundaryReceipt }
  | {
      readonly ok: false;
      readonly code: "unsupported-version" | "invalid-request";
      readonly safeMessage: string;
    };

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function normalizeDemoAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");
}

function invalid(
  code: "unsupported-version" | "invalid-request",
): TemporarySession6BridgeResult {
  return {
    ok: false,
    code,
    safeMessage:
      code === "unsupported-version"
        ? "The Tutor Core bridge version is unsupported and was quarantined."
        : "The Tutor Core bridge request was rejected at the local boundary.",
  };
}

/**
 * Temporary, local-only Session 6 boundary.
 *
 * This is deliberately not Tutor Core. It supplies a bounded demo directive so
 * Session 7 can exercise real canonical state and Session 2 pacing algorithms
 * while mastery and misconception fields remain unavailable.
 */
export function runTemporarySession6Bridge(
  request: unknown,
): TemporarySession6BridgeResult {
  if (
    typeof request !== "object" ||
    request === null ||
    !("schemaVersion" in request) ||
    request.schemaVersion !== TEMPORARY_SESSION6_BRIDGE_VERSION
  ) {
    return invalid("unsupported-version");
  }
  const candidate = request as Partial<TemporarySession6BridgeRequest>;
  if (
    typeof candidate.requestId !== "string" ||
    !OPAQUE_ID.test(candidate.requestId) ||
    typeof candidate.sessionId !== "string" ||
    !OPAQUE_ID.test(candidate.sessionId) ||
    typeof candidate.taskRef !== "string" ||
    !OPAQUE_ID.test(candidate.taskRef) ||
    typeof candidate.responseRef !== "string" ||
    !OPAQUE_ID.test(candidate.responseRef) ||
    !Number.isSafeInteger(candidate.submissionRevision) ||
    Number(candidate.submissionRevision) < 0 ||
    typeof candidate.localResponse !== "string" ||
    candidate.localResponse.length > 16_000 ||
    (candidate.expectedAnswer !== undefined &&
      (typeof candidate.expectedAnswer !== "string" ||
        candidate.expectedAnswer.length > 1_000)) ||
    (candidate.minimumLength !== undefined &&
      (!Number.isSafeInteger(candidate.minimumLength) ||
        candidate.minimumLength < 1 ||
        candidate.minimumLength > 2_000)) ||
    typeof candidate.occurredAt !== "string" ||
    Number.isNaN(Date.parse(candidate.occurredAt))
  ) {
    return invalid("invalid-request");
  }

  const accepted =
    candidate.expectedAnswer !== undefined
      ? normalizeDemoAnswer(candidate.localResponse) ===
        normalizeDemoAnswer(candidate.expectedAnswer)
      : candidate.localResponse.trim().length >= (candidate.minimumLength ?? 1);

  return {
    ok: true,
    receipt: {
      bridgeVersion: TEMPORARY_SESSION6_BRIDGE_VERSION,
      requestId: candidate.requestId,
      sessionId: candidate.sessionId,
      taskRef: candidate.taskRef,
      responseRef: candidate.responseRef,
      submissionRevision: candidate.submissionRevision as number,
      directive: accepted ? "continue" : "reteach",
      masteryAuthority: "withheld-pending-tutor-core",
      misconceptionAuthority: "withheld-pending-tutor-core",
      reasonCode: accepted
        ? "demo-rubric-accepted"
        : "demo-rubric-needs-support",
      occurredAt: candidate.occurredAt,
    },
  };
}
