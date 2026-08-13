import { assertMinimizedEvent, assertMinimizedForStorage } from '../../family-pilot/durable-ports/minimization'
import type {
  ConflictClassification,
  ReconciliableStudyState,
  ReconcileStudyStateInput,
  StudyAuthorityStamp,
  StudyConflictCode,
  StudyConflictDiagnostic,
  StudyDocumentIdentity,
  StudyFieldAuthority,
  StudyReconciliationOutcome,
  StudySyncOperationMetadata,
  StudySyncReplica,
} from './types'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const OPERATION_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

type Side = 'local' | 'remote'

interface CompatibleMerge {
  readonly state: ReconciliableStudyState
  readonly authority: StudyFieldAuthority
  readonly pendingOperations: readonly StudySyncOperationMetadata[]
  readonly appliedOperationIds: readonly string[]
}

type MergeAnalysis =
  | { readonly status: 'compatible'; readonly merge: CompatibleMerge }
  | { readonly status: 'conflict'; readonly codes: readonly StudyConflictCode[] }
  | { readonly status: 'identity'; readonly codes: readonly StudyConflictCode[] }

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function isOperationRef(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_REF.test(value)
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    )
  }
  return value
}

function canonical(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function same(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right)
}

function uniqueCodes(codes: readonly StudyConflictCode[]): readonly StudyConflictCode[] {
  return Object.freeze([...new Set(codes)].sort())
}

export function studyDocumentId(identity: StudyDocumentIdentity): string {
  const values = [
    identity.householdRef,
    identity.learnerRef,
    identity.studentRef,
    identity.assignmentRef,
    identity.lessonRef,
    identity.blockRef,
    identity.sessionRef,
    identity.lineageRootRef,
    identity.lineageKey,
  ]
  return values.every(isRef) ? values.join('|') : 'invalid-study-document'
}

function diagnostic(
  local: StudySyncReplica,
  remote: StudySyncReplica,
  codes: readonly StudyConflictCode[],
): StudyConflictDiagnostic {
  return Object.freeze({
    documentId: studyDocumentId(local.identity),
    codes: uniqueCodes(codes),
    localServerRevision: isRevision(local.metadata.serverRevision) ? local.metadata.serverRevision : -1,
    remoteServerRevision: isRevision(remote.metadata.serverRevision) ? remote.metadata.serverRevision : -1,
    localRevision: isRevision(local.metadata.localRevision) ? local.metadata.localRevision : -1,
    remoteLocalRevision: isRevision(remote.metadata.localRevision) ? remote.metadata.localRevision : -1,
  })
}

function identityCodes(local: StudyDocumentIdentity, remote: StudyDocumentIdentity): readonly StudyConflictCode[] {
  const codes: StudyConflictCode[] = []
  if (local.householdRef !== remote.householdRef) codes.push('HOUSEHOLD_BINDING_MISMATCH')
  if (local.studentRef !== remote.studentRef || local.learnerRef !== remote.learnerRef) {
    codes.push('STUDENT_BINDING_MISMATCH')
  }
  if (local.assignmentRef !== remote.assignmentRef) codes.push('ASSIGNMENT_BINDING_MISMATCH')
  if (local.lessonRef !== remote.lessonRef) codes.push('LESSON_BINDING_MISMATCH')
  if (local.sessionRef !== remote.sessionRef || local.blockRef !== remote.blockRef) {
    codes.push('SESSION_BINDING_MISMATCH')
  }
  if (local.lineageRootRef !== remote.lineageRootRef || local.lineageKey !== remote.lineageKey) {
    codes.push('LINEAGE_BINDING_MISMATCH')
  }
  if (codes.length > 0) codes.unshift('DOCUMENT_IDENTITY_MISMATCH')
  return uniqueCodes(codes)
}

function stampIsValid(stamp: StudyAuthorityStamp): boolean {
  return isRevision(stamp?.revision) && isOperationRef(stamp?.operationId) &&
    ['STUDENT', 'PARENT', 'SERVER', 'SYSTEM'].includes(stamp?.actor)
}

function operationIsValid(operation: StudySyncOperationMetadata, deviceId: string, localRevision: number): boolean {
  return isOperationRef(operation?.operationId) && operation?.deviceId === deviceId &&
    isRevision(operation?.localRevision) && operation.localRevision <= localRevision &&
    [
      'PROGRESS', 'CHECKPOINT', 'LEARNER_COMPLETION', 'GUARDIAN_ATTESTATION', 'SAFETY_HOLD',
      'SAFETY_CLEAR', 'SOURCE_ATTACHMENT', 'PREFERENCE', 'PARENT_SETTINGS', 'ASSIGNMENT_AUTHORITY',
    ].includes(operation?.kind) && ['STUDENT', 'PARENT', 'SERVER', 'SYSTEM'].includes(operation?.actor)
}

