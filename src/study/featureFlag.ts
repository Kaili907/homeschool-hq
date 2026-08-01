/** The Study Engine is opt-in and must never become enabled by a truthy typo. */
export function isStudyEngineEnabled(value?: string): boolean {
  return value === 'true'
}

export function isStudyEngineEnabledFromHost(): boolean {
  return isStudyEngineEnabled(import.meta.env.VITE_STUDY_ENGINE_ENABLED)
}
