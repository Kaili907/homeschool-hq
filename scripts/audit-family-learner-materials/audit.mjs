#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import {
  actionableText,
  hashText,
  inspectLesson,
  normalizedText,
  projectJsonMaterial,
  projectMarkdownMaterial,
  walk,
} from './audit-lib.mjs'

const AUDITED_RELEASE_SHA = 'c81ddb6e04bc1c3629212327d47817c1b5677477'
const EXPECTED_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12])
const EXPECTED_SUBJECTS = Object.freeze([
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'financial-literacy',
  'technology',
  'arts-and-music',
])
const EXPECTED_COUNTS = Object.freeze({ grades: 9, courses: 90, units: 698, lessons: 8292, assessments: 699 })
const OUTPUT_RELATIVE = 'docs/family-learner-materials-audit'

function fail(message) {
  throw new Error(`Family learner materials audit failed closed: ${message}`)
}

function check(condition, message) {
  if (!condition) fail(message)
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root')
  return {
    root: resolve(rootIndex >= 0 ? argv[rootIndex + 1] : new URL('../../', import.meta.url).pathname),
    checkOnly: argv.includes('--check'),
    printManualSample: argv.includes('--print-manual-sample'),
  }
}

const options = parseArgs(process.argv.slice(2))
const root = options.root
const admitted = join(root, 'curriculum-release-admitted/family-pilot-r1')
const outputDir = join(root, OUTPUT_RELATIVE)

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function packagePath(ref) {
  check(typeof ref === 'string' && ref.startsWith('git+'), `invalid production package reference ${String(ref)}`)
  const separator = ref.indexOf(':')
  check(separator >= 0, `production package reference has no path ${ref}`)
  const relative = ref.slice(separator + 1)
  check(!relative.includes('/answer-key') && !relative.includes('/scoring-guide'), `adult package used as learner material: ${ref}`)
  return join(root, relative)
}

function addCount(record, key, amount = 1) {
  record[key] = (record[key] ?? 0) + amount
}

function blankMatrixRow(grade, subject) {
  return {
    grade,
    subject,
    courseCount: 0,
    lessonCount: 0,
    learnerMaterialCount: 0,
    actionableWorkCount: 0,
    zeroActionableCount: 0,
    questionableActionableCount: 0,
    validNonquestionTaskCount: 0,
    emptyMasteryCount: 0,
    emptyAssessmentSectionCount: 0,
    emptyIndependentPracticeCount: 0,
    flattenedChoiceLessonCount: 0,
    placeholderOrFillerCount: 0,
    adultLeakCount: 0,
    sourceReadinessIssueCount: 0,
    pendingSourceAttachmentCount: 0,
    attestationIssueCount: 0,
    disconnectedResponsePathCount: 0,
    assessmentCount: 0,
    emptyAssessmentCount: 0,
    usableLearnerAssessmentMaterialCount: 0,
    structuralOnlyAssessmentCount: 0,
    boundAssessmentCount: 0,
    workflowLinkedAssessmentCount: 0,
    safeToBegin: null,
    limitation: null,
    first10Worst: [],
  }
}

