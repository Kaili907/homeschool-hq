import type { FixedTest, Item } from '../types'
import { HS_MATH_DIAGNOSTIC } from './mathDiagnostic'
import { HS_READING } from './reading'
import { HS_GRAMMAR } from './grammar'
import { HS_ESSAY, HS_ESSAY_SENIOR_B } from './essays'
import { HS_READING_SURVEY } from './survey'

export const ALL_TESTS: FixedTest[] = [
  HS_MATH_DIAGNOSTIC,
  HS_READING,
  HS_GRAMMAR,
  HS_ESSAY,
  HS_ESSAY_SENIOR_B,
  HS_READING_SURVEY,
]

export const TEST_BY_ID: Record<string, FixedTest> = Object.fromEntries(
  ALL_TESTS.map((t) => [t.id, t]),
)

export function testsForGrade(grade: string): FixedTest[] {
  return ALL_TESTS.filter((t) => t.forGrades.includes(grade))
}

export function allItems(test: FixedTest): Item[] {
  return test.sections.flatMap((s) => s.items)
}

export function itemCount(test: FixedTest): number {
  return test.sections.reduce((n, s) => n + s.items.length, 0)
}

export {
  HS_MATH_DIAGNOSTIC,
  HS_READING,
  HS_GRAMMAR,
  HS_ESSAY,
  HS_ESSAY_SENIOR_B,
  HS_READING_SURVEY,
}
