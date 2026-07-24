import { describe, expect, it } from 'vitest'
import { placementOrder } from './engine'
import { generateFresh, generateQuestion } from './generators'
import { ensureGrade5Template, GRADE5_TEMPLATE } from './grade5Profile'
import { emptyProfile } from './migration'
import { SKILLS3, SKILLS4, SKILLS6, skillsForGrade } from './skills'
import { SKILLS5 } from './skills5'
import type { Difficulty } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS_PER_CELL = 50

describe('grade 5 skill tree and placement', () => {
  it('registers 11 unique Grade 5 skills on Grade 5 profiles', () => {
    expect(SKILLS5).toHaveLength(11)
    expect(skillsForGrade('5')).toEqual(SKILLS5)

    const allIds = [...SKILLS3, ...SKILLS4, ...SKILLS5, ...SKILLS6].map((skill) => skill.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('uses the shared 20-question placement engine and covers every Grade 5 skill', () => {
    const order = placementOrder('5')
    const valid = new Set(SKILLS5.map((skill) => skill.id))

    expect(order).toHaveLength(20)
    expect(new Set(order).size).toBe(11)
    for (const id of order) expect(valid.has(id)).toBe(true)
  })

  it('adds the Grade 5 mission template immutably', () => {
    const profile = emptyProfile('g5', 'Grade Five', '5')
    const next = ensureGrade5Template(profile)

    expect(next).not.toBe(profile)
    expect(profile.template).toBeUndefined()
    expect(next.template).toEqual(GRADE5_TEMPLATE)
    expect(ensureGrade5Template(next)).toBe(next)
  })
})

describe('grade 5 generator sanity fuzz', () => {
  for (const skill of SKILLS5) {
    it(`${skill.id} produces well-formed, shuffled questions across difficulties`, () => {
      const answerPositions = new Set<number>()

      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < RUNS_PER_CELL; run++) {
          const question = generateQuestion(skill.id, difficulty)
          answerPositions.add(question.answerIndex)

          expect(question.skillId).toBe(skill.id)
          expect(question.difficulty).toBe(difficulty)
          expect(question.prompt.trim().length).toBeGreaterThan(0)
          expect(question.prompt).not.toMatch(/undefined|NaN/)
          expect(question.choices.length).toBeGreaterThanOrEqual(2)
          expect(question.choices.length).toBeLessThanOrEqual(4)
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(question.answerIndex).toBeGreaterThanOrEqual(0)
          expect(question.answerIndex).toBeLessThan(question.choices.length)
          for (const choice of question.choices) {
            expect(choice.trim().length).toBeGreaterThan(0)
            expect(choice).not.toMatch(/undefined|NaN|\?\d+$/)
          }
        }
      }

      expect(answerPositions.size).toBeGreaterThan(1)
    })
  }

  it('uses the shared session-level prompt dedupe', () => {
    const seen = new Set<string>()
    const prompts = Array.from({ length: 12 }, () => generateFresh('mult5', 2, seen).prompt)

    expect(seen.size).toBe(12)
    expect(new Set(prompts).size).toBe(12)
  })
})
