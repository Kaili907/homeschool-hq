import { describe, expect, it } from 'vitest'
import { StudyLifecycleBoundary, composeAbortSignals, runCurrentStudyWork } from './lifecycleBoundary'

const binding = {
  authenticatedSessionRef: 'session:synthetic-safe',
  householdRef: 'household:synthetic-safe',
  learnerRef: 'learner:synthetic-safe',
  launchGrantRef: 'grant:synthetic-safe',
  featureEnabled: true,
  authorizationRevision: 1,
} as const

describe('Study identity lifecycle cancellation', () => {
  it.each([
    'logout', 'learner-switch', 'household-switch', 'session-expired', 'membership-revoked',
    'relationship-revoked', 'feature-disabled', 'safety-stop', 'navigation-away',
    'stale-checkpoint', 'authorization-loss',
  ] as const)('invalidates outstanding work on %s', (reason) => {
    const boundary = new StudyLifecycleBoundary(binding)
    const stale = boundary.token()
    boundary.cancel(reason)
    expect(stale.signal.aborted).toBe(true)
    expect(stale.isCurrent()).toBe(false)
    expect(() => stale.assertCurrent()).toThrow()
    expect(boundary.token().isCurrent()).toBe(false)
    expect(boundary.lastReason).toBe(reason)
  })

  it('propagates the first safety or host cancellation signal', () => {
    const host = new AbortController()
    const timeout = new AbortController()
    const combined = composeAbortSignals([host.signal, timeout.signal])
    host.abort('learner-switch')
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe('learner-switch')
  })

  it.each(['logout', 'learner-switch', 'navigation-away'] as const)(
    'quarantines a result that resolves after %s',
    async (reason) => {
      const boundary = new StudyLifecycleBoundary(binding)
      const token = boundary.token()
      const applied: string[] = []
      let resolveWork!: (value: string) => void
      const pendingWork = new Promise<string>((resolve) => { resolveWork = resolve })
      const guarded = runCurrentStudyWork(token, async (signal) => {
        expect(signal).toBe(token.signal)
        return pendingWork
      }).then((value) => { applied.push(value) })

      boundary.cancel(reason)
      resolveWork('stale-result')

      await expect(guarded).rejects.toMatchObject({ name: 'AbortError' })
      expect(token.signal.aborted).toBe(true)
      expect(token.signal.reason).toBe(reason)
      expect(applied).toEqual([])
    },
  )

  it('does not start work when the lifecycle is already cancelled', async () => {
      const boundary = new StudyLifecycleBoundary(binding)
    const token = boundary.token()
    boundary.cancel('feature-disabled')
    let invoked = false
    await expect(runCurrentStudyWork(token, async () => {
      invoked = true
      return 'unreachable'
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(invoked).toBe(false)
  })

  it('keeps the first abort reason when multiple signals race', () => {
    const logout = new AbortController()
    const navigation = new AbortController()
    const combined = composeAbortSignals([logout.signal, navigation.signal])
    navigation.abort('navigation-away')
    logout.abort('logout')
    expect(combined.reason).toBe('navigation-away')
  })
})
