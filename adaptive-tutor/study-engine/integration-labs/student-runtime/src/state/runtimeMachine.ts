import {
  STUDY_ENGINE_SCHEMA_VERSION,
  asBrandedId,
  inspectContractVersion,
  type ActiveStudySession,
  type EvidenceId,
  type InterruptionId,
  type SegmentId,
  type SessionId,
} from "@study-contracts";
import {
  validateLearningEvidence,
  validateLessonStudyPlan,
  validateParentTeacherControls,
  validateStudentFocusProfile,
  validateStudentSkillReview,
  validateStudySession,
} from "@study-schemas";
import { inspectCoachLanguage } from "@study-engine";
import { renderJarvisPrompt } from "@study-prompts";
import {
  SESSION_DEFINITIONS,
  getNextSegment,
  type LearningSegmentId,
} from "@study-content";
import {
  buildControls,
  buildFocusProfile,
  buildLessonPlan,
  CANONICAL_SEGMENT_SEQUENCE,
  canonicalSegmentId,
  defaultParentPreferences,
  demoSessionIdFor,
  idsFor,
  LEARNER_TIME_ZONE,
  requireIanaTimeZone,
  UI_SEGMENT_SEQUENCE,
} from "../catalog";
import {
  LEARNER_ACTIONS,
  type LearnerAction,
} from "../adapters/uiActionVocabulary.v2";
import {
  assessRuntimeEvidence,
  buildCanonicalEvidence,
  buildCanonicalReview,
  createReviewRecommendation,
  projectBreakRecommendation,
  projectFocusRecommendation,
  resolveDurationPolicy,
  type AcceptedEngineDurationRecommendationV1,
} from "../adapters/engineProjection.v1";
import {
  ACCEPTED_STUDY_CORE_BRIDGE_VERSION,
  runAcceptedStudyCoreBridge,
} from "../bridges/acceptedStudyCoreBridge";
import type {
  CanonicalUiSegmentId,
  ParentPreferenceInputV1,
  ReflectionField,
  RuntimeDiagnostic,
  RuntimeIdempotencyRecord,
  RuntimeScreen,
  RuntimeSubjectId,
  RuntimeWorkspaceV1,
  TutorCoreBoundaryReceipt,
  TranscriptEntry,
} from "../runtimeTypes";
import { STUDENT_RUNTIME_VERSION } from "../runtimeTypes";
import {
  canonicalCompletionEventId,
  completeCanonicalSession,
  createPlannedCanonicalSession,
  pauseCanonicalSession,
  recordSegmentCompletion,
  recordTechnicalRecovery,
  responseDraftReference,
  resumeFromBreak,
  resumePausedCanonicalSession,
  startApprovedBreak,
  startCanonicalSession,
  updateActiveElapsedSeconds,
} from "./canonicalSession";

export type RuntimeIntegrityResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        | "unsupported-version"
        | "invalid-contract"
        | "session-mismatch"
        | "invalid-history"
        | "duplicate-completion"
        | "raw-answer-leakage";
    };

function activeSession(workspace: RuntimeWorkspaceV1): ActiveStudySession | undefined {
  return workspace.canonicalSession.status === "active"
    ? workspace.canonicalSession
    : undefined;
}

function atOrNow(at?: string) {
  return at ?? new Date().toISOString();
}

function evidenceIdFor(workspace: RuntimeWorkspaceV1): EvidenceId {
  return asBrandedId<EvidenceId>(
    `evidence:${workspace.canonicalSession.id}:summary:v1`,
  );
}

function diagnostic(
  workspace: RuntimeWorkspaceV1,
  at: string,
  code: RuntimeDiagnostic["code"],
  safeMessage: string,
  level: RuntimeDiagnostic["level"] = "info",
): RuntimeDiagnostic {
  return {
    id: `diagnostic:${workspace.subjectId}:${workspace.diagnostics.length + 1}`,
    at,
    level,
    code,
    safeMessage,
  };
}

function transcript(
  workspace: RuntimeWorkspaceV1,
  at: string,
  text: string,
  reasonCode: string,
  speaker: TranscriptEntry["speaker"] = "Jarvis",
): TranscriptEntry {
  if (speaker === "Jarvis" && inspectCoachLanguage(text).length > 0) {
    throw new Error("Supportive message failed the Session 2 language guard.");
  }
  return {
    id: `transcript:${workspace.subjectId}:${workspace.transcript.length + 1}`,
    speaker,
    text,
    at,
    reasonCode,
  };
}

function bump(
  workspace: RuntimeWorkspaceV1,
  at: string,
  updates: Partial<RuntimeWorkspaceV1>,
): RuntimeWorkspaceV1 {
  return {
    ...workspace,
    ...updates,
    resumeRevision: workspace.resumeRevision + 1,
    lastSavedAt: at,
  };
}

function canonicalCurrentSegment(workspace: RuntimeWorkspaceV1): SegmentId {
  if (workspace.screen === "check-in") {
    return canonicalSegmentId(workspace.subjectId, "check-in");
  }
  return canonicalSegmentId(workspace.subjectId, workspace.currentSegment);
}

function completionPayloadFingerprint(
  sessionId: SessionId,
  segmentId: SegmentId,
  nextSegmentId: SegmentId | undefined,
  evidenceRef: EvidenceId,
): string {
  return [
    "segment-completion.v2",
    sessionId,
    segmentId,
    nextSegmentId ?? "none",
    evidenceRef,
  ].join("|");
}

function reviewPayloadFingerprint(
  workspace: RuntimeWorkspaceV1,
  reviewId: string,
  evidenceId: string,
  dueOn: string,
): string {
  return [
    "review-recommendation.v2",
    workspace.canonicalSession.id,
    idsFor(workspace.subjectId).skillId,
    reviewId,
    evidenceId,
    dueOn,
  ].join("|");
}

function idempotencyRecord(
  commandId: string,
  kind: RuntimeIdempotencyRecord["kind"],
  payloadFingerprint: string,
  canonicalEventIds: readonly StudySessionEventId[],
  recordedAt: string,
): RuntimeIdempotencyRecord {
  return {
    commandId,
    kind,
    payloadFingerprint,
    canonicalEventIds,
    recordedAt,
  };
}

type StudySessionEventId = RuntimeIdempotencyRecord["canonicalEventIds"][number];

function existingCommand(
  workspace: RuntimeWorkspaceV1,
  commandId: string,
): RuntimeIdempotencyRecord | undefined {
  return workspace.idempotencyRecords.find(
    (record) => record.commandId === commandId,
  );
}

