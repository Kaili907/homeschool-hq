import { describe, it, expect } from 'vitest'
import { alignReading, alignTokens, tokenize } from './align'

/**
 * Acceptance: alignment unit-tested against scripted transcripts —
 * perfect read / skipped line / repeated word / recognizer substitution —
 * producing expected words-correct and the right practice-word flags.
 */

const PASSAGE =
  'The little fox ran across the green field. She found a warm den under the old oak tree.'
// 18 words:
// the little fox ran across the green field she found a warm den under the old oak tree
// (period/comma stripped) → count:
const PASSAGE_WORDS = tokenize(PASSAGE)

describe('tokenize', () => {
  it('lowercases, strips punctuation, keeps inner apostrophes', () => {
    expect(tokenize("Don't stop, Sam!")).toEqual(['don\'t', 'stop', 'sam'])
  })
  it('counts the sample passage words', () => {
    expect(PASSAGE_WORDS.length).toBe(18)
  })
})

describe('perfect read', () => {
  it('every passage word correct, nothing to practice', () => {
    const r = alignReading(PASSAGE, PASSAGE)
    expect(r.correct).toBe(18)
    expect(r.substituted).toBe(0)
    expect(r.skipped).toBe(0)
    expect(r.repeated).toBe(0)
    expect(r.practiceWords).toEqual([])
  })

  it('tolerates capitalization and punctuation differences in the transcript', () => {
    const r = alignReading(PASSAGE, 'the little fox ran across the green field she found a warm den under the old oak tree')
    expect(r.correct).toBe(18)
    expect(r.practiceWords).toEqual([])
  })
})

describe('skipped line', () => {
  it('a dropped run of words becomes skips + practice, correctness falls', () => {
    // she skips "across the green field"
    const transcript = 'the little fox ran she found a warm den under the old oak tree'
    const r = alignReading(PASSAGE, transcript)
    expect(r.skipped).toBe(4)
    expect(r.correct).toBe(14)
    expect(r.substituted).toBe(0)
    // the skipped run is "across the green field"; the duplicate "the" instance is
    // flagged even though "the" is matched elsewhere in the passage.
    expect(r.practiceWords).toEqual(['across', 'the', 'green', 'field'])
  })
})

describe('repeated word (self-correction)', () => {
  it('a repeat flags the word for practice but still counts it correct', () => {
    // she says "warm" twice
    const transcript =
      'the little fox ran across the green field she found a warm warm den under the old oak tree'
    const r = alignReading(PASSAGE, transcript)
    expect(r.correct).toBe(18) // repetition does NOT dock correctness
    expect(r.repeated).toBe(1)
    expect(r.skipped).toBe(0)
    expect(r.substituted).toBe(0)
    expect(r.practiceWords).toEqual(['warm'])
  })
})

describe('recognizer substitution', () => {
  it('a swapped word is a substitution + practice flag, one fewer correct', () => {
    // "fox" heard as "box"
    const transcript =
      'the little box ran across the green field she found a warm den under the old oak tree'
    const r = alignReading(PASSAGE, transcript)
    expect(r.substituted).toBe(1)
    expect(r.correct).toBe(17)
    expect(r.skipped).toBe(0)
    expect(r.practiceWords).toEqual(['fox'])
  })
})

describe('empty transcript', () => {
  it('nothing recognized → all skipped, zero correct (never throws)', () => {
    const r = alignReading(PASSAGE, '')
    expect(r.correct).toBe(0)
    expect(r.skipped).toBe(18)
    expect(r.practiceIndices.length).toBe(18)
  })
})

describe('alignTokens surface words', () => {
  it('reports practice words in original passage case', () => {
    const r = alignTokens(['the', 'fox'], ['the', 'dog'], ['The', 'Fox'])
    expect(r.practiceWords).toEqual(['Fox'])
  })
})
