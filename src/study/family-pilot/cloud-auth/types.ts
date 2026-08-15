import type { VerifiedAuthContext } from '../../../auth/supabaseSession'

export const FAMILY_CLOUD_AUTH_SCHEMA_VERSION = 1 as const

/** Canonical verified auth context plus provider-owned session expiry metadata. */
export interface FamilyCloudIdentityContext {
  readonly authorization: VerifiedAuthContext
  readonly expiresAt: string
}

export interface LinkedFamilyDevice {
  readonly schemaVersion: typeof FAMILY_CLOUD_AUTH_SCHEMA_VERSION
  readonly accountRef: string
  readonly householdRef: string
  readonly linkedAt: string
}

export type FamilyHouseholdAuthorityResult =
  | Readonly<{ status: 'RESOLVED'; householdRef: string }>
  | Readonly<{ status: 'NO_ACTIVE_HOUSEHOLD' | 'AMBIGUOUS_HOUSEHOLD' | 'UNAVAILABLE' }>

/**
 * Resolves household authority from the canonical, server-verified remote user
 * and access-token context. Callers never supply a household selector.
 */
export interface FamilyHouseholdAuthorityPort {
  resolve(context: VerifiedAuthContext, signal?: AbortSignal): Promise<FamilyHouseholdAuthorityResult>
}

export type FamilyCloudIdentitySignInResult =
  | Readonly<{ status: 'SIGNED_IN'; context: FamilyCloudIdentityContext }>
  | Readonly<{ status: 'INVALID_CREDENTIALS' | 'UNAVAILABLE' }>

export type FamilyCloudIdentitySignUpResult =
  | Readonly<{ status: 'SIGNED_IN'; context: FamilyCloudIdentityContext }>
  | Readonly<{ status: 'CONFIRM_EMAIL' | 'INVALID_CREDENTIALS' | 'UNAVAILABLE' }>

export type FamilyCloudAccountCreationResult =
  | Readonly<{ status: 'CONFIRM_EMAIL' }>
  | Readonly<{ status: 'SESSION'; state: FamilyCloudSessionState }>

/** Supabase Auth owns credential handling, session persistence, and refresh. */
export interface FamilyCloudIdentityPort {
  current(signal?: AbortSignal): Promise<FamilyCloudIdentityContext | null>
  signIn(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudIdentitySignInResult>
  signUp(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudIdentitySignUpResult>
  signOut(): Promise<void>
}

/** Stores only a nonsecret device-to-household link. It must never receive a token or PIN. */
export interface LinkedFamilyDeviceStore {
  load(): LinkedFamilyDevice | null
  save(link: LinkedFamilyDevice): boolean
  clear(): void
}

export interface FamilyCloudLocalDataPort {
  /** Drops all in-memory provider/grant authority without deleting academic data. */
  clearCloudAuthority(): void
  /** True only when the household's already-saved local data can be opened safely. */
  hasLocalHousehold(householdRef: string): boolean
  /**
   * Opens/hydrates the household through the existing hosted-sync authority.
   * PINs and PIN verifiers are outside this port's accepted payload contract.
   */
  establish(input: Readonly<{
    householdRef: string
    authorization: VerifiedAuthContext
    signal?: AbortSignal
  }>): Promise<'READY' | 'OFFLINE' | 'UNAVAILABLE'>
  /** Reconciles already-established local changes through explicit CAS domains. */
  reconcile(input: Readonly<{
    householdRef: string
    authorization: VerifiedAuthContext
    signal?: AbortSignal
  }>): Promise<FamilyCloudReconcileResult>
}

export type FamilyCloudReconcileResult = 'UP_TO_DATE' | 'OFFLINE' | 'CONFLICT' | 'UNAVAILABLE'

export type FamilyCloudSessionState =
  | Readonly<{
      status: 'SIGNED_OUT'
      householdRef: null
      cloudAuthority: 'NONE'
      localData: 'UNAVAILABLE'
    }>
  | Readonly<{
      status: 'AUTHENTICATING'
      householdRef: null
      cloudAuthority: 'CHECKING'
      localData: 'UNAVAILABLE'
    }>
  | Readonly<{
      status: 'READY'
      householdRef: string
      cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD'
      localData: 'AVAILABLE'
      expiresAt: string
    }>
  | Readonly<{
      status: 'OFFLINE_LOCAL'
      householdRef: string
      cloudAuthority: 'NONE'
      localData: 'SAVED_ON_DEVICE'
    }>
  | Readonly<{
      status: 'EXPIRED'
      householdRef: string | null
      cloudAuthority: 'NONE'
      localData: 'AVAILABLE' | 'UNAVAILABLE'
    }>
  | Readonly<{
      status: 'NEEDS_ATTENTION'
      householdRef: string | null
      cloudAuthority: 'NONE'
      localData: 'AVAILABLE' | 'UNAVAILABLE'
      reason: 'NO_ACTIVE_HOUSEHOLD' | 'AMBIGUOUS_HOUSEHOLD' | 'AUTH_UNAVAILABLE' | 'DATA_UNAVAILABLE'
    }>

export interface FamilyCloudAuthRuntime {
  snapshot(): FamilyCloudSessionState
  bootstrap(signal?: AbortSignal): Promise<FamilyCloudSessionState>
  signIn(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudSessionState>
  createAccount(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudAccountCreationResult>
  signOut(): Promise<FamilyCloudSessionState>
  reconcile(signal?: AbortSignal): Promise<FamilyCloudReconcileResult>
  subscribe(listener: (state: FamilyCloudSessionState) => void): () => void
}

export interface FamilyCloudLearnerProfile {
  readonly learnerRef: string
  readonly displayName: string
  readonly pinRequired: boolean
}

/**
 * Device-local learner access only. Implementations must not make a network
 * request or expose/copy the accepted local verifier.
 */
export interface FamilyLocalLearnerAccessPort {
  list(householdRef: string): readonly FamilyCloudLearnerProfile[]
  verifyPin(householdRef: string, learnerRef: string, pin: string): boolean
  dashboard(householdRef: string, learnerRef: string): Readonly<Record<string, unknown>> | null
}

export type FamilyLearnerSessionState =
  | Readonly<{ status: 'LOCKED'; householdRef: string | null; learnerRef: null }>
  | Readonly<{ status: 'ACTIVE'; householdRef: string; learnerRef: string }>
