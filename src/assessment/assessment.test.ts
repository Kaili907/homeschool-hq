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
  gradeAttempt,
  recordAnswer,
  startAttempt,
  startStatus,
  unlockRetake,
  findAssignment,
} from './attempts'
import { buildReport } from './report'
import type { Attempt, FixedTest, Item } from './types'
import { emptyAssessmentState } from './types'
import { defaultAppState } from '../migration'
import { validateAppStateForSync } from '../sync/provenance'

const NOW_START = '2026-08-07T09:00:00.000Z'
const NOW_FINISH = '2026-08-07T09:30:00.000Z'

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

// ---------- honest response dispositions ----------

describe('response disposition tells the truth about what the child did', () => {
  const test: FixedTest = {
    id: 'disp',
    title: 'Dispositions',
    forGrades: ['3'],
    sections: [
      {
        name: 'Only',
        items: [
          { id: 'd1', kind: 'numeric', prompt: 'keyed', key: '7' },
          { id: 'd2', kind: 'text', prompt: 'human graded', keyNote: 'a human reads this' },
        ],
      },
    ],
  }

  const attempt = (answers: Attempt['answers'], finishedAt?: string): Attempt => ({
    testId: 'disp',
    profileId: 'p',
    startedAt: NOW_START,
    finishedAt,
    answers,
  })

  const dispositionOf = (a: Attempt, itemId: string) =>
    gradeAttempt(test, a).find((g) => g.item.id === itemId)!.disposition

  it('a missing record on a FINISHED attempt is no-response, not a deliberate skip', () => {
    const a = attempt({}, NOW_FINISH)
    expect(dispositionOf(a, 'd1')).toBe('no-response')
    expect(gradeAttempt(test, a).every((g) => g.skipped === false)).toBe(true)
  })

  it('a missing record on an UNFINISHED attempt is not-reached — no evidence either way', () => {
    expect(dispositionOf(attempt({}), 'd1')).toBe('not-reached')
  })

  it('a stored blank is no-response, never work awaiting a human', () => {
    const a = attempt({ d1: { value: '', skipped: false, msOnItem: 900 } }, NOW_FINISH)
    expect(dispositionOf(a, 'd1')).toBe('no-response')

    // even on a human-graded item there is nothing to read
    const b = attempt({ d2: { value: '   ', skipped: false, msOnItem: 900 } }, NOW_FINISH)
    expect(dispositionOf(b, 'd2')).toBe('no-response')
  })

  it('only skipped === true is a deliberate skip', () => {
    const a = attempt({ d1: { value: '', skipped: true, msOnItem: 900 } }, NOW_FINISH)
    expect(dispositionOf(a, 'd1')).toBe('deliberate-skip')
    expect(gradeAttempt(test, a).find((g) => g.item.id === 'd1')!.skipped).toBe(true)
  })

  it('a nonblank response still routes to a human when the scorer is not confident', () => {
    const a = attempt({ d1: { value: 'about seven', skipped: false, msOnItem: 9000 } }, NOW_FINISH)
    expect(dispositionOf(a, 'd1')).toBe('unmatched')

    const b = attempt({ d2: { value: 'my paragraph', skipped: false, msOnItem: 9000 } }, NOW_FINISH)
    expect(dispositionOf(b, 'd2')).toBe('ungraded')
  })

  it('correct and incorrect are unchanged', () => {
    expect(dispositionOf(attempt({ d1: { value: '7', skipped: false, msOnItem: 1 } }, NOW_FINISH), 'd1')).toBe('correct')
    expect(dispositionOf(attempt({ d1: { value: '8', skipped: false, msOnItem: 1 } }, NOW_FINISH), 'd1')).toBe('incorrect')
  })

  it('autoScore counts no-response separately and never inflates skips', () => {
    const score = computeAutoScore(
      test,
      attempt(
        {
          d1: { value: '', skipped: false, msOnItem: 900 },
          d2: { value: '', skipped: true, msOnItem: 900 },
        },
        NOW_FINISH,
      ),
    )
    expect(score.skips).toBe(1)
    expect(score.noResponse).toBe(1)
    expect(score.gradedItems).toBe(0)
  })

  it('an item nobody reached is counted in no tally at all', () => {
    const score = computeAutoScore(test, attempt({}))
    expect(score.skips).toBe(0)
    expect(score.gradedItems).toBe(0)
    expect(score.noResponse).toBe(0)
    expect(score.bySection['Only']).toEqual({ correct: 0, of: 0 })
  })

  it('the report labels each disposition distinctly and never invents an answer', () => {
    const report = buildReport(
      test,
      attempt(
        {
          d1: { value: '', skipped: false, msOnItem: 900 },
          d2: { value: '', skipped: true, msOnItem: 900 },
        },
        NOW_FINISH,
      ),
      'Third Grader',
    )
    expect(report).toContain('SEEN — NO RESPONSE')
    expect(report).toContain('[no response]')
    expect(report).toContain('[SKIPPED]')
    expect(report).not.toContain('NEEDS GRADING')
    expect(report).toContain('- Seen, no response: 1')
    expect(report).toContain('- Deliberate skips: 1')
  })

  it('a legacy autoScore without the no-response tally reads "not recorded", never 0', () => {
    const legacy: Attempt = {
      ...attempt({ d1: { value: '', skipped: false, msOnItem: 900 } }, NOW_FINISH),
      // shape persisted before this tally existed
      autoScore: { bySection: { Only: { correct: 0, of: 0 } }, gradedItems: 1, skips: 1 },
    }
    const report = buildReport(test, legacy, 'Third Grader')
    expect(report).toContain('- Seen, no response: not recorded')
    expect(report).not.toContain('- Seen, no response: 0')
    expect(report).toMatch(/NOTE: .*scored before/)
  })

  it('the legacy note names BOTH counts a seen-but-blank item could have landed in', () => {
    // Older scoring had no no-response bucket: an absent record was folded into the
    // skip count, and a stored blank scored as unmatched and raised the human-grading
    // count. Neither is recoverable, so the note must not name only one of them.
    const legacy: Attempt = {
      ...attempt({ d1: { value: '', skipped: false, msOnItem: 900 } }, NOW_FINISH),
      autoScore: { bySection: { Only: { correct: 0, of: 0 } }, gradedItems: 1, skips: 1 },
    }
    const note = buildReport(test, legacy, 'Third Grader')
      .split('\n')
      .find((l) => l.startsWith('- NOTE:'))!

    expect(note).toMatch(/skip/i)
    expect(note).toMatch(/grading/i)
    expect(note).toMatch(/may/i) // uncertainty, not a restatement of history
    // it explains an older counting rule; it does not accuse the data of being broken
    expect(note).not.toMatch(/corrupt|lost|damaged|invalid|wrong|error/i)
  })

  it('a fresh autoScore reporting zero no-responses says 0', () => {
    const fresh: Attempt = {
      ...attempt({ d1: { value: '7', skipped: false, msOnItem: 900 } }, NOW_FINISH),
      autoScore: { bySection: { Only: { correct: 1, of: 1 } }, gradedItems: 0, skips: 0, noResponse: 0 },
    }
    const report = buildReport(test, fresh, 'Third Grader')
    expect(report).toContain('- Seen, no response: 0')
    expect(report).not.toMatch(/NOTE: .*scored before/)
  })
})

