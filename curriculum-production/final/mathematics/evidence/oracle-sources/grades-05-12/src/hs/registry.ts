import type { UnitBank } from '../itemBank.ts'
import { GRADE9_UNIT1 } from './grade9Unit1.ts'
import { GRADE9_UNIT2 } from './grade9Unit2.ts'
import { GRADE9_UNIT3 } from './grade9Unit3.ts'
import { GRADE9_UNIT4 } from './grade9Unit4.ts'
import { GRADE9_UNIT5 } from './grade9Unit5.ts'
import { GRADE9_UNIT6 } from './grade9Unit6.ts'
import { GRADE9_UNIT7 } from './grade9Unit7.ts'
import { GRADE9_UNIT8 } from './grade9Unit8.ts'
import { GRADE9_UNIT9 } from './grade9Unit9.ts'
import { GRADE9_UNIT10 } from './grade9Unit10.ts'
import { GRADE10_UNIT1 } from './grade10Unit1.ts'
import { GRADE10_UNIT2 } from './grade10Unit2.ts'
import { GRADE10_UNIT3 } from './grade10Unit3.ts'
import { GRADE10_UNIT4 } from './grade10Unit4.ts'
import { GRADE10_UNIT5 } from './grade10Unit5.ts'
import { GRADE10_UNIT6 } from './grade10Unit6.ts'
import { GRADE10_UNIT7 } from './grade10Unit7.ts'
import { GRADE10_UNIT8 } from './grade10Unit8.ts'
import { GRADE10_UNIT9 } from './grade10Unit9.ts'
import { GRADE10_UNIT10 } from './grade10Unit10.ts'
import { GRADE11_UNIT1 } from './grade11Unit1.ts'
import { GRADE11_UNIT2 } from './grade11Unit2.ts'
import { GRADE11_UNIT3 } from './grade11Unit3.ts'
import { GRADE11_UNIT4 } from './grade11Unit4.ts'
import { GRADE11_UNIT5 } from './grade11Unit5.ts'
import { GRADE11_UNIT6 } from './grade11Unit6.ts'
import { GRADE11_UNIT7 } from './grade11Unit7.ts'
import { GRADE11_UNIT8 } from './grade11Unit8.ts'
import { GRADE11_UNIT9 } from './grade11Unit9.ts'
import { GRADE11_UNIT10 } from './grade11Unit10.ts'
import { GRADE12_UNIT1 } from './grade12Unit1.ts'
import { GRADE12_UNIT2 } from './grade12Unit2.ts'
import { GRADE12_UNIT3 } from './grade12Unit3.ts'
import { GRADE12_UNIT4 } from './grade12Unit4.ts'
import { GRADE12_UNIT5 } from './grade12Unit5.ts'
import { GRADE12_UNIT6 } from './grade12Unit6.ts'
import { GRADE12_UNIT7 } from './grade12Unit7.ts'
import { GRADE12_UNIT8 } from './grade12Unit8.ts'
import { GRADE12_UNIT9 } from './grade12Unit9.ts'
import { GRADE12_UNIT10 } from './grade12Unit10.ts'

/**
 * Item banks for the high-school mathematics courses (grades 9-12).
 *
 * Grades 5-8 already had authored generators in src/curriculum; the high-school
 * courses inherited from mac/hs912-math-r1 carry lesson records and standards
 * but no item generators, so the ones registered here are authored in this
 * directory against those courses' own standards.
 */
export const HS_UNIT_BANKS: Record<string, UnitBank> = {
  '9:1': GRADE9_UNIT1,
  '9:2': GRADE9_UNIT2,
  '9:3': GRADE9_UNIT3,
  '9:4': GRADE9_UNIT4,
  '9:5': GRADE9_UNIT5,
  '9:6': GRADE9_UNIT6,
  '9:7': GRADE9_UNIT7,
  '9:8': GRADE9_UNIT8,
  '9:9': GRADE9_UNIT9,
  '9:10': GRADE9_UNIT10,
  '10:1': GRADE10_UNIT1,
  '10:2': GRADE10_UNIT2,
  '10:3': GRADE10_UNIT3,
  '10:4': GRADE10_UNIT4,
  '10:5': GRADE10_UNIT5,
  '10:6': GRADE10_UNIT6,
  '10:7': GRADE10_UNIT7,
  '10:8': GRADE10_UNIT8,
  '10:9': GRADE10_UNIT9,
  '10:10': GRADE10_UNIT10,
  '11:1': GRADE11_UNIT1,
  '11:2': GRADE11_UNIT2,
  '11:3': GRADE11_UNIT3,
  '11:4': GRADE11_UNIT4,
  '11:5': GRADE11_UNIT5,
  '11:6': GRADE11_UNIT6,
  '11:7': GRADE11_UNIT7,
  '11:8': GRADE11_UNIT8,
  '11:9': GRADE11_UNIT9,
  '11:10': GRADE11_UNIT10,
  '12:1': GRADE12_UNIT1,
  '12:2': GRADE12_UNIT2,
  '12:3': GRADE12_UNIT3,
  '12:4': GRADE12_UNIT4,
  '12:5': GRADE12_UNIT5,
  '12:6': GRADE12_UNIT6,
  '12:7': GRADE12_UNIT7,
  '12:8': GRADE12_UNIT8,
  '12:9': GRADE12_UNIT9,
  '12:10': GRADE12_UNIT10,
}
