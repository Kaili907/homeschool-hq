// FAMILY-PILOT-CORE: the device-local state schema for first-party family use.
//
// This schema is deliberately NOT a second Study Engine. It records only what a
// household needs to stop and resume real work across days: who the student is,
// what they were assigned, where they got to, and whether it is finished. All
// instructional authority stays with the Study runtime.
//
// Two invariants are enforced by the types themselves rather than by convention:
//
//   • rawAnswerIncluded / transcriptIncluded are literal `false`, mirroring
//     StudyCheckpoint and StudyCheckpointRecord. A build that tries to persist
//     learner prose here fails to compile, and parseFamilyPilotState drops any
//     stored record that claims otherwise.
//   • Records are keyed on `studentRef`, a flat opaque string, exactly as
//     src/study/safety/localStopLedger.ts keys its device-local records. No
//     key named in BROWSER_AUTHORITY_CLAIM_KEYS (studentId, householdId, role,
//     email, …) may appear, so pilot state can never be mistaken for, or
//     replayed as, server-derived authority.

/**
 * Version 2 adds the completion/attestation block.
 *
 * The bump is load-bearing, not bookkeeping. Version 1 records have no
 * `completion` block at all, so an absent block there legitimately means "this
 * predates completion authority" and reads back as learner-certified. At
 * version 2 an absent block means the record was stripped, and is refused —
 * without the bump the two are byte-for-byte identical and the parser would
 * have to guess, which is a certification obtainable by DELETING a field.
 *
 * The bump also stops an older build clobbering newer state: version 1 builds
 * see 2 > 1, report 'schema-version-ahead', and refuse to write. A stale
 * service-worker bundle can therefore no longer strip a pending attestation and
 * complete the work on a learner's click.
 */
export const FAMILY_PILOT_SCHEMA_VERSION = 2 as const

/** Versions this build can read. Anything older is upgraded in place on load. */
const READABLE_SCHEMA_VERSIONS: readonly number[] = Object.freeze([1, 2])

/** A subset of StudySessionRecord['state']; the pilot never invents new states. */
export type FamilyPilotAssignmentState =
  | 'planned'
  | 'active'
  | 'paused'
  | 'completed'
  | 'abandoned'

export const FAMILY_PILOT_ASSIGNMENT_STATES: readonly FamilyPilotAssignmentState[] =
  Object.freeze(['planned', 'active', 'paused', 'completed', 'abandoned'])

export interface FamilyPilotProgressV1 {
  readonly completedSegmentRefs: readonly string[]
  readonly totalSegments: number
  readonly lastSegmentRef: string | null
  readonly activeSeconds: number
}

/** Pause/resume metadata. `resumeSegmentRef` is where the learner returns to. */
export interface FamilyPilotPauseV1 {
  readonly pausedAt: string | null
  readonly resumedAt: string | null
  readonly pausedSeconds: number
  readonly resumeSegmentRef: string | null
}

/**
 * COMPLETION AUTHORITY — who may certify that this assignment is finished.
 *
 * The vocabulary is the curriculum's, not the pilot's. A student-work package
 * carries `completionAuthority: 'learner' | 'guardian'`, and a 'guardian'
 * package additionally carries a sign-off block whose `studentSelfReport` is
 * 'recorded-but-not-certifying'. These two values are that same decision
 * spelled for the runtime, so the authored contract and what actually runs
 * cannot drift apart.
 */
export type FamilyPilotCompletionAuthority =
  | 'LEARNER_AUTHORITY'
  | 'GUARDIAN_ATTESTATION_REQUIRED'

export type FamilyPilotCompletionStatus =
  | 'NOT_COMPLETE'
  | 'PENDING_GUARDIAN_ATTESTATION'
  | 'CERTIFIED'

/**
 * How the adult satisfied the requirement. Both values certify identically: a
 * household that ran the authored simulated alternative instead of the
 * real-world action earns the same credit, which is what makes that
 * alternative a real option rather than a lesser one.
 */
export type FamilyPilotAttestationEvidence = 'adult-observed' | 'simulated-alternative'

