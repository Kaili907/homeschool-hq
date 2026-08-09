import { describe, expect, it } from 'vitest'
import {
  LEARNER_IDENTITY_VERSION,
  defaultAppState,
  isAppState,
  migrateDefaultFamilyIdentities,
  migrateV1ToV2,
} from './migration'
import { hasExplicitWorkingLevel, workingLevelFor } from './academy/workingLevel'
import type { V1Profile } from './types'

/** Realistic v1 payload matching the real 3rd grader's data shape. */
const V1_WITH_DATA: V1Profile = {
  version: 1,
  name: 'Math Champ',
  createdAt: '2026-07-23T13:48:08.866Z',
  placementDone: true,
  skillStats: {
    mult: { attempts: 3, correct: 2, mastery: 45 },
    div: { attempts: 5, correct: 1, mastery: 12 },
    addsub: { attempts: 2, correct: 2, mastery: 82 },
    time: { attempts: 1, correct: 0, mastery: 20 },
  },
  totals: { questionsAnswered: 35, correct: 20, bestStreak: 6, sessions: 3 },
  lastPracticeDate: '2026-07-23',
}

/** The actual current localStorage value (fresh profile, pre-placement). */
const V1_FRESH: V1Profile = {
  version: 1,
  name: 'Math Champ',
  createdAt: '2026-07-23T13:48:08.866Z',
  placementDone: false,
  skillStats: {},
  totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
}

describe('migrateV1ToV2', () => {
  it('preserves the 3rd grader mastery data byte-for-byte', () => {
    const state = migrateV1ToV2(V1_WITH_DATA)!
    expect(state).not.toBeNull()
    const p1 = state.profiles.p1

    // every v1 skill survives with identical numbers
    for (const [skillId, stat] of Object.entries(V1_WITH_DATA.skillStats)) {
      const migrated = p1.skills[skillId as keyof typeof p1.skills]!
      expect(migrated.attempts).toBe(stat!.attempts)
      expect(migrated.correct).toBe(stat!.correct)
      expect(migrated.mastery).toBe(stat!.mastery)
    }
    // byte-for-byte on the numeric triple, ignoring the additive lastSeen field
    const stripped = Object.fromEntries(
      Object.entries(p1.skills).map(([k, v]) => [
        k,
        { attempts: v!.attempts, correct: v!.correct, mastery: v!.mastery },
      ]),
    )
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(V1_WITH_DATA.skillStats))

    expect(p1.name).toBe('Math Champ')
    expect(p1.createdAt).toBe(V1_WITH_DATA.createdAt)
    expect(p1.placementDone).toBe(true)
    expect(p1.totals).toEqual(V1_WITH_DATA.totals)
    expect(p1.lastPracticeDate).toBe('2026-07-23')
    expect(p1.streaks.best).toBe(6)
    expect(p1.grade).toBe('3')
    expect(p1.theme).toBe('playful')
  })

  it('creates all five profiles with correct grades and themes', () => {
    const state = migrateV1ToV2(V1_FRESH)!
    expect(Object.keys(state.profiles)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(state.profiles.p2.grade).toBe('4')
    expect(state.profiles.p2.theme).toBe('playful')
    expect(state.profiles.p3.name).toBe('Stephanie Manuel')
    expect(state.profiles.p3.grade).toBe('7')
    expect(state.profiles.p3.theme).toBe('cool')
    expect(state.profiles.p4.grade).toBe('10')
    expect(state.profiles.p4.theme).toBe('clean')
    expect(state.profiles.p5.grade).toBe('12')
    expect(state.profiles.p5.theme).toBe('clean')
    // new profiles start clean
    for (const id of ['p2', 'p3', 'p4', 'p5'] as const) {
      expect(state.profiles[id].skills).toEqual({})
      expect(state.profiles[id].pin).toBe('')
      expect(state.profiles[id].placementDone).toBe(false)
    }
  })

  it('migrates the current real (fresh) profile shape cleanly', () => {
    const state = migrateV1ToV2(V1_FRESH)!
    expect(state).not.toBeNull()
    expect(state.schemaVersion).toBe(2)
    expect(state.activeProfileId).toBeNull()
    expect(state.parentPin).toBe('')
    expect(state.profiles.p1.skills).toEqual({})
    expect(state.profiles.p1.placementDone).toBe(false)
    expect(isAppState(state)).toBe(true)
  })

  it('round-trips through JSON (localStorage fidelity)', () => {
    const state = migrateV1ToV2(V1_WITH_DATA)!
    const rehydrated = JSON.parse(JSON.stringify(state))
    expect(rehydrated).toEqual(state)
    expect(isAppState(rehydrated)).toBe(true)
  })

  it('rejects malformed input instead of corrupting data', () => {
    expect(migrateV1ToV2(null)).toBeNull()
    expect(migrateV1ToV2(undefined)).toBeNull()
    expect(migrateV1ToV2('garbage')).toBeNull()
    expect(migrateV1ToV2({})).toBeNull()
    expect(migrateV1ToV2({ version: 2, name: 'x' })).toBeNull()
    expect(migrateV1ToV2({ version: 1, name: 'x' })).toBeNull() // missing fields
  })

  it('defaultAppState validates and has five empty profiles', () => {
    const state = defaultAppState()
    expect(isAppState(state)).toBe(true)
    expect(Object.keys(state.profiles)).toHaveLength(5)
    expect(state.learnerIdentityVersion).toBe(LEARNER_IDENTITY_VERSION)
  })
})

