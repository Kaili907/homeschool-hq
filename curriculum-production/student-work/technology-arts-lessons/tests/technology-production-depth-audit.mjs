#!/usr/bin/env node
/** Independent corpus audit for Technology Production Depth R1. */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PACKAGE_ROOT = resolve(ROOT, 'packages/technology')
const GUIDE_ROOT = resolve(ROOT, 'scoring-guides/technology')
const EVIDENCE_PATH = resolve(ROOT, 'technology-production-depth-evidence.json')
const ANCHOR_ID = 'ma-g10-technology-u02-l05'
const ANCHOR_TASK_SOURCE = resolve(ROOT, 'src/approved-anchors/ma-g10-technology-u02-l05.task-package.source.json')
const ANCHOR_GUIDE_SOURCE = resolve(ROOT, 'src/approved-anchors/ma-g10-technology-u02-l05.scoring-guide.source.json')

const failures = []
const leaks = []
const fail = (lessonId, code, detail) => failures.push({ lesson_id: lessonId, code, detail })

const paths = readdirSync(PACKAGE_ROOT).sort().flatMap((gradeDir) =>
  readdirSync(resolve(PACKAGE_ROOT, gradeDir))
    .filter((name) => name.endsWith('.task-package.json'))
    .sort()
    .map((name) => ({
      gradeDir,
      id: name.replace('.task-package.json', ''),
      task: resolve(PACKAGE_ROOT, gradeDir, name),
      guide: resolve(GUIDE_ROOT, gradeDir, name.replace('.task-package.json', '.scoring-guide.json')),
    })),
)

const rows = paths.map((path) => ({
  ...path,
  pkg: JSON.parse(readFileSync(path.task, 'utf8')),
  guideValue: JSON.parse(readFileSync(path.guide, 'utf8')),
}))

const countBy = (values, key) => Object.fromEntries(
  [...values.reduce((map, value) => map.set(value[key], (map.get(value[key]) ?? 0) + 1), new Map())]
    .sort(([a], [b]) => String(a).localeCompare(String(b))),
)

