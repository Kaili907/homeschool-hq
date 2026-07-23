// ---------- M4 Algebra I maintenance-deck generators ----------
//
// Keeps the foundation warm for the teens (critical for the senior heading into
// Algebra II mid-year). Three topics — equation solving, slope, factoring —
// drawn into a 5-question daily warm-up by buildAlgebraDeck().

import type { Difficulty } from '../types'
import type { HsGen, HsQuestion } from './hsQuestion'
import { finishChoices, fromPool, gcd, pick, ri, shuffle } from '../genUtils'
import { ALGEBRA_TOPIC_IDS } from './hsCatalog'

function reduceFrac(num: number, den: number): string {
  const g = gcd(Math.abs(num), Math.abs(den)) || 1
  let n = num / g
  let d = den / g
  if (d < 0) {
    n = -n
    d = -d
  }
  return d === 1 ? `${n}` : `${n}/${d}`
}

const uniqueWrong = (correct: string, raw: (string | number)[]): string[] => {
  const seen = new Set<string>([correct])
  const out: string[] = []
  for (const r of raw) {
    const s = String(r)
    if (s.trim() !== '' && !seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

const make = (unit: string, d: Difficulty, prompt: string, correct: string, wrong: string[]): HsQuestion => ({
  unit,
  difficulty: d,
  prompt,
  ...finishChoices(correct, fromPool(wrong)),
})

// signed term like "+ 5" / "− 5" for building expressions
const term = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`)

// ---------- equation solving ----------

// five mutually-distinct decoys around a solution x, plus caller extras
const xDecoys = (x: number, ...extra: number[]) =>
  [x + 1, x - 1, x + 2, x - 2, x + 3, ...extra].map((v) => `x = ${v}`)

const equations: HsGen = (d) => {
  if (d === 1) {
    if (Math.random() < 0.5) {
      const a = ri(2, 9)
      const x = ri(2, 12)
      return make('equations', d, `Solve for x:   ${a}x = ${a * x}`, `x = ${x}`, uniqueWrong(`x = ${x}`, xDecoys(x, a * x, a + x)))
    }
    const b = ri(2, 20)
    const x = ri(2, 20)
    return make('equations', d, `Solve for x:   x ${term(b)} = ${x + b}`, `x = ${x}`, uniqueWrong(`x = ${x}`, xDecoys(x, x + b, b)))
  }
  if (d === 2) {
    const a = ri(2, 6)
    const x = ri(2, 10)
    const b = pick([ri(-12, -1), ri(1, 12)])
    const c = a * x + b
    return make('equations', d, `Solve for x:   ${a}x ${term(b)} = ${c}`, `x = ${x}`, uniqueWrong(`x = ${x}`, xDecoys(x, c - b, Math.round(c / a))))
  }
  // d3: distribute a(x + b) = c
  const a = ri(2, 5)
  const x = ri(2, 8)
  const b = pick([ri(-6, -1), ri(1, 6)])
  const c = a * (x + b)
  return make('equations', d, `Solve for x:   ${a}(x ${term(b)}) = ${c}`, `x = ${x}`, uniqueWrong(`x = ${x}`, xDecoys(x, x + b, c - b)))
}

// ---------- slope ----------

// five mutually-distinct integer decoys around a slope m
const mDecoys = (m: number) => [m + 1, m - 1, m + 2, m - 2, m + 3].map(String)

const slope: HsGen = (d) => {
  if (d === 1) {
    const m = pick([ri(-3, -1), ri(1, 3)])
    let x1 = ri(-5, 5)
    let x2 = ri(-5, 5)
    while (x2 === x1) x2 = ri(-5, 5)
    const y1 = ri(-5, 5)
    const y2 = y1 + m * (x2 - x1)
    return make('slope', d, `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`, `${m}`, uniqueWrong(`${m}`, [`${-m}`, reduceFrac(x2 - x1, y2 - y1), ...mDecoys(m)]))
  }
  if (d === 2) {
    const m = pick([ri(-6, -1), ri(1, 6)])
    const b = pick([ri(-9, -1), ri(1, 9)])
    return make('slope', d, `What is the slope of the line   y = ${m}x ${term(b)} ?`, `${m}`, uniqueWrong(`${m}`, [`${b}`, `${-m}`, ...mDecoys(m)]))
  }
  // d3: standard form Ax + By = C → slope = −A/B
  const A = pick([ri(-6, -1), ri(1, 6)])
  const B = pick([ri(2, 6), ri(-6, -2)])
  const C = ri(-12, 12)
  const ans = reduceFrac(-A, B)
  return make('slope', d, `Find the slope of the line   ${A}x ${term(B)}y = ${C}.`, ans, uniqueWrong(ans, [reduceFrac(A, B), reduceFrac(B, A), reduceFrac(-B, A), `${-A}`, `${A}`, `${B}`, `${-B}`, '0', '1']))
}

// ---------- factoring ----------

const factoring: HsGen = (d) => {
  if (d === 1) {
    const g = ri(2, 6)
    let a = ri(1, 6)
    let b = ri(1, 9)
    while (gcd(a, b) !== 1) b = ri(1, 9)
    const expr = `${g * a}x + ${g * b}`
    const ans = `${g}(${a}x + ${b})`
    return make('factoring', d, `Factor completely:   ${expr}`, ans, uniqueWrong(ans, [`${g}(${a}x + ${g * b})`, `${a}(${g}x + ${b})`, `${g * a}(x + ${b})`, `${g}(${a}x + ${b + 1})`, `${g + 1}(${a}x + ${b})`]))
  }
  if (d === 2) {
    const p = ri(1, 9)
    const q = ri(1, 9)
    const b = p + q
    const c = p * q
    const ans = `(x + ${Math.min(p, q)})(x + ${Math.max(p, q)})`
    return make('factoring', d, `Factor:   x² + ${b}x + ${c}`, ans, uniqueWrong(ans, [`(x + ${Math.min(p, q)})(x − ${Math.max(p, q)})`, `(x − ${Math.min(p, q)})(x − ${Math.max(p, q)})`, `(x + ${b})(x + ${c})`, `(x + ${p + 1})(x + ${Math.max(1, q - 1)})`, `(x + 1)(x + ${b})`]))
  }
  // d3: difference of squares
  const a = ri(2, 10)
  const ans = `(x + ${a})(x − ${a})`
  return make('factoring', d, `Factor:   x² − ${a * a}`, ans, uniqueWrong(ans, [`(x − ${a})(x − ${a})`, `(x + ${a})(x + ${a})`, `(x + ${a * a})(x − 1)`, `(x + ${a})²`, `(x − ${a})²`]))
}

// ---------- registry + deck ----------

export const ALGEBRA_GENERATORS: Record<string, HsGen> = { equations, slope, factoring }

export function algebraQuestion(topicId: string, d: Difficulty): HsQuestion {
  const gen = ALGEBRA_GENERATORS[topicId]
  return gen ? gen(d) : equations(d)
}

/**
 * The daily maintenance deck: `count` questions spread across all topics with
 * mixed difficulty, no topic repeated back-to-back-to-back.
 */
export function buildAlgebraDeck(count = 5): HsQuestion[] {
  const topics = ALGEBRA_TOPIC_IDS
  const order: string[] = []
  // round-robin over a shuffled topic list so all three appear before repeats
  while (order.length < count) {
    for (const t of shuffle(topics)) {
      if (order.length < count) order.push(t)
    }
  }
  const seen = new Set<string>()
  const deck: HsQuestion[] = []
  for (const topic of order) {
    const d = pick([1, 2, 2, 3] as const) as Difficulty
    let q = algebraQuestion(topic, d)
    for (let i = 0; i < 6 && seen.has(q.prompt); i++) q = algebraQuestion(topic, d)
    seen.add(q.prompt)
    deck.push(q)
  }
  return deck
}
