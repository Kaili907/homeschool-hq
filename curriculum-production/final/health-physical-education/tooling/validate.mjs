#!/usr/bin/env node
/** Independent final-corpus validator. Re-reads all emitted artifacts. */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanDocument } from '../src/lib/privacyScan.mjs'
import { auditPeLessonExecutability } from '../src/lib/peExecution.mjs'
import { evaluatePeTransferConsistency } from '../src/lib/transferConsistency.mjs'
import { courseDir } from '../src/lib/sourcePaths.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED = { lessons: 1296, assessments: 135, items: 1431 }
const H2 = 'mac/g3-health-h2@50399a6fb6ae095907c0fde25db2a15ca85c6f1f'
const G34 = 'mac/g34-health-pe-r1@d0ebaa010cd01d7565967b4578d415dc7c8ee434'
const HS = 'mac/hs912-health-pe-r1@e39e2b343c41a1a800825651159e0e962d5288d7'
const HS_PE_REPAIR = 'mac/pe-transfer-authority-fix-r1 (canonical HS PE repair)'
const CANONICAL = 'shared base@656efba (canonical 5/7/8)'

const FORBIDDEN_PACKAGE_KEYS = [
  'answer_or_scoring_guidance', 'mastery_rule', 'adaptive_tutor_routes',
  'masteryInterpretation', 'rubricDimensions', 'scoringGuidance',
  'guardianOrParentVisibility',
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const path = resolve(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

function jsonFiles(dir) {
  return walk(dir).filter((path) => path.endsWith('.json'))
}

function expectedSource(doc) {
  if (doc.grade === 3 && doc.subject === 'health') return H2
  if (doc.grade === 3 || doc.grade === 4) return G34
  if ([5, 7, 8].includes(doc.grade)) return CANONICAL
  if (doc.subject === 'physical-education') return HS_PE_REPAIR
  return HS
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function main() {
  const errors = []
  const packageFiles = jsonFiles(resolve(ROOT, 'packages'))
  const guideFiles = jsonFiles(resolve(ROOT, 'scoring-guides'))
  let privacyViolations = 0
  let lessons = 0
  let assessments = 0
  let g3HealthRepinPackages = 0
  let g3HealthRepinGuides = 0
  const peLessonPackages = []
  const peGuides = new Map()

  const packageRelatives = new Set(packageFiles.map((file) => relative(resolve(ROOT, 'packages'), file)))
  const guideRelatives = new Set(guideFiles.map((file) => relative(resolve(ROOT, 'scoring-guides'), file)))
  for (const path of packageRelatives) if (!guideRelatives.has(path)) errors.push(`missing paired scoring guide: ${path}`)
  for (const path of guideRelatives) if (!packageRelatives.has(path)) errors.push(`missing paired student package: ${path}`)

  for (const file of packageFiles) {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    const label = relative(ROOT, file)
    for (const key of FORBIDDEN_PACKAGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(doc, key)) errors.push(`${label}: answer-bearing key "${key}" leaked into student package`)
    }
    if (doc.kind === 'lesson-task-card') lessons += 1
    else if (doc.kind === 'unit-assessment-task-card') assessments += 1
    else errors.push(`${label}: unknown package kind ${doc.kind}`)
    if (doc.productionReadiness?.status !== 'READY') errors.push(`${label}: production readiness is not READY`)
    if (doc.sourceProvenance?.sourceBranch !== expectedSource(doc)) errors.push(`${label}: incorrect source provenance`)
    if (doc.grade === 3 && doc.subject === 'health' && doc.sourceProvenance?.sourceBranch === H2) g3HealthRepinPackages += 1
    if (!Array.isArray(doc.neverRequires) || doc.neverRequires.length < 5) errors.push(`${label}: incomplete neverRequires policy`)
    if (doc.optionalReflection && !(doc.optionalReflection.private === true && doc.optionalReflection.graded === false && doc.optionalReflection.optional === true)) {
      errors.push(`${label}: reflection is not private, ungraded, and optional`)
    }
    if (!hasText(doc.adaptationChoices)) errors.push(`${label}: missing adaptation/private-response choice`)
    if (doc.subject === 'physical-education' && !hasText(doc.adaptationChoices)) errors.push(`${label}: PE adaptation choice missing`)
    if (doc.subject === 'physical-education' && doc.kind === 'lesson-task-card') peLessonPackages.push(doc)
    if (doc.subject === 'health' && !hasText(doc.trustedAdultNote)) errors.push(`${label}: Health trusted-adult/help-seeking note missing`)
    if (doc.subject === 'health' && doc.kind === 'lesson-task-card' && !hasText(doc.privacySafeScenario)) errors.push(`${label}: Health fictional/private scenario missing`)
    privacyViolations += scanDocument(doc, label).length
  }

  for (const file of guideFiles) {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    const label = relative(ROOT, file)
    if (doc.productionReadiness?.status !== 'READY') errors.push(`${label}: production readiness is not READY`)
    if (doc.scoringAuthority !== 'RUBRIC') errors.push(`${label}: Health/PE judgment work must use RUBRIC authority`)
    const hasRubric = doc.kind === 'lesson-scoring-guide'
      ? (doc.successCriteria?.some(hasText) || hasText(doc.scoringGuidance))
      : doc.rubricDimensions?.some(hasText)
    if (!hasRubric) errors.push(`${label}: rubric authority has no substantive criteria`)
    if (doc.sourceProvenance?.sourceBranch !== expectedSource(doc)) errors.push(`${label}: incorrect source provenance`)
    if (doc.subject === 'physical-education' && doc.kind === 'lesson-scoring-guide') peGuides.set(doc.lessonId, doc)
    if (doc.grade === 3 && doc.subject === 'health' && doc.sourceProvenance?.sourceBranch === H2) g3HealthRepinGuides += 1
    privacyViolations += scanDocument(doc, label).length
  }

  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'corpus-manifest.json'), 'utf8'))
  const peEvidence = JSON.parse(readFileSync(resolve(ROOT, 'pe-content-repair-evidence.json'), 'utf8'))
  const peAudit = auditPeLessonExecutability(peLessonPackages)
  const hsSourceLessons = new Map([9, 10, 11, 12].flatMap((grade) => readJsonl(resolve(courseDir(grade, 'physical-education'), 'lessons.jsonl'))).map((lesson) => [lesson.lesson_id, lesson]))
  let transferLessons = 0
  let learnerTransferDerivations = 0
  let adultTransferDerivations = 0
  let scoringAuthorityConflicts = 0
  let contentTransferConflicts = 0
  for (const pkg of peLessonPackages) {
    const sourceLesson = hsSourceLessons.get(pkg.lessonId)
    const guide = peGuides.get(pkg.lessonId)
    if (Object.hasOwn(pkg, 'transferAuthority')) errors.push(`${pkg.lessonId}: copied canonical transferAuthority is forbidden in learner artifacts`)
    if (Object.hasOwn(guide ?? {}, 'transferAuthority')) errors.push(`${pkg.lessonId}: copied canonical transferAuthority is forbidden in adult artifacts`)
    if (!sourceLesson?.transfer_condition) {
      if (pkg.transferTask) errors.push(`${pkg.lessonId}: non-transfer learner artifact carries transferTask`)
      if (guide?.transferRubric) errors.push(`${pkg.lessonId}: non-transfer adult artifact carries transferRubric`)
      continue
    }
    transferLessons += 1
    if (pkg.transferTask) learnerTransferDerivations += 1
    if (guide?.transferRubric) adultTransferDerivations += 1
    const result = evaluatePeTransferConsistency({
      sourceLesson,
      learnerPackage: pkg,
      adultGuide: guide,
    })
    if (result.classifications.includes('SCORING_AUTHORITY_CONFLICT')) scoringAuthorityConflicts += 1
    if (result.classifications.includes('CONTENT_TRANSFER_CONFLICT')) contentTransferConflicts += 1
    for (const finding of result.findings) errors.push(`${pkg.lessonId}: ${finding.classification} ${finding.code}: ${finding.message}`)
  }
  if (transferLessons !== 216) errors.push(`HS PE transfer semantic cohort mismatch: ${transferLessons}, expected 216`)
  if (learnerTransferDerivations !== 216 || adultTransferDerivations !== 216) errors.push(`HS PE semantic derivation mismatch: learner=${learnerTransferDerivations}, adult=${adultTransferDerivations}, expected 216 each`)
  if (scoringAuthorityConflicts !== 0) errors.push(`HS PE scoring-authority conflicts: ${scoringAuthorityConflicts}, expected 0`)
  if (contentTransferConflicts !== 0) errors.push(`HS PE content-transfer conflicts: ${contentTransferConflicts}, expected 0`)
  if (manifest.manifestType !== 'manuel-academy-final-production-corpus') errors.push('manifest is not canonical final-production type')
  if (manifest.totals.lessons !== EXPECTED.lessons || lessons !== EXPECTED.lessons) errors.push(`lesson count mismatch: manifest=${manifest.totals.lessons}, disk=${lessons}`)
  if (manifest.totals.unitAssessments !== EXPECTED.assessments || assessments !== EXPECTED.assessments) errors.push(`assessment count mismatch: manifest=${manifest.totals.unitAssessments}, disk=${assessments}`)
  if (manifest.totals.items !== EXPECTED.items || packageFiles.length !== EXPECTED.items) errors.push(`item count mismatch: manifest=${manifest.totals.items}, disk=${packageFiles.length}`)
  if (manifest.totals.studentPackages !== EXPECTED.items || manifest.totals.scoringGuides !== EXPECTED.items || guideFiles.length !== EXPECTED.items) errors.push('paired production-artifact totals are not canonical')
  if (manifest.productionGate.readyCount !== EXPECTED.items || manifest.productionGate.needsHumanReviewCount !== 0 || manifest.productionGate.notReadyCount !== 0) errors.push('H3 production gate summary is not 1431 READY / 0 review / 0 not-ready')
  if (manifest.privacyScan.violationCount !== 0 || privacyViolations !== 0) errors.push(`privacy scan is not clean: manifest=${manifest.privacyScan.violationCount}, disk=${privacyViolations}`)
  if (manifest.scoringPolicy?.gateSemantics !== 'H3' || manifest.scoringPolicy?.fixedAnswerKeys !== 0) errors.push('manifest does not record H3 rubric-only Health/PE scoring policy')
  if (g3HealthRepinPackages !== 42 || g3HealthRepinGuides !== 42) errors.push(`Grade 3 Health H2 repin mismatch: ${g3HealthRepinPackages} packages / ${g3HealthRepinGuides} guides`)
  if (peAudit.lessonsAudited !== 972) errors.push(`PE lesson audit count mismatch: ${peAudit.lessonsAudited}`)
  const peIssueGroups = {
    missingMovementCues: peAudit.missingMovementCues,
    equipmentBlockers: peAudit.equipmentBlockers,
    missingRequiredSafety: peAudit.missingSafety,
    missingAdaptation: peAudit.missingAdaptation,
    homeUseBlockers: peAudit.homeUseBlockers,
    missingCompletionCriteria: peAudit.missingCompletionCriteria,
  }
  for (const [kind, ids] of Object.entries(peIssueGroups)) {
    if (ids.length > 0) errors.push(`PE ${kind}: ${ids.length} (${ids.slice(0, 5).join(', ')})`)
    if (peEvidence.after?.[kind] !== ids.length) errors.push(`PE evidence mismatch for ${kind}: evidence=${peEvidence.after?.[kind]}, disk=${ids.length}`)
    if (manifest.peLearnerContentRepair?.after?.[kind] !== ids.length) errors.push(`PE manifest mismatch for ${kind}: manifest=${manifest.peLearnerContentRepair?.after?.[kind]}, disk=${ids.length}`)
  }
  if (peEvidence.confirmedBaseline?.missingMovementCues !== 756 || peEvidence.repairs?.movementCueRepairs !== 756) errors.push('PE movement-cue baseline/repair evidence is not 756')
  if (peEvidence.confirmedBaseline?.equipmentBlockers !== 600 || peEvidence.repairs?.equipmentRepairs !== 600) errors.push('PE equipment baseline/repair evidence is not 600')
  if (peEvidence.confirmedBaseline?.missingRequiredSafety !== 324 || peEvidence.repairs?.safetyRepairs !== 324) errors.push('PE safety baseline/repair evidence is not 324')
  if (peEvidence.classification !== 'PE_CONTENT_READY_FOR_CONVERGENCE' || manifest.peLearnerContentRepair?.classification !== peEvidence.classification) errors.push('PE repair classification is not ready and consistent')

  verifyChecksums(errors)

  console.log(`Checked ${packageFiles.length} packages + ${guideFiles.length} scoring guides.`)
  console.log(`Counts: ${lessons} lessons + ${assessments} assessments = ${packageFiles.length} items.`)
  console.log(`Grade 3 Health H2 provenance: ${g3HealthRepinPackages} packages + ${g3HealthRepinGuides} guides.`)
  console.log(`PE content: ${peAudit.lessonsAudited} executable lessons; ${Object.values(peIssueGroups).reduce((sum, ids) => sum + ids.length, 0)} learner-content issue(s).`)
  console.log(`HS PE transfer semantics: ${transferLessons} reviewed; ${learnerTransferDerivations} learner derivations; ${adultTransferDerivations} adult derivations; ${scoringAuthorityConflicts} scoring-authority conflict(s), ${contentTransferConflicts} content-transfer conflict(s).`)
  if (errors.length) {
    console.error(`\n${errors.length} VALIDATION FAILURE(S):`)
    for (const error of errors) console.error(` - ${error}`)
    process.exitCode = 1
  } else {
    console.log('All final production, H3, privacy, rubric, provenance, and checksum checks passed.')
  }
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
}

function verifyChecksums(errors) {
  const checksumPath = resolve(ROOT, 'SHA256SUMS.txt')
  const lines = readFileSync(checksumPath, 'utf8').trimEnd().split('\n')
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'corpus-manifest.json'), 'utf8'))
  if (manifest.checksums?.entries !== lines.length) errors.push(`checksum entry count mismatch: manifest=${manifest.checksums?.entries}, file=${lines.length}`)
  const expectedFiles = walk(ROOT).filter((path) => path !== checksumPath).map((path) => relative(ROOT, path))
  const recorded = []
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
    if (!match) {
      errors.push(`invalid checksum line: ${line}`)
      continue
    }
    const [, expected, rel] = match
    recorded.push(rel)
    const actual = createHash('sha256').update(readFileSync(resolve(ROOT, rel))).digest('hex')
    if (actual !== expected) errors.push(`checksum mismatch: ${rel}`)
  }
  if (JSON.stringify(recorded) !== JSON.stringify(expectedFiles)) errors.push('checksum inventory does not exactly match canonical corpus files')
}

main()
