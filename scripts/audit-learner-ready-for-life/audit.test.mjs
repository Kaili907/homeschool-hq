import assert from 'node:assert/strict'
import test from 'node:test'

import { FLAG_CODES, runNegativeControls } from './audit.mjs'

test('declared finding codes are unique', () => {
  assert.equal(new Set(FLAG_CODES).size, FLAG_CODES.length)
})

test('all required negative controls are detected', () => {
  const result = runNegativeControls()
  assert.equal(result.status, 'PASS')
  assert.deepEqual(result.controls.map((control) => control.id), [
    'student-self-certification',
    'missing-simulation',
    'missing-task',
    'private-disclosure',
    'flattened-or-missing-task-steps',
  ])
  assert.ok(result.controls.every((control) => control.result === 'DETECTED'))
})
