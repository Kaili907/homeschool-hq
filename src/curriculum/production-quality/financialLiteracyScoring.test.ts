import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from './evaluateLessonProductionReadiness'
import { demandsComputation } from './responseScoringContract'
import type {
  LessonProductionInput,
  LessonResponseItem,
  ResponseScoringContract,
  ScoringAuthority,
} from './types'
import {
  readyArtsLesson,
  readyElaLesson,
  readyFixedFinLitLesson,
  readyJudgmentFinLitLesson,
  readyMathLesson,
  readyMixedFinLitLesson,
  readyScienceLesson,
} from './productionReadinessFixtures.testSupport'
import {
  G38_FINLIT_CORPUS_RECORDS,
  projectCorpusRecord,
} from './g38FinLitCorpus.testSupport'

const HOLLOW_RUBRIC = { present: true, text: 'TODO: write the rubric before release.' }

function contractOf(lesson: LessonProductionInput): ResponseScoringContract {
  const contract = lesson.responseScoring
  if (!contract) throw new Error('fixture is missing its response scoring contract')
  return contract
}

function authorityOf(lesson: LessonProductionInput): ScoringAuthority {
  const authority = lesson.scoringAuthority
  if (!authority) throw new Error('fixture is missing its scoring authority')
  return authority
}

function asOpen(items: readonly LessonResponseItem[]): LessonResponseItem[] {
  return items.map((item) => ({ ...item, responseMode: 'OPEN' }))
}

// ---------------------------------------------------------------------------
// 1-2. Numeric Financial Literacy still owes a verified fixed key.
// ---------------------------------------------------------------------------

