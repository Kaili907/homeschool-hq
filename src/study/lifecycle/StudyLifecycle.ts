import type { StudyProductionAuthority } from '../contracts/production/identity'

export type StudyCancellationReason =
  | 'logout'
  | 'learner-switch'
  | 'household-switch'
  | 'session-expired'
  | 'grant-expired'
  | 'membership-revoked'
  | 'relationship-revoked'
  | 'feature-disabled'
  | 'safety-stop'
  | 'navigation-away'
  | 'stale-checkpoint'
  | 'authorization-loss'
  | 'new-lifecycle-epoch'
  | 'duplicate-response'

/** The complete host identity/authority tuple to which one Study epoch belongs. */
export interface StudyLifecycleBinding {
  readonly authenticatedSessionRef: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly launchGrantRef: string
  readonly featureEnabled: boolean
  readonly authorizationRevision: number
  readonly expiresAt?: string
  readonly identityEpochs?: StudyProductionAuthority['window']['lifecycleEpochs']
}

export interface StudyOperationContext {
  readonly epoch: number
  readonly binding: StudyLifecycleBinding
  readonly operationRef?: string
  readonly signal: AbortSignal
  isCurrent(): boolean
  assertCurrent(): void
}

export interface StudyLifecycleToken extends StudyOperationContext {}

export interface RunCurrentStudyWorkOptions {
  /** Stable request/mutation reference. A second use in the same epoch is quarantined. */
  readonly operationRef?: string
  /** Additional caller, timeout, or route signal composed with the lifecycle signal. */
  readonly signals?: readonly AbortSignal[]
}

export class StudyLifecycleAbortError extends DOMException {
  readonly reason: StudyCancellationReason

  constructor(reason: StudyCancellationReason) {
    super(`Study operation cancelled: ${reason}.`, 'AbortError')
    this.reason = reason
  }
}

const TOKEN_OWNERS = new WeakMap<StudyLifecycleToken, StudyLifecycleBoundary>()

function stableIdentityEpochs(value: StudyLifecycleBinding['identityEpochs']): string {
  if (!value) return ''
  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, epoch]) => `${key}:${epoch}`)
    .join(',')
}

function fingerprint(binding: StudyLifecycleBinding): string {
  return [
    binding.authenticatedSessionRef,
    binding.householdRef,
    binding.learnerRef,
    binding.launchGrantRef,
    binding.featureEnabled ? 'enabled' : 'disabled',
    binding.authorizationRevision,
    binding.expiresAt ?? '',
    stableIdentityEpochs(binding.identityEpochs),
  ].join('|')
}

function immutableBinding(binding: StudyLifecycleBinding): StudyLifecycleBinding {
  if (
    !binding.authenticatedSessionRef ||
    !binding.householdRef ||
    !binding.learnerRef ||
    !binding.launchGrantRef ||
    !Number.isSafeInteger(binding.authorizationRevision) ||
    binding.authorizationRevision < 1
  ) throw new Error('Study lifecycle binding is incomplete.')
  if (binding.expiresAt !== undefined && !Number.isFinite(Date.parse(binding.expiresAt))) {
    throw new Error('Study lifecycle expiration is invalid.')
  }
  return Object.freeze({
    ...binding,
    identityEpochs: binding.identityEpochs ? Object.freeze({ ...binding.identityEpochs }) : undefined,
  })
}

function changedBindingReason(
  previous: StudyLifecycleBinding,
  next: StudyLifecycleBinding,
): StudyCancellationReason {
  if (previous.featureEnabled && !next.featureEnabled) return 'feature-disabled'
  if (previous.householdRef !== next.householdRef) return 'household-switch'
  if (previous.learnerRef !== next.learnerRef) return 'learner-switch'
  if (previous.authenticatedSessionRef !== next.authenticatedSessionRef) return 'session-expired'
  return 'new-lifecycle-epoch'
}

