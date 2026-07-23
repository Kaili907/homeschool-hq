import type { Question } from './types'
import {
  finishChoices,
  fmtDec,
  fmtFrac,
  fmtMoney,
  fromPool,
  numNear,
  pick,
  ri,
  shuffle,
  type Gen,
} from './genUtils'

const ratio6: Gen = (d) => {
  if (d === 1) {
    const items = pick(['apples', 'oranges', 'muffins', 'pencils'] as const)
    const qty = ri(2, 5)
    const cost = qty * ri(1, 4)
    const mult = ri(2, 4)
    const ans = cost * mult
    return {
      skillId: 'ratio6',
      difficulty: d,
      prompt: `${qty} ${items} cost $${cost}. How much do ${qty * mult} ${items} cost?`,
      visual: {
        kind: 'ratioTable',
        headers: [items[0].toUpperCase() + items.slice(1), 'Cost'],
        rows: [
          [String(qty), `$${cost}`],
          [String(qty * mult), '?'],
        ],
      },
      ...finishChoices(`$${ans}`, () => {
        const v = Math.max(1, ans + (Math.random() < 0.5 ? 1 : -1) * ri(1, Math.max(3, mult * 2)))
        return v === ans ? `$${ans + 2}` : `$${v}`
      }),
    }
  }
  if (d === 2) {
    const hours = ri(2, 6)
    const rate = ri(20, 70)
    return {
      skillId: 'ratio6',
      difficulty: d,
      prompt: `A car drives ${hours * rate} miles in ${hours} hours at a steady speed. How many miles per hour is that?`,
      ...finishChoices(String(rate), numNear(rate, 8, 1)),
    }
  }
  const lbs = ri(2, 6)
  const perLb = ri(21, 65) * 5 // cents, multiple of 5
  const total = lbs * perLb
  return {
    skillId: 'ratio6',
    difficulty: d,
    prompt: `${lbs} pounds of grapes cost ${fmtMoney(total)}. What is the price per pound?`,
    ...finishChoices(fmtMoney(perLb), () => {
      const v = Math.max(5, perLb + pick([-25, -10, -5, 5, 10, 25] as const))
      return v === perLb ? fmtMoney(perLb + 15) : fmtMoney(v)
    }),
  }
}

const percent6: Gen = (d) => {
  if (d < 3) {
    const p = d === 1 ? pick([10, 25, 50] as const) : pick([5, 15, 20, 30, 40, 60, 75, 80] as const)
    const n = ri(2, 12) * 20
    const ans = (n * p) / 100
    return {
      skillId: 'percent6',
      difficulty: d,
      prompt: `What is ${p}% of ${n}?`,
      ...finishChoices(String(ans), numNear(ans, Math.max(4, Math.round(ans / 4)), 1)),
    }
  }
  const p = pick([10, 20, 25, 50] as const)
  const whole = (100 / p) * ri(2, 9)
  const part = (whole * p) / 100
  return {
    skillId: 'percent6',
    difficulty: d,
    prompt: `${p}% of a number is ${part}. What is the number?`,
    ...finishChoices(String(whole), numNear(whole, Math.max(5, Math.round(whole / 4)), 1)),
  }
}

