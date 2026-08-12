export const FAMILY_PILOT_PATH = '/family-pilot'

export function isFamilyPilotPath(pathname: string): boolean {
  return pathname === FAMILY_PILOT_PATH || pathname === `${FAMILY_PILOT_PATH}/`
}

export function enterFamilyPilotPath(): void {
  if (!isFamilyPilotPath(window.location.pathname)) {
    window.history.pushState(null, '', FAMILY_PILOT_PATH)
  }
}

/**
 * Exit-time URL normalization, matching leaveStudyEnginePath. A lingering
 * /family-pilot pathname is rewritten to / so a later refresh — possibly by a
 * different learner on a shared family machine — does not re-enter the pilot.
 */
export function leaveFamilyPilotPath(): void {
  if (isFamilyPilotPath(window.location.pathname)) {
    window.history.replaceState(null, '', '/')
  }
}
