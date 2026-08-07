import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  runCurrentStudyWork,
  type StudyLifecycleBinding,
} from '../lifecycle'
import {
  currentHostStudyLifecycleSeam,
  hostStudyLifecycleBoundary,
  joinHostStudyLifecycle,
  type HostStudyLifecycleSeam,
} from './hostStudyLifecycle'

/**
 * STUDY-A1-LIFECYCLE-AUTHORITY — a host surface JOIN may never create authority.
 *
 * The lease renewal this branch starts from moves the epoch's enforced deadline
 * without rotating the epoch, which is what keeps a girl's in-flight turn alive
 * across a readiness refresh. It deliberately leaves the binding object alone, so
 * after a renewal `binding.expiresAt` is the deadline the epoch was BORN with and
 * the boundary's own live deadline is the one it will actually be cancelled at.
 *
 * Every test below is about what happens when a surface rejoins across that gap.
 * They use the real lifecycle core and the real host seam — the same two calls the
 * mounted route and container make — because the gap only exists between them.
 */

const NOW = '2026-08-01T16:00:00.000Z'
/** The deadline an epoch is born with. */
const BIRTH = '2026-08-01T16:00:30.000Z'
/** A later deadline the authority restates: the EXTEND case. */
const LATER = '2026-08-01T16:02:00.000Z'
/** An earlier deadline the authority restates: the SHORTEN case. */
const SOONER = '2026-08-01T16:00:10.000Z'

/** Exactly the shape the verified production runtime binds: host-local labels. */
function launchBinding(expiresAt: string): StudyLifecycleBinding {
  return {
    authenticatedSessionRef: 'host-lifecycle:authority-card',
    householdRef: 'server-bound-authority',
    learnerRef: 'selected-learner-epoch:1',
    launchGrantRef: 'opaque-grant-epoch:1',
    featureEnabled: true,
    authorizationRevision: 1,
    expiresAt,
  }
}

/**
 * A verified launch, then the seam a mounted surface is handed — reached through
 * the App's own owner-keyed boundary, so this is the production wiring and not a
 * boundary invented for the test.
 */
function launched(expiresAt: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  const owner = {}
  const boundary = hostStudyLifecycleBoundary(owner)
  const launchToken = boundary.beginEpoch(launchBinding(expiresAt))
  const seam = currentHostStudyLifecycleSeam(owner) as HostStudyLifecycleSeam
  expect(seam).not.toBeNull()
  return { owner, boundary, launchToken, seam }
}

afterEach(() => vi.useRealTimers())

describe('rejoining after the authority EXTENDED the lease', () => {
  it('joins the still-valid epoch when the birth deadline has passed', () => {
    const { boundary, seam, launchToken } = launched(BIRTH)
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, LATER)).not.toBeNull()

    // Past the deadline the epoch was born with, inside the one it now holds.
    vi.setSystemTime(new Date('2026-08-01T16:00:31.000Z'))
    expect(launchToken.isCurrent()).toBe(true)

    const joined = joinHostStudyLifecycle(seam)

    expect(joined.isCurrent()).toBe(true)
    expect(joined.epoch).toBe(launchToken.epoch)
    // Nothing about the epoch moved: no cancel, no new epoch, the same binding
    // object the mounted surfaces hold, and the in-flight token still authorizes.
    expect(boundary.lastReason).toBeNull()
    expect(boundary.binding).toBe(seam.binding)
    expect(launchToken.isCurrent()).toBe(true)
  })

  it('does not abort a turn already in flight when a surface remounts', async () => {
    const { boundary, seam, launchToken } = launched(BIRTH)
    let resolve!: (value: string) => void
    const pending = new Promise<string>((done) => { resolve = done })
    const turn = runCurrentStudyWork(launchToken, async () => pending, { operationRef: 'turn:one' })
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, LATER)).not.toBeNull()

    vi.setSystemTime(new Date('2026-08-01T16:00:31.000Z'))
    expect(joinHostStudyLifecycle(seam).isCurrent()).toBe(true)

    resolve('accepted')
    await expect(turn).resolves.toBe('accepted')
  })

  /**
   * The defect this card closes, in the EXTEND direction. A mounted surface
   * cancels the epoch when it unmounts, so navigating away and back is the
   * ordinary remount path — and `joinHostStudyLifecycle` used to answer it by
   * feeding the seam's binding back into `beginEpoch`. That binding still names
   * the BIRTH deadline, so a rejoin one second after it passed began a fresh
   * epoch on an already-expired grant and cancelled it on the way in: Study
   * unavailable for a learner whose authority is valid for another ninety
   * seconds, with no host or server decision behind it.
   */
  it('does not grant-expire a valid epoch when the held seam names the birth deadline', () => {
    const { boundary, seam, launchToken } = launched(BIRTH)
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, LATER)).not.toBeNull()
    // The unmount half of a navigate-away-and-back.
    boundary.cancel('navigation-away')

    vi.setSystemTime(new Date('2026-08-01T16:00:31.000Z'))
    const rejoined = joinHostStudyLifecycle(seam)

    // Whatever a rejoin does here, it may not be "the grant expired" — the grant
    // did not expire, and the seam's own deadline is not the authority's.
    expect(boundary.lastReason).not.toBe('grant-expired')
    expect(rejoined.isCurrent()).toBe(false)
  })
})

