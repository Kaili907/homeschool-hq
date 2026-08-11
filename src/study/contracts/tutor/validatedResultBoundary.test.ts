import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
  acceptStudyTutorResult,
  parseStudyTutorResult,
  type ValidatedStudyTutorResult,
} from './results'
import type { StudyTutorResult, StudyTutorRuntime, StudyTutorTurn } from './runtime'

/**
 * STUDY-A1-TUTOR-CONTRACT-H4 — the validated-result boundary, pinned.
 *
 * H3 Phase 8 made `StudyTutorRuntime.submit` return `ValidatedStudyTutorResult`
 * rather than `StudyTutorResult`, so that a wrapper cannot express its return
 * value without one the parser produced. The independent review confirmed that
 * relationship holds today — `StudyTutorResult` is genuinely not assignable to
 * `ValidatedStudyTutorResult` — but found NO directive anywhere in the suite
 * that pins it. The brand was load-bearing and unguarded: delete the
 * intersection from `ValidatedStudyTutorResult`, or redeclare `submit` as
 * returning `StudyTutorResult`, and `tsc --noEmit` stays clean while the
 * structural boundary that H3 exists to provide is simply gone.
 *
 * That is the same defect shape as the ref fields in ./refFieldPins.test.ts: not
 * "production is wrong" — production is right — but "production can stop being
 * right with every gate still green".
 *
 * The pins below are COMPILE-TIME. `declare const` introduces a type and no
 * runtime value, so nothing here may be dereferenced when the tests run; the
 * type-level statements live in a function that is never called, and whether
 * `tsc` accepts this file IS the assertion. The runtime `it` blocks separately
 * hold the positive half.
 *
 * No cast of any kind is used to reach the negative — not to `any`, not through
 * `unknown`, not to the branded type. A cast would make each refusal a
 * statement about the cast rather than about the two types, and the last test
 * in this file holds that property against this file's own source.
 */

declare const parsedOnlyAtRuntime: StudyTutorResult
declare const rawTransportOutput: unknown
declare const someTurn: StudyTutorTurn

/**
 * Never invoked. Every line is a type-level claim, and `tsc --noEmit` is what
 * checks it. Calling it would throw `ReferenceError` on the `declare const`s,
 * which have no runtime existence.
 */
export function __h4ValidatedResultBoundaryPins(): void {
  // ── The negative. ──────────────────────────────────────────────────────────
  // A value that merely has the SHAPE of a result — the exact thing a wrapper
  // gets by declaring its transport's return type — cannot stand where the
  // contract requires one it has seen.
  // @ts-expect-error a result the contract never parsed is not a validated result
  const smuggledByShape: ValidatedStudyTutorResult = parsedOnlyAtRuntime
  void smuggledByShape

  // The same refusal at the production seam, which is where it actually costs
  // something: a wrapper cannot implement `submit` by returning its own
  // unvalidated result.
  const wrapperSkippingTheParser: Pick<StudyTutorRuntime, 'submit'> = {
    // @ts-expect-error submit must return a result the contract parsed
    async submit(_turn: StudyTutorTurn): Promise<StudyTutorResult> {
      return parsedOnlyAtRuntime
    },
  }
  void wrapperSkippingTheParser

  // And an object literal of the right shape, which is the other way to arrive
  // at `StudyTutorResult` without parsing anything.
  // @ts-expect-error a literal of the right shape is still not a validated result
  const smuggledByLiteral: ValidatedStudyTutorResult = {
    status: 'accepted',
    eventRef: 'study-event:abc123',
    visibleText: 'Nice work.',
  }
  void smuggledByLiteral

  // ── The positive. ─────────────────────────────────────────────────────────
  // The canonical crossing compiles, with no assertion anywhere in it. Without
  // this half the pins above would be satisfied by a type nothing can satisfy —
  // including by breaking the parser's own return type.
  const throughAccept: ValidatedStudyTutorResult = acceptStudyTutorResult(rawTransportOutput)
  void throughAccept

  const throughParse: ValidatedStudyTutorResult | null = parseStudyTutorResult(rawTransportOutput)
  void throughParse

  const conformingWrapper: Pick<StudyTutorRuntime, 'submit'> = {
    async submit(_turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
      return acceptStudyTutorResult(rawTransportOutput)
    },
  }
  void conformingWrapper

  // The brand distributes over the union, so narrowing on `status` still works
  // and the boundary costs the host nothing at the point of use.
  const narrowed = acceptStudyTutorResult(rawTransportOutput)
  if (narrowed.status === 'accepted') void narrowed.visibleText
  if (narrowed.status === 'stopped') void narrowed.reasonCode
  if (narrowed.status === 'interrupted') void narrowed.interruption
  if (narrowed.status === 'quarantined') void narrowed.reasonCode

  void someTurn
}

describe('H4 — a result is only validated if this contract validated it', () => {
  it('produces a validated result from the canonical accept path at runtime', () => {
    // The positive half, executed rather than only typechecked: the pins above
    // cannot be "passed" by making the parser return something unusable.
    const accepted = acceptStudyTutorResult({
      status: 'accepted',
      eventRef: 'study-event:abc123',
      visibleText: 'Nice work.',
    })
    expect(accepted.status).toBe('accepted')
    expect(Object.isFrozen(accepted)).toBe(true)
  })

  it('fails an unvalidatable result closed rather than passing its shape through', () => {
    // What a wrapper gets instead of the bypass: a quarantine it cannot mistake
    // for an accepted turn, and which says nothing about the learner.
    const quarantined = acceptStudyTutorResult({ status: 'accepted', eventRef: 'not an opaque id' })
    expect(quarantined.status).toBe('quarantined')
    if (quarantined.status !== 'quarantined') throw new Error('expected a quarantine')
    expect(quarantined.reasonCode).toBe(STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE)
  })

  it('keeps the pin file free of the escapes that would make it vacuous', () => {
    // A pin written with a cast — to `any`, through `unknown`, or straight to
    // the branded type — would compile no matter what the two types did.
    // Checked on this file's own source so the guarantee cannot rot silently.
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    expect(source).not.toMatch(/as\s+any\b/)
    expect(source).not.toMatch(/as\s+unknown\s+as/)
    expect(source).not.toMatch(/as\s+ValidatedStudyTutorResult\b/)
    // And the negative pins are real directives, not comments that read like
    // one. The pattern is assembled rather than written literally, so that this
    // assertion does not count itself.
    const directive = new RegExp(`@ts-${'expect'}-error`, 'g')
    expect(source.match(directive) ?? []).toHaveLength(3)
  })
})
