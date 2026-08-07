import {
  acquireHostStudyLifecycle,
  type StudyLifecycleBinding,
  type StudyLifecycleBoundary,
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

const HOST_SEAMS = new WeakMap<object, HostStudyLifecycleSeam>()

/**
 * One boundary per owner. `owner` is a stable host-held object (an App ref), so
 * repeated calls with the same owner return the same boundary and a changed
 * binding re-epochs it rather than creating a second one.
 *
 * One SEAM per epoch, too. The App derives this during render, so an ordinary
 * re-render — a sync tick, a theme change — calls in again for the same launch.
 * Handing back a new object then would change the prop identity the route and
 * the container hold it by, re-running their effects: the cleanup cancels the
 * epoch as `navigation-away` and the session is prepared from the top. A girl
 * with an answer already at the classifier had that turn aborted and was shown
 * "The Tutor result could not be accepted" by nothing she or the host did.
 *
 * `boundary.binding` is the boundary's own immutable binding, and `beginEpoch`
 * keeps that exact object while an epoch is being reused — so it is the epoch's
 * identity, and the seam is cached against it. A real re-epoch replaces it and
 * a new seam is built, which is the invalidation both surfaces must see.
 */
export function createHostStudyLifecycleSeam(
  owner: object,
  binding: StudyLifecycleBinding,
): HostStudyLifecycleSeam {
  const boundary = acquireHostStudyLifecycle(owner, binding)
  const current = boundary.binding
  const cached = HOST_SEAMS.get(owner)
  if (cached && current && cached.boundary === boundary && cached.binding === current) return cached
  const seam = Object.freeze({ boundary, binding: current ?? binding })
  HOST_SEAMS.set(owner, seam)
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
