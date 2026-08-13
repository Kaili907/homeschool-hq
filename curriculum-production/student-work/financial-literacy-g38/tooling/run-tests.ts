/**
 * Runs the committed vitest suite with nothing but node, via the shim in
 * tooling/vitest-shim.mjs:
 *
 *   node --import ./tooling/register.mjs \
 *     curriculum-production/student-work/financial-literacy-g38/tooling/run-tests.ts
 *
 * Where dependencies are installed, prefer real vitest:
 *   npx vitest run --config .../tooling/vitest.config.mts
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { summary } from './vitest-shim.mjs'

const testsDir = new URL('../tests/', import.meta.url)
const files = readdirSync(testsDir).filter((name) => name.endsWith('.test.ts')).sort()

for (const file of files) {
  console.log(`\n${file}`)
  await import(new URL(file, testsDir).href)
}

const { tests, passed, failed } = summary()
console.log(`\n${passed}/${tests} assertions passed across ${files.length} test files`)
if (failed.length > 0) {
  console.error(`\n${failed.length} failing test(s):`)
  for (const failure of failed) console.error(`  - ${failure.name}: ${failure.err?.message}`)
  process.exit(1)
}
