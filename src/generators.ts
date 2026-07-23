import type { Difficulty, Question } from './types'
import type { SkillId } from './skills'

// ---------- random helpers ----------

const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build a shuffled 4-choice set from a correct answer and a distractor generator. */
function finishChoices(
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

/** Numeric distractor near the answer, never equal to it (offset >= 1), floored at `min`. */
const numNear = (answer: number, spread: number, min = 0, suffix = '') => () => {
  const off = (Math.random() < 0.5 ? 1 : -1) * ri(1, Math.max(1, spread))
  const v = Math.max(min, answer + off)
  return v === answer ? `${answer + Math.max(1, spread)}${suffix}` : `${v}${suffix}`
}

/** Distractor from a fixed candidate pool. */
const fromPool = (pool: string[]) => () => pool.length ? pick(pool) : ''

const fmtMoney = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`)
const fmtTime = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`

// ---------- generators ----------

type Gen = (d: Difficulty) => Question

const mult: Gen = (d) => {
  if (d === 3 && Math.random() < 0.4) {
    const a = ri(3, 10)
    const b = ri(3, 10)
    return {
      skillId: 'mult',
      difficulty: d,
      prompt: `${a} × ❓ = ${a * b}\nWhat is the missing number?`,
      ...finishChoices(String(b), numNear(b, 3, 1)),
    }
  }
  const a = d === 1 ? ri(0, 5) : d === 2 ? ri(2, 9) : ri(6, 10)
  const b = d === 1 ? ri(1, 6) : d === 2 ? ri(2, 9) : ri(6, 10)
  const ans = a * b
  return {
    skillId: 'mult',
    difficulty: d,
    prompt: `${a} × ${b} = ?`,
    ...finishChoices(String(ans), numNear(ans, Math.max(3, Math.min(9, a + 1)))),
  }
}

const div: Gen = (d) => {
  const quotient = d === 1 ? ri(1, 5) : ri(2, 9)
  const divisor = d === 1 ? ri(2, 5) : ri(2, 9)
  const dividend = quotient * divisor
  if (d === 3 && Math.random() < 0.5) {
    return {
      skillId: 'div',
      difficulty: d,
      prompt: `${dividend} ÷ ❓ = ${quotient}\nWhat is the missing number?`,
      ...finishChoices(String(divisor), numNear(divisor, 3, 1)),
    }
  }
  return {
    skillId: 'div',
    difficulty: d,
    prompt: `${dividend} ÷ ${divisor} = ?`,
    ...finishChoices(String(quotient), numNear(quotient, 3, 0)),
  }
}

const place: Gen = (d) => {
  if (d === 1 || (d === 2 && Math.random() < 0.5)) {
    // Value of a digit. Build a number from distinct digits so the question is unambiguous.
    const size = d === 1 ? 3 : 4
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, size)
    const n = digits.reduce((acc, dig) => acc * 10 + dig, 0)
    const pos = ri(0, size - 1) // 0 = ones
    const digit = digits[size - 1 - pos]
    const value = digit * 10 ** pos
    const pool = [1, 10, 100, 1000].map((p) => String(digit * p)).filter((s) => s !== String(value))
    return {
      skillId: 'place',
      difficulty: d,
      prompt: `In the number ${n.toLocaleString()}, what is the VALUE of the digit ${digit}?`,
      ...finishChoices(String(value), fromPool(pool)),
    }
  }
  if (d === 2) {
    // Expanded form
    const th = ri(1, 9) * 1000
    const h = ri(1, 9) * 100
    const t = ri(1, 9) * 10
    const o = ri(1, 9)
    const sum = th + h + t + o
    return {
      skillId: 'place',
      difficulty: d,
      prompt: `${th.toLocaleString()} + ${h} + ${t} + ${o} = ?`,
      ...finishChoices(
        sum.toLocaleString(),
        () => (Math.max(0, sum + pick([-1000, -100, -10, 10, 100, 1000]))).toLocaleString(),
      ),
    }
  }
  // d === 3: rounding
  const to = pick([10, 100] as const)
  const n = ri(105, 9894)
  const ans = Math.round(n / to) * to
  const other = to === 10 ? 100 : 10
  const pool = [
    Math.floor(n / to) * to,
    Math.ceil(n / to) * to,
    Math.round(n / other) * other,
    ans + to,
    ans - to,
  ]
    .filter((v) => v !== ans && v >= 0)
    .map((v) => v.toLocaleString())
  return {
    skillId: 'place',
    difficulty: d,
    prompt: `Round ${n.toLocaleString()} to the nearest ${to}.`,
    ...finishChoices(ans.toLocaleString(), fromPool(pool)),
  }
}

