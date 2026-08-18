export interface RhythmContext {
  readonly rules: unknown
  readonly reviewSchema: unknown
}

export function rhythmViolations(lesson: unknown, context: RhythmContext): string[]
