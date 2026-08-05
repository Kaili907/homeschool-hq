import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import { ACADEMY_SUBJECTS, type Grade, type Profile } from '../types'
import {
  enabledAcademyEntries,
  enabledAcademyLevels,
  hasEnabledAcademyProgram,
  isAnyAcademyLevelEnabled,
  setWorkingLevel,
  workingLevelFor,
} from './workingLevel'

/**
 * ACADEMY-LEVEL-DECOUPLE — a girl's working level, per subject, is what decides
 * the content she receives. Her nominal grade decides nothing about content.
 */

const at = (grade: Grade): Profile => emptyProfile('p1', 'Test', grade)

/** The five real household grades. Not one of them is an academy grade — which
 * is exactly why gating on profile grade reached nobody. */
const HOUSEHOLD: Grade[] = ['3', '4', '6', '10', '12']

function enableAll() {
  vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
  vi.stubEnv('VITE_ACADEMY_GRADE_7_ENABLED', 'true')
  vi.stubEnv('VITE_ACADEMY_GRADE_8_ENABLED', 'true')
}

describe('working level resolution', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('an unset subject rides her nominal grade, for every grade in the model', () => {
    for (const grade of ['3', '4', '5', '6', '7', '8', '10', '12'] as Grade[]) {
      for (const subject of ACADEMY_SUBJECTS) {
        expect(workingLevelFor(at(grade), subject)).toBe(grade)
      }
    }
  })

  it('assigning one subject leaves every other subject on her nominal grade', () => {
    const p = setWorkingLevel(at('6'), 'mathematics', '5')
    expect(workingLevelFor(p, 'mathematics')).toBe('5')
    expect(workingLevelFor(p, 'english-language-arts')).toBe('6')
    expect(workingLevelFor(p, 'science')).toBe('6')
  })

  it('never touches her nominal grade, and clearing restores a pristine profile', () => {
    const base = at('6')
    const assigned = setWorkingLevel(base, 'mathematics', '5')
    expect(assigned.grade).toBe('6')
    expect(base.workingLevels).toBeUndefined() // input untouched
    const cleared = setWorkingLevel(assigned, 'mathematics', null)
    expect(cleared.grade).toBe('6')
    expect(cleared.workingLevels).toBeUndefined()
    expect(cleared).toEqual(base)
  })
})

describe('academy gating keys off working level', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('a grade-6 girl set to Grade 5 mathematics reaches Grade 5 mathematics', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    const p = setWorkingLevel(at('6'), 'mathematics', '5')
    expect(enabledAcademyEntries(p)).toEqual([{ subject: 'mathematics', level: '5' }])
    expect(hasEnabledAcademyProgram(p)).toBe(true)
    expect(p.grade).toBe('6')
  })

  it('holds Grade 5 mathematics and Grade 7 ELA at the same time', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    vi.stubEnv('VITE_ACADEMY_GRADE_7_ENABLED', 'true')
    const p = setWorkingLevel(
      setWorkingLevel(at('6'), 'mathematics', '5'),
      'english-language-arts',
      '7',
    )
    expect(enabledAcademyEntries(p)).toEqual([
      { subject: 'mathematics', level: '5' },
      { subject: 'english-language-arts', level: '7' },
    ])
    expect(enabledAcademyLevels(p)).toEqual(['5', '7'])
  })

  it('the per-level flag still gates: level 5 with the flag unset reaches nothing', () => {
    const p = setWorkingLevel(at('6'), 'mathematics', '5')
    expect(enabledAcademyEntries(p)).toEqual([])
    expect(hasEnabledAcademyProgram(p)).toBe(false)
  })

  it('a truthy-typo flag value never enables a working level', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'TRUE')
    const p = setWorkingLevel(at('6'), 'mathematics', '5')
    expect(enabledAcademyEntries(p)).toEqual([])
  })

  it('a working level with no published content (grade 10) reaches nothing', () => {
    enableAll()
    const p = setWorkingLevel(at('6'), 'mathematics', '10')
    expect(enabledAcademyEntries(p)).toEqual([])
  })
})

describe('profiles with no working level behave exactly as before', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('none of the five household grades reaches the academy, even with all flags on', () => {
    enableAll()
    for (const grade of HOUSEHOLD) {
      expect(enabledAcademyEntries(at(grade))).toEqual([])
      expect(hasEnabledAcademyProgram(at(grade))).toBe(false)
    }
  })

  it('an academy-grade profile still receives its whole grade, subject by subject', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_7_ENABLED', 'true')
    const entries = enabledAcademyEntries(at('7'))
    expect(entries).toHaveLength(ACADEMY_SUBJECTS.length)
    expect(entries.every((e) => e.level === '7')).toBe(true)
    expect(enabledAcademyLevels(at('7'))).toEqual(['7'])
  })
})

describe('parent-side tab gate', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is off with no flags and on as soon as any level is enabled', () => {
    expect(isAnyAcademyLevelEnabled()).toBe(false)
    vi.stubEnv('VITE_ACADEMY_GRADE_8_ENABLED', 'true')
    expect(isAnyAcademyLevelEnabled()).toBe(true)
  })
})
