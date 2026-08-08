import { describe, expect, it } from 'vitest'
import { STUDY_TUTOR_REASON_CODE_MAX_LENGTH, isStudyTutorReasonCode, parseStudyTutorResult } from './results'

// STUDY-A1-TUTOR-CONTRACT — unknown implementation output is rejected here or
// nowhere. A production wrapper is out-of-process work the host does not own,
// so every one of these is a shape the host must refuse rather than persist.

const LEARNER_SENTENCE = 'I am scared to tell my mum about the test'

describe('accepted results', () => {
  it('admits an opaque event reference and transient prose', () => {
    const parsed = parseStudyTutorResult({
      status: 'accepted',
      eventRef: 'study-event:9f2c-1',
      visibleText: 'Let us try that step with a different example.',
    })
    expect(parsed).toEqual({
      status: 'accepted',
      eventRef: 'study-event:9f2c-1',
      visibleText: 'Let us try that step with a different example.',
    })
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it('refuses a learner sentence in the one field the host persists', () => {
    // `eventRef` is written to durable Study state as `lastAcceptedEventRef`.
    // Free text there would put a child's words into Study evidence.
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: LEARNER_SENTENCE, visibleText: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: '', visibleText: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: `e${'x'.repeat(128)}`, visibleText: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 7, visibleText: 'ok' })).toBeNull()
  })

  it('refuses an empty or non-string presentation', () => {
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: '   ' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: null })).toBeNull()
  })

  it('refuses a missing or an extra field', () => {
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', visibleText: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({
      status: 'accepted',
      eventRef: 'event.1',
      visibleText: 'ok',
      transcript: ['turn one', 'turn two'],
    })).toBeNull()
  })
})

describe('stopped results', () => {
  it('admits both adult-help delivery states', () => {
    for (const deliveryStatus of ['proposed-not-delivered', 'not-confirmed'] as const) {
      expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'mounted-input-safety-urgent', deliveryStatus }))
        .toEqual({ status: 'stopped', reasonCode: 'mounted-input-safety-urgent', deliveryStatus })
    }
  })

  it('refuses prose in the code the host writes to the durable safety event', () => {
    expect(parseStudyTutorResult({ status: 'stopped', reasonCode: LEARNER_SENTENCE, deliveryStatus: 'not-confirmed' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'Mounted Input Safety', deliveryStatus: 'not-confirmed' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'a'.repeat(STUDY_TUTOR_REASON_CODE_MAX_LENGTH + 1), deliveryStatus: 'not-confirmed' })).toBeNull()
  })

  it('refuses an unknown delivery state', () => {
    expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'x-stop', deliveryStatus: 'delivered' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'x-stop', deliveryStatus: 'not-needed' })).toBeNull()
  })

  it('carries no learner-facing message a Tutor could author', () => {
    expect(parseStudyTutorResult({
      status: 'stopped',
      reasonCode: 'x-stop',
      deliveryStatus: 'not-confirmed',
      studentMessage: 'You are in trouble.',
    })).toBeNull()
  })
})

describe('interrupted results', () => {
  it('admits the host closed interruption set and nothing beside it', () => {
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'rate-limit' } }))
      .toEqual({ status: 'interrupted', interruption: { kind: 'rate-limit' } })
    for (const reason of ['adult-authentication-rejected', 'study-session-rejected'] as const) {
      expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'session-authorization', reason } }))
        .toEqual({ status: 'interrupted', interruption: { kind: 'session-authorization', reason } })
    }
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'network' } })).toBeNull()
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'rate-limit', retryAfter: 30 } })).toBeNull()
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'session-authorization' } })).toBeNull()
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'session-authorization', reason: 'nope' } })).toBeNull()
  })

  it('does not coerce a reason, so an object cannot print an approved one', () => {
    const impostor = {
      kind: 'session-authorization',
      reason: { toString: () => 'study-session-rejected', bearer: 'adult-bearer-token' },
    }
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: impostor })).toBeNull()
  })

  it('freezes the rebuilt interruption', () => {
    const parsed = parseStudyTutorResult({ status: 'interrupted', interruption: { kind: 'rate-limit' } })
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen((parsed as { interruption: object }).interruption)).toBe(true)
  })
})

describe('quarantined results', () => {
  it('admits a bounded operator code only', () => {
    expect(parseStudyTutorResult({ status: 'quarantined', reasonCode: 'identity-binding-mismatch' }))
      .toEqual({ status: 'quarantined', reasonCode: 'identity-binding-mismatch' })
    expect(parseStudyTutorResult({ status: 'quarantined', reasonCode: LEARNER_SENTENCE })).toBeNull()
    expect(parseStudyTutorResult({ status: 'quarantined' })).toBeNull()
  })
})

describe('reason code syntax', () => {
  it('admits every code shape the mounted host already emits', () => {
    for (const code of [
      'mounted-input-safety-urgent',
      'mounted-input-safety-uncertain',
      'mounted-input-safety-invalid',
      'mounted-tutor-output-safety-urgent',
      'bridge-stop-invalid-input',
      'bridge-stop-for-uncertain-adult-review',
      'bridge-duplicate-ignored',
      'identity-binding-mismatch',
      'stale-host-binding',
      'unknown-segment',
      'runtime-boundary-error',
      'accepted-projection-identity-mismatch',
    ]) expect(isStudyTutorReasonCode(code)).toBe(true)
  })

  it('rejects anything a sentence could hide in', () => {
    for (const code of ['', ' ', 'has space', 'Has-Capital', 'trailing-', '-leading', 'double--dash', 'punctuation!', 'quote"d', 'new\nline']) {
      expect(isStudyTutorReasonCode(code)).toBe(false)
    }
    expect(isStudyTutorReasonCode(7)).toBe(false)
    expect(isStudyTutorReasonCode({ toString: () => 'x-stop' })).toBe(false)
  })
})

describe('validator integrity', () => {
  it('rejects anything that is not a result-shaped object', () => {
    for (const value of [null, undefined, 7, 'accepted', [], [{ status: 'accepted' }], () => undefined, {}]) {
      expect(parseStudyTutorResult(value)).toBeNull()
    }
  })

  it('rebuilds rather than returning the caller object', () => {
    const source = { status: 'accepted', eventRef: 'event.1', visibleText: 'ok' }
    const parsed = parseStudyTutorResult(source)
    expect(parsed).not.toBe(source)
    // A later mutation of the implementation's object cannot reach the host's.
    source.visibleText = 'replaced after validation'
    expect(parsed).toEqual({ status: 'accepted', eventRef: 'event.1', visibleText: 'ok' })
  })

  it('is total against a throwing accessor rather than throwing through the host', () => {
    const hostile = {
      status: 'accepted',
      eventRef: 'event.1',
      get visibleText(): string { throw new Error('accessor') },
    }
    expect(() => parseStudyTutorResult(hostile)).not.toThrow()
    expect(parseStudyTutorResult(hostile)).toBeNull()
  })

  it('reads a field once, so a second answer cannot differ from the checked one', () => {
    let reads = 0
    const shifting = {
      status: 'stopped',
      deliveryStatus: 'not-confirmed',
      get reasonCode(): string {
        reads += 1
        return reads === 1 ? 'x-stop' : LEARNER_SENTENCE
      },
    }
    expect(parseStudyTutorResult(shifting)).toEqual({
      status: 'stopped',
      reasonCode: 'x-stop',
      deliveryStatus: 'not-confirmed',
    })
    expect(reads).toBe(1)
  })
})
