import { describe, expect, it } from 'vitest'
import {
  CURRENTLY_SUPPORTED_WORKING_GRADES,
  REQUIRED_FAMILY_PILOT_SUBJECTS,
} from './constants'

describe('full curriculum readiness population', () => {
  it('covers the canonical nine-grade by ten-subject release matrix', () => {
    expect(CURRENTLY_SUPPORTED_WORKING_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(REQUIRED_FAMILY_PILOT_SUBJECTS).toEqual([
      'mathematics',
      'english-language-arts',
      'science',
      'social-studies',
      'health',
      'physical-education',
      'ready-for-life',
      'technology',
      'arts-and-music',
      'financial-literacy',
    ])
    expect(CURRENTLY_SUPPORTED_WORKING_GRADES).not.toContain(6)
    expect(CURRENTLY_SUPPORTED_WORKING_GRADES.length * REQUIRED_FAMILY_PILOT_SUBJECTS.length).toBe(90)
  })
})
