import {
  StudyLifecycleBoundary,
  type StudyLifecycleBinding,
  type StudyLifecycleToken,
} from '../lifecycle'

/**
 * STUDY-A1-COMP Phase 8 — the Study lifecycle the App owns, handed to the route
 * and the container as one object.
 *
 * Both of those components used to build their own `new StudyLifecycleBoundary()`
 * with no binding. An unbound boundary has no controller and no binding, so every
 * token it issues is stale from birth: `runCurrentStudyWork` aborts before it
 * starts, and their live production paths were unreachable. Whatever they did
 * reach was a fallback, not the feature.
 *
 * Passing this seam is what makes those paths live, and passing the SAME seam to
 * both is what keeps them on one epoch — so a learner change or a logout
 * invalidates the route and the container together, and stale work from either
 * is rejected by the same boundary.
 *
 * Deliberately not serializable and deliberately not React state: it holds a
 * live boundary object, and it must never be written to AppState, storage, a URL
 * or history. It carries no Study session reference and no bearer — the binding
 * is host-local epoch labels only.
 */
export interface HostStudyLifecycleSeam {
  readonly boundary: StudyLifecycleBoundary
  readonly binding: StudyLifecycleBinding
}

const HOST_BOUNDARIES = new WeakMap<object, StudyLifecycleBoundary>()

interface HostSeamRecord {
  readonly boundary: StudyLifecycleBoundary
  /** The epoch the seam was built FOR, not the epoch the boundary is on now. */
  readonly epochKey: string
  readonly seam: HostStudyLifecycleSeam
  /**
   * Whether the boundary ACCEPTED this epoch when it was first asked for it.
   *
   * Recorded from what the boundary did — its binding immediately afterwards —
   * and not predicted from the binding's fields, so this holds no copy of the
   * boundary's fail-closed rules. False means the boundary refused this exact
   * epoch on the way in (Study off, grant already expired), and since the key is
   * every field it would judge, it would refuse it identically every time; asking
   * again on each render is the epoch churn the seam cache exists to prevent.
   */
  readonly accepted: boolean
}

const HOST_SEAMS = new WeakMap<object, HostSeamRecord>()

/**
 * STUDY-A1-PROD-SEAM — the one boundary an App owns, reachable before any epoch
 * exists.
 *
 * The App used to hold two: a bare `new StudyLifecycleBoundary()` handed to the
 * verified production runtime, and a second one minted here for the host
 * surfaces. Two boundaries are two authorities — a launch could begin an epoch on
 * one while the surfaces joined the other, so the epoch the production launch
 * establishes and the epoch a production host surface joins could never be the
 * same epoch, and cancelling either left the other running.
 *
 * The production runtime takes this boundary directly, so its `beginEpoch` IS the
 * host epoch, and `currentHostStudyLifecycleSeam` below is how a host surface
 * joins it. Unbound is the correct starting state: an unbound boundary issues
 * only stale tokens, so nothing is authorized until a launch binds it.
 */
export function hostStudyLifecycleBoundary(owner: object): StudyLifecycleBoundary {
  let boundary = HOST_BOUNDARIES.get(owner)
  if (!boundary) {
    boundary = new StudyLifecycleBoundary()
    HOST_BOUNDARIES.set(owner, boundary)
  }
  return boundary
}

/**
 * The same fields, in the same order, as the boundary's own epoch fingerprint.
 * Two bindings that key alike here are exactly the two the boundary would treat
 * as one epoch — the per-field tests hold the two in agreement.
 */
function epochKey(binding: StudyLifecycleBinding): string {
  const epochs = binding.identityEpochs
  return [
    binding.authenticatedSessionRef,
    binding.householdRef,
    binding.learnerRef,
    binding.launchGrantRef,
    binding.featureEnabled ? 'enabled' : 'disabled',
    binding.authorizationRevision,
    binding.expiresAt ?? '',
    epochs
      ? Object.entries(epochs)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, epoch]) => `${key}:${epoch}`)
          .join(',')
      : '',
  ].join('|')
}

function frozenBinding(binding: StudyLifecycleBinding): StudyLifecycleBinding {
  return Object.freeze({
    ...binding,
    identityEpochs: binding.identityEpochs ? Object.freeze({ ...binding.identityEpochs }) : undefined,
  })
}

