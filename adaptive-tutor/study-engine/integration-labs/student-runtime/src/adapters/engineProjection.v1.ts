import {
  STUDY_ENGINE_SCHEMA_VERSION,
  asBrandedId,
  type EvidenceId,
  type LearningEvidence,
  type ReviewId,
  type ReviewInterval,
  type SessionId,
  type StudentSkillReview,
  type SubjectId,
} from "@study-contracts";
import {
  calendarDateInTimeZone,
  classifyEvidence,
  recommendBreak,
  recommendFocusDuration,
  scheduleNextReview,
  type BreakRecord,
  type EvidenceAssessment,
  type FocusSessionEvidence,
  type ReviewRecommendation,
} from "@study-engine";
// @ts-expect-error -- the verified Card 5 reconciliation policy is JavaScript
// and intentionally ships without declaration metadata.
import * as card5Runtime from "../../../../reconciliation/probes/policy.mjs";
import {
  canonicalSegmentId,
  idsFor,
  LEARNER_REFERENCE,
  LEARNER_TIME_ZONE,
} from "../catalog";
import type {
  ParentPreferenceInputV1,
  ReflectionState,
  ResolvedDurationPolicy,
  RuntimeSubjectId,
  RuntimeWorkspaceV1,
} from "../runtimeTypes";

export const ENGINE_PROJECTION_VERSION =
  "student-runtime.engine-projection.v2" as const;
export const COMPARABLE_FOCUS_HISTORY_VERSION =
  "student-runtime.comparable-focus-history.v1" as const;
export const CARD5_DURATION_POLICY_VERSION =
  "card5.resolve-duration-policy.v1" as const;

const GRADE_DEFAULT_MINUTES = 15;
const SAFETY_MINIMUM_MINUTES = 1;
const SAFETY_LIMIT_MINUTES = 30;
const MAXIMUM_FOCUS_INCREASE_RATIO = 0.1;

const {
  POLICY_VERSION: CARD5_RUNTIME_POLICY_VERSION,
  resolveDurationPolicy: resolveCard5RuntimePolicy,
} = card5Runtime as {
  readonly POLICY_VERSION: number;
  readonly resolveDurationPolicy: (input: unknown) => unknown;
};

export interface AcceptedEngineDurationRecommendationV1 {
  readonly targetMinutes: number;
  /**
   * Card 5 keeps an engine recommendation ineligible until a decision accepts
   * that specific recommendation.
   */
  readonly accepted: boolean;
  /**
   * This gate must be computed from comparable, reliable sessions. A numeric
   * target on its own never proves that the evidence threshold was met.
   */
  readonly evidenceSufficient: boolean;
}

/**
 * A privacy-minimized, explicitly sourced history record.
 *
 * The Session 2 focus algorithm deliberately has no learner identity field.
 * Canonical session/evidence IDs are used only here for deduplication and are
 * stripped before the record crosses into the algorithm.
 */
export interface ComparableFocusHistoryRecordV1 {
  readonly sessionId: SessionId;
  readonly evidenceId: EvidenceId;
  readonly subjectId: SubjectId;
  readonly taskType: "lesson-cycle";
  readonly occurredAt: string;
  readonly plannedDurationMinutes: number;
  readonly completedDurationMinutes: number;
  readonly coreOutcome: FocusSessionEvidence["coreOutcome"];
  readonly durationResponse: FocusSessionEvidence["durationResponse"];
  readonly disruption: FocusSessionEvidence["disruption"];
  readonly quality: FocusSessionEvidence["quality"];
  readonly coreOutcomeAuthority: "verified-tutor-core";
  readonly durationEvidenceAuthority:
    | "canonical-session"
    | "canonical-session-and-learner-report";
  readonly manualReviewRequested?: boolean;
}

export interface ComparableFocusHistoryV1 {
  readonly schemaVersion: typeof COMPARABLE_FOCUS_HISTORY_VERSION;
  readonly records: readonly ComparableFocusHistoryRecordV1[];
}

type Card5CandidateSource =
  | "manual-override"
  | "accepted-engine-recommendation"
  | "established-target"
  | "grade-band-default";

