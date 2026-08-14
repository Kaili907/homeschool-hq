import { ACADEMY_GRADES, ACADEMY_SUBJECTS } from '../../../../types'
import { parseFamilyPilotStudent } from '../../../family-pilot/core/schema'
import { parseDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import { validateDynamicSocialSourceBundle } from '../../../family-pilot/final-app/dynamicSource'
import {
  HOSTED_SYNC_STATE_CONTRACT_VERSION,
  HOSTED_SYNC_STATE_OPERATION_KINDS,
  type HostedSyncAssignmentStateR2,
  type HostedSyncAssessmentStateR2,
  type HostedSyncCompletionStateR2,
  type HostedSyncRflStateR2,
  type HostedSyncSafetyHoldR2,
  type HostedSyncSocialSourceStateR2,
  type HostedSyncStateIdentityR2,
  type HostedSyncStateParseFailureR2,
  type HostedSyncStateParseResultR2,
  type HostedSyncStateSnapshotR2,
  type HostedSyncStudentProfileR2,
} from './types'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GRADES = new Set(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])

const TOP_KEYS = [
  'contractVersion', 'identity', 'sync', 'student', 'studentProfile', 'appUpdatedAt',
  'setupCompletedAt', 'assignments', 'assessmentStates', 'rflStates', 'socialSources',
  'safetyHolds', 'indexedDbDocument', 'privacy',
] as const

const FORBIDDEN_PRIVATE_KEYS = new Set([
  'pin', 'pindigest', 'pindigests', 'bearer', 'accesstoken', 'refreshtoken',
  'authorizationheader', 'rawlearnerresponse', 'rawresponse', 'responsebody',
  'rawtutorconversation', 'tutorconversation', 'rawaudio', 'audioblob',
  'personalityinference', 'emotionalinference', 'diagnosticinference',
  'adultanswerauthority', 'answerkey', 'correctanswer', 'expectedanswer',
  'scoringguide', 'rubricdimensions', 'workedsolution',
])

const DANGEROUS_AUTHORITY_KEYS = new Set([
  'role', 'roles', 'permissions', 'claims', 'isadmin', 'adultauthorized',
  'guardianauthorized', 'studentid', 'householdid',
])

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function scanForbidden(value: unknown): HostedSyncStateParseFailureR2 | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = scanForbidden(child)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key)
    if (FORBIDDEN_PRIVATE_KEYS.has(normalized)) return 'PRIVACY_VIOLATION'
    if (DANGEROUS_AUTHORITY_KEYS.has(normalized)) return 'DANGEROUS_AUTHORITY_FIELD'
    const privateMarker = /^(rawanswerincluded|transcriptincluded|audioincluded)$/.test(normalized)
    if (privateMarker && child !== false) return 'PRIVACY_VIOLATION'
    const found = scanForbidden(child)
    if (found) return found
  }
  return null
}

function hasMalformedRevision(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMalformedRevision)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, child]) =>
    (normalizedKey(key).endsWith('revision') && !isRevision(child)) || hasMalformedRevision(child))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const held = Object.keys(value)
  return held.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isNullableInstant(value: unknown): value is string | null {
  return value === null || isInstant(value)
}

function isNullableRef(value: unknown): value is string | null {
  return value === null || isRef(value)
}

function refs(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= 2_000 && value.every(isRef) && new Set(value).size === value.length
}

function parseIdentity(value: unknown): HostedSyncStateIdentityR2 | null {
  if (!isRecord(value) || !exactKeys(value, ['householdRef', 'studentRef', 'learnerRef'])) return null
  if (!isRef(value.householdRef) || !isRef(value.studentRef) || !isRef(value.learnerRef)) return null
  return Object.freeze({ householdRef: value.householdRef, studentRef: value.studentRef, learnerRef: value.learnerRef })
}

function sameIdentity(a: HostedSyncStateIdentityR2, b: HostedSyncStateIdentityR2): boolean {
  return a.householdRef === b.householdRef && a.studentRef === b.studentRef && a.learnerRef === b.learnerRef
}

