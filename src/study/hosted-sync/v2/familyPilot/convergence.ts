import {
  finalAssessmentAssignmentRef,
  finalAssignmentRef,
} from '../../../family-pilot/final-app/controller'
import type { FamilyAutoPlannerDocumentV1 } from '../../../family-pilot/auto-planner/types'
import {
  exportLocalBundleToHostedSyncStateR2,
  importHostedSyncStateToLocalBundleR2,
  parseHostedSyncStateSnapshotR2,
  type HostedSyncAuthorityRevisionsR2,
  type HostedSyncAssessmentOutcomeR2,
  type HostedSyncLocalBundleR2,
  type HostedSyncStateIdentityR2,
  type HostedSyncStateMetadataR2,
  type HostedSyncStateSnapshotR2,
} from '../contracts'
import { FAMILY_PILOT_TRUSTED_SCORER_REF } from '../../../family-pilot/trusted-scorer'
import type { LearnerResponseRecord } from '../../../family-pilot/final-app/learner-response'

export interface FamilyHostedSyncScoringReceiptR1 extends HostedSyncAssessmentOutcomeR2 {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly decision: Exclude<HostedSyncAssessmentOutcomeR2['decision'], 'COMPLETED'>
}

/**
 * Projects only the receipt from an already-assessed local response. The
 * response value, section/item prompt context, and answer authority have no
 * destination in the returned exact sidecar.
 */
export function projectTrustedScoringReceiptForHostedSyncR1(
  record: LearnerResponseRecord,
  assessmentRef: string,
): FamilyHostedSyncScoringReceiptR1 {
  const receipt = record.assessment
  if (record.status !== 'ASSESSED' || !receipt || receipt.assessorRef !== FAMILY_PILOT_TRUSTED_SCORER_REF) {
    throw new Error('Only an accepted trusted scorer receipt can enter Hosted Sync.')
  }
  return Object.freeze({
    studentRef: record.studentRef,
    assignmentRef: record.assignmentRef,
    assessmentRef,
    assessmentRecordRef: receipt.assessmentRef,
    decision: receipt.decision,
    assessedAt: receipt.assessedAt,
    assessorRef: receipt.assessorRef,
  })
}

export type FamilyHostedSyncAttentionCodeR1 =
  | 'PLANNER_SCOPE_MISMATCH'
  | 'PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT'
  | 'PLANNER_ASSIGNMENT_REF_MISMATCH'
  | 'DUPLICATE_LESSON_ASSIGNMENT'
  | 'DUPLICATE_ASSESSMENT_ASSIGNMENT'

export interface CurrentFamilyPilotHostedExportR1 {
  /** The exact accepted R2 allowlisted checkpoint. */
  readonly snapshot: HostedSyncStateSnapshotR2
  /** Exact School Plan and deterministic materialization provenance in the checkpoint. */
  readonly retainedLocalPlanner: FamilyAutoPlannerDocumentV1
  /** Exact trusted receipt sidecars represented inside `assessmentStates[].outcome`. */
  readonly scoringReceipts: readonly FamilyHostedSyncScoringReceiptR1[]
  readonly attention: readonly FamilyHostedSyncAttentionCodeR1[]
}

export interface CurrentFamilyPilotHostedHydrateR1 {
  readonly local: HostedSyncLocalBundleR2
  readonly retainedLocalPlanner: FamilyAutoPlannerDocumentV1
  readonly learnerResponses: readonly LearnerResponseRecord[]
  /** Caller persists these through its existing receipt store. */
  readonly scoringReceipts: readonly FamilyHostedSyncScoringReceiptR1[]
  readonly status: 'UP_TO_DATE' | 'NEEDS_ATTENTION'
  readonly attention: readonly FamilyHostedSyncAttentionCodeR1[]
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)])
}

const RECEIPT_KEYS = Object.freeze([
  'studentRef', 'assignmentRef', 'assessmentRef', 'assessmentRecordRef',
  'decision', 'assessedAt', 'assessorRef',
] as const)

function exactReceipt(value: FamilyHostedSyncScoringReceiptR1): boolean {
  const keys = Object.keys(value)
  return keys.length === RECEIPT_KEYS.length && RECEIPT_KEYS.every((key) => Object.hasOwn(value, key))
}

