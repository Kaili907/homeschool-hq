import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments } from '../src/study/family-pilot/final-app/learner-response/mapping'
import {
  RESPONSE_STAGE,
  TECHNOLOGY_DIRECTOR_LESSON,
  TECHNOLOGY_DIRECTOR_LESSON_REF,
  TECHNOLOGY_DIRECTOR_RESPONSE_MATERIAL,
} from '../src/study/family-pilot/technology-director-preview/lesson'
import { isTechnologyDirectorPreviewPath } from '../src/study/family-pilot/technology-director-preview/route'

const learnerPath = new URL('../curriculum-production/student-work/technology-arts-lessons/packages/technology/grade-10/ma-g10-technology-u02-l05.task-package.json', import.meta.url)
const learnerText = readFileSync(learnerPath, 'utf8')

describe('Technology Director sample R1', () => {
  it('is one complete static mastery sequence with distinct teaching and protected tasks', () => {
    const experience = TECHNOLOGY_DIRECTOR_LESSON.learner_experience
    expect(TECHNOLOGY_DIRECTOR_LESSON.lesson_id).toBe(TECHNOLOGY_DIRECTOR_LESSON_REF)
    expect(experience.static_complete).toBe(true)
    expect(experience.tutor_required).toBe(false)
    expect(experience.worked_example.kind).toBe('WORKED_EXAMPLE_CODE')
    expect(experience.worked_example.relationship_to_protected_tasks).toBe('ANALOGOUS_NON_TARGET')
    expect(experience.worked_example.evidence_eligible).toBe(false)
    expect(experience.worked_example.starter_code.match(/for \(/g)).toHaveLength(1)
    expect(experience.mastery_debug.starter_code.match(/for \(/g)).toHaveLength(2)
    expect(experience.fresh_mastery_check.starter_code).toContain('new Set()')
    expect(experience.remediation_routes).toHaveLength(2)
    expect(experience.remediation_routes.every((route) => route.original_protected_solution_exposed === false)).toBe(true)
  })

  it('keeps exact independent, mastery, and fresh-check repairs out of learner material', () => {
    expect(learnerText).not.toContain('let right = left + 1')
    expect(learnerText).not.toContain('seen.add(initial)')
    expect(learnerText).not.toContain('for (let i = 1; i < values.length; i += 1)')
    expect(learnerText).not.toMatch(/scoring-guides|trusted_solution_reference|restricted_checks/)
    expect(learnerText).toContain('WITHHELD_FROM_LEARNER_SURFACES')
    expect(learnerText).toContain('LOCATION_OR_EVIDENCE_CUE')
  })

  it('maps each response as separate durable evidence with the intended support role', () => {
    const lesson = mapLearnerMaterialToStudySegments(TECHNOLOGY_DIRECTOR_RESPONSE_MATERIAL)
    const items = lesson.segments.flatMap((segment) => segment.items)
    expect(items.map((item) => item.itemRef)).toEqual(Object.values(RESPONSE_STAGE).map((stage) => stage.itemRef))
    expect(new Set(items.map((item) => item.itemRef)).size).toBe(4)
    expect(items.find((item) => item.itemRef === RESPONSE_STAGE.guided.itemRef)?.evidenceMode).toBe('SUPPORTED')
    expect(items.find((item) => item.itemRef === RESPONSE_STAGE.independent.itemRef)?.evidenceMode).toBe('INDEPENDENT')
    expect(items.find((item) => item.itemRef === RESPONSE_STAGE.mastery.itemRef)?.evidenceMode).toBe('MASTERY')
    expect(items.find((item) => item.itemRef === RESPONSE_STAGE.fresh.itemRef)?.evidenceMode).toBe('MASTERY')
    expect(items.every((item) => item.required && !item.instructionalExample)).toBe(true)
  })

  it('keeps the Director shortcut exact-path and development-only', () => {
    expect(isTechnologyDirectorPreviewPath('/__review/technology-algorithms', true)).toBe(true)
    expect(isTechnologyDirectorPreviewPath('/__review/technology-algorithms/', true)).toBe(true)
    expect(isTechnologyDirectorPreviewPath('/__review/technology-algorithms', false)).toBe(false)
    expect(isTechnologyDirectorPreviewPath('/family-pilot', true)).toBe(false)
    expect(isTechnologyDirectorPreviewPath('/__review/technology-algorithms/extra', true)).toBe(false)
  })
})
