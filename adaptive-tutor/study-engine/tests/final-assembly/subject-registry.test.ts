import {
  TutorProgramSchema,
  validateWithSchema,
} from "../../../core/index.ts";
import {
  englishRuntimeHooks,
  englishTutorProgram,
} from "../../../examples/english-interaction.ts";
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
  type TutorBridgeSubject,
} from "../../runtime/src/subject-registry.ts";
import { mathSubjectManifest } from "@frozen/tutor-math-r1";

describe("tutor subject registry", () => {
  it("registers every frozen Math R1 lesson as a schema-valid tutor program", () => {
    const registration = resolveTutorSubjectRegistration("math");
    expect(registration.subject).toBe("math");
    expect(registration.programs).toHaveLength(
      mathSubjectManifest.lessons.length,
    );
    expect(registration.programs).toHaveLength(4);
    for (const program of registration.programs) {
      expect(validateWithSchema(TutorProgramSchema, program).ok).toBe(true);
    }
  });

  it("keeps every Math R1 diagnostic item aligned with its program's target skill", () => {
    const registration = resolveTutorSubjectRegistration("math");
    for (const program of registration.programs) {
      expect(program.diagnosticItems.length).toBeGreaterThan(1);
      for (const item of program.diagnosticItems) {
        expect(item.skillId).toBe(program.targetSkillId);
      }
    }
  });

  it("leaves the english registration on the demonstration program and hooks", () => {
    const registration = resolveTutorSubjectRegistration("english");
    expect(registration.programs).toHaveLength(1);
    expect(registration.programs[0]).toBe(englishTutorProgram);
    expect(registration.hooks).toBe(englishRuntimeHooks);
  });

  it("fails closed for unregistered subjects", () => {
    expect(() =>
      resolveTutorSubjectRegistration("science" as TutorBridgeSubject),
    ).toThrowError(/No tutor subject registration/);
  });

  it("selects a program by exact targetSkillId match and falls back to the default", () => {
    const registration = resolveTutorSubjectRegistration("math");
    const targetSkillIds = registration.programs.map(
      (program) => program.targetSkillId,
    );
    expect(new Set(targetSkillIds).size).toBe(registration.programs.length);
    const third = registration.programs[2];
    expect(third).toBeDefined();
    if (!third) return;
    expect(selectTutorProgram(registration, third.targetSkillId)).toBe(third);
    expect(
      selectTutorProgram(registration, "skill:equivalent-fractions"),
    ).toBe(registration.programs[0]);
  });
});
