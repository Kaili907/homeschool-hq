import type { AcademyGrade, Difficulty } from '../../../types'
import type { CurriculumQuestion } from '../../../curriculum/generatorCore'
import { GRADE5_MATH_PRACTICE_UNITS } from '../../../curriculum/practice/grade5MathPracticeUnits'

import {
  GRADE7_MATH_UNIT1_ITEM_TYPES,
  generateGrade7MathUnit1Question,
  type Grade7MathUnit1ItemType,
} from '../../../curriculum/grade7MathUnit1Generator'
import {
  GRADE7_MATH_UNIT2_ITEM_TYPES,
  generateGrade7MathUnit2Question,
  type Grade7MathUnit2ItemType,
} from '../../../curriculum/grade7MathUnit2Generator'
import {
  GRADE7_MATH_UNIT3_ITEM_TYPES,
  generateGrade7MathUnit3Question,
  type Grade7MathUnit3ItemType,
} from '../../../curriculum/grade7MathUnit3Generator'
import {
  GRADE7_MATH_UNIT4_ITEM_TYPES,
  generateGrade7MathUnit4Question,
  type Grade7MathUnit4ItemType,
} from '../../../curriculum/grade7MathUnit4Generator'
import {
  GRADE7_MATH_UNIT5_ITEM_TYPES,
  generateGrade7MathUnit5Question,
  type Grade7MathUnit5ItemType,
} from '../../../curriculum/grade7MathUnit5Generator'
import {
  GRADE7_MATH_UNIT6_ITEM_TYPES,
  generateGrade7MathUnit6Question,
  type Grade7MathUnit6ItemType,
} from '../../../curriculum/grade7MathUnit6Generator'
import {
  GRADE7_MATH_UNIT7_ITEM_TYPES,
  generateGrade7MathUnit7Question,
  type Grade7MathUnit7ItemType,
} from '../../../curriculum/grade7MathUnit7Generator'
import {
  GRADE7_MATH_UNIT8_ITEM_TYPES,
  generateGrade7MathUnit8Question,
  type Grade7MathUnit8ItemType,
} from '../../../curriculum/grade7MathUnit8Generator'
import {
  GRADE7_MATH_UNIT9_ITEM_TYPES,
  generateGrade7MathUnit9Question,
  type Grade7MathUnit9ItemType,
} from '../../../curriculum/grade7MathUnit9Generator'
import {
  GRADE7_MATH_UNIT10_ITEM_TYPES,
  generateGrade7MathUnit10Question,
  type Grade7MathUnit10ItemType,
} from '../../../curriculum/grade7MathUnit10Generator'

import {
  GRADE8_MATH_UNIT1_ITEM_TYPES,
  generateGrade8MathUnit1Question,
  type Grade8MathUnit1ItemType,
} from '../../../curriculum/grade8MathUnit1Generator'
import {
  GRADE8_MATH_UNIT2_ITEM_TYPES,
  generateGrade8MathUnit2Question,
  type Grade8MathUnit2ItemType,
} from '../../../curriculum/grade8MathUnit2Generator'
import {
  GRADE8_MATH_UNIT3_ITEM_TYPES,
  generateGrade8MathUnit3Question,
  type Grade8MathUnit3ItemType,
} from '../../../curriculum/grade8MathUnit3Generator'
import {
  GRADE8_MATH_UNIT4_ITEM_TYPES,
  generateGrade8MathUnit4Question,
  type Grade8MathUnit4ItemType,
} from '../../../curriculum/grade8MathUnit4Generator'
import {
  GRADE8_MATH_UNIT5_ITEM_TYPES,
  generateGrade8MathUnit5Question,
  type Grade8MathUnit5ItemType,
} from '../../../curriculum/grade8MathUnit5Generator'
import {
  GRADE8_MATH_UNIT6_ITEM_TYPES,
  generateGrade8MathUnit6Question,
  type Grade8MathUnit6ItemType,
} from '../../../curriculum/grade8MathUnit6Generator'
import {
  GRADE8_MATH_UNIT7_ITEM_TYPES,
  generateGrade8MathUnit7Question,
  type Grade8MathUnit7ItemType,
} from '../../../curriculum/grade8MathUnit7Generator'
import {
  GRADE8_MATH_UNIT8_ITEM_TYPES,
  generateGrade8MathUnit8Question,
  type Grade8MathUnit8ItemType,
} from '../../../curriculum/grade8MathUnit8Generator'
import {
  GRADE8_MATH_UNIT9_ITEM_TYPES,
  generateGrade8MathUnit9Question,
  type Grade8MathUnit9ItemType,
} from '../../../curriculum/grade8MathUnit9Generator'
import {
  GRADE8_MATH_UNIT10_ITEM_TYPES,
  generateGrade8MathUnit10Question,
  type Grade8MathUnit10ItemType,
} from '../../../curriculum/grade8MathUnit10Generator'

/**
 * FAMILY-PILOT-PRACTICE-1 — erases each grade/unit's own item-type union
 * behind one shape, the same way the existing Grade 5 practice bridge
 * (curriculum/practice/grade5MathPracticeUnits.ts) does. This module owns no
 * generation logic of its own: every question comes from the reviewed
 * per-unit generator, unmodified.
 */
