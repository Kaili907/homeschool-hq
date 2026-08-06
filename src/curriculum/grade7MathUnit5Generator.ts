import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Source coverage: Grade 7 Mathematics Unit 5 (days 73-90), 7.RP.3 and 7.EE.3. All money is integer cents. */
export const GRADE7_MATH_UNIT5_ITEM_TYPES = ['percent-increase-decrease', 'discount-markup', 'tax-tip', 'simple-interest', 'percent-error', 'multi-step-percent-problem'] as const
export type Grade7MathUnit5ItemType = typeof GRADE7_MATH_UNIT5_ITEM_TYPES[number]
type Params = { amountCents: number; percent: number; secondPercent: number; years: number; actual?: number; measured?: number; direction?: 'increase' | 'decrease' }
type Q<T extends Grade7MathUnit5ItemType> = CurriculumQuestion<T, Params>
export type Grade7MathUnit5Question = { [T in Grade7MathUnit5ItemType]: Q<T> }[Grade7MathUnit5ItemType]
type Def = { standard: '7.RP.3' | '7.EE.3'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape, down to the two-decimal money the item
 * actually displays, and each answer is the answer to that prompt.
 */
export const GRADE7_MATH_UNIT5_ITEM_DEFINITIONS = {
  'percent-increase-decrease': { standard: '7.RP.3', lessonFocus: 'percent increase and decrease', workedExample: example('Increase $80.00 by 25%.', '$100.00', [
    'A percent is a count of hundredths, so 25% means 25 out of every 100, which is the fraction 25/100.',
    'Find how many dollars that is: 80 × 25 ÷ 100 = 20 dollars.',
    'An increase is added on top of the original amount, so the new amount is 80 + 20 = 100, written $100.00. A 25% decrease would subtract instead and give 80 - 20 = 60.',
  ]) },
  'discount-markup': { standard: '7.RP.3', lessonFocus: 'discounts and markups', workedExample: example('A store discounts $80.00 by 20%. What is the new price?', '$64.00', [
    'A discount is a percent taken off the original price, so the percent applies to $80.00, not to the answer.',
    '20% means 20 hundredths: 80 × 20 ÷ 100 = 16 dollars comes off.',
    'Subtract the discount from the original price: 80 - 16 = 64, so the new price is $64.00. A 20% markup would use the same 16 dollars but add it, giving 80 + 16 = 96.',
  ]) },
  'tax-tip': { standard: '7.RP.3', lessonFocus: 'tax and tip', workedExample: example('A meal costs $40.00. What is a 10% tip?', '$4.00', [
    'A tip is a percent of the bill, so the question asks for a part of $40.00, not for a new total.',
    '10% means 10 hundredths, and 10/100 is the same as 1/10, so the tip is one tenth of the bill: 40 ÷ 10 = 4 dollars.',
    'The tip is $4.00. Tax works the same way on the bill, but a tax question asks for the total, so a 10% tax on $40.00 would give 40 + 4 = 44 dollars.',
  ]) },
  'simple-interest': { standard: '7.RP.3', lessonFocus: 'simple interest', workedExample: example('Find the simple interest on $200.00 at 5% for 3 years.', '$30.00', [
    'Simple interest is always figured on the starting amount, so the same interest is earned every year and nothing compounds.',
    'Work out one year first: 5% of 200 dollars is 200 × 5 ÷ 100 = 10 dollars.',
    'Multiply by the number of years: 10 × 3 = 30, so the interest is $30.00. That is the interest by itself; the account would hold 200 + 30 = 230 dollars in total.',
  ]) },
  'percent-error': { standard: '7.EE.3', lessonFocus: 'percent error', workedExample: example('The actual value is 400 and the measured value is 500. What is the percent error?', '25%', [
    'Percent error compares how far a measurement missed with the size of the actual value, so the actual value is what you divide by.',
    'Find the size of the miss first: 500 - 400 = 100.',
    'Write that error as a fraction of the actual value and turn it into a percent: 100 ÷ 400 = 1/4, and 1/4 of 100% is 25%. Dividing by the measured 500 instead would compare the error with the wrong amount.',
  ]) },
  'multi-step-percent-problem': { standard: '7.EE.3', lessonFocus: 'multi-step percent problems', workedExample: example('An item costs $200.00, is discounted 25%, then taxed 10%. What is the final price?', '$165.00', [
    'The two percents act one after the other, and the tax is charged on the discounted price rather than the original, so the order matters.',
    'Apply the discount first: 200 × 25 ÷ 100 = 50, so the price falls to 200 - 50 = 150 dollars.',
    'Now add 10% tax on that new price: 150 × 10 ÷ 100 = 15, so the final price is 150 + 15 = 165, written $165.00. Taxing the original 200 would have added 20 instead of 15 and overcharged by 5 dollars.',
  ]) },
} as const satisfies Record<Grade7MathUnit5ItemType, Def>
const q = (itemType: Grade7MathUnit5ItemType, difficulty: Difficulty, prompt: string, answer: string, parameters: Params, distractors: string[]) => makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer: answer, distractors, distractorMode: 'distinct', parameters, ...GRADE7_MATH_UNIT5_ITEM_DEFINITIONS[itemType] })
const money = (cents: number) => `$${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const percentOf = (cents: number, percent: number) => cents * percent / 100
const facts = (difficulty: Difficulty) => ({ amountCents: ri(4, difficulty * 10 + 25) * 2_000, percent: pick([5, 10, 20, 25] as const), secondPercent: pick([5, 10] as const), years: ri(2, difficulty + 4) })
export function generatePercentIncreaseDecreaseQuestion(difficulty: Difficulty) { const p = facts(difficulty); const direction = pick(['increase', 'decrease'] as const); const answer = p.amountCents + (direction === 'increase' ? 1 : -1) * percentOf(p.amountCents, p.percent); return q('percent-increase-decrease', difficulty, `${direction === 'increase' ? 'Increase' : 'Decrease'} ${money(p.amountCents)} by ${p.percent}%.`, money(answer), { ...p, direction }, [money(p.amountCents), money(percentOf(p.amountCents, p.percent)), money(p.amountCents + (direction === 'increase' ? -1 : 1) * percentOf(p.amountCents, p.percent)), money(answer + 100)]) }
export function generateDiscountMarkupQuestion(difficulty: Difficulty) { const p = facts(difficulty); const direction = pick(['increase', 'decrease'] as const); const answer = p.amountCents + (direction === 'increase' ? 1 : -1) * percentOf(p.amountCents, p.percent); return q('discount-markup', difficulty, `A store ${direction === 'increase' ? 'marks up' : 'discounts'} ${money(p.amountCents)} by ${p.percent}%. What is the new price?`, money(answer), { ...p, direction }, [money(p.amountCents), money(percentOf(p.amountCents, p.percent)), money(p.amountCents + (direction === 'increase' ? -1 : 1) * percentOf(p.amountCents, p.percent)), money(answer + 100)]) }
export function generateTaxTipQuestion(difficulty: Difficulty) { const p = facts(difficulty); const isTax = pick([true, false] as const); const amountCents = p.amountCents / 2; const added = percentOf(amountCents, p.percent); const answer = isTax ? amountCents + added : added; return q('tax-tip', difficulty, isTax ? `A meal costs ${money(amountCents)} before ${p.percent}% tax. What is the total?` : `A meal costs ${money(amountCents)}. What is a ${p.percent}% tip?`, money(answer), { ...p, amountCents }, [money(amountCents), money(added * 2), money(amountCents - added), money(answer + 100)]) }
export function generateSimpleInterestQuestion(difficulty: Difficulty) { const p = facts(difficulty); const answer = percentOf(p.amountCents, p.percent) * p.years; return q('simple-interest', difficulty, `Find the simple interest on ${money(p.amountCents)} at ${p.percent}% for ${p.years} years.`, money(answer), p, [money(percentOf(p.amountCents, p.percent)), money(answer + p.amountCents), money(answer + 100), money(answer + p.percent * 100)]) }
export function generatePercentErrorQuestion(difficulty: Difficulty) { const p = facts(difficulty); const actual = ri(4, difficulty * 8 + 8) * 100; const measured = actual + actual * p.percent / 100; return q('percent-error', difficulty, `The actual value is ${actual} and the measured value is ${measured}. What is the percent error?`, `${p.percent}%`, { ...p, actual, measured }, [`${p.percent / 5}%`, `${p.percent * 2}%`, `${p.percent + 1}%`, `${p.percent + 5}%`]) }
export function generateMultiStepPercentProblemQuestion(difficulty: Difficulty) { const p = facts(difficulty); const afterDiscount = p.amountCents - percentOf(p.amountCents, p.percent); const answer = afterDiscount + percentOf(afterDiscount, p.secondPercent); return q('multi-step-percent-problem', difficulty, `An item costs ${money(p.amountCents)}, is discounted ${p.percent}%, then taxed ${p.secondPercent}%. What is the final price?`, money(answer), p, [money(afterDiscount), money(p.amountCents + percentOf(p.amountCents, p.secondPercent)), money(p.amountCents - percentOf(p.amountCents, p.percent - p.secondPercent)), money(answer + 100)]) }
export const GRADE7_MATH_UNIT5_GENERATORS = { 'percent-increase-decrease': generatePercentIncreaseDecreaseQuestion, 'discount-markup': generateDiscountMarkupQuestion, 'tax-tip': generateTaxTipQuestion, 'simple-interest': generateSimpleInterestQuestion, 'percent-error': generatePercentErrorQuestion, 'multi-step-percent-problem': generateMultiStepPercentProblemQuestion } satisfies Record<Grade7MathUnit5ItemType, CurriculumGenerator<Grade7MathUnit5Question>>
export function generateGrade7MathUnit5Question<T extends Grade7MathUnit5ItemType>(itemType: T, difficulty: Difficulty): Extract<Grade7MathUnit5Question, { itemType: T }> { return GRADE7_MATH_UNIT5_GENERATORS[itemType](difficulty) as Extract<Grade7MathUnit5Question, { itemType: T }> }
