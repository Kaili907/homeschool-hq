import { describe, expect, it } from 'vitest'
import type { AcademyCatalog } from './contentTypes'
import type { Profile } from '../types'
import { emptyProfile } from '../migration'
import {
  completeSegment,
  courseProgress,
  emptyAcademyState,
  enrollInCatalog,
  isStaleAttempt,
  latestAssessmentAttempt,
  masteryOf,
  recordAssessmentAttempt,
  recordReassessment,
  reopenLesson,
  startLesson,
  submitLessonCheck,
} from './academyState'

const NOW = '2026-08-04T12:00:00.000Z'
const L1 = 'ma-g5-mathematics-u01-l01'

const catalog: AcademyCatalog = {
  releaseVersion: '1.0.0',
  grade: '5',
  courses: [
    {
      courseId: 'ma-g5-mathematics',
      subject: 'mathematics',
      lessonCount: 2,
      units: [
        {
          unitId: 'ma-g5-mathematics-u01',
          unitNumber: 1,
          title: 'Unit One',
          days: 2,
          essentialQuestion: 'Q?',
          performanceTask: 'Task',
          lessonIds: [L1, 'ma-g5-mathematics-u01-l02'],
          hasAssessment: true,
        },
      ],
    },
  ],
}

function enrolled(): Profile {
  const p = emptyProfile('p2', 'Fifth Grader', '5')
  return enrollInCatalog(p, catalog, NOW)
}

describe('CURR-1 enrollment', () => {
  it('enrolls in every catalog course and pins the release version', () => {
    const p = enrolled()
    expect(p.academy?.releaseVersion).toBe('1.0.0')
    expect(p.academy?.grade).toBe('5')
    expect(p.academy?.courseIds).toEqual(['ma-g5-mathematics'])
  })

  it('re-enrolling preserves existing lesson state', () => {
    let p = enrolled()
    p = startLesson(p, L1, NOW)
    p = completeSegment(p, L1, 0)
    const again = enrollInCatalog(p, catalog, '2026-09-01T00:00:00.000Z')
    expect(again.academy?.lessons[L1].segmentIndex).toBe(1)
    expect(again.academy?.enrolledAt).toBe(NOW)
  })
})

describe('CURR-1 start / resume', () => {
  it('a fresh start opens at segment 0, in progress', () => {
    const p = startLesson(enrolled(), L1, NOW)
    expect(p.academy?.lessons[L1]).toMatchObject({
      status: 'in-progress',
      segmentIndex: 0,
      releaseVersion: '1.0.0',
      startedAt: NOW,
    })
  })

  it('starting an existing attempt is a no-op (exact resume preserved)', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = completeSegment(p, L1, 0)
    p = completeSegment(p, L1, 1)
    const resumed = startLesson(p, L1, '2026-08-05T09:00:00.000Z')
    expect(resumed.academy?.lessons[L1].segmentIndex).toBe(2)
    expect(resumed.academy?.lessons[L1].startedAt).toBe(NOW)
  })

  it('the segment pointer never moves backwards', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = completeSegment(p, L1, 3)
    p = completeSegment(p, L1, 1) // repeat of an earlier step
    expect(p.academy?.lessons[L1].segmentIndex).toBe(4)
  })

  it('segment completion on an unstarted lesson is a no-op', () => {
    const p = completeSegment(enrolled(), L1, 0)
    expect(p.academy?.lessons[L1]).toBeUndefined()
  })
})

describe('CURR-1 completion, duplicates, reteach', () => {
  const check = (met: boolean, mode: 'guided' | 'independent' = 'independent', date = '2026-08-04') => ({
    date,
    mode,
    met,
    now: `${date}T15:00:00.000Z`,
  })

  it('a met check completes the lesson once', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = submitLessonCheck(p, L1, check(true))
    const lesson = p.academy!.lessons[L1]
    expect(lesson.status).toBe('complete')
    expect(lesson.completedAt).toBe('2026-08-04T15:00:00.000Z')
  })

  it('duplicate completion never overwrites the first completedAt (counts a revisit)', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = submitLessonCheck(p, L1, check(true))
    p = submitLessonCheck(p, L1, check(true, 'independent', '2026-08-06'))
    const lesson = p.academy!.lessons[L1]
    expect(lesson.completedAt).toBe('2026-08-04T15:00:00.000Z')
    expect(lesson.revisits).toBe(1)
    expect(lesson.occasions).toHaveLength(2)
  })

  it('an unmet check routes to reteach, and a later reassessment can complete', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = submitLessonCheck(p, L1, check(false))
    expect(p.academy!.lessons[L1].status).toBe('reteach')
    p = recordReassessment(p, L1, check(true, 'independent', '2026-08-05'))
    expect(p.academy!.lessons[L1].status).toBe('complete')
    expect(p.academy!.lessons[L1].occasions.map((o) => o.kind)).toEqual([
      'lesson-check',
      'reassessment',
    ])
  })

  it('reopening a completed lesson keeps its completion record', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = submitLessonCheck(p, L1, check(true))
    p = reopenLesson(p, L1, 0)
    expect(p.academy!.lessons[L1].completedAt).toBeDefined()
    expect(p.academy!.lessons[L1].segmentIndex).toBe(0)
  })
})

