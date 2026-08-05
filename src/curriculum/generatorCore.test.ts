import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { makeCurriculumQuestion } from './generatorCore'

afterEach(() => setRng(null))

describe('generatorCore distinct distractor mode', () => {
  it('normalizes whitespace before de-duplicating under a constant RNG', () => {
    setRng(() => 0.999_999_999)
    const question = makeCurriculumQuestion({
      itemType: 'core-regression',
      standard: 'test',
      lessonFocus: 'test',
      difficulty: 1,
      prompt: 'Which choice is zero?',
      correctAnswer: '0',
      distractors: ['1', ' 1 ', '2', '3'],
      parameters: {},
      workedExample: {
        prompt: 'Which choice is zero?',
        answer: '0',
        steps: ['Zero is written as 0.', 'Select 0.'],
      },
      distractorMode: 'distinct',
    })

    expect(question.choices).toHaveLength(4)
    expect(new Set(question.choices).size).toBe(4)
    expect(new Set(question.choices)).toEqual(new Set(['0', '1', '2', '3']))
  })

  it('fails closed when normalized distractors cannot fill the choice set', () => {
    expect(() =>
      makeCurriculumQuestion({
        itemType: 'core-regression',
        standard: 'test',
        lessonFocus: 'test',
        difficulty: 1,
        prompt: 'Which choice is zero?',
        correctAnswer: '0',
        distractors: ['1', ' 1 ', '2'],
        parameters: {},
        workedExample: {
          prompt: 'Which choice is zero?',
          answer: '0',
          steps: ['Zero is written as 0.', 'Select 0.'],
        },
        distractorMode: 'distinct',
      }),
    ).toThrow(/Expected at least 3 distinct distractors/)
  })
})
