import { CANONICAL_GRADES } from '../release-admission/types.ts'
import type { FinalCurriculumGrade } from './types.ts'

/** Stable ascending order; Grade 6 is deliberately absent. */
export const FINAL_CURRICULUM_GRADES: readonly FinalCurriculumGrade[] = CANONICAL_GRADES

const FINAL_GRADE_SET: ReadonlySet<number> = new Set(FINAL_CURRICULUM_GRADES)

export function isFinalCurriculumGrade(value: unknown): value is FinalCurriculumGrade {
  return typeof value === 'number' && Number.isInteger(value) && FINAL_GRADE_SET.has(value)
}

/** Accepts a canonical integer or its exact decimal spelling. */
export function parseFinalCurriculumGrade(value: unknown): FinalCurriculumGrade | null {
  if (isFinalCurriculumGrade(value)) return value
  if (typeof value !== 'string' || !/^[1-9]\d?$/.test(value)) return null
  const parsed = Number(value)
  return isFinalCurriculumGrade(parsed) ? parsed : null
}

const REF_GRADE = /(?:^|-)g(\d{1,2})(?=-|$)/

/** Parses the whole grade token, so g10/g11/g12 can never truncate to g1. */
export function parseGradeFromCurriculumRef(ref: string): FinalCurriculumGrade | null {
  const match = REF_GRADE.exec(ref)
  return match ? parseFinalCurriculumGrade(match[1]) : null
}
