import type { SkillId } from '../skills'
import { answerOf, promptInts, steps, type Explainer, type Explanation } from './types'
import { numberLine, fractionBar, array, equationLedger, reuse } from './vizHelpers'

// ---------- grade 6 ----------

const ratio6: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  if (q.prompt.includes('per hour')) {
    const [miles, hours] = nums
    return steps(
      { say: `Speed measures how much distance is covered each hour.` },
      {
        say: `Divide the ${miles} miles by the ${hours} hours.`,
        viz: equationLedger([{ left: `${miles} ÷ ${hours}`, right: `${ans}`, op: `miles per hour` }], 0),
      },
      { say: `That's ${ans} miles per hour. A unit rate is the amount for exactly one unit.` },
    )
  }
  if (q.prompt.includes('per pound')) {
    return steps(
      { say: `A unit price tells you what a single pound costs.` },
      { say: `Divide the total by the ${nums[0]} pounds.` },
      { say: `That's ${ans}. A unit price is the cost of just one unit.` },
    )
  }
  return steps(
    { say: `A ratio keeps the cost and the count growing together.` },
    {
      say: `See how many times bigger ${nums[2]} is than ${nums[0]}, then grow the $${nums[1]} the same number of times.`,
      viz: q.visual ? reuse(q.visual) : undefined,
    },
    { say: `That's ${ans}. Ratios keep the same relationship as they scale up.` },
  )
}

const percent6: Explainer = (q) => {
  const ans = answerOf(q)
  const [p, n] = promptInts(q)
  if (q.prompt.includes('of a number is')) {
    return steps(
      { say: `A percent is a part out of 100, so you can rebuild the whole from a part.` },
      {
        say: `Work backwards: ${n} ÷ ${p} × 100 rebuilds the whole.`,
        viz: fractionBar(p, 100),
      },
      { say: `The number is ${ans}. Percent always means out of 100.` },
    )
  }
  return steps(
    { say: `A percent is a part out of 100.` },
    {
      say: `${p}% is ${p} out of 100, so multiply: ${n} × ${p} ÷ 100.`,
      viz: fractionBar(p, 100),
    },
    { say: `That's ${ans}. Percent always means out of 100.` },
  )
}

const fracDiv6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('servings')) {
    const nums = promptInts(q) // [1, b, w]
    return steps(
      { say: `Dividing tells you how many equal parts fit inside the whole.` },
      {
        say: `Each cup holds ${nums[1]} servings, and there are ${nums[2]} cups: ${nums[2]} × ${nums[1]}.`,
        viz: array(nums[2], nums[1]),
      },
      { say: `That's ${ans} servings. Dividing by a fraction is multiplying by its reciprocal.` },
    )
  }
  return steps(
    { say: `Dividing asks how many of one fraction fit into another.` },
    { say: `Flip the second fraction, then multiply straight across.` },
    { say: `That's ${ans}. Dividing by a fraction is multiplying by its reciprocal.` },
  )
}

const decOps6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('×')) {
    return steps(
      { say: `Multiplying decimals works just like whole numbers — the point is placed at the end.` },
      { say: `Multiply the digits as if there were no decimal points, then count the total decimal places.` },
      { say: `That's ${ans}. Multiply as whole numbers, then place the decimal.` },
    )
  }
  if (q.prompt.includes('÷')) {
    return steps(
      { say: `Dividing is easier when the divisor is a whole number.` },
      { say: `Slide both decimal points right until the divisor is whole, then divide as usual.` },
      { say: `That's ${ans}. Shift both points the same way, then divide.` },
    )
  }
  return steps(
    { say: `Adding and subtracting decimals only works when place values match.` },
    { say: `Line the numbers up by their decimal points, add or subtract, and bring the point straight down.` },
    { say: `That's ${ans}. Line up the points and the place values match.` },
  )
}