type Card5RawResult =
  | {
      readonly status: "resolved";
      readonly reasonCode: "policy.resolved";
      readonly source: Card5CandidateSource;
      readonly candidateMinutes: number;
      readonly targetMinutes: number;
      readonly lowerBound: number;
      readonly upperBound: number;
      readonly applied: readonly string[];
    }
  | {
      readonly status: "manual-review";
      readonly reasonCode:
        | "policy.safety-veto"
        | "policy.infeasible-constraints";
      readonly targetMinutes: null;
      readonly lowerBound: number;
      readonly upperBound: number;
      readonly applied: readonly string[];
    }
  | {
      readonly status: "quarantine";
      readonly reasonCode: string;
      readonly targetMinutes: null;
    };

function boundedRating(value: string | undefined, mapping: Record<string, 1 | 2 | 3 | 4 | 5>) {
  return value === undefined ? undefined : mapping[value];
}

function confidenceRating(reflection: ReflectionState) {
  return boundedRating(reflection.confidence, {
    "not-yet": 1,
    "getting-there": 3,
    ready: 5,
  });
}

function effortRating(reflection: ReflectionState) {
  return boundedRating(reflection.effort, {
    light: 2,
    steady: 4,
    "a-lot": 5,
  });
}

function frustrationRating(reflection: ReflectionState) {
  return boundedRating(reflection.frustration, {
    calm: 1,
    some: 3,
    high: 5,
  });
}

