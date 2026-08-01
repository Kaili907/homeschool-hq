import { STUDY_PRODUCTION_ERROR_SCHEMA_VERSION } from './versions'

export type StudyProductionErrorCode =
  | 'authentication-required'
  | 'session-verification-failed'
  | 'browser-authority-claim-rejected'
  | 'invalid-production-identifier'
  | 'synthetic-identifier-rejected'
  | 'household-not-active'
  | 'learner-not-active'
  | 'household-mismatch'
  | 'learner-mismatch'
  | 'membership-not-active'
  | 'guardian-role-required'
  | 'relationship-not-active'
  | 'learner-permission-required'
  | 'student-session-issuer-unavailable'
  | 'student-session-invalid'
  | 'student-session-expired'
  | 'student-session-revoked'
  | 'authorization-expired'
  | 'authorization-revoked'
  | 'authorization-stale'
  | 'lifecycle-epoch-stale'
  | 'staff-authorization-disabled'
  | 'staff-permission-required'
  | 'adult-notification-permission-required'
  | 'recipient-not-authorized'
  | 'production-dependency-missing'
  | 'production-dependency-invalid'
  | 'production-dependency-not-ready'
  | 'production-dependency-degraded'
  | 'production-registry-duplicate'
  | 'production-not-ready'

const SAFE_MESSAGES: Readonly<Record<StudyProductionErrorCode, string>> = Object.freeze({
  'authentication-required': 'A verified server session is required.',
  'session-verification-failed': 'The server session could not be verified.',
  'browser-authority-claim-rejected': 'Browser-supplied authority claims are not accepted.',
  'invalid-production-identifier': 'A production identity reference is invalid.',
  'synthetic-identifier-rejected': 'Synthetic identifiers are not accepted in production.',
  'household-not-active': 'The household is not available for Study.',
  'learner-not-active': 'The learner is not available for Study.',
  'household-mismatch': 'The requested Study scope is not authorized.',
  'learner-mismatch': 'The requested Study scope is not authorized.',
  'membership-not-active': 'An active household membership is required.',
  'guardian-role-required': 'An active guardian role is required.',
  'relationship-not-active': 'An active learner relationship is required.',
  'learner-permission-required': 'The required learner permission is missing.',
  'student-session-issuer-unavailable': 'Direct student Study access is not ready.',
  'student-session-invalid': 'The student session is not valid.',
  'student-session-expired': 'The student session has expired.',
  'student-session-revoked': 'The student session has been revoked.',
  'authorization-expired': 'Study authorization has expired.',
  'authorization-revoked': 'Study authorization has been revoked.',
  'authorization-stale': 'Study authorization is stale.',
  'lifecycle-epoch-stale': 'Study identity context is stale.',
  'staff-authorization-disabled': 'Staff Study access is disabled.',
  'staff-permission-required': 'Explicit staff Study permission is required.',
  'adult-notification-permission-required': 'Adult notification permission is required.',
  'recipient-not-authorized': 'No authorized adult notification route is available.',
  'production-dependency-missing': 'A required production dependency is missing.',
  'production-dependency-invalid': 'A production dependency does not satisfy its contract.',
  'production-dependency-not-ready': 'A production dependency is not ready.',
  'production-dependency-degraded': 'A production dependency is degraded.',
  'production-registry-duplicate': 'A production dependency was registered more than once.',
  'production-not-ready': 'Study production is not ready.',
})

export class StudyProductionError extends Error {
  readonly schemaVersion = STUDY_PRODUCTION_ERROR_SCHEMA_VERSION

  constructor(
    readonly code: StudyProductionErrorCode,
    readonly retryable = false,
  ) {
    super(SAFE_MESSAGES[code])
    this.name = 'StudyProductionError'
  }
}
/** Secret- and identity-free error projection safe for browser responses. */
export function productionErrorWireResult(error: StudyProductionError): {
  readonly schemaVersion: typeof STUDY_PRODUCTION_ERROR_SCHEMA_VERSION
  readonly code: StudyProductionErrorCode
  readonly retryable: boolean
} {
  return Object.freeze({
    schemaVersion: STUDY_PRODUCTION_ERROR_SCHEMA_VERSION,
    code: error.code,
    retryable: error.retryable,
  })
}