function metadataCodes(replica: StudySyncReplica): StudyConflictCode[] {
  const { metadata } = replica
  const codes: StudyConflictCode[] = []
  if (
    !isRevision(metadata?.serverRevision) || !isRevision(metadata?.baseServerRevision) ||
    !isRevision(metadata?.localRevision) || metadata.baseServerRevision > metadata.serverRevision ||
    !isOperationRef(metadata?.deviceId)
  ) codes.push('REVISION_METADATA_INVALID')

  const pending = Array.isArray(metadata?.pendingOperations) ? metadata.pendingOperations : []
  const applied = Array.isArray(metadata?.appliedOperationIds) ? metadata.appliedOperationIds : []
  if (
    !pending.every((operation) => operationIsValid(operation, metadata.deviceId, metadata.localRevision)) ||
    new Set(pending.map((operation) => operation.operationId)).size !== pending.length ||
    !applied.every(isOperationRef) || new Set(applied).size !== applied.length
  ) codes.push('QUEUE_METADATA_INVALID')

  const authority = metadata?.authority
  const scalarStamps = authority ? [
    authority.assignment,
    authority.calendar,
    authority.requirements,
    authority.preferences,
    authority.parentSettings,
    authority.sourceAttachment,
    authority.attestation,
  ] : []
  if (!authority || !scalarStamps.every(stampIsValid) ||
      !authority.safetyHolds || !Object.values(authority.safetyHolds).every(stampIsValid)) {
    codes.push('REVISION_METADATA_INVALID')
  }
  return codes
}

function completedRefs(state: ReconciliableStudyState): readonly string[] {
  const complete = new Set<string>(state.calendar.block.lineage.completedBeforeOccurrence)
  for (const segment of state.calendar.block.segments) {
    if (segment.completedAt) complete.add(segment.segmentId)
  }
  return state.calendar.plan.segments
    .map((segment) => segment.segmentRef)
    .filter((segmentRef) => complete.has(segmentRef))
}

function refsArePrefix(refs: readonly string[], plan: readonly string[]): boolean {
  return refs.length <= plan.length && refs.every((ref, index) => ref === plan[index])
}

