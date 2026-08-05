import { expect } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'

export const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const cash = (cents: bigint) => { const sign = cents < 0n ? '-' : ''; const absolute = cents < 0n ? -cents : cents; return `${sign}$${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}` }
const toCents = (text: string) => { const negative = text.startsWith('-'); const [d, c] = text.replace(/[-$]/g, '').split('.'); const value = BigInt(d) * 100n + BigInt(c); return negative ? -value : value }
/** Independent rational evaluation: exponentiation by squaring plus a remainder-based final rounding rule. */
const compound = (p: bigint, bps: bigint, years: bigint, n: bigint) => {
  const power = (base: bigint, exponent: bigint) => { let result = 1n; let factor = base; let remaining = exponent; while (remaining > 0n) { if (remaining % 2n) result *= factor; factor *= factor; remaining /= 2n } return result }
  const periods = years * n; const numerator = p * power(10_000n * n + bps, periods); const denominator = power(10_000n * n, periods); const whole = numerator / denominator
  return whole + (2n * (numerator % denominator) >= denominator ? 1n : 0n)
}
const rateBasisPoints = (text: string) => { const [whole, fraction = ''] = text.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2)) }

/** Nine computational types are independently re-derived only from rendered prompts. */
export function renderedFinLitOracle(prompt: string): string {
  let m = /gross pay is (\$\d+\.\d\d).*deductions total (\$\d+\.\d\d).*net pay/.exec(prompt); if (m) return cash(toCents(m[1]) - toCents(m[2]))
  m = /(\d+)-pack costs (\$\d+\.\d\d).*price per item/.exec(prompt); if (m) return cash(toCents(m[2]) / BigInt(m[1]))
  m = /subscription costs (\$\d+\.\d\d).*for (\d+) months.*total cost/.exec(prompt); if (m) return cash(toCents(m[1]) * BigInt(m[2]))
  m = /income of (\$\d+\.\d\d).*expenses of (\$-?\d+\.\d\d).*cash flow/.exec(prompt); if (m) return cash(toCents(m[1]) - toCents(m[2]))
  m = /saves (\$\d+\.\d\d) each month for (\d+) months.*much will be saved/.exec(prompt); if (m) return cash(toCents(m[1]) * BigInt(m[2]))
  m = /principal (\$\d+\.\d\d), simple annual interest of (\d+)%.* (\d+)-month term.*total is repaid/.exec(prompt); if (m) { const p = toCents(m[1]), bps = BigInt(m[2]) * 100n, months = BigInt(m[3]); return cash(p + p * bps * months / (10_000n * 12n)) }
  m = /starts with (\$\d+\.\d\d) at (\d+(?:\.\d+)?)% annual interest, compounded (once per year|four times per year), for (\d+) year.*ending balance/.exec(prompt); if (m) return cash(compound(toCents(m[1]), rateBasisPoints(m[2]), BigInt(m[4]), m[3] === 'once per year' ? 1n : 4n))
  m = /item costs (\$\d+\.\d\d) and sales tax is (\d+)%.*total after tax/.exec(prompt); if (m) { const p = toCents(m[1]); return cash(p + p * BigInt(m[2]) / 100n) }
  m = /financial goal is (\$\d+\.\d\d).*already saved (\$\d+\.\d\d).*much remains/.exec(prompt); if (m) return cash(toCents(m[1]) - toCents(m[2]))
  return constantAnswerFromPrompt(prompt)
}

/** The other 27 lesson-record concept types are checked against explicit response rules, not claimed as arithmetic oracles. */
export function constantAnswerFromPrompt(prompt: string): string {
  if (prompt.includes('income source?')) return prompt.includes('birthday gift') || prompt.includes('reimbursement') ? 'no' : 'yes'
  if (prompt.includes('best builds the work skill')) return `practice ${/skill of (.*)\?/.exec(prompt)![1]}`
  if (prompt.includes('per week and also provides')) return 'a benefit'
  if (prompt.includes('This is what?')) return prompt.includes('scheduled shifts') || prompt.includes('fixed wage') ? 'not entrepreneurship' : 'entrepreneurship'
  if (prompt.includes('This is a workplace what?')) return prompt.includes('paid for every hour') || prompt.includes('safe workplace') ? 'right' : 'responsibility'
  if (prompt.includes('opportunity cost?')) return 'the concert ticket'
  if (prompt.includes('advertisement')) return 'an influence tactic'
  if (prompt.includes('renews automatically')) return 'read the renewal terms'
  if (prompt.includes('message claims you won')) return 'do not share the password'
  if (prompt.includes('best classified')) return prompt.includes('monthly rent') ? 'fixed expense' : prompt.includes('grocery') ? 'variable expense' : 'periodic expense'
  if (prompt.includes('household sets aside')) return 'an emergency'
  if (prompt.includes('banking service')) return 'savings account'
  if (prompt.includes('actual cost becomes')) return 'revise the budget with the new cost'
  if (prompt.includes('What is the $') && prompt.includes('called?')) return 'principal'
  if (prompt.includes('history of using credit')) return 'credit report'
  if (prompt.includes('loan is backed by')) return 'secured debt'
  if (prompt.includes('Before accepting fictional')) return 'compare the terms and repayment obligations'
  if (prompt.includes('A lender advertises')) return 'a predatory-lending warning sign'
  if (prompt.includes('next month')) return 'saving in an accessible account'
  if (prompt.includes('factor should guide')) return 'the time horizon'
  if (prompt.includes('putting all')) return 'diversification'
  if (prompt.includes('insurance mainly intended')) return 'protection from covered financial risk'
  if (prompt.includes('message about')) return 'do not share personal account information'
  if (prompt.includes('One reason taxes')) return 'public services'
  if (prompt.includes('This is an example of what?')) return 'a public good'
  if (prompt.includes('sets aside')) return 'charitable giving'
  if (prompt.includes('hides an important fee')) return 'disclose the fee and reconsider the decision'
  throw new Error(`No independent oracle pattern for: ${prompt}`)
}
export function runSixHundred<T extends string>(types: readonly T[], generate: (type: T, difficulty: 1 | 2 | 3) => { prompt: string; choices: string[]; answerIndex: number }): void {
  for (const [index, type] of types.entries()) {
    setRng(seeded(0x17f100 + index))
    const prompts: string[] = []
    for (const difficulty of [1, 2, 3] as const) for (let run = 0; run < 200; run++) {
      const question = generate(type, difficulty); prompts.push(question.prompt)
      expect(curriculumAnswer(question)).toBe(renderedFinLitOracle(question.prompt))
      expect(question.choices).toHaveLength(4); expect(new Set(question.choices).size).toBe(4); expect(question.choices[question.answerIndex]).toBeDefined()
    }
    expect(new Set(prompts).size, `${type} needs a meaningful variety floor`).toBeGreaterThanOrEqual(300)
  }
  for (let seed = 0x1720; seed < 0x1730; seed++) {
    setRng(seeded(seed))
    const run = Array.from({ length: 20 }, (_, index) => generate(types[index % types.length], ((index % 3) + 1) as 1 | 2 | 3).prompt)
    expect(new Set(run).size, `seed ${seed}: a 20-item unit run must not repeat a concept-response prompt verbatim`).toBe(20)
  }
  setRng(null)
}
