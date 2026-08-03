import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  completeCurrentSegment,
  requestBreak,
  resumeBreak,
  setResponseDraft,
  submitCurrentResponse,
} from "@runtime/state/runtimeMachine";
import type { RuntimeSubjectId, RuntimeWorkspaceV1 } from "@runtime/runtimeTypes";
import {
  acceptedResponse,
  answerAndAdvance,
  beginLearning,
  reflectAndAdvance,
  traceAt,
} from "./runtimeHarness";

async function build(subject: RuntimeSubjectId) {
  let workspace = beginLearning(subject);
  for (const [index, segment] of [
    "warm-up",
    "visual-lesson",
    "guided-practice",
  ].entries()) {
    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse(subject, segment as "warm-up"),
      10 + index * 10,
    );
  }
  workspace = setResponseDraft(
    workspace,
    "independent-attempt",
    acceptedResponse(subject, "independent-attempt"),
    traceAt(40),
  );
  if (subject === "math") {
    workspace = requestBreak(workspace, traceAt(41));
    workspace = resumeBreak(workspace, traceAt(42));
  }
  workspace = await submitCurrentResponse(workspace, traceAt(43));
  workspace = completeCurrentSegment(workspace, traceAt(44));
  workspace = await reflectAndAdvance(
    workspace,
    {
      confidence: subject === "reading" ? "not-yet" : "ready",
      effort: "steady",
      frustration: subject === "reading" ? "some" : "calm",
    },
    50,
  );
  return answerAndAdvance(
    workspace,
    acceptedResponse(subject, "exit-ticket"),
    60,
  );
}

function projection(subject: RuntimeSubjectId, workspace: RuntimeWorkspaceV1) {
  return {
    traceVersion: "student-runtime.deterministic-trace.r2",
    scenario:
      subject === "math"
        ? "grade-5-math-water-break-exact-resume"
        : "grade-5-reading-support-exact-resume",
    versions: {
      workspace: "student-runtime.workspace.v2",
      tutorBoundary: "1.0.1",
      bridgeContractVersion: 1,
    },
    canonicalEvents: workspace.canonicalSession.eventLog,
    tutorBoundaryReceipts: workspace.tutorCoreReceipts.map((receipt) => ({
      ...receipt,
      processingOrder: [
        "event-ledger-accepted",
        "minimized-study-projection",
      ],
    })),
    evidence: workspace.evidenceRecords,
    review: workspace.reviewRecords,
    assertions: {
      ledgerAcceptedBeforeProjection: workspace.tutorCoreReceipts.every(
        (receipt) => receipt.ledgerAccepted,
      ),
      rawAnswersIncluded: false,
      transcriptsIncluded: false,
    },
  };
}

describe("current-runtime trace generation", () => {
  it("builds deterministic traces through acceptedStudyCoreBridge", async () => {
    const first = await Promise.all([build("math"), build("reading")]);
    const second = await Promise.all([build("math"), build("reading")]);
    const outputs = first.map((workspace, index) =>
      projection(index === 0 ? "math" : "reading", workspace),
    );
    expect(JSON.stringify(outputs)).toBe(
      JSON.stringify(
        second.map((workspace, index) =>
          projection(index === 0 ? "math" : "reading", workspace),
        ),
      ),
    );
    expect(outputs.every((output) =>
      output.tutorBoundaryReceipts.every(
        (receipt) =>
          receipt.bridgeVersion === "1.0.1" &&
          receipt.bridgeContractVersion === 1 &&
          receipt.ledgerAccepted,
      ),
    )).toBe(true);
    if (process.env.STUDENT_RUNTIME_WRITE_TRACES === "1") {
      const traceRoot = path.resolve(
        process.cwd(),
        "../../docs/student-runtime/sample-traces",
      );
      for (const [index, filename] of [
        "math-water-break.trace.json",
        "reading-save-resume.trace.json",
      ].entries()) {
        const bytes = `${JSON.stringify(outputs[index], null, 2)}\n`;
        expect(createHash("sha256").update(bytes).digest("hex")).toHaveLength(64);
        await writeFile(path.join(traceRoot, filename), bytes, "utf8");
      }
    }
  });
});
