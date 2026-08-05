import { describe, expect, it } from 'vitest'
import { validateAppStateForSync } from './provenance'
import { defaultAppState, emptyProfile } from '../migration'
import type { AcademyState, AppState, Profile } from '../types'

/**
 * ACADEMY-LEVEL-DECOUPLE — the canonical persistence model must be able to
 * REPRESENT a decoupled learner, or every save of one would be rejected and the
 * whole household dataset quarantined. It must also keep refusing an enrollment
 * in a level nobody assigned, which is the anti-tamper property the old
 * `academy.grade === profile.grade` rule provided.
 */

const academyAt = (grade: '5' | '7' | '8'): AcademyState => ({
  releaseVersion: '1.0.0',
  grade,
  enrolledAt: '2026-08-04T12:00:00.000Z',
  courseIds: [`ma-g${grade}-mathematics`],
  lessons: {},
  assessments: {},
})

function stateWith(profile: Profile): unknown {
  const s: AppState = defaultAppState()
  s.profiles.p3 = profile
  return JSON.parse(JSON.stringify(s))
}

const sixthGrader = (extra: Partial<Profile>): Profile => ({
  ...emptyProfile('p3', 'Sixth Grader', '6'),
  ...extra,
})

describe('working levels round-trip through sync validation', () => {
  it('accepts a grade-6 profile enrolled at Grade 5 via a mathematics working level', () => {
    const candidate = stateWith(
      sixthGrader({ workingLevels: { mathematics: '5' }, academy: academyAt('5') }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('accepts mathematics 5 + ELA 7 held at once', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5', 'english-language-arts': '7' },
        academy: academyAt('7'),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('accepts working levels with no academy enrollment yet', () => {
    const candidate = stateWith(sixthGrader({ workingLevels: { science: '8' } }))
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('profiles with no working levels stay valid (additive field)', () => {
    expect(validateAppStateForSync(stateWith(sixthGrader({}))).ok).toBe(true)
  })
})

describe('the tamper boundary survives the decoupling', () => {
  it('rejects an enrollment in a level no working level assigned', () => {
    // grade 6, mathematics held at 5 — but the payload claims Grade 8 enrollment
    const candidate = stateWith(
      sixthGrader({ workingLevels: { mathematics: '5' }, academy: academyAt('8') }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('rejects an enrollment on a profile with no working levels at all', () => {
    const candidate = stateWith(sixthGrader({ academy: academyAt('5') }))
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('rejects unknown subjects and non-grade levels in the working-level record', () => {
    const cases: Record<string, unknown>[] = [
      { 'mind-control': '5' },
      { mathematics: '9' },
      { mathematics: 5 },
      { mathematics: null },
      { mathematics: { level: '5' } },
    ]
    for (const workingLevels of cases) {
      const candidate = stateWith(
        sixthGrader({ workingLevels: workingLevels as Profile['workingLevels'] }),
      )
      expect(validateAppStateForSync(candidate).ok).toBe(false)
    }
  })

  it('still accepts the undecoupled case: an academy-grade profile enrolled at its own grade', () => {
    const candidate = stateWith({
      ...emptyProfile('p3', 'Fifth Grader', '5'),
      academy: academyAt('5'),
    })
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })
})
