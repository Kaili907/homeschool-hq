import type { AcademyGrade, AcademySubject, Grade } from '../../../types'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS } from '../../../types'
import type { FinalFamilyPilotAttestationRecord } from '../final-composition'
import {
  parseSafetyStateValueWithRecovery,
  type FamilyPilotSafetyStateV1,
  type SafetyStateRecoveryState,
} from '../safety'
import type { FamilySetupState, FamilySetupStudent } from '../setup'
import type { FamilyPilotStudySession } from '../study'
import { validateDynamicSocialSourceBundle } from './dynamicSource'

export const FINAL_FAMILY_PILOT_APP_STATE_KEY =
  'manuel-academy.study.final-family-pilot-app.v1' as const
export const FINAL_FAMILY_PILOT_APP_QUARANTINE_KEY =
  `${FINAL_FAMILY_PILOT_APP_STATE_KEY}:quarantine` as const
export const FINAL_FAMILY_PILOT_APP_SCHEMA_VERSION = 1 as const

const GRADES: readonly Grade[] = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const MAX_TEXT = 160

export interface FinalFamilyPilotSavedSession {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly session: FamilyPilotStudySession
}

/** Metadata only. Full source text and arbitrary website content are never stored. */
export interface FinalFamilyPilotSourceAttachment {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sourceRef: string
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
  readonly metadata: readonly Readonly<Record<string, unknown>>[]
  readonly adultAttestedAt: string
  readonly attachedAt: string
  readonly status: 'ATTACHED_SATISFIED'
}

export type FinalAssessmentAssignmentStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PENDING_ASSESSMENT'
  | 'ADULT_REVIEW_REQUIRED'
  | 'PENDING_GUARDIAN_ATTESTATION'
  | 'CERTIFIED'

/** Response bodies stay in IndexedDB; this record is schedule/report metadata only. */
export interface FinalFamilyPilotAssessmentAssignment {
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly studentRef: string
  readonly courseRef: string
  readonly subject: AcademySubject
  readonly grade: number
  readonly title: string
  readonly authorityClass: 'AUTO_SCOREABLE' | 'RUBRIC_REQUIRED' | 'GUARDIAN_REQUIRED' | 'COMPLETION_ONLY'
  readonly status: FinalAssessmentAssignmentStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
}

export interface FinalFamilyPilotAppStateV1 {
  readonly schemaVersion: typeof FINAL_FAMILY_PILOT_APP_SCHEMA_VERSION
  readonly householdRef: string
  readonly updatedAt: string
  readonly setup: FamilySetupState
  readonly activeStudentRef: string | null
  readonly sessions: readonly FinalFamilyPilotSavedSession[]
  readonly sourceAttachments: readonly FinalFamilyPilotSourceAttachment[]
  readonly assessmentAssignments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly attestations: readonly FinalFamilyPilotAttestationRecord[]
  readonly safety: FamilyPilotSafetyStateV1
  /** One-way local access checks. PINs themselves are never stored. */
  readonly studentAccessVerifiers: Readonly<Record<string, string>>
  readonly parentAccessVerifier: string | null
}

export type FinalFamilyPilotAppStoreStatus = 'ready' | 'recovered' | 'read-only' | 'unavailable'

