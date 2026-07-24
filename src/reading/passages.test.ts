import { describe, it, expect } from 'vitest'
import { PASSAGES, parsePassageBank, passagesForGrade, passageById } from './passages'

/**
 * Acceptance: the passage parser ingests the bank format; the delivered Q1 bank
 * has the promised shape (48 passages, 16 per grade after the SE-B addendum added
 * a second set of 8/grade) and every declared word count matches the actual body.
 */

describe('Q1 passage bank', () => {
  it('parses exactly 48 passages', () => {
    expect(PASSAGES.length).toBe(48)
  })

  it('has 16 passages per grade (3, 4, 6)', () => {
    expect(passagesForGrade('3').length).toBe(16)
    expect(passagesForGrade('4').length).toBe(16)
    expect(passagesForGrade('6').length).toBe(16)
  })

  it('uses sequential zero-padded ids per grade', () => {
    for (const g of ['3', '4', '6'] as const) {
      const ids = passagesForGrade(g).map((p) => p.id)
      const expected = Array.from({ length: 16 }, (_, k) => `g${g}-${String(k + 1).padStart(2, '0')}`)
      expect(ids).toEqual(expected)
    }
  })

  it('every declared word count equals the actual body word count', () => {
    // parsePassageBank throws if any declared count is wrong, so reaching here with
    // 24 passages already proves it — but assert positive word counts explicitly too.
    for (const p of PASSAGES) {
      expect(p.wordCount).toBeGreaterThan(0)
      expect(p.text.trim().split(/\s+/).length).toBe(p.wordCount)
    }
  })

  it('word counts rise by grade band (g3 < g4 < g6 on average)', () => {
    const avg = (g: '3' | '4' | '6') =>
      passagesForGrade(g).reduce((n, p) => n + p.wordCount, 0) / 8
    expect(avg('3')).toBeLessThan(avg('4'))
    expect(avg('4')).toBeLessThan(avg('6'))
  })

  it('titles are all distinct', () => {
    const titles = PASSAGES.map((p) => p.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('bodies are plain prose (no markdown control chars)', () => {
    for (const p of PASSAGES) {
      expect(p.text).not.toMatch(/[#*_>`]/)
    }
  })

  it('passageById round-trips', () => {
    expect(passageById('g4-03')?.grade).toBe('4')
    expect(passageById('nope')).toBeUndefined()
  })
})

describe('parsePassageBank (parser unit)', () => {
  const sample = [
    '# Bank',
    '',
    '## g3-01 · Hello There',
    'grade: 3',
    'words: 4',
    '',
    'One two three four.',
    '',
    '## g6-02 · Two Paragraphs',
    'grade: 6',
    'words: 6',
    '',
    'First line here.',
    '',
    'Second line too.',
  ].join('\n')

  it('parses ids, titles, grades, paragraphs', () => {
    const ps = parsePassageBank(sample)
    expect(ps.map((p) => p.id)).toEqual(['g3-01', 'g6-02'])
    expect(ps[0].title).toBe('Hello There')
    expect(ps[1].grade).toBe('6')
    expect(ps[1].paragraphs).toEqual(['First line here.', 'Second line too.'])
  })

  it('throws when a declared word count is wrong', () => {
    const bad = '## g3-01 · X\ngrade: 3\nwords: 99\n\nonly three words here'
    expect(() => parsePassageBank(bad)).toThrow(/declared words/)
  })

  it('throws when grade does not match the id prefix', () => {
    const bad = '## g3-01 · X\ngrade: 4\nwords: 2\n\ntwo words'
    expect(() => parsePassageBank(bad)).toThrow(/does not match/)
  })
})