function rejectOrIgnoreExistingCommand(
  workspace: RuntimeWorkspaceV1,
  at: string,
  commandId: string,
  payloadFingerprint: string,
  duplicateMessage: string,
): RuntimeWorkspaceV1 | undefined {
  const existing = existingCommand(workspace, commandId);
  if (!existing) return undefined;
  const conflict = existing.payloadFingerprint !== payloadFingerprint;
  return bump(workspace, at, {
    diagnostics: [
      ...workspace.diagnostics,
      diagnostic(
        workspace,
        at,
        conflict ? "idempotency-conflict-rejected" : "duplicate-event-ignored",
        conflict
          ? "A reused command reference with different canonical content was rejected."
          : duplicateMessage,
        conflict ? "rejected" : "warning",
      ),
    ],
  });
}

function engineDurationCandidate(
  workspace: RuntimeWorkspaceV1,
): AcceptedEngineDurationRecommendationV1 | undefined {
  const focus = workspace.engineOutputs.focus;
  if (!focus) return undefined;
  return {
    targetMinutes: focus.recommendedDurationMinutes,
    // Session 7 displays the recommendation but has no canonical Card 5
    // acceptance decision, so it cannot silently become the applied target.
    accepted: false,
    evidenceSufficient:
      focus.recommendation !== "insufficient_data" &&
      focus.evidence.evaluatedComparableSessions >= 5,
  };
}

function validateOrThrow(label: string, result: { readonly ok: boolean; readonly error?: string }) {
  if (!result.ok) {
    throw new Error(
      `${label} failed canonical validation.${result.error ? ` ${result.error}` : ""}`,
    );
  }
}

function checkParentPreferences(value: ParentPreferenceInputV1): boolean {
  const range = value.breakRange;
  return (
    value.schemaVersion === "student-runtime.parent-preferences.v1" &&
    ["visible", "minimal", "hidden"].includes(value.timerMode) &&
    Number.isSafeInteger(value.maximumDurationMinutes) &&
    value.maximumDurationMinutes >= 1 &&
    value.maximumDurationMinutes <= 240 &&
    Number.isSafeInteger(range.minimumMinutes) &&
    Number.isSafeInteger(range.defaultMinutes) &&
    Number.isSafeInteger(range.maximumMinutes) &&
    range.minimumMinutes >= 1 &&
    range.minimumMinutes <= range.defaultMinutes &&
    range.defaultMinutes <= range.maximumMinutes &&
    range.maximumMinutes <= 120 &&
    (value.parentManualOverrideMinutes === undefined ||
      (Number.isSafeInteger(value.parentManualOverrideMinutes) &&
        value.parentManualOverrideMinutes >= 1)) &&
    (value.accommodationMaximumMinutes === undefined ||
      (Number.isSafeInteger(value.accommodationMaximumMinutes) &&
        value.accommodationMaximumMinutes >= 1))
  );
}

export function createRuntimeWorkspace(
  subjectId: RuntimeSubjectId,
  at = new Date().toISOString(),
  parentPreferences = defaultParentPreferences(),
  sessionId: SessionId = demoSessionIdFor(subjectId),
  householdTimeZone: string = LEARNER_TIME_ZONE,
): RuntimeWorkspaceV1 {
  if (!checkParentPreferences(parentPreferences)) {
    throw new TypeError("Parent preference input failed the versioned boundary.");
  }
  const plan = buildLessonPlan(subjectId);
  const controls = buildControls(parentPreferences, at);
  const focusProfile = buildFocusProfile(parentPreferences, at);
  validateOrThrow("Lesson plan", validateLessonStudyPlan(plan));
  validateOrThrow("Controls", validateParentTeacherControls(controls));
  validateOrThrow("Focus profile", validateStudentFocusProfile(focusProfile));
  const planned = createPlannedCanonicalSession(subjectId, plan, sessionId, at);
  validateOrThrow("Planned session", validateStudySession(planned));
  const canonicalSession = startCanonicalSession(planned, subjectId, at);
  validateOrThrow("Active session", validateStudySession(canonicalSession));
  const durationPolicy = resolveDurationPolicy(parentPreferences);
  const definition = SESSION_DEFINITIONS[subjectId];
  const validatedTimeZone = requireIanaTimeZone(householdTimeZone);
  const seed: RuntimeWorkspaceV1 = {
    version: STUDENT_RUNTIME_VERSION,
    subjectId,
    householdTimeZone: validatedTimeZone,
    plan,
    controls,
    focusProfile,
    parentPreferences,
    durationPolicy,
    canonicalSession,
    screen: "check-in",
    currentSegment: "warm-up",
    completedSegments: [],
    responses: {},
    reflection: {},
    feedback: {},
    feedbackReceiptRefs: {},
    timer: {
      mode: parentPreferences.timerMode,
      initialSeconds: durationPolicy.targetMinutes * 60,
      remainingSeconds: durationPolicy.targetMinutes * 60,
      running: false,
      goalReached: false,
      pauseReason: null,
    },
    idempotencyRecords: [],
    evidenceRecords: [],
    reviewRecords: [],
    engineOutputs: {},
    tutorCoreReceipts: [],
    transcript: [],
    diagnostics: [],
    quarantine: [],
    technicalInterruptionCount: 0,
    resumeRevision: 1,
    lastSavedAt: at,
    showRecoveryNotice: false,
    transcriptOpen: false,
  };
  return {
    ...seed,
    transcript: [
      transcript(
        seed,
        at,
        renderJarvisPrompt("explain_today_goal", {
          goal: definition.dailyGoal.toLocaleLowerCase("en-US"),
        }),
        "daily-goal",
      ),
    ],
    diagnostics: [
      diagnostic(
        seed,
        at,
        "canonical-contract-accepted",
        "Canonical plan, controls, focus profile, and active session passed v1 validation.",
      ),
      diagnostic(
        seed,
        at,
        "tutor-core-boundary",
        "Tutor Core authority is withheld behind the temporary versioned Session 6 bridge.",
        "warning",
      ),
      diagnostic(
        seed,
        at,
        "raw-response-local-only",
        "Entered work stays in the device-local workspace and is omitted from emitted evidence.",
      ),
    ],
  };
}

