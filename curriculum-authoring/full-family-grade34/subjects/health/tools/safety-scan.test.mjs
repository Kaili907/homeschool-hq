// Regression tests for the Grade 3/4 Health content safety scan.
//
//   node --test tools/*.test.mjs
//
// The scan is the only thing standing between an authoring slip and a lesson
// that asks a nine-year-old for a weigh-in, so the cases below are written as
// mutants: each one is a plausible edit that must NOT be waved through.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanText, negationIndex } from './safety-scan.mjs'
import { COURSES } from './course-data.mjs'

const flags = (text) => scanText('t', text).length

// ---------- the reported defect: `no`/`not` matched inside ordinary words ----------

test('words that merely start with a negation do not suppress a banned term', () => {
  for (const word of ['now', 'note', 'nose', 'normal', 'notebook', 'nothingness', 'nordic']) {
    const text = `The learner writes ${word} and records a weigh-in each week.`
    assert.equal(flags(text), 1, `"${word}" wrongly read as a negation: ${text}`)
  }
})

test('negationIndex matches whole words only', () => {
  for (const clause of ['now', 'note the nose', 'a normal notebook', 'nordic walking', 'notice']) {
    assert.equal(negationIndex(clause), -1, `false negation cue in "${clause}"`)
  }
  for (const clause of ['no measuring', 'never require this', 'not required', 'without a scale']) {
    assert.ok(negationIndex(clause) >= 0, `missed negation cue in "${clause}"`)
  }
})

// ---------- scope: a negation elsewhere must not launder a later demand ----------

test('a negation in an earlier clause does not excuse a later clause', () => {
  const mutants = [
    'This activity is optional; log your calorie count each day.',
    'Nothing private is shared: the learner keeps a diet diary.',
    'No purchase is required, but record a weigh-in every Monday.',
    'The learner is not required to bring a snack, and records a weigh-in each week.',
    'There is no scale at home, which means the learner uses a BMI chart instead.',
  ]
  for (const m of mutants) assert.ok(flags(m) >= 1, `not flagged: ${m}`)
})

test('a negation after the term does not excuse it', () => {
  assert.ok(flags('The learner records a weigh-in weekly, though it is not scored.') >= 1)
})

// ---------- the exemption that has to keep working ----------

test('an explicit prohibition is still allowed to name what it forbids', () => {
  const allowed = [
    'Never require body weight, height, BMI, body-fat percentage, calorie counting, dieting, weight-loss goals, or body measurement of any kind.',
    'No body measurement, calorie counting, dieting, private medical disclosure, or learner body photo is ever required.',
    'Never require a photograph or video recording of the learner or the learner body.',
    'This course refuses weigh-ins and body-size goals.',
    'Discuss the advertisement instead of a calorie count.',
  ]
  for (const a of allowed) assert.equal(flags(a), 0, `false positive: ${a} -> ${scanText('t', a)}`)
})

// ---------- media ----------

test('media is flagged when produced by or depicting the learner', () => {
  assert.ok(flags('Take a photo of yourself holding the poster.') >= 1)
  assert.ok(flags('Upload a video of your kitchen to the class page.') >= 1)
  assert.equal(flags('The advertisement uses a video of a smiling family.'), 0)
  assert.equal(flags('Discuss a cyberbullying photo shared in a group chat.'), 0)
})

// ---------- the authored corpus itself ----------

const corpusStrings = function* () {
  for (const c of COURSES) {
    yield [c.courseId, c.description]
    yield [c.courseId, c.capstone]
    for (const u of c.units) {
      yield [u.title, u.essentialQuestion]
      yield [u.title, u.performanceTask]
      yield [u.title, u.adapted]
      yield [u.title, u.homeConnection]
      for (const v of Object.values(u.guardian)) if (typeof v === 'string') yield [u.title, v]
      for (const t of u.topics) {
        yield [t.name, t.key_points.join(' ')]
        yield [t.name, t.scenario]
      }
    }
  }
}

test('the authored corpus is clean', () => {
  for (const [label, text] of corpusStrings()) {
    assert.deepEqual(scanText(label, text), [], `unexpected finding in ${label}`)
  }
})

test('every authored home connection rejects an injected requirement', () => {
  for (const c of COURSES) {
    for (const u of c.units) {
      const mutant = `${u.homeConnection} Record a weigh-in and a calorie count in the notebook.`
      assert.ok(scanText(u.title, mutant).length >= 1, `mutant survived in ${u.title}`)
    }
  }
})
