import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  StudyLifecycleAbortError,
  StudyLifecycleBoundary,
  runCurrentStudyWork,
  type StudyCancellationReason,
  type StudyLifecycleBinding,
} from './StudyLifecycle'

const baseBinding: StudyLifecycleBinding = Object.freeze({
  authenticatedSessionRef: 'session:verified-a',
  householdRef: 'household:verified-a',
  learnerRef: 'learner:verified-a',
  launchGrantRef: 'grant:verified-a',
  featureEnabled: true,
  authorizationRevision: 1,
  expiresAt: '2099-08-01T12:00:00.000Z',
  identityEpochs: {
    authenticatedSession: 1,
    household: 1,
    learner: 1,
    membership: 1,
    relationship: 1,
  },
})

afterEach(() => vi.useRealTimers())

describe('canonical Study lifecycle epoch', () => {
  it('reuses an exact verified binding and rotates for every authority-bearing change', () => {
    const changes: ReadonlyArray<[Partial<StudyLifecycleBinding>, StudyCancellationReason]> = [
      [{ learnerRef: 'learner:verified-b' }, 'learner-switch'],
      [{ householdRef: 'household:verified-b' }, 'household-switch'],
      [{ authenticatedSessionRef: 'session:verified-b' }, 'session-expired'],
      [{ launchGrantRef: 'grant:verified-b' }, 'new-lifecycle-epoch'],
      [{ authorizationRevision: 2 }, 'new-lifecycle-epoch'],
      [{ featureEnabled: false }, 'feature-disabled'],
    ]

    for (const [change, reason] of changes) {
      const lifecycle = new StudyLifecycleBoundary(baseBinding)
      const first = lifecycle.token()
      expect(lifecycle.beginEpoch(baseBinding).epoch).toBe(first.epoch)
      const previous = lifecycle.token()
      lifecycle.beginEpoch({ ...baseBinding, ...change })
      expect(previous.isCurrent()).toBe(false)
      expect(previous.signal.reason).toBe(reason)
    }
  })

  it.each([
    ['learner A result after learner B switch', 'learner-switch'],
    ['logout during safety classification', 'logout'],
    ['logout during Tutor response', 'logout'],
    ['revocation during checkpoint save', 'membership-revoked'],
    ['feature disable during calendar mutation', 'feature-disabled'],
    ['old checkpoint after reauthentication', 'session-expired'],
    ['old grant after grant rotation', 'new-lifecycle-epoch'],
    ['stale safety result after epoch change', 'authorization-loss'],
  ] as const)('quarantines %s', async (_scenario, reason) => {
    const lifecycle = new StudyLifecycleBoundary(baseBinding)
    const token = lifecycle.token()
    let resolve!: (value: string) => void
    const pending = new Promise<string>((done) => { resolve = done })
    const applied: string[] = []
    const guarded = runCurrentStudyWork(
      token,
      async () => pending,
      { operationRef: `operation:${_scenario}` },
    ).then((value) => applied.push(value))

    lifecycle.cancel(reason)
    resolve('stale-result')

    await expect(guarded).rejects.toBeInstanceOf(StudyLifecycleAbortError)
    expect(applied).toEqual([])
  })

  it('quarantines duplicate responses in one epoch', async () => {
    const lifecycle = new StudyLifecycleBoundary(baseBinding)
    const token = lifecycle.token()
    await expect(runCurrentStudyWork(
      token,
      async () => 'first',
      { operationRef: 'request:one' },
    )).resolves.toBe('first')
    await expect(runCurrentStudyWork(
      token,
      async () => 'duplicate',
      { operationRef: 'request:one' },
    )).rejects.toMatchObject({ name: 'AbortError', reason: 'duplicate-response' })
  })

  it('expires a short-lived launch grant and starts no later work', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    const lifecycle = new StudyLifecycleBoundary({
      ...baseBinding,
      expiresAt: '2026-08-01T12:00:01.000Z',
    })
    const token = lifecycle.token()
    vi.advanceTimersByTime(1_001)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('grant-expired')
    let invoked = false
    await expect(runCurrentStudyWork(token, async () => {
      invoked = true
      return 'unreachable'
    })).rejects.toBeInstanceOf(StudyLifecycleAbortError)
    expect(invoked).toBe(false)
  })
})
