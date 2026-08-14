import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildFinancialLiteracyDirectorSampleR1Scoring,
  computeFictionalStatementInCents,
  recomputeFinancialLiteracyDirectorSampleR1Item,
} from '../curriculum-production/final/financial-literacy/samples/grade-08/financial-literacy-director-sample-r1-authority.mjs'
import { isFinancialLiteracyDirectorPreviewPath } from '../src/study/family-pilot/financial-literacy-director-preview/route'

const SAMPLE_REVISION = 'FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1'
const LESSON_ID = 'ma-g8-financial-literacy-u04-l03'
const sourcePath = new URL(
  '../curriculum-production/final/financial-literacy/samples/grade-08/swk-fl-g8-u04-l03.sample.package.json',
  import.meta.url,
)
const packagePath = new URL(
  '../curriculum-production/final/financial-literacy/packages/grade-08/swk-fl-g8-u04-l03.package.json',
  import.meta.url,
)
const scoringPath = new URL(
  '../curriculum-production/final/financial-literacy/scoring/grade-08/swk-fl-g8-u04-l03.scoring.json',
  import.meta.url,
)
const standardPath = new URL(
  '../docs/curriculum-quality/financial-literacy/FINANCIAL_LITERACY_LESSON_STANDARD_R1.md',
  import.meta.url,
)
const componentPath = new URL(
  '../src/study/family-pilot/financial-literacy-director-preview/FinancialLiteracyDirectorPreview.tsx',
  import.meta.url,
)
const sourcePackage = JSON.parse(readFileSync(sourcePath, 'utf8'))
const learnerPackage = JSON.parse(readFileSync(packagePath, 'utf8'))
const adultScoring = JSON.parse(readFileSync(scoringPath, 'utf8'))

function walkKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const child of value) walkKeys(child, keys)
    return keys
  }
  if (!value || typeof value !== 'object') return keys
  for (const [key, child] of Object.entries(value)) {
    keys.push(key)
    walkKeys(child, keys)
  }
  return keys
}

