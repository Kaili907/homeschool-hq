// Gate tests for the Grades 9-12 Physical Education validator.
//
// Uses the Node built-in test runner rather than vitest: this worktree has no
// node_modules installed, and these tests are meant to be runnable by anyone
// checking the release without an install step.
//
// Run: node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/
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
  checkNoPublicPerformance,
  checkGuardianSafety,
  checkStandardsMapping,
  checkStudyCompatibility,
  checkMultiOccasionEvidence,
  checkTransferEvidenceAuthority,
  checkDistinctLessons,
} from './validate-course.mjs'

let real
const clone = () => structuredClone(real)
const firstLesson = (b) => b.courses[0].lessons[0]
const firstUnit = (b) => b.courses[0].units[0]

before(async () => {
  real = await loadBuild()
})

describe('the authored Grades 9-12 Physical Education release', () => {
  test('passes every gate', () => {
    const failures = runValidation(real).filter((r) => !r.pass)
    assert.deepEqual(failures.map((f) => `${f.name}: ${f.detail}`), [])
  })

  test('is four grades of 108 days and 432 lessons in total', () => {
    assert.deepEqual(real.courses.map((c) => c.grade).sort((a, b) => a - b), [9, 10, 11, 12])
    assert.equal(real.courses.reduce((n, c) => n + c.lessons.length, 0), 432)
    for (const c of real.courses) assert.equal(c.lessons.length, 108)
  })

  test('maps grades 9-10 to Michigan PE LEVEL 1 and grades 11-12 to LEVEL 2', () => {
    const byGrade = Object.fromEntries(real.courses.map((c) => [c.grade, c.pe_level]))
    assert.deepEqual(byGrade, { 9: 1, 10: 1, 11: 2, 12: 2 })
  })
})