function stateBindingCodes(replica: StudySyncReplica): StudyConflictCode[] {
  const { identity, state, metadata } = replica
  const codes: StudyConflictCode[] = []
  const assignment = state?.assignment
  const block = state?.calendar?.block
  const plan = state?.calendar?.plan
  const saved = state?.savedSession
  const session = state?.session
  const readiness = state?.readiness
  if (!assignment || !block || !plan || !saved || !session || !readiness) return ['STATE_BINDING_INVALID']

  if (
    !Object.values(identity).every(isRef) ||
    assignment.assignmentRef !== identity.assignmentRef || assignment.lessonRef !== identity.lessonRef ||
    saved.studentRef !== identity.studentRef || saved.assignmentRef !== identity.assignmentRef ||
    saved.session.householdRef !== identity.householdRef || saved.session.learnerRef !== identity.learnerRef ||
    saved.session.blockRef !== identity.blockRef || saved.session.sessionRef !== identity.sessionRef ||
    block.internalBlockId !== identity.blockRef || block.learnerRef !== identity.learnerRef ||
    block.lineage.rootInternalBlockId !== identity.lineageRootRef || block.lineage.continuationKey !== identity.lineageKey ||
    plan.lessonRef !== identity.lessonRef ||
    session.scope.householdRef !== identity.householdRef || session.scope.learnerRef !== identity.learnerRef ||
    session.scope.sessionRef !== identity.sessionRef || session.lessonRef !== identity.lessonRef ||
    readiness.assignmentRef !== identity.assignmentRef || readiness.lessonRef !== identity.lessonRef
  ) codes.push('STATE_BINDING_INVALID')

  const planRefs = plan.segments.map((segment) => segment.segmentRef)
  const blockRefs = block.segments.map((segment) => segment.segmentId)
  const complete = completedRefs(state)
  if (
    new Set(planRefs).size !== planRefs.length || new Set(blockRefs).size !== blockRefs.length ||
    !blockRefs.every((ref) => planRefs.includes(ref)) ||
    !block.lineage.completedBeforeOccurrence.every((ref) => planRefs.includes(ref)) ||
    !refsArePrefix(complete, planRefs) ||
    !same(assignment.progress.completedSegmentRefs, complete) ||
    assignment.progress.totalSegments !== planRefs.length ||
    !planRefs.includes(session.segmentRef)
  ) codes.push('STATE_BINDING_INVALID')

  if (state.checkpoint) {
    const checkpoint = state.checkpoint
    if (
      checkpoint.householdRef !== identity.householdRef || checkpoint.learnerRef !== identity.learnerRef ||
      checkpoint.sessionRef !== identity.sessionRef || checkpoint.lessonRef !== identity.lessonRef ||
      !planRefs.includes(checkpoint.segmentRef) ||
      !checkpoint.completedSegmentRefs.every((ref) => complete.includes(ref)) ||
      !refsArePrefix(checkpoint.completedSegmentRefs, planRefs) ||
      !isRevision(checkpoint.revision) || checkpoint.rawAnswerIncluded !== false || checkpoint.transcriptIncluded !== false
    ) codes.push('STATE_BINDING_INVALID')
  }

  if (
    session.rawAnswerIncluded !== false || session.transcriptIncluded !== false ||
    assignment.rawAnswerIncluded !== false || assignment.transcriptIncluded !== false ||
    !isRevision(block.revision)
  ) codes.push('PRIVACY_MINIMIZATION_FAILED')

  const eventRefs = new Set<string>()
  const semanticKeys = new Set<string>()
  for (const record of state.events) {
    try {
      assertMinimizedEvent(record.event)
    } catch {
      codes.push('PRIVACY_MINIMIZATION_FAILED')
    }
    if (
      record.sessionRef !== identity.sessionRef || record.eventRef !== record.event.eventRef ||
      eventRefs.has(record.eventRef) || semanticKeys.has(record.semanticKey)
    ) codes.push('STATE_BINDING_INVALID')
    eventRefs.add(record.eventRef)
    semanticKeys.add(record.semanticKey)
  }

  if (state.sourceAttachment && (
    state.sourceAttachment.studentRef !== identity.studentRef ||
    state.sourceAttachment.assignmentRef !== identity.assignmentRef ||
    state.sourceAttachment.lessonRef !== identity.lessonRef ||
    state.sourceAttachment.status !== 'ATTACHED_SATISFIED'
  )) codes.push('STATE_BINDING_INVALID')

  const attestation = state.attestation
  if (attestation && (
    attestation.studentRef !== identity.studentRef || attestation.assignmentRef !== identity.assignmentRef ||
    attestation.lessonRef !== identity.lessonRef || attestation.sessionRef !== identity.sessionRef ||
    attestation.authority !== 'GUARDIAN_ATTESTATION_REQUIRED'
  )) codes.push('STATE_BINDING_INVALID')

  const completed = assignment.state === 'completed'
  const calendarCompleted = block.state === 'completed'
  const runtimeCompleted = calendarCompleted && session.status === 'completed'
  if (
    readiness.dynamicSourceRequirement === 'SOCIAL_STUDIES_SOURCE_ATTACHMENT' &&
    assignment.subject !== 'social-studies'
  ) codes.push('STATE_BINDING_INVALID')
  if (completed && !runtimeCompleted) codes.push('COMPLETION_AUTHORITY_INVALID')
  if (readiness.completionRequirement === 'GUARDIAN_ATTESTATION') {
    if (completed && attestation?.status !== 'CERTIFIED') codes.push('COMPLETION_AUTHORITY_INVALID')
  } else if (attestation) {
    codes.push('COMPLETION_AUTHORITY_INVALID')
  }
  if (attestation?.status === 'CERTIFIED' && (!completed || !runtimeCompleted ||
      !['PARENT', 'SERVER'].includes(metadata.authority.attestation.actor))) {
    codes.push('COMPLETION_AUTHORITY_INVALID')
  }
  // The accepted final composition intentionally leaves the Study session
  // active while a completed calendar block waits for guardian attestation.
  if (attestation?.status === 'PENDING_GUARDIAN_ATTESTATION' && !calendarCompleted) {
    codes.push('COMPLETION_AUTHORITY_INVALID')
  }

  if (!['PARENT', 'SERVER'].includes(metadata.authority.assignment.actor) ||
      !['PARENT', 'SERVER'].includes(metadata.authority.calendar.actor) ||
      !['PARENT', 'SERVER'].includes(metadata.authority.requirements.actor) ||
      !['PARENT', 'SERVER'].includes(metadata.authority.parentSettings.actor)) {
    codes.push('REVISION_METADATA_INVALID')
  }
  if (state.parentSettings && metadata.authority.parentSettings.revision !== state.parentSettings.revision) {
    codes.push('REVISION_METADATA_INVALID')
  }
  if (!state.parentSettings && metadata.authority.parentSettings.revision !== 0) {
    codes.push('REVISION_METADATA_INVALID')
  }
  if (state.sourceAttachment && metadata.authority.sourceAttachment.revision === 0) {
    codes.push('REVISION_METADATA_INVALID')
  }
  if (attestation && metadata.authority.attestation.revision === 0) {
    codes.push('REVISION_METADATA_INVALID')
  }

  const holdRefs = new Set<string>()
  const dedupeKeys = new Set<string>()
  for (const hold of state.safetyHolds) {
    const stamp = metadata.authority.safetyHolds[hold.holdRef]
    if (
      hold.studentRef !== identity.studentRef || hold.sessionRef !== identity.sessionRef ||
      holdRefs.has(hold.holdRef) || dedupeKeys.has(hold.dedupeKey) || !stamp
    ) codes.push('STATE_BINDING_INVALID')
    if (hold.status === 'cleared' && (!['PARENT', 'SERVER'].includes(stamp?.actor) ||
        !hold.clearedAt || !hold.clearedBy)) {
      codes.push('SAFETY_CLEAR_UNAUTHORIZED')
    }
    holdRefs.add(hold.holdRef)
    dedupeKeys.add(hold.dedupeKey)
  }
  if (Object.keys(metadata.authority.safetyHolds).some((ref) => !holdRefs.has(ref))) {
    codes.push('REVISION_METADATA_INVALID')
  }

  try {
    assertMinimizedForStorage(state)
  } catch {
    codes.push('PRIVACY_MINIMIZATION_FAILED')
  }
  return codes
}

function validationCodes(replica: StudySyncReplica): readonly StudyConflictCode[] {
  return uniqueCodes([...metadataCodes(replica), ...stateBindingCodes(replica)])
}

