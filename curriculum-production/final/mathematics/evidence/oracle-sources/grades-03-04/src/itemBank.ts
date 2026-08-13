import type { CommonError, MaterialDifficulty } from './types.ts'
import { G34_UNIT_BANKS } from './g34/registry.ts'

/**
 * One generated item, in the single shape the emitter consumes.
 *
 * `parameters` is the generation record. It is what makes the answer key
 * authoritative rather than merely asserted: a validator can recompute the
 * answer from these parameters without re-running the generator's own code
 * path. Every Grade 3/4 generator additionally supplies `verification` naming
 * the oracle that does so, and item-specific `commonErrors`.
 */
export interface BankItem {
  itemType: string
  standard: string
  lessonFocus: string
  difficulty: MaterialDifficulty
  prompt: string
  choices: readonly string[]
  answerIndex: number
  parameters: Record<string, unknown>
  workedExample: {
    prompt: string
    answer: string
    steps: readonly string[]
  }
  /** Per-item solution steps. Every Grade 3/4 generator supplies these. */
  solutionSteps?: readonly string[]
  commonErrors?: readonly CommonError[]
  verification?: { method: 'recomputed' | 'generator-authority'; oracle: string }
}

export interface UnitBank {
  grade: number
  unitNumber: number
  itemTypes: readonly string[]
  generate(itemType: string, difficulty: MaterialDifficulty, variant?: number): BankItem
}

export const bankKey = (grade: number, unitNumber: number): string => `${grade}:${unitNumber}`

export function unitBankFor(grade: number, unitNumber: number): UnitBank {
  const key = bankKey(grade, unitNumber)
  const bank = G34_UNIT_BANKS[key]
  if (!bank) throw new Error(`No mathematics item bank for grade ${grade} unit ${unitNumber}`)
  return bank
}

/**
 * Grade 3 and Grade 4 are the only grades this pipeline owns, so this is a
 * fixed value rather than a grade-keyed branch (unlike the grades 5-12
 * sibling pipeline, which splits canonical-vs-authored generators by grade).
 */
export const itemSourceFor = (_grade: number): string =>
  'g34-student-work-generators@curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34'
