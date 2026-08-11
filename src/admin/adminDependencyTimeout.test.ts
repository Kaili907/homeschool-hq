import { describe, expect, it, vi } from 'vitest'
import {
  AdminDependencyTimeoutError,
  withAdminDependencyTimeout,
} from './adminDependencyTimeout'

describe('Admin dependency timeout seam', () => {
  it('settles and aborts even when a dependency ignores its signal', async () => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | undefined
      const operation = withAdminDependencyTimeout((candidate) => {
        signal = candidate
        return new Promise<never>(() => {})
      }, 25)
      const rejected = expect(operation).rejects.toEqual(new AdminDependencyTimeoutError())
      await vi.advanceTimersByTimeAsync(26)
      await rejected
      expect(signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
