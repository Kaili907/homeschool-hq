import { describe, expect, it } from 'vitest'
import { generateQuestion } from './generators'
import { SKILLS3, SKILLS4, SKILLS6, skillsForGrade } from './skills'
import { placementDifficulty, placementOrder } from './engine'
import type { AnswerRecord, Difficulty, Question } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS_PER_CELL = 40

describe('skill trees', () => {
  it('each trainer grade has 11 skills', () => {
    expect(SKILLS3).toHaveLength(11)
    expect(SKILLS4).toHaveLength(11)
    expect(SKILLS6).toHaveLength(11)
    expect(skillsForGrade('10')).toHaveLength(0)
    expect(skillsForGrade('12')).toHaveLength(0)
  })

  it('skill ids are globally unique', () => {
    const ids = [...SKILLS3, ...SKILLS4, ...SKILLS6].map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('generator sanity fuzz (all grades × skills × difficulties)', () => {
  for (const [grade, skills] of [
    ['3', SKILLS3],
    ['4', SKILLS4],
    ['6', SKILLS6],
  ] as const) {
    for (const skill of skills) {
      it(`grade ${grade} / ${skill.id} produces well-formed questions`, () => {
        for (const d of DIFFICULTIES) {
          for (let run = 0; run < RUNS_PER_CELL; run++) {
            const q = generateQuestion(skill.id, d)
            expect(q.skillId).toBe(skill.id)
            expect(q.prompt.trim().length).toBeGreaterThan(0)
            expect(q.choices.length).toBeGreaterThanOrEqual(2)
            expect(q.choices.length).toBeLessThanOrEqual(4)
            // all choices distinct
            expect(new Set(q.choices).size).toBe(q.choices.length)
            // valid answer index
            expect(q.answerIndex).toBeGreaterThanOrEqual(0)
            expect(q.answerIndex).toBeLessThan(q.choices.length)
            // no fallback-filler distractors leaked (would signal a broken pool)
            for (const c of q.choices) expect(c).not.toMatch(/\?\d+$/)
          }
        }
      })
    }
  }
})

describe('adaptive staircase (shared by every tree)', () => {
  const rec = (correct: boolean): AnswerRecord => ({
    question: { skillId: 'mult', difficulty: 2, prompt: 'x', choices: ['a', 'b'], answerIndex: 0 } as Question,
    chosenIndex: correct ? 0 : 1,
    correct,
  })

  it('starts mid, steps up on correct, down on wrong, clamps at 1..3', () => {
    expect(placementDifficulty([])).toBe(2)
    expect(placementDifficulty([rec(true)])).toBe(3)
    expect(placementDifficulty([rec(true), rec(true)])).toBe(3) // clamped
    expect(placementDifficulty([rec(false)])).toBe(1)
    expect(placementDifficulty([rec(false), rec(false)])).toBe(1) // clamped
    expect(placementDifficulty([rec(true), rec(false)])).toBe(2)
  })

  it('placement order covers the target grade tree only', () => {
    for (const grade of ['3', '4', '6'] as const) {
      const order = placementOrder(grade)
      expect(order).toHaveLength(20)
      const valid = new Set(skillsForGrade(grade).map((s) => s.id))
      for (const id of order) expect(valid.has(id)).toBe(true)
      // every skill in the tree appears at least once
      expect(new Set(order).size).toBe(11)
    }
  })
})
