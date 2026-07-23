import { describe, expect, it } from 'vitest'
import { GENERATOR_SKILL_IDS, generateQuestion } from './generators'
import { EXPLAINABLE_SKILL_IDS, explain, hasExplainer } from './explain'
import type { Difficulty } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS_PER_CELL = 60
// A step must never leak an un-filled template. NaN/undefined = a parse that failed.
const PLACEHOLDER = /\$\{|[{}`]|undefined|NaN/

describe('MT-1 explain() coverage', () => {
  it('covers exactly the registered g3/4/6 generators (33 skills)', () => {
    expect(GENERATOR_SKILL_IDS).toHaveLength(33)
    // every registered generator has an explainer…
    for (const id of GENERATOR_SKILL_IDS) {
      expect(hasExplainer(id)).toBe(true)
    }
    // …and no explainer targets a skill without a generator
    expect(new Set(EXPLAINABLE_SKILL_IDS)).toEqual(new Set(GENERATOR_SKILL_IDS))
  })

  for (const skillId of GENERATOR_SKILL_IDS) {
    it(`${skillId}: every generated question explains with real numbers, no placeholders`, () => {
      for (const d of DIFFICULTIES) {
        for (let run = 0; run < RUNS_PER_CELL; run++) {
          const q = generateQuestion(skillId, d)
          const ex = explain(q)
          // at least one step
          expect(ex.steps.length).toBeGreaterThan(0)
          const joined = ex.steps.map((s) => s.say).join(' • ')
          for (const step of ex.steps) {
            // non-empty spoken/displayed text
            expect(step.say.trim().length).toBeGreaterThan(0)
            // no un-interpolated placeholder or failed parse
            expect(step.say).not.toMatch(PLACEHOLDER)
            // a `show` hint, when present, must actually be in the prompt to highlight
            if (step.show) expect(q.prompt).toContain(step.show)
          }
          // the walkthrough states the actual correct answer
          expect(joined).toContain(q.choices[q.answerIndex])
        }
      }
    })
  }
})
