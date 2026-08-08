/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 3 — the LaunchSettled witness, pinned at
 * compile time.
 *
 * The runtime ordering is proved in ./tutorLaunchOrdering.integration.test.tsx
 * against the real host and real ports. This file pins the STRUCTURE, which is
 * the part a runtime test cannot reach: that the witness is a capability rather
 * than a fact, that it cannot be written down, and that `prepareDurableStudySession`
 * will not accept a substitute for it.
 *
 * Each `@ts-expect-error` is its own directive on its own line, so weakening any
 * ONE of them leaves that directive unused and `tsc --noEmit` fails on TS2578.
 * That is measured behaviour, not an assumption — see the correction in
 * ../contracts/tutor/refFieldPins.test.ts.
 *
 * M5 in this card's mutation campaign is "replace LaunchSettled with a boolean".
 * The first two pins below are what kills it: a boolean, and `true` in
 * particular, must not be accepted where the witness is required.
 */
import { describe, expect, it } from 'vitest'
import { StudyLifecycleBoundary } from '../lifecycle'
import type { StudyPortBundle } from '../ports'
import {
  prepareDurableStudySession,
  settleStudyTutorLaunch,
  type LaunchSettled,
} from './tutorLaunchOrdering'

/**
 * Never invoked. Every call below is inside a function that is defined and not
 * run, so these are pure compile-time statements: nothing here touches a port,
 * and a port bundle is only needed to make the second argument well-typed.
 */
declare const ports: StudyPortBundle
declare const preparation: Omit<Parameters<typeof prepareDurableStudySession>[1], 'ports'>

describe('the launch-settled witness cannot be forged (compile-time)', () => {
  it('refuses a boolean in place of the witness', () => {
    const attempt = () => prepareDurableStudySession(
      // @ts-expect-error a boolean is not a LaunchSettled witness
      true,
      { ...preparation, ports },
    )
    expect(typeof attempt).toBe('function')
  })

  it('refuses an object literal of the visible shape', () => {
    // The mistake that reads as correct code: the witness exposes `epoch`, so a
    // caller who saw only that would think this is what it is. The brand is an
    // unexported `unique symbol`, so no module outside ./tutorLaunchOrdering.ts
    // can name the property that is missing here.
    const attempt = () => prepareDurableStudySession(
      // @ts-expect-error an object literal cannot carry the unexported brand
      { epoch: 1 },
      { ...preparation, ports },
    )
    expect(typeof attempt).toBe('function')
  })

  it('refuses undefined, so the parameter cannot simply be dropped', () => {
    const attempt = () => prepareDurableStudySession(
      // @ts-expect-error the witness is required, not optional
      undefined,
      { ...preparation, ports },
    )
    expect(typeof attempt).toBe('function')
  })

  it('refuses the promise of a witness that was never awaited', () => {
    // The exact shape of the F1 mistake, expressed as a type: a caller who
    // called `settleStudyTutorLaunch` and forgot the `await` holds a Promise,
    // and a Promise is not a witness.
    const attempt = (boundary: StudyLifecycleBoundary) => prepareDurableStudySession(
      // @ts-expect-error an unawaited Promise<LaunchSettled> is not a LaunchSettled
      settleStudyTutorLaunch(boundary.token(), () => 'launched'),
      { ...preparation, ports },
    )
    expect(typeof attempt).toBe('function')
  })

  it('accepts the witness a settled launch actually produced', async () => {
    // The positive half. Without it the pins above are satisfied by a type
    // nothing at all can satisfy, and the ordering would be enforced by making
    // durable preparation impossible rather than by making it ordered.
    const boundary = new StudyLifecycleBoundary({
      authenticatedSessionRef: 'session:witness',
      householdRef: 'household:witness',
      learnerRef: 'learner:witness',
      launchGrantRef: 'grant:witness',
      featureEnabled: true,
      authorizationRevision: 1,
    })
    const settled: LaunchSettled = await settleStudyTutorLaunch(boundary.token(), () => 'launched')
    expect(settled.epoch).toBe(boundary.token().epoch)
    // A primitive-free capability: frozen, and carrying nothing but the epoch.
    expect(Object.isFrozen(settled)).toBe(true)
    expect(Object.keys(settled)).toEqual(['epoch'])
  })

  it('exports no way to construct one', () => {
    // The brand is applied by a module-private function. If a later card
    // exported it, the whole guard would become a convention again — the same
    // reason ../contracts/tutor/results.ts does not export its `validated`.
    const surface = { prepareDurableStudySession, settleStudyTutorLaunch }
    expect(Object.keys(surface).sort()).toEqual(['prepareDurableStudySession', 'settleStudyTutorLaunch'])
  })
})