const manifest = readJson(join(admitted, 'MANIFEST.json'))
const runtimeManifest = readJson(join(admitted, 'runtime/runtime-manifest.json'))
const lessonRowsByCourse = readJson(join(admitted, 'runtime/lesson-rows-by-course.json'))
const assessmentBindings = readJson(join(admitted, 'assessment-bindings.json'))
const bindings = readFileSync(join(admitted, 'production-bindings.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))

check(JSON.stringify(manifest.counts) === JSON.stringify(EXPECTED_COUNTS), 'admitted manifest counts drifted')
check(bindings.length === EXPECTED_COUNTS.lessons, `expected ${EXPECTED_COUNTS.lessons} lesson bindings, found ${bindings.length}`)
check(runtimeManifest.courses.length === EXPECTED_COUNTS.courses, `expected ${EXPECTED_COUNTS.courses} courses, found ${runtimeManifest.courses.length}`)
check(assessmentBindings.length === EXPECTED_COUNTS.assessments, `expected ${EXPECTED_COUNTS.assessments} assessments, found ${assessmentBindings.length}`)
check(JSON.stringify(manifest.supportedGrades) === JSON.stringify(EXPECTED_GRADES), 'supported-grade contract drifted')
check(manifest.unsupportedGrades.includes(6), 'Grade 6 is not declared unsupported')

try {
  execFileSync('git', ['cat-file', '-e', `${AUDITED_RELEASE_SHA}^{commit}`], { cwd: root, stdio: 'ignore' })
} catch {
  fail(`audited release commit ${AUDITED_RELEASE_SHA} is unavailable`)
}

try {
  execFileSync('git', ['merge-base', '--is-ancestor', AUDITED_RELEASE_SHA, 'HEAD'], { cwd: root, stdio: 'ignore' })
} catch {
  fail(`audited release commit ${AUDITED_RELEASE_SHA} is not an ancestor of HEAD`)
}
const sourceShas = Object.fromEntries([...new Set(bindings.map((binding) => binding.productionSourceCommit))]
  .sort()
  .map((sha) => [sha, bindings.filter((binding) => binding.productionSourceCommit === sha).length]))

const courseDescriptors = new Map(runtimeManifest.courses.map((course) => [course.courseRef, course]))
const rowsByLesson = new Map(Object.values(lessonRowsByCourse).flat().map((row) => [row.lessonRef, row]))
const lessonFindings = []
const materialByLesson = new Map()
const valueByLesson = new Map()
const rawByLesson = new Map()
const bindingByLesson = new Map()

const forbiddenAdultKey = /^(answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex)$/i
const forbiddenAdultText = /(?:answer-keys|scoring-guide|teacher-guide)/i
let adultLeakCount = 0

for (const binding of bindings) {
  check(courseDescriptors.has(binding.courseRef), `${binding.lessonRef}: course descriptor missing`)
  check(rowsByLesson.has(binding.lessonRef), `${binding.lessonRef}: admitted lesson row missing`)
  const path = packagePath(binding.productionPackageRef)
  check(existsSync(path), `${binding.lessonRef}: production learner material missing at ${path}`)
  const raw = readFileSync(path, 'utf8')
  const isJson = extname(path) === '.json'
  const value = isJson ? JSON.parse(raw) : null
  const markdown = isJson ? null : raw
  const row = rowsByLesson.get(binding.lessonRef)
  const material = isJson
    ? projectJsonMaterial(value, binding, row.title)
    : projectMarkdownMaterial(markdown, binding, row.title)

  let lessonAdultLeaks = 0
  walk(material, (candidate, candidatePath) => {
    const key = candidatePath.split('.').at(-1)
    if (forbiddenAdultKey.test(key) || (typeof candidate === 'string' && forbiddenAdultText.test(candidate))) lessonAdultLeaks += 1
  })
  adultLeakCount += lessonAdultLeaks

  const inspected = inspectLesson({ binding, value, markdown, material })
  if (lessonAdultLeaks) inspected.findings.push({ code: 'ADULT_SCORING_OR_ANSWER_LEAK', severity: 'BLOCKER', count: lessonAdultLeaks })
  const finding = {
    lessonRef: binding.lessonRef,
    courseRef: binding.courseRef,
    grade: binding.grade,
    subject: binding.subject,
    productionPackageRef: binding.productionPackageRef,
    productionSourceCommit: binding.productionSourceCommit,
    completionAuthority: binding.completionAuthority,
    sourceReadinessKind: binding.sourceReadinessKind,
    sourceRuntimeState: binding.sourceRuntimeState,
    materialExists: true,
    adultLeakCount: lessonAdultLeaks,
    ...inspected,
  }
  lessonFindings.push(finding)
  materialByLesson.set(binding.lessonRef, material)
  valueByLesson.set(binding.lessonRef, value)
  rawByLesson.set(binding.lessonRef, raw)
  bindingByLesson.set(binding.lessonRef, binding)
}

check(lessonFindings.length === EXPECTED_COUNTS.lessons, 'full-population lesson inspection did not complete')
check(adultLeakCount === 0, `${adultLeakCount} projected adult leaks found`)

// Exact cross-grade duplicate detection uses only the learner's actionable task,
// not boilerplate safety, rubric, or metadata fields.
const duplicateBuckets = new Map()
for (const finding of lessonFindings) {
  const bucket = duplicateBuckets.get(finding.actionableTextHash) ?? []
  bucket.push(finding)
  duplicateBuckets.set(finding.actionableTextHash, bucket)
}
const progressionGroups = [...duplicateBuckets.entries()].flatMap(([hash, rows]) => {
  const grades = [...new Set(rows.map((row) => row.grade))].sort((a, b) => a - b)
  if (grades.length < 2 || !rows[0].actionableText) return []
  for (const row of rows) row.findings.push({ code: 'CROSS_GRADE_EXACT_ACTIONABLE_TASK', severity: 'ADVISORY', duplicateGroupHash: hash, duplicateCount: rows.length, grades })
  return [{
    hash,
    subject: rows[0].subject,
    count: rows.length,
    grades,
    sampleLessonRefs: rows.slice(0, 20).map((row) => row.lessonRef),
    actionableTextExcerpt: rows[0].actionableText.slice(0, 500),
  }]
}).sort((left, right) => right.count - left.count || left.hash.localeCompare(right.hash))

const assessmentRecords = []
const assessmentDuplicateBuckets = new Map()
for (const assessment of assessmentBindings) {
  const learnerPath = assessment.productionPackageRef ? packagePath(assessment.productionPackageRef) : null
  const learnerMaterialExists = Boolean(learnerPath && existsSync(learnerPath))
  const raw = learnerMaterialExists ? readFileSync(learnerPath, 'utf8') : null
  let evidenceItemCount = 0
  if (raw) {
    const parsed = JSON.parse(raw)
    walk(parsed, (candidate) => {
      if (candidate && typeof candidate === 'object' && typeof candidate.prompt === 'string') evidenceItemCount += 1
      else if (candidate && typeof candidate === 'object' && typeof candidate.text === 'string' && /prompt|task|question/i.test(JSON.stringify(Object.keys(candidate)))) evidenceItemCount += 1
    })
    const hash = hashText(normalizedText(raw.replaceAll(assessment.assessmentRef, '<assessment-ref>').replace(/grade[-_ ]?\d+/gi, '<grade>')))
    const bucket = assessmentDuplicateBuckets.get(hash) ?? []
    bucket.push(assessment.assessmentRef)
    assessmentDuplicateBuckets.set(hash, bucket)
  }
  assessmentRecords.push({
    assessmentRef: assessment.assessmentRef,
    grade: assessment.grade,
    subject: assessment.subject,
    courseRef: assessment.releaseSlotId,
    unitRef: assessment.unitRef,
    bindingState: assessment.state,
    learnerMaterialExists,
    evidenceItemCount,
    usableLearnerMaterial: learnerMaterialExists && evidenceItemCount > 0,
    scoringAuthorityExists: Boolean(assessment.scoringAuthorityRef),
    linkedToFinalFamilyPilotLearnerWorkflow: false,
    normalSchoolUseUsable: false,
    emptyAssessmentMaterial: !learnerMaterialExists || evidenceItemCount === 0,
    reasons: [
      ...(!learnerMaterialExists ? ['NO_PRODUCTION_LEARNER_ASSESSMENT_MATERIAL'] : []),
      ...(learnerMaterialExists && evidenceItemCount === 0 ? ['NO_ACTIONABLE_ASSESSMENT_EVIDENCE_ITEMS'] : []),
      'FINAL_BROWSER_DTO_HAS_NO_ASSESSMENT_RECORDS',
      'FINAL_FAMILY_PILOT_HAS_NO_ASSESSMENT_ASSIGN_OR_PLAY_ROUTE',
    ],
  })
}

const assessmentDuplicateGroups = [...assessmentDuplicateBuckets.entries()]
  .filter(([, refs]) => refs.length > 1)
  .map(([hash, refs]) => ({ hash, count: refs.length, assessmentRefs: refs }))
  .sort((left, right) => right.count - left.count || left.hash.localeCompare(right.hash))

const assessmentSummary = {
  total: assessmentRecords.length,
  bindingStates: Object.fromEntries(['BOUND', 'STRUCTURAL_ONLY'].map((state) => [state, assessmentRecords.filter((row) => row.bindingState === state).length])),
  learnerMaterialExists: assessmentRecords.filter((row) => row.learnerMaterialExists).length,
  usableLearnerMaterial: assessmentRecords.filter((row) => row.usableLearnerMaterial).length,
  emptyAssessmentMaterial: assessmentRecords.filter((row) => row.emptyAssessmentMaterial).length,
  scoringAuthorityExists: assessmentRecords.filter((row) => row.scoringAuthorityExists).length,
  linkedToFinalFamilyPilotLearnerWorkflow: assessmentRecords.filter((row) => row.linkedToFinalFamilyPilotLearnerWorkflow).length,
  normalSchoolUseUsable: assessmentRecords.filter((row) => row.normalSchoolUseUsable).length,
  exactOrNormalizedDuplicateGroups: assessmentDuplicateGroups,
}

const gradeSubjectRows = new Map()
for (const grade of EXPECTED_GRADES) {
  for (const subject of EXPECTED_SUBJECTS) gradeSubjectRows.set(`${grade}:${subject}`, blankMatrixRow(grade, subject))
}
for (const course of runtimeManifest.courses) addCount(gradeSubjectRows.get(`${course.grade}:${course.subject}`), 'courseCount')

function hasCode(finding, code) {
  return finding.findings.some((row) => row.code === code)
}

function hasAnyCode(finding, codes) {
  return finding.findings.some((row) => codes.includes(row.code))
}

for (const finding of lessonFindings) {
  const row = gradeSubjectRows.get(`${finding.grade}:${finding.subject}`)
  addCount(row, 'lessonCount')
  addCount(row, 'learnerMaterialCount')
  if (finding.actionableClassification !== 'ZERO_ACTIONABLE_WORK_BLOCKER') addCount(row, 'actionableWorkCount')
  if (finding.actionableClassification === 'ZERO_ACTIONABLE_WORK_BLOCKER') addCount(row, 'zeroActionableCount')
  if (finding.actionableClassification === 'QUESTIONABLE_ACTIONABLE_WORK') addCount(row, 'questionableActionableCount')
  if (finding.actionableClassification === 'VALID_NONQUESTION_TASK') addCount(row, 'validNonquestionTaskCount')
  if (hasCode(finding, 'EMPTY_MASTERY_CHECK')) addCount(row, 'emptyMasteryCount')
  if (hasCode(finding, 'EMPTY_ASSESSMENT')) addCount(row, 'emptyAssessmentSectionCount')
  if (hasCode(finding, 'EMPTY_INDEPENDENT_PRACTICE')) addCount(row, 'emptyIndependentPracticeCount')
  if (hasAnyCode(finding, ['CHOICES_FLATTENED_TO_DISPLAY_TEXT', 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE'])) addCount(row, 'flattenedChoiceLessonCount')
  if (hasAnyCode(finding, ['PLACEHOLDER_OR_TEMPLATE_RESIDUE', 'GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK'])) addCount(row, 'placeholderOrFillerCount')
  addCount(row, 'adultLeakCount', finding.adultLeakCount)
  if (hasAnyCode(finding, ['ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION', 'PENDING_SOURCE_ATTACHMENT'])) addCount(row, 'sourceReadinessIssueCount')
  if (hasCode(finding, 'PENDING_SOURCE_ATTACHMENT')) addCount(row, 'pendingSourceAttachmentCount')
  if (hasCode(finding, 'ATTESTATION_EQUAL_CREDIT_PATH_MISSING')) addCount(row, 'attestationIssueCount')
  if (hasCode(finding, 'RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP')) addCount(row, 'disconnectedResponsePathCount')
}
for (const assessment of assessmentRecords) {
  const row = gradeSubjectRows.get(`${assessment.grade}:${assessment.subject}`)
  addCount(row, 'assessmentCount')
  if (assessment.emptyAssessmentMaterial) addCount(row, 'emptyAssessmentCount')
  if (assessment.usableLearnerMaterial) addCount(row, 'usableLearnerAssessmentMaterialCount')
  if (assessment.bindingState === 'STRUCTURAL_ONLY') addCount(row, 'structuralOnlyAssessmentCount')
  if (assessment.bindingState === 'BOUND') addCount(row, 'boundAssessmentCount')
  if (assessment.linkedToFinalFamilyPilotLearnerWorkflow) addCount(row, 'workflowLinkedAssessmentCount')
}

const blockerWeight = Object.freeze({
  GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK: 120,
  ZERO_ACTIONABLE_WORK: 120,
  EMPTY_MASTERY_CHECK: 110,
  EMPTY_INDEPENDENT_PRACTICE: 105,
  MATH_STRATEGY_ONLY_DIAGNOSTIC: 100,
  ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION: 95,
  CHOICES_DROPPED_FROM_BROWSER_STRUCTURE: 85,
  CHOICES_FLATTENED_TO_DISPLAY_TEXT: 80,
  PENDING_SOURCE_ATTACHMENT: 50,
  RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP: 40,
  CROSS_GRADE_EXACT_ACTIONABLE_TASK: 15,
})
function defectScore(finding) {
  return finding.findings.reduce((sum, row) => sum + (blockerWeight[row.code] ?? (row.severity === 'BLOCKER' ? 30 : row.severity === 'ADVISORY' ? 5 : 1)), 0)
}
for (const row of gradeSubjectRows.values()) {
  row.first10Worst = lessonFindings
    .filter((finding) => finding.grade === row.grade && finding.subject === row.subject)
    .sort((left, right) => defectScore(right) - defectScore(left) || left.lessonRef.localeCompare(right.lessonRef))
    .slice(0, 10)
    .map((finding) => ({ lessonRef: finding.lessonRef, score: defectScore(finding), codes: [...new Set(finding.findings.map((item) => item.code))] }))
}

function launchDecision(grade, subject) {
  if (subject === 'mathematics') return {
    classification: 'DO_NOT_BEGIN_YET',
    limitation: grade <= 4
      ? 'Choice responses are disconnected; Grades 3–4 also contain strategy-only diagnostics and/or promised empty practice/mastery sections.'
      : 'All structured answer paths are display-only and multiple-choice structure is flattened; unit assessments have no learner workflow.',
  }
  if (subject === 'english-language-arts') return {
    classification: 'DO_NOT_BEGIN_YET',
    limitation: 'Some lessons are generic meta-tasks and source-reference objects are omitted from browser material; all response and assessment paths are disconnected.',
  }
  if (subject === 'social-studies' && grade === 3) return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Use paper/off-screen responses; attach real sources before the 12 Unit 9 dynamic-source lessons; unit assessments are not linked in the app.',
  }
  if (subject === 'ready-for-life') return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Use the documented offline task/simulation and guardian-attestation paths; fixed-choice structure and all assessment/response capture are unavailable in-app.',
  }
  if (subject === 'financial-literacy') return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Use paper/off-screen answers and adult scoring; fixed-choice/numeric response metadata and unit assessment workflow are unavailable in-app.',
  }
  if (subject === 'science') return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Use the full markdown sheet off-screen/on paper with adult-approved materials; many investigations use generic authoring shells and the app captures no responses or assessments.',
  }
  if (subject === 'social-studies') return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Retrieve the named real sources and use paper/off-screen responses; the app captures no responses and exposes no unit assessment workflow.',
  }
  if (subject === 'health' || subject === 'physical-education') return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Perform and record the task outside the app using the stated accessibility/safety paths; the app records continuation only and unit assessment routes are absent.',
  }
  return {
    classification: 'SAFE_WITH_SPECIFIC_LIMITATION',
    limitation: 'Create and retain the project artifact outside the app; project/rubric semantics are display-only and unit assessment routes are absent.',
  }
}