const addsub: Gen = (d) => {
  const isSub = Math.random() < 0.5
  const offPool = d === 1 ? [-10, -1, 1, 10] : [-100, -10, -1, 1, 10, 100]
  if (!isSub) {
    // Addition with regrouping (ones digits must carry)
    let a = 0
    let b = 0
    for (let i = 0; i < 40; i++) {
      a = d === 1 ? ri(13, 88) : d === 2 ? ri(115, 788) : ri(315, 4788)
      b = d === 1 ? ri(13, 88) : d === 2 ? ri(115, 788) : ri(315, 4788)
      if ((a % 10) + (b % 10) >= 10) break
    }
    const ans = a + b
    return {
      skillId: 'addsub',
      difficulty: d,
      prompt: `${a.toLocaleString()} + ${b.toLocaleString()} = ?`,
      ...finishChoices(ans.toLocaleString(), () =>
        Math.max(0, ans + pick(offPool)).toLocaleString(),
      ),
    }
  }
  // Subtraction with borrowing; at d3, subtract across zeros
  let a: number
  let b: number
  if (d === 3) {
    a = ri(3, 9) * 100 + pick([0, 0, ri(0, 9)])
    b = ri(101, a - 101)
    if (b % 10 === 0) b += ri(1, 9)
  } else {
    for (a = 0, b = 0; ; ) {
      a = d === 1 ? ri(30, 99) : ri(300, 999)
      b = d === 1 ? ri(11, a - 5) : ri(111, a - 50)
      if (a % 10 < b % 10) break
    }
  }
  const ans = a - b
  return {
    skillId: 'addsub',
    difficulty: d,
    prompt: `${a} − ${b} = ?`,
    ...finishChoices(String(ans), () => String(Math.max(0, ans + pick(offPool)))),
  }
}

const FRAC_ITEMS = [
  { item: 'marbles', color: 'blue' },
  { item: 'crayons', color: 'red' },
  { item: 'balloons', color: 'yellow' },
  { item: 'buttons', color: 'green' },
  { item: 'stickers', color: 'purple' },
] as const

