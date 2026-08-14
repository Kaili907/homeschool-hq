export const G3_ROUNDING_PRODUCTION_LESSON_REF = 'ma-g3-mathematics-u01-l02' as const
export const G3_ROUNDING_CHILD_TITLE = 'Round Numbers to the Nearest 100' as const
export const G3_ROUNDING_CANONICAL_TITLE = 'Concept build A: the place-value structure of three-digit numbers' as const

export function isG3RoundingProductionSample(lessonRef: string): boolean {
  return lessonRef === G3_ROUNDING_PRODUCTION_LESSON_REF
}
