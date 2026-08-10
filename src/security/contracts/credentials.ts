import type { ProfileId } from './profileId'

export const LEARNER_CREDENTIAL_SCHEMA_VERSION = 1 as const
export const LEARNER_PIN_VERIFIER_SCHEME_VERSION = 1 as const

export type LearnerCredentialState = 'enrolled' | 'reset-required'

/** Parameters needed to reproduce the verifier computation on this device. */
export interface LearnerPinCostParameters {
  readonly iterations: number
  readonly derivedKeyBytes: number
}

/**
 * A device-local convenience-lock credential. This record must never be added
 * to an educational Profile, AppState export, sync payload, Admin identity, or
 * Study identity. A four-digit PIN is not strong identity.
 */
export interface LearnerCredentialRecord {
  readonly schemaVersion: typeof LEARNER_CREDENTIAL_SCHEMA_VERSION
  readonly storage: 'device-local-only'
  readonly profileId: ProfileId
  readonly credentialKind: 'learner-pin'
  readonly verifierScheme: 'pbkdf2-sha256'
  readonly verifierSchemeVersion: typeof LEARNER_PIN_VERIFIER_SCHEME_VERSION
  /** Independently generated cryptographic random bytes, base64 encoded. */
  readonly saltBase64: string
  /** Derived verifier bytes, base64 encoded. Never synchronized. */
  readonly verifierBase64: string
  readonly costParameters: LearnerPinCostParameters
  readonly state: LearnerCredentialState
  readonly createdAt: string
  readonly rotatedAt?: string
}
