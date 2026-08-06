import { describe, expect, it } from 'vitest'
import {
  ALL_TESTS,
  HS_MATH_DIAGNOSTIC,
  HS_READING,
  HS_GRAMMAR,
  HS_ESSAY,
  HS_ESSAY_SENIOR_B,
  HS_READING_SURVEY,
  itemCount,
  testsForGrade,
} from './banks'
import { parseRational, rationalsEqual, scoreItem, normalizeText } from './normalizer'
import {
  assignTest,
  computeAutoScore,
  finishAttempt,
  getState,
  recordAnswer,
  startAttempt,
  startStatus,
  unlockRetake,
  findAssignment,
} from './attempts'
import { buildReport } from './report'
import type { Attempt, FixedTest, Item } from './types'
import { emptyAssessmentState } from './types'

// ---------- transcription count verification ----------

describe('transcription counts match the source files', () => {
  it('math diagnostic: 34 items across 4 sections', () => {
    expect(HS_MATH_DIAGNOSTIC.sections).toHaveLength(4)
    expect(itemCount(HS_MATH_DIAGNOSTIC)).toBe(34)
    expect(HS_MATH_DIAGNOSTIC.sections.map((s) => s.items.length)).toEqual([10, 8, 10, 6])
  })

  it('reading: 2 passages, 15 questions, passages present', () => {
    expect(HS_READING.sections).toHaveLength(2)
    expect(itemCount(HS_READING)).toBe(15)
    expect(HS_READING.sections.every((s) => (s.passage ?? '').length > 50)).toBe(true)
    expect(HS_READING.sections.map((s) => s.items.length)).toEqual([10, 5])
  })

  it('grammar: 15 items', () => {
    expect(itemCount(HS_GRAMMAR)).toBe(15)
  })

  it('essays: main (both grades) + senior 3B (soft timer, ungraded)', () => {
    expect(itemCount(HS_ESSAY)).toBe(1)
    expect(HS_ESSAY.timerSec).toBe(45 * 60)
    expect(HS_ESSAY.softTimer).toBeFalsy()
    expect(HS_ESSAY.forGrades).toEqual(['10', '12'])

    expect(itemCount(HS_ESSAY_SENIOR_B)).toBe(1)
    expect(HS_ESSAY_SENIOR_B.timerSec).toBe(30 * 60)
    expect(HS_ESSAY_SENIOR_B.softTimer).toBe(true)
    expect(HS_ESSAY_SENIOR_B.ungraded).toBe(true)
    expect(HS_ESSAY_SENIOR_B.forGrades).toEqual(['12'])
  })

  it('survey: 5 free-text items, ungraded', () => {
    expect(itemCount(HS_READING_SURVEY)).toBe(5)
    expect(HS_READING_SURVEY.ungraded).toBe(true)
  })

  it('all six high-school tests are registered and target only teens', () => {
    // CE3 narrowed this from ALL_TESTS to the hs- bank: the registry now also
    // carries the elementary placement instruments (ele-*), which are asserted
    // separately in elementaryPlacement.test.ts. The high-school bank itself is
    // unchanged and is still pinned exactly.
    const hsTests = ALL_TESTS.filter((t) => t.id.startsWith('hs-'))
    expect(hsTests.map((t) => t.id).sort()).toEqual([
      'hs-essay',
      'hs-essay-senior-b',
      'hs-grammar',
      'hs-math-diagnostic',
      'hs-reading',
      'hs-reading-survey',
    ])
    // no high-school test targets an elementary grade
    for (const t of hsTests) {
      for (const g of t.forGrades) expect(['10', '12']).toContain(g)
    }
    expect(testsForGrade('10').map((t) => t.id)).not.toContain('hs-essay-senior-b')
    expect(testsForGrade('12').map((t) => t.id)).toContain('hs-essay-senior-b')
    expect(testsForGrade('3').filter((t) => t.id.startsWith('hs-'))).toHaveLength(0)
  })

  it('every math answer-key value parses or is intentionally human-graded', () => {
    for (const item of HS_MATH_DIAGNOSTIC.sections.flatMap((s) => s.items)) {
      if (item.key === undefined) {
        expect(item.keyNote, `${item.id} human-graded needs a keyNote`).toBeTruthy()
      }
    }
  })
})