export function resolveDurationPolicy(
  preferences: ParentPreferenceInputV1,
  engineRecommendation?: AcceptedEngineDurationRecommendationV1,
  establishedTargetMinutes?: number,
): ResolvedDurationPolicy {
  const positiveFinite = (value: number | undefined): value is number =>
    value !== undefined && Number.isFinite(value) && value > 0;
  const breakMinimum = positiveFinite(preferences.breakRange.minimumMinutes)
    ? preferences.breakRange.minimumMinutes
    : SAFETY_MINIMUM_MINUTES;
  const breakMaximum = positiveFinite(preferences.breakRange.maximumMinutes)
    ? Math.max(breakMinimum, preferences.breakRange.maximumMinutes)
    : breakMinimum;
  const breakCandidate = positiveFinite(preferences.breakRange.defaultMinutes)
    ? preferences.breakRange.defaultMinutes
    : breakMinimum;
  const breakMinutes = Math.min(
    breakMaximum,
    Math.max(breakMinimum, breakCandidate),
  );
  const hasAccommodationMaximum =
    preferences.accommodationMaximumMinutes !== undefined;
  const hasManualOverride =
    preferences.parentManualOverrideMinutes !== undefined;
  const engineCandidateIsEligible =
    engineRecommendation?.accepted === true &&
    engineRecommendation.evidenceSufficient === true;
  const invalidInput =
    !positiveFinite(preferences.maximumDurationMinutes) ||
    (hasAccommodationMaximum &&
      !positiveFinite(preferences.accommodationMaximumMinutes)) ||
    (hasManualOverride &&
      !positiveFinite(preferences.parentManualOverrideMinutes)) ||
    (engineCandidateIsEligible &&
      !positiveFinite(engineRecommendation.targetMinutes)) ||
    (establishedTargetMinutes !== undefined &&
      !positiveFinite(establishedTargetMinutes));
  const fallbackUpper = Math.max(
    SAFETY_MINIMUM_MINUTES,
    Math.min(
      SAFETY_LIMIT_MINUTES,
      positiveFinite(preferences.maximumDurationMinutes)
        ? preferences.maximumDurationMinutes
        : SAFETY_LIMIT_MINUTES,
      positiveFinite(preferences.accommodationMaximumMinutes)
        ? preferences.accommodationMaximumMinutes
        : SAFETY_LIMIT_MINUTES,
    ),
  );
  const fallbackTarget = Math.min(
    fallbackUpper,
    Math.max(
      SAFETY_MINIMUM_MINUTES,
      positiveFinite(establishedTargetMinutes)
        ? establishedTargetMinutes
        : GRADE_DEFAULT_MINUTES,
    ),
  );
  const gateReasons = [
    "supported-version",
    "integrity-verified",
    "actor-authorized",
    "safety-limit",
    ...(hasAccommodationMaximum ? ["required-accommodation"] : []),
    "parent-hard-maximum",
  ] as const;

  let raw: Card5RawResult;
  if (CARD5_RUNTIME_POLICY_VERSION !== 1 || invalidInput) {
    raw = {
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      targetMinutes: null,
      lowerBound: SAFETY_MINIMUM_MINUTES,
      upperBound: invalidInput ? 0 : fallbackUpper,
      applied: ["constraint-intersection-empty"],
    };
  } else {
    const recommendationState =
      engineRecommendation?.accepted === true &&
      engineRecommendation.evidenceSufficient === true
        ? "accepted"
        : "rejected";
    raw = resolveCard5RuntimePolicy({
      policyVersion: CARD5_RUNTIME_POLICY_VERSION,
      integrityValid: true,
      actorAuthorized: true,
      safety: {
        minimumMinutes: SAFETY_MINIMUM_MINUTES,
        maximumMinutes: SAFETY_LIMIT_MINUTES,
      },
      accommodations: hasAccommodationMaximum
        ? [
            {
              active: true,
              maximumMinutes: preferences.accommodationMaximumMinutes,
            },
          ]
        : [],
      adultHardMaximums: [
        {
          active: true,
          minutes: preferences.maximumDurationMinutes,
        },
      ],
      ...(hasManualOverride
        ? {
            manualOverride: {
              active: true,
              mode: "target",
              targetMinutes: preferences.parentManualOverrideMinutes,
            },
          }
        : {}),
      ...(engineRecommendation === undefined
        ? {}
        : {
            recommendation: {
              state: recommendationState,
              targetMinutes: engineRecommendation.targetMinutes,
            },
          }),
      ...(establishedTargetMinutes === undefined
        ? {}
        : { establishedTargetMinutes }),
      currentMinutes: establishedTargetMinutes ?? GRADE_DEFAULT_MINUTES,
      gradeBandDefaultMinutes: GRADE_DEFAULT_MINUTES,
    }) as Card5RawResult;
  }

  if (raw.status !== "resolved") {
    return {
      precedenceVersion: CARD5_DURATION_POLICY_VERSION,
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      targetMinutes: fallbackTarget,
      hardMaximumMinutes: fallbackUpper,
      breakMinutes,
      candidateSource: "manual-review",
      feasibleMinimumMinutes:
        "lowerBound" in raw ? raw.lowerBound : SAFETY_MINIMUM_MINUTES,
      feasibleMaximumMinutes: "upperBound" in raw ? raw.upperBound : 0,
      appliedReasonCodes: [
        ...gateReasons,
        "infeasible-constraints",
      ],
      provisionalUntilCard5: false,
    };
  }

  const candidateSource =
    raw.source === "manual-override"
      ? "parent-manual-override"
      : raw.source;
  const sourceReason =
    candidateSource === "parent-manual-override"
      ? "parent-manual-override"
      : candidateSource;
  return {
    precedenceVersion: CARD5_DURATION_POLICY_VERSION,
    status: "resolved",
    reasonCode: raw.reasonCode,
    targetMinutes: raw.targetMinutes,
    automaticTargetMinutes: raw.targetMinutes,
    hardMaximumMinutes: raw.upperBound,
    breakMinutes,
    candidateSource,
    candidateMinutes: raw.candidateMinutes,
    feasibleMinimumMinutes: raw.lowerBound,
    feasibleMaximumMinutes: raw.upperBound,
    appliedReasonCodes: [
      ...gateReasons,
      sourceReason,
      ...(raw.applied.includes("hard-clamp") ? (["hard-clamp"] as const) : []),
    ],
    provisionalUntilCard5: false,
  };
}

