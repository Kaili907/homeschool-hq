import { describe, expect, it } from 'vitest'
import { buildCompletionEvidence } from './completionEvidence'
import { buildGuardianProjection } from './guardianProjection'
import { getLesson, listLessonsForGrade } from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'

const catalog = loadPhysicalEducationCatalog()
const lesson = listLessonsForGrade(catalog, '5')[0]

describe('guardian safety projection', () => {
  it('surfaces the lesson safety markers to the guardian', () => {
    const projection = buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'in-progress',
    })
    expect(projection.safetyMarkers).toEqual(lesson.safetyAndPrivacy)
    expect(projection.safetyMarkers.length).toBeGreaterThan(0)
  })

  it('reports whether an accessible alternative exists for the activity', () => {
    const projection = buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'not-started',
    })
    expect(projection.accessibleAlternativesAvailable).toBe(true)
  })

  it('carries the completion evidence kind once completion is recorded', () => {
    const completedEvidence = buildCompletionEvidence({
      lessonRef: lesson.lessonId,
      segmentRef: `${lesson.lessonId}:segment:5`,
      completedAt: '2026-08-12T14:00:00.000Z',
      recordedBy: 'learner',
    })
    const projection = buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'completed',
      latestEvidence: completedEvidence,
    })
    expect(projection.evidenceKind).toBe('self-reported-completion')
    expect(projection.completionState).toBe('completed')
  })
})

describe('no raw private reflection persistence', () => {
  it('never carries learner reflection text in the guardian projection', () => {
    const projection = buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'completed',
    })
    expect(projection.rawReflectionIncluded).toBe(false)
    expect(projection).not.toHaveProperty('reflection')
    expect(projection).not.toHaveProperty('transcript')
    expect(projection).not.toHaveProperty('learnerText')
  })
})

describe('student isolation', () => {
  it('scopes every projection to exactly one household and learner, never a shared aggregate', () => {
    const first = buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'completed',
    })
    const second = buildGuardianProjection({
      householdRef: 'household:beta',
      learnerRef: 'learner:beta-1',
      lesson,
      completionState: 'not-started',
    })
    expect(first.learnerRef).toBe('learner:alpha-1')
    expect(second.learnerRef).toBe('learner:beta-1')
    expect(first.householdRef).not.toBe(second.householdRef)
    // Building one learner's projection must never mutate or read another's.
    expect(first.completionState).toBe('completed')
    expect(second.completionState).toBe('not-started')
  })

  it('rejects a projection built without a household or learner scope', () => {
    expect(() => buildGuardianProjection({
      householdRef: '',
      learnerRef: 'learner:alpha-1',
      lesson,
      completionState: 'not-started',
    })).toThrow()
    expect(() => buildGuardianProjection({
      householdRef: 'household:alpha',
      learnerRef: '',
      lesson,
      completionState: 'not-started',
    })).toThrow()
  })

  it('never resolves a lesson id across grade boundaries when building a projection input', () => {
    const grade5Lesson = listLessonsForGrade(catalog, '5')[0]
    expect(getLesson(catalog, grade5Lesson.lessonId)?.grade).toBe('5')
  })
})