export function completeCheckIn(
  workspace: RuntimeWorkspaceV1,
  value: string,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (!session || workspace.screen !== "check-in" || value.trim().length === 0) {
    return workspace;
  }
  const segmentId = canonicalSegmentId(workspace.subjectId, "check-in");
  const key = canonicalCompletionEventId(session, segmentId);
  const nextSegmentId = canonicalSegmentId(workspace.subjectId, "warm-up");
  const evidenceRef = evidenceIdFor(workspace);
  const payloadFingerprint = completionPayloadFingerprint(
    session.id,
    segmentId,
    nextSegmentId,
    evidenceRef,
  );
  const existing = rejectOrIgnoreExistingCommand(
    workspace,
    at,
    key,
    payloadFingerprint,
    "A duplicate check-in completion was ignored.",
  );
  if (existing) return existing;
  const eventCountBefore = session.eventLog.length;
  const canonicalSession = recordSegmentCompletion(
    session,
    segmentId,
    nextSegmentId,
    evidenceRef,
    at,
  );
  return bump(workspace, at, {
    canonicalSession,
    checkIn: value.trim().slice(0, 64),
    screen: "learning",
    currentSegment: "warm-up",
    idempotencyRecords: [
      ...workspace.idempotencyRecords,
      idempotencyRecord(
        key,
        "segment-completion",
        payloadFingerprint,
        canonicalSession.eventLog
          .slice(eventCountBefore)
          .map((event) => event.id),
        at,
      ),
    ],
    timer: { ...workspace.timer, running: true, pauseReason: null },
    transcript: [
      ...workspace.transcript,
      transcript(
        workspace,
        at,
        renderJarvisPrompt("begin_work_block", {
          durationMinutes: workspace.durationPolicy.targetMinutes,
          taskLabel: SESSION_DEFINITIONS[workspace.subjectId].lessonTitle,
        }),
        "begin-work-block",
      ),
    ],
  });
}

export function setResponseDraft(
  workspace: RuntimeWorkspaceV1,
  segment: LearningSegmentId,
  response: string,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (
    workspace.screen !== "learning" ||
    workspace.currentSegment !== segment ||
    response.length > 16_000
  ) {
    return workspace;
  }
  return bump(workspace, at, {
    responses: { ...workspace.responses, [segment]: response },
    feedback: { ...workspace.feedback, [segment]: undefined },
    feedbackReceiptRefs: {
      ...workspace.feedbackReceiptRefs,
      [segment]: undefined,
    },
  });
}

export function setReflectionValue(
  workspace: RuntimeWorkspaceV1,
  field: ReflectionField,
  value: string,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (workspace.currentSegment !== "self-check" || workspace.screen !== "learning") {
    return workspace;
  }
  return bump(workspace, at, {
    reflection: { ...workspace.reflection, [field]: value },
    feedback: { ...workspace.feedback, "self-check": undefined },
    feedbackReceiptRefs: {
      ...workspace.feedbackReceiptRefs,
      "self-check": undefined,
    },
  });
}

function responseForBridge(
  workspace: RuntimeWorkspaceV1,
  segment: LearningSegmentId,
): string {
  if (segment === "self-check") {
    const values = [
      workspace.reflection.confidence,
      workspace.reflection.effort,
      workspace.reflection.frustration,
    ].filter(Boolean);
    return values.join("|");
  }
  return workspace.responses[segment] ?? "";
}

export async function submitCurrentResponse(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): Promise<RuntimeWorkspaceV1> {
  const session = activeSession(workspace);
  if (!session || workspace.screen !== "learning") return workspace;
  const segment = workspace.currentSegment;
  const definition = SESSION_DEFINITIONS[workspace.subjectId].segments[segment];
  const localResponse = responseForBridge(workspace, segment);
  if (localResponse.trim().length === 0) return workspace;
  const taskRef = canonicalSegmentId(workspace.subjectId, segment);
  const attempt = workspace.tutorCoreReceipts.filter((receipt) =>
    receipt.sessionId === session.id && receipt.taskRef === taskRef,
  ).length + 1;
  const result = await runAcceptedStudyCoreBridge({
    requestId: `bridge:${session.id}:${taskRef}:${attempt}`,
    sessionId: session.id,
    lessonId: idsFor(workspace.subjectId).lessonId,
    taskRef,
    subjectId: workspace.subjectId,
    skillId: idsFor(workspace.subjectId).skillId,
    responseRef: responseDraftReference(session.id, taskRef),
    submissionRevision: workspace.resumeRevision,
    localResponse,
    // Reflection is complete when all required local fields are present; it is
    // not an academic correctness judgment.
    expectedAnswer: definition.expectedAnswer ?? localResponse,
    occurredAt: at,
    learnerLocalDate: at.slice(0, 10),
    householdTimeZone: workspace.householdTimeZone,
    taskType:
      segment === "warm-up"
        ? "retrieval-practice"
        : segment === "visual-lesson"
          ? "direct-instruction"
          : segment === "guided-practice"
            ? "guided-practice"
            : segment === "independent-attempt"
              ? "independent-practice"
              : segment === "self-check"
                ? "reflection"
              : "mastery-check",
    priorAcceptedEvents: workspace.tutorCoreReceipts.map((receipt) => ({
      eventId: receipt.eventId,
      idempotencyKey: receipt.eventLedgerIdempotencyKey,
    })),
  });
  if (!result.ok) {
    const safeMessage =
      result.result.status === "quarantined"
        ? result.result.quarantine.safeMessage
        : result.result.status === "duplicate-ignored"
          ? "The duplicate Tutor event was safely ignored."
          : "learner" in result.result
            ? result.result.learner.message
            : "The Tutor event was not accepted, so the lesson paused safely.";
    return bump(workspace, at, {
      quarantine: [
        ...workspace.quarantine,
        {
          id: `quarantine:${workspace.subjectId}:${workspace.quarantine.length + 1}`,
          at,
          reason: "unsupported-version",
          safeMessage,
        },
      ],
      diagnostics: [
        ...workspace.diagnostics,
        diagnostic(
          workspace,
          at,
          "unsupported-version-quarantined",
          safeMessage,
          "rejected",
        ),
      ],
    });
  }
  const ready = result.receipt.directive === "continue";
  const lowConfidence =
    segment === "self-check" && workspace.reflection.confidence === "not-yet";
  const message = ready
    ? lowConfidence
      ? "Thanks for telling me. We will keep support close and take the next step together."
      : definition.successMessage
    : renderJarvisPrompt("offer_another_explanation");
  return bump(workspace, at, {
    tutorCoreReceipts: [...workspace.tutorCoreReceipts, result.receipt],
    feedback: {
      ...workspace.feedback,
      [segment]: ready ? "ready" : "support",
    },
    feedbackReceiptRefs: {
      ...workspace.feedbackReceiptRefs,
      [segment]: result.receipt.requestId,
    },
    transcript: [
      ...workspace.transcript,
      transcript(
        workspace,
        at,
        message,
        ready
          ? lowConfidence
            ? "low-confidence-support"
            : "accepted-core-continue"
          : "accepted-core-reteach",
      ),
    ],
  });
}

