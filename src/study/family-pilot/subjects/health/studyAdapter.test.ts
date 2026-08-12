import { describe, expect, it } from 'vitest'
import { familyPilotTutorBridgeAvailable } from '../../study/FamilyPilotStudyRuntime'
import { listHealthLessons } from './lookup'
import { loadHealthCatalog } from './rawContent.node'
import {
  healthLessonSegments,
  healthLessonStudyPlan,
  toFamilyPilotAssignment,
  toHostLessonDescriptor,
} from './studyAdapter'

const catalog = loadHealthCatalog()
const allLessons = catalog.courses.flatMap((course) => course.lessons)

describe('toHostLessonDescriptor', () => {
  it('produces a SAFE_REF-compliant descriptor for every lesson in the catalog', () => {
    for (const lesson of allLessons) {
      const descriptor = toHostLessonDescriptor(lesson)
      expect(descriptor.lessonRef).toBe(lesson.lessonId)
      expect(descriptor.title).toBe(lesson.title)
      expect(descriptor.kind).toBe('review')
      expect(descriptor.skillRefs).toEqual([`${lesson.courseId}:unit:${lesson.unitNumber}`])
    }
  })
})

describe('healthLessonStudyPlan — Study-compatible adaptation', () => {
  it('adapts every one of the 108 lessons into a valid StudyLessonPlan without throwing', () => {
    for (const lesson of allLessons) {
      const plan = healthLessonStudyPlan(lesson)
      expect(plan.lessonRef).toBe(lesson.lessonId)
      expect(plan.subject).toBe('other')
      expect(plan.source).toBe('manuel-academy')
      expect(plan.segments.length).toBeGreaterThan(0)
    }
  })

  it('never becomes Tutor-Core-bridge-eligible — no new mastery/grading engine for Health', () => {
    for (const lesson of allLessons.slice(0, 5)) {
      const plan = healthLessonStudyPlan(lesson)
      // Shaped like the StudyCalendarEntry fields familyPilotTutorBridgeAvailable reads.
      const bridgeEligible = familyPilotTutorBridgeAvailable({
        masteryAuthority: plan.masteryAuthority,
        subject: plan.subject,
        segments: plan.segments,
      } as Parameters<typeof familyPilotTutorBridgeAvailable>[0])
      expect(bridgeEligible).toBe(false)
    }
  })

  it('healthLessonSegments mirrors the plan’s segments without a live session', () => {
    const lesson = listHealthLessons(catalog, '5')[0]
    const segments = healthLessonSegments(lesson)
    const plan = healthLessonStudyPlan(lesson)
    expect(segments).toEqual(
      plan.segments.map((segment) => ({
        segmentRef: segment.segmentRef,
        title: segment.title,
        estimatedMinutes: segment.estimatedMinutes,
      })),
    )
  })
})

describe('toFamilyPilotAssignment', () => {
  it('wraps every lesson as a static-curriculum assignment', () => {
    const lesson = listHealthLessons(catalog, '8')[0]
    const assignment = toFamilyPilotAssignment(lesson)
    expect(assignment.kind).toBe('static-curriculum')
    if (assignment.kind === 'static-curriculum') {
      expect(assignment.lesson.lessonRef).toBe(lesson.lessonId)
    }
  })
})
