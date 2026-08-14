#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertLearnerSafeMaterial,
  projectJsonLearnerMaterial,
} from '../../../../scripts/learner-projection/structured-projection-r1.mjs'
import {
  compareSolutionExposure,
  findCoursePayloadExposures,
  recordFromMaterial,
} from './course-payload-solution-equivalence.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '..')
const REPO = resolve(CORPUS, '../../..')
const PACKAGES = resolve(CORPUS, 'packages/technology')
const GUIDES = resolve(CORPUS, 'scoring-guides/technology')
const REVIEW_PATH = resolve(REPO, 'docs/curriculum-quality/technology/solution-exposure-review-r1/case-review.json')
const BINDINGS_PATH = resolve(REPO, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
const EVIDENCE_DIR = resolve(REPO, 'docs/curriculum-quality/technology/solution-exposure-fix-r2')
const MAPPING_JSON = resolve(EVIDENCE_DIR, 'case-mapping.json')
const MAPPING_CSV = resolve(EVIDENCE_DIR, 'case-mapping.csv')
const REPORT_JSON = resolve(EVIDENCE_DIR, 'semantic-gate-report.json')
const BROWSER_PROOF_JSON = resolve(EVIDENCE_DIR, 'browser-payload-proof.json')
const WRITE = process.argv.includes('--write')

const PARENT_REPAIR = '7de7b9ad0e9af396937270079f4db0e0d4118990'
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
  const text = Array.isArray(value) ? value.join('|') : value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function stableWriteOrCheck(path, content) {
  if (WRITE) {
    mkdirSync(dirname(path), { recursive: true })
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

const technologyBindings = readFileSync(BINDINGS_PATH, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  .filter((binding) => binding.subject === 'technology')
const bindingByLesson = new Map(technologyBindings.map((binding) => [binding.lessonRef, binding]))
const browserCourseRefs = [...new Set(technologyBindings.map((binding) => binding.courseRef))].sort()

const packagePaths = walk(PACKAGES, (path) => path.endsWith('.task-package.json'))
if (packagePaths.length !== 336) throw new Error(`Expected 336 Technology packages, found ${packagePaths.length}`)

const failures = []
const records = []
const packageRows = []
const projectedByCourse = new Map()
let codeCases = 0
let formalAdultKeyLeaks = 0
let adultAuthoritiesComplete = 0
let legitimateWorkedExamples = 0

if (technologyBindings.length !== 336 || bindingByLesson.size !== 336 || browserCourseRefs.length !== 9) {
  failures.push(`Browser binding boundary is ${technologyBindings.length} rows, ${bindingByLesson.size} lessons, ${browserCourseRefs.length} courses; expected 336/336/9`)
}

for (const packagePath of packagePaths) {
  const packageRaw = readFileSync(packagePath, 'utf8')
  const pkg = JSON.parse(packageRaw)
  const setup = pkg.activity_setup
  const reviewed = reviewedById.get(pkg.lesson_id)
  const binding = bindingByLesson.get(pkg.lesson_id)
  const guidePath = guidePathFor(packagePath)
  const guideRaw = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : ''
  const guide = guideRaw ? JSON.parse(guideRaw) : null

  if (!binding) failures.push(`${pkg.lesson_id}: absent from the admitted browser course payload bindings`)
  let material = null
  try {
    const projection = projectJsonLearnerMaterial(
      pkg,
      { lessonRef: pkg.lesson_id, subject: 'technology' },
      pkg.lesson_title,
    )
    material = projection.material
    assertLearnerSafeMaterial(material)
    const bucket = projectedByCourse.get(binding?.courseRef) ?? []
    bucket.push([pkg.lesson_id, material])
    projectedByCourse.set(binding?.courseRef, bucket)
  } catch (error) {
    formalAdultKeyLeaks += 1
    failures.push(`${pkg.lesson_id}: learner projection safety failure: ${error.message}`)
  }

  if (setup?.activity_kind !== 'CODE_OR_DEBUG') {
    if (reviewed) failures.push(`${pkg.lesson_id}: reviewed code/debug case is no longer CODE_OR_DEBUG`)
    packageRows.push({ lessonId: pkg.lesson_id, packageRaw, guideRaw })
    continue
  }

  codeCases += 1
  if (!reviewed) {
    failures.push(`${pkg.lesson_id}: new CODE_OR_DEBUG case is missing from the 87-case authoritative inventory`)
    packageRows.push({ lessonId: pkg.lesson_id, packageRaw, guideRaw })
    continue
  }
  if (!guide) failures.push(`${pkg.lesson_id}: missing adult scoring guide`)

  const debug = setup.debugging_target ?? {}
  const exactSignature = EXACT_SOLUTION_SIGNATURES[reviewed.generator_family]
  const isWorkedExample = reviewed.classification === 'LEGITIMATE_WORKED_EXAMPLE'
  const isSummative = reviewed.classification === 'SUMMATIVE_SOLUTION_EXPOSURE'
  const learnerPackageText = JSON.stringify(pkg)
  const protectedExactRepairVisible = !isWorkedExample && (
    learnerPackageText.includes(reviewed.learner_visible_repair) || Boolean(exactSignature?.test(learnerPackageText))
  )

  if (isWorkedExample) {
    legitimateWorkedExamples += 1
    if (pkg.work_mode !== 'MODEL' || pkg.scoring_stance !== 'FORMATIVE_NO_PENALTY') {
      failures.push(`${pkg.lesson_id}: reviewed worked example lost its MODEL/non-penalty boundary`)
    }
    if (!debug.passing_change || debug.solution_status !== 'INSTRUCTIONAL_WORKED_EXAMPLE') {
      failures.push(`${pkg.lesson_id}: legitimate worked example lost its complete labelled solution`)
    }
  } else {
    if (debug.passing_change !== undefined) failures.push(`${pkg.lesson_id}: protected learner material still contains passing_change`)
    if (!debug.pre_attempt_support || debug.solution_status !== 'WITHHELD_UNTIL_PROTECTED_EVIDENCE') {
      failures.push(`${pkg.lesson_id}: protected learner material lacks attempt-safe support and withholding status`)
    }
    if (protectedExactRepairVisible) failures.push(`${pkg.lesson_id}: package-local exact-repair signature remains learner-visible`)
  }

  const authority = guide?.trusted_solution_reference
  const expectedVisibility = isWorkedExample
    ? 'ALSO_SHOWN_AS_NON_PENALTY_INSTRUCTIONAL_EXAMPLE'
    : 'NEVER_BEFORE_PROTECTED_EVIDENCE'
  const expectedTiming = isWorkedExample
    ? 'DURING_INSTRUCTIONAL_MODEL'
    : 'AFTER_PROTECTED_EVIDENCE_OR_ADULT_REVIEW_ONLY'
  const expectedRepair = isWorkedExample ? debug.passing_change : reviewed.learner_visible_repair
  const authorityComplete =
    authority?.authority === 'ADULT_TRUSTED_AUTHORITY' &&
    authority?.learner_visibility === expectedVisibility &&
    authority?.review_timing === expectedTiming &&
    authority?.exact_repair === expectedRepair &&
    Array.isArray(authority?.validation_tests) &&
    authority.validation_tests.length === 3
  if (authorityComplete) adultAuthoritiesComplete += 1
  else failures.push(`${pkg.lesson_id}: adult trusted solution authority is missing, incomplete, or mismatched`)

  if (material && binding) {
    records.push(recordFromMaterial({
      material,
      courseRef: binding.courseRef,
      exactRepair: authority?.exact_repair,
      protectedTask: !isWorkedExample,
      scoringStance: pkg.scoring_stance,
    }))
  }
  packageRows.push({
    lessonId: pkg.lesson_id,
    packageRaw,
    guideRaw,
    packagePath,
    guidePath,
    reviewed,
    isWorkedExample,
    isSummative,
    authorityComplete,
  })
}

if (codeCases !== 87) failures.push(`Found ${codeCases} CODE_OR_DEBUG packages instead of 87`)
if (legitimateWorkedExamples !== 19) failures.push(`Preserved ${legitimateWorkedExamples} worked examples instead of 19`)
if (adultAuthoritiesComplete !== 87) failures.push(`Complete adult authorities ${adultAuthoritiesComplete}/87`)

const workedRows = review.cases.filter((row) => row.classification === 'LEGITIMATE_WORKED_EXAMPLE')
const protectedRows = review.cases.filter((row) => row.classification !== 'LEGITIMATE_WORKED_EXAMPLE')
const beforeInventory = protectedRows.flatMap((protectedRow) => {
  const binding = bindingByLesson.get(protectedRow.lesson_id)
  const sources = workedRows.filter((workedRow) =>
    bindingByLesson.get(workedRow.lesson_id)?.courseRef === binding?.courseRef &&
    workedRow.generator_family === protectedRow.generator_family,
  )
  return sources.length ? [{ protectedRow, courseRef: binding.courseRef, sources }] : []
})
const nonSummativeBefore = beforeInventory.filter(({ protectedRow }) => protectedRow.classification === 'FULL_SOLUTION_BEFORE_ATTEMPT').length
const summativeBefore = beforeInventory.filter(({ protectedRow }) => protectedRow.classification === 'SUMMATIVE_SOLUTION_EXPOSURE').length
if (nonSummativeBefore !== 45 || summativeBefore !== 11 || beforeInventory.length !== 56) {
  failures.push(`R1 course-level acceptance inventory drift: ${nonSummativeBefore} non-summative, ${summativeBefore} summative, ${beforeInventory.length} total`)
}

const exposures = findCoursePayloadExposures(records)
const exposedLessonIds = new Set(exposures.map((row) => row.protectedLessonId))
const exposedNonSummative = new Set(exposures.filter((row) => row.protectedScoringStance !== 'SUMMATIVE').map((row) => row.protectedLessonId))
const exposedSummative = new Set(exposures.filter((row) => row.protectedScoringStance === 'SUMMATIVE').map((row) => row.protectedLessonId))
for (const exposure of exposures) {
  failures.push(`${exposure.protectedLessonId}: ${exposure.sourceLessonId} exposes an equivalent solution in ${exposure.courseRef}`)
}

const recordById = new Map(records.map((record) => [record.lessonId, record]))
const rowById = new Map(packageRows.map((row) => [row.lessonId, row]))
const mapping = beforeInventory.map(({ protectedRow, courseRef, sources }, index) => {
  const protectedRecord = recordById.get(protectedRow.lesson_id)
  const comparisons = sources.map((source) => {
    const sourceRecord = recordById.get(source.lesson_id)
    const comparison = compareSolutionExposure(sourceRecord, protectedRecord)
    return {
      source_lesson_id: source.lesson_id,
      exposed_after: comparison.exposed,
      fixture_equivalence_after: comparison.fixture.reason,
      repair_equivalence_after: comparison.repair?.reason ?? 'NOT_COMPARED_FIXTURE_DISTINCT',
    }
  })
  const disk = rowById.get(protectedRow.lesson_id)
  return {
    mapping_number: index + 1,
    protected_lesson_id: protectedRow.lesson_id,
    course_ref: courseRef,
    generator_family_before: protectedRow.generator_family,
    protected_classification: protectedRow.classification,
    summative: protectedRow.classification === 'SUMMATIVE_SOLUTION_EXPOSURE',
    exposing_worked_examples_before: sources.map((source) => source.lesson_id),
    before_equivalence: 'MATERIAL_EQUIVALENT_STARTER_DEFECT_REPAIR',
    after_equivalence: comparisons.every((comparison) => !comparison.exposed_after)
      ? 'ANALOGOUS_CONCEPT_MATERIALLY_DISTINCT_FIXTURE'
      : 'EXPOSURE_REMAINS',
    exposed_after: comparisons.some((comparison) => comparison.exposed_after),
    comparisons,
    generated_learner_package: relative(REPO, disk.packagePath),
    adult_scoring_guide: relative(REPO, disk.guidePath),
    after_package_sha256: sha256(disk.packageRaw),
    after_scoring_guide_sha256: sha256(disk.guideRaw),
  }
})

const payloadCourseHashes = [...projectedByCourse]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([courseRef, materials]) => ({
    course_ref: courseRef,
    lessons: materials.length,
    learner_materials_sha256: sha256(
      materials.sort(([left], [right]) => left.localeCompare(right)).map(([id, material]) => `${id}:${JSON.stringify(material)}`).join('\n'),
    ),
  }))
const browserProof = {
  schema_version: 'technology-browser-payload-proof-r2.0',
  projection_authority: 'scripts/build-final-family-pilot-data.mjs projectJsonLearnerMaterial -> one lazy JSON payload per admitted courseRef',
  binding_authority: relative(REPO, BINDINGS_PATH),
  visibility_semantics: 'Selecting a course loads one payload containing every lesson material in that course; lesson order does not hide later material.',
  technology_courses: browserCourseRefs.length,
  technology_lessons: technologyBindings.length,
  projected_materials: [...projectedByCourse.values()].reduce((sum, rows) => sum + rows.length, 0),
  all_course_payload_roles_compared: ['MODEL', 'GUIDED', 'GUIDED_B', 'PROBE', 'BUILD', 'CORRECT', 'DEMONSTRATE'],
  courses: payloadCourseHashes,
}

const mappingReport = {
  schema_version: 'technology-solution-exposure-fix-r2.0',
  parent_repair: PARENT_REPAIR,
  authoritative_review_commit: REVIEW_COMMIT,
  independent_acceptance_inventory: {
    non_summative: nonSummativeBefore,
    summative: summativeBefore,
    total: beforeInventory.length,
  },
  mappings: mapping,
}

const report = {
  schema_version: 'technology-course-payload-semantic-gate-r2.0',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  parent_repair: PARENT_REPAIR,
  authoritative_review_commit: REVIEW_COMMIT,
  scope: {
    technology_lessons: packagePaths.length,
    reviewed_code_or_debug_cases: codeCases,
    browser_course_payloads: browserCourseRefs.length,
    browser_bound_technology_lessons: technologyBindings.length,
  },
  results: {
    legitimate_worked_examples: workedRows.length,
    legitimate_worked_examples_preserved: legitimateWorkedExamples,
    non_summative_remaining_before: nonSummativeBefore,
    non_summative_remaining_after: exposedNonSummative.size,
    summative_remaining_before: summativeBefore,
    summative_remaining_after: exposedSummative.size,
    total_remaining_before: beforeInventory.length,
    total_remaining_after: exposedLessonIds.size,
    cross_lesson_exposure_pairs_after: exposures.length,
    adult_trusted_authorities_complete: adultAuthoritiesComplete,
    formal_adult_key_leaks: formalAdultKeyLeaks,
  },
  equivalence: {
    scope: 'complete admitted course payload, not package or unit',
    starter: 'JavaScript tokens normalized for whitespace, comments, and consistent identifier renaming; a structure fingerprint also ignores cosmetic literal substitutions.',
    fixture: 'Starter structure and normalized test fixture must both match, retaining operators and control flow so same-concept/different-defect cases do not collide.',
    repair: 'Normalized repair tokens, controlled wording synonyms, edit signatures, and bounded token similarity detect cosmetic restatement of the same effective change.',
    decision: 'A protected task fails only when both its material fixture and effective repair match a learner-visible solution in another lesson of the same course payload.',
  },
  negative_controls: {
    command: 'node --test tests/course-payload-solution-equivalence.test.mjs',
    count: 7,
    required_outcomes: ['FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'FAIL', 'FAIL_COMPLETE_PAYLOAD'],
  },
  evidence: {
    case_mapping_json: relative(REPO, MAPPING_JSON),
    case_mapping_csv: relative(REPO, MAPPING_CSV),
    browser_payload_proof: relative(REPO, BROWSER_PROOF_JSON),
    technology_package_corpus_sha256: sha256(packageRows.map((row) => `${row.lessonId}:${sha256(row.packageRaw)}`).join('\n')),
    technology_scoring_corpus_sha256: sha256(packageRows.map((row) => `${row.lessonId}:${sha256(row.guideRaw)}`).join('\n')),
    browser_projection_corpus_sha256: sha256(payloadCourseHashes.map((row) => `${row.course_ref}:${row.learner_materials_sha256}`).join('\n')),
  },
  failures,
}

const columns = [
  'mapping_number', 'protected_lesson_id', 'course_ref', 'generator_family_before',
  'protected_classification', 'summative', 'exposing_worked_examples_before',
  'before_equivalence', 'after_equivalence', 'exposed_after',
  'generated_learner_package', 'adult_scoring_guide', 'after_package_sha256',
  'after_scoring_guide_sha256',
]
const csv = [
  columns.join(','),
  ...mapping.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
].join('\n') + '\n'

stableWriteOrCheck(MAPPING_JSON, `${JSON.stringify(mappingReport, null, 2)}\n`)
stableWriteOrCheck(MAPPING_CSV, csv)
stableWriteOrCheck(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`)
stableWriteOrCheck(BROWSER_PROOF_JSON, `${JSON.stringify(browserProof, null, 2)}\n`)

console.log(`Technology course-payload solution exposure: ${report.status}`)
console.log(`Full Technology corpus: ${packagePaths.length}/336 across ${browserCourseRefs.length}/9 browser course payloads`)
console.log(`Worked examples preserved: ${legitimateWorkedExamples}/19`)
console.log(`Non-summative remaining exposures: ${nonSummativeBefore} -> ${exposedNonSummative.size}`)
console.log(`Summative remaining exposures: ${summativeBefore} -> ${exposedSummative.size}`)
console.log(`Total remaining exposures: ${beforeInventory.length} -> ${exposedLessonIds.size}`)
console.log(`Adult trusted authorities: ${adultAuthoritiesComplete}/87`)
console.log(`Formal adult-key leaks: ${formalAdultKeyLeaks}`)
if (failures.length) {
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exitCode = 1
}
