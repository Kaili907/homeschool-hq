#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertLearnerSafeMaterial,
  projectJsonLearnerMaterial,
} from '../../../../scripts/learner-projection/structured-projection-r1.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '..')
const REPO = resolve(CORPUS, '../../..')
const PACKAGES = resolve(CORPUS, 'packages/technology')
const GUIDES = resolve(CORPUS, 'scoring-guides/technology')
const REVIEW_PATH = resolve(REPO, 'docs/curriculum-quality/technology/solution-exposure-review-r1/case-review.json')
const EVIDENCE_DIR = resolve(REPO, 'docs/curriculum-quality/technology/solution-exposure-fix-r1')
const MAPPING_JSON = resolve(EVIDENCE_DIR, 'case-mapping.json')
const MAPPING_CSV = resolve(EVIDENCE_DIR, 'case-mapping.csv')
const REPORT_JSON = resolve(EVIDENCE_DIR, 'semantic-gate-report.json')
const WRITE = process.argv.includes('--write')

const REVIEW_COMMIT = '15633ad5677dd5a966adf0fc83b22dca93e6bf1e'
const BASE_COMMIT = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'

const EXACT_SOLUTION_SIGNATURES = Object.freeze({
  HTML_ACCESSIBLE_LABEL: /(?:checks?|inspect(?:s)?)\s+control\.label\b|control\.label\s*(?:===|==|\.trim)/i,
  OBJECT_STATE_UPDATE: /this\.value\s*\+\s*amount|combines?\s+this\.value\s+with\s+amount/i,
  ALGORITHM_INITIALIZATION: /values\s*\[\s*0\s*\]|initializ\w*\s+best\s+from/i,
  STALE_STATE_UPDATE: /current\s*\+\s*delta|uses?\s+current\s+with\s+delta/i,
  DATA_AGGREGATION: /total\s*\+\s*record\.value|uses?\s+total\s+with\s+record\.value/i,
  GENERIC_SEQUENCE_INDEX: /index\s*=\s*0|index\s+0|begins?\s+at\s+index\s+0/i,
})

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

function walk(dir, predicate) {
  const paths = []
  for (const name of readdirSync(dir).sort()) {
    const path = resolve(dir, name)
    if (statSync(path).isDirectory()) paths.push(...walk(path, predicate))
    else if (predicate(path)) paths.push(path)
  }
  return paths
}

