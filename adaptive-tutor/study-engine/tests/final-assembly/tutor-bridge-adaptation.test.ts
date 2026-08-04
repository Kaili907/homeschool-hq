import {
  TutorProgramSchema,
  validateWithSchema,
} from "../../../core/index.ts";
import { InMemoryAcceptedEventLedger } from "../../runtime/src/ledger.ts";
import { resolveTutorSubjectRegistration } from "../../runtime/src/subject-registry.ts";
import {
  adaptProgramToExpectedAnswer,
  runSafeTutorBridge,
} from "../../runtime/src/tutor-bridge.ts";
import { bridgeRequest, localDemoSafety } from "./helpers.ts";

describe("tutor bridge program adaptation", () => {
  it("preserves the full diagnostic item set while adapting the first item", () => {
    const program = resolveTutorSubjectRegistration("math").programs[0];
    expect(program).toBeDefined();
    if (!program) return;
    const adapted = adaptProgramToExpectedAnswer(program, "42");
    expect(adapted.diagnosticItems).toHaveLength(
      program.diagnosticItems.length,
    );
    expect(adapted.diagnosticItems.length).toBeGreaterThan(1);
    const first = adapted.diagnosticItems[0];
    const sourceFirst = program.diagnosticItems[0];
    expect(first).toBeDefined();
    expect(sourceFirst).toBeDefined();
    if (!first || !sourceFirst) return;
    expect(first.kind).toBe("short-answer");
    if (first.kind !== "short-answer") return;
    expect(first.acceptedAnswers).toEqual(["42"]);
    expect(first.id).toBe(sourceFirst.id);
    expect(first.skillId).toBe(sourceFirst.skillId);
    for (let index = 1; index < program.diagnosticItems.length; index += 1) {
      expect(adapted.diagnosticItems[index]).toBe(
        program.diagnosticItems[index],
      );
    }
    const ids = adapted.diagnosticItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps adapted programs valid against the frozen TutorProgramSchema", () => {
    for (const subject of ["math", "english"] as const) {
      const program = resolveTutorSubjectRegistration(subject).programs[0];
      if (!program) throw new Error(`No default program for ${subject}.`);
      const adapted = adaptProgramToExpectedAnswer(program, "3/4");
      expect(validateWithSchema(TutorProgramSchema, adapted).ok).toBe(true);
    }
  });

  it("accepts a math turn against the registered Math R1 program", async () => {
    const result = await runSafeTutorBridge(bridgeRequest(), {
      eventLedger: new InMemoryAcceptedEventLedger(),
      safety: localDemoSafety,
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.coreSubmitInvocations).toBe(1);
  });

  it("accepts an english turn against the undisturbed english registration", async () => {
    const result = await runSafeTutorBridge(
      bridgeRequest({
        requestId: "event:final-assembly:english-adaptation:001",
        subject: "english",
        skillId: "skill:main-idea",
      }),
      {
        eventLedger: new InMemoryAcceptedEventLedger(),
        safety: localDemoSafety,
      },
    );
    expect(result.status).toBe("accepted");
  });
});
