import { describe, expect, it } from 'vitest'
import { verifyLesson } from '../src/oracle.ts'
import { ALL_SPECS } from '../src/registry.ts'
import type { LessonSpec } from '../src/types.ts'

/**
 * Fail-closed answer verification, with the negative control first.
 *
 * The prior round in this family shipped a gate whose answer-key requirement
 * reduced to "a boolean is true", so a corpus with no answers reported ready.
 * The first three tests exist so this supplement cannot acquire that blind
 * spot: a deliberately wrong key, a keyed choice that disagrees with the
 * parameters, and a broken expression must all be rejected. If the oracle is
 * ever weakened into a no-op, these fail before the corpus does.
 */
const wrongKeyLesson: LessonSpec = {
  lessonId: 'synthetic-not-in-corpus',
  grade: 11,
  unit: 1,
  day: 1,
  actor: 'a fictional analyst',
  objective: 'synthetic fixture',
  scenario: 'A fictional fixture used only to prove the oracle rejects a wrong key.',
  materials: [],
  tasks: [
    {
      taskId: 't1',
      kind: 'guided',
      directions: 'fixture',
      items: [
        {
          ref: 't1-p1',
          kind: 'numeric',
          text: 'A fictional contract pays $2,450.00 a month for 18 months. What is the total paid?',
          given: { monthly: 2450, months: 18 },
          expr: 'monthly * months',
          format: 'usd',
          answer: '$44,000.00',
          reasoning: 'fixture: the truthful value is 2450 x 18 = 44,100.00, so this authored key is wrong on purpose.',
        },
      ],
    },
  ],
  remediation: 'fixture',
  extension: 'fixture',
}

const wrongChoiceLesson: LessonSpec = {
  ...wrongKeyLesson,
  tasks: [
    {
      taskId: 't1',
      kind: 'guided',
      directions: 'fixture',
      items: [
        {
          ref: 't1-p1',
          kind: 'choice',
          text: 'Which fictional plan costs more in total over the holding period?',
          choices: ['Plan A', 'Plan B'],
          given: { a: 12400, b: 13950 },
          decision: { left: 'a', cmp: '>', right: 'b', ifTrue: 'Plan A', ifFalse: 'Plan B' },
          answer: 'Plan A',
          reasoning: 'fixture: 12,400 is not greater than 13,950, so the keyed option is wrong on purpose.',
        },
      ],
    },
  ],
}

describe('the oracle', () => {
  it('rejects an authored numeric answer it cannot reproduce from the parameters', () => {
    const result = verifyLesson(wrongKeyLesson)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('$44,100.00')
    expect(result.recomputedNumeric).toBe(0)
  })

  it('rejects a keyed choice that disagrees with the parameters that decide it', () => {
    const result = verifyLesson(wrongChoiceLesson)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('"Plan B"')
    expect(result.derivedChoices).toBe(0)
  })

  it('rejects an expression that reaches for a parameter the item does not declare', () => {
    const broken = structuredClone(wrongKeyLesson) as LessonSpec
    const item = broken.tasks[0].items[0] as { expr: string }
    item.expr = 'monthly * termMonths'
    expect(verifyLesson(broken).findings[0].message).toContain('does not declare')
  })

  it('rejects an expression that reaches for a result that is not an earlier item', () => {
    const broken = structuredClone(wrongKeyLesson) as LessonSpec
    const item = broken.tasks[0].items[0] as { expr: string }
    item.expr = 'monthly * months + #t9-p9'
    expect(verifyLesson(broken).findings[0].message).toContain('not an earlier fixed item')
  })

  it('reproduces every authored fixed answer in the grade-11 corpus', () => {
    const failures = ALL_SPECS.flatMap((spec) => verifyLesson(spec).findings)
    expect(failures.map((f) => `${f.lessonId} ${f.ref}: ${f.message}`)).toEqual([])
  })

  it('verifies a fixed answer in every single lesson, not merely somewhere in the corpus', () => {
    const barren = ALL_SPECS
      .map((s) => ({ id: s.lessonId, r: verifyLesson(s) }))
      .filter(({ r }) => r.recomputedNumeric + r.derivedChoices === 0)
      .map(({ id }) => id)
    expect(barren).toEqual([])
  })
})