function completedCanonicalIds(workspace: RuntimeWorkspaceV1): readonly SegmentId[] {
  return workspace.canonicalSession.eventLog
    .filter((event) => event.type === "segment-completed" && event.segmentId)
    .map((event) => event.segmentId!);
}

function bridgeReceiptBindingIsValid(
  workspace: RuntimeWorkspaceV1,
  receipt: TutorCoreBoundaryReceipt,
): boolean {
  const plannedIndex = workspace.canonicalSession.plannedSegmentIds.indexOf(
    receipt.taskRef,
  );
  if (plannedIndex < 1 || plannedIndex > workspace.completedSegments.length + 1) {
    return false;
  }
  const segmentStart = [...workspace.canonicalSession.eventLog]
    .reverse()
    .find(
      (event) =>
        event.type === "segment-started" && event.segmentId === receipt.taskRef,
    );
  const occurredAt = Date.parse(receipt.occurredAt);
  const startedAt = segmentStart ? Date.parse(segmentStart.occurredAt) : Number.NaN;
  const savedAt = Date.parse(workspace.lastSavedAt);
  const reasonMatchesDirective =
    (receipt.directive === "continue" &&
      receipt.reasonCode === "tutor-core-continue") ||
    (receipt.directive === "reteach" &&
      receipt.reasonCode === "tutor-core-reteach");
  return (
    receipt.bridgeVersion === ACCEPTED_STUDY_CORE_BRIDGE_VERSION &&
    receipt.bridgeContractVersion === 1 &&
    receipt.ledgerAccepted === true &&
    receipt.sessionId === workspace.canonicalSession.id &&
    receipt.responseRef ===
      responseDraftReference(workspace.canonicalSession.id, receipt.taskRef) &&
    Number.isSafeInteger(receipt.submissionRevision) &&
    receipt.submissionRevision >= 0 &&
    receipt.submissionRevision < workspace.resumeRevision &&
    Number.isFinite(occurredAt) &&
    Number.isFinite(startedAt) &&
    occurredAt >= startedAt &&
    occurredAt <= savedAt &&
    reasonMatchesDirective
  );
}

export function hasMatchingStrictBridgeReceipt(
  workspace: RuntimeWorkspaceV1,
  segment: LearningSegmentId,
  directive: TutorCoreBoundaryReceipt["directive"] = "continue",
): boolean {
  const taskRef = canonicalSegmentId(workspace.subjectId, segment);
  const requestId = workspace.feedbackReceiptRefs[segment];
  if (!requestId) return false;
  return workspace.tutorCoreReceipts.some(
    (receipt) =>
      receipt.requestId === requestId &&
      receipt.taskRef === taskRef &&
      receipt.directive === directive &&
      bridgeReceiptBindingIsValid(workspace, receipt),
  );
}

export function completeCurrentSegment(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (
    !session ||
    workspace.screen !== "learning" ||
    workspace.feedback[workspace.currentSegment] !== "ready"
  ) {
    return workspace;
  }
  const segment = workspace.currentSegment;
  if (!hasMatchingStrictBridgeReceipt(workspace, segment, "continue")) {
    return bump(workspace, at, {
      diagnostics: [
        ...workspace.diagnostics,
        diagnostic(
          workspace,
          at,
          "forged-feedback-rejected",
          "Ready feedback without a matching current bridge receipt was rejected.",
          "rejected",
        ),
      ],
    });
  }
  const segmentId = canonicalSegmentId(workspace.subjectId, segment);
  const completionKey = canonicalCompletionEventId(session, segmentId);
  const nextSegment = getNextSegment(segment);
  const nextSegmentId = nextSegment
    ? canonicalSegmentId(workspace.subjectId, nextSegment)
    : undefined;
  const evidenceRef = evidenceIdFor(workspace);
  const payloadFingerprint = completionPayloadFingerprint(
    session.id,
    segmentId,
    nextSegmentId,
    evidenceRef,
  );
  const existing = rejectOrIgnoreExistingCommand(
    workspace,
    at,
    completionKey,
    payloadFingerprint,
    "A duplicate segment completion was ignored.",
  );
  if (existing) return existing;
  const eventCountBefore = session.eventLog.length;
  const canonicalSession = recordSegmentCompletion(
    session,
    segmentId,
    nextSegmentId,
    evidenceRef,
    at,
  );
  const completedSegments = workspace.completedSegments.includes(segment)
    ? workspace.completedSegments
    : [...workspace.completedSegments, segment];
  let nextWorkspace = bump(workspace, at, {
    canonicalSession,
    completedSegments,
    idempotencyRecords: [
      ...workspace.idempotencyRecords,
      idempotencyRecord(
        completionKey,
        "segment-completion",
        payloadFingerprint,
        canonicalSession.eventLog
          .slice(eventCountBefore)
          .map((event) => event.id),
        at,
      ),
    ],
    ...(nextSegment ? { currentSegment: nextSegment } : {}),
  });

  if (segment !== "exit-ticket") {
    if (
      workspace.parentPreferences.requiredBreaks &&
      segment === "guided-practice" &&
      !workspace.canonicalSession.eventLog.some(
        (event) =>
          event.type === "break-started" &&
          event.detailCode === "instructional-time-paused",
      )
    ) {
      nextWorkspace = requestBreak(nextWorkspace, at, "scheduled");
    }
    return nextWorkspace;
  }

  const evidence = buildCanonicalEvidence(nextWorkspace, at);
  const reviewRecommendation = createReviewRecommendation(
    nextWorkspace,
    at,
    nextWorkspace.householdTimeZone,
  );
  const review = buildCanonicalReview(
    nextWorkspace,
    evidence,
    reviewRecommendation,
    at,
  );
  const focus = projectFocusRecommendation(nextWorkspace, at);
  const evidenceAssessment = assessRuntimeEvidence(nextWorkspace);
  validateOrThrow("Learning evidence", validateLearningEvidence(evidence));
  validateOrThrow("Skill review", validateStudentSkillReview(review));
  const reviewKey = `review:${nextWorkspace.canonicalSession.id}:${idsFor(
    nextWorkspace.subjectId,
  ).skillId}`;
  const reviewFingerprint = reviewPayloadFingerprint(
    nextWorkspace,
    review.id,
    evidence.id,
    reviewRecommendation.dueOn,
  );
  const existingReview = existingCommand(nextWorkspace, reviewKey);
  const duplicateReview = existingReview !== undefined;
  const reviewConflict =
    existingReview !== undefined &&
    existingReview.payloadFingerprint !== reviewFingerprint;
  const focusCandidate: AcceptedEngineDurationRecommendationV1 = {
    targetMinutes: focus.recommendedDurationMinutes,
    accepted: false,
    evidenceSufficient:
      focus.recommendation !== "insufficient_data" &&
      focus.evidence.evaluatedComparableSessions >= 5,
  };
  nextWorkspace = bump(nextWorkspace, at, {
    screen: "decision",
    evidenceRecords: nextWorkspace.evidenceRecords.some(
      (record) => record.id === evidence.id,
    )
      ? nextWorkspace.evidenceRecords
      : [...nextWorkspace.evidenceRecords, evidence],
    reviewRecords: duplicateReview
      ? nextWorkspace.reviewRecords
      : [...nextWorkspace.reviewRecords, review],
    idempotencyRecords: duplicateReview
      ? nextWorkspace.idempotencyRecords
      : [
          ...nextWorkspace.idempotencyRecords,
          idempotencyRecord(
            reviewKey,
            "review-recommendation",
            reviewFingerprint,
            [],
            at,
          ),
        ],
    engineOutputs: {
      ...nextWorkspace.engineOutputs,
      focus,
      review: reviewRecommendation,
      evidenceAssessment,
    },
    durationPolicy: resolveDurationPolicy(
      nextWorkspace.parentPreferences,
      focusCandidate,
      nextWorkspace.durationPolicy.targetMinutes,
    ),
    timer: { ...nextWorkspace.timer, running: false, pauseReason: "learner" },
    diagnostics: duplicateReview
      ? [
          ...nextWorkspace.diagnostics,
          diagnostic(
            nextWorkspace,
            at,
            reviewConflict
              ? "idempotency-conflict-rejected"
              : "duplicate-event-ignored",
            reviewConflict
              ? "A reused review command with different canonical content was rejected."
              : "A duplicate review recommendation was ignored.",
            reviewConflict ? "rejected" : "warning",
          ),
        ]
      : nextWorkspace.diagnostics,
    transcript: [
      ...nextWorkspace.transcript,
      transcript(
        nextWorkspace,
        at,
        `Your next review is planned for ${reviewRecommendation.dueOn} in your local time. You can take a break, continue, save and exit, or finish.`,
        "review-recommendation",
      ),
    ],
  });
  return nextWorkspace;
}

