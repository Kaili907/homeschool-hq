import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = path.resolve(
  projectRoot,
  "../../docs/student-runtime/sample-traces",
);
const baseEpoch = Date.parse("2026-07-28T14:00:00.000Z");
const at = (step) => new Date(baseEpoch + step * 1_000).toISOString();

const server = await createServer({
  configFile: path.join(projectRoot, "vite.config.ts"),
  configLoader: "runner",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const machine = await server.ssrLoadModule("/src/state/runtimeMachine.ts");
  const runtimeTypes = await server.ssrLoadModule("/src/runtimeTypes.ts");
  const bridge = await server.ssrLoadModule(
    "/src/bridges/session6Bridge.v2.ts",
  );
  const engineProjection = await server.ssrLoadModule(
    "/src/adapters/engineProjection.v1.ts",
  );

  const answers = {
    math: {
      "warm-up": "2/4",
      "visual-lesson": "6/8",
      "guided-practice": "2",
      "independent-attempt": "4/10",
      "exit-ticket": "4/6",
    },
    reading: {
      "warm-up": "however",
      "visual-lesson": "hesitant",
      "guided-practice": "shy",
      "independent-attempt":
        "Weary means tired because Leila dropped her backpack and sank onto a bench.",
      "exit-ticket": "easily-broken",
    },
  };

  function begin(subjectId) {
    return machine.completeCheckIn(
      machine.createRuntimeWorkspace(subjectId, at(0)),
      "ready",
      at(1),
    );
  }

  function answerAndAdvance(workspace, response, step) {
    const segment = workspace.currentSegment;
    let next = machine.setResponseDraft(workspace, segment, response, at(step));
    next = machine.submitCurrentResponse(next, at(step + 1));
    if (next.feedback[segment] !== "ready") {
      throw new Error(`Trace fixture was not accepted at ${segment}.`);
    }
    return machine.completeCurrentSegment(next, at(step + 2));
  }

  function reflectAndAdvance(workspace, reflection, step) {
    let next = machine.setReflectionValue(
      workspace,
      "confidence",
      reflection.confidence,
      at(step),
    );
    next = machine.setReflectionValue(
      next,
      "effort",
      reflection.effort,
      at(step + 1),
    );
    next = machine.setReflectionValue(
      next,
      "frustration",
      reflection.frustration,
      at(step + 2),
    );
    next = machine.submitCurrentResponse(next, at(step + 3));
    return machine.completeCurrentSegment(next, at(step + 4));
  }

  function opening(subjectId) {
    let workspace = begin(subjectId);
    workspace = answerAndAdvance(
      workspace,
      answers[subjectId]["warm-up"],
      10,
    );
    workspace = answerAndAdvance(
      workspace,
      answers[subjectId]["visual-lesson"],
      20,
    );
    return answerAndAdvance(
      workspace,
      answers[subjectId]["guided-practice"],
      30,
    );
  }

  function traceDocument(workspace, scenario, checkpoints) {
    const integrity = machine.validateRuntimeWorkspaceIntegrity(workspace);
    if (!integrity.ok) {
      throw new Error(`Generated trace failed integrity: ${integrity.code}.`);
    }
    return {
      traceVersion: "student-runtime.deterministic-trace.v2",
      generatedAt: at(90),
      scenario,
      versions: {
        canonicalSchema: machine.canonicalSchemaVersion(),
        workspace: runtimeTypes.STUDENT_RUNTIME_VERSION,
        engineProjection: engineProjection.ENGINE_PROJECTION_VERSION,
        tutorBoundary: bridge.TEMPORARY_SESSION6_BRIDGE_VERSION,
      },
      identifiers: {
        learnerReference: workspace.plan.studentId,
        lessonId: workspace.plan.lessonId,
        planId: workspace.plan.id,
        subjectId: workspace.plan.subjectId,
        skillId: workspace.plan.segments.at(-1).masteryCheck.skillIds[0],
        sessionId: workspace.canonicalSession.id,
        segmentIds: workspace.plan.segmentSequence,
        taskRefs: workspace.plan.segmentSequence,
      },
      checkpoints,
      canonicalEvents: workspace.canonicalSession.eventLog,
      idempotencyRecords: workspace.idempotencyRecords,
      tutorBoundaryReceipts: workspace.tutorCoreReceipts,
      evidence: workspace.evidenceRecords,
      review: workspace.reviewRecords,
      engineRecommendations: workspace.engineOutputs,
      durationPolicy: workspace.durationPolicy,
      messageReasonCodes: workspace.transcript.map(
        (entry) => entry.reasonCode,
      ),
      assertions: {
        canonicalIntegrityAccepted: true,
        segmentCompletionIsProgressAuthority: true,
        rawAnswersIncluded: false,
        piiIncluded: false,
        masteryAuthoredByBrowser: false,
        misconceptionAuthoredByBrowser: false,
      },
    };
  }

  let math = opening("math");
  const mathDraft = answers.math["independent-attempt"];
  math = machine.setResponseDraft(
    math,
    "independent-attempt",
    mathDraft,
    at(40),
  );
  math = machine.requestBreak(math, at(41), "student-request");
  const mathBreakNonFailure = math.breakState?.countsAsFailure === false;
  math = machine.chooseBreakActivity(math, "water", at(42));
  math = machine.resumeBreak(math, at(43));
  const mathExactResume =
    math.currentSegment === "independent-attempt" &&
    math.responses["independent-attempt"] === mathDraft;
  math = machine.submitCurrentResponse(math, at(44));
  math = machine.completeCurrentSegment(math, at(45));
  math = reflectAndAdvance(
    math,
    { confidence: "ready", effort: "steady", frustration: "calm" },
    50,
  );
  math = answerAndAdvance(math, answers.math["exit-ticket"], 60);

  let reading = opening("reading");
  const readingDraft = answers.reading["independent-attempt"];
  reading = machine.setResponseDraft(
    reading,
    "independent-attempt",
    readingDraft,
    at(40),
  );
  reading = machine.submitCurrentResponse(reading, at(41));
  reading = machine.completeCurrentSegment(reading, at(42));
  reading = reflectAndAdvance(
    reading,
    { confidence: "not-yet", effort: "a-lot", frustration: "some" },
    50,
  );
  reading = machine.setResponseDraft(
    reading,
    "exit-ticket",
    answers.reading["exit-ticket"],
    at(60),
  );
  reading = machine.saveAndExit(reading, at(61));
  const savedSegment =
    reading.canonicalSession.status === "paused"
      ? reading.canonicalSession.resumePoint.segmentId
      : undefined;
  reading = machine.resumeSavedSession(structuredClone(reading), at(62));
  const readingExactResume =
    reading.currentSegment === "exit-ticket" &&
    reading.responses["exit-ticket"] === answers.reading["exit-ticket"];
  reading = machine.submitCurrentResponse(reading, at(63));
  reading = machine.completeCurrentSegment(reading, at(64));

  const documents = [
    {
      name: "math-water-break.trace.json",
      value: traceDocument(math, "grade-5-math-water-break-exact-resume", {
        waterBreakApproved: true,
        breakCountsAsFailure: !mathBreakNonFailure,
        exactDraftResumeMatchedLocally: mathExactResume,
        resumedSegment: "independent-attempt",
        enteredWorkExported: false,
      }),
    },
    {
      name: "reading-save-resume.trace.json",
      value: traceDocument(
        reading,
        "grade-5-reading-low-confidence-save-refresh-resume",
        {
          lowConfidenceSupportEmitted: reading.transcript.some(
            (entry) => entry.reasonCode === "low-confidence-support",
          ),
          savedSegment,
          exactDraftResumeMatchedLocally: readingExactResume,
          enteredWorkExported: false,
        },
      ),
    },
  ];

  await mkdir(outputDirectory, { recursive: true });
  for (const document of documents) {
    const serialized = `${JSON.stringify(document.value, null, 2)}\n`;
    for (const raw of [
      answers.math["independent-attempt"],
      answers.reading["independent-attempt"],
      answers.reading["exit-ticket"],
    ]) {
      if (serialized.includes(raw)) {
        throw new Error(`Raw entered work leaked into ${document.name}.`);
      }
    }
    await writeFile(
      path.join(outputDirectory, document.name),
      serialized,
      "utf8",
    );
  }
} finally {
  await server.close();
}
