import type { Difficulty, Question } from './types'

export type Gen = (d: Difficulty) => Question

// ---------- injectable RNG (default Math.random; tests override for determinism) ----------

// All randomness in the generators flows through these helpers, so a test can make
// generation deterministic via setRng() without touching Math.random globally. The
// unseeded fuzz suites never call setRng, so their coverage is unchanged.
let _rng: () => number = Math.random

/** Override the module RNG. Pass a fn for deterministic generation; null restores Math.random. */
export function setRng(fn: (() => number) | null): void {
  _rng = fn ?? Math.random
}

// ---------- random ----------

export const ri = (min: number, max: number) =>
  Math.floor(_rng() * (max - min + 1)) + min

export const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(_rng() * arr.length)]

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- choice building ----------

/** Build a shuffled choice set from a correct answer and a distractor generator. */
export function finishChoices(
  correct: string,
  distractor: () => string,
  count = 4,
): Pick<Question, 'choices' | 'answerIndex'> {
  const set = new Set([correct])
  let guard = 0
  while (set.size < count && guard < 400) {
    const d = distractor()
    if (d.trim() !== '') set.add(d)
    guard++
  }
  // Fallback when the distractor generator can't supply enough distinct options
  // (a collapsed pool — e.g. a degenerate coordinate midpoint). Pad with genuinely
  // distinct, VALID-FORM distractors derived by perturbing the answer — NEVER a
  // malformed "correct?N" tag, never the correct answer, never a duplicate.
  let mag = 1
  while (set.size < count && mag <= 5000) {
    const variants = perturbVariants(correct, mag)
    if (variants.length === 0) {
      // No numeric component to perturb. Unreachable for real generators (their
      // text answers always ship a full distractor pool), but stay safe: add a
      // distinct plain number rather than ever emitting a malformed choice.
      set.add(String(1000 + mag))
    } else {
      for (const cand of variants) {
        if (cand !== correct && !set.has(cand)) {
          set.add(cand)
          if (set.size >= count) break
        }
      }
    }
    mag++
  }
  const choices = shuffle([...set])
  return { choices, answerIndex: choices.indexOf(correct) }
}

/**
 * Valid-form perturbations of an answer, for fallback distractors: shift the
 * numeric component(s) by ±mag while preserving the answer's shape — a coordinate
 * pair `(x, y)`, a fraction `n/d`, or any number with surrounding text ("90°",
 * "$1.50", "x = 5"). Returns [] only when there is no number to perturb.
 */
function perturbVariants(correct: string, mag: number): string[] {
  const coord = /^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/.exec(correct)
  if (coord) {
    const x = Number(coord[1])
    const y = Number(coord[2])
    return [`(${x + mag}, ${y})`, `(${x - mag}, ${y})`, `(${x}, ${y + mag})`, `(${x}, ${y - mag})`]
  }
  const frac = /^(-?\d+)\/(\d+)$/.exec(correct)
  if (frac) {
    const n = Number(frac[1])
    const d = frac[2]
    return [`${n + mag}/${d}`, `${n - mag}/${d}`]
  }
  const num = /-?\d+(?:\.\d+)?/.exec(correct)
  if (num) {
    const s = num[0]
    const val = Number(s)
    const dec = s.includes('.') ? s.length - s.indexOf('.') - 1 : 0
    const mk = (nv: number) =>
      correct.slice(0, num.index) + (dec ? nv.toFixed(dec) : String(nv)) + correct.slice(num.index + s.length)
    return [mk(val + mag), mk(val - mag)]
  }
  return []
}

/** Numeric distractor near the answer, never equal to it, floored at `min`. */
export const numNear = (answer: number, spread: number, min = 0, suffix = '') => () => {
  const off = (_rng() < 0.5 ? 1 : -1) * ri(1, Math.max(1, spread))
  const v = Math.max(min, answer + off)
  return v === answer ? `${answer + Math.max(1, spread)}${suffix}` : `${v}${suffix}`
}

/** Distractor near a large answer, offset scaled to its magnitude. */
export const bigNear = (ans: number) => () => {
  const mag = Math.max(0, Math.floor(Math.log10(Math.max(10, ans))) - 1)
  const off = pick([1, -1] as const) * pick([1, 2, 5] as const) * 10 ** ri(0, mag)
  const v = ans + off
  return v > 0 && v !== ans ? v.toLocaleString() : (ans + 11).toLocaleString()
}

/** Distractor from a fixed candidate pool. */
export const fromPool = (pool: string[]) => () => (pool.length ? pick(pool) : '')

// ---------- formatting ----------

export const fmtMoney = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`)

export const fmtTime = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** Reduced fraction, as a mixed number when improper: 14/4 → "3 1/2". */
export function fmtFrac(num: number, den: number): string {
  const g = gcd(num, den) || 1
  const n = num / g
  const d = den / g
  if (d === 1) return String(n)
  if (n > d) {
    const w = Math.floor(n / d)
    const r = n % d
    return r === 0 ? String(w) : `${w} ${r}/${d}`
  }
  return `${n}/${d}`
}

/** Unreduced fraction, mixed when improper: 7/5 → "1 2/5" (grade-4 style, no reducing). */
export function fracMixed(n: number, den: number): string {
  if (n < den) return `${n}/${den}`
  const w = Math.floor(n / den)
  const r = n % den
  return r === 0 ? String(w) : `${w} ${r}/${den}`
}

/** Scaled-integer decimal: fmtDec(65, 2) → "0.65", fmtDec(40, 2) → "0.4". */
export const fmtDec = (scaled: number, places = 2) =>
  String(parseFloat((scaled / 10 ** places).toFixed(places)))