export interface LearnerSupportCapabilities {
  readonly speechInputAvailable: boolean;
  readonly speechOutputAvailable: boolean;
}

/**
 * The only state-machine entry point for Study-UX learner support actions.
 * Messages pass the supportive-language guard and revisions are bumped here;
 * callers must not append transcript entries directly.
 */
export function recordLearnerSupportAction(
  workspace: RuntimeWorkspaceV1,
  action: LearnerAction,
  capabilities: LearnerSupportCapabilities,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (
    workspace.screen !== "learning" ||
    !LEARNER_ACTIONS.some((candidate) => candidate === action)
  ) {
    return workspace;
  }
  if (action === "I need a break") {
    return requestBreak(workspace, at, "student-request");
  }

  const segment =
    SESSION_DEFINITIONS[workspace.subjectId].segments[workspace.currentSegment];
  let message: string;
  let reasonCode: string;
  switch (action) {
    case "Read this to me":
      if (
        workspace.parentPreferences.noAudio ||
        !workspace.parentPreferences.readAloud ||
        !capabilities.speechOutputAvailable
      ) {
        message =
          "Voice is unavailable right now. The complete instruction remains on screen in text.";
        reasonCode = "read-aloud-text-fallback";
      } else {
        message = segment.readAloudText;
        reasonCode = "read-aloud-request";
      }
      break;
    case "Let me answer aloud":
      if (
        !workspace.parentPreferences.speechInput ||
        !capabilities.speechInputAvailable
      ) {
        message =
          "Speech input is unavailable. Typing is ready, and your place is unchanged.";
        reasonCode = "speech-input-unavailable";
      } else {
        message =
          "Speech input is ready. You stay in control, and nothing submits automatically.";
        reasonCode = "speech-input-ready";
      }
      break;
    case "Show me another way":
      message = segment.anotherWay;
      reasonCode = "learner-action:show-another-way";
      break;
    case "Give me a different example":
      message = segment.differentExample;
      reasonCode = "learner-action:different-example";
      break;
    case "This is too hard":
      message =
        "Thanks for saying that. We can use a smaller example and keep the same goal.";
      reasonCode = "learner-action:more-support";
      break;
    case "This is too easy":
      message =
        "Thanks for the signal. Finish this step, and the next recommendation can preserve the goal with less support.";
      reasonCode = "learner-action:less-support";
      break;
    case "Continue independently":
      message =
        "You can continue independently. Support stays nearby if you decide you want it.";
      reasonCode = "learner-action:continue-independently";
      break;
    case "Talk me through it":
    case "Let’s do one together":
    case "I need help":
      message =
        "We can work through one clue together, then you can choose whether to continue independently.";
      reasonCode = "learner-action:guided-support";
      break;
    default:
      return workspace;
  }
  return bump(workspace, at, {
    transcript: [
      ...workspace.transcript,
      transcript(workspace, at, message, reasonCode),
    ],
  });
}

export function requestBreak(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
  source: "student-request" | "scheduled" | "accessibility-need" =
    "student-request",
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (!session || !["check-in", "learning", "decision"].includes(workspace.screen)) {
    return workspace;
  }
  const recommendation = projectBreakRecommendation(workspace, "water");
  if (recommendation.action !== "start_break" || !recommendation.approved) {
    return bump(workspace, at, {
      engineOutputs: { ...workspace.engineOutputs, break: recommendation },
    });
  }
  const breakNumber =
    workspace.canonicalSession.eventLog.filter(
      (event) => event.type === "break-started",
    ).length + 1;
  const interruptionId = asBrandedId<InterruptionId>(
    `interrupt:${workspace.canonicalSession.id}:break:${breakNumber}`,
  );
  const segmentId = canonicalCurrentSegment(workspace);
  const durationMinutes =
    recommendation.durationMinutes ?? workspace.durationPolicy.breakMinutes;
  const canonicalSession = startApprovedBreak(
    session,
    segmentId,
    interruptionId,
    durationMinutes,
    at,
    source === "scheduled" ? "scheduled-break" : source,
  );
  const adultReviewSuggested = recommendation.review === "parent_or_teacher";
  const next = bump(workspace, at, {
    canonicalSession,
    screen: "break",
    breakState: {
      interruptionId,
      returnSegment: workspace.currentSegment,
      returnScreen: workspace.screen as Exclude<
        RuntimeScreen,
        "break" | "home" | "quarantine"
      >,
      startedAt: at,
      durationMinutes,
      countsAsFailure: false,
      adultReviewSuggested,
    },
    timer: { ...workspace.timer, running: false, pauseReason: "break" },
    engineOutputs: { ...workspace.engineOutputs, break: recommendation },
    transcript: [
      ...workspace.transcript,
      transcript(
        workspace,
        at,
        renderJarvisPrompt("suggest_break", { breakLabel: "water" }),
        "approved-break-not-failure",
      ),
    ],
    diagnostics: adultReviewSuggested
      ? [
          ...workspace.diagnostics,
          diagnostic(
            workspace,
            at,
            "adult-review-suggested",
            "The break remains approved and non-punitive; the repeated pattern may be reviewed by an adult.",
            "warning",
          ),
        ]
      : workspace.diagnostics,
  });
  validateOrThrow("Approved break session", validateStudySession(next.canonicalSession));
  return next;
}