const fracUnit: Gen = (d) => {
  if (d === 1) {
    const den = ri(2, 8)
    const ans = `1/${den}`
    const pool = [`1/${den + 1}`, `1/${den === 2 ? 4 : den - 1}`, `${den}/${den}`, `${den - 1}/${den}`].filter(
      (f) => f !== ans,
    )
    return {
      skillId: 'fracUnit',
      difficulty: d,
      prompt: 'What fraction of the bar is shaded?',
      visual: { kind: 'fraction', num: 1, den },
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  if (d === 2) {
    const den = ri(3, 8)
    const num = ri(2, den - 1)
    const ans = `${num}/${den}`
    const pool = [`${den - num}/${den}`, `${num}/${den + 1}`, `${den}/${num}`, `${num + 1}/${den}`].filter(
      (f) => f !== ans,
    )
    return {
      skillId: 'fracUnit',
      difficulty: d,
      prompt: 'What fraction of the bar is shaded?',
      visual: { kind: 'fraction', num, den },
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  const { item, color } = pick(FRAC_ITEMS)
  const total = ri(4, 10)
  const part = ri(1, total - 1)
  const ans = `${part}/${total}`
  const pool = [`${total - part}/${total}`, `${part}/${part + total}`, `${total}/${part}`, `${part}/${total + 1}`].filter(
    (f) => f !== ans,
  )
  return {
    skillId: 'fracUnit',
    difficulty: d,
    prompt: `There are ${total} ${item}. ${part} of them are ${color}. What fraction of the ${item} are ${color}?`,
    ...finishChoices(ans, fromPool(pool)),
  }
}

const fracComp: Gen = (d) => {
  if (d === 3 && Math.random() < 0.5) {
    // Equivalence with 1/2
    const ans = pick(['2/4', '3/6', '4/8', '5/10'])
    const pool = ['1/3', '2/3', '3/4', '2/5', '1/4', '3/8'].filter((f) => f !== ans)
    return {
      skillId: 'fracComp',
      difficulty: d,
      prompt: 'Which fraction is EQUAL to 1/2?',
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  let a: [number, number]
  let b: [number, number]
  if (d === 1) {
    // Same denominator
    const den = ri(3, 9)
    const n1 = ri(1, den - 1)
    let n2 = ri(1, den - 1)
    while (n2 === n1) n2 = ri(1, den - 1)
    a = [n1, den]
    b = [n2, den]
  } else if (d === 2) {
    // Unit fractions — smaller denominator wins
    const d1 = ri(2, 10)
    let d2 = ri(2, 10)
    while (d2 === d1) d2 = ri(2, 10)
    a = [1, d1]
    b = [1, d2]
  } else {
    // Same numerator, different denominators
    const num = ri(2, 4)
    const d1 = ri(num + 1, 10)
    let d2 = ri(num + 1, 10)
    while (d2 === d1) d2 = ri(num + 1, 10)
    a = [num, d1]
    b = [num, d2]
  }
  const bigger = a[0] / a[1] > b[0] / b[1] ? a : b
  const fmt = (f: [number, number]) => `${f[0]}/${f[1]}`
  const choices = shuffle([fmt(a), fmt(b)])
  return {
    skillId: 'fracComp',
    difficulty: d,
    prompt: 'Which fraction is BIGGER?',
    visual: { kind: 'fractionPair', a, b },
    choices,
    answerIndex: choices.indexOf(fmt(bigger)),
  }
}

const time: Gen = (d) => {
  if (d === 3) {
    const h = ri(1, 11)
    const m = pick([0, 10, 15, 20, 30, 40, 45, 50])
    const dur = pick([15, 20, 25, 30, 45, 60])
    const total = m + dur
    const eh = h + Math.floor(total / 60)
    const em = total % 60
    const activity = pick(['Soccer practice', 'Art class', 'The movie', 'Swim lesson', 'The game'])
    const ans = fmtTime(eh > 12 ? eh - 12 : eh, em)
    const pool = [
      fmtTime(eh > 12 ? eh - 12 : eh, (em + 5) % 60),
      fmtTime(eh > 12 ? eh - 12 : eh, (em + 55) % 60),
      fmtTime((eh % 12) + 1, em),
      fmtTime(h, m),
    ].filter((t) => t !== ans)
    return {
      skillId: 'time',
      difficulty: d,
      prompt: `${activity} starts at ${fmtTime(h, m)} and lasts ${dur} minutes. What time does it end?`,
      ...finishChoices(ans, fromPool(pool)),
    }
  }
  const h = ri(1, 12)
  const m = d === 1 ? ri(0, 11) * 5 : ri(0, 59)
  const ans = fmtTime(h, m)
  const nextH = (h % 12) + 1
  const prevH = h === 1 ? 12 : h - 1
  const pool = [
    fmtTime(nextH, m),
    fmtTime(prevH, m),
    fmtTime(h, (m + (d === 1 ? 5 : 1)) % 60),
    fmtTime(h, (m + (d === 1 ? 55 : 59)) % 60),
    m <= 12 && m !== h ? fmtTime(m === 0 ? 12 : m, h * 5 === 60 ? 0 : (h * 5) % 60) : '',
  ].filter((t) => t !== ans && t !== '')
  return {
    skillId: 'time',
    difficulty: d,
    prompt: 'What time does the clock show?',
    visual: { kind: 'clock', h, m },
    ...finishChoices(ans, fromPool(pool)),
  }
}

const money: Gen = (d) => {
  if (d === 3) {
    const price = ri(105, 465)
    const priceAdj = price % 5 === 0 ? price : price - (price % 5)
    const change = 500 - priceAdj
    return {
      skillId: 'money',
      difficulty: d,
      prompt: `A toy costs ${fmtMoney(priceAdj)}. You pay with a $5 bill. How much change do you get back?`,
      ...finishChoices(fmtMoney(change), () => {
        const v = Math.max(5, change + pick([-25, -10, -5, 5, 10, 25, 100]))
        return v === change ? fmtMoney(change + 5) : fmtMoney(v)
      }),
    }
  }
  const dollars = d === 2 ? ri(1, 5) : 0
  const quarters = ri(0, 3)
  const dimes = ri(0, 4)
  const nickels = ri(0, 3)
  const pennies = ri(0, 4)
  const cents = dollars * 100 + quarters * 25 + dimes * 10 + nickels * 5 + pennies
  if (cents === 0) return money(d) // retry the rare all-zero draw
  const parts: string[] = []
  if (dollars) parts.push(`${dollars} dollar bill${dollars > 1 ? 's' : ''}`)
  if (quarters) parts.push(`${quarters} quarter${quarters > 1 ? 's' : ''}`)
  if (dimes) parts.push(`${dimes} dime${dimes > 1 ? 's' : ''}`)
  if (nickels) parts.push(`${nickels} nickel${nickels > 1 ? 's' : ''}`)
  if (pennies) parts.push(`${pennies} penn${pennies > 1 ? 'ies' : 'y'}`)
  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return {
    skillId: 'money',
    difficulty: d,
    prompt: `You have ${list}. How much money is that?`,
    ...finishChoices(fmtMoney(cents), () => {
      const v = Math.max(1, cents + pick([-10, -5, -1, 1, 5, 10, 25]))
      return v === cents ? fmtMoney(cents + 1) : fmtMoney(v)
    }),
  }
}

const UNIT_QS = [
  { thing: 'the length of a pencil', ans: 'centimeters', wrong: ['meters', 'kilometers', 'liters'] },
  { thing: 'the length of a soccer field', ans: 'meters', wrong: ['centimeters', 'kilometers', 'grams'] },
  { thing: 'the distance between two cities', ans: 'kilometers', wrong: ['centimeters', 'meters', 'liters'] },
  { thing: 'the weight of an apple', ans: 'grams', wrong: ['kilograms', 'liters', 'meters'] },
  { thing: 'the weight of a big dog', ans: 'kilograms', wrong: ['grams', 'milliliters', 'centimeters'] },
  { thing: 'the water in a bathtub', ans: 'liters', wrong: ['milliliters', 'grams', 'meters'] },
  { thing: 'the medicine in a spoon', ans: 'milliliters', wrong: ['liters', 'kilograms', 'kilometers'] },
] as const

const ESTIMATE_QS = [
  { q: 'About how much does a banana weigh?', ans: '120 grams', wrong: ['120 kilograms', '2 grams', '12 liters'] },
  { q: 'About how much water fits in a big soda bottle?', ans: '2 liters', wrong: ['2 milliliters', '200 liters', '2 grams'] },
  { q: 'About how long is a new crayon?', ans: '9 centimeters', wrong: ['9 meters', '9 kilometers', '90 centimeters'] },
  { q: 'About how much does a pet cat weigh?', ans: '4 kilograms', wrong: ['4 grams', '400 kilograms', '4 liters'] },
  { q: 'About how tall is a door?', ans: '2 meters', wrong: ['2 centimeters', '20 meters', '2 kilometers'] },
  { q: 'About how much juice is in a juice box?', ans: '200 milliliters', wrong: ['200 liters', '2 milliliters', '20 liters'] },
] as const

const measure: Gen = (d) => {
  if (d === 1) {
    const u = pick(UNIT_QS)
    return {
      skillId: 'measure',
      difficulty: d,
      prompt: `Which unit is BEST for measuring ${u.thing}?`,
      ...finishChoices(u.ans, fromPool([...u.wrong])),
    }
  }
  if (d === 2) {
    const e = pick(ESTIMATE_QS)
    return {
      skillId: 'measure',
      difficulty: d,
      prompt: e.q,
      ...finishChoices(e.ans, fromPool([...e.wrong])),
    }
  }
  // d === 3: measurement word math
  const unit = pick(['centimeters', 'grams', 'milliliters'] as const)
  const noun = unit === 'centimeters' ? 'ribbon' : unit === 'grams' ? 'bag of beads' : 'cup of juice'
  const a = ri(24, 78)
  const b = ri(15, 69)
  if (Math.random() < 0.5) {
    const ans = a + b
    return {
      skillId: 'measure',
      difficulty: d,
      prompt: `One ${noun} measures ${a} ${unit} and another measures ${b} ${unit}. How many ${unit} is that in all?`,
      ...finishChoices(String(ans), numNear(ans, 12, 1)),
    }
  }
  const big = Math.max(a, b)
  const small = Math.min(a, b) === big ? big - ri(5, 20) : Math.min(a, b)
  const ans = big - small
  return {
    skillId: 'measure',
    difficulty: d,
    prompt: `One ${noun} measures ${big} ${unit} and another measures ${small} ${unit}. How many more ${unit} is the bigger one?`,
    ...finishChoices(String(ans), numNear(ans, 12, 1)),
  }
}

const areaPerim: Gen = (d) => {
  if (d === 1) {
    const w = ri(2, 6)
    const h = ri(2, 5)
    const area = w * h
    const pool = [2 * (w + h), w + h, area + w, area - h, area + 1].filter((v) => v !== area && v > 0)
    return {
      skillId: 'areaPerim',
      difficulty: d,
      prompt: 'Each little square is 1 square unit. What is the AREA of this rectangle?',
      visual: { kind: 'rect', w, h, labels: false },
      ...finishChoices(`${area} square units`, () => `${pick(pool)} square units`),
    }
  }
  if (d === 2) {
    const w = ri(3, 12)
    const h = ri(2, 9)
    const per = 2 * (w + h)
    const pool = [w * h, w + h, 2 * w + h, per + 2, per - 2].filter((v) => v !== per && v > 0)
    return {
      skillId: 'areaPerim',
      difficulty: d,
      prompt: `A rectangle is ${w} units long and ${h} units wide. What is its PERIMETER?`,
      visual: { kind: 'rect', w, h, labels: true },
      ...finishChoices(`${per} units`, () => `${pick(pool)} units`),
    }
  }
  const w = ri(2, 9)
  const h = ri(2, 9)
  return {
    skillId: 'areaPerim',
    difficulty: d,
    prompt: `A rectangle has an AREA of ${w * h} square units. One side is ${w} units long. How long is the other side?`,
    ...finishChoices(`${h} units`, numNear(h, 3, 1, ' units')),
  }
}

const NAMES = ['Ava', 'Leo', 'Mia', 'Max', 'Zoe', 'Sam', 'Ella', 'Kai', 'Ruby', 'Finn'] as const

const word2: Gen = (d) => {
  const name = pick(NAMES)
  const kind = ri(1, 4)
  let prompt: string
  let ans: number
  if (kind === 1) {
    const start = ri(3, 8 * d)
    const packs = ri(2, 2 + d)
    const per = ri(3, 2 + 2 * d)
    ans = start + packs * per
    prompt = `${name} had ${start} stickers. Then ${name} bought ${packs} packs with ${per} stickers in each pack. How many stickers does ${name} have now?`
  } else if (kind === 2) {
    const start = ri(12 * d, 25 * d)
    const gave = ri(3, start - 6)
    const got = ri(3, 9 * d)
    ans = start - gave + got
    prompt = `${name} had ${start} shells. ${name} gave ${gave} to a friend, then found ${got} more at the beach. How many shells does ${name} have now?`
  } else if (kind === 3) {
    const boxes = ri(2, 2 + d)
    const per = ri(4, 3 + 3 * d)
    const broke = ri(1, per - 1)
    ans = boxes * per - broke
    prompt = `There are ${boxes} boxes with ${per} crayons in each box. ${broke} crayons broke. How many crayons are NOT broken?`
  } else {
    const perWeek = ri(2, 2 + 2 * d)
    const weeks = ri(2, 2 + d)
    const total = perWeek * weeks
    const cost = ri(1, total - 1)
    ans = total - cost
    prompt = `${name} saves $${perWeek} every week for ${weeks} weeks, then buys a book for $${cost}. How much money does ${name} have left?`
  }
  return {
    skillId: 'word2',
    difficulty: d,
    prompt,
    ...finishChoices(String(ans), numNear(ans, Math.max(3, Math.round(ans / 5)), 0)),
  }
}

const GENERATORS: Record<SkillId, Gen> = {
  mult,
  div,
  place,
  addsub,
  fracUnit,
  fracComp,
  time,
  money,
  measure,
  areaPerim,
  word2,
}

export function generateQuestion(skillId: SkillId, difficulty: Difficulty): Question {
  return GENERATORS[skillId](difficulty)
}

/** Generate a question whose prompt hasn't been seen this session (best effort). */
export function generateFresh(
  skillId: SkillId,
  difficulty: Difficulty,
  seen: Set<string>,
): Question {
  let q = generateQuestion(skillId, difficulty)
  for (let i = 0; i < 8 && seen.has(q.prompt + JSON.stringify(q.visual ?? '')); i++) {
    q = generateQuestion(skillId, difficulty)
  }
  seen.add(q.prompt + JSON.stringify(q.visual ?? ''))
  return q
}
