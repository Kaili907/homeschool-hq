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

export const FAMILY_PILOT_SCHEMA_VERSION = 1 as const

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

export function parseFamilyPilotAssignment(value: unknown): FamilyPilotAssignmentRecordV1 | null {
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
  return Object.freeze({
    assignmentRef: value.assignmentRef,
    lessonRef: value.lessonRef,
    subject: value.subject,
    title: value.title,
    state: value.state as FamilyPilotAssignmentState,
    sessionRef: value.sessionRef,
    progress,
    pause,
    completedAt: value.completedAt as string | null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

export function parseFamilyPilotStudent(value: unknown): FamilyPilotStudentRecordV1 | null {
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
    const assignment = parseFamilyPilotAssignment(item)
    // One unreadable assignment must not cost the student their whole history.
    if (assignment && !assignments.some((held) => held.assignmentRef === assignment.assignmentRef)) {
      assignments.push(assignment)
    }
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
  if (value.schemaVersion !== FAMILY_PILOT_SCHEMA_VERSION) return null
  if (!isInstant(value.updatedAt)) return null
  if (!isNullableRef(value.activeStudentRef)) return null
  if (!Array.isArray(value.students) || value.students.length > MAX_STUDENTS) return null
  const students: FamilyPilotStudentRecordV1[] = []
  for (const item of value.students) {
    const student = parseFamilyPilotStudent(item)
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
 * Deterministic schema upgrade. Version 1 is the only shipped version, so the
 * only paths are "already current" and "not readable by this build".
 *
 * A state written by a NEWER build is reported as 'schema-version-ahead' rather
 * than parsed or discarded, so the caller can fail to a recoverable read-only
 * state instead of overwriting a future schema it does not understand. Adding
 * version 2 means adding one branch here that rewrites v1 into v2 — the caller
 * contract does not change.
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