const int6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('point show')) {
    return steps(
      { say: `Every spot on a number line stands for exactly one number.` },
      {
        say: `Count from 0 — right is positive, left is negative.`,
        viz: q.visual ? reuse(q.visual) : undefined,
      },
      { say: `The point is at ${ans}. Right of 0 is positive, left is negative.` },
    )
  }
  if (q.prompt.includes('OPPOSITE')) {
    const [v] = promptInts(q)
    const b = Math.abs(v)
    return steps(
      { say: `The opposite of a number is the same distance from 0 but on the other side.` },
      {
        say: `So just flip the sign of ${v}.`,
        viz: numberLine(-b, b, { marks: [v, -v] }),
      },
      { say: `The opposite is ${ans}. Opposites are mirror images across 0.` },
    )
  }
  if (q.prompt.includes('|')) {
    const [v] = promptInts(q)
    const b = Math.abs(v)
    return steps(
      { say: `Absolute value is how far a number sits from 0 — always positive.` },
      {
        say: `Measure the distance from ${v} to 0.`,
        viz: numberLine(-b, b, { point: v, jumps: [{ from: v, to: 0, label: `${b}` }] }),
      },
      { say: `It's ${ans}. Absolute value is always a distance, so never negative.` },
    )
  }
  if (q.prompt.includes('GREATER')) {
    const vals = q.choices.map(Number)
    const ok = vals.every((v) => Number.isFinite(v))
    return steps(
      { say: `On a number line, the number farther to the right is greater.` },
      {
        say: `With negatives, the one closer to 0 is greater.`,
        viz: ok ? numberLine(Math.min(...vals), Math.max(...vals, 0), { marks: vals }) : undefined,
      },
      { say: `${ans} is greater. Farther right on the number line means greater.` },
    )
  }
  const [a, b] = promptInts(q)
  return steps(
    { say: `Distance on a number line is how far apart two points are.` },
    {
      say: `Count the steps from −${a} up to ${b}: that distance is ${a} + ${b}.`,
      viz: numberLine(-a, b, { jumps: [{ from: -a, to: b, label: `${a} + ${b}` }] }),
    },
    { say: `They are ${ans} apart. Distance is always the gap between the two points.` },
  )
}

const coord6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('quadrant')) {
    return steps(
      { say: `The two axes split the plane into four quadrants.` },
      {
        say: `Check the signs: right-up is I, left-up is II, left-down is III, right-down is IV.`,
        viz: q.visual ? reuse(q.visual) : undefined,
      },
      { say: `The point is in ${ans}. The signs of x and y pick the quadrant.` },
    )
  }
  if (q.prompt.includes('coordinates')) {
    return steps(
      { say: `A point's address is how far across and how far up it sits.` },
      {
        say: `Read across for x, then up or down for y, and write it as (x, y).`,
        viz: q.visual ? reuse(q.visual) : undefined,
      },
      { say: `The point is ${ans}. Always read across first, then up.` },
    )
  }
  return steps(
    { say: `Reflecting across an axis mirrors the point to the other side.` },
    { say: `Across the x-axis flip y; across the y-axis flip x.` },
    { say: `It lands at ${ans}. A reflection flips the sign of one coordinate.` },
  )
}

const expr6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('distributive')) {
    const [a, b] = promptInts(q)
    return steps(
      { say: `The distributive property spreads the multiplier over each term inside.` },
      {
        say: `Multiply ${a} by n and ${a} by ${b} separately.`,
        viz: equationLedger(
          [
            { left: `${a}(n + ${b})`, right: `?` },
            { left: `${a}·n + ${a}·${b}`, right: `${a}n + ${a * b}`, op: `distribute the ${a}` },
            { left: `${a}n + ${a * b}`, right: `` },
          ],
          1,
        ),
      },
      { say: `That gives ${ans}. Multiply the outside number by every term inside.` },
    )
  }
  if (/when x =/.test(q.prompt)) {
    const [a, b, x] = promptInts(q)
    return steps(
      { say: `A variable is a placeholder — solving means plugging in its value.` },
      {
        say: `Replace x with ${x}, multiply, then add.`,
        viz: equationLedger(
          [
            { left: `${a}x + ${b}`, right: `x = ${x}` },
            { left: `${a}·${x} + ${b}`, right: `${a * x} + ${b}`, op: `substitute x = ${x}` },
            { left: `${a * x} + ${b}`, right: `${ans}` },
          ],
          1,
        ),
      },
      { say: `That's ${ans}. Plug in the value, then follow the order of operations.` },
    )
  }
  const [aa, bb, av, bv] = promptInts(q)
  return steps(
    { say: `A variable is a placeholder — solving means plugging in its value.` },
    {
      say: `Replace a with ${av} and b with ${bv}, multiply, then add.`,
      viz: equationLedger(
        [
          { left: `${aa}a + ${bb}b`, right: `a = ${av}, b = ${bv}` },
          { left: `${aa}·${av} + ${bb}·${bv}`, right: `${aa * av} + ${bb * bv}`, op: `substitute` },
          { left: `${aa * av} + ${bb * bv}`, right: `${ans}` },
        ],
        1,
      ),
    },
    { say: `That's ${ans}. Plug in the value, then follow the order of operations.` },
  )
}

