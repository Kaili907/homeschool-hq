import { describe, expect, it } from 'vitest'
import type { StudyRuntimeInterruption } from '../../types'
import {
  STUDY_TUTOR_INTERRUPTION_KINDS,
  acceptStudyTutorResult,
  parseStudyTutorResult,
} from './results'

/**
 * STUDY-A1-TUTOR-CONTRACT-H4 — every Study interruption crosses the Tutor
 * boundary, and the test cannot fall behind the union.
 *
 * THE RED, witnessed on the composed tree before results.ts was touched:
 *
 *   session-authorization        -> round-trips
 *   rate-limit                   -> round-trips
 *   authorization-infrastructure -> null
 *
 * The third kind is the one STUDY-A1-AUTH-INFRA-BOUNDARY added, for the case
 * where the gateway's learner-authorization verifier cannot be reached. That
 * card's whole point was that this is NOT a statement about the learner: it is
 * a retryable outage, it clears no verified identity, and it must not be
 * confused with a refusal. The Tutor result parser dropped it, and `null` here
 * is a rejection — `acceptStudyTutorResult` turns it into `quarantined` with a
 * contract-parse failure code. A retryable infrastructure outage arrived at the
 * host as "the Tutor's output could not be vouched for".
 *
 * WHY THIS FILE IS NOT THREE `it` BLOCKS. Three hand-written cases is the exact
 * shape of the defect: the two-kind list in `narrowedInterruption` was correct
 * when it was written and became wrong when someone else changed the union, and
 * a hand-written test would have been wrong in the same way at the same moment.
 * So every case below is generated from a canonical source, and the source is
 * audited by the type:
 *
 *  1. `STUDY_TUTOR_INTERRUPTION_KINDS` is asserted against
 *     `StudyRuntimeInterruption['kind']` in results.ts, in both directions, at
 *     compile time. It cannot omit a declared kind or invent one.
 *  2. `REPRESENTATIVE` below is a mapped type over that same union, so a fourth
 *     kind makes THIS FILE fail to compile until a value for it is supplied.
 *  3. The round-trip assertions iterate the tuple, so the new kind is exercised
 *     the moment it is added.
 *
 * A fourth kind therefore cannot be added anywhere in the repository without
 * either round-tripping here or breaking the build. That is the property the
 * two-kind list never had.
 */

/**
 * One value per declared kind. The mapped type is the forcing part: it demands
 * a key for every member of the union, and `Extract` demands that each value
 * actually BE that member — so a fourth kind cannot be satisfied with a
 * placeholder, and a value with the wrong reason will not compile.
 */
