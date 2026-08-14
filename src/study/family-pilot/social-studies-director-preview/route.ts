export const SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH = '/__review/g5-social-studies-protest-loyalism' as const

/** Exact-path, development-build-only entry. Production routes and auth are untouched. */
export function isSocialStudiesDirectorPreviewPath(pathname: string, developmentBuild = import.meta.env.DEV): boolean {
  return developmentBuild && (
    pathname === SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH
    || pathname === `${SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH}/`
  )
}
