import type {
  EvidenceId,
  IanaTimeZone,
  RetrievalAttemptId,
  ReviewId,
  SessionId,
  SessionResult,
  SkillId,
  StudentId,
  SubjectId,
} from "../../contracts/index";
import {
  STUDY_ENGINE_SCHEMA_VERSION,
} from "../../contracts/index";
import type {
  IntervalAdjustment,
  PrerequisiteRemediationTrigger,
  RetrievalAttempt,
  ReteachingTrigger,
  ReviewInterval,
  StudentSkillReview,
} from "../../contracts/review-scheduling";
import {
  addCalendarDays,
  calendarDate,
  REVIEW_SCHEDULE_GUIDANCE,
  scheduleNextReview,
} from "../../engine/review/index";
import type {
  RetrievalEvidence,
  ReviewProgressState,
  ReviewRecommendation,
  ReviewSchedulerConfig,
  ReteachingOutcome,
} from "../../engine/review/index";

/**
 * Card 8 owns this adapter boundary. The canonical package intentionally has
 * no queue contract, so this local shape must not leak into Wave 1 packages.
 */
export const REVIEW_RUNTIME_SCHEMA_VERSION =
  "calendar-parent-review-entry.v1" as const;

export const REVIEW_PRIORITIES = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;

export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number];

export type ReviewWorkKind =
  | "review"
  | "reteaching"
  | "prerequisite-remediation";

export interface LearnerLocalRetryIntent {
  readonly kind: "learner-local-retry-window";
  /** DEC-014 canonical retry-window name. */
  readonly householdTimeZone: IanaTimeZone;
  /** DEC-014 canonical retry-window name. */
  readonly notBeforeLocalDate: string;
  /** DEC-014 canonical retry-window name. */
  readonly dueByLocalDate: string;
  /** Compatibility aliases retained for existing Card 8 calendar consumers. */
  readonly timeZone: IanaTimeZone;
  readonly localDate: string;
  readonly dueDate: string;
  readonly attemptOrdinal: number | null;
  readonly dailyAttemptLimit: number | null;
  /**
   * DEC-014: null is the safe default. This is populated only from an
   * authorized scheduler/adult policy; the adapter never calculates it.
   */
  readonly retryNotBefore: string | null;
  readonly earliestLocalTime: string | null;
  readonly latestLocalTime: string | null;
  readonly requiredSupportBoundaryRef: string | null;
  readonly completedSupportBoundaryRef: string | null;
  readonly policyProvenance: AuthorizedSameDayPolicyProvenance | null;
  readonly status:
    | "manual-review"
    | "awaiting-preparation"
    | "awaiting-break-or-session-boundary"
    | "daily-limit-reached"
    | "authorized-slot-ready";
  readonly requiredPreparation:
    | "none"
    | "reteach-before-retrieval"
    | "address-prerequisite-before-retrieval";
  readonly preparationEvidenceRefs: readonly string[];
  readonly resolution:
    | "manual-review-required"
    | "authorized-slot-may-be-projected";
}

export interface AuthorizedSameDayPolicyProvenance {
  readonly policyId: string;
  readonly policyVersion: 1;
  readonly source: "authorized-calendar-policy" | "adult-scheduled-slot";
  readonly authorizationRef: string;
  readonly authorizedByRole: "parent" | "teacher" | "system";
  readonly authorizedAt: string;
}

export interface AuthorizedSameDayWindow {
  readonly provenance: AuthorizedSameDayPolicyProvenance;
  readonly householdTimeZone: IanaTimeZone;
  readonly localDate: string;
  /** Explicit offset instant supplied by the authorized policy. */
  readonly retryNotBefore: string;
  readonly latestLocalTime: string;
}

export interface CompletedSupportBoundary {
  readonly ref: string;
  readonly kind: "break-completed" | "session-ended";
  readonly completedAt: string;
}

export interface CompletedRetryPreparation {
  readonly kind:
    | "reteaching-completed"
    | "prerequisite-remediation-completed";
  readonly completedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface SameDayRetryPolicy {
  /**
   * These legacy fields remain optional for source compatibility only. Card 8
   * deliberately ignores them because DEC-014 forbids deriving a retry time
   * from a cooldown.
   */
  readonly cooldownMinutes?: number;
  readonly latestLocalTime?: string;
  readonly attemptOrdinal?: number;
  readonly dailyAttemptLimit?: number;
  readonly requiredSupportBoundaryRef?: string;
  readonly completedSupportBoundary?: CompletedSupportBoundary;
  readonly completedPreparation?: CompletedRetryPreparation;
  readonly authorizedWindow?: AuthorizedSameDayWindow;
}

export interface ReviewQueueEntry {
  readonly schemaVersion: typeof REVIEW_RUNTIME_SCHEMA_VERSION;
  /** Stable Card 8 internal ID supplied by the caller; never regenerated. */
  readonly id: string;
  /** Stable Session 2/external recommendation ID preserved byte-for-byte. */
  readonly sourceRecommendationId: string;
  /**
   * Deterministic digest of the complete source envelope. New adapter-created
   * entries always carry it; it detects changed bytes without projecting the
   * source payload or learner identifiers into the queue.
   */
  readonly sourceRecommendationDigest?: string;
  readonly canonicalReviewId: ReviewId;
  readonly canonicalReviewRevision: number;
  readonly skillId: SkillId;
  readonly title: string;
  readonly workKind: ReviewWorkKind;
  readonly priority: ReviewPriority;
  readonly createdAt: string;
  readonly scheduledDate: string;
  readonly estimatedMinutes: number;
  /** Actual duration is recorded independently and never replaces the estimate. */
  readonly actualDurationSeconds: number | null;
  readonly state: "pending" | "completed";
  readonly retryIntent: LearnerLocalRetryIntent | null;
}

export type ReviewTraceCode =
  | "recommendation-received"
  | "canonical-review-created"
  | "canonical-review-updated"
  | "canonical-review-idempotent"
  | "queue-entry-inserted"
  | "queue-entry-idempotent"
  | "same-day-retry-window-created"
  | "future-review-date-preserved"
  | "required-instruction-reserved"
  | "review-scheduled"
  | "review-held-required-instruction"
  | "review-held-item-limit"
  | "review-held-minute-limit"
  | "review-held-priority-preserved"
  | "review-held-same-day-manual-review"
  | "review-held-same-day-preparation"
  | "review-held-same-day-boundary"
  | "review-held-same-day-attempt-limit"
  | "daily-plan-complete"
  | "canonical-result-accepted"
  | "retrieval-attempt-recorded"
  | "retrieval-attempt-idempotent"
  | "completed-queue-entry-updated"
  | "engine-recommendation-produced"
  | "result-return-command-enqueued"
  | "result-return-command-idempotent";

export interface ReviewRuntimeTrace {
  readonly sequence: number;
  readonly code: ReviewTraceCode;
  readonly detail: string;
}

export class ReviewRuntimeError extends Error {
  public readonly name = "ReviewRuntimeError";

