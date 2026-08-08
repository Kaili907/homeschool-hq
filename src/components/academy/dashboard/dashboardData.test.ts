import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../../../migration'
import { enrollInCatalog, startLesson, submitLessonCheck } from '../../../academy/academyState'
import type { AcademyCatalog, AcademySchedule } from '../../../academy/contentTypes'
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

function dashboard(p = profile(), schedule = mondaySchedule, today = '2026-08-03') {
  return buildStudentDashboardData({
    profile: p,
    catalog,
    schedule,
    levelOf: { 'ma-g5-mathematics': '5', 'ma-g7-english-language-arts': '7' },
    schoolYear: undefined,
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

  it('prefers an in-progress scheduled lesson over earlier untouched work', () => {
    const p = startLesson(profile(), MATH_2, NOW)
    const data = dashboard(p)
    expect(data.upNext?.lessonId).toBe(MATH_2)
    expect(data.upNext?.status).toBe('in-progress')
  })

  it('uses the earliest unfinished scheduled lesson when none is in progress', () => {
    const data = dashboard()
    expect(data.upNext?.lessonId).toBe(MATH_1)
    expect(data.upNext?.status).toBe('not-started')
  })

  it('keeps a reteach lesson visibly distinct and incomplete', () => {
    let p = startLesson(profile(), MATH_1, NOW)
    p = submitLessonCheck(p, MATH_1, { date: '2026-08-03', mode: 'guided', met: false, now: NOW })
    const data = dashboard(p)
    expect(data.lessons[0].status).toBe('ready-to-revisit')
    expect(data.completedCount).toBe(0)
  })

  it('shows a deliberate all-complete state only when every scheduled lesson is complete', () => {
    let p = profile()
    for (const lessonId of [MATH_1, MATH_2, ELA_1]) {
      p = startLesson(p, lessonId, NOW)
      p = submitLessonCheck(p, lessonId, { date: '2026-08-03', mode: 'independent', met: true, now: NOW })
    }
    const data = dashboard(p)
    expect(data).toMatchObject({ completedCount: 3, hasScheduledWork: true, allWorkComplete: true, upNext: null })
  })

  it('shows no-work data for a weekend instead of manufacturing work', () => {
    const data = dashboard(profile(), mondaySchedule, '2026-08-09')
    expect(data).toMatchObject({ hasScheduledWork: false, allWorkComplete: false, completedCount: 0, upNext: null })
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
