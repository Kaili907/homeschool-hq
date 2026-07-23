// ---------- M4 Geometry practice-set generators (procedural, with SVG figures) ----------
//
// Nine units per Build-Spec §M4. Every generator returns a numeric-answer
// multiple-choice HsQuestion; several attach a GeoFigure the renderer draws.
// Reuses the shared genUtils primitives (no new genUtils code).

import type { Difficulty } from '../types'
import type { HsGen, HsQuestion } from './hsQuestion'
import type { AnglePos, GeoFigure } from './geoFigure'
import { finishChoices, fromPool, gcd, pick, ri, shuffle } from '../genUtils'

// ---------- shared helpers ----------

/** Reduced fraction as a string; whole numbers collapse ("6/3" → "2"). */
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

/** Distinct wrong choices from a computed pool; keeps only strings ≠ correct. */
const poolExcept = (correct: string, raw: (string | number)[]): string[] => {
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

const build = (
  unit: string,
  d: Difficulty,
  prompt: string,
  correct: string,
  wrong: string[],
  figure?: GeoFigure,
): HsQuestion => ({
  unit,
  difficulty: d,
  prompt,
  ...(figure ? { figure } : {}),
  ...finishChoices(correct, fromPool(wrong)),
})

const deg = (n: number) => `${n}°`

// Pythagorean triples (primitive); scaled by a factor for variety.
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
]

// ---------- 1. Angles & parallel lines ----------

const ACUTE_POS = new Set<AnglePos>([2, 3, 6, 7])
const angleAt = (pos: AnglePos, acute: number) => (ACUTE_POS.has(pos) ? acute : 180 - acute)

const angles: HsGen = (d) => {
  if (d === 1) {
    const kind = pick(['comp', 'supp', 'vert'] as const)
    if (kind === 'comp') {
      const a = ri(15, 75)
      const ans = 90 - a
      return build('angles', d, `Two angles are complementary. One measures ${a}°. What is the other angle?`, deg(ans), poolExcept(deg(ans), [deg(180 - a), deg(90 + a), deg(a), deg(ans + 10), deg(Math.abs(ans - 10))]))
    }
    if (kind === 'supp') {
      const a = ri(35, 145)
      const ans = 180 - a
      return build('angles', d, `Two angles are supplementary. One measures ${a}°. What is the other angle?`, deg(ans), poolExcept(deg(ans), [deg(90 - a > 0 ? 90 - a : a + 5), deg(a), deg(ans + 10), deg(Math.abs(ans - 15)), deg(360 - a)]))
    }
    const a = ri(25, 155)
    return build('angles', d, `Two straight lines cross. One of the four angles measures ${a}°. What is the angle directly opposite (its vertical angle)?`, deg(a), poolExcept(deg(a), [deg(180 - a), deg(90), deg(a + 10), deg(Math.abs(a - 10)), deg(360 - a)]))
  }
  // d2 / d3: parallel lines cut by a transversal
  const acute = ri(35, 80)
  const positions: AnglePos[] = [1, 2, 3, 4, 5, 6, 7, 8]
  const givenPos = pick(positions)
  let askPos = pick(positions)
  while (askPos === givenPos) askPos = pick(positions)
  const given = angleAt(givenPos, acute)
  const ans = angleAt(askPos, acute)
  const figure: GeoFigure = { kind: 'parallelLines', acute, givenPos, askPos }
  const wrong = poolExcept(deg(ans), [deg(ans === acute ? 180 - acute : acute), deg(90), deg(given), deg(180 - given), deg(ans + 10), deg(Math.abs(ans - 10))])
  return build('angles', d, `Lines m and n are parallel. The labeled angle measures ${given}°. Find the measure of the marked angle (?).`, deg(ans), wrong, figure)
}

// ---------- 2. Triangle congruence ----------