const eq6: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  const coeff = q.prompt.match(/(\d+)x/)?.[1]
  if (coeff) {
    const c = Number(coeff)
    const rhs = nums[1]
    return steps(
      { say: `To solve, get x by itself while keeping both sides equal.` },
      {
        say: `x is multiplied by ${c}, so divide both sides by ${c}.`,
        viz: equationLedger(
          [
            { left: `${c}x`, right: `${rhs}` },
            { left: `${c}x ÷ ${c}`, right: `${rhs} ÷ ${c}`, op: `divide both sides by ${c}` },
            { left: `x`, right: `${ans}` },
          ],
          1,
        ),
      },
      { say: `x = ${ans}. Whatever you do to one side, do to the other.` },
    )
  }
  if (q.prompt.includes('÷')) {
    const [a, b] = nums
    return steps(
      { say: `To solve, get x by itself while keeping both sides equal.` },
      {
        say: `x is divided by ${a}, so multiply both sides by ${a}.`,
        viz: equationLedger(
          [
            { left: `x ÷ ${a}`, right: `${b}` },
            { left: `x ÷ ${a} × ${a}`, right: `${b} × ${a}`, op: `multiply both sides by ${a}` },
            { left: `x`, right: `${ans}` },
          ],
          1,
        ),
      },
      { say: `x = ${ans}. Whatever you do to one side, do to the other.` },
    )
  }
  if (q.prompt.includes('−')) {
    const [a, rhs] = nums
    return steps(
      { say: `To solve, get x by itself while keeping both sides equal.` },
      {
        say: `${a} is subtracted from x, so add ${a} to both sides.`,
        viz: equationLedger(
          [
            { left: `x − ${a}`, right: `${rhs}` },
            { left: `x − ${a} + ${a}`, right: `${rhs} + ${a}`, op: `add ${a} to both sides` },
            { left: `x`, right: `${ans}` },
          ],
          1,
        ),
      },
      { say: `x = ${ans}. Whatever you do to one side, do to the other.` },
    )
  }
  const [a, rhs] = nums
  return steps(
    { say: `To solve, get x by itself while keeping both sides equal.` },
    {
      say: `${a} is added to x, so subtract ${a} from both sides.`,
      viz: equationLedger(
        [
          { left: `x + ${a}`, right: `${rhs}` },
          { left: `x + ${a} − ${a}`, right: `${rhs} − ${a}`, op: `subtract ${a} from both sides` },
          { left: `x`, right: `${ans}` },
        ],
        1,
      ),
    },
    { say: `x = ${ans}. Whatever you do to one side, do to the other.` },
  )
}

const geo6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('corner cut out')) {
    return steps(
      { say: `The leftover area is the whole rectangle minus the piece removed.` },
      { say: `Find the whole rectangle's area, then subtract the corner that was cut out.` },
      { say: `What's left is ${ans}. Subtract the missing piece from the whole.` },
    )
  }
  if (q.prompt.includes('HEIGHT')) {
    const [area, base] = promptInts(q)
    return steps(
      { say: `Area, base, and height are linked, so knowing two of them finds the third.` },
      { say: `Work backwards: height = ${area} × 2 ÷ ${base}.` },
      { say: `The height is ${ans}. Knowing the area lets you work any dimension backward.` },
    )
  }
  const [b, h] = promptInts(q)
  return steps(
    { say: `A triangle is exactly half of the rectangle around it.` },
    { say: `So its area is base × height ÷ 2 — here ${b} × ${h} ÷ 2.` },
    { say: `The area is ${ans}. A triangle is half of its rectangle.` },
  )
}

const vol6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('SURFACE AREA')) {
    return steps(
      { say: `Surface area is the total covering of all six faces of the box.` },
      { say: `Find each face's area and add them — opposite faces match, so each counts twice.` },
      { say: `That's ${ans}. Surface area adds up every face.` },
    )
  }
  return steps(
    { say: `Volume counts the unit cubes that fill the box.` },
    { say: `Multiply the three side lengths: length × width × height.` },
    { say: `That's ${ans}. Volume multiplies the three dimensions.` },
  )
}

const stats6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('MEDIAN')) {
    return steps(
      { say: `The median is the middle value once the numbers are in order.` },
      { say: `Put the numbers in order from smallest to largest and find the one in the middle.` },
      { say: `That's ${ans}. The median is the middle of the ordered list.` },
    )
  }
  if (q.prompt.includes('MODE')) {
    return steps(
      { say: `The mode is the value that shows up most often.` },
      { say: `Look for the number that repeats the most.` },
      { say: `That's ${ans}. The mode is the most frequent value.` },
    )
  }
  if (q.prompt.includes('fourth quiz')) {
    const mean = q.prompt.match(/MEAN exactly (\d+)/)?.[1] ?? ''
    return steps(
      { say: `The mean spreads the total evenly, so the total is fixed.` },
      { say: `All four quizzes must total ${mean} × 4; add the three known scores and subtract.` },
      { say: `The fourth score is ${ans}. The mean fixes the total, so the last value is forced.` },
    )
  }
  return steps(
    { say: `The mean shares the total equally among all the values.` },
    { say: `Add all the numbers, then divide by how many there are.` },
    { say: `That's ${ans}. The mean shares the total equally.` },
  )
}

export const EXPLAINERS6: Partial<Record<SkillId, Explainer>> = {
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
}
