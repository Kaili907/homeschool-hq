import { describe, expect, it } from 'vitest'
import type { AcademyGrade } from '../../../../types'
import { adaptElaLessonToStudy, elaCurriculumPort } from './adapter'
import { listElaLessons } from './catalog'
import { loadElaCatalog } from './source.node'
import type { ElaLessonRef } from './types'

const STUDY_LESSON_PLAN_FIELDS = ['lessonRef', 'title', 'subject', 'skillRefs', 'segments', 'masteryAuthority', 'source']

function fakeLesson(overrides: Partial<ElaLessonRef> = {}): ElaLessonRef {
  return {
    lessonId: 'ma-g5-english-language-arts-u01-l07',
    courseId: 'ma-g5-english-language-arts',
    grade: '5',
    unitId: 'ma-g5-english-language-arts-u01',
    unitNumber: 1,
    dayInUnit: 7,
    courseDay: 7,
    title: 'Investigation: active reading habits',
    phase: 'Investigation or close reading',
    studyKind: 'reading',
    ...overrides,
  }
}

describe('adaptElaLessonToStudy', () => {
  it('produces a StudyLessonPlan with the reading subject and the reviewed reading segment shape', () => {
    const plan = adaptElaLessonToStudy(fakeLesson())
    expect(plan.subject).toBe('reading')
    expect(plan.masteryAuthority).toBe('tutor-core')
    expect(plan.source).toBe('manuel-academy')
    expect(plan.segments.map((s) => s.taskType)).toEqual(['direct-instruction', 'reading', 'reflection'])
    expect(plan.segments.every((s) => s.required)).toBe(true)
  })

  it('produces a StudyLessonPlan with the writing subject and the reviewed writing segment shape', () => {
    const plan = adaptElaLessonToStudy(
      fakeLesson({ phase: 'Performance task build', studyKind: 'writing', lessonId: 'ma-g5-english-language-arts-u01-l12', courseDay: 12, dayInUnit: 12 }),
    )
    expect(plan.subject).toBe('writing')
    expect(plan.segments.map((s) => s.taskType)).toEqual(['direct-instruction', 'writing', 'reflection'])
  })

  it('never carries assessment answers, scoring guidance, or raw learner writing — only refs and titles', () => {
    const plan = adaptElaLessonToStudy(fakeLesson())
    expect(Object.keys(plan).sort()).toEqual(STUDY_LESSON_PLAN_FIELDS.sort())
    const serialized = JSON.stringify(plan)
    for (const forbidden of ['answer_or_scoring_guidance', 'correctAnswer', 'studentAnswer', 'mastery_rule', 'rawAnswer']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('derives resume-compatible, deterministic segment refs from the lesson ref alone', () => {
    const lesson = fakeLesson()
    const first = adaptElaLessonToStudy(lesson)
    const second = adaptElaLessonToStudy(lesson)
    expect(second.segments.map((s) => s.segmentRef)).toEqual(first.segments.map((s) => s.segmentRef))
    expect(new Set(first.segments.map((s) => s.segmentRef)).size).toBe(first.segments.length)
    for (const segment of first.segments) expect(segment.segmentRef.startsWith(`${first.lessonRef}:segment:`)).toBe(true)
  })

  it('adapts every real lesson in the catalog without throwing, across all three grades', () => {
    const catalog = loadElaCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      const lessons = listElaLessons(catalog, grade)
      expect(lessons.length).toBe(180)
      for (const lesson of lessons) {
        const plan = adaptElaLessonToStudy(lesson)
        expect(plan.subject === 'reading' || plan.subject === 'writing').toBe(true)
        expect(plan.lessonRef).toBe(lesson.lessonId)
      }
    }
  })
})

describe('elaCurriculumPort', () => {
  it('lists lessons for a grade in course completion order, as HostLessonDescriptor values', () => {
    const catalog = loadElaCatalog()
    const port = elaCurriculumPort(catalog)
    const descriptors = port.listLessons('7')
    expect(descriptors.length).toBe(180)
    expect(descriptors[0].lessonRef).toBe('ma-g7-english-language-arts-u01-l01')
    expect(descriptors[descriptors.length - 1].lessonRef).toBe('ma-g7-english-language-arts-u10-l18')
    for (const descriptor of descriptors) {
      expect(descriptor.kind === 'reading' || descriptor.kind === 'writing').toBe(true)
    }
  })

  it('returns no lessons for a grade with no ELA course', () => {
    const catalog = loadElaCatalog()
    const port = elaCurriculumPort(catalog)
    expect(port.listLessons('6' as unknown as AcademyGrade)).toEqual([])
  })
})
