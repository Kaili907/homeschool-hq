import { describe, expect, it } from "vitest";

import type {
  EvidenceId,
  ReviewId,
  SkillId,
  StudentId,
  SubjectId,
} from "../../contracts/common";
import type {
  RetrievalAttempt,
  StudentSkillReview,
} from "../../contracts/review-scheduling";
import type { SessionResult } from "../../contracts/study-session";
import {
  scheduleNextReview,
  type RetrievalEvidence,
  type ReviewRecommendation,
} from "../../engine/review/index";
import {
  applyCanonicalReviewResult,
  buildDailyReviewPlan,
  enqueueReviewResultReturn,
  ingestEngineRecommendation,
  card8IndependenceScore,
  REVIEW_RUNTIME_SCHEMA_VERSION,
  ReviewRuntimeError,
  type EngineRecommendationEnvelope,
  type ReviewQueueEntry,
  type ReviewResultReturnOutboxValue,
  type ReviewResultReturnRequest,
  type SameDayRetryPolicy,
} from "../../integration-labs/calendar-parent-runtime/review-runtime";

const reviewId = (value: string): ReviewId => value as ReviewId;
const studentId = (value: string): StudentId => value as StudentId;
const subjectId = (value: string): SubjectId => value as SubjectId;
const skillId = (value: string): SkillId => value as SkillId;
const evidenceId = (value: string): EvidenceId => value as EvidenceId;

const planningDate = "2026-07-28";
const learnerTimeZone = "America/New_York";

const strongEvidence: RetrievalEvidence = {
  retrievalAccuracy: 1,
  independence: 1,
  confidence: 0.9,
  consecutiveSuccessfulRetrievals: 3,
  retrievalFailed: false,
  prerequisiteGap: false,
  reteachingOutcome: "not_needed",
};

function authorizedSameDayPolicy(
  completedPreparation?: SameDayRetryPolicy["completedPreparation"],
): SameDayRetryPolicy {
  return {
    attemptOrdinal: 1,
    dailyAttemptLimit: 3,
    requiredSupportBoundaryRef: "boundary:session-review-001",
    completedSupportBoundary: {
      ref: "boundary:session-review-001",
      kind: "session-ended",
      completedAt: "2026-07-28T18:20:00.000Z",
    },
    ...(completedPreparation ? { completedPreparation } : {}),
    authorizedWindow: {
      provenance: {
        policyId: "policy:same-day-review-001",
        policyVersion: 1,
        source: "adult-scheduled-slot",
        authorizationRef: "authorization:parent-001",
        authorizedByRole: "parent",
        authorizedAt: "2026-07-28T18:21:00.000Z",
      },
      householdTimeZone: learnerTimeZone,
      localDate: planningDate,
      retryNotBefore: "2026-07-28T14:30:00-04:00",
      latestLocalTime: "20:00",
    },
  };
}

function resultReturnRequest(
  overrides: Partial<ReviewResultReturnRequest> = {},
): ReviewResultReturnRequest {
  return {
    commandId: "command:return-review-result-001",
    outboxId: "outbox:return-review-result-001",
    idempotencyKey: "idempotency:return-review-result-001",
    expectedReviewRevision: 1,
    currentOutbox: [],
    ...overrides,
  };
}

function startingRecommendation(
  reviewedOn = planningDate,
): ReviewRecommendation {
  return scheduleNextReview({
    reviewedOn,
    state: { lastBaselineIndex: -1 },
  });
}

function envelope(
  overrides: Partial<EngineRecommendationEnvelope> = {},
): EngineRecommendationEnvelope {
  return {
    queueEntryId: "queue-fractions-001",
    sourceRecommendationId: "engine-recommendation-fractions-001",
    reviewId: reviewId("review-fractions"),
    studentId: studentId("student-opaque-001"),
    subjectId: subjectId("subject-math"),
    skillId: skillId("skill-fraction-equivalence"),
    title: "Fraction equivalence review",
    timeZone: learnerTimeZone,
    generatedAt: "2026-07-28T18:00:00.000Z",
    recommendation: startingRecommendation(),
    authorizedPriority: "high",
    estimatedMinutes: 8,
    basisEvidenceIds: [],
    sameDayPolicy: authorizedSameDayPolicy(),
    ...overrides,
  };
}

