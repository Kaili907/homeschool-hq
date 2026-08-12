import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import { decideReadyForLifeCompletion } from './completionEvidence'
import { deriveGuardianRequirement } from './guardianRequirement'
import { deriveTaskRepresentation } from './taskRepresentation'
import { buildReadyForLifeTutorGuidance } from './tutorBridge'

const catalog = loadReadyForLifeCatalog()

/**
 * FULL-FAMILY-READY-FOR-LIFE privacy — none of this lane's own public output
 * shapes carry a field for raw learner free text, a photo, or a real
 * credential. Every value that reaches a caller from these adapters is
 * either opaque refs, course-authored static copy, or a small closed set of
 * booleans/enums — never learner-submitted content.
 */
describe('FULL-FAMILY-READY-FOR-LIFE privacy', () => {
  it('completion evidence accepts no free-text learner field beyond opaque refs and timestamps', () => {
    const lesson = catalog.courses[0].lessons[0]
    const requirement = deriveGuardianRequirement(lesson)
    const decision = decideReadyForLifeCompletion(
      requirement,
      {
        learnerRef: 'learner-1',
        studentAdvanced: true,
        guardianConfirmation: { guardianRef: 'guardian-1', confirmedAt: '2026-08-12T10:00:00Z' },
      },
      'learner-1',
      { alreadyCompleted: false },
    )
    // The decision itself carries only a fixed reasonCode/message vocabulary
    // this module authors — never anything echoed back from caller input.
    expect(Object.keys(decision)).toEqual(['status', 'reasonCode', 'message'])
  })

  it('task representation exposes no photo/account/credential-shaped field, for every lesson', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const task = deriveTaskRepresentation(lesson, deriveGuardianRequirement(lesson))
        // Exclude the module's own `requiresX` safety-invariant guards (always
        // false, asserted below) — this checks for a *data-carrying* field,
        // not for the word appearing in a boolean policy flag's name.
        const keys = Object.keys(task).filter((key) => !key.startsWith('requires'))
        for (const forbidden of ['photo', 'photograph', 'password', 'credential', 'account', 'ssn']) {
          expect(keys.some((key) => key.toLowerCase().includes(forbidden))).toBe(false)
        }
        expect(task.requiresRealCredentials).toBe(false)
        expect(task.requiresPrivateDisclosure).toBe(false)
      }
    }
  })

  it('tutor guidance is built only from course-authored fields, never a learner-input echo', () => {
    const lesson = catalog.courses[0].lessons[0]
    const guidance = buildReadyForLifeTutorGuidance(lesson)
    expect(Object.keys(guidance)).toEqual([
      'lessonId',
      'coachingPrompts',
      'extensionIdea',
      'masteryRule',
      'staticFallbackMessage',
    ])
  })

  it('guardian visibility summary matches the course policy of sharing state, not raw reflections', () => {
    const lesson = catalog.courses[0].lessons[0]
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.guardianVisibilitySummary).toContain('Do not expose raw private reflections')
  })
})
