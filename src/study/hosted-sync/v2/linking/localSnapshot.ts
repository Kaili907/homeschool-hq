import type { FamilyPilotStateV1 } from '../../../family-pilot/core'
import type { DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports'
import type { FinalFamilyPilotAppStateV1 } from '../../../family-pilot/final-app/state'
import type {
  LocalAssignmentForLink,
  LocalHouseholdForLink,
  LocalStudySessionForLink,
  LocalStudentForLink,
} from './types'

export interface LocalFamilyPilotFirstLinkInput {
  readonly core: FamilyPilotStateV1
  readonly app: FinalFamilyPilotAppStateV1
  readonly studyDocuments: readonly DurableStudyDocumentV1[]
}

function sorted<T>(items: readonly T[], key: (item: T) => string): readonly T[] {
  return Object.freeze([...items].sort((left, right) => key(left).localeCompare(key(right))))
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const expected = new Set(left)
  return expected.size === left.length && new Set(right).size === right.length && right.every((item) => expected.has(item))
}

function assessmentAssignment(
  item: FinalFamilyPilotAppStateV1['assessmentAssignments'][number],
): LocalAssignmentForLink {
  return Object.freeze({
    kind: 'assessment',
    localAssignmentRef: item.assignmentRef,
    contentRef: item.assessmentRef,
    title: item.title,
    subject: item.subject,
    state: item.status,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    progress: Object.freeze({
      completedSegmentRefs: Object.freeze([]),
      totalSegments: 0,
      lastSegmentRef: null,
      activeSeconds: 0,
    }),
  })
}

function sessionState(
  assignment: LocalAssignmentForLink,
): LocalStudySessionForLink['status'] {
  if (assignment.state === 'completed' || assignment.state === 'CERTIFIED') return 'completed'
  if (assignment.state === 'paused') return 'paused'
  if (assignment.state === 'planned' || assignment.state === 'PLANNED') return 'ready'
  return 'active'
}

function sessionsFor(
  studentRef: string,
  assignments: readonly LocalAssignmentForLink[],
  app: FinalFamilyPilotAppStateV1,
  document: DurableStudyDocumentV1 | undefined,
): readonly LocalStudySessionForLink[] {
  const assignmentByRef = new Map(assignments.map((item) => [item.localAssignmentRef, item]))
  const savedBySession = new Map(
    app.sessions
      .filter((item) => item.studentRef === studentRef)
      .map((item) => [item.session.sessionRef, item]),
  )
  if (savedBySession.size !== app.sessions.filter((item) => item.studentRef === studentRef).length) {
    throw new Error(`Saved Study session identities are duplicated for ${studentRef}.`)
  }
  const calendarAssignmentByBlock = new Map(
    (document?.calendar ?? []).map((item) => [
      item.block.internalBlockId,
      item.block.sourceIdentity.externalItemId,
    ]),
  )
  const sessions = new Map<string, LocalStudySessionForLink>()

  for (const held of document?.sessions ?? []) {
    const sessionRef = held.scope.sessionRef
    const saved = savedBySession.get(sessionRef)
    const blockRef = saved?.session.blockRef ?? sessionRef.replace(/:session$/, '')
    const assignmentRef = saved?.assignmentRef ?? calendarAssignmentByBlock.get(blockRef)
    if (!assignmentRef || !assignmentByRef.has(assignmentRef)) {
      throw new Error(`Study session ${sessionRef} has no exact local assignment binding.`)
    }
    const checkpoints = (document?.checkpoints ?? [])
      .filter((item) => item.sessionRef === sessionRef)
      .sort((left, right) => right.revision - left.revision)
    const checkpoint = checkpoints[0]
    sessions.set(sessionRef, Object.freeze({
      localSessionRef: sessionRef,
      localAssignmentRef: assignmentRef,
      blockRef,
      lessonRef: held.lessonRef,
      status: held.status,
      segmentRef: held.segmentRef,
      updatedAt: held.updatedAt,
      lastAcceptedEventRef: held.lastAcceptedEventRef,
      checkpoint: checkpoint ? Object.freeze({
        checkpointRef: checkpoint.checkpointRef,
        revision: checkpoint.revision,
        capturedAt: checkpoint.capturedAt,
        completedSegmentRefs: Object.freeze([...checkpoint.completedSegmentRefs]),
        elapsedActiveSecondsInSegment: checkpoint.elapsedActiveSecondsInSegment,
      }) : null,
    }))
  }

  // A saved app session is identity-bearing even when its durable document has
  // no session snapshot yet. Preserve the identity without fabricating a cursor.
  for (const saved of savedBySession.values()) {
    if (sessions.has(saved.session.sessionRef)) continue
    const assignment = assignmentByRef.get(saved.assignmentRef)
    if (!assignment) {
      throw new Error(`Saved Study session ${saved.session.sessionRef} has no exact local assignment binding.`)
    }
    sessions.set(saved.session.sessionRef, Object.freeze({
      localSessionRef: saved.session.sessionRef,
      localAssignmentRef: saved.assignmentRef,
      blockRef: saved.session.blockRef,
      lessonRef: assignment.contentRef,
      status: sessionState(assignment),
      segmentRef: assignment.progress.lastSegmentRef,
      updatedAt: assignment.updatedAt,
      lastAcceptedEventRef: null,
      checkpoint: null,
    }))
  }
  return sorted([...sessions.values()], (item) => item.localSessionRef)
}

/**
 * Builds the only local shape the linking boundary accepts. This is an explicit
 * allowlist: PIN digests, learner response bodies, Tutor events/transcripts,
 * adult-private material and assessment answer authority have no destination.
 */
export function extractLocalFamilyPilotHousehold(
  input: LocalFamilyPilotFirstLinkInput,
): LocalHouseholdForLink {
  const coreRefs = input.core.students.map((item) => item.studentRef)
  const appRefs = input.app.setup.students.map((item) => item.studentRef)
  if (!sameMembers(coreRefs, appRefs)) {
    throw new Error('Core and final app student identities do not match exactly.')
  }
  if (input.studyDocuments.some((document) => document.scope.householdRef !== input.app.householdRef)) {
    throw new Error('A Study document belongs to a different local household.')
  }
  const documents = new Map<string, DurableStudyDocumentV1>()
  for (const document of input.studyDocuments) {
    if (!appRefs.includes(document.scope.learnerRef) || documents.has(document.scope.learnerRef)) {
      throw new Error('Study documents must map one-to-one to a known local student.')
    }
    documents.set(document.scope.learnerRef, document)
  }

  const students: LocalStudentForLink[] = input.app.setup.students.map((setup) => {
    const core = input.core.students.find((item) => item.studentRef === setup.studentRef)
    if (!core) throw new Error('Local student binding changed during snapshot extraction.')
    const lessonAssignments: LocalAssignmentForLink[] = core.assignments.map((item) => Object.freeze({
      kind: 'lesson',
      localAssignmentRef: item.assignmentRef,
      contentRef: item.lessonRef,
      title: item.title,
      subject: item.subject,
      state: item.state,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      progress: Object.freeze({
        completedSegmentRefs: Object.freeze([...item.progress.completedSegmentRefs]),
        totalSegments: item.progress.totalSegments,
        lastSegmentRef: item.progress.lastSegmentRef,
        activeSeconds: item.progress.activeSeconds,
      }),
    }))
    const assessmentAssignments = input.app.assessmentAssignments
      .filter((item) => item.studentRef === setup.studentRef)
      .map(assessmentAssignment)
    const assignments = sorted([...lessonAssignments, ...assessmentAssignments], (item) => item.localAssignmentRef)
    if (new Set(assignments.map((item) => item.localAssignmentRef)).size !== assignments.length) {
      throw new Error(`Duplicate assignment identity for ${setup.studentRef}.`)
    }
    const document = documents.get(setup.studentRef)
    const studySessions = sessionsFor(setup.studentRef, assignments, input.app, document)
    const sources = sorted(input.app.sourceAttachments
      .filter((item) => item.studentRef === setup.studentRef)
      .map((item) => Object.freeze({
        localSourceRef: item.sourceRef,
        localAssignmentRef: item.assignmentRef,
        lessonRef: item.lessonRef,
        title: item.title,
        publisher: item.publisher,
        publishedAt: item.publishedAt,
        attachedAt: item.attachedAt,
        status: item.status,
      })), (item) => item.localSourceRef)
    const attestations = sorted(input.app.attestations
      .filter((item) => item.studentRef === setup.studentRef)
      .map((item) => Object.freeze({
        localAssignmentRef: item.assignmentRef,
        lessonRef: item.lessonRef,
        localSessionRef: item.sessionRef,
        status: item.status,
        learnerAssertedAt: item.learnerAssertedAt,
        attestedAt: item.attestedAt,
        evidenceMode: item.evidenceMode,
      })), (item) => `${item.localAssignmentRef}:${item.localSessionRef}`)
    const safetyHolds = sorted(input.app.safety.holds
      .filter((item) => item.studentRef === setup.studentRef)
      .map((item) => Object.freeze({
        localHoldRef: item.holdRef,
        localSessionRef: item.sessionRef,
        createdAt: item.createdAt,
        status: item.status,
        reasonCode: item.reasonCode,
        source: item.source,
        acknowledgedAt: item.acknowledgedAt ?? null,
        clearedAt: item.clearedAt ?? null,
      })), (item) => item.localHoldRef)
    if (new Set(sources.map((item) => item.localSourceRef)).size !== sources.length) {
      throw new Error(`Source identities are duplicated for ${setup.studentRef}.`)
    }
    if (new Set(attestations.map((item) => `${item.localAssignmentRef}:${item.localSessionRef}`)).size !== attestations.length) {
      throw new Error(`Attestation identities are duplicated for ${setup.studentRef}.`)
    }
    if (new Set(safetyHolds.map((item) => item.localHoldRef)).size !== safetyHolds.length) {
      throw new Error(`Safety hold identities are duplicated for ${setup.studentRef}.`)
    }
    for (const source of sources) {
      const assignment = assignments.find((item) => item.localAssignmentRef === source.localAssignmentRef)
      if (!assignment || assignment.contentRef !== source.lessonRef) {
        throw new Error(`Source ${source.localSourceRef} has no exact local assignment binding.`)
      }
    }
    for (const attestation of attestations) {
      const assignment = assignments.find((item) => item.localAssignmentRef === attestation.localAssignmentRef)
      if (
        !assignment || assignment.contentRef !== attestation.lessonRef ||
        !studySessions.some((item) => item.localSessionRef === attestation.localSessionRef)
      ) throw new Error(`Attestation for ${attestation.localAssignmentRef} has no exact Study binding.`)
    }
    for (const hold of safetyHolds) {
      if (!studySessions.some((item) => item.localSessionRef === hold.localSessionRef)) {
        throw new Error(`Safety hold ${hold.localHoldRef} has no exact Study session binding.`)
      }
    }
    return Object.freeze({
      localStudentRef: setup.studentRef,
      displayName: setup.displayName,
      identity: Object.freeze({ kind: 'legacy-profile-id', value: setup.studentRef }),
      assignments,
      studyDocument: Object.freeze({
        localDocumentRef: `family-pilot-study:${input.app.householdRef}:${setup.studentRef}`,
        updatedAt: document?.updatedAt ?? input.app.updatedAt,
        sessions: studySessions,
      }),
      sources,
      attestations,
      safetyHolds,
    })
  })

  return Object.freeze({
    localHouseholdRef: input.app.householdRef,
    capturedAt: input.app.updatedAt > input.core.updatedAt ? input.app.updatedAt : input.core.updatedAt,
    students: sorted(students, (item) => item.localStudentRef),
  })
}
