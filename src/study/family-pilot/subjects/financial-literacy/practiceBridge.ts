import type { AcademyGrade, Difficulty } from '../../../../types'
import type { CurriculumQuestion } from '../../../../curriculum/generatorCore'

import {
  GRADE5_FIN_LIT_UNIT1_ITEM_TYPES,
  generateGrade5FinLitUnit1Question,
} from '../../../../curriculum/grade5FinLitUnit1Generator'
import {
  GRADE5_FIN_LIT_UNIT2_ITEM_TYPES,
  generateGrade5FinLitUnit2Question,
} from '../../../../curriculum/grade5FinLitUnit2Generator'
import {
  GRADE5_FIN_LIT_UNIT3_ITEM_TYPES,
  generateGrade5FinLitUnit3Question,
} from '../../../../curriculum/grade5FinLitUnit3Generator'
import {
  GRADE5_FIN_LIT_UNIT4_ITEM_TYPES,
  generateGrade5FinLitUnit4Question,
} from '../../../../curriculum/grade5FinLitUnit4Generator'
import {
  GRADE5_FIN_LIT_UNIT5_ITEM_TYPES,
  generateGrade5FinLitUnit5Question,
} from '../../../../curriculum/grade5FinLitUnit5Generator'
import {
  GRADE5_FIN_LIT_UNIT6_ITEM_TYPES,
  generateGrade5FinLitUnit6Question,
} from '../../../../curriculum/grade5FinLitUnit6Generator'

import {
  GRADE7_FINLIT_UNIT1_ITEM_TYPES,
  generateGrade7FinLitUnit1Question,
} from '../../../../curriculum/grade7FinLitUnit1Generator'
import {
  GRADE7_FINLIT_UNIT2_ITEM_TYPES,
  generateGrade7FinLitUnit2Question,
} from '../../../../curriculum/grade7FinLitUnit2Generator'
import {
  GRADE7_FINLIT_UNIT3_ITEM_TYPES,
  generateGrade7FinLitUnit3Question,
} from '../../../../curriculum/grade7FinLitUnit3Generator'
import {
  GRADE7_FINLIT_UNIT4_ITEM_TYPES,
  generateGrade7FinLitUnit4Question,
} from '../../../../curriculum/grade7FinLitUnit4Generator'
import {
  GRADE7_FINLIT_UNIT5_ITEM_TYPES,
  generateGrade7FinLitUnit5Question,
} from '../../../../curriculum/grade7FinLitUnit5Generator'
import {
  GRADE7_FINLIT_UNIT6_ITEM_TYPES,
  generateGrade7FinLitUnit6Question,
} from '../../../../curriculum/grade7FinLitUnit6Generator'

import { generateNetPayQuestion } from '../../../../curriculum/grade8FinLitUnit3Generator'
import { generateTotalCostComparisonQuestion } from '../../../../curriculum/grade8FinLitUnit9Generator'
import { generateBudgetBalanceQuestion } from '../../../../curriculum/grade8FinLitUnit1Generator'
import { generateAccountReconciliationQuestion } from '../../../../curriculum/grade8FinLitUnit2Generator'
import { generateCreditInterestQuestion } from '../../../../curriculum/grade8FinLitUnit4Generator'
import { generateAmortizedLoanInterestQuestion } from '../../../../curriculum/grade8FinLitUnit5Generator'
import { generateCompoundGrowthQuestion } from '../../../../curriculum/grade8FinLitUnit7Generator'
import { generateInsuranceOutOfPocketQuestion } from '../../../../curriculum/grade8FinLitUnit6Generator'
import { generateFinancialPlanSurplusQuestion } from '../../../../curriculum/grade8FinLitUnit10Generator'

// grade8FinLitUnit8Generator.ts (generateInflationAdjustedPriceQuestion) is a
// reviewed generator that exists but is deliberately NOT bridged here: its
// "purchasing power" content does not clearly belong to any single PF1-PF7
// unit (candidates were PF2 Buying and PF5 Investing, and neither was a clean
// fit), so no unit claims it. Per the mission, a generator existing is not
// license to force a match — an ambiguous fit is treated the same as no
// generator at all: practiceForUnit returns 'unsupported'.

/**
 * FAMILY-PILOT-FINLIT-1 — the practice-generator bridge.
 *
 * Grade 5 and Grade 7 each ship exactly one generator file per curriculum
 * unit, numbered 1..6 in lockstep with the course's own unit_number (verified
 * against curriculum-content grade-{5,7} units.json and each generator's own
 * lessonFocus/standard text) — so those two grades bridge by direct position.
 *
 * Grade 8 does not: it ships 10 single-item-type generator files that were
 * authored independently of the course's PF1-PF7 unit numbering (file
 * "Unit1" is not PF unit 1 — see below). Each of the 10 was reviewed against
 * its own lessonFocus/prompt text and matched to the PF unit it actually
 * teaches:
 *   PF1 Earning Income            <- Unit3  (net-pay: reading a paycheck)
 *   PF2 Buying Goods and Services <- Unit9  (total-cost-comparison)
 *   PF3 Budgeting and Saving      <- Unit1  (budget-balance), Unit2 (account-reconciliation)
 *   PF4 Using Credit              <- Unit4  (credit-interest), Unit5 (amortized-loan-interest)
 *   PF5 Financial Investing       <- Unit7  (compound-growth)
 *   PF6 Protecting and Insuring   <- Unit6  (insurance-out-of-pocket)
 *   PF7 Taxes and Plan Capstone   <- Unit10 (financial-plan-surplus, includes a taxes line item)
 * Unit8 (inflation-adjusted-price) is not bridged — see the note above.
 *
 * Reviewed generators may supply ungraded practice; they never advance
 * official curriculum state themselves — only the Study adapter
 * (studyAdapter.ts) writes anything through the Study Engine, and it never
 * reads a generator's answer to do so.
 */