// ---------- normalizer equivalence table ----------

describe('answer normalizer equivalence table', () => {
  const equiv: [string, string][] = [
    // fractions / mixed / improper
    ['19/12', '1 7/12'],
    ['7 1/2', '15/2'],
    ['7 1/2', '7.5'],
    ['7 1/2', '7.50'],
    ['1', '1'],
    // decimals
    ['2.28', '2.280'],
    ['1.3', '1.30'],
    // percents
    ['75%', '75'],
    ['75%', '75 percent'],
    // money
    ['$20', '20'],
    ['$20', '$20.00'],
    // negatives (unicode minus)
    ['−24', '-24'],
    // pi forms
    ['10π', '10pi'],
    ['10π', '10 pi'],
    ['90π', '90 pi'],
    // angles
    ['56°', '56'],
    ['56°', '56 degrees'],
    ['75°', '75'],
  ]
  it.each(equiv)('treats %s and %s as equal', (a, b) => {
    const ra = parseRational(a)
    const rb = parseRational(b)
    expect(ra, `parse ${a}`).not.toBeNull()
    expect(rb, `parse ${b}`).not.toBeNull()
    expect(rationalsEqual(ra!, rb!)).toBe(true)
  })

  const distinct: [string, string][] = [
    ['10π', '10'], // pi vs no pi
    ['19/12', '1.58'], // not exactly equal
    ['7', '-7'],
    ['56°', '54°'],
  ]
  it.each(distinct)('keeps %s and %s distinct', (a, b) => {
    const ra = parseRational(a)!
    const rb = parseRational(b)!
    expect(rationalsEqual(ra, rb)).toBe(false)
  })

  it('normalizes inequalities, equations and polynomials as text', () => {
    expect(normalizeText('x ≤ −3')).toBe(normalizeText('x<=-3'))
    expect(normalizeText('x ≤ −3')).not.toBe(normalizeText('x >= -3'))
    expect(normalizeText('y = −3x + 5')).toBe(normalizeText('y=-3x+5'))
    expect(normalizeText('x² − 2x − 24')).toBe(normalizeText('x^2-2x-24'))
    expect(normalizeText('3x³')).toBe(normalizeText('3x^3'))
  })
})

// ---------- scoreItem: SKIP distinct from blank distinct from wrong ----------

describe('scoreItem verdicts', () => {
  const numItem: Item = { id: 'n', kind: 'numeric', prompt: '', key: '19/12' }

  it('SKIP is distinct from blank and from wrong', () => {
    expect(scoreItem(numItem, '', true)).toBe('skip') // skipped
    expect(scoreItem(numItem, '', false)).toBe('unmatched') // blank, not skipped → human queue
    expect(scoreItem(numItem, '5/6', false)).toBe('incorrect') // clean wrong number
    expect(scoreItem(numItem, '1 7/12', false)).toBe('correct') // equivalent form
    expect(scoreItem(numItem, 'i dunno', false)).toBe('unmatched') // unparseable → human queue
  })

  it('choice items score confidently both ways', () => {
    const c: Item = { id: 'c', kind: 'choice', prompt: '', choices: ['was', 'were'], key: 'was' }
    expect(scoreItem(c, 'was', false)).toBe('correct')
    expect(scoreItem(c, 'were', false)).toBe('incorrect')
  })

  it('array keys require every value; partial → human queue', () => {
    const a: Item = { id: 'a', kind: 'text', prompt: '', key: ['7', '-7'] }
    expect(scoreItem(a, '7, -7', false)).toBe('correct')
    expect(scoreItem(a, '-7 and 7', false)).toBe('correct')
    expect(scoreItem(a, '7', false)).toBe('unmatched') // missing -7
  })

  it('no-key items are ungraded (human), never wrong', () => {
    const h: Item = { id: 'h', kind: 'text', prompt: '', keyNote: 'human' }
    expect(scoreItem(h, 'anything', false)).toBe('ungraded')
    expect(scoreItem(h, '', true)).toBe('skip')
  })

  it('text-key equations: exact match correct, variant queued (never falsely wrong)', () => {
    const eq: Item = { id: 'eq', kind: 'text', prompt: '', key: 'y = −3x + 5' }
    expect(scoreItem(eq, 'y=-3x+5', false)).toBe('correct')
    expect(scoreItem(eq, 'y = 5 − 3x', false)).toBe('unmatched') // equivalent but reordered → human
  })
})

