import type { UnitBank } from '../itemBank.ts'
import { GRADE3_UNIT1 } from './grade3Unit1.ts'
import { GRADE3_UNIT2 } from './grade3Unit2.ts'
import { GRADE3_UNIT3 } from './grade3Unit3.ts'
import { GRADE3_UNIT4 } from './grade3Unit4.ts'
import { GRADE3_UNIT5 } from './grade3Unit5.ts'
import { GRADE3_UNIT6 } from './grade3Unit6.ts'
import { GRADE3_UNIT7 } from './grade3Unit7.ts'
import { GRADE3_UNIT8 } from './grade3Unit8.ts'
import { GRADE3_UNIT9 } from './grade3Unit9.ts'
import { GRADE3_UNIT10 } from './grade3Unit10.ts'
import { GRADE4_UNIT1 } from './grade4Unit1.ts'
import { GRADE4_UNIT2 } from './grade4Unit2.ts'
import { GRADE4_UNIT3 } from './grade4Unit3.ts'
import { GRADE4_UNIT4 } from './grade4Unit4.ts'
import { GRADE4_UNIT5 } from './grade4Unit5.ts'
import { GRADE4_UNIT6 } from './grade4Unit6.ts'
import { GRADE4_UNIT7 } from './grade4Unit7.ts'
import { GRADE4_UNIT8 } from './grade4Unit8.ts'
import { GRADE4_UNIT9 } from './grade4Unit9.ts'
import { GRADE4_UNIT10 } from './grade4Unit10.ts'

/**
 * Item banks for the Grade 3 and Grade 4 mathematics courses.
 *
 * There were no pre-existing item generators for these grades (see
 * data/source/README.md and core.ts), so every unit's bank is authored fresh
 * in this directory, following the pattern the grades 9-12 sibling pipeline's
 * own src/hs/registry.ts established for the same reason.
 */
export const G34_UNIT_BANKS: Record<string, UnitBank> = {
  '3:1': GRADE3_UNIT1,
  '3:2': GRADE3_UNIT2,
  '3:3': GRADE3_UNIT3,
  '3:4': GRADE3_UNIT4,
  '3:5': GRADE3_UNIT5,
  '3:6': GRADE3_UNIT6,
  '3:7': GRADE3_UNIT7,
  '3:8': GRADE3_UNIT8,
  '3:9': GRADE3_UNIT9,
  '3:10': GRADE3_UNIT10,
  '4:1': GRADE4_UNIT1,
  '4:2': GRADE4_UNIT2,
  '4:3': GRADE4_UNIT3,
  '4:4': GRADE4_UNIT4,
  '4:5': GRADE4_UNIT5,
  '4:6': GRADE4_UNIT6,
  '4:7': GRADE4_UNIT7,
  '4:8': GRADE4_UNIT8,
  '4:9': GRADE4_UNIT9,
  '4:10': GRADE4_UNIT10,
}
