import { describe, expect, it } from 'vitest'
import { adaptHostLessonToStudyPlan } from '../../../curriculumAdapter'
import { getArtsMusicAssignments } from './catalog'
import { artsMusicCurriculumPort } from './curriculumPort'
import { loadArtsMusicCatalog } from './source.node'

describe('ARTS-MUSIC-1 artsMusicCurriculumPort', () => {
  const catalog = loadArtsMusicCatalog()
  const port = artsMusicCurriculumPort(catalog)

  it('lists exactly the catalog assignments for a grade, in completion order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const descriptors = port.listLessons(grade)
      const assignments = getArtsMusicAssignments(catalog, { studentRef: 'x', grade })
      expect(descriptors.length).toBe(assignments.length)
      expect(descriptors.length).toBe(72)
      expect(descriptors.map((d) => d.title)).toEqual(assignments.map((l) => l.title))
    }
  })

  it('grade routing: an unsupported grade lists no lessons', () => {
    expect(port.listLessons('6' as unknown as '5')).toEqual([])
  })

  it('every descriptor resolves through the shared Study adapter as completion-only, subject "other"', () => {
    for (const descriptor of port.listLessons('5')) {
      const plan = adaptHostLessonToStudyPlan(descriptor)
      expect(plan.subject).toBe('other')
      expect(plan.masteryAuthority).toBe('completion-only')
    }
  })

  it('produces stable, opaque lessonRefs safe for the shared Study adapter', () => {
    for (const descriptor of port.listLessons('7')) {
      expect(descriptor.lessonRef).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/)
      expect(descriptor.kind).toBe('parent-created')
    }
  })
})