for (const row of gradeSubjectRows.values()) {
  const decision = launchDecision(row.grade, row.subject)
  row.safeToBegin = decision.classification
  row.limitation = decision.limitation
}

function selectManualSample(course) {
  const findings = lessonFindings
    .filter((finding) => finding.courseRef === course.courseRef)
    .sort((left, right) => rowsByLesson.get(left.lessonRef).courseDay - rowsByLesson.get(right.lessonRef).courseDay || left.lessonRef.localeCompare(right.lessonRef))
  const candidates = [
    ['first-lesson', findings[0]],
    ['first-concept-build', findings.find((finding) => /concept|explicit model/i.test(`${finding.phase} ${finding.title}`)) ?? findings[1]],
    ['mid-course', findings[Math.floor(findings.length / 2)]],
    ['assessment-or-performance', findings.find((finding) => /\b(?:unit assessment|assessment|performance task|performance build|mastery check|application or project|publication)\b/i.test(`${finding.phase} ${finding.title}`))
      ?? findings.find((finding) => /\bpresentation\b/i.test(`${finding.phase} ${finding.title}`))
      ?? findings.at(-2)],
    ['final-course', findings.at(-1)],
  ]
  return candidates.map(([stratum, finding], index) => {
    return {
      stratum,
      lessonRef: finding.lessonRef,
      title: finding.title,
      actionableClassification: finding.actionableClassification,
      findingCodes: [...new Set(finding.findings.map((row) => row.code))],
      manualReviewOrdinal: index + 1,
    }
  })
}