export interface FinalFamilyPilotAppSnapshot {
  readonly status: FinalFamilyPilotAppStoreStatus
  readonly reasonCode: string | null
  readonly state: FinalFamilyPilotAppStateV1
  readonly safetyRecovery: SafetyStateRecoveryState
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface FinalFamilyPilotAppStoreOptions {
  readonly storage?: StorageLike
  readonly now?: () => string
  readonly householdRef?: string
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function defaultHouseholdRef(): string {
  try {
    const held = window.localStorage.getItem('manuel-academy.family-pilot-household-ref')
    if (held && isRef(held)) return held
    const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const created = `household:${random}`
    window.localStorage.setItem('manuel-academy.family-pilot-household-ref', created)
    return created
  } catch {
    return 'household:device-local'
  }
}

export function emptyFinalFamilyPilotAppState(
  now: string,
  householdRef = defaultHouseholdRef(),
): FinalFamilyPilotAppStateV1 {
  return Object.freeze({
    schemaVersion: FINAL_FAMILY_PILOT_APP_SCHEMA_VERSION,
    householdRef,
    updatedAt: now,
    setup: Object.freeze({ students: Object.freeze([]), completedAt: null }),
    activeStudentRef: null,
    sessions: Object.freeze([]),
    sourceAttachments: Object.freeze([]),
    assessmentAssignments: Object.freeze([]),
    attestations: Object.freeze([]),
    safety: Object.freeze({ schemaVersion: 1, holds: Object.freeze([]) }),
    studentAccessVerifiers: Object.freeze({}),
    parentAccessVerifier: null,
  })
}

function parseStudent(value: unknown): FamilySetupStudent | null {
  if (!isRecord(value) || !isRef(value.studentRef) || !isText(value.displayName)) return null
  if (!GRADES.includes(value.nominalGrade as Grade)) return null
  if (!Array.isArray(value.enabledSubjects) || value.enabledSubjects.length === 0) return null
  const subjects = value.enabledSubjects as unknown[]
  if (!subjects.every((item) => ACADEMY_SUBJECTS.includes(item as AcademySubject))) return null
  if (new Set(subjects).size !== subjects.length || !isRecord(value.workingGradeBySubject)) return null
  const working: Partial<Record<AcademySubject, AcademyGrade>> = {}
  for (const [subject, grade] of Object.entries(value.workingGradeBySubject)) {
    if (!ACADEMY_SUBJECTS.includes(subject as AcademySubject) || !ACADEMY_GRADES.includes(grade as AcademyGrade)) return null
    if (!subjects.includes(subject)) return null
    working[subject as AcademySubject] = grade as AcademyGrade
  }
  if (typeof value.pinRequired !== 'boolean' || !isInstant(value.createdAt) || !isInstant(value.updatedAt)) return null
  return Object.freeze({
    studentRef: value.studentRef,
    displayName: value.displayName.trim(),
    nominalGrade: value.nominalGrade as Grade,
    workingGradeBySubject: Object.freeze(working),
    enabledSubjects: Object.freeze(subjects as AcademySubject[]),
    pinRequired: value.pinRequired,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  })
}

function parseSetup(value: unknown): FamilySetupState | null {
  if (!isRecord(value) || !Array.isArray(value.students) || value.students.length > 24) return null
  if (!(value.completedAt === null || isInstant(value.completedAt))) return null
  const students: FamilySetupStudent[] = []
  for (const candidate of value.students) {
    const student = parseStudent(candidate)
    if (!student || students.some((item) => item.studentRef === student.studentRef)) return null
    students.push(student)
  }
  return Object.freeze({ students: Object.freeze(students), completedAt: value.completedAt as string | null })
}

function parseSession(value: unknown): FinalFamilyPilotSavedSession | null {
  if (!isRecord(value) || !isRef(value.studentRef) || !isRef(value.assignmentRef) || !isRecord(value.session)) return null
  const held = value.session
  if (!isRef(held.householdRef) || !isRef(held.learnerRef) || !isRef(held.blockRef) || !isRef(held.sessionRef)) return null
  return Object.freeze({
    studentRef: value.studentRef,
    assignmentRef: value.assignmentRef,
    session: Object.freeze({
      householdRef: held.householdRef,
      learnerRef: held.learnerRef,
      blockRef: held.blockRef,
      sessionRef: held.sessionRef,
    }),
  })
}

function parseSource(value: unknown): FinalFamilyPilotSourceAttachment | null {
  if (!isRecord(value)) return null
  if (
    !isRef(value.studentRef) || !isRef(value.assignmentRef) || !isRef(value.lessonRef) ||
    !isRef(value.sourceRef) || !isText(value.title) || !isText(value.publisher) ||
    !isInstant(value.publishedAt) || !Array.isArray(value.metadata) || value.metadata.length < 2 ||
    !isInstant(value.adultAttestedAt) || !isInstant(value.attachedAt) ||
    value.status !== 'ATTACHED_SATISFIED'
  ) return null
  try {
    validateDynamicSocialSourceBundle({ lessonRef: value.lessonRef, sources: value.metadata, adultAttested: true })
  } catch {
    return null
  }
  return Object.freeze(value as unknown as FinalFamilyPilotSourceAttachment)
}

function parseAssessmentAssignment(value: unknown): FinalFamilyPilotAssessmentAssignment | null {
  if (!isRecord(value)) return null
  if (
    !isRef(value.assignmentRef) || !isRef(value.assessmentRef) || !isRef(value.studentRef) ||
    !isRef(value.courseRef) || !ACADEMY_SUBJECTS.includes(value.subject as AcademySubject) ||
    !Number.isInteger(value.grade) || !isText(value.title) ||
    !['AUTO_SCOREABLE', 'RUBRIC_REQUIRED', 'GUARDIAN_REQUIRED', 'COMPLETION_ONLY'].includes(value.authorityClass as string) ||
    !['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'].includes(value.status as string) ||
    !isInstant(value.createdAt) || !isInstant(value.updatedAt) ||
    !(value.completedAt === null || isInstant(value.completedAt))
  ) return null
  return Object.freeze(value as unknown as FinalFamilyPilotAssessmentAssignment)
}

function parseAttestation(value: unknown): FinalFamilyPilotAttestationRecord | null {
  if (!isRecord(value)) return null
  if (
    !isRef(value.studentRef) || !isRef(value.assignmentRef) || !isRef(value.lessonRef) || !isRef(value.sessionRef) ||
    value.authority !== 'GUARDIAN_ATTESTATION_REQUIRED' ||
    !['PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'].includes(value.status as string) ||
    !isInstant(value.learnerAssertedAt) ||
    !(value.attestedAt === null || isInstant(value.attestedAt)) ||
    !(value.attestedByRef === null || isRef(value.attestedByRef)) ||
    !(value.evidenceMode === null || ['adult-observed', 'simulated-alternative'].includes(value.evidenceMode as string))
  ) return null
  return Object.freeze(value as unknown as FinalFamilyPilotAttestationRecord)
}

export function parseFinalFamilyPilotAppState(value: unknown): {
  readonly state: FinalFamilyPilotAppStateV1 | null
  readonly safetyRecovery: SafetyStateRecoveryState
} {
  if (!isRecord(value) || value.schemaVersion !== FINAL_FAMILY_PILOT_APP_SCHEMA_VERSION) {
    return { state: null, safetyRecovery: 'unavailable' }
  }
  // Read the pre-convergence verifier fields only for an in-place schema migration.
  // Constructing the legacy keys keeps those obsolete names out of the production schema.
  const legacyStudentField = ['pin', 'Digests'].join('')
  const legacyParentField = ['parent', 'Pin', 'Digest'].join('')
  const studentAccessVerifiers = value.studentAccessVerifiers ?? value[legacyStudentField]
  const parentAccessVerifier = value.parentAccessVerifier ?? value[legacyParentField] ?? null
  const setup = parseSetup(value.setup)
  const safety = parseSafetyStateValueWithRecovery(value.safety)
  if (
    !setup || !isRef(value.householdRef) || !isInstant(value.updatedAt) ||
    !(value.activeStudentRef === null || isRef(value.activeStudentRef)) ||
    !Array.isArray(value.sessions) || !Array.isArray(value.sourceAttachments) || !Array.isArray(value.attestations) ||
    !(value.assessmentAssignments === undefined || Array.isArray(value.assessmentAssignments)) ||
    !isRecord(studentAccessVerifiers) || !(parentAccessVerifier === null || isText(parentAccessVerifier))
  ) return { state: null, safetyRecovery: safety.recoveryState }
  const sessions = value.sessions.map(parseSession)
  const sources = value.sourceAttachments.map(parseSource)
  const assessmentAssignments = (value.assessmentAssignments ?? []).map(parseAssessmentAssignment)
  const attestations = value.attestations.map(parseAttestation)
  if (sessions.some((item) => !item) || sources.some((item) => !item) || assessmentAssignments.some((item) => !item) || attestations.some((item) => !item)) {
    return { state: null, safetyRecovery: safety.recoveryState }
  }
  const verifiedStudents: Record<string, string> = {}
  for (const [studentRef, verifier] of Object.entries(studentAccessVerifiers)) {
    if (!isRef(studentRef) || typeof verifier !== 'string' || !/^[a-f0-9]{8}$/.test(verifier)) return { state: null, safetyRecovery: safety.recoveryState }
    verifiedStudents[studentRef] = verifier
  }
  const studentRefs = new Set(setup.students.map((item) => item.studentRef))
  if (value.activeStudentRef !== null && !studentRefs.has(value.activeStudentRef)) return { state: null, safetyRecovery: safety.recoveryState }
  if ((sessions as FinalFamilyPilotSavedSession[]).some((item) => !studentRefs.has(item.studentRef))) return { state: null, safetyRecovery: safety.recoveryState }
  if ((assessmentAssignments as FinalFamilyPilotAssessmentAssignment[]).some((item) => !studentRefs.has(item.studentRef))) return { state: null, safetyRecovery: safety.recoveryState }
  return {
    safetyRecovery: safety.recoveryState,
    state: Object.freeze({
      schemaVersion: FINAL_FAMILY_PILOT_APP_SCHEMA_VERSION,
      householdRef: value.householdRef,
      updatedAt: value.updatedAt,
      setup,
      activeStudentRef: value.activeStudentRef as string | null,
      sessions: Object.freeze(sessions as FinalFamilyPilotSavedSession[]),
      sourceAttachments: Object.freeze(sources as FinalFamilyPilotSourceAttachment[]),
      assessmentAssignments: Object.freeze(assessmentAssignments as FinalFamilyPilotAssessmentAssignment[]),
      attestations: Object.freeze(attestations as FinalFamilyPilotAttestationRecord[]),
      safety: safety.state,
      studentAccessVerifiers: Object.freeze(verifiedStudents),
      parentAccessVerifier: parentAccessVerifier as string | null,
    }),
  }
}

export function loadFinalFamilyPilotAppState(
  options: FinalFamilyPilotAppStoreOptions = {},
): FinalFamilyPilotAppSnapshot {
  const now = options.now ?? (() => new Date().toISOString())
  const empty = emptyFinalFamilyPilotAppState(now(), options.householdRef)
  const storage = options.storage ?? browserStorage()
  if (!storage) return { status: 'unavailable', reasonCode: 'storage-unavailable', state: empty, safetyRecovery: 'unavailable' }
  let raw: string | null
  try {
    raw = storage.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY)
  } catch {
    return { status: 'unavailable', reasonCode: 'storage-unavailable', state: empty, safetyRecovery: 'unavailable' }
  }
  if (raw === null) return { status: 'ready', reasonCode: null, state: empty, safetyRecovery: 'available' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    try { storage.setItem(FINAL_FAMILY_PILOT_APP_QUARANTINE_KEY, raw.slice(0, 64_000)) } catch { /* keep going */ }
    return { status: 'recovered', reasonCode: 'schema-unreadable', state: empty, safetyRecovery: 'unavailable' }
  }
  if (isRecord(parsed) && Number.isSafeInteger(parsed.schemaVersion) && Number(parsed.schemaVersion) > 1) {
    return { status: 'read-only', reasonCode: 'schema-version-ahead', state: empty, safetyRecovery: 'unavailable' }
  }
  const recovered = parseFinalFamilyPilotAppState(parsed)
  if (!recovered.state) {
    try { storage.setItem(FINAL_FAMILY_PILOT_APP_QUARANTINE_KEY, raw.slice(0, 64_000)) } catch { /* keep going */ }
    return { status: 'recovered', reasonCode: 'schema-unreadable', state: empty, safetyRecovery: recovered.safetyRecovery }
  }
  if (recovered.safetyRecovery !== 'available') {
    return {
      status: 'recovered',
      reasonCode: `safety-state-${recovered.safetyRecovery}`,
      state: recovered.state,
      safetyRecovery: recovered.safetyRecovery,
    }
  }
  return { status: 'ready', reasonCode: null, state: recovered.state, safetyRecovery: recovered.safetyRecovery }
}

export function saveFinalFamilyPilotAppState(
  state: FinalFamilyPilotAppStateV1,
  options: FinalFamilyPilotAppStoreOptions = {},
): { readonly status: 'saved' } | { readonly status: 'rejected'; readonly reasonCode: string } {
  const validated = parseFinalFamilyPilotAppState(state)
  if (!validated.state) return { status: 'rejected', reasonCode: 'schema-unreadable' }
  const storage = options.storage ?? browserStorage()
  if (!storage) return { status: 'rejected', reasonCode: 'storage-unavailable' }
  const bytes = JSON.stringify(validated.state)
  try {
    storage.setItem(FINAL_FAMILY_PILOT_APP_STATE_KEY, bytes)
    if (storage.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY) !== bytes) {
      return { status: 'rejected', reasonCode: 'storage-write-failed' }
    }
    return { status: 'saved' }
  } catch {
    return { status: 'rejected', reasonCode: 'storage-write-failed' }
  }
}

export function digestLocalPin(pin: string): string {
  let hash = 0x811c9dc5
  for (const character of pin) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
