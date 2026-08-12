import { describe, expect, it } from 'vitest'
import { loadSocialStudiesCatalog } from './source.node'
import { getAssessmentForLesson, listLessons, listUnits } from './catalog'
import { SOCIAL_STUDIES_GRADES } from './types'

/**
 * FF-M3 — cross-cutting checks that don't belong to one module: grade
 * isolation, single completion authority per unit assessment, and
 * assessment boundaries, all against the real frozen catalog rather than a
 * fixture.
 */
describe('FF-M3 social studies subject lane — cross-cutting guarantees', () => {
  const catalog = loadSocialStudiesCatalog()

  it('keeps every grade\'s lessons and units isolated by an unambiguous grade-scoped ref prefix', () => {
    for (const grade of SOCIAL_STUDIES_GRADES) {
      for (const lesson of listLessons(catalog, grade)) {
        expect(lesson.lessonId.startsWith(`ma-g${grade}-social-studies-`)).toBe(true)
        expect(lesson.grade).toBe(grade)
      }
      for (const unit of listUnits(catalog, grade)) {
        expect(unit.unitId.startsWith(`ma-g${grade}-social-studies-`)).toBe(true)
        expect(unit.grade).toBe(grade)
      }
    }
  })

  it('never assigns the same lesson or unit ref to two different grades', () => {
    const allLessonIds = SOCIAL_STUDIES_GRADES.flatMap((grade) => listLessons(catalog, grade).map((lesson) => lesson.lessonId))
    const allUnitIds = SOCIAL_STUDIES_GRADES.flatMap((grade) => listUnits(catalog, grade).map((unit) => unit.unitId))
    expect(new Set(allLessonIds).size).toBe(allLessonIds.length)
    expect(new Set(allUnitIds).size).toBe(allUnitIds.length)
  })

  it('gives every one of the 27 units exactly one completion authority for its assessment: the single "Unit assessment" phase lesson', () => {
    for (const grade of SOCIAL_STUDIES_GRADES) {
      for (const unit of listUnits(catalog, grade)) {
        const lessonsInUnit = unit.lessonIds.map((id) => listLessons(catalog, grade).find((lesson) => lesson.lessonId === id)!)
        const assessmentLessons = lessonsInUnit.filter((lesson) => lesson.phase === 'Unit assessment')
        expect(assessmentLessons).toHaveLength(1)

        const lessonsCarryingAssessmentContent = lessonsInUnit.filter((lesson) => getAssessmentForLesson(catalog, lesson.lessonId))
        expect(lessonsCarryingAssessmentContent).toHaveLength(1)
        expect(lessonsCarryingAssessmentContent[0].lessonId).toBe(assessmentLessons[0].lessonId)
      }
    }
  })

  it('never reuses one assessment id across two units (assessment boundaries hold)', () => {
    const allAssessmentIds = SOCIAL_STUDIES_GRADES.flatMap((grade) =>
      listUnits(catalog, grade).map((unit) => unit.assessmentId).filter((id): id is string => id !== null),
    )
    expect(new Set(allAssessmentIds).size).toBe(allAssessmentIds.length)
    expect(allAssessmentIds).toHaveLength(27)
  })

  it('never lets a unit assessment carry more or less than its own unit\'s standards and points', () => {
    for (const grade of SOCIAL_STUDIES_GRADES) {
      for (const unit of listUnits(catalog, grade)) {
        const assessment = getAssessmentForLesson(
          catalog,
          unit.lessonIds.map((id) => listLessons(catalog, grade).find((lesson) => lesson.lessonId === id)!).find(
            (lesson) => lesson.phase === 'Unit assessment',
          )!.lessonId,
        )
        expect(assessment?.unitNumber).toBe(unit.unitNumber)
        expect(assessment?.totalPoints).toBeGreaterThan(0)
        expect(assessment?.promptCount).toBeGreaterThan(0)
      }
    }
  })

  it('exposes no field on the catalog capable of storing a student\'s raw response, draft, or essay text', () => {
    for (const grade of SOCIAL_STUDIES_GRADES) {
      for (const lesson of listLessons(catalog, grade)) {
        const forbidden = ['answer', 'response', 'draft', 'essay', 'transcript', 'studentText']
        for (const key of forbidden) {
          expect(Object.keys(lesson)).not.toContain(key)
        }
      }
    }
  })
})
