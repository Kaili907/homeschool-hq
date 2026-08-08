/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 11 — Tutor prose reaches a learner as a
 * string and as nothing wider.
 *
 * Two independent halves, and both are needed.
 *
 * The compile-time pins are the primary guard: `ReactNode`, an element and
 * `unknown` must all be rejected at the presentation seam and at the surface
 * component's own prop. Each `@ts-expect-error` below is its own directive on
 * its own line, so widening any ONE of them leaves that directive unused and
 * `tsc --noEmit` fails on TS2578 — measured, not assumed (see the correction in
 * ../contracts/tutor/refFieldPins.test.ts: TS2578 is reported per directive, so
 * a correct neighbour cannot cover for a widened field).
 *
 * The runtime half exists because a compile-time bound is exactly as strong as
 * the weakest `as any` on the path to it, and `as any` is one word. Phase 11
 * requires that such a cast be CAUGHT rather than merely discouraged, so the
 * seam re-checks the type it was promised.
 */
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { StudyTutorSafetySurface, studyAccessibilityProjection } from '../../components/study/StudySessionContainer'
import { studyTutorLearnerPresentation } from './tutorPresentation'

const accessibility = studyAccessibilityProjection({
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  noAudio: true,
  captions: true,
  transientTranscript: false,
  oneTaskAtATime: true,
})

/** A component tree, which is what `ReactNode` would let a Tutor return. */
const NODE: ReactNode = createElement('div', null, 'tutor supplied element')

describe('the production presentation seam accepts a string and nothing wider', () => {
  it('accepts sanitized Tutor prose', () => {
    const presentation = studyTutorLearnerPresentation('Nice work. Try the next step.')
    expect(presentation?.visibleText).toBe('Nice work. Try the next step.')
  })

  it('refuses a React node at compile time', () => {
    // @ts-expect-error a ReactNode is not a string
    expect(studyTutorLearnerPresentation(NODE)).toBeNull()
  })

  it('refuses an unknown transport value at compile time', () => {
    const raw: unknown = { toString: () => 'looks like a sentence' }
    // @ts-expect-error an unvalidated unknown is not a string
    expect(studyTutorLearnerPresentation(raw)).toBeNull()
  })

  it('refuses a boxed String at compile time', () => {
    // eslint-disable-next-line no-new-wrappers
    const boxed = new String('boxed sentence')
    // @ts-expect-error a String object is not a primitive string
    expect(studyTutorLearnerPresentation(boxed)).toBeNull()
  })

  it('catches an `as any` cast at the handoff, which no type could', () => {
    // The residual the compile-time pins cannot close. Each of these is a value
    // that would render as STRUCTURE rather than as escaped text if it reached
    // the surface, and each is turned away by the seam's own check.
    const smuggled: readonly unknown[] = [
      NODE,
      { toString: () => 'looks like a sentence' },
      // eslint-disable-next-line no-new-wrappers
      new String('boxed sentence'),
      { dangerouslySetInnerHTML: { __html: '<img onerror=1>' } },
      ['a', 'b'],
      42,
      null,
      undefined,
    ]
    for (const value of smuggled) {
      expect(studyTutorLearnerPresentation(value as any)).toBeNull()
    }
  })

  it('refuses prose that is empty or only whitespace', () => {
    expect(studyTutorLearnerPresentation('')).toBeNull()
    expect(studyTutorLearnerPresentation('   \n\t ')).toBeNull()
  })

  it('freezes what it returns, so a later caller cannot swap the text', () => {
    const presentation = studyTutorLearnerPresentation('Nice work.')!
    expect(Object.isFrozen(presentation)).toBe(true)
  })
})

describe('the mounted safety surface is already narrowed, and is pinned rather than widened', () => {
  it('accepts a string for visibleText', () => {
    const element = (
      <StudyTutorSafetySurface
        busy={false}
        checkingTutorSafety={false}
        stopped={false}
        visibleText="Nice work. Try the next step."
        accessibility={accessibility}
        transcriptOpen={false}
      />
    )
    expect(element.props.visibleText).toBe('Nice work. Try the next step.')
  })

  it('refuses a React node at visibleText', () => {
    // Written as JSX rather than `createElement`, deliberately. Under
    // `createElement` a suppressed props object stops matching the component's
    // signature and TypeScript falls back to a different overload, so the
    // directive would be answering an overload-resolution error rather than the
    // prop's type — a pin that would keep passing if `visibleText` were widened
    // to `ReactNode`. JSX resolves the component's own props, so the error this
    // suppresses is the one being pinned.
    const element = (
      <StudyTutorSafetySurface
        busy={false}
        checkingTutorSafety={false}
        stopped={false}
        // @ts-expect-error visibleText is a string, never a ReactNode
        visibleText={NODE}
        accessibility={accessibility}
        transcriptOpen={false}
      />
    )
    expect(element.props.visibleText).toBe(NODE)
  })

  it('keeps Tutor prose out of the one prop that IS a node', () => {
    // `transcript` is a ReactNode, and it is the host's own element built from
    // host state — never a value a Tutor returned. The pin is that the two
    // props have different types, so prose cannot drift into the node one.
    const element = (
      <StudyTutorSafetySurface
        busy={false}
        checkingTutorSafety={false}
        stopped={false}
        visibleText="Nice work."
        accessibility={accessibility}
        transcript={<ol />}
        transcriptOpen={false}
      />
    )
    expect(typeof element.props.visibleText).toBe('string')
    expect(typeof element.props.transcript).toBe('object')
  })
})
