/**
 * Emits the shipped corpus from the authored specs.
 *
 * Deterministic: the same specs produce byte-identical output, so a diff on
 * packages/ or scoring/ is always a diff in authored content. Emission refuses
 * to write a lesson whose fixed answers the oracle cannot reproduce.
 *
 *   node --experimental-strip-types src/emit.ts
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeScoringRecord, composeTaskSheet, packagePath, scoringPath } from './compose.ts'
import { buildGateMetadata } from './gateMetadata.ts'
import { ALL_SPECS } from './registry.ts'
import { sourceLessonMap } from './sourceIndex.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function write(rel: string, value: unknown): void {
  const full = join(ROOT, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const source = sourceLessonMap()
rmSync(join(ROOT, 'packages'), { recursive: true, force: true })
rmSync(join(ROOT, 'scoring'), { recursive: true, force: true })

let n = 0
for (const spec of ALL_SPECS) {
  const src = source.get(spec.lessonId)
  if (!src) throw new Error(`spec ${spec.lessonId} does not match any lesson in the pinned source corpus`)
  write(packagePath(spec), composeTaskSheet(spec, src))
  write(scoringPath(spec), composeScoringRecord(spec, src))
  n += 1
}

write('gate-metadata.json', buildGateMetadata(ALL_SPECS, source))

process.stdout.write(`emitted ${n} task sheets, ${n} scoring records, and gate-metadata.json\n`)
