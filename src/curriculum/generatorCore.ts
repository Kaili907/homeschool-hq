import type { Difficulty, Visual } from '../types'
import { finishChoices, fromPool } from '../genUtils'

/**
 * Authored teaching prose for one procedural item type. The prose is deliberately
 * stored beside the generator definition, not regenerated with every question.
 */
export interface CurriculumWorkedExample {
  prompt: string
  answer: string
  steps: readonly string[]
}

/**
 * Shared shape for curriculum-backed procedural questions. Later curriculum units
 * can reuse this contract without joining the student-facing skill registry.
 * `parameters` retains the generated facts so tests can recompute the answer with
 * an independent oracle instead of trusting the generator's calculation.
 */
export interface CurriculumQuestion<TItemType extends string, TParameters> {
  itemType: TItemType
  standard: string
  lessonFocus: string
  difficulty: Difficulty
  prompt: string
  visual?: Visual
  choices: string[]
  answerIndex: number
  parameters: TParameters
  workedExample: CurriculumWorkedExample
}

export type CurriculumGenerator<TQuestion> = (difficulty: Difficulty) => TQuestion

interface MultipleChoiceArgs<TItemType extends string, TParameters> {
  itemType: TItemType
  standard: string
  lessonFocus: string
  difficulty: Difficulty
  prompt: string
  correctAnswer: string
  distractors: readonly string[]
  parameters: TParameters
  workedExample: CurriculumWorkedExample
  visual?: Visual
  choiceCount?: number
}

/**
 * Reuses the application's reviewed choice builder so every curriculum unit gets
 * the same shuffling, de-duplication, answer indexing, and valid-form fallback.
 */
export function makeCurriculumQuestion<TItemType extends string, TParameters>(
  args: MultipleChoiceArgs<TItemType, TParameters>,
): CurriculumQuestion<TItemType, TParameters> {
  const { choices, answerIndex } = finishChoices(
    args.correctAnswer,
    fromPool([...args.distractors]),
    args.choiceCount,
  )
  return {
    itemType: args.itemType,
    standard: args.standard,
    lessonFocus: args.lessonFocus,
    difficulty: args.difficulty,
    prompt: args.prompt,
    choices,
    answerIndex,
    parameters: args.parameters,
    workedExample: args.workedExample,
    ...(args.visual ? { visual: args.visual } : {}),
  }
}

/** Correct answer exposed through the same answer-index convention as Question. */
export const curriculumAnswer = (
  question: Pick<CurriculumQuestion<string, unknown>, 'choices' | 'answerIndex'>,
): string => question.choices[question.answerIndex]
