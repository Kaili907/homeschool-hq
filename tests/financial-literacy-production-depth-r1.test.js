import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = join(REPO, 'curriculum-production/final/financial-literacy')
const REPORT = JSON.parse(readFileSync(join(ROOT, 'reports/production-depth-r1.json'), 'utf8'))
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'corpus-manifest.json'), 'utf8'))
const ANCHOR_PACKAGE_SHA = '5f9e95fde97059cc81c4eb64040a56d0bdb76294ef0560c5052ef26aef48e279'
const ANCHOR_SCORING_SHA = 'a77fbaa65d944674152ee3fe05fcc2aa0595c4dda8d2ecf98138e2d3af0b4bc6'
const MODEL_EXEMPT = new Set(['DIAGNOSTIC', 'APPLICATION_TRANSFER', 'MASTERY', 'ASSESSMENT'])

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'))
}

function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

describe('Financial Literacy Production Depth R1', () => {
  it('rebuilds the complete admitted corpus through one canonical depth revision', () => {
    expect(REPORT.status).toBe('PASS')
    expect(REPORT.corpus).toMatchObject({
      lessonsBefore: 504,
      lessonsAfter: 504,
      lessonsRebuilt: 504,
      productionDepthOverlays: 503,
      approvedAnchorOverlays: 1,
    })
    expect(MANIFEST.lessons).toHaveLength(504)
    expect(MANIFEST.productionDepth).toMatchObject({
      revision: 'FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1',
      status: 'PASS',
    })
  })

  it('supplies type-aware teaching, transfer, mastery, and remediation contracts', () => {
    for (const lesson of MANIFEST.lessons) {
      const pkg = readJson(lesson.packagePath)
      if (pkg.sampleRevision === 'FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1') continue

      expect(pkg.productionDepthRevision, lesson.lessonId).toBe('FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1')
      expect(pkg.financialFocus?.primary, lesson.lessonId).toBeTruthy()
      expect(pkg.instructionalProfile, lesson.lessonId).toBeTruthy()
      expect(pkg.targetConcepts?.length, lesson.lessonId).toBeGreaterThanOrEqual(3)
      expect(pkg.guidedPracticeContract?.fade, lesson.lessonId).toMatch(/before independent|before protected/i)
      expect(pkg.independentScenarioContract?.independentBoundary, lesson.lessonId).toMatch(/No completed step/i)
      expect(pkg.masteryRule?.evidenceLessonId, lesson.lessonId).toBeTruthy()
      expect(pkg.remediationRoutes?.[0]?.freshMasteryLessonId, lesson.lessonId).toBeTruthy()
      expect(pkg.futureTutorManifest?.dataOnly, lesson.lessonId).toBe(true)
      expect(pkg.futureTutorManifest?.answerPolicy?.revealRestriction, lesson.lessonId).toMatch(/No protected fixed answer/i)

      if (MODEL_EXEMPT.has(pkg.instructionalProfile)) {
        expect(pkg.workedExamples, lesson.lessonId).toEqual([])
        expect(pkg.conceptExplanation.applicability, lesson.lessonId).toBe('PROFILE_BOUNDARY')
        expect(pkg.workedExamplePolicy.modelLessonId, lesson.lessonId).toBeTruthy()
      } else {
        expect(pkg.conceptExplanation.applicability, lesson.lessonId).toBe('REQUIRED_AND_SUPPLIED')
        expect(pkg.conceptExplanation.paragraphs.length, lesson.lessonId).toBeGreaterThanOrEqual(3)
        expect(pkg.workedExamples, lesson.lessonId).toHaveLength(1)
        expect(pkg.workedExamples[0].steps.length, lesson.lessonId).toBeGreaterThanOrEqual(4)
        expect(pkg.workedExamples[0].interpretation, lesson.lessonId).toBeTruthy()
        expect(pkg.workedExamples[0].tradeoff, lesson.lessonId).toBeTruthy()
      }
    }
  })

  it('preserves exact-money authority and exercises arithmetic plus decision evidence in every grade', () => {
    for (const [grade, evidence] of Object.entries(REPORT.representativeGradeEvidence)) {
      expect(evidence.arithmeticLessonId, grade).toBeTruthy()
      expect(evidence.decisionLessonId, grade).toBeTruthy()
      expect(evidence.arithmeticAuthorityVerified, grade).toBe(true)
      expect(evidence.decisionAuthorityVerified, grade).toBe(true)

      const arithmetic = MANIFEST.lessons.find((lesson) => lesson.lessonId === evidence.arithmeticLessonId)
      const arithmeticPackage = readJson(arithmetic.packagePath)
      const arithmeticScoring = readJson(arithmetic.scoringPath)
      expect(arithmeticPackage.responseScoring.items.some((item) => item.responseMode === 'FIXED'), grade).toBe(true)
      expect(arithmeticScoring.productionGateH3.fixedAuthority.present, grade).toBe(true)
      expect(arithmeticScoring.productionGateH3.scoringAuthority.verification.method, grade).not.toBe('UNVERIFIED')
      if (arithmeticPackage.sampleRevision !== 'FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1') {
        expect(arithmeticPackage.calculationPolicy.moneyRepresentation, grade).toBe('integer-cents')
        expect(arithmeticPackage.calculationPolicy.rateRepresentation, grade).toBe('integer-basis-points-or-exact-rational')
        expect(arithmeticPackage.calculationPolicy.verification, grade).toMatch(/Binary floating-point output is never final authority/i)
      }

      const decision = MANIFEST.lessons.find((lesson) => lesson.lessonId === evidence.decisionLessonId)
      const decisionPackage = readJson(decision.packagePath)
      const decisionScoring = readJson(decision.scoringPath)
      expect(decisionPackage.responseScoring.items.some((item) => item.responseMode === 'OPEN'), grade).toBe(true)
      expect(decisionScoring.productionGateH3.rubricAuthority.present, grade).toBe(true)
      expect(decisionScoring.productionGateH3.rubricAuthority.acceptableAnswerCriteriaCount, grade).toBeGreaterThan(0)
    }
  })

  it('keeps all finances fictional and rejects private-data or individualized-advice collection', () => {
    expect(REPORT.privacy).toEqual({
      fictionalLessons: 504,
      privateDataRequestViolations: 0,
      personalizedAdviceViolations: 0,
    })
    for (const lesson of MANIFEST.lessons) {
      const pkg = readJson(lesson.packagePath)
      expect(pkg.isFictionalSimulation, lesson.lessonId).toBe(true)
      expect(pkg.realWorldAction, lesson.lessonId).toBe(false)
      expect(pkg.financialSafety, lesson.lessonId).toMatchObject({
        neverRequestsRealCredentials: true,
        noIndividualizedAdvice: true,
      })
    }
  })

  it('preserves the approved anchor package and scoring artifact byte-for-byte', () => {
    const anchor = MANIFEST.lessons.find((lesson) => lesson.lessonId === 'ma-g8-financial-literacy-u04-l03')
    expect(sha256(anchor.packagePath)).toBe(ANCHOR_PACKAGE_SHA)
    expect(sha256(anchor.scoringPath)).toBe(ANCHOR_SCORING_SHA)
    expect(REPORT.approvedAnchor).toMatchObject({
      lessonId: 'ma-g8-financial-literacy-u04-l03',
      packageSha256: ANCHOR_PACKAGE_SHA,
      scoringSha256: ANCHOR_SCORING_SHA,
    })
  })
})
