import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LANE_ID, buildH3Manifest } from '../src/gateH3.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { EXPECTED_LESSON_COUNT, SOURCE_SHA } from '../src/sourceIndex.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MANIFEST = join(ROOT, 'gate/h3-manifest.json')

describe('the Production Gate H3 manifest', () => {
  it('is committed and matches what the corpus builds right now', () => {
    expect(existsSync(MANIFEST)).toBe(true)
    const committed = readFileSync(MANIFEST, 'utf-8')
    const rebuilt = `${JSON.stringify(buildH3Manifest(ALL_SPECS), null, 2)}\n`
    expect(committed).toBe(rebuilt)
  })

  it('claims exactly the coverage the corpus has, with nothing missing or invented', () => {
    const m = buildH3Manifest(ALL_SPECS)
    expect(m.laneId).toBe(LANE_ID)
    expect(m.grade).toBe(11)
    expect(m.coverage).toMatchObject({
      expectedSourceLessons: EXPECTED_LESSON_COUNT,
      sourceLessons: EXPECTED_LESSON_COUNT,
      authoredLessons: EXPECTED_LESSON_COUNT,
      missing: [],
      invented: [],
      oneToOne: true,
    })
    expect(m.source.sha).toBe(SOURCE_SHA)
    expect(m.lessons).toHaveLength(EXPECTED_LESSON_COUNT)
  })

  it('reports zero unresolved oracle and validation findings', () => {
    const m = buildH3Manifest(ALL_SPECS)
    expect(m.verification.oracleFindings).toBe(0)
    expect(m.verification.validationFindings).toBe(0)
    expect(m.verification.failsClosed).toBe(true)
  })

  it('reconciles its own totals against the per-lesson rows', () => {
    const m = buildH3Manifest(ALL_SPECS)
    const sum = (k: 'fixedItems' | 'rubricItems' | 'recomputedNumericAnswers' | 'comparisonDerivedChoices' | 'assertedChoices'): number =>
      m.lessons.reduce((n, r) => n + r[k], 0)
    expect(m.counts.fixedItems).toBe(sum('fixedItems'))
    expect(m.counts.rubricItems).toBe(sum('rubricItems'))
    expect(m.counts.questions).toBe(sum('fixedItems') + sum('rubricItems'))
    expect(m.counts.recomputedNumericAnswers).toBe(sum('recomputedNumericAnswers'))
    expect(m.counts.comparisonDerivedChoices).toBe(sum('comparisonDerivedChoices'))
    expect(m.counts.assertedChoices).toBe(sum('assertedChoices'))
    expect(sum('recomputedNumericAnswers') + sum('comparisonDerivedChoices') + sum('assertedChoices'))
      .toBe(m.counts.fixedItems)
    expect(m.counts.taskSheets).toBe(EXPECTED_LESSON_COUNT)
  })

  it('gives every lesson a distinct content digest for both emitted files', () => {
    const m = buildH3Manifest(ALL_SPECS)
    expect(new Set(m.lessons.map((r) => r.taskSheetSha256)).size).toBe(m.lessons.length)
    expect(new Set(m.lessons.map((r) => r.scoringRecordSha256)).size).toBe(m.lessons.length)
    expect(new Set(m.lessons.map((r) => r.packageId)).size).toBe(m.lessons.length)
  })

  it('records the safety boundary the corpus actually holds to', () => {
    const m = buildH3Manifest(ALL_SPECS)
    expect(m.safety).toMatchObject({
      isFictionalSimulation: true,
      realWorldAction: false,
      collectsRealFinancialData: false,
      requestsCredentials: false,
      individualizedInvestmentAdvice: false,
    })
  })
})