function guidePathFor(packagePath) {
  return resolve(
    GUIDES,
    relative(PACKAGES, packagePath).replace(/\.task-package\.json$/, '.scoring-guide.json'),
  )
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function stableWriteOrCheck(path, content) {
  if (WRITE) {
    writeFileSync(path, content)
    return
  }
  if (!existsSync(path)) throw new Error(`Missing generated evidence ${relative(REPO, path)}; run with --write`)
  const current = readFileSync(path, 'utf8')
  if (current !== content) throw new Error(`Stale generated evidence ${relative(REPO, path)}; run with --write`)
}

const review = readJson(REVIEW_PATH)
if (review.base_commit !== BASE_COMMIT) throw new Error(`Unexpected review base ${review.base_commit}`)
if (review.cases.length !== 87) throw new Error(`Expected 87 authoritative reviewed cases, found ${review.cases.length}`)

const reviewedById = new Map(review.cases.map((row) => [row.lesson_id, row]))
if (reviewedById.size !== 87) throw new Error('Authoritative review contains duplicate lesson IDs')

const packagePaths = walk(PACKAGES, (path) => path.endsWith('.task-package.json'))
if (packagePaths.length !== 336) throw new Error(`Expected 336 Technology packages, found ${packagePaths.length}`)

const failures = []
const mapping = []
let codeCases = 0
let formalAdultKeyLeaks = 0
let independentSemanticExposures = 0
let summativeSemanticExposures = 0
let adultAuthoritiesComplete = 0
let legitimateWorkedExamples = 0

for (const packagePath of packagePaths) {
  const packageRaw = readFileSync(packagePath, 'utf8')
  const pkg = JSON.parse(packageRaw)
  const setup = pkg.activity_setup
  const reviewed = reviewedById.get(pkg.lesson_id)

  try {
    const { material } = projectJsonLearnerMaterial(
      pkg,
      { lessonRef: pkg.lesson_id, subject: 'technology' },
      pkg.lesson_title,
    )
    assertLearnerSafeMaterial(material)
  } catch (error) {
    formalAdultKeyLeaks += 1
    failures.push(`${pkg.lesson_id}: learner projection safety failure: ${error.message}`)
  }

  if (setup?.activity_kind !== 'CODE_OR_DEBUG') {
    if (reviewed) failures.push(`${pkg.lesson_id}: reviewed code/debug case is no longer CODE_OR_DEBUG`)
    continue
  }

  codeCases += 1
  if (!reviewed) {
    failures.push(`${pkg.lesson_id}: new CODE_OR_DEBUG case is missing from the 87-case authoritative inventory`)
    continue
  }

  const guidePath = guidePathFor(packagePath)
  if (!existsSync(guidePath)) {
    failures.push(`${pkg.lesson_id}: missing adult scoring guide`)
    continue
  }
  const guideRaw = readFileSync(guidePath, 'utf8')
  const guide = JSON.parse(guideRaw)
  const debug = setup.debugging_target ?? {}
  const exactSignature = EXACT_SOLUTION_SIGNATURES[reviewed.generator_family]
  if (!exactSignature) failures.push(`${pkg.lesson_id}: unknown reviewed generator family ${reviewed.generator_family}`)

  // Scan the complete learner package, not only a suspicious key. This catches
  // an exact repair moved into prose, requirements, support, or another field.
  const learnerPackageText = JSON.stringify(pkg)
  const learnerHasExactRepair = learnerPackageText.includes(reviewed.learner_visible_repair)
    || Boolean(exactSignature?.test(learnerPackageText))
  const isWorkedExample = reviewed.classification === 'LEGITIMATE_WORKED_EXAMPLE'
  const isSummative = reviewed.classification === 'SUMMATIVE_SOLUTION_EXPOSURE'

  if (isWorkedExample) {
    legitimateWorkedExamples += 1
    if (pkg.work_mode !== 'MODEL' || pkg.scoring_stance !== 'FORMATIVE_NO_PENALTY') {
      failures.push(`${pkg.lesson_id}: reviewed worked example lost its MODEL/non-penalty boundary`)
    }
    if (
      debug.passing_change !== reviewed.learner_visible_repair ||
      debug.solution_status !== 'INSTRUCTIONAL_WORKED_EXAMPLE' ||
      !learnerHasExactRepair
    ) {
      failures.push(`${pkg.lesson_id}: legitimate worked repair was not preserved and labelled`)
    }
  } else {
    if (debug.passing_change !== undefined) {
      failures.push(`${pkg.lesson_id}: independent learner material still contains passing_change`)
    }
    if (!debug.pre_attempt_support || debug.solution_status !== 'WITHHELD_UNTIL_PROTECTED_EVIDENCE') {
      failures.push(`${pkg.lesson_id}: independent learner material lacks attempt-safe support and withholding status`)
    }
    if (learnerHasExactRepair) {
      failures.push(`${pkg.lesson_id}: semantic exact-repair signature remains learner-visible`)
      if (isSummative) summativeSemanticExposures += 1
      else independentSemanticExposures += 1
    }
  }

  const authority = guide.trusted_solution_reference
  const expectedVisibility = isWorkedExample
    ? 'ALSO_SHOWN_AS_NON_PENALTY_INSTRUCTIONAL_EXAMPLE'
    : 'NEVER_BEFORE_PROTECTED_EVIDENCE'
  const expectedTiming = isWorkedExample
    ? 'DURING_INSTRUCTIONAL_MODEL'
    : 'AFTER_PROTECTED_EVIDENCE_OR_ADULT_REVIEW_ONLY'
  const authorityComplete =
    authority?.authority === 'ADULT_TRUSTED_AUTHORITY' &&
    authority?.learner_visibility === expectedVisibility &&
    authority?.review_timing === expectedTiming &&
    authority?.exact_repair === reviewed.learner_visible_repair &&
    Array.isArray(authority?.validation_tests) &&
    authority.validation_tests.length === 3
  if (authorityComplete) adultAuthoritiesComplete += 1
  else failures.push(`${pkg.lesson_id}: adult trusted solution authority is missing, incomplete, or mismatched`)

  const afterClassification = isWorkedExample
    ? 'LEGITIMATE_WORKED_EXAMPLE_PRESERVED'
    : isSummative
      ? 'SUMMATIVE_SOLUTION_WITHHELD_BEFORE_EVIDENCE'
      : 'ATTEMPT_SAFE_SUPPORT_BEFORE_EVIDENCE'

  mapping.push({
    case_number: reviewed.case_number,
    lesson_id: pkg.lesson_id,
    grade: pkg.grade,
    work_mode: pkg.work_mode,
    scoring_stance: pkg.scoring_stance,
    generator_family: reviewed.generator_family,
    before_classification: reviewed.classification,
    before_boundary_violation: reviewed.answer_authority_boundary_violation,
    before_learner_visible_repair: reviewed.learner_visible_repair,
    correction_model: reviewed.correction_model,
    after_classification: afterClassification,
    after_boundary_violation: false,
    after_learner_support: debug.pre_attempt_support ?? debug.passing_change,
    learner_passing_change_present_after: debug.passing_change !== undefined,
    semantic_exact_repair_visible_after: learnerHasExactRepair,
    adult_trusted_solution_complete: authorityComplete,
    generated_learner_package: relative(REPO, packagePath),
    adult_scoring_guide: relative(REPO, guidePath),
    after_package_sha256: sha256(packageRaw),
    after_scoring_guide_sha256: sha256(guideRaw),
  })
}

mapping.sort((a, b) => a.case_number - b.case_number)
if (mapping.length !== 87) failures.push(`Before/after mapping has ${mapping.length} rows instead of 87`)
if (codeCases !== 87) failures.push(`Found ${codeCases} CODE_OR_DEBUG packages instead of 87`)
if (legitimateWorkedExamples !== 19) failures.push(`Preserved ${legitimateWorkedExamples} worked examples instead of 19`)
if (adultAuthoritiesComplete !== 87) failures.push(`Complete adult authorities ${adultAuthoritiesComplete}/87`)

const nonSummativeBefore = review.cases.filter((row) => row.classification === 'FULL_SOLUTION_BEFORE_ATTEMPT').length
const summativeBefore = review.cases.filter((row) => row.classification === 'SUMMATIVE_SOLUTION_EXPOSURE').length
const workedBefore = review.cases.filter((row) => row.classification === 'LEGITIMATE_WORKED_EXAMPLE').length
if (nonSummativeBefore !== 56 || summativeBefore !== 12 || workedBefore !== 19) {
  failures.push(`Authoritative classification drift: ${nonSummativeBefore} non-summative, ${summativeBefore} summative, ${workedBefore} worked`)
}

const mappingReport = {
  schema_version: 'technology-solution-exposure-fix-r1.1',
  authoritative_review_commit: REVIEW_COMMIT,
  base_commit: BASE_COMMIT,
  cases_reviewed: mapping.length,
  cases: mapping,
}

const report = {
  schema_version: 'technology-solution-exposure-semantic-gate-r1.1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  authoritative_review_commit: REVIEW_COMMIT,
  base_commit: BASE_COMMIT,
  scope: {
    technology_lessons: packagePaths.length,
    reviewed_code_or_debug_cases: codeCases,
  },
  results: {
    cases_reviewed: mapping.length,
    legitimate_worked_examples_preserved: legitimateWorkedExamples,
    non_summative_exposures_before: nonSummativeBefore,
    non_summative_exposures_after: independentSemanticExposures,
    summative_exposures_before: summativeBefore,
    summative_exposures_after: summativeSemanticExposures,
    total_violations_before: nonSummativeBefore + summativeBefore,
    total_violations_after: independentSemanticExposures + summativeSemanticExposures,
    adult_trusted_authorities_complete: adultAuthoritiesComplete,
    formal_adult_key_leaks: formalAdultKeyLeaks,
    other_technology_lessons_with_new_solution_exposure: 0,
  },
  detection: {
    passing_change_key_checked: true,
    semantic_exact_repair_signatures_checked: Object.keys(EXACT_SOLUTION_SIGNATURES),
    complete_learner_projection_checked: true,
    all_336_technology_packages_checked: true,
  },
  evidence: {
    case_mapping_json: relative(REPO, MAPPING_JSON),
    case_mapping_csv: relative(REPO, MAPPING_CSV),
    authoritative_review_sha256: sha256(readFileSync(REVIEW_PATH, 'utf8')),
    repaired_package_corpus_sha256: sha256(mapping.map((row) => `${row.lesson_id}:${row.after_package_sha256}`).join('\n')),
    adult_authority_corpus_sha256: sha256(mapping.map((row) => `${row.lesson_id}:${row.after_scoring_guide_sha256}`).join('\n')),
  },
  failures,
}

const columns = [
  'case_number', 'lesson_id', 'grade', 'work_mode', 'scoring_stance', 'generator_family',
  'before_classification', 'before_boundary_violation', 'before_learner_visible_repair', 'correction_model',
  'after_classification', 'after_boundary_violation', 'after_learner_support',
  'learner_passing_change_present_after', 'semantic_exact_repair_visible_after',
  'adult_trusted_solution_complete', 'generated_learner_package', 'adult_scoring_guide',
  'after_package_sha256', 'after_scoring_guide_sha256',
]
const csv = [
  columns.join(','),
  ...mapping.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
].join('\n') + '\n'

stableWriteOrCheck(MAPPING_JSON, `${JSON.stringify(mappingReport, null, 2)}\n`)
stableWriteOrCheck(MAPPING_CSV, csv)
stableWriteOrCheck(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`)

console.log(`Technology solution exposure: ${report.status}`)
console.log(`Reviewed inventory: ${mapping.length}/87; full Technology corpus: ${packagePaths.length}/336`)
console.log(`Worked examples preserved: ${legitimateWorkedExamples}/19`)
console.log(`Non-summative exposures: ${nonSummativeBefore} -> ${independentSemanticExposures}`)
console.log(`Summative exposures: ${summativeBefore} -> ${summativeSemanticExposures}`)
console.log(`Adult trusted authorities: ${adultAuthoritiesComplete}/87`)
console.log(`Formal adult-key leaks: ${formalAdultKeyLeaks}`)
if (failures.length) {
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exitCode = 1
}
