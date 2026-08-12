// Gate tests for the Grades 9-12 Health validator.
//
// Uses the Node built-in test runner rather than vitest: this worktree has no
// node_modules installed, and these tests are meant to be runnable by anyone
// checking the release without an install step.
//
// Run: node --test curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/
//
// Every gate gets a negative test. A gate that cannot fail is not a gate, so
// each test injects one realistic defect and asserts that the gate catches it.

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadBuild,
  runValidation,
  checkProgression,
  checkPrivacyGuard,
  checkInclusivePath,
  checkNoBodyMetrics,
  checkNoMediaRoute,
  checkGuardianSafety,
  checkStandardsMapping,
  checkStudyCompatibility,
  checkMultiOccasionEvidence,
  checkDistinctLessons,
} from './validate-course.mjs'

let real
const clone = () => structuredClone(real)
const firstLesson = (b) => b.courses[0].lessons[0]
const firstUnit = (b) => b.courses[0].units[0]

before(async () => {
  real = await loadBuild()
})

describe('the authored Grades 9-12 Health release', () => {
  test('passes every gate', () => {
    const failures = runValidation(real).filter((r) => !r.pass)
    assert.deepEqual(failures.map((f) => `${f.name}: ${f.detail}`), [])
  })

  test('is four grades of 36 days and 144 lessons in total', () => {
    assert.deepEqual(real.courses.map((c) => c.grade).sort((a, b) => a - b), [9, 10, 11, 12])
    assert.equal(real.courses.reduce((n, c) => n + c.lessons.length, 0), 144)
    for (const c of real.courses) assert.equal(c.lessons.length, 36)
  })

  test('keeps the optional sex-education module out of every course sequence', () => {
    const [mod] = real.modules
    assert.equal(mod.guardian_activation_required, true)
    assert.equal(mod.scheduled_by_default, false)
    assert.equal(mod.counts_toward_course_days, false)
    assert.equal(mod.required_for_completion_or_credit, false)
    const courseLessonIds = new Set(real.courses.flatMap((c) => c.lessons.map((l) => l.lesson_id)))
    for (const l of mod.lessons) assert.equal(courseLessonIds.has(l.lesson_id), false)
  })
})

