/**
 * Prints the lane's coverage and verification counts.
 *
 *   node --experimental-strip-types src/report.ts
 */
import { verifyLesson } from './oracle.ts'
import { ALL_SPECS } from './registry.ts'
import { loadSourceLessons } from './sourceIndex.ts'

const source = loadSourceLessons()
const authored = new Set(ALL_SPECS.map((s) => s.lessonId))

let numeric = 0
let derivedChoice = 0
let assertedChoice = 0
let judgment = 0
let findings = 0

for (const spec of ALL_SPECS) {
  const r = verifyLesson(spec)
  numeric += r.recomputedNumeric
  derivedChoice += r.derivedChoices
  assertedChoice += r.assertedChoices
  findings += r.findings.length
  judgment += spec.tasks.flatMap((t) => t.items).filter((i) => i.kind === 'judgment').length
}

const rows = [9, 10, 11, 12].map((g) => {
  const total = source.filter((l) => l.grade === g).length
  const done = source.filter((l) => l.grade === g && authored.has(l.lessonId)).length
  return `  grade ${String(g).padStart(2)}: ${String(done).padStart(3)} / ${total}`
})

process.stdout.write([
  `source lessons          ${source.length}`,
  `authored lessons        ${ALL_SPECS.length}`,
  ...rows,
  `fixed answers verified  ${numeric + derivedChoice} (${numeric} recomputed, ${derivedChoice} comparison-derived)`,
  `asserted-fact choices   ${assertedChoice}`,
  `rubric-scored items     ${judgment}`,
  `oracle findings         ${findings}`,
  '',
].join('\n'))
