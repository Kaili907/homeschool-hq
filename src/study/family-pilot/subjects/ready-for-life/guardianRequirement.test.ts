import { describe, expect, it } from 'vitest'
import { loadReadyForLifeCatalog } from './content.node'
import { deriveGuardianRequirement } from './guardianRequirement'

const catalog = loadReadyForLifeCatalog()

function lessonByFocus(grade: '5' | '7' | '8', focus: string) {
  const course = catalog.courses.find((c) => c.grade === grade)!
  const lesson = course.lessons.find((l) => l.focus === focus)
  if (!lesson) throw new Error(`fixture lesson not found: grade ${grade} / ${focus}`)
  return lesson
}

describe('FULL-FAMILY-READY-FOR-LIFE deriveGuardianRequirement', () => {
  it('every lesson requires guardian visibility — course-wide policy marker', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const requirement = deriveGuardianRequirement(lesson)
        expect(requirement.guardianVisibilityRequired).toBe(true)
        expect(requirement.guardianVisibilitySummary).toBe(lesson.parentOrGuardianVisibility)
      }
    }
  })

  it('flags a washer/dryer safety lesson for guardian sign-off before completion', () => {
    const lesson = lessonByFocus('5', 'washer and dryer safety')
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.hazardCategories).toContain('appliances')
    expect(requirement.requiresGuardianSignoffBeforeCompletion).toBe(true)
  })

  it('flags a knife/heat/appliance lesson for guardian sign-off before completion', () => {
    const lesson = lessonByFocus('8', 'knife heat and appliance safety')
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.hazardCategories).toEqual(
      expect.arrayContaining(['sharp-tools', 'heat', 'appliances']),
    )
    expect(requirement.requiresGuardianSignoffBeforeCompletion).toBe(true)
  })

  it('flags an online-account-safety lesson for guardian sign-off before completion', () => {
    const lesson = lessonByFocus('7', 'account and password safety')
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.hazardCategories).toContain('online-accounts')
    expect(requirement.requiresGuardianSignoffBeforeCompletion).toBe(true)
  })

  it('does not flag a lesson whose topic names no hazard from the policy list', () => {
    const lesson = lessonByFocus('5', 'calendar basics')
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.hazardCategories).toEqual([])
    expect(requirement.requiresGuardianSignoffBeforeCompletion).toBe(false)
  })

  it('at least one lesson per grade is guardian-sign-off gated', () => {
    for (const course of catalog.courses) {
      const gated = course.lessons.filter(
        (lesson) => deriveGuardianRequirement(lesson).requiresGuardianSignoffBeforeCompletion,
      )
      expect(gated.length).toBeGreaterThan(0)
    }
  })

  it('does not flag a "no-heat" lesson for the heat hazard — negation is not a hazard', () => {
    const lesson = lessonByFocus('5', 'simple no-heat preparation')
    const requirement = deriveGuardianRequirement(lesson)
    expect(requirement.hazardCategories).not.toContain('heat')
  })

  it('gates every lesson in a capstone unit unconditionally, regardless of keyword match', () => {
    // The capstone's actual execution step names no hazard keyword at all
    // ("doing the task" / "safe execution") because the real task is
    // family- or student-chosen at run time — it must still be gated.
    for (const course of catalog.courses) {
      const capstoneLessons = course.lessons.filter((lesson) => lesson.unitTitle.toLowerCase().includes('capstone'))
      expect(capstoneLessons.length).toBe(6)
      for (const lesson of capstoneLessons) {
        const requirement = deriveGuardianRequirement(lesson)
        expect(requirement.hazardCategories).toContain('open-ended-capstone-task')
        expect(requirement.requiresGuardianSignoffBeforeCompletion).toBe(true)
      }
    }
  })

  it('specifically gates the grade 5 capstone "doing the task" execution lesson', () => {
    const lesson = lessonByFocus('5', 'doing the task')
    expect(deriveGuardianRequirement(lesson).requiresGuardianSignoffBeforeCompletion).toBe(true)
  })

  it('specifically gates the grade 7 capstone "safe execution" lesson', () => {
    const lesson = lessonByFocus('7', 'safe execution')
    expect(deriveGuardianRequirement(lesson).requiresGuardianSignoffBeforeCompletion).toBe(true)
  })
})
