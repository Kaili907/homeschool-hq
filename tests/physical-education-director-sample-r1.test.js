import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { PhysicalEducationDirectorPreview } from '../src/study/family-pilot/physical-education-director-preview/PhysicalEducationDirectorPreview'
import {
  isPhysicalEducationDirectorPreviewPath,
  PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH,
} from '../src/study/family-pilot/physical-education-director-preview/route'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LESSON_REF = 'ma-g12-physical-education-u08-l07'
const CORPUS_ROOT = join(ROOT, 'curriculum-production/final/health-physical-education')
const packagePath = join(CORPUS_ROOT, `packages/physical-education/grade-12/${LESSON_REF}.json`)
const scoringPath = join(CORPUS_ROOT, `scoring-guides/physical-education/grade-12/${LESSON_REF}.json`)
const advisoryPath = join(ROOT, `docs/curriculum-quality/physical-education/sample-r1/${LESSON_REF}.advisory.json`)
const packageSchemaPath = join(CORPUS_ROOT, 'schema/student-task-card.schema.json')
const scoringSchemaPath = join(CORPUS_ROOT, 'schema/scoring-guide.schema.json')
const advisorySchemaPath = join(ROOT, 'docs/curriculum-quality/physical-education/PHYSICAL_EDUCATION_LESSON_ADVISORY_CONTRACT_R1.schema.json')

const lesson = JSON.parse(readFileSync(packagePath, 'utf8'))
const scoring = JSON.parse(readFileSync(scoringPath, 'utf8'))
const advisory = JSON.parse(readFileSync(advisoryPath, 'utf8'))

function walkJson(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) files.push(...walkJson(path))
    else if (path.endsWith('.json')) files.push(path)
  }
  return files
}

function validateJsonSchema(schemaPath, instancePath) {
  const source = [
    'import json, sys',
    'from jsonschema.validators import validator_for',
    'schema = json.load(open(sys.argv[1], encoding="utf-8"))',
    'instance = json.load(open(sys.argv[2], encoding="utf-8"))',
    'Validator = validator_for(schema)',
    'Validator.check_schema(schema)',
    'errors = sorted(Validator(schema).iter_errors(instance), key=lambda error: list(error.absolute_path))',
    'assert not errors, "\\n".join(f"{list(error.absolute_path)}: {error.message}" for error in errors)',
  ].join('\n')
  execFileSync('python3', ['-c', source, schemaPath, instancePath], { stdio: 'pipe' })
}