export function chooseBreakActivity(
  workspace: RuntimeWorkspaceV1,
  activity: string,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (!workspace.breakState || workspace.screen !== "break") return workspace;
  const allowed = ["water", "walk", "stretch", "look-away", "breathe", "movement"];
  if (!allowed.includes(activity)) return workspace;
  return bump(workspace, at, {
    breakState: { ...workspace.breakState, activity },
  });
}

export function resumeBreak(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (
    !workspace.breakState ||
    workspace.screen !== "break" ||
    workspace.canonicalSession.status !== "approved-break"
  ) {
    return workspace;
  }
  const returnScreen = workspace.breakState.returnScreen as RuntimeScreen;
  const canonicalSession = resumeFromBreak(workspace.canonicalSession, at);
  const next = bump(workspace, at, {
    canonicalSession,
    screen: returnScreen,
    currentSegment: workspace.breakState.returnSegment,
    breakState: undefined,
    timer: {
      ...workspace.timer,
      running: returnScreen === "learning",
      pauseReason: null,
    },
    transcript: [
      ...workspace.transcript,
      transcript(
        workspace,
        at,
        renderJarvisPrompt("resume_after_break", {
          taskLabel:
            SESSION_DEFINITIONS[workspace.subjectId].segments[
              workspace.breakState.returnSegment
            ].navLabel,
        }),
        "exact-break-resume",
      ),
    ],
  });
  validateOrThrow("Resumed session", validateStudySession(next.canonicalSession));
  return next;
}

export function saveAndExit(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (!session) return workspace;
  const canonicalSession = pauseCanonicalSession(
    session,
    canonicalCurrentSegment(workspace),
    at,
    "student-request",
  );
  const next = bump(workspace, at, {
    canonicalSession,
    timer: { ...workspace.timer, running: false, pauseReason: "learner" },
    showRecoveryNotice: false,
  });
  validateOrThrow("Paused session", validateStudySession(next.canonicalSession));
  return next;
}

export function resumeSavedSession(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (workspace.canonicalSession.status !== "paused") return workspace;
  const canonicalSession = resumePausedCanonicalSession(
    workspace.canonicalSession,
    at,
  );
  const next = bump(workspace, at, {
    canonicalSession,
    timer: {
      ...workspace.timer,
      running: workspace.screen === "learning",
      pauseReason: null,
    },
    showRecoveryNotice: true,
  });
  validateOrThrow("Resumed session", validateStudySession(next.canonicalSession));
  return next;
}

export function recoverAfterRefresh(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (!session) return workspace;
  const canonicalSession = recordTechnicalRecovery(
    session,
    canonicalCurrentSegment(workspace),
    at,
  );
  const next = bump(workspace, at, {
    canonicalSession,
    technicalInterruptionCount: workspace.technicalInterruptionCount + 1,
    showRecoveryNotice: true,
    timer: { ...workspace.timer, running: false, pauseReason: "technical" },
    diagnostics: [
      ...workspace.diagnostics,
      diagnostic(
        workspace,
        at,
        "technical-recovery",
        "A technical interruption was recorded separately and the exact local step was restored.",
      ),
    ],
  });
  validateOrThrow("Recovered session", validateStudySession(next.canonicalSession));
  return next;
}

export function dismissRecovery(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  return bump(workspace, at, {
    showRecoveryNotice: false,
    timer: {
      ...workspace.timer,
      running: workspace.screen === "learning",
      pauseReason: null,
    },
  });
}

export function toggleTimer(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (workspace.timer.goalReached) return workspace;
  return bump(workspace, at, {
    timer: {
      ...workspace.timer,
      running: !workspace.timer.running,
      pauseReason: workspace.timer.running ? "learner" : null,
    },
  });
}

export function setTimerMode(
  workspace: RuntimeWorkspaceV1,
  mode: ParentPreferenceInputV1["timerMode"],
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  return applyParentPreferences(
    workspace,
    { ...workspace.parentPreferences, timerMode: mode },
    at,
  );
}

export function tickRuntimeTimer(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  const session = activeSession(workspace);
  if (!session || workspace.screen !== "learning") return workspace;
  const elapsed = session.elapsedActiveSeconds + 1;
  const canonicalSession = updateActiveElapsedSeconds(session, elapsed, at);
  const remainingSeconds = workspace.timer.running
    ? Math.max(0, workspace.timer.remainingSeconds - 1)
    : workspace.timer.remainingSeconds;
  const goalReached = remainingSeconds === 0;
  if (elapsed >= workspace.durationPolicy.hardMaximumMinutes * 60) {
    const paused = pauseCanonicalSession(
      canonicalSession,
      canonicalCurrentSegment(workspace),
      at,
      "accessibility-need",
    );
    return bump(workspace, at, {
      canonicalSession: paused,
      screen: "limit",
      timer: {
        ...workspace.timer,
        remainingSeconds,
        running: false,
        goalReached,
        pauseReason: "learner",
      },
      transcript: [
        ...workspace.transcript,
        transcript(
          workspace,
          at,
          "The configured maximum is here. Your work is saved, and stopping now is part of the plan.",
          "duration-cap-enforced",
        ),
      ],
    });
  }
  return bump(workspace, at, {
    canonicalSession,
    timer: {
      ...workspace.timer,
      remainingSeconds,
      running: workspace.timer.running && !goalReached,
      goalReached,
    },
  });
}

