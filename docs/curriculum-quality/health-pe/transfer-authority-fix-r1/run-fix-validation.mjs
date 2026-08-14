#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { evaluatePeTransferConsistency } from '../../../../curriculum-production/final/health-physical-education/src/lib/transferConsistency.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const BASE = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'
const SOURCE_BASE = 'e39e2b343c41a1a800825651159e0e962d5288d7'
const REVIEW = resolve(ROOT, 'docs/curriculum-quality/health-pe/transfer-authority-review-r1/findings.jsonl')
const BINDINGS = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) => readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse)
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const show = (spec) => execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const showJson = (spec) => JSON.parse(show(spec))

function semanticInput(sourceLesson, pkg, guide) {
  return {
    sourceLesson,
    learnerTask: pkg.studentTask,
    completionCriteria: pkg.completionCriteria,
    equipmentAlternative: pkg.equipmentRequirements?.equalCreditNoEquipment,
    accessibleAdaptation: pkg.accessibleAdaptation,
    activitySteps: pkg.activitySteps,
    adultSuccessCriteria: guide.successCriteria,
    adultScoringGuidance: guide.scoringGuidance,
    adultAdaptiveRoutes: guide.adaptiveRoutes,
    adultSafetyAndPrivacy: guide.safetyAndPrivacyNotes,
    guardianSafetyReview: guide.guardianSafetyReview,
  }
}

function falsePositiveSnapshot(pkg, guide) {
  return {
    learnerTask: pkg.studentTask,
    completionCriteria: pkg.completionCriteria,
    equalCreditNoEquipment: pkg.equipmentRequirements?.equalCreditNoEquipment,
    accessibleAdaptation: pkg.accessibleAdaptation,
    activitySteps: pkg.activitySteps,
    successCriteria: guide.successCriteria,
    scoringGuidance: guide.scoringGuidance,
    adaptiveRoutes: guide.adaptiveRoutes,
    guardianSafetyReview: guide.guardianSafetyReview,
    safetyAndPrivacyNotes: guide.safetyAndPrivacyNotes,
  }
}

function safetySnapshot(pkg, guide) {
  return {
    safetyRules: pkg.safetyRules,
    stoppingRules: pkg.stoppingRules,
    neverRequires: pkg.neverRequires,
    guardianSafetyReview: guide.guardianSafetyReview,
    safetyAndPrivacyNotes: guide.safetyAndPrivacyNotes,
  }
}

const originalReview = readJsonl(REVIEW)
const bindings = new Map(readJsonl(BINDINGS).map((binding) => [binding.lessonRef, binding]))
const beforeSources = new Map()
const afterSources = new Map()
for (const grade of [9, 10, 11, 12]) {
  const rel = `curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/build/grade-${grade}/courses/physical-education/lessons.jsonl`
  for (const lesson of show(`${SOURCE_BASE}:${rel}`).trim().split('\n').map(JSON.parse)) beforeSources.set(lesson.lesson_id, lesson)
  for (const lesson of readJsonl(resolve(ROOT, rel))) afterSources.set(lesson.lesson_id, lesson)
}

const rows = originalReview.map((review) => {
  const beforePackage = showJson(`${BASE}:${review.taskCardRef}`)
  const beforeGuide = showJson(`${BASE}:${review.scoringGuideRef}`)
  const afterPackagePath = resolve(ROOT, review.taskCardRef)
  const afterGuidePath = resolve(ROOT, review.scoringGuideRef)
  const afterPackage = readJson(afterPackagePath)
  const afterGuide = readJson(afterGuidePath)
  const before = evaluatePeTransferConsistency(semanticInput(beforeSources.get(review.lessonRef), beforePackage, beforeGuide))
  const after = evaluatePeTransferConsistency(semanticInput(afterSources.get(review.lessonRef), afterPackage, afterGuide))
  const falsePositiveSemanticsPreserved = review.classification === 'FALSE_POSITIVE'
    ? JSON.stringify(falsePositiveSnapshot(beforePackage, beforeGuide)) === JSON.stringify(falsePositiveSnapshot(afterPackage, afterGuide))
    : null
  const safetyPreserved = JSON.stringify(safetySnapshot(beforePackage, beforeGuide)) === JSON.stringify(safetySnapshot(afterPackage, afterGuide))
  return {
    lessonRef: review.lessonRef,
    grade: review.grade,
    unitNumber: review.unitNumber,
    originalClassification: review.classification,
    originalSeverity: review.severity,
    beforeSemanticStatus: before.status,
    beforeClassifications: before.classifications,
    beforeCodes: before.findings.map((item) => item.code),
    finalOutcome: review.classification === 'FALSE_POSITIVE' ? 'FALSE_POSITIVE_PRESERVED' : 'REPAIRED',
    afterSemanticStatus: after.status,
    afterClassifications: after.classifications,
    afterCodes: after.findings.map((item) => item.code),
    canonicalTransferEvidenceAuthored: Boolean(afterSources.get(review.lessonRef)?.transfer_evidence_requirement),
    falsePositiveSemanticsPreserved,
    safetyPreserved,
    taskCardRef: review.taskCardRef,
    taskCardSha256Before: review.taskCardSha256,
    taskCardSha256After: sha(afterPackagePath),
    scoringGuideRef: review.scoringGuideRef,
    scoringGuideSha256Before: review.scoringGuideSha256,
    scoringGuideSha256After: sha(afterGuidePath),
  }
})

