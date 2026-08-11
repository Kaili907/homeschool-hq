export const ADMIN_DEPENDENCY_TIMEOUT_MS = 10_000

export class AdminDependencyTimeoutError extends Error {
  constructor() {
    super('admin dependency unavailable')
    this.name = 'AdminDependencyTimeoutError'
  }
}

/** Settles even when a test double, token provider, or transport ignores AbortSignal. */
export function withAdminDependencyTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = ADMIN_DEPENDENCY_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (complete: () => void) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timer)
      complete()
    }
    const timer = globalThis.setTimeout(() => {
      controller.abort()
      finish(() => reject(new AdminDependencyTimeoutError()))
    }, timeoutMs)
    void Promise.resolve()
      .then(() => operation(controller.signal))
      .then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      )
  })
}
