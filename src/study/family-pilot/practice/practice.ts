import type { Difficulty, Visual } from '../../../types'
import type { PilotLessonRef } from '../../../curriculum/family-pilot/types'
import type { CurriculumWorkedExample } from '../../../curriculum/generatorCore'
import { mathPracticeUnit } from './mathPracticeUnit'

/**
 * FAMILY-PILOT-PRACTICE-1 — bridges the Family Pilot's lesson refs to the
 * existing, reviewed Grade 5/7/8 math generators (src/curriculum). This
 * module holds no curriculum content or generation logic of its own: every
 * question, choice, and worked example is exactly what the underlying
 * generator produced. It also never reads or writes Profile/academy state —
 * generating or checking practice cannot mutate a student's working grade or
 * advance their curriculum.
 */

export const PILOT_PRACTICE_ITEM_COUNT = 10

/**
 * Difficulty is a caller-supplied parameter, not a decision this module
 * makes. The Study Engine already owns adaptive sequencing; this bridge does
 * not infer difficulty from a learner's history.
 */
export const PILOT_PRACTICE_DEFAULT_DIFFICULTY: Difficulty = 1

export interface PilotPracticeItem {
  readonly itemRef: string
  readonly lessonId: string
  readonly unitNumber: number
  readonly itemType: string
  readonly difficulty: Difficulty
  readonly prompt: string
  readonly choices: readonly string[]
  readonly answerIndex: number
  readonly workedExample: CurriculumWorkedExample
  readonly visual?: Visual
}

export type PilotPracticeResult =
  | { readonly status: 'available'; readonly items: readonly PilotPracticeItem[] }
  | { readonly status: 'practice-unavailable' }

export interface PilotPracticeAnswerResult {
  readonly itemRef: string
  readonly correct: boolean
  readonly correctAnswer: string
}

export interface PilotPracticeSummary {
  readonly itemCount: number
  readonly correctCount: number
  readonly accuracy: number
}

export interface GeneratePilotPracticeOptions {
  readonly itemCount?: number
  readonly difficulty?: Difficulty
}

/**
 * True only when a reviewed generator exists for this lesson's grade/unit.
 * Read-only: does not touch student/profile state.
 */
export function canGeneratePilotPractice(lessonRef: PilotLessonRef): boolean {
  return mathPracticeUnit(lessonRef.grade, lessonRef.unitNumber) !== undefined
}

/**
 * Round-robins the lesson's unit's own reviewed item types, the same
 * convention the existing Grade 5 practice bridge uses. Practice items always
 * belong to `lessonRef`'s own unit — there is no cross-unit or cross-grade
 * selection. Returns `practice-unavailable` rather than inventing a question
 * when the lesson's grade/unit has no reviewed generator.
 */
export function generatePilotPractice(
  lessonRef: PilotLessonRef,
  options: GeneratePilotPracticeOptions = {},
): PilotPracticeResult {
  const unit = mathPracticeUnit(lessonRef.grade, lessonRef.unitNumber)
  if (!unit) return { status: 'practice-unavailable' }

  const itemCount = options.itemCount ?? PILOT_PRACTICE_ITEM_COUNT
  const difficulty = options.difficulty ?? PILOT_PRACTICE_DEFAULT_DIFFICULTY

  const items: PilotPracticeItem[] = []
  for (let index = 0; index < itemCount; index += 1) {
    const itemType = unit.itemTypes[index % unit.itemTypes.length]
    const question = unit.generate(itemType, difficulty)
    items.push({
      itemRef: `${lessonRef.lessonId}:u${unit.unitNumber}:${itemType}:${index}`,
      lessonId: lessonRef.lessonId,
      unitNumber: unit.unitNumber,
      itemType,
      difficulty,
      prompt: question.prompt,
      choices: question.choices,
      answerIndex: question.answerIndex,
      workedExample: question.workedExample,
      ...(question.visual ? { visual: question.visual } : {}),
    })
  }
  return { status: 'available', items }
}

/**
 * Compares against the item's own answer index — the generator's answer
 * authority, unchanged. Does not read or write any student/profile state.
 */
export function checkPilotPracticeAnswer(
  item: PilotPracticeItem,
  selectedIndex: number,
): PilotPracticeAnswerResult {
  return {
    itemRef: item.itemRef,
    correct: selectedIndex === item.answerIndex,
    correctAnswer: item.choices[item.answerIndex],
  }
}

/** Pure aggregate over already-checked answers. Never persists anything. */
export function practiceSummary(results: readonly PilotPracticeAnswerResult[]): PilotPracticeSummary {
  const itemCount = results.length
  const correctCount = results.filter((result) => result.correct).length
  return {
    itemCount,
    correctCount,
    accuracy: itemCount === 0 ? 0 : correctCount / itemCount,
  }
}
