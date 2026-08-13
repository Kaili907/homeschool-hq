import type { AcademyGrade, AcademySubject, Grade } from '../../../types'
import type { StudyLearnerSelector } from '../../contracts/identity/session'

export const HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION = 1 as const
export const STUDY_SESSION_HEADER = 'x-study-session' as const

/** These labels make it difficult for convergence code to confuse local data with server authority. */
export const DEVICE_LOCAL_IDENTITY_STATE = 'device-local-identity-state' as const
export const HOSTED_AUTHORITY_STATE = 'hosted-authority-state' as const

export type HostedAdultAuthenticationState = 'signed-out' | 'expired' | 'revoked'

export interface HostedStudentProfile {
  /** A hosted student is always a stable Academy student id, never a local profile id. */
  readonly studentRef: Readonly<{ kind: 'academy-student-id'; value: string }>
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly workingGradeBySubject: Readonly<Partial<Record<AcademySubject, AcademyGrade>>>
  readonly enabledSubjects: readonly AcademySubject[]
  /** The PIN remains a device-local access check; this is configuration only. */
  readonly pinRequired: boolean
  readonly configRevision: number
}

export interface AuthenticatedAdultIdentity {
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly adultRef: string
  readonly expiresAt: string
}

export interface AuthorizedHouseholdIdentity {
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly adultRef: string
  readonly householdRef: string
  readonly relationship: 'parent' | 'guardian'
  readonly authorityRevision: number
  readonly expiresAt: string
}

export interface ResolvedHostedFamilyAuthority {
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly adult: AuthenticatedAdultIdentity
  readonly household: AuthorizedHouseholdIdentity
  readonly students: readonly HostedStudentProfile[]
}

/**
 * Wire projection supplied by a future hosted provider. It deliberately has no
 * access token, refresh token, email address, membership id, or provider name.
 */
export type HostedFamilyAuthorityEnvelope =
  | Readonly<{
      schemaVersion: typeof HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION
      status: 'authorized'
      adult: Readonly<{ adultRef: string }>
      household: Readonly<{
        householdRef: string
        relationship: 'parent' | 'guardian'
        authorityRevision: number
      }>
      students: readonly HostedStudentProfile[]
      expiresAt: string
    }>
  | Readonly<{
      schemaVersion: typeof HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION
      status: HostedAdultAuthenticationState | 'unavailable'
    }>

/**
 * Credential-bearing output exists only for the duration of one request. The
 * bridge never retains this envelope after it has built a fresh header map.
 */
export type HostedAdultAuthorizationEnvelope =
  | Readonly<{
      schemaVersion: typeof HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION
      status: 'authorized'
      adultRef: string
      householdRef: string
      authorityRevision: number
      expiresAt: string
      headers: Readonly<Record<string, string>>
    }>
  | Readonly<{
      schemaVersion: typeof HOSTED_FAMILY_IDENTITY_SCHEMA_VERSION
      status: HostedAdultAuthenticationState | 'unavailable'
    }>

/** Adapter seam only. Importing the bridge performs no network or provider initialization. */
export interface HostedFamilyIdentityProvider {
  readHostedAuthority(signal?: AbortSignal): Promise<unknown>
  authorizeAdultRequest(signal?: AbortSignal): Promise<unknown>
}

export interface HostedAuthorizationInterruption {
  readonly status: 'interrupted'
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly state:
    | HostedAdultAuthenticationState
    | 'study-session-missing'
    | 'study-session-expired'
    | 'study-session-revoked'
  /** Compatible with the neutral authorization-interruption boundary used by Study. */
  readonly interruption: Readonly<{
    kind: 'session-authorization'
    reason: 'adult-authentication-rejected' | 'study-session-rejected'
  }>
}

export interface HostedAuthorityUnavailable {
  readonly status: 'unavailable'
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly reason:
    | 'hosted-authority-unavailable'
    | 'hosted-authority-invalid'
    | 'authorization-headers-invalid'
}

export interface HostedAuthorityRejected {
  readonly status: 'rejected'
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly reason:
    | 'wrong-household'
    | 'unknown-student'
    | 'tampered-student-ref'
    | 'stale-student-authority'
    | 'student-authority-mismatch'
    | 'invalid-request-headers'
}

export type HostedFamilyIdentityFailure =
  | HostedAuthorizationInterruption
  | HostedAuthorityUnavailable
  | HostedAuthorityRejected

export type AdultIdentityResolution =
  | Readonly<{ status: 'authenticated'; identity: AuthenticatedAdultIdentity }>
  | HostedFamilyIdentityFailure

export type HouseholdIdentityResolution =
  | Readonly<{ status: 'authorized'; household: AuthorizedHouseholdIdentity }>
  | HostedFamilyIdentityFailure

export type AuthorizedStudentListResolution =
  | Readonly<{
      status: 'authorized'
      householdRef: string
      students: readonly HostedStudentProfile[]
    }>
  | HostedFamilyIdentityFailure

/**
 * A browser projection, not server authority. The bridge additionally brands
 * each returned object in a closure so a structurally forged copy is refused.
 */
export interface AuthorizedStudentAuthority {
  readonly source: typeof HOSTED_AUTHORITY_STATE
  readonly householdRef: string
  readonly studentRef: Readonly<{ kind: 'academy-student-id'; value: string }>
  readonly authorityRevision: number
  readonly expiresAt: string
}

export type StudentAuthorityResolution =
  | Readonly<{
      status: 'authorized'
      authority: AuthorizedStudentAuthority
      student: HostedStudentProfile
    }>
  | HostedFamilyIdentityFailure

export type StudySessionGrantInstallResult =
  | Readonly<{ status: 'installed'; expiresAt: string }>
  | Readonly<{
      status: 'rejected'
      reason: 'study-session-grant-invalid' | 'study-session-grant-expired' | 'stale-student-authority'
    }>

export type AuthorizationHeadersResolution =
  | Readonly<{
      status: 'authorized'
      headers: Readonly<Record<string, string>>
      expiresAt: string
    }>
  | HostedFamilyIdentityFailure

export type AuthorizationHeadersInput =
  | Readonly<{
      scope: 'adult'
      headers?: Readonly<Record<string, string>>
      signal?: AbortSignal
    }>
  | Readonly<{
      scope: 'study'
      authority: AuthorizedStudentAuthority
      headers?: Readonly<Record<string, string>>
      signal?: AbortSignal
    }>

export interface HostedFamilyIdentityBridge {
  resolveAdultIdentity(signal?: AbortSignal): Promise<AdultIdentityResolution>
  resolveHousehold(signal?: AbortSignal): Promise<HouseholdIdentityResolution>
  listAuthorizedStudents(signal?: AbortSignal): Promise<AuthorizedStudentListResolution>
  assertStudentAuthority(
    studentRef: StudyLearnerSelector | unknown,
    signal?: AbortSignal,
  ): Promise<StudentAuthorityResolution>
  installStudySessionGrant(
    authority: AuthorizedStudentAuthority,
    grant: unknown,
  ): StudySessionGrantInstallResult
  clearStudySessionGrant(reason?: 'manual' | 'revoked'): void
  getAuthorizationHeaders(input: AuthorizationHeadersInput): Promise<AuthorizationHeadersResolution>
}

export interface CreateHostedFamilyIdentityBridgeOptions {
  readonly provider: HostedFamilyIdentityProvider
  /** Pin a previously linked device-local dataset to one exact hosted household. */
  readonly expectedHouseholdRef?: string
  readonly now?: () => number
}
