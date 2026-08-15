export const TECHNOLOGY_DIRECTOR_PREVIEW_PATH = '/__review/technology-algorithms' as const

/** Exact-path, development-build-only entry. Production routes and auth are untouched. */
export function isTechnologyDirectorPreviewPath(
  pathname: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && (
    pathname === TECHNOLOGY_DIRECTOR_PREVIEW_PATH ||
    pathname === `${TECHNOLOGY_DIRECTOR_PREVIEW_PATH}/`
  )
}
