/**
 * HOSTED SYNC SECURITY R2 — proposed Family Pilot cloud-state boundary.
 *
 * This is an audit/test contract, not a production transport. Production may
 * use this DTO only after it imports or exactly reproduces this fail-closed
 * serializer at its final pre-network boundary.
 */

export const HOSTED_STUDY_SYNC_SCHEMA_VERSION = 1
export const HOSTED_STUDY_SYNC_SCHEMA_ID = 'hosted-study-sync.v1'
export const HOSTED_STUDY_SYNC_RELEASE_REF = 'family-pilot-r1'

export const ACADEMY_SUBJECTS = Object.freeze([
  'arts-and-music',
  'english-language-arts',
  'financial-literacy',
  'health',
  'mathematics',
  'physical-education',
  'ready-for-life',
  'science',
  'social-studies',
  'technology',
])

export const ACADEMY_GRADES = Object.freeze(['3', '4', '5', '7', '8', '9', '10', '11', '12'])
export const NOMINAL_GRADES = Object.freeze(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])

/**
 * The complete field allowlist. `[]` means an array element; `{subject}` is a
 * closed Academy-subject key, not an arbitrary record key. No production type
 * such as AppState, Profile, FinalFamilyPilotAppStateV1, or
 * DurableStudyDocumentV1 is itself a sync DTO.
 */
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
])

/** Exact names and normalized name families that are never cloud fields. */
export const FORBIDDEN_SYNC_FIELD_FAMILIES_V1 = Object.freeze([
  'raw PIN / PIN plaintext / PIN digest or verifier',
  'Study bearer, access/refresh token, authorization header, session or launch grant',
  'raw learner answer, response body, or response draft',
  'Tutor/assistant transcript, chat, prompt, message, or provider output',
  'audio, voice recording, blob, or media capture',
  'answer index, correct answer, answer key, expected answer, scoring guide, or scoring locator',
  'adult/private note body',
  'emotional, sentiment, personality, trait, or diagnostic label/inference',
  'service-role credential or provider API key',
  'safety reason/source labels (only label-free enforcement state is allowed)',
])

const FORBIDDEN_NORMALIZED_KEYS = Object.freeze(new Set([
  'pin', 'rawpin', 'pinplaintext', 'parentpin', 'studentpin', 'pindigest', 'pinhash', 'pinverifier',
  'bearer', 'bearertoken', 'studybearer', 'authorization', 'authorizationheader', 'accesstoken',
  'refreshtoken', 'sessiongrant', 'launchgrant', 'studysessiongrant',
  'rawanswer', 'rawresponse', 'learnerresponse', 'responsebody', 'responsetext', 'responsedraft',
  'transientlearnertext',
  'tutortranscript', 'rawtutortranscript', 'transcript', 'transcripttext', 'tutorchats', 'assistanttranscript',
  'messages', 'prompt', 'provideroutput',
  'audio', 'audioblob', 'audiourl', 'recording', 'voicerecording',
  'answerindex', 'correctanswer', 'expectedanswer', 'answerkey', 'answerkeyref', 'answerauthorityref',
  'adultanswerauthority', 'adultscoringauthorityref', 'restrictedauthorityref', 'scoringguide',
  'scoringguideref', 'scoringlocator', 'scoringref',
  'privatenote', 'privatenotes', 'adultprivatenote', 'adultprivatenotebody', 'notebody',
  'emotion', 'emotionallabel', 'emotionalstate', 'sentiment', 'sentimentlabel',
  'personality', 'personalityinference', 'traits', 'traitinference',
  'diagnosis', 'diagnosticlabel', 'diagnosticinference',
  'servicerole', 'servicerolekey', 'servicerolecredential', 'providerapikey', 'apikey',
  'reasoncode', 'safetyreason', 'safetysource', 'dedupekey',
]))

const SECRET_VALUE_PATTERNS = Object.freeze([
  /\bbearer\s+[a-z0-9._~+\/-]+=*/i,
  /\bservice[_ -]?role\b\s*[:=]\s*\S+/i,
  /\b(?:access|refresh)[_ -]?token\b\s*[:=]\s*\S+/i,
  /\bsk-[a-z0-9_-]{12,}\b/i,
  /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/,
])

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const MAX_TEXT = 160
const MAX_LEARNERS = 24
const MAX_ASSIGNMENTS = 2_000
const MAX_SEGMENTS = 512
const ASSIGNMENT_STATES = new Set(['planned', 'active', 'paused', 'completed', 'abandoned'])
const ASSESSMENT_AUTHORITIES = new Set(['AUTO_SCOREABLE', 'RUBRIC_REQUIRED', 'GUARDIAN_REQUIRED', 'COMPLETION_ONLY'])
const ASSESSMENT_STATUSES = new Set([
  'PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED',
  'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED',
])
const ATTESTATION_STATUSES = new Set(['PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'])
const ENTRY_BLOCK_STATUSES = new Set(['open', 'acknowledged', 'cleared'])

