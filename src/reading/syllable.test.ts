import { describe, it, expect } from 'vitest'
import { splitSyllables, syllableHyphenate, syllableSpeech } from './syllable'

describe('syllable splitter (approximate)', () => {
  it('leaves very short words whole', () => {
    expect(splitSyllables('cat')).toEqual(['cat'])
    expect(splitSyllables('go')).toEqual(['go'])
  })

  it('splits multi-syllable words into vowel-anchored chunks', () => {
    // exact boundaries are heuristic; assert it splits and rejoins losslessly.
    const chunks = splitSyllables('wonderful')
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('')).toBe('wonderful')
  })

  it('every chunk of a real word contains a vowel', () => {
    for (const word of ['butterfly', 'rainbow', 'volcano', 'reading', 'pollen']) {
      for (const c of splitSyllables(word)) {
        expect(c).toMatch(/[aeiouy]/i)
      }
      expect(splitSyllables(word).join('')).toBe(word)
    }
  })

  it('hyphenate and speech forms are consistent with the split', () => {
    const w = 'wonderful'
    expect(syllableHyphenate(w)).toBe(splitSyllables(w).join('-'))
    expect(syllableSpeech(w)).toBe(splitSyllables(w).join(' '))
  })
})