const count = (predicate) => rows.filter(predicate).length
const summary = {
  validation: 'HIGH-SCHOOL PE TRANSFER AUTHORITY CORRECTION R1',
  status: 'PE_TRANSFER_AUTHORITY_FIX_VALIDATED',
  base: BASE,
  independentReview: '8dd8a9a652d9e3029a09fc6985640d4bd65f6123',
  branch: 'mac/pe-transfer-authority-fix-r1',
  reviewedCases: rows.length,
  before: {
    scoringAuthorityConflicts: count((row) => row.beforeClassifications.includes('SCORING_AUTHORITY_CONFLICT')),
    contentTransferConflicts: count((row) => row.beforeClassifications.includes('CONTENT_TRANSFER_CONFLICT')),
    falsePositives: count((row) => row.beforeSemanticStatus === 'CONSISTENT'),
    totalRealConflicts: count((row) => row.beforeSemanticStatus === 'CONFLICT'),
  },
  after: {
    scoringAuthorityConflicts: count((row) => row.afterClassifications.includes('SCORING_AUTHORITY_CONFLICT')),
    contentTransferConflicts: count((row) => row.afterClassifications.includes('CONTENT_TRANSFER_CONFLICT')),
    totalRealConflicts: count((row) => row.afterSemanticStatus === 'CONFLICT'),
  },
  outcomes: {
    repaired: count((row) => row.finalOutcome === 'REPAIRED' && row.afterSemanticStatus === 'CONSISTENT'),
    falsePositivesPreserved: count((row) => row.finalOutcome === 'FALSE_POSITIVE_PRESERVED' && row.falsePositiveSemanticsPreserved),
    safetyPreserved: count((row) => row.safetyPreserved),
    learnerAuthorityBindingsPreserved: count((row) => bindings.get(row.lessonRef)?.completionAuthority === 'LEARNER_AUTHORITY'),
  },
  canonicalRepair: {
    unitFamiliesChanged: new Set(rows.filter((row) => row.canonicalTransferEvidenceAuthored).map((row) => `${row.grade}:${row.unitNumber}`)).size,
    lessonsChanged: count((row) => row.canonicalTransferEvidenceAuthored),
    sourceBoundary: 'canonical HS PE course-data.mjs plus build-courses.mjs; no emitted lesson/guide was hand-edited',
  },
  semanticGate: {
    implementation: 'curriculum-production/final/health-physical-education/src/lib/transferConsistency.mjs',
    basis: 'actual learner task, authored transfer requirement, equal-credit evidence expectation, completion path, and paired adult RUBRIC authority; no lesson-position predicate',
    negativeControls: ['genuine scoring conflict fails', 'genuine transfer/content mismatch fails', 'reviewed false-positive pattern passes', 'valid equal-credit lesson passes', 'valid authored transfer lesson passes'],
  },
  studyBoundary: 'Completion-based Study progression and LEARNER_AUTHORITY bindings are unchanged; no Study or Tutor V2 file is part of this repair.',
  safety: 'Movement safety, stop/rest authority, accessible activity alternatives, guardian boundaries, privacy, and no-body-scoring policies are preserved.',
}

const expected = {
  reviewedCases: 216,
  scoringBefore: 60,
  contentBefore: 36,
  falsePositivesBefore: 120,
  realBefore: 96,
  scoringAfter: 0,
  contentAfter: 0,
  realAfter: 0,
  repaired: 96,
  falsePositivesPreserved: 120,
  safetyPreserved: 216,
  learnerAuthorityBindingsPreserved: 216,
  unitFamiliesChanged: 16,
  lessonsChanged: 96,
}
const observed = {
  reviewedCases: summary.reviewedCases,
  scoringBefore: summary.before.scoringAuthorityConflicts,
  contentBefore: summary.before.contentTransferConflicts,
  falsePositivesBefore: summary.before.falsePositives,
  realBefore: summary.before.totalRealConflicts,
  scoringAfter: summary.after.scoringAuthorityConflicts,
  contentAfter: summary.after.contentTransferConflicts,
  realAfter: summary.after.totalRealConflicts,
  repaired: summary.outcomes.repaired,
  falsePositivesPreserved: summary.outcomes.falsePositivesPreserved,
  safetyPreserved: summary.outcomes.safetyPreserved,
  learnerAuthorityBindingsPreserved: summary.outcomes.learnerAuthorityBindingsPreserved,
  unitFamiliesChanged: summary.canonicalRepair.unitFamiliesChanged,
  lessonsChanged: summary.canonicalRepair.lessonsChanged,
}
if (JSON.stringify(observed) !== JSON.stringify(expected)) {
  throw new Error(`Fix validation invariant failed.\nExpected: ${JSON.stringify(expected)}\nObserved: ${JSON.stringify(observed)}`)
}

mkdirSync(HERE, { recursive: true })
writeFileSync(resolve(HERE, 'findings.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
writeFileSync(resolve(HERE, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`Validated ${rows.length} reviewed cases.`)
console.log(`Before: scoring=${summary.before.scoringAuthorityConflicts}, content=${summary.before.contentTransferConflicts}, false-positive=${summary.before.falsePositives}.`)
console.log(`After: scoring=${summary.after.scoringAuthorityConflicts}, content=${summary.after.contentTransferConflicts}, total=${summary.after.totalRealConflicts}.`)
console.log(`Preserved: false-positive=${summary.outcomes.falsePositivesPreserved}, safety=${summary.outcomes.safetyPreserved}.`)
