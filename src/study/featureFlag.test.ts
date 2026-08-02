import { describe, expect, it } from 'vitest'
import { isStudyEngineEnabled, isStudyEnginePreviewEnabled } from './featureFlag'

describe('Study feature gate', () => {
  it.each([undefined, '', 'false', 'TRUE', '1', ' true ', 'yes'])('defaults disabled for %s', (value) => {
    expect(isStudyEngineEnabled(value)).toBe(false)
  })

  it('enables only exact true', () => {
    expect(isStudyEngineEnabled('true')).toBe(true)
  })
})

describe('Study preview isolation', () => {
  it('requires a development build plus both exact flags', () => {
    expect(isStudyEnginePreviewEnabled({ developmentBuild: true, featureFlagValue: 'true', previewFlagValue: 'true' })).toBe(true)
    expect(isStudyEnginePreviewEnabled({ developmentBuild: false, featureFlagValue: 'true', previewFlagValue: 'true' })).toBe(false)
    expect(isStudyEnginePreviewEnabled({ developmentBuild: true, featureFlagValue: 'true', previewFlagValue: undefined })).toBe(false)
    expect(isStudyEnginePreviewEnabled({ developmentBuild: true, featureFlagValue: 'false', previewFlagValue: 'true' })).toBe(false)
  })
})
