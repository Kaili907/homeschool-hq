import type { Question } from './types'
import {
  bigNear,
  finishChoices,
  fmtDec,
  fmtFrac,
  fromPool,
  numNear,
  pick,
  ri,
  shuffle,
  type Gen,
} from './genUtils'

const fractionChoices = (num: number, den: number, extras: string[] = []) => {
  const correct = fmtFrac(num, den)
  const pool = [
    ...extras,
    fmtFrac(num + 1, den),
    fmtFrac(Math.max(1, num - 1), den),
    fmtFrac(num, den + 1),
    fmtFrac(num + den, den),
    fmtFrac(num + 2, den),
  ].filter((choice) => choice !== correct)
  return finishChoices(correct, fromPool([...new Set(pool)]))
}

const unlikeDenominators = (): [number, number] => {
  let a = ri(2, 10)
  let b = ri(2, 10)
  while (a === b || b % a === 0 || a % b === 0) {
    a = ri(2, 10)
    b = ri(2, 10)
  }
  return [a, b]
}

const mult5: Gen = (d) => {
  const a = d === 1 ? ri(12, 99) : d === 2 ? ri(101, 999) : ri(1001, 9999)
  const b = d === 1 ? ri(12, 49) : d === 2 ? ri(12, 99) : ri(101, 499)
  const answer = a * b
  return {
    skillId: 'mult5',
    difficulty: d,
    prompt: `${a.toLocaleString()} × ${b.toLocaleString()} = ?`,
    ...finishChoices(answer.toLocaleString(), bigNear(answer)),
  }
}

const div5: Gen = (d) => {
  const divisor = d === 1 ? ri(10, 19) : d === 2 ? ri(12, 49) : ri(20, 99)
  const quotient = d === 1 ? ri(10, 49) : d === 2 ? ri(20, 99) : ri(100, 499)
  const remainder = d === 3 ? ri(1, divisor - 1) : 0
  const dividend = divisor * quotient + remainder
  const answer = remainder ? `${quotient} R ${remainder}` : String(quotient)
  const pool = remainder
    ? [
        `${quotient} R ${remainder + 1}`,
        `${quotient + 1} R ${remainder}`,
        `${quotient - 1} R ${remainder}`,
        `${quotient} R ${Math.max(0, remainder - 1)}`,
      ]
    : [quotient + 1, quotient - 1, quotient + divisor, Math.max(1, quotient - divisor)].map(String)
  return {
    skillId: 'div5',
    difficulty: d,
    prompt: `${dividend.toLocaleString()} ÷ ${divisor} = ?${remainder ? '\n(R means remainder)' : ''}`,
    ...finishChoices(answer, fromPool(pool.filter((choice) => choice !== answer))),
  }
}

const fracAdd5: Gen = (d) => {
  const [aDen, bDen] = unlikeDenominators()
  const aNum = ri(1, d === 1 ? aDen - 1 : aDen + d)
  const bNum = ri(1, d === 1 ? bDen - 1 : bDen + d)
  const num = aNum * bDen + bNum * aDen
  const den = aDen * bDen
  return {
    skillId: 'fracAdd5',
    difficulty: d,
    prompt: `${aNum}/${aDen} + ${bNum}/${bDen} = ?`,
    ...fractionChoices(num, den, [
      fmtFrac(aNum + bNum, aDen + bDen),
      fmtFrac(aNum + bNum, den),
      fmtFrac(aNum * bDen + bNum, den),
    ]),
  }
}

const fracSub5: Gen = (d) => {
  const [aDen, bDen] = unlikeDenominators()
  let aNum = ri(1, aDen + d + 1)
  let bNum = ri(1, bDen + d)
  if (aNum * bDen <= bNum * aDen) {
    ;[aNum, bNum] = [bNum, aNum]
    return {
      skillId: 'fracSub5',
      difficulty: d,
      prompt: `${aNum}/${bDen} − ${bNum}/${aDen} = ?`,
      ...fractionChoices(aNum * aDen - bNum * bDen, aDen * bDen, [
        fmtFrac(Math.abs(aNum - bNum), aDen + bDen),
        fmtFrac(aNum + bNum, aDen * bDen),
      ]),
    }
  }
  const num = aNum * bDen - bNum * aDen
  const den = aDen * bDen
  return {
    skillId: 'fracSub5',
    difficulty: d,
    prompt: `${aNum}/${aDen} − ${bNum}/${bDen} = ?`,
    ...fractionChoices(num, den, [
      fmtFrac(Math.abs(aNum - bNum), aDen + bDen),
      fmtFrac(aNum + bNum, den),
    ]),
  }
}

