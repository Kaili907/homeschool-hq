import type {
  EvidenceId,
  RetrievalAttemptId,
  ReviewId,
  SessionId,
  SessionResultId,
  SkillId,
  StudyPlanId,
  StudentId,
  SubjectId,
} from "../../contracts/common.js";
import type { RetrievalAttempt } from "../../contracts/review-scheduling.js";
import type { SessionResult } from "../../contracts/study-session.js";
import {
  calendarDate,
  scheduleNextReview,
} from "../../engine/review/index.js";
import {
  calendarBlockView,
  completeCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  interruptCalendarBlock,
  startCalendarBlock,
} from "./calendar-runtime.js";
import {
  applyParentControlAction,
  createParentRuntimeState,
  type ParentControlAction,
} from "./parent-runtime.js";
import { projectParentRecommendation } from "./privacy.js";
import {
  ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  normalizeRomeoAssignment,
  projectRomeoAssignmentForPublic,
  projectRomeoAssignmentToCalendar,
  updateRomeoAssignment,
} from "./romeo-runtime.js";
import {
  applyCanonicalReviewResult,
  buildDailyReviewPlan,
  ingestEngineRecommendation,
  type ReviewQueueEntry,
} from "./review-runtime.js";

export type RuntimeScenarioId =
  | "retrieval-failure"
  | "successful-review"
  | "partial-resume"
  | "parent-rejects"
  | "accommodation"
  | "romeo";

export interface RuntimeMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface RuntimeFlowStep {
  readonly label: string;
  readonly value: string;
}

export interface RuntimeCalendarItem {
  readonly id: string;
  readonly localTime: string;
  readonly title: string;
  readonly detail: string;
  readonly duration: string;
  readonly state: string;
  readonly requiredWorkPercent: number;
  readonly tone: "instruction" | "review" | "external" | "partial";
}

export interface RuntimeEvidenceItem {
  readonly marker: string;
  readonly title: string;
  readonly detail: string;
}

export interface RuntimeControlItem {
  readonly label: string;
  readonly detail: string;
  readonly status: "effective" | "history";
}

export interface RuntimeTraceItem {
  readonly label: string;
  readonly title: string;
  readonly id: string;
}

export interface RuntimeScenario {
  readonly id: RuntimeScenarioId;
  readonly shortLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly dateLabel: string;
  readonly timeZone: string;
  readonly metrics: readonly RuntimeMetric[];
  readonly flow: readonly RuntimeFlowStep[];
  readonly calendar: readonly RuntimeCalendarItem[];
  readonly evidence: readonly RuntimeEvidenceItem[];
  readonly controls: readonly RuntimeControlItem[];
  readonly traces: readonly RuntimeTraceItem[];
}

const HOUSEHOLD_ZONE = "America/New_York";
const LEARNER_REF = "learner:runtime-lab-07";
const PARENT = {
  role: "parent",
  actorId: "adult:runtime-lab-parent",
} as const;

function branded<Id extends string>(value: string): Id {
  return value as Id;
}

const failureRecommendation = scheduleNextReview({
  reviewedOn: calendarDate("2026-07-28"),
  state: { lastBaselineIndex: 1 },
  evidence: {
    retrievalAccuracy: 0.25,
    independence: 0.35,
    confidence: null,
    consecutiveSuccessfulRetrievals: 0,
    retrievalFailed: true,
    prerequisiteGap: false,
    reteachingOutcome: "successful",
  },
});

const failureIngest = ingestEngineRecommendation({
  envelope: {
    queueEntryId: "queue:review-fractions:attempt-02",
    sourceRecommendationId: "engine-rec:fractions:0002",
    reviewId: branded<ReviewId>("review:fractions-equivalence"),
    studentId: branded<StudentId>(LEARNER_REF),
    subjectId: branded<SubjectId>("subject:math"),
    skillId: branded<SkillId>("skill:equivalent-fractions"),
    title: "Equivalent fractions retrieval",
    timeZone: HOUSEHOLD_ZONE,
    generatedAt: "2026-07-28T09:12:00-04:00",
    recommendation: failureRecommendation,
    authorizedPriority: "urgent",
    estimatedMinutes: 10,
    basisEvidenceIds: [
      branded<EvidenceId>("evidence:retrieval-fractions-02"),
    ],
    sameDayPolicy: {
      attemptOrdinal: 2,
      dailyAttemptLimit: 3,
      requiredSupportBoundaryRef:
        "boundary:fractions-reteaching-session",
      completedPreparation: {
        kind: "reteaching-completed",
        completedAt: "2026-07-28T10:23:00-04:00",
        evidenceRefs: ["evidence:fractions-reteaching-completed"],
      },
      completedSupportBoundary: {
        ref: "boundary:fractions-reteaching-session",
        kind: "session-ended",
        completedAt: "2026-07-28T10:25:00-04:00",
      },
      authorizedWindow: {
        provenance: {
          policyId: "policy:household-same-day-review-v1",
          policyVersion: 1,
          source: "adult-scheduled-slot",
          authorizationRef: "authorization:parent-fractions-retry",
          authorizedByRole: "parent",
          authorizedAt: "2026-07-28T09:14:00-04:00",
        },
        householdTimeZone: HOUSEHOLD_ZONE,
        localDate: "2026-07-28",
        retryNotBefore: "2026-07-28T10:30:00-04:00",
        latestLocalTime: "16:30",
      },
    },
  },
  queueEntries: [],
});

