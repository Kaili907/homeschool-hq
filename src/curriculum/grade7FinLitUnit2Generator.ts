import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { cents, example, finLitQuestion, money, type FinLitDefinition, type FinLitQuestion } from './grade7FinLitCore'
import type { CurriculumGenerator } from './generatorCore'

/** Derived only from source lessons U2 l01-l06; the sequence is not inferred beyond those records. */
export const GRADE7_FINLIT_UNIT2_ITEM_TYPES = ['needs-and-opportunity-cost','unit-pricing','advertising-influence','terms-and-conditions','subscriptions-and-returns','fraud-protection'] as const
export type Grade7FinLitUnit2ItemType = typeof GRADE7_FINLIT_UNIT2_ITEM_TYPES[number]
type P = { priceCents: bigint; count: number; months: number }
export type Grade7FinLitUnit2Question = FinLitQuestion<Grade7FinLitUnit2ItemType, P>
const defs = {
  'needs-and-opportunity-cost': { standard: 'PF2 foundations', lessonFocus: 'needs priorities and opportunity cost', workedExample: example('Choosing a bus pass means not buying a game.', 'the game', ['The next-best forgone choice is opportunity cost.']) },
  'unit-pricing': { standard: 'PF2 foundations', lessonFocus: 'unit pricing', workedExample: example('6 items cost $3.00. Unit price?', '$0.50', ['Divide cents by the number of items.']) },
  'advertising-influence': { standard: 'PF2 foundations', lessonFocus: 'advertising and influence', workedExample: example('An ad uses a countdown timer.', 'an influence tactic', ['Notice tactics before deciding.']) },
  'terms-and-conditions': { standard: 'PF6 foundations', lessonFocus: 'terms and conditions', workedExample: example('A contract says fees renew monthly.', 'read the terms', ['Terms state obligations and costs.']) },
  'subscriptions-and-returns': { standard: 'PF6 foundations', lessonFocus: 'subscriptions and returns', workedExample: example('A $5 monthly plan for 3 months costs?', '$15.00', ['Multiply the monthly cents by months.']) },
  'fraud-protection': { standard: 'PF6 foundations', lessonFocus: 'fraud and consumer protection', workedExample: example('A stranger asks for a password.', 'do not share it', ['Protect account information.']) },
} as const satisfies Record<Grade7FinLitUnit2ItemType, FinLitDefinition>
export function generateGrade7FinLitUnit2Question(type: Grade7FinLitUnit2ItemType, difficulty: Difficulty): Grade7FinLitUnit2Question {
  const count = ri(2, 12 + difficulty); const priceCents = BigInt(count * ri(125, 900)); const months = ri(2, 6 + difficulty); let prompt: string; let answer: string; let distractors: string[]
  if (type === 'needs-and-opportunity-cost') { prompt = `A fictional shopper has ${money(priceCents)} and chooses a required bus pass instead of a concert ticket costing ${money(priceCents - 100n)}. What is the opportunity cost?`; answer = 'the concert ticket'; distractors = ['the bus pass','the shopper’s money','a deduction','nothing'] }
  else if (type === 'unit-pricing') { const unit = priceCents / BigInt(count); prompt = `A ${count}-pack costs ${money(priceCents)}. What is the price per item?`; answer = money(unit); distractors = [money(unit + 25n), money(unit - 25n), money(priceCents), money(BigInt(count) * 100n)] }
  else if (type === 'advertising-influence') { const tactic = pick(['a countdown timer','a celebrity endorsement','a “limited supply” claim'] as const); prompt = `An advertisement for a ${money(priceCents)} product uses ${tactic}. Before buying, this is best recognized as what?`; answer = 'an influence tactic'; distractors = ['a guarantee of value','a return policy','a receipt','a savings account'] }
  else if (type === 'terms-and-conditions') { prompt = `A fictional app costs ${money(priceCents)} and its terms say it renews automatically after ${months} months. What should a consumer do before agreeing?`; answer = 'read the renewal terms'; distractors = ['assume it is free','share a password','ignore the date','discard the receipt'] }
  else if (type === 'subscriptions-and-returns') { prompt = `A subscription costs ${money(priceCents)} each month for ${months} months. With no other fees, what is the total cost?`; answer = money(priceCents * BigInt(months)); distractors = [money(priceCents * BigInt(months - 1)), money(priceCents + BigInt(months) * 100n), money(priceCents), money(priceCents * BigInt(months + 1))] }
  else { const scam = pick(['asks for your account password immediately','demands a gift-card payment before sending a prize','requests an urgent wire transfer','asks for an account number to “verify” a refund'] as const); prompt = `A message claims you won ${money(priceCents)} but ${scam}. What is the safest response?`; answer = 'do not share the password'; distractors = ['send private account information','pay a fee first','forward private information','post account information publicly'] }
  return finLitQuestion(type, difficulty, defs[type], prompt, answer, { priceCents, count, months }, distractors)
}
export const GRADE7_FINLIT_UNIT2_GENERATORS = Object.fromEntries(GRADE7_FINLIT_UNIT2_ITEM_TYPES.map(type => [type, (d: Difficulty) => generateGrade7FinLitUnit2Question(type, d)])) as Record<Grade7FinLitUnit2ItemType, CurriculumGenerator<Grade7FinLitUnit2Question>>
