/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — the transport-facing half.
 *
 * ./eligibility.ts is what a future pre-launch server eligibility check is
 * asked and what the host will admit as an answer. Nothing here evaluates
 * anything: that is ../../production/tutorContentEligibility.test.ts, which can
 * see the frozen content. This file is about the two crossings, and the rule
 * both hold to is REFUSE, NEVER TRIM.
 */
import { describe, expect, it } from 'vitest'
import {
  STUDY_TUTOR_CONTENT_GRADE_BANDS,
  STUDY_TUTOR_ELIGIBILITY_CONTRACT_VERSION,
  STUDY_TUTOR_ELIGIBILITY_KEYS,
  STUDY_TUTOR_ELIGIBILITY_MAX_SKILL_REFS,
  STUDY_TUTOR_ELIGIBILITY_SUBJECTS,
  STUDY_TUTOR_ELIGIBILITY_TASK_TYPES,
  STUDY_TUTOR_INELIGIBLE_REASONS,
  acceptStudyTutorEligibility,
  parseStudyTutorEligibility,
  parseStudyTutorEligibilityRequest,
} from './eligibility'
import { STUDY_TUTOR_REF_MAX_LENGTH } from './refs'
import { isStudyTutorReasonCode } from './results'
import { STUDY_TUTOR_FORBIDDEN_KEYS } from './runtime'

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject: 'math',
    lessonRef: 'lesson:fractions-week-3',
    skillRefs: ['skill:equivalent-fractions'],
    taskTypes: ['guided-practice'],
    ...overrides,
  }
}