function queueVariant(
  base: ReviewQueueEntry,
  input: {
    readonly id: string;
    readonly reviewId: string;
    readonly recommendationId: string;
    readonly title: string;
    readonly priority: ReviewQueueEntry["priority"];
    readonly scheduledDate: string;
    readonly estimatedMinutes: number;
  },
): ReviewQueueEntry {
  return {
    ...base,
    id: input.id,
    canonicalReviewId: branded<ReviewId>(input.reviewId),
    sourceRecommendationId: input.recommendationId,
    title: input.title,
    priority: input.priority,
    scheduledDate: input.scheduledDate,
    estimatedMinutes: input.estimatedMinutes,
    retryIntent: null,
  };
}

const overloadQueue = [
  failureIngest.queueEntry,
  queueVariant(failureIngest.queueEntry, {
    id: "queue:review-prerequisite:attempt-01",
    reviewId: "review:fraction-prerequisite",
    recommendationId: "engine-rec:fraction-prerequisite:0001",
    title: "Fraction model prerequisite",
    priority: "high",
    scheduledDate: "2026-07-28",
    estimatedMinutes: 8,
  }),
  queueVariant(failureIngest.queueEntry, {
    id: "queue:review-vocabulary:attempt-03",
    reviewId: "review:math-vocabulary",
    recommendationId: "engine-rec:math-vocabulary:0003",
    title: "Math vocabulary retrieval",
    priority: "normal",
    scheduledDate: "2026-07-28",
    estimatedMinutes: 10,
  }),
  queueVariant(failureIngest.queueEntry, {
    id: "queue:review-facts:attempt-06",
    reviewId: "review:multiplication-facts",
    recommendationId: "engine-rec:multiplication-facts:0006",
    title: "Multiplication fact retrieval",
    priority: "low",
    scheduledDate: "2026-07-27",
    estimatedMinutes: 5,
  }),
] as const;

const overloadPlan = buildDailyReviewPlan({
  planningDate: "2026-07-28",
  totalAvailableMinutes: 82,
  requiredInstructionMinutes: 60,
  limits: { maxItems: 3, maxMinutes: 18 },
  queueEntries: overloadQueue,
});

const successStartingRecommendation = scheduleNextReview({
  reviewedOn: calendarDate("2026-07-28"),
  state: { lastBaselineIndex: -1 },
});
const successIngest = ingestEngineRecommendation({
  envelope: {
    queueEntryId: "queue:review-fractions:attempt-03",
    sourceRecommendationId: "engine-rec:fractions:0003",
    reviewId: branded<ReviewId>("review:fractions-success"),
    studentId: branded<StudentId>(LEARNER_REF),
    subjectId: branded<SubjectId>("subject:math"),
    skillId: branded<SkillId>("skill:equivalent-fractions"),
    title: "Equivalent fractions retrieval",
    timeZone: HOUSEHOLD_ZONE,
    generatedAt: "2026-07-28T09:00:00-04:00",
    recommendation: successStartingRecommendation,
    authorizedPriority: "high",
    estimatedMinutes: 8,
    basisEvidenceIds: [],
    sameDayPolicy: {
      attemptOrdinal: 1,
      dailyAttemptLimit: 3,
      requiredSupportBoundaryRef: "boundary:morning-session",
      completedSupportBoundary: {
        ref: "boundary:morning-session",
        kind: "break-completed",
        completedAt: "2026-07-28T10:00:00-04:00",
      },
      authorizedWindow: {
        provenance: {
          policyId: "policy:household-same-day-review-v1",
          policyVersion: 1,
          source: "authorized-calendar-policy",
          authorizationRef: "authorization:calendar-review-03",
          authorizedByRole: "system",
          authorizedAt: "2026-07-28T09:01:00-04:00",
        },
        householdTimeZone: HOUSEHOLD_ZONE,
        localDate: "2026-07-28",
        retryNotBefore: "2026-07-28T10:20:00-04:00",
        latestLocalTime: "16:30",
      },
    },
  },
  queueEntries: [],
});
const successfulAttempt: RetrievalAttempt = {
  id: branded<RetrievalAttemptId>("retrieval:fractions:attempt-03"),
  attemptedAt: "2026-07-28T10:27:00-04:00",
  reviewDate: "2026-07-28",
  correctCount: 4,
  attemptedCount: 4,
  hintCount: 0,
  independence: "independent",
  evidenceId: branded<EvidenceId>(
    "evidence:review-fractions:attempt-03",
  ),
};
const successfulResult: SessionResult = {
  id: branded<SessionResultId>("result:review-fractions:attempt-03"),
  sessionId: branded<SessionId>("session:review-fractions:attempt-03"),
  outcome: "completed",
  completedSegmentIds: [],
  remainingSegmentIds: [],
  activeDurationSeconds: 420,
  breakDurationSeconds: 0,
  pausedDurationSeconds: 0,
  evidenceIds: [successfulAttempt.evidenceId],
  recommendedNextAction: "review",
  recordedAt: "2026-07-28T10:28:00-04:00",
};
const successfulFeedback = applyCanonicalReviewResult({
  canonicalReview: successIngest.canonicalReview,
  queueEntries: successIngest.queueEntries,
  completedQueueEntryId: successIngest.queueEntry.id,
  result: successfulResult,
  attempt: successfulAttempt,
  progressState: { lastBaselineIndex: 1 },
  feedbackSignals: {
    confidence: 0.9,
    consecutiveSuccessfulRetrievals: 3,
    retrievalFailed: false,
    prerequisiteGap: false,
    reteachingOutcome: "not_needed",
  },
  nextQueueEntryId: "queue:review-fractions:attempt-04",
  nextSourceRecommendationId: "engine-rec:fractions:0004",
  title: "Equivalent fractions retrieval",
  authorizedPriority: "normal",
  estimatedMinutes: 8,
  sameDayPolicy: {},
  resultReturn: {
    commandId: "command:return-review-fractions:attempt-03",
    outboxId: "outbox:return-review-fractions:attempt-03",
    idempotencyKey: "idempotency:return-review-fractions:attempt-03",
    expectedReviewRevision: successIngest.canonicalReview.revision,
    currentOutbox: [],
  },
});
const successRecommendation = successfulFeedback.engineRecommendation;

