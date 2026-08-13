/**
 * Confirms the committed tree matches SHA256SUMS.txt.
 *
 *   node curriculum-production/final/science/validation/verify-checksums.mjs
 *
 * Pairs with the build's determinism: rebuilding regenerates the same sums, and
 * this proves nothing was hand-edited afterwards.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT } from './packages.mjs'

const sums = readFileSync(join(ROOT, 'SHA256SUMS.txt'), 'utf8')
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => {
    const [digest, relative] = line.split('  ')
    return { digest, relative }
  })

const problems = []
for (const { digest, relative } of sums) {
  const path = join(ROOT, relative)
  if (!existsSync(path)) {
    problems.push(`missing: ${relative}`)
    continue
  }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== digest) problems.push(`changed since build: ${relative}`)
}

if (problems.length > 0) {
  for (const problem of problems.slice(0, 20)) console.error(problem)
  console.error(`\n${problems.length} checksum problems across ${sums.length} files`)
  process.exit(1)
}

console.log(`checksums: OK — ${sums.length} files match SHA256SUMS.txt`)