function includesAll(superset: readonly string[], subset: readonly string[]): boolean {
  const held = new Set(superset)
  return subset.every((value) => held.has(value))
}

function stableSide(local: StudySyncReplica, remote: StudySyncReplica): Side {
  return local.metadata.deviceId.localeCompare(remote.metadata.deviceId) <= 0 ? 'local' : 'remote'
}

function sideValue<T>(side: Side, local: T, remote: T): T {
  return side === 'local' ? local : remote
}

function calendarPlanFingerprint(state: ReconciliableStudyState): string {
  return canonical(state.calendar.plan)
}

function calendarAuthorityFingerprint(state: ReconciliableStudyState): string {
  const block = state.calendar.block
  return canonical({
    schemaVersion: block.schemaVersion,
    internalBlockId: block.internalBlockId,
    learnerRef: block.learnerRef,
    sourceIdentity: block.sourceIdentity,
    lineage: block.lineage,
    title: block.title,
    subject: block.subject,
    blockType: block.blockType,
    canonicalTask: block.canonicalTask,
    householdTimeZone: block.householdTimeZone,
    scheduledLocalStart: block.scheduledLocalStart,
    scheduledStartInstant: block.scheduledStartInstant,
    intendedLocalDate: block.intendedLocalDate,
    placementSource: block.placementSource,
    estimatedDurationMinutes: block.estimatedDurationMinutes,
    timerVisibility: block.timerVisibility,
    segments: block.segments.map((segment) => ({
      segmentId: segment.segmentId,
      planOrdinal: segment.planOrdinal,
      title: segment.title,
      canonicalTaskType: segment.canonicalTaskType,
      customTaskTypeId: segment.customTaskTypeId,
      estimatedMinutes: segment.estimatedMinutes,
      required: segment.required,
    })),
  })
}

function assignmentAuthorityFingerprint(state: ReconciliableStudyState): string {
  const assignment = state.assignment
  return canonical({
    assignmentRef: assignment.assignmentRef,
    lessonRef: assignment.lessonRef,
    subject: assignment.subject,
    title: assignment.title,
    totalSegments: assignment.progress.totalSegments,
    rawAnswerIncluded: assignment.rawAnswerIncluded,
    transcriptIncluded: assignment.transcriptIncluded,
  })
}

function progressCounters(state: ReconciliableStudyState): readonly number[] {
  return [
    state.assignment.progress.activeSeconds,
    state.assignment.pause.pausedSeconds,
    state.calendar.block.actualDurationSeconds,
    ...state.calendar.block.segments.map((segment) => segment.actualActiveSeconds),
  ]
}

function countersInclude(advanced: ReconciliableStudyState, stale: ReconciliableStudyState): boolean {
  const left = progressCounters(advanced)
  const right = progressCounters(stale)
  return left.length === right.length && left.every((value, index) => value >= right[index])
}

function checkpointMeaning(state: ReconciliableStudyState): unknown {
  if (!state.checkpoint) return null
  const { capturedAt: _capturedAt, ...meaning } = state.checkpoint
  return meaning
}

function currentPositionMeaning(state: ReconciliableStudyState): unknown {
  const block = state.calendar.block
  return {
    assignmentState: state.assignment.state,
    sessionStatus: state.session.status,
    sessionSegmentRef: state.session.segmentRef,
    blockState: block.state,
    resumePoint: block.resumePoint ? {
      segmentId: block.resumePoint.segmentId,
      segmentOrdinal: block.resumePoint.segmentOrdinal,
      elapsedActiveSecondsInSegment: block.resumePoint.elapsedActiveSecondsInSegment,
      responseDraftRef: block.resumePoint.responseDraftRef ?? null,
      completedSegmentIds: block.resumePoint.completedSegmentIds,
      remainingSegmentIds: block.resumePoint.remainingSegmentIds,
    } : null,
    checkpoint: checkpointMeaning(state),
  }
}