function createPartialLesson() {
  let block = createCalendarBlock({
    internalBlockId: "block:fractions-lesson-006",
    learnerRef: LEARNER_REF,
    sourceIdentity: {
      source: "manuel_academy",
      externalItemId: "lesson:fractions-006",
    },
    title: "Fractions lesson",
    subject: "Math",
    blockType: "guided_practice",
    householdTimeZone: HOUSEHOLD_ZONE,
    scheduledLocalStart: "2026-07-28T09:00",
    scheduledStart: "2026-07-28T09:00:00-04:00",
    intendedLocalDate: "2026-07-28",
    createdAt: "2026-07-27T16:00:00Z",
    segments: [
      { segmentId: "warm-up", title: "Warm-up", estimatedMinutes: 4 },
      { segmentId: "visual", title: "Visual model", estimatedMinutes: 5 },
      { segmentId: "example", title: "Worked example", estimatedMinutes: 5 },
      { segmentId: "guided", title: "Guided practice", estimatedMinutes: 8 },
      {
        segmentId: "independent",
        title: "Independent practice",
        estimatedMinutes: 5,
      },
      { segmentId: "check-in", title: "Check-in", estimatedMinutes: 3 },
    ],
  });
  block = startCalendarBlock(block, "2026-07-28T13:00:00Z");
  block = completeCurrentSegment(block, {
    segmentId: "warm-up",
    at: "2026-07-28T13:03:00Z",
  });
  block = completeCurrentSegment(block, {
    segmentId: "visual",
    at: "2026-07-28T13:06:00Z",
  });
  block = completeCurrentSegment(block, {
    segmentId: "example",
    at: "2026-07-28T13:09:00Z",
  });
  return interruptCalendarBlock(block, {
    at: "2026-07-28T13:10:00Z",
    actor: "student",
    category: "planned_break",
    approvalState: "approved",
    responseDraftRef: "draft:guided-fractions-006",
  });
}

const partialLesson = createPartialLesson();
const partialView = calendarBlockView(partialLesson);
const continuation = createAutomaticContinuation([partialLesson], {
  originalInternalBlockId: partialLesson.internalBlockId,
  continuationInternalBlockId: "block:fractions-lesson-006:continuation-01",
  continuationKey: "2026-07-29-am",
  scheduledLocalStart: "2026-07-29T09:00",
  scheduledStart: "2026-07-29T09:00:00-04:00",
  intendedLocalDate: "2026-07-29",
  at: "2026-07-28T13:11:00Z",
});
const continuationRetry = createAutomaticContinuation(continuation.blocks, {
  originalInternalBlockId: partialLesson.internalBlockId,
  continuationInternalBlockId: "block:ignored-duplicate",
  continuationKey: "2026-07-29-am",
  scheduledLocalStart: "2026-07-29T09:00",
  scheduledStart: "2026-07-29T09:00:00-04:00",
  intendedLocalDate: "2026-07-29",
  at: "2026-07-28T13:12:00Z",
});

function parentRecommendation(input: {
  readonly id: string;
  readonly direction: "increase" | "maintain" | "decrease";
  readonly summary: string;
  readonly maximum: number;
  readonly breakMinutes: number;
}) {
  return projectParentRecommendation({
    recommendationId: input.id,
    createdAt: "2026-07-28T07:45:00-04:00",
    direction: input.direction,
    summary: input.summary,
    suggestedMaximumWorkDurationMinutes: input.maximum,
    suggestedBreakDurationMinutes: input.breakMinutes,
    evidence: [
      {
        evidenceId: `evidence:${input.id}`,
        description:
          "Three recent work blocks reached their planned stopping points.",
        observedAt: "2026-07-28T07:40:00-04:00",
        source: "completed-work",
      },
    ],
  }).recommendation;
}

const maintainRecommendation = parentRecommendation({
  id: "recommendation:maintain-short-sections",
  direction: "maintain",
  summary: "Keep the current shorter math sections.",
  maximum: 20,
  breakMinutes: 6,
});
const increaseRecommendation = parentRecommendation({
  id: "recommendation:consider-increase",
  direction: "increase",
  summary: "Consider a slightly longer work section next week.",
  maximum: 35,
  breakMinutes: 5,
});

const parentBase = {
  controlSetId: "controls:runtime-lab",
  studentRef: LEARNER_REF,
  gradeBand: "middle-6-8" as const,
  privateRecordRef: "private:runtime-lab",
  at: "2026-07-28T08:00:00-04:00",
  gradeBandDefault: {
    maximumWorkDurationMinutes: 30,
    breakDurationMinutes: 5,
    timersHidden: false,
  },
  recommendations: [maintainRecommendation, increaseRecommendation],
  knownIncompleteBlockIds: [partialLesson.internalBlockId],
};

