import { pick, ri, shuffle } from '../../../../../src/genUtils.ts'
import type { BankItem, UnitBank } from '../itemBank.ts'
import type { CommonError, MaterialDifficulty } from '../types.ts'

/**
 * Authoring harness for the grade 9-12 item generators.
 *
 * The high-school courses arrived with lesson records and standards but no item
 * generators, so these are authored here. Two rules make the resulting answer
 * key authoritative rather than merely plausible:
 *
 *  1. Every spec supplies an `oracle` that recomputes the answer from the item's
 *     parameters alone, on a code path that does not reuse `build`'s arithmetic.
 *  2. `makeHsUnitBank` runs that oracle on every generated item and throws when
 *     it disagrees with the built answer. Generation fails closed, so a wrong
 *     answer cannot reach the corpus.
 *
 * Randomness flows through the shared src/genUtils RNG, so the emitter's
 * per-item seeding makes these generators reproducible along with the rest.
 */

export interface HsBuildResult<P> {
  prompt: string
  parameters: P
  answer: string
  distractors: readonly string[]
  solutionSteps: readonly string[]
  commonErrors?: readonly CommonError[]
}

export interface HsItemSpec<P = Record<string, unknown>> {
  itemType: string
  standard: string
  lessonFocus: string
  build: (difficulty: MaterialDifficulty) => HsBuildResult<P>
  /** Independent recomputation from parameters. Must not call build(). */
  oracle: (parameters: P) => string
  referenceExample: { prompt: string; steps: readonly string[]; answer: string }
}

export const rand = ri
export const choose = pick

/** Non-zero integer in [-max, max] excluding 0, for coefficients. */
export function nonZero(max: number, min = 1): number {
  const magnitude = ri(min, max)
  return ri(0, 1) === 0 ? magnitude : -magnitude
}

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    ;[x, y] = [y, x % y]
  }
  return x
}

/** Exact rational rendering, so no answer depends on float formatting. */
export function fraction(numerator: number, denominator: number): string {
  if (denominator === 0) throw new Error('fraction denominator must be non-zero')
  let n = numerator
  let d = denominator
  if (d < 0) {
    n = -n
    d = -d
  }
  const divisor = gcd(n, d) || 1
  n /= divisor
  d /= divisor
  return d === 1 ? String(n) : `${n}/${d}`
}

/** Renders ax + b style terms with correct signs and suppressed unit coefficients. */
export function term(coefficient: number, variable: string): string {
  if (coefficient === 0) return ''
  if (coefficient === 1) return variable
  if (coefficient === -1) return `-${variable}`
  return `${coefficient}${variable}`
}

export function polynomial(
  coefficients: readonly number[],
  variable = 'x',
): string {
  const degree = coefficients.length - 1
  const parts: string[] = []
  coefficients.forEach((coefficient, index) => {
    if (coefficient === 0) return
    const power = degree - index
    const body =
      power === 0
        ? String(Math.abs(coefficient))
        : power === 1
          ? term(Math.abs(coefficient), variable)
          : term(Math.abs(coefficient), `${variable}^${power}`)
    const sign = coefficient < 0 ? '-' : '+'
    parts.push(parts.length === 0 ? (coefficient < 0 ? `-${body}` : body) : ` ${sign} ${body}`)
  })
  return parts.length === 0 ? '0' : parts.join('')
}

/** Simplifies √n into a√b form exactly. */
export function simplifyRadical(radicand: number): { outside: number; inside: number } {
  let outside = 1
  let inside = radicand
  for (let factor = 2; factor * factor <= inside; factor += 1) {
    while (inside % (factor * factor) === 0) {
      inside /= factor * factor
      outside *= factor
    }
  }
  return { outside, inside }
}

export const renderRadical = (outside: number, inside: number): string =>
  inside === 1 ? String(outside) : outside === 1 ? `√${inside}` : `${outside}√${inside}`

/**
 * Builds at least `count` distinct numeric distractors.
 *
 * Authored near-miss candidates come first; if a small parameter draw makes them
 * collide (for example when the answer and a candidate are both 4), the pool is
 * padded with distinct nearby values rather than letting generation fail. Padded
 * values are still valid-form numbers, never a duplicate of the answer.
 */
