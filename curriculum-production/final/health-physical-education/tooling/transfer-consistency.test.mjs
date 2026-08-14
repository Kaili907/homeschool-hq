import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluatePeTransferConsistency, TRANSFER_AUTHORITY_SCHEMA } from '../src/lib/transferConsistency.mjs'

function authority() {
  const evidence = ['CUE', 'DECISION', 'TRANSFER_CONDITION']
  return {
    schemaVersion: TRANSFER_AUTHORITY_SCHEMA,
    authorityId: 'fixture-transfer-v2',
    learnerTask: {
      actionId: 'fixture:apply',
      actionKind: 'APPLY_OR_FULLY_MODEL',
      focusId: 'fixture:focus',
      executionRequired: false,
    },
    durationContinuity: {
      span: { unit: 'OCCASION', minimum: 1, coverage: 'COMPLETE_REQUIRED_SPAN' },
      uninterruptedPerformanceRequired: false,
      interruptionRecoveryRequired: false,
    },
    restInterruptionAllowance: {
      restAllowed: true,
      restPreservesParticipationCredit: true,
      transferCreditAfterRest: 'PRESERVED_WHEN_REQUIRED_EVIDENCE_IS_MET',
    },
    transferRequirement: { required: true, conditionId: 'fixture-transfer-v2:condition' },
    completionEvidence: {
      completionKind: 'PERFORM_OR_FULLY_MODEL_COMPLETE_SPAN',
      hypotheticalCompletionAllowed: true,
      requiredEvidenceIds: evidence,
      maximumCreditableSpan: { unit: 'OCCASION', maximum: 1 },
    },
    equalCreditPath: {
      routes: ['ADAPTED_PERFORMANCE', 'DIAGRAMMED_MODEL', 'PERFORMED'],
      sameEvidenceRequired: true,
      requiredEvidenceIds: evidence,
    },
    adultRubric: {
      scoringAuthority: 'RUBRIC',
      requiredEvidenceIds: evidence,
      bodyMetricsScored: false,
      participantCountScored: false,
    },
    adaptiveRouteExpectations: {
      safeReductionPreservesParticipationCredit: true,
      alternateRouteCanEarnTransferCredit: true,
      alternateRouteMustPreserveEvidence: true,
      guardianSafetyBoundaryRetained: true,
    },
  }
}

function fixture(wording = {}) {
  const canonical = authority()
  return {
    sourceLesson: {
      lesson_id: wording.lessonId ?? 'ma-g9-physical-education-u01-l07',
      grade: wording.grade ?? 9,
      unit_number: wording.unitNumber ?? 1,
      day_in_unit: wording.dayInUnit ?? 7,
      transfer_condition: wording.transfer ?? 'apply the focus under the authored transfer condition',
      transfer_authority: canonical,
    },
    learnerTransferAuthority: structuredClone(canonical),
    adultTransferAuthority: structuredClone(canonical),
    learnerWording: wording.learner ?? 'Use the cue and make the decision in the changed setting.',
    adultWording: wording.adult ?? 'Judge the cue and decision, with equal standing for every route.',
  }
}

function evaluate(value) {
  return evaluatePeTransferConsistency(value)
}

test('true scoring-authority mismatch fails', () => {
  const value = fixture()
  value.adultTransferAuthority.adultRubric.requiredEvidenceIds = ['CUE']
  const result = evaluate(value)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.classifications.includes('SCORING_AUTHORITY_CONFLICT'))
})

test('true transfer mismatch fails', () => {
  const value = fixture()
  value.learnerTransferAuthority.transferRequirement.conditionId = 'different-condition'
  const result = evaluate(value)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.classifications.includes('CONTENT_TRANSFER_CONFLICT'))
})

