import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  StudyLifecycleBoundary,
  type StudyLifecycleBinding,
} from '../lifecycle'
import {
  attachHostStudySurface,
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

  it('does not revive an epoch the boundary refused on the way in', () => {
    const owner = {}
    const first = render(owner, { featureEnabled: false })
    expect(first.boundary.token().isCurrent()).toBe(false)
    const refused = first.boundary.token().epoch

    // Neither the App re-deriving its seam nor a surface mounting can turn a
    // disabled binding into a live epoch, and neither takes a fresh epoch trying.
    for (let pass = 0; pass < 5; pass += 1) {
      expect(render(owner, { featureEnabled: false })).toBe(first)
      expect(joinHostStudyLifecycle(first).isCurrent()).toBe(false)
    }
    expect(first.boundary.token().isCurrent()).toBe(false)
    expect(first.boundary.token().epoch).toBe(refused)
  })

  // STUDY-A1-LIFECYCLE-AUTHORITY. This was the "revives a live epoch on mount"
  // test, and the revival has moved: an unmount cancels the epoch, and the next
  // render re-asserts the App's own live binding rather than leaving the
  // remounting surface to rebuild an epoch out of the seam it was carrying.
  it('revives a cancelled epoch from the owner\'s own binding, not from the seam', () => {
    const owner = {}
    const seam = render(owner)
    const token = joinHostStudyLifecycle(seam)
    expect(token.isCurrent()).toBe(true)

    // The unmount half of a navigate-away-and-back. Until the App renders again
    // there is nothing to join, and the surface cannot make one.
    seam.boundary.cancel('navigation-away')
    expect(seam.boundary.binding).toBeNull()
    expect(joinHostStudyLifecycle(seam).isCurrent()).toBe(false)
    expect(seam.boundary.binding).toBeNull()

    // The App re-derives its seam for the same launch: same seam object, so no
    // surface is remounted by it, and the epoch is live again.
    expect(render(owner)).toBe(seam)
    expect(seam.boundary.binding).not.toBeNull()

    const rejoined = joinHostStudyLifecycle(seam)
    expect(rejoined.isCurrent()).toBe(true)
    expect(rejoined.epoch).toBeGreaterThan(token.epoch)
    expect(token.isCurrent()).toBe(false)
  })

  it('takes one epoch, not one per render, to discover that the grant ran out', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-01T16:00:00.000Z'))
      const owner = {}
      const expiresAt = '2026-08-01T16:00:30.000Z'
      const seam = render(owner, { expiresAt })
      expect(joinHostStudyLifecycle(seam).isCurrent()).toBe(true)

      // The grant runs out and the App, which has no idea, renders on.
      vi.advanceTimersByTime(31_000)
      expect(seam.boundary.binding).toBeNull()
      const lapsed = seam.boundary.token().epoch

      for (let pass = 0; pass < 10; pass += 1) {
        expect(render(owner, { expiresAt })).toBe(seam)
        expect(joinHostStudyLifecycle(seam).isCurrent()).toBe(false)
      }

      // Exactly one epoch was spent finding out that this binding is finished,
      // and Study stayed unavailable — the re-assert is not a way back in.
      expect(seam.boundary.token().epoch).toBe(lapsed + 1)
      expect(seam.boundary.token().isCurrent()).toBe(false)
      expect(seam.boundary.lastReason).toBe('grant-expired')
    } finally {
      vi.useRealTimers()
    }
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
    ['featureEnabled', { featureEnabled: false }],
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

// STUDY-A1-PROD-SEAM-H2 C1. `epochKey` here and `fingerprint` inside the boundary
// are two hand-written lists of the same binding fields, and nothing but agreement
// between them makes the seam cache safe: the cache answers BEFORE `beginEpoch`, so
// any field the boundary treats as identity-significant and `epochKey` does not is
// a change that never reaches the boundary at all.
//
// Both directions of that drift were reproduced on this branch. Dropping
// `featureEnabled` from `epochKey` alone left a learner whose Study had just been
// switched OFF still holding a current, authorizing token, and the whole committed
// suite stayed green. Adding a field to `fingerprint` alone hid a real re-epoch the
// same way. `fingerprint` is private to the lifecycle core, so the two lists cannot
// be collapsed into one from here — this guard is what holds them together instead.
//
// Both sides are measured from real objects rather than asserted about strings, and
// the field list is a mapped type over the binding, so adding a field to
// `StudyLifecycleBinding` fails `tsc` until it is given a base value, a moved value,
// and therefore a deliberate answer to "is this identity-significant?".
type BindingField = keyof Required<StudyLifecycleBinding>

const GUARD_BASE: Required<StudyLifecycleBinding> = {
  authenticatedSessionRef: 'host-lifecycle:sync-guard',
  householdRef: 'household:sync-guard',
  learnerRef: 'learner:sync-guard',
  launchGrantRef: 'opaque-grant-epoch:1',
  featureEnabled: true,
  authorizationRevision: 1,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  identityEpochs: {
    authenticatedSession: 1,
    household: 1,
    learner: 1,
    membership: 1,
    relationship: 1,
  },
}

/** The same binding with every single field moved to a different value. */
const GUARD_MOVED: Required<StudyLifecycleBinding> = {
  authenticatedSessionRef: 'host-lifecycle:sync-guard-moved',
  householdRef: 'household:sync-guard-moved',
  learnerRef: 'learner:sync-guard-moved',
  launchGrantRef: 'opaque-grant-epoch:2',
  featureEnabled: false,
  authorizationRevision: 2,
  expiresAt: new Date(Date.now() + 1_200_000).toISOString(),
  identityEpochs: {
    authenticatedSession: 2,
    household: 2,
    learner: 2,
    membership: 2,
    relationship: 2,
  },
}

const BINDING_FIELDS = Object.keys(GUARD_BASE) as readonly BindingField[]

function movedIn(field: BindingField): StudyLifecycleBinding {
  return { ...GUARD_BASE, [field]: GUARD_MOVED[field] }
}

/** Does the SEAM CACHE consider these two bindings one epoch? */
function seamReusesEpoch(next: StudyLifecycleBinding): boolean {
  const owner = {}
  const first = createHostStudyLifecycleSeam(owner, GUARD_BASE)
  return createHostStudyLifecycleSeam(owner, next) === first
}

/** Does the BOUNDARY'S OWN fingerprint consider these two bindings one epoch? */
function boundaryReusesEpoch(next: StudyLifecycleBinding): boolean {
  const boundary = new StudyLifecycleBoundary()
  const first = boundary.beginEpoch(GUARD_BASE)
  return boundary.beginEpoch(next).epoch === first.epoch
}

describe('the seam cache and the boundary fingerprint bind on the same fields', () => {
  it('covers every field of the binding, derived from the binding itself', () => {
    expect([...BINDING_FIELDS].sort()).toEqual([
      'authenticatedSessionRef',
      'authorizationRevision',
      'expiresAt',
      'featureEnabled',
      'householdRef',
      'identityEpochs',
      'launchGrantRef',
      'learnerRef',
    ])
  })

  it('actually moves every field, so each case below is a real change', () => {
    for (const field of BINDING_FIELDS) {
      expect(JSON.stringify(GUARD_MOVED[field])).not.toBe(JSON.stringify(GUARD_BASE[field]))
    }
  })

  it('agrees that an unchanged binding is the same epoch', () => {
    expect(seamReusesEpoch({ ...GUARD_BASE })).toBe(true)
    expect(boundaryReusesEpoch({ ...GUARD_BASE })).toBe(true)
  })

  for (const field of BINDING_FIELDS) {
    it(`agrees that ${field} is identity-significant`, () => {
      const next = movedIn(field)
      const seamReuses = seamReusesEpoch(next)
      const boundaryReuses = boundaryReusesEpoch(next)
      // The drift check: whatever the answer is, it must be the SAME answer. A
      // field added to one list only makes these disagree.
      expect(seamReuses).toBe(boundaryReuses)
      // And today every field is significant on both sides. A future field that
      // is deliberately insignificant has to be moved out of this list by hand.
      expect(seamReuses).toBe(false)
      expect(boundaryReuses).toBe(false)
    })
  }
})

// STUDY-A1-PROD-SEAM-H2 C1, behaviour rather than representation: the seam cache
// must never answer a Study ON/OFF transition out of its own memory.
describe('switching Study off is never answered from the seam cache', () => {
  it('true -> false runs the boundary fail-closed instead of returning the authorized seam', () => {
    const owner = {}
    const enabled = render(owner)
    const token = joinHostStudyLifecycle(enabled)
    expect(token.isCurrent()).toBe(true)

    // Study is switched off for this learner and the App re-derives the seam.
    const disabled = render(owner, { featureEnabled: false })

    // The cache did not answer, so `beginEpoch` really ran...
    expect(disabled).not.toBe(enabled)
    // ...and ran its fail-closed feature-disabled path.
    expect(disabled.boundary.lastReason).toBe('feature-disabled')
    expect(disabled.boundary.binding).toBeNull()
    expect(disabled.boundary.token().isCurrent()).toBe(false)
    // The token minted while Study was on has stopped authorizing.
    expect(token.isCurrent()).toBe(false)
    // And the seam the surfaces now hold names the disabled binding, not the old one.
    expect(disabled.binding.featureEnabled).toBe(false)
  })

  it('leaves nothing for a mount to join while the feature is off', () => {
    const owner = {}
    joinHostStudyLifecycle(render(owner))
    const disabled = render(owner, { featureEnabled: false })
    // A join attaches to a live epoch or fails closed, and there is no live epoch
    // to attach to while Study is off.
    expect(joinHostStudyLifecycle(disabled).isCurrent()).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
  })

  it('false -> true takes a genuine new epoch rather than resurrecting the disabled one', () => {
    const owner = {}
    const disabled = render(owner, { featureEnabled: false })
    const disabledToken = disabled.boundary.token()
    expect(disabledToken.isCurrent()).toBe(false)

    const enabled = render(owner)
    expect(enabled).not.toBe(disabled)
    const token = joinHostStudyLifecycle(enabled)
    expect(token.isCurrent()).toBe(true)
    // Strictly later, so this is a new epoch and not the disabled one brought back.
    expect(token.epoch).toBeGreaterThan(disabledToken.epoch)
    expect(disabledToken.isCurrent()).toBe(false)
  })

  it('does not bring the pre-disable epoch back when Study is switched on again', () => {
    const owner = {}
    const before = render(owner)
    const beforeToken = joinHostStudyLifecycle(before)
    expect(beforeToken.isCurrent()).toBe(true)

    render(owner, { featureEnabled: false })
    const after = render(owner)

    expect(after).not.toBe(before)
    const afterToken = joinHostStudyLifecycle(after)
    expect(afterToken.epoch).toBeGreaterThan(beforeToken.epoch)
    // The epoch that was live before the switch-off stays retired.
    expect(beforeToken.isCurrent()).toBe(false)
  })
})

// STUDY-A1-PROD-SEAM-H2 C3. The card's central invariant is that an App owner has
// exactly ONE Study lifecycle authority. That holds only while every exported way
// into this module reaches the same registry: a second owner->boundary map would
// hand somebody a boundary that stays current after this one has been cancelled,
// and a logout or a learner switch would leave that other one running.
//
// Proven by behaviour rather than by reading the source — each entry point is
// called, then the one boundary is cancelled, and every entry point is asked again.
describe('one authority: this module holds a single lifecycle registry per owner', () => {
  it('funnels every exported entry point to the same boundary object', () => {
    const owner = {}
    const direct = hostStudyLifecycleBoundary(owner)
    expect(createHostStudyLifecycleSeam(owner, baseBinding()).boundary).toBe(direct)
    expect(currentHostStudyLifecycleSeam(owner)!.boundary).toBe(direct)
    expect(joinHostStudyLifecycle(currentHostStudyLifecycleSeam(owner)!).epoch)
      .toBe(direct.token().epoch)
    expect(attachHostStudySurface(currentHostStudyLifecycleSeam(owner)!).token.epoch)
      .toBe(direct.token().epoch)
    expect(hostStudyLifecycleBoundary(owner)).toBe(direct)
  })

  it('offers no entry point that survives a cancel of the owner\'s boundary', () => {
    const owner = {}
    const seam = render(owner)
    const token = joinHostStudyLifecycle(seam)
    const surface = attachHostStudySurface(seam)
    expect(token.isCurrent()).toBe(true)
    expect(surface.isAttached()).toBe(true)

    // A logout cancels the one authority. If any exported path reached a second
    // registry, it would answer with a boundary that was still current here.
    seam.boundary.cancel('logout')

    expect(hostStudyLifecycleBoundary(owner)).toBe(seam.boundary)
    expect(hostStudyLifecycleBoundary(owner).binding).toBeNull()
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('logout')
    expect(hostStudyLifecycleBoundary(owner).token().isCurrent()).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
    // STUDY-A1-STRICTMODE-PREVIEW — a surface attachment is strictly narrower
    // than the epoch. Asserted BEFORE the owner's re-render below, which is the
    // only thing entitled to bring authority back: attaching a surface to the
    // cancelled seam does not, however many times React replays the mount.
    expect(surface.isAttached()).toBe(false)
    expect(attachHostStudySurface(seam).isAttached()).toBe(false)
    attachHostStudySurface(seam).detach()
    expect(hostStudyLifecycleBoundary(owner).binding).toBeNull()
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('logout')

    expect(render(owner).boundary).toBe(seam.boundary)
    expect(token.isCurrent()).toBe(false)
  })

  it('exports only ways to obtain or inspect that one authority', async () => {
    const seamModule = await import('./hostStudyLifecycle')
    // A new export here is a new way into the module and must be a deliberate
    // decision, not a drive-by: nothing added may mint a parallel registry.
    expect(Object.keys(seamModule).sort()).toEqual([
      // STUDY-A1-STRICTMODE-PREVIEW. A mounted surface's attachment to the epoch,
      // added so an effect cleanup has something to retire that is NOT the shared
      // epoch. It takes a seam rather than an owner, so it reaches no registry;
      // the assertions below hold it to that.
      'attachHostStudySurface',
      'createHostStudyLifecycleSeam',
      'currentHostStudyLifecycleSeam',
      'hostStudyLifecycleBoundary',
      'joinHostStudyLifecycle',
    ])

    // Every owner-taking export is idempotent on that owner's one boundary, so
    // repetition can never accumulate authorities.
    const owner = {}
    const boundary = seamModule.hostStudyLifecycleBoundary(owner)
    const epoch = seamModule.createHostStudyLifecycleSeam(owner, baseBinding()).boundary.token().epoch
    for (let pass = 0; pass < 10; pass += 1) {
      expect(seamModule.hostStudyLifecycleBoundary(owner)).toBe(boundary)
      expect(seamModule.createHostStudyLifecycleSeam(owner, baseBinding()).boundary).toBe(boundary)
      expect(seamModule.currentHostStudyLifecycleSeam(owner)!.boundary).toBe(boundary)
      // Attaching and detaching a surface ten times moves nothing: it never
      // begins an epoch and never ends one, which is what makes React's
      // setup/cleanup/setup probe safe to replay.
      const surface = seamModule.attachHostStudySurface(seamModule.currentHostStudyLifecycleSeam(owner)!)
      expect(surface.token.epoch).toBe(epoch)
      surface.detach()
      expect(boundary.binding).not.toBeNull()
      expect(boundary.token().epoch).toBe(epoch)
      expect(boundary.token().isCurrent()).toBe(true)
    }
  })
})

// STUDY-A1-LIFECYCLE-AUTHORITY — this replaces the temporary hazard proof the H2
// branch left here.
//
// The lifecycle core used to export `acquireHostStudyLifecycle`, which kept its
// OWN owner->boundary WeakMap. H2 could not delete it (the core was out of that
// card's custody), so it characterised it instead: a test that called it and
// measured a second boundary staying current after a logout had cancelled the
// App's one. That test was correct while the function existed, and keeping it now
// would mean importing a symbol whose correct state is "gone".
//
// So the proof moves from "here is what the second registry does" to "there is no
// second registry". These are permanent: the first fails if anything re-adds a
// symbol like it, and the second fails if any exported production path hands the
// same owner two independently-current authorities, whatever it is called.
describe('the lifecycle core offers no second host-lifecycle registry', () => {
  /** Every non-test source file under src, so an empty result means "none". */
  function productionSources(): readonly string[] {
    const srcRoot = fileURLToPath(new URL('../../', import.meta.url))
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return walk(full)
        return /\.tsx?$/.test(entry.name) ? [full] : []
      })
    })(srcRoot)
    // The scan reached a real tree, so an empty result below means "no matches"
    // and not "no files looked at".
    expect(files.length).toBeGreaterThan(100)
    return files.filter((file) => !/\.test\.tsx?$/.test(file))
  }

  it('has removed the orphan, including every re-export path into it', async () => {
    const mentions = productionSources()
      .filter((file) => readFileSync(file, 'utf8').includes('acquireHostStudyLifecycle'))
      // The deletion note in the core names it deliberately, so that a future
      // reader finds out why it is not there rather than re-adding it.
      .filter((file) => !file.endsWith(join('study', 'lifecycle', 'StudyLifecycle.ts')))
    expect(mentions).toEqual([])

    // Not just absent from source: absent from every barrel it used to travel
    // through, so no direct import can reach it either.
    for (const path of ['../lifecycle', '../lifecycle/StudyLifecycle', '../production', '../production/lifecycleBoundary']) {
      const barrel = await import(path)
      expect(Object.keys(barrel)).not.toContain('acquireHostStudyLifecycle')
    }
  })

  it('leaves exactly one owner-keyed lifecycle registry in production source', () => {
    // A registry is an owner-keyed WeakMap of boundaries. There is one, and it is
    // the App's. A second file matching here is a second authority by another
    // name, which is the shape of the defect and not its spelling.
    const registries = productionSources().filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /new WeakMap<object,\s*StudyLifecycleBoundary>/.test(source)
    })
    expect(registries.map((file) => file.split(/[\\/]/).slice(-2).join('/'))).toEqual([
      'composition/hostStudyLifecycle.ts',
    ])
  })

  it('cannot hand the same owner two independently-current authorities', async () => {
    const owner = {}
    const seam = render(owner)
    const token = joinHostStudyLifecycle(seam)
    expect(token.isCurrent()).toBe(true)

    // Every exported function on the production lifecycle surface, offered the
    // SAME owner. Classified by what it hands back rather than by its name, so a
    // future export that mints a second registry is caught by its shape.
    const [lifecycleBarrel, productionBarrel, seamModule] = await Promise.all([
      import('../lifecycle'),
      import('../production'),
      import('./hostStudyLifecycle'),
    ])
    const reached = [lifecycleBarrel, productionBarrel, seamModule]
      .flatMap((barrel) => Object.values(barrel))
      .filter((value): value is (...args: unknown[]) => unknown => typeof value === 'function')
      .map((entry) => {
        let result: unknown
        try {
          result = entry(owner, baseBinding())
        } catch {
          // Not an owner-taking lifecycle entry point.
          return null
        }
        if (typeof (result as { then?: unknown } | null)?.then === 'function') {
          // Asynchronous, so it is not one of these three; swallow the rejection
          // an argument it never expected produced.
          void (result as Promise<unknown>).catch(() => {})
          return null
        }
        if (result instanceof StudyLifecycleBoundary) return result
        const nested = (result as { boundary?: unknown } | null)?.boundary
        return nested instanceof StudyLifecycleBoundary ? nested : null
      })
      .filter((boundary): boundary is StudyLifecycleBoundary => boundary !== null)

    // The sweep really reached the entry points — `hostStudyLifecycleBoundary`,
    // `createHostStudyLifecycleSeam` and `currentHostStudyLifecycleSeam` — rather
    // than silently classifying everything as "not one".
    expect(reached.length).toBeGreaterThanOrEqual(3)
    for (const boundary of reached) expect(boundary).toBe(seam.boundary)

    // A logout on the App's one authority, and nothing anywhere still authorizes.
    seam.boundary.cancel('logout')
    expect(token.isCurrent()).toBe(false)
    for (const boundary of reached) {
      expect(boundary.binding).toBeNull()
      expect(boundary.token().isCurrent()).toBe(false)
    }
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
  })

  // STUDY-A1-LIFECYCLE-AUTHORITY Phase 11. `createStudyProductionComposition` is
  // the other production root that can hold a boundary. It has no caller in src
  // and is not on the App path, but it must not become a second authority for a
  // session the App already owns — so when it is given one it uses that one, and
  // never falls back to a boundary of its own.
  it('makes the other production composition root use the boundary it is given', async () => {
    const owner = {}
    const appBoundary = hostStudyLifecycleBoundary(owner)
    const { createStudyProductionComposition } = await import('../production')

    const composition = createStudyProductionComposition({
      featureFlagValue: 'false',
      authenticatedHostSession: false,
      selectedLearnerAuthorized: false,
      authority: null,
      registry: null,
      academicRuntime: null,
      lifecycle: appBoundary,
    })

    expect(composition.lifecycle).toBe(appBoundary)
    appBoundary.cancel('logout')
    expect(composition.lifecycle.token().isCurrent()).toBe(false)
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
