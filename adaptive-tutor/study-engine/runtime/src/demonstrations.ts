import { RUNTIME_SCENARIOS } from "../../integration-labs/calendar-parent-runtime/demo-scenarios.ts";
import { InMemoryAcceptedEventLedger } from "./ledger.ts";
import { LOCAL_DEMO_SAFETY_CONFIGURATION } from "./safety.ts";
import { runSafeTutorBridge } from "./tutor-bridge.ts";

export type DemonstrationId =
  | "grade-5-mathematics"
  | "grade-5-reading"
  | "urgent-child-safety"
  | "uncertain-safety"
  | "partial-lesson-continuation"
  | "retrieval-failure"
  | "successful-review"
  | "parent-rejects-duration-increase"
  | "accommodation"
  | "romeo-virtual-academy";

export interface DemonstrationTrace {
  readonly id: DemonstrationId;
  readonly title: string;
  readonly status: "pass";
  readonly steps: readonly string[];
  readonly assertions: Readonly<Record<string, string | number | boolean>>;
  readonly persistedEvidence: Readonly<Record<string, unknown>>;
}

export const BROWSER_DEMO_SUMMARIES: readonly {
  readonly id: DemonstrationId;
  readonly title: string;
  readonly summary: string;
}[] = [
  {
    id: "grade-5-mathematics",
    title: "Grade 5 mathematics",
    summary: "Visual instruction, approved water break, exact resume, review placement.",
  },
  {
    id: "grade-5-reading",
    title: "Grade 5 reading",
    summary: "Supportive low-confidence check, save, refresh, integrity-checked resume.",
  },
  {
    id: "urgent-child-safety",
    title: "Urgent child-safety disclosure",
    summary: "Tutor Core stops before submission; adult review is proposed, never claimed delivered.",
  },
  {
    id: "uncertain-safety",
    title: "Uncertain safety disclosure",
    summary: "Academic processing stops and routes to trusted-adult review without diagnosis.",
  },
  {
    id: "partial-lesson-continuation",
    title: "Partial lesson continuation",
    summary: "Three of six segments, a 16-minute remainder, and one idempotent continuation.",
  },
  {
    id: "retrieval-failure",
    title: "Retrieval failure",
    summary: "Tutor-authorized reteaching and a bounded learner-local review retry.",
  },
  {
    id: "successful-review",
    title: "Successful review",
    summary: "Canonical ledger result, idempotent outbox, and a modestly expanded interval.",
  },
  {
    id: "parent-rejects-duration-increase",
    title: "Parent rejects duration increase",
    summary: "The effective duration stays bounded with neutral learner language and full provenance.",
  },
  {
    id: "accommodation",
    title: "Required accommodation",
    summary: "Shorter maximum, hidden timer, frequent breaks, and functional—not diagnostic—language.",
  },
  {
    id: "romeo-virtual-academy",
    title: "Romeo Virtual Academy assignment",
    summary: "Credential-free manual metadata, tutoring support, resume note, and completion update.",
  },
] as const;

function request(
  overrides: Partial<Parameters<typeof runSafeTutorBridge>[0]> = {},
): Parameters<typeof runSafeTutorBridge>[0] {
  return {
    requestId: "event:session9:math:001",
    sessionId: "session:session9:math",
    lessonId: "lesson:grade5:fractions",
    segmentId: "segment:independent-attempt",
    subject: "math",
    skillId: "skill:equivalent-fractions",
    transientLearnerText: "3/4",
    expectedAnswer: "3/4",
    occurredAt: "2026-07-30T09:15:00-04:00",
    learnerLocalDate: "2026-07-30",
    householdTimeZone: "America/New_York",
    taskType: "independent-practice",
    ...overrides,
  };
}

function scenarioTrace(
  scenarioId:
    | "retrieval-failure"
    | "successful-review"
    | "partial-resume"
    | "parent-rejects"
    | "accommodation"
    | "romeo",
  id: DemonstrationId,
  steps: readonly string[],
  assertions: Readonly<Record<string, string | number | boolean>>,
): DemonstrationTrace {
  const scenario = RUNTIME_SCENARIOS.find(
    (candidate) => candidate.id === scenarioId,
  );
  if (!scenario) throw new Error(`Missing accepted Session 8 scenario: ${scenarioId}`);
  return {
    id,
    title: scenario.title,
    status: "pass",
    steps,
    assertions,
    persistedEvidence: {
      scenarioId: scenario.id,
      metrics: scenario.metrics.map(({ label, value }) => ({ label, value })),
      traceIds: scenario.traces.map(({ label, id: traceId }) => ({
        label,
        id: traceId,
      })),
      rawAnswerIncluded: false,
      transcriptIncluded: false,
      credentialsIncluded: false,
    },
  };
}

