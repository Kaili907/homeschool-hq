import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HEALTH_LESSON_TYPES,
  HEALTH_PRODUCTION_DEPTH_VERSION,
  auditHealthProductionDepth,
} from '../src/lib/healthProductionDepth.mjs'
import { scanDocument } from '../src/lib/privacyScan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const ANCHOR = 'ma-g5-health-u01-l01'
const ANCHOR_HASHES = {
  package: 'e4c4ea53acfed33e96088355ae2faed6c90a949d5f1b69021fa7399a7e469be6',
  guide: '5a50bdfcf42b2fdd3de4523995174797fa3960ffcc3e6a08b7a038a273507084',
}

function lessonDocuments(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('grade-'))
    .flatMap((entry) => readdirSync(resolve(root, entry.name))
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(resolve(root, entry.name, name), 'utf8'))))
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function freshCheck(pkg) {
  return pkg.lessonExperience.freshMasteryCheck ?? pkg.lessonExperience.freshConceptCheck
}

function exercise(pkg, guide) {
  const experience = pkg.lessonExperience
  assert.ok(experience.explanation.paragraphs.length >= 3, `${pkg.lessonId} explanation`)
  assert.ok(experience.vocabulary.terms.length >= 3, `${pkg.lessonId} vocabulary`)
  assert.ok(experience.modelExample.situation, `${pkg.lessonId} model`)
  assert.ok(experience.guidedReasoning.turnOne.length, `${pkg.lessonId} guided`)
  assert.ok(experience.independentEvidence.directions.length, `${pkg.lessonId} independent`)
  assert.ok(freshCheck(pkg).situation, `${pkg.lessonId} fresh mastery`)
  assert.notEqual(experience.remediation.alternateExplanation, experience.explanation.paragraphs.join(' '), `${pkg.lessonId} alternate remediation`)
  assert.ok(experience.remediation.freshRetry.situation, `${pkg.lessonId} fresh retry`)
  assert.equal(pkg.reflectionPolicy.contributesToMastery, false, `${pkg.lessonId} learner reflection boundary`)
  assert.equal(guide.masteryPlan.minimumEvidenceOccasions, 2, `${pkg.lessonId} mastery occasions`)
  assert.equal(guide.masteryPlan.privateReflectionContributes, false, `${pkg.lessonId} adult reflection boundary`)
  assert.ok(guide.protectedAuthority.independentEvidence.requiredFacts.length >= 2, `${pkg.lessonId} fact authority`)
  assert.ok(guide.protectedAuthority.misconceptionBoundaries.length >= 3, `${pkg.lessonId} misconception authority`)
  assert.match(guide.guardianSafetyReview.boundary, /do not diagnose/i, `${pkg.lessonId} diagnosis boundary`)
}

const packages = lessonDocuments(resolve(ROOT, 'packages/health'))
const guides = lessonDocuments(resolve(ROOT, 'scoring-guides/health'))
const guideById = new Map(guides.map((guide) => [guide.lessonId, guide]))

test('all 324 Health lessons and paired adult guides meet production depth', () => {
  const audit = auditHealthProductionDepth(packages, guides)
  assert.equal(audit.lessonsAudited, 324)
  assert.equal(audit.guidesAudited, 324)
  assert.deepEqual(audit.issues, [])
  assert.deepEqual(Object.keys(audit.grades).map(Number).sort((a, b) => a - b), GRADES)
  assert.ok(Object.values(audit.grades).every((count) => count === 36))
})

test('exercises a complete learner/adult pair from every supported grade', () => {
  for (const grade of GRADES) {
    const representative = packages.find((pkg) => pkg.grade === grade && pkg.lessonId !== ANCHOR)
      ?? packages.find((pkg) => pkg.grade === grade)
    assert.ok(representative, `grade ${grade} representative`)
    exercise(representative, guideById.get(representative.lessonId))
  }
})

test('exercises a complete learner/adult pair from every Health lesson type', () => {
  for (const lessonType of HEALTH_LESSON_TYPES) {
    const representative = packages.find((pkg) => pkg.primaryLessonType === lessonType)
    assert.ok(representative, `${lessonType} representative`)
    exercise(representative, guideById.get(representative.lessonId))
  }
})

test('uses short one-action directions in Grades 3-5 and chunked complexity later', () => {
  for (const pkg of packages.filter((item) => item.grade <= 5 && item.lessonExperience.experienceVersion === HEALTH_PRODUCTION_DEPTH_VERSION)) {
    for (const direction of pkg.lessonExperience.independentEvidence.directions) {
      assert.ok(direction.trim().split(/\s+/).length <= 18, `${pkg.lessonId} direction too long: ${direction}`)
    }
    assert.ok(pkg.lessonExperience.independentEvidence.directions.length >= 4)
  }
  for (const pkg of packages.filter((item) => item.grade >= 7)) {
    assert.ok(pkg.lessonExperience.independentEvidence.directions.length >= 3, `${pkg.lessonId} chunking`)
    assert.match(pkg.lessonExperience.independentEvidence.independenceBoundary, /may not choose|may not supply/i, `${pkg.lessonId} independence boundary`)
  }
})

test('keeps answer authority out of learner packages and privacy scans clean', () => {
  const forbidden = ['protectedAuthority', 'answerAuthority', 'scoringGuidance', 'masteryPlan']
  for (const pkg of packages) {
    for (const key of forbidden) assert.equal(Object.hasOwn(pkg, key), false, `${pkg.lessonId} leaked ${key}`)
    assert.deepEqual(scanDocument(pkg, pkg.lessonId), [])
    assert.deepEqual(scanDocument(guideById.get(pkg.lessonId), `${pkg.lessonId}-guide`), [])
  }
})

test('byte-preserves the Director-approved Grade 5 anchor', () => {
  assert.equal(sha256(resolve(ROOT, 'packages/health/grade-05', `${ANCHOR}.json`)), ANCHOR_HASHES.package)
  assert.equal(sha256(resolve(ROOT, 'scoring-guides/health/grade-05', `${ANCHOR}.json`)), ANCHOR_HASHES.guide)
})
