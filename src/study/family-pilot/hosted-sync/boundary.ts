import {
  ACADEMY_GRADES,
  ACADEMY_SUBJECTS,
  type AcademyGrade,
  type AcademySubject,
  type Grade,
} from '../../../types'

/**
 * Production privacy boundary for the future Family Pilot hosted-sync client.
 *
 * Local AppState, Profile, FinalFamilyPilotAppStateV1, backup, and durable Study
 * documents are deliberately not DTOs. A caller must construct this exact,
 * versioned projection; unknown data is refused rather than stripped.
 */
export const HOSTED_STUDY_SYNC_SCHEMA_VERSION = 1 as const
export const HOSTED_STUDY_SYNC_SCHEMA_ID = 'hosted-study-sync.v1' as const
export const HOSTED_STUDY_SYNC_RELEASE_REF = 'family-pilot-r1' as const

export const HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1 = Object.freeze([
  'schemaVersion',
  'releaseRef',
  'updatedAt',
  'learners',
  'learners[].learnerRef',
  'learners[].displayName',
  'learners[].nominalGrade',
  'learners[].workingGradeBySubject',
  'learners[].workingGradeBySubject.{subject}',
  'learners[].enabledSubjects',
  'learners[].enabledSubjects[]',
  'learners[].assignments',
  'learners[].assignments[].assignmentRef',
  'learners[].assignments[].lessonRef',
  'learners[].assignments[].subject',
  'learners[].assignments[].title',
  'learners[].assignments[].state',
  'learners[].assignments[].updatedAt',
  'learners[].assignments[].completedAt',
  'learners[].assignments[].progress',
  'learners[].assignments[].progress.completedSegmentRefs',
  'learners[].assignments[].progress.completedSegmentRefs[]',
  'learners[].assignments[].progress.totalSegments',
  'learners[].assignments[].progress.lastSegmentRef',
  'learners[].assessmentAssignments',
  'learners[].assessmentAssignments[].assignmentRef',
  'learners[].assessmentAssignments[].assessmentRef',
  'learners[].assessmentAssignments[].courseRef',
  'learners[].assessmentAssignments[].subject',
  'learners[].assessmentAssignments[].grade',
  'learners[].assessmentAssignments[].title',
  'learners[].assessmentAssignments[].authorityClass',
  'learners[].assessmentAssignments[].status',
  'learners[].assessmentAssignments[].updatedAt',
  'learners[].assessmentAssignments[].completedAt',
  'learners[].sourceAttachments',
  'learners[].sourceAttachments[].assignmentRef',
  'learners[].sourceAttachments[].lessonRef',
  'learners[].sourceAttachments[].sourceRef',
  'learners[].sourceAttachments[].attachedAt',
  'learners[].sourceAttachments[].status',
  'learners[].completionAttestations',
  'learners[].completionAttestations[].assignmentRef',
  'learners[].completionAttestations[].lessonRef',
  'learners[].completionAttestations[].sessionRef',
  'learners[].completionAttestations[].authority',
  'learners[].completionAttestations[].status',
  'learners[].completionAttestations[].learnerAssertedAt',
  'learners[].completionAttestations[].attestedAt',
  'learners[].completionAttestations[].attestedByRef',
  'learners[].completionAttestations[].evidenceMode',
  'learners[].entryBlocks',
  'learners[].entryBlocks[].blockRef',
  'learners[].entryBlocks[].sessionRef',
  'learners[].entryBlocks[].status',
  'learners[].entryBlocks[].createdAt',
  'learners[].entryBlocks[].clearedAt',
  'learners[].entryBlocks[].clearedByRef',
] as const)

export const FORBIDDEN_SYNC_FIELD_FAMILIES_V1 = Object.freeze([
  'raw PIN / PIN plaintext / PIN digest or verifier',
  'bearer, token, authorization header, session grant, or launch grant',
  'raw learner answer, response body, or response draft',
  'Tutor/assistant transcript, chat, prompt, message, or provider output',
  'audio, voice recording, blob, or media capture',
  'answer index, correct answer, expected answer, answer key, scoring guide, or scoring locator',
  'adult rubric, answer authority, or scoring authority',
  'adult/private note body',
  'emotional, sentiment, personality, trait, or diagnostic label/inference',
  'service credential, service-role credential, provider secret, or API key',
  'safety reason/source labels (only label-free enforcement state is allowed)',
] as const)

