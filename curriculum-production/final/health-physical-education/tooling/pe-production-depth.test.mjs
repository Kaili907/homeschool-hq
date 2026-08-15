import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { auditPeLessonExecutability, PE_LESSON_TYPES } from '../src/lib/peExecution.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGES = resolve(ROOT, 'packages', 'physical-education')
const SCORING = resolve(ROOT, 'scoring-guides', 'physical-education')
const ANCHOR = 'ma-g12-physical-education-u08-l07'

function lessonDocs(root) {
  return readdirSync(root).sort().flatMap((gradeDir) => {
    if (!gradeDir.startsWith('grade-')) return []
    return readdirSync(resolve(root, gradeDir)).sort()
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(resolve(root, gradeDir, name), 'utf8')))
  })
}

const packages = lessonDocs(PACKAGES)
const scoring = lessonDocs(SCORING)

test('rebuilds the exact canonical PE population across every authored grade', () => {
  assert.equal(packages.length, 972)
  assert.equal(scoring.length, 972)
  assert.deepEqual([...new Set(packages.map((lesson) => lesson.grade))], [3, 4, 5, 7, 8, 9, 10, 11, 12])
  for (const grade of [3, 4, 5, 7, 8, 9, 10, 11, 12]) {
    assert.equal(packages.filter((lesson) => lesson.grade === grade).length, 108)
  }
})

test('passes every production-depth field audit with all lesson families represented', () => {
  const audit = auditPeLessonExecutability(packages)
  assert.equal(audit.lessonsAudited, 972)
  for (const [key, value] of Object.entries(audit)) {
    if (key !== 'lessonsAudited') assert.deepEqual(value, [], key)
  }
  const types = [...new Set(packages.map((lesson) => lesson.primaryLessonType))].sort()
  assert.deepEqual(types, [...PE_LESSON_TYPES].sort())
  assert.equal(new Set(packages.map((lesson) => lesson.executionCategory)).size, 11)
})

test('spot checks elementary, middle, and high school runnable family depth', () => {
  const elementary = packages.find((lesson) => lesson.grade === 3 && lesson.executionCategory === 'object-control')
  const middle = packages.find((lesson) => lesson.grade === 7 && lesson.executionCategory === 'tactics-games')
  const high = packages.find((lesson) => lesson.grade === 11 && lesson.executionCategory === 'training-planning')
  for (const lesson of [elementary, middle, high]) {
    assert.ok(lesson)
    assert.match(lesson.goal, /^I can /)
    assert.ok(lesson.movementModel.startingPosition.length > 40)
    assert.ok(lesson.movementModel.action.length > 40)
    assert.ok(lesson.movementModel.keyCue.length > 10)
    assert.ok(lesson.movementModel.commonError.length > 25)
    assert.ok(lesson.movementModel.correction.length > 25)
    assert.equal(lesson.guidedPractice.length, 2)
    assert.equal(lesson.practiceProgression.length, 3)
    assert.ok(lesson.independentActivity.freshTask.length > 40)
    assert.equal(lesson.warmUpAndFinishPolicy.applicability, 'REQUIRED_FOR_MOVEMENT')
  }
  assert.match(elementary.studentTask, /soft|object|target|path/i)
  assert.match(middle.studentTask, /arrangement|choice|recovery|space/i)
  assert.match(high.studentTask, /plan|self-management|adjustment|sequence/i)
})

test('keeps equal-credit routes, stop authority, and non-body scoring universal', () => {
  for (const lesson of packages) {
    assert.match(lesson.accessibleAdaptation, /without explaining why/i)
    assert.match(lesson.accessibleAdaptation, /equal credit/i)
    assert.match(lesson.stoppingRules[0], /^REST \/ ADJUST:/)
    assert.match(lesson.stoppingRules[1], /^STOP AND TELL:/)
    assert.match(lesson.stoppingRules[2], /^DO NOT RESUME:/)
    assert.match(lesson.evidenceExpectations.observer, /(?:No learner, )?Tutor.*(?:cannot certify physical completion|certifies physical performance)/i)
    assert.equal(lesson.guardianAuthority.tutorOrLearnerMaySubstitute, false)
  }
  for (const guide of scoring) {
    assert.match(guide.scoringGuidance, /never score|do not score/i)
    assert.match(guide.scoringGuidance, /weight/i)
    assert.match(guide.scoringGuidance, /appearance/i)
    assert.match(guide.scoringGuidance, /calories/i)
    assert.match(guide.scoringGuidance, /athletic talent/i)
    assert.match(guide.scoringGuidance, /speed/i)
    assert.match(guide.masteryRule, /at least two occasions/i)
    assert.match(guide.remediation, /simpler|visible lane labels/i)
  }
})

test('reproduces the approved Director anchor byte for byte from canonical source fixtures', () => {
  const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
  assert.equal(
    digest(resolve(ROOT, 'packages', 'physical-education', 'grade-12', `${ANCHOR}.json`)),
    digest(resolve(ROOT, 'src', 'approved', `${ANCHOR}.package.json`)),
  )
  assert.equal(
    digest(resolve(ROOT, 'scoring-guides', 'physical-education', 'grade-12', `${ANCHOR}.json`)),
    digest(resolve(ROOT, 'src', 'approved', `${ANCHOR}.scoring.json`)),
  )
})
