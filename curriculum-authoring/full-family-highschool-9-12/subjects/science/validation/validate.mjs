/**
 * Validate the High School 9-12 science authoring set against the repository's
 * own Curriculum Authoring 2.0.0 contract, then run the mission-specific checks
 * in validation/checks.mjs that the generic validator does not cover.
 *
 * Run from the repository root:
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     curriculum-authoring/full-family-highschool-9-12/subjects/science/validation/validate.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runChecks } from './checks.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const setDir = resolve(here, '../authoring-set')

export function loadSet() {
  const readJson = (name) => JSON.parse(readFileSync(resolve(setDir, name), 'utf8'))
  const lessons = readdirSync(resolve(setDir, 'lessons'))
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .flatMap((f) =>
      readFileSync(resolve(setDir, 'lessons', f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    )
  return {
    manifest: readJson('manifest.json'),
    courses: readJson('courses.json'),
    units: readJson('units.json'),
    lessons,
    assessments: readJson('assessments.json'),
    assessment_interpretations: readJson('assessment-interpretations.json'),
    schedules: readJson('schedules.json'),
    standard_frameworks: [readJson('standard-framework.json')],
    resources: readJson('resources.json'),
    policy_sets: [readJson('policy-set.json')],
  }
}

export const loadFrameworkDoc = () => readFileSync(resolve(here, '../lab-safety-framework.md'), 'utf8')

// Importable without side effects: validation/mutation-test.mjs reuses loadSet() and
// loadFrameworkDoc() to build damaged copies of the package.
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntryPoint) {
const { report, checks } = runChecks(loadSet(), loadFrameworkDoc())

// ---------------------------------------------------------------- output
const failed = checks.filter((c) => c.result === 'FAIL')
const overall = report.valid && failed.length === 0 ? 'PASS' : 'FAIL'
const out = {
  package_id: 'manuel-academy-highschool-9-12-science',
  schema_set_version: report.schema_set_version,
  overall,
  contract_issues: report.issues,
  counts: { checks: checks.length, passed: checks.length - failed.length, failed: failed.length },
  checks,
}
writeFileSync(resolve(here, 'validation-report.json'), JSON.stringify(out, null, 2) + '\n')

console.log(`contract: valid=${report.valid} issues=${report.issues.length}`)
for (const issue of report.issues.slice(0, 25)) console.log(`  [${issue.code}] ${issue.path}: ${issue.message}`)
if (report.issues.length > 25) console.log(`  ...and ${report.issues.length - 25} more`)
for (const c of checks) console.log(`${c.result === 'PASS' ? '  ok  ' : '  FAIL'} ${c.check} - ${c.detail}`)
console.log(`\nOVERALL: ${overall} (${out.counts.passed}/${out.counts.checks} mission checks passed)`)
process.exit(overall === 'PASS' ? 0 : 1)
}
