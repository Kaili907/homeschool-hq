export const ARTS_MUSIC_DIRECTOR_PREVIEW_PATH = '/__review/g9-visual-hierarchy' as const

/** Exact-path, development-build-only entry. Production routes and authentication remain untouched. */
export function isArtsMusicDirectorPreviewPath(
  pathname: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && (
    pathname === ARTS_MUSIC_DIRECTOR_PREVIEW_PATH
    || pathname === `${ARTS_MUSIC_DIRECTOR_PREVIEW_PATH}/`
  )
}