const congruence: HsGen = (d) => {
  if (d >= 2 && Math.random() < 0.45) {
    // postulate identification
    const cases = [
      { desc: 'all three pairs of sides equal', ans: 'SSS' },
      { desc: 'two sides and the angle between them equal', ans: 'SAS' },
      { desc: 'two angles and the side between them equal', ans: 'ASA' },
      { desc: 'two angles and a non-included side equal', ans: 'AAS' },
    ] as const
    const c = pick(cases)
    return build('congruence', d, `Two triangles have ${c.desc}. Which postulate proves they are congruent?`, c.ans, poolExcept(c.ans, ['SSS', 'SAS', 'ASA', 'AAS'].filter((x) => x !== c.ans)))
  }
  if (d >= 2) {
    // corresponding angle via the 180° sum
    const a = ri(35, 80)
    const b = ri(35, 80)
    const c = 180 - a - b
    const ans = c
    return build('congruence', d, `△ABC ≅ △DEF (A↔D, B↔E, C↔F). ∠A = ${a}° and ∠B = ${b}°. What is ∠F?`, deg(ans), poolExcept(deg(ans), [deg(a), deg(b), deg(180 - a), deg(180 - b), deg(ans + 8), deg(Math.abs(ans - 8))]), { kind: 'triangleAngles', angles: [`${a}°`, `${b}°`, '?'] })
  }
  // d1: corresponding side (direct equality)
  const ab = ri(5, 18)
  const bc = ri(5, 18)
  const ca = ri(5, 18)
  const askAB = Math.random() < 0.5
  const ans = askAB ? ab : bc
  const target = askAB ? 'DE' : 'EF'
  const src = askAB ? 'AB' : 'BC'
  return build('congruence', d, `△ABC ≅ △DEF (A↔D, B↔E, C↔F). ${src} = ${ans} cm. How long is ${target}?`, `${ans} cm`, poolExcept(`${ans} cm`, [`${askAB ? bc : ab} cm`, `${ca} cm`, `${ans + 2} cm`, `${Math.max(1, ans - 2)} cm`, `${ans + 5} cm`]), { kind: 'triangleSides', sides: [`${ab}`, `${bc}`, `${ca}`], ticks: [1, 2, 3] })
}

// ---------- 3. Similarity ----------

const similarity: HsGen = (d) => {
  if (d === 3) {
    // scale factor from two corresponding sides
    const k = ri(2, 4)
    const small = ri(3, 9)
    const big = small * k
    return build('similarity', d, `△ABC ~ △DEF. Side AB = ${small} and its corresponding side DE = ${big}. What is the scale factor from ABC to DEF?`, `${k}`, poolExcept(`${k}`, [`${k + 1}`, `${k - 1}`, `${big - small}`, `${small}`, `${k + 2}`]), { kind: 'triangleSides', sides: [`${small}`, '', ''] })
  }
  if (d === 2) {
    // proportional missing side
    const k = ri(2, 4)
    const a = ri(3, 8)
    const b = ri(3, 8)
    const bigB = b * k
    return build('similarity', d, `△ABC ~ △DEF. AB = ${a} corresponds to DE = ${a * k}. If BC = ${b}, how long is EF?`, `${bigB}`, poolExcept(`${bigB}`, [`${b}`, `${b + k}`, `${a * k}`, `${bigB + b}`, `${Math.max(1, bigB - b)}`]), { kind: 'triangleSides', sides: [`${a}`, `${b}`, ''] })
  }
  // d1: apply a given scale factor
  const k = ri(2, 5)
  const x = ri(3, 12)
  const ans = k * x
  return build('similarity', d, `△ABC ~ △DEF with scale factor ${k}. If AB = ${x}, how long is the corresponding side DE?`, `${ans}`, poolExcept(`${ans}`, [`${x}`, `${x + k}`, `${ans + k}`, `${ans - k}`, `${x * (k + 1)}`]), { kind: 'triangleSides', sides: [`${x}`, '', ''] })
}

// ---------- 4. Right triangles & Pythagorean ----------

const pythagorean: HsGen = (d) => {
  if (d === 3) {
    // non-triple legs → hypotenuse to the nearest tenth
    let a = ri(4, 12)
    let b = ri(4, 12)
    // avoid an accidental perfect triple so the "round" instruction is real
    while (Number.isInteger(Math.sqrt(a * a + b * b))) b += 1
    const hyp = Math.sqrt(a * a + b * b)
    const ans = hyp.toFixed(1)
    const wrong = poolExcept(ans, [(a + b).toFixed(1), (hyp + 0.3).toFixed(1), (hyp - 0.4).toFixed(1), Math.sqrt(Math.abs(a * a - b * b)).toFixed(1), (hyp + 1).toFixed(1)])
    return build('pythagorean', d, `A right triangle has legs ${a} and ${b}. Find the hypotenuse, rounded to the nearest tenth.`, ans, wrong, { kind: 'rightTriangle', a: `${a}`, b: `${b}`, c: '?' })
  }
  const [pa, pb, pc] = pick(TRIPLES)
  const k = d === 2 ? ri(1, 3) : ri(1, 2)
  const a = pa * k
  const b = pb * k
  const c = pc * k
  if (Math.random() < 0.5) {
    // find hypotenuse
    return build('pythagorean', d, `A right triangle has legs ${a} and ${b}. How long is the hypotenuse?`, `${c}`, poolExcept(`${c}`, [`${a + b}`, `${c + k}`, `${c - k}`, `${Math.round(Math.sqrt(a * a + b * b)) + 2}`, `${b + k}`]), { kind: 'rightTriangle', a: `${a}`, b: `${b}`, c: '?' })
  }
  // find a leg
  return build('pythagorean', d, `A right triangle has a hypotenuse of ${c} and one leg of ${a}. How long is the other leg?`, `${b}`, poolExcept(`${b}`, [`${c - a}`, `${b + k}`, `${b - k}`, `${a}`, `${c}`]), { kind: 'rightTriangle', a: `${a}`, b: '?', c: `${c}` })
}

