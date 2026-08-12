import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import {
  READY_FOR_LIFE_BLOCK_KIND,
  READY_FOR_LIFE_STUDY_SUBJECT,
  adaptReadyForLifeLessonToStudyPlan,
} from './studyAdapter'

const catalog = loadReadyForLifeCatalog()
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

describe('FULL-FAMILY-READY-FOR-LIFE adaptReadyForLifeLessonToStudyPlan', () => {
  it('produces a Study-compatible plan for every lesson in the catalog', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const plan = adaptReadyForLifeLessonToStudyPlan(lesson)
        expect(plan.lessonRef).toBe(lesson.lessonId)
        expect(plan.subject).toBe(READY_FOR_LIFE_STUDY_SUBJECT)
        expect(plan.masteryAuthority).toBe('completion-only')
        expect(plan.source).toBe('manuel-academy')
        expect(plan.segments.length).toBe(5)
        for (const segment of plan.segments) {
          expect(SAFE_REF.test(segment.segmentRef)).toBe(true)
          expect(segment.segmentRef.startsWith(`${lesson.lessonId}:segment:`)).toBe(true)
          expect(segment.required).toBe(true)
          expect(segment.estimatedMinutes).toBeGreaterThan(0)
        }
      }
    }
  })

  it('exposes a Study calendar block kind for scheduling', () => {
    expect(READY_FOR_LIFE_BLOCK_KIND).toBe('project_work')
  })

  it('is deterministic: the same lesson always yields the same segment refs — required for Study resume', () => {
    const lesson = catalog.courses[0].lessons[5]
    const first = adaptReadyForLifeLessonToStudyPlan(lesson)
    const second = adaptReadyForLifeLessonToStudyPlan(lesson)
    expect(second.segments.map((s) => s.segmentRef)).toEqual(first.segments.map((s) => s.segmentRef))
  })

  it('supports resume: completed + remaining segment refs partition the full plan with no overlap', () => {
    const lesson = catalog.courses[1].lessons[10]
    const plan = adaptReadyForLifeLessonToStudyPlan(lesson)
    const allRefs = plan.segments.map((s) => s.segmentRef)

    // Simulate a session that stopped after the second segment.
    const completedSegmentRefs = allRefs.slice(0, 2)
    const remainingSegmentRefs = allRefs.slice(2)

    expect(completedSegmentRefs.length + remainingSegmentRefs.length).toBe(allRefs.length)
    expect(new Set([...completedSegmentRefs, ...remainingSegmentRefs]).size).toBe(allRefs.length)
    // The resume point is the first remaining segment, at its correct ordinal.
    const resumeSegmentRef = remainingSegmentRefs[0]
    expect(resumeSegmentRef).toBe(allRefs[2])
    expect(plan.segments.findIndex((s) => s.segmentRef === resumeSegmentRef)).toBe(2)
  })

  it('rejects an unrecognized lesson_flow segment name rather than guessing a taskType', () => {
    const lesson = catalog.courses[0].lessons[0]
    const tampered = {
      ...lesson,
      lessonFlow: [{ segment: 'Not a real segment', minutes: '5', teacherOrTutorAction: 'x' }],
    }
    expect(() => adaptReadyForLifeLessonToStudyPlan(tampered)).toThrow()
  })
})
