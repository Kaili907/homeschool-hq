import { describe, expect, it } from 'vitest'
import { STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH, isStudyBridgeOpaqueId } from '../../studyRequestRef'
import { STUDY_TUTOR_REF_MAX_LENGTH, isStudyTutorRef, parseStudyTutorRef } from './refs'
import type { StudyTutorLaunch, StudyTutorTurn } from './runtime'

/**
 * STUDY-A1-TUTOR-CONTRACT-H2 Phase 2/3 — the input side of the boundary.
 *
 * Review finding F2: the Tutor-facing references were documented as bounded
 * opaque identifiers and declared as plain `string`. The bound was a sentence in
 * a comment, so nothing stopped a host — or a future wrapper — from putting a
 * learner's words, or an over-long durable reference, into a field the bridge
 * validates before its classifier runs.
 *
 * That is not a theoretical cost. An identifier the bridge refuses arrives as
 * `stop-invalid-input`, which the host records as a durable learner safety stop:
 * a girl who typed "ready" is locked across refreshes and her dad is shown a
 * safety incident that never happened. This file attacks the contract, not any
 * Tutor implementation.
 */

/** Every string below is refused by the bridge rule the contract claims to hold. */
const STRUCTURALLY_INVALID: ReadonlyArray<readonly [string, string]> = [
  ['empty', ''],
  ['one character over the opaque bound', `e${'x'.repeat(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH)}`],
  ['leading punctuation', '-study-session:1'],
  ['leading dot', '.study-session:1'],
  ['interior space', 'study session:1'],
  ['leading space', ' study-session:1'],
  ['trailing space', 'study-session:1 '],
  ['newline', 'study-session:1\nbearer=adult-token'],
  ['tab', 'study-session:1\tstudent'],
  // A Cyrillic small es reads as an ASCII "c" and is not one. An identifier that
  // looks approved to a reviewer must still be refused by the rule.
  ['Unicode confusable', 'study-session:сontract-1'],
  ['zero-width joiner', 'study-session:1‍'],
  ['a learner sentence', 'I am scared to tell my mum about the test'],
]

/**
 * STUDY-A1-SESSIONREF-C, reproduced. The calendar adapter builds
 *   block:<learnerRef ≤32>:<YYYY-MM-DD>:<lessonRef ≤80>
 * and the Study session container appends `:session`, so an Academy-length
 * lesson reference yields the 133-character durable reference that first drove
 * this defect: 6 + 27 + 1 + 10 + 1 + 80 + 8.
 */
const A1_DURABLE_SESSION_REF =
  `block:${'learner-3f2a9c81b6d4e70'.padEnd(27, 'x')}:2026-08-01:${'lesson-x'.repeat(10)}:session`

describe('Tutor input reference bound (F2)', () => {
  it('reproduces the A1 durable session reference at its recorded length', () => {
    expect(A1_DURABLE_SESSION_REF).toHaveLength(133)
    expect(A1_DURABLE_SESSION_REF.length).toBeGreaterThan(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH)
  })

  it('refuses every reference the bridge rule refuses', () => {
    for (const [label, candidate] of [...STRUCTURALLY_INVALID, ['A1 durable reference', A1_DURABLE_SESSION_REF] as const]) {
      expect(parseStudyTutorRef(candidate), label).toBeNull()
      expect(isStudyTutorRef(candidate), label).toBe(false)
    }
  })

  it('admits exactly what the approved Study bridge rule admits', () => {
    for (const candidate of [
      'study-session:9f2c1',
      'study-turn:0d7f3a1e-4b62-4c19-9f88-2a1c5e6d7b03',
      'study-session:2f1a9c8e7d6b5a40:133',
      'lesson:romeo-virtual-academy/math/grade-5/fractions-equivalence.unit-3',
      'a',
      'A'.repeat(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH),
    ]) {
      expect(isStudyBridgeOpaqueId(candidate)).toBe(true)
      expect(parseStudyTutorRef(candidate)).toBe(candidate)
      expect(isStudyTutorRef(candidate)).toBe(true)
    }
  })

  it('is a primitive string only, and coerces nothing', () => {
    // An object whose `toString` prints an approved reference is not one. It is
    // the object that would travel, along with everything it closed over.
    for (const candidate of [
      null,
      undefined,
      7,
      { toString: () => 'study-session:1' },
      ['study-session:1'],
      new String('study-session:1'),
      Symbol('study-session:1'),
      { valueOf: () => 'study-session:1' },
    ]) {
      expect(parseStudyTutorRef(candidate)).toBeNull()
      expect(isStudyTutorRef(candidate)).toBe(false)
    }
  })

  it('does not drift from the approved Study bridge bound', () => {
    expect(STUDY_TUTOR_REF_MAX_LENGTH).toBe(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH)
    // The contract reuses `isStudyBridgeOpaqueId` rather than restating its
    // regex, so the two cannot disagree. This holds that reuse in place: a
    // silently duplicated rule would show up here the moment the bridge's did.
    for (const candidate of [...STRUCTURALLY_INVALID.map(([, value]) => value), A1_DURABLE_SESSION_REF]) {
      expect(isStudyBridgeOpaqueId(candidate)).toBe(false)
    }
  })
})

describe('Tutor input reference type (F2)', () => {
  it('refuses a plain string where the contract requires a validated reference', () => {
    const sessionRef = parseStudyTutorRef('study-session:9f2c1')
    const lessonRef = parseStudyTutorRef('lesson:fractions-equivalence')
    expect(sessionRef).not.toBeNull()
    expect(lessonRef).not.toBeNull()

    const launch: StudyTutorLaunch = {
      sessionRef: sessionRef!,
      lessonRef: lessonRef!,
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    }
    expect(launch.sessionRef).toBe('study-session:9f2c1')

    // The bound is structural now, not documentary: TypeScript refuses an
    // unvalidated string in any of the reference fields. `@ts-expect-error`
    // fails the root typecheck if the assignment ever becomes legal again,
    // which is what keeps F2 closed rather than merely described.
    const smuggled: StudyTutorLaunch = {
      // @ts-expect-error a plain string is not a validated Tutor reference
      sessionRef: A1_DURABLE_SESSION_REF,
      lessonRef: lessonRef!,
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    }
    // The type refuses it; nothing at runtime pretends it was validated.
    expect(parseStudyTutorRef(smuggled.sessionRef)).toBeNull()
  })

  it('requires a validated reference in every Tutor-facing reference field', () => {
    const ref = parseStudyTutorRef('study-session:9f2c1')!
    const turn: StudyTutorTurn = {
      sessionRef: ref,
      requestRef: parseStudyTutorRef('study-turn:0d7f3a1e-4b62-4c19-9f88-2a1c5e6d7b03')!,
      lessonRef: parseStudyTutorRef('lesson:fractions-equivalence')!,
      segmentRef: parseStudyTutorRef('segment:warm-up')!,
      subject: 'math',
      skillRef: parseStudyTutorRef('skill:equivalent-fractions')!,
      taskType: 'guided-practice',
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    }
    expect(turn.requestRef).toBe('study-turn:0d7f3a1e-4b62-4c19-9f88-2a1c5e6d7b03')

    for (const field of ['sessionRef', 'requestRef', 'lessonRef', 'segmentRef', 'skillRef'] as const) {
      const smuggled = { ...turn, [field]: 'has space' } as unknown as StudyTutorTurn
      expect(parseStudyTutorRef(smuggled[field])).toBeNull()
    }
  })
})
