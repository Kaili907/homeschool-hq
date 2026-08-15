import { ACADEMY_SUBJECTS } from '../../../../types'
import { EVENT_ALLOWED_KEYS } from '../../../family-pilot/durable-ports/minimization'
import { parseHostedSyncStateSnapshotR2, type HostedSyncStateSnapshotR2 } from '../contracts'
import { HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES } from './contracts'

export const AUTHORITY_CHECKPOINT_PRIVACY_SCHEMA_R1 = 'hosted-study-sync-authority-checkpoint.r1' as const

/**
 * Deny-by-default key vocabulary for the exact R2 checkpoint. Path-specific
 * exactness is enforced again by the canonical parser and SQL validator.
 */
const ALLOWED_KEYS = new Set<string>([
  'contractVersion','identity','sync','student','studentProfile','appUpdatedAt','setupCompletedAt','assignments',
  'assessmentStates','rflStates','socialSources','safetyHolds','indexedDbDocument','privacy',
  'plannerDocument','instructionalInputs',
  'householdRef','studentRef','learnerRef','serverRevision','baseRevision','operationId','idempotencyKey',
  'operationKind','deviceRef','localSequence','createdAt','displayName','updatedAt','activeAssignmentRef',
  'nominalGrade','workingGradeBySubject','enabledSubjects','record','authorityRevision','sessionIdentity','completion',
  'assignmentRef','lessonRef','blockRef','sessionRef','lineageRootRef','continuationKey','kind','completedAt',
  'assessmentRef','courseRef','subject','grade','title','authorityClass','status','evidenceRefs','outcome',
  'assessmentRecordRef','decision','assessedAt','assessorRef','learnerAssertionState','learnerAssertedAt',
  'guardianState','certifiedAt','attesterRef','evidenceMode','readiness','sourceRef','publisher','publishedAt',
  'attachedAt','sourceRevision','holdRef','reasonCode','category','source','dedupeKey','acknowledgedAt','clearedAt',
  'clearAuthority','clearerRef','logicalRevision','schemaVersion','scope','preferences','parentSettings','calendar',
  'sessions','checkpoints','reviews','events','outbox','accessibility','timerPreference','largeText','reducedMotion',
  'noAudio','captions','transientTranscript','highContrast','oneTaskAtATime','visibility','milestonesOnly',
  'maximumWorkMinutes','breakMinutes','timerHidden','accommodations','recommendationDecisions','interruptions',
  'reschedules','adultReviewRequests','revision','accommodationRef','functionalDescription','studentMessage',
  'recommendationRef','reason','at','replacementStart','requestRef','audience','plan','skillRefs','segments',
  'masteryAuthority','block','internalBlockId','sourceIdentity','lineage','blockType','canonicalTask','householdTimeZone',
  'scheduledLocalStart','scheduledStartInstant','intendedLocalDate','placementSource','estimatedDurationMinutes',
  'actualDurationSeconds','timerVisibility','state','activeSince','resumePoint','currentInterruption',
  'interruptionHistory','lastEventAt','externalItemId','rootInternalBlockId','continuationOf','completedBeforeOccurrence',
  'taskType','customTaskTypeId','segmentRef','estimatedMinutes','required','segmentId','planOrdinal','canonicalTaskType',
  'actualActiveSeconds','elapsedActiveSecondsBeforeBlock','segmentOrdinal','elapsedActiveSecondsInSegment',
  'responseDraftRef','completedSegmentIds','remainingSegmentIds','capturedAt','approvalState','interruptedAt','actor',
  'type','segmentId','fromLocalStart','toLocalStart','fromStartInstant','toStartInstant','fromIntendedLocalDate',
  'toIntendedLocalDate','changedFields','continuationBlockId','lastAcceptedEventRef','rawAnswerIncluded',
  'transcriptIncluded','checkpointRef','completedSegmentRefs','sourceEvidenceRef','dueDate','reasonCodes','sessionRef',
  'eventRef','semanticKey','event','occurredAt','payload','proposalRef','route','pinIncluded','bearerIncluded',
  'rawLearnerResponseIncluded','rawTutorConversationIncluded','rawAudioIncluded','inferenceIncluded',
  'adultAnswerAuthorityIncluded','answerMaterialIncluded','pausedAt','resumedAt','pausedSeconds','resumeSegmentRef',
  'instructionalInputIncluded','input','choiceRef','text','attemptRef','sectionRef','itemRef','assessmentState','savedAt',
  'trustedReceipt','schoolPlan','materializations','nonSchoolDates','addedSchoolDates','schoolYearStart','schoolYearEnd',
  'schoolWeekdays','subjects','configuredAt','order','paused','courseRef','lessonsPerDay','startLocalTime',
  'materializationRef','localDate','workingGrade','unitRef',
  'totalSegments','lastSegmentRef','activeSeconds','activeSecondsByDate','date','progress','pause',
  'instructionalSession','activeSince','inactiveAt','endedAt',
  // Exact legacy R2 RPC import/write vocabulary. These fields remain only so
  // the lossless authority checkpoint can travel through the already-installed
  // four-RPC surface; the canonical checkpoint parser still supplies the
  // path-specific contract for authorityCheckpoint.
  'localScope','hostedScope','session','checkpoint','socialSource','guardianAttestation','safetyState','assessment','authorityCheckpoint',
  'lessonRef','subjectRef','startedAt','intendedLocalDate','contract','checkpointId','lessonId',
  'sessionId',
  'safeInstructionalCursor','tutorPhase','cycleNumber','currentItemId','currentItemIndex','teachingTurnIndex',
  'perSegmentActiveTime','pausedSeconds','breakSeconds','protectedDraftRef','protectedTutorStateRef',
  'lastAcceptedEventId','eventVersion','tutorInteractionRef','technicalInterruption','interruptionId','holds',
  'studentRef','source','attestation','hold','clearedByRef','completedAt','createdAt','title','status','authority',
  'attestedAt','attestedByRef',
  'metadata','adultAttestedAt','attachmentId','unitRef','issueStatement','sourceIdentifier','sourceTitle',
  'responsibleParty','sourceDate','sourceVersionOrEdition','retrievalLocation','retrievedOn','retrievedByRole',
  'retrievalStatus','mediaType','language','sourceKind','authorityTier','authorityVerified','primaryOrSecondary',
  'primaryOrSecondaryReason','interestDisclosure','relevanceToIssue','limitsNoted','rightsCategory','rightsStatement',
  'publicAccess','selectedByRole','selectedOn','readInFull','contentSafetyReviewedByRole','readingLevelReviewedByRole',
  'previewedForSafetyAndLevel','containsLearnerPersonalData','containsOtherMinorPersonalData','quotedTextStored',
  'contentDigestSha256','participantRole','consentRecorded',
  ...ACADEMY_SUBJECTS,
  ...Object.values(EVENT_ALLOWED_KEYS).flat(),
])

