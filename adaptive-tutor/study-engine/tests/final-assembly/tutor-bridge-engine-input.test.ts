import type { TutorProgram } from "../../../core/index.ts";
import { InMemoryAcceptedEventLedger } from "../../runtime/src/ledger.ts";
import { resolveTutorSubjectRegistration } from "../../runtime/src/subject-registry.ts";
import { runSafeTutorBridge } from "../../runtime/src/tutor-bridge.ts";
import { bridgeRequest, clearOutputSafety, localDemoSafety } from "./helpers.ts";

const recordedPrograms = vi.hoisted(() => ({ values: [] as unknown[] }));

vi.mock("../../../core/index.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../core/index.ts")>();
  class RecordingAdaptiveTutorEngine extends actual.AdaptiveTutorEngine {
    constructor(
      ...args: ConstructorParameters<typeof actual.AdaptiveTutorEngine>
    ) {
      super(...args);
      recordedPrograms.values.push(args[0]);
    }
  }
  return { ...actual, AdaptiveTutorEngine: RecordingAdaptiveTutorEngine };
});

describe("tutor bridge engine input", () => {
  it("constructs the engine with the registry's math program and the full diagnostic set", async () => {
    recordedPrograms.values.length = 0;
    const registered = resolveTutorSubjectRegistration("math").programs[0];
    expect(registered).toBeDefined();
    if (!registered) return;
    const result = await runSafeTutorBridge(
      bridgeRequest({ requestId: "event:final-assembly:engine-input:001" }),
      {
        eventLedger: new InMemoryAcceptedEventLedger(),
        safety: localDemoSafety,
        outputSafety: clearOutputSafety,
      },
    );
    expect(result.status).toBe("accepted");
    expect(recordedPrograms.values).toHaveLength(1);
    const fed = recordedPrograms.values[0] as TutorProgram;
    expect(fed.id).toBe(registered.program.id);
    expect(fed.diagnosticItems).toHaveLength(
      registered.program.diagnosticItems.length,
    );
    const first = fed.diagnosticItems[0];
    expect(first?.kind).toBe("short-answer");
    if (first?.kind !== "short-answer") return;
    expect(first.acceptedAnswers).toEqual(["3/4"]);
  });
});
