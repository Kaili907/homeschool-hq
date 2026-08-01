/** The Study Engine is opt-in and must never become enabled by a truthy typo. */
export function isStudyEngineEnabled(value?: string): boolean {
  return value === 'true'
}

export function isStudyEngineEnabledFromHost(): boolean {
  return isStudyEngineEnabled(import.meta.env.VITE_STUDY_ENGINE_ENABLED)
}

/** Preview is a separate, development-only composition; the feature flag alone never selects it. */
export function isStudyEnginePreviewEnabled(input: {
  readonly developmentBuild: boolean
  readonly featureFlagValue?: string
  readonly previewFlagValue?: string
}): boolean {
  return input.developmentBuild &&
    isStudyEngineEnabled(input.featureFlagValue) &&
    input.previewFlagValue === 'true'
}

export function isStudyEnginePreviewEnabledFromHost(): boolean {
  return isStudyEnginePreviewEnabled({
    developmentBuild: import.meta.env.DEV,
    featureFlagValue: import.meta.env.VITE_STUDY_ENGINE_ENABLED,
    previewFlagValue: import.meta.env.VITE_STUDY_ENGINE_PREVIEW,
  })
}