export type HostedSyncBoundaryErrorCode =
  | 'FORBIDDEN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'LIMIT_EXCEEDED'
  | 'MISSING_FIELD'
  | 'RELEASE_MISMATCH'
  | 'SCHEMA_VERSION'
  | 'SENSITIVE_VALUE'
  | 'UNALLOWLISTED_FIELD'
  | 'UNSERIALIZED_PAYLOAD'

export class HostedSyncBoundaryError extends Error {
  constructor(
    readonly code: HostedSyncBoundaryErrorCode,
    readonly path: string,
    message: string,
  ) {
    super(`${message} (${path})`)
    this.name = 'HostedSyncBoundaryError'
  }
}

type AssignmentState = 'planned' | 'active' | 'paused' | 'completed' | 'abandoned'
type AssessmentAuthority = 'AUTO_SCOREABLE' | 'RUBRIC_REQUIRED' | 'GUARDIAN_REQUIRED' | 'COMPLETION_ONLY'
type AssessmentStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PENDING_ASSESSMENT'
  | 'ADULT_REVIEW_REQUIRED'
  | 'PENDING_GUARDIAN_ATTESTATION'
  | 'CERTIFIED'

export interface HostedStudySyncProgressV1 {
  readonly completedSegmentRefs: readonly string[]
  readonly totalSegments: number
  readonly lastSegmentRef: string | null
}

export interface HostedStudySyncAssignmentV1 {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly subject: AcademySubject
  readonly title: string
  readonly state: AssignmentState
  readonly updatedAt: string
  readonly completedAt: string | null
  readonly progress: HostedStudySyncProgressV1
}

export interface HostedStudySyncAssessmentAssignmentV1 {
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly courseRef: string
  readonly subject: AcademySubject
  readonly grade: number
  readonly title: string
  readonly authorityClass: AssessmentAuthority
  readonly status: AssessmentStatus
  readonly updatedAt: string
  readonly completedAt: string | null
}

export interface HostedStudySyncSourceAttachmentV1 {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sourceRef: string
  readonly attachedAt: string
  readonly status: 'ATTACHED_SATISFIED'
}

export interface HostedStudySyncCompletionAttestationV1 {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sessionRef: string
  readonly authority: 'GUARDIAN_ATTESTATION_REQUIRED'
  readonly status: 'PENDING_GUARDIAN_ATTESTATION' | 'CERTIFIED'
  readonly learnerAssertedAt: string
  readonly attestedAt: string | null
  readonly attestedByRef: string | null
  readonly evidenceMode: 'adult-observed' | 'simulated-alternative' | null
}

export interface HostedStudySyncEntryBlockV1 {
  readonly blockRef: string
  readonly sessionRef: string
  readonly status: 'open' | 'acknowledged' | 'cleared'
  readonly createdAt: string
  readonly clearedAt: string | null
  readonly clearedByRef: string | null
}

export interface HostedStudySyncLearnerV1 {
  readonly learnerRef: string
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly workingGradeBySubject: Readonly<Partial<Record<AcademySubject, AcademyGrade>>>
  readonly enabledSubjects: readonly AcademySubject[]
  readonly assignments: readonly HostedStudySyncAssignmentV1[]
  readonly assessmentAssignments: readonly HostedStudySyncAssessmentAssignmentV1[]
  readonly sourceAttachments: readonly HostedStudySyncSourceAttachmentV1[]
  readonly completionAttestations: readonly HostedStudySyncCompletionAttestationV1[]
  readonly entryBlocks: readonly HostedStudySyncEntryBlockV1[]
}

export interface HostedStudySyncV1 {
  readonly schemaVersion: typeof HOSTED_STUDY_SYNC_SCHEMA_VERSION
  readonly releaseRef: typeof HOSTED_STUDY_SYNC_RELEASE_REF
  readonly updatedAt: string
  readonly learners: readonly HostedStudySyncLearnerV1[]
}

