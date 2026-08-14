export const ELA_DIRECTOR_PREVIEW_PATH = '/dev/ela-director-preview'

export function isElaDirectorPreviewEnabled(input: {
  readonly developmentBuild: boolean
  readonly pathname: string
}): boolean {
  if (!input.developmentBuild) return false
  return input.pathname.replace(/\/+$/, '') === ELA_DIRECTOR_PREVIEW_PATH
}

export function isElaDirectorPreviewEnabledFromHost(): boolean {
  return isElaDirectorPreviewEnabled({
    developmentBuild: import.meta.env.DEV,
    pathname: window.location.pathname,
  })
}