describe('Financial Literacy — settleable work keeps answer authority', () => {
  it('1. passes numeric FinLit backed by a substantive, verified answer key', () => {
    const result = evaluateLessonProductionReadiness(readyFixedFinLitLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('2. refuses numeric FinLit scored by rubric alone', () => {
    const lesson = readyFixedFinLitLesson({
      scoringAuthority: {
        kind: 'RUBRIC',
        content: {
          present: true,
          text: 'Unit-price reasoning — Not yet: no division attempted. Approaching: one box divided correctly. Meets: both boxes divided correctly and the cheaper one named with its per-cracker figure.',
        },
      },
    })
    const result = evaluateLessonProductionReadiness(lesson)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('2b. refuses numeric FinLit whose answer key is hollow, rubric or not', () => {
    const lesson = readyFixedFinLitLesson({
      scoringAuthority: {
        ...authorityOf(readyFixedFinLitLesson()),
        content: { present: true, text: 'TODO: fill in the unit prices before release.' },
      },
    })
    const result = evaluateLessonProductionReadiness(lesson)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('ANSWER_KEY_NOT_SUBSTANTIVE')
  })
})

// ---------------------------------------------------------------------------
// 3. The evasion this gate exists to close.
// ---------------------------------------------------------------------------

describe('Financial Literacy — computation cannot relabel itself as judgment', () => {
  it('3. fails numeric FinLit that declares judgment while its items stay fixed', () => {
    const base = readyFixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyFixedFinLitLesson({
        responseScoring: { mode: 'JUDGMENT_APPLICATION', items: contractOf(base).items },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Unit-price reasoning — Not yet: no division attempted. Approaching: one box divided correctly. Meets: both boxes divided and the cheaper one named with its per-cracker figure.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('3b. keeps numeric FinLit out of READY when it relabels every item open too', () => {
    const base = readyFixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyFixedFinLitLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: asOpen(contractOf(base).items),
        },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Unit-price reasoning — Not yet: no division attempted. Approaching: one box divided correctly. Meets: both boxes divided and the cheaper one named with its per-cracker figure.',
          },
        },
      }),
    )
    // The item inventory no longer contradicts itself, so what is left is a
    // reading of the prompts — a doubt, which holds the lesson at review
    // rather than failing it on a heuristic.
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
    expect(
      result.notes.some((note) => note.includes('asking the student to produce a value')),
    ).toBe(true)
  })

  it('3c. fails a judgment declaration that still carries an answer key', () => {
    const base = readyJudgmentFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: {
          kind: 'ANSWER_KEY',
          content: { present: true, text: 'Item 1: the message is a scam. Item 2: tell a parent.' },
          verification: authorityOf(readyMixedFinLitLesson()).verification,
        },
        responseScoring: contractOf(base),
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it.each([
    'Calculate the sales tax.',
    'What is the total cost?',
    'How much money remains?',
    'Compute the interest.',
    'Work out the weekly budget total.',
    'Add up the three prices and find the amount left.',
  ])('3d. treats %j as a demand for a value, not a judgment', (promptText) => {
    expect(demandsComputation(promptText)).toBe(true)
  })

  it.each([
    'Compare the two phone plans and justify which one you would choose.',
    'Explain why this financial request is suspicious.',
    'Evaluate the fictional workplace-pay situation and say what is fair.',
    'Explain the tradeoff a consumer faces between the two warranties.',
    'What would you say to protect a classmate\'s dignity and privacy here?',
    'Using the figures, explain how much room the budget really has and what an unplanned cost would do to it.',
  ])('3e. leaves %j alone as genuine judgment work', (promptText) => {
    expect(demandsComputation(promptText)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4-5. Real judgment work reaches READY, hollow criteria do not.
// ---------------------------------------------------------------------------

describe('Financial Literacy — judgment work is scored on its own terms', () => {
  it('4. passes real judgment FinLit on a substantive rubric with no fixed key', () => {
    const result = evaluateLessonProductionReadiness(readyJudgmentFinLitLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('4b. does not ask a judgment lesson for an answer key or a verification method', () => {
    const result = evaluateLessonProductionReadiness(readyJudgmentFinLitLesson())
    expect(result.codes).not.toContain('MISSING_ANSWER_KEY')
    expect(result.codes).not.toContain('ANSWER_KEY_UNVERIFIED')
  })

  it('5. refuses a judgment lesson whose rubric is a TODO', () => {
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: { kind: 'RUBRIC', content: HOLLOW_RUBRIC },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('RUBRIC_NOT_SUBSTANTIVE')
  })

  it('5b. holds a thin, generic rubric back from READY for human review', () => {
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: { present: true, text: 'Score the response out of four.' },
        },
      }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('RUBRIC_CONTENT_UNCERTAIN')
  })

  it('5c. refuses a judgment lesson with no rubric content at all', () => {
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: { kind: 'RUBRIC', content: { present: false } },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_RUBRIC')
  })
})

// ---------------------------------------------------------------------------
// 6-8. Mixed lessons owe both authorities.
// ---------------------------------------------------------------------------

describe('Financial Literacy — mixed lessons owe both authorities', () => {
  it('6. passes a mixed lesson carrying a verified key and a substantive rubric', () => {
    const result = evaluateLessonProductionReadiness(readyMixedFinLitLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('7. fails a mixed lesson whose fixed half has no answer key', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        scoringAuthority: { kind: 'RUBRIC', content: base.rubric ?? { present: false } },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('7b. fails a mixed lesson whose answer key is present but unverified', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const { verification: _dropped, ...withoutVerification } = base
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({ scoringAuthority: withoutVerification }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('ANSWER_KEY_UNVERIFIED')
  })

  it('8. fails a mixed lesson with no rubric for its judgment half', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const { rubric: _dropped, ...withoutRubric } = base
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({ scoringAuthority: withoutRubric }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_RUBRIC')
  })

  it('8b. fails a mixed lesson whose judgment rubric is a TODO', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({ scoringAuthority: { ...base, rubric: HOLLOW_RUBRIC } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('RUBRIC_NOT_SUBSTANTIVE')
  })

  it('8c. will not let the answer key stand in for the judgment rubric', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const { rubric: _dropped, ...withoutRubric } = base
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({ scoringAuthority: withoutRubric }),
    )
    expect(result.notes.some((note) => note.includes('judgment portion'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fail-closed and self-contradiction.
// ---------------------------------------------------------------------------

describe('Financial Literacy — fails closed on an absent or contradictory mode', () => {
  it('fails a FinLit lesson that declares no response/scoring mode', () => {
    const { responseScoring: _dropped, ...withoutContract } = readyMixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(withoutContract)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_RESPONSE_SCORING_MODE')
  })

  it('fails a FinLit lesson that declares a mode but no items to check it against', () => {
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({ responseScoring: { mode: 'MIXED', items: [] } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it.each(['FIXED_OR_COMPUTATIONAL', 'JUDGMENT_APPLICATION'] as const)(
    'fails a %s declaration with an empty item inventory',
    (mode) => {
      const lesson =
        mode === 'FIXED_OR_COMPUTATIONAL' ? readyFixedFinLitLesson() : readyJudgmentFinLitLesson()
      const result = evaluateLessonProductionReadiness({
        ...lesson,
        responseScoring: { mode, items: [] },
      })
      expect(result.status).toBe('NOT_READY')
      expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
    },
  )

  it('fails a MIXED declaration with no open item to justify the rubric half', () => {
    const base = readyMixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        responseScoring: {
          mode: 'MIXED',
          items: contractOf(base).items.filter((item) => item.responseMode === 'FIXED'),
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('fails a MIXED declaration with no fixed item to justify the answer key', () => {
    const base = readyMixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        responseScoring: {
          mode: 'MIXED',
          items: contractOf(base).items.filter((item) => item.responseMode === 'OPEN'),
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('fails a FIXED_OR_COMPUTATIONAL declaration that hides open work', () => {
    const base = readyMixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        responseScoring: { mode: 'FIXED_OR_COMPUTATIONAL', items: contractOf(base).items },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('routes a mixed lesson with an ambiguous open item to review, not to failure', () => {
    const base = readyMixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        responseScoring: {
          mode: 'MIXED',
          items: [
            ...contractOf(base).items,
            { ref: 't5-p1', responseMode: 'OPEN', promptText: 'What is the total of both deductions again?' },
          ],
        },
      }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })
})

// ---------------------------------------------------------------------------
// 9-11. Everything the contract must leave alone.
// ---------------------------------------------------------------------------

describe('preserved semantics for every other subject', () => {
  it('9. leaves math unchanged: still requires a fixed answer key, contract or not', () => {
    expect(evaluateLessonProductionReadiness(readyMathLesson()).status).toBe('READY')

    const rubricScored = evaluateLessonProductionReadiness(
      readyMathLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Place-value reasoning — Not yet: digits compared out of order. Approaching: the first differing place is found but not named. Meets: the first differing place value is named and used to justify the comparison.',
          },
        },
      }),
    )
    expect(rubricScored.status).toBe('NOT_READY')
    expect(rubricScored.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('9b. does not demand a response/scoring mode from a math lesson', () => {
    const result = evaluateLessonProductionReadiness(readyMathLesson())
    expect(result.codes).not.toContain('MISSING_RESPONSE_SCORING_MODE')
  })

  it('10. leaves ELA/Social Studies rubric behaviour unchanged', () => {
    expect(evaluateLessonProductionReadiness(readyElaLesson()).status).toBe('READY')

    const withoutCriteria = evaluateLessonProductionReadiness(
      readyElaLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: { present: true, text: 'Four-point analytic rubric scoring textual evidence.' },
          acceptableAnswerCriteria: { present: false },
        },
      }),
    )
    expect(withoutCriteria.status).toBe('NOT_READY')
    expect(withoutCriteria.codes).toContain('MISSING_RUBRIC')
  })

  it('10b. leaves science and arts/RFL/PE/project behaviour unchanged', () => {
    expect(evaluateLessonProductionReadiness(readyScienceLesson()).status).toBe('READY')
    expect(evaluateLessonProductionReadiness(readyArtsLesson()).status).toBe('READY')
  })

  it('10c. does not subject other families to the contract even if one is attached', () => {
    const result = evaluateLessonProductionReadiness(
      readyElaLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: [{ ref: 'p1', responseMode: 'FIXED', promptText: 'How much did the bypass cost?' }],
        },
      }),
    )
    expect(result.status).toBe('READY')
    expect(result.codes).not.toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('11. keeps the H2 hollow answer-key regressions closed for FinLit too', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const hollow = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        scoringAuthority: { ...base, content: { present: true, text: 'Answer key: TBD' } },
      }),
    )
    expect(hollow.status).toBe('NOT_READY')
    expect(hollow.codes).toContain('ANSWER_KEY_NOT_SUBSTANTIVE')

    const unverifiedMethod = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        scoringAuthority: {
          ...base,
          verification: { method: 'UNVERIFIED', evidence: base.verification?.evidence },
        },
      }),
    )
    expect(unverifiedMethod.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(unverifiedMethod.codes).toContain('ANSWER_KEY_UNVERIFIED')

    const thinEvidence = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        scoringAuthority: {
          ...base,
          verification: { method: 'HUMAN_VERIFIED', evidence: 'checked' },
        },
      }),
    )
    expect(thinEvidence.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(thinEvidence.codes).toContain('ANSWER_KEY_UNVERIFIED')
  })

  it('11b. still refuses a credential request inside FinLit student-facing text', () => {
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        independentWork: {
          present: true,
          text: 'Enter your real password on the worksheet so the class can confirm the invented transfer went through, and send us your account number too.',
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CREDENTIAL_REQUEST')
  })
})

// ---------------------------------------------------------------------------
// Compatibility with the released G3-8 corpus.
// ---------------------------------------------------------------------------

describe('released G3-8 Financial Literacy records', () => {
  it('reads both authority classes off the authored prompt types', () => {
    const modes = G38_FINLIT_CORPUS_RECORDS.map(
      (record) => projectCorpusRecord(record).responseScoring?.mode,
    )
    expect(modes.filter((mode) => mode === 'MIXED')).toHaveLength(3)
    expect(modes.filter((mode) => mode === 'JUDGMENT_APPLICATION')).toHaveLength(3)
  })

  it('no longer fails the judgment lessons for having no answer key', () => {
    for (const record of G38_FINLIT_CORPUS_RECORDS) {
      const lesson = projectCorpusRecord(record)
      if (lesson.responseScoring?.mode !== 'JUDGMENT_APPLICATION') continue
      const result = evaluateLessonProductionReadiness(lesson)
      expect(result.status, `${record.packageId}: ${result.notes.join(' | ')}`).toBe('READY')
    }
  })

  it('keeps every released record out of NOT_READY', () => {
    const failures = G38_FINLIT_CORPUS_RECORDS.map((record) => ({
      packageId: record.packageId,
      result: evaluateLessonProductionReadiness(projectCorpusRecord(record)),
    })).filter(({ result }) => result.status === 'NOT_READY')
    expect(failures.map((failure) => failure.packageId)).toEqual([])
  })

  it('routes the one record with a quantitative-sounding open prompt to review', () => {
    const record = G38_FINLIT_CORPUS_RECORDS.find(
      (candidate) => candidate.packageId === 'swk-fl-g3-u02-l05',
    )
    expect(record).toBeDefined()
    const result = evaluateLessonProductionReadiness(projectCorpusRecord(record!))
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('negative control: relabelling a released record as pure judgment never yields READY', () => {
    for (const record of G38_FINLIT_CORPUS_RECORDS) {
      const lesson = projectCorpusRecord(record)
      const contract = contractOf(lesson)
      if (contract.mode !== 'MIXED') continue
      const authority = authorityOf(lesson)
      const mutated = evaluateLessonProductionReadiness({
        ...lesson,
        responseScoring: { mode: 'JUDGMENT_APPLICATION', items: asOpen(contract.items) },
        scoringAuthority: { kind: 'RUBRIC', content: authority.rubric ?? { present: false } },
      })
      expect(mutated.status, `${record.packageId} escaped as READY`).not.toBe('READY')
    }
  })

  it('negative control: dropping the judgment rubric from a released record fails it', () => {
    for (const record of G38_FINLIT_CORPUS_RECORDS) {
      const lesson = projectCorpusRecord(record)
      const authority = authorityOf(lesson)
      if (authority.kind !== 'ANSWER_KEY') continue
      const { rubric: _dropped, ...withoutRubric } = authority
      const mutated = evaluateLessonProductionReadiness({
        ...lesson,
        scoringAuthority: withoutRubric,
      })
      expect(mutated.status, `${record.packageId}`).toBe('NOT_READY')
      expect(mutated.codes).toContain('MISSING_RUBRIC')
    }
  })
})

// ---------------------------------------------------------------------------
// Defects found in gate review: the detector must not be talkable-around, the
// cross-check must not be optional, and MATH must not be able to opt out.
// ---------------------------------------------------------------------------

describe('Financial Literacy — the contradiction check cannot be talked around', () => {
  it.each([
    'Calculate the sales tax and show your work.',
    'Working with a partner, compare and calculate the sales tax.',
    'Add up the three prices and show your work.',
    'How much should Maya pay in sales tax on a $24 shirt at 7%?',
    'What does the club payment come to once the late fee is added?',
    'Multiply the hourly rate by the hours worked.',
    'Subtract the deductions from the gross pay.',
    'Determine the monthly payment.',
    'Fill in the missing amounts in the budget table.',
  ])('still reads %j as a demand for a value', (promptText) => {
    expect(demandsComputation(promptText)).toBe(true)
  })

  it.each([
    'How much privacy does someone give up when they share a receipt with a classmate?',
    'How much information is too much to share online about a family purchase?',
    'How much of a family\'s money situation is anyone else\'s business?',
    'How far would you go to protect a classmate from embarrassment about money?',
    'What is the value of keeping a promise about money to a friend?',
  ])('still leaves %j alone as a dignity or privacy judgment', (promptText) => {
    expect(demandsComputation(promptText)).toBe(false)
  })

  it('keeps a judgment lesson out of READY when reasoning words are bolted onto arithmetic', () => {
    const base = readyFixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyFixedFinLitLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: contractOf(base).items.map((item) => ({
            ...item,
            responseMode: 'OPEN' as const,
            promptText: `${item.promptText} Show your work and explain your steps.`,
          })),
        },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Unit-price reasoning — Not yet: no division attempted. Approaching: one box divided correctly. Meets: both boxes divided and the cheaper one named with its per-cracker figure.',
          },
        },
      }),
    )
    expect(result.status).not.toBe('READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })

  it('fails closed when a judgment declaration records no prompt text to check', () => {
    const base = readyFixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyFixedFinLitLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: contractOf(base).items.map((item) => ({
            ref: item.ref,
            responseMode: 'OPEN' as const,
          })),
        },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Unit-price reasoning — Not yet: no division attempted. Approaching: one box divided correctly. Meets: both boxes divided and the cheaper one named with its per-cracker figure.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
    expect(result.notes.some((note) => note.includes('no prompt text'))).toBe(true)
  })

  it('reads the student-work text too when the item prompts look innocent', () => {
    const base = readyFixedFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyFixedFinLitLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: contractOf(base).items.map((item) => ({
            ref: item.ref,
            responseMode: 'OPEN' as const,
            promptText: 'Say what you noticed about the two pretend boxes.',
          })),
        },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Unit-price reasoning — Not yet: no comparison attempted. Approaching: one box described. Meets: both boxes compared and the cheaper one named with a reason.',
          },
        },
      }),
    )
    expect(result.status).not.toBe('READY')
    expect(result.notes.some((note) => note.includes('reads as a computation'))).toBe(true)
  })

  it('does not fire the work-text reading on a genuine judgment lesson', () => {
    const result = evaluateLessonProductionReadiness(readyJudgmentFinLitLesson())
    expect(result.status).toBe('READY')
    expect(result.notes.some((note) => note.includes('reads as a computation'))).toBe(false)
  })

  it('rejects unstated adult judgment as the authority for FinLit judgment work', () => {
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: {
          kind: 'SCORING_JUDGMENT',
          content: {
            present: true,
            text: 'The supervising parent decides whether the response shows enough understanding of the invented scam message to count as complete for this lesson.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CONTRADICTORY_RESPONSE_SCORING')
  })
})

describe('gate-review regressions', () => {
  it('does not let a math lesson opt out of the answer key by attaching a contract', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        structuredDiscipline: 'MATH',
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: [{ ref: 'q1', responseMode: 'OPEN', promptText: 'Which number is greater and why?' }],
        },
        scoringAuthority: {
          kind: 'RUBRIC',
          content: {
            present: true,
            text: 'Place-value reasoning — Not yet: digits compared out of order. Approaching: the first differing place is found but not named. Meets: the first differing place value is named and used to justify the comparison.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('does not let an undeclared structured lesson opt in to the relaxed path', () => {
    const base = readyJudgmentFinLitLesson()
    const { structuredDiscipline: _dropped, ...withoutDiscipline } = base
    const result = evaluateLessonProductionReadiness(withoutDiscipline)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('scans the judgment rubric for credential requests like every other authored text', () => {
    const base = authorityOf(readyMixedFinLitLesson())
    const result = evaluateLessonProductionReadiness(
      readyMixedFinLitLesson({
        scoringAuthority: {
          ...base,
          rubric: {
            present: true,
            text: 'Meets: the learner can enter your real password into the payroll site so the parent can confirm the deduction figures line up with the payslip.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CREDENTIAL_REQUEST')
  })

  it('reports each gap once even when a lesson trips it twice', () => {
    const base = readyJudgmentFinLitLesson()
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        responseScoring: {
          mode: 'JUDGMENT_APPLICATION',
          items: [
            { ref: 'q1', responseMode: 'FIXED', promptText: 'What is the total cost?' },
            { ref: 'q2', responseMode: 'FIXED', promptText: 'How much money remains?' },
          ],
        },
        scoringAuthority: {
          kind: 'ANSWER_KEY',
          content: { present: true, text: 'Item 1: $12.00. Item 2: $3.00.' },
        },
      }),
    )
    expect(result.codes).toEqual([...new Set(result.codes)])
    expect(result.codes.filter((code) => code === 'CONTRADICTORY_RESPONSE_SCORING')).toHaveLength(1)
  })

  it('reports MISSING_RUBRIC once when both the rubric and its criteria are absent', () => {
    const base = authorityOf(readyJudgmentFinLitLesson())
    const result = evaluateLessonProductionReadiness(
      readyJudgmentFinLitLesson({
        scoringAuthority: {
          ...base,
          content: { present: false },
          acceptableAnswerCriteria: { present: false },
        },
      }),
    )
    expect(result.codes.filter((code) => code === 'MISSING_RUBRIC')).toHaveLength(1)
  })
})
