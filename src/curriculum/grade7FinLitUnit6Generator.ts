import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { cents, example, finLitQuestion, money, pct, type FinLitDefinition, type FinLitQuestion } from './grade7FinLitCore'
import type { CurriculumGenerator } from './generatorCore'

/** Derived only from source lessons U6 l01-l06: taxes, public goods, giving, goals, and reflection. */
export const GRADE7_FINLIT_UNIT6_ITEM_TYPES = ['why-taxes-exist','paycheck-and-sales-tax','public-goods','charitable-giving','financial-goals','decision-ethics'] as const
export type Grade7FinLitUnit6ItemType = typeof GRADE7_FINLIT_UNIT6_ITEM_TYPES[number]
type P = { priceCents: bigint; taxBasisPoints: bigint; goalCents: bigint }
export type Grade7FinLitUnit6Question = FinLitQuestion<Grade7FinLitUnit6ItemType, P>
const defs = {
  'why-taxes-exist': { standard: 'PF7 foundations', lessonFocus: 'why taxes exist', workedExample: example('Taxes can support public services.', 'public services', ['Taxes fund shared purposes.']) },
  'paycheck-and-sales-tax': { standard: 'PF7 foundations', lessonFocus: 'paycheck and sales tax concepts', workedExample: example('$10.00 plus 5% sales tax.', '$10.50', ['Compute tax in cents and add it.']) },
  'public-goods': { standard: 'PF7 foundations', lessonFocus: 'public goods', workedExample: example('A public library is used by a community.', 'public good', ['Shared services can be public goods.']) },
  'charitable-giving': { standard: 'PF7 foundations', lessonFocus: 'charitable giving', workedExample: example('A plan gives $2.00 to a chosen cause.', '$2.00', ['Giving is a planned choice.']) },
  'financial-goals': { standard: 'PF7 foundations', lessonFocus: 'financial goals', workedExample: example('A goal needs $40.00 and has $10.00.', '$30.00', ['Subtract current savings from the goal.']) },
  'decision-ethics': { standard: 'PF1-PF6 review', lessonFocus: 'decision ethics and reflection', workedExample: example('A choice affects others, so consider consequences.', 'reflect on consequences', ['Use accurate information and values.']) },
} as const satisfies Record<Grade7FinLitUnit6ItemType, FinLitDefinition>
export function generateGrade7FinLitUnit6Question(type: Grade7FinLitUnit6ItemType, difficulty: Difficulty): Grade7FinLitUnit6Question {
  const taxBasisPoints = pick([500n, 800n, 1000n] as const); const priceCents = BigInt(ri(20, 300 + difficulty * 100) * 100); const goalCents = cents(100, 800 + difficulty * 200); const taxCents = priceCents * taxBasisPoints / 10_000n; let prompt: string; let answer: string; let distractors: string[]
  if (type === 'why-taxes-exist') { const service = pick(['road repairs','a public library','fire protection','park maintenance'] as const); prompt = `A fictional community collects taxes on purchases such as a ${money(priceCents)} item and budgets ${money(goalCents)} for ${service}. One reason taxes exist is to help fund what?`; answer = 'public services'; distractors = ['private passwords','guaranteed investments','subscriptions','advertising'] }
  else if (type === 'paycheck-and-sales-tax') { prompt = `A fictional item costs ${money(priceCents)} and sales tax is ${pct(Number(taxBasisPoints))}. The price is chosen so tax is whole cents. What is the total after tax?`; answer = money(priceCents + taxCents); distractors = [money(priceCents), money(taxCents), money(priceCents + taxCents + 100n), money(priceCents + taxCents - 100n)] }
  else if (type === 'public-goods') { const service = pick(['a community library','a public park','a fire station','a public sidewalk'] as const); prompt = `A fictional community funds ${service} with taxes from purchases such as ${money(priceCents)} and a shared-services budget of ${money(goalCents)}. This is an example of what?`; answer = 'a public good'; distractors = ['a private password','a personal subscription','one person’s receipt','an individual loan'] }
  else if (type === 'charitable-giving') { const cause = pick(['a food pantry','an animal shelter','a literacy program','a disaster-relief group'] as const); const gift = priceCents / 10n; prompt = `A fictional budget sets aside ${money(gift)} from ${money(priceCents)} for ${cause} and has an annual goal of ${money(goalCents)}. This choice is called what?`; answer = 'charitable giving'; distractors = ['a loan payment','a deduction','identity theft','a credit score'] }
  else if (type === 'financial-goals') { const saved = goalCents / 3n; prompt = `A fictional financial goal is ${money(goalCents)}. The learner already saved ${money(saved)}. How much remains to reach the goal?`; answer = money(goalCents - saved); distractors = [money(saved), money(goalCents + saved), money(goalCents - saved + 100n), money(goalCents - saved - 100n)] }
  else { prompt = `A fictional choice would save ${money(priceCents)} toward a ${money(goalCents)} goal but hides an important fee from another person. What is the most ethical next step?`; answer = 'disclose the fee and reconsider the decision'; distractors = ['hide the fee','share a password','ignore consequences','claim the fee does not matter'] }
  return finLitQuestion(type, difficulty, defs[type], prompt, answer, { priceCents, taxBasisPoints, goalCents }, distractors)
}
export const GRADE7_FINLIT_UNIT6_GENERATORS = Object.fromEntries(GRADE7_FINLIT_UNIT6_ITEM_TYPES.map(type => [type, (d: Difficulty) => generateGrade7FinLitUnit6Question(type, d)])) as Record<Grade7FinLitUnit6ItemType, CurriculumGenerator<Grade7FinLitUnit6Question>>