describe('each gate catches its defect', () => {
  test('grade-progression catches a missing grade', () => {
    const b = clone()
    b.courses = b.courses.filter((c) => c.grade !== 11)
    assert.equal(checkProgression(b).pass, false)
  })

  test('grade-progression catches a grade that is a copy of the year below', () => {
    const b = clone()
    b.courses[1].units[0].title = b.courses[0].units[0].title
    const result = checkProgression(b)
    assert.equal(result.pass, false)
    assert.match(result.findings[0].text, /unit title repeats/)
  })

  test('health-privacy-guard catches a task that asks for medical history', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Summarize your own medical history and share it with the class.'
    assert.equal(checkPrivacyGuard(b).pass, false)
  })

  test('health-privacy-guard catches an ungated sex-education module', () => {
    const b = clone()
    b.modules[0].scheduled_by_default = true
    assert.equal(checkPrivacyGuard(b).pass, false)
  })

  test('health-privacy-guard catches a lesson that drops the no-diagnosis statement', () => {
    const b = clone()
    firstLesson(b).safety_and_privacy = firstLesson(b).safety_and_privacy.filter((s) => !/does not diagnose/i.test(s))
    assert.equal(checkPrivacyGuard(b).pass, false)
  })

  test('inclusive-path catches a unit with no adaptation', () => {
    const b = clone()
    delete firstUnit(b).inclusive_adaptation
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('inclusive-path catches a lesson with no private-disclosure route', () => {
    const b = clone()
    const l = firstLesson(b)
    l.adaptive_tutor_routes = l.adaptive_tutor_routes.filter((r) => r.signal !== 'learner discloses something private')
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('no-body-metrics catches a calorie-tracking task', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Track your calories for one week and record your weight change.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })

  test('no-body-metrics catches a BMI assessment prompt', () => {
    const b = clone()
    b.courses[0].assessments[0].prompts[0].prompt = 'Calculate your BMI and interpret the result.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })

  test('no-body-metrics does not fire on a sentence that forbids the metric', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Build a plan. No calorie counts, weights, or body-size targets are used.'
    assert.equal(checkNoBodyMetrics(b).pass, true)
  })

  test('no-media-route catches a required-media lesson', () => {
    const b = clone()
    firstLesson(b).media.required = true
    assert.equal(checkNoMediaRoute(b).pass, false)
  })

  test('no-media-route catches a task that demands a video', () => {
    const b = clone()
    firstLesson(b).student_activity = 'Record a video of yourself explaining the decision and upload it.'
    assert.equal(checkNoMediaRoute(b).pass, false)
  })

  test('guardian-safety catches a missing guardian field', () => {
    const b = clone()
    delete firstUnit(b).guardian_safety.movement_hazards
    assert.equal(checkGuardianSafety(b).pass, false)
  })

  test('guardian-safety catches law-required content without guardian confirmation', () => {
    const b = clone()
    const unit = b.courses[0].units.find((u) => u.required_by_michigan_law)
    assert.ok(unit, 'expected at least one unit carrying content required by Michigan law')
    unit.guardian_safety.guardian_confirmation_required = false
    assert.equal(checkGuardianSafety(b).pass, false)
  })

  test('standards-mapping catches an invented mapping status', () => {
    const b = clone()
    firstUnit(b).standards_mapping[0].mapping_status = 'verified-by-vibes'
    assert.equal(checkStandardsMapping(b).pass, false)
  })

  test('standards-mapping catches a lesson with no standards at all', () => {
    const b = clone()
    firstLesson(b).standards = []
    assert.equal(checkStandardsMapping(b).pass, false)
  })

  test('standards-mapping reports the honest status split', () => {
    const result = checkStandardsMapping(real)
    assert.equal(result.pass, true)
    assert.match(result.detail, /canonical=\d+ unverified=\d+ human-review=\d+/)
  })

  test('study-compatibility catches a missing required field', () => {
    const b = clone()
    delete firstLesson(b).mastery_rule
    assert.equal(checkStudyCompatibility(b).pass, false)
  })

  test('study-compatibility catches a duplicated course day', () => {
    const b = clone()
    b.courses[0].lessons[1].course_day = b.courses[0].lessons[0].course_day
    assert.equal(checkStudyCompatibility(b).pass, false)
  })

  test('study-compatibility catches a lesson id no unit references', () => {
    const b = clone()
    b.courses[0].units[0].lesson_ids = b.courses[0].units[0].lesson_ids.slice(1)
    assert.equal(checkStudyCompatibility(b).pass, false)
  })

  test('multi-occasion-evidence catches a single-answer mastery rule', () => {
    const b = clone()
    firstLesson(b).mastery_rule = 'Mark mastery when the learner answers correctly once.'
    assert.equal(checkMultiOccasionEvidence(b).pass, false)
  })

  test('multi-occasion-evidence catches an assessment claiming to settle mastery alone', () => {
    const b = clone()
    b.courses[0].assessments[0].mastery_interpretation.rule = 'The unit score determines mastery.'
    assert.equal(checkMultiOccasionEvidence(b).pass, false)
  })

  test('distinct-lessons catches a lesson that only relabels another', () => {
    const b = clone()
    const [a, second] = b.courses[0].lessons
    for (const [k, v] of Object.entries(a)) {
      if (['lesson_id', 'title', 'phase', 'course_day', 'day_in_unit'].includes(k)) continue
      second[k] = structuredClone(v)
    }
    assert.equal(checkDistinctLessons(b).pass, false)
  })

  test('the negator heuristic does not hide a demand that carries a negator in another clause', () => {
    const b = clone()
    firstLesson(b).student_activity = 'Record your weight with no shoes on and log it each week.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })
})
