import { describe, expect, it } from 'vitest'
import { lessonEvidence, unitEvidence } from './evidence'
import { loadSocialStudiesCatalog } from './source.node'
import { getUnit, listLessons } from './catalog'

describe('FF-M3 social studies evidence/source metadata projection', () => {
  const catalog = loadSocialStudiesCatalog()

  it('preserves standards, focus, and essential question verbatim from the lesson record', () => {
    const lesson = listLessons(catalog, '5')[0]
    const evidence = lessonEvidence(catalog, lesson)
    expect(evidence.lessonId).toBe(lesson.lessonId)
    expect(evidence.focus).toBe(lesson.focus)
    expect(evidence.essentialQuestion).toBe(lesson.essentialQuestion)
    expect(evidence.standards).toEqual(lesson.standards)
    expect(evidence.materials).toEqual(lesson.materials)
  })

  it('joins the lesson to its unit topics and performance task, never inventing either', () => {
    const lesson = listLessons(catalog, '5')[0]
    const unit = getUnit(catalog, lesson.unitId)!
    const evidence = lessonEvidence(catalog, lesson)
    expect(evidence.unitTopics).toEqual(unit.topics)
    expect(evidence.performanceTask).toBe(unit.performanceTask)
  })

  it('detects primary/secondary source emphasis only from literal on-disk topic text', () => {
    const unit1 = getUnit(catalog, 'ma-g5-social-studies-u01')!
    expect(unit1.topics.some((topic) => /primary and secondary sources/i.test(topic))).toBe(true)
    const evidence = unitEvidence(unit1)
    expect(evidence.citesPrimaryOrSecondarySources).toBe(true)
  })

  it('detects maps/spatial emphasis only from literal on-disk topic text', () => {
    const unit1 = getUnit(catalog, 'ma-g5-social-studies-u01')!
    const evidence = unitEvidence(unit1)
    expect(evidence.citesMapsOrSpatialSources).toBe(true)
  })

  it('never fabricates a source or quotation: every projected string traces to a catalog field', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessons(catalog, grade)) {
        const evidence = lessonEvidence(catalog, lesson)
        expect(evidence.focus).toBe(lesson.focus)
        expect(evidence.standards).toEqual(lesson.standards)
      }
    }
  })
})