/**
 * One boundary per owner, and one SEAM per epoch the owner asks for.
 *
 * The App derives this during render, so an ordinary re-render — a sync tick, a
 * theme change — calls in again for the same launch. Handing back a new object
 * then would change the prop identity the route and the container hold it by,
 * re-running their effects: the cleanup cancels the epoch as `navigation-away`
 * and the session is prepared from the top. A girl with an answer already at the
 * classifier had that turn aborted and was shown "The Tutor result could not be
 * accepted" by nothing she or the host did.
 *
 * STUDY-A1-PROD-SEAM — the cache is keyed on the epoch the caller ASKED for, not
 * on the binding the boundary currently holds. A boundary that cancels itself
 * inside `beginEpoch` — the grant already expired, or the feature is off — sets
 * its binding to null, and keying on that null made every subsequent render mint
 * a fresh seam AND a fresh epoch, which is the churn this exists to prevent.
 *
 * A genuinely different binding is a different key, so it still re-epochs the one
 * boundary and still produces a new seam — which is the invalidation both
 * surfaces must see.
 *
 * STUDY-A1-LIFECYCLE-AUTHORITY — this call is also where a cancelled epoch is
 * revived, because this is the only one of the three exports that is given a
 * LIVE binding by the authority that owns it. `joinHostStudyLifecycle` used to
 * do it from the seam a mounted surface was carrying, which let a surface create
 * authority out of stale metadata; a surface now only attaches.
 *
 * So `beginEpoch` runs on every call for a live epoch. It is idempotent while the
 * epoch is current — same fingerprint, same epoch, same binding object, no
 * cancel — so an ordinary re-render still changes nothing, and the seam object
 * handed back is the same one either way. What it adds is the remount: an unmount
 * cancels the epoch, and the next render re-asserts the caller's own binding
 * rather than leaving the surfaces to resurrect it from theirs.
 */
export function createHostStudyLifecycleSeam(
  owner: object,
  binding: StudyLifecycleBinding,
): HostStudyLifecycleSeam {
  const boundary = hostStudyLifecycleBoundary(owner)
  const key = epochKey(binding)
  const cached = HOST_SEAMS.get(owner)
  if (cached && cached.boundary === boundary && cached.epochKey === key) {
    if (cached.accepted) {
      boundary.beginEpoch(binding)
      // It was accepted once and is refused now — the deadline it was born with
      // has since passed. Recorded so the next render stops asking, which bounds
      // this to the single epoch it takes to discover it.
      if (!boundary.binding) HOST_SEAMS.set(owner, { ...cached, accepted: false })
    }
    return cached.seam
  }
  boundary.beginEpoch(binding)
  // `boundary.binding` is the validated, normalized binding and is the epoch's
  // own identity while it lives. It is null only when that same call cancelled
  // the epoch it just began, and the seam still has to name the epoch it was
  // built for — `beginEpoch` has already validated it by then.
  const seam = Object.freeze({ boundary, binding: boundary.binding ?? frozenBinding(binding) })
  HOST_SEAMS.set(owner, { boundary, epochKey: key, seam, accepted: boundary.binding !== null })
  return seam
}

/**
 * STUDY-A1-PROD-SEAM — the seam for the epoch the owner's boundary is ALREADY on,
 * for the host/verified production epoch the App does not derive a binding for.
 *
 * The verified production runtime begins its own epoch on this boundary from
 * server-verified authority; the host has no second binding to invent and must
 * not invent one. Null while the boundary is unbound or cancelled: there is no
 * epoch to join, and Study is unavailable rather than unbound.
 *
 * STUDY-A1-LIFECYCLE-AUTHORITY — keyed on the epoch, exactly as
 * `createHostStudyLifecycleSeam` is, so both exports mean one thing by "the same
 * epoch". Keying on the binding OBJECT was equivalent while only a relaunch could
 * replace it, but a revived epoch carries an equal-and-new binding object, and
 * minting a seam for it would remount surfaces the revival exists to keep.
 */
