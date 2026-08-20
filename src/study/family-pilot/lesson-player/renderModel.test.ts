import { describe, expect, it } from 'vitest'
import { ACADEMY_SUBJECTS } from '../../../types'
import { createBoundRichLessonRenderModel, createRichLessonRenderModel } from './renderModel'
import { RICH_STUDY_SUBJECT_ADAPTERS } from './subjectAdapters'

describe('final Family Pilot rich lesson material adapter', () => {
  it('covers exactly the ten final curriculum subjects', () => {
    expect(Object.keys(RICH_STUDY_SUBJECT_ADAPTERS)).toEqual([...ACADEMY_SUBJECTS])
  })

  it('projects production lesson fields into navigable learner pages', () => {
    const model = createRichLessonRenderModel({
      materialRef: 'material:one',
      lessonRef: 'ma-g11-science-u01-l01',
      title: 'Model a system',
      subject: 'science',
      essentialQuestion: 'How do parts interact?',
      learningObjectives: ['Model the system.'],
      materials: ['Notebook'],
      safetyRules: ['Use classroom materials as directed.'],
      sections: [
        { title: 'Worked example', body: 'Study the model.' },
        { title: 'Independent practice', directions: 'Build and explain your model.', answerKey: 'never render this' },
      ],
    })
    expect(model).toMatchObject({ lessonRef: 'ma-g11-science-u01-l01', subject: { label: 'Science' }, mode: 'rich' })
    expect(model.pages.map((page) => page.kind)).toEqual(['lesson-goal', 'materials-safety', 'teaching', 'independent-practice'])
    expect(JSON.stringify(model)).not.toContain('never render this')
    expect(model.pages.at(-1)).toMatchObject({ position: 4, total: 4 })
    expect(() => createBoundRichLessonRenderModel({
      lessonRef: 'ma-g11-science-u01-l02',
      material: { lessonRef: model.lessonRef, title: model.title },
    })).toThrow(/does not match/i)
  })
})
