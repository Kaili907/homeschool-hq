import { describe, expect, it } from 'vitest'
import { parseStudyTutorLearnerText } from './learnerText'
import { STUDY_TUTOR_REF_MAX_LENGTH, isStudyTutorRef, parseStudyTutorRef } from './refs'
import type { StudyTutorLaunch, StudyTutorTurn } from './runtime'

/**
 * STUDY-A1-TUTOR-CONTRACT-H3 — one compile-time pin per Tutor reference field.
 *
 * H2 made the bound structural: every Tutor-facing reference is declared
 * `StudyTutorRef`, producible only by `parseStudyTutorRef`. That is correct
 * today. What was missing is the guard that keeps it correct.
 *
 * The H2 suite carried exactly ONE load-bearing `@ts-expect-error`, for
 * `StudyTutorLaunch.sessionRef`. The other six declarations were exercised only
 * through runtime tests that reach their fields with `as unknown as
 * StudyTutorTurn` — which proves what the parser does and erases the very type
 * being tested. Measured, not assumed: reverting any one of
 *
 *   StudyTutorLaunch.lessonRef   StudyTutorTurn.sessionRef
 *   StudyTutorTurn.requestRef    StudyTutorTurn.lessonRef
 *   StudyTutorTurn.segmentRef    StudyTutorTurn.skillRef
 *
 * to plain `string` passed `tsc --noEmit` AND all 58 contract tests.
 *
 * So the defect this file closes is not "production accepts an invalid
 * reference" — production does not. It is that a production reference field can
 * silently lose its branded type with every gate still green. `requestRef` is
 * the one that costs the most: it reaches the bridge's pre-core gateway as
 * `eventId`, where an over-long value is refused as `stop-invalid-input` before
 * the classifier runs, and the host writes that down as a durable learner safety
 * stop about a child who did nothing (STUDY-A1-SESSIONREF-C).
 *
 * Each pin below is INDEPENDENT: it names one field on one interface and writes
 * a raw string directly at that field. No `as unknown as`, no `as any`, no
 * `as StudyTutorRef`, no `parseStudyTutorRef`, and no helper standing between
 * the string and the field. Six correct siblings cannot hide the seventh,
 * because reverting one field leaves exactly one `@ts-expect-error` unused and
 * `tsc --noEmit` fails on TS2578.
 */

/**
 * Well-formed on purpose, and the test below proves it: `parseStudyTutorRef`
 * accepts this exact string. So every refusal in this file is about PROVENANCE
 * and nothing else — the compiler is turning away a string that was never put
 * through the validator, not one that looks wrong. A pin written with a
 * malformed string would read as a statement about syntax and would still
 * compile the day the brand was dropped.
 */
const UNVALIDATED = 'study-session:9f2c1'

/**
 * STUDY-A1-TUTOR-CONTRACT-H4 — the composition repair.
 *
 * These pins were written against the sibling H3 line, where
 * `transientLearnerText` was still a bare `string` and `'ready'` could be
 * written at it directly. Converged with the production H3 line the field is
 * `StudyTutorLearnerText`, so the literal stops compiling at all six turn
 * fixtures below.
 *
 * Repaired by validating once rather than by adding a second `@ts-expect-error`
 * on the learner-text lines.
 *
 * STUDY-A1-PROD-TUTOR-WRAPPER-C CORRECTION. The H4 comment here justified that
 * choice with a masking mechanism that does not exist. It said a directive on
 * the learner-text line would have been "satisfied by the learner-text error
 * alone", leaving TypeScript silent when the ref field beside it lost its
 * brand. That is not how the directive behaves, and the independent H4 review
 * was right to flag it.
 *
 * Measured against this compiler rather than reasoned about: `@ts-expect-error`
 * applies to the immediately following line, and TS2578 ("Unused
 * '@ts-expect-error' directive") is reported PER DIRECTIVE. Two directives on
 * two adjacent field lines are independent — with the first field correct and
 * the second still in error, tsc reports TS2578 against the first and says
 * nothing about the second. So a directive on a learner-text line could not
 * have consumed the ref-field pin's signal, and each pin would have kept
 * working.
 *
 * The repair below is therefore kept on its own merits and NOT because the
 * alternative was unsafe: one validated constant leaves each `@ts-expect-error`
 * with exactly one error to answer for — its own field — and it does so without
 * scattering seven extra suppressions through the fixtures, each of which would
 * be a place a future reader has to re-derive what is being suppressed and why.
 */
const LEARNER_TEXT = parseStudyTutorLearnerText('ready')!

const SESSION = parseStudyTutorRef('study-session:9f2c1')!
const REQUEST = parseStudyTutorRef('study-turn:0d7f3a1e-4b62-4c19-9f88-2a1c5e6d7b03')!
const LESSON = parseStudyTutorRef('lesson:fractions-equivalence')!
const SEGMENT = parseStudyTutorRef('segment:warm-up')!
const SKILL = parseStudyTutorRef('skill:equivalent-fractions')!