// ---------- 5. Trig ratios (SOH-CAH-TOA) ----------

const trig: HsGen = (d) => {
  const [opp, adj, hyp] = pick(TRIPLES)
  const ratio = d === 1 ? 'sin' : pick(['sin', 'cos', 'tan'] as const)
  const value =
    ratio === 'sin' ? reduceFrac(opp, hyp) : ratio === 'cos' ? reduceFrac(adj, hyp) : reduceFrac(opp, adj)
  const wrongVals = [reduceFrac(opp, hyp), reduceFrac(adj, hyp), reduceFrac(opp, adj), reduceFrac(adj, opp), reduceFrac(hyp, opp)]
  const prompt =
    `In a right triangle, the side opposite angle θ is ${opp}, the side adjacent to θ is ${adj}, and the hypotenuse is ${hyp}. ` +
    `Find ${ratio} θ.`
  return build('trig', d, prompt, value, poolExcept(value, wrongVals), { kind: 'rightTriangle', a: `${opp}`, b: `${adj}`, c: `${hyp}` })
}

// ---------- 6. Quadrilaterals ----------

const quadrilaterals: HsGen = (d) => {
  if (d === 3 && Math.random() < 0.5) {
    const cases = [
      { q: 'Which quadrilateral always has four right angles and four equal sides?', ans: 'Square' },
      { q: 'Which quadrilateral always has perpendicular diagonals and four equal sides?', ans: 'Rhombus' },
      { q: 'Which quadrilateral has exactly one pair of parallel sides?', ans: 'Trapezoid' },
      { q: 'In which quadrilateral are opposite sides parallel but angles are not right angles (in general)?', ans: 'Parallelogram' },
    ] as const
    const c = pick(cases)
    return build('quadrilaterals', d, c.q, c.ans, poolExcept(c.ans, ['Square', 'Rhombus', 'Trapezoid', 'Parallelogram', 'Rectangle'].filter((x) => x !== c.ans)))
  }
  if (d >= 2) {
    // parallelogram angle relationships
    const a = ri(40, 130)
    if (Math.random() < 0.5) {
      return build('quadrilaterals', d, `In parallelogram ABCD, ∠A = ${a}°. What is ∠C (the opposite angle)?`, deg(a), poolExcept(deg(a), [deg(180 - a), deg(90), deg(a + 10), deg(Math.abs(a - 10)), deg(360 - a)]), { kind: 'quad', shape: 'parallelogram', labels: ['A', 'B', 'C', 'D'] })
    }
    const ans = 180 - a
    return build('quadrilaterals', d, `In parallelogram ABCD, ∠A = ${a}°. What is ∠B (a consecutive angle)?`, deg(ans), poolExcept(deg(ans), [deg(a), deg(90), deg(ans + 10), deg(Math.abs(ans - 10)), deg(360 - a)]), { kind: 'quad', shape: 'parallelogram', labels: ['A', 'B', 'C', 'D'] })
  }
  // d1: quadrilateral angle sum = 360
  const a = ri(60, 120)
  const b = ri(60, 120)
  const c = ri(50, 110)
  const ans = 360 - a - b - c
  return build('quadrilaterals', d, `A quadrilateral has three angles measuring ${a}°, ${b}°, and ${c}°. What is the fourth angle?`, deg(ans), poolExcept(deg(ans), [deg(180 - c), deg(a), deg(ans + 10), deg(Math.abs(ans - 10)), deg(360 - a)]), { kind: 'quad', shape: 'trapezoid', labels: [`${a}°`, `${b}°`, `${c}°`, '?'] })
}

