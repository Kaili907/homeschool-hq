import { describe, expect, it } from 'vitest'
import {
  ARTS_ACTIVITY_RESPONSE_FIXTURE,
  G3_MATH_RESPONSE_FIXTURE,
  G5_ELA_RESPONSE_FIXTURE,
  SCIENCE_MARKDOWN_RESPONSE_FIXTURE,
} from './fixtures'
import { mapLearnerMaterialToStudySegments } from './mapping'
import type { LearnerMaterialDto } from './types'

describe('production learner material to Study segment mapping', () => {
  it('proves the Grade 3 structured math fixture preserves refs and real response types', () => {
    const lesson = mapLearnerMaterialToStudySegments(G3_MATH_RESPONSE_FIXTURE)
    expect(lesson.segments.map((segment) => segment.role)).toEqual(['LEARN', 'PRACTICE', 'REFLECT'])
    const example = lesson.segments[0]!.items[0]!
    expect(example).toMatchObject({ sectionRef: 'ex', itemRef: 'ma-g3-mathematics-u01-l01#ex-01', responseType: 'READ', instructionalExample: true })
    const practice = lesson.segments[1]!.items
    expect(practice.map((item) => [item.itemRef, item.responseType, item.evidenceMode])).toEqual([
      ['ma-g3-mathematics-u01-l01#ip-01', 'CHOICE', 'INDEPENDENT'],
      ['ma-g3-mathematics-u01-l01#ip-02', 'NUMERIC', 'INDEPENDENT'],
    ])
    expect(lesson.segments[2]!.items[0]).toMatchObject({ itemRef: 'ma-g3-mathematics-u01-l01#mc-01', responseType: 'CONSTRUCTED_RESPONSE', evidenceMode: 'MASTERY' })
    expect(lesson.segments.flatMap((segment) => segment.items).some((item) => item.responseType === 'NONE')).toBe(false)
    expect(JSON.stringify(lesson)).not.toMatch(/answerKey|correctAnswer|workedSolution.*answer/i)
  })

  it('proves the Grade 5 ELA fixture maps guided and independent evidence separately', () => {
    const lesson = mapLearnerMaterialToStudySegments(G5_ELA_RESPONSE_FIXTURE)
    const responses = lesson.segments[1]!.items
    expect(responses.map((item) => [item.title, item.responseType, item.evidenceMode])).toEqual([
      ['Student Task', 'ACTIVITY_EVIDENCE', 'COMPLETION'],
      ['Guided support', 'CONSTRUCTED_RESPONSE', 'SUPPORTED'],
      ['Independent evidence', 'CONSTRUCTED_RESPONSE', 'INDEPENDENT'],
    ])
    expect(responses.every((item) => item.lessonRef === G5_ELA_RESPONSE_FIXTURE.lessonRef && item.sectionRef && item.itemRef)).toBe(true)
  })

  it('reconstructs flattened production choices as radio-ready choices without polluting the prompt', () => {
    const material: LearnerMaterialDto = {
      lessonRef: 'ma-g3-mathematics-u02-l01', title: 'Choice fixture', format: 'structured',
      sections: [{ title: 'Independent practice', prompts: ['What is 7 + 5?\nChoices: 10 · 11 · 12 · 13'] }],
    }
    const item = mapLearnerMaterialToStudySegments(material).segments[1]!.items[0]!
    expect(item.responseType).toBe('CHOICE')
    expect(item.prompt).toBe('What is 7 + 5?')
    expect(item.choices.map((choice) => choice.label)).toEqual(['10', '11', '12', '13'])
    expect(new Set(item.choices.map((choice) => choice.choiceRef)).size).toBe(4)
  })

  it('never accepts explicit NONE for an independent answerable item', () => {
    const material: LearnerMaterialDto = {
      lessonRef: 'lesson:none-regression', title: 'None regression', format: 'structured',
      sections: [{ sectionRef: 'independent', title: 'Independent practice', items: [{ itemRef: 'item:answerable', prompt: 'Explain.', responseType: 'NONE' }] }],
    }
    expect(mapLearnerMaterialToStudySegments(material).segments[1]!.items[0]!.responseType).toBe('CONSTRUCTED_RESPONSE')
  })

  it('provides activity evidence for markdown science and structured arts without inventing correctness', () => {
    for (const material of [SCIENCE_MARKDOWN_RESPONSE_FIXTURE, ARTS_ACTIVITY_RESPONSE_FIXTURE]) {
      const lesson = mapLearnerMaterialToStudySegments(material)
      expect(lesson.segments[1]!.items.some((item) => item.responseType === 'ACTIVITY_EVIDENCE')).toBe(true)
      expect(JSON.stringify(lesson)).not.toMatch(/correct|incorrect|answer.?key/i)
    }
  })

  it('fails closed on duplicate section or item identity', () => {
    expect(() => mapLearnerMaterialToStudySegments({
      lessonRef: 'lesson:duplicate', title: 'Duplicate', format: 'structured', sections: [
        { sectionRef: 'same', title: 'Independent practice', items: [{ itemRef: 'same:item', prompt: 'One' }] },
        { sectionRef: 'same', title: 'Mastery check', items: [{ itemRef: 'same:item', prompt: 'Two' }] },
      ],
    })).toThrow(/sectionRef values must be unique/)
  })
})