function applyScoringReceipts(
  snapshot: HostedSyncStateSnapshotR2,
  receipts: readonly FamilyHostedSyncScoringReceiptR1[],
): HostedSyncStateSnapshotR2 {
  if (new Set(receipts.map((item) => item.assignmentRef)).size !== receipts.length) {
    throw new Error('Duplicate trusted scoring receipt assignment rejected.')
  }
  const byAssignment = new Map(receipts.map((item) => [item.assignmentRef, item]))
  for (const receipt of receipts) {
    const assessment = snapshot.assessmentStates.find((item) => item.assignmentRef === receipt.assignmentRef)
    if (!exactReceipt(receipt) || receipt.assessorRef !== FAMILY_PILOT_TRUSTED_SCORER_REF ||
      receipt.studentRef !== snapshot.identity.studentRef || !assessment ||
      assessment.assessmentRef !== receipt.assessmentRef ||
      !['ACTIVE', 'PENDING_ASSESSMENT'].includes(assessment.status)) {
      throw new Error('Trusted scoring receipt is outside the Hosted Sync assessment allowlist.')
    }
  }
  const candidate = Object.freeze({
    ...snapshot,
    assessmentStates: Object.freeze(snapshot.assessmentStates.map((assessment) => {
      const receipt = byAssignment.get(assessment.assignmentRef)
      if (!receipt) return assessment
      const outcome: HostedSyncAssessmentOutcomeR2 = Object.freeze({
        assessmentRecordRef: receipt.assessmentRecordRef,
        decision: receipt.decision,
        assessedAt: receipt.assessedAt,
        assessorRef: receipt.assessorRef,
      })
      return Object.freeze({
        ...assessment,
        status: receipt.decision === 'REVIEW_REQUIRED' ? 'ADULT_REVIEW_REQUIRED' as const : 'SCORING_COMPLETE' as const,
        updatedAt: receipt.assessedAt,
        outcome,
      })
    })),
  })
  const parsed = parseHostedSyncStateSnapshotR2(candidate, snapshot.identity)
  if (parsed.status !== 'ready') throw new Error(`Trusted scoring receipt was refused: ${parsed.reason}`)
  return parsed.snapshot
}

function scoringReceipts(snapshot: HostedSyncStateSnapshotR2): readonly FamilyHostedSyncScoringReceiptR1[] {
  return Object.freeze(snapshot.assessmentStates.flatMap((assessment) => {
    const outcome = assessment.outcome
    if (!outcome || outcome.assessorRef !== FAMILY_PILOT_TRUSTED_SCORER_REF || outcome.decision === 'COMPLETED') return []
    return [Object.freeze({
      studentRef: assessment.studentRef,
      assignmentRef: assessment.assignmentRef,
      assessmentRef: assessment.assessmentRef,
      assessmentRecordRef: outcome.assessmentRecordRef,
      decision: outcome.decision,
      assessedAt: outcome.assessedAt,
      assessorRef: outcome.assessorRef,
    })]
  }))
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
 * Current-product export over the accepted R2 converter. School Plan, stable
 * Auto Planner materializations, and the minimum instructional input payload
 * are part of the one whole-document CAS checkpoint.
 */
export function exportCurrentFamilyPilotHostedStateR1(input: {
  readonly identity: HostedSyncStateIdentityR2
  readonly sync: HostedSyncStateMetadataR2
  readonly local: HostedSyncLocalBundleR2
  readonly planner: FamilyAutoPlannerDocumentV1
  readonly learnerResponses?: readonly LearnerResponseRecord[]
  readonly scoringReceipts?: readonly FamilyHostedSyncScoringReceiptR1[]
  readonly authorityRevisions?: HostedSyncAuthorityRevisionsR2
}): CurrentFamilyPilotHostedExportR1 {
  const attention = plannerAttention(input.local, input.planner, input.identity)
  const baseSnapshot = exportLocalBundleToHostedSyncStateR2({
    identity: input.identity,
    sync: input.sync,
    local: Object.freeze({
      ...input.local,
      plannerDocument: input.planner,
      learnerResponses: Object.freeze([...(input.learnerResponses ?? input.local.learnerResponses ?? [])]),
    }),
    authorityRevisions: input.authorityRevisions,
  })
  const snapshot = applyScoringReceipts(baseSnapshot, input.scoringReceipts ?? [])
  return Object.freeze({
    snapshot,
    retainedLocalPlanner: input.planner,
    scoringReceipts: scoringReceipts(snapshot),
    attention,
  })
}

/**
 * Hydrates the accepted hosted authority. Remote School Plan and learner input
 * replace only the selected learner's older projection after the RPC CAS/read;
 * the caller still owns persistence and must keep its pre-hydrate copy if a
 * revision conflict is returned before this seam is called.
 */
export function hydrateCurrentFamilyPilotHostedStateR1(input: {
  readonly snapshot: HostedSyncStateSnapshotR2
  readonly target: HostedSyncLocalBundleR2
  readonly planner?: FamilyAutoPlannerDocumentV1
  readonly expectedIdentity: HostedSyncStateIdentityR2
}): CurrentFamilyPilotHostedHydrateR1 {
  const local = importHostedSyncStateToLocalBundleR2({
    snapshot: input.snapshot,
    target: input.target,
    expectedIdentity: input.expectedIdentity,
  })
  const planner = local.plannerDocument ?? input.planner
  if (!planner) throw new Error('Hosted hydrate did not include School Plan authority.')
  const attention = plannerAttention(local, planner, input.expectedIdentity)
  return Object.freeze({
    local,
    retainedLocalPlanner: planner,
    learnerResponses: Object.freeze([...(local.learnerResponses ?? [])]),
    scoringReceipts: scoringReceipts(input.snapshot),
    status: attention.length ? 'NEEDS_ATTENTION' : 'UP_TO_DATE',
    attention,
  })
}
