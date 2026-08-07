import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  StudyLifecycleBoundary,
  acquireHostStudyLifecycle,
  type StudyLifecycleBinding,
} from '../lifecycle'
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
    // Joining is the one path allowed to start an epoch, and it does not hand a
    // disabled binding a live token either.
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
    expect(hostStudyLifecycleBoundary(owner)).toBe(direct)
  })

  it('offers no entry point that survives a cancel of the owner\'s boundary', () => {
    const owner = {}
    const seam = render(owner)
    const token = joinHostStudyLifecycle(seam)
    expect(token.isCurrent()).toBe(true)

    // A logout cancels the one authority. If any exported path reached a second
    // registry, it would answer with a boundary that was still current here.
    seam.boundary.cancel('logout')

    expect(hostStudyLifecycleBoundary(owner)).toBe(seam.boundary)
    expect(hostStudyLifecycleBoundary(owner).binding).toBeNull()
    expect(hostStudyLifecycleBoundary(owner).lastReason).toBe('logout')
    expect(hostStudyLifecycleBoundary(owner).token().isCurrent()).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
    expect(render(owner).boundary).toBe(seam.boundary)
    expect(token.isCurrent()).toBe(false)
  })

  it('exports only ways to obtain or inspect that one authority', async () => {
    const seamModule = await import('./hostStudyLifecycle')
    // A new export here is a new way into the module and must be a deliberate
    // decision, not a drive-by: nothing added may mint a parallel registry.
    expect(Object.keys(seamModule).sort()).toEqual([
      'createHostStudyLifecycleSeam',
      'currentHostStudyLifecycleSeam',
      'hostStudyLifecycleBoundary',
      'joinHostStudyLifecycle',
    ])

    // Every owner-taking export is idempotent on that owner's one boundary, so
    // repetition can never accumulate authorities.
    const owner = {}
    const boundary = seamModule.hostStudyLifecycleBoundary(owner)
    for (let pass = 0; pass < 10; pass += 1) {
      expect(seamModule.hostStudyLifecycleBoundary(owner)).toBe(boundary)
      expect(seamModule.createHostStudyLifecycleSeam(owner, baseBinding()).boundary).toBe(boundary)
      expect(seamModule.currentHostStudyLifecycleSeam(owner)!.boundary).toBe(boundary)
    }
  })
})

// STUDY-A1-PROD-SEAM-H2 C3 — CONFIRMED_BUT_OUT_OF_CUSTODY, deferred to
// STUDY-A1-ORPHAN-AUTHORITY-C.
//
// `acquireHostStudyLifecycle` lives in the lifecycle core, which this card does not
// own, so it cannot be removed here. It keeps its OWN owner->boundary WeakMap,
// separate from the one above, so it is a second lifecycle authority that is still
// exported and still reachable — including through the `../lifecycle` barrel, which
// is how it is imported here.
//
// These tests characterise the hazard rather than assert it away. They exist to
// keep it measured and to fail loudly if anything wires it back into production.
// When the follow-up card deletes the function, this import stops compiling — that
// is the intended signal to delete this block along with it.
describe('the orphaned second lifecycle authority in the lifecycle core', () => {
  it('has no non-test caller anywhere in src, which is the only reason it is dormant', () => {
    const srcRoot = fileURLToPath(new URL('../../', import.meta.url))
    const definition = join('study', 'lifecycle', 'StudyLifecycle.ts')

    const files = (function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return walk(full)
        return /\.tsx?$/.test(entry.name) ? [full] : []
      })
    })(srcRoot)
    // The scan reached a real tree, so an empty result below means "no callers"
    // and not "no files looked at".
    expect(files.length).toBeGreaterThan(100)

    const callers = files
      .filter((file) => !/\.test\.tsx?$/.test(file) && !file.endsWith(definition))
      .filter((file) => readFileSync(file, 'utf8').includes('acquireHostStudyLifecycle'))
    expect(callers).toEqual([])
  })

  it('would mint a second, independently-current authority for the same owner', () => {
    const owner = {}
    // The production path: the boundary the App hands to the verified runtime and
    // derives the host seam from.
    const seam = render(owner)
    const productionToken = joinHostStudyLifecycle(seam)
    expect(productionToken.isCurrent()).toBe(true)

    // The orphaned path, called with the SAME owner.
    const second = acquireHostStudyLifecycle(owner, baseBinding())
    expect(second).not.toBe(seam.boundary)
    expect(second).not.toBe(hostStudyLifecycleBoundary(owner))

    // And it is independently current: a logout on the App's one authority leaves
    // this one authorizing, which is precisely the invariant the card is about.
    seam.boundary.cancel('logout')
    expect(productionToken.isCurrent()).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).toBeNull()
    expect(second.binding).not.toBeNull()
    expect(second.token().isCurrent()).toBe(true)
    expect(second.lastReason).not.toBe('logout')
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
