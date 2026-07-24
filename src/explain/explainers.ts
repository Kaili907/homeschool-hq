import type { Question, Visual } from '../types'
import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, ints, promptInts, steps, type Explainer } from './types'
import { columnAdd, columnSub, numberLine, fractionBar, array, reuse } from './vizHelpers'

const fracFromVisual = (v: Visual | undefined): [number, number] | null =>
  v && v.kind === 'fraction' ? [v.num, v.den] : null

// ---------- grade 3 ----------

const mult: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('❓')) {
    const [a, product] = promptInts(q)
    const missing = a !== 0 && product % a === 0 ? product / a : null
    return steps(
      { say: `We need a number that times ${a} makes ${product}.`, show: `${a} ×` },
      {
        say: `Turn it around: ${product} ÷ ${a} tells us the missing number.`,
        viz: missing !== null ? array(a, missing) : undefined,
      },
      { say: `${product} ÷ ${a} = ${ans}, so the missing number is ${ans}. A missing factor is found by dividing.` },
    )
  }
  const [a, b] = promptInts(q)
  return steps(
    { say: `${a} × ${b} means ${a} groups of ${b}.`, show: `${a} × ${b}` },
    { say: `Count by ${b}s, ${a} times — or add ${b} to itself ${a} times.`, viz: a > 0 && b > 0 ? array(a, b) : undefined },
    { say: `${a} × ${b} = ${ans}. Multiplying is just fast repeated adding.` },
  )
}

const div: Explainer = (q) => {
  const ans = answerOf(q)
  const [x, y] = promptInts(q)
  const even = y !== 0 && x % y === 0
  if (q.prompt.includes('❓')) {
    // x ÷ ❓ = y
    return steps(
      { say: `We split ${x} into equal groups and each group has ${y}.` },
      { say: `To find how many groups, divide: ${x} ÷ ${y}.`, viz: even ? array(x / y, y) : undefined },
      { say: `${x} ÷ ${y} = ${ans}, so the missing number is ${ans}. Dividing by the group size tells how many groups.` },
    )
  }
  return steps(
    { say: `${x} ÷ ${y} means sharing ${x} into ${y} equal groups.`, show: `${x} ÷ ${y}` },
    { say: `How many go in each group? Think: ${y} times what makes ${x}?`, viz: even ? array(y, x / y) : undefined },
    { say: `Each group gets ${ans}. So ${x} ÷ ${y} = ${ans}. Dividing shares a total into equal groups.` },
  )
}

const place: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('VALUE of the digit')) {
    const nums = promptInts(q) // [n, digit]
    const digit = nums[nums.length - 1]
    const value = ints(ans)[0]
    const place = digit ? value / digit : value
    return steps(
      { say: `A digit's value depends on which column it sits in.` },
      { say: `Here the ${digit} sits in a column worth ${place}.` },
      { say: `So its value is ${digit} × ${place} = ${ans}, not just ${digit}. A digit is worth its face value times its place.` },
    )
  }
  if (q.prompt.startsWith('Round')) {
    const [n, to] = promptInts(q)
    const down = Math.floor(n / to) * to
    const up = down + to
    return steps(
      { say: `We're rounding ${n} to the nearest ${to}.` },
      {
        say: `Look at the digit just below the ${to} place to decide up or down.`,
        viz: numberLine(down, up, { point: n, marks: [down, up] }),
      },
      { say: `${n} rounds to ${ans}. Round up on 5 or more, down on 4 or less.` },
    )
  }
  // expanded form: th + h + t + o = ?
  const parts = promptInts(q)
  return steps(
    { say: `This is expanded form: ${parts.join(' + ')}.`, show: cleanPrompt(q) },
    { say: `Line the numbers up by place value and add them together.` },
    { say: `The total is ${ans}. Expanded form just adds up each place's value.` },
  )
}

const addsub: Explainer = (q) => {
  const ans = answerOf(q)
  const [a, b] = promptInts(q)
  if (q.prompt.includes('+')) {
    return steps(
      { say: `Add ${a} and ${b}. Start in the ones place on the right.`, show: cleanPrompt(q) },
      { say: `If a column adds to 10 or more, carry the extra to the next place.`, viz: columnAdd(a, b) },
      { say: `${a} + ${b} = ${ans}. When a column reaches ten, carry the extra next door.` },
    )
  }
  return steps(
    { say: `Subtract ${b} from ${a}. Start in the ones place on the right.`, show: cleanPrompt(q) },
    { say: `If the top digit is too small, borrow from the next place over.`, viz: columnSub(a, b) },
    { say: `${a} − ${b} = ${ans}. When the ones can't pay, the tens lend.` },
  )
}

const fracUnit: Explainer = (q) => {
  const ans = answerOf(q)
  const bar = fracFromVisual(q.visual)
  if (bar) {
    const [num, den] = bar
    return steps(
      {
        say: `The whole bar is split into ${den} equal parts — that's the bottom number.`,
        viz: q.visual ? reuse(q.visual) : undefined,
      },
      { say: `${num} ${num === 1 ? 'part is' : 'parts are'} shaded — that's the top number.` },
      { say: `So the shaded fraction is ${ans}. Top counts the shaded parts, bottom counts all the parts.` },
    )
  }
  const [total, part] = promptInts(q)
  return steps(
    { say: `There are ${total} in all, so ${total} is the bottom number.` },
    { say: `${part} match what we're counting, so ${part} is the top number.`, viz: fractionBar(part, total) },
    { say: `That makes the fraction ${ans}. The part goes on top, the total on the bottom.` },
  )
}