/**
 * The minimized completion/attestation record.
 *
 * Every field is a ref, an enum or an instant. There is deliberately nowhere to
 * put what the adult watched, what the learner wrote or said, a photo, a
 * recording, or a note from either of them: an attestation asserts only that a
 * household-authorized adult certified this exact assignment, and nothing more
 * is needed to say so.
 *
 * The `attested*Ref` triple is the binding, and it is STORED rather than
 * inferred from where the record sits. A certification lifted verbatim out of
 * one child's record and pasted into another's is therefore refused by the
 * parser on the way back in, instead of being trusted because of where it was
 * found.
 *
 * That is resistance, not tamper-proofing, and the difference matters. Because
 * assignment refs are lesson-derived, siblings share `attestedAssignmentRef`
 * and `attestedLessonRef`, so `attestedStudentRef` is the only field that
 * distinguishes them: someone editing device-local storage by hand who also
 * rewrites that one string gets a record that parses. Device-local state is
 * unauthenticated by nature and nothing here can change that. What these
 * checks do buy is that no ACCIDENT — a merge, a restore, a copied profile, a
 * partially written record — can move a certification between children.
 */
export interface FamilyPilotCompletionRecordV1 {
  readonly authority: FamilyPilotCompletionAuthority
  readonly status: FamilyPilotCompletionStatus
  /** The learner's own "I finished". Recorded; never certifying on its own. */
  readonly learnerAssertedAt: string | null
  readonly attestedAt: string | null
  /** Opaque adult reference. Never a name, an email, or a contact detail. */
  readonly attestedByRef: string | null
  readonly evidenceMode: FamilyPilotAttestationEvidence | null
  readonly attestedStudentRef: string | null
  readonly attestedAssignmentRef: string | null
  readonly attestedLessonRef: string | null
}

export const FAMILY_PILOT_COMPLETION_AUTHORITIES: readonly FamilyPilotCompletionAuthority[] =
  Object.freeze(['LEARNER_AUTHORITY', 'GUARDIAN_ATTESTATION_REQUIRED'])

export const FAMILY_PILOT_COMPLETION_STATUSES: readonly FamilyPilotCompletionStatus[] =
  Object.freeze(['NOT_COMPLETE', 'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'])

export const FAMILY_PILOT_ATTESTATION_EVIDENCE: readonly FamilyPilotAttestationEvidence[] =
  Object.freeze(['adult-observed', 'simulated-alternative'])

/** A fresh, uncertified completion record under the given authority. */
export function emptyFamilyPilotCompletion(
  authority: FamilyPilotCompletionAuthority = 'LEARNER_AUTHORITY',
): FamilyPilotCompletionRecordV1 {
  return Object.freeze({
    authority,
    status: 'NOT_COMPLETE',
    learnerAssertedAt: null,
    attestedAt: null,
    attestedByRef: null,
    evidenceMode: null,
    attestedStudentRef: null,
    attestedAssignmentRef: null,
    attestedLessonRef: null,
  })
}

export interface FamilyPilotAssignmentRecordV1 {
  readonly assignmentRef: string
  /** Lesson/content reference. Opaque to the pilot; the runtime owns meaning. */
  readonly lessonRef: string
  readonly subject: string
  readonly title: string
  readonly state: FamilyPilotAssignmentState
  /**
   * The active Study session reference. This is the pilot's OWN local
   * reference, never a StudySessionGrant.sessionReference — that grant is
   * documented "keep in memory; never persist in browser storage".
   */
  readonly sessionRef: string | null
  readonly progress: FamilyPilotProgressV1
  readonly pause: FamilyPilotPauseV1
  /** Who may certify this assignment, and whether they have. */
  readonly completion: FamilyPilotCompletionRecordV1
  readonly completedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export interface FamilyPilotStudentRecordV1 {
  readonly studentRef: string
  readonly displayName: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly activeAssignmentRef: string | null
  readonly assignments: readonly FamilyPilotAssignmentRecordV1[]
}

export interface FamilyPilotStateV1 {
  readonly schemaVersion: typeof FAMILY_PILOT_SCHEMA_VERSION
  readonly updatedAt: string
  /** Which student the pilot is currently working as. Null is a valid idle state. */
  readonly activeStudentRef: string | null
  readonly students: readonly FamilyPilotStudentRecordV1[]
}

/** Matches src/study/database/studyDatabaseContract.ts's canonical identifier. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const MAX_STUDENTS = 24
const MAX_ASSIGNMENTS_PER_STUDENT = 500
const MAX_SEGMENTS = 512
const MAX_TEXT = 160

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isCount(value: unknown, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max
}

/** Display text is household-authored, never learner free-response. */
function isDisplayText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
}