describe('migrateDefaultFamilyIdentities', () => {
  function legacyDefaults() {
    const state = defaultAppState()
    delete state.learnerIdentityVersion
    state.profiles.p1 = { ...state.profiles.p1, name: '3rd Grader', grade: '3' }
    state.profiles.p2 = { ...state.profiles.p2, name: '4th Grader', grade: '4' }
    state.profiles.p3 = { ...state.profiles.p3, name: '6th Grader', grade: '6' }
    state.profiles.p4 = { ...state.profiles.p4, name: 'Sophomore', grade: '10' }
    state.profiles.p5 = { ...state.profiles.p5, name: 'Senior', grade: '12' }
    return state
  }

  it('corrects only canonical identity fields while preserving stable IDs and progress', () => {
    const state = legacyDefaults()
    state.activeProfileId = 'p3'
    state.parentPin = '9876'
    state.profiles.p3 = {
      ...state.profiles.p3,
      pin: '4321',
      workingLevels: { mathematics: '5' },
      skills: { mult: { attempts: 8, correct: 6, mastery: 71, lastSeen: '2026-08-08' } },
      missions: {
        '2026-08-08': { items: [{ id: 'reading', label: 'Read', done: true }] },
      },
      totals: { questionsAnswered: 22, correct: 17, bestStreak: 5, sessions: 3 },
    }
    const before = state.profiles.p3
    const migrated = migrateDefaultFamilyIdentities(state)

    expect(Object.keys(migrated.profiles)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(migrated.profiles.p3).toEqual({ ...before, name: 'Stephanie Manuel', grade: '7' })
    expect(migrated.profiles.p3.skills).toBe(before.skills)
    expect(migrated.profiles.p3.missions).toBe(before.missions)
    expect(migrated.profiles.p3.workingLevels).toBe(before.workingLevels)
    expect(migrated.activeProfileId).toBe('p3')
    expect(migrated.parentPin).toBe('9876')
  })

  it('does not assign a working level when Stephanie moves to nominal grade 7', () => {
    const state = legacyDefaults()
    const profile = migrateDefaultFamilyIdentities(state).profiles.p3

    expect(profile.grade).toBe('7')
    expect(profile.workingLevels).toBeUndefined()
    expect(hasExplicitWorkingLevel(profile, 'mathematics')).toBe(false)
    expect(workingLevelFor(profile, 'mathematics')).toBe('7')
  })

  it('protects customized names or grades and is deterministic and idempotent', () => {
    const state = legacyDefaults()
    state.profiles.p2 = { ...state.profiles.p2, name: 'Lulu' }
    state.profiles.p3 = { ...state.profiles.p3, grade: '7' }

    const migrated = migrateDefaultFamilyIdentities(state)
    expect(migrated.profiles.p2.name).toBe('Lulu')
    expect(migrated.profiles.p3.name).toBe('6th Grader')
    expect(migrated.profiles.p3.grade).toBe('7')
    expect(migrateDefaultFamilyIdentities(migrated)).toBe(migrated)
    expect(migrated.learnerIdentityVersion).toBe(LEARNER_IDENTITY_VERSION)
  })
})
