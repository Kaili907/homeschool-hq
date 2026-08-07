import { describe, expect, it } from 'vitest'
import type { StudyLifecycleBinding } from '../lifecycle'
import {
  createHostStudyLifecycleSeam,
  currentHostStudyLifecycleSeam,
  hostStudyLifecycleBoundary,
  joinHostStudyLifecycle,
} from './hostStudyLifecycle'

// STUDY-A1-PROD-SEAM. Two defects, both of which become live the moment a
// production Study host surface is composed:
//
//  * The App held TWO StudyLifecycleBoundary objects — one handed to the verified
//    production runtime and one minted for the host surfaces — so the epoch a
//    launch begins and the epoch a host surface joins could never be the same
//    epoch, and cancelling one left the other running.
//  * A boundary that cancels itself inside `beginEpoch` (its grant is already
//    expired, or the feature is off) sets `binding` to null. The seam cache was
//    keyed on that binding, so every subsequent ordinary React render minted a
//    fresh seam AND, through `acquireHostStudyLifecycle`, a fresh epoch. A new
//    seam object is a new prop identity for the route and the container, whose
//    effects then re-run and whose cleanup cancels the epoch as `navigation-away`.

const HOUSEHOLD = 'household:study-a1-prod-seam'
const LEARNER = 'learner:study-a1-prod-seam'

function baseBinding(overrides: Partial<StudyLifecycleBinding> = {}): StudyLifecycleBinding {
  return {
    authenticatedSessionRef: 'host-lifecycle:prod-seam',
    householdRef: HOUSEHOLD,
    learnerRef: LEARNER,
    launchGrantRef: 'opaque-grant-epoch:1',
    featureEnabled: true,
    authorizationRevision: 1,
    ...overrides,
  }
}

/** A fresh binding literal each render, exactly as the App produces. */
function render(owner: object, overrides: Partial<StudyLifecycleBinding> = {}) {
  return createHostStudyLifecycleSeam(owner, baseBinding(overrides))
}

describe('one host Study lifecycle boundary per App owner', () => {
  it('starts unbound, so nothing is authorized before a launch binds it', () => {
    const owner = {}
    const boundary = hostStudyLifecycleBoundary(owner)
    expect(boundary.binding).toBeNull()
    expect(boundary.token().isCurrent()).toBe(false)
    // And there is no epoch for a host surface to join yet.
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
  })

  it('is the same boundary the seam carries, so the runtime and the host share one', () => {
    const owner = {}
    // This is the object the App hands to createVerifiedStudyRuntimeAdapter.
    const runtimeBoundary = hostStudyLifecycleBoundary(owner)
    expect(hostStudyLifecycleBoundary(owner)).toBe(runtimeBoundary)
    expect(render(owner).boundary).toBe(runtimeBoundary)
    expect(currentHostStudyLifecycleSeam(owner)!.boundary).toBe(runtimeBoundary)
  })

  it('gives different owners different boundaries', () => {
    expect(hostStudyLifecycleBoundary({})).not.toBe(hostStudyLifecycleBoundary({}))
  })
})