// ---------- 7. Circles ----------

const circles: HsGen = (d) => {
  const r = ri(3, 12)
  if (d === 3) {
    // decimal, π ≈ 3.14
    const area = +(Math.PI * r * r).toFixed(1)
    const ans = `${area.toFixed(1)}`
    const wrong = poolExcept(ans, [(2 * Math.PI * r).toFixed(1), (Math.PI * (2 * r) * (2 * r)).toFixed(1), (Math.PI * r).toFixed(1), (area + 3).toFixed(1)])
    return build('circles', d, `A circle has radius ${r}. Find its area (use π ≈ 3.14), rounded to the nearest tenth.`, ans, wrong, { kind: 'circle', label: `${r}`, which: 'r' })
  }
  if (d === 2 || Math.random() < 0.5) {
    // area in terms of π
    const ans = `${r * r}π`
    return build('circles', d, `A circle has radius ${r}. What is its area? (Leave the answer in terms of π.)`, ans, poolExcept(ans, [`${2 * r}π`, `${r}π`, `${2 * r * r}π`, `${4 * r * r}π`, `${r * r}`]), { kind: 'circle', label: `${r}`, which: 'r' })
  }
  // circumference in terms of π
  const ans = `${2 * r}π`
  return build('circles', d, `A circle has radius ${r}. What is its circumference? (Leave the answer in terms of π.)`, ans, poolExcept(ans, [`${r * r}π`, `${r}π`, `${4 * r}π`, `${2 * r}`, `${r * r}`]), { kind: 'circle', label: `${r}`, which: 'r' })
}

// ---------- 8. Area & volume ----------

const areaVolume: HsGen = (d) => {
  if (d === 1) {
    if (Math.random() < 0.5) {
      const b = ri(4, 16)
      const h = ri(3, 12)
      const ans = (b * h) / 2
      return build('areaVolume', d, `A triangle has a base of ${b} and a height of ${h}. What is its area?`, `${ans % 1 === 0 ? ans : ans.toFixed(1)}`, poolExcept(`${ans}`, [`${b * h}`, `${b + h}`, `${ans + b}`, `${ans + 2}`, `${Math.max(1, ans - 2)}`]), { kind: 'rightTriangle', a: `${b}`, b: `${h}`, c: '' })
    }
    const b = ri(4, 15)
    const h = ri(3, 12)
    const ans = b * h
    return build('areaVolume', d, `A parallelogram has a base of ${b} and a height of ${h}. What is its area?`, `${ans}`, poolExcept(`${ans}`, [`${(b * h) / 2}`, `${2 * (b + h)}`, `${b + h}`, `${ans + b}`, `${ans - h}`]), { kind: 'quad', shape: 'parallelogram', labels: [`${b}`, `${h}`] })
  }
  if (d === 2) {
    if (Math.random() < 0.5) {
      const b1 = ri(4, 12)
      const b2 = ri(4, 12)
      const h = ri(2, 10) * 2 // even → integer area
      const ans = ((b1 + b2) / 2) * h
      return build('areaVolume', d, `A trapezoid has parallel sides of ${b1} and ${b2} and a height of ${h}. What is its area?`, `${ans}`, poolExcept(`${ans}`, [`${(b1 + b2) * h}`, `${b1 + b2 + h}`, `${b1 * b2}`, `${ans + h}`, `${ans - b1}`]), { kind: 'quad', shape: 'trapezoid', labels: [`${b1}`, `${b2}`, `${h}`] })
    }
    const l = ri(3, 9)
    const w = ri(3, 9)
    const h = ri(3, 9)
    const ans = l * w * h
    return build('areaVolume', d, `A rectangular prism is ${l} by ${w} by ${h}. What is its volume?`, `${ans}`, poolExcept(`${ans}`, [`${2 * (l * w + l * h + w * h)}`, `${l + w + h}`, `${l * w}`, `${ans + l}`, `${ans - w}`]), { kind: 'box', l: `${l}`, w: `${w}`, h: `${h}` })
  }
  // d3: cylinder volume (in terms of π) or prism surface area
  if (Math.random() < 0.5) {
    const r = ri(2, 7)
    const h = ri(3, 10)
    const ans = `${r * r * h}π`
    return build('areaVolume', d, `A cylinder has radius ${r} and height ${h}. What is its volume? (Leave the answer in terms of π.)`, ans, poolExcept(ans, [`${2 * r * h}π`, `${r * r}π`, `${r * h}π`, `${2 * r * r * h}π`, `${r * r * h}`]), { kind: 'circle', label: `${r}`, which: 'r' })
  }
  const l = ri(3, 8)
  const w = ri(3, 8)
  const h = ri(3, 8)
  const ans = 2 * (l * w + l * h + w * h)
  return build('areaVolume', d, `A rectangular prism is ${l} by ${w} by ${h}. What is its total surface area?`, `${ans}`, poolExcept(`${ans}`, [`${l * w * h}`, `${l * w + l * h + w * h}`, `${l + w + h}`, `${ans + l}`, `${ans - w}`]), { kind: 'box', l: `${l}`, w: `${w}`, h: `${h}` })
}

