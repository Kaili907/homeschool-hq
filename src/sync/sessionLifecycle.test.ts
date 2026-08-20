import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AuthChangeEvent,
  Session,
  Subscription,
  SupabaseClient,
} from '@supabase/supabase-js'
import { onAuthSessionChange } from './supabase'

type ListenerFn = (event: AuthChangeEvent, session: Session | null) => void

interface FakeClientState {
  listener: ListenerFn | null
  unsubscribed: number
  unsubscribeThrows: boolean
}

function fakeSupabaseClient(): {
  client: SupabaseClient
  state: FakeClientState
  fire: (event: AuthChangeEvent, session: Session | null) => void
} {
  const state: FakeClientState = {
    listener: null,
    unsubscribed: 0,
    unsubscribeThrows: false,
  }
  const subscription: Subscription = {
    id: 'sub',
    callback: () => undefined,
    unsubscribe: () => {
      state.unsubscribed += 1
      state.listener = null
      if (state.unsubscribeThrows) {
        throw new Error('sdk unsubscribe boom')
      }
    },
  }
  const client = {
    auth: {
      onAuthStateChange: (listener: ListenerFn) => {
        state.listener = listener
        return { data: { subscription } }
      },
    },
  } as unknown as SupabaseClient
  return {
    client,
    state,
    fire: (event, session) => state.listener?.(event, session),
  }
}

describe('onAuthSessionChange terminal-teardown lifecycle', () => {
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)

  afterEach(() => {
    consoleErrorSpy.mockClear()
  })

  it('contains a throwing listener and preserves later delivery', () => {
    const { client, fire } = fakeSupabaseClient()
    const received: AuthChangeEvent[] = []
    const unsubscribe = onAuthSessionChange((event) => {
      received.push(event)
      if (event === 'SIGNED_OUT') {
        throw new Error('listener boom on end')
      }
    }, client)

    expect(() => fire('SIGNED_OUT', null)).not.toThrow()
    // A later fire still reaches the listener; one bad delivery cannot
    // permanently disable the subscription.
    expect(() =>
      fire('SIGNED_IN', {
        access_token: 't',
        user: { id: 'u' },
      } as unknown as Session),
    ).not.toThrow()

    expect(received).toEqual(['SIGNED_OUT', 'SIGNED_IN'])
    expect(consoleErrorSpy).toHaveBeenCalled()

    unsubscribe()
  })

  it('never propagates a synchronously-thrown listener error to unsubscribe', () => {
    const { client, fire } = fakeSupabaseClient()
    const unsubscribe = onAuthSessionChange(() => {
      throw new Error('always throws')
    }, client)

    fire('SIGNED_OUT', null)
    expect(() => unsubscribe()).not.toThrow()
  })

  it('unsubscribe is idempotent: repeated teardown invokes the SDK only once', () => {
    const { client, state } = fakeSupabaseClient()
    const unsubscribe = onAuthSessionChange(() => undefined, client)

    unsubscribe()
    unsubscribe()
    unsubscribe()

    expect(state.unsubscribed).toBe(1)
  })

  it('ignores a late SDK fire after unsubscribe (async race cannot restore ended state)', () => {
    const { client, state, fire } = fakeSupabaseClient()
    let deliveries = 0
    const unsubscribe = onAuthSessionChange(() => {
      deliveries += 1
    }, client)

    // Simulate an SDK that delivers one more event after unsubscribe returns.
    // The shielded wrapper still exists; it must ignore the late fire.
    const lateListener = state.listener
    unsubscribe()
    lateListener?.('TOKEN_REFRESHED', null)

    expect(deliveries).toBe(0)
  })

  it('swallows an SDK unsubscribe throw and still marks teardown complete', () => {
    const { client, state } = fakeSupabaseClient()
    state.unsubscribeThrows = true
    const unsubscribe = onAuthSessionChange(() => undefined, client)

    expect(() => unsubscribe()).not.toThrow()
    // Second call is a no-op; the SDK is not called again even though the
    // first call threw internally.
    expect(() => unsubscribe()).not.toThrow()
    expect(state.unsubscribed).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[sync/auth-session] listener failed for',
      'unsubscribe',
      expect.any(Error),
    )
  })

  it('does not propagate a rejected async chain from inside the listener', async () => {
    const { client, fire } = fakeSupabaseClient()
    const rejections: unknown[] = []
    const handleRejection = (event: PromiseRejectionEvent | Event) => {
      rejections.push(
        (event as PromiseRejectionEvent).reason ?? new Error('unknown'),
      )
    }
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', handleRejection)
    }
    const unsubscribe = onAuthSessionChange((_event) => {
      // Listener starts an async chain that rejects; the terminal cleanup
      // path must not depend on the caller catching it.
      void Promise.reject(new Error('async listener boom'))
    }, client)

    fire('SIGNED_OUT', null)
    // Let the microtask queue drain.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // The synchronous fire returned cleanly; the rejection is the listener's
    // problem, not the subscription's, and unsubscribe still succeeds.
    expect(() => unsubscribe()).not.toThrow()

    if (typeof process !== 'undefined') {
      process.off('unhandledRejection', handleRejection)
    }
  })

  it('is safe to call unsubscribe from inside the listener (reentrant teardown)', () => {
    const { client, state, fire } = fakeSupabaseClient()
    let calls = 0
    const captured: { unsubscribe: (() => void) | null } = {
      unsubscribe: null,
    }
    captured.unsubscribe = onAuthSessionChange(() => {
      calls += 1
      // Simulate an end-listener that tears itself down.
      captured.unsubscribe?.()
    }, client)

    fire('SIGNED_OUT', null)
    // A second fire (in case the SDK re-enters) is now a no-op.
    fire('SIGNED_OUT', null)

    expect(calls).toBe(1)
    expect(state.unsubscribed).toBe(1)
  })

  it('returns a no-op unsubscribe when Supabase is not configured', () => {
    const unsubscribe = onAuthSessionChange(() => undefined, null)
    expect(() => {
      unsubscribe()
      unsubscribe()
    }).not.toThrow()
  })
})
