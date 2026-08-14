import {
  finalAssessmentAssignmentRef,
  finalAssignmentRef,
} from '../../../family-pilot/final-app/controller'
import type { FamilyAutoPlannerDocumentV1 } from '../../../family-pilot/auto-planner/types'
import {
  exportLocalBundleToHostedSyncStateR2,
  importHostedSyncStateToLocalBundleR2,
  type HostedSyncAuthorityRevisionsR2,
  type HostedSyncLocalBundleR2,
  type HostedSyncStateIdentityR2,
  type HostedSyncStateMetadataR2,
  type HostedSyncStateSnapshotR2,
} from '../contracts'

export type FamilyHostedSyncAttentionCodeR1 =
  | 'PLANNER_SCOPE_MISMATCH'
  | 'PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT'
  | 'PLANNER_ASSIGNMENT_REF_MISMATCH'
  | 'DUPLICATE_LESSON_ASSIGNMENT'
  | 'DUPLICATE_ASSESSMENT_ASSIGNMENT'

export interface CurrentFamilyPilotHostedExportR1 {
  /** The exact accepted R2 allowlisted checkpoint. */
  readonly snapshot: HostedSyncStateSnapshotR2
  /**
   * The planner document remains local by contract. Returning it explicitly
   * prevents a caller from mistaking omission from the hosted checkpoint for
   * permission to delete it after first link or hydrate.
   */
  readonly retainedLocalPlanner: FamilyAutoPlannerDocumentV1
  readonly attention: readonly FamilyHostedSyncAttentionCodeR1[]
}

export interface CurrentFamilyPilotHostedHydrateR1 {
  readonly local: HostedSyncLocalBundleR2
  readonly retainedLocalPlanner: FamilyAutoPlannerDocumentV1
  readonly status: 'UP_TO_DATE' | 'NEEDS_ATTENTION'
  readonly attention: readonly FamilyHostedSyncAttentionCodeR1[]
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)])
}

function plannerAttention(
  local: HostedSyncLocalBundleR2,
  planner: FamilyAutoPlannerDocumentV1,
  identity: HostedSyncStateIdentityR2,
): readonly FamilyHostedSyncAttentionCodeR1[] {
  const attention: FamilyHostedSyncAttentionCodeR1[] = []
  if (
    planner.scope.householdRef !== identity.householdRef ||
    planner.scope.learnerRef !== identity.learnerRef
  ) {
    attention.push('PLANNER_SCOPE_MISMATCH')
    return unique(attention)
  }

  const student = local.core.students.find((item) => item.studentRef === identity.studentRef)
  const assessments = local.app.assessmentAssignments.filter((item) => item.studentRef === identity.studentRef)
  if (!student) return unique(['PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT'])

  const lessonRefs = new Map<string, number>()
  for (const assignment of student.assignments) {
    lessonRefs.set(assignment.lessonRef, (lessonRefs.get(assignment.lessonRef) ?? 0) + 1)
  }
  if ([...lessonRefs.values()].some((count) => count > 1)) attention.push('DUPLICATE_LESSON_ASSIGNMENT')

  const assessmentRefs = new Map<string, number>()
  for (const assignment of assessments) {
    assessmentRefs.set(assignment.assessmentRef, (assessmentRefs.get(assignment.assessmentRef) ?? 0) + 1)
  }
  if ([...assessmentRefs.values()].some((count) => count > 1)) attention.push('DUPLICATE_ASSESSMENT_ASSIGNMENT')

  for (const materialization of planner.materializations) {
    if (materialization.kind === 'LESSON') {
      const assignment = student.assignments.find((item) => item.assignmentRef === materialization.assignmentRef)
      if (!assignment || assignment.lessonRef !== materialization.itemRef) {
        attention.push('PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT')
        continue
      }
      if (assignment.assignmentRef !== finalAssignmentRef(identity.studentRef, materialization.itemRef)) {
        attention.push('PLANNER_ASSIGNMENT_REF_MISMATCH')
      }
      continue
    }
    const assignment = assessments.find((item) => item.assignmentRef === materialization.assignmentRef)
    if (!assignment || assignment.assessmentRef !== materialization.itemRef) {
      attention.push('PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT')
      continue
    }
    if (assignment.assignmentRef !== finalAssessmentAssignmentRef(identity.studentRef, materialization.itemRef)) {
      attention.push('PLANNER_ASSIGNMENT_REF_MISMATCH')
    }
  }
  return unique(attention)
}

/**
 * Current-product export over the accepted R2 converter. The Auto Planner
 * document is validated against current deterministic assignment identity, but
 * is deliberately retained on device because it is not in the R2 allowlist.
 */
export function exportCurrentFamilyPilotHostedStateR1(input: {
  readonly identity: HostedSyncStateIdentityR2
  readonly sync: HostedSyncStateMetadataR2
  readonly local: HostedSyncLocalBundleR2
  readonly planner: FamilyAutoPlannerDocumentV1
  readonly authorityRevisions?: HostedSyncAuthorityRevisionsR2
}): CurrentFamilyPilotHostedExportR1 {
  const attention = plannerAttention(input.local, input.planner, input.identity)
  const snapshot = exportLocalBundleToHostedSyncStateR2({
    identity: input.identity,
    sync: input.sync,
    local: input.local,
    authorityRevisions: input.authorityRevisions,
  })
  return Object.freeze({ snapshot, retainedLocalPlanner: input.planner, attention })
}

/**
 * Hydrates the accepted hosted authority without replacing or clearing the
 * device-local planner document. Any planner/assignment disagreement is made
 * visible to the Parent as attention state; it never triggers destructive
 * fallback or automatic duplicate creation.
 */
export function hydrateCurrentFamilyPilotHostedStateR1(input: {
  readonly snapshot: HostedSyncStateSnapshotR2
  readonly target: HostedSyncLocalBundleR2
  readonly planner: FamilyAutoPlannerDocumentV1
  readonly expectedIdentity: HostedSyncStateIdentityR2
}): CurrentFamilyPilotHostedHydrateR1 {
  const local = importHostedSyncStateToLocalBundleR2({
    snapshot: input.snapshot,
    target: input.target,
    expectedIdentity: input.expectedIdentity,
  })
  const attention = plannerAttention(local, input.planner, input.expectedIdentity)
  return Object.freeze({
    local,
    retainedLocalPlanner: input.planner,
    status: attention.length ? 'NEEDS_ATTENTION' : 'UP_TO_DATE',
    attention,
  })
}
