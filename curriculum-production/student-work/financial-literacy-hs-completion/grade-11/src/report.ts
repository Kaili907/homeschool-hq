/**
 * Prints the supplement's coverage, verification, and progression position.
 *
 *   node --experimental-strip-types src/report.ts
 */
import { verifyLesson } from './oracle.ts'
import { checkCorpusProgression, GRADE9_BASELINE, grade9CorpusAvailable } from './progression.ts'
import { ALL_SPECS } from './registry.ts'
import { loadSourceLessons, loadSourceUnits } from './sourceIndex.ts'

const source = loadSourceLessons()
const units = loadSourceUnits()
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

const p = checkCorpusProgression(ALL_SPECS)
const rows = units.map((u) => {
  const total = u.lessonIds.length
  const done = u.lessonIds.filter((id) => authored.has(id)).length
  return `  unit ${String(u.unitNumber)} (${u.standards.join('/')}): ${String(done).padStart(2)} / ${total}`
})

process.stdout.write([
  `source lessons (grade 11)   ${source.length}`,
  `authored lessons            ${ALL_SPECS.length}`,
  ...rows,
  `fixed answers verified      ${numeric + derivedChoice} (${numeric} recomputed, ${derivedChoice} comparison-derived)`,
  `asserted-fact choices       ${assertedChoice}`,
  `rubric-scored items         ${judgment}`,
  `oracle findings             ${findings}`,
  '',
  'progression (grade 11 vs the measured grade-9 corpus)',
  `  mean items/lesson         ${p.meanItems}  (grade 9: ${GRADE9_BASELINE.meanPrompts})`,
  `  mean fixed items/lesson   ${p.meanFixed}  (grade 9: ${GRADE9_BASELINE.meanFixed})`,
  `  mean composition depth    ${p.meanMaxDepth}  (grade 9: ${GRADE9_BASELINE.meanMaxDepth})`,
  `  lessons composing 3+      ${p.lessonsAtDepth3}  (grade 9: ${GRADE9_BASELINE.lessonsAtDepth3})`,
  `  lessons multi-period      ${p.multiPeriodLessons}  (grade 9: ${GRADE9_BASELINE.lessonsUsingPow})`,
  `  grade-9 corpus present    ${grade9CorpusAvailable()}`,
  `  progression findings      ${p.findings.length}`,
  '',
].join('\n'))