const rejectedParentState = applyParentControlAction(
  createParentRuntimeState({
    ...parentBase,
    parentHardMaximumWorkDurationMinutes: 20,
  }),
  {
    type: "reject-recommendation",
    eventId: "event:reject-increase",
    recommendationId: increaseRecommendation.recommendationId,
    at: "2026-07-28T08:01:00-04:00",
    actor: PARENT,
  },
).state;

const allParentActions: readonly ParentControlAction[] = [
  {
    type: "accept-recommendation",
    eventId: "event:01-accept",
    recommendationId: maintainRecommendation.recommendationId,
    at: "2026-07-28T08:01:00-04:00",
    actor: PARENT,
  },
  {
    type: "reject-recommendation",
    eventId: "event:02-reject",
    recommendationId: increaseRecommendation.recommendationId,
    at: "2026-07-28T08:02:00-04:00",
    actor: PARENT,
  },
  {
    type: "set-maximum-work-duration",
    eventId: "event:03-maximum",
    minutes: 24,
    scope: "hard-maximum",
    reason: "Keep work blocks within the family schedule.",
    at: "2026-07-28T08:03:00-04:00",
    actor: PARENT,
  },
  {
    type: "set-break-duration",
    eventId: "event:04-break",
    minutes: 7,
    reason: "Allow time to move and get water.",
    at: "2026-07-28T08:04:00-04:00",
    actor: PARENT,
  },
  {
    type: "set-timers-hidden",
    eventId: "event:05-timer",
    hidden: true,
    reason: "Show progress milestones without a countdown.",
    at: "2026-07-28T08:05:00-04:00",
    actor: PARENT,
  },
  {
    type: "add-accommodation",
    eventId: "event:06-accommodation",
    accommodationId: "accommodation:short-sections",
    required: true,
    functionalDescription:
      "Use twelve-minute sections with a movement break between sections.",
    studentMessage:
      "You can work in a shorter section and take the planned movement break.",
    source: "parent",
    maximumWorkDurationMinutes: 12,
    breakDurationMinutes: 8,
    timersHidden: true,
    at: "2026-07-28T08:06:00-04:00",
    actor: PARENT,
  },
  {
    type: "reschedule-incomplete-work",
    eventId: "event:07-reschedule",
    rescheduleId: "reschedule:partial-fractions",
    blockId: partialLesson.internalBlockId,
    originalStartAt: "2026-07-28T09:00:00-04:00",
    replacementStartAt: "2026-07-29T09:00:00-04:00",
    reason: "Continue after tomorrow's breakfast.",
    at: "2026-07-28T08:07:00-04:00",
    actor: PARENT,
  },
  {
    type: "mark-interruption",
    eventId: "event:08-interruption",
    interruptionId: "interruption:network",
    kind: "technical",
    blockId: partialLesson.internalBlockId,
    occurredAt: "2026-07-28T07:58:00-04:00",
    at: "2026-07-28T08:08:00-04:00",
    actor: PARENT,
  },
  {
    type: "add-private-note",
    eventId: "event:09-private-note",
    noteId: "private-note:fraction-model",
    category: "instructional",
    body: "Place the paper fraction model beside tomorrow's lesson.",
    at: "2026-07-28T08:09:00-04:00",
    actor: PARENT,
  },
  {
    type: "request-adult-review",
    eventId: "event:10-review-request",
    requestId: "review-request:fraction-model",
    audience: "tutor",
    subjectRef: "skill:equivalent-fractions",
    reason: "Please review the visual fraction step before independent work.",
    basisEvidenceIds: ["evidence:fraction-guided-step"],
    at: "2026-07-28T08:10:00-04:00",
    actor: PARENT,
  },
];

const accommodationParentState = allParentActions.reduce(
  (state, action) => applyParentControlAction(state, action).state,
  createParentRuntimeState(parentBase),
);

const commonFlow = [
  { label: "Canonical input", value: "StudentSkillReview v1" },
  { label: "Bounded queue", value: "Priority + daily limits" },
  { label: "Local placement", value: "America/New_York" },
  { label: "Result", value: "Aggregate evidence only" },
] as const;

