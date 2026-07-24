import { describe, it, expect, afterEach } from 'vitest'
import { finishChoices, fromPool, setRng } from './genUtils'
import { geometryQuestion } from './hs/geometryGen'

/**
 * H2 regression: genUtils.finishChoices must NEVER pad a short choice set with a
 * malformed "correct?N" distractor. When a generator's distractor pool collapses
 * below count-1 unique values, the fallback derives a genuinely distinct,
 * valid-FORM distractor by perturbing the answer instead.
 *
 * These reproduce the exact pre-fix failures deterministically (the coordinate
 * "(0, 0)?1" case via a seeded generator, and a plain-number case directly), then
 * prove them clean. The unseeded fuzz suites (hs.test / generators.test) keep their
 * own /\?\d+$/ guard and their coverage — they never call setRng.
 */

const MALFORMED = /\?\d+$/

afterEach(() => setRng(null)) // always restore Math.random

describe('finishChoices never emits a malformed "?N" pad (direct)', () => {
  it('coordinate answer with a collapsed 2-distractor pool → 4 clean coordinate choices', () => {
    // Pre-fix this padded "(0, 0)?1" / "(0, 0)?2"; now it perturbs to real points.
    const { choices, answerIndex } = finishChoices('(0, 0)', fromPool(['(1, 0)', '(0, -1)']))
    expect(choices).toHaveLength(4)
    expect(new Set(choices).size).toBe(4) // all distinct
    expect(choices[answerIndex]).toBe('(0, 0)') // correct present + indexed
    for (const c of choices) {
      expect(c).not.toMatch(MALFORMED)
      expect(c).toMatch(/^\(-?\d+, -?\d+\)$/) // still a coordinate pair
    }
  })

  it('plain-number answer with a single distractor → 4 clean numeric choices', () => {
    const { choices } = finishChoices('7', fromPool(['8']))
    expect(choices).toHaveLength(4)
    expect(new Set(choices).size).toBe(4)
    expect(choices).toContain('7')
    for (const c of choices) {
      expect(c).not.toMatch(MALFORMED)
      expect(c).toMatch(/^-?\d+$/)
    }
  })

  it('preserves suffix/prefix form when perturbing (degrees, currency, "x =")', () => {
    for (const [ans, pool, shape] of [
      ['90°', ['45°'], /°$/],
      ['$1.50', ['$2.00'], /^\$\d+\.\d{2}$/],
      ['x = 5', ['x = 9'], /^x = -?\d+$/],
      ['1/2', ['3/2'], /^-?\d+\/\d+$/],
    ] as const) {
      const { choices } = finishChoices(ans, fromPool([...pool]))
      expect(choices).toHaveLength(4)
      expect(new Set(choices).size).toBe(4)
      for (const c of choices) {
        expect(c).not.toMatch(MALFORMED)
        expect(c).toMatch(shape)
      }
    }
  })
})

describe('seeded end-to-end reproduction of the (0,0)?1 coordinate case', () => {
  it('the degenerate midpoint question now has only well-formed choices', () => {
    // _rng ≡ 0.5 ⟹ ri(-4,4)=0 ⟹ evenPt()=0 ⟹ all four coords 0 ⟹ midpoint (0,0),
    // whose distractor templates collapse onto the answer (the exact pre-fix trigger).
    setRng(() => 0.5)
    const q = geometryQuestion('coordinate', 1)
    expect(q.prompt).toContain('(0, 0) to (0, 0)') // the degenerate segment
    expect(q.choices).toHaveLength(4)
    expect(new Set(q.choices).size).toBe(4)
    expect(q.choices[q.answerIndex]).toBe('(0, 0)')
    for (const c of q.choices) expect(c).not.toMatch(MALFORMED)
  })
})