const fracComp: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('EQUAL to 1/2')) {
    return steps(
      { say: `1/2 means one of two equal parts — exactly half.` },
      { say: `A fraction equals 1/2 when the top is exactly half of the bottom.` },
      { say: `${ans} is half, so ${ans} equals 1/2. A fraction is half when the top doubles to the bottom.` },
    )
  }
  const v = q.visual
  if (v && v.kind === 'fractionPair') {
    const af = `${v.a[0]}/${v.a[1]}`
    const bf = `${v.b[0]}/${v.b[1]}`
    return steps(
      { say: `Compare ${af} and ${bf} — look at the shaded bars.`, viz: reuse(v) },
      { say: `More shaded bar means the bigger fraction.` },
      { say: `${ans} is bigger. With equal-size wholes, more shaded means the bigger fraction.` },
    )
  }
  return steps(
    { say: `Compare the two fractions.` },
    { say: `Think about how big each piece is and how many pieces are shaded.` },
    { say: `The bigger one is ${ans}. Compare the size and the number of the pieces.` },
  )
}

const time: Explainer = (q) => {
  const ans = answerOf(q)
  const v = q.visual
  if (v && v.kind === 'clock') {
    return steps(
      { say: `The short hand points to the hour, the long hand to the minutes.`, viz: reuse(v) },
      { say: `Read the hour first, then count the minutes by 5s around the clock.` },
      { say: `The clock shows ${ans}. Short hand for hours, long hand for minutes.` },
    )
  }
  const start = q.prompt.match(/at (\d+:\d{2})/)?.[1] ?? ''
  const dur = q.prompt.match(/lasts (\d+)/)?.[1] ?? ''
  return steps(
    { say: `It starts at ${start} and lasts ${dur} minutes.` },
    { say: `Add ${dur} minutes to the start time, carrying to the next hour if you pass 60.` },
    { say: `It ends at ${ans}. Add the minutes and roll over to a new hour at 60.` },
  )
}

const money: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('change')) {
    return steps(
      { say: `You paid with $5.00, so we find how much is left over.` },
      { say: `Subtract the price from $5.00.` },
      { say: `Your change is ${ans}. Change is what's left after taking the price from what you paid.` },
    )
  }
  return steps(
    { say: `Add up the value of every coin and bill.` },
    { say: `Count the dollars first, then quarters, dimes, nickels, and pennies.` },
    { say: `Altogether that's ${ans}. Total money by adding each piece's value, biggest first.` },
  )
}

const measure: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.startsWith('Which unit is BEST')) {
    const thing = q.prompt.replace(/^Which unit is BEST for measuring /, '').replace(/\?$/, '')
    return steps(
      { say: `Picture how big ${thing} really is.` },
      { say: `Pick the unit that matches that size.` },
      { say: `${ans} fits best. Match the unit to the real size of the thing.` },
    )
  }
  if (q.prompt.includes(' in all')) {
    const [a, b] = promptInts(q)
    return steps(
      { say: `You have ${a} and ${b} of the same unit.` },
      { say: `"In all" means add them together: ${a} + ${b}.` },
      { say: `That's ${ans}. "In all" means put the amounts together by adding.` },
    )
  }
  if (q.prompt.includes('more')) {
    const [a, b] = promptInts(q)
    const big = Math.max(a, b)
    const small = Math.min(a, b)
    return steps(
      { say: `Compare ${big} and ${small}.` },
      { say: `"How many more" means subtract: ${big} − ${small}.` },
      { say: `That's ${ans}. "How many more" means find the difference by subtracting.` },
    )
  }
  // estimation
  return steps(
    { say: `Picture the real object in your head.` },
    { say: `Which amount is about right for its size or weight?` },
    { say: `It's about ${ans}. Estimating means choosing the sensible size, not an exact count.` },
  )
}

const areaPerim: Explainer = (q) => {
  const ans = answerOf(q)
  const v = q.visual
  if (q.prompt.includes('AREA of this rectangle') && v && v.kind === 'rect') {
    return steps(
      { say: `Area is how many unit squares fit inside.` },
      { say: `Multiply length by width: ${v.w} × ${v.h}.`, viz: reuse(v) },
      { say: `That's ${ans}. Area is length times width — the squares inside.` },
    )
  }
  if (q.prompt.includes('PERIMETER')) {
    const [w, h] = promptInts(q)
    return steps(
      { say: `Perimeter is the distance all the way around.` },
      { say: `Add all four sides: ${w} + ${h} + ${w} + ${h}.` },
      { say: `That's ${ans}. Perimeter is the total distance around the outside.` },
    )
  }
  // missing side from area
  const [area, side] = promptInts(q)
  return steps(
    { say: `Area = one side × the other side, and here the area is ${area}.` },
    { say: `So the missing side = ${area} ÷ ${side}.` },
    { say: `That's ${ans}. If area is side times side, divide by the known side to get the other.` },
  )
}

const word2: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  return steps(
    { say: `This is a two-step story. Read it once and spot the numbers: ${nums.join(', ')}.` },
    { say: `Do the first step, then use that result for the second step.` },
    { say: `Work it through and you get ${ans}. In a two-step problem, the first answer feeds the second.` },
  )
}

export const EXPLAINERS3: Partial<Record<SkillId, Explainer>> = {
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

export type { Question }