const retrievalFailure: RuntimeScenario = {
  id: "retrieval-failure",
  shortLabel: "Retrieval failure",
  title: "Reteaching first, then a bounded same-day retry",
  summary:
    "Required instruction keeps its reserved time while lower-priority overdue reviews are held.",
  dateLabel: "Tue · Jul 28",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Required instruction",
      value: `${overloadPlan.requiredInstructionMinutes} min`,
      detail: "Reserved before review placement",
    },
    {
      label: "Review budget",
      value: `${overloadPlan.reviewMinuteBudget} min`,
      detail: `${overloadPlan.scheduledReviewMinutes} minutes scheduled`,
    },
    {
      label: "Reviews held",
      value: String(overloadPlan.held.length),
      detail: "Visible capacity reasons retained",
    },
    {
      label: "Retry window",
      value:
        failureIngest.queueEntry.retryIntent?.earliestLocalTime ?? "Unavailable",
      detail: "Adult-authorized local slot; runtime invented no time",
    },
  ],
  flow: commonFlow,
  calendar: [
    {
      id: "block:required-math-instruction",
      localTime: "9:00 AM",
      title: "Required math instruction",
      detail: "Direct instruction remains protected from review overload.",
      duration: "30 min",
      state: "required",
      requiredWorkPercent: 0,
      tone: "instruction",
    },
    {
      id: failureIngest.queueEntry.id,
      localTime: "10:15 AM",
      title: "Fraction-model reteaching",
      detail: "Reteaching is placed before another retrieval attempt.",
      duration: "10 min est.",
      state: "scheduled",
      requiredWorkPercent: 0,
      tone: "review",
    },
    {
      id: "queue:review-prerequisite:attempt-01",
      localTime: "10:30 AM",
      title: "Same-day fraction retrieval",
      detail: "Retry is inside the learner-local window and daily cap.",
      duration: "8 min est.",
      state: "scheduled",
      requiredWorkPercent: 0,
      tone: "review",
    },
  ],
  evidence: [
    {
      marker: "R",
      title: "Reteaching preparation",
      detail: failureRecommendation.reasons.join(" · "),
    },
    {
      marker: "L",
      title: "Daily limit enforced",
      detail: `${overloadPlan.held.length} reviews remain pending instead of crowding out instruction.`,
    },
    {
      marker: "TZ",
      title: "Local retry intent",
      detail: `${failureIngest.queueEntry.retryIntent?.localDate ?? "2026-07-28"} · ${failureIngest.queueEntry.retryIntent?.earliestLocalTime ?? "capacity review"} · explicit parent authorization`,
    },
  ],
  controls: [
    {
      label: "Required instruction reserve",
      detail: "60 minutes remains authoritative.",
      status: "effective",
    },
    {
      label: "Daily review cap",
      detail: "3 items / 18 minutes.",
      status: "effective",
    },
  ],
  traces: [
    {
      label: "Canonical review",
      title: "Stable review aggregate",
      id: String(failureIngest.canonicalReview.id),
    },
    {
      label: "Queue entry",
      title: "Attempt-specific internal ID",
      id: failureIngest.queueEntry.id,
    },
    {
      label: "Engine recommendation",
      title: "External ID preserved",
      id: failureIngest.queueEntry.sourceRecommendationId,
    },
    {
      label: "Retry authorization",
      title: "No derived cooldown time",
      id:
        failureIngest.queueEntry.retryIntent?.policyProvenance
          ?.authorizationRef ?? "manual-review-required",
    },
  ],
};

const successfulReview: RuntimeScenario = {
  id: "successful-review",
  shortLabel: "Review success",
  title: "Successful retrieval expands the interval",
  summary:
    "The aggregate canonical result returns to the engine and updates parent-visible evidence.",
  dateLabel: "Tue · Jul 28",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Attempt",
      value: "4 / 4",
      detail: "Aggregate result; raw answers excluded",
    },
    {
      label: "Independence",
      value: "95%",
      detail: "Minimal support was not needed",
    },
    {
      label: "Next interval",
      value: `${successRecommendation.intervalDays} days`,
      detail: successRecommendation.cadenceAction,
    },
    {
      label: "Next review",
      value: String(successRecommendation.dueOn),
      detail: "Learner-local calendar date",
    },
  ],
  flow: commonFlow,
  calendar: [
    {
      id: successfulFeedback.completedQueueEntry.id,
      localTime: "10:20 AM",
      title: "Equivalent fractions retrieval",
      detail: "Canonical result: completed independently with visible evidence.",
      duration: `${successfulResult.activeDurationSeconds / 60} min actual`,
      state: "complete",
      requiredWorkPercent: 100,
      tone: "review",
    },
    {
      id: successfulFeedback.nextQueueEntry.id,
      localTime: String(successRecommendation.dueOn),
      title: "Next fractions review",
      detail: "One pending entry after interval expansion; no duplicate queue item.",
      duration: "8 min est.",
      state: "future",
      requiredWorkPercent: 0,
      tone: "review",
    },
  ],
  evidence: [
    {
      marker: "✓",
      title: "Review completed",
      detail: "4 attempted · 4 correct · independent.",
    },
    {
      marker: "↗",
      title: "Interval expanded",
      detail: `${successRecommendation.reasons.join(" · ")}.`,
    },
    {
      marker: "P",
      title: "Parent projection updated",
      detail: "Only aggregate counts, next date, and evidence references are visible.",
    },
  ],
  controls: [
    {
      label: "Engine recommendation",
      detail: `${successRecommendation.intervalDays}-day interval is effective.`,
      status: "effective",
    },
  ],
  traces: [
    {
      label: "Session result",
      title: "Canonical aggregate result",
      id: String(successfulResult.id),
    },
    {
      label: "Evidence",
      title: "Visible evidence reference",
      id: String(successfulAttempt.evidenceId),
    },
    {
      label: "Next queue entry",
      title: "One deterministic successor",
      id: successfulFeedback.nextQueueEntry.id,
    },
    {
      label: "Result-return outbox",
      title: "Idempotent engine command",
      id: successfulFeedback.resultReturnOutboxValue.outboxId,
    },
  ],
};

