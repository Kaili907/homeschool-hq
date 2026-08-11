import type { LearnerPinCostParameters } from './credentials'
import type { InstallationId } from './installation'

export const PARENT_CREDENTIAL_SCHEMA_VERSION = 1 as const
export const PARENT_PIN_VERIFIER_SCHEME_VERSION = 1 as const
export const PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION = 1 as const

export type ParentCredentialState = 'enrolled' | 'reset-required'
export type ParentPinCostParameters = LearnerPinCostParameters

/**
 * Stable local identity copied from an authoritative active InstallationBinding.
 * It deliberately excludes actor, grant, dataset, and server-authority fields.
 */
export interface ParentCredentialBindingReference {
  readonly schemaVersion: typeof PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION
  readonly installationId: InstallationId
  readonly householdId: string
}

/** Device-local convenience-lock material. It is never educational or portable data. */
export interface ParentCredentialRecord {
  readonly schemaVersion: typeof PARENT_CREDENTIAL_SCHEMA_VERSION
  readonly storage: 'device-local-only'
  readonly binding: ParentCredentialBindingReference
  readonly credentialKind: 'parent-pin'
  readonly verifierScheme: 'pbkdf2-sha256'
  readonly verifierSchemeVersion: typeof PARENT_PIN_VERIFIER_SCHEME_VERSION
  readonly costParametersVersion: 1
  readonly saltBase64: string
  readonly verifierBase64: string
  readonly costParameters: ParentPinCostParameters
  readonly state: ParentCredentialState
  readonly createdAt: string
  readonly rotatedAt?: string
}
