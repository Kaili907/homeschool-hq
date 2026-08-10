import type { SecurityLifecycleEvent } from '../contracts/lifecycle'

export type SecurityLifecycleSink = (
  event: SecurityLifecycleEvent,
) => void | Promise<unknown>

/**
 * Keeps autonomous lifecycle effects ordered and observes every returned
 * Promise. Rejections are contained so browser event callbacks never create an
 * unhandled rejection; the owning controller supplies the fail-closed action.
 */
export class SerializedLifecycleDelivery {
  readonly #sink?: SecurityLifecycleSink
  #tail: Promise<void> = Promise.resolve()
  #failed = false

  constructor(sink?: SecurityLifecycleSink) {
    this.#sink = sink
  }

  enqueue(event: SecurityLifecycleEvent, onRejected: () => void): Promise<boolean> {
    let delivered = true
    const rejectSafely = () => {
      delivered = false
      this.#failed = true
      try {
        onRejected()
      } catch {
        // Rejection handling must itself remain contained.
      }
    }
    const run = this.#tail.then(async () => {
      if (!this.#sink) return
      try {
        await this.#sink(event)
      } catch {
        rejectSafely()
      }
    })
    this.#tail = run.catch(() => {
      rejectSafely()
    })
    return this.#tail.then(() => delivered)
  }

  whenIdle(): Promise<void> {
    return this.#tail
  }

  get failed(): boolean {
    return this.#failed
  }
}
