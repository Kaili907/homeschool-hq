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
  readonly expiresAt: string
}

export interface VerifiedStudySession {
  readonly schemaVersion: typeof STUDY_SESSION_IDENTITY_SCHEMA_VERSION
  readonly status: 'verified'
  readonly expiresAt: string
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

const SESSION_REFERENCE = /^aca_stu_v1_[A-Za-z0-9_-]{43}$/
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

export function parseStudySessionGrant(value: unknown): StudySessionGrant | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.status !== 'issued') return null
  if (
    !hasExactKeys(value, ['schemaVersion', 'status', 'sessionReference', 'expiresAt']) ||
    typeof value.sessionReference !== 'string' || !SESSION_REFERENCE.test(value.sessionReference) ||
    typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
  ) return null
  return value as unknown as StudySessionGrant
}

export function parseVerifiedStudySession(value: unknown): VerifiedStudySession | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.status !== 'verified') return null
  if (
    !hasExactKeys(value, ['schemaVersion', 'status', 'expiresAt']) ||
    typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
  ) return null
  return value as unknown as VerifiedStudySession
}
