export const STUDY_ENGINE_PATH = '/study-engine'

export function isStudyEnginePath(pathname: string): boolean {
  return pathname === STUDY_ENGINE_PATH || pathname === `${STUDY_ENGINE_PATH}/`
}
