import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_ACADEMY_GRADES,
  SUPPORTED_ACADEMY_GRADE_TOKENS,
} from './constants'

describe('canonical Academy grade authority', () => {
  it('is exactly the expanded supported set in ascending order', () => {
    expect(SUPPORTED_ACADEMY_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(SUPPORTED_ACADEMY_GRADE_TOKENS).toEqual([
      '3', '4', '5', '7', '8', '9', '10', '11', '12',
    ])
  })

  it('intentionally excludes Grade 6', () => {
    expect(SUPPORTED_ACADEMY_GRADES).not.toContain(6)
  })
})
