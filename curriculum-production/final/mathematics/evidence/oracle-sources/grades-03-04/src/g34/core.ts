import { pick, ri, shuffle } from '../random.ts'
import type { BankItem, UnitBank } from '../itemBank.ts'
import type { CommonError, MaterialDifficulty } from '../types.ts'

/**
 * Authoring harness for the Grade 3 and Grade 4 item generators.
 *
 * There were no pre-existing item generators for these grades (the authoring
 * branch that produced their lesson records — mac/g34-math-r1 — shipped
 * lesson metadata, standards mapping, and scoring rubrics, but no fixed
 * numeric items; see data/source/README.md), so every item type is authored
 * fresh here, following the same pattern the grades 9-12 sibling pipeline
 * used for the same reason (curriculum-production/student-work/mathematics/
 * src/hs/core.ts). Two rules make the resulting answer key authoritative
 * rather than merely plausible:
 *
 *  1. Every spec supplies an `oracle` that recomputes the answer from the
 *     item's parameters alone, on a code path that does not reuse `build`'s
 *     arithmetic.
 *  2. `makeG34UnitBank` runs that oracle on every generated item and throws
 *     when it disagrees with the built answer. Generation fails closed, so a
 *     wrong answer cannot reach the corpus.
 *
 * Randomness flows through the shared src/genUtils RNG, so the emitter's
 * per-item seeding makes these generators reproducible along with the rest
 * of the corpus.
 */

export interface G34BuildResult<P> {
  prompt: string
  parameters: P
  answer: string
  distractors: readonly string[]
  solutionSteps: readonly string[]
  commonErrors?: readonly CommonError[]
}

export interface G34ItemSpec<P = Record<string, unknown>> {
  itemType: string
  standard: string
  lessonFocus: string
  build: (difficulty: MaterialDifficulty, variant?: number) => G34BuildResult<P>
  /** Independent recomputation from parameters. Must not call build(). */
  oracle: (parameters: P) => string
  referenceExample: { prompt: string; steps: readonly string[]; answer: string }
}

export const rand = ri
export const choose = pick

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    ;[x, y] = [y, x % y]
  }
  return x
}

export const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b)

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

/** Renders a whole-number dollar-and-cents amount from a total number of cents. */
export function money(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const remainder = abs % 100
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`
}

/** Renders whole hh:mm from a total minute count on a 24-hour clock. */
export function clockTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours24 = Math.floor(normalized / 60)
  const minutes = normalized % 60
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const suffix = hours24 < 12 ? 'a.m.' : 'p.m.'
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/**
 * Builds at least `count` distinct numeric distractors.
 *
 * Authored near-miss candidates come first; if a small parameter draw makes
 * them collide with the answer or each other, the pool is padded with
 * distinct nearby values rather than letting generation fail. Padded values
 * are still valid-form numbers, never a duplicate of the answer.
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
      if (candidate < 0 || seen.has(candidate)) continue
      seen.add(candidate)
      out.push(String(candidate))
    }
    delta = delta * 2 + 1
  }
  return out
}

/** Same padding strategy as numericDistractors, for values already rendered as strings with a shared suffix (units, currency, etc). */
export function renderedDistractors(
  answerValue: number,
  candidateValues: readonly number[],
  render: (value: number) => string,
  count = 4,
): string[] {
  const answerText = render(answerValue)
  const seen = new Set<string>([answerText])
  const out: string[] = []
  for (const candidate of candidateValues) {
    const text = render(candidate)
    if (seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  let delta = 1
  while (out.length < count && delta < 4096) {
    for (const candidate of [answerValue + delta, answerValue - delta]) {
      if (out.length >= count) break
      if (candidate < 0) continue
      const text = render(candidate)
      if (seen.has(text)) continue
      seen.add(text)
      out.push(text)
    }
    delta = delta * 2 + 1
  }
  return out
}

export function makeG34UnitBank(
  grade: number,
  unitNumber: number,
  specs: readonly G34ItemSpec<never>[],
): UnitBank {
  const byType = new Map<string, G34ItemSpec<never>>()
  for (const spec of specs) byType.set(spec.itemType, spec)
  return {
    grade,
    unitNumber,
    itemTypes: specs.map((spec) => spec.itemType),
    generate(itemType: string, difficulty: MaterialDifficulty, variant = 0): BankItem {
      const spec = byType.get(itemType)
      if (!spec) throw new Error(`Unknown grade ${grade} unit ${unitNumber} item type ${itemType}`)
      const built = spec.build(difficulty, variant)
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
          oracle: `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade${grade}Unit${unitNumber}.ts#${spec.itemType}.oracle`,
        },
      }
    },
  }
}

/** Convenience for specs whose parameters are a flat numeric record. */
export const spec = <P,>(definition: G34ItemSpec<P>): G34ItemSpec<never> =>
  definition as unknown as G34ItemSpec<never>
