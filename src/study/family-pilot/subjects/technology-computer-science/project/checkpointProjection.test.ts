import { describe, expect, it } from 'vitest'
import type { TechCsDayPhase, TechCsLessonRef, TechCsUnitRef } from '../catalog/types'
import {
  isProjectCheckpointLesson,
  projectDescriptorForUnit,
  TechCsCheckpointError,
  toTechCsStudyCheckpoint,
  type TechCsCheckpointInput,
} from './checkpointProjection'

function fixtureLesson(dayPhase: TechCsDayPhase): TechCsLessonRef {
  return {
    lessonId: 'ma-g8-technology-u02-l04',
    courseId: 'ma-g8-technology',
    grade: '8',
    unitId: 'u02',
    unitNumber: 2,
    dayInUnit: 4,
    courseDay: 10,
    title: 'Application: functions',
    focus: 'functions or procedures',
    dayPhase,
    standards: ['Michigan Computer Science: Algorithms and Programming'],
    accessibilityAndAccommodations: ['Provide readable text plus optional audio support.'],
    safetyAndPrivacy: ['Never require a real password, private message, or account credential.'],
  }
}

function fixtureUnit(): TechCsUnitRef {
  return {
    unitId: 'ma-g8-technology-u02',
    courseId: 'ma-g8-technology',
    unitNumber: 2,
    title: 'Programming and Software Design',
    topics: ['requirements and decomposition', 'functions or procedures'],
    performanceTask: 'Design, build, and test a small program that solves a real problem.',
    assessmentId: 'ma-g8-technology-u02-assessment',
    lessonIds: ['ma-g8-technology-u02-l01', 'ma-g8-technology-u02-l04'],
  }
}

function baseInput(overrides: Partial<TechCsCheckpointInput> = {}): TechCsCheckpointInput {
  const lesson = fixtureLesson('application-project')
  return {
    checkpointRef: 'checkpoint:household-1:learner-1:session-1',
    householdRef: 'household-1',
    learnerRef: 'learner-1',
    sessionRef: 'session-1',
    lesson,
    segmentRef: `${lesson.lessonId}:segment:apply`,
    revision: 1,
    capturedAt: '2026-08-12T00:00:00.000Z',
    completedSegmentRefs: [`${lesson.lessonId}:segment:retrieve`],
    elapsedActiveSecondsInSegment: 120,
    ...overrides,
  }
}

describe('FF-M7 Technology / CS project/checkpoint representation', () => {
  it('identifies application-project and mastery-check days as graded project checkpoints', () => {
    expect(isProjectCheckpointLesson(fixtureLesson('application-project'))).toBe(true)
    expect(isProjectCheckpointLesson(fixtureLesson('mastery-check'))).toBe(true)
    expect(isProjectCheckpointLesson(fixtureLesson('guided-practice'))).toBe(false)
  })

  it('projectDescriptorForUnit surfaces the unit performance task without any learner work', () => {
    const unit = fixtureUnit()
    expect(projectDescriptorForUnit(unit)).toEqual({
      unitId: unit.unitId,
      projectTitle: unit.performanceTask,
      relatedLessonIds: unit.lessonIds,
    })
  })

  it('builds a Study-compatible checkpoint with no responseDraftRef', () => {
    const checkpoint = toTechCsStudyCheckpoint(baseInput())
    expect(checkpoint.lessonRef).toBe('ma-g8-technology-u02-l04')
    expect(checkpoint.responseDraftRef).toBeNull()
    expect(checkpoint.rawAnswerIncluded).toBe(false)
    expect(checkpoint.transcriptIncluded).toBe(false)
  })

  it('accepts an opaque responseDraftRef', () => {
    const checkpoint = toTechCsStudyCheckpoint(baseInput({ responseDraftRef: 'draft:household-1:learner-1:doc-42' }))
    expect(checkpoint.responseDraftRef).toBe('draft:household-1:learner-1:doc-42')
  })

  it('no raw learner code persistence: rejects a raw code snippet passed as responseDraftRef', () => {
    const rawCode = 'def solve(n):\n    return n * 2  # student solution'
    expect(() => toTechCsStudyCheckpoint(baseInput({ responseDraftRef: rawCode }))).toThrow(TechCsCheckpointError)
  })

  it('no raw learner code persistence: rejects raw learner prose passed as responseDraftRef', () => {
    const rawProse = 'My project works by looping through the list and checking each item.'
    expect(() => toTechCsStudyCheckpoint(baseInput({ responseDraftRef: rawProse }))).toThrow(TechCsCheckpointError)
  })

  it('rejects a non-opaque checkpointRef or segmentRef', () => {
    expect(() => toTechCsStudyCheckpoint(baseInput({ checkpointRef: 'not a ref!' }))).toThrow(TechCsCheckpointError)
    expect(() => toTechCsStudyCheckpoint(baseInput({ segmentRef: 'not a ref!' }))).toThrow(TechCsCheckpointError)
  })
})