// ---------- the persisted tally describes the attempt it is stored on ----------

describe('finishAttempt scores the finished attempt, not the in-progress one', () => {
  const ALL_IDS = HS_GRAMMAR.sections.flatMap((s) => s.items.map((i) => i.id))

  /** Drive the real pipeline end to end: start, record only these items, finish. */
  const run = (record: (state: ReturnType<typeof emptyAssessmentState>) => ReturnType<typeof emptyAssessmentState>): Attempt => {
    let state = emptyAssessmentState()
    state = startAttempt(state, HS_GRAMMAR.id, 'p', NOW_START).state
    state = record(state)
    state = finishAttempt(state, HS_GRAMMAR, NOW_FINISH)
    return getState(state).attempts[0]
  }

  /** Answer everything except the listed ids. */
  const answerAllBut = (untouched: string[]) =>
    run((state) => {
      for (const id of ALL_IDS) {
        if (untouched.includes(id)) continue
        state = recordAnswer(state, HS_GRAMMAR.id, id, 'was', false, 5000)
      }
      return state
    })

  const noResponseGrades = (a: Attempt) =>
    gradeAttempt(HS_GRAMMAR, a).filter((g) => g.disposition === 'no-response').length

  const cases: Array<[string, string[]]> = [
    ['the FIRST item untouched', ['g1']],
    ['a MIDDLE item untouched', ['g8']],
    ['the LAST item untouched', ['g15']],
    ['every item untouched', ALL_IDS],
  ]

  for (const [label, untouched] of cases) {
    it(`persists the tally the finished attempt actually shows — ${label}`, () => {
      const attempt = answerAllBut(untouched)
      expect(attempt.finishedAt).toBe(NOW_FINISH)
      expect(attempt.autoScore!.noResponse).toBe(untouched.length)
      expect(attempt.autoScore!.noResponse).toBe(noResponseGrades(attempt))
    })
  }

  it('the stored score equals a full recompute over the persisted finished attempt', () => {
    for (const [, untouched] of cases) {
      const attempt = answerAllBut(untouched)
      expect(attempt.autoScore).toEqual(computeAutoScore(HS_GRAMMAR, attempt))
    }
  })

  it('a fresh report cannot claim one no-response and then list fifteen', () => {
    // She opened the first item, typed nothing, and never touched the other 14.
    // Under the old ordering the stored summary said 1 and the list showed 15.
    const attempt = run((state) => recordAnswer(state, HS_GRAMMAR.id, 'g1', '', false, 2000))
    const report = buildReport(HS_GRAMMAR, attempt, 'Tenth Grader')

    const listed = report.split('\n').filter((l) => l.includes('SEEN — NO RESPONSE')).length
    expect(listed).toBe(itemCount(HS_GRAMMAR))
    expect(report).toContain(`- Seen, no response: ${listed}`)
    expect(report).not.toContain('- Seen, no response: 1\n')
  })

  it('a deliberate skip stays a skip and is never folded into the no-response tally', () => {
    const attempt = run((state) => {
      state = recordAnswer(state, HS_GRAMMAR.id, 'g2', '', true, 3000)
      state = recordAnswer(state, HS_GRAMMAR.id, 'g3', 'was', false, 4000)
      return state
    })
    const score = attempt.autoScore!
    expect(score.skips).toBe(1)
    expect(score.noResponse).toBe(13) // 15 - the skip - the answered one
    expect(score.noResponse).toBe(noResponseGrades(attempt))
  })

  it('a fresh finished attempt never carries the legacy caveat', () => {
    const attempt = answerAllBut(['g1'])
    const report = buildReport(HS_GRAMMAR, attempt, 'Tenth Grader')
    expect(report).not.toMatch(/NOTE: .*scored before/)
    expect(report).toContain('- Seen, no response: 1')
  })
})

