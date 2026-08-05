import type { Difficulty, Visual } from '../../types'
import { finishChoices, shuffle } from '../../genUtils'

/**
 * Student-surface-neutral question contract for curriculum generators.
 *
 * It deliberately mirrors the existing `Question` convention (`difficulty`,
 * `prompt`, `choices`, `answerIndex`) without registering a trainer `SkillId` or
 * mounting anything in the app. Later curriculum units can reuse this contract
 * while their own item-type union remains explicit and exhaustively tested.
 */
export interface CurriculumQuestion<ItemType extends string> {
  itemType: ItemType
  difficulty: Difficulty
  prompt: string
  visual?: Visual
  choices: string[]
  answerIndex: number
}

export type CurriculumGenerator<ItemType extends string> = (
  difficulty: Difficulty,
) => CurriculumQuestion<ItemType>

export interface WorkedExample<ItemType extends string> {
  itemType: ItemType
  problem: string
  teaching: string
  answer: string
}

/**
 * Reusable curriculum equivalent of the repo's existing multiple-choice return
 * pattern. Choice construction stays centralized in `genUtils.finishChoices`, so
 * shuffling, injected randomness, uniqueness, and fallback behavior are shared
 * with the established Grade 3/4/6 generators rather than reimplemented here.
 */
export function curriculumMultipleChoice<ItemType extends string>(
  itemType: ItemType,
  difficulty: Difficulty,
  prompt: string,
  correct: string,
  distractors: string[],
  options?: { count?: number; visual?: Visual },
): CurriculumQuestion<ItemType> {
  const count = options?.count ?? 4
  const usableDistractors = [...new Set(distractors)]
    .filter((candidate) => candidate.trim() !== '' && candidate !== correct)
  if (usableDistractors.length < count - 1) {
    throw new Error(
      `Curriculum item ${itemType} supplied ${usableDistractors.length} distinct distractors; ${count - 1} required`,
    )
  }
  const shuffledDistractors = shuffle(usableDistractors)
  let distractorIndex = 0

  return {
    itemType,
    difficulty,
    prompt,
    ...(options?.visual ? { visual: options.visual } : {}),
    ...finishChoices(
      correct,
      () => shuffledDistractors[distractorIndex++ % shuffledDistractors.length],
      count,
    ),
  }
}

/** Exact integer scale used by Grade 5 decimal generators (1 unit = 0.001). */
export const THOUSANDTHS_SCALE = 1000

/**
 * Format an integer number of thousandths without binary floating-point math.
 * `minimumPlaces` preserves instructional trailing zeros when place value matters.
 */
export function formatThousandths(
  scaled: number,
  minimumPlaces: 0 | 1 | 2 | 3 = 0,
): string {
  if (!Number.isSafeInteger(scaled)) {
    throw new Error('formatThousandths requires a safe integer')
  }

  const sign = scaled < 0 ? '-' : ''
  const magnitude = Math.abs(scaled)
  const whole = Math.floor(magnitude / THOUSANDTHS_SCALE)
  let fraction = String(magnitude % THOUSANDTHS_SCALE).padStart(3, '0')
  while (fraction.length > minimumPlaces && fraction.endsWith('0')) {
    fraction = fraction.slice(0, -1)
  }

  return fraction.length > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

/** Build an exact thousandths integer from digits displayed to 1-3 places. */
export function toThousandths(
  whole: number,
  fractionalDigits: number,
  places: 1 | 2 | 3,
): number {
  return whole * THOUSANDTHS_SCALE + fractionalDigits * 10 ** (3 - places)
}

/** Positive-number, base-ten "5 rounds up" rounding on the exact integer scale. */
export function roundThousandths(
  scaled: number,
  targetPlaces: 0 | 1 | 2,
): number {
  const quantum = 10 ** (3 - targetPlaces)
  return Math.floor((scaled + quantum / 2) / quantum) * quantum
}

/** Resolve the computed answer using the same answer-index convention as `Question`. */
export function curriculumAnswer<ItemType extends string>(
  question: CurriculumQuestion<ItemType>,
): string {
  return question.choices[question.answerIndex]
}