describe('Physical Education Director sample R1', () => {
  it('repairs exactly the audit-selected lesson while preserving standards and paired authority', () => {
    expect(lesson).toMatchObject({
      lessonId: LESSON_REF,
      grade: 12,
      subject: 'physical-education',
      primaryLessonType: 'SAFETY_STOP_DECISION',
      title: 'The Stop Rule: Act Without Waiting for a Coach',
    })
    expect(lesson.standards).toHaveLength(2)
    expect(lesson.standards).toEqual(scoring.standards)
    expect(scoring.lessonId).toBe(lesson.lessonId)
    expect(scoring.primaryLessonType).toBe(lesson.primaryLessonType)
    const revisedPePackages = walkJson(join(CORPUS_ROOT, 'packages/physical-education'))
      .map((path) => JSON.parse(readFileSync(path, 'utf8')))
      .filter((candidate) => candidate.sourceProvenance?.directorSampleRevision === 'physical-education-director-sample-r1')
    expect(revisedPePackages.map((candidate) => candidate.lessonId)).toEqual([LESSON_REF])
  })

  it('replaces mismatched locomotor cues with a complete warning-sign decision model', () => {
    expect(lesson.executionCategory).toBe('safety-stop-decision')
    expect(lesson.movementCues.map((cue) => cue.split(' — ')[0])).toEqual(['NOTICE', 'PAUSE', 'ACT', 'HOLD'])
    expect(lesson.decisionLanes.map((lane) => lane.label)).toEqual(['REST / ADJUST', 'STOP AND TELL', 'DO NOT RESUME'])
    for (const lane of lesson.decisionLanes) {
      expect(lane.startingPosition.length).toBeGreaterThan(30)
      expect(lane.action.length).toBeGreaterThan(20)
      expect(lane.keyCue.length).toBeGreaterThan(10)
      expect(lane.commonError.length).toBeGreaterThan(20)
      expect(lane.correction.length).toBeGreaterThan(20)
    }
    expect(lesson.decisionModel).toMatchObject({
      title: expect.stringMatching(/Model/i),
      keyCue: 'Environment changed? Stop before solving.',
    })
    expect(lesson.decisionModel.safetyBoundary).toMatch(/does not ask.*recreate.*perform movement.*real stop event/i)
  })

  it('teaches through guided contrast, one-variable progression, and fresh independent application', () => {
    expect(lesson.guidedPractice).toHaveLength(3)
    expect(lesson.guidedPractice.every((attempt) => attempt.support && attempt.feedback)).toBe(true)
    expect(lesson.practiceProgression.map((round) => round.round)).toEqual([1, 2, 3])
    expect(lesson.practiceProgression.every((round) => round.changedVariable && round.successCheck && round.learnerChoice)).toBe(true)
    expect(lesson.independentActivity.scenarios).toHaveLength(4)
    const taughtText = `${lesson.decisionModel.scenario} ${lesson.guidedPractice.map((attempt) => attempt.scenario).join(' ')}`
    for (const scenario of lesson.independentActivity.scenarios) expect(taughtText).not.toContain(scenario.text)
    expect(lesson.studentTask).not.toMatch(/unsupervised|full training block|real stop decision/i)
    expect(lesson.warmUpAndFinishPolicy).toMatchObject({
      applicability: 'NOT_APPLICABLE_NON_MOVEMENT',
      warmUp: null,
      coolDown: null,
    })
    expect(lesson.warmUpAndFinishPolicy.rationale).toMatch(/no movement|non-movement|fictional decision/i)
  })

  it('makes every relevant adaptation runnable, equal-credit, and reason-free', () => {
    expect(Object.keys(lesson.adaptationRoutes)).toEqual([
      'seated', 'supported', 'reducedRange', 'reducedPaceOrDemand', 'mobilityAidCompatible',
      'solo', 'lowSpace', 'noEquipment', 'describedOrDecisionRoute',
    ])
    expect(Object.values(lesson.adaptationRoutes).every((route) => route.length > 45)).toBe(true)
    expect(lesson.accessibleAdaptation).toMatch(/never required.*never affect credit/i)
    expect(lesson.adaptationChoices).toMatch(/without explaining why.*equal credit/i)
    expect(advisory.adaptationPolicy).toMatchObject({
      standardRouteNotRequired: true,
      reasonDisclosureRequired: false,
      adaptationMayBePenalized: false,
    })
  })

  it('separates rest, stop-and-tell, and no-resume while preserving guardian authority', () => {
    expect(lesson.stoppingRules[0]).toMatch(/^REST \/ ADJUST:.*may rest.*resume when comfortable and safe/i)
    expect(lesson.stoppingRules[1]).toMatch(/^STOP AND TELL:.*stop immediately.*trusted adult.*do not continue to test/i)
    expect(lesson.stoppingRules[2]).toMatch(/^DO NOT RESUME:.*authorized guardian or qualified professional/i)
    expect(lesson.guardianAuthority).toMatchObject({
      level: 'GUARDIAN_PERMISSION',
      tutorOrLearnerMaySubstitute: false,
    })
    expect(lesson.guardianAuthority.when).toMatch(/after the complete fictional lesson.*no guardian is required/i)
    expect(lesson.guardianAuthority.confirmationBoundary).toMatch(/does not certify academic mastery.*physical event/i)
    expect(lesson.guardianAuthority.equalCreditAlternative).toMatch(/complete equal-credit lesson/i)
    expect(scoring.guardianSafetyReview.guardian_confirmation_required).toBe(true)
  })

  it('uses type-appropriate mastery and a retry that changes the teaching', () => {
    expect(scoring.masteryRule).toMatch(/at least two occasions separated by time, setting, or meaningful scenario variation/i)
    expect(scoring.masteryRule).toMatch(/reflection.*not mastery|reflection.*cannot|reflection.*not/i)
    expect(lesson.retryPlan).toMatchObject({
      simplerSetup: expect.stringMatching(/three visible lane labels/i),
      differentCue: expect.stringMatching(/two questions/i),
      alternateModel: expect.stringMatching(/contrast two cards/i),
      boundedPractice: expect.stringMatching(/one contrast card/i),
      freshRetry: expect.stringMatching(/new card/i),
      exitCriterion: expect.stringMatching(/Return to the next independent card/i),
    })
    expect(lesson.retryPlan.exitCriterion).toMatch(/safety stop is never recorded as failure/i)
  })

  it('keeps body scoring, sensitive proof, diagnosis, and Tutor authority out of the assessment', () => {
    expect(scoring.scoringGuidance).toMatch(/Do not score body size.*weight.*appearance.*calories.*speed.*fitness norms/i)
    expect(scoring.scoringGuidance).toMatch(/Do not reduce credit for rest.*stopping.*adaptation/i)
    expect(lesson.evidenceExpectations.physicalCompletion).toBe('NOT_CLAIMED')
    expect(lesson.evidenceExpectations.observer).toMatch(/No learner, Tutor, browser, camera, wearable, or self-report certifies physical performance/i)
    expect(lesson.tutorMetadata.scope).toBe('CURRICULUM_METADATA_ONLY')
    const tutorProhibitions = lesson.tutorMetadata.mustNot.join(' ')
    expect(tutorProhibitions).toMatch(/diagnose.*prescribe.*certify/i)
    expect(tutorProhibitions).toMatch(/safe return.*guardian authority/i)
    expect(advisory.tutorPolicy).toMatchObject({
      mayDiagnoseOrPrescribe: false,
      mayClaimUnapprovedObservation: false,
      mayCertifyPhysicalCompletion: false,
      mayOverrideGuardianOrSafetyAuthority: false,
    })
  })

  it('validates the learner package, protected scoring guide, and PE advisory contract against their schemas', () => {
    expect(() => validateJsonSchema(packageSchemaPath, packagePath)).not.toThrow()
    expect(() => validateJsonSchema(scoringSchemaPath, scoringPath)).not.toThrow()
    expect(() => validateJsonSchema(advisorySchemaPath, advisoryPath)).not.toThrow()
  })

  it('renders real lesson data and keeps the Director shortcut exact and development-only', () => {
    expect(PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH).toBe('/__review/physical-education')
    expect(isPhysicalEducationDirectorPreviewPath(PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH, true)).toBe(true)
    expect(isPhysicalEducationDirectorPreviewPath(`${PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH}/`, true)).toBe(true)
    expect(isPhysicalEducationDirectorPreviewPath(PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH, false)).toBe(false)
    expect(isPhysicalEducationDirectorPreviewPath('/__review/physical-education/extra', true)).toBe(false)
    const markup = renderToStaticMarkup(createElement(PhysicalEducationDirectorPreview))
    expect(markup).toContain(lesson.title)
    expect(markup).toContain(lesson.decisionModel.scenario)
    expect(markup).toContain(lesson.independentActivity.scenarios[3].text)
    expect(markup).toContain('Equal credit is built in')
    expect(markup).toContain('Guardian authority is preserved')
    expect(markup).toContain('Physical completion:')
    expect(markup).toContain('NOT CLAIMED')
  })

  it('supplies mobile, keyboard-focus, reduced-motion, and high-contrast presentation rules', () => {
    const css = readFileSync(join(ROOT, 'src/study/family-pilot/physical-education-director-preview/physicalEducationDirectorPreview.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 480px\)/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(css).toMatch(/@media \(prefers-contrast: more\)/)
    expect(css).toMatch(/:focus-visible/)
    const componentSource = readFileSync(join(ROOT, 'src/study/family-pilot/physical-education-director-preview/PhysicalEducationDirectorPreview.tsx'), 'utf8')
    expect(componentSource).not.toMatch(/scoring-guides|protectedDecisionAuthority|scoringGuidance/)
  })
})
