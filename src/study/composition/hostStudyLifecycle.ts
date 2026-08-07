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
 * a fresh seam AND a fresh epoch, which is the churn this exists to prevent. The
 * epoch is not restarted from render either: a cancelled epoch is revived where
 * it should be, by `joinHostStudyLifecycle` when a surface mounts.
 *
 * A genuinely different binding is a different key, so it still re-epochs the one
 * boundary and still produces a new seam — which is the invalidation both
 * surfaces must see.
 */
export function createHostStudyLifecycleSeam(
  owner: object,
  binding: StudyLifecycleBinding,
): HostStudyLifecycleSeam {
  const boundary = hostStudyLifecycleBoundary(owner)
  const key = epochKey(binding)
  const cached = HOST_SEAMS.get(owner)
  if (cached && cached.boundary === boundary && cached.epochKey === key) return cached.seam
  boundary.beginEpoch(binding)
  // `boundary.binding` is the validated, normalized binding and is the epoch's
  // own identity while it lives. It is null only when that same call cancelled
  // the epoch it just began, and the seam still has to name the epoch it was
  // built for — `beginEpoch` has already validated it by then.
  const seam = Object.freeze({ boundary, binding: boundary.binding ?? frozenBinding(binding) })
  HOST_SEAMS.set(owner, { boundary, epochKey: key, seam })
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
 * `beginEpoch` keeps its exact binding object while an epoch is being reused, so
 * that object is the epoch's identity and the seam is stable for as long as the
 * epoch is. A genuine relaunch replaces it and produces a new seam.
 */
export function currentHostStudyLifecycleSeam(owner: object): HostStudyLifecycleSeam | null {
  const boundary = hostStudyLifecycleBoundary(owner)
  const binding = boundary.binding
  if (!binding) return null
  const cached = HOST_SEAMS.get(owner)
  if (cached && cached.boundary === boundary && cached.seam.binding === binding) return cached.seam
  const seam = Object.freeze({ boundary, binding })
  HOST_SEAMS.set(owner, { boundary, epochKey: epochKey(binding), seam })
  return seam
}

/**
 * Joins the host epoch and returns its token.
 *
 * A mounted surface cancels the boundary when it unmounts, which is what makes
 * its in-flight work stale. Remounting must therefore be able to rejoin:
 * `beginEpoch` reuses the live epoch when one is current and starts a fresh one
 * when the previous was cancelled, so navigating away and back works without
 * ever handing the components the power to invent a binding of their own.
 */
export function joinHostStudyLifecycle(seam: HostStudyLifecycleSeam): StudyLifecycleToken {
  return seam.boundary.beginEpoch(seam.binding)
}