export class HostedSyncBoundaryError extends Error {
  constructor(code, path, message) {
    super(`${message} (${path})`)
    this.name = 'HostedSyncBoundaryError'
    this.code = code
    this.path = path
  }
}

function fail(code, path, message) {
  throw new HostedSyncBoundaryError(code, path, message)
}

function normalizedKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function dataEntries(value, path) {
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
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const entries = []
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_TYPE', `${path}.${key}`, 'Accessors and hidden properties are not sync fields')
    }
    entries.push([key, descriptor.value])
  }
  return entries
}

function scanForbidden(value, path = '$', active = new Set()) {
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      fail('SENSITIVE_VALUE', path, 'Credential-shaped text is forbidden in sync state')
    }
    return
  }
  if (value === null || typeof value !== 'object') return
  if (active.has(value)) fail('INVALID_TYPE', path, 'Cyclic values are not sync state')
  active.add(value)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, `${path}[${index}]`, active))
  } else {
    for (const [key, entry] of dataEntries(value, path)) {
      if (FORBIDDEN_NORMALIZED_KEYS.has(normalizedKey(key))) {
        fail('FORBIDDEN_FIELD', `${path}.${key}`, 'Forbidden security/privacy field')
      }
      scanForbidden(entry, `${path}.${key}`, active)
    }
  }
  active.delete(value)
}

function exactObject(value, allowedKeys, path) {
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

function array(value, path, maximum) {
  if (!Array.isArray(value)) fail('INVALID_TYPE', path, 'Expected an array')
  if (value.length > maximum) fail('LIMIT_EXCEEDED', path, 'Sync array exceeds its bound')
  if (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key) => !/^\d+$/.test(key) || Number(key) >= value.length)) {
    fail('UNALLOWLISTED_FIELD', path, 'Array contains a named property')
  }
  return value
}

function string(value, path, maximum = MAX_TEXT) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    fail('INVALID_VALUE', path, 'Expected bounded non-empty text')
  }
  return value
}

function ref(value, path) {
  if (typeof value !== 'string' || !REF.test(value)) fail('INVALID_VALUE', path, 'Expected an opaque reference')
  return value
}

function nullableRef(value, path) {
  return value === null ? null : ref(value, path)
}

function instant(value, path) {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) {
    fail('INVALID_VALUE', path, 'Expected an ISO timestamp')
  }
  return value
}

function nullableInstant(value, path) {
  return value === null ? null : instant(value, path)
}

function integer(value, path, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail('INVALID_VALUE', path, 'Expected a bounded non-negative integer')
  }
  return value
}

function member(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) fail('INVALID_VALUE', path, 'Value is outside the closed set')
  return value
}

function uniqueRefs(value, path) {
  const refs = array(value, path, MAX_SEGMENTS).map((entry, index) => ref(entry, `${path}[${index}]`))
  if (new Set(refs).size !== refs.length) fail('INVALID_VALUE', path, 'Reference list contains duplicates')
  return refs
}

function parseProgress(value, path) {
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

function parseAssignment(value, path) {
  const held = exactObject(value, [
    'assignmentRef', 'lessonRef', 'subject', 'title', 'state', 'updatedAt', 'completedAt', 'progress',
  ], path)
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    lessonRef: ref(held.lessonRef, `${path}.lessonRef`),
    subject: member(held.subject, new Set(ACADEMY_SUBJECTS), `${path}.subject`),
    title: string(held.title, `${path}.title`),
    state: member(held.state, ASSIGNMENT_STATES, `${path}.state`),
    updatedAt: instant(held.updatedAt, `${path}.updatedAt`),
    completedAt: nullableInstant(held.completedAt, `${path}.completedAt`),
    progress: parseProgress(held.progress, `${path}.progress`),
  }
}

function parseAssessmentAssignment(value, path) {
  const held = exactObject(value, [
    'assignmentRef', 'assessmentRef', 'courseRef', 'subject', 'grade', 'title',
    'authorityClass', 'status', 'updatedAt', 'completedAt',
  ], path)
  return {
    assignmentRef: ref(held.assignmentRef, `${path}.assignmentRef`),
    assessmentRef: ref(held.assessmentRef, `${path}.assessmentRef`),
    courseRef: ref(held.courseRef, `${path}.courseRef`),
    subject: member(held.subject, new Set(ACADEMY_SUBJECTS), `${path}.subject`),
    grade: integer(held.grade, `${path}.grade`, 12),
    title: string(held.title, `${path}.title`),
    authorityClass: member(held.authorityClass, ASSESSMENT_AUTHORITIES, `${path}.authorityClass`),
    status: member(held.status, ASSESSMENT_STATUSES, `${path}.status`),
    updatedAt: instant(held.updatedAt, `${path}.updatedAt`),
    completedAt: nullableInstant(held.completedAt, `${path}.completedAt`),
  }
}

