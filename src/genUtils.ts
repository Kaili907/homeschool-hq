import type { Difficulty, Question } from './types'

export type Gen = (d: Difficulty) => Question

// ---------- random ----------

export const ri = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

export const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
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
  // Practically unreachable fallback so we never hang with < count choices.
  let filler = 1
  while (set.size < count) set.add(`${correct}?${filler++}`)
  const choices = shuffle([...set])
  return { choices, answerIndex: choices.indexOf(correct) }
}

/** Numeric distractor near the answer, never equal to it, floored at `min`. */
export const numNear = (answer: number, spread: number, min = 0, suffix = '') => () => {
  const off = (Math.random() < 0.5 ? 1 : -1) * ri(1, Math.max(1, spread))
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
