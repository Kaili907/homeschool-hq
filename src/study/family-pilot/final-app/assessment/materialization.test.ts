import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

describe('canonical assessment materialization', () => {
  const manifest = readJson('curriculum-production/final/assessments/manifest.json')

  it('materializes every admitted assessment and leaves no structural-only record', () => {
    const admitted = readJson('curriculum-release-admitted/family-pilot-r1/assessment-bindings.json')
    expect(admitted).toHaveLength(699)
    expect(manifest.assessments).toHaveLength(699)
    expect(new Set(manifest.assessments.map((row: { assessmentRef: string }) => row.assessmentRef)).size).toBe(699)
    expect(manifest.totals.materialized).toBe(699)
    expect(manifest.totals.structuralOnlyRemaining).toBe(0)
    expect(manifest.totals.answerLeaks).toBe(0)
  })

  it('preserves the admitted subject distribution and subject-appropriate response modes', () => {
    expect(manifest.totals.bySubject).toEqual({
      'arts-and-music': 54,
      'english-language-arts': 90,
      'financial-literacy': 59,
      'health': 54,
      'mathematics': 91,
      'physical-education': 81,
      'ready-for-life': 54,
      'science': 81,
      'social-studies': 81,
      'technology': 54,
    })
    const modes = new Map(manifest.assessments.map((row: { subject: string; responseMode: string }) => [row.subject, row.responseMode]))
    expect(modes.get('english-language-arts')).toMatch(/written/)
    expect(modes.get('science')).toMatch(/investigation/)
    expect(modes.get('social-studies')).toMatch(/source/)
    expect(modes.get('technology')).toMatch(/project/)
    expect(modes.get('arts-and-music')).toMatch(/performance/)
  })

  it('keeps every adult authority in a separate restricted artifact', () => {
    for (const row of manifest.assessments) {
      const learner = readJson(row.packageRef)
      const adult = readJson(row.adultAuthorityRef)
      expect(learner.adultScoringAuthorityRef).toBe(`restricted:${row.adultAuthorityRef}`)
      expect(adult.assessmentRef).toBe(learner.assessmentRef)
      expect(adult.rubricDimensions.length).toBeGreaterThan(0)
      expect(learner.productionReadiness).toMatchObject({
        status: 'READY', structuralOnly: false, answerMaterialIncluded: false,
      })
    }
  })
})
