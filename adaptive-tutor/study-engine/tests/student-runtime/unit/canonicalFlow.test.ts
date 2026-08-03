import {
  STUDY_ENGINE_SCHEMA_VERSION,
  inspectContractVersion,
  type StudySessionEvent,
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
import {
  canonicalSegmentId,
  demoSessionIdFor,
  idsFor,
  LEARNER_REFERENCE,
} from "@runtime/catalog";
import {
  chooseBreakActivity,
  completeCurrentSegment,
  finishRuntimeSession,
  recoverAfterRefresh,
  requestBreak,
  resumeBreak,
  resumeSavedSession,
  saveAndExit,
  setResponseDraft,
  submitCurrentResponse,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import { responseDraftReference } from "@runtime/state/canonicalSession";
import type { RuntimeWorkspaceV1 } from "@runtime/runtimeTypes";
import {
  acceptedResponse,
  answerAndAdvance,
  beginLearning,
  reflectAndAdvance,
  traceAt,
} from "./runtimeHarness";

const EVENT_VOCABULARY_V1 = new Set<StudySessionEvent["type"]>([
  "session-planned",
  "session-started",
  "segment-started",
  "active-response-recorded",
  "segment-completed",
  "break-requested",
  "break-approved",
  "break-started",
  "break-ended",
  "pause-started",
  "session-resumed",
  "technical-interruption-started",
  "technical-interruption-ended",
  "session-completed",
]);

async function advanceOpeningSegments(
  subjectId: "math" | "reading",
): Promise<RuntimeWorkspaceV1> {
  let workspace = beginLearning(subjectId);
  workspace = await answerAndAdvance(
    workspace,
    acceptedResponse(subjectId, "warm-up"),
    10,
  );
  workspace = await answerAndAdvance(
    workspace,
    acceptedResponse(subjectId, "visual-lesson"),
    20,
  );
  return answerAndAdvance(
    workspace,
    acceptedResponse(subjectId, "guided-practice"),
    30,
  );
}

describe("canonical contracts and integrated lifecycle", () => {
  it.each(["math", "reading"] as const)(
    "builds a current canonical %s plan with stable IDs and one event vocabulary",
    (subjectId) => {
      const workspace = beginLearning(subjectId);
      const ids = idsFor(subjectId);

      expect(validateLessonStudyPlan(workspace.plan).ok).toBe(true);
      expect(validateParentTeacherControls(workspace.controls).ok).toBe(true);
      expect(validateStudentFocusProfile(workspace.focusProfile).ok).toBe(true);
      expect(validateStudySession(workspace.canonicalSession).ok).toBe(true);
      expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });
      expect(workspace.plan.schemaVersion).toBe(STUDY_ENGINE_SCHEMA_VERSION);
      expect(inspectContractVersion(workspace.plan).status).toBe("current");
      expect(workspace.plan.id).toBe(ids.planId);
      expect(workspace.plan.lessonId).toBe(ids.lessonId);
      expect(workspace.plan.subjectId).toBe(ids.subjectId);
      expect(workspace.plan.studentId).toBe(LEARNER_REFERENCE);
      expect(workspace.canonicalSession.id).toBe(demoSessionIdFor(subjectId));
      expect(workspace.plan.segmentSequence).toEqual(
        ["check-in", "warm-up", "visual-lesson", "guided-practice", "independent-attempt", "self-check", "exit-ticket"].map(
          (segment) =>
            canonicalSegmentId(
              subjectId,
              segment as Parameters<typeof canonicalSegmentId>[1],
            ),
        ),
      );
      expect(canonicalSegmentId(subjectId, "exit-ticket")).toBe(
        workspace.plan.segmentSequence.at(-1),
      );
      expect(
        workspace.canonicalSession.eventLog.every((event) =>
          EVENT_VOCABULARY_V1.has(event.type),
        ),
      ).toBe(true);
    },
  );

  it("runs the Grade 5 math cycle through a non-failure water break, evidence, review, and finish", async () => {
    let workspace = await advanceOpeningSegments("math");
    expect(workspace.currentSegment).toBe("independent-attempt");

    const exactDraft = "4/10";
    workspace = setResponseDraft(
      workspace,
      "independent-attempt",
      exactDraft,
      traceAt(40),
    );
    workspace = requestBreak(workspace, traceAt(41), "student-request");
    expect(workspace.screen).toBe("break");
    expect(workspace.breakState).toMatchObject({
      returnSegment: "independent-attempt",
      countsAsFailure: false,
    });
    expect(workspace.canonicalSession.status).toBe("approved-break");
    if (workspace.canonicalSession.status === "approved-break") {
      expect(workspace.canonicalSession.resumePoint.segmentId).toBe(
        canonicalSegmentId("math", "independent-attempt"),
      );
      expect(workspace.canonicalSession.resumePoint.responseDraftRef).toBe(
        responseDraftReference(
          workspace.canonicalSession.id,
          canonicalSegmentId("math", "independent-attempt"),
        ),
      );
    }
    workspace = chooseBreakActivity(workspace, "water", traceAt(42));
    workspace = resumeBreak(workspace, traceAt(43));
    expect(workspace.screen).toBe("learning");
    expect(workspace.currentSegment).toBe("independent-attempt");
    expect(workspace.responses["independent-attempt"]).toBe(exactDraft);
    expect(
      workspace.canonicalSession.eventLog.filter(
        (event) => event.type === "break-started",
      ),
    ).toHaveLength(1);
    expect(
      workspace.canonicalSession.eventLog.find(
        (event) => event.type === "break-approved",
      )?.detailCode,
    ).toBe("approved-break-not-failure");
    expect(
      workspace.canonicalSession.eventLog.some((event) =>
        /failed|penalty/i.test(`${event.type}:${event.detailCode ?? ""}`),
      ),
    ).toBe(false);

    workspace = await submitCurrentResponse(workspace, traceAt(44));
    workspace = completeCurrentSegment(workspace, traceAt(45));
    workspace = await reflectAndAdvance(
      workspace,
      { confidence: "ready", effort: "steady", frustration: "calm" },
      50,
    );
    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse("math", "exit-ticket"),
      60,
    );

    expect(workspace.screen).toBe("decision");
    expect(workspace.completedSegments).toHaveLength(6);
    expect(workspace.evidenceRecords).toHaveLength(1);
    expect(workspace.reviewRecords).toHaveLength(1);
    expect(validateLearningEvidence(workspace.evidenceRecords[0]!).ok).toBe(true);
    expect(validateStudentSkillReview(workspace.reviewRecords[0]!).ok).toBe(true);
    expect(workspace.engineOutputs.focus?.recommendation).toBe(
      "insufficient_data",
    );
    expect(
      workspace.engineOutputs.focus?.evidence.evaluatedComparableSessions,
    ).toBe(1);
    expect(workspace.engineOutputs.review?.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(workspace.reviewRecords[0]?.timeZone).toBe("America/New_York");
    expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });

    const emitted = JSON.stringify({
      evidence: workspace.evidenceRecords,
      review: workspace.reviewRecords,
      events: workspace.canonicalSession.eventLog,
    });
    expect(emitted).not.toContain(exactDraft);
    expect(emitted).not.toMatch(/"(?:email|name|rawAnswer|responseText)"\s*:/i);
    expect(
      workspace.tutorCoreReceipts.every(
        (receipt) =>
          receipt.bridgeVersion === "1.0.1" &&
          receipt.bridgeContractVersion === 1 &&
          receipt.ledgerAccepted,
      ),
    ).toBe(true);

    workspace = finishRuntimeSession(workspace, traceAt(70));
    expect(workspace.screen).toBe("finished");
    expect(workspace.canonicalSession.status).toBe("completed");
    expect(validateStudySession(workspace.canonicalSession).ok).toBe(true);
  });

  it("runs the Grade 5 reading low-confidence save, refresh, and exact-resume path", async () => {
    let workspace = await advanceOpeningSegments("reading");
    const exactDraft =
      "Weary means tired because Leila dropped her backpack and sank onto a bench.";
    workspace = setResponseDraft(
      workspace,
      "independent-attempt",
      exactDraft,
      traceAt(40),
    );
    workspace = saveAndExit(workspace, traceAt(41));

    expect(workspace.canonicalSession.status).toBe("paused");
    if (workspace.canonicalSession.status === "paused") {
      expect(workspace.canonicalSession.resumePoint.segmentId).toBe(
        canonicalSegmentId("reading", "independent-attempt"),
      );
    }

    const resumed = resumeSavedSession(
      structuredClone(workspace),
      traceAt(42),
    );
    expect(resumed.currentSegment).toBe("independent-attempt");
    expect(resumed.responses["independent-attempt"]).toBe(exactDraft);
    expect(resumed.showRecoveryNotice).toBe(true);
    workspace = await submitCurrentResponse(resumed, traceAt(43));
    workspace = completeCurrentSegment(workspace, traceAt(44));
    workspace = await reflectAndAdvance(
      workspace,
      { confidence: "not-yet", effort: "a-lot", frustration: "some" },
      50,
    );
    expect(
      workspace.transcript.some(
        (entry) =>
          entry.reasonCode === "low-confidence-support" &&
          /keep support close|together/i.test(entry.text),
      ),
    ).toBe(true);
    expect(
      workspace.transcript.flatMap((entry) => inspectCoachLanguage(entry.text)),
    ).toEqual([]);

    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse("reading", "exit-ticket"),
      60,
    );
    expect(workspace.screen).toBe("decision");
    expect(workspace.evidenceRecords[0]?.confidence?.rating).toBe(1);
    expect(JSON.stringify(workspace.evidenceRecords)).not.toContain(exactDraft);
    expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });
  });

  it("records refresh loops as technical interruptions, never as learner breaks", async () => {
    let workspace = beginLearning("reading");
    workspace = setResponseDraft(
      workspace,
      "warm-up",
      "however",
      traceAt(5),
    );
    const exactRevisionDraft = workspace.responses["warm-up"];
    workspace = recoverAfterRefresh(workspace, traceAt(6));
    workspace = recoverAfterRefresh(workspace, traceAt(7));

    expect(workspace.responses["warm-up"]).toBe(exactRevisionDraft);
    expect(workspace.technicalInterruptionCount).toBe(2);
    expect(
      workspace.canonicalSession.eventLog.filter(
        (event) => event.type === "technical-interruption-started",
      ),
    ).toHaveLength(2);
    expect(
      workspace.canonicalSession.eventLog.filter(
        (event) => event.type === "break-started",
      ),
    ).toHaveLength(0);
    expect(workspace.timer.pauseReason).toBe("technical");
    expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });
  });
});
