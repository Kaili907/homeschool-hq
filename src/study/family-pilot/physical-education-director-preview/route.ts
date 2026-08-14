export const PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH = '/__review/physical-education' as const

/** Exact-path, development-build-only Director entry. Production routes remain untouched. */
export function isPhysicalEducationDirectorPreviewPath(
  pathname: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && (
    pathname === PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH
    || pathname === `${PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH}/`
  )
}
