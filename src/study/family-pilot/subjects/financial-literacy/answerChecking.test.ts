import { describe, expect, it } from 'vitest'
import { checkFinancialLiteracyAnswer, financialLiteracyAssessmentItem } from './answerChecking'
import { practiceForUnit } from './practiceBridge'

const availability = practiceForUnit('8', 1)
if (availability.status !== 'available') throw new Error('expected grade 8 PF1 practice to be bridged')
const question = availability.generate(availability.itemTypes[0], 2)

describe('FAMILY-PILOT-FINLIT-1 answerChecking (existing authority)', () => {
  it('builds a reviewed multiple-choice AssessmentItem from a generated question', () => {
    const item = financialLiteracyAssessmentItem(question, 'lesson-ref', 8)
    expect(item.kind).toBe('multiple-choice')
    expect(item.subject).toBe('general')
    if (item.kind === 'multiple-choice') {
      expect(item.options.length).toBe(question.choices.length)
      expect(item.correctOptionIds).toEqual([`choice-${question.answerIndex}`])
    }
  })

  it('marks the correct choice as correct via the Tutor Core evaluator', () => {
    const result = checkFinancialLiteracyAnswer(question, 'lesson-ref', 8, question.answerIndex)
    expect(result.isCorrect).toBe(true)
    expect(result.score).toBe(1)
  })

  it('marks any other choice as incorrect via the Tutor Core evaluator', () => {
    const wrongIndex = question.answerIndex === 0 ? 1 : 0
    const result = checkFinancialLiteracyAnswer(question, 'lesson-ref', 8, wrongIndex)
    expect(result.isCorrect).toBe(false)
    expect(result.score).toBe(0)
  })

  it('never crashes on an out-of-range choice index and simply marks it incorrect', () => {
    const result = checkFinancialLiteracyAnswer(question, 'lesson-ref', 8, 999)
    expect(result.isCorrect).toBe(false)
    expect(result.selectedChoice).toBeNull()
  })
})