const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'pin', 'rawpin', 'pinplaintext', 'parentpin', 'studentpin', 'pindigest', 'pinhash', 'pinverifier',
  'bearer', 'bearertoken', 'studybearer', 'token', 'tokens', 'authorization', 'authorizationheader',
  'accesstoken', 'refreshtoken', 'grant', 'sessiongrant', 'launchgrant', 'studysessiongrant',
  'rawanswer', 'learneranswer', 'rawresponse', 'learnerresponse', 'responsebody', 'responsetext',
  'responsedraft', 'transientlearnertext', 'tutortranscript', 'rawtutortranscript', 'transcript',
  'transcripttext', 'tutorchats', 'tutorchat', 'assistanttranscript', 'assistantmessages', 'messages',
  'prompt', 'provideroutput', 'audio', 'audioblob', 'audiourl', 'recording', 'voicerecording',
  'mediacapture', 'answerindex', 'correctanswer', 'expectedanswer', 'answerkey', 'answerkeyref',
  'answerauthority', 'answerauthorityref', 'adultanswerauthority', 'restrictedauthorityref',
  'rubric', 'adultrubric', 'scoringauthority', 'adultscoringauthority', 'adultscoringauthorityref',
  'scoringguide', 'scoringguideref', 'scoringlocator', 'scoringref', 'privatenote', 'privatenotes',
  'adultprivatenote', 'adultprivatenotebody', 'notebody', 'emotion', 'emotionallabel',
  'emotionalstate', 'sentiment', 'sentimentlabel', 'personality', 'personalityinference', 'traits',
  'traitinference', 'diagnosis', 'diagnosticlabel', 'diagnosticinference', 'servicecredentials',
  'servicerole', 'servicerolekey', 'servicerolecredential', 'providerapikey', 'apikey', 'clientsecret',
  'providersecret', 'reasoncode', 'safetyreason', 'safetysource', 'dedupekey',
])

const SECRET_VALUE_PATTERNS = [
  /\bbearer\s+[a-z0-9._~+\/-]+=*/i,
  /\bservice[_ -]?role\b\s*[:=]\s*\S+/i,
  /\b(?:access|refresh)[_ -]?token\b\s*[:=]\s*\S+/i,
  /\bsk-[a-z0-9_-]{12,}\b/i,
  /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/,
] as const

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const MAX_TEXT = 160
const MAX_LEARNERS = 24
const MAX_ASSIGNMENTS = 2_000
const MAX_SEGMENTS = 512
const NOMINAL_GRADES = new Set<Grade>(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
const ACADEMY_SUBJECT_SET = new Set<string>(ACADEMY_SUBJECTS)
const ACADEMY_GRADE_SET = new Set<string>(ACADEMY_GRADES)
const ASSIGNMENT_STATES = new Set<AssignmentState>(['planned', 'active', 'paused', 'completed', 'abandoned'])
const ASSESSMENT_AUTHORITIES = new Set<AssessmentAuthority>(['AUTO_SCOREABLE', 'RUBRIC_REQUIRED', 'GUARDIAN_REQUIRED', 'COMPLETION_ONLY'])
const ASSESSMENT_STATUSES = new Set<AssessmentStatus>([
  'PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED',
  'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED',
])
const ATTESTATION_STATUSES = new Set<HostedStudySyncCompletionAttestationV1['status']>([
  'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED',
])
const ENTRY_BLOCK_STATUSES = new Set<HostedStudySyncEntryBlockV1['status']>([
  'open', 'acknowledged', 'cleared',
])

function fail(code: HostedSyncBoundaryErrorCode, path: string, message: string): never {
  throw new HostedSyncBoundaryError(code, path, message)
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function dataEntries(value: unknown, path: string): [string, unknown][] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_TYPE', path, 'Expected a plain object')
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    fail('INVALID_TYPE', path, 'Expected a JSON plain object')
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('UNALLOWLISTED_FIELD', path, 'Symbol keys are not serializable sync fields')
  }
  const entries: [string, unknown][] = []
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_TYPE', `${path}.${key}`, 'Accessors and hidden properties are not sync fields')
    }
    entries.push([key, descriptor.value])
  }
  return entries
}

