#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from '../../../../curriculum-production/student-work/technology-arts-lessons/src/courses.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..')
const PACKAGES = resolve(REPO, 'curriculum-production/student-work/technology-arts-lessons/packages/technology')
const ASSESSMENTS = resolve(REPO, 'curriculum-production/final/assessments/packages')
const BINDINGS = resolve(REPO, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')

const BASE_COMMIT = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'
const REVIEW_DATE = '2026-08-14'

const FAMILY_BY_REPAIR = new Map([
  ['The filter checks control.label; the three tests return 1, 0, and 0.', 'HTML_ACCESSIBLE_LABEL'],
  ['The update combines this.value with amount; the three tests return 5, 0, and 3.', 'OBJECT_STATE_UPDATE'],
  ['Initializing best from values[0] makes the invariant true before iteration; the tests return 7, -2, and 6.', 'ALGORITHM_INITIALIZATION'],
  ['Each assignment uses current + delta; the tests return 4, 5, and 5.', 'STALE_STATE_UPDATE'],
  ['The reducer uses total + record.value; the tests return 6, 0, and 0.', 'DATA_AGGREGATION'],
  ['Iteration begins at index 0; all three tests retain every step in order.', 'GENERIC_SEQUENCE_INDEX'],
])

const CLASSIFICATION_BY_MODE = Object.freeze({
  MODEL: 'LEGITIMATE_WORKED_EXAMPLE',
  PROBE: 'FULL_SOLUTION_BEFORE_ATTEMPT',
  GUIDED: 'FULL_SOLUTION_BEFORE_ATTEMPT',
  GUIDED_B: 'FULL_SOLUTION_BEFORE_ATTEMPT',
  BUILD: 'FULL_SOLUTION_BEFORE_ATTEMPT',
  CORRECT: 'FULL_SOLUTION_BEFORE_ATTEMPT',
  DEMONSTRATE: 'SUMMATIVE_SOLUTION_EXPOSURE',
})

const CORRECTION_BY_MODE = Object.freeze({
  MODEL: 'worked example separation',
  PROBE: 'trusted solution reference',
  GUIDED: 'hint ladder',
  GUIDED_B: 'hint ladder',
  BUILD: 'hint ladder plus trusted solution reference',
  CORRECT: 'post-submission review',
  DEMONSTRATE: 'trusted solution reference, then post-submission review',
})

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

function walk(dir, predicate) {
  const paths = []
  for (const name of readdirSync(dir).sort()) {
    const path = resolve(dir, name)
    if (statSync(path).isDirectory()) paths.push(...walk(path, predicate))
    else if (predicate(path)) paths.push(path)
  }
  return paths
}

function sourceLabel(path) {
  if (path.startsWith(`${REPO}/`)) return relative(REPO, path)
  return relative(REPO, path)
}

function lineContaining(text, needle) {
  const line = text.split('\n').findIndex((value) => value.includes(needle))
  return line < 0 ? null : line + 1
}

function countBy(rows, key) {
  return Object.fromEntries(
    [...new Set(rows.map(key))].sort().map((value) => [value, rows.filter((row) => key(row) === value).length]),
  )
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? String(value) : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const authoredSources = new Map()
for (const course of COURSES.filter((entry) => entry.subjectKey === 'technology')) {
  const sourceText = readFileSync(course.lessonsPath, 'utf8')
  sourceText.split('\n').forEach((line, index) => {
    if (!line.trim()) return
    const lesson = JSON.parse(line)
    authoredSources.set(lesson.lesson_id, {
      path: sourceLabel(course.lessonsPath),
      line: index + 1,
      sha256: sha256(line),
    })
  })
}

const assessmentByLesson = new Map()
for (const path of walk(ASSESSMENTS, (candidate) => candidate.endsWith('.json'))) {
  const value = readJson(path)
  const lessonId = value.location?.assessmentLessonRef
  if (lessonId && value.subject === 'technology') {
    assessmentByLesson.set(lessonId, { path, value, raw: readFileSync(path, 'utf8') })
  }
}

const bindingByLesson = new Map(
  readFileSync(BINDINGS, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    .filter((binding) => binding.subject === 'technology')
    .map((binding) => [binding.lessonRef, binding]),
)

const packagePaths = walk(PACKAGES, (path) => path.endsWith('.task-package.json'))
const cases = []
for (const path of packagePaths) {
  const raw = readFileSync(path, 'utf8')
  const pkg = JSON.parse(raw)
  if (pkg.activity_setup?.activity_kind !== 'CODE_OR_DEBUG') continue

  const repair = pkg.activity_setup.debugging_target?.passing_change
  const family = FAMILY_BY_REPAIR.get(repair)
  if (!family) throw new Error(`${pkg.lesson_id}: learner-visible repair is not one of the six inspected generator families`)

  const classification = CLASSIFICATION_BY_MODE[pkg.work_mode]
  if (!classification) throw new Error(`${pkg.lesson_id}: unreviewed work mode ${pkg.work_mode}`)
  const source = authoredSources.get(pkg.lesson_id)
  if (!source) throw new Error(`${pkg.lesson_id}: authored source row was not resolved through courses.mjs`)

  const summative = pkg.scoring_stance === 'SUMMATIVE'
  const assessment = assessmentByLesson.get(pkg.lesson_id)
  const binding = bindingByLesson.get(pkg.lesson_id)
  if (!binding) throw new Error(`${pkg.lesson_id}: admitted production binding not found`)
  if (summative && !assessment) throw new Error(`${pkg.lesson_id}: canonical assessment package not found`)

  const directAssessmentExposesRepair = summative
    ? assessment.raw.includes(repair) || assessment.raw.includes('passing_change') || assessment.raw.includes('activity_setup')
    : null
  const admittedPackageMatches = binding.productionPackageRef.endsWith(relative(REPO, path))

  cases.push({
    case_number: 0,
    lesson_id: pkg.lesson_id,
    grade: pkg.grade,
    phase: pkg.phase,
    work_mode: pkg.work_mode,
    scoring_stance: pkg.scoring_stance,
    focus: pkg.focus,
    classification,
    answer_authority_boundary_violation: classification !== 'LEGITIMATE_WORKED_EXAMPLE',
    learner_visible_repair: repair,
    generator_family: family,
    authored_source: source.path,
    authored_source_line: source.line,
    authored_source_row_sha256: source.sha256,
    generated_learner_package: relative(REPO, path),
    generated_repair_line: lineContaining(raw, '"passing_change"'),
    generated_package_sha256: sha256(raw),
    generator: 'curriculum-production/student-work/technology-arts-lessons/src/technologyActivitySetup.mjs::buildTechnologyActivitySetup>codeFixture>buildCodeCase',
    learner_projection: 'scripts/learner-projection/structured-projection-r1.mjs::projectJsonLearnerMaterial(activitySetup=value.activity_setup)',
    lesson_renderer: 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx::MaterialView',
    correction_model: CORRECTION_BY_MODE[pkg.work_mode],
    summative_review: summative ? {
      learner_can_open_admitted_mastery_lesson: true,
      admitted_package_matches_reviewed_package: admittedPackageMatches,
      lesson_surface_exposes_repair_before_response_save: true,
      canonical_assessment_ref: assessment.value.assessmentRef,
      canonical_assessment_package: relative(REPO, assessment.path),
      canonical_assessment_surface_exposes_repair: directAssessmentExposesRepair,
      canonical_assessment_answer_material_included_flag: assessment.value.productionReadiness?.answerMaterialIncluded,
      adult_scoring_authority_restricted: String(assessment.value.adultScoringAuthorityRef).startsWith('restricted:'),
      learner_can_see_expected_solution_before_protected_evidence_collected: true,
      determination_basis: 'The admitted mastery lesson renders activitySetup, including passing_change, in MaterialView before the adjacent learner-response control saves evidence. The separate canonical assessment projection omits activity_setup, but that does not revoke learner access to the admitted mastery lesson source.',
    } : null,
  })
}

cases.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id))
cases.forEach((row, index) => { row.case_number = index + 1 })

if (cases.length !== 87) throw new Error(`Expected 87 cases, found ${cases.length}`)
if (cases.filter((row) => row.scoring_stance === 'SUMMATIVE').length !== 12) {
  throw new Error('Expected 12 summative cases')
}
if (cases.filter((row) => row.summative_review).some((row) => row.summative_review.canonical_assessment_surface_exposes_repair !== false)) {
  throw new Error('A canonical assessment projection unexpectedly exposes a reviewed repair')
}
if (cases.some((row) => row.summative_review?.admitted_package_matches_reviewed_package === false)) {
  throw new Error('A summative admitted binding does not resolve to the reviewed learner package')
}

const generatorSource = readFileSync(resolve(REPO, 'curriculum-production/student-work/technology-arts-lessons/src/technologyActivitySetup.mjs'), 'utf8')
const projectorSource = readFileSync(resolve(REPO, 'scripts/learner-projection/structured-projection-r1.mjs'), 'utf8')
const lessonUiSource = readFileSync(resolve(REPO, 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx'), 'utf8')
const playerSource = readFileSync(resolve(REPO, 'src/study/family-pilot/lesson-player/FamilyPilotLessonPlayer.tsx'), 'utf8')
const assessmentGeneratorSource = readFileSync(resolve(REPO, 'curriculum-production/final/assessments/src/generate.mjs'), 'utf8')
const assessmentWorkflowSource = readFileSync(resolve(REPO, 'src/study/family-pilot/final-app/assessment/workflow.ts'), 'utf8')

const renderIndex = lessonUiSource.indexOf('<MaterialView material={result.material} />')
const responseIndex = lessonUiSource.indexOf('<FamilyPilotLessonPlayer', renderIndex)
const boundaryChecks = {
  generator_emits_passing_change: generatorSource.includes('passing_change: codeCase.passing'),
  learner_projection_copies_activity_setup_wholesale: projectorSource.includes('activitySetup: value.activity_setup'),
  learner_projection_forbidden_key_rule_does_not_name_passing_change: !projectorSource.match(/FORBIDDEN_KEY[^\n]*passing_change/),
  lesson_ui_renders_activity_setup: lessonUiSource.includes("['Technology activity setup', material.activitySetup]"),
  lesson_ui_renders_material_before_adjacent_response_player: renderIndex >= 0 && responseIndex > renderIndex,
  response_is_saved_only_after_submit_action: playerSource.includes('onSubmitAction(trimmed)'),
  canonical_assessment_generator_only_extracts_primary_task_and_deliverable: assessmentGeneratorSource.includes("['primary-task', source.primary_task]") && assessmentGeneratorSource.includes("['deliverable', source.deliverable]"),
  canonical_assessment_generator_marks_answer_material_false: assessmentGeneratorSource.includes('answerMaterialIncluded: false'),
  assessment_workflow_forbidden_keys_do_not_name_passing_change: !assessmentWorkflowSource.match(/forbiddenKeys[\s\S]{0,500}passing_change/),
}
if (Object.values(boundaryChecks).some((value) => value !== true)) {
  throw new Error(`Boundary trace failed: ${JSON.stringify(boundaryChecks)}`)
}

const report = {
  schema_version: 'technology-solution-exposure-review-r1.1',
  review_status: 'COMPLETE',
  review_date: REVIEW_DATE,
  base_commit: BASE_COMMIT,
  scope: {
    subject: 'Technology/Computer Science',
    generated_lessons_reviewed: cases.length,
    summative_lessons_reviewed: cases.filter((row) => row.scoring_stance === 'SUMMATIVE').length,
    selection_rule: 'Generated learner task packages where activity_setup.activity_kind is CODE_OR_DEBUG.',
  },
  classification_counts: countBy(cases, (row) => row.classification),
  mode_counts: countBy(cases, (row) => row.work_mode),
  scoring_stance_counts: countBy(cases, (row) => row.scoring_stance),
  generator_family_counts: countBy(cases, (row) => row.generator_family),
  correction_model_counts: countBy(cases, (row) => row.correction_model),
  conclusions: {
    exact_repair_is_full_solution: true,
    guided_hint_cases: cases.filter((row) => row.classification === 'GUIDED_HINT').length,
    full_solution_after_attempt_cases: cases.filter((row) => row.classification === 'FULL_SOLUTION_AFTER_ATTEMPT').length,
    false_positive_cases: cases.filter((row) => row.classification === 'FALSE_POSITIVE').length,
    violations: cases.filter((row) => row.answer_authority_boundary_violation).length,
    legitimate_worked_examples: cases.filter((row) => row.classification === 'LEGITIMATE_WORKED_EXAMPLE').length,
    summative_pre_evidence_exposures: cases.filter((row) => row.summative_review?.learner_can_see_expected_solution_before_protected_evidence_collected).length,
    answer_authority_boundary: 'VIOLATED_SEMANTIC_SOLUTION_IN_LEARNER_MATERIAL',
    formal_adult_key_field_leak: false,
  },
  classification_rule: {
    LEGITIMATE_WORKED_EXAMPLE: 'MODEL is explicitly a non-penalty worked-model trace; the repair may be shown only as the instructional model, separate from any fresh transfer evidence.',
    FULL_SOLUTION_BEFORE_ATTEMPT: 'The exact repair token/operator/field/initialization and passing outputs are visible in the same ungated learner package before the response is saved. Phase names such as CORRECT do not prove that an attempt on this exact fixture was collected.',
    SUMMATIVE_SOLUTION_EXPOSURE: 'DEMONSTRATE is SUMMATIVE and promises no scaffold, prompt, or worked example in view, yet the same learner surface displays the exact passing repair before evidence capture.',
  },
  boundary_checks: boundaryChecks,
  source_hashes: {
    generator_sha256: sha256(generatorSource),
    learner_projection_sha256: sha256(projectorSource),
    lesson_ui_sha256: sha256(lessonUiSource),
    lesson_player_sha256: sha256(playerSource),
    assessment_generator_sha256: sha256(assessmentGeneratorSource),
    assessment_workflow_sha256: sha256(assessmentWorkflowSource),
    reviewed_package_corpus_sha256: sha256(cases.map((row) => `${row.lesson_id}:${row.generated_package_sha256}`).join('\n')),
  },
  cases,
}

writeFileSync(resolve(HERE, 'case-review.json'), `${JSON.stringify(report, null, 2)}\n`)

const columns = [
  'case_number', 'lesson_id', 'grade', 'phase', 'work_mode', 'scoring_stance', 'focus', 'classification',
  'answer_authority_boundary_violation', 'generator_family', 'learner_visible_repair', 'authored_source',
  'authored_source_line', 'generated_learner_package', 'generated_repair_line', 'correction_model',
  'summative_pre_evidence_exposure', 'canonical_assessment_surface_exposes_repair',
]
const csvRows = cases.map((row) => ({
  ...row,
  summative_pre_evidence_exposure: row.summative_review?.learner_can_see_expected_solution_before_protected_evidence_collected ?? null,
  canonical_assessment_surface_exposes_repair: row.summative_review?.canonical_assessment_surface_exposes_repair ?? null,
}))
const csv = [columns.join(','), ...csvRows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n')
writeFileSync(resolve(HERE, 'case-review.csv'), `${csv}\n`)

console.log(`Reviewed ${cases.length} cases; ${report.conclusions.violations} boundary violations and ${report.conclusions.legitimate_worked_examples} legitimate worked examples.`)
console.log(`Summative pre-evidence exposures: ${report.conclusions.summative_pre_evidence_exposures}/12`)
console.log(`Wrote ${resolve(HERE, 'case-review.json')}`)
console.log(`Wrote ${resolve(HERE, 'case-review.csv')}`)