/**
 * Exported so a write can be refused for the same reason a read would be.
 *
 * The parser drops an assignment whose stored refs it cannot read, so a value
 * that is written but unreadable costs the household that assignment on the
 * next reload. Callers that accept a ref from outside Core check it here first.
 */
export function isFamilyPilotRef(value: unknown): value is string {
  return isRef(value)
}

function isNullableRef(value: unknown): value is string | null {
  return value === null || isRef(value)
}

function refList(value: unknown, max: number): readonly string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  if (!value.every(isRef)) return null
  if (new Set(value as string[]).size !== value.length) return null
  return Object.freeze([...(value as string[])])
}

function parseProgress(value: unknown): FamilyPilotProgressV1 | null {
  if (!isRecord(value)) return null
  const completedSegmentRefs = refList(value.completedSegmentRefs, MAX_SEGMENTS)
  if (
    !completedSegmentRefs ||
    !isCount(value.totalSegments, MAX_SEGMENTS) ||
    !isNullableRef(value.lastSegmentRef) ||
    !isCount(value.activeSeconds, Number.MAX_SAFE_INTEGER)
  ) return null
  return Object.freeze({
    completedSegmentRefs,
    totalSegments: value.totalSegments,
    lastSegmentRef: value.lastSegmentRef,
    activeSeconds: value.activeSeconds,
  })
}

function parsePause(value: unknown): FamilyPilotPauseV1 | null {
  if (!isRecord(value)) return null
  if (
    !(value.pausedAt === null || isInstant(value.pausedAt)) ||
    !(value.resumedAt === null || isInstant(value.resumedAt)) ||
    !isCount(value.pausedSeconds, Number.MAX_SAFE_INTEGER) ||
    !isNullableRef(value.resumeSegmentRef)
  ) return null
  return Object.freeze({
    pausedAt: value.pausedAt as string | null,
    resumedAt: value.resumedAt as string | null,
    pausedSeconds: value.pausedSeconds,
    resumeSegmentRef: value.resumeSegmentRef,
  })
}

/** Normalizes an absent field to null so a partially written record is not
 *  treated differently from one that stored an explicit null. */
function orNull(value: unknown): unknown {
  return value === undefined ? null : value
}

/**
 * Parses the completion/attestation block against the assignment it was found
 * on. This is where a forged certification dies.
 *
 * Three checks do the work:
 *
 *   • `state === 'completed'` and `status === 'CERTIFIED'` must agree. They are
 *     one fact, not two, so a hand-edited record that flips the state to
 *     completed without a certification — or carries a certification without
 *     the state — is refused rather than reconciled in either direction.
 *   • A guardian certification must carry a whole attestation: an instant, an
 *     adult ref, an evidence mode, and the binding triple.
 *   • The binding must name THIS assignment and THIS lesson. A certification
 *     earned for yesterday's lesson cannot be replayed against today's.
 *
 * Anything else clears every attestation field, so there is no partial state a
 * caller could mistake for a certification.
 */
