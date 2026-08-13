/**
 * Prints the lane's coverage and verification counts.
 *
 *   node --experimental-strip-types src/report.ts
 */
import { verifyLesson } from './oracle.ts'
import { ALL_SPECS } from './registry.ts'
import { loadSourceLessons, loadSourceUnits } from './sourceIndex.ts'
import type { DomainId } from './types.ts'

const source = loadSourceLessons()
const units = loadSourceUnits()
const authored = new Set(ALL_SPECS.map((s) => s.lessonId))

let numeric = 0
let derivedChoice = 0
let assertedChoice = 0
let judgment = 0
let findings = 0
const domainTally = new Map<DomainId, number>()

for (const spec of ALL_SPECS) {
  const r = verifyLesson(spec)
  numeric += r.recomputedNumeric
  derivedChoice += r.derivedChoices
  assertedChoice += r.assertedChoices
  findings += r.findings.length
  judgment += spec.tasks.flatMap((t) => t.items).filter((i) => i.kind === 'judgment').length
  for (const d of spec.domains) domainTally.set(d, (domainTally.get(d) ?? 0) + 1)
}

const unitRows = units.map((u) => {
  const done = u.lessonIds.filter((id) => authored.has(id)).length
  return `  unit ${String(u.unitNumber)}: ${String(done).padStart(2)} / ${String(u.lessonIds.length).padStart(2)}${u.isCapstoneUnit ? '  (capstone unit)' : ''}`
})

const domainRows = [...domainTally.entries()]
  .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
  .map(([d, n]) => `  ${d.padEnd(26)} ${String(n).padStart(3)} lesson(s)`)

const integrationCounts = ALL_SPECS.map((s) => s.domains.length)
const meanIntegration = integrationCounts.length
  ? (integrationCounts.reduce((a, b) => a + b, 0) / integrationCounts.length).toFixed(2)
  : '0'

process.stdout.write([
  `source lessons (grade 12)   ${source.length}`,
  `authored lessons            ${ALL_SPECS.length}`,
  ...unitRows,
  `capstone lessons            ${ALL_SPECS.filter((s) => s.isCapstone).length}`,
  `fixed answers verified      ${numeric + derivedChoice} (${numeric} recomputed, ${derivedChoice} comparison-derived)`,
  `asserted-fact choices       ${assertedChoice}`,
  `rubric-scored items         ${judgment}`,
  `oracle findings             ${findings}`,
  `mean domains per lesson     ${meanIntegration}`,
  'domain coverage:',
  ...domainRows,
  '',
].join('\n'))