function dataArrayValues(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('INVALID_TYPE', path, 'Expected a JSON array')
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('UNALLOWLISTED_FIELD', path, 'Symbol keys are not serializable sync fields')
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Object.keys(descriptors)) {
    if (key === 'length') continue
    if (!/^\d+$/.test(key) || Number(key) >= value.length) {
      fail('UNALLOWLISTED_FIELD', `${path}.${key}`, 'Array contains a named property')
    }
  }
  const result: unknown[] = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)]
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_TYPE', `${path}[${index}]`, 'Sparse arrays and accessors are not sync fields')
    }
    result.push(descriptor.value)
  }
  return result
}

function scanForbidden(value: unknown, path = '$', seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      fail('SENSITIVE_VALUE', path, 'Credential-shaped text is forbidden in sync state')
    }
    return
  }
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) fail('INVALID_TYPE', path, 'Cyclic or aliased objects are not sync state')
  seen.add(value)
  if (Array.isArray(value)) {
    dataArrayValues(value, path).forEach((entry, index) => scanForbidden(entry, `${path}[${index}]`, seen))
    return
  }
  for (const [key, entry] of dataEntries(value, path)) {
    if (FORBIDDEN_NORMALIZED_KEYS.has(normalizedKey(key))) {
      fail('FORBIDDEN_FIELD', `${path}.${key}`, 'Forbidden security/privacy field')
    }
    scanForbidden(entry, `${path}.${key}`, seen)
  }
}

function exactObject(value: unknown, allowedKeys: readonly string[], path: string): Record<string, unknown> {
  const entries = dataEntries(value, path)
  const actual = new Set(entries.map(([key]) => key))
  for (const key of actual) {
    if (!allowedKeys.includes(key)) fail('UNALLOWLISTED_FIELD', `${path}.${key}`, 'Field is not allowlisted')
  }
  for (const key of allowedKeys) {
    if (!actual.has(key)) fail('MISSING_FIELD', `${path}.${key}`, 'Required sync field is missing')
  }
  return Object.fromEntries(entries)
}

function array(value: unknown, path: string, maximum: number): unknown[] {
  const entries = dataArrayValues(value, path)
  if (entries.length > maximum) fail('LIMIT_EXCEEDED', path, 'Sync array exceeds its bound')
  return entries
}

function boundedText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TEXT) {
    fail('INVALID_VALUE', path, 'Expected bounded non-empty text')
  }
  return value
}

function ref(value: unknown, path: string): string {
  if (typeof value !== 'string' || !REF.test(value)) fail('INVALID_VALUE', path, 'Expected an opaque reference')
  return value
}

function nullableRef(value: unknown, path: string): string | null {
  return value === null ? null : ref(value, path)
}

function instant(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) {
    fail('INVALID_VALUE', path, 'Expected an ISO timestamp')
  }
  return value
}

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path)
}

function integer(value: unknown, path: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    fail('INVALID_VALUE', path, 'Expected a bounded non-negative integer')
  }
  return value as number
}

function member<T extends string>(value: unknown, allowed: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) fail('INVALID_VALUE', path, 'Value is outside the closed set')
  return value as T
}

function uniqueRefs(value: unknown, path: string): string[] {
  const refs = array(value, path, MAX_SEGMENTS).map((entry, index) => ref(entry, `${path}[${index}]`))
  if (new Set(refs).size !== refs.length) fail('INVALID_VALUE', path, 'Reference list contains duplicates')
  return refs
}

function parseProgress(value: unknown, path: string): HostedStudySyncProgressV1 {
  const held = exactObject(value, ['completedSegmentRefs', 'totalSegments', 'lastSegmentRef'], path)
  const completedSegmentRefs = uniqueRefs(held.completedSegmentRefs, `${path}.completedSegmentRefs`)
  const totalSegments = integer(held.totalSegments, `${path}.totalSegments`, MAX_SEGMENTS)
  if (completedSegmentRefs.length > totalSegments) fail('INVALID_VALUE', path, 'Completed segments exceed total segments')
  return {
    completedSegmentRefs,
    totalSegments,
    lastSegmentRef: nullableRef(held.lastSegmentRef, `${path}.lastSegmentRef`),
  }
}

