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

export interface TutorProgramRegistration {
  readonly program: TutorProgram;
  /**
   * Ids the frozen content declares for this program: sequenceId, lessonId,
   * the sequence's skillIds, and its legacy host skill mappings. Study-
   * namespace ids (e.g. "skill:equivalent-fractions") are intentionally not
   * mapped here — naming that mapping is a curriculum decision, not a
   * registration one — and resolve to the subject's default program.
   */
  readonly routingIds: ReadonlySet<string>;
}

export interface TutorSubjectRegistration {
  readonly subject: TutorBridgeSubject;
  /** Ordered program registrations; index 0 is the subject default. */
  readonly programs: readonly TutorProgramRegistration[];
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
    return {
      program: result.value,
      routingIds: new Set([
        sequence.sequenceId,
        sequence.lessonId,
        ...sequence.skillIds,
        ...sequence.legacySkillMappings,
      ]),
    };
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
    programs: [
      {
        program: englishTutorProgram,
        routingIds: new Set([englishTutorProgram.targetSkillId]),
      },
    ],
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
 * Returns the first registered program whose frozen-declared routing ids
 * contain any of the requested ids, else the subject's default program.
 * Matching is exact; no id transformation is attempted.
 */
export function selectTutorProgram(
  registration: TutorSubjectRegistration,
  ...requestIds: readonly string[]
): TutorProgram {
  const matched = registration.programs.find((entry) =>
    requestIds.some((id) => entry.routingIds.has(id)),
  );
  const entry = matched ?? registration.programs[0];
  if (!entry) {
    throw new Error(
      `Subject "${registration.subject}" has no registered tutor program.`,
    );
  }
  return entry.program;
}
