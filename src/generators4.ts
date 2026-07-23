import type { Question } from './types'
import {
  bigNear,
  finishChoices,
  fmtMoney,
  fracMixed,
  fromPool,
  numNear,
  pick,
  ri,
  type Gen,
} from './genUtils'

const NAMES = ['Ava', 'Leo', 'Mia', 'Max', 'Zoe', 'Sam', 'Ella', 'Kai', 'Ruby', 'Finn'] as const

const mult4: Gen = (d) => {
  let a: number
  let b: number
  if (d === 1) {
    a = ri(13, 49)
    b = ri(2, 9)
  } else if (d === 2) {
    if (Math.random() < 0.5) {
      a = ri(12, 39)
      b = ri(12, 29)
    } else {
      a = ri(112, 489)
      b = ri(2, 9)
    }
  } else {
    a = ri(1200, 9800)
    b = ri(2, 9)
  }
  const ans = a * b
  return {
    skillId: 'mult4',
    difficulty: d,
    prompt: `${a.toLocaleString()} × ${b.toLocaleString()} = ?`,
    ...finishChoices(ans.toLocaleString(), bigNear(ans)),
  }
}

const div4: Gen = (d) => {
  const divisor = ri(2, 9)
  if (d === 1) {
    const q = ri(11, 49)
    return {
      skillId: 'div4',
      difficulty: d,
      prompt: `${q * divisor} ÷ ${divisor} = ?`,
      ...finishChoices(String(q), numNear(q, 4, 1)),
    }
  }
  const q = d === 2 ? ri(11, 89) : ri(101, 489)
  const r = ri(1, divisor - 1)
  const dividend = q * divisor + r
  const ans = `${q} R ${r}`
  const pool = [
    `${q} R ${r === 1 ? r + 1 : r - 1}`,
    `${q + 1} R ${r}`,
    `${q - 1} R ${r}`,
    `${q} R ${divisor - r === r ? r + 2 : divisor - r}`,
  ].filter((s) => s !== ans)
  return {
    skillId: 'div4',
    difficulty: d,
    prompt: `${dividend.toLocaleString()} ÷ ${divisor} = ?\n(R means remainder)`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const factors4: Gen = (d) => {
  if (d === 1) {
    const f = ri(3, 9)
    const n = f * ri(2, 8)
    const nonFactors: string[] = []
    for (let x = 2; x <= 12; x++) if (n % x !== 0) nonFactors.push(String(x))
    return {
      skillId: 'factors4',
      difficulty: d,
      prompt: `Which number is a FACTOR of ${n}?`,
      ...finishChoices(String(f), fromPool(nonFactors)),
    }
  }
  if (d === 2) {
    const n = ri(3, 9)
    const m = n * ri(3, 9)
    const pool: string[] = []
    for (let x = m - 3; x <= m + 3; x++) {
      if (x > 0 && x !== m && x % n !== 0) pool.push(String(x))
    }
    return {
      skillId: 'factors4',
      difficulty: d,
      prompt: `Which number is a MULTIPLE of ${n}?`,
      ...finishChoices(String(m), fromPool(pool)),
    }
  }
  const primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]
  const composites = ['9', '15', '21', '25', '27', '33', '35', '39', '45', '49', '51', '55', '57']
  return {
    skillId: 'factors4',
    difficulty: d,
    prompt: 'Which of these numbers is PRIME?',
    ...finishChoices(String(pick(primes)), fromPool(composites)),
  }
}

const place4: Gen = (d) => {
  if (d === 1) {
    const size = ri(5, 6)
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .sort(() => Math.random() - 0.5)
      .slice(0, size)
    const n = digits.reduce((acc, dig) => acc * 10 + dig, 0)
    const pos = ri(0, size - 1)
    const digit = digits[size - 1 - pos]
    const value = digit * 10 ** pos
    const pool = [1, 10, 100, 1000, 10000, 100000]
      .map((p) => (digit * p).toLocaleString())
      .filter((s) => s !== value.toLocaleString())
    return {
      skillId: 'place4',
      difficulty: d,
      prompt: `In the number ${n.toLocaleString()}, what is the VALUE of the digit ${digit}?`,
      ...finishChoices(value.toLocaleString(), fromPool(pool)),
    }
  }
  if (d === 2) {
    const a = ri(10000, 989999)
    const b = a + pick([-1, 1] as const) * pick([100, 1000, 10000] as const)
    const bigger = Math.max(a, b)
    const choices = [a.toLocaleString(), b.toLocaleString()].sort(() => Math.random() - 0.5)
    return {
      skillId: 'place4',
      difficulty: d,
      prompt: 'Which number is GREATER?',
      choices,
      answerIndex: choices.indexOf(bigger.toLocaleString()),
    }
  }
  const to = pick([1000, 10000] as const)
  const n = ri(10500, 989499)
  const ans = Math.round(n / to) * to
  const other = to === 1000 ? 10000 : 1000
  const pool = [
    Math.floor(n / to) * to,
    Math.ceil(n / to) * to,
    Math.round(n / other) * other,
    ans + to,
    ans - to,
    ans + 2 * to,
    ans - 2 * to,
    ans + 3 * to,
  ]
    .filter((v) => v !== ans && v >= 0)
    .map((v) => v.toLocaleString())
  return {
    skillId: 'place4',
    difficulty: d,
    prompt: `Round ${n.toLocaleString()} to the nearest ${to.toLocaleString()}.`,
    ...finishChoices(ans.toLocaleString(), fromPool(pool)),
  }
}

const fracEquiv4: Gen = (d) => {
  if (d === 1) {
    const b = ri(2, 6)
    const a = ri(1, b - 1)
    const k = ri(2, 4)
    const ans = `${a * k}/${b * k}`
    const pool = [
      `${a * k + 1}/${b * k}`,
      `${a * k}/${b * k + b}`,
      `${a + 1}/${b + 1}`,
      `${a * k - 1 || a * k + 2}/${b * k}`,
    ].filter((f) => {
      const [n2, d2] = f.split('/').map(Number)
      return n2 * b !== a * d2 // reject accidentally-equivalent fractions
    })
    return {
      skillId: 'fracEquiv4',
      difficulty: d,
      prompt: `Which fraction is EQUIVALENT to ${a}/${b}?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  // d2/d3: compare unlike denominators (d3 keeps values close)
  for (let tries = 0; tries < 50; tries++) {
    const b1 = ri(3, d === 2 ? 8 : 12)
    const b2 = ri(3, d === 2 ? 8 : 12)
    const a1 = ri(1, b1 - 1)
    const a2 = ri(1, b2 - 1)
    if (a1 * b2 === a2 * b1) continue
    if (d === 3 && Math.abs(a1 / b1 - a2 / b2) > 0.25) continue
    const f1 = `${a1}/${b1}`
    const f2 = `${a2}/${b2}`
    const bigger = a1 / b1 > a2 / b2 ? f1 : f2
    const choices = [f1, f2].sort(() => Math.random() - 0.5)
    return {
      skillId: 'fracEquiv4',
      difficulty: d,
      prompt: 'Which fraction is BIGGER?',
      visual: { kind: 'fractionPair', a: [a1, b1], b: [a2, b2] },
      choices,
      answerIndex: choices.indexOf(bigger),
    }
  }
  return fracEquiv4(1) // vanishingly unlikely fallback
}

const fracAddSub4: Gen = (d) => {
  const den = d === 1 ? ri(3, 8) : ri(3, 12)
  const sub = Math.random() < 0.5
  if (sub) {
    const a = ri(2, den - 1)
    const b = ri(1, a - 1)
    const ans = fracMixed(a - b, den)
    const pool = [
      fracMixed(a + b, den),
      `${a - b}/${den * 2}`,
      fracMixed(a - b + 1, den),
      `${a}/${den - b > 0 ? den - b : den + b}`,
      fracMixed(a - b + 2, den),
      `${a + 1}/${den}`,
    ].filter((f) => f !== ans)
    return {
      skillId: 'fracAddSub4',
      difficulty: d,
      prompt: `${a}/${den} − ${b}/${den} = ?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  const maxA = d === 3 ? den + 3 : den - 1
  let a = ri(1, maxA)
  let b = ri(1, maxA)
  if (d < 3 && a + b >= den) {
    a = ri(1, Math.max(1, den - 2))
    b = ri(1, Math.max(1, den - 1 - a))
  }
  const ans = fracMixed(a + b, den)
  const pool = [
    `${a + b}/${den * 2}`,
    fracMixed(Math.abs(a - b) || a + b + 1, den),
    fracMixed(a + b + 1, den),
    fracMixed(a * b, den),
    fracMixed(a + b + 2, den),
    `${a + b}/${den + 1}`,
  ].filter((f) => f !== ans)
  return {
    skillId: 'fracAddSub4',
    difficulty: d,
    prompt: `${a}/${den} + ${b}/${den} = ?`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const fracMult4: Gen = (d) => {
  if (d === 1) {
    const b = ri(3, 8)
    const k = ri(2, 5)
    const whole = b * k
    return {
      skillId: 'fracMult4',
      difficulty: d,
      prompt: `What is 1/${b} of ${whole}?`,
      ...finishChoices(String(k), numNear(k, 3, 1)),
    }
  }
  if (d === 2) {
    const b = ri(3, 6)
    const a = ri(2, b - 1)
    const w = b * ri(2, 4)
    const ans = (a * w) / b
    return {
      skillId: 'fracMult4',
      difficulty: d,
      prompt: `${a}/${b} × ${w} = ?`,
      ...finishChoices(String(ans), numNear(ans, Math.max(3, Math.ceil(ans / 4)), 1)),
    }
  }
  const b = ri(3, 6)
  const a = ri(2, b - 1)
  let w = ri(3, 9)
  if (w % b === 0) w += 1
  const ans = fracMixed(a * w, b)
  const pool = [
    fracMixed(a * w + 1, b),
    fracMixed(a * w - 1, b),
    fracMixed(a + w, b),
    `${a * w}/${b * w}`,
  ].filter((f) => f !== ans)
  return {
    skillId: 'fracMult4',
    difficulty: d,
    prompt: `${a}/${b} × ${w} = ?`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const dec4: Gen = (d) => {
  if (d === 1) {
    const overHundred = Math.random() < 0.5
    if (overHundred) {
      const n = ri(1, 99)
      const ans = String(n / 100)
      const pool = [String(n / 10), String(n / 1000), String(n), `${n}.0`].filter(
        (s) => s !== ans,
      )
      return {
        skillId: 'dec4',
        difficulty: d,
        prompt: `Which decimal equals ${n}/100?`,
        ...finishChoices(ans, fromPool(pool)),
      }
    }
    const n = ri(1, 9)
    const ans = String(n / 10)
    const pool = [String(n / 100), String(n), `${n}.10`, String((n + 1) / 10)].filter(
      (s) => s !== ans,
    )
    return {
      skillId: 'dec4',
      difficulty: d,
      prompt: `Which decimal equals ${n}/10?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  if (d === 2) {
    // the classic 0.4 vs 0.35 trap
    for (let tries = 0; tries < 50; tries++) {
      const t = ri(2, 9)
      const h = t * 10 + pick([-5, -3, 3, 5] as const)
      if (h <= 0 || h >= 100 || h === t * 10) continue
      const aStr = String(t / 10)
      const bStr = String(h / 100)
      const bigger = t * 10 > h ? aStr : bStr
      const choices = [aStr, bStr].sort(() => Math.random() - 0.5)
      return {
        skillId: 'dec4',
        difficulty: d,
        prompt: `Which is BIGGER?`,
        choices,
        answerIndex: choices.indexOf(bigger),
      }
    }
  }
  const a = ri(1, 9) * 10
  const b = ri(1, 89)
  const sum = a + b
  const ans = String(sum / 100)
  const pool = [
    String((sum + 10) / 100),
    String((sum - 10) / 100),
    String((a / 10 + b) / 100),
    String(sum / 10),
  ].filter((s) => s !== ans)
  return {
    skillId: 'dec4',
    difficulty: d,
    prompt: `${a / 100} + ${b / 100} = ?`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const CONVERSIONS = [
  { from: 'meters', to: 'centimeters', f: 100, level: 1 },
  { from: 'kilograms', to: 'grams', f: 1000, level: 1 },
  { from: 'minutes', to: 'seconds', f: 60, level: 2 },
  { from: 'kilometers', to: 'meters', f: 1000, level: 2 },
  { from: 'liters', to: 'milliliters', f: 1000, level: 2 },
  { from: 'hours', to: 'minutes', f: 60, level: 2 },
  { from: 'feet', to: 'inches', f: 12, level: 2 },
] as const

const convert4: Gen = (d) => {
  if (d < 3) {
    const opts = CONVERSIONS.filter((c) => c.level <= d)
    const c = pick(opts)
    const n = ri(2, d === 1 ? 9 : 12)
    const ans = n * c.f
    return {
      skillId: 'convert4',
      difficulty: d,
      prompt: `${n} ${c.from} = ? ${c.to}`,
      ...finishChoices(ans.toLocaleString(), bigNear(ans)),
    }
  }
  if (Math.random() < 0.5) {
    const c = pick(CONVERSIONS.filter((x) => x.f === 1000))
    const whole = ri(1, 5)
    const extra = ri(1, 9) * 100
    const ans = whole * 1000 + extra
    return {
      skillId: 'convert4',
      difficulty: d,
      prompt: `${whole} ${c.from} ${extra} ${c.to} = ? ${c.to}`,
      ...finishChoices(ans.toLocaleString(), bigNear(ans)),
    }
  }
  const h = ri(1, 4)
  const m = ri(1, 11) * 5
  const ans = h * 60 + m
  return {
    skillId: 'convert4',
    difficulty: d,
    prompt: `${h} hour${h > 1 ? 's' : ''} ${m} minutes = ? minutes`,
    ...finishChoices(String(ans), numNear(ans, 15, 1)),
  }
}

const angles4: Gen = (d) => {
  if (d === 1 || (d === 2 && Math.random() < 0.5)) {
    const kinds = [
      { deg: () => ri(20, 80), name: 'acute' },
      { deg: () => 90, name: 'right' },
      { deg: () => ri(100, 160), name: 'obtuse' },
      ...(d === 2 ? [{ deg: () => 180, name: 'straight' }] : []),
    ]
    const k = pick(kinds)
    const others = kinds.filter((x) => x.name !== k.name).map((x) => x.name)
    return {
      skillId: 'angles4',
      difficulty: d,
      prompt: 'What kind of angle is this?',
      visual: { kind: 'angle', degrees: k.deg() },
      ...finishChoices(k.name, fromPool(others), others.length + 1),
    }
  }
  if (d === 2) {
    const LINES = [
      { q: 'Lines that NEVER cross are called…', ans: 'parallel', wrong: ['perpendicular', 'intersecting', 'curved'] },
      { q: 'Lines that cross at a perfect square corner are called…', ans: 'perpendicular', wrong: ['parallel', 'intersecting', 'equal'] },
      { q: 'Two lines that cross at any point are called…', ans: 'intersecting lines', wrong: ['parallel lines', 'rays', 'segments'] },
    ]
    const item = pick(LINES)
    return {
      skillId: 'angles4',
      difficulty: d,
      prompt: item.q,
      ...finishChoices(item.ans, fromPool([...item.wrong])),
    }
  }
  const total = pick([90, 180] as const)
  const a = ri(15, total - 15)
  const ans = total - a
  return {
    skillId: 'angles4',
    difficulty: d,
    prompt: `Two angles fit together to make a ${total === 90 ? 'right angle (90°)' : 'straight line (180°)'}. One angle is ${a}°. How many degrees is the other?`,
    ...finishChoices(`${ans}°`, numNear(ans, 12, 1, '°')),
  }
}

const word4: Gen = (d) => {
  const name = pick(NAMES)
  const kind = ri(1, 4)
  let prompt: string
  let ans: number
  let money = false
  if (kind === 1) {
    const packs = ri(3, 4 + 2 * d)
    const per = ri(8, 10 + 5 * d)
    const gave = ri(5, packs * per - 5)
    ans = packs * per - gave
    prompt = `${name} buys ${packs} packs of ${per} trading cards, then gives ${gave} cards to a friend. How many cards does ${name} have left?`
  } else if (kind === 2) {
    money = true
    const price = ri(2, 3 + d) * 100 + pick([0, 25, 50, 75] as const)
    const qty = ri(2, 3)
    const bill = Math.ceil((price * qty) / 1000) * 1000 + (d === 3 ? 0 : 1000)
    ans = bill - price * qty
    prompt = `${name} buys ${qty} books that cost ${fmtMoney(price)} each and pays with ${fmtMoney(bill)}. How much change does ${name} get?`
  } else if (kind === 3) {
    const n = ri(3, 3 + d)
    const q = ri(6, 8 + 4 * d)
    const total = n * q
    const a = ri(1, total - 1)
    ans = q
    prompt = `${name} has ${a} marbles and wins ${total - a} more. ${name} shares all of them equally among ${n} friends. How many marbles does each friend get?`
  } else {
    const perDay = ri(3, 4 + 2 * d)
    const days = ri(3, 4 + d)
    const goal = perDay * days + ri(5, 10 * d)
    ans = goal - perDay * days
    prompt = `${name} reads ${perDay} pages a day for ${days} days. The book has ${goal} pages. How many pages are left?`
  }
  return {
    skillId: 'word4',
    difficulty: d,
    prompt,
    ...(money
      ? finishChoices(fmtMoney(ans), () => {
          const v = Math.max(5, ans + pick([-100, -50, -25, 25, 50, 100] as const))
          return v === ans ? fmtMoney(ans + 25) : fmtMoney(v)
        })
      : finishChoices(String(ans), numNear(ans, Math.max(3, Math.round(ans / 5)), 0))),
  }
}

export const GENERATORS4 = {
  mult4,
  div4,
  factors4,
  place4,
  fracEquiv4,
  fracAddSub4,
  fracMult4,
  dec4,
  convert4,
  angles4,
  word4,
} satisfies Partial<Record<Question['skillId'], Gen>>
