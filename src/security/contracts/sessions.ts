import { createRandomUuidV4 } from './identifiers'
import { SECURITY_SESSION_POLICY } from './sessionPolicy'

export const LOCAL_SESSION_SCHEMA_VERSION = 1 as const
export const PARENT_STEP_UP_SCHEMA_VERSION = 1 as const

declare const localSessionIdBrand: unique symbol
export type LocalSessionId = string & { readonly [localSessionIdBrand]: true }

export function createLocalSessionId(randomUUID?: () => string): LocalSessionId {
  return createRandomUuidV4(randomUUID) as LocalSessionId
}

/** A future device-local learner session; it is never part of a synced Profile. */
export interface LearnerSessionRecord {
  readonly schemaVersion: typeof LOCAL_SESSION_SCHEMA_VERSION
  readonly sessionId: LocalSessionId
  readonly profileId: string
  readonly authenticatedAt: string
  readonly lastMeaningfulActivityAt: string
  readonly absoluteExpiresAt: string
  readonly globalRevocationEpoch: number
}

/** A future Parent session. The storage discriminant forbids durable storage. */
export interface ParentSessionRecord {
  readonly schemaVersion: typeof LOCAL_SESSION_SCHEMA_VERSION
  readonly storage: typeof SECURITY_SESSION_POLICY.parent.storage
  readonly sessionId: LocalSessionId
  readonly verifiedParentActorId: string
  readonly householdId: string
  readonly authenticatedAt: string
  readonly lastMeaningfulActivityAt: string
  readonly absoluteExpiresAt: string
  readonly globalRevocationEpoch: number
}

/** A memory-only grant scoped to exactly one sensitive Parent operation. */
export interface ParentStepUpGrant {
  readonly schemaVersion: typeof PARENT_STEP_UP_SCHEMA_VERSION
  readonly storage: typeof SECURITY_SESSION_POLICY.parentStepUp.storage
  readonly grantId: LocalSessionId
  readonly parentSessionId: LocalSessionId
  readonly operationId: string
  readonly operationUseLimit: typeof SECURITY_SESSION_POLICY.parentStepUp.operationUseLimit
  readonly issuedAt: string
  readonly expiresAt: string
}

/** Runtime boundary check for deserialized or otherwise untrusted grant shapes. */
export function isParentStepUpGrantPolicyCompliant(grant: ParentStepUpGrant): boolean {
  const issuedAt = Date.parse(grant.issuedAt)
  const expiresAt = Date.parse(grant.expiresAt)
  return grant.storage === SECURITY_SESSION_POLICY.parentStepUp.storage &&
    grant.operationUseLimit === SECURITY_SESSION_POLICY.parentStepUp.operationUseLimit &&
    grant.operationId.length > 0 &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= SECURITY_SESSION_POLICY.parentStepUp.maximumLifetimeMs
}