function collectSolutionStrings(authority) {
  const strings = []
  const visit = (value, key = '') => {
    if (typeof value === 'string') {
      if (
        value.length >= 24 &&
        /(reference_implementation|minimal_reference_repair|decisive_resolution|accepted_invariant)/.test(key)
      ) strings.push({ key, value })
      return
    }
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${key}[${index}]`))
    if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, key ? `${key}.${childKey}` : childKey)
    }
  }
  visit(authority)
  return strings
}

for (const { id, pkg, guideValue } of rows) {
  const exp = pkg.learner_experience
  const anchor = id === ANCHOR_ID
  if (!exp || exp.static_complete !== true || exp.tutor_required !== false) {
    fail(id, 'INCOMPLETE_STATIC_EXPERIENCE', 'learner_experience must be static-complete and tutor-independent')
    continue
  }
  if (!Array.isArray(exp.concept_teaching?.explanation) || exp.concept_teaching.explanation.length < 4) {
    fail(id, 'THIN_CONCEPT_TEACHING', 'fewer than four explanation moves')
  }
  if (!Array.isArray(exp.concept_teaching?.key_terms) || exp.concept_teaching.key_terms.length < 4) {
    fail(id, 'THIN_CONCEPT_VOCABULARY', 'fewer than four defined terms')
  }
  if (exp.worked_example?.relationship_to_protected_tasks !== 'ANALOGOUS_NON_TARGET') {
    fail(id, 'WORKED_NOT_ANALOGOUS', 'worked example is not declared analogous/non-target')
  }
  if (exp.worked_example?.evidence_eligible !== false) {
    fail(id, 'WORKED_COUNTS_AS_MASTERY', 'worked example must be instructional, never mastery evidence')
  }
  if (!exp.guided_task?.support_fade) fail(id, 'MISSING_SUPPORT_FADE', 'guided task does not state how support fades')

  const independent = exp.independent_task ?? exp.independent_creation
  if (!independent || !/WITHHELD_FROM_LEARNER_SURFACES/.test(JSON.stringify(independent))) {
    fail(id, 'MISSING_PROTECTED_INDEPENDENT', 'independent work or its solution boundary is missing')
  }
  const debugRecord = exp.debugging_reasoning ?? exp.mastery_debug
  if (!debugRecord || !/(hypothesis|debug_log_template|required_moves)/i.test(JSON.stringify(debugRecord))) {
    fail(id, 'MISSING_DEBUGGING_REASONING', 'no inspectable evidence cycle is required')
  }
  if (!exp.fresh_mastery_check || !/FRESH/.test(JSON.stringify(exp.fresh_mastery_check))) {
    fail(id, 'MISSING_FRESH_MASTERY', 'fresh mastery/remediation check is absent')
  }
  if (!Array.isArray(exp.remediation_routes) || exp.remediation_routes.length < 2) {
    fail(id, 'THIN_REMEDIATION', 'at least two different remediation routes are required')
  } else if (exp.remediation_routes.some((route) => route.original_protected_solution_exposed !== false)) {
    fail(id, 'REMEDIATION_EXPOSES_TARGET', 'a remediation route does not explicitly preserve the protected solution')
  }

  const setupText = JSON.stringify(pkg.activity_setup)
  if (!/WITHHELD_FROM_LEARNER_SURFACES/.test(setupText)) {
    fail(id, 'ACTIVITY_RESOLUTION_NOT_WITHHELD', 'activity_setup does not mark the protected resolution withheld')
  }

  const learnerText = JSON.stringify(pkg)
  if (/trusted_solution_reference|ADULT_TRUSTED_AUTHORITY|scoring-guides|restricted_checks/.test(learnerText)) {
    leaks.push({ lesson_id: id, code: 'ADULT_AUTHORITY_MARKER_ON_LEARNER_SURFACE' })
  }
  const authority = guideValue.trusted_solution_reference
  if (authority?.authority !== 'ADULT_TRUSTED_AUTHORITY' || authority?.learner_visibility !== 'NEVER') {
    fail(id, 'MISSING_ADULT_AUTHORITY', 'restricted trusted solution authority is absent or not adult-only')
  }
  for (const candidate of collectSolutionStrings(authority)) {
    if (learnerText.includes(candidate.value)) {
      leaks.push({ lesson_id: id, code: 'EXACT_PROTECTED_SOLUTION_ON_LEARNER_SURFACE', authority_path: candidate.key })
    }
  }

  const workedText = JSON.stringify(exp.worked_example)
  const protectedText = JSON.stringify(pkg.activity_setup.central_input)
  if (workedText === protectedText || workedText.includes(protectedText) || protectedText.includes(workedText)) {
    fail(id, 'WORKED_EQUALS_PROTECTED', 'worked and protected fixtures are not independent')
  }
  if (!anchor && !exp.worked_example.difference_from_protected_task) {
    fail(id, 'ANALOGY_DISTANCE_UNEXPLAINED', 'worked example does not state how it differs from protected work')
  }
}

const anchorRow = rows.find((row) => row.id === ANCHOR_ID)
const approvedAnchorPreserved = Boolean(anchorRow) &&
  JSON.stringify(anchorRow.pkg) === JSON.stringify(JSON.parse(readFileSync(ANCHOR_TASK_SOURCE, 'utf8'))) &&
  JSON.stringify(anchorRow.guideValue) === JSON.stringify(JSON.parse(readFileSync(ANCHOR_GUIDE_SOURCE, 'utf8')))
if (!approvedAnchorPreserved) fail(ANCHOR_ID, 'APPROVED_ANCHOR_CHANGED', 'generated anchor differs from the canonical approved source snapshot')

if (rows.length !== 336) fail('corpus', 'LESSON_COUNT', `${rows.length} Technology lessons found; expected 336`)
if (leaks.length) failures.push(...leaks.map((leak) => ({ ...leak, detail: leak.authority_path ?? leak.code })))

const evidence = {
  schema_version: '1.0',
  scope: 'Complete canonical Technology lesson corpus',
  result: failures.length ? 'FAIL' : 'PASS',
  lessons: rows.length,
  lessons_with_concept_teaching: rows.filter((row) => row.pkg.learner_experience?.concept_teaching).length,
  lessons_with_analogous_worked_examples: rows.filter((row) => row.pkg.learner_experience?.worked_example?.relationship_to_protected_tasks === 'ANALOGOUS_NON_TARGET').length,
  lessons_with_guided_tasks: rows.filter((row) => row.pkg.learner_experience?.guided_task).length,
  lessons_with_independent_work: rows.filter((row) => row.pkg.learner_experience?.independent_task || row.pkg.learner_experience?.independent_creation).length,
  lessons_with_fresh_mastery: rows.filter((row) => row.pkg.learner_experience?.fresh_mastery_check).length,
  lessons_with_different_remediation: rows.filter((row) => row.pkg.learner_experience?.remediation_routes?.length >= 2).length,
  lessons_with_adult_only_solution_authority: rows.filter((row) => row.guideValue.trusted_solution_reference?.learner_visibility === 'NEVER').length,
  current_learner_solution_leaks: leaks.length,
  approved_anchor_preserved: approvedAnchorPreserved,
  grades: countBy(rows.map((row) => row.pkg), 'grade'),
  task_families: countBy(rows.map((row) => row.pkg), 'task_type'),
  lesson_types: countBy(rows.map((row) => ({ lesson_type: row.pkg.lesson_type ?? row.pkg.learner_experience?.lesson_type ?? 'approved_anchor_mastery' })), 'lesson_type'),
  work_modes: countBy(rows.map((row) => row.pkg), 'work_mode'),
  failures,
  corpus_sha256: createHash('sha256').update(rows.map((row) => JSON.stringify(row.pkg)).join('\n')).digest('hex'),
}

writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n')
console.log(`Technology production depth: ${evidence.result}`)
console.log(`Lessons: ${evidence.lessons}`)
console.log(`Concept/worked/guided/independent/fresh/remediation: ${evidence.lessons_with_concept_teaching}/${evidence.lessons_with_analogous_worked_examples}/${evidence.lessons_with_guided_tasks}/${evidence.lessons_with_independent_work}/${evidence.lessons_with_fresh_mastery}/${evidence.lessons_with_different_remediation}`)
console.log(`Adult-only solution authorities: ${evidence.lessons_with_adult_only_solution_authority}/${evidence.lessons}`)
console.log(`Current learner solution leaks: ${evidence.current_learner_solution_leaks}`)
console.log(`Approved anchor preserved: ${evidence.approved_anchor_preserved}`)
console.log(`Evidence: ${EVIDENCE_PATH}`)
if (failures.length) {
  console.error(`TECHNOLOGY PRODUCTION DEPTH FAILURES (${failures.length}):`)
  for (const failure of failures.slice(0, 80)) console.error(`  - ${failure.lesson_id} ${failure.code}: ${failure.detail}`)
  if (failures.length > 80) console.error(`  ... and ${failures.length - 80} more`)
  process.exitCode = 1
}