function queueEntry(
  overrides: Partial<ReviewQueueEntry> = {},
): ReviewQueueEntry {
  return {
    schemaVersion: REVIEW_RUNTIME_SCHEMA_VERSION,
    id: "queue-default",
    sourceRecommendationId: "recommendation-default",
    canonicalReviewId: reviewId("review-default"),
    canonicalReviewRevision: 1,
    skillId: skillId("skill-default"),
    title: "Quick skill review",
    workKind: "review",
    priority: "normal",
    createdAt: "2026-07-28T14:00:00.000Z",
    scheduledDate: planningDate,
    estimatedMinutes: 5,
    actualDurationSeconds: null,
    state: "pending",
    retryIntent: null,
    ...overrides,
  };
}

function attempt(
  overrides: Partial<RetrievalAttempt> = {},
): RetrievalAttempt {
  return {
    id: "attempt-001" as RetrievalAttempt["id"],
    attemptedAt: "2026-07-28T18:50:00.000Z",
    reviewDate: planningDate,
    correctCount: 5,
    attemptedCount: 5,
    hintCount: 0,
    independence: "independent",
    evidenceId: evidenceId("evidence-retrieval-001"),
    ...overrides,
  };
}

function sessionResult(
  retrievalAttempt: RetrievalAttempt,
  overrides: Partial<SessionResult> = {},
): SessionResult {
  return {
    id: "result-review-001" as SessionResult["id"],
    sessionId: "session-review-001" as SessionResult["sessionId"],
    outcome: "completed",
    completedSegmentIds: [],
    remainingSegmentIds: [],
    activeDurationSeconds: 420,
    breakDurationSeconds: 0,
    pausedDurationSeconds: 0,
    evidenceIds: [retrievalAttempt.evidenceId],
    recommendedNextAction: "review",
    recordedAt: "2026-07-28T19:00:00.000Z",
    ...overrides,
  };
}

function initialRuntime(): {
  readonly canonicalReview: StudentSkillReview;
  readonly queueEntries: readonly ReviewQueueEntry[];
} {
  const ingested = ingestEngineRecommendation({
    envelope: envelope(),
    queueEntries: [],
  });
  return {
    canonicalReview: ingested.canonicalReview,
    queueEntries: ingested.queueEntries,
  };
}