function parseProfile(value: unknown, studentRef: string): HostedSyncStudentProfileR2 | null {
  if (!isRecord(value) || !exactKeys(value, [
    'studentRef', 'displayName', 'nominalGrade', 'workingGradeBySubject', 'enabledSubjects', 'createdAt', 'updatedAt',
  ])) return null
  if (value.studentRef !== studentRef || typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.length > 160) return null
  if (!GRADES.has(String(value.nominalGrade)) || !isRecord(value.workingGradeBySubject) || !Array.isArray(value.enabledSubjects)) return null
  if (!value.enabledSubjects.length || !value.enabledSubjects.every((subject) => ACADEMY_SUBJECTS.includes(subject as never))) return null
  if (new Set(value.enabledSubjects).size !== value.enabledSubjects.length) return null
  for (const [subject, grade] of Object.entries(value.workingGradeBySubject)) {
    if (!ACADEMY_SUBJECTS.includes(subject as never) || !ACADEMY_GRADES.includes(String(grade) as never)) return null
    if (!value.enabledSubjects.includes(subject)) return null
  }
  if (!isInstant(value.createdAt) || !isInstant(value.updatedAt)) return null
  return value as unknown as HostedSyncStudentProfileR2
}

function parseCompletion(value: unknown): HostedSyncCompletionStateR2 | null {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'completedAt'])) return null
  if (value.kind === 'INCOMPLETE' || value.kind === 'RFL_PENDING_GUARDIAN') {
    return value.completedAt === null ? value as unknown as HostedSyncCompletionStateR2 : null
  }
  if (value.kind === 'NORMAL_CERTIFIED' || value.kind === 'RFL_CERTIFIED') {
    return isInstant(value.completedAt) ? value as unknown as HostedSyncCompletionStateR2 : null
  }
  return null
}

function parseAssignment(value: unknown, studentRef: string): HostedSyncAssignmentStateR2 | null {
  if (!isRecord(value) || !exactKeys(value, ['record', 'authorityRevision', 'sessionIdentity', 'completion'])) return null
  const record = parseFamilyPilotStudent({
    studentRef,
    displayName: 'Sync parser',
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    activeAssignmentRef: null,
    assignments: [value.record],
  })?.assignments[0]
  if (!record || !isRevision(value.authorityRevision)) return null
  const completion = parseCompletion(value.completion)
  if (!completion) return null
  let sessionIdentity = null
  if (value.sessionIdentity !== null) {
    if (!isRecord(value.sessionIdentity) || !exactKeys(value.sessionIdentity, [
      'assignmentRef', 'lessonRef', 'blockRef', 'sessionRef', 'lineageRootRef', 'continuationKey',
    ])) return null
    if (value.sessionIdentity.assignmentRef !== record.assignmentRef || value.sessionIdentity.lessonRef !== record.lessonRef ||
      !isRef(value.sessionIdentity.blockRef) || !isRef(value.sessionIdentity.sessionRef) ||
      !isRef(value.sessionIdentity.lineageRootRef) || !isRef(value.sessionIdentity.continuationKey)) return null
    sessionIdentity = value.sessionIdentity
  }
  if (completion.kind === 'NORMAL_CERTIFIED' && (record.state !== 'completed' || record.completedAt !== completion.completedAt)) return null
  if (completion.kind === 'RFL_CERTIFIED' && record.state !== 'completed') return null
  return Object.freeze({ record, authorityRevision: value.authorityRevision, sessionIdentity, completion }) as HostedSyncAssignmentStateR2
}

function parseAssessment(value: unknown, studentRef: string): HostedSyncAssessmentStateR2 | null {
  const keys = [
    'assignmentRef', 'assessmentRef', 'studentRef', 'courseRef', 'subject', 'grade', 'title', 'authorityClass',
    'status', 'createdAt', 'updatedAt', 'completedAt', 'evidenceRefs', 'outcome', 'authorityRevision',
  ]
  if (!isRecord(value) || !exactKeys(value, keys) || value.studentRef !== studentRef) return null
  if (!isRef(value.assignmentRef) || !isRef(value.assessmentRef) || !isRef(value.courseRef) ||
    !ACADEMY_SUBJECTS.includes(value.subject as never) || !Number.isInteger(value.grade) ||
    typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160) return null
  if (!['AUTO_SCOREABLE', 'RUBRIC_REQUIRED', 'GUARDIAN_REQUIRED', 'COMPLETION_ONLY'].includes(String(value.authorityClass)) ||
    !['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'SCORING_COMPLETE', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'].includes(String(value.status)) ||
    !isInstant(value.createdAt) || !isInstant(value.updatedAt) || !isNullableInstant(value.completedAt) ||
    !refs(value.evidenceRefs) || !isRevision(value.authorityRevision)) return null
  if (value.outcome !== null) {
    if (!isRecord(value.outcome) || !exactKeys(value.outcome, ['assessmentRecordRef', 'decision', 'assessedAt', 'assessorRef']) ||
      !isRef(value.outcome.assessmentRecordRef) || !isRef(value.outcome.assessorRef) || !isInstant(value.outcome.assessedAt) ||
      !['CORRECT', 'INCORRECT', 'PARTIAL', 'REVIEW_REQUIRED', 'COMPLETED'].includes(String(value.outcome.decision))) return null
  }
  return value as unknown as HostedSyncAssessmentStateR2
}

