/**
 * Ambient seam for the frozen Math R1 subject package at
 * adaptive-tutor/subjects/math. The frozen sources compile under the
 * package's own tsconfig, not this runtime's stricter flags, and must not
 * be modified, so they stay out of this typecheck program. Vite resolves
 * the alias to the real sources (see vite.config.ts / vitest.config.ts),
 * and subject-registry.ts re-validates every adapted program against
 * TutorProgramSchema before registration.
 */
declare module "@frozen/tutor-math-r1" {
  export interface FrozenMathSequence {
    readonly sequenceId: string;
    readonly lessonId: string;
    readonly title: string;
  }
  export const mathSubjectManifest: {
    readonly subjectId: "math";
    readonly version: string;
    readonly title: string;
    readonly sequenceIds: readonly string[];
    readonly lessons: readonly FrozenMathSequence[];
  };
  export function adaptSequenceToTutorProgramV02(
    sequence: FrozenMathSequence,
  ): unknown;
}
