import type { FamilyPilotStateV1, FamilyPilotStudentRecordV1 } from '../../../family-pilot/core/schema'
import { parseFamilyPilotState } from '../../../family-pilot/core/schema'
import type { DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports/schema'
import { parseDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import type {
  FinalFamilyPilotAppStateV1,
  FinalFamilyPilotAssessmentAssignment,
  FinalFamilyPilotSavedSession,
  FinalFamilyPilotSourceAttachment,
} from '../../../family-pilot/final-app/state'
import { parseFinalFamilyPilotAppState } from '../../../family-pilot/final-app/state'
import type { FinalFamilyPilotAttestationRecord } from '../../../family-pilot/final-composition/hostTypes'
import type { SafetyHoldV1 } from '../../../family-pilot/safety/types'
import { parseHostedSyncStateSnapshotR2 } from './parser'
import {
  HOSTED_SYNC_STATE_CONTRACT_VERSION,
  type HostedSyncAssignmentStateR2,
  type HostedSyncAssessmentStateR2,
  type HostedSyncRflStateR2,
  type HostedSyncSafetyCategoryR2,
  type HostedSyncSafetyHoldR2,
  type HostedSyncSocialSourceStateR2,
  type HostedSyncStateIdentityR2,
  type HostedSyncStateMetadataR2,
  type HostedSyncStateSnapshotR2,
} from './types'

export interface HostedSyncLocalBundleR2 {
  readonly core: FamilyPilotStateV1
  readonly app: FinalFamilyPilotAppStateV1
  readonly indexedDb: DurableStudyDocumentV1
}

export interface HostedSyncAuthorityRevisionsR2 {
  readonly assignments?: Readonly<Record<string, number>>
  readonly assessments?: Readonly<Record<string, number>>
  readonly rfl?: Readonly<Record<string, number>>
  readonly socialSources?: Readonly<Record<string, number>>
  readonly safetyHolds?: Readonly<Record<string, number>>
}

function revision(ledger: Readonly<Record<string, number>> | undefined, ref: string): number {
  const value = ledger?.[ref] ?? 0
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Malformed authority revision for ${ref}.`)
  return value
}

function safetyCategory(reasonCode: string): HostedSyncSafetyCategoryR2 {
  if (reasonCode === 'study-safety-urgent') return 'URGENT'
  if (reasonCode === 'study-safety-uncertain') return 'UNCERTAIN'
  if (reasonCode === 'tutor-concerning-content') return 'CONCERNING_CONTENT'
  return 'ADULT_REVIEW'
}

function sessionIdentity(
  assignmentRef: string,
  lessonRef: string,
  saved: FinalFamilyPilotSavedSession | undefined,
  indexedDb: DurableStudyDocumentV1,
) {
  if (!saved) return null
  const calendar = indexedDb.calendar.find((item) => item.block.internalBlockId === saved.session.blockRef)
  const session = indexedDb.sessions.find((item) => item.scope.sessionRef === saved.session.sessionRef)
  if (!calendar || !session || calendar.plan.lessonRef !== lessonRef || session.lessonRef !== lessonRef) {
    throw new Error(`Saved session ${saved.session.sessionRef} has no exact IndexedDB continuation authority.`)
  }
  return Object.freeze({
    assignmentRef,
    lessonRef,
    blockRef: saved.session.blockRef,
    sessionRef: saved.session.sessionRef,
    lineageRootRef: calendar.block.lineage.rootInternalBlockId,
    continuationKey: calendar.block.lineage.continuationKey,
  })
}

function assignmentCompletion(
  assignment: FamilyPilotStudentRecordV1['assignments'][number],
  rfl: FinalFamilyPilotAttestationRecord | undefined,
) {
  if (rfl?.status === 'PENDING_GUARDIAN_ATTESTATION') return Object.freeze({ kind: 'RFL_PENDING_GUARDIAN' as const, completedAt: null })
  if (rfl?.status === 'CERTIFIED') {
    if (!rfl.attestedAt) throw new Error('Certified RFL state is missing attestedAt.')
    return Object.freeze({ kind: 'RFL_CERTIFIED' as const, completedAt: assignment.completedAt ?? rfl.attestedAt })
  }
  if (assignment.state === 'completed' && assignment.completedAt) {
    return Object.freeze({ kind: 'NORMAL_CERTIFIED' as const, completedAt: assignment.completedAt })
  }
  return Object.freeze({ kind: 'INCOMPLETE' as const, completedAt: null })
}

function assessmentState(
  value: FinalFamilyPilotAssessmentAssignment,
  revisions: HostedSyncAuthorityRevisionsR2,
): HostedSyncAssessmentStateR2 {
  return Object.freeze({
    ...value,
    evidenceRefs: Object.freeze([]),
    outcome: null,
    authorityRevision: revision(revisions.assessments, value.assignmentRef),
  })
}

function rflState(value: FinalFamilyPilotAttestationRecord, revisions: HostedSyncAuthorityRevisionsR2): HostedSyncRflStateR2 {
  return Object.freeze({
    studentRef: value.studentRef,
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    sessionRef: value.sessionRef,
    learnerAssertionState: 'ASSERTED',
    learnerAssertedAt: value.learnerAssertedAt,
    guardianState: value.status === 'CERTIFIED' ? 'CERTIFIED' : 'PENDING',
    certifiedAt: value.attestedAt,
    attesterRef: value.attestedByRef,
    evidenceMode: value.evidenceMode,
    authorityRevision: revision(revisions.rfl, value.assignmentRef),
  })
}

function socialState(value: FinalFamilyPilotSourceAttachment, revisions: HostedSyncAuthorityRevisionsR2): HostedSyncSocialSourceStateR2 {
  return Object.freeze({
    studentRef: value.studentRef,
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    readiness: value.status,
    sourceRef: value.sourceRef,
    kind: 'unspecified',
    title: value.title,
    publisher: value.publisher,
    publishedAt: value.publishedAt,
    metadata: Object.freeze(value.metadata.map((item) => Object.freeze({ ...item }))),
    adultAttestedAt: value.adultAttestedAt,
    attachedAt: value.attachedAt,
    sourceRevision: revision(revisions.socialSources, value.sourceRef),
  })
}

function safetyState(value: SafetyHoldV1, revisions: HostedSyncAuthorityRevisionsR2): HostedSyncSafetyHoldR2 {
  const status = value.status === 'cleared' ? 'CLEARED' : value.status === 'acknowledged' ? 'ACKNOWLEDGED' : 'OPEN'
  let source: HostedSyncSafetyHoldR2['source'] = 'parent'
  if (value.source === 'study-safety') source = 'study-safety'
  if (value.source === 'tutor-core') source = 'tutor-core'
  return Object.freeze({
    holdRef: value.holdRef,
    studentRef: value.studentRef,
    sessionRef: value.sessionRef,
    reasonCode: value.reasonCode,
    category: safetyCategory(value.reasonCode),
    source,
    dedupeKey: value.dedupeKey,
    createdAt: value.createdAt,
    status,
    acknowledgedAt: value.acknowledgedAt ?? null,
    clearedAt: value.clearedAt ?? null,
    clearAuthority: status === 'CLEARED' ? 'GUARDIAN' : null,
    clearerRef: status === 'CLEARED' ? value.clearedBy ?? null : null,
    logicalRevision: revision(revisions.safetyHolds, value.holdRef),
  })
}

export function exportLocalBundleToHostedSyncStateR2(input: {
  readonly identity: HostedSyncStateIdentityR2
  readonly sync: HostedSyncStateMetadataR2
  readonly local: HostedSyncLocalBundleR2
  readonly authorityRevisions?: HostedSyncAuthorityRevisionsR2
}): HostedSyncStateSnapshotR2 {
  const { identity, local } = input
  const revisions = input.authorityRevisions ?? {}
  if (local.app.householdRef !== identity.householdRef || local.indexedDb.scope.householdRef !== identity.householdRef ||
    local.indexedDb.scope.learnerRef !== identity.learnerRef) throw new Error('Local household/learner identity mismatch.')
  const student = local.core.students.find((item) => item.studentRef === identity.studentRef)
  const profile = local.app.setup.students.find((item) => item.studentRef === identity.studentRef)
  if (!student || !profile) throw new Error('The selected student must exist in both current local documents.')

  const studentRfl = local.app.attestations.filter((item) => item.studentRef === identity.studentRef)
  const assignments: HostedSyncAssignmentStateR2[] = student.assignments.map((record) => {
    const saved = local.app.sessions.find((item) => item.studentRef === identity.studentRef && item.assignmentRef === record.assignmentRef)
    const attestation = studentRfl.find((item) => item.assignmentRef === record.assignmentRef)
    return Object.freeze({
      record,
      authorityRevision: revision(revisions.assignments, record.assignmentRef),
      sessionIdentity: sessionIdentity(record.assignmentRef, record.lessonRef, saved, local.indexedDb),
      completion: assignmentCompletion(record, attestation),
    })
  })

  const snapshot: HostedSyncStateSnapshotR2 = Object.freeze({
    contractVersion: HOSTED_SYNC_STATE_CONTRACT_VERSION,
    identity: Object.freeze({ ...identity }),
    sync: Object.freeze({ ...input.sync }),
    student,
    studentProfile: Object.freeze({
      studentRef: profile.studentRef,
      displayName: profile.displayName,
      nominalGrade: profile.nominalGrade,
      workingGradeBySubject: Object.freeze({ ...profile.workingGradeBySubject }),
      enabledSubjects: Object.freeze([...profile.enabledSubjects]),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }),
    appUpdatedAt: local.app.updatedAt,
    setupCompletedAt: local.app.setup.completedAt,
    assignments: Object.freeze(assignments),
    assessmentStates: Object.freeze(local.app.assessmentAssignments
      .filter((item) => item.studentRef === identity.studentRef).map((item) => assessmentState(item, revisions))),
    rflStates: Object.freeze(studentRfl.map((item) => rflState(item, revisions))),
    socialSources: Object.freeze(local.app.sourceAttachments
      .filter((item) => item.studentRef === identity.studentRef).map((item) => socialState(item, revisions))),
    safetyHolds: Object.freeze(local.app.safety.holds
      .filter((item) => item.studentRef === identity.studentRef).map((item) => safetyState(item, revisions))),
    indexedDbDocument: local.indexedDb,
    privacy: Object.freeze({
      pinIncluded: false,
      bearerIncluded: false,
      rawLearnerResponseIncluded: false,
      rawTutorConversationIncluded: false,
      rawAudioIncluded: false,
      inferenceIncluded: false,
      adultAnswerAuthorityIncluded: false,
      answerMaterialIncluded: false,
    }),
  })
  const parsed = parseHostedSyncStateSnapshotR2(snapshot, identity)
  if (parsed.status !== 'ready') throw new Error(`Local state could not enter hosted sync: ${parsed.reason}`)
  return parsed.snapshot
}

function localAttestation(value: HostedSyncRflStateR2): FinalFamilyPilotAttestationRecord {
  return Object.freeze({
    studentRef: value.studentRef,
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    sessionRef: value.sessionRef,
    authority: 'GUARDIAN_ATTESTATION_REQUIRED',
    status: value.guardianState === 'CERTIFIED' ? 'CERTIFIED' : 'PENDING_GUARDIAN_ATTESTATION',
    learnerAssertedAt: value.learnerAssertedAt,
    attestedAt: value.certifiedAt,
    attestedByRef: value.attesterRef,
    evidenceMode: value.evidenceMode,
  })
}

/**
 * Pure import seam. It upserts the selected student and their assignment/session
 * rows, so a receiving device does not need prior local row creation. Siblings
 * in the supplied target template are preserved. The selected student's PIN
 * digest is removed because PIN material is device-local and never synchronized.
 */
export function importHostedSyncStateToLocalBundleR2(input: {
  readonly snapshot: HostedSyncStateSnapshotR2
  readonly target: HostedSyncLocalBundleR2
  readonly expectedIdentity: HostedSyncStateIdentityR2
}): HostedSyncLocalBundleR2 {
  const parsed = parseHostedSyncStateSnapshotR2(input.snapshot, input.expectedIdentity)
  if (parsed.status !== 'ready') throw new Error(`Hosted state import refused: ${parsed.reason}`)
  const state = parsed.snapshot
  const existingCore = input.target.core.students.filter((item) => item.studentRef !== state.identity.studentRef)
  const core: FamilyPilotStateV1 = Object.freeze({
    ...input.target.core,
    updatedAt: state.student.updatedAt,
    activeStudentRef: state.identity.studentRef,
    students: Object.freeze([...existingCore, state.student]),
  })
  if (!parseFamilyPilotState(core)) throw new Error('Imported Core state was invalid.')

  const profile = Object.freeze({ ...state.studentProfile, pinRequired: false })
  const sessions: FinalFamilyPilotSavedSession[] = state.assignments.flatMap((assignment) => {
    const held = assignment.sessionIdentity
    return held ? [Object.freeze({
      studentRef: state.identity.studentRef,
      assignmentRef: held.assignmentRef,
      session: Object.freeze({
        householdRef: state.identity.householdRef,
        learnerRef: state.identity.learnerRef,
        blockRef: held.blockRef,
        sessionRef: held.sessionRef,
      }),
    })] : []
  })
  const sourceAttachments: FinalFamilyPilotSourceAttachment[] = state.socialSources.map((item) => Object.freeze({
    studentRef: item.studentRef,
    assignmentRef: item.assignmentRef,
    lessonRef: item.lessonRef,
    sourceRef: item.sourceRef,
    title: item.title,
    publisher: item.publisher,
    publishedAt: item.publishedAt,
    metadata: Object.freeze(item.metadata.map((entry) => Object.freeze({ ...entry }))),
    adultAttestedAt: item.adultAttestedAt,
    attachedAt: item.attachedAt,
    status: 'ATTACHED_SATISFIED',
  }))
  const assessmentAssignments: FinalFamilyPilotAssessmentAssignment[] = state.assessmentStates.map((item) => Object.freeze({
    assignmentRef: item.assignmentRef,
    assessmentRef: item.assessmentRef,
    studentRef: item.studentRef,
    courseRef: item.courseRef,
    subject: item.subject,
    grade: item.grade,
    title: item.title,
    authorityClass: item.authorityClass,
    status: item.status === 'SCORING_COMPLETE' ? 'PENDING_ASSESSMENT' : item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    completedAt: item.completedAt,
  }))
  const holds: SafetyHoldV1[] = state.safetyHolds.map((item) => Object.freeze({
    schemaVersion: 1,
    holdRef: item.holdRef,
    studentRef: item.studentRef,
    sessionRef: item.sessionRef,
    createdAt: item.createdAt,
    status: item.status === 'CLEARED' ? 'cleared' : item.status === 'ACKNOWLEDGED' ? 'acknowledged' : 'open',
    reasonCode: item.reasonCode,
    source: item.source,
    dedupeKey: item.dedupeKey,
    ...(item.acknowledgedAt ? { acknowledgedAt: item.acknowledgedAt } : {}),
    ...(item.clearedAt ? { clearedAt: item.clearedAt } : {}),
    ...(item.clearerRef ? { clearedBy: item.clearerRef } : {}),
  }))
  const other = (key: 'sessions' | 'sourceAttachments' | 'assessmentAssignments' | 'attestations') =>
    input.target.app[key].filter((item) => item.studentRef !== state.identity.studentRef)
  const app: FinalFamilyPilotAppStateV1 = Object.freeze({
    ...input.target.app,
    householdRef: state.identity.householdRef,
    updatedAt: state.appUpdatedAt,
    setup: Object.freeze({
      completedAt: state.setupCompletedAt,
      students: Object.freeze([
        ...input.target.app.setup.students.filter((item) => item.studentRef !== state.identity.studentRef),
        profile,
      ]),
    }),
    activeStudentRef: state.identity.studentRef,
    sessions: Object.freeze([...other('sessions') as FinalFamilyPilotSavedSession[], ...sessions]),
    sourceAttachments: Object.freeze([...other('sourceAttachments') as FinalFamilyPilotSourceAttachment[], ...sourceAttachments]),
    assessmentAssignments: Object.freeze([...other('assessmentAssignments') as FinalFamilyPilotAssessmentAssignment[], ...assessmentAssignments]),
    attestations: Object.freeze([...other('attestations') as FinalFamilyPilotAttestationRecord[], ...state.rflStates.map(localAttestation)]),
    safety: Object.freeze({
      schemaVersion: 1,
      holds: Object.freeze([...input.target.app.safety.holds.filter((item) => item.studentRef !== state.identity.studentRef), ...holds]),
    }),
  })
  const validatedApp = parseFinalFamilyPilotAppState(app)
  if (!validatedApp.state) throw new Error('Imported final Family Pilot app state was invalid.')

  const durable = parseDurableStudyDocument(state.indexedDbDocument, {
    householdRef: state.identity.householdRef,
    learnerRef: state.identity.learnerRef,
  })
  if (durable.status !== 'current') throw new Error(`Imported IndexedDB state was invalid: ${durable.reasonCode}`)
  return Object.freeze({ core, app: validatedApp.state, indexedDb: durable.document })
}
