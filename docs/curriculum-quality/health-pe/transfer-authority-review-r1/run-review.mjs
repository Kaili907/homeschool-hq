#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REVIEW_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(REVIEW_DIR, '../../../..')
const CORPUS = resolve(ROOT, 'curriculum-production/final/health-physical-education')
const BINDINGS = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
const BASE = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'
const HS_SOURCE_COMMIT = 'e39e2b343c41a1a800825651159e0e962d5288d7'

const SCORING_CONFLICTS = new Map(Object.entries({
  '9:2': 'The rubric requires activity-speed work against a genuinely competing opponent, while its own safety/inclusion authority says a solo learner may complete the entire unit and that tactical understanding—not game size—is assessed.',
  '9:5': 'The rubric requires a complete sequence without stopping, while adult safety authority allows a pause or rest without failure and the task card says stopping or resting for safety counts as responsible completion.',
  '9:7': 'The rubric requires an outing with a real adverse condition, while the adult adaptation authorizes a full indoor/home-yard equivalent and the task card says no outdoor trip is required.',
  '9:8': 'The rubric requires a real activity with other people and an unplanned live situation, while the adult adaptation makes a written/diagrammed redesign full work and practical trial optional.',
  '10:8': 'The rubric requires actually leading other people through a live disagreement or access problem, while adult authority permits a written plan and explicitly says leading a group is never required.',
  '11:4': 'The rubric requires coaching the practice to another person who succeeds, while adult authority says a solo learner completes fully through simulation and a written coaching script.',
  '11:6': 'The rubric requires an outing with a real contingency triggered, while adult authority provides a full indoor/home-area equivalent and forbids execution without approval.',
  '11:7': 'The rubric requires running the event for real, while adult authority accepts a complete plan with rehearsed walk-through when participants are unavailable.',
  '12:7': 'The rubric requires live facilitation for a real group, while adult authority says group size is never required and delivery to one person fully meets the standard.',
  '12:8': 'The rubric requires an unsupervised full training block with a real stop decision, while adult authority says the protocol may be written, tabled, or described and retains guardian safety oversight.',
}))

