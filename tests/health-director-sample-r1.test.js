import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { healthDirectorLesson, HEALTH_DIRECTOR_LESSON_ID } from '../src/study/family-pilot/health-director-preview/lesson'
import { HEALTH_DIRECTOR_REVIEW_PATH, isHealthDirectorReviewPath } from '../src/study/family-pilot/health-director-preview/route'

const packagePath = new URL('../curriculum-production/final/health-physical-education/packages/health/grade-05/ma-g5-health-u01-l01.json', import.meta.url)
const scoringPath = new URL('../curriculum-production/final/health-physical-education/scoring-guides/health/grade-05/ma-g5-health-u01-l01.json', import.meta.url)
const advisoryPath = new URL('../docs/curriculum-quality/health/director-sample-r1/ma-g5-health-u01-l01.advisory.json', import.meta.url)
const packageDocument = JSON.parse(readFileSync(packagePath, 'utf8'))
const scoring = JSON.parse(readFileSync(scoringPath, 'utf8'))
const advisory = JSON.parse(readFileSync(advisoryPath, 'utf8'))

function jsonFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? jsonFiles(path) : path.endsWith('.json') ? [path] : []
  })
}

describe('Health Director sample R1', () => {
  it('repairs exactly the audit-designated canonical lesson and records its identity', () => {
    expect(HEALTH_DIRECTOR_LESSON_ID).toBe('ma-g5-health-u01-l01')
    expect(healthDirectorLesson.lessonId).toBe(HEALTH_DIRECTOR_LESSON_ID)
    expect(packageDocument.title).toBe('Launch and diagnostic: dimensions of health')
    expect(packageDocument.standards).toEqual([
      'Michigan Health: Core Concepts',
      'Accessing Information',
    ])
    expect(packageDocument.primaryLessonType).toBe('CONCEPT_VOCABULARY')
    expect(packageDocument.secondaryLessonTypes).toEqual(['DECISION_REASONING'])

    const healthPackages = jsonFiles(fileURLToPath(new URL('../curriculum-production/final/health-physical-education/packages/health', import.meta.url)))
      .map((path) => JSON.parse(readFileSync(path, 'utf8')))
    expect(healthPackages.filter((candidate) => candidate.contentProvenance?.sampleVersion === 'health-director-sample-r1'))
      .toEqual([expect.objectContaining({ lessonId: HEALTH_DIRECTOR_LESSON_ID })])
  })

  it('teaches the concept and vocabulary before asking for independent evidence', () => {
    const supply = packageDocument.lessonExperience
    expect(supply.explanation.paragraphs.join(' ')).toMatch(/five dimensions/i)
    expect(supply.explanation.importantDistinction).toMatch(/without proving/i)
    expect(supply.explanation.decisionRule).toMatch(/FACTS:[\s\S]*CONNECT:[\s\S]*CHOOSE:[\s\S]*ASK:/)
    expect(supply.vocabulary.terms.map((term) => term.term)).toEqual([
      'physical health', 'mental health', 'emotional health', 'social health', 'environmental health',
    ])
    expect(supply.vocabulary.terms.every((term) => term.meaning && term.example && term.boundary)).toBe(true)
    expect(supply.vocabularyCheck.items).toHaveLength(3)
  })

  it('shows complete decision reasoning on a separate model and preserves a guided learner turn', () => {
    const { modelExample, guidedReasoning } = packageDocument.lessonExperience
    expect(modelExample.situation).toMatch(/Kai/)
    expect(modelExample.possibleActions.length).toBeGreaterThanOrEqual(2)
    expect(modelExample.thinkingSteps.map((step) => step.label).join(' ')).toMatch(/facts[\s\S]*dimensions[\s\S]*options[\s\S]*Choose/i)
    expect(modelExample.thinkingSteps.map((step) => step.text).join(' ')).toMatch(/teacher/i)
    expect(guidedReasoning.situation).toMatch(/Maya/)
    expect(guidedReasoning.turnOne.length).toBeGreaterThan(0)
    expect(guidedReasoning.cue).not.toMatch(/move into the community room/i)
    expect(guidedReasoning.feedbackMoves.length).toBeGreaterThan(1)
    expect(guidedReasoning.turnTwo).toMatch(/Revise/i)
  })

  it('uses fresh independent, knowledge-check, remediation, and later-transfer evidence', () => {
    const supply = packageDocument.lessonExperience
    expect(supply.independentEvidence.situation).toMatch(/Leah/)
    expect(supply.freshConceptCheck.situation).toMatch(/Omar/)
    expect(supply.remediation.freshRetry.situation).toMatch(/water fountain/i)
    expect(supply.remediation.alternateExplanation).toMatch(/five clear windows/i)
    expect(supply.remediation.alternateExplanation).toMatch(/camera test/i)
    expect(supply.remediation.alternateExplanation).not.toContain(supply.explanation.paragraphs.join(' '))
    expect(packageDocument.lessonExperience.modelExample.situation).not.toBe(supply.independentEvidence.situation)
    expect(packageDocument.lessonExperience.independentEvidence.situation).not.toBe(supply.freshConceptCheck.situation)
    expect(packageDocument.lessonExperience.laterTransfer).toBeDefined()
  })

  it('protects privacy, dignity, adult authority, and subjective reflection', () => {
    expect(packageDocument.privacySafeScenario).toMatch(/fictional/i)
    expect(packageDocument.optionalReflection).toMatchObject({ private: true, graded: false, optional: true })
    expect(packageDocument.reflectionPolicy).toMatchObject({
      mode: 'PRIVATE_OPTIONAL',
      visibleTo: ['LEARNER'],
      scored: false,
      contributesToCompletion: false,
      contributesToMastery: false,
    })
    expect(scoring.masteryRule).toMatch(/Do not mark mastery[\s\S]*private reflection/i)
    expect(scoring.masteryPlan.privateReflectionContributes).toBe(false)
    expect(scoring.reflectionPolicy.subjectiveJudgmentPolicy).toBe('SUBJECTIVE_REFLECTION_NOT_AUTOMATICALLY_RIGHT_OR_WRONG')
    expect(scoring.guardianSafetyReview.boundary).toMatch(/do not diagnose/i)
  })

  it('provides lesson-specific protected authority without leaking it into the learner module', () => {
    expect(scoring.scoringAuthority).toBe('RUBRIC')
    expect(scoring.protectedAuthority.independentEvidence.requiredFacts).toHaveLength(3)
    expect(scoring.protectedAuthority.independentEvidence.dimensionConnections.length).toBeGreaterThanOrEqual(2)
    expect(scoring.protectedAuthority.acceptableVariation.length).toBeGreaterThan(2)
    expect(scoring.protectedAuthority.misconceptionBoundaries.map((item) => item.id)).toEqual(advisory.misconceptionIds)
    expect(scoring.protectedAuthority.safetyCriticalErrors.length).toBeGreaterThan(2)
    expect(scoring.masteryPlan.minimumEvidenceOccasions).toBe(2)

    const lessonModule = readFileSync(new URL('../src/study/family-pilot/health-director-preview/lesson.ts', import.meta.url), 'utf8')
    expect(lessonModule).not.toMatch(/scoring-guides|protectedAuthority|answerAuthority/)
  })

  it('publishes the complete curriculum-only Health advisory contract', () => {
    expect(advisory).toMatchObject({
      contractVersion: 'health-lesson-advisory-r1',
      status: 'DRAFT_ADVISORY',
      subject: 'health',
      lessonId: HEALTH_DIRECTOR_LESSON_ID,
      gradeBand: 'GRADES_3_5',
      primaryLessonType: 'CONCEPT_VOCABULARY',
    })
    expect(advisory.teachingSupply.modelExampleRefs).toHaveLength(1)
    expect(advisory.teachingSupply.decisionScenarioRefs).toHaveLength(3)
    expect(advisory.evidencePlan.answerAuthorityRef).toMatch(/scoring-guides/)
    expect(advisory.remediationPlan.alternateExplanationOrModelRefs.length).toBeGreaterThan(1)
    expect(advisory.masteryPlan).toMatchObject({ minimumEvidenceOccasions: 2, privateReflectionContributes: false })
    expect(advisory.tutorPolicy).toMatchObject({
      scope: 'CURRICULUM_METADATA_ONLY',
      mayDiagnose: false,
      mayOverrideGuardianOrSafetyAuthority: false,
    })
  })

  it('keeps the Director route exact and development-only', () => {
    expect(HEALTH_DIRECTOR_REVIEW_PATH).toBe('/__review/health')
    expect(isHealthDirectorReviewPath(HEALTH_DIRECTOR_REVIEW_PATH, true)).toBe(true)
    expect(isHealthDirectorReviewPath(`${HEALTH_DIRECTOR_REVIEW_PATH}/`, true)).toBe(true)
    expect(isHealthDirectorReviewPath(HEALTH_DIRECTOR_REVIEW_PATH, false)).toBe(false)
    expect(isHealthDirectorReviewPath('/__review/health/extra', true)).toBe(false)
    expect(isHealthDirectorReviewPath('/family-pilot', true)).toBe(false)

    const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    expect(appSource).toMatch(/const HealthDirectorPreview = import\.meta\.env\.DEV/)
    const css = readFileSync(new URL('../src/study/family-pilot/health-director-preview/health-director-preview.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 560px\)/)
    expect(css).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/focus-visible/)
  })
})