function parseRfl(value: unknown, studentRef: string): HostedSyncRflStateR2 | null {
  const keys = ['studentRef', 'assignmentRef', 'lessonRef', 'sessionRef', 'learnerAssertionState', 'learnerAssertedAt', 'guardianState', 'certifiedAt', 'attesterRef', 'evidenceMode', 'authorityRevision']
  if (!isRecord(value) || !exactKeys(value, keys) || value.studentRef !== studentRef) return null
  if (!isRef(value.assignmentRef) || !isRef(value.lessonRef) || !isRef(value.sessionRef) || value.learnerAssertionState !== 'ASSERTED' ||
    !isInstant(value.learnerAssertedAt) || !['PENDING', 'CERTIFIED'].includes(String(value.guardianState)) ||
    !isNullableInstant(value.certifiedAt) || !isNullableRef(value.attesterRef) ||
    !(value.evidenceMode === null || ['adult-observed', 'simulated-alternative'].includes(String(value.evidenceMode))) ||
    !isRevision(value.authorityRevision)) return null
  if (value.guardianState === 'PENDING' && (value.certifiedAt !== null || value.attesterRef !== null || value.evidenceMode !== null)) return null
  if (value.guardianState === 'CERTIFIED' && (value.certifiedAt === null || value.attesterRef === null || value.evidenceMode === null)) return null
  return value as unknown as HostedSyncRflStateR2
}

function parseSocial(value: unknown, studentRef: string): HostedSyncSocialSourceStateR2 | null {
  const keys = ['studentRef', 'assignmentRef', 'lessonRef', 'readiness', 'sourceRef', 'kind', 'title', 'publisher', 'publishedAt', 'metadata', 'adultAttestedAt', 'attachedAt', 'sourceRevision']
  if (!isRecord(value) || !exactKeys(value, keys) || value.studentRef !== studentRef) return null
  if (!isRef(value.assignmentRef) || !isRef(value.lessonRef) || !isRef(value.sourceRef) || value.readiness !== 'ATTACHED_SATISFIED' ||
    !['article', 'primary-source', 'reference', 'unspecified'].includes(String(value.kind)) ||
    typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160 ||
    typeof value.publisher !== 'string' || !value.publisher.trim() || value.publisher.length > 160 ||
    !isInstant(value.publishedAt) || !Array.isArray(value.metadata) || !isInstant(value.adultAttestedAt) ||
    !isInstant(value.attachedAt) || !isRevision(value.sourceRevision)) return null
  try {
    validateDynamicSocialSourceBundle({ lessonRef: value.lessonRef, sources: value.metadata, adultAttested: true })
  } catch { return null }
  return value as unknown as HostedSyncSocialSourceStateR2
}

function parseSafety(value: unknown, studentRef: string): HostedSyncSafetyHoldR2 | null {
  const keys = ['holdRef', 'studentRef', 'sessionRef', 'reasonCode', 'category', 'source', 'dedupeKey', 'createdAt', 'status', 'acknowledgedAt', 'clearedAt', 'clearAuthority', 'clearerRef', 'logicalRevision']
  if (!isRecord(value) || !exactKeys(value, keys) || value.studentRef !== studentRef) return null
  if (!isRef(value.holdRef) || !isRef(value.sessionRef) || typeof value.reasonCode !== 'string' || !value.reasonCode ||
    !['URGENT', 'UNCERTAIN', 'CONCERNING_CONTENT', 'ADULT_REVIEW'].includes(String(value.category)) ||
    !['study-safety', 'tutor-core', 'parent'].includes(String(value.source)) || typeof value.dedupeKey !== 'string' || !value.dedupeKey ||
    !isInstant(value.createdAt) || !['OPEN', 'ACKNOWLEDGED', 'CLEARED'].includes(String(value.status)) ||
    !isNullableInstant(value.acknowledgedAt) || !isNullableInstant(value.clearedAt) || !isNullableRef(value.clearerRef) ||
    !isRevision(value.logicalRevision)) return null
  if (value.status === 'CLEARED') {
    if (value.clearedAt === null || value.clearAuthority !== 'GUARDIAN' || value.clearerRef === null) return null
  } else if (value.clearedAt !== null || value.clearAuthority !== null || value.clearerRef !== null) return null
  return value as unknown as HostedSyncSafetyHoldR2
}

