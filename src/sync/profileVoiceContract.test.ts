import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { validateProfileForSync } from './provenance'

function profile() {
  return structuredClone(defaultAppState().profiles.p1)
}

describe('logical voice profile contract', () => {
  it('dual-reads historical provider mappings and tagged logical/browser selections', () => {
    const candidate = profile()
    candidate.tutor = {
      voiceMap: {
        mathTutor: { provider: 'elevenlabs', ref: 'historical-value', label: 'Hidden legacy' },
      },
      voiceSelections: {
        mathTutor: {
          kind: 'catalog', voiceRef: 'academy.tts.synthetic',
          voiceVersion: 'v1', displayLabel: 'Synthetic',
        },
        default: {
          kind: 'browser', voiceURI: 'urn:browser:test', displayLabel: 'Browser test',
        },
      },
    }
    expect(validateProfileForSync('p1', candidate)).toBe(true)
    expect(candidate.tutor.voiceMap?.mathTutor?.ref).toBe('historical-value')
  })

  it.each([
    { kind: 'catalog', voiceRef: 'raw-provider-value', voiceVersion: 'v1', displayLabel: 'Bad' },
    { kind: 'catalog', voiceRef: 'academy.tts.good', voiceVersion: '', displayLabel: 'Bad' },
    { kind: 'catalog', voiceRef: 'academy.tts.good', voiceVersion: 'v1', displayLabel: 'Bad', provider: 'elevenlabs' },
    { kind: 'browser', voiceURI: '', displayLabel: 'Bad' },
  ])('rejects malformed new voice selection %#', (selection) => {
    const candidate = profile()
    candidate.tutor = { voiceSelections: { mathTutor: selection as never } }
    expect(validateProfileForSync('p1', candidate)).toBe(false)
  })
})