  public constructor(
    public readonly code:
      | "invalid-input"
      | "identity-conflict"
      | "duplicate-entry"
      | "missing-entry"
      | "result-evidence-mismatch"
      | "result-action-mismatch",
    message: string,
  ) {
    super(message);
  }
}

export interface EngineRecommendationEnvelope {
  readonly queueEntryId: string;
  readonly sourceRecommendationId: string;
  readonly reviewId: ReviewId;
  readonly studentId: StudentId;
  readonly subjectId: SubjectId;
  readonly skillId: SkillId;
  readonly title: string;
  readonly timeZone: IanaTimeZone;
  readonly generatedAt: string;
  readonly recommendation: ReviewRecommendation;
  /**
   * Priority is an authorized upstream decision. This adapter does not infer a
   * learner trait or derive priority from hidden behavior.
   */
  readonly authorizedPriority: ReviewPriority;
  readonly estimatedMinutes: number;
  readonly basisEvidenceIds: readonly EvidenceId[];
  readonly prerequisiteSkillIds?: readonly SkillId[];
  readonly sameDayPolicy: SameDayRetryPolicy;
}

export interface IngestEngineRecommendationInput {
  readonly envelope: EngineRecommendationEnvelope;
  readonly currentReview?: StudentSkillReview;
  readonly queueEntries: readonly ReviewQueueEntry[];
}

export interface IngestEngineRecommendationResult {
  readonly canonicalReview: StudentSkillReview;
  readonly queueEntry: ReviewQueueEntry;
  readonly queueEntries: readonly ReviewQueueEntry[];
  readonly canonicalAction: "created" | "updated" | "idempotent";
  readonly queueAction: "inserted" | "idempotent";
  readonly trace: readonly ReviewRuntimeTrace[];
}

export interface DailyReviewLimits {
  readonly maxItems: number;
  readonly maxMinutes: number;
}

export interface BuildDailyReviewPlanInput {
  readonly planningDate: string;
  readonly totalAvailableMinutes: number;
  readonly requiredInstructionMinutes: number;
  readonly limits: DailyReviewLimits;
  readonly queueEntries: readonly ReviewQueueEntry[];
}

export type ReviewTiming = "overdue" | "same-day";

export interface PlannedReview {
  readonly entry: ReviewQueueEntry;
  readonly timing: ReviewTiming;
  readonly queuePosition: number;
}

export type HeldReviewReason =
  | "required-instruction-reserved"
  | "daily-item-limit"
  | "daily-minute-limit"
  | "priority-preserved"
  | "same-day-manual-review"
  | "same-day-preparation-required"
  | "same-day-boundary-required"
  | "same-day-attempt-limit";

export interface HeldReview {
  readonly entry: ReviewQueueEntry;
  readonly timing: ReviewTiming;
  readonly reason: HeldReviewReason;
  readonly heldBehindEntryId: string | null;
}

export interface DailyReviewPlan {
  readonly planningDate: string;
  readonly requiredInstructionMinutes: number;
  readonly totalAvailableMinutes: number;
  readonly reviewMinuteBudget: number;
  readonly scheduled: readonly PlannedReview[];
  readonly held: readonly HeldReview[];
  readonly upcoming: readonly ReviewQueueEntry[];
  readonly completedExcludedEntryIds: readonly string[];
  readonly scheduledReviewMinutes: number;
  readonly overloadAvoided: boolean;
  readonly trace: readonly ReviewRuntimeTrace[];
}

export interface EngineFeedbackSignals {
  /**
   * Session 2 accepts a 0..1 proportion but the canonical attempt has no
   * confidence field. Null means it was not collected.
   */
  readonly confidence: number | null;
  readonly consecutiveSuccessfulRetrievals: number;
  /** These are authoritative Tutor Core decisions, not adapter inferences. */
  readonly retrievalFailed: boolean;
  readonly prerequisiteGap: boolean;
  readonly reteachingOutcome: ReteachingOutcome;
}

export const REVIEW_RESULT_RETURN_COMMAND_VERSION = 1 as const;
export const REVIEW_RESULT_RETURN_OUTBOX_VERSION = 1 as const;

export interface ReviewResultReturnCommand {
  readonly kind: "review-result-return-command";
  readonly schemaVersion: typeof REVIEW_RESULT_RETURN_COMMAND_VERSION;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedReviewRevision: number;
  readonly canonicalReviewId: ReviewId;
  readonly completedQueueEntryId: string;
  readonly canonicalResultId: string;
  /** Required DEC-017 canonical StudySession linkage. */
  readonly sessionId: SessionId;
  readonly retrievalAttemptId: RetrievalAttemptId;
  readonly evidenceId: EvidenceId;
  readonly reviewedOn: string;
  readonly recordedAt: string;
  /** Aggregate-only Session 2 input; never raw answers or transcript content. */
  readonly engineEvidence: RetrievalEvidence;
}

export interface ReviewResultReturnOutboxValue {
  readonly kind: "review-result-return-outbox";
  readonly schemaVersion: typeof REVIEW_RESULT_RETURN_OUTBOX_VERSION;
  readonly outboxId: string;
  readonly idempotencyKey: string;
  readonly state: "pending";
  readonly enqueuedAt: string;
  readonly command: ReviewResultReturnCommand;
}

export interface ReviewResultReturnRequest {
  readonly commandId: string;
  readonly outboxId: string;
  readonly idempotencyKey: string;
  readonly expectedReviewRevision: number;
  /** Memory supplied by the host for this pure invocation; no storage occurs. */
  readonly currentOutbox: readonly ReviewResultReturnOutboxValue[];
}

export interface ApplyCanonicalReviewResultInput {
  readonly canonicalReview: StudentSkillReview;
  readonly queueEntries: readonly ReviewQueueEntry[];
  readonly completedQueueEntryId: string;
  readonly result: SessionResult;
  readonly attempt: RetrievalAttempt;
  readonly progressState: ReviewProgressState;
  readonly feedbackSignals: EngineFeedbackSignals;
  readonly schedulerConfig?: ReviewSchedulerConfig;
  readonly nextQueueEntryId: string;
  readonly nextSourceRecommendationId: string;
  readonly title: string;
  readonly authorizedPriority: ReviewPriority;
  readonly estimatedMinutes: number;
  readonly prerequisiteSkillIds?: readonly SkillId[];
  readonly sameDayPolicy: SameDayRetryPolicy;
  readonly resultReturn: ReviewResultReturnRequest;
}

export interface CanonicalReviewResultFeedback {
  readonly acknowledgedResultId: string;
  readonly engineEvidence: RetrievalEvidence;
  readonly engineRecommendation: ReviewRecommendation;
  readonly progressState: ReviewProgressState;
  readonly canonicalReview: StudentSkillReview;
  readonly completedQueueEntry: ReviewQueueEntry;
  readonly nextQueueEntry: ReviewQueueEntry;
  readonly queueEntries: readonly ReviewQueueEntry[];
  readonly resultReturnCommand: ReviewResultReturnCommand;
  readonly resultReturnOutboxValue: ReviewResultReturnOutboxValue;
  readonly resultReturnOutbox: readonly ReviewResultReturnOutboxValue[];
  readonly resultReturnAction: "enqueued" | "idempotent";
  readonly trace: readonly ReviewRuntimeTrace[];
}

const PRIORITY_RANK: Readonly<Record<ReviewPriority, number>> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Card 5 DEC-009 classifies this aggregate-only conversion as a safe adapter.
 * The values are local to Card 8 and cannot establish mastery, diagnose a
 * learner, or authorize instructional action.
 */
const INDEPENDENCE_SCORE: Readonly<
  Record<RetrievalAttempt["independence"], number>
> = {
  independent: 1,
  "minimal-support": 0.75,
  guided: 0.5,
  "full-support": 0,
};

function trace(
  codes: readonly { readonly code: ReviewTraceCode; readonly detail: string }[],
): readonly ReviewRuntimeTrace[] {
  return codes.map((item, index) => ({ sequence: index + 1, ...item }));
}

function resequence(
  entries: readonly Omit<ReviewRuntimeTrace, "sequence">[],
): readonly ReviewRuntimeTrace[] {
  return entries.map((entry, index) => ({ sequence: index + 1, ...entry }));
}

function traceWithoutSequence(
  entries: readonly ReviewRuntimeTrace[],
): readonly Omit<ReviewRuntimeTrace, "sequence">[] {
  return entries.map(({ code, detail }) => ({ code, detail }));
}

/**
 * Canonical JSON is used only for local equality and digest checks. Sorting
 * object keys makes caller property order irrelevant while retaining array
 * order and the JSON distinction between absent object fields and array nulls.
 */
function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Adapter payload numbers must be finite.",
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? "null" : canonicalJson(item)))
      .join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Adapter payloads must contain only plain JSON objects.",
      );
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalJson(item)}`,
      )
      .join(",")}}`;
  }
  throw new ReviewRuntimeError(
    "invalid-input",
    "Adapter payloads must contain only JSON-compatible values.",
  );
}

function sourceRecommendationDigest(
  envelope: EngineRecommendationEnvelope,
): string {
  const bytes = new TextEncoder().encode(canonicalJson(envelope));
  const mask = 0xffff_ffff_ffff_ffffn;
  const prime = 0x0000_0100_0000_01b3n;
  const hash = (seed: bigint): string => {
    let value = seed;
    for (const byte of bytes) {
      value ^= BigInt(byte);
      value = (value * prime) & mask;
    }
    return value.toString(16).padStart(16, "0");
  };
  return `fnv1a64x2:${hash(0xcbf2_9ce4_8422_2325n)}${hash(
    0x8422_2325_cbf2_9ce4n,
  )}:${bytes.length}`;
}

function assertNonEmpty(value: string, field: string, maximum = 256): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must contain 1-${maximum} characters.`,
    );
  }
}

function assertIntegerAtLeast(
  value: number,
  minimum: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must be a safe integer at least ${minimum}.`,
    );
  }
}