function refused(reason: HostedSyncStateParseFailureR2): HostedSyncStateParseResultR2 {
  return Object.freeze({ status: 'refused', reason })
}

export function parseHostedSyncStateSnapshotR2(
  value: unknown,
  expectedIdentity?: HostedSyncStateIdentityR2,
): HostedSyncStateParseResultR2 {
  if (!isRecord(value)) return refused('MALFORMED_STATE')
  if (value.contractVersion !== HOSTED_SYNC_STATE_CONTRACT_VERSION) return refused('UNKNOWN_VERSION')
  const forbidden = scanForbidden(value)
  if (forbidden) return refused(forbidden)
  if (hasMalformedRevision(value)) return refused('MALFORMED_REVISION')
  if (!exactKeys(value, TOP_KEYS)) return refused('MALFORMED_STATE')
  const identity = parseIdentity(value.identity)
  if (!identity) return refused('MALFORMED_STATE')
  if (expectedIdentity && !sameIdentity(identity, expectedIdentity)) return refused('IDENTITY_MISMATCH')

  if (!isRecord(value.sync) || !exactKeys(value.sync, [
    'serverRevision', 'baseRevision', 'operationId', 'idempotencyKey', 'operationKind', 'deviceRef', 'localSequence', 'createdAt',
  ])) return refused('MALFORMED_STATE')
  if (!isRevision(value.sync.serverRevision) || !isRevision(value.sync.baseRevision) || value.sync.baseRevision > value.sync.serverRevision ||
    !isRevision(value.sync.localSequence)) return refused('MALFORMED_REVISION')
  if (!UUID.test(String(value.sync.operationId)) || !UUID.test(String(value.sync.idempotencyKey)) ||
    value.sync.operationId !== value.sync.idempotencyKey || !isRef(value.sync.deviceRef) || !isInstant(value.sync.createdAt) ||
    !HOSTED_SYNC_STATE_OPERATION_KINDS.includes(value.sync.operationKind as never)) return refused('MALFORMED_STATE')

  const student = parseFamilyPilotStudent(value.student)
  const profile = parseProfile(value.studentProfile, identity.studentRef)
  if (!student || !profile || student.studentRef !== identity.studentRef) return refused('CROSS_STUDENT_STATE')
  if (!isRecord(value.student) || !Array.isArray(value.student.assignments) ||
    value.student.assignments.length !== student.assignments.length || student.displayName !== profile.displayName) {
    return refused('INCONSISTENT_STATE')
  }
  if (!isInstant(value.appUpdatedAt) || !isNullableInstant(value.setupCompletedAt)) return refused('MALFORMED_STATE')

  if (!Array.isArray(value.assignments) || !Array.isArray(value.assessmentStates) || !Array.isArray(value.rflStates) ||
    !Array.isArray(value.socialSources) || !Array.isArray(value.safetyHolds)) return refused('MALFORMED_STATE')
  const assignments = value.assignments.map((item) => parseAssignment(item, identity.studentRef))
  const assessments = value.assessmentStates.map((item) => parseAssessment(item, identity.studentRef))
  const rfl = value.rflStates.map((item) => parseRfl(item, identity.studentRef))
  const sources = value.socialSources.map((item) => parseSocial(item, identity.studentRef))
  const safety = value.safetyHolds.map((item) => parseSafety(item, identity.studentRef))
  if ([...assignments, ...assessments, ...rfl, ...sources, ...safety].some((item) => item === null)) {
    return refused('CROSS_STUDENT_STATE')
  }
  const parsedAssignments = assignments as HostedSyncAssignmentStateR2[]
  if (new Set(parsedAssignments.map((item) => item.record.assignmentRef)).size !== parsedAssignments.length ||
    parsedAssignments.length !== student.assignments.length ||
    parsedAssignments.some((item) => !student.assignments.some((record) => JSON.stringify(record) === JSON.stringify(item.record)))) {
    return refused('INCONSISTENT_STATE')
  }
  const unique = <T>(items: readonly T[], ref: (item: T) => string): boolean =>
    new Set(items.map(ref)).size === items.length
  if (!unique(assessments as HostedSyncAssessmentStateR2[], (item) => item.assignmentRef) ||
    !unique(rfl as HostedSyncRflStateR2[], (item) => item.assignmentRef) ||
    !unique(sources as HostedSyncSocialSourceStateR2[], (item) => item.sourceRef) ||
    !unique(safety as HostedSyncSafetyHoldR2[], (item) => item.holdRef)) return refused('INCONSISTENT_STATE')

  const durable = parseDurableStudyDocument(value.indexedDbDocument, {
    householdRef: identity.householdRef,
    learnerRef: identity.learnerRef,
  })
  if (durable.status !== 'current') return refused('INCONSISTENT_STATE')
  const sessionRefs = new Set(durable.document.sessions.map((session) => session.scope.sessionRef))
  for (const assignment of parsedAssignments) {
    const held = assignment.sessionIdentity
    if (!held) continue
    const calendar = durable.document.calendar.find((item) => item.block.internalBlockId === held.blockRef)
    const session = durable.document.sessions.find((item) => item.scope.sessionRef === held.sessionRef)
    if (!calendar || !session || calendar.plan.lessonRef !== held.lessonRef || session.lessonRef !== held.lessonRef ||
      calendar.block.lineage.rootInternalBlockId !== held.lineageRootRef || calendar.block.lineage.continuationKey !== held.continuationKey) {
      return refused('INCONSISTENT_STATE')
    }
    if (assignment.completion.kind !== 'INCOMPLETE' && session.status !== 'completed') return refused('INCONSISTENT_STATE')
  }
  if ((rfl as HostedSyncRflStateR2[]).some((item) => !sessionRefs.has(item.sessionRef) ||
      !parsedAssignments.some((assignment) => assignment.record.assignmentRef === item.assignmentRef &&
        assignment.record.lessonRef === item.lessonRef && assignment.sessionIdentity?.sessionRef === item.sessionRef &&
        assignment.completion.kind === (item.guardianState === 'CERTIFIED' ? 'RFL_CERTIFIED' : 'RFL_PENDING_GUARDIAN'))) ||
    (sources as HostedSyncSocialSourceStateR2[]).some((item) => !parsedAssignments.some((assignment) =>
      assignment.record.assignmentRef === item.assignmentRef && assignment.record.lessonRef === item.lessonRef)) ||
    (safety as HostedSyncSafetyHoldR2[]).some((item) => !sessionRefs.has(item.sessionRef))) return refused('INCONSISTENT_STATE')

  if (!isRecord(value.privacy) || !exactKeys(value.privacy, [
    'pinIncluded', 'bearerIncluded', 'rawLearnerResponseIncluded', 'rawTutorConversationIncluded',
    'rawAudioIncluded', 'inferenceIncluded', 'adultAnswerAuthorityIncluded', 'answerMaterialIncluded',
  ]) || Object.values(value.privacy).some((marker) => marker !== false)) return refused('PRIVACY_VIOLATION')

  const snapshot = Object.freeze({
    ...value,
    identity,
    student,
    studentProfile: profile,
    assignments: Object.freeze(parsedAssignments),
    assessmentStates: Object.freeze(assessments as HostedSyncAssessmentStateR2[]),
    rflStates: Object.freeze(rfl as HostedSyncRflStateR2[]),
    socialSources: Object.freeze(sources as HostedSyncSocialSourceStateR2[]),
    safetyHolds: Object.freeze(safety as HostedSyncSafetyHoldR2[]),
    indexedDbDocument: durable.document,
  }) as unknown as HostedSyncStateSnapshotR2
  return Object.freeze({ status: 'ready', snapshot })
}

export function serializeHostedSyncStateSnapshotR2(snapshot: HostedSyncStateSnapshotR2): string {
  const parsed = parseHostedSyncStateSnapshotR2(snapshot, snapshot.identity)
  if (parsed.status !== 'ready') throw new Error(`Hosted sync state refused: ${parsed.reason}`)
  return JSON.stringify(parsed.snapshot)
}
