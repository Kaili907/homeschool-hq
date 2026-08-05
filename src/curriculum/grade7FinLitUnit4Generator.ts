import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { cents, example, finLitQuestion, money, pct, simpleInterestCents, type FinLitDefinition, type FinLitQuestion } from './grade7FinLitCore'
import type { CurriculumGenerator } from './generatorCore'

/** Derived only from source lessons U4 l01-l06. Loan items use integer cents and explicitly state simple interest. */
export const GRADE7_FINLIT_UNIT4_ITEM_TYPES = ['principal-interest-term','credit-reports','simple-loan-payment','secured-debt','student-aid','predatory-lending'] as const
export type Grade7FinLitUnit4ItemType = typeof GRADE7_FINLIT_UNIT4_ITEM_TYPES[number]
type P = { principalCents: bigint; annualBasisPoints: bigint; months: bigint }
export type Grade7FinLitUnit4Question = FinLitQuestion<Grade7FinLitUnit4ItemType, P>
const defs = {
  'principal-interest-term': { standard: 'PF4 foundations', lessonFocus: 'principal interest and term', workedExample: example('Borrow $100.00. The borrowed amount is?', '$100.00', ['Principal is the amount borrowed.']) },
  'credit-reports': { standard: 'PF4 foundations', lessonFocus: 'credit reports and scores concepts', workedExample: example('A credit report records credit information.', 'credit report', ['It is not a bank balance.']) },
  'simple-loan-payment': { standard: 'PF4 foundations', lessonFocus: 'minimum payments', workedExample: example('Simple interest on $120.00 at 12% for 1 year?', '$14.40', ['Use principal × rate × time.']) },
  'secured-debt': { standard: 'PF4 foundations', lessonFocus: 'secured and unsecured debt', workedExample: example('A loan backed by a car is?', 'secured debt', ['Collateral secures the loan.']) },
  'student-aid': { standard: 'PF4 foundations', lessonFocus: 'student-aid introduction', workedExample: example('Aid should be compared before accepting.', 'compare terms', ['Costs and obligations can differ.']) },
  'predatory-lending': { standard: 'PF4 foundations', lessonFocus: 'predatory lending and scams', workedExample: example('A lender hides a fee.', 'warning sign', ['Pause and seek trusted adult help.']) },
} as const satisfies Record<Grade7FinLitUnit4ItemType, FinLitDefinition>
export function generateGrade7FinLitUnit4Question(type: Grade7FinLitUnit4ItemType, difficulty: Difficulty): Grade7FinLitUnit4Question {
  const principalCents = BigInt(ri(120, 900 + difficulty * 300) * 100); const annualBasisPoints = pick([1200n, 2400n, 3600n] as const); const months = pick([6n, 12n] as const); const interest = simpleInterestCents(principalCents, annualBasisPoints, months); let prompt: string; let answer: string; let distractors: string[]
  if (type === 'principal-interest-term') { const purpose = pick(['a used bicycle','a laptop','a repair','a training course'] as const); prompt = `A fictional borrower receives ${money(principalCents)} for ${purpose} and agrees to repay it over ${months} months. What is the ${money(principalCents)} called?`; answer = 'principal'; distractors = ['interest','term','deduction','benefit'] }
  else if (type === 'credit-reports') { const action = pick(['applying for a card','requesting a loan','checking an auto loan','leasing equipment'] as const); prompt = `Which record may summarize a fictional borrower’s history of using credit after ${action} for ${money(principalCents)}?`; answer = 'credit report'; distractors = ['savings account','paycheck','advertisement','receipt'] }
  else if (type === 'simple-loan-payment') { const total = principalCents + interest; prompt = `A fictional loan has principal ${money(principalCents)}, simple annual interest of ${pct(Number(annualBasisPoints))}, and a ${months}-month term. Interest is calculated once on the principal; no periodic rounding is used. What total is repaid?`; answer = money(total); distractors = [money(principalCents), money(principalCents + interest + 100n), money(principalCents + interest - 100n), money(interest)] }
  else if (type === 'secured-debt') { const collateral = pick(['a vehicle','a bicycle','work equipment','a savings certificate'] as const); prompt = `A fictional ${money(principalCents)} loan is backed by ${collateral} the lender may take if payments are not made. What kind of debt is it?`; answer = 'secured debt'; distractors = ['unsecured debt','a benefit','a subscription','a tax'] }
  else if (type === 'student-aid') { const aid = pick(['a student loan','a grant offer','a scholarship package','a work-study offer'] as const); prompt = `Before accepting fictional ${aid} of ${money(principalCents)}, what is the safest step?`; answer = 'compare the terms and repayment obligations'; distractors = ['accept without reading','share account credentials','ignore interest','assume all aid is identical'] }
  else { const warning = pick(['refuses to state the total cost','hides a required fee','pressures immediate acceptance','will not state the repayment term'] as const); prompt = `A lender advertises ${money(principalCents)} but ${warning}. This is best treated as what?`; answer = 'a predatory-lending warning sign'; distractors = ['a guaranteed bargain','a benefit','a savings plan','a credit report'] }
  return finLitQuestion(type, difficulty, defs[type], prompt, answer, { principalCents, annualBasisPoints, months }, distractors)
}
export const GRADE7_FINLIT_UNIT4_GENERATORS = Object.fromEntries(GRADE7_FINLIT_UNIT4_ITEM_TYPES.map(type => [type, (d: Difficulty) => generateGrade7FinLitUnit4Question(type, d)])) as Record<Grade7FinLitUnit4ItemType, CurriculumGenerator<Grade7FinLitUnit4Question>>
