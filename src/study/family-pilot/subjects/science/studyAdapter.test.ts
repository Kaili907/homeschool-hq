import { describe, expect, it } from 'vitest'
import { getScienceLesson, listScienceLessons } from './catalog'
import { loadScienceCatalog } from './source.node'
import { adaptScienceLessonToStudy } from './studyAdapter'

describe('FAMILY-PILOT-SCIENCE-1 adaptScienceLessonToStudy', () => {
  const catalog = loadScienceCatalog()
  const lesson = getScienceLesson(catalog, '5', listScienceLessons(catalog, '5')[0].lessonId)!

  it('produces a StudyLessonPlan with the lessonRef, title, and standards preserved', () => {
    const plan = adaptScienceLessonToStudy(lesson)
    expect(plan.lessonRef).toBe(lesson.lessonId)
    expect(plan.title).toBe(lesson.title)
    expect(plan.skillRefs).toEqual(lesson.standards)
  })

  it('routes to subject "other" — science is not math, reading, or writing', () => {
    const plan = adaptScienceLessonToStudy(lesson)
    expect(plan.subject).toBe('other')
  })

  it('uses tutor-core mastery authority and the manuel-academy source', () => {
    const plan = adaptScienceLessonToStudy(lesson)
    expect(plan.masteryAuthority).toBe('tutor-core')
    expect(plan.source).toBe('manuel-academy')
  })

  it('produces exactly five required segments in the lesson’s own flow order', () => {
    const plan = adaptScienceLessonToStudy(lesson)
    expect(plan.segments).toHaveLength(5)
    expect(plan.segments.map((segment) => segment.title)).toEqual(lesson.lessonFlow.map((step) => step.segment))
    expect(plan.segments.map((segment) => segment.taskType)).toEqual([
      'retrieval-practice',
      'direct-instruction',
      'guided-practice',
      'independent-practice',
      'mastery-check',
    ])
    for (const segment of plan.segments) {
      expect(segment.required).toBe(true)
      expect(segment.estimatedMinutes).toBeGreaterThan(0)
    }
  })

  it('gives every segment a stable, opaque, lesson-scoped ref', () => {
    const plan = adaptScienceLessonToStudy(lesson)
    const refs = plan.segments.map((segment) => segment.segmentRef)
    expect(new Set(refs).size).toBe(refs.length)
    for (const ref of refs) expect(ref.startsWith(`${lesson.lessonId}:segment:`)).toBe(true)

    // Same input, same output — no hidden state or ordering dependence.
    const again = adaptScienceLessonToStudy(lesson)
    expect(again).toEqual(plan)
  })

  it('adapts every lesson across every grade without throwing', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const ref of listScienceLessons(catalog, grade)) {
        const detail = getScienceLesson(catalog, grade, ref.lessonId)!
        expect(() => adaptScienceLessonToStudy(detail)).not.toThrow()
      }
    }
  })
})
