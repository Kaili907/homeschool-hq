export const STUDY_SESSION_IDENTITY_SCHEMA_VERSION = 1 as const
export const STUDY_SESSION_ISSUER_VERSION = 'academy-student-session-issuer.v1' as const

export type StudyStudentCapability =
  | 'student:assignments:read'
  | 'student:attempts:create'
  | 'student:progress:read'

/** A selector only; household and guardian authority are always server-derived. */
export type StudyLearnerSelector =
  | Readonly<{ kind: 'academy-student-id'; value: string }>
  | Readonly<{ kind: 'legacy-profile-id'; value: string }>

export interface StudySessionGrant {
  readonly schemaVersion: typeof STUDY_SESSION_IDENTITY_SCHEMA_VERSION
  readonly status: 'issued'
  /** Opaque, short-lived reference. Keep in memory; never persist in browser storage. */
  readonly sessionReference: string
  readonly grantId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly sessionEpoch: string
  readonly authorizationRevision: number
  readonly issuedAt: string
  readonly expiresAt: string
  readonly contractVersion: 1
  readonly issuerVersion: typeof STUDY_SESSION_ISSUER_VERSION
  readonly scope: readonly StudyStudentCapability[]
}

export interface VerifiedStudySession {
  readonly schemaVersion: typeof STUDY_SESSION_IDENTITY_SCHEMA_VERSION
  readonly status: 'verified'
  readonly grantId: string
  readonly householdId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly sessionEpoch: string
  readonly sessionVersion: number
  readonly authorizationRevision: number
  readonly issuedAt: string
  readonly expiresAt: string
  readonly contractVersion: 1
  readonly issuerVersion: typeof STUDY_SESSION_ISSUER_VERSION
  readonly scope: readonly StudyStudentCapability[]
}

export type StudyStaffAuthorizationResult = Readonly<{
  status: 'not-ready'
  code: 'staff-authorization-unavailable'
}>

/** No approved staff role/permission governance exists in the repository. */
export const STUDY_STAFF_AUTHORIZATION_UNAVAILABLE: StudyStaffAuthorizationResult = Object.freeze({
  status: 'not-ready',
  code: 'staff-authorization-unavailable',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SESSION_REFERENCE = /^aca_stu_v1_[A-Za-z0-9_-]{43}$/
const CAPABILITIES = new Set<StudyStudentCapability>([
  'student:assignments:read',
  'student:attempts:create',
  'student:progress:read',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isCapability(value: unknown): value is StudyStudentCapability {
  return typeof value === 'string' && CAPABILITIES.has(value as StudyStudentCapability)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

export function parseStudySessionGrant(value: unknown): StudySessionGrant | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.status !== 'issued') return null
  if (
    !hasExactKeys(value, [
      'schemaVersion', 'status', 'sessionReference', 'grantId', 'studentId',
      'learnerSessionId', 'sessionEpoch', 'authorizationRevision', 'issuedAt',
      'expiresAt', 'contractVersion', 'issuerVersion', 'scope',
    ]) ||
    typeof value.sessionReference !== 'string' || !SESSION_REFERENCE.test(value.sessionReference) ||
    typeof value.grantId !== 'string' || !UUID.test(value.grantId) ||
    typeof value.studentId !== 'string' || !UUID.test(value.studentId) ||
    typeof value.learnerSessionId !== 'string' || !UUID.test(value.learnerSessionId) ||
    value.learnerSessionId !== value.sessionEpoch ||
    !Number.isSafeInteger(value.authorizationRevision) || Number(value.authorizationRevision) < 1 ||
    typeof value.issuedAt !== 'string' || !Number.isFinite(Date.parse(value.issuedAt)) ||
    typeof value.expiresAt !== 'string' || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
    value.contractVersion !== 1 || value.issuerVersion !== STUDY_SESSION_ISSUER_VERSION ||
    !Array.isArray(value.scope) || value.scope.length !== 3 || !value.scope.every(isCapability)
  ) return null
  return value as unknown as StudySessionGrant
}

export function parseVerifiedStudySession(value: unknown): VerifiedStudySession | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.status !== 'verified') return null
  if (
    !hasExactKeys(value, [
      'schemaVersion', 'status', 'grantId', 'householdId', 'studentId',
      'learnerSessionId', 'sessionEpoch', 'sessionVersion',
      'authorizationRevision', 'issuedAt', 'expiresAt', 'contractVersion',
      'issuerVersion', 'scope',
    ]) ||
    typeof value.grantId !== 'string' || !UUID.test(value.grantId) ||
    typeof value.householdId !== 'string' || !UUID.test(value.householdId) ||
    typeof value.studentId !== 'string' || !UUID.test(value.studentId) ||
    typeof value.learnerSessionId !== 'string' || !UUID.test(value.learnerSessionId) ||
    value.learnerSessionId !== value.sessionEpoch ||
    !Number.isSafeInteger(value.sessionVersion) || Number(value.sessionVersion) < 1 ||
    !Number.isSafeInteger(value.authorizationRevision) || Number(value.authorizationRevision) < 1 ||
    typeof value.issuedAt !== 'string' || !Number.isFinite(Date.parse(value.issuedAt)) ||
    typeof value.expiresAt !== 'string' || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
    value.contractVersion !== 1 || value.issuerVersion !== STUDY_SESSION_ISSUER_VERSION ||
    !Array.isArray(value.scope) || value.scope.length < 1 ||
    new Set(value.scope).size !== value.scope.length || !value.scope.every(isCapability)
  ) return null
  return value as unknown as VerifiedStudySession
}