function chooseProgressSide(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): { readonly side?: Side; readonly codes: readonly StudyConflictCode[] } {
  const localState = local.state
  const remoteState = remote.state
  const localComplete = completedRefs(localState)
  const remoteComplete = completedRefs(remoteState)

  if (localState.assignment.state === 'abandoned' !== (remoteState.assignment.state === 'abandoned')) {
    return { codes: ['ASSIGNMENT_ABANDONED_CONFLICT'] }
  }
  if (localState.assignment.state === 'abandoned' && remoteState.assignment.state === 'abandoned') {
    const comparison = compareStamp(local.metadata.authority.assignment, remote.metadata.authority.assignment)
    if (comparison === 0 && !same(localState.assignment, remoteState.assignment)) {
      return { codes: ['ASSIGNMENT_AUTHORITY_COLLISION'] }
    }
    return { side: comparison > 0 ? 'local' : comparison < 0 ? 'remote' : stableSide(local, remote), codes: [] }
  }

  if (localState.assignment.state === 'completed' !== (remoteState.assignment.state === 'completed')) {
    return { side: localState.assignment.state === 'completed' ? 'local' : 'remote', codes: [] }
  }

  const localContains = includesAll(localComplete, remoteComplete)
  const remoteContains = includesAll(remoteComplete, localComplete)
  if (!localContains && !remoteContains) return { codes: ['INCOMPATIBLE_PROGRESS_BRANCH'] }
  if (localComplete.length !== remoteComplete.length) {
    const side: Side = localComplete.length > remoteComplete.length ? 'local' : 'remote'
    const advanced = sideValue(side, localState, remoteState)
    const stale = sideValue(side === 'local' ? 'remote' : 'local', localState, remoteState)
    if (advanced.calendar.block.revision < stale.calendar.block.revision || !countersInclude(advanced, stale)) {
      return { codes: ['INCOMPATIBLE_PROGRESS_BRANCH'] }
    }
    return { side, codes: [] }
  }

  const localCheckpointRevision = localState.checkpoint?.revision ?? -1
  const remoteCheckpointRevision = remoteState.checkpoint?.revision ?? -1
  if (localCheckpointRevision !== remoteCheckpointRevision) {
    return { side: localCheckpointRevision > remoteCheckpointRevision ? 'local' : 'remote', codes: [] }
  }
  if (!same(checkpointMeaning(localState), checkpointMeaning(remoteState))) {
    return { codes: [localCheckpointRevision >= 0
      ? 'CHECKPOINT_REVISION_COLLISION'
      : 'INCOMPATIBLE_CURRENT_CHECKPOINT'] }
  }

  if (localState.calendar.block.revision !== remoteState.calendar.block.revision) {
    const side: Side = localState.calendar.block.revision > remoteState.calendar.block.revision ? 'local' : 'remote'
    const advanced = sideValue(side, localState, remoteState)
    const stale = sideValue(side === 'local' ? 'remote' : 'local', localState, remoteState)
    return countersInclude(advanced, stale)
      ? { side, codes: [] }
      : { codes: ['INCOMPATIBLE_PROGRESS_BRANCH'] }
  }
  if (!same(progressCounters(localState), progressCounters(remoteState))) {
    return { codes: ['INCOMPATIBLE_CURRENT_CHECKPOINT'] }
  }
  if (!same(currentPositionMeaning(localState), currentPositionMeaning(remoteState))) {
    return { codes: ['INCOMPATIBLE_CURRENT_CHECKPOINT'] }
  }
  return { side: stableSide(local, remote), codes: [] }
}

function compareStamp(local: StudyAuthorityStamp, remote: StudyAuthorityStamp): number {
  if (local.revision !== remote.revision) return local.revision > remote.revision ? 1 : -1
  if (local.operationId === remote.operationId && local.actor === remote.actor) return 0
  return 0
}

function chooseRevisionField<T>(input: {
  readonly localValue: T
  readonly remoteValue: T
  readonly localStamp: StudyAuthorityStamp
  readonly remoteStamp: StudyAuthorityStamp
  readonly localReplica: StudySyncReplica
  readonly remoteReplica: StudySyncReplica
  readonly collisionCode: StudyConflictCode
}): { readonly value?: T; readonly stamp?: StudyAuthorityStamp; readonly code?: StudyConflictCode } {
  const equal = same(input.localValue, input.remoteValue)
  if (input.localStamp.revision !== input.remoteStamp.revision) {
    const localWins = input.localStamp.revision > input.remoteStamp.revision
    return {
      value: localWins ? input.localValue : input.remoteValue,
      stamp: localWins ? input.localStamp : input.remoteStamp,
    }
  }
  if (!equal && (
    input.localStamp.operationId !== input.remoteStamp.operationId ||
    input.localStamp.actor !== input.remoteStamp.actor
  )) return { code: input.collisionCode }
  if (!equal) return { code: input.collisionCode }
  const side = stableSide(input.localReplica, input.remoteReplica)
  return {
    value: sideValue(side, input.localValue, input.remoteValue),
    stamp: sideValue(side, input.localStamp, input.remoteStamp),
  }
}

function eventMeaning(record: ReconciliableStudyState['events'][number]): unknown {
  return {
    sessionRef: record.sessionRef,
    semanticKey: record.semanticKey,
    type: record.event.type,
    payload: record.event.payload,
  }
}

function mergeEvents(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): { readonly events?: ReconciliableStudyState['events']; readonly code?: StudyConflictCode } {
  const byRef = new Map<string, ReconciliableStudyState['events'][number]>()
  const bySemantic = new Map<string, ReconciliableStudyState['events'][number]>()
  const ordered = [...local.state.events, ...remote.state.events]
  for (const record of ordered) {
    const refPrevious = byRef.get(record.eventRef)
    if (refPrevious && !same(eventMeaning(refPrevious), eventMeaning(record))) {
      return { code: 'EVENT_IDENTITY_COLLISION' }
    }
    const semanticPrevious = bySemantic.get(record.semanticKey)
    if (semanticPrevious && !same(eventMeaning(semanticPrevious), eventMeaning(record))) {
      return { code: 'EVENT_SEMANTIC_COLLISION' }
    }
    if (refPrevious || semanticPrevious) {
      const previous = refPrevious ?? semanticPrevious
      if (previous && record.eventRef.localeCompare(previous.eventRef) < 0) {
        byRef.delete(previous.eventRef)
        byRef.set(record.eventRef, record)
        bySemantic.set(record.semanticKey, record)
      }
      continue
    }
    byRef.set(record.eventRef, record)
    bySemantic.set(record.semanticKey, record)
  }
  return {
    events: Object.freeze([...byRef.values()].sort((left, right) =>
      left.semanticKey.localeCompare(right.semanticKey) || left.eventRef.localeCompare(right.eventRef))),
  }
}