export function currentHostStudyLifecycleSeam(owner: object): HostStudyLifecycleSeam | null {
  const boundary = hostStudyLifecycleBoundary(owner)
  const binding = boundary.binding
  if (!binding) return null
  const key = epochKey(binding)
  const cached = HOST_SEAMS.get(owner)
  if (cached && cached.boundary === boundary && cached.epochKey === key) return cached.seam
  const seam = Object.freeze({ boundary, binding })
  HOST_SEAMS.set(owner, { boundary, epochKey: key, seam, accepted: true })
  return seam
}

/**
 * Attaches a mounting surface to the host epoch its seam names, and returns that
 * epoch's token. It never begins an epoch.
 *
 * STUDY-A1-LIFECYCLE-AUTHORITY — this used to be `beginEpoch(seam.binding)`, on
 * the reasoning that an unmount cancels the epoch and a remount must be able to
 * pick it back up. That gave a mounted surface the power to CREATE authority out
 * of a seam it had been holding since some earlier render, and the deadline that
 * seam names is the one the epoch was BORN with — so after the authority
 * restated its window, a remount either destroyed a valid epoch or resurrected an
 * expired one, purely from what the surface happened to be carrying.
 *
 * Reviving a cancelled epoch is now the job of the authority that owns the
 * binding: `createHostStudyLifecycleSeam` for the preview host, and a fresh
 * verified launch in production. A surface that finds no live epoch gets a token
 * that authorizes nothing, and Study is unavailable until an authority says
 * otherwise — which is the correct answer to "I was away and I came back".
 */
export function joinHostStudyLifecycle(seam: HostStudyLifecycleSeam): StudyLifecycleToken {
  return seam.boundary.joinCurrentEpoch(seam.binding)
}

/**
 * STUDY-A1-STRICTMODE-PREVIEW — one mounted surface's attachment to the host
 * epoch. It is strictly narrower than the epoch: it can go away while the epoch
 * lives, and it can never outlive the epoch or revive one.
 *
 * `main.tsx` wraps the App in `<StrictMode>` and the preview surface is DEV-only,
 * so every real preview mount is a StrictMode mount — and StrictMode deliberately
 * runs effect setup → cleanup → setup inside a single commit, with NO render
 * between them. The route and the container used to cancel the shared epoch from
 * that cleanup, which destroyed the authority the second setup then had to attach
 * to; and because a join correctly only attaches, nothing could put it back. The
 * App's own revival runs during RENDER, and the probe schedules none, so preview
 * settled on `binding = null`, `lastReason = 'navigation-away'` and a learner
 * surface stuck on "Rechecking…" forever.
 *
 * The fix is not to weaken the join but to stop conflating two lifetimes. An
 * effect cleanup means "this setup is over", which under StrictMode is a probe and
 * under a real unmount is an exit; either way it is a statement about the SURFACE.
 * Retiring the epoch is an authority decision and stays where it already was —
 * `leaveStudy` in the route for a real exit, and the App's logout, learner-switch
 * and authorization-loss handlers. Neither is an effect cleanup, so neither is
 * replayed by the probe.
 *
 * `detach` is therefore idempotent and repeatable by construction: aborting a
 * surface-local controller says nothing about the epoch, so setup → cleanup →
 * setup leaves the epoch exactly as it found it. No timer, no debounce, no
 * environment flag.
 */
export interface HostStudySurfaceAttachment {
  /** The epoch's own token, still owned and still minted by the boundary. */
  readonly token: StudyLifecycleToken
  /** Aborted when THIS surface detaches. Compose it into surface-scoped work. */
  readonly signal: AbortSignal
  /** The epoch is live AND this surface is still the attached one. */
  isAttached(): boolean
  /** Retires this surface's work only. It never touches the epoch. */
  detach(): void
}

export function attachHostStudySurface(seam: HostStudyLifecycleSeam): HostStudySurfaceAttachment {
  const token = joinHostStudyLifecycle(seam)
  const controller = new AbortController()
  return Object.freeze({
    token,
    signal: controller.signal,
    isAttached: () => token.isCurrent() && !controller.signal.aborted,
    // A reason from the boundary's own vocabulary, so composed work that aborts
    // on it raises the same StudyLifecycleAbortError shape as any other. It names
    // the surface leaving, not the epoch ending — the epoch is untouched here.
    detach: () => { if (!controller.signal.aborted) controller.abort('navigation-away') },
  })
}
