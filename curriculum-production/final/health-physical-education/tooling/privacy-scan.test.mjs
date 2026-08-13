import test from 'node:test'
import assert from 'node:assert/strict'
import { scanDocument } from '../src/lib/privacyScan.mjs'

const scan = (text) => scanDocument({ text }, 'fixture.json')

test('H2 lexical scope does not treat a prefix word as negation', () => {
  assert.equal(scan('Now record your body weight in the notebook.').length, 1)
})

test('H2 lexical scope allows a real prohibition but not a later-clause demand', () => {
  assert.equal(scan('Never record your body weight.').length, 0)
  assert.equal(scan('Never record a public score; however, report your body weight.').length, 1)
})

test('movement-skill diagnosis is distinct from forbidden clinical diagnosis', () => {
  assert.equal(scan('Diagnose the limiting feature in the movement cycle and choose a corrective cue.').length, 0)
  assert.equal(scan('Submit your mental-health diagnosis for credit.').length, 1)
})
