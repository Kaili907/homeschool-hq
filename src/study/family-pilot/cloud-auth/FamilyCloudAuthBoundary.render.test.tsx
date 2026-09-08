import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FamilyCloudAuthBoundary } from './FamilyCloudAuthBoundary'
import type { FamilyCloudAuthRuntime } from './types'

describe('Family Cloud account gateway', () => {
  it('makes provider account creation and sign-in reachable before local controllers mount', () => {
    const runtime = {
      snapshot: () => ({ status: 'SIGNED_OUT' as const }),
      subscribe: () => () => undefined,
      bootstrap: vi.fn(),
      refreshProviderSession: vi.fn(),
      providerSignedOut: vi.fn(),
      createAccount: vi.fn(),
      requestPasswordRecovery: vi.fn(),
      requestMagicLink: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      reconcile: vi.fn(),
    } as unknown as FamilyCloudAuthRuntime
    const html = renderToStaticMarkup(
      <FamilyCloudAuthBoundary runtime={runtime}>{() => <p>learner controller mounted</p>}</FamilyCloudAuthBoundary>,
    )
    expect(html).toContain('Sign in to Manuel Academy')
    expect(html).toContain('Set up Family Cloud')
    expect(html).toContain('Family account password')
    expect(html).toContain('Forgot password?')
    expect(html).toContain('Email me a sign-in link')
    expect(html).not.toContain('learner controller mounted')
  })
})
