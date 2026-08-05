import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { cents, example, finLitQuestion, money, type FinLitDefinition, type FinLitQuestion } from './grade7FinLitCore'
import type { CurriculumGenerator } from './generatorCore'

/** Derived only from source lessons U3 l01-l06: cash flow through budget revision. */
export const GRADE7_FINLIT_UNIT3_ITEM_TYPES = ['cash-flow','expense-types','emergency-savings','goal-based-saving','banking-services','budget-revision'] as const
export type Grade7FinLitUnit3ItemType = typeof GRADE7_FINLIT_UNIT3_ITEM_TYPES[number]
type P = { incomeCents: bigint; expenseCents: bigint; months: number }
export type Grade7FinLitUnit3Question = FinLitQuestion<Grade7FinLitUnit3ItemType, P>
const defs = {
  'cash-flow': { standard: 'PF3 foundations', lessonFocus: 'cash flow', workedExample: example('Income $20.00; expenses $12.00.', '$8.00', ['Subtract expenses from income.']) },
  'expense-types': { standard: 'PF3 foundations', lessonFocus: 'fixed variable and periodic expenses', workedExample: example('A monthly bus pass has the same price each month.', 'fixed expense', ['Fixed means the amount is predictable.']) },
  'emergency-savings': { standard: 'PF3 foundations', lessonFocus: 'emergency savings concept', workedExample: example('A surprise repair is an emergency expense.', 'emergency savings', ['Set aside money for unexpected costs.']) },
  'goal-based-saving': { standard: 'PF3 foundations', lessonFocus: 'goal-based saving', workedExample: example('Save $5 for 4 months.', '$20.00', ['Multiply monthly cents by months.']) },
  'banking-services': { standard: 'PF3 foundations', lessonFocus: 'banking services', workedExample: example('A savings account can hold money safely.', 'savings account', ['Match the service to its purpose.']) },
  'budget-revision': { standard: 'PF3 foundations', lessonFocus: 'budget revision', workedExample: example('An expense rises, so update the plan.', 'revise the budget', ['Use the new facts.']) },
} as const satisfies Record<Grade7FinLitUnit3ItemType, FinLitDefinition>
export function generateGrade7FinLitUnit3Question(type: Grade7FinLitUnit3ItemType, difficulty: Difficulty): Grade7FinLitUnit3Question {
  const incomeCents = cents(100, 700 + difficulty * 100); const expenseCents = cents(20, 90); const months = ri(2, 10 + difficulty); let prompt: string; let answer: string; let distractors: string[]
  if (type === 'cash-flow') { const totalExpense = expenseCents * BigInt(months); prompt = `A fictional monthly budget has income of ${money(incomeCents)} and expenses of ${money(totalExpense)}. What is the cash flow?`; answer = money(incomeCents - totalExpense); distractors = [money(incomeCents + totalExpense), money(totalExpense), money(incomeCents - totalExpense + 100n), money(incomeCents - totalExpense - 100n)] }
  else if (type === 'expense-types') { const label = pick(['a monthly rent payment','a changing grocery total','an annual club fee'] as const); const answerByLabel = label === 'a monthly rent payment' ? 'fixed expense' : label === 'a changing grocery total' ? 'variable expense' : 'periodic expense'; prompt = `In a fictional budget, ${label} of ${money(expenseCents)} is best classified as what?`; answer = answerByLabel; distractors = ['fixed expense','variable expense','periodic expense','income'].filter(x => x !== answer) }
  else if (type === 'emergency-savings') { const event = pick(['a surprise car repair','an urgent home repair','a broken essential appliance','an unexpected medical copay'] as const); prompt = `A fictional household sets aside ${money(expenseCents)} for ${event} rather than a planned purchase. This money is intended for what?`; answer = 'an emergency'; distractors = ['a subscription','a deduction','a credit score','advertising'] }
  else if (type === 'goal-based-saving') { prompt = `A learner saves ${money(expenseCents)} each month for ${months} months toward a goal. How much will be saved?`; answer = money(expenseCents * BigInt(months)); distractors = [money(expenseCents * BigInt(months - 1)), money(expenseCents + BigInt(months) * 100n), money(expenseCents), money(expenseCents * BigInt(months + 1))] }
  else if (type === 'banking-services') { const goal = pick(['a school trip','a replacement bicycle','a future course','an emergency fund'] as const); prompt = `Which banking service is designed to hold ${money(incomeCents)} for ${goal}?`; answer = 'savings account'; distractors = ['loan','credit report','advertisement','subscription'] }
  else { const category = pick(['supplies','transportation','utilities','a planned activity'] as const); prompt = `A budget planned ${money(expenseCents)} for ${category}, but the actual cost becomes ${money(expenseCents + 500n)}. What is the best next step?`; answer = 'revise the budget with the new cost'; distractors = ['ignore the change','share an account password','borrow without comparing','keep the old total'] }
  return finLitQuestion(type, difficulty, defs[type], prompt, answer, { incomeCents, expenseCents, months }, distractors)
}
export const GRADE7_FINLIT_UNIT3_GENERATORS = Object.fromEntries(GRADE7_FINLIT_UNIT3_ITEM_TYPES.map(type => [type, (d: Difficulty) => generateGrade7FinLitUnit3Question(type, d)])) as Record<Grade7FinLitUnit3ItemType, CurriculumGenerator<Grade7FinLitUnit3Question>>
