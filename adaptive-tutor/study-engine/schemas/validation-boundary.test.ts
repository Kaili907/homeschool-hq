import { describe, expect, it } from 'vitest'
import { lessonStudyPlanSchema } from './study-plan.schema.ts'
import { cloneFixture } from './test-helpers.ts'

describe('bounded JSON-safe validation boundary', () => {
  it.each([
    ['null', null],
    ['array root', []],
    ['string root', 'not-a-contract'],
    ['non-finite number', Number.NaN],
    ['bigint', BigInt(1)],
  ])('rejects %s', (_label, value) => {
    const result = lessonStudyPlanSchema.validate(value)
    expect(result.ok).toBe(false)
  })

  it('rejects cyclic input before schema field access', () => {
    const fixture = cloneFixture('study-plan.json')
    fixture.cycle = fixture
    const result = lessonStudyPlanSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'json-safety')).toBe(true)
  })

  it('rejects sparse arrays', () => {
    const fixture = cloneFixture('study-plan.json')
    const sparse = new Array(2)
    sparse[1] = (fixture.segments as unknown[])[0]
    fixture.segments = sparse
    const result = lessonStudyPlanSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'json-safety')).toBe(true)
  })

  it('rejects accessors without invoking them', () => {
    const fixture = cloneFixture('study-plan.json')
    let invoked = false
    Object.defineProperty(fixture, 'trap', {
      enumerable: true,
      get() {
        invoked = true
        return 'unsafe'
      },
    })
    const result = lessonStudyPlanSchema.validate(fixture)
    expect(result.ok).toBe(false)
    expect(invoked).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'json-safety')).toBe(true)
  })

  it('rejects reserved object keys', () => {
    const fixture = cloneFixture('study-plan.json')
    Object.defineProperty(fixture, 'constructor', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: {},
    })
    const result = lessonStudyPlanSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'json-safety')).toBe(true)
  })

  it('rejects oversized arrays before contract refinements', () => {
    const fixture = cloneFixture('study-plan.json')
    fixture.segmentSequence = Array.from({ length: 2_001 }, (_, index) => `segment:${index}`)
    const result = lessonStudyPlanSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'limit')).toBe(true)
  })
})