export function applyParentPreferences(
  workspace: RuntimeWorkspaceV1,
  preferences: ParentPreferenceInputV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  if (!checkParentPreferences(preferences)) return workspace;
  const controls = buildControls(preferences, at);
  const focusProfile = buildFocusProfile(preferences, at);
  validateOrThrow("Controls", validateParentTeacherControls(controls));
  validateOrThrow("Focus profile", validateStudentFocusProfile(focusProfile));
  const durationPolicy = resolveDurationPolicy(
    preferences,
    engineDurationCandidate(workspace),
    workspace.durationPolicy.targetMinutes,
  );
  const consumedSeconds = Math.max(
    0,
    workspace.timer.initialSeconds - workspace.timer.remainingSeconds,
  );
  const initialSeconds = durationPolicy.targetMinutes * 60;
  return bump(workspace, at, {
    parentPreferences: preferences,
    controls,
    focusProfile,
    durationPolicy,
    timer: {
      ...workspace.timer,
      mode: preferences.timerMode,
      initialSeconds,
      remainingSeconds: Math.max(0, initialSeconds - consumedSeconds),
      goalReached: consumedSeconds >= initialSeconds,
    },
  });
}

export function setTranscriptOpen(
  workspace: RuntimeWorkspaceV1,
  open: boolean,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  return bump(workspace, at, { transcriptOpen: open });
}

export function finishRuntimeSession(
  workspace: RuntimeWorkspaceV1,
  at = new Date().toISOString(),
): RuntimeWorkspaceV1 {
  let resumed = workspace;
  if (workspace.canonicalSession.status === "paused") {
    resumed = resumeSavedSession(workspace, at);
  }
  const session = activeSession(resumed);
  if (!session) return resumed;
  const evidenceIds = resumed.evidenceRecords.map((record) => record.id);
  const breakCount = resumed.canonicalSession.eventLog.filter(
    (event) => event.type === "break-started",
  ).length;
  const canonicalSession = completeCanonicalSession(
    session,
    completedCanonicalIds(resumed),
    evidenceIds,
    {
      activeDurationSeconds: session.elapsedActiveSeconds,
      breakDurationSeconds: breakCount * resumed.durationPolicy.breakMinutes * 60,
      pausedDurationSeconds: 0,
    },
    at,
  );
  const next = bump(resumed, at, {
    canonicalSession,
    screen: "finished",
    timer: { ...resumed.timer, running: false, pauseReason: "learner" },
    transcript: [
      ...resumed.transcript,
      transcript(
        resumed,
        at,
        "This learning cycle is saved. Your review plan is ready, and you can finish for today.",
        "session-finished",
      ),
    ],
  });
  validateOrThrow("Completed session", validateStudySession(next.canonicalSession));
  return next;
}

function durationPolicyIsValid(policy: RuntimeWorkspaceV1["durationPolicy"]): boolean {
  const boundedFallback =
    Number.isFinite(policy.targetMinutes) &&
    Number.isFinite(policy.hardMaximumMinutes) &&
    policy.targetMinutes >= 1 &&
    policy.targetMinutes <= policy.hardMaximumMinutes;
  if (
    policy.precedenceVersion !== "card5.resolve-duration-policy.v1" ||
    policy.provisionalUntilCard5 !== false ||
    !boundedFallback
  ) {
    return false;
  }
  if (policy.status === "manual-review") {
    return (
      policy.reasonCode === "policy.infeasible-constraints" &&
      policy.candidateSource === "manual-review" &&
      policy.automaticTargetMinutes === undefined &&
      policy.candidateMinutes === undefined &&
      policy.feasibleMinimumMinutes > policy.feasibleMaximumMinutes
    );
  }
  return (
    policy.status === "resolved" &&
    policy.reasonCode === "policy.resolved" &&
    policy.candidateSource !== "manual-review" &&
    policy.automaticTargetMinutes === policy.targetMinutes &&
    policy.candidateMinutes !== undefined &&
    policy.feasibleMinimumMinutes <= policy.targetMinutes &&
    policy.targetMinutes <= policy.feasibleMaximumMinutes &&
    policy.hardMaximumMinutes === policy.feasibleMaximumMinutes
  );
}