function comparableFocusSessions(
  history: ComparableFocusHistoryV1 | undefined,
  currentSessionId: SessionId,
): readonly FocusSessionEvidence[] {
  if (history?.schemaVersion !== COMPARABLE_FOCUS_HISTORY_VERSION) {
    return [];
  }

  const sessionCounts = new Map<string, number>();
  for (const record of history.records) {
    sessionCounts.set(
      record.sessionId,
      (sessionCounts.get(record.sessionId) ?? 0) + 1,
    );
  }

  return history.records
    .filter(
      (record) =>
        record.sessionId !== currentSessionId &&
        sessionCounts.get(record.sessionId) === 1 &&
        record.coreOutcomeAuthority === "verified-tutor-core" &&
        (record.durationEvidenceAuthority === "canonical-session" ||
          record.durationEvidenceAuthority ===
            "canonical-session-and-learner-report"),
    )
    .map(
      (record): FocusSessionEvidence => ({
        occurredAtEpochMs: Date.parse(record.occurredAt),
        subject: record.subjectId,
        taskType: record.taskType,
        plannedDurationMinutes: record.plannedDurationMinutes,
        completedDurationMinutes: record.completedDurationMinutes,
        coreOutcome: record.coreOutcome,
        durationResponse: record.durationResponse,
        disruption: record.disruption,
        quality: record.quality,
        ...(record.manualReviewRequested === undefined
          ? {}
          : { manualReviewRequested: record.manualReviewRequested }),
      }),
    );
}

export function projectFocusRecommendation(
  workspace: RuntimeWorkspaceV1,
  at: string,
  comparableHistory?: ComparableFocusHistoryV1,
) {
  const currentMinutes = workspace.durationPolicy.targetMinutes;
  const breakCount = workspace.canonicalSession.eventLog.filter(
    (event) => event.type === "break-started",
  ).length;
  const currentEvidence: FocusSessionEvidence = {
    occurredAtEpochMs: Date.parse(at),
    subject: idsFor(workspace.subjectId).subjectId,
    taskType: "lesson-cycle",
    plannedDurationMinutes: currentMinutes,
    completedDurationMinutes: Math.max(
      0,
      Math.min(
        currentMinutes,
        Math.round(
          "elapsedActiveSeconds" in workspace.canonicalSession
            ? workspace.canonicalSession.elapsedActiveSeconds / 60
            : 0,
        ),
      ),
    ),
    // The temporary Session 6 continue/reteach receipt is a demo flow
    // directive. It cannot establish the Core-owned academic outcome.
    coreOutcome: "inconclusive",
    durationResponse: "unknown",
    disruption:
      workspace.technicalInterruptionCount > 0
        ? "technical_issue"
        : breakCount > 0
          ? "approved_break"
          : "none",
    quality: workspace.technicalInterruptionCount > 0 ? "limited" : "reliable",
  };
  return recommendFocusDuration({
    gradeBand: "elementary",
    subject: idsFor(workspace.subjectId).subjectId,
    taskType: "lesson-cycle",
    currentDurationMinutes: currentMinutes,
    sessions: [
      ...comparableFocusSessions(
        comparableHistory,
        workspace.canonicalSession.id,
      ),
      currentEvidence,
    ],
    parentOverride: {
      mode:
        "status" in workspace.durationPolicy &&
        workspace.durationPolicy.status === "manual-review"
          ? "manual_review"
          : "automatic",
      maximumDurationMinutes: workspace.durationPolicy.hardMaximumMinutes,
      allowIncrease: true,
    },
    policy: {
      maximumIncreaseRatio: MAXIMUM_FOCUS_INCREASE_RATIO,
      durationCapsMinutes: {
        elementary: workspace.durationPolicy.hardMaximumMinutes,
      },
    },
  });
}

