import type {
  HostedHouseholdSnapshot,
  HostedStudyDocument,
  HostedSyncResponse,
} from './contracts'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function hasOpenSafetyHold(document: HostedStudyDocument): boolean {
  return document.safetyHolds.some((hold) => hold.status === 'open')
}

export function parseHostedStudyDocument(value: unknown): HostedStudyDocument | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null
  if (
    !isRef(value.documentRef) || !isRef(value.householdRef) || !isRef(value.studentRef) ||
    !Number.isSafeInteger(value.serverRevision) || Number(value.serverRevision) < 0 ||
    !isInstant(value.serverAcceptedAt) || value.rawTutorConversationIncluded !== false ||
    value.privateResponseIncluded !== false || !isRecord(value.assignment) ||
    !isRecord(value.completion) || !Array.isArray(value.safetyHolds)
  ) return null
  const assignment = value.assignment
  if (
    assignment.studentRef !== value.studentRef || !isRef(assignment.assignmentRef) ||
    !isRef(assignment.lessonRef) || !Array.isArray(assignment.segmentRefs) ||
    !Array.isArray(assignment.completedSegmentRefs) ||
    assignment.rawAnswerIncluded !== false || assignment.audioIncluded !== false ||
    assignment.transcriptIncluded !== false
  ) return null
  const completion = value.completion
  if (
    !['learner', 'guardian'].includes(String(completion.authority)) ||
    !['in-progress', 'pending-attestation', 'certified'].includes(String(completion.status))
  ) return null
  for (const hold of value.safetyHolds) {
    if (!isRecord(hold) || !isRef(hold.holdRef) || !['open', 'cleared'].includes(String(hold.status))) return null
  }
  if (value.sourceAttachment !== null) {
    const source = value.sourceAttachment
    if (!isRecord(source) || !isRef(source.sourceRef) || source.status !== 'ATTACHED_SATISFIED') return null
  }
  return clone(value) as unknown as HostedStudyDocument
}

export function parseHostedHouseholdSnapshot(value: unknown): HostedHouseholdSnapshot | null {
  if (!isRecord(value) || !isRef(value.householdRef) || !Array.isArray(value.students) || !Array.isArray(value.documents)) return null
  if (!Number.isSafeInteger(value.serverRevision) || Number(value.serverRevision) < 0) return null
  const documents = value.documents.map(parseHostedStudyDocument)
  if (documents.some((document) => document === null)) return null
  if (!value.students.every((student) => isRecord(student) && isRef(student.studentRef))) return null
  if ((documents as HostedStudyDocument[]).some((document) => document.householdRef !== value.householdRef)) return null
  return clone(value) as unknown as HostedHouseholdSnapshot
}

export function parseHostedSyncResponse(value: unknown, requestRef: string): HostedSyncResponse {
  if (!isRecord(value) || typeof value.status !== 'string' || value.requestRef !== requestRef) {
    return { status: 'invalid-response', requestRef, reasonCode: isRecord(value) && value.requestRef !== requestRef ? 'reordered-response' : 'malformed-response' }
  }
  if (value.status === 'ok') {
    const snapshot = value.snapshot === undefined ? undefined : parseHostedHouseholdSnapshot(value.snapshot)
    const document = value.document === undefined ? undefined : parseHostedStudyDocument(value.document)
    if ((value.snapshot !== undefined && !snapshot) || (value.document !== undefined && !document)) {
      return { status: 'invalid-response', requestRef, reasonCode: 'corrupt-remote-state' }
    }
    return { status: 'ok', requestRef, duplicate: value.duplicate === true, ...(snapshot ? { snapshot } : {}), ...(document ? { document } : {}) }
  }
  if (value.status === 'stale' || value.status === 'safety-blocked') {
    const remote = parseHostedStudyDocument(value.remote)
    if (!remote) return { status: 'invalid-response', requestRef, reasonCode: 'corrupt-remote-state' }
    return value.status === 'stale'
      ? { status: 'stale', requestRef, remote }
      : { status: 'safety-blocked', requestRef, reasonCode: String(value.reasonCode), remote }
  }
  if (value.status === 'auth-error' && value.httpStatus === 401) return value as unknown as HostedSyncResponse
  if (value.status === 'forbidden' && value.httpStatus === 403) return value as unknown as HostedSyncResponse
  if (value.status === 'retryable') return value as unknown as HostedSyncResponse
  if (value.status === 'invalid-response') return value as unknown as HostedSyncResponse
  return { status: 'invalid-response', requestRef, reasonCode: 'malformed-response' }
}

export function assertHostedDocumentInvariants(
  before: HostedStudyDocument,
  after: HostedStudyDocument,
): void {
  if (before.documentRef !== after.documentRef || before.studentRef !== after.studentRef || before.householdRef !== after.householdRef) {
    throw new Error('hosted-document-identity-changed')
  }
  if (after.serverRevision < before.serverRevision) throw new Error('server-revision-regressed')
  if (before.completion.status === 'certified' && after.completion.status !== 'certified') {
    throw new Error('completed-lesson-regressed')
  }
  const lostSegments = before.assignment.completedSegmentRefs.filter(
    (segmentRef) => !after.assignment.completedSegmentRefs.includes(segmentRef),
  )
  if (lostSegments.length > 0) throw new Error('completed-progress-regressed')
  if (before.sourceAttachment && !after.sourceAttachment) throw new Error('source-attachment-regressed')
  for (const hold of before.safetyHolds.filter((item) => item.status === 'open')) {
    const next = after.safetyHolds.find((item) => item.holdRef === hold.holdRef)
    if (!next) throw new Error('safety-hold-disappeared')
  }
}