const fracDiv6: Gen = (d) => {
  if (d === 1) {
    const b = ri(2, 8)
    const w = ri(2, 5)
    const ans = w * b
    return {
      skillId: 'fracDiv6',
      difficulty: d,
      prompt: `How many 1/${b}-cup servings are in ${w} cups of rice?`,
      ...finishChoices(
        String(ans),
        fromPool(
          [
            String(w + b),
            String(b),
            String(ans + b),
            String(Math.max(1, ans - b)),
            String(ans + 1),
            String(ans + 2),
          ].filter((s) => s !== String(ans)),
        ),
      ),
    }
  }
  if (d === 2) {
    if (Math.random() < 0.5) {
      const b = ri(2, 6)
      const w = ri(2, 5)
      const ans = fmtFrac(1, b * w)
      const pool = [
        fmtFrac(w, b),
        `${w}/${b * w}`,
        fmtFrac(1, b + w),
        fmtFrac(b, w) === ans ? `${b + 1}/${w}` : fmtFrac(b, w),
        `1/${b * w + 1}`,
        `2/${b * w}`,
      ].filter((f) => f !== ans)
      return {
        skillId: 'fracDiv6',
        difficulty: d,
        prompt: `1/${b} ÷ ${w} = ?`,
        ...finishChoices(ans, fromPool(pool)),
      }
    }
    const den = ri(3, 9)
    const a = ri(2, den - 1)
    return {
      skillId: 'fracDiv6',
      difficulty: d,
      prompt: `${a}/${den} ÷ 1/${den} = ?`,
      ...finishChoices(String(a), numNear(a, 3, 1)),
    }
  }
  for (let tries = 0; tries < 50; tries++) {
    const b = ri(2, 8)
    const a = ri(1, b - 1)
    const dd = ri(2, 8)
    const c = ri(1, dd - 1)
    if (a * dd === c * b) continue // avoid answer 1
    const ans = fmtFrac(a * dd, b * c)
    const pool = [
      fmtFrac(a * c, b * dd),
      fmtFrac(a * b, c * dd),
      fmtFrac(a + dd, b + c),
      fmtFrac(a * dd + 1, b * c),
      fmtFrac(a * dd + 2, b * c),
      `${a * dd}/${b * c + 1}`,
    ].filter((f) => f !== ans)
    return {
      skillId: 'fracDiv6',
      difficulty: d,
      prompt: `${a}/${b} ÷ ${c}/${dd} = ?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  return fracDiv6(1)
}

const decOps6: Gen = (d) => {
  if (d === 1) {
    const a = ri(100, 999) // hundredths
    const b = ri(100, 999)
    const sub = Math.random() < 0.5 && a !== b
    const [x, y] = sub ? [Math.max(a, b), Math.min(a, b)] : [a, b]
    const ans = sub ? x - y : x + y
    return {
      skillId: 'decOps6',
      difficulty: d,
      prompt: `${fmtDec(x)} ${sub ? '−' : '+'} ${fmtDec(y)} = ?`,
      ...finishChoices(fmtDec(ans), () => {
        const v = ans + pick([-100, -10, -1, 1, 10, 100] as const)
        return v > 0 && v !== ans ? fmtDec(v) : fmtDec(ans + 11)
      }),
    }
  }
  if (d === 2) {
    const a = ri(2, 9) // tenths
    const b = ri(2, 9)
    const ans = a * b // hundredths
    return {
      skillId: 'decOps6',
      difficulty: d,
      prompt: `${fmtDec(a, 1)} × ${fmtDec(b, 1)} = ?`,
      ...finishChoices(fmtDec(ans), () => {
        const v = pick([ans * 10, ans + 10, ans - 10, ans + 1, ans * 100] as const)
        return v > 0 && v !== ans ? fmtDec(v) : fmtDec(ans + 2)
      }),
    }
  }
  const divisor = ri(2, 15) // tenths
  const q = ri(2, 9)
  const dividend = divisor * q // tenths
  return {
    skillId: 'decOps6',
    difficulty: d,
    prompt: `${fmtDec(dividend, 1)} ÷ ${fmtDec(divisor, 1)} = ?`,
    ...finishChoices(String(q), numNear(q, 3, 1)),
  }
}

const int6: Gen = (d) => {
  if (d === 1) {
    if (Math.random() < 0.5) {
      let v = ri(-9, 9)
      if (v === 0) v = -5
      return {
        skillId: 'int6',
        difficulty: d,
        prompt: 'What number does the point show?',
        visual: { kind: 'numberLine', min: -10, max: 10, value: v },
        ...finishChoices(String(v), fromPool([String(-v), String(v + 1), String(v - 1), String(v > 0 ? v + 10 : v - 10)].filter((s) => s !== String(v)))),
      }
    }
    const n = ri(1, 12)
    const v = Math.random() < 0.5 ? n : -n
    const ans = String(-v)
    return {
      skillId: 'int6',
      difficulty: d,
      prompt: `What is the OPPOSITE of ${v}?`,
      ...finishChoices(ans, fromPool([String(v), String(v + 1), String(-v + 1), '0'].filter((s) => s !== ans))),
    }
  }
  if (d === 2) {
    if (Math.random() < 0.5) {
      const n = ri(2, 15)
      const v = Math.random() < 0.5 ? n : -n
      return {
        skillId: 'int6',
        difficulty: d,
        prompt: `|${v}| = ?`,
        ...finishChoices(String(n), fromPool([String(-n), String(n + 1), String(n - 1), '0'].filter((s) => s !== String(n)))),
      }
    }
    const a = -ri(1, 12)
    let b = -ri(1, 12)
    while (b === a) b = -ri(1, 12)
    const bigger = Math.max(a, b)
    const choices = shuffle([String(a), String(b)])
    return {
      skillId: 'int6',
      difficulty: d,
      prompt: 'Which number is GREATER?',
      choices,
      answerIndex: choices.indexOf(String(bigger)),
    }
  }
  const a = ri(1, 9)
  const b = ri(1, 9)
  const ans = a + b
  return {
    skillId: 'int6',
    difficulty: d,
    prompt: `How far apart are −${a} and ${b} on the number line?`,
    visual: { kind: 'numberLine', min: -10, max: 10, value: -a },
    ...finishChoices(
      String(ans),
      fromPool(
        [
          String(Math.abs(a - b) || ans + 1),
          String(ans + 1),
          String(ans - 1),
          String(b),
          String(ans + 2),
          String(Math.max(1, ans - 2)),
        ].filter((s) => s !== String(ans)),
      ),
    ),
  }
}

const QUADRANTS = ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'] as const

const coord6: Gen = (d) => {
  const nz = () => (Math.random() < 0.5 ? ri(1, 5) : -ri(1, 5))
  if (d === 1) {
    const x = nz()
    const y = nz()
    const ans = x > 0 ? (y > 0 ? QUADRANTS[0] : QUADRANTS[3]) : y > 0 ? QUADRANTS[1] : QUADRANTS[2]
    return {
      skillId: 'coord6',
      difficulty: d,
      prompt: 'Which quadrant is the point in?',
      visual: { kind: 'coordGrid', x, y },
      ...finishChoices(ans, fromPool(QUADRANTS.filter((q) => q !== ans) as unknown as string[])),
    }
  }
  if (d === 2) {
    const x = nz()
    const y = nz()
    const ans = `(${x}, ${y})`
    const pool = [`(${y}, ${x})`, `(${-x}, ${y})`, `(${x}, ${-y})`, `(${-x}, ${-y})`].filter(
      (s) => s !== ans,
    )
    return {
      skillId: 'coord6',
      difficulty: d,
      prompt: 'What are the coordinates of the point?',
      visual: { kind: 'coordGrid', x, y },
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  const x = nz()
  const y = nz()
  const overX = Math.random() < 0.5
  const ans = overX ? `(${x}, ${-y})` : `(${-x}, ${y})`
  const pool = [`(${x}, ${y})`, `(${-x}, ${-y})`, overX ? `(${-x}, ${y})` : `(${x}, ${-y})`, `(${y}, ${x})`].filter(
    (s) => s !== ans,
  )
  return {
    skillId: 'coord6',
    difficulty: d,
    prompt: `Reflect the point (${x}, ${y}) across the ${overX ? 'x' : 'y'}-axis. Where does it land?`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const expr6: Gen = (d) => {
  if (d === 1) {
    const a = ri(2, 6)
    const b = ri(1, 12)
    const x = ri(2, 9)
    const ans = a * x + b
    return {
      skillId: 'expr6',
      difficulty: d,
      prompt: `What is ${a}x + ${b} when x = ${x}?`,
      ...finishChoices(
        String(ans),
        fromPool(
          [
            String(a * x - b),
            String(a + x + b),
            String(a * (x + b)),
            String(ans + a),
            String(ans + 1),
            String(ans - 1),
          ].filter((s) => s !== String(ans)),
        ),
      ),
    }
  }
  if (d === 2) {
    const a = ri(2, 6)
    const b = ri(2, 9)
    const ans = `${a}n + ${a * b}`
    const pool = [`${a}n + ${b}`, `${a + b}n`, `n + ${a * b}`, `${a}n × ${b}`].filter((s) => s !== ans)
    return {
      skillId: 'expr6',
      difficulty: d,
      prompt: `Use the distributive property: ${a}(n + ${b}) = ?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  const aa = ri(2, 5)
  const bb = ri(2, 6)
  const av = ri(2, 6)
  const bv = ri(1, 5)
  const ans = aa * av + bb * bv
  return {
    skillId: 'expr6',
    difficulty: d,
    prompt: `What is ${aa}a + ${bb}b when a = ${av} and b = ${bv}?`,
    ...finishChoices(String(ans), numNear(ans, Math.max(4, Math.round(ans / 5)), 1)),
  }
}

const eq6: Gen = (d) => {
  if (d === 1) {
    const x = ri(2, 20)
    const a = ri(2, 15)
    return {
      skillId: 'eq6',
      difficulty: d,
      prompt: `Solve for x:  x + ${a} = ${x + a}`,
      ...finishChoices(String(x), numNear(x, 4, 1)),
    }
  }
  if (d === 2) {
    const x = ri(2, 12)
    const a = ri(2, 9)
    return {
      skillId: 'eq6',
      difficulty: d,
      prompt: `Solve for x:  ${a}x = ${a * x}`,
      ...finishChoices(String(x), numNear(x, 4, 1)),
    }
  }
  if (Math.random() < 0.5) {
    const a = ri(2, 9)
    const b = ri(2, 9)
    return {
      skillId: 'eq6',
      difficulty: d,
      prompt: `Solve for x:  x ÷ ${a} = ${b}`,
      ...finishChoices(String(a * b), numNear(a * b, 6, 1)),
    }
  }
  const x = ri(5, 30)
  const a = ri(2, x - 1)
  return {
    skillId: 'eq6',
    difficulty: d,
    prompt: `Solve for x:  x − ${a} = ${x - a}`,
    ...finishChoices(String(x), numNear(x, 5, 1)),
  }
}

const geo6: Gen = (d) => {
  if (d === 1) {
    const b = ri(2, 6) * 2
    const h = ri(2, 9)
    const ans = (b * h) / 2
    const pool = [b * h, b + h, ans + b, ans - h]
      .filter((v) => v !== ans && v > 0)
      .map((v) => `${v} square units`)
    return {
      skillId: 'geo6',
      difficulty: d,
      prompt: `A triangle has a base of ${b} units and a height of ${h} units. What is its AREA?`,
      ...finishChoices(`${ans} square units`, fromPool(pool)),
    }
  }
  if (d === 2) {
    const W = ri(6, 12)
    const H = ri(5, 9)
    const w = ri(2, W - 3)
    const h = ri(2, H - 2)
    const ans = W * H - w * h
    const pool = [W * H, W * H + w * h, ans + w, ans - h]
      .filter((v) => v !== ans && v > 0)
      .map((v) => `${v} square units`)
    return {
      skillId: 'geo6',
      difficulty: d,
      prompt: `A ${W} by ${H} rectangle has a ${w} by ${h} rectangular corner cut out. What is the AREA of the shape that is left?`,
      ...finishChoices(`${ans} square units`, fromPool(pool)),
    }
  }
  const b = ri(3, 10)
  const h = ri(2, 6) * 2
  const area = (b * h) / 2
  return {
    skillId: 'geo6',
    difficulty: d,
    prompt: `A triangle has an area of ${area} square units and a base of ${b} units. What is its HEIGHT?`,
    ...finishChoices(`${h} units`, numNear(h, 4, 1, ' units')),
  }
}

const vol6: Gen = (d) => {
  if (d === 1) {
    const l = ri(2, 6)
    const w = ri(2, 6)
    const h = ri(2, 6)
    const ans = l * w * h
    return {
      skillId: 'vol6',
      difficulty: d,
      prompt: `A box is ${l} units long, ${w} units wide, and ${h} units tall. What is its VOLUME?`,
      ...finishChoices(`${ans} cubic units`, () => {
        const v = ans + pick([-l, l, -w * h, w * h, 10, -10] as const)
        return v > 0 && v !== ans ? `${v} cubic units` : `${ans + 3} cubic units`
      }),
    }
  }
  if (d === 2) {
    const l = ri(2, 4) * 2 // even so the half-unit height gives a whole answer
    const w = ri(2, 6)
    const halves = ri(2, 5) * 2 + 1 // height in halves: 2.5, 3.5, 4.5...
    const ans = (l * w * halves) / 2
    return {
      skillId: 'vol6',
      difficulty: d,
      prompt: `A box is ${l} units long, ${w} units wide, and ${fmtDec(halves * 5, 1)} units tall. What is its VOLUME?`,
      ...finishChoices(`${ans} cubic units`, () => {
        const v = ans + pick([-l * w, l * w, -w, w, 5, -5] as const)
        return v > 0 && v !== ans ? `${v} cubic units` : `${ans + 4} cubic units`
      }),
    }
  }
  const l = ri(2, 6)
  const w = ri(2, 5)
  const h = ri(2, 5)
  const ans = 2 * (l * w + l * h + w * h)
  const pool = [l * w * h, l * w + l * h + w * h, ans + 2, ans - 2, 4 * (l + w + h)]
    .filter((v) => v !== ans && v > 0)
    .map((v) => `${v} square units`)
  return {
    skillId: 'vol6',
    difficulty: d,
    prompt: `A box is ${l} by ${w} by ${h} units. What is its SURFACE AREA?`,
    ...finishChoices(`${ans} square units`, fromPool(pool)),
  }
}

const stats6: Gen = (d) => {
  if (d === 1) {
    for (let tries = 0; tries < 60; tries++) {
      const mean = ri(4, 12)
      const n1 = ri(1, mean * 2 - 1)
      const n2 = ri(1, mean * 2 - 1)
      const n3 = ri(1, mean * 2 - 1)
      const n4 = 4 * mean - n1 - n2 - n3
      if (n4 < 1 || n4 > mean * 2 + 4) continue
      return {
        skillId: 'stats6',
        difficulty: d,
        prompt: `Find the MEAN of these numbers: ${n1}, ${n2}, ${n3}, ${n4}`,
        ...finishChoices(String(mean), numNear(mean, 3, 1)),
      }
    }
  }
  if (d === 2) {
    if (Math.random() < 0.5) {
      const nums = shuffle(
        [...new Set([ri(1, 20), ri(1, 20), ri(1, 20), ri(1, 20), ri(1, 20), ri(21, 25), ri(26, 30)])],
      ).slice(0, 5)
      while (nums.length < 5) nums.push(nums[0] + nums.length + 30)
      const sorted = [...nums].sort((a, b) => a - b)
      const ans = sorted[2]
      return {
        skillId: 'stats6',
        difficulty: d,
        prompt: `Find the MEDIAN of these numbers: ${nums.join(', ')}`,
        ...finishChoices(String(ans), fromPool([...new Set(nums.map(String))].filter((s) => s !== String(ans)))),
      }
    }
    const repeated = ri(2, 12)
    // two decoys guaranteed distinct from `repeated` and from each other,
    // so the number set always has 5 members and 4 usable distractors
    const decoyPool = [1, 3, 5, 7, 9, 11, 13, 15].filter((v) => v !== repeated)
    const [dA, dB] = shuffle(decoyPool)
    const nums = shuffle([repeated, repeated, repeated, dA, dB])
    return {
      skillId: 'stats6',
      difficulty: d,
      prompt: `Find the MODE of these numbers: ${nums.join(', ')}`,
      ...finishChoices(
        String(repeated),
        fromPool(
          [...new Set([dA, dB, repeated + 1, repeated + 2].map(String))].filter(
            (s) => s !== String(repeated),
          ),
        ),
      ),
    }
  }
  const mean = ri(6, 12)
  const s1 = mean + pick([-3, -2, -1] as const)
  const s2 = mean + pick([1, 2, 3] as const)
  const s3 = mean + pick([-2, 0, 2] as const)
  const ans = 4 * mean - s1 - s2 - s3
  return {
    skillId: 'stats6',
    difficulty: d,
    prompt: `${pick(['Ava', 'Kai', 'Ruby'] as const)} scored ${s1}, ${s2}, and ${s3} on three quizzes. What score on the fourth quiz makes the MEAN exactly ${mean}?`,
    ...finishChoices(String(ans), numNear(ans, 3, 1)),
  }
}

export const GENERATORS6 = {
  ratio6,
  percent6,
  fracDiv6,
  decOps6,
  int6,
  coord6,
  expr6,
  eq6,
  geo6,
  vol6,
  stats6,
} satisfies Partial<Record<Question['skillId'], Gen>>