export function projectBreakRecommendation(
  workspace: RuntimeWorkspaceV1,
  requestedType: "water" | "movement" | "screen_rest" | "quiet_reset" = "water",
) {
  const elapsedMinutes =
    "elapsedActiveSeconds" in workspace.canonicalSession
      ? workspace.canonicalSession.elapsedActiveSeconds / 60
      : 0;
  const completedBreakEvents = workspace.canonicalSession.eventLog.filter(
    (event) => event.type === "break-ended",
  );
  const history: readonly BreakRecord[] = completedBreakEvents.map(() => ({
    type: requestedType,
    // Card 1 preserves approved break lifecycle but not an active-minute
    // timestamp per break. Use the canonical aggregate's current active minute;
    // never manufacture a spaced sequence from array position.
    endedAtSessionMinute: elapsedMinutes,
    approved: true,
  }));
  return recommendBreak({
    blockElapsedMinutes: elapsedMinutes,
    sessionElapsedMinutes: elapsedMinutes,
    studentRequest: { type: requestedType },
    history,
    policy: {
      plannedBlockMinutes: workspace.durationPolicy.targetMinutes,
      defaultBreakMinutes: workspace.durationPolicy.breakMinutes,
      movementBreakMinutes: workspace.durationPolicy.breakMinutes,
      waterBreakMinutes: Math.max(
        workspace.parentPreferences.breakRange.minimumMinutes,
        Math.min(3, workspace.parentPreferences.breakRange.maximumMinutes),
      ),
      screenRestMinutes: workspace.durationPolicy.breakMinutes,
      quietResetMinutes: workspace.durationPolicy.breakMinutes,
      maxTotalBreakMinutes: Math.max(
        workspace.durationPolicy.breakMinutes,
        workspace.parentPreferences.breakRange.maximumMinutes,
      ),
      maxSessionMinutes: workspace.durationPolicy.hardMaximumMinutes,
      repeatedBreakThreshold: 3,
    },
  });
}

export function assessRuntimeEvidence(
  workspace: RuntimeWorkspaceV1,
): EvidenceAssessment {
  const canonicalResponses = workspace.canonicalSession.eventLog.filter(
    (event) => event.type === "active-response-recorded",
  ).length;
  const technicalCount = workspace.technicalInterruptionCount;
  const breakCount = workspace.canonicalSession.eventLog.filter(
    (event) => event.type === "break-started",
  ).length;
  return classifyEvidence({
    attempts: canonicalResponses,
    completedAttempts: canonicalResponses,
    confidenceChecks: workspace.reflection.confidence ? 1 : 0,
    averageConfidence: confidenceRating(workspace.reflection)
      ? confidenceRating(workspace.reflection)! / 5
      : undefined,
    fatigueReported: false,
    frustrationReported: frustrationRating(workspace.reflection) === 5,
    // One effort check is a report, not a longitudinal effort pattern.
    effortPattern: "unknown",
    // The temporary bridge does not provide timing evidence for random-answer
    // classification, so the adapter cannot assert a considered pattern.
    answerPattern: "unknown",
    technicalIssueCount: technicalCount,
    approvedBreakCount: breakCount,
  });
}

export function buildCanonicalEvidence(
  workspace: RuntimeWorkspaceV1,
  at: string,
): LearningEvidence {
  const ids = idsFor(workspace.subjectId);
  const evidenceId = asBrandedId<EvidenceId>(
    `evidence:${workspace.canonicalSession.id}:summary:v1`,
  );
  const confidence = confidenceRating(workspace.reflection);
  const effort = effortRating(workspace.reflection);
  const frustration = frustrationRating(workspace.reflection);
  const assessment = assessRuntimeEvidence(workspace);
  const completedCanonical = new Set(
    workspace.canonicalSession.eventLog
      .filter((event) => event.type === "segment-completed")
      .map((event) => event.segmentId),
  );
  return {
    kind: "learning-evidence",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: evidenceId,
    revision: 1,
    createdAt: at,
    updatedAt: at,
    metadata: {
      source: "adaptive-engine",
      tags: ["student-runtime", "aggregate-only"],
      extensions: {
        "manuel:projection-version": ENGINE_PROJECTION_VERSION,
        "manuel:raw-answer-omitted": true,
        "manuel:pii-omitted": true,
        "manuel:tutor-core-authority": "withheld-pending-tutor-core",
      },
    },
    studentId: LEARNER_REFERENCE,
    sessionId: workspace.canonicalSession.id,
    subjectId: ids.subjectId,
    skillIds: [ids.skillId],
    capturedAt: at,
    completion: {
      completedCount: completedCanonical.size,
      assignedCount: workspace.plan.segmentSequence.length,
      completionPercent: Math.round(
        (completedCanonical.size / workspace.plan.segmentSequence.length) * 100,
      ),
    },
    ...(confidence
      ? { confidence: { rating: confidence, source: "student-report", observedAt: at } }
      : {}),
    ...(effort
      ? { effort: { rating: effort, source: "student-report", observedAt: at } }
      : {}),
    ...(frustration
      ? { frustration: { rating: frustration, source: "student-report", observedAt: at } }
      : {}),
    engagementSupport: {
      status:
        assessment.conclusion === "possible"
          ? "support-may-help"
          : "insufficient-evidence",
      supportingSignals:
        assessment.conclusion !== "possible"
          ? []
          : assessment.category === "Technical issue"
            ? ["technical-context"]
            : assessment.category === "Low confidence" ||
                assessment.category === "Frustration"
              ? ["student-report"]
              : [],
      wording: "contextual-and-revisable",
    },
  };
}