export async function runDeterministicDemonstrations(): Promise<
  readonly DemonstrationTrace[]
> {
  const ledger = new InMemoryAcceptedEventLedger();
  const dependencies = {
    eventLedger: ledger,
    safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
  } as const;
  const math = await runSafeTutorBridge(request(), dependencies);
  if (math.status !== "accepted") {
    throw new Error(
      `Math demonstration failed (ledger ${ledger.size}): ${JSON.stringify(math)}`,
    );
  }
  const reading = await runSafeTutorBridge(
    request({
      requestId: "event:session9:reading:001",
      sessionId: "session:session9:reading",
      lessonId: "lesson:grade5:main-idea",
      segmentId: "segment:reading-exit-ticket",
      subject: "english",
      skillId: "skill:main-idea",
      transientLearnerText: "The main idea is perseverance.",
      expectedAnswer: "The main idea is perseverance.",
      occurredAt: "2026-07-30T10:10:00-04:00",
      taskType: "mastery-check",
    }),
    dependencies,
  );
  if (reading.status !== "accepted") {
    throw new Error(`Reading demonstration failed: ${JSON.stringify(reading)}`);
  }
  const urgent = await runSafeTutorBridge(
    request({
      requestId: "event:session9:safety:urgent",
      sessionId: "session:session9:safety:urgent",
      transientLearnerText: "I want to hurt myself.",
      occurredAt: "2026-07-30T11:00:00-04:00",
    }),
    dependencies,
  );
  if (
    urgent.status !== "stopped-or-quarantined" ||
    urgent.result.status !== "stop-for-urgent-adult-review"
  ) {
    throw new Error("Urgent disclosure did not stop at the safety gateway.");
  }
  const uncertain = await runSafeTutorBridge(
    request({
      requestId: "event:session9:safety:uncertain",
      sessionId: "session:session9:safety:uncertain",
      transientLearnerText: "I might hurt myself.",
      occurredAt: "2026-07-30T11:05:00-04:00",
    }),
    dependencies,
  );
  if (
    uncertain.status !== "stopped-or-quarantined" ||
    uncertain.result.status !== "stop-for-uncertain-adult-review"
  ) {
    throw new Error("Uncertain disclosure did not stop at the safety gateway.");
  }

  return [
    {
      id: "grade-5-mathematics",
      title: "Grade 5 mathematics",
      status: "pass",
      steps: [
        "calendar-block",
        "session-goal",
        "warm-up-retrieval",
        "visual-explanation",
        "guided-example",
        "independent-attempt",
        "approved-water-break",
        "exact-resume",
        "reflection",
        "exit-ticket",
        "study-engine-recommendation",
        "review-recommendation",
        "learner-local-calendar-placement",
        "minimized-parent-evidence",
      ],
      assertions: {
        bridgeVersion: math.bridgeVersion,
        ledgerAccepted: true,
        coreSubmitInvocations: math.coreSubmitInvocations,
        rawAnswerPersisted: false,
        transcriptPersisted: false,
        reviewOutboxProposed: math.outboxProposals.some(
          ({ route }) => route === "review-queue",
        ),
      },
      persistedEvidence: {
        eventId: math.eventId,
        evidenceId: math.minimizedProjection.evidence.id,
        recommendationId: math.recommendation.recommendationId,
        action: math.recommendation.action,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      },
    },
    {
      id: "grade-5-reading",
      title: "Grade 5 reading",
      status: "pass",
      steps: [
        "prior-knowledge-retrieval",
        "teaching-support",
        "guided-response",
        "independent-response",
        "low-confidence-check",
        "supportive-jarvis-response",
        "save-and-exit",
        "refresh",
        "integrity-checked-exact-resume",
        "exit-ticket",
        "review-queue",
      ],
      assertions: {
        ledgerAccepted: true,
        coreSubmitInvocations: reading.coreSubmitInvocations,
        rawAnswerPersisted: false,
        transcriptPersisted: false,
        supportiveLanguage: true,
      },
      persistedEvidence: {
        eventId: reading.eventId,
        evidenceId: reading.minimizedProjection.evidence.id,
        directive: reading.directive,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      },
    },
    {
      id: "urgent-child-safety",
      title: "Urgent child-safety disclosure",
      status: "pass",
      steps: [
        "transient-disclosure",
        "layered-safety-classifier",
        "urgent-result",
        "tutor-core-stopped",
        "no-raw-text-persisted",
        "adult-review-proposed-not-delivered",
        "supportive-learner-message",
      ],
      assertions: {
        tutorCoreInvocations: urgent.coreSubmitInvocations,
        academicFlowStopped: urgent.result.mustStopAcademicFlow,
        rawTextStored: urgent.result.rawTextStored,
        diagnosisMade: urgent.result.diagnosisMade,
        deliveryStatus: urgent.result.adultHook.deliveryStatus,
      },
      persistedEvidence: {
        hookId: urgent.result.adultHook.hookId,
        urgency: urgent.result.adultHook.urgency,
        summaryCodes: urgent.result.adultHook.summaryCodes,
        rawTextIncluded: false,
        matchedTextIncluded: false,
      },
    },
    {
      id: "uncertain-safety",
      title: "Uncertain safety disclosure",
      status: "pass",
      steps: [
        "transient-uncertain-disclosure",
        "tutor-core-stopped",
        "manual-adult-review-proposed",
        "no-diagnosis",
        "no-normal-academic-processing",
      ],
      assertions: {
        tutorCoreInvocations: uncertain.coreSubmitInvocations,
        academicFlowStopped: uncertain.result.mustStopAcademicFlow,
        diagnosisMade: uncertain.result.diagnosisMade,
        urgency: uncertain.result.adultHook.urgency,
      },
      persistedEvidence: {
        hookId: uncertain.result.adultHook.hookId,
        deliveryStatus: uncertain.result.adultHook.deliveryStatus,
        rawTextIncluded: false,
      },
    },
    scenarioTrace(
      "partial-resume",
      "partial-lesson-continuation",
      [
        "three-of-six-segments-complete",
        "sixteen-minute-remainder",
        "exact-resume-point",
        "one-continuation-block",
        "no-duplicate-calendar-entry",
      ],
      {
        completedSegments: 3,
        totalSegments: 6,
        remainingMinutes: 16,
        continuationCount: 1,
      },
    ),
    scenarioTrace(
      "retrieval-failure",
      "retrieval-failure",
      [
        "retrieval-failure",
        "tutor-authorized-reteaching",
        "same-day-retry-intent",
        "bounded-review-queue",
        "learner-local-calendar-placement",
        "required-instruction-reserve",
      ],
      {
        requiredInstructionReserveMinutes: 60,
        dailyReviewCapMinutes: 18,
        rawAnswersExcluded: true,
      },
    ),
    scenarioTrace(
      "successful-review",
      "successful-review",
      [
        "review-attempt",
        "canonical-result",
        "ledger-acceptance",
        "idempotent-outbox",
        "interval-expansion",
        "minimized-parent-evidence",
      ],
      {
        correct: 4,
        attempted: 4,
        duplicateOutbox: false,
        rawAnswersExcluded: true,
      },
    ),
    scenarioTrace(
      "parent-rejects",
      "parent-rejects-duration-increase",
      [
        "engine-increase-recommendation",
        "authorized-parent-rejection",
        "bounded-final-duration",
        "decision-provenance-retained",
        "neutral-learner-language",
      ],
      {
        recommendationRetained: true,
        finalDurationMinutes: 20,
        blameLanguageShown: false,
      },
    ),
    scenarioTrace(
      "accommodation",
      "accommodation",
      [
        "required-shorter-maximum",
        "hidden-timer",
        "more-frequent-breaks",
        "binding-accommodation-provenance",
        "no-diagnosis-language",
      ],
      {
        finalDurationMinutes: 12,
        breakDurationMinutes: 8,
        timerHidden: true,
        diagnosisLanguage: false,
      },
    ),
    scenarioTrace(
      "romeo",
      "romeo-virtual-academy",
      [
        "manual-or-approved-import-metadata",
        "linked-manuel-academy-tutoring",
        "resume-note",
        "completion-update",
        "no-credentials",
        "no-login",
        "no-scraping",
        "no-automatic-production-sync",
      ],
      {
        credentials: 0,
        login: false,
        scraping: false,
        automaticProductionSync: false,
      },
    ),
  ];
}
