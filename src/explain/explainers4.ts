import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, ints, promptInts, steps, type Explainer } from './types'
import { array, columnMul, fractionBar, numberLine, reuse } from './vizHelpers'

// ---------- grade 4 ----------

const mult4: Explainer = (q) => {
  const ans = answerOf(q)
  const [a, b] = promptInts(q)
  return steps(
    { say: `Multiplying ${a} by ${b} builds ${b} equal copies of ${a} — place value lets us do it column by column.`, show: cleanPrompt(q) },
    {
      say: `Multiply each digit of ${a} by ${b}, carrying whenever a column passes 9, then read off the product.`,
      viz: columnMul(a, b),
    },
    { say: `${a} × ${b} = ${ans}. Multiply each place, then add the pieces.` },
  )
}

const div4: Explainer = (q) => {
  const ans = answerOf(q)
  const [dividend, divisor] = promptInts(q)
  if (ans.includes(' R ')) {
    return steps(
      { say: `Dividing ${dividend} by ${divisor} won't come out even — there will be a leftover.` },
      { say: `Pull out as many groups of ${divisor} as you can; whatever can't fill another group is the remainder.` },
      { say: `${dividend} ÷ ${divisor} = ${ans}. The R marks the leftover.` },
    )
  }
  return steps(
    { say: `Dividing ${dividend} by ${divisor} asks how many equal groups of ${divisor} it makes.` },
    {
      say: `Deal ${dividend} into rows of ${divisor} and count how many full columns you get.`,
      viz: array(divisor, dividend / divisor),
    },
    { say: `${dividend} ÷ ${divisor} = ${ans}. Count the equal groups that fit.` },
  )
}

const factors4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('FACTOR')) {
    const [n] = promptInts(q)
    return steps(
      { say: `A factor of ${n} divides it evenly, leaving nothing behind.` },
      { say: `Test each choice: divide ${n} by it and check that the remainder is zero.` },
      { say: `${ans} is a factor of ${n}. A factor divides with no remainder.` },
    )
  }
  if (q.prompt.includes('MULTIPLE')) {
    const [n] = promptInts(q)
    return steps(
      { say: `A multiple of ${n} is a number you land on counting by ${n}s.` },
      { say: `Check which choice shows up in the ${n} times table.` },
      { say: `${ans} is a multiple of ${n}. Multiples are ${n} times a whole number.` },
    )
  }
  return steps(
    { say: `A prime number can only be split into a single group of itself.` },
    { say: `Test each choice: does anything besides 1 and itself divide it evenly?` },
    { say: `${ans} is prime. It has exactly two factors: 1 and itself.` },
  )
}

const place4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('VALUE of the digit')) {
    const nums = promptInts(q)
    const digit = nums[nums.length - 1]
    const value = ints(ans)[0]
    const place = digit ? value / digit : value
    return steps(
      { say: `A digit's worth depends on which column it sits in.` },
      { say: `Here the ${digit} sits in the column worth ${place}, so multiply them together.` },
      { say: `${digit} × ${place} = ${ans}. Column position sets the value.` },
    )
  }
  if (q.prompt.includes('GREATER')) {
    return steps(
      { say: `To compare large numbers, line them up and read left to right.` },
      { say: `Find the first place where the digits differ — the bigger digit there wins.` },
      { say: `${ans} is greater. The leftmost difference decides it.` },
    )
  }
  const [n, to] = promptInts(q)
  const down = Math.floor(n / to) * to
  const up = down + to
  return steps(
    { say: `Rounding snaps a number to whichever round value sits closer.` },
    {
      say: `${n} lands between ${down} and ${up}; the digit just below the ${to} place decides which way it goes.`,
      viz: numberLine(down, up, { point: n, marks: [down, up] }),
    },
    { say: `${n} rounds to ${ans}. Look at the digit below to round up or down.` },
  )
}

const fracEquiv4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('EQUIVALENT')) {
    const [a, b] = promptInts(q)
    const [c, d] = ints(ans)
    return steps(
      { say: `Equivalent fractions cover the same amount with different-sized pieces.` },
      {
        say: `Multiply the top and bottom of ${a}/${b} by the same number to rename it.`,
        viz: fractionBar(a, b, { shaded: c, parts: d }),
      },
      { say: `${ans} is equivalent to ${a}/${b}. Scale the top and bottom together.` },
    )
  }
  const v = q.visual
  return steps(
    { say: `To compare two fractions, picture how much of each bar is filled.` },
    {
      say: `The bar with more shaded is bigger — or give them a common bottom number and compare the tops.`,
      viz: v && v.kind === 'fractionPair' ? reuse(v) : undefined,
    },
    { say: `${ans} is bigger. More shaded — or a bigger top over a common bottom — wins.` },
  )
}