describe("review recommendation canonical adapter", () => {
  it("maps a retrieval failure into a canonical review, reteaching queue entry, and learner-local retry intent", () => {
    const failure = scheduleNextReview({
      reviewedOn: planningDate,
      state: { lastBaselineIndex: 4 },
      evidence: {
        ...strongEvidence,
        retrievalAccuracy: 0.2,
        independence: 0.5,
        confidence: 0.2,
        consecutiveSuccessfulRetrievals: 0,
        retrievalFailed: true,
      },
    });

    const adapted = ingestEngineRecommendation({
      envelope: envelope({
        sourceRecommendationId: "engine-failure-001",
        recommendation: failure,
        basisEvidenceIds: [evidenceId("evidence-failure-001")],
        sameDayPolicy: authorizedSameDayPolicy({
          kind: "reteaching-completed",
          completedAt: "2026-07-28T18:10:00.000Z",
          evidenceRefs: ["evidence:reteaching-completed-001"],
        }),
      }),
      queueEntries: [],
    });

    expect(adapted.canonicalReview).toMatchObject({
      kind: "student-skill-review",
      schemaVersion: 1,
      id: "review-fractions",
      revision: 1,
      timeZone: learnerTimeZone,
      currentInterval: { id: "same-day", days: 0 },
      nextReviewDate: planningDate,
      reteachingTrigger: {
        status: "triggered",
        reason: "repeated-retrieval-difficulty",
        basisEvidenceIds: ["evidence-failure-001"],
      },
    });
    expect(
      adapted.canonicalReview.metadata?.extensions?.[
        "manuel:last-source-recommendation-id"
      ],
    ).toBe("engine-failure-001");
    expect(adapted.queueEntry).toMatchObject({
      id: "queue-fractions-001",
      sourceRecommendationId: "engine-failure-001",
      canonicalReviewId: "review-fractions",
      workKind: "reteaching",
      priority: "high",
      scheduledDate: planningDate,
      estimatedMinutes: 8,
      actualDurationSeconds: null,
      state: "pending",
      retryIntent: {
        householdTimeZone: learnerTimeZone,
        notBeforeLocalDate: planningDate,
        dueByLocalDate: planningDate,
        timeZone: learnerTimeZone,
        localDate: planningDate,
        earliestLocalTime: "14:30",
        latestLocalTime: "20:00",
        retryNotBefore: "2026-07-28T14:30:00-04:00",
        attemptOrdinal: 1,
        dailyAttemptLimit: 3,
        requiredSupportBoundaryRef: "boundary:session-review-001",
        completedSupportBoundaryRef: "boundary:session-review-001",
        status: "authorized-slot-ready",
        requiredPreparation: "reteach-before-retrieval",
        preparationEvidenceRefs: [
          "evidence:reteaching-completed-001",
        ],
        resolution: "authorized-slot-may-be-projected",
      },
    });
    expect(adapted.trace.map(({ code }) => code)).toEqual([
      "recommendation-received",
      "canonical-review-created",
      "queue-entry-inserted",
      "same-day-retry-window-created",
    ]);
  });

  it("is idempotent for the same stable IDs and blocks semantic duplicates", () => {
    const first = ingestEngineRecommendation({
      envelope: envelope(),
      queueEntries: [],
    });
    const replay = ingestEngineRecommendation({
      envelope: envelope(),
      currentReview: first.canonicalReview,
      queueEntries: first.queueEntries,
    });

    expect(replay.canonicalAction).toBe("idempotent");
    expect(replay.queueAction).toBe("idempotent");
    expect(replay.canonicalReview).toStrictEqual(first.canonicalReview);
    expect(replay.queueEntries).toStrictEqual(first.queueEntries);
    expect(replay.queueEntries).toHaveLength(1);

    expect(() =>
      ingestEngineRecommendation({
        envelope: envelope({
          basisEvidenceIds: [evidenceId("evidence:changed-replay")],
        }),
        currentReview: first.canonicalReview,
        queueEntries: first.queueEntries,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "identity-conflict",
      }),
    );

    expect(() =>
      ingestEngineRecommendation({
        envelope: envelope({
          queueEntryId: "queue-fractions-duplicate",
          sourceRecommendationId: "engine-recommendation-duplicate",
        }),
        currentReview: first.canonicalReview,
        queueEntries: first.queueEntries,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "duplicate-entry",
      }),
    );
  });

  it("rejects reuse of an external recommendation ID with changed scheduling data", () => {
    const first = ingestEngineRecommendation({
      envelope: envelope(),
      queueEntries: [],
    });
    const future = scheduleNextReview({
      reviewedOn: planningDate,
      state: { lastBaselineIndex: 0 },
      evidence: strongEvidence,
    });

    expect(() =>
      ingestEngineRecommendation({
        envelope: envelope({ recommendation: future }),
        currentReview: first.canonicalReview,
        queueEntries: first.queueEntries,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "identity-conflict",
      }),
    );
  });

  it("drops unexpected raw-answer and identifying fields from queue and trace projections", () => {
    const unsafeEnvelope = {
      ...envelope(),
      learnerName: "Sensitive Learner Name",
      rawAnswer: "raw response text",
      transcript: "private transcript",
      diagnosis: "private diagnosis",
      hiddenBehaviorScore: 0.1,
    } as EngineRecommendationEnvelope & {
      learnerName: string;
      rawAnswer: string;
      transcript: string;
      diagnosis: string;
      hiddenBehaviorScore: number;
    };
    const adapted = ingestEngineRecommendation({
      envelope: unsafeEnvelope,
      queueEntries: [],
    });
    const publicProjection = JSON.stringify({
      queueEntry: adapted.queueEntry,
      trace: adapted.trace,
    });

    expect(publicProjection).not.toMatch(
      /Sensitive Learner Name|raw response text|private transcript|private diagnosis|hiddenBehaviorScore/,
    );
  });
});

