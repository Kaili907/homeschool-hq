import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  StudyLifecycleAbortError,
  StudyLifecycleBoundary,
  runCurrentStudyWork,
  type StudyLifecycleBinding,
} from './StudyLifecycle'

const NOW = '2026-08-01T16:00:00.000Z'
const LEASE_ONE = '2026-08-01T16:00:30.000Z'
const LEASE_TWO = '2026-08-01T16:01:00.000Z'

/** The shape the verified production runtime binds: host-local labels only. */
const BINDING: StudyLifecycleBinding = Object.freeze({
  authenticatedSessionRef: 'host-lifecycle:local-epoch-one',
  householdRef: 'server-bound-authority',
  learnerRef: 'selected-learner-epoch:1',
  launchGrantRef: 'opaque-grant-epoch:1',
  featureEnabled: true,
  authorizationRevision: 1,
  expiresAt: LEASE_ONE,
})

function boundaryAtNow(binding: StudyLifecycleBinding = BINDING): StudyLifecycleBoundary {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  return new StudyLifecycleBoundary(binding)
}

afterEach(() => vi.useRealTimers())

describe('Study lifecycle epoch lease renewal', () => {
  it('moves the deadline while every part of the epoch identity stays the same object', () => {
    const lifecycle = boundaryAtNow()
    const before = lifecycle.token()
    const bound = lifecycle.binding

    const renewed = lifecycle.renewEpochLease(LEASE_TWO)

    expect(renewed).not.toBeNull()
    expect(renewed!.epoch).toBe(before.epoch)
    // Identity, not equality: `currentHostStudyLifecycleSeam` caches on this
    // exact object, so a copy would remount every mounted Study surface.
    expect(lifecycle.binding).toBe(bound)
    expect(renewed!.binding).toBe(bound)
    expect(renewed!.signal).toBe(before.signal)
    expect(before.isCurrent()).toBe(true)
    expect(before.signal.aborted).toBe(false)
    expect(lifecycle.lastReason).toBeNull()
  })

  it('is the only way to move the deadline without rotating the epoch', () => {
    const lifecycle = boundaryAtNow()
    const before = lifecycle.token()

    lifecycle.beginEpoch({ ...BINDING, expiresAt: LEASE_TWO })

    expect(lifecycle.token().epoch).toBe(before.epoch + 1)
    expect(before.isCurrent()).toBe(false)
    expect(before.signal.reason).toBe('new-lifecycle-epoch')
  })

  it('cancels once at the renewed deadline and never at the one it replaced', () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    let aborts = 0
    token.signal.addEventListener('abort', () => { aborts += 1 })

    expect(lifecycle.renewEpochLease(LEASE_TWO)).not.toBeNull()

    // Past the lease the epoch was BORN with. A surviving old timer cancels here.
    vi.advanceTimersByTime(31_000)
    expect(token.isCurrent()).toBe(true)
    expect(aborts).toBe(0)

    vi.advanceTimersByTime(30_000)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('grant-expired')
    expect(aborts).toBe(1)
    // The replaced timer was cleared rather than left pending.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps in-flight guarded work running across a renewal', async () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    let resolve!: (value: string) => void
    const pending = new Promise<string>((done) => { resolve = done })
    const guarded = runCurrentStudyWork(token, async () => pending, { operationRef: 'turn:one' })

    expect(lifecycle.renewEpochLease(LEASE_TWO)).not.toBeNull()
    resolve('accepted')

    await expect(guarded).resolves.toBe('accepted')
  })

  it('keeps the duplicate-operation ledger of the epoch it renewed', async () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    await expect(runCurrentStudyWork(token, async () => 'first', { operationRef: 'turn:one' }))
      .resolves.toBe('first')

    expect(lifecycle.renewEpochLease(LEASE_TWO)).not.toBeNull()

    await expect(runCurrentStudyWork(lifecycle.token(), async () => 'replay', { operationRef: 'turn:one' }))
      .rejects.toMatchObject({ name: 'AbortError', reason: 'duplicate-response' })
  })

  it('refuses to resurrect a cancelled epoch', () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    lifecycle.cancel('navigation-away')

    expect(lifecycle.renewEpochLease(LEASE_TWO)).toBeNull()
    expect(token.isCurrent()).toBe(false)
    expect(lifecycle.binding).toBeNull()
    expect(lifecycle.lastReason).toBe('navigation-away')
  })

  it('refuses an epoch whose own lease has already run out', () => {
    const lifecycle = boundaryAtNow()
    vi.setSystemTime(new Date('2026-08-01T16:00:31.000Z'))

    expect(lifecycle.renewEpochLease(LEASE_TWO)).toBeNull()
    expect(lifecycle.binding).toBeNull()
    expect(lifecycle.lastReason).toBe('grant-expired')
  })

  it('refuses a boundary that has never begun an epoch', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    const lifecycle = new StudyLifecycleBoundary()

    expect(lifecycle.renewEpochLease(LEASE_TWO)).toBeNull()
    expect(lifecycle.binding).toBeNull()
  })

  it.each([
    ['empty', ''],
    ['unparseable', 'the-day-after-tomorrow'],
    ['already past', '2026-08-01T15:59:59.000Z'],
    ['exactly now', NOW],
  ])('refuses a %s deadline and grants no extra time', (_label, expiresAt) => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()

    expect(lifecycle.renewEpochLease(expiresAt)).toBeNull()

    // Refused, not destroyed: the epoch keeps exactly the lease it was granted
    // and gains nothing, so a bad refresh cannot end a live turn either way.
    expect(token.isCurrent()).toBe(true)
    vi.advanceTimersByTime(31_000)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('grant-expired')
  })

  it('shortens the lease when the authority says the epoch ends sooner', () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()

    expect(lifecycle.renewEpochLease('2026-08-01T16:00:10.000Z')).not.toBeNull()

    vi.advanceTimersByTime(11_000)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('grant-expired')
  })

  it('leaves a renewed epoch reusable by beginEpoch with the binding it was built from', () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    expect(lifecycle.renewEpochLease(LEASE_TWO)).not.toBeNull()

    // What a remounting surface does through `joinHostStudyLifecycle`.
    const rejoined = lifecycle.beginEpoch(BINDING)

    expect(rejoined.epoch).toBe(token.epoch)
    expect(token.isCurrent()).toBe(true)
    vi.advanceTimersByTime(31_000)
    expect(token.isCurrent()).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(token.isCurrent()).toBe(false)
  })

  it('starts no work on a renewed epoch once the renewed deadline passes', async () => {
    const lifecycle = boundaryAtNow()
    const token = lifecycle.token()
    expect(lifecycle.renewEpochLease(LEASE_TWO)).not.toBeNull()
    vi.advanceTimersByTime(61_000)

    let invoked = false
    await expect(runCurrentStudyWork(token, async () => {
      invoked = true
      return 'unreachable'
    })).rejects.toBeInstanceOf(StudyLifecycleAbortError)
    expect(invoked).toBe(false)
  })
})
