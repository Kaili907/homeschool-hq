import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { LEARNER_PROFILE_ORDER, learnerPresentationForProfile } from './learnerPresentation'

describe('Manuel Academy learner presentation mapping', () => {
  it('derives the approved display identities from the authoritative profiles', () => {
    const state = defaultAppState()
    const identities = LEARNER_PROFILE_ORDER.map((id) => {
      const learner = learnerPresentationForProfile(state.profiles[id])
      return [learner.fullName, learner.gradeLabel]
    })

    expect(identities).toEqual([
      ['Kaili Manuel', '12th Grade'],
      ['Arianna Manuel', '10th Grade'],
      ['Stephanie Manuel', '7th Grade'],
      ['Lucia Manuel', '4th Grade'],
      ['Aly Manuel', '3rd Grade'],
    ])
  })

  it('never substitutes a decorative identity for a customized profile', () => {
    const profile = { ...defaultAppState().profiles.p3, name: 'Custom Learner', grade: '6' as const }
    expect(learnerPresentationForProfile(profile)).toMatchObject({
      profileId: 'p3',
      fullName: 'Custom Learner',
      gradeLabel: '6th Grade',
      initials: 'CL',
    })
  })

  it('gives duplicate AM initials distinct full-name and grade labels', () => {
    const state = defaultAppState()
    const arianna = learnerPresentationForProfile(state.profiles.p4)
    const aly = learnerPresentationForProfile(state.profiles.p1)

    expect(arianna.initials).toBe('AM')
    expect(aly.initials).toBe('AM')
    expect([arianna.fullName, arianna.gradeLabel]).not.toEqual([aly.fullName, aly.gradeLabel])
  })
})
