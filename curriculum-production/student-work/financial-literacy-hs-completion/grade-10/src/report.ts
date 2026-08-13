/**
 * Prints this lane's coverage and verification counts.
 *
 * This lane owns grade 10 units 3 to 7. Units 1 and 2 were authored earlier and
 * live in the sibling `financial-literacy-hs` lane; they are counted here as
 * held elsewhere rather than restated, so the grade 10 total this prints is the
 * position after convergence, not a claim about what this directory contains.
 *
 *   node --experimental-strip-types src/report.ts
 */
import { verifyLesson } from './oracle.ts'
import { ALL_SPECS } from './registry.ts'
import { loadSourceLessons } from './sourceIndex.ts'

const HELD_BY_SIBLING_LANE = 20

const source = loadSourceLessons().filter((l) => l.grade === 10)
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

const units = [3, 4, 5, 6, 7].map((u) => {
  const total = source.filter((l) => l.unitNumber === u).length
  const done = source.filter((l) => l.unitNumber === u && authored.has(l.lessonId)).length
  return `  unit ${u}: ${String(done).padStart(2)} / ${total}`
})

process.stdout.write([
  `grade 10 source lessons   ${source.length}`,
  `authored in this lane     ${ALL_SPECS.length}  (units 3-7)`,
  ...units,
  `held by sibling lane      ${HELD_BY_SIBLING_LANE}  (units 1-2, financial-literacy-hs)`,
  `grade 10 after convergence ${ALL_SPECS.length + HELD_BY_SIBLING_LANE} / ${source.length}`,
  `fixed answers verified    ${numeric + derivedChoice} (${numeric} recomputed, ${derivedChoice} comparison-derived)`,
  `asserted-fact choices     ${assertedChoice}`,
  `rubric-scored items       ${judgment}`,
  `oracle findings           ${findings}`,
  '',
].join('\n'))