const fracMult5: Gen = (d) => {
  if (d === 1) {
    const den = ri(3, 10)
    const num = ri(1, den - 1)
    const whole = ri(2, 9)
    return {
      skillId: 'fracMult5',
      difficulty: d,
      prompt: `${num}/${den} × ${whole} = ?`,
      ...fractionChoices(num * whole, den, [
        fmtFrac(num + whole, den),
        fmtFrac(num * whole, den * whole),
      ]),
    }
  }
  const aDen = ri(3, d === 2 ? 9 : 12)
  const bDen = ri(3, d === 2 ? 9 : 12)
  const aNum = ri(1, aDen - 1)
  const bNum = ri(1, bDen - 1)
  return {
    skillId: 'fracMult5',
    difficulty: d,
    prompt: `${aNum}/${aDen} × ${bNum}/${bDen} = ?`,
    ...fractionChoices(aNum * bNum, aDen * bDen, [
      fmtFrac(aNum + bNum, aDen + bDen),
      fmtFrac(aNum * bDen, aDen * bNum),
    ]),
  }
}

const fracDiv5: Gen = (d) => {
  const den = ri(2, d === 1 ? 8 : 12)
  const whole = ri(2, d === 3 ? 12 : 8)
  if (d === 1) {
    return {
      skillId: 'fracDiv5',
      difficulty: d,
      prompt: `1/${den} ÷ ${whole} = ?`,
      ...fractionChoices(1, den * whole, [
        fmtFrac(whole, den),
        fmtFrac(1, den + whole),
        fmtFrac(whole, den * whole),
      ]),
    }
  }
  const answer = whole * den
  return {
    skillId: 'fracDiv5',
    difficulty: d,
    prompt:
      d === 2
        ? `${whole} ÷ 1/${den} = ?`
        : `How many 1/${den}-cup servings are in ${whole} cups?`,
    ...finishChoices(
      String(answer),
      fromPool(
        [whole + den, answer + den, answer - den, answer + 1, den].map(String).filter((x) => x !== String(answer)),
      ),
    ),
  }
}

const decOps5: Gen = (d) => {
  if (d === 1) {
    const a = ri(101, 9999)
    const b = ri(101, 9999)
    const subtract = pick([true, false] as const)
    const high = Math.max(a, b)
    const low = Math.min(a, b)
    const answer = subtract ? high - low : a + b
    return {
      skillId: 'decOps5',
      difficulty: d,
      prompt: `${fmtDec(subtract ? high : a, 3)} ${subtract ? '−' : '+'} ${fmtDec(subtract ? low : b, 3)} = ?`,
      ...finishChoices(fmtDec(answer, 3), () => {
        const candidate = answer + pick([-100, -10, -1, 1, 10, 100] as const)
        return fmtDec(candidate > 0 ? candidate : answer + 11, 3)
      }),
    }
  }
  if (d === 2) {
    const a = ri(11, 999)
    const b = ri(2, 9)
    const answer = a * b
    return {
      skillId: 'decOps5',
      difficulty: d,
      prompt: `${fmtDec(a, 2)} × ${fmtDec(b, 1)} = ?`,
      ...finishChoices(fmtDec(answer, 3), () => {
        const candidate = answer + pick([-100, -10, -1, 1, 10, 100] as const)
        return fmtDec(candidate > 0 ? candidate : answer + 11, 3)
      }),
    }
  }
  const divisor = ri(2, 9)
  const answer = ri(11, 9999)
  const dividend = answer * divisor
  return {
    skillId: 'decOps5',
    difficulty: d,
    prompt: `${fmtDec(dividend, 3)} ÷ ${divisor} = ?`,
    ...finishChoices(fmtDec(answer, 3), () => {
      const candidate = answer + pick([-100, -10, -1, 1, 10, 100] as const)
      return fmtDec(candidate > 0 ? candidate : answer + 11, 3)
    }),
  }
}

const placePow5: Gen = (d) => {
  if (d === 1) {
    const n = ri(2, 999)
    const power = ri(1, 3)
    const multiply = pick([true, false] as const)
    const answer = multiply ? n * 10 ** power : n
    const start = multiply ? n : n * 10 ** power
    return {
      skillId: 'placePow5',
      difficulty: d,
      prompt: `${start.toLocaleString()} ${multiply ? '×' : '÷'} 10^${power} = ?`,
      ...finishChoices(answer.toLocaleString(), bigNear(answer)),
    }
  }
  if (d === 2) {
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4)
    const place = ri(1, 3)
    const number = `${digits[0]}.${digits[1]}${digits[2]}${digits[3]}`
    const digit = digits[place]
    const answer = fmtDec(digit, place)
    const pool = [0, 1, 2, 3]
      .filter((p) => p !== place)
      .map((p) => (p === 0 ? String(digit) : fmtDec(digit, p)))
    return {
      skillId: 'placePow5',
      difficulty: d,
      prompt: `In ${number}, what is the VALUE of the digit ${digit}?`,
      ...finishChoices(answer, fromPool(pool)),
    }
  }
  const scaled = ri(101, 9999)
  const power = ri(1, 3)
  const answer = scaled * 10 ** power
  return {
    skillId: 'placePow5',
    difficulty: d,
    prompt: `${fmtDec(scaled, 3)} × 10^${power} = ?`,
    ...finishChoices(fmtDec(answer, 3), () => {
      const wrongPower = pick([Math.max(0, power - 1), power + 1, power + 2] as const)
      return fmtDec(scaled * 10 ** wrongPower, 3)
    }),
  }
}

