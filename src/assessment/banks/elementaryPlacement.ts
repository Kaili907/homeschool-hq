// CE3 — registry of the six elementary placement instruments.
//
// Registration is deliberately the ONLY wiring this session adds: `forGrades`
// on each FixedTest is what the existing runner already keys on, so a Grade 3,
// 4 or 6 profile picks these up through testsForGrade() with no change to the
// player, the admin panel, or App.tsx.

import type { FixedTest } from '../types'
import type { PlacementInstrument } from './placementModel'
import { ELE_MATH_G3, ELE_MATH_G3_BLUEPRINT, ELE_MATH_G3_DOMAINS } from './eleMathG3'
import { ELE_MATH_G4, ELE_MATH_G4_BLUEPRINT, ELE_MATH_G4_DOMAINS } from './eleMathG4'
import { ELE_MATH_G6, ELE_MATH_G6_BLUEPRINT, ELE_MATH_G6_DOMAINS } from './eleMathG6'
import { ELE_ELA_G3, ELE_ELA_G3_BLUEPRINT, ELE_ELA_G3_DOMAINS } from './eleElaG3'
import { ELE_ELA_G4, ELE_ELA_G4_BLUEPRINT, ELE_ELA_G4_DOMAINS } from './eleElaG4'
import { ELE_ELA_G6, ELE_ELA_G6_BLUEPRINT, ELE_ELA_G6_DOMAINS } from './eleElaG6'

export const ELEMENTARY_INSTRUMENTS: readonly PlacementInstrument[] = [
  {
    test: ELE_MATH_G3,
    subject: 'mathematics',
    nominalGrade: '3',
    blueprint: ELE_MATH_G3_BLUEPRINT,
    domainOrder: ELE_MATH_G3_DOMAINS,
  },
  {
    test: ELE_ELA_G3,
    subject: 'reading-ela',
    nominalGrade: '3',
    blueprint: ELE_ELA_G3_BLUEPRINT,
    domainOrder: ELE_ELA_G3_DOMAINS,
  },
  {
    test: ELE_MATH_G4,
    subject: 'mathematics',
    nominalGrade: '4',
    blueprint: ELE_MATH_G4_BLUEPRINT,
    domainOrder: ELE_MATH_G4_DOMAINS,
  },
  {
    test: ELE_ELA_G4,
    subject: 'reading-ela',
    nominalGrade: '4',
    blueprint: ELE_ELA_G4_BLUEPRINT,
    domainOrder: ELE_ELA_G4_DOMAINS,
  },
  {
    test: ELE_MATH_G6,
    subject: 'mathematics',
    nominalGrade: '6',
    blueprint: ELE_MATH_G6_BLUEPRINT,
    domainOrder: ELE_MATH_G6_DOMAINS,
  },
  {
    test: ELE_ELA_G6,
    subject: 'reading-ela',
    nominalGrade: '6',
    blueprint: ELE_ELA_G6_BLUEPRINT,
    domainOrder: ELE_ELA_G6_DOMAINS,
  },
]

/** The six FixedTests, for registration into ALL_TESTS. */
export const ELEMENTARY_TESTS: FixedTest[] = ELEMENTARY_INSTRUMENTS.map((i) => i.test)

export const ELEMENTARY_INSTRUMENT_BY_TEST_ID: Record<string, PlacementInstrument> =
  Object.fromEntries(ELEMENTARY_INSTRUMENTS.map((i) => [i.test.id, i]))

export {
  ELE_MATH_G3,
  ELE_MATH_G4,
  ELE_MATH_G6,
  ELE_ELA_G3,
  ELE_ELA_G4,
  ELE_ELA_G6,
  ELE_MATH_G3_BLUEPRINT,
  ELE_MATH_G4_BLUEPRINT,
  ELE_MATH_G6_BLUEPRINT,
  ELE_ELA_G3_BLUEPRINT,
  ELE_ELA_G4_BLUEPRINT,
  ELE_ELA_G6_BLUEPRINT,
}
