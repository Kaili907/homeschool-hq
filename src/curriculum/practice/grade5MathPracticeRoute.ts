/**
 * MOUNT-G5-MATH — the practice surface's URL, modeled on studyEngineRoute.ts.
 * The app's screen state stays the routing authority (see App.tsx); this path
 * exists so a deep link or refresh lands back on the surface, and so the
 * flag-off case has a concrete route to be refused at.
 */

export const GRADE5_MATH_PRACTICE_PATH = '/practice/grade-5-math'

export function isGrade5MathPracticePath(pathname: string): boolean {
  return (
    pathname === GRADE5_MATH_PRACTICE_PATH ||
    pathname === `${GRADE5_MATH_PRACTICE_PATH}/`
  )
}

// A4-X pattern: leaving the surface rewrites a lingering practice pathname to /
// so a later refresh, possibly by a different learner, does not re-enter it.
export function leaveGrade5MathPracticePath(): void {
  if (isGrade5MathPracticePath(window.location.pathname)) {
    window.history.replaceState(null, '', '/')
  }
}