describe("daily priority, limits, and required-instruction protection", () => {
  it("reserves required instruction before reviews and preserves strict priority after a minute hold", () => {
    const entries = [
      queueEntry({
        id: "queue-urgent",
        sourceRecommendationId: "recommendation-urgent",
        canonicalReviewId: reviewId("review-urgent"),
        skillId: skillId("skill-urgent"),
        priority: "urgent",
        estimatedMinutes: 10,
        scheduledDate: "2026-07-27",
      }),
      queueEntry({
        id: "queue-high",
        sourceRecommendationId: "recommendation-high",
        canonicalReviewId: reviewId("review-high"),
        skillId: skillId("skill-high"),
        priority: "high",
        estimatedMinutes: 10,
      }),
      queueEntry({
        id: "queue-low-short",
        sourceRecommendationId: "recommendation-low-short",
        canonicalReviewId: reviewId("review-low-short"),
        skillId: skillId("skill-low-short"),
        priority: "low",
        estimatedMinutes: 2,
      }),
      queueEntry({
        id: "queue-future",
        sourceRecommendationId: "recommendation-future",
        canonicalReviewId: reviewId("review-future"),
        skillId: skillId("skill-future"),
        scheduledDate: "2026-07-29",
      }),
    ];

    const plan = buildDailyReviewPlan({
      planningDate,
      totalAvailableMinutes: 60,
      requiredInstructionMinutes: 45,
      limits: { maxItems: 5, maxMinutes: 30 },
      queueEntries: entries,
    });

    expect(plan.reviewMinuteBudget).toBe(15);
    expect(plan.scheduled.map(({ entry }) => entry.id)).toEqual([
      "queue-urgent",
    ]);
    expect(plan.scheduledReviewMinutes).toBe(10);
    expect(plan.held).toEqual([
      expect.objectContaining({
        entry: expect.objectContaining({ id: "queue-high" }),
        reason: "required-instruction-reserved",
      }),
      expect.objectContaining({
        entry: expect.objectContaining({ id: "queue-low-short" }),
        reason: "priority-preserved",
        heldBehindEntryId: "queue-high",
      }),
    ]);
    expect(plan.upcoming.map(({ id }) => id)).toEqual(["queue-future"]);
    expect(plan.overloadAvoided).toBe(true);
    expect(
      plan.trace.find(({ code }) => code === "required-instruction-reserved")
        ?.detail,
    ).toContain("Reserved 45 of 60");
  });

  it("enforces the item limit independently of the minute limit", () => {
    const plan = buildDailyReviewPlan({
      planningDate,
      totalAvailableMinutes: 120,
      requiredInstructionMinutes: 40,
      limits: { maxItems: 1, maxMinutes: 60 },
      queueEntries: [
        queueEntry({
          id: "queue-a",
          sourceRecommendationId: "recommendation-a",
          canonicalReviewId: reviewId("review-a"),
          skillId: skillId("skill-a"),
          priority: "urgent",
        }),
        queueEntry({
          id: "queue-b",
          sourceRecommendationId: "recommendation-b",
          canonicalReviewId: reviewId("review-b"),
          skillId: skillId("skill-b"),
          priority: "high",
        }),
      ],
    });

    expect(plan.scheduled.map(({ entry }) => entry.id)).toEqual(["queue-a"]);
    expect(plan.held).toEqual([
      expect.objectContaining({
        entry: expect.objectContaining({ id: "queue-b" }),
        reason: "daily-item-limit",
      }),
    ]);
  });

  it("holds all review work when required instruction consumes available capacity", () => {
    const plan = buildDailyReviewPlan({
      planningDate,
      totalAvailableMinutes: 30,
      requiredInstructionMinutes: 30,
      limits: { maxItems: 3, maxMinutes: 30 },
      queueEntries: [
        queueEntry({
          id: "queue-a",
          sourceRecommendationId: "recommendation-a",
          canonicalReviewId: reviewId("review-a"),
          skillId: skillId("skill-a"),
          priority: "urgent",
        }),
      ],
    });

    expect(plan.reviewMinuteBudget).toBe(0);
    expect(plan.scheduled).toEqual([]);
    expect(plan.held[0]).toMatchObject({
      reason: "required-instruction-reserved",
    });
  });

  it("produces deterministic plans and traces for identical input", () => {
    const input = {
      planningDate,
      totalAvailableMinutes: 40,
      requiredInstructionMinutes: 20,
      limits: { maxItems: 2, maxMinutes: 20 },
      queueEntries: [
        queueEntry({
          id: "queue-b",
          sourceRecommendationId: "recommendation-b",
          canonicalReviewId: reviewId("review-b"),
          skillId: skillId("skill-b"),
          priority: "high",
        }),
        queueEntry({
          id: "queue-a",
          sourceRecommendationId: "recommendation-a",
          canonicalReviewId: reviewId("review-a"),
          skillId: skillId("skill-a"),
          priority: "high",
        }),
      ],
    } as const;

    expect(buildDailyReviewPlan(input)).toStrictEqual(
      buildDailyReviewPlan(input),
    );
    expect(
      buildDailyReviewPlan(input).scheduled.map(({ entry }) => entry.id),
    ).toEqual(["queue-a", "queue-b"]);
  });
});