describe('the epoch a verified production launch begins is the epoch a host surface joins', () => {
  it('hands the host the launch epoch rather than a binding it invented', () => {
    const owner = {}
    // Exactly what the verified runtime adapter does with the boundary it was
    // constructed with: bind it from server-verified authority.
    const boundary = hostStudyLifecycleBoundary(owner)
    const launched = boundary.beginEpoch({
      authenticatedSessionRef: 'host-lifecycle:9d1f',
      householdRef: 'server-bound-authority',
      learnerRef: 'selected-learner-epoch:1',
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })

    const seam = currentHostStudyLifecycleSeam(owner)
    expect(seam).not.toBeNull()
    expect(seam!.boundary).toBe(boundary)
    // Joining is a no-op reuse, not a second epoch: the token the launch produced
    // is still current afterwards, and the joined token is the same epoch.
    const joined = joinHostStudyLifecycle(seam!)
    expect(joined.epoch).toBe(launched.epoch)
    expect(launched.isCurrent()).toBe(true)
    expect(joined.isCurrent()).toBe(true)
  })

  it('is one authority: cancelling the launch epoch invalidates the host seam too', () => {
    const owner = {}
    const boundary = hostStudyLifecycleBoundary(owner)
    boundary.beginEpoch(baseBinding({ launchGrantRef: 'opaque-grant-epoch:7' }))
    const seam = currentHostStudyLifecycleSeam(owner)!
    const token = joinHostStudyLifecycle(seam)

    boundary.cancel('logout')
    expect(token.isCurrent()).toBe(false)
    expect(seam.boundary.lastReason).toBe('logout')
    // With no live epoch there is nothing to join, so Study is unavailable rather
    // than unbound.
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
  })

  it('keeps one seam object while the launch epoch is unchanged', () => {
    const owner = {}
    hostStudyLifecycleBoundary(owner).beginEpoch(baseBinding())
    const first = currentHostStudyLifecycleSeam(owner)
    for (let pass = 0; pass < 20; pass += 1) {
      expect(currentHostStudyLifecycleSeam(owner)).toBe(first)
    }
  })

  it('produces a new seam when a relaunch genuinely re-epochs the boundary', () => {
    const owner = {}
    const boundary = hostStudyLifecycleBoundary(owner)
    boundary.beginEpoch(baseBinding({ launchGrantRef: 'opaque-grant-epoch:1' }))
    const first = currentHostStudyLifecycleSeam(owner)!
    const token = joinHostStudyLifecycle(first)

    boundary.beginEpoch(baseBinding({ launchGrantRef: 'opaque-grant-epoch:2' }))
    const second = currentHostStudyLifecycleSeam(owner)!
    expect(second).not.toBe(first)
    expect(second.boundary).toBe(first.boundary)
    expect(token.isCurrent()).toBe(false)
  })
})

describe('seam stability when the boundary cancels itself', () => {
  it('holds one seam across renders when the grant has already expired', () => {
    const owner = {}
    const expiresAt = new Date(Date.now() - 60_000).toISOString()
    const first = render(owner, { expiresAt })
    // The boundary refused the epoch it was just given, so it carries no binding.
    expect(first.boundary.binding).toBeNull()
    expect(first.boundary.lastReason).toBe('grant-expired')
    expect(first.binding.expiresAt).toBe(expiresAt)

    // Twenty ordinary re-renders. Before this card each one produced a new seam
    // object and, through it, a new epoch on the boundary.
    for (let pass = 0; pass < 20; pass += 1) {
      expect(render(owner, { expiresAt })).toBe(first)
    }
    // And no render revived the dead epoch behind the surfaces' backs.
    expect(first.boundary.binding).toBeNull()
    expect(first.boundary.token().isCurrent()).toBe(false)
  })

  it('holds one seam across renders when the feature has been switched off', () => {
    const owner = {}
    const first = render(owner, { featureEnabled: false })
    expect(first.boundary.binding).toBeNull()
    expect(first.boundary.lastReason).toBe('feature-disabled')

    for (let pass = 0; pass < 20; pass += 1) {
      expect(render(owner, { featureEnabled: false })).toBe(first)
    }
    expect(first.boundary.token().isCurrent()).toBe(false)
  })

  it('still revives the epoch where it should — on mount, not on render', () => {
    const owner = {}
    const first = render(owner, { featureEnabled: false })
    expect(first.boundary.token().isCurrent()).toBe(false)

    // A surface mounting joins explicitly, which is the only path allowed to
    // start the next epoch. The seam it holds is unchanged.
    const revived = render(owner, { featureEnabled: false })
    expect(revived).toBe(first)
    joinHostStudyLifecycle(first)
    // featureEnabled:false is refused on the way in, so joining does not hand a
    // disabled epoch a live token either.
    expect(first.boundary.token().isCurrent()).toBe(false)
  })

  it('revives a live epoch on mount after a cancelled one', () => {
    const owner = {}
    const seam = render(owner)
    const token = joinHostStudyLifecycle(seam)
    expect(token.isCurrent()).toBe(true)

    // An unmount cancels the epoch; the seam identity is unchanged, so a re-render
    // does not restart anything...
    seam.boundary.cancel('navigation-away')
    expect(render(owner)).toBe(seam)
    expect(seam.boundary.binding).toBeNull()

    // ...and the remount rejoins on the host's binding.
    const rejoined = joinHostStudyLifecycle(seam)
    expect(rejoined.isCurrent()).toBe(true)
    expect(rejoined.epoch).toBeGreaterThan(token.epoch)
    expect(token.isCurrent()).toBe(false)
  })
})