function parseAssignment(value: unknown, path: string): HostedStudySyncAssignmentV1 {
  const held = exactObject(value, [
    'assignmentRef', 'lessonRef', 'subject', 'title', 'state', 'updatedAt', 'completedAt', 'progress',
  ], path)
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    lessonRef: ref(held.lessonRef, `${path}.lessonRef`),
    subject: member(held.subject, ACADEMY_SUBJECT_SET, `${path}.subject`) as AcademySubject,
    title: boundedText(held.title, `${path}.title`),
    state: member(held.state, ASSIGNMENT_STATES, `${path}.state`),
    updatedAt: instant(held.updatedAt, `${path}.updatedAt`),
    completedAt: nullableInstant(held.completedAt, `${path}.completedAt`),
    progress: parseProgress(held.progress, `${path}.progress`),
  }
}

function parseAssessmentAssignment(value: unknown, path: string): HostedStudySyncAssessmentAssignmentV1 {
  const held = exactObject(value, [
    'assignmentRef', 'assessmentRef', 'courseRef', 'subject', 'grade', 'title',
    'authorityClass', 'status', 'updatedAt', 'completedAt',
  ], path)
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    assessmentRef: ref(held.assessmentRef, `${path}.assessmentRef`),
    courseRef: ref(held.courseRef, `${path}.courseRef`),
    subject: member(held.subject, ACADEMY_SUBJECT_SET, `${path}.subject`) as AcademySubject,
    grade: integer(held.grade, `${path}.grade`, 12),
    title: boundedText(held.title, `${path}.title`),
    authorityClass: member(held.authorityClass, ASSESSMENT_AUTHORITIES, `${path}.authorityClass`),
    status: member(held.status, ASSESSMENT_STATUSES, `${path}.status`),
    updatedAt: instant(held.updatedAt, `${path}.updatedAt`),
    completedAt: nullableInstant(held.completedAt, `${path}.completedAt`),
  }
}

function parseSourceAttachment(value: unknown, path: string): HostedStudySyncSourceAttachmentV1 {
  const held = exactObject(value, ['assignmentRef', 'lessonRef', 'sourceRef', 'attachedAt', 'status'], path)
  if (held.status !== 'ATTACHED_SATISFIED') fail('INVALID_VALUE', `${path}.status`, 'Unknown source readiness status')
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    lessonRef: ref(held.lessonRef, `${path}.lessonRef`),
    sourceRef: ref(held.sourceRef, `${path}.sourceRef`),
    attachedAt: instant(held.attachedAt, `${path}.attachedAt`),
    status: held.status,
  }
}

function parseAttestation(value: unknown, path: string): HostedStudySyncCompletionAttestationV1 {
  const held = exactObject(value, [
    'assignmentRef', 'lessonRef', 'sessionRef', 'authority', 'status', 'learnerAssertedAt',
    'attestedAt', 'attestedByRef', 'evidenceMode',
  ], path)
  if (held.authority !== 'GUARDIAN_ATTESTATION_REQUIRED') {
    fail('INVALID_VALUE', `${path}.authority`, 'Unknown completion authority')
  }
  if (held.evidenceMode !== null && held.evidenceMode !== 'adult-observed' && held.evidenceMode !== 'simulated-alternative') {
    fail('INVALID_VALUE', `${path}.evidenceMode`, 'Unknown evidence mode')
  }
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    lessonRef: ref(held.lessonRef, `${path}.lessonRef`),
    sessionRef: ref(held.sessionRef, `${path}.sessionRef`),
    authority: held.authority,
    status: member(held.status, ATTESTATION_STATUSES, `${path}.status`),
    learnerAssertedAt: instant(held.learnerAssertedAt, `${path}.learnerAssertedAt`),
    attestedAt: nullableInstant(held.attestedAt, `${path}.attestedAt`),
    attestedByRef: nullableRef(held.attestedByRef, `${path}.attestedByRef`),
    evidenceMode: held.evidenceMode,
  }
}