describe('rejoining after the authority SHORTENED the lease', () => {
  it('cancels the epoch at the shortened deadline exactly once', () => {
    const { boundary, launchToken } = launched(LATER)
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, SOONER)).not.toBeNull()

    vi.advanceTimersByTime(11_000)

    expect(launchToken.isCurrent()).toBe(false)
    expect(launchToken.signal.reason).toBe('grant-expired')
    expect(boundary.binding).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  /**
   * The safety-critical defect this card closes. The authority shortened the
   * window; the epoch honoured it and cancelled. The seam a mounted surface is
   * still holding names the LATER deadline the epoch was born with, and feeding
   * it back into `beginEpoch` builds a brand-new, fully current epoch out of it.
   *
   * Nothing re-checked the authority to get there. A surface that simply
   * remounted authorized work for another ninety seconds past the point the
   * server said its window ended.
   */
  it('does not revive authority from the seam once the shortened lease expired', async () => {
    const { boundary, seam, launchToken } = launched(LATER)
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, SOONER)).not.toBeNull()
    vi.advanceTimersByTime(11_000)
    expect(launchToken.isCurrent()).toBe(false)

    const rejoined = joinHostStudyLifecycle(seam)

    expect(rejoined.isCurrent()).toBe(false)
    // No new epoch was begun, so the boundary is still empty and still says why.
    expect(boundary.binding).toBeNull()
    expect(boundary.lastReason).toBe('grant-expired')
    expect(currentHostStudyLifecycleSeam({})).toBeNull()

    // And the token a rejoin hands back authorizes nothing.
    let invoked = false
    await expect(runCurrentStudyWork(rejoined, async () => {
      invoked = true
      return 'unreachable'
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(invoked).toBe(false)
  })

  it('does not move the enforced deadline back to the one the epoch was born with', () => {
    const { boundary, seam, launchToken } = launched(LATER)
    expect(boundary.renewEpochLeaseIfCurrent(launchToken, SOONER)).not.toBeNull()
    vi.advanceTimersByTime(11_000)

    joinHostStudyLifecycle(seam)

    // The birth deadline is still in the future, so a revived epoch would be
    // sitting on a live timer here.
    expect(boundary.leaseExpiresAt).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(120_000)
    expect(boundary.binding).toBeNull()
  })
})

describe('the live deadline is the enforced one after a renewal', () => {
  it('reports the renewed deadline while the binding keeps the one it was born with', () => {
    const { boundary, launchToken, seam } = launched(BIRTH)
    expect(boundary.leaseExpiresAt).toBe(BIRTH)

    expect(boundary.renewEpochLeaseIfCurrent(launchToken, LATER)).not.toBeNull()

    // The two really do diverge — which is why no authority decision may read the
    // binding's own `expiresAt`, and why this accessor exists.
    expect(boundary.leaseExpiresAt).toBe(LATER)
    expect(boundary.binding!.expiresAt).toBe(BIRTH)
    expect(seam.binding.expiresAt).toBe(BIRTH)
  })

  it('is empty once there is no epoch to enforce a deadline for', () => {
    const { boundary, launchToken } = launched(BIRTH)
    boundary.cancel('logout')
    expect(boundary.leaseExpiresAt).toBeNull()
    expect(launchToken.isCurrent()).toBe(false)
  })
})

describe('only the holder of the current epoch may renew its lease', () => {
  it('refuses a token from an epoch this boundary has moved on from', () => {
    const { boundary, launchToken } = launched(BIRTH)
    const relaunched = boundary.beginEpoch({
      ...launchBinding(BIRTH),
      launchGrantRef: 'opaque-grant-epoch:2',
    })
    expect(launchToken.isCurrent()).toBe(false)

    expect(boundary.renewEpochLeaseIfCurrent(launchToken, LATER)).toBeNull()
    expect(boundary.leaseExpiresAt).toBe(BIRTH)

    // The holder of the epoch that is actually current still may.
    expect(boundary.renewEpochLeaseIfCurrent(relaunched, LATER)).not.toBeNull()
    expect(boundary.leaseExpiresAt).toBe(LATER)
  })

  it('refuses a current token minted by another boundary', () => {
    const { boundary } = launched(BIRTH)
    const foreign = hostStudyLifecycleBoundary({})
    const foreignToken = foreign.beginEpoch(launchBinding(BIRTH))
    expect(foreignToken.isCurrent()).toBe(true)

    expect(boundary.renewEpochLeaseIfCurrent(foreignToken, LATER)).toBeNull()
    expect(boundary.leaseExpiresAt).toBe(BIRTH)
  })
})
