import { describe, expect, it } from 'vitest'
import { assessContentSpecificity } from './specificity'

describe('assessContentSpecificity', () => {
  it('skips evaluation when there is no text to judge', () => {
    const signal = assessContentSpecificity({ present: true }, 'Any Title')
    expect(signal.evaluated).toBe(false)
    expect(signal.sufficientlySpecific).toBe(true)
  })

  it('flags title-interpolated generic scaffold text', () => {
    const signal = assessContentSpecificity(
      {
        present: true,
        text: 'In this lesson, students will learn about Fractions. Complete the Fractions worksheet.',
      },
      'Fractions',
    )
    expect(signal.evaluated).toBe(true)
    expect(signal.sufficientlySpecific).toBe(false)
    expect(signal.reasons.length).toBeGreaterThan(0)
  })

  it('passes long, specific, non-boilerplate content', () => {
    const signal = assessContentSpecificity(
      {
        present: true,
        text:
          'Students compare multi-digit whole numbers by examining the value of digits in each ' +
          'place, starting from the highest place value and working right until the digits differ. ' +
          'For example, when comparing 48,352 and 48,325, the tens place decides the comparison.',
      },
      'Comparing Multi-Digit Numbers Using Place Value',
    )
    expect(signal.evaluated).toBe(true)
    expect(signal.sufficientlySpecific).toBe(true)
    expect(signal.reasons).toEqual([])
  })
})
