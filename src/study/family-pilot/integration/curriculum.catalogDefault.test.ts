import { describe, expect, it } from 'vitest'
import { loadFamilyPilotCatalog } from '../../../curriculum/family-pilot/source.browser'
import { catalogCurriculumPort, hostLessonCurriculumPort } from './curriculum'

// FAMILY-PILOT-INTEGRATION: proves the port IntegratedPilotSurface now
// defaults to (catalogCurriculumPort(loadFamilyPilotCatalog())) exposes the
// real, reviewed Grade 5 Unit 1 catalog — not the synthetic
// hostLessonCurriculumPort placeholder, and not the rest of the mathematics
// course or another grade's course.

describe('catalogCurriculumPort — Family Pilot default browser curriculum', () => {
  const catalog = loadFamilyPilotCatalog()
  const port = catalogCurriculumPort(catalog)

  it('exposes exactly the 18 reviewed Unit 1 lessons for grade 5, in course order', () => {
    const lessons = port.listLessons('5')
    expect(lessons).toHaveLength(18)
    for (const lesson of lessons) {
      expect(lesson.lessonRef).toMatch(/^ma-g5-mathematics-u01-l\d{2}$/)
      expect(lesson.kind).toBe('math')
    }
    expect(lessons[0].lessonRef).toBe('ma-g5-mathematics-u01-l01')
    expect(lessons.at(-1)?.lessonRef).toBe('ma-g5-mathematics-u01-l18')
  })

  it('never substitutes grade 7 or grade 8 content for the pilot default', () => {
    expect(port.listLessons('7')).toEqual([])
    expect(port.listLessons('8')).toEqual([])
  })

  it('serves real catalog lesson titles, not the synthetic host-lesson placeholder shape', () => {
    const [synthetic] = hostLessonCurriculumPort(1).listLessons('5')
    expect(synthetic.title).toBe('Grade 5 math · lesson 1')

    const real = port.listLessons('5')
    for (const lesson of real) {
      expect(lesson.title).not.toMatch(/^Grade 5 math · lesson \d+$/)
    }
  })
})