describe('a genuinely different epoch still produces a new seam', () => {
  // Every field the boundary's own epoch fingerprint covers. If the seam cache
  // and the boundary ever disagreed about what "the same epoch" means, one of
  // these would return the cached seam for a boundary that had re-epoched.
  const changes: ReadonlyArray<readonly [string, Partial<StudyLifecycleBinding>]> = [
    ['authenticatedSessionRef', { authenticatedSessionRef: 'host-lifecycle:other' }],
    ['householdRef', { householdRef: 'household:other' }],
    ['learnerRef', { learnerRef: 'learner:another-child' }],
    ['launchGrantRef', { launchGrantRef: 'opaque-grant-epoch:2' }],
    ['authorizationRevision', { authorizationRevision: 2 }],
    ['expiresAt', { expiresAt: new Date(Date.now() + 300_000).toISOString() }],
    ['identityEpochs', {
      identityEpochs: {
        authenticatedSession: 1,
        household: 1,
        learner: 2,
        membership: 1,
        relationship: 1,
      },
    }],
  ]

  for (const [field, override] of changes) {
    it(`re-epochs the boundary and mints a new seam when ${field} changes`, () => {
      const owner = {}
      const first = render(owner)
      const token = joinHostStudyLifecycle(first)
      expect(token.isCurrent()).toBe(true)

      const second = render(owner, override)
      expect(second).not.toBe(first)
      expect(second.boundary).toBe(first.boundary)
      // The boundary agrees this is a different epoch: the previous token is
      // stale, which is the invalidation both surfaces must see.
      expect(token.isCurrent()).toBe(false)
    })
  }

  it('names a learner change as a learner change', () => {
    const owner = {}
    render(owner)
    render(owner, { learnerRef: 'learner:another-child' })
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('learner-switch')
  })

  it('does not re-epoch when only the binding object identity changes', () => {
    const owner = {}
    const first = render(owner)
    const token = joinHostStudyLifecycle(first)
    for (let pass = 0; pass < 20; pass += 1) {
      expect(render(owner)).toBe(first)
    }
    expect(token.isCurrent()).toBe(true)
    expect(first.boundary.lastReason).not.toBe('navigation-away')
    expect(first.boundary.lastReason).not.toBe('new-lifecycle-epoch')
  })
})

describe('the seam carries no Study session reference and no bearer', () => {
  it('holds host-local epoch labels only, including for a refused epoch', () => {
    const owner = {}
    const seam = render(owner, { expiresAt: new Date(Date.now() - 1_000).toISOString() })
    const serialized = JSON.stringify(seam.binding)
    expect(serialized).not.toMatch(/aca_stu_v1_/)
    expect(serialized).not.toMatch(/Bearer\s/i)
    expect(serialized).not.toMatch(/eyJ/)
    expect(Object.keys(seam.binding).sort().filter((key) => ![
      'authenticatedSessionRef',
      'authorizationRevision',
      'expiresAt',
      'featureEnabled',
      'householdRef',
      'identityEpochs',
      'launchGrantRef',
      'learnerRef',
    ].includes(key))).toEqual([])
    expect(Object.isFrozen(seam)).toBe(true)
    expect(Object.isFrozen(seam.binding)).toBe(true)
  })
})
