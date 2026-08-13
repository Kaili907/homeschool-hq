import type { Difficulty } from '../../../../src/types.ts'
import type { CurriculumQuestion } from '../../../../src/curriculum/generatorCore.ts'
import {
  GRADE5_MATH_UNIT1_ITEM_TYPES,
  GRADE5_MATH_UNIT1_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit1Generator.ts'
import {
  GRADE5_MATH_UNIT2_ITEM_TYPES,
  GRADE5_MATH_UNIT2_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit2Generator.ts'
import {
  GRADE5_MATH_UNIT3_ITEM_TYPES,
  GRADE5_MATH_UNIT3_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit3Generator.ts'
import {
  GRADE5_MATH_UNIT4_ITEM_TYPES,
  GRADE5_MATH_UNIT4_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit4Generator.ts'
import {
  GRADE5_MATH_UNIT5_ITEM_TYPES,
  GRADE5_MATH_UNIT5_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit5Generator.ts'
import {
  GRADE5_MATH_UNIT6_ITEM_TYPES,
  GRADE5_MATH_UNIT6_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit6Generator.ts'
import {
  GRADE5_MATH_UNIT7_ITEM_TYPES,
  GRADE5_MATH_UNIT7_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit7Generator.ts'
import {
  GRADE5_MATH_UNIT8_ITEM_TYPES,
  GRADE5_MATH_UNIT8_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit8Generator.ts'
import {
  GRADE5_MATH_UNIT9_ITEM_TYPES,
  GRADE5_MATH_UNIT9_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit9Generator.ts'
import {
  GRADE5_MATH_UNIT10_ITEM_TYPES,
  GRADE5_MATH_UNIT10_GENERATORS,
} from '../../../../src/curriculum/grade5MathUnit10Generator.ts'
import {
  GRADE7_MATH_UNIT1_ITEM_TYPES,
  GRADE7_MATH_UNIT1_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit1Generator.ts'
import {
  GRADE7_MATH_UNIT2_ITEM_TYPES,
  GRADE7_MATH_UNIT2_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit2Generator.ts'
import {
  GRADE7_MATH_UNIT3_ITEM_TYPES,
  GRADE7_MATH_UNIT3_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit3Generator.ts'
import {
  GRADE7_MATH_UNIT4_ITEM_TYPES,
  GRADE7_MATH_UNIT4_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit4Generator.ts'
import {
  GRADE7_MATH_UNIT5_ITEM_TYPES,
  GRADE7_MATH_UNIT5_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit5Generator.ts'
import {
  GRADE7_MATH_UNIT6_ITEM_TYPES,
  GRADE7_MATH_UNIT6_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit6Generator.ts'
import {
  GRADE7_MATH_UNIT7_ITEM_TYPES,
  GRADE7_MATH_UNIT7_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit7Generator.ts'
import {
  GRADE7_MATH_UNIT8_ITEM_TYPES,
  GRADE7_MATH_UNIT8_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit8Generator.ts'
import {
  GRADE7_MATH_UNIT9_ITEM_TYPES,
  GRADE7_MATH_UNIT9_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit9Generator.ts'
import {
  GRADE7_MATH_UNIT10_ITEM_TYPES,
  GRADE7_MATH_UNIT10_GENERATORS,
} from '../../../../src/curriculum/grade7MathUnit10Generator.ts'
import {
  GRADE8_MATH_UNIT1_ITEM_TYPES,
  GRADE8_MATH_UNIT1_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit1Generator.ts'
import {
  GRADE8_MATH_UNIT2_ITEM_TYPES,
  GRADE8_MATH_UNIT2_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit2Generator.ts'
import {
  GRADE8_MATH_UNIT3_ITEM_TYPES,
  GRADE8_MATH_UNIT3_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit3Generator.ts'
import {
  GRADE8_MATH_UNIT4_ITEM_TYPES,
  GRADE8_MATH_UNIT4_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit4Generator.ts'
import {
  GRADE8_MATH_UNIT5_ITEM_TYPES,
  GRADE8_MATH_UNIT5_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit5Generator.ts'
import {
  GRADE8_MATH_UNIT6_ITEM_TYPES,
  GRADE8_MATH_UNIT6_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit6Generator.ts'
import {
  GRADE8_MATH_UNIT7_ITEM_TYPES,
  GRADE8_MATH_UNIT7_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit7Generator.ts'
import {
  GRADE8_MATH_UNIT8_ITEM_TYPES,
  GRADE8_MATH_UNIT8_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit8Generator.ts'
import {
  GRADE8_MATH_UNIT9_ITEM_TYPES,
  GRADE8_MATH_UNIT9_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit9Generator.ts'
import {
  GRADE8_MATH_UNIT10_ITEM_TYPES,
  GRADE8_MATH_UNIT10_GENERATORS,
} from '../../../../src/curriculum/grade8MathUnit10Generator.ts'

/**
 * Uniform read-only view over the mathematics item generators already authored
 * for the canonical grades 5, 7, and 8 curricula.
 *
 * These generators are the existing answer authority for those grades: each one
 * returns the generation parameters alongside the question, which is what lets
 * the answer key be re-derived by an independent oracle instead of trusting the
 * generator's own arithmetic. Nothing in this module mutates them.
 */

export type BankQuestion = CurriculumQuestion<string, unknown>

type GeneratorMap = Record<string, (difficulty: Difficulty) => BankQuestion>

export interface UnitItemBank {
  grade: number
  unitNumber: number
  itemTypes: readonly string[]
  generators: GeneratorMap
}

export const CANONICAL_UNIT_BANKS: Record<string, UnitItemBank> = {
  '5:1': {
    grade: 5,
    unitNumber: 1,
    itemTypes: GRADE5_MATH_UNIT1_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT1_GENERATORS as unknown as GeneratorMap,
  },
  '5:2': {
    grade: 5,
    unitNumber: 2,
    itemTypes: GRADE5_MATH_UNIT2_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT2_GENERATORS as unknown as GeneratorMap,
  },
  '5:3': {
    grade: 5,
    unitNumber: 3,
    itemTypes: GRADE5_MATH_UNIT3_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT3_GENERATORS as unknown as GeneratorMap,
  },
  '5:4': {
    grade: 5,
    unitNumber: 4,
    itemTypes: GRADE5_MATH_UNIT4_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT4_GENERATORS as unknown as GeneratorMap,
  },
  '5:5': {
    grade: 5,
    unitNumber: 5,
    itemTypes: GRADE5_MATH_UNIT5_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT5_GENERATORS as unknown as GeneratorMap,
  },
  '5:6': {
    grade: 5,
    unitNumber: 6,
    itemTypes: GRADE5_MATH_UNIT6_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT6_GENERATORS as unknown as GeneratorMap,
  },
  '5:7': {
    grade: 5,
    unitNumber: 7,
    itemTypes: GRADE5_MATH_UNIT7_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT7_GENERATORS as unknown as GeneratorMap,
  },
  '5:8': {
    grade: 5,
    unitNumber: 8,
    itemTypes: GRADE5_MATH_UNIT8_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT8_GENERATORS as unknown as GeneratorMap,
  },
  '5:9': {
    grade: 5,
    unitNumber: 9,
    itemTypes: GRADE5_MATH_UNIT9_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT9_GENERATORS as unknown as GeneratorMap,
  },
  '5:10': {
    grade: 5,
    unitNumber: 10,
    itemTypes: GRADE5_MATH_UNIT10_ITEM_TYPES,
    generators: GRADE5_MATH_UNIT10_GENERATORS as unknown as GeneratorMap,
  },
  '7:1': {
    grade: 7,
    unitNumber: 1,
    itemTypes: GRADE7_MATH_UNIT1_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT1_GENERATORS as unknown as GeneratorMap,
  },
  '7:2': {
    grade: 7,
    unitNumber: 2,
    itemTypes: GRADE7_MATH_UNIT2_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT2_GENERATORS as unknown as GeneratorMap,
  },
  '7:3': {
    grade: 7,
    unitNumber: 3,
    itemTypes: GRADE7_MATH_UNIT3_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT3_GENERATORS as unknown as GeneratorMap,
  },
  '7:4': {
    grade: 7,
    unitNumber: 4,
    itemTypes: GRADE7_MATH_UNIT4_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT4_GENERATORS as unknown as GeneratorMap,
  },
  '7:5': {
    grade: 7,
    unitNumber: 5,
    itemTypes: GRADE7_MATH_UNIT5_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT5_GENERATORS as unknown as GeneratorMap,
  },
  '7:6': {
    grade: 7,
    unitNumber: 6,
    itemTypes: GRADE7_MATH_UNIT6_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT6_GENERATORS as unknown as GeneratorMap,
  },
  '7:7': {
    grade: 7,
    unitNumber: 7,
    itemTypes: GRADE7_MATH_UNIT7_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT7_GENERATORS as unknown as GeneratorMap,
  },
  '7:8': {
    grade: 7,
    unitNumber: 8,
    itemTypes: GRADE7_MATH_UNIT8_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT8_GENERATORS as unknown as GeneratorMap,
  },
  '7:9': {
    grade: 7,
    unitNumber: 9,
    itemTypes: GRADE7_MATH_UNIT9_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT9_GENERATORS as unknown as GeneratorMap,
  },
  '7:10': {
    grade: 7,
    unitNumber: 10,
    itemTypes: GRADE7_MATH_UNIT10_ITEM_TYPES,
    generators: GRADE7_MATH_UNIT10_GENERATORS as unknown as GeneratorMap,
  },
  '8:1': {
    grade: 8,
    unitNumber: 1,
    itemTypes: GRADE8_MATH_UNIT1_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT1_GENERATORS as unknown as GeneratorMap,
  },
  '8:2': {
    grade: 8,
    unitNumber: 2,
    itemTypes: GRADE8_MATH_UNIT2_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT2_GENERATORS as unknown as GeneratorMap,
  },
  '8:3': {
    grade: 8,
    unitNumber: 3,
    itemTypes: GRADE8_MATH_UNIT3_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT3_GENERATORS as unknown as GeneratorMap,
  },
  '8:4': {
    grade: 8,
    unitNumber: 4,
    itemTypes: GRADE8_MATH_UNIT4_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT4_GENERATORS as unknown as GeneratorMap,
  },
  '8:5': {
    grade: 8,
    unitNumber: 5,
    itemTypes: GRADE8_MATH_UNIT5_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT5_GENERATORS as unknown as GeneratorMap,
  },
  '8:6': {
    grade: 8,
    unitNumber: 6,
    itemTypes: GRADE8_MATH_UNIT6_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT6_GENERATORS as unknown as GeneratorMap,
  },
  '8:7': {
    grade: 8,
    unitNumber: 7,
    itemTypes: GRADE8_MATH_UNIT7_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT7_GENERATORS as unknown as GeneratorMap,
  },
  '8:8': {
    grade: 8,
    unitNumber: 8,
    itemTypes: GRADE8_MATH_UNIT8_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT8_GENERATORS as unknown as GeneratorMap,
  },
  '8:9': {
    grade: 8,
    unitNumber: 9,
    itemTypes: GRADE8_MATH_UNIT9_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT9_GENERATORS as unknown as GeneratorMap,
  },
  '8:10': {
    grade: 8,
    unitNumber: 10,
    itemTypes: GRADE8_MATH_UNIT10_ITEM_TYPES,
    generators: GRADE8_MATH_UNIT10_GENERATORS as unknown as GeneratorMap,
  },
}

export const canonicalBankKey = (grade: number, unitNumber: number): string =>
  `${grade}:${unitNumber}`