describe('each gate catches its defect', () => {
  test('grade-progression catches a missing grade', () => {
    const b = clone()
    b.courses = b.courses.filter((c) => c.grade !== 12)
    assert.equal(checkProgression(b).pass, false)
  })

  test('grade-progression catches a grade assigned the wrong Michigan PE level', () => {
    const b = clone()
    b.courses.find((c) => c.grade === 11).pe_level = 1
    assert.equal(checkProgression(b).pass, false)
  })

  test('grade-progression catches a grade that is a copy of the year below', () => {
    const b = clone()
    b.courses[1].units[0].title = b.courses[0].units[0].title
    assert.equal(checkProgression(b).pass, false)
  })

  test('privacy-guard catches a task that harvests wearable data', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Export your wearable heart-rate data and submit the step count for each session.'
    assert.equal(checkPrivacyGuard(b).pass, false)
  })

  test('privacy-guard catches guardian visibility that exposes body data', () => {
    const b = clone()
    firstLesson(b).parent_or_guardian_visibility = 'Share everything recorded, including measurements.'
    assert.equal(checkPrivacyGuard(b).pass, false)
  })

  test('pe-inclusive-path catches a lesson with no seated route', () => {
    const b = clone()
    const l = firstLesson(b)
    l.accessibility_and_accommodations = l.accessibility_and_accommodations.map((s) => s.replace(/seated/gi, 'standing'))
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('pe-inclusive-path catches a lesson with no decline route', () => {
    const b = clone()
    const l = firstLesson(b)
    l.adaptive_tutor_routes = l.adaptive_tutor_routes.filter((r) => r.signal !== 'learner declines a task')
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('pe-inclusive-path catches a lesson with no stop rule', () => {
    const b = clone()
    const l = firstLesson(b)
    l.adaptive_tutor_routes = l.adaptive_tutor_routes.filter((r) => r.signal !== 'pain, dizziness, breathlessness, or head impact')
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('pe-inclusive-path catches an assessment that treats an adapted performance as partial credit', () => {
    const b = clone()
    b.courses[0].assessments[0].accommodation_note = 'Adapted performances are scored at 70% of the standard task.'
    assert.equal(checkInclusivePath(b).pass, false)
  })

  test('no-body-metrics catches a fitness-test battery task', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Complete the fitness test battery and record your percentile against the norm table.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })

  test('no-body-metrics catches scoring guidance that allows body-based scoring', () => {
    const b = clone()
    firstLesson(b).answer_or_scoring_guidance = 'Score the performance against the class average.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })

  test('no-body-metrics does not fire on bodyweight exercise or on movement "weight" as a quality', () => {
    const b = clone()
    firstUnit(b).topics = ['progressive loading with bodyweight', 'space, time, weight, and flow as movement qualities']
    assert.equal(checkNoBodyMetrics(b).pass, true)
  })

  test('no-media-route catches a task that demands camera proof', () => {
    const b = clone()
    firstLesson(b).student_activity = 'Film yourself performing the skill and submit the video as proof.'
    assert.equal(checkNoMediaRoute(b).pass, false)
  })

  test('no-media-route catches a lesson that cannot be completed without media', () => {
    const b = clone()
    firstLesson(b).media.required = true
    assert.equal(checkNoMediaRoute(b).pass, false)
  })

  test('no-public-performance catches a task that requires an audience', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Perform the routine in front of the class for an audience of peers.'
    assert.equal(checkNoPublicPerformance(b).pass, false)
  })

  test('no-public-performance allows performing for one trusted adult with an opt-out', () => {
    const b = clone()
    firstUnit(b).performance_task = 'Perform for an audience of one trusted adult, or describe the sequence if the learner prefers not to perform.'
    assert.equal(checkNoPublicPerformance(b).pass, true)
  })

  test('guardian-safety catches a missing supervision note', () => {
    const b = clone()
    delete firstUnit(b).guardian_safety.supervision_note
    assert.equal(checkGuardianSafety(b).pass, false)
  })

  test('guardian-safety catches movement hazards without guardian confirmation', () => {
    const b = clone()
    firstUnit(b).guardian_safety.guardian_confirmation_required = false
    assert.equal(checkGuardianSafety(b).pass, false)
  })

  test('standards-mapping catches an invented mapping status', () => {
    const b = clone()
    firstUnit(b).standards_mapping[0].mapping_status = 'canonical-ish'
    assert.equal(checkStandardsMapping(b).pass, false)
  })

  test('standards-mapping catches a mapping entry with no Michigan PE level', () => {
    const b = clone()
    delete firstLesson(b).standards_mapping[0].level
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

  test('study-compatibility catches a gap in the 108-day sequence', () => {
    const b = clone()
    b.courses[0].lessons = b.courses[0].lessons.filter((l) => l.course_day !== 50)
    assert.equal(checkStudyCompatibility(b).pass, false)
  })

  test('study-compatibility catches a duplicate lesson id', () => {
    const b = clone()
    b.courses[0].lessons[1].lesson_id = b.courses[0].lessons[0].lesson_id
    assert.equal(checkStudyCompatibility(b).pass, false)
  })

  test('multi-occasion-evidence catches a single-session mastery rule', () => {
    const b = clone()
    firstLesson(b).mastery_rule = 'Mark mastery when the learner performs the skill once.'
    assert.equal(checkMultiOccasionEvidence(b).pass, false)
  })

  test('multi-occasion-evidence catches an assessment claiming to settle mastery alone', () => {
    const b = clone()
    b.courses[0].assessments[0].mastery_interpretation.rule = 'The unit score determines mastery.'
    assert.equal(checkMultiOccasionEvidence(b).pass, false)
  })

  test('transfer-evidence-authority catches an incomplete structured learner action', () => {
    const b = clone()
    const l = b.courses[0].lessons.find((lesson) => lesson.transfer_evidence_requirement)
    l.transfer_authority.learnerTask.actionId = null
    assert.equal(checkTransferEvidenceAuthority(b).pass, false)
  })

  test('transfer-evidence-authority catches structured equal-credit evidence drift', () => {
    const b = clone()
    const l = b.courses[0].lessons.find((lesson) => lesson.transfer_evidence_requirement)
    l.transfer_authority.equalCreditPath.requiredEvidenceIds = ['GENERIC_COMPLETION']
    assert.equal(checkTransferEvidenceAuthority(b).pass, false)
  })

  test('distinct-lessons catches a second-pass lesson that only relabels the first', () => {
    const b = clone()
    const u = b.courses[0].lessons.filter((l) => l.unit_number === 1)
    const day1 = u.find((l) => l.day_in_unit === 1)
    const day7 = u.find((l) => l.day_in_unit === 7)
    // Reproduce the pre-fix generator: day 7 recycles day 1's topic and every
    // derived field, differing only in title and phase.
    for (const [k, v] of Object.entries(day1)) {
      if (['lesson_id', 'title', 'phase', 'course_day', 'day_in_unit'].includes(k)) continue
      day7[k] = structuredClone(v)
    }
    assert.equal(checkDistinctLessons(b).pass, false)
  })

  test('every unit runs its six topics over two passes, and the second pass carries a transfer condition', () => {
    for (const c of real.courses) {
      for (let unit = 1; unit <= 9; unit += 1) {
        const lessons = c.lessons.filter((l) => l.unit_number === unit)
        assert.equal(lessons.length, 12)
        assert.equal(lessons.filter((l) => l.cycle === 1).length, 6)
        assert.equal(lessons.filter((l) => l.cycle === 2).length, 6)
        for (const l of lessons.filter((l) => l.cycle === 2)) {
          assert.ok(l.transfer_condition, `${l.lesson_id} has no transfer condition`)
          assert.ok(l.formative_check.includes('degraded first'), `${l.lesson_id} reuses the first-pass check`)
        }
        // The same six topics, once per pass.
        const first = lessons.filter((l) => l.cycle === 1).map((l) => l.focus)
        const second = lessons.filter((l) => l.cycle === 2).map((l) => l.focus)
        assert.deepEqual(second, first)
      }
    }
  })

  test('the negator heuristic does not hide a demand that carries a negator in another clause', () => {
    const b = clone()
    // "no shoes" would previously have marked the whole sentence a guard.
    firstLesson(b).student_activity = 'Record your weight with no shoes on and log it each week.'
    assert.equal(checkNoBodyMetrics(b).pass, false)
  })
})
