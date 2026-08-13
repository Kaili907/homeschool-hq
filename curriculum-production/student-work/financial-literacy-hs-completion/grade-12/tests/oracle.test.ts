import { describe, expect, it } from 'vitest'
import { verifyLesson } from '../src/oracle.ts'
import { ALL_SPECS } from '../src/registry.ts'
import type { LessonSpec } from '../src/types.ts'

/**
 * Fail-closed answer verification.
 *
 * The first two tests exist so this lane cannot acquire the blind spot the
 * sibling lanes documented, where a gate accepted an answer key because a flag
 * was true rather than because an answer was right. They feed the oracle a
 * deliberately wrong key and a deliberately broken expression and require both
 * to be rejected. If the oracle is ever weakened into a no-op, these fail
 * before the corpus does.
 */
const wrongKeyLesson: LessonSpec = {
  lessonId: 'synthetic-not-in-corpus',
  grade: 12,
  unit: 1,
  day: 1,
  actor: 'a fictional worker',
  objective: 'synthetic fixture',
  scenario: 'A fictional fixture used only to prove the oracle rejects a wrong key.',
  materials: [],
  domains: ['income', 'taxes'],
  tasks: [
    {
      taskId: 't1',
      kind: 'guided',
      directions: 'fixture',
      items: [
        {
          ref: 't1-p1',
          kind: 'numeric',
          text: 'A fictional salary of $54,600 is paid over 12 months. What is monthly gross pay?',
          given: { salary: 54600 },
          expr: 'salary / 12',
          format: 'usd',
          answer: '$4,600.00',
          reasoning: 'fixture: the truthful value is 54,600 / 12 = 4,550.00, so this authored key is wrong on purpose.',
        },
      ],
    },
  ],
  remediation: 'fixture',
  extension: 'fixture',
}

describe('the oracle', () => {
  it('rejects an authored answer it cannot reproduce from the parameters', () => {
    const result = verifyLesson(wrongKeyLesson)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('$4,550.00')
  })

  it('rejects an expression that reaches for a parameter the item does not declare', () => {
    const broken = structuredClone(wrongKeyLesson) as LessonSpec
    const item = broken.tasks[0].items[0] as { expr: string }
    item.expr = 'salary / monthsInYear'
    expect(verifyLesson(broken).findings[0].message).toContain('does not declare')
  })

  it('rejects a choice answer that disagrees with the comparison its parameters decide', () => {
    const flipped = structuredClone(wrongKeyLesson) as unknown as LessonSpec
    const tasks = flipped.tasks as unknown as { items: unknown[] }[]
    tasks[0].items = [{
      ref: 't1-p1',
      kind: 'choice',
      text: 'Which fictional offer pays more, A at $54,600 or B at $51,000?',
      choices: ['Offer A', 'Offer B'],
      given: { a: 54600, b: 51000 },
      decision: { left: 'a', cmp: '>', right: 'b', ifTrue: 'Offer A', ifFalse: 'Offer B' },
      answer: 'Offer B',
      reasoning: 'fixture: the parameters decide Offer A, so this authored key is wrong on purpose.',
    }]
    const findings = verifyLesson(flipped).findings
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('disagrees with the choice the parameters decide')
  })

  it('reproduces every authored fixed answer in the corpus', () => {
    const failures = ALL_SPECS.flatMap((spec) => verifyLesson(spec).findings)
    expect(failures.map((f) => `${f.lessonId} ${f.ref}: ${f.message}`)).toEqual([])
  })

  it('verifies a substantial number of fixed answers, not a token few', () => {
    const totals = ALL_SPECS.map((s) => verifyLesson(s))
    const recomputed = totals.reduce((n, r) => n + r.recomputedNumeric, 0)
    const derived = totals.reduce((n, r) => n + r.derivedChoices, 0)
    expect(recomputed + derived).toBeGreaterThan(400)
    expect(totals.every((r) => r.checkedFixedItems > 0)).toBe(true)
  })
})