const REPRESENTATIVE: {
  readonly [K in StudyRuntimeInterruption['kind']]: Extract<StudyRuntimeInterruption, { kind: K }>
} = {
  'session-authorization': { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
  'rate-limit': { kind: 'rate-limit' },
  'authorization-infrastructure': { kind: 'authorization-infrastructure' },
}

describe('H4 — the interruption set is derived from the union, not remembered', () => {
  it('enumerates exactly the kinds the Study runtime type declares', () => {
    // The runtime half of the compile-time assertions in results.ts. If the
    // tuple and the fixture map ever disagree, one of them has been edited by
    // hand and the other has not.
    expect([...STUDY_TUTOR_INTERRUPTION_KINDS].sort()).toEqual(Object.keys(REPRESENTATIVE).sort())
    // Stated once, so a reader can see what the set currently is without
    // trusting the derivation. This is the ONLY literal list in the file, and it
    // is checked against the derived one rather than used in its place.
    expect([...STUDY_TUTOR_INTERRUPTION_KINDS].sort()).toEqual([
      'authorization-infrastructure',
      'rate-limit',
      'session-authorization',
    ])
  })

  it('round-trips every declared kind through an interrupted result', () => {
    for (const kind of STUDY_TUTOR_INTERRUPTION_KINDS) {
      const interruption = REPRESENTATIVE[kind]
      const parsed = parseStudyTutorResult({ status: 'interrupted', interruption })

      expect(parsed, `${kind}: must not be dropped`).not.toBeNull()
      expect(parsed, `${kind}: round-trip`).toEqual({ status: 'interrupted', interruption })
      if (parsed?.status !== 'interrupted') throw new Error(`${kind}: expected an interruption`)
      expect(parsed.interruption.kind, `${kind}: kind preserved`).toBe(kind)
      // Rebuilt, not passed through: the caller's object never travels.
      expect(parsed.interruption, `${kind}: rebuilt`).not.toBe(interruption)
      expect(Object.isFrozen(parsed.interruption), `${kind}: frozen`).toBe(true)
      expect(Object.isFrozen(parsed), `${kind}: result frozen`).toBe(true)
    }
  })

  it('does not quarantine a valid interruption at the fail-closed entry point', () => {
    // The consequence the RED actually had. `acceptStudyTutorResult` is the
    // short crossing a wrapper is meant to use, and a dropped kind arrived
    // there as a structural fault rather than as the retryable outage it was.
    for (const kind of STUDY_TUTOR_INTERRUPTION_KINDS) {
      const accepted = acceptStudyTutorResult({ status: 'interrupted', interruption: REPRESENTATIVE[kind] })
      expect(accepted.status, `${kind}: must not be quarantined`).toBe('interrupted')
    }
  })

  it('admits both session-authorization reasons and refuses any other', () => {
    // The one kind with a payload. Its reasons are a closed set for the same
    // purpose the kinds are, and the two halves need different recovery.
    for (const reason of ['adult-authentication-rejected', 'study-session-rejected'] as const) {
      expect(parseStudyTutorResult({
        status: 'interrupted',
        interruption: { kind: 'session-authorization', reason },
      })).toEqual({ status: 'interrupted', interruption: { kind: 'session-authorization', reason } })
    }
    for (const reason of ['', 'adult-authentication-REJECTED', 'expired', 'authorization-infrastructure']) {
      expect(parseStudyTutorResult({
        status: 'interrupted',
        interruption: { kind: 'session-authorization', reason },
      }), `reason ${JSON.stringify(reason)}`).toBeNull()
    }
  })

  it('still refuses an unknown kind, and a known kind carrying an extra field', () => {
    // Widening the set must not have opened it. `authorization-infrastructure`
    // now round-trips; `authorization-infrastructur` and friends do not.
    for (const unknownKind of [
      'authorization-infrastructur',
      'authorization-infrastructures',
      'Authorization-Infrastructure',
      'network',
      'stopped',
      '',
      'toString',
      '__proto__',
    ]) {
      expect(parseStudyTutorResult({
        status: 'interrupted',
        interruption: { kind: unknownKind },
      }), `kind ${JSON.stringify(unknownKind)}`).toBeNull()
    }

    // A payload-free kind stays payload-free: the one-key shape is the whole
    // check, so a smuggled field is a rejection rather than a dropped property.
    for (const kind of STUDY_TUTOR_INTERRUPTION_KINDS) {
      expect(parseStudyTutorResult({
        status: 'interrupted',
        interruption: { ...REPRESENTATIVE[kind], transcript: 'she said she was scared' },
      }), `${kind}: extra field`).toBeNull()
    }

    // And a non-string kind cannot reach the membership test.
    for (const badKind of [undefined, null, 42, {}, ['rate-limit'], Symbol.iterator]) {
      expect(parseStudyTutorResult({
        status: 'interrupted',
        interruption: { kind: badKind },
      }), `kind ${String(badKind)}`).toBeNull()
    }
  })

  it('refuses a payload-free kind that is missing or has a reason bolted on', () => {
    expect(parseStudyTutorResult({ status: 'interrupted' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: null })).toBeNull()
    expect(parseStudyTutorResult({
      status: 'interrupted',
      interruption: { kind: 'authorization-infrastructure', reason: 'adult-authentication-rejected' },
    })).toBeNull()
    // Symmetrically, the kind that requires a reason is refused without one.
    expect(parseStudyTutorResult({
      status: 'interrupted',
      interruption: { kind: 'session-authorization' },
    })).toBeNull()
  })

  it('reads the kind once, so an accessor cannot answer twice', () => {
    let reads = 0
    const shifting = {
      get kind(): string {
        reads += 1
        return reads === 1 ? 'authorization-infrastructure' : 'session-authorization'
      },
    }
    const parsed = parseStudyTutorResult({ status: 'interrupted', interruption: shifting })
    // Whatever the verdict, it is about the value that was CHECKED. A second
    // answer cannot become the value that was kept.
    expect(reads).toBe(1)
    expect(parsed).toEqual({ status: 'interrupted', interruption: { kind: 'authorization-infrastructure' } })
  })
})
