import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import { deriveGuardianRequirement } from './guardianRequirement'
import { decideReadyForLifeCompletion } from './completionEvidence'

const catalog = loadReadyForLifeCatalog()

function gatedLesson() {
  for (const course of catalog.courses) {
    const lesson = course.lessons.find(
      (l) => deriveGuardianRequirement(l).requiresGuardianSignoffBeforeCompletion,
    )
    if (lesson) return lesson
  }
  throw new Error('fixture: expected at least one guardian-gated lesson')
}

function ungatedLesson() {
  for (const course of catalog.courses) {
    const lesson = course.lessons.find(
      (l) => !deriveGuardianRequirement(l).requiresGuardianSignoffBeforeCompletion,
    )
    if (lesson) return lesson
  }
  throw new Error('fixture: expected at least one non-gated lesson')
}

describe('FULL-FAMILY-READY-FOR-LIFE decideReadyForLifeCompletion', () => {
  it('a student click alone cannot complete a guardian-gated real-world-action lesson', () => {
    const requirement = deriveGuardianRequirement(gatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      { learnerRef: 'learner-1', studentAdvanced: true },
      'learner-1',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('pending-guardian-confirmation')
  })

  it('an empty or blank guardian confirmation cannot complete a gated lesson — cannot be forged', () => {
    const requirement = deriveGuardianRequirement(gatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      {
        learnerRef: 'learner-1',
        studentAdvanced: true,
        guardianConfirmation: { guardianRef: '   ', confirmedAt: '' },
      },
      'learner-1',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('rejected')
    expect(decision.reasonCode).toBe('guardian-confirmation-invalid')
  })

  it('a genuine guardian confirmation completes a gated lesson', () => {
    const requirement = deriveGuardianRequirement(gatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      {
        learnerRef: 'learner-1',
        studentAdvanced: true,
        guardianConfirmation: { guardianRef: 'guardian-abc', confirmedAt: '2026-08-12T10:00:00Z' },
      },
      'learner-1',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('complete')
  })

  it('a student click is sufficient for a non-gated lesson', () => {
    const requirement = deriveGuardianRequirement(ungatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      { learnerRef: 'learner-1', studentAdvanced: true },
      'learner-1',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('complete')
  })

  it('rejects when the student has not actually advanced through the lesson', () => {
    const requirement = deriveGuardianRequirement(ungatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      { learnerRef: 'learner-1', studentAdvanced: false },
      'learner-1',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('rejected')
    expect(decision.reasonCode).toBe('assignment-incomplete')
  })

  it('no duplicate completion: an already-complete lesson rejects new evidence', () => {
    const requirement = deriveGuardianRequirement(ungatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      { learnerRef: 'learner-1', studentAdvanced: true },
      'learner-1',
      { alreadyCompleted: true },
    )
    expect(decision.status).toBe('rejected')
    expect(decision.reasonCode).toBe('assignment-already-complete')
  })

  it('student isolation: evidence for one learner cannot complete another learner\'s lesson', () => {
    const requirement = deriveGuardianRequirement(ungatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      { learnerRef: 'learner-attacker', studentAdvanced: true },
      'learner-victim',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('rejected')
    expect(decision.reasonCode).toBe('learner-mismatch')
  })

  it('student isolation holds even when the mismatched evidence also carries a guardian confirmation', () => {
    const requirement = deriveGuardianRequirement(gatedLesson())
    const decision = decideReadyForLifeCompletion(
      requirement,
      {
        learnerRef: 'learner-attacker',
        studentAdvanced: true,
        guardianConfirmation: { guardianRef: 'guardian-abc', confirmedAt: '2026-08-12T10:00:00Z' },
      },
      'learner-victim',
      { alreadyCompleted: false },
    )
    expect(decision.status).toBe('rejected')
    expect(decision.reasonCode).toBe('learner-mismatch')
  })
})
