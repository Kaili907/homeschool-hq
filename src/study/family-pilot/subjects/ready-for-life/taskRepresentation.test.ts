import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import { deriveGuardianRequirement } from './guardianRequirement'
import { deriveTaskRepresentation } from './taskRepresentation'

const catalog = loadReadyForLifeCatalog()

describe('FULL-FAMILY-READY-FOR-LIFE deriveTaskRepresentation — privacy and safety', () => {
  it('never requires real credentials, unsupervised hazards, or private disclosure — for every lesson', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const task = deriveTaskRepresentation(lesson, deriveGuardianRequirement(lesson))
        expect(task.requiresRealCredentials).toBe(false)
        expect(task.requiresUnsupervisedHazard).toBe(false)
        expect(task.requiresPrivateDisclosure).toBe(false)
      }
    }
  })

  it('mode is guardian-supervised-task exactly when the lesson is hazard-gated', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const requirement = deriveGuardianRequirement(lesson)
        const task = deriveTaskRepresentation(lesson, requirement)
        expect(task.mode).toBe(
          requirement.requiresGuardianSignoffBeforeCompletion ? 'guardian-supervised-task' : 'household-task',
        )
      }
    }
  })

  it('carries only the course-authored instructions — no learner-submitted text field exists', () => {
    const lesson = catalog.courses[0].lessons[0]
    const task = deriveTaskRepresentation(lesson, deriveGuardianRequirement(lesson))
    expect(task.studentActivity).toBe(lesson.studentActivity)
    expect(task.homeConnection).toBe(lesson.homeConnection)
    expect(Object.keys(task)).not.toContain('learnerResponse')
    expect(Object.keys(task)).not.toContain('rawAnswer')
  })

  it('rejects a lesson whose home_connection drops the no-forced-disclosure clause', () => {
    const lesson = catalog.courses[0].lessons[0]
    const tampered = { ...lesson, homeConnection: 'Take a photo and share your account password.' }
    expect(() => deriveTaskRepresentation(tampered, deriveGuardianRequirement(lesson))).toThrow()
  })
})