for (const [name, learner, adult] of [
  ['continuous run / breather wording', 'Carry the routine from its opening motion to its finish in one continuous effort; breaking the sequence voids the evidence.', 'The learner may catch their breath whenever necessary, and the credit already earned remains intact.'],
  ['single stretch / recovery wording', 'Deliver the whole combination as one unbroken stretch with no reset between parts.', 'A recovery interval may be taken between any two parts without reducing the result.'],
  ['no break / pause wording', 'Evidence counts only when every element is joined with no break in the attempt.', 'Pausing for safety leaves the attempt fully creditable.'],
]) {
  test(`paraphrased uninterrupted/rest conflict fails: ${name}`, () => {
    const value = fixture({ learner, adult })
    value.sourceLesson.transfer_authority.durationContinuity.uninterruptedPerformanceRequired = true
    value.sourceLesson.transfer_authority.restInterruptionAllowance.restPreservesParticipationCredit = false
    value.learnerTransferAuthority = structuredClone(value.sourceLesson.transfer_authority)
    value.adultTransferAuthority = structuredClone(value.sourceLesson.transfer_authority)
    value.adultTransferAuthority.restInterruptionAllowance.restAllowed = true
    value.adultTransferAuthority.restInterruptionAllowance.restPreservesParticipationCredit = true
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'UNINTERRUPTED_VS_REST_CREDIT_AUTHORITY'))
  })
}

for (const [name, learner, completion] of [
  ['seven dates / imagined afternoon', 'Carry out the plan on each of seven separate dates.', 'An imagined schedule drafted this afternoon completes the work.'],
  ['weeklong enactment / single sitting', 'Put the routine into practice throughout a seven-day span.', 'One speculative write-up produced in a single sitting earns completion.'],
  ['daily execution / same-day scenario', 'Execute the decision once per day for a full week.', 'A same-day what-if example substitutes for all seven executions.'],
]) {
  test(`paraphrased seven-day/one-day hypothetical conflict fails: ${name}`, () => {
    const value = fixture({ learner, adult: completion })
    const source = value.sourceLesson.transfer_authority
    source.learnerTask.executionRequired = true
    source.durationContinuity.span = { unit: 'DAY', minimum: 7, coverage: 'COMPLETE_REQUIRED_SPAN' }
    source.completionEvidence.hypotheticalCompletionAllowed = false
    source.completionEvidence.maximumCreditableSpan = { unit: 'DAY', maximum: 7 }
    value.learnerTransferAuthority = structuredClone(source)
    value.learnerTransferAuthority.completionEvidence.hypotheticalCompletionAllowed = true
    value.learnerTransferAuthority.completionEvidence.maximumCreditableSpan.maximum = 1
    value.adultTransferAuthority = structuredClone(source)
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'REQUIRED_SPAN_NOT_COVERED'))
    assert.ok(result.findings.some((item) => item.code === 'EXECUTION_VS_HYPOTHETICAL_COMPLETION'))
  })
}

test('valid equal-credit lesson passes', () => {
  assert.equal(evaluate(fixture()).status, 'CONSISTENT')
})

test('valid transfer lesson passes across unrelated wording variants', () => {
  for (const wording of [
    { transfer: 'respond when the planned option disappears', learner: 'Choose again after the first route closes.', adult: 'Look for a justified second choice.' },
    { transfer: 'revise under a changed constraint', learner: 'Alter the approach when circumstances shift.', adult: 'Credit the evidence of an appropriate adjustment.' },
  ]) assert.equal(evaluate(fixture(wording)).status, 'CONSISTENT')
})

test('historical false-positive pattern passes', () => {
  assert.equal(evaluate(fixture({
    transfer: 'in a full session the learner runs start to finish without prompting, in a space and on a day they did not choose',
    learner: 'Work independently through the full session in the safe version available today.',
    adult: 'Assess the same cue and decision in whatever safe version the setting allows.',
  })).status, 'CONSISTENT')
})

test('missing structured authority fails closed', () => {
  const value = fixture()
  delete value.learnerTransferAuthority
  const result = evaluate(value)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.findings.some((item) => item.code === 'STRUCTURED_AUTHORITY_MISSING'))
})

test('missing required structured boolean fails closed instead of defaulting false', () => {
  const value = fixture()
  delete value.learnerTransferAuthority.learnerTask.executionRequired
  const result = evaluate(value)
  assert.equal(result.status, 'CONFLICT')
  assert.ok(result.findings.some((item) => item.code === 'STRUCTURED_TASK_INVALID'))
})

test('lesson number and location mutation has no semantic effect', () => {
  const original = fixture()
  const moved = fixture({ lessonId: 'ma-g12-physical-education-u09-l01', grade: 12, unitNumber: 9, dayInUnit: 1 })
  assert.deepEqual(evaluate(moved), evaluate(original))
})