// ---------- scripted full math-diagnostic run with deliberate skips ----------

describe('scripted full math-diagnostic run', () => {
  const NOW = '2026-07-23T10:00:00.000Z'
  const SKIP = new Set(['m12', 'm30'])

  function scriptedAnswers(test: FixedTest): Attempt {
    let state = emptyAssessmentState()
    const started = startAttempt(state, test.id, 'p4', NOW)
    state = started.state
    for (const section of test.sections) {
      for (const item of section.items) {
        if (SKIP.has(item.id)) {
          state = recordAnswer(state, test.id, item.id, '', true, 3000)
        } else if (Array.isArray(item.key)) {
          state = recordAnswer(state, test.id, item.id, item.key.join(', '), false, 20000)
        } else if (item.key !== undefined) {
          state = recordAnswer(state, test.id, item.id, item.key, false, 20000)
        } else {
          // human-graded item (m16): answer it
          state = recordAnswer(state, test.id, item.id, '9; between 6 and 7', false, 20000)
        }
      }
    }
    state = finishAttempt(state, test, '2026-07-23T10:40:00.000Z')
    return getState(state).attempts[0]
  }

  it('auto-scores each section correctly, records skips and human items', () => {
    const attempt = scriptedAnswers(HS_MATH_DIAGNOSTIC)
    const score = attempt.autoScore!
    expect(score.bySection['Section 1 — Number Foundations']).toEqual({ correct: 10, of: 10 })
    // section 2: 7 keyed items, m12 skipped, m16 human → 6/6 auto
    expect(score.bySection['Section 2 — Pre-Algebra']).toEqual({ correct: 6, of: 6 })
    expect(score.bySection['Section 3 — Algebra I']).toEqual({ correct: 10, of: 10 })
    // section 4: 6 keyed, m30 skipped → 5/5
    expect(score.bySection['Section 4 — Geometry Sampler']).toEqual({ correct: 5, of: 5 })
    expect(score.skips).toBe(2) // m12, m30
    expect(score.gradedItems).toBe(1) // m16
  })

  it('feeding every canonical key scores a perfect auto-score (no skips)', () => {
    let state = emptyAssessmentState()
    state = startAttempt(state, HS_MATH_DIAGNOSTIC.id, 'p4', NOW).state
    for (const s of HS_MATH_DIAGNOSTIC.sections) {
      for (const item of s.items) {
        if (item.key === undefined) continue // m16 human
        const v = Array.isArray(item.key) ? item.key.join(', ') : item.key
        state = recordAnswer(state, HS_MATH_DIAGNOSTIC.id, item.id, v, false, 10000)
      }
    }
    state = finishAttempt(state, HS_MATH_DIAGNOSTIC, NOW)
    const score = getState(state).attempts[0].autoScore!
    const totalCorrect = Object.values(score.bySection).reduce((n, x) => n + x.correct, 0)
    const totalOf = Object.values(score.bySection).reduce((n, x) => n + x.of, 0)
    expect(totalCorrect).toBe(33) // all 34 minus the one human-graded m16
    expect(totalOf).toBe(33)
  })

  it('export report contains every item id and the verbatim answer, with skips flagged', () => {
    const attempt = scriptedAnswers(HS_MATH_DIAGNOSTIC)
    const report = buildReport(HS_MATH_DIAGNOSTIC, attempt, 'Sophomore')
    for (const s of HS_MATH_DIAGNOSTIC.sections) {
      for (const item of s.items) expect(report).toContain(item.id)
    }
    expect(report).toContain('[SKIPPED]')
    expect(report).toContain('m12')
    // no star currency anywhere in an assessment artifact (word-boundary; "Started:" is fine)
    expect(report.toLowerCase()).not.toMatch(/\bstars?\b/)
    expect(report).not.toContain('⭐')
  })
})