// ---------- 9. Coordinate geometry ----------

const evenPt = () => ri(-4, 4) * 2 // even coordinate → integer midpoints

const coordinate: HsGen = (d) => {
  if (d === 1) {
    const x1 = evenPt()
    const y1 = evenPt()
    const x2 = evenPt()
    const y2 = evenPt()
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const ans = `(${mx}, ${my})`
    return build('coordinate', d, `Find the midpoint of the segment from (${x1}, ${y1}) to (${x2}, ${y2}).`, ans, poolExcept(ans, [`(${x1 + x2}, ${y1 + y2})`, `(${x2 - x1}, ${y2 - y1})`, `(${my}, ${mx})`, `(${mx + 1}, ${my})`, `(${mx}, ${my - 1})`]), { kind: 'coordPair', x1, y1, x2, y2 })
  }
  if (d === 2) {
    let x1 = ri(-6, 6)
    let x2 = ri(-6, 6)
    while (x2 === x1) x2 = ri(-6, 6)
    const y1 = ri(-6, 6)
    const y2 = ri(-6, 6)
    const ans = reduceFrac(y2 - y1, x2 - x1)
    // meaningful decoys first (reciprocal / sign-flip / sum), then an integer
    // spread that guarantees ≥3 distinct even when dy == dx (slope 1) collapses them
    const wrong = poolExcept(ans, [
      reduceFrac(x2 - x1, y2 - y1),
      reduceFrac(-(y2 - y1), x2 - x1),
      reduceFrac(y2 + y1, x2 + x1),
      `${y2 - y1}`,
      `${x2 - x1}`,
      '0', '2', '-1', '-2', '3', '-3',
    ])
    return build('coordinate', d, `What is the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2})?`, ans, wrong, { kind: 'coordPair', x1, y1, x2, y2 })
  }
  // d3: distance via a triple → integer
  const [pa, pb, pc] = pick(TRIPLES)
  const k = ri(1, 2)
  const dx = pa * k
  const dy = pb * k
  const x1 = ri(-6, 2)
  const y1 = ri(-6, 2)
  const x2 = x1 + dx
  const y2 = y1 + dy
  const ans = `${pc * k}`
  return build('coordinate', d, `Find the distance between (${x1}, ${y1}) and (${x2}, ${y2}).`, ans, poolExcept(ans, [`${dx + dy}`, `${pc * k + k}`, `${pc * k - k}`, `${dx}`, `${dy}`]), { kind: 'coordPair', x1, y1, x2, y2 })
}

// ---------- registry ----------

export const GEOMETRY_GENERATORS: Record<string, HsGen> = {
  angles,
  congruence,
  similarity,
  pythagorean,
  trig,
  quadrilaterals,
  circles,
  areaVolume,
  coordinate,
}

/** Generate one geometry question for a unit; unknown units fall back safely. */
export function geometryQuestion(unitId: string, d: Difficulty): HsQuestion {
  const gen = GEOMETRY_GENERATORS[unitId]
  return gen ? gen(d) : angles(d)
}

/** Fresh-question wrapper: avoids repeating a prompt within a session (best effort). */
export function geometryFresh(unitId: string, d: Difficulty, seen: Set<string>): HsQuestion {
  let q = geometryQuestion(unitId, d)
  for (let i = 0; i < 8 && seen.has(q.prompt + JSON.stringify(q.figure ?? '')); i++) {
    q = geometryQuestion(unitId, d)
  }
  seen.add(q.prompt + JSON.stringify(q.figure ?? ''))
  return q
}

// re-export shuffle so the timed-quiz pool can mix units without importing genUtils
export { shuffle }