export type MathPracticeQuestion = CurriculumQuestion<string, unknown>

export interface MathPracticeUnit {
  readonly unitNumber: number
  readonly itemTypes: readonly string[]
  /** `itemType` must come from this unit's own `itemTypes`. */
  readonly generate: (itemType: string, difficulty: Difficulty) => MathPracticeQuestion
}

const GRADE5_UNITS: readonly MathPracticeUnit[] = GRADE5_MATH_PRACTICE_UNITS.map((unit) => ({
  unitNumber: unit.unitNumber,
  itemTypes: unit.itemTypes,
  generate: unit.generate,
}))

const GRADE7_UNITS: readonly MathPracticeUnit[] = [
  {
    unitNumber: 1,
    itemTypes: GRADE7_MATH_UNIT1_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit1Question(itemType as Grade7MathUnit1ItemType, difficulty),
  },
  {
    unitNumber: 2,
    itemTypes: GRADE7_MATH_UNIT2_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit2Question(itemType as Grade7MathUnit2ItemType, difficulty),
  },
  {
    unitNumber: 3,
    itemTypes: GRADE7_MATH_UNIT3_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit3Question(itemType as Grade7MathUnit3ItemType, difficulty),
  },
  {
    unitNumber: 4,
    itemTypes: GRADE7_MATH_UNIT4_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit4Question(itemType as Grade7MathUnit4ItemType, difficulty),
  },
  {
    unitNumber: 5,
    itemTypes: GRADE7_MATH_UNIT5_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit5Question(itemType as Grade7MathUnit5ItemType, difficulty),
  },
  {
    unitNumber: 6,
    itemTypes: GRADE7_MATH_UNIT6_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit6Question(itemType as Grade7MathUnit6ItemType, difficulty),
  },
  {
    unitNumber: 7,
    itemTypes: GRADE7_MATH_UNIT7_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit7Question(itemType as Grade7MathUnit7ItemType, difficulty),
  },
  {
    unitNumber: 8,
    itemTypes: GRADE7_MATH_UNIT8_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit8Question(itemType as Grade7MathUnit8ItemType, difficulty),
  },
  {
    unitNumber: 9,
    itemTypes: GRADE7_MATH_UNIT9_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit9Question(itemType as Grade7MathUnit9ItemType, difficulty),
  },
  {
    unitNumber: 10,
    itemTypes: GRADE7_MATH_UNIT10_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade7MathUnit10Question(itemType as Grade7MathUnit10ItemType, difficulty),
  },
]

const GRADE8_UNITS: readonly MathPracticeUnit[] = [
  {
    unitNumber: 1,
    itemTypes: GRADE8_MATH_UNIT1_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit1Question(itemType as Grade8MathUnit1ItemType, difficulty),
  },
  {
    unitNumber: 2,
    itemTypes: GRADE8_MATH_UNIT2_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit2Question(itemType as Grade8MathUnit2ItemType, difficulty),
  },
  {
    unitNumber: 3,
    itemTypes: GRADE8_MATH_UNIT3_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit3Question(itemType as Grade8MathUnit3ItemType, difficulty),
  },
  {
    unitNumber: 4,
    itemTypes: GRADE8_MATH_UNIT4_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit4Question(itemType as Grade8MathUnit4ItemType, difficulty),
  },
  {
    unitNumber: 5,
    itemTypes: GRADE8_MATH_UNIT5_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit5Question(itemType as Grade8MathUnit5ItemType, difficulty),
  },
  {
    unitNumber: 6,
    itemTypes: GRADE8_MATH_UNIT6_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit6Question(itemType as Grade8MathUnit6ItemType, difficulty),
  },
  {
    unitNumber: 7,
    itemTypes: GRADE8_MATH_UNIT7_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit7Question(itemType as Grade8MathUnit7ItemType, difficulty),
  },
  {
    unitNumber: 8,
    itemTypes: GRADE8_MATH_UNIT8_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit8Question(itemType as Grade8MathUnit8ItemType, difficulty),
  },
  {
    unitNumber: 9,
    itemTypes: GRADE8_MATH_UNIT9_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit9Question(itemType as Grade8MathUnit9ItemType, difficulty),
  },
  {
    unitNumber: 10,
    itemTypes: GRADE8_MATH_UNIT10_ITEM_TYPES,
    generate: (itemType, difficulty) =>
      generateGrade8MathUnit10Question(itemType as Grade8MathUnit10ItemType, difficulty),
  },
]

const UNITS_BY_GRADE: Readonly<Partial<Record<AcademyGrade, readonly MathPracticeUnit[]>>> = {
  '5': GRADE5_UNITS,
  '7': GRADE7_UNITS,
  '8': GRADE8_UNITS,
}

export function mathPracticeUnitsForGrade(grade: AcademyGrade): readonly MathPracticeUnit[] {
  return UNITS_BY_GRADE[grade] ?? []
}

export function mathPracticeUnit(grade: AcademyGrade, unitNumber: number): MathPracticeUnit | undefined {
  return mathPracticeUnitsForGrade(grade).find((unit) => unit.unitNumber === unitNumber)
}
