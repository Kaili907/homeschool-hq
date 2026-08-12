import { describe, expect, it } from 'vitest'
import {
  buildPilotCalendarDraft,
  buildPilotStudyPlan,
  resolvePilotLessonContent,
  validatePilotLessonForStudy,
} from './pilotContentBridge'
import { loadFamilyPilotCatalog } from '../../../curriculum/family-pilot/source.node'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import { deriveStudyHouseholdRef, deriveStudyLearnerRef } from '../../hostContext'
import type { FamilyPilotCatalog } from '../../../curriculum/family-pilot/types'

const REAL_CATALOG = loadFamilyPilotCatalog()

function courseFor(catalog: FamilyPilotCatalog, grade: '5' | '7' | '8') {
  const course = catalog.courses.find((candidate) => candidate.grade === grade)
  if (!course) throw new Error(`fixture setup: no course for grade ${grade}`)
  return course
}

describe('FAMILY-PILOT-CONTENT-BRIDGE-1 resolvePilotLessonContent', () => {
  it.each(['5', '7', '8'] as const)('resolves the first, middle, and last lesson of the grade %s math course', (grade) => {
    const course = courseFor(REAL_CATALOG, grade)
    const positions = [0, Math.floor(course.lessons.length / 2), course.lessons.length - 1]
    for (const index of positions) {
      const lessonRef = course.lessons[index].lessonId
      const resolution = resolvePilotLessonContent(REAL_CATALOG, lessonRef)
      expect(resolution.status).toBe('ready')
      if (resolution.status !== 'ready') continue
      expect(resolution.lesson.lessonId).toBe(lessonRef)
      expect(resolution.course.grade).toBe(grade)
      expect(resolution.unit.lessonIds).toContain(lessonRef)
    }
  })

  it('returns a blocked result for an invalid lessonRef instead of throwing', () => {
    const resolution = resolvePilotLessonContent(REAL_CATALOG, 'does-not-exist')
    expect(resolution).toEqual({ status: 'blocked', reason: 'lesson-not-found', lessonRef: 'does-not-exist' })
  })

  it('returns a blocked result when a lesson references content missing from the catalog', () => {
    const malformed: FamilyPilotCatalog = {
      releaseVersion: '0.0.0-fixture',
      courses: [{
        courseId: 'ma-g5-mathematics',
        grade: '5',
        subject: 'mathematics',
        title: 'Grade 5 Mathematics',
        units: [], // the lesson below claims unit u01, but no unit is defined
        lessons: [{
          lessonId: 'ma-g5-mathematics-l1',
          courseId: 'ma-g5-mathematics',
          grade: '5',
          unitId: 'u01',
          unitNumber: 1,
          dayInUnit: 1,
          courseDay: 1,
          title: 'Lesson 1',
        }],
      }],
    }
    const resolution = resolvePilotLessonContent(malformed, 'ma-g5-mathematics-l1')
    expect(resolution).toEqual({ status: 'blocked', reason: 'lesson-not-found', lessonRef: 'ma-g5-mathematics-l1' })
  })

  it('never carries lesson-body fields — only refs and display metadata', () => {
    const lessonRef = courseFor(REAL_CATALOG, '5').lessons[0].lessonId
    const resolution = resolvePilotLessonContent(REAL_CATALOG, lessonRef)
    expect(resolution.status).toBe('ready')
    if (resolution.status !== 'ready') return
    expect(Object.keys(resolution.lesson).sort()).toEqual(
      ['courseDay', 'courseId', 'dayInUnit', 'grade', 'lessonId', 'title', 'unitId', 'unitNumber'].sort(),
    )
  })
})

