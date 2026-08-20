import type { FamilyAutoPlannerTodayPlan } from './types'

/** Existing Study launch identity. The final controller/runtime already owns
 * launch, checkpoint, pause/resume, completion, safety, and Tutor boundaries. */
export interface FamilyAutoPlannerStudyTarget {
  readonly learnerRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
}

export interface FamilyAutoPlannerStudyPort {
  nextTarget(plan: FamilyAutoPlannerTodayPlan): FamilyAutoPlannerStudyTarget | null
}

export function nextFamilyAutoPlannerStudyTarget(
  plan: FamilyAutoPlannerTodayPlan,
): FamilyAutoPlannerStudyTarget | null {
  const item = plan.items.find((candidate) =>
    candidate.kind === 'LESSON' && candidate.lessonRef !== null &&
    candidate.state !== 'BLOCKED' && candidate.state !== 'WAITING')
  return item?.lessonRef
    ? Object.freeze({ learnerRef: item.learnerRef, assignmentRef: item.assignmentRef, lessonRef: item.lessonRef })
    : null
}

export const familyAutoPlannerStudyPort: FamilyAutoPlannerStudyPort = Object.freeze({
  nextTarget: nextFamilyAutoPlannerStudyTarget,
})
