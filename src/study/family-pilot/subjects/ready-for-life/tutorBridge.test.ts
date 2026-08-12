import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import {
  assertNoCompletionClaim,
  buildReadyForLifeTutorGuidance,
  readyForLifeStaticFallback,
} from './tutorBridge'

const catalog = loadReadyForLifeCatalog()

describe('FULL-FAMILY-READY-FOR-LIFE tutor bridge', () => {
  it('builds coaching guidance sourced from the lesson\'s own authored content, for every lesson', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const guidance = buildReadyForLifeTutorGuidance(lesson)
        expect(guidance.lessonId).toBe(lesson.lessonId)
        expect(guidance.coachingPrompts).toEqual(lesson.adaptiveTutorRoutes.map((r) => r.action))
        expect(guidance.extensionIdea).toBe(lesson.extension)
        expect(guidance.masteryRule).toBe(lesson.masteryRule)
        assertNoCompletionClaim(guidance.staticFallbackMessage)
        assertNoCompletionClaim(guidance.extensionIdea)
        for (const prompt of guidance.coachingPrompts) assertNoCompletionClaim(prompt)
      }
    }
  })

  it('always provides a static fallback message — fixed copy, no model call, never empty', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const message = readyForLifeStaticFallback(lesson)
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      }
    }
  })

  it('rejects tutor output that falsely claims a real-world action was performed', () => {
    expect(() => assertNoCompletionClaim('I have completed the laundry task for you.')).toThrow()
    expect(() => assertNoCompletionClaim('Task is done — marked complete.')).toThrow()
    expect(() => assertNoCompletionClaim('Guardian confirmation was recorded.')).toThrow()
  })

  it('allows tutor output that coaches without claiming completion', () => {
    expect(() => assertNoCompletionClaim('Try wiping the counter first, then check the corners.')).not.toThrow()
    expect(() => assertNoCompletionClaim('Ask a parent or guardian to be there for the hot-water step.')).not.toThrow()
  })

  it('also rejects present-tense/casual completion claims, not just past-tense self-reference', () => {
    expect(() => assertNoCompletionClaim("All set — that counts as complete.")).toThrow()
    expect(() => assertNoCompletionClaim('Your guardian already checked this.')).toThrow()
  })

  it('the guidance builder itself enforces the guard — a tampered lesson cannot slip a completion claim through', () => {
    const lesson = catalog.courses[0].lessons[0]
    const tamperedExtension = { ...lesson, extension: 'This task is now complete.' }
    expect(() => buildReadyForLifeTutorGuidance(tamperedExtension)).toThrow()

    const tamperedMastery = { ...lesson, masteryRule: 'I have confirmed this is done.' }
    expect(() => buildReadyForLifeTutorGuidance(tamperedMastery)).toThrow()

    const tamperedRoute = {
      ...lesson,
      adaptiveTutorRoutes: [{ signal: 'x', action: 'Marked as complete for you.' }],
    }
    expect(() => buildReadyForLifeTutorGuidance(tamperedRoute)).toThrow()
  })
})
