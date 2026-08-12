import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'
import type {
  LessonContentBlock,
  LessonProductionInput,
} from '../../../../src/curriculum/production-quality/index.ts'
import { RELEASED_COURSES, loadCourseLessons } from '../src/inventory.ts'

const block = (text: string): LessonContentBlock => ({ present: true, text })

/**
 * The single scoring string the released source repeats verbatim for every
 * lesson. Read from source rather than pasted, so this keeps describing
 * reality if the source text ever changes.
 */
function genericScoringGuidance(): string {
  const course = RELEASED_COURSES.find(
    (c) => c.grade === 5 && c.subject === 'financial-literacy',
  )!
  return loadCourseLessons(course)![0].answer_or_scoring_guidance as string
}

/**
 * Every prose block sits comfortably above the 25-word specificity floor, so
 * the word-count heuristic is held constant and the scoring authority is the
 * only variable under test.
 */
function finLitLessonWith(scoringAuthority: LessonProductionInput['scoringAuthority']): LessonProductionInput {
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
    scoringAuthority,
    remediation: block(
      'Reteach by reducing the problem to only two spending categories and rebuilding the subtraction sequence one step at a time until the running balance is correct, then gradually restore the other categories.',
    ),
    extension: block(
      'Add one irregular annual expense to the fictional budget and require the learner to amortize that cost across all twelve months of planning, explaining in writing how the monthly figure was derived.',
    ),
    assessmentAlignment: 'ALIGNED',
  } as LessonProductionInput
}

describe('the released source carries no per-lesson answer content', () => {
  it('repeats one identical scoring string per course, with no numbers in it', () => {
    const guidance = genericScoringGuidance()
    expect(guidance).not.toMatch(/\d/)

    for (const course of RELEASED_COURSES.filter((c) => c.ref === null)) {
      const lessons = loadCourseLessons(course)!
      const distinct = new Set(lessons.map((l) => l.answer_or_scoring_guidance))
      expect(distinct.size, `grade-${course.grade}/${course.subject}`).toBe(1)
      expect(distinct.has(guidance)).toBe(true)
    }
  })
})

/**
 * KNOWN GAP — characterization tests, not an endorsement.
 *
 * For MATH_STRUCTURED_FINLIT the gate requires a fixed ANSWER_KEY, but the
 * only checks it performs are `authority.kind === 'ANSWER_KEY'` and
 * `isSubstantive(authority.content)` — and isSubstantive tests `present === true`
 * WITHOUT looking at `text`. The specificity heuristic in specificity.ts is
 * applied to instruction, workedExample, guidedPractice and independentWork,
 * and to nothing else, so it never runs on the answer key at all.
 *
 * Net effect: the gate's answer-key requirement reduces to "a boolean is true
 * and a label reads ANSWER_KEY". A mass-generated corpus can report
 * QUALITY_GATE: READY while containing no answer to any question. Passing this
 * gate is necessary but NOT sufficient evidence of FinLit readiness.
 *
 * When the gate is hardened, these expectations should flip to rejection.
 */
describe('KNOWN GAP: the gate never inspects answer-key content', () => {
  it.each([
    ['the generic source boilerplate', () => block(genericScoringGuidance())],
    ['a placeholder string', () => block('TODO')],
    ['arithmetic that is simply wrong', () => block('The answer is 2 + 2 = 5')],
    ['an empty string', () => block('')],
    ['a block with no text at all', () => ({ present: true }) as LessonContentBlock],
  ])('returns READY when the answer key is %s', (_label, makeContent) => {
    const result = evaluateLessonProductionReadiness(
      finLitLessonWith({ kind: 'ANSWER_KEY', content: makeContent() }),
    )
    expect(result.status).toBe('READY')
    expect(result.notes).toEqual([])
  })

  it('proves the specificity heuristic is live elsewhere, so its absence here is a real gap', () => {
    const lesson = {
      ...finLitLessonWith({ kind: 'ANSWER_KEY', content: block(genericScoringGuidance()) }),
      // Same boilerplate, moved into a field the heuristic DOES cover.
      independentWork: block('Review the key concepts from this unit.'),
    } as LessonProductionInput

    const result = evaluateLessonProductionReadiness(lesson)
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.notes.join(' ')).toContain('independent work')
  })

  it('still rejects a FinLit lesson that declares a rubric instead of an answer key', () => {
    const result = evaluateLessonProductionReadiness(
      finLitLessonWith({ kind: 'RUBRIC', content: block(genericScoringGuidance()) }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })
})
