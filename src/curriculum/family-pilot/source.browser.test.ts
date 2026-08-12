import { describe, expect, it } from 'vitest'
import { loadFamilyPilotCatalog } from './source.browser'
import { resolveFamilyPilotUnit } from './pilot-config'

describe('FAMILY-PILOT-CURR-1 loadFamilyPilotCatalog (browser build)', () => {
  const catalog = loadFamilyPilotCatalog()

  it('loads one mathematics course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('mathematics')
      expect(course.courseId).toBe(`ma-g${course.grade}-mathematics`)
      expect(course.title).toBe(`Grade ${course.grade} Mathematics`)
    }
  })

  it('resolves every unit lesson id to a catalog lesson, with no missing lessons', () => {
    for (const course of catalog.courses) {
      const lessonIds = new Set(course.lessons.map((lesson) => lesson.lessonId))
      for (const unit of course.units) {
        for (const lessonId of unit.lessonIds) {
          expect(lessonIds.has(lessonId)).toBe(true)
        }
      }
    }
  })

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadFamilyPilotCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
  })

  it('matches the Node-source catalog exactly (same contract, same content)', async () => {
    const { loadFamilyPilotCatalog: loadNode } = await import('./source.node')
    const nodeCatalog = loadNode()
    expect(catalog.releaseVersion).toBe(nodeCatalog.releaseVersion)
    expect(catalog.courses).toEqual(nodeCatalog.courses)
  })

  it('resolves the configured grade 5 Unit 1 pilot unit, never grade 7 or 8', () => {
    const unit = resolveFamilyPilotUnit(catalog)
    expect(unit.unitId).toBe('ma-g5-mathematics-u01')
    expect(unit.unitNumber).toBe(1)

    const grade5Course = catalog.courses.find((c) => c.grade === '5')!
    expect(grade5Course.units.some((u) => u.unitId === unit.unitId)).toBe(true)

    const otherGradeCourses = catalog.courses.filter((c) => c.grade !== '5')
    for (const course of otherGradeCourses) {
      expect(course.units.some((u) => u.unitId === unit.unitId)).toBe(false)
    }
  })
})