export function numericDistractors(
  answer: number,
  candidates: readonly number[],
  count = 4,
): string[] {
  const seen = new Set<number>([answer])
  const out: string[] = []
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate) || seen.has(candidate)) continue
    seen.add(candidate)
    out.push(String(candidate))
  }
  let delta = 1
  while (out.length < count && delta < 4096) {
    for (const candidate of [answer + delta, answer - delta]) {
      if (out.length >= count) break
      if (candidate <= 0 || seen.has(candidate)) continue
      seen.add(candidate)
      out.push(String(candidate))
    }
    delta = delta * 2 + 1
  }
  return out
}

/**
 * Distractors for an ordered-pair answer.
 *
 * Authored near-misses (other transformation images, swapped coordinates) come
 * first, but symmetric draws such as y = −x make several of them coincide. The
 * pool is then padded by shifting one coordinate, which stays a valid ordered
 * pair and can never equal the answer.
 */
export function coordinateDistractors(
  ix: number,
  iy: number,
  candidates: readonly (readonly [number, number])[],
  count = 4,
): string[] {
  const render = (a: number, b: number): string => `(${a}, ${b})`
  const answer = render(ix, iy)
  const seen = new Set<string>([answer])
  const out: string[] = []
  for (const [a, b] of candidates) {
    const text = render(a, b)
    if (seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  const padding: Array<[number, number]> = [
    [ix + 1, iy],
    [ix, iy + 1],
    [ix - 1, iy],
    [ix, iy - 1],
    [ix + 2, iy],
  ]
  for (const [a, b] of padding) {
    if (out.length >= count) break
    const text = render(a, b)
    if (seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

export function makeHsUnitBank(
  grade: number,
  unitNumber: number,
  specs: readonly HsItemSpec<never>[],
): UnitBank {
  const byType = new Map<string, HsItemSpec<never>>()
  for (const spec of specs) byType.set(spec.itemType, spec)
  return {
    grade,
    unitNumber,
    itemTypes: specs.map((spec) => spec.itemType),
    generate(itemType: string, difficulty: MaterialDifficulty): BankItem {
      const spec = byType.get(itemType)
      if (!spec) throw new Error(`Unknown grade ${grade} unit ${unitNumber} item type ${itemType}`)
      const built = spec.build(difficulty)
      const verified = spec.oracle(built.parameters)
      if (verified !== built.answer) {
        throw new Error(
          `Oracle disagreement for ${itemType}: built "${built.answer}" but oracle recomputed "${verified}" from ${JSON.stringify(built.parameters)}`,
        )
      }
      const distractors = [
        ...new Set(built.distractors.map((value) => value.trim()).filter((value) => value !== '' && value !== built.answer)),
      ]
      if (distractors.length < 3) {
        throw new Error(`${itemType} supplied only ${distractors.length} usable distractors`)
      }
      const choices = shuffle([built.answer, ...distractors.slice(0, 3)])
      return {
        itemType: spec.itemType,
        standard: spec.standard,
        lessonFocus: spec.lessonFocus,
        difficulty,
        prompt: built.prompt,
        choices,
        answerIndex: choices.indexOf(built.answer),
        parameters: built.parameters as unknown as Record<string, unknown>,
        workedExample: {
          prompt: spec.referenceExample.prompt,
          answer: spec.referenceExample.answer,
          steps: spec.referenceExample.steps,
        },
        solutionSteps: built.solutionSteps,
        commonErrors: built.commonErrors,
        verification: {
          method: 'recomputed',
          oracle: `curriculum-production/student-work/mathematics/src/hs/grade${grade}Unit${unitNumber}.ts#${spec.itemType}.oracle`,
        },
      }
    },
  }
}

/** Convenience for specs whose parameters are a flat numeric record. */
export const spec = <P,>(definition: HsItemSpec<P>): HsItemSpec<never> =>
  definition as unknown as HsItemSpec<never>
