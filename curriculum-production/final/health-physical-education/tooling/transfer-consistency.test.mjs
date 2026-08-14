import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluatePeTransferConsistency } from '../src/lib/transferConsistency.mjs'

const base = () => ({
  sourceLesson: { transfer_condition: 'under a new tactical constraint' },
  learnerTask: 'Apply the skill under a new tactical constraint and explain the decision.',
  completionCriteria: ['Show or describe the same tactical cue and decision under that constraint.'],
  equipmentAlternative: 'A paper model earns equal credit when it shows the same tactical cue and decision.',
  accessibleAdaptation: 'A seated or described route earns equal credit when it shows the same tactical cue and decision.',
  activitySteps: ['Apply the same decision under the new constraint.'],
  adultSuccessCriteria: ['The learner shows the same tactical cue and decision under the new constraint.'],
  adultScoringGuidance: 'Score the same tactical cue and decision on every route.',
  adultAdaptiveRoutes: [{ signal: 'learner declines a task', action: 'Use the described route with the same decision evidence.' }],
  adultSafetyAndPrivacy: ['Stop and rest whenever needed.'],
  guardianSafetyReview: { supervision_note: 'Guardian sets the safe boundary.' },
})
test('genuine scoring-authority conflict fails regardless of lesson number', () => {
  const fixture = base()
  fixture.sourceLesson.transfer_condition = 'at activity speed against an opponent who is genuinely competing'
  fixture.learnerTask = 'Work at activity speed against an opponent who is genuinely competing.'
  fixture.adultSafetyAndPrivacy.push('A solo learner may complete the entire unit without another participant.')
  const result = evaluatePeTransferConsistency(fixture)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.classifications.includes('SCORING_AUTHORITY_CONFLICT'))
})

test('genuine learner transfer/content mismatch fails', () => {
  const fixture = base()
  fixture.sourceLesson.transfer_condition = 'in a scored rally, round, or innings where the score itself is the pressure'
  fixture.learnerTask = 'Complete a scored rally, round, or innings where the score itself is the pressure.'
  fixture.activitySteps = ['Complete one controlled practice-and-application sequence. No score is needed.']
  const result = evaluatePeTransferConsistency(fixture)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.classifications.includes('CONTENT_TRANSFER_CONFLICT'))
})

test('reviewed false-positive pattern passes', () => {
  const fixture = base()
  fixture.sourceLesson.transfer_condition = 'in a full session the learner runs start to finish without prompting, in a space and on a day they did not choose'
  fixture.learnerTask = `Apply the skill ${fixture.sourceLesson.transfer_condition} and compare it with the first occasion.`
  fixture.adultSuccessCriteria = [`The learner holds the skill ${fixture.sourceLesson.transfer_condition}, in whatever safe version their setting allows.`]
  assert.equal(evaluatePeTransferConsistency(fixture).status, 'CONSISTENT')
})

test('valid equal-credit lesson passes', () => {
  assert.equal(evaluatePeTransferConsistency(base()).status, 'CONSISTENT')
})

test('valid authored transfer lesson passes and a dropped authority channel fails', () => {
  const fixture = base()
  const evidence = 'Full transfer credit requires the same cue and decision. A model earns equal credit when that evidence is present.'
  fixture.sourceLesson.transfer_evidence_requirement = evidence
  fixture.learnerTask += ` ${evidence}`
  fixture.completionCriteria.push(evidence)
  fixture.equipmentAlternative += ` ${evidence}`
  fixture.accessibleAdaptation += ` ${evidence}`
  fixture.adultSuccessCriteria.push(`${fixture.sourceLesson.transfer_condition}. ${evidence}`)
  fixture.adultScoringGuidance += ` ${evidence}`
  fixture.adultAdaptiveRoutes[0].action += ` ${evidence}`
  assert.equal(evaluatePeTransferConsistency(fixture).status, 'CONSISTENT')

  fixture.adultScoringGuidance = 'Grant full credit without checking the authored evidence.'
  const result = evaluatePeTransferConsistency(fixture)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.findings.some((item) => item.code === 'AUTHORED_TRANSFER_EVIDENCE_DROPPED'))
})