function parseEntryBlock(value: unknown, path: string): HostedStudySyncEntryBlockV1 {
  const held = exactObject(value, ['blockRef', 'sessionRef', 'status', 'createdAt', 'clearedAt', 'clearedByRef'], path)
  return {
    blockRef: ref(held.blockRef, `${path}.blockRef`),
    sessionRef: ref(held.sessionRef, `${path}.sessionRef`),
    status: member(held.status, ENTRY_BLOCK_STATUSES, `${path}.status`),
    createdAt: instant(held.createdAt, `${path}.createdAt`),
    clearedAt: nullableInstant(held.clearedAt, `${path}.clearedAt`),
    clearedByRef: nullableRef(held.clearedByRef, `${path}.clearedByRef`),
  }
}

function parseWorkingGrades(value: unknown, path: string): Partial<Record<AcademySubject, AcademyGrade>> {
  const result: Partial<Record<AcademySubject, AcademyGrade>> = {}
  for (const [subject, grade] of dataEntries(value, path)) {
    if (!ACADEMY_SUBJECT_SET.has(subject)) fail('UNALLOWLISTED_FIELD', `${path}.${subject}`, 'Unknown subject key')
    result[subject as AcademySubject] = member(grade, ACADEMY_GRADE_SET, `${path}.${subject}`) as AcademyGrade
  }
  return result
}

function parseLearner(value: unknown, path: string): HostedStudySyncLearnerV1 {
  const held = exactObject(value, [
    'learnerRef', 'displayName', 'nominalGrade', 'workingGradeBySubject', 'enabledSubjects',
    'assignments', 'assessmentAssignments', 'sourceAttachments', 'completionAttestations', 'entryBlocks',
  ], path)
  const enabledSubjects = array(held.enabledSubjects, `${path}.enabledSubjects`, ACADEMY_SUBJECTS.length)
    .map((subject, index) => member(subject, ACADEMY_SUBJECT_SET, `${path}.enabledSubjects[${index}]`) as AcademySubject)
  if (new Set(enabledSubjects).size !== enabledSubjects.length) fail('INVALID_VALUE', `${path}.enabledSubjects`, 'Subjects contain duplicates')
  const workingGradeBySubject = parseWorkingGrades(held.workingGradeBySubject, `${path}.workingGradeBySubject`)
  for (const subject of Object.keys(workingGradeBySubject)) {
    if (!enabledSubjects.includes(subject as AcademySubject)) {
      fail('INVALID_VALUE', `${path}.workingGradeBySubject.${subject}`, 'Working grade subject is not enabled')
    }
  }
  return {
    learnerRef: ref(held.learnerRef, `${path}.learnerRef`),
    displayName: boundedText(held.displayName, `${path}.displayName`),
    nominalGrade: member(held.nominalGrade, NOMINAL_GRADES, `${path}.nominalGrade`),
    workingGradeBySubject,
    enabledSubjects,
    assignments: array(held.assignments, `${path}.assignments`, MAX_ASSIGNMENTS)
      .map((entry, index) => parseAssignment(entry, `${path}.assignments[${index}]`)),
    assessmentAssignments: array(held.assessmentAssignments, `${path}.assessmentAssignments`, MAX_ASSIGNMENTS)
      .map((entry, index) => parseAssessmentAssignment(entry, `${path}.assessmentAssignments[${index}]`)),
    sourceAttachments: array(held.sourceAttachments, `${path}.sourceAttachments`, MAX_ASSIGNMENTS)
      .map((entry, index) => parseSourceAttachment(entry, `${path}.sourceAttachments[${index}]`)),
    completionAttestations: array(held.completionAttestations, `${path}.completionAttestations`, MAX_ASSIGNMENTS)
      .map((entry, index) => parseAttestation(entry, `${path}.completionAttestations[${index}]`)),
    entryBlocks: array(held.entryBlocks, `${path}.entryBlocks`, MAX_ASSIGNMENTS)
      .map((entry, index) => parseEntryBlock(entry, `${path}.entryBlocks[${index}]`)),
  }
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical)
  if (value !== null && typeof value === 'object') {
    const held = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(held).sort().map((key) => [key, sortCanonical(held[key])]))
  }
  return value
}

export type HostedStudySyncValidation =
  | { readonly ok: true; readonly value: HostedStudySyncV1 }
  | { readonly ok: false; readonly error: HostedSyncBoundaryError }