const FORBIDDEN = new Set([
  'pin','pindigest','pinverifier','bearer','accesstoken','refreshtoken','authorizationheader',
  'rawlearnerresponse','responsebody','rawtutorconversation','tutorconversation','rawaudio','audioblob',
  'personalityinference','emotionalinference','diagnosticinference','adultanswerauthority','answerkey',
  'correctanswer','expectedanswer','scoringguide','workedsolution','providercredentials','apikey',
])
const SECRET = /(?:\bbearer\s+[A-Za-z0-9._~-]+|\b(?:access|refresh|service[-_ ]?role|api)[-_ ]?(?:token|key)\b|\bsk-[A-Za-z0-9_-]{12,}\b)/i

function normalized(key: string): string { return key.replace(/[^a-z0-9]/gi, '').toLowerCase() }

/** Mandatory deny-by-default scan used immediately before every mutation RPC. */
export function assertHostedSyncPrivacyAllowlistR1(value: unknown, path = '$', seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (SECRET.test(value)) throw new Error(`SENSITIVE_VALUE:${path}`)
    return
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (typeof value !== 'object' || seen.has(value)) throw new Error(`INVALID_TYPE:${path}`)
  seen.add(value)
  if (Array.isArray(value)) value.forEach((item, index) => assertHostedSyncPrivacyAllowlistR1(item, `${path}[${index}]`, seen))
  else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error(`INVALID_TYPE:${path}`)
    }
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN.has(normalized(key))) throw new Error(`FORBIDDEN_FIELD:${path}.${key}`)
      if (!ALLOWED_KEYS.has(key)) throw new Error(`UNALLOWLISTED_FIELD:${path}.${key}`)
      assertHostedSyncPrivacyAllowlistR1(item, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

declare const serializedBrand: unique symbol
export interface SerializedAuthorityCheckpointR1 {
  readonly schemaId: typeof AUTHORITY_CHECKPOINT_PRIVACY_SCHEMA_R1
  readonly byteLength: number
  readonly [serializedBrand]: never
}
const SEALED = new WeakMap<object, string>()

export function serializeAuthorityCheckpointPrivacyGateR1(value: unknown): SerializedAuthorityCheckpointR1 {
  assertHostedSyncPrivacyAllowlistR1(value)
  const parsed = parseHostedSyncStateSnapshotR2(value)
  if (parsed.status !== 'ready') throw new Error(`MALFORMED_STATE:${parsed.reason}`)
  const body = JSON.stringify(parsed.snapshot)
  const byteLength = new TextEncoder().encode(body).byteLength
  if (byteLength > HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES) throw new Error('LIMIT_EXCEEDED:$')
  const sealed = Object.freeze({ schemaId: AUTHORITY_CHECKPOINT_PRIVACY_SCHEMA_R1, byteLength }) as SerializedAuthorityCheckpointR1
  SEALED.set(sealed, body)
  return sealed
}

export interface AuthorityCheckpointNetworkPortR1<T> {
  send(request: Readonly<{ schemaId: typeof AUTHORITY_CHECKPOINT_PRIVACY_SCHEMA_R1; body: string }>): Promise<T>
}

/** Unwired test seam; production activation remains mechanically closed. */
export class AuthorityCheckpointPreNetworkGateR1<T> {
  constructor(private readonly network: AuthorityCheckpointNetworkPortR1<T>) {}
  send(payload: SerializedAuthorityCheckpointR1): Promise<T> {
    const body = payload && typeof payload === 'object' ? SEALED.get(payload) : undefined
    if (body === undefined) throw new Error('UNSERIALIZED_PAYLOAD:$')
    return this.network.send(Object.freeze({ schemaId: AUTHORITY_CHECKPOINT_PRIVACY_SCHEMA_R1, body }))
  }
}