function intervalFromDays(days: number): ReviewInterval {
  if (days === 0) return { id: "same-day", days: 0 };
  if (days === 1) return { id: "one-day", days: 1 };
  if (days === 3) return { id: "three-day", days: 3 };
  if (days === 7) return { id: "seven-day", days: 7 };
  if (days === 14) return { id: "fourteen-day", days: 14 };
  if (days === 30) return { id: "thirty-day", days: 30 };
  return { id: "custom", days };
}

export function createReviewRecommendation(
  workspace: RuntimeWorkspaceV1,
  at: string,
): ReviewRecommendation {
  const confidence = confidenceRating(workspace.reflection);
  return scheduleNextReview({
    reviewedOn: calendarDateInTimeZone(at, LEARNER_TIME_ZONE),
    state: { lastBaselineIndex: -1 },
    evidence: {
      // The local Session 6 bridge has no verified correctness,
      // independence, prerequisite, or reteaching authority.
      retrievalAccuracy: null,
      independence: null,
      confidence: confidence ? confidence / 5 : null,
      consecutiveSuccessfulRetrievals: 0,
      retrievalFailed: false,
      prerequisiteGap: false,
      reteachingOutcome: "not_observed",
    },
  });
}

export function buildCanonicalReview(
  workspace: RuntimeWorkspaceV1,
  evidence: LearningEvidence,
  recommendation: ReviewRecommendation,
  at: string,
): StudentSkillReview {
  const ids = idsFor(workspace.subjectId);
  const reviewId = asBrandedId<ReviewId>(
    `review:${workspace.canonicalSession.id}:${workspace.subjectId}:v1`,
  );
  return {
    kind: "student-skill-review",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: reviewId,
    revision: 1,
    createdAt: at,
    updatedAt: at,
    metadata: {
      source: "adaptive-engine",
      tags: ["student-runtime", "learner-local-date"],
      extensions: {
        "manuel:projection-version": ENGINE_PROJECTION_VERSION,
        "manuel:raw-answer-omitted": true,
        "manuel:pii-omitted": true,
        "manuel:tutor-core-authority": "withheld-pending-tutor-core",
        "manuel:aggregate-evidence-ref": evidence.id,
        "manuel:learner-local-reviewed-on": recommendation.reviewedOn,
      },
    },
    studentId: LEARNER_REFERENCE,
    subjectId: ids.subjectId,
    skillId: ids.skillId,
    timeZone: LEARNER_TIME_ZONE,
    // A flow directive is not a scored retrieval result. The verified Tutor
    // Core bridge will append a retrieval attempt after it supplies the
    // authoritative counts and support level.
    retrievalAttempts: [],
    currentInterval: intervalFromDays(recommendation.intervalDays),
    nextReviewDate: recommendation.dueOn,
    intervalAdjustments: [],
  };
}

export function exitSegmentId(subjectId: RuntimeSubjectId) {
  return canonicalSegmentId(subjectId, "exit-ticket");
}
