import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../../../migration'
import { enrollInCatalog, startLesson, submitLessonCheck } from '../../../academy/academyState'
import type { AcademyCatalog, AcademySchedule } from '../../../academy/contentTypes'
import type { SchoolYear } from '../../../types'
import {
  buildStudentDashboardData,
  dashboardLessonRoute,
} from './dashboardData'

const MATH_1 = 'ma-g5-mathematics-u01-l01'
const MATH_2 = 'ma-g5-mathematics-u01-l02'
const ELA_1 = 'ma-g7-english-language-arts-u01-l01'
const NOW = '2026-08-03T09:00:00.000Z'

const catalog: AcademyCatalog = {
  releaseVersion: '1.0.0',
  grade: '5',
  courses: [
    {
      courseId: 'ma-g5-mathematics', subject: 'mathematics', lessonCount: 2,
      units: [{ unitId: 'ma-g5-mathematics-u01', unitNumber: 1, title: 'Numbers', days: 2, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [MATH_1, MATH_2], hasAssessment: false }],
    },
    {
      courseId: 'ma-g7-english-language-arts', subject: 'english-language-arts', lessonCount: 1,
      units: [{ unitId: 'ma-g7-english-language-arts-u01', unitNumber: 1, title: 'Reading', days: 1, essentialQuestion: 'Why?', performanceTask: 'Work', lessonIds: [ELA_1], hasAssessment: false }],
    },
  ],
}

const mondaySchedule: AcademySchedule = {
  releaseVersion: '1.0.0', grade: '5',
  days: [{ week: 1, day: 1, lessons: [
    { lessonId: MATH_1, title: 'Fractions in context' },
    { lessonId: MATH_2, title: 'Equivalent fractions' },
    { lessonId: ELA_1, title: 'Evidence in a text' },
  ] }],
}

function profile() {
  return enrollInCatalog(emptyProfile('p1', 'Avery Student', '6'), catalog, NOW)
}

function completeLesson(p: ReturnType<typeof profile>, lessonId: string) {
  return submitLessonCheck(startLesson(p, lessonId, NOW), lessonId, {
    date: '2026-08-03', mode: 'independent', met: true, now: NOW,
  })
}

function staleAttempt(p: ReturnType<typeof profile>, lessonId: string) {
  const started = startLesson(p, lessonId, NOW)
  const lesson = started.academy?.lessons[lessonId]
  if (!started.academy || !lesson) throw new Error('Expected an enrolled lesson attempt')
  return {
    ...started,
    academy: {
      ...started.academy,
      lessons: {
        ...started.academy.lessons,
        [lessonId]: { ...lesson, releaseVersion: '0.9.0' },
      },
    },
  }
}

