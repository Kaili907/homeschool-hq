import type { SecurityLifecycleEvent } from '../contracts/lifecycle'

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
    this.#tail = run.catch(async () => {
      await rejectSafely()
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

  get failed(): boolean {
    return this.#failed
  }
}