describe("learner-local same-day retry windows", () => {
  it("keeps retry-not-before null and routes to manual review when only a cooldown is supplied", () => {
    const recommendation = startingRecommendation("2026-03-08");
    const adapted = ingestEngineRecommendation({
      envelope: envelope({
        generatedAt: "2026-03-08T06:45:00.000Z",
        recommendation,
        sameDayPolicy: {
          cooldownMinutes: 30,
          latestLocalTime: "20:00",
        },
      }),
      queueEntries: [],
    });

    expect(adapted.queueEntry.retryIntent).toMatchObject({
      localDate: "2026-03-08",
      dueDate: "2026-03-08",
      timeZone: learnerTimeZone,
      retryNotBefore: null,
      earliestLocalTime: null,
      latestLocalTime: null,
      status: "manual-review",
      resolution: "manual-review-required",
    });
    const plan = buildDailyReviewPlan({
      planningDate: "2026-03-08",
      totalAvailableMinutes: 60,
      requiredInstructionMinutes: 20,
      limits: { maxItems: 3, maxMinutes: 30 },
      queueEntries: adapted.queueEntries,
    });
    expect(plan.scheduled).toEqual([]);
    expect(plan.held[0]).toMatchObject({
      reason: "same-day-manual-review",
    });
    expect(plan.overloadAvoided).toBe(false);
  });

  it("does not project an authorized slot after the same-day attempt limit is reached", () => {
    const policy = authorizedSameDayPolicy();
    const adapted = ingestEngineRecommendation({
      envelope: envelope({
        sameDayPolicy: {
          ...policy,
          attemptOrdinal: 4,
          dailyAttemptLimit: 3,
        },
      }),
      queueEntries: [],
    });

    expect(adapted.queueEntry.retryIntent).toMatchObject({
      localDate: planningDate,
      attemptOrdinal: 4,
      dailyAttemptLimit: 3,
      retryNotBefore: null,
      earliestLocalTime: null,
      status: "daily-limit-reached",
      resolution: "manual-review-required",
    });
    const plan = buildDailyReviewPlan({
      planningDate,
      totalAvailableMinutes: 60,
      requiredInstructionMinutes: 20,
      limits: { maxItems: 3, maxMinutes: 30 },
      queueEntries: adapted.queueEntries,
    });
    expect(plan.scheduled).toEqual([]);
    expect(plan.held[0]).toMatchObject({
      reason: "same-day-attempt-limit",
    });
  });

  it("requires completed preparation and a matching break-or-session boundary before exposing an authorized slot", () => {
    const failure = scheduleNextReview({
      reviewedOn: planningDate,
      state: { lastBaselineIndex: 2 },
      evidence: {
        ...strongEvidence,
        retrievalAccuracy: 0.2,
        independence: 0.5,
        consecutiveSuccessfulRetrievals: 0,
        retrievalFailed: true,
      },
    });
    const policy = authorizedSameDayPolicy();
    const awaitingPreparation = ingestEngineRecommendation({
      envelope: envelope({
        recommendation: failure,
        basisEvidenceIds: [evidenceId("evidence:awaiting-preparation")],
        sameDayPolicy: policy,
      }),
      queueEntries: [],
    });
    expect(awaitingPreparation.queueEntry.retryIntent).toMatchObject({
      requiredPreparation: "reteach-before-retrieval",
      status: "awaiting-preparation",
      retryNotBefore: null,
    });

    const {
      completedSupportBoundary: _completedSupportBoundary,
      ...policyWithoutBoundary
    } = policy;
    const awaitingBoundary = ingestEngineRecommendation({
      envelope: envelope({
        queueEntryId: "queue-awaiting-boundary",
        sourceRecommendationId: "recommendation-awaiting-boundary",
        recommendation: failure,
        basisEvidenceIds: [evidenceId("evidence:awaiting-boundary")],
        sameDayPolicy: {
          ...policyWithoutBoundary,
          completedPreparation: {
            kind: "reteaching-completed",
            completedAt: "2026-07-28T18:10:00.000Z",
            evidenceRefs: ["evidence:reteaching-completed"],
          },
        },
      }),
      queueEntries: [],
    });
    expect(awaitingBoundary.queueEntry.retryIntent).toMatchObject({
      status: "awaiting-break-or-session-boundary",
      retryNotBefore: null,
      requiredSupportBoundaryRef: "boundary:session-review-001",
    });
  });
});