function mergeQueues(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): {
  readonly pending?: readonly StudySyncOperationMetadata[]
  readonly applied?: readonly string[]
  readonly code?: StudyConflictCode
} {
  const applied = new Set([...local.metadata.appliedOperationIds, ...remote.metadata.appliedOperationIds])
  const byId = new Map<string, StudySyncOperationMetadata>()
  for (const operation of [...local.metadata.pendingOperations, ...remote.metadata.pendingOperations]) {
    const previous = byId.get(operation.operationId)
    if (previous && !same(previous, operation)) return { code: 'QUEUE_METADATA_INVALID' }
    if (!applied.has(operation.operationId)) byId.set(operation.operationId, operation)
  }
  return {
    pending: Object.freeze([...byId.values()].sort((left, right) => left.operationId.localeCompare(right.operationId))),
    applied: Object.freeze([...applied].sort()),
  }
}

function chooseAttestation(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): { readonly value?: ReconciliableStudyState['attestation']; readonly stamp?: StudyAuthorityStamp; readonly code?: StudyConflictCode } {
  const left = local.state.attestation
  const right = remote.state.attestation
  const rank = (value: typeof left): number => value?.status === 'CERTIFIED' ? 2 : value ? 1 : 0
  if (rank(left) !== rank(right)) {
    const side: Side = rank(left) > rank(right) ? 'local' : 'remote'
    return {
      value: sideValue(side, left, right),
      stamp: sideValue(side, local.metadata.authority.attestation, remote.metadata.authority.attestation),
    }
  }
  return chooseRevisionField({
    localValue: left,
    remoteValue: right,
    localStamp: local.metadata.authority.attestation,
    remoteStamp: remote.metadata.authority.attestation,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'ATTESTATION_AUTHORITY_COLLISION',
  })
}

function chooseSource(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): { readonly value?: ReconciliableStudyState['sourceAttachment']; readonly stamp?: StudyAuthorityStamp; readonly code?: StudyConflictCode } {
  const left = local.state.sourceAttachment
  const right = remote.state.sourceAttachment
  if (Boolean(left) !== Boolean(right)) {
    const side: Side = left ? 'local' : 'remote'
    return {
      value: sideValue(side, left, right),
      stamp: sideValue(side, local.metadata.authority.sourceAttachment, remote.metadata.authority.sourceAttachment),
    }
  }
  return chooseRevisionField({
    localValue: left,
    remoteValue: right,
    localStamp: local.metadata.authority.sourceAttachment,
    remoteStamp: remote.metadata.authority.sourceAttachment,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'SOURCE_ATTACHMENT_CONFLICT',
  })
}

function mergeSafety(
  local: StudySyncReplica,
  remote: StudySyncReplica,
): {
  readonly holds?: ReconciliableStudyState['safetyHolds']
  readonly authority?: StudyFieldAuthority['safetyHolds']
  readonly code?: StudyConflictCode
} {
  const byKey = new Map<string, { hold: ReconciliableStudyState['safetyHolds'][number]; stamp: StudyAuthorityStamp }>()
  for (const [side, replica] of [['local', local], ['remote', remote]] as const) {
    for (const hold of replica.state.safetyHolds) {
      const stamp = replica.metadata.authority.safetyHolds[hold.holdRef]
      const previous = byKey.get(hold.dedupeKey)
      if (!previous) {
        byKey.set(hold.dedupeKey, { hold, stamp })
        continue
      }
      const previousCleared = previous.hold.status === 'cleared'
      const incomingCleared = hold.status === 'cleared'
      if (previousCleared !== incomingCleared) {
        if (previous.stamp.revision === stamp.revision) return { code: 'SAFETY_AUTHORITY_COLLISION' }
        if (stamp.revision > previous.stamp.revision) byKey.set(hold.dedupeKey, { hold, stamp })
        continue
      }
      if (!same(previous.hold, hold)) {
        if (previous.stamp.revision === stamp.revision) {
          // Both forms still block. Acknowledgement is safe to preserve; any
          // other equal-revision disagreement needs explicit resolution.
          const statuses = new Set([previous.hold.status, hold.status])
          if (!previousCleared && statuses.size <= 2 && statuses.has('acknowledged')) {
            if (hold.status === 'acknowledged') byKey.set(hold.dedupeKey, { hold, stamp })
            continue
          }
          return { code: 'SAFETY_AUTHORITY_COLLISION' }
        }
        if (stamp.revision > previous.stamp.revision) byKey.set(hold.dedupeKey, { hold, stamp })
      } else if (stamp.revision > previous.stamp.revision) {
        byKey.set(hold.dedupeKey, { hold, stamp })
      } else if (stamp.revision === previous.stamp.revision && side === stableSide(local, remote)) {
        byKey.set(hold.dedupeKey, { hold, stamp })
      }
    }
  }
  const selected = [...byKey.values()].sort((left, right) => left.hold.holdRef.localeCompare(right.hold.holdRef))
  return {
    holds: Object.freeze(selected.map((entry) => entry.hold)),
    authority: Object.freeze(Object.fromEntries(selected.map((entry) => [entry.hold.holdRef, entry.stamp]))),
  }
}

