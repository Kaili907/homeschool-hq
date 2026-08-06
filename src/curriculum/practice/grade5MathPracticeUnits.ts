import type { Difficulty } from '../../types'
import type { CurriculumQuestion } from '../generatorCore'
import {
  GRADE5_MATH_UNIT1_ITEM_TYPES,
  generateGrade5MathUnit1Question,
  type Grade5MathUnit1ItemType,
} from '../grade5MathUnit1Generator'
import {
  GRADE5_MATH_UNIT2_ITEM_TYPES,
  generateGrade5MathUnit2Question,
  type Grade5MathUnit2ItemType,
} from '../grade5MathUnit2Generator'
import {
  GRADE5_MATH_UNIT3_ITEM_TYPES,
  generateGrade5MathUnit3Question,
  type Grade5MathUnit3ItemType,
} from '../grade5MathUnit3Generator'
import {
  GRADE5_MATH_UNIT4_ITEM_TYPES,
  generateGrade5MathUnit4Question,
  type Grade5MathUnit4ItemType,
} from '../grade5MathUnit4Generator'
import {
  GRADE5_MATH_UNIT5_ITEM_TYPES,
  generateGrade5MathUnit5Question,
  type Grade5MathUnit5ItemType,
} from '../grade5MathUnit5Generator'
import {
  GRADE5_MATH_UNIT6_ITEM_TYPES,
  generateGrade5MathUnit6Question,
  type Grade5MathUnit6ItemType,
} from '../grade5MathUnit6Generator'
import {
  GRADE5_MATH_UNIT7_ITEM_TYPES,
  generateGrade5MathUnit7Question,
  type Grade5MathUnit7ItemType,
} from '../grade5MathUnit7Generator'
import {
  GRADE5_MATH_UNIT8_ITEM_TYPES,
  generateGrade5MathUnit8Question,
  type Grade5MathUnit8ItemType,
} from '../grade5MathUnit8Generator'
import {
  GRADE5_MATH_UNIT9_ITEM_TYPES,
  generateGrade5MathUnit9Question,
  type Grade5MathUnit9ItemType,
} from '../grade5MathUnit9Generator'
import {
  GRADE5_MATH_UNIT10_ITEM_TYPES,
  generateGrade5MathUnit10Question,
  type Grade5MathUnit10ItemType,
} from '../grade5MathUnit10Generator'

/**
 * MOUNT-G5-MATH — the ten reviewed Grade 5 math unit generators, merged behind
 * one shape the practice surface can iterate. Each unit keeps its own item-type
 * union and its own dispatcher; only the union is erased here, so the strings,
 * choices, answer index, and worked example the generator produced reach the
 * screen exactly as authored (no re-formatting, no numeric round-trip).
 */
export type Grade5MathPracticeQuestion = CurriculumQuestion<string, unknown>

export interface Grade5MathPracticeUnit {
  readonly unitNumber: number
  /** Course unit title from the Manuel Academy Grade 5 mathematics unit index. */
  readonly title: string
  readonly itemTypes: readonly string[]
  /** `itemType` must come from this unit's own `itemTypes`. */
  readonly generate: (itemType: string, difficulty: Difficulty) => Grade5MathPracticeQuestion
}

export const GRADE5_MATH_PRACTICE_UNITS: readonly Grade5MathPracticeUnit[] = [
  {
    unitNumber: 1,
    title: 'Mathematical Habits and Whole-Number Reasoning',
    itemTypes: GRADE5_MATH_UNIT1_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit1Question(itemType as Grade5MathUnit1ItemType, difficulty),
  },
  {
    unitNumber: 2,
    title: 'Place Value, Powers of Ten, and Decimals',
    itemTypes: GRADE5_MATH_UNIT2_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit2Question(itemType as Grade5MathUnit2ItemType, difficulty),
  },
  {
    unitNumber: 3,
    title: 'Multi-Digit Multiplication',
    itemTypes: GRADE5_MATH_UNIT3_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit3Question(itemType as Grade5MathUnit3ItemType, difficulty),
  },
  {
    unitNumber: 4,
    title: 'Division and Numerical Expressions',
    itemTypes: GRADE5_MATH_UNIT4_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit4Question(itemType as Grade5MathUnit4ItemType, difficulty),
  },
  {
    unitNumber: 5,
    title: 'Adding and Subtracting Fractions',
    itemTypes: GRADE5_MATH_UNIT5_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit5Question(itemType as Grade5MathUnit5ItemType, difficulty),
  },
  {
    unitNumber: 6,
    title: 'Multiplying Fractions and Scaling',
    itemTypes: GRADE5_MATH_UNIT6_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit6Question(itemType as Grade5MathUnit6ItemType, difficulty),
  },
  {
    unitNumber: 7,
    title: 'Decimal Operations',
    itemTypes: GRADE5_MATH_UNIT7_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit7Question(itemType as Grade5MathUnit7ItemType, difficulty),
  },
  {
    unitNumber: 8,
    title: 'Measurement, Data, and Volume',
    itemTypes: GRADE5_MATH_UNIT8_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit8Question(itemType as Grade5MathUnit8ItemType, difficulty),
  },
  {
    unitNumber: 9,
    title: 'Geometry and the Coordinate Plane',
    itemTypes: GRADE5_MATH_UNIT9_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit9Question(itemType as Grade5MathUnit9ItemType, difficulty),
  },
  {
    unitNumber: 10,
    title: 'Integrated Modeling and Capstone',
    itemTypes: GRADE5_MATH_UNIT10_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade5MathUnit10Question(itemType as Grade5MathUnit10ItemType, difficulty),
  },
]

export function grade5MathPracticeUnit(unitNumber: number): Grade5MathPracticeUnit | undefined {
  return GRADE5_MATH_PRACTICE_UNITS.find((unit) => unit.unitNumber === unitNumber)
}

/** Questions in one practice round. */
export const GRADE5_MATH_PRACTICE_ITEM_COUNT = 10

/**
 * Every round runs at difficulty 1. Difficulty is a generator PARAMETER, not a
 * generator decision, and choosing it from a learner's history would be the
 * adaptive sequencing this card deliberately excludes: the placement data that
 * would justify a harder tier does not exist yet.
 */
export const GRADE5_MATH_PRACTICE_DIFFICULTY: Difficulty = 1

/**
 * Round-robin over the unit's own item types — even coverage of everything the
 * unit teaches, in the order the unit declares it. No inference, no selection
 * from past answers.
 */
export function grade5MathPracticeItemType(unit: Grade5MathPracticeUnit, index: number): string {
  return unit.itemTypes[index % unit.itemTypes.length]
}

export function generateGrade5MathPracticeItem(
  unit: Grade5MathPracticeUnit,
  index: number,
): Grade5MathPracticeQuestion {
  return unit.generate(grade5MathPracticeItemType(unit, index), GRADE5_MATH_PRACTICE_DIFFICULTY)
}

/**
 * The per-unit key results are tallied under in the existing practice-stat
 * store (Profile.hsStats via hs/hsState.recordHsAnswer). Namespaced so a Grade 5
 * curriculum unit can never collide with a high-school unit id.
 */
export function grade5MathPracticeUnitKey(unitNumber: number): string {
  return `g5-math-u${String(unitNumber).padStart(2, '0')}`
}
