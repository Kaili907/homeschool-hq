export const G3_ROUNDING_DIRECTOR_PREVIEW_PATH = '/__review/g3-rounding' as const

/** Exact-path, development-build-only entry. Production routes and auth are untouched. */
export function isG3RoundingDirectorPreviewPath(pathname: string, developmentBuild = import.meta.env.DEV): boolean {
  return developmentBuild && (pathname === G3_ROUNDING_DIRECTOR_PREVIEW_PATH || pathname === `${G3_ROUNDING_DIRECTOR_PREVIEW_PATH}/`)
}
