import test from 'node:test'
import assert from 'node:assert/strict'

import { auditPeLessonExecutability, buildPeExecution } from '../src/lib/peExecution.mjs'

test('preserves authored movement cues while adding the complete execution contract', () => {
  const execution = buildPeExecution({
    lesson_id: 'g3-example',
    focus: 'starting, stopping, and dodging',
    cues: ['Eyes up.', 'Bend to stop.', 'Push into the new direction.'],
  }, 3)

  assert.deepEqual(execution.movementCues, ['Eyes up.', 'Bend to stop.', 'Push into the new direction.'])
  assert.match(execution.spaceSetup, /low-space/i)
  assert.match(execution.accessibleAdaptation, /seated/i)
  assert.match(execution.equipmentRequirements.equalCreditNoEquipment, /equal-credit/i)
  assert.equal(execution.stoppingRules.length, 3)
  assert.equal(execution.completionCriteria.length, 4)
  assert.equal(execution.guidedPractice.length, 2)
  assert.equal(execution.practiceProgression.length, 3)
  assert.match(execution.movementModel.startingPosition, /begin|choose/i)
  assert.match(execution.retryPlan.alternateModel, /contrast/i)
})

test('supplies focus-specific, age-appropriate technique for missing cue cohorts', () => {
  const objectSkill = buildPeExecution({ focus: 'throwing accuracy' }, 5)
  const training = buildPeExecution({ focus: 'progressing safely and recognizing when to hold' }, 10)
  const outdoor = buildPeExecution({ focus: 'route planning and weather decisions' }, 12)

  assert.equal(objectSkill.repairCategory, 'object-control')
  assert.match(objectSkill.movementCues.join(' '), /track|target|follow through/i)
  assert.match(objectSkill.techniqueLevel, /trusted adult/i)
  assert.equal(training.repairCategory, 'training-planning')
  assert.match(training.movementCues.join(' '), /breathing|effort|technique/i)
  assert.equal(outdoor.repairCategory, 'outdoor')
  assert.match(outdoor.equipmentRequirements.equalCreditNoEquipment, /indoor route/i)
})

test('audit fails closed when any required home-execution block is absent', () => {
  const execution = buildPeExecution({ focus: 'balance and stability' }, 7)
  const complete = {
    ...execution,
    lessonId: 'complete',
    ageAppropriateTechnique: execution.techniqueLevel,
  }
  const incomplete = { ...complete, lessonId: 'incomplete', stoppingRules: [] }
  const result = auditPeLessonExecutability([complete, incomplete])

  assert.deepEqual(result.missingSafety, ['incomplete'])
  assert.deepEqual(result.missingMovementCues, [])
  assert.deepEqual(result.equipmentBlockers, [])
  assert.deepEqual(result.missingAdaptation, [])
  assert.deepEqual(result.homeUseBlockers, [])
  assert.deepEqual(result.missingCompletionCriteria, [])
  assert.deepEqual(result.missingModel, [])
  assert.deepEqual(result.missingGuidedPractice, [])
  assert.deepEqual(result.missingProgression, [])
  assert.deepEqual(result.missingIndependentActivity, [])
  assert.deepEqual(result.missingRetry, [])
  assert.deepEqual(result.missingGuardianBoundary, [])
  assert.deepEqual(result.missingTutorBoundary, [])
})

test('derives all ten production lesson families from phase and focus authority', () => {
  const cases = [
    [{ phase: 'Launch and diagnostic', focus: 'self-space' }, 'MOVEMENT_CONCEPT_CUES'],
    [{ phase: 'Concept model A', focus: 'throwing accuracy' }, 'SKILL_DEVELOPMENT'],
    [{ phase: 'Guided practice A', focus: 'offense and defense tactics' }, 'TACTICS_DECISION_MAKING'],
    [{ phase: 'Concept model B', focus: 'training plan and recovery' }, 'FITNESS_SELF_MANAGEMENT'],
    [{ phase: 'Investigation or close reading', focus: 'warning signs and the stop rule' }, 'SAFETY_STOP_DECISION'],
    [{ phase: 'Guided practice B', focus: 'inclusive leadership and feedback' }, 'COOPERATIVE_CREATIVE_ACTIVITY'],
    [{ phase: 'Synthesis and review', focus: 'throwing accuracy' }, 'REVIEW_RETRIEVAL'],
    [{ phase: 'Reteach and varied practice', focus: 'throwing accuracy' }, 'REMEDIATION_RETRY'],
    [{ phase: 'Unit assessment', focus: 'throwing accuracy' }, 'MASTERY_PERFORMANCE'],
    [{ phase: 'Performance task build', focus: 'route planning' }, 'PROJECT_LIFETIME_ACTIVITY'],
  ]
  for (const [lesson, expected] of cases) assert.equal(buildPeExecution(lesson, 8).primaryLessonType, expected)
})

test('makes adaptation, rest, completion, and Tutor boundaries explicit', () => {
  const execution = buildPeExecution({ phase: 'Concept model A', focus: 'balance and mobility' }, 10)
  assert.deepEqual(Object.keys(execution.adaptationRoutes), [
    'seated', 'supported', 'reducedRange', 'reducedPaceOrDemand', 'mobilityAidCompatible',
    'solo', 'lowSpace', 'noEquipment', 'describedOrDecisionRoute',
  ])
  assert.match(execution.accessibleAdaptation, /without explaining why/i)
  assert.match(execution.accessibleAdaptation, /equal credit/i)
  assert.match(execution.stoppingRules[0], /^REST \/ ADJUST:/)
  assert.match(execution.stoppingRules[1], /^STOP AND TELL:/)
  assert.match(execution.stoppingRules[2], /^DO NOT RESUME:/)
  assert.match(execution.evidenceExpectations.observer, /cannot certify physical completion/i)
  assert.equal(execution.guardianAuthority.tutorOrLearnerMaySubstitute, false)
  assert.match(execution.tutorMetadata.mustNot.join(' '), /cannot claim.*certify physical completion/i)
})
