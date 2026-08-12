import { describe, expect, it } from 'vitest'
import { listLessonsForGrade } from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'
import { adaptPhysicalEducationLessonToStudyPlan, physicalEducationCalendarDraft } from './studyAdapter'

const catalog = loadPhysicalEducationCatalog()

describe('Study sequencing', () => {
  it('produces segments in the same order as the lesson flow, one per phase', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
    expect(plan.segments.map((segment) => segment.title)).toEqual(
      lesson.lessonFlow.map((phase) => phase.segment),
    )
    expect(plan.segments).toEqual([
      expect.objectContaining({ title: 'Welcome and retrieval', taskType: 'retrieval-practice' }),
      expect.objectContaining({ title: 'Model or mini-lesson', taskType: 'direct-instruction' }),
      expect.objectContaining({ title: 'Guided practice', taskType: 'guided-practice' }),
      expect.objectContaining({ title: 'Independent application', taskType: 'independent-practice' }),
      expect.objectContaining({ title: 'Exit ticket and next step', taskType: 'reflection' }),
    ])
  })

  it('gives every segment a stable, opaque, unique segmentRef derived from the lesson id', () => {
    const lesson = listLessonsForGrade(catalog, '7')[10]
    const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
    const refs = plan.segments.map((segment) => segment.segmentRef)
    expect(new Set(refs).size).toBe(refs.length)
    for (const ref of refs) expect(ref.startsWith(lesson.lessonId)).toBe(true)
  })

  it('marks every segment required, so sequencing cannot skip a phase', () => {
    const lesson = listLessonsForGrade(catalog, '8')[50]
    const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
    expect(plan.segments.every((segment) => segment.required)).toBe(true)
  })

  it('sequences every lesson across all three grades without error', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
        expect(plan.segments.length).toBe(5)
      }
    }
  })

  it('rejects an unrecognized lesson-flow phase name instead of guessing a task type', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const mutated = {
      ...lesson,
      lessonFlow: [{ segment: 'Unknown phase', minutes: '5', guidance: 'x' }],
    }
    expect(() => adaptPhysicalEducationLessonToStudyPlan(mutated)).toThrow(/Unknown Physical Education lesson phase/)
  })
})

describe('no invasive mastery authority', () => {
  it('is always completion-only, never tutor-core', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
        expect(plan.masteryAuthority).toBe('completion-only')
      }
    }
  })

  it('tags the calendar draft with the physical_education block kind', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
    const draft = physicalEducationCalendarDraft({
      scope: { householdRef: 'household:1', learnerRef: 'learner:1' },
      plan,
      householdTimeZone: 'America/New_York',
      instant: new Date('2026-08-12T14:00:00.000Z'),
      timerHidden: false,
    })
    expect(draft.blockKind).toBe('physical_education')
    expect(draft.plan).toBe(plan)
  })
})
