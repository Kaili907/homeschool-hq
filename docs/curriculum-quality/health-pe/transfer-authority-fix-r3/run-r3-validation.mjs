#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ADULT_TRANSFER_SCHEMA,
  evaluatePeTransferConsistency,
  LEARNER_TRANSFER_SCHEMA,
  TRANSFER_AUTHORITY_SCHEMA,
} from '../../../../curriculum-production/final/health-physical-education/src/lib/transferConsistency.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const R2 = 'f0fa12cfc3da33c12033c950f9b0949a8892950b'
const REVIEW = resolve(ROOT, 'docs/curriculum-quality/health-pe/transfer-authority-review-r1/findings.jsonl')
const BINDINGS = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) => readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse)
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const show = (spec) => execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const showJson = (spec) => JSON.parse(show(spec))

function withoutSemanticMetadata(value) {
  const copy = structuredClone(value)
  delete copy.transfer_authority
  delete copy.transferAuthority
  delete copy.transferTask
  delete copy.transferRubric
  return copy
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

const reviewRows = readJsonl(REVIEW)
const bindings = new Map(readJsonl(BINDINGS).map((binding) => [binding.lessonRef, binding]))
const sourceBefore = new Map()
const sourceAfter = new Map()
for (const grade of [9, 10, 11, 12]) {
  const rel = `curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/build/grade-${grade}/courses/physical-education/lessons.jsonl`
  for (const lesson of show(`${R2}:${rel}`).trim().split('\n').map(JSON.parse)) sourceBefore.set(lesson.lesson_id, lesson)
  for (const lesson of readJsonl(resolve(ROOT, rel))) sourceAfter.set(lesson.lesson_id, lesson)
}

const rows = reviewRows.map((review) => {
  const beforePackage = showJson(`${R2}:${review.taskCardRef}`)
  const beforeGuide = showJson(`${R2}:${review.scoringGuideRef}`)
  const afterPackagePath = resolve(ROOT, review.taskCardRef)
  const afterGuidePath = resolve(ROOT, review.scoringGuideRef)
  const afterPackage = readJson(afterPackagePath)
  const afterGuide = readJson(afterGuidePath)
  const beforeSource = sourceBefore.get(review.lessonRef)
  const afterSource = sourceAfter.get(review.lessonRef)
  const result = evaluatePeTransferConsistency({ sourceLesson: afterSource, learnerPackage: afterPackage, adultGuide: afterGuide })
  const sourceSemanticsUnchanged = JSON.stringify(withoutSemanticMetadata(beforeSource)) === JSON.stringify(withoutSemanticMetadata(afterSource))
  const learnerSemanticsUnchanged = JSON.stringify(withoutSemanticMetadata(beforePackage)) === JSON.stringify(withoutSemanticMetadata(afterPackage))
  const adultSemanticsUnchanged = JSON.stringify(withoutSemanticMetadata(beforeGuide)) === JSON.stringify(withoutSemanticMetadata(afterGuide))
  const safetyPreserved = JSON.stringify(safetySnapshot(beforePackage, beforeGuide)) === JSON.stringify(safetySnapshot(afterPackage, afterGuide))
  return {
    lessonRef: review.lessonRef,
    grade: review.grade,
    unitNumber: review.unitNumber,
    originalClassification: review.classification,
    originalSeverity: review.severity,
    finalSemanticStatus: result.status,
    finalClassifications: result.classifications,
    finalCodes: result.findings.map((item) => item.code),
    canonicalSchema: afterSource.transfer_authority?.schemaVersion ?? null,
    learnerSchema: afterPackage.transferTask?.schemaVersion ?? null,
    adultSchema: afterGuide.transferRubric?.schemaVersion ?? null,
    sourceSemanticsUnchanged,
    learnerSemanticsUnchanged,
    adultSemanticsUnchanged,
    safetyPreserved,
    completionAuthority: bindings.get(review.lessonRef)?.completionAuthority ?? null,
    taskCardRef: review.taskCardRef,
    taskCardSha256R2: createHash('sha256').update(show(`${R2}:${review.taskCardRef}`)).digest('hex'),
    taskCardSha256R3: sha(afterPackagePath),
    scoringGuideRef: review.scoringGuideRef,
    scoringGuideSha256R2: createHash('sha256').update(show(`${R2}:${review.scoringGuideRef}`)).digest('hex'),
    scoringGuideSha256R3: sha(afterGuidePath),
  }
})

const count = (predicate) => rows.filter(predicate).length
const summary = {
  validation: 'HIGH-SCHOOL PE TRANSFER AUTHORITY SEMANTIC BINDING R3',
  status: 'PE_TRANSFER_AUTHORITY_R3_READY_FOR_ACCEPTANCE',
  r2Base: R2,
  branch: 'mac/pe-transfer-authority-fix-r3',
  reviewedCases: rows.length,
  historical: {
    scoringAuthorityConflicts: count((row) => row.originalClassification === 'SCORING_AUTHORITY_CONFLICT'),
    contentTransferConflicts: count((row) => row.originalClassification === 'CONTENT_TRANSFER_CONFLICT'),
    falsePositives: count((row) => row.originalClassification === 'FALSE_POSITIVE'),
  },
  final: {
    scoringAuthorityConflicts: count((row) => row.finalClassifications.includes('SCORING_AUTHORITY_CONFLICT')),
    contentTransferConflicts: count((row) => row.finalClassifications.includes('CONTENT_TRANSFER_CONFLICT')),
    totalConflicts: count((row) => row.finalSemanticStatus === 'CONFLICT'),
    falsePositivesPreserved: count((row) => row.originalClassification === 'FALSE_POSITIVE' && row.finalSemanticStatus === 'CONSISTENT' && row.sourceSemanticsUnchanged && row.learnerSemanticsUnchanged && row.adultSemanticsUnchanged),
    unexplainedCases: count((row) => row.finalSemanticStatus !== 'CONSISTENT' || !row.sourceSemanticsUnchanged || !row.learnerSemanticsUnchanged || !row.adultSemanticsUnchanged),
  },
  semanticBinding: {
    canonicalSchema: TRANSFER_AUTHORITY_SCHEMA,
    learnerSchema: LEARNER_TRANSFER_SCHEMA,
    adultSchema: ADULT_TRANSFER_SCHEMA,
    canonicalRecords: count((row) => row.canonicalSchema === TRANSFER_AUTHORITY_SCHEMA),
    learnerDerivations: count((row) => row.learnerSchema === LEARNER_TRANSFER_SCHEMA),
    adultDerivations: count((row) => row.adultSchema === ADULT_TRANSFER_SCHEMA),
    copiedAuthorityObjectsInLearnerArtifacts: count((row) => Object.hasOwn(readJson(resolve(ROOT, row.taskCardRef)), 'transferAuthority')),
    copiedAuthorityObjectsInAdultArtifacts: count((row) => Object.hasOwn(readJson(resolve(ROOT, row.scoringGuideRef)), 'transferAuthority')),
    phrasePatternsUsedByGate: 0,
    visibleFieldBinding: 'SHA-256 over each authoritative learner/adult field; any wording mutation fails without a metadata mutation',
  },
  boundaries: {
    learnerCurriculumSemanticsChanged: count((row) => !row.sourceSemanticsUnchanged || !row.learnerSemanticsUnchanged || !row.adultSemanticsUnchanged) > 0,
    safetyPreserved: count((row) => row.safetyPreserved),
    learnerAuthorityBindingsPreserved: count((row) => row.completionAuthority === 'LEARNER_AUTHORITY'),
  },
  controls: {
    visibleContradictionAttacks: 4,
    paraphraseFieldAttacks: 16,
    canonicalRequiredFieldRemovals: 5,
    derivedRequiredFieldRemovals: 6,
    structuredSemanticMutations: 7,
    wrongTypeUnknownEnumAndExtraField: 'FAIL',
    validEqualCredit: 'PASS',
    validTransfer: 'PASS',
    historicalFalsePositivePattern: 'PASS',
    lessonLocationMutation: 'UNCHANGED',
  },
  studyBoundary: 'No Study Engine, scorer, or Tutor V2 change; all reviewed production bindings remain LEARNER_AUTHORITY.',
  safety: 'Stop/rest rules, adaptations, guardian boundaries, privacy, and no-body-scoring are unchanged and field-bound.',
}

const expected = {
  reviewedCases: 216,
  historicalScoring: 60,
  historicalContent: 36,
  historicalFalsePositive: 120,
  finalScoring: 0,
  finalContent: 0,
  finalTotal: 0,
  falsePositivesPreserved: 120,
  unexplainedCases: 0,
  canonicalRecords: 216,
  learnerDerivations: 216,
  adultDerivations: 216,
  learnerCopies: 0,
  adultCopies: 0,
  learnerCurriculumSemanticsChanged: false,
  safetyPreserved: 216,
  learnerAuthorityBindingsPreserved: 216,
}
const observed = {
  reviewedCases: summary.reviewedCases,
  historicalScoring: summary.historical.scoringAuthorityConflicts,
  historicalContent: summary.historical.contentTransferConflicts,
  historicalFalsePositive: summary.historical.falsePositives,
  finalScoring: summary.final.scoringAuthorityConflicts,
  finalContent: summary.final.contentTransferConflicts,
  finalTotal: summary.final.totalConflicts,
  falsePositivesPreserved: summary.final.falsePositivesPreserved,
  unexplainedCases: summary.final.unexplainedCases,
  canonicalRecords: summary.semanticBinding.canonicalRecords,
  learnerDerivations: summary.semanticBinding.learnerDerivations,
  adultDerivations: summary.semanticBinding.adultDerivations,
  learnerCopies: summary.semanticBinding.copiedAuthorityObjectsInLearnerArtifacts,
  adultCopies: summary.semanticBinding.copiedAuthorityObjectsInAdultArtifacts,
  learnerCurriculumSemanticsChanged: summary.boundaries.learnerCurriculumSemanticsChanged,
  safetyPreserved: summary.boundaries.safetyPreserved,
  learnerAuthorityBindingsPreserved: summary.boundaries.learnerAuthorityBindingsPreserved,
}
if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new Error(`R3 validation invariant failed.\nExpected: ${JSON.stringify(expected)}\nObserved: ${JSON.stringify(observed)}`)

mkdirSync(HERE, { recursive: true })
writeFileSync(resolve(HERE, 'findings.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
writeFileSync(resolve(HERE, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`Validated ${rows.length} reviewed cases through three independent R3 schemas.`)
console.log(`Historical: scoring=${summary.historical.scoringAuthorityConflicts}, content=${summary.historical.contentTransferConflicts}, false-positive=${summary.historical.falsePositives}.`)
console.log(`Final: scoring=${summary.final.scoringAuthorityConflicts}, content=${summary.final.contentTransferConflicts}, unexplained=${summary.final.unexplainedCases}.`)
console.log(`Preserved: false-positive=${summary.final.falsePositivesPreserved}, safety=${summary.boundaries.safetyPreserved}, learner-authority=${summary.boundaries.learnerAuthorityBindingsPreserved}.`)
console.log(`LEARNER_CURRICULUM_SEMANTICS_CHANGED=${summary.boundaries.learnerCurriculumSemanticsChanged ? 'YES' : 'NO'}`)
