import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as resultsModule from './results'
import {
  STUDY_TUTOR_REASON_CODE_MAX_LENGTH,
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  acceptStudyTutorResult,
  isStudyTutorReasonCode,
  parseStudyTutorResult,
} from './results'

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

  // STUDY-A1-TUTOR-CONTRACT-H2 Phase 4 — review finding F3: accepted
  // `visibleText` was bounded below (non-empty) and not above, so a Tutor could
  // hand the host a megabyte of prose and the host would hold all of it in
  // surface state and render it to a ten-year-old.
  it('refuses a presentation larger than one learner-facing turn', () => {
    const megabytes = 'a'.repeat(2_000_000)
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: megabytes })).toBeNull()
    expect(parseStudyTutorResult({
      status: 'accepted',
      eventRef: 'event.1',
      visibleText: 'a'.repeat(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH + 1),
    })).toBeNull()
  })

  it('admits a presentation at the bound, and does not truncate it', () => {
    const atBound = 'a'.repeat(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
    const parsed = parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: atBound })
    expect(parsed).toEqual({ status: 'accepted', eventRef: 'event.1', visibleText: atBound })
    // Oversized output is rejected, never shortened: a truncated turn is a
    // Tutor's sentence cut in half in front of a learner, and it would also let
    // an over-long payload through as a shorter one the host then trusts.
    expect((parsed as { visibleText: string }).visibleText).toHaveLength(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
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

  // STUDY-A1-TUTOR-CONTRACT-H2 Phase 8 — `Object.keys` sees neither of these,
  // so an exact-key check built on it would have waved both through. The
  // rebuild meant they could never have travelled; the shape is still one this
  // contract does not admit, and it is rejected rather than silently dropped.
  it('rejects an extra property hidden from Object.keys', () => {
    const smuggled = { status: 'accepted', eventRef: 'event.1', visibleText: 'ok' }
    Object.defineProperty(smuggled, 'transcript', {
      value: ['turn one', 'turn two'],
      enumerable: false,
      writable: false,
      configurable: false,
    })
    expect(Object.keys(smuggled)).toEqual(['status', 'eventRef', 'visibleText'])
    expect(parseStudyTutorResult(smuggled)).toBeNull()

    const bearer = { status: 'quarantined', reasonCode: 'x-quarantine' }
    Object.defineProperty(bearer, 'authorization', { value: 'adult-bearer-token', enumerable: false })
    expect(parseStudyTutorResult(bearer)).toBeNull()
  })

  it('rejects a symbol-keyed extra property', () => {
    const smuggled = {
      status: 'stopped',
      reasonCode: 'x-stop',
      deliveryStatus: 'not-confirmed',
      [Symbol.for('studentId')]: 'learner:real-child',
    }
    expect(Object.keys(smuggled)).toEqual(['status', 'reasonCode', 'deliveryStatus'])
    expect(parseStudyTutorResult(smuggled)).toBeNull()
  })

  it('rejects a hidden extra property on a nested interruption', () => {
    const interruption = { kind: 'rate-limit' }
    Object.defineProperty(interruption, 'bearer', { value: 'adult-bearer-token', enumerable: false })
    expect(parseStudyTutorResult({ status: 'interrupted', interruption })).toBeNull()
  })

  it('admits a prototype-inherited approved shape only when its own keys are exact', () => {
    // Inherited properties are not own properties: a result that keeps its
    // fields on a prototype has none of the keys it appears to have.
    const parent = { status: 'accepted', eventRef: 'event.1', visibleText: 'ok' }
    expect(parseStudyTutorResult(Object.create(parent))).toBeNull()
    // And an approved own shape whose prototype carries a forbidden field still
    // rebuilds without it.
    const child = Object.create({ officialGrade: 'C' }) as Record<string, unknown>
    child.status = 'accepted'
    child.eventRef = 'event.1'
    child.visibleText = 'ok'
    const parsed = parseStudyTutorResult(child)
    expect(parsed).toEqual({ status: 'accepted', eventRef: 'event.1', visibleText: 'ok' })
    expect(Object.hasOwn(parsed!, 'officialGrade')).toBe(false)
    expect((parsed as unknown as { officialGrade?: string }).officialGrade).toBeUndefined()
  })

  // STUDY-A1-TUTOR-CONTRACT-H3 Phase 8 — the brand is only worth as much as the
  // module's export surface. One exported cast, and a wrapper has its bypass
  // back with the contract still reading as honoured.
  it('exports no way to mint a validated result except by parsing', () => {
    const exported = Object.keys(resultsModule).sort()
    expect(exported).toEqual([
      'STUDY_TUTOR_REASON_CODE_MAX_LENGTH',
      'STUDY_TUTOR_RESULT_KEYS',
      'STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE',
      'STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH',
      'acceptStudyTutorResult',
      'isStudyTutorReasonCode',
      'parseStudyTutorResult',
    ])
    // The two that produce one both validate first, and neither can be handed a
    // value it will pass through unchecked.
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1' })).toBeNull()
    expect(acceptStudyTutorResult({ status: 'accepted', eventRef: 'event.1' }).status).toBe('quarantined')

    // And the branding helper is module-private, so nothing outside this file
    // can apply the brand to a value the parser never saw.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'results.ts'), 'utf8')
    expect(source).toMatch(/\nfunction validated\(/)
    expect(source).not.toMatch(/export\s+(?:const|function)\s+validated\b/)
    expect(source).not.toMatch(/as\s+unknown\s+as/)
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