const fracAddSub4: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q) // [a, den, b, den]
  const a = nums[0]
  const den = nums[1]
  const b = nums[2]
  const canBar = a <= den && b <= den
  if (q.prompt.includes('+')) {
    return steps(
      { say: `When the pieces are the same size, we add fractions by just working with the tops.` },
      {
        say: `The bottoms already match at ${den}, so add the tops: ${a} + ${b}, keeping the bottom ${den}.`,
        viz: canBar ? fractionBar(a, den, { shaded: b, parts: den }) : undefined,
      },
      { say: `${a}/${den} + ${b}/${den} = ${ans}. Same bottom — just add the tops.` },
    )
  }
  return steps(
    { say: `When the pieces are the same size, we subtract fractions by just working with the tops.` },
    {
      say: `The bottoms already match at ${den}, so subtract the tops: ${a} − ${b}, keeping the bottom ${den}.`,
      viz: canBar ? fractionBar(a, den, { shaded: b, parts: den }) : undefined,
    },
    { say: `${a}/${den} − ${b}/${den} = ${ans}. Same bottom — just subtract the tops.` },
  )
}

const fracMult4: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  if (q.prompt.startsWith('What is 1/')) {
    // "What is 1/b of whole?" -> [1, b, whole]
    const b = nums[1]
    const whole = nums[2]
    return steps(
      { say: `A unit fraction splits a whole into that many equal-sized groups.` },
      {
        say: `To find 1/${b} of ${whole}, deal ${whole} into ${b} equal rows and count what lands in each.`,
        viz: array(b, whole / b),
      },
      { say: `1/${b} of ${whole} is ${ans}. A unit fraction means divide into ${b} equal groups.` },
    )
  }
  const a = nums[0]
  const b = nums[1]
  const w = nums[2]
  return steps(
    { say: `Multiplying a fraction by a whole number scales that fraction up.` },
    {
      say: `Multiply the top by ${w}: ${a} × ${w}, keep the bottom ${b}, then simplify.`,
      viz: fractionBar(a, b),
    },
    { say: `${a}/${b} × ${w} = ${ans}. Multiply the top by the whole number; the bottom stays.` },
  )
}

const dec4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('equals')) {
    const frac = q.prompt.match(/equals (\d+\/\d+)/)?.[1] ?? ''
    return steps(
      { say: `A fraction over 10 or 100 already tells you the decimal place value.` },
      { say: `${frac} is that many tenths or hundredths — write it after the decimal point.` },
      { say: `${frac} = ${ans}. Tenths fill one place, hundredths fill two.` },
    )
  }
  if (q.prompt.includes('BIGGER')) {
    return steps(
      { say: `Comparing decimals starts by lining them up at the decimal point.` },
      { say: `Compare the tenths first; only if they tie do the hundredths decide.` },
      { say: `${ans} is bigger. Compare place by place, tenths before hundredths.` },
    )
  }
  return steps(
    { say: `Adding decimals works just like whole numbers once the points line up.` },
    { say: `Stack them by the decimal point, add each column, and bring the point straight down.` },
    { say: `That gives ${ans}. Line up the points, then add as usual.` },
  )
}

const convert4: Explainer = (q) => {
  const ans = answerOf(q)
  const first = promptInts(q)[0]
  return steps(
    { say: `Changing a bigger unit into a smaller one always makes the count go up.` },
    { say: `Starting from ${first}, multiply by how many small units fit in one big unit, then add any extra.` },
    { say: `That comes to ${ans}. Bigger unit to smaller unit means multiply.` },
  )
}

const angles4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('kind of angle')) {
    const v = q.visual
    return steps(
      { say: `An angle's name comes from how wide it opens compared with a square corner.` },
      {
        say: `A square corner is 90°: smaller is acute, exactly the corner is right, wider is obtuse.`,
        viz: v ? reuse(v) : undefined,
      },
      { say: `This angle is ${ans}. Measure its opening against a 90° corner.` },
    )
  }
  if (q.prompt.includes('fit together')) {
    const [total, a] = promptInts(q)
    return steps(
      { say: `When two angles fit together, one fills exactly what the other leaves.` },
      { say: `They add up to ${total}°, so subtract the angle you know: ${total} − ${a}.` },
      { say: `The other angle is ${ans}. The two parts add up to the whole.` },
    )
  }
  return steps(
    { say: `Lines get their name from how they meet — or whether they meet at all.` },
    { say: `Never crossing, crossing at a square corner, or simply crossing somewhere?` },
    { say: `They're called ${ans}. The way the lines meet gives the name.` },
  )
}

const word4: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  return steps(
    { say: `This is a multi-step story — solve it one piece at a time.` },
    { say: `Pull out the numbers (${nums.join(', ')}), find the in-between amount, then finish.` },
    { say: `Work it through and you get ${ans}. Do one step, then the next.` },
  )
}

export const EXPLAINERS4: Partial<Record<SkillId, Explainer>> = {
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
}
