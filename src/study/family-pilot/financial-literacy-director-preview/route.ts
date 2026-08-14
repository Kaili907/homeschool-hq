export const FINANCIAL_LITERACY_DIRECTOR_PREVIEW_PATH = '/__review/financial-literacy' as const

/** Exact-path, development-build-only entry. Production routes and auth are untouched. */
export function isFinancialLiteracyDirectorPreviewPath(
  pathname: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && (
    pathname === FINANCIAL_LITERACY_DIRECTOR_PREVIEW_PATH ||
    pathname === `${FINANCIAL_LITERACY_DIRECTOR_PREVIEW_PATH}/`
  )
}