describe('FAMILY-PILOT-CONTENT-BRIDGE-1 buildPilotStudyPlan', () => {
  it.each(['5', '7', '8'] as const)('adapts a grade %s math lesson into a Study plan with canonical math segments', (grade) => {
    const course = courseFor(REAL_CATALOG, grade)
    const lessonRef = course.lessons[0].lessonId
    const result = buildPilotStudyPlan(REAL_CATALOG, lessonRef)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.plan.lessonRef).toBe(lessonRef)
    expect(result.plan.title).toBe(course.lessons[0].title)
    expect(result.plan.subject).toBe('math')
    expect(result.plan.source).toBe('manuel-academy')
    expect(result.plan.segments.map((segment) => segment.taskType)).toEqual([
      'retrieval-practice', 'direct-instruction', 'guided-practice', 'independent-practice', 'mastery-check',
    ])
  })

  it('produces the same segment refs, order, and count across repeated calls (deterministic)', () => {
    const lessonRef = courseFor(REAL_CATALOG, '7').lessons[3].lessonId
    const first = buildPilotStudyPlan(REAL_CATALOG, lessonRef)
    const second = buildPilotStudyPlan(REAL_CATALOG, lessonRef)
    expect(first).toEqual(second)
    if (first.status !== 'ready') throw new Error('fixture setup: expected a ready plan')
    expect(first.plan.segments.map((segment) => segment.segmentRef)).toEqual([
      `${lessonRef}:segment:retrieve`,
      `${lessonRef}:segment:teach`,
      `${lessonRef}:segment:guide`,
      `${lessonRef}:segment:try`,
      `${lessonRef}:segment:check`,
    ])
  })

  it('returns a blocked result for an invalid lessonRef instead of throwing', () => {
    expect(buildPilotStudyPlan(REAL_CATALOG, 'does-not-exist')).toEqual({
      status: 'blocked', reason: 'lesson-not-found', lessonRef: 'does-not-exist',
    })
  })

  it('does not duplicate the lesson body into the Study plan — only refs, title, and canonical segments', () => {
    const lessonRef = courseFor(REAL_CATALOG, '8').lessons[0].lessonId
    const result = buildPilotStudyPlan(REAL_CATALOG, lessonRef)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(Object.keys(result.plan).sort()).toEqual(
      ['lessonRef', 'title', 'subject', 'skillRefs', 'segments', 'masteryAuthority', 'source'].sort(),
    )
    for (const segment of result.plan.segments) {
      expect(Object.keys(segment).sort()).toEqual(
        ['segmentRef', 'title', 'taskType', 'estimatedMinutes', 'required'].sort(),
      )
    }
  })
})

describe('FAMILY-PILOT-CONTENT-BRIDGE-1 validatePilotLessonForStudy', () => {
  it('reports ready for every lesson a real grade course exposes', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const course = courseFor(REAL_CATALOG, grade)
      for (const lesson of [course.lessons[0], course.lessons[course.lessons.length - 1]]) {
        expect(validatePilotLessonForStudy(REAL_CATALOG, lesson.lessonId).status).toBe('ready')
      }
    }
  })

  it('reports a PILOT_BLOCKER for a lessonRef the catalog does not contain', () => {
    expect(validatePilotLessonForStudy(REAL_CATALOG, 'does-not-exist')).toEqual({
      status: 'blocked', reason: 'lesson-not-found', lessonRef: 'does-not-exist',
    })
  })
})

describe('FAMILY-PILOT-CONTENT-BRIDGE-1 buildPilotCalendarDraft', () => {
  it('builds a draft the existing Study calendar port accepts', async () => {
    const course = courseFor(REAL_CATALOG, '5')
    const lessonRef = course.lessons[0].lessonId
    const student = { studentRef: 'family-pilot-student-1', grade: '5' as const }
    const result = buildPilotCalendarDraft(REAL_CATALOG, student, lessonRef, {
      householdTimeZone: 'America/Chicago',
      instant: new Date('2026-08-12T14:00:00.000Z'),
      timerHidden: false,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    const { ports } = createLocalDevelopmentStudyPorts()
    const scope = {
      householdRef: deriveStudyHouseholdRef(student.studentRef),
      learnerRef: deriveStudyLearnerRef(student.studentRef, student.studentRef),
    }
    const entry = await ports.calendar.create(scope, result.draft)
    expect(entry.lessonRef).toBe(lessonRef)
    expect(entry.subject).toBe('math')
    expect(entry.state).toBe('scheduled')
  })

  it('returns a blocked result for an invalid lessonRef instead of throwing', () => {
    const student = { studentRef: 'family-pilot-student-1', grade: '5' as const }
    const result = buildPilotCalendarDraft(REAL_CATALOG, student, 'does-not-exist', {
      householdTimeZone: 'America/Chicago',
      instant: new Date('2026-08-12T14:00:00.000Z'),
      timerHidden: false,
    })
    expect(result).toEqual({ status: 'blocked', reason: 'lesson-not-found', lessonRef: 'does-not-exist' })
  })
})