// ---------- essay autosave survives reload ----------

describe('essay autosave persistence', () => {
  const NOW = '2026-07-23T09:00:00.000Z'
  it('an in-progress essay attempt round-trips through JSON (simulated reload)', () => {
    let state = emptyAssessmentState()
    state = startAttempt(state, HS_ESSAY.id, 'p4', NOW).state
    state = recordAnswer(state, HS_ESSAY.id, 'e1', 'My first paragraph...', false, 10000)
    state = recordAnswer(state, HS_ESSAY.id, 'e1', 'My first paragraph... and more.', false, 10000)

    const reloaded = JSON.parse(JSON.stringify(state))
    const attempt = getState(reloaded).attempts[0]
    expect(attempt.finishedAt).toBeUndefined() // still resumable
    expect(attempt.answers['e1'].value).toBe('My first paragraph... and more.')
    expect(attempt.answers['e1'].msOnItem).toBe(20000) // accumulated
    expect(startStatus(reloaded, HS_ESSAY.id)).toBe('in-progress')
  })
})

// ---------- assignment, start-code, retake lock ----------

describe('assignment + start-code + retake lock', () => {
  const NOW = '2026-07-23T08:00:00.000Z'

  it('assign stores a start code Dad controls', () => {
    let state = emptyAssessmentState()
    state = assignTest(state, 'hs-math-diagnostic', '4821', NOW)
    expect(findAssignment(state, 'hs-math-diagnostic')?.startCode).toBe('4821')
  })

  it('one completed attempt locks; retake needs Dad unlock and is a separate attempt', () => {
    let state = emptyAssessmentState()
    state = startAttempt(state, 'hs-grammar', 'p4', NOW).state
    state = finishAttempt(state, HS_GRAMMAR, NOW)
    expect(startStatus(state, 'hs-grammar')).toBe('completed-locked')

    // attempting to start again while locked does NOT create a new attempt
    const blocked = startAttempt(state, 'hs-grammar', 'p4', NOW)
    expect(getState(blocked.state).attempts).toHaveLength(1)

    // Dad unlocks → retake ready → new attempt created, unlock consumed, prior kept
    state = unlockRetake(state, 'hs-grammar')
    expect(startStatus(state, 'hs-grammar')).toBe('retake-ready')
    state = startAttempt(state, 'hs-grammar', 'p4', '2026-07-24T08:00:00.000Z').state
    expect(getState(state).attempts).toHaveLength(2)
    expect(getState(state).retakeUnlocked).not.toContain('hs-grammar')
  })

  it('interrupted attempt resumes the same attempt (no duplicate)', () => {
    let state = emptyAssessmentState()
    const a = startAttempt(state, 'hs-reading', 'p4', NOW)
    state = a.state
    const again = startAttempt(state, 'hs-reading', 'p4', '2026-07-23T08:05:00.000Z')
    expect(getState(again.state).attempts).toHaveLength(1)
    expect(again.attempt.startedAt).toBe(NOW) // original start preserved
  })
})

// ---------- backward-compat: state defaults ----------

describe('assessment state is additive / defaulted', () => {
  it('getState tolerates undefined and partial objects', () => {
    expect(getState(undefined)).toEqual({ assigned: [], attempts: [], retakeUnlocked: [] })
    // a profile from before MA (no assessments field) yields empty state
    const legacy = getState(undefined)
    expect(computeAutoScore(HS_GRAMMAR, { testId: 'hs-grammar', profileId: 'p', startedAt: 'x', answers: {} }).skips).toBe(
      itemCount(HS_GRAMMAR),
    )
    expect(legacy.attempts).toHaveLength(0)
  })
})
