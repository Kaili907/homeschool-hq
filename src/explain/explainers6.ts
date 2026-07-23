import type { SkillId } from '../skills'
import { answerOf, promptInts, type Explainer, type Explanation } from './types'

const steps = (...s: ({ say: string; show?: string } | false | null | undefined)[]): Explanation => ({
  steps: s.filter(Boolean) as { say: string; show?: string }[],
})

// ---------- grade 6 ----------

const ratio6: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  if (q.prompt.includes('per hour')) {
    return steps(
      { say: `Speed is miles divided by hours.` },
      { say: `Divide the ${nums[0]} miles by the ${nums[1]} hours.` },
      { say: `That's ${ans} miles per hour.` },
    )
  }
  if (q.prompt.includes('per pound')) {
    return steps(
      { say: `Price per pound is the total cost divided by the pounds.` },
      { say: `Divide the total by the ${nums[0]} pounds.` },
      { say: `That's ${ans}.` },
    )
  }
  return steps(
    { say: `You know ${nums[0]} cost $${nums[1]}.` },
    { say: `See how many times bigger ${nums[2]} is, then grow the cost the same number of times.` },
    { say: `That's ${ans}.` },
  )
}

const percent6: Explainer = (q) => {
  const ans = answerOf(q)
  const [p, n] = promptInts(q)
  if (q.prompt.includes('of a number is')) {
    return steps(
      { say: `${p}% of the mystery number is ${n}.` },
      { say: `Work backwards: ${n} ÷ ${p} × 100 rebuilds the whole.` },
      { say: `The number is ${ans}.` },
    )
  }
  return steps(
    { say: `Percent means out of 100, so ${p}% is ${p}/100.` },
    { say: `Multiply: ${n} × ${p} ÷ 100.` },
    { say: `That's ${ans}.` },
  )
}

const fracDiv6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('servings')) {
    const nums = promptInts(q) // [1, b, w]
    return steps(
      { say: `Each serving is 1/${nums[1]} cup and you have ${nums[2]} cups.` },
      { say: `Dividing by a fraction flips it: ${nums[2]} × ${nums[1]}.` },
      { say: `That's ${ans} servings.` },
    )
  }
  return steps(
    { say: `Dividing by a fraction is the same as multiplying by its reciprocal.` },
    { say: `Flip the second fraction, then multiply straight across.` },
    { say: `That's ${ans}.` },
  )
}

const decOps6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('×')) {
    return steps(
      { say: `Multiply the digits as if there were no decimal points.` },
      { say: `Then count the decimal places in both numbers and put that many in your answer.` },
      { say: `That's ${ans}.` },
    )
  }
  if (q.prompt.includes('÷')) {
    return steps(
      { say: `Slide both decimal points right until the divisor is a whole number.` },
      { say: `Then divide as usual.` },
      { say: `That's ${ans}.` },
    )
  }
  return steps(
    { say: `Line the two numbers up by their decimal points.` },
    { say: `Add or subtract like whole numbers and bring the point straight down.` },
    { say: `That's ${ans}.` },
  )
}

const int6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('point show')) {
    return steps(
      { say: `Find the marked dot on the number line.` },
      { say: `Count from 0 — right is positive, left is negative.` },
      { say: `The point is at ${ans}.` },
    )
  }
  if (q.prompt.includes('OPPOSITE')) {
    const [v] = promptInts(q)
    return steps(
      { say: `The opposite is the same distance from 0 but on the other side.` },
      { say: `So just flip the sign of ${v}.` },
      { say: `The opposite is ${ans}.` },
    )
  }
  if (q.prompt.includes('|')) {
    return steps(
      { say: `The bars mean absolute value — distance from 0, always positive.` },
      { say: `Drop the sign and keep the size.` },
      { say: `It's ${ans}.` },
    )
  }
  if (q.prompt.includes('GREATER')) {
    return steps(
      { say: `On a number line, the number farther to the right is greater.` },
      { say: `With negatives, the one closer to 0 is greater.` },
      { say: `${ans} is greater.` },
    )
  }
  const [a, b] = promptInts(q)
  return steps(
    { say: `Count the steps from −${a} up to ${b} on the number line.` },
    { say: `That distance is ${a} + ${b}.` },
    { say: `They are ${ans} apart.` },
  )
}