describe('the eligibility request a host or a server may present', () => {
  it('admits a well-formed request and rebuilds it frozen', () => {
    const parsed = parseStudyTutorEligibilityRequest(request())
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual({
      subject: 'math',
      lessonRef: 'lesson:fractions-week-3',
      skillRefs: ['skill:equivalent-fractions'],
      taskTypes: ['guided-practice'],
    })
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed!.skillRefs)).toBe(true)
    expect(Object.isFrozen(parsed!.taskTypes)).toBe(true)
  })

  it('carries no learner grade, no working level and no learner identity', () => {
    // The card's central constraint, enforced structurally rather than by
    // review: the key set is EXACT, so there is nowhere for any of these to go.
    // Asserted against the contract's own forbidden list so a key added there
    // is automatically checked here.
    const parsed = parseStudyTutorEligibilityRequest(request())!
    for (const forbidden of STUDY_TUTOR_FORBIDDEN_KEYS) {
      expect(Object.hasOwn(parsed, forbidden)).toBe(false)
    }
    for (const forbidden of ['grade', 'gradeLevel', 'gradeBand', 'workingLevel', 'officialGrade', 'learnerRef']) {
      expect(parseStudyTutorEligibilityRequest(request({ [forbidden]: 5 }))).toBeNull()
      expect(STUDY_TUTOR_ELIGIBILITY_KEYS.request).not.toContain(forbidden)
    }
  })

  it('refuses an over-long reference rather than trimming it to fit', () => {
    /**
     * THE RULE, and the reason it is a rule. A `lesson:` reference cut at 128
     * characters is a DIFFERENT lesson reference — and one that might well
     * match a reviewed program, which is this card's whole defect arriving
     * through the parser instead of through the registry. The assertions below
     * are what a truncating mutant fails: it would return a request whose
     * `lessonRef` is the 128-character prefix.
     */
    const overLong = `lesson:${'a'.repeat(STUDY_TUTOR_REF_MAX_LENGTH)}`
    expect(overLong.length).toBeGreaterThan(STUDY_TUTOR_REF_MAX_LENGTH)
    expect(parseStudyTutorEligibilityRequest(request({ lessonRef: overLong }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ skillRefs: [overLong] }))).toBeNull()

    // Exactly at the bound is admitted, unchanged and character for character —
    // so the refusal above is a bound and not a blanket rejection, and a
    // trimming mutant cannot hide behind "it only ever shortens".
    const atBound = `lesson:${'a'.repeat(STUDY_TUTOR_REF_MAX_LENGTH - 'lesson:'.length)}`
    expect(atBound).toHaveLength(STUDY_TUTOR_REF_MAX_LENGTH)
    expect(parseStudyTutorEligibilityRequest(request({ lessonRef: atBound }))?.lessonRef).toBe(atBound)
  })

  it('refuses a malformed reference rather than repairing it', () => {
    for (const malformed of [
      '',
      ' lesson:leading-space',
      'lesson:trailing-space ',
      '-lesson:leading-hyphen',
      'lesson:with space',
      'lesson:with\nnewline',
      'lesson:with"quote',
    ]) {
      expect(parseStudyTutorEligibilityRequest(request({ lessonRef: malformed }))).toBeNull()
      expect(parseStudyTutorEligibilityRequest(request({ skillRefs: [malformed] }))).toBeNull()
    }
  })

  it('coerces nothing, and an object that prints an approved reference is refused', () => {
    // It is the OBJECT that would travel, and everything it closed over with
    // it. `String(...)` anywhere in the parser would let this through.
    const printsARef = { toString: () => 'lesson:fractions-week-3' }
    expect(parseStudyTutorEligibilityRequest(request({ lessonRef: printsARef }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ lessonRef: new String('lesson:x') }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ subject: { toString: () => 'math' } }))).toBeNull()
  })

  it('is total: a throwing accessor is a refusal, not an exception', () => {
    const hostile = request()
    Object.defineProperty(hostile, 'lessonRef', {
      get() { throw new Error('hostile accessor') },
      enumerable: true,
      configurable: true,
    })
    expect(() => parseStudyTutorEligibilityRequest(hostile)).not.toThrow()
    expect(parseStudyTutorEligibilityRequest(hostile)).toBeNull()
  })

  it('refuses a non-record, and every primitive', () => {
    for (const value of [null, undefined, 0, 1, '', 'lesson:x', true, false, [], [request()], Symbol('x')]) {
      expect(parseStudyTutorEligibilityRequest(value)).toBeNull()
    }
  })

  it('refuses a subject or task type outside the host vocabulary', () => {
    expect(parseStudyTutorEligibilityRequest(request({ subject: 'science' }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ subject: 'english' }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ taskTypes: ['teaching'] }))).toBeNull()
    // Every declared member is admitted, so the refusals above are a vocabulary
    // and not an accident of which one was tried.
    for (const subject of STUDY_TUTOR_ELIGIBILITY_SUBJECTS) {
      expect(parseStudyTutorEligibilityRequest(request({ subject }))?.subject).toBe(subject)
    }
    for (const taskType of STUDY_TUTOR_ELIGIBILITY_TASK_TYPES) {
      expect(parseStudyTutorEligibilityRequest(request({ taskTypes: [taskType] }))?.taskTypes)
        .toEqual([taskType])
    }
  })

  it('refuses an empty, duplicated or over-long list rather than repairing it', () => {
    expect(parseStudyTutorEligibilityRequest(request({ skillRefs: [] }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(request({ taskTypes: [] }))).toBeNull()
    // A duplicate is refused rather than de-duplicated: silently changing what
    // was asked is the same class of mistake as trimming a reference.
    expect(parseStudyTutorEligibilityRequest(request({ skillRefs: ['skill:a', 'skill:a'] }))).toBeNull()
    expect(parseStudyTutorEligibilityRequest(
      request({ taskTypes: ['guided-practice', 'guided-practice'] }),
    )).toBeNull()

    const atLimit = Array.from({ length: STUDY_TUTOR_ELIGIBILITY_MAX_SKILL_REFS }, (_, i) => `skill:${i}`)
    expect(parseStudyTutorEligibilityRequest(request({ skillRefs: atLimit }))?.skillRefs)
      .toHaveLength(STUDY_TUTOR_ELIGIBILITY_MAX_SKILL_REFS)
    expect(parseStudyTutorEligibilityRequest(request({ skillRefs: [...atLimit, 'skill:one-too-many'] })))
      .toBeNull()
    // Every task type at once is the natural bound, and it is admitted.
    expect(parseStudyTutorEligibilityRequest(
      request({ taskTypes: [...STUDY_TUTOR_ELIGIBILITY_TASK_TYPES] }),
    )?.taskTypes).toHaveLength(STUDY_TUTOR_ELIGIBILITY_TASK_TYPES.length)
  })

  it('refuses a missing or extra key rather than filling one in', () => {
    for (const key of STUDY_TUTOR_ELIGIBILITY_KEYS.request) {
      const missing = request()
      delete missing[key]
      expect(parseStudyTutorEligibilityRequest(missing)).toBeNull()
    }
    expect(parseStudyTutorEligibilityRequest(request({ extra: 'value' }))).toBeNull()
  })

  it('sees a non-enumerable own key that Object.keys would miss', () => {
    const smuggled = request()
    Object.defineProperty(smuggled, 'workingLevel', { value: 'grade-3', enumerable: false })
    expect(Object.keys(smuggled)).not.toContain('workingLevel')
    expect(parseStudyTutorEligibilityRequest(smuggled)).toBeNull()
  })
})

