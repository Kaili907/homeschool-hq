import { describe, expect, it } from 'vitest'
import { getScienceLesson, listScienceLessons } from './catalog'
import { loadScienceCatalog } from './source.node'
import { getScienceTutorCapability } from './tutorCapability'

describe('FAMILY-PILOT-SCIENCE-1 getScienceTutorCapability', () => {
  const catalog = loadScienceCatalog()
  const lesson = getScienceLesson(catalog, '5', listScienceLessons(catalog, '5')[0].lessonId)!

  it('always resolves to the static fallback path — Tutor Core covers math only', () => {
    const capability = getScienceTutorCapability(lesson)
    expect(capability.path).toBe('static-fallback')
    expect(capability.reason.length).toBeGreaterThan(0)
  })

  it('static operation is always available, independent of grade or media settings', () => {
    for (const grade of [5, 7, 8]) {
      const capability = getScienceTutorCapability(lesson, { grade, noAudio: true, mediaAvailable: false })
      expect(capability.staticOperationAvailable).toBe(true)
      expect(capability.path).toBe('static-fallback')
      expect(capability.staticHelpMessage.length).toBeGreaterThan(0)
    }
  })

  it('carries the lessonId it was asked about', () => {
    const capability = getScienceTutorCapability(lesson)
    expect(capability.lessonId).toBe(lesson.lessonId)
  })

  it('is deterministic for the same lesson and options', () => {
    const first = getScienceTutorCapability(lesson, { grade: 5 })
    const second = getScienceTutorCapability(lesson, { grade: 5 })
    expect(second).toEqual(first)
  })

  it('resolves every lesson across every grade to a usable static fallback', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const ref of listScienceLessons(catalog, grade)) {
        const detail = getScienceLesson(catalog, grade, ref.lessonId)!
        const capability = getScienceTutorCapability(detail)
        expect(capability.path).toBe('static-fallback')
        expect(capability.staticOperationAvailable).toBe(true)
      }
    }
  })
})