const coord6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('quadrant')) {
    return steps(
      { say: `Check the signs of the point's x and y.` },
      { say: `Right-up is I, left-up is II, left-down is III, right-down is IV.` },
      { say: `The point is in ${ans}.` },
    )
  }
  if (q.prompt.includes('coordinates')) {
    return steps(
      { say: `Read across for x, then up or down for y.` },
      { say: `Write it as (x, y) — across first, then up.` },
      { say: `The point is ${ans}.` },
    )
  }
  return steps(
    { say: `Reflecting across an axis flips one coordinate's sign.` },
    { say: `Across the x-axis flip y; across the y-axis flip x.` },
    { say: `It lands at ${ans}.` },
  )
}

const expr6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('distributive')) {
    const [a, b] = promptInts(q)
    return steps(
      { say: `Distributive means ${a} multiplies each term inside the parentheses.` },
      { say: `Work out ${a} × n and ${a} × ${b} separately.` },
      { say: `That gives ${ans}.` },
    )
  }
  const nums = promptInts(q)
  return steps(
    { say: `Substitute each letter with its number.` },
    { say: `Do the multiplying first, then add the parts. The numbers are ${nums.join(', ')}.` },
    { say: `That's ${ans}.` },
  )
}

const eq6: Explainer = (q) => {
  const ans = answerOf(q)
  const coeff = q.prompt.match(/(\d+)x/)?.[1]
  if (coeff) {
    return steps(
      { say: `x is multiplied by ${coeff}.` },
      { say: `Undo it by dividing both sides by ${coeff}.` },
      { say: `x = ${ans}.` },
    )
  }
  if (q.prompt.includes('÷')) {
    const [a] = promptInts(q)
    return steps(
      { say: `x is divided by ${a}.` },
      { say: `Undo it by multiplying both sides by ${a}.` },
      { say: `x = ${ans}.` },
    )
  }
  if (q.prompt.includes('−')) {
    const [a] = promptInts(q)
    return steps(
      { say: `${a} is subtracted from x.` },
      { say: `Undo it by adding ${a} to both sides.` },
      { say: `x = ${ans}.` },
    )
  }
  const [a] = promptInts(q)
  return steps(
    { say: `${a} is added to x.` },
    { say: `Undo it by subtracting ${a} from both sides.` },
    { say: `x = ${ans}.` },
  )
}

const geo6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('corner cut out')) {
    return steps(
      { say: `Find the whole rectangle's area first.` },
      { say: `Then subtract the area of the corner that was cut out.` },
      { say: `What's left is ${ans}.` },
    )
  }
  if (q.prompt.includes('HEIGHT')) {
    const [area, base] = promptInts(q)
    return steps(
      { say: `Triangle area = base × height ÷ 2, and the area is ${area}.` },
      { say: `Work backwards: height = ${area} × 2 ÷ ${base}.` },
      { say: `The height is ${ans}.` },
    )
  }
  const [b, h] = promptInts(q)
  return steps(
    { say: `A triangle's area is base × height ÷ 2.` },
    { say: `Here that's ${b} × ${h} ÷ 2.` },
    { say: `The area is ${ans}.` },
  )
}

const vol6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('SURFACE AREA')) {
    return steps(
      { say: `Surface area is the total of all six faces of the box.` },
      { say: `Find each face's area and add them — opposite faces match, so each counts twice.` },
      { say: `That's ${ans}.` },
    )
  }
  return steps(
    { say: `Volume is length × width × height.` },
    { say: `Multiply the three side lengths together.` },
    { say: `That's ${ans}.` },
  )
}

const stats6: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('MEDIAN')) {
    return steps(
      { say: `Median is the middle value.` },
      { say: `Put the numbers in order from smallest to largest and find the one in the middle.` },
      { say: `That's ${ans}.` },
    )
  }
  if (q.prompt.includes('MODE')) {
    return steps(
      { say: `Mode is the value that appears most often.` },
      { say: `Look for the number that repeats the most.` },
      { say: `That's ${ans}.` },
    )
  }
  if (q.prompt.includes('fourth quiz')) {
    const mean = q.prompt.match(/MEAN exactly (\d+)/)?.[1] ?? ''
    return steps(
      { say: `For the mean to be ${mean}, all four quizzes must total ${mean} × 4.` },
      { say: `Add the three known scores and subtract from that total.` },
      { say: `The fourth score is ${ans}.` },
    )
  }
  return steps(
    { say: `Mean is the average.` },
    { say: `Add all the numbers, then divide by how many there are.` },
    { say: `That's ${ans}.` },
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
