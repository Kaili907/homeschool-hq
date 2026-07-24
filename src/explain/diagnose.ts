import type { Question } from '../types'
import type { SkillId } from '../skills'
import type { Diagnoser } from './types'
import { answerOf, ints, promptInts } from './types'

/**
 * MT-1V distractor-aware diagnosis. Each diagnoser reconstructs a classic mistake
 * from the question's OWN numbers and checks whether that is the answer she chose.
 * When it matches, the walkthrough opens by naming the slip kindly and specifically;
 * otherwise it returns null and the walkthrough opens with the concept line.
 *
 * This is generator-agnostic on purpose: it diagnoses what HER answer reveals, not
 * how the choices were built, so it stays correct as generators evolve. Coverage is
 * the arithmetic-heavy skills first; everything else falls back gracefully to concept.
 */

const chosenText = (q: Question, i: number) => q.choices[i]
const chosenNum = (q: Question, i: number): number | null => {
  const ns = ints(q.choices[i])
  return ns.length === 1 ? ns[0] : null
}

/** Per-column result ignoring regrouping: 365−128 → "247" (5-8→3? no: |5-8|=3), i.e. |da−db| per column. */
const noBorrow = (a: number, b: number): string => {
  const A = String(Math.max(a, b))
  const B = String(Math.min(a, b))
  let out = ''
  for (let p = A.length - 1; p >= 0; p--) {
    const da = Number(A[p])
    const bi = B.length - (A.length - p)
    const db = bi >= 0 ? Number(B[bi]) : 0
    out = String(Math.abs(da - db)) + out
  }
  return String(Number(out)) // trim leading zeros
}

/** Per-column sum ignoring carries: 365+128 → each column mod 10 concatenated. */
const noCarry = (a: number, b: number): string => {
  const A = String(a)
  const B = String(b)
  const w = Math.max(A.length, B.length)
  let out = ''
  for (let p = 0; p < w; p++) {
    const da = Number(A[A.length - 1 - p] ?? 0)
    const db = Number(B[B.length - 1 - p] ?? 0)
    out = String((da + db) % 10) + out
  }
  return String(Number(out))
}

const addsub: Diagnoser = (q, i) => {
  const [a, b] = promptInts(q)
  const c = chosenNum(q, i)
  if (c === null) return null
  if (q.prompt.includes('+')) {
    if (String(c) === noCarry(a, b)) return `Looks like the carried digit didn't get added on — let's carry it up.`
  } else {
    if (String(c) === noBorrow(a, b))
      return `Looks like each column was just big-minus-small — but when the top is smaller it has to borrow.`
    if (c === a - b + 10 || c === a - b + 100 || c === a - b + 1000)
      return `Close — looks like a borrow got missed, so a column came out ten too big. Let's regroup.`
  }
  return null
}

const mult: Diagnoser = (q, i) => {
  const [a, b] = promptInts(q)
  const c = chosenNum(q, i)
  if (c === null) return null
  if (c === a + b) return `Looks like ${a} and ${b} got added instead of multiplied — × means groups, not a total.`
  return null
}

const place: Diagnoser = (q, i) => {
  if (!q.prompt.startsWith('Round')) return null
  const [n, to] = promptInts(q)
  const c = chosenNum(q, i)
  if (c === null) return null
  const ans = ints(answerOf(q))[0]
  const down = Math.floor(n / to) * to
  const up = Math.ceil(n / to) * to
  const other = to === 10 ? 100 : 10
  if (c === down && down !== ans) return `Looks like it rounded down — the next digit is 5 or more, so it rounds up.`
  if (c === up && up !== ans) return `Looks like it rounded up — the next digit is under 5, so it rounds down.`
  if (c === Math.round(n / other) * other && c !== ans)
    return `Looks like it rounded to the nearest ${other} instead of ${to} — watch which place we're rounding to.`
  return null
}

const fracUnit: Diagnoser = (q, i) => {
  const ans = answerOf(q)
  const chosen = chosenText(q, i)
  const m = ans.match(/^(\d+)\/(\d+)$/)
  if (!m) return null
  const num = Number(m[1])
  const den = Number(m[2])
  if (chosen === `${den - num}/${den}`)
    return `Looks like the parts that AREN'T shaded got counted — we want the shaded ones on top.`
  if (chosen === `${den}/${num}`)
    return `Looks like the top and bottom traded places — shaded goes on top, the total on the bottom.`
  if (chosen === `${num}/${den + 1}` || chosen === `${num}/${den - 1}`)
    return `Close — the bottom number counts every equal part, so let's recount the pieces.`
  return null
}

/** A misplaced decimal point: the chosen value is the answer shifted one place. */
const decShift: Diagnoser = (q, i) => {
  const ans = parseFloat(answerOf(q).replace(/[^0-9.]/g, ''))
  const chosen = parseFloat(q.choices[i].replace(/[^0-9.]/g, ''))
  if (!isFinite(ans) || !isFinite(chosen) || chosen === ans) return null
  if (Math.abs(chosen - ans * 10) < 1e-9 || Math.abs(chosen - ans / 10) < 1e-9)
    return `Looks like the decimal point landed one place off — let's line the points up first.`
  return null
}

export const DIAGNOSERS: Partial<Record<SkillId, Diagnoser>> = {
  addsub,
  mult,
  place,
  fracUnit,
  // grade 4 arithmetic reuses the same slips
  mult4: mult,
  place4: place,
  dec4: decShift,
  // grade 6 decimals
  decOps6: decShift,
}

/** The diagnosis line for her chosen answer, or null if nothing recognizable matched. */
export function diagnose(q: Question, chosenIndex: number): string | null {
  if (chosenIndex < 0 || chosenIndex === q.answerIndex) return null
  const fn = DIAGNOSERS[q.skillId]
  return fn ? fn(q, chosenIndex) : null
}