const CONTENT_CONFLICTS = new Map(Object.entries({
  '9:3': 'The learner task requires a scored rally, round, or innings, while the learner execution path says no score is needed and accepts a described/no-equipment controlled example for equal credit.',
  '9:4': 'The learner task requires the learner’s own real training week, while the generated completion path certifies one controlled practice-and-application sequence or a full description.',
  '9:6': 'The learner task requires a genuine trial session under real access constraints, while the generated equal-credit completion path accepts a described/no-equipment example without a trial.',
  '10:3': 'The learner task requires a full scored contest, while the generated learner path says no score is needed and accepts a described/no-equipment controlled example.',
  '12:2': 'The learner task requires an unsupervised full cycle, while the generated learner completion path accepts one controlled sequence or a full description.',
  '12:4': 'The learner task requires an actual attempt including a setback, while the generated learner completion/adaptation path accepts a described controlled example when movement is not appropriate.',
}))

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function jsonl(path) {
  return readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function gradeToken(grade) {
  return String(grade).padStart(2, '0')
}

function packageFiles() {
  const root = resolve(CORPUS, 'packages/physical-education')
  return [9, 10, 11, 12].flatMap((grade) => {
    const dir = resolve(root, `grade-${gradeToken(grade)}`)
    return readdirSync(dir)
      .filter((name) => /-l(?:0[7-9]|1[0-2])\.json$/.test(name))
      .sort()
      .map((name) => resolve(dir, name))
  })
}

const bindings = new Map(jsonl(BINDINGS).map((binding) => [binding.lessonRef, binding]))
const candidates = packageFiles()
if (candidates.length !== 216) throw new Error(`Expected 216 positional candidates; found ${candidates.length}.`)

const findings = candidates.map((packagePath) => {
  const task = json(packagePath)
  const guidePath = resolve(
    CORPUS,
    'scoring-guides/physical-education',
    `grade-${gradeToken(task.grade)}`,
    `${task.lessonId}.json`,
  )
  const guide = json(guidePath)
  const binding = bindings.get(task.lessonId)
  if (!binding) throw new Error(`${task.lessonId}: admitted binding is missing.`)
  if (guide.lessonId !== task.lessonId || guide.scoringAuthority !== 'RUBRIC') {
    throw new Error(`${task.lessonId}: paired RUBRIC authority identity mismatch.`)
  }
  if (binding.scoringMetadata?.authority !== 'RUBRIC' || binding.completionAuthority !== 'LEARNER_AUTHORITY') {
    throw new Error(`${task.lessonId}: admitted authority metadata differs from the reviewed architecture.`)
  }

  const unitKey = `${task.grade}:${task.unitNumber}`
  const scoringReason = SCORING_CONFLICTS.get(unitKey)
  const contentReason = CONTENT_CONFLICTS.get(unitKey)
  const classification = scoringReason
    ? 'SCORING_AUTHORITY_CONFLICT'
    : contentReason
      ? 'CONTENT_TRANSFER_CONFLICT'
      : 'FALSE_POSITIVE'
  const severity = classification === 'SCORING_AUTHORITY_CONFLICT'
    ? 'HIGH'
    : classification === 'CONTENT_TRANSFER_CONFLICT'
      ? 'MODERATE'
      : 'INFORMATIONAL'
  const reason = scoringReason ?? contentReason
    ?? 'The depth audit selected this lesson only because it is a Grade 9–12 day 7–12 transfer lesson. Direct comparison found no incompatible requirement between the transfer condition and the authorized response/adaptation paths.'

  return {
    lessonRef: task.lessonId,
    grade: task.grade,
    unitNumber: task.unitNumber,
    title: task.title,
    focus: task.focus,
    learnerItemTaskRef: `${task.lessonId}#student-task`,
    learnerTaskSourceField: 'studentTask',
    serverAssessmentItemRef: `${task.lessonId}#production-evidence`,
    taskCardRef: relative(ROOT, packagePath),
    taskCardSha256: sha256(packagePath),
    scoringGuideRef: relative(ROOT, guidePath),
    scoringGuideSha256: sha256(guidePath),
    expectedAuthority: {
      scoringKind: 'RUBRIC',
      scoringGuideRef: relative(ROOT, guidePath),
      completionAuthority: 'LEARNER_AUTHORITY',
      rule: 'The paired server-side lesson scoring guide is the scoring authority; Study completion is learner-authority completion-only and does not wait for a rubric decision.',
    },
    observedAuthority: {
      scoringKind: guide.scoringAuthority,
      firstSuccessCriterion: guide.successCriteria?.[0] ?? null,
      studentTask: task.studentTask,
      generatedCompletionCriteria: task.completionCriteria,
      scoringGuidance: guide.scoringGuidance,
      learnerDeclinesRoute: guide.adaptiveRoutes?.find((route) => route.signal === 'learner declines a task')?.action ?? null,
      transferTooMuchRoute: guide.adaptiveRoutes?.find((route) => route.signal === 'transfer condition is too much today')?.action ?? null,
      guardianSafetyReview: guide.guardianSafetyReview ?? null,
      safetyAndPrivacyNotes: guide.safetyAndPrivacyNotes ?? [],
    },
    classification,
    severity,
    rationale: reason,
    canAffectLearnerScoring: classification === 'SCORING_AUTHORITY_CONFLICT',
    canAffectLearnerProgression: false,
    progressionReason: 'The admitted binding is LEARNER_AUTHORITY and the Study plan is completion-only. The current learner runtime advances after locally saving required responses; the default integration injects no assessor.',
    metadataOnly: false,
    falsePositive: classification === 'FALSE_POSITIVE',
    learnerVisibleContentAffected: classification !== 'FALSE_POSITIVE',
    adultAuthorityAmbiguous: classification === 'SCORING_AUTHORITY_CONFLICT',
    studyCouldReceiveContradictoryEvidence: false,
    studyEvidenceReason: 'Current Study receives minimized completion/session state and, through the separate assessment seam, at most a review-required receipt. Raw response/rubric text is not a Study progression or mastery input.',
    sourceFamily: {
      sourceCommit: HS_SOURCE_COMMIT,
      sourceLessons: `curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/build/grade-${task.grade}/courses/physical-education/lessons.jsonl`,
      sourceGenerator: 'curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs',
      sourceUnitData: 'curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/course-data.mjs',
      finalProjectionGenerator: 'curriculum-production/final/health-physical-education/src/generate.mjs',
      peExecutionProjection: 'curriculum-production/final/health-physical-education/src/lib/peExecution.mjs',
    },
  }
})

for (const unitKey of [...SCORING_CONFLICTS.keys(), ...CONTENT_CONFLICTS.keys()]) {
  const [grade, unitNumber] = unitKey.split(':').map(Number)
  const cohort = findings.filter((finding) => finding.grade === grade && finding.unitNumber === unitNumber)
  if (cohort.length !== 6) throw new Error(`${unitKey}: expected six cycle-two lessons; found ${cohort.length}.`)
}
if (findings.filter((finding) => finding.classification === 'SCORING_AUTHORITY_CONFLICT').length !== 60
  || findings.filter((finding) => finding.classification === 'CONTENT_TRANSFER_CONFLICT').length !== 36
  || findings.filter((finding) => finding.classification === 'FALSE_POSITIVE').length !== 120) {
  throw new Error('Classification invariant failed.')
}

function counts(field) {
  return Object.fromEntries([...new Set(findings.map((finding) => finding[field]))]
    .sort().map((value) => [value, findings.filter((finding) => finding[field] === value).length]))
}

const byGrade = Object.fromEntries([9, 10, 11, 12].map((grade) => [grade, {
  total: findings.filter((finding) => finding.grade === grade).length,
  classifications: Object.fromEntries(
    ['FALSE_POSITIVE', 'METADATA_CONFLICT_ONLY', 'CONTENT_TRANSFER_CONFLICT', 'SCORING_AUTHORITY_CONFLICT', 'PROGRESSION_RISK', 'UNKNOWN']
      .map((classification) => [classification, findings.filter((finding) => finding.grade === grade && finding.classification === classification).length]),
  ),
}]))

const summary = {
  review: 'PE TRANSFER-AUTHORITY ROOT-CAUSE REVIEW R1',
  outcome: 'PE_TRANSFER_AUTHORITY_REVIEW_COMPLETE',
  base: BASE,
  branch: 'mac/pe-transfer-authority-review-r1',
  sourceFindingCount: 216,
  reviewedCount: findings.length,
  definition: '“Transfer-authority conflict” is not a repository contract term. In the source depth audit it is a positional flag applied to every Grade 9–12 PE lesson numbered 7–12. In the actual architecture, RUBRIC is the only scoring-authority kind; genuine conflicts are prose contradictions either inside that guide or between the learner task and generated equal-credit completion path.',
  classifications: Object.fromEntries(
    ['FALSE_POSITIVE', 'METADATA_CONFLICT_ONLY', 'CONTENT_TRANSFER_CONFLICT', 'SCORING_AUTHORITY_CONFLICT', 'PROGRESSION_RISK', 'UNKNOWN']
      .map((classification) => [classification, findings.filter((finding) => finding.classification === classification).length]),
  ),
  severity: counts('severity'),
  byGrade,
  impacts: {
    canAffectLearnerScoring: findings.filter((finding) => finding.canAffectLearnerScoring).length,
    canAffectLearnerProgression: findings.filter((finding) => finding.canAffectLearnerProgression).length,
    metadataOnly: findings.filter((finding) => finding.metadataOnly).length,
    falsePositive: findings.filter((finding) => finding.falsePositive).length,
    learnerVisibleContentAffected: findings.filter((finding) => finding.learnerVisibleContentAffected).length,
    adultAuthorityAmbiguous: findings.filter((finding) => finding.adultAuthorityAmbiguous).length,
    studyCouldReceiveContradictoryEvidence: findings.filter((finding) => finding.studyCouldReceiveContradictoryEvidence).length,
  },
  conflictUnitFamilies: {
    scoringAuthority: [...SCORING_CONFLICTS.keys()],
    contentTransfer: [...CONTENT_CONFLICTS.keys()],
  },
  smallestSafeRepairBoundary: {
    source: 'Repair the 16 adjudicated high-school unit second-pass families at the canonical HS PE source generator/data boundary, then regenerate source lessons and the final Health/PE corpus. Do not hand-edit 96 emitted lesson/scoring pairs.',
    sourceFiles: [
      `${HS_SOURCE_COMMIT}:curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/course-data.mjs`,
      `${HS_SOURCE_COMMIT}:curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs`,
    ],
    projectionGuard: 'Add a semantic transfer-versus-equal-credit consistency validator at curriculum-production/final/health-physical-education before readiness can be READY.',
    affectedUnitFamilies: 16,
    affectedLessons: 96,
  },
  noSecurityFinding: true,
  sourceAuditEvidence: {
    statusAtReview: 'uncommitted evidence in sibling mac/health-pe-depth-audit-r1 worktree',
    runAuditSha256: 'b06a4f5cffa0bbd6fb10e03ea38f75f16846edfb846047296a6b9e92b73cf1c9',
    lessonFindingsSha256: '97c1620b6b94ec739a5f1aadf67120bd8c43390631690f1c09e78eae4a8b8939',
    metricsSha256: 'cc76c9a5a3efb60883c73dca808b655f68f467a037e99035152a80b67efaa834',
  },
  inputHashes: {
    hsSourceGeneratorAtE39e2b3: 'c3d06da4b32600f66b7e5b1dd35c4afd72df2d72ad1502f5b1fa8738ff161de8',
    hsSourceUnitDataAtE39e2b3: 'e33f95959432fca5422624b09158117638aa3e6a182e98d94431500a113630f9',
    finalGenerator: sha256(resolve(CORPUS, 'src/generate.mjs')),
    peExecutionProjection: sha256(resolve(CORPUS, 'src/lib/peExecution.mjs')),
    scoringSchema: sha256(resolve(CORPUS, 'schema/scoring-guide.schema.json')),
    taskCardSchema: sha256(resolve(CORPUS, 'schema/student-task-card.schema.json')),
    admittedBindings: sha256(BINDINGS),
  },
}

mkdirSync(REVIEW_DIR, { recursive: true })
writeFileSync(resolve(REVIEW_DIR, 'findings.jsonl'), `${findings.map((finding) => JSON.stringify(finding)).join('\n')}\n`)
writeFileSync(resolve(REVIEW_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`Reviewed ${findings.length} transfer candidates.`)
console.log(JSON.stringify(summary.classifications))
console.log(JSON.stringify(summary.severity))