describe('CURR-1 mastery rule (multi-occasion, guided vs independent)', () => {
  const occasion = (date: string, mode: 'guided' | 'independent', met = true) => ({
    date,
    mode,
    met,
    kind: 'lesson-check' as const,
  })
  const lessonWith = (occasions: ReturnType<typeof occasion>[]) => ({
    status: 'complete' as const,
    segmentIndex: 5,
    releaseVersion: '1.0.0',
    startedAt: NOW,
    occasions,
  })

  it('a single successful answer can NEVER establish mastery', () => {
    expect(masteryOf(lessonWith([occasion('2026-08-04', 'independent')]))).toBe('developing')
  })

  it('two successes on the same day are one occasion in time — not mastery', () => {
    expect(
      masteryOf(lessonWith([occasion('2026-08-04', 'independent'), occasion('2026-08-04', 'independent')])),
    ).toBe('developing')
  })

  it('guided-only evidence is not mastery even across days', () => {
    expect(
      masteryOf(lessonWith([occasion('2026-08-04', 'guided'), occasion('2026-08-06', 'guided')])),
    ).toBe('developing')
  })

  it('two met occasions across days with independent evidence = mastered', () => {
    expect(
      masteryOf(lessonWith([occasion('2026-08-04', 'guided'), occasion('2026-08-06', 'independent')])),
    ).toBe('mastered')
  })

  it('unmet occasions do not count toward mastery', () => {
    expect(
      masteryOf(
        lessonWith([
          occasion('2026-08-04', 'independent', false),
          occasion('2026-08-06', 'independent'),
        ]),
      ),
    ).toBe('developing')
  })

  it('untouched lessons are not-started', () => {
    expect(masteryOf(undefined)).toBe('not-started')
  })
})

describe('CURR-1 stale-attempt protection', () => {
  it('an attempt from another release is stale once the enrollment moves on', () => {
    let p = startLesson(enrolled(), L1, NOW)
    expect(isStaleAttempt(p, L1)).toBe(false)
    p = { ...p, academy: { ...p.academy!, releaseVersion: '2.0.0' } }
    expect(isStaleAttempt(p, L1)).toBe(true)
  })
})

describe('CURR-1 assessments (reassessment = append-only attempts)', () => {
  const A = 'ma-g5-mathematics-u01-assessment'
  it('records attempts append-only and surfaces the latest', () => {
    let p = enrolled()
    expect(latestAssessmentAttempt(p, A)).toBeNull()
    p = recordAssessmentAttempt(p, A, { date: '2026-08-04', percent: 62, outcome: 'not-yet' })
    p = recordAssessmentAttempt(p, A, { date: '2026-08-11', percent: 88, outcome: 'secure' })
    expect(p.academy!.assessments[A]).toHaveLength(2)
    expect(latestAssessmentAttempt(p, A)).toMatchObject({ percent: 88, outcome: 'secure' })
  })
})

describe('CURR-1 progress rollup', () => {
  it('summarizes per-course completion, mastery, and reteach', () => {
    let p = startLesson(enrolled(), L1, NOW)
    p = submitLessonCheck(p, L1, { date: '2026-08-04', mode: 'guided', met: true, now: NOW })
    p = recordReassessment(p, L1, {
      date: '2026-08-06',
      mode: 'independent',
      met: true,
      now: '2026-08-06T15:00:00.000Z',
    })
    const [math] = courseProgress(p, catalog)
    expect(math).toEqual({
      courseId: 'ma-g5-mathematics',
      total: 2,
      completed: 1,
      mastered: 1,
      reteach: 0,
    })
  })
})

describe('CURR-1 cross-profile isolation', () => {
  it('academy state never leaks across profile objects', () => {
    const p2 = enrolled()
    const p3 = emptyProfile('p3', 'Sixth Grader', '6')
    const after = startLesson(p2, L1, NOW)
    expect(p3.academy).toBeUndefined()
    expect(after).not.toBe(p2)
    expect(p2.academy!.lessons[L1]).toBeUndefined()
    expect(emptyAcademyState('7', NOW).lessons).toEqual({})
  })
})
