// Mutant tests for the Grade 3/4 Health build invariants.
//
//   node --test tools/*.test.mjs
//
// Each case copies tools/ to a scratch directory, applies one plausible
// authoring slip, and asserts `--check` fails. A green suite means the
// validator is load-bearing rather than decorative.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// Runs --check over a copy of the package with `mutate` applied to a tools
// file. Returns the combined output, or null when the build passed.
function checkWithMutation(file, mutate) {
  const root = mkdtempSync(join(tmpdir(), 'g34-health-'))
  cpSync(join(HERE, '..'), root, { recursive: true })
  const target = join(root, 'tools', file)
  writeFileSync(target, mutate(readFileSync(target, 'utf8')))
  try {
    execFileSync(process.execPath, [join(root, 'tools', 'build-health-g34.mjs'), '--check'], { encoding: 'utf8' })
    return null
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

const replaceOnce = (needle, replacement) => (src) => {
  assert.equal(src.split(needle).length - 1, 1, `mutation anchor not unique: ${needle}`)
  return src.replace(needle, replacement)
}

test('the unmutated package passes --check', () => {
  const out = execFileSync(process.execPath, [join(HERE, 'build-health-g34.mjs'), '--check'], { encoding: 'utf8' })
  assert.match(out, /PASS/)
})

test('a body-metric requirement in unit prose fails the build', () => {
  const out = checkWithMutation('course-data.mjs', replaceOnce(
    "homeConnection: 'With a guardian, choose one routine step",
    "homeConnection: 'Now note the weekly weigh-in in the notebook. With a guardian, choose one routine step",
  ))
  assert.ok(out, 'mutant survived the validator')
  assert.match(out, /unnegated body-metric term/)
})

test('a learner-media requirement in a topic scenario fails the build', () => {
  const out = checkWithMutation('course-data.mjs', replaceOnce(
    "scenario: 'Mia pets a neighbor",
    "scenario: 'Take a photo of yourself washing your hands. Mia pets a neighbor",
  ))
  assert.ok(out, 'mutant survived the validator')
  assert.match(out, /media requirement/)
})

test('dropping the guardian marker from a unit with an allergy check fails the build', () => {
  const out = checkWithMutation('course-data.mjs', replaceOnce(
    "food_or_allergy_note: 'Check soap, sanitizer, sunscreen, and toothpaste against any known skin or ingredient allergy before use.',\n          guardian_confirmation_required: true,",
    "food_or_allergy_note: 'Check soap, sanitizer, sunscreen, and toothpaste against any known skin or ingredient allergy before use.',\n          guardian_confirmation_required: false,",
  ))
  assert.ok(out, 'mutant survived the validator')
  assert.match(out, /allergy or material check present without guardian_confirmation_required/)
})

test('dropping the optionality floor from home connections fails the build', () => {
  const out = checkWithMutation('build-health-g34.mjs', replaceOnce(
    'const homeConnection = (u) => `${u.homeConnection} ${HOME_CONNECTION_FLOOR}`',
    'const homeConnection = (u) => u.homeConnection',
  ))
  assert.ok(out, 'mutant survived the validator')
  assert.match(out, /home_connection missing optionality and privacy floor/)
})
