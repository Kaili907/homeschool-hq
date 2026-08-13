/**
 * Zero-dependency verification run. Executes the same checks the vitest
 * suite asserts, so the corpus can be verified with nothing but node:
 *
 *   node curriculum-production/student-work/financial-literacy-g38/tooling/verify.ts
 *
 * Exits non-zero on any oracle disagreement, invariant violation, or drift
 * between the authored source and the committed JSON.
 */
import { buildCorpus, writeCorpus } from '../src/build.ts'
import { checkCorpus } from '../src/checks.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'
import { loadSourceLessons } from '../src/inventory.ts'

const mode = process.argv.includes('--write') ? 'write' : 'check'
const failures: string[] = []

const sources = loadSourceLessons()
console.log(`source lessons derived: ${sources.length}`)
if (sources.length !== 216) failures.push(`expected 216 source lessons, derived ${sources.length}`)

const entries = buildCorpus()
console.log(`lessons authored and oracle-verified: ${entries.length}`)

const fixed = entries.filter((e) => e.scoring.scoringAuthority.kind === 'ANSWER_KEY')
const rubric = entries.filter((e) => e.scoring.scoringAuthority.kind === 'RUBRIC')
const items = fixed.reduce((n, e) => n + (e.scoring.scoringAuthority.kind === 'ANSWER_KEY' ? e.scoring.scoringAuthority.items.length : 0), 0)
console.log(`fixed-answer lessons: ${fixed.length}  rubric lessons: ${rubric.length}  recomputed items: ${items}`)

const issues = checkCorpus(entries)
console.log(`invariant issues: ${issues.length}`)
for (const i of issues.slice(0, 40)) console.log(`  [${i.rule}] ${i.packageId}: ${i.detail}`)
if (issues.length > 0) failures.push(`${issues.length} invariant issue(s)`)

const report = writeCorpus(entries, mode)
if (mode === 'write') {
  console.log(`files written: ${report.written}, unchanged: ${report.unchanged}`)
} else {
  console.log(`committed-file drift: ${report.drift.length}`)
  for (const path of report.drift.slice(0, 10)) console.log(`  drift: ${path}`)
  if (report.drift.length > 0) failures.push(`${report.drift.length} committed file(s) differ from the authored source`)
}

for (const result of evaluateCorpus(entries)) {
  const counts = result.lessonResults.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }), {})
  console.log(`gate ${result.courseId}: ${result.status} ${JSON.stringify(counts)}`)
}

if (failures.length > 0) {
  console.error(`\nFAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