function analyze(local: StudySyncReplica, remote: StudySyncReplica): MergeAnalysis {
  const mismatches = identityCodes(local.identity, remote.identity)
  if (mismatches.length > 0) return { status: 'identity', codes: mismatches }

  const invalid = uniqueCodes([...validationCodes(local), ...validationCodes(remote)])
  if (invalid.length > 0) return { status: 'conflict', codes: invalid }
  if (calendarPlanFingerprint(local.state) !== calendarPlanFingerprint(remote.state)) {
    return { status: 'conflict', codes: ['PLAN_STRUCTURE_MISMATCH'] }
  }

  let progress = chooseProgressSide(local, remote)
  if (progress.codes.length > 0 || !progress.side) return { status: 'conflict', codes: progress.codes }

  if (assignmentAuthorityFingerprint(local.state) !== assignmentAuthorityFingerprint(remote.state)) {
    const localStamp = local.metadata.authority.assignment
    const remoteStamp = remote.metadata.authority.assignment
    if (localStamp.revision === remoteStamp.revision) {
      return { status: 'conflict', codes: ['ASSIGNMENT_AUTHORITY_COLLISION'] }
    }
    const authoritySide: Side = localStamp.revision > remoteStamp.revision ? 'local' : 'remote'
    const authorityProgress = completedRefs(sideValue(authoritySide, local.state, remote.state))
    const otherProgress = completedRefs(sideValue(authoritySide === 'local' ? 'remote' : 'local', local.state, remote.state))
    if (!includesAll(authorityProgress, otherProgress)) {
      return { status: 'conflict', codes: ['ASSIGNMENT_AUTHORITY_COLLISION'] }
    }
    progress = { side: authoritySide, codes: [] }
  }

  if (calendarAuthorityFingerprint(local.state) !== calendarAuthorityFingerprint(remote.state)) {
    const localStamp = local.metadata.authority.calendar
    const remoteStamp = remote.metadata.authority.calendar
    if (localStamp.revision === remoteStamp.revision) {
      return { status: 'conflict', codes: ['CALENDAR_AUTHORITY_COLLISION'] }
    }
    const authoritySide: Side = localStamp.revision > remoteStamp.revision ? 'local' : 'remote'
    const authorityProgress = completedRefs(sideValue(authoritySide, local.state, remote.state))
    const otherProgress = completedRefs(sideValue(authoritySide === 'local' ? 'remote' : 'local', local.state, remote.state))
    if (!includesAll(authorityProgress, otherProgress)) {
      return { status: 'conflict', codes: ['CALENDAR_AUTHORITY_PROGRESS_CONFLICT'] }
    }
    progress = { side: authoritySide, codes: [] }
  }

  const requirements = chooseRevisionField({
    localValue: local.state.readiness,
    remoteValue: remote.state.readiness,
    localStamp: local.metadata.authority.requirements,
    remoteStamp: remote.metadata.authority.requirements,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'REQUIREMENTS_AUTHORITY_COLLISION',
  })
  const preferences = chooseRevisionField({
    localValue: local.state.preferences,
    remoteValue: remote.state.preferences,
    localStamp: local.metadata.authority.preferences,
    remoteStamp: remote.metadata.authority.preferences,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'PREFERENCE_REVISION_COLLISION',
  })
  const parentSettings = chooseRevisionField({
    localValue: local.state.parentSettings,
    remoteValue: remote.state.parentSettings,
    localStamp: local.metadata.authority.parentSettings,
    remoteStamp: remote.metadata.authority.parentSettings,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'PARENT_AUTHORITY_COLLISION',
  })
  const source = chooseSource(local, remote)
  const attestation = chooseAttestation(local, remote)
  const safety = mergeSafety(local, remote)
  const events = mergeEvents(local, remote)
  const queue = mergeQueues(local, remote)
  const scalarCode = requirements.code ?? preferences.code ?? parentSettings.code ?? source.code ??
    attestation.code ?? safety.code ?? events.code ?? queue.code
  if (scalarCode) return { status: 'conflict', codes: [scalarCode] }

  const assignmentAuthority = chooseRevisionField({
    localValue: local.state.assignment.state === 'abandoned' ? local.state.assignment : null,
    remoteValue: remote.state.assignment.state === 'abandoned' ? remote.state.assignment : null,
    localStamp: local.metadata.authority.assignment,
    remoteStamp: remote.metadata.authority.assignment,
    localReplica: local,
    remoteReplica: remote,
    collisionCode: 'ASSIGNMENT_AUTHORITY_COLLISION',
  })
  if (assignmentAuthority.code) return { status: 'conflict', codes: [assignmentAuthority.code] }

  const progressReplica = progress.side === 'local' ? local : remote
  const state: ReconciliableStudyState = Object.freeze({
    ...progressReplica.state,
    readiness: requirements.value!,
    events: events.events!,
    preferences: preferences.value!,
    parentSettings: parentSettings.value!,
    sourceAttachment: source.value!,
    attestation: attestation.value!,
    safetyHolds: safety.holds!,
  })
  const authority: StudyFieldAuthority = Object.freeze({
    assignment: assignmentAuthority.stamp!,
    calendar: progressReplica.metadata.authority.calendar,
    requirements: requirements.stamp!,
    preferences: preferences.stamp!,
    parentSettings: parentSettings.stamp!,
    sourceAttachment: source.stamp!,
    attestation: attestation.stamp!,
    safetyHolds: safety.authority!,
  })
  const mergedReplica: StudySyncReplica = {
    identity: local.identity,
    state,
    metadata: {
      serverRevision: Math.max(local.metadata.serverRevision, remote.metadata.serverRevision),
      baseServerRevision: Math.max(local.metadata.baseServerRevision, remote.metadata.baseServerRevision),
      localRevision: Math.max(local.metadata.localRevision, remote.metadata.localRevision),
      deviceId: local.metadata.deviceId,
      pendingOperations: queue.pending!,
      appliedOperationIds: queue.applied!,
      authority,
    },
  }
  const mergedInvalid = validationCodes(mergedReplica)
  if (mergedInvalid.length > 0) return { status: 'conflict', codes: mergedInvalid }
  return {
    status: 'compatible',
    merge: {
      state,
      authority,
      pendingOperations: queue.pending!,
      appliedOperationIds: queue.applied!,
    },
  }
}