function parseCompletion(
  value: unknown,
  bound: {
    readonly assignmentRef: string
    readonly lessonRef: string
    readonly state: FamilyPilotAssignmentState
    readonly sourceVersion: number
  },
): FamilyPilotCompletionRecordV1 | null {
  if (orNull(value) === null) {
    // At version 2 every record carries this block, so its absence means the
    // record was stripped. Refusing it is what stops "delete one key" from
    // being a way to certify guardian work: all the checks below live on this
    // side of the branch, and a tolerated absence would skip every one of them.
    if (bound.sourceVersion >= FAMILY_PILOT_SCHEMA_VERSION) return null
    // A genuine version 1 record predates completion authority. Whatever it
    // completed, it completed under the only authority that build had.
    return bound.state === 'completed'
      ? Object.freeze({ ...emptyFamilyPilotCompletion(), status: 'CERTIFIED' as const })
      : emptyFamilyPilotCompletion()
  }
  if (!isRecord(value)) return null

  const authority = value.authority as FamilyPilotCompletionAuthority
  const status = value.status as FamilyPilotCompletionStatus
  if (!FAMILY_PILOT_COMPLETION_AUTHORITIES.includes(authority)) return null
  if (!FAMILY_PILOT_COMPLETION_STATUSES.includes(status)) return null

  const learnerAssertedAt = orNull(value.learnerAssertedAt)
  if (!(learnerAssertedAt === null || isInstant(learnerAssertedAt))) return null

  const guardian = authority === 'GUARDIAN_ATTESTATION_REQUIRED'
  const certified = status === 'CERTIFIED'
  const pending = status === 'PENDING_GUARDIAN_ATTESTATION'
  if (certified !== (bound.state === 'completed')) return null
  if (pending && !guardian) return null
  // Pending means the learner already said they were finished. A pending record
  // with no learner assertion is not a state this runtime can produce.
  if (pending && learnerAssertedAt === null) return null

  const attestedAt = orNull(value.attestedAt)
  const attestedByRef = orNull(value.attestedByRef)
  const evidenceMode = orNull(value.evidenceMode)
  const attestedStudentRef = orNull(value.attestedStudentRef)
  const attestedAssignmentRef = orNull(value.attestedAssignmentRef)
  const attestedLessonRef = orNull(value.attestedLessonRef)

  if (guardian && certified) {
    if (
      !isInstant(attestedAt) ||
      !isRef(attestedByRef) ||
      !FAMILY_PILOT_ATTESTATION_EVIDENCE.includes(evidenceMode as FamilyPilotAttestationEvidence) ||
      !isRef(attestedStudentRef) ||
      attestedAssignmentRef !== bound.assignmentRef ||
      attestedLessonRef !== bound.lessonRef
    ) return null
    return Object.freeze({
      authority,
      status,
      learnerAssertedAt: learnerAssertedAt as string | null,
      attestedAt,
      attestedByRef,
      evidenceMode: evidenceMode as FamilyPilotAttestationEvidence,
      attestedStudentRef,
      attestedAssignmentRef,
      attestedLessonRef,
    })
  }

  // Not a guardian certification: every attestation field must be empty. A
  // record carrying half an attestation is refused, never trimmed into one.
  if (
    attestedAt !== null || attestedByRef !== null || evidenceMode !== null ||
    attestedStudentRef !== null || attestedAssignmentRef !== null || attestedLessonRef !== null
  ) return null
  return Object.freeze({
    ...emptyFamilyPilotCompletion(authority),
    status,
    learnerAssertedAt: learnerAssertedAt as string | null,
  })
}