function abortErrorFromSignal(signal: AbortSignal): StudyLifecycleAbortError {
  const reason = typeof signal.reason === 'string'
    ? signal.reason as StudyCancellationReason
    : 'authorization-loss'
  return new StudyLifecycleAbortError(reason)
}

/**
 * The sole lifecycle epoch for a Study host runtime. An epoch is usable only
 * while its full verified learner binding remains active.
 */
export class StudyLifecycleBoundary {
  #epoch = 0
  #controller: AbortController | null = null
  #binding: StudyLifecycleBinding | null = null
  #fingerprint: string | null = null
  #reason: StudyCancellationReason | null = null
  #expirationTimer: ReturnType<typeof setTimeout> | null = null
  readonly #operations = new Set<string>()

  constructor(binding?: StudyLifecycleBinding) {
    if (binding) this.beginEpoch(binding)
  }

  /** Starts or reuses the epoch for an exact binding, cancelling any prior identity. */
  beginEpoch(binding: StudyLifecycleBinding): StudyLifecycleToken {
    const next = immutableBinding(binding)
    const nextFingerprint = fingerprint(next)
    if (this.#binding && this.#controller && !this.#controller.signal.aborted && this.#fingerprint === nextFingerprint) {
      return this.token()
    }

    if (this.#binding) this.#abort(changedBindingReason(this.#binding, next))
    else if (this.#controller && !this.#controller.signal.aborted) this.#abort('new-lifecycle-epoch')

    this.#epoch += 1
    this.#controller = new AbortController()
    this.#binding = next
    this.#fingerprint = nextFingerprint
    this.#operations.clear()
    this.#scheduleExpiration(next)

    if (!next.featureEnabled) this.cancel('feature-disabled')
    else if (next.expiresAt && Date.parse(next.expiresAt) <= Date.now()) this.cancel('grant-expired')
    return this.token()
  }

  token(): StudyLifecycleToken {
    const epoch = this.#epoch
    const controller = this.#controller
    const binding = this.#binding
    const boundary = this
    const assertCurrent = () => {
      boundary.#expireIfNeeded()
      if (
        !controller ||
        !binding ||
        controller.signal.aborted ||
        boundary.#controller !== controller ||
        boundary.#binding !== binding ||
        boundary.#epoch !== epoch
      ) throw controller?.signal.aborted
        ? abortErrorFromSignal(controller.signal)
        : new StudyLifecycleAbortError(boundary.#reason ?? 'authorization-loss')
    }
    const token = Object.freeze({
      epoch,
      binding: binding ?? Object.freeze({
        authenticatedSessionRef: '',
        householdRef: '',
        learnerRef: '',
        launchGrantRef: '',
        featureEnabled: false,
        authorizationRevision: 0,
      }),
      signal: controller?.signal ?? AbortSignal.abort('authorization-loss'),
      isCurrent: () => {
        try {
          assertCurrent()
          return true
        } catch {
          return false
        }
      },
      assertCurrent,
    })
    TOKEN_OWNERS.set(token, this)
    return token
  }

  cancel(reason: StudyCancellationReason): void {
    this.#abort(reason)
    this.#binding = null
    this.#fingerprint = null
    this.#operations.clear()
  }

  cancelIfCurrent(token: StudyLifecycleToken, reason: StudyCancellationReason): void {
    if (token.isCurrent()) this.cancel(reason)
  }

  get lastReason(): StudyCancellationReason | null {
    return this.#reason
  }

  get binding(): StudyLifecycleBinding | null {
    return this.#binding
  }

  #claimOperation(operationRef: string | undefined): void {
    if (!operationRef) return
    if (this.#operations.has(operationRef)) throw new StudyLifecycleAbortError('duplicate-response')
    this.#operations.add(operationRef)
  }

  #abort(reason: StudyCancellationReason): void {
    this.#reason = reason
    this.#clearExpiration()
    if (this.#controller && !this.#controller.signal.aborted) this.#controller.abort(reason)
  }

  #expireIfNeeded(): void {
    if (this.#binding?.expiresAt && Date.parse(this.#binding.expiresAt) <= Date.now()) {
      this.cancel('grant-expired')
    }
  }

  #scheduleExpiration(binding: StudyLifecycleBinding): void {
    this.#clearExpiration()
    if (!binding.expiresAt) return
    const remaining = Date.parse(binding.expiresAt) - Date.now()
    if (remaining <= 0) return
    this.#expirationTimer = setTimeout(() => this.cancel('grant-expired'), Math.min(remaining, 2_147_483_647))
    const timer = this.#expirationTimer as ReturnType<typeof setTimeout> & { unref?: () => void }
    timer.unref?.()
  }

  #clearExpiration(): void {
    if (this.#expirationTimer) clearTimeout(this.#expirationTimer)
    this.#expirationTimer = null
  }

  /** @internal Used only by the guarded operation runner. */
  _claim(token: StudyLifecycleToken, operationRef: string | undefined): void {
    token.assertCurrent()
    this.#claimOperation(operationRef)
  }
}

/**
 * Guards asynchronous work on both sides of its await. Cancellation-aware
 * adapters receive the operation context; non-cooperative work is quarantined.
 */
export async function runCurrentStudyWork<T>(
  token: StudyLifecycleToken,
  work: (signal: AbortSignal, context: StudyOperationContext) => Promise<T>,
  options: RunCurrentStudyWorkOptions = {},
): Promise<T> {
  token.assertCurrent()
  const signal = composeAbortSignals([token.signal, ...(options.signals ?? [])])
  const context: StudyOperationContext = Object.freeze({
    epoch: token.epoch,
    binding: token.binding,
    operationRef: options.operationRef,
    signal,
    isCurrent: () => token.isCurrent() && !signal.aborted,
    assertCurrent: () => {
      token.assertCurrent()
      if (signal.aborted) throw abortErrorFromSignal(signal)
    },
  })
  // Tokens deliberately expose no mutable owner. A private owner reference is
  // attached by the helper below when the token is created by a boundary.
  const owner = TOKEN_OWNERS.get(token)
  owner?._claim(token, options.operationRef)
  context.assertCurrent()
  try {
    const result = await work(signal, context)
    context.assertCurrent()
    return result
  } catch (error) {
    context.assertCurrent()
    throw error
  }
}

export function composeAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  if (signals.length === 0) return new AbortController().signal
  if (signals.length === 1) return signals[0]
  const controller = new AbortController()
  const listeners = new Map<AbortSignal, () => void>()
  const cleanup = () => {
    for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener)
    listeners.clear()
  }
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason)
    cleanup()
  }
  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    const listener = () => abort(signal)
    listeners.set(signal, listener)
    signal.addEventListener('abort', listener, { once: true })
  }
  return controller.signal
}

export function lifecycleBindingFromProductionAuthority(
  authority: StudyProductionAuthority,
  featureEnabled = true,
): StudyLifecycleBinding {
  return {
    authenticatedSessionRef: authority.learnerSessionId,
    householdRef: authority.householdId,
    learnerRef: authority.studentId,
    launchGrantRef: authority.actorKind === 'student-session'
      ? authority.studentSessionGrantId
      : authority.evidenceRef,
    featureEnabled,
    authorizationRevision: authority.window.revision,
    expiresAt: authority.window.expiresAt,
    identityEpochs: authority.window.lifecycleEpochs,
  }
}

const HOST_LIFECYCLES = new WeakMap<object, StudyLifecycleBoundary>()

/** Shares one lifecycle across dashboard, settings, calendar, and session UI. */
export function acquireHostStudyLifecycle(
  owner: object,
  binding: StudyLifecycleBinding,
): StudyLifecycleBoundary {
  let lifecycle = HOST_LIFECYCLES.get(owner)
  if (!lifecycle) {
    lifecycle = new StudyLifecycleBoundary(binding)
    HOST_LIFECYCLES.set(owner, lifecycle)
  } else {
    lifecycle.beginEpoch(binding)
  }
  return lifecycle
}
