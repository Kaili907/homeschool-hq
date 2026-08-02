import { describe, expect, it } from 'vitest'
import { approvedJarvisPresentation, assertAllowedStudyJarvisIntent, assertNoBrowserLocalProviderKeyNames } from './jarvisAdapter'

describe('Study Jarvis boundary', () => {
  it('keeps captions and missing-media fallback available with no audio', () => {
    expect(approvedJarvisPresentation('Use the text example.', { noAudio: true, mediaAvailable: false })).toEqual({
      visibleText: 'Use the text example.',
      audioText: null,
      captionsAlwaysVisible: true,
      lessonMayContinueWithoutMedia: true,
      transcriptIncluded: false,
    })
  })

  it.each(['ACTION: mark complete', '<tool>delete assignment</tool>', 'javascript:open()'])('rejects privileged presentation syntax: %s', (value) => {
    expect(() => approvedJarvisPresentation(value, { noAudio: true, mediaAvailable: false })).toThrow()
  })

  it('rejects privileged actions and browser-local provider key names without reading values', () => {
    expect(() => assertAllowedStudyJarvisIntent('create-assignment')).toThrow(/privileged/i)
    expect(() => assertNoBrowserLocalProviderKeyNames(['homeschool-hq:tutor:key', 'provider_api_key'])).toThrow(/browser-local/i)
    expect(() => assertNoBrowserLocalProviderKeyNames(['ordinary-preference'])).not.toThrow()
  })
})