export function validateRuntimeWorkspaceIntegrity(
  value: RuntimeWorkspaceV1,
): RuntimeIntegrityResult {
  try {
    requireIanaTimeZone(value.householdTimeZone);
  } catch {
    return { ok: false, code: "invalid-history" };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    value.version !== STUDENT_RUNTIME_VERSION ||
    !["math", "reading"].includes(value.subjectId)
  ) {
    return { ok: false, code: "unsupported-version" };
  }
  if (
    !Array.isArray(value.idempotencyRecords) ||
    !Array.isArray(value.tutorCoreReceipts) ||
    !Array.isArray(value.completedSegments) ||
    !Array.isArray(value.evidenceRecords) ||
    !Array.isArray(value.reviewRecords) ||
    typeof value.feedbackReceiptRefs !== "object" ||
    value.feedbackReceiptRefs === null ||
    !durationPolicyIsValid(value.durationPolicy)
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const versionedContracts = [
    value.plan,
    value.controls,
    value.focusProfile,
    value.canonicalSession,
    ...value.evidenceRecords,
    ...value.reviewRecords,
  ];
  if (
    versionedContracts.some(
      (contract) => inspectContractVersion(contract).status !== "current",
    )
  ) {
    return { ok: false, code: "unsupported-version" };
  }
  if (
    !validateLessonStudyPlan(value.plan).ok ||
    !validateParentTeacherControls(value.controls).ok ||
    !validateStudentFocusProfile(value.focusProfile).ok ||
    !validateStudySession(value.canonicalSession).ok ||
    value.evidenceRecords.some((record) => !validateLearningEvidence(record).ok) ||
    value.reviewRecords.some((record) => !validateStudentSkillReview(record).ok)
  ) {
    return { ok: false, code: "invalid-contract" };
  }
  const ids = idsFor(value.subjectId);
  if (
    value.plan.id !== ids.planId ||
    value.plan.subjectId !== ids.subjectId ||
    value.canonicalSession.studyPlanId !== ids.planId ||
    value.canonicalSession.studentId !== value.plan.studentId ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(
      value.canonicalSession.id,
    )
  ) {
    return { ok: false, code: "session-mismatch" };
  }
  const expectedPlanned = CANONICAL_SEGMENT_SEQUENCE.map((segment) =>
    canonicalSegmentId(value.subjectId, segment),
  );
  if (
    value.canonicalSession.plannedSegmentIds.length !== expectedPlanned.length ||
    value.canonicalSession.plannedSegmentIds.some(
      (segmentId, index) => segmentId !== expectedPlanned[index],
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const eventIds = value.canonicalSession.eventLog.map((event) => event.id);
  if (
    new Set(eventIds).size !== eventIds.length ||
    value.canonicalSession.eventLog.some(
      (event, index) =>
        event.sessionId !== value.canonicalSession.id ||
        event.sequence !== index + 1 ||
        !Number.isFinite(Date.parse(event.occurredAt)) ||
        (index > 0 &&
          Date.parse(event.occurredAt) <
            Date.parse(value.canonicalSession.eventLog[index - 1]!.occurredAt)) ||
        (event.segmentId !== undefined &&
          !expectedPlanned.includes(event.segmentId)),
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const completionEvents = value.canonicalSession.eventLog.filter(
    (event) => event.type === "segment-completed",
  );
  const completionIds = completionEvents.map((event) => event.segmentId);
  if (new Set(completionIds).size !== completionIds.length) {
    return { ok: false, code: "duplicate-completion" };
  }
  if (
    completionIds.some(
      (segmentId, index) =>
        segmentId !== expectedPlanned[index] ||
        completionEvents[index]!.sequence <= 1,
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const expectedUiCompleted = completionIds
    .slice(completionIds[0] === expectedPlanned[0] ? 1 : 0)
    .map((segmentId) => {
      const index = expectedPlanned.indexOf(segmentId!);
      return CANONICAL_SEGMENT_SEQUENCE[index];
    })
    .filter((segment): segment is LearningSegmentId => segment !== "check-in");
  if (
    expectedUiCompleted.length !== value.completedSegments.length ||
    expectedUiCompleted.some(
      (segment, index) => segment !== value.completedSegments[index],
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const commandIds = value.idempotencyRecords.map(
    (record) => record.commandId,
  );
  if (
    new Set(commandIds).size !== commandIds.length ||
    value.idempotencyRecords.some(
      (record) =>
        !record.commandId ||
        !record.payloadFingerprint ||
        !Number.isFinite(Date.parse(record.recordedAt)) ||
        new Set(record.canonicalEventIds).size !==
          record.canonicalEventIds.length ||
        record.canonicalEventIds.some((eventId: string) =>
          !eventIds.includes(eventId as StudySessionEventId),
        ),
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  for (const completionEvent of completionEvents) {
    if (!completionEvent.segmentId || !completionEvent.evidenceRef) {
      return { ok: false, code: "invalid-history" };
    }
    const plannedIndex = expectedPlanned.indexOf(completionEvent.segmentId);
    const nextSegmentId = expectedPlanned[plannedIndex + 1];
    const commandId = canonicalCompletionEventId(
      value.canonicalSession,
      completionEvent.segmentId,
    );
    const expectedFingerprint = completionPayloadFingerprint(
      value.canonicalSession.id,
      completionEvent.segmentId,
      nextSegmentId,
      completionEvent.evidenceRef,
    );
    const record = value.idempotencyRecords.find(
      (candidate) => candidate.commandId === commandId,
    );
    if (
      !record ||
      record.kind !== "segment-completion" ||
      record.payloadFingerprint !== expectedFingerprint ||
      !record.canonicalEventIds.includes(completionEvent.id)
    ) {
      return { ok: false, code: "invalid-history" };
    }
  }
  const responseKeys = Object.keys(value.responses);
  if (
    responseKeys.some(
      (key) =>
        ![
          "warm-up",
          "visual-lesson",
          "guided-practice",
          "independent-attempt",
          "self-check",
          "exit-ticket",
        ].includes(key),
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  const emitted = JSON.stringify({
    evidenceRecords: value.evidenceRecords,
    reviewRecords: value.reviewRecords,
    eventLog: value.canonicalSession.eventLog,
  });
  const distinctiveResponses = Object.values(value.responses).filter(
    (response): response is string => typeof response === "string" && response.length >= 8,
  );
  if (
    distinctiveResponses.some((response) => emitted.includes(response)) ||
    /"(?:email|name|rawAnswer|responseText)"\s*:/i.test(emitted)
  ) {
    return { ok: false, code: "raw-answer-leakage" };
  }
  const requestIds = value.tutorCoreReceipts.map(
    (receipt) => receipt.requestId,
  );
  if (
    new Set(requestIds).size !== requestIds.length ||
    value.tutorCoreReceipts.some(
      (receipt, receiptIndex) => {
        if (!bridgeReceiptBindingIsValid(value, receipt)) return true;
        const sameTaskBefore = value.tutorCoreReceipts
          .slice(0, receiptIndex)
          .filter(
            (candidate) =>
              candidate.sessionId === receipt.sessionId &&
              candidate.taskRef === receipt.taskRef,
          ).length;
        return (
          receipt.requestId !==
          `bridge:${receipt.sessionId}:${receipt.taskRef}:${sameTaskBefore + 1}`
        );
      },
    )
  ) {
    return { ok: false, code: "invalid-history" };
  }
  for (const segment of UI_SEGMENT_SEQUENCE) {
    const feedback = value.feedback[segment];
    const receiptRef = value.feedbackReceiptRefs[segment];
    if ((feedback === undefined) !== (receiptRef === undefined)) {
      return { ok: false, code: "invalid-history" };
    }
    if (
      feedback !== undefined &&
      !hasMatchingStrictBridgeReceipt(
        value,
        segment,
        feedback === "ready" ? "continue" : "reteach",
      )
    ) {
      return { ok: false, code: "invalid-history" };
    }
    if (
      value.completedSegments.includes(segment) &&
      !hasMatchingStrictBridgeReceipt(value, segment, "continue")
    ) {
      return { ok: false, code: "invalid-history" };
    }
  }
  return { ok: true };
}

export function validateResumeWorkspace(
  workspace: RuntimeWorkspaceV1,
  context: {
    readonly subjectId: RuntimeSubjectId;
    readonly sessionId: string;
    readonly revision: number;
    readonly savedAt: string;
  },
): boolean {
  return (
    context.subjectId === workspace.subjectId &&
    context.sessionId === workspace.canonicalSession.id &&
    context.revision === workspace.resumeRevision &&
    context.savedAt === workspace.lastSavedAt &&
    validateRuntimeWorkspaceIntegrity(workspace).ok
  );
}

export function currentJarvisMessage(workspace: RuntimeWorkspaceV1): string {
  return (
    [...workspace.transcript]
      .reverse()
      .find((entry) => entry.speaker === "Jarvis")?.text ??
    "We can take this one clear step at a time."
  );
}

export function currentCanonicalUiSegment(
  workspace: RuntimeWorkspaceV1,
): CanonicalUiSegmentId {
  return workspace.screen === "check-in" ? "check-in" : workspace.currentSegment;
}

export function canonicalSchemaVersion() {
  return STUDY_ENGINE_SCHEMA_VERSION;
}
