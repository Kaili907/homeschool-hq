import { describe, expect, it } from 'vitest'
import {
  createStudyTurnRequestRef,
  isStudyBridgeOpaqueId,
  STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH,
} from './studyRequestRef'

// STUDY-A1-COMP Phase 9. The Tutor bridge admits an opaque identifier of at most
// 128 characters (validOpaqueId in
// adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts). A longer
// one is refused before the classifier ever runs, and the refusal is shaped as a
// safety stop — so a girl who wrote nothing wrong is told to go get her dad. The
// generator below is the only thing standing between a long block reference and
// that false stop, so its bound is asserted exactly rather than approximately.

/** The bridge's own predicate, copied verbatim so a drift in either is caught. */
const BRIDGE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

describe('Study turn request reference (bridge opaque-id contract)', () => {
  it('states the bridge bound as 128 characters', () => {
    expect(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH).toBe(128)
  })

  it('accepts exactly 127 and 128 characters and refuses 129', () => {
    const at127 = `a${'b'.repeat(126)}`
    const at128 = `a${'b'.repeat(127)}`
    const at129 = `a${'b'.repeat(128)}`
    expect(at127).toHaveLength(127)
    expect(at128).toHaveLength(128)
    expect(at129).toHaveLength(129)

    // The local predicate and the bridge's own agree on every boundary.
    for (const [value, admitted] of [[at127, true], [at128, true], [at129, false]] as const) {
      expect(isStudyBridgeOpaqueId(value)).toBe(admitted)
      expect(BRIDGE_OPAQUE_ID.test(value)).toBe(admitted)
    }
  })

  it('refuses an empty reference and one that does not start alphanumerically', () => {
    expect(isStudyBridgeOpaqueId('')).toBe(false)
    expect(isStudyBridgeOpaqueId(':leading-colon')).toBe(false)
    expect(isStudyBridgeOpaqueId('-leading-dash')).toBe(false)
    expect(isStudyBridgeOpaqueId('has space')).toBe(false)
    expect(isStudyBridgeOpaqueId('has#hash')).toBe(false)
  })

  it('generates a reference the bridge admits, whatever the session and segment are', () => {
    // Deliberately far past what any real block reference can reach: the
    // generator must not grow with its inputs at all.
    const absurdSession = `block:${'x'.repeat(120)}:2026-08-06:${'y'.repeat(120)}:session`
    const absurdSegment = `${'z'.repeat(180)}:segment:independent-practice`
    const ref = createStudyTurnRequestRef()
    expect(isStudyBridgeOpaqueId(ref)).toBe(true)
    expect(ref.length).toBeLessThanOrEqual(STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH)
    expect(absurdSession.length + absurdSegment.length).toBeGreaterThan(400)
  })

  it('carries no learner text, no bearer, and no Study session reference', () => {
    const ref = createStudyTurnRequestRef()
    // The whole reference is a fixed prefix plus an opaque identifier, so there
    // is nowhere for transient text or a secret to be embedded.
    expect(ref.startsWith('study-turn:')).toBe(true)
    expect(ref.slice('study-turn:'.length)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('does not collide across many references minted in the same millisecond', () => {
    // The reference it replaces ended in Date.now(), so two turns inside one
    // millisecond produced the same bridge event id.
    const refs = new Set(Array.from({ length: 5_000 }, () => createStudyTurnRequestRef()))
    expect(refs.size).toBe(5_000)
  })

  it('still fits the bridge bound after the runtime and bridge suffixes are appended', () => {
    // runtimeFacade appends ':learner-input' before the safety port, and the
    // bridge appends ':tutor-output' before the output check. Neither may push
    // the identifier past the bound.
    const ref = createStudyTurnRequestRef()
    expect(isStudyBridgeOpaqueId(`${ref}:learner-input`)).toBe(true)
    expect(isStudyBridgeOpaqueId(`${ref}:tutor-output`)).toBe(true)
    // The bridge also derives `recommendation:${requestId.slice(-60)}`, which it
    // caps at 80 characters of its own.
    expect(`recommendation:${ref.slice(-60)}`.length).toBeLessThanOrEqual(80)
  })
})
