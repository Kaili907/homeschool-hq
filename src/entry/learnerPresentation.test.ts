import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { LEARNER_PRESENTATIONS, learnerPresentationForProfile } from './learnerPresentation'

describe('Manuel Academy learner presentation mapping', () => {
  it('exposes the approved five learner identities in display order', () => {
    expect(LEARNER_PRESENTATIONS.map(({ fullName, gradeLabel }) => [fullName, gradeLabel])).toEqual([
      ['Kaili Manuel', '12th Grade'],
      ['Arianna Manuel', '10th Grade'],
      ['Stephanie Manuel', '7th Grade'],
      ['Lucia Manuel', '4th Grade'],
      ['Aly Manuel', '3rd Grade'],
    ])
  })

  it('keeps names, grades, initials, and future portraits presentation-only', () => {
    const state = defaultAppState()

    expect(state.profiles.p3.grade).toBe('6')
    expect(learnerPresentationForProfile('p3').gradeLabel).toBe('7th Grade')
    expect(Object.keys(LEARNER_PRESENTATIONS[0]).sort()).toEqual([
      'fullName',
      'gradeLabel',
      'initials',
      'profileId',
    ])
    expect(JSON.stringify(LEARNER_PRESENTATIONS)).not.toMatch(/pin|auth|supabase|blob|base64/i)
  })

  it('gives duplicate AM initials distinct full-name and grade labels', () => {
    const arianna = learnerPresentationForProfile('p4')
    const aly = learnerPresentationForProfile('p1')

    expect(arianna.initials).toBe('AM')
    expect(aly.initials).toBe('AM')
    expect([arianna.fullName, arianna.gradeLabel]).not.toEqual([aly.fullName, aly.gradeLabel])
  })
})
