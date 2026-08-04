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
    for (const entry of registration.programs) {
      expect(validateWithSchema(TutorProgramSchema, entry.program).ok).toBe(
        true,
      );
    }
  });

  it("keeps every Math R1 diagnostic item aligned with its program's target skill", () => {
    const registration = resolveTutorSubjectRegistration("math");
    for (const entry of registration.programs) {
      expect(entry.program.diagnosticItems.length).toBeGreaterThan(1);
      for (const item of entry.program.diagnosticItems) {
        expect(item.skillId).toBe(entry.program.targetSkillId);
      }
    }
  });

  it("routes requests by the frozen content's declared ids", () => {
    const registration = resolveTutorSubjectRegistration("math");
    const targetSkillIds = registration.programs.map(
      (entry) => entry.program.targetSkillId,
    );
    expect(new Set(targetSkillIds).size).toBe(registration.programs.length);

    // Legacy host skill id declared by sequence 03 (equivalent fractions).
    expect(selectTutorProgram(registration, "fracUnit").targetSkillId).toBe(
      "math-skill-fr-equivalence-v1",
    );
    // Tutor-native skill id beyond skillIds[0], declared by sequence 04.
    expect(
      selectTutorProgram(registration, "math-skill-wp-plan-v1").targetSkillId,
    ).toBe("math-skill-wp-represent-v1");
    // Frozen lesson id routes to its own sequence.
    expect(
      selectTutorProgram(
        registration,
        "math-lesson-02-multiplication-division-relationships",
      ).targetSkillId,
    ).toBe("math-skill-md-equal-groups-v1");
    // Study-namespace ids are unmapped and fall back to the default program.
    expect(
      selectTutorProgram(registration, "skill:equivalent-fractions"),
    ).toBe(registration.programs[0]?.program);
    // Later request ids still match when the first id is unmapped.
    expect(
      selectTutorProgram(registration, "skill:equivalent-fractions", "fracComp")
        .targetSkillId,
    ).toBe("math-skill-fr-equivalence-v1");
  });

  it("leaves the english registration on the demonstration program and hooks", () => {
    const registration = resolveTutorSubjectRegistration("english");
    expect(registration.programs).toHaveLength(1);
    expect(registration.programs[0]?.program).toBe(englishTutorProgram);
    expect(registration.hooks).toBe(englishRuntimeHooks);
  });

  it("fails closed for unregistered subjects", () => {
    expect(() =>
      resolveTutorSubjectRegistration("science" as TutorBridgeSubject),
    ).toThrowError(/No tutor subject registration/);
  });
});
