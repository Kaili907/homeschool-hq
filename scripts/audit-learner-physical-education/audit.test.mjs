import test from 'node:test'
import assert from 'node:assert/strict'

import {
  auditLesson,
  negativeControls,
  projectionCheck,
  projectJsonMaterial,
} from './audit.mjs'

test('all five required negative controls detect their injected fault', () => {
  const controls = negativeControls()
  assert.deepEqual(controls.map((control) => control.id), [
    'delete_activity',
    'delete_safety',
    'camera_requirement',
    'impossible_equipment',
    'no_adaptation',
  ])
  assert.ok(controls.every((control) => control.detected), JSON.stringify(controls, null, 2))
})

test('projection preserves activity steps, cues, adaptations, and completion criteria', () => {
  const lesson = {
    privacySafeScenario: 'Complete a safe movement sequence.',
    studentTask: 'Perform the sequence and explain one choice.',
    movementCues: ['Look ahead.'],
    keyPoints: ['Slow before turning.'],
    task_steps: ['Clear the space.', 'Perform the sequence.'],
    adaptationChoices: 'Use a seated or reduced-range sequence.',
    completionCriteria: ['Complete or fully describe the sequence.'],
    accessibilitySupports: ['Use readable text.'],
  }
  assert.ok(projectJsonMaterial(lesson).length > 0)
  assert.equal(projectionCheck(lesson).pass, true)
})

test('negative policy statements do not become positive media or body findings', () => {
  const lesson = {
    lessonId: 'policy-negative-control',
    courseId: 'pe-control',
    grade: 9,
    unitNumber: 1,
    title: 'Choice and privacy',
    focus: 'safe movement',
    estimatedMinutes: '20–30',
    privacySafeScenario: 'Perform a safe movement sequence.',
    studentTask: 'Practise at a self-selected intensity and explain one adjustment.',
    materials: ['open safe space'],
    movementCues: ['Move with control.'],
    keyPoints: [],
    completionCriteria: ['Complete or describe the sequence.'],
    adaptationChoices: 'Use a seated, shorter, supported, or described version.',
    accessibilitySupports: ['Use readable text.'],
    neverRequires: [
      'This task never requires a photograph, video, or recording.',
      'This task never requires body weight, BMI, calories, or a weight-loss goal.',
    ],
  }
  const result = auditLesson(lesson)
  assert.ok(!result.flags.includes('MEDIA_PROOF_REQUIREMENT'))
  assert.ok(!result.flags.includes('BODY_WEIGHT_DIET_PROBLEM'))
})