const partialResume: RuntimeScenario = {
  id: "partial-resume",
  shortLabel: "Partial + resume",
  title: "Three of six segments completed with an exact continuation",
  summary:
    "Estimated and actual duration remain separate; retrying the continuation command is idempotent.",
  dateLabel: "Tue → Wed",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Required work",
      value: `${partialView.requiredWorkCompletionPercent}%`,
      detail: "3 of 6 required segments",
    },
    {
      label: "Remaining",
      value: `${partialView.estimatedRemainingMinutes} min`,
      detail: "Estimate, not elapsed time",
    },
    {
      label: "Actual work",
      value: `${partialView.actualDurationMinutes} min`,
      detail: "Active duration only",
    },
    {
      label: "Continuation",
      value: continuationRetry.created ? "duplicate" : "idempotent",
      detail: "Repeated command created no block",
    },
  ],
  flow: [
    { label: "Plan", value: "6 canonical segments" },
    { label: "Partial result", value: "3 complete · 3 remain" },
    { label: "Resume point", value: "Segment 4 · Guided practice" },
    { label: "Continuation", value: "Same source identity" },
  ],
  calendar: [
    {
      id: partialLesson.internalBlockId,
      localTime: "9:00 AM",
      title: "Fractions lesson",
      detail: "Warm-up, visual model, and worked example complete.",
      duration: `${partialView.actualDurationMinutes} min actual`,
      state: "paused · 3 of 6",
      requiredWorkPercent: partialView.requiredWorkCompletionPercent,
      tone: "partial",
    },
    {
      id: continuation.continuation.internalBlockId,
      localTime: "Wed 9:00",
      title: "Fractions lesson · continue",
      detail: `Resume at ${partialView.resumePoint?.segmentOrdinal ?? 4}: Guided practice; draft reference preserved.`,
      duration: `${partialView.estimatedRemainingMinutes} min est.`,
      state: "scheduled once",
      requiredWorkPercent: partialView.requiredWorkCompletionPercent,
      tone: "instruction",
    },
  ],
  evidence: [
    {
      marker: "3/6",
      title: "Required-work progress",
      detail: "Completion is based on required segments, never time alone.",
    },
    {
      marker: "R",
      title: "Exact resume metadata",
      detail: `${partialView.resumePoint?.segmentId ?? "guided"} · ${partialView.resumePoint?.elapsedActiveSecondsInSegment ?? 60}s active · response draft reference retained.`,
    },
    {
      marker: "1",
      title: "No duplicate continuation",
      detail: `Lineage key ${continuation.continuation.lineage.continuationKey ?? "2026-07-29-am"} resolved to one block.`,
    },
  ],
  controls: [
    {
      label: "Reschedule incomplete work",
      detail: "Continuation moved to Wednesday at 9:00 AM.",
      status: "effective",
    },
  ],
  traces: [
    {
      label: "Original block",
      title: "Stable internal ID",
      id: partialLesson.internalBlockId,
    },
    {
      label: "External lesson",
      title: "Stable source ID",
      id: partialLesson.sourceIdentity.externalItemId,
    },
    {
      label: "Continuation",
      title: "Idempotent lineage ID",
      id: continuation.continuation.internalBlockId,
    },
  ],
};

const parentRejects: RuntimeScenario = {
  id: "parent-rejects",
  shortLabel: "Parent decision",
  title: "Parent rejects an increase; history remains visible",
  summary:
    "The recommendation is retained as history, while the parent hard maximum remains effective.",
  dateLabel: "Tue · Jul 28",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Recommendation",
      value: "35 min",
      detail: "Retained in history",
    },
    {
      label: "Parent maximum",
      value: `${rejectedParentState.effectiveSettings.maximumWorkDurationMinutes} min`,
      detail: "Effective setting",
    },
    {
      label: "Decision",
      value: "Rejected",
      detail: "Can be revisited",
    },
    {
      label: "History",
      value: String(rejectedParentState.recommendations.length),
      detail: "Recommendations preserved",
    },
  ],
  flow: [
    { label: "Engine", value: "Consider 35 minutes" },
    { label: "Parent", value: "Reject recommendation" },
    { label: "Effective", value: "20-minute hard maximum" },
    { label: "History", value: "Recommendation retained" },
  ],
  calendar: [
    {
      id: "block:math-after-parent-decision",
      localTime: "9:00 AM",
      title: "Math lesson",
      detail: "The calendar uses the effective parent maximum.",
      duration: "20 min max.",
      state: "parent limit",
      requiredWorkPercent: 0,
      tone: "instruction",
    },
  ],
  evidence: [
    {
      marker: "H",
      title: "Recommendation retained",
      detail: increaseRecommendation.summary,
    },
    {
      marker: "P",
      title: "Parent decision effective",
      detail:
        rejectedParentState.recommendationDecisions[0]?.displayMessage ??
        "Parent decision remains effective.",
    },
  ],
  controls: [
    {
      label: "Increase recommendation",
      detail: "Rejected without changing or deleting its history.",
      status: "history",
    },
    {
      label: "Parent hard maximum",
      detail: "20 minutes won over the inactive recommendation.",
      status: "effective",
    },
  ],
  traces: [
    {
      label: "Recommendation",
      title: "History ID",
      id: increaseRecommendation.recommendationId,
    },
    {
      label: "Decision",
      title: "Neutral parent event",
      id: rejectedParentState.recommendationDecisions[0]?.decisionId ?? "event:reject-increase",
    },
    {
      label: "Precedence",
      title: "Winner and reason recorded",
      id: rejectedParentState.effectiveSettings.traces.maximumWorkDurationMinutes.policyId,
    },
  ],
};

