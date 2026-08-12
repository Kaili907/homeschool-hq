import type { StudyCheckpoint } from '../../../../types'
import type { TechCsLessonRef, TechCsUnitRef } from '../catalog/types'

/**
 * FF-M7 — project/checkpoint representation for the Technology / CS lane,
 * built on the existing StudyCheckpoint contract (src/study/types.ts). That
 * contract already carries rawAnswerIncluded/transcriptIncluded as literal
 * `false` and treats responseDraftRef as an opaque pointer, never draft text
 * (see src/study/localDevelopmentPorts.ts's identical save() guard). This
 * module enforces the same rule structurally at the technology/CS boundary:
 * toTechCsStudyCheckpoint throws if handed anything that isn't a stable
 * opaque reference, so a caller can never persist a learner's raw code,
 * project text, or prose here — only a pointer to where it actually lives.
 */

const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

export class TechCsCheckpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TechCsCheckpointError'
  }
}

/** Whether a lesson's independent-application segment is the unit's graded
 * project/performance-task work, vs. an ordinary independent-practice day. */
export function isProjectCheckpointLesson(lesson: TechCsLessonRef): boolean {
  return lesson.dayPhase === 'application-project' || lesson.dayPhase === 'mastery-check'
}

export interface TechCsProjectDescriptor {
  readonly unitId: string
  readonly projectTitle: string
  readonly relatedLessonIds: readonly string[]
}

/** The unit's performance task, as an opaque-ref-friendly project descriptor
 * — no learner work, just what the project is and which lessons feed it. */
export function projectDescriptorForUnit(unit: TechCsUnitRef): TechCsProjectDescriptor {
  return {
    unitId: unit.unitId,
    projectTitle: unit.performanceTask,
    relatedLessonIds: unit.lessonIds,
  }
}

export interface TechCsCheckpointInput {
  readonly checkpointRef: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly sessionRef: string
  readonly lesson: TechCsLessonRef
  readonly segmentRef: string
  readonly revision: number
  readonly capturedAt: string
  readonly completedSegmentRefs: readonly string[]
  readonly elapsedActiveSecondsInSegment: number
  /** An opaque draft reference only — never the learner's code, prose, or
   * project text. */
  readonly responseDraftRef?: string | null
}

/** Builds a Study-compatible checkpoint for a technology/CS lesson. Throws if
 * asked to carry a non-opaque value as responseDraftRef instead of a
 * reference — the one place the "no raw learner code persistence" boundary
 * is enforced in code, not just by convention. */
export function toTechCsStudyCheckpoint(input: TechCsCheckpointInput): StudyCheckpoint {
  if (!OPAQUE_REF.test(input.checkpointRef)) {
    throw new TechCsCheckpointError('checkpointRef must be a stable opaque reference.')
  }
  if (!OPAQUE_REF.test(input.segmentRef)) {
    throw new TechCsCheckpointError('segmentRef must be a stable opaque reference.')
  }
  const responseDraftRef = input.responseDraftRef ?? null
  if (responseDraftRef !== null && !OPAQUE_REF.test(responseDraftRef)) {
    throw new TechCsCheckpointError(
      'responseDraftRef must be an opaque reference; raw learner code or project text may never be passed here.',
    )
  }
  return {
    checkpointRef: input.checkpointRef,
    householdRef: input.householdRef,
    learnerRef: input.learnerRef,
    sessionRef: input.sessionRef,
    lessonRef: input.lesson.lessonId,
    segmentRef: input.segmentRef,
    revision: input.revision,
    capturedAt: input.capturedAt,
    completedSegmentRefs: input.completedSegmentRefs,
    elapsedActiveSecondsInSegment: input.elapsedActiveSecondsInSegment,
    responseDraftRef,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}
