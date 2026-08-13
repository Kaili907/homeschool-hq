import type { CalendarBlock } from '../../../../adaptive-tutor/study-engine/runtime/src/calendar'
import {
  durableStudyDocumentKey,
  emptyDurableStudyDocument,
  parseDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../../family-pilot/durable-ports'
import type { FamilyPilotIndexedDbStudyStorage } from '../../family-pilot/durable-indexeddb'
import type { StudyCheckpoint, StudyLearnerScope, StudySessionSnapshot } from '../../types'
import type { HostedStudyRpcHydrateDocument, HostedStudyRpcScope } from './rpcTypes'

export interface HostedStudyCanonicalLocalStore {
  readonly scope: StudyLearnerScope
  read(): Promise<DurableStudyDocumentV1>
  replaceValidated(document: DurableStudyDocumentV1): Promise<void>
}

/** Canonical Study state remains in the accepted per-student IndexedDB document. */
export function createIndexedDbHostedStudyCanonicalStore(
  storage: FamilyPilotIndexedDbStudyStorage,
): HostedStudyCanonicalLocalStore {
  const key = durableStudyDocumentKey(storage.scope)
  return Object.freeze({
    scope: storage.scope,
    async read() {
      const raw = storage.storage.getItem(key)
      if (raw === null) return emptyDurableStudyDocument(storage.scope, new Date(0).toISOString())
      let value: unknown
      try { value = JSON.parse(raw) } catch { throw new Error('Canonical local Study document is unreadable.') }
      const parsed = parseDurableStudyDocument(value, storage.scope)
      if (parsed.status !== 'current') throw new Error(`Canonical local Study document refused:${parsed.reasonCode}`)
      return parsed.document
    },
    async replaceValidated(document: DurableStudyDocumentV1) {
      const parsed = parseDurableStudyDocument(document, storage.scope)
      if (parsed.status !== 'current') throw new Error(`Hosted hydrate document refused:${parsed.reasonCode}`)
      storage.storage.setItem(key, JSON.stringify(parsed.document))
      await storage.flush()
      const readBack = storage.storage.getItem(key)
      if (readBack === null) throw new Error('Hosted hydrate did not land in IndexedDB.')
      const verified = parseDurableStudyDocument(JSON.parse(readBack), storage.scope)
      if (verified.status !== 'current') throw new Error('Hosted hydrate failed IndexedDB read-back validation.')
    },
  })
}

function remoteSessionStatus(state: HostedStudyRpcHydrateDocument['completionState']): StudySessionSnapshot['status'] {
  if (state === 'planned') return 'ready'
  if (state === 'active') return 'active'
  if (state === 'completed') return 'completed'
  if (state === 'abandoned') return 'stopped'
  return 'paused'
}

function remoteBlockState(state: HostedStudyRpcHydrateDocument['completionState']): CalendarBlock['state'] {
  if (state === 'planned') return 'scheduled'
  if (state === 'active') return 'active'
  if (state === 'completed') return 'completed'
  return 'paused'
}

function prefix(values: readonly string[], plan: readonly string[]): boolean {
  return values.length <= plan.length && values.every((value, index) => value === plan[index])
}

export type HostedHydrateDocumentResult =
  | Readonly<{ status: 'ready'; document: DurableStudyDocumentV1 }>
  | Readonly<{ status: 'conflict'; reason: string }>

/**
 * Applies an RPC projection to a locally constructed curriculum template.
 * Logical revisions establish authority. Server timestamps are used only as
 * required record instants, never to select a winner.
 */
export function applyHostedHydrateToDurableStudyDocument(input: {
  readonly scope: HostedStudyRpcScope
  readonly local: DurableStudyDocumentV1
  readonly remote: HostedStudyRpcHydrateDocument
}): HostedHydrateDocumentResult {
  const { local, remote, scope } = input
  if (local.scope.householdRef !== scope.householdRef || local.scope.learnerRef !== scope.studentRef ||
      remote.studentRef !== scope.studentRef || remote.assignmentRef !== scope.assignmentRef ||
      remote.studySessionId !== scope.sessionRef) return Object.freeze({ status: 'conflict', reason: 'IDENTITY_MISMATCH' })
  const sessionIndex = local.sessions.findIndex((session) => session.scope.sessionRef === scope.sessionRef)
  const calendarIndex = local.calendar.findIndex((record) =>
    record.plan.lessonRef === remote.lessonRef && record.block.learnerRef === scope.studentRef)
  if (sessionIndex < 0 || calendarIndex < 0) {
    return Object.freeze({ status: 'conflict', reason: 'LOCAL_CURRICULUM_TEMPLATE_REQUIRED' })
  }
  const heldSession = local.sessions[sessionIndex] as StudySessionSnapshot
  const heldCalendar = local.calendar[calendarIndex]
  if (heldSession.lessonRef !== remote.lessonRef) return Object.freeze({ status: 'conflict', reason: 'LESSON_MISMATCH' })
  const planRefs = heldCalendar.plan.segments.map((segment) => segment.segmentRef)
  if (!prefix(remote.progress.completedSegmentRefs, planRefs) ||
      (remote.progress.currentSegmentRef !== null && !planRefs.includes(remote.progress.currentSegmentRef))) {
    return Object.freeze({ status: 'conflict', reason: 'REMOTE_PROGRESS_NOT_IN_PLAN' })
  }
  const localCompleted = heldCalendar.block.lineage.completedBeforeOccurrence.concat(
    heldCalendar.block.segments.filter((segment) => segment.completedAt).map((segment) => segment.segmentId),
  )
  if (!prefix(localCompleted, remote.progress.completedSegmentRefs) && !prefix(remote.progress.completedSegmentRefs, localCompleted)) {
    return Object.freeze({ status: 'conflict', reason: 'INCOMPATIBLE_PROGRESS_BRANCH' })
  }
  if ((heldSession.status === 'completed' || heldCalendar.block.state === 'completed') && remote.completionState !== 'completed') {
    return Object.freeze({ status: 'conflict', reason: 'COMPLETION_REGRESSION_REFUSED' })
  }

  const acceptedCompleted = localCompleted.length > remote.progress.completedSegmentRefs.length
    ? localCompleted : remote.progress.completedSegmentRefs
  const acceptedCurrent = remote.completionState === 'completed'
    ? null
    : remote.progress.currentSegmentRef ?? planRefs[acceptedCompleted.length] ?? planRefs.at(-1) ?? null
  const sessionSegment = acceptedCurrent ?? acceptedCompleted.at(-1) ?? heldSession.segmentRef
  if (!sessionSegment) return Object.freeze({ status: 'conflict', reason: 'CURRENT_SEGMENT_UNAVAILABLE' })
  const at = remote.syncMetadata.serverAcceptedAt
  const elapsed = typeof remote.progress.safeInstructionalCursor?.elapsedActiveSecondsInSegment === 'number' &&
    Number.isSafeInteger(remote.progress.safeInstructionalCursor.elapsedActiveSecondsInSegment) &&
    remote.progress.safeInstructionalCursor.elapsedActiveSecondsInSegment >= 0
    ? remote.progress.safeInstructionalCursor.elapsedActiveSecondsInSegment : 0
  const nextBlock: CalendarBlock = Object.freeze({
    ...heldCalendar.block,
    state: remoteBlockState(remote.completionState),
    segments: Object.freeze(heldCalendar.block.segments.map((segment) =>
      acceptedCompleted.includes(segment.segmentId)
        ? Object.freeze({ ...segment, completedAt: segment.completedAt ?? at })
        : segment)),
    ...(!acceptedCurrent ? {} : {
      resumePoint: Object.freeze({
        segmentId: acceptedCurrent,
        segmentOrdinal: planRefs.indexOf(acceptedCurrent) + 1,
        elapsedActiveSecondsInSegment: elapsed,
        completedSegmentIds: Object.freeze([...acceptedCompleted]),
        remainingSegmentIds: Object.freeze(planRefs.filter((ref) => !acceptedCompleted.includes(ref))),
        capturedAt: remote.progress.checkpointUpdatedAt ?? at,
      }) as CalendarBlock['resumePoint'],
    }),
    revision: Math.max(heldCalendar.block.revision, remote.revisions.session),
    lastEventAt: at,
  })
  const nextSession: StudySessionSnapshot = Object.freeze({
    ...heldSession,
    segmentRef: sessionSegment,
    status: remoteSessionStatus(remote.completionState),
    updatedAt: at,
  })
  const existingCheckpoint = local.checkpoints.find((checkpoint) => checkpoint.sessionRef === scope.sessionRef)
  const nextCheckpoint: StudyCheckpoint = Object.freeze({
    checkpointRef: existingCheckpoint?.checkpointRef ?? `checkpoint:hosted:${scope.sessionRef}`,
    householdRef: scope.householdRef,
    learnerRef: scope.studentRef,
    sessionRef: scope.sessionRef,
    lessonRef: remote.lessonRef,
    segmentRef: sessionSegment,
    revision: Math.max(existingCheckpoint?.revision ?? 0, remote.revisions.checkpoint),
    capturedAt: remote.progress.checkpointUpdatedAt ?? at,
    completedSegmentRefs: Object.freeze([...acceptedCompleted]),
    elapsedActiveSecondsInSegment: elapsed,
    responseDraftRef: existingCheckpoint?.responseDraftRef ?? null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
  const next: DurableStudyDocumentV1 = Object.freeze({
    ...local,
    updatedAt: at,
    calendar: Object.freeze(local.calendar.map((record, index) => index === calendarIndex
      ? Object.freeze({ ...record, block: nextBlock }) : record)),
    sessions: Object.freeze(local.sessions.map((session, index) => index === sessionIndex ? nextSession : session)),
    checkpoints: Object.freeze([
      ...local.checkpoints.filter((checkpoint) => checkpoint.sessionRef !== scope.sessionRef),
      nextCheckpoint,
    ]),
  })
  const parsed = parseDurableStudyDocument(next, local.scope)
  return parsed.status === 'current'
    ? Object.freeze({ status: 'ready', document: parsed.document })
    : Object.freeze({ status: 'conflict', reason: `HYDRATE_DOCUMENT_INVALID:${parsed.reasonCode}` })
}