describe('Financial Literacy Director Sample R1', () => {
  it('preserves the exact lesson identity and declares the two-axis standard metadata', () => {
    expect(learnerPackage.sampleRevision).toBe(SAMPLE_REVISION)
    expect(learnerPackage.lessonRef.lessonId).toBe(LESSON_ID)
    expect(learnerPackage.lessonRef.grade).toBe(8)
    expect(learnerPackage.lessonRef.title).toBe('Guided practice A: credit cards and minimum payments')
    expect(learnerPackage.standardsRefs).toEqual(['PF4', 'PF4.1'])
    expect(learnerPackage.financialFocus).toEqual({
      primary: 'CREDIT_BORROWING',
      secondary: ['INTEREST', 'DECISION_SCENARIO'],
    })
    expect(learnerPackage.instructionalProfile).toBe('GUIDED_APPLICATION')
  })

  it('contains the complete deep lesson sequence with fading support and fresh cases', () => {
    expect(learnerPackage.conceptExplanation.paragraphs.length).toBeGreaterThanOrEqual(3)
    expect(learnerPackage.workedExamples).toHaveLength(1)
    expect(learnerPackage.tasks.map((task) => task.kind)).toEqual([
      'comprehension-check',
      'guided',
      'independent',
      'independent-decision',
      'mastery',
      'remediation-guided',
      'remediation-retry',
    ])
    expect(learnerPackage.tasks.flatMap((task) => task.prompts)).toHaveLength(20)
    expect(learnerPackage.tasks.find((task) => task.kind === 'guided').fade).toMatch(/cues end/i)
    expect(learnerPackage.tasks.find((task) => task.kind === 'independent').independenceBoundary).toMatch(/No step cues/i)
    expect(learnerPackage.tasks.find((task) => task.kind === 'mastery').evidencePurpose).toMatch(/Fresh evidence/i)
    expect(learnerPackage.remediationRoutes).toHaveLength(2)
    expect(learnerPackage.remediationRoutes[0].guidedRetryTaskRef).toBe('t6')
    expect(learnerPackage.remediationRoutes[0].freshRetryTaskRef).toBe('t7')

    const workedText = JSON.stringify(learnerPackage.workedExamples)
    const independentText = JSON.stringify(learnerPackage.tasks.filter((task) => ['independent', 'independent-decision'].includes(task.kind)))
    const masteryText = JSON.stringify(learnerPackage.tasks.find((task) => task.kind === 'mastery'))
    expect(workedText).toContain('Jordan')
    expect(independentText).toContain('Ari')
    expect(masteryText).toContain('Taylor')
    expect(independentText).not.toContain('$800.00')
    expect(masteryText).not.toContain('$800.00')
  })

  it('uses an explicit exact-cent borrowing contract everywhere', () => {
    expect(learnerPackage.calculationPolicy).toMatchObject({
      currency: 'USD',
      moneyRepresentation: 'integer-cents',
      rateRepresentation: 'integer-basis-points',
      rateMeaning: 'invented monthly periodic rate, not an annual percentage rate',
    })
    expect(learnerPackage.calculationPolicy.rounding).toMatch(/nearest cent using half-up/i)
    expect(learnerPackage.calculationPolicy.statementTiming).toMatch(/Interest posts first/i)

    expect(computeFictionalStatementInCents({
      startingBalanceCents: 97550,
      monthlyRateBps: 160,
      paymentCents: 4500,
    })).toEqual({
      startingBalanceCents: 97550,
      monthlyRateBps: 160,
      paymentCents: 4500,
      interestNumerator: 15608000,
      interestCents: 1561,
      principalReductionCents: 2939,
      endingBalanceCents: 94611,
    })
    expect(computeFictionalStatementInCents({
      startingBalanceCents: 114025,
      monthlyRateBps: 140,
      paymentCents: 5000,
    }).interestCents).toBe(1596)
  })

  it('aligns every fixed learner prompt to separately generated adult authority', () => {
    const generatedScoring = buildFinancialLiteracyDirectorSampleR1Scoring(sourcePackage)
    const fixedPrompts = learnerPackage.responseScoring.items.filter((item) => item.responseMode === 'FIXED')
    const openPrompts = learnerPackage.responseScoring.items.filter((item) => item.responseMode === 'OPEN')
    expect(fixedPrompts).toHaveLength(17)
    expect(openPrompts).toHaveLength(3)
    expect(adultScoring.adultOnly).toBe(true)
    expect(adultScoring.authorityTag.oracleId).toBe('finlit-director-sample-r1-oracle@1')
    expect(adultScoring.authorityTag.oracleVerdict).toBe('AGREES')
    expect(adultScoring.scoringAuthority.items).toEqual(generatedScoring.scoringAuthority.items)
    expect(adultScoring.scoringAuthority.criteria).toEqual(generatedScoring.scoringAuthority.criteria)
    expect(adultScoring.scoringAuthority.items.map((item) => item.ref)).toEqual(fixedPrompts.map((item) => item.ref))
    for (const item of adultScoring.scoringAuthority.items) {
      expect(recomputeFinancialLiteracyDirectorSampleR1Item(item.ref)).toBe(item.answer)
      expect(item.verification.method).toMatch(/^independent-/)
      if (item.ref !== 't1-p1') {
        expect(Number.isSafeInteger(item.verification.computation.requestedResultCents)).toBe(true)
        expect(item.verification.computation.interestRounding).toBe('nearest-cent-half-up-once')
      }
    }
    const rubricRefs = adultScoring.scoringAuthority.criteria.flatMap((criterion) => criterion.itemRefs)
    expect(rubricRefs).toEqual(openPrompts.map((item) => item.ref))
  })

  it('keeps protected authority out of the learner package and preview bundle', () => {
    const forbiddenKeys = new Set([
      'answer',
      'answerIndex',
      'correctAnswer',
      'expectedAnswer',
      'workedSolution',
      'scoringAuthority',
      'scoringAuthorityRef',
      'scoringRef',
      'teacherGuideRef',
    ])
    expect(walkKeys(learnerPackage).filter((key) => forbiddenKeys.has(key))).toEqual([])
    expect(JSON.stringify(learnerPackage)).not.toMatch(/\/scoring\//i)
    const componentSource = readFileSync(componentPath, 'utf8')
    expect(componentSource).toContain('swk-fl-g8-u04-l03.package.json')
    expect(componentSource).not.toMatch(/scoring|authority\.mjs|recomputeFinancial/i)
  })

  it('uses fictional instructional finances and never solicits household finances', () => {
    const learnerText = JSON.stringify(learnerPackage)
    expect(learnerPackage.isFictionalSimulation).toBe(true)
    expect(learnerPackage.realWorldAction).toBe(false)
    expect(learnerPackage.financialSafety).toEqual({
      fictionalInstructionalFinancesOnly: true,
      neverRequestsRealHouseholdFinances: true,
      neverRequestsRealCredentials: true,
      noIndividualizedAdvice: true,
    })
    expect(learnerText).toMatch(/Do not enter or discuss any real household income/i)
    expect(learnerText).toMatch(/education, not individualized financial/i)
    expect(learnerText).not.toMatch(/(?:enter|write|provide|share|upload|submit) (?:your|a) real (?:income|debt|balance|account|card|credit score)/i)
  })

  it('reconciles only the declared target overlay while preserving the authored sample core', () => {
    for (const field of [
      'lessonRef',
      'objective',
      'conceptExplanation',
      'calculationPolicy',
      'workedExamples',
      'tasks',
      'remediationRoutes',
      'masteryRule',
      'futureTutorManifest',
    ]) {
      expect(learnerPackage[field]).toEqual(sourcePackage[field])
    }
    expect(learnerPackage.productionProvenance).toMatchObject({
      sourceCurriculumUntouched: true,
      sourcePackageCorePreserved: false,
      directorSampleOverlay: { revision: SAMPLE_REVISION },
    })
  })

  it('includes the governing standard and keeps the preview route exact and development-only', () => {
    const standard = readFileSync(standardPath, 'utf8')
    expect(standard).toContain('## 15. Director sample and adoption path')
    expect(standard).toContain(LESSON_ID)
    expect(isFinancialLiteracyDirectorPreviewPath('/__review/financial-literacy', true)).toBe(true)
    expect(isFinancialLiteracyDirectorPreviewPath('/__review/financial-literacy/', true)).toBe(true)
    expect(isFinancialLiteracyDirectorPreviewPath('/__review/financial-literacy', false)).toBe(false)
    expect(isFinancialLiteracyDirectorPreviewPath('/__review/financial-literacy/sample', true)).toBe(false)
    expect(isFinancialLiteracyDirectorPreviewPath('/family-pilot', true)).toBe(false)
  })
})