const actionLabels: Readonly<Record<ParentControlAction["type"], string>> = {
  "accept-recommendation": "Accept recommendation",
  "reject-recommendation": "Reject recommendation",
  "set-maximum-work-duration": "Set maximum work duration",
  "set-break-duration": "Set break duration",
  "set-timers-hidden": "Hide timers",
  "add-accommodation": "Add accommodation",
  "reschedule-incomplete-work": "Reschedule incomplete work",
  "mark-interruption": "Mark interruption",
  "add-private-note": "Add private note",
  "request-adult-review": "Request teacher or tutor review",
};

const accommodation: RuntimeScenario = {
  id: "accommodation",
  shortLabel: "Accommodation",
  title: "Required accommodation wins with functional language",
  summary:
    "Shorter sections, a more frequent break, and hidden timers are applied without diagnosis language.",
  dateLabel: "Tue · Jul 28",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Work maximum",
      value: `${accommodationParentState.effectiveSettings.maximumWorkDurationMinutes} min`,
      detail:
        accommodationParentState.effectiveSettings.traces.maximumWorkDurationMinutes.winner.label,
    },
    {
      label: "Break",
      value: `${accommodationParentState.effectiveSettings.breakDurationMinutes} min`,
      detail:
        accommodationParentState.effectiveSettings.traces.breakDurationMinutes.winner.label,
    },
    {
      label: "Timer",
      value: accommodationParentState.effectiveSettings.timersHidden
        ? "Hidden"
        : "Shown",
      detail:
        accommodationParentState.effectiveSettings.traces.timersHidden.winner.label,
    },
    {
      label: "Controls replayed",
      value: String(accommodationParentState.actionLog.length),
      detail: "All ten parent controls",
    },
  ],
  flow: [
    { label: "Safety", value: "No configured work cap" },
    { label: "Accommodation", value: "12 min · 8 min break" },
    { label: "Parent maximum", value: "24 min superseded" },
    { label: "Effective", value: "Accommodation wins" },
  ],
  calendar: [
    {
      id: "block:accommodated-math-01",
      localTime: "9:00 AM",
      title: "Math · shorter section",
      detail: "Progress milestones are shown; the countdown is hidden.",
      duration: "12 min max.",
      state: "required accommodation",
      requiredWorkPercent: 0,
      tone: "instruction",
    },
    {
      id: "block:planned-movement-break-01",
      localTime: "9:12 AM",
      title: "Planned movement break",
      detail: "A planned break remains distinct from an interruption.",
      duration: "8 min",
      state: "planned break",
      requiredWorkPercent: 100,
      tone: "review",
    },
  ],
  evidence: [
    {
      marker: "A",
      title: "Functional accommodation",
      detail:
        accommodationParentState.accommodations[0]?.functionalDescription ??
        "Use shorter work sections.",
    },
    {
      marker: "W",
      title: "Winner recorded",
      detail:
        accommodationParentState.effectiveSettings.traces.maximumWorkDurationMinutes.winner.reason,
    },
    {
      marker: "N",
      title: "Private note isolated",
      detail: "The public state records only that a private-note command was routed.",
    },
  ],
  controls: accommodationParentState.actionLog.map((entry) => ({
    label: actionLabels[entry.type],
    detail: entry.message,
    status:
      entry.type === "reject-recommendation"
        ? ("history" as const)
        : ("effective" as const),
  })),
  traces: [
    {
      label: "Control set",
      title: "Canonical sidecar identity",
      id: accommodationParentState.controlSetId,
    },
    {
      label: "Policy",
      title: "Card 5 constraint policy",
      id: accommodationParentState.precedencePolicy.policyId,
    },
    {
      label: "Private record",
      title: "Separate authorized projection",
      id: accommodationParentState.privateRecordRef,
    },
  ],
};

const romeoOriginal = normalizeRomeoAssignment({
  schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  externalAssignmentId: "rva:algebra-204",
  hostLaunchRef: "host-launch:romeo:rva-algebra-204",
  title: "Solving two-step equations",
  course: "Algebra I",
  dueDate: "2026-07-31",
  estimatedDurationMinutes: 35,
  completionState: "in_progress",
  parentEnteredProgress: {
    completedUnits: 2,
    totalUnits: 5,
    updatedAt: "2026-07-28T08:20:00-04:00",
  },
  studentEnteredProgress: {
    completedUnits: 3,
    totalUnits: 5,
    updatedAt: "2026-07-28T09:10:00-04:00",
  },
  linkedManuelAcademyTutoring: {
    targetType: "skill",
    targetId: "skill:solve-two-step-equations",
    title: "Two-step equation tutoring",
    supportStudyPlanId: {
      id: "plan:two-step-equations:v1" as StudyPlanId,
      revision: 1,
    },
  },
  resumeNote: "Resume with question 6.",
  externalUrlReference:
    "https://academy.example.invalid/assignments/rva-algebra-204",
  lastCheckedAt: "2026-07-28T09:15:00-04:00",
  sourceMode: "manual",
});
const romeoCompleted = updateRomeoAssignment(romeoOriginal, {
  schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  externalAssignmentId: romeoOriginal.externalAssignmentId,
  completionState: "completed",
  studentEnteredProgress: {
    completedUnits: 5,
    totalUnits: 5,
    updatedAt: "2026-07-28T10:00:00-04:00",
  },
  resumeNote: "Assignment complete; tutoring link remains available.",
  lastCheckedAt: "2026-07-28T10:01:00-04:00",
  sourceMode: "manual",
});
const romeoPublic = projectRomeoAssignmentForPublic(romeoCompleted);
const romeoCalendar = projectRomeoAssignmentToCalendar(romeoCompleted, {
  internalBlockId: "block:romeo:algebra-204",
  learnerRef: LEARNER_REF,
  householdTimeZone: HOUSEHOLD_ZONE,
  scheduledLocalStart: "2026-07-28T13:30",
  scheduledStart: "2026-07-28T13:30:00-04:00",
  intendedLocalDate: "2026-07-28",
  createdAt: "2026-07-28T13:20:00Z",
  required: true,
});
const romeoCalendarRetry = projectRomeoAssignmentToCalendar(
  romeoCompleted,
  {
    internalBlockId: "block:ignored-romeo-retry",
    learnerRef: LEARNER_REF,
    householdTimeZone: HOUSEHOLD_ZONE,
    scheduledLocalStart: "2026-07-29T13:30",
    scheduledStart: "2026-07-29T13:30:00-04:00",
    intendedLocalDate: "2026-07-29",
    createdAt: "2026-07-28T14:05:00Z",
    required: true,
  },
  romeoCalendar.blocks,
);