describe('the eligibility decision a host will admit', () => {
  it('admits an eligible decision and rebuilds it frozen', () => {
    const parsed = parseStudyTutorEligibility({
      eligible: true,
      programRef: 'math-seq-equivalent-fractions-v1',
      gradeBand: 'elementary-3-5',
    })
    expect(parsed).toEqual({
      eligible: true,
      programRef: 'math-seq-equivalent-fractions-v1',
      gradeBand: 'elementary-3-5',
    })
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it('admits every declared reason, and nothing else', () => {
    for (const reason of Object.values(STUDY_TUTOR_INELIGIBLE_REASONS)) {
      expect(parseStudyTutorEligibility({ eligible: false, reason })).toEqual({ eligible: false, reason })
    }
    expect(parseStudyTutorEligibility({ eligible: false, reason: 'because-i-said-so' })).toBeNull()
  })

  it('uses only reason codes the result contract itself admits', () => {
    // A wrapper hands these straight to `quarantined`. A code
    // `parseStudyTutorResult` rejects would be re-quarantined as a contract
    // parse failure, and the real reason would be lost.
    for (const reason of Object.values(STUDY_TUTOR_INELIGIBLE_REASONS)) {
      expect(isStudyTutorReasonCode(reason)).toBe(true)
    }
  })

  it('refuses an eligible decision whose program reference is not opaque', () => {
    for (const programRef of ['', ' leading-space', 'has space', `a${'b'.repeat(200)}`, 'has\nnewline']) {
      expect(parseStudyTutorEligibility({ eligible: true, programRef, gradeBand: 'elementary-3-5' }))
        .toBeNull()
    }
  })

  it('refuses an eligible decision whose grade band is not a declared one', () => {
    expect(parseStudyTutorEligibility({ eligible: true, programRef: 'p', gradeBand: 'grade-5' })).toBeNull()
    for (const gradeBand of STUDY_TUTOR_CONTENT_GRADE_BANDS) {
      expect(parseStudyTutorEligibility({ eligible: true, programRef: 'p', gradeBand })).not.toBeNull()
    }
  })

  it('refuses a decision that mixes the two branches', () => {
    // An eligible answer carrying a reason, or an ineligible one carrying a
    // program, is a shape this contract cannot vouch for. There is no program
    // on an ineligible answer BECAUSE there is no program — which is exactly
    // what the fallback got wrong by always having one to hand.
    expect(parseStudyTutorEligibility({
      eligible: true, programRef: 'p', gradeBand: 'elementary-3-5', reason: 'tutor-content-lesson-not-routable',
    })).toBeNull()
    expect(parseStudyTutorEligibility({
      eligible: false, reason: 'tutor-content-lesson-not-routable', programRef: 'p',
    })).toBeNull()
    expect(parseStudyTutorEligibility({ eligible: 'true', programRef: 'p', gradeBand: 'elementary-3-5' }))
      .toBeNull()
    expect(parseStudyTutorEligibility({ eligible: 1, programRef: 'p', gradeBand: 'elementary-3-5' }))
      .toBeNull()
  })

  it('is total: a throwing accessor is a refusal, not an exception', () => {
    const hostile: Record<string, unknown> = { eligible: true, programRef: 'p', gradeBand: 'elementary-3-5' }
    Object.defineProperty(hostile, 'programRef', {
      get() { throw new Error('hostile accessor') },
      enumerable: true,
      configurable: true,
    })
    expect(() => parseStudyTutorEligibility(hostile)).not.toThrow()
    expect(parseStudyTutorEligibility(hostile)).toBeNull()
  })

  it('fails closed to INELIGIBLE, never to a shrug', () => {
    /**
     * The asymmetry with `acceptStudyTutorResult`, and the reason for it. A
     * result that fails to parse costs a turn; an eligibility decision that
     * fails to parse decides whether a Study session starts at all. Every
     * unparseable answer below must come back ineligible — a truncated
     * response, an empty body, a transport error object, a hostile forgery.
     */
    for (const raw of [
      undefined,
      null,
      '',
      '{"eligible":tru',
      {},
      { error: 'gateway timeout' },
      { eligible: true },
      { eligible: true, programRef: 'p' },
      { eligible: true, programRef: 'p', gradeBand: 'middle-6-8', extra: 1 },
      [{ eligible: true, programRef: 'p', gradeBand: 'elementary-3-5' }],
    ]) {
      const decision = acceptStudyTutorEligibility(raw)
      expect(decision.eligible).toBe(false)
      expect(decision).toEqual({
        eligible: false,
        reason: STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision,
      })
    }
  })

  it('passes a parseable decision through unchanged, in both directions', () => {
    // The positive half. Without it, an `acceptStudyTutorEligibility` that
    // simply returned ineligible for everything would pass the test above while
    // making the whole contract useless.
    expect(acceptStudyTutorEligibility({
      eligible: true, programRef: 'math-seq-pv-regroup-v1', gradeBand: 'elementary-3-5',
    })).toEqual({ eligible: true, programRef: 'math-seq-pv-regroup-v1', gradeBand: 'elementary-3-5' })
    expect(acceptStudyTutorEligibility({
      eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject,
    })).toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject })
  })

  it('pins the contract version and the frozen vocabularies', () => {
    expect(STUDY_TUTOR_ELIGIBILITY_CONTRACT_VERSION).toBe('study-tutor-eligibility.v1')
    expect(Object.isFrozen(STUDY_TUTOR_INELIGIBLE_REASONS)).toBe(true)
    expect(Object.isFrozen(STUDY_TUTOR_ELIGIBILITY_SUBJECTS)).toBe(true)
    expect(Object.isFrozen(STUDY_TUTOR_ELIGIBILITY_TASK_TYPES)).toBe(true)
    expect(Object.isFrozen(STUDY_TUTOR_CONTENT_GRADE_BANDS)).toBe(true)
    // Distinct values: two reasons sharing a string would make one of them
    // undiagnosable in production.
    const reasons = Object.values(STUDY_TUTOR_INELIGIBLE_REASONS)
    expect(new Set(reasons).size).toBe(reasons.length)
  })
})