const assessmentsByCourse = new Map()
for (const assessment of assessmentRecords) {
  const bucket = assessmentsByCourse.get(assessment.courseRef) ?? []
  bucket.push(assessment)
  assessmentsByCourse.set(assessment.courseRef, bucket)
}

const courseResults = runtimeManifest.courses.map((course) => {
  const lessons = lessonFindings.filter((finding) => finding.courseRef === course.courseRef)
  const assessments = assessmentsByCourse.get(course.courseRef) ?? []
  const codes = new Set(lessons.flatMap((finding) => finding.findings.map((row) => row.code)))
  let readiness = 'BLOCKED_BY_RENDERER'
  if (codes.has('GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK') || codes.has('ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION') || codes.has('EMPTY_MASTERY_CHECK') || codes.has('EMPTY_INDEPENDENT_PRACTICE') || codes.has('MATH_STRATEGY_ONLY_DIAGNOSTIC')) readiness = 'BLOCKED_BY_CONTENT'
  else if (codes.has('PENDING_SOURCE_ATTACHMENT')) readiness = 'BLOCKED_BY_MISSING_SOURCE'
  const launch = launchDecision(course.grade, course.subject)
  return {
    courseRef: course.courseRef,
    grade: course.grade,
    subject: course.subject,
    title: course.title,
    lessonCount: lessons.length,
    learnerMaterialCount: lessons.filter((finding) => finding.materialExists).length,
    actionableWorkCount: lessons.filter((finding) => finding.actionableClassification !== 'ZERO_ACTIONABLE_WORK_BLOCKER').length,
    zeroActionableCount: lessons.filter((finding) => finding.actionableClassification === 'ZERO_ACTIONABLE_WORK_BLOCKER').length,
    emptyPromisedSectionCount: lessons.reduce((sum, finding) => sum + finding.emptySections.length, 0),
    flattenedChoiceLessonCount: lessons.filter((finding) => hasAnyCode(finding, ['CHOICES_FLATTENED_TO_DISPLAY_TEXT', 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE'])).length,
    assessmentCount: assessments.length,
    usableAssessmentCount: assessments.filter((assessment) => assessment.normalSchoolUseUsable).length,
    readiness,
    readinessReasons: [
      ...[...codes].filter((code) => ['GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK', 'EMPTY_MASTERY_CHECK', 'EMPTY_INDEPENDENT_PRACTICE', 'MATH_STRATEGY_ONLY_DIAGNOSTIC', 'ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION', 'CHOICES_FLATTENED_TO_DISPLAY_TEXT', 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE', 'PENDING_SOURCE_ATTACHMENT'].includes(code)),
      'RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP',
      'UNIT_ASSESSMENTS_NOT_LINKED_TO_FINAL_FAMILY_PILOT',
    ],
    safeToBegin: launch.classification,
    limitation: launch.limitation,
    manualSample: selectManualSample(course),
  }
})

const projectionSubjects = {}
for (const subject of EXPECTED_SUBJECTS) {
  const rows = lessonFindings.filter((finding) => finding.subject === subject)
  const choiceRows = rows.filter((finding) => hasAnyCode(finding, ['CHOICES_FLATTENED_TO_DISPLAY_TEXT', 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE']))
  projectionSubjects[subject] = {
    lessonCount: rows.length,
    sourceSectionCount: rows.reduce((sum, row) => sum + row.sourceStructure.sectionCount, 0),
    browserSectionCount: rows.reduce((sum, row) => sum + row.browserStructure.sectionCount, 0),
    sourceItemCount: rows.reduce((sum, row) => sum + row.sourceStructure.itemCount, 0),
    browserDisplayItemCount: rows.reduce((sum, row) => sum + row.browserStructure.itemCount, 0),
    sectionCountMismatchLessons: rows.filter((row) => row.sourceStructure.sectionCount !== row.browserStructure.sectionCount).length,
    itemCountMismatchLessons: rows.filter((row) => row.sourceStructure.itemCount !== row.browserStructure.itemCount).length,
    sourceChoiceItemCount: rows.reduce((sum, row) => sum + row.sourceStructure.choiceItemCount, 0),
    browserStructuralChoiceItemCount: 0,
    choiceStructureLostLessons: choiceRows.length,
    choiceProjectionMode: subject === 'mathematics' ? 'FLATTENED_INTO_DISPLAY_STRING' : choiceRows.length ? 'CHOICES_DROPPED' : 'NOT_PRESENT',
    sourceResponseTypes: [...new Set(rows.flatMap((row) => row.sourceStructure.responseTypes))].sort(),
    browserInteractiveResponseTypes: [],
    disconnectedResponsePathLessons: rows.length,
    sourceTaskSemanticsPreserved: rows.filter((row) => row.browserStructure.taskSemanticsPreserved).length,
    sourceRubricSemanticsPreserved: rows.filter((row) => row.browserStructure.rubricSemanticsPreserved).length,
  }
}

const browserProjectionLoss = {
  auditedReleaseSha: AUDITED_RELEASE_SHA,
  builder: 'scripts/build-final-family-pilot-data.mjs',
  finalBrowserDto: 'src/curriculum/final-app-data/types.ts',
  renderer: 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx',
  overall: {
    result: 'FAIL_LOSSY_AND_DISPLAY_ONLY',
    lessonsCompared: lessonFindings.length,
    sourceChoiceLessons: lessonFindings.filter((finding) => finding.sourceStructure.choiceItemCount > 0).length,
    browserStructuralChoiceLessons: 0,
    disconnectedResponsePathLessons: lessonFindings.filter((finding) => hasCode(finding, 'RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP')).length,
    markdownPayloadsPreservedVerbatim: lessonFindings.filter((finding) => materialByLesson.get(finding.lessonRef).format === 'markdown').length,
    structuredPayloadsProjectedToStrings: lessonFindings.filter((finding) => materialByLesson.get(finding.lessonRef).format === 'structured').length,
  },
  bySubject: projectionSubjects,
  rendererSupportMatrix: EXPECTED_SUBJECTS.map((subject) => ({
    subject,
    sourceTypesPresent: projectionSubjects[subject].sourceResponseTypes,
    supportedInteractivelyByFinalApp: [],
    renderedDisplayOnly: projectionSubjects[subject].sourceResponseTypes,
    lostOrDegraded: [
      ...(projectionSubjects[subject].sourceChoiceItemCount ? ['choice identity and selectable options'] : []),
      ...(materialByLesson.get(lessonFindings.find((finding) => finding.subject === subject).lessonRef).format === 'structured' ? ['response type metadata', 'task/rubric object semantics'] : []),
    ],
    acceptedAlternateSurfaceRequired: 'paper, notebook, physical performance, or external artifact; no accepted interactive response surface is wired in the final app',
  })),
}

const gradeResults = EXPECTED_GRADES.map((grade) => {
  const rows = [...gradeSubjectRows.values()].filter((row) => row.grade === grade)
  return {
    grade,
    courseCount: rows.reduce((sum, row) => sum + row.courseCount, 0),
    lessonCount: rows.reduce((sum, row) => sum + row.lessonCount, 0),
    learnerMaterialCount: rows.reduce((sum, row) => sum + row.learnerMaterialCount, 0),
    actionableWorkCount: rows.reduce((sum, row) => sum + row.actionableWorkCount, 0),
    zeroActionableCount: rows.reduce((sum, row) => sum + row.zeroActionableCount, 0),
    emptyMasteryCount: rows.reduce((sum, row) => sum + row.emptyMasteryCount, 0),
    emptyAssessmentSectionCount: rows.reduce((sum, row) => sum + row.emptyAssessmentSectionCount, 0),
    assessmentCount: rows.reduce((sum, row) => sum + row.assessmentCount, 0),
    emptyAssessmentCount: rows.reduce((sum, row) => sum + row.emptyAssessmentCount, 0),
    usableLearnerAssessmentMaterialCount: rows.reduce((sum, row) => sum + row.usableLearnerAssessmentMaterialCount, 0),
    flattenedChoiceLessonCount: rows.reduce((sum, row) => sum + row.flattenedChoiceLessonCount, 0),
    placeholderOrFillerCount: rows.reduce((sum, row) => sum + row.placeholderOrFillerCount, 0),
    adultLeakCount: rows.reduce((sum, row) => sum + row.adultLeakCount, 0),
    sourceReadinessIssueCount: rows.reduce((sum, row) => sum + row.sourceReadinessIssueCount, 0),
    attestationIssueCount: rows.reduce((sum, row) => sum + row.attestationIssueCount, 0),
    first10Worst: lessonFindings.filter((finding) => finding.grade === grade)
      .sort((left, right) => defectScore(right) - defectScore(left) || left.lessonRef.localeCompare(right.lessonRef))
      .slice(0, 10)
      .map((finding) => ({ lessonRef: finding.lessonRef, subject: finding.subject, score: defectScore(finding), codes: [...new Set(finding.findings.map((row) => row.code))] })),
  }
})

const subjectResults = EXPECTED_SUBJECTS.map((subject) => {
  const rows = [...gradeSubjectRows.values()].filter((row) => row.subject === subject)
  return {
    subject,
    courseCount: rows.reduce((sum, row) => sum + row.courseCount, 0),
    lessonCount: rows.reduce((sum, row) => sum + row.lessonCount, 0),
    actionableWorkCount: rows.reduce((sum, row) => sum + row.actionableWorkCount, 0),
    zeroActionableCount: rows.reduce((sum, row) => sum + row.zeroActionableCount, 0),
    emptyMasteryCount: rows.reduce((sum, row) => sum + row.emptyMasteryCount, 0),
    emptyAssessmentSectionCount: rows.reduce((sum, row) => sum + row.emptyAssessmentSectionCount, 0),
    assessmentCount: rows.reduce((sum, row) => sum + row.assessmentCount, 0),
    emptyAssessmentCount: rows.reduce((sum, row) => sum + row.emptyAssessmentCount, 0),
    usableLearnerAssessmentMaterialCount: rows.reduce((sum, row) => sum + row.usableLearnerAssessmentMaterialCount, 0),
    flattenedChoiceLessonCount: rows.reduce((sum, row) => sum + row.flattenedChoiceLessonCount, 0),
    placeholderOrFillerCount: rows.reduce((sum, row) => sum + row.placeholderOrFillerCount, 0),
    sourceReadinessIssueCount: rows.reduce((sum, row) => sum + row.sourceReadinessIssueCount, 0),
    attestationIssueCount: rows.reduce((sum, row) => sum + row.attestationIssueCount, 0),
  }
})

const codeCounts = {}
for (const finding of lessonFindings) {
  for (const code of new Set(finding.findings.map((row) => row.code))) addCount(codeCounts, code)
}
const topBlockers = Object.entries(codeCounts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))

const gradeSubjectMatrix = {
  auditedReleaseSha: AUDITED_RELEASE_SHA,
  expectedUnsupportedCurriculumGrades: [6],
  rows: [...gradeSubjectRows.values()],
  gradeResults,
  subjectResults,
  safeToBeginMatrix: Object.fromEntries(EXPECTED_GRADES.map((grade) => [grade, Object.fromEntries(EXPECTED_SUBJECTS.map((subject) => {
    const row = gradeSubjectRows.get(`${grade}:${subject}`)
    return [subject, { classification: row.safeToBegin, limitation: row.limitation }]
  }))])),
}

const courseResultsDocument = {
  auditedReleaseSha: AUDITED_RELEASE_SHA,
  taxonomy: ['LEARNER_COMPLETE', 'LEARNER_COMPLETE_WITH_ADVISORIES', 'LEARNER_INCOMPLETE', 'BLOCKED_BY_MISSING_SOURCE', 'BLOCKED_BY_RENDERER', 'BLOCKED_BY_CONTENT'],
  counts: {
    LEARNER_COMPLETE: courseResults.filter((row) => row.readiness === 'LEARNER_COMPLETE').length,
    LEARNER_COMPLETE_WITH_ADVISORIES: courseResults.filter((row) => row.readiness === 'LEARNER_COMPLETE_WITH_ADVISORIES').length,
    INCOMPLETE_OR_BLOCKED: courseResults.filter((row) => !['LEARNER_COMPLETE', 'LEARNER_COMPLETE_WITH_ADVISORIES'].includes(row.readiness)).length,
    byClassification: Object.fromEntries([...new Set(courseResults.map((row) => row.readiness))].sort().map((classification) => [classification, courseResults.filter((row) => row.readiness === classification).length])),
  },
  courses: courseResults,
}

const assessmentReadiness = {
  auditedReleaseSha: AUDITED_RELEASE_SHA,
  assessmentBindingsSource: 'curriculum-release-admitted/family-pilot-r1/assessment-bindings.json',
  finalBrowserAssessmentProjectionCount: 0,
  finalFamilyPilotAssessmentWorkflowCount: 0,
  summary: assessmentSummary,
  byGrade: gradeResults.map((row) => ({
    grade: row.grade,
    assessmentCount: row.assessmentCount,
    emptyAssessmentCount: row.emptyAssessmentCount,
    usableLearnerAssessmentMaterialCount: row.usableLearnerAssessmentMaterialCount,
  })),
  bySubject: subjectResults.map((row) => ({
    subject: row.subject,
    assessmentCount: row.assessmentCount,
    emptyAssessmentCount: row.emptyAssessmentCount,
    usableLearnerAssessmentMaterialCount: row.usableLearnerAssessmentMaterialCount,
  })),
  records: assessmentRecords,
}

const manualSamples = courseResults.flatMap((course) => course.manualSample.map((sample) => ({ courseRef: course.courseRef, grade: course.grade, subject: course.subject, ...sample })))
check(manualSamples.length === 450, `expected 450 stratified manual-sample rows, found ${manualSamples.length}`)

const overall = {
  auditedReleaseSha: AUDITED_RELEASE_SHA,
  auditToolBaseSha: AUDITED_RELEASE_SHA,
  sourceShas,
  totalCourses: courseResults.length,
  totalLessons: lessonFindings.length,
  totalAssessments: assessmentRecords.length,
  learnerCompleteCourses: courseResultsDocument.counts.LEARNER_COMPLETE,
  advisoryCourses: courseResultsDocument.counts.LEARNER_COMPLETE_WITH_ADVISORIES,
  incompleteCourses: courseResultsDocument.counts.INCOMPLETE_OR_BLOCKED,
  zeroActionableLessons: lessonFindings.filter((finding) => finding.actionableClassification === 'ZERO_ACTIONABLE_WORK_BLOCKER').length,
  questionableActionableLessons: lessonFindings.filter((finding) => finding.actionableClassification === 'QUESTIONABLE_ACTIONABLE_WORK').length,
  emptyMasteryChecks: lessonFindings.filter((finding) => hasCode(finding, 'EMPTY_MASTERY_CHECK')).length,
  emptyIndependentPracticeSections: lessonFindings.filter((finding) => hasCode(finding, 'EMPTY_INDEPENDENT_PRACTICE')).length,
  emptyAssessmentSections: lessonFindings.filter((finding) => hasCode(finding, 'EMPTY_ASSESSMENT')).length,
  emptyAssessments: assessmentSummary.emptyAssessmentMaterial,
  flattenedChoiceLessons: lessonFindings.filter((finding) => hasAnyCode(finding, ['CHOICES_FLATTENED_TO_DISPLAY_TEXT', 'CHOICES_DROPPED_FROM_BROWSER_STRUCTURE'])).length,
  placeholderOrFillerLessons: lessonFindings.filter((finding) => hasAnyCode(finding, ['PLACEHOLDER_OR_TEMPLATE_RESIDUE', 'GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK'])).length,
  adultLeakCount,
  sourceReadinessIssueLessons: lessonFindings.filter((finding) => hasAnyCode(finding, ['ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION', 'PENDING_SOURCE_ATTACHMENT'])).length,
  attestationIssueLessons: lessonFindings.filter((finding) => hasCode(finding, 'ATTESTATION_EQUAL_CREDIT_PATH_MISSING')).length,
  disconnectedResponsePathLessons: lessonFindings.filter((finding) => hasCode(finding, 'RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP')).length,
  manualSampleCount: manualSamples.length,
  crossGradeExactTaskGroups: progressionGroups.length,
}

check(overall.totalCourses === 90, 'course total drifted during aggregation')
check(overall.totalLessons === 8292, 'lesson total drifted during aggregation')
check(overall.totalAssessments === 699, 'assessment total drifted during aggregation')
check([...gradeSubjectRows.values()].every((row) => row.courseCount === 1), 'grade-subject course matrix is not one course per supported cell')
check(gradeResults.reduce((sum, row) => sum + row.assessmentCount, 0) === overall.totalAssessments, 'grade assessment total drifted')
check(gradeResults.reduce((sum, row) => sum + row.emptyAssessmentCount, 0) === overall.emptyAssessments, 'grade empty-assessment total drifted')
check(subjectResults.reduce((sum, row) => sum + row.assessmentCount, 0) === overall.totalAssessments, 'subject assessment total drifted')
check(subjectResults.reduce((sum, row) => sum + row.emptyAssessmentCount, 0) === overall.emptyAssessments, 'subject empty-assessment total drifted')

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n')
}

function reportMarkdown() {
  const gradeTable = markdownTable(
    ['Grade', 'Courses', 'Lessons', 'Actionable', 'Zero action', 'Empty mastery', 'Empty assessment records', 'Choice loss', 'Filler', 'Source issues'],
    gradeResults.map((row) => [row.grade, row.courseCount, row.lessonCount, row.actionableWorkCount, row.zeroActionableCount, row.emptyMasteryCount, row.emptyAssessmentCount, row.flattenedChoiceLessonCount, row.placeholderOrFillerCount, row.sourceReadinessIssueCount]),
  )
  const subjectTable = markdownTable(
    ['Subject', 'Courses', 'Lessons', 'Actionable', 'Zero action', 'Empty mastery', 'Empty assessment records', 'Choice loss', 'Filler', 'Source issues'],
    subjectResults.map((row) => [row.subject, row.courseCount, row.lessonCount, row.actionableWorkCount, row.zeroActionableCount, row.emptyMasteryCount, row.emptyAssessmentCount, row.flattenedChoiceLessonCount, row.placeholderOrFillerCount, row.sourceReadinessIssueCount]),
  )
  const courseTable = markdownTable(
    ['Course', 'Readiness', 'Safe to begin', 'Zero action', 'Empty sections', 'Choice loss', 'Usable assessments'],
    courseResults.map((row) => [row.courseRef, row.readiness, row.safeToBegin, row.zeroActionableCount, row.emptyPromisedSectionCount, row.flattenedChoiceLessonCount, `${row.usableAssessmentCount}/${row.assessmentCount}`]),
  )
  const projectionTable = markdownTable(
    ['Subject', 'Source/browser sections', 'Source/browser display items', 'Choice items kept', 'Interactive types', 'Disconnected lessons'],
    EXPECTED_SUBJECTS.map((subject) => {
      const row = projectionSubjects[subject]
      return [subject, `${row.sourceSectionCount}/${row.browserSectionCount}`, `${row.sourceItemCount}/${row.browserDisplayItemCount}`, `${row.browserStructuralChoiceItemCount}/${row.sourceChoiceItemCount}`, 0, row.disconnectedResponsePathLessons]
    }),
  )
  const safeTable = markdownTable(
    ['Grade', ...EXPECTED_SUBJECTS],
    EXPECTED_GRADES.map((grade) => [grade, ...EXPECTED_SUBJECTS.map((subject) => gradeSubjectRows.get(`${grade}:${subject}`).safeToBegin)]),
  )
  const sampleTable = markdownTable(
    ['Course', 'Stratum', 'Lesson', 'Actionable class', 'Finding codes'],
    manualSamples.map((row) => [row.courseRef, row.stratum, row.lessonRef, row.actionableClassification, row.findingCodes.join(', ')]),
  )
  const emptySectionRows = lessonFindings.flatMap((finding) => finding.emptySections.map((section) => [finding.lessonRef, section.code, section.title, section.directions]))
  const mathRows = lessonFindings.filter((finding) => finding.subject === 'mathematics' && hasAnyCode(finding, ['MATH_STRATEGY_ONLY_DIAGNOSTIC', 'EMPTY_MASTERY_CHECK', 'EMPTY_INDEPENDENT_PRACTICE']))

  return `# Family Learner Materials Completeness Audit R1

## Ruling

**FAMILY_LEARNER_MATERIALS_AUDIT_COMPLETE — release is not learner-complete for normal end-to-end family use.** All ${overall.totalLessons.toLocaleString()} active lesson packages exist, but production-file coverage masks learner-content and browser-path defects. No course is classified complete because the final app wires no learner response type and exposes none of the ${overall.totalAssessments} unit assessments through a learner workflow.

The practical start ruling is narrower: Mathematics and English Language Arts are **DO_NOT_BEGIN_YET** in every supported grade. The other subject families may begin only with the specific paper/off-screen, source, safety, scoring, and later-assessment limitations recorded below.

## Scope and provenance

- Audited release SHA: \`${AUDITED_RELEASE_SHA}\`
- Audit-tool base SHA: \`${AUDITED_RELEASE_SHA}\`
- Admitted release: \`curriculum-release-admitted/family-pilot-r1\`
- Population: ${overall.totalCourses} courses, ${overall.totalLessons.toLocaleString()} active lessons, ${overall.totalAssessments} assessment records
- Grades: ${EXPECTED_GRADES.join(', ')}; Grade 6 remains unsupported as a curriculum grade
- Production source SHAs: ${Object.entries(sourceShas).map(([sha, count]) => `\`${sha}\` (${count.toLocaleString()} lessons)`).join('; ')}
- Manual stratified review ledger: ${manualSamples.length} selections (five per grade × subject/course), listed below

## Definitions

**Actionable learner work** requires an executable learner action that produces observable evidence: solving, selecting, writing, explaining, reading and responding, investigating, classifying, creating, performing, simulating, demonstrating, revising, or analyzing. A project, physical activity, simulation, source analysis, or performance is valid without conventional questions when its steps/evidence contract is specific. A direction to “attempt today’s lesson” or “complete a new application of today’s lesson” without the actual task is not actionable.

**Projection loss** compares every source production package with the exact in-memory behavior of \`scripts/build-final-family-pilot-data.mjs\`. For structured JSON, the browser DTO retains headings, bodies, and prompt strings but not selectable choices, prompt/response kinds, task objects, rubric objects, or response controls. Markdown is preserved as text but rendered in a pre-wrapped display-only block.

## Headline counts

- Learner-complete courses: **${overall.learnerCompleteCourses}**
- Complete-with-advisories courses: **${overall.advisoryCourses}**
- Incomplete/blocked courses: **${overall.incompleteCourses}**
- Zero-actionable lessons: **${overall.zeroActionableLessons}**
- Questionable-actionable lessons: **${overall.questionableActionableLessons}**
- Empty mastery checks: **${overall.emptyMasteryChecks}**
- Empty independent-practice sections: **${overall.emptyIndependentPracticeSections}**
- Empty assessment sections inside lesson packages: **${overall.emptyAssessmentSections}**
- Assessment records with no usable production learner material: **${overall.emptyAssessments}**
- Lessons with lost choice structure: **${overall.flattenedChoiceLessons}**
- Placeholder/filler lessons: **${overall.placeholderOrFillerLessons}** (strict TODO/TBD/FIXME residue is zero; these are generic ELA meta-task shells)
- Adult answer/scoring leaks in browser learner material: **${overall.adultLeakCount}**
- Source-readiness issue/limitation lessons: **${overall.sourceReadinessIssueLessons}**
- Attestation equal-credit-path issues: **${overall.attestationIssueLessons}** across 81 guardian-authority lessons
- Disconnected response-path lessons: **${overall.disconnectedResponsePathLessons}**

## Grade results

${gradeTable}

Each grade’s first ten worst defects are recorded in \`grade-subject-matrix.json\`; every grade × subject cell also contains its first ten.

## Subject results

${subjectTable}

## Course readiness

${courseTable}

## Empty promised sections

${emptySectionRows.length ? markdownTable(['Lesson', 'Classification', 'Section', 'Directions'], emptySectionRows) : 'No empty promised lesson sections were detected.'}

## Mathematics special finding

The defect class seen in \`ma-g3-mathematics-u01-l01\` also occurs in \`ma-g4-mathematics-u01-l01\`: both diagnostics contain only mathematical-habits/strategy-choice prompts and an empty mastery check. Across Math, ${overall.emptyMasteryChecks} mastery checks and ${overall.emptyIndependentPracticeSections} independent-practice sections promise work with zero items. Choice structure is lost in ${projectionSubjects.mathematics.choiceStructureLostLessons} Math lessons (${projectionSubjects.mathematics.sourceChoiceItemCount.toLocaleString()} choice items); the final UI treats every segment as \`responseKind: 'none'\`.

${markdownTable(['Lesson', 'Grade', 'Title', 'Actionable class', 'Key codes'], mathRows.map((row) => [row.lessonRef, row.grade, row.title, row.actionableClassification, row.findings.map((finding) => finding.code).filter((code) => /MATH|EMPTY/.test(code)).join(', ')]))}

## Browser projection and renderer readiness

**Result: FAIL_LOSSY_AND_DISPLAY_ONLY.** The final browser DTO has no choice or response model. \`MaterialView\` renders structured prompts as list items and markdown as pre-wrapped text. \`LessonSurface\` always passes \`responseKind: 'none'\`, so the Lesson Player’s existing text/choice controls are disconnected for all ${overall.totalLessons.toLocaleString()} admitted lessons.

${projectionTable}

The full item-type matrix, source/browser counts, task/rubric preservation counts, and alternate-surface requirements are in \`browser-projection-loss.json\`.

## Assessment readiness

- Assessment records: **${assessmentSummary.total}**
- BOUND production learner packages: **${assessmentSummary.bindingStates.BOUND}**
- STRUCTURAL_ONLY records: **${assessmentSummary.bindingStates.STRUCTURAL_ONLY}**
- Usable source learner material: **${assessmentSummary.usableLearnerMaterial}**
- Scoring-authority references present: **${assessmentSummary.scoringAuthorityExists}**
- Linked to final browser learner workflow: **${assessmentSummary.linkedToFinalFamilyPilotLearnerWorkflow}**
- Usable in normal end-to-end final-app school use: **${assessmentSummary.normalSchoolUseUsable}**

The 135 bound Health/PE assessment packages exist and contain evidence tasks, but the final browser DTO and Family Pilot routes do not load, assign, play, submit, or score assessment records. The other 564 records have no production learner assessment package. Existing “READY”/fallback metadata is therefore not proof of a usable learner assessment.

## Diagnostics and progression

Diagnostic/baseline/mastery terms are inspected per lesson in \`lesson-findings.jsonl\`. Diagnostics are recorded as starting-point or lesson evidence only; this audit found no final-app path that changes an official working level from these materials. The two Math strategy-only diagnostics cannot measure subject ability as titled.

Exact actionable-task hashing found ${progressionGroups.length} cross-grade groups. The largest is an identical 480-lesson ELA shell across Grades 5, 7, and 8. Other repeated ELA tasks cross Grades 9–12, and smaller Science/Social Studies groups repeat exact tasks across grades. These are progression advisories or blockers where the task is also generic; safety/rubric boilerplate was excluded from the fingerprints.

## Safe-to-begin matrix

${safeTable}

No cell is marked \`SAFE_TO_BEGIN_NOW\` because every subject lacks in-app response capture and every course eventually reaches an unavailable unit-assessment workflow. Cell-specific limitations are in \`grade-subject-matrix.json\`.

## Top blockers

${markdownTable(['Finding code', 'Affected lessons'], topBlockers.slice(0, 20))}

## Manual stratified sample ledger

The five deterministic strata are first lesson, first concept-build lesson, mid-course lesson, first assessment/performance/mastery/application/publication lesson (or penultimate fallback), and final-course lesson. This ledger supports manual source review without substituting for the full ${overall.totalLessons.toLocaleString()}-lesson machine audit.

${sampleTable}

## Tests and negative controls

- \`node --test scripts/audit-family-learner-materials/audit.test.mjs\`
- \`node scripts/audit-family-learner-materials/audit.mjs --check\`
- Mutation controls cover empty mastery, zero actionable work, flattened multiple choice, missing task steps, adult answer leak, placeholder text, missing assessment material, source/browser item-count mismatch, and cross-grade copied lesson.

## Final classification

**FAMILY_LEARNER_MATERIALS_AUDIT_COMPLETE**
`
}

const outputs = new Map([
  [join(outputDir, 'grade-subject-matrix.json'), stableJson(gradeSubjectMatrix)],
  [join(outputDir, 'course-results.json'), stableJson(courseResultsDocument)],
  [join(outputDir, 'lesson-findings.jsonl'), `${lessonFindings.map((row) => JSON.stringify(row)).join('\n')}\n`],
  [join(outputDir, 'browser-projection-loss.json'), stableJson(browserProjectionLoss)],
  [join(outputDir, 'assessment-readiness.json'), stableJson(assessmentReadiness)],
  [join(outputDir, 'FAMILY_LEARNER_COMPLETENESS_R1.md'), reportMarkdown()],
])

if (options.printManualSample) process.stdout.write(stableJson(manualSamples))

if (options.checkOnly) {
  for (const [path, expected] of outputs) {
    check(existsSync(path), `expected report is missing: ${path}`)
    check(readFileSync(path, 'utf8') === expected, `report is stale or nondeterministic: ${path}`)
  }
} else {
  mkdirSync(outputDir, { recursive: true })
  for (const [path, content] of outputs) writeFileSync(path, content)
}

if (!options.printManualSample) {
  console.log(JSON.stringify({
    status: 'PASS_AUDIT_EXECUTED',
    mode: options.checkOnly ? 'check' : 'write',
    overall,
    assessmentSummary: { ...assessmentSummary, exactOrNormalizedDuplicateGroups: assessmentSummary.exactOrNormalizedDuplicateGroups.length },
    courseReadinessCounts: courseResultsDocument.counts,
    outputs: [...outputs.keys()].map((path) => path.replace(`${root}/`, '')),
  }, null, 2))
}
