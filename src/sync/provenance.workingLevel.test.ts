import { describe, expect, it } from 'vitest'
import { validateAppStateForSync } from './provenance'
import { defaultAppState, emptyProfile } from '../migration'
import { setWorkingLevel } from '../academy/workingLevel'
import type { AcademyState, AppState, Profile } from '../types'

/**
 * ACADEMY-LEVEL-DECOUPLE — the canonical persistence model must be able to
 * REPRESENT a decoupled learner, or every save of one would be rejected and the
 * whole household dataset quarantined. It must also keep refusing an enrollment
 * in a level nobody assigned, which is the anti-tamper property the old
 * `academy.grade === profile.grade` rule provided.
 */

const academyAt = (
  grade: '5' | '7' | '8',
  courseIds: string[] = [`ma-g${grade}-mathematics`],
): AcademyState => ({
  releaseVersion: '1.0.0',
  grade,
  enrolledAt: '2026-08-04T12:00:00.000Z',
  courseIds,
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

  it('accepts mathematics 5 + ELA 7 held at once, with a course from each level', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5', 'english-language-arts': '7' },
        academy: academyAt('5', ['ma-g5-mathematics', 'ma-g7-english-language-arts']),
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

// ---------- ACADEMY-LEVEL-DECOUPLE-C fix 1 ----------

describe('a working level must be a level the release actually publishes', () => {
  it.each(['3', '4', '6', '10', '12'])(
    'rejects the nominal-only grade %s as a working level',
    (level) => {
      const candidate = stateWith(
        sixthGrader({ workingLevels: { mathematics: level } as Profile['workingLevels'] }),
      )
      expect(validateAppStateForSync(candidate).ok).toBe(false)
    },
  )

  it.each(['5', '7', '8'])('accepts the academy level %s', (level) => {
    const candidate = stateWith(
      sixthGrader({ workingLevels: { mathematics: level } as Profile['workingLevels'] }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })
})

// ---------- ACADEMY-LEVEL-DECOUPLE-C fix 2 ----------

describe('course records are scoped to the SUBJECT that authorized the level', () => {
  /** The regression the review caught: assigning mathematics to Grade 5 must
   * not admit Grade 5 science, which a bare set of allowed levels permitted. */
  it('rejects a Grade 5 science course when only mathematics is assigned Grade 5', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5' },
        academy: academyAt('5', ['ma-g5-science']),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('rejects a Grade 5 science course smuggled alongside a legitimate one', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5' },
        academy: academyAt('5', ['ma-g5-mathematics', 'ma-g5-science']),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('accepts the Grade 5 mathematics course that assignment did authorize', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5' },
        academy: academyAt('5', ['ma-g5-mathematics']),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('accepts a Grade 7 ELA course when ELA is assigned Grade 7', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { 'english-language-arts': '7' },
        academy: academyAt('7', ['ma-g7-english-language-arts']),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('rejects the right subject at the wrong level', () => {
    const candidate = stateWith(
      sixthGrader({
        workingLevels: { mathematics: '5', 'english-language-arts': '7' },
        academy: academyAt('5', ['ma-g7-mathematics']),
      }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('rejects a course id whose level and subject cannot be read', () => {
    for (const courseId of ['mathematics', 'ma-g5', 'ma-g6-mathematics', 'ma-g5-Mathematics', '']) {
      const candidate = stateWith(
        sixthGrader({
          workingLevels: { mathematics: '5' },
          academy: academyAt('5', [courseId]),
        }),
      )
      expect(validateAppStateForSync(candidate).ok).toBe(false)
    }
  })

  it('an undecoupled Grade 5 profile still holds every Grade 5 subject', () => {
    const candidate = stateWith({
      ...emptyProfile('p3', 'Fifth Grader', '5'),
      academy: academyAt('5', ['ma-g5-mathematics', 'ma-g5-science', 'ma-g5-health']),
    })
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('an undecoupled Grade 5 profile still cannot hold another level’s course', () => {
    const candidate = stateWith({
      ...emptyProfile('p3', 'Fifth Grader', '5'),
      academy: academyAt('5', ['ma-g5-mathematics', 'ma-g7-science']),
    })
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })
})

// ---------- ACADEMY-LEVEL-DECOUPLE-C2 ----------

/**
 * `SET.has(String(x))` coerces before testing membership, so numeric 5 passed a
 * field typed as the string union '5' | '7' | '8'. It granted no unauthorized
 * course — authorization lives on courseIds — but malformed data must not cross
 * the sync boundary at all.
 */
describe('enumerated academy fields refuse non-string values', () => {
  /** A fifth grader enrolled at her own level: valid except for the mutation. */
  const enrolled = (mutate: (a: Record<string, unknown>) => void): unknown => {
    const academy = JSON.parse(JSON.stringify(academyAt('5'))) as Record<string, unknown>
    academy.lessons = {
      'ma-g5-mathematics-u01-l01': {
        status: 'complete',
        segmentIndex: 1,
        releaseVersion: '1.0.0',
        startedAt: '2026-08-04T12:00:00.000Z',
        occasions: [{ date: '2026-08-04', mode: 'independent', met: true, kind: 'lesson-check' }],
      },
    }
    academy.assessments = {
      'ma-g5-mathematics-u01-assessment': [
        { date: '2026-08-10', percent: 88, outcome: 'secure' },
      ],
    }
    mutate(academy)
    return stateWith({
      ...emptyProfile('p3', 'Fifth Grader', '5'),
      academy: academy as unknown as AcademyState,
    })
  }

  const lesson = (a: Record<string, unknown>) =>
    (a.lessons as Record<string, Record<string, unknown>>)['ma-g5-mathematics-u01-l01']

  it('the unmutated fixture is valid', () => {
    expect(validateAppStateForSync(enrolled(() => {})).ok).toBe(true)
  })

  it.each([5, 7, 8])('rejects the numeric academy grade %s', (grade) => {
    expect(validateAppStateForSync(enrolled((a) => { a.grade = grade })).ok).toBe(false)
  })

  it.each([
    ['boolean', true],
    ['null', null],
    ['array', ['5']],
    ['object', { grade: '5' }],
  ])('rejects a %s academy grade', (_label, grade) => {
    expect(validateAppStateForSync(enrolled((a) => { a.grade = grade })).ok).toBe(false)
  })

  it.each(['5', '7', '8'])('still accepts the string academy grade %s', (grade) => {
    // All three pass: `grade` is shape-checked only. Authorization lives on
    // courseIds (still ma-g5-mathematics here), which is the C-round design —
    // a stale label cannot block a save, and it grants nothing on its own.
    expect(validateAppStateForSync(enrolled((a) => { a.grade = grade })).ok).toBe(true)
  })

  it('accepts every string academy grade once the profile is authorized for it', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const candidate = stateWith(
        sixthGrader({
          workingLevels: { mathematics: grade },
          academy: academyAt(grade, [`ma-g${grade}-mathematics`]),
        }),
      )
      expect(validateAppStateForSync(candidate).ok).toBe(true)
    }
  })

  it('rejects non-string lesson status, occasion mode/kind, and assessment outcome', () => {
    const cases: ((a: Record<string, unknown>) => void)[] = [
      (a) => { lesson(a).status = 1 },
      (a) => { lesson(a).status = null },
      (a) => { (lesson(a).occasions as Record<string, unknown>[])[0].mode = 1 },
      (a) => { (lesson(a).occasions as Record<string, unknown>[])[0].kind = ['lesson-check'] },
      (a) => {
        ;(a.assessments as Record<string, Record<string, unknown>[]>)[
          'ma-g5-mathematics-u01-assessment'
        ][0].outcome = 0
      },
    ]
    for (const mutate of cases) {
      expect(validateAppStateForSync(enrolled(mutate)).ok).toBe(false)
    }
  })

  it.each([5, 7, 8])('rejects the numeric working level %s', (level) => {
    const candidate = stateWith(
      sixthGrader({ workingLevels: { mathematics: level } as unknown as Profile['workingLevels'] }),
    )
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })
})

// ---------- the state a real parent action leaves behind ----------

/**
 * Subject-scoped course validation is only safe if the app never PRODUCES a
 * state it would refuse. persistDatasetVerified validates before writing and
 * datasetFingerprint throws on an invalid state, so a parent action that left
 * a stale course record would stop the household saving anything at all.
 */
describe('changing a working level leaves a state that still persists', () => {
  const enrolledAtFive = (): Profile => ({
    ...setWorkingLevel(emptyProfile('p3', 'Sixth Grader', '6'), 'mathematics', '5'),
    academy: {
      releaseVersion: '1.0.0',
      grade: '5',
      enrolledAt: '2026-08-04T12:00:00.000Z',
      courseIds: ['ma-g5-mathematics'],
      lessons: {
        'ma-g5-mathematics-u01-l01': {
          status: 'complete',
          segmentIndex: 3,
          releaseVersion: '1.0.0',
          startedAt: '2026-08-04T12:00:00.000Z',
          completedAt: '2026-08-04T13:00:00.000Z',
          occasions: [{ date: '2026-08-04', mode: 'independent', met: true, kind: 'lesson-check' }],
        },
      },
      assessments: {
        'ma-g5-mathematics-u01-assessment': [
          { date: '2026-08-10', percent: 88, outcome: 'secure' },
        ],
      },
    },
  })

  it('the enrolled starting state is valid', () => {
    expect(validateAppStateForSync(stateWith(enrolledAtFive())).ok).toBe(true)
  })

  it('moving mathematics 5 → 7 stays valid', () => {
    const moved = setWorkingLevel(enrolledAtFive(), 'mathematics', '7')
    expect(validateAppStateForSync(stateWith(moved)).ok).toBe(true)
  })

  it('clearing the level entirely stays valid', () => {
    const cleared = setWorkingLevel(enrolledAtFive(), 'mathematics', null)
    expect(validateAppStateForSync(stateWith(cleared)).ok).toBe(true)
  })

  it('drops only the now-unauthorized course — never her finished work', () => {
    const moved = setWorkingLevel(enrolledAtFive(), 'mathematics', '7')
    expect(moved.academy?.courseIds).toEqual([])
    expect(Object.keys(moved.academy!.lessons)).toEqual(['ma-g5-mathematics-u01-l01'])
    expect(moved.academy!.lessons['ma-g5-mathematics-u01-l01'].completedAt).toBe(
      '2026-08-04T13:00:00.000Z',
    )
    expect(moved.academy!.assessments['ma-g5-mathematics-u01-assessment']).toHaveLength(1)
  })

  it('leaves an unrelated subject’s enrollment alone', () => {
    const both: Profile = {
      ...setWorkingLevel(
        setWorkingLevel(emptyProfile('p3', 'Sixth Grader', '6'), 'mathematics', '5'),
        'english-language-arts',
        '7',
      ),
      academy: academyAt('5', ['ma-g5-mathematics', 'ma-g7-english-language-arts']),
    }
    const moved = setWorkingLevel(both, 'mathematics', '8')
    expect(moved.academy?.courseIds).toEqual(['ma-g7-english-language-arts'])
    expect(validateAppStateForSync(stateWith(moved)).ok).toBe(true)
  })
})
