export type StudyCancellationReason =
  | 'logout'
  | 'learner-switch'
  | 'household-switch'
  | 'session-expired'
  | 'membership-revoked'
  | 'relationship-revoked'
  | 'feature-disabled'
  | 'safety-stop'
  | 'navigation-away'
  | 'stale-checkpoint'
  | 'authorization-loss'

export interface StudyLifecycleToken {
  readonly epoch: number
  readonly signal: AbortSignal
  isCurrent(): boolean
  assertCurrent(): void
}

function staleLifecycleError(): DOMException {
  return new DOMException('Stale Study lifecycle.', 'AbortError')
}

/** One cancellation boundary shared by every request and durable mutation chain. */
export class StudyLifecycleBoundary {
  #epoch = 1
  #controller = new AbortController()
  #reason: StudyCancellationReason | null = null

  token(): StudyLifecycleToken {
    const epoch = this.#epoch
    const signal = this.#controller.signal
    return Object.freeze({
      epoch,
      signal,
      isCurrent: () => epoch === this.#epoch && !signal.aborted,
      assertCurrent: () => {
        if (epoch !== this.#epoch || signal.aborted) throw staleLifecycleError()
      },
    })
  }

  cancel(reason: StudyCancellationReason): void {
    this.#reason = reason
    this.#controller.abort(reason)
    this.#epoch += 1
    this.#controller = new AbortController()
  }

  get lastReason(): StudyCancellationReason | null {
    return this.#reason
  }
}

/**
 * Guards an asynchronous browser/host operation on both sides of its await.
 * Implementations should also honor the supplied signal so in-flight network
 * work can stop promptly; the second assertion quarantines work that cannot.
 */
export async function runCurrentStudyWork<T>(
  token: StudyLifecycleToken,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  token.assertCurrent()
  try {
    const result = await work(token.signal)
    token.assertCurrent()
    return result
  } catch (error) {
    token.assertCurrent()
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
