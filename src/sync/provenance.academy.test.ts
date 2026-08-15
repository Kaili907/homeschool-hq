import { describe, expect, it } from 'vitest'
import { validateAppStateForSync } from './provenance'
import { defaultAppState, emptyProfile } from '../migration'
import { ACADEMY_GRADES, type AcademyState, type AppState } from '../types'

/**
 * CURR-1 — the canonical persistence model must represent supported profiles
 * and their academy progress, and must keep rejecting malformed payloads.
 */

const academy: AcademyState = {
  releaseVersion: '1.0.0',
  grade: '5',
  enrolledAt: '2026-08-04T12:00:00.000Z',
  courseIds: ['ma-g5-mathematics'],
  lessons: {
    'ma-g5-mathematics-u01-l01': {
      status: 'complete',
      segmentIndex: 5,
      releaseVersion: '1.0.0',
      startedAt: '2026-08-04T12:00:00.000Z',
      completedAt: '2026-08-04T13:00:00.000Z',
      revisits: 1,
      occasions: [
        { date: '2026-08-04', mode: 'guided', met: true, kind: 'lesson-check' },
        { date: '2026-08-06', mode: 'independent', met: true, kind: 'reassessment' },
      ],
    },
  },
  assessments: {
    'ma-g5-mathematics-u01-assessment': [
      { date: '2026-08-10', percent: 88, outcome: 'secure' },
    ],
  },
}

function stateWith(mutate: (s: AppState) => void): unknown {
  const s = defaultAppState()
  s.profiles.p2 = {
    ...emptyProfile('p2', 'Fifth Grader', '5'),
    academy: JSON.parse(JSON.stringify(academy)) as AcademyState,
  }
  mutate(s)
  return JSON.parse(JSON.stringify(s))
}

describe('CURR-1 sync validation for academy grades + state', () => {
  it('accepts every supported Academy grade carrying progress', () => {
    for (const grade of ACADEMY_GRADES) {
      const candidate = stateWith((s) => {
        s.profiles.p2.grade = grade
        // ACADEMY-LEVEL-DECOUPLE-C: course records are now scoped to the level
        // the profile is authorized for, so the course must move with the grade.
        s.profiles.p2.academy = {
          ...academy,
          grade,
          courseIds: [`ma-g${grade}-mathematics`],
        }
      })
      expect(validateAppStateForSync(candidate).ok).toBe(true)
    }
  })

  it('still rejects grades outside the canonical model', () => {
    const candidate = stateWith((s) => {
      ;(s.profiles.p2 as { grade: string }).grade = '13'
    })
    expect(validateAppStateForSync(candidate).ok).toBe(false)
  })

  it('rejects malformed academy payloads (bad status, mode, outcome, percent)', () => {
    const cases: ((a: Record<string, unknown>) => void)[] = [
      (a) => {
        ;(a.lessons as Record<string, Record<string, unknown>>)['ma-g5-mathematics-u01-l01'].status =
          'done'
      },
      (a) => {
        ;(
          (a.lessons as Record<string, Record<string, unknown>>)['ma-g5-mathematics-u01-l01']
            .occasions as Record<string, unknown>[]
        )[0].mode = 'psychic'
      },
      (a) => {
        ;(
          (a.assessments as Record<string, Record<string, unknown>[]>)[
            'ma-g5-mathematics-u01-assessment'
          ]
        )[0].outcome = 'perfect'
      },
      (a) => {
        ;(
          (a.assessments as Record<string, Record<string, unknown>[]>)[
            'ma-g5-mathematics-u01-assessment'
          ]
        )[0].percent = 'ninety'
      },
      (a) => {
        a.grade = '6'
      },
      (a) => {
        a.releaseVersion = 42
      },
    ]
    for (const mutate of cases) {
      const candidate = stateWith((s) => {
        const cloned = JSON.parse(JSON.stringify(academy)) as Record<string, unknown>
        mutate(cloned)
        ;(s.profiles.p2 as unknown as Record<string, unknown>).academy = cloned
      })
      expect(validateAppStateForSync(candidate).ok).toBe(false)
    }
  })

  it('accepts composed Academy and SCHED-1 state on the same profile', () => {
    const candidate = stateWith((s) => {
      s.profiles.p2.scheduleExtensions = [
        {
          id: 'academy-extra-1',
          label: 'Academy lab',
          days: ['Fri'],
          start: '13:00',
          end: '13:30',
        },
      ]
    })
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })

  it('rejects out-of-domain academy percentages, counters, and cross-grade state', () => {
    const cases: ((s: AppState) => void)[] = [
      (s) => {
        s.profiles.p2.academy!.assessments['ma-g5-mathematics-u01-assessment'][0].percent = 101
      },
      (s) => {
        s.profiles.p2.academy!.assessments['ma-g5-mathematics-u01-assessment'][0].percent = -1
      },
      (s) => {
        s.profiles.p2.academy!.lessons['ma-g5-mathematics-u01-l01'].segmentIndex = -1
      },
      (s) => {
        s.profiles.p2.academy!.lessons['ma-g5-mathematics-u01-l01'].revisits = -1
      },
      (s) => {
        s.profiles.p2.grade = '7'
      },
    ]
    for (const mutate of cases) {
      expect(validateAppStateForSync(stateWith(mutate)).ok).toBe(false)
    }
  })

  it('profiles without academy state stay valid (additive field)', () => {
    const candidate = stateWith((s) => {
      delete s.profiles.p2.academy
    })
    expect(validateAppStateForSync(candidate).ok).toBe(true)
  })
})
