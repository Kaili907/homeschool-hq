export const STUDY_ENGINE_PATH = '/study-engine'

export function isStudyEnginePath(pathname: string): boolean {
  return pathname === STUDY_ENGINE_PATH || pathname === `${STUDY_ENGINE_PATH}/`
}

/** Enter the one production Study route without creating a second app surface. */
export function enterStudyEnginePath(): void {
  if (!isStudyEnginePath(window.location.pathname)) {
    window.history.pushState(null, '', STUDY_ENGINE_PATH)
  }
}

// A4-X: exit-time URL normalization. Leaving Study rewrites a lingering
// /study-engine pathname to / (replaceState — no history entry, no reload) so
// a later refresh, possibly by a different learner, does not re-enter Study.
// Entry-time route evaluation is unchanged; no-op away from /study-engine.
export function leaveStudyEnginePath(): void {
  if (isStudyEnginePath(window.location.pathname)) {
    window.history.replaceState(null, '', '/')
  }
}
