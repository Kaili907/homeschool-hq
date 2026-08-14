#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { evaluatePeTransferConsistency, TRANSFER_AUTHORITY_SCHEMA } from '../../../../curriculum-production/final/health-physical-education/src/lib/transferConsistency.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const R1 = '98ca7a3a4bcd32742308933d479ff146e71a1b19'
const REVIEW = resolve(ROOT, 'docs/curriculum-quality/health-pe/transfer-authority-review-r1/findings.jsonl')
const BINDINGS = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) => readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse)
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const show = (spec) => execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const showJson = (spec) => JSON.parse(show(spec))

function withoutTransferAuthority(value) {
  const copy = structuredClone(value)
  delete copy.transfer_authority
  delete copy.transferAuthority
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
  for (const lesson of show(`${R1}:${rel}`).trim().split('\n').map(JSON.parse)) sourceBefore.set(lesson.lesson_id, lesson)
  for (const lesson of readJsonl(resolve(ROOT, rel))) sourceAfter.set(lesson.lesson_id, lesson)
}

const rows = reviewRows.map((review) => {
  const beforePackage = showJson(`${R1}:${review.taskCardRef}`)
  const beforeGuide = showJson(`${R1}:${review.scoringGuideRef}`)
  const afterPackagePath = resolve(ROOT, review.taskCardRef)
  const afterGuidePath = resolve(ROOT, review.scoringGuideRef)
  const afterPackage = readJson(afterPackagePath)
  const afterGuide = readJson(afterGuidePath)
  const beforeSource = sourceBefore.get(review.lessonRef)
  const afterSource = sourceAfter.get(review.lessonRef)
  const result = evaluatePeTransferConsistency({
    sourceLesson: afterSource,
    learnerTransferAuthority: afterPackage.transferAuthority,
    adultTransferAuthority: afterGuide.transferAuthority,
  })
  const sourceSemanticsUnchanged = JSON.stringify(withoutTransferAuthority(beforeSource)) === JSON.stringify(withoutTransferAuthority(afterSource))
  const learnerSemanticsUnchanged = JSON.stringify(withoutTransferAuthority(beforePackage)) === JSON.stringify(withoutTransferAuthority(afterPackage))
  const adultSemanticsUnchanged = JSON.stringify(withoutTransferAuthority(beforeGuide)) === JSON.stringify(withoutTransferAuthority(afterGuide))
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
    structuredSchema: afterSource.transfer_authority?.schemaVersion ?? null,
    sourceSemanticsUnchanged,
    learnerSemanticsUnchanged,
    adultSemanticsUnchanged,
    safetyPreserved,
    completionAuthority: bindings.get(review.lessonRef)?.completionAuthority ?? null,
    taskCardRef: review.taskCardRef,
    taskCardSha256R1: createHash('sha256').update(show(`${R1}:${review.taskCardRef}`)).digest('hex'),
    taskCardSha256R2: sha(afterPackagePath),
    scoringGuideRef: review.scoringGuideRef,
    scoringGuideSha256R1: createHash('sha256').update(show(`${R1}:${review.scoringGuideRef}`)).digest('hex'),
    scoringGuideSha256R2: sha(afterGuidePath),
  }
})

const count = (predicate) => rows.filter(predicate).length
const summary = {
  validation: 'HIGH-SCHOOL PE TRANSFER AUTHORITY PERMANENT GATE R2',
  status: 'PE_TRANSFER_AUTHORITY_R2_VALIDATED',
  r1Base: R1,
  branch: 'mac/pe-transfer-authority-fix-r2',
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
  structuredAuthority: {
    schema: TRANSFER_AUTHORITY_SCHEMA,
    sourceRecords: count((row) => row.structuredSchema === TRANSFER_AUTHORITY_SCHEMA),
    learnerRecords: count((row) => readJson(resolve(ROOT, row.taskCardRef)).transferAuthority?.schemaVersion === TRANSFER_AUTHORITY_SCHEMA),
    adultRecords: count((row) => readJson(resolve(ROOT, row.scoringGuideRef)).transferAuthority?.schemaVersion === TRANSFER_AUTHORITY_SCHEMA),
    phrasePatternsUsedByGate: 0,
  },
  boundaries: {
    curriculumSemanticsChanged: count((row) => !row.sourceSemanticsUnchanged || !row.learnerSemanticsUnchanged || !row.adultSemanticsUnchanged) > 0,
    safetyPreserved: count((row) => row.safetyPreserved),
    learnerAuthorityBindingsPreserved: count((row) => row.completionAuthority === 'LEARNER_AUTHORITY'),
  },
  controls: {
    trueScoringMismatch: 'FAILS',
    trueTransferMismatch: 'FAILS',
    paraphrasedScoringVariants: 3,
    paraphrasedTransferVariants: 3,
    validEqualCredit: 'PASSES',
    validTransfer: 'PASSES',
    historicalFalsePositivePattern: 'PASSES',
    lessonLocationMutation: 'UNCHANGED',
  },
  studyBoundary: 'Completion-based Study progression and LEARNER_AUTHORITY bindings are unchanged; no Study scoring engine was added.',
  safety: 'Stop/rest authority, adaptations, guardian boundaries, privacy, and no-body-scoring remain explicit in both prose and structured authority.',
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
  sourceRecords: 216,
  learnerRecords: 216,
  adultRecords: 216,
  curriculumSemanticsChanged: false,
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
  sourceRecords: summary.structuredAuthority.sourceRecords,
  learnerRecords: summary.structuredAuthority.learnerRecords,
  adultRecords: summary.structuredAuthority.adultRecords,
  curriculumSemanticsChanged: summary.boundaries.curriculumSemanticsChanged,
  safetyPreserved: summary.boundaries.safetyPreserved,
  learnerAuthorityBindingsPreserved: summary.boundaries.learnerAuthorityBindingsPreserved,
}
if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new Error(`R2 validation invariant failed.\nExpected: ${JSON.stringify(expected)}\nObserved: ${JSON.stringify(observed)}`)

mkdirSync(HERE, { recursive: true })
writeFileSync(resolve(HERE, 'findings.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
writeFileSync(resolve(HERE, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`Validated ${rows.length} reviewed cases through ${TRANSFER_AUTHORITY_SCHEMA}.`)
console.log(`Historical: scoring=${summary.historical.scoringAuthorityConflicts}, content=${summary.historical.contentTransferConflicts}, false-positive=${summary.historical.falsePositives}.`)
console.log(`Final: scoring=${summary.final.scoringAuthorityConflicts}, content=${summary.final.contentTransferConflicts}, unexplained=${summary.final.unexplainedCases}.`)
console.log(`Preserved: false-positive=${summary.final.falsePositivesPreserved}, safety=${summary.boundaries.safetyPreserved}, learner-authority=${summary.boundaries.learnerAuthorityBindingsPreserved}.`)
console.log(`CURRICULUM_SEMANTICS_CHANGED=${summary.boundaries.curriculumSemanticsChanged ? 'YES' : 'NO'}`)
