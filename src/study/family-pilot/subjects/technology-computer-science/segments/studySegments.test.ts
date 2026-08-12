import { describe, expect, it } from 'vitest'
import { getTechCsAssignments } from '../catalog/catalog'
import { loadTechCsCatalog } from '../catalog/source.node'
import type { TechCsDayPhase, TechCsLessonRef } from '../catalog/types'
import { techCsLessonPlan, techCsLessonSegments, techCsSegmentRef } from './studySegments'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

function fixtureLesson(dayPhase: TechCsDayPhase): TechCsLessonRef {
  return {
    lessonId: 'ma-g7-technology-u02-l04',
    courseId: 'ma-g7-technology',
    grade: '7',
    unitId: 'u02',
    unitNumber: 2,
    dayInUnit: 4,
    courseDay: 10,
    title: 'Application: conditionals',
    focus: 'conditionals',
    dayPhase,
    standards: ['Michigan Computer Science: Algorithms and Programming'],
    accessibilityAndAccommodations: ['Provide readable text plus optional audio support.'],
    safetyAndPrivacy: ['Never require a real password, private message, or account credential.'],
  }
}

describe('FF-M7 Technology / CS Study segments', () => {
  it('produces the 5 canonical segments in lesson_flow order', () => {
    const segments = techCsLessonSegments(fixtureLesson('guided-practice'))
    expect(segments.map((s) => s.taskType)).toEqual([
      'retrieval-practice',
      'direct-instruction',
      'guided-practice',
      'independent-practice',
      'reflection',
    ])
  })

  it('surfaces project-work on an application-project day', () => {
    const segments = techCsLessonSegments(fixtureLesson('application-project'))
    expect(segments[3].taskType).toBe('project-work')
    expect(segments[4].taskType).toBe('reflection')
  })

  it('surfaces mastery-check on a mastery-check day', () => {
    const segments = techCsLessonSegments(fixtureLesson('mastery-check'))
    expect(segments[3].taskType).toBe('independent-practice')
    expect(segments[4].taskType).toBe('mastery-check')
  })

  it('segment refs are stable opaque strings, one per fixed suffix', () => {
    const lesson = fixtureLesson('guided-practice')
    const segments = techCsLessonSegments(lesson)
    expect(segments.map((s) => s.segmentRef)).toEqual([
      techCsSegmentRef(lesson, 'retrieve'),
      techCsSegmentRef(lesson, 'teach'),
      techCsSegmentRef(lesson, 'guide'),
      techCsSegmentRef(lesson, 'apply'),
      techCsSegmentRef(lesson, 'check'),
    ])
    for (const segment of segments) expect(SAFE_REF.test(segment.segmentRef)).toBe(true)
  })

  it('is pure: same lesson in, same segments out, every time', () => {
    const lesson = fixtureLesson('guided-practice')
    expect(techCsLessonSegments(lesson)).toEqual(techCsLessonSegments(lesson))
  })

  it('every segment is required and has a positive estimated duration', () => {
    for (const segment of techCsLessonSegments(fixtureLesson('guided-practice'))) {
      expect(segment.required).toBe(true)
      expect(segment.estimatedMinutes).toBeGreaterThan(0)
    }
  })

  it('techCsLessonPlan uses the generic "other" Study subject and completion-only mastery authority', () => {
    const plan = techCsLessonPlan(fixtureLesson('guided-practice'))
    expect(plan.subject).toBe('other')
    expect(plan.masteryAuthority).toBe('completion-only')
    expect(plan.source).toBe('manuel-academy')
    expect(plan.lessonRef).toBe('ma-g7-technology-u02-l04')
    expect(plan.segments).toHaveLength(5)
  })

  it('produces Study-compatible segments for every real lesson across all three grades', () => {
    const catalog = loadTechCsCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getTechCsAssignments(catalog, grade)) {
        const segments = techCsLessonSegments(lesson)
        expect(segments).toHaveLength(5)
        for (const segment of segments) {
          expect(SAFE_REF.test(segment.segmentRef)).toBe(true)
          expect(segment.segmentRef.startsWith(lesson.lessonId)).toBe(true)
        }
      }
    }
  })
})
