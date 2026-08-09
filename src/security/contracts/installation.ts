import {
  type InstallationManagerCapability,
  INSTALLATION_MANAGER_CAPABILITIES,
} from './authority'
import { createRandomUuidV4, isUuidV4 } from './identifiers'

export const INSTALLATION_IDENTITY_SCHEMA_VERSION = 1 as const
export const INSTALLATION_BINDING_SCHEMA_VERSION = 1 as const
export const INSTALLATION_GRANT_SCHEMA_VERSION = 1 as const

declare const installationIdBrand: unique symbol
export type InstallationId = string & { readonly [installationIdBrand]: true }

export function isInstallationId(value: unknown): value is InstallationId {
  return isUuidV4(value)
}

/** Uses crypto.randomUUID only: installation identity is never a fingerprint. */
export function createInstallationId(randomUUID?: () => string): InstallationId {
  return createRandomUuidV4(randomUUID) as InstallationId
}

/** Device metadata stored separately from exported AppState. The ID is not secret. */
export interface InstallationIdentityRecord {
  readonly schemaVersion: typeof INSTALLATION_IDENTITY_SCHEMA_VERSION
  readonly storage: 'device-local-metadata'
  readonly installationId: InstallationId
  readonly createdAt: string
}

export interface InstallationBinding {
  readonly schemaVersion: typeof INSTALLATION_BINDING_SCHEMA_VERSION
  readonly bindingId: string
  readonly installationId: InstallationId
  readonly householdId: string
  readonly datasetEpoch: string
  readonly verifiedActorId: string
  readonly status: 'active' | 'revoked'
  readonly boundAt: string
  readonly revokedAt?: string
}

export type InstallationGrantPurpose = 'first_claim' | 'legacy_upgrade' | 'recovery'
export type InstallationGrantStatus = 'issued' | 'redeemed' | 'revoked' | 'expired'

export const INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE: Readonly<
  Record<InstallationGrantPurpose, InstallationManagerCapability>
> = Object.freeze({
  first_claim: INSTALLATION_MANAGER_CAPABILITIES[0],
  legacy_upgrade: INSTALLATION_MANAGER_CAPABILITIES[0],
  recovery: INSTALLATION_MANAGER_CAPABILITIES[1],
})

/** One-time claim/recovery envelope issued only to a verified capable actor. */
export interface ParentInstallationGrant {
  readonly schemaVersion: typeof INSTALLATION_GRANT_SCHEMA_VERSION
  readonly grantId: string
  readonly householdId: string
  readonly verifiedActorId: string
  readonly installationId: InstallationId
  readonly datasetEpoch: string
  readonly purpose: InstallationGrantPurpose
  readonly capability: InstallationManagerCapability
  readonly issuedAt: string
  readonly expiresAt: string
  readonly nonce: string
  /** redeemed prevents replay; revoked provides explicit server invalidation. */
  readonly status: InstallationGrantStatus
}

export function isInstallationGrantCapabilityConsistent(
  grant: Pick<ParentInstallationGrant, 'purpose' | 'capability'>,
): boolean {
  return grant.capability === INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE[grant.purpose]
}