// ---------- what lets "finished ⇒ every item was reached" hold ----------

describe('every finish path puts each item in front of the child', () => {
  // AssessmentRunner sends an all-longtext test to EssayEditor instead of the
  // player, and EssayEditor only ever records allItems(test)[0]. A second prompt
  // there would finish an attempt holding items nobody was ever shown, and this
  // card's reading of an absent record ("seen, wrote nothing") would become a
  // lie. The player's own one-at-a-time invariant is pinned in
  // TestPlayer.evidence.test.tsx; this is the other half of the claim.
  it('a test routed to the essay editor has exactly one item', () => {
    for (const test of ALL_TESTS) {
      const items = test.sections.flatMap((s) => s.items)
      const routedToEssayEditor = items.every((i) => i.kind === 'longtext')
      if (routedToEssayEditor) {
        expect(items, `${test.id} is essay-routed and must hold one prompt`).toHaveLength(1)
      }
    }
  })

  it('every other test is played one item at a time', () => {
    const played = ALL_TESTS.filter(
      (t) => !t.sections.flatMap((s) => s.items).every((i) => i.kind === 'longtext'),
    )
    expect(played.length).toBeGreaterThan(0)
    for (const test of played) expect(itemCount(test)).toBeGreaterThan(0)
  })
})

// ---------- sync contract for the optional tally ----------

describe('provenance validates the optional noResponse tally', () => {
  const withAutoScore = (autoScore: unknown) => {
    const state = defaultAppState()
    const profileId = Object.keys(state.profiles)[0]
    ;(state.profiles[profileId] as unknown as Record<string, unknown>).assessments = {
      assigned: [],
      attempts: [
        {
          testId: 'hs-grammar',
          profileId,
          startedAt: NOW_START,
          finishedAt: NOW_FINISH,
          answers: { g1: { value: '', skipped: true, msOnItem: 900 } },
          autoScore,
        },
      ],
      retakeUnlocked: [],
    }
    return validateAppStateForSync(state).ok
  }

  const BASE = { bySection: { Only: { correct: 1, of: 2 } }, gradedItems: 0, skips: 1 }

  it('accepts an attempt persisted before the tally existed', () => {
    expect(withAutoScore(BASE)).toBe(true)
  })

  it('accepts a valid non-negative integer tally', () => {
    expect(withAutoScore({ ...BASE, noResponse: 0 })).toBe(true)
    expect(withAutoScore({ ...BASE, noResponse: 3 })).toBe(true)
  })

  it('rejects a malformed tally rather than letting it through unchecked', () => {
    expect(withAutoScore({ ...BASE, noResponse: -1 })).toBe(false)
    expect(withAutoScore({ ...BASE, noResponse: 1.5 })).toBe(false)
    expect(withAutoScore({ ...BASE, noResponse: '2' })).toBe(false)
    expect(withAutoScore({ ...BASE, noResponse: null })).toBe(false)
    expect(withAutoScore({ ...BASE, noResponse: Number.NaN })).toBe(false)
  })
})

// ---------- backward-compat: state defaults ----------

describe('assessment state is additive / defaulted', () => {
  it('getState tolerates undefined and partial objects', () => {
    expect(getState(undefined)).toEqual({ assigned: [], attempts: [], retakeUnlocked: [] })
    // a profile from before MA (no assessments field) yields empty state
    const legacy = getState(undefined)
    // An attempt with no answers and no finish is an attempt nobody has taken:
    // every item is simply unreached, and none of them is evidence of anything.
    const untaken = computeAutoScore(HS_GRAMMAR, {
      testId: 'hs-grammar',
      profileId: 'p',
      startedAt: NOW_START,
      answers: {},
    })
    expect(untaken.skips).toBe(0)
    expect(untaken.noResponse).toBe(0)
    expect(gradeAttempt(HS_GRAMMAR, { testId: 'hs-grammar', profileId: 'p', startedAt: NOW_START, answers: {} })).toHaveLength(
      itemCount(HS_GRAMMAR),
    )
    expect(legacy.attempts).toHaveLength(0)
  })
})
