import { describe, expect, it } from 'vitest'
import { listLessonsForGrade } from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'
import { staticTutorExplanation } from './tutorExplanation'

const catalog = loadPhysicalEducationCatalog()

describe('Tutor/static explanation capability', () => {
  it('builds a static, non-adaptive explanation from the lesson content', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const explanation = staticTutorExplanation(lesson)
    expect(explanation.source).toBe('static-curriculum-content')
    expect(explanation.essentialQuestion).toBe(lesson.essentialQuestion)
    expect(explanation.steps.length).toBe(lesson.lessonFlow.length)
    explanation.steps.forEach((step, index) => {
      expect(step.title).toBe(lesson.lessonFlow[index].segment)
      expect(step.guidance).toBe(lesson.lessonFlow[index].guidance)
    })
  })

  it('produces a static explanation for every lesson without needing an adaptive session', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        expect(() => staticTutorExplanation(lesson)).not.toThrow()
      }
    }
  })
})