describe("canonical result feedback to Session 2 engine", () => {
  it("records a successful canonical attempt, expands the interval, completes the old entry, and creates parent-visible evidence", () => {
    const initial = initialRuntime();
    const retrievalAttempt = attempt();
    const result = sessionResult(retrievalAttempt);

    const feedbackInput: Parameters<
      typeof applyCanonicalReviewResult
    >[0] = {
      canonicalReview: initial.canonicalReview,
      queueEntries: initial.queueEntries,
      completedQueueEntryId: "queue-fractions-001",
      result,
      attempt: retrievalAttempt,
      progressState: { lastBaselineIndex: 2 },
      feedbackSignals: {
        confidence: 0.9,
        consecutiveSuccessfulRetrievals: 3,
        retrievalFailed: false,
        prerequisiteGap: false,
        reteachingOutcome: "not_needed",
      },
      nextQueueEntryId: "queue-fractions-002",
      nextSourceRecommendationId: "engine-recommendation-fractions-002",
      title: "Fraction equivalence review",
      authorizedPriority: "normal",
      estimatedMinutes: 6,
      sameDayPolicy: {
        cooldownMinutes: 30,
        latestLocalTime: "20:00",
      },
      resultReturn: resultReturnRequest(),
    };
    const feedback = applyCanonicalReviewResult(feedbackInput);

    expect(feedback.engineEvidence).toMatchObject({
      retrievalAccuracy: 1,
      independence: 1,
      confidence: 0.9,
    });
    expect(feedback.engineRecommendation).toMatchObject({
      cadenceAction: "advance",
      intervalAdjustment: "modestly_extended",
      intervalDays: 8,
      dueOn: "2026-08-05",
      preparation: "none",
    });
    expect(feedback.canonicalReview).toMatchObject({
      revision: 2,
      currentInterval: { id: "custom", days: 8 },
      nextReviewDate: "2026-08-05",
      retrievalAttempts: [
        expect.objectContaining({ id: "attempt-001" }),
      ],
      intervalAdjustments: [
        expect.objectContaining({
          action: "interval-expansion",
          from: { id: "same-day", days: 0 },
          to: { id: "custom", days: 8 },
          basisEvidenceIds: ["evidence-retrieval-001"],
        }),
      ],
    });
    expect(feedback.completedQueueEntry).toMatchObject({
      id: "queue-fractions-001",
      state: "completed",
      estimatedMinutes: 8,
      actualDurationSeconds: 420,
    });
    expect(feedback.nextQueueEntry).toMatchObject({
      id: "queue-fractions-002",
      workKind: "review",
      state: "pending",
      scheduledDate: "2026-08-05",
      estimatedMinutes: 6,
      actualDurationSeconds: null,
    });
    expect(feedback.queueEntries).toHaveLength(2);
    expect(feedback.resultReturnAction).toBe("enqueued");
    expect(feedback.resultReturnCommand).toMatchObject({
      kind: "review-result-return-command",
      schemaVersion: 1,
      commandId: "command:return-review-result-001",
      idempotencyKey: "idempotency:return-review-result-001",
      expectedReviewRevision: 1,
      canonicalReviewId: "review-fractions",
      canonicalResultId: "result-review-001",
      sessionId: "session-review-001",
      retrievalAttemptId: "attempt-001",
      evidenceId: "evidence-retrieval-001",
    });
    expect(feedback.resultReturnOutboxValue).toMatchObject({
      kind: "review-result-return-outbox",
      schemaVersion: 1,
      outboxId: "outbox:return-review-result-001",
      state: "pending",
    });
    expect(feedback.resultReturnOutbox).toHaveLength(1);
    expect(feedback.trace.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: feedback.trace.length }, (_, index) => index + 1),
    );

    const replay = applyCanonicalReviewResult({
      ...feedbackInput,
      canonicalReview: feedback.canonicalReview,
      queueEntries: feedback.queueEntries,
      resultReturn: {
        ...feedbackInput.resultReturn,
        currentOutbox: feedback.resultReturnOutbox,
      },
    });
    expect(replay.resultReturnAction).toBe("idempotent");
    expect(replay.canonicalReview).toStrictEqual(feedback.canonicalReview);
    expect(replay.queueEntries).toStrictEqual(feedback.queueEntries);
    expect(replay.queueEntries).toHaveLength(2);
  });

  it("returns retrieval difficulty as reteaching and a same-day queue window", () => {
    const initial = initialRuntime();
    const retrievalAttempt = attempt({
      id: "attempt-failure" as RetrievalAttempt["id"],
      correctCount: 1,
      hintCount: 3,
      independence: "guided",
      evidenceId: evidenceId("evidence-failure"),
    });
    const result = sessionResult(retrievalAttempt, {
      id: "result-failure" as SessionResult["id"],
      recommendedNextAction: "reteach",
    });

    const feedback = applyCanonicalReviewResult({
      canonicalReview: initial.canonicalReview,
      queueEntries: initial.queueEntries,
      completedQueueEntryId: "queue-fractions-001",
      result,
      attempt: retrievalAttempt,
      progressState: { lastBaselineIndex: 4 },
      feedbackSignals: {
        confidence: 0.2,
        consecutiveSuccessfulRetrievals: 0,
        retrievalFailed: true,
        prerequisiteGap: false,
        reteachingOutcome: "not_observed",
      },
      nextQueueEntryId: "queue-fractions-reteach",
      nextSourceRecommendationId: "engine-recommendation-reteach",
      title: "Fraction equivalence support",
      authorizedPriority: "urgent",
      estimatedMinutes: 10,
      sameDayPolicy: {
        attemptOrdinal: 2,
        dailyAttemptLimit: 3,
        requiredSupportBoundaryRef: "boundary:failure-session",
        completedPreparation: {
          kind: "reteaching-completed",
          completedAt: "2026-07-28T19:05:00.000Z",
          evidenceRefs: ["evidence:reteaching-after-failure"],
        },
        completedSupportBoundary: {
          ref: "boundary:failure-session",
          kind: "session-ended",
          completedAt: "2026-07-28T19:10:00.000Z",
        },
        authorizedWindow: {
          provenance: {
            policyId: "policy:failure-retry",
            policyVersion: 1,
            source: "authorized-calendar-policy",
            authorizationRef: "authorization:failure-retry",
            authorizedByRole: "system",
            authorizedAt: "2026-07-28T19:11:00.000Z",
          },
          householdTimeZone: learnerTimeZone,
          localDate: planningDate,
          retryNotBefore: "2026-07-28T15:30:00-04:00",
          latestLocalTime: "20:00",
        },
      },
      resultReturn: resultReturnRequest({
        commandId: "command:return-failure",
        outboxId: "outbox:return-failure",
        idempotencyKey: "idempotency:return-failure",
      }),
    });

    expect(feedback.engineRecommendation).toMatchObject({
      dueOn: planningDate,
      intervalDays: 0,
      preparation: "reteach_before_retrieval",
    });
    expect(feedback.nextQueueEntry).toMatchObject({
      workKind: "reteaching",
      priority: "urgent",
      retryIntent: {
        earliestLocalTime: "15:30",
        retryNotBefore: "2026-07-28T15:30:00-04:00",
        status: "authorized-slot-ready",
        requiredPreparation: "reteach-before-retrieval",
      },
    });
    expect(feedback.canonicalReview.reteachingTrigger).toMatchObject({
      status: "triggered",
      basisEvidenceIds: ["evidence-failure"],
    });
  });

  it("returns an authoritative prerequisite gap as remediation before same-day retrieval", () => {
    const initial = initialRuntime();
    const retrievalAttempt = attempt({
      id: "attempt-prerequisite" as RetrievalAttempt["id"],
      correctCount: 4,
      evidenceId: evidenceId("evidence-prerequisite"),
    });
    const result = sessionResult(retrievalAttempt, {
      id: "result-prerequisite" as SessionResult["id"],
      recommendedNextAction: "prerequisite-remediation",
    });
    const prerequisite = skillId("skill-common-denominators");

    const feedback = applyCanonicalReviewResult({
      canonicalReview: initial.canonicalReview,
      queueEntries: initial.queueEntries,
      completedQueueEntryId: "queue-fractions-001",
      result,
      attempt: retrievalAttempt,
      progressState: { lastBaselineIndex: 3 },
      feedbackSignals: {
        confidence: 0.8,
        consecutiveSuccessfulRetrievals: 2,
        retrievalFailed: false,
        prerequisiteGap: true,
        reteachingOutcome: "not_needed",
      },
      nextQueueEntryId: "queue-fractions-prerequisite",
      nextSourceRecommendationId:
        "engine-recommendation-prerequisite",
      title: "Common denominator support",
      authorizedPriority: "urgent",
      estimatedMinutes: 12,
      prerequisiteSkillIds: [prerequisite],
      sameDayPolicy: {
        attemptOrdinal: 2,
        dailyAttemptLimit: 3,
        requiredSupportBoundaryRef: "boundary:prerequisite-session",
        completedPreparation: {
          kind: "prerequisite-remediation-completed",
          completedAt: "2026-07-28T19:05:00.000Z",
          evidenceRefs: ["evidence:prerequisite-support-completed"],
        },
        completedSupportBoundary: {
          ref: "boundary:prerequisite-session",
          kind: "break-completed",
          completedAt: "2026-07-28T19:10:00.000Z",
        },
        authorizedWindow: {
          provenance: {
            policyId: "policy:prerequisite-retry",
            policyVersion: 1,
            source: "adult-scheduled-slot",
            authorizationRef: "authorization:prerequisite-retry",
            authorizedByRole: "parent",
            authorizedAt: "2026-07-28T19:11:00.000Z",
          },
          householdTimeZone: learnerTimeZone,
          localDate: planningDate,
          retryNotBefore: "2026-07-28T15:45:00-04:00",
          latestLocalTime: "20:00",
        },
      },
      resultReturn: resultReturnRequest({
        commandId: "command:return-prerequisite",
        outboxId: "outbox:return-prerequisite",
        idempotencyKey: "idempotency:return-prerequisite",
      }),
    });

    expect(feedback.engineRecommendation.preparation).toBe(
      "address_prerequisite_before_retrieval",
    );
    expect(feedback.nextQueueEntry.workKind).toBe(
      "prerequisite-remediation",
    );
    expect(
      feedback.canonicalReview.prerequisiteRemediationTrigger,
    ).toMatchObject({
      status: "triggered",
      prerequisiteSkillIds: ["skill-common-denominators"],
      basisEvidenceIds: ["evidence-prerequisite"],
    });
  });

  it("deduplicates the memory-only result-return outbox and rejects conflicting replay bytes", () => {
    const value: ReviewResultReturnOutboxValue = {
      kind: "review-result-return-outbox",
      schemaVersion: 1,
      outboxId: "outbox:dedupe-001",
      idempotencyKey: "idempotency:dedupe-001",
      state: "pending",
      enqueuedAt: "2026-07-28T19:00:00.000Z",
      command: {
        kind: "review-result-return-command",
        schemaVersion: 1,
        commandId: "command:dedupe-001",
        idempotencyKey: "idempotency:dedupe-001",
        expectedReviewRevision: 1,
        canonicalReviewId: reviewId("review-fractions"),
        completedQueueEntryId: "queue-fractions-001",
        canonicalResultId: "result-review-001",
        sessionId: "session-review-001" as SessionResult["sessionId"],
        retrievalAttemptId:
          "attempt-001" as RetrievalAttempt["id"],
        evidenceId: evidenceId("evidence-retrieval-001"),
        reviewedOn: planningDate,
        recordedAt: "2026-07-28T19:00:00.000Z",
        engineEvidence: strongEvidence,
      },
    };
    const first = enqueueReviewResultReturn([], value);
    const replay = enqueueReviewResultReturn(first.outbox, value);

    expect(first.action).toBe("enqueued");
    expect(replay.action).toBe("idempotent");
    expect(replay.outbox).toStrictEqual(first.outbox);
    expect(replay.outbox).toHaveLength(1);

    expect(() =>
      enqueueReviewResultReturn(first.outbox, {
        ...value,
        command: {
          ...value.command,
          expectedReviewRevision: 2,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "identity-conflict",
      }),
    );
  });

  it("rejects a result that omits attempt evidence or contradicts a remediation action", () => {
    const initial = initialRuntime();
    const retrievalAttempt = attempt();

    expect(() =>
      applyCanonicalReviewResult({
        canonicalReview: initial.canonicalReview,
        queueEntries: initial.queueEntries,
        completedQueueEntryId: "queue-fractions-001",
        result: sessionResult(retrievalAttempt, { evidenceIds: [] }),
        attempt: retrievalAttempt,
        progressState: { lastBaselineIndex: 0 },
        feedbackSignals: {
          confidence: null,
          consecutiveSuccessfulRetrievals: 0,
          retrievalFailed: false,
          prerequisiteGap: false,
          reteachingOutcome: "not_needed",
        },
        nextQueueEntryId: "queue-next",
        nextSourceRecommendationId: "recommendation-next",
        title: "Review",
        authorizedPriority: "normal",
        estimatedMinutes: 5,
        sameDayPolicy: {
          cooldownMinutes: 30,
          latestLocalTime: "20:00",
        },
        resultReturn: resultReturnRequest(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "result-evidence-mismatch",
      }),
    );

    expect(() =>
      applyCanonicalReviewResult({
        canonicalReview: initial.canonicalReview,
        queueEntries: initial.queueEntries,
        completedQueueEntryId: "queue-fractions-001",
        result: sessionResult(retrievalAttempt, {
          recommendedNextAction: "prerequisite-remediation",
        }),
        attempt: retrievalAttempt,
        progressState: { lastBaselineIndex: 0 },
        feedbackSignals: {
          confidence: null,
          consecutiveSuccessfulRetrievals: 0,
          retrievalFailed: false,
          prerequisiteGap: false,
          reteachingOutcome: "not_needed",
        },
        nextQueueEntryId: "queue-next",
        nextSourceRecommendationId: "recommendation-next",
        title: "Review",
        authorizedPriority: "normal",
        estimatedMinutes: 5,
        sameDayPolicy: {
          cooldownMinutes: 30,
          latestLocalTime: "20:00",
        },
        resultReturn: resultReturnRequest(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewRuntimeError>>({
        code: "result-action-mismatch",
      }),
    );
  });

  it("exposes the aggregate-only DEC-009 independence adapter", () => {
    expect([
      card8IndependenceScore("independent"),
      card8IndependenceScore("minimal-support"),
      card8IndependenceScore("guided"),
      card8IndependenceScore("full-support"),
    ]).toEqual([1, 0.75, 0.5, 0]);
  });
});
