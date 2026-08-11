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
  /**
   * STUDY-A1-LIFECYCLE-AUTHORITY — the deadline the epoch is BORN with, and part
   * of the epoch's identity fingerprint. NOT the deadline that is enforced.
   *
   * `renewEpochLeaseIfCurrent` moves the enforced deadline without rotating the
   * epoch, which is exactly what keeps a girl's in-flight turn alive across a
   * readiness refresh — and it deliberately leaves this binding object alone, so
   * that the seam and token identities the mounted surfaces hold stay stable. So
   * after any renewal this field is history: it says what the epoch STARTED with.
   *
   * Read `StudyLifecycleBoundary.leaseExpiresAt` for the deadline that is
   * actually enforced. No authority decision may be taken from this field.
   */
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

/** The binding a token carries when it names no epoch. It authorizes nothing. */
const NO_EPOCH_BINDING: StudyLifecycleBinding = Object.freeze({
  authenticatedSessionRef: '',
  householdRef: '',
  learnerRef: '',
  launchGrantRef: '',
  featureEnabled: false,
  authorizationRevision: 0,
})

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
  /**
   * The epoch's LIVE deadline. It starts as the binding's own `expiresAt` and is
   * the only part of an epoch `renewEpochLease` may move, so after a renewal the
   * binding's `expiresAt` is the deadline the epoch was BORN with and this is the
   * one it will actually be cancelled at.
   */
  #expiresAt: string | null = null
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
    this.#expiresAt = next.expiresAt ?? null
    this.#scheduleExpiration()

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
      binding: binding ?? NO_EPOCH_BINDING,
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
    this.#expiresAt = null
    this.#operations.clear()
  }

  cancelIfCurrent(token: StudyLifecycleToken, reason: StudyCancellationReason): void {
    if (token.isCurrent()) this.cancel(reason)
  }

  /**
   * STUDY-A1-LIFECYCLE-AUTHORITY — attaches to the epoch this binding names, and
   * NEVER begins one.
   *
   * A mounted surface holds a seam it was handed at some earlier render, and a
   * remount has to be able to pick the epoch back up. That used to be served by
   * handing the seam's binding to `beginEpoch`, which meant a surface could
   * CREATE authority out of metadata it had been carrying around — and the
   * binding it carries names the deadline the epoch was born with, not the one
   * the authority has since restated.
   *
   * Both directions of that were live defects. Extended: the birth deadline
   * passed while the epoch was valid for another ninety seconds, and a remount
   * began a fresh epoch on the stale deadline and cancelled it as
   * `grant-expired` — Study taken away from a learner nobody had de-authorized.
   * Shortened: the authority pulled the window in, the epoch honoured it and
   * cancelled, and a remount rebuilt a fully current epoch from the later birth
   * deadline — guarded work authorized past the point the server allowed.
   *
   * So a join is an attachment and nothing else. Authority is established by the
   * controlling lifecycle root — the verified launch in production, the App's own
   * `createHostStudyLifecycleSeam` in preview — and a join either finds that
   * epoch live and returns its token, or fails closed. The fingerprint is
   * computed here, from this class's own function, so a caller cannot widen what
   * counts as "the same epoch" by passing a key it built itself.
   */
  joinCurrentEpoch(binding: StudyLifecycleBinding): StudyLifecycleToken {
    const token = this.token()
    // `isCurrent` first, and deliberately: it runs the lapsed-deadline check, so
    // an epoch whose renewed lease has run out is cancelled before anything here
    // can read a fingerprint that would say it is still the live one.
    if (token.isCurrent() && this.#fingerprint === fingerprint(binding)) return token
    return this.#refusedToken()
  }

  /**
   * STUDY-A1-LEASE-EXTEND — moves the CURRENT epoch's deadline to the one the
   * authority has just restated, and moves nothing else.
   *
   * A readiness refresh for the same host session, the same learner and the same
   * installed verified session is not a new authority; it is the same authority
   * saying how long it still has. Running `beginEpoch` for that rotated the
   * epoch: a new binding object, a new AbortController, every token an in-flight
   * turn was holding made stale, and — because the mounted Study surfaces are
   * held by that binding object — an unmount, a `navigation-away` cancel and a
   * session prepared again from the top, in the middle of a girl's answer.
   *
   * So the epoch number, the binding object, the AbortController and the
   * duplicate-operation ledger are all kept, and only the deadline and its timer
   * change. Nothing in this signature could carry learner, household, grant or
   * authorization identity, so a renewal cannot move an epoch onto a different
   * authority; that still requires `beginEpoch`, which cancels the old one.
   *
   * A later deadline and an earlier one are both honoured: the authority's latest
   * word is the one the timer must follow, and refusing to shorten would leave
   * the epoch alive past the point the authority allows.
   *
   * Null means "not renewed, and nothing changed" — there is no live epoch to
   * renew, or the deadline offered is not a usable future instant. A refusal
   * never grants time the epoch was not given and never takes away time it
   * already holds, so a caller that ignores the null still cannot outlive the
   * lease it began with; it must call `beginEpoch` if it needs a session anyway.
   *
   * STUDY-A1-LIFECYCLE-AUTHORITY — token-scoped, on the `cancelIfCurrent`
   * pattern. Extending a lease is an authority decision, so the caller proves it
   * still holds the epoch it is extending: the token must have been minted by
   * THIS boundary and must still be current. A stale token from an epoch this
   * boundary has moved on from cannot buy the new one more time, and neither can
   * a perfectly current token belonging to some other boundary — that token's own
   * `isCurrent` answers about ITS epoch, so the ownership check is what makes the
   * currency check mean anything here.
   */
  renewEpochLeaseIfCurrent(token: StudyLifecycleToken, expiresAt: string): StudyLifecycleToken | null {
    // One `isCurrent` covers the lapsed deadline, the cancelled epoch, the
    // never-begun boundary and the rotated epoch.
    if (TOKEN_OWNERS.get(token) !== this || !token.isCurrent()) return null
    const deadline = Date.parse(expiresAt)
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return null
    this.#expiresAt = expiresAt
    this.#scheduleExpiration()
    return this.token()
  }

  get lastReason(): StudyCancellationReason | null {
    return this.#reason
  }

  get binding(): StudyLifecycleBinding | null {
    return this.#binding
  }

  /**
   * STUDY-A1-LIFECYCLE-AUTHORITY — the deadline this epoch is ACTUALLY enforced
   * at, and the only one an authority decision may be taken from.
   * `binding.expiresAt` is the deadline the epoch was BORN with and stops being
   * the enforced one the moment a renewal moves it. Null when there is no epoch,
   * and null for an epoch bound without a deadline.
   */
  get leaseExpiresAt(): string | null {
    return this.#expiresAt
  }

  /** A token naming no epoch, for a join this boundary refused. */
  #refusedToken(): StudyLifecycleToken {
    const reason = this.#reason ?? 'authorization-loss'
    return Object.freeze({
      epoch: this.#epoch,
      binding: NO_EPOCH_BINDING,
      signal: AbortSignal.abort(reason),
      isCurrent: () => false,
      assertCurrent: () => { throw new StudyLifecycleAbortError(reason) },
    })
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
    if (this.#binding && this.#expiresAt && Date.parse(this.#expiresAt) <= Date.now()) {
      this.cancel('grant-expired')
    }
  }

  #scheduleExpiration(): void {
    this.#clearExpiration()
    if (!this.#expiresAt) return
    const remaining = Date.parse(this.#expiresAt) - Date.now()
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

// STUDY-A1-LIFECYCLE-AUTHORITY — `acquireHostStudyLifecycle` and its own
// owner->boundary `HOST_LIFECYCLES` registry were removed here.
//
// It had no caller outside its own characterisation test, but it was exported
// through this module, the `study/lifecycle` barrel and the `study/production`
// barrels, so any future import of it would have minted a SECOND lifecycle
// authority for an App owner that already has one — independently current, and
// therefore still authorizing after the App's logout, learner switch and
// authorization-loss paths had cancelled the one they know about.
//
// `hostStudyLifecycleBoundary` in study/composition/hostStudyLifecycle.ts is the
// single owner-keyed registry, and its module test asserts that nothing else
// mints one.