export function classifyConflict(input: {
  readonly local: StudySyncReplica
  readonly remote: StudySyncReplica
}): ConflictClassification {
  const analysis = analyze(input.local, input.remote)
  const codes = analysis.status === 'compatible' ? [] : analysis.codes
  const details = diagnostic(input.local, input.remote, codes)
  if (analysis.status === 'compatible') return { status: 'COMPATIBLE', codes: [], diagnostic: details }
  if (analysis.status === 'identity') return { status: 'IDENTITY_MISMATCH', codes, diagnostic: details }
  return { status: 'CONFLICT', codes, diagnostic: details }
}

export function reconcileStudyState(input: ReconcileStudyStateInput): StudyReconciliationOutcome {
  // Identity refusal precedes revision retry so a foreign household/student can
  // never be treated as merely a stale copy worth refetching.
  const mismatches = identityCodes(input.local.identity, input.remote.identity)
  if (mismatches.length > 0) {
    const details = diagnostic(input.local, input.remote, mismatches)
    return {
      result: 'REFUSE_IDENTITY_MISMATCH',
      conflictCodes: details.codes,
      diagnostic: details,
      identity: input.local.identity,
      remoteServerRevision: input.remote.metadata.serverRevision,
    }
  }
  const revisionCodes: StudyConflictCode[] = []
  if (!isRevision(input.baseRevision) || input.baseRevision !== input.remote.metadata.serverRevision) {
    revisionCodes.push('REMOTE_REVISION_MOVED')
  } else if (input.remote.metadata.serverRevision < input.local.metadata.baseServerRevision) {
    revisionCodes.push('REMOTE_REVISION_BEHIND')
  }
  if (revisionCodes.length > 0) {
    const details = diagnostic(input.local, input.remote, revisionCodes)
    return {
      result: 'RETRY_WITH_REVISION',
      conflictCodes: details.codes,
      diagnostic: details,
      identity: input.local.identity,
      remoteServerRevision: input.remote.metadata.serverRevision,
    }
  }

  const analysis = analyze(input.local, input.remote)
  if (analysis.status !== 'compatible') {
    const details = diagnostic(input.local, input.remote, analysis.codes)
    return {
      result: analysis.status === 'identity' ? 'REFUSE_IDENTITY_MISMATCH' : 'MANUAL_OR_CONSERVATIVE_CONFLICT',
      conflictCodes: details.codes,
      diagnostic: details,
      identity: input.local.identity,
      remoteServerRevision: input.remote.metadata.serverRevision,
    }
  }

  const localEqual = same(
    { state: analysis.merge.state, authority: analysis.merge.authority },
    { state: input.local.state, authority: input.local.metadata.authority },
  )
  const remoteEqual = same(
    { state: analysis.merge.state, authority: analysis.merge.authority },
    { state: input.remote.state, authority: input.remote.metadata.authority },
  )
  const result = remoteEqual ? 'ACCEPT_REMOTE' : localEqual ? 'ACCEPT_LOCAL' : 'MERGED'
  const details = diagnostic(input.local, input.remote, [])
  return {
    result,
    state: analysis.merge.state,
    authority: analysis.merge.authority,
    pendingOperations: analysis.merge.pendingOperations,
    appliedOperationIds: analysis.merge.appliedOperationIds,
    localRevision: Math.max(input.local.metadata.localRevision, input.remote.metadata.localRevision),
    conflictCodes: [],
    diagnostic: details,
    identity: input.local.identity,
    remoteServerRevision: input.remote.metadata.serverRevision,
  }
}