function parseSourceAttachment(value, path) {
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

function parseAttestation(value, path) {
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

function parseEntryBlock(value, path) {
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

function parseWorkingGrades(value, path) {
  const entries = dataEntries(value, path)
  const result = {}
  for (const [subject, grade] of entries) {
    if (!ACADEMY_SUBJECTS.includes(subject)) fail('UNALLOWLISTED_FIELD', `${path}.${subject}`, 'Unknown subject key')
    result[subject] = member(grade, new Set(ACADEMY_GRADES), `${path}.${subject}`)
  }
  return result
}

function parseLearner(value, path) {
  const held = exactObject(value, [
    'learnerRef', 'displayName', 'nominalGrade', 'workingGradeBySubject', 'enabledSubjects',
    'assignments', 'assessmentAssignments', 'sourceAttachments', 'completionAttestations', 'entryBlocks',
  ], path)
  const enabledSubjects = array(held.enabledSubjects, `${path}.enabledSubjects`, ACADEMY_SUBJECTS.length)
    .map((subject, index) => member(subject, new Set(ACADEMY_SUBJECTS), `${path}.enabledSubjects[${index}]`))
  if (new Set(enabledSubjects).size !== enabledSubjects.length) fail('INVALID_VALUE', `${path}.enabledSubjects`, 'Subjects contain duplicates')
  const workingGradeBySubject = parseWorkingGrades(held.workingGradeBySubject, `${path}.workingGradeBySubject`)
  for (const subject of Object.keys(workingGradeBySubject)) {
    if (!enabledSubjects.includes(subject)) fail('INVALID_VALUE', `${path}.workingGradeBySubject.${subject}`, 'Working grade subject is not enabled')
  }
  return {
    learnerRef: ref(held.learnerRef, `${path}.learnerRef`),
    displayName: string(held.displayName, `${path}.displayName`),
    nominalGrade: member(held.nominalGrade, new Set(NOMINAL_GRADES), `${path}.nominalGrade`),
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

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]))
  }
  return value
}

export function validateHostedStudySyncV1(value) {
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

/** Anything not on the allowlist throws before a byte can be handed to transport. */
export function serializeHostedStudySyncV1(value) {
  const validated = validateHostedStudySyncV1(value)
  if (!validated.ok) throw validated.error
  return JSON.stringify(sortCanonical(validated.value))
}

export function exampleHostedStudySyncV1() {
  return {
    schemaVersion: 1,
    releaseRef: 'family-pilot-r1',
    updatedAt: '2026-08-13T16:00:00.000Z',
    learners: [{
      learnerRef: 'student:avery',
      displayName: 'Avery',
      nominalGrade: '5',
      workingGradeBySubject: { mathematics: '5' },
      enabledSubjects: ['mathematics', 'ready-for-life', 'social-studies'],
      assignments: [{
        assignmentRef: 'assignment:math-1',
        lessonRef: 'ma-g5-mathematics-u01-l01',
        subject: 'mathematics',
        title: 'Launch and diagnostic: problem-solving routines',
        state: 'active',
        updatedAt: '2026-08-13T15:59:00.000Z',
        completedAt: null,
        progress: {
          completedSegmentRefs: ['segment:learn'],
          totalSegments: 3,
          lastSegmentRef: 'segment:practice',
        },
      }],
      assessmentAssignments: [{
        assignmentRef: 'assignment:assessment-1',
        assessmentRef: 'assessment:math-u01',
        courseRef: 'ma-g5-mathematics',
        subject: 'mathematics',
        grade: 5,
        title: 'Unit 1 assessment',
        authorityClass: 'AUTO_SCOREABLE',
        status: 'PENDING_ASSESSMENT',
        updatedAt: '2026-08-13T15:59:00.000Z',
        completedAt: null,
      }],
      sourceAttachments: [{
        assignmentRef: 'assignment:social-1',
        lessonRef: 'ma-g3-social-studies-u09-l01',
        sourceRef: 'source:family-library-1',
        attachedAt: '2026-08-13T15:00:00.000Z',
        status: 'ATTACHED_SATISFIED',
      }],
      completionAttestations: [{
        assignmentRef: 'assignment:rfl-1',
        lessonRef: 'ma-g5-ready-for-life-u01-l04',
        sessionRef: 'session:rfl-1',
        authority: 'GUARDIAN_ATTESTATION_REQUIRED',
        status: 'CERTIFIED',
        learnerAssertedAt: '2026-08-13T15:30:00.000Z',
        attestedAt: '2026-08-13T15:35:00.000Z',
        attestedByRef: 'guardian:1',
        evidenceMode: 'adult-observed',
      }],
      entryBlocks: [{
        blockRef: 'block:safety-1',
        sessionRef: 'session:math-1',
        status: 'cleared',
        createdAt: '2026-08-13T15:10:00.000Z',
        clearedAt: '2026-08-13T15:20:00.000Z',
        clearedByRef: 'guardian:1',
      }],
    }],
  }
}
