import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'

describe('SUPPORTED_ACADEMY_GRADES', () => {
  it('is exactly the target grade list, in ascending order', () => {
    expect(SUPPORTED_ACADEMY_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
  })

  it('does not include grade 6', () => {
    expect(SUPPORTED_ACADEMY_GRADES).not.toContain(6)
  })

  it('does not include grades 1 or 2', () => {
    expect(SUPPORTED_ACADEMY_GRADES).not.toContain(1)
    expect(SUPPORTED_ACADEMY_GRADES).not.toContain(2)
  })
})
