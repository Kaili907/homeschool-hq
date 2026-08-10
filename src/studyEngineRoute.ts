export const STUDY_ENGINE_PATH = '/study-engine'

export function isStudyEnginePath(pathname: string): boolean {
  return pathname === STUDY_ENGINE_PATH || pathname === `${STUDY_ENGINE_PATH}/`
}

/**
 * Reflect an in-app Study entry in the existing production route without
 * serializing launch context into the URL or history state. Academy scheduling
 * context stays in React screen state and is deliberately lost on refresh.
 */
export function syncStudyEnginePath(): void {
  if (!isStudyEnginePath(window.location.pathname)) {
    window.history.replaceState(null, '', STUDY_ENGINE_PATH)
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