const volume5: Gen = (d) => {
  const length = ri(2, d === 3 ? 12 : 8)
  const width = ri(2, d === 3 ? 10 : 7)
  const height = ri(2, d === 3 ? 9 : 6)
  if (d === 2) {
    const volume = length * width * height
    return {
      skillId: 'volume5',
      difficulty: d,
      prompt: `A prism has a volume of ${volume} cubic units. Its length is ${length} and width is ${width}. What is its height?`,
      ...finishChoices(`${height} units`, numNear(height, 4, 1, ' units')),
    }
  }
  if (d === 3) {
    const otherHeight = ri(2, 7)
    const answer = length * width * height + length * width * otherHeight
    return {
      skillId: 'volume5',
      difficulty: d,
      prompt: `Two prisms share a ${length} by ${width} base. Their heights are ${height} and ${otherHeight}. What is their TOTAL volume?`,
      ...finishChoices(`${answer} cubic units`, () => {
        const candidate = answer + pick([-length * width, length * width, -height, height] as const)
        return `${candidate > 0 ? candidate : answer + width} cubic units`
      }),
    }
  }
  const answer = length * width * height
  return {
    skillId: 'volume5',
    difficulty: d,
    prompt: `A box is ${length} units long, ${width} units wide, and ${height} units tall. What is its VOLUME?`,
    ...finishChoices(`${answer} cubic units`, () => {
      const candidate = answer + pick([-length, length, -width * height, width * height] as const)
      return `${candidate > 0 ? candidate : answer + 3} cubic units`
    }),
  }
}

const coord5: Gen = (d) => {
  const x = ri(1, d === 3 ? 12 : 9)
  const y = ri(1, d === 3 ? 12 : 9)
  if (d === 1) {
    const answer = `(${x}, ${y})`
    const pool = [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${x}, ${y + 1})`, `(${Math.max(0, x - 1)}, ${y})`]
      .filter((choice) => choice !== answer)
    return {
      skillId: 'coord5',
      difficulty: d,
      prompt: 'What are the coordinates of the point?',
      visual: { kind: 'coordGrid', x, y },
      ...finishChoices(answer, fromPool(pool)),
    }
  }
  if (d === 2) {
    const right = ri(1, 5)
    const up = ri(1, 5)
    const answer = `(${x + right}, ${y + up})`
    const pool = [
      `(${x + up}, ${y + right})`,
      `(${x + right}, ${y})`,
      `(${x}, ${y + up})`,
      `(${x - right}, ${y - up})`,
    ].filter((choice) => choice !== answer)
    return {
      skillId: 'coord5',
      difficulty: d,
      prompt: `Start at (${x}, ${y}). Move ${right} right and ${up} up. Where do you land?`,
      ...finishChoices(answer, fromPool(pool)),
    }
  }
  const horizontal = pick([true, false] as const)
  const distance = ri(2, 9)
  const otherX = horizontal ? x + distance : x
  const otherY = horizontal ? y : y + distance
  return {
    skillId: 'coord5',
    difficulty: d,
    prompt: `How far apart are (${x}, ${y}) and (${otherX}, ${otherY}) on the coordinate plane?`,
    ...finishChoices(`${distance} units`, numNear(distance, 4, 1, ' units')),
  }
}

const orderOps5: Gen = (d) => {
  if (d === 1) {
    const a = ri(2, 9)
    const b = ri(2, 9)
    const c = ri(2, 9)
    const answer = a + b * c
    return {
      skillId: 'orderOps5',
      difficulty: d,
      prompt: `${a} + ${b} × ${c} = ?`,
      ...finishChoices(
        String(answer),
        fromPool([String((a + b) * c), String(a * b + c), String(answer + b), String(answer - a)]),
      ),
    }
  }
  if (d === 2) {
    const a = ri(2, 8)
    const b = ri(2, 8)
    const c = ri(2, 7)
    const answer = (a + b) * c
    return {
      skillId: 'orderOps5',
      difficulty: d,
      prompt: `(${a} + ${b}) × ${c} = ?`,
      ...finishChoices(
        String(answer),
        fromPool([String(a + b * c), String(a * c + b), String(answer + c), String(answer - c)]),
      ),
    }
  }
  const a = ri(2, 6)
  const b = ri(2, 7)
  const c = ri(2, 8)
  const divisor = ri(2, 5)
  const quotient = ri(2, 8)
  const dividend = divisor * quotient
  const answer = a * (b + c) - quotient
  return {
    skillId: 'orderOps5',
    difficulty: d,
    prompt: `${a} × [${b} + ${c}] − ${dividend} ÷ ${divisor} = ?`,
    ...finishChoices(
      String(answer),
      fromPool([
        String(a * b + c - quotient),
        String(a * (b + c - quotient)),
        String(answer + divisor),
        String(answer - a),
      ]),
    ),
  }
}

export const GENERATORS5 = {
  mult5,
  div5,
  fracAdd5,
  fracSub5,
  fracMult5,
  fracDiv5,
  decOps5,
  placePow5,
  volume5,
  coord5,
  orderOps5,
} satisfies Partial<Record<Question['skillId'], Gen>>
