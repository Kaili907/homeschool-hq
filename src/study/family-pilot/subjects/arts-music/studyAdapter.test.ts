import { describe, expect, it } from 'vitest'
import type { CanonicalStudyTaskType } from '../../../types'
import { getArtsMusicAssignments } from './catalog'
import { loadArtsMusicCatalog } from './source.node'
import { adaptArtsMusicLessonToStudyPlan } from './studyAdapter'
import type { ArtsMusicLessonRef } from './types'

const CANONICAL_TASK_TYPES: readonly CanonicalStudyTaskType[] = [
  'retrieval-practice', 'direct-instruction', 'worked-example', 'guided-practice',
  'independent-practice', 'prerequisite-remediation', 'reading', 'writing',
  'project-work', 'problem-solving', 'discussion', 'reflection', 'mastery-check', 'custom',
]

function fixtureLesson(overrides: Partial<ArtsMusicLessonRef> = {}): ArtsMusicLessonRef {
  return {
    lessonId: 'ma-g5-arts-and-music-u01-l01',
    courseId: 'ma-g5-arts-and-music',
    grade: '5',
    unitId: 'ma-g5-arts-and-music-u01',
    unitNumber: 1,
    dayInUnit: 1,
    courseDay: 1,
    title: 'Launch and diagnostic',
    focus: 'line and shape',
    estimatedMinutes: '40–60',
    lessonFlow: [
      { segment: 'Welcome and retrieval', minutes: '5–8', teacherOrTutorAction: 'x' },
      { segment: 'Model or mini-lesson', minutes: '8–15', teacherOrTutorAction: 'x' },
      { segment: 'Guided practice', minutes: '10–18', teacherOrTutorAction: 'x' },
      { segment: 'Independent application', minutes: '12–25', teacherOrTutorAction: 'x' },
      { segment: 'Exit ticket and next step', minutes: '3–7', teacherOrTutorAction: 'x' },
    ],
    ...overrides,
  }
}

describe('ARTS-MUSIC-1 adaptArtsMusicLessonToStudyPlan (fixture)', () => {
  it('maps every lesson_flow step to an existing CanonicalStudyTaskType, in order', () => {
    const plan = adaptArtsMusicLessonToStudyPlan(fixtureLesson())
    expect(plan.segments.map((s) => s.taskType)).toEqual([
      'retrieval-practice', 'direct-instruction', 'guided-practice', 'independent-practice', 'reflection',
    ])
    expect(plan.segments.map((s) => s.title)).toEqual([
      'Welcome and retrieval', 'Model or mini-lesson', 'Guided practice', 'Independent application', 'Exit ticket and next step',
    ])
  })

  it('marks completion-only mastery authority and subject "other" — never routes through Tutor Core', () => {
    const plan = adaptArtsMusicLessonToStudyPlan(fixtureLesson())
    expect(plan.masteryAuthority).toBe('completion-only')
    expect(plan.subject).toBe('other')
    expect(plan.source).toBe('manuel-academy')
  })

  it('produces stable, unique, opaque segmentRefs', () => {
    const plan = adaptArtsMusicLessonToStudyPlan(fixtureLesson())
    const refs = plan.segments.map((s) => s.segmentRef)
    expect(new Set(refs).size).toBe(refs.length)
    for (const ref of refs) expect(ref).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/)
    // Deterministic: same lesson in, same refs out.
    expect(adaptArtsMusicLessonToStudyPlan(fixtureLesson()).segments.map((s) => s.segmentRef)).toEqual(refs)
  })

  it('parses each step\'s minute range into a positive integer estimate', () => {
    const plan = adaptArtsMusicLessonToStudyPlan(fixtureLesson())
    for (const segment of plan.segments) {
      expect(segment.estimatedMinutes).toBeGreaterThan(0)
      expect(Number.isInteger(segment.estimatedMinutes)).toBe(true)
    }
  })

  it('falls back to a custom taskType for an unrecognized step name instead of throwing', () => {
    const plan = adaptArtsMusicLessonToStudyPlan(fixtureLesson({
      lessonFlow: [{ segment: 'Gallery walk and share-out', minutes: '5', teacherOrTutorAction: 'x' }],
    }))
    expect(plan.segments[0].taskType).toBe('custom')
    expect(plan.segments[0].customTaskTypeId).toBe('arts-music-segment')
  })

  it('rejects a lesson with a non-opaque lessonId', () => {
    expect(() => adaptArtsMusicLessonToStudyPlan(fixtureLesson({ lessonId: 'not a safe ref!' }))).toThrow()
  })
})

describe('ARTS-MUSIC-1 adaptArtsMusicLessonToStudyPlan (real curriculum content)', () => {
  const catalog = loadArtsMusicCatalog()

  it('adapts every lesson in every grade without throwing, using only canonical task types', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade })) {
        const plan = adaptArtsMusicLessonToStudyPlan(lesson)
        expect(plan.segments.length).toBe(lesson.lessonFlow.length)
        for (const segment of plan.segments) {
          expect(CANONICAL_TASK_TYPES).toContain(segment.taskType)
        }
      }
    }
  })

  it('every real lesson resolves to exactly the five canonical arts-and-music task types', () => {
    for (const lesson of getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade: '5' })) {
      const plan = adaptArtsMusicLessonToStudyPlan(lesson)
      expect(plan.segments.map((s) => s.taskType)).toEqual([
        'retrieval-practice', 'direct-instruction', 'guided-practice', 'independent-practice', 'reflection',
      ])
    }
  })
})
