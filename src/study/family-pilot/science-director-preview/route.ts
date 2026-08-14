export const SCIENCE_DIRECTOR_SAMPLE_PATH = '/__review/science/testable-questions' as const

/** Exact-path, development-build-only entry. Production routes and auth are untouched. */
export function isScienceDirectorSamplePath(pathname: string, developmentBuild = import.meta.env.DEV): boolean {
  return developmentBuild && (pathname === SCIENCE_DIRECTOR_SAMPLE_PATH || pathname === `${SCIENCE_DIRECTOR_SAMPLE_PATH}/`)
}
