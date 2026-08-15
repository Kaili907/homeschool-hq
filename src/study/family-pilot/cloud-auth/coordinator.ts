import {
  FAMILY_CLOUD_AUTH_SCHEMA_VERSION,
  type FamilyCloudAuthRuntime,
  type FamilyCloudIdentityPort,
  type FamilyCloudLocalDataPort,
  type FamilyCloudSessionState,
  type FamilyHouseholdAuthorityPort,
  type LinkedFamilyDeviceStore,
} from './types'

const SIGNED_OUT: FamilyCloudSessionState = Object.freeze({
  status: 'SIGNED_OUT', householdRef: null, cloudAuthority: 'NONE', localData: 'UNAVAILABLE',
})
const AUTHENTICATING: FamilyCloudSessionState = Object.freeze({
  status: 'AUTHENTICATING', householdRef: null, cloudAuthority: 'CHECKING', localData: 'UNAVAILABLE',
})
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

export interface FamilyCloudAuthCoordinatorOptions {
  readonly identity: FamilyCloudIdentityPort
  readonly authority: FamilyHouseholdAuthorityPort
  readonly localData: FamilyCloudLocalDataPort
  readonly device: LinkedFamilyDeviceStore
  readonly isOnline?: () => boolean
  readonly now?: () => Date
}

export class FamilyCloudAuthCoordinator implements FamilyCloudAuthRuntime {
  readonly #identity: FamilyCloudIdentityPort
  readonly #authority: FamilyHouseholdAuthorityPort
  readonly #localData: FamilyCloudLocalDataPort
  readonly #device: LinkedFamilyDeviceStore
  readonly #isOnline: () => boolean
  readonly #now: () => Date
  readonly #listeners = new Set<(state: FamilyCloudSessionState) => void>()
  #state: FamilyCloudSessionState = SIGNED_OUT
  #generation = 0

  constructor(options: FamilyCloudAuthCoordinatorOptions) {
    this.#identity = options.identity
    this.#authority = options.authority
    this.#localData = options.localData
    this.#device = options.device
    this.#isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine)
    this.#now = options.now ?? (() => new Date())
  }

  snapshot(): FamilyCloudSessionState { return this.#state }

  subscribe(listener: (state: FamilyCloudSessionState) => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  async bootstrap(signal?: AbortSignal): Promise<FamilyCloudSessionState> {
    const generation = ++this.#generation
    this.#publish(AUTHENTICATING)
    let context
    try { context = await this.#identity.current(signal) } catch { context = null }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (!context) return this.#withoutCurrentSession()
    return this.#establish(context, generation, signal)
  }

  async signIn(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudSessionState> {
    const generation = ++this.#generation
    this.#publish(AUTHENTICATING)
    let result
    try { result = await this.#identity.signIn(email, password, signal) } catch { result = { status: 'UNAVAILABLE' as const } }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (result.status !== 'SIGNED_IN') {
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE', localData: 'UNAVAILABLE',
        reason: 'AUTH_UNAVAILABLE',
      }))
    }
    return this.#establish(result.context, generation, signal)
  }

  async signOut(): Promise<FamilyCloudSessionState> {
    ++this.#generation
    this.#device.clear()
    this.#publish(SIGNED_OUT)
    try { await this.#identity.signOut() } catch { /* local authority is already cleared */ }
    return this.#state
  }

  #withoutCurrentSession(): FamilyCloudSessionState {
    const link = this.#device.load()
    const localAvailable = Boolean(link && this.#hasLocalHousehold(link.householdRef))
    if (!this.#isOnline() && link && localAvailable) {
      return this.#publish(Object.freeze({
        status: 'OFFLINE_LOCAL', householdRef: link.householdRef,
        cloudAuthority: 'NONE', localData: 'SAVED_ON_DEVICE',
      }))
    }
    if (link) {
      return this.#publish(Object.freeze({
        status: 'EXPIRED', householdRef: link.householdRef,
        cloudAuthority: 'NONE', localData: localAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      }))
    }
    return this.#publish(SIGNED_OUT)
  }

  async #establish(
    context: NonNullable<Awaited<ReturnType<FamilyCloudIdentityPort['current']>>>,
    generation: number,
    signal?: AbortSignal,
  ): Promise<FamilyCloudSessionState> {
    const expiry = Date.parse(context.expiresAt)
    if (
      !Number.isFinite(expiry) || expiry <= this.#now().getTime() ||
      !REF.test(context.authorization.user.id)
    ) return this.#withoutCurrentSession()
    let resolved
    try { resolved = await this.#authority.resolve(context.authorization, signal) } catch { resolved = { status: 'UNAVAILABLE' as const } }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (resolved.status !== 'RESOLVED') {
      const reason = resolved.status === 'NO_ACTIVE_HOUSEHOLD' ? 'NO_ACTIVE_HOUSEHOLD'
        : resolved.status === 'AMBIGUOUS_HOUSEHOLD' ? 'AMBIGUOUS_HOUSEHOLD' : 'AUTH_UNAVAILABLE'
      const link = this.#device.load()
      const localAvailable = Boolean(link && this.#hasLocalHousehold(link.householdRef))
      if (
        resolved.status === 'UNAVAILABLE' && !this.#isOnline() && link && localAvailable &&
        link.accountRef === context.authorization.user.id
      ) {
        return this.#publish(Object.freeze({
          status: 'OFFLINE_LOCAL', householdRef: link.householdRef,
          cloudAuthority: 'NONE', localData: 'SAVED_ON_DEVICE',
        }))
      }
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE',
        localData: 'UNAVAILABLE', reason,
      }))
    }
    if (!REF.test(resolved.householdRef)) {
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE',
        localData: 'UNAVAILABLE', reason: 'AUTH_UNAVAILABLE',
      }))
    }
    const data = await this.#localData.establish({
      householdRef: resolved.householdRef, authorization: context.authorization, signal,
    }).catch(() => 'UNAVAILABLE' as const)
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (data !== 'READY') {
      const matchingLocal = this.#hasLocalHousehold(resolved.householdRef)
      if (data === 'OFFLINE' && matchingLocal) {
        return this.#publish(Object.freeze({
          status: 'OFFLINE_LOCAL', householdRef: resolved.householdRef,
          cloudAuthority: 'NONE', localData: 'SAVED_ON_DEVICE',
        }))
      }
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: resolved.householdRef,
        cloudAuthority: 'NONE', localData: matchingLocal ? 'AVAILABLE' : 'UNAVAILABLE',
        reason: 'DATA_UNAVAILABLE',
      }))
    }
    const linkedAt = this.#now().toISOString()
    if (!this.#device.save({
      schemaVersion: FAMILY_CLOUD_AUTH_SCHEMA_VERSION,
      accountRef: context.authorization.user.id,
      householdRef: resolved.householdRef,
      linkedAt,
    })) {
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: resolved.householdRef,
        cloudAuthority: 'NONE', localData: 'AVAILABLE', reason: 'DATA_UNAVAILABLE',
      }))
    }
    return this.#publish(Object.freeze({
      status: 'READY', householdRef: resolved.householdRef,
      cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD', localData: 'AVAILABLE',
      expiresAt: context.expiresAt,
    }))
  }

  #publish<T extends FamilyCloudSessionState>(state: T): T {
    this.#state = state
    for (const listener of this.#listeners) listener(state)
    return state
  }

  #hasLocalHousehold(householdRef: string): boolean {
    try { return this.#localData.hasLocalHousehold(householdRef) } catch { return false }
  }
}
