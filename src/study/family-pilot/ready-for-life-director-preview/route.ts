export const READY_FOR_LIFE_DIRECTOR_PREVIEW_PATH = '/__review/ready-for-life' as const

/** Exact-path, development-build-only Director entry. Production routes remain untouched. */
export function isReadyForLifeDirectorPreviewPath(
  pathname: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && (
    pathname === READY_FOR_LIFE_DIRECTOR_PREVIEW_PATH
    || pathname === `${READY_FOR_LIFE_DIRECTOR_PREVIEW_PATH}/`
  )
}
