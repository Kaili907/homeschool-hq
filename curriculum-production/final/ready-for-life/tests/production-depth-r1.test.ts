import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORPUS_ROOT, SUPPORTED_GRADES, loadCorpusEntries, validateCorpus } from '../scripts/corpus.mjs'
import { APPROVED_ANCHOR_ID, LOCAL_AUTHORITY, PRODUCTION_DEPTH_VERSION, buildProductionDepthReport, validateProductionDepth } from '../scripts/production-depth.mjs'

describe('Ready for Life production-depth R1', () => {
  const entries = loadCorpusEntries()

  it('rebuilds every canonical lesson with complete delivered materials and instruction', () => {
    const report = buildProductionDepthReport(entries)

    expect(entries).toHaveLength(324)
    expect(report.status).toBe('PASS')
    expect(report.lessonsBefore).toBe(324)
    expect(report.lessonsAfter).toBe(324)
    expect(report.lessonsRebuilt).toBe(324)
    expect(report.coverage).toEqual({
      materialCompleteness: 324,
      models: 324,
      guided: 324,
      independent: 324,
      retry: 324,
      safety: 324,
      privacy: 324,
      guardianBoundary: 324,
    })
    expect(entries.flatMap(validateProductionDepth)).toEqual([])
    expect(validateCorpus(entries)).toEqual([])
  })

  it('exercises every canonical grade and major practical-skill family', () => {
    const representative = buildProductionDepthReport(entries).representativeCoverage

    expect(representative.lessonCount).toBe(54)
    expect(representative.grades).toEqual(SUPPORTED_GRADES)
    expect(representative.families).toEqual([
      'capstone-integration',
      'career-work',
      'civic-public-systems',
      'clothing-laundry',
      'communication-relationships',
      'digital-consumer',
      'food-kitchen',
      'health-self-management',
      'home-care',
      'housing-independent-living',
      'planning-organization',
      'transportation-community',
    ])
    expect(representative.lessons.every((lesson) => lesson.status === 'PASS')).toBe(true)
  })

  it('preserves Spot, Stop, Ask as the approved production anchor', () => {
    const anchor = entries.find((entry) => entry.pkg.lessonRef.lessonId === APPROVED_ANCHOR_ID)

    expect(anchor?.pkg.lessonRef.title).toBe('Spot, Stop, Ask: A Safe-Space Check')
    expect(anchor?.pkg.productionDepth.authorityBasis).toBe(LOCAL_AUTHORITY)
    expect(anchor?.pkg.productionDepth.approvedAnchor).toMatchObject({ preserved: true, approvedLessonId: APPROVED_ANCHOR_ID })
    expect(anchor?.pkg.productionDepth.independentTask.simulationRoute.scenes).toHaveLength(6)
    expect(anchor?.pkg.productionDepth.independentTask.simulationRoute.completionAuthority).toBe('learner')
    expect(anchor?.pkg.productionDepth.independentTask.realRoute.completionAuthority).toBe('guardian')
    expect(anchor?.pkg.productionDepth.retry.parallelReattempt).toContain('dry, unbroken cord')
  })

  it('uses the local-composition schema and never attaches state authority', () => {
    const schema = JSON.parse(readFileSync(join(CORPUS_ROOT, 'schemas/task-sheet.schema.json'), 'utf8'))

    expect(schema.required).toContain('productionDepth')
    expect(schema.properties.productionDepth.properties.version.const).toBe(PRODUCTION_DEPTH_VERSION)
    expect(schema.properties.productionDepth.properties.authorityBasis.const).toBe(LOCAL_AUTHORITY)
    expect(entries.every((entry) => entry.pkg.productionDepth.authorityBasis === LOCAL_AUTHORITY)).toBe(true)
    expect(entries.flatMap((entry) => entry.pkg.standardsRefs).some((reference) => /michigan|state standards?|state authority/i.test(reference))).toBe(false)
  })

  it('keeps physical certification outside Tutor and learner self-report', () => {
    const guardianLessons = entries.filter((entry) => entry.pkg.completionAuthority === 'guardian')

    expect(guardianLessons).toHaveLength(81)
    for (const entry of guardianLessons) {
      expect(entry.pkg.productionDepth.guardianInvolvement.requiredForPhysicalRoute).toBe(true)
      expect(entry.pkg.productionDepth.guardianInvolvement.requiredForSimulationRoute).toBe(false)
      expect(entry.pkg.productionDepth.independentTask.simulationRoute.completionAuthority).toBe('learner')
      expect(entry.pkg.productionDepth.tutorBoundary.physicalCompletionRule).toMatch(/may not certify|cannot.*certify/i)
    }
  })
})
