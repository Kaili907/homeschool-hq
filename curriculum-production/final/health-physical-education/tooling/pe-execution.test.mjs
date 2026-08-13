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
    lessonId: 'complete',
    movementCues: execution.movementCues,
    ageAppropriateTechnique: execution.techniqueLevel,
    spaceSetup: execution.spaceSetup,
    equipmentRequirements: execution.equipmentRequirements,
    safetyRules: execution.safetyRules,
    stoppingRules: execution.stoppingRules,
    accessibleAdaptation: execution.accessibleAdaptation,
    lowSpaceNoEquipmentAlternative: execution.lowSpaceNoEquipmentAlternative,
    activitySteps: execution.activitySteps,
    completionCriteria: execution.completionCriteria,
  }
  const incomplete = { ...complete, lessonId: 'incomplete', stoppingRules: [] }
  const result = auditPeLessonExecutability([complete, incomplete])

  assert.deepEqual(result.missingSafety, ['incomplete'])
  assert.deepEqual(result.missingMovementCues, [])
  assert.deepEqual(result.equipmentBlockers, [])
  assert.deepEqual(result.missingAdaptation, [])
  assert.deepEqual(result.homeUseBlockers, [])
  assert.deepEqual(result.missingCompletionCriteria, [])
})