type Generate = (itemType: string, difficulty: Difficulty) => CurriculumQuestion<string, unknown>

interface UnitGenerators {
  readonly itemTypes: readonly string[]
  readonly generate: Generate
}

function single(itemTypes: readonly string[], generate: Generate): UnitGenerators {
  return { itemTypes, generate }
}

function byItemType(entries: ReadonlyArray<{ readonly itemType: string; readonly generate: (difficulty: Difficulty) => CurriculumQuestion<string, unknown> }>): UnitGenerators {
  const byType = new Map(entries.map((entry) => [entry.itemType, entry.generate]))
  return {
    itemTypes: entries.map((entry) => entry.itemType),
    generate: (itemType, difficulty) => {
      const generate = byType.get(itemType)
      if (!generate) throw new Error(`No financial-literacy generator for item type ${itemType}`)
      return generate(difficulty)
    },
  }
}

const GRADE5_UNITS: Readonly<Record<number, UnitGenerators>> = {
  1: single(GRADE5_FIN_LIT_UNIT1_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit1Question(type as never, d)),
  2: single(GRADE5_FIN_LIT_UNIT2_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit2Question(type as never, d)),
  3: single(GRADE5_FIN_LIT_UNIT3_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit3Question(type as never, d)),
  4: single(GRADE5_FIN_LIT_UNIT4_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit4Question(type as never, d)),
  5: single(GRADE5_FIN_LIT_UNIT5_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit5Question(type as never, d)),
  6: single(GRADE5_FIN_LIT_UNIT6_ITEM_TYPES, (type, d) => generateGrade5FinLitUnit6Question(type as never, d)),
}

const GRADE7_UNITS: Readonly<Record<number, UnitGenerators>> = {
  1: single(GRADE7_FINLIT_UNIT1_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit1Question(type as never, d)),
  2: single(GRADE7_FINLIT_UNIT2_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit2Question(type as never, d)),
  3: single(GRADE7_FINLIT_UNIT3_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit3Question(type as never, d)),
  4: single(GRADE7_FINLIT_UNIT4_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit4Question(type as never, d)),
  5: single(GRADE7_FINLIT_UNIT5_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit5Question(type as never, d)),
  6: single(GRADE7_FINLIT_UNIT6_ITEM_TYPES, (type, d) => generateGrade7FinLitUnit6Question(type as never, d)),
}

const GRADE8_UNITS: Readonly<Record<number, UnitGenerators>> = {
  1: byItemType([{ itemType: 'net-pay', generate: generateNetPayQuestion }]),
  2: byItemType([{ itemType: 'total-cost-comparison', generate: generateTotalCostComparisonQuestion }]),
  3: byItemType([
    { itemType: 'budget-balance', generate: generateBudgetBalanceQuestion },
    { itemType: 'account-reconciliation', generate: generateAccountReconciliationQuestion },
  ]),
  4: byItemType([
    { itemType: 'credit-interest', generate: generateCreditInterestQuestion },
    { itemType: 'amortized-loan-interest', generate: generateAmortizedLoanInterestQuestion },
  ]),
  5: byItemType([{ itemType: 'compound-growth', generate: generateCompoundGrowthQuestion }]),
  6: byItemType([{ itemType: 'insurance-out-of-pocket', generate: generateInsuranceOutOfPocketQuestion }]),
  7: byItemType([{ itemType: 'financial-plan-surplus', generate: generateFinancialPlanSurplusQuestion }]),
}

const UNITS_BY_GRADE: Readonly<Record<AcademyGrade, Readonly<Record<number, UnitGenerators>>>> = {
  '5': GRADE5_UNITS,
  '7': GRADE7_UNITS,
  '8': GRADE8_UNITS,
}

export interface FinLitPracticeAvailable {
  readonly status: 'available'
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly itemTypes: readonly string[]
  readonly generate: (itemType: string, difficulty: Difficulty) => CurriculumQuestion<string, unknown>
}

export interface FinLitPracticeUnsupported {
  readonly status: 'unsupported'
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly reason: string
}

export type FinLitPracticeAvailability = FinLitPracticeAvailable | FinLitPracticeUnsupported

/** Whether a reviewed generator is bridged for this grade+unit. Never
 * invents practice: an unmatched unit reports 'unsupported' rather than
 * fabricating a generator or forcing an unrelated one to fit. */
export function practiceForUnit(grade: AcademyGrade, unitNumber: number): FinLitPracticeAvailability {
  const unit = UNITS_BY_GRADE[grade]?.[unitNumber]
  if (!unit) {
    return {
      status: 'unsupported',
      grade,
      unitNumber,
      reason: `No reviewed financial-literacy generator is bridged for grade ${grade} unit ${unitNumber}.`,
    }
  }
  return { status: 'available', grade, unitNumber, itemTypes: unit.itemTypes, generate: unit.generate }
}
