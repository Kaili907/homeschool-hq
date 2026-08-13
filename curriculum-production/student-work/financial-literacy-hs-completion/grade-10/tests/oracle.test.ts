import { describe, expect, it } from 'vitest'
import { verifyLesson } from '../src/oracle.ts'
import { ALL_SPECS } from '../src/registry.ts'
import type { LessonSpec } from '../src/types.ts'

/**
 * Fail-closed answer verification.
 *
 * The sibling lane's `gateAnswerKeyBlindSpot` test showed a gate that accepted
 * `"TODO"` as an answer key because it only ever checked that a flag was true.
 * The first test here exists so this lane cannot acquire the same blind spot:
 * it feeds the oracle a deliberately wrong key and requires rejection. If the
 * oracle is ever weakened into a no-op, that test fails before the corpus does.
 */
const wrongKeyLesson: LessonSpec = {
  lessonId: 'synthetic-not-in-corpus',
  grade: 10,
  unit: 3,
  day: 1,
  actor: 'a fictional worker',
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
          text: 'A fictional paycheck is $18.50 per hour for 22 hours. What is the gross pay?',
          given: { rate: 18.5, hours: 22 },
          expr: 'rate * hours',
          format: 'usd',
          answer: '$407.50',
          reasoning: 'fixture: the truthful value is 18.50 x 22 = 407.00, so this authored key is wrong on purpose.',
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
    expect(result.findings[0].message).toContain('$407.00')
  })

  it('rejects an expression that reaches for a parameter the item does not declare', () => {
    const broken = structuredClone(wrongKeyLesson) as LessonSpec
    const item = broken.tasks[0].items[0] as { expr: string; answer: string }
    item.expr = 'rate * hoursWorked'
    expect(verifyLesson(broken).findings[0].message).toContain('does not declare')
  })

  it('reproduces every authored fixed answer in the corpus', () => {
    const failures = ALL_SPECS.flatMap((spec) => verifyLesson(spec).findings)
    expect(failures.map((f) => `${f.lessonId} ${f.ref}: ${f.message}`)).toEqual([])
  })

  it('verifies a real, non-trivial number of fixed answers', () => {
    const totals = ALL_SPECS.map((s) => verifyLesson(s))
    const recomputed = totals.reduce((n, r) => n + r.recomputedNumeric, 0)
    const derived = totals.reduce((n, r) => n + r.derivedChoices, 0)
    expect(recomputed + derived).toBeGreaterThan(0)
  })
})