const romeo: RuntimeScenario = {
  id: "romeo",
  shortLabel: "Romeo adapter",
  title: "Credential-free Romeo assignment metadata",
  summary:
    "Manual metadata links external work to Manuel Academy tutoring without login, scraping, or sync.",
  dateLabel: "Due Fri · Jul 31",
  timeZone: HOUSEHOLD_ZONE,
  metrics: [
    {
      label: "Source mode",
      value: "Manual",
      detail: "Parent-entered metadata",
    },
    {
      label: "Progress",
      value: "3 / 5 → 5 / 5",
      detail: "Student-entered completion update",
    },
    {
      label: "Estimate",
      value: `${romeoCompleted.estimatedDurationMinutes} min`,
      detail: "Actual duration tracked separately",
    },
    {
      label: "Credentials",
      value: "0",
      detail: "Never requested or stored",
    },
  ],
  flow: [
    { label: "Input", value: "Manual Romeo metadata" },
    { label: "Adapter", value: "Credential scan + normalize" },
    { label: "Calendar", value: "Stable external ID" },
    { label: "Support", value: "Linked tutoring lesson" },
  ],
  calendar: [
    {
      id: romeoCalendar.block.internalBlockId,
      localTime: "1:30 PM",
      title: romeoCompleted.title,
      detail: `Romeo Virtual Academy · ${romeoCompleted.course} · completion update received.`,
      duration: `${romeoCalendar.block.estimatedDurationMinutes} min est.`,
      state: "complete · 5 of 5",
      requiredWorkPercent: 100,
      tone: "external",
    },
    {
      id: "block:tutoring:equations-step-02",
      localTime: "1:10 PM",
      title: "Two-step equation tutoring",
      detail: "Linked Manuel Academy skill support before external work.",
      duration: "15 min",
      state: "available",
      requiredWorkPercent: 0,
      tone: "instruction",
    },
  ],
  evidence: [
    {
      marker: "M",
      title: "Manual source",
      detail: `Last checked ${romeoCompleted.lastCheckedAt}.`,
    },
    {
      marker: "L",
      title: "Linked tutoring",
      detail: `${romeoCompleted.linkedManuelAcademyTutoring?.targetId ?? "skill:solve-two-step-equations"} · tutoring support available.`,
    },
    {
      marker: "0",
      title: "Credential-free boundary",
      detail: `Public launch reference ${romeoPublic.hostLaunchRef}; no login, URL, resume-note body, session cookie, token, automatic fetch, or production sync.`,
    },
  ],
  controls: [
    {
      label: "Parent progress entry",
      detail: `${romeoCompleted.parentEnteredProgress?.completedUnits ?? 2} of ${romeoCompleted.parentEnteredProgress?.totalUnits ?? 5} units remains separate from student progress.`,
      status: "effective",
    },
    {
      label: "Completion update",
      detail: romeoCompleted.resumeNote ?? "Assignment completion recorded.",
      status: "effective",
    },
  ],
  traces: [
    {
      label: "External assignment",
      title: "Romeo ID preserved",
      id: romeoCompleted.externalAssignmentId,
    },
    {
      label: "Calendar block",
      title:
        romeoCalendarRetry.action === "idempotent"
          ? "Retry preserved first internal ID"
          : "Internal ID remains separate",
      id: romeoCalendarRetry.block.internalBlockId,
    },
    {
      label: "Tutoring skill",
      title: "Opaque support link",
      id:
        romeoCompleted.linkedManuelAcademyTutoring?.targetId ??
        "skill:solve-two-step-equations",
    },
  ],
};

export const RUNTIME_SCENARIOS: readonly RuntimeScenario[] = [
  retrievalFailure,
  successfulReview,
  partialResume,
  parentRejects,
  accommodation,
  romeo,
];

export function deterministicScenarioTrace(): readonly {
  readonly scenario: RuntimeScenarioId;
  readonly metrics: readonly string[];
  readonly ids: readonly string[];
}[] {
  return RUNTIME_SCENARIOS.map((scenario) => ({
    scenario: scenario.id,
    metrics: scenario.metrics.map(
      ({ label, value }) => `${label}:${value}`,
    ),
    ids: scenario.traces.map(({ id }) => id),
  }));
}
