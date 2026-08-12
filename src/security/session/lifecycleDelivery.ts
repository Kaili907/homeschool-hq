import type { SecurityLifecycleEvent } from '../contracts/lifecycle'

/**
 * Effect-only lifecycle consumer. A sink must not await a settlement-waiting
 * global revocation from inside delivery: initiating revocation belongs in the
 * controller's before-delivery phase, which publishes durably before the sink
 * and awaits subscriber settlement after this serialized queue drains.
 */
export type SecurityLifecycleSink = (
  event: SecurityLifecycleEvent,
) => void | Promise<unknown>

/**
 * Keeps lifecycle effects ordered and observes every returned Promise.
 * Rejections are contained so browser event callbacks never create an
 * unhandled rejection; the owning controller supplies the fail-closed action.
 */
export class SerializedLifecycleDelivery {
  readonly #sink?: SecurityLifecycleSink
  #tail: Promise<void> = Promise.resolve()
  #queued = 0
  #failed = false

  constructor(sink?: SecurityLifecycleSink) {
    this.#sink = sink
  }

  enqueue(
    event: SecurityLifecycleEvent,
    onRejected: () => void | Promise<void>,
    beforeDelivery?: () => void | Promise<void>,
    stopAfterFailure = false,
  ): Promise<boolean> {
    let delivered = true
    const rejectSafely = async () => {
      if (!delivered) return
      delivered = false
      this.#failed = true
      try {
        await onRejected()
      } catch {
        // Rejection handling must itself remain contained.
      }
    }
    this.#queued += 1
    const run = this.#tail.then(async () => {
      if (stopAfterFailure && this.#failed) {
        delivered = false
        return
      }
      try {
        await beforeDelivery?.()
        await this.#sink?.(event)
      } catch {
        await rejectSafely()
      }
    })
    // The decrement is part of the tail itself, so whenIdle() resolving always
    // implies pending === false for a caller that observes it afterwards.
    this.#tail = run.catch(async () => {
      await rejectSafely()
    }).then(() => {
      this.#queued -= 1
    })
    return this.#tail.then(() => delivered)
  }

  whenIdle(): Promise<void> {
    return this.#tail
  }

  /** Drains the authoritative queue and rejects permanently after any failure. */
  async requireClean(): Promise<void> {
    for (;;) {
      const observedTail = this.#tail
      await observedTail
      if (this.#failed) throw new Error('Security lifecycle delivery failed closed.')
      if (observedTail === this.#tail) return
    }
  }

  /**
   * Synchronously true while authority-removing cleanup is still queued. A
   * caller that cannot await — a synchronous authority factory — must refuse on
   * this rather than await the queue, which would reopen the window it closes.
   */
  get pending(): boolean {
    return this.#queued > 0
  }

  get failed(): boolean {
    return this.#failed
  }
}
