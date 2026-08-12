import type { Difficulty } from '../../../../src/types.ts'
import type { CommonError, MaterialDifficulty } from './types.ts'
import { CANONICAL_UNIT_BANKS, canonicalBankKey } from './canonicalItemBank.ts'
import { HS_UNIT_BANKS } from './hs/registry.ts'

/**
 * One generated item, in the single shape the emitter consumes.
 *
 * `parameters` is the generation record. It is what makes the answer key
 * authoritative rather than merely asserted: a validator can recompute the
 * answer from these parameters without re-running the generator's own code
 * path. High-school generators additionally supply `verification` naming the
 * oracle that does so, and item-specific `commonErrors`.
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
  /** Per-item solution steps. Authored generators supply these; canonical ones cannot. */
  solutionSteps?: readonly string[]
  commonErrors?: readonly CommonError[]
  verification?: { method: 'recomputed' | 'generator-authority'; oracle: string }
}

export interface UnitBank {
  grade: number
  unitNumber: number
  itemTypes: readonly string[]
  generate(itemType: string, difficulty: MaterialDifficulty): BankItem
}

export const bankKey = canonicalBankKey

function canonicalUnitBank(grade: number, unitNumber: number): UnitBank {
  const bank = CANONICAL_UNIT_BANKS[bankKey(grade, unitNumber)]
  return {
    grade,
    unitNumber,
    itemTypes: bank.itemTypes,
    generate(itemType, difficulty) {
      const question = bank.generators[itemType](difficulty as Difficulty)
      return {
        itemType: question.itemType,
        standard: question.standard,
        lessonFocus: question.lessonFocus,
        difficulty,
        prompt: question.prompt,
        choices: question.choices,
        answerIndex: question.answerIndex,
        parameters: (question.parameters ?? {}) as Record<string, unknown>,
        workedExample: question.workedExample,
      }
    },
  }
}

export function unitBankFor(grade: number, unitNumber: number): UnitBank {
  const key = bankKey(grade, unitNumber)
  if (key in CANONICAL_UNIT_BANKS) return canonicalUnitBank(grade, unitNumber)
  const hs = HS_UNIT_BANKS[key]
  if (hs) return hs
  throw new Error(`No mathematics item bank for grade ${grade} unit ${unitNumber}`)
}

export const itemSourceFor = (grade: number): string =>
  grade <= 8
    ? 'canonical-curriculum-generators@src/curriculum'
    : 'hs912-student-work-generators@curriculum-production/student-work/mathematics/src/hs'
