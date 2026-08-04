/// <reference path="./frozen-math-r1.d.ts" />
import {
  TutorProgramSchema,
  validateWithSchema,
  type TutorProgram,
  type TutorRuntimeHooks,
} from "../../../core/index.ts";
import {
  englishRuntimeHooks,
  englishTutorProgram,
} from "../../../examples/english-interaction.ts";
import {
  adaptSequenceToTutorProgramV02,
  mathSubjectManifest,
} from "@frozen/tutor-math-r1";

export type TutorBridgeSubject = "math" | "english";

export interface TutorSubjectRegistration {
  readonly subject: TutorBridgeSubject;
  /** Ordered tutor programs registered for the subject; index 0 is the default. */
  readonly programs: readonly TutorProgram[];
  readonly hooks: Partial<TutorRuntimeHooks>;
}

let cachedMathRegistration: TutorSubjectRegistration | null = null;

/**
 * The frozen Math R1 package ships no compiled output and its adapter is
 * typed package-side only, so every adapted program is re-validated against
 * the frozen Core's TutorProgramSchema here. Registration fails closed.
 */
function mathRegistration(): TutorSubjectRegistration {
  if (cachedMathRegistration) return cachedMathRegistration;
  const programs = mathSubjectManifest.lessons.map((sequence) => {
    const adapted = adaptSequenceToTutorProgramV02(sequence);
    const result = validateWithSchema<TutorProgram>(TutorProgramSchema, adapted);
    if (!result.ok) {
      throw new Error(
        `Frozen Math R1 sequence "${sequence.sequenceId}" failed TutorProgram validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.value;
  });
  if (programs.length === 0) {
    throw new Error("Frozen Math R1 manifest registered no lessons.");
  }
  cachedMathRegistration = { subject: "math", programs, hooks: {} };
  return cachedMathRegistration;
}

function englishRegistration(): TutorSubjectRegistration {
  return {
    subject: "english",
    programs: [englishTutorProgram],
    hooks: englishRuntimeHooks,
  };
}

const subjectRegistrations: ReadonlyMap<
  TutorBridgeSubject,
  () => TutorSubjectRegistration
> = new Map([
  ["math", mathRegistration],
  ["english", englishRegistration],
]);

export function resolveTutorSubjectRegistration(
  subject: TutorBridgeSubject,
): TutorSubjectRegistration {
  const registration = subjectRegistrations.get(subject);
  if (!registration) {
    throw new Error(`No tutor subject registration for subject "${subject}".`);
  }
  return registration();
}

/**
 * Returns the registered program whose targetSkillId exactly matches the
 * requested skill id, else the subject's default program (index 0). Study
 * ids are opaque to the tutor layer, so no transformation is attempted.
 */
export function selectTutorProgram(
  registration: TutorSubjectRegistration,
  skillId: string,
): TutorProgram {
  const matched = registration.programs.find(
    (program) => program.targetSkillId === skillId,
  );
  const program = matched ?? registration.programs[0];
  if (!program) {
    throw new Error(
      `Subject "${registration.subject}" has no registered tutor program.`,
    );
  }
  return program;
}
