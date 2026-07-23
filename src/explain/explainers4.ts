import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, ints, promptInts, type Explainer, type Explanation } from './types'

const steps = (...s: ({ say: string; show?: string } | false | null | undefined)[]): Explanation => ({
  steps: s.filter(Boolean) as { say: string; show?: string }[],
})

// ---------- grade 4 ----------

const mult4: Explainer = (q) => {
  const ans = answerOf(q)
  const [a, b] = promptInts(q)
  return steps(
    { say: `Multiply ${a} by ${b}.`, show: cleanPrompt(q) },
    { say: `Break ${a} into its place values, multiply each by ${b}, then add the pieces.` },
    { say: `${a} × ${b} = ${ans}.` },
  )
}

const div4: Explainer = (q) => {
  const ans = answerOf(q)
  const [dividend, divisor] = promptInts(q)
  if (ans.includes(' R ')) {
    return steps(
      { say: `Divide ${dividend} by ${divisor} — it won't come out even.` },
      { say: `Take out as many ${divisor}s as you can; whatever is left over is the remainder.` },
      { say: `The answer is ${ans} (R marks the leftover).` },
    )
  }
  return steps(
    { say: `Divide ${dividend} into groups of ${divisor}.` },
    { say: `How many ${divisor}s fit inside ${dividend}?` },
    { say: `${dividend} ÷ ${divisor} = ${ans}.` },
  )
}

const factors4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('FACTOR')) {
    const [n] = promptInts(q)
    return steps(
      { say: `A factor of ${n} divides it evenly with nothing left over.` },
      { say: `Test each choice: does it divide ${n} exactly?` },
      { say: `${ans} is a factor of ${n}.` },
    )
  }
  if (q.prompt.includes('MULTIPLE')) {
    const [n] = promptInts(q)
    return steps(
      { say: `A multiple of ${n} is ${n} times a whole number.` },
      { say: `Which choice shows up in the ${n} times table?` },
      { say: `${ans} is a multiple of ${n}.` },
    )
  }
  return steps(
    { say: `A prime number has exactly two factors: 1 and itself.` },
    { say: `Check which choice can't be split into equal groups any other way.` },
    { say: `${ans} is prime.` },
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
      { say: `A digit's value depends on its column.` },
      { say: `Here the ${digit} sits in a column worth ${place}.` },
      { say: `So its value is ${digit} × ${place} = ${ans}.` },
    )
  }
  if (q.prompt.includes('GREATER')) {
    return steps(
      { say: `Compare the numbers digit by digit, starting from the left.` },
      { say: `The first place where they differ decides which is greater.` },
      { say: `${ans} is greater.` },
    )
  }
  const [n, to] = promptInts(q)
  return steps(
    { say: `Round ${n} to the nearest ${to}.` },
    { say: `Look at the digit just below the ${to} place to decide up or down.` },
    { say: `${n} rounds to ${ans}.` },
  )
}

const fracEquiv4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('EQUIVALENT')) {
    const [a, b] = promptInts(q)
    return steps(
      { say: `Equivalent fractions name the same amount.` },
      { say: `Multiply the top and bottom of ${a}/${b} by the same number.` },
      { say: `${ans} is equivalent to ${a}/${b}.` },
    )
  }
  const v = q.visual
  const af = v && v.kind === 'fractionPair' ? `${v.a[0]}/${v.a[1]}` : ''
  const bf = v && v.kind === 'fractionPair' ? `${v.b[0]}/${v.b[1]}` : ''
  return steps(
    { say: `Compare ${af} and ${bf} using the shaded bars.` },
    { say: `The fraction with more shaded is bigger — or give them a common bottom number and compare tops.` },
    { say: `${ans} is bigger.` },
  )
}

const fracAddSub4: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q) // [a, den, b, den]
  const a = nums[0]
  const den = nums[1]
  const b = nums[2]
  if (q.prompt.includes('+')) {
    return steps(
      { say: `The bottom numbers already match at ${den}.` },
      { say: `Add just the tops: ${a} + ${b}, and keep the bottom ${den}.` },
      { say: `That gives ${ans}.` },
    )
  }
  return steps(
    { say: `The bottom numbers already match at ${den}.` },
    { say: `Subtract the tops: ${a} − ${b}, and keep the bottom ${den}.` },
    { say: `That gives ${ans}.` },
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
      { say: `"1/${b} of ${whole}" means split ${whole} into ${b} equal groups.` },
      { say: `So work out ${whole} ÷ ${b}.` },
      { say: `That's ${ans}.` },
    )
  }
  const a = nums[0]
  const b = nums[1]
  const w = nums[2]
  return steps(
    { say: `Multiply the fraction ${a}/${b} by ${w}.` },
    { say: `Multiply the top: ${a} × ${w}, keep the bottom ${b}, then simplify.` },
    { say: `That's ${ans}.` },
  )
}

const dec4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('equals')) {
    const frac = q.prompt.match(/equals (\d+\/\d+)/)?.[1] ?? ''
    return steps(
      { say: `${frac} tells you the place value — tenths or hundredths.` },
      { say: `Write that many tenths or hundredths as a decimal.` },
      { say: `${frac} = ${ans}.` },
    )
  }
  if (q.prompt.includes('BIGGER')) {
    return steps(
      { say: `Line the two decimals up by the decimal point.` },
      { say: `Compare the tenths first, then the hundredths.` },
      { say: `${ans} is bigger.` },
    )
  }
  return steps(
    { say: `Line up the decimal points.` },
    { say: `Add just like whole numbers and bring the point straight down.` },
    { say: `That's ${ans}.` },
  )
}

const convert4: Explainer = (q) => {
  const ans = answerOf(q)
  const first = promptInts(q)[0]
  return steps(
    { say: `We're changing a bigger unit into a smaller one, starting from ${first}.` },
    { say: `Each bigger unit is worth many smaller ones — multiply by the conversion factor and add any extra.` },
    { say: `That comes to ${ans}.` },
  )
}

const angles4: Explainer = (q) => {
  const ans = answerOf(q)
  if (q.prompt.includes('kind of angle')) {
    return steps(
      { say: `Compare the angle's opening to a square corner, which is 90°.` },
      { say: `Smaller than the corner is acute, exactly the corner is right, wider is obtuse.` },
      { say: `This angle is ${ans}.` },
    )
  }
  if (q.prompt.includes('fit together')) {
    const [total, a] = promptInts(q)
    return steps(
      { say: `The two angles together make ${total}°.` },
      { say: `Subtract the angle you know: ${total} − ${a}.` },
      { say: `The other angle is ${ans}.` },
    )
  }
  return steps(
    { say: `Think about how the two lines meet.` },
    { say: `Never crossing, meeting at a square corner, or simply crossing?` },
    { say: `They're called ${ans}.` },
  )
}

const word4: Explainer = (q) => {
  const ans = answerOf(q)
  const nums = promptInts(q)
  return steps(
    { say: `A multi-step story. Read it and pull out the numbers: ${nums.join(', ')}.` },
    { say: `Do one step at a time — find the in-between amount, then finish.` },
    { say: `Work it through and you get ${ans}.` },
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
