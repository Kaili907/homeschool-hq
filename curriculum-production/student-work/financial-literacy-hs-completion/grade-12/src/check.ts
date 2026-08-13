/**
 * Ad-hoc corpus check used while authoring.
 *
 *   node --experimental-strip-types src/check.ts
 *
 * Reports every validator finding at once. `tests/` is the authority; this
 * exists so an authoring pass can be checked without starting vitest.
 */
import { ALL_SPECS } from './registry.ts'
import {
  checkAntiTemplate, checkCapstoneIntegrity, checkIntegration, checkMixedScoring,
  checkNoPlaceholders, checkParameterVisibility, checkPrivacy, checkSafety, checkStructure,
} from './validate.ts'
import { verifyLesson } from './oracle.ts'

const perSpec = [
  ['visibility', checkParameterVisibility],
  ['safety', checkSafety],
  ['placeholders', checkNoPlaceholders],
  ['structure', checkStructure],
  ['integration', checkIntegration],
  ['mixed-scoring', checkMixedScoring],
  ['capstone', checkCapstoneIntegrity],
  ['privacy', checkPrivacy],
] as const

let total = 0
for (const [label, fn] of perSpec) {
  const found = ALL_SPECS.flatMap((s) => fn(s))
  total += found.length
  if (found.length) {
    process.stdout.write(`\n${label}: ${found.length}\n`)
    for (const f of found) process.stdout.write(`  ${f.lessonId} ${f.where}: ${f.message}\n`)
  }
}
const at = checkAntiTemplate(ALL_SPECS)
total += at.length
if (at.length) {
  process.stdout.write(`\nanti-template: ${at.length}\n`)
  for (const f of at) process.stdout.write(`  ${f.lessonId} ${f.where}: ${f.message}\n`)
}
const oracle = ALL_SPECS.flatMap((s) => verifyLesson(s).findings)
total += oracle.length
if (oracle.length) {
  process.stdout.write(`\noracle: ${oracle.length}\n`)
  for (const f of oracle) process.stdout.write(`  ${f.lessonId} ${f.ref}: ${f.message}\n`)
}
process.stdout.write(total === 0 ? `\nall checks clean across ${ALL_SPECS.length} lessons\n` : `\n${total} finding(s)\n`)