function dashboard(
  p = profile(),
  schedule = mondaySchedule,
  today = '2026-08-03',
  schoolYear?: SchoolYear,
) {
  return buildStudentDashboardData({
    profile: p,
    catalog,
    schedule,
    levelOf: { 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7' },
    schoolYear,
    today,
  })
}

describe('Student Dashboard presentation model', () => {
  it('maps scheduled work to the learner’s real mixed-level courses', () => {
    const data = dashboard()
    expect(data.lessons.map((lesson) => [lesson.title, lesson.level])).toEqual([
      ['Fractions in context', '5'],
      ['Equivalent fractions', '5'],
      ['Evidence in a text', '7'],
    ])
    expect(data.lessons[2].course?.subject).toBe('english-language-arts')
  })

  it('uses the established week-1 fallback when the school year is unconfigured', () => {
    expect(dashboard()).toMatchObject({
      week: 1, schoolYearConfigured: false, calendarState: 'unconfigured',
    })
  })

  it('prefers a non-stale in-progress scheduled lesson over earlier untouched work', () => {
    const p = startLesson(profile(), MATH_2, NOW)
    const data = dashboard(p)
    expect(data.upNext?.lessonId).toBe(MATH_2)
    expect(data.upNext?.status).toBe('in-progress')
    expect(data.upNext?.requiresRestart).toBe(false)
  })

  it('gives resume preference only to a fresh in-progress attempt', () => {
    const p = startLesson(staleAttempt(profile(), MATH_1), ELA_1, NOW)
    const data = dashboard(p)
    expect(data.lessons[0]).toMatchObject({ status: 'in-progress', requiresRestart: true })
    expect(data.upNext).toMatchObject({ lessonId: ELA_1, status: 'in-progress', requiresRestart: false })
  })

  it('uses the earliest unfinished scheduled lesson when none is in progress', () => {
    const data = dashboard()
    expect(data.upNext?.lessonId).toBe(MATH_1)
    expect(data.upNext?.status).toBe('not-started')
  })

  it('skips completed earlier lessons when choosing the next scheduled item', () => {
    const data = dashboard(completeLesson(profile(), MATH_1))
    expect(data.completedCount).toBe(1)
    expect(data.upNext?.lessonId).toBe(MATH_2)
  })

  it('keeps a reteach lesson visibly ready to retry and incomplete', () => {
    let p = startLesson(profile(), MATH_1, NOW)
    p = submitLessonCheck(p, MATH_1, { date: '2026-08-03', mode: 'guided', met: false, now: NOW })
    const data = dashboard(p)
    expect(data.lessons[0].status).toBe('ready-to-retry')
    expect(data.upNext?.lessonId).toBe(MATH_1)
    expect(data.completedCount).toBe(0)
  })

  it('does not promote a stale attempt as resumable over untouched scheduled work', () => {
    const data = dashboard(staleAttempt(profile(), MATH_1))
    expect(data.lessons[0]).toMatchObject({ status: 'in-progress', requiresRestart: true })
    expect(data.upNext?.lessonId).toBe(MATH_2)
  })

  it('keeps a lone stale attempt actionable as a restart through its existing route', () => {
    const data = dashboard(staleAttempt(profile(), MATH_1), {
      ...mondaySchedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: MATH_1, title: 'Fractions in context' }] }],
    })
    expect(data.upNext).toBeNull()
    expect(data).toMatchObject({ hasScheduledWork: true, allWorkComplete: false })
    expect(data.restartRequiredLesson).toMatchObject({
      lessonId: MATH_1, status: 'in-progress', requiresRestart: true,
    })
    expect(dashboardLessonRoute(data.restartRequiredLesson!)).toEqual({
      kind: 'lesson', courseId: 'ma-g5-mathematics', unitNumber: 1, lessonId: MATH_1,
    })
  })

  it('keeps completed work complete even when its recorded release is old', () => {
    const completed = completeLesson(profile(), MATH_1)
    const academy = completed.academy!
    const lesson = academy.lessons[MATH_1]
    const p = {
      ...completed,
      academy: {
        ...academy,
        lessons: { ...academy.lessons, [MATH_1]: { ...lesson, releaseVersion: '0.9.0' } },
      },
    }
    expect(dashboard(p).lessons[0]).toMatchObject({ status: 'complete', requiresRestart: false })
  })

  it('shows a deliberate all-complete state only when every scheduled lesson is complete', () => {
    let p = profile()
    for (const lessonId of [MATH_1, MATH_2, ELA_1]) {
      p = completeLesson(p, lessonId)
    }
    const data = dashboard(p)
    expect(data).toMatchObject({
      completedCount: 3,
      hasScheduledWork: true,
      allWorkComplete: true,
      upNext: null,
      restartRequiredLesson: null,
    })
  })

  it('shows no-work data for a configured weekend instead of manufacturing work', () => {
    const schoolYear: SchoolYear = {
      startDate: '2026-08-03', totalWeeks: 36, quarterBreaks: [9, 18, 27], offWeeks: [],
    }
    const data = dashboard(profile(), mondaySchedule, '2026-08-09', schoolYear)
    expect(data).toMatchObject({
      calendarState: 'weekend',
      hasScheduledWork: false,
      allWorkComplete: false,
      completedCount: 0,
      upNext: null,
      restartRequiredLesson: null,
    })
  })

  it('classifies before-year copy state without changing the existing week-0 selection', () => {
    const schoolYear: SchoolYear = {
      startDate: '2026-08-10', totalWeeks: 36, quarterBreaks: [9, 18, 27], offWeeks: [],
    }
    expect(dashboard(profile(), mondaySchedule, '2026-08-03', schoolYear)).toMatchObject({
      week: 0,
      calendarState: 'before-year',
      lessons: [],
      hasScheduledWork: false,
    })
  })

  it('labels off and after-year schedules for reference without suppressing final selected lessons', () => {
    const normalYear: SchoolYear = {
      startDate: '2026-08-03', totalWeeks: 36, quarterBreaks: [9, 18, 27], offWeeks: [],
    }
    const offYear: SchoolYear = {
      ...normalYear,
      offWeeks: ['2026-08-10'],
    }
    const oneWeekYear: SchoolYear = {
      ...normalYear,
      totalWeeks: 1,
      quarterBreaks: [],
    }
    const normal = dashboard(profile(), mondaySchedule, '2026-08-03', normalYear)
    const off = dashboard(profile(), mondaySchedule, '2026-08-10', offYear)
    const after = dashboard(profile(), mondaySchedule, '2026-08-10', oneWeekYear)

    expect(normal.calendarState).toBe('normal-weekday')
    expect(off).toMatchObject({ week: 1, calendarState: 'off-week', hasScheduledWork: true })
    expect(after).toMatchObject({ week: 1, calendarState: 'after-year', hasScheduledWork: true })
    expect(off.lessons.map((lesson) => lesson.lessonId)).toEqual(
      normal.lessons.map((lesson) => lesson.lessonId),
    )
    expect(after.lessons.map((lesson) => lesson.lessonId)).toEqual(
      normal.lessons.map((lesson) => lesson.lessonId),
    )
  })

  it('returns the existing Academy lesson route for a scheduled item', () => {
    const lesson = dashboard().lessons[1]
    expect(dashboardLessonRoute(lesson)).toEqual({
      kind: 'lesson', courseId: 'ma-g5-mathematics', unitNumber: 1, lessonId: MATH_2,
    })
  })

  it('does not create a route when schedule content cannot be resolved in the catalog', () => {
    const data = dashboard(profile(), {
      ...mondaySchedule,
      days: [{ week: 1, day: 1, lessons: [{ lessonId: 'ma-g5-mathematics-u99-l99', title: 'Missing lesson' }] }],
    })
    expect(dashboardLessonRoute(data.lessons[0])).toBeNull()
  })
})
