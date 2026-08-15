/**
 * CURR-1 — academy URL routes, modeled on studyEngineRoute.ts. The app's screen
 * state stays the routing authority (see App.tsx); these paths exist so deep
 * links and refreshes land on the right academy surface (MOUNT-2 pattern: the
 * academy path is evaluated before the picker default when a valid persisted
 * profile exists and reaches an enabled academy level).
 */

import {
  ACADEMY_COURSE_ID_PATTERN,
  ACADEMY_LESSON_ID_PATTERN,
} from '../curriculum/grade-authority'

export const ACADEMY_PATH = '/academy'

export type AcademyRoute =
  | { kind: 'home' }
  | { kind: 'schedule' }
  | { kind: 'course'; courseId: string }
  | { kind: 'unit'; courseId: string; unitNumber: number }
  | { kind: 'lesson'; courseId: string; unitNumber: number; lessonId: string }
  | { kind: 'assessment'; courseId: string; unitNumber: number }

const COURSE_ID = ACADEMY_COURSE_ID_PATTERN
const LESSON_ID = ACADEMY_LESSON_ID_PATTERN

export function isAcademyPath(pathname: string): boolean {
  return pathname === ACADEMY_PATH || pathname.startsWith(`${ACADEMY_PATH}/`)
}

/** Parse an /academy pathname. Unknown or malformed subpaths land on home
 * (never a crash — a stale bookmark degrades to the catalog). */
export function parseAcademyPath(pathname: string): AcademyRoute | null {
  if (!isAcademyPath(pathname)) return null
  const parts = pathname.split('/').filter(Boolean).slice(1) // drop 'academy'
  if (parts.length === 0) return { kind: 'home' }
  if (parts[0] === 'schedule' && parts.length === 1) return { kind: 'schedule' }
  if (parts[0] === 'course' && COURSE_ID.test(parts[1] ?? '')) {
    const courseId = parts[1]
    if (parts.length === 2) return { kind: 'course', courseId }
    const unitNumber = Number(parts[3])
    if (parts[2] === 'unit' && Number.isInteger(unitNumber) && unitNumber >= 1) {
      if (parts.length === 4) return { kind: 'unit', courseId, unitNumber }
      if (parts[4] === 'assessment' && parts.length === 5) {
        return { kind: 'assessment', courseId, unitNumber }
      }
      if (parts[4] === 'lesson' && LESSON_ID.test(parts[5] ?? '') && parts.length === 6) {
        return { kind: 'lesson', courseId, unitNumber, lessonId: parts[5] }
      }
    }
  }
  return { kind: 'home' }
}

export function formatAcademyPath(route: AcademyRoute): string {
  switch (route.kind) {
    case 'home':
      return ACADEMY_PATH
    case 'schedule':
      return `${ACADEMY_PATH}/schedule`
    case 'course':
      return `${ACADEMY_PATH}/course/${route.courseId}`
    case 'unit':
      return `${ACADEMY_PATH}/course/${route.courseId}/unit/${route.unitNumber}`
    case 'assessment':
      return `${ACADEMY_PATH}/course/${route.courseId}/unit/${route.unitNumber}/assessment`
    case 'lesson':
      return `${ACADEMY_PATH}/course/${route.courseId}/unit/${route.unitNumber}/lesson/${route.lessonId}`
  }
}

/** Reflect the current academy screen in the URL (deep-link + refresh support).
 * replaceState — academy navigation adds no history entries, matching the
 * app's screen-state routing model. */
export function syncAcademyPath(route: AcademyRoute): void {
  const path = formatAcademyPath(route)
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path)
  }
}

// A4-X pattern: leaving the academy rewrites a lingering /academy pathname to /
// so a later refresh, possibly by a different learner, does not re-enter it.
export function leaveAcademyPath(): void {
  if (isAcademyPath(window.location.pathname)) {
    window.history.replaceState(null, '', '/')
  }
}
