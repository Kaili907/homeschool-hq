import { describe, expect, it } from 'vitest'
import { adaptHostLessonToStudyPlan, HOST_STUDY_MAPPING, LEGACY_QUIZ_INTEGRATION_POLICY, type HostStudyLessonKind } from './curriculumAdapter'

describe('host curriculum to canonical Study mapping', () => {
  it.each(Object.keys(HOST_STUDY_MAPPING) as HostStudyLessonKind[])('maps %s with stable segments and explicit mastery authority', (kind) => {
    const plan = adaptHostLessonToStudyPlan({
      lessonRef: `lesson:${kind}`,
      title: `Synthetic ${kind}`,
      kind,
      skillRefs: ['skill:synthetic'],
    })
    expect(plan.segments.length).toBeGreaterThan(0)
    expect(new Set(plan.segments.map((segment) => segment.segmentRef)).size).toBe(plan.segments.length)
    expect(plan.segments.every((segment) => segment.segmentRef.startsWith(`lesson:${kind}:segment:`))).toBe(true)
    expect(['tutor-core', 'completion-only']).toContain(plan.masteryAuthority)
  })

  it('keeps QuizSession as a legacy flow and never promotes local correctness to Study mastery', () => {
    expect(LEGACY_QUIZ_INTEGRATION_POLICY).toEqual({
      current: 'legacy-flow-remains-available',
      studyUse: 'presentation-only-after-accepted-tutor-receipt',
      masteryAuthority: 'tutor-core',
    })
  })

  it('rejects text-derived or malformed references', () => {
    expect(() => adaptHostLessonToStudyPlan({ lessonRef: 'learner name / lesson', title: 'Bad', kind: 'math', skillRefs: [] })).toThrow(/stable opaque/i)
  })
})
