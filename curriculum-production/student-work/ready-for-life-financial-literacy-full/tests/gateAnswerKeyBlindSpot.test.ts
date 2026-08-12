import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'
import type {
  LessonContentBlock,
  LessonProductionInput,
} from '../../../../src/curriculum/production-quality/index.ts'
import { AUTHORED_COURSES, loadCourseLessons } from '../src/inventory.ts'

const block = (text: string): LessonContentBlock => ({ present: true, text })

/**
 * The single scoring string the source repeats verbatim for every lesson in
 * every RFL/FinLit course. It is read from source rather than pasted, so this
 * test keeps describing reality if the source text ever changes.
 */
function genericScoringGuidance(): string {
  const course = AUTHORED_COURSES.find(
    (c) => c.grade === 5 && c.subject === 'financial-literacy',
  )!
  const lessons = loadCourseLessons(course)!
  return lessons[0].answer_or_scoring_guidance as string
}

/**
 * Prose blocks are all comfortably above the 25-word specificity floor, so
 * the word-count heuristic is held constant and the only variable under test
 * is the scoring authority itself.
 */
function finLitLessonWith(scoringContent: string): LessonProductionInput {
  return {
    lessonId: 'blind-spot-probe',
    title: 'Budget basics',
    courseId: 'probe-course',
    unitId: 'unit-1',
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    instruction: block(
      'Learners examine a fictional monthly household budget and determine whether the plan balances across every spending category and savings goal over a full twelve month horizon, documenting each assumption they rely upon.',
    ),
    workedExample: block(
      'Model one fictional budget end to end: list the stated income, subtract each expense category in strict order, and display the remaining running balance at every individual step so the learner can follow along.',
    ),
    guidedPractice: block(
      'Work through two supported fictional budget examples together, pausing after each move to ask what evidence or reasoning supports that particular category allocation, then fade the prompting on the second example entirely.',
    ),
    independentWork: block(
      'The learner builds an entirely new fictional monthly budget from a given income figure and records the explicit reasoning behind every single category allocation decision, then checks the totals once before submitting it.',
    ),
    scoringAuthority: { kind: 'ANSWER_KEY', content: block(scoringContent) },
    remediation: block(
      'Reteach by reducing the problem to only two spending categories and rebuilding the subtraction sequence one step at a time until the running balance is correct, then gradually restore the other categories.',
    ),
    extension: block(
      'Add one irregular annual expense to the fictional budget and require the learner to amortize that cost across all twelve months of planning, explaining in writing how the monthly figure was derived.',
    ),
    assessmentAlignment: 'ALIGNED',
  } as LessonProductionInput
}

describe('the source carries no per-lesson answer content', () => {
  it('repeats one identical scoring string for every lesson, with no numbers in it', () => {
    const guidance = genericScoringGuidance()
    expect(guidance).not.toMatch(/\d/)

    for (const course of AUTHORED_COURSES.filter((c) => c.ref === null)) {
      const lessons = loadCourseLessons(course)!
      const distinct = new Set(lessons.map((l) => l.answer_or_scoring_guidance))
      expect(
        distinct.size,
        `grade-${course.grade}/${course.subject} should carry exactly one scoring string`,
      ).toBe(1)
      expect(distinct.has(guidance)).toBe(true)
    }
  })
})

/**
 * KNOWN GAP — this is a characterization test, not an endorsement.
 *
 * evaluateLessonProductionReadiness requires MATH_STRUCTURED_FINLIT lessons to
 * carry a fixed ANSWER_KEY, but it only checks that the block is present and
 * clears the specificity heuristic. It never checks that an answer exists. So
 * the generic scoring boilerplate above — which contains no answer to anything
 * and is byte-identical across all 396 authored lessons — satisfies the gate.
 *
 * Consequence: a mechanically mass-generated corpus can report
 * QUALITY_GATE: READY while shipping no real answer keys at all. Passing this
 * gate is therefore necessary but NOT sufficient evidence of FinLit production
 * readiness, and this test exists so that stops being an invisible assumption.
 *
 * If the gate is later hardened to require genuine answer content, this test
 * should be updated to expect the rejection — the change would be a fix.
 */
describe('KNOWN GAP: the gate accepts generic boilerplate as a fixed answer key', () => {
  it('returns READY for a FinLit lesson whose answer key contains no answers', () => {
    const result = evaluateLessonProductionReadiness(finLitLessonWith(genericScoringGuidance()))

    expect(result.status).toBe('READY')
    expect(result.notes).toEqual([])
    expect(result.codes).toContain('READY')
  })

  it('still rejects a FinLit lesson that declares a rubric instead of an answer key', () => {
    const lesson = {
      ...finLitLessonWith(genericScoringGuidance()),
      scoringAuthority: { kind: 'RUBRIC', content: block(genericScoringGuidance()) },
    } as LessonProductionInput

    const result = evaluateLessonProductionReadiness(lesson)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })
})
