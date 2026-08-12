import { describe, expect, it } from 'vitest'
import { practiceForUnit } from './practiceBridge'

function expectValidQuestion(question: { readonly choices: readonly string[]; readonly answerIndex: number; readonly prompt: string }) {
  expect(question.choices.length).toBeGreaterThanOrEqual(2)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.prompt.trim().length).toBeGreaterThan(0)
}

describe('FAMILY-PILOT-FINLIT-1 practiceBridge (existing-generator bridge)', () => {
  it('bridges a reviewed generator for every grade 5 unit (existing practice compatibility)', () => {
    for (let unitNumber = 1; unitNumber <= 6; unitNumber += 1) {
      const availability = practiceForUnit('5', unitNumber)
      expect(availability.status).toBe('available')
      if (availability.status !== 'available') continue
      expect(availability.itemTypes.length).toBeGreaterThan(0)
      const question = availability.generate(availability.itemTypes[0], 1)
      expectValidQuestion(question)
    }
  })

  it('bridges a reviewed generator for every grade 7 unit (existing practice compatibility)', () => {
    for (let unitNumber = 1; unitNumber <= 6; unitNumber += 1) {
      const availability = practiceForUnit('7', unitNumber)
      expect(availability.status).toBe('available')
      if (availability.status !== 'available') continue
      const question = availability.generate(availability.itemTypes[0], 2)
      expectValidQuestion(question)
    }
  })

  it('bridges a reviewed generator for every grade 8 PF1-PF7 unit (existing practice compatibility)', () => {
    for (let unitNumber = 1; unitNumber <= 7; unitNumber += 1) {
      const availability = practiceForUnit('8', unitNumber)
      expect(availability.status).toBe('available')
      if (availability.status !== 'available') continue
      for (const itemType of availability.itemTypes) {
        const question = availability.generate(itemType, 3)
        expectValidQuestion(question)
        expect(question.itemType).toBe(itemType)
      }
    }
  })

  it('reports unsupported for a grade 8 unit number outside PF1-PF7 (unsupported generator fallback)', () => {
    const availability = practiceForUnit('8', 8)
    expect(availability.status).toBe('unsupported')
    if (availability.status !== 'unsupported') return
    expect(availability.reason.length).toBeGreaterThan(0)
  })

  it('reports unsupported instead of inventing practice for an out-of-range unit', () => {
    expect(practiceForUnit('5', 99).status).toBe('unsupported')
    expect(practiceForUnit('7', 0).status).toBe('unsupported')
    expect(practiceForUnit('8', -1).status).toBe('unsupported')
  })
})
