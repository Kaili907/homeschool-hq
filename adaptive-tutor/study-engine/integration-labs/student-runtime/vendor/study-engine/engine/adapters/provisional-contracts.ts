import type {
  CoreInstructionDirective,
  SessionEvent,
} from "../orchestrator/index.js";
import type { GradeBand } from "../focus/index.js";

export const PROVISIONAL_CONTRACT_VERSIONS = {
  sessionContext: "provisional.study-engine.session-context.v1",
  tutorCoreOutcome: "provisional.tutor-core.instruction-outcome.v1",
} as const;

export type ProvisionalGradeBand = "elementary" | "middle" | "high";

/**
 * Minimal context required by the timing engine. Direct identity, diagnosis,
 * transcripts, and answer content are deliberately excluded.
 */
export interface ProvisionalSessionContext {
  readonly schemaVersion: typeof PROVISIONAL_CONTRACT_VERSIONS.sessionContext;
  readonly sessionRef: string;
  readonly gradeBand: ProvisionalGradeBand;
  readonly subjectKey: string;
  readonly taskTypeKey: string;
  readonly timeZone: string;
}

export interface ProvisionalTutorCoreOutcome {
  readonly schemaVersion: typeof PROVISIONAL_CONTRACT_VERSIONS.tutorCoreOutcome;
  readonly sessionRef: string;
  readonly occurredAt: string;
  /**
   * Copied from the tutor core; never calculated by the study engine.
   */
  readonly instructionDirective: CoreInstructionDirective;
}

export type ContractAdapterErrorCode =
  | "invalid_shape"
  | "unsupported_version"
  | "invalid_field"
  | "session_mismatch";

export interface ContractAdapterError {
  readonly code: ContractAdapterErrorCode;
  /**
   * Safe, fixed text. Source values are never interpolated into errors.
   */
  readonly message: string;
}

export type ContractAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContractAdapterError };

const OPAQUE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const OFFSET_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(
  code: ContractAdapterErrorCode,
  message: string,
): ContractAdapterResult<never> {
  return { ok: false, error: { code, message } };
}

function isOpaqueKey(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_KEY.test(value);
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isOffsetTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = OFFSET_TIMESTAMP.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);

  return (
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 14 &&
    offsetMinute <= 59 &&
    (offsetHour !== 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
  );
}

export function adaptProvisionalSessionContext(
  source: unknown,
): ContractAdapterResult<ProvisionalSessionContext> {
  if (!isRecord(source)) {
    return invalid(
      "invalid_shape",
      "Session context must be a keyed object.",
    );
  }
  if (
    source.schemaVersion !== PROVISIONAL_CONTRACT_VERSIONS.sessionContext
  ) {
    return invalid(
      "unsupported_version",
      "Session context contract version is unsupported.",
    );
  }
  if (
    !isOpaqueKey(source.sessionRef) ||
    !isOpaqueKey(source.subjectKey) ||
    !isOpaqueKey(source.taskTypeKey)
  ) {
    return invalid(
      "invalid_field",
      "Session context contains an invalid opaque reference.",
    );
  }
  if (
    source.gradeBand !== "elementary" &&
    source.gradeBand !== "middle" &&
    source.gradeBand !== "high"
  ) {
    return invalid(
      "invalid_field",
      "Session context grade band is unsupported.",
    );
  }
  if (!isTimeZone(source.timeZone)) {
    return invalid(
      "invalid_field",
      "Session context time zone is invalid.",
    );
  }

  // Explicit allowlist: unknown fields, including accidental PII, are dropped.
  return {
    ok: true,
    value: {
      schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.sessionContext,
      sessionRef: source.sessionRef,
      gradeBand: source.gradeBand,
      subjectKey: source.subjectKey,
      taskTypeKey: source.taskTypeKey,
      timeZone: source.timeZone,
    },
  };
}

export function adaptTutorCoreOutcome(
  source: unknown,
  expectedSessionRef: string,
): ContractAdapterResult<
  Extract<SessionEvent, { type: "confidence_check_completed" }>
> {
  if (!isRecord(source)) {
    return invalid(
      "invalid_shape",
      "Tutor-core outcome must be a keyed object.",
    );
  }
  if (
    source.schemaVersion !== PROVISIONAL_CONTRACT_VERSIONS.tutorCoreOutcome
  ) {
    return invalid(
      "unsupported_version",
      "Tutor-core outcome contract version is unsupported.",
    );
  }
  if (!isOpaqueKey(source.sessionRef) || !isOpaqueKey(expectedSessionRef)) {
    return invalid(
      "invalid_field",
      "Tutor-core outcome has an invalid session reference.",
    );
  }
  if (source.sessionRef !== expectedSessionRef) {
    return invalid(
      "session_mismatch",
      "Tutor-core outcome belongs to a different session.",
    );
  }
  if (!isOffsetTimestamp(source.occurredAt)) {
    return invalid(
      "invalid_field",
      "Tutor-core outcome timestamp is invalid.",
    );
  }
  if (
    source.instructionDirective !== "correct" &&
    source.instructionDirective !== "reteach"
  ) {
    return invalid(
      "invalid_field",
      "Tutor-core instruction directive is invalid.",
    );
  }

  return {
    ok: true,
    value: {
      type: "confidence_check_completed",
      at: source.occurredAt,
      coreDirective: source.instructionDirective,
    },
  };
}

/**
 * Temporary enum reconciliation between the guessed external contract and the
 * local focus engine. Delete this mapper only when the canonical contract uses
 * the focus engine's exact grade-band vocabulary.
 */
export function mapProvisionalGradeBandToFocus(
  gradeBand: ProvisionalGradeBand,
): GradeBand {
  switch (gradeBand) {
    case "elementary":
      return "elementary";
    case "middle":
      return "middle_school";
    case "high":
      return "high_school";
  }
}
