export const HEALTH_DIRECTOR_REVIEW_PATH = '/__review/health' as const

/** Exact-path, development-build-only entry. Production routes and auth are unchanged. */
export function isHealthDirectorReviewPath(pathname: string, developmentBuild = import.meta.env.DEV): boolean {
  return developmentBuild
    && (pathname === HEALTH_DIRECTOR_REVIEW_PATH || pathname === `${HEALTH_DIRECTOR_REVIEW_PATH}/`)
}
