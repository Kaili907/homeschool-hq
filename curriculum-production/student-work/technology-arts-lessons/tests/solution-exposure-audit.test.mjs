import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '..')

test('Technology learner materials preserve worked examples without exposing independent solutions', () => {
  const output = execFileSync(process.execPath, ['tests/solution-exposure-audit.mjs'], {
    cwd: CORPUS,
    encoding: 'utf8',
  })

  assert.match(output, /Reviewed inventory: 87\/87/)
  assert.match(output, /Worked examples preserved: 19\/19/)
  assert.match(output, /Non-summative exposures: 56 -> 0/)
  assert.match(output, /Summative exposures: 12 -> 0/)
  assert.match(output, /Adult trusted authorities: 87\/87/)
  assert.match(output, /Formal adult-key leaks: 0/)
})