export function parseFamilyPilotAssignment(
  value: unknown,
  sourceVersion: number = FAMILY_PILOT_SCHEMA_VERSION,
): FamilyPilotAssignmentRecordV1 | null {
  if (!isRecord(value)) return null
  const progress = parseProgress(value.progress)
  const pause = parsePause(value.pause)
  if (
    !progress || !pause ||
    !isRef(value.assignmentRef) || !isRef(value.lessonRef) ||
    !isDisplayText(value.subject) || !isDisplayText(value.title) ||
    !FAMILY_PILOT_ASSIGNMENT_STATES.includes(value.state as FamilyPilotAssignmentState) ||
    !isNullableRef(value.sessionRef) ||
    !(value.completedAt === null || isInstant(value.completedAt)) ||
    !isInstant(value.createdAt) || !isInstant(value.updatedAt) ||
    // A stored record that claims to carry learner prose is refused outright.
    value.rawAnswerIncluded !== false || value.transcriptIncluded !== false
  ) return null
  // Parsed last, because it is checked AGAINST the fields above: the binding is
  // only meaningful once this record's own assignment ref, lesson ref and state
  // are known to be readable.
  const completion = parseCompletion(value.completion, {
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    state: value.state as FamilyPilotAssignmentState,
    sourceVersion,
  })
  if (!completion) return null
  return Object.freeze({
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    subject: value.subject,
    title: value.title,
    state: value.state as FamilyPilotAssignmentState,
    sessionRef: value.sessionRef,
    progress,
    pause,
    completion,
    completedAt: value.completedAt as string | null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

export function parseFamilyPilotStudent(
  value: unknown,
  sourceVersion: number = FAMILY_PILOT_SCHEMA_VERSION,
): FamilyPilotStudentRecordV1 | null {
  if (!isRecord(value)) return null
  if (
    !isRef(value.studentRef) || !isDisplayText(value.displayName) ||
    !isInstant(value.createdAt) || !isInstant(value.updatedAt) ||
    !isNullableRef(value.activeAssignmentRef) ||
    !Array.isArray(value.assignments) ||
    value.assignments.length > MAX_ASSIGNMENTS_PER_STUDENT
  ) return null
  const assignments: FamilyPilotAssignmentRecordV1[] = []
  for (const item of value.assignments) {
    const assignment = parseFamilyPilotAssignment(item, sourceVersion)
    // One unreadable assignment must not cost the student their whole history.
    if (!assignment || assignments.some((held) => held.assignmentRef === assignment.assignmentRef)) {
      continue
    }
    // The third leg of the attestation binding. Assignment refs are derived
    // from the lesson, so siblings carry the SAME ref for the same lesson —
    // which makes a certification earned by one child structurally pasteable
    // into the other's record. A binding that names a different child is
    // refused here, and the assignment is dropped rather than honoured; the
    // work is re-seeded as fresh, which is the safe direction to fail.
    if (
      assignment.completion.attestedStudentRef !== null &&
      assignment.completion.attestedStudentRef !== value.studentRef
    ) {
      continue
    }
    assignments.push(assignment)
  }
  const activeAssignmentRef = assignments.some(
    (item) => item.assignmentRef === value.activeAssignmentRef,
  ) ? value.activeAssignmentRef : null
  return Object.freeze({
    studentRef: value.studentRef,
    displayName: value.displayName,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    activeAssignmentRef,
    assignments: Object.freeze(assignments),
  })
}

export function emptyFamilyPilotState(now: string): FamilyPilotStateV1 {
  return Object.freeze({
    schemaVersion: FAMILY_PILOT_SCHEMA_VERSION,
    updatedAt: now,
    activeStudentRef: null,
    students: Object.freeze([]),
  })
}

/**
 * Total parser: any input at all yields either a state or null. Never throws.
 * A duplicated studentRef keeps the first record only — two records claiming one
 * student would silently merge two children's work.
 */
export function parseFamilyPilotState(value: unknown): FamilyPilotStateV1 | null {
  if (!isRecord(value)) return null
  if (!READABLE_SCHEMA_VERSIONS.includes(value.schemaVersion as number)) return null
  const sourceVersion = value.schemaVersion as number
  if (!isInstant(value.updatedAt)) return null
  if (!isNullableRef(value.activeStudentRef)) return null
  if (!Array.isArray(value.students) || value.students.length > MAX_STUDENTS) return null
  const students: FamilyPilotStudentRecordV1[] = []
  for (const item of value.students) {
    const student = parseFamilyPilotStudent(item, sourceVersion)
    if (student && !students.some((held) => held.studentRef === student.studentRef)) {
      students.push(student)
    }
  }
  // A pointer to a student who did not survive parsing becomes idle, never a
  // dangling ref that another student's record could later be matched against.
  const activeStudentRef = students.some((item) => item.studentRef === value.activeStudentRef)
    ? value.activeStudentRef
    : null
  return Object.freeze({
    schemaVersion: FAMILY_PILOT_SCHEMA_VERSION,
    updatedAt: value.updatedAt,
    activeStudentRef,
    students: Object.freeze(students),
  })
}

export type FamilyPilotSchemaReasonCode =
  | 'schema-version-ahead'
  | 'schema-unreadable'

export type FamilyPilotUpgradeOutcome =
  | { readonly status: 'current'; readonly state: FamilyPilotStateV1 }
  | { readonly status: 'unreadable'; readonly reasonCode: FamilyPilotSchemaReasonCode }

/**
 * Deterministic schema upgrade.
 *
 * Version 1 states are read and rewritten as version 2 by parseFamilyPilotState
 * itself: the only difference between them is the completion block, and a v1
 * record's absent block has an exact v2 meaning (see parseCompletion). So both
 * report 'current' and the household's work is carried forward untouched.
 *
 * A state written by a NEWER build is reported as 'schema-version-ahead' rather
 * than parsed or discarded, so the caller can fail to a recoverable read-only
 * state instead of overwriting a future schema it does not understand.
 */
export function upgradeFamilyPilotState(value: unknown): FamilyPilotUpgradeOutcome {
  const current = parseFamilyPilotState(value)
  if (current) return { status: 'current', state: current }
  if (isRecord(value) && isCount(value.schemaVersion, Number.MAX_SAFE_INTEGER) &&
      (value.schemaVersion as number) > FAMILY_PILOT_SCHEMA_VERSION) {
    return { status: 'unreadable', reasonCode: 'schema-version-ahead' }
  }
  return { status: 'unreadable', reasonCode: 'schema-unreadable' }
}
