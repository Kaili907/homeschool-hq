import {
  FAMILY_CLOUD_AUTH_SCHEMA_VERSION,
  type FamilyCloudAuthRuntime,
  type FamilyCloudAccountCreationResult,
  type FamilyCloudEmailRequestResult,
  type FamilyCloudIdentityPort,
  type FamilyCloudLocalDataPort,
  type FamilyCloudIdentityContext,
  type FamilyCloudReconcileResult,
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
  #context: FamilyCloudIdentityContext | null = null
  #reconcileController: AbortController | null = null

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
    this.#dropCloudAuthority()
    this.#publish(AUTHENTICATING)
    let context
    try { context = await this.#identity.current(signal) } catch { context = null }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (!context) return this.#withoutCurrentSession()
    return this.#establish(context, generation, signal)
  }

  async signIn(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudSessionState> {
    const generation = ++this.#generation
    this.#dropCloudAuthority()
    this.#publish(AUTHENTICATING)
    let result
    try { result = await this.#identity.signIn(email, password, signal) } catch { result = { status: 'UNAVAILABLE' as const } }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (result.status !== 'SIGNED_IN') {
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE', localData: 'UNAVAILABLE',
        reason: result.status === 'INVALID_CREDENTIALS' ? 'SIGN_IN_FAILED' : 'AUTH_UNAVAILABLE',
      }))
    }
    return this.#establish(result.context, generation, signal)
  }

  async createAccount(email: string, password: string, signal?: AbortSignal): Promise<FamilyCloudAccountCreationResult> {
    const generation = ++this.#generation
    this.#dropCloudAuthority()
    this.#publish(AUTHENTICATING)
    let result
    try { result = await this.#identity.signUp(email, password, signal) } catch { result = { status: 'UNAVAILABLE' as const } }
    if (generation !== this.#generation || signal?.aborted) {
      return Object.freeze({ status: 'SESSION', state: this.#state })
    }
    if (result.status === 'CONFIRM_EMAIL') {
      this.#publish(SIGNED_OUT)
      return Object.freeze({ status: 'CONFIRM_EMAIL' })
    }
    if (result.status !== 'SIGNED_IN') {
      const state = this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE', localData: 'UNAVAILABLE',
        reason: result.status === 'INVALID_CREDENTIALS' ? 'SIGN_IN_FAILED' : 'AUTH_UNAVAILABLE',
      }))
      return Object.freeze({ status: 'SESSION', state })
    }
    return Object.freeze({ status: 'SESSION', state: await this.#establish(result.context, generation, signal) })
  }

  async requestPasswordRecovery(email: string, signal?: AbortSignal): Promise<FamilyCloudEmailRequestResult> {
    try { return await this.#identity.requestPasswordRecovery(email, signal) } catch { return 'UNAVAILABLE' }
  }

  async requestMagicLink(email: string, signal?: AbortSignal): Promise<FamilyCloudEmailRequestResult> {
    try { return await this.#identity.requestMagicLink(email, signal) } catch { return 'UNAVAILABLE' }
  }

  async retryCloudSetup(signal?: AbortSignal): Promise<FamilyCloudSessionState> {
    const context = this.#context
    if (!context || signal?.aborted) return this.#state
    const generation = ++this.#generation
    this.#publish(AUTHENTICATING)
    return this.#establish(context, generation, signal)
  }

  async signOut(): Promise<FamilyCloudSessionState> {
    ++this.#generation
    this.#dropCloudAuthority()
    let result
    try { result = await this.#identity.signOut() } catch { result = 'UNAVAILABLE' as const }
    if (result === 'SIGNED_OUT') {
      this.#device.clear()
      return this.#publish(SIGNED_OUT)
    }
    return this.#publish(Object.freeze({
      status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'NONE',
      localData: 'UNAVAILABLE', reason: 'AUTH_UNAVAILABLE',
    }))
  }

  async reconcile(signal?: AbortSignal): Promise<FamilyCloudReconcileResult> {
    const context = this.#context
    const state = this.#state
    if (!context || (state.status !== 'READY' && state.status !== 'OFFLINE_LOCAL') || !state.householdRef) return 'UNAVAILABLE'
    if (signal?.aborted) return 'UNAVAILABLE'
    this.#reconcileController?.abort()
    const controller = new AbortController()
    this.#reconcileController = controller
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const result: FamilyCloudReconcileResult = await this.#localData.reconcile({
        householdRef: state.householdRef, authorization: context.authorization, signal: controller.signal,
      }).catch((): FamilyCloudReconcileResult => 'UNAVAILABLE')
      if (controller.signal.aborted) return 'UNAVAILABLE'
      if (result === 'OFFLINE') this.#publish(Object.freeze({
        status: 'OFFLINE_LOCAL', householdRef: state.householdRef,
        cloudAuthority: 'NONE', localData: 'SAVED_ON_DEVICE',
      }))
      return result
    } finally {
      signal?.removeEventListener('abort', abort)
      if (this.#reconcileController === controller) this.#reconcileController = null
    }
  }

  #withoutCurrentSession(): FamilyCloudSessionState {
    this.#context = null
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
    // Provider authentication remains valid while household setup/linking is
    // retried. Only an explicit sign-out or an invalid/expired provider session
    // clears this context.
    this.#context = context
    let resolved
    try { resolved = await this.#authority.resolve(context.authorization, signal) } catch { resolved = { status: 'UNAVAILABLE' as const } }
    if (generation !== this.#generation || signal?.aborted) return this.#state
    if (resolved.status !== 'RESOLVED') {
      const reason = resolved.status === 'NO_ACTIVE_HOUSEHOLD' ? 'NO_ACTIVE_HOUSEHOLD'
        : resolved.status === 'AMBIGUOUS_HOUSEHOLD' ? 'AMBIGUOUS_HOUSEHOLD' : 'CLOUD_SETUP_FAILED'
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
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'AUTHENTICATED_PARENT',
        localData: 'UNAVAILABLE', expiresAt: context.expiresAt, reason,
      }))
    }
    if (!REF.test(resolved.householdRef)) {
      return this.#publish(Object.freeze({
        status: 'NEEDS_ATTENTION', householdRef: null, cloudAuthority: 'AUTHENTICATED_PARENT',
        localData: 'UNAVAILABLE', expiresAt: context.expiresAt, reason: 'CLOUD_SETUP_FAILED',
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
        cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD',
        localData: matchingLocal ? 'AVAILABLE' : 'UNAVAILABLE', expiresAt: context.expiresAt,
        reason: data === 'FIRST_LINK_FAILED' ? 'CLOUD_FIRST_LINK_FAILED' : 'CLOUD_SETUP_FAILED',
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
        cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD', localData: 'AVAILABLE',
        expiresAt: context.expiresAt, reason: 'CLOUD_SETUP_FAILED',
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

  #dropCloudAuthority(): void {
    this.#context = null
    this.#reconcileController?.abort()
    this.#reconcileController = null
    this.#localData.clearCloudAuthority()
  }
}