describe('every Tutor reference field is pinned to the validated type (H3)', () => {
  it('refuses an unvalidated string that the validator itself would accept', () => {
    // The premise the seven pins rest on. If this string were inadmissible the
    // pins would prove only that the contract dislikes bad syntax, which the
    // runtime tests already establish and which no brand is needed for.
    expect(isStudyTutorRef(UNVALIDATED)).toBe(true)
    expect(parseStudyTutorRef(UNVALIDATED)).toBe(UNVALIDATED)
    expect(UNVALIDATED.length).toBeLessThanOrEqual(STUDY_TUTOR_REF_MAX_LENGTH)
  })

  it('pins StudyTutorLaunch.sessionRef', () => {
    const pinned: StudyTutorLaunch = {
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      sessionRef: UNVALIDATED,
      lessonRef: LESSON,
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    }
    expect(pinned.sessionRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorLaunch.lessonRef', () => {
    const pinned: StudyTutorLaunch = {
      sessionRef: SESSION,
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      lessonRef: UNVALIDATED,
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    }
    expect(pinned.lessonRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorTurn.sessionRef', () => {
    const pinned: StudyTutorTurn = {
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      sessionRef: UNVALIDATED,
      requestRef: REQUEST,
      lessonRef: LESSON,
      segmentRef: SEGMENT,
      subject: 'math',
      skillRef: SKILL,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(pinned.sessionRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorTurn.requestRef', () => {
    // The severe one. Unbranded, a host may hand the durable Study reference
    // straight to the bridge as `eventId`, and the refusal comes back shaped as
    // a safety stop the host records against the learner.
    const pinned: StudyTutorTurn = {
      sessionRef: SESSION,
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      requestRef: UNVALIDATED,
      lessonRef: LESSON,
      segmentRef: SEGMENT,
      subject: 'math',
      skillRef: SKILL,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(pinned.requestRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorTurn.lessonRef', () => {
    const pinned: StudyTutorTurn = {
      sessionRef: SESSION,
      requestRef: REQUEST,
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      lessonRef: UNVALIDATED,
      segmentRef: SEGMENT,
      subject: 'math',
      skillRef: SKILL,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(pinned.lessonRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorTurn.segmentRef', () => {
    const pinned: StudyTutorTurn = {
      sessionRef: SESSION,
      requestRef: REQUEST,
      lessonRef: LESSON,
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      segmentRef: UNVALIDATED,
      subject: 'math',
      skillRef: SKILL,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(pinned.segmentRef).toBe(UNVALIDATED)
  })

  it('pins StudyTutorTurn.skillRef', () => {
    const pinned: StudyTutorTurn = {
      sessionRef: SESSION,
      requestRef: REQUEST,
      lessonRef: LESSON,
      segmentRef: SEGMENT,
      subject: 'math',
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      skillRef: UNVALIDATED,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(pinned.skillRef).toBe(UNVALIDATED)
  })
})

/**
 * The other half of the statement. A negative pin alone is satisfied by a type
 * nothing can satisfy; these show the brand is a gate and not a wall, so the
 * pins above cannot be "passed" by weakening `parseStudyTutorRef` until its
 * output stops being usable.
 *
 * Positive and negative differ in exactly one thing — whether the string went
 * through the validator. Same strings, opposite verdicts.
 */
describe('a validated reference remains assignable to every pinned field (H3)', () => {
  it('accepts validated references throughout StudyTutorLaunch', () => {
    const launch: StudyTutorLaunch = {
      sessionRef: SESSION,
      lessonRef: LESSON,
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    }
    expect(launch.sessionRef).toBe('study-session:9f2c1')
    expect(launch.lessonRef).toBe('lesson:fractions-equivalence')
    // Same text as the refused pin, and admitted here: the difference is the
    // validator, not the characters.
    expect(launch.sessionRef).toBe(UNVALIDATED)
  })

  it('accepts validated references throughout StudyTutorTurn', () => {
    const turn: StudyTutorTurn = {
      sessionRef: SESSION,
      requestRef: REQUEST,
      lessonRef: LESSON,
      segmentRef: SEGMENT,
      subject: 'math',
      skillRef: SKILL,
      taskType: 'guided-practice',
      transientLearnerText: LEARNER_TEXT,
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    for (const value of [turn.sessionRef, turn.requestRef, turn.lessonRef, turn.segmentRef, turn.skillRef]) {
      // Still primitive strings at runtime: the brand costs no unwrapping, so
      // nothing downstream has an excuse to strip it.
      expect(typeof value).toBe('string')
      expect(isStudyTutorRef(value)).toBe(true)
    }
    expect(turn.requestRef).toBe('study-turn:0d7f3a1e-4b62-4c19-9f88-2a1c5e6d7b03')
  })
})