function assertProportionOrNull(value: number | null, field: string): void {
  if (
    value !== null &&
    (!Number.isFinite(value) || value < 0 || value > 1)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must be null or a finite number from 0 to 1.`,
    );
  }
}

function assertInstant(value: string, field: string): Date {
  assertNonEmpty(value, field);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must include an explicit UTC offset.`,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must be a valid ISO date-time.`,
    );
  }
  return parsed;
}

function assertTime(value: string, field: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ReviewRuntimeError(
      "invalid-input",
      `${field} must use 24-hour HH:mm form.`,
    );
  }
}

function assertIanaTimeZone(value: string): void {
  assertNonEmpty(value, "timeZone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    throw new ReviewRuntimeError(
      "invalid-input",
      "timeZone must be a supported IANA time-zone name.",
    );
  }
}

function localParts(
  instant: Date,
  timeZone: string,
): { readonly date: string; readonly time: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
  } catch {
    throw new ReviewRuntimeError(
      "invalid-input",
      "timeZone must be a supported IANA time-zone name.",
    );
  }
  const get = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (!year || !month || !day || !hour || !minute) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Unable to derive learner-local date and time.",
    );
  }
  return {
    date: calendarDate(`${year}-${month}-${day}`),
    time: `${hour}:${minute}`,
  };
}

function reviewInterval(days: number): ReviewInterval {
  assertIntegerAtLeast(days, 0, "recommendation.intervalDays");
  switch (days) {
    case 0:
      return { id: "same-day", days };
    case 1:
      return { id: "one-day", days };
    case 3:
      return { id: "three-day", days };
    case 7:
      return { id: "seven-day", days };
    case 14:
      return { id: "fourteen-day", days };
    case 30:
      return { id: "thirty-day", days };
    default:
      return { id: "custom", days };
  }
}

function adjustmentAction(
  from: ReviewInterval,
  to: ReviewInterval,
): IntervalAdjustment["action"] {
  if (to.days > from.days) {
    return "interval-expansion";
  }
  if (to.days < from.days) {
    return "interval-contraction";
  }
  return "interval-maintained";
}

function workKind(
  recommendation: ReviewRecommendation,
): ReviewWorkKind {
  if (recommendation.preparation === "reteach_before_retrieval") {
    return "reteaching";
  }
  if (
    recommendation.preparation ===
    "address_prerequisite_before_retrieval"
  ) {
    return "prerequisite-remediation";
  }
  return "review";
}

function requiredPreparation(
  recommendation: ReviewRecommendation,
): LearnerLocalRetryIntent["requiredPreparation"] {
  if (recommendation.preparation === "reteach_before_retrieval") {
    return "reteach-before-retrieval";
  }
  if (
    recommendation.preparation ===
    "address_prerequisite_before_retrieval"
  ) {
    return "address-prerequisite-before-retrieval";
  }
  return "none";
}

function createRetryIntent(
  envelope: EngineRecommendationEnvelope,
): LearnerLocalRetryIntent | null {
  if (envelope.recommendation.intervalDays !== 0) {
    return null;
  }
  if (
    envelope.recommendation.reviewedOn !== envelope.recommendation.dueOn
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "A same-day recommendation must use the reviewed date as its due date.",
    );
  }
  const generatedAt = assertInstant(envelope.generatedAt, "generatedAt");
  const generatedLocal = localParts(generatedAt, envelope.timeZone);
  if (generatedLocal.date !== envelope.recommendation.reviewedOn) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "recommendation.reviewedOn must be the learner-local date of generatedAt.",
    );
  }
  const policy = envelope.sameDayPolicy;
  const attemptOrdinal = policy.attemptOrdinal ?? null;
  const dailyAttemptLimit = policy.dailyAttemptLimit ?? null;
  if (attemptOrdinal !== null) {
    assertIntegerAtLeast(attemptOrdinal, 1, "sameDayPolicy.attemptOrdinal");
  }
  if (dailyAttemptLimit !== null) {
    assertIntegerAtLeast(
      dailyAttemptLimit,
      1,
      "sameDayPolicy.dailyAttemptLimit",
    );
  }
  const requiredBoundaryRef =
    policy.requiredSupportBoundaryRef ?? null;
  if (requiredBoundaryRef !== null) {
    assertNonEmpty(
      requiredBoundaryRef,
      "sameDayPolicy.requiredSupportBoundaryRef",
    );
  }

  const preparation = requiredPreparation(envelope.recommendation);
  const preparationEvidence = policy.completedPreparation;
  if (preparationEvidence) {
    if (
      preparationEvidence.kind !== "reteaching-completed" &&
      preparationEvidence.kind !== "prerequisite-remediation-completed"
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Completed retry preparation kind is unsupported.",
      );
    }
    const preparationCompletedAt = assertInstant(
      preparationEvidence.completedAt,
      "sameDayPolicy.completedPreparation.completedAt",
    );
    if (preparationCompletedAt.getTime() < generatedAt.getTime()) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Completed retry preparation cannot predate the recommendation.",
      );
    }
    if (preparationEvidence.evidenceRefs.length === 0) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Completed retry preparation requires at least one evidence reference.",
      );
    }
    for (const evidenceRef of preparationEvidence.evidenceRefs) {
      assertNonEmpty(
        evidenceRef,
        "sameDayPolicy.completedPreparation.evidenceRefs[]",
      );
    }
  }
  const expectedPreparationKind =
    preparation === "reteach-before-retrieval"
      ? "reteaching-completed"
      : preparation === "address-prerequisite-before-retrieval"
        ? "prerequisite-remediation-completed"
        : null;
  const preparationSatisfied =
    expectedPreparationKind === null ||
    preparationEvidence?.kind === expectedPreparationKind;

  const completedBoundary = policy.completedSupportBoundary;
  if (completedBoundary) {
    if (
      completedBoundary.kind !== "break-completed" &&
      completedBoundary.kind !== "session-ended"
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Completed support boundary kind is unsupported.",
      );
    }
    assertNonEmpty(
      completedBoundary.ref,
      "sameDayPolicy.completedSupportBoundary.ref",
    );
    const boundaryCompletedAt = assertInstant(
      completedBoundary.completedAt,
      "sameDayPolicy.completedSupportBoundary.completedAt",
    );
    if (boundaryCompletedAt.getTime() < generatedAt.getTime()) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Completed support boundary cannot predate the recommendation.",
      );
    }
  }
  const boundarySatisfied =
    requiredBoundaryRef !== null &&
    completedBoundary?.ref === requiredBoundaryRef;

  const authorizedWindow = policy.authorizedWindow;
  let retryNotBefore: string | null = null;
  let earliestLocalTime: string | null = null;
  let latestLocalTime: string | null = null;
  let policyProvenance: AuthorizedSameDayPolicyProvenance | null = null;
  if (authorizedWindow) {
    assertIanaTimeZone(authorizedWindow.householdTimeZone);
    if (authorizedWindow.householdTimeZone !== envelope.timeZone) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "Authorized same-day window must use the canonical household time zone.",
      );
    }
    calendarDate(authorizedWindow.localDate);
    if (authorizedWindow.localDate !== envelope.recommendation.dueOn) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized same-day window must use the recommendation due date.",
      );
    }
    assertNonEmpty(
      authorizedWindow.provenance.policyId,
      "authorizedWindow.provenance.policyId",
    );
    if (authorizedWindow.provenance.policyVersion !== 1) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized same-day policy version is unsupported.",
      );
    }
    if (
      authorizedWindow.provenance.source !==
        "authorized-calendar-policy" &&
      authorizedWindow.provenance.source !== "adult-scheduled-slot"
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized same-day policy source is unsupported.",
      );
    }
    if (
      authorizedWindow.provenance.authorizedByRole !== "parent" &&
      authorizedWindow.provenance.authorizedByRole !== "teacher" &&
      authorizedWindow.provenance.authorizedByRole !== "system"
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized same-day policy actor role is unsupported.",
      );
    }
    assertNonEmpty(
      authorizedWindow.provenance.authorizationRef,
      "authorizedWindow.provenance.authorizationRef",
    );
    const authorizedAt = assertInstant(
      authorizedWindow.provenance.authorizedAt,
      "authorizedWindow.provenance.authorizedAt",
    );
    const notBefore = assertInstant(
      authorizedWindow.retryNotBefore,
      "authorizedWindow.retryNotBefore",
    );
    if (notBefore.getTime() < generatedAt.getTime()) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before cannot predate the recommendation.",
      );
    }
    if (authorizedAt.getTime() > notBefore.getTime()) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before cannot predate its authorization.",
      );
    }
    const notBeforeLocal = localParts(notBefore, envelope.timeZone);
    if (notBeforeLocal.date !== envelope.recommendation.dueOn) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before instant must fall on the learner-local due date.",
      );
    }
    assertTime(
      authorizedWindow.latestLocalTime,
      "authorizedWindow.latestLocalTime",
    );
    if (notBeforeLocal.time >= authorizedWindow.latestLocalTime) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before must be earlier than the latest local time.",
      );
    }
    if (
      completedBoundary &&
      Date.parse(completedBoundary.completedAt) > notBefore.getTime()
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before cannot precede the completed support boundary.",
      );
    }
    if (
      preparationEvidence &&
      Date.parse(preparationEvidence.completedAt) > notBefore.getTime()
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Authorized retry-not-before cannot precede completed preparation.",
      );
    }
    retryNotBefore = authorizedWindow.retryNotBefore;
    earliestLocalTime = notBeforeLocal.time;
    latestLocalTime = authorizedWindow.latestLocalTime;
    policyProvenance = authorizedWindow.provenance;
  }

  let status: LearnerLocalRetryIntent["status"] = "manual-review";
  if (
    attemptOrdinal === null ||
    dailyAttemptLimit === null ||
    requiredBoundaryRef === null ||
    !authorizedWindow
  ) {
    status = "manual-review";
  } else if (
    attemptOrdinal !== null &&
    dailyAttemptLimit !== null &&
    attemptOrdinal > dailyAttemptLimit
  ) {
    status = "daily-limit-reached";
  } else if (!preparationSatisfied) {
    status = "awaiting-preparation";
  } else if (!boundarySatisfied) {
    status = "awaiting-break-or-session-boundary";
  } else {
    status = "authorized-slot-ready";
  }
  const authorized =
    status === "authorized-slot-ready" &&
    retryNotBefore !== null &&
    policyProvenance !== null;

  return {
    kind: "learner-local-retry-window",
    householdTimeZone: envelope.timeZone,
    notBeforeLocalDate: envelope.recommendation.reviewedOn,
    dueByLocalDate: envelope.recommendation.dueOn,
    timeZone: envelope.timeZone,
    localDate: envelope.recommendation.dueOn,
    dueDate: envelope.recommendation.dueOn,
    attemptOrdinal,
    dailyAttemptLimit,
    retryNotBefore: authorized ? retryNotBefore : null,
    earliestLocalTime: authorized ? earliestLocalTime : null,
    latestLocalTime: authorized ? latestLocalTime : null,
    requiredSupportBoundaryRef: requiredBoundaryRef,
    completedSupportBoundaryRef: completedBoundary?.ref ?? null,
    policyProvenance: authorized ? policyProvenance : null,
    status,
    requiredPreparation: preparation,
    preparationEvidenceRefs: preparationSatisfied
      ? [...(preparationEvidence?.evidenceRefs ?? [])]
      : [],
    resolution: authorized
      ? "authorized-slot-may-be-projected"
      : "manual-review-required",
  };
}

function assertEnvelope(envelope: EngineRecommendationEnvelope): void {
  assertNonEmpty(envelope.queueEntryId, "queueEntryId");
  assertNonEmpty(
    envelope.sourceRecommendationId,
    "sourceRecommendationId",
  );
  assertNonEmpty(envelope.reviewId, "reviewId");
  assertNonEmpty(envelope.studentId, "studentId");
  assertNonEmpty(envelope.subjectId, "subjectId");
  assertNonEmpty(envelope.skillId, "skillId");
  assertNonEmpty(envelope.title, "title", 120);
  assertIanaTimeZone(envelope.timeZone);
  const generatedAt = assertInstant(envelope.generatedAt, "generatedAt");
  const reviewedOn = calendarDate(envelope.recommendation.reviewedOn);
  const dueOn = calendarDate(envelope.recommendation.dueOn);
  assertIntegerAtLeast(
    envelope.recommendation.intervalDays,
    0,
    "recommendation.intervalDays",
  );
  assertIntegerAtLeast(
    envelope.recommendation.baselineIntervalDays,
    0,
    "recommendation.baselineIntervalDays",
  );
  assertIntegerAtLeast(
    envelope.recommendation.baselineIndex,
    0,
    "recommendation.baselineIndex",
  );
  if (
    envelope.recommendation.nextState.lastBaselineIndex !==
    envelope.recommendation.baselineIndex
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Recommendation next state must retain its selected baseline index.",
    );
  }
  if (
    dueOn !==
    addCalendarDays(reviewedOn, envelope.recommendation.intervalDays)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Recommendation due date must equal reviewedOn plus intervalDays.",
    );
  }
  if (localParts(generatedAt, envelope.timeZone).date !== reviewedOn) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Recommendation reviewedOn must be the learner-local date of generatedAt.",
    );
  }
  if (
    envelope.recommendation.guidance !== REVIEW_SCHEDULE_GUIDANCE ||
    !["start", "shorten", "hold", "advance"].includes(
      envelope.recommendation.cadenceAction,
    ) ||
    ![
      "same_day",
      "shortened",
      "baseline",
      "modestly_extended",
      "capped",
    ].includes(envelope.recommendation.intervalAdjustment) ||
    ![
      "none",
      "reteach_before_retrieval",
      "address_prerequisite_before_retrieval",
    ].includes(envelope.recommendation.preparation)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Recommendation contains unsupported Session 2 scheduling vocabulary.",
    );
  }
  if (
    !REVIEW_PRIORITIES.includes(envelope.authorizedPriority) ||
    envelope.estimatedMinutes < 1 ||
    envelope.estimatedMinutes > 180 ||
    !Number.isSafeInteger(envelope.estimatedMinutes)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Recommendation priority or estimated duration is invalid.",
    );
  }
  const evidenceIds = new Set<string>();
  for (const evidenceId of envelope.basisEvidenceIds) {
    assertNonEmpty(evidenceId, "basisEvidenceIds[]");
    if (evidenceIds.has(evidenceId)) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Recommendation basis evidence IDs must be unique.",
      );
    }
    evidenceIds.add(evidenceId);
  }
  if (
    envelope.recommendation.preparation !== "none" &&
    evidenceIds.size === 0
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Reteaching or remediation requires canonical basis evidence.",
    );
  }
  if (
    envelope.recommendation.preparation ===
      "address_prerequisite_before_retrieval" &&
    (!envelope.prerequisiteSkillIds ||
      envelope.prerequisiteSkillIds.length === 0)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Prerequisite remediation requires at least one canonical prerequisite skill ID.",
    );
  }
  if (envelope.prerequisiteSkillIds) {
    const prerequisiteIds = new Set<string>();
    for (const prerequisiteSkillId of envelope.prerequisiteSkillIds) {
      assertNonEmpty(prerequisiteSkillId, "prerequisiteSkillIds[]");
      if (prerequisiteIds.has(prerequisiteSkillId)) {
        throw new ReviewRuntimeError(
          "invalid-input",
          "Canonical prerequisite skill IDs must be unique.",
        );
      }
      prerequisiteIds.add(prerequisiteSkillId);
    }
  }
}

function assertCurrentReviewIdentity(
  review: StudentSkillReview,
  envelope: EngineRecommendationEnvelope,
): void {
  if (
    review.kind !== "student-skill-review" ||
    review.schemaVersion !== STUDY_ENGINE_SCHEMA_VERSION
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Current review does not use the canonical StudentSkillReview v1 header.",
    );
  }
  assertIntegerAtLeast(review.revision, 1, "currentReview.revision");
  const createdAt = assertInstant(
    review.createdAt,
    "currentReview.createdAt",
  );
  const updatedAt = assertInstant(
    review.updatedAt,
    "currentReview.updatedAt",
  );
  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Current review updatedAt cannot predate createdAt.",
    );
  }
  assertIanaTimeZone(review.timeZone);
  calendarDate(review.nextReviewDate);
  const expectedInterval = reviewInterval(review.currentInterval.days);
  if (expectedInterval.id !== review.currentInterval.id) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Current review interval ID does not match its canonical day count.",
    );
  }
  const attemptIds = new Set<string>();
  const attemptEvidenceIds = new Set<string>();
  for (const attempt of review.retrievalAttempts) {
    assertAttempt(attempt);
    if (
      attemptIds.has(attempt.id) ||
      attemptEvidenceIds.has(attempt.evidenceId)
    ) {
      throw new ReviewRuntimeError(
        "duplicate-entry",
        "Current review contains duplicate retrieval-attempt or evidence identity.",
      );
    }
    attemptIds.add(attempt.id);
    attemptEvidenceIds.add(attempt.evidenceId);
    if (
      localParts(
        assertInstant(attempt.attemptedAt, "attempt.attemptedAt"),
        review.timeZone,
      ).date !== attempt.reviewDate
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Retrieval attempt reviewDate must be its learner-local attempted date.",
      );
    }
  }
  if (
    review.id !== envelope.reviewId ||
    review.studentId !== envelope.studentId ||
    review.subjectId !== envelope.subjectId ||
    review.skillId !== envelope.skillId
  ) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Current canonical review identity does not match the recommendation envelope.",
    );
  }
  if (review.timeZone !== envelope.timeZone) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "A time-zone change requires an explicit canonical review migration.",
    );
  }
}

function priorSourceRecommendationId(
  review: StudentSkillReview,
): string | undefined {
  const value =
    review.metadata?.extensions?.["manuel:last-source-recommendation-id"];
  return typeof value === "string" ? value : undefined;
}

function priorSourceRecommendationDigest(
  review: StudentSkillReview,
): string | undefined {
  const value =
    review.metadata?.extensions?.[
      "manuel:last-source-recommendation-digest"
    ];
  return typeof value === "string" ? value : undefined;
}

function buildCanonicalReview(
  envelope: EngineRecommendationEnvelope,
  currentReview: StudentSkillReview | undefined,
): {
  readonly review: StudentSkillReview;
  readonly action: "created" | "updated" | "idempotent";
} {
  const nextInterval = reviewInterval(envelope.recommendation.intervalDays);
  const envelopeDigest = sourceRecommendationDigest(envelope);
  if (currentReview) {
    assertCurrentReviewIdentity(currentReview, envelope);
    if (
      priorSourceRecommendationId(currentReview) ===
      envelope.sourceRecommendationId
    ) {
      if (
        priorSourceRecommendationDigest(currentReview) !== envelopeDigest
      ) {
        throw new ReviewRuntimeError(
          "identity-conflict",
          "A source recommendation ID was replayed with different canonical payload bytes.",
        );
      }
      if (
        currentReview.nextReviewDate !== envelope.recommendation.dueOn ||
        currentReview.currentInterval.days !== nextInterval.days
      ) {
        throw new ReviewRuntimeError(
          "identity-conflict",
          "A source recommendation ID was reused with different scheduling data.",
        );
      }
      return { review: currentReview, action: "idempotent" };
    }
    if (Date.parse(envelope.generatedAt) < Date.parse(currentReview.updatedAt)) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "A recommendation cannot predate the current canonical revision.",
      );
    }
  }

  const intervalAdjustments = currentReview
    ? [
        ...currentReview.intervalAdjustments,
        {
          adjustedAt: envelope.generatedAt,
          action: adjustmentAction(
            currentReview.currentInterval,
            nextInterval,
          ),
          from: currentReview.currentInterval,
          to: nextInterval,
          basisEvidenceIds: [...envelope.basisEvidenceIds],
        } satisfies IntervalAdjustment,
      ]
    : [];

  const reteachingTrigger: ReteachingTrigger | undefined =
    envelope.recommendation.preparation === "reteach_before_retrieval"
      ? {
          status: "triggered",
          reason: "repeated-retrieval-difficulty",
          basisEvidenceIds: [...envelope.basisEvidenceIds],
        }
      : undefined;
  const prerequisiteRemediationTrigger:
    | PrerequisiteRemediationTrigger
    | undefined =
    envelope.recommendation.preparation ===
    "address_prerequisite_before_retrieval"
      ? {
          status: "triggered",
          reason: "confirmed-prerequisite-gap",
          prerequisiteSkillIds: [
            ...(envelope.prerequisiteSkillIds ?? []),
          ],
          basisEvidenceIds: [...envelope.basisEvidenceIds],
        }
      : undefined;
  const existingTags = currentReview?.metadata?.tags ?? [];
  const tags = existingTags.includes("calendar-parent-runtime")
    ? [...existingTags]
    : [...existingTags, "calendar-parent-runtime"];

  const review: StudentSkillReview = {
    kind: "student-skill-review",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: envelope.reviewId,
    revision: currentReview ? currentReview.revision + 1 : 1,
    createdAt: currentReview?.createdAt ?? envelope.generatedAt,
    updatedAt: envelope.generatedAt,
    metadata: {
      source: "adaptive-engine",
      tags,
      extensions: {
        ...(currentReview?.metadata?.extensions ?? {}),
        "manuel:last-source-recommendation-id":
          envelope.sourceRecommendationId,
        "manuel:last-source-recommendation-digest": envelopeDigest,
        "manuel:last-baseline-index":
          envelope.recommendation.baselineIndex,
      },
    },
    studentId: envelope.studentId,
    subjectId: envelope.subjectId,
    skillId: envelope.skillId,
    timeZone: envelope.timeZone,
    retrievalAttempts: [...(currentReview?.retrievalAttempts ?? [])],
    currentInterval: nextInterval,
    nextReviewDate: envelope.recommendation.dueOn,
    intervalAdjustments,
    ...(reteachingTrigger ? { reteachingTrigger } : {}),
    ...(prerequisiteRemediationTrigger
      ? { prerequisiteRemediationTrigger }
      : {}),
  };
  return {
    review,
    action: currentReview ? "updated" : "created",
  };
}

function assertQueueEntry(entry: ReviewQueueEntry): void {
  if (entry.schemaVersion !== REVIEW_RUNTIME_SCHEMA_VERSION) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Unsupported review queue entry schema version.",
    );
  }
  assertNonEmpty(entry.id, "queue entry id");
  assertNonEmpty(entry.sourceRecommendationId, "sourceRecommendationId");
  if (entry.sourceRecommendationDigest !== undefined) {
    if (
      !/^fnv1a64x2:[0-9a-f]{32}:\d+$/.test(
        entry.sourceRecommendationDigest,
      )
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "sourceRecommendationDigest has an unsupported format.",
      );
    }
  }
  assertNonEmpty(entry.canonicalReviewId, "canonicalReviewId");
  assertNonEmpty(entry.skillId, "skillId");
  assertNonEmpty(entry.title, "title", 120);
  assertInstant(entry.createdAt, "queueEntry.createdAt");
  calendarDate(entry.scheduledDate);
  assertIntegerAtLeast(entry.canonicalReviewRevision, 1, "review revision");
  if (
    !["review", "reteaching", "prerequisite-remediation"].includes(
      entry.workKind,
    ) ||
    !REVIEW_PRIORITIES.includes(entry.priority) ||
    !["pending", "completed"].includes(entry.state)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Queue entry kind, priority, or state is unsupported.",
    );
  }
  assertIntegerAtLeast(entry.estimatedMinutes, 1, "estimatedMinutes");
  if (entry.estimatedMinutes > 180) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "estimatedMinutes cannot exceed 180.",
    );
  }
  if (
    entry.actualDurationSeconds !== null &&
    (!Number.isSafeInteger(entry.actualDurationSeconds) ||
      entry.actualDurationSeconds < 0)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "actualDurationSeconds must be null or a non-negative safe integer.",
    );
  }
  if (
    (entry.state === "pending" && entry.actualDurationSeconds !== null) ||
    (entry.state === "completed" && entry.actualDurationSeconds === null)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Pending queue work cannot have actual duration, and completed work must have it.",
    );
  }
  if (entry.retryIntent) {
    const retry = entry.retryIntent;
    assertIanaTimeZone(retry.householdTimeZone);
    if (
      retry.householdTimeZone !== retry.timeZone ||
      retry.notBeforeLocalDate !== retry.localDate ||
      retry.dueByLocalDate !== retry.dueDate ||
      retry.dueByLocalDate !== entry.scheduledDate
    ) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "Retry-window canonical fields and compatibility aliases must agree.",
      );
    }
    calendarDate(retry.notBeforeLocalDate);
    calendarDate(retry.dueByLocalDate);
    if (retry.notBeforeLocalDate > retry.dueByLocalDate) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Retry-window notBeforeLocalDate cannot follow dueByLocalDate.",
      );
    }
    const authorized = retry.status === "authorized-slot-ready";
    if (
      authorized !==
      (retry.resolution === "authorized-slot-may-be-projected") ||
      authorized !== (retry.retryNotBefore !== null) ||
      authorized !== (retry.policyProvenance !== null)
    ) {
      throw new ReviewRuntimeError(
        "invalid-input",
        "Retry-window authorization state is internally inconsistent.",
      );
    }
  }
}

function assertNoQueueDuplicates(
  entries: readonly ReviewQueueEntry[],
): void {
  const ids = new Set<string>();
  const sourceIds = new Set<string>();
  const pendingKeys = new Set<string>();
  for (const entry of entries) {
    assertQueueEntry(entry);
    if (ids.has(entry.id) || sourceIds.has(entry.sourceRecommendationId)) {
      throw new ReviewRuntimeError(
        "duplicate-entry",
        "Queue entries contain a duplicate stable ID or source recommendation ID.",
      );
    }
    ids.add(entry.id);
    sourceIds.add(entry.sourceRecommendationId);
    if (entry.state === "pending") {
      const pendingKey = [
        entry.canonicalReviewId,
        entry.scheduledDate,
        entry.workKind,
      ].join("\u001f");
      if (pendingKeys.has(pendingKey)) {
        throw new ReviewRuntimeError(
          "duplicate-entry",
          "Queue entries contain duplicate pending work for the same canonical review, date, and kind.",
        );
      }
      pendingKeys.add(pendingKey);
    }
  }
}

function queueEntryFor(
  envelope: EngineRecommendationEnvelope,
  review: StudentSkillReview,
): ReviewQueueEntry {
  const retryIntent = createRetryIntent(envelope);
  return {
    schemaVersion: REVIEW_RUNTIME_SCHEMA_VERSION,
    id: envelope.queueEntryId,
    sourceRecommendationId: envelope.sourceRecommendationId,
    sourceRecommendationDigest: sourceRecommendationDigest(envelope),
    canonicalReviewId: review.id,
    canonicalReviewRevision: review.revision,
    skillId: review.skillId,
    title: envelope.title,
    workKind: workKind(envelope.recommendation),
    priority: envelope.authorizedPriority,
    createdAt: envelope.generatedAt,
    scheduledDate: envelope.recommendation.dueOn,
    estimatedMinutes: envelope.estimatedMinutes,
    actualDurationSeconds: null,
    state: "pending",
    retryIntent,
  };
}

function upsertQueueEntry(
  entries: readonly ReviewQueueEntry[],
  candidate: ReviewQueueEntry,
): {
  readonly queueEntries: readonly ReviewQueueEntry[];
  readonly queueEntry: ReviewQueueEntry;
  readonly action: "inserted" | "idempotent";
} {
  assertNoQueueDuplicates(entries);
  assertQueueEntry(candidate);
  const byId = entries.find((entry) => entry.id === candidate.id);
  const bySource = entries.find(
    (entry) =>
      entry.sourceRecommendationId === candidate.sourceRecommendationId,
  );
  if (byId && bySource && byId !== bySource) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Queue entry ID and source recommendation ID resolve to different entries.",
    );
  }
  const existing = byId ?? bySource;
  if (existing) {
    const stablePayloadMatches =
      existing.id === candidate.id &&
      existing.sourceRecommendationId ===
        candidate.sourceRecommendationId &&
      existing.sourceRecommendationDigest ===
        candidate.sourceRecommendationDigest &&
      existing.canonicalReviewId === candidate.canonicalReviewId &&
      existing.canonicalReviewRevision ===
        candidate.canonicalReviewRevision &&
      existing.skillId === candidate.skillId &&
      existing.title === candidate.title &&
      existing.workKind === candidate.workKind &&
      existing.priority === candidate.priority &&
      existing.createdAt === candidate.createdAt &&
      existing.scheduledDate === candidate.scheduledDate &&
      existing.estimatedMinutes === candidate.estimatedMinutes &&
      canonicalJson(existing.retryIntent) ===
        canonicalJson(candidate.retryIntent);
    if (!stablePayloadMatches) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "A stable queue or source recommendation ID was reused with a different payload.",
      );
    }
    return {
      queueEntries: [...entries],
      queueEntry: existing,
      action: "idempotent",
    };
  }
  const semanticDuplicate = entries.find(
    (entry) =>
      entry.state === "pending" &&
      candidate.state === "pending" &&
      entry.canonicalReviewId === candidate.canonicalReviewId &&
      entry.scheduledDate === candidate.scheduledDate &&
      entry.workKind === candidate.workKind,
  );
  if (semanticDuplicate) {
    throw new ReviewRuntimeError(
      "duplicate-entry",
      `Pending review would duplicate queue entry ${semanticDuplicate.id}.`,
    );
  }
  const queueEntries = [...entries, candidate];
  assertNoQueueDuplicates(queueEntries);
  return { queueEntries, queueEntry: candidate, action: "inserted" };
}

export function ingestEngineRecommendation(
  input: IngestEngineRecommendationInput,
): IngestEngineRecommendationResult {
  assertEnvelope(input.envelope);
  assertNoQueueDuplicates(input.queueEntries);
  const byQueueId = input.queueEntries.find(
    (entry) => entry.id === input.envelope.queueEntryId,
  );
  const bySourceId = input.queueEntries.find(
    (entry) =>
      entry.sourceRecommendationId ===
      input.envelope.sourceRecommendationId,
  );
  if (byQueueId || bySourceId) {
    if (!byQueueId || !bySourceId || byQueueId !== bySourceId) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "Queue entry ID and source recommendation ID must resolve to the same occurrence.",
      );
    }
    const digest = sourceRecommendationDigest(input.envelope);
    if (byQueueId.sourceRecommendationDigest !== digest) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "A queue/source recommendation identity was replayed with different canonical payload bytes.",
      );
    }
    if (!input.currentReview) {
      throw new ReviewRuntimeError(
        "missing-entry",
        "An idempotent queue replay requires the current canonical review.",
      );
    }
    assertCurrentReviewIdentity(input.currentReview, input.envelope);
    const retryIntent = byQueueId.retryIntent;
    return {
      canonicalReview: input.currentReview,
      queueEntry: byQueueId,
      queueEntries: [...input.queueEntries],
      canonicalAction: "idempotent",
      queueAction: "idempotent",
      trace: trace([
        {
          code: "recommendation-received",
          detail: `Accepted source recommendation ${input.envelope.sourceRecommendationId}.`,
        },
        {
          code: "canonical-review-idempotent",
          detail: `Canonical review ${input.currentReview.id} remains revision ${input.currentReview.revision}.`,
        },
        {
          code: "queue-entry-idempotent",
          detail: `Queue entry ${byQueueId.id} is idempotent.`,
        },
        retryIntent
          ? {
              code: "same-day-retry-window-created",
              detail: `Retry intent for ${retryIntent.localDate} is ${retryIntent.status}.`,
            }
          : {
              code: "future-review-date-preserved",
              detail: `Future review date ${byQueueId.scheduledDate} was preserved.`,
            },
      ]),
    };
  }
  const canonical = buildCanonicalReview(
    input.envelope,
    input.currentReview,
  );
  const candidate = queueEntryFor(input.envelope, canonical.review);
  const queue = upsertQueueEntry(input.queueEntries, candidate);
  const retryIntent = candidate.retryIntent;
  const codes: {
    code: ReviewTraceCode;
    detail: string;
  }[] = [
    {
      code: "recommendation-received",
      detail: `Accepted source recommendation ${input.envelope.sourceRecommendationId}.`,
    },
    {
      code:
        canonical.action === "created"
          ? "canonical-review-created"
          : canonical.action === "updated"
            ? "canonical-review-updated"
            : "canonical-review-idempotent",
      detail: `Canonical review ${canonical.review.id} is revision ${canonical.review.revision}.`,
    },
    {
      code:
        queue.action === "inserted"
          ? "queue-entry-inserted"
          : "queue-entry-idempotent",
      detail: `Queue entry ${queue.queueEntry.id} is ${queue.action}.`,
    },
    retryIntent
      ? {
          code: "same-day-retry-window-created",
          detail: `Retry intent for ${retryIntent.localDate} is ${retryIntent.status}.`,
        }
      : {
          code: "future-review-date-preserved",
          detail: `Future review date ${candidate.scheduledDate} was preserved.`,
        },
  ];
  return {
    canonicalReview: canonical.review,
    queueEntry: queue.queueEntry,
    queueEntries: queue.queueEntries,
    canonicalAction: canonical.action,
    queueAction: queue.action,
    trace: trace(codes),
  };
}

function compareQueueEntries(
  left: ReviewQueueEntry,
  right: ReviewQueueEntry,
): number {
  return (
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
    left.scheduledDate.localeCompare(right.scheduledDate) ||
    left.id.localeCompare(right.id)
  );
}

function timingFor(
  scheduledDate: string,
  planningDate: string,
): ReviewTiming {
  return scheduledDate < planningDate ? "overdue" : "same-day";
}

export function buildDailyReviewPlan(
  input: BuildDailyReviewPlanInput,
): DailyReviewPlan {
  calendarDate(input.planningDate);
  assertIntegerAtLeast(
    input.totalAvailableMinutes,
    0,
    "totalAvailableMinutes",
  );
  assertIntegerAtLeast(
    input.requiredInstructionMinutes,
    0,
    "requiredInstructionMinutes",
  );
  assertIntegerAtLeast(input.limits.maxItems, 0, "limits.maxItems");
  assertIntegerAtLeast(input.limits.maxMinutes, 0, "limits.maxMinutes");
  assertNoQueueDuplicates(input.queueEntries);

  const instructionRemainder = Math.max(
    0,
    input.totalAvailableMinutes - input.requiredInstructionMinutes,
  );
  const reviewMinuteBudget = Math.min(
    input.limits.maxMinutes,
    instructionRemainder,
  );
  const pending = input.queueEntries.filter(
    (entry) => entry.state === "pending",
  );
  const due = pending
    .filter((entry) => entry.scheduledDate <= input.planningDate)
    .sort(compareQueueEntries);
  const upcoming = pending
    .filter((entry) => entry.scheduledDate > input.planningDate)
    .sort(
      (left, right) =>
        left.scheduledDate.localeCompare(right.scheduledDate) ||
        compareQueueEntries(left, right),
    );
  const completedExcludedEntryIds = input.queueEntries
    .filter((entry) => entry.state === "completed")
    .map((entry) => entry.id)
    .sort((left, right) => left.localeCompare(right));

  const scheduled: PlannedReview[] = [];
  const held: HeldReview[] = [];
  const traceCodes: {
    code: ReviewTraceCode;
    detail: string;
  }[] = [
    {
      code: "required-instruction-reserved",
      detail: `Reserved ${input.requiredInstructionMinutes} of ${input.totalAvailableMinutes} available minutes; review budget is ${reviewMinuteBudget}.`,
    },
  ];
  let scheduledReviewMinutes = 0;
  let firstMinuteBlockedId: string | null = null;

  for (const entry of due) {
    const timing = timingFor(entry.scheduledDate, input.planningDate);
    if (entry.retryIntent?.status !== undefined &&
        entry.retryIntent.status !== "authorized-slot-ready") {
      const retryStatus = entry.retryIntent.status;
      const reason: HeldReviewReason =
        retryStatus === "daily-limit-reached"
          ? "same-day-attempt-limit"
          : retryStatus === "awaiting-preparation"
            ? "same-day-preparation-required"
            : retryStatus === "awaiting-break-or-session-boundary"
              ? "same-day-boundary-required"
              : "same-day-manual-review";
      const code: ReviewTraceCode =
        retryStatus === "daily-limit-reached"
          ? "review-held-same-day-attempt-limit"
          : retryStatus === "awaiting-preparation"
            ? "review-held-same-day-preparation"
            : retryStatus === "awaiting-break-or-session-boundary"
              ? "review-held-same-day-boundary"
              : "review-held-same-day-manual-review";
      held.push({
        entry,
        timing,
        reason,
        heldBehindEntryId: null,
      });
      traceCodes.push({
        code,
        detail: `Held ${entry.id}; same-day retry status is ${retryStatus}.`,
      });
      continue;
    }
    if (scheduled.length >= input.limits.maxItems) {
      held.push({
        entry,
        timing,
        reason: "daily-item-limit",
        heldBehindEntryId: null,
      });
      traceCodes.push({
        code: "review-held-item-limit",
        detail: `Held ${entry.id} at the daily item limit.`,
      });
      continue;
    }
    if (firstMinuteBlockedId) {
      held.push({
        entry,
        timing,
        reason: "priority-preserved",
        heldBehindEntryId: firstMinuteBlockedId,
      });
      traceCodes.push({
        code: "review-held-priority-preserved",
        detail: `Held ${entry.id} behind ${firstMinuteBlockedId}.`,
      });
      continue;
    }
    if (
      scheduledReviewMinutes + entry.estimatedMinutes >
      reviewMinuteBudget
    ) {
      firstMinuteBlockedId = entry.id;
      const instructionReservationIsBinding =
        instructionRemainder < input.limits.maxMinutes;
      const reason: HeldReviewReason = instructionReservationIsBinding
        ? "required-instruction-reserved"
        : "daily-minute-limit";
      held.push({
        entry,
        timing,
        reason,
        heldBehindEntryId: null,
      });
      traceCodes.push({
        code: instructionReservationIsBinding
          ? "review-held-required-instruction"
          : "review-held-minute-limit",
        detail: instructionReservationIsBinding
          ? `Held ${entry.id} because reserving required instruction leaves a ${reviewMinuteBudget}-minute review budget.`
          : `Held ${entry.id} because it would exceed the ${reviewMinuteBudget}-minute daily review limit.`,
      });
      continue;
    }
    scheduledReviewMinutes += entry.estimatedMinutes;
    scheduled.push({
      entry,
      timing,
      queuePosition: scheduled.length + 1,
    });
    traceCodes.push({
      code: "review-scheduled",
      detail: `Scheduled ${entry.id} at queue position ${scheduled.length}.`,
    });
  }

  traceCodes.push({
    code: "daily-plan-complete",
    detail: `Scheduled ${scheduled.length} reviews (${scheduledReviewMinutes} minutes) and held ${held.length}.`,
  });

  return {
    planningDate: input.planningDate,
    requiredInstructionMinutes: input.requiredInstructionMinutes,
    totalAvailableMinutes: input.totalAvailableMinutes,
    reviewMinuteBudget,
    scheduled,
    held,
    upcoming,
    completedExcludedEntryIds,
    scheduledReviewMinutes,
    overloadAvoided: held.some(({ reason }) =>
      [
        "required-instruction-reserved",
        "daily-item-limit",
        "daily-minute-limit",
        "priority-preserved",
      ].includes(reason),
    ),
    trace: trace(traceCodes),
  };
}

function assertAttempt(attempt: RetrievalAttempt): void {
  assertNonEmpty(attempt.id, "attempt.id");
  assertInstant(attempt.attemptedAt, "attempt.attemptedAt");
  calendarDate(attempt.reviewDate);
  assertIntegerAtLeast(attempt.correctCount, 0, "attempt.correctCount");
  assertIntegerAtLeast(attempt.attemptedCount, 1, "attempt.attemptedCount");
  assertIntegerAtLeast(attempt.hintCount, 0, "attempt.hintCount");
  if (
    ![
      "independent",
      "minimal-support",
      "guided",
      "full-support",
    ].includes(attempt.independence)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "attempt.independence is unsupported.",
    );
  }
  if (attempt.correctCount > attempt.attemptedCount) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "attempt.correctCount cannot exceed attemptedCount.",
    );
  }
  assertNonEmpty(attempt.evidenceId, "attempt.evidenceId");
}

function appendAttempt(
  review: StudentSkillReview,
  attempt: RetrievalAttempt,
): {
  readonly review: StudentSkillReview;
  readonly action: "recorded" | "idempotent";
} {
  assertAttempt(attempt);
  const existing = review.retrievalAttempts.find(
    (candidate) => candidate.id === attempt.id,
  );
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(attempt)) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "A retrieval attempt ID was reused with different evidence.",
      );
    }
    return { review, action: "idempotent" };
  }
  if (
    review.retrievalAttempts.some(
      (candidate) => candidate.evidenceId === attempt.evidenceId,
    )
  ) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Retrieval evidence ID is already linked to a different attempt.",
    );
  }
  return {
    review: {
      ...review,
      retrievalAttempts: [...review.retrievalAttempts, attempt],
    },
    action: "recorded",
  };
}

function evidenceFor(
  attempt: RetrievalAttempt,
  signals: EngineFeedbackSignals,
): RetrievalEvidence {
  assertProportionOrNull(signals.confidence, "feedbackSignals.confidence");
  assertIntegerAtLeast(
    signals.consecutiveSuccessfulRetrievals,
    0,
    "feedbackSignals.consecutiveSuccessfulRetrievals",
  );
  return {
    retrievalAccuracy: attempt.correctCount / attempt.attemptedCount,
    independence: INDEPENDENCE_SCORE[attempt.independence],
    confidence: signals.confidence,
    consecutiveSuccessfulRetrievals:
      signals.consecutiveSuccessfulRetrievals,
    retrievalFailed: signals.retrievalFailed,
    prerequisiteGap: signals.prerequisiteGap,
    reteachingOutcome: signals.reteachingOutcome,
  };
}

function assertResultReturnCommand(
  command: ReviewResultReturnCommand,
): void {
  if (
    command.kind !== "review-result-return-command" ||
    command.schemaVersion !== REVIEW_RESULT_RETURN_COMMAND_VERSION
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Unsupported review result-return command version.",
    );
  }
  assertNonEmpty(command.commandId, "resultReturn.commandId");
  assertNonEmpty(command.idempotencyKey, "resultReturn.idempotencyKey");
  assertIntegerAtLeast(
    command.expectedReviewRevision,
    1,
    "resultReturn.expectedReviewRevision",
  );
  assertNonEmpty(command.canonicalReviewId, "resultReturn.canonicalReviewId");
  assertNonEmpty(
    command.completedQueueEntryId,
    "resultReturn.completedQueueEntryId",
  );
  assertNonEmpty(command.canonicalResultId, "resultReturn.canonicalResultId");
  assertNonEmpty(command.sessionId, "resultReturn.sessionId");
  assertNonEmpty(
    command.retrievalAttemptId,
    "resultReturn.retrievalAttemptId",
  );
  assertNonEmpty(command.evidenceId, "resultReturn.evidenceId");
  calendarDate(command.reviewedOn);
  assertInstant(command.recordedAt, "resultReturn.recordedAt");
  assertProportionOrNull(
    command.engineEvidence.retrievalAccuracy,
    "resultReturn.engineEvidence.retrievalAccuracy",
  );
  assertProportionOrNull(
    command.engineEvidence.independence,
    "resultReturn.engineEvidence.independence",
  );
  assertProportionOrNull(
    command.engineEvidence.confidence,
    "resultReturn.engineEvidence.confidence",
  );
  assertIntegerAtLeast(
    command.engineEvidence.consecutiveSuccessfulRetrievals,
    0,
    "resultReturn.engineEvidence.consecutiveSuccessfulRetrievals",
  );
  if (
    typeof command.engineEvidence.retrievalFailed !== "boolean" ||
    typeof command.engineEvidence.prerequisiteGap !== "boolean" ||
    ![
      "not_needed",
      "successful",
      "partial",
      "unsuccessful",
      "not_observed",
    ].includes(command.engineEvidence.reteachingOutcome)
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Result-return engine evidence vocabulary is unsupported.",
    );
  }
}

function assertResultReturnOutboxValue(
  value: ReviewResultReturnOutboxValue,
): void {
  if (
    value.kind !== "review-result-return-outbox" ||
    value.schemaVersion !== REVIEW_RESULT_RETURN_OUTBOX_VERSION ||
    value.state !== "pending"
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Unsupported review result-return outbox value.",
    );
  }
  assertNonEmpty(value.outboxId, "resultReturn.outboxId");
  assertNonEmpty(value.idempotencyKey, "resultReturn.idempotencyKey");
  assertInstant(value.enqueuedAt, "resultReturn.enqueuedAt");
  assertResultReturnCommand(value.command);
  if (value.idempotencyKey !== value.command.idempotencyKey) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Outbox and command idempotency keys must match.",
    );
  }
}

export function enqueueReviewResultReturn(
  currentOutbox: readonly ReviewResultReturnOutboxValue[],
  candidate: ReviewResultReturnOutboxValue,
): {
  readonly outbox: readonly ReviewResultReturnOutboxValue[];
  readonly value: ReviewResultReturnOutboxValue;
  readonly action: "enqueued" | "idempotent";
} {
  assertResultReturnOutboxValue(candidate);
  const outboxIds = new Set<string>();
  const commandIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  const resultIds = new Set<string>();
  const attemptKeys = new Set<string>();
  const occurrenceKeys = new Set<string>();
  for (const value of currentOutbox) {
    assertResultReturnOutboxValue(value);
    const attemptKey = `${value.command.canonicalReviewId}\u001f${value.command.retrievalAttemptId}`;
    const occurrenceKey = `${value.command.canonicalReviewId}\u001f${value.command.completedQueueEntryId}`;
    if (
      outboxIds.has(value.outboxId) ||
      commandIds.has(value.command.commandId) ||
      idempotencyKeys.has(value.idempotencyKey) ||
      resultIds.has(value.command.canonicalResultId) ||
      attemptKeys.has(attemptKey) ||
      occurrenceKeys.has(occurrenceKey)
    ) {
      throw new ReviewRuntimeError(
        "duplicate-entry",
        "Result-return outbox contains duplicate stable identities.",
      );
    }
    outboxIds.add(value.outboxId);
    commandIds.add(value.command.commandId);
    idempotencyKeys.add(value.idempotencyKey);
    resultIds.add(value.command.canonicalResultId);
    attemptKeys.add(attemptKey);
    occurrenceKeys.add(occurrenceKey);
  }
  const byKey = currentOutbox.find(
    (value) => value.idempotencyKey === candidate.idempotencyKey,
  );
  const byOutboxId = currentOutbox.find(
    (value) => value.outboxId === candidate.outboxId,
  );
  const byCommandId = currentOutbox.find(
    (value) => value.command.commandId === candidate.command.commandId,
  );
  const byResultId = currentOutbox.find(
    (value) =>
      value.command.canonicalResultId ===
      candidate.command.canonicalResultId,
  );
  const byAttempt = currentOutbox.find(
    (value) =>
      value.command.canonicalReviewId ===
        candidate.command.canonicalReviewId &&
      value.command.retrievalAttemptId ===
        candidate.command.retrievalAttemptId,
  );
  const byOccurrence = currentOutbox.find(
    (value) =>
      value.command.canonicalReviewId ===
        candidate.command.canonicalReviewId &&
      value.command.completedQueueEntryId ===
        candidate.command.completedQueueEntryId,
  );
  const matches = [
    byKey,
    byOutboxId,
    byCommandId,
    byResultId,
    byAttempt,
    byOccurrence,
  ].filter(
    (value): value is ReviewResultReturnOutboxValue => Boolean(value),
  );
  if (matches.length > 0) {
    const existing = matches[0]!;
    if (
      matches.some((value) => value !== existing) ||
      canonicalJson(existing) !== canonicalJson(candidate)
    ) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "A result-return stable identity was replayed with different canonical bytes.",
      );
    }
    return {
      outbox: [...currentOutbox],
      value: existing,
      action: "idempotent",
    };
  }
  return {
    outbox: [...currentOutbox, candidate],
    value: candidate,
    action: "enqueued",
  };
}

function assertResultCoherence(
  result: SessionResult,
  attempt: RetrievalAttempt,
  signals: EngineFeedbackSignals,
): void {
  assertNonEmpty(result.id, "result.id");
  assertNonEmpty(result.sessionId, "result.sessionId");
  const recordedAt = assertInstant(result.recordedAt, "result.recordedAt");
  const attemptedAt = assertInstant(attempt.attemptedAt, "attempt.attemptedAt");
  if (recordedAt.getTime() < attemptedAt.getTime()) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Canonical result cannot predate its retrieval attempt.",
    );
  }
  if (!["completed", "partially-completed", "abandoned"].includes(result.outcome)) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Canonical result outcome is unsupported.",
    );
  }
  assertIntegerAtLeast(
    result.activeDurationSeconds,
    0,
    "result.activeDurationSeconds",
  );
  assertIntegerAtLeast(
    result.breakDurationSeconds,
    0,
    "result.breakDurationSeconds",
  );
  assertIntegerAtLeast(
    result.pausedDurationSeconds,
    0,
    "result.pausedDurationSeconds",
  );
  const completedSegments = new Set<string>();
  for (const segmentId of result.completedSegmentIds) {
    assertNonEmpty(segmentId, "result.completedSegmentIds[]");
    if (completedSegments.has(segmentId)) {
      throw new ReviewRuntimeError(
        "duplicate-entry",
        "Canonical result contains a duplicate completed segment ID.",
      );
    }
    completedSegments.add(segmentId);
  }
  const remainingSegments = new Set<string>();
  for (const segmentId of result.remainingSegmentIds) {
    assertNonEmpty(segmentId, "result.remainingSegmentIds[]");
    if (
      remainingSegments.has(segmentId) ||
      completedSegments.has(segmentId)
    ) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "Canonical result segment identities must be unique and disjoint.",
      );
    }
    remainingSegments.add(segmentId);
  }
  const evidenceIds = new Set<string>();
  for (const evidenceId of result.evidenceIds) {
    assertNonEmpty(evidenceId, "result.evidenceIds[]");
    if (evidenceIds.has(evidenceId)) {
      throw new ReviewRuntimeError(
        "duplicate-entry",
        "Canonical result evidence IDs must be unique.",
      );
    }
    evidenceIds.add(evidenceId);
  }
  if (!result.evidenceIds.includes(attempt.evidenceId)) {
    throw new ReviewRuntimeError(
      "result-evidence-mismatch",
      "Canonical result must reference the retrieval attempt evidence ID.",
    );
  }
  const expectedAction: SessionResult["recommendedNextAction"] =
    signals.prerequisiteGap
      ? "prerequisite-remediation"
      : signals.retrievalFailed ||
          signals.reteachingOutcome === "partial" ||
          signals.reteachingOutcome === "unsuccessful"
        ? "reteach"
        : "review";
  if (result.recommendedNextAction !== expectedAction) {
    throw new ReviewRuntimeError(
      "result-action-mismatch",
      `Canonical result action ${result.recommendedNextAction} conflicts with the authoritative ${expectedAction} outcome.`,
    );
  }
}

function completeQueueEntry(
  entries: readonly ReviewQueueEntry[],
  entryId: string,
  reviewId: ReviewId,
  expectedReviewRevision: number,
  actualDurationSeconds: number,
): {
  readonly entries: readonly ReviewQueueEntry[];
  readonly completed: ReviewQueueEntry;
} {
  assertNoQueueDuplicates(entries);
  const existing = entries.find((entry) => entry.id === entryId);
  if (!existing) {
    throw new ReviewRuntimeError(
      "missing-entry",
      `Queue entry ${entryId} was not found.`,
    );
  }
  if (existing.canonicalReviewId !== reviewId) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Completed queue entry does not reference the supplied canonical review.",
    );
  }
  if (existing.canonicalReviewRevision !== expectedReviewRevision) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Completed queue occurrence does not reference the expected canonical review revision.",
    );
  }
  if (existing.state === "completed") {
    if (existing.actualDurationSeconds !== actualDurationSeconds) {
      throw new ReviewRuntimeError(
        "identity-conflict",
        "A completed queue occurrence cannot be replayed with a different actual duration.",
      );
    }
    return { entries: [...entries], completed: existing };
  }
  const completed: ReviewQueueEntry = {
    ...existing,
    state: "completed",
    actualDurationSeconds,
  };
  return {
    entries: entries.map((entry) => (entry.id === entryId ? completed : entry)),
    completed,
  };
}

export function applyCanonicalReviewResult(
  input: ApplyCanonicalReviewResultInput,
): CanonicalReviewResultFeedback {
  if (
    input.canonicalReview.kind !== "student-skill-review" ||
    input.canonicalReview.schemaVersion !== STUDY_ENGINE_SCHEMA_VERSION
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Result feedback requires a canonical StudentSkillReview v1.",
    );
  }
  assertIntegerAtLeast(
    input.canonicalReview.revision,
    1,
    "canonicalReview.revision",
  );
  assertIanaTimeZone(input.canonicalReview.timeZone);
  assertAttempt(input.attempt);
  if (
    localParts(
      assertInstant(input.attempt.attemptedAt, "attempt.attemptedAt"),
      input.canonicalReview.timeZone,
    ).date !== input.attempt.reviewDate
  ) {
    throw new ReviewRuntimeError(
      "invalid-input",
      "Retrieval attempt reviewDate must be its learner-local attempted date.",
    );
  }
  assertResultCoherence(
    input.result,
    input.attempt,
    input.feedbackSignals,
  );
  const completed = completeQueueEntry(
    input.queueEntries,
    input.completedQueueEntryId,
    input.canonicalReview.id,
    input.resultReturn.expectedReviewRevision,
    input.result.activeDurationSeconds,
  );
  const attempted = appendAttempt(input.canonicalReview, input.attempt);
  const engineEvidence = evidenceFor(
    input.attempt,
    input.feedbackSignals,
  );
  assertNonEmpty(input.resultReturn.commandId, "resultReturn.commandId");
  assertNonEmpty(input.resultReturn.outboxId, "resultReturn.outboxId");
  assertNonEmpty(
    input.resultReturn.idempotencyKey,
    "resultReturn.idempotencyKey",
  );
  const resultReturnCommand: ReviewResultReturnCommand = {
    kind: "review-result-return-command",
    schemaVersion: REVIEW_RESULT_RETURN_COMMAND_VERSION,
    commandId: input.resultReturn.commandId,
    idempotencyKey: input.resultReturn.idempotencyKey,
    expectedReviewRevision: input.resultReturn.expectedReviewRevision,
    canonicalReviewId: input.canonicalReview.id,
    completedQueueEntryId: input.completedQueueEntryId,
    canonicalResultId: input.result.id,
    sessionId: input.result.sessionId,
    retrievalAttemptId: input.attempt.id,
    evidenceId: input.attempt.evidenceId,
    reviewedOn: input.attempt.reviewDate,
    recordedAt: input.result.recordedAt,
    engineEvidence,
  };
  const exactCommandReplay = input.resultReturn.currentOutbox.some(
    ({ command }) =>
      canonicalJson(command) === canonicalJson(resultReturnCommand),
  );
  if (
    input.resultReturn.expectedReviewRevision !==
      input.canonicalReview.revision &&
    !exactCommandReplay
  ) {
    throw new ReviewRuntimeError(
      "identity-conflict",
      "Result-return expected review revision does not match the canonical review.",
    );
  }
  const resultReturn = enqueueReviewResultReturn(
    input.resultReturn.currentOutbox,
    {
      kind: "review-result-return-outbox",
      schemaVersion: REVIEW_RESULT_RETURN_OUTBOX_VERSION,
      outboxId: input.resultReturn.outboxId,
      idempotencyKey: input.resultReturn.idempotencyKey,
      state: "pending",
      enqueuedAt: input.result.recordedAt,
      command: resultReturnCommand,
    },
  );
  const engineRecommendation = scheduleNextReview({
    reviewedOn: input.attempt.reviewDate,
    state: input.progressState,
    evidence: engineEvidence,
    ...(input.schedulerConfig
      ? { config: input.schedulerConfig }
      : {}),
  });
  const ingested = ingestEngineRecommendation({
    currentReview: attempted.review,
    queueEntries: completed.entries,
    envelope: {
      queueEntryId: input.nextQueueEntryId,
      sourceRecommendationId: input.nextSourceRecommendationId,
      reviewId: input.canonicalReview.id,
      studentId: input.canonicalReview.studentId,
      subjectId: input.canonicalReview.subjectId,
      skillId: input.canonicalReview.skillId,
      title: input.title,
      timeZone: input.canonicalReview.timeZone,
      generatedAt: input.result.recordedAt,
      recommendation: engineRecommendation,
      authorizedPriority: input.authorizedPriority,
      estimatedMinutes: input.estimatedMinutes,
      basisEvidenceIds: [input.attempt.evidenceId],
      ...(input.prerequisiteSkillIds
        ? { prerequisiteSkillIds: input.prerequisiteSkillIds }
        : {}),
      sameDayPolicy: input.sameDayPolicy,
    },
  });

  const initialTrace: readonly Omit<ReviewRuntimeTrace, "sequence">[] = [
    {
      code: "canonical-result-accepted",
      detail: `Accepted canonical result ${input.result.id}.`,
    },
    {
      code:
        attempted.action === "recorded"
          ? "retrieval-attempt-recorded"
          : "retrieval-attempt-idempotent",
      detail: `Retrieval attempt ${input.attempt.id} is ${attempted.action}.`,
    },
    {
      code: "completed-queue-entry-updated",
      detail: `Completed ${completed.completed.id} with actual duration ${input.result.activeDurationSeconds} seconds.`,
    },
    {
      code: "engine-recommendation-produced",
      detail: `Engine returned ${engineRecommendation.preparation} due ${engineRecommendation.dueOn}.`,
    },
    {
      code:
        resultReturn.action === "enqueued"
          ? "result-return-command-enqueued"
          : "result-return-command-idempotent",
      detail: `Result-return command ${resultReturnCommand.commandId} is ${resultReturn.action}.`,
    },
  ];

  return {
    acknowledgedResultId: input.result.id,
    engineEvidence,
    engineRecommendation,
    progressState: engineRecommendation.nextState,
    canonicalReview: ingested.canonicalReview,
    completedQueueEntry: completed.completed,
    nextQueueEntry: ingested.queueEntry,
    queueEntries: ingested.queueEntries,
    resultReturnCommand,
    resultReturnOutboxValue: resultReturn.value,
    resultReturnOutbox: resultReturn.outbox,
    resultReturnAction: resultReturn.action,
    trace: resequence([
      ...initialTrace,
      ...traceWithoutSequence(ingested.trace),
    ]),
  };
}

/** Exposed for deterministic DEC-009 adapter conformance tests. */
export function card8IndependenceScore(
  independence: RetrievalAttempt["independence"],
): number {
  return INDEPENDENCE_SCORE[independence];
}

export type {
  EvidenceId,
  RetrievalAttempt,
  RetrievalAttemptId,
  ReviewId,
  SessionId,
  SessionResult,
  SkillId,
  StudentId,
  StudentSkillReview,
  SubjectId,
};