export function validateHostedStudySyncV1(value: unknown): HostedStudySyncValidation {
  try {
    scanForbidden(value)
    const held = exactObject(value, ['schemaVersion', 'releaseRef', 'updatedAt', 'learners'], '$')
    if (held.schemaVersion !== HOSTED_STUDY_SYNC_SCHEMA_VERSION) {
      fail('SCHEMA_VERSION', '$.schemaVersion', 'Unsupported hosted sync schema version')
    }
    if (held.releaseRef !== HOSTED_STUDY_SYNC_RELEASE_REF) {
      fail('RELEASE_MISMATCH', '$.releaseRef', 'Hosted sync release does not match the learner-ready release')
    }
    const learners = array(held.learners, '$.learners', MAX_LEARNERS)
      .map((entry, index) => parseLearner(entry, `$.learners[${index}]`))
    if (new Set(learners.map((learner) => learner.learnerRef)).size !== learners.length) {
      fail('INVALID_VALUE', '$.learners', 'Learner references contain duplicates')
    }
    return {
      ok: true,
      value: {
        schemaVersion: HOSTED_STUDY_SYNC_SCHEMA_VERSION,
        releaseRef: HOSTED_STUDY_SYNC_RELEASE_REF,
        updatedAt: instant(held.updatedAt, '$.updatedAt'),
        learners,
      },
    }
  } catch (error) {
    if (error instanceof HostedSyncBoundaryError) return { ok: false, error }
    throw error
  }
}

declare const serializedHostedStudySyncBrand: unique symbol

/**
 * Opaque, runtime-sealed serializer output. It intentionally exposes no body,
 * so future R2 network code cannot accept a string or arbitrary object instead.
 */
export interface SerializedHostedStudySyncV1 {
  readonly schemaId: typeof HOSTED_STUDY_SYNC_SCHEMA_ID
  readonly byteLength: number
  readonly [serializedHostedStudySyncBrand]: never
}

const SERIALIZED_BODIES = new WeakMap<object, string>()

/** Anything not on the allowlist throws before a byte can reach a network port. */
export function serializeHostedStudySyncV1(value: unknown): SerializedHostedStudySyncV1 {
  const validated = validateHostedStudySyncV1(value)
  if (!validated.ok) throw validated.error
  const body = JSON.stringify(sortCanonical(validated.value))
  const output = Object.freeze({
    schemaId: HOSTED_STUDY_SYNC_SCHEMA_ID,
    byteLength: new TextEncoder().encode(body).byteLength,
  }) as SerializedHostedStudySyncV1
  SERIALIZED_BODIES.set(output, body)
  return output
}

export type HostedStudySyncWriteOperation = 'first-link' | 'write'

export interface HostedStudySyncNetworkRequest {
  readonly operation: HostedStudySyncWriteOperation
  readonly schemaId: typeof HOSTED_STUDY_SYNC_SCHEMA_ID
  readonly contentType: 'application/json'
  readonly body: string
}

/** Lowest network adapter; no Family Pilot module instantiates one yet. */
export interface HostedStudySyncNetworkPort<Result> {
  send(request: HostedStudySyncNetworkRequest): Promise<Result>
}

/**
 * Mandatory final pre-network gate for both future R2 mutation paths.
 * There is intentionally no `send(object)` or `send(string)` overload.
 */
export class HostedStudySyncPreNetworkGate<Result> {
  constructor(private readonly network: HostedStudySyncNetworkPort<Result>) {}

  firstLink(payload: SerializedHostedStudySyncV1): Promise<Result> {
    return this.dispatch('first-link', payload)
  }

  write(payload: SerializedHostedStudySyncV1): Promise<Result> {
    return this.dispatch('write', payload)
  }

  private dispatch(operation: HostedStudySyncWriteOperation, payload: SerializedHostedStudySyncV1): Promise<Result> {
    const body = payload && typeof payload === 'object' ? SERIALIZED_BODIES.get(payload) : undefined
    if (body === undefined) {
      fail('UNSERIALIZED_PAYLOAD', '$', 'Hosted sync accepts only output sealed by the production serializer')
    }
    return this.network.send(Object.freeze({
      operation,
      schemaId: HOSTED_STUDY_SYNC_SCHEMA_ID,
      contentType: 'application/json',
      body,
    }))
  }
}
